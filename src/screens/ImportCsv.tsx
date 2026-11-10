import { useMemo, useState } from 'react';
import { db } from '../db/schema';
import type { Txn } from '../db/types';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Field, Money, TopBar } from '../components/ui';
import { DATE_FORMATS, detectDelimiter, parseCSV, parseDate, parseSigned, type DateFormat } from '../lib/csv';
import { scale } from '../lib/money';

type Mode = 'signed' | 'split';

export function ImportCsv() {
  const { accounts, categories, txns } = useData();
  const { toast, go } = useUI();
  const [rows, setRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState('');
  const [header, setHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [mode, setMode] = useState<Mode>('signed');
  const [amtCol, setAmtCol] = useState(2);
  const [outCol, setOutCol] = useState(2);
  const [inCol, setInCol] = useState(3);
  const [fmt, setFmt] = useState<DateFormat>('DD/MM/YYYY');
  const [flip, setFlip] = useState(false);
  const [decComma, setDecComma] = useState(false);
  const [accountId, setAccountId] = useState(accounts.find((a) => a.type === 'bank')?.id ?? accounts[0]?.id);
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived);
  const incomeCats = categories.filter((c) => c.kind === 'income' && !c.archived);
  const [expCat, setExpCat] = useState(expenseCats.find((c) => c.name === 'Other')?.id ?? expenseCats[0]?.id);
  const [incCat, setIncCat] = useState(incomeCats.find((c) => c.name === 'Other income')?.id ?? incomeCats[0]?.id);

  async function onFile(f: File | undefined) {
    if (!f) return;
    const text = await f.text();
    const parsed = parseCSV(text);
    setRows(parsed); setFileName(f.name);
    setDecComma(detectDelimiter(text) === ';');
    // guess columns from the header row
    const h = (parsed[0] ?? []).map((x) => x.toLowerCase());
    const find = (...keys: string[]) => h.findIndex((x) => keys.some((k) => x.includes(k)));
    const d = find('date'), ds = find('description', 'details', 'narrative', 'payee', 'merchant', 'memo'), a = find('amount');
    const out = find('debit', 'withdraw', 'out'), inn = find('credit', 'deposit', 'in');
    if (d >= 0) setDateCol(d);
    if (ds >= 0) setDescCol(ds);
    if (a >= 0) { setAmtCol(a); setMode('signed'); } else if (out >= 0 && inn >= 0) { setOutCol(out); setInCol(inn); setMode('split'); }
    const sample = parsed[1]?.[d >= 0 ? d : 0] ?? '';
    if (/^\d{4}-/.test(sample)) setFmt('YYYY-MM-DD');
  }

  const acc = accounts.find((a) => a.id === accountId);
  const preview = useMemo(() => {
    const data = header ? rows.slice(1) : rows;
    return data.map((r) => {
      const date = parseDate(r[dateCol] ?? '', fmt);
      let v: number | null;
      if (mode === 'signed') v = parseSigned(r[amtCol] ?? '', decComma);
      else {
        const o = parseSigned(r[outCol] ?? '', decComma), i = parseSigned(r[inCol] ?? '', decComma);
        v = o || i ? (i ?? 0) - Math.abs(o ?? 0) : null;
      }
      if (v != null && flip) v = -v;
      return { date, v, desc: (r[descCol] ?? '').trim() };
    });
  }, [rows, header, dateCol, descCol, mode, amtCol, outCol, inCol, fmt, flip, decComma]);
  const valid = preview.filter((p) => p.date && p.v);
  const cols = (rows[0] ?? []).map((c, i) => [i, header ? c || `Column ${i + 1}` : `Column ${i + 1} (${c.slice(0, 14)})`] as const);

  async function doImport() {
    if (!acc) return alert('Choose an account.');
    const existing = new Set(txns.filter((t) => t.accountId === acc.id).map((t) => `${t.date}|${t.amount}|${t.type}|${(t.payee ?? '').toLowerCase()}`));
    const out: Txn[] = [];
    let dupes = 0;
    for (const p of valid) {
      const amount = Math.round(Math.abs(p.v!) * scale(acc.currency));
      const type = p.v! < 0 ? 'expense' : 'income';
      const key = `${p.date}|${amount}|${type}|${p.desc.toLowerCase()}`;
      if (existing.has(key)) { dupes++; continue; }
      existing.add(key);
      out.push({ type, date: p.date!, amount, currency: acc.currency, accountId: acc.id!, categoryId: type === 'expense' ? expCat : incCat, payee: p.desc || undefined, tags: ['imported'] });
    }
    await db.transactions.bulkAdd(out);
    toast(`Imported ${out.length}${dupes ? `, skipped ${dupes} duplicates` : ''}`);
    go('txns');
  }

  const colSelect = (v: number, set: (n: number) => void) => (
    <select value={v} onChange={(e) => set(+e.target.value)}>{cols.map(([i, l]) => <option key={i} value={i}>{l}</option>)}</select>
  );

  return (
    <>
      <TopBar title="Import CSV" back />
      <p className="subtitle">Download a statement as CSV from your bank's website or app, then pick it here. Imported items are tagged #imported so you can find and re-categorise them.</p>
      <label className="btn block" style={{ display: 'block', textAlign: 'center' }}>
        {fileName ? `📄 ${fileName}` : 'Choose CSV file'}
        <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </label>

      {rows.length > 0 && (
        <>
          <div className="section-title"><span>Columns</span></div>
          <div className="list form">
            <Field label="First row is header"><input type="checkbox" className="toggle" checked={header} onChange={(e) => setHeader(e.target.checked)} /></Field>
            <Field label="Date">{colSelect(dateCol, setDateCol)}</Field>
            <Field label="Date format"><select value={fmt} onChange={(e) => setFmt(e.target.value as DateFormat)}>{DATE_FORMATS.map((f) => <option key={f}>{f}</option>)}</select></Field>
            <Field label="Description">{colSelect(descCol, setDescCol)}</Field>
            <Field label="Amounts"><select value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="signed">One column (− = spent)</option><option value="split">Debit & credit columns</option></select></Field>
            {mode === 'signed' ? <Field label="Amount">{colSelect(amtCol, setAmtCol)}</Field> : <>
              <Field label="Money out">{colSelect(outCol, setOutCol)}</Field>
              <Field label="Money in">{colSelect(inCol, setInCol)}</Field>
            </>}
            <Field label="Decimal comma (12,5)"><input type="checkbox" className="toggle" checked={decComma} onChange={(e) => setDecComma(e.target.checked)} /></Field>
            <Field label="Flip signs"><input type="checkbox" className="toggle" checked={flip} onChange={(e) => setFlip(e.target.checked)} /></Field>
          </div>
          <div className="section-title"><span>Into</span></div>
          <div className="list form">
            <Field label="Account"><select value={accountId} onChange={(e) => setAccountId(+e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></Field>
            <Field label="Expenses as"><select value={expCat} onChange={(e) => setExpCat(+e.target.value)}>{expenseCats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></Field>
            <Field label="Income as"><select value={incCat} onChange={(e) => setIncCat(+e.target.value)}>{incomeCats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></Field>
          </div>
          <div className="section-title"><span>Preview · {valid.length} of {preview.length} rows readable</span></div>
          <div className="list plain">
            {preview.slice(0, 8).map((p, i) => (
              <div key={i} className="row" style={{ opacity: p.date && p.v ? 1 : 0.45 }}>
                <div className="grow"><div className="title">{p.desc || '—'}</div><div className="sub">{p.date ?? 'bad date'}</div></div>
                <div className="end">{p.v != null && acc ? <Money v={Math.round(p.v * scale(acc.currency))} c={acc.currency} sign className={p.v > 0 ? 'pos' : ''} /> : <span className="neg small">bad amount</span>}</div>
              </div>
            ))}
          </div>
          <button className="btn block" style={{ marginTop: 16 }} disabled={!valid.length} onClick={doImport}>Import {valid.length} transactions</button>
        </>
      )}
    </>
  );
}
