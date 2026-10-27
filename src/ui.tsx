import { useEffect, useRef, type ReactNode } from 'react';
import { parseISO, type Data, type Meal } from './lib/engine';

export type Update = (f: (p: Data) => Data) => void;

export const TYPE_CLASS = { WPF_LOW: 'low', MODERATE: 'mod', HIGH_PERFORMANCE: 'high' } as const;

export const num = (v: string): number | undefined => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export const longDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
export const shortDate = (iso: string) =>
  parseISO(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

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
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Ring: Anteil gegessen vom Ziel, Mitte zeigt, was übrig ist. */
export function Ring({ value, target }: { value: number; target: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const left = Math.round(target - value);
  const over = left < 0;
  return (
    <div className={`ring ${over ? 'over' : ''}`} role="img" aria-label={over ? `${-left} kcal über dem Ziel` : `${left} kcal übrig`}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="ring-bg" />
        <circle cx="60" cy="60" r={r} className="ring-fg" strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 60 60)" />
      </svg>
      <div className="ring-mid">
        <strong>{Math.abs(left)}</strong>
        <span>{over ? 'drüber' : 'übrig'}</span>
      </div>
    </div>
  );
}

export function Bar({ label, value, target, unit = 'g' }: { label: string; value: number; target: number; unit?: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="mbar">
      <div className="row between small">
        <span>{label}</span>
        <span className="muted">{Math.round(value)} / {Math.round(target)} {unit}</span>
      </div>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
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
    <label className="field">
      <span>{label}{suffix ? ` (${suffix})` : ''}</span>
      <input
        inputMode="decimal"
        defaultValue={value ?? ''}
        key={value ?? 'leer'}
        onBlur={(e) => onChange(e.target.value.trim() === '' ? undefined : num(e.target.value))}
      />
      {hint && <small className="muted">{hint}</small>}
    </label>
  );
}

/** Passende Mahlzeit zur Uhrzeit für den schnellen Plus-Knopf. */
export function mealByClock(): Meal {
  const h = new Date().getHours();
  return h < 10 ? 'fruehstueck' : h < 15 ? 'mittag' : h < 17 ? 'snack' : h < 21 ? 'abend' : 'snack';
}
