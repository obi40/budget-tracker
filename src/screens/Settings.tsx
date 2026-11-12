import { useState } from 'react';
import { saveSetting } from '../db/schema';
import { useData } from '../hooks/useData';
import { useUI } from '../hooks/useUI';
import { Field, Seg, Sheet, TopBar } from '../components/ui';
import { PinPad } from '../components/PinPad';
import { CURRENCIES, DEFAULT_RATES, type Currency } from '../lib/money';
import { hashPin } from '../lib/pin';

export function SettingsScreen() {
  const { settings } = useData();
  const { toast } = useUI();
  const [usd, setUsd] = useState(String(settings.rates.USD));
  const [eur, setEur] = useState(String(settings.rates.EUR));
  const [pinStep, setPinStep] = useState<null | 'new' | 'confirm'>(null);
  const [firstPin, setFirstPin] = useState('');

  async function saveRates() {
    const u = Number(usd), e = Number(eur);
    if (!(u > 0) || !(e > 0)) return alert('Rates must be positive numbers.');
    await saveSetting('rates', { JOD: 1, USD: u, EUR: e });
    toast('Rates saved');
  }

  return (
    <>
      <TopBar title="Settings" back />
      <div className="section-title"><span>Currency</span></div>
      <div className="list form">
        <Field label="Main currency"><span style={{ marginLeft: 'auto' }}>JOD (JD)</span></Field>
        <Field label="New items in">
          <Seg value={settings.defaultCurrency} onChange={(v) => saveSetting('defaultCurrency', v)} options={CURRENCIES.map((c) => [c, c] as [Currency, string])} />
        </Field>
        <Field label="1 USD = JD"><input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} onBlur={saveRates} /></Field>
        <Field label="1 EUR = JD"><input inputMode="decimal" value={eur} onChange={(e) => setEur(e.target.value)} onBlur={saveRates} /></Field>
      </div>
      <p className="small muted" style={{ margin: '8px 4px 0' }}>
        Totals, budgets and reports are shown in JD. USD is pegged at 0.709. Update EUR now and then.{' '}
        <button className="btn ghost small" style={{ padding: 0 }} onClick={() => { setUsd(String(DEFAULT_RATES.USD)); setEur(String(DEFAULT_RATES.EUR)); saveSetting('rates', DEFAULT_RATES); }}>Reset</button>
      </p>

      <div className="section-title"><span>Privacy</span></div>
      <div className="list form">
        <Field label="Passcode">
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {settings.pinHash
              ? <><button className="btn small secondary" onClick={() => setPinStep('new')}>Change</button><button className="btn small danger" onClick={async () => { await saveSetting('pinHash', undefined); toast('Passcode off'); }}>Turn off</button></>
              : <button className="btn small" onClick={() => setPinStep('new')}>Turn on</button>}
          </span>
        </Field>
      </div>
      <p className="small muted" style={{ margin: '8px 4px 0' }}>A 4-digit passcode is asked each time the app opens. If you forget it, you'd need to delete the app's data, so keep a backup.</p>

      <div className="section-title"><span>Install on iPhone</span></div>
      <div className="card small">
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Open this page in <b>Safari</b>.</li>
          <li>Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</li>
          <li>Always open Budget from its Home Screen icon. It works offline.</li>
        </ol>
      </div>
      <p className="small muted" style={{ textAlign: 'center', marginTop: 20 }}>Budget v1.0 · data stored on this device only</p>

      {pinStep && (
        <Sheet title="Passcode" onClose={() => setPinStep(null)}>
          <PinPad key={pinStep} title={pinStep === 'new' ? 'Choose a 4-digit passcode' : 'Enter it again'} onDone={async (p) => {
            if (pinStep === 'new') { setFirstPin(p); setPinStep('confirm'); return true; }
            if (p !== firstPin) { setPinStep('new'); toast("Passcodes didn't match"); return false; }
            await saveSetting('pinHash', await hashPin(p)); setPinStep(null); toast('Passcode on'); return true;
          }} />
        </Sheet>
      )}
    </>
  );
}
