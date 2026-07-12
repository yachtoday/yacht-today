# Yacht Today — contexto del proyecto

Yacht Today es un **marketplace náutico entre particulares** para toda España. Conecta a
propietarios con personas que quieren disfrutar del mar. Lema: "Alquila el mar".

## Qué se puede publicar/reservar (3 clases)
1. **Barco** — se alquila por horas o por días, con o sin patrón.
2. **Experiencia** — el anfitrión NO deja el barco: te lleva él (pesca, submarinismo,
   ruta en paddle surf, kayak, atardecer). Se reserva **por persona**.
3. **Material** — tabla de paddle surf (SUP) o kayak que un particular alquila por horas/días.

## Modelo de negocio
- La plataforma cobra una **comisión de servicio del 15%** que paga quien alquila
  (se suma al precio del propietario; el propietario recibe su tarifa íntegra).
- Constante `COMISION` en `src/App.jsx`.

## Programa de recompensas (diferenciador)
- Clientes: niveles Explorer → Captain → Navigator → Admiral; descuento en gastos de
  gestión (3 alquileres = 50%, 5 = 100%); insignias y retos.
- Propietarios: "Cuida tu Barco" (3/10/20/40 alquileres → kits, revisiones, equipamiento);
  distintivo Propietario Premium.
- Idea estrella: "Recompensa Compartida" (al alcanzar un hito, se premia al propietario
  y a los clientes de ese barco).

## Stack actual
- Vite + React 18, iconos `lucide-react`. Casi todo en `src/App.jsx` (un solo componente).
- Backend: **Supabase** (`src/lib/supabaseClient.js`, `src/lib/anuncios.js`; claves en `.env` — no se commitea).
- Auth, anuncios, sus fotos y las reservas de clientes ya son reales, en Supabase.
  Las "reservas recibidas" de un propietario mezclan reservas reales con algunas de
  mentira generadas al publicar (para probar "Cuida tu Barco" sin clientes reales).

## Identidad visual (diseño "Yacht Today", respétalo)
- Tipografías: titulares **Newsreader** (serif), interfaz **Hanken Grotesk** (importadas por CSS).
- Paleta: azul noche #16323F, azul mar #3E7CA6, azul brisa #7FB2CE, arena #F5EFE4,
  arena cálida #E7DFCF; acentos coral #D6706A, oro #E6C15F, salvia #7FB39A.

## Backend real con Supabase — progreso
1. ✅ **Fase 1 — Auth**: registro/login/logout reales con email y contraseña
   (`supabase.auth`), sesión persistente vía `onAuthStateChange`. El rol
   (cliente/propietario/ambas) y el teléfono se guardan en `user_metadata`.
   Correo de confirmación personalizado ("Yacht Today") vía SMTP de Resend.
2. ✅ **Fase 2 — Anuncios**: tabla `anuncios` en Postgres (con RLS: cualquiera ve los
   "Publicado", cada propietario ve y crea los suyos). "Publicar" inserta de verdad;
   "Explorar", portada y "Mis anuncios" leen de Supabase. Los 20 anuncios de ejemplo
   viven ahora como filas reales (`supabase/schema.sql`) en vez de arrays en el código.
3. ✅ **Fase 3 — Fotos**: bucket público `fotos-anuncios` en Storage (`supabase/storage.sql`),
   subida real desde "Publicar" (hasta 6 fotos, con previsualización) guardadas en la
   columna `fotos` (array de URLs). Los anuncios sin fotos (los 20 de ejemplo) siguen
   mostrando el color/dibujo generado, como antes.
4. ✅ **Fase 4 — Reservas**: tabla `reservas` en Postgres (`supabase/reservas.sql`), con RLS
   (el cliente ve/gestiona las suyas, el propietario ve/gestiona las que recibe). Reservar,
   cancelar (cliente y propietario), liberar fianza y dejar reseña ya actualizan la fila real.
   La reserva se confirma al instante (sin que el propietario tenga que aprobarla).
   Aviso por email al propietario: Edge Function `supabase/functions/notificar-reserva`
   (usa el service role para buscar el email del propietario y la API de Resend para
   enviarlo). Mientras Resend esté en modo pruebas, solo llega si el propietario es la
   cuenta con la que se creó Resend — se arregla verificando el dominio (ver más abajo).
