import type { EnemyKind } from '../entities/Enemy';

export type WavePlan = {
  wave: number;
  spawns: { kind: EnemyKind; delay: number }[];
};

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

    const droneCount = 3 + Math.floor(wave * 0.7);
    const swarmCount = wave >= 2 ? 4 + Math.floor(wave * 0.6) : 0;
    const strikerCount = wave >= 2 ? 1 + Math.floor((wave - 1) * 0.4) : 0;
    const tankCount = wave >= 3 ? Math.floor((wave - 1) * 0.3) : 0;
    const sniperCount = wave >= 4 ? 1 + Math.floor((wave - 3) * 0.25) : 0;
    const splitterCount = wave >= 3 ? Math.floor((wave - 2) * 0.28) : 0;
    const bomberCount = wave >= 4 ? 1 + Math.floor((wave - 3) * 0.3) : 0;

    let t = 0;
    if (isBoss) {
      spawns.push({ kind: 'boss', at: 0.15 });
      t = 1.0;
    }
    for (let i = 0; i < droneCount; i++) {
      spawns.push({ kind: 'drone', at: t });
      t += Math.max(0.12, 0.42 - wave * 0.012);
    }
    for (let i = 0; i < swarmCount; i++) {
      spawns.push({ kind: 'swarm', at: t });
      t += Math.max(0.08, 0.22 - wave * 0.006);
    }
    for (let i = 0; i < strikerCount; i++) {
      spawns.push({ kind: 'striker', at: t });
      t += 0.28;
    }
    for (let i = 0; i < splitterCount; i++) {
      spawns.push({ kind: 'splitter', at: t });
      t += 0.35;
    }
    for (let i = 0; i < tankCount; i++) {
      spawns.push({ kind: 'tank', at: t });
      t += 0.45;
    }
    for (let i = 0; i < sniperCount; i++) {
      spawns.push({ kind: 'sniper', at: t });
      t += 0.4;
    }
    for (let i = 0; i < bomberCount; i++) {
      spawns.push({ kind: 'bomber', at: t });
      t += 0.3;
    }
    return spawns;
  }
}
