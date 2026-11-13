/**
 * confetti.js — romantic confetti bursts on a single full-screen canvas.
 *
 * Design notes (performance first):
 *  - A fixed pool of particle objects is allocated once; bursts recycle dead
 *    slots, so there is zero allocation (and zero GC churn) while animating.
 *  - The render loop owns its own requestAnimationFrame and runs ONLY while at
 *    least one particle is alive. When the last one dies the canvas is cleared
 *    and the loop stops completely — an idle page costs nothing.
 *  - Each particle is drawn with a single ctx.setTransform() that folds DPR,
 *    position, rotation, size and a cosine "flip" (fake 3D tumble) into one
 *    matrix, then fills a cached Path2D (heart / rect / circle).
 *  - Canvas backing store is resized lazily: a window resize only marks it
 *    dirty; the actual resize happens at the next burst.
 *
 * Public API:
 *  - init()                       wires click delegation for [data-confetti]
 *                                 and the .btn "heart pop" micro-interaction.
 *  - burst(x, y, {count, spread, power})  fire a burst at viewport coords.
 */
import { reducedMotion, isTouch } from './core.js';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

const POOL_SIZE = 260;          // hard cap of simultaneous particles
const DPR_CAP = 2;

// Physics expressed "per 60fps frame" and scaled by dt, so it is frame-rate
// independent but easy to reason about.
const GRAVITY = 0.26;           // px / frame²
const DRAG = 0.955;             // velocity multiplier per frame (air drag)

// Palette weighted toward reds (duplicates = higher probability).
const COLORS = [
  '#dc143c', '#dc143c', '#dc143c',
  '#a50e2d', '#a50e2d',
  '#f7a8b8', '#ffc0cb',
];

// Shapes, all defined in a unit box centred on the origin.
const SHAPE_HEART = 0;
const SHAPE_RECT = 1;
const SHAPE_CIRCLE = 2;

const PATHS = [
  // Heart: ~2 wide, ~1.8 tall, centred.
  new Path2D('M0 0.75 C-1.25 -0.05 -0.75 -1.15 0 -0.4 C0.75 -1.15 1.25 -0.05 0 0.75 Z'),
  // Confetti strip.
  new Path2D('M-0.6 -0.32 H0.6 V0.32 H-0.6 Z'),
  // Dot.
  (() => { const p = new Path2D(); p.arc(0, 0, 0.5, 0, Math.PI * 2); return p; })(),
];

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let canvas = null;
let ctx = null;
let dpr = 1;
let sizeDirty = true;
let running = false;
let rafId = 0;
let lastT = 0;
let aliveCount = 0;

/** Pre-allocated particle pool (plain objects with a stable shape). */
const pool = new Array(POOL_SIZE);
for (let i = 0; i < POOL_SIZE; i++) {
  pool[i] = {
    alive: false,
    x: 0, y: 0, vx: 0, vy: 0,
    rot: 0, vr: 0,          // rotation + angular velocity (rad/frame)
    flip: 0, vflip: 0,      // tumble phase; scaleY = cos(flip)
    wobble: 0, vwobble: 0,  // lateral sway phase for a fluttering fall
    size: 0,
    color: COLORS[0],
    shape: 0,
    life: 0, maxLife: 1,    // seconds
  };
}

/* ------------------------------------------------------------------ */
/* Canvas sizing                                                       */
/* ------------------------------------------------------------------ */

function applySize() {
  if (!canvas) return;
  dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  sizeDirty = false;
}

function onResize() {
  // Resize now only if we're animating; otherwise defer to the next burst.
  if (running) applySize();
  else sizeDirty = true;
}

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */

function start() {
  if (running) return;
  running = true;
  lastT = performance.now();
  rafId = requestAnimationFrame(tick);
}

function stop() {
  running = false;
  cancelAnimationFrame(rafId);
  // Leave a clean canvas behind when idle.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function tick(now) {
  // Clamp dt so a backgrounded tab doesn't teleport particles.
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const f = dt * 60;                      // frames elapsed @60fps
  const drag = Math.pow(DRAG, f);
  const h = canvas.height / dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let alive = 0;
  for (let i = 0; i < POOL_SIZE; i++) {
    const p = pool[i];
    if (!p.alive) continue;

    p.life += dt;
    if (p.life >= p.maxLife || p.y > h + 40) { p.alive = false; continue; }
    alive++;

    // Integrate.
    p.vx *= drag;
    p.vy = p.vy * drag + GRAVITY * f;
    p.wobble += p.vwobble * f;
    p.x += (p.vx + Math.sin(p.wobble) * 0.6) * f;
    p.y += p.vy * f;
    p.rot += p.vr * f;
    p.flip += p.vflip * f;

    // Fade during the last 35% of life.
    const k = p.life / p.maxLife;
    ctx.globalAlpha = k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35);

    // One matrix: DPR · translate · rotate · scale(size, size·cos(flip)).
    const s = p.size * dpr;
    const c = Math.cos(p.rot);
    const sn = Math.sin(p.rot);
    const fy = Math.cos(p.flip);
    ctx.setTransform(s * c, s * sn, -s * fy * sn, s * fy * c, p.x * dpr, p.y * dpr);
    ctx.fillStyle = p.color;
    ctx.fill(PATHS[p.shape]);
  }
  ctx.globalAlpha = 1;
  aliveCount = alive;

  if (alive > 0) rafId = requestAnimationFrame(tick);
  else stop();
}

