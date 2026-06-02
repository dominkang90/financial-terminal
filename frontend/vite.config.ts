import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("lightweight-charts")) return "charts";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react";
          if (id.includes("node_modules/zustand")) return "state";
          if (id.includes("node_modules/@radix-ui") || id.includes("node_modules/lucide")) return "ui";
        },
      },
    },
  },
});
