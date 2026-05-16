import { describe, test, expect } from 'vitest';
import {
  detectVersion,
  encodeSaveString,
  decodeSaveString,
  migrateV1ToV2,
  loadAndNormalizeToV2,
  type SaveV1,
  type SaveV2,
} from '../src/saveio';

function makeV1(): SaveV1 {
  return {
    version: 1,
    chosenClass: 'fighter',
    character: { name: 'Hero', level: 4, hp: 28, maxHp: 28, ac: 15, stats: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 } },
    pool: { actionSurges: 1, secondWinds: 1, sneakAttacks: 0, channelDivinity: 0, spellSlots: [3, 1] },
    learnedSpells: [],
    plot: { revealed: { boss: false, assassin: false, twists: false }, bossRoll: 4, boss: 'forsythe' },
    clockMinute: 21 * 60 + 30,
    assassinSpawned: false,
    assassinIds: [],
    pos: { x: 17.5, y: 1.5, z: 8, yaw: 0, pitch: 0 },
    clueAttempted: [
      { id: 'letters_study', attempted: true },
      { id: 'guild_token', attempted: false },
    ],
    log: ['You enter the manor.', 'Magrath greets you.'],
  };
}

function makeV2(): SaveV2 {
  return {
    ...makeV1(),
    version: 2,
    seed: 'unit-test-seed',
    savedAt: 1700000000000,
    clueAttempted: [
      { id: 'letters_study', attempted: true, lastResult: { passed: true, roll: 18, total: 20, revealedBoss: true, text: 'Forsythe.' } },
    ],
    memory: { events: [], nextEventId: 1, reflections: [], nextReflectionId: 1 },
    consequences: [
      { name: 'boss_proven', value: true, setAt: 1290, knownBy: 'public' },
    ],
    gamePhase: 'exploring_warned',
    inCatacombs: false,
  };
}

describe('saveio version detection', () => {
  test('detectVersion returns 1 for v1', () => {
    expect(detectVersion(makeV1())).toBe(1);
  });

  test('detectVersion returns 2 for v2', () => {
    expect(detectVersion(makeV2())).toBe(2);
  });

  test('detectVersion returns null for garbage', () => {
    expect(detectVersion(null)).toBeNull();
    expect(detectVersion('not an object')).toBeNull();
    expect(detectVersion({ version: 99 })).toBeNull();
    expect(detectVersion({})).toBeNull();
  });
});

describe('saveio base64 round-trip', () => {
  test('encode then decode yields the original object', () => {
    const v2 = makeV2();
    const json = JSON.stringify(v2);
    const b64 = encodeSaveString(json);
    const round = decodeSaveString(b64);
    expect(round).toEqual(v2);
  });

  test('decode of malformed base64 returns null', () => {
    expect(decodeSaveString('not-valid-base64-!!!')).toBeNull();
  });

  test('decode of valid base64 but invalid JSON returns null', () => {
    const b64 = btoa('this is not json');
    expect(decodeSaveString(b64)).toBeNull();
  });

  test('Unicode survives round-trip (Cyrillic + emoji)', () => {
    const obj = { version: 2, log: ['Маграт говорит', '🗡️ удар'] };
    const b64 = encodeSaveString(JSON.stringify(obj));
    const round = decodeSaveString(b64) as { log: string[] };
    expect(round.log[0]).toBe('Маграт говорит');
    expect(round.log[1]).toBe('🗡️ удар');
  });
});

describe('saveio v1 -> v2 migration', () => {
  test('migrated save has version: 2', () => {
    const v2 = migrateV1ToV2(makeV1());
    expect(v2.version).toBe(2);
  });

  test('migration preserves character + plot + pos + log', () => {
    const v1 = makeV1();
    const v2 = migrateV1ToV2(v1);
    expect(v2.character).toEqual(v1.character);
    expect(v2.plot).toEqual(v1.plot);
    expect(v2.pos).toEqual(v1.pos);
    expect(v2.log).toEqual(v1.log);
    expect(v2.clockMinute).toBe(v1.clockMinute);
    expect(v2.chosenClass).toBe(v1.chosenClass);
  });

  test('migration fills new fields with defaults', () => {
    const v2 = migrateV1ToV2(makeV1());
    expect(v2.memory.events).toEqual([]);
    expect(v2.memory.nextEventId).toBe(1);
    expect(v2.memory.reflections).toEqual([]);
    expect(v2.memory.nextReflectionId).toBe(1);
    expect(v2.consequences).toEqual([]);
    expect(v2.gamePhase).toBe('exploring');
    expect(v2.inCatacombs).toBe(false);
    expect(typeof v2.seed).toBe('string');
    expect(typeof v2.savedAt).toBe('number');
  });

  test('migration adds lastResult: null to each clue', () => {
    const v2 = migrateV1ToV2(makeV1());
    for (const c of v2.clueAttempted) {
      expect(c.lastResult).toBeNull();
    }
    expect(v2.clueAttempted.length).toBe(2);
    expect(v2.clueAttempted[0].id).toBe('letters_study');
    expect(v2.clueAttempted[0].attempted).toBe(true);
  });
});

describe('saveio loadAndNormalizeToV2 full pipeline', () => {
  test('v1 -> base64 -> loadAndNormalizeToV2 yields v2 with v1 data preserved', () => {
    const v1 = makeV1();
    const b64 = encodeSaveString(JSON.stringify(v1));
    const out = loadAndNormalizeToV2(b64);
    expect(out).not.toBeNull();
    expect(out!.version).toBe(2);
    expect(out!.character).toEqual(v1.character);
    expect(out!.plot).toEqual(v1.plot);
    expect(out!.memory.events).toEqual([]);
    expect(out!.consequences).toEqual([]);
  });

  test('v2 -> base64 -> loadAndNormalizeToV2 passes through unchanged', () => {
    const v2 = makeV2();
    const b64 = encodeSaveString(JSON.stringify(v2));
    const out = loadAndNormalizeToV2(b64);
    expect(out).toEqual(v2);
  });

  test('bad input returns null', () => {
    expect(loadAndNormalizeToV2('not-valid')).toBeNull();
    expect(loadAndNormalizeToV2(btoa('{"version":99}'))).toBeNull();
  });
});
