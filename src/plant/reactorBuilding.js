import * as THREE from 'three';
import { COLORS, createGlowMaterial, materials, seededRandom, textures } from '../core/materials.js';
import {
  HALF,
  SampledPath,
  arc,
  box,
  cutLathe,
  cylinder,
  cylinderBetween,
  cylinderBetweenGeometry,
  mergeGeometries,
  mesh,
  polar,
  profile,
  rect,
  roundedPath,
  fluidTubeGeometry,
  v2,
  v3,
} from '../core/geometry.js';

const PI = Math.PI;
export const REACTOR_ORIGIN = v3(-16, 0, 0);
export const NOZZLE_Y = 4.55;
export const SG_X = 4.4;
const PUMP_X = 3.1;
const PUMP_Z = -2.6;
const PRZ = v3(1.9, 0, -4.3);
export const CONTAINMENT = { ri: 7.2, ro: 7.8, h: 11, domeIn: 5.0, domeOut: 5.5, phiStart: 0.36 * PI, phiLength: 1.28 * PI };

export const toWorld = (x, y, z) => v3(x, y, z).add(REACTOR_ORIGIN);

// 堆芯几何参数
const CORE = { bottom: 1.7, top: 3.84, radius: 0.8, pitch: 0.2, width: 0.188, rods: 9 };
const ROD_TRAVEL = CORE.top - CORE.bottom;

export function buildReactorBuilding(reg) {
  const root = new THREE.Group();
  root.position.copy(REACTOR_ORIGIN);
  buildContainment(reg, root);
  buildRPV(reg, root);
  buildSteamGenerator(reg, root, 1);
  buildSteamGenerator(reg, root, -1);
  buildPressurizer(reg, root);
  buildPump(reg, root, 1);
  buildPump(reg, root, -1);
  buildPrimaryPiping(reg, root);
  buildFuelRodCallout(reg, root);
  return root;
}

/* ------------------------------------------------------------------ */
/* 安全壳                                                              */
/* ------------------------------------------------------------------ */
function buildContainment(reg, root) {
  const { ri, ro, h, domeIn, domeOut, phiStart, phiLength } = CONTAINMENT;
  const shell = new THREE.Group();
  root.add(shell);
  reg.shells.push(shell);
  reg.equipment('containment', shell);

  const pts = profile(
    [v2(ri, 0), v2(ro, 0)],
    [v2(ro, h)],
    arc(0, h, ro, domeOut, 0, PI / 2, 30).slice(1),
    [v2(0, h + domeIn)],
    arc(0, h, ri, domeIn, PI / 2, 0, 30).slice(1),
  );
  const wall = cutLathe(pts, { phiStart, phiLength, segments: 112, material: materials.concrete, capMaterial: materials.concreteCut });
  wall.traverse((o) => {
    o.castShadow = false;
  });
  shell.add(wall);

  // 钢衬里
  const liner = profile(
    [v2(ri - 0.07, 0.05), v2(ri - 0.03, 0.05)],
    [v2(ri - 0.03, h)],
    arc(0, h, ri - 0.03, domeIn - 0.03, 0, PI / 2, 24).slice(1),
    [v2(0, h + domeIn - 0.07)],
    arc(0, h, ri - 0.07, domeIn - 0.07, PI / 2, 0, 24).slice(1),
  );
  const linerMesh = cutLathe(liner, { phiStart, phiLength, segments: 96, material: materials.steelDark });
  linerMesh.traverse((o) => {
    o.castShadow = false;
  });
  shell.add(linerMesh);

  // 环梁与外部加强带
  shell.add(cutLathe(rect(ro, 10.8, ro + 0.12, 11.15), { phiStart, phiLength, material: materials.concretePlain, capMaterial: materials.concreteCut }));
  [PI, 0.66 * PI, 1.34 * PI].forEach((phi) => {
    const rib = box(0.7, h, 0.35, materials.concrete, 0, h / 2, 0);
    rib.position.copy(polar(ro + 0.12, phi, h / 2));
    rib.rotation.y = phi;
    shell.add(rib);
  });

  // 设备闸门与人员闸门
  const hatchPhi = 0.8 * PI;
  shell.add(cylinderBetween(polar(ro - 0.2, hatchPhi, 8.6), polar(ro + 0.9, hatchPhi, 8.6), 1.0, materials.steelDark, 32));
  shell.add(cylinderBetween(polar(ro + 0.9, hatchPhi, 8.6), polar(ro + 1.0, hatchPhi, 8.6), 1.12, materials.crane, 32));
  const lockPhi = 1.25 * PI;
  shell.add(cylinderBetween(polar(ro - 0.2, lockPhi, 1.4), polar(ro + 1.4, lockPhi, 1.4), 0.6, materials.steelDark, 24));

  // 基础底板
  const base = cylinder(8.4, 8.6, 0.5, materials.concretePlain, { segments: 96 });
  base.position.y = -0.24;
  base.receiveShadow = true;
  root.add(base);

  // 环吊
  const crane = new THREE.Group();
  crane.add(cutLathe(rect(6.7, 10.35, 7.12, 10.72), { phiStart, phiLength, material: materials.crane, capMaterial: materials.crane }));
  [-3.1, -3.55].forEach((z) => crane.add(box(11.2, 0.36, 0.2, materials.crane, 0, 10.95, z)));
  crane.add(box(1.2, 0.46, 1.0, materials.crane, 1.6, 11.35, -3.32));
  crane.add(cylinderBetween(v3(1.6, 11.1, -3.32), v3(1.6, 9.6, -3.32), 0.02, materials.steelDark));
  crane.add(box(0.3, 0.3, 0.3, materials.crane, 1.6, 9.45, -3.32));
  shell.add(crane);

  // 操作平台（格栅）
  const deck = new THREE.Mesh(new THREE.RingGeometry(2.15, ri - 0.08, 72, 1, phiStart - PI / 2, phiLength), materials.gratingMat);
  deck.rotation.x = -PI / 2;
  deck.position.y = 7.6;
  root.add(deck);
  reg.shells.push(deck);

  // 一次屏蔽墙
  root.add(cutLathe(rect(1.6, 0, 2.08, 4.0), { ...HALF, material: materials.concrete, capMaterial: materials.concreteCut }));

  reg.label(root, v3(-4.8, 15.6, -3.2), { title: '安全壳', sub: '预应力混凝土 + 钢衬里 · 第三道屏障', steps: [0, 2, 3] });
}

