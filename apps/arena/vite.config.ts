import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@norn/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
