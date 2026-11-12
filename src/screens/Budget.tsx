import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import type { Category } from '../db/types';
import { useData, type Data } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { copyBudgets, setBudget } from '../db/actions';
import { Badge, Bar, BigMoney, Field, Icon, Money, Sheet, TopBar } from '../components/ui';
import { addMonths, monthLabel, thisMonth } from '../lib/dates';
import { categoryMonth, type CategoryMonth } from '../lib/budget';
import { inMonth, spentByMonth, totals } from '../lib/stats';
import { format, parseAmount, toInput } from '../lib/money';

export interface BudgetRow { c: Category; m: CategoryMonth; spentHistory: Map<string, number> }

/** Budget state of every expense category for a month (shared with Home). */
export function useBudgetRows(month: string, d: Data = useData()): BudgetRow[] {
  const { categories, budgets, txns, settings } = d;
  return useMemo(() => {
    const byCat = new Map<number, Map<string, number>>();
    for (const b of budgets) {
      if (!byCat.has(b.categoryId)) byCat.set(b.categoryId, new Map());
      byCat.get(b.categoryId)!.set(b.month, b.amount);
    }
    return categories
      .filter((c) => c.kind === 'expense')
      .map((c) => {
        const spentHistory = spentByMonth(txns, settings.rates, c.id!);
        return { c, spentHistory, m: categoryMonth(byCat.get(c.id!) ?? new Map(), spentHistory, !!c.rollover, month) };
      })
      .filter((r) => !r.c.archived || r.m.available !== 0 || r.m.spent !== 0);
  }, [categories, budgets, txns, settings.rates, month]);
}

export function BudgetScreen() {
  const d = useData();
  const { toast } = useUI();
  const [month, setMonth] = useState(thisMonth());
  const [edit, setEdit] = useState<BudgetRow | null>(null);
  const rows = useBudgetRows(month, d);
  const t = totals(inMonth(d.txns, month), d.settings.rates);

  const budgeted = rows.filter((r) => r.m.available !== 0);
  const unbudgeted = rows.filter((r) => r.m.available === 0);
  const totalBudget = rows.reduce((s, r) => s + r.m.budgeted, 0);
  const totalAvail = budgeted.reduce((s, r) => s + r.m.available, 0);
  const totalSpent = rows.reduce((s, r) => s + r.m.spent, 0);
  const spentInBudgeted = budgeted.reduce((s, r) => s + r.m.spent, 0);
  const left = totalAvail - spentInBudgeted;

  async function copyLast() {
    const n = await copyBudgets(addMonths(month, -1), month);
    toast(n ? `Copied ${n} budgets from ${monthLabel(addMonths(month, -1), true)}` : 'Last month had no budgets');
  }

  return (
    <>
      <TopBar title="Budget" />
      <div className="month-nav">
        <button aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}><Icon name="left" size={20} /></button>
        <b>{monthLabel(month)}</b>
        <button aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}><Icon name="right" size={20} /></button>
      </div>

      <div className="card hero">
        <div className="label">Left to spend</div>
        <BigMoney v={left} className={left < 0 ? 'neg' : ''} />
        <Bar spent={spentInBudgeted} available={totalAvail} />
        <div className="grid2" style={{ marginTop: 14 }}>
          <div className="stat"><div className="label">Income</div><div className="value pos"><Money v={t.income} /></div></div>
          <div className="stat"><div className="label">Budgeted</div><div className="value"><Money v={totalBudget} /></div></div>
          <div className="stat"><div className="label">Spent</div><div className="value"><Money v={totalSpent} /></div></div>
          <div className="stat"><div className="label">Not yet budgeted</div><div className={`value ${t.income - totalBudget < 0 ? 'neg' : ''}`}><Money v={t.income - totalBudget} /></div></div>
        </div>
      </div>

      {totalBudget === 0 && (
        <div className="banner" style={{ marginTop: 12 }}>
          <span>No budgets set for {monthLabel(month, true)}. Tap a category to set one.</span>
          <button className="btn small secondary" onClick={copyLast}>Copy last month</button>
        </div>
      )}

      {budgeted.length > 0 && (
        <>
          <div className="section-title"><span>Budgeted</span>{totalBudget > 0 && <button onClick={copyLast}>Copy last month</button>}</div>
          <div className="list">{budgeted.map((r) => <Row key={r.c.id} r={r} onClick={() => setEdit(r)} />)}</div>
        </>
      )}
      <div className="section-title"><span>Not budgeted</span></div>
      <div className="list">{unbudgeted.map((r) => <Row key={r.c.id} r={r} onClick={() => setEdit(r)} />)}</div>
      {edit && <BudgetSheet row={edit} month={month} onClose={() => setEdit(null)} />}
    </>
  );
}

