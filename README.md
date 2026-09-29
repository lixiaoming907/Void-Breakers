# 虚空破阵 VOIDBREAKERS

霓虹虚空竞技场弹幕肉鸽射击游戏（Three.js + Vite）。

**故事背景**：[docs/LORE.md](docs/LORE.md) — 虚空裂变、破阵场与蜂群编制。

## 运行

```bash
npm install
npm run dev        # 开发
npm run build      # 生产构建
npm run preview    # 预览 dist
```

也可直接打开仓库根目录旁的单文件版 `虚空破阵-VOIDBREAKERS.html`。

## 操作

| 按键 | 作用 |
| --- | --- |
| WASD / 方向键 | 移动 |
| 鼠标 | 瞄准 |
| 左键 / J | 射击 |
| Shift / 右键 | 冲刺 |
| 1 / 2 / 3 | 升级选择 |
| Esc / P | 暂停 |
| Enter | 开始 / 重开 |

## 系统

- 波次生存：蜂群 / 追击 / 射击 / 重装 / 狙击 / 分裂 / 自爆 / Boss
- 六种主武器 + 武器专属强化
- 四种副武器：光轮、导弹舱、脉冲新星、自动炮塔
- 波次结束三选一肉鸽升级
- 薄护盾特效、赛博朋克 Bloom

## 技术

- Three.js r184 + UnrealBloomPass
- Vite 8 + TypeScript
- 程序化音效（Web Audio）
