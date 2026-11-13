/**
 * main.js — ponto de entrada. Liga o loop, aplica configurações globais e
 * inicializa cada módulo de forma isolada (se um falhar, os outros seguem).
 */
import { CONFIG } from './config.js';
import { startLoop, remeasure, observeReveal } from './core.js';

/*
 * Os módulos de recurso são importados dinamicamente: assim, um erro de
 * sintaxe ou falha de rede em UM arquivo não impede os demais de rodar
 * (com import estático, o main.js inteiro deixaria de executar).
 * A ordem abaixo é a ordem de inicialização.
 */
const MODULES = ['hearts3d', 'hero', 'story', 'gallery', 'counter', 'messages', 'confetti', 'floating'];

/** Executa init() de um módulo sem deixar um erro derrubar a página. */
function safeInit(name, mod) {
  try {
    if (typeof mod?.init === 'function') mod.init(CONFIG);
  } catch (err) {
    console.warn(`[main] o módulo "${name}" falhou ao iniciar:`, err);
  }
}

/** Ajustes globais vindos do config. */
function applyGlobals() {
  const bpm = Number(CONFIG.counter?.bpm) || 72;
  document.documentElement.style.setProperty('--heartbeat', `${(60 / bpm).toFixed(3)}s`);

  // Texto do rodapé
  const footerText = document.querySelector('.site-footer__text');
  if (footerText && CONFIG.footer?.text) footerText.textContent = CONFIG.footer.text;

  // Título da aba com os nomes do casal
  const { nameA, nameB } = CONFIG.couple || {};
  if (nameA && nameB) document.title = `${nameA} & ${nameB} · Nosso pra sempre`;
}

async function boot() {
  applyGlobals();
  startLoop();

  // Baixa todos em paralelo; hearts3d depende do Three.js via CDN — se falhar,
  // o resto da página continua normalmente.
  const loaded = await Promise.allSettled(MODULES.map((name) => import(`./${name}.js`)));

  loaded.forEach((result, i) => {
    const name = MODULES[i];
    if (result.status === 'fulfilled') safeInit(name, result.value);
    else console.warn(`[main] não foi possível carregar "${name}.js":`, result.reason);
  });

  // Garante que qualquer [data-reveal] estático também seja observado.
  observeReveal(document.body);
  remeasure();
}

boot();

// Imagens/vídeos mudam a altura da página ao carregar: recalcula.
window.addEventListener('load', () => remeasure());
