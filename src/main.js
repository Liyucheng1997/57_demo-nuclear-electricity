import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Atom,
  Factory,
  Fan,
  Gauge,
  Pause,
  Play,
  Radiation,
  RotateCcw,
  SlidersHorizontal,
  Snowflake,
  Thermometer,
  Waves,
  Zap,
  createIcons,
} from 'lucide';

import { COLORS } from './core/materials.js';
import { Registry } from './core/registry.js';
import { buildReactorBuilding } from './plant/reactorBuilding.js';
import { buildTurbineIsland, buildTurbinePiping } from './plant/turbineIsland.js';
import { buildCirculatingWater, buildCoolingTower, buildGrid } from './plant/coolingAndGrid.js';
import { buildAuxiliary, buildEnvironment, buildLights, buildPlantPiping, buildTurbineHall } from './plant/site.js';
import { FissionScene } from './fission/fissionScene.js';
import { ENERGY_NODES, STEPS } from './data/steps.js';

const icons = { Atom, Factory, Fan, Gauge, Pause, Play, Radiation, RotateCcw, SlidersHorizontal, Snowflake, Thermometer, Waves, Zap };
const $ = (s) => document.querySelector(s);

/* ------------------------------------------------------------------ */
/* 渲染器与后期                                                        */
/* ------------------------------------------------------------------ */
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x16202c, 0.0055);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.3, 900);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 3;
controls.maxDistance = 150;
controls.screenSpacePanning = true;

const labelLayers = ['plant', 'micro'].map((name) => {
  const r = new CSS2DRenderer();
  r.setSize(window.innerWidth, window.innerHeight);
  r.domElement.className = `label-layer ${name}`;
  $('#app').appendChild(r.domElement);
  return r;
});
const [plantLabels, microLabels] = labelLayers;

/* ------------------------------------------------------------------ */
/* 构建场景                                                            */
/* ------------------------------------------------------------------ */
const reg = new Registry();
buildEnvironment(scene);
buildLights(scene);
scene.add(buildReactorBuilding(reg));
scene.add(buildTurbineIsland(reg));
scene.add(buildTurbineHall(reg));
scene.add(buildAuxiliary(reg));
scene.add(buildCoolingTower(reg));
scene.add(buildGrid(reg));
const piping = new THREE.Group();
scene.add(piping);
buildTurbinePiping(reg, piping);
buildPlantPiping(reg, piping);
buildCirculatingWater(reg, piping);

const micro = new FissionScene();

