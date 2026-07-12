// Yacht Today · ¿puede este propietario cobrar de verdad?
//
// Tener cuenta de Stripe NO significa poder cobrar. Mientras no termine la verificación de
// identidad, Stripe no habilita la capacidad "transfers" y cualquier reserva de sus
// anuncios revienta. El panel, sin embargo, le decía "✓ Cuenta de cobro conectada": le
// estaba diciendo que todo iba bien mientras sus anuncios eran imposibles de reservar.
//
// Devuelve el estado real, para poder avisarle.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ ok: false, error: "No has iniciado sesión." }), { headers: CORS });

    // Cada uno pregunta por lo suyo: se lee su propia cuenta del JWT, no de lo que mande el navegador.
    const cuentaId = user.user_metadata?.stripe_account_id;
    if (!cuentaId) {
      return new Response(JSON.stringify({ ok: true, conectado: false, listo: false }), { headers: CORS });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const cuenta = await stripe.accounts.retrieve(cuentaId);
    const listo = cuenta.capabilities?.transfers === "active" && cuenta.payouts_enabled === true;

    return new Response(JSON.stringify({
      ok: true,
      conectado: true,
      listo,
      // Qué le falta exactamente, para poder decírselo en concreto en vez de "algo falla".
      pendientes: cuenta.requirements?.currently_due || [],
      capacidades: cuenta.capabilities,
      cobrosActivos: cuenta.charges_enabled === true,
      pagosActivos: cuenta.payouts_enabled === true,
      /* Decisivo: si esto es true, estamos con dinero de verdad y la verificación de
         identidad de Stripe es real e ineludible. No se simula ni se falsea. */
      modoReal: cuenta.livemode === true,
    }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
