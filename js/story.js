/**
 * story.js — capítulos narrativos da nossa história.
 *
 * - Cada capítulo: kicker (versalete vermelho) + texto grande serifado,
 *   revelado palavra por palavra (opacity + blur + translate) ao entrar na tela.
 * - Mídia opcional (imagem/vídeo) num card arredondado com brilho rosa e
 *   parallax leve; vídeos só tocam quando visíveis.
 * - Mídia alterna esquerda/direita no desktop; empilhada no mobile.
 * - Rastro luminoso (pontinhos + coração) seguindo o cursor dentro da seção,
 *   apenas em desktop (sem toque) e sem movimento reduzido.
 *
 * PERSONALIZAR:
 *  - Conteúdo: CONFIG.story em config.js ({ kicker, text, media? }).
 *  - Ritmo da revelação: --word-stagger em css/story.css.
 *  - Parallax da mídia: MEDIA_PARALLAX abaixo.
 *  - Rastro do cursor: TRAIL abaixo.
 */
import { scrollState, pointer, onFrame, reducedMotion, isTouch, observeReveal } from './core.js';

const MEDIA_PARALLAX = 0.08; // fração da distância ao centro da viewport

const TRAIL = {
  count: 12,      // quantidade de pontos (o primeiro é um coração)
  follow: 0.35,   // 0..1 — quanto cada ponto persegue o anterior por frame (a 60fps)
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Quebra o texto em <span class="w" style="--wi:n"> preservando espaços. */
function splitWords(target, text) {
  const words = String(text).trim().split(/\s+/);
  words.forEach((w, i) => {
    const span = el('span', 'w', w);
    span.style.setProperty('--wi', String(i));
    target.appendChild(span);
    if (i < words.length - 1) target.appendChild(document.createTextNode(' '));
  });
}

/** Cria o card de mídia (imagem ou vídeo). */
function createMedia(media, index) {
  const figure = el('figure', 'chapter__media');
  figure.setAttribute('data-reveal', '');
  figure.style.setProperty('--reveal-delay', '120ms');

  const inner = el('div', 'chapter__media-inner'); // recebe o parallax
  let node;
  if (media.type === 'video') {
    node = document.createElement('video');
    node.muted = true;
    node.defaultMuted = true;
    node.loop = true;
    node.playsInline = true;
    node.setAttribute('playsinline', '');
    node.setAttribute('muted', '');
    node.preload = 'metadata';
    if (media.poster) node.poster = media.poster;
    node.src = media.src;
    if (media.alt) node.setAttribute('aria-label', media.alt);
  } else {
    node = document.createElement('img');
    node.src = media.src;
    node.alt = media.alt || '';
    node.decoding = 'async';
    node.loading = index === 0 ? 'eager' : 'lazy';
  }
  node.className = 'chapter__asset';
  inner.appendChild(node);
  figure.appendChild(inner);
  return { figure, inner, node };
}

export function init(CONFIG = {}) {
  const section = document.getElementById('story');
  if (!section) return;
  const chapters = Array.isArray(CONFIG.story) ? CONFIG.story : [];
  if (!chapters.length) return;

  section.textContent = '';
  const container = el('div', 'container story__chapters');

  const parallaxItems = []; // { inner, top, height, visible }
  const videos = [];
  let mediaCount = 0;

  chapters.forEach((ch, i) => {
    const article = el('article', 'chapter');
    const textWrap = el('div', 'chapter__text');

    if (ch.kicker) textWrap.appendChild(el('p', 'chapter__kicker', ch.kicker));
    const body = el('p', 'chapter__body');
    body.setAttribute('aria-label', ch.text || '');
    const bodyInner = el('span', 'chapter__body-inner');
    bodyInner.setAttribute('aria-hidden', 'true');
    splitWords(bodyInner, ch.text || '');
    body.appendChild(bodyInner);
    textWrap.appendChild(body);
    article.appendChild(textWrap);

    if (ch.media && ch.media.src) {
      article.classList.add('chapter--media');
      // Alterna lados: pares com mídia à direita, ímpares à esquerda.
      if (mediaCount % 2 === 1) article.classList.add('chapter--reverse');
      const { figure, inner, node } = createMedia(ch.media, mediaCount);
      article.appendChild(figure);
      parallaxItems.push({ inner, top: 0, height: 0, visible: false, el: figure });
      if (node.tagName === 'VIDEO') videos.push(node);
      else node.addEventListener('load', scheduleMeasure, { once: true });
      mediaCount++;
    } else {
      article.classList.add('chapter--solo');
    }

    container.appendChild(article);
  });

  section.appendChild(container);

  /* ---------------- Revelação dos textos ---------------- */
  const articles = container.querySelectorAll('.chapter');
  if ('IntersectionObserver' in window) {
    const textIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            textIO.unobserve(e.target); // revela uma vez só
          }
        }
      },
      { rootMargin: '0px 0px -18% 0px', threshold: 0.15 }
    );
    articles.forEach((a) => textIO.observe(a));
  } else {
    articles.forEach((a) => a.classList.add('is-in'));
  }

  // Cards de mídia usam o [data-reveal] global do base.css.
  if (typeof observeReveal === 'function') observeReveal(section);

  /* ---------------- Vídeos: tocam só quando visíveis ---------------- */
  if (videos.length && 'IntersectionObserver' in window) {
    const videoIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target;
          if (e.isIntersecting && !reducedMotion) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.25 }
    );
    videos.forEach((v) => {
      videoIO.observe(v);
      v.addEventListener('loadedmetadata', scheduleMeasure, { once: true });
    });
  }

  /* ---------------- Parallax da mídia ---------------- */
  // Medimos posições absolutas apenas em resize/carregamento (sem leituras de
  // layout por frame); no loop usamos só scrollState.y.
  let measureQueued = false;
  function measure() {
    measureQueued = false;
    const y = window.scrollY || 0;
    for (const item of parallaxItems) {
      const r = item.el.getBoundingClientRect();
      item.top = r.top + y;
      item.height = r.height;
    }
    lastY = NaN; // força uma escrita no próximo frame
  }
  function scheduleMeasure() {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(measure);
  }

  let lastY = NaN;
  if (parallaxItems.length && !reducedMotion && 'IntersectionObserver' in window) {
    const pIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const item = parallaxItems.find((p) => p.el === e.target);
          if (item) item.visible = e.isIntersecting;
        }
      },
      { rootMargin: '15% 0px 15% 0px' }
    );
    parallaxItems.forEach((p) => pIO.observe(p.el));

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('load', scheduleMeasure, { once: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleMeasure);
    scheduleMeasure();

    onFrame(() => {
      const y = scrollState.y || 0;
      if (y === lastY) return;
      lastY = y;
      const vh = scrollState.vh || window.innerHeight;
      const center = y + vh / 2;
      for (const item of parallaxItems) {
        if (!item.visible) continue;
        const delta = item.top + item.height / 2 - center;
        const offset = -delta * MEDIA_PARALLAX;
        item.inner.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
      }
    });
  }

  /* ---------------- Rastro do cursor (desktop) ---------------- */
  if (!isTouch && !reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    initCursorTrail(section);
  }
}

