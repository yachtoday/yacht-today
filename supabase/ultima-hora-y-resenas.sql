-- Yacht Today · dos cosas que se enseñaban y no existían.
-- Ejecútalo entero en Supabase → SQL Editor.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. El descuento de "Última hora"
--
-- El propietario lo activaba, veía el cartelito… y al recargar la página había
-- desaparecido: solo vivía en la memoria del navegador (un setMisBarcos), nunca llegaba a
-- la base de datos y NUNCA se aplicaba a ningún precio. Una función decorativa.
--
-- Ahora se guarda, y el descuento se aplica de verdad — pero solo a los alquileres que
-- empiezan en los próximos 7 días, que es lo que significa "última hora": llenar el hueco
-- de esta semana, no regalar el barco a quien reserva para agosto.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.anuncios
  add column if not exists ultima_hora_descuento integer
    check (ultima_hora_descuento is null or (ultima_hora_descuento between 5 and 50));

comment on column public.anuncios.ultima_hora_descuento is
  'Descuento % de última hora. Solo se aplica si el alquiler empieza dentro de los próximos 7 días. NULL = desactivado.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Las estrellas
--
-- Cada anuncio nacía con rating 5.0 y 0 reseñas: cinco estrellas sin que nadie lo hubiera
-- valorado. Y cuando un cliente dejaba una reseña de verdad, la nota del anuncio NO se
-- actualizaba — la reseña se guardaba en la reserva y ahí moría.
--
-- Este trigger recalcula la nota real del anuncio cada vez que alguien reseña. Los anuncios
-- sin reseñas se quedan en 0, y la web ya no les pinta cinco estrellas (ver src/App.jsx).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recalcular_nota_anuncio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  objetivo bigint := coalesce(new.anuncio_id, old.anuncio_id);
begin
  update public.anuncios a
  set reviews = sub.n,
      rating  = coalesce(sub.media, 0)
  from (
    select count(*) as n, avg(resena_estrellas) as media
    from public.reservas
    where anuncio_id = objetivo and resena_estrellas is not null
  ) sub
  where a.id = objetivo;
  return null;
end;
$$;

drop trigger if exists trg_recalcular_nota_anuncio on public.reservas;
create trigger trg_recalcular_nota_anuncio
  after insert or update of resena_estrellas or delete on public.reservas
  for each row execute function public.recalcular_nota_anuncio();

-- Los anuncios que ya existen arrancan sin nota: nadie los ha valorado todavía.
update public.anuncios a
set reviews = sub.n,
    rating  = coalesce(sub.media, 0)
from (
  select an.id,
         count(r.id) filter (where r.resena_estrellas is not null) as n,
         avg(r.resena_estrellas) as media
  from public.anuncios an
  left join public.reservas r on r.anuncio_id = an.id
  group by an.id
) sub
where a.id = sub.id;
