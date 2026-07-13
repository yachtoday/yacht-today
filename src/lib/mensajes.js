import { supabase } from "./supabaseClient";

/* Chat de una reserva, entre su cliente y su propietario. Quién puede leer o escribir en cada
   hilo lo decide el servidor (supabase/mensajes.sql): aquí no se filtra nada por seguridad,
   solo se pide. De hecho `listarMisMensajes` no lleva ningún `where`: RLS ya devuelve
   únicamente los hilos en los que participo. */

export async function listarMisMensajes() {
  const { data, error } = await supabase
    .from("mensajes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listarMensajes(reservaId) {
  const { data, error } = await supabase
    .from("mensajes")
    .select("*")
    .eq("reserva_id", reservaId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function enviarMensaje(reservaId, autorId, texto) {
  const { data, error } = await supabase
    .from("mensajes")
    .insert({ reserva_id: reservaId, autor_id: autorId, texto: texto.trim() })
    .select()
    .single();
  if (error) throw error;
  notificarMensaje(data.id);   // sin await: el mensaje ya está enviado, el correo va detrás
  return data;
}

/* Marca como leídos los mensajes que me han escrito en este hilo. El servidor solo deja tocar
   `leido_at`, y solo a quien los recibe (trigger `mensajes_no_editar`): nadie puede reescribir
   lo que dijo el otro y luego enseñarlo como prueba. */
export async function marcarLeidos(reservaId, miId) {
  const { error } = await supabase
    .from("mensajes")
    .update({ leido_at: new Date().toISOString() })
    .eq("reserva_id", reservaId)
    .neq("autor_id", miId)
    .is("leido_at", null);
  if (error) throw error;
}

async function notificarMensaje(mensajeId) {
  try {
    await supabase.functions.invoke("notificar-mensaje", { body: { mensajeId } });
  } catch (err) {
    console.error("No se ha podido avisar del mensaje:", err);
  }
}
