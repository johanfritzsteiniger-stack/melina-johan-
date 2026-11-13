// Zeitzonen-Helfer: Der Server läuft in UTC, ihr lebt in Europe/Berlin.

export const TIME_ZONE = "Europe/Berlin";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Datum (YYYY-MM-DD), Stunde und Minute in Berliner Zeit. */
export function berlinParts(d: Date): { date: string; hour: number; minute: number } {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

/** Berliner Ortszeit ("YYYY-MM-DD", "HH:MM") → echter Zeitpunkt. */
export function berlinToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Abweichung der Berliner Zeit bestimmen (1 oder 2 Stunden) und abziehen
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = berlinParts(new Date(guess));
    const [py, pm, pd] = p.date.split("-").map(Number);
    const shown = Date.UTC(py, pm - 1, pd, p.hour, p.minute);
    guess -= shown - asUtc;
  }
  return new Date(guess);
}
