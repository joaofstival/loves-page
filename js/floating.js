/**
 * floating.js — "mensagens nas entrelinhas".
 *
 * Every so often, during calm moments, a short love phrase materialises in a
 * quiet corner of the screen (fade + un-blur), drifts upward a little, and
 * dissolves. It is ambient decoration, so it is deliberately shy:
 *
 *  - spawns only every ~9–14s, only if the user was active recently
 *    (pointer / scroll / touch / key in the last few seconds) and the tab is
 *    visible;
 *  - never while the user is scrolling energetically (scrollState.energy);
 *  - at most 2 on screen, never the same phrase twice in a row;
 *  - on desktop it lives in the left/right margins, away from the reading
 *    column; on mobile it only appears where a hit-test finds empty space;
 *  - with reduced motion: rare, single, static, fade-only.
 *
 * All animation is CSS (see css/micro.css → .floating-phrase). JS only picks
 * text + position and removes the node on animationend. A core onFrame
 * subscription exists ONLY while a phrase is on screen (to hurry it away if
 * the user starts scrolling hard), and is dropped immediately afterwards.
 */
import { reducedMotion, scrollState, onFrame } from './core.js';

/* ------------------------------------------------------------------ */
/* Tunables                                                            */
/* ------------------------------------------------------------------ */

const MIN_GAP = reducedMotion ? 25000 : 9000;   // ms between spawns
const MAX_GAP = reducedMotion ? 40000 : 14000;
const FIRST_DELAY = 7000;                        // let the hero breathe first
const RETRY_DELAY = 2500;                        // when conditions aren't met
const ACTIVE_WINDOW = 4000;                      // "recently active" (ms)
const MAX_ON_SCREEN = reducedMotion ? 1 : 2;
const CALM_ENERGY = 0.35;                        // spawn only below this
const FLEE_ENERGY = 0.7;                         // hurry visible ones away above this
const READING_COLUMN = 760;                      // assumed main column width (px)

// Elements a phrase must not sit on top of (mobile hit-test).
const BUSY_SELECTOR =
  'p, h1, h2, h3, h4, li, blockquote, figure, img, video, picture, canvas:not(#confetti-canvas), button, a, .btn, input, textarea, time';

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let layer = null;
let phrases = [];
let lastIndex = -1;
let lastActivity = 0;
let timer = 0;
let live = 0;                 // phrases currently on screen
let unsubFrame = null;
let tone = 0;                 // alternates red / pink

const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

function schedule(delay) {
  clearTimeout(timer);
  timer = setTimeout(trySpawn, delay);
}

function canSpawn() {
  return (
    !document.hidden &&
    live < MAX_ON_SCREEN &&
    performance.now() - lastActivity < ACTIVE_WINDOW &&
    (scrollState.energy ?? 0) < CALM_ENERGY
  );
}

function trySpawn() {
  if (!canSpawn() || !spawn()) {
    schedule(RETRY_DELAY);
    return;
  }
  schedule(rand(MIN_GAP, MAX_GAP));
}

/* ------------------------------------------------------------------ */
/* Phrase selection & placement                                        */
/* ------------------------------------------------------------------ */

function pickPhrase() {
  if (phrases.length === 1) return phrases[0];
  let i;
  do { i = (Math.random() * phrases.length) | 0; } while (i === lastIndex);
  lastIndex = i;
  return phrases[i];
}

/** True if the rect overlaps meaningful content (checks 5 sample points). */
function overlapsContent(x, y, w, h) {
  const pts = [
    [x + w / 2, y + h / 2],
    [x + 4, y + 4], [x + w - 4, y + 4],
    [x + 4, y + h - 4], [x + w - 4, y + h - 4],
  ];
  for (const [px, py] of pts) {
    const el = document.elementFromPoint(px, py);
    if (el && el.closest(BUSY_SELECTOR)) return true;
  }
  return false;
}

/** True if the rect collides with a phrase already on screen. */
function overlapsPhrase(x, y, w, h) {
  for (const el of layer.children) {
    const r = el.getBoundingClientRect();
    if (x < r.right + 24 && x + w > r.left - 24 && y < r.bottom + 24 && y + h > r.top - 24) {
      return true;
    }
  }
  return false;
}

