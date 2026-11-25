import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@apex/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@apex/net": fileURLToPath(new URL("./packages/net/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
