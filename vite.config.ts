import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Cloudflare Pages serves the app from the root. `--mode ghpages` builds it for the old GitHub Pages
// address, only so the app there can export your data before you move (DEPLOY.md).
export default defineConfig(({ mode }) => {
  const base = mode === 'ghpages' ? '/calisthenics-training/' : '/';
  return {
    base,
    plugins: [
      react(),
      // Offline-first: everything is precached; updates install as soon as no session is running (src/pwa.ts).
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Calisthenics',
          short_name: 'Train',
          description: 'My calisthenics plan: today’s session, timed and logged.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          theme_color: '#000000',
          background_color: '#000000',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${base}index.html`,
          // The backup API is never cached and never answered with the app shell.
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: {
      // `npx wrangler pages dev dist` runs the backup function on 8788 (DEPLOY.md, local development).
      proxy: { '/api': 'http://127.0.0.1:8788' },
    },
    test: {
      include: ['src/**/*.test.ts'],
    },
  };
});
