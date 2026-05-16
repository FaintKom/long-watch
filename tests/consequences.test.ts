import { describe, test, expect } from 'vitest';
import { ConsequenceStore, formatFlagsForPrompt } from '../src/consequences';

describe('ConsequenceStore', () => {
  test('set/get/has roundtrip', () => {
    const s = new ConsequenceStore();
    s.set('boss_proven', true, 100);
    expect(s.has('boss_proven')).toBe(true);
    expect(s.get('boss_proven')!.value).toBe(true);
    expect(s.get('boss_proven')!.setAt).toBe(100);
  });

  test('inc accumulates', () => {
    const s = new ConsequenceStore();
    s.inc('kills', 1, 100);
    s.inc('kills', 2, 110);
    expect(s.get('kills')!.value).toBe(3);
  });

  test('knownBy filters by NPC visibility', () => {
    const s = new ConsequenceStore();
    s.set('public_event', true, 100);
    s.set('saw_attack', true, 110, ['matriarch', 'right_hand']);
    const magraView = s.knownBy('matriarch').map(e => e.name);
    expect(magraView).toContain('public_event');
    expect(magraView).toContain('saw_attack');
    const cookView = s.knownBy('cook').map(e => e.name);
    expect(cookView).toContain('public_event');
    expect(cookView).not.toContain('saw_attack');
  });

  test('boolean false flags do not trigger has()', () => {
    const s = new ConsequenceStore();
    s.set('flag', false, 100);
    expect(s.has('flag')).toBe(false);
  });

  test('formatFlagsForPrompt prints booleans + valued flags', () => {
    const s = new ConsequenceStore();
    s.set('alarmed', true, 100);
    s.set('clock_warning', false, 100);
    s.set('boss_id', 'forsythe', 100);
    s.set('kills', 3, 100);
    const out = formatFlagsForPrompt(s.all());
    expect(out).toContain('- alarmed');
    expect(out).not.toContain('clock_warning');
    expect(out).toContain('boss_id = forsythe');
    expect(out).toContain('kills = 3');
  });
});
