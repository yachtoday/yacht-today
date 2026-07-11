-- Yacht Today · Fase 3: fotos reales de los anuncios
-- Pega y ejecuta este script entero en Supabase → SQL Editor (después de schema.sql).

-- Columna nueva para guardar las URLs públicas de las fotos de cada anuncio
alter table public.anuncios add column if not exists fotos text[];

-- Bucket de almacenamiento público (las fotos de un marketplace se ven sin iniciar sesión)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-anuncios', 'fotos-anuncios', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- (storage.objects ya tiene la seguridad activada por defecto en Supabase, no hace falta tocarla)

-- Cada propietario solo puede subir fotos dentro de su propia carpeta (su user id)
drop policy if exists "fotos_anuncios_insert_propio" on storage.objects;
create policy "fotos_anuncios_insert_propio" on storage.objects
  for insert with check (
    bucket_id = 'fotos-anuncios' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Cualquiera puede ver las fotos (el bucket es público, esta regla es solo para el panel de Supabase)
drop policy if exists "fotos_anuncios_select_publico" on storage.objects;
create policy "fotos_anuncios_select_publico" on storage.objects
  for select using (bucket_id = 'fotos-anuncios');
