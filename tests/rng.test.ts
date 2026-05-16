import { describe, test, expect } from 'vitest';
import { setSeed, random, roll, randInt, getSeed } from '../src/rng';

describe('rng', () => {
  test('setSeed yields a deterministic stream', () => {
    setSeed('determinism-check');
    const a = [random(), random(), random(), random()];
    setSeed('determinism-check');
    const b = [random(), random(), random(), random()];
    expect(a).toEqual(b);
  });

  test('different seeds produce different streams', () => {
    setSeed('seed-A');
    const a = random();
    setSeed('seed-B');
    const b = random();
    expect(a).not.toBe(b);
  });

  test('roll(20) stays in 1..20', () => {
    setSeed('roll-bounds');
    for (let i = 0; i < 500; i++) {
      const r = roll(20);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(20);
    }
  });

  test('randInt(n) stays in [0, n)', () => {
    setSeed('randint-bounds');
    for (let i = 0; i < 500; i++) {
      const r = randInt(10);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(10);
    }
  });

  test('getSeed returns the current seed', () => {
    setSeed('hello');
    expect(getSeed()).toBe('hello');
  });
});
