-- Schritt 5: Battle-Archiv, Listen, Ideen, Watchlist, Wetten, Ausgaben
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

-- ---------- Battles: Enddatum ----------
alter table public.battles add column if not exists end_date date;

-- ---------- Listen ----------
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  expires_on date,                 -- danach automatisch im Archiv
  archived_at timestamptz,         -- manuell/automatisch archiviert
  sort double precision not null default extract(epoch from now()),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  text text not null,
  quantity text,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  sort double precision not null default extract(epoch from now()),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists list_items_list_idx on public.list_items (list_id);

-- ---------- Ideen ----------
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'sonstiges'
    check (kind in ('restaurant', 'ausflug', 'reise', 'aktivitaet', 'sonstiges')),
  location text,
  link text,
  note text,
  done_at date,
  done_note text,
  rating int check (rating between 1 and 5),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Watchlist ----------
create table if not exists public.watch_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'film' check (kind in ('film', 'serie')),
  platform text,
  note text,
  watched_at date,
  ratings jsonb not null default '{}'::jsonb,   -- { "<profil-id>": 1..5 }
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Wetten ----------
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  positions jsonb not null default '{}'::jsonb, -- { "<profil-id>": "Was diese Person behauptet" }
  stake text,
  due_date date,
  winner_id uuid references public.profiles (id) on delete set null,
  is_draw boolean not null default false,
  resolved_at timestamptz,
  stake_paid boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- Ausgaben ----------
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  from_id uuid references public.profiles (id) on delete set null,  -- zahlt
  to_id uuid references public.profiles (id) on delete set null,    -- bekommt
  amount numeric(10, 2) not null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  amount numeric(10, 2) not null check (amount > 0),
  paid_by uuid not null references public.profiles (id) on delete cascade,
  payer_share int not null default 50 check (payer_share between 0 and 100), -- Anteil (%) der zahlenden Person
  date date not null default current_date,
  category text,
  settlement_id uuid references public.settlements (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists expenses_open_idx on public.expenses (settlement_id);

-- ---------- Rechte: ihr beide dürft alles ----------
do $$
declare t text;
begin
  foreach t in array array['lists', 'list_items', 'ideas', 'watch_items', 'bets', 'settlements', 'expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "alles" on public.%I', t);
    execute format('create policy "alles" on public.%I for all to authenticated using (true) with check (true)', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
