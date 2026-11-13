"use client";

import { Star, X } from "lucide-react";

export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

/** Bottom-Sheet am Handy, zentriertes Fenster am PC. */
export function Modal({
  title,
  onClose,
  onSubmit,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(e);
        }}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>
        {children}
        <div className="flex items-center gap-3 pt-1">{footer}</div>
      </form>
    </div>
  );
}

export function SaveButtons({ onCancel, label = "Speichern" }: { onCancel: () => void; label?: string }) {
  return (
    <>
      <div className="flex-1" />
      <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-foreground/5">
        Abbrechen
      </button>
      <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
        {label}
      </button>
    </>
  );
}

export function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10">
      Löschen
    </button>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
      {text}
    </p>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** Sterne 1–5; mit onChange auswählbar, sonst nur Anzeige. */
export function Stars({
  value,
  onChange,
  size = 18,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: number;
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value ?? 0) >= n;
        const icon = (
          <Star
            size={size}
            className={filled ? "fill-amber-400 text-amber-400" : "text-border"}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            aria-label={`${n} Sterne`}
            className="p-0.5"
          >
            {icon}
          </button>
        ) : (
          <span key={n}>{icon}</span>
        );
      })}
    </span>
  );
}

/** Auswahl als Chips (z. B. Kategorien, Filter). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full border px-3 py-1 text-sm ${
            value === o.value ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
