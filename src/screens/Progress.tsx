import { useMemo, useState } from 'react';
import { addDays, adaptAfterWeighIn, adherence, computeDay, dayIndex, toISO, type Data } from '../lib/engine';
import { movingAverage, projectedGoalDate, streak, totals, weekReports, weightTrend, type Verdict } from '../lib/analytics';
import { num, shortDate, type Update } from '../ui';

const fmt = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

export default function Progress({ data, update }: { data: Data; update: Update }) {
  const today = toISO(new Date());
  const [date, setDate] = useState(today);
  const [w, setW] = useState('');
  const [range, setRange] = useState<28 | 84 | 0>(84);

  const trend = useMemo(() => weightTrend(data, today), [data, today]);
  const goalDate = useMemo(() => projectedGoalDate(data, today), [data, today]);
  const series = useMemo(() => movingAverage(data), [data]);
  const reports = useMemo(() => weekReports(data, today, 4), [data, today]);
  const keys = Object.keys(data.weights).sort();
  const start = keys.length ? data.weights[keys[0]] : data.settings.weightKg;
  const now = keys.length ? data.weights[keys[keys.length - 1]] : data.settings.weightKg;
  const goal = data.settings.goalKg;
  const lost = start - now;
  const pct = start > goal ? Math.max(0, Math.min(100, (lost / (start - goal)) * 100)) : 0;
  const adh = adherence(data, today, 14);
  const days = streak(data, today);

  // Ø gegessen vs. Ziel der letzten 7 Tage mit Einträgen
  let eatenSum = 0;
  let targetSum = 0;
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, -i);
    if (data.diary[d]?.length) {
      eatenSum += totals(data.diary[d]).kcal;
      targetSum += computeDay(d, data).kcal;
      n++;
    }
  }
  const eatenAvg = n ? Math.round(eatenSum / n) : null;
  const targetAvg = n ? Math.round(targetSum / n) : null;

  const save = () => {
    const v = num(w);
    if (!v || v < 30 || v > 250) return;
    update((p) => {
      const next = { ...p, weights: { ...p.weights, [date]: v } };
      return { ...next, settings: adaptAfterWeighIn(next, date) };
    });
    setW('');
  };
  const remove = (d: string) =>
    update((p) => {
      const weights = { ...p.weights };
      delete weights[d];
      return { ...p, weights };
    });

  const info = verdictInfo(trend.verdict, trend.slope, trend.pct, eatenAvg, targetAvg, adh);
  const shown = range === 0 ? series : series.filter((s) => dayIndex(s.date) > dayIndex(today) - range);

  return (
    <>
      <h1 className="pagetitle">Fortschritt</h1>

      <section className={`card verdict ${trend.verdict}`} aria-live="polite">
        <div className="vicon" aria-hidden>{info.icon}</div>
        <div>
          <h2 className="vhead">{info.title}</h2>
          <p>{info.text}</p>
          {goalDate && <p className="muted small">Zielgewicht voraussichtlich am <strong>{shortDate(goalDate)}</strong></p>}
        </div>
      </section>

      <section className="card">
        <h2>Gewicht eintragen</h2>
        <div className="row gap wrap">
          <input inputMode="decimal" placeholder={fmt(now)} value={w} onChange={(e) => setW(e.target.value)} aria-label="Gewicht in kg" className="grow" />
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Datum" className="dateinput" />
          <button className="primary small" disabled={!num(w)} onClick={save}>Speichern</button>
        </div>
        <p className="muted small">Am besten morgens nüchtern, 2–3 Mal pro Woche. Einzelne Tage schwanken, der Trend zählt.</p>
      </section>

      <section className="card">
        <div className="row between">
          <div className="big"><span className="num">{fmt(now)}</span> kg</div>
          <div className="muted small right">Ziel {fmt(goal)} kg<br />noch {fmt(Math.max(0, now - goal))} kg</div>
        </div>
        <div className="bar" aria-hidden><div style={{ width: `${pct}%` }} /></div>
        <div className="pills tight" role="group" aria-label="Zeitraum">
          {([[28, '4 Wochen'], [84, '12 Wochen'], [0, 'Alles']] as [28 | 84 | 0, string][]).map(([r, l]) => (
            <button key={r} className={`pill sm ${range === r ? 'on' : ''}`} onClick={() => setRange(r)}>{l}</button>
          ))}
        </div>
        {shown.length >= 2 ? <Chart points={shown} goal={goal} /> : <p className="muted small pad">Das Diagramm erscheint ab dem zweiten Wiegen.</p>}
        <div className="legend small muted"><span className="lg dots" />Messung <span className="lg line" />7-Tage-Schnitt <span className="lg dash" />Ziel</div>
      </section>

      <section className="card stats">
        <div><strong>{trend.slope === null ? '–' : `${trend.slope > 0 ? '+' : '−'}${fmt(Math.abs(trend.slope), 2)} kg`}</strong><span>pro Woche (Trend)</span></div>
        <div><strong>{lost > 0 ? `−${fmt(lost)}` : fmt(lost)} kg</strong><span>seit Start</span></div>
        <div><strong>{eatenAvg ?? '–'}</strong><span>Ø kcal (7 Tage){targetAvg ? ` · Ziel ${targetAvg}` : ''}</span></div>
        <div><strong>{days} {days === 1 ? 'Tag' : 'Tage'}</strong><span>Tagebuch-Serie</span></div>
      </section>

      <section className="card">
        <h2>Letzte Wochen</h2>
        <table className="wtable">
          <thead>
            <tr><th scope="col">Woche</th><th scope="col">Ø kcal</th><th scope="col">Ø Gewicht</th><th scope="col">Änderung</th></tr>
          </thead>
          <tbody>
            {reports.filter((r) => r.loggedDays > 0 || r.weight !== null).map((r) => (
              <tr key={r.monday}>
                <th scope="row">{shortDate(r.monday)}</th>
                <td>{r.avgKcal ?? '–'}{r.loggedDays ? <small className="muted"> ({r.loggedDays}T)</small> : ''}</td>
                <td>{r.weight ? fmt(r.weight) : '–'}</td>
                <td className={r.change !== null && r.change < -0.05 ? 'good' : r.change !== null && r.change > 0.05 ? 'bad' : ''}>
                  {r.change === null ? '–' : `${r.change > 0 ? '+' : r.change < 0 ? '−' : ''}${fmt(Math.abs(r.change), 2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {keys.length > 0 && (
        <section className="card">
          <h2>Messungen</h2>
          <ul className="entries">
            {[...keys].reverse().slice(0, 8).map((k) => (
              <li key={k}>
                <div className="ebody"><span>{shortDate(k)}</span></div>
                <span className="ekcal">{fmt(data.weights[k])} kg</span>
                <button className="icon-btn sm" onClick={() => remove(k)} aria-label={`Messung vom ${shortDate(k)} löschen`}>✕</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function verdictInfo(v: Verdict, slope: number | null, pct: number | null, eaten: number | null, target: number | null, adh: number | null) {
  const rate = slope === null ? '' : `${fmt(Math.abs(slope), 2)} kg pro Woche`;
  switch (v) {
    case 'down':
      return {
        icon: '↓',
        title: 'Du nimmst ab',
        text:
          pct !== null && pct > 1
            ? `${rate} – das ist schnell. Die App erhöht automatisch die Kalorien, damit du Leistung und Muskeln behältst.`
            : `${rate}. Das liegt im gesunden Bereich. Weiter so.`,
      };
    case 'up':
      return {
        icon: '↑',
        title: 'Dein Gewicht steigt',
        text:
          eaten !== null && target !== null && eaten > target * 1.05
            ? `Du isst im Schnitt ${eaten - target} kcal über dem Ziel. Das erklärt es wahrscheinlich.`
            : 'Das kann Wasser, Salz oder mehr Training sein. Beobachte zwei Wochen. Passt der Trend dann nicht, passt die App das Ziel an.',
      };
    case 'flat':
      return {
        icon: '→',
        title: 'Dein Gewicht hält',
        text:
          adh !== null && adh < 60
            ? 'Du hast zuletzt wenig geloggt. Trage konsequent ein, dann sehen wir klarer, woran es liegt.'
            : eaten !== null && target !== null && eaten > target * 1.05
              ? `Du isst im Schnitt ${eaten - target} kcal über dem Ziel – deshalb stagniert es vermutlich.`
              : 'Das Gewicht schwankt täglich um 1–2 kg (Wasser, Salz, Verdauung). Gib es zwei Wochen, die App justiert das Defizit sonst selbst.',
      };
    default:
      return {
        icon: '…',
        title: 'Noch zu wenig Daten',
        text: 'Wiege dich in den nächsten zwei Wochen mindestens dreimal, am besten morgens nüchtern. Dann zeigt dir die App, ob du abnimmst.',
      };
  }
}

function Chart({ points, goal }: { points: { date: string; value: number; avg: number }[]; goal: number }) {
  const w = 320;
  const h = 150;
  const padX = 8;
  const vals = [...points.map((p) => p.value), ...points.map((p) => p.avg), goal];
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const x0 = dayIndex(points[0].date);
  const x1 = dayIndex(points[points.length - 1].date);
  const x = (d: string) => padX + ((dayIndex(d) - x0) / Math.max(1, x1 - x0)) * (w - padX * 2);
  const y = (v: number) => h - 14 - ((v - min) / (max - min)) * (h - 28);
  const line = points.map((p) => `${x(p.date)},${y(p.avg)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label={`Gewichtsverlauf von ${points[0].value} auf ${points[points.length - 1].value} Kilogramm`}>
      <line x1="0" x2={w} y1={y(goal)} y2={y(goal)} className="goal" />
      <text x={w - 2} y={y(goal) - 4} textAnchor="end" className="axis">{fmt(goal)}</text>
      <polyline points={line} fill="none" className="line" />
      {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="3" className="dotp" />)}
      <text x="2" y={h - 2} className="axis">{shortDate(points[0].date)}</text>
      <text x={w - 2} y={h - 2} textAnchor="end" className="axis">{shortDate(points[points.length - 1].date)}</text>
    </svg>
  );
}
