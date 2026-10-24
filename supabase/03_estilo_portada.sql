-- Ejecutar en Supabase → SQL Editor → New query → Run (una sola vez).
-- Guarda cómo se muestra la portada de cada entrada (diseño, altura, enfoque, degradado).
-- No borra ni modifica datos existentes.
alter table public.entries add column if not exists cover_style jsonb;
