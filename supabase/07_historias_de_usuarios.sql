-- Ejecutar DESPUÉS de 02_usuarios_favoritos.sql (y de 05/06 si ya los usas): SQL Editor → New query → pegar todo → Run.
-- Historias escritas por otras personas, con aprobación del administrador.
--   · Cualquier cuenta con el correo confirmado puede escribir y enviar historias a revisión.
--   · Solo tú (administrador) las publicas o las rechazas. Hasta entonces, solo las ve su autora o autor y tú.
--   · Quien escribe NO puede publicar por su cuenta, ni destacar historias, ni cambiar una historia ya publicada.
-- Se puede repetir sin problema. Las historias que ya tienes quedan como «publicadas».

-- ---------- ¿Tiene el correo confirmado? ----------
create or replace function public.is_confirmed()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select email_confirmed_at is not null from auth.users where id = auth.uid()), false)
$$;
revoke execute on function public.is_confirmed() from public;
grant execute on function public.is_confirmed() to authenticated;

-- ---------- Columnas nuevas ----------
alter table public.entries add column if not exists status text not null default 'published';
alter table public.entries drop constraint if exists entries_status_check;
alter table public.entries add constraint entries_status_check check (status in ('draft', 'pending', 'published', 'rejected'));
alter table public.entries add column if not exists author_name text;        -- firma visible («Por Ana»); vacío en las tuyas
alter table public.entries add column if not exists review_note text;        -- motivo si se rechaza
alter table public.entries add column if not exists submitted_at timestamptz;
alter table public.entries add column if not exists published_at timestamptz;
alter table public.entries add column if not exists featured boolean not null default false;

update public.entries set published_at = created_at where status = 'published' and published_at is null;
create index if not exists entries_status_idx on public.entries (status, updated_at desc);

-- ---------- Reglas de acceso a las historias ----------
drop policy if exists "lectura publica" on public.entries;
drop policy if exists "admin inserta" on public.entries;
drop policy if exists "admin edita" on public.entries;
drop policy if exists "admin borra" on public.entries;
drop policy if exists "ver historias" on public.entries;
drop policy if exists "escribir historias" on public.entries;
drop policy if exists "editar historias" on public.entries;
drop policy if exists "borrar historias" on public.entries;

-- Todos ven las publicadas; cada persona ve además las suyas; el administrador ve todas.
create policy "ver historias" on public.entries
  for select using (status = 'published' or user_id = auth.uid() or public.is_admin());

create policy "escribir historias" on public.entries
  for insert to authenticated
  with check (public.is_admin() or (user_id = auth.uid() and public.is_confirmed()));

-- Quien escribe edita solo lo suyo y mientras no esté publicado; no puede dejarlo «publicado».
create policy "editar historias" on public.entries
  for update to authenticated
  using (public.is_admin() or (user_id = auth.uid() and status <> 'published'))
  with check (public.is_admin() or (user_id = auth.uid() and status in ('draft', 'pending')));

create policy "borrar historias" on public.entries
  for delete to authenticated
  using (public.is_admin() or (user_id = auth.uid() and status <> 'published'));

-- ---------- Candados que las reglas no alcanzan ----------
-- Para quien no es administrador: fija el autor, la firma y el estado, congela las columnas protegidas
-- y limita cuántas historias puede tener en borrador (20) y en revisión (3) a la vez.
create or replace function public.guard_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  is_adm boolean := public.is_admin();
  uid uuid := auth.uid();
  display text;
  n int;
begin
  if is_adm then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') and new.published_at is null then
      new.published_at := now();
    end if;
    if new.status = 'published' and tg_op = 'UPDATE' and old.status <> 'published' then
      new.published_at := now();
      new.review_note := null;
    end if;
    if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if uid is null or not public.is_confirmed() then
    raise exception 'Confirma tu correo para poder escribir historias.';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := uid;
    new.featured := false;
    new.review_note := null;
    new.submitted_at := null;
    new.published_at := null;
    if new.status not in ('draft', 'pending') then new.status := 'draft'; end if;
    select display_name into display from public.profiles where id = uid;
    new.author_name := left(coalesce(nullif(btrim(display), ''), 'Anónimo'), 60);
  else
    if old.status = 'published' then
      raise exception 'Las historias publicadas solo las puede cambiar el administrador.';
    end if;
    if new.status not in ('draft', 'pending') then
      raise exception 'No puedes publicar directamente: envía la historia a revisión.';
    end if;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.featured := old.featured;
    new.author_name := old.author_name;
    new.published_at := old.published_at;
    new.review_note := old.review_note;
    new.submitted_at := old.submitted_at;
  end if;

  select count(*) into n from public.entries where user_id = uid and status <> 'published' and id <> new.id;
  if n >= 20 then
    raise exception 'Tienes demasiadas historias sin publicar (máximo 20). Elimina alguna para crear otra.';
  end if;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    select count(*) into n from public.entries where user_id = uid and status = 'pending' and id <> new.id;
    if n >= 3 then
      raise exception 'Ya tienes 3 historias en revisión. Espera a que revisemos alguna.';
    end if;
    new.submitted_at := now();
    new.review_note := null;
  end if;

  return new;
end $$;

drop trigger if exists entries_guard on public.entries;
create trigger entries_guard
  before insert or update on public.entries
  for each row execute function public.guard_entry();

-- ---------- Comentarios y favoritos solo en historias publicadas ----------
do $$
begin
  if to_regclass('public.comments') is not null then
    drop policy if exists "ver comentarios" on public.comments;
    create policy "ver comentarios" on public.comments
      for select using (exists (select 1 from public.entries e where e.id = entry_id));

    drop policy if exists "comentar" on public.comments;
    create policy "comentar" on public.comments
      for insert to anon, authenticated
      with check ((user_id is null or user_id = auth.uid())
                  and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));
  end if;

  if to_regclass('public.favorites') is not null then
    drop policy if exists "agregar favorito propio" on public.favorites;
    create policy "agregar favorito propio" on public.favorites
      for insert to authenticated
      with check (auth.uid() = user_id
                  and exists (select 1 from public.entries e where e.id = entry_id and e.status = 'published'));
  end if;
end $$;
