import { describe, expect, it } from 'vitest';
import { convert, format, parseAmount, toInput, DEFAULT_RATES } from './money';
import { addMonths, monthRange } from './dates';
import { categoryMonth, budgetStatus } from './budget';
import { monthlyCost, nextOccurrence, occurrencesUntil } from './recurring';
import { payoff } from './debt';
import { parseCSV, parseDate, parseSigned, toCSV } from './csv';
import { balance, byCategory, netWorth, totals } from './stats';
import type { Account, Recurring, Txn } from '../db/types';

describe('money', () => {
  it('parses into minor units without float drift', () => {
    expect(parseAmount('12.5', 'JOD')).toBe(12500);
    expect(parseAmount('1,250.75', 'USD')).toBe(125075);
    expect(parseAmount('0.1', 'EUR')).toBe(10);
    expect(parseAmount('.005', 'JOD')).toBe(5);
    expect(parseAmount('3.14159', 'JOD')).toBe(3141); // extra decimals dropped
    expect(parseAmount('', 'JOD')).toBeNull();
    expect(parseAmount('abc', 'JOD')).toBeNull();
    expect(parseAmount('.', 'JOD')).toBeNull();
    expect(parseAmount('١٢٫٥', 'JOD')).toBe(12500); // Arabic keypad
  });
  it('formats each currency with its decimals', () => {
    expect(format(12500, 'JOD')).toBe('JD 12.500');
    expect(format(-125075, 'USD')).toBe('−$1,250.75');
    expect(format(990, 'EUR', { sign: true })).toBe('+€9.90');
    expect(toInput(12500, 'JOD')).toBe('12.5');
  });
  it('converts via JOD rates', () => {
    expect(convert(10000, 'USD', 'JOD', DEFAULT_RATES)).toBe(70900); // $100 → JD 70.900
    expect(convert(70900, 'JOD', 'USD', DEFAULT_RATES)).toBe(10000);
    expect(convert(500, 'JOD', 'JOD', DEFAULT_RATES)).toBe(500);
  });
});

