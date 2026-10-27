import { addDays, baseTdee, currentWeight, dayIndex, parseISO, toISO, type Data, type Entry, type Food, type Meal, type Template } from './engine';

export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'fruehstueck', label: 'Frühstück' },
  { id: 'mittag', label: 'Mittagessen' },
  { id: 'abend', label: 'Abendessen' },
  { id: 'snack', label: 'Snacks' },
];

export function totals(entries: Entry[] = []): Totals {
  return entries.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Eintrag aus einem Lebensmittel und einer Menge in Gramm. */
export function entryFromFood(food: Food, grams: number, meal: Meal): Entry {
  const k = grams / 100;
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    meal,
    name: food.name,
    kcal: Math.round(food.kcal * k),
    p: r1(food.p * k),
    c: r1(food.c * k),
    f: r1(food.f * k),
    amount: `${Math.round(grams)} g`,
    foodId: food.id,
  };
}

export const waterGoalMl = (weightKg: number) => Math.round((weightKg * 35) / 50) * 50;

// ---------- Gewichtstrend ----------

export type Verdict = 'down' | 'flat' | 'up' | 'unknown';

export interface Trend {
  n: number;
  verdict: Verdict;
  /** kg pro Woche (negativ = Abnahme) */
  slope: number | null;
  /** % des Körpergewichts pro Woche, positiv = Abnahme */
  pct: number | null;
  latest: number | null;
}

/** Lineare Regression über die letzten 21 Tage, robust gegen Tagesschwankungen. */
export function weightTrend(d: Data, date: string, window = 21): Trend {
  const pts: { x: number; y: number }[] = [];
  const end = dayIndex(date);
  for (const k of Object.keys(d.weights)) {
    const x = dayIndex(k) - end;
    if (x <= 0 && x > -window) pts.push({ x, y: d.weights[k] });
  }
  const all = Object.keys(d.weights).filter((k) => k <= date).sort();
  const latest = all.length ? d.weights[all[all.length - 1]] : null;
  const span = pts.length ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) : 0;
  if (pts.length < 3 || span < 5) return { n: pts.length, verdict: 'unknown', slope: null, pct: null, latest };
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const my = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const sxx = pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const slope = (sxy / sxx) * 7;
  const pct = (-slope / my) * 100;
  const verdict: Verdict = pct > 0.15 ? 'down' : pct < -0.15 ? 'up' : 'flat';
  return { n: pts.length, verdict, slope, pct, latest };
}

export function projectedGoalDate(d: Data, date: string): string | null {
  const t = weightTrend(d, date);
  const goal = d.settings.goalKg;
  if (t.verdict !== 'down' || !t.slope || t.latest === null || t.latest <= goal) return null;
  const weeks = (t.latest - goal) / -t.slope;
  if (weeks > 104) return null;
  return addDays(date, Math.round(weeks * 7));
}

/** Gleitender 7-Tage-Schnitt je Messpunkt. */
export function movingAverage(d: Data): { date: string; value: number; avg: number }[] {
  const keys = Object.keys(d.weights).sort();
  return keys.map((k) => {
    const win = keys.filter((j) => j <= k && dayIndex(j) > dayIndex(k) - 7).map((j) => d.weights[j]);
    return { date: k, value: d.weights[k], avg: win.reduce((a, b) => a + b, 0) / win.length };
  });
}

// ---------- Tagebuch-Auswertung ----------

