import { useState } from 'react';
import type { Entry, Template } from '../lib/engine';
import { Sheet } from '../ui';

const FACTORS: [number, string][] = [
  [0.5, '½'],
  [0.75, '¾'],
  [1, '1'],
  [1.5, '1½'],
  [2, '2'],
];

const r1 = (n: number) => Math.round(n * 10) / 10;
const label = (f: number) => (f === 1 ? '1 Portion' : `${String(f).replace('.', ',')} Portionen`);

/** Entry mit einem anderen Portionsfaktor der Standardmahlzeit, ohne neu zu wiegen. */
export function scaleEntry(e: Entry, t: Template, factor: number): Entry {
  return {
    ...e,
    kcal: Math.round(t.kcal * factor),
    p: r1(t.p * factor),
    c: r1(t.c * factor),
    f: r1(t.f * factor),
    amount: label(factor),
  };
}

export default function PortionSheet({ entry, template, onApply, onDelete, onClose }: {
  entry: Entry;
  template: Template;
  onApply: (e: Entry) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const current = template.kcal > 0 ? Math.round((entry.kcal / template.kcal) * 4) / 4 : 1;
  const [factor, setFactor] = useState(current || 1);
  const preview = scaleEntry(entry, template, factor);
  return (
    <Sheet title={template.name} onClose={onClose}>
      <p className="xs muted">
        1 Portion = {template.kcal} kcal · {template.p} g Protein · {template.c} g Carbs · {template.f} g Fett
      </p>
      <div className="seg" role="group" aria-label="Portionen">
        {FACTORS.map(([f, l]) => (
          <button key={f} className={factor === f ? 'on' : ''} onClick={() => setFactor(f)} style={{ padding: '10px 6px', borderRadius: 999, font: '500 13px/18px var(--font-body)', color: factor === f ? 'var(--ink)' : 'var(--muted)', background: factor === f ? 'var(--card)' : 'none', boxShadow: factor === f ? 'var(--shadow-edge)' : 'none', textAlign: 'center', minHeight: 44 }}>
            {l}
          </button>
        ))}
      </div>
      <div className="row between">
        <span className="strong">{label(factor)}</span>
        <span className="mono" style={{ fontSize: 28 }}>{preview.kcal} kcal</span>
      </div>
      <button className="s6-btn s6-btn-primary w" onClick={() => onApply(preview)}>Übernehmen</button>
      <button className="s6-btn s6-btn-quiet w danger-b" onClick={onDelete}>Eintrag löschen</button>
    </Sheet>
  );
}
