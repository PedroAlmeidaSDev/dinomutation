import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  server: {
    // shared/economy.json lives outside client/.
    fs: { allow: ['..'] },
  },
});
