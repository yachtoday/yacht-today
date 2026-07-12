import { supabase } from "./supabaseClient";
import { filaAItem } from "./anuncios";

/* Devuelve los anuncios que el usuario ha guardado. Se trae el anuncio entero (join) para
   poder pintar la tarjeta sin una segunda consulta. */
export async function listarFavoritos(usuarioId) {
  const { data, error } = await supabase
    .from("favoritos")
    .select("anuncio_id, anuncios(*)")
    .eq("usuario_id", usuarioId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // Un favorito puede apuntar a un anuncio que ya no está publicado: no se enseña.
  return data.map((f) => f.anuncios).filter((a) => a && a.estado === "Publicado").map(filaAItem);
}

export async function anadirFavorito(usuarioId, anuncioId) {
  const { error } = await supabase.from("favoritos").insert({ usuario_id: usuarioId, anuncio_id: anuncioId });
  if (error) throw error;
}

export async function quitarFavorito(usuarioId, anuncioId) {
  const { error } = await supabase.from("favoritos").delete().eq("usuario_id", usuarioId).eq("anuncio_id", anuncioId);
  if (error) throw error;
}
