import * as THREE from 'three';
import { COLORS, materials, seededRandom } from '../core/materials.js';
import {
  SampledPath,
  box,
  cutLathe,
  cylinder,
  cylinderBetween,
  fluidTubeGeometry,
  mergeGeometries,
  mesh,
  profile,
  rect,
  roundedPath,
  v2,
  v3,
} from '../core/geometry.js';

const PI = Math.PI;
export const SHAFT_Y = 5.0;
export const HP_X = 2.0;
export const LP_X = [8, 14];
export const GEN_X = 21;
export const MSR_Z = 4.4;
const DECK_TOP = 3.4;

const bladeGeometry = new THREE.BoxGeometry(1, 1, 1);
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const X_AXIS = v3(1, 0, 0);
const Y_AXIS = v3(0, 1, 0);

// 生成一列叶片的变换矩阵：叶片径向朝外，带安装角
function bladeMatrices(list, { x, count, rHub, rTip, width, thick = 0.035, pitch = 0.55, lowerOnly = false, phase = 0 }) {
  const len = rTip - rHub;
  for (let i = 0; i < count; i += 1) {
    const theta = phase + (i / count) * PI * 2;
    if (lowerOnly && Math.cos(theta) > 0.05) continue;
    qA.setFromAxisAngle(X_AXIS, theta);
    qB.setFromAxisAngle(Y_AXIS, pitch);
    const q = qA.clone().multiply(qB);
    const rc = rHub + len / 2;
    const pos = v3(x, Math.cos(theta) * rc, Math.sin(theta) * rc);
    list.push(new THREE.Matrix4().compose(pos, q, v3(thick, len, width)));
  }
}

function instanced(list, material) {
  const m = new THREE.InstancedMesh(bladeGeometry, material, list.length);
  list.forEach((mat, i) => m.setMatrixAt(i, mat));
  m.castShadow = true;
  return m;
}

// 水平轴回转体（沿 x 轴）：lower = 下半缸，upper = 上半缸
function axialLathe(points, { lower, upper, capMaterial, segments = 48 }) {
  const g = new THREE.Group();
  if (lower) g.add(cutLathe(points, { phiStart: 0, phiLength: PI, segments, material: lower, capMaterial }));
  if (upper) g.add(cutLathe(points, { phiStart: PI, phiLength: PI, segments, material: upper }));
  g.rotation.z = -PI / 2;
  return g;
}

export function buildTurbineIsland(reg) {
  const root = new THREE.Group();
  buildDeck(root);
  const rotors = [];
  rotors.push(buildHP(reg, root));
  LP_X.forEach((x, i) => rotors.push(buildLP(reg, root, x, i)));
  rotors.push(...buildGenerator(reg, root));
  buildShaftLine(root, rotors);
  buildMSR(reg, root);
  buildCondenser(reg, root);
  buildFeedTrain(reg, root);

  reg.onUpdate((dt, sim) => {
    const w = dt * 2.4 * sim.turbine;
    rotors.forEach((r) => {
      r.rotation.x += w;
    });
  });
  return root;
}

/* ------------------------------------------------------------------ */
function buildDeck(root) {
  const segs = [[-1.2, 5.2], [10.75, 11.25], [16.8, 26.6]];
  segs.forEach(([a, b]) => root.add(box(b - a, 0.6, 6, materials.concretePlain, (a + b) / 2, DECK_TOP - 0.3, 0)));
  [-0.8, 1.6, 4.7, 11.0, 17.3, 20.0, 23.0, 26.1].forEach((x) => {
    [-2.6, 2.6].forEach((z) => root.add(box(0.55, DECK_TOP - 0.6, 0.55, materials.concretePlain, x, (DECK_TOP - 0.6) / 2, z)));
  });
  // 轴承座
  [-0.5, 4.55, 5.35, 11.0, 16.7, 18.1, 23.9, 26.0].forEach((x) => {
    root.add(box(0.5, SHAFT_Y - DECK_TOP + 0.2, 1.3, materials.steelDark, x, (SHAFT_Y + DECK_TOP) / 2 - 0.1, 0));
  });
}

