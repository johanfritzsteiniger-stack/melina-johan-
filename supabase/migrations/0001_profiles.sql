-- Schritt 2: Profile für euch beide
-- Im Supabase-Dashboard unter "SQL Editor" einfügen und ausführen.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Nur eingeloggte Nutzer (also ihr beide) dürfen Profile sehen
drop policy if exists "profiles lesen" on public.profiles;
create policy "profiles lesen" on public.profiles
  for select to authenticated using (true);

-- Jeder darf nur das eigene Profil ändern
drop policy if exists "eigenes profil ändern" on public.profiles;
create policy "eigenes profil ändern" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Profil automatisch anlegen, sobald ein Nutzer erstellt wird
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Falls Nutzer schon vor diesem Skript angelegt wurden
insert into public.profiles (id, display_name, email)
select id, split_part(email, '@', 1), email from auth.users
on conflict (id) do nothing;
