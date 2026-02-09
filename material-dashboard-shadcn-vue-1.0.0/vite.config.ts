import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import VueDevTools from "vite-plugin-vue-devtools";
import VueInspector from "vite-plugin-vue-inspector";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => ({
  base: "/material-dashboard-shadcn-vue/",
  plugins: [
    vue(),
    mode === "development" &&
      VueDevTools({
        appendTo: "manually",
      }),
    mode === "development" &&
      VueInspector({
        toggleButtonVisibility: "always",
        editor: "code",
      }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5000,
    hmr: {
      clientPort: 443,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
}));
