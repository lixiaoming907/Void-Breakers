export type WeaponId =
  | 'scatter'
  | 'lance'
  | 'homing'
  | 'blackhole'
  | 'missile'
  | 'reflect';

export type SecondaryId = 'orbit' | 'missilePod' | 'nova' | 'turret';

export type UpgradeId =
  | WeaponId
  | SecondaryId
  | 'fireRate'
  | 'moveSpeed'
  | 'damage'
  | 'maxShield'
  | 'shieldRegen'
  | 'maxHealth'
  | 'multishot'
  | 'pierce'
  | 'crit'
  | 'critDamage'
  | 'dashCd'
  | 'bulletSpeed'
  | 'magnet'
  | 'shieldOnKill'
  | 'explosive'
  | 'agility'
  // weapon-specific
  | 'wScatterPellets'
  | 'wScatterDmg'
  | 'wScatterPierce'
  | 'wLanceDmg'
  | 'wLanceWidth'
  | 'wLanceRate'
  | 'wHomingTurn'
  | 'wHomingSalvo'
  | 'wHomingDmg'
  | 'wBlackholeGravity'
  | 'wBlackholeRadius'
  | 'wBlackholeDps'
  | 'wMissileBoomDmg'
  | 'wMissileBoomRadius'
  | 'wMissileRate'
  | 'wReflectBounce'
  | 'wReflectDmg'
  | 'wReflectSpeed'
  // secondary buffs
  | 'sOrbitDmg'
  | 'sOrbitCount'
  | 'sOrbitSpeed'
  | 'sMissileDmg'
  | 'sMissileCount'
  | 'sMissileCd'
  | 'sNovaDmg'
  | 'sNovaRadius'
  | 'sNovaCd'
  | 'sTurretDmg'
  | 'sTurretRate'
  | 'sTurretRange';

export type UpgradeDef = {
  id: UpgradeId;
  name: string;
  description: string;
  tag: '武器' | '副武器' | '属性' | '生存' | '进阶' | '专属' | '副武强化';
  maxStacks: number;
  weapon?: WeaponId;
  secondary?: SecondaryId;
  requiresWeapon?: WeaponId;
  requiresSecondary?: SecondaryId;
};

export type PlayerStats = {
  fireRateMult: number;
  moveSpeedMult: number;
  damageMult: number;
  bulletSpeedMult: number;
  maxShieldBonus: number;
  maxHealthBonus: number;
  shieldRegenPerSec: number;
  multishotBonus: number;
  pierceBonus: number;
  critChance: number;
  critDamageMult: number;
  dashCdMult: number;
  magnetRadius: number;
  shieldOnKill: number;
  explosive: boolean;
  weapon: WeaponId;
  // weapon-specific
  scatterPellets: number;
  scatterDmg: number;
  scatterPierce: number;
  lanceDmg: number;
  lanceWidth: number;
  lanceRate: number;
  homingTurn: number;
  homingSalvo: number;
  homingDmg: number;
  blackholeGravity: number;
  blackholeRadius: number;
  blackholeDps: number;
  missileBoomDmg: number;
  missileBoomRadius: number;
  missileRate: number;
  reflectBounce: number;
  reflectDmg: number;
  reflectSpeed: number;
};

export type SecondaryStats = {
  orbitDamage: number;
  orbitCount: number;
  orbitSpin: number;
  missileDamage: number;
  missileCount: number;
  missileCd: number;
  novaDamage: number;
  novaRadius: number;
  novaCd: number;
  turretDamage: number;
  turretCd: number;
  turretRange: number;
};

export function defaultSecondaryStats(): SecondaryStats {
  return {
    orbitDamage: 14,
    orbitCount: 3,
    orbitSpin: 2.8,
    missileDamage: 28,
    missileCount: 2,
    missileCd: 2.1,
    novaDamage: 22,
    novaRadius: 4.2,
    novaCd: 3.6,
    turretDamage: 16,
    turretCd: 0.42,
    turretRange: 13,
  };
}

