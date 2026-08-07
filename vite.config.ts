import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
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
          theme_color: '#FF8700',
          background_color: '#F5F6FA',
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
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
