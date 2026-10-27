import { builtinPlan, weekInfo } from '../training/plan-store.js';
import { idxFromDate, RACE } from '../training/dates.js';
import { isEasyRun } from '../training/util.js';

export type DayType = 'WPF_LOW' | 'MODERATE' | 'HIGH_PERFORMANCE';
export type Feel = 'gut' | 'ok' | 'zaeh';
export type Energy = 'fit' | 'muede' | 'kaputt';

export type Sex = 'm' | 'w';
export type Meal = 'fruehstueck' | 'mittag' | 'abend' | 'snack';

export interface Settings {
  onboarded: boolean;
  sex: Sex;
  age?: number;
  heightCm?: number;
  /** Aktivitätsfaktor (Alltag + Training im Schnitt) */
  activity: number;
  /** Ziel-Abnahmetempo in kg pro Woche */
  ratePerWeek: number;
  /** Körperfett ist gemessen/geschätzt (dann Katch-McArdle) */
  bfKnown: boolean;
  /** manuell gesetzter TDEE überschreibt die Berechnung */
  tdeeOverride?: number;
  /** aus Tagebuch und Gewichtstrend ermittelte Korrektur des berechneten Bedarfs (kcal) */
  calib?: number;
  calibDate?: string;
  weightKg: number;
  bodyFatPercent: number;
  goalKg: number;
  tdee: number;
  proteinPerKg: number;
  /** automatische Korrektur auf Defizit-Tagen (kcal), vom Gewichtstrend gesteuert */
  adj: number;
  adjDate?: string;
  lastRate?: number;
  /** automatischer RED-S-Schutz bis zu diesem Datum */
  protectUntil?: string;
  redsStop: boolean;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** pro 100 g bzw. 100 ml */
  kcal: number;
  p: number;
  c: number;
  f: number;
  serving?: { label: string; g: number };
}

export interface TemplateItem {
  name: string;
  amount?: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
}

/** Standardmahlzeit: einmal gewogen, danach ein Tipp. Werte gelten pro Portion. */
export interface Template {
  id: string;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  portions: number;
  items: TemplateItem[];
}

export interface Entry {
  id: string;
  meal: Meal;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  /** Anzeige, z. B. „150 g“ */
  amount?: string;
  foodId?: string;
}

export interface DayLog {
  meals: boolean[];
  feel?: Feel;
}

export interface Data {
  settings: Settings;
  logs: Record<string, DayLog>;
  weights: Record<string, number>;
  energy: Record<string, Energy>;
  diary: Record<string, Entry[]>;
  water: Record<string, number>;
  customFoods: Food[];
  favorites: string[];
  templates: Template[];
}

export interface PlanDay {
  t: string;
  k: string;
  i: string[];
  n?: string;
  race?: boolean;
}

export interface Slot {
  time: string;
  label: string;
  kind: 'shake' | 'meal';
  kcal: number;
  p: number;
  c: number;
  f: number;
  hint: string;
}

export interface DayPlan {
  date: string;
  idx: number;
  weekNo: number;
  weekName: string;
  trainingDay: PlanDay | null;
  dayType: DayType;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  window: string;
  slots: Slot[];
  notes: string[];
  ea: number;
  deficit: number;
}

export const DAY_LABEL: Record<DayType, string> = {
  WPF_LOW: 'Low-Tag',
  MODERATE: 'Moderat-Tag',
  HIGH_PERFORMANCE: 'High-Tag',
};

export const DEFAULT_DATA: Data = {
  settings: {
    onboarded: false,
    sex: 'm',
    activity: 1.55,
    ratePerWeek: 0.3,
    bfKnown: false,
    weightKg: 80,
    bodyFatPercent: 17,
    goalKg: 77,
    tdee: 2800,
    proteinPerKg: 2.1,
    adj: 0,
    redsStop: false,
  },
  logs: {},
  weights: {},
  energy: {},
  diary: {},
  water: {},
  customFoods: [],
  favorites: [],
  templates: [],
};

const PLAN = builtinPlan() as unknown as { days: Record<number, PlanDay> };
export const RACE_IDX = idxFromDate(RACE) as number;
const PEAK_WEEK = 13;
const EA_FLOOR = 30;
const EA_OPTIMAL = 40;
const EEE: Record<DayType, number> = { WPF_LOW: 200, MODERATE: 400, HIGH_PERFORMANCE: 700 };
const DEFICIT: Record<DayType, number> = { WPF_LOW: 600, MODERATE: 300, HIGH_PERFORMANCE: 0 };
const FAT_PER_KG: Record<DayType, number> = { WPF_LOW: 0.7, MODERATE: 0.8, HIGH_PERFORMANCE: 0.8 };
const KCAL_PER_KG_FAT = 7700;

