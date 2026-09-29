// Recordatorio de las 10 pm: avisa a quien todavía no llena su día.
// Lo corre GitHub Actions (.github/workflows/recordatorio.yml).
import webpush from 'web-push';

const { SUPABASE_URL, SUPABASE_KEY, PUSH_SECRET, VAPID_PUBLIC, VAPID_PRIVATE, TODOS } = process.env;
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
const todos = TODOS === 'true';

if (!todos && (hoy < '2026-10-01' || hoy > '2026-12-23')) {
  console.log(`Fuera del reto (${hoy}), no se manda nada.`);
  process.exit(0);
}

webpush.setVapidDetails('https://axelhc1001.github.io/winter-arc/', VAPID_PUBLIC, VAPID_PRIVATE);

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return r.json();
}

const FRASES = [
  'no has llenado tu día. Son 10 segundos 💪',
  'el Winter Arc no se llena solo ❄️',
  'tu racha 🔥 está en peligro. Marca tu día.',
  'los demás ya marcaron. ¿Y tú? 👀',
];

const targets = await rpc('wa_push_targets', { p_secret: PUSH_SECRET });
let enviados = 0;
for (const t of targets) {
  if (!todos && !t.falta) continue;
  const frase = todos ? 'prueba de recordatorio ✅' : FRASES[Math.floor(Math.random() * FRASES.length)];
  try {
    await webpush.sendNotification(t.sub, JSON.stringify({ title: '❄️ Winter Arc', body: `${t.name}, ${frase}`, url: './' }), { TTL: 3600 });
    enviados++;
  } catch (e) {
    console.log(`Falló con ${t.name}: ${e.statusCode}`);
    if (e.statusCode === 404 || e.statusCode === 410) await rpc('wa_push_gone', { p_secret: PUSH_SECRET, p_endpoint: t.sub.endpoint });
  }
}
console.log(`${hoy}: ${targets.length} suscripciones, ${enviados} avisos enviados.`);
