-- Winter Arc — pegar TODO esto en Supabase > SQL Editor > New query > Run
-- Se puede correr más de una vez sin romper nada.

create extension if not exists pgcrypto with schema extensions;

create table if not exists wa_people (
  name       text primary key,
  goals      jsonb,
  race       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Los PIN viven aparte y la página NO puede leer esta tabla.
create table if not exists wa_pins (
  name         text primary key references wa_people(name) on delete cascade,
  pin_hash     text not null,
  fails        int  not null default 0,
  locked_until timestamptz
);

create table if not exists wa_checks (
  name       text references wa_people(name) on delete cascade,
  day        date,
  habits     jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  primary key (name, day)
);

insert into wa_people(name) values
  ('Axel'), ('Emilio'), ('Santiago'), ('Diego'), ('Lorenzo')
on conflict do nothing;

alter table wa_people enable row level security;
alter table wa_pins   enable row level security;
alter table wa_checks enable row level security;

drop policy if exists wa_people_read on wa_people;
drop policy if exists wa_checks_read on wa_checks;
create policy wa_people_read on wa_people for select using (true);
create policy wa_checks_read on wa_checks for select using (true);
-- Sin políticas de escritura: solo se escribe por las funciones de abajo, que validan el PIN.

create or replace function wa_today() returns date
language sql stable as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- Valida el PIN. Si la persona aún no tiene PIN, el primero que pone lo crea.
-- 5 intentos fallidos = bloqueo de 15 minutos.
create or replace function wa_check_pin(p_name text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare r wa_pins;
begin
  if not exists (select 1 from wa_people where name = p_name) then return 'no_user'; end if;
  if p_pin is null or p_pin !~ '^\d{4}$' then return 'bad'; end if;
  select * into r from wa_pins where name = p_name for update;
  if not found then
    insert into wa_pins(name, pin_hash) values (p_name, crypt(p_pin, gen_salt('bf')));
    return 'created';
  end if;
  if r.locked_until is not null and r.locked_until > now() then return 'locked'; end if;
  if r.pin_hash = crypt(p_pin, r.pin_hash) then
    update wa_pins set fails = 0, locked_until = null where name = p_name;
    return 'ok';
  end if;
  update wa_pins
     set fails = fails + 1,
         locked_until = case when fails + 1 >= 5 then now() + interval '15 minutes' end
   where name = p_name;
  return 'bad';
end $$;

-- Guarda las marcas de un día (hoy o hasta 2 días atrás).
create or replace function wa_save_day(p_name text, p_pin text, p_day date, p_habits jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_day > wa_today() or p_day < wa_today() - 2 or p_day > date '2026-12-09' or p_day < date '2026-10-01' then return 'fecha'; end if;
  if jsonb_typeof(p_habits) <> 'object' or length(p_habits::text) > 2000 then return 'datos'; end if;
  insert into wa_checks(name, day, habits, updated_at) values (p_name, p_day, p_habits, now())
  on conflict (name, day) do update set habits = excluded.habits, updated_at = now();
  return 'ok';
end $$;

-- Metas: se pueden cambiar hasta el 1 de octubre. Quien nunca las puso, las puede poner después una vez.
create or replace function wa_save_goals(p_name text, p_pin text, p_goals jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text; g jsonb;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  select goals into g from wa_people where name = p_name;
  if g is not null and wa_today() > date '2026-10-01' then return 'congeladas'; end if;
  if jsonb_typeof(p_goals) <> 'object' or length(p_goals::text) > 2000 then return 'datos'; end if;
  update wa_people set goals = p_goals, updated_at = now() where name = p_name;
  return 'ok';
end $$;

-- Carrera: la fecha de inscripción la pone el servidor (no se puede hacer trampa con el bonus).
create or replace function wa_save_race(p_name text, p_pin text, p_race jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text; old jsonb; nr jsonb;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if jsonb_typeof(p_race) <> 'object' or length(p_race::text) > 2000 then return 'datos'; end if;
  select race into old from wa_people where name = p_name;
  nr := p_race - 'inscrito_en';
  if coalesce((nr->>'inscrito')::boolean, false) then
    nr := nr || jsonb_build_object('inscrito_en', coalesce(old->>'inscrito_en', wa_today()::text));
  else
    nr := nr || jsonb_build_object('completada', false);
  end if;
  update wa_people set race = nr, updated_at = now() where name = p_name;
  return 'ok';
end $$;

revoke all on table wa_pins from anon, authenticated;
grant select on wa_people, wa_checks to anon;
grant execute on function wa_check_pin(text, text), wa_save_day(text, text, date, jsonb),
  wa_save_goals(text, text, jsonb), wa_save_race(text, text, jsonb) to anon;

-- Si alguien olvida su PIN (o alguien le "ganó" el nombre), bórralo y que lo vuelva a crear:
--   delete from wa_pins where name = 'Diego';
