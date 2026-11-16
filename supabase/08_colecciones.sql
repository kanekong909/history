-- Ejecutar DESPUÉS de 02_usuarios_favoritos.sql: SQL Editor → New query → pegar todo → Run. Se puede repetir sin problema.
-- Colecciones y fichas: una base de datos propia (motores, aviones, personajes…) que se usa en las historias
-- con tablas y menciones con «@». Todo el mundo puede leerlas; solo el administrador las crea y edita.

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text not null default '',
  fields      jsonb not null default '[]',   -- [{id, label, type, options?, unit?, collection?}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint collections_name_len check (char_length(btrim(name)) between 1 and 80)
);

create table if not exists public.records (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  title         text not null,
  image         text,
  summary       text not null default '',
  data          jsonb not null default '{}',  -- {id del campo: valor}
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint records_title_len check (char_length(btrim(title)) between 1 and 160)
);

create index if not exists records_collection_idx on public.records (collection_id, title);

alter table public.collections enable row level security;
alter table public.records enable row level security;

drop policy if exists "ver colecciones" on public.collections;
create policy "ver colecciones" on public.collections for select using (true);

drop policy if exists "admin crea colecciones" on public.collections;
create policy "admin crea colecciones" on public.collections for insert to authenticated with check (public.is_admin());
drop policy if exists "admin edita colecciones" on public.collections;
create policy "admin edita colecciones" on public.collections for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin borra colecciones" on public.collections;
create policy "admin borra colecciones" on public.collections for delete to authenticated using (public.is_admin());

drop policy if exists "ver fichas" on public.records;
create policy "ver fichas" on public.records for select using (true);

drop policy if exists "admin crea fichas" on public.records;
create policy "admin crea fichas" on public.records for insert to authenticated with check (public.is_admin());
drop policy if exists "admin edita fichas" on public.records;
create policy "admin edita fichas" on public.records for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin borra fichas" on public.records;
create policy "admin borra fichas" on public.records for delete to authenticated using (public.is_admin());
