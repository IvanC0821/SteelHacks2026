/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CORS on the backend allows http://localhost:5173, so open the app at localhost, not 127.0.0.1.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: "localhost" },
  build: {
    rollupOptions: {
      output: {
        // React and the router change far less often than the app, so they get their own chunk and
        // stay cached across deploys. pdf.js splits itself out through the lazy PdfViewer.
        manualChunks(id: string) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
