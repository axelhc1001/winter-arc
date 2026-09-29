-- Winter Arc v3 — tablero "¿quién ya está listo?". Correr después de supabase_v2.sql.
alter table wa_people add column if not exists app_at timestamptz;

-- La página avisa cuando alguien la abre como app instalada.
create or replace function wa_mark_app(p_name text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare s text;
begin
  s := wa_check_pin(p_name, p_pin);
  if s not in ('ok', 'created') then return s; end if;
  update wa_people set app_at = coalesce(app_at, now()) where name = p_name;
  return 'ok';
end $$;

-- Quién ya creó su PIN y quién prendió el aviso (solo sí/no, nada privado).
create or replace function wa_status() returns table(name text, pin boolean, aviso boolean)
language sql stable security definer set search_path = public as $$
  select p.name,
         exists (select 1 from wa_pins x where x.name = p.name),
         exists (select 1 from wa_push x where x.name = p.name)
  from wa_people p
$$;

grant execute on function wa_mark_app(text, text), wa_status() to anon;
