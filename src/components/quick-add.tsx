"use client";

import { useState } from "react";
import { CalendarDays, Film, Lightbulb, ListChecks, Plus, Trophy, Wallet, X } from "lucide-react";
import { EventDialog } from "@/components/event-dialog";
import { ExpenseDialog } from "@/components/dialogs/expense-dialog";
import { IdeaDialog } from "@/components/dialogs/idea-dialog";
import { WatchDialog } from "@/components/dialogs/watch-dialog";
import { QuickBattleEntryDialog, QuickListItemDialog } from "@/components/dialogs/quick-dialogs";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useToday } from "@/lib/use-today";

type Kind = "termin" | "ausgabe" | "liste" | "battle" | "idee" | "watch";

const OPTIONS: { kind: Kind; label: string; icon: typeof Plus }[] = [
  { kind: "termin", label: "Termin", icon: CalendarDays },
  { kind: "ausgabe", label: "Ausgabe", icon: Wallet },
  { kind: "liste", label: "Listeneintrag", icon: ListChecks },
  { kind: "battle", label: "Battle-Wert", icon: Trophy },
  { kind: "idee", label: "Idee", icon: Lightbulb },
  { kind: "watch", label: "Film / Serie", icon: Film },
];

/** „+“-Button auf der Startseite: alles direkt eintragen. */
export function QuickAdd() {
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Kind | null>(null);
  const meta = useCalendarMeta();
  const today = useToday();

  function choose(kind: Kind) {
    setMenu(false);
    setOpen(kind);
  }

  const close = () => setOpen(null);

  return (
    <>
      {menu && (
        <div className="fixed inset-0 z-30 bg-black/30" onClick={() => setMenu(false)}>
          <div
            className="sheet-in pb-safe absolute right-4 bottom-40 w-64 overflow-hidden rounded-2xl bg-card shadow-xl md:bottom-24"
            onClick={(e) => e.stopPropagation()}
          >
            {OPTIONS.map(({ kind, label, icon: Icon }) => (
              <button
                key={kind}
                onClick={() => choose(kind)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/5"
              >
                <Icon size={18} className="text-accent" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setMenu((m) => !m)}
        aria-label={menu ? "Schließen" : "Schnell hinzufügen"}
        className="fixed right-4 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform active:scale-95 md:right-8 md:bottom-8"
      >
        {menu ? <X size={24} /> : <Plus size={26} />}
      </button>

      {open === "termin" && today && (
        <EventDialog
          event={null}
          defaultDate={today}
          onClose={close}
          onSaved={() => {}}
          onDeleted={() => {}}
          categories={meta.categories}
          people={meta.people}
          personColor={meta.personColor}
        />
      )}
      {open === "ausgabe" && <ExpenseDialog expense={null} people={meta.people} onClose={close} />}
      {open === "liste" && <QuickListItemDialog onClose={close} />}
      {open === "battle" && <QuickBattleEntryDialog people={meta.people} onClose={close} />}
      {open === "idee" && <IdeaDialog idea={null} onClose={close} />}
      {open === "watch" && <WatchDialog item={null} onClose={close} />}
    </>
  );
}
