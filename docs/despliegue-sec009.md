# Despliegue · SEC-009 (bloque C: notificar-anuncio/-recompensa/-cancelacion sin candado)

> Cierra la fuga: hoy cualquier cuenta puede invocar `notificar-anuncio`, `notificar-recompensa` o
> `notificar-cancelacion` con datos inventados y hacer que Marea mande un correo con su marca a un
> tercero. `notificar-reserva` y `notificar-solicitud-efectivo` YA están cerradas (exigen
> service role) desde el 2026-07-16. `notificar-mensaje` tiene su propio candado fino (auth de
> participante) y se despliega SOLA, sin nada de este documento — no lo necesita.
>
> Construido y verificado en `yacht-dev` el 2026-07-23/24. **NADA en producción todavía.**

## La idea

Las tres funciones pasan a exigir **service role exacto** (como `notificar-reserva`), así que ya
no las puede llamar el navegador con el JWT del usuario. Para que el aviso siga saliendo, la propia
base de datos las llama por detrás: un trigger `AFTER INSERT/UPDATE` (con `pg_net`, asíncrono) que
dispara exactamente el mismo `{tipo, anuncioId}` / `{tipo, recompensaId}` / `{reservaId, quien,
motivo}` que hoy manda el navegador — mismo payload, solo cambia quién lo envía.

## Piezas construidas

1. **Migración `supabase/migrations/20260724_r16_sec009_notificar_backend.sql`** (+ rollback).
   - `create extension pg_net`.
   - La `service_role` key vive en **Supabase Vault** (`vault.create_secret(..., 'service_role_key')`),
     nunca en el SQL en claro. Una función `_notificar_service_key()` (security definer, `revoke`
     a todos los roles de API) la lee.
   - 5 triggers: `anuncios` INSERT (→'nuevo'), `anuncios` UPDATE de `estado` (→'nuevo'/'aprobado'/
     'rechazado' según el nuevo valor), `recompensas` INSERT (→'solicitada'), `recompensas` UPDATE
     a 'enviada', `reservas` UPDATE a 'cancelada' **solo tarjeta** (`metodo_pago is distinct from
     'efectivo'` — el efectivo hoy NO manda correo de cancelación y esto no lo cambia; sería un
     cambio de producto, no un arreglo de seguridad).
   - `quien` (cliente/propietario) en la cancelación sale de `auth.uid()` comparado con
     `old.cliente_id`/`old.propietario_id`, igual que ya hace `reservas_guardia_update` — nunca del
     body.
2. **El candado en las 3 funciones** ya estaba escrito en el working tree (mismo patrón que
   `notificar-reserva`): `supabase/functions/notificar-anuncio|notificar-recompensa|
   notificar-cancelacion/index.ts`. `notificar-anuncio` ya se desplegó hoy para SEC-010 SIN el
   candado (a propósito, ver `docs/despliegue-sec010.md`); el candado es el hunk que falta.
3. **Frontend limpiado** (`src/lib/anuncios.js`, `recompensas.js`, `reservas.js`, `src/App.jsx`):
   quitadas las llamadas directas a `supabase.functions.invoke(...)` — ya no hacen falta (el
   trigger las sustituye) y, en cuanto se despliegue el candado, habrían fallado en silencio (401
   capturado por el try/catch) sin ningún beneficio.

## Verificado en `yacht-dev` (2026-07-23/24)

- `poc-r16-notificar-backend.mjs` (Node, apunta temporalmente `_notificar_base_url()` a
  `https://httpbin.org/anything` para inspeccionar la FORMA exacta de la petición sin necesitar la
  Edge Function desplegada): 9/9 verde — anuncio nuevo/aprobado/rechazado/reenvío, editar sin
  cambiar estado → 0 de más, recompensa solicitada/enviada, cancelación cliente/propietario con
  `quien`/`motivo` correctos, cancelación en efectivo → 0 (no cambia el comportamiento de hoy).
- Regresión completa (`regression.mjs`, `regression-anuncios.mjs`, `regression-sec003.mjs`,
  `regression-sec004.mjs`) en verde con los triggers puestos.
- `poc-sec009-notificar.mjs` (Deno, conduce los handlers reales tal cual están en el working tree):
  las 3 exigen service role exacto (sin auth→401, JWT de usuario→401, service role→pasa) y escapan
  HTML.
- `poc-sec009-mensaje.mjs`: `notificar-mensaje` con su candado fino de participante, verde.
- Rollback probado (`20260724_r16_sec009_notificar_backend.rollback.sql`): quita los 5 triggers y
  las 2 funciones auxiliares; reaplicado después.
- `vite build` limpio tras quitar las llamadas del frontend.
- **Deuda de test aprovechada:** `regression.mjs`, `regression-anuncios.mjs` y `seed.mjs` seguían
  probando con `matricula`/`poliza`/`caducidad_seguro` en `anuncios`, columnas que SEC-010 ya había
  quitado de ese proyecto el 2026-07-21. Corregido de paso (no era un fallo de R16).

## Orden de despliegue a producción (pendiente, ninguna hecha)

1. `create extension pg_net` en producción + `vault.create_secret` con la service_role key **de
   producción** (no la de dev).
2. Migración R16 con `_notificar_base_url()` apuntando a
   `https://defdtpsbspieezlhteaf.supabase.co/functions/v1` (cambiar antes de aplicar).
3. Redesplegar `notificar-anuncio`, `notificar-recompensa`, `notificar-cancelacion` CON el candado
   (las 3 versiones ya están en el working tree, listas).
4. Desplegar el frontend limpiado (commit + push).
5. Smoke test: publicar un anuncio de prueba → llega el correo al admin; aprobar/rechazar → llega
   al propietario; reclamar una recompensa real → llega el aviso; cancelar una reserva de tarjeta
   (cliente y propietario) → llega a la otra parte. Y el ataque: invocar cualquiera de las 3 con un
   JWT de usuario normal → 401, ningún correo.

**Regla dura, como en SEC-010:** los pasos 1-3 (backend) antes que el paso 4 (frontend). Si el
frontend se despliega primero (sin las llamadas) pero el candado aún no está puesto ni el trigger
construido, sencillamente no se manda ningún aviso durante esa ventana — no rompe nada, solo deja
de avisar un rato. Al revés (candado antes que quitar las llamadas del frontend) tampoco rompe nada
grave: las llamadas viejas del navegador simplemente empezarían a fallar con 401 (ya iban en
try/catch), y el trigger nuevo cubre el aviso real. Aun así, lo más limpio es desplegarlo junto.
