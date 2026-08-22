import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import path from "path";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: "./vitest.setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "vitest.setup.ts",
        "dist/**",
        "src/popup/**",
        "src/options/**",
        "src/components/**",
        "src/hooks/**",
        "src/types/**",
        "src/storage/**",
        "vite.config.ts",
        "tailwind.config.js",
        "postcss.config.js",
        "manifest.config.ts"
      ]
    }
  }
});
