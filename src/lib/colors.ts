/** Auswahl an Farben für Personen und Kategorien. */
export const PALETTE = [
  "#c2603e", // Terrakotta
  "#6f8f7a", // Salbei
  "#e0a458", // Honig
  "#d9677a", // Rosé
  "#8c7ab8", // Lavendel
  "#4f7fa8", // Taubenblau
  "#5c3a2a", // Kakao
  "#0ea5e9", // Himmelblau
  "#8b5cf6", // Violett
  "#f97316", // Orange
  "#22c55e", // Grün
  "#71717a", // Grau
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
