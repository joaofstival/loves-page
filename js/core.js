/**
 * core.js — estado compartilhado e o único loop de animação (rAF) da página.
 *
 * Todos os módulos leem daqui em vez de criar seus próprios listeners de
 * scroll/rAF. Isso mantém a página leve: window.scrollY é lido UMA vez por
 * frame, e todas as animações rodam no mesmo requestAnimationFrame.
 */

/* --------------------------------------------------------------------------
 * Preferências do usuário / dispositivo
 * ------------------------------------------------------------------------ */
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqTouch = window.matchMedia('(hover: none)');

/** true se o usuário pediu menos movimento no sistema. */
export let reducedMotion = mqReduced.matches;
/** true em dispositivos sem hover (celulares/tablets). */
export let isTouch = mqTouch.matches;

// ES modules exportam bindings "vivos": quem importou vê o valor atualizado.
mqReduced.addEventListener?.('change', (e) => { reducedMotion = e.matches; });
mqTouch.addEventListener?.('change', (e) => { isTouch = e.matches; });

/* --------------------------------------------------------------------------
 * Estado de rolagem
 *  y         posição atual (px)
 *  velocity  velocidade suavizada (px/frame, com sinal: + desce, − sobe)
 *  energy    0..1 — sobe rápido ao rolar (k=.25), decai devagar (k=.04)
 *  progress  0..1 — quanto da página já foi rolado
 *  vh / vw   tamanho da viewport
 * ------------------------------------------------------------------------ */
export const scrollState = {
  y: window.scrollY || 0,
  velocity: 0,
  energy: 0,
  progress: 0,
  vh: window.innerHeight,
  vw: window.innerWidth
};

/* --------------------------------------------------------------------------
 * Ponteiro (mouse/toque) normalizado
 *  x, y em -1..1 (centro da tela = 0; y positivo para cima)
 * ------------------------------------------------------------------------ */
export const pointer = { x: 0, y: 0, clientX: 0, clientY: 0 };

function updatePointer(clientX, clientY) {
  pointer.clientX = clientX;
  pointer.clientY = clientY;
  pointer.x = (clientX / scrollState.vw) * 2 - 1;
  pointer.y = -((clientY / scrollState.vh) * 2 - 1);
}

window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) updatePointer(t.clientX, t.clientY);
}, { passive: true });

/* --------------------------------------------------------------------------
 * Medidas (recalculadas em resize e quando os módulos pedem)
 * ------------------------------------------------------------------------ */
let maxScroll = 1;

/** Recalcula viewport e altura rolável. Chame após mudanças de layout. */
export function remeasure() {
  scrollState.vh = window.innerHeight;
  scrollState.vw = window.innerWidth;
  const docH = document.documentElement.scrollHeight;
  maxScroll = Math.max(1, docH - scrollState.vh);
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(remeasure, 120);
}, { passive: true });

/* --------------------------------------------------------------------------
 * Loop único de animação
 * ------------------------------------------------------------------------ */
const subscribers = new Set();

/**
 * Registra uma função chamada a cada frame com (dt em segundos, t em segundos).
 * @returns {() => void} função para cancelar a inscrição
 */
export function onFrame(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

let running = false;
let lastTime = 0;
let lastY = scrollState.y;

function frame(now) {
  const t = now / 1000;
  const dt = Math.min(0.1, Math.max(0, t - lastTime)); // dt limitado a 0.1s
  lastTime = t;

  // --- Rolagem: leitura única por frame ---
  const y = window.scrollY || window.pageYOffset || 0;
  const rawVelocity = y - lastY;
  lastY = y;
  scrollState.y = y;
  scrollState.velocity += (rawVelocity - scrollState.velocity) * 0.2;
  scrollState.progress = Math.min(1, Math.max(0, y / maxScroll));

  const target = Math.min(1, Math.abs(scrollState.velocity) / 40);
  const k = target > scrollState.energy ? 0.25 : 0.04; // sobe rápido, desce devagar
  scrollState.energy += (target - scrollState.energy) * k;
  if (scrollState.energy < 0.0005) scrollState.energy = 0;

  // --- Assinantes ---
  for (const cb of subscribers) {
    try {
      cb(dt, t);
    } catch (err) {
      console.warn('[core] erro em onFrame; removendo callback.', err);
      subscribers.delete(cb);
    }
  }

  requestAnimationFrame(frame);
}

/** Inicia o loop (idempotente). */
export function startLoop() {
  if (running) return;
  running = true;
  remeasure();
  lastTime = performance.now() / 1000;
  lastY = window.scrollY || 0;
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------------------------
 * Revelação ao rolar
 *  Qualquer elemento com [data-reveal] ganha .is-visible quando entra na tela.
 *  Atraso opcional: style="--reveal-delay: 200ms".
 * ------------------------------------------------------------------------ */
let revealObserver = null;

function getRevealObserver() {
  if (revealObserver) return revealObserver;
  if (!('IntersectionObserver' in window)) return null;
  revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  return revealObserver;
}

/**
 * Observa todos os [data-reveal] dentro de rootEl (inclusive o próprio rootEl).
 * Módulos devem chamar isto depois de renderizar seu HTML.
 */
export function observeReveal(rootEl = document) {
  if (!rootEl) return;
  const els = [];
  if (rootEl.nodeType === 1 && rootEl.hasAttribute('data-reveal')) els.push(rootEl);
  rootEl.querySelectorAll?.('[data-reveal]').forEach((el) => els.push(el));

  const io = getRevealObserver();
  for (const el of els) {
    if (el.classList.contains('is-visible')) continue;
    if (!io || reducedMotion) el.classList.add('is-visible');
    else io.observe(el);
  }
}
