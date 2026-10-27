import { useMemo, useState } from 'react';
import {
  DEFAULT_DATA,
  addDays,
  calcNeeds,
  computeDay,
  currentWeight,
  isProtected,
  toISO,
  weekDeficitKg,
  type Data,
  type Sex,
  type Settings,
} from '../lib/engine';
import { parseBackup, toCsv } from '../lib/storage';
import { NumField, type Update } from '../ui';

const ACTIVITY: [number, string][] = [
  [1.2, 'Kaum Bewegung (Büro, wenig Sport)'],
  [1.375, 'Leicht aktiv (1–3 Einheiten pro Woche)'],
  [1.55, 'Aktiv (3–5 Einheiten pro Woche)'],
  [1.725, 'Sehr aktiv (6–7 Einheiten pro Woche)'],
  [1.9, 'Extrem (Leistungssport oder körperliche Arbeit)'],
];
const RATES: [number, string][] = [
  [0.2, 'Sanft'],
  [0.3, 'Standard'],
  [0.45, 'Zügig'],
  [0.6, 'Hart'],
];

const fmt = (n: number, d = 2) => n.toFixed(d).replace('.', ',');

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Profile({ data, update }: { data: Data; update: Update }) {
  const s = data.settings;
  const today = toISO(new Date());
  const weight = currentWeight(today, data);
  const set = (patch: Partial<Settings>) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const [armed, setArmed] = useState(false);
  const [msg, setMsg] = useState('');

  const needs = useMemo(
    () => (s.age && s.heightCm ? calcNeeds({ ...s, age: s.age, heightCm: s.heightCm, weightKg: weight }) : null),
    [s, weight],
  );

  // erwartete Abnahme laut Plan für die nächsten 7 Tage mit den aktuellen Einstellungen
  const expected = useMemo(() => {
    const plans = Array.from({ length: 7 }, (_, i) => computeDay(addDays(today, i), data));
    return { kg: weekDeficitKg(plans), avg: Math.round(plans.reduce((a, p) => a + p.kcal, 0) / 7) };
  }, [data, today]);

  const protectedNow = isProtected(today, s);

  const importData = async (f: File) => {
    const d = parseBackup(await f.text());
    if (d) {
      update(() => d);
      setMsg('Backup geladen.');
    } else setMsg('Datei konnte nicht gelesen werden.');
  };

  return (
    <>
      <h1 className="pagetitle">Profil</h1>

      <section className="card">
        <h2>Kalorienbedarf</h2>
        <div className="pills" role="group" aria-label="Geschlecht">
          {(['m', 'w'] as Sex[]).map((x) => (
            <button key={x} className={`pill ${s.sex === x ? 'on' : ''}`} onClick={() => set({ sex: x })}>{x === 'm' ? 'Männlich' : 'Weiblich'}</button>
          ))}
        </div>
        <div className="grid2">
          <NumField label="Alter" value={s.age} onChange={(v) => v && set({ age: Math.round(v) })} />
          <NumField label="Größe" suffix="cm" value={s.heightCm} onChange={(v) => v && set({ heightCm: Math.round(v) })} />
          <NumField label="Zielgewicht" suffix="kg" value={s.goalKg} onChange={(v) => v && set({ goalKg: v })} />
          <NumField label="Körperfett" suffix="%" value={s.bodyFatPercent} onChange={(v) => v && set({ bodyFatPercent: v, bfKnown: true })} hint={s.bfKnown ? 'Wird für die Berechnung genutzt' : 'Schätzung, noch nicht genutzt'} />
        </div>
        <label className="field">
          <span>Aktivität</span>
          <select value={s.activity} onChange={(e) => set({ activity: parseFloat(e.target.value) })}>
            {ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {s.bfKnown && (
          <button className="link small" onClick={() => set({ bfKnown: false })}>Körperfett ignorieren (Mifflin-St Jeor nutzen)</button>
        )}

        {needs ? (
          <div className="result" aria-live="polite">
            <div><span>Grundumsatz</span><strong>{needs.bmr} kcal</strong></div>
            <div><span>Gesamtumsatz</span><strong>{s.tdeeOverride ?? needs.tdee} kcal</strong></div>
            <p className="muted small">Formel: {needs.method}. Der Trainingsplan hebt oder senkt das Tagesziel zusätzlich nach Belastung.</p>
          </div>
        ) : (
          <p className="warn-text small pad">Trage Alter und Größe ein, dann berechnet die App deinen Bedarf.</p>
        )}
        <NumField label="Gesamtumsatz selbst festlegen (optional)" suffix="kcal" value={s.tdeeOverride} onChange={(v) => set({ tdeeOverride: v ? Math.round(v) : undefined })} hint="Leer lassen für die automatische Berechnung" />
      </section>

      <section className="card">
        <h2>Abnahme-Tempo</h2>
        <div className="pills tight" role="group" aria-label="Tempo">
          {RATES.map(([r, l]) => (
            <button key={r} className={`pill sm ${s.ratePerWeek === r ? 'on' : ''}`} onClick={() => set({ ratePerWeek: r })}>
              {l}<small>{fmt(r)} kg</small>
            </button>
          ))}
        </div>
        <div className="result">
          <div><span>Ø Tagesziel (nächste 7 Tage)</span><strong>{expected.avg} kcal</strong></div>
          <div><span>Erwartete Abnahme</span><strong>≈ {fmt(expected.kg)} kg pro Woche</strong></div>
          <p className="muted small">
            An harten Trainingstagen isst du bewusst auf Erhaltung. Die App senkt die Kalorien nie so weit, dass deine Energieverfügbarkeit unter 30 kcal pro kg fettfreier Masse fällt. Deshalb kann die tatsächliche Abnahme unter dem Wunschtempo liegen.
          </p>
        </div>
      </section>

      <section className="card">
        <h2>Schutzmodus</h2>
        <p className="muted small">
          Bei Dauermüdigkeit, schlechtem Schlaf oder Libidoverlust: Defizit aus, mehr essen. Die App schaltet das auch selbst ein, wenn du zweimal „Kaputt“ meldest.
        </p>
        <label className="toggle">
          <input type="checkbox" checked={s.redsStop} onChange={(e) => set({ redsStop: e.target.checked })} />
          <span>Schutzmodus manuell einschalten{protectedNow && !s.redsStop ? ` (automatisch aktiv bis ${s.protectUntil})` : ''}</span>
        </label>
      </section>

      <section className="card">
        <h2>Daten</h2>
        <div className="row gap wrap">
          <button className="ghost" onClick={() => download(`sub60-backup-${today}.json`, JSON.stringify(data, null, 2), 'application/json')}>Backup (JSON)</button>
          <button className="ghost" onClick={() => download(`sub60-tagebuch-${today}.csv`, toCsv(data), 'text/csv')}>Tagebuch (CSV)</button>
          <label className="ghost filebtn">
            Backup laden
            <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
        </div>
        {msg && <p className="small pad" role="status">{msg}</p>}
        <p className="muted small">Alles liegt nur lokal auf diesem Gerät. Der Trainingsplan ist fest eingebaut (Stand 18.09.2026).</p>
        <div className="danger-zone">
          {armed ? (
            <>
              <p className="small">Wirklich alles löschen? Das lässt sich nicht rückgängig machen.</p>
              <div className="row gap">
                <button className="ghost danger" onClick={() => { update(() => DEFAULT_DATA); setArmed(false); }}>Ja, alles löschen</button>
                <button className="ghost" onClick={() => setArmed(false)}>Abbrechen</button>
              </div>
            </>
          ) : (
            <button className="link small danger-text" onClick={() => setArmed(true)}>Alle Daten löschen …</button>
          )}
        </div>
      </section>
      <p className="muted small center">Kein Ersatz für ärztliche oder sportmedizinische Beratung.</p>
    </>
  );
}
