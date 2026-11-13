/**
 * messages.js — "Céu de Origami"
 *
 * Um céu onde corações de papel dobrado flutuam. Cada um guarda um recado:
 *   • clique/Enter → o coração voa até o centro e DESDOBRA (papel em 3D);
 *   • Esc / clique fora / botão fechar → redobra e volta ao céu;
 *   • "Dobre o seu recado" → folha de papel de carta; "Dobrar e enviar" dobra
 *     a folha em coração, que sobe ao céu (com confete).
 *
 * Tudo é renderizado com textContent (nada de innerHTML com dados do usuário).
 *
 * ✏️ Onde customizar:
 *   - Textos/recados iniciais: CONFIG.messages em js/config.js
 *   - Paletas dos corações: PALETTES abaixo + .ori-p-* em css/messages.css
 *   - Quantidade de corações visíveis: MAX_HEARTS abaixo
 *   - Tempo das animações: TIMING abaixo
 *   - Armazenamento (local ou Supabase compartilhado): seção STORAGE abaixo
 */
import * as core from './core.js';

/* ==========================================================================
 * STORAGE — padrão "adapter" plugável
 *
 * Qualquer objeto com `async list()` e `async add({ author, text })` serve.
 * Por padrão os recados ficam só no navegador de quem escreveu (localStorage).
 * Para um céu COLABORATIVO (todo visitante vê os recados de todos), use o
 * SupabaseAdapter comentado mais abaixo.
 * ======================================================================== */

const STORAGE_KEY = 'origami-sky-messages-v1';
const RATE_KEY = 'origami-sky-last-sent-v1';
const STORED_CAP = 80; // máximo guardado localmente

const LocalStorageAdapter = {
  _memory: [], // fallback se o localStorage estiver bloqueado (modo privado, etc.)

  _read() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return this._memory.slice();
    }
  },

  async list() {
    return this._read();
  },

  async add({ author, text }) {
    const record = {
      id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      author,
      text,
      created_at: new Date().toISOString()
    };
    const arr = this._read();
    arr.push(record);
    while (arr.length > STORED_CAP) arr.shift();
    this._memory = arr;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch { /* bloqueado/cheio: fica só na memória desta visita */ }
    return record;
  }
};

/* --------------------------------------------------------------------------
 * SupabaseAdapter (EXEMPLO — descomente para um céu compartilhado)
 *
 * 1) Crie um projeto em https://supabase.com e rode no SQL Editor:
 *
 *      create table public.messages (
 *        id          bigint generated always as identity primary key,
 *        author      text not null check (char_length(author) <= 40),
 *        text        text not null check (char_length(text) between 1 and 220),
 *        created_at  timestamptz not null default now()
 *      );
 *      alter table public.messages enable row level security;
 *      create policy "anon pode ler"     on public.messages for select to anon using (true);
 *      create policy "anon pode escrever" on public.messages for insert to anon with check (true);
 *
 * 2) Copie a URL do projeto e a "anon public key" (Settings → API) abaixo.
 *    A anon key é pública por design; a segurança vem das policies acima.
 * 3) Descomente o bloco e troque a linha `const storage = LocalStorageAdapter;`
 *    por `const storage = SupabaseAdapter;`.
 *
 * Usa a REST API direto (fetch), sem SDK nem build.
 *
 * const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
 * const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';
 * const sbHeaders = {
 *   apikey: SUPABASE_ANON_KEY,
 *   Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
 *   'Content-Type': 'application/json'
 * };
 *
 * const SupabaseAdapter = {
 *   async list() {
 *     try {
 *       const res = await fetch(
 *         `${SUPABASE_URL}/rest/v1/messages?select=id,author,text,created_at&order=created_at.desc&limit=60`,
 *         { headers: sbHeaders }
 *       );
 *       if (!res.ok) throw new Error(res.statusText);
 *       return (await res.json()).reverse(); // mais antigos primeiro
 *     } catch (err) {
 *       console.warn('[messages] Supabase indisponível, usando local.', err);
 *       return LocalStorageAdapter.list();
 *     }
 *   },
 *   async add(msg) {
 *     try {
 *       const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
 *         method: 'POST',
 *         headers: { ...sbHeaders, Prefer: 'return=representation' },
 *         body: JSON.stringify({ author: msg.author, text: msg.text })
 *       });
 *       if (!res.ok) throw new Error(res.statusText);
 *       const [row] = await res.json();
 *       return row;
 *     } catch (err) {
 *       console.warn('[messages] falha ao enviar ao Supabase, salvando local.', err);
 *       return LocalStorageAdapter.add(msg);
 *     }
 *   }
 * };
 * ------------------------------------------------------------------------ */

