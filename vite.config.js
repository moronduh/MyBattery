import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      recharts: path.resolve(__dirname, "node_modules/recharts"),
    },
  },
  server: {
    fs: { allow: [".."] },
    hmr: { overlay: false },
  },
  optimizeDeps: {
    include: ["recharts"],
  },
});
