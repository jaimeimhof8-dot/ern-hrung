import { addDays, computeDay, parseISO, toISO, weekDeficitKg, type Data } from '../lib/engine';
import { totals } from '../lib/analytics';
import { Head, Metric, TYPE_COLOR, fmt, shortDate } from '../ui';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const mondayOf = (iso: string) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));

export default function Week({ date, setDate, data, open }: { date: string; setDate: (d: string) => void; data: Data; open: (d: string) => void }) {
  const mon = mondayOf(date);
  const plans = Array.from({ length: 7 }, (_, i) => computeDay(addDays(mon, i), data));
  const avg = Math.round(plans.reduce((a, p) => a + p.kcal, 0) / 7);
  const kg = weekDeficitKg(plans);
  const today = toISO(new Date());
  const logged = plans.filter((p) => data.diary[p.date]?.length);
  const eatenAvg = logged.length ? Math.round(logged.reduce((a, p) => a + totals(data.diary[p.date]).kcal, 0) / logged.length) : null;

  return (
    <>
      <Head
        kicker={`${shortDate(mon)} – ${shortDate(addDays(mon, 6))}`}
        title={plans[0].weekNo >= 1 ? `Woche ${plans[0].weekNo}` : 'Vor dem Plan'}
        prev={['Vorwoche', () => setDate(addDays(mon, -7))]}
        next={['Folgewoche', () => setDate(addDays(mon, 7))]}
      />
      {plans[0].weekName && <div className="xs muted" style={{ padding: '0 4px' }}>{plans[0].weekName}</div>}
      <section className="c tight">
        {plans.map((p, i) => {
          const eaten = Math.round(totals(data.diary[p.date]).kcal);
          const pct = Math.min(100, (eaten / p.kcal) * 100);
          const c = TYPE_COLOR[p.dayType];
          return (
            <button key={p.date} className="li" style={{ width: '100%', textAlign: 'left', background: p.date === today ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : undefined, borderRadius: p.date === today ? 'var(--r-s)' : undefined }} onClick={() => open(p.date)} aria-label={`${WD[i]}: ${p.trainingDay?.t ?? 'frei'}, Ziel ${p.kcal} kcal`}>
              <span className="mono muted" style={{ width: 28 }}>{WD[i]}</span>
              <span className="t">
                <span className="strong"><span className="sw" style={{ display: 'inline-flex', '--c': c } as React.CSSProperties}><i />{p.trainingDay ? p.trainingDay.t : 'frei'}</span></span>
                {eaten > 0 && (
                  <span className="mb" style={{ '--c': eaten > p.kcal * 1.05 ? 'var(--danger)' : c } as React.CSSProperties}><span className="trk"><span className="fil" style={{ width: `${pct}%`, display: 'block' }} /></span></span>
                )}
              </span>
              <span className="k">{p.kcal}</span>
            </button>
          );
        })}
      </section>
      <div className="s6-grid two" style={{ gap: 8 }}>
        <Metric label="Ø Ziel" value={String(avg)} unit="kcal" />
        <Metric label="Erwartet" value={kg > 0.005 ? `−${fmt(kg, 2)}` : '0'} unit="kg" />
        <Metric label="Ø gegessen" value={eatenAvg ? String(eatenAvg) : '–'} unit={logged.length ? `${logged.length} Tage` : ''} />
        <Metric label="Abweichung" value={eatenAvg ? `${eatenAvg - avg > 0 ? '+' : eatenAvg - avg < 0 ? '−' : ''}${Math.abs(eatenAvg - avg)}` : '–'} unit={eatenAvg ? 'kcal' : ''} />
      </div>
    </>
  );
}
