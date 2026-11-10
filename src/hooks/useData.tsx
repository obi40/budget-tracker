import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, readSettings } from '../db/schema';
import type { Account, Budget, Category, Debt, Goal, Recurring, Settings, Txn } from '../db/types';

export interface Data {
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  txns: Txn[];
  budgets: Budget[];
  recurring: Recurring[];
  goals: Goal[];
  debts: Debt[];
  acc: Map<number, Account>;
  cat: Map<number, Category>;
}

const Ctx = createContext<Data | null>(null);

/** Loads everything into memory once and keeps it live. Fine for a personal budget (tens of thousands of rows). */
export function DataProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const settings = useLiveQuery(() => readSettings());
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const txns = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray());
  const budgets = useLiveQuery(() => db.budgets.toArray());
  const recurring = useLiveQuery(() => db.recurring.toArray());
  const goals = useLiveQuery(() => db.goals.toArray());
  const debts = useLiveQuery(() => db.debts.toArray());
  if (!settings || !accounts || !categories || !txns || !budgets || !recurring || !goals || !debts) return <>{fallback}</>;
  const value: Data = {
    settings, accounts, categories, txns, budgets, recurring, goals, debts,
    acc: new Map(accounts.map((a) => [a.id!, a])),
    cat: new Map(categories.map((c) => [c.id!, c])),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData outside DataProvider');
  return d;
}
