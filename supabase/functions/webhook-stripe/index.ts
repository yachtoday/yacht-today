// Yacht Today · recibe la confirmacion de pago de Stripe y crea la reserva real.
//
// IMPORTANTE al pegar esta funcion en el Dashboard de Supabase: en su configuracion
// hay que DESACTIVAR "Enforce JWT verification", porque quien la llama es Stripe,
// no un usuario con sesion.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, Deno.env.get("STRIPE_WEBHOOK_SECRET"));
  } catch (err) {
    return new Response("Firma no valida: " + err, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const m = session.metadata || {};
    const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent ? session.payment_intent.id : null);

    /* Guardamos la tarjeta del cliente para poder cobrarle la fianza SOLO si el propietario
       reporta danos al finalizar. Sin esto la fianza es una etiqueta vacia: no se retiene
       dinero en ningun momento (ver supabase/fianza-real.sql). */
    const customerId = typeof session.customer === "string" ? session.customer : (session.customer ? session.customer.id : null);
    let paymentMethodId = null;
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method ? pi.payment_method.id : null);
      } catch (err) {
        console.error("No se ha podido leer el metodo de pago de la reserva:", err);
      }
    }

    const { error } = await admin.from("reservas").insert({
      anuncio_id: Number(m.anuncioId),
      cliente_id: m.clienteId,
      propietario_id: m.propietarioId,
      barco: m.barco,
      puerto: m.puerto,
      zona: m.zona,
      cliente_nombre: m.clienteNombre,
      detalle: m.detalle,
      subtotal: Number(m.subtotal),
      servicio: Number(m.servicio),
      total: Number(m.total),
      fianza: Number(m.fianza),
      fianza_estado: m.fianzaEstado || null,
      licencia_verificada: m.licenciaVerificada === "true",
      inicio_iso: m.inicioISO,
      fin_iso: m.finISO,
      estado: "confirmada",
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: customerId,
      stripe_payment_method_id: paymentMethodId,
    });
    if (error) console.error("Error creando reserva desde el webhook de Stripe:", error);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    fetch(supabaseUrl + "/functions/v1/notificar-reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") },
      body: JSON.stringify({
        propietarioId: m.propietarioId,
        clienteId: m.clienteId, // sin esto el cliente no recibia NINGUN correo de su reserva
        anuncioNombre: m.barco,
        clienteNombre: m.clienteNombre,
        puerto: m.puerto,
        inicioISO: m.inicioISO,
        detalle: m.detalle,
        subtotal: Number(m.subtotal),
        servicio: Number(m.servicio),
        total: Number(m.total),
        fianza: Number(m.fianza),
      }),
    }).catch(console.error);
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
