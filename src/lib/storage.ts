import { useEffect, useState } from 'react';
import { DEFAULT_DATA, type Data } from './engine';

const KEY = 's60.data.v2';

function normalize(p: Partial<Data> | null | undefined): Data {
  const q = p ?? {};
  return {
    settings: { ...DEFAULT_DATA.settings, ...q.settings },
    logs: q.logs ?? {},
    weights: q.weights ?? {},
    energy: q.energy ?? {},
    diary: q.diary ?? {},
    water: q.water ?? {},
    customFoods: q.customFoods ?? [],
    favorites: q.favorites ?? [],
    templates: q.templates ?? [],
  };
}

function load(): Data {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    /* defekte oder gesperrte Daten: neu starten */
  }
  return DEFAULT_DATA;
}

export function useData(): [Data, (f: (p: Data) => Data) => void] {
  const [data, setData] = useState<Data>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* Speicher voll oder gesperrt */
    }
  }, [data]);
  return [data, setData];
}

export function parseBackup(text: string): Data | null {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || !p.settings) return null;
    return normalize(p);
  } catch {
    return null;
  }
}

/** CSV mit Tagebuch und Gewicht für Excel/Sheets. */
export function toCsv(d: Data): string {
  const rows = ['Datum;Typ;Mahlzeit;Name;Menge;kcal;Protein;Kohlenhydrate;Fett'];
  for (const date of Object.keys(d.diary).sort()) {
    for (const e of d.diary[date]) {
      rows.push([date, 'Essen', e.meal, `"${e.name.replace(/"/g, '""')}"`, e.amount ?? '', e.kcal, e.p, e.c, e.f].join(';'));
    }
  }
  for (const date of Object.keys(d.weights).sort()) {
    rows.push([date, 'Gewicht', '', '', `${d.weights[date]} kg`, '', '', '', ''].join(';'));
  }
  return rows.join('\n');
}
