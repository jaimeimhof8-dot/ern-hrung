import { useState } from 'react';
import { calcNeeds, toISO, type Sex } from '../lib/engine';
import { num, type Update } from '../ui';

export default function Onboarding({ update }: { update: Update }) {
  const [sex, setSex] = useState<Sex>('m');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [w, setW] = useState('');
  const [goal, setGoal] = useState('');

  const a = num(age);
  const h = num(height);
  const weight = num(w);
  const ok = !!a && !!h && !!weight && a >= 14 && a <= 99 && h >= 120 && h <= 230 && weight >= 30 && weight <= 250;
  const preview = ok ? calcNeeds({ sex, age: a!, heightCm: h!, weightKg: weight!, bodyFatPercent: 17, bfKnown: false, activity: 1.55 }) : null;

  const start = () => {
    if (!ok) return;
    const g = num(goal) ?? Math.round((weight! - 3) * 2) / 2;
    update((p) => ({
      ...p,
      settings: {
        ...p.settings,
        onboarded: true,
        sex,
        age: a,
        heightCm: h,
        weightKg: weight!,
        goalKg: g,
        bodyFatPercent: sex === 'm' ? 17 : 25,
        tdee: preview!.tdee,
      },
      weights: { ...p.weights, [toISO(new Date())]: weight! },
    }));
  };

  const field = (label: string, v: string, set: (s: string) => void, ph: string, unit?: string, mode: 'numeric' | 'decimal' = 'decimal') => (
    <label className="f">
      <span>{label}</span>
      <div className="in"><input inputMode={mode} value={v} onChange={(e) => set(e.target.value)} placeholder={ph} />{unit && <span className="u">{unit}</span>}</div>
    </label>
  );

  return (
    <div className="app onboard">
      <div>
        <div className="ov" style={{ color: 'var(--accent-ink)' }}>Basel Sub-60 · Ernährung</div>
        <h1 className="ttl">Abnehmen.<br />Einfach tracken.</h1>
      </div>
      <p className="muted body">Die App rechnet deinen Kalorienbedarf, liest deinen Trainingsplan und zeigt dir jeden Tag, ob du abnimmst.</p>
      <div className="seg" role="group" aria-label="Geschlecht">
        {(['m', 'w'] as Sex[]).map((x) => (
          <button key={x} className={sex === x ? 'on' : ''} onClick={() => setSex(x)} style={{ textAlign: 'center', padding: '10px 6px', minHeight: 44, borderRadius: 999, font: '500 13px/18px var(--font-body)', color: sex === x ? 'var(--ink)' : 'var(--muted)', background: sex === x ? 'var(--card)' : 'none', boxShadow: sex === x ? 'var(--shadow-edge)' : 'none', fontWeight: sex === x ? 600 : 500 }}>
            {x === 'm' ? 'Männlich' : 'Weiblich'}
          </button>
        ))}
      </div>
      <div className="cols2">
        {field('Alter', age, setAge, '30', undefined, 'numeric')}
        {field('Grösse', height, setHeight, '180', 'cm', 'numeric')}
        {field('Gewicht', w, setW, '80', 'kg')}
        {field('Zielgewicht', goal, setGoal, weight ? String(weight - 3) : '77', 'kg')}
      </div>
      {preview && (
        <div className="banner">
          <div>Dein Gesamtumsatz: <b className="num">≈ {preview.tdee} kcal</b> pro Tag</div>
        </div>
      )}
      <button className="s6-btn s6-btn-primary w" disabled={!ok} onClick={start}>Los geht’s</button>
      <p className="muted xs center">Körperfett, Aktivität und Tempo stellst du später im Profil ein. Alle Daten bleiben auf deinem Gerät.</p>
    </div>
  );
}
