-- Yacht Today · cerrar el círculo de la revisión de anuncios.
--
-- Hasta ahora el proceso moría a medias: un anuncio se quedaba "En revisión" y **no se
-- avisaba a nadie** — ni al admin de que había algo que revisar, ni al propietario de que
-- ya estaba publicado. Y "Rechazado" era un callejón sin salida: sin motivo y sin poder
-- corregirlo.
--
-- Ejecútalo entero en Supabase → SQL Editor.

-- Por qué se rechazó, para poder decírselo al propietario en vez de dejarle a oscuras.
alter table public.anuncios
  add column if not exists motivo_rechazo text;

comment on column public.anuncios.motivo_rechazo is
  'Qué tiene que corregir el propietario. Lo escribe el admin al rechazar y se le envía por email.';

-- El trigger permitía al propietario un único cambio de estado (Publicado → En revisión,
-- al tocar la documentación). Ahora también debe poder **reenviar un anuncio rechazado**
-- después de corregirlo (Rechazado → En revisión); si no, un rechazo mata el anuncio para
-- siempre y el propietario tiene que borrarlo y empezar de cero.
--
-- Lo importante sigue igual de blindado: **nadie que no sea el admin puede poner un
-- anuncio en 'Publicado'**. El propietario solo puede mandar el suyo a la cola de revisión.
create or replace function public.bloquear_cambio_estado_anuncio()
returns trigger
language plpgsql
as $$
declare
  es_admin boolean := coalesce(auth.jwt() ->> 'email', '') = 'yachtoday@gmail.com';
begin
  if new.estado is distinct from old.estado and not es_admin then
    if not (
      old.estado in ('Publicado', 'Rechazado')
      and new.estado = 'En revisión'
      and old.propietario_id = auth.uid()
    ) then
      raise exception 'Solo un revisor de Yacht Today puede cambiar el estado de un anuncio.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_cambio_estado_anuncio on public.anuncios;
create trigger trg_bloquear_cambio_estado_anuncio
  before update on public.anuncios
  for each row execute function public.bloquear_cambio_estado_anuncio();
