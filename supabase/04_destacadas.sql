-- Ejecutar en Supabase → SQL Editor → New query → Run (una sola vez).
-- Permite marcar historias como «destacadas» para que aparezcan en el banner del inicio.
-- No borra ni modifica datos existentes.
alter table public.entries add column if not exists featured boolean not null default false;
