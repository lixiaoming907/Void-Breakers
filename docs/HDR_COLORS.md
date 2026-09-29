# HDR / 发光颜色一览（可自行调整）

## 主武器颜色与形态（`src/entities/Bullet.ts` 材质，也可在 `src/game/palette.ts` 记录）
| 武器 | 颜色 | 形态 | 机制 |
|------|------|------|------|
| 散弹 | `#7df9ff` 浅蓝 | 小弹丸 | 量大扇形 |
| 光矛 | `#4db8ff` 亮蓝 | 瞬间长光线 | 高穿透高伤，无飞行 |
| 追踪 | `#c77dff` 紫 | 锥形弹 | 慢速强追踪 |
| 黑洞 | `#b44dff` 深紫 | 球体 | 引力吸引 + 持续伤害 |
| 导弹 | `#ff8c42` 橙 | 导弹体 | 爆炸范围伤害 |
| 反射光线 | `#2dff88` 亮绿 | 短光线 | 命中弹向下一目标 |

## 拾取物（`src/game/palette.ts` → `HDR`）
| 效果 | 颜色 | 变量 |
|------|------|------|
| 装甲 | 红 `#ff3b4e` | `pickupHealth` |
| 护盾 | 蓝 `#3aa0ff` | `pickupShield` |
| 急速 | 紫 `#b44dff` | `pickupRapid` |
| 分数 | 绿 `#2dff88` | `pickupScore` |

强度：`HDR.pickupEmissive` × `HDR.pickupEmissiveMul`

## 玩家 / 敌人 / 环境
见 `src/game/palette.ts` 的 `playerBody`、`enemyHotEmissive`、`arenaNeonCyan` 等字段。

## 如何改
1. 打开 `src/game/palette.ts` 改 `#RRGGBB` / `*Intensity`
2. 武器材质在 `src/entities/Bullet.ts` 构造函数（matLance / matBlackhole…）
3. 左下 HUD 条颜色：`src/styles.css` 末尾 `.bar-fill.*`
4. `npm run build` → `node scripts/bundle-single-file.mjs`
