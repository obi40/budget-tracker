import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { postNext, skipNext } from '../db/actions';
import { Badge, Bar, BigMoney, Empty, Money, TopBar, TxnRow } from '../components/ui';
import { addDays, dayLabel, monthLabel, thisMonth, todayISO, daysBetween } from '../lib/dates';
import { byCategory, inMonth, netWorth, totals } from '../lib/stats';
import { occurrencesUntil } from '../lib/recurring';
import { format } from '../lib/money';
import { useBudgetRows } from './Budget';

export function Home() {
  const d = useData();
  const { txns, settings, recurring, cat, accounts } = d;
  const { go, openTxn, toast } = useUI();
  const month = thisMonth();
  const today = todayISO();
  const monthTxns = inMonth(txns, month);
  const t = totals(monthTxns, settings.rates);
  const rows = useBudgetRows(month, d);
  const budgeted = rows.filter((r) => r.m.available !== 0);
  const left = budgeted.reduce((s, r) => s + r.m.left, 0);
  const avail = budgeted.reduce((s, r) => s + r.m.available, 0);
  const spentBudgeted = budgeted.reduce((s, r) => s + r.m.spent, 0);
  const nw = netWorth(accounts, txns, settings.rates);

  const top = useMemo(() => [...byCategory(monthTxns, settings.rates)].sort((a, b) => b[1] - a[1]).slice(0, 5), [monthTxns, settings.rates]);
  const budgetOf = new Map(rows.map((r) => [r.c.id!, r.m]));

  const due = recurring.filter((r) => r.active && !r.autoPost && r.nextDate <= today);
  const upcoming = useMemo(() => recurring
    .filter((r) => r.active && r.type !== 'transfer')
    .flatMap((r) => occurrencesUntil(r, addDays(today, 30), 10).filter((dt) => dt > today).map((date) => ({ r, date })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6), [recurring, today]);

  const daysLeft = daysBetween(today, `${month}-${new Date(+month.slice(0, 4), +month.slice(5), 0).getDate()}`) + 1;
  const needsBackup = txns.length > 0 && (!settings.lastBackup || daysBetween(settings.lastBackup.slice(0, 10), today) > 30);

  return (
    <>
      <TopBar title={monthLabel(month)} />

      {needsBackup && (
        <div className="banner">
          <span>💾 {settings.lastBackup ? 'Your last backup was over a month ago.' : 'You haven\'t backed up yet.'}</span>
          <button className="btn small secondary" onClick={() => go('more', 'backup')}>Back up</button>
        </div>
      )}

      <div className="card hero">
        {budgeted.length > 0 ? (
          <>
            <div className="label">Left to spend this month</div>
            <BigMoney v={left} className={left < 0 ? 'neg' : ''} />
            <Bar spent={spentBudgeted} available={avail} />
            <div className="small muted" style={{ marginTop: 6 }}>
              {left > 0 && daysLeft > 0 ? `About ${format(Math.floor(left / daysLeft))} a day for ${daysLeft} more day${daysLeft > 1 ? 's' : ''}` : left < 0 ? 'Over budget this month' : ''}
            </div>
          </>
        ) : (
          <>
            <div className="label">Net this month</div>
            <BigMoney v={t.net} sign className={t.net < 0 ? 'neg' : ''} />
          </>
        )}
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="stat"><div className="label">Income</div><div className="value pos"><Money v={t.income} /></div></div>
          <div className="stat"><div className="label">Expenses</div><div className="value"><Money v={t.expense} /></div></div>
        </div>
      </div>

      {due.length > 0 && (
        <>
          <div className="section-title"><span>Due now</span></div>
          <div className="list">
            {due.map((r) => (
              <div key={r.id} className="row">
                <Badge c={r.categoryId ? cat.get(r.categoryId) : undefined} emoji={r.type === 'transfer' ? '🔄' : undefined} />
                <div className="grow"><div className="title">{r.name}</div><div className="sub">{dayLabel(r.nextDate)} · <Money v={r.amount} c={r.currency} /></div></div>
                <button className="btn small ghost" onClick={async () => { await skipNext(r); toast('Skipped'); }}>Skip</button>
                <button className="btn small" onClick={async () => { await postNext(r); toast(`${r.name} added`); }}>Add</button>
              </div>
            ))}
          </div>
        </>
      )}

      {top.length > 0 && (
        <>
          <div className="section-title"><span>Top spending</span><button onClick={() => go('budget')}>Budget</button></div>
          <div className="list">
            {top.map(([id, v]) => {
              const c = cat.get(id);
              const b = budgetOf.get(id);
              return (
                <div key={id} className="row" style={{ alignItems: 'flex-start' }}>
                  <Badge c={c} />
                  <div className="grow">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="title">{c?.name ?? 'Uncategorised'}</span><Money v={v} /></div>
                    {b && b.available > 0 && <div style={{ marginTop: 7 }}><Bar spent={b.spent} available={b.available} color={c?.color} /><div className="sub" style={{ marginTop: 3 }}>{Math.round((b.spent / b.available) * 100)}% of {format(b.available)}</div></div>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="section-title"><span>Coming up · 30 days</span><button onClick={() => go('more', 'recurring')}>All</button></div>
          <div className="list">
            {upcoming.map(({ r, date }) => (
              <div key={`${r.id}-${date}`} className="row">
                <Badge c={r.categoryId ? cat.get(r.categoryId) : undefined} />
                <div className="grow"><div className="title">{r.name}</div><div className="sub">{dayLabel(date)}{r.autoPost ? ' · auto' : ''}</div></div>
                <div className="end"><Money v={r.amount} c={r.currency} sign={r.type === 'income'} className={r.type === 'income' ? 'pos' : ''} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title"><span>Net worth</span><button onClick={() => go('more', 'accounts')}>Accounts</button></div>
      <button className="card row" style={{ padding: 16 }} onClick={() => go('more', 'accounts')}>
        <div className="grow"><div className={`num ${nw < 0 ? 'neg' : ''}`} style={{ fontSize: 24, fontWeight: 700 }}><Money v={nw} /></div><div className="sub">{accounts.filter((a) => !a.archived).length} accounts</div></div>
      </button>

      <div className="section-title"><span>Recent</span>{txns.length > 0 && <button onClick={() => go('txns')}>See all</button>}</div>
      {txns.length ? <div className="list">{txns.slice(0, 6).map((x) => <TxnRow key={x.id} t={x} />)}</div>
        : <Empty icon="👋" text="Welcome! Start by adding your income and a few expenses."><button className="btn" onClick={() => openTxn()}>Add a transaction</button></Empty>}
    </>
  );
}