function Row({ r, onClick }: { r: BudgetRow; onClick: () => void }) {
  const { c, m } = r;
  return (
    <button className="row" onClick={onClick} style={{ alignItems: 'flex-start' }}>
      <Badge c={c} />
      <div className="grow">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span className="title">{c.name}</span>
          {m.available !== 0
            ? <span className={`num small ${m.left < 0 ? 'neg' : 'muted'}`} style={{ fontWeight: 600 }}>{m.left < 0 ? `${format(-m.left)} over` : `${format(m.left)} left`}</span>
            : <span className="num small muted">{m.spent ? format(m.spent) : 'Set budget'}</span>}
        </div>
        {m.available !== 0 && (
          <>
            <div style={{ margin: '7px 0 4px' }}><Bar spent={m.spent} available={m.available} color={c.color} /></div>
            <div className="sub num">
              {format(m.spent)} of {format(m.available)}
              {m.carried !== 0 && ` · ${m.carried > 0 ? '+' : '−'}${format(Math.abs(m.carried))} rolled over`}
            </div>
          </>
        )}
      </div>
    </button>
  );
}

function BudgetSheet({ row, month, onClose }: { row: BudgetRow; month: string; onClose: () => void }) {
  const { toast } = useUI();
  const [text, setText] = useState(toInput(row.m.budgeted, 'JOD'));
  const [rollover, setRollover] = useState(!!row.c.rollover);
  const last = row.spentHistory.get(addMonths(month, -1)) ?? 0;
  // average of the last 3 months that had any spending (ignores months before you started tracking)
  const recent = [1, 2, 3].map((i) => row.spentHistory.get(addMonths(month, -i)) ?? 0).filter((v) => v > 0);
  const avg3 = recent.length ? Math.round(recent.reduce((s, v) => s + v, 0) / recent.length) : 0;

  async function save() {
    const v = text.trim() === '' ? 0 : parseAmount(text, 'JOD');
    if (v == null) return alert('Enter a valid amount.');
    await setBudget(month, row.c.id!, v);
    if (rollover !== !!row.c.rollover) await db.categories.update(row.c.id!, { rollover });
    toast('Budget saved'); onClose();
  }

  return (
    <Sheet title={`${row.c.emoji} ${row.c.name}`} onClose={onClose} onDone={save}>
      <p className="muted small" style={{ textAlign: 'center', margin: '4px 0 0' }}>Monthly budget for {monthLabel(month)} (JD)</p>
      <div className="amount-box"><input inputMode="decimal" placeholder="0" value={text} autoFocus onChange={(e) => setText(e.target.value)} /></div>
      <div className="chips" style={{ justifyContent: 'center', marginBottom: 14 }}>
        {last > 0 && <button className="chip" onClick={() => setText(toInput(last, 'JOD'))}>Last month {format(last)}</button>}
        {avg3 > 0 && <button className="chip" onClick={() => setText(toInput(avg3, 'JOD'))}>3-mo avg {format(avg3)}</button>}
      </div>
      <div className="list form">
        <Field label="Spent so far"><span className="num" style={{ marginLeft: 'auto' }}>{format(row.m.spent)}</span></Field>
        {row.m.carried !== 0 && <Field label="Rolled over"><span className={`num ${row.m.carried < 0 ? 'neg' : 'pos'}`} style={{ marginLeft: 'auto' }}>{format(row.m.carried, 'JOD', { sign: true })}</span></Field>}
        <Field label="Roll over"><input type="checkbox" className="toggle" checked={rollover} onChange={(e) => setRollover(e.target.checked)} /></Field>
      </div>
      <p className="small muted" style={{ margin: '8px 4px 0' }}>With roll over on, what's left (or overspent) each month carries into the next.</p>
      <div className="btn-row">
        {row.m.budgeted > 0 && <button className="btn danger" onClick={async () => { await setBudget(month, row.c.id!, 0); onClose(); }}>Remove</button>}
      </div>
    </Sheet>
  );
}
