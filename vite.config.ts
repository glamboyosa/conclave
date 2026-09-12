import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { apiPlugin } from "./server/api.js";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  plugins: [
    react(),
    tailwindcss(),
    apiPlugin(() => loadEnv("development", process.cwd(), "")),
  ],
  server: { port: 4173 },
  preview: { port: 4173 },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    exclude: ["tests/**", "node_modules/**"],
  },
});