/* ------------------------------------------------------------------ */
/* 反应堆压力容器与堆内构件                                            */
/* ------------------------------------------------------------------ */
function buildRPV(reg, root) {
  const g = new THREE.Group();
  root.add(g);
  reg.equipment('rpv', g, 2);
  const R = 1.1;
  const T = 0.12;
  const Ri = R - T;
  const cy = 1.5;

  const body = profile(
    arc(0, cy, R, R, -PI / 2, 0, 22),
    [v2(R, 5.1)],
    [v2(1.3, 5.1)],
    [v2(1.3, 5.45)],
    [v2(Ri, 5.45)],
    [v2(Ri, cy)],
    arc(0, cy, Ri, Ri, 0, -PI / 2, 22).slice(1),
  );
  g.add(cutLathe(body, { ...HALF, segments: 72, material: materials.steel, capMaterial: materials.steelCut }));

  const head = profile(
    [v2(Ri, 5.45), v2(1.3, 5.45)],
    [v2(1.3, 5.72)],
    [v2(R, 5.72)],
    arc(0, 5.72, R, 0.78, 0, PI / 2, 22).slice(1),
    [v2(0, 5.72 + 0.78 - T)],
    arc(0, 5.72, Ri, 0.78 - T, PI / 2, 0, 22).slice(1),
  );
  g.add(cutLathe(head, { ...HALF, segments: 72, material: materials.steel, capMaterial: materials.steelCut }));

  // 主螺栓
  const studs = [];
  for (let i = 0; i <= 18; i += 1) {
    const phi = PI / 2 + (PI * i) / 18;
    const p = polar(1.2, phi, 0);
    studs.push(cylinderBetweenGeometry(v3(p.x, 5.3, p.z), v3(p.x, 5.92, p.z), 0.035, 8));
    studs.push(cylinderBetweenGeometry(v3(p.x, 5.72, p.z), v3(p.x, 5.84, p.z), 0.06, 6));
  }
  g.add(mesh(mergeGeometries(studs), materials.steelDark));

  // 进出口接管：出口位于剖切面上（±x），进口位于后方
  const nozzleProfile = profile([v2(0.2, 0), v2(0.38, 0)], [v2(0.38, 0.14)], [v2(0.29, 0.26)], [v2(0.29, 0.64)], [v2(0.2, 0.64)]);
  [1, -1].forEach((s) => {
    const n = cutLathe(nozzleProfile, { ...HALF, segments: 24, material: materials.steel, capMaterial: materials.steelCut });
    n.rotation.z = -s * PI / 2;
    n.position.set(s * 0.93, NOZZLE_Y, 0);
    g.add(n);

    const inlet = cutLathe(nozzleProfile, { segments: 24, material: materials.steel });
    const dir = polar(1, s * 0.72 * PI, 0);
    inlet.quaternion.setFromUnitVectors(v3(0, 1, 0), dir);
    inlet.position.copy(polar(0.93, s * 0.72 * PI, NOZZLE_Y));
    g.add(inlet);
  });

  // 堆内构件
  const internals = new THREE.Group();
  g.add(internals);
  const internal = (pts, mat = materials.steelBright) => internals.add(cutLathe(pts, { ...HALF, segments: 64, material: mat, capMaterial: materials.steelCut }));
  internal(profile([v2(0.8, 1.35), v2(0.86, 1.35)], [v2(0.86, 4.95)], [v2(0.97, 4.95)], [v2(0.97, 5.1)], [v2(0.8, 5.1)]), materials.steel);
  internal(rect(0, 1.52, 0.8, 1.64));
  internal(rect(0, 0.92, 0.72, 0.98));
  internal(rect(0, 3.96, 0.8, 4.04));
  internal(rect(0, 5.1, 0.97, 5.26));
  internal(rect(0, 9.52, 0.95, 9.6), materials.steelDark);

  const columns = [];
  [[-0.45, -0.3], [0.45, -0.3], [0, -0.6], [-0.2, -0.1], [0.3, -0.55], [-0.35, -0.6]].forEach(([x, z]) => {
    columns.push(cylinderBetweenGeometry(v3(x, 0.98, z), v3(x, 1.52, z), 0.03, 8));
    columns.push(cylinderBetweenGeometry(v3(x, 4.04, z), v3(x, 5.1, z), 0.035, 8));
  });
  internals.add(mesh(mergeGeometries(columns), materials.steelBright));

  // 燃料组件（实例化）
  const assemblies = [];
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -3; j <= 0; j += 1) {
      const x = i * CORE.pitch;
      const z = j * CORE.pitch;
      if (Math.hypot(Math.abs(x) + CORE.pitch / 2, Math.abs(z) + CORE.pitch / 2) > CORE.radius + 0.01) continue;
      assemblies.push({ i, j, x, z });
    }
  }
  const rodPitch = CORE.width / CORE.rods;
  const guideSet = new Set(['2,2', '2,6', '6,2', '6,6', '4,2', '2,4', '6,4', '4,6', '4,4']);
  const rodLength = CORE.top - CORE.bottom;
  const rodGeometry = new THREE.CylinderGeometry(0.0078, 0.0078, rodLength, 6);
  const guideGeometry = new THREE.CylinderGeometry(0.0098, 0.0098, rodLength + 0.08, 6);
  const fuelCount = assemblies.length * (CORE.rods * CORE.rods - guideSet.size);
  const guideCount = assemblies.length * guideSet.size;
  const fuelRods = new THREE.InstancedMesh(rodGeometry, materials.zirconium, fuelCount);
  const guideTubes = new THREE.InstancedMesh(guideGeometry, materials.guideTube, guideCount);
  const m4 = new THREE.Matrix4();
  let fi = 0;
  let gi = 0;
  const guideOffsets = [];
  assemblies.forEach((a) => {
    for (let ix = 0; ix < CORE.rods; ix += 1) {
      for (let iz = 0; iz < CORE.rods; iz += 1) {
        const px = a.x + (ix - (CORE.rods - 1) / 2) * rodPitch;
        const pz = a.z + (iz - (CORE.rods - 1) / 2) * rodPitch;
        if (guideSet.has(`${ix},${iz}`)) {
          m4.makeTranslation(px, (CORE.bottom + CORE.top) / 2, pz);
          guideTubes.setMatrixAt(gi, m4);
          gi += 1;
          if (a.i === 0 && a.j === 0 && !(ix === 4 && iz === 4)) guideOffsets.push([px - a.x, pz - a.z]);
        } else {
          m4.makeTranslation(px, (CORE.bottom + CORE.top) / 2, pz);
          fuelRods.setMatrixAt(fi, m4);
          fi += 1;
        }
      }
    }
  });
  fuelRods.castShadow = true;
  internals.add(fuelRods, guideTubes);

  // 上下管座与定位格架
  const nozzleGeom = new THREE.BoxGeometry(CORE.width, 0.06, CORE.width);
  const gridParts = [
    new THREE.BoxGeometry(CORE.width, 0.035, 0.005).translate(0, 0, CORE.width / 2),
    new THREE.BoxGeometry(CORE.width, 0.035, 0.005).translate(0, 0, -CORE.width / 2),
    new THREE.BoxGeometry(0.005, 0.035, CORE.width).translate(CORE.width / 2, 0, 0),
    new THREE.BoxGeometry(0.005, 0.035, CORE.width).translate(-CORE.width / 2, 0, 0),
  ];
  const gridGeom = mergeGeometries(gridParts);
  const gridLevels = [1.86, 2.28, 2.7, 3.12, 3.54];
  const nozzles = new THREE.InstancedMesh(nozzleGeom, materials.steelBright, assemblies.length * 2);
  const grids = new THREE.InstancedMesh(gridGeom, materials.guideTube, assemblies.length * gridLevels.length);
  let ni = 0;
  let gri = 0;
  assemblies.forEach((a) => {
    [CORE.bottom - 0.03, CORE.top + 0.06].forEach((y) => {
      m4.makeTranslation(a.x, y, a.z);
      nozzles.setMatrixAt(ni, m4);
      ni += 1;
    });
    gridLevels.forEach((y) => {
      m4.makeTranslation(a.x, y, a.z);
      grids.setMatrixAt(gri, m4);
      gri += 1;
    });
  });
  internals.add(nozzles, grids);

  // 控制棒组件（星形架 + 8 根吸收棒 + 驱动杆）
  const rccaPositions = [[0, 0], [2, 0], [-2, 0], [1, -1], [-1, -1], [0, -2], [2, -2], [-2, -2]];
  const rodParts = guideOffsets.map(([ox, oz]) => new THREE.CylinderGeometry(0.0074, 0.0074, rodLength, 6).translate(ox, rodLength / 2, oz));
  const spiderParts = [new THREE.CylinderGeometry(0.022, 0.022, 0.08, 10).translate(0, rodLength + 0.04, 0)];
  guideOffsets.forEach(([ox, oz]) => {
    spiderParts.push(cylinderBetweenGeometry(v3(0, rodLength + 0.04, 0), v3(ox, rodLength + 0.02, oz), 0.006, 4));
  });
  const shaftGeom = new THREE.CylinderGeometry(0.016, 0.016, 3.25, 8).translate(0, rodLength + 0.08 + 1.625, 0);
  const rccaGeometry = mergeGeometries([mergeGeometries(rodParts), mergeGeometries([...spiderParts, shaftGeom])], true);
  const rccaMaterials = [materials.absorber, materials.steelBright];
  const rccas = rccaPositions.map(([i, j]) => {
    const rcca = new THREE.Mesh(rccaGeometry, rccaMaterials);
    rcca.position.set(i * CORE.pitch, CORE.bottom, j * CORE.pitch);
    internals.add(rcca);
    return rcca;
  });
  rccas.forEach((r) => reg.group('controlRods').objects.push(r));

  // 控制棒导向笼（上部构件内）
  const cage = [];
  rccaPositions.forEach(([i, j]) => {
    const x = i * CORE.pitch;
    const z = j * CORE.pitch;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
      cage.push(cylinderBetweenGeometry(v3(x + a * 0.06, 4.04, z + b * 0.06), v3(x + a * 0.06, 6.15, z + b * 0.06), 0.006, 4));
    });
  });
  internals.add(mesh(mergeGeometries(cage), materials.steel));

  // 控制棒驱动机构（顶盖贯穿件）
  const crdm = [];
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -3; j <= 0; j += 1) {
      const x = i * CORE.pitch;
      const z = j * CORE.pitch;
      const rr = Math.hypot(x, z);
      if (rr > 0.78) continue;
      const yHead = 5.72 + 0.78 * Math.sqrt(Math.max(0, 1 - (rr / R) ** 2)) - 0.05;
      crdm.push(cylinderBetweenGeometry(v3(x, yHead, z), v3(x, 9.9, z), 0.052, 12));
      crdm.push(cylinderBetweenGeometry(v3(x, 7.6, z), v3(x, 8.55, z), 0.078, 12));
      crdm.push(cylinderBetweenGeometry(v3(x, 9.9, z), v3(x, 10.0, z), 0.035, 8));
    }
  }
  g.add(mesh(mergeGeometries(crdm), materials.steelBright));

  // 容器内的水
  const water = cutLathe(profile([v2(0, 0.56), v2(0.97, 0.56)], [v2(0.97, 5.44)], [v2(0, 5.44)]), { ...HALF, segments: 48, material: materials.water, capMaterial: materials.water });
  water.traverse((o) => {
    o.castShadow = false;
    o.renderOrder = 2;
  });
  g.add(water);

  // 切伦科夫辉光
  const glowMaterial = createGlowMaterial(COLORS.cherenkov, 0.8);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, rodLength + 0.3, 48, 1, true, HALF.phiStart, HALF.phiLength), glowMaterial);
  glow.position.y = (CORE.bottom + CORE.top) / 2;
  glow.renderOrder = 3;
  internals.add(glow);
  const faceGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, rodLength + 0.9),
    new THREE.MeshBasicMaterial({ map: textures.glow, color: new THREE.Color('#1c5cff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, toneMapped: false }),
  );
  faceGlow.position.set(0, (CORE.bottom + CORE.top) / 2, 0.02);
  faceGlow.renderOrder = 4;
  internals.add(faceGlow);
  const coreLight = new THREE.PointLight(0x7cc4ff, 6, 7, 1.6);
  coreLight.position.set(0, 2.8, 0.6);
  internals.add(coreLight);

  // 冷却剂流线：进口 → 下降段 → 下腔室 → 堆芯（升温）→ 上腔室 → 出口
  const rand = seededRandom(7);
  const paths = [];
  for (let k = 0; k < 28; k += 1) {
    const s = k % 2 ? 1 : -1;
    const inPhi = s * 0.72 * PI;
    const outPhi = s * 0.5 * PI;
    const endPhi = inPhi + s * (0.05 + rand() * 0.25) * PI;
    const rc = 0.08 + rand() * 0.64;
    const th = PI / 2 + rand() * PI;
    const pts = [
      polar(1.62, inPhi, NOZZLE_Y),
      polar(1.02, inPhi, NOZZLE_Y),
      polar(0.925, inPhi + (endPhi - inPhi) * 0.2, 4.0),
      polar(0.925, inPhi + (endPhi - inPhi) * 0.5, 3.0),
      polar(0.925, inPhi + (endPhi - inPhi) * 0.8, 2.0),
      polar(0.9, endPhi, 1.3),
      polar(rc * 0.7 + 0.05, th, 0.78),
      polar(rc, th, 1.45),
      polar(rc, th, 2.2),
      polar(rc, th, 3.0),
      polar(rc, th, 3.9),
      polar(rc * 0.8 + 0.1, (th + outPhi) / 2, 4.4),
      polar(0.9, outPhi + (rand() - 0.5) * 0.2, NOZZLE_Y),
      polar(1.62, outPhi, NOZZLE_Y),
    ];
    const sampled = new SampledPath(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 200);
    const low = sampled.findT((p) => p.y < 1.0);
    sampled.tIn = sampled.findT((p) => p.y > CORE.bottom, low);
    sampled.tOut = sampled.findT((p) => p.y > CORE.top, sampled.tIn);
    paths.push(sampled);
  }
  let hotColor = COLORS.hot.clone();
  reg.stream(g, {
    curves: paths,
    count: 320,
    size: 0.03,
    speed: 1.1,
    group: 'coreFlow',
    kind: 'primary',
    colorFn: (t, pi, out) => {
      const p = paths[pi];
      if (t < p.tIn) return out.copy(COLORS.cold).multiplyScalar(1.3);
      const k = THREE.MathUtils.clamp((t - p.tIn) / (p.tOut - p.tIn), 0, 1);
      return out.copy(COLORS.cold).lerp(hotColor, k).multiplyScalar(1.3 + k * 0.8);
    },
  });

  // 中子（在堆芯内随机游走）
  const neutronCount = 160;
  const neutrons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.0), toneMapped: false }),
    neutronCount,
  );
  neutrons.frustumCulled = false;
  internals.add(neutrons);
  const nState = Array.from({ length: neutronCount }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }));
  const respawn = (n) => {
    const rr = Math.sqrt(rand()) * 0.74;
    const th = PI / 2 + rand() * PI;
    n.p.copy(polar(rr, th, CORE.bottom + 0.1 + rand() * (ROD_TRAVEL - 0.2)));
    n.v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.8 + rand() * 1.4);
    n.life = 0.25 + rand() * 0.8;
  };
  nState.forEach(respawn);
  const nScale = new THREE.Vector3();
  const nQuat = new THREE.Quaternion();

  reg.onUpdate((dt, sim) => {
    hotColor = sim.hotColor;
    // 控制棒插入深度
    const y = CORE.bottom + (1 - sim.rod) * ROD_TRAVEL;
    rccas.forEach((r) => {
      r.position.y = y;
    });
    const fission = sim.fission;
    glowMaterial.uniforms.uIntensity.value = 0.12 + fission * 1.0;
    glowMaterial.uniforms.uTime.value = sim.time;
    faceGlow.material.opacity = 0.05 + fission * 0.45;
    coreLight.intensity = 1 + fission * 9;
    materials.zirconium.emissiveIntensity = 0.04 + sim.power * 0.35;

    const visible = Math.round(neutronCount * Math.min(1, fission * 1.1));
    neutrons.count = visible;
    for (let i = 0; i < visible; i += 1) {
      const n = nState[i];
      n.life -= dt;
      n.p.addScaledVector(n.v, dt);
      const rr = Math.hypot(n.p.x, n.p.z);
      if (n.life <= 0 || rr > 0.78 || n.p.y < CORE.bottom || n.p.y > CORE.top || n.p.z > 0.1) respawn(n);
      if (rand() < dt * 4) n.v.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(0.8 + rand() * 1.4);
      nScale.setScalar(0.014 + Math.sin(n.life * 20) * 0.003);
      m4.compose(n.p, nQuat, nScale);
      neutrons.setMatrixAt(i, m4);
    }
    neutrons.instanceMatrix.needsUpdate = true;
  });

  reg.label(g, v3(-1.35, 6.55, 0.15), { title: '反应堆压力容器', sub: '15.5 MPa · 第二道屏障', steps: [0, 2, 3] });
  reg.label(g, v3(0.95, 3.3, 0.2), { title: '堆芯 · 燃料组件', sub: '157 组 × 264 根燃料棒', steps: [2] });
  reg.label(g, v3(-0.35, 6.25, 0.15), { title: '控制棒组件', sub: '银铟镉吸收中子', steps: [2] });
  reg.label(g, v3(0, 10.1, 0), { title: '控制棒驱动机构', sub: '提升/插入控制棒', steps: [2] });
  reg.label(g, v3(-1.0, 2.2, 0.2), { title: '下降段', sub: '冷水沿环隙向下', steps: [2], tone: 'cold' });
  reg.label(g, v3(-0.35, 1.2, 0.2), { title: '下腔室 → 向上流经堆芯', sub: '吸热升温 292→327 °C', steps: [2], tone: 'hot' });
}

