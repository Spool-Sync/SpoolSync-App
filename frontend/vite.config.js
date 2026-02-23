import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import path from "path";

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 8080,
    proxy: {
      "/api": {
        target: "https://spoolsync.prague.k3s",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        headers: {
          host: "spoolsync.prague.k3s",
          origin: "https://spoolsync.prague.k3s",
        },
      },
      "/socket.io": {
        target: "https://spoolsync.prague.k3s",
        ws: true,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        headers: {
          host: "spoolsync.prague.k3s",
          origin: "https://spoolsync.prague.k3s",
        },
      },
    },
  },
});
