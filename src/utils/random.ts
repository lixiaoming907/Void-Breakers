export type SeededRandom = () => number;

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng: SeededRandom, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pick<T>(rng: SeededRandom, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}
