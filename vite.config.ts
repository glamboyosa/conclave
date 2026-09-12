import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { apiPlugin } from "./server/api.js";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  plugins: [react(), tailwindcss(), apiPlugin()],
  server: { port: 4173 },
  preview: { port: 4173 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    exclude: ["tests/**", "node_modules/**"],
  },
});
