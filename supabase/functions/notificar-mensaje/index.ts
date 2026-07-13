// Yacht Today · avisa por correo a la OTRA parte de que tiene un mensaje nuevo en su reserva.
//
// Sin esto, el chat no sirve de nada: nadie vive dentro de la web esperando a que le escriban.
//
// Freno anti-spam: si esa misma persona ya escribió en este hilo hace menos de 15 minutos, no se
// manda otro correo. Una conversación de diez mensajes seguidos generaría diez correos y el
// destinatario acabaría marcándonos como spam — perdiendo también los avisos que sí importan
// (reservas, cancelaciones).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, enviar } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const WEB = "https://yachtoday.com";
const DE = "Yacht Today <mensajes@yachtoday.com>";
const MINUTOS_DE_SILENCIO = 15;

const escapar = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { mensajeId } = await req.json();
    if (!mensajeId) {
      return new Response(JSON.stringify({ ok: false, error: "Falta el mensaje." }), { headers: CORS });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: msg, error } = await admin
      .from("mensajes")
      .select("*, reservas(id, barco, cliente_id, propietario_id, cliente_nombre, inicio_iso)")
      .eq("id", mensajeId)
      .single();
    if (error || !msg || !msg.reservas) {
      return new Response(JSON.stringify({ ok: false, error: "No se ha encontrado el mensaje." }), { headers: CORS });
    }

    const r = msg.reservas;
    // Quien recibe es el otro: si escribe el cliente, avisamos al propietario, y al revés.
    const destinoId = msg.autor_id === r.cliente_id ? r.propietario_id : r.cliente_id;
    if (!destinoId) {
      return new Response(JSON.stringify({ ok: true, aviso: "la reserva no tiene la otra parte" }), { headers: CORS });
    }

    // Freno: ¿ya escribió esta misma persona en este hilo hace poco? Entonces ya se le avisó.
    const desde = new Date(Date.now() - MINUTOS_DE_SILENCIO * 60_000).toISOString();
    const { count } = await admin
      .from("mensajes")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", r.id)
      .eq("autor_id", msg.autor_id)
      .lt("id", msg.id)
      .gte("created_at", desde);
    if ((count || 0) > 0) {
      return new Response(JSON.stringify({ ok: true, omitido: "aviso reciente" }), { headers: CORS });
    }

    const { data: destinoData } = await admin.auth.admin.getUserById(destinoId);
    const email = destinoData?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "sin email del destinatario" }), { headers: CORS });
    }

    const { data: autorData } = await admin.auth.admin.getUserById(msg.autor_id);
    const autor = autorData?.user?.user_metadata?.nombre || "La otra parte";
    const esElCliente = msg.autor_id === r.cliente_id;

    // El mensaje se cita recortado: el correo es un aviso, no el sitio donde se conversa. Así
    // además la conversación entera vive en la web, que es donde queda constancia.
    const recorte = msg.texto.length > 220 ? msg.texto.slice(0, 220) + "…" : msg.texto;

    await enviar(
      email,
      `${autor} te ha escrito · ${r.barco}`,
      correo({
        titulo: "Tienes un mensaje nuevo",
        intro: `<strong>${escapar(autor)}</strong>, ${esElCliente ? "que ha reservado" : "el propietario de"} <strong>${escapar(r.barco)}</strong>, te ha escrito sobre vuestra reserva.`,
        cuerpo: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
          <tr><td style="padding:14px 16px;background:#F5EFE4;border-left:3px solid #3E7CA6;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.6;color:#16323F;">${escapar(recorte).replace(/\n/g, "<br>")}</td></tr>
        </table>`,
        cta: { texto: "Responder", url: WEB },
        nota: "Responde desde tu panel, en la reserva. Contestar por ahí deja constancia de lo hablado: si algún día hay una discusión por la fianza o por un desperfecto, es lo que os protege a los dos.",
      }),
      DE,
    );

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
