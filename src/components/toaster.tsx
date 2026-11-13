"use client";

import { useSyncExternalStore } from "react";
import { dismissToast, getServerToasts, getToasts, subscribeToasts } from "@/lib/toast";

/** Einblendungen unten mittig – am Handy über der Navigationsleiste. */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-foreground px-4 py-2.5 text-sm text-background shadow-lg"
          role="status"
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={async () => {
                dismissToast(t.id);
                await t.action!.run();
              }}
              className="shrink-0 font-semibold text-soft"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
