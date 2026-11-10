// All amounts are stored as integers in the currency's smallest unit
// (fils for JOD = 1/1000, cents for USD/EUR = 1/100) so sums never drift.

export type Currency = 'JOD' | 'USD' | 'EUR';
export const CURRENCIES: Currency[] = ['JOD', 'USD', 'EUR'];
export const BASE: Currency = 'JOD';

export const DECIMALS: Record<Currency, number> = { JOD: 3, USD: 2, EUR: 2 };
export const SYMBOL: Record<Currency, string> = { JOD: 'JD', USD: '$', EUR: '€' };

/** Value of 1 unit of each currency, in JOD. */
export type Rates = Record<Currency, number>;
export const DEFAULT_RATES: Rates = { JOD: 1, USD: 0.709, EUR: 0.77 };

export const scale = (c: Currency) => 10 ** DECIMALS[c];
export const fromMinor = (minor: number, c: Currency) => minor / scale(c);

/** Parse user text like "12.5", "1,250.75" into minor units. Returns null if invalid. */
export function parseAmount(text: string, c: Currency): number | null {
  const s = text.trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)) // Arabic-Indic digits
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)) // Persian digits
    .replace(/[,\s٬]/g, '').replace('٫', '.');
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) return null;
  const d = DECIMALS[c];
  const frac = (m[2] ?? '').slice(0, d).padEnd(d, '0');
  return Number(m[1] || '0') * scale(c) + Number(frac || '0');
}

/** Minor units → plain editable text ("12.500" → "12.5"). */
export function toInput(minor: number, c: Currency): string {
  if (!minor) return '';
  return String(+fromMinor(minor, c).toFixed(DECIMALS[c]));
}

export function convert(minor: number, from: Currency, to: Currency, rates: Rates): number {
  if (from === to) return minor;
  const inBase = fromMinor(minor, from) * rates[from];
  return Math.round((inBase / rates[to]) * scale(to));
}
export const toBase = (minor: number, from: Currency, rates: Rates) => convert(minor, from, BASE, rates);

const fmtCache = new Map<string, Intl.NumberFormat>();
function nf(d: number, compact: boolean) {
  const k = `${d}${compact}`;
  if (!fmtCache.has(k))
    fmtCache.set(k, new Intl.NumberFormat('en-US', compact
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { minimumFractionDigits: d, maximumFractionDigits: d }));
  return fmtCache.get(k)!;
}

export function format(minor: number, c: Currency = BASE, opts: { sign?: boolean; compact?: boolean } = {}): string {
  const v = fromMinor(Math.abs(minor), c);
  const num = nf(DECIMALS[c], !!opts.compact).format(v);
  const body = c === 'JOD' ? `JD ${num}` : `${SYMBOL[c]}${num}`;
  if (minor < 0) return `−${body}`;
  if (opts.sign && minor > 0) return `+${body}`;
  return body;
}
