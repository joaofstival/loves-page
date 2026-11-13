/**
 * counter.js — "Nosso tempo"
 * ------------------------------------------------------------------
 * Contador vivo desde CONFIG.couple.startDate: anos, dias, horas,
 * minutos e segundos, com coração batendo ("tum-tum") ao fundo.
 *
 * PERSONALIZE:
 *  - CONFIG.couple.startDate: data/hora local ISO (ex.: '2023-06-12T20:30').
 *  - CONFIG.counter.title:   título (a última palavra vira <em> script).
 *  - CONFIG.counter.message: frase; {anos} vira "1 ano" / "N anos" / "Alguns meses".
 *  - CONFIG.counter.bpm:     batimentos por minuto do coração.
 *  - Textos de contagem regressiva: FUTURE_* abaixo.
 */
import { reducedMotion } from './core.js';

const FUTURE_LEAD = 'Faltam';
const FUTURE_MESSAGE = 'para a nossa história começar';

const UNITS = [
  { key: 'years', one: 'ano', many: 'anos', pad: 0 },   // escondido enquanto for 0
  { key: 'months', one: 'mês', many: 'meses', pad: 0 },
  { key: 'days', one: 'dia', many: 'dias', pad: 0 },
  { key: 'hours', one: 'hora', many: 'horas', pad: 2 },
  { key: 'minutes', one: 'minuto', many: 'minutos', pad: 2 },
  { key: 'seconds', one: 'segundo', many: 'segundos', pad: 2 },
];

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Soma meses mantendo a hora local; dia que não existe no mês alvo
 *  (ex.: 31/01 + 1 mês, 29/02 + 1 ano) vira o último dia daquele mês. */
function addMonths(date, n) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d;
}
function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n); // aritmética de calendário: imune a horário de verão
  return d;
}

/** Diferença calendário-correta entre `from` e `to` (from <= to). */
export function diff(from, to) {
  // Meses completos (calendário), depois dias/horas restantes.
  let total = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  let anchor = addMonths(from, total);
  if (anchor > to) anchor = addMonths(from, --total);
  if (total < 0) { total = 0; anchor = from; }
  const years = Math.floor(total / 12);
  const months = total % 12;

  let days = Math.floor((to - anchor) / 864e5);
  let dayAnchor = addDays(anchor, days);
  while (dayAnchor > to) dayAnchor = addDays(anchor, --days);
  while (addDays(anchor, days + 1) <= to) dayAnchor = addDays(anchor, ++days);

  let rest = Math.floor((to - dayAnchor) / 1000);
  const hours = Math.floor(rest / 3600);
  rest -= hours * 3600;
  const minutes = Math.floor(rest / 60);
  const seconds = rest - minutes * 60;
  return { years, months, days, hours, minutes, seconds };
}

/** Aceita 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:mm[:ss]' como horário LOCAL. */
function parseLocal(iso) {
  if (iso instanceof Date) return iso;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(iso || '').trim());
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const HEART_PATH =
  'M50 88C22 68 6 52 6 32 6 18 17 8 30 8c8.6 0 15.6 4.6 20 11.4C54.4 12.6 61.4 8 70 8c13 0 24 10 24 24 0 20-16 36-44 56Z';

