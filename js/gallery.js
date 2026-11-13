/**
 * gallery.js — Galeria de memórias
 * ------------------------------------------------------------------
 * Desktop: masonry em colunas com parallax sutil por coluna (velocidades
 *          diferentes) + tilt 3D seguindo o ponteiro dentro do card.
 * Mobile:  carrossel horizontal com scroll-snap e cards "espiando".
 * Clique:  lightbox cinematográfico (FLIP do grid para o centro),
 *          teclado (Esc, ←, →), swipe, focus trap e retorno de foco.
 *
 * PERSONALIZE:
 *  - Fotos: CONFIG.gallery = [{ src, alt, date, place, caption, width?, height? }]
 *    Informe width/height (px reais) para evitar qualquer salto de layout.
 *  - Textos do cabeçalho: constantes TITLE_HTML / LEAD abaixo
 *    (ou CONFIG.galleryTitle / CONFIG.galleryLead, se existirem).
 *  - Velocidades do parallax: COLUMN_SPEEDS.
 */
import {
  reducedMotion,
  isTouch,
  scrollState,
  onFrame,
  observeReveal,
} from './core.js';

/* ---------- Customização ---------- */
const TITLE_HTML = 'Galeria de <em>memórias</em>';
const LEAD = 'Pequenos pedaços do nosso caminho — cada foto guarda um sorriso, um lugar e um pouco de nós.';
/** Deslocamento máximo (px) por coluna; sinais opostos dão profundidade. */
const COLUMN_SPEEDS = [-38, 26, -18];
/** Breakpoint abaixo do qual vira carrossel (deve casar com gallery.css). */
const MOBILE_MQ = '(max-width: 760px)';
/** Fallback de dimensões conhecidas (evita CLS quando o CONFIG não traz width/height). */
const KNOWN_SIZES = {
  'casal3.jpg': [934, 1275],
  'casal4.jpg': [1170, 776],
  'flower.jpg': [720, 1280],
  'iendo.jpg': [720, 1280],
  'momento1.jpg': [1200, 1600],
  'momento2.jpg': [722, 1059],
  'rodeio.jpg': [900, 1600],
};

/* ---------- Ícones inline ---------- */
const ICON_CAL =
  '<svg class="g-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const ICON_PIN =
  '<svg class="g-ico" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 1 0-9 0c0 3.8 4.5 8 4.5 8Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="6.5" r="1.6" fill="currentColor"/></svg>';
const ICON_PREV =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_NEXT =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const sizeOf = (item) => {
  if (item.width && item.height) return [item.width, item.height];
  const file = String(item.src || '').split('/').pop();
  return KNOWN_SIZES[file] || [3, 4];
};

