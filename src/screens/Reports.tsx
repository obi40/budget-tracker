import { useMemo, useState } from 'react';
import { Bar as RBar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useData } from '../hooks/useData';
import { Empty, Field, Money, TopBar } from '../components/ui';
import { addMonths, lastDayOf, monthLabel, monthRange, thisMonth } from '../lib/dates';
import { byCategory, inMonth, inRange, monthlySeries, netWorthSeries, savingsRate, totals } from '../lib/stats';
import { format, fromMinor } from '../lib/money';

type Range = '1' | '3' | '6' | '12' | 'ytd';
const RANGES: [Range, string][] = [['1', 'This month'], ['3', '3 months'], ['6', '6 months'], ['12', '12 months'], ['ytd', 'This year']];

const tip = { contentStyle: { background: 'var(--card)', border: '0.5px solid var(--line)', borderRadius: 10, fontSize: 13 }, labelStyle: { color: 'var(--muted)' } };
const jd = (v: number) => format(v, 'JOD', { compact: true });

export function Reports() {
  const { txns, accounts, cat, settings } = useData();
  const [range, setRange] = useState<Range>('1');
  const [accountId, setAccountId] = useState(0);
  const now = thisMonth();
  const fromMonth = range === 'ytd' ? `${now.slice(0, 4)}-01` : addMonths(now, -(+range - 1));
  const months = monthRange(fromMonth, now);

  const scoped = useMemo(() => accountId ? txns.filter((t) => t.accountId === accountId || t.toAccountId === accountId) : txns, [txns, accountId]);
  const inR = inRange(scoped, `${fromMonth}-01`, lastDayOf(now));
  const t = totals(inR, settings.rates);
  const rate = savingsRate(t);
  const cats = [...byCategory(inR, settings.rates)].sort((a, b) => b[1] - a[1]);
  const pie = cats.map(([id, v]) => ({ name: cat.get(id)?.name ?? 'Uncategorised', emoji: cat.get(id)?.emoji ?? '❔', value: v, color: cat.get(id)?.color ?? '#94a3b8' }));
  const incomeCats = [...byCategory(inR, settings.rates, 'income')].sort((a, b) => b[1] - a[1]);

  const trendMonths = months.length >= 3 ? months : monthRange(addMonths(now, -5), now);
  const series = monthlySeries(scoped, settings.rates, trendMonths).map((m) => ({ ...m, label: monthLabel(m.month, true), inc: fromMinor(m.income, 'JOD'), exp: fromMinor(m.expense, 'JOD'), netv: fromMinor(m.net, 'JOD') }));
  const nwAccounts = accountId ? accounts.filter((a) => a.id === accountId) : accounts;
  const nw = netWorthSeries(nwAccounts, scoped, settings.rates, monthRange(addMonths(now, -11), now)).map((p) => ({ label: monthLabel(p.month, true), v: fromMinor(p.value, 'JOD') }));

  // this month vs last month
  const cur = byCategory(inMonth(scoped, now), settings.rates);
  const prev = byCategory(inMonth(scoped, addMonths(now, -1)), settings.rates);
  const compare = [...new Set([...cur.keys(), ...prev.keys()])]
    .map((id) => ({ id, cur: cur.get(id) ?? 0, prev: prev.get(id) ?? 0 }))
    .sort((a, b) => Math.abs(b.cur - b.prev) - Math.abs(a.cur - a.prev)).slice(0, 8);
  const days = months.length === 1 ? Math.min(new Date().getDate(), 31) : months.length * 30.4;

  if (!txns.length) return <><TopBar title="Reports" /><Empty icon="📊" text="Reports appear once you've added some transactions." /></>;

  return (
    <>
      <TopBar title="Reports" />
      <div className="chips">{RANGES.map(([r, l]) => <button key={r} className={`chip${r === range ? ' on' : ''}`} onClick={() => setRange(r)}>{l}</button>)}</div>
      <div className="list form" style={{ marginTop: 10 }}>
        <Field label="Account">
          <select value={accountId} onChange={(e) => setAccountId(+e.target.value)}>
            <option value={0}>All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="card grid2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="label">Income</div><div className="value pos"><Money v={t.income} /></div></div>
        <div className="stat"><div className="label">Expenses</div><div className="value"><Money v={t.expense} /></div></div>
        <div className="stat"><div className="label">Net saved</div><div className={`value ${t.net < 0 ? 'neg' : ''}`}><Money v={t.net} sign /></div></div>
        <div className="stat"><div className="label">Savings rate</div><div className={`value ${rate != null && rate < 0 ? 'neg' : ''}`}>{rate == null ? '—' : `${Math.round(rate * 100)}%`}</div></div>
        <div className="stat"><div className="label">Avg spend / day</div><div className="value"><Money v={Math.round(t.expense / Math.max(1, days))} /></div></div>
        <div className="stat"><div className="label">Transactions</div><div className="value">{inR.length}</div></div>
      </div>

      <div className="section-title"><span>Spending by category</span></div>
      <div className="card">
        {pie.length === 0 ? <p className="muted small">No spending in this period.</p> : (
          <>
            <div style={{ height: 220, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip {...tip} formatter={(v: number) => format(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                <div><div className="small muted">Total</div><div className="num" style={{ fontWeight: 700 }}>{format(t.expense)}</div></div>
              </div>
            </div>
            <div className="legend">
              {pie.map((p) => (
                <div key={p.name}><i style={{ background: p.color }} /><span className="grow">{p.emoji} {p.name}</span>
                  <span className="muted small num">{Math.round((p.value / t.expense) * 100)}%</span><span className="num" style={{ minWidth: 92, textAlign: 'right' }}>{format(p.value)}</span></div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="section-title"><span>Income vs expenses</span></div>
      <div className="card" style={{ height: 230, padding: '16px 8px 8px 0' }}>
        <ResponsiveContainer>
          <BarChart data={series} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => jd(v * 1000).replace('JD ', '')} />
            <Tooltip {...tip} formatter={(v: number, n) => [format(Math.round(v * 1000)), n === 'inc' ? 'Income' : 'Expenses']} cursor={{ fill: 'var(--track)' }} />
            <RBar dataKey="inc" fill="var(--income)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            <RBar dataKey="exp" fill="var(--expense)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title"><span>Cash flow (net per month)</span></div>
      <div className="card" style={{ height: 190, padding: '16px 8px 8px 0' }}>
        <ResponsiveContainer>
          <BarChart data={series}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => jd(v * 1000).replace('JD ', '')} />
            <Tooltip {...tip} formatter={(v: number) => [format(Math.round(v * 1000), 'JOD', { sign: true }), 'Net']} cursor={{ fill: 'var(--track)' }} />
            <RBar dataKey="netv" radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {series.map((s) => <Cell key={s.month} fill={s.net >= 0 ? 'var(--income)' : 'var(--expense)'} />)}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title"><span>Net worth · 12 months</span></div>
      <div className="card" style={{ height: 190, padding: '16px 12px 8px 0' }}>
        <ResponsiveContainer>
          <LineChart data={nw}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={1} />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => jd(v * 1000).replace('JD ', '')} />
            <Tooltip {...tip} formatter={(v: number) => [format(Math.round(v * 1000)), 'Net worth']} />
            <Line dataKey="v" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="section-title"><span>{monthLabel(now, true)} vs {monthLabel(addMonths(now, -1), true)}</span></div>
      <div className="list plain">
        {compare.length === 0 && <div className="row muted small">No spending in either month.</div>}
        {compare.map((c) => {
          const diff = c.cur - c.prev;
          return (
            <div key={c.id} className="row">
              <div className="grow"><div className="title">{cat.get(c.id)?.emoji} {cat.get(c.id)?.name ?? 'Uncategorised'}</div><div className="sub num">{format(c.cur)} vs {format(c.prev)}</div></div>
              <div className={`end num small ${diff > 0 ? 'neg' : 'pos'}`} style={{ fontWeight: 600 }}>{diff > 0 ? '▲' : diff < 0 ? '▼' : ''} {format(Math.abs(diff))}</div>
            </div>
          );
        })}
      </div>

      {incomeCats.length > 0 && (
        <>
          <div className="section-title"><span>Income sources</span></div>
          <div className="list plain">
            {incomeCats.map(([id, v]) => (
              <div key={id} className="row"><div className="grow title">{cat.get(id)?.emoji} {cat.get(id)?.name ?? 'Other'}</div><div className="end num pos">{format(v)}</div></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
