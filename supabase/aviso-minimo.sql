-- Yacht Today · antelación mínima personalizada por anuncio
-- Pega y ejecuta este script entero en Supabase → SQL Editor (después de schema.sql).

alter table public.anuncios add column if not exists aviso_minimo_horas integer;
