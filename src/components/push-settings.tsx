"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Check, ChevronDown, ChevronRight, Copy, Share } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import {
  VAPID_PUBLIC_KEY,
  disablePush,
  enablePush,
  getPushState,
  sendTestPush,
  type PushState,
} from "@/lib/push-client";

type Notify = { reminders: boolean; daily: boolean; daily_hour: number; activity: boolean };
const DEFAULTS: Notify = { reminders: true, daily: true, daily_hour: 8, activity: true };

export function PushSettings({ userId }: { userId: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Notify | null>(null);
  const [showSetup, setShowSetup] = useState(!VAPID_PUBLIC_KEY);

  useEffect(() => {
    getPushState().then(setState);
    getSupabase()
      .from("profiles")
      .select("notify")
      .eq("id", userId)
      .single()
      .then(({ data }) => setPrefs({ ...DEFAULTS, ...((data?.notify as Partial<Notify>) ?? {}) }));
  }, [userId]);

  async function savePrefs(next: Notify) {
    setPrefs(next);
    await getSupabase().from("profiles").update({ notify: next }).eq("id", userId);
  }

  async function enable() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await enablePush();
      setStatus(res.ok ? "Aktiviert." : (res.error ?? "Hat nicht geklappt."));
    } catch (e) {
      setStatus("Hat nicht geklappt: " + (e as Error).message);
    }
    setState(await getPushState());
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await disablePush();
    setState(await getPushState());
    setStatus("Auf diesem Gerät deaktiviert.");
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setStatus(await sendTestPush());
    setBusy(false);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Benachrichtigungen</h2>

      {!VAPID_PUBLIC_KEY ? (
        <p className="text-sm text-muted">
          Push ist noch nicht eingerichtet. Das muss nur einmal gemacht werden – siehe „Einrichtung“ unten.
        </p>
      ) : (
        <div className="space-y-3">
          <DeviceState state={state} />
          <div className="flex flex-wrap gap-2">
            {state === "off" && (
              <button
                onClick={enable}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
              >
                <Bell size={16} /> Auf diesem Gerät aktivieren
              </button>
            )}
            {state === "on" && (
              <>
                <button
                  onClick={test}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
                >
                  Test senden
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:bg-foreground/5"
                >
                  <BellOff size={16} /> Deaktivieren
                </button>
              </>
            )}
          </div>
          {status && <p className="text-sm text-muted">{status}</p>}
        </div>
      )}

      {prefs && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">Was möchtest du bekommen?</p>
          <Toggle
            checked={prefs.reminders}
            onChange={(v) => savePrefs({ ...prefs, reminders: v })}
            label="Termin-Erinnerungen"
            hint="Für Termine mit eingestellter Erinnerung"
          />
          <Toggle
            checked={prefs.daily}
            onChange={(v) => savePrefs({ ...prefs, daily: v })}
            label="Tagesübersicht"
            hint="Was heute und morgen ansteht (nur wenn etwas ansteht)"
          >
            {prefs.daily && (
              <select
                value={prefs.daily_hour}
                onChange={(e) => savePrefs({ ...prefs, daily_hour: Number(e.target.value) })}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              >
                {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                  <option key={h} value={h}>
                    {h}:00 Uhr
                  </option>
                ))}
              </select>
            )}
          </Toggle>
          <Toggle
            checked={prefs.activity}
            onChange={(v) => savePrefs({ ...prefs, activity: v })}
            label="Wenn der/die andere etwas einträgt"
            hint="Neue Termine, Wetten, Ausgaben, Ideen, Listen …"
          />
        </div>
      )}

      <div className="border-t border-border pt-4">
        <button onClick={() => setShowSetup((s) => !s)} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          {showSetup ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          Einrichtung (einmalig)
        </button>
        {showSetup && <PushSetup />}
      </div>
    </section>
  );
}

