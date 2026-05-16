import { describe, test, expect, beforeEach } from 'vitest';
import { Navigator, setNavWorld, registerPortal, clearPortals, portalCount } from '../src/nav';

const openWorld = { isSolid: () => false };

beforeEach(() => {
  setNavWorld(openWorld);
  clearPortals();
});

describe('Navigator single-floor', () => {
  test('returns a unit vector toward target on same floor', () => {
    const n = new Navigator();
    const v = n.steerToward({ x: 0, y: 1.5, z: 0 }, { x: 5, y: 1.5, z: 0 });
    expect(v).not.toBeNull();
    const m = Math.sqrt(v!.dx * v!.dx + v!.dz * v!.dz);
    expect(m).toBeGreaterThan(0.5);
    expect(v!.dx).toBeGreaterThan(0);
  });

  test('returns null cross-floor when no portals registered', () => {
    const n = new Navigator();
    const v = n.steerToward({ x: 0, y: 1.5, z: 0 }, { x: 5, y: 6.5, z: 0 });
    expect(v).toBeNull();
  });
});

describe('Navigator multi-floor via portals (Iter 59)', () => {
  test('registerPortal increases portal count', () => {
    expect(portalCount()).toBe(0);
    registerPortal({ x: 17, y: 1.5, z: 11 }, { x: 17, y: 6.5, z: 7 });
    expect(portalCount()).toBe(1);
  });

  test('cross-floor steering routes toward portal endpoint on entity floor', () => {
    registerPortal({ x: 17, y: 1.5, z: 11 }, { x: 17, y: 6.5, z: 7 });
    const n = new Navigator();
    const v = n.steerToward({ x: 0, y: 1.5, z: 0 }, { x: 20, y: 6.5, z: 8 });
    expect(v).not.toBeNull();
    expect(v!.dx).toBeGreaterThan(0);
    expect(v!.dz).toBeGreaterThan(0);
  });

  test('clearPortals empties the registry', () => {
    registerPortal({ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: 0 });
    registerPortal({ x: 10, y: 0, z: 0 }, { x: 10, y: 5, z: 0 });
    expect(portalCount()).toBe(2);
    clearPortals();
    expect(portalCount()).toBe(0);
  });

  test('nearestPortal picks the closer of two', () => {
    registerPortal({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 6.5, z: 0 });
    registerPortal({ x: 40, y: 1.5, z: 25 }, { x: 40, y: 6.5, z: 27 });
    const n = new Navigator();
    const v = n.steerToward({ x: 35, y: 1.5, z: 24 }, { x: 30, y: 6.5, z: 22 });
    expect(v).not.toBeNull();
    expect(v!.dx).toBeGreaterThan(0);
  });
});
