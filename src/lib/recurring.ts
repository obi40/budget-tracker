import type { Freq, Recurring, Txn } from '../db/types';
import { addDays, daysInMonth } from './dates';
import { toBase, type Rates } from './money';

const pad = (n: number) => String(n).padStart(2, '0');

/** Next date in a series; monthly/yearly keep the original day (31st → 28th/30th → 31st). */
export function nextOccurrence(date: string, freq: Freq, interval: number, anchorDay: number): string {
  if (freq === 'weekly') return addDays(date, 7 * interval);
  const [y, m] = date.split('-').map(Number);
  const t = y * 12 + (m - 1) + (freq === 'monthly' ? interval : 12 * interval);
  const ny = Math.floor(t / 12), nm = (t % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(anchorDay, daysInMonth(ny, nm)))}`;
}

/** Every date from r.nextDate up to and including `until`. */
export function occurrencesUntil(r: Pick<Recurring, 'nextDate' | 'freq' | 'interval' | 'anchorDay'>, until: string, max = 120): string[] {
  const out: string[] = [];
  let d = r.nextDate;
  while (d <= until && out.length < max) {
    out.push(d);
    d = nextOccurrence(d, r.freq, r.interval, r.anchorDay);
  }
  return out;
}

export function txnFromRecurring(r: Recurring, date: string): Txn {
  return {
    type: r.type, date, amount: r.amount, currency: r.currency, accountId: r.accountId,
    toAccountId: r.type === 'transfer' ? r.toAccountId : undefined,
    categoryId: r.type === 'transfer' ? undefined : r.categoryId,
    payee: r.name, recurringId: r.id, tags: [],
  };
}

/** Average monthly cost in base currency. */
export function monthlyCost(r: Recurring, rates: Rates): number {
  const per = r.freq === 'weekly' ? 52 / 12 : r.freq === 'monthly' ? 1 : 1 / 12;
  return Math.round((toBase(r.amount, r.currency, rates) * per) / Math.max(1, r.interval));
}
