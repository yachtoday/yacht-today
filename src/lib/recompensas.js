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

/* R16 (SEC-009) · el aviso al reclamar ("solicitada") y al marcar enviada ya no los dispara el
   navegador: los dispara un trigger de la base de datos con la service_role key
   (supabase/migrations/20260724_r16_sec009_notificar_backend.sql), porque notificar-recompensa
   ahora exige ese candado exacto. */
export async function marcarRecompensaEnviada(id, notaAdmin = null) {
  const { error } = await supabase
    .from("recompensas")
    .update({ estado: "enviada", enviada_at: new Date().toISOString(), nota_admin: notaAdmin || null })
    .eq("id", id);
  if (error) throw error;
}
