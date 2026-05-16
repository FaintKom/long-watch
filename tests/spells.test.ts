import { describe, test, expect, beforeEach } from 'vitest';
import seedrandom from 'seedrandom';
import { SPELLS, STARTING_SPELLS, newResourcePool } from '../src/actions';
import { Character } from '../src/character';

beforeEach(() => {
  Math.random = seedrandom('spell-tests');
});

describe('SPELLS catalog', () => {
  test('all spells have id/name/level/description/cast', () => {
    for (const [id, sp] of Object.entries(SPELLS)) {
      expect(sp.id).toBe(id);
      expect(typeof sp.name).toBe('string');
      expect([0, 1, 2]).toContain(sp.level);
      expect(typeof sp.description).toBe('string');
      expect(typeof sp.cast).toBe('function');
    }
  });

  test('STARTING_SPELLS keys all exist in SPELLS', () => {
    for (const [, ids] of Object.entries(STARTING_SPELLS)) {
      for (const id of ids) {
        expect(SPELLS[id]).toBeDefined();
      }
    }
  });

  test('wizard starts with >=10 spells across cantrip+L1+L2', () => {
    const list = STARTING_SPELLS.wizard.map(id => SPELLS[id]);
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.some(s => s.level === 0)).toBe(true);
    expect(list.some(s => s.level === 1)).toBe(true);
    expect(list.some(s => s.level === 2)).toBe(true);
  });

  test('cleric starts with >=10 spells across cantrip+L1+L2', () => {
    const list = STARTING_SPELLS.cleric.map(id => SPELLS[id]);
    expect(list.length).toBeGreaterThanOrEqual(10);
    expect(list.some(s => s.level === 0)).toBe(true);
    expect(list.some(s => s.level === 1)).toBe(true);
    expect(list.some(s => s.level === 2)).toBe(true);
  });
});

describe('Cantrip "No target" path', () => {
  test('fire_bolt returns "No target." when called with null', () => {
    const ch = new Character('Test');
    const pool = newResourcePool('wizard');
    const r = SPELLS.fire_bolt.cast(ch, pool, null);
    expect(r.log.join(' ')).toMatch(/No target/);
  });
});

describe('Slot-consuming spells', () => {
  test('thunderwave fails with "No L1 slots." when pool empty', () => {
    const ch = new Character('Test');
    const pool = newResourcePool('wizard');
    pool.spellSlots[0] = 0;
    const r = SPELLS.thunderwave.cast(ch, pool, null);
    expect(r.log.join(' ')).toMatch(/No L1 slots/);
  });

  test('scorching_ray fails with "No L2 slots." when pool empty', () => {
    const ch = new Character('Test');
    const pool = newResourcePool('wizard');
    pool.spellSlots[1] = 0;
    const r = SPELLS.scorching_ray.cast(ch, pool, null);
    expect(r.log.join(' ')).toMatch(/No L2 slots/);
  });

  test('healing_word heals self and returns a positive heal', () => {
    const ch = new Character('Test');
    ch.maxHp = 30; ch.hp = 5;
    const pool = newResourcePool('cleric');
    pool.spellSlots[0] = 1;
    const r = SPELLS.healing_word.cast(ch, pool, null);
    expect(r.healed ?? 0).toBeGreaterThan(0);
    expect(ch.hp).toBeGreaterThan(5);
  });

  test('mage_armor adds 3 to AC and consumes a slot', () => {
    const ch = new Character('Test');
    ch.ac = 10;
    const pool = newResourcePool('wizard');
    pool.spellSlots[0] = 2;
    SPELLS.mage_armor.cast(ch, pool, null);
    expect(ch.ac).toBe(13);
    expect(pool.spellSlots[0]).toBe(1);
  });
});
