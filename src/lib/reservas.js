import { supabase } from "./supabaseClient";

// Convierte una fila de la tabla `reservas` a la forma que usa el resto de la app.
function filaAReserva(row) {
  return {
    id: row.id, barcoId: row.anuncio_id, barco: row.barco, puerto: row.puerto, zona: row.zona,
    cliente: row.cliente_nombre, detalle: row.detalle, subtotal: row.subtotal, servicio: row.servicio,
    total: row.total, fianza: row.fianza, fianzaEstado: row.fianza_estado,
    licenciaVerificada: row.licencia_verificada, inicioISO: row.inicio_iso, finISO: row.fin_iso,
    estado: row.estado, metodoPago: row.metodo_pago, motivoCancelacion: row.motivo_cancelacion,
    resena: row.resena_estrellas ? { estrellas: row.resena_estrellas, comentario: row.resena_comentario } : null,
  };
}

export async function listarMisReservas(clienteId) {
  const { data, error } = await supabase.from("reservas").select("*").eq("cliente_id", clienteId).neq("estado", "cancelada").order("inicio_iso", { ascending: false });
  if (error) throw error;
  return data.map(filaAReserva);
}

export async function listarReservasRecibidas(propietarioId) {
  const { data, error } = await supabase.from("reservas").select("*").eq("propietario_id", propietarioId).neq("estado", "cancelada").order("inicio_iso", { ascending: false });
  if (error) throw error;
  return data.map(filaAReserva);
}

export async function actualizarReserva(id, cambios) {
  const { error } = await supabase.from("reservas").update(cambios).eq("id", id);
  if (error) throw error;
}

/* R16 (SEC-009) · el aviso de cancelación a la OTRA parte ya no lo dispara el navegador: lo
   dispara un trigger de la base de datos con la service_role key
   (supabase/migrations/20260724_r16_sec009_notificar_backend.sql) al ver que `estado` pasa a
   'cancelada', porque notificar-cancelacion ahora exige ese candado exacto. */
