import { useEffect, useRef, useState } from 'react';
import type { Entry, Meal } from '../lib/engine';
import { accessToken } from '../lib/garmin';
import { MEALS } from '../lib/analytics';
import { Icon, num } from '../ui';

interface Item {
  name: string;
  g: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** vom Gericht her üblich, vom Nutzer aber nicht genannt */
  assumed?: boolean;
}

interface Dish {
  name: string;
  meal: Meal;
  items: Item[];
  /** true = jede Zutat als eigener Eintrag, false = ein Eintrag fürs ganze Gericht */
  split: boolean;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const sumOf = (items: Item[]) =>
  items.reduce((a, x) => ({ g: a.g + x.g, kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }), { g: 0, kcal: 0, p: 0, c: 0, f: 0 });

/** Browser-Diktat (Chrome, Edge, Safari/iOS). Firefox hat es nicht: dort bleibt das Mikrofon der Tastatur. */
const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : undefined;

async function describe(text: string) {
  const res = await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await accessToken()) ?? ''}` }, body: JSON.stringify({ kind: 'text', text }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Analyse fehlgeschlagen');
  return body as { meals?: { name: string; meal: Meal | null; items: Item[] }[] };
}

/** Tab «Beschreiben»: Essen tippen oder diktieren, die App erkennt das Gericht und schätzt es. */
export function Describe({ meal, onEntries, onSaveStandard }: { meal: Meal; onEntries: (list: Entry[]) => void; onSaveStandard: (name: string, items: Entry[], drink: boolean) => void }) {
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [stdName, setStdName] = useState('');
  const [stdDrink, setStdDrink] = useState(false);

  // Diktat
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<any>(null);
  const base = useRef('');
  useEffect(() => () => rec.current?.abort?.(), []);

  const toggleDictation = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new SR();
    r.lang = 'de-CH';
    r.continuous = true;
    r.interimResults = true;
    base.current = desc.trim();
    r.onresult = (e: any) => {
      let fin = '';
      let tmp = '';
      for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript));
      setDesc([base.current, fin.trim()].filter(Boolean).join(', '));
      setInterim(tmp);
    };
    r.onerror = (e: any) => {
      setErr(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Mikrofon nicht erlaubt. Erlaube es in den Browser-Einstellungen oder nutze das Mikrofon deiner Tastatur.' : e.error === 'no-speech' ? '' : 'Diktat nicht möglich. Nutze das Mikrofon deiner Tastatur.');
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    setErr('');
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const run = async () => {
    rec.current?.stop?.();
    setBusy(true);
    setErr('');
    try {
      const r = await describe([desc, interim].filter(Boolean).join(' ').trim());
      if (!r.meals?.length) throw new Error('Aus der Beschreibung konnte ich kein Essen herauslesen. Nenne Zutaten oder Gericht, z. B. «Salat, Chicken, Hüttenkäse, Tomaten».');
      // Mehrere Zutaten = ein Gericht (ein Eintrag); der Nutzer kann sie aufteilen
      setDishes(r.meals.map((m) => ({ name: m.name || m.items[0].name, meal: m.meal ?? meal, items: m.items, split: m.items.length === 1 })));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  const patch = (i: number, p: Partial<Dish>) => setDishes((d) => d && d.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const scale = (i: number, k: number, g: number) =>
    setDishes((d) =>
      d &&
      d.map((dish, j) =>
        j !== i ? dish : { ...dish, items: dish.items.map((x, n) => (n === k && x.g > 0 && g > 0 ? { ...x, g, kcal: Math.round((x.kcal * g) / x.g), p: r1((x.p * g) / x.g), c: r1((x.c * g) / x.g), f: r1((x.f * g) / x.g), assumed: false } : x)) },
      ),
    );

  const toEntries = (dish: Dish, tag: number): Entry[] => {
    const id = (n: number) => `s${Date.now().toString(36)}${tag}${n}`;
    if (dish.split) return dish.items.map((x, n) => ({ id: id(n), meal: dish.meal, name: x.name, amount: `${x.g} g`, kcal: x.kcal, p: x.p, c: x.c, f: x.f, est: true }));
    const s = sumOf(dish.items);
    return [{ id: id(0), meal: dish.meal, name: dish.name.trim() || 'Mahlzeit', amount: `ca. ${Math.round(s.g)} g`, kcal: s.kcal, p: r1(s.p), c: r1(s.c), f: r1(s.f), est: true }];
  };

  if (dishes) {
    const total = dishes.reduce((a, d) => a + sumOf(d.items).kcal, 0);
    return (
      <>
        <p className="sm muted">Das ist eine Schätzung aus deiner Beschreibung. Name, Mahlzeit und Gramm kannst du anpassen.</p>
        {dishes.map((dish, i) => {
          const s = sumOf(dish.items);
          return (
            <div key={i} style={{ display: 'grid', gap: 8, padding: 12, border: '1px solid var(--line, rgba(128,128,128,.3))', borderRadius: 'var(--r-s)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label className="in" style={{ flex: 1 }}>
                  <input value={dish.name} onChange={(e) => patch(i, { name: e.target.value })} aria-label="Name der Mahlzeit" disabled={dish.split && dish.items.length > 1} />
                </label>
                <span className="k strong">{s.kcal} kcal</span>
                <button className="x" aria-label={`${dish.name} entfernen`} onClick={() => setDishes(dishes.filter((_, j) => j !== i))}><Icon n="x" s /></button>
              </div>
              <span className="xs muted">≈ {Math.round(s.g)} g · {r1(s.p)} P · {r1(s.c)} C · {r1(s.f)} F</span>
              <div className="chips" role="group" aria-label="Mahlzeit">
                {MEALS.map((m) => (
                  <button key={m.id} className={`chip ${dish.meal === m.id ? 'on' : ''}`} onClick={() => patch(i, { meal: m.id })}>{m.label}</button>
                ))}
              </div>
              <details>
                <summary className="sm">{dish.items.length} {dish.items.length === 1 ? 'Zutat' : 'Zutaten'} ansehen und anpassen</summary>
                {dish.items.map((x, k) => (
                  <div className="ent" key={k}>
                    <div className="t">
                      <span className="strong">{x.name}</span>
                      <span className="xs muted">{x.assumed ? 'üblich dazu, nicht genannt · ' : ''}{x.p} P · {x.c} C · {x.f} F</span>
                    </div>
                    <label className="in" style={{ width: 84 }}>
                      <input inputMode="decimal" defaultValue={x.g} key={x.g} onBlur={(e) => { const g = num(e.target.value); if (g) scale(i, k, g); }} aria-label={`${x.name} Gramm`} />
                      <span className="u">g</span>
                    </label>
                    <span className="k">{x.kcal}</span>
                    <button className="x" aria-label={`${x.name} entfernen`} onClick={() => patch(i, { items: dish.items.filter((_, n) => n !== k) })} disabled={dish.items.length === 1}><Icon n="x" s /></button>
                  </div>
                ))}
              </details>
              {dish.items.length > 1 && (
                <div className="chips" role="group" aria-label="Eintragen als">
                  <button className={`chip ${!dish.split ? 'on' : ''}`} onClick={() => patch(i, { split: false })}>Ein Eintrag</button>
                  <button className={`chip ${dish.split ? 'on' : ''}`} onClick={() => patch(i, { split: true })}>Zutaten einzeln</button>
                </div>
              )}
            </div>
          );
        })}
        <button className="s6-btn s6-btn-primary w" disabled={!dishes.length} onClick={() => onEntries(dishes.flatMap((d, i) => toEntries(d, i)))}>
          {total} kcal hinzufügen
        </button>
        {dishes.length === 1 && (
          <>
            <div className="lab">Immer wieder gleich? Als Standard speichern</div>
            <label className="f">
              <span>Name</span>
              <div className="in"><input value={stdName} onChange={(e) => setStdName(e.target.value)} placeholder={dishes[0].name || 'z. B. Caesar Salad'} /></div>
            </label>
            <div className="chips" role="group" aria-label="Art">
              <button className={`chip ${!stdDrink ? 'on' : ''}`} onClick={() => setStdDrink(false)}>Essen</button>
              <button className={`chip ${stdDrink ? 'on' : ''}`} onClick={() => setStdDrink(true)}>Getränk</button>
            </div>
            <button
              className="s6-btn s6-btn-quiet w"
              disabled={!(stdName.trim() || dishes[0].name.trim())}
              onClick={() => {
                onSaveStandard(stdName.trim() || dishes[0].name, dishes[0].items.map((x, n) => ({ id: `s${Date.now().toString(36)}${n}`, meal: dishes[0].meal, name: x.name, amount: `${x.g} g`, kcal: x.kcal, p: x.p, c: x.c, f: x.f, est: true })), stdDrink);
                setStdName('');
              }}
            >
              Als Standard speichern
            </button>
          </>
        )}
        <button className="link plain" onClick={() => setDishes(null)}>Neu beschreiben</button>
      </>
    );
  }

  return (
    <>
      <p className="sm muted">Schreibe oder sprich, was du gegessen hast, ohne zu wägen. Eine Zutatenliste reicht: die App erkennt das Gericht (z. B. «Caesar Salad») und schätzt es als eine Mahlzeit.</p>
      <label className="f">
        <span>Was hast du gegessen?</span>
        <div className="in" style={{ alignItems: 'flex-start' }}>
          <textarea
            rows={4}
            maxLength={1000}
            value={interim ? `${desc}${desc ? ', ' : ''}${interim}` : desc}
            onChange={(e) => { setDesc(e.target.value); setInterim(''); }}
            readOnly={listening}
            placeholder="z. B. Salat, Chicken, Hüttenkäse, Pepperoni, Tomaten"
            style={{ width: '100%', background: 'transparent', border: 0, color: 'inherit', font: 'inherit', resize: 'vertical' }}
          />
        </div>
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        {SR && (
          <button type="button" className={`s6-btn ${listening ? 's6-btn-primary' : 's6-btn-quiet'}`} onClick={toggleDictation} aria-pressed={listening} aria-label={listening ? 'Diktat beenden' : 'Diktieren'} disabled={busy}>
            {listening ? '● Aufnahme … tippen zum Beenden' : '🎤 Diktieren'}
          </button>
        )}
        <button className="s6-btn s6-btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={busy || (desc + interim).trim().length < 3} onClick={run}>{busy ? 'Schätze …' : 'Schätzen'}</button>
      </div>
      {!SR && <p className="xs muted">Diktieren: Tippe auf das Mikrofon deiner Tastatur. Dieser Browser hat kein eigenes Diktat.</p>}
      {err && <p className="sm" role="alert">{err}</p>}
    </>
  );
}
