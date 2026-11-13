-- Schritt 4: Battles
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  unit text not null default 'Punkte',
  period text not null default 'week'
    check (period in ('week', 'month', 'none')),   -- none = ein einziger Gesamtstand
  aggregate text not null default 'sum'
    check (aggregate in ('sum', 'best')),          -- Einträge addieren oder Bestwert zählt
  higher_wins boolean not null default true,
  archived boolean not null default false,
  sort int not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.battle_entries (
  id uuid primary key default gen_random_uuid(),
  battle_id uuid not null references public.battles (id) on delete cascade,
  person_id uuid not null references public.profiles (id) on delete cascade,
  date date not null default current_date,
  value numeric not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists battle_entries_battle_date_idx
  on public.battle_entries (battle_id, date);

alter table public.battles enable row level security;
alter table public.battle_entries enable row level security;

drop policy if exists "battles alles" on public.battles;
create policy "battles alles" on public.battles
  for all to authenticated using (true) with check (true);

drop policy if exists "battle_entries alles" on public.battle_entries;
create policy "battle_entries alles" on public.battle_entries
  for all to authenticated using (true) with check (true);

-- Erstes Battle: Spotify-Minuten pro Woche
insert into public.battles (name, emoji, unit, period, aggregate, higher_wins, sort)
select 'Spotify', '🎧', 'Min', 'week', 'sum', true, 1
where not exists (select 1 from public.battles where name = 'Spotify');

-- Live-Updates
do $$
declare t text;
begin
  foreach t in array array['battles', 'battle_entries'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
