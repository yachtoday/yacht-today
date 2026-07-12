-- Yacht Today · favoritos que se guardan de verdad.
--
-- Antes los favoritos vivían solo en la memoria del navegador (un useState): se perdían al
-- recargar la página, y además cualquiera sin cuenta podía pulsar el corazón sin que
-- sirviera absolutamente de nada. Un amigo de Eric lo pilló a la primera.
--
-- Ejecútalo en Supabase → SQL Editor.

create table if not exists public.favoritos (
  usuario_id  uuid   not null references auth.users(id) on delete cascade,
  anuncio_id  bigint not null references public.anuncios(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (usuario_id, anuncio_id)
);

create index if not exists favoritos_usuario_idx on public.favoritos (usuario_id);

alter table public.favoritos enable row level security;

-- Cada uno ve, añade y quita solo los suyos. Los favoritos de alguien son cosa suya.
drop policy if exists "favoritos_select_propio" on public.favoritos;
create policy "favoritos_select_propio" on public.favoritos
  for select using (usuario_id = auth.uid());

drop policy if exists "favoritos_insert_propio" on public.favoritos;
create policy "favoritos_insert_propio" on public.favoritos
  for insert with check (usuario_id = auth.uid());

drop policy if exists "favoritos_delete_propio" on public.favoritos;
create policy "favoritos_delete_propio" on public.favoritos
  for delete using (usuario_id = auth.uid());
