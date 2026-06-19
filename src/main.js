import './styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {
  Atom,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Thermometer,
  Waves,
  Zap,
  createIcons,
} from 'lucide';

createIcons({
  icons: {
    Atom,
    Pause,
    Play,
    RotateCcw,
    Snowflake,
    Thermometer,
    Waves,
    Zap,
  },
});

const canvas = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080a0d);
scene.fog = new THREE.FogExp2(0x080a0d, 0.018);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'fixed';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.style.zIndex = '4';
document.body.appendChild(labelRenderer.domElement);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 240);
const defaultCameraPosition = new THREE.Vector3(20, 14, 23);
const mobileCameraPosition = new THREE.Vector3(18, 15, 34);
const defaultCameraTarget = new THREE.Vector3(0.5, 2.5, 0);
const mobileCameraTarget = new THREE.Vector3(1.2, 2.9, -1.7);
camera.position.copy(defaultCameraPosition);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.copy(defaultCameraTarget);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 12;
controls.maxDistance = 52;
controls.update();

const palette = {
  concrete: 0x65707b,
  steel: 0x9aa7b4,
  darkSteel: 0x323d48,
  reactorBlue: 0x4da3ff,
  moderator: 0x78c8ff,
  zirconium: 0xd8e2e8,
  hot: 0xff5b35,
  warm: 0xf3c74d,
  steam: 0xeafaff,
  water: 0x47d7ac,
  cool: 0x49a7ff,
  copper: 0xc4773f,
  grid: 0xd7dce2,
};

const materials = {
  concrete: new THREE.MeshStandardMaterial({ color: palette.concrete, roughness: 0.82 }),
  containmentShell: new THREE.MeshStandardMaterial({
    color: palette.concrete,
    roughness: 0.82,
    transparent: true,
    opacity: 0.54,
    side: THREE.DoubleSide,
  }),
  steel: new THREE.MeshStandardMaterial({
    color: palette.steel,
    metalness: 0.56,
    roughness: 0.24,
  }),
  darkSteel: new THREE.MeshStandardMaterial({
    color: palette.darkSteel,
    metalness: 0.35,
    roughness: 0.4,
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color: palette.reactorBlue,
    transparent: true,
    opacity: 0.22,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.45,
    clearcoat: 0.6,
  }),
  hot: new THREE.MeshStandardMaterial({
    color: palette.hot,
    emissive: palette.hot,
    emissiveIntensity: 0.55,
    roughness: 0.38,
  }),
  fuel: new THREE.MeshStandardMaterial({
    color: palette.warm,
    emissive: palette.warm,
    emissiveIntensity: 0.82,
    roughness: 0.22,
  }),
  fuelCladding: new THREE.MeshStandardMaterial({
    color: palette.zirconium,
    metalness: 0.42,
    roughness: 0.26,
  }),
  moderator: new THREE.MeshPhysicalMaterial({
    color: palette.moderator,
    transparent: true,
    opacity: 0.28,
    roughness: 0.05,
    transmission: 0.34,
  }),
  controlRod: new THREE.MeshStandardMaterial({
    color: 0x161c22,
    metalness: 0.65,
    roughness: 0.22,
  }),
  water: new THREE.MeshStandardMaterial({
    color: palette.water,
    emissive: palette.water,
    emissiveIntensity: 0.24,
    roughness: 0.25,
  }),
  cool: new THREE.MeshStandardMaterial({
    color: palette.cool,
    emissive: palette.cool,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  }),
  steam: new THREE.MeshStandardMaterial({
    color: palette.steam,
    transparent: true,
    opacity: 0.84,
    roughness: 0.16,
  }),
  electric: new THREE.MeshStandardMaterial({
    color: palette.warm,
    emissive: palette.warm,
    emissiveIntensity: 0.9,
    roughness: 0.35,
  }),
};

