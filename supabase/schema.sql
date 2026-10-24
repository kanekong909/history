-- Ejecuta este archivo completo en Supabase → SQL Editor → New query → Run.

-- ---------- Tabla de entradas ----------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default '',
  category    text not null default '',
  date        text not null default '',
  tags        text[] not null default '{}',
  cover       text,                         -- URL pública de la portada
  blocks      jsonb not null default '[]',  -- [{id, type, text, caption, image}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.entries enable row level security;

-- Cualquiera puede leer (el archivo es público). Quita esta política si quieres que sea privado
-- y reemplázala por: using (auth.uid() = user_id)
drop policy if exists "lectura publica" on public.entries;
create policy "lectura publica" on public.entries
  for select using (true);

-- Solo el dueño puede crear, editar y borrar sus entradas.
drop policy if exists "dueno inserta" on public.entries;
create policy "dueno inserta" on public.entries
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "dueno edita" on public.entries;
create policy "dueno edita" on public.entries
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dueno borra" on public.entries;
create policy "dueno borra" on public.entries
  for delete to authenticated using (auth.uid() = user_id);

-- ---------- Bucket de imágenes ----------
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- Cada usuario sube y borra solo dentro de su carpeta: images/<user_id>/...
drop policy if exists "subir imagenes propias" on storage.objects;
create policy "subir imagenes propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "borrar imagenes propias" on storage.objects;
create policy "borrar imagenes propias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
