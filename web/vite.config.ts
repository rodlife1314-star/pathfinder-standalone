import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dir,
  plugins: [react()],
  resolve: {
    alias: {
      "@core": path.resolve(dir, "../src/core"),
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    allowedHosts: true,
    fs: { allow: [path.resolve(dir, "..")] },
    proxy: {
      "/api": `http://localhost:${process.env.PORT ?? 3000}`,
    },
  },
  build: {
    outDir: path.resolve(dir, "dist"),
    emptyOutDir: true,
  },
});
