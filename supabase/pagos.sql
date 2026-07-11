-- Yacht Today · Fase 6: pagos con Stripe Connect
-- Pega y ejecuta este script entero en Supabase → SQL Editor (después de reservas.sql).

alter table public.reservas
  add column if not exists stripe_payment_intent_id text,
  add column if not exists pago_estado text not null default 'pagado' check (pago_estado in ('pagado', 'reembolsado'));

-- A partir de ahora las reservas solo las crea el sistema de pagos (la Edge Function
-- "webhook-stripe", con permisos de administración) una vez Stripe confirma el cobro.
-- Se quita el permiso de insertar desde el navegador para que nadie pueda crearse
-- una reserva "confirmada" sin pagar de verdad.
drop policy if exists "reservas_insert_propia" on public.reservas;
