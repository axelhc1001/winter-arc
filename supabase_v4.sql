-- Winter Arc v4 — termina el 9 de diciembre + el recordatorio sale una sola vez por día.
create or replace function wa_save_day(p_name text, p_pin text, p_day date, p_habits jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  if p_day > wa_today() or p_day < wa_today() - 2 or p_day > date '2026-12-09' or p_day < date '2026-10-01' then return 'fecha'; end if;
  if jsonb_typeof(p_habits) <> 'object' or length(p_habits::text) > 2000 then return 'datos'; end if;
  if coalesce((p_habits->>'comodin')::boolean, false)
     and (select count(*) from wa_checks where name = p_name and day <> p_day and coalesce((habits->>'comodin')::boolean, false)) >= 2
  then return 'comodines'; end if;
  insert into wa_checks(name, day, habits, updated_at) values (p_name, p_day, p_habits, now())
  on conflict (name, day) do update set habits = excluded.habits, updated_at = now();
  return 'ok';
end $$;

create table if not exists wa_push_log (day date primary key, sent_at timestamptz default now());
alter table wa_push_log enable row level security;
revoke all on table wa_push_log from anon, authenticated;

-- El robot "aparta" el día: solo el primer intento de la noche manda avisos.
create or replace function wa_push_claim(p_secret text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from wa_secrets where k = 'push' and v = p_secret) then return false; end if;
  insert into wa_push_log(day) values (wa_today()) on conflict do nothing;
  return found;
end $$;
