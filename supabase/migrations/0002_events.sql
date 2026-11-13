-- Schritt 3: Kalender und Countdowns
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'termin'
    check (category in ('termin', 'urlaub', 'feier', 'geburtstag', 'sonstiges')),
  start_date date not null,
  end_date date,                       -- leer = eintägig
  start_time time,                     -- leer = ganztägig
  end_time time,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'weekly', 'monthly', 'yearly')),
  location text,
  notes text,
  is_countdown boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists events_start_date_idx on public.events (start_date);

alter table public.events enable row level security;

-- Ihr beide dürft alle gemeinsamen Termine sehen und bearbeiten
drop policy if exists "events alles" on public.events;
create policy "events alles" on public.events
  for all to authenticated using (true) with check (true);

-- updated_at automatisch setzen
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- Live-Updates: Änderungen erscheinen sofort beim anderen
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;
end;
$$;
