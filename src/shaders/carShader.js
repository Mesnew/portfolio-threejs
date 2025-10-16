/**
 * Shaders personnalisés pour améliorer le rendu de la voiture et de la scène
 */

// Shader pour effet métallique de la voiture
export const carMetallicShader = {
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,

    fragmentShader: `
        uniform vec3 carColor;
        uniform float metalness;
        uniform float roughness;
        uniform float envMapIntensity;

        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec2 vUv;

        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);

            // Fresnel effect pour reflets métalliques
            float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

            // Lighting simple
            vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
            float diff = max(dot(normal, lightDir), 0.0);

            // Specular highlight
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);

            // Combine
            vec3 ambient = carColor * 0.3;
            vec3 diffuse = carColor * diff * 0.7;
            vec3 specular = vec3(1.0) * spec * metalness;
            vec3 fresnelColor = vec3(1.0) * fresnel * 0.3;

            vec3 finalColor = ambient + diffuse + specular + fresnelColor;

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};

// Shader pour effet de vitesse (motion blur)
export const speedShader = {
    vertexShader: `
        varying vec2 vUv;

        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float speed;
        uniform vec2 center;

        varying vec2 vUv;

        void main() {
            vec2 direction = vUv - center;
            float distance = length(direction);
            direction = normalize(direction);

            vec4 color = vec4(0.0);
            float total = 0.0;

            // Motion blur basé sur la vitesse
            float samples = 5.0;
            float blurAmount = speed * 0.01;

            for (float i = 0.0; i < samples; i++) {
                float offset = (i / samples - 0.5) * blurAmount;
                vec2 sampleUv = vUv + direction * offset * distance;
                color += texture2D(tDiffuse, sampleUv);
                total += 1.0;
            }

            gl_FragColor = color / total;
        }
    `
};

// Shader pour effet de trail (trainée lumineuse)
export const trailShader = {
    vertexShader: `
        varying vec2 vUv;
        varying float vAlpha;

        uniform float fade;

        void main() {
            vUv = uv;
            vAlpha = fade;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        varying vec2 vUv;
        varying float vAlpha;

        uniform vec3 color;
        uniform float intensity;

        void main() {
            // Gradient du centre vers l'extérieur
            float dist = length(vUv - 0.5) * 2.0;
            float alpha = (1.0 - dist) * vAlpha * intensity;

            gl_FragColor = vec4(color, alpha);
        }
    `
};

// Shader pour effet de glow (lueur)
export const glowShader = {
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;

        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;

        uniform vec3 glowColor;
        uniform float glowIntensity;

        void main() {
            float intensity = pow(0.7 - dot(vNormal, vPositionNormal), 2.0);
            vec3 glow = glowColor * intensity * glowIntensity;
            gl_FragColor = vec4(glow, intensity);
        }
    `
};

// Shader pour effet de chrome/reflet
export const chromeShader = {
    vertexShader: `
        varying vec3 vReflect;
        varying vec3 vNormal;

        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vec3 cameraToVertex = normalize(worldPosition.xyz - cameraPosition);

            vNormal = normalize(normalMatrix * normal);
            vReflect = reflect(cameraToVertex, vNormal);

            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,

    fragmentShader: `
        varying vec3 vReflect;
        varying vec3 vNormal;

        uniform vec3 baseColor;
        uniform float chromeIntensity;

        void main() {
            // Simpler chrome effect using reflection
            vec3 skyColor = vec3(0.5, 0.7, 1.0);
            vec3 groundColor = vec3(0.3, 0.3, 0.3);

            float mixFactor = vReflect.y * 0.5 + 0.5;
            vec3 envColor = mix(groundColor, skyColor, mixFactor);

            vec3 finalColor = mix(baseColor, envColor, chromeIntensity);

            gl_FragColor = vec4(finalColor, 1.0);
        }
    `
};
