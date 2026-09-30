import * as THREE from 'three';
import { COLORS, createGroundTexture, materials } from '../core/materials.js';
import { box, cylinder, cylinderBetweenGeometry, mergeGeometries, mesh, roundedPath, v3 } from '../core/geometry.js';
import { SG_X, toWorld } from './reactorBuilding.js';
import { FEED } from './turbineIsland.js';

const PI = Math.PI;
export const HALL = { x0: -4, x1: 30, z0: -6.5, z1: 6.5, h: 13 };

export function buildEnvironment(scene) {
  // 渐变天空
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#050910') },
        horizon: { value: new THREE.Color('#1b2a3b') },
        bottom: { value: new THREE.Color('#0a0f15') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 bottom;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(min(1.0, h * 1.6), 0.7)) : mix(horizon, bottom, min(1.0, -h * 6.0));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  const groundMat = new THREE.MeshStandardMaterial({ map: createGroundTexture(), roughness: 0.95, metalness: 0.02 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), groundMat);
  ground.rotation.x = -PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  scene.add(ground);
  const far = new THREE.Mesh(new THREE.RingGeometry(109, 420, 64), new THREE.MeshStandardMaterial({ color: 0x141d18, roughness: 1 }));
  far.rotation.x = -PI / 2;
  far.position.y = -0.05;
  scene.add(far);
}

export function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x1a1f24, 0.75));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.3);
  key.position.set(-30, 60, 40);
  key.target.position.set(10, 0, -8);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 160;
  key.shadow.camera.left = -60;
  key.shadow.camera.right = 60;
  key.shadow.camera.top = 50;
  key.shadow.camera.bottom = -50;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.7);
  fill.position.set(50, 25, -30);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x9fe8d8, 0.5);
  rim.position.set(0, 20, 60);
  scene.add(rim);
}

/* 汽轮机厂房：钢框架 + 局部透明围护，前立面与屋面前半开敞 */
export function buildTurbineHall(reg) {
  const root = new THREE.Group();
  const { x0, x1, z0, z1, h } = HALL;
  root.add(box(x1 - x0, 0.06, z1 - z0, materials.concretePlain, (x0 + x1) / 2, 0.02, 0));

  // 钢框架：前排柱子剖去，只保留后排与半幅屋架（剖视效果）
  const frame = [];
  const stubs = [];
  for (let x = x0; x <= x1 + 0.01; x += 4.25) {
    frame.push(new THREE.BoxGeometry(0.4, h, 0.5).translate(x, h / 2, z0));
    stubs.push(new THREE.BoxGeometry(0.4, 1.2, 0.5).translate(x, 0.6, z1));
    frame.push(new THREE.BoxGeometry(0.3, 0.7, -z0).translate(x, h - 0.1, z0 / 2));
    frame.push(new THREE.BoxGeometry(0.2, 0.2, -z0).translate(x, h - 1.2, z0 / 2));
    for (let k = 0; k < 3; k += 1) {
      const za = z0 + (-z0 * k) / 3;
      const zb = z0 + (-z0 * (k + 1)) / 3;
      frame.push(cylinderBetweenGeometry(v3(x, h - 1.2, za), v3(x, h - 0.2, zb), 0.05, 4));
    }
  }
  frame.push(new THREE.BoxGeometry(x1 - x0, 0.5, 0.4).translate((x0 + x1) / 2, h - 0.1, z0));
  frame.push(new THREE.BoxGeometry(x1 - x0, 0.45, 0.6).translate((x0 + x1) / 2, 11.0, z0 * 0.95));
  frame.push(new THREE.BoxGeometry(x1 - x0, 0.4, 0.3).translate((x0 + x1) / 2, h - 0.1, 0));
  root.add(mesh(mergeGeometries(frame), materials.hall));
  root.add(mesh(mergeGeometries(stubs), materials.concreteCut));

  // 围护：后墙、两端山墙、半幅屋面
  const shell = new THREE.Group();
  const back = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, h), materials.hallGlass);
  back.position.set((x0 + x1) / 2, h / 2, z0 - 0.02);
  const lower = box(x1 - x0, 2.4, 0.15, materials.buildingDark, (x0 + x1) / 2, 1.2, z0 - 0.1);
  [x0, x1].forEach((x) => {
    const end = new THREE.Mesh(new THREE.PlaneGeometry(-z0, h), materials.hallGlass);
    end.rotation.y = PI / 2;
    end.position.set(x, h / 2, z0 / 2);
    shell.add(end);
  });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, (z1 - z0) / 2), materials.hallGlass);
  roof.rotation.x = -PI / 2;
  roof.position.set((x0 + x1) / 2, h + 0.3, z0 / 2);
  shell.add(back, lower, roof);
  root.add(shell);
  reg.shells.push(shell);
  reg.label(root, v3(x1 - 2, h + 0.8, z0), { title: '汽轮机厂房', sub: '常规岛', steps: [0] });
  return root;
}

