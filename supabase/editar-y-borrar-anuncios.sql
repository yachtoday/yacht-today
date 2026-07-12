-- Yacht Today · editar anuncios y no dejar basura en Storage al borrarlos.
-- Ejecútalo entero en Supabase → SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Poder BORRAR archivos de Storage.
--
-- No existía ninguna política de borrado: al eliminar un anuncio, su fila desaparecía
-- pero las fotos se quedaban en el bucket para siempre, ocupando espacio y sin que nadie
-- pudiera limpiarlas (un DELETE devolvía 403).
--
-- Cada propietario solo puede borrar lo que hay dentro de su propia carpeta (su user id),
-- igual que ya pasaba al subir.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "fotos_anuncios_delete_propio" on storage.objects;
create policy "fotos_anuncios_delete_propio" on storage.objects
  for delete using (
    bucket_id = 'fotos-anuncios' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documentos_anuncios_delete_propio" on storage.objects;
create policy "documentos_anuncios_delete_propio" on storage.objects
  for delete using (
    bucket_id = 'documentos-anuncios' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Que editar la documentación devuelva el anuncio a revisión.
--
-- El trigger anterior bloqueaba CUALQUIER cambio de `estado` que no viniera del admin.
-- Eso impedía lo que ahora necesitamos: que un propietario que edita la matrícula, la
-- póliza, la caducidad del seguro o los documentos de un anuncio ya publicado lo devuelva
-- él mismo a 'En revisión' — sin esto, podría cambiar los papeles de un barco aprobado y
-- seguir publicado sin que nadie lo mirase (el "cambiazo").
--
-- Sigue estando prohibido lo importante: **nadie que no sea el admin puede poner un
-- anuncio en 'Publicado'**. Un propietario solo puede bajarlo a revisión, nunca aprobarlo.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.bloquear_cambio_estado_anuncio()
returns trigger
language plpgsql
as $$
declare
  es_admin boolean := coalesce(auth.jwt() ->> 'email', '') = 'yachtoday@gmail.com';
begin
  if new.estado is distinct from old.estado and not es_admin then
    -- Único cambio de estado permitido a un propietario: mandar su propio anuncio
    -- publicado de vuelta a revisión (porque ha tocado la documentación). Nunca al revés.
    if not (old.estado = 'Publicado' and new.estado = 'En revisión' and old.propietario_id = auth.uid()) then
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
