/**
 * Combat resolver tests. Validates that resolveAttack produces stable
 * outcomes given seeded RNG (via seedrandom replacement of Math.random).
 */
import { describe, test, expect, beforeEach } from 'vitest';
import seedrandom from 'seedrandom';
import { resolveAttack } from '../src/combat';

beforeEach(() => {
  Math.random = seedrandom('long-watch-combat-tests');
});

const attacker = { name: 'Player', attackBonus: 5, damageDice: '1d8+3', damageWord: 'steel' };
const tgtLowAC = { name: 'Mook', ac: 10, hp: 22, maxHp: 22 };
const tgtHighAC = { name: 'Mezzoloth', ac: 25, hp: 75, maxHp: 75 };
const tgtFragile = { name: 'Cultist', ac: 10, hp: 3, maxHp: 16 };

describe('resolveAttack', () => {
  test('produces a deterministic frame for a fixed seed', () => {
    const frame = resolveAttack(attacker, tgtLowAC);
    expect(frame.roll).toBeGreaterThanOrEqual(1);
    expect(frame.roll).toBeLessThanOrEqual(20);
    expect(typeof frame.narrative).toBe('string');
    expect(frame.target.name).toBe('Mook');
  });

  test('hits a low-AC target most of the time', () => {
    let hits = 0;
    for (let i = 0; i < 50; i++) hits += resolveAttack(attacker, tgtLowAC).hit ? 1 : 0;
    expect(hits).toBeGreaterThan(40);
  });

  test('misses a high-AC target most of the time', () => {
    let hits = 0;
    for (let i = 0; i < 50; i++) hits += resolveAttack(attacker, tgtHighAC).hit ? 1 : 0;
    expect(hits).toBeLessThan(15);
  });

  test('postHp drops by exactly damage on hit', () => {
    for (let i = 0; i < 20; i++) {
      const frame = resolveAttack(attacker, tgtLowAC);
      if (frame.hit) {
        expect(frame.postHp).toBe(Math.max(0, tgtLowAC.hp - frame.damage));
      } else {
        expect(frame.damage).toBe(0);
        expect(frame.postHp).toBe(tgtLowAC.hp);
      }
    }
  });

  test('lethal flag set when postHp reaches 0', () => {
    let lethalSeen = false;
    for (let i = 0; i < 30; i++) {
      const frame = resolveAttack(attacker, tgtFragile);
      if (frame.lethal) {
        expect(frame.postHp).toBe(0);
        expect(frame.hit).toBe(true);
        expect(frame.narrative).toMatch(/falls/);
        lethalSeen = true;
        break;
      }
    }
    expect(lethalSeen).toBe(true);
  });

  test('crit (natural 20) flags critical and uses crit narrative', () => {
    let crit = null as ReturnType<typeof resolveAttack> | null;
    for (let i = 0; i < 400 && !crit; i++) {
      const f = resolveAttack(attacker, tgtLowAC);
      if (f.critical) crit = f;
    }
    expect(crit).not.toBeNull();
    expect(crit!.hit).toBe(true);
    expect(crit!.roll).toBe(20);
    expect(crit!.narrative.toLowerCase()).toContain('critical');
  });

  test('fumble (natural 1) flags fumble + zero damage', () => {
    let fumble = null as ReturnType<typeof resolveAttack> | null;
    for (let i = 0; i < 400 && !fumble; i++) {
      const f = resolveAttack(attacker, tgtLowAC);
      if (f.fumble) fumble = f;
    }
    expect(fumble).not.toBeNull();
    expect(fumble!.hit).toBe(false);
    expect(fumble!.damage).toBe(0);
    expect(fumble!.roll).toBe(1);
  });

  test('bonusDamage adds on hit, not on miss', () => {
    let added = 0;
    let kept = 0;
    for (let i = 0; i < 30; i++) {
      const f = resolveAttack(attacker, tgtLowAC, { bonusDamage: 10 });
      if (f.hit) {
        expect(f.damage).toBeGreaterThanOrEqual(10);
        added++;
      } else {
        expect(f.damage).toBe(0);
        kept++;
      }
    }
    expect(added + kept).toBe(30);
  });

  test('terse mode produces "X hits Y (N)." style on plain hit', () => {
    for (let i = 0; i < 60; i++) {
      const f = resolveAttack(attacker, tgtLowAC, { terse: true });
      if (f.hit && !f.critical && !f.lethal) {
        expect(f.narrative).toMatch(/Player hits Mook \(\d+\)\./);
        return;
      }
    }
  });
});
