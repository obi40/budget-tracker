// Dates are local calendar dates stored as "YYYY-MM-DD"; months as "YYYY-MM".

const pad = (n: number) => String(n).padStart(2, '0');

export function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayISO = () => iso(new Date());
export const monthOf = (date: string) => date.slice(0, 7);
export const thisMonth = () => monthOf(todayISO());

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

export const daysInMonth = (y: number, m1: number) => new Date(y, m1, 0).getDate();

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function addDays(date: string, n: number): string {
  const d = parseISO(date);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(daysInMonth(y, m))}`;
}

export function monthLabel(month: string, short = false): string {
  return parseISO(`${month}-01`).toLocaleDateString('en-US', short ? { month: 'short' } : { month: 'long', year: 'numeric' });
}

export function dayLabel(date: string): string {
  const t = todayISO();
  if (date === t) return 'Today';
  if (date === addDays(t, -1)) return 'Yesterday';
  if (date === addDays(t, 1)) return 'Tomorrow';
  return parseISO(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: date.slice(0, 4) === t.slice(0, 4) ? undefined : 'numeric' });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [y1, m1] = fromMonth.split('-').map(Number);
  const [y2, m2] = toMonth.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
