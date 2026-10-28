import { useEffect, useRef, useState } from 'react';
import type { Entry, Food, Meal } from '../lib/engine';
import { accessToken } from '../lib/garmin';
import { Icon, num } from '../ui';

type Kind = 'barcode' | 'etikett' | 'teller';

interface PlateItem {
  name: string;
  g: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Foto auf max. 1280 px verkleinern und als JPEG-Base64 (ohne Prefix) zurückgeben. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k);
  cv.height = Math.round(bmp.height * k);
  cv.getContext('2d')!.drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.8).split(',')[1];
}

async function vision(kind: 'etikett' | 'teller', image: string) {
  const res = await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await accessToken()) ?? ''}` }, body: JSON.stringify({ kind, image }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Analyse fehlgeschlagen');
  return body;
}

/** Open Food Facts: Nährwerte pro 100 g zu einem Barcode. */
async function lookupEan(ean: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,nutriments,serving_quantity`);
  const j = await res.json();
  if (j.status !== 1) return null;
  const n = j.product.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : undefined);
  if (kcal == null) return null;
  const sv = Number(j.product.serving_quantity);
  return {
    id: `ean-${ean}`,
    name: j.product.product_name || `Produkt ${ean}`,
    ...(j.product.brands ? { brand: String(j.product.brands).split(',')[0] } : {}),
    kcal: r1(kcal),
    p: r1(n.proteins_100g ?? 0),
    c: r1(n.carbohydrates_100g ?? 0),
    f: r1(n.fat_100g ?? 0),
    ...(sv > 0 ? { serving: { label: 'Portion', g: sv } } : {}),
  };
}

