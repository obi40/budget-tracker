import { useState } from 'react';
import { db } from '../db/schema';
import type { Category, CategoryKind } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Badge, COLORS, EMOJIS, Field, Seg, Sheet, TopBar } from '../components/ui';

export function Categories() {
  const { categories } = useData();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const list = categories.filter((c) => c.kind === kind);
  return (
    <>
      <TopBar title="Categories" back right={<button className="btn ghost" onClick={() => setEdit({ kind })}>Add</button>} />
      <Seg value={kind} onChange={setKind} options={[['expense', 'Expenses'], ['income', 'Income']]} />
      <div className="list" style={{ marginTop: 12 }}>
        {list.map((c) => (
          <button key={c.id} className="row" onClick={() => setEdit(c)} style={{ opacity: c.archived ? 0.5 : 1 }}>
            <Badge c={c} />
            <div className="grow"><div className="title">{c.name}</div>{(c.rollover || c.archived) && <div className="sub">{[c.rollover && 'Rolls over', c.archived && 'Archived'].filter(Boolean).join(' · ')}</div>}</div>
          </button>
        ))}
      </div>
      {edit && <CategorySheet c={edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function CategorySheet({ c, onClose }: { c: Partial<Category>; onClose: () => void }) {
  const { txns, budgets, recurring } = useData();
  const { toast } = useUI();
  const [name, setName] = useState(c.name ?? '');
  const [emoji, setEmoji] = useState(c.emoji ?? '📦');
  const [color, setColor] = useState(c.color ?? COLORS[0]);
  const [rollover, setRollover] = useState(!!c.rollover);
  const [archived, setArchived] = useState(!!c.archived);
  const kind = c.kind ?? 'expense';

  async function save() {
    if (!name.trim()) return alert('Give the category a name.');
    const rec: Category = { name: name.trim(), emoji, color, kind, rollover, archived };
    if (c.id != null) await db.categories.put({ ...rec, id: c.id }); else await db.categories.add(rec);
    toast('Category saved'); onClose();
  }
  async function remove() {
    const used = txns.some((t) => t.categoryId === c.id || t.splits?.some((s) => s.categoryId === c.id)) || recurring.some((r) => r.categoryId === c.id);
    if (used) return alert('This category is used by transactions. Archive it instead to hide it.');
    if (!confirm(`Delete ${c.name}?`)) return;
    await db.budgets.bulkDelete(budgets.filter((b) => b.categoryId === c.id).map((b) => b.id!));
    await db.categories.delete(c.id!); onClose();
  }

  return (
    <Sheet title={c.id != null ? 'Edit category' : 'New category'} onClose={onClose} action={<button className="btn ghost" onClick={save}>Save</button>}>
      <div style={{ display: 'grid', placeItems: 'center', margin: '8px 0 14px' }}>
        <div className="badge" style={{ width: 64, height: 64, fontSize: 34, borderRadius: 18, background: `${color}22` }}>{emoji}</div>
      </div>
      <div className="list form">
        <Field label="Name"><input value={name} placeholder="e.g. Coffee" onChange={(e) => setName(e.target.value)} /></Field>
        {kind === 'expense' && <Field label="Roll over"><input type="checkbox" className="toggle" checked={rollover} onChange={(e) => setRollover(e.target.checked)} /></Field>}
        {c.id != null && <Field label="Archived"><input type="checkbox" className="toggle" checked={archived} onChange={(e) => setArchived(e.target.checked)} /></Field>}
      </div>
      {kind === 'expense' && <p className="small muted" style={{ margin: '8px 4px 0' }}>Roll over: money left at the end of a month (or overspent) carries into next month's budget.</p>}
      <div className="section-title"><span>Icon</span></div>
      <div className="card" style={{ padding: 8 }}>
        <div className="emoji-grid">{EMOJIS.map((e) => <button key={e} className={e === emoji ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>)}</div>
      </div>
      <div className="section-title"><span>Colour</span></div>
      <div className="card"><div className="swatches">{COLORS.map((x) => <button key={x} aria-label={x} className={x === color ? 'on' : ''} style={{ background: x }} onClick={() => setColor(x)} />)}</div></div>
      <div className="btn-row">
        {c.id != null && <button className="btn danger" onClick={remove}>Delete</button>}
        <button className="btn" onClick={save}>Save</button>
      </div>
    </Sheet>
  );
}
