import { createContext, useContext } from 'react';
import type { Txn } from '../db/types';

export type Tab = 'home' | 'txns' | 'budget' | 'reports' | 'more';
export type Page =
  | 'accounts' | 'categories' | 'recurring' | 'goals' | 'debts' | 'import' | 'backup' | 'settings';

export interface UI {
  tab: Tab;
  page: Page | null;
  go: (tab: Tab, page?: Page | null) => void;
  openTxn: (txn?: Partial<Txn>) => void;
  toast: (msg: string) => void;
}

export const UICtx = createContext<UI | null>(null);
export function useUI(): UI {
  const u = useContext(UICtx);
  if (!u) throw new Error('useUI outside provider');
  return u;
}
