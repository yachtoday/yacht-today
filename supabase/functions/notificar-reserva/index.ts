// Yacht Today · avisa por email de una reserva nueva.
//
// A LOS DOS. Antes solo se avisaba al propietario: el cliente pagaba 69 € y no recibía
// nada de Yacht Today — solo el recibo de Stripe, que no dice ni dónde ni cuándo ni qué
// pasa con la fianza. Ahora recibe su confirmación con todo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, tabla, enviar, type Fila } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const DE = "Yacht Today <reservas@yachtoday.com>";
const WEB = "https://yachtoday.com";
const eur = (n: number) => `${Math.round(Number(n))} €`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { propietarioId, clienteId, anuncioNombre, clienteNombre, puerto, inicioISO, detalle, total, subtotal, servicio, fianza } = await req.json();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const fecha = new Date(inicioISO).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });

    const errores: string[] = [];

    // ── Al propietario: le han reservado y ya está pagado ──
    if (propietarioId) {
      const { data } = await admin.auth.admin.getUserById(propietarioId);
      const emailProp = data?.user?.email;
      if (emailProp) {
        const html = correo({
          titulo: "Tienes una reserva nueva",
          intro: `<strong>${clienteNombre}</strong> ha reservado <strong>${anuncioNombre}</strong> y ya ha pagado. No tienes que hacer nada para confirmarla.`,
          cuerpo: tabla([
            { k: "Qué", v: anuncioNombre },
            { k: "Dónde", v: puerto },
            { k: "Cuándo", v: fecha },
            { k: "Duración", v: detalle },
            { k: "Cliente", v: clienteNombre },
            { k: "Recibes", v: eur(subtotal ?? total), fuerte: true },
          ]),
          cta: { texto: "Ver la reserva", url: WEB },
          nota: "El dinero llega a tu cuenta de Stripe. Cuando termine el alquiler, entra en tu panel y dale el visto bueno para cerrarlo. Si te lo devuelven dañado, pulsa «Hubo daños» y le cobraremos la fianza.",
        });
        await enviar(emailProp, `Nueva reserva: ${anuncioNombre}`, html, DE).catch((e) => errores.push("propietario: " + e.message));
      } else errores.push("no se ha encontrado el email del propietario");
    }

    // ── Al cliente: su confirmación. Antes no recibía NADA. ──
    if (clienteId) {
      const { data } = await admin.auth.admin.getUserById(clienteId);
      const emailCliente = data?.user?.email;
      if (emailCliente) {
        const filas: Fila[] = [
          { k: "Qué", v: anuncioNombre },
          { k: "Dónde", v: puerto },
          { k: "Cuándo", v: fecha },
          { k: "Duración", v: detalle },
        ];
        if (subtotal != null) filas.push({ k: "Alquiler", v: eur(subtotal) });
        if (servicio != null) filas.push({ k: "Gastos de servicio", v: eur(servicio) });
        filas.push({ k: "Total pagado", v: eur(total), fuerte: true });

        const html = correo({
          titulo: "Tu reserva está confirmada",
          intro: `Ya está: <strong>${anuncioNombre}</strong> es tuyo el ${fecha}. El propietario ya tiene tu reserva, no tienes que hacer nada más.`,
          cuerpo: tabla(filas),
          ...(Number(fianza) > 0 ? {
            aviso: `<strong>Fianza de ${eur(fianza)}:</strong> no te la hemos cobrado ni bloqueado. Solo se te cobraría si el propietario reporta daños o pérdida al terminar el alquiler.`,
          } : {}),
          cta: { texto: "Ver mi reserva", url: WEB },
          nota: "Puedes cancelar sin recargo hasta 48 h antes del inicio. Los gastos de servicio no se devuelven en ninguna cancelación.",
        });
        await enviar(emailCliente, `Reserva confirmada: ${anuncioNombre}`, html, DE).catch((e) => errores.push("cliente: " + e.message));
      } else errores.push("no se ha encontrado el email del cliente");
    }

    if (errores.length) {
      return new Response(JSON.stringify({ ok: false, error: errores.join(" · ") }), { headers: CORS });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
