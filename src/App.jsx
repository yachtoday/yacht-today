import React, { useState, useMemo } from "react";
import {
  Anchor, Search, MapPin, Users, Star, Ship, Waves, ChevronRight, Check,
  Plus, ArrowLeft, Ruler, Gauge, ShieldCheck, Menu, X, Sailboat, Info,
  User, Mail, Phone, Lock, BadgeCheck, LogOut, Heart, Share2, Minus,
  CalendarCheck, ClipboardList, Sparkles, Fish, Wind, Gift, Trophy,
  Clock, Award, Waypoints, Handshake, Zap, CloudRain,
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
const LogoMarea = ({ size = 38 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <rect width="40" height="40" rx="11" fill="#0F2732" />
    <path d="M21 7.5 L21 25 L9.5 25 Z" fill="#F5EFE4" />
    <path d="M23.4 12.5 L23.4 25 L31.5 25 Z" fill="#7FB2CE" />
    <path d="M7.5 28 Q20 34.4 32.5 28 L29.8 31.8 Q20 36.4 10.2 31.8 Z" fill="#F5EFE4" />
  </svg>
);

/* ── Datos ───────────────────────────────────────────────────────── */
const BARCOS = [
  { id: 1, clase: "barco", nombre: "Quicksilver 675 Open", tipo: "Motora", puerto: "Grao de Castellón", zona: "C. Valenciana", plazas: 7, eslora: 6.75, potencia: 150, anio: 2019, lista: "7ª", hue: 205, hora: 65, dia: 380, patron: "opcional", rating: 4.9, reviews: 42, desc: "Lancha ágil y familiar, perfecta para un día de calas en el Levante. Solárium a proa, ducha de popa y nevera." },
  { id: 2, clase: "barco", nombre: "Bavaria Cruiser 34", tipo: "Velero", puerto: "Port de Sóller, Mallorca", zona: "Baleares", plazas: 8, eslora: 10.5, potencia: 30, anio: 2015, lista: "6ª", hue: 210, hora: 90, dia: 520, patron: "incluido", rating: 4.8, reviews: 31, desc: "Velero cómodo para navegar a vela por la Tramuntana. Se alquila siempre con patrón titulado." },
  { id: 3, clase: "barco", nombre: "Zodiac Medline 580", tipo: "Neumática", puerto: "Palamós, Girona", zona: "Costa Brava", plazas: 6, eslora: 5.8, potencia: 100, anio: 2021, lista: "7ª", hue: 195, hora: 50, dia: 300, patron: "no", rating: 4.7, reviews: 58, desc: "Semirrígida estable y seca para descubrir las calas de la Costa Brava. Se maneja con licencia de navegación, sin titulación." },
  { id: 4, clase: "barco", nombre: "Sea Ray Sundancer 290", tipo: "Yate", puerto: "Puerto Banús, Marbella", zona: "Costa del Sol", plazas: 8, eslora: 9.0, potencia: 260, anio: 2018, lista: "6ª", hue: 218, hora: 140, dia: 900, patron: "incluido", rating: 5.0, reviews: 19, desc: "Yate con camarote, cocina y baño. Se entrega con patrón, para celebraciones o un día premium." },
  { id: 5, clase: "barco", nombre: "Yamaha VX Cruiser", tipo: "Moto de agua", puerto: "Las Palmas de G.C.", zona: "Canarias", plazas: 2, eslora: 3.3, potencia: 125, anio: 2022, lista: "7ª", hue: 25, hora: 45, dia: 190, patron: "no", rating: 4.6, reviews: 73, desc: "Moto de agua fácil y divertida en aguas atlánticas. Con licencia básica te la llevas." },
  { id: 6, clase: "barco", nombre: "Llaüt tradicional 8m", tipo: "Tradicional", puerto: "Dénia, Alicante", zona: "Costa Blanca", plazas: 5, eslora: 8.0, potencia: 40, anio: 2010, lista: "6ª", hue: 38, hora: 55, dia: 330, patron: "incluido", rating: 4.9, reviews: 27, desc: "Llaüt de líneas clásicas para navegar sin prisa, con patrón local que conoce cada cala." },
  { id: 7, clase: "barco", nombre: "Beneteau Antares 8", tipo: "Motora", puerto: "Vigo, Pontevedra", zona: "Rías Baixas", plazas: 6, eslora: 7.9, potencia: 220, anio: 2020, lista: "7ª", hue: 200, hora: 80, dia: 470, patron: "opcional", rating: 4.8, reviews: 24, desc: "Motora cabinada perfecta para recorrer la ría y las Cíes. Con o sin patrón." },
  { id: 8, clase: "barco", nombre: "Lagoon 42 Catamarán", tipo: "Catamarán", puerto: "Puerto de Mahón, Menorca", zona: "Baleares", plazas: 10, eslora: 12.6, potencia: 60, anio: 2019, lista: "6ª", hue: 208, hora: 180, dia: 1200, patron: "incluido", rating: 5.0, reviews: 64, desc: "Catamarán espacioso y estable, con 4 camarotes. Se entrega con patrón rumbo a Cala en Bosc." },
  { id: 9, clase: "barco", nombre: "Jeanneau Cap Camarat 6.5", tipo: "Motora", puerto: "Puerto de Alicante", zona: "Costa Blanca", plazas: 5, eslora: 6.5, potencia: 150, anio: 2021, lista: "7ª", hue: 202, hora: 58, dia: 340, patron: "opcional", rating: 4.6, reviews: 33, desc: "Lancha versátil y económica, ideal para grupos pequeños. Sin patrón con la licencia de navegación." },
  { id: 10, clase: "barco", nombre: "Dufour 350 Grand Large", tipo: "Velero", puerto: "Marina Real, Valencia", zona: "C. Valenciana", plazas: 8, eslora: 10.3, potencia: 30, anio: 2017, lista: "6ª", hue: 214, hora: 95, dia: 540, patron: "incluido", rating: 4.9, reviews: 21, desc: "Velero moderno y luminoso, salida desde la Marina Real, con patrón titulado." },
];

const EXPERIENCIAS = [
  { id: 101, clase: "experiencia", actividad: "Pesca", nombre: "Jornada de pesca al curricán", puerto: "Grao de Castellón", zona: "C. Valenciana", plazas: 5, duracion: "4 h", persona: 55, anfitrion: "Carlos", rating: 4.9, reviews: 38, hue: 205, desc: "Salimos al amanecer a pescar al curricán con todo el equipo incluido. Yo llevo el barco, tú disfrutas. Apto para principiantes." },
  { id: 102, clase: "experiencia", actividad: "Submarinismo", nombre: "Bautizo de buceo en las Islas Medas", puerto: "L'Estartit, Girona", zona: "Costa Brava", plazas: 4, duracion: "3 h", persona: 75, anfitrion: "Marta", rating: 5.0, reviews: 52, hue: 195, desc: "Inmersión guiada en una de las mejores reservas marinas del Mediterráneo. Equipo y titulado incluidos." },
  { id: 103, clase: "experiencia", actividad: "Paddle surf", nombre: "Ruta en paddle surf al atardecer", puerto: "Palma, Mallorca", zona: "Baleares", plazas: 8, duracion: "2 h", persona: 30, anfitrion: "Nil", rating: 4.8, reviews: 41, hue: 30, desc: "Ruta guiada en SUP bordeando la costa al atardecer. Tablas, chaleco y monitor incluidos." },
  { id: 104, clase: "experiencia", actividad: "Kayak", nombre: "Kayak entre cuevas y calas", puerto: "Xàbia, Alicante", zona: "Costa Blanca", plazas: 6, duracion: "3 h", persona: 35, anfitrion: "Lucía", rating: 4.9, reviews: 29, hue: 200, desc: "Explora cuevas y calas escondidas en kayak con guía local. Incluye snorkel y avituallamiento." },
  { id: 105, clase: "experiencia", actividad: "Puesta de sol", nombre: "Aperitivo náutico al atardecer", puerto: "Puerto Banús, Marbella", zona: "Costa del Sol", plazas: 8, duracion: "2.5 h", persona: 60, anfitrion: "Diego", rating: 4.9, reviews: 47, hue: 218, desc: "Navegación tranquila al atardecer con cava y aperitivo a bordo. Yo piloto, vosotros brindáis." },
  { id: 106, clase: "experiencia", actividad: "Pesca", nombre: "Pesca de altura en las Rías", puerto: "Vigo, Pontevedra", zona: "Rías Baixas", plazas: 4, duracion: "5 h", persona: 70, anfitrion: "Manuel", rating: 4.8, reviews: 22, hue: 200, desc: "Salida de pesca de altura con patrón experto. Cañas, cebo y licencia incluidos." },
];

const MATERIAL = [
  { id: 201, clase: "material", tipo: "Paddle surf", nombre: "Tabla SUP hinchable Red Paddle 10'6\"", puerto: "Peñíscola, Castellón", zona: "C. Valenciana", hora: 12, dia: 35, rating: 4.7, reviews: 18, hue: 32, desc: "Tabla de paddle surf todoterreno con remo, hinchador y quilla. Perfecta para calas tranquilas." },
  { id: 202, clase: "material", tipo: "Kayak", nombre: "Kayak doble sit-on-top", puerto: "Sanxenxo, Pontevedra", zona: "Rías Baixas", hora: 14, dia: 40, rating: 4.8, reviews: 22, hue: 198, desc: "Kayak biplaza estable con palas y chalecos. Ideal para explorar la ría en pareja." },
  { id: 203, clase: "material", tipo: "Paddle surf", nombre: "Pack 2 tablas SUP rígidas", puerto: "Sitges, Barcelona", zona: "Costa Brava", hora: 20, dia: 55, rating: 4.6, reviews: 12, hue: 190, desc: "Dos tablas rígidas de gama alta con remos de carbono. Se entregan en playa." },
  { id: 204, clase: "material", tipo: "Kayak", nombre: "Kayak individual de travesía", puerto: "Los Cristianos, Tenerife", zona: "Canarias", hora: 13, dia: 38, rating: 4.9, reviews: 16, hue: 205, desc: "Kayak de travesía ligero y rápido. Chaleco y bidón estanco incluidos." },
];

const TODOS = [...BARCOS, ...EXPERIENCIAS, ...MATERIAL];

const TIPOS = ["Motora", "Velero", "Neumática", "Yate", "Moto de agua", "Tradicional", "Catamarán"];
const ACTIVIDADES = ["Pesca", "Submarinismo", "Paddle surf", "Kayak", "Puesta de sol"];
const MATERIALES = ["Paddle surf", "Kayak"];
const ZONAS = ["Todas", "Baleares", "Costa Brava", "C. Valenciana", "Costa Blanca", "Costa del Sol", "Rías Baixas", "Canarias"];
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
  return (
    <div className="foto" style={{ height: alto, background: `linear-gradient(165deg, hsl(${h} 38% 34%), hsl(${h + 12} 45% 18%))` }}>
      <div className="foto-sol" />
      <Silueta v={visualDe(item)} />
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
function Ficha({ item, onBack, onAbrir, usuario, numReservas, esFavorito, onToggleFav, onNecesitaCuenta, onReservado }) {
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
  const [reservado, setReservado] = useState(false);
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
  const fianza = requiereFianza ? Math.round(subtotal * FIANZA_PCT) : 0;

  const inicioISO = exp ? dtISO(fechaExp) : modo === "horas" ? dtISO(fechaHoras) : dtISO(inicio);
  const finISO = exp ? sumarHoras(inicioISO, parseDuracionHoras(item.duracion))
    : modo === "horas" ? sumarHoras(inicioISO, horas)
      : finDeDiaISO(fin);

  const resumenTxt = exp ? `${personas} ${personas > 1 ? "plazas" : "plaza"}`
    : (modo === "horas" ? `${horas} h` : `${dias} ${dias > 1 ? "días" : "día"}`) + (patronActivo ? " · con patrón" : "");

  const reservar = () => {
    if (!usuario) { onNecesitaCuenta(); return; }
    if (fechaInvalida) return;
    if (requiereFianza && verifLicencia !== "verificado") return;
    setReservado(true);
    onReservado({ id: Date.now(), barco: item.nombre, puerto: item.puerto, zona: item.zona, detalle: resumenTxt, subtotal, servicio, total, fianza, fianzaEstado: requiereFianza ? "retenida" : null, licenciaVerificada: requiereFianza, inicioISO, finISO, estado: "confirmada" });
  };

  const specs = exp
    ? [[Users, "Plazas", item.plazas], [Clock, "Duración", item.duracion], [Sparkles, "Actividad", item.actividad], [BadgeCheck, "Anfitrión", item.anfitrion]]
    : mat
      ? [[Wind, "Tipo", item.tipo], [Anchor, "Licencia", "No necesaria"], [MapPin, "Entrega", "En playa"], [Check, "Incluye", "Remo y chaleco"]]
      : [[Users, "Plazas", item.plazas], [Ruler, "Eslora", `${item.eslora} m`], [Gauge, "Potencia", `${item.potencia} cv`], [ShieldCheck, "Lista", item.lista]];

  const incluye = exp ? ["Anfitrión / monitor", "Equipo necesario", "Seguro a bordo", "Briefing de seguridad", "Avituallamiento", "Cancela sin recargo hasta 48 h antes"]
    : mat ? ["Remo / pala", "Chaleco salvavidas", "Hinchador (si aplica)", "Entrega en playa", "Bidón estanco", "Cancela sin recargo hasta 48 h antes"]
      : ["Chalecos salvavidas", "Nevera a bordo", "Equipo de fondeo", "Ducha de popa", "Combustible incluido", "Cancela sin recargo hasta 48 h antes"];

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
          <div className="galeria">
            {(exp ? ["A bordo", "En acción", "El grupo", "El plan"] : mat ? ["Detalle", "En uso", "Entrega", "Extras"] : ["Cubierta", "Camarote", "Salón", "Cocina"]).map((n, i) => (
              <div key={n} className="mini" style={{ background: `linear-gradient(160deg, hsl(${item.hue + i * 6} 34% ${32 - i * 3}%), hsl(${item.hue + 14} 42% 18%))` }}><span>{n}</span></div>
            ))}
          </div>
          <div className="specs">{specs.map(([Ic, k, v]) => <Spec key={k} icon={Ic} k={k} v={v} />)}</div>
          <h2 className="serif bloque-tit">{tituloSobre}</h2>
          <p className="bloque-txt">{item.desc}</p>
          <h2 className="serif bloque-tit">{tituloIncluye}</h2>
          <div className="equipo">{incluye.map((e) => <span key={e} className="equipo-item"><Check size={14} /> {e}</span>)}</div>
        </div>

        <aside className="reserva">
          {!reservado ? (
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
                  {fechaInvalida && <p className="mini-nota mini-nota-error">No se puede reservar en fechas pasadas.</p>}
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
                      {fechaInvalida && <p className="mini-nota mini-nota-error">La fecha de fin debe ser posterior a la de inicio, y no se puede reservar en fechas pasadas.</p>}
                    </>
                  ) : (
                    <>
                      <label className="campo"><span>Fecha</span><input type="date" min={hoy} value={fechaHoras} onChange={(e) => setFechaHoras(e.target.value)} /></label>
                      <label className="campo"><span>Horas ({horas})</span><input type="range" min={2} max={10} value={horas} onChange={(e) => setHoras(+e.target.value)} /></label>
                      {fechaInvalida && <p className="mini-nota mini-nota-error">No se puede reservar en fechas pasadas.</p>}
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

              <button className="btn-primario" onClick={reservar} disabled={!!usuario && (fechaInvalida || (requiereFianza && verifLicencia !== "verificado"))}>{!usuario ? "Entra para reservar" : exp ? `Reservar ${personas > 1 ? "plazas" : "plaza"}` : mat ? "Alquilar" : "Reservar ahora"}</button>
              <p className="nota"><Info size={12} /> No se te cobrará todavía · Cancela sin recargo hasta 48 h antes</p>
            </>
          ) : (
            <div className="ok">
              <div className="ok-icon"><Check size={28} strokeWidth={3} /></div>
              <h3 className="serif">Solicitud enviada</h3>
              <p>Hemos avisado a <strong>{item.nombre}</strong>. La verás en tu panel.</p>
              <div className="ok-resumen"><span>{resumenTxt}</span><span>{eur(total)}</span></div>
              {requiereFianza && <p className="mini-nota">+ {eur(fianza)} de fianza retenida hasta la revisión de entrega.</p>}
              <button className="btn-sec" onClick={onBack}>Seguir explorando</button>
            </div>
          )}
        </aside>
      </div>

      {reservado && (() => {
        const mismoPuerto = EXPERIENCIAS.filter((e) => e.puerto === item.puerto && e.id !== item.id);
        const sugeridas = (mismoPuerto.length ? mismoPuerto : EXPERIENCIAS.filter((e) => e.zona === item.zona && e.id !== item.id)).slice(0, 3);
        return sugeridas.length > 0 && (
          <section className="seccion">
            <div className="sec-head"><h2 className="serif">¿Te apetece algo más {mismoPuerto.length ? `en ${lugarCorto(item)}` : `por ${item.zona}`}?</h2></div>
            <div className="grid">{sugeridas.map((s) => <Tarjeta key={s.id} item={s} onOpen={onAbrir} />)}</div>
          </section>
        );
      })()}
    </div>
  );
}
const Spec = ({ icon: Icon, k, v }) => (<div className="spec"><Icon size={16} className="spec-i" /><div><span className="spec-k">{k}</span><span className="spec-v">{v}</span></div></div>);
const Linea = ({ k, v, tachado, verde }) => (<div className={`linea ${verde ? "linea-verde" : ""}`}><span>{k}</span><span className={tachado ? "tachado" : ""}>{v}</span></div>);

/* ── Modal cuenta ────────────────────────────────────────────────── */
function AuthModal({ tab, rolPre, onClose, onAuth, onCambiarTab }) {
  const esRegistro = tab === "registro";
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [rol, setRol] = useState(rolPre || "ambas");
  const enviar = () => esRegistro
    ? onAuth({ nombre: nombre.trim() || "Nuevo usuario", email: email.trim() || "usuario@correo.com", telefono: tel.trim(), rol })
    : onAuth({ nombre: "Lucía Castro", email: email.trim() || "lucia@correo.com", telefono: "", rol: "ambas" });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}><X size={20} /></button>
        <div className="modal-marca"><LogoMarea size={30} /><span className="serif wordmark">Marea</span></div>
        <h2 className="serif modal-tit">{esRegistro ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h2>
        <p className="modal-sub">{esRegistro ? "Una cuenta para alquilar, vivir experiencias y publicar lo tuyo." : "Entra para reservar y gestionar tu cuenta."}</p>
        <div className="toggle"><button className={!esRegistro ? "on" : ""} onClick={() => onCambiarTab("entrar")}>Iniciar sesión</button><button className={esRegistro ? "on" : ""} onClick={() => onCambiarTab("registro")}>Crear cuenta</button></div>
        {esRegistro && <Ico label="Nombre y apellidos" icon={User}><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Eric Navarro" /></Ico>}
        <Ico label="Email" icon={Mail}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@correo.com" /></Ico>
        {esRegistro && <Ico label="Teléfono" icon={Phone}><input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="600 000 000" /></Ico>}
        <Ico label="Contraseña" icon={Lock}><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="••••••••" /></Ico>
        {esRegistro && (<div className="rol-bloque"><span className="rol-label">¿Qué quieres hacer?</span><div className="rol-chips">{ROLES.map((r) => <button key={r.v} className={rol === r.v ? "rc on" : "rc"} onClick={() => setRol(r.v)}>{r.t}</button>)}</div></div>)}
        <button className="btn-primario ancho" onClick={enviar}>{esRegistro ? "Crear cuenta" : "Entrar"}</button>
        <p className="modal-alt">{esRegistro ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}<button onClick={() => onCambiarTab(esRegistro ? "entrar" : "registro")}>{esRegistro ? "Inicia sesión" : "Créala aquí"}</button></p>
        <p className="nota"><Info size={12} /> Maqueta: no se guardan datos reales.</p>
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
function Panel({ usuario, reservas, misBarcos, reservasRecibidas, avisosPropietario, favoritos, onExplorar, onPublicar, onAbrir, onSalir, onVentajas, onCancelar, onFinalizar, onFinalizarRecibida, onSimularVistoBueno, onEspecificar, onCancelarRecibida, onActivarUltimaHora, onDesactivarUltimaHora }) {
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
            {proxima && proxima.fianzaEstado && <FianzaEstado reserva={proxima} onSimularVistoBueno={onSimularVistoBueno} />}
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
                  {r.fianzaEstado && <FianzaEstado reserva={r} onSimularVistoBueno={onSimularVistoBueno} compacta />}
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
                    <div><p className="li-nombre">{b.nombre}</p><p className="li-sub">{b.tipo} · {eur(b.dia)}/{b.unidad || "día"}</p></div>
                    <span className="estado revision">{b.estado}</span>
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

function FianzaEstado({ reserva, onSimularVistoBueno, compacta }) {
  if (reserva.fianzaEstado === "liberada") {
    return <div className={`fianza-estado ok ${compacta ? "compacta" : ""}`}><span><ShieldCheck size={14} /> Fianza de {eur(reserva.fianza)} liberada</span></div>;
  }
  return (
    <div className={`fianza-estado ${compacta ? "compacta" : ""}`}>
      <span><ShieldCheck size={14} /> Fianza de {eur(reserva.fianza)} retenida · fotos de entrega disponibles próximamente</span>
      <button className="link-inline" onClick={() => onSimularVistoBueno(reserva.id)}>Simular visto bueno del propietario (demo) →</button>
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
function Ventajas({ onExplorar, onPublicar }) {
  return (
    <div className="ventajas">
      <section className="v-hero" style={{ backgroundImage: `linear-gradient(120deg, rgba(15,39,50,.9) 0%, rgba(15,39,50,.72) 45%, rgba(18,48,61,.55) 100%), url(${VENTAJAS_FOTO})` }}>
        <span className="eyebrow claro">Programa de recompensas</span>
        <h1 className="serif v-h1">Cuanto más navegas, más ganas</h1>
        <p className="v-sub">Y cuanto más alquilas tu barco, menos cuesta mantenerlo. Marea no es solo un marketplace: es una comunidad que premia a quien alquila y a quien comparte su embarcación.</p>
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
      </section>

      <section className="seccion recompensa-compartida">
        <span className="eyebrow claro">La idea estrella</span>
        <h2 className="serif">Recompensa Compartida</h2>
        <p>Cuando un propietario alcanza un hito (25 o 50 alquileres), Marea premia <b>al propietario y a todos los clientes</b> que alquilaron ese barco en ese periodo. El dueño recibe un vale de mantenimiento; los clientes, un cupón o entran en el sorteo de un alquiler gratis. Todos sienten que forman parte del éxito.</p>
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

/* ── Publicar ────────────────────────────────────────────────────── */
function Publicar({ onDone, onPublicado }) {
  const [clase, setClase] = useState("barco");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [act, setAct] = useState(ACTIVIDADES[0]);
  const [matTipo, setMatTipo] = useState(MATERIALES[0]);
  const [zonaPub, setZonaPub] = useState(ZONAS[1]);
  const [precio, setPrecio] = useState(350);
  const [matricula, setMatricula] = useState("");
  const [poliza, setPoliza] = useState("");
  const [caducidadSeguro, setCaducidadSeguro] = useState("");
  const [consiento, setConsiento] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { estado: verificacion, iniciar: iniciarVerificacion } = useVerificacionAutomatica();
  const esExp = clase === "experiencia", esMat = clase === "material";
  const uni = esExp ? "persona" : "día";
  const clientePaga = Math.round(precio * (1 + COMISION));
  const tuComision = clientePaga - precio;
  const faltaDocumentacion = !consiento || !poliza.trim() || !caducidadSeguro || (!esExp && !esMat && !matricula.trim());

  const publicar = () => {
    if (faltaDocumentacion) return;
    iniciarVerificacion(() => {
      onPublicado({
        id: Date.now(), nombre: nombre.trim() || (esExp ? "Tu experiencia" : esMat ? "Tu material" : "Tu barco"),
        tipo: esExp ? act : esMat ? matTipo : tipo, dia: precio, unidad: uni, zona: zonaPub,
        matricula: matricula.trim(), poliza: poliza.trim(), caducidadSeguro, estado: "En revisión",
      });
      setEnviado(true);
    });
  };

  if (enviado) return (<div className="publicar"><div className="ok centro"><div className="ok-icon"><Check size={28} strokeWidth={3} /></div><h3 className="serif">¡Recibido!</h3><p>Documentación verificada automáticamente. Un revisor de Marea le dará el visto bueno final antes de publicarlo. Lo tienes en <strong>Mis anuncios</strong>.</p><button className="btn-primario ancho" onClick={onDone}>Ir a mi panel</button></div></div>);

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
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><Field label="Punto de salida" ph="Grao de Castellón" /></Fila>
              <Fila><Field label="Plazas" ph="5" /><Field label="Duración" ph="4 h" /></Fila>
              <label className="field"><span>Precio / persona (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label>
            </>
          ) : esMat ? (
            <>
              <Fila><label className="field"><span>Nombre</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tabla SUP hinchable 10'6&quot;" /></label><label className="field"><span>Tipo</span><select value={matTipo} onChange={(e) => setMatTipo(e.target.value)}>{MATERIALES.map((o) => <option key={o}>{o}</option>)}</select></label></Fila>
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><Field label="Entrega / playa" ph="Peñíscola" /></Fila>
              <Fila><Field label="Precio / hora (€)" ph="12" /><label className="field"><span>Precio / día (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label></Fila>
            </>
          ) : (
            <>
              <Fila><label className="field"><span>Nombre del barco</span><input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Lagoon 42 Catamarán" /></label><label className="field"><span>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map((o) => <option key={o}>{o}</option>)}</select></label></Fila>
              <Fila><Select label="Zona" opts={ZONAS.slice(1)} value={zonaPub} onChange={setZonaPub} /><Field label="Puerto base" ph="Puerto de Mahón, Menorca" /></Fila>
              <Fila><Field label="Eslora (m)" ph="12.6" /><Field label="Plazas" ph="10" /></Fila>
              <Fila><Select label="Lista (matrícula)" opts={["6ª", "7ª"]} /><Select label="¿Ofreces patrón?" opts={["No, sin patrón", "Opcional", "Siempre con patrón"]} /></Fila>
              <Fila><Field label="Precio / hora (€)" ph="180" /><label className="field"><span>Precio / día (€)</span><input type="number" value={precio} onChange={(e) => setPrecio(+e.target.value || 0)} /></label></Fila>
            </>
          )}
          <label className="field"><span>Descripción</span><textarea rows={3} placeholder="Cuenta qué lo hace especial…" /></label>
          <div className="fotos-drop"><Plus size={16} /> Añadir fotos</div>

          <h3 className="serif bloque-tit">Documentación y verificación</h3>
          {!esExp && !esMat && <label className="field"><span>Número de matrícula</span><input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="7ª-CS-1234-56" /></label>}
          <Fila>
            <label className="field"><span>Aseguradora y nº de póliza</span><input value={poliza} onChange={(e) => setPoliza(e.target.value)} placeholder="Mapfre 123456789" /></label>
            <label className="field"><span>Caducidad del seguro</span><input type="date" value={caducidadSeguro} onChange={(e) => setCaducidadSeguro(e.target.value)} /></label>
          </Fila>
          <div className="fotos-drop"><Plus size={16} /> Adjuntar documentación (próximamente)</div>
          <ConsentimientoLegal checked={consiento} onChange={setConsiento} texto="la documentación de este anuncio (matrícula, póliza y certificados)" />

          <button className="btn-primario ancho" onClick={publicar} disabled={faltaDocumentacion || verificacion === "verificando"}>
            {verificacion === "verificando" ? "Verificando automáticamente…" : "Publicar"}
          </button>
          {faltaDocumentacion && <p className="mini-nota">Completa la documentación y acepta el tratamiento de datos para poder publicar.</p>}
        </div>
        <aside className="ganancias">
          <span className="eyebrow claro">Con precio de {eur(precio)}/{uni}</span>
          <div className="gan-linea"><span>El cliente paga</span><span className="precio blanco"><b>{eur(clientePaga)}</b></span></div>
          <div className="gan-detalle"><div><span>Tu tarifa</span><span>{eur(precio)}</span></div><div className="gan-com"><span>Gastos de servicio ({COMISION * 100}%)</span><span>{eur(tuComision)}</span></div></div>
          <div className="gan-total"><span>Tú recibes</span><span className="precio verde"><b>{eur(precio)}</b></span></div>
          <p className="gan-nota">Los {eur(tuComision)} de servicio son lo que gana Marea, sin tocar tu tarifa.</p>
        </aside>
      </div>
    </div>
  );
}
const Fila = ({ children }) => <div className="fila">{children}</div>;
const Field = ({ label, ph }) => (<label className="field"><span>{label}</span><input placeholder={ph} /></label>);
const Select = ({ label, opts, value, onChange }) => (<label className="field"><span>{label}</span><select value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>{opts.map((o) => <option key={o}>{o}</option>)}</select></label>);

/* ── Consentimiento de datos (RGPD) ──────────────────────────────── */
function ConsentimientoLegal({ checked, onChange, texto }) {
  return (
    <label className="consentimiento">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>He leído y acepto que Marea trate {texto} exclusivamente para verificar {texto.includes("licencia") ? "esta reserva" : "este anuncio"}, conforme al RGPD (Reglamento UE 2016/679). No se cederán a terceros salvo obligación legal, y puedo pedir su supresión escribiendo a soporte@marea.com.</span>
    </label>
  );
}

/* Verificación automática simulada: no existe una API pública en España para
   comprobar licencias de navegación o matrículas contra un registro oficial,
   así que este paso queda a la espera de un servicio de verificación real
   (o revisión manual de Marea) más adelante. */
function useVerificacionAutomatica() {
  const [estado, setEstado] = useState("idle"); // idle | verificando | verificado
  const iniciar = (callback) => {
    setEstado("verificando");
    setTimeout(() => { setEstado("verificado"); callback && callback(); }, 1400);
  };
  return { estado, iniciar };
}

/* Genera 1-2 reservas de mentira sobre un anuncio recién publicado, para poder
   probar el programa "Cuida tu Barco" sin tener clientes reales todavía. */
const CLIENTES_FAKE = ["Marta G.", "Javier R.", "Laura P.", "Diego M.", "Sara L."];
function generarReservasFake(barco) {
  const precio = barco.dia || 100;
  const crear = (diasInicio, diasFin) => {
    const ini = new Date(); ini.setDate(ini.getDate() + diasInicio); ini.setHours(10, 0, 0, 0);
    const fin = new Date(); fin.setDate(fin.getDate() + diasFin); fin.setHours(19, 0, 0, 0);
    const subtotal = precio * Math.max(1, diasFin - diasInicio);
    const servicio = Math.round(subtotal * COMISION);
    const fianza = Math.round(subtotal * FIANZA_PCT);
    return {
      id: Date.now() + Math.round(Math.random() * 100000), barcoId: barco.id, barco: barco.nombre, zona: barco.zona,
      cliente: CLIENTES_FAKE[Math.floor(Math.random() * CLIENTES_FAKE.length)],
      subtotal, servicio, total: subtotal + servicio, fianza, fianzaEstado: "retenida",
      inicioISO: ini.toISOString(), finISO: fin.toISOString(), estado: "confirmada",
    };
  };
  return [crear(-9, -7), crear(6, 8)];
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

  const ir = (v) => { setVista(v); setMenu(false); window.scrollTo(0, 0); };
  const abrir = (x) => { setItem(x); setVista("ficha"); setMenu(false); window.scrollTo(0, 0); };
  const abrirAuth = (tab = "entrar", rolPre = null, pendiente = null) => { setAuth({ tab, rolPre, pendiente }); setMenu(false); };
  const completarAuth = (u) => { const p = auth?.pendiente; setUsuario(u); setAuth(null); if (p === "publicar") { setVista("publicar"); window.scrollTo(0, 0); } else if (p !== "reservar") { setVista("panel"); window.scrollTo(0, 0); } };
  const cerrarSesion = () => { setUsuario(null); setReservas([]); setMisBarcos([]); setReservasRecibidas([]); setFavoritos([]); setAvisosPropietario(0); ir("home"); };
  const irPublicar = () => (usuario ? ir("publicar") : abrirAuth("registro", "propietario", "publicar"));
  const setClaseReset = (c) => { setClase(c); setTipo(null); };
  const abrirCategoria = (c) => { setClase(c.clase); setTipo(c.key); setSoloPatron(false); ir("explorar"); };
  const toggleFav = (b) => setFavoritos((p) => (p.find((x) => x.id === b.id) ? p.filter((x) => x.id !== b.id) : [b, ...p]));
  const confirmarCancelacion = () => { setReservas((p) => p.filter((r) => r.id !== cancelando.id)); setCancelando(null); };
  const finalizarReservaRecibida = (id) => setReservasRecibidas((p) => p.map((r) => (r.id === id ? { ...r, estado: "finalizada", fianzaEstado: r.fianzaEstado ? "liberada" : r.fianzaEstado } : r)));
  const simularVistoBueno = (id) => setReservas((p) => p.map((r) => (r.id === id ? { ...r, fianzaEstado: "liberada" } : r)));
  const guardarEspecificaciones = (id, motorModelo, motorNotas) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, motorModelo, motorNotas } : b)));
  const guardarResena = (estrellas, comentario) => {
    setReservas((p) => p.map((r) => (r.id === resenando.id ? { ...r, estado: "finalizada", resena: { estrellas, comentario } } : r)));
    setResenando(null);
  };
  const confirmarCancelacionPropietario = (justificado) => {
    setReservasRecibidas((p) => p.filter((r) => r.id !== cancelandoProp.id));
    if (!justificado) setAvisosPropietario((p) => p + 1);
    setCancelandoProp(null);
  };
  const activarUltimaHora = (id, descuento) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, ultimaHora: { activo: true, descuento } } : b)));
  const desactivarUltimaHora = (id) => setMisBarcos((p) => p.map((b) => (b.id === id ? { ...b, ultimaHora: { activo: false, descuento: 0 } } : b)));
  const quitarFiltros = () => { setClaseReset("todo"); setZona("Todas"); setSoloPatron(false); setQ(""); };

  const subChips = clase === "experiencia" ? ACTIVIDADES : clase === "material" ? MATERIALES : clase === "barco" ? TIPOS : null;

  const filtrados = useMemo(() => TODOS.filter((x) => {
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
  }), [clase, tipo, zona, soloPatron, q]);

  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="ribbon">Cuanto más navegas, más ganas · El barco es de otro, el día es tuyo</div>

      <header className="nav">
        <button className="marca" onClick={() => ir("home")}><LogoMarea /><span className="marca-txt"><span className="serif wordmark">Marea</span><span className="marca-tag">Alquila el mar</span></span></button>
        <nav className={`links ${menu ? "abierto" : ""}`}>
          <button onClick={() => { setClaseReset("barco"); setSoloPatron(false); ir("explorar"); }}>Embarcaciones</button>
          <button onClick={() => { setClaseReset("experiencia"); ir("explorar"); }}>Experiencias</button>
          <button onClick={() => ir("ventajas")}>Ventajas</button>
          <button onClick={irPublicar}>Publica lo tuyo</button>
          {usuario ? (<><button className="perfil-link" onClick={() => ir("panel")}><span className="avatar-mini">{iniciales(usuario.nombre)}</span> Mi panel</button><button className="btn-salir" onClick={cerrarSesion}><LogOut size={16} /></button></>)
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

          <section className="seccion">
            <div className="sec-head"><h2 className="serif">Destacados esta semana</h2><button className="link-mas" onClick={() => { setClaseReset("todo"); ir("explorar"); }}>Ver todo →</button></div>
            <div className="grid">{[BARCOS[7], EXPERIENCIAS[0], BARCOS[1], MATERIAL[0]].map((b) => <Tarjeta key={b.id} item={b} onOpen={abrir} />)}</div>
          </section>

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
          <div className="explorar-head"><h1 className="serif">{filtrados.length} resultados{zona !== "Todas" ? ` en ${zona}` : " en toda España"}</h1><p className="sub">Cancela sin recargo hasta 48 h antes · anfitriones verificados</p></div>
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
          {filtrados.length ? <div className="grid">{filtrados.map((b) => <Tarjeta key={b.id} item={b} onOpen={abrir} />)}</div>
            : <div className="vacio"><Sailboat size={30} /><p>No hay resultados con esos filtros.</p><button className="btn-sec" onClick={quitarFiltros}>Quitar filtros</button></div>}
        </section>
      )}

      {vista === "ficha" && item && (<Ficha item={item} usuario={usuario} numReservas={reservas.filter((r) => r.estado === "finalizada").length} onBack={() => ir("explorar")} onAbrir={abrir} esFavorito={!!favoritos.find((x) => x.id === item.id)} onToggleFav={toggleFav} onNecesitaCuenta={() => abrirAuth("registro", "cliente", "reservar")} onReservado={(r) => setReservas((p) => [r, ...p])} />)}
      {vista === "ventajas" && <Ventajas onExplorar={() => { setClaseReset("todo"); ir("explorar"); }} onPublicar={irPublicar} />}
      {vista === "publicar" && usuario && <Publicar onDone={() => ir("panel")} onPublicado={(b) => { setMisBarcos((p) => [b, ...p]); setReservasRecibidas((p) => [...generarReservasFake(b), ...p]); }} />}
      {vista === "panel" && usuario && (<Panel usuario={usuario} reservas={reservas} misBarcos={misBarcos} reservasRecibidas={reservasRecibidas} avisosPropietario={avisosPropietario} favoritos={favoritos} onExplorar={() => { setClaseReset("todo"); ir("explorar"); }} onPublicar={irPublicar} onAbrir={abrir} onSalir={cerrarSesion} onVentajas={() => ir("ventajas")} onCancelar={setCancelando} onFinalizar={setResenando} onFinalizarRecibida={finalizarReservaRecibida} onSimularVistoBueno={simularVistoBueno} onEspecificar={setEspecificando} onCancelarRecibida={setCancelandoProp} onActivarUltimaHora={activarUltimaHora} onDesactivarUltimaHora={desactivarUltimaHora} />)}

      {auth && <AuthModal tab={auth.tab} rolPre={auth.rolPre} onClose={() => setAuth(null)} onCambiarTab={(t) => setAuth((a) => ({ ...a, tab: t }))} onAuth={completarAuth} />}
      {cancelando && <CancelarModal reserva={cancelando} onClose={() => setCancelando(null)} onConfirmar={confirmarCancelacion} />}
      {especificando && <EspecificacionesModal barco={especificando} onClose={() => setEspecificando(null)} onGuardar={(modelo, notas) => guardarEspecificaciones(especificando.id, modelo, notas)} />}
      {cancelandoProp && <CancelarPropietarioModal reserva={cancelandoProp} onClose={() => setCancelandoProp(null)} onConfirmar={confirmarCancelacionPropietario} />}
      {resenando && <ResenaModal reserva={resenando} onClose={() => setResenando(null)} onGuardar={guardarResena} />}

      <footer className="footer" style={{ backgroundImage: `linear-gradient(rgba(15,39,50,.88), rgba(15,39,50,.94)), url(${FOOTER_FOTO})` }}>
        <div className="foot-marca"><LogoMarea size={34} /><div><span className="serif wordmark blanco">Marea</span><p className="foot-tag">Alquila el mar · Barcos, experiencias y material náutico entre particulares, en toda España.</p></div></div>
        <div className="foot-cols">
          <div><h4>Explorar</h4><button onClick={() => { setClaseReset("barco"); ir("explorar"); }}>Barcos</button><button onClick={() => { setClaseReset("experiencia"); ir("explorar"); }}>Experiencias</button><button onClick={() => { setClaseReset("material"); ir("explorar"); }}>SUP y kayak</button></div>
          <div><h4>Marea</h4><button onClick={() => ir("ventajas")}>Ventajas</button><button onClick={irPublicar}>Publica lo tuyo</button><button onClick={() => ir("home")}>Cómo funciona</button></div>
          <div><h4>Ayuda</h4><button onClick={() => ir("home")}>Contacto</button><button onClick={() => ir("home")}>Preguntas frecuentes</button><button onClick={() => ir("home")}>Cancelaciones</button></div>
        </div>
      </footer>
      <div className="foot-legal">Prototipo · Marea © 2026</div>
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
.fotos-drop{display:flex;align-items:center;justify-content:center;gap:8px;padding:22px;border:1.5px dashed var(--linea);border-radius:12px;color:var(--muted);font-size:13.5px;margin-bottom:14px}
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
  .ficha-grid,.pub-grid{grid-template-columns:1fr}
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
}
@media(max-width:480px){
  .modal-overlay{padding:12px}
  .modal{padding:22px;max-height:94vh}
  .ok.centro{padding:26px;margin:28px auto}
  .rol-chips .rc,.clase-pub .cp{min-width:0;flex:1 1 45%}
}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
`;