/* ------------------------------------------------------------------ */
/* 蒸汽发生器（立式 U 形管）                                           */
/* ------------------------------------------------------------------ */
class UBendCurve extends THREE.Curve {
  constructor(d, top, z) {
    super();
    this.d = d;
    this.top = top;
    this.z = z;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = PI * t;
    return target.set(-Math.cos(a) * this.d, this.top + Math.sin(a) * this.d, this.z);
  }
}

function buildSteamGenerator(reg, root, s) {
  const g = new THREE.Group();
  g.position.set(s * SG_X, 0, 0);
  root.add(g);
  reg.equipment('sg', g, 4);
  const body = new THREE.Group();
  body.scale.x = s; // 标准模型热侧朝 -x；A 列镜像使热侧都朝向反应堆
  g.add(body);

  const shell = profile(
    arc(0, 5.7, 0.95, 0.95, -PI / 2, 0, 18),
    [v2(0.95, 9.4)],
    [v2(1.2, 10.2)],
    [v2(1.2, 11.9)],
    arc(0, 11.9, 1.2, 0.65, 0, PI / 2, 18).slice(1),
    [v2(0, 12.47)],
    arc(0, 11.9, 1.12, 0.57, PI / 2, 0, 18).slice(1),
    [v2(1.12, 10.22)],
    [v2(0.87, 9.42)],
    [v2(0.87, 5.7)],
    arc(0, 5.7, 0.87, 0.87, 0, -PI / 2, 18).slice(1),
  );
  body.add(cutLathe(shell, { ...HALF, segments: 64, material: materials.steel, capMaterial: materials.steelCut }));
  body.add(cutLathe(rect(0, 5.6, 0.87, 5.86), { ...HALF, segments: 48, material: materials.steelDark, capMaterial: materials.steelCut }));
  body.add(cutLathe(rect(0.16, 12.35, 0.26, 12.9), { ...HALF, segments: 24, material: materials.steel, capMaterial: materials.steelCut }));

  // 水室隔板
  const divider = new THREE.Mesh(new THREE.CircleGeometry(0.86, 20, PI, PI / 2), materials.steelDark);
  divider.rotation.y = -PI / 2;
  divider.position.y = 5.62;
  body.add(divider);

  // 管束围板与支撑板
  body.add(cutLathe(rect(0.74, 6.05, 0.77, 9.5), { ...HALF, segments: 48, material: materials.steelDark, capMaterial: materials.steelCut }));
  [6.7, 7.45, 8.2].forEach((y) => body.add(cutLathe(rect(0, y, 0.74, y + 0.025), { ...HALF, segments: 40, material: materials.steelBright, capMaterial: materials.steelCut })));

  // U 形传热管：热段（靠反应堆一侧）→ U 弯 → 冷段
  const tubes = [];
  const ds = [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66];
  const zs = [-0.02, -0.15, -0.28, -0.41, -0.54];
  zs.forEach((z) => {
    ds.forEach((d) => {
      if (Math.hypot(d, z) > 0.7) return;
      const top = 8.7;
      const path = new THREE.CurvePath();
      path.add(new THREE.LineCurve3(v3(-d, 5.86, z), v3(-d, top, z)));
      path.add(new UBendCurve(d, top, z));
      path.add(new THREE.LineCurve3(v3(d, top, z), v3(d, 5.86, z)));
      tubes.push(fluidTubeGeometry(path, 0.02, { perUnit: 5, radial: 6 }));
    });
  });
  const uTubes = reg.fluidBundle(body, mergeGeometries(tubes), { group: 'sgTubes', colorA: COLORS.hot, colorB: COLORS.cold, speed: 1.3, spacing: 0.7, kind: 'primary', intensity: 1.7 });

  // 二回路水
  const waterPts = profile([v2(0, 5.86), v2(0.87, 5.86)], [v2(0.87, 9.42)], [v2(1.02, 9.9)], [v2(0, 9.9)]);
  const water = cutLathe(waterPts, { ...HALF, segments: 48, material: materials.water, capMaterial: materials.water });
  water.traverse((o) => {
    o.castShadow = false;
    o.renderOrder = 2;
  });
  body.add(water);

  // 给水环
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.93, 0.04, 8, 36, PI), materials.steelBright);
  ring.rotation.x = -PI / 2;
  ring.position.y = 9.7;
  body.add(ring);
  body.add(cylinderBetween(v3(0, 9.7, -0.93), v3(0, 9.7, -1.4), 0.07, materials.steel));

  // 汽水分离器与干燥器
  body.add(cutLathe(rect(0, 10.28, 1.1, 10.33), { ...HALF, segments: 40, material: materials.steelBright, capMaterial: materials.steelCut }));
  const separators = [[-0.5, -0.32], [0.5, -0.32], [0, -0.74]];
  separators.forEach(([x, z]) => {
    const c = cylinder(0.2, 0.2, 0.85, materials.steel, { segments: 20, open: true });
    c.position.set(x, 10.76, z);
    body.add(c);
    const vane = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 20), materials.steelDark);
    vane.rotation.x = PI / 2;
    vane.position.set(x, 10.5, z);
    body.add(vane);
  });
  for (let k = 0; k < 9; k += 1) {
    const slat = box(0.015, 0.42, 0.7, materials.steelBright, -0.72 + k * 0.18, 11.45, -0.45);
    slat.rotation.y = k % 2 ? 0.4 : -0.4;
    body.add(slat);
  }

  // 沸腾气泡与蒸汽上升
  const rand = seededRandom(31 + s);
  const steamPaths = [];
  for (let k = 0; k < 20; k += 1) {
    const x = (rand() - 0.5) * 1.2;
    const z = -rand() * 0.62;
    const [sx, sz] = separators[k % 3];
    const pts = [
      v3(x, 6.0 + rand() * 0.8, z),
      v3(x + (rand() - 0.5) * 0.1, 7.6, z),
      v3(x * 0.9 + (rand() - 0.5) * 0.1, 8.8, z),
      v3(x * 0.8, 9.9, z),
      v3(sx, 10.35, sz),
      v3(sx, 11.15, sz),
      v3((rand() - 0.5) * 0.9, 11.8, -0.2 - rand() * 0.4),
      v3(0, 12.3, -0.08),
      v3(0, 12.9, -0.08),
    ];
    const sp = new SampledPath(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 120);
    sp.tLevel = sp.findT((p) => p.y > 9.9);
    steamPaths.push(sp);
  }
  const bubble = new THREE.Color('#9fd8ff').multiplyScalar(1.4);
  const steamC = new THREE.Color('#ffffff').multiplyScalar(1.6);
  reg.stream(body, {
    curves: steamPaths,
    count: 170,
    size: 0.03,
    speed: 0.9,
    group: 'sgSteam',
    kind: 'steam',
    colorFn: (t, pi, out) => (t < steamPaths[pi].tLevel ? out.copy(bubble) : out.copy(steamC)),
    sizeFn: (t, pi) => (t < steamPaths[pi].tLevel ? 0.8 : 1.35),
  });
  const recirc = [];
  for (let k = 0; k < 8; k += 1) {
    const phi = PI / 2 + (k + 0.5) * (PI / 8);
    recirc.push(new THREE.CatmullRomCurve3([polar(1.0, phi, 9.95), polar(0.81, phi, 9.3), polar(0.81, phi, 6.4), polar(0.5, phi, 5.98), polar(0.2, phi, 6.3)]));
  }
  reg.stream(body, {
    curves: recirc,
    count: 44,
    size: 0.026,
    speed: 0.7,
    group: 'sgSteam',
    kind: 'steam',
    colorFn: (t, pi, out) => out.copy(COLORS.feed).multiplyScalar(1.3),
  });

  reg.onUpdate((dt, sim) => {
    uTubes.material.uniforms.uColorA.value.copy(sim.hotColor);
  });

  if (s === 1) {
    reg.label(g, v3(0, 13.15, 0), { title: '蒸汽发生器', sub: '一回路热量 → 二回路蒸汽', steps: [0, 3, 4] });
    reg.label(g, v3(0.05, 9.45, 0.05), { title: 'U 形传热管', sub: '管内一回路水 · 管外二回路水', steps: [4], tone: 'hot' });
    reg.label(g, v3(0.9, 10.1, 0.05), { title: '水位 · 沸腾区', sub: '6.9 MPa 下约 285 °C 沸腾', steps: [4] });
    reg.label(g, v3(0, 12.0, 0.05), { title: '汽水分离器 / 干燥器', sub: '输出干饱和蒸汽', steps: [4] });
    reg.label(g, v3(-0.6, 4.7, 0.1), { title: '水室（热侧 / 冷侧）', sub: '隔板分开进出口', steps: [4] });
  }
}

