// Yacht Today · plantilla común de los correos.
//
// Antes cada función montaba su propio HTML a pelo (un <h2>, cuatro palabras y un enlace):
// llegaba un correo feísimo que no parecía de una empresa. Esto le da a todos la misma
// identidad que la web: titulares en serif, azul noche sobre arena, y la comisión y los
// importes siempre claros.
//
// Reglas de correo (no son manías, son lo que hace que se vea bien en Gmail y Outlook):
//   · Todo con <table>, no con flex ni grid: los clientes de correo no los entienden.
//   · Estilos EN LÍNEA, no en <style>: Gmail borra las hojas de estilo.
//   · Fuentes del sistema: Newsreader no existe en el correo, así que Georgia hace de serif.

const NOCHE = "#16323F";
const MAR = "#3E7CA6";
const ARENA = "#F5EFE4";
const LINEA = "#E3DAC8";
const SLATE = "#4A5862";
const MUTED = "#8A8A80";
const WEB = "https://yachtoday.com";

export type Fila = { k: string; v: string; fuerte?: boolean };

export function boton(texto: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px auto 0;">
    <tr><td align="center" bgcolor="${NOCHE}" style="border-radius:10px;">
      <a href="${url}" style="display:inline-block;padding:13px 30px;font-family:'Hanken Grotesk',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${ARENA};text-decoration:none;">${texto}</a>
    </td></tr>
  </table>`;
}

export function tabla(filas: Fila[]) {
  const tr = filas.map((f) => `
    <tr>
      <td style="padding:11px 0;border-bottom:1px solid ${LINEA};font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${SLATE};">${f.k}</td>
      <td align="right" style="padding:11px 0;border-bottom:1px solid ${LINEA};font-family:Helvetica,Arial,sans-serif;font-size:14px;color:${NOCHE};font-weight:${f.fuerte ? 700 : 500};">${f.v}</td>
    </tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">${tr}</table>`;
}

/* `nota` sale en gris pequeño al final del cuerpo: para las advertencias y los "por qué
   recibes esto". `aviso` pinta un recuadro coral, para lo que no puede pasar desapercibido
   (un rechazo, un cobro). */
export function correo({ titulo, intro, cuerpo, cta, nota, aviso }: {
  titulo: string;
  intro?: string;
  cuerpo?: string;
  cta?: { texto: string; url: string };
  nota?: string;
  aviso?: string;
}) {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;background:${ARENA};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${intro || titulo}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${ARENA};padding:32px 14px;">
    <tr><td align="center">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINEA};border-radius:16px;overflow:hidden;">

        <tr><td style="background:${NOCHE};padding:20px 32px;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:${ARENA};letter-spacing:.2px;">Yacht&nbsp;Today</span>
          <span style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${MAR};padding-left:10px;">Alquila el mar</span>
        </td></tr>

        <tr><td style="padding:34px 32px 32px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;font-weight:700;color:${NOCHE};">${titulo}</h1>
          ${intro ? `<p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${SLATE};">${intro}</p>` : ""}
          ${aviso ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr><td style="padding:14px 16px;background:#FBF0EF;border-left:3px solid #D6706A;border-radius:8px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.55;color:${NOCHE};">${aviso}</td></tr></table>` : ""}
          ${cuerpo || ""}
          ${cta ? boton(cta.texto, cta.url) : ""}
          ${nota ? `<p style="margin:24px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;line-height:1.55;color:${MUTED};">${nota}</p>` : ""}
        </td></tr>

      </table>

      <p style="margin:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};">
        <a href="${WEB}" style="color:${MAR};text-decoration:none;">yachtoday.com</a>
        &nbsp;·&nbsp; Alquiler náutico entre particulares en España
      </p>

    </td></tr>
  </table>
</body>
</html>`;
}

export async function enviar(to: string, subject: string, html: string, from = "Yacht Today <hola@yachtoday.com>") {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) throw new Error(await res.text());
}
