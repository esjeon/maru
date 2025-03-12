import { defineConfig } from "vite";

export default defineConfig({
  root: "./frontend",
  server: {
    port: 3001,
    headers: {
      "Permissions-Policy": "autoplay=(self)",
    },
    proxy: {
      "/signaling": "ws://localhost:3000/",
    },
  },
  build: {
    outDir: "../dist/frontend",
  },
});
