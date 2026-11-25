import { defineConfig } from "vite";

// GitHub Pages liefert das Spiel unter https://johendel.github.io/Race/ aus.
export default defineConfig({
  base: "/Race/",
  build: { target: "es2022", outDir: "dist", chunkSizeWarningLimit: 1500 },
});
