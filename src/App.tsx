import { useCallback, useEffect, useRef, useState } from 'react';
import { addDays, currentWeight, garminExtrasForDay, toISO, type Data, type Extra, type Meal } from './lib/engine';
import { waterGoalMl } from './lib/analytics';
import { GATE_FROM, GATE_MIN_BEHIND, GATE_TO, gateEnabled, gateSnoozedUntil, pushWanted, snoozeGate, waterExpected } from './lib/water';
import { Icon, mealByClock, type IconName, type Notify, type ToastAction } from './ui';
import AddFood from './screens/AddFood';
import { useData } from './lib/storage';
import { fetchGarminActs, fetchGarminSteps, fetchPlanOverrides, garminUser, waterSync } from './lib/garmin';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import Week from './screens/Week';
import Progress from './screens/Progress';
import Profile from './screens/Profile';

type Tab = 'heute' | 'woche' | 'fortschritt' | 'profil';

const TABS: [Tab, string, IconName][] = [
  ['heute', 'Heute', 'today'],
  ['woche', 'Woche', 'week'],
  ['fortschritt', 'Fortschritt', 'chart'],
  ['profil', 'Profil', 'user'],
];

interface ToastState {
  text: string;
  actions: ToastAction[];
}

/** Trink-Pflicht: Liegst du für die Uhrzeit mehr als 300 ml hinter dem Soll, deckt ein Vollbild die App zu, bis du trinkst (oder 45 Min. wartest). */
function WaterGate({ data, update }: { data: Data; update: (f: (p: Data) => Data) => void }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const iv = window.setInterval(bump, 60 * 1000);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);
  const now = new Date();
  const today = toISO(now);
  const hour = now.getHours();
  const goal = waterGoalMl(currentWeight(today, data));
  const ml = data.water[today] ?? 0;
  const behind = Math.max(0, waterExpected(goal, hour) - ml);
  if (!gateEnabled() || document.visibilityState !== 'visible' || hour < GATE_FROM || hour >= GATE_TO || behind < GATE_MIN_BEHIND || Date.now() < gateSnoozedUntil()) return null;
  const drink = (add: number) => {
    update((p) => ({ ...p, water: { ...p.water, [today]: (p.water[today] ?? 0) + add } }));
    snoozeGate(); // nach dem Trinken 45 Minuten Ruhe, auch wenn der Rückstand noch nicht ganz aufgeholt ist
    setTick((t) => t + 1);
  };
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="wg-t" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg, #0b0b10)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: 24 }}>
      <Icon n="drop" />
      <h2 id="wg-t" style={{ margin: 0 }}>Zeit zu trinken</h2>
      <p className="sm" style={{ margin: 0 }}>
        Dir fehlen ca. <b>{behind} ml</b> für diese Uhrzeit ({ml} von {goal} ml). Trink jetzt ein Glas Wasser und bestätige es.
      </p>
      <button className="s6-btn s6-btn-primary w" onClick={() => drink(250)}>Ich habe 250 ml getrunken</button>
      <button className="s6-btn s6-btn-quiet w" onClick={() => drink(500)}>Ich habe 500 ml getrunken</button>
      <button className="link plain" onClick={() => { snoozeGate(); setTick((t) => t + 1); }}>In 45 Minuten wieder erinnern</button>
    </div>
  );
}

