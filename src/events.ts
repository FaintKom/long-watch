/**
 * World event feed — chronicles things NPCs may have witnessed.
 *
 * NPCs receive a filtered recent slice as part of their AI dialogue prompt so
 * they can react in-character to events that happened in their presence.
 */
import { CastId } from './cast';

export interface WorldEvent {
  id: number;
  inGameMinute: number;
  text: string;
  visibility: 'public' | CastId[];
}

export class WorldFeed {
  events: WorldEvent[] = [];
  private nextId = 1;
  /** Iter 66 perf: tightened from 60 to 30 - rolling window for retrieval. */
  maxKept = 30;

  add(text: string, inGameMinute: number, visibility: 'public' | CastId[] = 'public'): WorldEvent {
    const e: WorldEvent = { id: this.nextId++, inGameMinute, text, visibility };
    this.events.push(e);
    if (this.events.length > this.maxKept) this.events.shift();
    return e;
  }

  recentFor(castId: CastId, count = 8): WorldEvent[] {
    const result: WorldEvent[] = [];
    for (let i = this.events.length - 1; i >= 0 && result.length < count; i--) {
      const e = this.events[i];
      if (e.visibility === 'public' || (Array.isArray(e.visibility) && e.visibility.includes(castId))) {
        result.unshift(e);
      }
    }
    return result;
  }

  clear() {
    this.events = [];
    this.nextId = 1;
  }
}

function formatMinute(totalMin: number): string {
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = ((totalMin % 60) + 60) % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const period = h24 >= 12 && h24 < 24 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export function formatEventsForPrompt(events: WorldEvent[]): string {
  if (events.length === 0) return '(none yet - the night is quiet)';
  return events.map(e => `- [${formatMinute(e.inGameMinute)}] ${e.text}`).join('\n');
}
