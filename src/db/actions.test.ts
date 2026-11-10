import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BudgetDB } from './schema';
import { seedIfEmpty } from './seed';
import { copyBudgets, exportJSON, importJSON, processRecurring, setBudget } from './actions';

describe('db actions', () => {
  it('seeds once', async () => {
    const d = new BudgetDB('t-seed');
    await seedIfEmpty(d); await seedIfEmpty(d);
    expect(await d.accounts.count()).toBe(2);
    expect(await d.categories.where('kind').equals('income').count()).toBe(5);
  });

  it('auto-posts due recurring items and advances the date', async () => {
    const d = new BudgetDB('t-rec');
    await d.recurring.add({ name: 'Rent', type: 'expense', amount: 300000, currency: 'JOD', accountId: 1, categoryId: 1,
      freq: 'monthly', interval: 1, nextDate: '2026-09-01', anchorDay: 1, autoPost: true, isSubscription: false, active: true });
    await d.recurring.add({ name: 'Gym', type: 'expense', amount: 25000, currency: 'JOD', accountId: 1, categoryId: 1,
      freq: 'monthly', interval: 1, nextDate: '2026-09-01', anchorDay: 1, autoPost: false, isSubscription: true, active: true });
    await processRecurring(d, '2026-11-10');
    expect(await d.transactions.count()).toBe(3);
    expect((await d.recurring.get(1))!.nextDate).toBe('2026-12-01');
    expect((await d.recurring.get(2))!.nextDate).toBe('2026-09-01'); // manual: untouched
    await processRecurring(d, '2026-11-10');
    expect(await d.transactions.count()).toBe(3); // idempotent
  });

  it('sets, clears and copies budgets', async () => {
    const d = new BudgetDB('t-bud');
    await setBudget('2026-10', 1, 100000, d);
    await setBudget('2026-10', 1, 120000, d);
    await setBudget('2026-10', 2, 50000, d);
    expect(await d.budgets.count()).toBe(2);
    expect(await copyBudgets('2026-10', '2026-11', d)).toBe(2);
    expect((await d.budgets.where('[month+categoryId]').equals(['2026-11', 1]).first())!.amount).toBe(120000);
    await setBudget('2026-11', 2, 0, d);
    expect(await d.budgets.where('month').equals('2026-11').count()).toBe(1);
  });

  it('backs up and restores everything', async () => {
    const a = new BudgetDB('t-bak-a');
    await seedIfEmpty(a);
    await a.transactions.add({ type: 'expense', date: '2026-11-01', amount: 1500, currency: 'JOD', accountId: 1, categoryId: 2, payee: 'Bakery' });
    const json = await exportJSON(a);
    const b = new BudgetDB('t-bak-b');
    await importJSON(json, b);
    expect(await b.transactions.toArray()).toEqual(await a.transactions.toArray());
    expect(await b.categories.count()).toBe(await a.categories.count());
    await expect(importJSON('{"x":1}', b)).rejects.toThrow();
  });
});
