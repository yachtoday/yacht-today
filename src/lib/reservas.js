import { supabase } from "./supabaseClient";

// Convierte una fila de la tabla `reservas` a la forma que usa el resto de la app.
function filaAReserva(row) {
  return {
    id: row.id, barcoId: row.anuncio_id, barco: row.barco, puerto: row.puerto, zona: row.zona,
    cliente: row.cliente_nombre, detalle: row.detalle, subtotal: row.subtotal, servicio: row.servicio,
    total: row.total, fianza: row.fianza, fianzaEstado: row.fianza_estado,
    licenciaVerificada: row.licencia_verificada, inicioISO: row.inicio_iso, finISO: row.fin_iso,
    estado: row.estado, motivoCancelacion: row.motivo_cancelacion,
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

/* Avisa por correo a la OTRA parte de que la reserva se ha cancelado. Antes no se avisaba a
   nadie: si el propietario cancelaba, el cliente podía plantarse en el puerto sin saberlo.
   Que falle el correo no debe tumbar la cancelación, que ya está hecha. */
export async function notificarCancelacion(reservaId, quien, motivo = null) {
  try {
    await supabase.functions.invoke("notificar-cancelacion", { body: { reservaId, quien, motivo } });
  } catch (err) {
    console.error("No se ha podido avisar de la cancelación:", err);
  }
}
