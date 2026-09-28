export type WeaponId =
  | 'pulse'
  | 'scatter'
  | 'homing'
  | 'plasma'
  | 'railgun'
  | 'flak';

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
  | 'wPulseRate'
  | 'wPulseDouble'
  | 'wPulseDmg'
  | 'wScatterPellets'
  | 'wScatterClose'
  | 'wScatterPierce'
  | 'wHomingTurn'
  | 'wHomingSalvo'
  | 'wHomingFuel'
  | 'wPlasmaBoom'
  | 'wPlasmaDmg'
  | 'wPlasmaChain'
  | 'wRailRate'
  | 'wRailPierce'
  | 'wRailDmg'
  | 'wFlakCluster'
  | 'wFlakFragDmg'
  | 'wFlakLife'
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
  /** only offered when player owns this weapon */
  requiresWeapon?: WeaponId;
  /** only offered when player owns this secondary */
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
  // weapon-specific (persist across weapon swaps as global modifiers on matching weapon)
  pulseRate: number;
  pulseExtra: number;
  pulseDmg: number;
  scatterPellets: number;
  scatterClose: number;
  scatterPierce: number;
  homingTurn: number;
  homingSalvo: number;
  homingDmg: number;
  plasmaRadius: number;
  plasmaDmg: number;
  plasmaChain: number;
  railRate: number;
  railPierce: number;
  railDmg: number;
  flakCluster: number;
  flakDmg: number;
  flakLife: number;
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
    // stronger early-game secondaries
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

