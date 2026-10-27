// Kleine, reine Helfer, die von mehreren Modulen gebraucht werden.
export const KINDS = ["kraft", "lauf", "bike", "station", "sim", "rest", "race"];
export const KIND_LABEL = { kraft: "Kraft", lauf: "Lauf", bike: "Rad", station: "Stationen", rest: "Ruhe", sim: "Doubles", race: "Rennen" };
export const HARD_KINDS = ["kraft", "lauf", "station", "sim", "race"];

export const clone = (o) => JSON.parse(JSON.stringify(o));
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Übungsname ohne Satz-/Wdh-Angaben – um Einträge über Planänderungen hinweg wiederzufinden. */
export const exName = (t) => String(t).split(/\s\d|\s@|\s–|,|\sRPE\b/i)[0].trim().toLowerCase().replace(/s$/, "");

export const isTraining = (d) => !!d && d.k !== "rest";
/** Lockerer Dauerlauf (Zone 2): zählt trotz Art "lauf" nicht als harte Einheit. Intervall- und Testläufe bleiben hart. */
export const isEasyRun = (d) => !!d && d.k === "lauf" && /^(lockerer lauf|lauf zone 2)\b/i.test(d.t || "");
export const isHard = (d) => !!d && HARD_KINDS.includes(d.k) && !isEasyRun(d);

/** Inhaltlicher Vergleich zweier Tage (ohne Metadaten wie src/why). */
export function sameDay(a, b) {
  if (!a || !b) return a === b;
  const n = (d) => JSON.stringify([d.t, d.k, d.i || [], d.n || "", !!d.key, !!d.joint, !!d.race]);
  return n(a) === n(b);
}

export const mmss = (s) => { s = Math.round(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
export function parseT(v) {
  v = String(v || "").trim().replace(",", ".");
  if (!v) return NaN;
  if (v.includes(":")) { const [m, s] = v.split(":"); return (+m) * 60 + (+s); }
  const n = +v; return isNaN(n) ? NaN : n;
}
export const avg = (a) => { const v = a.map(parseT).filter((x) => !isNaN(x)); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

/** JSON tolerant aus einer Modellantwort lesen: ganz, aus einem Code-Fence oder vom ersten { bis zur letzten }. */
export function extractJson(text) {
  const s = String(text || "").trim();
  try { return JSON.parse(s); } catch (_) { /* weiter */ }
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) { /* weiter */ } }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (_) { /* weiter */ } }
  throw Object.assign(new Error("Antwort enthält kein gültiges JSON"), { code: "invalid_json", text: s });
}
