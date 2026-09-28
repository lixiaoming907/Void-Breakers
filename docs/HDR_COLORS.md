# HDR / 发光颜色一览（可自行调整）

所有 glow / emissive 颜色集中在 `src/game/palette.ts`（`HDR` 对象）。
改这一处即可全局生效。左下角 HUD 进度条颜色在 `src/styles.css` 末尾。

## 拾取物
| 效果 | 颜色 | 变量 |
|------|------|------|
| 装甲 | 红 `#ff3b4e` | `HDR.pickupHealth` |
| 护盾 | 蓝 `#3aa0ff` | `HDR.pickupShield` |
| 急速 | 紫 `#b44dff` | `HDR.pickupRapid` |
| 分数 | 绿 `#2dff88` | `HDR.pickupScore` |

发光强度：`HDR.pickupEmissive`（默认 1.15）× 各色补偿系数 `HDR.pickupEmissiveMul`
（绿天然更亮，红/蓝/紫补偿 1.2–1.35）。

## 玩家
| 部位 | 颜色 | 变量 |
|------|------|------|
| 机身 | `#00c8e0` | `playerBody` / `playerBodyEmissive` |
| 装饰 | `#fee440` | `playerAccent` |
| 座舱 | `#7ad0e8` | `playerCanopy` |
| 推进焰 | `#5ad0e8` | `playerThruster` |
| 护盾壳 | `#7ec8e8` | `shieldShell` |

## 子弹
| 类型 | 颜色 | 变量 |
|------|------|------|
| 玩家弹 | `#7df9ff` | `bulletPlayer` |
| 暴击 | `#fee440` | `bulletCrit` |
| 敌弹 | `#ff6b9d` | `bulletEnemy` |
| 飞弹 | `#f15bb5` | `bulletMissile` |
| 等离子 | `#00f5d4` | `bulletPlasma` |
| 光束 | `#9ef9ff` | `bulletLaser` |
| 碎片 | `#c77dff` | `bulletFrag` |

## 敌人发光
| 类型 | emissive | 变量 |
|------|----------|------|
| 热色机体 | `#ff2244` | `enemyHotEmissive` |
| 紫色远程 | `#c44dff` | `enemyVioletEmissive` |
| 琥珀重装 | `#ff7a00` | `enemyAmberEmissive` |
| Boss | `#ff2e88` | `enemyBossEmissive` |
| 尖刺 | `#ff4d6d` | `enemySpikeEmissive` |

## 特效 / 环境
| 效果 | 颜色 | 变量 |
|------|------|------|
| 冲击波 | `#7df9ff` | `fxShock` |
| 爆炸 | `#ff4d6d` | `fxExplosion` |
| 新星 | `#00f5d4` | `fxNova` |
| 环境霓虹 | `#1de0ff` | `arenaNeonCyan` |

## 如何调
1. 打开 `src/game/palette.ts`
2. 改 `#RRGGBB`
3. `npm run build` 后重新打包单文件

若某色仍偏暗：提高 `pickupEmissiveMul` 或对应 `*Intensity`。
