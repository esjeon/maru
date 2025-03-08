import { defineConfig } from 'vite';

export default defineConfig({
  root: './frontend',
  server: {
    port: 3001,
    proxy: {
      '/socket': 'ws://localhost:3000/socket',
    },
  },
  build: {
    outDir: '../dist/frontend',
  },
});
