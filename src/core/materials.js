import * as THREE from 'three';

// 统一配色：流体颜色即“温度/能量形态”的视觉编码
export const COLORS = {
  hot: new THREE.Color('#ff3d1f'),
  cold: new THREE.Color('#2a7bff'),
  steam: new THREE.Color('#d9ecff'),
  wetSteam: new THREE.Color('#9fd3ff'),
  feed: new THREE.Color('#4fa8ff'),
  coolCold: new THREE.Color('#12c7a2'),
  coolWarm: new THREE.Color('#b8e04a'),
  electric: new THREE.Color('#ffc928'),
  neutron: new THREE.Color('#c6f3ff'),
  cherenkov: new THREE.Color('#2f8dff'),
};

// 可复现的伪随机数，保证每次加载模型细节一致
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function speckle(ctx, size, count, colors, rand, maxR = 1.6) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.globalAlpha = 0.08 + rand() * 0.22;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 0.4 + rand() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export const textures = {
  concrete: canvasTexture(512, (ctx, s) => {
    const rand = seededRandom(11);
    ctx.fillStyle = '#9aa0a6';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 5200, ['#6d737a', '#b8bdc2', '#83898f', '#c9cdd1'], rand);
    ctx.strokeStyle = 'rgba(60,66,72,0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y <= s; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,66,72,0.16)';
    for (let x = 0; x <= s; x += 256) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s);
      ctx.stroke();
    }
  }, { repeat: [6, 3] }),

  // 剖切面：技术插图常用的斜线填充
  hatchConcrete: canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#a99d86';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(78,62,42,0.6)';
    ctx.lineWidth = 3;
    for (let i = -s; i < s * 2; i += 22) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      ctx.stroke();
    }
  }, { repeat: [4, 4] }),

  hatchSteel: canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#8fa3b8';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(32,56,86,0.65)';
    ctx.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 14) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      ctx.stroke();
    }
  }, { repeat: [3, 3] }),

  grating: canvasTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < s; i += 16) {
      ctx.fillRect(i, 0, 3, s);
      ctx.fillRect(0, i, s, 2);
    }
  }, { repeat: [28, 28], srgb: false }),

  glow: canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }),

  ring: canvasTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.28, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }),

  smoke: canvasTexture(128, (ctx, s) => {
    const rand = seededRandom(5);
    for (let i = 0; i < 26; i += 1) {
      const x = s / 2 + (rand() - 0.5) * s * 0.4;
      const y = s / 2 + (rand() - 0.5) * s * 0.4;
      const r = s * (0.14 + rand() * 0.2);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  }),

  radiator: canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#5d6b61';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 8) {
      ctx.fillStyle = 'rgba(20,28,24,0.55)';
      ctx.fillRect(x, 0, 3, s);
    }
  }, { repeat: [1, 1] }),
};

// 场地地面：草地、道路、厂区硬化地面，坐标范围 [-110, 110]
export function createGroundTexture() {
  return canvasTexture(2048, (ctx, s) => {
    const rand = seededRandom(21);
    const toPx = (v) => ((v + 110) / 220) * s;
    ctx.fillStyle = '#1d2a24';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, 22000, ['#2a3a30', '#16211b', '#324437', '#223026'], rand, 3);

    const pad = (x0, z0, x1, z1, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(toPx(x0), toPx(z0), toPx(x1) - toPx(x0), toPx(z1) - toPx(z0));
    };
    pad(-30, -44, 50, 14, '#3a4046');
    ctx.save();
    ctx.beginPath();
    ctx.rect(toPx(-30), toPx(-44), toPx(50) - toPx(-30), toPx(14) - toPx(-44));
    ctx.clip();
    speckle(ctx, s, 9000, ['#2f353b', '#474e55'], rand, 2);
    ctx.restore();
    pad(-27, 14, 48, 20, '#262b30');
    pad(-36, -46, -30, 20, '#262b30');
    pad(50, -46, 56, 20, '#262b30');
    ctx.strokeStyle = 'rgba(230,210,120,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.moveTo(toPx(-27), toPx(17));
    ctx.lineTo(toPx(48), toPx(17));
    ctx.moveTo(toPx(-33), toPx(-46));
    ctx.lineTo(toPx(-33), toPx(20));
    ctx.moveTo(toPx(53), toPx(-46));
    ctx.lineTo(toPx(53), toPx(20));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let v = -30; v <= 50; v += 4) {
      ctx.beginPath();
      ctx.moveTo(toPx(v), toPx(-44));
      ctx.lineTo(toPx(v), toPx(14));
      ctx.stroke();
    }
    for (let v = -44; v <= 14; v += 4) {
      ctx.beginPath();
      ctx.moveTo(toPx(-30), toPx(v));
      ctx.lineTo(toPx(50), toPx(v));
      ctx.stroke();
    }
  });
}