/* ------------------------------------------------------------------ */
/* 稳压器                                                              */
/* ------------------------------------------------------------------ */
function buildPressurizer(reg, root) {
  const g = new THREE.Group();
  g.position.copy(PRZ);
  root.add(g);
  reg.equipment('pressurizer', g, 3);
  const pts = profile(
    arc(0, 5.3, 0.62, 0.62, -PI / 2, 0, 16),
    [v2(0.62, 10.3)],
    arc(0, 10.3, 0.62, 0.62, 0, PI / 2, 16).slice(1),
    [v2(0, 10.85)],
    arc(0, 10.3, 0.55, 0.55, PI / 2, 0, 16).slice(1),
    [v2(0.55, 5.3)],
    arc(0, 5.3, 0.55, 0.55, 0, -PI / 2, 16).slice(1),
  );
  g.add(cutLathe(pts, { ...HALF, segments: 48, material: materials.steel, capMaterial: materials.steelCut }));
  const water = cutLathe(profile(arc(0, 5.3, 0.54, 0.54, -PI / 2, 0, 12), [v2(0.54, 8.4)], [v2(0, 8.4)]), { ...HALF, segments: 40, material: materials.hotWater, capMaterial: materials.hotWater });
  const steam = cutLathe(profile([v2(0, 8.4), v2(0.54, 8.4)], [v2(0.54, 10.3)], arc(0, 10.3, 0.54, 0.54, 0, PI / 2, 12).slice(1)), { ...HALF, segments: 40, material: materials.steamVolume, capMaterial: materials.steamVolume });
  [water, steam].forEach((o) => o.traverse((c) => {
    c.castShadow = false;
    c.renderOrder = 2;
  }));
  g.add(water, steam);

  // 电加热器
  const heaters = [];
  for (let i = 0; i < 7; i += 1) {
    const a = PI / 2 + (i / 6) * PI;
    const p = polar(0.3, a, 0);
    heaters.push(cylinderBetweenGeometry(v3(p.x, 4.55, p.z), v3(p.x, 5.9, p.z), 0.022, 8));
  }
  g.add(mesh(mergeGeometries(heaters), materials.heater));
  g.add(cylinderBetween(v3(0, 10.9, 0), v3(0, 10.35, 0), 0.05, materials.steelBright));
  g.add(cylinderBetween(v3(0.3, 10.7, -0.2), v3(0.3, 11.3, -0.2), 0.08, materials.steelDark));
  g.add(cylinderBetween(v3(-0.3, 10.7, -0.2), v3(-0.3, 11.3, -0.2), 0.08, materials.steelDark));

  const spray = [];
  for (let k = 0; k < 10; k += 1) {
    const a = PI / 2 + (k / 9) * PI;
    spray.push(new THREE.LineCurve3(v3(0, 10.3, 0), polar(0.1 + (k % 3) * 0.14, a, 8.45)));
  }
  reg.stream(g, {
    curves: spray,
    count: 36,
    size: 0.022,
    speed: 1.6,
    group: 'primary',
    kind: 'primary',
    colorFn: (t, pi, out) => out.copy(COLORS.cold).multiplyScalar(1.5),
  });
  reg.onUpdate((dt, sim) => {
    materials.heater.emissiveIntensity = 0.8 + Math.sin(sim.time * 3) * 0.4;
  });

  reg.label(g, v3(0, 11.45, 0), { title: '稳压器', sub: '加热/喷淋维持 15.5 MPa，防止沸腾', steps: [0, 3] });
}

