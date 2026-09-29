-- Winter Arc v2 — correr DESPUÉS de supabase.sql. Se puede correr más de una vez.
-- Agrega: hábitos propios, comodines, peso y medidas, fotos, reacciones, avatar y recordatorios.

alter table wa_people add column if not exists avatar text;

create table if not exists wa_body (
  name     text references wa_people(name) on delete cascade,
  day      date,
  peso     numeric,
  grasa    numeric,
  cintura  numeric,
  publico  boolean not null default false,
  primary key (name, day)
);

create table if not exists wa_photos (
  id         bigint generated always as identity primary key,
  name       text references wa_people(name) on delete cascade,
  day        date not null,
  path       text not null,
  caption    text,
  created_at timestamptz default now()
);

create table if not exists wa_reactions (
  id         bigint generated always as identity primary key,
  from_name  text references wa_people(name) on delete cascade,
  target     text not null,          -- 'photo:<id>' o 'day:<nombre>:<fecha>'
  emoji      text,
  texto      text,
  created_at timestamptz default now()
);

-- Permisos de subida de 10 minutos (la página no los puede leer).
create table if not exists wa_tickets (token text primary key, name text, expires timestamptz);
-- Suscripciones a notificaciones (la página no las puede leer).
create table if not exists wa_push (
  endpoint   text primary key,
  name       text references wa_people(name) on delete cascade,
  sub        jsonb not null,
  created_at timestamptz default now()
);
create table if not exists wa_secrets (k text primary key, v text not null);

alter table wa_body      enable row level security;
alter table wa_photos    enable row level security;
alter table wa_reactions enable row level security;
alter table wa_tickets   enable row level security;
alter table wa_push      enable row level security;
alter table wa_secrets   enable row level security;

drop policy if exists wa_body_read on wa_body;
drop policy if exists wa_photos_read on wa_photos;
drop policy if exists wa_reactions_read on wa_reactions;
create policy wa_body_read      on wa_body      for select using (publico);   -- lo privado solo lo ve su dueño (con PIN)
create policy wa_photos_read    on wa_photos    for select using (true);
create policy wa_reactions_read on wa_reactions for select using (true);

-- ---------- funciones ----------

