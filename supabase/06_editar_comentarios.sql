-- Ejecutar DESPUÉS de 05_comentarios.sql: SQL Editor → New query → pegar todo → Run. Se puede repetir sin problema.
-- Permite que quien comentó edite o elimine su comentario:
--   · con sesión: por su cuenta;
--   · como invitado: con una clave secreta que su navegador guarda (en la base solo queda su huella, nunca la clave).
-- No borra ni modifica comentarios existentes.

alter table public.comments add column if not exists owner_hash text;   -- huella de la clave del invitado
alter table public.comments add column if not exists guest_token text;  -- solo viaja al crear; se borra antes de guardar
alter table public.comments add column if not exists edited_at timestamptz;

-- La huella nunca se puede leer desde la web: solo se exponen estas columnas.
revoke select on public.comments from anon, authenticated;
grant select (id, entry_id, user_id, author_name, body, created_at, edited_at) on public.comments to anon, authenticated;

-- Con sesión se puede editar únicamente el texto, y solo de los comentarios propios.
revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;

drop policy if exists "editar comentario propio" on public.comments;
create policy "editar comentario propio" on public.comments
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Antes de crear: limpia el texto, fija el nombre real de quien tiene sesión, guarda la huella de la clave
-- del invitado (y descarta la clave) y frena avalanchas (máximo 20 por minuto en todo el sitio).
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

  if new.user_id is null and new.guest_token is not null and length(new.guest_token) >= 20 then
    new.owner_hash := encode(sha256(convert_to(new.guest_token, 'utf8')), 'hex');
  end if;
  new.guest_token := null;

  if (select count(*) from public.comments where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Hay muchos comentarios en este momento. Inténtalo de nuevo en un minuto.';
  end if;

  return new;
end $$;

-- Al editar: limpia el texto y anota la hora de la edición.
create or replace function public.touch_comment()
returns trigger language plpgsql as $$
begin
  new.body := btrim(new.body);
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end $$;

drop trigger if exists comments_touch on public.comments;
create trigger comments_touch
  before update on public.comments
  for each row execute function public.touch_comment();

-- Editar y borrar como invitado: solo si se presenta la clave que se generó al comentar.
create or replace function public.edit_guest_comment(p_id uuid, p_token text, p_body text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_token is null or length(p_token) < 20 then return false; end if;
  update public.comments set body = p_body
  where id = p_id and user_id is null
    and owner_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.delete_guest_comment(p_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if p_token is null or length(p_token) < 20 then return false; end if;
  delete from public.comments
  where id = p_id and user_id is null
    and owner_hash = encode(sha256(convert_to(p_token, 'utf8')), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke execute on function public.edit_guest_comment(uuid, text, text) from public;
revoke execute on function public.delete_guest_comment(uuid, text) from public;
grant execute on function public.edit_guest_comment(uuid, text, text) to anon, authenticated;
grant execute on function public.delete_guest_comment(uuid, text) to anon, authenticated;
