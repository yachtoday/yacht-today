-- Yacht Today · documentación real de propietarios (matrícula, póliza, licencia)
-- A diferencia de fotos-anuncios, este bucket es privado: solo el propio propietario
-- y la cuenta admin pueden ver los documentos subidos.
-- Pega y ejecuta este script entero en Supabase → SQL Editor (después de schema.sql y admin.sql).

alter table public.anuncios add column if not exists documentos text[];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-anuncios', 'documentos-anuncios', false, 8388608,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do nothing;

-- Cada propietario solo puede subir documentos dentro de su propia carpeta (su user id)
drop policy if exists "documentos_anuncios_insert_propio" on storage.objects;
create policy "documentos_anuncios_insert_propio" on storage.objects
  for insert with check (
    bucket_id = 'documentos-anuncios' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- El propio propietario ve sus documentos; la cuenta admin los ve todos (para revisarlos)
drop policy if exists "documentos_anuncios_select_propio_o_admin" on storage.objects;
create policy "documentos_anuncios_select_propio_o_admin" on storage.objects
  for select using (
    bucket_id = 'documentos-anuncios' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or auth.jwt() ->> 'email' = 'yachtoday@gmail.com'
    )
  );
