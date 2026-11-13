/**
 * hearts3d.js — campo infinito de corações 3D (Three.js) atrás de todo o conteúdo.
 *
 * - UM InstancedMesh (1 draw call) com cor por instância.
 * - Idle: flutuação orgânica lenta (fase, deriva e rotação próprias por coração).
 * - Scroll: scrollState.energy deixa tudo mais "agitado" (rotação, turbulência,
 *   vento vertical); ao parar, volta suavemente à calma.
 * - Parallax por profundidade + wrap vertical → campo infinito.
 * - Parallax sutil da câmera com o ponteiro.
 * - DPR limitado, pausa quando a aba está oculta, falha silenciosa sem WebGL.
 *
 * PERSONALIZAR: veja o objeto TUNING logo abaixo.
 */
import * as THREE from 'three';
import { scrollState, pointer, onFrame, reducedMotion } from './core.js';

/* ------------------------------------------------------------------ */
/* Ajustes finos (customize aqui)                                      */
/* ------------------------------------------------------------------ */
const TUNING = {
  countDesktop: 60,
  countMobile: 28,
  countReduced: 14,
  palette: ['#ffc0cb', '#f7a8b8', '#ffd3dc'], // tons rosados
  accent: '#dc143c',                          // vermelho de destaque
  accentRatio: 0.2,                           // ~20% vermelhos
  bg: '#fffaf8',                              // cor do fog = fundo da página
  zNear: 3,                                   // faixa de profundidade dos corações
  zFar: -16,
  cameraZ: 10,
  fov: 45,
  riseSpeed: 0.12,        // subida lenta contínua (unid./s)
  rotBoost: 5,            // multiplicador extra de rotação em energia máxima
  turbulence: 0.55,       // amplitude da turbulência em energia máxima
  windStrength: 2.4,      // "vento" vertical na direção do fluxo do scroll
  // +1: corações acompanham o conteúdo (sobem quando o usuário rola para baixo).
  // -1: inverte (descem quando rola para baixo).
  windDirection: 1,
  parallaxMin: 0.12,      // fração do deslocamento do conteúdo para corações distantes
  parallaxMax: 0.65,      // ... e para corações próximos
  pointerCam: { x: 0.6, y: 0.35 },
};

/** Retorna true se WebGL estiver disponível. */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/** Geometria de coração: THREE.Shape → ExtrudeGeometry com bevel, centralizada. */
function createHeartGeometry(lowPoly) {
  const s = new THREE.Shape();
  // Curva clássica de coração (ponta para cima; giramos depois).
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 3.5,
    bevelEnabled: true,
    bevelThickness: 2.2,
    bevelSize: 1.6,
    bevelSegments: lowPoly ? 2 : 4,
    curveSegments: lowPoly ? 10 : 18,
  });
  geo.center();
  geo.rotateZ(Math.PI);      // ponta para baixo
  geo.scale(1 / 20, 1 / 20, 1 / 20); // ~1.1 unidade de largura
  return geo;
}

