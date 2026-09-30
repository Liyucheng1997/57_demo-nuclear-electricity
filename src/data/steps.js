import * as THREE from 'three';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// 能量转换链节点（页脚）
export const ENERGY_NODES = [
  { id: 'nuclear', label: '核能', sub: '铀-235 裂变' },
  { id: 'primary', label: '热能', sub: '一回路 327 °C' },
  { id: 'steam', label: '热能', sub: '蒸汽 285 °C' },
  { id: 'mechanical', label: '机械能', sub: '1500 r/min' },
  { id: 'electric', label: '电能', sub: '500 kV 电网' },
  { id: 'waste', label: '余热', sub: '冷却塔 → 大气' },
];

export const STEPS = [
  {
    key: 'overview',
    tab: '总览',
    icon: 'factory',
    title: '压水堆核电站全景',
    energy: '核能 → 热能 → 机械能 → 电能',
    description:
      '核电站本质上是一台“烧铀的蒸汽机”：反应堆用核裂变产生热量，把水烧成蒸汽推动汽轮机，再带动发电机发电。电站分为核岛（安全壳内）与常规岛（汽轮机厂房），三个彼此隔离的水回路串联起整个能量转换过程。',
    points: [
      '<b class="t-hot">一回路</b>：高压水带走堆芯热量，有放射性，封闭在安全壳内',
      '<b class="t-steam">二回路</b>：水变成蒸汽推动汽轮机做功，不含放射性',
      '<b class="t-cool">三回路</b>：循环冷却水带走余热，经冷却塔排入大气',
    ],
    facts: [
      ['热功率', '3210 MWt'],
      ['电功率', '1080 MWe'],
      ['热效率', '≈ 33.6%'],
      ['换料周期', '18 个月'],
    ],
    energyNodes: ['nuclear', 'primary', 'steam', 'mechanical', 'electric', 'waste'],
    fluids: null,
    outline: [],
    camera: { pos: v(16, 46, 70), target: v(5, 2, -8) },
  },
  {
    key: 'fission',
    tab: '裂变原理',
    icon: 'atom',
    title: '链式裂变反应',
    energy: '原子核结合能 → 碎片动能 → 热能',
    description:
      '一个慢中子撞进铀-235 原子核，使它变得极不稳定并分裂成两块较轻的碎片（例如钡和氪），同时放出 2~3 个快中子、γ 射线和约 200 MeV 能量。碎片在燃料中高速飞散又很快停下——它们的动能就变成了热。',
    points: [
      '快中子（橙）与水中的氢原子碰撞减速成<b class="t-neutron">热中子</b>（青），才能高效引发下一次裂变',
      '平均每次裂变恰好留下 1 个中子继续裂变，反应就稳定持续——称为<b>临界</b>',
      '<b>控制棒</b>吸收多余中子：拔出功率上升，插入功率下降，全插入即停堆',
      '拖动右侧“控制棒插入深度”，观察链式反应的变化',
    ],
    facts: [
      ['单次裂变能量', '≈ 200 MeV'],
      ['质量亏损', '≈ 0.1% · E = Δmc²'],
      ['1 kg 铀-235', '≈ 2700 t 标准煤'],
      ['燃料富集度', '3~5% 铀-235'],
    ],
    energyNodes: ['nuclear'],
    micro: true,
  },
  {
    key: 'core',
    tab: '反应堆',
    icon: 'radiation',
    title: '反应堆压力容器与堆芯',
    energy: '核能 → 热能',
    description:
      '压力容器是壁厚约 20 cm 的钢制容器，内装 157 个燃料组件。冷却剂从进口接管流入，沿容器壁与堆芯吊篮之间的环形下降段流到底部，再向上穿过燃料棒间隙吸热，从 292 °C 升到 327 °C 后由出口流出。堆芯周围幽蓝的光是切伦科夫辐射。',
    points: [
      '燃料：UO₂ 陶瓷芯块装入锆合金包壳，组成 17×17 的燃料组件',
      '普通水同时是<b>慢化剂</b>（减速中子）与<b>冷却剂</b>（带走热量）',
      '控制棒从顶部驱动机构插入，与水中溶解的硼酸共同调节反应性',
      '纵深防御：芯块 → 包壳 → 压力容器 → 安全壳，四道屏障',
    ],
    facts: [
      ['运行压力', '15.5 MPa'],
      ['进口 / 出口', '292 / 327 °C'],
      ['燃料棒总数', '≈ 41 000 根'],
      ['活性区高度', '≈ 3.66 m'],
    ],
    energyNodes: ['nuclear', 'primary'],
    fluids: ['coreFlow', 'primary'],
    outline: ['rpv'],
    camera: { pos: v(-11.6, 8.4, 13.6), target: v(-16.4, 4.7, 0) },
  },
  {
    key: 'primary',
    tab: '一回路',
    icon: 'thermometer',
    title: '一回路：把堆芯热量送出去',
    energy: '热能（高压热水）',
    description:
      '主泵推动高压水在“堆芯 → 热段 → 蒸汽发生器 → 主泵 → 冷段 → 堆芯”的闭合回路中循环。稳压器把压力稳定在 15.5 MPa，使水在 327 °C 仍然不会沸腾——“压水堆”由此得名。',
    points: [
      '<b class="t-hot">热段</b>把 327 °C 的水送进蒸汽发生器，放热后变成 292 °C',
      '<b class="t-cold">冷段</b>经主泵把冷却剂送回压力容器',
      '主泵转速恒定：功率变化体现为进出口温差的变化',
      '稳压器用电加热器升压、用喷淋降压',
    ],
    facts: [
      ['运行压力', '15.5 MPa'],
      ['冷却剂温升', '≈ 35 °C'],
      ['环路', '2 条（示意）'],
      ['主泵功率', '≈ 6.5 MW / 台'],
    ],
    energyNodes: ['primary'],
    fluids: ['primary', 'coreFlow', 'sgTubes'],
    outline: ['rpv', 'pressurizer', 'rcp', 'sg'],
    camera: { pos: v(-5.5, 16.5, 17), target: v(-16, 5.2, -1) },
  },
  {
    key: 'sg',
    tab: '蒸汽发生器',
    icon: 'waves',
    title: '蒸汽发生器：一、二回路的换热边界',
    energy: '一回路热能 → 蒸汽热能',
    description:
      '一回路热水在数千根倒 U 形传热管内流过，热量穿过管壁传给管外的二回路水。二回路压力约 6.9 MPa，水在约 285 °C 沸腾，汽水混合物经汽水分离器和干燥器除去水滴，变成干饱和蒸汽，经主蒸汽管道送往汽轮机。',
    points: [
      '两个回路只交换热量、不交换水——放射性被隔离在一回路内',
      'U 形管颜色由红变蓝，表示一回路水沿管放热降温',
      '给水从给水环进入，沿外侧环隙下降后进入管束加热沸腾',
    ],
    facts: [
      ['传热管', '≈ 4 500 根 / 台'],
      ['二回路压力', '≈ 6.9 MPa'],
      ['蒸汽温度', '≈ 285 °C'],
      ['总蒸汽量', '≈ 6 000 t/h'],
    ],
    energyNodes: ['primary', 'steam'],
    fluids: ['sgTubes', 'sgSteam', 'mainSteam', 'feedwater'],
    outline: ['sg'],
    camera: { pos: v(-13.6, 11.6, 13.6), target: v(-11.9, 8.6, 0) },
  },
  {
    key: 'turbine',
    tab: '汽轮机',
    icon: 'fan',
    title: '汽轮机：热能变机械能',
    energy: '蒸汽热能 → 机械能',
    description:
      '主蒸汽先进入高压缸膨胀做功；排出的湿蒸汽经汽水分离再热器去湿并再加热，再进入两个低压缸继续膨胀。蒸汽推动一级级动叶片，使整根转子旋转。越往后蒸汽压力越低、体积越大，所以叶片越来越长。',
    points: [
      '高压缸 → 汽水分离再热器 → 低压缸，蒸汽逐级膨胀降压',
      '动叶（随转子旋转）与静叶（固定在缸体上）交替排列',
      '核电多为半速机组：1500 r/min，配 4 极发电机',
      '上半缸以透明方式显示，便于观察内部叶栅',
    ],
    facts: [
      ['转速', '1500 r/min'],
      ['进汽压力', '≈ 6.7 MPa'],
      ['排汽压力', '≈ 5 kPa（真空）'],
      ['末级叶片', '≈ 1.8 m'],
    ],
    energyNodes: ['steam', 'mechanical'],
    fluids: ['mainSteam', 'turbineSteam', 'reheatSteam'],
    outline: ['turbine', 'msr'],
    camera: { pos: v(8.5, 22, 19.5), target: v(8.8, 4, -0.3) },
  },
  {
    key: 'generator',
    tab: '发电并网',
    icon: 'zap',
    title: '发电机：机械能变电能',
    energy: '机械能 → 电能',
    description:
      '汽轮机与发电机转子同轴旋转。转子绕组通入直流电形成 N/S 磁极，旋转磁场切割定子三相绕组，按电磁感应定律产生 24 kV、50 Hz 的三相交流电，再经主变压器升压到 500 kV 送入电网，以降低远距离输电损耗。',
    points: [
      '4 极转子 × 1500 r/min ÷ 60 × 2 = <b>50 Hz</b>',
      '三相绕组（黄 / 绿 / 红）依次达到峰值，相位互差 120°',
      '升压后电流变小，线路损耗 ∝ I²R 大幅降低',
    ],
    facts: [
      ['出口电压', '24 kV'],
      ['并网电压', '500 kV'],
      ['频率', '50 Hz'],
      ['发电机效率', '≈ 98.9%'],
    ],
    energyNodes: ['mechanical', 'electric'],
    fluids: ['electric'],
    outline: ['generator', 'grid'],
    camera: { pos: v(22, 12.5, 24), target: v(29, 5, -1) },
  },
  {
    key: 'cooling',
    tab: '冷凝冷却',
    icon: 'snowflake',
    title: '冷凝与冷却：完成热力循环',
    energy: '余热 → 环境',
    description:
      '做完功的乏汽排入凝汽器，在冷却水管外凝结成水。凝结水经凝结水泵、低压加热器、除氧器、给水泵和高压加热器逐级加压预热，重新送回蒸汽发生器。冷却水带走的热量在冷却塔中通过蒸发散入大气。',
    points: [
      '凝汽器保持高真空，让蒸汽充分膨胀、多做功',
      '约 2/3 的热量必须作为余热排出——热力学第二定律决定了效率上限',
      '冷却塔冒出的“白烟”只是水蒸气，不含放射性',
      '循环冷却水与二回路同样只换热、不混合',
    ],
    facts: [
      ['凝汽器压力', '≈ 5 kPa'],
      ['冷却水温升', '≈ 10 °C'],
      ['给水温度', '≈ 225 °C'],
      ['余热排放', '≈ 2 130 MW'],
    ],
    energyNodes: ['waste', 'steam'],
    fluids: ['coolingWater', 'coolingAir', 'feedwater', 'turbineSteam'],
    outline: ['condenser', 'coolingTower', 'feedwater'],
    ghost: ['turbine', 'msr', 'generator'],
    camera: { pos: v(26, 18, 26), target: v(9, 7, -14) },
  },
];