/**
 * Rastro de pontinhos luminosos rosa com um coração na ponta.
 * Apenas N elementos fixos movidos por transform; o loop dorme quando a
 * seção não está sob o cursor e o rastro já esmaeceu.
 */
function initCursorTrail(section) {
  const layer = el('div', 'story-trail');
  layer.setAttribute('aria-hidden', 'true');
  const dots = [];
  for (let i = 0; i < TRAIL.count; i++) {
    const d = el('span', i === 0 ? 'story-trail__dot story-trail__dot--heart' : 'story-trail__dot');
    const s = 1 - (i / TRAIL.count) * 0.75; // pontos diminuem ao longo do rastro
    d.style.setProperty('--s', s.toFixed(3));
    d.style.setProperty('--o', (1 - i / TRAIL.count).toFixed(3));
    layer.appendChild(d);
    dots.push({ node: d, x: 0, y: 0, s });
  }
  document.body.appendChild(layer);

  let active = false;
  let idleFrames = 0;

  section.addEventListener('pointerenter', (e) => {
    // Posiciona tudo sob o cursor para o rastro não "voar" do canto.
    for (const d of dots) {
      d.x = e.clientX;
      d.y = e.clientY;
    }
    active = true;
    idleFrames = 0;
    layer.classList.add('is-active');
  });
  section.addEventListener('pointerleave', () => {
    active = false;
    layer.classList.remove('is-active'); // esmaece via CSS (opacity)
  });

  onFrame((dt) => {
    if (!active) {
      // Continua alguns frames para terminar a transição e depois dorme.
      if (idleFrames > 40) return;
      idleFrames++;
    }
    // dt em segundos ou ms → fator de seguimento independente de framerate.
    let sec = dt > 1 ? dt / 1000 : dt || 1 / 60;
    sec = Math.min(sec, 0.05);
    const k = 1 - Math.pow(1 - TRAIL.follow, sec * 60);

    const tx = pointer.clientX;
    const ty = pointer.clientY;
    if (typeof tx !== 'number' || typeof ty !== 'number') return;

    let px = tx;
    let py = ty;
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const kk = i === 0 ? Math.min(1, k * 1.6) : k;
      d.x += (px - d.x) * kk;
      d.y += (py - d.y) * kk;
      d.node.style.transform = `translate3d(${d.x.toFixed(1)}px, ${d.y.toFixed(1)}px, 0) scale(${d.s})`;
      px = d.x;
      py = d.y;
    }
  });
}
