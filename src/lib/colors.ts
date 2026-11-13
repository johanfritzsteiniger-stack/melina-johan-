/** Auswahl an Farben für Personen und Kategorien. */
export const PALETTE = [
  "#0ea5e9", // Himmelblau
  "#2563eb", // Blau
  "#8b5cf6", // Violett
  "#d946ef", // Magenta
  "#f43f5e", // Rot
  "#f97316", // Orange
  "#f59e0b", // Bernstein
  "#84cc16", // Limette
  "#22c55e", // Grün
  "#14b8a6", // Türkis
  "#71717a", // Grau
  "#78350f", // Braun
];

/** Hex-Farbe mit Transparenz (z. B. für Hintergründe). */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

export function chipStyle(color: string): React.CSSProperties {
  return {
    backgroundColor: withAlpha(color, 0.16),
    borderLeft: `3px solid ${color}`,
  };
}
