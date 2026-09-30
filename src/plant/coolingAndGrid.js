import * as THREE from 'three';
import { COLORS, materials, seededRandom, textures } from '../core/materials.js';
import {
  box,
  cutLathe,
  cylinder,
  cylinderBetween,
  cylinderBetweenGeometry,
  mergeGeometries,
  mesh,
  profile,
  roundedPath,
  v2,
  v3,
} from '../core/geometry.js';
import { SHAFT_Y, GEN_X } from './turbineIsland.js';

const PI = Math.PI;
export const TOWER = v3(10, 0, -27);
const TOWER_H = 22;

/* ------------------------------------------------------------------ */
/* 自然通风冷却塔（双曲线壳体）                                        */
/* ------------------------------------------------------------------ */
export function buildCoolingTower(reg) {
  const root = new THREE.Group();
  root.position.copy(TOWER);
  reg.equipment('coolingTower', root, 7);

  const a = 5.0;
  const y0 = 16;
  const b = 11.6;
  const radius = (y) => a * Math.sqrt(1 + ((y - y0) / b) ** 2);
  const outer = [];
  const inner = [];
  for (let i = 0; i <= 40; i += 1) {
    const y = 1.6 + ((TOWER_H - 1.6) * i) / 40;
    outer.push(v2(radius(y), y));
    inner.unshift(v2(radius(y) - 0.22, y));
  }
  const shellPts = profile(outer, [inner[0]], inner.slice(1));
  const shell = cutLathe(shellPts, { phiStart: 0.3 * PI, phiLength: 1.4 * PI, segments: 96, material: materials.towerShell, capMaterial: materials.concreteCut });
  shell.traverse((o) => {
    o.castShadow = o === shell.children[0];
  });
  root.add(shell);
  reg.shells.push(shell);

  // 底部人字形支柱（进风口）
  const legs = [];
  const r0 = radius(1.6) - 0.1;
  for (let i = 0; i < 36; i += 1) {
    const phi = (i / 36) * PI * 2;
    if (Math.cos(phi - 0) > Math.cos(0.3 * PI) + 0.02) continue;
    const p1 = v3(Math.sin(phi) * r0, 1.65, Math.cos(phi) * r0);
    const pa = v3(Math.sin(phi - 0.07) * (r0 + 0.2), 0, Math.cos(phi - 0.07) * (r0 + 0.2));
    const pb = v3(Math.sin(phi + 0.07) * (r0 + 0.2), 0, Math.cos(phi + 0.07) * (r0 + 0.2));
    legs.push(cylinderBetweenGeometry(pa, p1, 0.1, 6), cylinderBetweenGeometry(pb, p1, 0.1, 6));
  }
  root.add(mesh(mergeGeometries(legs), materials.concretePlain));

  // 集水池
  const basinWall = cutLathe(profile([v2(r0 + 0.3, -0.2), v2(r0 + 0.55, -0.2)], [v2(r0 + 0.55, 0.45)], [v2(r0 + 0.3, 0.45)]), { segments: 96, material: materials.concretePlain });
  root.add(basinWall);
  const basin = new THREE.Mesh(new THREE.CircleGeometry(r0 + 0.3, 64), materials.coolWater);
  basin.rotation.x = -PI / 2;
  basin.position.y = 0.3;
  basin.renderOrder = 2;
  root.add(basin);

  // 填料层与配水系统（半剖显示）
  const fill = cutLathe(profile([v2(0, 2.7), v2(radius(2.7) - 0.3, 2.7)], [v2(radius(3.8) - 0.3, 3.8)], [v2(0, 3.8)]), { phiStart: 0.3 * PI, phiLength: 1.4 * PI, segments: 64, material: materials.fill, capMaterial: materials.concreteCut });
  root.add(fill);
  const header = [];
  for (let i = 0; i < 7; i += 1) {
    const z = -6 + i * 2;
    const half = Math.sqrt(Math.max(0, (radius(4.6) - 0.5) ** 2 - z * z));
    header.push(cylinderBetweenGeometry(v3(-half, 4.6, z), v3(half, 4.6, z), 0.08, 8));
  }
  header.push(cylinderBetweenGeometry(v3(0, 4.6, -6.5), v3(0, 4.6, 6.2), 0.16, 10));
  root.add(mesh(mergeGeometries(header), materials.steel));

  // 淋水（温水下落）与湿热空气上升
  const rand = seededRandom(61);
  const rain = [];
  for (let k = 0; k < 40; k += 1) {
    const rr = Math.sqrt(rand()) * (radius(4.6) - 0.8);
    const phi = rand() * PI * 2;
    const x = Math.sin(phi) * rr;
    const z = Math.cos(phi) * rr;
    rain.push(new THREE.LineCurve3(v3(x, 4.5, z), v3(x, 0.35, z)));
  }
  reg.stream(root, {
    curves: rain,
    count: 260,
    size: 0.05,
    speed: 3.2,
    group: 'coolingWater',
    kind: 'cooling',
    colorFn: (t, pi, out) => out.copy(COLORS.coolWarm).lerp(COLORS.coolCold, t).multiplyScalar(1.5),
    sizeFn: () => 0.8,
  });
  const air = [];
  for (let k = 0; k < 24; k += 1) {
    const phi = rand() * PI * 2;
    const start = v3(Math.sin(phi) * (r0 + 1.5), 0.8, Math.cos(phi) * (r0 + 1.5));
    const mid = v3(Math.sin(phi) * (r0 - 2.5), 1.5, Math.cos(phi) * (r0 - 2.5));
    const up = v3(Math.sin(phi) * 2.5 * rand(), 12, Math.cos(phi) * 2.5 * rand());
    const top = v3(Math.sin(phi) * 3.5 * rand(), TOWER_H + 0.5, Math.cos(phi) * 3.5 * rand());
    air.push(new THREE.CatmullRomCurve3([start, mid, v3(mid.x * 0.6, 4.2, mid.z * 0.6), up, top]));
  }
  reg.stream(root, {
    curves: air,
    count: 110,
    size: 0.07,
    speed: 3.0,
    group: 'coolingAir',
    kind: 'cooling',
    colorFn: (t, pi, out) => (t < 0.35 ? out.setRGB(0.55, 0.75, 1.0) : out.setRGB(1.1, 1.0, 0.95).multiplyScalar(1 - t * 0.4)),
  });

  // 出口处的水汽羽流
  const puffs = [];
  const plume = new THREE.Group();
  plume.position.y = TOWER_H - 0.5;
  root.add(plume);
  for (let i = 0; i < 46; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.smoke, color: 0xeaf4fa, transparent: true, depthWrite: false, opacity: 0 }));
    plume.add(sprite);
    puffs.push({ sprite, age: rand() * 9, life: 9, seed: rand() });
  }
  reg.onUpdate((dt, sim) => {
    puffs.forEach((p) => {
      p.age += dt * (0.7 + sim.power * 0.5);
      if (p.age > p.life) p.age -= p.life;
      const k = p.age / p.life;
      const drift = k * 9;
      p.sprite.position.set(Math.sin(p.seed * 20) * 2.2 + drift * 0.9, k * 14, Math.cos(p.seed * 20) * 2.2 - drift * 0.2);
      const s = 5 + k * 14;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = Math.sin(Math.min(1, k * 1.4) * PI) * (0.18 + sim.power * 0.32) * (1 - k * 0.5);
      p.sprite.material.rotation = p.seed * 6 + k;
    });
  });

  reg.label(root, v3(0, TOWER_H + 1, 0), { title: '冷却塔', sub: '温水喷淋蒸发 · 余热排入大气', steps: [0, 7] });
  reg.label(root, v3(-3, 5.2, 4.5), { title: '配水与淋水', sub: '温水 ≈ 32 °C 落下降温', steps: [7], tone: 'warm' });
  reg.label(root, v3(-4.0, 0.9, 6.2), { title: '进风口', sub: '冷空气自然抽吸', steps: [7], tone: 'cool' });
  return root;
}

