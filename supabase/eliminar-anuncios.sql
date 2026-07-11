-- Yacht Today · permite a cada propietario borrar sus propios anuncios
-- Pega y ejecuta en Supabase → SQL Editor.

drop policy if exists "anuncios_delete_propio" on public.anuncios;
create policy "anuncios_delete_propio" on public.anuncios
  for delete using (auth.uid() = propietario_id);
