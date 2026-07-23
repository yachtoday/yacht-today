-- Migración R16 (SEC-009, bloque C) · reconecta por BACKEND los avisos de anuncio/recompensa/
-- cancelación, para poder ponerles el candado "solo service role" sin apagar esos correos.
--
-- Hoy los dispara el NAVEGADOR con el JWT del usuario (src/lib/anuncios.js:164,
-- src/lib/recompensas.js:47, src/lib/reservas.js:45). Eso es justo el agujero de SEC-009:
-- cualquiera con una cuenta puede llamar a esas Edge Functions con datos inventados y hacer que
-- Marea mande un correo con su marca a un tercero. El arreglo de las funciones (candado
-- "Authorization === Bearer SERVICE_ROLE_KEY", ya escrito y probado) exige que el AVISO nazca
-- en el servidor, no en el navegador.
--
-- Aquí: la propia base de datos, con un trigger AFTER INSERT/UPDATE, llama a la Edge Function por
-- HTTP (pg_net, asíncrono) usando la service_role key guardada en Vault (nunca en el código SQL
-- en claro). Los payloads son IDÉNTICOS a los que manda hoy el navegador — {tipo, anuncioId} /
-- {tipo, recompensaId} / {reservaId, quien, motivo} — así que las Edge Functions no cambian nada
-- de su lógica de negocio, solo a QUIÉN le exigen la autorización.
--
-- ⚠️ OJO AL DESPLEGAR EN OTRO PROYECTO (prod): la migración asume que la key de vault se llama
-- 'service_role_key' y que las URLs apuntan a ESTE proyecto. Repetir vault.create_secret con la
-- key de PRODUCCIÓN y cambiar v_base_url en las tres funciones.

begin;

create extension if not exists pg_net;

-- URL base de las Edge Functions de este proyecto. No es secreta (es pública, va en el bundle del
-- cliente); vive aquí en claro a propósito, para no complicar el vault con algo que no lo necesita.
-- CAMBIAR a la URL de producción al desplegar allí.
create or replace function public._notificar_base_url() returns text
language sql immutable as $$ select 'https://jngxnfjjofzsqblndcsp.supabase.co/functions/v1' $$;

create or replace function public._notificar_service_key() returns text
language sql stable security definer set search_path = pg_catalog, public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1
$$;
revoke all on function public._notificar_service_key() from public, anon, authenticated;

-- ── anuncios: INSERT (siempre nace 'En revisión', por R2) → tipo 'nuevo' ──────────────────────
create or replace function public.trg_notificar_anuncio_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'En revisión' then
    perform net.http_post(
      url := public._notificar_base_url() || '/notificar-anuncio',
      body := jsonb_build_object('tipo', 'nuevo', 'anuncioId', new.id),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                     'Authorization', 'Bearer ' || public._notificar_service_key()),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_anuncio_insert on public.anuncios;
create trigger trg_notificar_anuncio_insert
  after insert on public.anuncios
  for each row execute function public.trg_notificar_anuncio_insert();

-- ── anuncios: UPDATE de estado → 'En revisión' (reenvío tras editar) / 'Publicado' / 'Rechazado' ──
create or replace function public.trg_notificar_anuncio_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_tipo text;
begin
  if new.estado is distinct from old.estado then
    v_tipo := case new.estado
      when 'En revisión' then 'nuevo'
      when 'Publicado' then 'aprobado'
      when 'Rechazado' then 'rechazado'
      else null
    end;
    if v_tipo is not null then
      perform net.http_post(
        url := public._notificar_base_url() || '/notificar-anuncio',
        body := jsonb_build_object('tipo', v_tipo, 'anuncioId', new.id),
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
                                       'Authorization', 'Bearer ' || public._notificar_service_key()),
        timeout_milliseconds := 5000
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_anuncio_update on public.anuncios;
create trigger trg_notificar_anuncio_update
  after update on public.anuncios
  for each row execute function public.trg_notificar_anuncio_update();

-- ── recompensas: INSERT ('solicitada') → avisa al admin + acuse al propietario ────────────────
create or replace function public.trg_notificar_recompensa_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'solicitada' then
    perform net.http_post(
      url := public._notificar_base_url() || '/notificar-recompensa',
      body := jsonb_build_object('tipo', 'solicitada', 'recompensaId', new.id),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                     'Authorization', 'Bearer ' || public._notificar_service_key()),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_recompensa_insert on public.recompensas;
create trigger trg_notificar_recompensa_insert
  after insert on public.recompensas
  for each row execute function public.trg_notificar_recompensa_insert();

-- ── recompensas: UPDATE a 'enviada' (el admin la marca) ────────────────────────────────────────
create or replace function public.trg_notificar_recompensa_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado = 'enviada' and old.estado is distinct from 'enviada' then
    perform net.http_post(
      url := public._notificar_base_url() || '/notificar-recompensa',
      body := jsonb_build_object('tipo', 'enviada', 'recompensaId', new.id),
      params := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                     'Authorization', 'Bearer ' || public._notificar_service_key()),
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_recompensa_update on public.recompensas;
create trigger trg_notificar_recompensa_update
  after update on public.recompensas
  for each row execute function public.trg_notificar_recompensa_update();

-- ── reservas: UPDATE a 'cancelada', SOLO tarjeta (el efectivo hoy no avisa: no cambiar ese
-- comportamiento aquí, sería un cambio de producto, no un arreglo de seguridad). 'quien' sale de
-- auth.uid() comparado con la reserva —NUNCA del cliente—, igual que hace ya reservas_guardia_update. ──
create or replace function public.trg_notificar_cancelacion() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_quien text;
begin
  if new.estado = 'cancelada' and old.estado is distinct from 'cancelada'
     and new.metodo_pago is distinct from 'efectivo' then
    if auth.uid() = old.cliente_id then v_quien := 'cliente';
    elsif auth.uid() = old.propietario_id then v_quien := 'propietario';
    else v_quien := null; -- actor desconocido (p.ej. admin/servicio): no se manda aviso a ciegas
    end if;
    if v_quien is not null then
      perform net.http_post(
        url := public._notificar_base_url() || '/notificar-cancelacion',
        body := jsonb_build_object('reservaId', new.id, 'quien', v_quien, 'motivo', new.motivo_cancelacion),
        params := '{}'::jsonb,
        headers := jsonb_build_object('Content-Type', 'application/json',
                                       'Authorization', 'Bearer ' || public._notificar_service_key()),
        timeout_milliseconds := 5000
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notificar_cancelacion on public.reservas;
create trigger trg_notificar_cancelacion
  after update on public.reservas
  for each row execute function public.trg_notificar_cancelacion();

-- Higiene (advisor de Supabase): son funciones de trigger, PostgREST ya las bloquea como RPC
-- (devuelven tipo `trigger`, 404 confirmado) — pero el GRANT de EXECUTE por defecto a anon/
-- authenticated seguía ahí. Revocarlo no afecta a los triggers: se disparan con el permiso del
-- dueño de la función, no por el grant de EXECUTE de estos roles.
revoke all on function public.trg_notificar_anuncio_insert() from public, anon, authenticated;
revoke all on function public.trg_notificar_anuncio_update() from public, anon, authenticated;
revoke all on function public.trg_notificar_recompensa_insert() from public, anon, authenticated;
revoke all on function public.trg_notificar_recompensa_update() from public, anon, authenticated;
revoke all on function public.trg_notificar_cancelacion() from public, anon, authenticated;

commit;
