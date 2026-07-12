-- Yacht Today · borra los 20 anuncios de ejemplo que se sembraron en schema.sql.
--
-- Por qué: al abrir la web al público, un anuncio sin propietario es un barco que no
-- existe. No se puede pagar (crear-pago rechaza los anuncios sin propietario_id), pero
-- un visitante que intente reservarlo se choca con un error. Mejor no enseñarlos.
--
-- Los anuncios de ejemplo son exactamente los que NO tienen propietario_id: los publica
-- el script de siembra, no una persona. Cualquier anuncio real siempre lleva el uuid de
-- su dueño, así que este DELETE no puede tocar un anuncio de verdad.
--
-- Las reservas asociadas caen solas: reservas.anuncio_id es ON DELETE CASCADE.
--
-- Ejecútalo en Supabase → SQL Editor (el rol `postgres` se salta RLS y el trigger).
-- Si algún día quieres recuperarlos, vuelve a ejecutar los INSERT de supabase/schema.sql.

-- 1. Mira qué se va a borrar antes de borrarlo.
select id, nombre, clase, estado
from public.anuncios
where propietario_id is null
order by id;

-- 2. Bórralos.
delete from public.anuncios
where propietario_id is null;

-- 3. Comprueba que no queda ninguno huérfano.
select count(*) as anuncios_sin_propietario
from public.anuncios
where propietario_id is null;
