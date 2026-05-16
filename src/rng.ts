/**
 * Seeded random number generator for deterministic plot rolls and dungeon gen.
 *
 * `getSeed()` returns the currently active seed string.
 * `setSeed(seed)` swaps the seeded RNG. Defaults to a fresh seed from the URL
 * `?seed=` query param, or a timestamp-based fallback.
 *
 * `random()` is a drop-in replacement for Math.random() but driven by the seed.
 * Callers in plot.ts and dungenGen.ts use this so a saved seed reproduces the
 * same plot rolls + same catacombs layout exactly.
 *
 * Existing call sites that use `Math.random()` are unaffected; only modules
 * that opt in via `import { random } from './rng'` are seeded.
 */
import seedrandom from 'seedrandom';

function defaultSeed(): string {
  if (typeof window !== 'undefined' && window.location) {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get('seed');
    if (fromQuery) return fromQuery;
  }
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffff).toString(36)}`;
}

let _seed: string = defaultSeed();
let _rng: () => number = seedrandom(_seed);

export function getSeed(): string { return _seed; }
export function setSeed(seed: string): void { _seed = seed; _rng = seedrandom(seed); }

/** Drop-in replacement for Math.random(). Deterministic given a seed. */
export function random(): number { return _rng(); }

/** Integer in [0, n). */
export function randInt(n: number): number { return Math.floor(_rng() * n); }

/** Inclusive die roll: roll(20) -> 1..20. */
export function roll(sides: number): number { return 1 + Math.floor(_rng() * sides); }
