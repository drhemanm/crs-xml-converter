import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  // The legacy CRA app at the repository root has its own postcss.config.js;
  // an inline empty config stops Vite searching upward and loading it.
  css: { postcss: {} },
  // libxml2-wasm initialises the WebAssembly module with a top-level await, so
  // the build target has to permit it. This sets the real browser floor for
  // client-side XSD validation: Chrome/Edge 89+, Firefox 89+, Safari 15+.
  build: { target: "es2022" },
  optimizeDeps: { esbuildOptions: { target: "es2022" } },
  worker: { format: "es" },
  resolve: {
    alias: {
      "@crs/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      "@crs/ingest": fileURLToPath(new URL("../../packages/ingest/src/index.ts", import.meta.url)),
      "@crs/jurisdictions": fileURLToPath(new URL("../../packages/jurisdictions/src/index.ts", import.meta.url)),
      "@crs/validate": fileURLToPath(new URL("../../packages/validate/src/index.ts", import.meta.url)),
    },
  },
});
