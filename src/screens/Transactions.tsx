import { useMemo, useState } from 'react';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Empty, Field, Icon, Money, TopBar, TxnRow } from '../components/ui';
import { dayLabel } from '../lib/dates';
import { parseAmount, toBase } from '../lib/money';
import { totals, txnParts } from '../lib/stats';
import type { Txn } from '../db/types';

type Kind = 'all' | 'expense' | 'income' | 'transfer';

export function Transactions() {
  const { txns, accounts, categories, cat, acc, settings } = useData();
  const { openTxn } = useUI();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [accountId, setAccountId] = useState(0);
  const [categoryId, setCategoryId] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [limit, setLimit] = useState(150);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const lo = parseAmount(min, 'JOD'), hi = parseAmount(max, 'JOD');
    return txns.filter((t) => {
      if (kind !== 'all' && t.type !== kind) return false;
      if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
      if (categoryId && !txnParts(t).some((p) => p.categoryId === categoryId)) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (lo != null || hi != null) {
        const v = toBase(t.amount, t.currency, settings.rates);
        if (lo != null && v < lo) return false;
        if (hi != null && v > hi) return false;
      }
      if (needle) {
        const hay = [t.payee, t.note, ...(t.tags ?? []).map((x) => '#' + x), ...txnParts(t).map((p) => p.categoryId && cat.get(p.categoryId)?.name),
          acc.get(t.accountId)?.name, String(t.amount / 1000)].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txns, q, kind, accountId, categoryId, from, to, min, max, settings.rates, cat, acc]);

  const groups = useMemo(() => {
    const g: [string, Txn[]][] = [];
    for (const t of filtered.slice(0, limit)) {
      const last = g[g.length - 1];
      if (last && last[0] === t.date) last[1].push(t); else g.push([t.date, [t]]);
    }
    return g;
  }, [filtered, limit]);

  const sum = totals(filtered, settings.rates);
  const activeFilters = [accountId, categoryId, from, to, min, max].filter(Boolean).length;

  return (
    <>
      <TopBar title="Activity" right={
        <button className="btn ghost" onClick={() => setShowFilters(!showFilters)} aria-label="Filters" style={{ position: 'relative' }}>
          <Icon name="filter" size={22} />{activeFilters > 0 && <span className="small" style={{ marginLeft: 2 }}>{activeFilters}</span>}
        </button>
      } />
      <input className="search" type="search" placeholder="Search payee, note, #tag, category" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips" style={{ margin: '10px 0 4px' }}>
        {(['all', 'expense', 'income', 'transfer'] as Kind[]).map((k) => (
          <button key={k} className={`chip${kind === k ? ' on' : ''}`} onClick={() => setKind(k)}>
            {k === 'all' ? 'All' : k === 'expense' ? 'Expenses' : k === 'income' ? 'Income' : 'Transfers'}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="list form" style={{ marginTop: 8 }}>
          <Field label="Account">
            <select value={accountId} onChange={(e) => setAccountId(+e.target.value)}>
              <option value={0}>Any</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(+e.target.value)}>
              <option value={0}>Any</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label="Min (JD)"><input inputMode="decimal" placeholder="0" value={min} onChange={(e) => setMin(e.target.value)} /></Field>
          <Field label="Max (JD)"><input inputMode="decimal" placeholder="Any" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
          <div className="field"><button className="btn ghost small" onClick={() => { setAccountId(0); setCategoryId(0); setFrom(''); setTo(''); setMin(''); setMax(''); }}>Clear filters</button></div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="card grid2" style={{ marginTop: 12, padding: 12 }}>
          <div className="stat"><div className="label">In ({filtered.length} items)</div><div className="value pos"><Money v={sum.income} /></div></div>
          <div className="stat"><div className="label">Out</div><div className="value"><Money v={sum.expense} /></div></div>
        </div>
      )}

      {groups.length === 0 ? (
        txns.length === 0
          ? <Empty icon="🧾" text="No transactions yet."><button className="btn" onClick={() => openTxn()}>Add your first one</button></Empty>
          : <Empty icon="🔍" text="Nothing matches those filters." />
      ) : groups.map(([date, list]) => (
        <div key={date}>
          <div className="date-head"><span>{dayLabel(date)}</span></div>
          <div className="list">{list.map((t) => <TxnRow key={t.id} t={t} />)}</div>
        </div>
      ))}
      {filtered.length > limit && <button className="btn secondary block" style={{ marginTop: 16 }} onClick={() => setLimit(limit + 300)}>Show more</button>}
    </>
  );
}
