import { useEffect, useMemo, useRef, useState } from 'react';
import type { Data, Entry, Food, Meal } from '../lib/engine';
import { entryFromFood } from '../lib/analytics';
import { precisionOf, searchFoods } from '../lib/foods';
import { Icon, num } from '../ui';

/** Wiegen-Modus: Zutat für Zutat auf die Waage, Gramm eintippen, nächste Zutat. Am Ende alles auf einmal eintragen. */

interface Line {
  id: string;
  food: Food;
  g: number;
  /** Anzeige der Waage nach dieser Zutat (nur im Modus «Summe») */
  reading?: number;
}

type ScaleMode = 'tara' | 'summe';

const KEY_TRAY = 'wiegen-tray';
const KEY_MODE = 'wiegen-mode';
const r1 = (n: number) => Math.round(n * 10) / 10;
const de = (n: number) => String(n).replace('.', ',');

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* privater Modus: ohne Speichern weiter */
  }
};

export function Weigh({ meal, data, pool, onEntries }: { meal: Meal; data: Data; pool: Food[]; onEntries: (list: Entry[]) => void }) {
  const [lines, setLines] = useState<Line[]>(() => read<Line[]>(KEY_TRAY, []));
  const [mode, setMode] = useState<ScaleMode>(() => read<ScaleMode>(KEY_MODE, 'tara'));
  const [query, setQuery] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [reading, setReading] = useState('');
  const gramRef = useRef<HTMLInputElement>(null);

  // Angefangene Wägung übersteht Schliessen und Neuladen
  useEffect(() => write(KEY_TRAY, lines), [lines]);
  useEffect(() => write(KEY_MODE, mode), [mode]);
  useEffect(() => {
    if (food) gramRef.current?.focus();
  }, [food]);

  // Waage zeigt die Summe: Gewicht des Teils = Anzeige minus letzte Anzeige
  const lastTotal = lines.length ? lines[lines.length - 1].reading ?? 0 : 0;
  const shown = num(reading) ?? 0;
  const grams = mode === 'summe' ? Math.round((shown - lastTotal) * 10) / 10 : shown;
  const valid = grams > 0 && grams <= 5000;

  const quick = useMemo(() => {
    const out: Food[] = [];
    const seen = new Set<string>();
    const push = (f?: Food) => {
      if (f && !seen.has(f.id)) {
        seen.add(f.id);
        out.push(f);
      }
    };
    data.favorites.forEach((id) => push(pool.find((f) => f.id === id)));
    for (const d of Object.keys(data.diary).sort().reverse().slice(0, 14)) for (const e of [...data.diary[d]].reverse()) push(pool.find((f) => f.id === e.foodId));
    return out.slice(0, 10);
  }, [data.favorites, data.diary, pool]);
  const hits = useMemo(() => (query.trim() ? searchFoods(query, pool, 8) : quick), [query, pool, quick]);

  const add = () => {
    if (!food || !valid) return;
    setLines((l) => [...l, { id: `${Date.now().toString(36)}${l.length}`, food, g: grams, ...(mode === 'summe' ? { reading: shown } : {}) }]);
    setFood(null);
    setReading('');
    setQuery('');
  };

  const total = lines.reduce((a, l) => ({ kcal: a.kcal + (l.food.kcal * l.g) / 100, p: a.p + (l.food.p * l.g) / 100, c: a.c + (l.food.c * l.g) / 100, f: a.f + (l.food.f * l.g) / 100 }), { kcal: 0, p: 0, c: 0, f: 0 });

  const commit = () => {
    onEntries(lines.map((l) => entryFromFood(l.food, l.g, meal)));
    setLines([]);
  };

  const clear = () => setLines([]);

  return (
    <>
      <div className="chips" role="group" aria-label="Waage">
        <button className={`chip ${mode === 'tara' ? 'on' : ''}`} onClick={() => setMode('tara')}>Waage auf 0</button>
        <button className={`chip ${mode === 'summe' ? 'on' : ''}`} onClick={() => setMode('summe')}>Summe ablesen</button>
      </div>
      <p className="xs muted">
        {mode === 'tara'
          ? 'Teller auf die Waage, auf 0 stellen (Tara), Zutat drauf, Gewicht eintippen. Für die nächste Zutat wieder auf 0.'
          : 'Teller bleibt auf der Waage. Zutat drauf, die angezeigte Summe eintippen. Die App rechnet die Differenz zur letzten Anzeige.'}
      </p>

      {food ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="row between">
            <div>
              <div className="ttl-s">{food.name}</div>
              <div className="xs muted">{de(food.kcal)} kcal · {de(food.p)} P pro 100 g</div>
            </div>
            <button className="s6-btn s6-btn-ghost" onClick={() => { setFood(null); setReading(''); }}>Ändern</button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); add(); }} style={{ display: 'grid', gap: 10 }}>
            <label className="f">
              <span>{mode === 'summe' ? `Waage zeigt (zuletzt ${de(lastTotal)} g)` : 'Gewicht'}</span>
              <div className="in focus-in">
                <input ref={gramRef} inputMode="decimal" value={reading} onChange={(e) => setReading(e.target.value)} onFocus={(e) => e.target.select()} style={{ fontSize: 28 }} aria-label="Gewicht in Gramm" />
                <span className="u">g</span>
              </div>
            </label>
            {mode === 'summe' && shown > 0 && <p className="sm muted">{grams > 0 ? `= ${de(grams)} g für ${food.name}` : 'Die Anzeige ist kleiner als zuletzt. Prüfe die Zahl.'}</p>}
            <div className="macro4">
              <div><b>{valid ? Math.round((food.kcal * grams) / 100) : '–'}</b><span>Kalorien</span></div>
              <div><b>{valid ? de(r1((food.p * grams) / 100)) : '–'}</b><span>Protein</span></div>
              <div><b>{valid ? de(r1((food.c * grams) / 100)) : '–'}</b><span>Kohlenhydrate</span></div>
              <div><b>{valid ? de(r1((food.f * grams) / 100)) : '–'}</b><span>Fett</span></div>
            </div>
            <button className="s6-btn s6-btn-primary w" type="submit" disabled={!valid}>Zur Wägung hinzufügen</button>
          </form>
        </div>
      ) : (
        <>
          <label className="in focus-in">
            <Icon n="search" s />
            <input type="search" placeholder="Nächste Zutat: Reis, Poulet, Öl …" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Zutat suchen" />
          </label>
          {hits.map((f) => (
            <button className="food" key={f.id} onClick={() => setFood(f)}>
              <span className="t">
                <span className="name">{f.name}{f.brand && <small className="muted"> · {f.brand}</small>}</span>
                <span className="xs muted">{de(f.kcal)} kcal / 100 g · {de(f.p)} g Protein</span>
              </span>
              {precisionOf(f) === 'weigh' && <span className="badge"><Icon n="scale" s />wiegen</span>}
            </button>
          ))}
          {query.trim() && hits.length === 0 && <p className="sm muted">Nichts gefunden. Lege die Zutat unter «Neu» an, danach ist sie hier wählbar.</p>}
        </>
      )}

      {lines.length > 0 && (
        <>
          <div className="lab">Gewogen · {Math.round(total.kcal)} kcal</div>
          {lines.map((l) => (
            <div className="ent" key={l.id}>
              <div className="t">
                <span className="strong">{l.food.name}</span>
                <span className="xs muted">{r1((l.food.p * l.g) / 100)} P · {r1((l.food.c * l.g) / 100)} C · {r1((l.food.f * l.g) / 100)} F</span>
              </div>
              <label className="in" style={{ width: 84 }}>
                <input inputMode="decimal" defaultValue={l.g} key={l.g} onBlur={(e) => { const g = num(e.target.value); if (g) setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, g } : x))); }} aria-label={`${l.food.name} Gramm`} />
                <span className="u">g</span>
              </label>
              <span className="k">{Math.round((l.food.kcal * l.g) / 100)}</span>
              <button className="x" aria-label={`${l.food.name} entfernen`} onClick={() => setLines(lines.filter((x) => x.id !== l.id))}><Icon n="x" s /></button>
            </div>
          ))}
          <div className="tip soft"><div>{Math.round(total.kcal)} kcal · {r1(total.p)} g Protein · {r1(total.c)} g Carbs · {r1(total.f)} g Fett</div></div>
          <button className="s6-btn s6-btn-primary w" onClick={commit}>{Math.round(total.kcal)} kcal eintragen</button>
          <button className="link plain" onClick={clear}>Wägung verwerfen</button>
        </>
      )}
    </>
  );
}