const steps = [
  {
    title: '核裂变释放热量',
    description: '剖切视图展示压力容器、堆芯围筒、燃料组件阵列、控制棒驱动机构和冷热冷却剂接管；控制棒调节中子通量，燃料棒释放热量并由一回路带走。',
    focus: new THREE.Vector3(-7.2, 3.5, 0),
    camera: new THREE.Vector3(4.2, 8.2, 11.8),
    active: ['core', 'reactor', 'reactorInternals', 'neutronFlux'],
  },
  {
    title: '一回路把热量送到蒸汽发生器',
    description: '高压水不沸腾，携带堆芯热量进入蒸汽发生器，通过传热管束把热量传递给二回路。',
    focus: new THREE.Vector3(-2.5, 3.0, 0),
    camera: new THREE.Vector3(14, 10, 18),
    active: ['primaryHot', 'primaryCool', 'steamGenerator'],
  },
  {
    title: '二回路产生蒸汽并推动汽轮机',
    description: '二回路给水吸热成为高温蒸汽，蒸汽膨胀推动汽轮机叶片，把热能转化为机械旋转能。',
    focus: new THREE.Vector3(5.6, 2.7, 0),
    camera: new THREE.Vector3(17, 9, 14),
    active: ['secondarySteam', 'turbine'],
  },
  {
    title: '发电机输出电能并升压并网',
    description: '汽轮机主轴带动发电机转子旋转，电磁感应产生交流电，经主变压器升压后送入电网。',
    focus: new THREE.Vector3(10.4, 2.5, 0.6),
    camera: new THREE.Vector3(19, 8, 10),
    active: ['generator', 'electricity', 'grid'],
  },
  {
    title: '冷凝器与冷却塔完成循环',
    description: '乏汽在冷凝器中被冷却水冷凝为给水，冷却水把余热带到冷却塔释放，工质回到循环起点。',
    focus: new THREE.Vector3(4.4, 1.1, -5.2),
    camera: new THREE.Vector3(14, 10, -16),
    active: ['condenser', 'coolingTower', 'coolingWater'],
  },
];

const activeGroups = new Map();
const labels = [];
const particles = [];
const neutronMarkers = [];
const clickableTargets = [];
const clock = new THREE.Clock();
let currentStep = 0;
let running = true;
let speed = 1;

function addLighting() {
  const hemi = new THREE.HemisphereLight(0xc9edff, 0x171a1d, 1.35);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(-10, 18, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 22;
  key.shadow.camera.bottom = -22;
  scene.add(key);

  const rim = new THREE.PointLight(0x71d8bd, 70, 46, 2.0);
  rim.position.set(8, 8, -9);
  scene.add(rim);

  const coreLight = new THREE.PointLight(palette.warm, 80, 18, 2);
  coreLight.position.set(-7.2, 3.2, 0);
  coreLight.name = 'coreLight';
  scene.add(coreLight);
}

function createGround() {
  const ground = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 25.5, 0.42, 96),
    new THREE.MeshStandardMaterial({
      color: 0x242a30,
      roughness: 0.86,
      metalness: 0.05,
    }),
  );
  ground.position.y = -0.24;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(48, 48, 0x57636f, 0x303a43);
  grid.position.y = 0.015;
  scene.add(grid);
}

function addLabel(text, position, groupName) {
  const element = document.createElement('div');
  element.className = 'hotspot-label';
  element.textContent = text;
  const label = new CSS2DObject(element);
  label.position.copy(position);
  scene.add(label);
  labels.push({ label, element, groupName });
  return label;
}

function roundedCylinder(radiusTop, radiusBottom, height, segments, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createPipe(name, points, color, radius = 0.13, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.16);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.18,
    roughness: 0.32,
    transparent: opacity < 1,
    opacity,
  });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, radius, 14, false), material);
  tube.castShadow = true;
  tube.receiveShadow = true;
  tube.userData.groupName = name;
  scene.add(tube);
  activeGroups.set(name, [...(activeGroups.get(name) || []), tube]);
  return { curve, tube };
}

function createParticles(path, color, count, size, groupName, offset = 0) {
  const geometry = new THREE.SphereGeometry(size, 14, 10);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 1.1,
    roughness: 0.25,
  });

  for (let i = 0; i < count; i += 1) {
    const particle = new THREE.Mesh(geometry, material);
    particle.userData.groupName = groupName;
    scene.add(particle);
    particles.push({
      mesh: particle,
      path,
      t: (i / count + offset) % 1,
      baseSpeed: 0.085 + Math.random() * 0.03,
      groupName,
    });
    activeGroups.set(groupName, [...(activeGroups.get(groupName) || []), particle]);
  }
}

function addToActiveGroup(groupName, object) {
  activeGroups.set(groupName, [...(activeGroups.get(groupName) || []), object]);
}

