-- Yacht Today · que la fianza sea de verdad.
--
-- EL PROBLEMA: la fianza era solo una etiqueta. `crear-pago` cobraba únicamente el
-- alquiler + la comisión, y guardaba `fianza_estado = 'retenida'` en la fila. Al cliente
-- se le decía que se le retenía una fianza y al propietario que estaba cubierto ante
-- daños, pero **no se retenía ni un céntimo**: si un cliente destrozaba el barco, no
-- había de dónde cobrar. Una promesa de dinero que la plataforma no cumplía.
--
-- LA SOLUCIÓN: al pagar, Stripe guarda la tarjeta del cliente (con su consentimiento, que
-- Stripe recoge en el propio checkout). No se le cobra ni se le bloquea nada. Si al
-- terminar el propietario reporta un daño o una pérdida, se cobra la fianza a esa tarjeta
-- y el dinero va **íntegro al propietario** (la plataforma no se lleva comisión de un
-- destrozo).
--
-- Ejecútalo en Supabase → SQL Editor.

-- Referencias de Stripe para poder cobrar la fianza más tarde, sin el cliente delante.
alter table public.reservas
  add column if not exists stripe_customer_id       text,
  add column if not exists stripe_payment_method_id text;

comment on column public.reservas.stripe_payment_method_id is
  'Tarjeta guardada del cliente. Solo se usa para cobrar la fianza si el propietario reporta daños al finalizar.';

-- `fianza_estado` necesita dos valores nuevos:
--   'garantizada' — tarjeta guardada, nada cobrado (el estado normal de una reserva viva)
--   'cobrada'     — hubo daños y se le cobró la fianza al cliente
-- Se mantienen 'retenida' (reservas antiguas, antes de este cambio) y 'liberada'.
alter table public.reservas
  drop constraint if exists reservas_fianza_estado_check;

alter table public.reservas
  add constraint reservas_fianza_estado_check
  check (fianza_estado in ('garantizada', 'retenida', 'liberada', 'cobrada'));