/* ------------------------------------------------------------------ */
/* 主泵                                                                */
/* ------------------------------------------------------------------ */
function buildPump(reg, root, s) {
  const g = new THREE.Group();
  g.position.set(s * PUMP_X, 0, PUMP_Z);
  root.add(g);
  reg.equipment('rcp', g, 3);
  const casing = mesh(new THREE.SphereGeometry(0.56, 32, 18), materials.steel);
  casing.scale.y = 0.78;
  casing.position.y = 3.8;
  g.add(casing);
  g.add(cylinderBetween(v3(0, 3.5, 0), v3(0, 3.0, 0), 0.26, materials.steel, 24));
  const toRPV = v3(-s * PUMP_X, 0, -PUMP_Z).normalize();
  g.add(cylinderBetween(v3(0, 3.8, 0), toRPV.clone().multiplyScalar(0.72).setY(3.8), 0.26, materials.steel, 24));
  const plate = (y) => {
    const c = cylinder(0.5, 0.5, 0.07, materials.steelDark, { segments: 32 });
    c.position.y = y;
    g.add(c);
  };
  plate(4.22);
  plate(4.92);
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * PI * 2 + PI / 4;
    g.add(cylinderBetween(v3(Math.sin(a) * 0.4, 4.22, Math.cos(a) * 0.4), v3(Math.sin(a) * 0.4, 4.92, Math.cos(a) * 0.4), 0.045, materials.steelDark));
  }
  const shaft = new THREE.Group();
  shaft.position.y = 4.57;
  const shaftMesh = cylinder(0.07, 0.07, 0.75, materials.steelBright, { segments: 16 });
  const coupling = cylinder(0.17, 0.17, 0.16, materials.crane, { segments: 20 });
  const mark = box(0.05, 0.18, 0.36, materials.steelDark, 0, 0, 0);
  shaft.add(shaftMesh, coupling, mark);
  g.add(shaft);
  const motor = cylinder(0.52, 0.52, 1.5, materials.motor, { segments: 36 });
  motor.position.y = 5.7;
  g.add(motor);
  const ribs = [];
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * PI * 2;
    ribs.push(new THREE.BoxGeometry(0.06, 1.3, 0.05).translate(Math.sin(a) * 0.54, 5.7, Math.cos(a) * 0.54));
  }
  g.add(mesh(mergeGeometries(ribs), materials.motor));
  const cap = mesh(new THREE.SphereGeometry(0.52, 32, 12, 0, PI * 2, 0, PI / 2), materials.motor);
  cap.scale.y = 0.4;
  cap.position.y = 6.45;
  g.add(cap);

  reg.onUpdate((dt) => {
    shaft.rotation.y += dt * 14;
  });
  if (s === 1) reg.label(g, v3(0, 6.95, 0), { title: '主泵', sub: '推动冷却剂循环 · 流量恒定', steps: [3] });
}

