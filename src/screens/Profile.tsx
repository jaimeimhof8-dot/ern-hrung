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
import { Head, Icon, Metric, NumField, fmt, shortDate, type Notify, type Update } from '../ui';

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

function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Profile({ data, update, notify }: { data: Data; update: Update; notify: Notify }) {
  const s = data.settings;
  const today = toISO(new Date());
  const weight = currentWeight(today, data);
  const set = (patch: Partial<Settings>) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const [armed, setArmed] = useState(false);

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
      notify('Backup geladen');
    } else notify('Datei konnte nicht gelesen werden');
  };
  const save = (name: string, text: string, type: string) => {
    download(name, text, type);
    notify(`Gespeichert: ${name}`);
  };

  return (
    <>
      <Head kicker="Dein Körper" title="Profil" />

      <section className="c">
        <div className="lab">Kalorienbedarf</div>
        <div className="seg" role="group" aria-label="Geschlecht">
          {(['m', 'w'] as Sex[]).map((x) => (
            <button key={x} className={s.sex === x ? 'on' : ''} onClick={() => set({ sex: x })} style={{ textAlign: 'center', padding: '10px 6px', minHeight: 44, borderRadius: 999, font: '500 13px/18px var(--font-body)', color: s.sex === x ? 'var(--ink)' : 'var(--muted)', background: s.sex === x ? 'var(--card)' : 'none', boxShadow: s.sex === x ? 'var(--shadow-edge)' : 'none', fontWeight: s.sex === x ? 600 : 500 }}>
              {x === 'm' ? 'Männlich' : 'Weiblich'}
            </button>
          ))}
        </div>
        <div className="cols2">
          <NumField label="Alter" value={s.age} onChange={(v) => v && set({ age: Math.round(v) })} />
          <NumField label="Grösse" suffix="cm" value={s.heightCm} onChange={(v) => v && set({ heightCm: Math.round(v) })} />
          <NumField label="Zielgewicht" suffix="kg" value={s.goalKg} onChange={(v) => v && set({ goalKg: v })} />
          <NumField label="Körperfett" suffix="%" value={s.bodyFatPercent} onChange={(v) => v && set({ bodyFatPercent: v, bfKnown: true })} hint={s.bfKnown ? 'Wird für die Berechnung genutzt' : 'Schätzung, noch nicht genutzt'} />
        </div>
        <label className="f">
          <span>Aktivität</span>
          <div className="in">
            <select value={s.activity} onChange={(e) => set({ activity: parseFloat(e.target.value) })}>
              {ACTIVITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <Icon n="r" s />
          </div>
        </label>
        {s.bfKnown && <button className="link plain" onClick={() => set({ bfKnown: false })}>Körperfett ignorieren (Mifflin-St Jeor nutzen)</button>}

        {needs ? (
          <>
            <div className="s6-grid two" style={{ gap: 8 }} aria-live="polite">
              <Metric small label="Grundumsatz" value={String(needs.bmr)} unit="kcal" />
              <Metric small label="Gesamtumsatz" value={String(s.tdeeOverride ?? needs.tdee)} unit="kcal" />
            </div>
            <p className="xs muted">Formel: {needs.method}. Der Trainingsplan hebt oder senkt das Tagesziel zusätzlich nach Belastung.{s.calib ? ` Kalibrierung: ${s.calib > 0 ? '+' : '−'}${Math.abs(s.calib)} kcal.` : ''}</p>
          </>
        ) : (
          <p className="sm est">Trage Alter und Grösse ein, dann berechnet die App deinen Bedarf.</p>
        )}
        <NumField label="Gesamtumsatz selbst festlegen (optional)" suffix="kcal" value={s.tdeeOverride} onChange={(v) => set({ tdeeOverride: v ? Math.round(v) : undefined })} hint="Leer lassen für die automatische Berechnung" />
      </section>

      <section className="c">
        <div className="lab">Abnahme-Tempo</div>
        <div className="rates" role="group" aria-label="Tempo">
          {RATES.map(([r, l]) => (
            <button key={r} className={`chip ${s.ratePerWeek === r ? 'on' : ''}`} onClick={() => set({ ratePerWeek: r })}>
              {l}
              <small>{fmt(r, 2)} kg</small>
            </button>
          ))}
        </div>
        <p className="xs muted">Ø Tagesziel {expected.avg} kcal · erwartet ≈ {fmt(expected.kg, 2)} kg pro Woche.</p>
        <div className="tip soft"><div>An harten Trainingstagen isst du bewusst auf Erhaltung. Die App senkt die Kalorien nie so weit, dass deine Energieverfügbarkeit unter 30 kcal pro kg fettfreier Masse fällt. Deshalb kann die tatsächliche Abnahme unter dem Wunschtempo liegen.</div></div>
      </section>

      <section className="c">
        <div className="lab">Schutzmodus</div>
        <div className="row between">
          <p className="body grow muted">
            Defizit aus, mehr essen.{protectedNow && !s.redsStop && s.protectUntil ? ` Automatisch aktiv bis ${shortDate(s.protectUntil)}.` : ''}
          </p>
          <button className={`chip ${s.redsStop ? 'on' : ''}`} onClick={() => set({ redsStop: !s.redsStop })} aria-pressed={s.redsStop}>{s.redsStop ? 'An' : 'Aus'}</button>
        </div>
        <p className="xs muted">Bei Dauermüdigkeit, schlechtem Schlaf oder Libidoverlust. Die App schaltet ihn auch selbst ein, wenn du zweimal «Kaputt» meldest.</p>
      </section>

      <section className="c">
        <div className="lab">Daten</div>
        <button className="s6-btn s6-btn-quiet w" onClick={() => save(`sub60-backup-${today}.json`, JSON.stringify(data, null, 2), 'application/json')}>Backup speichern (JSON)</button>
        <button className="s6-btn s6-btn-quiet w" onClick={() => save(`sub60-tagebuch-${today}.csv`, toCsv(data), 'text/csv')}>Tagebuch als Tabelle (CSV)</button>
        <label className="s6-btn s6-btn-quiet w">
          Backup laden
          <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </label>
        <p className="xs muted">Alles liegt nur auf diesem Gerät. Der Trainingsplan ist fest eingebaut (Stand 18.09.2026).</p>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {armed ? (
            <>
              <p className="body"><b>Wirklich alles löschen?</b> Tagebuch, Gewichte und Mahlzeiten sind danach weg. Das lässt sich nicht rückgängig machen.</p>
              <div className="row" style={{ gap: 8 }}>
                <button className="s6-btn s6-btn-quiet" style={{ flex: 1, color: 'var(--danger)' }} onClick={() => { update(() => DEFAULT_DATA); setArmed(false); }}>Ja, alles löschen</button>
                <button className="s6-btn s6-btn-quiet" style={{ flex: 1 }} onClick={() => setArmed(false)}>Abbrechen</button>
              </div>
            </>
          ) : (
            <button className="link danger" onClick={() => setArmed(true)}>Alle Daten löschen …</button>
          )}
        </div>
      </section>
      <p className="xs muted center">Kein Ersatz für ärztliche oder sportmedizinische Beratung.</p>
    </>
  );
}