export function init(CONFIG = {}) {
  const section = document.getElementById('gallery');
  const items = Array.isArray(CONFIG.gallery) ? CONFIG.gallery.filter((i) => i && i.src) : [];
  if (!section || !items.length) return;

  const mqMobile = window.matchMedia(MOBILE_MQ);
  const canTilt = !isTouch && !reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Markup ---------- */
  section.setAttribute('aria-labelledby', 'gallery-title');
  section.innerHTML = `
    <div class="container gallery__head">
      <h2 class="section-title" id="gallery-title" data-reveal>${CONFIG.galleryTitle ? esc(CONFIG.galleryTitle) : TITLE_HTML}</h2>
      <p class="section-lead" data-reveal style="--reveal-delay:120ms">${esc(CONFIG.galleryLead || LEAD)}</p>
    </div>
    <div class="gallery__viewport">
      <div class="gallery__track" role="list" aria-label="Fotos do casal"></div>
    </div>
    <p class="gallery__hint" aria-hidden="true">deslize para ver mais <span>→</span></p>
  `;
  const track = section.querySelector('.gallery__track');

  const cards = items.map((item, i) => {
    const [w, h] = sizeOf(item);
    const li = document.createElement('div');
    li.className = 'g-item';
    li.setAttribute('role', 'listitem');
    li.style.setProperty('--i', i);
    li.style.order = i; // mantém a ordem original quando as colunas viram display:contents
    li.innerHTML = `
      <figure class="g-card${w > h ? ' g-card--wide' : ''}" data-reveal style="--reveal-delay:${(i % 3) * 110 + Math.floor(i / 3) * 60}ms">
        <div class="g-card__inner">
        <button type="button" class="g-card__btn" aria-haspopup="dialog"
          aria-label="Abrir foto: ${esc(item.alt || item.caption || 'memória ' + (i + 1))}">
          <span class="g-card__media" style="aspect-ratio:${w} / ${h}">
            <img src="${esc(item.src)}" alt="${esc(item.alt || '')}" width="${w}" height="${h}"
              loading="lazy" decoding="async" draggable="false">
            <span class="g-card__veil" aria-hidden="true"></span>
            <span class="g-card__shine" aria-hidden="true"></span>
          </span>
        </button>
        <figcaption class="g-card__meta">
          ${item.date || item.place ? `<span class="g-card__facts">
            ${item.date ? `<span class="g-card__fact">${ICON_CAL}${esc(item.date)}</span>` : ''}
            ${item.place ? `<span class="g-card__fact">${ICON_PIN}${esc(item.place)}</span>` : ''}
          </span>` : ''}
          ${item.caption ? `<span class="g-card__caption">${esc(item.caption)}</span>` : ''}
        </figcaption>
        </div>
      </figure>`;
    return li;
  });

  /* Distribui os cards em colunas (desktop). No mobile as colunas usam
     display:contents e os itens fluem no carrossel pela propriedade order. */
  let columns = [];
  let colCount = 0;
  const getColCount = () => (mqMobile.matches ? 1 : window.innerWidth < 1080 ? 2 : 3);

  function layout() {
    const n = getColCount();
    if (n === colCount) return;
    colCount = n;
    track.textContent = '';
    columns = Array.from({ length: n }, (_, c) => {
      const col = document.createElement('div');
      col.className = 'gallery__col';
      col.setAttribute('role', 'presentation');
      const ul = document.createElement('div');
      ul.className = 'gallery__col-list';
      ul.setAttribute('role', 'presentation');
      col.appendChild(ul);
      col.dataset.col = c;
      track.appendChild(col);
      return { el: col, list: ul, speed: COLUMN_SPEEDS[c % COLUMN_SPEEDS.length], y: 0 };
    });
    // Greedy por "altura" relativa → masonry equilibrado.
    const heights = new Array(n).fill(0);
    cards.forEach((li, i) => {
      const [w, h] = sizeOf(items[i]);
      let target = 0;
      for (let c = 1; c < n; c++) if (heights[c] < heights[target] - 0.01) target = c;
      // Pequeno deslocamento inicial nas colunas pares para o efeito "staggered".
      heights[target] += h / w + 0.12;
      columns[target].list.appendChild(li);
    });
    measure();
  }

  /* ---------- Parallax por coluna (somente desktop e em vista) ---------- */
  let sectionTop = 0;
  let sectionH = 0;
  let inView = false;
  let unsub = null;

  function measure() {
    const r = section.getBoundingClientRect();
    sectionTop = r.top + window.scrollY;
    sectionH = r.height;
  }

  function frame() {
    if (!inView || colCount < 2) return;
    const vh = scrollState.vh || window.innerHeight;
    const y = scrollState.y ?? window.scrollY;
    // -1 (seção entrando por baixo) → 1 (saindo por cima)
    const p = ((y + vh / 2) - (sectionTop + sectionH / 2)) / ((sectionH + vh) / 2);
    const clamped = Math.max(-1, Math.min(1, p));
    for (const col of columns) {
      const ty = clamped * col.speed;
      if (Math.abs(ty - col.y) < 0.1) continue;
      col.y = ty;
      col.el.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0)`;
    }
  }

  function updateLoop() {
    const want = inView && !reducedMotion && !mqMobile.matches;
    if (want && !unsub) unsub = onFrame(frame);
    else if (!want && unsub) {
      unsub();
      unsub = null;
    }
    if (!want) columns.forEach((c) => { c.el.style.transform = ''; c.y = 0; });
  }

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (inView) measure();
      updateLoop();
    },
    { rootMargin: '10% 0px' }
  ).observe(section);

  if ('ResizeObserver' in window) {
    let raf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        layout();
        measure();
      });
    }).observe(section);
  }
  mqMobile.addEventListener?.('change', () => {
    layout();
    updateLoop();
  });

  layout();
  observeReveal(section); // uma vez: reparentar não afeta os observers

  /* ---------- Interações dos cards ---------- */
  let lastPointerType = 'mouse';
  let activeTouchCard = null;

  cards.forEach((li, i) => {
    const fig = li.querySelector('.g-card');
    const btn = li.querySelector('.g-card__btn');
    const img = li.querySelector('img');

    // Se não sabíamos a proporção, corrige uma única vez após carregar.
    if (!items[i].width && !KNOWN_SIZES[String(items[i].src).split('/').pop()]) {
      img.addEventListener('load', () => {
        if (img.naturalWidth && img.naturalHeight) {
          img.parentElement.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          fig.classList.toggle('g-card--wide', img.naturalWidth > img.naturalHeight);
        }
      }, { once: true });
    }

    btn.addEventListener('pointerdown', (e) => { lastPointerType = e.pointerType || 'mouse'; }, { passive: true });

    btn.addEventListener('click', () => {
      // Toque: 1º toque revela os metadados, 2º abre o lightbox.
      if (lastPointerType === 'touch' && activeTouchCard !== fig) {
        activeTouchCard?.classList.remove('is-active');
        activeTouchCard = fig;
        fig.classList.add('is-active');
        lastPointerType = 'mouse';
        return;
      }
      lastPointerType = 'mouse';
      openLightbox(i, btn);
    });

    if (canTilt) {
      let raf = 0;
      let rect = null;
      let px = 0;
      let py = 0;
      const apply = () => {
        raf = 0;
        fig.style.setProperty('--rx', `${(-py * 6).toFixed(2)}deg`);
        fig.style.setProperty('--ry', `${(px * 8).toFixed(2)}deg`);
        fig.style.setProperty('--mx', `${((px + 1) * 50).toFixed(1)}%`);
        fig.style.setProperty('--my', `${((py + 1) * 50).toFixed(1)}%`);
      };
      fig.addEventListener('pointerenter', () => { rect = fig.getBoundingClientRect(); });
      fig.addEventListener('pointermove', (e) => {
        if (!rect) rect = fig.getBoundingClientRect();
        px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
        if (!raf) raf = requestAnimationFrame(apply);
      }, { passive: true });
      fig.addEventListener('pointerleave', () => {
        rect = null;
        cancelAnimationFrame(raf);
        raf = 0;
        fig.style.setProperty('--rx', '0deg');
        fig.style.setProperty('--ry', '0deg');
      });
    }
  });

  // Toque fora de um card ativo: recolhe os metadados.
  document.addEventListener('pointerdown', (e) => {
    if (activeTouchCard && !activeTouchCard.contains(e.target)) {
      activeTouchCard.classList.remove('is-active');
      activeTouchCard = null;
    }
  }, { passive: true });

  /* Dica "deslize" some após a primeira rolagem do carrossel. */
  const viewport = section.querySelector('.gallery__viewport');
  viewport.addEventListener('scroll', () => section.classList.add('has-scrolled'), { passive: true, once: true });

  /* ================================================================
   * LIGHTBOX
   * ================================================================ */
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-labelledby', 'lightbox-caption');
  lb.hidden = true;
  lb.innerHTML = `
    <div class="lightbox__backdrop" data-close></div>
    <div class="lightbox__stage">
      <figure class="lightbox__figure">
        <div class="lightbox__frame"><img class="lightbox__img" alt="" decoding="async" draggable="false"></div>
        <figcaption class="lightbox__meta">
          <span class="lightbox__facts"></span>
          <span class="lightbox__caption" id="lightbox-caption"></span>
        </figcaption>
      </figure>
    </div>
    <button type="button" class="lightbox__btn lightbox__close" aria-label="Fechar">${ICON_CLOSE}</button>
    <button type="button" class="lightbox__btn lightbox__nav lightbox__nav--prev" aria-label="Foto anterior">${ICON_PREV}</button>
    <button type="button" class="lightbox__btn lightbox__nav lightbox__nav--next" aria-label="Próxima foto">${ICON_NEXT}</button>
    <p class="lightbox__count" aria-live="polite"></p>
  `;
  document.body.appendChild(lb);

  const lbImg = lb.querySelector('.lightbox__img');
  const lbFrame = lb.querySelector('.lightbox__frame');
  const lbFacts = lb.querySelector('.lightbox__facts');
  const lbCaption = lb.querySelector('.lightbox__caption');
  const lbCount = lb.querySelector('.lightbox__count');
  const btnClose = lb.querySelector('.lightbox__close');
  const btnPrev = lb.querySelector('.lightbox__nav--prev');
  const btnNext = lb.querySelector('.lightbox__nav--next');

  let current = -1;
  let opener = null;
  let busy = false;
  const DUR_OPEN = reducedMotion ? 0 : 620;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';

  const cardImg = (i) => cards[i].querySelector('img');

  function fillMeta(i) {
    const it = items[i];
    lbImg.src = it.src;
    lbImg.alt = it.alt || '';
    lbFacts.innerHTML = [
      it.date ? `<span class="g-card__fact">${ICON_CAL}${esc(it.date)}</span>` : '',
      it.place ? `<span class="g-card__fact">${ICON_PIN}${esc(it.place)}</span>` : '',
    ].join('');
    lbCaption.textContent = it.caption || it.alt || '';
    lbCount.textContent = `${i + 1} / ${items.length}`;
    const single = items.length < 2;
    btnPrev.hidden = single;
    btnNext.hidden = single;
  }

  /** Transform + clip-path que fazem o frame do lightbox coincidir com o card (object-fit: cover). */
  function flipFrom(i) {
    const src = cardImg(i).getBoundingClientRect();
    const dst = lbFrame.getBoundingClientRect();
    if (!src.width || !dst.width || src.bottom < 0 || src.top > window.innerHeight) return null;
    const s = Math.max(src.width / dst.width, src.height / dst.height);
    const dx = src.left + src.width / 2 - (dst.left + dst.width / 2);
    const dy = src.top + src.height / 2 - (dst.top + dst.height / 2);
    const ix = Math.max(0, (dst.width - src.width / s) / 2);
    const iy = Math.max(0, (dst.height - src.height / s) / 2);
    const r = 18 / s;
    return {
      transform: `translate(${dx}px, ${dy}px) scale(${s})`,
      clipPath: `inset(${iy}px ${ix}px round ${r}px)`,
    };
  }

  const lockScroll = (on) => {
    const root = document.documentElement;
    if (on) {
      const sb = window.innerWidth - root.clientWidth;
      root.style.setProperty('--scrollbar-comp', `${sb}px`);
      root.classList.add('lightbox-open');
    } else {
      root.classList.remove('lightbox-open');
      root.style.removeProperty('--scrollbar-comp');
    }
    const main = document.querySelector('main');
    if (main) main.inert = on;
  };

  async function openLightbox(i, fromBtn) {
    if (busy || current !== -1) return;
    busy = true;
    current = i;
    opener = fromBtn;
    fillMeta(i);
    lockScroll(true);
    lb.hidden = false;
    try { await lbImg.decode(); } catch { /* imagem já carregada ou erro: segue */ }
    lb.classList.add('is-open');

    const from = DUR_OPEN ? flipFrom(i) : null;
    const thumb = cardImg(i);
    if (from) {
      thumb.style.visibility = 'hidden';
      const anim = lbFrame.animate(
        [from, { transform: 'none', clipPath: 'inset(0px 0px round 18px)' }],
        { duration: DUR_OPEN, easing: EASE }
      );
      anim.finished.finally(() => { thumb.style.visibility = ''; });
    }
    btnClose.focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
    setTimeout(() => { busy = false; }, DUR_OPEN);
  }

  function closeLightbox() {
    if (current === -1 || busy) return;
    busy = true;
    const i = current;
    const to = DUR_OPEN ? flipFrom(i) : null;
    const thumb = cardImg(i);
    lb.classList.remove('is-open');
    lb.classList.add('is-closing');
    const finish = () => {
      thumb.style.visibility = '';
      lb.classList.remove('is-closing');
      lb.hidden = true;
      lbFrame.getAnimations().forEach((a) => a.cancel());
      lockScroll(false);
      document.removeEventListener('keydown', onKey);
      current = -1;
      busy = false;
      const target = cards[i].querySelector('.g-card__btn') || opener;
      target?.focus({ preventScroll: true });
      opener = null;
    };
    if (to) {
      thumb.style.visibility = 'hidden';
      lbFrame
        .animate([{ transform: 'none', clipPath: 'inset(0px 0px round 18px)' }, to], {
          duration: DUR_OPEN * 0.85,
          easing: EASE,
          fill: 'forwards',
        })
        .finished.then(finish, finish);
    } else {
      setTimeout(finish, reducedMotion ? 0 : 320);
    }
  }

  function go(delta) {
    if (busy || current === -1 || items.length < 2) return;
    busy = true;
    const next = (current + delta + items.length) % items.length;
    const out = reducedMotion ? 0 : 220;
    const fig = lb.querySelector('.lightbox__figure');
    const anim = out
      ? fig.animate(
          [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-delta * 40}px) scale(.98)` }],
          { duration: out, easing: 'ease-in', fill: 'forwards' }
        )
      : null;
    const swap = async () => {
      current = next;
      fillMeta(next);
      try { await lbImg.decode(); } catch { /* noop */ }
      anim?.cancel();
      if (out) {
        await fig.animate(
          [{ opacity: 0, transform: `translateX(${delta * 40}px) scale(.98)` }, { opacity: 1, transform: 'none' }],
          { duration: out * 1.6, easing: EASE }
        ).finished.catch(() => {});
      }
      busy = false;
    };
    if (anim) anim.finished.then(swap, swap);
    else swap();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'Tab') {
      // Focus trap (fallback caso `inert` não seja suportado).
      const f = [btnClose, btnPrev, btnNext].filter((b) => !b.hidden);
      const idx = f.indexOf(document.activeElement);
      e.preventDefault();
      const n = e.shiftKey ? (idx <= 0 ? f.length - 1 : idx - 1) : (idx + 1) % f.length;
      f[n].focus();
    }
  }

  btnClose.addEventListener('click', closeLightbox);
  btnPrev.addEventListener('click', () => go(-1));
  btnNext.addEventListener('click', () => go(1));
  lb.addEventListener('click', (e) => {
    // Clique fora da foto (backdrop ou área vazia do palco) fecha.
    if (e.target.hasAttribute('data-close') || e.target.classList.contains('lightbox__stage')) closeLightbox();
  });

  /* Swipe (touch/caneta) */
  let sx = 0, sy = 0, st = 0, tracking = false;
  const stage = lb.querySelector('.lightbox__stage');
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    tracking = true; sx = e.clientX; sy = e.clientY; st = performance.now();
  }, { passive: true });
  stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    const fast = performance.now() - st < 600;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3 && fast) go(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) closeLightbox(); // arrastar p/ baixo fecha
  }, { passive: true });
  stage.addEventListener('pointercancel', () => { tracking = false; }, { passive: true });
}
