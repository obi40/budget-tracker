import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Category, Txn } from '../db/types';
import { format, BASE, type Currency } from '../lib/money';
import { budgetStatus } from '../lib/budget';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';

/* Line icons for controls; filled icons for the tab bar (tab-bars.md: "Prefer filled symbols"). */
const STROKE: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m15 18-6-6 6-6" />,
  chev: <path d="m9 18 6-6-6-6" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
};
const FILLED: Record<string, ReactNode> = {
  house: <path d="M11.3 3.27a1.1 1.1 0 0 1 1.4 0l8.4 6.9a.9.9 0 0 1-.57 1.6H19V19.5a1.5 1.5 0 0 1-1.5 1.5H15v-5.25a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H6.5A1.5 1.5 0 0 1 5 19.5v-7.73H3.47a.9.9 0 0 1-.57-1.6z" />,
  activity: <path fillRule="evenodd" d="M6.5 3.5h11a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3ZM8 7.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm3 .35a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5Zm-3 3.65a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm3 .35a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5Zm-3 3.65a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm3 .35a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5Z" />,
  pie: <><path d="M11 3.06A9 9 0 1 0 20.94 13H12a1 1 0 0 1-1-1z" /><path d="M13 2.06V11h8.94A9 9 0 0 0 13 2.06Z" /></>,
  bars: <><rect x="3.5" y="12" width="4.5" height="9" rx="1.6" /><rect x="9.75" y="4" width="4.5" height="17" rx="1.6" /><rect x="16" y="8" width="4.5" height="13" rx="1.6" /></>,
  ellipsis: <path fillRule="evenodd" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM7.5 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm4.5 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Zm4.5 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8Z" />,
};
export function Icon({ name, size = 24, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  if (FILLED[name])
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>{FILLED[name]}</svg>;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {STROKE[name]}
    </svg>
  );
}

