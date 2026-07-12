import React, { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import { listarAnunciosPublicados, listarMisAnuncios, crearAnuncio, subirFotos, subirDocumentos, urlFirmadaDocumento, eliminarAnuncio, listarAnunciosEnRevision, cambiarEstadoAnuncio } from "./lib/anuncios";
import { listarMisReservas, listarReservasRecibidas, actualizarReserva } from "./lib/reservas";
import { iniciarPago, conectarCobros } from "./lib/pagos";
import {
  Anchor, Search, MapPin, Users, Star, Ship, Waves, ChevronRight, Check,
  Plus, ArrowLeft, Ruler, Gauge, ShieldCheck, Menu, X, Sailboat, Info,
  User, Mail, Phone, Lock, BadgeCheck, LogOut, Heart, Share2, Minus,
  CalendarCheck, ClipboardList, Sparkles, Fish, Wind, Gift, Trophy,
  Clock, Award, Waypoints, Handshake, Zap, CloudRain,
  ChevronDown, MessageCircle, HelpCircle, RotateCcw, Trash2, Wrench, FileText,
  Wallet, CreditCard,
} from "lucide-react";
import fotoHero from "./assets/fotos/hero-845.jpg";
import fotoMarina from "./assets/fotos/marina-5075093.jpg";
import fotoVentajas from "./assets/fotos/ventajas-18314162.jpg";
import fotoFooter from "./assets/fotos/footer-7341705.jpg";
import fotoYates from "./assets/fotos/yates-6752179.jpg";
import fotoVeleros from "./assets/fotos/veleros-12682547.jpg";
import fotoLanchas from "./assets/fotos/lanchas-3274984.jpg";
import fotoPesca from "./assets/fotos/pesca-349727.jpg";
import fotoExperiencias from "./assets/fotos/experiencias-30411892.jpg";
import fotoSupKayak from "./assets/fotos/supkayak-12316141.jpg";
import fotoSubmarinismo from "./assets/fotos/submarinismo-8824659.jpg";
import fotoPaddleSurf from "./assets/fotos/paddlesurf-7538170.jpg";
import fotoKayak from "./assets/fotos/kayak-2239312.jpg";
import fotoPuestaDeSol from "./assets/fotos/puestadesol-30805264.jpg";
import fotoNeumatica from "./assets/fotos/neumatica-1732279.jpg";
import fotoMotoDeAgua from "./assets/fotos/motodeagua-18636559.jpg";
import fotoTradicional from "./assets/fotos/tradicional-17314693.jpg";
import fotoCatamaran from "./assets/fotos/catamaran-4600762.jpg";

/* ── Modelo de negocio ───────────────────────────────────────────── */
const COMISION = 0.15;
const PATRON_HORA = 30;
const PATRON_DIA = 180;
const FIANZA_PCT = 0.2;

// Antelación mínima de reservas. Mantener sincronizado con las mismas
// constantes en supabase/functions/crear-pago/index.ts.
const AVISO_MIN_HORAS = 3;
const AVISO_MIN_HORAS_EXP = 24;
const NOCHE_DESDE_HORA = 22;
const NOCHE_HASTA_HORA = 8;

/* Fotos de fondo (banco libre de derechos Pexels, alojadas localmente en
   src/assets/fotos. Provisionales hasta tener fotos reales de las
   embarcaciones). */
const HERO_FOTO = fotoHero;
const MARINA_FOTO = fotoMarina;
const VENTAJAS_FOTO = fotoVentajas;
const FOOTER_FOTO = fotoFooter;
const CATEGORIA_FOTOS = {
  "Yates": fotoYates,
  "Veleros": fotoVeleros,
  "Lanchas": fotoLanchas,
  "Pesca": fotoPesca,
  "Experiencias": fotoExperiencias,
  "SUP y kayak": fotoSupKayak,
};
const ACTIVIDAD_FOTOS = {
  "Pesca": fotoPesca,
  "Submarinismo": fotoSubmarinismo,
  "Paddle surf": fotoPaddleSurf,
  "Kayak": fotoKayak,
  "Puesta de sol": fotoPuestaDeSol,
};
const TIPO_FOTOS = {
  "Motora": fotoLanchas,
  "Velero": fotoVeleros,
  "Neumática": fotoNeumatica,
  "Yate": fotoYates,
  "Moto de agua": fotoMotoDeAgua,
  "Tradicional": fotoTradicional,
  "Catamarán": fotoCatamaran,
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const HORA_INICIO = "10:00";
const dtISO = (fecha, hora = HORA_INICIO) => `${fecha}T${hora}:00`;
const sumarHoras = (iso, horas) => new Date(new Date(iso).getTime() + horas * 3600000).toISOString();
const finDeDiaISO = (fecha) => `${fecha}T23:59:59`;
const parseDuracionHoras = (txt) => { const n = parseFloat(txt); return isFinite(n) && n > 0 ? n : 2; };
const addDiasISO = (fechaISO, n) => new Date(new Date(fechaISO).getTime() + n * 86400000).toISOString().slice(0, 10);
const esDeNoche = (ahora) => { const h = ahora.getHours(); return h >= NOCHE_DESDE_HORA || h < NOCHE_HASTA_HORA; };
const avisoMinHorasDe = (item) => {
  const base = item.clase === "experiencia" ? AVISO_MIN_HORAS_EXP : AVISO_MIN_HORAS;
  return (typeof item.aviso_minimo_horas === "number" && item.aviso_minimo_horas > 0) ? item.aviso_minimo_horas : base;
};

/* ── AEMET: comprobación real de mal tiempo por zona/fecha ──────────
   Municipio representativo de cada zona (códigos INE verificados contra
   el maestro de municipios de AEMET). Se usa la predicción diaria: se
   considera "mal tiempo" viento ≥ 40 km/h, prob. de lluvia ≥ 70% o
   tormenta prevista ese día. */
const ZONA_MUNICIPIO_AEMET = {
  "Baleares": "07040", "Costa Brava": "17079", "C. Valenciana": "46250",
  "Costa Blanca": "03014", "Costa del Sol": "29067", "Rías Baixas": "36057", "Canarias": "35016",
};
async function verificarMalTiempoAEMET(zona, fechaISO) {
  const municipio = ZONA_MUNICIPIO_AEMET[zona];
  const apiKey = import.meta.env.VITE_AEMET_API_KEY;
  if (!municipio || !apiKey) return { ok: false, error: "sin_configurar" };
  try {
    const meta = await fetch(`https://opendata.aemet.es/opendata/api/prediccion/especifica/municipio/diaria/${municipio}`, { headers: { api_key: apiKey } }).then((r) => r.json());
    if (!meta?.datos) return { ok: false, error: "sin_datos" };
    const datos = await fetch(meta.datos).then((r) => r.json());
    const dias = datos?.[0]?.prediccion?.dia || [];
    const fechaObjetivo = fechaISO.slice(0, 10);
    const dia = dias.find((d) => d.fecha?.slice(0, 10) === fechaObjetivo);
    if (!dia) return { ok: false, error: "sin_prediccion" };
    const vientoMax = Math.max(0, ...(dia.viento || []).map((v) => v.velocidad || 0));
    const lluviaMax = Math.max(0, ...(dia.probPrecipitacion || []).map((p) => p.value || 0));
    const tormenta = (dia.estadoCielo || []).some((e) => /tormenta/i.test(e.descripcion || ""));
    const malTiempo = vientoMax >= 40 || lluviaMax >= 70 || tormenta;
    return { ok: true, malTiempo, detalle: `viento ${vientoMax} km/h · prob. lluvia ${lluviaMax}%${tormenta ? " · tormenta prevista" : ""}` };
  } catch {
    return { ok: false, error: "fallo_red" };
  }
}

const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const iniciales = (n = "") => n.trim().split(/\s+/).slice(0, 2).map((w) => (w[0] || "").toUpperCase()).join("") || "U";
const saludo = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches"; };
const ROL_LABEL = { cliente: "Cliente", propietario: "Propietario", ambas: "Cliente y propietario" };
const ADMIN_EMAIL = "yachtoday@gmail.com";
const usuarioDeSesion = (session) => {
  const u = session?.user;
  if (!u) return null;
  const meta = u.user_metadata || {};
  return { id: u.id, nombre: meta.nombre || u.email.split("@")[0], email: u.email, telefono: meta.telefono || "", rol: meta.rol || "ambas", stripeAccountId: meta.stripe_account_id || null };
};

/* helpers de presentación por clase (barco | experiencia | material) */
const precioBase = (x) => (x.clase === "experiencia" ? x.persona : x.dia);
const unidad = (x) => (x.clase === "experiencia" ? "persona" : "día");
const etiqueta = (x) => (x.clase === "experiencia" ? x.actividad : x.tipo);
const lugarCorto = (x) => x.puerto.split(",").pop().trim();
function visualDe(x) {
  const t = x.tipo || x.actividad || "";
  if (/paddle/i.test(t)) return "sup";
  if (/kayak/i.test(t)) return "kayak";
  if (x.clase === "barco" && (x.tipo === "Velero" || x.tipo === "Catamarán")) return "vela";
  if (x.tipo === "Moto de agua") return "moto";
  return "barco";
}

/* ── Logo ────────────────────────────────────────────────────────── */
const LogoYachtToday = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="#0F2732" />
    <path d="M9 36 Q20 34.3 31 36" stroke="#7FB2CE" strokeWidth="1.3" fill="none" strokeLinecap="round" opacity=".5" />
    <path d="M6 33 Q20 30 34 33" stroke="#7FB2CE" strokeWidth="1.7" fill="none" strokeLinecap="round" opacity=".9" />
    <path d="M7 26 Q20 22 33 26 Q27 30 20 30 Q13 30 7 26 Z" fill="#F5EFE4" />
    <rect x="16" y="17.5" width="8" height="6" rx="1.6" fill="#7FB2CE" />
    <line x1="20" y1="10" x2="20" y2="17.5" stroke="#F5EFE4" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M20.6 10 L26 12.2 L20.6 14.4 Z" fill="#E6C15F" />
  </svg>
);

/* ── Datos ───────────────────────────────────────────────────────── */
/* Los anuncios (barcos, experiencias, material) ya no están fijos aquí:
   viven en la tabla `anuncios` de Supabase — ver src/lib/anuncios.js. */

const TIPOS = ["Motora", "Velero", "Neumática", "Yate", "Moto de agua", "Tradicional", "Catamarán"];
const ACTIVIDADES = ["Pesca", "Submarinismo", "Paddle surf", "Kayak", "Puesta de sol"];
const MATERIALES = ["Paddle surf", "Kayak"];
const ZONAS = ["Todas", "Baleares", "Costa Brava", "C. Valenciana", "Costa Blanca", "Costa del Sol", "Rías Baixas", "Canarias"];

// Equipamiento y servicios: lista de opciones típicas que el propietario puede
// marcar al publicar, además de añadir las suyas propias por texto libre.
const EQUIPAMIENTO_TIPICO = {
  barco: ["Chalecos salvavidas", "Nevera a bordo", "Equipo de fondeo", "Ducha de popa", "Combustible incluido", "Equipo de snorkel", "Toallas", "Altavoz Bluetooth"],
  experiencia: ["Anfitrión / monitor", "Equipo necesario", "Seguro a bordo", "Briefing de seguridad", "Avituallamiento", "Fotos del día", "Transporte desde el puerto"],
  material: ["Remo / pala", "Chaleco salvavidas", "Hinchador (si aplica)", "Entrega en playa", "Bidón estanco", "Correa de sujeción (leash)", "Funda de transporte"],
};
const CANCELACION_NOTA = "Cancela sin recargo hasta 48 h antes";
const ROLES = [{ v: "cliente", t: "Alquilar o vivir experiencias" }, { v: "propietario", t: "Publicar barco / experiencia / material" }, { v: "ambas", t: "Las dos cosas" }];
const CLASES = [{ v: "todo", t: "Todo" }, { v: "barco", t: "Barcos" }, { v: "experiencia", t: "Experiencias" }, { v: "material", t: "SUP y kayak" }];
const CATEGORIAS = [
  { t: "Yates", d: "Lujo con patrón", clase: "barco", key: "Yate", icon: Ship },
  { t: "Veleros", d: "A vela, sin prisa", clase: "barco", key: "Velero", icon: Sailboat },
  { t: "Lanchas", d: "Un día de calas", clase: "barco", key: "Motora", icon: Waves },
  { t: "Pesca", d: "Sal a pescar con un patrón", clase: "experiencia", key: "Pesca", icon: Fish },
  { t: "Experiencias", d: "Buceo, atardeceres y más", clase: "experiencia", key: null, icon: Sparkles },
  { t: "SUP y kayak", d: "Alquila tabla o kayak", clase: "material", key: null, icon: Wind },
];

/* ── Siluetas ────────────────────────────────────────────────────── */
function Silueta({ v }) {
  const c = "rgba(245,239,228,.95)", b = "rgba(127,178,206,.85)";
  if (v === "vela")
    return (<svg viewBox="0 0 120 80" width="116" height="76" aria-hidden="true"><path d="M60 8 L60 52 L30 52 Z" fill={c} /><path d="M64 14 L64 52 L92 52 Z" fill={b} /><path d="M18 54 Q60 70 102 54 L96 62 Q60 74 24 62 Z" fill={c} /></svg>);
  if (v === "moto")
    return (<svg viewBox="0 0 120 80" width="116" height="76" aria-hidden="true"><path d="M22 50 Q40 38 78 40 L98 42 Q104 46 96 52 L40 56 Q26 56 22 50 Z" fill={c} /><path d="M64 30 L74 30 L70 42 L62 42 Z" fill={b} /></svg>);
  if (v === "sup")
    return (<svg viewBox="0 0 120 80" width="116" height="76" aria-hidden="true"><circle cx="58" cy="20" r="6" fill={c} /><path d="M58 27 L58 46 M58 33 L70 24 M58 40 L48 52 M58 40 L66 52" stroke={c} strokeWidth="3.4" strokeLinecap="round" fill="none" /><path d="M70 14 L70 40" stroke={b} strokeWidth="3" strokeLinecap="round" /><path d="M28 60 Q60 70 96 60 L92 66 Q60 74 32 66 Z" fill={c} /></svg>);
  if (v === "kayak")
    return (<svg viewBox="0 0 120 80" width="116" height="76" aria-hidden="true"><path d="M18 44 Q60 30 102 44 Q60 58 18 44 Z" fill={c} /><ellipse cx="60" cy="44" rx="8" ry="5" fill="rgba(15,39,50,.5)" /><path d="M40 30 L80 58 M80 30 L40 58" stroke={b} strokeWidth="3" strokeLinecap="round" /></svg>);
  return (<svg viewBox="0 0 120 80" width="116" height="76" aria-hidden="true"><path d="M28 34 L92 34 L86 46 L34 46 Z" fill={b} /><path d="M16 48 L104 48 L94 62 Q60 68 26 62 Z" fill={c} /></svg>);
}
function Foto({ item, alto = 200, tag = true }) {
  const h = item.hue;
  const foto = item.fotos?.[0];
  return (
    <div className="foto" style={{ height: alto, background: foto ? "#0F2732" : `linear-gradient(165deg, hsl(${h} 38% 34%), hsl(${h + 12} 45% 18%))` }}>
      {foto ? <img className="foto-img" src={foto} alt={item.nombre} loading="lazy" /> : (<><div className="foto-sol" /><Silueta v={visualDe(item)} /></>)}
      {tag && <span className="foto-tag">{etiqueta(item)}</span>}
    </div>
  );
}
const Chip = ({ icon: Icon, children }) => (<span className="chip"><Icon size={13} strokeWidth={2} /> {children}</span>);

function Tarjeta({ item, onOpen }) {
  return (
    <button className="card" onClick={() => onOpen(item)}>
      <Foto item={item} />
      <div className="card-body">
        <div className="card-top">
          <div>
            <h3 className="card-nombre">{item.nombre}</h3>
            <p className="card-lugar"><MapPin size={13} /> {item.puerto}</p>
          </div>
          <span className="rating"><Star size={12} fill="currentColor" /> {item.rating.toFixed(1)}</span>
        </div>
        <div className="card-chips">
          {item.clase === "experiencia" ? (<><Chip icon={Users}>{item.plazas}</Chip><Chip icon={Clock}>{item.duracion}</Chip><span className="badge"><BadgeCheck size={11} /> con anfitrión</span></>)
            : item.clase === "material" ? (<><Chip icon={Wind}>{item.tipo}</Chip><span className="badge"><Anchor size={11} /> sin licencia</span></>)
              : (<><Chip icon={Users}>{item.plazas}</Chip><Chip icon={Ruler}>{item.eslora} m</Chip>{item.patron !== "no" && <span className="badge"><Anchor size={11} /> patrón</span>}</>)}
        </div>
        <div className="card-precio">
          <span className="precio"><b>{eur(precioBase(item))}</b><small>/{unidad(item)}</small></span>
          <span className="ver-link">Ver <ChevronRight size={14} /></span>
        </div>
      </div>
    </button>
  );
}

/* ── Ficha + reserva ─────────────────────────────────────────────── */
function Ficha({ item, onBack, usuario, numReservas, esFavorito, onToggleFav, onNecesitaCuenta }) {
  const exp = item.clase === "experiencia";
  const mat = item.clase === "material";
  const [modo, setModo] = useState("dia");
  const [horas, setHoras] = useState(4);
  const [inicio, setInicio] = useState("2026-07-12");
  const [fin, setFin] = useState(mat ? "2026-07-13" : "2026-07-15");
  const [fechaHoras, setFechaHoras] = useState("2026-07-18");
  const [fechaExp, setFechaExp] = useState("2026-07-18");
  const [personas, setPersonas] = useState(2);
  const [conPatron, setConPatron] = useState(item.patron === "incluido");
  const [enviandoReserva, setEnviandoReserva] = useState(false);
  const [errorReserva, setErrorReserva] = useState("");
  const [licencia, setLicencia] = useState("");
  const [consientoLicencia, setConsientoLicencia] = useState(false);
  const { estado: verifLicencia, iniciar: iniciarVerifLicencia } = useVerificacionAutomatica();
  const hoy = useMemo(() => hoyISO(), []);

  const dias = useMemo(() => { const d = Math.round((new Date(fin) - new Date(inicio)) / 86400000); return isFinite(d) && d > 0 ? d : 1; }, [inicio, fin]);
  const fechaInvalida = exp ? (!fechaExp || fechaExp < hoy)
    : modo === "horas" ? (!fechaHoras || fechaHoras < hoy)
      : (!inicio || !fin || inicio < hoy || fin <= inicio);
  const patronBloqueado = item.patron === "incluido";
  const patronActivo = !exp && !mat && (patronBloqueado || (item.patron === "opcional" && conPatron));

  const base = exp ? item.persona * personas : (modo === "horas" ? item.hora * horas : item.dia * dias);
  const patronCoste = patronActivo ? (modo === "horas" ? PATRON_HORA * horas : PATRON_DIA * dias) : 0;
  const subtotal = base + patronCoste;
  const { descuento: dtoGestion } = estadoFidelidad(numReservas);
  const servicioBase = Math.round(subtotal * COMISION);
  const ahorro = Math.round(servicioBase * dtoGestion);
  const servicio = servicioBase - ahorro;
  const total = subtotal + servicio;
  const requiereFianza = !exp && !patronActivo;
  /* El material lleva la fianza fija que puso su dueño: el 20 % de un kayak a 15 €/día
     serían 3 €, que no cubren reponerlo. Los barcos siguen con el porcentaje. */
  const fianza = !requiereFianza ? 0 : mat && item.fianza > 0 ? Math.round(item.fianza) : Math.round(subtotal * FIANZA_PCT);

  const inicioISO = exp ? dtISO(fechaExp) : modo === "horas" ? dtISO(fechaHoras) : dtISO(inicio);
  const finISO = exp ? sumarHoras(inicioISO, parseDuracionHoras(item.duracion))
    : modo === "horas" ? sumarHoras(inicioISO, horas)
      : finDeDiaISO(fin);

  // Antelación mínima de reservas: no memoizar `ahora` (a diferencia de `hoy`) —
  // si el usuario se queda mirando la ficha y cruza las 22:00, debe reflejarse.
  const ahora = new Date();
  const avisoMinHoras = avisoMinHorasDe(item);
  const avisoInsuficiente = (new Date(inicioISO).getTime() - ahora.getTime()) < avisoMinHoras * 3600000;
  const bloqueoNocturno = esDeNoche(ahora) && inicioISO.slice(0, 10) < addDiasISO(hoy, 2);
  const avisoInvalido = avisoInsuficiente || bloqueoNocturno;

  const resumenTxt = exp ? `${personas} ${personas > 1 ? "plazas" : "plaza"}`
    : (modo === "horas" ? `${horas} h` : `${dias} ${dias > 1 ? "días" : "día"}`) + (patronActivo ? " · con patrón" : "");

  const reservar = async () => {
    if (!usuario) { onNecesitaCuenta(); return; }
    if (fechaInvalida) return;
    const ahoraCheck = new Date();
    const avisoInvalidoAhora = ((new Date(inicioISO).getTime() - ahoraCheck.getTime()) < avisoMinHoras * 3600000)
      || (esDeNoche(ahoraCheck) && inicioISO.slice(0, 10) < addDiasISO(hoy, 2));
    if (avisoInvalidoAhora) return;
    if (requiereFianza && verifLicencia !== "verificado") return;
    setEnviandoReserva(true);
    setErrorReserva("");
    try {
      const url = await iniciarPago({
        anuncioId: item.id, modo, horas, dias, personas,
        conPatron: !exp && !mat && item.patron === "opcional" && conPatron,
        inicioISO, finISO, detalle: resumenTxt,
      });
      window.location.href = url;
    } catch (err) {
      setErrorReserva(err.message || "No se ha podido iniciar el pago. Inténtalo de nuevo.");
      setEnviandoReserva(false);
    }
  };

  const specs = exp
    ? [[Users, "Plazas", item.plazas], [Clock, "Duración", item.duracion], [Sparkles, "Actividad", item.actividad], [BadgeCheck, "Anfitrión", item.anfitrion]]
    : mat
      ? [[Wind, "Tipo", item.tipo], [Anchor, "Licencia", "No necesaria"], [MapPin, "Entrega", "En playa"], [Check, "Incluye", "Remo y chaleco"]]
      : [[Users, "Plazas", item.plazas], [Ruler, "Eslora", `${item.eslora} m`], [Gauge, "Potencia", `${item.potencia} cv`], [ShieldCheck, "Lista", item.lista]];

  const equipamientoBase = (item.equipamiento && item.equipamiento.length)
    ? item.equipamiento
    : EQUIPAMIENTO_TIPICO[item.clase].slice(0, 5);
  const incluye = [...equipamientoBase, CANCELACION_NOTA];

  const tituloSobre = exp ? "Sobre la experiencia" : mat ? "Sobre el material" : "Sobre esta embarcación";
  const tituloIncluye = exp || mat ? "Qué incluye" : "Equipamiento y servicios";

  return (
    <div className="ficha">
      <button className="volver" onClick={onBack}><ArrowLeft size={17} /> Volver al buscador</button>
      <p className="breadcrumb">{item.zona} · {lugarCorto(item)} · {etiqueta(item)}</p>
      <div className="ficha-head">
        <h1 className="serif ficha-titulo">{item.nombre}</h1>
        <div className="ficha-acciones">
          <button className={`acc ${esFavorito ? "on" : ""}`} onClick={() => onToggleFav(item)}><Heart size={15} fill={esFavorito ? "currentColor" : "none"} /> Guardar</button>
          <button className="acc"><Share2 size={15} /> Compartir</button>
        </div>
      </div>
      <p className="ficha-sub"><span className="rating"><Star size={13} fill="currentColor" /> {item.rating.toFixed(1)}</span> · {item.reviews} reseñas · {exp
        ? <span className="verif-inline"><BadgeCheck size={14} /> Con {item.anfitrion} · {item.duracion}</span>
        : <span className="verif-inline"><BadgeCheck size={14} /> {mat ? "Material verificado" : "Anfitrión verificado"}</span>}</p>

      <div className="ficha-grid">
        <div>
          <Foto item={item} alto={360} tag={false} />
          {/* Solo fotos de verdad. Antes se pintaban siempre 4 huecos con etiquetas
              inventadas ("Camarote", "Detalle"…) y, si no había foto, salía un rectángulo
              azul con el texto encima: parecía que la web estaba rota. */}
          {item.fotos?.length > 1 && (
            <div className="galeria">
              {item.fotos.slice(1, 5).map((foto, i) => (
                <div key={foto} className="mini"><img className="foto-img" src={foto} alt={`${item.nombre} — foto ${i + 2}`} loading="lazy" /></div>
              ))}
            </div>
          )}
          <div className="specs">{specs.map(([Ic, k, v]) => <Spec key={k} icon={Ic} k={k} v={v} />)}</div>
          <h2 className="serif bloque-tit">{tituloSobre}</h2>
          <p className="bloque-txt">{item.desc}</p>
          <h2 className="serif bloque-tit">{tituloIncluye}</h2>
          <div className="equipo">{incluye.map((e) => <span key={e} className="equipo-item"><Check size={14} /> {e}</span>)}</div>
        </div>

        <aside className="reserva">
          <>
              <div className="reserva-top">
                <span className="precio grande"><b>{eur(exp ? item.persona : (modo === "horas" ? item.hora : item.dia))}</b><small>/{exp ? "persona" : modo === "horas" ? "hora" : "día"}</small></span>
                <span className="rating"><Star size={13} fill="currentColor" /> {item.rating.toFixed(1)}</span>
              </div>

              {exp ? (
                <>
                  <label className="campo"><span>Fecha</span><input type="date" min={hoy} value={fechaExp} onChange={(e) => setFechaExp(e.target.value)} /></label>
                  <div className="stepper-row"><span>Personas</span>
                    <div className="stepper">
                      <button onClick={() => setPersonas((p) => Math.max(1, p - 1))}><Minus size={15} /></button>
                      <b>{personas}</b>
                      <button onClick={() => setPersonas((p) => Math.min(item.plazas, p + 1))}><Plus size={15} /></button>
                    </div>
                  </div>
                  <p className="mini-nota">Máx. {item.plazas} personas · anfitrión incluido</p>
                  <p className="mini-nota">Reserva con al menos {avisoMinHoras} h de antelación. Si reservas entre las 22:00 y las 8:00, el inicio debe ser como muy pronto pasado mañana.</p>
                  {fechaInvalida && <p className="mini-nota mini-nota-error">No se puede reservar en fechas pasadas.</p>}
                  {!fechaInvalida && avisoInvalido && (
                    <p className="mini-nota mini-nota-error">{bloqueoNocturno
                      ? "Son más de las 22:00: esta reserva debe empezar como muy pronto pasado mañana."
                      : `Esta experiencia requiere reservar con al menos ${avisoMinHoras} horas de antelación.`}</p>
                  )}
                </>
              ) : (
                <>
                  <div className="toggle">
                    <button className={modo === "dia" ? "on" : ""} onClick={() => setModo("dia")}>Por días</button>
                    <button className={modo === "horas" ? "on" : ""} onClick={() => setModo("horas")}>Por horas</button>
                  </div>
                  {modo === "dia" ? (
                    <>
                      <div className="fechas">
                        <label><span>Inicio</span><input type="date" min={hoy} value={inicio} onChange={(e) => {
                          const v = e.target.value;
                          setInicio(v);
                          if (fin <= v) { const next = new Date(v); next.setDate(next.getDate() + 1); setFin(next.toISOString().slice(0, 10)); }
                        }} /></label>
                        <label><span>Fin</span><input type="date" min={inicio || hoy} value={fin} onChange={(e) => setFin(e.target.value)} /></label>
                      </div>
                      <p className="mini-nota">Reserva con al menos {avisoMinHoras} h de antelación. Si reservas entre las 22:00 y las 8:00, el inicio debe ser como muy pronto pasado mañana.</p>
                      {fechaInvalida && <p className="mini-nota mini-nota-error">La fecha de fin debe ser posterior a la de inicio, y no se puede reservar en fechas pasadas.</p>}
                      {!fechaInvalida && avisoInvalido && (
                        <p className="mini-nota mini-nota-error">{bloqueoNocturno
                          ? "Son más de las 22:00: esta reserva debe empezar como muy pronto pasado mañana."
                          : `Este anuncio requiere reservar con al menos ${avisoMinHoras} horas de antelación.`}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="campo"><span>Fecha</span><input type="date" min={hoy} value={fechaHoras} onChange={(e) => setFechaHoras(e.target.value)} /></label>
                      <label className="campo"><span>Horas ({horas})</span><input type="range" min={2} max={10} value={horas} onChange={(e) => setHoras(+e.target.value)} /></label>
                      <p className="mini-nota">Reserva con al menos {avisoMinHoras} h de antelación. Si reservas entre las 22:00 y las 8:00, el inicio debe ser como muy pronto pasado mañana.</p>
                      {fechaInvalida && <p className="mini-nota mini-nota-error">No se puede reservar en fechas pasadas.</p>}
                      {!fechaInvalida && avisoInvalido && (
                        <p className="mini-nota mini-nota-error">{bloqueoNocturno
                          ? "Son más de las 22:00: esta reserva debe empezar como muy pronto pasado mañana."
                          : `Este anuncio requiere reservar con al menos ${avisoMinHoras} horas de antelación.`}</p>
                      )}
                    </>
                  )}
                  {!mat && (
                    <label className={`patron ${patronBloqueado ? "fijo" : ""}`}>
                      <input type="checkbox" checked={patronActivo} disabled={patronBloqueado || item.patron === "no"} onChange={(e) => setConPatron(e.target.checked)} />
                      <span>{item.patron === "no" ? "Sin patrón · tú al timón" : patronBloqueado ? "Patrón profesional incluido" : "Añadir patrón profesional"}
                        {item.patron === "opcional" && <em> +{eur(modo === "horas" ? PATRON_HORA : PATRON_DIA)}/{modo === "horas" ? "h" : "día"}</em>}</span>
                    </label>
                  )}
                </>
              )}

              <div className="desglose">
                <Linea k={exp ? `${eur(item.persona)} × ${personas} pers.` : (modo === "horas" ? `${eur(item.hora)} × ${horas} h` : `${eur(item.dia)} × ${dias} ${dias > 1 ? "días" : "día"}`)} v={eur(base)} />
                {patronActivo && <Linea k={`Patrón (${modo === "horas" ? horas + " h" : dias + (dias > 1 ? " días" : " día")})`} v={eur(patronCoste)} />}
                <Linea k={`Gastos de servicio (${COMISION * 100}%)`} v={eur(servicioBase)} tachado={dtoGestion > 0} />
                {dtoGestion > 0 && <Linea k={`Descuento de fidelidad (-${dtoGestion * 100}%)`} v={`-${eur(ahorro)}`} verde />}
                <div className="total"><span>Total</span><span className="precio"><b>{eur(total)}</b></span></div>
              </div>

              {requiereFianza && (
                <div className="fianza-box">
                  <span className="fianza-tit"><ShieldCheck size={15} /> Fianza de {eur(fianza)}</span>
                  <p>Como {mat ? "el material" : "el barco"} se alquila sin patrón, se retiene esta fianza aparte del pago. Se te devuelve en cuanto el propietario revise la entrega y dé su visto bueno.</p>
                </div>
              )}

              {requiereFianza && usuario && (
                <div className="fianza-box licencia-box">
                  <span className="fianza-tit"><BadgeCheck size={15} /> Verificación de licencia de navegación</span>
                  {verifLicencia === "verificado" ? (
                    <p className="verif-ok"><Check size={14} /> Licencia verificada automáticamente</p>
                  ) : (
                    <>
                      <label className="field"><span>Nº de licencia de navegación</span><input value={licencia} onChange={(e) => setLicencia(e.target.value)} placeholder="PER-2024-000000" /></label>
                      <div className="fotos-drop sm"><Plus size={14} /> Adjuntar foto de la licencia (próximamente)</div>
                      <ConsentimientoLegal checked={consientoLicencia} onChange={setConsientoLicencia} texto="tu licencia de navegación" />
                      <button type="button" className="btn-sec ancho sm" disabled={!licencia.trim() || !consientoLicencia || verifLicencia === "verificando"} onClick={() => iniciarVerifLicencia()}>
                        {verifLicencia === "verificando" ? "Verificando automáticamente…" : "Verificar licencia"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {errorReserva && <p className="auth-error">{errorReserva}</p>}
              <button className="btn-primario" onClick={reservar} disabled={enviandoReserva || (!!usuario && (fechaInvalida || avisoInvalido || (requiereFianza && verifLicencia !== "verificado")))}>{!usuario ? "Entra para reservar" : enviandoReserva ? "Redirigiendo a pago…" : exp ? `Reservar ${personas > 1 ? "plazas" : "plaza"}` : mat ? "Alquilar" : "Reservar ahora"}</button>
              <p className="nota"><Info size={12} /> Pago seguro con tarjeta, PayPal, Apple Pay o Google Pay · Cancela sin recargo hasta 48 h antes</p>
            </>
        </aside>
      </div>
    </div>
  );
}
const Spec = ({ icon: Icon, k, v }) => (<div className="spec"><Icon size={16} className="spec-i" /><div><span className="spec-k">{k}</span><span className="spec-v">{v}</span></div></div>);
const Linea = ({ k, v, tachado, verde }) => (<div className={`linea ${verde ? "linea-verde" : ""}`}><span>{k}</span><span className={tachado ? "tachado" : ""}>{v}</span></div>);

/* ── Modal cuenta ────────────────────────────────────────────────── */
const ERRORES_AUTH = {
  "Invalid login credentials": "Email o contraseña incorrectos.",
  "User already registered": "Ya existe una cuenta con ese email. Inicia sesión.",
  "Email not confirmed": "Confirma tu cuenta desde el enlace que te enviamos por email antes de entrar.",
};
function AuthModal({ tab, rolPre, onClose, onAuth, onCambiarTab }) {
  const esRegistro = tab === "registro";
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState(rolPre || "ambas");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [revisaCorreo, setRevisaCorreo] = useState(false);

  const enviar = async () => {
    setError("");
    if (!email.trim() || !pass) { setError("Rellena email y contraseña."); return; }
    if (pass.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setCargando(true);
    if (esRegistro) {
      const { data, error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { nombre: nombre.trim() || "Nuevo usuario", telefono: tel.trim(), rol } },
      });
      setCargando(false);
      if (err) { setError(ERRORES_AUTH[err.message] || err.message); return; }
      if (!data.session) { setRevisaCorreo(true); return; }
      onAuth();
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      setCargando(false);
      if (err) { setError(ERRORES_AUTH[err.message] || err.message); return; }
      onAuth();
    }
  };

  if (revisaCorreo) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="ok centro sin-borde">
          <div className="ok-icon"><Mail size={26} strokeWidth={2.4} /></div>
          <h3 className="serif">Revisa tu correo</h3>
          <p>Te hemos enviado un enlace a <strong>{email}</strong> para confirmar tu cuenta. Ábrelo y vuelve a entrar aquí.</p>
          <button className="btn-primario ancho" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="modal-marca"><LogoYachtToday size={30} /><span className="serif wordmark">Yacht Today</span></div>
        <h2 className="serif modal-tit">{esRegistro ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <p className="modal-sub">{esRegistro ? "Una cuenta para alquilar, vivir experiencias y publicar lo tuyo." : "Entra para reservar y gestionar tu cuenta."}</p>
        <div className="toggle"><button className={!esRegistro ? "on" : ""} onClick={() => onCambiarTab("entrar")}>Iniciar sesión</button><button className={esRegistro ? "on" : ""} onClick={() => onCambiarTab("registro")}>Crear cuenta</button></div>
        {esRegistro && <Ico label="Nombre y apellidos" icon={User}><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Eric Navarro" /></Ico>}
        <Ico label="Email" icon={Mail}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@correo.com" /></Ico>
        {esRegistro && <Ico label="Teléfono" icon={Phone}><input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000" /></Ico>}
        <Ico label="Contraseña" icon={Lock}><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" /></Ico>
        {esRegistro && (<div className="rol-bloque"><span className="rol-label">¿Qué quieres hacer?</span><div className="rol-chips">{ROLES.map((r) => <button key={r.v} className={rol === r.v ? "rc on" : "rc"} onClick={() => setRol(r.v)}>{r.t}</button>)}</div></div>)}
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-primario ancho" disabled={cargando} onClick={enviar}>{cargando ? "Un momento…" : esRegistro ? "Crear cuenta" : "Entrar"}</button>
        <p className="modal-alt">{esRegistro ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}<button onClick={() => onCambiarTab(esRegistro ? "entrar" : "registro")}>{esRegistro ? "Inicia sesión" : "Créala aquí"}</button></p>
      </div>
    </div>
  );
}
const Ico = ({ label, icon: Icon, children }) => (<label className="field ico"><span>{label}</span><div><Icon size={15} />{children}</div></label>);

/* ── Modal cancelación ───────────────────────────────────────────── */
function CancelarModal({ reserva, onClose, onConfirmar }) {
  const horasParaInicio = (new Date(reserva.inicioISO) - new Date()) / 3600000;
  const dentroPlazo = horasParaInicio < 48;
  const perdidaGestion = reserva.servicio;
  const perdidaExtra = dentroPlazo ? Math.round(reserva.subtotal * 0.2) : 0;
  const perdidaTotal = perdidaGestion + perdidaExtra;
  const [porMalTiempo, setPorMalTiempo] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const exento = porMalTiempo && resultado?.ok && resultado.malTiempo;

  const comprobar = async () => {
    setComprobando(true);
    setResultado(await verificarMalTiempoAEMET(reserva.zona, reserva.inicioISO));
    setComprobando(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="aviso-icon"><Info size={26} /></div>
        <h2 className="serif modal-tit">¿Seguro que quieres cancelar?</h2>
        {!exento && <p className="aviso-fuerte">Los gastos de gestión ({eur(perdidaGestion)}) no se devuelven en ninguna cancelación.</p>}
        {!exento && dentroPlazo && <p className="aviso-fuerte">Además, quedan menos de 48 h para el inicio: perderás también un 20% del alquiler ({eur(perdidaExtra)}).</p>}

        <label className="consentimiento"><input type="checkbox" checked={porMalTiempo} onChange={(e) => { setPorMalTiempo(e.target.checked); setResultado(null); }} /><span>Cancelo por mal tiempo previsto en la zona</span></label>

        {porMalTiempo && (
          <div className="fianza-box">
            <p><CloudRain size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Esto se comprueba automáticamente con AEMET antes de eximirte de la penalización. Si no coincide con un aviso real, se tratará como cancelación normal por posible uso indebido. Se avisará al propietario de que se está verificando.</p>
            {!resultado && <button type="button" className="btn-sec sm" disabled={comprobando} onClick={comprobar}>{comprobando ? "Comprobando con AEMET…" : "Comprobar con AEMET"}</button>}
            {resultado && !resultado.ok && <p className="mini-nota mini-nota-error">No se ha podido comprobar automáticamente ahora mismo. Se aplicará la cancelación normal.</p>}
            {resultado?.ok && resultado.malTiempo && <p className="verif-ok"><Check size={14} /> Mal tiempo confirmado por AEMET ({resultado.detalle}). Cancelación sin penalización.</p>}
            {resultado?.ok && !resultado.malTiempo && <p className="aviso-fuerte">AEMET no confirma mal tiempo en esa fecha y zona ({resultado.detalle}). Se aplicará la cancelación normal.</p>}
          </div>
        )}

        <div className="desglose">
          <Linea k="Gastos de gestión (no reembolsables)" v={exento ? "Exento" : `-${eur(perdidaGestion)}`} />
          {dentroPlazo && <Linea k="Penalización por cancelar tarde (20%)" v={exento ? "Exento" : `-${eur(perdidaExtra)}`} />}
          <div className="total"><span>Total que perderías</span><span className="precio"><b>{exento ? "0 €" : `-${eur(perdidaTotal)}`}</b></span></div>
        </div>
        <button className="btn-primario ancho" onClick={onClose}>Volver, no cancelar</button>
        <button className="btn-cancelar ancho" onClick={onConfirmar}>{exento ? "Sí, cancelar (sin penalización)" : "Sí, cancelar de todas formas"}</button>
      </div>
    </div>
  );
}

/* ── Modal eliminar anuncio ───────────────────────────────────────── */
function EliminarAnuncioModal({ anuncio, error, onClose, onConfirmar }) {
  const [borrando, setBorrando] = useState(false);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="aviso-icon"><Trash2 size={26} /></div>
        <h2 className="serif modal-tit">¿Eliminar "{anuncio.nombre}"?</h2>
        <p className="aviso-fuerte">Esta acción no se puede deshacer. También se eliminarán las reservas asociadas a este anuncio.</p>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-primario ancho" onClick={onClose}>Volver, no eliminar</button>
        <button className="btn-cancelar ancho" disabled={borrando} onClick={async () => { setBorrando(true); await onConfirmar(); setBorrando(false); }}>{borrando ? "Eliminando…" : "Sí, eliminar definitivamente"}</button>
      </div>
    </div>
  );
}

/* ── Modal especificaciones de motor ─────────────────────────────── */
function EspecificacionesModal({ barco, onClose, onGuardar }) {
  const [modelo, setModelo] = useState(barco.motorModelo || "");
  const [notas, setNotas] = useState(barco.motorNotas || "");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <h2 className="serif modal-tit">Especificaciones de {barco.nombre}</h2>
        <p className="modal-sub">Has desbloqueado esta pestaña al completar alquileres en este barco. Cuéntanos el motor exacto para que tu kit de "Cuida tu Barco" encaje a la perfección.</p>
        <Ico label="Modelo de motor" icon={Gauge}><input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Yamaha F150 4T" /></Ico>
        <label className="field"><span>Notas / especificaciones adicionales</span><textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Referencia del filtro de aceite, tipo de combustible…" /></label>
        <button className="btn-primario ancho" onClick={() => { onGuardar(modelo, notas); onClose(); }}>Guardar especificaciones</button>
      </div>
    </div>
  );
}

/* ── Modal cancelación por el propietario ────────────────────────── */
function CancelarPropietarioModal({ reserva, onClose, onConfirmar }) {
  const [motivo, setMotivo] = useState("averia");
  const [comprobando, setComprobando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const esMeteo = motivo === "meteo";
  const meteoConfirmado = resultado?.ok && resultado.malTiempo;
  const justificado = motivo !== "otro" && (!esMeteo || meteoConfirmado);
  const bloqueado = esMeteo && !resultado;

  const comprobar = async () => {
    setComprobando(true);
    setResultado(await verificarMalTiempoAEMET(reserva.zona, reserva.inicioISO));
    setComprobando(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="aviso-icon"><Info size={26} /></div>
        <h2 className="serif modal-tit">Cancelar esta reserva</h2>
        <p className="modal-sub">Cancelar como propietario afecta a tu reputación si no hay un motivo justificado.</p>
        <label className="field"><span>Motivo de la cancelación</span>
          <select value={motivo} onChange={(e) => { setMotivo(e.target.value); setResultado(null); }}>
            <option value="averia">Avería mecánica</option>
            <option value="meteo">Emergencia meteorológica</option>
            <option value="salud">Enfermedad / emergencia personal</option>
            <option value="otro">Otro / prefiero no decirlo</option>
          </select>
        </label>
        {esMeteo && (
          <div className="fianza-box">
            <p><CloudRain size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />Se comprueba con AEMET si hay mal tiempo real antes de aceptarlo como motivo justificado, para evitar cancelaciones falsas.</p>
            {!resultado && <button type="button" className="btn-sec sm" disabled={comprobando} onClick={comprobar}>{comprobando ? "Comprobando con AEMET…" : "Comprobar con AEMET"}</button>}
            {resultado && !resultado.ok && <p className="mini-nota mini-nota-error">No se ha podido comprobar ahora mismo. No se aceptará como justificado.</p>}
            {resultado?.ok && resultado.malTiempo && <p className="verif-ok"><Check size={14} /> Mal tiempo confirmado ({resultado.detalle}).</p>}
            {resultado?.ok && !resultado.malTiempo && <p className="aviso-fuerte">AEMET no confirma mal tiempo ({resultado.detalle}). No se aceptará como justificado.</p>}
          </div>
        )}
        {justificado
          ? <p className="mini-nota">Este motivo se considera justificado: no afecta a tu reputación.</p>
          : <p className="aviso-fuerte">Este motivo no se considera justificado: recibirás un aviso que reduce tu visibilidad y te aleja del distintivo Propietario Premium.</p>}
        <button className="btn-primario ancho" onClick={onClose}>Volver, no cancelar</button>
        <button className="btn-cancelar ancho" disabled={bloqueado} onClick={() => onConfirmar(justificado)}>Cancelar reserva</button>
      </div>
    </div>
  );
}

/* ── Modal reseña obligatoria ─────────────────────────────────────── */
function ResenaModal({ reserva, onClose, onGuardar }) {
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <h2 className="serif modal-tit">¿Qué tal tu experiencia en {reserva.barco}?</h2>
        <p className="modal-sub">Antes de cerrar la reserva, cuéntanos qué tal fue. Ayuda a otros viajeros y a los propietarios a mejorar.</p>
        <div className="estrellas-picker">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => setEstrellas(n)}><Star size={26} fill={n <= estrellas ? "currentColor" : "none"} /></button>
          ))}
        </div>
        <label className="field"><span>Cuéntanos más (opcional)</span><textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="El barco estaba impecable, el propietario muy atento…" /></label>
        <button className="btn-primario ancho" onClick={() => onGuardar(estrellas, comentario.trim())}>Publicar reseña y finalizar</button>
      </div>
    </div>
  );
}

/* ── Recompensas (niveles, insignias) ────────────────────────────── */
const NIVELES = [
  { n: "Explorer", min: 0, b: "Tu primera travesía" },
  { n: "Captain", min: 5, b: "Promociones privadas" },
  { n: "Navigator", min: 10, b: "Descuentos exclusivos y acceso prioritario" },
  { n: "Admiral", min: 20, b: "Eventos, experiencias premium y regalos" },
];
const INSIGNIAS = [
  { t: "Primera navegación", min: 1 }, { t: "Explorador de calas", min: 3 }, { t: "5 reservas", min: 5 },
  { t: "Capitán del verano", min: 8 }, { t: "10 reservas", min: 10 }, { t: "Cliente VIP", min: 20 },
];
const OWNER_NIVELES = [
  { min: 3, premio: "Kit básico de mantenimiento: aceite y filtros (aceite, combustible, aire)." },
  { min: 10, premio: "A elegir: limpieza profesional, kit premium o vale para tienda náutica." },
  { min: 20, premio: "A elegir: revisión mecánica, descuento en taller o antifouling subvencionado." },
  { min: 40, premio: "A elegir: electrónica náutica, chalecos homologados, defensas, cabos, batería o hélice." },
];
const FAQ = [
  { cat: "Reservar", preguntas: [
    { p: "¿Necesito titulación para alquilar un barco?", r: "Depende del anuncio: cada ficha indica si el patrón está incluido, es opcional o no hace falta. Los veleros y barcos de mayor eslora suelen incluir patrón titulado; motos de agua y neumáticas pequeñas se navegan con licencia de navegación." },
    { p: "¿Qué incluye el precio?", r: "La tarifa del propietario más los gastos de servicio (15%), ya desglosados antes de pagar. No hay costes ocultos." },
    { p: "¿Cómo reservo con patrón?", r: "Si el barco lo permite, en la ficha eliges «con patrón» y su coste por hora se añade al precio final antes de confirmar." },
    { p: "¿Con cuánta antelación tengo que reservar?", r: "Al menos 3 horas antes del inicio (24 h para experiencias), y si reservas entre las 22:00 y las 8:00, el inicio debe ser como muy pronto pasado mañana. Es para dar tiempo al propietario a preparar la salida. Algunos anuncios pueden pedir más antelación; lo verás junto al selector de fecha." },
  ]},
  { cat: "Pagos y cancelaciones", preguntas: [
    { p: "¿Cuándo se me cobra?", r: "Al confirmar la reserva, por la tarifa del propietario más el 15% de gastos de servicio. El propietario recibe su tarifa íntegra." },
    { p: "¿Puedo cancelar gratis?", r: "Sí, hasta 48 horas antes del inicio. Consulta la política completa en la pestaña Cancelaciones." },
  ]},
  { cat: "Publicar tu barco", preguntas: [
    { p: "¿Cuánto cuesta publicar?", r: "Publicar es gratis. Solo se paga al alquilar, y los gastos de servicio los paga quien reserva: tú recibes tu tarifa íntegra." },
    { p: "¿Qué documentación necesito?", r: "Matrícula, lista (6ª o 7ª) y póliza de seguro en vigor con su fecha de caducidad. La verificamos automáticamente al publicar, y un revisor de Yacht Today da el visto bueno final." },
  ]},
  { cat: "Seguridad y documentación", preguntas: [
    { p: "¿Están verificados los propietarios?", r: "Sí: revisamos matrícula, lista y seguro antes de publicar cualquier anuncio, y distinguimos con «Propietario Premium» a quienes mantienen mejor valoración y disponibilidad." },
    { p: "¿Qué pasa con mis datos?", r: "Tratamos tu documentación exclusivamente para verificar la reserva o el anuncio, conforme al RGPD. No se cede a terceros salvo obligación legal, y puedes pedir su supresión escribiendo a soporte@yachtoday.com." },
  ]},
  { cat: "Programa de recompensas", preguntas: [
    { p: "¿Cómo subo de nivel?", r: "Cada alquiler cuenta: con 5 reservas pasas a Captain, con 10 a Navigator y con 20 a Admiral, desbloqueando descuentos y ventajas exclusivas." },
    { p: "¿Qué es la Recompensa Compartida?", r: "Cuando un propietario llega a 25 o 50 alquileres, premiamos también a todos los clientes que alquilaron ese barco en el periodo: cupones o la posibilidad de un alquiler gratis." },
  ]},
];
const CANCELACION_TRAMOS = [
  { cuando: "Más de 48 h antes", reembolso: "100%", nota: "Cancelación gratuita, sin preguntas." },
  { cuando: "Entre 48 h y 24 h antes", reembolso: "50%", nota: "Se retiene la mitad para compensar al propietario." },
  { cuando: "Menos de 24 h antes o no presentado", reembolso: "0%", nota: "Sin reembolso, salvo causa de fuerza mayor." },
];
function nivelDe(count) {
  let idx = 0;
  NIVELES.forEach((n, i) => { if (count >= n.min) idx = i; });
  const actual = NIVELES[idx], siguiente = NIVELES[idx + 1] || null;
  return { actual, siguiente, idx };
}
/* Descuento en gastos de gestión: 3 reservas del ciclo = 50%, 5 = 100%, luego se reinicia */
function estadoFidelidad(count) {
  const ciclo = count % 5;
  const descuento = ciclo < 2 ? 0 : ciclo < 4 ? 0.5 : 1;
  const faltan = descuento === 0 ? 2 - ciclo : descuento === 0.5 ? 4 - ciclo : 0;
  return { descuento, faltan };
}

/* ── Panel de usuario ────────────────────────────────────────────── */
function Panel({ usuario, reservas, misBarcos, reservasRecibidas, avisosPropietario, favoritos, esAdmin, anunciosRevision, onAprobarAnuncio, onRechazarAnuncio, onVerDocumento, onConectarStripe, errorCobros, onExplorar, onPublicar, onAbrir, onSalir, onVentajas, onMantenimiento, onCancelar, onFinalizar, onFinalizarRecibida, onEspecificar, onCancelarRecibida, onActivarUltimaHora, onDesactivarUltimaHora, onEliminarAnuncio }) {
  const esCliente = usuario.rol === "cliente" || usuario.rol === "ambas";
  const esProp = usuario.rol === "propietario" || usuario.rol === "ambas";
  const activas = reservas.filter((r) => r.estado !== "finalizada").slice().sort((a, b) => new Date(a.inicioISO) - new Date(b.inicioISO));
  const finalizadas = reservas.filter((r) => r.estado === "finalizada");
  const [proxima, ...otrasActivas] = activas;
  const historial = [...otrasActivas, ...finalizadas];
  const count = finalizadas.length;
  const { actual, siguiente } = nivelDe(count);
  const { descuento: dtoActual, faltan: dtoFaltan } = estadoFidelidad(count);

  return (
    <div className="panel-wrap">
      <aside className="panel-side">
        <div className="side-user"><div className="avatar-xl">{iniciales(usuario.nombre)}</div><div><p className="side-nombre">{usuario.nombre}</p><p className="side-meta">Miembro desde 2024</p></div></div>
        <span className="rol-badge"><BadgeCheck size={13} /> {ROL_LABEL[usuario.rol]}</span>
        <div className="nivel-mini">
          <div className="nivel-mini-top"><Trophy size={15} /> <b>{actual.n}</b></div>
          {siguiente ? (<><div className="barra"><span style={{ width: `${Math.min(100, (count / siguiente.min) * 100)}%` }} /></div><p className="nivel-mini-txt">{siguiente.min - count} reserva{siguiente.min - count > 1 ? "s" : ""} para {siguiente.n}</p></>)
            : <p className="nivel-mini-txt">Nivel máximo alcanzado ⚓</p>}
          <button className="link-ventajas" onClick={onVentajas}>Ver ventajas →</button>
        </div>
        <button className="btn-salir-side" onClick={onSalir}><LogOut size={15} /> Cerrar sesión</button>
      </aside>

      <main className="panel-main">
        <div className="panel-cab"><h1 className="serif">{saludo()}, {usuario.nombre.split(" ")[0]} 👋</h1><button className="btn-primario auto" onClick={onExplorar}><Plus size={16} /> Nueva reserva</button></div>

        {esAdmin && (
          <section className="panel-sec">
            <h2 className="serif sec-t"><ShieldCheck size={18} /> Anuncios pendientes de revisión</h2>
            {anunciosRevision.length ? (<ul className="lista">{anunciosRevision.map((a) => {
              const seguroCaducado = a.caducidad_seguro && a.caducidad_seguro < new Date().toISOString().slice(0, 10);
              return (
              <li key={a.id} className="lista-item lista-item-col">
                <div className="li-fila">
                  <div><p className="li-nombre">{a.nombre}</p><p className="li-sub">{a.clase} · {a.puerto}</p></div>
                  <div className="li-acciones">
                    <button className="btn-sec sm" onClick={() => onRechazarAnuncio(a)}>Rechazar</button>
                    <button className="btn-primario sm" onClick={() => onAprobarAnuncio(a)}>Aprobar</button>
                  </div>
                </div>
                <div className="li-doc">
                  {a.matricula && <span>Matrícula: <b>{a.matricula}</b></span>}
                  {a.poliza && <span>Seguro: <b>{a.poliza}</b></span>}
                  {a.caducidad_seguro && <span>Caducidad: <b>{new Date(a.caducidad_seguro).toLocaleDateString("es-ES")}</b></span>}
                  {/* El material (SUP y kayak) no tiene seguro ni matrícula que revisar: lo que
                      hay que mirar es que la fianza cubra reponerlo. */}
                  {a.clase === "material" && <span>Fianza: <b>{a.fianza > 0 ? eur(a.fianza) : "sin fijar"}</b></span>}
                </div>
                {seguroCaducado && <p className="mini-nota mini-nota-error">⚠ El seguro de este anuncio ya ha caducado.</p>}
                {a.documentos?.length > 0 && (
                  <div className="li-doc-btns">
                    {a.documentos.map((ruta, i) => (
                      <button key={ruta} type="button" className="btn-sec sm" onClick={() => onVerDocumento(ruta)}><FileText size={13} /> Ver documento {i + 1}</button>
                    ))}
                  </div>
                )}
              </li>
              );
            })}</ul>)
              : <p className="mini-nota">No hay anuncios esperando revisión.</p>}
          </section>
        )}

        {esCliente && (
          <section className="panel-sec">
            <h2 className="serif sec-t"><Gift size={18} /> Tus ventajas</h2>
            <div className="ventaja-row">
              <div className="ventaja-mini"><span className="vm-num">{count}</span><span className="vm-lab">reservas</span></div>
              <div className="ventaja-mini"><span className="vm-num">{dtoActual > 0 ? `${dtoActual * 100}%` : "—"}</span><span className="vm-lab">dto. gastos de gestión</span></div>
              <div className="ventaja-mini"><span className="vm-num">{INSIGNIAS.filter((b) => count >= b.min).length}</span><span className="vm-lab">insignias</span></div>
            </div>
            <p className="mini-nota">{dtoActual === 1 ? "¡100% desbloqueado! Se aplica en tu próxima reserva y luego el contador se reinicia." : `Te faltan ${dtoFaltan} reserva${dtoFaltan > 1 ? "s" : ""} para el ${dtoActual === 0 ? "50%" : "100%"} de descuento.`}</p>
            <div className="insignias">
              {INSIGNIAS.map((b) => { const ok = count >= b.min; return (<span key={b.t} className={`insignia ${ok ? "ok" : ""}`}><Award size={14} /> {b.t}</span>); })}
            </div>
          </section>
        )}

        {esCliente && (
          <section className="panel-sec">
            <h2 className="serif sec-t"><CalendarCheck size={18} /> Próxima reserva</h2>
            {proxima ? (<div className="prox"><div><span className="estado confirmada">Confirmada</span><p className="prox-nombre">{proxima.barco}</p><p className="prox-sub">{proxima.puerto} · {proxima.detalle}</p></div><div className="prox-fin"><span className="precio"><b>{eur(proxima.total)}</b></span>
              {new Date() > new Date(proxima.finISO)
                ? <button className="btn-sec sm" onClick={() => onFinalizar(proxima)}>Marcar como finalizada</button>
                : <div className="li-acciones"><button className="btn-sec sm" onClick={onExplorar}>Gestionar</button><button className="btn-cancelar sm" onClick={() => onCancelar(proxima)}>Cancelar</button></div>}
            </div></div>)
              : <Vacio txt="No tienes reservas activas." cta="Explorar" onCta={onExplorar} />}
            {proxima && proxima.fianzaEstado && <FianzaEstado reserva={proxima} />}
          </section>
        )}

        {esCliente && historial.length > 0 && (
          <section className="panel-sec"><h2 className="serif sec-t"><ClipboardList size={18} /> Historial de viajes</h2>
            <ul className="lista">{historial.map((r) => {
              const yaTermino = new Date() > new Date(r.finISO);
              return (
                <li key={r.id} className="lista-item lista-item-col">
                  <div className="li-fila">
                    <div><p className="li-nombre">{r.barco}</p><p className="li-sub">{r.puerto} · {r.detalle}</p></div>
                    {r.estado === "finalizada" ? <span className="estado confirmada">Finalizada</span>
                      : yaTermino ? <button className="btn-sec sm" onClick={() => onFinalizar(r)}>Marcar finalizada</button>
                        : <div className="li-acciones"><button className="btn-sec sm" onClick={onExplorar}>Repetir</button><button className="btn-cancelar sm" onClick={() => onCancelar(r)}>Cancelar</button></div>}
                  </div>
                  {r.fianzaEstado && <FianzaEstado reserva={r} compacta />}
                  {r.resena && <p className="mini-nota">Tu reseña: {"★".repeat(r.resena.estrellas)}{"☆".repeat(5 - r.resena.estrellas)} {r.resena.comentario && `· "${r.resena.comentario}"`}</p>}
                </li>
              );
            })}</ul></section>
        )}

        {esCliente && (
          <section className="panel-sec"><h2 className="serif sec-t"><Heart size={18} /> Favoritos</h2>
            {favoritos.length ? (<div className="fav-grid">{favoritos.map((b) => (<button key={b.id} className="fav" onClick={() => onAbrir(b)}><Foto item={b} alto={110} /><div className="fav-body"><p className="li-nombre">{b.nombre}</p><p className="li-sub">{eur(precioBase(b))}/{unidad(b)}</p></div></button>))}</div>)
              : <Vacio txt="Aún no has guardado nada. Pulsa el corazón en cualquier ficha." cta="Explorar" onCta={onExplorar} />}</section>
        )}

        {esProp && (
          <section className="panel-sec">
            <h2 className="serif sec-t"><ShieldCheck size={18} /> Cobros</h2>
            {usuario.stripeAccountId
              ? (<><p className="mini-nota">✓ Cuenta de cobro conectada con Stripe.</p><button className="btn-sec sm" onClick={onConectarStripe}>Revisar datos de cobro</button></>)
              : (<><p className="mini-nota">Para recibir el dinero de tus alquileres, conecta una cuenta de cobro con Stripe (tarda unos minutos).</p><button className="btn-primario sm" onClick={onConectarStripe}>Activar cobros</button></>)}
            {errorCobros && <p className="mini-nota mini-nota-error">{errorCobros}</p>}
          </section>
        )}

        {esProp && (
          <section className="panel-sec">
            <div className="premium" style={{ flexWrap: "wrap" }}>
              <Wrench size={22} />
              <div style={{ flex: 1 }}><b>¿Tu barco necesita mantenimiento?</b><p>Spen Mechanics S.L. se encarga de revisiones, motor y puesta a punto — para que siempre lo tengas listo para tu próxima reserva.</p></div>
              <button className="btn-sec sm" style={{ marginLeft: "auto" }} onClick={onMantenimiento}>Ver Spen Mechanics S.L.</button>
            </div>
          </section>
        )}

        {esProp && (
          <section className="panel-sec"><h2 className="serif sec-t"><Ship size={18} /> Mis anuncios</h2>
            {avisosPropietario > 0
              ? <p className="mini-nota mini-nota-error">⚠ {avisosPropietario} aviso{avisosPropietario > 1 ? "s" : ""} por cancelar sin motivo justificado. Reduce tu visibilidad en búsquedas y te aleja del distintivo Propietario Premium.</p>
              : <p className="mini-nota">✓ Sin avisos · optas al distintivo ⭐ Propietario Premium.</p>}
            {misBarcos.length ? (<ul className="lista">{misBarcos.map((b) => {
              const completadasBarco = reservasRecibidas.filter((r) => r.barcoId === b.id && r.estado === "finalizada").length;
              const desbloqueado = completadasBarco >= OWNER_NIVELES[0].min;
              const siguienteBarco = OWNER_NIVELES.find((n) => completadasBarco < n.min);
              const enSieteDias = new Date(Date.now() + 7 * 86400000);
              const sinReservasProximas = !reservasRecibidas.some((r) => r.barcoId === b.id && r.estado !== "finalizada" && new Date(r.inicioISO) > new Date() && new Date(r.inicioISO) < enSieteDias);
              return (
                <li key={b.id} className="lista-item lista-item-col">
                  <div className="li-fila">
                    <div><p className="li-nombre">{b.nombre}</p><p className="li-sub">{etiqueta(b)} · {eur(precioBase(b))}/{unidad(b)}</p></div>
                    <div className="li-acciones">
                      <span className="estado revision">{b.estado}</span>
                      <button className="acc" title="Eliminar anuncio" onClick={() => onEliminarAnuncio(b)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="mini-nota">{completadasBarco} alquiler{completadasBarco === 1 ? "" : "es"} completados{siguienteBarco ? ` · faltan ${siguienteBarco.min - completadasBarco} para el siguiente premio` : " · ¡nivel máximo!"}</p>
                  {desbloqueado && (
                    <button className="btn-sec sm" onClick={() => onEspecificar(b)}>
                      <Gauge size={14} /> {b.motorModelo ? `Motor: ${b.motorModelo}` : "Añadir especificaciones de motor"}
                    </button>
                  )}
                  {sinReservasProximas && !b.ultimaHora?.activo && <UltimaHoraAlerta barco={b} onActivar={onActivarUltimaHora} />}
                  {b.ultimaHora?.activo && <span className="fianza-badge"><Zap size={12} style={{ verticalAlign: "-2px" }} /> Última hora activa: -{b.ultimaHora.descuento}% <button className="link-inline" onClick={() => onDesactivarUltimaHora(b.id)}>Desactivar</button></span>}
                </li>
              );
            })}<button className="btn-sec ancho" onClick={onPublicar}><Plus size={15} /> Publicar otro</button></ul>)
              : <Vacio txt="Todavía no tienes nada publicado." cta="Publica lo tuyo" onCta={onPublicar} primario />}
          </section>
        )}

        {esProp && reservasRecibidas.length > 0 && (
          <section className="panel-sec"><h2 className="serif sec-t"><ClipboardList size={18} /> Reservas recibidas</h2>
            <p className="mini-nota">De mentira, para que puedas probar el programa de recompensas de propietario antes de tener clientes reales.</p>
            <ul className="lista">{reservasRecibidas.map((r) => {
              const yaTermino = new Date() > new Date(r.finISO);
              return (
                <li key={r.id} className="lista-item lista-item-col">
                  <div className="li-fila">
                    <div><p className="li-nombre">{r.barco}</p><p className="li-sub">{r.cliente} · {eur(r.total)}</p></div>
                    {r.estado === "finalizada" ? <span className="estado confirmada">Finalizada</span>
                      : yaTermino ? <button className="btn-sec sm" onClick={() => onFinalizarRecibida(r.id)}>Dar visto bueno y finalizar</button>
                        : <div className="li-acciones"><span className="estado revision">Próxima</span><button className="btn-cancelar sm" onClick={() => onCancelarRecibida(r)}>Cancelar</button></div>}
                  </div>
                  {r.fianzaEstado && <span className="fianza-badge">Fianza: {eur(r.fianza)} {r.fianzaEstado === "liberada" ? "liberada ✓" : "retenida"}</span>}
                </li>
              );
            })}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
const Vacio = ({ txt, cta, onCta, primario }) => (<div className="mini-vacio"><p>{txt}</p><button className={primario ? "btn-primario auto" : "btn-sec"} onClick={onCta}>{cta}</button></div>);

function FianzaEstado({ reserva, compacta }) {
  if (reserva.fianzaEstado === "liberada") {
    return <div className={`fianza-estado ok ${compacta ? "compacta" : ""}`}><span><ShieldCheck size={14} /> Fianza de {eur(reserva.fianza)} liberada</span></div>;
  }
  return (
    <div className={`fianza-estado ${compacta ? "compacta" : ""}`}>
      <span><ShieldCheck size={14} /> Fianza de {eur(reserva.fianza)} retenida · se te devolverá cuando el propietario dé por finalizado el alquiler</span>
    </div>
  );
}

function UltimaHoraAlerta({ barco, onActivar }) {
  const [descuento, setDescuento] = useState(20);
  return (
    <div className="fianza-box">
      <span className="fianza-tit"><Zap size={15} /> Sin reservas en los próximos 7 días</span>
      <p>¿Activamos un descuento de última hora para intentar llenar ese hueco? Eliges tú el porcentaje.</p>
      <div className="fila">
        <label className="field"><span>Descuento (%)</span><input type="number" min={5} max={50} value={descuento} onChange={(e) => setDescuento(+e.target.value || 0)} /></label>
        <button type="button" className="btn-sec sm" onClick={() => onActivar(barco.id, descuento)}>Activar</button>
      </div>
    </div>
  );
}

/* ── Ventajas (programa de recompensas) ──────────────────────────── */
function Ventajas({ onExplorar, onPublicar, onMantenimiento }) {
  return (
    <div className="ventajas">
      <section className="v-hero" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.9) 0%, rgba(15,39,50,.72) 45%, rgba(18,48,61,.55) 100%), url(${VENTAJAS_FOTO})` }}>
        <span className="eyebrow claro">Programa de recompensas</span>
        <h1 className="serif v-h1">Cuanto más navegas, más ganas</h1>
        <p className="v-sub">Y cuanto más alquilas tu barco, menos cuesta mantenerlo. Yacht Today no es solo un marketplace: es una comunidad que premia a quien alquila y a quien comparte su embarcación.</p>
        <div className="v-hero-btns"><button className="btn-primario auto claro-btn" onClick={onExplorar}>Explorar</button><button className="btn-sec-claro" onClick={onPublicar}>Publica lo tuyo</button></div>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Para quien alquila</h2></div>
        <div className="niveles-grid">
          {NIVELES.map((n, i) => (<div key={n.n} className={`nivel-card ${i === 0 ? "activo" : ""}`}><span className="nivel-n">{n.n}</span><span className="nivel-req">{n.min === 0 ? "1er alquiler" : `${n.min} alquileres`}</span><p>{n.b}</p></div>))}
        </div>
        <div className="fidelidad">
          <div className="fid"><Gift size={20} /><div><b>Tras 3 alquileres</b><p>50% de descuento en gastos de gestión.</p></div></div>
          <div className="fid"><Gift size={20} /><div><b>Tras 5 alquileres</b><p>100% de descuento en gastos de gestión. Luego el contador reinicia.</p></div></div>
          <div className="fid"><Award size={20} /><div><b>Insignias y retos</b><p>Explorador de calas, Capitán del verano, Cliente VIP… con retos de temporada.</p></div></div>
        </div>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Para propietarios · "Cuida tu Barco"</h2></div>
        <div className="owner-grid">
          {OWNER_NIVELES.map((o, i) => (<div key={o.min} className="owner-card"><span className="owner-n">Nivel {i + 1}</span><span className="owner-req">{o.min} alquileres</span><p>{o.premio}</p></div>))}
        </div>
        <div className="premium"><BadgeCheck size={22} /><div><b>Distintivo ⭐ Propietario Premium</b><p>Excelente valoración, alta disponibilidad, respuesta rápida y sin cancelaciones: más visibilidad, más confianza y prioridad en las búsquedas.</p></div></div>
        <div className="premium" style={{ flexWrap: "wrap" }}>
          <Wrench size={22} />
          <div style={{ flex: 1 }}><b>Mantenimiento con Spen Mechanics S.L.</b><p>Revisiones, motor y puesta a punto para que tu barco esté siempre listo — con la garantía de nuestro taller de confianza.</p></div>
          <button className="btn-sec sm" style={{ marginLeft: "auto" }} onClick={onMantenimiento}>Ver Spen Mechanics S.L.</button>
        </div>
      </section>

      <section className="seccion recompensa-compartida">
        <span className="eyebrow claro">La idea estrella</span>
        <h2 className="serif">Recompensa Compartida</h2>
        <p>Cuando un propietario alcanza un hito (25 o 50 alquileres), Yacht Today premia <b>al propietario y a todos los clientes</b> que alquilaron ese barco en ese periodo. El dueño recibe un vale de mantenimiento; los clientes, un cupón o entran en el sorteo de un alquiler gratis. Todos sienten que forman parte del éxito.</p>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Referidos y socios</h2></div>
        <div className="ref-grid">
          <div className="ref"><Handshake size={20} /><b>Invita y gana</b><p>Trae a un amigo o a otro propietario: cuando hace su primera reserva, ganáis descuentos, créditos o kits de mantenimiento.</p></div>
          <div className="ref"><Waypoints size={20} /><b>Socios náuticos</b><p>Talleres, tiendas, marinas y aseguradoras nos ayudan a abaratar las recompensas. Ellos ganan clientes; tú, ventajas.</p></div>
          <div className="ref"><Trophy size={20} /><b>Sorteo anual</b><p>Cada reserva es una participación para un fin de semana en barco premium, equipamiento y experiencias VIP.</p></div>
        </div>
      </section>
    </div>
  );
}

/* ── Página de propietarios ──────────────────────────────────────────
   Es el sitio al que se enlaza desde fuera (yachtoday.com/propietarios) cuando se
   contacta a un propietario: sin esto aterrizaba en la portada, que está escrita para
   quien quiere alquilar un barco, no para quien lo tiene. El tono es deliberadamente
   honesto sobre que la plataforma acaba de abrir: es lo único que la diferencia de una
   web anónima, y el propietario lo va a comprobar en dos clics de todas formas. */
function Propietarios({ onPublicar, onVentajas }) {
  return (
    <div className="ventajas">
      <section className="v-hero" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.92) 0%, rgba(15,39,50,.75) 45%, rgba(18,48,61,.58) 100%), url(${MARINA_FOTO})` }}>
        <span className="eyebrow claro">Para propietarios</span>
        <h1 className="serif v-h1">Tu barco pasa el año amarrado. Que al menos se pague solo.</h1>
        <p className="v-sub">Un amarre, un seguro y una revisión cuestan lo mismo lo uses dos fines de semana o veinte. Alquílalo los días que no lo tocas y deja que cubra sus propios gastos.</p>
        <div className="v-hero-btns"><button className="btn-primario auto claro-btn" onClick={onPublicar}>Publica tu barco</button></div>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Lo que te llevas</h2></div>
        <div className="ref-grid">
          <div className="ref"><Wallet size={20} /><b>Cobras tu tarifa íntegra</b><p>La comisión del {Math.round(COMISION * 100)} % la paga quien alquila, no tú. Si pones 200 € al día, recibes 200 € al día.</p></div>
          <div className="ref"><CreditCard size={20} /><b>Te pagan por adelantado</b><p>El cliente paga con tarjeta al reservar y el dinero llega a tu cuenta. Se acabó cobrar en mano y que te dejen plantado.</p></div>
          <div className="ref"><ShieldCheck size={20} /><b>Fianza retenida</b><p>Se le retiene una fianza al cliente y solo la recupera cuando eres tú quien da el alquiler por terminado. Si te devuelven el barco mal, no te lo comes tú.</p></div>
          <div className="ref"><FileText size={20} /><b>Sabes a quién se lo dejas</b><p>Pedimos licencia y documentación. Y tú decides con cuánta antelación mínima quieren reservarte: nadie te va a coger el barco para dentro de una hora.</p></div>
        </div>
      </section>

      <section className="seccion pasos-sec">
        <h2 className="serif centro">Cómo funciona</h2>
        <div className="pasos">
          <Paso n="01" icon={Plus} t="Publicas tu barco" d="Fotos, precio por horas o por días, y si lo alquilas con patrón o sin él. Revisamos la documentación antes de que salga publicado." />
          <Paso n="02" icon={CalendarCheck} t="Recibes la reserva ya pagada" d="Te avisamos por correo. La reserva llega confirmada y cobrada: no tienes que perseguir a nadie." />
          <Paso n="03" icon={Anchor} t="Entregas el barco y cobras" d="El dinero va a tu cuenta bancaria. Cuando das el alquiler por terminado, se libera la fianza del cliente." />
        </div>
      </section>

      <section className="seccion">
        <div className="honesto">
          <span className="eyebrow">Te lo decimos claro</span>
          <h2 className="serif">Acabamos de abrir, y todavía no tenemos clientes</h2>
          <p>Preferimos decírtelo nosotros a que lo descubras solo. Yacht Today acaba de arrancar y estamos buscando a los primeros propietarios de cada zona — por eso te escribimos.</p>
          <p><b>Por eso no te pedimos nada a cambio:</b> publicar es gratis, no hay exclusividad y puedes seguir anunciando tu barco donde ya lo tengas. Si te entra una reserva, ganas. Si no entra, no has perdido nada. Solo ganamos cuando tú ganas.</p>
        </div>
      </section>

      <section className="seccion">
        <div className="premium">
          <Wrench size={22} />
          <div style={{ flex: 1 }}><b>Y cuanto más alquilas, menos te cuesta mantenerlo</b><p>"Cuida tu Barco": al llegar a 3, 10, 20 y 40 alquileres desbloqueas kits de limpieza, revisiones y equipamiento. Algo que ninguna otra plataforma te da.</p></div>
          <button className="btn-sec sm" style={{ marginLeft: "auto" }} onClick={onVentajas}>Ver el programa</button>
        </div>
      </section>

      <section className="seccion">
        <div className="arranque">
          <h2 className="serif">¿Publicamos tu barco?</h2>
          <p>Son cinco minutos. Y si prefieres que te echemos una mano con las fotos o el precio, escríbenos a <a className="link-inline" href="mailto:soporte@yachtoday.com">soporte@yachtoday.com</a> y lo vemos juntos.</p>
          <button className="btn-primario auto" onClick={onPublicar}>Publica tu barco</button>
          <p className="arranque-nota">Gratis · Sin exclusividad · Cobras tu tarifa íntegra</p>
        </div>
      </section>
    </div>
  );
}

/* ── Spen Mechanics S.L.: publicidad del mantenimiento náutico de Eric ───
   Contenido de borrador — pendiente de que Eric confirme los servicios
   exactos, el tono y el contacto real antes de darlo por definitivo. */
const SPEN_MECHANICS_URL = "https://www.spenmechanics.com";

function SpenMechanics() {
  return (
    <div className="ventajas">
      <section className="v-hero" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.9) 0%, rgba(15,39,50,.72) 45%, rgba(18,48,61,.55) 100%), url(${MARINA_FOTO})` }}>
        <span className="eyebrow claro">Mantenimiento náutico</span>
        <h1 className="serif v-h1">Spen Mechanics S.L.</h1>
        <p className="v-sub">Cuidamos tu embarcación como si fuera nuestra. Revisiones, mantenimiento de motor y puesta a punto, con materiales de calidad y trato cercano.</p>
        <div className="v-hero-btns">
          <a className="btn-primario auto claro-btn" href={SPEN_MECHANICS_URL} target="_blank" rel="noopener noreferrer">Pide presupuesto</a>
          <a className="btn-sec-claro" href={SPEN_MECHANICS_URL} target="_blank" rel="noopener noreferrer">www.spenmechanics.com</a>
        </div>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Qué ofrecemos</h2></div>
        <div className="fidelidad">
          <div className="fid"><Wrench size={20} /><div><b>Revisiones periódicas</b><p>Puesta a punto de motor, casco y equipos antes de cada temporada, para que tu barco esté siempre listo para zarpar.</p></div></div>
          <div className="fid"><ShieldCheck size={20} /><div><b>Gestión de averías</b><p>Diagnóstico y reparación con repuestos de calidad, avisándote siempre antes de actuar y con presupuesto claro.</p></div></div>
          <div className="fid"><Sparkles size={20} /><div><b>Limpieza y abrillantado</b><p>Casco, cubierta e interior a punto, dentro y fuera del agua.</p></div></div>
        </div>
      </section>

      <section className="seccion">
        <div className="sec-head"><h2 className="serif">Por qué elegirnos</h2></div>
        <div className="ref-grid">
          <div className="ref"><BadgeCheck size={20} /><b>Técnicos con experiencia</b><p>Años cuidando embarcaciones de todo tipo, con la misma atención al detalle en cada trabajo.</p></div>
          <div className="ref"><Check size={20} /><b>Presupuesto claro</b><p>Sabrás el coste antes de que toquemos el barco. Sin sorpresas en la factura final.</p></div>
          <div className="ref"><Handshake size={20} /><b>Trato cercano</b><p>Te explicamos qué le pasa a tu barco y por qué, no solo lo arreglamos.</p></div>
        </div>
      </section>

      <section className="seccion">
        <div className="cancel-cta">
          <p>¿Quieres que le echemos un ojo a tu embarcación?</p>
          <a className="btn-primario auto" href={SPEN_MECHANICS_URL} target="_blank" rel="noopener noreferrer">Visitar spenmechanics.com</a>
        </div>
      </section>
    </div>
  );
}

/* ── Ayuda: contacto, FAQ, cancelaciones ────────────────────────────── */
function Ayuda({ seccion, onCambiar, usuario, onIrPanel, onAbrirAuth }) {
  return (
    <div className="ventajas ayuda">
      <section className="v-hero" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.92) 0%, rgba(15,39,50,.75) 55%, rgba(18,48,61,.55) 100%), url(${MARINA_FOTO})` }}>
        <span className="eyebrow claro">Ayuda</span>
        <h1 className="serif v-h1">Estamos para ayudarte</h1>
        <p className="v-sub">Escríbenos, resuelve tus dudas o consulta cómo funcionan las cancelaciones.</p>
      </section>

      <div className="ayuda-tabs">
        <button className={seccion === "contacto" ? "at on" : "at"} onClick={() => onCambiar("contacto")}><MessageCircle size={16} /> Contacto</button>
        <button className={seccion === "faq" ? "at on" : "at"} onClick={() => onCambiar("faq")}><HelpCircle size={16} /> Preguntas frecuentes</button>
        <button className={seccion === "cancelaciones" ? "at on" : "at"} onClick={() => onCambiar("cancelaciones")}><RotateCcw size={16} /> Cancelaciones</button>
      </div>

      {seccion === "contacto" && <AyudaContacto onVerFAQ={() => onCambiar("faq")} />}
      {seccion === "faq" && <AyudaFAQ />}
      {seccion === "cancelaciones" && <AyudaCancelaciones usuario={usuario} onIrPanel={onIrPanel} onAbrirAuth={onAbrirAuth} />}
    </div>
  );
}

function AyudaContacto({ onVerFAQ }) {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [asunto, setAsunto] = useState("Reserva");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);
  const falta = !nombre.trim() || !email.trim() || !mensaje.trim();

  if (enviado) return (
    <section className="seccion">
      <div className="ok centro">
        <div className="ok-icon"><Check size={28} strokeWidth={3} /></div>
        <h3 className="serif">¡Mensaje enviado!</h3>
        <p>Gracias, {nombre.trim().split(" ")[0]}. Te responderemos a {email} en menos de 24 h laborables.</p>
      </div>
    </section>
  );

  return (
    <section className="seccion ayuda-contacto">
      <div className="contacto-grid">
        <div className="contacto-info">
          <div className="fid"><Mail size={20} /><div><b>Escríbenos</b><p><a className="link-inline" href="mailto:soporte@yachtoday.com">soporte@yachtoday.com</a></p></div></div>
          <div className="fid"><Clock size={20} /><div><b>Horario</b><p>Lunes a viernes, 9:00–19:00. Respondemos en menos de 24 h laborables.</p></div></div>
          <div className="fid"><HelpCircle size={20} /><div><b>¿Duda rápida?</b><p>Consulta antes las <button type="button" className="link-inline" onClick={onVerFAQ}>preguntas frecuentes</button>, puede que ya tengan la respuesta.</p></div></div>
        </div>
        <form className="form contacto-form" onSubmit={(e) => { e.preventDefault(); if (!falta) setEnviado(true); }}>
          <Fila>
            <label className="field"><span>Nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" /></label>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></label>
          </Fila>
          <label className="field"><span>Asunto</span><select value={asunto} onChange={(e) => setAsunto(e.target.value)}>{["Reserva", "Publicar mi barco", "Pagos y facturación", "Cancelación", "Otro"].map((o) => <option key={o}>{o}</option>)}</select></label>
          <label className="field"><span>Mensaje</span><textarea rows={5} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Cuéntanos en qué podemos ayudarte" /></label>
          <button className="btn-primario ancho" disabled={falta}>Enviar mensaje</button>
        </form>
      </div>
    </section>
  );
}

function AyudaFAQ() {
  const [abierta, setAbierta] = useState("Reservar-0");
  return (
    <section className="seccion ayuda-faq">
      {FAQ.map((grupo) => (
        <div key={grupo.cat} className="faq-grupo">
          <h3 className="serif faq-cat">{grupo.cat}</h3>
          <div className="faq-lista">
            {grupo.preguntas.map((qa, i) => {
              const key = `${grupo.cat}-${i}`;
              const abierto = abierta === key;
              return (
                <div key={key} className={`faq-item ${abierto ? "on" : ""}`}>
                  <button type="button" className="faq-p" onClick={() => setAbierta(abierto ? null : key)}>
                    <span>{qa.p}</span><ChevronDown size={18} className="faq-chevron" />
                  </button>
                  {abierto && <p className="faq-r">{qa.r}</p>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function AyudaCancelaciones({ usuario, onIrPanel, onAbrirAuth }) {
  return (
    <section className="seccion ayuda-cancel">
      <div className="sec-head"><h2 className="serif">Cómo funcionan las cancelaciones</h2></div>
      <p className="cancel-intro">La misma política aplica a barcos, experiencias y material náutico. El reembolso se calcula sobre el importe total pagado (tarifa del propietario + gastos de servicio).</p>
      <div className="cancel-tabla">
        {CANCELACION_TRAMOS.map((t) => (
          <div key={t.cuando} className="cancel-fila">
            <span className="cancel-cuando">{t.cuando}</span>
            <span className="cancel-reembolso">{t.reembolso}</span>
            <span className="cancel-nota">{t.nota}</span>
          </div>
        ))}
      </div>

      <div className="fidelidad">
        <div className="fid"><ShieldCheck size={20} /><div><b>Si cancela el propietario</b><p>Reembolso del 100% siempre, sea cual sea la antelación. Si ocurre a menos de 48 h de la salida, te ayudamos a buscar una alternativa similar.</p></div></div>
        <div className="fid"><CloudRain size={20} /><div><b>Mal tiempo o alerta marítima</b><p>Si Puertos del Estado o Capitanía Marítima desaconsejan la salida, la reserva se reembolsa al 100% o se reprograma sin coste.</p></div></div>
        <div className="fid"><RotateCcw size={20} /><div><b>El reembolso tarda</b><p>De 3 a 5 días laborables en llegar a tu método de pago original.</p></div></div>
        <div className="fid"><Clock size={20} /><div><b>Antelación mínima</b><p>Toda reserva exige un mínimo de antelación (3 h para barcos y material, 24 h para experiencias, o el mínimo que fije el propietario) y nunca puede empezar antes de pasado mañana si se reserva de madrugada o de noche (22:00–8:00). Así el propietario siempre tiene tiempo de prepararse.</p></div></div>
      </div>

      <div className="cancel-cta">
        <p>¿Tienes una reserva próxima? Gestiona su cancelación desde tu panel.</p>
        <button className="btn-primario auto" onClick={usuario ? onIrPanel : () => onAbrirAuth("entrar")}>{usuario ? "Ir a mis reservas" : "Entrar para ver mis reservas"}</button>
      </div>
    </section>
  );
}

/* ── Publicar ────────────────────────────────────────────────────── */
const PATRON_OPTS = [["No, sin patrón", "no"], ["Opcional", "opcional"], ["Siempre con patrón", "incluido"]];
function Publicar({ usuario, onDone, onPublicado }) {
  const [clase, setClase] = useState("barco");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [act, setAct] = useState(ACTIVIDADES[0]);
  const [matTipo, setMatTipo] = useState(MATERIALES[0]);
  const [zonaPub, setZonaPub] = useState(ZONAS[1]);
  const [puerto, setPuerto] = useState("");
  const [plazas, setPlazas] = useState("");
  const [duracion, setDuracion] = useState("");
  const [eslora, setEslora] = useState("");
  const [potencia, setPotencia] = useState("");
  const [lista, setLista] = useState("7ª");
  const [patron, setPatron] = useState("opcional");
  const [horaPrecio, setHoraPrecio] = useState("");
  const [precio, setPrecio] = useState(350);
  const [descripcion, setDescripcion] = useState("");
  const [fotos, setFotos] = useState([]);
  const fotosInputRef = useRef(null);
  const [documentos, setDocumentos] = useState([]);
  const documentosInputRef = useRef(null);
  const [matricula, setMatricula] = useState("");
  const [poliza, setPoliza] = useState("");
  const [caducidadSeguro, setCaducidadSeguro] = useState("");
  const [fianzaMat, setFianzaMat] = useState("");
  const hoyISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [avisoHoras, setAvisoHoras] = useState("");
  const [equipoSel, setEquipoSel] = useState([]);
  const [equipoCustom, setEquipoCustom] = useState([]);
  const [equipoNuevo, setEquipoNuevo] = useState("");
  const [consiento, setConsiento] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorPublicar, setErrorPublicar] = useState("");
  const { estado: verificacion, iniciar: iniciarVerificacion } = useVerificacionAutomatica();
  const previews = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  /* Hay que copiar los archivos ANTES de vaciar el input. React ejecuta la función que se
     le pasa a setState más tarde, al renderizar; si dentro de ella se lee `e.target.files`,
     para entonces el `e.target.value = ""` de la línea siguiente ya lo ha vaciado y se
     añaden cero archivos. Por eso la subida de fotos no funcionó nunca. */
  const agregarFotos = (e) => {
    const nuevas = Array.from(e.target.files || []);
    e.target.value = "";
    setFotos((p) => [...p, ...nuevas].slice(0, 6));
  };
  const quitarFoto = (i) => setFotos((p) => p.filter((_, idx) => idx !== i));
  const agregarDocumentos = (e) => {
    const nuevos = Array.from(e.target.files || []);
    e.target.value = "";
    setDocumentos((p) => [...p, ...nuevos].slice(0, 4));
  };
  const quitarDocumento = (i) => setDocumentos((p) => p.filter((_, idx) => idx !== i));
  useEffect(() => setEquipoSel([]), [clase]);
  const agregarEquipoCustom = () => {
    const v = equipoNuevo.trim();
    if (v && !equipoCustom.includes(v)) setEquipoCustom((p) => [...p, v]);
    setEquipoNuevo("");
  };
  const esExp = clase === "experiencia", esMat = clase === "material";
  const uni = esExp ? "persona" : "día";
  const clientePaga = Math.round(precio * (1 + COMISION));
  const tuComision = clientePaga - precio;
  const seguroCaducado = caducidadSeguro && caducidadSeguro < hoyISO;
  /* Un kayak o una tabla de paddle surf no tienen seguro ni matrícula: no se les pide
     documentación ninguna. A cambio, su dueño fija la fianza en euros — el 20 % de un
     alquiler de 15 € serían 3 €, que no cubren perder el material. */
  /* Al menos una foto: un anuncio sin fotos sale con un dibujo genérico y no lo reserva
     nadie. Se permitía publicar sin ninguna y así se publicó el primer anuncio real. */
  const faltanFotos = fotos.length === 0;
  const faltaDocumentacion = faltanFotos || (esMat
    ? !(+fianzaMat > 0)
    : !consiento || !poliza.trim() || !caducidadSeguro || seguroCaducado || (!esExp && !matricula.trim()));

  const publicar = () => {
    if (faltaDocumentacion) return;
    iniciarVerificacion(async () => {
      setEnviando(true);
      setErrorPublicar("");
      try {
        const urlsFotos = fotos.length ? await subirFotos(usuario.id, fotos) : [];
        /* El material no tiene seguro ni matrícula: no se le sube documentación ninguna. */
        const rutasDocumentos = !esMat && documentos.length ? await subirDocumentos(usuario.id, documentos) : [];
        const base = {
          clase, propietario_id: usuario.id,
          nombre: nombre.trim() || (esExp ? "Tu experiencia" : esMat ? "Tu material" : "Tu barco"),
          puerto: puerto.trim(), zona: zonaPub, descripcion: descripcion.trim(), fotos: urlsFotos,
          estado: "En revisión",
          aviso_minimo_horas: +avisoHoras > 0 ? +avisoHoras : null,
          equipamiento: [...equipoSel, ...equipoCustom],
        };
        const conSeguro = { poliza: poliza.trim(), caducidad_seguro: caducidadSeguro, documentos: rutasDocumentos };
        const payload = esExp
          ? { ...base, ...conSeguro, actividad: act, plazas: +plazas || null, duracion: duracion.trim(), persona: precio, anfitrion: usuario.nombre }
          : esMat
            ? { ...base, tipo: matTipo, hora: +horaPrecio || null, dia: precio, fianza: +fianzaMat }
            : { ...base, ...conSeguro, tipo, eslora: +eslora || null, plazas: +plazas || null, potencia: +potencia || null, lista, patron, hora: +horaPrecio || null, dia: precio, matricula: matricula.trim() };
        const creado = await crearAnuncio(payload);
        onPublicado(creado);
        setEnviado(true);
      } catch (err) {
        setErrorPublicar(err.message || "No se ha podido publicar. Inténtalo de nuevo.");
      } finally {
        setEnviando(false);
      }
    });
  };

  if (enviado) return (<div className="publicar"><div className="ok centro"><div className="ok-icon"><Check size={28} strokeWidth={3} /></div><h3 className="serif">¡Recibido!</h3><p>Documentación recibida. Un revisor de Yacht Today la comprobará antes de publicarlo. Lo tienes en <strong>Mis anuncios</strong>.</p><button className="btn-primario ancho" onClick={onDone}>Ir a mi panel</button></div></div>);

  return (
    <div className="publicar">
      <span className="eyebrow">Para propietarios</span>
      <h1 className="serif pub-titulo">Pon lo tuyo a trabajar</h1>
      <p className="pub-sub">Publicar es gratis. Los gastos de servicio los paga quien alquila; tú recibes tu tarifa íntegra y sumas para el programa "Cuida tu Barco".</p>
      <div className="clase-pub">
        {[["barco", "Un barco", Ship], ["experiencia", "Una experiencia", Sparkles], ["material", "SUP o kayak", Wind]].map(([v, t, Ic]) => (
          <button key={v} className={clase === v ? "cp on" : "cp"} onClick={() => setClase(v)}><Ic size={18} /> {t}</button>
        ))}
      </div>
      <div className="pub-grid">
        <div className="form">
          {esExp ? (
            <>
              <Fila><label className="field"><span>Título de la experiencia</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Jornada de pesca al curricán" /></label><label className="field"><span>Actividad</span><select value={act} onChange={(e) => setAct(e.target.value)}>{ACTIVIDADES.map((o) => <option key={o}>{o}</option>)}</select></label></Fila>
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><label className="field"><span>Punto de salida</span><input value={puerto} onChange={(e) => setPuerto(e.target.value)} placeholder="Grao de Castellón" /></label></Fila>
              <Fila><label className="field"><span>Plazas</span><input type="number" value={plazas} onChange={(e) => setPlazas(e.target.value)} placeholder="5" /></label><label className="field"><span>Duración</span><input value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="4 h" /></label></Fila>
              <label className="field"><span>Precio / persona (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label>
            </>
          ) : esMat ? (
            <>
              <Fila><label className="field"><span>Nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tabla SUP hinchable 10'6&quot;" /></label><label className="field"><span>Tipo</span><select value={matTipo} onChange={(e) => setMatTipo(e.target.value)}>{MATERIALES.map((o) => <option key={o}>{o}</option>)}</select></label></Fila>
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><label className="field"><span>Entrega / playa</span><input value={puerto} onChange={(e) => setPuerto(e.target.value)} placeholder="Peñíscola" /></label></Fila>
              <Fila><label className="field"><span>Precio / hora (€)</span><input type="number" value={horaPrecio} onChange={(e) => setHoraPrecio(e.target.value)} placeholder="12" /></label><label className="field"><span>Precio / día (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label></Fila>
            </>
          ) : (
            <>
              <Fila><label className="field"><span>Nombre del barco</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lagoon 42 Catamarán" /></label><label className="field"><span>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((o) => <option key={o}>{o}</option>)}</select></label></Fila>
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><label className="field"><span>Puerto base</span><input value={puerto} onChange={(e) => setPuerto(e.target.value)} placeholder="Puerto de Mahón, Menorca" /></label></Fila>
              <Fila><label className="field"><span>Eslora (m)</span><input type="number" value={eslora} onChange={(e) => setEslora(e.target.value)} placeholder="12.6" /></label><label className="field"><span>Plazas</span><input type="number" value={plazas} onChange={(e) => setPlazas(e.target.value)} placeholder="10" /></label></Fila>
              <Fila><label className="field"><span>Potencia (cv)</span><input type="number" value={potencia} onChange={(e) => setPotencia(e.target.value)} placeholder="150" /></label><Select label="Lista (matrícula)" opts={["6ª", "7ª"]} value={lista} onChange={setLista} /></Fila>
              <label className="field"><span>¿Ofreces patrón?</span><select value={patron} onChange={(e) => setPatron(e.target.value)}>{PATRON_OPTS.map(([t, v]) => <option key={v} value={v}>{t}</option>)}</select></label>
              <Fila><label className="field"><span>Precio / hora (€)</span><input type="number" value={horaPrecio} onChange={(e) => setHoraPrecio(e.target.value)} placeholder="180" /></label><label className="field"><span>Precio / día (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label></Fila>
            </>
          )}
          <label className="field"><span>Descripción</span><textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cuenta qué lo hace especial…" /></label>
          <input ref={fotosInputRef} type="file" accept="image/*" multiple hidden onChange={agregarFotos} />
          <button type="button" className="fotos-drop" onClick={() => fotosInputRef.current?.click()}><Plus size={16} /> {fotos.length ? "Añadir más fotos" : "Añadir fotos (obligatorio)"}</button>
          {faltanFotos && <p className="mini-nota">Sube al menos una foto. Sin fotos, tu anuncio sale con un dibujo genérico y prácticamente nadie lo reserva.</p>}
          {fotos.length > 0 && (
            <div className="fotos-previews">
              {previews.map((src, i) => (
                <div key={src} className="fotos-preview">
                  <img src={src} alt={`Foto ${i + 1}`} />
                  <button type="button" className="fotos-preview-x" onClick={() => quitarFoto(i)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="equipo-pub">
            <span>Equipamiento y servicios</span>
            <div className="equipo-check-grid">
              {EQUIPAMIENTO_TIPICO[clase].map((op) => (
                <label key={op} className="check">
                  <input type="checkbox" checked={equipoSel.includes(op)} onChange={(e) => setEquipoSel((p) => e.target.checked ? [...p, op] : p.filter((x) => x !== op))} />
                  {op}
                </label>
              ))}
            </div>
            <Fila>
              <div className="field"><input value={equipoNuevo} onChange={(e) => setEquipoNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarEquipoCustom(); } }} placeholder="Añade lo tuyo (p. ej. Barbacoa a bordo)" /></div>
              <button type="button" className="btn-sec sm" onClick={agregarEquipoCustom} style={{ alignSelf: "flex-start" }}>Añadir</button>
            </Fila>
            {equipoCustom.length > 0 && (
              <div className="equipo-chips">
                {equipoCustom.map((c) => (
                  <span key={c} className="equipo-chip">{c} <button type="button" onClick={() => setEquipoCustom((p) => p.filter((x) => x !== c))}><X size={12} /></button></span>
                ))}
              </div>
            )}
          </div>

          <label className="field">
            <span>Antelación mínima para reservar (horas, opcional)</span>
            <input type="number" min={0} value={avisoHoras} onChange={(e) => setAvisoHoras(e.target.value)} placeholder={esExp ? "24 (por defecto)" : "3 (por defecto)"} />
          </label>
          <p className="mini-nota">Déjalo en blanco para usar el mínimo estándar. Da igual lo que pongas: si un cliente reserva entre las 22:00 y las 8:00, nunca podrá empezar antes de pasado mañana — es una norma de seguridad de la plataforma que no se puede desactivar.</p>

          {esMat ? (
            <>
              <h3 className="serif bloque-tit">Fianza</h3>
              <label className="field">
                <span>Fianza en euros</span>
                <input type="number" min={0} value={fianzaMat} onChange={(e) => setFianzaMat(e.target.value)} placeholder="300" />
              </label>
              <p className="mini-nota">Se le retiene al cliente al reservar y se le devuelve cuando tú das el alquiler por terminado. Pon lo que te costaría reponer el material si te lo pierden o te lo rompen, no un porcentaje del alquiler.</p>
            </>
          ) : (
            <>
              <h3 className="serif bloque-tit">Documentación y verificación</h3>
              {!esExp && <label className="field"><span>Número de matrícula</span><input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="7ª-CS-1234-56" /></label>}
              <Fila>
                <label className="field"><span>Aseguradora y nº de póliza</span><input value={poliza} onChange={(e) => setPoliza(e.target.value)} placeholder="Mapfre 123456789" /></label>
                <label className="field"><span>Caducidad del seguro</span><input type="date" min={hoyISO} value={caducidadSeguro} onChange={(e) => setCaducidadSeguro(e.target.value)} /></label>
              </Fila>
              {seguroCaducado && <p className="mini-nota mini-nota-error">Esa fecha ya ha pasado — necesitamos la caducidad de un seguro en vigor.</p>}
              <input ref={documentosInputRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={agregarDocumentos} />
              <button type="button" className="fotos-drop" onClick={() => documentosInputRef.current?.click()}><Plus size={16} /> {documentos.length ? "Añadir más documentos" : "Adjuntar documentación (matrícula, póliza…)"}</button>
              {documentos.length > 0 && (
                <div className="equipo-chips">
                  {documentos.map((f, i) => (
                    <span key={`${f.name}-${i}`} className="equipo-chip"><FileText size={12} /> {f.name} <button type="button" onClick={() => quitarDocumento(i)}><X size={12} /></button></span>
                  ))}
                </div>
              )}
              <p className="mini-nota">Un revisor de Yacht Today comprobará estos documentos antes de publicar el anuncio — no existe ningún registro público en España para verificarlos de forma automática.</p>
              <ConsentimientoLegal checked={consiento} onChange={setConsiento} texto="la documentación de este anuncio (matrícula, póliza y certificados)" />
            </>
          )}

          {errorPublicar && <p className="auth-error">{errorPublicar}</p>}
          <button className="btn-primario ancho" onClick={publicar} disabled={faltaDocumentacion || verificacion === "verificando" || enviando}>
            {verificacion === "verificando" || enviando ? "Enviando…" : "Publicar"}
          </button>
          {faltaDocumentacion && <p className="mini-nota">{esMat ? "Pon una fianza mayor que cero para poder publicar." : "Completa la documentación y acepta el tratamiento de datos para poder publicar."}</p>}
        </div>
        <aside className="ganancias">
          <span className="eyebrow claro">Con precio de {eur(precio)}/{uni}</span>
          <div className="gan-linea"><span>El cliente paga</span><span className="precio blanco"><b>{eur(clientePaga)}</b></span></div>
          <div className="gan-detalle"><div><span>Tu tarifa</span><span>{eur(precio)}</span></div><div className="gan-com"><span>Gastos de servicio ({COMISION * 100}%)</span><span>{eur(tuComision)}</span></div></div>
          <div className="gan-total"><span>Tú recibes</span><span className="precio verde"><b>{eur(precio)}</b></span></div>
          <p className="gan-nota">Los {eur(tuComision)} de servicio son lo que gana Yacht Today, sin tocar tu tarifa.</p>
        </aside>
      </div>
    </div>
  );
}
const Fila = ({ children }) => <div className="fila">{children}</div>;
const Select = ({ label, opts, value, onChange }) => (<label className="field"><span>{label}</span><select value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>);

/* ── Consentimiento de datos (RGPD) ──────────────────────────────── */
function ConsentimientoLegal({ checked, onChange, texto }) {
  return (
    <label className="consentimiento">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>He leído y acepto que Yacht Today trate {texto} exclusivamente para verificar {texto.includes("licencia") ? "esta reserva" : "este anuncio"}, conforme al RGPD (Reglamento UE 2016/679). No se cederán a terceros salvo obligación legal, y puedo pedir su supresión escribiendo a soporte@yachtoday.com.</span>
    </label>
  );
}

/* Verificación automática simulada: no existe una API pública en España para
   comprobar licencias de navegación o matrículas contra un registro oficial,
   así que este paso queda a la espera de un servicio de verificación real
   (o revisión manual de Yacht Today) más adelante. */
function useVerificacionAutomatica() {
  const [estado, setEstado] = useState("idle"); // idle | verificando | verificado
  const iniciar = (callback) => {
    setEstado("verificando");
    setTimeout(() => { setEstado("verificado"); callback && callback(); }, 1400);
  };
  return { estado, iniciar };
}

/* ── App ─────────────────────────────────────────────────────────── */
export default function App() {
  const [vista, setVista] = useState("home");
  const [item, setItem] = useState(null);
  const [clase, setClase] = useState("todo");
  const [tipo, setTipo] = useState(null);
  const [zona, setZona] = useState("Todas");
  const [soloPatron, setSoloPatron] = useState(false);
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [auth, setAuth] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [misBarcos, setMisBarcos] = useState([]);
  const [reservasRecibidas, setReservasRecibidas] = useState([]);
  const [favoritos, setFavoritos] = useState([]);
  const [cancelando, setCancelando] = useState(null);
  const [especificando, setEspecificando] = useState(null);
  const [cancelandoProp, setCancelandoProp] = useState(null);
  const [avisosPropietario, setAvisosPropietario] = useState(0);
  const [resenando, setResenando] = useState(null);
  const [eliminandoAnuncio, setEliminandoAnuncio] = useState(null);
  const [errorEliminarAnuncio, setErrorEliminarAnuncio] = useState("");
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [anuncios, setAnuncios] = useState([]);
  const [cargandoAnuncios, setCargandoAnuncios] = useState(true);
  const [anunciosRevision, setAnunciosRevision] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [errorCobros, setErrorCobros] = useState("");
  const esAdmin = usuario?.email === ADMIN_EMAIL;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setUsuario(usuarioDeSesion(data.session)); setCargandoSesion(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, session) => setUsuario(usuarioDeSesion(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    listarAnunciosPublicados().then(setAnuncios).catch(console.error).finally(() => setCargandoAnuncios(false));
  }, []);

  /* yachtoday.com/propietarios entra directo en la página de propietarios: es el enlace
     que se manda a los dueños de barcos, y la portada está escrita para el cliente. */
  useEffect(() => {
    if (window.location.pathname.replace(/\/$/, "") === "/propietarios") setVista("propietarios");
  }, []);

  useEffect(() => {
    if (!usuario) return;
    listarMisAnuncios(usuario.id).then(setMisBarcos).catch(console.error);
    listarMisReservas(usuario.id).then(setReservas).catch(console.error);
    listarReservasRecibidas(usuario.id).then(setReservasRecibidas).catch(console.error);
  }, [usuario?.id]);

  useEffect(() => {
    if (!esAdmin) return;
    listarAnunciosEnRevision().then(setAnunciosRevision).catch(console.error);
  }, [esAdmin]);

  const revisarAnuncio = async (anuncio, estado) => {
    await cambiarEstadoAnuncio(anuncio.id, estado);
    setAnunciosRevision((p) => p.filter((a) => a.id !== anuncio.id));
    if (estado === "Publicado") setAnuncios((p) => [{ ...anuncio, estado }, ...p]);
  };

  const verDocumento = async (ruta) => {
    try {
      const url = await urlFirmadaDocumento(ruta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMensaje({ tipo: "error", texto: "No se ha podido abrir el documento." });
    }
  };

  // Vuelta desde Stripe (pago de una reserva, o alta de cobros de un propietario).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get("pago");
    const stripe = params.get("stripe");
    if (!pago && !stripe) return;
    window.history.replaceState(null, "", window.location.pathname);

    if (pago === "exito") {
      setMensaje({ tipo: "ok", texto: "Pago recibido. Confirmando tu reserva…" });
      setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          const u = usuarioDeSesion(data.session);
          if (u) listarMisReservas(u.id).then(setReservas).catch(console.error);
        });
        setMensaje({ tipo: "ok", texto: "¡Reserva confirmada! Ya la tienes en tu panel." });
      }, 2500);
    } else if (pago === "cancelado") {
      setMensaje({ tipo: "info", texto: "Has cancelado el pago. No se te ha cobrado nada." });
    } else if (stripe === "vuelta") {
      supabase.auth.refreshSession();
      setMensaje({ tipo: "ok", texto: "Datos de cobro guardados en Stripe." });
    }
  }, []);

  const conectarStripe = async () => {
    setErrorCobros("");
    try {
      const url = await conectarCobros();
      window.location.href = url;
    } catch (err) {
      setErrorCobros(err.message || "No se ha podido conectar con Stripe.");
    }
  };

  const ir = (v) => { setVista(v); setMenu(false); window.scrollTo(0, 0); };
  const abrir = (x) => { setItem(x); setVista("ficha"); setMenu(false); window.scrollTo(0, 0); };
  const abrirAuth = (tab = "entrar", rolPre = null, pendiente = null) => { setAuth({ tab, rolPre, pendiente }); setMenu(false); };
  const completarAuth = () => { const p = auth?.pendiente; setAuth(null); if (p === "publicar") { setVista("publicar"); window.scrollTo(0, 0); } else if (p !== "reservar") { setVista("panel"); window.scrollTo(0, 0); } };
  const cerrarSesion = async () => { await supabase.auth.signOut(); setReservas([]); setMisBarcos([]); setReservasRecibidas([]); setFavoritos([]); setAvisosPropietario(0); ir("home"); };
  const irPublicar = () => (usuario ? ir("publicar") : abrirAuth("registro", "propietario", "publicar"));
  const setClaseReset = (c) => { setClase(c); setTipo(null); };
  const abrirCategoria = (c) => { setClase(c.clase); setTipo(c.key); setSoloPatron(false); ir("explorar"); };
  const toggleFav = (b) => setFavoritos((p) => (p.find((x) => x.id === b.id) ? p.filter((x) => x.id !== b.id) : [b, ...p]));
  const confirmarCancelacion = () => {
    actualizarReserva(cancelando.id, { estado: "cancelada" }).catch(console.error);
    setReservas((p) => p.filter((r) => r.id !== cancelando.id));
    setCancelando(null);
  };
  const finalizarReservaRecibida = (id) => {
    setReservasRecibidas((p) => {
      const r = p.find((x) => x.id === id);
      if (!r) return p;
      const fianzaEstado = r.fianzaEstado ? "liberada" : r.fianzaEstado;
      actualizarReserva(id, { estado: "finalizada", ...(fianzaEstado ? { fianza_estado: fianzaEstado } : {}) }).catch(console.error);
      return p.map((x) => (x.id === id ? { ...x, estado: "finalizada", fianzaEstado } : x));
    });
  };
  const guardarEspecificaciones = (id, motorModelo, motorNotas) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, motorModelo, motorNotas } : b)));
  const guardarResena = (estrellas, comentario) => {
    actualizarReserva(resenando.id, { estado: "finalizada", resena_estrellas: estrellas, resena_comentario: comentario || null }).catch(console.error);
    setReservas((p) => p.map((r) => (r.id === resenando.id ? { ...r, estado: "finalizada", resena: { estrellas, comentario } } : r)));
    setResenando(null);
  };
  const confirmarCancelacionPropietario = (justificado) => {
    actualizarReserva(cancelandoProp.id, { estado: "cancelada" }).catch(console.error);
    setReservasRecibidas((p) => p.filter((r) => r.id !== cancelandoProp.id));
    if (!justificado) setAvisosPropietario((p) => p + 1);
    setCancelandoProp(null);
  };
  const activarUltimaHora = (id, descuento) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, ultimaHora: { activo: true, descuento } } : b)));
  const desactivarUltimaHora = (id) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, ultimaHora: { activo: false, descuento: 0 } } : b)));
  const confirmarEliminarAnuncio = async () => {
    setErrorEliminarAnuncio("");
    try {
      await eliminarAnuncio(eliminandoAnuncio.id);
      setMisBarcos((p) => p.filter((b) => b.id !== eliminandoAnuncio.id));
      setEliminandoAnuncio(null);
    } catch (err) {
      setErrorEliminarAnuncio(err.message || "No se ha podido eliminar el anuncio. Inténtalo de nuevo.");
    }
  };
  const quitarFiltros = () => { setClaseReset("todo"); setZona("Todas"); setSoloPatron(false); setQ(""); };

  const subChips = clase === "experiencia" ? ACTIVIDADES : clase === "material" ? MATERIALES : clase === "barco" ? TIPOS : null;

  const filtrados = useMemo(() => anuncios.filter((x) => {
    if (clase !== "todo" && x.clase !== clase) return false;
    if (zona !== "Todas" && x.zona !== zona) return false;
    if (tipo) { const key = x.clase === "experiencia" ? x.actividad : x.tipo; if (key !== tipo) return false; }
    if (soloPatron && (x.clase !== "barco" || x.patron === "no")) return false;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      const campos = [x.nombre, x.puerto, x.zona, x.tipo, x.actividad].filter(Boolean).join(" ").toLowerCase();
      if (!campos.includes(t)) return false;
    }
    return true;
  }), [anuncios, clase, tipo, zona, soloPatron, q]);

  return (
    <div className="app">
      <style>{CSS}</style>
      {mensaje && (
        <div className={`banner-flot ${mensaje.tipo === "ok" ? "banner-ok" : "banner-info"}`}>
          <span>{mensaje.texto}</span>
          <button onClick={() => setMensaje(null)}><X size={15} /></button>
        </div>
      )}
      <div className="ribbon">Cuanto más navegas, más ganas · El barco es de otro, el día es tuyo</div>

      <header className="nav">
        <button className="marca" onClick={() => ir("home")}><LogoYachtToday /><span className="marca-txt"><span className="serif wordmark">Yacht Today</span><span className="marca-tag">Alquila el mar</span></span></button>
        <nav className={`links ${menu ? "abierto" : ""}`}>
          <button onClick={() => { setClaseReset("barco"); setSoloPatron(false); ir("explorar"); }}>Embarcaciones</button>
          <button onClick={() => { setClaseReset("experiencia"); ir("explorar"); }}>Experiencias</button>
          <button onClick={() => ir("ventajas")}>Ventajas</button>
          <button onClick={irPublicar}>Publica lo tuyo</button>
          {cargandoSesion ? null : usuario ? (<><button className="perfil-link" onClick={() => ir("panel")}><span className="avatar-mini">{iniciales(usuario.nombre)}</span> Mi panel</button><button className="btn-salir" onClick={cerrarSesion}><LogOut size={16} /></button></>)
            : <button className="btn-entrar" onClick={() => abrirAuth("entrar")}>Entrar</button>}
        </nav>
        <button className="hamburguesa" onClick={() => setMenu((m) => !m)}>{menu ? <X size={22} /> : <Menu size={22} />}</button>
      </header>

      {vista === "home" && (
        <>
          <section className="hero">
            <div className="hero-foto" style={{ backgroundImage: `linear-gradient(180deg, rgba(15,39,50,.35) 0%, rgba(15,39,50,.55) 55%, rgba(15,39,50,.88) 100%), url(${HERO_FOTO})` }} />
            <div className="hero-txt"><span className="eyebrow claro">Del Mediterráneo al Atlántico</span><h1 className="serif hero-h1">El mar, a tu manera</h1><p className="hero-p">Yates, veleros, lanchas, experiencias de pesca o buceo, y hasta un kayak. Con o sin patrón, reserva en minutos.</p></div>
            <div className="buscador">
              <div className="b-campo"><span className="b-lab">Dónde</span><select value={zona} onChange={(e) => setZona(e.target.value)}>{ZONAS.map((z) => <option key={z}>{z === "Todas" ? "Toda España" : z}</option>)}</select></div>
              <div className="b-campo"><span className="b-lab">Qué</span><select onChange={(e) => setClaseReset(e.target.value)}><option value="todo">Todo</option><option value="barco">Barcos</option><option value="experiencia">Experiencias</option><option value="material">SUP y kayak</option></select></div>
              <div className="b-campo"><span className="b-lab">Cuándo</span><input type="date" defaultValue="2026-07-12" /></div>
              <button className="b-btn" onClick={() => ir("explorar")}><Search size={18} /> Buscar</button>
            </div>
          </section>

          <section className="seccion">
            <div className="sec-head"><h2 className="serif">Explora por categoría</h2><button className="link-mas" onClick={() => { setClaseReset("todo"); ir("explorar"); }}>Ver todo →</button></div>
            <div className="cat-grid">{CATEGORIAS.map((c) => (<button key={c.t} className="cat" style={{ backgroundImage: `linear-gradient(180deg, rgba(15,39,50,.15) 0%, rgba(15,39,50,.55) 65%, rgba(15,39,50,.88) 100%), url(${CATEGORIA_FOTOS[c.t]})` }} onClick={() => abrirCategoria(c)}><span className="cat-ico"><c.icon size={20} /></span><span className="cat-t">{c.t}</span><span className="cat-d">{c.d}</span></button>))}</div>
          </section>

          {anuncios.length > 0 ? (
            <section className="seccion">
              <div className="sec-head"><h2 className="serif">Destacados esta semana</h2><button className="link-mas" onClick={() => { setClaseReset("todo"); ir("explorar"); }}>Ver todo →</button></div>
              <div className="grid">{anuncios.slice(0, 4).map((b) => <Tarjeta key={b.id} item={b} onOpen={abrir} />)}</div>
            </section>
          ) : !cargandoAnuncios && (
            <section className="seccion">
              <div className="arranque">
                <span className="eyebrow">Acabamos de zarpar</span>
                <h2 className="serif">Sé el primero en publicar tu barco</h2>
                <p>Yacht Today acaba de abrir y todavía no hay nada publicado. Si tienes un barco, una tabla de paddle surf o quieres llevar a gente a pescar, ahora mismo tendrías tu zona entera para ti.</p>
                <button className="btn-primario auto" onClick={irPublicar}>Publica lo tuyo</button>
                <p className="arranque-nota">Publicar es gratis y recibes tu tarifa íntegra: la comisión del {Math.round(COMISION * 100)} % la paga quien alquila.</p>
              </div>
            </section>
          )}

          <section className="banner-ventajas" onClick={() => ir("ventajas")}>
            <div><span className="eyebrow claro">Novedad · Programa de recompensas</span><h2 className="serif">Cuanto más navegas, más ganas</h2><p>Niveles, insignias y kits de mantenimiento para propietarios. Algo que ninguna otra plataforma te da.</p></div>
            <span className="banner-cta">Descubre las ventajas <ChevronRight size={18} /></span>
          </section>

          <section className="seccion pasos-sec">
            <h2 className="serif centro">Zarpar es sencillo</h2>
            <div className="pasos">
              <Paso n="01" icon={Search} t="Encuentra tu plan" d="Barco, experiencia de pesca o buceo, o un simple kayak. Filtra por zona y tipo." />
              <Paso n="02" icon={Anchor} t="Reserva con o sin patrón" d="Por horas, por días o por persona. Si no tienes titulación, añade patrón o elige una experiencia guiada." />
              <Paso n="03" icon={Waves} t="A navegar y a sumar" d="Disfrutas del mar y cada reserva te acerca a tu siguiente nivel de recompensas." />
            </div>
          </section>

          <section className="cta-prop" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.92) 0%, rgba(15,39,50,.7) 55%, rgba(15,39,50,.4) 100%), url(${MARINA_FOTO})` }}>
            <div><h2 className="serif">¿Tienes un barco, o solo una tabla parada?</h2><p>Publica tu barco, ofrece una experiencia o alquila tu SUP o kayak. Recibes tu tarifa íntegra y ganas ventajas.</p></div>
            <button className="btn-primario auto claro-btn" onClick={irPublicar}>Publica lo tuyo</button>
          </section>
        </>
      )}

      {vista === "explorar" && (
        <section className="explorar">
          <div className="explorar-head"><h1 className="serif">{cargandoAnuncios ? "Cargando…" : !anuncios.length ? "Aún no hay nada publicado" : `${filtrados.length} resultados${zona !== "Todas" ? ` en ${zona}` : " en toda España"}`}</h1><p className="sub">Cancela sin recargo hasta 48 h antes · anfitriones verificados</p></div>
          <div className="buscador-rapido"><Search size={16} /><input type="text" placeholder="Busca por nombre, puerto o zona…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button className="brapido-x" onClick={() => setQ("")}><X size={14} /></button>}</div>
          <div className="clase-seg">{CLASES.map((c) => <button key={c.v} className={clase === c.v ? "cs on" : "cs"} onClick={() => setClaseReset(c.v)}>{c.t}</button>)}</div>
          {subChips && (
            <div className="chips-foto">
              <button className={!tipo ? "cff on" : "cff"} onClick={() => setTipo(null)}><span className="cff-t">Todos</span></button>
              {subChips.map((t) => (
                <button key={t} className={tipo === t ? "cff on" : "cff"} style={{ backgroundImage: `linear-gradient(180deg, rgba(15,39,50,.1) 0%, rgba(15,39,50,.5) 60%, rgba(15,39,50,.88) 100%), url(${(clase === "barco" ? TIPO_FOTOS : ACTIVIDAD_FOTOS)[t]})` }} onClick={() => setTipo(t)}>
                  <span className="cff-t">{t}</span>
                </button>
              ))}
            </div>
          )}
          <div className="filtros-fila"><select value={zona} onChange={(e) => setZona(e.target.value)}>{ZONAS.map((z) => <option key={z}>{z === "Todas" ? "Toda España" : z}</option>)}</select>{(clase === "todo" || clase === "barco") && <label className="check"><input type="checkbox" checked={soloPatron} onChange={(e) => setSoloPatron(e.target.checked)} /> Con patrón</label>}</div>
          {cargandoAnuncios ? <div className="vacio"><Sailboat size={30} /><p>Cargando anuncios…</p></div>
            : filtrados.length ? <div className="grid">{filtrados.map((b) => <Tarjeta key={b.id} item={b} onOpen={abrir} />)}</div>
              : anuncios.length ? <div className="vacio"><Sailboat size={30} /><p>No hay resultados con esos filtros.</p><button className="btn-sec" onClick={quitarFiltros}>Quitar filtros</button></div>
                : <div className="vacio"><Sailboat size={30} /><p>Todavía no hay nada publicado en Yacht Today. Acabamos de abrir.</p><button className="btn-primario auto" onClick={irPublicar}>Sé el primero en publicar</button></div>}
        </section>
      )}

      {vista === "ficha" && item && (<Ficha item={item} usuario={usuario} numReservas={reservas.filter((r) => r.estado === "finalizada").length} onBack={() => ir("explorar")} esFavorito={!!favoritos.find((x) => x.id === item.id)} onToggleFav={toggleFav} onNecesitaCuenta={() => abrirAuth("registro", "cliente", "reservar")} />)}
      {vista === "ventajas" && <Ventajas onExplorar={() => { setClaseReset("todo"); ir("explorar"); }} onPublicar={irPublicar} onMantenimiento={() => ir("mantenimiento")} />}
      {vista === "propietarios" && <Propietarios onPublicar={irPublicar} onVentajas={() => ir("ventajas")} />}
      {vista === "mantenimiento" && <SpenMechanics />}
      {(vista === "contacto" || vista === "faq" || vista === "cancelaciones") && <Ayuda seccion={vista} onCambiar={ir} usuario={usuario} onIrPanel={() => ir("panel")} onAbrirAuth={abrirAuth} />}
      {vista === "publicar" && usuario && <Publicar usuario={usuario} onDone={() => ir("panel")} onPublicado={(b) => setMisBarcos((p) => [b, ...p])} />}
      {vista === "panel" && usuario && (<Panel usuario={usuario} reservas={reservas} misBarcos={misBarcos} reservasRecibidas={reservasRecibidas} avisosPropietario={avisosPropietario} favoritos={favoritos} esAdmin={esAdmin} anunciosRevision={anunciosRevision} onAprobarAnuncio={(a) => revisarAnuncio(a, "Publicado")} onRechazarAnuncio={(a) => revisarAnuncio(a, "Rechazado")} onVerDocumento={verDocumento} onConectarStripe={conectarStripe} errorCobros={errorCobros} onExplorar={() => { setClaseReset("todo"); ir("explorar"); }} onPublicar={irPublicar} onAbrir={abrir} onSalir={cerrarSesion} onVentajas={() => ir("ventajas")} onMantenimiento={() => ir("mantenimiento")} onCancelar={setCancelando} onFinalizar={setResenando} onFinalizarRecibida={finalizarReservaRecibida} onEspecificar={setEspecificando} onCancelarRecibida={setCancelandoProp} onActivarUltimaHora={activarUltimaHora} onDesactivarUltimaHora={desactivarUltimaHora} onEliminarAnuncio={setEliminandoAnuncio} />)}

      {auth && <AuthModal tab={auth.tab} rolPre={auth.rolPre} onClose={() => setAuth(null)} onCambiarTab={(t) => setAuth((a) => ({ ...a, tab: t }))} onAuth={completarAuth} />}
      {cancelando && <CancelarModal reserva={cancelando} onClose={() => setCancelando(null)} onConfirmar={confirmarCancelacion} />}
      {especificando && <EspecificacionesModal barco={especificando} onClose={() => setEspecificando(null)} onGuardar={(modelo, notas) => guardarEspecificaciones(especificando.id, modelo, notas)} />}
      {cancelandoProp && <CancelarPropietarioModal reserva={cancelandoProp} onClose={() => setCancelandoProp(null)} onConfirmar={confirmarCancelacionPropietario} />}
      {resenando && <ResenaModal reserva={resenando} onClose={() => setResenando(null)} onGuardar={guardarResena} />}
      {eliminandoAnuncio && <EliminarAnuncioModal anuncio={eliminandoAnuncio} error={errorEliminarAnuncio} onClose={() => { setEliminandoAnuncio(null); setErrorEliminarAnuncio(""); }} onConfirmar={confirmarEliminarAnuncio} />}

      <footer className="footer" style={{ backgroundImage: `linear-gradient(rgba(15,39,50,.88), rgba(15,39,50,.94)), url(${FOOTER_FOTO})` }}>
        <div className="foot-marca"><LogoYachtToday size={34} /><div><span className="serif wordmark blanco">Yacht Today</span><p className="foot-tag">Alquila el mar · Barcos, experiencias y material náutico entre particulares, en toda España.</p></div></div>
        <div className="foot-cols">
          <div><h4>Explorar</h4><button onClick={() => { setClaseReset("barco"); ir("explorar"); }}>Barcos</button><button onClick={() => { setClaseReset("experiencia"); ir("explorar"); }}>Experiencias</button><button onClick={() => { setClaseReset("material"); ir("explorar"); }}>SUP y kayak</button></div>
          <div><h4>Yacht Today</h4><button onClick={() => ir("ventajas")}>Ventajas</button><button onClick={irPublicar}>Publica lo tuyo</button><button onClick={() => ir("home")}>Cómo funciona</button></div>
          <div><h4>Ayuda</h4><button onClick={() => ir("contacto")}>Contacto</button><button onClick={() => ir("faq")}>Preguntas frecuentes</button><button onClick={() => ir("cancelaciones")}>Cancelaciones</button></div>
        </div>
      </footer>
      <div className="foot-legal">Yacht Today © 2026 · Alquiler náutico entre particulares en toda España</div>
    </div>
  );
}

const Paso = ({ n, icon: Icon, t, d }) => (<div className="paso"><div className="paso-top"><span className="paso-n">{n}</span><Icon size={20} className="paso-i" /></div><h3 className="serif">{t}</h3><p>{d}</p></div>);

/* ── Estilos ─────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600;6..72,700&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
:root{--noche:#16323F;--noche2:#0F2732;--mar:#3E7CA6;--brisa:#7FB2CE;--brisa-suave:#D8E4EA;--arena:#F5EFE4;--arena2:#E7DFCF;--linea:#E3DAC8;--blanco:#fff;--tinta:#16323F;--slate:#4A5862;--muted:#8A8A80;--coral:#D6706A;--oro:#E6C15F;--sage:#7FB39A}
*{box-sizing:border-box;margin:0;padding:0}
.app{font-family:'Hanken Grotesk',system-ui,sans-serif;color:var(--slate);background:var(--arena);min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}
.serif{font-family:'Newsreader',Georgia,serif;color:var(--tinta);font-weight:600;letter-spacing:-.01em;line-height:1.08}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
input,select,textarea{font-family:inherit;font-size:15px;color:var(--tinta)}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--mar)}
.eyebrow.claro{color:var(--brisa)}
:focus-visible{outline:2px solid var(--mar);outline-offset:2px;border-radius:6px}
.ribbon{background:var(--noche);color:var(--brisa);text-align:center;font-size:12.5px;letter-spacing:.03em;padding:9px 16px}

.nav{position:sticky;top:0;z-index:40;display:flex;align-items:center;justify-content:space-between;padding:14px clamp(16px,4vw,52px);background:rgba(245,239,228,.9);backdrop-filter:blur(10px);border-bottom:1px solid var(--linea)}
.marca{display:flex;align-items:center;gap:11px}
.marca-txt{display:flex;flex-direction:column;align-items:flex-start;line-height:1}
.wordmark{font-size:21px;font-weight:600;color:var(--tinta)}.wordmark.blanco{color:var(--arena)}
.marca-tag{font-size:10px;color:var(--muted);letter-spacing:.06em;margin-top:2px}
.links{display:flex;align-items:center;gap:4px}
.links>button{padding:9px 13px;border-radius:9px;font-weight:500;font-size:14.5px;color:var(--slate);display:flex;align-items:center;gap:7px}
.links>button:hover{background:var(--arena2);color:var(--tinta)}
.btn-entrar{background:var(--noche)!important;color:var(--arena)!important;border-radius:999px!important;padding:9px 20px!important}
.btn-entrar:hover{background:var(--noche2)!important}
.perfil-link{font-weight:600!important;color:var(--tinta)!important}
.avatar-mini{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--mar);color:#fff;font-size:11px;font-weight:700}
.btn-salir{color:var(--muted)!important;padding:9px!important}
.hamburguesa{display:none}

.hero{position:relative;margin:clamp(14px,2vw,22px);border-radius:26px;overflow:hidden;background:var(--noche);color:var(--arena);padding:clamp(40px,7vw,74px) clamp(20px,5vw,60px) 0;min-height:clamp(420px,58vw,600px)}
.hero-foto{position:absolute;inset:0;background-size:cover;background-position:center;pointer-events:none}
.hero-txt{position:relative;z-index:2;max-width:660px}
.hero-h1{font-size:clamp(40px,7vw,76px);font-weight:600;color:var(--arena);margin:16px 0 14px}
.hero-p{font-size:clamp(16px,2vw,19px);color:#E4EEF2;max-width:520px}
.buscador{position:relative;z-index:2;display:flex;gap:6px;background:var(--arena);border-radius:16px;padding:8px;margin-top:clamp(32px,5vw,56px);box-shadow:0 26px 60px -24px rgba(0,20,25,.6);flex-wrap:wrap}
.b-campo{display:flex;flex-direction:column;gap:2px;padding:9px 14px;border-radius:11px;flex:1;min-width:130px}
.b-campo:hover{background:var(--arena2)}
.b-lab{font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.04em}
.b-campo select,.b-campo input{border:none;background:none;font-weight:500;font-size:14px;outline:none;width:100%;color:var(--tinta)}
.b-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:var(--noche);color:var(--arena);font-weight:600;padding:0 26px;border-radius:12px;min-height:52px}
.b-btn:hover{background:var(--mar)}

.seccion{max-width:1180px;margin:0 auto;padding:clamp(40px,6vw,68px) clamp(16px,4vw,52px)}
.sec-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:26px;gap:16px;flex-wrap:wrap}
.sec-head h2,.pasos-sec h2{font-size:clamp(26px,3.6vw,36px)}
.serif.centro{text-align:center;margin-bottom:34px}
.link-mas{color:var(--mar);font-weight:600;font-size:15px}.link-mas:hover{color:var(--noche)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(258px,1fr));gap:22px}

.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
.cat{display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:4px;background-color:var(--noche);background-size:cover;background-position:center;border-radius:16px;padding:18px;min-height:172px;text-align:left;transition:transform .16s,box-shadow .16s}
.cat:hover{transform:translateY(-3px);box-shadow:0 16px 34px -22px rgba(22,50,63,.5)}
.cat-ico{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:rgba(245,239,228,.2);color:var(--arena);margin-bottom:6px}
.cat-t{font-family:'Newsreader',serif;font-size:19px;font-weight:600;color:var(--arena)}
.cat-d{font-size:13px;color:#D5E4E9}

.card{display:block;text-align:left;background:var(--blanco);border:1px solid var(--linea);border-radius:20px;overflow:hidden;width:100%;transition:transform .18s,box-shadow .18s}
.card:hover{transform:translateY(-4px);box-shadow:0 24px 46px -24px rgba(22,50,63,.45)}
.foto{position:relative;display:grid;place-items:center;overflow:hidden}
.foto-img{width:100%;height:100%;object-fit:cover}
.foto-sol{position:absolute;top:16px;right:22px;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle,rgba(246,217,140,.9),rgba(235,183,101,0) 70%)}
.foto-tag{position:absolute;left:12px;bottom:12px;background:rgba(15,39,50,.6);color:var(--arena);font-size:11px;padding:4px 11px;border-radius:999px;backdrop-filter:blur(4px)}
.card-body{padding:16px 17px}
.card-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
.card-nombre{font-family:'Newsreader',serif;font-size:18px;font-weight:600;color:var(--tinta);line-height:1.15}
.card-lugar{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:13px;margin-top:3px}
.rating{display:inline-flex;align-items:center;gap:4px;color:var(--tinta);font-size:13px;font-weight:600;white-space:nowrap}
.rating svg{color:var(--oro)}
.card-chips{display:flex;gap:7px;margin:13px 0;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--slate);background:var(--arena);padding:5px 10px;border-radius:999px}
.badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--noche);background:var(--brisa-suave);padding:5px 10px;border-radius:999px;font-weight:600}
.card-precio{display:flex;align-items:baseline;justify-content:space-between;border-top:1px solid var(--linea);padding-top:12px}
.precio{color:var(--tinta)}.precio b{font-family:'Newsreader',serif;font-weight:600;font-size:21px}
.precio small{font-size:13px;color:var(--muted);font-weight:400}.precio.grande b{font-size:30px}
.ver-link{display:inline-flex;align-items:center;gap:2px;color:var(--mar);font-weight:600;font-size:14px}

.pasos-sec{max-width:1080px}
.pasos{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.paso{background:var(--blanco);border:1px solid var(--linea);border-radius:18px;padding:26px}
.paso-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.paso-n{font-family:'Newsreader',serif;font-size:16px;color:var(--mar);font-weight:600}
.paso-i{color:var(--noche)}.paso h3{font-size:20px;margin-bottom:7px}.paso p{font-size:14px;color:var(--slate)}

.banner-ventajas{max-width:1120px;margin:0 auto;padding:clamp(24px,4vw,38px) clamp(20px,4vw,44px);background:linear-gradient(120deg,#16323F,#25566A);color:var(--arena);border-radius:24px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;cursor:pointer;transition:transform .16s}
.banner-ventajas:hover{transform:translateY(-2px)}
.banner-ventajas h2{color:var(--arena);font-size:clamp(22px,3vw,30px);margin:6px 0}
.banner-ventajas p{color:#C4D6DC;max-width:520px}
.banner-cta{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--oro);white-space:nowrap}

.cta-prop{max-width:1120px;margin:clamp(46px,7vw,74px) auto;background-color:var(--noche);background-size:cover;background-position:center;color:var(--arena);border-radius:24px;padding:clamp(28px,5vw,52px);display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap}
.cta-prop h2{font-size:clamp(23px,3vw,31px);color:var(--arena)}.cta-prop p{color:#C4D6DC;margin-top:8px;max-width:480px}
.claro-btn{background:var(--arena)!important;color:var(--noche)!important}.claro-btn:hover{background:var(--brisa)!important}

.btn-primario{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--noche);color:var(--arena);font-weight:600;font-size:15.5px;padding:14px 26px;border-radius:12px;transition:background .15s}
.btn-primario.sm{padding:8px 14px;font-size:13px;border-radius:11px}
.btn-primario:hover{background:var(--mar)}
.btn-primario:disabled{background:var(--linea);color:var(--muted);cursor:not-allowed}
.btn-primario.ancho{width:100%}.btn-primario.auto{width:auto}
.btn-sec{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:var(--arena2);color:var(--tinta);font-weight:600;padding:11px 18px;border-radius:11px}
.btn-sec:hover{background:var(--linea)}.btn-sec.sm{padding:8px 14px;font-size:13px}.btn-sec.ancho{width:100%;margin-top:4px}
.btn-cancelar{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:none;color:var(--coral);font-weight:600;padding:11px 14px;border-radius:11px;border:1px solid transparent}
.btn-cancelar:hover{background:rgba(214,112,106,.1);border-color:rgba(214,112,106,.3)}
.btn-cancelar.sm{padding:8px 12px;font-size:13px}
.btn-sec-claro{background:rgba(255,255,255,.14);color:var(--arena);font-weight:600;padding:13px 22px;border-radius:12px}
.btn-sec-claro:hover{background:rgba(255,255,255,.24)}

.explorar{max-width:1180px;margin:0 auto;padding:clamp(28px,4vw,48px) clamp(16px,4vw,52px)}
.explorar-head h1{font-size:clamp(26px,3.6vw,36px)}.explorar-head .sub{color:var(--muted);margin-top:4px}
.buscador-rapido{display:flex;align-items:center;gap:9px;background:var(--blanco);border:1px solid var(--linea);border-radius:12px;padding:11px 16px;margin-top:18px;color:var(--muted)}
.buscador-rapido input{flex:1;border:none;background:none;font-size:14.5px;color:var(--tinta)}
.buscador-rapido input:focus{outline:none}
.brapido-x{display:flex;color:var(--muted)}.brapido-x:hover{color:var(--tinta)}
.clase-seg{display:inline-flex;background:var(--blanco);border:1px solid var(--linea);border-radius:999px;padding:4px;margin:20px 0 14px;flex-wrap:wrap}
.cs{padding:8px 18px;border-radius:999px;font-weight:600;font-size:14px;color:var(--slate)}
.cs.on{background:var(--noche);color:var(--arena)}
.chips-foto{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px}
.cff{position:relative;display:flex;align-items:flex-end;height:100px;border-radius:14px;background-color:var(--noche);background-size:cover;background-position:center;padding:12px;border:2px solid transparent;transition:transform .16s,border-color .16s}
.cff:hover{transform:translateY(-2px)}
.cff.on{border-color:var(--mar)}
.cff-t{color:var(--arena);font-weight:700;font-size:14px;text-align:left}
.filtros-fila{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:24px}
.filtros-fila select{padding:9px 13px;border:1px solid var(--linea);border-radius:10px;background:var(--blanco)}
.check{display:flex;align-items:center;gap:7px;font-size:13.5px;color:var(--slate)}
.vacio{text-align:center;padding:60px 20px;color:var(--muted)}.vacio svg{color:var(--mar);margin-bottom:12px}.vacio p{margin-bottom:16px}

.honesto{max-width:760px;margin:0 auto;padding:clamp(26px,4vw,40px);background:var(--blanco);border:1px solid var(--linea);border-left:4px solid var(--mar);border-radius:14px}
.honesto h2{font-size:clamp(21px,2.8vw,27px);margin:8px 0 14px}
.honesto p{color:var(--slate);margin-bottom:12px}
.honesto p:last-child{margin-bottom:0}

.arranque{text-align:center;max-width:620px;margin:0 auto;padding:clamp(30px,5vw,52px) 24px;background:var(--blanco);border:1px solid var(--linea);border-radius:18px}
.arranque h2{font-size:clamp(24px,3.4vw,32px);margin:10px 0 12px}
.arranque p{color:var(--slate);margin-bottom:22px}
.arranque-nota{font-size:13px;color:var(--muted);margin:16px 0 0}

.ficha{max-width:1140px;margin:0 auto;padding:22px clamp(16px,4vw,52px) 64px}
.volver{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-weight:500;margin-bottom:14px}.volver:hover{color:var(--tinta)}
.breadcrumb{font-size:13px;color:var(--muted);margin-bottom:6px}
.ficha-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.ficha-titulo{font-size:clamp(28px,4.4vw,42px)}
.ficha-acciones{display:flex;gap:8px}
.acc{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;color:var(--tinta);padding:8px 14px;border-radius:999px;border:1px solid var(--linea);background:var(--blanco)}
.acc:hover{border-color:var(--mar)}.acc.on{color:var(--coral);border-color:var(--coral)}
.ficha-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--slate);font-size:14px;margin:8px 0 22px}
.verif-inline{display:inline-flex;align-items:center;gap:5px;color:var(--sage);font-weight:600}
.ficha-grid{display:grid;grid-template-columns:1fr 372px;gap:36px;align-items:start}
.ficha .foto{border-radius:20px}
.galeria{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:9px}
.mini{position:relative;height:78px;border-radius:12px;overflow:hidden}.mini span{position:absolute;left:8px;bottom:6px;font-size:10px;color:var(--arena)}
.specs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0;padding:20px;background:var(--blanco);border:1px solid var(--linea);border-radius:16px}
.spec{display:flex;align-items:center;gap:10px}.spec-i{color:var(--mar)}
.spec div{display:flex;flex-direction:column}
.spec-k{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}.spec-v{font-weight:600;color:var(--tinta)}
.bloque-tit{font-size:22px;margin:26px 0 10px}.bloque-txt{color:var(--slate);font-size:16px;line-height:1.65}
.equipo{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.equipo-item{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--slate)}.equipo-item svg{color:var(--sage);flex-shrink:0}

.reserva{position:sticky;top:90px;background:var(--blanco);border:1px solid var(--linea);border-radius:22px;padding:22px;box-shadow:0 22px 50px -32px rgba(22,50,63,.5)}
.reserva-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
.toggle{display:flex;background:var(--arena);border-radius:11px;padding:4px;margin-bottom:16px}
.toggle button{flex:1;padding:9px;border-radius:8px;font-weight:600;font-size:14px;color:var(--muted)}
.toggle button.on{background:var(--blanco);color:var(--tinta);box-shadow:0 2px 8px -2px rgba(0,0,0,.14)}
.fechas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
.fechas label,.campo{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.fechas span,.campo>span{font-size:12px;font-weight:600;color:var(--muted)}
.fechas input,.campo input[type=date]{padding:10px;border:1px solid var(--linea);border-radius:10px;background:var(--blanco)}
.campo input[type=range]{accent-color:var(--mar)}
.stepper-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.stepper-row>span{font-size:13px;font-weight:600;color:var(--muted)}
.stepper{display:flex;align-items:center;gap:14px}
.stepper button{width:32px;height:32px;border-radius:50%;border:1px solid var(--linea);display:grid;place-items:center;color:var(--tinta)}
.stepper button:hover{border-color:var(--mar);color:var(--mar)}
.stepper b{font-family:'Newsreader',serif;font-size:18px;color:var(--tinta);min-width:16px;text-align:center}
.mini-nota{font-size:12px;color:var(--muted);margin-bottom:14px}
.mini-nota-error{color:var(--coral)}
.patron{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid var(--linea);border-radius:12px;margin-bottom:16px;cursor:pointer;font-size:14px;font-weight:500;color:var(--tinta)}
.patron.fijo{background:rgba(127,178,206,.12);border-color:var(--brisa)}
.patron em{font-style:normal;color:var(--mar);font-weight:600}
.patron input{accent-color:var(--mar);width:18px;height:18px}
.desglose{border-top:1px dashed var(--linea);padding-top:14px;margin-bottom:16px}
.fianza-box{background:rgba(127,178,206,.12);border:1px solid var(--brisa);border-radius:12px;padding:12px 14px;margin-bottom:16px}
.fianza-tit{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13.5px;color:var(--mar)}
.fianza-box p{font-size:12.5px;color:var(--slate);margin-top:5px;line-height:1.5}
.fianza-badge{font-size:12px;font-weight:600;color:var(--mar);background:rgba(127,178,206,.15);padding:5px 10px;border-radius:8px}
.licencia-box .field{margin-top:8px;margin-bottom:8px}
.fotos-drop.sm{padding:12px;font-size:11.5px;margin-bottom:8px}
.verif-ok{display:flex;align-items:center;gap:6px;font-weight:600;font-size:13px;color:#3B7A5E;margin-top:4px}
.btn-sec.sm.ancho{padding:9px 14px}
.linea{display:flex;justify-content:space-between;font-size:14px;padding:5px 0;color:var(--slate)}
.linea .tachado{text-decoration:line-through;opacity:.6}
.linea-verde{color:#3B7A5E;font-weight:600}
.total{display:flex;justify-content:space-between;align-items:baseline;border-top:1.5px solid var(--tinta);margin-top:10px;padding-top:12px;font-weight:700;color:var(--tinta)}
.reserva .btn-primario{width:100%}
.nota{display:flex;align-items:center;gap:6px;justify-content:center;font-size:11.5px;color:var(--muted);margin-top:11px}

.ok{text-align:center}.ok.centro{max-width:460px;margin:56px auto;background:var(--blanco);border:1px solid var(--linea);border-radius:22px;padding:40px}
.ok-icon{width:60px;height:60px;border-radius:50%;background:var(--sage);color:#fff;display:grid;place-items:center;margin:0 auto 16px}
.ok h3{font-size:23px;margin-bottom:8px}.ok p{color:var(--slate);margin-bottom:16px}
.ok-resumen{display:flex;justify-content:space-between;background:var(--arena);padding:13px;border-radius:11px;margin-bottom:14px;font-weight:600;color:var(--tinta)}

.banner-flot{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:12px;padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;box-shadow:0 8px 24px rgba(15,39,50,.25);max-width:92vw}
.banner-flot button{display:flex;opacity:.7}.banner-flot button:hover{opacity:1}
.banner-ok{background:var(--noche);color:var(--arena)}
.banner-info{background:var(--arena2);color:var(--tinta)}
.modal-overlay{position:fixed;inset:0;z-index:60;background:rgba(15,39,50,.58);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px}
.modal{position:relative;background:var(--arena);width:100%;max-width:424px;border-radius:22px;padding:30px;max-height:92vh;overflow:auto;box-shadow:0 40px 90px -30px rgba(0,0,0,.6)}
.modal-x{position:absolute;top:16px;right:16px;color:var(--muted);width:34px;height:34px;border-radius:50%;display:grid;place-items:center}.modal-x:hover{background:var(--arena2)}
.modal-marca{display:flex;align-items:center;gap:9px;margin-bottom:14px}
.modal-tit{font-size:26px}.modal-sub{color:var(--slate);font-size:14px;margin:6px 0 18px}
.aviso-icon{width:52px;height:52px;border-radius:50%;background:rgba(214,112,106,.15);color:var(--coral);display:grid;place-items:center;margin-bottom:12px}
.aviso-fuerte{font-size:15px;font-weight:700;color:var(--coral);line-height:1.4;margin-bottom:10px}
.modal .btn-cancelar{width:100%;margin-top:10px;border-color:rgba(214,112,106,.3)}
.estrellas-picker{display:flex;gap:6px;margin:6px 0 16px;color:var(--oro)}
.estrellas-picker button{padding:2px}
.modal .toggle{margin-bottom:18px}
.field{display:flex;flex-direction:column;margin-bottom:12px}
.field>span{font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px}
.field.ico>div{display:flex;align-items:center;gap:8px;border:1px solid var(--linea);border-radius:10px;background:var(--blanco);padding:0 12px;color:var(--muted)}
.field.ico input{border:none;outline:none;padding:11px 0;width:100%;background:none}
.rol-bloque{margin:4px 0}.rol-label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px}
.auth-error{color:var(--coral);font-size:13px;background:rgba(214,112,106,.1);border-radius:8px;padding:9px 12px;margin:2px 0}
.ok.sin-borde{margin:8px auto 0;border:none;padding:6px 0 0;background:none}
.rol-chips{display:flex;gap:8px;flex-wrap:wrap}
.rc{flex:1;min-width:108px;padding:11px 8px;border-radius:11px;background:var(--blanco);border:1px solid var(--linea);font-size:12.5px;font-weight:600;color:var(--slate)}
.rc:hover{border-color:var(--mar)}.rc.on{background:var(--noche);color:var(--arena);border-color:var(--noche)}
.modal .btn-primario{margin-top:16px}
.modal-alt{text-align:center;font-size:13px;color:var(--slate);margin-top:14px}.modal-alt button{color:var(--mar);font-weight:700}

.panel-wrap{max-width:1160px;margin:0 auto;padding:clamp(24px,4vw,44px) clamp(16px,4vw,52px);display:grid;grid-template-columns:290px 1fr;gap:28px;align-items:start}
.panel-side{background:var(--blanco);border:1px solid var(--linea);border-radius:20px;padding:24px;position:sticky;top:90px}
.side-user{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.avatar-xl{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:var(--noche);color:var(--brisa);font-size:20px;font-weight:700}
.side-nombre{font-weight:700;color:var(--tinta)}.side-meta{font-size:12px;color:var(--muted)}
.rol-badge{display:inline-flex;align-items:center;gap:6px;background:var(--brisa-suave);color:var(--noche);font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px}
.nivel-mini{margin:18px 0;padding:16px;background:var(--arena);border-radius:14px}
.nivel-mini-top{display:flex;align-items:center;gap:7px;color:var(--tinta);font-size:15px}.nivel-mini-top svg{color:var(--oro)}
.barra{height:7px;background:var(--arena2);border-radius:999px;margin:10px 0 6px;overflow:hidden}
.barra span{display:block;height:100%;background:var(--mar);border-radius:999px}
.nivel-mini-txt{font-size:12px;color:var(--muted)}
.link-ventajas{margin-top:8px;color:var(--mar);font-weight:700;font-size:13px}
.btn-salir-side{display:flex;align-items:center;gap:8px;width:100%;justify-content:center;padding:11px;border-radius:11px;background:var(--arena);color:var(--slate);font-weight:600;font-size:14px}.btn-salir-side:hover{background:var(--arena2)}
.panel-main{display:flex;flex-direction:column;gap:22px}
.panel-cab{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.panel-cab h1{font-size:clamp(26px,4vw,38px)}
.panel-sec{background:var(--blanco);border:1px solid var(--linea);border-radius:18px;padding:24px}
.sec-t{display:flex;align-items:center;gap:8px;font-size:20px;margin-bottom:16px}.sec-t svg{color:var(--mar)}
.ventaja-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.ventaja-mini{flex:1;min-width:120px;background:var(--arena);border-radius:14px;padding:16px;text-align:center}
.vm-num{display:block;font-family:'Newsreader',serif;font-size:26px;font-weight:600;color:var(--tinta)}
.vm-lab{font-size:12px;color:var(--muted)}
.insignias{display:flex;gap:8px;flex-wrap:wrap}
.insignia{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;background:var(--arena);color:var(--muted);opacity:.6}
.insignia.ok{background:rgba(230,193,95,.16);color:#977415;opacity:1}
.prox{display:flex;justify-content:space-between;align-items:center;gap:16px;background:var(--arena);border-radius:14px;padding:18px;flex-wrap:wrap}
.estado{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:4px 9px;border-radius:6px}
.estado.confirmada{background:rgba(127,179,154,.2);color:#3B7A5E}.estado.revision{background:rgba(230,193,95,.2);color:#977415}
.prox-nombre{font-weight:700;color:var(--tinta);margin-top:8px}.prox-sub{font-size:13px;color:var(--muted);margin-top:2px}
.prox-fin{text-align:right;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.lista{list-style:none;display:flex;flex-direction:column;gap:10px}
.lista-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px;border:1px solid var(--linea);border-radius:12px}
.lista-item-col{flex-direction:column;align-items:stretch}
.li-fila{display:flex;justify-content:space-between;align-items:center;gap:12px}
.li-nombre{font-weight:600;color:var(--tinta)}.li-sub{font-size:12.5px;color:var(--muted);margin-top:2px}
.li-acciones{display:flex;gap:8px;flex-shrink:0;align-items:center}
.li-doc{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;color:var(--muted);margin-top:8px}
.li-doc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.fianza-estado{display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--slate);background:rgba(127,178,206,.1);border-radius:10px;padding:10px 12px;margin-top:2px}
.fianza-estado.ok{color:#3B7A5E;background:rgba(127,179,154,.15)}
.fianza-estado span{display:flex;align-items:center;gap:6px}
.fianza-estado.compacta{margin-top:10px}
.fav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
.fav{text-align:left;background:var(--blanco);border:1px solid var(--linea);border-radius:14px;overflow:hidden}
.fav:hover{box-shadow:0 14px 30px -20px rgba(22,50,63,.4)}.fav-body{padding:11px 13px}
.mini-vacio{text-align:center;padding:22px 10px;color:var(--muted)}.mini-vacio p{margin-bottom:14px;font-size:14px}
.link-inline{color:var(--mar);font-weight:700}

/* VENTAJAS */
.ventajas{padding-bottom:40px}
.v-hero{max-width:1120px;margin:clamp(14px,2vw,22px) auto;border-radius:26px;background-color:var(--noche);background-size:cover;background-position:center;color:var(--arena);padding:clamp(40px,6vw,72px) clamp(20px,5vw,60px)}
.v-h1{font-size:clamp(34px,5.5vw,58px);color:var(--arena);margin:14px 0}
.v-sub{color:#D5E4E9;max-width:620px;font-size:clamp(16px,2vw,19px)}
.v-hero-btns{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}
.niveles-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:24px}
.nivel-card{background:var(--blanco);border:1px solid var(--linea);border-radius:18px;padding:22px}
.nivel-card.activo{border-color:var(--mar);box-shadow:0 0 0 1px var(--mar) inset}
.nivel-n{font-family:'Newsreader',serif;font-size:22px;font-weight:600;color:var(--tinta);display:block}
.nivel-req{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--mar);display:block;margin:4px 0 10px}
.nivel-card p{font-size:14px;color:var(--slate)}
.fidelidad{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.fid{display:flex;gap:12px;background:var(--blanco);border:1px solid var(--linea);border-radius:16px;padding:20px}
.fid svg{color:var(--mar);flex-shrink:0}.fid b{color:var(--tinta)}.fid p{font-size:13.5px;color:var(--slate);margin-top:3px}
.owner-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-bottom:24px}
.owner-card{background:var(--blanco);border:1px solid var(--linea);border-radius:18px;padding:22px}
.owner-n{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--sage)}
.owner-req{font-family:'Newsreader',serif;font-size:20px;font-weight:600;color:var(--tinta);display:block;margin:4px 0 10px}
.owner-card p{font-size:14px;color:var(--slate)}
.premium{display:flex;gap:14px;background:var(--noche);color:var(--arena);border-radius:18px;padding:24px}
.premium svg{color:var(--oro);flex-shrink:0}.premium b{color:var(--arena)}.premium p{color:#C4D6DC;font-size:14px;margin-top:4px}
.recompensa-compartida{text-align:center;max-width:820px}
.recompensa-compartida h2{font-size:clamp(28px,4vw,40px);margin:8px 0 12px}
.recompensa-compartida p{font-size:17px;color:var(--slate);line-height:1.7}
.recompensa-compartida b{color:var(--tinta)}
.ref-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.ref{background:var(--blanco);border:1px solid var(--linea);border-radius:18px;padding:22px}
.ref svg{color:var(--mar)}.ref b{display:block;color:var(--tinta);margin:10px 0 5px;font-size:16px}.ref p{font-size:13.5px;color:var(--slate)}

.ayuda-tabs{display:flex;gap:8px;max-width:1120px;margin:0 auto;padding:0 clamp(16px,4vw,44px);flex-wrap:wrap}
.at{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border-radius:999px;border:1px solid var(--linea);background:var(--blanco);color:var(--slate);font-weight:600;font-size:14px}
.at:hover{border-color:var(--mar);color:var(--tinta)}
.at.on{background:var(--noche);border-color:var(--noche);color:var(--arena)}
.contacto-grid{display:grid;grid-template-columns:280px 1fr;gap:28px;align-items:start}
.contacto-info{display:flex;flex-direction:column;gap:16px}
.faq-grupo{margin-bottom:30px}
.faq-cat{font-size:19px;margin-bottom:12px}
.faq-lista{display:flex;flex-direction:column;gap:8px}
.faq-item{border:1px solid var(--linea);border-radius:14px;background:var(--blanco);overflow:hidden}
.faq-p{width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;text-align:left;font-weight:600;color:var(--tinta);font-size:14.5px}
.faq-chevron{flex-shrink:0;color:var(--muted);transition:transform .16s}
.faq-item.on .faq-chevron{transform:rotate(180deg);color:var(--mar)}
.faq-r{padding:0 18px 16px;color:var(--slate);font-size:14px;line-height:1.6}
.cancel-intro{color:var(--slate);max-width:680px;font-size:15.5px;margin-bottom:22px}
.cancel-tabla{border:1px solid var(--linea);border-radius:16px;overflow:hidden;margin-bottom:26px}
.cancel-fila{display:grid;grid-template-columns:1fr auto 1.4fr;gap:14px;align-items:center;padding:14px 18px;border-bottom:1px solid var(--linea)}
.cancel-fila:last-child{border-bottom:none}
.cancel-cuando{font-weight:600;color:var(--tinta);font-size:14.5px}
.cancel-reembolso{font-family:'Newsreader',serif;font-weight:600;font-size:19px;color:var(--mar)}
.cancel-nota{font-size:13px;color:var(--muted)}
.cancel-cta{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;background:var(--arena2);border-radius:16px;padding:20px 24px;margin-top:26px}
.cancel-cta p{font-weight:600;color:var(--tinta)}

.publicar{max-width:1040px;margin:0 auto;padding:clamp(30px,5vw,54px) clamp(16px,4vw,52px)}
.pub-titulo{font-size:clamp(30px,4.5vw,44px);margin:8px 0 10px}
.pub-sub{color:var(--slate);max-width:600px;font-size:17px;margin-bottom:26px}
.clase-pub{display:flex;gap:10px;margin-bottom:26px;flex-wrap:wrap}
.cp{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:12px;background:var(--blanco);border:1px solid var(--linea);font-weight:600;color:var(--slate)}
.cp:hover{border-color:var(--mar)}.cp.on{background:var(--noche);color:var(--arena);border-color:var(--noche)}
.pub-grid{display:grid;grid-template-columns:1fr 316px;gap:32px;align-items:start}
.form{display:flex;flex-direction:column;gap:14px}
.fila{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field input,.field select,.field textarea{padding:11px 13px;border:1px solid var(--linea);border-radius:10px;background:var(--blanco);resize:vertical}
.fotos-drop{display:flex;align-items:center;justify-content:center;gap:8px;padding:22px;border:1.5px dashed var(--linea);border-radius:12px;color:var(--muted);font-size:13.5px;margin-bottom:14px;width:100%}
.fotos-drop:hover{border-color:var(--mar);color:var(--mar)}
.fotos-previews{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px;margin:-6px 0 14px}
.fotos-preview{position:relative;height:74px;border-radius:10px;overflow:hidden}
.fotos-preview img{width:100%;height:100%;object-fit:cover}
.fotos-preview-x{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(15,39,50,.7);color:var(--arena);display:grid;place-items:center}
.equipo-pub{margin-bottom:16px}
.equipo-pub>span{display:block;font-size:13px;color:var(--slate);margin-bottom:8px}
.equipo-check-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-bottom:12px}
.equipo-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.equipo-chip{display:inline-flex;align-items:center;gap:6px;background:var(--arena2);color:var(--tinta);font-size:13px;padding:6px 10px;border-radius:20px}
.equipo-chip button{display:flex;color:var(--muted)}.equipo-chip button:hover{color:var(--tinta)}
.consentimiento{display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--slate);line-height:1.5;margin-bottom:16px;cursor:pointer}
.consentimiento input{margin-top:2px;accent-color:var(--mar);width:16px;height:16px;flex-shrink:0}
.ganancias{background:var(--noche);color:var(--arena);border-radius:20px;padding:26px;position:sticky;top:90px}
.gan-linea{display:flex;justify-content:space-between;align-items:baseline;margin:16px 0;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.16)}
.gan-linea>span:first-child{color:#C4D6DC}
.precio.blanco b{color:var(--arena)}.precio.verde b{color:#8FD3AE}
.gan-detalle{font-size:13px;color:#C4D6DC;display:flex;flex-direction:column;gap:8px}.gan-detalle>div{display:flex;justify-content:space-between}
.gan-com{color:var(--brisa)}
.gan-total{display:flex;justify-content:space-between;align-items:baseline;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.16);font-weight:700;color:var(--arena)}
.gan-nota{font-size:12px;color:#96B2BB;margin-top:14px;line-height:1.5}

.footer{background-color:var(--noche);background-size:cover;background-position:center;color:#B9CDD3;padding:clamp(36px,5vw,56px) clamp(16px,4vw,52px);display:flex;justify-content:space-between;gap:40px;flex-wrap:wrap;margin-top:24px}
.foot-marca{display:flex;align-items:flex-start;gap:12px;max-width:340px}
.foot-tag{font-size:13px;color:#93AEB6;margin-top:6px;line-height:1.5}
.foot-cols{display:flex;gap:52px;flex-wrap:wrap}
.foot-cols h4{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:var(--brisa);margin-bottom:12px}
.foot-cols div{display:flex;flex-direction:column;gap:9px}
.foot-cols button{color:#B9CDD3;font-size:14px;text-align:left}.foot-cols button:hover{color:var(--arena)}
.foot-legal{background:var(--noche2);color:#6E8891;text-align:center;font-size:12px;padding:14px}

@media(max-width:900px){.panel-wrap{grid-template-columns:1fr}.panel-side{position:static}}
@media(max-width:820px){
  .ficha-grid,.pub-grid,.contacto-grid{grid-template-columns:1fr}
  .reserva,.ganancias{position:static}
  .specs{grid-template-columns:repeat(2,1fr)}
  .galeria{grid-template-columns:repeat(2,1fr)}
  .hamburguesa{display:block;color:var(--tinta)}
  .links{position:absolute;top:64px;right:14px;left:14px;flex-direction:column;align-items:stretch;background:var(--blanco);border:1px solid var(--linea);border-radius:16px;padding:8px;box-shadow:0 20px 40px -20px rgba(0,0,0,.3);display:none}
  .links.abierto{display:flex}.links>button{text-align:left;padding:12px}
}
@media(max-width:600px){
  .fila{grid-template-columns:1fr}
  .buscador{flex-direction:column;align-items:stretch}
  .buscador .b-campo{min-width:0}
  .b-btn{width:100%}
  .foot-cols{gap:28px;width:100%;justify-content:space-between}
  .cta-prop,.banner-ventajas{flex-direction:column;align-items:flex-start;text-align:left}
  .cta-prop .btn-primario,.banner-ventajas .banner-cta{align-self:flex-start}
  .cancel-fila{grid-template-columns:1fr}
  .cancel-reembolso{order:-1}
}
@media(max-width:480px){
  .modal-overlay{padding:12px}
  .modal{padding:22px;max-height:94vh}
  .ok.centro{padding:26px;margin:28px auto}
  .rol-chips .rc,.clase-pub .cp{min-width:0;flex:1 1 45%}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