5. ✅ **Eliminar anuncios**: botón de papelera en "Mis anuncios" (con confirmación); borra
   también sus reservas asociadas (RLS de borrado propio en `supabase/eliminar-anuncios.sql`).
6. ✅ **Fase 6 — Pagos**: **Stripe Connect** (cuentas Express). El propietario activa cobros
   desde "Mi panel → Cobros" (Edge Function `crear-cuenta-stripe`, requiere verificación de
   identidad de Stripe — en modo test se pasa con el botón "Simular" del onboarding, los
   datos falsos manuales no valen). Al reservar, `crear-pago` crea una sesión de Stripe
   Checkout con `application_fee_amount` (la comisión del 15%) y `transfer_data.destination`
   al propietario; el webhook `webhook-stripe` (verifica la firma de Stripe, sin JWT de
   usuario — `verify_jwt: false`) es el único sitio que crea la fila en `reservas` como
   pagada/confirmada. Probado de extremo a extremo en modo test el 2026-07-11.
7. ✅ **Antelación mínima de reservas**: nadie puede reservar en el último minuto y dejar
   al propietario sin margen. Mínimo 3 h (barco/material) o 24 h (experiencia) entre
   reservar y el inicio; el propietario puede fijar su propio mínimo por anuncio
   (`aviso_minimo_horas` en `anuncios`, editable al publicar). Regla de seguridad que
   ningún propietario puede desactivar: si se reserva entre las 22:00 y las 8:00, el
   alquiler no puede empezar hasta pasado mañana como muy pronto. Se valida en el
   cliente (`Ficha` en `src/App.jsx`, deshabilita el botón y avisa) y, de forma
   autoritativa, en el servidor (`supabase/functions/crear-pago/index.ts` rechaza la
   sesión de pago si no se cumple).
8. ✅ **Equipamiento y servicios por anuncio**: al publicar, el propietario marca qué
   ofrece de una lista típica por clase (`EQUIPAMIENTO_TIPICO` en `src/App.jsx`) y puede
   añadir los suyos propios en texto libre; se guarda en la columna `equipamiento`
   (`text[]`) de `anuncios`. Los anuncios de ejemplo sin este campo siguen mostrando un
   listado por defecto (fallback), no se rompen.
9. ✅ **Publicidad de Spen Mechanics S.L.** (empresa personal de Eric): página propia
   (`vista === "mantenimiento"`, componente `SpenMechanics` en `src/App.jsx`) con enlaces
   reales a `www.spenmechanics.com`. Colocada de forma visible en **Ventajas** y en **Mi
   panel** del propietario (no solo en el pie de página, a propósito — es donde de verdad
   se ve). **Ojo:** Spen Mechanics **todavía no se dedica a la náutica** (se dedica a otra
   cosa); Eric quiere llevarla hasta ahí, y Yacht Today es parte de ese plan. O sea que
   **no es una fuente de propietarios ya hechos**: hoy no hay clientes náuticos que captar.
10. ✅ **Documentación real de propietarios**: no existe una API pública en España para
    verificar matrículas, licencias o seguros contra un registro oficial (por eso
    `useVerificacionAutomatica` sigue siendo un paso simulado — solo bloquea el doble
    envío mientras se sube todo, ya no dice "verificado automáticamente"). Lo que sí se
    arregló es que la revisión manual del admin ahora es una revisión informada de
    verdad: el propietario adjunta el documento real (foto o PDF) a un bucket **privado**
    (`documentos-anuncios`, `supabase/documentos.sql` — solo el propio dueño y
    `yachtoday@gmail.com` pueden verlo, con URLs firmadas de 2 min vía
    `urlFirmadaDocumento`), y "Anuncios pendientes de revisión" en Mi panel muestra
    matrícula/póliza/caducidad del seguro y un botón "Ver documento" por archivo. Se
    bloquea publicar (cliente) con una fecha de caducidad de seguro ya pasada — el único
    chequeo automatizable sin ninguna API externa — y se avisa en rojo al admin si un
    anuncio ya en revisión tiene el seguro caducado.
