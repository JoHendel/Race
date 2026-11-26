import { defineConfig } from "vite";

// GitHub Pages liefert das Spiel unter https://johendel.github.io/Race/ aus.
export default defineConfig({
  base: "/Race/",
  build: {
    target: "es2022",
    outDir: "dist",
    // Rapier ships its physics engine as a ~2 MB WASM blob inside JS; it cannot get smaller.
    chunkSizeWarningLimit: 4500,
    rolldownOptions: {
      output: {
        // Large libraries in their own files: they change rarely, so browsers keep them cached across game updates.
        advancedChunks: {
          groups: [
            { name: "rapier", test: /@dimforge/ },
            { name: "three", test: /node_modules[\\/]three/ },
            { name: "peerjs", test: /peerjs/ },
          ],
        },
      },
    },
  },
});