const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
const outlinePass = new OutlinePass(size.clone(), scene, camera);
outlinePass.edgeStrength = 4;
outlinePass.edgeGlow = 0.6;
outlinePass.edgeThickness = 1.6;
outlinePass.visibleEdgeColor.set('#ffcf5a');
outlinePass.hiddenEdgeColor.set('#5a4210');
const bloomPass = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.55, 0.4, 1.0);
composer.addPass(renderPass);
composer.addPass(outlinePass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

/* ------------------------------------------------------------------ */
/* 运行仿真：控制棒 → 裂变功率 → 热功率（含衰变热）→ 汽轮机 → 电功率  */
/* ------------------------------------------------------------------ */
const sim = {
  rod: 0.25,
  rodTarget: 0.25,
  fission: 1,
  decay: 0.065,
  power: 1,
  scram: false,
  online: true,
  turbine: 1,
  electric: 1,
  hotColor: COLORS.hot.clone(),
  time: 0,
  step: 0,
  trend: 0,
};
const RATED = { thermal: 3210, electric: 1080 };

function fissionTarget(rod) {
  return THREE.MathUtils.clamp((0.85 - rod) / 0.6, 0, 1.08);
}

function updateSim(dt) {
  const rate = sim.scram ? 2.5 : 0.3;
  sim.rod += THREE.MathUtils.clamp(sim.rodTarget - sim.rod, -rate * dt, rate * dt);
  const target = fissionTarget(sim.rod);
  const tau = target < sim.fission ? (sim.scram ? 0.35 : 1.2) : 2.4;
  const before = sim.fission;
  sim.fission += (target - sim.fission) * (1 - Math.exp(-dt / tau));
  sim.trend = dt > 0 ? (sim.fission - before) / dt : sim.trend;
  // 衰变热：停堆后仍有约 6.5% 的余热，缓慢衰减
  const decayTarget = 0.065 * sim.fission;
  sim.decay += (decayTarget - sim.decay) * (1 - Math.exp(-dt / (decayTarget < sim.decay ? 30 : 3)));
  sim.power = sim.fission * 0.935 + sim.decay;
  if (sim.online && sim.power < 0.1) sim.online = false;
  if (!sim.online && sim.power > 0.16 && !sim.scram) sim.online = true;
  sim.turbine += ((sim.online ? 1 : 0) - sim.turbine) * (1 - Math.exp(-dt / (sim.online ? 2.5 : 6)));
  sim.electric = sim.online ? Math.min(1.08, sim.power) : 0;
  sim.hotColor.copy(COLORS.cold).lerp(COLORS.hot, Math.pow(THREE.MathUtils.clamp(sim.power, 0, 1), 0.7));
}

/* ------------------------------------------------------------------ */
/* 阶段切换、高亮与镜头                                                */
/* ------------------------------------------------------------------ */
let currentStep = 0;
let running = true;
let animSpeed = 1;
let showLabels = true;
let showShells = true;
let tour = false;
let tourTimer = 0;
let tween = null;
let microActive = false;
let fadeTimer = null;

function viewShift() {
  const w = window.innerWidth;
  if (w < 1000) return 0;
  const left = $('#info-panel').getBoundingClientRect().right;
  const right = w - $('#control-panel').getBoundingClientRect().left;
  return (left - right) / 2;
}

function applyViewOffset() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shift = viewShift();
  [camera, micro.camera].forEach((cam) => {
    cam.aspect = w / h;
    if (shift) cam.setViewOffset(w, h, -shift, -12, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  });
}

function cameraFor(step) {
  const cam = STEPS[step].camera || STEPS[0].camera;
  if (window.innerWidth < 700) {
    const dir = cam.pos.clone().sub(cam.target);
    return { pos: cam.target.clone().add(dir.multiplyScalar(1.45)), target: cam.target.clone() };
  }
  return { pos: cam.pos.clone(), target: cam.target.clone() };
}

function flyTo(step, instant = false) {
  const { pos, target } = cameraFor(step);
  if (instant) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
    tween = null;
    return;
  }
  tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), pos, target, t: 0, duration: 1.8 };
}

function setMicro(active) {
  if (active === microActive) return;
  const fade = $('#fade');
  fade.classList.add('on');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    microActive = active;
    renderPass.scene = active ? micro.scene : scene;
    renderPass.camera = active ? micro.camera : camera;
    outlinePass.enabled = !active;
    bloomPass.strength = active ? 0.9 : 0.55;
    bloomPass.threshold = active ? 0.6 : 1.0;
    document.body.classList.toggle('micro-mode', active);
    fade.classList.remove('on');
  }, 260);
}

// 透视（X 光）模式：暂时把遮挡视线的设备换成半透明材质
const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0x9cc6ee, transparent: true, opacity: 0.09, depthWrite: false, roughness: 0.5 });
let ghosted = [];

function applyGhost(names = []) {
  ghosted.forEach((m) => {
    m.material = m.userData.solidMaterial;
    m.castShadow = m.userData.solidCast;
  });
  ghosted = [];
  names.forEach((name) => reg.group(name).objects.forEach((root) => root.traverse((c) => {
    if (!c.isMesh || c.userData.solidMaterial && ghosted.includes(c)) return;
    c.userData.solidMaterial = c.material;
    c.userData.solidCast = c.castShadow;
    c.material = Array.isArray(c.material) ? c.material.map(() => ghostMaterial) : ghostMaterial;
    c.castShadow = false;
    ghosted.push(c);
  })));
}

