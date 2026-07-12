// Yacht Today · cobra la fianza al cliente cuando el propietario reporta daños.
//
// La fianza NO se retiene ni se bloquea en ningún momento: al pagar la reserva, Stripe
// guarda la tarjeta del cliente (con su consentimiento) y no se le cobra nada. Solo si el
// propietario, al finalizar, dice que ha habido daños o pérdida, se cobra aquí — y el
// dinero va **íntegro al propietario**: la plataforma no cobra comisión por un destrozo.
//
// Quién puede llamarla: solo el propietario de la reserva. Se comprueba con su JWT contra
// la fila real, nunca con lo que mande el navegador.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ok = (cuerpo: Record<string, unknown>) => new Response(JSON.stringify({ ok: true, ...cuerpo }), { headers: CORS });
const error = (mensaje: string) => new Response(JSON.stringify({ ok: false, error: mensaje }), { headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return error("No has iniciado sesión.");

    const { reservaId, motivo } = await req.json();
    if (!reservaId) return error("Falta la reserva.");
    if (!motivo || !String(motivo).trim()) return error("Explica qué daño ha habido: el cliente tiene derecho a saber por qué se le cobra.");

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: reserva, error: errReserva } = await admin.from("reservas").select("*").eq("id", reservaId).single();
    if (errReserva || !reserva) return error("No se ha encontrado la reserva.");

    // Solo el propietario de esa reserva, y solo la suya.
    if (reserva.propietario_id !== user.id) return error("Esta reserva no es tuya.");

    /* Solo se puede reclamar un daño cuando el alquiler ya ha terminado. La app esconde el
       botón hasta entonces, pero eso es el navegador: quien lo impide de verdad es esto.
       Sin este control, un propietario podría cobrarle la fianza a un cliente antes
       siquiera de entregarle el barco. */
    if (new Date(reserva.fin_iso).getTime() > Date.now()) {
      return error("El alquiler todavía no ha terminado: no puedes reclamar daños aún.");
    }

    if (!(Number(reserva.fianza) > 0)) return error("Esta reserva no tiene fianza.");
    if (reserva.fianza_estado === "cobrada") return error("La fianza de esta reserva ya se cobró.");
    if (reserva.fianza_estado === "liberada") return error("Ya diste el visto bueno a esta reserva: la fianza está liberada y no se puede cobrar.");
    if (!reserva.stripe_payment_method_id || !reserva.stripe_customer_id) {
      return error("Esta reserva es anterior al sistema de fianzas y no tiene tarjeta guardada. No se puede cobrar.");
    }

    const { data: propData } = await admin.auth.admin.getUserById(reserva.propietario_id);
    const stripeAccountId = propData?.user?.user_metadata?.stripe_account_id;
    if (!stripeAccountId) return error("No tienes los cobros activados con Stripe.");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    let intent;
    try {
      intent = await stripe.paymentIntents.create({
        amount: Math.round(Number(reserva.fianza) * 100),
        currency: "eur",
        customer: reserva.stripe_customer_id,
        payment_method: reserva.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Fianza · ${reserva.barco} · ${String(motivo).trim().slice(0, 180)}`,
        // Sin application_fee: la fianza va entera al propietario.
        transfer_data: { destination: stripeAccountId },
        metadata: { reservaId: String(reserva.id), motivo: String(motivo).trim().slice(0, 400) },
      });
    } catch (err) {
      // El caso típico: la tarjeta del cliente rechaza el cargo sin él delante (fondos,
      // caducada, o el banco pide autenticación). No se marca como cobrada.
      const msg = (err as { message?: string })?.message || String(err);
      return error("El banco del cliente ha rechazado el cobro de la fianza: " + msg);
    }

    const { error: errUpdate } = await admin.from("reservas")
      .update({ fianza_estado: "cobrada" })
      .eq("id", reserva.id);
    if (errUpdate) console.error("Fianza cobrada en Stripe pero no se ha podido marcar en la reserva:", errUpdate);

    return ok({ cobrado: Number(reserva.fianza), paymentIntentId: intent.id });
  } catch (err) {
    return error(String(err));
  }
});