export default function App() {
  const [data, update] = useData();
  const [tab, setTab] = useState<Tab>('heute');
  const [date, setDate] = useState(toISO(new Date()));
  const [adding, setAdding] = useState<Meal | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>();

  const notify: Notify = useCallback((text, actions = []) => {
    window.clearTimeout(timer.current);
    setToast({ text, actions });
    timer.current = window.setTimeout(() => setToast(null), actions.length ? 6000 : 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Automatische Schritte: ein iPhone-Kurzbefehl öffnet die App mit ?steps=8234 (optional &date=JJJJ-MM-TT)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const n = Math.round(Number(q.get('steps')));
    if (!q.has('steps')) return;
    const d = q.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(q.get('date')!) ? q.get('date')! : toISO(new Date());
    if (n >= 0 && n <= 80000) {
      update((p) => ({ ...p, steps: { ...(p.steps ?? {}), [d]: n } }));
      notify(`${n.toLocaleString('de-CH')} Schritte übernommen`);
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, [update, notify]);

  // Garmin: Schritte beim Öffnen und danach alle 30 Minuten holen (nur wenn im Profil verbunden)
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      if (document.visibilityState !== 'visible' || !(await garminUser())) return;
      const st = await fetchGarminSteps().catch(() => null);
      if (!alive) return;
      // Ein Fehler bei den Schritten darf Plan und Aktivitäten nicht blockieren
      if (st) {
        update((p) => {
          const cur = p.steps ?? {};
          return Object.entries(st).some(([d, n]) => cur[d] !== n) ? { ...p, steps: { ...cur, ...st } } : p;
        });
      }
      // Plan der Trainings-App (Tausch, Anpassung, Ausfall): damit gilt hier dasselbe Training wie dort
      const ov = await fetchPlanOverrides().catch(() => null);
      if (!alive) return;
      if (ov) update((p) => (JSON.stringify(p.planOverride ?? {}) === JSON.stringify(ov) ? p : { ...p, planOverride: ov }));
      // Zusatz-Einheiten: Garmin-Aktivitäten ausserhalb des Plans übernehmen (höchstens alle 20 Minuten, der Abruf ist schwer)
      let last = 0;
      try {
        last = Number(localStorage.getItem('s60.garmin.acts')) || 0;
      } catch {
        /* gesperrt: einfach abrufen */
      }
      if (Date.now() - last < 20 * 60 * 1000) return;
      const sync = await fetchGarminActs(7).catch(() => null);
      if (!alive || !sync) return;
      const { acts, steps: syncSteps } = sync;
      // Schritte auch aus dem Abruf der Aktivitäten übernehmen (gleiche Verbindung, wirkt sofort ohne neue Server-Version)
      if (Object.keys(syncSteps).length) {
        update((p) => {
          const cur = p.steps ?? {};
          return Object.entries(syncSteps).some(([d, n]) => cur[d] !== n) ? { ...p, steps: { ...cur, ...syncSteps } } : p;
        });
      }
      try {
        localStorage.setItem('s60.garmin.acts', String(Date.now()));
      } catch {
        /* ignorieren */
      }
      update((p) => {
        const today = toISO(new Date());
        const next = { ...(p.extras ?? {}) };
        let changed = false;
        for (let i = 0; i < 7; i++) {
          const d = addDays(today, -i);
          const old = next[d] ?? [];
          const off = new Set(old.filter((e) => e.src === 'garmin' && e.off).map((e) => e.gid));
          const fresh: Extra[] = garminExtrasForDay(d, acts, p).map((e) => ({ ...e, off: off.has(e.gid) || undefined }));
          const merged = [...old.filter((e) => e.src !== 'garmin'), ...fresh];
          if (JSON.stringify(merged) !== JSON.stringify(old)) {
            changed = true;
            if (merged.length) next[d] = merged;
            else delete next[d];
          }
        }
        return changed ? { ...p, extras: next } : p;
      });
    };
    pull();
    const iv = window.setInterval(pull, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', pull);
    return () => {
      alive = false;
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', pull);
    };
  }, [update]);

  // Wasserstand an die Push-Funktion melden (nur wenn die Erinnerung aufs Handy eingeschaltet ist), damit sie nicht umsonst erinnert
  const todayWater = data.water[toISO(new Date())] ?? 0;
  const waterGoal = waterGoalMl(currentWeight(toISO(new Date()), data));
  useEffect(() => {
    if (!pushWanted()) return;
    const t = window.setTimeout(() => waterSync(toISO(new Date()), todayWater, waterGoal), 1500);
    return () => window.clearTimeout(t);
  }, [todayWater, waterGoal]);

  if (!data.settings.onboarded) return <Onboarding update={update} />;

  const tabButton = ([id, label, icon]: [Tab, string, IconName]) => (
    <button key={id} className={`ni ${tab === id ? 'on' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
      <Icon n={icon} />
      {label}
    </button>
  );

  return (
    <div className="app">
      <main key={tab}>
        {tab === 'heute' && <Today date={date} setDate={setDate} data={data} update={update} onAdd={setAdding} notify={notify} />}
        {tab === 'woche' && (
          <Week
            date={date}
            setDate={setDate}
            data={data}
            open={(d) => {
              setDate(d);
              setTab('heute');
            }}
          />
        )}
        {tab === 'fortschritt' && <Progress data={data} update={update} notify={notify} />}
        {tab === 'profil' && <Profile data={data} update={update} notify={notify} />}
      </main>
      <nav className="nav" aria-label="Hauptnavigation">
        {TABS.slice(0, 2).map(tabButton)}
        <button
          className="plus"
          aria-label="Essen hinzufügen"
          onClick={() => {
            setTab('heute');
            setAdding(mealByClock());
          }}
        >
          <Icon n="plus" />
        </button>
        {TABS.slice(2).map(tabButton)}
      </nav>
      <WaterGate data={data} update={update} />
      {adding && <AddFood meal={adding} date={date} data={data} update={update} notify={notify} onClose={() => setAdding(null)} />}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setToast(null);
                a.run();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
