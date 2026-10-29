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
    steps: q.steps ?? {},
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

/** Gewichte aus einer CSV (WeightFit: «Date,Weight (kg)»). Pro Tag zählt die erste Messung; null, wenn nichts lesbar ist. */
export function parseWeightCsv(text: string): Record<string, number> | null {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const head = rows.shift()?.split(/[,;]/).map((h) => h.trim().toLowerCase()) ?? [];
  const di = head.findIndex((h) => h.startsWith('date') || h.startsWith('datum'));
  const wi = head.findIndex((h) => h.startsWith('weight') || h.startsWith('gewicht'));
  if (di < 0 || wi < 0) return null;
  const first: Record<string, { t: string; kg: number }> = {};
  for (const r of rows) {
    const c = r.split(/[,;]/);
    const day = c[di]?.trim().slice(0, 10);
    const kg = parseFloat((c[wi] ?? '').replace(',', '.'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '') || !(kg > 20 && kg < 300)) continue;
    if (!first[day] || c[di].trim() < first[day].t) first[day] = { t: c[di].trim(), kg };
  }
  const out: Record<string, number> = {};
  for (const d of Object.keys(first)) out[d] = first[d].kg;
  return Object.keys(out).length ? out : null;
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
