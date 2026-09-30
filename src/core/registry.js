import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { SampledPath, fluidTubeGeometry, mesh } from './geometry.js';
import { createFluidMaterial, materials } from './materials.js';

// 场景注册表：按“系统”分组，统一管理高亮、标签、流体与每帧动画
export class Registry {
  constructor() {
    this.groups = new Map();
    this.labels = [];
    this.fluids = [];
    this.streams = [];
    this.updaters = [];
    this.pickables = [];
    this.shells = [];
    this.stepVisible = [];
  }

  group(name) {
    if (!this.groups.has(name)) this.groups.set(name, { name, objects: [] });
    return this.groups.get(name);
  }

  // 注册设备：用于轮廓高亮与点击跳转
  equipment(name, object, step) {
    this.group(name).objects.push(object);
    if (step !== undefined) {
      object.userData.step = step;
      this.pickables.push(object);
    }
    return object;
  }

  onUpdate(fn) {
    this.updaters.push(fn);
  }

  label(parent, position, { title, sub = '', steps = [], tone = '' }) {
    const element = document.createElement('div');
    element.className = `scene-label ${tone}`;
    element.innerHTML = `<div class="scene-label-card"><strong>${title}</strong>${sub ? `<span>${sub}</span>` : ''}</div><i class="scene-label-stem"></i>`;
    const object = new CSS2DObject(element);
    object.center.set(0.5, 1);
    object.position.copy(position);
    parent.add(object);
    const entry = { object, element, steps };
    this.labels.push(entry);
    return entry;
  }

  // 流体管：透明管壁 + 内部流动条纹
  fluid(parent, curve, { group, radius = 0.16, colorA, colorB, speed = 1.6, shell = true, shellRadius, perUnit, stripe, spacing, intensity, kind = 'water' }) {
    const material = createFluidMaterial({ colorA, colorB, stripe, spacing, intensity: intensity ?? (kind === 'steam' ? 0.8 : 1.5) });
    const core = mesh(fluidTubeGeometry(curve, radius * 0.62, { perUnit }), material, { cast: false, receive: false });
    parent.add(core);
    let shellMesh = null;
    if (shell) {
      shellMesh = mesh(new THREE.TubeGeometry(curve, Math.max(8, Math.ceil(curve.getLength() * 5)), shellRadius || radius, 16, false), materials.pipeShell, { cast: false, receive: false });
      parent.add(shellMesh);
    }
    const entry = { group, material, speed, kind, core, shell: shellMesh, curve, dim: 1 };
    this.fluids.push(entry);
    return entry;
  }

  // 由多条管段合并而成的流体束（例如 U 形管束、冷凝器管束）
  fluidBundle(parent, geometry, { group, colorA, colorB, speed = 1.2, stripe, spacing, intensity, kind = 'water' }) {
    const material = createFluidMaterial({ colorA, colorB, stripe, spacing, intensity });
    const core = mesh(geometry, material, { cast: false, receive: false });
    parent.add(core);
    const entry = { group, material, speed, kind, core, dim: 1 };
    this.fluids.push(entry);
    return entry;
  }

  stream(parent, options) {
    const stream = new ParticleStream(options);
    parent.add(stream.mesh);
    this.streams.push(stream);
    return stream;
  }
}

const particleGeometry = new THREE.SphereGeometry(1, 10, 8);
const tmpColor = new THREE.Color();
const tmpPos = new THREE.Vector3();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

// 沿路径运动的发光粒子流（实例化渲染）
export class ParticleStream {
  constructor({ curves, count = 60, size = 0.05, speed = 1, colorFn, group, jitter = 0, kind = 'water', sizeFn, seed = 1 }) {
    this.paths = curves.map((c) => (c instanceof SampledPath ? c : new SampledPath(c)));
    this.count = count;
    this.size = size;
    this.speed = speed;
    this.colorFn = colorFn || ((t, path, out) => out.set(0xffffff));
    this.sizeFn = sizeFn;
    this.group = group;
    this.kind = kind;
    this.dim = 1;
    this.density = 1;
    this.material = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(particleGeometry, this.material, count);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.frustumCulled = false;
    let s = seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    this.particles = Array.from({ length: count }, (_, i) => ({
      path: i % this.paths.length,
      t: rand(),
      rate: 0.75 + rand() * 0.5,
      offset: new THREE.Vector3((rand() - 0.5) * jitter, (rand() - 0.5) * jitter, (rand() - 0.5) * jitter),
    }));
    this.rand = rand;
  }

  update(dt, { speedMul = 1, density = 1, intensity = 1 }) {
    const visible = Math.max(0, Math.min(this.count, Math.round(this.count * density)));
    this.mesh.count = visible;
    const light = intensity * this.dim;
    for (let i = 0; i < visible; i += 1) {
      const p = this.particles[i];
      const path = this.paths[p.path];
      p.t += (dt * this.speed * speedMul * p.rate) / path.length;
      if (p.t > 1) {
        p.t -= 1;
        p.path = Math.floor(this.rand() * this.paths.length);
      }
      const current = this.paths[p.path];
      current.at(p.t, tmpPos).add(p.offset);
      const s = this.sizeFn ? this.sizeFn(p.t, p.path) * this.size : this.size;
      tmpScale.setScalar(s);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      this.mesh.setMatrixAt(i, tmpMatrix);
      this.colorFn(p.t, p.path, tmpColor, tmpPos);
      tmpColor.multiplyScalar(light);
      this.mesh.setColorAt(i, tmpColor);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
