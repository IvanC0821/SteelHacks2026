/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// CORS on the backend allows http://localhost:5173, so open the app at localhost, not 127.0.0.1.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: "localhost" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
