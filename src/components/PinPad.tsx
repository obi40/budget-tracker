import { useEffect, useState } from 'react';

/** iOS-style passcode pad. Calls onDone with the entered PIN; return false to shake and clear. */
export function PinPad({ title, length = 4, onDone, footer }: { title: string; length?: number; onDone: (pin: string) => Promise<boolean> | boolean; footer?: React.ReactNode }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length !== length) return;
    Promise.resolve(onDone(pin)).then((ok) => {
      if (!ok) { setShake(true); setTimeout(() => { setShake(false); setPin(''); }, 420); }
      else setPin('');
    });
  }, [pin, length, onDone]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < length ? p + e.key : p));
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [length]);

  const press = (d: string) => setPin((p) => (p.length < length ? p + d : p));
  return (
    <div className="lock">
      <div style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
      <div className={`dots${shake ? ' shake' : ''}`}>{Array.from({ length }, (_, i) => <i key={i} className={i < pin.length ? 'on' : ''} />)}</div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <button className="blank" aria-hidden tabIndex={-1} />
        <button onClick={() => press('0')}>0</button>
        <button className="text" onClick={() => setPin((p) => p.slice(0, -1))}>Delete</button>
      </div>
      {footer}
    </div>
  );
}
