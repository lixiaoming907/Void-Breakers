/**
 * Uniform grid for cheap neighbor queries (explosions, orbit hits).
 * Far cheaper than nested loops and enough of an "ECS spatial system"
 * without rewriting the whole game to entity-component architecture.
 */
export class SpatialHash {
  private readonly cellSize: number;
  private readonly cells = new Map<number, number[]>();

  constructor(cellSize = 3) {
    this.cellSize = cellSize;
  }

  private key(x: number, z: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    // pack into one int
    return cx * 73856093 ^ (cz * 19349663);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(index: number, x: number, z: number): void {
    const k = this.key(x, z);
    let list = this.cells.get(k);
    if (!list) {
      list = [];
      this.cells.set(k, list);
    }
    list.push(index);
  }

  /** Collect indices within `radius` of (x,z). `out` is reused. */
  query(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCz = Math.floor((z - radius) / this.cellSize);
    const maxCz = Math.floor((z + radius) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const k = cx * 73856093 ^ (cz * 19349663);
        const list = this.cells.get(k);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) out.push(list[i]);
      }
    }
    return out;
  }
}

/** Throttle bursty VFX/damage so explosive spam cannot stall a frame. */
export class FrameBudget {
  private used = 0;
  constructor(private readonly limit: number) {}
  reset(): void {
    this.used = 0;
  }
  trySpend(cost = 1): boolean {
    if (this.used + cost > this.limit) return false;
    this.used += cost;
    return true;
  }
}