/* ------------------------------------------------------------------ */
/* 一回路管道                                                          */
/* ------------------------------------------------------------------ */
function buildPrimaryPiping(reg, root) {
  const hotLegs = [];
  [1, -1].forEach((s) => {
    const hot = reg.fluid(root, roundedPath([v3(s * 1.55, NOZZLE_Y, 0), v3(s * (SG_X - 0.9), NOZZLE_Y, 0), v3(s * (SG_X - 0.4), 5.1, 0)], 0.4), {
      group: 'primary',
      radius: 0.27,
      colorA: COLORS.hot,
      speed: 1.3,
      kind: 'primary',
    });
    hotLegs.push(hot);
    reg.fluid(root, roundedPath([
      v3(s * (SG_X + 0.4), 5.05, 0),
      v3(s * (SG_X + 0.4), 2.2, 0),
      v3(s * (SG_X + 0.4), 2.2, PUMP_Z),
      v3(s * PUMP_X, 2.2, PUMP_Z),
      v3(s * PUMP_X, 3.1, PUMP_Z),
    ], 0.4), { group: 'primary', radius: 0.25, colorA: COLORS.cold, speed: 1.3, kind: 'primary' });

    const pump = v3(s * PUMP_X, 3.8, PUMP_Z);
    const end = polar(1.57, s * 0.72 * PI, NOZZLE_Y);
    const dir = end.clone().sub(pump).setY(0).normalize();
    const start = pump.clone().addScaledVector(dir, 0.7);
    const len = end.clone().setY(0).distanceTo(start.clone().setY(0));
    reg.fluid(root, roundedPath([
      start,
      start.clone().addScaledVector(dir, len * 0.3),
      start.clone().addScaledVector(dir, len * 0.62).setY(NOZZLE_Y),
      end,
    ], 0.35), { group: 'primary', radius: 0.25, colorA: COLORS.cold, speed: 1.3, kind: 'primary' });
  });

  const surge = reg.fluid(root, roundedPath([
    v3(PRZ.x, 4.68, PRZ.z),
    v3(PRZ.x, 3.0, PRZ.z),
    v3(2.55, 3.0, PRZ.z),
    v3(2.55, 3.0, 0),
    v3(2.55, 4.3, 0),
  ], 0.3), { group: 'primary', radius: 0.1, colorA: COLORS.hot, speed: 0.4, kind: 'primary' });
  hotLegs.push(surge);

  reg.onUpdate((dt, sim) => {
    hotLegs.forEach((h) => h.material.uniforms.uColorA.value.copy(sim.hotColor));
    hotLegs.forEach((h) => h.material.uniforms.uColorB.value.copy(sim.hotColor));
  });

  reg.label(root, v3(2.7, 4.95, 0.3), { title: '热段', sub: '≈327 °C → 蒸汽发生器', steps: [3], tone: 'hot' });
  reg.label(root, v3(4.8, 2.7, -1.3), { title: '冷段（过渡段 → 主泵 → 堆芯）', sub: '≈292 °C', steps: [3], tone: 'cold' });
}

