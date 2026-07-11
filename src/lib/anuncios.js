import { supabase } from "./supabaseClient";

// Convierte una fila de la tabla `anuncios` a la forma que usa el resto de la app.
export function filaAItem(row) {
  return {
    ...row,
    desc: row.descripcion,
    unidad: row.clase === "experiencia" ? "persona" : "día",
  };
}

export async function listarAnunciosPublicados() {
  const { data, error } = await supabase
    .from("anuncios")
    .select("*")
    .eq("estado", "Publicado")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(filaAItem);
}

export async function listarMisAnuncios(propietarioId) {
  const { data, error } = await supabase
    .from("anuncios")
    .select("*")
    .eq("propietario_id", propietarioId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(filaAItem);
}

export async function crearAnuncio(payload) {
  const { data, error } = await supabase.from("anuncios").insert(payload).select().single();
  if (error) throw error;
  return filaAItem(data);
}

export async function eliminarAnuncio(id) {
  const { error } = await supabase.from("anuncios").delete().eq("id", id);
  if (error) throw error;
}

// Solo la cuenta de administración los ve (política RLS "anuncios_select_admin").
export async function listarAnunciosEnRevision() {
  const { data, error } = await supabase
    .from("anuncios")
    .select("*")
    .eq("estado", "En revisión")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(filaAItem);
}

export async function cambiarEstadoAnuncio(id, estado) {
  const { error } = await supabase.from("anuncios").update({ estado }).eq("id", id);
  if (error) throw error;
}

// Sube varias fotos a Storage, bajo la carpeta del propio usuario, y devuelve sus URLs públicas.
export async function subirFotos(propietarioId, archivos) {
  const urls = [];
  for (const archivo of archivos) {
    const limpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const ruta = `${propietarioId}/${Date.now()}-${limpio}`;
    const { error } = await supabase.storage.from("fotos-anuncios").upload(ruta, archivo);
    if (error) throw error;
    const { data } = supabase.storage.from("fotos-anuncios").getPublicUrl(ruta);
    urls.push(data.publicUrl);
  }
  return urls;
}

// Sube documentación (matrícula, póliza...) a un bucket privado y devuelve rutas de Storage,
// no URLs públicas: solo el propio propietario y la cuenta admin pueden verlas (ver documentos.sql).
export async function subirDocumentos(propietarioId, archivos) {
  const rutas = [];
  for (const archivo of archivos) {
    const limpio = archivo.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const ruta = `${propietarioId}/${Date.now()}-${limpio}`;
    const { error } = await supabase.storage.from("documentos-anuncios").upload(ruta, archivo);
    if (error) throw error;
    rutas.push(ruta);
  }
  return rutas;
}

// Genera una URL temporal (2 min) para ver un documento privado. RLS decide si el usuario
// autenticado tiene permiso (es el propietario o es la cuenta admin).
export async function urlFirmadaDocumento(ruta) {
  const { data, error } = await supabase.storage.from("documentos-anuncios").createSignedUrl(ruta, 120);
  if (error) throw error;
  return data.signedUrl;
}
