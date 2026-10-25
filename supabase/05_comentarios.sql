-- Ejecutar DESPUÉS de 02_usuarios_favoritos.sql: SQL Editor → New query → pegar todo → Run.
-- Comentarios en las historias: los puede escribir cualquiera, con sesión o como invitado (anónimo).
-- Los «drop ... if exists» solo reemplazan reglas/funciones por nombre; no borran datos.

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries (id) on delete cascade,
  user_id     uuid default auth.uid() references auth.users (id) on delete set null, -- nulo = invitado
  author_name text not null default 'Anónimo',
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint comments_body_len check (char_length(btrim(body)) between 1 and 1000),
  constraint comments_name_len check (char_length(author_name) between 1 and 60)
);

create index if not exists comments_entry_idx on public.comments (entry_id, created_at);

alter table public.comments enable row level security;

-- Todos pueden leer.
drop policy if exists "ver comentarios" on public.comments;
create policy "ver comentarios" on public.comments
  for select using (true);

-- Todos pueden comentar. Con sesión, el comentario queda a nombre de esa cuenta; sin sesión, como invitado.
drop policy if exists "comentar" on public.comments;
create policy "comentar" on public.comments
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Borrar: el autor (si tenía sesión) o el administrador.
drop policy if exists "borrar comentario propio o admin" on public.comments;
create policy "borrar comentario propio o admin" on public.comments
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Antes de guardar: limpia el texto, fija el nombre real de quien tiene sesión (nadie suplanta
-- a otro usuario) y frena avalanchas de comentarios (máximo 20 por minuto en todo el sitio).
create or replace function public.prepare_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  profile_name text;
begin
  new.body := btrim(new.body);
  new.author_name := left(coalesce(nullif(btrim(new.author_name), ''), 'Anónimo'), 60);

  if new.user_id is not null then
    select display_name into profile_name from public.profiles where id = new.user_id;
    if coalesce(profile_name, '') <> '' then
      new.author_name := left(profile_name, 60);
    end if;
  end if;

  if (select count(*) from public.comments where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Hay muchos comentarios en este momento. Inténtalo de nuevo en un minuto.';
  end if;

  return new;
end $$;

drop trigger if exists comments_prepare on public.comments;
create trigger comments_prepare
  before insert on public.comments
  for each row execute function public.prepare_comment();
