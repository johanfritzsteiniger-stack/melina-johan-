"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { PALETTE } from "@/lib/colors";

/**
 * Farbauswahl: feste Palette plus eigene Farbe.
 * Eine eigene Farbe wird erst gespeichert, wenn der Farbwähler geschlossen
 * oder auf „Übernehmen“ getippt wird – nicht bei jedem Zwischenschritt.
 */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const current = value.toLowerCase();
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Natives "change"-Event = Farbwähler wurde bestätigt/geschlossen
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const commit = () => {
      const color = el.value.toLowerCase();
      setDraft(null);
      onChangeRef.current(color);
    };
    el.addEventListener("change", commit);
    return () => el.removeEventListener("change", commit);
  }, []);

  const shown = draft ?? current;
  const isCustom = !PALETTE.includes(shown);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            setDraft(null);
            onChange(c);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{
            backgroundColor: c,
            boxShadow: shown === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined,
          }}
          aria-label={`Farbe ${c}`}
        >
          {shown === c && <Check size={14} className="text-white" />}
        </button>
      ))}

      <label
        className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-xs text-muted"
        style={
          isCustom
            ? {
                backgroundColor: shown,
                borderStyle: "solid",
                boxShadow: `0 0 0 2px var(--card), 0 0 0 4px ${shown}`,
              }
            : undefined
        }
        title="Eigene Farbe wählen"
      >
        {isCustom ? <Check size={14} className="text-white" /> : "+"}
        <input
          ref={inputRef}
          type="color"
          defaultValue={current}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      {draft && draft !== current && (
        <button
          type="button"
          onClick={() => {
            const color = draft;
            setDraft(null);
            onChange(color);
          }}
          className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
        >
          Übernehmen
        </button>
      )}
    </div>
  );
}
