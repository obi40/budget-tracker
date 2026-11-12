import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import type { Txn, TxnType } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { CURRENCIES, convert, format, parseAmount, toInput, type Currency } from '../lib/money';
import { todayISO } from '../lib/dates';
import { CategoryGrid, Field, Seg, Sheet } from './ui';

interface SplitRow { categoryId?: number; text: string }

export function TxnSheet({ initial, onClose }: { initial?: Partial<Txn>; onClose: () => void }) {
  const { accounts, acc, cat, txns, settings } = useData();
  const { toast } = useUI();
  const editing = initial?.id != null;
  const active = accounts.filter((a) => !a.archived || a.id === initial?.accountId);
  const firstAcc = active[0];

  const [type, setType] = useState<TxnType>(initial?.type ?? 'expense');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? firstAcc?.currency ?? settings.defaultCurrency);
  const [amountText, setAmountText] = useState(initial?.amount ? toInput(initial.amount, initial.currency ?? 'JOD') : '');
  const [accountId, setAccountId] = useState<number | undefined>(initial?.accountId ?? firstAcc?.id);
  const [toAccountId, setToAccountId] = useState<number | undefined>(initial?.toAccountId ?? active.find((a) => a.id !== firstAcc?.id)?.id);
  const [toAmountText, setToAmountText] = useState(initial?.toAmount && initial.toAccountId ? toInput(initial.toAmount, acc.get(initial.toAccountId)?.currency ?? 'JOD') : '');
  const [categoryId, setCategoryId] = useState<number | undefined>(initial?.categoryId);
  const [splitOn, setSplitOn] = useState(!!initial?.splits?.length);
  const [splits, setSplits] = useState<SplitRow[]>(
    initial?.splits?.length ? initial.splits.map((s) => ({ categoryId: s.categoryId, text: toInput(s.amount, initial.currency ?? 'JOD') })) : [{ text: '' }, { text: '' }],
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [payee, setPayee] = useState(initial?.payee ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(' '));
  const [error, setError] = useState('');

  const amount = parseAmount(amountText, currency) ?? 0;
  const toAcc = toAccountId ? acc.get(toAccountId) : undefined;
  const crossCurrency = type === 'transfer' && toAcc && toAcc.currency !== currency;
  const autoTo = toAcc ? convert(amount, currency, toAcc.currency, settings.rates) : 0;
  const splitSum = splits.reduce((s, r) => s + (parseAmount(r.text, currency) ?? 0), 0);

  const payees = useMemo(() => [...new Set(txns.map((t) => t.payee).filter(Boolean) as string[])].slice(0, 200), [txns]);

  function pickAccount(id: number) {
    setAccountId(id);
    if (!editing) setCurrency(acc.get(id)?.currency ?? currency);
  }
  function onPayee(v: string) {
    setPayee(v);
    if (!categoryId && type !== 'transfer') {
      const prev = txns.find((t) => t.payee?.toLowerCase() === v.toLowerCase() && t.type === type && t.categoryId);
      if (prev?.categoryId) setCategoryId(prev.categoryId);
    }
  }

  async function save() {
    setError('');
    if (amount <= 0) return setError('Enter an amount.');
    if (!accountId) return setError('Choose an account.');
    const tags = tagsText.split(/[\s,]+/).map((s) => s.replace(/^#/, '').trim()).filter(Boolean);
    const t: Txn = { type, date, amount, currency, accountId, payee: payee.trim() || undefined, note: note.trim() || undefined, tags };
    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) return setError('Choose a different account to transfer to.');
      t.toAccountId = toAccountId;
      t.toAmount = crossCurrency ? parseAmount(toAmountText, toAcc!.currency) ?? autoTo : convert(amount, currency, toAcc!.currency, settings.rates);
    } else if (splitOn) {
      const rows = splits.filter((r) => r.categoryId && parseAmount(r.text, currency));
      if (rows.length < 2) return setError('A split needs at least two categories with amounts.');
      if (splitSum !== amount) return setError(`Split parts add up to ${format(splitSum, currency)}, not ${format(amount, currency)}.`);
      t.splits = rows.map((r) => ({ categoryId: r.categoryId!, amount: parseAmount(r.text, currency)! }));
    } else {
      if (!categoryId) return setError('Pick a category.');
      t.categoryId = categoryId;
    }
    if (initial?.recurringId) t.recurringId = initial.recurringId;
    if (editing) await db.transactions.put({ ...t, id: initial!.id });
    else await db.transactions.add(t);
    toast(editing ? 'Saved' : type === 'expense' ? 'Expense added' : type === 'income' ? 'Income added' : 'Transfer added');
    onClose();
  }

  async function remove() {
    if (!confirm('Delete this transaction?')) return;
    await db.transactions.delete(initial!.id!);
    toast('Deleted');
    onClose();
  }

  const title = editing ? 'Edit' : 'New';
  return (
    <Sheet title={`${title} ${type}`} onClose={onClose} onDone={save} doneLabel={editing ? 'Save' : 'Add'}>
      <Seg value={type} className={type} onChange={(v) => { setType(v); setCategoryId(undefined); }}
        options={[['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']]} />

      <div className="amount-box">
        <input className={type} inputMode="decimal" placeholder="0" value={amountText} autoFocus={!editing}
          onChange={(e) => setAmountText(e.target.value)} aria-label="Amount" />
        <div className="chips" style={{ justifyContent: 'center' }}>
          {CURRENCIES.map((c) => <button key={c} type="button" className={`chip${c === currency ? ' on' : ''}`} onClick={() => setCurrency(c)}>{c}</button>)}
        </div>
      </div>

      {type !== 'transfer' && (
        <>
          <div className="section-title">
            <span>Category</span>
            <button type="button" onClick={() => setSplitOn(!splitOn)}>{splitOn ? 'Single category' : 'Split'}</button>
          </div>
          {!splitOn ? <CategoryGrid kind={type} value={categoryId} onChange={setCategoryId} /> : (
            <div className="list form">
              {splits.map((r, i) => (
                <div className="field" key={i}>
                  <select style={{ textAlign: 'left', direction: 'ltr' }} value={r.categoryId ?? ''} onChange={(e) => setSplits(splits.map((x, j) => j === i ? { ...x, categoryId: +e.target.value } : x))}>
                    <option value="">Category…</option>
                    {[...cat.values()].filter((c) => c.kind === type && !c.archived).map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select>
                  <input inputMode="decimal" placeholder="0" style={{ maxWidth: 110 }} value={r.text} onChange={(e) => setSplits(splits.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                </div>
              ))}
              <div className="field">
                <button type="button" className="btn ghost small" onClick={() => setSplits([...splits, { text: '' }])}>+ Add part</button>
                <span className={`small num ${splitSum === amount ? 'pos' : 'neg'}`} style={{ marginLeft: 'auto' }}>
                  {format(splitSum, currency)} of {format(amount, currency)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="section-title"><span>Details</span></div>
      <div className="list form">
        <Field label={type === 'transfer' ? 'From' : 'Account'}>
          <select value={accountId ?? ''} onChange={(e) => pickAccount(+e.target.value)}>
            {active.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </Field>
        {type === 'transfer' && (
          <Field label="To">
            <select value={toAccountId ?? ''} onChange={(e) => setToAccountId(+e.target.value)}>
              {active.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </Field>
        )}
        {crossCurrency && (
          <Field label={`Received (${toAcc!.currency})`}>
            <input inputMode="decimal" placeholder={toInput(autoTo, toAcc!.currency) || '0'} value={toAmountText} onChange={(e) => setToAmountText(e.target.value)} />
          </Field>
        )}
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label={type === 'income' ? 'From (payer)' : 'Payee'}>
          <input list="payees" placeholder="e.g. Carrefour" value={payee} onChange={(e) => onPayee(e.target.value)} />
          <datalist id="payees">{payees.map((p) => <option key={p} value={p} />)}</datalist>
        </Field>
        <Field label="Note"><input placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="Tags"><input placeholder="#trip #work" value={tagsText} onChange={(e) => setTagsText(e.target.value)} /></Field>
      </div>

      {error && <p className="neg small" role="alert" style={{ margin: '12px 4px 0' }}>{error}</p>}
      <div className="btn-row">
        {editing && <button className="btn danger" onClick={remove}>Delete</button>}
      </div>
    </Sheet>
  );
}