// ---------- Datum ----------

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
export const dayIndex = (iso: string): number => idxFromDate(parseISO(iso)) as number;
export const daysToRace = (iso: string): number => RACE_IDX - dayIndex(iso);

// ---------- Körperdaten ----------

export const ffm = (w: number, bf: number) => w * (1 - bf / 100);

export interface Needs {
  bmr: number;
  tdee: number;
  method: 'Katch-McArdle' | 'Mifflin-St Jeor';
}

/** Grundumsatz und Gesamtumsatz. Katch-McArdle bei bekanntem Körperfett, sonst Mifflin-St Jeor. */
export function calcNeeds(p: {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent: number;
  bfKnown: boolean;
  activity: number;
}): Needs {
  let bmr: number;
  let method: Needs['method'];
  if (p.bfKnown) {
    bmr = 370 + 21.6 * ffm(p.weightKg, p.bodyFatPercent);
    method = 'Katch-McArdle';
  } else {
    bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
    method = 'Mifflin-St Jeor';
  }
  return { bmr: Math.round(bmr), tdee: Math.round((bmr * p.activity) / 10) * 10, method };
}

/** Basis-TDEE ohne Kalibrierung: manuell > berechnet (wenn Alter und Größe bekannt) > gespeichert. */
export function baseTdee(s: Settings, weightKg: number): number {
  if (s.tdeeOverride) return s.tdeeOverride;
  if (s.age && s.heightCm) return calcNeeds({ ...s, age: s.age, heightCm: s.heightCm, weightKg }).tdee;
  return s.tdee;
}

/** Der TDEE, mit dem gerechnet wird: Basis plus Kalibrierung aus deinen echten Daten. */
export function effectiveTdee(s: Settings, weightKg: number): number {
  return baseTdee(s, weightKg) + (s.calib ?? 0);
}

/** Katch-McArdle × 1,55 (Training wird über den Tagestyp abgebildet). */
export function estimateTdee(weightKg: number, bf: number): number {
  return Math.round((370 + 21.6 * ffm(weightKg, bf)) * 1.55 / 10) * 10;
}

export function currentWeight(date: string, d: Data): number {
  const days = Object.keys(d.weights).filter((x) => x <= date).sort();
  return days.length ? d.weights[days[days.length - 1]] : d.settings.weightKg;
}

// ---------- Tagestyp aus dem Trainingsplan ----------

export function trainingFor(date: string): PlanDay | null {
  const idx = dayIndex(date);
  return PLAN.days[idx] ?? null;
}

export function classify(day: PlanDay | null): DayType {
  if (!day) return 'WPF_LOW';
  switch (day.k) {
    case 'rest':
    case 'bike':
      return 'WPF_LOW';
    case 'kraft':
      return 'MODERATE';
    case 'lauf':
      return isEasyRun(day) ? 'WPF_LOW' : 'HIGH_PERFORMANCE';
    default:
      return 'HIGH_PERFORMANCE'; // station, sim, race
  }
}

// ---------- Auto-Regulation ----------

/** Glykogen-Schalter: zwei zähe High-Tage in Folge → nächste zwei Moderat-Tage +300 kcal. */
function glycogenBoost(date: string, d: Data): boolean {
  const highs: string[] = [];
  for (let i = 1; i <= 35 && highs.length < 6; i++) {
    const x = addDays(date, -i);
    if (classify(trainingFor(x)) === 'HIGH_PERFORMANCE') highs.push(x);
  }
  for (let k = 0; k + 1 < highs.length; k++) {
    if (d.logs[highs[k]]?.feel !== 'zaeh' || d.logs[highs[k + 1]]?.feel !== 'zaeh') continue;
    let count = 0;
    for (let x = addDays(highs[k], 1); x <= date; x = addDays(x, 1)) {
      if (classify(trainingFor(x)) === 'MODERATE') {
        count++;
        if (x === date) return count <= 2;
      }
    }
  }
  return false;
}

