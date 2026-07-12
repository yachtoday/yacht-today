// Yacht Today · avisos por correo del proceso de revisión de anuncios.
//
// Antes, publicar un anuncio no avisaba a nadie: se quedaba "En revisión" y solo se veía
// si el admin entraba al panel y se acordaba de mirar. Un propietario podía tirarse días
// esperando sin saber si esto iba en serio.
//
//   tipo "nuevo"     → avisa al ADMIN de que hay algo que revisar.
//   tipo "aprobado"  → avisa al PROPIETARIO de que su anuncio ya se ve.
//   tipo "rechazado" → avisa al PROPIETARIO, con el motivo, y le dice cómo corregirlo.
//
// El email del propietario se busca con el service role (nunca viaja al navegador).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ADMIN_EMAIL = "yachtoday@gmail.com";
const WEB = "https://yachtoday.com";

const enviar = async (to: string, subject: string, html: string) => {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Yacht Today <anuncios@yachtoday.com>", to, subject, html }),
  });
  if (!res.ok) throw new Error(await res.text());
};

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
    const titulo = `${anuncio.nombre} · ${clase} en ${anuncio.puerto}`;

    if (tipo === "nuevo") {
      await enviar(
        ADMIN_EMAIL,
        `Nuevo anuncio pendiente de revisión: ${anuncio.nombre}`,
        `<h2>Hay un anuncio esperando tu revisión</h2>
         <p><strong>${titulo}</strong></p>
         ${anuncio.matricula ? `<p>Matrícula: <strong>${anuncio.matricula}</strong></p>` : ""}
         ${anuncio.poliza ? `<p>Seguro: <strong>${anuncio.poliza}</strong></p>` : ""}
         ${anuncio.caducidad_seguro ? `<p>Caducidad del seguro: <strong>${anuncio.caducidad_seguro}</strong></p>` : ""}
         ${anuncio.clase === "material" ? `<p>Fianza: <strong>${anuncio.fianza} €</strong></p>` : ""}
         <p>Entra en <a href="${WEB}">Mi panel</a> para ver la documentación y aprobarlo o rechazarlo.</p>`,
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
        `Tu anuncio ya está publicado: ${anuncio.nombre}`,
        `<h2>¡Tu anuncio ya se ve en Yacht Today!</h2>
         <p><strong>${titulo}</strong> ha pasado la revisión y cualquiera puede reservarlo desde ya.</p>
         <p>Te avisaremos por correo en cuanto recibas tu primera reserva.</p>
         <p><a href="${WEB}">Ver Yacht Today</a></p>`,
      );
    } else if (tipo === "rechazado") {
      await enviar(
        email,
        `Tu anuncio necesita un cambio: ${anuncio.nombre}`,
        `<h2>No hemos podido publicar tu anuncio todavía</h2>
         <p><strong>${titulo}</strong></p>
         <p><strong>Qué hay que corregir:</strong><br>${(anuncio.motivo_rechazo || "No se ha indicado el motivo.").replace(/\n/g, "<br>")}</p>
         <p>No hace falta que lo publiques otra vez: entra en <a href="${WEB}">Mis anuncios</a>, pulsa <strong>Editar</strong>, corrígelo y vuelve a enviarlo a revisión.</p>
         <p>Si crees que es un error, contesta a este correo o escríbenos a soporte@yachtoday.com.</p>`,
      );
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Tipo de aviso desconocido." }), { headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
