-- Yacht Today · Revisión de anuncios: permite a la cuenta de administración
-- (yachtoday@gmail.com) ver y aprobar/rechazar cualquier anuncio, no solo los suyos.
-- Pega y ejecuta este script entero en Supabase → SQL Editor.

drop policy if exists "anuncios_select_admin" on public.anuncios;
create policy "anuncios_select_admin" on public.anuncios
  for select using (auth.jwt() ->> 'email' = 'yachtoday@gmail.com');

drop policy if exists "anuncios_update_admin" on public.anuncios;
create policy "anuncios_update_admin" on public.anuncios
  for update using (auth.jwt() ->> 'email' = 'yachtoday@gmail.com');