// ✏️ Troque aqui para SupabaseAdapter quando configurar o céu compartilhado.
const storage = LocalStorageAdapter;

/* ==========================================================================
 * Ajustes
 * ======================================================================== */

const MAX_HEARTS = { desktop: 24, mobile: 12 }; // ✏️ corações visíveis no céu
const RATE_MS = 10_000;                          // 1 recado a cada 10s
const AUTHOR_MAX = 40;
const DEFAULT_AUTHOR = 'Alguém especial';        // ✏️ quando não assinam

// ✏️ Durações (ms). As mesmas viram variáveis CSS no modal.
const TIMING = { fly: 760, top: 720, flaps: 640, text: 420, ink: 750 };

// Paletas dos corações (classes .ori-p-* no CSS). Escolhidas de forma estável por índice.
const PALETTES = ['red', 'rose', 'blush', 'red', 'rose'];

/* Coração de origami em SVG: facetas planas + vincos.
 * Lado esquerdo mais claro, direito mais escuro (luz vindo da esquerda). */
const HEART_SVG = `
<svg class="ori-svg" viewBox="0 0 100 92" aria-hidden="true" focusable="false">
  <polygon class="f2" points="50,88 3,41 3,22 16,9 34,9 50,24"/>
  <polygon class="f3" points="50,88 97,41 97,22 84,9 66,9 50,24"/>
  <polygon class="f3" points="3,41 50,88 50,53"/>
  <polygon class="f4" points="97,41 50,88 50,53"/>
  <polygon class="f1" points="3,22 16,9 17,23"/>
  <polygon class="f1" points="34,9 50,24 33,24"/>
  <polygon class="f2" points="97,22 84,9 83,23"/>
  <polygon class="f2" points="66,9 50,24 67,24"/>
  <polygon class="f1 o" points="16,9 34,9 33,24 17,23"/>
  <polygon class="f2 o" points="84,9 66,9 67,24 83,23"/>
  <path class="crease" d="M50 24V88M17 23L33 24M67 24L83 23M3 41L50 53L97 41"/>
  <path class="edge" d="M3 41V22L16 9H34L50 24L66 9H84L97 22"/>
</svg>`;

/* ==========================================================================
 * Utilidades
 * ======================================================================== */

const isReduced = () => !!core.reducedMotion;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** PRNG determinístico (mulberry32) — layout estável entre recargas. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Limpa texto: remove caracteres de controle, apara, limita quebras e tamanho. */
function cleanText(s, max) {
  return String(s ?? '')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
    .trim();
}

function normalize(m, maxLength) {
  if (!m || typeof m !== 'object') return null;
  const text = cleanText(m.text, maxLength);
  if (!text) return null;
  const author = cleanText(m.author, AUTHOR_MAX).replace(/\s+/g, ' ') || DEFAULT_AUTHOR;
  return { id: String(m.id ?? ''), author, text };
}

function readLastSent() {
  try { return Number(window.localStorage.getItem(RATE_KEY)) || 0; } catch { return 0; }
}
function writeLastSent(t) {
  try { window.localStorage.setItem(RATE_KEY, String(t)); } catch { /* ok */ }
}

let burstFn = null;
async function celebrate(x, y) {
  try {
    if (!burstFn) burstFn = (await import('./confetti.js')).burst;
    burstFn?.(x, y, { count: core.isTouch ? 36 : 70, spread: 120 });
  } catch { /* confete é opcional */ }
}

/* ==========================================================================
 * Estado do módulo
 * ======================================================================== */

let cfg;
let section, sky, field, cta, countEl, liveEl;
let hearts = [];          // { el, msg, seed, palette, depth, ... }
let seedCount = 0;
let skyW = 0, skyH = 0;
let unsubscribeFrame = null;
let maxHearts = MAX_HEARTS.desktop;
let lastSent = 0;

