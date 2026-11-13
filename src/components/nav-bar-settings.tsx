"use client";

import { Check } from "lucide-react";
import { BAR_CHOICES, BAR_SIZE } from "@/lib/nav";
import { setBarItems, useBarHrefs } from "@/lib/use-nav-bar";
import { toastSaved } from "@/lib/toast";

/** Auswahl der 4 Bereiche in der unteren Leiste (nur am Handy sichtbar). */
export function NavBarSettings() {
  const selected = useBarHrefs();

  function toggle(href: string) {
    if (selected.includes(href)) {
      if (selected.length <= 1) return;
      setBarItems(selected.filter((h) => h !== href));
      return;
    }
    if (selected.length >= BAR_SIZE) return;
    const next = [...selected, href];
    setBarItems(next);
    if (next.length === BAR_SIZE) toastSaved("Leiste gespeichert");
  }

  const full = selected.length >= BAR_SIZE;

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 md:hidden">
      <h2 className="font-semibold">Untere Leiste</h2>
      <p className="text-sm text-muted">
        Wähle {BAR_SIZE} Bereiche ({selected.length}/{BAR_SIZE}). Alles andere findest du unter „Mehr“. Gilt für dieses
        Gerät.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BAR_CHOICES.map(({ href, label, icon: Icon }) => {
          const on = selected.includes(href);
          const disabled = !on && full;
          return (
            <button
              key={href}
              type="button"
              onClick={() => toggle(href)}
              disabled={disabled}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                on ? "border-accent bg-accent/10 font-medium" : "border-border text-muted"
              } disabled:opacity-40`}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {on && <Check size={14} className="text-accent" />}
            </button>
          );
        })}
      </div>
      {!full && <p className="text-xs text-amber-600">Noch {BAR_SIZE - selected.length} auswählen.</p>}
    </section>
  );
}
