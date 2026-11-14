"use client";

// Meldet "Tabelle X hat sich geändert", damit alle Ansichten mit dieser Tabelle
// sofort neu laden – unabhängig davon, ob die Live-Verbindung gerade funktioniert.

type Listener = (table: string) => void;
const listeners = new Set<Listener>();

export function onTableChange(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function refreshTable(...tables: string[]) {
  for (const t of tables) listeners.forEach((l) => l(t));
}

/**
 * fetch-Hülle für den Supabase-Client: Nach jedem erfolgreichen Speichern/Löschen
 * (POST, PATCH, PUT, DELETE auf /rest/v1/<tabelle>) wird die Tabelle neu geladen.
 */
export const fetchWithRefresh: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  try {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (res.ok && method !== "GET" && method !== "HEAD") {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const match = /\/rest\/v1\/([a-z_]+)/.exec(url);
      // Kurz warten, damit die Antwort der eigenen Anfrage zuerst verarbeitet wird
      if (match) setTimeout(() => refreshTable(match[1]), 0);
    }
  } catch {
    // Nur ein Zusatz – Fehler hier dürfen nichts kaputtmachen
  }
  return res;
};

/** Ruft fn auf, wenn eine der Tabellen geändert wurde oder die App wieder sichtbar wird. */
export function subscribeRefresh(tables: string[], fn: () => void) {
  const off = onTableChange((t) => {
    if (tables.includes(t)) fn();
  });
  const onVisible = () => {
    if (document.visibilityState === "visible") fn();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);
  return () => {
    off();
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
}
