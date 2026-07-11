// Yacht Today · avisa por email al propietario cuando recibe una reserva nueva.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Yacht Today <onboarding@resend.dev>",
        to: data.user.email,
        subject: `Nueva reserva: ${anuncioNombre}`,
        html: `
          <h2>Tienes una reserva nueva</h2>
          <p><strong>${clienteNombre}</strong> ha reservado <strong>${anuncioNombre}</strong> (${puerto}).</p>
          <p><strong>Cuándo:</strong> ${fecha} · ${detalle}</p>
          <p><strong>Total:</strong> ${total} €</p>
          <p>Entra en Yacht Today para ver todos los detalles en tu panel.</p>
        `,
      }),
    });

    if (!resendRes.ok) {
      return new Response(JSON.stringify({ ok: false, error: await resendRes.text() }), { headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
