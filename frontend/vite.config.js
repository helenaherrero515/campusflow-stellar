import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Required for @stellar/stellar-sdk in the browser
    global: "globalThis",
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          stellar: ["@stellar/stellar-sdk"],
          freighter: ["@stellar/freighter-api"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@stellar/stellar-sdk", "@stellar/freighter-api"],
    esbuildOptions: {
      target: "esnext",
    },
  },
});