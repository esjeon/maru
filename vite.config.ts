import { defineConfig } from "vite";

export default defineConfig({
  root: "./frontend",
  server: {
    port: 3001,
    proxy: {
      "/signaling": "ws://localhost:3000/",
    },
  },
  build: {
    outDir: "../dist/frontend",
  },
});