function setStep(index, { instant = false } = {}) {
  currentStep = (index + STEPS.length) % STEPS.length;
  const step = STEPS[currentStep];
  sim.step = currentStep;
  tourTimer = 0;
  setMicro(Boolean(step.micro));
  if (!step.micro) flyTo(currentStep, instant);

  const active = step.fluids ? new Set(step.fluids) : null;
  reg.fluids.forEach((f) => {
    f.targetDim = !active || active.has(f.group) ? 1 : 0.18;
  });
  reg.streams.forEach((s) => {
    s.targetDim = !active || active.has(s.group) ? 1 : 0.15;
  });
  const outlined = [];
  (step.outline || []).forEach((name) => outlined.push(...reg.group(name).objects));
  outlinePass.selectedObjects = outlined;
  applyGhost(step.ghost);
  reg.stepVisible.forEach(({ object, steps }) => {
    object.visible = steps.includes(currentStep);
  });
  reg.labels.forEach(({ element, steps }) => {
    element.classList.toggle('hidden', !steps.includes(currentStep));
  });
  document.body.classList.toggle('overview', currentStep === 0);
  renderStepUI();
}

/* ------------------------------------------------------------------ */
/* 界面                                                                */
/* ------------------------------------------------------------------ */
function buildUI() {
  $('#step-tabs').innerHTML = STEPS.map(
    (s, i) => `<button class="step-tab" data-step="${i}" title="${s.title}"><i data-lucide="${s.icon}"></i><span>${s.tab}</span></button>`,
  ).join('');
  $('#energy-chain').innerHTML = ENERGY_NODES.map(
    (n, i) => `${i === 5 ? '<i class="chain-split"></i>' : i > 0 ? '<i class="chain-arrow"></i>' : ''}<div class="chain-node ${n.id}" data-node="${n.id}"><strong>${n.label}</strong><span>${n.sub}</span><em id="chain-${n.id}"></em></div>`,
  ).join('');
  createIcons({ icons });

  document.querySelectorAll('.step-tab').forEach((el) => el.addEventListener('click', () => {
    stopTour();
    setStep(Number(el.dataset.step));
  }));
  $('#prev-step').addEventListener('click', () => {
    stopTour();
    setStep(currentStep - 1);
  });
  $('#next-step').addEventListener('click', () => {
    stopTour();
    setStep(currentStep + 1);
  });

  $('#rod').addEventListener('input', (e) => {
    sim.scram = false;
    sim.rodTarget = Number(e.target.value) / 100;
  });
  $('#scram').addEventListener('click', () => {
    sim.scram = !sim.scram;
    if (sim.scram) sim.rodTarget = 1;
    else sim.rodTarget = 0.25;
    $('#rod').value = Math.round(sim.rodTarget * 100);
  });
  $('#speed').addEventListener('input', (e) => {
    animSpeed = Number(e.target.value);
  });
  $('#toggle-run').addEventListener('click', toggleRun);
  $('#reset-view').addEventListener('click', () => flyTo(currentStep));
  $('#t-labels').addEventListener('change', (e) => {
    showLabels = e.target.checked;
    document.body.classList.toggle('no-labels', !showLabels);
  });
  $('#t-shells').addEventListener('change', (e) => {
    showShells = e.target.checked;
    reg.shells.forEach((s) => {
      s.visible = showShells;
    });
  });
  $('#t-tour').addEventListener('change', (e) => {
    tour = e.target.checked;
    tourTimer = 0;
  });
  $('#panel-toggle').addEventListener('click', () => document.body.classList.toggle('show-controls'));
}

function stopTour() {
  tour = false;
  $('#t-tour').checked = false;
}

function toggleRun() {
  running = !running;
  $('#toggle-run').innerHTML = `<i data-lucide="${running ? 'pause' : 'play'}"></i>`;
  createIcons({ icons });
}

