import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { mergeGeometries };

const UP = new THREE.Vector3(0, 1, 0);

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const v2 = (x, y) => new THREE.Vector2(x, y);

// 在 (r, y) 平面内生成椭圆弧，用于回转体剖面
export function arc(cx, cy, rx, ry, a0, a1, n = 16) {
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(v2(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry));
  }
  return pts;
}

// 把多段折线/弧线拼接成闭合轮廓；段与段之间重复顶点以获得硬边法线
export function profile(...segments) {
  const pts = [];
  segments.forEach((seg) => {
    const list = Array.isArray(seg) ? seg : [seg];
    list.forEach((p, i) => {
      if (i === 0 && pts.length) pts.push(pts[pts.length - 1].clone());
      pts.push(p.clone());
    });
  });
  pts.push(pts[pts.length - 1].clone());
  pts.push(pts[0].clone());
  pts.push(pts[0].clone());
  return pts;
}

export const rect = (r0, y0, r1, y1) => profile([v2(r0, y0), v2(r1, y0)], [v2(r1, y1)], [v2(r0, y1)]);

function dedupe(points) {
  const out = [];
  points.forEach((p) => {
    if (!out.length || out[out.length - 1].distanceToSquared(p) > 1e-10) out.push(p);
  });
  if (out.length > 1 && out[0].distanceToSquared(out[out.length - 1]) < 1e-10) out.pop();
  return out;
}

// 回转体剖切：phi 采用 three.js Lathe 约定（x = r·sinφ, z = r·cosφ），并给两个剖切面加上填充
export function cutLathe(points, { phiStart = 0, phiLength = Math.PI * 2, segments = 64, material, capMaterial }) {
  const group = new THREE.Group();
  const lathe = new THREE.Mesh(
    new THREE.LatheGeometry(points, Math.max(8, Math.round((segments * phiLength) / (Math.PI * 2))), phiStart, phiLength),
    material,
  );
  lathe.castShadow = true;
  lathe.receiveShadow = true;
  group.add(lathe);

  if (phiLength < Math.PI * 2 - 1e-3 && capMaterial) {
    const shape = new THREE.Shape(dedupe(points));
    const capGeometry = new THREE.ShapeGeometry(shape);
    const uv = capGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) {
      uv.setXY(i, uv.getX(i) * 0.35, uv.getY(i) * 0.35);
    }
    [phiStart, phiStart + phiLength].forEach((phi) => {
      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.rotation.y = phi - Math.PI / 2;
      cap.receiveShadow = true;
      group.add(cap);
    });
  }
  return group;
}

// 半剖（去掉 z>0 的前半部分）：最清晰的教学剖视
export const HALF = { phiStart: Math.PI / 2, phiLength: Math.PI };

// 带圆角的折线管路
export function roundedPath(points, radius = 0.45) {
  const path = new THREE.CurvePath();
  let prev = points[0].clone();
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i];
    const da = points[i - 1].clone().sub(p);
    const db = points[i + 1].clone().sub(p);
    const r = Math.min(radius, da.length() * 0.45, db.length() * 0.45);
    const p1 = p.clone().add(da.normalize().multiplyScalar(r));
    const p2 = p.clone().add(db.normalize().multiplyScalar(r));
    if (prev.distanceTo(p1) > 1e-4) path.add(new THREE.LineCurve3(prev, p1));
    path.add(new THREE.QuadraticBezierCurve3(p1, p.clone(), p2));
    prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, points[points.length - 1].clone()));
  return path;
}

// 为流体管生成 aDist / aT 属性
export function fluidTubeGeometry(curve, radius, { perUnit = 7, radial = 12, tStart = 0, tEnd = 1 } = {}) {
  const length = curve.getLength();
  const segments = Math.max(6, Math.ceil(length * perUnit));
  const geometry = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const uv = geometry.attributes.uv;
  const dist = new Float32Array(uv.count);
  const tt = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i += 1) {
    dist[i] = uv.getX(i) * length;
    tt[i] = tStart + (tEnd - tStart) * uv.getX(i);
  }
  geometry.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  geometry.setAttribute('aT', new THREE.BufferAttribute(tt, 1));
  return geometry;
}

export function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

export function cylinder(rTop, rBottom, h, material, { segments = 32, open = false, thetaStart, thetaLength } = {}) {
  return mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open, thetaStart, thetaLength), material);
}

// 在两点之间放置圆柱（杆件、短管、桁架）
export function cylinderBetween(a, b, radius, material, segments = 12, radiusB = radius) {
  const dir = b.clone().sub(a);
  const length = dir.length();
  const m = mesh(new THREE.CylinderGeometry(radiusB, radius, length, segments), material);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

export function cylinderBetweenGeometry(a, b, radius, segments = 8) {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius, radius, dir.length(), segments);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

export const polar = (r, phi, y) => v3(r * Math.sin(phi), y, r * Math.cos(phi));

// 预采样曲线：粒子沿路径运动时避免每帧做弧长求解
export class SampledPath {
  constructor(curve, samples = 160) {
    this.curve = curve;
    this.points = curve.getSpacedPoints(samples);
    this.n = samples;
    this.length = curve.getLength();
  }

  at(t, out) {
    const f = THREE.MathUtils.clamp(t, 0, 1) * this.n;
    const i = Math.min(Math.floor(f), this.n - 1);
    return out.lerpVectors(this.points[i], this.points[i + 1], f - i);
  }

  // 找到第一个满足条件的归一化位置
  findT(predicate, fromT = 0) {
    for (let i = Math.floor(fromT * this.n); i <= this.n; i += 1) {
      if (predicate(this.points[i])) return i / this.n;
    }
    return 1;
  }
}
