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

export async function actualizarAnuncio(id, cambios) {
  const { data, error } = await supabase.from("anuncios").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return filaAItem(data);
}

/* Las fotos se guardan como URL pública completa; Storage necesita la ruta a secas
   ("<user-id>/<archivo>"). Esto la extrae. Devuelve null si la URL no es de este bucket
   (por si alguna vez se guardó algo raro), para no intentar borrar lo que no toca. */
function rutaDeUrlPublica(url, bucket) {
  const marca = `/storage/v1/object/public/${bucket}/`;
  const i = String(url).indexOf(marca);
  return i === -1 ? null : decodeURIComponent(String(url).slice(i + marca.length));
}

/* Borra los archivos de un anuncio de Storage. No queremos dejar fotos huérfanas ocupando
   espacio: la fila desaparece y sus archivos también. Requiere las políticas de borrado de
   supabase/editar-y-borrar-anuncios.sql — sin ellas Storage devuelve 403 en silencio. */
export async function borrarArchivosDeAnuncio({ fotos, documentos }) {
  const rutasFotos = (fotos || []).map((u) => rutaDeUrlPublica(u, "fotos-anuncios")).filter(Boolean);
  if (rutasFotos.length) {
    const { error } = await supabase.storage.from("fotos-anuncios").remove(rutasFotos);
    if (error) throw error;
  }
  // Los documentos ya se guardan como rutas de Storage, no como URLs.
  const rutasDocs = (documentos || []).filter(Boolean);
  if (rutasDocs.length) {
    const { error } = await supabase.storage.from("documentos-anuncios").remove(rutasDocs);
    if (error) throw error;
  }
}

export async function eliminarAnuncio(id) {
  // Primero los archivos: si se borrase la fila antes, se perderían sus rutas y las fotos
  // quedarían para siempre en el bucket sin que nadie sepa a qué anuncio pertenecían.
  const { data: anuncio } = await supabase.from("anuncios").select("fotos, documentos").eq("id", id).single();
  if (anuncio) {
    try {
      await borrarArchivosDeAnuncio(anuncio);
    } catch (err) {
      // Que no se pueda limpiar el bucket no debe impedir que el propietario borre su
      // anuncio: lo grave es dejarlo publicado, no dejar un archivo suelto.
      console.error("No se han podido borrar los archivos del anuncio:", err);
    }
  }
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

export async function cambiarEstadoAnuncio(id, estado, motivoRechazo = null) {
  const cambios = { estado, motivo_rechazo: estado === "Rechazado" ? motivoRechazo : null };
  const { error } = await supabase.from("anuncios").update(cambios).eq("id", id);
  if (error) throw error;
  await notificarAnuncio(estado === "Publicado" ? "aprobado" : "rechazado", id);
}

/* Avisa por correo del proceso de revisión: al admin cuando hay algo que revisar, y al
   propietario cuando se le aprueba o se le rechaza (con el motivo). Que falle el correo no
   debe tumbar la operación: el anuncio ya está guardado, lo peor que pasa es que alguien se
   entere más tarde. */
export async function notificarAnuncio(tipo, anuncioId) {
  try {
    await supabase.functions.invoke("notificar-anuncio", { body: { tipo, anuncioId } });
  } catch (err) {
    console.error("No se ha podido enviar el aviso del anuncio:", err);
  }
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
