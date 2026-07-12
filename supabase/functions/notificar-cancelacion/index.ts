// Yacht Today · avisa a la otra parte de que una reserva se ha cancelado.
//
// Antes NO se avisaba a nadie. Si el propietario cancelaba, el cliente se enteraba entrando
// en la web — o no se enteraba y se plantaba en el puerto con la familia. Es de las cosas
// que más rabia dan de un servicio, y no costaba nada arreglarlo.
//
//   quien "cliente"     → ha cancelado el cliente; se avisa al PROPIETARIO.
//   quien "propietario" → ha cancelado el propietario; se avisa al CLIENTE, con el motivo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, tabla, enviar } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const DE = "Yacht Today <reservas@yachtoday.com>";
const WEB = "https://yachtoday.com";
const escapar = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { reservaId, quien, motivo } = await req.json();
    if (!reservaId || !quien) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos." }), { headers: CORS });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r, error } = await admin.from("reservas").select("*").eq("id", reservaId).single();
    if (error || !r) {
      return new Response(JSON.stringify({ ok: false, error: "No se ha encontrado la reserva." }), { headers: CORS });
    }

    const fecha = new Date(r.inicio_iso).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
    const datos = tabla([
      { k: "Qué", v: r.barco },
      { k: "Dónde", v: r.puerto },
      { k: "Cuándo era", v: fecha },
      { k: "Duración", v: r.detalle },
    ]);

    // A quién hay que avisar: siempre al que NO ha cancelado.
    const avisarA = quien === "cliente" ? r.propietario_id : r.cliente_id;
    if (!avisarA) return new Response(JSON.stringify({ ok: true, aviso: "no hay a quién avisar" }), { headers: CORS });

    const { data: u } = await admin.auth.admin.getUserById(avisarA);
    const email = u?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "no se ha encontrado el email" }), { headers: CORS });
    }

    if (quien === "cliente") {
      await enviar(
        email,
        `Reserva cancelada: ${r.barco}`,
        correo({
          titulo: "Te han cancelado una reserva",
          intro: `<strong>${escapar(r.cliente_nombre)}</strong> ha cancelado su reserva. Esas fechas te vuelven a quedar libres.`,
          cuerpo: datos,
          cta: { texto: "Ver mi panel", url: WEB },
          nota: "No has perdido nada: los gastos de servicio no se le devuelven al cliente, y si cancelaba con menos de 48 h también pierde parte del alquiler.",
        }),
        DE,
      );
    } else {
      await enviar(
        email,
        `Han cancelado tu reserva: ${r.barco}`,
        correo({
          titulo: "El propietario ha cancelado tu reserva",
          intro: "Lo sentimos de verdad. Te devolvemos el importe íntegro del alquiler: no has hecho nada mal y no vas a pagar por ello.",
          aviso: motivo ? `<strong>Motivo:</strong> ${escapar(motivo)}` : undefined,
          cuerpo: datos,
          cta: { texto: "Buscar otra opción", url: WEB },
          nota: "La devolución tarda unos días en aparecer en tu banco, según tu entidad. Si tenías fianza, tampoco se te cobra nada.",
        }),
        DE,
      );
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
