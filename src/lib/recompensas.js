import { supabase } from "./supabaseClient";

/* "Cuida tu Barco": el propietario reclama, el admin sirve. Las reglas de quién puede qué
   están en supabase/recompensas.sql — aquí no se decide nada, solo se pide. Si alguien
   intenta reclamar un premio sin haber llegado al hito, es Postgres quien lo rechaza. */

export async function listarMisRecompensas(propietarioId) {
  const { data, error } = await supabase
    .from("recompensas")
    .select("*")
    .eq("propietario_id", propietarioId);
  if (error) throw error;
  return data;
}

export async function reclamarRecompensa(payload) {
  const { data, error } = await supabase.from("recompensas").insert(payload).select().single();
  if (error) throw error;
  await notificarRecompensa("solicitada", data.id);
  return data;
}

// Solo la cuenta de administración las ve todas (política "recompensas_select").
export async function listarRecompensasPendientes() {
  const { data, error } = await supabase
    .from("recompensas")
    .select("*, anuncios(nombre, puerto)")
    .eq("estado", "solicitada")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function marcarRecompensaEnviada(id, notaAdmin = null) {
  const { error } = await supabase
    .from("recompensas")
    .update({ estado: "enviada", enviada_at: new Date().toISOString(), nota_admin: notaAdmin || null })
    .eq("id", id);
  if (error) throw error;
  await notificarRecompensa("enviada", id);
}

/* Que falle el correo no debe tumbar la operación: la recompensa ya está guardada, y lo peor
   que pasa es que alguien se entere más tarde (mismo criterio que en notificarAnuncio). */
async function notificarRecompensa(tipo, recompensaId) {
  try {
    await supabase.functions.invoke("notificar-recompensa", { body: { tipo, recompensaId } });
  } catch (err) {
    console.error("No se ha podido enviar el aviso de la recompensa:", err);
  }
}