export const materials = {
  concrete: new THREE.MeshStandardMaterial({ map: textures.concrete, color: 0xc8ccd0, roughness: 0.92 }),
  concretePlain: new THREE.MeshStandardMaterial({ color: 0x5f6770, roughness: 0.9 }),
  concreteCut: new THREE.MeshStandardMaterial({ map: textures.hatchConcrete, roughness: 0.85, side: THREE.DoubleSide }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa6b2, metalness: 0.65, roughness: 0.34, side: THREE.DoubleSide }),
  steelBright: new THREE.MeshStandardMaterial({ color: 0xc4ced8, metalness: 0.75, roughness: 0.24, side: THREE.DoubleSide }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x46515c, metalness: 0.6, roughness: 0.42, side: THREE.DoubleSide }),
  steelCut: new THREE.MeshStandardMaterial({ map: textures.hatchSteel, metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide }),
  zirconium: new THREE.MeshStandardMaterial({
    color: 0xc9d3dc,
    metalness: 0.55,
    roughness: 0.32,
    emissive: new THREE.Color('#ff6a1a'),
    emissiveIntensity: 0.2,
  }),
  guideTube: new THREE.MeshStandardMaterial({ color: 0xeef3f7, metalness: 0.7, roughness: 0.2 }),
  absorber: new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.7, roughness: 0.3 }),
  crane: new THREE.MeshStandardMaterial({ color: 0xe0a82e, metalness: 0.4, roughness: 0.45 }),
  casing: new THREE.MeshStandardMaterial({ color: 0x7f909e, metalness: 0.45, roughness: 0.45, side: THREE.DoubleSide }),
  casingGlass: new THREE.MeshStandardMaterial({
    color: 0xb8cfe0,
    metalness: 0.2,
    roughness: 0.2,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.4,
  }),
  generator: new THREE.MeshStandardMaterial({ color: 0x2f5f8f, metalness: 0.45, roughness: 0.38, side: THREE.DoubleSide }),
  motor: new THREE.MeshStandardMaterial({ color: 0x3a6fa8, metalness: 0.4, roughness: 0.4 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc9773a, metalness: 0.85, roughness: 0.28 }),
  transformer: new THREE.MeshStandardMaterial({ color: 0x66766b, metalness: 0.35, roughness: 0.55 }),
  radiator: new THREE.MeshStandardMaterial({ map: textures.radiator, metalness: 0.3, roughness: 0.6 }),
  porcelain: new THREE.MeshStandardMaterial({ color: 0x8c5534, metalness: 0.1, roughness: 0.25 }),
  pylon: new THREE.MeshStandardMaterial({ color: 0xaab4bd, metalness: 0.7, roughness: 0.35 }),
  pipeShell: new THREE.MeshStandardMaterial({
    color: 0xc8d8e6,
    metalness: 0.2,
    roughness: 0.2,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    envMapIntensity: 0.5,
  }),
  water: new THREE.MeshStandardMaterial({
    color: 0x1f6fe0,
    roughness: 0.35,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.2,
  }),
  coolWater: new THREE.MeshStandardMaterial({
    color: 0x14a888,
    roughness: 0.25,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.3,
  }),
  hotWater: new THREE.MeshStandardMaterial({
    color: 0xe0482a,
    roughness: 0.35,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.2,
  }),
  steamVolume: new THREE.MeshStandardMaterial({
    color: 0xdfe8f0,
    roughness: 0.5,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.2,
  }),
  heater: new THREE.MeshStandardMaterial({
    color: 0xff7a2a,
    emissive: new THREE.Color('#ff5a10'),
    emissiveIntensity: 1.6,
  }),
  towerShell: new THREE.MeshStandardMaterial({ map: textures.concrete, color: 0xaab1b7, roughness: 0.92, side: THREE.DoubleSide }),
  fill: new THREE.MeshStandardMaterial({ color: 0x8a959e, roughness: 0.8 }),
  hall: new THREE.MeshStandardMaterial({ color: 0x5b6874, metalness: 0.5, roughness: 0.45 }),
  hallGlass: new THREE.MeshStandardMaterial({
    color: 0x8aa4ba,
    metalness: 0.2,
    roughness: 0.3,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 0.3,
  }),
  building: new THREE.MeshStandardMaterial({ color: 0x8a939b, roughness: 0.8 }),
  buildingDark: new THREE.MeshStandardMaterial({ color: 0x4d5760, roughness: 0.75 }),
  gratingMat: new THREE.MeshStandardMaterial({
    color: 0x9aa6b0,
    metalness: 0.6,
    roughness: 0.4,
    alphaMap: textures.grating,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  }),
};

