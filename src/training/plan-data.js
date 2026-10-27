// Eingebauter Plan (Stand 18.09.2026) – wird verwendet, bis ein PDF hochgeladen wird.
import { NWEEKS } from "./dates.js";
import { isHard } from "./util.js";
import { LATER_DAYS } from "./plan-later.js";

const R = (n) => ({ t: "Ruhetag", k: "rest", i: [], n: n || "Echte Erholung. Kein Bike, kein Zirkel." });
const KRAFT = (items, n) => ({ t: "Kraft 1", k: "kraft", i: items, n });

export const WEEKS_A = [
  { name: "Standortbestimmung", days: [
    KRAFT(["Back Squat 3×5 @75% RPE 7", "Bulgarian Split Squat 3×8 je Seite RPE 7", "Bench Press 3×6 RPE 7", "Shoulder Press 3×8 RPE 7", "Pull-ups 3×6 RPE 7", "Plank 3×50″"], "Arbeitsgewicht, kein Testsatz. Kein Zone-2-Zusatz danach."),
    { t: "Lauf-Pacing-Test mit Jimoh", k: "lauf", i: ["15′ Einlaufen + Mobility", "4×1km zusammen, RPE 8–9 (kein Sprint), 2′ Trabpause", "Abstand zwischen euch notieren (5–15 Sek. Toleranz)", "10′ Auslaufen"], n: "Splits hier eintragen (z. B. 3:52 3:55 3:50 3:58), sie landen automatisch unter Tests & Benchmarks und ergeben dein Team-Tempo T.", test: true },
    { t: "Zone 2 Bike", k: "bike", i: ["Bike 45–60′ bei 65–70% max HF"] },
    { t: "Stationen-Benchmark mit Jimoh", k: "station", i: ["SkiErg 1000m", "Sled Push", "Sled Pull", "Burpee Broad Jumps 80m", "RowErg 1000m", "Farmers Carry", "Sandbag Lunges", "100 Wall Balls"], n: "3–5′ Pause zwischen den Stationen, im Wechsel: einer testet, einer stoppt. Ein Test, kein Erschöpfungs-Circuit.", test: true },
    R("Fix Ruhetag."),
    { t: "Lange Fahrt Zone 2", k: "bike", i: ["75–90′ Zone 2 Bike, locker"] },
    R("Nach zwei Testtagen hat der Körper das verdient.")] },
  { name: "Aufbau auf Testbasis", days: [
    KRAFT(["Back Squat 3×5 @75–80% RPE 7", "Bulgarian Split Squat 3×8 je Seite RPE 7", "Bench Press 3×6 RPE 7", "Shoulder Press 3×8 RPE 7", "Pull-ups 3×6 RPE 7–8", "Plank 3×50″"]),
    { t: "Intervall mit Jimoh", k: "lauf", i: ["15′ Einlaufen", "4×1km @ T + 10–15 sec/km, 2′ Trabpause", "10′ Auslaufen"], n: "Ziel: Streuung ≤10 sec/km UND enger Abstand zueinander.", tp: [10, 15] },
    { t: "Zone 2 Bike", k: "bike", i: ["Bike 45–60′ bei 65–70% max HF"] },
    { t: "Kraft 2 + Compromised Running", k: "station", i: ["3 Runden im Wechsel: 400m Ski, 400m Row, 10 Sled Push moderat, 15 Wall Balls", "Compromised Running 1×8′ Zone 3 (75–80% max HF), zusammen"] },
    R("Fix Ruhetag."),
    { t: "Lange Fahrt Zone 2", k: "bike", i: ["75–90′ Zone 2 Bike"] },
    R()] },
  { name: "Hart + Transition Drilling", days: [
    KRAFT(["Back Squat 3×3 @85% + Back-off RPE 7–8", "Bulgarian Split Squat 4×8 je Seite RPE 8", "Bench Press 4×5 RPE 8", "Shoulder Press 4×6 RPE 7–8", "Pull-ups 4×6 RPE 8", "Plank 3×60″"]),
    { t: "Intervall mit Jimoh", k: "lauf", i: ["15′ Einlaufen + Mobility", "4×6′ @ 85% max HF, 2′ Trabpause, im Team-Tempo", "10′ Auslaufen"] },
    { t: "Zone 2 Bike", k: "bike", i: ["Bike 45–60′"] },
    { t: "Kraft 2 + Compromised Running", k: "station", i: ["4 Runden im Wechsel: 300m Ski, 15m Sled Push moderat, 15 Wall Balls, 20m Sled Pull", "Compromised Running 2×10′ Zone 3, 2′ Pause, zusammen"] },
    R("Fix Ruhetag."),
    { t: "Doubles Transition Drilling", k: "sim", i: ["4–6 komplette Stationswechsel am Stück", "Übergabezeiten messen (Ziel < 8 Sek.)"], n: "Fokus nur auf die Übergabe, nicht auf die Stationsleistung. Wenn möglich beide mit Pulsuhr." },
    R()] },
  { name: "Deload", days: [
    KRAFT(["Back Squat 3×5 @65% RPE 5–6", "Bulgarian Split Squat 2×8 je Seite RPE 5–6", "Bench Press 2×8 RPE 5–6", "Shoulder Press 2×8 RPE 5–6", "Pull-ups 3×6 RPE 6", "Plank 2×45″"], "Leicht."),
    { t: "Intervall kurz", k: "lauf", i: ["15′ Einlaufen", "3×4′ @ 90% max HF, 3′ Trabpause", "10′ Auslaufen"] },
    { t: "Zone 2 Bike ganz locker", k: "bike", i: ["Bike 45′, ganz locker"] },
    { t: "Kraft 2 – Technik only", k: "station", i: ["Stationen ohne Zeitdruck, niedriges Volumen"], n: "Kein Compromised Running diese Woche." },
    R("Fix Ruhetag."),
    { t: "Lange Fahrt Zone 2", k: "bike", i: ["75–90′ Zone 2 Bike, ruhig"] },
    R("Kurzer Rückblick: Testwerte vs. Woche 3, was nimmst du in Block B mit?")] }
];

