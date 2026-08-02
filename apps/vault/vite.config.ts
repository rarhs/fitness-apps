import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vault — Exercise Library',
        short_name: 'Vault',
        description:
          'Exercise reference library, routine builder and session logger — 1,324 exercises.',
        start_url: '/',
        display: 'standalone',
        background_color: '#161826',
        theme_color: '#161826',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache = the app shell only. Exercise media and instruction text
        // live on the dataset's Pages deployment and are cached at runtime;
        // Supabase requests are deliberately never cached (no route matches).
        runtimeCaching: [
          {
            // 180×180 stills and GIFs — small, immutable, capped by entry count
            urlPattern: /^https:\/\/rarhs\.github\.io\/exercises-dataset\/(images|videos)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 400, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // the full dataset (~14 MB, instruction text) — rarely changes
            urlPattern: /^https:\/\/rarhs\.github\.io\/exercises-dataset\/data\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exercise-data',
              expiration: { maxEntries: 4 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