export function streak(d: Data, today: string): number {
  let day = d.diary[today]?.length ? today : addDays(today, -1);
  let n = 0;
  while (d.diary[day]?.length) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export interface WeekReport {
  monday: string;
  loggedDays: number;
  avgKcal: number | null;
  avgProtein: number | null;
  weight: number | null;
  change: number | null;
}

const mondayOf = (iso: string) => addDays(iso, -((parseISO(iso).getDay() + 6) % 7));

export function weekReports(d: Data, today: string, count = 4): WeekReport[] {
  const out: WeekReport[] = [];
  let prevWeight: number | null = null;
  const firstMon = addDays(mondayOf(today), -7 * count);
  // eine Woche mehr zurück, damit die erste Änderung berechnet werden kann
  const startMon = addDays(firstMon, -7);
  const avgW = (mon: string) => {
    const v: number[] = [];
    for (let i = 0; i < 7; i++) {
      const w = d.weights[addDays(mon, i)];
      if (w) v.push(w);
    }
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  prevWeight = avgW(startMon);
  for (let w = 0; w < count + 1; w++) {
    const mon = addDays(firstMon, w * 7);
    let days = 0;
    let kcal = 0;
    let prot = 0;
    for (let i = 0; i < 7; i++) {
      const e = d.diary[addDays(mon, i)];
      if (e?.length) {
        const t = totals(e);
        days++;
        kcal += t.kcal;
        prot += t.p;
      }
    }
    const weight = avgW(mon);
    out.push({
      monday: mon,
      loggedDays: days,
      avgKcal: days ? Math.round(kcal / days) : null,
      avgProtein: days ? Math.round(prot / days) : null,
      weight,
      change: weight !== null && prevWeight !== null ? weight - prevWeight : null,
    });
    if (weight !== null) prevWeight = weight;
  }
  return out.reverse().filter((r) => r.monday <= today);
}

export const todayISO = () => toISO(new Date());

// ---------- Standardmahlzeiten ----------

/** Standardmahlzeit aus gewogenen Einträgen; Gesamtsumme geteilt durch die Portionen. */
export function makeTemplate(name: string, items: Entry[], portions: number): Template {
  const t = totals(items);
  const n = Math.max(0.25, portions);
  return {
    id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: name.trim(),
    portions: n,
    kcal: Math.round(t.kcal / n),
    p: r1(t.p / n),
    c: r1(t.c / n),
    f: r1(t.f / n),
    items: items.map((e) => ({ name: e.name, amount: e.amount, kcal: e.kcal, p: e.p, c: e.c, f: e.f })),
  };
}

export function entryFromTemplate(t: Template, factor: number, meal: Meal): Entry {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    meal,
    name: t.name,
    kcal: Math.round(t.kcal * factor),
    p: r1(t.p * factor),
    c: r1(t.c * factor),
    f: r1(t.f * factor),
    amount: factor === 1 ? '1 Portion' : `${String(factor).replace('.', ',')} Portionen`,
    foodId: `t:${t.id}`,
  };
}

// ---------- Kalibrierung: Tagebuch + Waage = echter Bedarf ----------

export interface Calibration {
  ready: boolean;
  loggedDays: number;
  weighIns: number;
  /** was noch fehlt, solange nicht ready */
  needDays: number;
  needWeighIns: number;
  avgIntake: number | null;
  slope: number | null;
  actualTdee: number | null;
  baseTdee: number;
  /** vorgeschlagene Korrektur zur Formel (kcal), auf ±500 begrenzt */
  suggested: number | null;
}

const WINDOW = 28;
const MIN_DAYS = 10;
const MIN_WEIGH = 4;

/** Vergleicht, was du gegessen hast, mit dem, was die Waage tut. Daraus folgt dein echter Bedarf. */
export function calibration(d: Data, today: string): Calibration {
  const eaten: number[] = [];
  for (let i = 0; i < WINDOW; i++) {
    const k = totals(d.diary[addDays(today, -i)]).kcal;
    if (k >= 800) eaten.push(k);
  }
  const trend = weightTrend(d, today, WINDOW);
  const base = baseTdee(d.settings, currentWeight(today, d));
  const ready = eaten.length >= MIN_DAYS && trend.n >= MIN_WEIGH && trend.slope !== null;
  const avgIntake = eaten.length ? eaten.reduce((a, b) => a + b, 0) / eaten.length : null;
  let actual: number | null = null;
  let suggested: number | null = null;
  if (ready && avgIntake !== null && trend.slope !== null) {
    // 1 kg Körpergewicht ≈ 7700 kcal; slope in kg/Woche => kcal/Tag = slope * 1100
    actual = Math.round(avgIntake - trend.slope * 1100);
    suggested = Math.max(-500, Math.min(500, Math.round((actual - base) / 10) * 10));
  }
  return {
    ready,
    loggedDays: eaten.length,
    weighIns: trend.n,
    needDays: Math.max(0, MIN_DAYS - eaten.length),
    needWeighIns: Math.max(0, MIN_WEIGH - trend.n),
    avgIntake: avgIntake === null ? null : Math.round(avgIntake),
    slope: trend.slope,
    actualTdee: actual,
    baseTdee: base,
    suggested,
  };
}
