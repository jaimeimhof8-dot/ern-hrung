// Trink-Soll und Erinnerungen. Dieselbe Formel wie die Edge Function «water» (Baselsub60/supabase/functions/water/remind.js).

/** Bis 7 Uhr wird nichts erwartet, bis 21 Uhr steigt das Soll linear auf das Tagesziel (auf 50 ml gerundet). */
export const waterExpected = (goalMl: number, hour: number) => Math.round((goalMl * Math.min(1, Math.max(0, (hour - 7) / 14))) / 50) * 50;

/** Trink-Pflicht (Vollbild in der App): nur zwischen 8 und 21 Uhr und ab diesem Rückstand in ml. */
export const GATE_FROM = 8;
export const GATE_TO = 21;
export const GATE_MIN_BEHIND = 300;
export const GATE_SNOOZE_MIN = 45;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignorieren */
  }
};
export const gateEnabled = () => read('water-gate') !== '0';
export const setGateEnabled = (on: boolean) => write('water-gate', on ? '1' : '0');
export const gateSnoozedUntil = () => Number(read('s60.water.snooze')) || 0;
export const snoozeGate = () => write('s60.water.snooze', String(Date.now() + GATE_SNOOZE_MIN * 60000));
export const pushWanted = () => read('s60.water.push') === '1';
export const setPushWanted = (on: boolean) => write('s60.water.push', on ? '1' : '0');
