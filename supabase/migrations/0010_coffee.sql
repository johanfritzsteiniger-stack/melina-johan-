-- Kaffee-Zähler
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create table if not exists public.coffees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  drunk_at timestamptz not null default now()
);
create index if not exists coffees_time_idx on public.coffees (drunk_at);

alter table public.coffees enable row level security;
drop policy if exists "alles" on public.coffees;
create policy "alles" on public.coffees for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coffees'
  ) then
    alter publication supabase_realtime add table public.coffees;
  end if;
end;
$$;

-- Tassen pro Person und Tag für ein Jahr (deutsche Zeit) – bleibt klein, egal wie viel Kaffee
create or replace function public.coffee_year(y int)
returns table (user_id uuid, day date, cups int)
language sql stable security invoker set search_path = public
as $$
  select c.user_id, (c.drunk_at at time zone 'Europe/Berlin')::date as day, count(*)::int as cups
  from public.coffees c
  where c.drunk_at >= (make_date(y, 1, 1)::timestamp at time zone 'Europe/Berlin')
    and c.drunk_at <  (make_date(y + 1, 1, 1)::timestamp at time zone 'Europe/Berlin')
  group by 1, 2
  order by 2;
$$;
grant execute on function public.coffee_year(int) to authenticated;