function buildShaftLine(root, rotors) {
  const shaft = new THREE.Group();
  shaft.position.set(0, SHAFT_Y, 0);
  const s = cylinder(0.17, 0.17, 27.2, materials.steel, { segments: 20 });
  s.rotation.z = PI / 2;
  s.position.x = 12.8;
  shaft.add(s);
  [4.95, 10.95, 16.95, 17.9].forEach((x) => {
    const c = cylinder(0.32, 0.32, 0.12, materials.crane, { segments: 20 });
    c.rotation.z = PI / 2;
    c.position.x = x;
    shaft.add(c);
    const mark = box(0.14, 0.12, 0.06, materials.steelDark, x, 0.3, 0);
    shaft.add(mark);
  });
  root.add(shaft);
  rotors.push(shaft);
}

/* ------------------------------------------------------------------ */
/* 高压缸（双流）                                                      */
/* ------------------------------------------------------------------ */
function buildHP(reg, root) {
  const g = new THREE.Group();
  g.position.set(HP_X, SHAFT_Y, 0);
  root.add(g);
  reg.equipment('turbine', g, 5);

  const casing = profile(
    [v2(0.3, -1.8), v2(0.95, -1.8)],
    [v2(1.25, -0.8)],
    [v2(1.25, 0.8)],
    [v2(0.95, 1.8)],
    [v2(0.3, 1.8)],
    [v2(0.3, 1.7)],
    [v2(0.86, 1.7)],
    [v2(1.15, 0.8)],
    [v2(1.15, -0.8)],
    [v2(0.86, -1.7)],
    [v2(0.3, -1.7)],
  );
  const shell = axialLathe(casing, { lower: materials.casing, upper: materials.casingGlass, capMaterial: materials.steelCut });
  g.add(shell);
  [-1, 1].forEach((z) => g.add(box(3.4, 0.1, 0.22, materials.casing, 0, 0, z * 1.3)));

  const rotor = new THREE.Group();
  g.add(rotor);
  const moving = [];
  const fixed = [];
  const discs = [];
  [-1, 1].forEach((side) => {
    for (let k = 0; k < 7; k += 1) {
      const x = side * (0.28 + k * 0.2);
      const tip = 0.56 + k * 0.055;
      bladeMatrices(moving, { x, count: 30, rHub: 0.38, rTip: tip, width: 0.09, pitch: side * 0.6 });
      bladeMatrices(fixed, { x: x - side * 0.09, count: 30, rHub: tip + 0.02, rTip: 1.1, width: 0.08, pitch: -side * 0.6, lowerOnly: true, phase: 0.05 });
      discs.push(new THREE.CylinderGeometry(0.4, 0.4, 0.06, 28).rotateZ(PI / 2).translate(x, 0, 0));
    }
  });
  rotor.add(instanced(moving, materials.steelBright));
  rotor.add(mesh(mergeGeometries(discs), materials.steel));
  g.add(instanced(fixed, materials.steel));

  // 高压缸内蒸汽：中间进汽 → 向两端膨胀
  const rand = seededRandom(41);
  const paths = [];
  for (let k = 0; k < 16; k += 1) {
    const side = k % 2 ? 1 : -1;
    const zIn = k % 4 < 2 ? 0.5 : -0.5;
    const th0 = rand() * PI * 2;
    const pts = [v3(HP_X, 6.3, zIn), v3(HP_X + side * 0.05, 5.75, zIn * 0.4)];
    for (let m = 0; m < 9; m += 1) {
      const th = th0 + m * 0.7;
      const r = 0.5 + m * 0.045;
      pts.push(v3(HP_X + side * (0.2 + m * 0.17), SHAFT_Y + Math.cos(th) * r, Math.sin(th) * r));
    }
    pts.push(v3(HP_X + side * 1.65, 4.25, side * 0.8));
    paths.push(new THREE.CatmullRomCurve3(pts, false, 'centripetal'));
  }
  reg.stream(root, {
    curves: paths,
    count: 150,
    size: 0.035,
    speed: 2.2,
    group: 'turbineSteam',
    kind: 'steam',
    colorFn: (t, pi, out) => out.copy(COLORS.steam).lerp(COLORS.wetSteam, t).multiplyScalar(1.6),
  });

  reg.label(root, v3(HP_X, 7.9, 0), { title: '高压缸', sub: '主蒸汽 6.7 MPa 进汽 · 双向膨胀', steps: [5] });
  reg.label(root, v3(11, 9.6, 0), { title: '汽轮机', sub: '高压缸 + 2 个低压缸', steps: [0] });
  return rotor;
}