11. ✅ **En producción con dominio propio**: la web está publicada en Vercel (proyecto
    `yacht-today`, auto-deploy en cada push a `master`) y se sirve en
    **https://yachtoday.com** (y `www`). El dominio se compró en **Namecheap** pero su
    **DNS está delegado a Vercel** (nameservers `ns1/ns2.vercel-dns.com`), así que los
    registros se gestionan con `vercel dns add ...`, no desde Namecheap.
12. ✅ **Correo real a cualquier usuario**: el dominio está **verificado en Resend**
    (registros DKIM/SPF/DMARC en el DNS de Vercel), así que ya no aplica el modo sandbox
    — **cualquier persona puede registrarse**, no solo la cuenta de Eric. Los correos de
    confirmación de Auth salen de `no-reply@yachtoday.com` (SMTP de Resend configurado en
    Supabase) y los avisos de reserva de `reservas@yachtoday.com`
    (`supabase/functions/notificar-reserva`). La `site_url` de Supabase Auth apuntaba a
    `http://localhost:5173` (los enlaces de los correos no habrían funcionado para nadie);
    ahora es `https://yachtoday.com`, con `localhost` aún permitido para desarrollo.

## Producción: cuidado con las claves largas en paneles web
`VITE_SUPABASE_ANON_KEY` se pegó a mano en el panel de Vercel y quedó **cortada a mitad
del JWT** por un salto de línea (llegaban 132 de 208 caracteres): la web publicada no
cargaba nada de Supabase y mostraba "0 resultados". Regla: los valores largos se suben
siempre por stdin desde el `.env` (`printf '%s' "$KEY" | vercel env add ...`), nunca
copiando y pegando. Ojo además: las variables están marcadas como "Sensitive", así que
`vercel env pull` las devuelve **vacías** — eso no significa que estén mal; la única forma
de comprobarlas es desplegar e inspeccionar el bundle servido.

## Revisión de anuncios (rol admin) y por qué está protegido
Sí existe un "revisor": la cuenta `yachtoday@gmail.com` (`ADMIN_EMAIL` en `src/App.jsx`)
ve "Anuncios pendientes de revisión" y los aprueba (`En revisión` → `Publicado`) o los
rechaza desde la app — RLS en `supabase/admin.sql` le da SELECT/UPDATE global sobre
`anuncios`. La política `anuncios_update_propio` (cada propietario puede editar lo suyo)
no restringía la columna `estado` por sí sola, así que un propietario podía auto-aprobar
su propio anuncio saltándose la revisión. Se cerró con un trigger `BEFORE UPDATE`
(`supabase/proteger-revision-anuncios.sql`) que bloquea cualquier cambio de `estado` que
no venga del email admin, sea cual sea la política RLS que dejó pasar la petición —
verificado en producción: un `UPDATE ... SET estado` sin JWT de admin es rechazado y la
fila no se modifica.
Para aprobar un anuncio a mano sin pasar por la app (ej. pruebas):
`update public.anuncios set estado = 'Publicado' where id = <id>;` ejecutado como
`postgres` en el SQL Editor de Supabase (ese rol sí se salta RLS y el trigger, a
diferencia de cualquier usuario real de la app).

## Seguridad: claves y secretos
- El cliente (`src/App.jsx`, bundle final) solo lleva las variables `VITE_*` de `.env`:
  la **anon key** de Supabase (pública por diseño, protegida por RLS — no un secreto) y
  la API key de AEMET (uso menor, no crítico). Ninguna clave de Stripe ni la
  `SUPABASE_SERVICE_ROLE_KEY` viaja al navegador: viven solo como secretos de las Edge
  Functions (`crear-pago`, `crear-cuenta-stripe`, `webhook-stripe`, `notificar-reserva`),
  confirmado por grep sobre todo `src/`.
