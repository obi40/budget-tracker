import { useEffect, type ReactNode } from 'react';
import type { Category, Txn } from '../db/types';
import { format, BASE, type Currency } from '../lib/money';
import { budgetStatus } from '../lib/budget';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';

const paths: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
  pie: <><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  more: <><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m15 18-6-6 6-6" />,
  chev: <path d="m9 18 6-6-6-6" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
};
export function Icon({ name, size = 24, stroke = 2 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

export function TopBar({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const { go, tab } = useUI();
  return (
    <>
      {back && (
        <div className="topbar" style={{ minHeight: 32, marginBottom: 0 }}>
          <button className="back" onClick={() => go(tab, null)}><Icon name="back" size={22} /> More</button>
        </div>
      )}
      <div className="topbar"><h1>{title}</h1>{right}</div>
    </>
  );
}

export function Sheet({ title, onClose, children, action }: { title: string; onClose: () => void; children: ReactNode; action?: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-head">
          <button className="btn ghost" onClick={onClose} style={{ textAlign: 'left' }}>Cancel</button>
          <h2>{title}</h2>
          <div style={{ minWidth: 70, textAlign: 'right' }}>{action}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function Field({ label, children, stack }: { label: string; children: ReactNode; stack?: boolean }) {
  return <div className={`field${stack ? ' stack' : ''}`}><label>{label}</label>{children}</div>;
}

export function Seg<T extends string>({ value, options, onChange, className = '' }: { value: T; options: [T, string][]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`seg ${className}`}>
      {options.map(([v, l]) => <button key={v} type="button" className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Bar({ spent, available, color }: { spent: number; available: number; color?: string }) {
  const st = budgetStatus(spent, available);
  const pct = available > 0 ? Math.min(100, (spent / available) * 100) : spent > 0 ? 100 : 0;
  return <div className={`bar ${st}`}><i style={{ width: `${pct}%`, ...(color && st === 'ok' ? { background: color } : {}) }} /></div>;
}

export const Money = ({ v, c = BASE, sign, className = '' }: { v: number; c?: Currency; sign?: boolean; className?: string }) =>
  <span className={`num ${className}`}>{format(v, c, { sign })}</span>;

export function Badge({ c, emoji }: { c?: Category; emoji?: string }) {
  return <div className="badge" style={{ background: `${c?.color ?? '#94a3b8'}22` }}>{emoji ?? c?.emoji ?? '❔'}</div>;
}

export function TxnRow({ t }: { t: Txn }) {
  const { cat, acc } = useData();
  const { openTxn } = useUI();
  const c = t.splits?.length ? undefined : t.categoryId ? cat.get(t.categoryId) : undefined;
  const a = acc.get(t.accountId);
  const title = t.payee || (t.type === 'transfer' ? 'Transfer' : t.splits?.length ? 'Split' : c?.name ?? 'Uncategorised');
  const sub = t.type === 'transfer'
    ? `${a?.name ?? '?'} → ${t.toAccountId ? acc.get(t.toAccountId)?.name ?? '?' : '?'}`
    : [t.splits?.length ? t.splits.map((s) => cat.get(s.categoryId)?.name).join(', ') : t.payee ? c?.name : null, a?.name].filter(Boolean).join(' · ');
  const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0;
  return (
    <button className="row" onClick={() => openTxn(t)}>
      <Badge c={c} emoji={t.type === 'transfer' ? '🔄' : t.splits?.length ? '🧩' : undefined} />
      <div className="grow">
        <div className="title">{title}</div>
        <div className="sub">{sub}{t.recurringId ? ' · 🔁' : ''}{t.tags?.length ? ` · ${t.tags.map((x) => '#' + x).join(' ')}` : ''}</div>
      </div>
      <div className="end">
        <Money v={sign * t.amount || t.amount} c={t.currency} sign={sign > 0} className={sign > 0 ? 'pos' : sign < 0 ? '' : 'muted'} />
      </div>
    </button>
  );
}

export function Empty({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return <div className="empty"><div className="icon">{icon}</div><div>{text}</div>{children && <div style={{ marginTop: 14 }}>{children}</div>}</div>;
}

export function CategoryGrid({ kind, value, onChange }: { kind: 'expense' | 'income'; value?: number; onChange: (id: number) => void }) {
  const { categories } = useData();
  const list = categories.filter((c) => c.kind === kind && (!c.archived || c.id === value));
  return (
    <div className="cat-grid">
      {list.map((c) => (
        <button key={c.id} type="button" className={c.id === value ? 'on' : ''} onClick={() => onChange(c.id!)}>
          <span className="e">{c.emoji}</span><span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export const EMOJIS = ['🏠', '🛒', '🍽️', '☕', '🚗', '⛽', '🚌', '💡', '💧', '📱', '💊', '🏥', '🛍️', '👕', '🎬', '🎮', '🔁', '📚', '🎓', '💇', '✈️', '🏨', '🎁', '❤️', '💳', '🐷', '📦', '👶', '🐶', '🏋️', '🔧', '🧾', '💼', '💻', '🎉', '📈', '➕', '💰', '🏦', '🪙', '🚕', '🍔', '🍺', '🎵', '⚽', '🕌', '🧴', '🧹'];
export const COLORS = ['#6366f1', '#22c55e', '#f97316', '#0ea5e9', '#eab308', '#14b8a6', '#ef4444', '#ec4899', '#a855f7', '#3b82f6', '#64748b', '#10b981', '#d946ef', '#84cc16'];