/* ------------------------------------------------------------------ */
/* 低压缸（双流，末级长叶片）                                          */
/* ------------------------------------------------------------------ */
function buildLP(reg, root, cx, index) {
  const g = new THREE.Group();
  g.position.set(cx, SHAFT_Y, 0);
  root.add(g);
  reg.equipment('turbine', g, 5);

  // 上部排汽罩（透明）与下部排汽缸
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 5.2, 48, 1, true, 0, PI), materials.casingGlass);
  hood.rotation.z = PI / 2;
  g.add(hood);
  [-2.6, 2.6].forEach((x) => {
    const end = new THREE.Mesh(new THREE.CircleGeometry(2.45, 32, 0, PI), materials.casingGlass);
    end.rotation.y = PI / 2;
    end.position.x = x;
    g.add(end);
    g.add(box(0.12, SHAFT_Y - DECK_TOP + 0.1, 4.9, materials.casing, x, -(SHAFT_Y - DECK_TOP) / 2, 0));
  });
  g.add(box(5.2, SHAFT_Y - DECK_TOP + 0.1, 0.12, materials.casing, 0, -(SHAFT_Y - DECK_TOP) / 2, -2.45));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.06, 8, 48, PI), materials.casing);
  rim.rotation.y = PI / 2;
  [-2.6, 2.6].forEach((x) => {
    const r = rim.clone();
    r.position.x = x;
    g.add(r);
  });
  // 内缸下半
  const inner = profile(
    [v2(0.7, -2.3), v2(2.25, -2.3)],
    [v2(2.25, -2.2)],
    [v2(1.0, -0.2)],
    [v2(1.0, 0.2)],
    [v2(2.25, 2.2)],
    [v2(2.25, 2.3)],
    [v2(0.7, 2.3)],
    [v2(0.7, 2.2)],
    [v2(2.12, 2.2)],
    [v2(0.9, 0.25)],
    [v2(0.9, -0.25)],
    [v2(2.12, -2.2)],
    [v2(0.7, -2.2)],
  );
  g.add(axialLathe(inner, { lower: materials.casing, capMaterial: materials.steelCut }));

  const rotor = new THREE.Group();
  g.add(rotor);
  const moving = [];
  const fixed = [];
  const discs = [];
  const tips = [0.98, 1.18, 1.42, 1.72, 2.08];
  [-1, 1].forEach((side) => {
    tips.forEach((tip, k) => {
      const x = side * (0.38 + k * 0.44);
      const hub = 0.55 + k * 0.03;
      bladeMatrices(moving, { x, count: 34 - k * 2, rHub: hub, rTip: tip, width: 0.1 + k * 0.03, pitch: side * (0.45 + k * 0.12) });
      bladeMatrices(fixed, { x: x - side * 0.18, count: 30, rHub: tip - 0.12 > hub ? hub + 0.05 : hub, rTip: tip + 0.05, width: 0.09, pitch: -side * 0.5, lowerOnly: true, phase: 0.08 });
      discs.push(new THREE.CylinderGeometry(hub + 0.02, hub + 0.02, 0.07, 32).rotateZ(PI / 2).translate(x, 0, 0));
    });
  });
  rotor.add(instanced(moving, materials.steelBright));
  rotor.add(mesh(mergeGeometries(discs), materials.steel));
  g.add(instanced(fixed, materials.steel));

  // 低压缸蒸汽：顶部进汽 → 沿叶栅螺旋膨胀 → 向下排入凝汽器 → 冷凝成水滴
  const rand = seededRandom(51 + index);
  const paths = [];
  for (let k = 0; k < 24; k += 1) {
    const side = k % 2 ? 1 : -1;
    const th0 = rand() * PI * 2;
    const pts = [v3(cx, 7.7, 0), v3(cx, 6.6, 0), v3(cx + side * 0.18, 5.95, (rand() - 0.5) * 0.4)];
    for (let m = 0; m < 9; m += 1) {
      const th = th0 + m * 0.55;
      const r = 0.82 + m * 0.13;
      pts.push(v3(cx + side * (0.36 + m * 0.24), SHAFT_Y + Math.cos(th) * r, Math.sin(th) * r * 0.9));
    }
    const dx = cx + side * (1.4 + rand() * 1.0);
    const dz = (rand() - 0.5) * 4.2;
    pts.push(v3(dx, 3.0, dz), v3(dx + (rand() - 0.5) * 0.3, 1.9, dz), v3(dx, 0.55, dz * 0.9));
    const sp = new SampledPath(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 180);
    sp.tCond = sp.findT((p) => p.y < 2.5, 0.5);
    paths.push(sp);
  }
  const water = COLORS.feed.clone().multiplyScalar(1.4);
  reg.stream(root, {
    curves: paths,
    count: 230,
    size: 0.04,
    speed: 2.0,
    group: 'turbineSteam',
    kind: 'steam',
    colorFn: (t, pi, out) => {
      const p = paths[pi];
      if (t > p.tCond) return out.copy(water);
      return out.copy(COLORS.steam).lerp(COLORS.wetSteam, Math.min(1, t / p.tCond) * 0.8).multiplyScalar(1.5);
    },
    sizeFn: (t, pi) => (t > paths[pi].tCond ? 0.6 : 1 + t * 0.5),
  });

  reg.label(root, v3(cx, 7.9, 0), { title: `低压缸 ${index + 1}`, sub: index ? '末级叶片长约 1.8 m' : '蒸汽继续膨胀做功', steps: [5] });
  return rotor;
}

