import { useCallback, useEffect, useRef, useState } from 'react';
import { DataProvider, useData } from './hooks/useData';
import { UICtx, type Page, type Tab } from './hooks/useUI';
import type { Txn } from './db/types';
import { seedIfEmpty } from './db/seed';
import { processRecurring } from './db/actions';
import { hashPin } from './lib/pin';
import { Icon } from './components/ui';
import { TxnSheet } from './components/TxnSheet';
import { PinPad } from './components/PinPad';
import { Home } from './screens/Home';
import { Transactions } from './screens/Transactions';
import { BudgetScreen } from './screens/Budget';
import { Reports } from './screens/Reports';
import { More } from './screens/More';
import { Accounts } from './screens/Accounts';
import { Categories } from './screens/Categories';
import { RecurringScreen } from './screens/Recurring';
import { Goals } from './screens/Goals';
import { Debts } from './screens/Debts';
import { ImportCsv } from './screens/ImportCsv';
import { Backup } from './screens/Backup';
import { SettingsScreen } from './screens/Settings';

export function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      await processRecurring();
      setReady(true);
      // Ask the browser not to evict our data (iOS honours this for home-screen apps).
      navigator.storage?.persist?.().catch(() => {});
    })();
    // Re-run recurring when the app comes back to the foreground on a new day.
    const vis = () => document.visibilityState === 'visible' && processRecurring();
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);
  if (!ready) return null;
  return <DataProvider fallback={null}><Shell /></DataProvider>;
}

const TABS: [Tab, string, string][] = [
  ['home', 'Summary', 'house'], ['txns', 'Activity', 'activity'], ['budget', 'Budget', 'pie'], ['reports', 'Reports', 'bars'], ['more', 'More', 'ellipsis'],
];

function Shell() {
  const { settings } = useData();
  const [tab, setTab] = useState<Tab>('home');
  const [page, setPage] = useState<Page | null>(null);
  const [sheet, setSheet] = useState<{ txn?: Partial<Txn> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const timer = useRef<number>();

  // iOS keeps home-screen apps in memory, so re-lock after a minute in the background.
  useEffect(() => {
    if (!settings.pinHash) return;
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) { setUnlocked(false); setSheet(null); }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [settings.pinHash]);

  const go = useCallback((t: Tab, p: Page | null = null) => { setTab(t); setPage(p); window.scrollTo(0, 0); }, []);
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 1800); }, []);
  const openTxn = useCallback((txn?: Partial<Txn>) => setSheet({ txn }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const unlock = useCallback(async (pin: string) => {
    const ok = (await hashPin(pin)) === settings.pinHash;
    if (ok) setUnlocked(true);
    return ok;
  }, [settings.pinHash]);

  if (settings.pinHash && !unlocked) return <PinPad title="Enter passcode" onDone={unlock} />;

  let screen;
  if (tab === 'more' && page) {
    screen = {
      accounts: <Accounts />, categories: <Categories />, recurring: <RecurringScreen />, goals: <Goals />,
      debts: <Debts />, import: <ImportCsv />, backup: <Backup />, settings: <SettingsScreen />,
    }[page];
  } else {
    screen = { home: <Home />, txns: <Transactions />, budget: <BudgetScreen />, reports: <Reports />, more: <More /> }[tab];
  }

  return (
    <UICtx.Provider value={{ tab, page, go, openTxn, toast }}>
      <div className="app">
        <main className="screen" key={`${tab}/${page}`}>{screen}</main>
        <div className="dock-fade" aria-hidden />
        {/* Tabs only navigate; the add action floats beside them (tab-bars.md › Best practices). */}
        <nav className="dock" aria-label="Main">
          <div className="tabbar glass" role="tablist">
            {TABS.map(([t, label, icon]) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
                <Icon name={icon} size={25} /><span>{label}</span>
              </button>
            ))}
          </div>
          <button className="fab" aria-label="Add transaction" onClick={() => openTxn()}><Icon name="plus" size={28} stroke={2.6} /></button>
        </nav>
        {sheet && <TxnSheet initial={sheet.txn} onClose={closeSheet} />}
        {msg && <div className="toast glass" role="status">{msg}</div>}
      </div>
    </UICtx.Provider>
  );
}
