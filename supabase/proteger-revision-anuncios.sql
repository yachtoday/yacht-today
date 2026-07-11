-- Yacht Today · impide que un propietario apruebe su propio anuncio.
-- Hoy la política "anuncios_update_propio" deja actualizar cualquier campo del
-- anuncio propio, incluido "estado" — así que un propietario podría cambiarlo
-- de 'En revisión' a 'Publicado' él mismo, saltándose la revisión manual.
-- Este trigger bloquea cualquier cambio de "estado" que no venga de la cuenta
-- de administración (yachtoday@gmail.com), sea cual sea la política RLS que
-- permitió llegar hasta aquí.
-- Pega y ejecuta este script entero en Supabase → SQL Editor.

create or replace function public.bloquear_cambio_estado_anuncio()
returns trigger
language plpgsql
as $$
begin
  if new.estado is distinct from old.estado
     and coalesce(auth.jwt() ->> 'email', '') <> 'yachtoday@gmail.com' then
    raise exception 'Solo un revisor de Yacht Today puede cambiar el estado de un anuncio.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_cambio_estado_anuncio on public.anuncios;
create trigger trg_bloquear_cambio_estado_anuncio
  before update on public.anuncios
  for each row execute function public.bloquear_cambio_estado_anuncio();
