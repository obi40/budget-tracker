import { useState } from 'react';
import { db } from '../db/schema';
import type { Account, AccountType } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { BigMoney, Field, Money, Seg, Sheet, TopBar } from '../components/ui';
import { balance, netWorth } from '../lib/stats';
import { CURRENCIES, parseAmount, toBase, toInput, type Currency } from '../lib/money';

export const ACCOUNT_TYPES: [AccountType, string, string][] = [
  ['cash', 'Cash', '💵'], ['bank', 'Bank', '🏦'], ['credit', 'Credit card', '💳'], ['savings', 'Savings', '🐷'], ['loan', 'Loan', '📉'],
];
const icon = (t: AccountType) => ACCOUNT_TYPES.find((x) => x[0] === t)?.[2] ?? '🏦';

export function Accounts() {
  const { accounts, txns, settings } = useData();
  const [edit, setEdit] = useState<Partial<Account> | null>(null);
  const visible = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const nw = netWorth(accounts, txns, settings.rates);
  const assets = accounts.reduce((s, a) => { const b = toBase(balance(a, txns, settings.rates), a.currency, settings.rates); return b > 0 ? s + b : s; }, 0);

  const row = (a: Account) => {
    const b = balance(a, txns, settings.rates);
    return (
      <button key={a.id} className="row" onClick={() => setEdit(a)}>
        <div className="badge" style={{ background: 'var(--accent-soft)' }}>{icon(a.type)}</div>
        <div className="grow"><div className="title">{a.name}</div><div className="sub">{ACCOUNT_TYPES.find((x) => x[0] === a.type)?.[1]} · {a.currency}</div></div>
        <div className="end">
          <Money v={b} c={a.currency} className={b < 0 ? 'neg' : ''} />
          {a.currency !== 'JOD' && <div className="sub"><Money v={toBase(b, a.currency, settings.rates)} /></div>}
        </div>
      </button>
    );
  };

  return (
    <>
      <TopBar title="Accounts" back right={<button className="btn ghost" onClick={() => setEdit({})}>Add</button>} />
      <div className="card hero">
        <div className="label">Net worth</div>
        <BigMoney v={nw} className={nw < 0 ? 'neg' : ''} />
        <div className="grid2">
          <div className="stat"><div className="label">Assets</div><div className="value"><Money v={assets} /></div></div>
          <div className="stat"><div className="label">Debts</div><div className="value neg"><Money v={assets - nw} /></div></div>
        </div>
      </div>
      <div className="section-title"><span>Accounts</span></div>
      <div className="list">{visible.map(row)}</div>
      {archived.length > 0 && <><div className="section-title"><span>Archived</span></div><div className="list">{archived.map(row)}</div></>}
      <p className="small muted" style={{ margin: '12px 4px' }}>Balances are worked out from the opening balance plus every transaction. Credit cards and loans normally run negative.</p>
      {edit && <AccountSheet a={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function AccountSheet({ a, onClose }: { a: Partial<Account>; onClose: () => void }) {
  const { txns, settings } = useData();
  const { toast } = useUI();
  const [name, setName] = useState(a.name ?? '');
  const [type, setType] = useState<AccountType>(a.type ?? 'bank');
  const [currency, setCurrency] = useState<Currency>(a.currency ?? settings.defaultCurrency);
  const [opening, setOpening] = useState(a.opening ? toInput(Math.abs(a.opening), a.currency ?? 'JOD') : '');
  const [owe, setOwe] = useState((a.opening ?? 0) < 0);
  const [archived, setArchived] = useState(!!a.archived);
  const used = a.id != null && txns.some((t) => t.accountId === a.id || t.toAccountId === a.id);

  async function save() {
    if (!name.trim()) return alert('Give the account a name.');
    const o = parseAmount(opening, currency) ?? 0;
    const rec: Account = { name: name.trim(), type, currency, opening: owe ? -o : o, archived };
    if (a.id != null) await db.accounts.put({ ...rec, id: a.id }); else await db.accounts.add(rec);
    toast('Account saved'); onClose();
  }
  async function remove() {
    if (used) return alert('This account has transactions. Archive it instead, so your history stays correct.');
    if (!confirm(`Delete ${a.name}?`)) return;
    await db.accounts.delete(a.id!); onClose();
  }

  return (
    <Sheet title={a.id != null ? 'Edit account' : 'New account'} onClose={onClose} onDone={save}>
      <div className="list form">
        <Field label="Name"><input value={name} placeholder="e.g. Arab Bank" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Type">
          <select value={type} onChange={(e) => { const t = e.target.value as AccountType; setType(t); setOwe(t === 'credit' || t === 'loan'); }}>
            {ACCOUNT_TYPES.map(([v, l, i]) => <option key={v} value={v}>{i} {l}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <Seg value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => [c, c] as [Currency, string])} />
        </Field>
        <Field label={owe ? 'Amount owed' : 'Opening balance'}><input inputMode="decimal" placeholder="0" value={opening} onChange={(e) => setOpening(e.target.value)} /></Field>
        <Field label="This is debt"><input type="checkbox" className="toggle" checked={owe} onChange={(e) => setOwe(e.target.checked)} /></Field>
        {a.id != null && <Field label="Archived"><input type="checkbox" className="toggle" checked={archived} onChange={(e) => setArchived(e.target.checked)} /></Field>}
      </div>
      <div className="btn-row">
        {a.id != null && <button className="btn danger" onClick={remove}>Delete</button>}
      </div>
    </Sheet>
  );
}