/* ------------------------------------------------------------------ */
/* Public: burst                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fire a burst of confetti from viewport coordinates (clientX/clientY).
 * @param {number} x
 * @param {number} y
 * @param {{count?: number, spread?: number, power?: number}} [opts]
 *   count  — particles (default 80, 40 on touch, 12 on reduced motion)
 *   spread — cone angle in degrees around "up" (default 100)
 *   power  — launch speed in px/frame (default 14)
 */
export function burst(x, y, opts = {}) {
  if (!canvas) return;
  if (sizeDirty) applySize();

  const rm = reducedMotion;
  const count = Math.min(
    opts.count ?? (rm ? 12 : isTouch ? 40 : 80),
    POOL_SIZE,
  );
  const spread = ((opts.spread ?? (rm ? 70 : 100)) * Math.PI) / 180;
  const power = opts.power ?? (rm ? 7 : 14);

  let spawned = 0;
  for (let i = 0; i < POOL_SIZE && spawned < count; i++) {
    const p = pool[i];
    if (p.alive) continue;            // pool exhausted? extra particles are skipped
    spawned++;

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
    const speed = power * (0.45 + Math.random() * 0.75);
    const r = Math.random();
    const shape = r < 0.38 ? SHAPE_HEART : r < 0.78 ? SHAPE_RECT : SHAPE_CIRCLE;

    p.alive = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.rot = Math.random() * Math.PI * 2;
    p.vr = (Math.random() - 0.5) * 0.25;
    p.flip = Math.random() * Math.PI * 2;
    p.vflip = 0.08 + Math.random() * 0.18;
    p.wobble = Math.random() * Math.PI * 2;
    p.vwobble = 0.05 + Math.random() * 0.08;
    // Hearts a touch bigger so the shape reads; dots smaller.
    p.size = shape === SHAPE_HEART ? 5 + Math.random() * 4
           : shape === SHAPE_RECT  ? 6 + Math.random() * 5
           : 3 + Math.random() * 3;
    p.color = COLORS[(Math.random() * COLORS.length) | 0];
    p.shape = shape;
    p.life = 0;
    p.maxLife = rm ? 0.9 + Math.random() * 0.4 : 2.2 + Math.random() * 1.3;
  }

  if (spawned > 0) {
    aliveCount += spawned;
    start();
  }
}

/* ------------------------------------------------------------------ */
/* Button "heart pop" micro-interaction                               */
/* ------------------------------------------------------------------ */

/**
 * Brief tactile feedback on .btn clicks: the button gets a short bounce class
 * and a small heart + ring is spawned at the click point. The pop element is
 * appended to <body> (fixed) so it never depends on the button's own
 * positioning / overflow / pseudo-elements, which belong to other modules.
 */
function heartPop(btn, x, y) {
  btn.classList.remove('is-popping');
  // Force reflow so the animation restarts on rapid repeated clicks.
  void btn.offsetWidth;
  btn.classList.add('is-popping');
  const clear = () => btn.classList.remove('is-popping');
  btn.addEventListener('animationend', clear, { once: true });
  setTimeout(clear, 700); // safety net (e.g. animation disabled)

  const pop = document.createElement('span');
  pop.className = 'heart-pop';
  pop.setAttribute('aria-hidden', 'true');
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.appendChild(pop);
  const remove = () => pop.remove();
  pop.addEventListener('animationend', remove, { once: true });
  setTimeout(remove, 1000);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

export function init() {
  canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  if (!ctx) { canvas = null; return; }

  window.addEventListener('resize', onResize, { passive: true });

  // Single delegated listener for the whole document.
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const trigger = target.closest('[data-confetti]');
    const btn = target.closest('.btn');

    // Pointer clicks report detail >= 1; keyboard activation reports 0 and
    // its clientX/Y are meaningless — fall back to the element's centre.
    const fromPointer = e.detail > 0 && (e.clientX || e.clientY);
    const origin = (el) => {
      if (fromPointer) return [e.clientX, e.clientY];
      const r = el.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };

    if (btn) {
      const [bx, by] = origin(btn);
      heartPop(btn, bx, by);
    }
    if (trigger) {
      const [cx, cy] = origin(trigger);
      burst(cx, cy);
    }
  });
}
