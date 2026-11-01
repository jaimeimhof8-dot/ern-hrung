import { createClient } from '@supabase/supabase-js';
import { addDays, toISO, trainingFor, type GarminAct, type PlanDay } from './engine';

// Dasselbe Supabase-Projekt wie die HYROX-App. Der publishable Key darf öffentlich sein (Zugriff regelt der Login).
const sb = createClient('https://mwhbjrulzxiwtjvcwojo.supabase.co', 'sb_publishable_srJQv2rw2Njbv10g_eYioA_igQMR1vN', {
  auth: { persistSession: true, storageKey: 's60.sb' },
});

export async function garminUser(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function garminSignIn(email: string, password: string): Promise<string | null> {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? 'E-Mail oder Passwort stimmt nicht.' : null;
}

export const garminSignOut = () => sb.auth.signOut();

/** Schritte der letzten 7 Tage aus Garmin (über die Funktion «garmin» der HYROX-App). */
export async function fetchGarminSteps(): Promise<Record<string, number> | null> {
  const to = toISO(new Date());
  const { data, error } = await sb.functions.invoke('garmin', { body: { action: 'steps', from: addDays(to, -6), to } });
  if (error || !data?.steps) return null;
  return data.steps as Record<string, number>;
}

/** Aktivitäten der letzten Tage aus Garmin (Aktion «sync» der Funktion «garmin»; liefert auch Kalorien pro Einheit). */
export async function fetchGarminActs(days = 7): Promise<{ acts: GarminAct[]; steps: Record<string, number> } | null> {
  const to = toISO(new Date());
  const { data, error } = await sb.functions.invoke('garmin', { body: { action: 'sync', from: addDays(to, -(days - 1)), to } });
  if (error || !Array.isArray(data?.acts)) return null;
  const steps: Record<string, number> = {};
  for (const [d, w] of Object.entries((data.well ?? {}) as Record<string, { steps?: number | null }>)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && typeof w?.steps === 'number') steps[d] = Math.round(w.steps);
  }
  const acts = (data.acts as Record<string, unknown>[])
    .filter((a) => typeof a.id === 'string' && typeof a.date === 'string' && typeof a.group === 'string')
    .map((a) => ({
      id: a.id as string,
      name: String(a.name ?? ''),
      group: a.group as string,
      date: a.date as string,
      time: Number(a.time) || 0,
      kcal: typeof a.kcal === 'number' ? a.kcal : null,
      hr: typeof a.hr === 'number' ? a.hr : null,
    }));
  return { acts, steps };
}

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const LAST_IDX = 125;
const dayKey = (i: number) => {
  const d = new Date(2026, 9, 12 + i);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const sameDay = (a: PlanDay | null, b: PlanDay | null) => JSON.stringify([a?.t, a?.k, a?.i ?? []]) === JSON.stringify([b?.t, b?.k, b?.i ?? []]);

/**
 * Tatsächlicher Plan aus der Trainings-App (gleiche Anmeldung, gleiches Supabase-Projekt):
 * eigener oder gemeinsamer Plan, gemeinsame Änderungen, eigene Übungsanpassung (S.edit), Tausch (S.sched.src),
 * Verletzung (S.sched.inj) und «Ausfallen lassen» (S.skip). Liefert nur Tage, die vom eingebauten Plan abweichen.
 * Gleiche Reihenfolge wie dayPlan() in der Trainings-App. Bei Fehlern null (dann bleibt der letzte Stand).
 */
export async function fetchPlanOverrides(): Promise<Record<number, PlanDay> | null> {
  const { data: ses } = await sb.auth.getSession();
  const uid = ses.session?.user.id;
  if (!uid) return null;
  const [st, sh, sp] = await Promise.all([
    sb.from('plan_state').select('data').eq('user_id', uid).maybeSingle(),
    sb.from('shared_edits').select('day,data'),
    sb.from('shared_plan').select('data').maybeSingle(),
  ]);
  if (st.error || sh.error || sp.error) return null;
  const S: Raw = (st.data?.data as Raw) ?? {};
  const shared: Raw | null = (sp.data?.data as Raw) ?? null;
  const team: Record<number, Raw> = {};
  for (const r of (sh.data ?? []) as Raw[]) team[r.day] = r.data;
  const ownActive = !!S.plan?.days && (!shared || (S.plan.importedAt || 0) > (shared.importedAt || 0));
  const plan: Raw | null = ownActive ? S.plan : shared?.days ? shared : null;
  const out: Record<number, PlanDay> = {};
  for (let i = 0; i <= LAST_IDX; i++) {
    const o: Raw = S.sched?.[i] ?? {};
    const src: number = o.src != null ? o.src : i;
    const bundled = trainingFor(dayKeyToISO(src));
    const base: PlanDay | null = (plan?.days?.[src] as PlanDay | undefined) ?? bundled;
    if (!base) continue;
    let p: PlanDay = { ...base };
    if (!base.race && team[src]) p = { ...p, t: team[src].t, k: team[src].k, i: team[src].i, n: team[src].n || '' };
    const ed: Raw | undefined = S.edit?.[src];
    if (ed && p.k !== 'rest') p = { ...p, t: ed.t || p.t, k: ed.k || p.k, i: ed.i ?? p.i, n: ed.n || '' };
    if (o.inj) {
      p = o.inj === 'pause' || p.k === 'rest'
        ? { t: p.k === 'rest' ? 'Ruhetag' : 'Verletzt – Pause', k: 'rest', i: [] }
        : { t: 'Alternativtraining', k: 'bike', i: p.i };
    } else if (S.skip?.[dayKey(i)] && p.k !== 'rest') {
      p = { t: 'Ausgefallen', k: 'rest', i: [] };
    }
    const own = trainingFor(dayKeyToISO(i));
    if (!sameDay(p, own)) out[i] = p;
  }
  return out;
}
const dayKeyToISO = (i: number) => toISO(new Date(2026, 9, 12 + i));

export async function accessToken(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
