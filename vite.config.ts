import { defineConfig } from 'vite';

export default defineConfig({
  root: './frontend', // Set the root directory to your project's root (default is '.')
  server: {
    port: 3001,
    proxy: {
      '/signaling': 'ws://localhost:3000/signaling',
    },
  },
  build: {
    outDir: './dist/frontend', // Specify the output directory for production builds
  },
});