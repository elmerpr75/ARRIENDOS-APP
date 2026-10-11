import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'serve-pwa-static-assets',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url === '/manifest.webmanifest' || req.url === '/manifest.json') {
              const manifestFile = path.resolve(__dirname, 'public/manifest.json');
              if (fs.existsSync(manifestFile)) {
                res.setHeader('Content-Type', 'application/manifest+json');
                return res.end(fs.readFileSync(manifestFile));
              }
            }
            if (req.url === '/sw.js') {
              const swFile = path.resolve(__dirname, 'public/sw.js');
              if (fs.existsSync(swFile)) {
                res.setHeader('Content-Type', 'application/javascript');
                return res.end(fs.readFileSync(swFile));
              }
            }
            next();
          });
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        manifest: {
          id: '/',
          name: 'ARRIENDOS - Rent Manager',
          short_name: 'ARRIENDOS',
          description: 'Control de propiedades, contratos, facturas y balances de arrendamiento para Android y Windows',
          theme_color: '#1e293b',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            pdf: ['jspdf', 'html2canvas', 'html2canvas-pro'],
            motion: ['motion', 'lucide-react'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
