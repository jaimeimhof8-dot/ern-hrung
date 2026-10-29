// Vercel-Funktion: Bildanalyse (Nährwerttabelle, Teller) über die Claude-API.
// Schlüssel nur als Umgebungsvariable ANTHROPIC_API_KEY. Zugriff nur mit gültigem Supabase-Login (sonst könnte jeder deinen Schlüssel verbrauchen).
const SUPABASE_URL = 'https://mwhbjrulzxiwtjvcwojo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_srJQv2rw2Njbv10g_eYioA_igQMR1vN';

const PROMPTS = {
  etikett:
    'Lies die Nährwerttabelle auf dem Foto. Antworte NUR mit JSON: {"name":string,"kcal":number,"p":number,"c":number,"f":number,"serving_g":number|null}. Werte pro 100 g bzw. 100 ml (p=Eiweiss, c=Kohlenhydrate, f=Fett, kcal=Energie in kcal). Rechne um, falls die Tabelle pro Portion angegeben ist. Ist keine Tabelle lesbar: {"kcal":null}.',
  teller:
    'Das Foto zeigt eine Mahlzeit. Liste jeden erkennbaren Bestandteil einzeln auf und schätze das Gewicht des Gezeigten (Zustand wie serviert, gekocht bzw. roh passend zum Aussehen). ' +
    'Genauigkeitsregeln: Nutze Referenzgrössen im Bild (Teller ca. 26 cm, Besteck, Hand, Verpackung), um Gramm zu bestimmen. Schätze eher knapp als grosszügig: Bei Unsicherheit nimm den kleineren plausiblen Wert, ein kleiner Teller oder eine Portion mit viel Leerfläche ist wenig Essen. ' +
    'Rechne kein Öl, keine Butter, keine Sauce und kein Dressing ein, ausser es ist sichtbar (glänzend, Pfütze, erkennbare Sauce); dann als eigenen Posten mit realistischer Menge (z. B. 5 bis 10 g Öl). Erfinde keine Bestandteile, die nicht erkennbar sind. ' +
    'Nährwerte aus üblichen Tabellenwerten pro 100 g des jeweiligen Lebensmittels (kcal muss zu 4·p + 4·c + 9·f passen, Abweichung höchstens 10 %). Getränke nur, wenn sie kalorienhaltig sind. ' +
    'Antworte NUR mit JSON: {"items":[{"name":string (deutsch),"g":number,"kcal":number,"p":number,"c":number,"f":number}]}. Ist kein Essen zu sehen: {"items":[]}.',
};

export default async function handler(req, res) {
  const send = (code, body) => res.status(code).json(body);
  if (req.method !== 'POST') return send(405, { error: 'method' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return send(500, { error: 'ANTHROPIC_API_KEY fehlt auf dem Server' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return send(401, { error: 'Bitte im Profil anmelden (Garmin-Login), dann geht der Foto-Scan.' });
  const who = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) return send(401, { error: 'Anmeldung abgelaufen. Im Profil neu anmelden.' });

  const { kind, image } = req.body || {};
  if (!(kind in PROMPTS) || typeof image !== 'string' || image.length > 3_000_000) return send(400, { error: 'Eingabe' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } }, { type: 'text', text: PROMPTS[kind] }] }],
      }),
    });
    const j = await r.json();
    if (!r.ok) return send(502, { error: j.error?.message ?? 'API-Fehler' });
    const text = (j.content ?? []).find((b) => b.type === 'text')?.text ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return send(502, { error: 'Antwort nicht lesbar' });
    const out = JSON.parse(m[0]);
    if (kind === 'teller' && Array.isArray(out.items)) {
      // kcal und Makros müssen zusammenpassen: bei mehr als 10 % Abweichung gilt der Makro-Wert
      out.items = out.items.map((x) => {
        const calc = Math.round(4 * (x.p || 0) + 4 * (x.c || 0) + 9 * (x.f || 0));
        return calc > 0 && Math.abs(calc - x.kcal) > 0.1 * calc ? { ...x, kcal: calc } : x;
      });
    }
    send(200, out);
  } catch {
    send(500, { error: 'Analyse fehlgeschlagen' });
  }
}
