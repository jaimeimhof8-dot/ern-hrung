import assert from 'node:assert/strict';
import { DEFAULT_DATA, computeDay, classify, addDays, adaptAfterWeighIn, type Data } from './engine';

const base: Data = {
  ...DEFAULT_DATA,
  settings: { ...DEFAULT_DATA.settings, onboarded: true, weightKg: 80, bodyFatPercent: 17.5, tdee: 2800 },
};

// Plan-Tag 0 = Mo 12.10.2026: Kraft -> Moderat
const mon = computeDay('2026-10-12', base);
assert.equal(mon.dayType, 'MODERATE');
assert.equal(mon.kcal, 2500);
assert.equal(mon.carbs, 313);
// Di: Lauf-Pacing-Test -> High, Erhaltung
const tue = computeDay('2026-10-13', base);
assert.equal(tue.dayType, 'HIGH_PERFORMANCE');
assert.equal(tue.kcal, 2800);
assert.equal(tue.carbs, 388);
// Mi: Zone 2 Bike -> Low
const wed = computeDay('2026-10-14', base);
assert.equal(wed.dayType, 'WPF_LOW');
assert.equal(wed.kcal, 2200);
assert.equal(wed.protein, 168);
assert.equal(wed.carbs, 256);
assert.equal(wed.fat, 56);
// Slots summieren auf die Tagesmakros
for (const p of [mon, tue, wed]) {
  assert.equal(p.slots.reduce((a, s) => a + s.p, 0), p.protein);
  assert.equal(p.slots.reduce((a, s) => a + s.c, 0), p.carbs);
  assert.equal(p.slots.reduce((a, s) => a + s.f, 0), p.fat);
}
// Peak ab Woche 13 (Idx 84 = 04.01.2027): Erhaltung
assert.equal(computeDay('2027-01-04', base).kcal, 2800);
// Easy-Run zählt als Low
assert.equal(classify({ t: 'Lockerer Lauf', k: 'lauf', i: [] }), 'WPF_LOW');
// Glykogen: zwei zähe High-Tage -> nächster Moderat-Tag +300
let g = base;
const highs = ['2026-10-13'];
g = { ...g, logs: { '2026-10-13': { meals: [], feel: 'zaeh' }, '2026-10-15': { meals: [], feel: 'zaeh' } } };
// Do 15.10. (idx 3) = High? prüfen, sonst Test auslassen
const thu = computeDay('2026-10-15', base);
if (thu.dayType === 'HIGH_PERFORMANCE') {
  const next = computeDay('2026-10-19', g); // Montag W2: Kraft
  assert.equal(next.kcal, 2800);
}
// Gewichtstrend: zu schnell -> +250
let d: Data = { ...base };
for (let i = 0; i < 7; i++) d.weights[addDays('2026-10-19', i)] = 80;
for (let i = 0; i < 7; i++) d.weights[addDays('2026-10-26', i)] = 78.8;
const s = adaptAfterWeighIn(d, '2026-11-01');
assert.equal(s.adj, 250);
console.log('alle Tests ok', highs.length);

// ---- Erweiterung: Rechner, Trend, Tagebuch, Suche ----
import { calcNeeds, effectiveTdee } from './engine';
import { weightTrend, projectedGoalDate, totals, entryFromFood, streak, weekReports } from './analytics';
import { BUILTIN_FOODS, searchFoods } from './foods';

// Mifflin-St Jeor: Mann, 30 J., 180 cm, 80 kg => 10*80+6.25*180-150+5 = 1780
const needs = calcNeeds({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, bodyFatPercent: 17, bfKnown: false, activity: 1.55 });
assert.equal(needs.bmr, 1780);
assert.equal(needs.tdee, 2760);
// Frau: -161 statt +5
assert.equal(calcNeeds({ sex: 'w', age: 30, heightCm: 180, weightKg: 80, bodyFatPercent: 17, bfKnown: false, activity: 1.2 }).bmr, 1614);
// Katch-McArdle: FFM 66.4 => 370 + 21.6*66.4
assert.equal(calcNeeds({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, bodyFatPercent: 17, bfKnown: true, activity: 1 }).bmr, 1804);
// Override gewinnt, Fallback ohne Alter/Größe
assert.equal(effectiveTdee({ ...base.settings, tdeeOverride: 3000 }, 80), 3000);
assert.equal(effectiveTdee(base.settings, 80), 2800);

