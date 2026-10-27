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

  return (
    <div className="app onboard">
      <p className="kicker">Basel Sub-60 · Ernährung</p>
      <h1>Abnehmen. Einfach tracken.</h1>
      <p className="lead">
        Die App berechnet deinen Kalorienbedarf, liest deinen Trainingsplan und zeigt dir jeden Tag, ob du abnimmst. Vier Angaben genügen.
      </p>
      <div className="pills" role="group" aria-label="Geschlecht">
        <button className={`pill ${sex === 'm' ? 'on' : ''}`} onClick={() => setSex('m')}>Männlich</button>
        <button className={`pill ${sex === 'w' ? 'on' : ''}`} onClick={() => setSex('w')}>Weiblich</button>
      </div>
      <div className="grid2">
        <label className="field"><span>Alter</span><input inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" /></label>
        <label className="field"><span>Größe (cm)</span><input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="180" /></label>
        <label className="field"><span>Gewicht (kg)</span><input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="80" /></label>
        <label className="field"><span>Zielgewicht (kg)</span><input inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={weight ? String(weight - 3) : '77'} /></label>
      </div>
      {preview && (
        <p className="preview">
          Dein Gesamtumsatz: <strong>≈ {preview.tdee} kcal</strong> pro Tag
        </p>
      )}
      <button className="primary" disabled={!ok} onClick={start}>Los geht’s</button>
      <p className="muted small">Alle Daten bleiben auf deinem Gerät. Körperfett, Aktivität und Tempo stellst du später im Profil ein.</p>
    </div>
  );
}
