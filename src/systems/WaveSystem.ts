import type { EnemyKind } from '../entities/Enemy';

export type WavePlan = {
  wave: number;
  spawns: { kind: EnemyKind; delay: number }[];
};

/** Multiplier applied to enemy HP/damage as waves climb. */
export function waveStatScale(wave: number): { hp: number; damage: number; count: number } {
  const hp = 1 + wave * 0.14 + Math.floor(wave / 10) * 0.35;
  const damage = 1 + wave * 0.055;
  const count = 1 + wave * 0.045;
  return { hp, damage, count };
}

export class WaveSystem {
  private wave = 0;
  private spawnQueue: { kind: EnemyKind; at: number }[] = [];
  private waveTimer = 0;
  private breakTimer = 2.2;
  private inBreak = true;

  get currentWave(): number {
    return this.wave;
  }

  get isBreak(): boolean {
    return this.inBreak;
  }

  get breakTimeLeft(): number {
    return this.inBreak ? Math.max(0, this.breakTimer) : 0;
  }

  get pendingSpawns(): number {
    return this.spawnQueue.length;
  }

  reset(): void {
    this.wave = 0;
    this.spawnQueue = [];
    this.waveTimer = 0;
    this.breakTimer = 2.2;
    this.inBreak = true;
  }

  requestNextWave(): void {
    this.wave += 1;
    this.inBreak = true;
    this.breakTimer = 2.4;
    this.spawnQueue = this.buildWave(this.wave);
  }

  startImmediately(): void {
    this.requestNextWave();
    this.breakTimer = 0.6;
  }

  update(delta: number, onSpawn: (kind: EnemyKind) => void): boolean {
    if (this.inBreak) {
      this.breakTimer -= delta;
      if (this.breakTimer <= 0) {
        this.inBreak = false;
        this.waveTimer = 0;
      }
      return false;
    }

    this.waveTimer += delta;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].at <= this.waveTimer) {
      const next = this.spawnQueue.shift()!;
      onSpawn(next.kind);
    }
    return this.spawnQueue.length === 0;
  }

  private buildWave(wave: number): { kind: EnemyKind; at: number }[] {
    const spawns: { kind: EnemyKind; at: number }[] = [];
    const isBoss = wave % 5 === 0;
    const s = waveStatScale(wave);

    // Density grows faster in the mid/late game so wave 40 is not a free ride
    const pressure = 1 + Math.pow(wave, 0.92) * 0.085;
    const droneCount = Math.floor((3 + wave * 0.7) * s.count * pressure * 0.55);
    const swarmCount = wave >= 2 ? Math.floor((5 + wave * 0.85) * s.count * pressure * 0.5) : 0;
    const strikerCount = wave >= 2 ? Math.floor((1 + wave * 0.42) * s.count) : 0;
    const tankCount = wave >= 3 ? Math.floor((wave * 0.32) * s.count) : 0;
    const sniperCount = wave >= 4 ? Math.floor((1 + wave * 0.28) * s.count) : 0;
    const splitterCount = wave >= 3 ? Math.floor((wave * 0.3) * s.count) : 0;
    const bomberCount = wave >= 4 ? Math.floor((1 + wave * 0.34) * s.count) : 0;

    let t = 0;
    if (isBoss) {
      // extra bosses late
      const bosses = 1 + Math.floor(wave / 15);
      for (let b = 0; b < bosses; b++) {
        spawns.push({ kind: 'boss', at: 0.15 + b * 1.2 });
      }
      t = 1.0 + bosses * 0.6;
    }
    for (let i = 0; i < droneCount; i++) {
      spawns.push({ kind: 'drone', at: t });
      t += Math.max(0.08, 0.42 - wave * 0.01);
    }
    for (let i = 0; i < swarmCount; i++) {
      spawns.push({ kind: 'swarm', at: t });
      t += Math.max(0.05, 0.2 - wave * 0.004);
    }
    for (let i = 0; i < strikerCount; i++) {
      spawns.push({ kind: 'striker', at: t });
      t += 0.24;
    }
    for (let i = 0; i < splitterCount; i++) {
      spawns.push({ kind: 'splitter', at: t });
      t += 0.3;
    }
    for (let i = 0; i < tankCount; i++) {
      spawns.push({ kind: 'tank', at: t });
      t += 0.38;
    }
    for (let i = 0; i < sniperCount; i++) {
      spawns.push({ kind: 'sniper', at: t });
      t += 0.32;
    }
    for (let i = 0; i < bomberCount; i++) {
      spawns.push({ kind: 'bomber', at: t });
      t += 0.26;
    }
    return spawns;
  }
}