function createFuelAssembly(x, z, index) {
  const assembly = new THREE.Group();
  assembly.position.set(x, 1.55, z);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.32, 0.24),
    new THREE.MeshStandardMaterial({
      color: index % 2 ? 0x51606b : 0x687783,
      metalness: 0.35,
      roughness: 0.32,
      transparent: true,
      opacity: 0.34,
      wireframe: true,
    }),
  );
  frame.position.y = 0.12;
  assembly.add(frame);

  const rodGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1.2, 8);
  const guideGeometry = new THREE.CylinderGeometry(0.009, 0.009, 1.35, 8);
  for (let ix = -1.5; ix <= 1.5; ix += 1) {
    for (let iz = -1.5; iz <= 1.5; iz += 1) {
      const isGuideTube = Math.abs(ix) === Math.abs(iz) && Math.abs(ix) === 0.5;
      const rod = new THREE.Mesh(isGuideTube ? guideGeometry : rodGeometry, isGuideTube ? materials.steam : materials.fuel);
      rod.position.set(ix * 0.045, 0.05, iz * 0.045);
      rod.castShadow = true;
      assembly.add(rod);
    }
  }

  const nozzle = roundedCylinder(0.16, 0.16, 0.08, 16, materials.fuelCladding);
  nozzle.position.y = 0.82;
  assembly.add(nozzle);

  addToActiveGroup('core', assembly);
  return assembly;
}

