import { useMemo, useState } from 'react';
import {
  DAY_LABEL,
  addDays,
  adaptAfterWeighIn,
  computeDay,
  currentWeight,
  daysToRace,
  emptyLog,
  protectAfterEnergy,
  toISO,
  type Data,
  type Energy,
  type Entry,
  type Feel,
  type Meal,
  type Slot,
} from '../lib/engine';
import { MEALS, totals, waterGoalMl } from '../lib/analytics';
import { Bar, Ring, TYPE_CLASS, longDate, num, type Update } from '../ui';

/** Plan-Mahlzeit nach Uhrzeit einer Mahlzeitengruppe zuordnen. */
function mealOfSlot(slot: Slot): Meal {
  const h = parseInt(slot.time, 10);
  return h < 11 ? 'fruehstueck' : h < 15 ? 'mittag' : h < 17 ? 'snack' : 'abend';
}

export default function Today({ date, setDate, data, update, onAdd }: { date: string; setDate: (d: string) => void; data: Data; update: Update; onAdd: (m: Meal) => void }) {
  const plan = useMemo(() => computeDay(date, data), [date, data]);
  const log = data.logs[date] ?? emptyLog();
  const entries = data.diary[date] ?? [];
  const eaten = totals(entries);
  const today = toISO(new Date());
  const t = plan.trainingDay;
  const [showPlan, setShowPlan] = useState(false);
  const [showTrain, setShowTrain] = useState(false);

  const setLog = (patch: Partial<typeof log>) =>
    update((p) => ({ ...p, logs: { ...p.logs, [date]: { ...emptyLog(), ...p.logs[date], ...patch } } }));
  const removeEntry = (id: string) =>
    update((p) => ({ ...p, diary: { ...p.diary, [date]: (p.diary[date] ?? []).filter((e) => e.id !== id) } }));
  const copyYesterday = (meal: Meal) =>
    update((p) => {
      const src = (p.diary[addDays(date, -1)] ?? []).filter((e) => e.meal === meal);
      const copies = src.map((e) => ({ ...e, id: `${e.id}-${Date.now().toString(36)}` }));
      return { ...p, diary: { ...p.diary, [date]: [...(p.diary[date] ?? []), ...copies] } };
    });

  const togglePlanSlot = (i: number) => {
    const slot = plan.slots[i];
    const id = `plan-${i}`;
    const on = entries.some((e) => e.id === id);
    update((p) => {
      const list = (p.diary[date] ?? []).filter((e) => e.id !== id);
      if (!on) {
        const entry: Entry = {
          id,
          meal: mealOfSlot(slot),
          name: `Plan: ${slot.label}`,
          kcal: slot.kcal,
          p: slot.p,
          c: slot.c,
          f: slot.f,
          amount: slot.time,
        };
        list.push(entry);
      }
      const meals = [...(p.logs[date]?.meals ?? emptyLog().meals)];
      meals[i] = !on;
      return {
        ...p,
        diary: { ...p.diary, [date]: list },
        logs: { ...p.logs, [date]: { ...emptyLog(), ...p.logs[date], meals } },
      };
    });
  };

  const needsCheck = date === today && !Object.keys(data.weights).some((w) => w > addDays(today, -7));
  const water = data.water[date] ?? 0;
  const waterGoal = waterGoalMl(currentWeight(date, data));
  const addWater = (ml: number) => update((p) => ({ ...p, water: { ...p.water, [date]: Math.max(0, (p.water[date] ?? 0) + ml) } }));
  const yesterdayHas = (meal: Meal) => (data.diary[addDays(date, -1)] ?? []).some((e) => e.meal === meal);

  return (
    <>
      <div className="datebar">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Vortag">‹</button>
        <div>
          <strong>{date === today ? 'Heute' : longDate(date)}</strong>
          <span className="muted small">
            {plan.weekNo >= 1 && plan.weekName ? `Woche ${plan.weekNo} · ${plan.weekName}` : 'Außerhalb des Plans'}
          </span>
        </div>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Folgetag">›</button>
      </div>

      <section className={`hero ${TYPE_CLASS[plan.dayType]}`}>
        <div className="row between">
          <span className="tag">{DAY_LABEL[plan.dayType]}</span>
          {plan.idx >= 0 && daysToRace(date) >= 0 && <span className="muted small">{daysToRace(date)} Tage bis Basel</span>}
        </div>
        <h1>{t ? t.t : 'Kein Training geplant'}</h1>
        <div className="herogrid">
          <Ring value={eaten.kcal} target={plan.kcal} />
          <dl className="herostats">
            <div><dt>Ziel</dt><dd>{plan.kcal}</dd></div>
            <div><dt>Gegessen</dt><dd>{Math.round(eaten.kcal)}</dd></div>
          </dl>
        </div>
        <div className="mbars">
          <Bar label="Protein" value={eaten.p} target={plan.protein} />
          <Bar label="Kohlenhydrate" value={eaten.c} target={plan.carbs} />
          <Bar label="Fett" value={eaten.f} target={plan.fat} />
        </div>
        <p className="window">{plan.window}</p>
      </section>

      {needsCheck && <CheckIn data={data} update={update} date={date} />}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.id);
        const sum = totals(list);
        return (
          <section className="card meal" key={m.id}>
            <div className="row between">
              <h2>{m.label}</h2>
              <div className="row gap">
                <span className="muted small">{Math.round(sum.kcal)} kcal</span>
                <button className="add-btn" onClick={() => onAdd(m.id)} aria-label={`Zu ${m.label} hinzufügen`}>+</button>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="empty row between">
                <span className="muted small">Noch nichts eingetragen</span>
                {yesterdayHas(m.id) && (
                  <button className="link small" onClick={() => copyYesterday(m.id)}>Von gestern kopieren</button>
                )}
              </div>
            ) : (
              <ul className="entries">
                {list.map((e) => (
                  <li key={e.id}>
                    <div className="ebody">
                      <span>{e.name}</span>
                      <span className="muted small">
                        {e.amount ? `${e.amount} · ` : ''}{e.p} P · {e.c} C · {e.f} F
                      </span>
                    </div>
                    <span className="ekcal">{e.kcal}</span>
                    <button className="icon-btn sm" onClick={() => removeEntry(e.id)} aria-label={`${e.name} entfernen`}>✕</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <section className="card">
        <div className="row between">
          <h2>Wasser</h2>
          <span className="muted small">{(water / 1000).toFixed(2).replace('.', ',')} / {(waterGoal / 1000).toFixed(2).replace('.', ',')} l</span>
        </div>
        <div className="bar"><div style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%` }} /></div>
        <div className="quick">
          <button onClick={() => addWater(250)}>+250 ml</button>
          <button onClick={() => addWater(500)}>+500 ml</button>
          <button onClick={() => addWater(-250)} aria-label="250 ml abziehen">−250</button>
        </div>
      </section>

      <section className="card">
        <button className="linkrow" onClick={() => setShowPlan(!showPlan)} aria-expanded={showPlan}>
          <h2>Mahlzeitenplan zum Abhaken</h2>
          <span>{showPlan ? '–' : '+'}</span>
        </button>
        {showPlan && (
          <>
            <p className="muted small pad">Tippen übernimmt die Mahlzeit samt Nährwerten ins Tagebuch.</p>
            <ul className="slots">
              {plan.slots.map((s, i) => (
                <li key={i}>
                  <button className={`slot ${log.meals[i] ? 'done' : ''}`} onClick={() => togglePlanSlot(i)} aria-pressed={log.meals[i]}>
                    <span className="check" aria-hidden>{log.meals[i] ? '✓' : ''}</span>
                    <span className="slotbody">
                      <span className="row between">
                        <strong>{s.time} · {s.label}</strong>
                        <span className="muted small">{s.kcal} kcal</span>
                      </span>
                      <span className="muted small">
                        {s.p} g Protein{s.c > 0 ? ` · ${s.c} g Carbs` : ''}{s.f > 0 ? ` · ${s.f} g Fett` : ''}
                      </span>
                      <span className="hint">{s.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {plan.dayType === 'HIGH_PERFORMANCE' && t && (
        <section className="card">
          <h2>Wie war das Training?</h2>
          <div className="pills">
            {(
              [
                ['gut', 'Stark'],
                ['ok', 'Okay'],
                ['zaeh', 'Zäh'],
              ] as [Feel, string][]
            ).map(([f, label]) => (
              <button key={f} className={`pill ${log.feel === f ? 'on' : ''}`} onClick={() => setLog({ feel: log.feel === f ? undefined : f })}>
                {label}
              </button>
            ))}
          </div>
          <p className="muted small">Ein Tipp reicht. Bei zwei zähen Tagen in Folge gibt die App mehr Kohlenhydrate.</p>
        </section>
      )}

      {plan.notes.length > 0 && (
        <section className="card notes">
          {plan.notes.map((n) => <p key={n}>{n}</p>)}
        </section>
      )}

      {t && t.k !== 'rest' && t.i.length > 0 && (
        <section className="card">
          <button className="linkrow" onClick={() => setShowTrain(!showTrain)} aria-expanded={showTrain}>
            <h2>Training heute</h2>
            <span>{showTrain ? '–' : '+'}</span>
          </button>
          {showTrain && <ul className="train">{t.i.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>
      )}

    </>
  );
}

function CheckIn({ data, update, date }: { data: Data; update: Update; date: string }) {
  const [w, setW] = useState('');
  const save = () => {
    const v = num(w);
    if (!v || v < 30 || v > 250) return;
    update((p) => {
      const next = { ...p, weights: { ...p.weights, [date]: v } };
      return { ...next, settings: adaptAfterWeighIn(next, date) };
    });
  };
  const energy = (e: Energy) =>
    update((p) => {
      const next = { ...p, energy: { ...p.energy, [date]: e } };
      return { ...next, settings: protectAfterEnergy(next, date) };
    });
  return (
    <section className="card checkin">
      <h2>Wochen-Check</h2>
      <p className="muted small">Einmal pro Woche morgens nüchtern wiegen. Mehr nicht.</p>
      <div className="row gap">
        <input inputMode="decimal" placeholder={String(currentWeight(date, data))} value={w} onChange={(e) => setW(e.target.value)} aria-label="Gewicht in kg" />
        <button className="primary small" disabled={!num(w)} onClick={save}>Speichern</button>
      </div>
      <p className="muted small">Wie fühlst du dich?</p>
      <div className="pills">
        {(
          [
            ['fit', 'Fit'],
            ['muede', 'Müde'],
            ['kaputt', 'Kaputt'],
          ] as [Energy, string][]
        ).map(([e, label]) => (
          <button key={e} className={`pill ${data.energy[date] === e ? 'on' : ''}`} onClick={() => energy(e)}>{label}</button>
        ))}
      </div>
    </section>
  );
}