/* ------------------------------------------------------------------ */
/* 放大的燃料棒剖面（仅“堆芯”阶段显示）                                */
/* ------------------------------------------------------------------ */
function buildFuelRodCallout(reg, root) {
  const g = new THREE.Group();
  g.position.set(-2.9, 2.2, 3.1);
  g.rotation.y = 0.35;
  root.add(g);
  const clad = new THREE.MeshPhysicalMaterial({
    color: 0xd3dde6,
    metalness: 0.6,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  g.add(cutLathe(rect(0.15, 0, 0.18, 3.6), { ...HALF, segments: 40, material: clad, capMaterial: materials.steelCut }));
  const pelletMat = new THREE.MeshStandardMaterial({ color: 0x3a2b24, roughness: 0.7, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0.6 });
  const pellets = [];
  for (let i = 0; i < 12; i += 1) {
    pellets.push(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 24).translate(0, 0.25 + i * 0.215, 0));
  }
  const pelletMesh = mesh(mergeGeometries(pellets), pelletMat);
  g.add(pelletMesh);
  // 压紧弹簧
  const helix = [];
  for (let i = 0; i <= 120; i += 1) {
    const a = i * 0.42;
    helix.push(v3(Math.cos(a) * 0.1, 2.9 + (i / 120) * 0.55, Math.sin(a) * 0.1));
  }
  g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 240, 0.014, 6), materials.steelBright));
  const plugTop = cylinder(0.18, 0.12, 0.25, clad, { segments: 24 });
  plugTop.position.y = 3.72;
  const plugBottom = cylinder(0.12, 0.18, 0.25, clad, { segments: 24 });
  plugBottom.position.y = -0.12;
  g.add(plugTop, plugBottom);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, color: 0xff7a2a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(1.6, 3.4, 1);
  halo.position.y = 1.5;
  g.add(halo);
  reg.stepVisible.push({ object: g, steps: [2] });
  reg.onUpdate((dt, sim) => {
    pelletMat.emissiveIntensity = 0.15 + sim.power * 0.7;
    halo.material.opacity = 0.1 + sim.power * 0.3;
  });
  reg.label(g, v3(0, 4.15, 0), { title: '燃料棒剖面（放大）', sub: '锆合金包壳 · 第一道屏障', steps: [2] });
  reg.label(g, v3(0.55, 1.2, 0), { title: 'UO₂ 燃料芯块', sub: 'Ø 8 mm · 铀-235 富集约 4%', steps: [2], tone: 'hot' });
}
