import { useMemo, useState } from 'react';
import { addDays, adaptAfterWeighIn, adherence, computeDay, dayIndex, toISO, type Data } from '../lib/engine';
import { calibration, movingAverage, projectedGoalDate, streak, totals, weekReports, weightTrend, type Verdict } from '../lib/analytics';
import { Head, Icon, Metric, WeighSheet, fmt, shortDate, type Notify, type Update } from '../ui';

type Info = { icon: string; cls: 'down' | 'flat' | 'up' | ''; title: string; text: string };

export default function Progress({ data, update, notify }: { data: Data; update: Update; notify: Notify }) {
  const today = toISO(new Date());
  const [weighing, setWeighing] = useState(false);
  const [range, setRange] = useState<28 | 84 | 0>(84);
  const [newGoal, setNewGoal] = useState('');
  const newGoalNum = parseFloat(newGoal.replace(',', '.'));
  const newGoalOk = Number.isFinite(newGoalNum) && newGoalNum >= 30;

  const s = data.settings;
  const trend = useMemo(() => weightTrend(data, today), [data, today]);
  const goalDate = useMemo(() => projectedGoalDate(data, today), [data, today]);
  const series = useMemo(() => movingAverage(data), [data]);
  const reports = useMemo(() => weekReports(data, today, 4), [data, today]);
  const cal = useMemo(() => calibration(data, today), [data, today]);
  const keys = Object.keys(data.weights).sort();
  const start = keys.length ? data.weights[keys[0]] : s.weightKg;
  const now = keys.length ? data.weights[keys[keys.length - 1]] : s.weightKg;
  const goal = s.goalKg;
  const lost = start - now;
  const pct = start > goal ? Math.max(0, Math.min(100, (lost / (start - goal)) * 100)) : 0;
  const adh = adherence(data, today, 14);
  const days = streak(data, today);
  const reached = keys.length > 0 && now <= goal && start > goal;

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

  const save = (v: number) => {
    update((p) => {
      const next = { ...p, weights: { ...p.weights, [today]: v } };
      return { ...next, settings: adaptAfterWeighIn(next, today) };
    });
    setWeighing(false);
    notify(`${fmt(v)} kg gespeichert`);
  };
  const remove = (d: string) =>
    update((p) => {
      const weights = { ...p.weights };
      delete weights[d];
      return { ...p, weights };
    });

  const info = reached ? reachedInfo(now, keys[keys.length - 1]) : verdictInfo(trend.verdict, trend.slope, trend.pct, eatenAvg, targetAvg, adh);
  const shown = range === 0 ? series : series.filter((p) => dayIndex(p.date) > dayIndex(today) - range);

  // Kalibrierung
  const sinceCalib = s.calibDate ? dayIndex(today) - dayIndex(s.calibDate) : null;
  const justCalibrated = sinceCalib !== null && sinceCalib < 14 && s.calib !== undefined;
  const sinceSkip = s.calibSkip ? dayIndex(today) - dayIndex(s.calibSkip) : null;
  const skipped = sinceSkip !== null && sinceSkip < 14;
  const applyCalib = () => {
    if (cal.suggested === null) return;
    const prev = { calib: s.calib, calibDate: s.calibDate, calibPrev: s.calibPrev };
    update((p) => ({ ...p, settings: { ...p.settings, calibPrev: p.settings.calib, calib: cal.suggested!, calibDate: today, calibSkip: undefined } }));
    notify(`Tagesziel ${cal.suggested! > 0 ? 'steigt' : 'sinkt'} um ${Math.abs(cal.suggested!)} kcal`, [
      { label: 'Rückgängig', run: () => update((p) => ({ ...p, settings: { ...p.settings, ...prev } })) },
    ]);
  };
  const undoCalib = () =>
    update((p) => ({ ...p, settings: { ...p.settings, calib: p.settings.calibPrev, calibDate: undefined, calibPrev: undefined } }));
  const skipCalib = () => update((p) => ({ ...p, settings: { ...p.settings, calibSkip: today } }));

  return (
    <>
      <Head kicker="Saison" title="Fortschritt" />

      <section className="c" aria-live="polite">
        <div className="vr">
          <div className={`vic ${info.cls}`}>{info.icon === 'check' ? <Icon n="check" /> : info.icon}</div>
          <div>
            <div className="vh">{info.title}</div>
            <p className="muted body" style={{ marginTop: 6 }}>{info.text}</p>
            {!reached && goalDate && <p className="xs muted" style={{ marginTop: 6 }}>Zielgewicht voraussichtlich am <b style={{ color: 'var(--ink)' }}>{shortDate(goalDate)}</b></p>}
          </div>
        </div>
      </section>

      {reached && !s.maintain && (
        <section className="c tight">
          <span className="lab">Wie weiter?</span>
          <button className="s6-btn s6-btn-quiet w" onClick={() => update((p) => ({ ...p, settings: { ...p.settings, maintain: true } }))}>Gewicht halten</button>
          <div className="f"><span>Neues Zielgewicht</span>
            <div className="in">
              <input inputMode="decimal" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder={fmt(goal - 2)} />
              <span className="u">kg</span>
            </div>
          </div>
          <button className="s6-btn s6-btn-quiet w" disabled={!newGoalOk} onClick={() => update((p) => ({ ...p, settings: { ...p.settings, goalKg: newGoalNum!, maintain: false } }))}>Neues Zielgewicht setzen</button>
        </section>
      )}
      {s.maintain && (
        <section className="c tight">
          <div className="row between"><span className="body muted grow">Erhaltung aktiv. Das Tagesziel hat kein Defizit.</span>
            <button className="chip" onClick={() => update((p) => ({ ...p, settings: { ...p.settings, maintain: false } }))}>Beenden</button></div>
        </section>
      )}

      {!reached && trend.verdict === 'down' && trend.pct !== null && trend.pct > 1 && (
        <div className="banner warn-b"><Icon n="chart" /><div className="xs"><b>Die App greift ein.</b> Bei der nächsten Wägung gibt sie bis zu 250 kcal dazu, bis das Tempo bei 0,4 bis 0,6 % pro Woche liegt.</div></div>
      )}

      <button className="s6-btn s6-btn-quiet w" onClick={() => setWeighing(true)}><Icon n="scale" s />Gewicht eintragen</button>

      <section className="c">
        <div className="row between">
          <div><span className="mono" style={{ fontSize: 52, lineHeight: 1 }}>{fmt(now)}</span><span className="muted"> kg</span></div>
          <div className="xs muted right">Ziel {fmt(goal)} kg<br />{now > goal ? `noch ${fmt(now - goal)} kg` : 'erreicht'}</div>
        </div>
        <div className="mb" style={{ '--c': 'var(--ink)' } as React.CSSProperties} aria-hidden><div className="trk"><div className="fil" style={{ width: `${pct}%` }} /></div></div>
        <div className="seg" role="group" aria-label="Zeitraum">
          {([[28, '4 Wochen'], [84, '12 Wochen'], [0, 'Alles']] as [28 | 84 | 0, string][]).map(([r, l]) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)} style={{ textAlign: 'center', padding: '10px 6px', minHeight: 44, borderRadius: 999, font: '500 13px/18px var(--font-body)', color: range === r ? 'var(--ink)' : 'var(--muted)', background: range === r ? 'var(--card)' : 'none', boxShadow: range === r ? 'var(--shadow-edge)' : 'none', fontWeight: range === r ? 600 : 500 }}>{l}</button>
          ))}
        </div>
        {shown.length >= 2 ? <Chart points={shown} goal={goal} /> : <p className="sm muted">Das Diagramm erscheint ab dem zweiten Wiegen.</p>}
        <div className="legend"><span><span className="lg dots" />Messung</span><span><span className="lg" />7-Tage-Schnitt</span><span><span className="lg dash" />Ziel</span></div>
      </section>

      <div className="s6-grid two" style={{ gap: 8 }}>
        <Metric label="Trend" value={trend.slope === null ? '–' : `${trend.slope > 0 ? '+' : trend.slope < 0 ? '−' : '±'}${fmt(Math.abs(trend.slope), 2)}`} unit="kg / Woche" />
        <Metric label="Seit Start" value={lost > 0 ? `−${fmt(lost)}` : fmt(lost)} unit="kg" />
        <Metric label="Ø kcal" value={eatenAvg ? String(eatenAvg) : '–'} unit={targetAvg ? `Ziel ${targetAvg}` : ''} />
        <Metric label="Serie" value={String(days)} unit={days === 1 ? 'Tag' : 'Tage'} />
      </div>

      <section className="c">
        <div className="lab">Dein echter Bedarf</div>
        {justCalibrated ? (
          <>
            <div><div className="vh" style={{ fontSize: 26 }}>Angepasst: {cal.baseTdee + s.calib!} kcal</div>
              <p className="muted body" style={{ marginTop: 6 }}>Dein Tagesziel {s.calib! >= 0 ? 'steigt' : 'sinkt'} um {Math.abs(s.calib!)} kcal. Nächste Prüfung in {14 - sinceCalib!} Tagen.</p></div>
            <button className="s6-btn s6-btn-quiet w" onClick={undoCalib}>Rückgängig</button>
          </>
        ) : cal.ready && cal.suggested !== null && cal.actualTdee !== null && !skipped ? (
          Math.abs(cal.suggested) < 50 ? (
            <p className="muted body">Deine Formel passt: gemessen {cal.actualTdee} kcal, Formel {cal.baseTdee} kcal. Nichts zu ändern.</p>
          ) : (
            <>
              <div className="compare">
                <div><span className="xs muted">Formel</span><b>{cal.baseTdee}</b><span className="xs muted"> kcal</span></div>
                <div className="hl"><span className="xs muted">Gemessen</span><b>{cal.actualTdee}</b><span className="xs muted"> kcal</span></div>
              </div>
              <p className="body">
                In {cal.loggedDays} Tagen hast du im Schnitt {cal.avgIntake} kcal gegessen und dabei {fmt(Math.abs(cal.slope ?? 0), 1)} kg pro Woche {(cal.slope ?? 0) <= 0 ? 'verloren' : 'zugenommen'}. Dein Körper braucht also etwa <b>{Math.abs(cal.suggested)} kcal {cal.suggested > 0 ? 'mehr' : 'weniger'}</b>, als die Formel sagt.
              </p>
              <button className="s6-btn s6-btn-primary w" onClick={applyCalib}>{cal.suggested > 0 ? '+' : '−'}{Math.abs(cal.suggested)} kcal übernehmen</button>
              <button className="s6-btn s6-btn-quiet w" onClick={skipCalib}>Nicht ändern</button>
              <p className="xs muted"><b style={{ color: 'var(--ink)' }}>Wie sicher ist das?</b> {cal.loggedDays} Tage Einträge, {cal.weighIns} Wiegungen. Je mehr du einträgst, desto genauer wird die Zahl.</p>
            </>
          )
        ) : skipped ? (
          <p className="muted body">Kein Vorschlag übernommen. Nächste Prüfung in {14 - sinceSkip!} Tagen.</p>
        ) : (
          <>
            <p className="muted body">Wenn du Essen und Gewicht ein paar Wochen einträgst, rechnet die App aus, was dein Körper wirklich braucht, ohne Formel und ohne Schätzen.</p>
            <div className="mb" style={{ '--c': 'var(--ink)' } as React.CSSProperties}><div className="row between xs"><span>Tage mit Einträgen</span><span className="muted">{cal.loggedDays} von 10</span></div><div className="trk"><div className="fil" style={{ width: `${Math.min(100, cal.loggedDays * 10)}%` }} /></div></div>
            <div className="mb" style={{ '--c': 'var(--ink)' } as React.CSSProperties}><div className="row between xs"><span>Wiegungen</span><span className="muted">{cal.weighIns} von 4</span></div><div className="trk"><div className="fil" style={{ width: `${Math.min(100, cal.weighIns * 25)}%` }} /></div></div>
          </>
        )}
      </section>

      <section className="c tight">
        <div className="lab">Letzte Wochen</div>
        <table className="tbl">
          <thead>
            <tr><th scope="col">Woche</th><th scope="col" className="r">Ø kcal</th><th scope="col" className="r">Gewicht</th><th scope="col" className="r">Änderung</th></tr>
          </thead>
          <tbody>
            {reports.filter((r) => r.loggedDays > 0 || r.weight !== null).map((r) => (
              <tr key={r.monday}>
                <td>{shortDate(r.monday)}</td>
                <td className="r">{r.avgKcal ?? '–'}</td>
                <td className="r">{r.weight ? fmt(r.weight) : '–'}</td>
                <td className={`r ${r.change !== null && r.change < -0.05 ? 'ok' : r.change !== null && r.change > 0.05 ? 'bad' : ''}`}>
                  {r.change === null ? '–' : `${r.change > 0 ? '+' : r.change < 0 ? '−' : ''}${fmt(Math.abs(r.change), 2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {keys.length > 0 && (
        <section className="c tight">
          <div className="lab">Messungen</div>
          {[...keys].reverse().slice(0, 8).map((k) => (
            <div className="ent" key={k}>
              <div className="t"><span className="strong">{shortDate(k)}</span></div>
              <span className="k">{fmt(data.weights[k])} kg</span>
              <button className="x" onClick={() => remove(k)} aria-label={`Messung vom ${shortDate(k)} löschen`}><Icon n="x" s /></button>
            </div>
          ))}
        </section>
      )}

      {weighing && <WeighSheet date={today} initial={now} onSave={save} onClose={() => setWeighing(false)} />}
    </>
  );
}

function reachedInfo(now: number, date: string): Info {
  return { icon: 'check', cls: 'down', title: 'Ziel erreicht', text: `${fmt(now)} kg am ${shortDate(date)}. Ab jetzt hältst du dein Gewicht. Das Tagesziel springt auf Erhaltung, sobald du es bestätigst.` };
}

function verdictInfo(v: Verdict, slope: number | null, pct: number | null, eaten: number | null, target: number | null, adh: number | null): Info {
  const rate = slope === null ? '' : `${fmt(Math.abs(slope), 2)} kg pro Woche`;
  switch (v) {
    case 'down':
      return {
        icon: '↓',
        cls: 'down',
        title: 'Du nimmst ab',
        text:
          pct !== null && pct > 1
            ? `${rate}. Das ist schnell. Die App erhöht die Kalorien, damit du Leistung und Muskeln behältst.`
            : `${rate}. Das liegt im gesunden Bereich. Weiter so.`,
      };
    case 'up':
      return {
        icon: '↑',
        cls: 'up',
        title: 'Dein Gewicht steigt',
        text:
          eaten !== null && target !== null && eaten > target * 1.05
            ? `Du isst im Schnitt ${eaten - target} kcal über dem Ziel. Das erklärt es wahrscheinlich.`
            : 'Das kann Wasser, Salz oder mehr Training sein. Beobachte zwei Wochen. Passt der Trend dann nicht, passt die App das Ziel an.',
      };
    case 'flat':
      return {
        icon: '→',
        cls: 'flat',
        title: 'Dein Gewicht hält',
        text:
          adh !== null && adh < 60
            ? 'Du hast zuletzt wenig geloggt. Trage konsequent ein, dann sehen wir klarer, woran es liegt.'
            : eaten !== null && target !== null && eaten > target * 1.05
              ? `Du isst im Schnitt ${eaten - target} kcal über dem Ziel. Deshalb stagniert es vermutlich.`
              : 'Das Gewicht schwankt täglich um 1–2 kg (Wasser, Salz, Verdauung). Gib es zwei Wochen, die App justiert das Defizit sonst selbst.',
      };
    default:
      return {
        icon: '…',
        cls: '',
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
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label={`Gewichtsverlauf von ${fmt(points[0].value)} auf ${fmt(points[points.length - 1].value)} Kilogramm`}>
      <line x1="0" x2={w} y1={y(goal)} y2={y(goal)} className="goal" />
      <text x={w - 2} y={y(goal) - 4} textAnchor="end">{fmt(goal)}</text>
      <polyline points={line} className="line" />
      {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="3" className="dotp" />)}
      <text x="2" y={h - 2}>{shortDate(points[0].date)}</text>
      <text x={w - 2} y={h - 2} textAnchor="end">{shortDate(points[points.length - 1].date)}</text>
    </svg>
  );
}