export function applySecondaryBuff(stats: SecondaryStats, id: UpgradeId): void {
  switch (id) {
    case 'sOrbitDmg':
      stats.orbitDamage *= 1.35;
      break;
    case 'sOrbitCount':
      stats.orbitCount += 1;
      break;
    case 'sOrbitSpeed':
      stats.orbitSpin *= 1.25;
      break;
    case 'sMissileDmg':
      stats.missileDamage *= 1.3;
      break;
    case 'sMissileCount':
      stats.missileCount += 1;
      break;
    case 'sMissileCd':
      stats.missileCd = Math.max(1.1, stats.missileCd * 0.82);
      break;
    case 'sNovaDmg':
      stats.novaDamage *= 1.35;
      break;
    case 'sNovaRadius':
      stats.novaRadius += 0.9;
      break;
    case 'sNovaCd':
      stats.novaCd = Math.max(1.6, stats.novaCd * 0.82);
      break;
    case 'sTurretDmg':
      stats.turretDamage *= 1.28;
      break;
    case 'sTurretRate':
      stats.turretCd = Math.max(0.2, stats.turretCd * 0.84);
      break;
    case 'sTurretRange':
      stats.turretRange += 1.8;
      break;
    default:
      break;
  }
}

/** Fire-rate factor per weapon (higher = shoots more often). */
export const WEAPON_FIRE_RATE: Record<WeaponId, number> = {
  scatter: 0.95,
  lance: 0.42,
  homing: 0.55,
  blackhole: 0.28,
  missile: 0.62,
  reflect: 0.88,
};