function DeviceState({ state }: { state: PushState | null }) {
  if (state === null) return <p className="text-sm text-muted">Prüfe dieses Gerät …</p>;
  const box = "rounded-lg border p-3 text-sm";
  switch (state) {
    case "on":
      return (
        <p className={`${box} flex items-center gap-2 border-accent/40 bg-accent/10`}>
          <Check size={16} className="text-accent" /> Auf diesem Gerät aktiv.
        </p>
      );
    case "off":
      return <p className={`${box} border-border text-muted`}>Auf diesem Gerät noch nicht aktiv.</p>;
    case "denied":
      return (
        <p className={`${box} border-amber-500/40 bg-amber-500/10`}>
          Benachrichtigungen wurden für diese App abgelehnt. Am iPhone: App vom Home-Bildschirm entfernen, über
          Safari neu hinzufügen und beim Aktivieren „Erlauben“ wählen.
        </p>
      );
    case "ios-browser":
      return (
        <div className={`${box} space-y-1 border-amber-500/40 bg-amber-500/10`}>
          <p className="font-medium">Am iPhone geht Push nur über den Home-Bildschirm:</p>
          <p className="flex flex-wrap items-center gap-1">
            In Safari auf <Share size={14} className="inline" /> Teilen → „Zum Home-Bildschirm“ tippen, die App über das
            neue Icon öffnen und hier aktivieren.
          </p>
        </div>
      );
    default:
      return <p className={`${box} border-border text-muted`}>Dieser Browser unterstützt keine Push-Benachrichtigungen.</p>;
  }
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? "bg-accent" : "bg-foreground/15"}`}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// ---------- Einrichtung: Schlüssel erzeugen, Vercel + Supabase ----------

type SetupKeys = { publicKey: string; privateKey: string; cronSecret: string };
const SETUP_STORAGE = "push-setup-keys";

function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateKeys(): Promise<SetupKeys> {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    publicKey: toBase64Url(pub),
    privateKey: jwk.d!,
    cronSecret: toBase64Url(crypto.getRandomValues(new Uint8Array(24))),
  };
}

function PushSetup() {
  const [keys, setKeys] = useState<SetupKeys | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(SETUP_STORAGE);
      return saved ? (JSON.parse(saved) as SetupKeys) : null;
    } catch {
      return null;
    }
  });
  const [missing, setMissing] = useState<string[] | null>(null);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  useEffect(() => {
    fetch("/api/push/status")
      .then((r) => r.json())
      .then((d: { missing?: string[] }) => setMissing(Array.isArray(d.missing) ? d.missing : null))
      .catch(() => setMissing(null));
  }, []);

  async function create() {
    const k = await generateKeys();
    setKeys(k);
    try {
      localStorage.setItem(SETUP_STORAGE, JSON.stringify(k));
    } catch {
      // Speicher nicht verfügbar – Werte dann sofort übernehmen
    }
  }

  const sql = keys
    ? `-- Zeitplaner: ruft alle 5 Minuten die App auf (Erinnerungen + Tagesübersicht)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'push-erinnerungen';

select cron.schedule(
  'push-erinnerungen',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := '${origin}/api/push/cron',
    headers := jsonb_build_object('Authorization', 'Bearer ${keys.cronSecret}'),
    timeout_milliseconds := 20000
  );
  $$
);`
    : "";

  const allSet = missing !== null && missing.length === 0;

  return (
    <div className="mt-4 space-y-5 text-sm">
      {missing !== null && (
        <p className={`rounded-lg border p-3 ${allSet ? "border-accent/40 bg-accent/10" : "border-border"}`}>
          {allSet
            ? "In Vercel ist alles eingetragen. Fehlt nur noch der Zeitplaner (Schritt 3), falls noch nicht erledigt."
            : `In Vercel fehlt noch: ${missing.join(", ")}`}
        </p>
      )}

      <Step n={1} title="Schlüssel erzeugen">
        <p className="text-muted">
          Die Schlüssel werden nur hier auf deinem Gerät erzeugt. Nur einmal machen – neue Schlüssel würden bestehende
          Geräte abmelden.
        </p>
        {!keys ? (
          <button onClick={create} className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground">
            Schlüssel erzeugen
          </button>
        ) : (
          <p className="text-muted">Erzeugt ✓ (bleiben auf diesem Gerät gespeichert, bis die Einrichtung fertig ist)</p>
        )}
      </Step>

      {keys && (
        <>
          <Step n={2} title="In Vercel eintragen">
            <p className="text-muted">
              Vercel → euer Projekt → Settings → Environment Variables. Diese drei Werte anlegen (alle Umgebungen):
            </p>
            <CopyRow name="NEXT_PUBLIC_VAPID_PUBLIC_KEY" value={keys.publicKey} />
            <CopyRow name="VAPID_PRIVATE_KEY" value={keys.privateKey} />
            <CopyRow name="CRON_SECRET" value={keys.cronSecret} />
            <p className="text-muted">
              Außerdem muss <code className="rounded bg-foreground/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code> vorhanden sein
              (legt die Supabase-Integration normalerweise automatisch an; sonst in Supabase unter Project Settings → API
              Keys den <em>secret</em>/<em>service_role</em> Key kopieren). Danach unter Deployments → ⋯ → Redeploy.
            </p>
          </Step>

          <Step n={3} title="Zeitplaner in Supabase anlegen">
            <p className="text-muted">Supabase → SQL Editor → diesen Text einfügen → Run:</p>
            <pre className="max-h-64 overflow-auto rounded-lg bg-foreground/5 p-3 text-xs whitespace-pre-wrap">{sql}</pre>
            <CopyButton value={sql} label="SQL kopieren" />
          </Step>

          <Step n={4} title="Aktivieren">
            <p className="text-muted">
              Nach dem Redeploy die App neu laden, oben „Auf diesem Gerät aktivieren“ tippen und „Test senden“. Melina
              macht das Gleiche auf ihrem iPhone.
            </p>
          </Step>
        </>
      )}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="font-medium">
        {n}. {title}
      </p>
      {children}
    </div>
  );
}

function CopyRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-xs font-medium">{name}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate text-xs text-muted">{value}</code>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Kopieren:", value);
        }
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-foreground/5"
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
      {label ?? (done ? "Kopiert" : "Kopieren")}
    </button>
  );
}
