-- Kreuzworträtsel: Wörter, tägliche Rätsel und gemeinsamer Spielstand
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.
-- Danach 0009_crossword_words.sql ausführen (Startpaket mit Wörtern).

-- Wörter mit Hinweisen (Wort nur A–Z, Umlaute als AE/OE/UE, ß als SS)
create table if not exists public.cw_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique check (word ~ '^[A-Z]{3,13}$'),
  clue text not null,
  active boolean not null default true,
  source text not null default 'start' check (source in ('start', 'eigen')),
  last_used date,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

-- Ein Rätsel pro Tag
create table if not exists public.cw_puzzles (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  rows int not null,
  cols int not null,
  -- [{ "n": 1, "dir": "a"|"d", "r": 0, "c": 0, "answer": "WORT", "clue": "…" }]
  entries jsonb not null,
  started_at timestamptz,
  solved_at timestamptz,
  hints_used int not null default 0,
  created_at timestamptz not null default now()
);

-- Gemeinsamer Spielstand: ein Eintrag pro Feld
create table if not exists public.cw_cells (
  puzzle_id uuid not null references public.cw_puzzles (id) on delete cascade,
  r int not null,
  c int not null,
  letter text not null check (letter ~ '^[A-Z]$'),
  revealed boolean not null default false,
  by uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (puzzle_id, r, c)
);

do $$
declare t text;
begin
  foreach t in array array['cw_words', 'cw_puzzles', 'cw_cells'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "alles" on public.%I', t);
    execute format('create policy "alles" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
  foreach t in array array['cw_puzzles', 'cw_cells'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Damit beim Löschen eines Buchstabens auch der andere es live sieht
alter table public.cw_cells replica identity full;
