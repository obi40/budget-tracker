import { useState } from 'react';
import { db } from '../db/schema';
import type { Debt } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Bar, Empty, Field, Money, Seg, Sheet, TopBar } from '../components/ui';
import { CURRENCIES, format, parseAmount, toBase, toInput, type Currency } from '../lib/money';
import { addMonths, dayLabel, monthLabel, thisMonth, todayISO } from '../lib/dates';
import { debtBalance, payoff } from '../lib/debt';

export function Debts() {
  const { debts, settings } = useData();
  const [edit, setEdit] = useState<Partial<Debt> | null>(null);
  const [pay, setPay] = useState<Debt | null>(null);
  const active = debts.filter((d) => !d.archived);
  const total = active.reduce((s, d) => s + toBase(debtBalance(d), d.currency, settings.rates), 0);
  const monthly = active.reduce((s, d) => s + toBase(d.minPayment, d.currency, settings.rates), 0);

  return (
    <>
      <TopBar title="Debts" back right={<button className="btn ghost" onClick={() => setEdit({})}>Add</button>} />
      {active.length === 0 ? <Empty icon="💳" text="Track loans, car finance or cards and see when you'll be debt-free."><button className="btn" onClick={() => setEdit({})}>Add a debt</button></Empty> : (
        <div className="card grid2">
          <div className="stat"><div className="label">Total owed</div><div className="value neg"><Money v={total} /></div></div>
          <div className="stat"><div className="label">Payments / month</div><div className="value"><Money v={monthly} /></div></div>
        </div>
      )}
      {debts.map((d) => {
        const bal = debtBalance(d);
        const p = payoff(bal, d.apr, d.minPayment);
        const paid = d.startBalance - bal;
        return (
          <div key={d.id} className="card" style={{ marginTop: 12, opacity: d.archived ? 0.6 : 1 }}>
            <button className="row" style={{ padding: 0, minHeight: 0 }} onClick={() => setEdit(d)}>
              <div className="grow"><div className="title">{d.name}</div><div className="sub">{d.apr}% APR · {format(d.minPayment, d.currency)}/mo</div></div>
              <div className="end"><Money v={bal} c={d.currency} className="neg" /></div>
            </button>
            <div style={{ margin: '12px 0 6px' }}><Bar spent={paid} available={d.startBalance} color="var(--ok)" /></div>
            <div className="sub" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px' }}>
              <span className="num">{format(paid, d.currency)} paid</span>
              <span>{bal <= 0 ? 'Paid off 🎉' : p.months === Infinity ? '⚠️ Payment doesn\'t cover interest' : `Debt-free ${monthLabel(addMonths(thisMonth(), p.months), true)} ${addMonths(thisMonth(), p.months).slice(0, 4)} · ${format(p.interest, d.currency)} interest`}</span>
            </div>
            {bal > 0 && !d.archived && <button className="btn secondary block small" style={{ marginTop: 12 }} onClick={() => setPay(d)}>Record payment</button>}
          </div>
        );
      })}
      {edit && <DebtSheet d={edit} onClose={() => setEdit(null)} />}
      {pay && <PaySheet d={pay} onClose={() => setPay(null)} />}
    </>
  );
}

function DebtSheet({ d, onClose }: { d: Partial<Debt>; onClose: () => void }) {
  const { settings } = useData();
  const { toast } = useUI();
  const [name, setName] = useState(d.name ?? '');
  const [currency, setCurrency] = useState<Currency>(d.currency ?? settings.defaultCurrency);
  const [bal, setBal] = useState(d.startBalance ? toInput(d.startBalance, d.currency ?? 'JOD') : '');
  const [apr, setApr] = useState(d.apr != null ? String(d.apr) : '');
  const [min, setMin] = useState(d.minPayment ? toInput(d.minPayment, d.currency ?? 'JOD') : '');
  const [archived, setArchived] = useState(!!d.archived);

  async function save() {
    const b = parseAmount(bal, currency), m = parseAmount(min, currency) ?? 0, a = Number(apr || 0);
    if (!name.trim() || !b) return alert('Enter a name and the amount owed.');
    if (Number.isNaN(a) || a < 0) return alert('Interest rate should be a number like 8.5');
    const rec: Debt = { name: name.trim(), currency, startBalance: b, apr: a, minPayment: m, payments: d.payments ?? [], archived };
    if (d.id != null) await db.debts.put({ ...rec, id: d.id }); else await db.debts.add(rec);
    toast('Debt saved'); onClose();
  }
  return (
    <Sheet title={d.id != null ? 'Edit debt' : 'New debt'} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <div className="list form">
        <Field label="Name"><input value={name} placeholder="Car loan" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Currency"><Seg value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => [c, c] as [Currency, string])} /></Field>
        <Field label="Amount owed"><input inputMode="decimal" placeholder="0" value={bal} onChange={(e) => setBal(e.target.value)} /></Field>
        <Field label="Interest % / yr"><input inputMode="decimal" placeholder="0" value={apr} onChange={(e) => setApr(e.target.value)} /></Field>
        <Field label="Monthly payment"><input inputMode="decimal" placeholder="0" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
        {d.id != null && <Field label="Archived"><input type="checkbox" className="toggle" checked={archived} onChange={(e) => setArchived(e.target.checked)} /></Field>}
      </div>
      {d.payments && d.payments.length > 0 && (
        <>
          <div className="section-title"><span>Payments</span></div>
          <div className="list plain">{[...d.payments].reverse().map((p, i) => <div key={i} className="row"><div className="grow sub">{dayLabel(p.date)}</div><Money v={p.amount} c={d.currency} /></div>)}</div>
        </>
      )}
      <div className="btn-row">
        {d.id != null && <button className="btn danger" onClick={async () => { if (confirm('Delete this debt? Recorded transactions stay.')) { await db.debts.delete(d.id!); onClose(); } }}>Delete</button>}
        <button className="btn" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

function PaySheet({ d, onClose }: { d: Debt; onClose: () => void }) {
  const { accounts, categories } = useData();
  const { toast } = useUI();
  const active = accounts.filter((a) => !a.archived);
  const [text, setText] = useState(toInput(Math.min(d.minPayment, debtBalance(d)), d.currency));
  const [accountId, setAccountId] = useState(active[0]?.id);
  const [record, setRecord] = useState(true);
  const debtCat = categories.find((c) => c.kind === 'expense' && c.name === 'Debt payments');

  async function save() {
    const v = parseAmount(text, d.currency);
    if (!v) return alert('Enter an amount.');
    const date = todayISO();
    let txnId: number | undefined;
    if (record && accountId)
      txnId = await db.transactions.add({ type: 'expense', date, amount: v, currency: d.currency, accountId, categoryId: debtCat?.id, payee: d.name, tags: ['debt'] });
    await db.debts.update(d.id!, { payments: [...d.payments, { date, amount: v, txnId }] });
    toast('Payment recorded'); onClose();
  }
  return (
    <Sheet title={`Pay ${d.name}`} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <div className="amount-box"><input className="expense" inputMode="decimal" value={text} autoFocus onChange={(e) => setText(e.target.value)} /><div className="muted small">{d.currency}</div></div>
      <div className="list form">
        <Field label="Add as expense"><input type="checkbox" className="toggle" checked={record} onChange={(e) => setRecord(e.target.checked)} /></Field>
        {record && <Field label="Paid from"><select value={accountId} onChange={(e) => setAccountId(+e.target.value)}>{active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
      </div>
      <button className="btn block" style={{ marginTop: 16 }} onClick={save}>Record payment</button>
    </Sheet>
  );
}