function createReactorIsland() {
  const domeGroup = new THREE.Group();
  domeGroup.position.set(-7.2, 0, 0);
  scene.add(domeGroup);
  activeGroups.set('reactor', [domeGroup]);

  const containmentBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.85, 4.5, 72, 1, true, Math.PI * 0.12, Math.PI * 1.55),
    materials.containmentShell,
  );
  containmentBase.position.y = 2.25;
  containmentBase.castShadow = true;
  containmentBase.receiveShadow = true;
  domeGroup.add(containmentBase);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.65, 64, 24, Math.PI * 0.12, Math.PI * 1.55, 0, Math.PI * 0.5),
    materials.containmentShell,
  );
  dome.position.y = 4.5;
  dome.castShadow = true;
  dome.receiveShadow = true;
  domeGroup.add(dome);

  const floor = roundedCylinder(2.45, 2.45, 0.16, 64, materials.darkSteel);
  floor.position.y = 0.1;
  domeGroup.add(floor);

  const internals = new THREE.Group();
  domeGroup.add(internals);
  activeGroups.set('reactorInternals', [internals]);

  const vesselMaterial = new THREE.MeshPhysicalMaterial({
    color: palette.reactorBlue,
    transparent: true,
    opacity: 0.32,
    metalness: 0.08,
    roughness: 0.08,
    transmission: 0.35,
    side: THREE.DoubleSide,
  });
  const vessel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.13, 3.65, 64, 1, true, Math.PI * 0.04, Math.PI * 1.58),
    vesselMaterial,
  );
  vessel.position.y = 2.33;
  vessel.castShadow = true;
  vessel.receiveShadow = true;
  internals.add(vessel);
  addToActiveGroup('core', vessel);

  const upperHead = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 48, 16, Math.PI * 0.04, Math.PI * 1.58, 0, Math.PI * 0.5),
    vesselMaterial,
  );
  upperHead.position.y = 4.15;
  upperHead.castShadow = true;
  internals.add(upperHead);
  addToActiveGroup('reactorInternals', upperHead);

  const lowerHead = new THREE.Mesh(
    new THREE.SphereGeometry(1.13, 48, 16, Math.PI * 0.04, Math.PI * 1.58, Math.PI * 0.5, Math.PI * 0.5),
    vesselMaterial,
  );
  lowerHead.position.y = 0.55;
  lowerHead.castShadow = true;
  internals.add(lowerHead);
  addToActiveGroup('reactorInternals', lowerHead);

  const coreBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.82, 2.65, 48, 1, true, Math.PI * 0.08, Math.PI * 1.65),
    new THREE.MeshStandardMaterial({
      color: 0xa8b6c1,
      metalness: 0.48,
      roughness: 0.24,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  coreBarrel.position.y = 2.05;
  coreBarrel.castShadow = true;
  internals.add(coreBarrel);
  addToActiveGroup('reactorInternals', coreBarrel);

  const moderator = roundedCylinder(0.72, 0.76, 1.75, 48, materials.moderator);
  moderator.position.y = 1.72;
  internals.add(moderator);
  addToActiveGroup('core', moderator);

  const supportPlate = roundedCylinder(0.83, 0.83, 0.08, 48, materials.fuelCladding);
  supportPlate.position.y = 0.82;
  internals.add(supportPlate);
  addToActiveGroup('reactorInternals', supportPlate);

  const upperPlate = roundedCylinder(0.76, 0.76, 0.08, 48, materials.fuelCladding);
  upperPlate.position.y = 2.66;
  internals.add(upperPlate);
  addToActiveGroup('reactorInternals', upperPlate);

  const lowerPlenum = roundedCylinder(0.72, 0.83, 0.34, 40, materials.cool);
  lowerPlenum.position.y = 0.58;
  internals.add(lowerPlenum);
  addToActiveGroup('reactorInternals', lowerPlenum);

  let assemblyIndex = 0;
  for (let x = -0.48; x <= 0.48; x += 0.24) {
    for (let z = -0.48; z <= 0.48; z += 0.24) {
      if (Math.hypot(x, z) > 0.63) continue;
      internals.add(createFuelAssembly(x, z, assemblyIndex));
      assemblyIndex += 1;
    }
  }

  const controlBank = new THREE.Group();
  const controlPositions = [
    [0, 0],
    [-0.24, 0],
    [0.24, 0],
    [0, -0.24],
    [0, 0.24],
    [-0.24, -0.24],
    [0.24, 0.24],
  ];
  controlPositions.forEach(([x, z]) => {
    const guide = roundedCylinder(0.025, 0.025, 1.95, 12, materials.steam);
    guide.position.set(x, 2.72, z);
    controlBank.add(guide);

    const rod = roundedCylinder(0.018, 0.018, 2.35, 12, materials.controlRod);
    rod.position.set(x, 2.6, z);
    controlBank.add(rod);
  });
  internals.add(controlBank);
  addToActiveGroup('core', controlBank);

  const controlDrive = roundedCylinder(0.76, 0.76, 0.22, 32, materials.darkSteel);
  controlDrive.position.y = 4.34;
  internals.add(controlDrive);
  addToActiveGroup('reactorInternals', controlDrive);

  const inletNozzle = roundedCylinder(0.16, 0.16, 0.92, 20, materials.cool);
  inletNozzle.rotation.z = Math.PI / 2;
  inletNozzle.position.set(-1.22, 1.45, -0.2);
  internals.add(inletNozzle);
  addToActiveGroup('reactorInternals', inletNozzle);

  const outletNozzle = roundedCylinder(0.18, 0.18, 0.98, 20, materials.hot);
  outletNozzle.rotation.z = Math.PI / 2;
  outletNozzle.position.set(1.2, 3.18, 0.22);
  internals.add(outletNozzle);
  addToActiveGroup('reactorInternals', outletNozzle);

  const arrowMaterialHot = new THREE.MeshStandardMaterial({
    color: palette.hot,
    emissive: palette.hot,
    emissiveIntensity: 0.7,
    roughness: 0.2,
  });
  const arrowMaterialCool = new THREE.MeshStandardMaterial({
    color: palette.cool,
    emissive: palette.cool,
    emissiveIntensity: 0.55,
    roughness: 0.2,
  });
  for (let i = 0; i < 5; i += 1) {
    const upArrow = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 16), arrowMaterialHot);
    upArrow.position.set(-0.42 + i * 0.21, 1.18 + i * 0.28, 0.66);
    internals.add(upArrow);
    addToActiveGroup('neutronFlux', upArrow);

    const downArrow = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 16), arrowMaterialCool);
    downArrow.rotation.x = Math.PI;
    downArrow.position.set(-0.72, 3.18 - i * 0.34, -0.42 + i * 0.12);
    internals.add(downArrow);
    addToActiveGroup('reactorInternals', downArrow);
  }

  const neutronMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdf8a9,
    emissive: 0xf3c74d,
    emissiveIntensity: 1.5,
    roughness: 0.18,
  });
  for (let i = 0; i < 18; i += 1) {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), neutronMaterial);
    const angle = (i / 18) * Math.PI * 2;
    const radius = 0.12 + (i % 5) * 0.09;
    marker.position.set(Math.cos(angle) * radius, 1.7 + (i % 4) * 0.22, Math.sin(angle) * radius);
    marker.userData = { angle, radius, yBase: marker.position.y };
    internals.add(marker);
    neutronMarkers.push(marker);
    addToActiveGroup('neutronFlux', marker);
  }

  addLabel('剖切安全壳', new THREE.Vector3(-8.55, 5.18, -0.78), 'reactor');
  addLabel('压力容器透明剖面', new THREE.Vector3(-6.05, 4.42, 0.78), 'reactorInternals');
  addLabel('控制棒驱动机构', new THREE.Vector3(-7.05, 5.02, -1.12), 'reactorInternals');
  addLabel('燃料组件阵列', new THREE.Vector3(-7.72, 1.78, 1.34), 'core');
  addLabel('堆芯围筒 / 支撑板', new THREE.Vector3(-5.2, 2.2, -0.72), 'reactorInternals');
  addLabel('冷却剂入口', new THREE.Vector3(-8.85, 1.34, -0.62), 'reactorInternals');
  addLabel('热冷却剂出口', new THREE.Vector3(-5.62, 3.28, 0.66), 'reactorInternals');
}