// modal
let modal, stage, note, body, closeBtn, actions, titleEl;
let modalOpen = false;
let busy = false;
let mode = 'read';
let current = null;       // coração aberto
let opener = null;        // quem abriu (para devolver o foco)
let draft = { text: '', author: '' };

/* ==========================================================================
 * init
 * ======================================================================== */

export function init(CONFIG) {
  section = document.getElementById('messages');
  if (!section) return;

  const m = CONFIG?.messages || {};
  cfg = {
    title: m.title || 'Céu de Origami',
    intro: m.intro || '',
    seed: Array.isArray(m.seed) ? m.seed : [],
    maxLength: clamp(Number(m.maxLength) || 220, 20, 1000)
  };

  maxHearts = (core.isTouch || window.innerWidth < 700) ? MAX_HEARTS.mobile : MAX_HEARTS.desktop;
  lastSent = readLastSent();

  buildSection();
  buildModal();

  // Recados iniciais (sempre visíveis)
  const seeds = cfg.seed.map((s, i) => normalize({ ...s, id: `seed-${i}` }, cfg.maxLength)).filter(Boolean);
  seeds.slice(0, maxHearts).forEach((msg) => addHeart(msg, { seed: true }));
  seedCount = hearts.length;

  measure();
  layout(true);
  render(performance.now() / 1000);

  // Recados guardados (assíncrono — pode vir de um servidor)
  storage.list().then((list) => {
    const stored = (Array.isArray(list) ? list : [])
      .map((x) => normalize(x, cfg.maxLength))
      .filter(Boolean);
    const room = Math.max(0, maxHearts - hearts.length);
    stored.slice(-room || stored.length).slice(0, room).forEach((msg) => addHeart(msg));
    layout(true);
    render(performance.now() / 1000);
    updateCount();
  }).catch(() => {});

  // Redimensionamento do céu
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => { measure(); layout(false); if (isReduced()) layout(true); render(performance.now() / 1000); }).observe(sky);
  }

  // Só anima enquanto o céu está na tela
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible && !unsubscribeFrame && typeof core.onFrame === 'function') {
        unsubscribeFrame = core.onFrame((dt, t) => tick(dt, t));
      } else if (!visible && unsubscribeFrame) {
        unsubscribeFrame();
        unsubscribeFrame = null;
      }
    }, { rootMargin: '80px 0px' }).observe(sky);
  } else if (typeof core.onFrame === 'function') {
    unsubscribeFrame = core.onFrame((dt, t) => tick(dt, t));
  }

  core.observeReveal?.(section);
  core.remeasure?.();
}

/* ==========================================================================
 * Seção + céu
 * ======================================================================== */

function buildSection() {
  section.textContent = '';
  section.setAttribute('aria-labelledby', 'messages-title');

  const wrap = el('div', 'container messages__inner');

  const head = el('header', 'messages__head');
  head.setAttribute('data-reveal', '');
  const h2 = el('h2', 'section-title');
  h2.id = 'messages-title';
  // Última palavra do título em fonte cursiva (ex.: "Céu de <em>Origami</em>")
  const words = cfg.title.trim().split(/\s+/);
  const last = words.pop();
  if (words.length) h2.append(document.createTextNode(words.join(' ') + ' '));
  h2.append(el('em', null, last));
  head.append(h2);
  if (cfg.intro) head.append(el('p', 'section-lead', cfg.intro));

  sky = el('div', 'ori-sky');
  sky.setAttribute('data-reveal', '');
  sky.append(el('div', 'ori-sky__glow'));
  const stars = el('div', 'ori-sky__stars');
  stars.setAttribute('aria-hidden', 'true');
  sky.append(stars);

  field = el('div', 'ori-sky__field');
  field.setAttribute('role', 'group');
  field.setAttribute('aria-label', 'Corações com recados');
  field.addEventListener('click', (e) => {
    const btn = e.target.closest('.ori-heart');
    if (!btn) return;
    const h = hearts.find((x) => x.el === btn);
    if (h) openRead(h);
  });
  sky.append(field);

  const foot = el('div', 'ori-sky__cta');
  cta = el('button', 'btn ori-sky__btn', 'Dobre o seu recado');
  cta.type = 'button';
  cta.setAttribute('data-confetti', '');
  cta.setAttribute('aria-haspopup', 'dialog');
  cta.addEventListener('click', () => openWrite());
  countEl = el('p', 'ori-sky__count');
  foot.append(cta, countEl);
  sky.append(foot);

  liveEl = el('p', 'sr-only');
  liveEl.setAttribute('aria-live', 'polite');

  wrap.append(head, sky, liveEl);
  section.append(wrap);
  updateCount();
}