/* ------------------------------------------------------------------ */
/* 循环冷却水系统                                                      */
/* ------------------------------------------------------------------ */
export function buildCirculatingWater(reg, root) {
  const cold = roundedPath([
    v3(7.2, 0.4, -21.8),
    v3(3.2, 0.55, -21.8),
    v3(3.2, 0.55, 0),
    v3(4.2, 1.7, 0),
    v3(4.95, 1.7, 0),
  ], 0.8);
  reg.fluid(root, cold, { group: 'coolingWater', radius: 0.45, colorA: COLORS.coolCold, speed: 2.0, kind: 'cooling', spacing: 1.4 });
  const warm = roundedPath([
    v3(17.05, 1.7, 0),
    v3(17.9, 1.7, 0),
    v3(17.9, 0.55, -1.4),
    v3(17.9, 0.55, -20.5),
    v3(12.4, 0.55, -20.5),
    v3(12.4, 4.6, -20.5),
    v3(10.0, 4.6, -21.0),
  ], 0.8);
  reg.fluid(root, warm, { group: 'coolingWater', radius: 0.45, colorA: COLORS.coolWarm, speed: 2.0, kind: 'cooling', spacing: 1.4 });

  // 循环水泵
  const pump = new THREE.Group();
  pump.position.set(3.2, 0, -16.5);
  pump.add(box(2.2, 0.4, 2.2, materials.concretePlain, 0, 0.2, 0));
  const body = cylinder(0.62, 0.62, 1.3, materials.steel, { segments: 24 });
  body.position.y = 1.0;
  const motor = cylinder(0.55, 0.55, 1.2, materials.motor, { segments: 24 });
  motor.position.y = 2.2;
  pump.add(body, motor);
  root.add(pump);
  reg.equipment('coolingWater', pump, 7);
  reg.label(root, v3(3.2, 3.1, -16.5), { title: '循环水泵', sub: '约 40 m³/s 冷却水', steps: [7] });
}

