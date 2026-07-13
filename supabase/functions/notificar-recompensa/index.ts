// Yacht Today · avisos por correo de "Cuida tu Barco".
//
//   tipo "solicitada" → avisa al ADMIN de que tiene un premio que servir (qué, a quién, a dónde),
//                       y le manda al PROPIETARIO el acuse de recibo.
//   tipo "enviada"    → avisa al PROPIETARIO de que su kit ya va de camino.
//
// Sin este correo el programa no existiría de verdad: la recompensa se quedaría en una fila de
// la base de datos que nadie mira, y el propietario esperando un kit que no sale nunca.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { correo, tabla, enviar, type Fila } from "../_shared/email.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const ADMIN_EMAIL = "yachtoday@gmail.com";
const WEB = "https://yachtoday.com";
const DE = "Yacht Today <recompensas@yachtoday.com>";

const FILTRO = { aire: "Filtro de aire", aceite: "Filtro de aceite", gasoil: "Filtro de gasoil" };

const escapar = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const { tipo, recompensaId } = await req.json();
    if (!tipo || !recompensaId) {
      return new Response(JSON.stringify({ ok: false, error: "Faltan datos." }), { headers: CORS });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: r, error } = await admin
      .from("recompensas")
      .select("*, anuncios(nombre, puerto)")
      .eq("id", recompensaId)
      .single();
    if (error || !r) {
      return new Response(JSON.stringify({ ok: false, error: "No se ha encontrado la recompensa." }), { headers: CORS });
    }

    const anuncio = r.anuncios?.nombre || "tu anuncio";
    const { data: propData } = await admin.auth.admin.getUserById(r.propietario_id);
    const email = propData?.user?.email;
    const nombre = propData?.user?.user_metadata?.nombre || email || "el propietario";
    const telefono = r.telefono || propData?.user?.user_metadata?.telefono || "—";

    // El premio, en una línea: es lo primero que Eric necesita leer.
    const premio = r.nivel === 1
      ? `${FILTRO[r.filtro as keyof typeof FILTRO] || "Filtro"} + garrafa de aceite de 5 L`
      : "15% de descuento en la limpieza del casco o interior";

    if (tipo === "solicitada") {
      const filas: Fila[] = [
        { k: "Premio", v: escapar(premio), fuerte: true },
        { k: "Nivel", v: r.nivel === 1 ? "1 · 5 alquileres" : "2 · 15 alquileres" },
        { k: "Anuncio", v: escapar(anuncio) },
        { k: "Propietario", v: escapar(nombre) },
        { k: "Teléfono", v: escapar(telefono) },
      ];
      if (r.nivel === 1) {
        filas.push({ k: "Motor", v: escapar(r.motor || "no indicado") });
        filas.push({ k: "Enviar a", v: escapar(r.direccion || "no indicada") });
      } else {
        filas.push({ k: "Puerto", v: escapar(r.anuncios?.puerto || "—") });
      }

      await enviar(
        ADMIN_EMAIL,
        `Recompensa que servir: ${premio} · ${anuncio}`,
        correo({
          titulo: "Alguien ha ganado su recompensa",
          intro: r.nivel === 1
            ? "Un propietario ha llegado a 5 alquileres y ha reclamado su kit. Hay que prepararlo y enviarlo."
            : "Un propietario ha llegado a 15 alquileres: tiene un 15% de descuento en la limpieza con Spen Mechanics.",
          cuerpo: tabla(filas),
          cta: { texto: "Verlo en tu panel", url: WEB },
          nota: 'Cuando lo hayas enviado (o aplicado), márcalo en "Recompensas por servir" de tu panel: el propietario recibe el aviso automáticamente.',
        }),
        DE,
      );

      // Acuse de recibo: que no se quede pensando si le ha llegado o se ha perdido.
      if (email) {
        await enviar(
          email,
          `Hemos recibido tu recompensa: ${anuncio}`,
          correo({
            titulo: "Premio reclamado",
            intro: `Enhorabuena: <strong>${escapar(anuncio)}</strong> ha llegado a su hito de "Cuida tu Barco" y ya hemos apuntado tu recompensa.`,
            cuerpo: tabla([
              { k: "Tu premio", v: escapar(premio), fuerte: true },
              ...(r.nivel === 1
                ? [{ k: "Lo enviamos a", v: escapar(r.direccion || "—") }]
                : [{ k: "Cómo se usa", v: "Avisa a Spen Mechanics al pedir cita" }]),
            ]),
            cta: { texto: "Ver tus anuncios", url: WEB },
            nota: r.nivel === 1
              ? "Lo prepara Spen Mechanics S.L., nuestro taller, y te escribimos otra vez en cuanto salga. Si el modelo de motor que nos has dado no cuadra con el filtro, te llamamos antes de enviarlo."
              : `El descuento lo aplicamos al facturar. Spen Mechanics se desplaza a tu puerto dentro de la Comunidad Valenciana.`,
          }),
          DE,
        );
      }

      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    if (tipo === "enviada") {
      if (!email) {
        return new Response(JSON.stringify({ ok: false, error: "no se ha encontrado el email del propietario" }), { headers: CORS });
      }
      const filas: Fila[] = [{ k: "Premio", v: escapar(premio), fuerte: true }, { k: "Anuncio", v: escapar(anuncio) }];
      if (r.nota_admin) filas.push({ k: "Seguimiento", v: escapar(r.nota_admin) });

      await enviar(
        email,
        r.nivel === 1 ? `Tu kit va de camino: ${anuncio}` : `Tu descuento ya está activo: ${anuncio}`,
        correo({
          titulo: r.nivel === 1 ? "Tu kit ya está en camino" : "Tu descuento ya está activo",
          intro: r.nivel === 1
            ? "Lo hemos enviado a la dirección que nos diste. Gracias por alquilar con nosotros: esto sale de la comisión que ha generado tu propio barco."
            : "Ya puedes usarlo: avisa a Spen Mechanics al pedir cita y te lo descontamos de la factura.",
          cuerpo: tabla(filas),
          cta: { texto: "Ir a Yacht Today", url: WEB },
          nota: "¿Algún problema con tu recompensa? Escríbenos a soporte@yachtoday.com.",
        }),
        DE,
      );
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    return new Response(JSON.stringify({ ok: false, error: "Tipo de aviso desconocido." }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