describe('dates', () => {
  it('adds months across years', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('budget rollover', () => {
  const budgets = new Map([['2026-09', 100000], ['2026-10', 100000], ['2026-11', 100000]]);
  const spent = new Map([['2026-09', 80000], ['2026-10', 130000], ['2026-11', 10000]]);
  it('without rollover each month stands alone', () => {
    expect(categoryMonth(budgets, spent, false, '2026-11')).toEqual({ budgeted: 100000, carried: 0, spent: 10000, available: 100000, left: 90000 });
  });
  it('with rollover leftovers and overspending carry forward', () => {
    // Sep: +20 left; Oct: 100+20-130 = -10 → Nov available 90
    expect(categoryMonth(budgets, spent, true, '2026-11')).toEqual({ budgeted: 100000, carried: -10000, spent: 10000, available: 90000, left: 80000 });
  });
  it('carries into months with no budget set', () => {
    expect(categoryMonth(budgets, spent, true, '2026-12').carried).toBe(80000);
  });
  it('status thresholds', () => {
    expect(budgetStatus(50, 100)).toBe('ok');
    expect(budgetStatus(80, 100)).toBe('warn');
    expect(budgetStatus(101, 100)).toBe('over');
    expect(budgetStatus(5, 0)).toBe('over');
  });
});

describe('recurring', () => {
  it('keeps the anchor day through short months', () => {
    expect(nextOccurrence('2026-01-31', 'monthly', 1, 31)).toBe('2026-02-28');
    expect(nextOccurrence('2026-02-28', 'monthly', 1, 31)).toBe('2026-03-31');
    expect(nextOccurrence('2028-02-29', 'yearly', 1, 29)).toBe('2029-02-28');
    expect(nextOccurrence('2026-11-10', 'weekly', 2, 10)).toBe('2026-11-24');
  });
  it('lists due occurrences', () => {
    const r = { nextDate: '2026-09-15', freq: 'monthly' as const, interval: 1, anchorDay: 15 };
    expect(occurrencesUntil(r, '2026-11-15')).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
    expect(occurrencesUntil(r, '2026-09-14')).toEqual([]);
  });
  it('normalises cost to per month', () => {
    const r = { amount: 12000, currency: 'JOD', freq: 'yearly', interval: 1 } as Recurring;
    expect(monthlyCost(r, DEFAULT_RATES)).toBe(1000);
  });
});

describe('debt payoff', () => {
  it('handles zero interest and too-small payments', () => {
    expect(payoff(100000, 0, 25000).months).toBe(4);
    expect(payoff(100000, 24, 1000).months).toBe(Infinity);
  });
  it('estimates interest-bearing payoff', () => {
    const p = payoff(1000000, 12, 100000); // 1000 at 1%/mo, 100/mo
    expect(p.months).toBe(11);
    expect(p.interest).toBeGreaterThan(50000);
    expect(p.interest).toBeLessThan(65000);
  });
});

describe('csv', () => {
  it('round-trips quotes, commas and newlines', () => {
    const rows = [['a', 'b,c', 'say "hi"', 'x\ny']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });
  it('detects semicolons', () => {
    expect(parseCSV('Date;Amount\n01/02/2026;-5,50')).toEqual([['Date', 'Amount'], ['01/02/2026', '-5,50']]);
  });
  it('parses bank dates and amounts', () => {
    expect(parseDate('05/11/2026', 'DD/MM/YYYY')).toBe('2026-11-05');
    expect(parseDate('11/05/26', 'MM/DD/YYYY')).toBe('2026-11-05');
    expect(parseDate('2026-11-05 10:30', 'YYYY-MM-DD')).toBe('2026-11-05');
    expect(parseDate('nope', 'YYYY-MM-DD')).toBeNull();
    expect(parseSigned('-1,234.50')).toBe(-1234.5);
    expect(parseSigned('(12.00)')).toBe(-12);
    expect(parseSigned('1.234,56')).toBe(1234.56);
    expect(parseSigned('-5,50', true)).toBe(-5.5);
    expect(parseSigned('12,500', true)).toBe(12.5);
    expect(parseSigned('1,250')).toBe(1250); // comma = thousands by default
    expect(parseSigned('JD 7.250')).toBe(7.25);
    expect(parseSigned('')).toBeNull();
  });
});

describe('stats', () => {
  const cash: Account = { id: 1, name: 'Cash', type: 'cash', currency: 'JOD', opening: 50000 };
  const usd: Account = { id: 2, name: 'USD', type: 'bank', currency: 'USD', opening: 0 };
  const txns: Txn[] = [
    { type: 'income', date: '2026-11-01', amount: 1000000, currency: 'JOD', accountId: 1, categoryId: 10 },
    { type: 'expense', date: '2026-11-02', amount: 30000, currency: 'JOD', accountId: 1, splits: [{ categoryId: 1, amount: 20000 }, { categoryId: 2, amount: 10000 }] },
    { type: 'expense', date: '2026-11-03', amount: 1000, currency: 'USD', accountId: 1, categoryId: 1 }, // $10 paid from JOD cash
    { type: 'transfer', date: '2026-11-04', amount: 70900, currency: 'JOD', accountId: 1, toAccountId: 2, toAmount: 10000 },
  ];
  it('totals and category split in JOD', () => {
    expect(totals(txns, DEFAULT_RATES)).toEqual({ income: 1000000, expense: 37090, net: 962910 });
    const c = byCategory(txns, DEFAULT_RATES);
    expect(c.get(1)).toBe(27090);
    expect(c.get(2)).toBe(10000);
  });
  it('balances, transfers and net worth', () => {
    expect(balance(cash, txns, DEFAULT_RATES)).toBe(50000 + 1000000 - 30000 - 7090 - 70900);
    expect(balance(usd, txns, DEFAULT_RATES)).toBe(10000);
    expect(netWorth([cash, usd], txns, DEFAULT_RATES)).toBe(50000 + 1000000 - 30000 - 7090);
  });
});