function createSteamGenerator() {
  const group = new THREE.Group();
  group.position.set(-1.9, 0, 0);
  scene.add(group);
  activeGroups.set('steamGenerator', [group]);

  const body = roundedCylinder(1.1, 1.2, 4.5, 48, materials.steel);
  body.position.y = 2.25;
  group.add(body);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 36, 16), materials.steel);
  cap.scale.y = 0.55;
  cap.position.y = 4.48;
  cap.castShadow = true;
  group.add(cap);

  const bundle = new THREE.Group();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const tube = roundedCylinder(0.025, 0.025, 3.4, 8, materials.hot);
    tube.position.set(Math.cos(angle) * 0.54, 2.3, Math.sin(angle) * 0.54);
    bundle.add(tube);
  }
  group.add(bundle);

  addLabel('蒸汽发生器', new THREE.Vector3(-1.9, 5.2, 0), 'steamGenerator');
}

function createTurbineGenerator() {
  const turbineGroup = new THREE.Group();
  turbineGroup.position.set(4.8, 0, 0.05);
  scene.add(turbineGroup);
  activeGroups.set('turbine', [turbineGroup]);

  const casing = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 2.7, 16, 36), materials.steel);
  casing.rotation.z = Math.PI / 2;
  casing.position.y = 2.45;
  casing.castShadow = true;
  casing.receiveShadow = true;
  turbineGroup.add(casing);

  const rotor = roundedCylinder(0.14, 0.14, 4.5, 20, materials.darkSteel);
  rotor.rotation.z = Math.PI / 2;
  rotor.position.y = 2.45;
  turbineGroup.add(rotor);

  for (let i = 0; i < 12; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.18), materials.steam);
    blade.position.set(-1.3 + i * 0.24, 2.45, 0);
    blade.rotation.x = (i % 2 ? -1 : 1) * 0.52;
    turbineGroup.add(blade);
    activeGroups.set('turbine', [...activeGroups.get('turbine'), blade]);
  }

  const generator = new THREE.Group();
  generator.position.set(9.0, 0, 0.05);
  scene.add(generator);
  activeGroups.set('generator', [generator]);

  const genBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 2.15, 16, 38), materials.darkSteel);
  genBody.rotation.z = Math.PI / 2;
  genBody.position.y = 2.45;
  genBody.castShadow = true;
  generator.add(genBody);

  const copperBands = [-0.68, 0, 0.68];
  copperBands.forEach((x) => {
    const band = roundedCylinder(0.98, 0.98, 0.08, 42, new THREE.MeshStandardMaterial({ color: palette.copper, metalness: 0.55, roughness: 0.22 }));
    band.rotation.z = Math.PI / 2;
    band.position.set(x, 2.45, 0);
    generator.add(band);
  });

  const shaft = roundedCylinder(0.12, 0.12, 5.0, 20, materials.darkSteel);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(6.8, 2.45, 0.05);
  scene.add(shaft);
  activeGroups.set('generator', [...activeGroups.get('generator'), shaft]);

  const transformer = new THREE.Group();
  transformer.position.set(12.6, 0, -0.9);
  scene.add(transformer);
  activeGroups.set('grid', [transformer]);
  const transformerBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.2), materials.darkSteel);
  transformerBody.position.y = 1.2;
  transformerBody.castShadow = true;
  transformer.add(transformerBody);
  for (let i = -1; i <= 1; i += 1) {
    const insulator = roundedCylinder(0.07, 0.07, 0.8, 12, materials.steam);
    insulator.position.set(i * 0.42, 2.1, 0);
    transformer.add(insulator);
  }

  createPylon(new THREE.Vector3(15.2, 0, -2.8));
  createPylon(new THREE.Vector3(18.4, 0, -5.1));

  addLabel('汽轮机', new THREE.Vector3(4.8, 3.65, 0), 'turbine');
  addLabel('发电机', new THREE.Vector3(9.0, 3.65, 0), 'generator');
  addLabel('主变压器 / 电网', new THREE.Vector3(14.2, 2.9, -2.2), 'grid');
}

