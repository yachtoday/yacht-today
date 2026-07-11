-- Yacht Today · equipamiento y servicios elegidos por el propietario
-- Pega y ejecuta este script entero en Supabase → SQL Editor (después de schema.sql).

alter table public.anuncios add column if not exists equipamiento text[];