/* ------------------------------------------------------------------ */
/* 发电机（四极，半速 1500 r/min）                                     */
/* ------------------------------------------------------------------ */
function buildGenerator(reg, root) {
  const g = new THREE.Group();
  g.position.set(GEN_X, SHAFT_Y, 0);
  root.add(g);
  reg.equipment('generator', g, 6);

  // 机座：切去上前方四分之一，露出定子与转子
  const housing = profile(
    [v2(0.35, -2.4), v2(1.55, -2.4)],
    [v2(1.55, 2.4)],
    [v2(0.35, 2.4)],
    [v2(0.35, 2.28)],
    [v2(1.45, 2.28)],
    [v2(1.45, -2.28)],
    [v2(0.35, -2.28)],
  );
  const shell = new THREE.Group();
  shell.add(cutLathe(housing, { phiStart: 0, phiLength: 1.5 * PI, segments: 64, material: materials.generator, capMaterial: materials.steelCut }));
  shell.rotation.z = -PI / 2;
  g.add(shell);
  const stator = new THREE.Group();
  stator.add(cutLathe(rect(0.93, -1.8, 1.4, 1.8), { phiStart: 0, phiLength: 1.5 * PI, segments: 64, material: materials.steelDark, capMaterial: materials.steelCut }));
  stator.rotation.z = -PI / 2;
  g.add(stator);
  // 机座底脚
  g.add(box(4.6, 0.5, 2.6, materials.generator, 0, -1.4, 0));

  // 定子绕组（三相：黄 / 绿 / 红）
  const phaseColors = [new THREE.Color('#ffd23f'), new THREE.Color('#4fe07a'), new THREE.Color('#ff4b4b')];
  const phaseMats = phaseColors.map((c) => new THREE.MeshStandardMaterial({ color: 0xc9773a, metalness: 0.7, roughness: 0.3, emissive: c, emissiveIntensity: 0.2 }));
  const bars = [[], [], []];
  const BAR_N = 36;
  for (let i = 0; i < BAR_N; i += 1) {
    const theta = (i / BAR_N) * PI * 2;
    // 与上前方剖切区对应：y>0 且 z>0 的区域不画
    const y = Math.cos(theta) * 0.9;
    const z = Math.sin(theta) * 0.9;
    if (y > 0.05 && z > 0.05) continue;
    bars[i % 3].push(new THREE.BoxGeometry(4.0, 0.08, 0.1).translate(0, 0.9, 0).rotateX(theta));
  }
  bars.forEach((list, i) => g.add(mesh(mergeGeometries(list), phaseMats[i])));
  [-2.05, 2.05].forEach((x) => {
    const endWinding = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 10, 48, 1.5 * PI), materials.copper);
    endWinding.rotation.y = -PI / 2;
    endWinding.rotation.z = PI / 2;
    endWinding.position.x = x;
    g.add(endWinding);
  });

  // 转子：4 个磁极（N/S）+ 励磁绕组
  const rotor = new THREE.Group();
  g.add(rotor);
  const core = cylinder(0.78, 0.78, 3.6, materials.steelBright, { segments: 48 });
  core.rotation.z = PI / 2;
  rotor.add(core);
  const nMat = new THREE.MeshStandardMaterial({ color: 0xd8413a, emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 });
  const sMat = new THREE.MeshStandardMaterial({ color: 0x2f6fe0, emissive: new THREE.Color('#1a5aff'), emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.4 });
  for (let p = 0; p < 4; p += 1) {
    const theta = (p / 4) * PI * 2;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.795, 0.795, 3.3, 24, 1, true, theta - 0.32, 0.64), p % 2 ? sMat : nMat);
    face.rotation.z = PI / 2;
    rotor.add(face);
    [-0.5, 0.5].forEach((d) => {
      const a = theta + d;
      const bar = box(3.5, 0.05, 0.07, materials.copper, 0, Math.sin(a) * 0.8, Math.cos(a) * 0.8);
      bar.rotation.x = -a;
      rotor.add(bar);
    });
  }
  // 磁力线：从 N 极出发穿过定子回到相邻 S 极
  const fieldMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.6, 2.2), transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false });
  const fieldGeoms = [];
  for (let p = 0; p < 4; p += 1) {
    const a0 = (p / 4) * PI * 2;
    const a1 = a0 + PI / 2;
    [-1.1, 0, 1.1].forEach((x) => {
      [1.12, 1.3].forEach((rOut) => {
        const pts = [];
        for (let i = 0; i <= 24; i += 1) {
          const u = i / 24;
          const a = a0 + (a1 - a0) * u;
          const r = 0.8 + (rOut - 0.8) * Math.sin(u * PI);
          pts.push(v3(x, Math.sin(a) * r, Math.cos(a) * r));
        }
        fieldGeoms.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 5));
      });
    });
  }
  const field = new THREE.Mesh(mergeGeometries(fieldGeoms), fieldMat);
  field.renderOrder = 5;
  rotor.add(field);

  // 励磁机
  const exciter = new THREE.Group();
  exciter.position.set(25.0, SHAFT_Y, 0);
  const exBody = cylinder(0.72, 0.72, 1.5, materials.generator, { segments: 36 });
  exBody.rotation.z = PI / 2;
  exciter.add(exBody);
  exciter.add(box(1.5, 0.6, 1.4, materials.generator, 0, -0.8, 0));
  root.add(exciter);
  reg.equipment('generator', exciter);

  reg.onUpdate((dt, sim) => {
    const angle = rotor.rotation.x;
    phaseMats.forEach((m, i) => {
      const wave = Math.sin(angle * 2 - (i * 2 * PI) / 3);
      m.emissiveIntensity = 0.1 + Math.max(0, wave) * 1.6 * sim.electric;
    });
    const target = sim.step === 6 ? 0.85 : sim.step === 0 ? 0.25 : 0.0;
    fieldMat.opacity += (target * Math.min(1, sim.turbine + 0.2) - fieldMat.opacity) * Math.min(1, dt * 4 + 0.02);
  });

  reg.label(root, v3(GEN_X, 7.0, 0), { title: '发电机', sub: '旋转磁场切割定子绕组 → 感应电流', steps: [0, 6] });
  reg.label(root, v3(GEN_X - 0.9, 6.05, 0.9), { title: '转子磁极 N / S', sub: '直流励磁产生磁场', steps: [6], tone: 'hot' });
  reg.label(root, v3(GEN_X + 1.4, 3.75, 1.2), { title: '定子三相绕组', sub: '输出 24 kV 交流电', steps: [6], tone: 'electric' });
  reg.label(root, v3(25.0, 6.2, 0), { title: '励磁机', sub: '为转子提供直流', steps: [6] });
  return [rotor, exciter];
}