function createPylon(position) {
  const group = new THREE.Group();
  group.position.copy(position);
  scene.add(group);
  activeGroups.set('grid', [...(activeGroups.get('grid') || []), group]);

  const material = new THREE.MeshStandardMaterial({ color: palette.grid, metalness: 0.45, roughness: 0.38 });
  const legGeometry = new THREE.CylinderGeometry(0.035, 0.045, 3.2, 8);
  [-0.38, 0.38].forEach((x) => {
    const leg = new THREE.Mesh(legGeometry, material);
    leg.position.set(x, 1.6, 0);
    leg.rotation.z = x > 0 ? -0.14 : 0.14;
    leg.castShadow = true;
    group.add(leg);
  });
  const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), material);
  cross.position.y = 2.55;
  group.add(cross);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.7, 4), material);
  top.position.y = 3.35;
  top.rotation.y = Math.PI / 4;
  group.add(top);
}

function createCondenserAndCoolingTower() {
  const condenser = new THREE.Group();
  condenser.position.set(4.4, 0, -4.4);
  scene.add(condenser);
  activeGroups.set('condenser', [condenser]);

  const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 2.2, 12, 30), materials.cool);
  shell.rotation.z = Math.PI / 2;
  shell.position.y = 1.0;
  shell.castShadow = true;
  condenser.add(shell);

  const tower = new THREE.Group();
  tower.position.set(-0.2, 0, -9.4);
  scene.add(tower);
  activeGroups.set('coolingTower', [tower]);

  const towerGeometry = new THREE.CylinderGeometry(1.55, 2.3, 5.4, 64, 1, true);
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9c4cd,
    roughness: 0.76,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72,
  });
  const hyperboloid = new THREE.Mesh(towerGeometry, towerMaterial);
  hyperboloid.position.y = 2.7;
  hyperboloid.scale.x = 0.88;
  hyperboloid.castShadow = true;
  hyperboloid.receiveShadow = true;
  tower.add(hyperboloid);

  for (let i = 0; i < 7; i += 1) {
    const vapor = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 + i * 0.06, 18, 10),
      new THREE.MeshStandardMaterial({
        color: 0xe7f8fb,
        transparent: true,
        opacity: 0.13,
        roughness: 0.2,
      }),
    );
    vapor.position.set((i % 2 ? -0.25 : 0.22) * i, 5.6 + i * 0.34, (i % 3 - 1) * 0.28);
    tower.add(vapor);
    activeGroups.set('coolingTower', [...activeGroups.get('coolingTower'), vapor]);
  }

  addLabel('冷凝器', new THREE.Vector3(4.4, 2.0, -4.4), 'condenser');
  addLabel('冷却塔', new THREE.Vector3(-0.2, 5.9, -9.4), 'coolingTower');
}