export const WEAPON_FIRE_RATE: Record<WeaponId, number> = {
  pulse: 1,
  scatter: 0.82,
  homing: 0.7,
  plasma: 0.55,
  railgun: 0.45,
  flak: 0.78,
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
    weapon: 'pulse',
    pulseRate: 1,
    pulseExtra: 0,
    pulseDmg: 1,
    scatterPellets: 0,
    scatterClose: 1,
    scatterPierce: 0,
    homingTurn: 1,
    homingSalvo: 0,
    homingDmg: 1,
    plasmaRadius: 1,
    plasmaDmg: 1,
    plasmaChain: 0,
    railRate: 1,
    railPierce: 0,
    railDmg: 1,
    flakCluster: 0,
    flakDmg: 1,
    flakLife: 1,
  };
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  pulse: {
    id: 'pulse',
    name: '脉冲步枪',
    description: '高射速标准弹幕，稳定输出。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'pulse',
  },
  scatter: {
    id: 'scatter',
    name: '散射霰弹',
    description: '一次喷射多发弹丸，近距爆发极高。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'scatter',
  },
  homing: {
    id: 'homing',
    name: '追猎飞弹',
    description: '自动追踪敌人的慢速飞弹。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'homing',
  },
  plasma: {
    id: 'plasma',
    name: '等离子炮',
    description: '重型能量球，命中产生范围爆炸。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'plasma',
  },
  railgun: {
    id: 'railgun',
    name: '磁轨炮',
    description: '低射速高伤害，子弹贯穿多个敌人。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'railgun',
  },
  flak: {
    id: 'flak',
    name: '高射炮',
    description: '弹丸命中或到时分裂成碎片。',
    tag: '武器',
    maxStacks: 1,
    weapon: 'flak',
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
    description: '每秒回复 2.2 点护盾。',
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
  // ---- weapon-specific (appear only if that weapon is equipped) ----
  wPulseRate: {
    id: 'wPulseRate',
    name: '脉冲超频',
    description: '脉冲武器射速 +30%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'pulse',
  },
  wPulseDouble: {
    id: 'wPulseDouble',
    name: '双联脉冲',
    description: '脉冲额外 +2 发弹丸',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'pulse',
  },
  wPulseDmg: {
    id: 'wPulseDmg',
    name: '过载弹芯',
    description: '脉冲伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'pulse',
  },
  wScatterPellets: {
    id: 'wScatterPellets',
    name: '扩散喷口',
    description: '霰弹 +3 弹丸',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'scatter',
  },
  wScatterClose: {
    id: 'wScatterClose',
    name: '近距处决',
    description: '霰弹伤害 +40%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'scatter',
  },
  wScatterPierce: {
    id: 'wScatterPierce',
    name: '灼热弹丸',
    description: '霰弹穿透 +1',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'scatter',
  },
  wHomingTurn: {
    id: 'wHomingTurn',
    name: '锁定矩阵',
    description: '飞弹转向更强、弹速 +15%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'homing',
  },
  wHomingSalvo: {
    id: 'wHomingSalvo',
    name: '齐射协议',
    description: '飞弹额外 +2 枚',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'homing',
  },
  wHomingFuel: {
    id: 'wHomingFuel',
    name: '燃料推进',
    description: '飞弹伤害 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'homing',
  },
  wPlasmaBoom: {
    id: 'wPlasmaBoom',
    name: '聚变核心',
    description: '等离子爆炸范围 +35%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'plasma',
  },
  wPlasmaDmg: {
    id: 'wPlasmaDmg',
    name: '过热球体',
    description: '等离子伤害 +30%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'plasma',
  },
  wPlasmaChain: {
    id: 'wPlasmaChain',
    name: '连锁爆轰',
    description: '爆炸伤害 +25%，范围再 +15%',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'plasma',
  },
  wRailRate: {
    id: 'wRailRate',
    name: '超导线圈',
    description: '磁轨射速 +45%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'railgun',
  },
  wRailPierce: {
    id: 'wRailPierce',
    name: '贯穿强化',
    description: '磁轨穿透 +2',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'railgun',
  },
  wRailDmg: {
    id: 'wRailDmg',
    name: '电磁加速',
    description: '磁轨伤害 +40%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'railgun',
  },
  wFlakCluster: {
    id: 'wFlakCluster',
    name: '集束弹',
    description: '高射碎片 +2',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'flak',
  },
  wFlakFragDmg: {
    id: 'wFlakFragDmg',
    name: '碎片风暴',
    description: '碎片伤害 +50%',
    tag: '专属',
    maxStacks: 3,
    requiresWeapon: 'flak',
  },
  wFlakLife: {
    id: 'wFlakLife',
    name: '延时引信',
    description: '弹丸寿命 +40%、伤害 +15%',
    tag: '专属',
    maxStacks: 2,
    requiresWeapon: 'flak',
  },
  // ---- secondary buffs ----
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

export type UpgradeChoice = {
  id: UpgradeId;
  stacks: number;
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
    // unlock handled by caller; mark counts
    return { unlockedSecondary: def.secondary };
  }

  if (isSecondaryBuff(id)) {
    applySecondaryBuff(secondary, id);
    return {};
  }

  if (isWeaponBuff(id)) {
    switch (id) {
      case 'wPulseRate':
        stats.pulseRate *= 1.3;
        break;
      case 'wPulseDouble':
        stats.pulseExtra += 2;
        break;
      case 'wPulseDmg':
        stats.pulseDmg *= 1.35;
        break;
      case 'wScatterPellets':
        stats.scatterPellets += 3;
        break;
      case 'wScatterClose':
        stats.scatterClose *= 1.4;
        break;
      case 'wScatterPierce':
        stats.scatterPierce += 1;
        break;
      case 'wHomingTurn':
        stats.homingTurn *= 1.15;
        stats.bulletSpeedMult *= 1.05;
        break;
      case 'wHomingSalvo':
        stats.homingSalvo += 2;
        break;
      case 'wHomingFuel':
        stats.homingDmg *= 1.35;
        break;
      case 'wPlasmaBoom':
        stats.plasmaRadius *= 1.35;
        break;
      case 'wPlasmaDmg':
        stats.plasmaDmg *= 1.3;
        break;
      case 'wPlasmaChain':
        stats.plasmaDmg *= 1.25;
        stats.plasmaRadius *= 1.15;
        break;
      case 'wRailRate':
        stats.railRate *= 1.45;
        break;
      case 'wRailPierce':
        stats.railPierce += 2;
        break;
      case 'wRailDmg':
        stats.railDmg *= 1.4;
        break;
      case 'wFlakCluster':
        stats.flakCluster += 2;
        break;
      case 'wFlakFragDmg':
        stats.flakDmg *= 1.5;
        break;
      case 'wFlakLife':
        stats.flakLife *= 1.4;
        stats.flakDmg *= 1.15;
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
      stats.shieldRegenPerSec += 2.2;
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
    // weapon-specific buffs only when that weapon is equipped
    if (def.requiresWeapon && def.requiresWeapon !== ownedWeapon) continue;
    // secondary buffs ONLY after the matching secondary is unlocked
    if (def.requiresSecondary && !ownedSecondaries.has(def.requiresSecondary)) continue;
    // belt-and-suspenders: any 副武强化 / 专属 card without a matching owner is dropped
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
