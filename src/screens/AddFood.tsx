import { useMemo, useState } from 'react';
import type { Data, Entry, Food, Meal, Template } from '../lib/engine';
import { MEALS, entryFromFood, entryFromTemplate, makeTemplate, totals } from '../lib/analytics';
import { BUILTIN_FOODS, precisionOf, searchFoods } from '../lib/foods';
import Scan from './Scan';
import { Icon, Sheet, num, type Notify, type Update } from '../ui';

type Mode = 'suche' | 'scan' | 'mahlzeiten' | 'schnell' | 'eigen';

interface Props {
  meal: Meal;
  date: string;
  data: Data;
  update: Update;
  notify: Notify;
  onClose: () => void;
}

interface Builder {
  name: string;
  portions: string;
  items: Entry[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const de = (n: number) => String(n).replace('.', ',');
const mealLabel = (m: Meal) => MEALS.find((x) => x.id === m)?.label ?? '';

export default function AddFood({ meal: initialMeal, date, data, update, notify, onClose }: Props) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [mode, setMode] = useState<Mode>('suche');
  const [picked, setPicked] = useState<Food | null>(null);
  const [newName, setNewName] = useState('');
  const [builder, setBuilder] = useState<Builder | null>(null);
  const [adding, setAdding] = useState(false);

  const pool = useMemo(() => [...data.customFoods, ...BUILTIN_FOODS], [data.customFoods]);

  const addEntry = (e: Entry) => {
    update((p) => ({ ...p, diary: { ...p.diary, [date]: [...(p.diary[date] ?? []), e] } }));
    onClose();
    notify(`«${e.name}» hinzugefügt`, [
      { label: 'Rückgängig', run: () => update((p) => ({ ...p, diary: { ...p.diary, [date]: (p.diary[date] ?? []).filter((x) => x.id !== e.id) } })) },
    ]);
  };

  const addEntries = (list: Entry[]) => {
    update((p) => ({ ...p, diary: { ...p.diary, [date]: [...(p.diary[date] ?? []), ...list] } }));
    onClose();
    notify(`${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'} hinzugefügt`, [
      { label: 'Rückgängig', run: () => update((p) => ({ ...p, diary: { ...p.diary, [date]: (p.diary[date] ?? []).filter((x) => !list.some((l) => l.id === x.id)) } })) },
    ]);
  };

  // Gescanntes Produkt merken, damit es später in der Suche steht
  const pickScanned = (f: Food) => {
    update((p) => (p.customFoods.some((x) => x.id === f.id) ? p : { ...p, customFoods: [f, ...p.customFoods] }));
    setPicked(f);
    setMode('suche');
  };

  const toggleFav = (id: string) =>
    update((p) => ({ ...p, favorites: p.favorites.includes(id) ? p.favorites.filter((x) => x !== id) : [id, ...p.favorites] }));

  const saveTemplate = () => {
    if (!builder) return;
    const n = num(builder.portions) ?? 1;
    const tpl = makeTemplate(builder.name, builder.items, n);
    update((p) => ({ ...p, templates: [tpl, ...p.templates] }));
    setBuilder(null);
    setMode('mahlzeiten');
    notify(`«${tpl.name}» gespeichert: ${tpl.kcal} kcal pro Portion`);
  };

  const removeTemplate = (tpl: Template) => {
    update((p) => ({ ...p, templates: p.templates.filter((x) => x.id !== tpl.id) }));
    notify(`«${tpl.name}» gelöscht`, [{ label: 'Rückgängig', run: () => update((p) => ({ ...p, templates: [tpl, ...p.templates] })) }]);
  };

  // Zutat zur Mahlzeit hinzufügen (Builder)
  if (builder) {
    if (adding) {
      return (
        <Sheet title="Zutat hinzufügen" onClose={onClose}>
          {picked ? (
            <Portion
              food={picked}
              mealName="der Mahlzeit"
              cta="Zur Mahlzeit hinzufügen"
              fav={data.favorites.includes(picked.id)}
              onFav={() => toggleFav(picked.id)}
              onBack={() => setPicked(null)}
              onAdd={(g) => {
                setBuilder({ ...builder, items: [...builder.items, entryFromFood(picked, g, meal)] });
                setPicked(null);
                setAdding(false);
              }}
            />
          ) : (
            <>
              <button className="s6-btn s6-btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(false)}><Icon n="l" s />Zurück</button>
              <FoodSearch data={data} pool={pool} onPick={setPicked} />
            </>
          )}
        </Sheet>
      );
    }
    const sum = totals(builder.items);
    const n = Math.max(0.25, num(builder.portions) ?? 1);
    return (
      <Sheet title="Neue Mahlzeit" onClose={onClose}>
        <label className="f">
          <span>Name</span>
          <div className="in"><input value={builder.name} onChange={(e) => setBuilder({ ...builder, name: e.target.value })} placeholder="z. B. Reispfanne" /></div>
        </label>
        <label className="f">
          <span>Portionen aus dem ganzen Ansatz</span>
          <div className="in"><input inputMode="decimal" value={builder.portions} onChange={(e) => setBuilder({ ...builder, portions: e.target.value })} /></div>
        </label>
        <div className="lab">Zutaten{builder.items.length > 0 ? ` · Summe ${Math.round(sum.kcal)} kcal` : ''}</div>
        {builder.items.length === 0 && <div className="dash">Noch keine Zutaten. Wiege jede Zutat einmal beim Kochen und füge sie hinzu.</div>}
        {builder.items.map((e) => (
          <div className="ent" key={e.id}>
            <div className="t"><span className="strong">{e.name}</span><span className="xs muted">{e.amount}</span></div>
            <span className="k">{e.kcal}</span>
            <button className="x" aria-label={`${e.name} entfernen`} onClick={() => setBuilder({ ...builder, items: builder.items.filter((x) => x.id !== e.id) })}><Icon n="x" s /></button>
          </div>
        ))}
        {builder.items.length > 0 && (
          <div className="tip soft">
            <div><b style={{ color: 'var(--ink)' }}>Pro Portion (÷ {de(n)})</b><br />{Math.round(sum.kcal / n)} kcal · {r1(sum.p / n)} g P · {r1(sum.c / n)} g C · {r1(sum.f / n)} g F</div>
          </div>
        )}
        <button className="s6-btn s6-btn-quiet w" onClick={() => setAdding(true)}><Icon n="plus" s />{builder.items.length ? 'Weitere Zutat' : 'Zutat hinzufügen'}</button>
        <button className="s6-btn s6-btn-primary w" disabled={!builder.name.trim() || builder.items.length === 0} onClick={saveTemplate}>Mahlzeit speichern</button>
        <button className="link plain" onClick={() => setBuilder(null)}>Abbrechen</button>
      </Sheet>
    );
  }

  return (
    <Sheet title="Essen hinzufügen" onClose={onClose}>
      <div className="chips" role="group" aria-label="Mahlzeit">
        {MEALS.map((m) => (
          <button key={m.id} className={`chip ${meal === m.id ? 'on' : ''}`} onClick={() => setMeal(m.id)}>{m.label}</button>
        ))}
      </div>

      {picked ? (
        <Portion
          food={picked}
          mealName={mealLabel(meal)}
          cta={`Zu ${mealLabel(meal)} hinzufügen`}
          fav={data.favorites.includes(picked.id)}
          onFav={() => toggleFav(picked.id)}
          onBack={() => setPicked(null)}
          onAdd={(g) => addEntry(entryFromFood(picked, g, meal))}
        />
      ) : (
        <>
          <div className="tabs3" role="tablist">
            {(
              [
                ['suche', 'Suchen'],
                ['scan', 'Scan'],
                ['mahlzeiten', 'Mahlzeiten'],
                ['schnell', 'Schnell'],
                ['eigen', 'Neu'],
              ] as [Mode, string][]
            ).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>
            ))}
          </div>

          {mode === 'suche' && (
            <FoodSearch
              data={data}
              pool={pool}
              onPick={setPicked}
              onNew={(q) => {
                setNewName(q);
                setMode('eigen');
              }}
            />
          )}

          {mode === 'scan' && <Scan meal={meal} onFood={pickScanned} onEntries={addEntries} />}

          {mode === 'mahlzeiten' && (
            <>
              {data.templates.length === 0 && <div className="dash">Hier stehen deine Standardmahlzeiten. Einmal wiegen und speichern, danach reicht ein Tipp.</div>}
              {data.templates.map((tpl) => (
                <div className="food" key={tpl.id}>
                  <button className="t" style={{ flex: 1, textAlign: 'left', minHeight: 44 }} onClick={() => addEntry(entryFromTemplate(tpl, 1, meal))}>
                    <span className="name">{tpl.name}</span>
                    <span className="xs muted">{tpl.kcal} kcal · {tpl.p} g Protein · {tpl.items.length} {tpl.items.length === 1 ? 'Zutat' : 'Zutaten'}</span>
                  </button>
                  <button className="x" aria-label={`${tpl.name} löschen`} onClick={() => removeTemplate(tpl)}><Icon n="x" s /></button>
                </div>
              ))}
              <button className="s6-btn s6-btn-quiet w" onClick={() => setBuilder({ name: '', portions: '1', items: [] })}><Icon n="plus" s />Neue Mahlzeit anlegen</button>
            </>
          )}

          {mode === 'schnell' && <QuickAdd meal={meal} onAdd={addEntry} />}
          {mode === 'eigen' && (
            <CreateFood
              initialName={newName}
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

function FoodSearch({ data, pool, onPick, onNew }: { data: Data; pool: Food[]; onPick: (f: Food) => void; onNew?: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const local = useMemo(() => searchFoods(query, pool), [query, pool]);

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

  return (
    <>
      <label className="in focus-in">
        <Icon n="search" s />
        <input type="search" placeholder="Haferflocken, Skyr, Reis …" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Lebensmittel suchen" />
        {query && <button className="x" style={{ margin: 0 }} onClick={() => setQuery('')} aria-label="Suche leeren"><Icon n="x" s /></button>}
      </label>
      {query.trim() === '' ? (
        <>
          <FoodList title="Favoriten" foods={favorites} onPick={onPick} />
          <FoodList title="Zuletzt gegessen" foods={recents} onPick={onPick} />
          {favorites.length === 0 && recents.length === 0 && <p className="sm muted">Tippe einen Namen ein, um in über 90 Lebensmitteln zu suchen.</p>}
        </>
      ) : local.length > 0 ? (
        <FoodList title="Treffer" foods={local} onPick={onPick} />
      ) : (
        <div>
          <p className="body muted">Nichts gefunden.</p>
          {onNew && <button className="link" onClick={() => onNew(query.trim())}>«{query.trim()}» neu anlegen</button>}
          <p className="xs muted">Oder tippe auf «Schnell», wenn du nur die Kalorien kennst.</p>
        </div>
      )}
    </>
  );
}

function FoodList({ title, foods, onPick }: { title: string; foods: Food[]; onPick: (f: Food) => void }) {
  if (!foods.length) return null;
  return (
    <div>
      <div className="lab">{title}</div>
      {foods.map((f) => (
        <button className="food" key={f.id} onClick={() => onPick(f)}>
          <span className="t">
            <span className="name">{f.name}{f.brand && <small className="muted"> · {f.brand}</small>}</span>
            <span className="xs muted">{de(f.kcal)} kcal / 100 g · {de(f.p)} g Protein</span>
          </span>
          {precisionOf(f) === 'weigh' && <span className="badge"><Icon n="scale" s />wiegen</span>}
        </button>
      ))}
    </div>
  );
}

function Portion({ food, mealName, cta, fav, onFav, onBack, onAdd }: {
  food: Food; mealName: string; cta: string; fav: boolean; onFav: () => void; onBack: () => void; onAdd: (g: number) => void;
}) {
  const [g, setG] = useState(String(food.serving?.g ?? 100));
  const grams = num(g) ?? 0;
  const k = grams / 100;
  const prec = precisionOf(food);
  const chips = [
    ...(food.serving ? [{ label: `${food.serving.label} · ${food.serving.g} g`, g: food.serving.g }] : []),
    ...[50, 100, 150, 200].filter((x) => x !== food.serving?.g).map((x) => ({ label: `${x} g`, g: x })),
  ];
  return (
    <>
      <div className="row between">
        <button className="s6-btn s6-btn-ghost" onClick={onBack}><Icon n="l" s />Zurück</button>
        <button className="x" style={{ margin: 0, color: fav ? 'var(--accent-ink)' : 'var(--muted)' }} onClick={onFav} aria-pressed={fav} aria-label={fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten'}><Icon n="star" /></button>
      </div>
      <div>
        <div className="ttl-s">{food.name}</div>
        <div className="xs muted">{food.brand ? `${food.brand} · ` : ''}{mealName} · {de(food.kcal)} kcal pro 100 g</div>
      </div>
      <label className="f">
        <span>Menge</span>
        <div className="in focus-in"><input inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} onFocus={(e) => e.target.select()} /><span className="u">g</span></div>
      </label>
      <div className="chips free">
        {chips.map((c) => (
          <button key={c.label} className={`chip ${grams === c.g ? 'on' : ''}`} onClick={() => setG(String(c.g))}>{c.label}</button>
        ))}
      </div>
      <div className="macro4">
        <div><b>{Math.round(food.kcal * k)}</b><span>Kalorien</span></div>
        <div><b>{de(r1(food.p * k))}</b><span>Protein</span></div>
        <div><b>{de(r1(food.c * k))}</b><span>Kohlenhydrate</span></div>
        <div><b>{de(r1(food.f * k))}</b><span>Fett</span></div>
      </div>
      {prec === 'weigh' && (
        <div className="tip"><Icon n="scale" s /><div>Kalorienreich, bitte wiegen. 10 g mehr oder weniger sind ±{Math.round(food.kcal / 10)} kcal.</div></div>
      )}
      {prec === 'loose' && <div className="tip soft"><div>Kalorienarm. Hier darfst du schätzen, es fällt kaum ins Gewicht.</div></div>}
      <button className="s6-btn s6-btn-primary w" disabled={grams <= 0 || grams > 5000} onClick={() => onAdd(grams)}>{cta}</button>
    </>
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
    const noMacros = !num(p) && !num(c) && !num(f);
    onAdd({
      id: `q${Date.now().toString(36)}`,
      meal,
      name: name.trim() || 'Schnell erfasst',
      kcal: Math.round(k),
      p: num(p) ?? 0,
      c: num(c) ?? 0,
      f: num(f) ?? 0,
      est: noMacros,
    });
  };
  const field = (label: string, v: string, set: (s: string) => void, unit: string, mode: 'numeric' | 'decimal' = 'decimal', auto = false) => (
    <label className="f">
      <span>{label}</span>
      <div className="in"><input inputMode={mode} value={v} onChange={(e) => set(e.target.value)} autoFocus={auto} /><span className="u">{unit}</span></div>
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {field('Kalorien', kcal, setKcal, 'kcal', 'numeric', true)}
      <label className="f"><span>Name (optional)</span><div className="in"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Restaurant-Pizza" /></div></label>
      <div className="cols3">
        {field('Protein', p, setP, 'g')}
        {field('Carbs', c, setC, 'g')}
        {field('Fett', f, setF, 'g')}
      </div>
      <p className="xs muted">Ohne Makros zählt nur die Kalorienzahl. Der Eintrag gilt als geschätzt.</p>
      <button className="s6-btn s6-btn-primary w" type="submit" disabled={!k}>Hinzufügen</button>
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
  const field = (label: string, v: string, set: (s: string) => void, unit?: string) => (
    <label className="f">
      <span>{label}</span>
      <div className="in"><input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} />{unit && <span className="u">{unit}</span>}</div>
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="xs muted">Nährwerte pro 100 g, wie auf der Verpackung.</p>
      <label className="f"><span>Name</span><div className="in"><input value={name} onChange={(e) => setName(e.target.value)} /></div></label>
      <div className="cols2">
        {field('Kalorien', kcal, setKcal, 'kcal')}
        {field('Portion (optional)', sg, setSg, 'g')}
      </div>
      <div className="cols3">
        {field('Protein', p, setP)}
        {field('Carbs', c, setC)}
        {field('Fett', f, setF)}
      </div>
      <button className="s6-btn s6-btn-primary w" type="submit" disabled={!k || !name.trim()}>Speichern und Menge wählen</button>
    </form>
  );
}
