import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { seededRandom, textures } from '../core/materials.js';

const PI = Math.PI;
const BOUNDS = { x: 12.5, y: 6.6, z: 2.0 };
const ROD_X = [-4.3, 4.5];
const ROD_HALF = 0.6;
const FAST_SPEED = 8.5;
const THERMAL_SPEED = 3.3;
const MAX_NEUTRONS = 110;
const TRAIL = 9;

const COL = {
  p235: new THREE.Color('#ff5a4f'),
  n235: new THREE.Color('#79aaff'),
  p238: new THREE.Color('#a8746c'),
  n238: new THREE.Color('#7c8799'),
  hot: new THREE.Color('#ffb04a'),
  fast: new THREE.Color('#ffa63d').multiplyScalar(2.4),
  thermal: new THREE.Color('#6fe6ff').multiplyScalar(2.4),
  gamma: new THREE.Color('#fff27a').multiplyScalar(3),
  oxygen: new THREE.Color('#3f8cff'),
  hydrogen: new THREE.Color('#eef4ff'),
};

// 核子团：黄金角分布，近似球形堆积
function clusterOffsets(n, radius) {
  const pts = [];
  const golden = PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) {
    const r = radius * Math.cbrt((i + 0.5) / n);
    const j = (i * 7) % n;
    const y = 1 - (2 * (j + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const th = golden * j;
    pts.push(new THREE.Vector3(Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r));
  }
  return pts;
}

function clusterColors(n, protonRatio, p, nn, rand) {
  return Array.from({ length: n }, () => (rand() < protonRatio ? p : nn));
}

function tag(text, cls = '') {
  const el = document.createElement('div');
  el.className = `micro-tag ${cls}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  return { obj, el };
}

// 微观视角：中子引发 U-235 链式裂变
export class FissionScene {
  constructor() {
    this.rand = seededRandom(99);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05080d, 30, 60);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.camera.position.set(0, 0, 25);
    this.time = 0;
    this.stats = { neutrons: 0, fissions: 0, rate: 0, absorbed: 0 };
    this.rateWindow = [];
    this.lastSource = 0;

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a1020, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-6, 10, 14);
    this.scene.add(key);
    const env = new THREE.PointLight(0x5aa8ff, 14, 40, 1.5);
    env.position.set(0, 0, 6);
    this.scene.add(env);

    this.buildBackdrop();
    this.buildRods();
    this.buildNuclei();
    this.buildWater();
    this.buildNeutrons();
    this.buildEffects();
    this.buildTags();
    for (let i = 0; i < 6; i += 1) this.spawnNeutron(this.randomEdge(), false);
  }

  buildBackdrop() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(512, 288, 40, 512, 288, 620);
    g.addColorStop(0, '#15202e');
    g.addColorStop(1, '#04070b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = 'rgba(140,180,230,0.12)';
    for (let y = 0; y < 576; y += 26) {
      for (let x = (y / 26) % 2 ? 15 : 0; x < 1024; x += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(72, 40), new THREE.MeshBasicMaterial({ map: tex }));
    plane.position.z = -6;
    this.scene.add(plane);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(BOUNDS.x * 2, BOUNDS.y * 2, BOUNDS.z * 2)),
      new THREE.LineBasicMaterial({ color: 0x3d5a7a, transparent: true, opacity: 0.35 }),
    );
    this.scene.add(frame);
  }

  buildRods() {
    this.rods = ROD_X.map((x) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(ROD_HALF * 2, BOUNDS.y * 2 + 2, BOUNDS.z * 2 + 0.4),
        new THREE.MeshStandardMaterial({ color: 0x1c1a24, metalness: 0.5, roughness: 0.5, emissive: new THREE.Color('#5b2bff'), emissiveIntensity: 0.05 }),
      );
      g.add(body);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: new THREE.Color(0.7, 0.45, 1.4), toneMapped: false }));
      g.add(edges);
      g.position.x = x;
      this.scene.add(g);
      return g;
    });
  }

  buildNuclei() {
    this.nucleonMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.17, 14, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0.0 }),
      2600,
    );
    this.nucleonMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(2600 * 3), 3);
    this.nucleonMesh.frustumCulled = false;
    this.scene.add(this.nucleonMesh);

    this.nuclei = [];
    const cols = 9;
    const rows = 4;
    let id = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = -BOUNDS.x + 1.6 + (c * (BOUNDS.x * 2 - 3.2)) / (cols - 1) + (this.rand() - 0.5) * 0.9;
        const y = -BOUNDS.y + 1.5 + (r * (BOUNDS.y * 2 - 3.0)) / (rows - 1) + (this.rand() - 0.5) * 0.8;
        if (ROD_X.some((rx) => Math.abs(x - rx) < ROD_HALF + 0.9)) continue;
        const is235 = (r + c) % 2 === 0 || this.rand() < 0.45;
        const n = is235 ? 28 : 31;
        this.nuclei.push({
          id: (id += 1),
          type: is235 ? 'U235' : 'U238',
          pos: new THREE.Vector3(x, y, (this.rand() - 0.5) * 1.8),
          offsets: clusterOffsets(n, is235 ? 0.52 : 0.56),
          colors: clusterColors(n, 0.39, is235 ? COL.p235 : COL.p238, is235 ? COL.n235 : COL.n238, this.rand),
          rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rand() * 6, this.rand() * 6, 0)),
          spin: new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).normalize(),
          state: 'idle',
          t: 1,
          glow: 0,
          axis: new THREE.Vector3(1, 0, 0),
          respawnAt: 0,
        });
      }
    }
    this.fragments = [];
  }

  buildWater() {
    this.waterMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.0, transparent: true, opacity: 0.85 }), 40 * 3);
    this.waterMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(120 * 3), 3);
    this.waterMesh.frustumCulled = false;
    this.scene.add(this.waterMesh);
    this.waters = [];
    let guard = 0;
    while (this.waters.length < 38 && guard < 2000) {
      guard += 1;
      const p = new THREE.Vector3((this.rand() * 2 - 1) * (BOUNDS.x - 0.6), (this.rand() * 2 - 1) * (BOUNDS.y - 0.6), (this.rand() - 0.5) * 3);
      if (this.nuclei.some((n) => n.pos.distanceTo(p) < 1.25)) continue;
      if (this.waters.some((w) => w.pos.distanceTo(p) < 1.0)) continue;
      this.waters.push({
        pos: p,
        vel: new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, 0).multiplyScalar(0.3),
        rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(this.rand() * 6, this.rand() * 6, this.rand() * 6)),
        spin: new THREE.Vector3(this.rand() - 0.5, this.rand() - 0.5, this.rand() - 0.5).normalize(),
        ping: 0,
      });
    }
  }

  buildNeutrons() {
    this.neutronMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_NEUTRONS + 20);
    this.neutronMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((MAX_NEUTRONS + 20) * 3), 3);
    this.neutronMesh.frustumCulled = false;
    this.scene.add(this.neutronMesh);
    this.neutrons = [];
    const segs = (MAX_NEUTRONS + 20) * (TRAIL - 1);
    this.trailGeom = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(segs * 6);
    this.trailCol = new Float32Array(segs * 6);
    this.trailGeom.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trailGeom.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3));
    this.trails = new THREE.LineSegments(this.trailGeom, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.trails.frustumCulled = false;
    this.scene.add(this.trails);
  }

  buildEffects() {
    this.flashes = [];
    this.flashPool = Array.from({ length: 24 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
      s.visible = false;
      this.scene.add(s);
      return s;
    });
    this.ringPool = Array.from({ length: 10 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures.ring, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, toneMapped: false }));
      s.visible = false;
      this.scene.add(s);
      return s;
    });
    this.popups = Array.from({ length: 6 }, () => {
      const t = tag('+200 MeV', 'energy');
      t.obj.visible = false;
      this.scene.add(t.obj);
      return { ...t, age: 0, busy: false };
    });
  }

  buildTags() {
    this.rodTags = this.rods.map((rod) => {
      const t = tag('控制棒 · 吸收中子', 'rod');
      rod.add(t.obj);
      return t;
    });
    const first235 = this.nuclei.find((n) => n.type === 'U235');
    const first238 = this.nuclei.find((n) => n.type === 'U238' && Math.abs(n.pos.x - first235.pos.x) > 3);
    this.nucleusTags = [
      { n: first235, ...tag('铀-235', 'u235') },
      { n: first238, ...tag('铀-238', 'u238') },
    ];
    this.nucleusTags.forEach((t) => this.scene.add(t.obj));
    const w = this.waters[Math.floor(this.waters.length / 2)];
    this.waterTag = { w, ...tag('水分子（慢化剂）', 'water') };
    this.scene.add(this.waterTag.obj);
  }

  randomEdge() {
    const side = Math.floor(this.rand() * 4);
    const u = this.rand() * 2 - 1;
    if (side === 0) return new THREE.Vector3(-BOUNDS.x + 0.2, u * BOUNDS.y, 0);
    if (side === 1) return new THREE.Vector3(BOUNDS.x - 0.2, u * BOUNDS.y, 0);
    if (side === 2) return new THREE.Vector3(u * BOUNDS.x, -BOUNDS.y + 0.2, 0);
    return new THREE.Vector3(u * BOUNDS.x, BOUNDS.y - 0.2, 0);
  }

  randomDir() {
    const a = this.rand() * PI * 2;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), (this.rand() - 0.5) * 0.25).normalize();
  }

  spawnNeutron(pos, fast = true, kind = 'neutron') {
    if (kind === 'neutron' && this.neutrons.filter((n) => n.kind === 'neutron').length >= MAX_NEUTRONS) return;
    const dir = kind === 'neutron' && !fast ? new THREE.Vector3().subVectors(new THREE.Vector3((this.rand() - 0.5) * 6, (this.rand() - 0.5) * 4, 0), pos).normalize() : this.randomDir();
    const speed = kind === 'gamma' ? 24 : fast ? FAST_SPEED : THERMAL_SPEED;
    this.neutrons.push({
      kind,
      pos: pos.clone(),
      vel: dir.multiplyScalar(speed),
      fast,
      age: 0,
      life: kind === 'gamma' ? 0.55 : 14,
      last: -1,
      inRod: false,
      trail: Array.from({ length: TRAIL }, () => pos.clone()),
      trailTimer: 0,
    });
  }

  flash(pos, color, size = 3, life = 0.5, ring = false) {
    const pool = ring ? this.ringPool : this.flashPool;
    const sprite = pool.find((s) => !s.visible);
    if (!sprite) return;
    sprite.visible = true;
    sprite.position.copy(pos);
    sprite.material.color.copy(color);
    this.flashes.push({ sprite, age: 0, life, size, ring });
  }

  popup(pos) {
    const p = this.popups.find((q) => !q.busy);
    if (!p) return;
    p.busy = true;
    p.age = 0;
    p.obj.visible = true;
    p.obj.position.copy(pos).add(new THREE.Vector3(0, 0.9, 0));
    p.start = p.obj.position.clone();
  }

  fission(nucleus) {
    nucleus.state = 'excited';
    nucleus.t = 0;
    nucleus.axis = this.randomDir();
  }

  split(nucleus) {
    nucleus.state = 'gone';
    nucleus.respawnAt = this.time + 3.5 + this.rand() * 2.5;
    const axis = nucleus.axis;
    const hot = (n, r) => ({ offsets: clusterOffsets(n, r), colors: clusterColors(n, 0.4, COL.p235, COL.n235, this.rand) });
    [[16, 0.42, 1], [12, 0.36, -1]].forEach(([n, r, s]) => {
      const f = hot(n, r);
      this.fragments.push({
        pos: nucleus.pos.clone().addScaledVector(axis, s * 0.35),
        vel: axis.clone().multiplyScalar(s * (n === 16 ? 3.0 : 3.8)),
        offsets: f.offsets,
        colors: f.colors,
        rot: new THREE.Quaternion(),
        spin: this.randomDir(),
        age: 0,
        life: 2.4,
      });
    });
    const count = this.rand() < 0.45 ? 3 : 2;
    for (let i = 0; i < count; i += 1) this.spawnNeutron(nucleus.pos, true);
    this.spawnNeutron(nucleus.pos, true, 'gamma');
    this.flash(nucleus.pos, new THREE.Color(2.4, 1.9, 1.3), 3.6, 0.5);
    this.flash(nucleus.pos, new THREE.Color(2.4, 1.4, 0.6), 1, 0.8, true);
    this.popup(nucleus.pos);
    this.stats.fissions += 1;
    this.rateWindow.push(this.time);
  }

  update(dt, sim) {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    const t = this.time;

    // 控制棒位置
    const rodBottom = BOUNDS.y + 0.4 - sim.rod * (BOUNDS.y * 2 + 0.4);
    this.rods.forEach((rod) => {
      rod.position.y = rodBottom + BOUNDS.y + 1;
    });
    this.rodTags.forEach((tg) => {
      tg.obj.position.set(0, -(BOUNDS.y + 1) + 0.6, BOUNDS.z + 0.2);
      tg.el.style.opacity = sim.rod > 0.03 ? 1 : 0;
    });

    // 周围燃料射入的中子通量与反应堆裂变功率成正比；停堆后只剩零星的中子源中子
    const interval = Math.min(3, 0.45 / Math.max(0.02, sim.fission));
    if (t - this.lastSource > interval) {
      this.lastSource = t;
      const edge = this.randomEdge();
      this.spawnNeutron(sim.fission > 0.05 && this.rand() < 0.6 ? edge.multiplyScalar(0.6 + this.rand() * 0.3) : edge, false);
    }

    // 水分子布朗运动
    this.waters.forEach((w) => {
      w.vel.x += (this.rand() - 0.5) * dt * 0.8;
      w.vel.y += (this.rand() - 0.5) * dt * 0.8;
      w.vel.multiplyScalar(1 - dt * 0.5);
      w.pos.addScaledVector(w.vel, dt);
      if (Math.abs(w.pos.x) > BOUNDS.x - 0.4) w.vel.x = -Math.sign(w.pos.x) * Math.abs(w.vel.x);
      if (Math.abs(w.pos.y) > BOUNDS.y - 0.4) w.vel.y = -Math.sign(w.pos.y) * Math.abs(w.vel.y);
      w.rot.multiply(new THREE.Quaternion().setFromAxisAngle(w.spin, dt * 0.6));
      w.ping = Math.max(0, w.ping - dt * 3);
    });

    // 中子运动与相互作用
    for (let i = this.neutrons.length - 1; i >= 0; i -= 1) {
      const n = this.neutrons[i];
      n.age += dt;
      n.pos.addScaledVector(n.vel, dt);
      let dead = n.age > n.life;
      if (Math.abs(n.pos.z) > BOUNDS.z) {
        n.vel.z *= -1;
        n.pos.z = Math.sign(n.pos.z) * BOUNDS.z;
      }
      if (Math.abs(n.pos.x) > BOUNDS.x || Math.abs(n.pos.y) > BOUNDS.y) {
        if (n.kind === 'neutron' && this.rand() < 0.72) {
          if (Math.abs(n.pos.x) > BOUNDS.x) n.vel.x *= -1;
          if (Math.abs(n.pos.y) > BOUNDS.y) n.vel.y *= -1;
          n.pos.x = THREE.MathUtils.clamp(n.pos.x, -BOUNDS.x, BOUNDS.x);
          n.pos.y = THREE.MathUtils.clamp(n.pos.y, -BOUNDS.y, BOUNDS.y);
        } else {
          dead = true;
        }
      }
      if (n.kind === 'neutron' && !dead) {
        // 控制棒吸收
        const inRod = ROD_X.some((rx) => Math.abs(n.pos.x - rx) < ROD_HALF) && n.pos.y > rodBottom;
        if (inRod && !n.inRod) {
          if (this.rand() < 0.93) {
            dead = true;
            this.stats.absorbed += 1;
            this.flash(n.pos, new THREE.Color(1.6, 0.8, 3), 1.6, 0.45);
          }
        }
        n.inRod = inRod;
      }
      if (n.kind === 'neutron' && !dead) {
        // 水慢化：快中子与氢核碰撞失去能量
        if (n.fast) {
          for (const w of this.waters) {
            if (w.pos.distanceToSquared(n.pos) < 0.2 && n.last !== w) {
              n.last = w;
              const speed = n.vel.length() * 0.55;
              n.vel.copy(this.randomDir()).multiplyScalar(Math.max(speed, THERMAL_SPEED));
              w.vel.addScaledVector(n.vel, 0.05);
              w.ping = 1;
              if (speed <= THERMAL_SPEED * 1.35) {
                n.fast = false;
                n.vel.setLength(THERMAL_SPEED);
              }
              this.flash(n.pos, new THREE.Color(1.2, 1.8, 2.4), 0.9, 0.3);
              break;
            }
          }
        }
        for (const nu of this.nuclei) {
          if (nu.state !== 'idle' || nu.t < 0.8 || n.last === nu) continue;
          if (nu.pos.distanceToSquared(n.pos) > 0.56) continue;
          n.last = nu;
          if (nu.type === 'U235') {
            if (this.rand() < (n.fast ? 0.1 : 0.9)) {
              dead = true;
              this.fission(nu);
            }
          } else if (!n.fast && this.rand() < 0.18) {
            dead = true;
            nu.glow = 1;
            this.stats.absorbed += 1;
            this.flash(n.pos, new THREE.Color(1.2, 1.0, 2.0), 1.3, 0.4);
          } else {
            n.vel.reflect(new THREE.Vector3().subVectors(n.pos, nu.pos).normalize());
          }
          break;
        }
      }
      if (dead) {
        this.neutrons.splice(i, 1);
        continue;
      }
      n.trailTimer += dt;
      if (n.trailTimer > (n.kind === 'gamma' ? 0.012 : 0.03)) {
        n.trailTimer = 0;
        n.trail.pop();
        n.trail.unshift(n.pos.clone());
      }
    }

    // 原子核状态
    this.nuclei.forEach((nu) => {
      if (nu.state === 'excited') {
        nu.t += dt;
        if (nu.t > 0.45) this.split(nu);
      } else if (nu.state === 'gone' && t > nu.respawnAt) {
        nu.state = 'idle';
        nu.t = 0;
      } else if (nu.state === 'idle') {
        nu.t = Math.min(1, nu.t + dt * 1.5);
      }
      nu.glow = Math.max(0, nu.glow - dt * 0.6);
      nu.rot.multiply(new THREE.Quaternion().setFromAxisAngle(nu.spin, dt * 0.35));
    });
    for (let i = this.fragments.length - 1; i >= 0; i -= 1) {
      const f = this.fragments[i];
      f.age += dt;
      f.pos.addScaledVector(f.vel, dt);
      f.vel.multiplyScalar(Math.exp(-dt * 1.8));
      f.rot.multiply(new THREE.Quaternion().setFromAxisAngle(f.spin, dt * 2));
      if (f.age > f.life) this.fragments.splice(i, 1);
    }

    this.writeInstances();
    this.updateEffects(dt);

    this.rateWindow = this.rateWindow.filter((x) => t - x < 3);
    this.stats.rate = this.rateWindow.length / 3;
    this.stats.neutrons = this.neutrons.filter((n) => n.kind === 'neutron').length;

    this.nucleusTags.forEach((tg) => {
      tg.obj.position.copy(tg.n.pos).add(new THREE.Vector3(0, -0.75, 0));
      tg.el.style.opacity = tg.n.state === 'idle' ? 1 : 0.25;
    });
    this.waterTag.obj.position.copy(this.waterTag.w.pos).add(new THREE.Vector3(0, -0.55, 0));

    const dist = 25 * THREE.MathUtils.clamp(1.75 / this.camera.aspect, 1, 2.3);
    this.camera.position.set(Math.sin(t * 0.11) * 1.4, Math.cos(t * 0.09) * 0.7, dist);
    this.camera.lookAt(0, 0, 0);
  }

  writeInstances() {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    let k = 0;
    const write = (center, rot, offsets, colors, scaleFn, tint, tintK) => {
      for (let i = 0; i < offsets.length && k < 2600; i += 1) {
        p.copy(offsets[i]).applyQuaternion(rot);
        scaleFn(p);
        p.add(center);
        s.setScalar(1);
        m.compose(p, q, s);
        this.nucleonMesh.setMatrixAt(k, m);
        c.copy(colors[i]);
        if (tintK > 0) c.lerp(tint, tintK);
        this.nucleonMesh.setColorAt(k, c);
        k += 1;
      }
    };
    this.nuclei.forEach((nu) => {
      if (nu.state === 'gone') return;
      const appear = nu.state === 'idle' ? THREE.MathUtils.smoothstep(nu.t, 0, 0.8) : 1;
      let scaleFn = (v) => v.multiplyScalar(appear);
      let tintK = nu.glow * 0.6;
      if (nu.state === 'excited') {
        const e = nu.t / 0.45;
        const axis = nu.axis;
        const wobble = 1 + Math.sin(e * PI * 5) * 0.08;
        scaleFn = (v) => {
          const along = v.dot(axis);
          v.addScaledVector(axis, along * (e * 1.1) * wobble + Math.sign(along) * e * 0.25);
          return v;
        };
        tintK = e * 0.7;
      }
      write(nu.pos, nu.rot, nu.offsets, nu.colors, scaleFn, COL.hot, tintK);
    });
    this.fragments.forEach((f) => {
      const heat = Math.max(0, 1 - f.age / f.life);
      const fade = f.age > f.life - 0.6 ? (f.life - f.age) / 0.6 : 1;
      write(f.pos, f.rot, f.offsets, f.colors, (v) => v.multiplyScalar(fade), COL.hot, heat * 0.85);
    });
    this.nucleonMesh.count = k;
    this.nucleonMesh.instanceMatrix.needsUpdate = true;
    this.nucleonMesh.instanceColor.needsUpdate = true;

    // 水分子：O + 2H（键角 104.5°）
    let wi = 0;
    const hA = new THREE.Vector3(Math.sin(0.912) * 0.32, Math.cos(0.912) * 0.32, 0);
    const hB = new THREE.Vector3(-Math.sin(0.912) * 0.32, Math.cos(0.912) * 0.32, 0);
    this.waters.forEach((w) => {
      const pingScale = 1 + w.ping * 0.35;
      s.setScalar(0.24 * pingScale);
      m.compose(w.pos, q, s);
      this.waterMesh.setMatrixAt(wi, m);
      c.copy(COL.oxygen).multiplyScalar(1 + w.ping * 1.5);
      this.waterMesh.setColorAt(wi, c);
      wi += 1;
      [hA, hB].forEach((h) => {
        p.copy(h).applyQuaternion(w.rot).add(w.pos);
        s.setScalar(0.14 * pingScale);
        m.compose(p, q, s);
        this.waterMesh.setMatrixAt(wi, m);
        c.copy(COL.hydrogen).multiplyScalar(1 + w.ping * 1.5);
        this.waterMesh.setColorAt(wi, c);
        wi += 1;
      });
    });
    this.waterMesh.count = wi;
    this.waterMesh.instanceMatrix.needsUpdate = true;
    this.waterMesh.instanceColor.needsUpdate = true;

    // 中子（沿速度方向拉长）+ 拖尾
    let ni = 0;
    let ti = 0;
    const zAxis = new THREE.Vector3(0, 0, 1);
    this.neutrons.forEach((n) => {
      const speed = n.vel.length();
      const col = n.kind === 'gamma' ? COL.gamma : n.fast ? COL.fast : COL.thermal;
      q.setFromUnitVectors(zAxis, n.vel.clone().normalize());
      const r = n.kind === 'gamma' ? 0.06 : 0.13;
      s.set(r, r, r * (1 + speed * 0.12));
      m.compose(n.pos, q, s);
      this.neutronMesh.setMatrixAt(ni, m);
      this.neutronMesh.setColorAt(ni, col);
      ni += 1;
      for (let j = 0; j < TRAIL - 1; j += 1) {
        const a = j === 0 ? n.pos : n.trail[j];
        const b = n.trail[j + 1];
        const f0 = 1 - j / (TRAIL - 1);
        const f1 = 1 - (j + 1) / (TRAIL - 1);
        this.trailPos.set([a.x, a.y, a.z, b.x, b.y, b.z], ti * 6);
        this.trailCol.set([col.r * f0 * 0.35, col.g * f0 * 0.35, col.b * f0 * 0.35, col.r * f1 * 0.35, col.g * f1 * 0.35, col.b * f1 * 0.35], ti * 6);
        ti += 1;
      }
    });
    q.identity();
    this.neutronMesh.count = ni;
    this.neutronMesh.instanceMatrix.needsUpdate = true;
    if (this.neutronMesh.instanceColor) this.neutronMesh.instanceColor.needsUpdate = true;
    this.trailGeom.setDrawRange(0, ti * 2);
    this.trailGeom.attributes.position.needsUpdate = true;
    this.trailGeom.attributes.color.needsUpdate = true;
  }

  updateEffects(dt) {
    for (let i = this.flashes.length - 1; i >= 0; i -= 1) {
      const f = this.flashes[i];
      f.age += dt;
      const k = f.age / f.life;
      if (k >= 1) {
        f.sprite.visible = false;
        f.sprite.material.opacity = 0;
        this.flashes.splice(i, 1);
        continue;
      }
      const size = f.ring ? f.size * (0.5 + k * 5) : f.size * (0.4 + Math.sin(Math.min(1, k * 2) * PI * 0.5) * 0.8);
      f.sprite.scale.set(size, size, 1);
      f.sprite.material.opacity = (1 - k) * (f.ring ? 0.8 : 1);
    }
    this.popups.forEach((p) => {
      if (!p.busy) return;
      p.age += dt;
      p.obj.position.copy(p.start).add(new THREE.Vector3(0, p.age * 0.9, 0));
      p.el.style.opacity = Math.max(0, 1 - p.age / 1.6);
      if (p.age > 1.6) {
        p.busy = false;
        p.obj.visible = false;
      }
    });
  }
}
