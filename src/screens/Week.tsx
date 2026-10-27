import { DAY_LABEL, addDays, computeDay, parseISO, toISO, weekDeficitKg, type Data } from '../lib/engine';
import { totals } from '../lib/analytics';
import { TYPE_CLASS } from '../ui';

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
      <div className="datebar">
        <button onClick={() => setDate(addDays(mon, -7))} aria-label="Vorwoche">‹</button>
        <div>
          <strong>{plans[0].weekNo >= 1 ? `Woche ${plans[0].weekNo}` : 'Vor dem Plan'}</strong>
          <span className="muted small">{plans[0].weekName}</span>
        </div>
        <button onClick={() => setDate(addDays(mon, 7))} aria-label="Folgewoche">›</button>
      </div>
      <section className="card">
        {plans.map((p, i) => {
          const eaten = Math.round(totals(data.diary[p.date]).kcal);
          const pct = Math.min(100, (eaten / p.kcal) * 100);
          return (
            <button key={p.date} className={`weekrow ${p.date === today ? 'today' : ''}`} onClick={() => open(p.date)} aria-label={`${WD[i]}: ${p.trainingDay?.t ?? 'frei'}, Ziel ${p.kcal} kcal, ${DAY_LABEL[p.dayType]}`}>
              <span className="dow">{WD[i]}</span>
              <span className="wmain">
                <span className="wtitle"><span className={`dot ${TYPE_CLASS[p.dayType]}`} />{p.trainingDay ? p.trainingDay.t : '–'}</span>
                <span className="mini"><span style={{ width: `${pct}%` }} className={eaten > p.kcal * 1.05 ? 'over' : ''} /></span>
              </span>
              <span className="wk">
                <span className="num-s">{p.kcal}</span>
                <span className="muted small">{eaten > 0 ? `${eaten} gegessen` : ''}</span>
              </span>
            </button>
          );
        })}
      </section>
      <section className="card stats">
        <div><strong>{avg}</strong><span>Ø Ziel kcal/Tag</span></div>
        <div><strong>{kg > 0.005 ? `−${kg.toFixed(2).replace('.', ',')} kg` : '0 kg'}</strong><span>erwartet laut Plan</span></div>
        <div><strong>{eatenAvg ?? '–'}</strong><span>Ø gegessen ({logged.length} Tage)</span></div>
        <div><strong>{eatenAvg ? `${eatenAvg - avg > 0 ? '+' : ''}${eatenAvg - avg}` : '–'}</strong><span>Abweichung vom Ziel</span></div>
      </section>
    </>
  );
}
