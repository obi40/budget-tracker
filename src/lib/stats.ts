import type { Account, Txn } from '../db/types';
import { convert, toBase, type Rates } from './money';
import { lastDayOf, monthOf } from './dates';

/** Category breakdown of an income/expense txn, in the txn's own currency. */
export function txnParts(t: Txn): { categoryId: number | undefined; amount: number }[] {
  if (t.splits && t.splits.length) return t.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount }));
  return [{ categoryId: t.categoryId, amount: t.amount }];
}

export interface Totals { income: number; expense: number; net: number }

export function totals(txns: Txn[], rates: Rates): Totals {
  let income = 0, expense = 0;
  for (const t of txns) {
    if (t.type === 'income') income += toBase(t.amount, t.currency, rates);
    else if (t.type === 'expense') expense += toBase(t.amount, t.currency, rates);
  }
  return { income, expense, net: income - expense };
}

export const inMonth = (txns: Txn[], month: string) => txns.filter((t) => monthOf(t.date) === month);
export const inRange = (txns: Txn[], from: string, to: string) => txns.filter((t) => t.date >= from && t.date <= to);

/** categoryId → base-currency total for one kind. */
export function byCategory(txns: Txn[], rates: Rates, kind: 'expense' | 'income' = 'expense'): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of txns) {
    if (t.type !== kind) continue;
    for (const p of txnParts(t)) {
      const k = p.categoryId ?? -1;
      m.set(k, (m.get(k) ?? 0) + toBase(p.amount, t.currency, rates));
    }
  }
  return m;
}

/** "YYYY-MM" → base-currency spending, for one category. */
export function spentByMonth(txns: Txn[], rates: Rates, categoryId: number): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    for (const p of txnParts(t)) {
      if (p.categoryId !== categoryId) continue;
      const k = monthOf(t.date);
      m.set(k, (m.get(k) ?? 0) + toBase(p.amount, t.currency, rates));
    }
  }
  return m;
}

/** Change an account sees from one txn, in the account's currency. */
export function txnEffect(t: Txn, acc: Account, rates: Rates): number {
  let d = 0;
  if (t.accountId === acc.id) {
    const amt = convert(t.amount, t.currency, acc.currency, rates);
    d += t.type === 'income' ? amt : -amt;
  }
  if (t.type === 'transfer' && t.toAccountId === acc.id) {
    d += t.toAmount ?? convert(t.amount, t.currency, acc.currency, rates);
  }
  return d;
}

export function balance(acc: Account, txns: Txn[], rates: Rates, upTo?: string): number {
  let b = acc.opening;
  for (const t of txns) if (!upTo || t.date <= upTo) b += txnEffect(t, acc, rates);
  return b;
}

export function netWorth(accounts: Account[], txns: Txn[], rates: Rates, upTo?: string): number {
  return accounts.reduce((s, a) => s + toBase(balance(a, txns, rates, upTo), a.currency, rates), 0);
}

export function monthlySeries(txns: Txn[], rates: Rates, months: string[]) {
  return months.map((month) => ({ month, ...totals(inMonth(txns, month), rates) }));
}

export function netWorthSeries(accounts: Account[], txns: Txn[], rates: Rates, months: string[]) {
  return months.map((month) => ({ month, value: netWorth(accounts, txns, rates, lastDayOf(month)) }));
}

export function savingsRate(t: Totals): number | null {
  return t.income > 0 ? (t.income - t.expense) / t.income : null;
}
