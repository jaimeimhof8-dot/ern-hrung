import { useCallback, useMemo, useState } from 'react';
import type { Data, Entry, Food, Meal } from '../lib/engine';
import { MEALS, entryFromFood } from '../lib/analytics';
import { BUILTIN_FOODS, searchFoods } from '../lib/foods';
import { Sheet, num, type Update } from '../ui';

type Mode = 'suche' | 'schnell' | 'eigen';

interface Props {
  meal: Meal;
  date: string;
  data: Data;
  update: Update;
  onClose: () => void;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export default function AddFood({ meal: initialMeal, date, data, update, onClose }: Props) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [mode, setMode] = useState<Mode>('suche');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Food | null>(null);

  const pool = useMemo(() => [...data.customFoods, ...BUILTIN_FOODS], [data.customFoods]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Food[] = [];
    for (const d of Object.keys(data.diary).sort().reverse().slice(0, 14)) {
      for (const e of [...data.diary[d]].reverse()) {
        if (!e.foodId || seen.has(e.foodId)) continue;
        const f = pool.find((x) => x.id === e.foodId);
        if (f) {
          seen.add(e.foodId);
          out.push(f);
        }
      }
    }
    return out.slice(0, 12);
  }, [data.diary, pool]);

  const favorites = useMemo(
    () => data.favorites.map((id) => pool.find((f) => f.id === id)).filter((f): f is Food => !!f),
    [data.favorites, pool],
  );

  const local = useMemo(() => searchFoods(query, pool), [query, pool]);

  const addEntry = useCallback(
    (e: Entry) => {
      update((p) => ({ ...p, diary: { ...p.diary, [date]: [...(p.diary[date] ?? []), e] } }));
      onClose();
    },
    [update, date, onClose],
  );

  const toggleFav = (id: string) =>
    update((p) => ({ ...p, favorites: p.favorites.includes(id) ? p.favorites.filter((x) => x !== id) : [id, ...p.favorites] }));

  return (
    <Sheet title="Essen hinzufügen" onClose={onClose}>
      <div className="pills tight" role="group" aria-label="Mahlzeit">
        {MEALS.map((m) => (
          <button key={m.id} className={`pill sm ${meal === m.id ? 'on' : ''}`} onClick={() => setMeal(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {picked ? (
        <Portion
          food={picked}
          fav={data.favorites.includes(picked.id)}
          onFav={() => toggleFav(picked.id)}
          onBack={() => setPicked(null)}
          onAdd={(g) => addEntry(entryFromFood(picked, g, meal))}
        />
      ) : (
        <>
          <div className="tabs" role="tablist">
            {(
              [
                ['suche', 'Suchen'],
                ['schnell', 'Schnell'],
                ['eigen', 'Neu anlegen'],
              ] as [Mode, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>

          {mode === 'suche' && (
            <>
              <input
                type="search"
                className="search"
                placeholder="z. B. Haferflocken, Skyr, Reis …"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Lebensmittel suchen"
              />
              {query.trim() === '' ? (
                <>
                  <FoodList title="Favoriten" foods={favorites} onPick={setPicked} />
                  <FoodList title="Zuletzt gegessen" foods={recents} onPick={setPicked} />
                  {favorites.length === 0 && recents.length === 0 && (
                    <p className="muted small pad">Tippe einen Namen ein, um in über 90 Lebensmitteln zu suchen.</p>
                  )}
                </>
              ) : (
                <>
                  <FoodList title={local.length ? 'Treffer' : ''} foods={local} onPick={setPicked} />
                  {local.length === 0 && (
                    <div className="pad">
                      <p className="muted small">Nichts gefunden.</p>
                      <button className="link" onClick={() => setMode('eigen')}>„{query.trim()}“ neu anlegen</button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {mode === 'schnell' && <QuickAdd meal={meal} onAdd={addEntry} />}
          {mode === 'eigen' && (
            <CreateFood
              initialName={query}
              onCreate={(f) => {
                update((p) => ({ ...p, customFoods: [f, ...p.customFoods] }));
                setPicked(f);
                setMode('suche');
              }}
            />
          )}
        </>
      )}
    </Sheet>
  );
}

function FoodList({ title, foods, onPick }: { title: string; foods: Food[]; onPick: (f: Food) => void }) {
  if (!foods.length) return null;
  return (
    <div className="foodlist">
      {title && <h3>{title}</h3>}
      <ul>
        {foods.map((f) => (
          <li key={f.id}>
            <button onClick={() => onPick(f)}>
              <span className="fname">
                {f.name}
                {f.brand && <small className="muted"> · {f.brand}</small>}
              </span>
              <span className="muted small">
                {f.kcal} kcal / 100 g · {f.p} P
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Portion({ food, fav, onFav, onBack, onAdd }: {
  food: Food; fav: boolean; onFav: () => void; onBack: () => void; onAdd: (g: number) => void;
}) {
  const [g, setG] = useState(String(food.serving?.g ?? 100));
  const grams = num(g) ?? 0;
  const k = grams / 100;
  const chips = [
    ...(food.serving ? [{ label: `${food.serving.label} · ${food.serving.g} g`, g: food.serving.g }] : []),
    { label: '50 g', g: 50 },
    { label: '100 g', g: 100 },
    { label: '150 g', g: 150 },
    { label: '200 g', g: 200 },
  ];
  return (
    <div className="portion">
      <div className="row between">
        <button className="ghost sm" onClick={onBack}>‹ Zurück</button>
        <button className="icon-btn" onClick={onFav} aria-pressed={fav} aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}>
          {fav ? '★' : '☆'}
        </button>
      </div>
      <h3 className="pname">{food.name}</h3>
      {food.brand && <p className="muted small">{food.brand}</p>}
      <label className="field">
        <span>Menge (g oder ml)</span>
        <input inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} />
      </label>
      <div className="pills tight">
        {chips.map((c) => (
          <button key={c.label} className={`pill sm ${grams === c.g ? 'on' : ''}`} onClick={() => setG(String(c.g))}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="macros">
        <div><strong>{Math.round(food.kcal * k)}</strong><span>kcal</span></div>
        <div><strong>{r1(food.p * k)} g</strong><span>Protein</span></div>
        <div><strong>{r1(food.c * k)} g</strong><span>Carbs</span></div>
        <div><strong>{r1(food.f * k)} g</strong><span>Fett</span></div>
      </div>
      <button className="primary" disabled={grams <= 0 || grams > 5000} onClick={() => onAdd(grams)}>
        Hinzufügen
      </button>
    </div>
  );
}

function QuickAdd({ meal, onAdd }: { meal: Meal; onAdd: (e: Entry) => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const k = num(kcal);
  const submit = () => {
    if (!k) return;
    onAdd({
      id: `q${Date.now().toString(36)}`,
      meal,
      name: name.trim() || 'Schnell erfasst',
      kcal: Math.round(k),
      p: num(p) ?? 0,
      c: num(c) ?? 0,
      f: num(f) ?? 0,
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="field"><span>Kalorien (kcal)</span><input inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} autoFocus /></label>
      <label className="field"><span>Name (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Restaurant-Pizza" /></label>
      <div className="grid3">
        <label className="field"><span>Protein (g)</span><input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="field"><span>Carbs (g)</span><input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="field"><span>Fett (g)</span><input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
      </div>
      <button className="primary" type="submit" disabled={!k}>Hinzufügen</button>
    </form>
  );
}

function CreateFood({ initialName, onCreate }: { initialName: string; onCreate: (f: Food) => void }) {
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const [sg, setSg] = useState('');
  const k = num(kcal);
  const submit = () => {
    if (!k || !name.trim()) return;
    const s = num(sg);
    onCreate({
      id: `c-${Date.now().toString(36)}`,
      name: name.trim(),
      kcal: k,
      p: num(p) ?? 0,
      c: num(c) ?? 0,
      f: num(f) ?? 0,
      ...(s ? { serving: { label: 'Portion', g: s } } : {}),
    });
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <p className="muted small pad">Nährwerte pro 100 g, wie auf der Verpackung.</p>
      <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>kcal</span><input inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} /></label>
        <label className="field"><span>Portion (g, optional)</span><input inputMode="decimal" value={sg} onChange={(e) => setSg(e.target.value)} /></label>
      </div>
      <div className="grid3">
        <label className="field"><span>Protein</span><input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></label>
        <label className="field"><span>Carbs</span><input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} /></label>
        <label className="field"><span>Fett</span><input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} /></label>
      </div>
      <button className="primary" type="submit" disabled={!k || !name.trim()}>Speichern und Menge wählen</button>
    </form>
  );
}
