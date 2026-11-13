# Melina & Johan

Unsere gemeinsame Web-App: Kalender mit Countdowns, Battles, Listen, Ausgaben, Ideen, Watchlist und Wetten.

**Stack:** Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Datenbank + Login), Vercel (Hosting).

## Einrichtung

### 1. Supabase

1. Im Supabase-Projekt den **SQL Editor** öffnen und alle Dateien aus `supabase/migrations/` der Reihe nach einfügen und ausführen (`0001_…`, `0002_…`, …). Bei neuen Schritten kommen neue Dateien dazu, die dann ebenfalls einmal ausgeführt werden.
2. **Authentication → Sign In / Providers → Email:** „Allow new users to sign up“ **ausschalten**, damit sich niemand Fremdes registrieren kann.
3. **Authentication → Users → Add user → Create new user:** einen Nutzer für Melina und einen für Johan anlegen (E-Mail, Passwort, „Auto Confirm User“ anhaken).
4. Unter **Project Settings → API Keys** die Projekt-URL und den **Publishable Key** kopieren.

### 2. Vercel

1. Auf vercel.com mit GitHub anmelden → **Add New → Project** → dieses Repo importieren.
2. Bei **Environment Variables** eintragen:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. **Deploy** klicken. Danach wird jede Änderung im Repo automatisch veröffentlicht.

### 3. Auf dem Handy installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü → „App installieren“

## Lokal starten (optional)

```bash
cp .env.example .env.local   # Werte eintragen
npm install
npm run dev
```

## Fahrplan

- [x] Schritt 2: Login, Dashboard, Layout für Handy und PC
- [x] Schritt 3: Kalender und Countdowns (inkl. Personenfarben und eigenen Kategorien)
- [x] Schritt 4: Battles (inkl. Spotify-Minuten)
- [x] Schritt 5: Listen, Ausgaben, Ideen, Watchlist, Wetten (mit Archiv)
- [x] Schritt 6: Push-Benachrichtigungen (Einrichtung: Einstellungen → Benachrichtigungen → Einrichtung)