/* ------------------------------------------------------------------ */
/* 汽水分离再热器                                                      */
/* ------------------------------------------------------------------ */
function buildMSR(reg, root) {
  [-1, 1].forEach((s) => {
    const g = new THREE.Group();
    g.position.set(8.0, 4.6, s * MSR_Z);
    root.add(g);
    reg.equipment('msr', g, 5);
    const body = mesh(new THREE.CapsuleGeometry(0.82, 6.4, 12, 32), materials.casing);
    body.rotation.z = PI / 2;
    g.add(body);
    [-2.6, 0, 2.6].forEach((x) => {
      g.add(box(0.3, 4.6 - 0.8, 0.9, materials.steelDark, x, -(4.6 - 0.8) / 2 - 0.6, 0));
      const band = cylinder(0.86, 0.86, 0.12, materials.steelDark, { segments: 32 });
      band.rotation.z = PI / 2;
      band.position.x = x;
      g.add(band);
    });
  });
  reg.label(root, v3(8.0, 5.7, MSR_Z), { title: '汽水分离再热器', sub: '去除水分并再加热蒸汽', steps: [5] });
}

/* ------------------------------------------------------------------ */
/* 凝汽器                                                              */
/* ------------------------------------------------------------------ */
function buildCondenser(reg, root) {
  const g = new THREE.Group();
  root.add(g);
  reg.equipment('condenser', g, 7);
  const x0 = 5.3;
  const x1 = 16.7;
  const zc = 2.5;
  g.add(box(x1 - x0, 0.14, zc * 2, materials.casing, (x0 + x1) / 2, 0.2, 0));
  g.add(box(x1 - x0, 3.2, 0.12, materials.casing, (x0 + x1) / 2, 1.8, -zc));
  const front = box(x1 - x0, 3.2, 0.05, materials.casingGlass, (x0 + x1) / 2, 1.8, zc);
  front.castShadow = false;
  g.add(front);
  reg.shells.push(front);
  // 水室
  [x0 - 0.3, x1 + 0.3].forEach((x) => {
    g.add(box(0.6, 2.4, 4.4, materials.casing, x, 1.7, 0));
  });
  // 管板与支撑板
  [x0, x1].forEach((x) => g.add(box(0.08, 3.0, zc * 2, materials.steelDark, x, 1.8, 0)));
  [7.2, 9.1, 11.0, 12.9, 14.8].forEach((x) => g.add(box(0.04, 1.9, zc * 2 - 0.2, materials.steelBright, x, 1.75, 0)));
  // 热井中的凝结水
  const well = box(x1 - x0 - 0.1, 0.42, zc * 2 - 0.2, materials.water, (x0 + x1) / 2, 0.48, 0);
  well.castShadow = false;
  well.renderOrder = 2;
  g.add(well);

  // 冷却水管束（沿 x 方向），颜色从冷到暖
  const tubes = [];
  [-1.2, 1.2].forEach((zc0) => {
    for (let r = 0; r < 6; r += 1) {
      for (let c = 0; c < 5; c += 1) {
        const y = 1.05 + r * 0.26;
        const z = zc0 + (c - 2) * 0.26 + (r % 2 ? 0.13 : 0);
        if (Math.abs(z) > 2.3) continue;
        tubes.push(fluidTubeGeometry(new THREE.LineCurve3(v3(x0, y, z), v3(x1, y, z)), 0.05, { perUnit: 2, radial: 8 }));
      }
    }
  });
  reg.fluidBundle(g, mergeGeometries(tubes), { group: 'coolingWater', colorA: COLORS.coolCold, colorB: COLORS.coolWarm, speed: 1.4, spacing: 1.0, kind: 'cooling', intensity: 1.5 });

  reg.label(root, v3(11.0, 3.35, 2.6), { title: '凝汽器', sub: '乏汽遇冷却水管凝结成水 → 热井', steps: [0, 7] });
  reg.label(root, v3(x0 - 0.3, 3.1, 1.8), { title: '冷却水进口', sub: '≈ 22 °C', steps: [7], tone: 'cool' });
  reg.label(root, v3(x1 + 0.3, 3.1, 1.8), { title: '冷却水出口', sub: '≈ 32 °C', steps: [7], tone: 'warm' });
}