// 辅助建筑与烟囱（场景语境）
export function buildAuxiliary(reg) {
  const root = new THREE.Group();
  const add = (w, hgt, d, x, z, mat = materials.building) => {
    const b = box(w, hgt, d, mat, x, hgt / 2, z);
    root.add(b);
    return b;
  };
  add(15, 9, 7, -16, -13.5);
  add(15.2, 0.4, 7.2, -16, -13.5, materials.buildingDark).position.y = 9.1;
  add(6, 12, 10, -27.5, -3);
  add(8, 7, 5.5, -6, -12.5, materials.buildingDark);
  add(10, 4, 5, 25, -13, materials.building);
  add(6, 3, 4, 37, 8.5, materials.buildingDark);
  const stack = cylinder(0.55, 0.85, 28, materials.concrete, { segments: 24 });
  stack.position.set(-8, 14, -18.5);
  root.add(stack);
  const band = cylinder(0.6, 0.6, 1, new THREE.MeshStandardMaterial({ color: 0xc8432e, roughness: 0.6 }), { segments: 24 });
  band.position.set(-8, 27, -18.5);
  root.add(band);
  reg.label(root, v3(-6, 7.5, -12.5), { title: '主控室', sub: '电气厂房', steps: [0] });
  return root;
}

/* 核岛与常规岛之间的主蒸汽 / 主给水管道 */
export function buildPlantPiping(reg, root) {
  const steam = { group: 'mainSteam', radius: 0.22, colorA: COLORS.steam, speed: 3.0, kind: 'steam', spacing: 1.1 };
  const feed = { group: 'feedwater', radius: 0.15, colorA: COLORS.feed, speed: 1.4, kind: 'feed' };
  // B 列（+x 蒸汽发生器）走 z = +1.3 通道，A 列走 z = -1.3
  reg.fluid(root, roundedPath([
    toWorld(SG_X, 12.85, 0),
    toWorld(SG_X, 13.2, 0),
    toWorld(SG_X, 13.2, 1.3),
    toWorld(5.8, 13.2, 1.3),
    toWorld(5.8, 10.0, 1.3),
    v3(-2.5, 10.0, 1.3),
    v3(-2.5, 7.4, 1.3),
    v3(2.0, 7.4, 1.3),
    v3(2.0, 7.4, 0.5),
    v3(2.0, 6.1, 0.5),
  ], 0.45), steam);
  reg.fluid(root, roundedPath([
    toWorld(-SG_X, 12.85, 0),
    toWorld(-SG_X, 13.6, 0),
    toWorld(-SG_X, 13.6, -1.3),
    toWorld(5.8, 13.6, -1.3),
    toWorld(5.8, 10.0, -1.3),
    v3(-2.5, 10.0, -1.3),
    v3(-2.5, 7.4, -1.3),
    v3(2.0, 7.4, -1.3),
    v3(2.0, 7.4, -0.5),
    v3(2.0, 6.1, -0.5),
  ], 0.45), steam);

  const hh = FEED.hpHeater;
  reg.fluid(root, roundedPath([
    v3(hh.x + 0.15, 3.5, hh.z + 0.15),
    v3(hh.x + 0.15, 8.6, hh.z + 0.15),
    v3(hh.x + 0.15, 8.6, -2.4),
    toWorld(SG_X, 8.6, -2.4),
    toWorld(SG_X, 9.7, -2.4),
    toWorld(SG_X, 9.7, -1.4),
  ], 0.4), feed);
  reg.fluid(root, roundedPath([
    v3(hh.x - 0.15, 3.5, hh.z - 0.15),
    v3(hh.x - 0.15, 8.2, hh.z - 0.15),
    v3(hh.x - 0.15, 8.2, -3.0),
    toWorld(-SG_X, 8.2, -3.0),
    toWorld(-SG_X, 9.7, -3.0),
    toWorld(-SG_X, 9.7, -1.4),
  ], 0.4), feed);

  reg.label(root, v3(-5.0, 10.6, 1.3), { title: '主蒸汽管道', sub: '≈ 285 °C · 6.7 MPa 饱和蒸汽', steps: [0, 4, 5] });
  reg.label(root, v3(-5.0, 8.9, -2.7), { title: '主给水管道', sub: '≈ 225 °C 给水返回', steps: [4, 7], tone: 'cold' });
}