export function defaultStats(): PlayerStats {
  return {
    fireRateMult: 1,
    moveSpeedMult: 1,
    damageMult: 1,
    bulletSpeedMult: 1,
    maxShieldBonus: 0,
    maxHealthBonus: 0,
    shieldRegenPerSec: 0,
    multishotBonus: 0,
    pierceBonus: 0,
    critChance: 0.04,
    critDamageMult: 1.45,
    dashCdMult: 1,
    magnetRadius: 1.15,
    shieldOnKill: 0,
    explosive: false,
    weapon: 'scatter',
    scatterPellets: 0,
    scatterDmg: 1,
    scatterPierce: 0,
    lanceDmg: 1,
    lanceWidth: 1,
    lanceRate: 1,
    homingTurn: 1,
    homingSalvo: 0,
    homingDmg: 1,
    blackholeGravity: 1,
    blackholeRadius: 1,
    blackholeDps: 1,
    missileBoomDmg: 1,
    missileBoomRadius: 1,
    missileRate: 1,
    reflectBounce: 1,
    reflectDmg: 1,
    reflectSpeed: 1,
  };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  scatter: {
    id: 'scatter',
    name: '散弹',
    description: '扇形弹幕，主打量大。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'scatter',
  },
  lance: {
    id: 'lance',
    name: '光矛',
    description: '瞬间射出亮蓝光线，高穿透高伤害。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'lance',
  },
  homing: {
    id: 'homing',
    name: '追踪飞弹',
    description: '慢速但强力追踪目标。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'homing',
  },
  blackhole: {
    id: 'blackhole',
    name: '黑洞炮',
    description: '缓慢前进的引力球，持续吸扯并伤害。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'blackhole',
  },
  missile: {
    id: 'missile',
    name: '导弹',
    description: '命中爆炸造成范围伤害。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'missile',
  },
  reflect: {
    id: 'reflect',
    name: '反射光线',
    description: '亮绿短光线，命中弹向下一目标。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'reflect',
  },
  orbit: {
    id: 'orbit',
    name: '光轮环绕',
    description: '解锁环绕光轮，持续绞杀贴近的敌人。',
    tag: '副武器',
    maxStacks: 1,
    secondary: 'orbit',
  },
  missilePod: {
    id: 'missilePod',
    name: '导弹舱',
    description: '间歇发射追踪导弹。',
    tag: '副武器',
    maxStacks: 1,
    secondary: 'missilePod',
  },
  nova: {
    id: 'nova',
    name: '脉冲新星',
    description: '周期性释放环形冲击波。',
    tag: '副武器',
    maxStacks: 1,
    secondary: 'nova',
  },
  turret: {
    id: 'turret',
    name: '自动炮塔',
    description: '自动朝最近敌人开火。',
    tag: '副武器',
    maxStacks: 1,
    secondary: 'turret',
  },
  fireRate: {
    id: 'fireRate',
    name: '超频枪管',
    description: '射速 +12%',
    tag: '属性',
    maxStacks: 5,
  },
  moveSpeed: {
    id: 'moveSpeed',
    name: '推进器过载',
    description: '移动速度 +8%',
    tag: '属性',
    maxStacks: 5,
  },
  damage: {
    id: 'damage',
    name: '高能弹芯',
    description: '伤害 +15%',
    tag: '属性',
    maxStacks: 5,
  },
  maxShield: {
    id: 'maxShield',
    name: '护盾扩容',
    description: '护盾上限 +22，并立即充能。',
    tag: '生存',
    maxStacks: 5,
  },
  shieldRegen: {
    id: 'shieldRegen',
    name: '护盾回充',
    description: '每秒回复 1.2 点护盾。',
    tag: '生存',
    maxStacks: 4,
  },
  maxHealth: {
    id: 'maxHealth',
    name: '装甲强化',
    description: '最大生命 +18，并回复生命。',
    tag: '生存',
    maxStacks: 5,
  },
  multishot: {
    id: 'multishot',
    name: '分裂枪管',
    description: '每次射击额外 +1 发（所有武器保留）。',
    tag: '进阶',
    maxStacks: 3,
  },
  pierce: {
    id: 'pierce',
    name: '穿甲弹',
    description: '子弹可额外穿透 1 个敌人。',
    tag: '进阶',
    maxStacks: 3,
  },
  crit: {
    id: 'crit',
    name: '弱点分析',
    description: '暴击率 +8%',
    tag: '进阶',
    maxStacks: 4,
  },
  critDamage: {
    id: 'critDamage',
    name: '致命校准',
    description: '暴击伤害 +30%',
    tag: '进阶',
    maxStacks: 3,
  },
  dashCd: {
    id: 'dashCd',
    name: '相位冷却',
    description: '冲刺冷却 -12%',
    tag: '属性',
    maxStacks: 4,
  },
  bulletSpeed: {
    id: 'bulletSpeed',
    name: '磁轨加速',
    description: '弹速 +12%',
    tag: '属性',
    maxStacks: 4,
  },
  magnet: {
    id: 'magnet',
    name: '能量吸附',
    description: '拾取范围 +0.4',
    tag: '生存',
    maxStacks: 3,
  },
  shieldOnKill: {
    id: 'shieldOnKill',
    name: '杀敌回盾',
    description: '击杀回复 4.5 点护盾。',
    tag: '生存',
    maxStacks: 4,
  },
  explosive: {
    id: 'explosive',
    name: '高爆弹头',
    description: '所有子弹附带小范围爆炸。',
    tag: '进阶',
    maxStacks: 1,
  },
  agility: {
    id: 'agility',
    name: '神经突触',
    description: '射速 +5%、移速 +4%。',
    tag: '属性',
    maxStacks: 5,
  },
  // scatter
  wScatterPellets: {
    id: 'wScatterPellets',
    name: '扩散喷口',
    description: '散弹弹丸 +4',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'scatter',
  },
  wScatterDmg: {
    id: 'wScatterDmg',
    name: '近距处决',
    description: '散弹伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'scatter',
  },
  wScatterPierce: {
    id: 'wScatterPierce',
    name: '灼热弹丸',
    description: '散弹穿透 +1',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'scatter',
  },
  // lance
  wLanceDmg: {
    id: 'wLanceDmg',
    name: '聚焦棱镜',
    description: '光矛伤害 +40%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'lance',
  },
  wLanceWidth: {
    id: 'wLanceWidth',
    name: '光束扩束',
    description: '光矛更宽',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'lance',
  },
  wLanceRate: {
    id: 'wLanceRate',
    name: '超载电容',
    description: '光矛射速 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'lance',
  },
  // homing
  wHomingTurn: {
    id: 'wHomingTurn',
    name: '锁定矩阵',
    description: '追踪更强',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'homing',
  },
  wHomingSalvo: {
    id: 'wHomingSalvo',
    name: '齐射协议',
    description: '飞弹 +2',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'homing',
  },
  wHomingDmg: {
    id: 'wHomingDmg',
    name: '燃料推进',
    description: '飞弹伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'homing',
  },
  // blackhole
  wBlackholeGravity: {
    id: 'wBlackholeGravity',
    name: '引力增幅',
    description: '黑洞引力 +40%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'blackhole',
  },
  wBlackholeRadius: {
    id: 'wBlackholeRadius',
    name: '事件视界',
    description: '黑洞半径 +25%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'blackhole',
  },
  wBlackholeDps: {
    id: 'wBlackholeDps',
    name: '奇点灼烧',
    description: '黑洞持续伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'blackhole',
  },
  // missile
  wMissileBoomDmg: {
    id: 'wMissileBoomDmg',
    name: '高爆战斗部',
    description: '爆炸伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'missile',
  },
  wMissileBoomRadius: {
    id: 'wMissileBoomRadius',
    name: '扩爆装药',
    description: '爆炸范围 +30%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'missile',
  },
  wMissileRate: {
    id: 'wMissileRate',
    name: '快速装填',
    description: '导弹射速 +30%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'missile',
  },
  // reflect
  wReflectBounce: {
    id: 'wReflectBounce',
    name: '多重反射',
    description: '反弹次数 +1',
    tag: '专属',
    maxStacks: 4,
    requiresWeapon: 'reflect',
  },
  wReflectDmg: {
    id: 'wReflectDmg',
    name: '聚焦光丝',
    description: '反射光线伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'reflect',
  },
  wReflectSpeed: {
    id: 'wReflectSpeed',
    name: '光速偏转',
    description: '弹速 +15%、射速 +10%',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'reflect',
  },
  // secondary buffs
  sOrbitDmg: {
    id: 'sOrbitDmg',
    name: '光轮研磨',
    description: '光轮伤害 +35%',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'orbit',
  },
  sOrbitCount: {
    id: 'sOrbitCount',
    name: '多环结构',
    description: '光轮数量 +1',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'orbit',
  },
  sOrbitSpeed: {
    id: 'sOrbitSpeed',
    name: '高速旋转',
    description: '光轮转速 +25%',
    tag: '副武强化',
    maxStacks: 2,
    requiresSecondary: 'orbit',
  },
  sMissileDmg: {
    id: 'sMissileDmg',
    name: '导弹强化',
    description: '导弹伤害 +30%',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'missilePod',
  },
  sMissileCount: {
    id: 'sMissileCount',
    name: '多联装',
    description: '每次齐射 +1 枚导弹',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'missilePod',
  },
  sMissileCd: {
    id: 'sMissileCd',
    name: '快速装填',
    description: '导弹冷却缩短',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'missilePod',
  },
  sNovaDmg: {
    id: 'sNovaDmg',
    name: '新星增幅',
    description: '新星伤害 +35%',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'nova',
  },
  sNovaRadius: {
    id: 'sNovaRadius',
    name: '扩散力场',
    description: '新星半径 +0.9',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'nova',
  },
  sNovaCd: {
    id: 'sNovaCd',
    name: '充能加速',
    description: '新星冷却缩短',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'nova',
  },
  sTurretDmg: {
    id: 'sTurretDmg',
    name: '炮塔校准',
    description: '炮塔伤害 +28%',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'turret',
  },
  sTurretRate: {
    id: 'sTurretRate',
    name: '速射机芯',
    description: '炮塔射速 +20%',
    tag: '副武强化',
    maxStacks: 3,
    requiresSecondary: 'turret',
  },
  sTurretRange: {
    id: 'sTurretRange',
    name: '远程索敌',
    description: '炮塔射程 +1.8',
    tag: '副武强化',
    maxStacks: 2,
    requiresSecondary: 'turret',
  },
};

