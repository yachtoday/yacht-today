// Yacht Today · crea una sesión de pago de Stripe Checkout para una reserva.
// El precio se recalcula siempre aquí, en el servidor, a partir de los datos
// reales del anuncio — nunca nos fiamos del importe que mande el navegador.
// Reparte el cobro: retiene la comisión del 15% y transfiere el resto al
// propietario a través de su cuenta Stripe Connect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const COMISION = 0.15;
const PATRON_HORA = 30;
const PATRON_DIA = 180;
const FIANZA_PCT = 0.2;

// Mantener sincronizado con las mismas constantes en src/App.jsx
const AVISO_MIN_HORAS = 3;
const AVISO_MIN_HORAS_EXP = 24;
const NOCHE_DESDE_HORA = 22;
const NOCHE_HASTA_HORA = 8;
// Deno corre en UTC; aproximación simple sin librería de timezone (mismo
// nivel de sencillez que el resto del código). Cambiar a 1 en horario de
// invierno si se quiere afinar.
const OFFSET_ESPANA_HORAS = 2;

function estadoFidelidad(count) {
  const ciclo = count % 5;
  const descuento = ciclo < 2 ? 0 : ciclo < 4 ? 0.5 : 1;
  return { descuento };
}

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
    const { anuncioId, modo, horas, dias, personas, conPatron, inicioISO, finISO, detalle, origin } = await req.json();

    const { data: anuncio, error: anuncioErr } = await admin.from("anuncios").select("*").eq("id", anuncioId).single();
    if (anuncioErr || !anuncio) {
      return new Response(JSON.stringify({ ok: false, error: "No se ha encontrado el anuncio." }), { headers: CORS });
    }
    if (!anuncio.propietario_id) {
      return new Response(JSON.stringify({ ok: false, error: "Este anuncio no tiene propietario asignado." }), { headers: CORS });
    }

    const { data: propData } = await admin.auth.admin.getUserById(anuncio.propietario_id);
    const stripeAccountId = propData?.user?.user_metadata?.stripe_account_id;
    if (!stripeAccountId) {
      return new Response(JSON.stringify({ ok: false, error: "El propietario todavía no ha activado los cobros. Escríbele para que lo haga desde su panel." }), { headers: CORS });
    }

    const exp = anuncio.clase === "experiencia";
    const mat = anuncio.clase === "material";

    const ahoraMadrid = new Date(Date.now() + OFFSET_ESPANA_HORAS * 3600000);
    const horaMadrid = ahoraMadrid.getUTCHours();
    const deNoche = horaMadrid >= NOCHE_DESDE_HORA || horaMadrid < NOCHE_HASTA_HORA;
    const avisoMinHoras = (typeof anuncio.aviso_minimo_horas === "number" && anuncio.aviso_minimo_horas > 0)
      ? anuncio.aviso_minimo_horas : (exp ? AVISO_MIN_HORAS_EXP : AVISO_MIN_HORAS);

    const inicio = new Date(inicioISO);
    if (!inicioISO || isNaN(inicio.getTime())) {
      return new Response(JSON.stringify({ ok: false, error: "La fecha de inicio de la reserva no es válida." }), { headers: CORS });
    }
    if (inicio.getTime() - Date.now() < avisoMinHoras * 3600000) {
      return new Response(JSON.stringify({ ok: false, error: `Esta reserva requiere al menos ${avisoMinHoras} horas de antelación.` }), { headers: CORS });
    }
    const pasadoMananaISO = new Date(ahoraMadrid.getTime() + 2 * 86400000).toISOString().slice(0, 10);
    if (deNoche && inicioISO.slice(0, 10) < pasadoMananaISO) {
      return new Response(JSON.stringify({ ok: false, error: "Entre las 22:00 y las 8:00 solo se puede reservar a partir de pasado mañana." }), { headers: CORS });
    }

    const patronActivo = !exp && !mat && (anuncio.patron === "incluido" || (anuncio.patron === "opcional" && !!conPatron));
    const base = exp ? anuncio.persona * personas : (modo === "horas" ? anuncio.hora * horas : anuncio.dia * dias);
    const patronCoste = patronActivo ? (modo === "horas" ? PATRON_HORA * horas : PATRON_DIA * dias) : 0;
    const subtotal = Math.round(base + patronCoste);

    const { count } = await admin.from("reservas").select("id", { count: "exact", head: true }).eq("cliente_id", user.id).eq("estado", "finalizada");
    const { descuento } = estadoFidelidad(count || 0);
    const servicioBase = Math.round(subtotal * COMISION);
    const ahorro = Math.round(servicioBase * descuento);
    const servicio = servicioBase - ahorro;
    const total = subtotal + servicio;
    const requiereFianza = !exp && !patronActivo;
    /* El material (SUP y kayak) lleva la fianza fija que puso su dueño: el 20 % de un
       kayak a 15 €/día serían 3 €, que no cubren reponerlo si lo pierden. Los barcos
       siguen con el porcentaje sobre el alquiler. */
    const fianza = !requiereFianza ? 0
      : mat && Number(anuncio.fianza) > 0 ? Math.round(Number(anuncio.fianza))
        : Math.round(subtotal * FIANZA_PCT);

    if (!(total > 0)) {
      return new Response(JSON.stringify({ ok: false, error: "El importe de la reserva no es válido." }), { headers: CORS });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: Math.round(total * 100),
          product_data: { name: `${anuncio.nombre} · ${detalle}` },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: Math.round(servicio * 100),
        transfer_data: { destination: stripeAccountId },
      },
      metadata: {
        anuncioId: String(anuncioId),
        clienteId: user.id,
        propietarioId: anuncio.propietario_id,
        clienteNombre: user.user_metadata?.nombre || user.email,
        barco: anuncio.nombre,
        puerto: anuncio.puerto,
        zona: anuncio.zona,
        detalle,
        subtotal: String(subtotal),
        servicio: String(servicio),
        total: String(total),
        fianza: String(fianza),
        fianzaEstado: requiereFianza ? "retenida" : "",
        licenciaVerificada: String(requiereFianza),
        inicioISO,
        finISO,
      },
      success_url: `${origin}/?pago=exito`,
      cancel_url: `${origin}/?pago=cancelado`,
    });

    return new Response(JSON.stringify({ ok: true, url: session.url }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { headers: CORS });
  }
});
