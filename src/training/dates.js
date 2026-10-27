// Datums-Helfer. Tag-Index 0 = Montag 12.10.2026 (Restart), Rennen = Samstag 13.02.2027.
export const START = new Date(2026, 9, 12);
export const RACE = new Date(2027, 1, 13);
export const NWEEKS = 18;
export const DAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const DAYSF = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const MONTHS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const DAY_MS = 864e5;
export const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const idxFromDate = (d) => Math.round((midnight(d) - START) / DAY_MS);
export const dateFromIdx = (i) => new Date(2026, 9, 12 + i);
export const dateKey = (i) => { const d = dateFromIdx(i); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
export const fmt = (d) => d.getDate() + ". " + MONTHS[d.getMonth()];
export const dow = (i) => ((i % 7) + 7) % 7;
export const weekOf = (i) => Math.floor(i / 7);

/** Tag/Monat aus dem Plan (ohne Jahr) auf einen Tag-Index abbilden. Jul–Dez = 2026, sonst 2027. */
export function idxFromDayMonth(day, month, year) {
  const y = year || (month >= 7 ? 2026 : 2027);
  return idxFromDate(new Date(y, month - 1, day));
}
