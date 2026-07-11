// Yacht Today · crea (o retoma) la cuenta Stripe Express de un propietario
// y devuelve el enlace de alta de Stripe para que complete sus datos de cobro.
//
// IMPORTANTE al pegar esta función en el Dashboard de Supabase: en su configuración,
// desactiva "Enforce JWT verification" solo si vas a llamarla sin sesión — en este
// caso SÍ requiere sesión (la deja activada, es el valor por defecto).
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
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: "No has iniciado sesión." }), { headers: CORS });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const { origin } = await req.json();

    let accountId = user.user_metadata?.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        business_type: "individual",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...user.user_metadata, stripe_account_id: accountId },
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/?stripe=reintenta`,
      return_url: `${origin}/?stripe=vuelta`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ ok: true, url: link.url }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
