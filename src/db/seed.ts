import { db, type BudgetDB } from './schema';
import type { Category } from './types';

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Housing', kind: 'expense', emoji: '🏠', color: '#6366f1' },
  { name: 'Groceries', kind: 'expense', emoji: '🛒', color: '#22c55e' },
  { name: 'Dining out', kind: 'expense', emoji: '🍽️', color: '#f97316' },
  { name: 'Transport', kind: 'expense', emoji: '🚗', color: '#0ea5e9' },
  { name: 'Bills & Utilities', kind: 'expense', emoji: '💡', color: '#eab308' },
  { name: 'Phone & Internet', kind: 'expense', emoji: '📱', color: '#14b8a6' },
  { name: 'Health', kind: 'expense', emoji: '💊', color: '#ef4444' },
  { name: 'Shopping', kind: 'expense', emoji: '🛍️', color: '#ec4899' },
  { name: 'Entertainment', kind: 'expense', emoji: '🎬', color: '#a855f7' },
  { name: 'Subscriptions', kind: 'expense', emoji: '🔁', color: '#8b5cf6' },
  { name: 'Education', kind: 'expense', emoji: '📚', color: '#3b82f6' },
  { name: 'Personal care', kind: 'expense', emoji: '💇', color: '#f43f5e' },
  { name: 'Travel', kind: 'expense', emoji: '✈️', color: '#06b6d4' },
  { name: 'Gifts & Charity', kind: 'expense', emoji: '🎁', color: '#d946ef' },
  { name: 'Debt payments', kind: 'expense', emoji: '💳', color: '#64748b' },
  { name: 'Savings', kind: 'expense', emoji: '🐷', color: '#10b981', rollover: true },
  { name: 'Other', kind: 'expense', emoji: '📦', color: '#94a3b8' },
  { name: 'Salary', kind: 'income', emoji: '💼', color: '#16a34a' },
  { name: 'Freelance', kind: 'income', emoji: '💻', color: '#0d9488' },
  { name: 'Gifts received', kind: 'income', emoji: '🎉', color: '#c026d3' },
  { name: 'Interest & Investments', kind: 'income', emoji: '📈', color: '#2563eb' },
  { name: 'Other income', kind: 'income', emoji: '➕', color: '#65a30d' },
];

/** First launch: default categories and two starter accounts. */
export async function seedIfEmpty(d: BudgetDB = db) {
  await d.transaction('rw', d.categories, d.accounts, d.settings, async () => {
    if (await d.settings.get('seeded')) return;
    if ((await d.categories.count()) === 0) await d.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
    if ((await d.accounts.count()) === 0)
      await d.accounts.bulkAdd([
        { name: 'Cash', type: 'cash', currency: 'JOD', opening: 0 },
        { name: 'Bank account', type: 'bank', currency: 'JOD', opening: 0 },
      ]);
    await d.settings.put({ key: 'seeded', value: true });
  });
}