function avgWeight(d: Data, endDate: string, days: number): number | null {
  const v: number[] = [];
  for (let i = 0; i < days; i++) {
    const w = d.weights[addDays(endDate, -i)];
    if (w) v.push(w);
  }
  return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Gewichtsverlust in % pro Woche (7-Tage-Schnitt gegen die Woche davor). */
export function weeklyRate(d: Data, date: string): number | null {
  const now = avgWeight(d, date, 7);
  const before = avgWeight(d, addDays(date, -7), 7);
  return now && before ? ((before - now) / before) * 100 : null;
}

/** Wird nach jedem neuen Gewicht aufgerufen: regelt die Defizit-Stärke höchstens einmal pro Woche. */
export function adaptAfterWeighIn(d: Data, date: string): Settings {
  const s = d.settings;
  if (s.adjDate && dayIndex(date) - dayIndex(s.adjDate) < 7) return s;
  const rate = weeklyRate(d, date);
  if (rate === null || dayIndex(date) < 7) return s;
  let adj = s.adj;
  if (rate > 1.0) adj += 250;
  else if (rate < 0.2) adj -= 100;
  adj = Math.max(-200, Math.min(500, adj));
  return { ...s, adj, adjDate: date, lastRate: rate };
}

/** Nach jedem Energie-Check: zweimal „kaputt“ in Folge → 14 Tage Schutzmodus. */
export function protectAfterEnergy(d: Data, date: string): Settings {
  const keys = Object.keys(d.energy).sort();
  const last2 = keys.slice(-2);
  if (last2.length === 2 && last2.every((k) => d.energy[k] === 'kaputt')) {
    return { ...d.settings, protectUntil: addDays(date, 14) };
  }
  return d.settings;
}

export const isProtected = (date: string, s: Settings): boolean =>
  s.redsStop || (!!s.protectUntil && s.protectUntil >= date);

// ---------- Tagesplan ----------

interface SlotSpec {
  time: string;
  label: string;
  kind: 'shake' | 'meal';
  share: number;
  fixC?: number;
  fixF?: number;
}

const SLOTS: Record<DayType, SlotSpec[]> = {
  WPF_LOW: [
    { time: '08:00', label: 'Protein-Shake', kind: 'shake', share: 0, fixC: 8, fixF: 3 },
    { time: '11:00', label: 'Protein-Shake', kind: 'shake', share: 0, fixC: 8, fixF: 3 },
    { time: '14:30', label: 'Mahlzeit 1', kind: 'meal', share: 0.45 },
    { time: '19:00', label: 'Mahlzeit 2', kind: 'meal', share: 0.55 },
  ],
  MODERATE: [
    { time: '09:00', label: 'Protein-Shake', kind: 'shake', share: 0, fixC: 8, fixF: 3 },
    { time: '12:30', label: 'Mittagessen', kind: 'meal', share: 0.45 },
    { time: '16:00', label: 'Vor dem Training', kind: 'meal', share: 0, fixC: 40, fixF: 5 },
    { time: '19:30', label: 'Abendessen', kind: 'meal', share: 0.55 },
  ],
  HIGH_PERFORMANCE: [
    { time: '08:00', label: 'Frühstück', kind: 'meal', share: 0.25 },
    { time: '11:30', label: 'Mittagessen', kind: 'meal', share: 0.2 },
    { time: '15:00', label: 'Vor / nach dem Training', kind: 'meal', share: 0.25 },
    { time: '18:00', label: 'Abendessen', kind: 'meal', share: 0.3 },
  ],
};

const WINDOW: Record<DayType, string> = {
  WPF_LOW: 'Essen 14:00 – 20:00 · 18:6',
  MODERATE: 'Essen 12:00 – 20:00 · 16:8',
  HIGH_PERFORMANCE: 'Essen 08:00 – 18:00 · 14:10',
};

const round5 = (n: number) => Math.round(n / 5) * 5;

function hint(s: { kind: string; p: number; c: number; f: number }): string {
  if (s.kind === 'shake') return `1 Messlöffel Whey in Wasser oder Milch`;
  const parts = [`${round5(s.p / 0.23)} g Hähnchen oder ${round5(s.p / 0.11)} g Skyr`];
  if (s.c >= 15) parts.push(`${round5(s.c / 0.77)} g Reis/Nudeln (roh)`);
  if (s.f >= 5) parts.push(`${Math.round(s.f)} g Öl/Nüsse`);
  return parts.join(' · ') + ' + Gemüse';
}

function buildSlots(type: DayType, P: number, C: number, F: number): Slot[] {
  const specs = SLOTS[type];
  const pSlot = Math.round(P / 4);
  const fixedC = specs.reduce((a, s) => a + (s.fixC ?? 0), 0);
  const fixedF = specs.reduce((a, s) => a + (s.fixF ?? 0), 0);
  const free = specs.filter((s) => s.share > 0);
  const shareSum = free.reduce((a, s) => a + s.share, 0);
  const cLeft = Math.max(0, C - fixedC);
  const fLeft = Math.max(0, F - fixedF);
  let cUsed = 0;
  let fUsed = 0;
  return specs.map((s, i) => {
    const last = i === specs.length - 1;
    const p = last ? P - pSlot * 3 : pSlot;
    let c = s.fixC ?? 0;
    let f = s.fixF ?? 0;
    if (s.share > 0) {
      const isLastFree = s === free[free.length - 1];
      c = isLastFree ? cLeft - cUsed : Math.round((cLeft * s.share) / shareSum);
      f = isLastFree ? fLeft - fUsed : Math.round((fLeft * s.share) / shareSum);
      cUsed += c;
      fUsed += f;
    }
    c = Math.max(0, c);
    f = Math.max(0, f);
    return {
      time: s.time,
      label: s.label,
      kind: s.kind,
      p,
      c,
      f,
      kcal: Math.round(p * 4 + c * 4 + f * 9),
      hint: hint({ kind: s.kind, p, c, f }),
    };
  });
}

export function computeDay(date: string, d: Data): DayPlan {
  const s = d.settings;
  const idx = dayIndex(date);
  const training = trainingFor(date);
  const postRace = idx > RACE_IDX;
  const outside = idx < 0 || postRace;
  const type: DayType = outside ? 'MODERATE' : classify(training);
  const weekNo = Math.floor(idx / 7) + 1;
  const weight = currentWeight(date, d);
  const fatFree = ffm(weight, s.bodyFatPercent);
  const notes: string[] = [];

  const P = Math.round(weight * s.proteinPerKg);
  const F = Math.round(weight * FAT_PER_KG[type]);

  const tdee = effectiveTdee(s, weight);
  const scale = Math.max(0.5, Math.min(2, s.ratePerWeek / 0.3));
  let deficit = Math.round(DEFICIT[type] * scale);
  if (outside) {
    deficit = 0;
    notes.push(postRace ? 'Der Plan ist vorbei – Erhaltung.' : 'Der Plan startet am 12.10.2026 – bis dahin Erhaltung.');
  } else if (weekNo >= PEAK_WEEK) {
    deficit = 0;
    notes.push('Peak-Phase: ab jetzt kein Defizit mehr. Du isst für die Leistung.');
  }
  const prot = isProtected(date, s);
  if (prot) {
    deficit = 0;
    notes.push('Schutzmodus aktiv: kein Defizit, damit sich dein Körper erholt.');
  }

  let kcal = tdee - deficit;
  if (deficit > 0 && s.adj !== 0) {
    kcal += s.adj;
    notes.push(
      s.adj > 0
        ? `+${s.adj} kcal automatisch: du hast zuletzt zu schnell abgenommen.`
        : `${s.adj} kcal automatisch: die Abnahme war zuletzt zu langsam.`,
    );
  }
  if (!outside && glycogenBoost(date, d)) {
    kcal += 300;
    notes.push('+300 kcal: zwei zähe Intensivtage – dein Glykogen muss nachgefüllt werden.');
  }

  const eee = EEE[type];
  const floor = Math.ceil((prot ? EA_OPTIMAL : EA_FLOOR) * fatFree + eee);
  if (kcal < floor) {
    kcal = floor;
    notes.push(`Sicherheitsgrenze: nie unter ${prot ? 40 : 30} kcal pro kg fettfreier Masse.`);
  }
  kcal = Math.round(kcal);

  const C = Math.max(0, Math.round((kcal - P * 4 - F * 9) / 4));
  const info = idx >= 0 && idx < 126 ? weekInfo(PLAN, Math.floor(idx / 7)) : null;

  return {
    date,
    idx,
    weekNo,
    weekName: info ? String(info.name) : '',
    trainingDay: training,
    dayType: type,
    kcal,
    protein: P,
    carbs: C,
    fat: F,
    window: WINDOW[type],
    slots: buildSlots(type, P, C, F),
    notes,
    ea: (kcal - eee) / fatFree,
    deficit: tdee - kcal,
  };
}

// ---------- Auswertung ----------

export function weekDeficitKg(plans: DayPlan[]): number {
  return plans.reduce((a, p) => a + p.deficit, 0) / KCAL_PER_KG_FAT;
}

export function adherence(d: Data, endDate: string, days: number): number | null {
  let done = 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const x = addDays(endDate, -i);
    const log = d.logs[x];
    if (!log) continue;
    done += log.meals.filter(Boolean).length;
    total += 4;
  }
  return total ? Math.round((done / total) * 100) : null;
}

export const emptyLog = (): DayLog => ({ meals: [false, false, false, false] });