/** Large title that hands off to a compact glass bar once it scrolls under the top edge. */
export function TopBar({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const { go, tab } = useUI();
  const h1 = useRef<HTMLHeadingElement>(null);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = h1.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting && e.boundingClientRect.top < 60), { rootMargin: '-50px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const backBtn = back && <button className="back" onClick={() => go(tab, null)}><Icon name="back" size={24} stroke={2.4} />More</button>;
  return (
    <>
      <div className={`navbar${compact ? ' on' : ''}`} aria-hidden={!compact}>
        {back && <div style={{ position: 'absolute', left: 12, bottom: 0, display: 'flex', alignItems: 'center', height: 44 }}>{backBtn}</div>}
        <span>{title}</span>
      </div>
      {back && <div className="backrow">{backBtn}</div>}
      <div className="topbar"><h1 ref={h1}>{title}</h1>{right}</div>
    </>
  );
}

// Apple's momentum projection (Designing Fluid Interfaces): where a flick would come to rest.
const project = (v: number, d = 0.998) => ((v / 1000) * d) / (1 - d);
const rubberband = (x: number, dim: number, c = 0.55) => (x * dim * c) / (dim + c * Math.abs(x));

/**
 * Bottom sheet. Enters from the bottom and always leaves the same way, whatever closed it
 * (Cancel, Done, saving, Escape): on unmount a copy of the sheet slides out from wherever it was.
 * Drag the grabber area down to dismiss; a flick counts by its projected landing point.
 */
export function Sheet({ title, onClose, children, onDone, doneLabel = 'Save' }: {
  title: string; onClose: () => void; children: ReactNode; onDone?: () => void; doneLabel?: string;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; last: number; t: number; v: number; dy: number } | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [onClose]);

  useLayoutEffect(() => {
    const born = performance.now();
    const s = sheet.current, b = backdrop.current;
    return () => {
      if (!s || !b || performance.now() - born < 60) return; // React StrictMode's instant remount in dev
      const gs = s.cloneNode(true) as HTMLElement, gb = b.cloneNode(true) as HTMLElement;
      const scroll = s.querySelector('.sheet-body')?.scrollTop ?? 0;
      gs.classList.remove('shown', 'dragging', 'settle');
      gs.classList.add('sheet-ghost'); gb.classList.add('sheet-ghost');
      gs.removeAttribute('role'); gs.setAttribute('aria-hidden', 'true');
      document.body.append(gb, gs);
      const body = gs.querySelector('.sheet-body');
      if (body) body.scrollTop = scroll;
      const done = () => { gs.remove(); gb.remove(); };
      gs.addEventListener('animationend', done, { once: true });
      setTimeout(done, 700);
    };
  }, []);

  function down(e: React.PointerEvent) {
    const s = sheet.current;
    if (!s?.classList.contains('shown') || (e.target as HTMLElement).closest('button')) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    drag.current = { y0: e.clientY, last: e.clientY, t: e.timeStamp, v: 0, dy: 0 };
    s.classList.remove('settle'); s.classList.add('dragging');
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, s = sheet.current;
    if (!d || !s) return;
    const dy = e.clientY - d.y0;
    const dt = Math.max(1, e.timeStamp - d.t);
    d.v = 0.8 * ((e.clientY - d.last) / dt) * 1000 + 0.2 * d.v; // px/s, lightly smoothed
    d.last = e.clientY; d.t = e.timeStamp; d.dy = dy;
    const y = dy >= 0 ? dy : rubberband(dy, s.offsetHeight); // resist past the top
    s.style.transform = `translateY(${y}px)`;
    if (backdrop.current) backdrop.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / s.offsetHeight));
  }
  function up() {
    const d = drag.current, s = sheet.current;
    drag.current = null;
    if (!d || !s) return;
    s.classList.remove('dragging');
    if (d.dy > 0 && d.dy + project(d.v) > s.offsetHeight * 0.4) { onClose(); return; }
    s.classList.add('settle');
    s.style.transform = 'translateY(0px)';
    if (backdrop.current) backdrop.current.style.opacity = '';
  }

  return (
    <>
      <div className="backdrop" ref={backdrop} onClick={onClose} />
      <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={title}
        onAnimationEnd={(e) => e.target === sheet.current && sheet.current?.classList.add('shown')}
        onTransitionEnd={(e) => { if (e.target === sheet.current) { sheet.current.classList.remove('settle'); sheet.current.style.transform = ''; } }}>
        <div className="sheet-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <button className="round glass" aria-label="Cancel" onClick={onClose}><Icon name="close" size={18} stroke={2.4} /></button>
          <h2>{title}</h2>
          {onDone
            ? <button className="round prominent" aria-label={doneLabel} onClick={onDone}><Icon name="check" size={20} stroke={2.6} /></button>
            : <span className="round spacer" aria-hidden />}
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
    <div className={`seg ${className}`} role="tablist">
      {options.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function Bar({ spent, available }: { spent: number; available: number; color?: string }) {
  const st = budgetStatus(spent, available);
  const pct = available > 0 ? Math.min(100, (spent / available) * 100) : spent > 0 ? 100 : 0;
  return <div className={`bar ${st}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>;
}

/** Amount with the decimals dimmed, so "1,200.000" reads as "1,200" first. */
export function Money({ v, c = BASE, sign, className = '' }: { v: number; c?: Currency; sign?: boolean; className?: string }) {
  const s = format(v, c, { sign });
  const m = /^(.*?)(\.\d+)$/.exec(s);
  return <span className={`num ${className}`}>{m ? <>{m[1]}<span className="frac">{m[2]}</span></> : s}</span>;
}

/** The hero number: small currency, big integer, quiet decimals. */
export function BigMoney({ v, sign, className = '' }: { v: number; sign?: boolean; className?: string }) {
  const s = format(Math.abs(v), BASE).replace(/^JD\s/, '');
  const [int, frac] = s.split('.');
  const pre = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return (
    <div className={`big num rounded ${className}`} aria-label={format(v, BASE, { sign })}>
      <span className="cur">JD</span>{pre}{int}{frac && <span className="frac">.{frac}</span>}
    </div>
  );
}

export function Badge({ c, emoji }: { c?: Category; emoji?: string }) {
  return <div className="badge" style={{ background: `${c?.color ?? '#94a3b8'}26` }}>{emoji ?? c?.emoji ?? '❔'}</div>;
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
  return (
    <button className="row" onClick={() => openTxn(t)}>
      <Badge c={c} emoji={t.type === 'transfer' ? '🔄' : t.splits?.length ? '🧩' : undefined} />
      <div className="grow">
        <div className="title">{title}</div>
        <div className="sub">{sub}{t.recurringId ? ' · 🔁' : ''}{t.tags?.length ? ` · ${t.tags.map((x) => '#' + x).join(' ')}` : ''}</div>
      </div>
      <div className="end">
        <Money v={t.amount} c={t.currency} sign={t.type === 'income'} className={t.type === 'income' ? 'pos' : t.type === 'transfer' ? 'muted' : ''} />
      </div>
    </button>
  );
}

export function Empty({ icon, text, children }: { icon: string; text: string; children?: ReactNode }) {
  return <div className="empty"><div className="icon">{icon}</div><div>{text}</div>{children && <div style={{ marginTop: 18 }}>{children}</div>}</div>;
}

export function CategoryGrid({ kind, value, onChange }: { kind: 'expense' | 'income'; value?: number; onChange: (id: number) => void }) {
  const { categories } = useData();
  const list = categories.filter((c) => c.kind === kind && (!c.archived || c.id === value));
  return (
    <div className="cat-grid">
      {list.map((c) => (
        <button key={c.id} type="button" aria-pressed={c.id === value} className={c.id === value ? 'on' : ''} onClick={() => onChange(c.id!)}>
          <span className="e">{c.emoji}</span><span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export const EMOJIS = ['🏠', '🛒', '🍽️', '☕', '🚗', '⛽', '🚌', '💡', '💧', '📱', '💊', '🏥', '🛍️', '👕', '🎬', '🎮', '🔁', '📚', '🎓', '💇', '✈️', '🏨', '🎁', '❤️', '💳', '🐷', '📦', '👶', '🐶', '🏋️', '🔧', '🧾', '💼', '💻', '🎉', '📈', '➕', '💰', '🏦', '🪙', '🚕', '🍔', '🍺', '🎵', '⚽', '🕌', '🧴', '🧹'];
export const COLORS = ['#6366f1', '#22c55e', '#f97316', '#0ea5e9', '#eab308', '#14b8a6', '#ef4444', '#ec4899', '#a855f7', '#3b82f6', '#64748b', '#10b981', '#d946ef', '#84cc16'];