export const BLOCKS = {
  A: { name: "Standortbestimmung", range: "12.10. – 08.11.", start: 0 },
  B: { name: "Build I – Renn-Spezifität", range: "09.11. – 06.12.", start: 28, d: [
    ["Kraft 1", "kraft", "Ein Schwerset pro Woche, 6–8 Wdh"], ["Schwellenintervalle", "lauf", "3–5×8–12′ Zone 4"], ["Zone 2 Bike", "bike", "60–90′"],
    ["Stationen unter Zeitdruck + Compromised Running", "station", "AMRAP intensiver, mit Jimoh"], ["Ruhetag", "rest", ""], ["Doubles Transition Drilling", "sim", "Übergabe < 8 Sek., eine lange Fahrt dazu"], ["Ruhetag", "rest", ""]] },
  C: { name: "Build II – Stationskraft & Sims", range: "07.12. – 03.01.", start: 56, d: [
    ["Kraft 1 Zirkel", "kraft", "Zirkelformate, kürzere Pausen"], ["Kurze schnelle Reps", "lauf", "Zone 4/5"], ["Zone 2 Bike", "bike", "60–90′"],
    ["Stationen schwer", "station", "Sled Race Weight+, unter Ermüdung"], ["Ruhetag", "rest", ""], ["Doubles-Simulation", "sim", "#1–2 bei 70–85% Intensität"], ["Ruhetag", "rest", ""]] },
  D: { name: "Peak – Renn-Bricks", range: "04.01. – 31.01.", start: 84, d: [
    ["Kraft 1 explosiv", "kraft", "Komplex, wenig Volumen"], ["Brick: Lauf + Station + Lauf", "lauf", "Renn-nah"], ["Zone 2 Bike", "bike", "60–90′"],
    ["Renn-Szenario-Bricks", "station", "mit Jimoh"], ["Ruhetag", "rest", ""], ["Doubles-Simulation", "sim", "#3–4 bei 85–95% Intensität"], ["Ruhetag", "rest", ""]] },
  T: { name: "Taper", range: "01.02. – 13.02.", start: 112, d: [
    ["Kraft 1 minimal", "kraft", "Technik / Mobilität"], ["Kurz und scharf", "lauf", "Wenig Volumen, Renn-Pace-Reize"], ["Zone 2 reduziert", "bike", "30–45′"],
    ["Nur Technik", "station", "Kein Erschöpfungsreiz"], ["Ruhetag", "rest", ""], ["Finale Sim 90–100%", "sim", "Anfang Taper-Woche, dann runter"], ["Ruhetag", "rest", ""]] }
};
export const BLOCK_ORDER = ["A", "B", "C", "D", "T"];
export const WAVE = ["moderat", "hart", "Spitzenreiz", "Deload"];
export const RACE_IDX = 124; // Sa 13.02.2027

export function blockOfWeek(w) {
  let b = "A";
  for (const k of BLOCK_ORDER) if (w * 7 >= BLOCKS[k].start) b = k;
  return b;
}
export function weekInfo(w) {
  const b = blockOfWeek(w);
  if (b === "A") return { block: b, name: WEEKS_A[w].name, wave: w === 0 ? "Test" : WAVE[w] };
  const wi = Math.min(3, w - BLOCKS[b].start / 7);
  return { block: b, name: BLOCKS[b].name, wave: b === "T" ? "Taper" : WAVE[wi] };
}

const withFlags = (d) => {
  const day = { ...d, i: d.i ? [...d.i] : [] };
  day.key = isHard(day);
  day.joint = ["lauf", "station", "sim", "race"].includes(day.k);
  return day;
};

/** Plan als flache Tagesliste {idx: day} – die Form, mit der Import und Umplanen arbeiten. */
export function buildBuiltinPlan() {
  const days = {};
  for (let w = 0; w < NWEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const idx = w * 7 + d;
      if (w < 4) { days[idx] = withFlags(WEEKS_A[w].days[d]); continue; }
      // Ab Woche 5: Übungszeilen aus dem Coach-PDF (generiert), sonst nur das Blockmuster
      if (LATER_DAYS[idx]) { days[idx] = withFlags(LATER_DAYS[idx]); continue; }
      const x = BLOCKS[blockOfWeek(w)].d[d];
      days[idx] = withFlags({ t: x[0], k: x[1], i: x[1] === "rest" ? [] : [x[0]], n: x[2] ? x[2] + ". Genaue Zahlen folgen nach den Testdaten aus Block A." : "" });
    }
  }
  days[RACE_IDX] = withFlags({ t: "HYROX Basel – Rennen", k: "race", i: ["Doubles Men PRO mit Jimoh"], n: "Stationsaufteilung wie fixiert, Übergaben unter 8 Sek.", race: true });
  return { source: "builtin", updatedAt: null, history: [], days };
}
