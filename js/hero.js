/**
 * hero.js — abertura em tela cheia (100svh).
 *
 * - Fundo: vídeo (muted/loop/playsinline/autoplay/poster) sob um véu luminoso
 *   + gradiente radial rosa. Sem vídeo (ou erro): gradiente animado sutil.
 * - Título palavra por palavra (blur → nítido), subtítulo em script vermelho,
 *   linha "Kat & João" e dica de scroll com linha/coração animados.
 * - Parallax ao rolar: conteúdo sobe e esmaece (apenas transform/opacity,
 *   apenas enquanto o hero está visível).
 *
 * PERSONALIZAR: textos em CONFIG.hero / CONFIG.couple (config.js);
 * intensidades do parallax em PARALLAX abaixo; estilos em css/hero.css.
 */
import { scrollState, onFrame, reducedMotion } from './core.js';

const PARALLAX = {
  content: 0.28, // fração da altura da viewport que o conteúdo sobe ao sair
  media: 0.12,   // o fundo se move mais devagar (profundidade)
  fadeEnd: 0.75, // progresso (0..1 da altura do hero) em que o conteúdo some
};

/** Cria um elemento com classe e texto opcionais. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/** Divide um texto em palavras animáveis (<span class="hero__word" style="--i:n">). */
function splitWords(target, text, startIndex = 0) {
  const words = String(text).trim().split(/\s+/);
  words.forEach((w, i) => {
    const span = el('span', 'hero__word', w);
    span.style.setProperty('--i', String(startIndex + i));
    target.appendChild(span);
    if (i < words.length - 1) target.appendChild(document.createTextNode(' '));
  });
  return startIndex + words.length;
}

export function init(CONFIG = {}) {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const cfg = CONFIG.hero || {};
  const couple = CONFIG.couple || {};
  const title = cfg.title || 'Duas vidas, um só coração';
  const subtitle = cfg.subtitle || '';
  const hint = cfg.scrollHint || 'role devagar';

  hero.textContent = '';

  /* ---------------- Fundo ---------------- */
  const media = el('div', 'hero__media');
  media.setAttribute('aria-hidden', 'true');

  const gradient = el('div', 'hero__gradient'); // fallback (sempre presente, por baixo)
  media.appendChild(gradient);

  let video = null;
  if (cfg.video) {
    video = document.createElement('video');
    video.className = 'hero__video';
    video.muted = true;            // necessário para autoplay
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.preload = 'auto';
    if (cfg.poster) video.poster = cfg.poster;
    // Movimento reduzido: mostra apenas o poster (sem autoplay).
    if (!reducedMotion) video.autoplay = true;
    video.src = cfg.video;
    video.addEventListener('error', () => {
      hero.classList.add('hero--no-video');
      video.remove();
      video = null;
    });
    media.appendChild(video);
  } else if (cfg.poster) {
    const img = el('img', 'hero__video');
    img.src = cfg.poster;
    img.alt = '';
    img.decoding = 'async';
    media.appendChild(img);
  } else {
    hero.classList.add('hero--no-video');
  }

  const veil = el('div', 'hero__veil');
  media.appendChild(veil);
  hero.appendChild(media);

  /* ---------------- Conteúdo central ---------------- */
  const content = el('div', 'hero__content');

  if (couple.nameA || couple.nameB) {
    const names = el('p', 'hero__names hero__fade');
    names.append(
      document.createTextNode(couple.nameA || ''),
      el('span', 'hero__amp', '&'),
      document.createTextNode(couple.nameB || '')
    );
    names.style.setProperty('--d', '0');
    content.appendChild(names);
  }

  const h1 = el('h1', 'hero__title');
  h1.setAttribute('aria-label', title);
  const titleInner = el('span', 'hero__title-inner');
  titleInner.setAttribute('aria-hidden', 'true');
  const nWords = splitWords(titleInner, title);
  h1.appendChild(titleInner);
  content.appendChild(h1);

  if (subtitle) {
    const sub = el('p', 'hero__subtitle hero__fade', subtitle);
    sub.style.setProperty('--d', String(nWords + 1));
    content.appendChild(sub);
  }

  const inner = el('div', 'hero__inner'); // recebe o parallax (separado das animações de entrada)
  inner.appendChild(content);
  hero.appendChild(inner);

  /* ---------------- Dica de scroll ---------------- */
  // Wrapper externo recebe a opacidade do scroll; o interno, a animação de entrada
  // (animações CSS sobrescrevem estilos inline, por isso ficam em elementos distintos).
  const scrollHint = el('div', 'hero__hint');
  const hintInner = el('div', 'hero__hint-inner hero__fade');
  hintInner.style.setProperty('--d', String(nWords + 3));
  hintInner.append(el('span', 'hero__hint-text', hint));
  const line = el('span', 'hero__hint-line');
  line.appendChild(el('span', 'hero__hint-heart'));
  hintInner.appendChild(line);
  scrollHint.appendChild(hintInner);
  scrollHint.setAttribute('aria-hidden', 'true');
  hero.appendChild(scrollHint);

  /* ---------------- Entrada (classes CSS) ---------------- */
  // Dois rAFs garantem que o estado inicial foi pintado antes de animar.
  requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-ready')));

  /* ---------------- Visibilidade: parallax + play/pause do vídeo ---------------- */
  let inView = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (!video || reducedMotion) return;
        if (inView) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0 }
    ).observe(hero);
  }
  if (video && !reducedMotion) {
    // Alguns navegadores ignoram autoplay até o primeiro play() explícito.
    video.play().catch(() => {});
  }

  if (reducedMotion) return; // sem parallax

  let lastP = -1;
  onFrame(() => {
    if (!inView) return;
    const vh = scrollState.vh || window.innerHeight;
    const p = Math.min(1, Math.max(0, (scrollState.y || 0) / vh));
    if (Math.abs(p - lastP) < 0.0005) return; // nada mudou: sem escrita no DOM
    lastP = p;

    const fade = Math.max(0, 1 - p / PARALLAX.fadeEnd);
    inner.style.transform = `translate3d(0, ${(-p * vh * PARALLAX.content).toFixed(2)}px, 0)`;
    inner.style.opacity = fade.toFixed(3);
    media.style.transform = `translate3d(0, ${(p * vh * PARALLAX.media).toFixed(2)}px, 0)`;
    scrollHint.style.opacity = Math.max(0, 1 - p * 4).toFixed(3);
  });
}