function createFlowSystems() {
  const primaryHot = createPipe('primaryHot', [
    new THREE.Vector3(-6.35, 3.15, 0.38),
    new THREE.Vector3(-4.8, 3.5, 0.75),
    new THREE.Vector3(-3.2, 3.35, 0.62),
    new THREE.Vector3(-2.7, 3.05, 0.34),
  ], palette.hot, 0.16);

  const primaryCool = createPipe('primaryCool', [
    new THREE.Vector3(-2.8, 1.55, -0.34),
    new THREE.Vector3(-4.1, 1.22, -0.72),
    new THREE.Vector3(-5.8, 1.34, -0.58),
    new THREE.Vector3(-6.42, 1.65, -0.25),
  ], palette.cool, 0.16);

  const secondarySteam = createPipe('secondarySteam', [
    new THREE.Vector3(-0.92, 4.15, 0.2),
    new THREE.Vector3(1.6, 5.0, 0.16),
    new THREE.Vector3(3.45, 3.55, 0.12),
    new THREE.Vector3(4.1, 2.75, 0.1),
  ], palette.steam, 0.18, 0.92);

  const condensate = createPipe('secondarySteam', [
    new THREE.Vector3(5.2, 1.65, -0.22),
    new THREE.Vector3(5.0, 1.05, -3.2),
    new THREE.Vector3(2.1, 1.05, -4.2),
    new THREE.Vector3(-0.9, 1.65, -0.42),
  ], palette.cool, 0.13, 0.88);

  const coolingWaterA = createPipe('coolingWater', [
    new THREE.Vector3(3.6, 0.8, -4.7),
    new THREE.Vector3(1.8, 0.75, -6.3),
    new THREE.Vector3(0.6, 0.85, -8.2),
    new THREE.Vector3(-0.2, 1.0, -8.25),
  ], palette.water, 0.15);

  const coolingWaterB = createPipe('coolingWater', [
    new THREE.Vector3(-0.3, 0.55, -10.4),
    new THREE.Vector3(1.3, 0.45, -8.2),
    new THREE.Vector3(3.1, 0.55, -6.1),
    new THREE.Vector3(4.8, 0.72, -4.85),
  ], palette.cool, 0.13);

  const electricity = createPipe('electricity', [
    new THREE.Vector3(10.2, 2.65, 0.05),
    new THREE.Vector3(11.7, 2.62, -0.42),
    new THREE.Vector3(12.9, 2.48, -1.0),
    new THREE.Vector3(15.2, 2.55, -2.8),
    new THREE.Vector3(18.4, 2.55, -5.1),
  ], palette.warm, 0.07);

  createParticles(primaryHot.curve, palette.hot, 18, 0.075, 'primaryHot');
  createParticles(primaryCool.curve, palette.cool, 16, 0.065, 'primaryCool', 0.2);
  createParticles(secondarySteam.curve, palette.steam, 22, 0.07, 'secondarySteam');
  createParticles(condensate.curve, palette.cool, 12, 0.055, 'secondarySteam', 0.4);
  createParticles(coolingWaterA.curve, palette.water, 12, 0.055, 'coolingWater');
  createParticles(coolingWaterB.curve, palette.cool, 12, 0.052, 'coolingWater', 0.3);
  createParticles(electricity.curve, palette.warm, 14, 0.058, 'electricity');
}

function createHotspot(position, radius, groupName, stepIndex) {
  const target = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  );
  target.position.copy(position);
  target.userData = { groupName, stepIndex };
  scene.add(target);
  clickableTargets.push(target);
}

function createHotspots() {
  createHotspot(new THREE.Vector3(-7.2, 2.8, 0), 1.4, 'core', 0);
  createHotspot(new THREE.Vector3(-2.0, 2.7, 0), 1.25, 'steamGenerator', 1);
  createHotspot(new THREE.Vector3(4.8, 2.45, 0), 1.25, 'turbine', 2);
  createHotspot(new THREE.Vector3(9.0, 2.45, 0), 1.25, 'generator', 3);
  createHotspot(new THREE.Vector3(0.1, 2.7, -9.4), 2.4, 'coolingTower', 4);
}

function updateActiveState() {
  const activeNames = new Set(steps[currentStep].active);
  activeGroups.forEach((objects, groupName) => {
    const active = activeNames.has(groupName);
    objects.forEach((object) => {
      object.traverse((child) => {
        if (child.isMesh && child.material) {
          const materialsToSet = Array.isArray(child.material) ? child.material : [child.material];
          materialsToSet.forEach((material) => {
            if (material.userData.baseOpacity === undefined) {
              material.userData.baseOpacity = material.opacity;
            }
            if (material.emissive && material.userData.baseEmissiveIntensity === undefined) {
              material.userData.baseEmissiveIntensity = material.emissiveIntensity;
            }
            if (material.transparent) {
              material.opacity = active ? material.userData.baseOpacity : Math.min(material.userData.baseOpacity, 0.42);
            }
            if (material.emissive) {
              material.emissiveIntensity = active
                ? Math.max(material.userData.baseEmissiveIntensity, 0.65)
                : Math.min(material.userData.baseEmissiveIntensity, 0.18);
            }
          });
        }
      });
    });
  });

  labels.forEach(({ element, groupName }) => {
    element.classList.toggle('active', activeNames.has(groupName));
  });

  document.querySelector('#step-title').textContent = steps[currentStep].title;
  document.querySelector('#step-description').textContent = steps[currentStep].description;
  document.querySelectorAll('[data-step]').forEach((element) => {
    element.classList.toggle('active', Number(element.dataset.step) === currentStep);
  });
}

