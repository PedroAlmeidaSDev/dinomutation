import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // shared/economy.json lives outside client/.
    fs: { allow: ['..'] },
    // Same-origin API in development (production: Vercel rewrite, see the README).
    proxy: { '/api': 'http://localhost:8080' },
  },
});
