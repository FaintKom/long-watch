import { describe, test, expect } from 'vitest';
import { Memory, formatMemoryForPrompt } from '../src/memory';

describe('Memory', () => {
  test('addEvent stores the event in the feed', () => {
    const m = new Memory();
    const e = m.addEvent('Door bursts open', 100, 'public');
    expect(e.id).toBe(1);
    expect(m.feed.events.length).toBe(1);
  });

  test('relevantFor returns recency-biased top-K with lexical match', () => {
    const m = new Memory();
    m.addEvent('Front door bursts open. Mooks storm in.', 100, 'public');
    m.addEvent('Wallace cries out from upstairs.', 120, 'public');
    m.addEvent('Mira lights a candle.', 60, 'public');
    const items = m.relevantFor('matriarch', 'where is wallace', 130, 3);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.some(it => it.text.includes('Wallace'))).toBe(true);
  });

  test('private events do not leak to NPCs not in the visibility list', () => {
    const m = new Memory();
    m.addEvent('Penny saw a hooded figure', 50, ['maid']);
    const matriarchView = m.relevantFor('matriarch', 'hooded figure', 100, 5);
    expect(matriarchView.find(x => x.text.includes('hooded'))).toBeUndefined();
    const maidView = m.relevantFor('maid', 'hooded figure', 100, 5);
    expect(maidView.find(x => x.text.includes('hooded'))).toBeDefined();
  });

  test('addReflection caps per-NPC list at maxReflectionsPerNpc', () => {
    const m = new Memory();
    m.maxReflectionsPerNpc = 3;
    for (let i = 0; i < 10; i++) m.addReflection('matriarch', `r${i}`, 100);
    const list = m.reflections.get('matriarch')!;
    expect(list.length).toBe(3);
    expect(list[0].text).toBe('r7');
    expect(list[2].text).toBe('r9');
  });

  test('clear wipes feed + reflections', () => {
    const m = new Memory();
    m.addEvent('e', 1, 'public');
    m.addReflection('matriarch', 'r', 1);
    m.clear();
    expect(m.feed.events.length).toBe(0);
    expect(m.reflections.size).toBe(0);
  });

  test('formatMemoryForPrompt formats with time + tag', () => {
    const out = formatMemoryForPrompt([
      { kind: 'event', text: 'foo', minute: 21 * 60 + 30, importance: 1 },
      { kind: 'reflection', text: 'bar', minute: 22 * 60, importance: 1.4 },
    ]);
    expect(out).toContain('~event~');
    expect(out).toContain('~thought~');
    expect(out).toContain('PM');
  });
});
