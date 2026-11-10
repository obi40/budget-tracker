import Dexie, { type Table } from 'dexie';
import type { Account, Budget, Category, Debt, Goal, Recurring, SettingRow, Settings, Txn } from './types';
import { DEFAULT_RATES } from '../lib/money';

export class BudgetDB extends Dexie {
  accounts!: Table<Account, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Txn, number>;
  budgets!: Table<Budget, number>;
  recurring!: Table<Recurring, number>;
  goals!: Table<Goal, number>;
  debts!: Table<Debt, number>;
  settings!: Table<SettingRow, string>;

  constructor(name = 'budget-tracker') {
    super(name);
    this.version(1).stores({
      accounts: '++id, type',
      categories: '++id, kind',
      transactions: '++id, date, type, accountId, toAccountId, categoryId, recurringId',
      budgets: '++id, &[month+categoryId], month, categoryId',
      recurring: '++id, nextDate',
      goals: '++id',
      debts: '++id',
      settings: 'key',
    });
  }
}

export const db = new BudgetDB();

export const TABLES = ['accounts', 'categories', 'transactions', 'budgets', 'recurring', 'goals', 'debts', 'settings'] as const;

export const DEFAULT_SETTINGS: Settings = {
  rates: DEFAULT_RATES,
  defaultCurrency: 'JOD',
  theme: 'system',
};

export async function readSettings(d: BudgetDB = db): Promise<Settings> {
  const rows = await d.settings.toArray();
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) s[r.key] = r.value;
  return s as unknown as Settings;
}

export function saveSetting<K extends keyof Settings>(key: K, value: Settings[K], d: BudgetDB = db) {
  return d.settings.put({ key, value });
}