function setStep(stepIndex, moveCamera = true) {
  currentStep = (stepIndex + steps.length) % steps.length;
  updateActiveState();
  if (moveCamera) {
    controls.target.copy(steps[currentStep].focus);
    camera.position.copy(steps[currentStep].camera);
    controls.update();
  }
}

function applyResponsiveCamera(reset = false) {
  const isMobile = window.innerWidth < 620;
  camera.fov = isMobile ? 56 : 48;
  camera.updateProjectionMatrix();

  if (reset) {
    camera.position.copy(isMobile ? mobileCameraPosition : defaultCameraPosition);
    controls.target.copy(isMobile ? mobileCameraTarget : defaultCameraTarget);
    controls.update();
  }
}

function createFacility() {
  addLighting();
  createGround();
  createReactorIsland();
  createSteamGenerator();
  createTurbineGenerator();
  createCondenserAndCoolingTower();
  createFlowSystems();
  createHotspots();
  updateActiveState();
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.04);
  const runtime = clock.elapsedTime;

  const coreLight = scene.getObjectByName('coreLight');
  if (coreLight) {
    coreLight.intensity = 78 + Math.sin(runtime * 3.2) * 14;
  }

  particles.forEach((particle) => {
    if (running) {
      particle.t = (particle.t + delta * particle.baseSpeed * speed) % 1;
    }
    const point = particle.path.getPointAt(particle.t);
    particle.mesh.position.copy(point);
    const active = steps[currentStep].active.includes(particle.groupName);
    particle.mesh.scale.setScalar(active ? 1.3 : 0.82);
  });

  neutronMarkers.forEach((marker, index) => {
    const active = steps[currentStep].active.includes('neutronFlux');
    const pulse = 1 + Math.sin(runtime * 4.4 + index * 0.8) * 0.34;
    marker.scale.setScalar(active ? pulse : 0.72);
    marker.position.x = Math.cos(marker.userData.angle + runtime * 0.9 * speed) * marker.userData.radius;
    marker.position.z = Math.sin(marker.userData.angle + runtime * 0.9 * speed) * marker.userData.radius;
    marker.position.y = marker.userData.yBase + Math.sin(runtime * 2.2 + index) * 0.035;
  });

  const turbine = activeGroups.get('turbine')?.[0];
  if (running && turbine) {
    turbine.rotation.x += delta * 1.8 * speed;
  }

  const generator = activeGroups.get('generator')?.[0];
  if (running && generator) {
    generator.rotation.x -= delta * 0.75 * speed;
  }

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function setupInteraction() {
  document.querySelectorAll('.phase-tab, .timeline-item').forEach((element) => {
    element.addEventListener('click', () => setStep(Number(element.dataset.step)));
  });

  document.querySelector('#speed').addEventListener('input', (event) => {
    speed = Number(event.target.value);
    const thermal = Math.round(3210 * (0.82 + speed * 0.18));
    const electric = Math.round(thermal * 0.336);
    document.querySelector('#metric-thermal').textContent = `${thermal} MWt`;
    document.querySelector('#metric-electric').textContent = `${electric} MWe`;
    document.querySelector('#metric-efficiency').textContent = `${((electric / thermal) * 100).toFixed(1)}%`;
  });

  document.querySelector('#toggle-run').addEventListener('click', (event) => {
    running = !running;
    event.currentTarget.innerHTML = running ? '<i data-lucide="pause"></i>' : '<i data-lucide="play"></i>';
    createIcons({ icons: { Pause, Play } });
  });

  document.querySelector('#reset-view').addEventListener('click', () => {
    applyResponsiveCamera(true);
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickableTargets, false)[0];
    if (hit) {
      setStep(hit.object.userData.stepIndex);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') setStep(currentStep + 1);
    if (event.key === 'ArrowLeft') setStep(currentStep - 1);
    if (event.key === ' ') {
      event.preventDefault();
      document.querySelector('#toggle-run').click();
    }
  });

  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    applyResponsiveCamera();
    renderer.setSize(width, height);
    labelRenderer.setSize(width, height);
  });
}

createFacility();
setupInteraction();
applyResponsiveCamera(true);
setStep(0, true);
animate();
