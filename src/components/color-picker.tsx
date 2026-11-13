"use client";

import { Check } from "lucide-react";
import { PALETTE } from "@/lib/colors";

/** Farbauswahl: feste Palette plus eigene Farbe. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const custom = !PALETTE.includes(value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card"
          style={{
            backgroundColor: c,
            boxShadow: value.toLowerCase() === c ? `0 0 0 2px var(--card), 0 0 0 4px ${c}` : undefined,
          }}
          aria-label={`Farbe ${c}`}
        >
          {value.toLowerCase() === c && <Check size={14} className="text-white" />}
        </button>
      ))}
      <label
        className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-xs text-muted"
        style={custom ? { backgroundColor: value, borderStyle: "solid" } : undefined}
        title="Eigene Farbe"
      >
        {!custom && "+"}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
