import { useCallback, useEffect, useRef, useState } from 'react';
import { toISO, type Meal } from './lib/engine';
import { Icon, mealByClock, type IconName, type Notify, type ToastAction } from './ui';
import AddFood from './screens/AddFood';
import { useData } from './lib/storage';
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