- La autorización real no depende de "ocultar" la anon key sino de las políticas RLS de
  cada tabla y de que ciertas operaciones (crear una reserva como pagada, cambiar el
  `estado` de un anuncio) solo puedan hacerlas las Edge Functions o el admin, nunca el
  navegador directamente — verificado con pruebas reales (`curl` sin sesión intentando
  insertar una reserva "pagada": rechazado por RLS; ver también el trigger de arriba).

## Captación de propietarios: el problema nº1 ahora mismo
La web está terminada y en producción, pero con **cero anuncios y cero propietarios**. Lo
que falta no es código, es **oferta**. Plan acordado con Eric: contactar **a mano, uno a
uno** a los propietarios que ya anuncian su barco en **Wallapop** (guion completo en
`docs/mensaje-propietarios-wallapop.md`). Nada de mensajes masivos ni robots: Wallapop
prohíbe captar usuarios hacia otros servicios y le cerrarían la cuenta.
- **`yachtoday.com/propietarios`** (componente `Propietarios`) es la página a la que se
  enlaza desde fuera: la portada está escrita para quien quiere alquilar un barco, no para
  quien lo tiene. Necesita el rewrite de SPA de `vercel.json` o daría 404.
- El tono honesto ("Acabamos de abrir, y todavía no tenemos clientes") es **deliberado**:
  el propietario lo va a comprobar en dos clics, y decirlo primero —junto con "gratis, sin
  exclusividad, sigue en Wallapop"— es lo que convierte la debilidad en un sí fácil.
- **Publicidad de pago: todavía no.** Traer clientes a una web sin barcos es tirar el
  dinero. Primero oferta (unos 10-15 barcos **en una sola zona**), luego demanda.
- Idea pendiente que Eric aparcó: **lista de espera de clientes por zona**, para poder
  decirle a un propietario "tengo N personas esperando barco en tu zona". Es la forma
  honesta de fabricar la prueba de demanda que hoy no existe.

## SEO y vista previa de los enlaces
Hecho (2026-07-12): `title`/`description` reales, canonical, JSON-LD de Organization,
`public/robots.txt` y `public/sitemap.xml` (ojo: el rewrite de SPA hacía que `/robots.txt`
devolviese HTML — por eso `vercel.json` excluye los estáticos), y **Open Graph**.
`propietarios.html` es una **segunda entrada de Vite** (`vite.config.js`): monta la misma
app de React y solo cambian las `<meta>`, para que al pegar el enlace en Wallapop o
WhatsApp la tarjeta de vista previa le hable **al dueño del barco** y no al turista.

**Lo que NO está hecho, y es donde vive el SEO de verdad:** la app no tiene URLs propias
por anuncio ni por zona — todo es estado (`vista`), así que Google solo tiene dos páginas
que indexar. Para rankear por "alquiler de barcos en Denia" hacen falta rutas reales
(`/barco/123-quicksilver-675-denia`, `/alquiler-barcos/denia`) y probablemente
prerenderizado, porque es una SPA. **Es prematuro: sin anuncios no hay contenido que
indexar.** El SEO va detrás de la oferta, no delante.

## La fianza (leer antes de tocar pagos)
Hasta el 2026-07-12 **la fianza era una etiqueta vacía**: `crear-pago` cobraba solo
alquiler + comisión y guardaba `fianza_estado='retenida'`. Al cliente se le decía que se le
retenía una fianza y al propietario que estaba cubierto, pero **no se retenía ni un
céntimo**. Se descubrió al hacer la primera reserva real.

Cómo funciona ahora (`supabase/fianza-real.sql`):
- Al pagar, Stripe **guarda la tarjeta** del cliente (`customer_creation: "always"` +
  `setup_future_usage: "off_session"`). No se le cobra ni se le bloquea nada, y así se le
  dice con esas palabras. El webhook guarda `stripe_customer_id` y `stripe_payment_method_id`.
