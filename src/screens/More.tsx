import { useData } from '../hooks/useData';
import { useUI, type Page } from '../hooks/useUI';
import { Icon, Money, TopBar } from '../components/ui';
import { netWorth } from '../lib/stats';

const ITEMS: [Page, string, string, string][] = [
  ['accounts', '🏦', 'Accounts', 'Balances and net worth'],
  ['recurring', '🔁', 'Recurring & bills', 'Rent, salary, subscriptions'],
  ['goals', '🎯', 'Savings goals', 'Save towards targets'],
  ['debts', '💳', 'Debts', 'Loans and payoff plans'],
  ['categories', '🏷️', 'Categories', 'Edit, add, colours'],
];
const DATA: [Page, string, string, string][] = [
  ['import', '📥', 'Import bank CSV', 'From your bank statement'],
  ['backup', '💾', 'Backup & export', 'Save a copy, Excel export'],
  ['settings', '⚙️', 'Settings', 'Currency rates, passcode, theme'],
];

export function More() {
  const { go } = useUI();
  const { accounts, txns, settings } = useData();
  const list = (items: typeof ITEMS) => (
    <div className="list">
      {items.map(([p, e, t, s]) => (
        <button key={p} className="row" onClick={() => go('more', p)}>
          <div className="badge" style={{ background: 'var(--accent-soft)' }}>{e}</div>
          <div className="grow"><div className="title">{t}</div><div className="sub">{s}</div></div>
          {p === 'accounts' && <Money v={netWorth(accounts, txns, settings.rates)} className="muted small" />}
          <span className="chev"><Icon name="chev" size={18} /></span>
        </button>
      ))}
    </div>
  );
  return (
    <>
      <TopBar title="More" />
      {list(ITEMS)}
      <div className="section-title"><span>Data</span></div>
      {list(DATA)}
      <p className="small muted" style={{ textAlign: 'center', marginTop: 24 }}>Your data stays on this phone. Back up regularly.</p>
    </>
  );
}