function isSecondaryBuff(id: UpgradeId): boolean {
  return id.startsWith('s') && id.length > 1 && id[1] === id[1]?.toUpperCase();
}

function isWeaponBuff(id: UpgradeId): boolean {
  return id.startsWith('w') && id.length > 1 && id[1] === id[1]?.toUpperCase();
}

export function applyUpgrade(
  stats: PlayerStats,
  secondary: SecondaryStats,
  id: UpgradeId,
  counts: Map<UpgradeId, number>,
): { unlockedSecondary?: SecondaryId } {
  const def = UPGRADES[id];
  const next = (counts.get(id) ?? 0) + 1;
  counts.set(id, next);

  if (def.weapon) {
    stats.weapon = def.weapon;
    return {};
  }
  if (def.secondary) {
    return { unlockedSecondary: def.secondary };
  }

  if (isSecondaryBuff(id)) {
    applySecondaryBuff(secondary, id);
    return {};
  }

  if (isWeaponBuff(id)) {
    switch (id) {
      case 'wScatterPellets':
        stats.scatterPellets += 4;
        break;
      case 'wScatterDmg':
        stats.scatterDmg *= 1.35;
        break;
      case 'wScatterPierce':
        stats.scatterPierce += 1;
        break;
      case 'wLanceDmg':
        stats.lanceDmg *= 1.4;
        break;
      case 'wLanceWidth':
        stats.lanceWidth *= 1.28;
        break;
      case 'wLanceRate':
        stats.lanceRate *= 1.35;
        break;
      case 'wHomingTurn':
        stats.homingTurn *= 1.3;
        break;
      case 'wHomingSalvo':
        stats.homingSalvo += 2;
        break;
      case 'wHomingDmg':
        stats.homingDmg *= 1.35;
        break;
      case 'wBlackholeGravity':
        stats.blackholeGravity *= 1.4;
        break;
      case 'wBlackholeRadius':
        stats.blackholeRadius *= 1.25;
        break;
      case 'wBlackholeDps':
        stats.blackholeDps *= 1.35;
        break;
      case 'wMissileBoomDmg':
        stats.missileBoomDmg *= 1.35;
        break;
      case 'wMissileBoomRadius':
        stats.missileBoomRadius *= 1.3;
        break;
      case 'wMissileRate':
        stats.missileRate *= 1.3;
        break;
      case 'wReflectBounce':
        stats.reflectBounce += 1;
        break;
      case 'wReflectDmg':
        stats.reflectDmg *= 1.35;
        break;
      case 'wReflectSpeed':
        stats.bulletSpeedMult *= 1.15;
        stats.reflectSpeed *= 1.1;
        break;
      default:
        break;
    }
    return {};
  }

  switch (id) {
    case 'fireRate':
      stats.fireRateMult *= 1.12;
      break;
    case 'moveSpeed':
      stats.moveSpeedMult *= 1.08;
      break;
    case 'damage':
      stats.damageMult *= 1.15;
      break;
    case 'maxShield':
      stats.maxShieldBonus += 22;
      break;
    case 'shieldRegen':
      stats.shieldRegenPerSec += 1.2;
      break;
    case 'maxHealth':
      stats.maxHealthBonus += 18;
      break;
    case 'multishot':
      stats.multishotBonus += 1;
      break;
    case 'pierce':
      stats.pierceBonus += 1;
      break;
    case 'crit':
      stats.critChance += 0.08;
      break;
    case 'critDamage':
      stats.critDamageMult += 0.3;
      break;
    case 'dashCd':
      stats.dashCdMult *= 0.88;
      break;
    case 'bulletSpeed':
      stats.bulletSpeedMult *= 1.12;
      break;
    case 'magnet':
      stats.magnetRadius += 0.4;
      break;
    case 'shieldOnKill':
      stats.shieldOnKill += 4.5;
      break;
    case 'explosive':
      stats.explosive = true;
      break;
    case 'agility':
      stats.fireRateMult *= 1.05;
      stats.moveSpeedMult *= 1.04;
      break;
    default:
      break;
  }
  return {};
}

