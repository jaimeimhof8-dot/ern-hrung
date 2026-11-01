import { createClient } from '@supabase/supabase-js';
import { addDays, toISO, type GarminAct } from './engine';

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
export async function fetchGarminActs(days = 7): Promise<GarminAct[] | null> {
  const to = toISO(new Date());
  const { data, error } = await sb.functions.invoke('garmin', { body: { action: 'sync', from: addDays(to, -(days - 1)), to } });
  if (error || !Array.isArray(data?.acts)) return null;
  return (data.acts as Record<string, unknown>[])
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
}

export async function accessToken(): Promise<string | null> {
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}
