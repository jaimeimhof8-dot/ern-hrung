import { useMemo, useState } from 'react';
import {
  DAY_LABEL,
  addDays,
  adaptAfterWeighIn,
  computeDay,
  currentWeight,
  daysToRace,
  emptyLog,
  isProtected,
  parseISO,
  protectAfterEnergy,
  toISO,
  type Data,
  type Energy,
  type Entry,
  type Feel,
  type Meal,
  type Slot,
  type Template,
} from '../lib/engine';
import { MEALS, entryFromTemplate, totals, waterGoalMl } from '../lib/analytics';
import { Head, Icon, Macro, Ring, WeighSheet, TYPE_CLASS, TYPE_COLOR, fmt, longDate, shortDate, type Notify, type Update } from '../ui';
import PortionSheet from './PortionSheet';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const mondayOf = (iso: string) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Plan-Mahlzeit nach Uhrzeit einer Mahlzeitengruppe zuordnen. */
function mealOfSlot(slot: Slot): Meal {
  const h = parseInt(slot.time, 10);
  return h < 11 ? 'fruehstueck' : h < 15 ? 'mittag' : h < 17 ? 'snack' : 'abend';
}

export default function Today({ date, setDate, data, update, onAdd, notify }: {
  date: string;
  setDate: (d: string) => void;
  data: Data;
  update: Update;
  onAdd: (m: Meal) => void;
  notify: Notify;
}) {
  const plan = useMemo(() => computeDay(date, data), [date, data]);
  const log = data.logs[date] ?? emptyLog();
  const entries = data.diary[date] ?? [];
  const eaten = totals(entries);
  const today = toISO(new Date());
  const t = plan.trainingDay;
  const s = data.settings;
  const [showPlan, setShowPlan] = useState(false);
  const [showTrain, setShowTrain] = useState(false);
  const [portionId, setPortionId] = useState<string | null>(null);
  const [weighing, setWeighing] = useState(false);

  const setLog = (patch: Partial<typeof log>) =>
    update((p) => ({ ...p, logs: { ...p.logs, [date]: { ...emptyLog(), ...p.logs[date], ...patch } } }));

  const addEntries = (list: Entry[]) =>
    update((p) => ({ ...p, diary: { ...p.diary, [date]: [...(p.diary[date] ?? []), ...list] } }));
  const removeIds = (ids: string[]) =>
    update((p) => ({ ...p, diary: { ...p.diary, [date]: (p.diary[date] ?? []).filter((e) => !ids.includes(e.id)) } }));
  const replaceEntry = (e: Entry) =>
    update((p) => ({ ...p, diary: { ...p.diary, [date]: (p.diary[date] ?? []).map((x) => (x.id === e.id ? e : x)) } }));

  const yesterday = data.diary[addDays(date, -1)] ?? [];
  const copyOf = (src: Entry[]) => src.map((e) => ({ ...e, id: uid() }));
  const copyDay = () => {
    const copies = copyOf(yesterday);
    addEntries(copies);
    notify(`${copies.length} ${copies.length === 1 ? 'Eintrag' : 'Einträge'} von gestern übernommen`, [
      { label: 'Rückgängig', run: () => removeIds(copies.map((c) => c.id)) },
    ]);
  };
  const copyMeal = (meal: Meal) => {
    const copies = copyOf(yesterday.filter((e) => e.meal === meal));
    addEntries(copies);
    notify(`${copies.length} ${copies.length === 1 ? 'Eintrag' : 'Einträge'} von gestern übernommen`, [
      { label: 'Rückgängig', run: () => removeIds(copies.map((c) => c.id)) },
    ]);
  };

  // Schnellwahl: Standardmahlzeiten, die zu dieser Mahlzeit am häufigsten gegessen wurden, zuerst
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of Object.keys(data.diary)) {
      for (const e of data.diary[d]) {
        if (e.foodId?.startsWith('t:')) m.set(`${e.meal}|${e.foodId.slice(2)}`, (m.get(`${e.meal}|${e.foodId.slice(2)}`) ?? 0) + 1);
      }
    }
    return m;
  }, [data.diary]);
  const quickFor = (meal: Meal): Template[] =>
    [...data.templates].sort((a, b) => (usage.get(`${meal}|${b.id}`) ?? 0) - (usage.get(`${meal}|${a.id}`) ?? 0)).slice(0, 6);

  const addTemplate = (tpl: Template, meal: Meal) => {
    const e = entryFromTemplate(tpl, 1, meal);
    addEntries([e]);
    notify(`«${tpl.name}» hinzugefügt`, [
      { label: 'Rückgängig', run: () => removeIds([e.id]) },
      { label: '½ / 1½ / 2', run: () => setPortionId(e.id) },
    ]);
  };

  const portionEntry = portionId ? entries.find((e) => e.id === portionId) : undefined;
  const portionTpl = portionEntry?.foodId?.startsWith('t:') ? data.templates.find((x) => x.id === portionEntry.foodId!.slice(2)) : undefined;

  const togglePlanSlot = (i: number) => {
    const slot = plan.slots[i];
    const id = `plan-${i}`;
    const on = entries.some((e) => e.id === id);
    update((p) => {
      const list = (p.diary[date] ?? []).filter((e) => e.id !== id);
      if (!on) {
        list.push({ id, meal: mealOfSlot(slot), name: `Plan: ${slot.label}`, kcal: slot.kcal, p: slot.p, c: slot.c, f: slot.f, amount: slot.time });
      }
      const meals = [...(p.logs[date]?.meals ?? emptyLog().meals)];
      meals[i] = !on;
      return { ...p, diary: { ...p.diary, [date]: list }, logs: { ...p.logs, [date]: { ...emptyLog(), ...p.logs[date], meals } } };
    });
  };

  const needsCheck = date === today && !Object.keys(data.weights).some((w) => w > addDays(today, -7));
  const water = data.water[date] ?? 0;
  const waterGoal = waterGoalMl(currentWeight(date, data));
  const addWater = (ml: number) => update((p) => ({ ...p, water: { ...p.water, [date]: Math.max(0, (p.water[date] ?? 0) + ml) } }));

  const protectedNow = isProtected(date, s);
  const calibRecent = !!s.calib && !!s.calibDate && date >= s.calibDate && date <= addDays(s.calibDate, 14);
  const color = TYPE_COLOR[plan.dayType];
  const mon = mondayOf(date);
  const notes = plan.notes.filter((n) => !n.startsWith('Peak-Phase') && !n.startsWith('Schutzmodus aktiv'));

  return (
    <>
      <Head
        kicker={plan.weekNo >= 1 && plan.weekName ? `Woche ${plan.weekNo} · ${plan.weekName}` : 'Ausserhalb des Plans'}
        title={date === today ? 'Heute' : longDate(date).split(',')[0]}
        prev={['Vortag', () => setDate(addDays(date, -1))]}
        next={['Folgetag', () => setDate(addDays(date, 1))]}
      />
      {date !== today && <div className="xs muted" style={{ padding: '0 4px' }}>{longDate(date)} · <button className="link" style={{ padding: 0 }} onClick={() => setDate(today)}>Zu heute</button></div>}

      <div className="strip" role="group" aria-label="Woche">
        {WD.map((w, i) => {
          const d = addDays(mon, i);
          const dp = computeDay(d, data);
          return (
            <button key={d} className={`wd ${TYPE_CLASS[dp.dayType]} ${d === date ? 'on' : ''}`} onClick={() => setDate(d)} aria-label={`${w} ${shortDate(d)}`} aria-pressed={d === date}>
              {w}
              <i className={data.diary[d]?.length ? 'f' : ''} />
            </button>
          );
        })}
      </div>

      <section className={`hero ${TYPE_CLASS[plan.dayType]}`}>
        <div className="row between">
          <span className="s6-tag"><i style={{ '--c': color } as React.CSSProperties} />{DAY_LABEL[plan.dayType]}</span>
          {protectedNow ? (
            <span className="pill"><i style={{ '--c': 'var(--ok)' } as React.CSSProperties} />Schutzmodus</span>
          ) : (
            plan.idx >= 0 && daysToRace(date) >= 0 && <span className="xs muted">{daysToRace(date)} Tage bis Basel</span>
          )}
        </div>
        <div className="ttl-s">{t ? t.t : 'Kein Training geplant'}</div>
        <div className="big">
          <Ring value={eaten.kcal} target={plan.kcal} color={color} />
          <dl className="kv" style={{ margin: 0 }}>
            <div><dt>Ziel</dt><b>{plan.kcal}</b></div>
            <div><dt>Gegessen</dt><b className={eaten.kcal > plan.kcal ? 'danger' : ''}>{Math.round(eaten.kcal)}</b></div>
          </dl>
        </div>
        {eaten.kcal > plan.kcal && (
          <div className="banner"><Icon n="chart" /><div className="xs">+{Math.round(eaten.kcal - plan.kcal)} kcal über dem Ziel. Das Wochenmittel zählt: Gleiche es an den nächsten Tagen aus oder lass es einfach stehen.</div></div>
        )}
        <Macro label="Protein" value={eaten.p} target={plan.protein} />
        <Macro label="Kohlenhydrate" value={eaten.c} target={plan.carbs} />
        <Macro label="Fett" value={eaten.f} target={plan.fat} />
        <div className="xs muted">{plan.window}</div>
        {protectedNow && (
          <div className="banner ok-b" style={{ alignItems: 'flex-start' }}>
            <Icon n="check" />
            <div className="xs">
              <b>Schutzmodus{s.protectUntil && !s.redsStop ? ` bis ${shortDate(s.protectUntil)}` : ''}.</b> Kein Defizit, mehr Energie: mindestens 40 kcal pro kg fettfreier Masse.
              <br />
              <button className="link" style={{ padding: 0 }} onClick={() => update((p) => ({ ...p, settings: { ...p.settings, redsStop: false, protectUntil: undefined } }))}>Beenden</button>
            </div>
          </div>
        )}
        {plan.weekNo >= 13 && !protectedNow && (
          <div className="banner" style={{ alignItems: 'flex-start' }}><Icon n="chart" /><div className="xs"><b>Peak-Phase.</b> Ab jetzt kein Defizit mehr. Du isst für die Leistung in Basel.</div></div>
        )}
        {calibRecent && (
          <div className="banner"><Icon n="chart" /><div className="xs">{s.calib! > 0 ? '+' : '−'}{Math.abs(s.calib!)} kcal seit der Kalibrierung. Dein Gewicht zeigt, dass du {s.calib! > 0 ? 'mehr' : 'weniger'} brauchst, als die Formel sagt.</div></div>
        )}
      </section>

      {needsCheck && <CheckIn data={data} update={update} date={date} onWeigh={() => setWeighing(true)} />}

      {entries.length === 0 && yesterday.length > 0 && (
        <button className="c tight" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} onClick={copyDay}>
          <Icon n="copy" />
          <span className="grow"><span className="strong">Gestern übernehmen</span><br /><span className="xs muted">{yesterday.length} {yesterday.length === 1 ? 'Eintrag' : 'Einträge'} · {Math.round(totals(yesterday).kcal)} kcal, danach anpassen</span></span>
          <Icon n="r" s />
        </button>
      )}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.id);
        const sum = totals(list);
        const quick = quickFor(m.id);
        const yHas = yesterday.some((e) => e.meal === m.id);
        return (
          <section className="c tight" key={m.id}>
            <div className="meal-h">
              <span className="lab">{m.label}</span>
              <span className="row" style={{ gap: 10 }}>
                {list.length > 0 && <span className="xs muted">{Math.round(sum.kcal)} kcal</span>}
                <button className="add" onClick={() => onAdd(m.id)} aria-label={`Zu ${m.label} hinzufügen`}><Icon n="plus" s /></button>
              </span>
            </div>
            {list.map((e) => {
              const tpl = e.foodId?.startsWith('t:') ? data.templates.find((x) => x.id === e.foodId!.slice(2)) : undefined;
              const body = (
                <>
                  <span className="strong">{e.name}</span>
                  {e.est ? (
                    <span className="xs est">≈ geschätzt · nur Kalorien</span>
                  ) : (
                    <span className="xs muted">{e.amount ? `${e.amount} · ` : ''}{e.p} P · {e.c} C · {e.f} F</span>
                  )}
                </>
              );
              return (
                <div className="ent" key={e.id}>
                  {tpl ? <button className="t" onClick={() => setPortionId(e.id)} aria-label={`${e.name}: Portion ändern`}>{body}</button> : <div className="t">{body}</div>}
                  <span className="k">{e.kcal}</span>
                  <button className="x" onClick={() => removeIds([e.id])} aria-label={`${e.name} entfernen`}><Icon n="x" s /></button>
                </div>
              );
            })}
            {list.length === 0 && quick.length === 0 && !yHas && <div className="xs muted">Noch nichts eingetragen</div>}
            {(quick.length > 0 || (list.length === 0 && yHas)) && (
              <div className="qrow">
                {list.length === 0 && yHas && (
                  <button className="qchip" onClick={() => copyMeal(m.id)}>Von gestern<small>{yesterday.filter((e) => e.meal === m.id).length} Einträge</small></button>
                )}
                {quick.map((q) => (
                  <button className="qchip" key={q.id} onClick={() => addTemplate(q, m.id)}>{q.name}<small>{q.kcal} kcal</small></button>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="c tight">
        <div className="meal-h">
          <span className="lab">Wasser</span>
          <span className="xs muted">{fmt(water / 1000, 2)} / {fmt(waterGoal / 1000, 2)} l</span>
        </div>
        <div className="mb" style={{ '--c': 'var(--lauf)' } as React.CSSProperties}><div className="trk"><div className="fil" style={{ width: `${Math.min(100, (water / waterGoal) * 100)}%` }} /></div></div>
        <div className="chips">
          <button className="chip" onClick={() => addWater(250)}><Icon n="drop" s />250 ml</button>
          <button className="chip" onClick={() => addWater(500)}><Icon n="drop" s />500 ml</button>
          <button className="chip" onClick={() => addWater(-250)} aria-label="250 ml abziehen">−250</button>
        </div>
      </section>

      <section className="c tight">
        <button className="meal-h" style={{ minHeight: 28 }} onClick={() => setShowPlan(!showPlan)} aria-expanded={showPlan}>
          <span className="lab">Mahlzeitenplan zum Abhaken</span>
          <span className="muted" style={{ transform: showPlan ? 'rotate(90deg)' : 'none' }}><Icon n="r" s /></span>
        </button>
        {showPlan && (
          <>
            <div className="xs muted">Tippen übernimmt die Mahlzeit samt Nährwerten ins Tagebuch.</div>
            {plan.slots.map((sl, i) => (
              <button key={i} className="ent" style={{ alignItems: 'flex-start', opacity: log.meals[i] ? 0.6 : 1, width: '100%' }} onClick={() => togglePlanSlot(i)} aria-pressed={log.meals[i]}>
                <span style={{ flex: 'none', width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', background: log.meals[i] ? 'var(--accent)' : 'transparent', color: 'var(--on-accent)', boxShadow: log.meals[i] ? 'none' : 'inset 0 0 0 2px var(--muted)' }}>
                  {log.meals[i] && <Icon n="check" s />}
                </span>
                <span className="t">
                  <span className="row between"><b className="strong">{sl.time} · {sl.label}</b><span className="xs muted">{sl.kcal} kcal</span></span>
                  <span className="xs muted">{sl.p} g Protein{sl.c > 0 ? ` · ${sl.c} g Carbs` : ''}{sl.f > 0 ? ` · ${sl.f} g Fett` : ''}</span>
                  <span className="xs" style={{ marginTop: 4 }}>{sl.hint}</span>
                </span>
              </button>
            ))}
          </>
        )}
      </section>

      {plan.dayType === 'HIGH_PERFORMANCE' && t && (
        <section className="c tight">
          <span className="lab">Wie war das Training?</span>
          <div className="chips">
            {([['gut', 'Stark'], ['ok', 'Okay'], ['zaeh', 'Zäh']] as [Feel, string][]).map(([f, label]) => (
              <button key={f} className={`chip ${log.feel === f ? 'on' : ''}`} onClick={() => setLog({ feel: log.feel === f ? undefined : f })}>{label}</button>
            ))}
          </div>
          <div className="xs muted">Ein Tipp reicht. Bei zwei zähen Tagen in Folge gibt die App mehr Kohlenhydrate.</div>
        </section>
      )}

      {notes.length > 0 && (
        <section className="c tight">{notes.map((n) => <p className="sm" key={n}>{n}</p>)}</section>
      )}

      {t && t.k !== 'rest' && t.i.length > 0 && (
        <section className="c tight">
          <button className="meal-h" style={{ minHeight: 28 }} onClick={() => setShowTrain(!showTrain)} aria-expanded={showTrain}>
            <span className="lab">Training heute</span>
            <span className="muted" style={{ transform: showTrain ? 'rotate(90deg)' : 'none' }}><Icon n="r" s /></span>
          </button>
          {showTrain && <ul className="sm" style={{ margin: 0, paddingLeft: 18 }}>{t.i.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>
      )}

      {portionEntry && portionTpl && (
        <PortionSheet
          entry={portionEntry}
          template={portionTpl}
          onClose={() => setPortionId(null)}
          onApply={(e) => {
            replaceEntry(e);
            setPortionId(null);
          }}
          onDelete={() => {
            removeIds([portionEntry.id]);
            setPortionId(null);
          }}
        />
      )}
      {weighing && (
        <WeighSheet
          date={date}
          initial={currentWeight(date, data)}
          onClose={() => setWeighing(false)}
          onSave={(kg) => {
            update((p) => {
              const next = { ...p, weights: { ...p.weights, [date]: kg } };
              return { ...next, settings: adaptAfterWeighIn(next, date) };
            });
            setWeighing(false);
            notify(`${fmt(kg)} kg gespeichert`);
          }}
        />
      )}
    </>
  );
}

function CheckIn({ data, update, date, onWeigh }: { data: Data; update: Update; date: string; onWeigh: () => void }) {
  const energy = (e: Energy) =>
    update((p) => {
      const next = { ...p, energy: { ...p.energy, [date]: e } };
      return { ...next, settings: protectAfterEnergy(next, date) };
    });
  return (
    <section className="c tight">
      <span className="lab">Wochen-Check</span>
      <div className="xs muted">Einmal pro Woche morgens nüchtern wiegen. Mehr nicht.</div>
      <button className="s6-btn s6-btn-quiet w" onClick={onWeigh}><Icon n="scale" s />Gewicht eintragen</button>
      <div className="xs muted">Wie fühlst du dich?</div>
      <div className="chips">
        {([['fit', 'Fit'], ['muede', 'Müde'], ['kaputt', 'Kaputt']] as [Energy, string][]).map(([e, label]) => (
          <button key={e} className={`chip ${data.energy[date] === e ? 'on' : ''}`} onClick={() => energy(e)}>{label}</button>
        ))}
      </div>
    </section>
  );
}