/* ------------------------------------------------------------------ */
/* 主变压器、出线构架与输电线路                                        */
/* ------------------------------------------------------------------ */
const PYLONS = [
  { x: 46, z: -1.5, h: 16 },
  { x: 62, z: -5, h: 16 },
  { x: 78, z: -9, h: 16 },
];

function lattice(h, base, top, arms) {
  const parts = [];
  const levels = 8;
  const corner = (y) => {
    const w = base + ((top - base) * y) / h;
    return [[-w, -w], [w, -w], [w, w], [-w, w]].map(([x, z]) => v3(x, y, z));
  };
  for (let l = 0; l < levels; l += 1) {
    const y0 = (h * l) / levels;
    const y1 = (h * (l + 1)) / levels;
    const c0 = corner(y0);
    const c1 = corner(y1);
    for (let i = 0; i < 4; i += 1) {
      parts.push(cylinderBetweenGeometry(c0[i], c1[i], 0.06, 5));
      parts.push(cylinderBetweenGeometry(c0[i], c1[(i + 1) % 4], 0.025, 4));
      parts.push(cylinderBetweenGeometry(c0[(i + 1) % 4], c1[i], 0.025, 4));
      parts.push(cylinderBetweenGeometry(c1[i], c1[(i + 1) % 4], 0.03, 4));
    }
  }
  arms.forEach(({ y, span }) => {
    const c = corner(y);
    [-1, 1].forEach((s) => {
      const tip = v3(0, y, s * span);
      parts.push(cylinderBetweenGeometry(c[s > 0 ? 2 : 1], tip, 0.035, 4));
      parts.push(cylinderBetweenGeometry(c[s > 0 ? 3 : 0], tip, 0.035, 4));
      parts.push(cylinderBetweenGeometry(corner(y + 1.0)[s > 0 ? 2 : 1], tip, 0.025, 4));
    });
  });
  const peak = v3(0, h + 1.4, 0);
  corner(h).forEach((c) => parts.push(cylinderBetweenGeometry(c, peak, 0.04, 4)));
  return mergeGeometries(parts);
}

function catenary(a, b, sag, n = 24) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}