export function init(CONFIG = {}) {
  const canvas = document.getElementById('hearts-canvas');
  if (!canvas) return;
  // Sem WebGL: lança para o main.js capturar (e a página segue sem corações 3D).
  if (!hasWebGL()) throw new Error('[hearts3d] WebGL indisponível');

  const mobile = (scrollState.vw || window.innerWidth) < 768;
  const DPR_CAP = mobile ? 1.25 : 1.75;
  const COUNT = reducedMotion ? TUNING.countReduced : mobile ? TUNING.countMobile : TUNING.countDesktop;

  /* ---------------- Renderer / cena / câmera ---------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,               // fundo transparente: a página aparece por trás
    antialias: !mobile,
    powerPreference: 'default',
    stencil: false,
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));

  const scene = new THREE.Scene();
  // Fog na cor do fundo: corações distantes "somem" suavemente no papel.
  scene.fog = new THREE.Fog(TUNING.bg, TUNING.cameraZ - 1, TUNING.cameraZ - TUNING.zFar + 4);

  const camera = new THREE.PerspectiveCamera(TUNING.fov, 1, 0.1, 60);
  camera.position.set(0, 0, TUNING.cameraZ);
  const lookTarget = new THREE.Vector3(0, 0, -4);

  /* ---------------- Luzes suaves ---------------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffc0cb, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 7);
  scene.add(key);
  const pinkFill = new THREE.PointLight(0xff8fa8, 40, 0, 2);
  pinkFill.position.set(-5, -3, 5);
  scene.add(pinkFill);

  /* ---------------- Malha instanciada ---------------- */
  const geometry = createHeartGeometry(mobile || reducedMotion);
  const material = mobile
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 })
    : new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.4,
        metalness: 0,
        clearcoat: 0.55,
        clearcoatRoughness: 0.35,
        sheen: 1,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#ffd6de'),
      });

  const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // as instâncias se movem pelo campo todo
  scene.add(mesh);

  /* ---------------- Estado por coração (SoA, sem GC por frame) ---------------- */
  const bx = new Float32Array(COUNT); // posição base (acumula deriva/parallax)
  const by = new Float32Array(COUNT);
  const bz = new Float32Array(COUNT);
  const sc = new Float32Array(COUNT); // escala
  const ph = new Float32Array(COUNT); // fase
  const rise = new Float32Array(COUNT);
  const rx = new Float32Array(COUNT); // rotação acumulada
  const ry = new Float32Array(COUNT);
  const rz = new Float32Array(COUNT);
  const sx = new Float32Array(COUNT); // velocidades de rotação
  const sy = new Float32Array(COUNT);
  const sz = new Float32Array(COUNT);
  const near = new Float32Array(COUNT); // 0 = longe, 1 = perto

  const rand = (a, b) => a + Math.random() * (b - a);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(TUNING.fov / 2));
  // Meia-altura visível no plano z (para wrap e conversão px → mundo).
  const halfH = (z) => tanHalf * (TUNING.cameraZ - z);

  const color = new THREE.Color();
  const white = new THREE.Color('#ffffff');
  for (let i = 0; i < COUNT; i++) {
    const z = rand(TUNING.zFar, TUNING.zNear);
    const h = halfH(z);
    bz[i] = z;
    by[i] = rand(-h, h);
    bx[i] = rand(-1, 1); // multiplicado pela meia-largura no frame (depende do aspect)
    near[i] = (z - TUNING.zFar) / (TUNING.zNear - TUNING.zFar);
    sc[i] = rand(0.45, 1.0) * (reducedMotion ? 1.1 : 1);
    ph[i] = rand(0, Math.PI * 2);
    rise[i] = TUNING.riseSpeed * rand(0.5, 1.4);
    rx[i] = rand(-0.4, 0.4);
    ry[i] = rand(0, Math.PI * 2);
    rz[i] = rand(-0.3, 0.3);
    sx[i] = rand(-0.25, 0.25);
    sy[i] = rand(0.2, 0.6) * (Math.random() < 0.5 ? -1 : 1);
    sz[i] = rand(-0.2, 0.2);

    if (Math.random() < TUNING.accentRatio) color.set(TUNING.accent);
    else color.set(TUNING.palette[(Math.random() * TUNING.palette.length) | 0]);
    color.lerp(white, rand(0, 0.12)); // leve variação
    mesh.setColorAt(i, color);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  /* ---------------- Resize ---------------- */
  let vw = 0;
  let vh = 0;
  let aspect = 1;
  function resize(force = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Em mobile a barra de URL muda a altura a todo momento: ignora variações pequenas.
    if (!force && w === vw && Math.abs(h - vh) < 120) return;
    vw = w;
    vh = h;
    aspect = w / Math.max(1, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
    renderer.setSize(w, h, false); // CSS do canvas já é fullscreen
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  resize(true);
  let resizeQueued = false;
  window.addEventListener(
    'resize',
    () => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        resize();
      });
    },
    { passive: true }
  );

  /* ---------------- Loop ---------------- */
  const m4 = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scl = new THREE.Vector3();

  let energy = 0;     // energia suavizada localmente (subida rápida, descida lenta)
  let flowT = 0;      // "tempo de fluxo": acelera com a energia sem saltos de fase
  let lastScrollY = scrollState.y || window.scrollY || 0;
  const motionScale = reducedMotion ? 0.12 : 1;

  function update(dt) {
    // dt pode vir em ms ou s dependendo do core: normaliza para segundos.
    if (!(dt > 0)) dt = 1 / 60;
    else if (dt > 1) dt /= 1000;
    dt = Math.min(dt, 1 / 20); // evita saltos após travadas

    // Energia: sobe rápido ao rolar, relaxa devagar ao parar.
    const target = reducedMotion ? 0 : scrollState.energy || 0;
    const k = target > energy ? 6 : 1.4;
    energy += (target - energy) * (1 - Math.exp(-dt * k));

    flowT += dt * (1 + energy * 2.5) * motionScale;

    // Deslocamento de scroll deste frame (px) → parallax por profundidade.
    const sy_ = scrollState.y || 0;
    let dScroll = sy_ - lastScrollY;
    lastScrollY = sy_;
    if (Math.abs(dScroll) > vh) dScroll = 0; // saltos (âncoras) não "teleportam" o campo

    // Vento: na direção do fluxo do scroll, proporcional à velocidade com sinal.
    const vel = reducedMotion ? 0 : scrollState.velocity || 0;
    const wind = THREE.MathUtils.clamp(vel / 40, -1, 1) * TUNING.windStrength * TUNING.windDirection;

    const rotMul = (1 + energy * TUNING.rotBoost) * motionScale;
    const turb = TUNING.turbulence * energy;

    for (let i = 0; i < COUNT; i++) {
      const z = bz[i];
      const h = halfH(z);
      const hw = h * aspect;
      const n = near[i];

      // Parallax: conteúdo sobe dScroll px; corações sobem uma fração (maior se perto).
      const worldPerPx = (2 * h) / Math.max(1, vh);
      const par = TUNING.parallaxMin + (TUNING.parallaxMax - TUNING.parallaxMin) * n;
      by[i] += dScroll * worldPerPx * par * (reducedMotion ? 0.5 : 1);

      // Subida suave contínua + vento do scroll (mais forte nos próximos).
      by[i] += (rise[i] * motionScale + wind * (0.4 + 0.6 * n)) * dt;

      // Wrap vertical → campo infinito.
      const lim = h + 1.4;
      if (by[i] > lim) by[i] -= 2 * lim;
      else if (by[i] < -lim) by[i] += 2 * lim;

      // Bobbing idle + turbulência dependente da energia (ruído barato com senos).
      const p = ph[i];
      const bob = Math.sin(flowT * 0.9 + p) * 0.18;
      const sway = Math.sin(flowT * 0.55 + p * 1.7) * 0.22;
      const tx = turb * Math.sin(flowT * 2.3 + p * 3.1) * Math.cos(flowT * 1.1 + p);
      const ty = turb * Math.cos(flowT * 1.9 + p * 2.3);
      const tz = turb * 0.6 * Math.sin(flowT * 1.6 + p * 1.3);

      pos.set(bx[i] * (hw + 0.6) + sway + tx, by[i] + bob + ty, z + tz);

      // Rotação: giro em Y + oscilação; com energia ganha giro em X/Z também.
      ry[i] += sy[i] * dt * rotMul;
      rx[i] += sx[i] * dt * energy * 4 * motionScale;
      rz[i] += sz[i] * dt * energy * 3 * motionScale;
      euler.set(
        rx[i] + Math.sin(flowT * 0.7 + p) * 0.25,
        ry[i],
        rz[i] + Math.sin(flowT * 0.6 + p * 0.8) * 0.18
      );
      quat.setFromEuler(euler);

      const s = sc[i] * (1 + Math.sin(flowT * 1.2 + p) * 0.03); // "respiração"
      scl.set(s, s, s);
      m4.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Parallax sutil da câmera com o ponteiro (lerp exponencial).
    const camK = 1 - Math.exp(-dt * 2.5);
    const px = reducedMotion ? 0 : (pointer.x || 0) * TUNING.pointerCam.x;
    const py = reducedMotion ? 0 : (pointer.y || 0) * TUNING.pointerCam.y;
    camera.position.x += (px - camera.position.x) * camK;
    camera.position.y += (py - camera.position.y) * camK;
    camera.lookAt(lookTarget);
  }

  onFrame((dt) => {
    if (document.hidden) return; // aba oculta: não renderiza
    update(dt);
    renderer.render(scene, camera);
  });

  // Ao voltar para a aba, evita um "salto" de parallax acumulado.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastScrollY = scrollState.y || window.scrollY || 0;
  });

  // Contexto WebGL perdido: apenas esconde o canvas (falha silenciosa).
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    canvas.style.opacity = '0';
  });
}