export function init(CONFIG = {}) {
  const section = document.getElementById('counter');
  if (!section) return;

  const cfg = CONFIG.counter || {};
  const start = parseLocal(CONFIG.couple?.startDate);
  const bpm = Number(cfg.bpm) || 72;
  // main.js também define --heartbeat; aqui garantimos um fallback local.
  section.style.setProperty('--heartbeat', `${(60 / bpm).toFixed(3)}s`);
  if (reducedMotion) section.classList.add('is-still');

  const title = String(cfg.title || 'Nosso tempo').trim();
  const cut = title.lastIndexOf(' ');
  const titleHTML = cut > 0 ? `${esc(title.slice(0, cut))} <em>${esc(title.slice(cut + 1))}</em>` : `<em>${esc(title)}</em>`;

  section.setAttribute('aria-labelledby', 'counter-title');
  section.innerHTML = `
    <div class="counter__glow" aria-hidden="true"></div>
    <svg class="counter__heart" viewBox="0 0 100 96" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="counterHeartFill" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stop-color="#ffd6de"/>
          <stop offset="55%" stop-color="#ff9fb2"/>
          <stop offset="100%" stop-color="#e2405f"/>
        </radialGradient>
      </defs>
      <path d="${HEART_PATH}" fill="url(#counterHeartFill)"/>
    </svg>
    <div class="container counter__inner">
      <h2 class="section-title" id="counter-title" data-reveal>${titleHTML}</h2>
      <p class="counter__kicker" data-reveal style="--reveal-delay:100ms" hidden></p>
      <div class="counter__tiles-wrap" data-reveal style="--reveal-delay:180ms">
      <div class="counter__tiles" aria-hidden="true">
        ${UNITS.map((u) => `
          <div class="c-tile" data-unit="${u.key}">
            <span class="c-tile__num"><span class="c-tile__digits">0</span></span>
            <span class="c-tile__label">${u.many}</span>
          </div>`).join('')}
      </div>
      </div>
      <p class="counter__message" data-reveal style="--reveal-delay:260ms"></p>
      <p class="counter__sr" aria-live="polite" aria-atomic="true"></p>
    </div>
  `;

  const kicker = section.querySelector('.counter__kicker');
  const messageEl = section.querySelector('.counter__message');
  const srEl = section.querySelector('.counter__sr');
  const tiles = Object.fromEntries(
    UNITS.map((u) => {
      const el = section.querySelector(`[data-unit="${u.key}"]`);
      return [u.key, { u, el, num: el.querySelector('.c-tile__num'), label: el.querySelector('.c-tile__label'), value: null }];
    })
  );

  if (!start) {
    messageEl.textContent = 'Defina CONFIG.couple.startDate para ver o nosso tempo.';
    return;
  }

  let future = null;
  let lastMinuteKey = '';
  let lastYearsMsg = '';

  function setTile(t, n, animate) {
    if (t.value === n) return;
    const text = t.u.pad ? String(n).padStart(t.u.pad, '0') : String(n);
    const prevOne = t.value === 1;
    t.value = n;
    if ((n === 1) !== prevOne || t.label.dataset.init !== '1') {
      t.label.textContent = n === 1 ? t.u.one : t.u.many;
      t.label.dataset.init = '1';
    }
    const old = t.num.querySelector('.c-tile__digits:not(.is-leaving)');
    if (!animate || reducedMotion || !old) {
      if (old) old.textContent = text;
      return;
    }
    // Remove saídas anteriores ainda presentes (tick rápido)
    t.num.querySelectorAll('.is-leaving').forEach((e) => e.remove());
    const next = document.createElement('span');
    next.className = 'c-tile__digits is-entering';
    next.textContent = text;
    old.classList.add('is-leaving');
    old.addEventListener('animationend', () => old.remove(), { once: true });
    next.addEventListener('animationend', () => next.classList.remove('is-entering'), { once: true });
    t.num.appendChild(next);
  }

  function render(animate) {
    const now = new Date();
    const isFuture = now < start;
    const d = isFuture ? diff(now, start) : diff(start, now);

    if (isFuture !== future) {
      future = isFuture;
      section.classList.toggle('is-future', isFuture);
      kicker.hidden = !isFuture;
      kicker.textContent = isFuture ? FUTURE_LEAD : '';
      lastYearsMsg = '';
    }

    for (const u of UNITS) setTile(tiles[u.key], d[u.key], animate);

    // "anos" só aparece a partir do primeiro aniversário de namoro
    const hasYears = d.years > 0;
    if (tiles.years.el.hidden === hasYears) {
      tiles.years.el.hidden = !hasYears;
      section.querySelector('.counter__tiles').classList.toggle('has-years', hasYears);
    }

    // Mensagem (só re-renderiza quando muda)
    const msgKey = `${isFuture}|${d.years}|${d.months}`;
    if (msgKey !== lastYearsMsg) {
      lastYearsMsg = msgKey;
      if (isFuture) {
        messageEl.textContent = FUTURE_MESSAGE;
      } else {
        // ≥ 1 ano → "1 ano" / "N anos"; senão "3 meses"; < 1 mês → "Alguns dias"
        const anos = d.years >= 1 ? plural(d.years, 'ano', 'anos')
          : d.months >= 1 ? plural(d.months, 'mês', 'meses')
          : 'Alguns dias';
        let msg = String(cfg.message || '{anos} desde que minha vida ganhou mais cor').replace(/\{anos\}/g, anos);
        // Primeira letra maiúscula quando a frase começa com o número/termo
        msg = msg.charAt(0).toUpperCase() + msg.slice(1);
        messageEl.textContent = msg;
      }
    }

    // Resumo para leitores de tela: uma vez por minuto
    const minuteKey = `${isFuture}|${d.years}|${d.days}|${d.hours}|${d.minutes}`;
    if (minuteKey !== lastMinuteKey) {
      lastMinuteKey = minuteKey;
      const parts = [
        ...(d.years > 0 ? [plural(d.years, 'ano', 'anos')] : []),
        plural(d.months, 'mês', 'meses'),
        plural(d.days, 'dia', 'dias'),
        plural(d.hours, 'hora', 'horas'),
      ];
      const list = `${parts.join(', ')} e ${plural(d.minutes, 'minuto', 'minutos')}`;
      srEl.textContent = isFuture ? `Faltam ${list} para a nossa história começar.` : `Juntos há ${list}.`;
    }
  }

  /* ---------- Relógio alinhado ao segundo; pausa fora de vista ---------- */
  let timer = 0;
  let visible = false;

  function schedule() {
    clearTimeout(timer);
    if (!visible || document.hidden) return;
    timer = setTimeout(() => {
      render(true);
      schedule();
    }, 1000 - (Date.now() % 1000) + 8);
  }

  render(false);

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      section.classList.toggle('is-inview', visible);
      if (visible) {
        render(false); // sincroniza sem animar o "salto"
        schedule();
      } else clearTimeout(timer);
    },
    { rootMargin: '15% 0px' }
  ).observe(section);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) render(false);
    schedule();
  });
}