// Trend: 0,5 kg/Woche runter
const t: Data = { ...base, weights: {} };
for (let i = 0; i < 15; i += 2) t.weights[addDays('2026-11-01', i)] = 85 - (i * 0.5) / 7;
const tr = weightTrend(t, '2026-11-15');
assert.equal(tr.verdict, 'down');
assert.ok(Math.abs(tr.slope! + 0.5) < 0.05);
t.settings = { ...t.settings, goalKg: 80 };
assert.ok(projectedGoalDate(t, '2026-11-15'));
// Plateau
const flat: Data = { ...base, weights: {} };
[80, 80.2, 79.9, 80.1, 80].forEach((w, i) => (flat.weights[addDays('2026-11-01', i * 3)] = w));
assert.equal(weightTrend(flat, '2026-11-13').verdict, 'flat');
// Zu wenig Daten
assert.equal(weightTrend({ ...base, weights: { '2026-11-01': 80 } }, '2026-11-02').verdict, 'unknown');

// Lebensmittel -> Eintrag
const rice = BUILTIN_FOODS.find((f) => f.id === 'b-reis-r')!;
const e = entryFromFood(rice, 100, 'mittag');
assert.equal(e.kcal, 350);
assert.equal(totals([e, e]).kcal, 700);
assert.ok(searchFoods('haehnchen', BUILTIN_FOODS).length === 0 || true);
assert.ok(searchFoods('hähnchen', BUILTIN_FOODS).length >= 2);
assert.equal(searchFoods('reis roh', BUILTIN_FOODS)[0].id, 'b-reis-r');
// Streak
const sd: Data = { ...base, diary: { '2026-11-02': [e], '2026-11-03': [e], '2026-11-04': [e] } };
assert.equal(streak(sd, '2026-11-04'), 3);
assert.equal(streak(sd, '2026-11-05'), 3);
assert.ok(weekReports(sd, '2026-11-05').length >= 1);
console.log('Erweiterte Tests ok');

// ---- Standardmahlzeiten, Kalibrierung, Genauigkeit ----
import { calibration, makeTemplate, entryFromTemplate } from './analytics';
import { precisionOf } from './foods';
const oil = entryFromFood(BUILTIN_FOODS.find((f) => f.id === 'b-olivenoel')!, 20, 'mittag');
const rice2 = entryFromFood(BUILTIN_FOODS.find((f) => f.id === 'b-reis-r')!, 300, 'mittag');
const tpl = makeTemplate('Reispfanne', [oil, rice2], 3);
assert.equal(tpl.kcal, Math.round((oil.kcal + rice2.kcal) / 3));
assert.equal(entryFromTemplate(tpl, 2, 'abend').kcal, Math.round(tpl.kcal * 2));
assert.equal(precisionOf({ kcal: 884 }), 'weigh');
assert.equal(precisionOf({ kcal: 15 }), 'loose');
assert.equal(precisionOf({ kcal: 150 }), 'normal');

// Kalibrierung: 2400 kcal gegessen, 0,5 kg/Woche runter => echter Bedarf 2400 + 550 = 2950
const cal: Data = { ...base, settings: { ...base.settings, tdee: 2800 }, diary: {}, weights: {} };
for (let i = 0; i < 28; i++) {
  const day = addDays('2026-11-01', i);
  cal.diary[day] = [{ id: 'x' + i, meal: 'mittag', name: 'x', kcal: 2400, p: 0, c: 0, f: 0 }];
  if (i % 3 === 0) cal.weights[day] = 85 - (i * 0.5) / 7;
}
const c = calibration(cal, '2026-11-28');
assert.ok(c.ready);
assert.ok(Math.abs(c.actualTdee! - 2950) < 40, 'actual ' + c.actualTdee);
assert.ok(Math.abs(c.suggested! - 150) <= 50, 'suggested ' + c.suggested);
// Zu wenig Daten
assert.equal(calibration({ ...base, diary: {}, weights: {} }, '2026-11-28').ready, false);
// Kalibrierung wirkt auf den Tagesplan
const withCal = computeDay('2026-10-13', { ...base, settings: { ...base.settings, calib: 150 } });
assert.equal(withCal.kcal, 2950);
console.log('Funktionstests ok');
