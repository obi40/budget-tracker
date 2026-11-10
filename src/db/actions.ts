import { db, readSettings, saveSetting, TABLES, type BudgetDB } from './schema';
import type { Recurring, Txn } from './types';
import { nextOccurrence, occurrencesUntil, txnFromRecurring } from '../lib/recurring';
import { addMonths, todayISO } from '../lib/dates';
import { toCSV } from '../lib/csv';
import { fromMinor, DECIMALS } from '../lib/money';

/** Post every due occurrence of auto-post series. Manual ones wait on Home. */
export async function processRecurring(d: BudgetDB = db, today = todayISO()) {
  await d.transaction('rw', d.recurring, d.transactions, async () => {
    const all = await d.recurring.toArray();
    for (const r of all) {
      if (!r.active || !r.autoPost || r.nextDate > today) continue;
      const dates = occurrencesUntil(r, today);
      await d.transactions.bulkAdd(dates.map((dt) => txnFromRecurring(r, dt)));
      const last = dates[dates.length - 1];
      await d.recurring.update(r.id!, { nextDate: nextOccurrence(last, r.freq, r.interval, r.anchorDay) });
    }
  });
}

/** Manually confirm the next occurrence of a series. */
export async function postNext(r: Recurring, d: BudgetDB = db) {
  await d.transaction('rw', d.recurring, d.transactions, async () => {
    await d.transactions.add(txnFromRecurring(r, r.nextDate));
    await d.recurring.update(r.id!, { nextDate: nextOccurrence(r.nextDate, r.freq, r.interval, r.anchorDay) });
  });
}
export function skipNext(r: Recurring, d: BudgetDB = db) {
  return d.recurring.update(r.id!, { nextDate: nextOccurrence(r.nextDate, r.freq, r.interval, r.anchorDay) });
}

export async function copyBudgets(fromMonth: string, toMonth: string, d: BudgetDB = db) {
  const src = await d.budgets.where('month').equals(fromMonth).toArray();
  await d.transaction('rw', d.budgets, async () => {
    for (const b of src) await setBudget(toMonth, b.categoryId, b.amount, d);
  });
  return src.length;
}
export async function setBudget(month: string, categoryId: number, amount: number, d: BudgetDB = db) {
  const ex = await d.budgets.where('[month+categoryId]').equals([month, categoryId]).first();
  if (ex) {
    if (amount > 0) await d.budgets.update(ex.id!, { amount });
    else await d.budgets.delete(ex.id!);
  } else if (amount > 0) await d.budgets.add({ month, categoryId, amount });
}
export const prevMonth = (m: string) => addMonths(m, -1);

// ---------- backup ----------

export async function exportJSON(d: BudgetDB = db): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await d.table(t).toArray();
  return JSON.stringify({ app: 'budget-tracker', version: 1, exportedAt: new Date().toISOString(), tables });
}

export async function importJSON(text: string, d: BudgetDB = db) {
  const data = JSON.parse(text);
  if (data?.app !== 'budget-tracker' || !data.tables) throw new Error('This is not a Budget backup file.');
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) {
      await d.table(t).clear();
      const rows = data.tables[t];
      if (Array.isArray(rows) && rows.length) await d.table(t).bulkAdd(rows);
    }
  });
}

export async function eraseAll(d: BudgetDB = db) {
  await d.transaction('rw', TABLES.map((t) => d.table(t)), async () => {
    for (const t of TABLES) await d.table(t).clear();
  });
}

export async function exportTransactionsCSV(d: BudgetDB = db): Promise<string> {
  const [txns, accounts, cats] = await Promise.all([d.transactions.orderBy('date').toArray(), d.accounts.toArray(), d.categories.toArray()]);
  const acc = new Map(accounts.map((a) => [a.id, a.name]));
  const cat = new Map(cats.map((c) => [c.id, c.name]));
  const rows: unknown[][] = [['Date', 'Type', 'Amount', 'Currency', 'Account', 'To account', 'Category', 'Payee', 'Note', 'Tags']];
  const n = (m: number, t: Txn) => fromMinor(m, t.currency).toFixed(DECIMALS[t.currency]);
  for (const t of txns) {
    const base = [t.date, t.type];
    const tail = [t.currency, acc.get(t.accountId) ?? '', t.toAccountId ? acc.get(t.toAccountId) ?? '' : ''];
    const rest = [t.payee ?? '', t.note ?? '', (t.tags ?? []).join(' ')];
    if (t.splits?.length) for (const s of t.splits) rows.push([...base, n(s.amount, t), ...tail, cat.get(s.categoryId) ?? '', ...rest]);
    else rows.push([...base, n(t.amount, t), ...tail, t.categoryId ? cat.get(t.categoryId) ?? '' : '', ...rest]);
  }
  return toCSV(rows);
}

export async function markBackedUp() {
  await saveSetting('lastBackup', new Date().toISOString());
}

/** Share sheet on iPhone (Save to Files), plain download elsewhere. */
export async function shareOrDownload(filename: string, text: string, mime: string) {
  const file = new File([text], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return true; }
    catch (e) { if ((e as Error).name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export { readSettings };
