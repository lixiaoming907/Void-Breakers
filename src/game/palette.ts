/**
 * Central HDR / emissive palette — edit HERE to restyle glow colors.
 *
 * Tip: green (#2dff88) reads much brighter than blue/purple/red at the same
 * emissiveIntensity. Raise `emissive` on those rows if they look dim.
 */

export const HDR = {
  // —— 拾取物掉落 ——
  pickupHealth: '#ff3b4e', // 装甲 · 红
  pickupShield: '#3aa0ff', // 护盾 · 蓝
  pickupRapid: '#b44dff', // 急速 · 紫
  pickupScore: '#2dff88', // 分数 · 绿
  pickupEmissive: 1.15, // 统一强度（可按色微调下方 multipliers）

  // 按色彩感知补偿（绿天然更亮）
  pickupEmissiveMul: {
    health: 2.0,
    shield: 1.25,
    rapid: 3.0,
    score: 0.5,
  } as const,

  // —— 玩家 ——
  playerBody: '#00c8e0',
  playerBodyEmissive: '#00e5ff',
  playerBodyEmissiveIntensity: 0.85,
  playerAccent: '#fee440',
  playerAccentEmissive: '#ffd24a',
  playerAccentEmissiveIntensity: 0.75,
  playerCanopy: '#7ad0e8',
  playerCanopyEmissive: '#2088a8',
  playerCanopyEmissiveIntensity: 0.55,
  playerThruster: '#5ad0e8',
  playerTrail: '#00c8e0',

  // —— 护盾 ——
  shieldShell: '#7ec8e8',
  shieldRing: '#9ad8f0',

  // —— 子弹 ——
  bulletPlayer: '#7df9ff',
  bulletPlayerGlow: '#00c8e0',
  bulletCrit: '#fee440',
  bulletEnemy: '#ff6b9d',
  bulletEnemyGlow: '#ff4d6d',
  bulletMissile: '#f15bb5',
  bulletPlasma: '#00f5d4',
  bulletPlasmaGlow: '#00f5d4',
  bulletLaser: '#9ef9ff',
  bulletFrag: '#c77dff',

  // —— 敌人 ——
  enemyHotEmissive: '#ff2244',
  enemyHotIntensity: 1.35,
  enemyVioletEmissive: '#c44dff',
  enemyVioletIntensity: 1.25,
  enemyAmberEmissive: '#ff7a00',
  enemyAmberIntensity: 1.15,
  enemyBossEmissive: '#ff2e88',
  enemyBossIntensity: 1.35,
  enemySpikeEmissive: '#ff4d6d',
  enemySpikeIntensity: 1.5,
  enemyRing: '#ff2e88',
  enemyCore: '#ffffff',

  // —— 特效 ——
  fxSpark: '#ffffff',
  fxShock: '#7df9ff',
  fxExplosion: '#ff4d6d',
  fxNova: '#00f5d4',
  fxCrit: '#fee440',
  fxHeal: '#ff3b4e',
  fxShield: '#3aa0ff',

  // —— 环境霓虹 ——
  arenaNeonCyan: '#1de0ff',
  arenaNeonMagenta: '#f15bb5',
  arenaTrimEmissive: '#1de0ff',
  arenaTrimIntensity: 0.7,

  // —— 副武器 ——
  orbitBlade: '#7df9ff',
  turretEmissive: '#1de0ff',
  turretIntensity: 0.95,
  novaRing: '#00f5d4',
} as const;

export type HdrKey = keyof typeof HDR;
