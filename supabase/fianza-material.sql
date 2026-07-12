-- Yacht Today · fianza en euros fijada por el propietario (material: SUP y kayak).
--
-- Por qué: la fianza era siempre un 20 % del alquiler (FIANZA_PCT). Para un barco de
-- 300 €/día eso son 60 €, razonable. Para un kayak de 15 €/día son 3 € — y si el cliente
-- lo pierde, el propietario se come un kayak de 400 € habiendo retenido tres euros.
--
-- Además, un kayak o una tabla de paddle surf no tienen seguro ni matrícula, así que al
-- publicarlos ya no se piden póliza, caducidad ni documentos (antes eran obligatorios y
-- por eso era imposible publicar uno).
--
-- El material pasa a llevar una fianza fija en euros que decide su dueño. Los barcos y las
-- experiencias siguen igual que hasta ahora (20 % del alquiler / sin fianza).
--
-- Ejecútalo en Supabase → SQL Editor.

alter table public.anuncios
  add column if not exists fianza numeric;

comment on column public.anuncios.fianza is
  'Fianza en euros fijada por el propietario. Solo se usa en la clase "material" (SUP y kayak), donde el 20 % del alquiler sería ridículo. En barcos es null y se sigue calculando el 20 % del subtotal.';
