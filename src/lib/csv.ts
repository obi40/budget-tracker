// Small RFC-4180 CSV reader/writer plus helpers for bank-statement import.

export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = [',', ';', '\t'].map((d) => [d, line.split(d).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCSV(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCSV = (rows: unknown[][]) => rows.map((r) => r.map(esc).join(',')).join('\r\n');

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
export const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'];

/** Parse a bank date into YYYY-MM-DD, or null. Accepts / - . separators and 2-digit years. */
export function parseDate(s: string, fmt: DateFormat): string | null {
  const parts = s.trim().split(/[\s T]/)[0].split(/[/.\-]/).map((p) => p.trim());
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  let y: number, m: number, d: number;
  if (fmt === 'YYYY-MM-DD') [y, m, d] = parts.map(Number);
  else if (fmt === 'DD/MM/YYYY') [d, m, y] = parts.map(Number);
  else [m, d, y] = parts.map(Number);
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * "1,234.50", "-12", "(12.00)", "12.00-", "JD 5" → signed major-unit number, or null.
 * With decimalComma (European/semicolon files) "1.234,56" and "12,5" use the comma as the decimal point.
 */
export function parseSigned(s: string, decimalComma = false): number | null {
  let t = s.trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1); }
  t = t.replace(/[^\d.,\-]/g, '');
  if (t.startsWith('-')) { neg = !neg; t = t.slice(1); }
  const europeanBoth = t.includes('.') && t.includes(',') && t.lastIndexOf(',') > t.lastIndexOf('.');
  if (decimalComma || europeanBoth) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/,/g, '');
  const n = Number(t);
  if (!t || Number.isNaN(n)) return null;
  return neg ? -n : n;
}
