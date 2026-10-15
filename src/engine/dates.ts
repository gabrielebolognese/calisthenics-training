// Calendar dates as 'YYYY-MM-DD' in device local time [D55]. Arithmetic runs in UTC so DST never shifts a day.

export type LocalDate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function localDate(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function utcMs(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  const t = new Date(utcMs(d) + n * 86_400_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((utcMs(b) - utcMs(a)) / 86_400_000);
}

export const maxDate = (a: LocalDate, b: LocalDate) => (a > b ? a : b);

/** Local midnight at the start of a date, in ms. */
export function startOfLocalDate(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, day).getTime();
}
