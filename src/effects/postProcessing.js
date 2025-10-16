/**
 * Post-processing effects pour améliorer le rendu
 * Effets: Bloom, vignette, color grading
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Shader de vignette personnalisé
const VignetteShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'offset': { value: 1.0 },
        'darkness': { value: 1.0 }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
            float vignette = 1.0 - dot(uv, uv);
            vignette = clamp(pow(vignette, darkness), 0.0, 1.0);
            texel.rgb *= vignette;
            gl_FragColor = texel;
        }
    `
};

// Shader de color grading pour améliorer les couleurs
const ColorGradingShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'brightness': { value: 0.0 },
        'contrast': { value: 1.0 },
        'saturation': { value: 1.0 }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float brightness;
        uniform float contrast;
        uniform float saturation;
        varying vec2 vUv;

        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);

            // Brightness
            texel.rgb += brightness;

            // Contrast
            texel.rgb = (texel.rgb - 0.5) * contrast + 0.5;

            // Saturation
            float gray = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
            texel.rgb = mix(vec3(gray), texel.rgb, saturation);

            gl_FragColor = texel;
        }
    `
};

// Shader de sharpen pour netteté
const SharpenShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'resolution': { value: new THREE.Vector2(1.0 / 1024, 1.0 / 512) },
        'amount': { value: 0.5 }
    },

    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float amount;
        varying vec2 vUv;

        void main() {
            vec2 step = resolution;

            vec3 texA = texture2D(tDiffuse, vUv + vec2(-step.x, -step.y)).rgb;
            vec3 texB = texture2D(tDiffuse, vUv + vec2( step.x, -step.y)).rgb;
            vec3 texC = texture2D(tDiffuse, vUv + vec2(-step.x,  step.y)).rgb;
            vec3 texD = texture2D(tDiffuse, vUv + vec2( step.x,  step.y)).rgb;

            vec3 around = 0.25 * (texA + texB + texC + texD);
            vec3 center = texture2D(tDiffuse, vUv).rgb;

            vec3 col = center + (center - around) * amount;

            gl_FragColor = vec4(col, 1.0);
        }
    `
};

/**
 * Crée et configure le système de post-processing
 */
export function createPostProcessing(renderer, scene, camera, options = {}) {
    const {
        enableBloom = true,
        enableVignette = true,
        enableColorGrading = true,
        enableSharpen = false,
        bloomStrength = 0.6,
        bloomRadius = 0.4,
        bloomThreshold = 0.85
    } = options;

    // Créer le composer
    const composer = new EffectComposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);

    // 1. Render pass de base
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 2. Bloom effect (lueur lumineuse)
    if (enableBloom) {
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomStrength,
            bloomRadius,
            bloomThreshold
        );
        composer.addPass(bloomPass);
        console.log('✨ Bloom effect enabled');
    }

    // 3. Color grading (amélioration des couleurs)
    if (enableColorGrading) {
        const colorGradingPass = new ShaderPass(ColorGradingShader);
        colorGradingPass.uniforms['brightness'].value = 0.15; // Beaucoup plus lumineux
        colorGradingPass.uniforms['contrast'].value = 1.1; // Contraste léger
        colorGradingPass.uniforms['saturation'].value = 1.2; // Couleurs plus vives
        composer.addPass(colorGradingPass);
        console.log('🎨 Color grading enabled (bright mode)');
    }

    // 4. Sharpen (netteté)
    if (enableSharpen) {
        const sharpenPass = new ShaderPass(SharpenShader);
        sharpenPass.uniforms['resolution'].value = new THREE.Vector2(
            1.0 / window.innerWidth,
            1.0 / window.innerHeight
        );
        sharpenPass.uniforms['amount'].value = 0.3;
        composer.addPass(sharpenPass);
        console.log('🔍 Sharpen effect enabled');
    }

    // 5. Vignette (bords sombres - réduit pour plus de luminosité)
    if (enableVignette) {
        const vignettePass = new ShaderPass(VignetteShader);
        vignettePass.uniforms['offset'].value = 1.3; // Plus subtil
        vignettePass.uniforms['darkness'].value = 0.8; // Moins sombre
        vignettePass.renderToScreen = true; // Dernier pass
        composer.addPass(vignettePass);
        console.log('🌑 Vignette effect enabled (subtle)');
    }

    // Fonction de resize
    const onWindowResize = () => {
        composer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize);

    return {
        composer,
        onWindowResize,
        dispose: () => {
            window.removeEventListener('resize', onWindowResize);
            composer.dispose();
        }
    };
}

/**
 * Met à jour dynamiquement les effets selon la vitesse de la voiture
 */
export function updatePostProcessingBySpeed(composer, speed, maxSpeed = 25) {
    const speedFactor = Math.min(speed / maxSpeed, 1.0);

    // Intensifier le bloom avec la vitesse
    const bloomPass = composer.passes.find(pass => pass instanceof UnrealBloomPass);
    if (bloomPass) {
        bloomPass.strength = 0.6 + speedFactor * 0.4; // 0.6 à 1.0
    }

    // Augmenter saturation avec la vitesse
    const colorGradingPass = composer.passes.find(pass => pass.uniforms && pass.uniforms.saturation);
    if (colorGradingPass) {
        colorGradingPass.uniforms['saturation'].value = 1.2 + speedFactor * 0.3; // 1.2 à 1.5
    }
}
