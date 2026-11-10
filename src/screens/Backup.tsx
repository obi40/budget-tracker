import { useEffect, useState } from 'react';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { eraseAll, exportJSON, exportTransactionsCSV, importJSON, markBackedUp, shareOrDownload } from '../db/actions';
import { seedIfEmpty } from '../db/seed';
import { TopBar } from '../components/ui';
import { todayISO } from '../lib/dates';

export function Backup() {
  const { settings, txns } = useData();
  const { toast } = useUI();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => {}); }, []);

  async function backup() {
    const ok = await shareOrDownload(`budget-backup-${todayISO()}.json`, await exportJSON(), 'application/json');
    if (ok) { await markBackedUp(); toast('Backup saved'); }
  }
  async function csv() {
    await shareOrDownload(`budget-transactions-${todayISO()}.csv`, await exportTransactionsCSV(), 'text/csv');
  }
  async function restore(f: File | undefined) {
    if (!f) return;
    if (!confirm('Restoring replaces ALL data on this phone with the backup. Continue?')) return;
    try { await importJSON(await f.text()); toast('Backup restored'); }
    catch (e) { alert((e as Error).message || 'Could not read that file.'); }
  }
  async function erase() {
    if (!confirm('Erase everything? This cannot be undone. Make a backup first.')) return;
    if (prompt('Type ERASE to confirm') !== 'ERASE') return;
    await eraseAll(); await seedIfEmpty(); toast('All data erased');
  }

  return (
    <>
      <TopBar title="Backup & export" back />
      <div className="card">
        <div className="title" style={{ fontWeight: 600 }}>💾 Full backup</div>
        <p className="small muted" style={{ margin: '4px 0 12px' }}>
          Your data lives only on this phone. Save a backup to Files or iCloud Drive now and then, so a lost phone doesn't mean lost history.
          {settings.lastBackup ? ` Last backup: ${new Date(settings.lastBackup).toLocaleDateString()}.` : ' No backup yet.'}
        </p>
        <button className="btn block" onClick={backup}>Save backup</button>
        <label className="btn secondary block" style={{ display: 'block', textAlign: 'center', marginTop: 10 }}>
          Restore from backup
          <input type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </label>
      </div>
      <div className="card">
        <div className="title" style={{ fontWeight: 600 }}>📊 Export to Excel / Numbers</div>
        <p className="small muted" style={{ margin: '4px 0 12px' }}>All {txns.length} transactions as a CSV spreadsheet.</p>
        <button className="btn secondary block" onClick={csv}>Export CSV</button>
      </div>
      <div className="card">
        <div className="small muted">
          Storage protection: {persisted == null ? 'unknown' : persisted ? '✅ on (won\'t be cleared automatically)' : 'not granted yet. Open the app from your Home Screen icon.'}
        </div>
      </div>
      <button className="btn danger block" style={{ marginTop: 24 }} onClick={erase}>Erase all data</button>
    </>
  );
}
