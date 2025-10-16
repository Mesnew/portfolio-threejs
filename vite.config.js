import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Configuration du serveur de développement
  server: {
    port: 3000,
    open: true, // Ouvre automatiquement le navigateur
    host: true, // Expose sur le réseau local
    headers: {
      // Security headers pour dev
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  },

  // Configuration du build pour production
  build: {
    // Répertoire de sortie
    outDir: 'dist',

    // Générer les sourcemaps pour debugging
    sourcemap: false, // Désactiver en prod pour taille

    // Minification agressive
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Supprime tous les console.log
        drop_debugger: true, // Supprime les debugger
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Fonctions à supprimer
      },
      format: {
        comments: false, // Supprime les commentaires
      },
    },

    // Optimisation des chunks
    rollupOptions: {
      output: {
        // Stratégie de splitting manuel pour optimiser le cache
        manualChunks: {
          // Vendor chunk: Three.js et dépendances
          'three-vendor': ['three'],

          // Physique séparée (gros package)
          'physics': ['@dimforge/rapier3d-compat'],

          // Three.js addons
          'three-addons': [
            'three/examples/jsm/controls/OrbitControls.js',
            'three/examples/jsm/loaders/GLTFLoader.js',
          ],
        },

        // Nommage des chunks pour cache busting
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },

    // Taille limite d'avertissement (en KB)
    chunkSizeWarningLimit: 1000,

    // Options de compression
    assetsInlineLimit: 4096, // Inline les assets < 4KB en base64

    // Optimisation CSS
    cssCodeSplit: true,
    cssMinify: true,

    // Reportage de la taille du bundle
    reportCompressedSize: true,

    // Target ES2020 pour meilleure performance
    target: 'es2020',
  },

  // Optimisation des dépendances
  optimizeDeps: {
    // Pre-bundle ces dépendances pour dev plus rapide
    include: [
      'three',
      '@dimforge/rapier3d-compat',
    ],

    // Exclure les dépendances qui causent des problèmes
    exclude: [],

    // Force l'optimisation même si déjà en cache
    force: false,
  },

  // Configuration des alias pour imports plus propres
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@utils': resolve(__dirname, './src/utils'),
      '@objects': resolve(__dirname, './src/objects'),
      '@effects': resolve(__dirname, './src/effects'),
      '@physics': resolve(__dirname, './src/physics'),
      '@shaders': resolve(__dirname, './src/shaders'),
    },
  },

  // Configuration des assets statiques
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr'],

  // Plugin pour visualiser la taille du bundle (optionnel)
  // Décommenter pour activer l'analyse
  // plugins: [
  //   visualizer({
  //     open: true,
  //     gzipSize: true,
  //     brotliSize: true,
  //   })
  // ],

  // Configuration du base path (si hébergé dans un sous-répertoire)
  base: './',

  // Variables d'environnement publiques
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },

  // Mode de développement avec HMR (Hot Module Replacement)
  // optimisé pour Three.js
  esbuild: {
    // Suppression des console.log en production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],

    // Optimisations ESBuild
    legalComments: 'none',
    target: 'es2020',
  },
});