/* ------------------------------------------------------------------ */
/* 给水回热系统：凝结水泵 → 低加 → 除氧器 → 给水泵 → 高加              */
/* ------------------------------------------------------------------ */
export const FEED = {
  condensatePump: v3(18.3, 0, 3.9),
  lpHeater: { x0: 11.6, x1: 15.6, y: 1.2, z: 4.7 },
  deaerator: { x0: 4.2, x1: 12.2, y: 10.0, z: -5.2 },
  feedPump: v3(0.6, 0.95, -5.2),
  hpHeater: v3(-2.6, 0, -5.0),
};

function buildFeedTrain(reg, root) {
  const g = new THREE.Group();
  root.add(g);
  reg.equipment('feedwater', g, 7);
  const { condensatePump: cp, lpHeater: lh, deaerator: da, feedPump: fp, hpHeater: hh } = FEED;

  // 凝结水泵
  const cpBody = cylinder(0.32, 0.32, 1.2, materials.steel, { segments: 24 });
  cpBody.position.set(cp.x, 0.7, cp.z);
  const cpMotor = cylinder(0.36, 0.36, 0.9, materials.motor, { segments: 24 });
  cpMotor.position.set(cp.x, 1.75, cp.z);
  g.add(cpBody, cpMotor);

  // 低压加热器
  const lph = mesh(new THREE.CapsuleGeometry(0.45, lh.x1 - lh.x0 - 0.9, 10, 24), materials.casing);
  lph.rotation.z = PI / 2;
  lph.position.set((lh.x0 + lh.x1) / 2, lh.y, lh.z);
  g.add(lph);

  // 除氧器
  const daBody = mesh(new THREE.CapsuleGeometry(0.9, da.x1 - da.x0 - 1.8, 12, 32), materials.casing);
  daBody.rotation.z = PI / 2;
  daBody.position.set((da.x0 + da.x1) / 2, da.y, da.z);
  g.add(daBody);
  const head = cylinder(0.5, 0.5, 1.2, materials.casing, { segments: 24 });
  head.position.set(da.x0 + 1.2, da.y + 1.1, da.z);
  g.add(head);
  g.add(box(da.x1 - da.x0 + 0.6, 0.18, 2.2, materials.steelDark, (da.x0 + da.x1) / 2, da.y - 1.0, da.z));
  [da.x0 + 0.2, da.x1 - 0.2].forEach((x) => [-0.9, 0.9].forEach((dz) => g.add(box(0.2, da.y - 1.0, 0.2, materials.steelDark, x, (da.y - 1.0) / 2, da.z + dz))));

  // 给水泵（电机 + 泵体）
  const pump = cylinder(0.42, 0.42, 1.1, materials.steel, { segments: 24 });
  pump.rotation.z = PI / 2;
  pump.position.set(fp.x + 0.55, fp.y, fp.z);
  const motor = cylinder(0.48, 0.48, 1.6, materials.motor, { segments: 24 });
  motor.rotation.z = PI / 2;
  motor.position.set(fp.x - 0.9, fp.y, fp.z);
  g.add(pump, motor, box(3.2, 0.3, 1.2, materials.concretePlain, fp.x - 0.2, 0.2, fp.z));

  // 高压加热器（立式）
  const hph = mesh(new THREE.CapsuleGeometry(0.5, 2.2, 10, 24), materials.casing);
  hph.position.set(hh.x, 2.0, hh.z);
  g.add(hph);

  reg.label(root, v3((da.x0 + da.x1) / 2, da.y + 1.3, da.z), { title: '除氧器', sub: '除去给水中的氧气', steps: [7] });
  reg.label(root, v3(fp.x, 2.0, fp.z), { title: '主给水泵', sub: '加压送回蒸汽发生器', steps: [7] });
  reg.label(root, v3(cp.x, 2.6, cp.z), { title: '凝结水泵', steps: [7], tone: 'minor' });
  reg.label(root, v3(hh.x, 3.7, hh.z), { title: '高压加热器', steps: [7], tone: 'minor' });
  reg.label(root, v3((lh.x0 + lh.x1) / 2, 2.0, lh.z), { title: '低压加热器', steps: [7], tone: 'minor' });
}

