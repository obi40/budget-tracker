import type { Currency, Rates } from '../lib/money';

export type AccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'loan';
export interface Account {
  id?: number;
  name: string;
  type: AccountType;
  currency: Currency;
  opening: number; // minor units, account currency (negative for debt)
  archived?: boolean;
}

export type CategoryKind = 'expense' | 'income';
export interface Category {
  id?: number;
  name: string;
  kind: CategoryKind;
  emoji: string;
  color: string;
  rollover?: boolean;
  archived?: boolean;
}

export type TxnType = 'expense' | 'income' | 'transfer';
export interface Split { categoryId: number; amount: number } // amount in txn currency

export interface Txn {
  id?: number;
  type: TxnType;
  date: string; // YYYY-MM-DD
  amount: number; // minor units in `currency`, always positive
  currency: Currency;
  accountId: number;
  toAccountId?: number; // transfers
  toAmount?: number; // transfers: minor units in the destination account's currency
  categoryId?: number;
  splits?: Split[];
  payee?: string;
  note?: string;
  tags?: string[];
  recurringId?: number;
}

export type Freq = 'weekly' | 'monthly' | 'yearly';
export interface Recurring {
  id?: number;
  name: string;
  type: TxnType;
  amount: number;
  currency: Currency;
  accountId: number;
  toAccountId?: number;
  categoryId?: number;
  freq: Freq;
  interval: number;
  nextDate: string;
  anchorDay: number; // day of month the series started on (keeps the 31st sticky)
  autoPost: boolean;
  isSubscription: boolean;
  active: boolean;
}

export interface Budget {
  id?: number;
  month: string; // YYYY-MM
  categoryId: number;
  amount: number; // JOD minor units
}

export interface Contribution { date: string; amount: number }
export interface Goal {
  id?: number;
  name: string;
  emoji: string;
  target: number; // JOD minor
  targetDate?: string;
  contributions: Contribution[];
  archived?: boolean;
}

export interface DebtPayment { date: string; amount: number; txnId?: number }
export interface Debt {
  id?: number;
  name: string;
  currency: Currency;
  startBalance: number; // minor, positive = owed
  apr: number; // percent per year
  minPayment: number; // minor
  payments: DebtPayment[];
  archived?: boolean;
}

export interface Settings {
  rates: Rates;
  defaultCurrency: Currency;
  pinHash?: string;
  lastBackup?: string; // ISO datetime
  theme: 'system' | 'light' | 'dark';
}

export interface SettingRow { key: string; value: unknown }
