import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Capacitor's capacitor:// scheme causes WKWebView to redact all error details
// from scripts tagged with crossorigin — remove it from the built HTML.
function removeScriptCrossOrigin() {
  return {
    name: "remove-script-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/<script([^>]*)\scrossorigin(?:="[^"]*")?/g, "<script$1");
    },
  };
}

export default defineConfig({
  // Electron prod builds load from file://, so paths must be relative
  base: process.env.ELECTRON ? './' : '/',
  plugins: [react(), removeScriptCrossOrigin()],
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
