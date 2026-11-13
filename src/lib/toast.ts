"use client";

// Kleine Einblendungen unten ("Gespeichert ✓", "Gelöscht – Rückgängig").

export type Toast = {
  id: number;
  message: string;
  action?: { label: string; run: () => void | Promise<void> };
  duration: number;
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeToasts(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getToasts(): Toast[] {
  return toasts;
}

const EMPTY: Toast[] = [];
export function getServerToasts(): Toast[] {
  return EMPTY;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Zeigt eine Einblendung. Mit action z. B. einen "Rückgängig"-Button. */
export function toast(message: string, action?: Toast["action"], duration = action ? 6000 : 2200) {
  const t: Toast = { id: nextId++, message, action, duration };
  // Höchstens zwei gleichzeitig
  toasts = [...toasts.slice(-1), t];
  emit();
  setTimeout(() => dismissToast(t.id), duration);
  return t.id;
}

export function toastSaved(message = "Gespeichert") {
  toast(`${message} ✓`);
}

export function toastError(message: string) {
  toast(message, undefined, 4000);
}
