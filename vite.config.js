import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "path";

/* El modo "share" empaqueta toda la app (JS, CSS e imágenes) en un único
   archivo HTML autocontenido, para poder compartirla como enlace sin
   depender de un hosting. El build normal (npm run build) no se ve afectado.

   El build normal genera DOS html: index.html y propietarios.html. Los dos montan la
   misma app de React; lo único que cambia son las etiquetas <meta> de la cabecera, para
   que al pegar yachtoday.com/propietarios en Wallapop o WhatsApp la vista previa le hable
   al dueño del barco y no al turista. El modo "share" solo empaqueta index.html. */
export default defineConfig(({ mode }) => ({
  plugins: mode === "share" ? [react(), viteSingleFile()] : [react()],
  build: mode === "share"
    ? { assetsInlineLimit: 100000000, cssCodeSplit: false }
    : {
        rollupOptions: {
          input: {
            main: resolve(__dirname, "index.html"),
            propietarios: resolve(__dirname, "propietarios.html"),
          },
        },
      },
}));
