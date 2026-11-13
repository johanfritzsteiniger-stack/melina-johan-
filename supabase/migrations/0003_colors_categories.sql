-- Personenfarben und eigene Kategorien
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

-- 1) Farbe pro Person
alter table public.profiles add column if not exists color text;

with ordered as (
  select id, row_number() over (order by created_at) as n
  from public.profiles where color is null
)
update public.profiles p
set color = case when o.n = 1 then '#0ea5e9' else '#f97316' end
from ordered o where p.id = o.id;

alter table public.profiles alter column color set default '#0ea5e9';

-- 2) Gemeinsame App-Einstellungen (z. B. Farbe für "Beide")
create table if not exists public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
drop policy if exists "settings alles" on public.app_settings;
create policy "settings alles" on public.app_settings
  for all to authenticated using (true) with check (true);
insert into public.app_settings (key, value) values ('shared_color', '#8b5cf6')
on conflict (key) do nothing;

-- 3) Eigene Kategorien
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#71717a',
  is_birthday boolean not null default false,  -- jährlich wiederholen + Alter anzeigen
  is_countdown boolean not null default false, -- standardmäßig als Countdown
  sort int not null default 0,
  legacy_key text unique,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;
drop policy if exists "categories alles" on public.categories;
create policy "categories alles" on public.categories
  for all to authenticated using (true) with check (true);

insert into public.categories (name, color, is_birthday, is_countdown, sort, legacy_key) values
  ('Termin',     '#0ea5e9', false, false, 1, 'termin'),
  ('Urlaub',     '#14b8a6', false, true,  2, 'urlaub'),
  ('Feier',      '#f59e0b', false, false, 3, 'feier'),
  ('Geburtstag', '#f43f5e', true,  false, 4, 'geburtstag'),
  ('Sonstiges',  '#71717a', false, false, 5, 'sonstiges')
on conflict (legacy_key) do nothing;

-- 4) Termine: Kategorie-Verweis und "für wen"
alter table public.events
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- Bestehende Termine übernehmen
update public.events e
set category_id = c.id
from public.categories c
where e.category_id is null and c.legacy_key = e.category;

update public.events set owner_id = created_by where owner_id is null and created_by is not null;

-- Alte Textspalte wird nicht mehr gebraucht
alter table public.events drop constraint if exists events_category_check;
alter table public.events drop column if exists category;

-- Live-Updates auch für Kategorien und Profile
do $$
declare t text;
begin
  foreach t in array array['categories', 'profiles', 'app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