function renderStepUI() {
  const step = STEPS[currentStep];
  $('#step-index').textContent = `${String(currentStep + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
  $('#step-energy').textContent = step.energy;
  $('#step-title').textContent = step.title;
  $('#step-desc').textContent = step.description;
  $('#step-points').innerHTML = step.points.map((p) => `<li>${p}</li>`).join('');
  $('#step-facts').innerHTML = step.facts.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');
  document.querySelectorAll('.step-tab').forEach((el) => el.classList.toggle('active', Number(el.dataset.step) === currentStep));
  document.querySelectorAll('.chain-node').forEach((el) => el.classList.toggle('active', step.energyNodes.includes(el.dataset.node)));
  $('#info-panel').scrollTop = 0;
}

let uiTimer = 0;
function updateMetrics() {
  const p = sim.power;
  $('#rod-value').textContent = `${Math.round(sim.rod * 100)}%`;
  $('#m-power').textContent = `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;
  $('#m-power-bar').style.width = `${Math.min(100, (p / 1.08) * 100)}%`;
  $('#m-power-bar').classList.toggle('over', p > 1.01);
  $('#m-thermal').textContent = `${Math.round(RATED.thermal * p)} MWt`;
  $('#m-electric').textContent = `${Math.round(RATED.electric * sim.electric)} MWe`;
  $('#m-thot').textContent = `${(292 + 35 * Math.min(1.08, p)).toFixed(0)} °C`;
  $('#m-tcold').textContent = `292 °C`;
  $('#m-rpm').textContent = `${Math.round(1500 * sim.turbine)} r/min`;
  if (sim.online) {
    $('#m-extra-label').textContent = '电网频率';
    $('#m-extra').textContent = '50.0 Hz';
  } else {
    $('#m-extra-label').textContent = '衰变余热';
    $('#m-extra').textContent = `${Math.round(RATED.thermal * sim.decay)} MW`;
  }
  const badge = $('#reactivity');
  let text = '临界 · 功率稳定';
  let cls = 'ok';
  if (sim.scram && sim.fission < 0.02) {
    text = '已停堆 · 衰变热持续冷却';
    cls = 'warn';
  } else if (sim.trend > 0.004) {
    text = '超临界 · 功率上升';
    cls = 'up';
  } else if (sim.trend < -0.004) {
    text = '次临界 · 功率下降';
    cls = 'down';
  } else if (sim.fission < 0.02) {
    text = '次临界 · 反应堆停闭';
    cls = 'warn';
  } else if (sim.fission > 1.02) {
    text = '超功率运行 · 注意';
    cls = 'up';
  }
  badge.textContent = text;
  badge.className = `badge ${cls}`;
  $('#scram').classList.toggle('active', sim.scram);
  $('#scram').textContent = sim.scram ? '复位启堆' : '紧急停堆';

  $('#chain-nuclear').textContent = `${Math.round(RATED.thermal * sim.fission * 0.935)} MW`;
  $('#chain-primary').textContent = `${Math.round(RATED.thermal * p)} MW`;
  $('#chain-steam').textContent = `${Math.round(RATED.thermal * p * 0.99)} MW`;
  $('#chain-mechanical').textContent = `${Math.round(RATED.electric * sim.electric / 0.989)} MW`;
  $('#chain-electric').textContent = `${Math.round(RATED.electric * sim.electric)} MW`;
  $('#chain-waste').textContent = `${Math.round(RATED.thermal * p - RATED.electric * sim.electric)} MW`;

  if (microActive) {
    $('#ms-neutrons').textContent = micro.stats.neutrons;
    $('#ms-rate').textContent = `${micro.stats.rate.toFixed(1)} /s`;
    $('#ms-total').textContent = micro.stats.fissions;
  }
}

