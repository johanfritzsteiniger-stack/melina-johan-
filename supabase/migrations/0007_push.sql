-- Schritt 6: Push-Benachrichtigungen (Tabellen)
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.
-- Den Zeitplaner (alle 5 Minuten) richtet ihr danach über die Einrichtungsseite
-- in der App ein: Einstellungen → Benachrichtigungen → Einrichtung.

-- Ein Eintrag pro Gerät, auf dem Push aktiviert wurde
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
drop policy if exists "eigene geräte" on public.push_subscriptions;
create policy "eigene geräte" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Merkt sich, was schon verschickt wurde (nur der Server greift darauf zu)
create table if not exists public.push_log (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.push_log enable row level security;

-- Einstellungen pro Person
alter table public.profiles
  add column if not exists notify jsonb not null
  default '{"reminders": true, "daily": true, "daily_hour": 8, "activity": true}'::jsonb;

-- Erinnerung pro Termin: Minuten vor Beginn (ganztägig: vor 9:00 Uhr), leer = keine
alter table public.events add column if not exists reminder_minutes int;
