-- Ejecutar DESPUÉS de schema.sql: SQL Editor → New query → pegar todo → Run.
-- Agrega: perfiles de usuario, rol de administrador y favoritos.
-- Los "drop ... if exists" solo reemplazan reglas/funciones por nombre; no borran datos.

-- ---------- Perfiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "ver perfil propio" on public.profiles;
create policy "ver perfil propio" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "editar perfil propio" on public.profiles;
create policy "editar perfil propio" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Un usuario solo puede cambiar su nombre, nunca darse permisos de administrador.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Crear el perfil automáticamente cuando alguien se registra.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para los usuarios que ya existían (tu cuenta).
insert into public.profiles (id, display_name)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;

-- ¿El usuario actual es administrador?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- ---------- Entradas: solo el administrador escribe ----------
drop policy if exists "dueno inserta" on public.entries;
drop policy if exists "dueno edita" on public.entries;
drop policy if exists "dueno borra" on public.entries;

drop policy if exists "admin inserta" on public.entries;
create policy "admin inserta" on public.entries
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin edita" on public.entries;
create policy "admin edita" on public.entries
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin borra" on public.entries;
create policy "admin borra" on public.entries
  for delete to authenticated using (public.is_admin());

-- ---------- Imágenes: solo el administrador sube y borra ----------
drop policy if exists "subir imagenes propias" on storage.objects;
drop policy if exists "borrar imagenes propias" on storage.objects;

drop policy if exists "admin sube imagenes" on storage.objects;
create policy "admin sube imagenes" on storage.objects
  for insert to authenticated with check (bucket_id = 'images' and public.is_admin());

drop policy if exists "admin borra imagenes" on storage.objects;
create policy "admin borra imagenes" on storage.objects
  for delete to authenticated using (bucket_id = 'images' and public.is_admin());

-- ---------- Favoritos ----------
create table if not exists public.favorites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id    uuid not null references public.entries (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.favorites enable row level security;

-- Cada usuario ve y maneja solo sus favoritos.
drop policy if exists "ver favoritos propios" on public.favorites;
create policy "ver favoritos propios" on public.favorites
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "agregar favorito propio" on public.favorites;
create policy "agregar favorito propio" on public.favorites
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "quitar favorito propio" on public.favorites;
create policy "quitar favorito propio" on public.favorites
  for delete to authenticated using (auth.uid() = user_id);

-- Total de favoritos por entrada (público, sin revelar quién marcó qué).
create or replace function public.favorite_counts()
returns table (entry_id uuid, total bigint)
language sql stable security definer set search_path = '' as $$
  select entry_id, count(*) from public.favorites group by entry_id
$$;
grant execute on function public.favorite_counts() to anon, authenticated;

-- ---------- Hacerte administrador ----------
-- Cambia el correo por el de TU usuario antes de ejecutar.
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'mateobossa909@gmail.com');