/* ------------------------------------------------------------------ */
/* 交互：点击设备跳转、键盘                                            */
/* ------------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downAt = null;

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(reg.pickables, true);
  for (const hit of hits) {
    let o = hit.object;
    while (o && o.userData.step === undefined) o = o.parent;
    if (o && o.visible) return o.userData.step;
  }
  return undefined;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt || microActive) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5) return;
  const step = pick(e);
  if (step !== undefined && step !== currentStep) {
    stopTour();
    setStep(step);
  }
});
let hoverTimer = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (microActive || performance.now() - hoverTimer < 90) return;
  hoverTimer = performance.now();
  renderer.domElement.style.cursor = pick(e) !== undefined ? 'pointer' : '';
});
controls.addEventListener('start', () => {
  tween = null;
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') setStep(currentStep + 1);
  if (e.key === 'ArrowLeft') setStep(currentStep - 1);
  if (e.key === ' ') {
    e.preventDefault();
    toggleRun();
  }
});

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelLayers.forEach((l) => l.setSize(w, h));
  applyViewOffset();
}
window.addEventListener('resize', onResize);

/* ------------------------------------------------------------------ */
/* 主循环                                                              */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function flowFactor(entry) {
  const steamFlow = 0.2 + 0.8 * Math.min(1, sim.power);
  switch (entry.group) {
    case 'mainSteam':
    case 'reheatSteam':
    case 'turbineSteam':
      return sim.online ? Math.min(1, sim.power) : 0.04;
    case 'feedwater':
    case 'sgSteam':
      return steamFlow;
    case 'electric':
      return sim.electric;
    case 'coolingAir':
      return 0.3 + 0.7 * Math.min(1, sim.power);
    default:
      return 1;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const realDt = Math.min(clock.getDelta(), 0.05);
  const dt = running ? realDt * animSpeed : 0;
  sim.time += dt;
  updateSim(realDt * (running ? 1 : 0));

  if (tween) {
    tween.t += realDt / tween.duration;
    const k = ease(Math.min(1, tween.t));
    camera.position.lerpVectors(tween.fromPos, tween.pos, k);
    controls.target.lerpVectors(tween.fromTarget, tween.target, k);
    if (tween.t >= 1) tween = null;
  }
  if (tour) {
    tourTimer += realDt;
    if (tourTimer > (STEPS[currentStep].micro ? 16 : 13)) setStep(currentStep + 1);
  }

  if (microActive) {
    micro.update(dt, sim);
  } else {
    reg.updaters.forEach((fn) => fn(dt, sim));
    reg.fluids.forEach((f) => {
      const factor = flowFactor(f);
      const u = f.material.uniforms;
      u.uOffset.value += (dt * f.speed * factor) / u.uSpacing.value;
      f.dim += ((f.targetDim ?? 1) - f.dim) * Math.min(1, realDt * 4);
      u.uIntensity.value = f.material.userData.baseIntensity * f.dim * (f.group === 'electric' ? 0.3 + 0.7 * sim.electric : 1);
    });
    reg.streams.forEach((s) => {
      const factor = flowFactor(s);
      s.dim += ((s.targetDim ?? 1) - s.dim) * Math.min(1, realDt * 4);
      const density = s.group === 'turbineSteam' || s.group === 'sgSteam' ? factor : 1;
      s.update(dt, { speedMul: s.kind === 'primary' || s.kind === 'cooling' ? 1 : 0.35 + 0.65 * factor, density, intensity: 1 });
    });
    controls.update();
  }

  uiTimer += realDt;
  if (uiTimer > 0.15) {
    uiTimer = 0;
    updateMetrics();
  }

  composer.render();
  if (microActive) microLabels.render(micro.scene, micro.camera);
  else plantLabels.render(scene, camera);
}

// 仅开发模式下暴露调试入口（截图脚本使用）
if (import.meta.env.DEV) window.__app = { renderer, scene, camera, reg, sim, setStep: (i) => setStep(i, { instant: true }) };
buildUI();
applyViewOffset();
setStep(0, { instant: true });
// 预编译着色器（渲染到后期缓冲时的变体），避免首帧长时间卡顿
async function warmup() {
  renderer.setRenderTarget(composer.renderTarget1);
  try {
    await renderer.compileAsync(scene, camera);
    await renderer.compileAsync(micro.scene, micro.camera);
  } catch (error) {
    console.warn(error);
  }
  renderer.setRenderTarget(null);
}
warmup().finally(() => {
  animate();
  requestAnimationFrame(() => $('#loading').classList.add('done'));
});
