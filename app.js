(() => {
'use strict';

// ======================= configuración del reto =======================
const CFG = window.WA_CONFIG || {};
const VAPID = 'BBJ6ZnOMhHb-tLS1lltwXsBPqPFRVtvqCk5PUxe5O37LmuO97JCAKQKXJYUNKbkONJdByrsAUQT73Htm8UyQW-o';
const NAMES = ['Axel', 'Emilio', 'Santiago', 'Diego', 'Lorenzo'];
const COLORS = { Axel: '#7dd3fc', Emilio: '#a78bfa', Santiago: '#34d399', Diego: '#fbbf24', Lorenzo: '#f472b6' };
const START = '2026-10-01', END = '2026-12-23', GOALS_LOCK = '2026-10-01';
const RACE_BONUS = '2026-10-31', RACE_PENALTY = '2026-11-30';
const TZ = 'America/Mexico_City';
const MONTHS = [['2026-10', 'octubre'], ['2026-11', 'noviembre'], ['2026-12', 'diciembre']];
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MAX_COMODINES = 2;
const EMOJIS = ['🔥', '💪', '🐐', '💀', '🤡'];
const EJ_TIPOS = ['🏋️ Pesas', '🏃 Correr', '⚽ Fútbol', '🚴 Bici', '🏊 Nadar', '🥊 Box', '🔥 Crossfit', '🧗 Otro'];
const CUSTOM_ICONS = ['⭐', '🗣️', '💧', '🚶', '📵', '🍬', '💻', '🎸', '🙏', '📝', '🌅', '🧹', '💰', '🎯', '🧴', '🎮'];

const FIXED = [
  { k: 'ejercicio', icon: '🏋️', label: 'Ejercicio', min: 4, def: 5 },
  { k: 'dormir',    icon: '😴', label: 'Dormí 7–8 horas', min: 5, def: 5 },
  { k: 'comer',     icon: '🥗', label: 'Comí bien', min: 5, def: 5 },
  { k: 'leer',      icon: '📖', label: 'Leí', min: 5, def: 5 },
  { k: 'meditar',   icon: '🧘', label: 'Medité', min: 3, def: 3 },
  { k: 'frio',      icon: '🧊', label: 'Reto personal', min: 5, def: 7 },
];
const DEF_GOALS = { ejercicio: 5, dormir: 5, comer: 5, leer: 5, leer_pags: 10, meditar: 3, frio: 7,
  frio_nombre: 'Baño con agua fría', alcohol_max: 1, alcohol_cada: 7, chaqueta_max: 0, aprender: '',
  custom: [{ i: '⭐', n: '', t: 5 }, { i: '⭐', n: '', t: 5 }] };

// ======================= utilidades =======================
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const D = s => new Date(s + 'T12:00:00Z');
const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const dow = s => D(s).getUTCDay();
const fmt = s => `${DIAS[dow(s)]} ${+s.slice(8)} ${MES[+s.slice(5, 7) - 1]}`;
const fmtS = s => `${+s.slice(8)} ${MES[+s.slice(5, 7) - 1]}`;
const maxS = (a, b) => a > b ? a : b;
const minS = (a, b) => a < b ? a : b;
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('wa_' + k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('wa_' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('wa_' + k); } catch {} },
};
function ago(ts) {
  const m = Math.round((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return 'ahorita';
  if (m < 60) return `hace ${m} min`;
  if (m < 60 * 24) return `hace ${Math.round(m / 60)} h`;
  return fmtS(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(ts)));
}
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }
const buzz = () => { try { navigator.vibrate && navigator.vibrate(12); } catch {} };

const WEEKS = [];
for (let s = START; s <= END;) {
  let e = s; while (dow(e) !== 0 && e < END) e = addDays(e, 1);
  WEEKS.push({ s, e, days: diff(s, e) + 1 });
  s = addDays(e, 1);
}
const TOTAL_DAYS = diff(START, END) + 1;

// ======================= Supabase =======================
const H = () => ({ apikey: CFG.key, 'Content-Type': 'application/json' });
async function get(path) {
  const r = await fetch(`${CFG.url}/rest/v1/${path}`, { headers: H(), cache: 'no-store' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function rpc(fn, body) {
  const r = await fetch(`${CFG.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H(), body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
const mine = extra => ({ p_name: me.name, p_pin: me.pin, ...extra });
const imgUrl = path => `${CFG.url}/storage/v1/object/public/fotos/${path}`;
const ERR = { bad: 'PIN incorrecto', locked: 'Demasiados intentos. Espera 15 minutos.',
  fecha: 'Solo se marca del 1 oct al 23 dic, hoy o hasta 2 días atrás.', congeladas: 'Tus metas ya quedaron fijas desde el 1 de octubre.',
  datos: 'Datos inválidos', no_user: 'Nombre no encontrado', comodines: `Ya usaste tus ${MAX_COMODINES} comodines`, calma: 'Más despacio 😅' };
const okRes = r => r === 'ok' || r === 'created';

// ======================= estado =======================
let me = store.get('me');                 // { name, pin }
let people = {}, checks = {}, ctimes = {}, photos = [], reactions = [], bodyPub = [], myBody = [], status = {};
let view = store.get('view') || 'hoy';
let selDay = today();
let openRank = null, editingGoals = false, formDirty = false, loaded = false;
let pending = 0;                           // guardados en curso
let upload = null;                         // { mode, blob, url }
let installEvt = null, pushOn = false;

async function load() {
  const [p, c, ph, re, bo, st] = await Promise.all([
    get('wa_people?select=name,goals,race,avatar,app_at'),
    get('wa_checks?select=name,day,habits,updated_at&limit=5000'),
    get('wa_photos?select=*&order=created_at.desc&limit=120'),
    get('wa_reactions?select=*&order=created_at.asc&limit=5000'),
    get('wa_body?select=*&order=day.asc'),
    rpc('wa_status', {}).catch(() => []),
  ]);
  status = {}; (st || []).forEach(x => status[x.name] = x);
  const keep = me && pending ? checks[me.name] : null;
  people = {}; p.forEach(x => people[x.name] = x);
  checks = {}; ctimes = {};
  c.forEach(x => { (checks[x.name] ||= {})[x.day] = x.habits || {}; (ctimes[x.name] ||= {})[x.day] = x.updated_at; });
  if (keep) checks[me.name] = keep;
  photos = ph; reactions = re; bodyPub = bo;
  loaded = true;
}
async function loadMyBody() {
  if (!me) return;
  try { myBody = await rpc('wa_my_body', mine()); } catch { myBody = []; }
}

// ======================= metas y puntos =======================
const goalsComplete = g => !!g && Array.isArray(g.custom) && g.custom.filter(c => c && String(c.n || '').trim()).length >= 2;
function posHabits(g) {
  return [
    ...FIXED.map(h => ({ k: h.k, icon: h.icon, goal: +g[h.k] || 0,
      label: h.k === 'frio' ? (g.frio_nombre || 'Reto personal') : h.k === 'leer' ? `Leí ${g.leer_pags || 10}+ páginas` : h.label })),
    ...(g.custom || []).slice(0, 2).map((c, i) => ({ k: 'c' + (i + 1), icon: c.i || '⭐', label: c.n || 'Hábito propio', goal: +c.t || 0, custom: true })),
  ];
}
function countIn(ch, k, a, b) { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (ch[d]?.[k]) n++; return n; }
function sumIn(ch, k, a, b) { let n = 0; for (let d = a; d <= b; d = addDays(d, 1)) n += +(ch[d]?.[k]) || 0; return n; }
const alcoholWindow = (g, end) => [maxS(START, addDays(end, -((+g.alcohol_cada || 7) - 1))), end];

function weekEval(g, ch, w, t) {
  const closed = t > w.e;
  const cm = countIn(ch, 'comodin', w.s, w.e);
  const eff = Math.max(0, w.days - cm);
  let met = 0;
  const det = posHabits(g).map(h => {
    const n = countIn(ch, h.k, w.s, w.e), tg = Math.ceil(h.goal * eff / 7), ok = n >= tg;
    if (ok) met++;
    return { ...h, n, tg, ok };
  });
  const [a, b] = alcoholWindow(g, w.e);
  const lim = [
    { k: 'alcohol', icon: '🍺', label: g.alcohol_cada == 14 ? 'Alcohol (últimos 15 días)' : 'Alcohol (semana)', n: countIn(ch, 'alcohol', a, b), max: +g.alcohol_max || 0 },
    { k: 'chaqueta', icon: '🚫', label: 'No chaquetas (semana)', n: countIn(ch, 'chaqueta', w.s, w.e), max: +g.chaqueta_max || 0 },
  ].map(l => ({ ...l, ok: l.n <= l.max }));
  if (closed) lim.forEach(l => { if (l.ok) met++; });
  const total = det.length + lim.length;
  const perfect = closed && met === total;
  return { met, total, closed, perfect, pts: met + (perfect ? 2 : 0), det, lim, cm };
}

function isLogged(h) { return !!h; }
function streakAt(ch, t) {
  let n = 0, d = ch[t] ? t : addDays(t, -1);
  d = minS(d, END);
  while (d >= START && isLogged(ch[d])) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak(ch, t) {
  let best = 0, cur = 0;
  for (let d = START; d <= minS(t, END); d = addDays(d, 1)) { cur = isLogged(ch[d]) ? cur + 1 : 0; best = Math.max(best, cur); }
  return best;
}

let scoreMemo = {};                        // se vacía en cada render
function score(name) {
  if (scoreMemo[name]) return scoreMemo[name];
  const t = today();
  const p = people[name] || {}, g = p.goals, ch = checks[name] || {};
  const out = { total: 0, perfect: 0, streak: streakAt(ch, t), best: bestStreak(ch, t), weeks: [], learn: 0, race: 0,
    hoy: !!ch[t], week: null, comodines: Object.values(ch).filter(h => h.comodin).length };
  if (g && goalsComplete(g)) {
    for (const w of WEEKS) {
      if (w.s > t) { out.weeks.push(null); continue; }
      const ev = weekEval(g, ch, w, t);
      out.weeks.push(ev);
      out.total += ev.pts;
      if (ev.perfect) out.perfect++;
      if (w.s <= t && t <= w.e) out.week = ev;
    }
    for (const [m] of MONTHS) if (Object.keys(ch).some(d => d.startsWith(m) && d >= START && d <= END && ch[d].aprender)) out.learn++;
    out.total += out.learn;
  }
  const r = p.race || {};
  if (r.inscrito && r.inscrito_en && r.inscrito_en <= RACE_BONUS) out.race += 5;
  if (t > RACE_PENALTY && !(r.inscrito && r.inscrito_en && r.inscrito_en <= RACE_PENALTY)) out.race -= 10;
  if (r.inscrito && r.completada) out.race += 5;
  out.total += out.race;
  scoreMemo[name] = out;
  return out;
}
function ranking() {
  const list = NAMES.map(n => ({ n, s: score(n) })).sort((a, b) => b.s.total - a.s.total || b.s.streak - a.s.streak);
  let prev = null, pos = 0;
  list.forEach((x, i) => { if (x.s.total !== prev) { pos = i; prev = x.s.total; } x.pos = pos; });
  return list;
}
const curWeek = () => { const t = today(); return WEEKS.find(w => w.s <= t && t <= w.e) || (t < START ? WEEKS[0] : WEEKS[WEEKS.length - 1]); };

// ======================= piezas de UI =======================
function av(name, size = 36) {
  const p = people[name] || {};
  const st = `width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px;background:${COLORS[name] || '#7dd3fc'}`;
  return p.avatar ? `<span class="av" style="${st}"><img src="${esc(imgUrl(p.avatar))}" alt="" loading="lazy"></span>`
    : `<span class="av" style="${st}">${esc((name || '?')[0])}</span>`;
}
function bar(n, tg, over) {
  const pct = tg ? Math.min(100, n / tg * 100) : (over ? 100 : (n ? 100 : 0));
  return `<div class="bar ${over ? 'over' : n >= tg ? 'done' : ''}"><i style="width:${pct}%"></i></div>`;
}
function weekBars(name) {
  const g = people[name]?.goals;
  if (!goalsComplete(g)) return '<p class="muted small">Aún no completa sus metas.</p>';
  const w = curWeek(), ev = weekEval(g, checks[name] || {}, w, today());
  let html = `<div class="small muted">Semana ${fmtS(w.s)} – ${fmtS(w.e)}${ev.cm ? ` · 🛟 ${plural(ev.cm, 'comodín', 'comodines')}` : ''}</div>`;
  for (const x of ev.det) html += `<div class="b"><div class="t"><span>${x.icon} ${esc(x.label)}</span><span>${x.n}/${x.tg}${x.ok ? ' ✓' : ''}</span></div>${bar(x.n, x.tg)}</div>`;
  for (const l of ev.lim) html += `<div class="b"><div class="t"><span>${l.icon} ${l.label}</span><span>${l.n}/${l.max} máx${l.ok ? '' : ' ✗'}</span></div>${bar(l.n, l.max, !l.ok)}</div>`;
  return html;
}

// ---------- ¿quién ya está listo? ----------
function readyItems(n) {
  const p = people[n] || {}, st = status[n] || {};
  return [
    ['🔑', 'Entró', !!st.pin],
    ['🎯', 'Metas y hábitos propios', goalsComplete(p.goals)],
    ['🏁', 'Carrera', !!p.race?.inscrito],
    ['📷', 'Foto', !!p.avatar],
    ['📲', 'App', !!p.app_at],
    ['🔔', 'Aviso', !!st.aviso],
  ];
}
function readyBoard() {
  const rows = NAMES.map(n => ({ n, it: readyItems(n) }));
  const listos = rows.filter(r => r.it.every(x => x[2])).length;
  return `<h2>¿Quién ya está listo? <small>${listos}/${NAMES.length} al 100%</small></h2>
  <div class="card">${rows.map(({ n, it }) => {
    const ok = it.filter(x => x[2]).length;
    return `<div class="row" style="align-items:center;margin:8px 0">${av(n, 34)}
      <div style="flex:1;min-width:0"><b>${n}</b> <span class="tiny ${ok === it.length ? '' : 'muted'}" style="${ok === it.length ? 'color:var(--ok)' : ''}">${ok === it.length ? '✅ listo' : `${ok}/${it.length}`}</span>
        <div style="font-size:17px;letter-spacing:2px;margin-top:2px">${it.map(([e, t, v]) => `<span title="${t}: ${v ? 'sí' : 'falta'}" style="${v ? '' : 'filter:grayscale(1);opacity:.25'}">${e}</span>`).join('')}</div></div></div>`;
  }).join('')}
  <p class="tiny dim" style="margin:8px 0 0">🔑 entró · 🎯 metas + 2 hábitos propios · 🏁 inscrito a su carrera · 📷 foto de perfil · 📲 app instalada · 🔔 aviso de las 10 pm. Lo apagado es lo que le falta.</p></div>`;
}
const someoneMissing = () => NAMES.some(n => readyItems(n).slice(0, 2).some(x => !x[2]));

// ======================= vistas =======================
function vLogin() {
  const sel = vLogin.sel;
  return `<h2>¿Quién eres?</h2>
  <div class="names">${NAMES.map(n => `<button data-act="pick" data-n="${n}" class="${n === sel ? 'sel' : ''}">${av(n, 44)}${n}</button>`).join('')}</div>
  <div class="${sel ? '' : 'hide'}">
    <label class="f">PIN de ${esc(sel || '')}</label>
    <input id="pin" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••">
    <p class="small muted">La primera vez que entras, el PIN que pongas se vuelve el tuyo. No lo compartas.</p>
    <button class="btn" data-act="login">Entrar</button>
  </div>`;
}

function vHoy() {
  const g = people[me.name]?.goals, t = today();
  if (!goalsComplete(g)) {
    const partial = !!g && t > GOALS_LOCK;
    return `<h2>${g ? 'Te faltan tus 2 hábitos propios' : 'Primero, tus metas'}</h2>
      <p class="small muted">${g ? 'Nuevo: cada quien elige 2 hábitos suyos que también dan puntos. Lo demás que ya pusiste se queda igual.' : 'Se pueden cambiar hasta el 1 de octubre. Después quedan fijas.'}</p>
      <div class="card">${goalsForm(g, partial)}</div>`;
  }
  if (t < START) return preStart();
  if (t > END) return `<div class="card glow center"><div style="font-size:48px">🏆</div><h3>¡Se acabó el Winter Arc!</h3><p class="muted">Revisa la tabla final.</p><button class="btn" data-act="go" data-v="tabla">Ver la tabla</button></div>`;

  const opts = [0, 1, 2].map(i => addDays(t, -i)).filter(d => d >= START && d <= END);
  if (!opts.includes(selDay)) selDay = opts[0];
  const ch = checks[me.name] || {}, h = ch[selDay] || {};
  const usados = Object.entries(ch).filter(([d, x]) => x.comodin && d !== selDay).length;
  let html = `<div class="days">${opts.map((d, i) => `<button data-act="day" data-d="${d}" class="${d === selDay ? 'on' : ''}">${['Hoy', 'Ayer', 'Antier'][i]}${ch[d] ? ' ✓' : ''}<small>${fmt(d)}</small></button>`).join('')}</div>`;

  if (h.comodin) {
    html += `<div class="comodin"><div style="font-size:40px">🛟</div><b>Día de comodín</b>
      <p class="small muted">Este día no cuenta para tus metas de la semana y tu racha sigue viva.</p>
      <button class="btn ghost sm" data-act="comodin-off">Quitar comodín</button></div>`;
  } else {
    const rows = posHabits(g);
    const mes = selDay.slice(0, 7);
    const aprendioOtroDia = Object.entries(ch).some(([d, x]) => d.startsWith(mes) && d !== selDay && x.aprender);
    for (const r of rows) {
      html += habBtn(r.k, r.icon, r.label, h[r.k], { custom: r.custom });
      if (r.k === 'ejercicio' && h.ejercicio) html += ejDetail(h);
    }
    html += habBtn('aprender', '🧠', 'Cumplí mi reto de aprender del mes',
      h.aprender, { sub: aprendioOtroDia && !h.aprender ? '✓ Ya lo cumpliste este mes' : `${esc(g.aprender || 'Aprender algo nuevo')} · basta 1 vez al mes` });
    html += habBtn('chaqueta', '🙈', 'Chaqueta', h.chaqueta, { bad: true, sub: `Tu límite: ${+g.chaqueta_max || 0} por semana` });
    html += habBtn('alcohol', '🍺', 'Tomé alcohol', h.alcohol, { bad: true, sub: `Tu límite: ${g.alcohol_max} ${g.alcohol_cada == 14 ? 'cada 15 días' : 'por semana'}` });
    html += `<div class="row" style="margin-top:6px">
      ${ch[selDay] ? '' : '<button class="btn ghost sm" data-act="empty-day">No hice nada (registrar)</button>'}
      ${usados < MAX_COMODINES ? `<button class="btn ghost sm" data-act="comodin-on">🛟 Comodín (quedan ${MAX_COMODINES - usados})</button>` : ''}
    </div>`;
  }
  html += `<h2>Mi semana <small>${score(me.name).week ? `${score(me.name).week.met}/${score(me.name).week.total} hábitos` : ''}</small></h2><div class="card bars">${weekBars(me.name)}</div>`;
  return html;
}
function habBtn(k, icon, label, on, o = {}) {
  return `<button class="hab ${o.bad ? 'bad' : ''} ${o.custom ? 'custom' : ''} ${on ? 'on' : ''}" data-act="tog" data-k="${k}">
    <span class="ic">${icon}</span><span class="tx">${esc(label)}${o.sub ? `<small>${o.sub}</small>` : ''}</span><span class="ck">${on ? (o.bad ? '!' : '✓') : ''}</span></button>`;
}
function ejDetail(h) {
  return `<div class="ejdet keep">
    <div class="chips">${EJ_TIPOS.map(x => `<button class="chip ${h.ej_tipo === x ? 'sel' : ''}" data-act="ejtipo" data-t="${esc(x)}">${x}</button>`).join('')}</div>
    <div class="grid2" style="margin-top:8px">
      <div><label class="f" style="margin-top:0">⏱️ Minutos</label><input id="ej_min" type="number" inputmode="numeric" min="0" max="600" placeholder="60" value="${h.ej_min ?? ''}"></div>
      <div><label class="f" style="margin-top:0">📍 Km (si aplica)</label><input id="ej_km" type="number" inputmode="decimal" min="0" max="200" step="0.1" placeholder="0" value="${h.ej_km ?? ''}"></div>
    </div></div>`;
}

function preStart() {
  const t = today(), n = diff(t, START), p = people[me.name] || {}, r = p.race || {};
  const items = [
    [true, 'Metas y hábitos propios', 'yo'],
    [!!r.inscrito, 'Inscribirte a tu carrera', 'carrera'],
    [!!p.avatar, 'Poner tu foto de perfil', 'yo'],
    [isStandalone(), 'Instalar la app en tu celular', 'yo'],
    [pushOn, 'Prender el recordatorio de las 10 pm', 'yo'],
  ];
  return `<div class="card glow center fadein">
    <div class="small muted" style="font-weight:800;letter-spacing:.1em">ARRANCA EL JUEVES 1 DE OCTUBRE</div>
    <div class="big" style="font-size:56px;margin:10px 0 2px">${n}</div>
    <div class="muted">${n === 1 ? 'día' : 'días'}</div>
  </div>
  <h2>Antes de arrancar</h2>
  <div class="card"><ul class="setup">${items.map(([ok, txt, v]) => `<li>${ok ? '✅' : '⬜'} ${ok ? `<span class="muted">${txt}</span>` : `<button class="linkbtn" data-act="go" data-v="${v}">${txt} →</button>`}</li>`).join('')}</ul></div>
  ${readyBoard()}
  <h2>Mis metas</h2><div class="card">${goalsView(p.goals)}<button class="btn ghost" style="margin-top:12px" data-act="goals-edit">Cambiar mis metas</button></div>`;
}

function goalsView(g0) {
  const g = { ...DEF_GOALS, ...(g0 || {}) };
  return `<div class="chips">
    ${FIXED.map(x => `<span class="chip">${x.icon} ${esc(x.k === 'frio' ? g.frio_nombre : x.label)}: ${g[x.k]}/sem</span>`).join('')}
    ${(g.custom || []).filter(c => c.n).map(c => `<span class="chip ice">${esc(c.i)} ${esc(c.n)}: ${c.t}/sem</span>`).join('')}
    <span class="chip">📖 ${g.leer_pags}+ págs</span>
    <span class="chip">🍺 máx ${g.alcohol_max} ${g.alcohol_cada == 14 ? 'cada 15 días' : 'por semana'}</span>
    <span class="chip">🚫 chaquetas máx ${+g.chaqueta_max || 0}/sem</span>
    <span class="chip">🧠 ${esc(g.aprender || '—')}</span></div>`;
}
function goalsForm(g0, partial) {
  const g = { ...DEF_GOALS, ...(g0 || {}) };
  const cu = [0, 1].map(i => ({ ...DEF_GOALS.custom[i], ...((g0 && g0.custom && g0.custom[i]) || {}) }));
  const sel = (id, min, max, v) => `<select id="${id}">${Array.from({ length: max - min + 1 }, (_, i) => min + i).map(n => `<option ${n == v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  const custom = `<p class="small muted" style="margin-top:14px"><b style="color:var(--ice)">Tus 2 hábitos propios</b>: lo que tú quieras mejorar (ej. inglés 20 min, nada de azúcar, 2 L de agua, cero redes antes de dormir). Suman puntos igual que los demás.</p>
    ${[0, 1].map(i => `<label class="f">Hábito propio ${i + 1}</label>
      <div class="row"><select id="c${i}_i" style="flex:0 0 72px">${CUSTOM_ICONS.map(x => `<option ${x === cu[i].i ? 'selected' : ''}>${x}</option>`).join('')}</select>
      <input id="c${i}_n" maxlength="40" value="${esc(cu[i].n)}" placeholder="${i ? 'Ej. Nada de azúcar' : 'Ej. Inglés 20 min'}"></div>
      <div class="row" style="margin-top:6px"><span class="small muted" style="flex:0 0 auto">Días por semana</span>${sel(`c${i}_t`, 3, 7, cu[i].t)}</div>`).join('')}`;
  if (partial) return custom + `<button class="btn" data-act="goals-save" data-partial="1" style="margin-top:16px">Guardar mis hábitos propios</button>`;
  return `<p class="small muted">Días por semana de cada hábito (la opción más baja es el mínimo del grupo).</p>
    ${FIXED.filter(x => x.k !== 'frio').map(x => `<label class="f">${x.icon} ${x.label}</label>${sel('g_' + x.k, x.min, 7, g[x.k])}`).join('')}
    <label class="f">📖 Páginas mínimas por día de lectura</label>${sel('g_leer_pags', 10, 50, g.leer_pags)}
    <label class="f">🧊 Tu reto personal (agua fría o lo que elijas en su lugar)</label>
    <input id="g_frio_nombre" maxlength="60" value="${esc(g.frio_nombre)}" placeholder="Ej. Baño con agua fría, 10 mil pasos…">
    <label class="f">🧊 Días por semana del reto personal</label>${sel('g_frio', 5, 7, g.frio)}
    <label class="f">🍺 Alcohol: máximo de veces</label>
    <div class="row">${sel('g_alcohol_max', 0, 3, g.alcohol_max)}
      <select id="g_alcohol_cada"><option value="7" ${g.alcohol_cada != 14 ? 'selected' : ''}>por semana</option><option value="14" ${g.alcohol_cada == 14 ? 'selected' : ''}>cada 15 días</option></select></div>
    <label class="f">🚫 No chaquetas: máximo por semana (0 = nada)</label>${sel('g_chaqueta_max', 0, 2, +g.chaqueta_max || 0)}
    <label class="f">🧠 ¿Qué vas a aprender? (1 cosa al mes)</label>
    <input id="g_aprender" maxlength="80" value="${esc(g.aprender)}" placeholder="Ej. un curso, un idioma, una receta…">
    ${custom}
    <button class="btn" data-act="goals-save" style="margin-top:16px">Guardar metas</button>
    ${goalsComplete(g0) ? '<button class="btn ghost" data-act="goals-cancel" style="margin-top:8px">Cancelar</button>' : ''}`;
}

function vTabla() {
  const t = today(), list = ranking();
  let html = (t < START || someoneMissing()) ? readyBoard() : '';
  html += summaryCard();
  const top = list.slice(0, 3);
  if (t >= START && top.some(x => x.s.total > 0)) {
    const order = [top[1], top[0], top[2]].filter(Boolean);
    const cls = x => 'p' + (x.pos + 1);
    html += `<div class="podium">${order.map(x => `<div class="p ${cls(x)}">${av(x.n, x.pos === 0 ? 58 : 46)}<div class="nm">${x.pos === 0 ? '👑 ' : ''}${x.n}</div>
      <div class="blk"><div class="pt">${x.s.total}</div><div class="tiny muted">${['🥇', '🥈', '🥉'][x.pos] || ''}</div></div></div>`).join('')}</div>`;
  }
  html += `<h2>Tabla de posiciones <small>se actualiza sola</small></h2>`;
  html += list.map(({ n, s, pos }) => {
    const p = people[n] || {}, r = p.race || {};
    const chips = [
      t >= START && t <= END ? (s.hoy ? '<span class="chip ok">✅ registró hoy</span>' : '<span class="chip warn">⏳ falta hoy</span>') : '',
      `<span class="chip">🔥 ${plural(s.streak, 'día', 'días')}</span>`,
      s.perfect ? `<span class="chip ok">⭐ ${s.perfect}</span>` : '',
      s.comodines ? `<span class="chip">🛟 ${s.comodines}/${MAX_COMODINES}</span>` : '',
      r.inscrito ? `<span class="chip ok">🏁 inscrito${r.completada ? ' · 🏅' : ''}</span>` : '<span class="chip bad">🏁 sin inscribirse</span>',
      !goalsComplete(p.goals) ? '<span class="chip bad">metas incompletas</span>' : '',
    ].join('');
    const open = openRank === n;
    return `<div class="card ${pos === 0 && s.total > 0 ? 'glow' : ''}"><div class="rk" data-act="rank" data-n="${n}">
      <div class="pos">${pos + 1}</div>${av(n, 40)}
      <div class="nm">${n}<small>${s.week ? `esta semana ${s.week.met}/${s.week.total} hábitos` : 'aún no arranca'}</small></div>
      <div class="pts">${s.total}<small>pts</small></div></div>
      <div class="chips" style="margin-top:10px">${chips}</div>${open ? rankDetail(n, s) : ''}</div>`;
  }).join('');
  html += groupTotals();
  return html;
}
function rankDetail(n, s) {
  const w = curWeek(), wi = WEEKS.indexOf(w);
  const b = bodyPub.filter(x => x.name === n && x.peso != null);
  const ch = checks[n] || {};
  const km = sumIn(ch, 'ej_km', START, END), min = sumIn(ch, 'ej_min', START, END);
  return `<div class="det fadein">
    <div class="small muted">Puntos por semana</div>
    <div class="wk">${WEEKS.map((x, j) => `<div class="${j === wi ? 'cur' : ''} ${s.weeks[j]?.perfect ? 'perf' : ''}"><b>${s.weeks[j] ? s.weeks[j].pts : '·'}</b>${+x.s.slice(8)}/${+x.s.slice(5, 7)}</div>`).join('')}</div>
    <div class="chips" style="margin-top:10px">
      <span class="chip">🧠 aprender ${s.learn}/3</span>
      <span class="chip">🏁 carrera ${s.race >= 0 ? '+' : ''}${s.race}</span>
      <span class="chip">🔥 mejor racha ${s.best}</span>
      ${km ? `<span class="chip">🏃 ${km.toFixed(1)} km</span>` : ''}${min ? `<span class="chip">⏱️ ${Math.round(min / 60)} h</span>` : ''}
      ${b.length > 1 ? `<span class="chip ice">⚖️ ${(b[b.length - 1].peso - b[0].peso > 0 ? '+' : '')}${(b[b.length - 1].peso - b[0].peso).toFixed(1)} kg</span>` : ''}
    </div>
    <div class="bars" style="margin-top:8px">${weekBars(n)}</div>
    <div class="small muted" style="margin-top:8px">Metas:</div>${goalsView(people[n]?.goals)}</div>`;
}
function lastClosedWeek() { const t = today(); const ws = WEEKS.filter(w => t > w.e); return ws.length ? ws[ws.length - 1] : null; }
function weekSummary(w) {
  const t = today(), i = WEEKS.indexOf(w);
  const rows = NAMES.map(n => {
    const g = people[n]?.goals, ch = checks[n] || {};
    const ev = goalsComplete(g) ? weekEval(g, ch, w, t) : { pts: 0, met: 0, total: 10, perfect: false };
    return { n, pts: ev.pts, met: ev.met, total: ev.total, perfect: ev.perfect,
      km: sumIn(ch, 'ej_km', w.s, w.e), min: sumIn(ch, 'ej_min', w.s, w.e), gym: countIn(ch, 'ejercicio', w.s, w.e),
      fotos: photos.filter(p => p.name === n && p.day >= w.s && p.day <= w.e).length };
  }).sort((a, b) => b.pts - a.pts);
  const max = rows[0].pts, min = rows[rows.length - 1].pts;
  const tot = k => rows.reduce((a, r) => a + r[k], 0);
  return { i, w, rows, top: rows.filter(r => r.pts === max).map(r => r.n), bottom: max === min ? [] : rows.filter(r => r.pts === min).map(r => r.n),
    perf: rows.filter(r => r.perfect).map(r => r.n), km: tot('km'), min: tot('min'), gym: tot('gym'),
    fotero: rows.reduce((a, r) => r.fotos > (a?.fotos || 0) ? r : a, null) };
}
function summaryCard() {
  const w = lastClosedWeek(), t = today();
  if (!w) return t < START ? '' : `<div class="card summary small muted center">📊 El primer resumen semanal sale el lunes ${fmtS(addDays(WEEKS[0].e, 1))}.</div>`;
  const s = weekSummary(w);
  const line = (e, txt) => `<div class="line"><span class="e">${e}</span><span>${txt}</span></div>`;
  return `<div class="card summary fadein">
    <h2 style="margin:0 0 6px">Resumen semana ${s.i + 1} <small>${fmtS(w.s)} – ${fmtS(w.e)}</small></h2>
    ${line('🏆', `<b>${s.top.join(' y ')}</b> ganó la semana con ${s.rows[0].pts} pts`)}
    ${s.bottom.length ? line('💀', `<b>${s.bottom.join(' y ')}</b> la cagó: ${s.rows[s.rows.length - 1].pts} pts`) : ''}
    ${s.perf.length ? line('⭐', `Semana perfecta: <b>${s.perf.join(', ')}</b>`) : ''}
    ${line('🏋️', `El grupo fue ${plural(s.gym, 'vez', 'veces')} al gym${s.km ? ` · ${s.km.toFixed(1)} km` : ''}${s.min ? ` · ${Math.round(s.min / 60)} h` : ''}`)}
    ${s.fotero && s.fotero.fotos ? line('📸', `Más fotos: <b>${s.fotero.n}</b> (${s.fotero.fotos})`) : ''}
    <div class="chips" style="margin:10px 0">${s.rows.map(r => `<span class="chip">${r.n} ${r.pts}</span>`).join('')}</div>
    <button class="btn ghost sm" data-act="share-summary">📤 Compartir imagen al grupo</button></div>`;
}
function groupTotals() {
  const t = today(); if (t < START) return '';
  let km = 0, min = 0, gym = 0, dias = 0;
  for (const n of NAMES) { const ch = checks[n] || {}; km += sumIn(ch, 'ej_km', START, END); min += sumIn(ch, 'ej_min', START, END); gym += countIn(ch, 'ejercicio', START, END); dias += Object.keys(ch).filter(d => d >= START).length; }
  return `<h2>El grupo en total</h2><div class="stats3">
    <div class="stat"><b>${gym}</b><span>idas al gym</span></div>
    <div class="stat"><b>${km.toFixed(0)}</b><span>km</span></div>
    <div class="stat"><b>${Math.round(min / 60)}</b><span>horas de ejercicio</span></div></div>
    <p class="tiny dim center">${dias} días registrados · ${photos.length} fotos</p>`;
}

function reactIndex() {
  const idx = {};
  for (const r of reactions) {
    const x = idx[r.target] ||= { emo: {}, cmts: [] };
    if (r.emoji) (x.emo[r.emoji] ||= []).push(r.from_name);
    else if (r.texto) x.cmts.push(r);
  }
  return idx;
}
function reactBar(target, idx) {
  const x = idx[target] || { emo: {}, cmts: [] };
  return `<div class="reacts">${EMOJIS.map(e => { const who = x.emo[e] || []; return `<button class="${who.includes(me.name) ? 'mine' : ''}" data-act="react" data-target="${target}" data-e="${e}" title="${esc(who.join(', '))}">${e}${who.length ? ' ' + who.length : ''}</button>`; }).join('')}</div>
    <div class="cmts">${x.cmts.map(c => `<div class="c"><b>${esc(c.from_name)}</b>${esc(c.texto)}${c.from_name === me.name ? `<button data-act="cmt-del" data-id="${c.id}">borrar</button>` : ''}</div>`).join('')}</div>
    <div class="cform keep"><input maxlength="140" placeholder="Comenta o búrlate…"><button data-act="cmt" data-target="${target}">➤</button></div>`;
}
function vMuro() {
  const t = today(), idx = reactIndex();
  const items = photos.filter(p => people[p.name]).map(p => ({ ts: p.created_at, type: 'photo', p }));
  for (const n of NAMES) {
    const ch = checks[n] || {};
    for (const d of Object.keys(ch)) if (d >= START && d >= addDays(t, -3)) items.push({ ts: ctimes[n]?.[d], type: 'day', n, d, h: ch[d] });
  }
  items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  let html = `<button class="btn" data-act="photo-new">📸 Subir foto</button>
    <p class="tiny dim center" style="margin:6px 0 14px">Evidencia del gym, la comida, la carrera… Se ve aquí y todos pueden reaccionar.</p>`;
  if (!items.length) html += `<div class="card center muted">Nadie ha subido nada todavía. Estrena el muro 📸</div>`;
  let nImg = 0;
  html += items.slice(0, 50).map(it => {
    if (it.type === 'photo') {
      const p = it.p, target = 'photo:' + p.id;
      return `<div class="card post"><div class="hd">${av(p.name, 36)}<div class="nm">${esc(p.name)}<small>${ago(p.created_at)} · ${fmt(p.day)}</small></div>
        ${p.name === me.name ? `<button class="linkbtn" data-act="photo-del" data-id="${p.id}" style="color:var(--dim)">borrar</button>` : ''}</div>
        <img class="ph" src="${esc(imgUrl(p.path))}" loading="${nImg++ < 8 ? 'eager' : 'lazy'}" decoding="async" alt="" onerror="this.style.display='none'">
        <div class="bd">${p.caption ? `<div>${esc(p.caption)}</div>` : ''}${reactBar(target, idx)}</div></div>`;
    }
    const g = people[it.n]?.goals, target = `day:${it.n}:${it.d}`;
    let body;
    if (it.h.comodin) body = '🛟 Usó comodín este día';
    else if (goalsComplete(g)) {
      const ph = posHabits(g), done = ph.filter(x => it.h[x.k]);
      body = `<b>${done.length}/${ph.length}</b> hábitos ${done.length === ph.length ? '💯' : ''} <span style="font-size:17px">${done.map(x => x.icon).join(' ')}</span>
        ${it.h.ejercicio && (it.h.ej_tipo || it.h.ej_min || it.h.ej_km) ? `<div class="small muted" style="margin-top:4px">${esc(it.h.ej_tipo || '')} ${it.h.ej_min ? it.h.ej_min + ' min' : ''} ${it.h.ej_km ? it.h.ej_km + ' km' : ''}</div>` : ''}
        ${it.h.alcohol ? ' 🍺' : ''}${it.h.chaqueta ? ' 🙈' : ''}`;
    } else body = 'Registró su día';
    return `<div class="card post"><div class="hd">${av(it.n, 36)}<div class="nm">${it.n} <span class="muted" style="font-weight:500">llenó su ${fmt(it.d)}</span><small>${it.ts ? ago(it.ts) : ''}</small></div></div>
      <div class="bd" style="padding-top:0">${body}${reactBar(target, idx)}</div></div>`;
  }).join('');
  return html;
}

function vCarrera() {
  const t = today(), r = people[me.name]?.race || {};
  return `<h2>La competencia obligatoria</h2>
  <p class="small muted" style="margin-top:-4px">Todos inscritos a algo (Spartan, carrera, tri…) antes del 31 de octubre: +5. Sin inscripción al 30 de noviembre: −10. Terminarla: +5.</p>
  ${NAMES.map(n => {
    const x = people[n]?.race || {}, d = x.fecha ? diff(t, x.fecha) : null;
    return `<div class="card race"><div class="row" style="align-items:center">
      ${av(n, 40)}<div style="flex:1"><b>${n}</b><div class="small muted">${x.evento ? esc(x.evento) : 'Sin evento todavía'}${x.fecha ? ' · ' + fmt(x.fecha) : ''}</div>
        <div class="chips" style="margin-top:6px">${x.inscrito ? `<span class="chip ok">✅ inscrito${x.inscrito_en ? ' el ' + fmtS(x.inscrito_en) : ''}</span>` : '<span class="chip bad">No inscrito</span>'}
        ${x.completada ? '<span class="chip ok">🏅 terminada</span>' : ''}
        ${x.link ? `<a class="chip ice" href="${esc(x.link)}" target="_blank" rel="noopener">ver evento ↗</a>` : ''}</div></div>
      <div style="flex:none;text-align:right">${d !== null && !x.completada ? (d > 0 ? `<div class="cd">${d}</div><div class="tiny muted">días</div>` : d === 0 ? '<div class="cd">¡HOY!</div>' : '') : ''}</div>
    </div></div>`;
  }).join('')}
  <h2>Mi competencia</h2>
  <div class="card keep">
    <label class="f">Evento</label><input id="r_evento" maxlength="80" value="${esc(r.evento)}" placeholder="Ej. Spartan Sprint CDMX">
    <label class="f">Fecha del evento</label><input id="r_fecha" type="date" value="${esc(r.fecha)}">
    <label class="f">Link (opcional)</label><input id="r_link" maxlength="300" value="${esc(r.link)}" placeholder="https://…">
    <label class="check"><input type="checkbox" id="r_inscrito" ${r.inscrito ? 'checked' : ''}> Ya estoy inscrito</label>
    <label class="check"><input type="checkbox" id="r_completada" ${r.completada ? 'checked' : ''}> Ya la corrí 🏅</label>
    <button class="btn" data-act="race-save">Guardar</button></div>`;
}

function vYo() {
  const t = today(), p = people[me.name] || {}, s = score(me.name), list = ranking();
  const pos = list.find(x => x.n === me.name)?.pos ?? 0;
  const ch = checks[me.name] || {};
  const g = p.goals;
  let html = `<div class="card glow"><div class="row" style="align-items:center">
    <button data-act="avatar" style="background:none;padding:0;flex:none;position:relative">${av(me.name, 68)}<span class="pill" style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);padding:2px 6px;font-size:10px">📷</span></button>
    <div><div style="font-size:22px;font-weight:900">${esc(me.name)}</div><div class="muted small">${t >= START ? `Lugar ${pos + 1} de ${NAMES.length} · ${s.total} pts` : 'El reto arranca el 1 de octubre'}</div></div></div></div>`;

  // app y recordatorio
  const standalone = isStandalone();
  html += `<h2>App y recordatorio</h2><div class="card">
    <div class="switch"><span>📲 App en tu pantalla de inicio</span>${standalone ? '<span class="chip ok">instalada</span>' : '<button class="btn sm" data-act="install">Instalar</button>'}</div>
    <div class="switch"><span>🔔 Aviso a las 10 pm si no has llenado tu día</span><input type="checkbox" data-act="push" ${pushOn ? 'checked' : ''}></div>
    ${isIOS() && !standalone ? '<p class="tiny muted">En iPhone los avisos solo funcionan con la app instalada: Safari → Compartir ⬆️ → "Agregar a inicio", y ábrela desde ese ícono.</p>' : ''}
  </div>`;

  // estadísticas
  if (t >= START) {
    const days = Math.min(diff(START, t) + 1, TOTAL_DAYS);
    const reg = Object.keys(ch).filter(d => d >= START && d <= t).length;
    html += `<h2>Mis estadísticas</h2>
    <div class="stats3">
      <div class="stat"><b>${s.total}</b><span>puntos</span></div>
      <div class="stat"><b>🔥${s.streak}</b><span>racha actual</span></div>
      <div class="stat"><b>${s.best}</b><span>mejor racha</span></div>
      <div class="stat"><b>⭐${s.perfect}</b><span>semanas perfectas</span></div>
      <div class="stat"><b>${Math.round(reg / days * 100)}%</b><span>días registrados</span></div>
      <div class="stat"><b>🛟${MAX_COMODINES - s.comodines}</b><span>comodines libres</span></div>
    </div>
    <div class="card" style="margin-top:10px"><div class="small muted" style="margin-bottom:8px">Mi Winter Arc día por día</div>${heatmap(me.name)}</div>
    ${goalsComplete(g) ? `<div class="card bars">${habitStats(g, ch, s)}</div>` : ''}`;
  }

  // peso y medidas
  const last = myBody[myBody.length - 1] || {};
  const pub = myBody.length ? myBody[myBody.length - 1].publico : false;
  html += `<h2>Peso y medidas <small>${myBody.length ? plural(myBody.length, 'registro', 'registros') : ''}</small></h2>
  <div class="card keep">
    <div class="grid3">
      <div><label class="f" style="margin-top:0">Peso (kg)</label><input id="b_peso" type="number" inputmode="decimal" step="0.1" value="${last.day === t ? last.peso ?? '' : ''}" placeholder="${last.peso ?? '80.0'}"></div>
      <div><label class="f" style="margin-top:0">% grasa</label><input id="b_grasa" type="number" inputmode="decimal" step="0.1" value="${last.day === t ? last.grasa ?? '' : ''}" placeholder="${last.grasa ?? 'opcional'}"></div>
      <div><label class="f" style="margin-top:0">Cintura cm</label><input id="b_cintura" type="number" inputmode="decimal" step="0.5" value="${last.day === t ? last.cintura ?? '' : ''}" placeholder="${last.cintura ?? 'opcional'}"></div>
    </div>
    <div class="switch"><span>👀 Que los demás vean mi progreso</span><input type="checkbox" id="b_pub" ${pub ? 'checked' : ''}></div>
    <button class="btn" data-act="body-save">Guardar medición de hoy</button>
    <p class="tiny dim" style="margin-bottom:0">Recomendado: una vez por semana, en ayunas. Si es privado, solo tú lo ves.</p>
    ${bodyChart(myBody)}
  </div>`;

  // metas
  html += `<h2>Mis metas <small>${t > GOALS_LOCK && goalsComplete(g) ? '🔒 fijas' : 'editables hasta el 1 oct'}</small></h2><div class="card">`;
  if (editingGoals && (t <= GOALS_LOCK || !goalsComplete(g))) html += `<div class="keep">${goalsForm(g, !!g && t > GOALS_LOCK)}</div>`;
  else html += goalsView(g) + (t <= GOALS_LOCK ? '<button class="btn ghost" style="margin-top:12px" data-act="goals-edit">Cambiar mis metas</button>' : '');
  html += `</div>
  <button class="btn ghost" data-act="reglas" style="margin-top:14px">📜 Ver las reglas</button>
  <button class="btn danger" data-act="logout" style="margin-top:8px">Cambiar de persona</button>`;
  return html;
}
function heatmap(name) {
  const g = people[name]?.goals, ch = checks[name] || {}, t = today();
  const ph = goalsComplete(g) ? posHabits(g) : [];
  let first = START; while (dow(first) !== 1) first = addDays(first, -1);
  let last = END; while (dow(last) !== 0) last = addDays(last, 1);
  let cells = '';
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (d < START || d > END) { cells += '<i style="visibility:hidden"></i>'; continue; }
    const h = ch[d];
    let c = '';
    if (d > t) c = 'fut';
    else if (h?.comodin) c = 'cm';
    else if (h && ph.length) { const f = ph.filter(x => h[x.k]).length / ph.length; c = f >= 1 ? 'l4' : f >= .7 ? 'l3' : f >= .4 ? 'l2' : f > 0 ? 'l1' : ''; }
    cells += `<i class="${c} ${d === t ? 'tod' : ''}" title="${fmt(d)}"></i>`;
  }
  return `<div class="heat">${cells}</div><div class="tiny dim" style="margin-top:6px">Cada columna es una semana (lun→dom). Más azul = más hábitos cumplidos. Amarillo = comodín.</div>`;
}
function habitStats(g, ch, s) {
  const closed = s.weeks.filter(w => w && w.closed);
  const t = today(), end = minS(t, END);
  let html = '<div class="small muted">Qué tanto cumplo cada hábito (semanas en meta)</div>';
  for (const h of posHabits(g)) {
    const ok = closed.filter(w => w.det.find(x => x.k === h.k)?.ok).length;
    const dias = countIn(ch, h.k, START, end);
    html += `<div class="b"><div class="t"><span>${h.icon} ${esc(h.label)}</span><span>${closed.length ? `${ok}/${closed.length} sem` : '—'} · ${plural(dias, 'día', 'días')}</span></div>${bar(ok, closed.length || 1)}</div>`;
  }
  for (const k of ['alcohol', 'chaqueta']) {
    const ok = closed.filter(w => w.lim.find(x => x.k === k)?.ok).length;
    html += `<div class="b"><div class="t"><span>${k === 'alcohol' ? '🍺 Alcohol dentro del límite' : '🚫 Chaquetas dentro del límite'}</span><span>${closed.length ? `${ok}/${closed.length} sem` : '—'} · ${plural(countIn(ch, k, START, end), 'vez', 'veces')}</span></div>${bar(ok, closed.length || 1)}</div>`;
  }
  return html;
}
function bodyChart(rows) {
  const pts = rows.filter(r => r.peso != null);
  if (pts.length < 2) return pts.length ? `<p class="small muted">Primer registro: <b>${pts[0].peso} kg</b> (${fmtS(pts[0].day)}). La gráfica aparece desde la segunda medición.</p>` : '';
  const W = 600, Hh = 180, P = 28;
  const xs = pts.map(r => diff(pts[0].day, r.day)), ys = pts.map(r => +r.peso);
  const x0 = 0, x1 = Math.max(1, xs[xs.length - 1]), y0 = Math.min(...ys) - .5, y1 = Math.max(...ys) + .5;
  const X = x => P + (x - x0) / (x1 - x0) * (W - 2 * P), Y = y => Hh - P - (y - y0) / (y1 - y0) * (Hh - 2 * P);
  const line = pts.map((r, i) => `${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`).join(' ');
  const d = ys[ys.length - 1] - ys[0];
  return `<div class="chart" style="margin-top:14px"><div class="row small"><span class="muted">Peso</span><span style="text-align:right;font-weight:800;color:${d <= 0 ? 'var(--ok)' : 'var(--warn)'}">${d > 0 ? '+' : ''}${d.toFixed(1)} kg desde ${fmtS(pts[0].day)}</span></div>
    <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Gráfica de peso">
      <defs><linearGradient id="gp" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#38bdf8" stop-opacity=".35"/><stop offset="1" stop-color="#38bdf8" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${X(xs[0])},${Hh - P} ${line} ${X(xs[xs.length - 1])},${Hh - P}" fill="url(#gp)"/>
      <polyline points="${line}" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((r, i) => `<circle cx="${X(xs[i])}" cy="${Y(ys[i])}" r="4.5" fill="#070c17" stroke="#7dd3fc" stroke-width="2.5"/>`).join('')}
      <text x="${X(xs[0])}" y="${Y(ys[0]) - 10}" fill="#8b9bba" font-size="15" text-anchor="start">${ys[0]}</text>
      <text x="${X(xs[xs.length - 1])}" y="${Y(ys[ys.length - 1]) - 10}" fill="#eaf1fc" font-size="15" font-weight="700" text-anchor="end">${ys[ys.length - 1]}</text>
    </svg></div>`;
}

function vReglas() {
  return `<h2>Reglas</h2>
  <div class="card rules">
    <p><b>Mismos hábitos, meta propia.</b> Cada quien fija cuántas veces por semana hace cada hábito (con un mínimo). Gana quien más cumple <i>lo que prometió</i>, no quien hace más.</p>
    <ul>
      <li>🏋️ Ejercicio: mínimo 4 días/sem (con foto en el muro 📸)</li>
      <li>😴 Dormir 7–8 h: mínimo 5 noches</li>
      <li>🥗 Comer bien: mínimo 5 días</li>
      <li>📖 Leer: mínimo 5 días, mínimo 10 páginas</li>
      <li>🧘 Meditar: mínimo 3 días</li>
      <li>🧊 Reto personal: agua fría o el sustituto que cada quien elija, mínimo 5 días</li>
      <li>⭐ 2 hábitos propios: los que cada quien quiera, mínimo 3 días c/u</li>
      <li>🍺 Alcohol: cada quien pone su límite (ej. 1 por semana o 1 cada 15 días)</li>
      <li>🚫 No chaquetas: cada quien pone su máximo por semana (0 = nada)</li>
      <li>🧠 Aprender algo nuevo: 1 al mes</li>
    </ul></div>
  <div class="card rules"><p><b>Puntos</b></p>
    <ul>
      <li>+1 por cada hábito en el que llegas a tu meta de la semana (10 posibles)</li>
      <li>+2 extra por semana perfecta (10 de 10) ⭐</li>
      <li>🍺🚫 Pasarte de tu límite: pierdes ese punto de la semana</li>
      <li>🧠 +1 por cada mes que cumples tu reto de aprender</li>
      <li>🏁 +5 inscrito antes del 31 oct · −10 si al 30 nov no estás inscrito · +5 por terminarla</li>
    </ul>
    <p class="small muted">Las semanas van de lunes a domingo. La primera (1–4 oct) y la última (21–23 dic) son cortas y la meta se ajusta en proporción. El alcohol, las chaquetas y la semana perfecta se cuentan cuando termina la semana.</p></div>
  <div class="card rules"><p><b>🛟 Comodines</b></p>
    <p>Cada quien tiene ${MAX_COMODINES} en todo el reto, para un día de enfermedad o viaje. Ese día no cuenta para tus metas de la semana y tu racha sigue. Todos ven cuántos usaste.</p></div>
  <div class="card rules"><p><b>Cómo se llena</b></p>
    <ul>
      <li>Cada noche marcas lo que hiciste. Tarda 10 segundos.</li>
      <li>Si se te olvida, puedes llenar hasta 2 días atrás.</li>
      <li>🔥 La racha cuenta los días seguidos que registras.</li>
      <li>Metas fijas desde el 1 de octubre.</li>
      <li>Todo es de palabra: si marcas algo, es porque lo hiciste.</li>
    </ul></div>
  <button class="btn ghost" data-act="go" data-v="hoy">← Volver</button>`;
}

// ======================= render =======================
const VIEWS = { hoy: vHoy, tabla: vTabla, muro: vMuro, carrera: vCarrera, yo: vYo, reglas: vReglas };
function header() {
  const t = today();
  const day = Math.min(Math.max(diff(START, t) + 1, 0), TOTAL_DAYS);
  $('sub').textContent = t < START ? `Arranca en ${plural(diff(t, START), 'día', 'días')} · 1 oct – 23 dic`
    : t > END ? 'Terminó 🎉' : `Día ${day} de ${TOTAL_DAYS} · faltan ${plural(diff(t, END), 'día', 'días')}`;
  $('progbar').style.width = (day / TOTAL_DAYS * 100) + '%';
}
function render() {
  scoreMemo = {};
  header();
  if (!CFG.url || !CFG.key) { $('setup').classList.remove('hide'); return; }
  $('nav').classList.toggle('hide', !me);
  $('who').classList.toggle('hide', !me);
  if (!me) { $('view').innerHTML = vLogin(); return; }
  $('whoName').innerHTML = `${av(me.name, 26)} ${esc(me.name)}`;
  if (!VIEWS[view]) view = 'hoy';
  $('view').innerHTML = loaded ? VIEWS[view]() : '<div class="card center muted">Cargando…</div>';
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === view));
  const t = today(), faltaHoy = t >= START && t <= END && !(checks[me.name] || {})[t];
  const hb = document.querySelector('nav button[data-v="hoy"]');
  hb.querySelector('.dot')?.remove();
  if (faltaHoy) hb.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
}
function go(v) { view = v; store.set('view', v); formDirty = false; editingGoals = false; window.scrollTo(0, 0); render(); }

// ======================= acciones =======================
const saveTimers = {};
function setDay(day, h) {
  (checks[me.name] ||= {})[day] = h;
  clearTimeout(saveTimers[day]);
  pending++;
  saveTimers[day] = setTimeout(async () => {
    try {
      const res = await rpc('wa_save_day', mine({ p_day: day, p_habits: checks[me.name][day] || {} }));
      if (!okRes(res)) { toast(ERR[res] || res); if (res === 'bad') logout(); else { pending = 0; await refresh(true); } }
      else toast('Guardado ✓');
    } catch { toast('No se pudo guardar. Revisa tu internet.'); }
    pending = Math.max(0, pending - 1);
  }, 500);
}
function toggle(k) {
  const g = people[me.name].goals, h = { ...((checks[me.name] || {})[selDay] || {}) };
  h[k] = !h[k];
  if (!h[k]) { delete h[k]; if (k === 'ejercicio') { delete h.ej_tipo; delete h.ej_min; delete h.ej_km; } }
  buzz();
  setDay(selDay, h);
  render();
  const ph = posHabits(g);
  if (h[k] && ph.some(x => x.k === k) && ph.every(x => h[x.k])) { confetti(); toast('¡Día perfecto! 💯'); }
}
function ejField() {
  const h = { ...((checks[me.name] || {})[selDay] || {}) };
  const m = $('ej_min')?.value, km = $('ej_km')?.value;
  if (m) h.ej_min = Math.min(600, Math.max(0, Math.round(+m))); else delete h.ej_min;
  if (km) h.ej_km = Math.min(200, Math.max(0, Math.round(+km * 10) / 10)); else delete h.ej_km;
  formDirty = false;
  setDay(selDay, h);
}

async function markApp() {
  if (!me || !isStandalone() || people[me.name]?.app_at || markApp.done) return;
  markApp.done = true;
  try { await rpc('wa_mark_app', mine()); } catch {}
}
async function doLogin() {
  const pin = ($('pin')?.value || '').trim(), name = vLogin.sel;
  if (!/^\d{4}$/.test(pin)) return toast('El PIN son 4 números');
  try {
    const res = await rpc('wa_check_pin', { p_name: name, p_pin: pin });
    if (!okRes(res)) return toast(ERR[res] || res);
    me = { name, pin }; store.set('me', me); vLogin.sel = null; view = 'hoy';
    toast(res === 'created' ? '¡PIN creado! No lo olvides.' : `¡Qué onda, ${name}!`);
    await loadMyBody(); await checkPush(); await refresh(true); markApp();
  } catch { toast('Error de conexión'); }
}
function logout() { me = null; store.del('me'); editingGoals = false; myBody = []; render(); }

async function saveGoals(partial) {
  const v = id => $(id).value;
  const custom = [0, 1].map(i => ({ i: v(`c${i}_i`), n: v(`c${i}_n`).trim(), t: +v(`c${i}_t`) }));
  if (custom.some(c => !c.n)) return toast('Ponle nombre a tus 2 hábitos propios');
  let goals;
  if (partial) goals = { ...(people[me.name].goals || {}), custom };
  else {
    goals = {};
    for (const x of FIXED) goals[x.k] = +v('g_' + x.k);
    Object.assign(goals, { leer_pags: +v('g_leer_pags'), frio_nombre: v('g_frio_nombre').trim() || 'Baño con agua fría',
      alcohol_max: +v('g_alcohol_max'), alcohol_cada: +v('g_alcohol_cada'), chaqueta_max: +v('g_chaqueta_max'), aprender: v('g_aprender').trim(), custom });
  }
  try {
    const res = await rpc('wa_save_goals', mine({ p_goals: goals }));
    if (!okRes(res)) return toast(ERR[res] || res);
    toast('Metas guardadas ✓'); editingGoals = false; formDirty = false; await refresh(true);
  } catch { toast('No se pudo guardar'); }
}
async function saveRace() {
  let link = $('r_link').value.trim();
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  const race = { evento: $('r_evento').value.trim(), fecha: $('r_fecha').value, link, inscrito: $('r_inscrito').checked, completada: $('r_completada').checked };
  try {
    const res = await rpc('wa_save_race', mine({ p_race: race }));
    if (!okRes(res)) return toast(ERR[res] || res);
    toast(race.inscrito && !people[me.name]?.race?.inscrito ? '¡Inscrito! 🏁' : 'Guardado ✓');
    if (race.completada && !people[me.name]?.race?.completada) confetti();
    formDirty = false; await refresh(true);
  } catch { toast('No se pudo guardar'); }
}
async function saveBody() {
  const n = id => { const x = $(id).value; return x === '' ? null : +x; };
  const peso = n('b_peso'), grasa = n('b_grasa'), cintura = n('b_cintura');
  if (peso !== null && (peso < 30 || peso > 250)) return toast('Revisa el peso');
  try {
    const res = await rpc('wa_save_body', mine({ p_day: today(), p_peso: peso, p_grasa: grasa, p_cintura: cintura, p_publico: $('b_pub').checked }));
    if (!okRes(res)) return toast(ERR[res] || res);
    toast('Medición guardada ✓'); formDirty = false; await loadMyBody(); await refresh(true);
  } catch { toast('No se pudo guardar'); }
}
async function react(target, emoji, texto) {
  try {
    const res = await rpc('wa_react', mine({ p_target: target, p_emoji: emoji || null, p_texto: texto || null }));
    if (!okRes(res)) return toast(ERR[res] || res);
    if (emoji) buzz();
    formDirty = false; await refresh(true);
  } catch { toast('No se pudo enviar'); }
}

// ---------- fotos ----------
async function compress(file, maxSide, square) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { src = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = URL.createObjectURL(file); }); }
  const w0 = src.width, h0 = src.height;
  let sx = 0, sy = 0, sw = w0, sh = h0;
  if (square) { const m = Math.min(w0, h0); sx = (w0 - m) / 2; sy = (h0 - m) / 2; sw = sh = m; }
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, 'image/jpeg', .82));
}
async function uploadBlob(blob) {
  const t = await rpc('wa_upload_ticket', mine());
  if (!String(t).startsWith('t:')) throw new Error(ERR[t] || t);
  const path = `${t.slice(2)}/${Date.now().toString(36)}.jpg`;
  const r = await fetch(`${CFG.url}/storage/v1/object/fotos/${path}`, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'image/jpeg' }, body: blob });
  if (!r.ok) throw new Error('upload ' + r.status);
  return path;
}
function pickFile(mode) { upload = { mode }; $('fileIn').value = ''; $('fileIn').click(); }
$('fileIn').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f || !upload) return;
  try {
    if (upload.mode === 'avatar') {
      toast('Subiendo…');
      const path = await uploadBlob(await compress(f, 320, true));
      const res = await rpc('wa_set_avatar', mine({ p_path: path }));
      if (!okRes(res)) return toast(ERR[res] || res);
      toast('Foto de perfil lista ✓'); await refresh(true);
    } else {
      const blob = await compress(f, 1440, false);
      upload.blob = blob; upload.url = URL.createObjectURL(blob);
      photoModal();
    }
  } catch (err) { toast('No se pudo procesar la foto'); }
});
function photoModal() {
  const t = today();
  const opts = [0, 1, 2].map(i => addDays(t, -i)).filter(d => t < START ? d === t : d >= START);
  const m = document.createElement('div');
  m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet"><img class="prev" src="${upload.url}" alt="">
    <label class="f">Descripción (opcional)</label><input id="ph_cap" maxlength="200" placeholder="Pierna hoy 🦵, 10 km, meal prep…">
    <label class="f">¿De qué día?</label><select id="ph_day">${opts.map((d, i) => `<option value="${d}">${['Hoy', 'Ayer', 'Antier'][i]} · ${fmt(d)}</option>`).join('')}</select>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="modal-close">Cancelar</button><button class="btn" data-act="photo-publish">Publicar</button></div></div>`;
  document.body.appendChild(m);
}
function closeModal() { $('modal')?.remove(); if (upload?.url) URL.revokeObjectURL(upload.url); upload = null; }
async function publishPhoto(btn) {
  btn.disabled = true; btn.textContent = 'Subiendo…';
  try {
    const path = await uploadBlob(upload.blob);
    const res = await rpc('wa_add_photo', mine({ p_path: path, p_day: $('ph_day').value, p_caption: $('ph_cap').value.trim() }));
    if (!okRes(res)) { toast(ERR[res] || res); btn.disabled = false; btn.textContent = 'Publicar'; return; }
    closeModal(); toast('¡Publicada! 📸'); view = 'muro'; await refresh(true); window.scrollTo(0, 0);
  } catch { toast('No se pudo subir. Revisa tu internet.'); btn.disabled = false; btn.textContent = 'Publicar'; }
}

// ---------- imagen del resumen ----------
async function shareSummary() {
  const w = lastClosedWeek(); if (!w) return;
  const s = weekSummary(w);
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 1350); gr.addColorStop(0, '#0f2a44'); gr.addColorStop(1, '#070c17');
  x.fillStyle = gr; x.fillRect(0, 0, 1080, 1350);
  x.textAlign = 'center'; x.fillStyle = '#7dd3fc'; x.font = '900 72px Inter, system-ui, sans-serif';
  x.fillText('❄️ WINTER ARC', 540, 150);
  x.fillStyle = '#eaf1fc'; x.font = '800 48px Inter, system-ui, sans-serif';
  x.fillText(`Semana ${s.i + 1} · ${fmtS(w.s)} – ${fmtS(w.e)}`, 540, 230);
  x.textAlign = 'left';
  let y = 340;
  s.rows.forEach((r, i) => {
    x.fillStyle = i === 0 ? 'rgba(252,211,77,.12)' : 'rgba(255,255,255,.05)';
    x.beginPath(); x.roundRect ? x.roundRect(90, y - 70, 900, 110, 24) : x.rect(90, y - 70, 900, 110); x.fill();
    x.fillStyle = '#eaf1fc'; x.font = '800 52px Inter, system-ui, sans-serif';
    x.fillText(`${['🥇', '🥈', '🥉', '4', '5'][i]}  ${r.n}`, 130, y);
    x.textAlign = 'right'; x.fillStyle = '#7dd3fc'; x.fillText(`${r.pts} pts`, 950, y);
    x.textAlign = 'left'; y += 135;
  });
  x.font = '600 38px Inter, system-ui, sans-serif'; x.fillStyle = '#cfd9ec';
  const extra = [];
  if (s.perf.length) extra.push(`⭐ Semana perfecta: ${s.perf.join(', ')}`);
  extra.push(`🏋️ ${s.gym} idas al gym${s.km ? ` · ${s.km.toFixed(1)} km` : ''}`);
  if (s.bottom.length) extra.push(`💀 ${s.bottom.join(' y ')} paga la próxima`);
  extra.forEach(t => { x.fillText(t, 110, y + 10); y += 62; });
  x.textAlign = 'center'; x.fillStyle = '#5f7092'; x.font = '600 30px Inter, system-ui, sans-serif';
  x.fillText('axelhc1001.github.io/winter-arc', 540, 1300);
  const blob = await new Promise(ok => c.toBlob(ok, 'image/png'));
  const file = new File([blob], `winter-arc-semana-${s.i + 1}.png`, { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Winter Arc' }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  toast('Imagen descargada: mándala al grupo');
}

// ---------- app instalable y avisos ----------
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { toast('¡App instalada! 📲'); render(); });
async function install() {
  if (installEvt) { installEvt.prompt(); await installEvt.userChoice; installEvt = null; return render(); }
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet"><h2 style="margin-top:0">Instalar la app</h2>
    ${isIOS() ? `<ol class="rules" style="padding-left:20px"><li>Abre esta página en <b>Safari</b>.</li><li>Toca <b>Compartir</b> ⬆️ (abajo).</li><li>Elige <b>"Agregar a inicio"</b>.</li><li>Ábrela desde el ícono ❄️ de tu pantalla.</li></ol>`
      : `<ol class="rules" style="padding-left:20px"><li>Abre el menú del navegador (⋮).</li><li>Elige <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b>.</li></ol>`}
    <button class="btn" data-act="modal-close">Entendido</button></div>`;
  document.body.appendChild(m);
}
function b64u(s) { const p = '='.repeat((4 - s.length % 4) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function checkPush() {
  pushOn = false;
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    pushOn = !!(reg && await reg.pushManager.getSubscription());
  } catch {}
}
async function setPush(on) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast(isIOS() && !isStandalone() ? 'Primero instala la app (Compartir → Agregar a inicio)' : 'Tu navegador no soporta avisos');
      return render();
    }
    const reg = await navigator.serviceWorker.ready;
    if (on) {
      if (await Notification.requestPermission() !== 'granted') { toast('No diste permiso de notificaciones'); return render(); }
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) });
      const res = await rpc('wa_save_push', mine({ p_sub: sub.toJSON() }));
      if (!okRes(res)) { toast(ERR[res] || res); return render(); }
      toast('Listo: te aviso a las 10 pm si no has llenado 🔔');
    } else {
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await rpc('wa_del_push', { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      toast('Recordatorio apagado');
    }
  } catch (e) { toast('No se pudo cambiar el aviso'); }
  await checkPush(); await refresh(true);
}

// ======================= eventos =======================
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-v]'); if (!el) return;
  if (el.dataset.v && !el.dataset.act) return go(el.dataset.v);
  const a = el.dataset.act;
  switch (a) {
    case 'pick': vLogin.sel = el.dataset.n; render(); setTimeout(() => $('pin')?.focus(), 50); break;
    case 'login': doLogin(); break;
    case 'go': go(el.dataset.v); break;
    case 'reglas': go('reglas'); break;
    case 'day': selDay = el.dataset.d; render(); break;
    case 'tog': toggle(el.dataset.k); break;
    case 'ejtipo': { const h = { ...((checks[me.name] || {})[selDay] || {}) }; h.ej_tipo = h.ej_tipo === el.dataset.t ? undefined : el.dataset.t; if (!h.ej_tipo) delete h.ej_tipo; setDay(selDay, h); render(); break; }
    case 'empty-day': setDay(selDay, {}); render(); break;
    case 'comodin-on': if (confirm(`¿Usar un comodín en ${fmt(selDay)}? Se borran las marcas de ese día y solo tienes ${MAX_COMODINES} en todo el reto.`)) { setDay(selDay, { comodin: true }); render(); } break;
    case 'comodin-off': setDay(selDay, {}); render(); break;
    case 'goals-edit': editingGoals = true; if (view !== 'yo') { view = 'yo'; store.set('view', 'yo'); } render(); setTimeout(() => document.querySelector('.keep select')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); break;
    case 'goals-cancel': editingGoals = false; formDirty = false; render(); break;
    case 'goals-save': saveGoals(!!el.dataset.partial); break;
    case 'rank': openRank = openRank === el.dataset.n ? null : el.dataset.n; render(); break;
    case 'share-summary': shareSummary(); break;
    case 'photo-new': pickFile('photo'); break;
    case 'avatar': pickFile('avatar'); break;
    case 'photo-publish': publishPhoto(el); break;
    case 'modal-close': closeModal(); break;
    case 'photo-del': if (confirm('¿Borrar esta foto?')) rpc('wa_del_photo', mine({ p_id: +el.dataset.id })).then(() => refresh(true)); break;
    case 'react': react(el.dataset.target, el.dataset.e); break;
    case 'cmt': { const i = el.closest('.cform').querySelector('input'); if (i.value.trim()) react(el.dataset.target, null, i.value.trim()); break; }
    case 'cmt-del': rpc('wa_del_reaction', mine({ p_id: +el.dataset.id })).then(() => refresh(true)); break;
    case 'race-save': saveRace(); break;
    case 'body-save': saveBody(); break;
    case 'install': install(); break;
    case 'push': e.preventDefault(); setPush(!pushOn); break;
    case 'logout': logout(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'pin') doLogin();
  const cf = e.target.closest('.cform'); if (cf) cf.querySelector('button').click();
});
document.addEventListener('input', e => { if (e.target.closest('.keep')) formDirty = true; });
document.addEventListener('change', e => { if (e.target.id === 'ej_min' || e.target.id === 'ej_km') ejField(); });

async function refresh(force) {
  if (!CFG.url || !CFG.key) return render();
  try { await load(); } catch { toast('Sin conexión con la base de datos'); }
  if (!force) {
    const a = document.activeElement;
    if (formDirty || $('modal') || (a && /INPUT|SELECT|TEXTAREA/.test(a.tagName))) return;
  }
  render();
}
setInterval(() => { if (!document.hidden && !pending) refresh(); }, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

// ======================= efectos =======================
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const cols = ['#7dd3fc', '#38bdf8', '#fcd34d', '#34d399', '#f472b6', '#ffffff'];
  const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: Math.random() * -14 - 4,
    s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.floor(Math.random() * cols.length)] }));
  let f = 0;
  (function step() {
    x.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
    if (++f < 110) requestAnimationFrame(step); else x.clearRect(0, 0, c.width, c.height);
  })();
}
(function snow() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('snow'), x = c.getContext('2d');
  let fl = [];
  const size = () => { c.width = innerWidth; c.height = innerHeight; fl = Array.from({ length: Math.min(60, Math.round(innerWidth / 14)) }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.8 + .4, v: Math.random() * .5 + .2, d: Math.random() * 6 })); };
  size(); addEventListener('resize', size);
  (function step() {
    if (!document.hidden) {
      x.clearRect(0, 0, c.width, c.height); x.fillStyle = 'rgba(200,230,255,.8)';
      for (const f of fl) { f.y += f.v; f.d += .01; f.x += Math.sin(f.d) * .3; if (f.y > c.height) { f.y = -4; f.x = Math.random() * c.width; }
        x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.3); x.fill(); }
    }
    requestAnimationFrame(step);
  })();
})();

// ======================= arranque =======================
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
render();
(async () => { await Promise.all([refresh(true), loadMyBody(), checkPush()]); render(); markApp(); })();
})();
