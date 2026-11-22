import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Meu Jurista Online',
          short_name: 'Meu Jurista',
          description: 'Gestão inteligente de crédito e cobrança',
          theme_color: '#FFFFFF',
          background_color: '#F4F5F7',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          orientation: 'portrait-primary',
          icons: [
            {src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
            {src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
            {src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable'},
            {src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
          ],
        },
        workbox: {
          // Só faz cache do app shell (JS/CSS/HTML/ícones/fontes). O
          // Firestore usa WebSocket/long-polling e já tem seu próprio cache
          // offline — não interceptamos essas chamadas aqui. O Service
          // Worker só controla fetches da própria origem (meujurista.online)
          // — nunca alcança auth.meujurista.online nem accounts.google.com.
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        output: {
          // Firebase fica junto do app principal: separar em outro arquivo
          // quebrava a ordem de registro do App Check ("app-check has not been registered").
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});