export function rollUpgradeChoices(
  rng: () => number,
  counts: Map<UpgradeId, number>,
  wave: number,
  ownedWeapon: WeaponId,
  ownedSecondaries: Set<string>,
  preferWeapons: boolean,
): UpgradeId[] {
  const pool: UpgradeId[] = [];
  for (const id of Object.keys(UPGRADES) as UpgradeId[]) {
    const def = UPGRADES[id];
    const stacks = counts.get(id) ?? 0;
    if (stacks >= def.maxStacks) continue;
    if (def.weapon && stacks > 0) continue;
    if (def.secondary && stacks > 0) continue;
    if (def.requiresWeapon && def.requiresWeapon !== ownedWeapon) continue;
    if (def.requiresSecondary && !ownedSecondaries.has(def.requiresSecondary)) continue;
    if (def.tag === '副武强化') {
      const need = def.requiresSecondary;
      if (!need || !ownedSecondaries.has(need)) continue;
    }
    if (def.tag === '专属') {
      const need = def.requiresWeapon;
      if (!need || need !== ownedWeapon) continue;
    }
    pool.push(id);
  }

  const weighted: UpgradeId[] = [];
  for (const id of pool) {
    const def = UPGRADES[id];
    let w = 1;
    if (def.weapon) w = preferWeapons ? 5 : 2;
    else if (def.secondary) w = 3;
    else if (def.requiresWeapon || def.requiresSecondary) w = 2.4;
    for (let i = 0; i < w; i++) weighted.push(id);
  }

  const result: UpgradeId[] = [];
  const used = new Set<UpgradeId>();
  let guard = 0;
  while (result.length < 3 && weighted.length > 0 && guard < 80) {
    guard += 1;
    const id = weighted[Math.floor(rng() * weighted.length) % weighted.length];
    if (used.has(id)) continue;
    used.add(id);
    result.push(id);
  }
  if (result.length === 0 && pool.length > 0) result.push(pool[0]);
  void wave;
  return result;
}
