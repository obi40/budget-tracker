import { useState } from 'react';
import { db } from '../db/schema';
import type { Freq, Recurring, TxnType } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { processRecurring } from '../db/actions';
import { Badge, CategoryGrid, Field, Money, Seg, Sheet, TopBar } from '../components/ui';
import { CURRENCIES, format, parseAmount, toInput, type Currency } from '../lib/money';
import { dayLabel, todayISO } from '../lib/dates';
import { monthlyCost } from '../lib/recurring';

const FREQ_LABEL: Record<Freq, string> = { weekly: 'week', monthly: 'month', yearly: 'year' };
export const every = (r: Recurring) => `Every ${r.interval > 1 ? `${r.interval} ${FREQ_LABEL[r.freq]}s` : FREQ_LABEL[r.freq]}`;

export function RecurringScreen() {
  const { recurring, settings, cat } = useData();
  const [edit, setEdit] = useState<Partial<Recurring> | null>(null);
  const active = recurring.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const paused = recurring.filter((r) => !r.active);
  const subs = active.filter((r) => r.isSubscription && r.type === 'expense');
  const subMonthly = subs.reduce((s, r) => s + monthlyCost(r, settings.rates), 0);
  const billsMonthly = active.filter((r) => r.type === 'expense').reduce((s, r) => s + monthlyCost(r, settings.rates), 0);
  const incomeMonthly = active.filter((r) => r.type === 'income').reduce((s, r) => s + monthlyCost(r, settings.rates), 0);

  const row = (r: Recurring) => (
    <button key={r.id} className="row" onClick={() => setEdit(r)} style={{ opacity: r.active ? 1 : 0.5 }}>
      <Badge c={r.categoryId ? cat.get(r.categoryId) : undefined} emoji={r.type === 'transfer' ? '🔄' : undefined} />
      <div className="grow">
        <div className="title">{r.name}{r.isSubscription ? ' · sub' : ''}</div>
        <div className="sub">{every(r)} · next {dayLabel(r.nextDate)}{r.autoPost ? ' · auto' : ''}</div>
      </div>
      <div className="end"><Money v={r.type === 'income' ? r.amount : -r.amount} c={r.currency} sign={r.type === 'income'} className={r.type === 'income' ? 'pos' : ''} /></div>
    </button>
  );

  return (
    <>
      <TopBar title="Recurring" back right={<button className="btn ghost" onClick={() => setEdit({})}>Add</button>} />
      <p className="subtitle">Bills, salary and subscriptions that repeat.</p>
      <div className="card grid2">
        <div className="stat"><div className="label">Bills / month</div><div className="value"><Money v={billsMonthly} /></div></div>
        <div className="stat"><div className="label">Income / month</div><div className="value pos"><Money v={incomeMonthly} /></div></div>
        <div className="stat"><div className="label">Subscriptions / month</div><div className="value"><Money v={subMonthly} /></div></div>
        <div className="stat"><div className="label">Subscriptions / year</div><div className="value"><Money v={subMonthly * 12} /></div></div>
      </div>
      {subs.length > 0 && (
        <>
          <div className="section-title"><span>Subscriptions</span></div>
          <div className="list plain">
            {subs.map((r) => (
              <div key={r.id} className="row" style={{ minHeight: 44 }}>
                <div className="grow title">{r.name}</div>
                <div className="end small muted num">{format(monthlyCost(r, settings.rates))}/mo</div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="section-title"><span>Active</span></div>
      {active.length ? <div className="list">{active.map(row)}</div> : <p className="muted small" style={{ margin: '0 4px' }}>Nothing yet. Add your rent, salary or Netflix.</p>}
      {paused.length > 0 && <><div className="section-title"><span>Paused</span></div><div className="list">{paused.map(row)}</div></>}
      {edit && <RecurringSheet r={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function RecurringSheet({ r, onClose }: { r: Partial<Recurring>; onClose: () => void }) {
  const { accounts, acc, settings } = useData();
  const { toast } = useUI();
  const active = accounts.filter((a) => !a.archived);
  const [name, setName] = useState(r.name ?? '');
  const [type, setType] = useState<TxnType>(r.type ?? 'expense');
  const [currency, setCurrency] = useState<Currency>(r.currency ?? settings.defaultCurrency);
  const [amountText, setAmountText] = useState(r.amount ? toInput(r.amount, r.currency ?? 'JOD') : '');
  const [accountId, setAccountId] = useState(r.accountId ?? active[0]?.id);
  const [toAccountId, setToAccountId] = useState(r.toAccountId ?? active[1]?.id);
  const [categoryId, setCategoryId] = useState(r.categoryId);
  const [freq, setFreq] = useState<Freq>(r.freq ?? 'monthly');
  const [interval, setInterval] = useState(r.interval ?? 1);
  const [nextDate, setNextDate] = useState(r.nextDate ?? todayISO());
  const [autoPost, setAutoPost] = useState(r.autoPost ?? false);
  const [isSub, setIsSub] = useState(r.isSubscription ?? false);
  const [isActive, setIsActive] = useState(r.active ?? true);

  async function save() {
    const amount = parseAmount(amountText, currency);
    if (!name.trim()) return alert('Give it a name, e.g. Rent.');
    if (!amount) return alert('Enter an amount.');
    if (!accountId) return alert('Choose an account.');
    if (type !== 'transfer' && !categoryId) return alert('Pick a category.');
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return alert('Choose a different account to transfer to.');
    const anchorDay = r.nextDate === nextDate && r.anchorDay ? r.anchorDay : +nextDate.slice(8, 10);
    const rec: Recurring = {
      name: name.trim(), type, amount, currency, accountId, toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId, freq, interval: Math.max(1, interval), nextDate, anchorDay,
      autoPost, isSubscription: isSub, active: isActive,
    };
    if (r.id != null) await db.recurring.put({ ...rec, id: r.id }); else await db.recurring.add(rec);
    await processRecurring();
    toast('Saved'); onClose();
  }
  async function remove() {
    if (!confirm(`Delete "${r.name}"? Transactions already posted stay.`)) return;
    await db.recurring.delete(r.id!); onClose();
  }

  return (
    <Sheet title={r.id != null ? 'Edit recurring' : 'New recurring'} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <Seg value={type} className={type} onChange={(v) => { setType(v); setCategoryId(undefined); }} options={[['expense', 'Bill / expense'], ['income', 'Income'], ['transfer', 'Transfer']]} />
      <div className="list form" style={{ marginTop: 12 }}>
        <Field label="Name"><input value={name} placeholder="e.g. Rent, Netflix, Salary" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Amount"><input inputMode="decimal" placeholder="0" value={amountText} onChange={(e) => setAmountText(e.target.value)} /></Field>
        <Field label="Currency"><Seg value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => [c, c] as [Currency, string])} /></Field>
        <Field label={type === 'transfer' ? 'From' : 'Account'}>
          <select value={accountId} onChange={(e) => setAccountId(+e.target.value)}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
        {type === 'transfer' && (
          <Field label="To"><select value={toAccountId} onChange={(e) => setToAccountId(+e.target.value)}>{active.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        )}
        <Field label="Repeats">
          <select value={freq} onChange={(e) => setFreq(e.target.value as Freq)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
        </Field>
        <Field label="Every">
          <select value={interval} onChange={(e) => setInterval(+e.target.value)}>{[1, 2, 3, 4, 6].map((n) => <option key={n} value={n}>{n} {FREQ_LABEL[freq]}{n > 1 ? 's' : ''}</option>)}</select>
        </Field>
        <Field label="Next date"><input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
        <Field label="Post automatically"><input type="checkbox" className="toggle" checked={autoPost} onChange={(e) => setAutoPost(e.target.checked)} /></Field>
        {type === 'expense' && <Field label="Subscription"><input type="checkbox" className="toggle" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} /></Field>}
        {r.id != null && <Field label="Active"><input type="checkbox" className="toggle" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /></Field>}
      </div>
      <p className="small muted" style={{ margin: '8px 4px 0' }}>
        {autoPost ? 'Added to your transactions automatically on each date.' : 'Shows on Home when due so you can confirm the real amount.'}
        {accountId && acc.get(accountId)?.currency !== currency ? ` Converted to ${acc.get(accountId)?.currency} in the account balance.` : ''}
      </p>
      {type !== 'transfer' && <><div className="section-title"><span>Category</span></div><CategoryGrid kind={type} value={categoryId} onChange={setCategoryId} /></>}
      <div className="btn-row">
        {r.id != null && <button className="btn danger" onClick={remove}>Delete</button>}
        <button className="btn" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