// 流体着色器：沿管道流动的箭头条纹 + 首尾渐变色（例如 U 形管热端→冷端）
// 属性 aDist = 沿管长的距离（世界单位），aT = 归一化位置（0~1）
const fluidVertex = /* glsl */ `
  attribute float aDist;
  attribute float aT;
  varying float vDist;
  varying float vT;
  varying float vAround;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vDist = aDist;
    vT = aT;
    vAround = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fluidFragment = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOffset;
  uniform float uSpacing;
  uniform float uIntensity;
  uniform float uStripe;
  varying float vDist;
  varying float vT;
  varying float vAround;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vec3 base = mix(uColorA, uColorB, clamp(vT, 0.0, 1.0));
    float chevron = abs(fract(vAround * 2.0) - 0.5) * 0.9;
    float phase = fract(vDist / uSpacing - uOffset + chevron);
    float band = smoothstep(0.0, 0.1, phase) * (1.0 - smoothstep(0.32, 0.5, phase));
    float rim = pow(1.0 - abs(dot(vNormalV, vViewDir)), 1.6);
    vec3 col = base * (0.42 + band * uStripe + rim * 0.35);
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

export function createFluidMaterial({
  colorA = COLORS.hot,
  colorB,
  spacing = 0.9,
  stripe = 1.1,
  intensity = 1.5,
} = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColorA: { value: colorA.clone() },
      uColorB: { value: (colorB || colorA).clone() },
      uOffset: { value: 0 },
      uSpacing: { value: spacing },
      uIntensity: { value: intensity },
      uStripe: { value: stripe },
    },
    vertexShader: fluidVertex,
    fragmentShader: fluidFragment,
  });
  material.userData.baseIntensity = intensity;
  return material;
}

// 切伦科夫辐射辉光：加法混合的体积感光晕
export function createGlowMaterial(color, intensity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      uniform float uTime;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying vec3 vPos;
      void main() {
        float facing = abs(dot(vNormalV, vViewDir));
        float flicker = 0.85 + 0.15 * sin(uTime * 7.0 + vPos.y * 9.0);
        float a = pow(facing, 1.5) * uIntensity * flicker;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function spriteMaterial(color, opacity = 1, texture = textures.glow) {
  return new THREE.SpriteMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