export default function Scan({ meal, onFood, onEntries }: { meal: Meal; onFood: (f: Food) => void; onEntries: (list: Entry[]) => void }) {
  const [kind, setKind] = useState<Kind>('barcode');
  return (
    <>
      <div className="chips" role="group" aria-label="Scan-Art">
        {([['barcode', 'Barcode'], ['etikett', 'Nährwerttabelle'], ['teller', 'Teller']] as [Kind, string][]).map(([k, l]) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      {kind === 'barcode' && <Barcode onFood={onFood} />}
      {kind === 'etikett' && <Label onFood={onFood} />}
      {kind === 'teller' && <Plate meal={meal} onEntries={onEntries} />}
    </>
  );
}

function Barcode({ onFood }: { onFood: (f: Food) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const supported = 'BarcodeDetector' in window;

  const find = async (ean: string) => {
    setBusy(true);
    setErr('');
    try {
      const f = await lookupEan(ean.trim());
      if (f) onFood(f);
      else setErr(`Kein Treffer für ${ean}. Probier «Nährwerttabelle» oder lege das Produkt unter «Neu» an.`);
    } catch {
      setErr('Keine Verbindung zu Open Food Facts.');
    }
    setBusy(false);
  };

  useEffect(() => {
    if (!supported) return;
    let stop = false;
    let stream: MediaStream | undefined;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stop || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        // @ts-expect-error BarcodeDetector fehlt in den TS-Typen
        const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        while (!stop) {
          const codes = await det.detect(video.current).catch(() => []);
          if (codes.length) {
            stop = true;
            find(codes[0].rawValue);
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        setErr('Kamera nicht erlaubt. Gib die Nummer unten ein.');
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {supported ? (
        <video ref={video} playsInline muted style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 'var(--r-s)', background: '#000' }} />
      ) : (
        <p className="sm muted">Dein Browser kann nicht live scannen (z. B. iPhone). Tippe die Nummer unter dem Strichcode ein oder nutze «Nährwerttabelle».</p>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) find(manual); }} style={{ display: 'flex', gap: 8 }}>
        <label className="in focus-in" style={{ flex: 1 }}>
          <input inputMode="numeric" placeholder="Nummer eingeben" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} aria-label="Barcode-Nummer" />
        </label>
        <button className="s6-btn s6-btn-quiet" type="submit" disabled={busy || manual.length < 8}>Suchen</button>
      </form>
      {busy && <p className="sm muted">Suche Produkt …</p>}
      {err && <p className="sm" role="alert">{err}</p>}
    </>
  );
}

function Photo({ label, busy, onFile }: { label: string; busy: boolean; onFile: (f: File) => void }) {
  return (
    <label className="s6-btn s6-btn-primary w" style={{ cursor: 'pointer', justifyContent: 'center' }}>
      <Icon n="plus" s />{busy ? 'Analysiere …' : label}
      <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

function Label({ onFood }: { onFood: (f: Food) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const r = await vision('etikett', await shrink(file));
      if (!r.kcal) throw new Error('Keine Nährwerte erkannt. Foto näher und gerade aufnehmen.');
      onFood({
        id: `c-${Date.now().toString(36)}`,
        name: r.name || 'Produkt',
        kcal: r.kcal,
        p: r.p ?? 0,
        c: r.c ?? 0,
        f: r.f ?? 0,
        ...(r.serving_g > 0 ? { serving: { label: 'Portion', g: r.serving_g } } : {}),
      });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      <p className="sm muted">Fotografiere die Nährwerttabelle auf der Verpackung. Die App liest die Werte pro 100 g und legt das Produkt an.</p>
      <Photo label="Tabelle fotografieren" busy={busy} onFile={run} />
      {err && <p className="sm" role="alert">{err}</p>}
    </>
  );
}

function Plate({ meal, onEntries }: { meal: Meal; onEntries: (list: Entry[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [items, setItems] = useState<PlateItem[] | null>(null);
  const run = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const r = await vision('teller', await shrink(file));
      if (!Array.isArray(r.items) || !r.items.length) throw new Error('Auf dem Foto ist kein Essen erkannt worden.');
      setItems(r.items);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };

  if (items) {
    const scale = (i: number, g: number) =>
      setItems(items.map((x, j) => (j === i && x.g > 0 && g > 0 ? { ...x, g, kcal: Math.round((x.kcal * g) / x.g), p: r1((x.p * g) / x.g), c: r1((x.c * g) / x.g), f: r1((x.f * g) / x.g) } : x)));
    const sum = items.reduce((a, x) => a + x.kcal, 0);
    return (
      <>
        <p className="sm muted">Das ist eine Schätzung. Passe die Gramm an, wenn du es besser weisst.</p>
        {items.map((x, i) => (
          <div className="ent" key={i}>
            <div className="t">
              <span className="strong">{x.name}</span>
              <span className="xs muted">{x.p} P · {x.c} C · {x.f} F</span>
            </div>
            <label className="in" style={{ width: 84 }}>
              <input inputMode="decimal" defaultValue={x.g} onBlur={(e) => { const g = num(e.target.value); if (g) scale(i, g); }} aria-label={`${x.name} Gramm`} />
              <span className="u">g</span>
            </label>
            <span className="k">{x.kcal}</span>
            <button className="x" aria-label={`${x.name} entfernen`} onClick={() => setItems(items.filter((_, j) => j !== i))}><Icon n="x" s /></button>
          </div>
        ))}
        <button
          className="s6-btn s6-btn-primary w"
          disabled={!items.length}
          onClick={() =>
            onEntries(items.map((x, i) => ({ id: `s${Date.now().toString(36)}${i}`, meal, name: x.name, amount: `${x.g} g`, kcal: x.kcal, p: x.p, c: x.c, f: x.f, est: true })))
          }
        >
          {sum} kcal hinzufügen
        </button>
        <button className="link plain" onClick={() => setItems(null)}>Neues Foto</button>
      </>
    );
  }
  return (
    <>
      <p className="sm muted">Fotografiere den Teller von oben. Die App listet die Bestandteile auf und schätzt Gramm und Nährwerte.</p>
      <Photo label="Teller fotografieren" busy={busy} onFile={run} />
      {err && <p className="sm" role="alert">{err}</p>}
    </>
  );
}
