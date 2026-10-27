import { useEffect, useRef, useState, type ReactNode } from 'react';
import { parseISO, type Data, type Meal } from './lib/engine';

export type Update = (f: (p: Data) => Data) => void;
export type ToastAction = { label: string; run: () => void };
export type Notify = (text: string, actions?: ToastAction[]) => void;

export const TYPE_CLASS = { WPF_LOW: 'low', MODERATE: 'mod', HIGH_PERFORMANCE: 'high' } as const;
export const TYPE_COLOR = { WPF_LOW: 'var(--lauf)', MODERATE: 'var(--kraft)', HIGH_PERFORMANCE: 'var(--station)' } as const;

export const num = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
export const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export const longDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('de-CH', { day: 'numeric', month: 'short' });

export type IconName = 'today' | 'week' | 'chart' | 'user' | 'plus' | 'l' | 'r' | 'x' | 'check' | 'search' | 'scale' | 'star' | 'drop' | 'copy';
export const Icon = ({ n, s }: { n: IconName; s?: boolean }) => <i className={`ic ${s ? 's' : ''} i-${n}`} aria-hidden />;

/** Kopfzeile wie in der Trainings-App: Kicker, grosser Titel, runde Knöpfe. */
export function Head({ kicker, title, prev, next }: { kicker: string; title: string; prev?: [string, () => void]; next?: [string, () => void] }) {
  return (
    <header className="hd">
      <div>
        <div className="ov">{kicker}</div>
        <h1 className="ttl">{title}</h1>
      </div>
      {(prev || next) && (
        <div className="cbs">
          {prev && <button className="cb" onClick={prev[1]} aria-label={prev[0]}><Icon n="l" /></button>}
          {next && <button className="cb" onClick={next[1]} aria-label={next[0]}><Icon n="r" /></button>}
        </div>
      )}
    </header>
  );
}

/** Bottom-Sheet mit Escape, Hintergrund-Klick und Fokus auf dem ersten Feld. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sh-h">
          <span className="ttl-s">{title}</span>
          <button className="x" onClick={onClose} aria-label="Schliessen"><Icon n="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Ring: Anteil gegessen vom Ziel, Mitte zeigt, was übrig ist. */
export function Ring({ value, target, color }: { value: number; target: number; color: string }) {
  const c = 364.4;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const left = Math.round(target - value);
  const over = left < 0;
  return (
    <div className="s6-ring" style={{ '--c': over ? 'var(--danger)' : color } as React.CSSProperties} role="img" aria-label={over ? `${-left} kcal über dem Ziel` : `${left} kcal übrig`}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle className="s6-ring-track" cx="66" cy="66" r="58" fill="none" strokeWidth="10" />
        <circle className="s6-ring-bar" cx="66" cy="66" r="58" fill="none" strokeWidth="10" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div className="s6-ring-in">
        <div className="s6-ring-val">{Math.abs(left)}</div>
        <div className="s6-ring-label">{over ? 'drüber' : 'übrig'}</div>
      </div>
    </div>
  );
}

export function Macro({ label, value, target, unit = 'g', color }: { label: string; value: number; target: number; unit?: string; color?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="mb" style={color ? ({ '--c': color } as React.CSSProperties) : undefined}>
      <div className="row between xs">
        <span>{label}</span>
        <span className="muted">{Math.round(value)} / {Math.round(target)} {unit}</span>
      </div>
      <div className="trk"><div className="fil" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function NumField({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="f">
      <span>{label}</span>
      <div className="in">
        <input
          inputMode="decimal"
          defaultValue={value ?? ''}
          key={value ?? 'leer'}
          onBlur={(e) => onChange(e.target.value.trim() === '' ? undefined : num(e.target.value))}
        />
        {suffix && <span className="u">{suffix}</span>}
      </div>
      {hint && <small className="xs muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{hint}</small>}
    </label>
  );
}

/** Gewicht eintragen: grosse Zahl, Feinstellung mit ± 0,1. */
export function WeighSheet({ date, initial, onSave, onClose }: { date: string; initial: number; onSave: (kg: number) => void; onClose: () => void }) {
  const [v, setV] = useState(fmt(initial));
  const kg = num(v);
  const step = (d: number) => setV(fmt(Math.round(((kg ?? initial) + d) * 10) / 10));
  const ok = !!kg && kg >= 30 && kg <= 250;
  return (
    <Sheet title="Gewicht eintragen" onClose={onClose}>
      <div className="xs muted">{longDate(date)}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
        <button className="stepper" onClick={() => step(-0.1)} aria-label="0,1 kg weniger">−</button>
        <div className="in big-in" style={{ flex: 1 }}>
          <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} aria-label="Gewicht in kg" onFocus={(e) => e.target.select()} />
          <span className="u">kg</span>
        </div>
        <button className="stepper" onClick={() => step(0.1)} aria-label="0,1 kg mehr">+</button>
      </div>
      <p className="xs muted">Morgens nüchtern, zwei- bis dreimal pro Woche. Einzelne Tage schwanken, der Trend zählt.</p>
      <button className="s6-btn s6-btn-primary w" disabled={!ok} onClick={() => kg && onSave(kg)}>Speichern</button>
    </Sheet>
  );
}

/** Passende Mahlzeit zur Uhrzeit für den schnellen Plus-Knopf. */
export function mealByClock(): Meal {
  const h = new Date().getHours();
  return h < 10 ? 'fruehstueck' : h < 15 ? 'mittag' : h < 17 ? 'snack' : h < 21 ? 'abend' : 'snack';
}

export function Metric({ label, value, unit, small }: { label: string; value: string; unit?: string; small?: boolean }) {
  return (
    <div className="s6-metric" style={small ? { padding: 12 } : undefined}>
      <div className="s6-metric-label">{label}</div>
      <div className="s6-metric-value">{value}{unit && <span className="s6-metric-unit">{unit}</span>}</div>
    </div>
  );
}