function updateCount() {
  if (!countEl) return;
  const n = hearts.length;
  countEl.textContent = n === 1 ? '1 recado flutuando' : `${n} recados flutuando`;
}

function addHeart(msg, { seed = false, fresh = false } = {}) {
  // Respeita o limite: remove o recado guardado mais antigo (sementes ficam).
  if (hearts.length >= maxHearts) {
    const idx = hearts.findIndex((h) => !h.seed);
    if (idx !== -1) {
      const [old] = hearts.splice(idx, 1);
      old.el.remove();
    }
  }

  const i = hearts.length;
  const r = rng(hashStr(msg.id || msg.text) ^ (i * 2654435761));
  const palette = fresh ? 'red' : PALETTES[(i + Math.floor(r() * 3)) % PALETTES.length];

  const btn = el('button', `ori-heart ori-p-${palette}`);
  btn.type = 'button';
  btn.setAttribute('aria-label', `Recado de ${msg.author}`);
  btn.setAttribute('aria-haspopup', 'dialog');
  const inner = el('span', 'ori-heart__inner');
  inner.innerHTML = HEART_SVG; // markup estático, sem dados do usuário
  btn.append(inner);
  field.append(btn);

  const h = {
    el: btn, msg, seed, palette,
    depth: 0.55 + r() * 0.45,          // 0.55..1 — tamanho/parallax
    jx: r() - 0.5, jy: r() - 0.5,       // jitter dentro da célula
    p: r() * Math.PI * 2,               // fase
    fx: 0.25 + r() * 0.25, fy: 0.35 + r() * 0.3, fr: 0.3 + r() * 0.3,
    x: 0, y: 0, tx: 0, ty: 0, s: 60, ax: 10, ay: 8, placed: false
  };
  hearts.push(h);
  updateCount();
  return h;
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function measure() {
  skyW = sky.clientWidth;
  skyH = sky.clientHeight;
}

/** Distribui os corações numa grade com jitter (evita sobreposição). */
function layout(snap) {
  const n = hearts.length;
  if (!n || !skyW) return;
  const mobile = skyW < 640;
  const padX = mobile ? 10 : 24;
  const padTop = mobile ? 18 : 30;
  const padBottom = mobile ? 120 : 130; // espaço do botão
  const w = Math.max(100, skyW - padX * 2);
  const h = Math.max(100, skyH - padTop - padBottom);

  const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
  const rows = Math.ceil(n / cols);
  const cw = w / cols;
  const ch = h / rows;

  // ordem de células embaralhada e estável
  const cells = Array.from({ length: cols * rows }, (_, k) => k);
  const r = rng(cols * 131 + rows);
  for (let k = cells.length - 1; k > 0; k--) {
    const j = Math.floor(r() * (k + 1));
    [cells[k], cells[j]] = [cells[j], cells[k]];
  }

  const minS = mobile ? 46 : 56;
  const maxS = mobile ? 74 : 96;

  hearts.forEach((hh, i) => {
    const c = cells[i];
    const col = c % cols;
    const row = Math.floor(c / cols);
    const s = Math.round(Math.min(minS + (maxS - minS) * hh.depth, cw * 0.78, ch * 0.78));
    if (s !== hh.s) { hh.s = s; hh.el.style.setProperty('--s', `${s}px`); }
    const free = (len) => Math.max(0, len - s) * 0.55;
    const cx = padX + (col + 0.5) * cw + hh.jx * free(cw);
    const cy = padTop + (row + 0.5) * ch + hh.jy * free(ch);
    hh.tx = cx - s / 2;
    hh.ty = cy - s * 0.46;
    hh.ax = Math.min(cw * 0.14, 20);
    hh.ay = Math.min(ch * 0.12, 14);
    hh.el.style.zIndex = String(Math.round(hh.depth * 10));
    if (snap || !hh.placed) { hh.x = hh.tx; hh.y = hh.ty; hh.placed = true; }
  });
}

function tick(dt, t) {
  if (isReduced()) return;
  const k = 1 - Math.exp(-dt * 2.2); // aproximação suave ao reorganizar
  for (const h of hearts) {
    h.x += (h.tx - h.x) * k;
    h.y += (h.ty - h.y) * k;
  }
  render(t);
}

function render(t) {
  const rm = isReduced();
  const energy = core.scrollState?.energy || 0;
  const px = core.pointer?.x || 0;
  const py = core.pointer?.y || 0;
  const amp = 1 + energy * 1.4;

  for (const h of hearts) {
    let x = h.x, y = h.y, rz = 0, ry = 0;
    if (!rm) {
      x += Math.sin(t * h.fx + h.p) * h.ax * amp + px * h.depth * 14;
      y += Math.sin(t * h.fy + h.p * 1.3) * h.ay * amp - py * h.depth * 10;
      rz = Math.sin(t * h.fr + h.p) * (6 + energy * 8);
      ry = Math.sin(t * h.fr * 0.7 + h.p * 2) * 22;
    }
    h.el.style.transform =
      `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rz.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
  }
}

/* ==========================================================================
 * Modal (papel que dobra/desdobra)
 *
 * A folha é dividida em 6 painéis:   [L][  C  ][R]  ← metade de cima
 *                                     [L][  C  ][R]  ← metade de baixo
 * Dobrada: as abas L/R dobram sobre C; depois a metade de cima dobra sobre a
 * de baixo. Desdobrar = o inverso. Cada painel tem frente (papel creme) e
 * verso (papel rosa), como papel de origami de verdade.
 * ======================================================================== */

function panel(cls) {
  const p = el('div', `ori-pn ${cls}`);
  p.append(el('i', 'ori-face ori-face--in'), el('i', 'ori-face ori-face--out'));
  return p;
}

function half(which) {
  const hf = el('div', `ori-half ori-half--${which}`);
  const c = panel('ori-pn--c');
  c.append(panel('ori-pn--l'), panel('ori-pn--r'));
  hf.append(c);
  return hf;
}

function buildModal() {
  modal = el('div', 'ori-modal');
  modal.hidden = true;
  modal.style.setProperty('--t-fly', `${TIMING.fly}ms`);
  modal.style.setProperty('--t-top', `${TIMING.top}ms`);
  modal.style.setProperty('--t-flaps', `${TIMING.flaps}ms`);
  modal.style.setProperty('--t-text', `${TIMING.text}ms`);

  const veil = el('div', 'ori-modal__veil');
  modal.append(veil);

  stage = el('div', 'ori-stage');
  stage.setAttribute('role', 'dialog');
  stage.setAttribute('aria-modal', 'true');
  stage.setAttribute('aria-labelledby', 'ori-dialog-title');
  stage.tabIndex = -1;
  stage.dataset.state = 'folded';

  titleEl = el('h3', 'sr-only');
  titleEl.id = 'ori-dialog-title';

  stage.append(el('div', 'ori-stage__shadow'));

  note = el('div', 'ori-note');
  note.append(half('bottom'), half('top'));
  body = el('div', 'ori-note__body');
  note.append(body);

  closeBtn = el('button', 'ori-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Fechar e dobrar o recado');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  closeBtn.addEventListener('click', () => requestClose());

  actions = el('div', 'ori-actions');

  stage.append(titleEl, note, closeBtn, actions);
  modal.append(stage);
  document.body.append(modal);

  // Clique fora da folha fecha
  modal.addEventListener('pointerdown', (e) => {
    if (e.target === modal || e.target === veil) modal._outside = true;
  });
  modal.addEventListener('click', (e) => {
    if (modal._outside && (e.target === modal || e.target === veil)) requestClose();
    modal._outside = false;
  });

  modal.addEventListener('keydown', onModalKey);
}

function onModalKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    requestClose();
    return;
  }
  if (e.key !== 'Tab') return;
  const f = [...stage.querySelectorAll('button, textarea, input, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((n) => !n.disabled && n.getClientRects().length);
  if (!f.length) { e.preventDefault(); return; }
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === stage)) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

function setState(s) {
  stage.dataset.state = s;
}

function showModal(m) {
  mode = m;
  modal.dataset.mode = m;
  modal.hidden = false;
  modal.classList.remove('is-veiled', 'is-paper', 'is-written', 'is-inked');
  document.documentElement.classList.add('ori-lock');
  stage.focus({ preventScroll: true });
}

async function hideModal() {
  modal.classList.remove('is-veiled', 'is-paper', 'is-written');
  await wait(isReduced() ? 0 : 280);
  modal.hidden = true;
  modal.classList.remove('is-inked');
  document.documentElement.classList.remove('ori-lock');
  removeFlyer();
  modalOpen = false;
  current = null;
}

/** Centro e largura do "pacotinho" dobrado (metade × metade da folha). */
function foldedRect() {
  const r = stage.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: note.offsetWidth * 0.56 };
}

function rectOf(node) {
  const r = node.getBoundingClientRect();
  return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width };
}

async function unfold() {
  if (isReduced()) { setState('open'); modal.classList.add('is-written'); return; }
  setState('folded');
  void note.offsetWidth;
  setState('half');
  await wait(TIMING.top);
  setState('open');
  await wait(TIMING.flaps);
  modal.classList.add('is-written');
  await wait(TIMING.text * 0.6);
}

async function fold() {
  if (isReduced()) { modal.classList.remove('is-written'); setState('folded'); return; }
  modal.classList.remove('is-written');
  await wait(TIMING.text * 0.5);
  setState('half');
  await wait(TIMING.flaps);
  setState('folded');
  await wait(TIMING.top);
}

/* --- Coração voador (ponte entre o céu e a folha) ------------------------ */

let flyer = null;

function makeFlyer(palette, at) {
  removeFlyer();
  flyer = el('div', `ori-flyer ori-p-${palette}`);
  flyer.setAttribute('aria-hidden', 'true');
  flyer.innerHTML = HEART_SVG;
  const w = at.w;
  const h = w * 0.92;
  Object.assign(flyer.style, {
    width: `${w}px`, height: `${h}px`,
    left: `${at.cx - w / 2}px`, top: `${at.cy - h / 2}px`
  });
  modal.append(flyer);
  return flyer;
}

function removeFlyer() {
  flyer?.remove();
  flyer = null;
}

/** Anima o flyer (posicionado em `home`) de `a` para `b`. */
function fly(home, a, b, duration = TIMING.fly) {
  const tf = (p, spin) =>
    `perspective(900px) translate(${(p.cx - home.cx).toFixed(1)}px, ${(p.cy - home.cy).toFixed(1)}px) scale(${(p.w / home.w).toFixed(3)}) rotateY(${spin}deg) rotate(${spin ? 0 : -8}deg)`;
  const anim = flyer.animate(
    [{ transform: tf(a, 0) }, { transform: tf(b, 360) }],
    { duration, easing: 'cubic-bezier(.45,.05,.2,1)', fill: 'forwards' }
  );
  return anim.finished.catch(() => {});
}

function fadeFlyer(to, duration = 260) {
  if (!flyer) return Promise.resolve();
  const anim = flyer.animate(
    to === 0
      ? [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.12)' }]
      : [{ opacity: 0, transform: 'scale(1.12)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration, easing: 'ease-out', fill: 'forwards' }
  );
  return anim.finished.catch(() => {});
}

/* --- Leitura --------------------------------------------------------------- */

function buildReadBody(msg) {
  body.textContent = '';
  titleEl.textContent = `Recado de ${msg.author}`;
  const len = msg.text.length;
  body.style.setProperty('--msg-fs', len < 70 ? '2.25' : len < 140 ? '1.85' : '1.55');

  const kicker = el('p', 'ori-note__kicker', 'um recado dobrado com carinho');
  const text = el('p', 'ori-note__text', msg.text);
  text.id = 'ori-dialog-text';
  const author = el('p', 'ori-note__author', `— ${msg.author}`);
  const seal = el('span', 'ori-note__seal');
  seal.setAttribute('aria-hidden', 'true');
  body.append(kicker, text, author, seal);
  stage.setAttribute('aria-describedby', 'ori-dialog-text');
  actions.textContent = '';
}

async function openRead(h) {
  if (busy || modalOpen) return;
  busy = true;
  modalOpen = true;
  current = h;
  opener = h.el;
  buildReadBody(h.msg);
  showModal('read');
  setState('folded');

  if (isReduced()) {
    setState('open');
    modal.classList.add('is-veiled', 'is-paper', 'is-written');
    closeBtn.focus({ preventScroll: true });
    busy = false;
    return;
  }

  const from = rectOf(h.el);
  h.el.classList.add('is-away');
  modal.classList.add('is-veiled');
  const home = foldedRect();
  makeFlyer(h.palette, home);
  await fly(home, from, home);
  modal.classList.add('is-paper');
  await fadeFlyer(0, 280);
  removeFlyer();
  await unfold();
  closeBtn.focus({ preventScroll: true });
  busy = false;
}

async function closeRead() {
  const h = current;
  if (isReduced() || !h || !h.el.isConnected) {
    h?.el.classList.remove('is-away');
    await hideModal();
    restoreFocus();
    return;
  }
  await fold();
  const home = foldedRect();
  makeFlyer(h.palette, home);
  fadeFlyer(1, 240);
  modal.classList.remove('is-paper');
  await wait(220);
  modal.classList.remove('is-veiled');
  await fly(home, home, rectOf(h.el));
  h.el.classList.remove('is-away');
  removeFlyer();
  await hideModal();
  restoreFocus();
}

function restoreFocus() {
  const target = opener && opener.isConnected ? opener : cta;
  target?.focus({ preventScroll: true });
  opener = null;
}

async function requestClose() {
  if (busy || !modalOpen) return;
  busy = true;
  try {
    if (mode === 'read') await closeRead();
    else await closeWrite();
  } finally {
    busy = false;
  }
}

/* --- Escrita --------------------------------------------------------------- */

let ta, author, counter, status, sendBtn, ink;

function buildWriteBody() {
  body.textContent = '';
  stage.removeAttribute('aria-describedby');
  titleEl.textContent = 'Dobre o seu recado';

  const form = el('form', 'ori-write');
  form.noValidate = true;
  form.addEventListener('submit', (e) => { e.preventDefault(); send(); });

  const kicker = el('p', 'ori-note__kicker', 'escreva no papel');
  kicker.setAttribute('aria-hidden', 'true');

  const taLabel = el('label', 'sr-only', 'Seu recado');
  taLabel.htmlFor = 'ori-text';
  ta = el('textarea', 'ori-write__text');
  ta.id = 'ori-text';
  ta.maxLength = cfg.maxLength;
  ta.rows = 5;
  ta.placeholder = 'Escreva com o coração…';
  ta.value = draft.text;
  ta.setAttribute('aria-describedby', 'ori-count ori-status');

  const sign = el('div', 'ori-write__sign');
  const aLabel = el('label', null, '— assinado:');
  aLabel.htmlFor = 'ori-author';
  author = el('input', 'ori-write__author');
  author.id = 'ori-author';
  author.type = 'text';
  author.maxLength = AUTHOR_MAX;
  author.autocomplete = 'nickname';
  author.placeholder = 'seu nome';
  author.value = draft.author;
  sign.append(aLabel, author);

  const meta = el('div', 'ori-write__meta');
  status = el('p', 'ori-write__status');
  status.id = 'ori-status';
  status.setAttribute('aria-live', 'polite');
  counter = el('span', 'ori-write__count');
  counter.id = 'ori-count';
  meta.append(status, counter);

  ink = el('p', 'ori-note__text ori-write__ink');
  ink.setAttribute('aria-hidden', 'true');

  form.append(kicker, taLabel, ta, sign, meta);
  body.append(form, ink);

  const updateCounter = () => {
    const n = ta.value.length;
    counter.textContent = `${n}/${cfg.maxLength}`;
    counter.classList.toggle('is-near', n > cfg.maxLength * 0.9);
    draft.text = ta.value;
    if (n) status.textContent = '';
  };
  ta.addEventListener('input', updateCounter);
  author.addEventListener('input', () => { draft.author = author.value; });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  });
  updateCounter();

  // Botões abaixo da folha
  actions.textContent = '';
  const cancel = el('button', 'btn btn--ghost', 'Cancelar');
  cancel.type = 'button';
  cancel.addEventListener('click', () => requestClose());
  sendBtn = el('button', 'btn', 'Dobrar e enviar');
  sendBtn.type = 'button';
  sendBtn.addEventListener('click', () => send());
  actions.append(cancel, sendBtn);
}

async function openWrite() {
  if (busy || modalOpen) return;
  busy = true;
  modalOpen = true;
  opener = cta;
  buildWriteBody();
  showModal('write');
  setState('folded');
  modal.classList.add('is-veiled');

  if (isReduced()) {
    setState('open');
    modal.classList.add('is-paper', 'is-written');
  } else {
    await wait(40);
    modal.classList.add('is-paper');
    await wait(160);
    await unfold();
  }
  ta.focus({ preventScroll: true });
  busy = false;
}

async function closeWrite() {
  if (!isReduced()) {
    await fold();
    modal.classList.remove('is-paper');
    await wait(200);
  }
  await hideModal();
  restoreFocus();
}

async function send() {
  if (busy || mode !== 'write') return;

  const text = cleanText(ta.value, cfg.maxLength);
  if (!text) {
    status.textContent = 'Escreva algumas palavrinhas antes de dobrar.';
    ta.focus();
    return;
  }
  const now = Date.now();
  const left = RATE_MS - (now - lastSent);
  if (left > 0) {
    status.textContent = `Respire um pouquinho… você pode dobrar outro em ${Math.ceil(left / 1000)}s.`;
    return;
  }

  busy = true;
  sendBtn.disabled = true;
  lastSent = now;
  writeLastSent(now);

  const authorName = cleanText(author.value, AUTHOR_MAX).replace(/\s+/g, ' ') || DEFAULT_AUTHOR;
  let record;
  try {
    record = await storage.add({ author: authorName, text });
  } catch {
    record = { id: `tmp-${now}`, author: authorName, text };
  }
  const msg = normalize(record, cfg.maxLength) || { id: `tmp-${now}`, author: authorName, text };
  draft = { text: '', author: draft.author }; // lembra o nome, limpa o texto

  // A escrita "vira" caligrafia antes de dobrar
  ink.textContent = msg.text;
  body.style.setProperty('--msg-fs', msg.text.length < 70 ? '2.1' : msg.text.length < 140 ? '1.75' : '1.45');
  modal.classList.add('is-inked');
  document.activeElement?.blur?.();
  stage.focus({ preventScroll: true });

  // Novo coração no céu (escondido até o voo terminar)
  const h = addHeart(msg, { fresh: true });
  h.el.classList.add('is-away');
  measure();
  layout(false);
  h.x = h.tx; h.y = h.ty;
  render(performance.now() / 1000);

  if (isReduced()) {
    await hideModal();
    h.el.classList.remove('is-away');
    finishSend(h);
    busy = false;
    return;
  }

  await wait(TIMING.ink);
  await fold();
  const home = foldedRect();
  makeFlyer('red', home);
  fadeFlyer(1, 240);
  modal.classList.remove('is-paper');
  await wait(220);
  modal.classList.remove('is-veiled');
  render(performance.now() / 1000);
  const target = rectOf(h.el);
  await fly(home, home, target, TIMING.fly + 200);
  h.el.classList.remove('is-away');
  removeFlyer();
  await hideModal();
  finishSend(h);
  busy = false;
}

function finishSend(h) {
  const r = h.el.getBoundingClientRect();
  celebrate(r.left + r.width / 2, r.top + r.height / 2);
  h.el.classList.add('is-fresh');
  setTimeout(() => h.el.classList.remove('is-fresh'), 4000);
  liveEl.textContent = 'Seu recado foi dobrado e agora flutua no céu.';
  opener = null;
  cta.focus({ preventScroll: true });
}