- Si al terminar el propietario reporta daños, la Edge Function **`cobrar-fianza`** hace un
  cargo off-session por el importe de la fianza. Va **íntegro al propietario**: sin
  `application_fee` — la plataforma no se lleva comisión de un destrozo.
- Estados: `garantizada` (tarjeta guardada, nada cobrado) → `liberada` (visto bueno) o
  `cobrada` (hubo daños). `retenida` solo existe en las reservas anteriores al cambio, que
  **no tienen tarjeta guardada y no se les puede cobrar nada**.
- El servidor exige que quien llama sea el propietario de esa reserva, que el alquiler
  **ya haya terminado** (`fin_iso < now`), y que no se haya cobrado ya. Verificado en
  producción el 2026-07-12: cobro real de 100 €, segundo intento rechazado, y rechazo al
  intentar cobrar una reserva que aún no ha terminado.
- **Se descartó la retención real en tarjeta** (manual capture): caduca a los 7 días, así
  que una reserva hecha con tres semanas de antelación se quedaría sin bloqueo. Guardar la
  tarjeta funciona siempre, a cambio de que el cliente podría cancelarla.
- La fianza del **material** (SUP y kayak) la fija el propietario en euros; la de los barcos
  sigue siendo el 20 % del alquiler (`FIANZA_PCT`).

## Nada falso en producción (2026-07-12)
Al abrir la web al público se quitaron tres cosas que eran de mentira y que en un sitio
real dejaban de ser inocentes:
- **Botón "Simular visto bueno del propietario (demo)"**: lo veía **el cliente** en su
  reserva y **liberaba su propia fianza** de verdad en la base de datos, sin que el
  propietario aprobase nada. La fianza ahora solo se libera por la vía legítima, cuando el
  propietario da la reserva por finalizada (`finalizarReservaRecibida`).
- **`generarReservasFake`**: al publicar un anuncio se fabricaban 1-2 reservas de clientes
  inventados. Además de ser mentira, contaban para "Cuida tu Barco", así que un propietario
  podía reclamar kits reales por alquileres que nunca existieron. Eliminado: `reservasRecibidas`
  ya solo tiene filas reales de Supabase.
- **Los 20 anuncios de ejemplo** (los que no tienen `propietario_id`): `supabase/borrar-anuncios-ejemplo.sql`.
  No se podían pagar (`crear-pago` rechaza los anuncios sin propietario), pero eran barcos
  que no existen. **Decisión consciente: no se sustituyen por anuncios falsos "bonitos".**
  Con la web vacía, la portada y "Explorar" muestran una invitación honesta a los
  propietarios (bloque `.arranque`) en vez de un catálogo desierto o un "no hay resultados
  con esos filtros" que echaba la culpa a los filtros.

## Correo entrante: `soporte@yachtoday.com` y cualquier otra dirección
Resend **envía** pero no recibe, así que el correo entrante lo hace **ImprovMX** (plan
gratuito, cuenta de `yachtoday@gmail.com`): registros MX (`mx1`/`mx2.improvmx.com`) y SPF
en el DNS de Vercel, y un **alias comodín `*@yachtoday.com` → `yachtoday@gmail.com`**. O
sea que `soporte@`, `info@`, `hola@`… todas llegan al Gmail del negocio sin configurar nada
más. Verificado el 2026-07-12. (Cloudflare Email Routing **no** vale aquí: exige sus
propios nameservers y el DNS vive en Vercel.)

El SPF de ImprovMX va en el dominio raíz y el de Resend en el subdominio `send.` — por eso
conviven sin pisarse: Resend firma con DKIM (`resend._domainkey`) y usa `send.yachtoday.com`
como Return-Path, así que el SPF de la raíz no afecta al envío.

## Notas de trabajo
- El usuario (Eric) es no técnico: explica los pasos de forma sencilla y ve poco a poco.
- Antes de cambios grandes, propón un plan y espera su OK.
- Mantén el diseño y el desglose de precios con la comisión siempre visible.
