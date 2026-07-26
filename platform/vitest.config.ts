import { defineConfig } from "vitest/config";

export default defineConfig({
  // The legacy CRA app at the repository root has its own postcss.config.js.
  // Vite searches upward and would load it; an inline empty config stops that.
  css: { postcss: {} },
  test: {
    include: ["packages/**/test/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@crs/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@crs/jurisdictions": new URL("./packages/jurisdictions/src/index.ts", import.meta.url).pathname,
      "@crs/ingest": new URL("./packages/ingest/src/index.ts", import.meta.url).pathname,
    },
  },
});
