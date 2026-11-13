-- "Für wen?" wird optional
-- owner_id gesetzt            → Termin einer Person
-- owner_id leer + shared=true → Termin für beide
-- owner_id leer + shared=false → keine Person (Farbe der Kategorie)

alter table public.events add column if not exists shared boolean not null default false;

-- Bisherige Termine ohne Person waren als "Beide" gemeint
update public.events set shared = true where owner_id is null;
