"use client";

import { useCallback, useSyncExternalStore } from "react";

// Ein Wert in der Adresse (z. B. /listen?liste=123): übersteht Neuladen,
// und der Zurück-Button des Browsers funktioniert.
const EVENT = "querychange";

function subscribe(cb: () => void) {
  window.addEventListener("popstate", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("popstate", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set(name, next);
      else url.searchParams.delete(name);
      window.history.pushState(window.history.state, "", url);
      window.dispatchEvent(new Event(EVENT));
    },
    [name],
  );
  return [value, set];
}