export function buildGrid(reg) {
  const root = new THREE.Group();
  reg.equipment('grid', root, 6);

  // 主变压器
  const tf = new THREE.Group();
  tf.position.set(33.6, 0, 0);
  root.add(tf);
  tf.add(box(4.2, 0.5, 4.4, materials.concretePlain, 0, 0.25, 0));
  tf.add(box(2.4, 2.8, 2.6, materials.transformer, 0, 1.9, 0));
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 5; i += 1) tf.add(box(0.1, 2.2, 0.9, materials.radiator, -0.9 + i * 0.45, 1.8, s * 1.85));
  });
  const cons = cylinder(0.32, 0.32, 2.2, materials.transformer, { segments: 20 });
  cons.rotation.x = PI / 2;
  cons.position.set(0.9, 3.95, 0);
  tf.add(cons);
  tf.add(cylinderBetween(v3(0.9, 3.3, 0.8), v3(0.9, 3.7, 0.8), 0.05, materials.steelDark));
  tf.add(cylinderBetween(v3(0.9, 3.3, -0.8), v3(0.9, 3.7, -0.8), 0.05, materials.steelDark));
  // 套管（伞裙）
  const shedPts = [v2(0, 0)];
  for (let i = 0; i < 9; i += 1) {
    shedPts.push(v2(0.14, i * 0.2 + 0.02), v2(0.24, i * 0.2 + 0.08), v2(0.14, i * 0.2 + 0.14));
  }
  shedPts.push(v2(0.08, 1.85), v2(0, 1.85));
  const bushing = new THREE.LatheGeometry(shedPts, 16);
  const hvTops = [];
  [-0.8, 0, 0.8].forEach((z) => {
    const b = mesh(bushing, materials.porcelain);
    b.position.set(0.55, 3.3, z);
    tf.add(b);
    hvTops.push(v3(33.6 + 0.55, 5.15, z));
    const lv = mesh(bushing, materials.porcelain);
    lv.scale.set(0.8, 0.45, 0.8);
    lv.position.set(-0.75, 3.3, z * 0.8);
    tf.add(lv);
  });

  // 离相封闭母线：发电机出线 → 主变低压侧
  [-0.6, 0, 0.6].forEach((z) => {
    const bus = roundedPath([
      v3(GEN_X + 1.4, SHAFT_Y - 1.4, z),
      v3(GEN_X + 1.4, 1.8, z),
      v3(32.85, 1.8, z * 0.8),
      v3(32.85, 3.9, z * 0.8),
    ], 0.4);
    reg.fluid(root, bus, { group: 'electric', radius: 0.18, colorA: COLORS.electric, speed: 6, kind: 'electric', spacing: 1.2, stripe: 1.4, intensity: 1.0 });
  });

  // 出线构架
  const gantry = new THREE.Group();
  gantry.position.set(38.5, 0, 0);
  root.add(gantry);
  const gParts = [];
  [-3, 3].forEach((z) => {
    gParts.push(cylinderBetweenGeometry(v3(-0.5, 0, z), v3(0, 9, z), 0.12, 8));
    gParts.push(cylinderBetweenGeometry(v3(0.5, 0, z), v3(0, 9, z), 0.12, 8));
  });
  gParts.push(cylinderBetweenGeometry(v3(0, 9, -3.4), v3(0, 9, 3.4), 0.14, 8));
  gantry.add(mesh(mergeGeometries(gParts), materials.pylon));
  const gantryPts = [-1.8, 0, 1.8].map((z) => v3(38.5, 8.6, z));

  // 铁塔
  const towerTops = [];
  PYLONS.forEach((p) => {
    const t = mesh(lattice(p.h, 1.4, 0.45, [{ y: p.h - 2.5, span: 3.4 }]), materials.pylon);
    t.position.set(p.x, 0, p.z);
    t.rotation.y = -0.2;
    root.add(t);
    const tips = [-3.3, 0, 3.3].map((d) => {
      const local = v3(0, p.h - 3.4, d);
      local.applyAxisAngle(v3(0, 1, 0), -0.2);
      return local.add(v3(p.x, 0, p.z));
    });
    tips.forEach((tip) => {
      root.add(cylinderBetween(tip.clone().setY(tip.y + 0.9), tip, 0.06, materials.porcelain, 8));
    });
    towerTops.push(tips);
  });

  // 导线（电流脉冲）
  for (let ph = 0; ph < 3; ph += 1) {
    const chain = [hvTops[ph], gantryPts[ph], ...towerTops.map((t) => t[ph]), towerTops[2][ph].clone().add(v3(16, -4, -4))];
    for (let i = 0; i < chain.length - 1; i += 1) {
      const span = chain[i].distanceTo(chain[i + 1]);
      const curve = catenary(chain[i], chain[i + 1], i === 0 ? 0.4 : span * 0.035);
      reg.fluid(root, curve, { group: 'electric', radius: 0.05, colorA: COLORS.electric, speed: 8, kind: 'electric', shell: false, spacing: 1.8, stripe: 1.6, perUnit: 3, intensity: 1.0 });
    }
  }

  reg.label(root, v3(33.6, 5.6, -1.6), { title: '主变压器', sub: '24 kV 升压至 500 kV', steps: [0, 6], tone: 'electric' });
  reg.label(root, v3(PYLONS[1].x, PYLONS[1].h + 2, PYLONS[1].z), { title: '500 kV 输电线路', sub: '电能送入电网', steps: [0, 6], tone: 'electric' });
  reg.label(root, v3(27.5, 2.4, 0.9), { title: '离相封闭母线', sub: '发电机出口 24 kV', steps: [6], tone: 'electric' });
  return root;
}

