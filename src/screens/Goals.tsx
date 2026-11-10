import { useState } from 'react';
import { db } from '../db/schema';
import type { Goal } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Bar, EMOJIS, Empty, Field, Money, Sheet, TopBar } from '../components/ui';
import { format, parseAmount, toInput } from '../lib/money';
import { dayLabel, monthOf, monthsBetween, thisMonth, todayISO } from '../lib/dates';

export const saved = (g: Goal) => g.contributions.reduce((s, c) => s + c.amount, 0);

export function Goals() {
  const { goals } = useData();
  const [edit, setEdit] = useState<Partial<Goal> | null>(null);
  const [add, setAdd] = useState<Goal | null>(null);
  const active = goals.filter((g) => !g.archived);
  const done = goals.filter((g) => g.archived);
  const total = active.reduce((s, g) => s + saved(g), 0);

  const card = (g: Goal) => {
    const s = saved(g);
    const remaining = Math.max(0, g.target - s);
    const months = g.targetDate ? Math.max(1, monthsBetween(thisMonth(), monthOf(g.targetDate)) + 1) : 0;
    return (
      <div key={g.id} className="card" style={{ opacity: g.archived ? 0.6 : 1 }}>
        <button className="row" style={{ padding: 0, minHeight: 0 }} onClick={() => setEdit(g)}>
          <div className="badge" style={{ background: 'var(--accent-soft)' }}>{g.emoji}</div>
          <div className="grow"><div className="title">{g.name}</div><div className="sub">{g.targetDate ? `By ${dayLabel(g.targetDate)}` : 'No deadline'}</div></div>
          <div className="end"><div className="num" style={{ fontWeight: 650 }}>{Math.min(100, Math.round((s / g.target) * 100))}%</div></div>
        </button>
        <div style={{ margin: '12px 0 6px' }}><Bar spent={Math.min(s, g.target)} available={g.target} color="var(--ok)" /></div>
        <div className="sub num" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2px 10px' }}>
          <span>{format(s)} of {format(g.target)}</span>
          {remaining > 0 && months > 0 && <span>{format(Math.ceil(remaining / months))}/mo needed</span>}
          {remaining === 0 && <span className="pos">Reached 🎉</span>}
        </div>
        {!g.archived && <button className="btn secondary block small" style={{ marginTop: 12 }} onClick={() => setAdd(g)}>Add money</button>}
      </div>
    );
  };

  return (
    <>
      <TopBar title="Savings goals" back right={<button className="btn ghost" onClick={() => setEdit({})}>Add</button>} />
      {active.length > 0 && <p className="subtitle">Saved so far: <b className="num">{format(total)}</b></p>}
      {active.length === 0 && <Empty icon="🎯" text="Set a goal: an emergency fund, a trip, a car."><button className="btn" onClick={() => setEdit({})}>New goal</button></Empty>}
      {active.map(card)}
      {done.length > 0 && <><div className="section-title"><span>Completed / archived</span></div>{done.map(card)}</>}
      {edit && <GoalSheet g={edit} onClose={() => setEdit(null)} />}
      {add && <ContributeSheet g={add} onClose={() => setAdd(null)} />}
    </>
  );
}

function GoalSheet({ g, onClose }: { g: Partial<Goal>; onClose: () => void }) {
  const { toast } = useUI();
  const [name, setName] = useState(g.name ?? '');
  const [emoji, setEmoji] = useState(g.emoji ?? '🎯');
  const [target, setTarget] = useState(g.target ? toInput(g.target, 'JOD') : '');
  const [date, setDate] = useState(g.targetDate ?? '');
  const [archived, setArchived] = useState(!!g.archived);

  async function save() {
    const t = parseAmount(target, 'JOD');
    if (!name.trim() || !t) return alert('Enter a name and a target amount.');
    const rec: Goal = { name: name.trim(), emoji, target: t, targetDate: date || undefined, contributions: g.contributions ?? [], archived };
    if (g.id != null) await db.goals.put({ ...rec, id: g.id }); else await db.goals.add(rec);
    toast('Goal saved'); onClose();
  }
  return (
    <Sheet title={g.id != null ? 'Edit goal' : 'New goal'} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <div className="list form">
        <Field label="Name"><input value={name} placeholder="Emergency fund" onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Target (JD)"><input inputMode="decimal" placeholder="0" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Target date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {g.id != null && <Field label="Archived"><input type="checkbox" className="toggle" checked={archived} onChange={(e) => setArchived(e.target.checked)} /></Field>}
      </div>
      <div className="section-title"><span>Icon</span></div>
      <div className="card" style={{ padding: 8 }}><div className="emoji-grid">{['🎯', '🛟', '✈️', '🚗', '🏠', '💍', '🎓', '💻', '📱', '👶', '🕋', '🏖️', ...EMOJIS.slice(0, 12)].map((e, i) => <button key={i} className={e === emoji ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>)}</div></div>
      {g.contributions && g.contributions.length > 0 && (
        <>
          <div className="section-title"><span>History</span></div>
          <div className="list plain">
            {[...g.contributions].reverse().map((c, i) => (
              <div key={i} className="row"><div className="grow sub">{dayLabel(c.date)}</div><Money v={c.amount} sign className={c.amount > 0 ? 'pos' : 'neg'} /></div>
            ))}
          </div>
        </>
      )}
      <div className="btn-row">
        {g.id != null && <button className="btn danger" onClick={async () => { if (confirm('Delete this goal?')) { await db.goals.delete(g.id!); onClose(); } }}>Delete</button>}
        <button className="btn" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}

function ContributeSheet({ g, onClose }: { g: Goal; onClose: () => void }) {
  const { toast } = useUI();
  const [text, setText] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  async function save() {
    const v = parseAmount(text, 'JOD');
    if (!v) return alert('Enter an amount.');
    await db.goals.update(g.id!, { contributions: [...g.contributions, { date: todayISO(), amount: withdraw ? -v : v }] });
    toast(withdraw ? 'Withdrawn' : `Added to ${g.name}`); onClose();
  }
  return (
    <Sheet title={`${g.emoji} ${g.name}`} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <div className="amount-box"><input inputMode="decimal" placeholder="0" autoFocus value={text} onChange={(e) => setText(e.target.value)} /></div>
      <div className="list form"><Field label="Withdraw instead"><input type="checkbox" className="toggle" checked={withdraw} onChange={(e) => setWithdraw(e.target.checked)} /></Field></div>
      <p className="small muted" style={{ margin: '8px 4px' }}>Tip: to track where the money sits, also record a transfer to your savings account.</p>
      <button className="btn block" onClick={save}>{withdraw ? 'Withdraw' : 'Add money'}</button>
    </Sheet>
  );
}
