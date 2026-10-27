import { useState } from 'react';
import { toISO, type Meal } from './lib/engine';
import { mealByClock } from './ui';
import AddFood from './screens/AddFood';
import { useData } from './lib/storage';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import Week from './screens/Week';
import Progress from './screens/Progress';
import Profile from './screens/Profile';

type Tab = 'heute' | 'woche' | 'fortschritt' | 'profil';

const TABS: [Tab, string][] = [
  ['heute', 'Heute'],
  ['woche', 'Woche'],
  ['fortschritt', 'Fortschritt'],
  ['profil', 'Profil'],
];

export default function App() {
  const [data, update] = useData();
  const [tab, setTab] = useState<Tab>('heute');
  const [date, setDate] = useState(toISO(new Date()));
  const [adding, setAdding] = useState<Meal | null>(null);

  if (!data.settings.onboarded) return <Onboarding update={update} />;

  const tabButton = ([id, label]: [Tab, string]) => (
    <button key={id} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
      {label}
    </button>
  );

  return (
    <div className="app">
      <main key={tab}>
        {tab === 'heute' && <Today date={date} setDate={setDate} data={data} update={update} onAdd={setAdding} />}
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
        {tab === 'fortschritt' && <Progress data={data} update={update} />}
        {tab === 'profil' && <Profile data={data} update={update} />}
      </main>
      <nav aria-label="Hauptnavigation">
        {TABS.slice(0, 2).map(tabButton)}
        <button
          className="nav-add"
          aria-label="Essen hinzufügen"
          onClick={() => {
            setTab('heute');
            setAdding(mealByClock());
          }}
        >
          +
        </button>
        {TABS.slice(2).map(tabButton)}
      </nav>
      {adding && <AddFood meal={adding} date={date} data={data} update={update} onClose={() => setAdding(null)} />}
    </div>
  );
}
