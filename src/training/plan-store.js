// Aktiver Plan = eingebauter Plan oder ein importierter Plan (PDF). Reine Funktionen, ohne DOM.
// Gespeicherte Form (S.plan): {source, name, importedAt, from, days: {idx: day}, blocks, weeks, prev}
import { buildBuiltinPlan, BLOCKS, BLOCK_ORDER, WAVE, WEEKS_A, RACE_IDX } from "./plan-data.js";
import { NWEEKS } from "./dates.js";
import { sameDay, clone } from "./util.js";

export const LAST = NWEEKS * 7 - 1;

let builtin = null;
export function builtinPlan() {
  if (!builtin) {
    const p = buildBuiltinPlan();
    p.name = "Eingebauter Plan (Stand 18.09.2026)";
    p.blocks = BLOCK_ORDER.map((id, j) => ({
      id, name: BLOCKS[id].name, start: BLOCKS[id].start,
      end: j + 1 < BLOCK_ORDER.length ? BLOCKS[BLOCK_ORDER[j + 1]].start - 1 : RACE_IDX
    }));
    p.weeks = WEEKS_A.map((w, n) => ({ n: n + 1, name: w.name, start: n * 7 }));
    builtin = p;
  }
  return builtin;
}

/** Gespeicherten Plan (oder null) in den aktiven Plan auflösen. */
export const activePlan = (stored) => (stored && stored.days ? stored : builtinPlan());

/** Woche w -> {block, name, wave}. Wochennamen aus dem Plan haben Vorrang vor dem Blocknamen. */
export function weekInfo(plan, w) {
  const start = w * 7;
  const blocks = plan.blocks && plan.blocks.length ? plan.blocks : builtinPlan().blocks;
  let b = blocks[0];
  for (const x of blocks) if (start >= x.start) b = x;
  const named = (plan.weeks || []).find((x) => x.start === start);
  const off = Math.max(0, Math.floor((start - b.start) / 7));
  let wave = b.id === "T" ? "Taper" : WAVE[Math.min(3, off)];
  if (b.id === "A" && off === 0) wave = "Test";
  // Im Plan benannte Deload-Woche hat Vorrang (z. B. wegen Feiertagen vorgezogen), die Woche danach ist wieder Belastung
  const dl = b.id === "T" ? null : (plan.weeks || []).find((x) => x.start >= b.start && x.start <= b.end && /deload/i.test(x.name));
  if (dl && off > 0) wave = dl.start === start ? "Deload" : WAVE[Math.min(2, start > dl.start ? off - 1 : off)];
  return { block: b.id, blockName: b.name, name: named ? named.name : b.name, wave, ...(named && named.km ? { km: named.km } : {}) };
}

/**
 * Importierte Tage über den aktuellen Plan legen.
 * Nur Tage ab `from` werden ersetzt (Vergangenheit + abgehakte Einträge bleiben stabil),
 * Tage, die der Import nicht kennt, behalten den bisherigen Inhalt.
 */
export function mergeImport(current, parsed, { from = 0, name = "PDF-Plan", now = Date.now() } = {}) {
  const days = clone(current.days);
  const changed = [];
  for (const [k, day] of Object.entries(parsed.days || {})) {
    const idx = +k;
    if (idx < Math.max(0, from) || idx > LAST) continue;
    if (!sameDay(days[idx], day)) changed.push(idx);
    days[idx] = day;
  }
  changed.sort((a, b) => a - b);
  const meta = parsed.meta || {};
  const plan = {
    source: "pdf", name, importedAt: now, from,
    days,
    blocks: meta.blocks && meta.blocks.length ? meta.blocks : current.blocks,
    weeks: meta.weeks && meta.weeks.length ? meta.weeks : current.weeks,
    prev: current.source === "builtin" ? null : stripPrev(current)
  };
  return { plan, changed };
}
const stripPrev = (p) => { const c = clone(p); delete c.prev; return c; };

/** Geänderte Tage pro Woche zählen: [{w, n}] */
export function changesByWeek(changed) {
  const m = new Map();
  for (const i of changed) m.set(Math.floor(i / 7), (m.get(Math.floor(i / 7)) || 0) + 1);
  return [...m.entries()].map(([w, n]) => ({ w, n }));
}

/** Rückgängig: vorherigen importierten Plan oder null (= eingebauter Plan). */
export const undoImport = (stored) => (stored && stored.prev ? stored.prev : null);

/** Übersicht für die Plan-Ansicht: pro Block die Einheiten der ersten Woche. */
export function blockOverview(plan) {
  const days = plan.days;
  return (plan.blocks || []).map((b) => {
    const list = [];
    for (let d = 0; d < 7; d++) {
      const day = days[b.start + d];
      if (day && day.k !== "rest") list.push({ dow: d, t: day.t, k: day.k });
    }
    return { ...b, list };
  });
}
