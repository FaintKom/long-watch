import { describe, test, expect } from 'vitest';
import { computeWitnesses } from '../src/witnesses';

function mockCast(id: string, x: number, y: number, z: number, facingY = 0) {
  return {
    def: { id, displayName: id },
    isDead: false,
    body: { position: { x, y, z } },
    group: { rotation: { y: facingY } },
  } as unknown as import('../src/cast').CastMember;
}

const openWorld = { isOpaque: () => false };
const openRaycast = () => true;

describe('computeWitnesses', () => {
  test('includes a nearby NPC facing the event', () => {
    const cast = [mockCast('matriarch', 0, 1.5, 0, 0)]; // facing +z
    const witnesses = computeWitnesses(cast, {
      pos: { x: 0, y: 1.5, z: 3 },
      world: openWorld,
      raycast: openRaycast,
    });
    expect(witnesses).toContain('matriarch');
  });

  test('coneAware=false picks up sound from behind', () => {
    const cast = [mockCast('matriarch', 0, 1.5, 0, Math.PI)];
    const witnesses = computeWitnesses(cast, {
      pos: { x: 0, y: 1.5, z: 6 },
      world: openWorld,
      raycast: openRaycast,
      coneAware: false,
    });
    expect(witnesses).toContain('matriarch');
  });

  test('alwaysIncludes adds the victim even out of sight', () => {
    const cast = [mockCast('butler', 100, 1.5, 100, 0)];
    const witnesses = computeWitnesses(cast, {
      pos: { x: 0, y: 1.5, z: 0 },
      world: openWorld,
      raycast: openRaycast,
      alwaysIncludes: ['butler'],
    });
    expect(witnesses).toContain('butler');
  });

  test('range gate excludes far NPCs', () => {
    const cast = [mockCast('far', 50, 1.5, 50)];
    const witnesses = computeWitnesses(cast, {
      pos: { x: 0, y: 1.5, z: 0 },
      world: openWorld,
      raycast: openRaycast,
      range: 12,
    });
    expect(witnesses).not.toContain('far');
  });

  test('blocking raycast excludes NPC even when in cone', () => {
    const cast = [mockCast('hidden', 0, 1.5, 0, 0)];
    const witnesses = computeWitnesses(cast, {
      pos: { x: 0, y: 1.5, z: 3 },
      world: openWorld,
      raycast: () => false,
    });
    expect(witnesses).not.toContain('hidden');
  });
});
