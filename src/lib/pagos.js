import { supabase } from "./supabaseClient";

// Pide una sesión de pago de Stripe Checkout para una reserva y devuelve la URL
// a la que hay que redirigir al cliente. El precio se calcula en el servidor.
export async function iniciarPago(payload) {
  const { data, error } = await supabase.functions.invoke("crear-pago", {
    body: { ...payload, origin: window.location.origin },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "No se ha podido iniciar el pago.");
  return data.url;
}

// Crea (o retoma) la cuenta Stripe Express del propietario y devuelve la URL
// de alta a la que hay que redirigirlo para que complete sus datos de cobro.
export async function conectarCobros() {
  const { data, error } = await supabase.functions.invoke("crear-cuenta-stripe", {
    body: { origin: window.location.origin },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error || "No se ha podido conectar con Stripe.");
  return data.url;
}