// 汽轮机厂房内的汽水管道
export function buildTurbinePiping(reg, root) {
  const { condensatePump: cp, lpHeater: lh, deaerator: da, feedPump: fp, hpHeater: hh } = FEED;
  const water = { colorA: COLORS.feed, speed: 1.2, kind: 'feed' };

  // 高压缸排汽 → 汽水分离再热器（湿蒸汽）
  reg.fluid(root, roundedPath([v3(0.35, 4.25, -0.8), v3(0.35, 3.85, -0.8), v3(0.35, 3.85, -MSR_Z), v3(4.4, 3.85, -MSR_Z), v3(4.4, 4.4, -MSR_Z)], 0.35), { group: 'reheatSteam', radius: 0.28, colorA: COLORS.wetSteam, speed: 2.4, kind: 'steam' });
  reg.fluid(root, roundedPath([v3(3.65, 4.25, 0.8), v3(3.65, 3.85, 0.8), v3(3.65, 3.85, MSR_Z), v3(4.4, 3.85, MSR_Z), v3(4.4, 4.4, MSR_Z)], 0.35), { group: 'reheatSteam', radius: 0.28, colorA: COLORS.wetSteam, speed: 2.4, kind: 'steam' });
  // 再热蒸汽 → 低压缸
  reg.fluid(root, roundedPath([v3(11.2, 5.3, -MSR_Z), v3(11.2, 8.6, -MSR_Z), v3(LP_X[0], 8.6, -MSR_Z), v3(LP_X[0], 8.6, 0), v3(LP_X[0], 7.5, 0)], 0.6), { group: 'reheatSteam', radius: 0.36, colorA: COLORS.steam, speed: 2.4, kind: 'steam' });
  reg.fluid(root, roundedPath([v3(11.2, 5.3, MSR_Z), v3(11.2, 8.6, MSR_Z), v3(LP_X[1], 8.6, MSR_Z), v3(LP_X[1], 8.6, 0), v3(LP_X[1], 7.5, 0)], 0.6), { group: 'reheatSteam', radius: 0.36, colorA: COLORS.steam, speed: 2.4, kind: 'steam' });

  // 凝结水：热井 → 凝结水泵 → 低加 → 除氧器
  reg.fluid(root, roundedPath([v3(15.8, 0.45, 1.8), v3(15.8, 0.45, 3.1), v3(cp.x, 0.45, 3.1), v3(cp.x, 0.45, cp.z)], 0.3), { group: 'feedwater', radius: 0.12, ...water });
  reg.fluid(root, roundedPath([v3(cp.x, 1.3, cp.z), v3(cp.x, 1.3, lh.z), v3(lh.x1 + 0.3, lh.y, lh.z)], 0.3), { group: 'feedwater', radius: 0.12, ...water });
  reg.fluid(root, roundedPath([v3(lh.x0 - 0.3, lh.y, lh.z), v3(10.9, lh.y, lh.z), v3(10.9, lh.y, 5.7), v3(10.9, 9.4, 5.7), v3(10.9, 9.4, da.z), v3(da.x1 - 0.2, 9.4, da.z), v3(da.x1 - 0.2, da.y - 0.5, da.z)], 0.35), { group: 'feedwater', radius: 0.12, ...water });
  // 除氧器 → 给水泵 → 高加
  reg.fluid(root, roundedPath([v3(da.x0 + 0.6, da.y - 0.7, da.z), v3(da.x0 + 0.6, 1.7, da.z), v3(2.0, 1.7, fp.z), v3(2.0, fp.y, fp.z), v3(fp.x + 0.7, fp.y, fp.z)], 0.35), { group: 'feedwater', radius: 0.14, ...water });
  reg.fluid(root, roundedPath([v3(fp.x + 0.55, fp.y + 0.4, fp.z), v3(fp.x + 0.55, 2.4, fp.z), v3(hh.x + 0.6, 2.4, fp.z), v3(hh.x + 0.45, 2.4, hh.z)], 0.3), { group: 'feedwater', radius: 0.14, ...water });

  // 主蒸汽隔离阀与主汽门
  [-1.3, 1.3].forEach((z) => {
    const valve = new THREE.Group();
    valve.position.set(-7.3, 10, z);
    valve.add(mesh(new THREE.SphereGeometry(0.36, 20, 14), materials.steelDark));
    valve.add(cylinderBetween(v3(0, 0.3, 0), v3(0, 1.1, 0), 0.12, materials.steel));
    valve.add(box(0.5, 0.35, 0.5, materials.crane, 0, 1.2, 0));
    root.add(valve);
    reg.equipment('mainSteam', valve);
    const chest = new THREE.Group();
    chest.position.set(-0.6, 7.4, z);
    chest.add(mesh(new THREE.SphereGeometry(0.32, 20, 14), materials.steelDark));
    chest.add(cylinderBetween(v3(0, 0.25, 0), v3(0, 0.9, 0), 0.1, materials.steel));
    chest.add(box(0.4, 0.3, 0.4, materials.crane, 0, 1.0, 0));
    root.add(chest);
  });
  reg.label(root, v3(-7.3, 11.6, 1.3), { title: '主蒸汽隔离阀', sub: '事故时快速关闭', steps: [4, 5] });
  reg.label(root, v3(-0.6, 8.7, -1.3), { title: '主汽门 / 调节阀', sub: '控制进汽量', steps: [5] });
}