/**
 * Find a position for an element of size (w, h). Returns [x, y] or null.
 * Desktop with generous margins → left/right gutters (no hit-test needed,
 * but still avoid other phrases). Otherwise → hit-tested empty gaps.
 */
function findSpot(w, h) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = (vw - READING_COLUMN) / 2;
  const useGutters = margin >= w + 40;

  for (let attempt = 0; attempt < 8; attempt++) {
    let x;
    const y = rand(vh * 0.18, vh * 0.78 - h);

    if (useGutters) {
      const left = Math.random() < 0.5;
      const pad = rand(24, Math.max(24, margin - w - 16));
      x = left ? pad : vw - pad - w;
      if (!overlapsPhrase(x, y, w, h)) return [x, y];
    } else {
      x = rand(16, Math.max(16, vw - w - 16));
      if (!overlapsPhrase(x, y, w, h) && !overlapsContent(x, y, w, h)) return [x, y];
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Spawning                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hurry a phrase away (user started scrolling hard). Reads the current
 * animated opacity, stops the CSS animation and fades out quickly via WAAPI;
 * removal then happens through the element's own finish() hook.
 */
function leave(el) {
  if (el.dataset.leaving) return;
  el.dataset.leaving = '1';
  const from = getComputedStyle(el).opacity;
  el.style.animation = 'none';
  el.style.opacity = '0';
  const anim = el.animate([{ opacity: from }, { opacity: 0 }], { duration: 350, easing: 'ease-out' });
  anim.onfinish = () => el.dispatchEvent(new Event('phrase:done'));
}

/** Creates one phrase. Returns false if no tasteful spot was found. */
function spawn() {
  const el = document.createElement('span');
  el.className = 'floating-phrase';
  el.textContent = pickPhrase();
  if (tone++ % 2) el.classList.add('is-soft');
  if (reducedMotion) el.classList.add('is-static');

  // Measure off-screen (invisible) before choosing a spot.
  el.style.visibility = 'hidden';
  layer.appendChild(el);
  const { width, height } = el.getBoundingClientRect();
  const spot = findSpot(width, height);
  if (!spot) { el.remove(); return false; }

  const life = reducedMotion ? 6 : rand(6.5, 8);
  el.style.left = `${Math.round(spot[0])}px`;
  el.style.top = `${Math.round(spot[1])}px`;
  el.style.setProperty('--life', `${life}s`);
  el.style.setProperty('--drift', `${-Math.round(rand(28, 52))}px`);
  el.style.setProperty('--tilt', `${rand(-3, 3).toFixed(2)}deg`);
  el.style.visibility = '';

  live++;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
    live--;
    if (live === 0 && unsubFrame) { unsubFrame(); unsubFrame = null; }
  };
  el.addEventListener('animationend', (e) => { if (e.target === el) finish(); });
  el.addEventListener('phrase:done', finish);
  setTimeout(finish, life * 1000 + 1500); // safety net

  // Watch scroll energy only while something is visible.
  if (!unsubFrame && !reducedMotion) {
    unsubFrame = onFrame(() => {
      if ((scrollState.energy ?? 0) > FLEE_ENERGY) {
        for (const p of layer.children) leave(p);
      }
    });
  }
  return true;
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

function markActive() { lastActivity = performance.now(); }

export function init(CONFIG = {}) {
  layer = document.getElementById('floating-layer');
  phrases = Array.isArray(CONFIG.floatingPhrases)
    ? CONFIG.floatingPhrases.filter((s) => typeof s === 'string' && s.trim())
    : [];
  if (!layer || phrases.length === 0) return;

  const opts = { passive: true };
  window.addEventListener('pointermove', markActive, opts);
  window.addEventListener('pointerdown', markActive, opts);
  window.addEventListener('scroll', markActive, opts);
  window.addEventListener('keydown', markActive, opts);
  window.addEventListener('touchstart', markActive, opts);

  // Pause the scheduler entirely while the tab is hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else schedule(FIRST_DELAY / 2);
  });

  schedule(FIRST_DELAY);
}
