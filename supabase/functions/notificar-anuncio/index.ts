// Yacht Today · avisos por correo del proceso de revisión de anuncios.
//
//   tipo "nuevo"     → avisa al ADMIN de que hay algo que revisar.
//   tipo "aprobado"  → avisa al PROPIETARIO de que su anuncio ya se ve.
//   tipo "rechazado" → avisa al PROPIETARIO, con el motivo, y le dice cómo corregirlo.
//
// El email del propietario se busca con el service role (nunca viaja al navegador).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, tabla, enviar, type Fila } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ADMIN_EMAIL = "yachtoday@gmail.com";
const WEB = "https://yachtoday.com";
const DE = "Yacht Today <anuncios@yachtoday.com>";

const escapar = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { tipo, anuncioId } = await req.json();
    if (!tipo || !anuncioId) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos." }), { headers: CORS });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: anuncio, error } = await admin.from("anuncios").select("*").eq("id", anuncioId).single();
    if (error || !anuncio) {
      return new Response(JSON.stringify({ ok: false, error: "No se ha encontrado el anuncio." }), { headers: CORS });
    }

    const clase = anuncio.clase === "barco" ? "Barco" : anuncio.clase === "experiencia" ? "Experiencia" : "Material";

    if (tipo === "nuevo") {
      const filas: Fila[] = [
        { k: "Qué", v: `${escapar(anuncio.nombre)} · ${clase}` },
        { k: "Dónde", v: escapar(anuncio.puerto) },
      ];
      if (anuncio.matricula) filas.push({ k: "Matrícula", v: escapar(anuncio.matricula) });
      if (anuncio.poliza) filas.push({ k: "Seguro", v: escapar(anuncio.poliza) });
      if (anuncio.caducidad_seguro) filas.push({ k: "Caducidad del seguro", v: new Date(anuncio.caducidad_seguro).toLocaleDateString("es-ES") });
      if (anuncio.clase === "material") filas.push({ k: "Fianza", v: `${Math.round(Number(anuncio.fianza))} €`, fuerte: true });
      filas.push({ k: "Documentos adjuntos", v: String((anuncio.documentos || []).length) });

      await enviar(
        ADMIN_EMAIL,
        `Anuncio pendiente de revisión: ${anuncio.nombre}`,
        correo({
          titulo: "Tienes un anuncio esperando",
          intro: "Alguien ha publicado y no se verá en la web hasta que lo revises.",
          cuerpo: tabla(filas),
          cta: { texto: "Revisarlo ahora", url: WEB },
          nota: "Los documentos se abren desde tu panel, no se envían por correo.",
        }),
        DE,
      );
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    // Los avisos al propietario necesitan su email.
    if (!anuncio.propietario_id) {
      return new Response(JSON.stringify({ ok: true, aviso: "anuncio sin propietario" }), { headers: CORS });
    }
    const { data: propData } = await admin.auth.admin.getUserById(anuncio.propietario_id);
    const email = propData?.user?.email;
    if (!email) {
      return new Response(JSON.stringify({ ok: false, error: "no se ha encontrado el email del propietario" }), { headers: CORS });
    }

    if (tipo === "aprobado") {
      await enviar(
        email,
        `Ya está publicado: ${anuncio.nombre}`,
        correo({
          titulo: "Tu anuncio ya se ve en Yacht Today",
          intro: `<strong>${escapar(anuncio.nombre)}</strong> ha pasado la revisión. Desde ahora cualquiera puede reservarlo.`,
          cuerpo: tabla([
            { k: "Qué", v: `${escapar(anuncio.nombre)} · ${clase}` },
            { k: "Dónde", v: escapar(anuncio.puerto) },
          ]),
          cta: { texto: "Ver tu anuncio", url: WEB },
          nota: "Te avisaremos por correo en cuanto recibas tu primera reserva. Recuerda que cobras tu tarifa íntegra: la comisión la paga quien alquila.",
        }),
        DE,
      );
    } else if (tipo === "rechazado") {
      await enviar(
        email,
        `Tu anuncio necesita un cambio: ${anuncio.nombre}`,
        correo({
          titulo: "Todavía no hemos podido publicarlo",
          intro: `Hemos revisado <strong>${escapar(anuncio.nombre)}</strong> y hay algo que corregir antes de que se vea en la web.`,
          aviso: escapar(anuncio.motivo_rechazo || "No se ha indicado el motivo.").replace(/\n/g, "<br>"),
          cta: { texto: "Corregirlo", url: WEB },
          nota: "No hace falta que lo publiques otra vez: entra en «Mis anuncios», pulsa «Editar», corrígelo y volverá solo a la cola de revisión. Si crees que es un error, escríbenos a soporte@yachtoday.com.",
        }),
        DE,
      );
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Tipo de aviso desconocido." }), { headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
