import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/* El modo "share" empaqueta toda la app (JS, CSS e imágenes) en un único
   archivo HTML autocontenido, para poder compartirla como enlace sin
   depender de un hosting. El build normal (npm run build) no se ve afectado. */
export default defineConfig(({ mode }) => ({
  plugins: mode === "share" ? [react(), viteSingleFile()] : [react()],
  build: mode === "share" ? { assetsInlineLimit: 100000000, cssCodeSplit: false } : {},
}));
