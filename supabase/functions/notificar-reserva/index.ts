// Yacht Today · avisa por email al propietario cuando recibe una reserva nueva.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, tabla, enviar } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const eur = (n: number) => `${Math.round(Number(n))} €`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { propietarioId, anuncioNombre, clienteNombre, puerto, inicioISO, detalle, total } = await req.json();

    if (!propietarioId) {
      return new Response(JSON.stringify({ ok: true, aviso: "anuncio sin propietario, no hay a quién avisar" }), { headers: CORS });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.auth.admin.getUserById(propietarioId);
    if (error || !data?.user?.email) {
      return new Response(JSON.stringify({ ok: false, error: "no se ha encontrado el email del propietario" }), { headers: CORS });
    }

    const fecha = new Date(inicioISO).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });

    const html = correo({
      titulo: "Tienes una reserva nueva",
      intro: `<strong>${clienteNombre}</strong> ha reservado <strong>${anuncioNombre}</strong> y ya ha pagado. No tienes que hacer nada para confirmarla.`,
      cuerpo: tabla([
        { k: "Qué", v: anuncioNombre },
        { k: "Dónde", v: puerto },
        { k: "Cuándo", v: fecha },
        { k: "Duración", v: detalle },
        { k: "Cliente", v: clienteNombre },
        { k: "Total pagado", v: eur(total), fuerte: true },
      ]),
      cta: { texto: "Ver la reserva", url: "https://yachtoday.com" },
      nota: "El dinero llega a tu cuenta de Stripe. Cuando termine el alquiler, entra en tu panel y dale el visto bueno para cerrarlo.",
    });

    await enviar(data.user.email, `Nueva reserva: ${anuncioNombre}`, html, "Yacht Today <reservas@yachtoday.com>");
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