-- Día: ahora con comodines (máximo 2 en todo el reto).
create or replace function wa_save_day(p_name text, p_pin text, p_day date, p_habits jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_day > wa_today() or p_day < wa_today() - 2 or p_day > date '2026-12-23' or p_day < date '2026-10-01' then return 'fecha'; end if;
  if jsonb_typeof(p_habits) <> 'object' or length(p_habits::text) > 2000 then return 'datos'; end if;
  if coalesce((p_habits->>'comodin')::boolean, false)
     and (select count(*) from wa_checks where name = p_name and day <> p_day and coalesce((habits->>'comodin')::boolean, false)) >= 2
  then return 'comodines'; end if;
  insert into wa_checks(name, day, habits, updated_at) values (p_name, p_day, p_habits, now())
  on conflict (name, day) do update set habits = excluded.habits, updated_at = now();
  return 'ok';
end $$;

-- Metas: libres hasta el 1 de octubre. Después solo se pueden AGREGAR las que falten (lo ya puesto no cambia).
create or replace function wa_save_goals(p_name text, p_pin text, p_goals jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text; g jsonb; nuevo jsonb;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if jsonb_typeof(p_goals) <> 'object' or length(p_goals::text) > 3000 then return 'datos'; end if;
  select goals into g from wa_people where name = p_name;
  if g is null or wa_today() <= date '2026-10-01' then
    nuevo := p_goals;
  else
    nuevo := p_goals || g;               -- lo que ya existía gana
    if nuevo = g then return 'congeladas'; end if;
  end if;
  update wa_people set goals = nuevo, updated_at = now() where name = p_name;
  return 'ok';
end $$;

create or replace function wa_save_body(p_name text, p_pin text, p_day date, p_peso numeric, p_grasa numeric, p_cintura numeric, p_publico boolean) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_day > wa_today() or p_day < date '2026-09-01' then return 'fecha'; end if;
  if p_peso is null and p_grasa is null and p_cintura is null then
    delete from wa_body where name = p_name and day = p_day;
  else
    insert into wa_body(name, day, peso, grasa, cintura, publico) values (p_name, p_day, p_peso, p_grasa, p_cintura, coalesce(p_publico, false))
    on conflict (name, day) do update set peso = excluded.peso, grasa = excluded.grasa, cintura = excluded.cintura, publico = excluded.publico;
  end if;
  update wa_body set publico = coalesce(p_publico, false) where name = p_name;   -- la privacidad aplica a todo su historial
  return 'ok';
end $$;

create or replace function wa_my_body(p_name text, p_pin text) returns setof wa_body
language plpgsql security definer set search_path = public, extensions as $$
begin
  if wa_check_pin(p_name, p_pin) not in ('ok', 'created') then return; end if;
  return query select * from wa_body where name = p_name order by day;
end $$;

-- Subir fotos: la página pide un permiso de 10 min y sube a fotos/<permiso>/archivo.jpg
create or replace function wa_upload_ticket(p_name text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text; t text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  delete from wa_tickets where expires < now() - interval '1 day';
  t := replace(gen_random_uuid()::text, '-', '');
  insert into wa_tickets(token, name, expires) values (t, p_name, now() + interval '10 minutes');
  return 't:' || t;
end $$;

create or replace function wa_ticket_ok(p_token text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from wa_tickets where token = p_token and expires > now())
$$;

create or replace function wa_add_photo(p_name text, p_pin text, p_path text, p_day date, p_caption text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if not exists (select 1 from wa_tickets where token = split_part(p_path, '/', 1) and name = p_name) then return 'datos'; end if;
  if p_day is null or p_day > wa_today() or p_day < wa_today() - 2 then return 'fecha'; end if;
  insert into wa_photos(name, day, path, caption) values (p_name, p_day, p_path, left(p_caption, 200));
  return 'ok';
end $$;

create or replace function wa_del_photo(p_name text, p_pin text, p_id bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  delete from wa_photos where id = p_id and name = p_name;
  delete from wa_reactions where target = 'photo:' || p_id;
  return 'ok';
end $$;

create or replace function wa_set_avatar(p_name text, p_pin text, p_path text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if not exists (select 1 from wa_tickets where token = split_part(p_path, '/', 1) and name = p_name) then return 'datos'; end if;
  update wa_people set avatar = p_path, updated_at = now() where name = p_name;
  return 'ok';
end $$;

-- Reacción (emoji: se prende/apaga) o comentario (texto).
create or replace function wa_react(p_name text, p_pin text, p_target text, p_emoji text, p_texto text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_target !~ '^(photo:\d+|day:[A-Za-z]+:\d{4}-\d{2}-\d{2})$' then return 'datos'; end if;
  if p_emoji is not null then
    if length(p_emoji) > 16 then return 'datos'; end if;
    if exists (select 1 from wa_reactions where from_name = p_name and target = p_target and emoji = p_emoji) then
      delete from wa_reactions where from_name = p_name and target = p_target and emoji = p_emoji;
    else
      insert into wa_reactions(from_name, target, emoji) values (p_name, p_target, p_emoji);
    end if;
  elsif coalesce(trim(p_texto), '') <> '' then
    if (select count(*) from wa_reactions where from_name = p_name and created_at > now() - interval '1 minute') >= 10 then return 'calma'; end if;
    insert into wa_reactions(from_name, target, texto) values (p_name, p_target, left(trim(p_texto), 140));
  end if;
  return 'ok';
end $$;

create or replace function wa_del_reaction(p_name text, p_pin text, p_id bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  delete from wa_reactions where id = p_id and from_name = p_name;
  return 'ok';
end $$;

-- Notificaciones
create or replace function wa_save_push(p_name text, p_pin text, p_sub jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_sub->>'endpoint' is null or length(p_sub::text) > 2000 then return 'datos'; end if;
  insert into wa_push(endpoint, name, sub) values (p_sub->>'endpoint', p_name, p_sub)
  on conflict (endpoint) do update set name = excluded.name, sub = excluded.sub;
  return 'ok';
end $$;

create or replace function wa_del_push(p_endpoint text) returns text
language sql security definer set search_path = public as $$
  delete from wa_push where endpoint = p_endpoint; select 'ok'::text
$$;

-- Solo para el robot de recordatorios (GitHub Actions), protegido con un secreto.
create or replace function wa_push_targets(p_secret text)
returns table(name text, sub jsonb, falta boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wa_secrets where k = 'push' and v = p_secret) then return; end if;
  return query
    select p.name, p.sub, not exists (select 1 from wa_checks c where c.name = p.name and c.day = wa_today())
    from wa_push p;
end $$;

create or replace function wa_push_gone(p_secret text, p_endpoint text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wa_secrets where k = 'push' and v = p_secret) then return 'no'; end if;
  delete from wa_push where endpoint = p_endpoint;
  return 'ok';
end $$;

revoke all on table wa_tickets, wa_push, wa_secrets from anon, authenticated;
revoke execute on function wa_ticket_ok(text) from public;
grant  execute on function wa_ticket_ok(text) to anon, authenticated;
grant select on wa_body, wa_photos, wa_reactions to anon;

-- ---------- almacenamiento de fotos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 4194304, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists wa_fotos_insert on storage.objects;
create policy wa_fotos_insert on storage.objects for insert to anon
  with check (bucket_id = 'fotos' and public.wa_ticket_ok((storage.foldername(name))[1]));
