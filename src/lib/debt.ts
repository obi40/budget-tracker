import type { Debt } from '../db/types';

export const debtBalance = (d: Debt) => d.startBalance - d.payments.reduce((s, p) => s + p.amount, 0);

/**
 * Months to pay off `balance` with a fixed monthly `payment` at `apr` percent.
 * Returns Infinity when the payment doesn't cover the interest.
 */
export function payoff(balance: number, apr: number, payment: number): { months: number; interest: number } {
  if (balance <= 0) return { months: 0, interest: 0 };
  if (payment <= 0) return { months: Infinity, interest: Infinity };
  const r = apr / 1200;
  if (r === 0) return { months: Math.ceil(balance / payment), interest: 0 };
  if (payment <= balance * r) return { months: Infinity, interest: Infinity };
  // simulate month by month (exact last payment, interest rounded per month)
  let b = balance, months = 0, interest = 0;
  while (b > 0 && months < 1200) {
    const i = Math.round(b * r);
    interest += i;
    b = b + i - payment;
    months++;
  }
  return { months, interest };
}
