-- Rollback de R16 (SEC-009, bloque C). Deja el pg_net instalado (no rompe nada dejarlo) pero
-- quita los triggers/funciones y el secreto de vault.

begin;

drop trigger if exists trg_notificar_anuncio_insert on public.anuncios;
drop trigger if exists trg_notificar_anuncio_update on public.anuncios;
drop trigger if exists trg_notificar_recompensa_insert on public.recompensas;
drop trigger if exists trg_notificar_recompensa_update on public.recompensas;
drop trigger if exists trg_notificar_cancelacion on public.reservas;

drop function if exists public.trg_notificar_anuncio_insert();
drop function if exists public.trg_notificar_anuncio_update();
drop function if exists public.trg_notificar_recompensa_insert();
drop function if exists public.trg_notificar_recompensa_update();
drop function if exists public.trg_notificar_cancelacion();
drop function if exists public._notificar_service_key();
drop function if exists public._notificar_base_url();

commit;

-- El secreto de vault se borra aparte (no es transaccional de la misma forma):
-- delete from vault.secrets where name = 'service_role_key';
