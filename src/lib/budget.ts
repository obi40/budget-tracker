import { addMonths } from './dates';

export interface CategoryMonth {
  budgeted: number; // set for this month
  carried: number; // rolled in from previous months (can be negative)
  spent: number;
  available: number; // budgeted + carried
  left: number; // available − spent
}

/**
 * Budget state for one category in one month. With rollover on, whatever is
 * left (or overspent) each month carries forward, starting from the first
 * month the category ever had a budget.
 */
export function categoryMonth(
  budgets: Map<string, number>,
  spent: Map<string, number>,
  rollover: boolean,
  month: string,
): CategoryMonth {
  let carried = 0;
  if (rollover && budgets.size) {
    const start = [...budgets.keys()].sort()[0];
    for (let m = start; m < month; m = addMonths(m, 1)) {
      carried = carried + (budgets.get(m) ?? 0) - (spent.get(m) ?? 0);
    }
  }
  const budgeted = budgets.get(month) ?? 0;
  const s = spent.get(month) ?? 0;
  const available = budgeted + carried;
  return { budgeted, carried, spent: s, available, left: available - s };
}

/** 'ok' under 80%, 'warn' 80–100%, 'over' past the limit. */
export function budgetStatus(spent: number, available: number): 'ok' | 'warn' | 'over' | 'none' {
  if (available <= 0) return spent > 0 ? 'over' : 'none';
  const r = spent / available;
  return r > 1 ? 'over' : r >= 0.8 ? 'warn' : 'ok';
}
