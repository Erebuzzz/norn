import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const rootDir = import.meta.dirname || resolve(".");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@norn/ui": resolve(rootDir, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 3002,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        arena: resolve(rootDir, "arena/index.html"),
        docs: resolve(rootDir, "docs/index.html"),
        notFound: resolve(rootDir, "404.html"),
      },
    },
  },
});
