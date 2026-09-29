# 音效文件位置（可直接替换同名 WAV）

目录：`voidbreakers/public/audio/`  
构建后会拷到 `dist/audio/`。替换同名 `.wav` 即可（22kHz 单声道即可，其他采样率也行）。

| 文件 | 用途 |
|------|------|
| `shoot_scatter.wav` | 散弹开火 |
| `shoot_lance.wav` | 光矛 |
| `shoot_homing.wav` | 追踪飞弹 |
| `shoot_blackhole.wav` | 黑洞炮 |
| `shoot_missile.wav` | 导弹 |
| `shoot_reflect.wav` | 反射光线 |
| `hit.wav` | 命中 |
| `hit_soft.wav` | 轻命中 |
| `explode.wav` | 爆炸 |
| `explode_big.wav` | Boss/大爆炸 |
| `orbit.wav` | 光轮 |
| `secondary_missile.wav` | 导弹舱 |
| `nova.wav` | 脉冲新星 |
| `turret.wav` | 炮塔 |
| `pickup.wav` | 拾取 |
| `hurt.wav` | 受伤 |
| `dash.wav` | 冲刺 |
| `wave.wav` | 波次开始 |
| `gameover.wav` | 失败 |
| `shield_break.wav` | 护盾破裂 |

代码入口：`src/systems/AudioSystem.ts`（优先播文件，找不到则用程序音兜底）。

重新生成默认音效：`python scripts/gen-audio.py`

**注意**：单文件 `release/Void-Breakers.html` 无法加载外部 wav，会退回程序音；请用 `npm run preview` 或 GitHub 上的完整项目听替换后的声音。
