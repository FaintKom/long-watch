/**
 * Consequence Flag Store - per Bobby-Gray pattern #4 in docs/REFERENCE_PROMPTS.md:
 *
 *   "Store clues as consequences (durable world state), not as scripted reveal
 *    events. The player can encounter the slashed portrait via any path."
 *
 * Each flag is a string key with a value (boolean, string, number, or detail
 * object). The Groq npc-chat proxy receives a compact serialisation of the
 * relevant flags so NPCs can answer truthfully about world state without us
 * scripting an event for every possible path.
 *
 * Conventions:
 *   - flag names lowercase_snake_case
 *   - prefix with the subject: `portrait_slashed`, `cellar_key_taken`, `magrath_caught_in_lie`
 *   - reveals are flags too: `assassin_arrival_imminent` is set at arrivalMinute-30
 */
import { CastId } from './cast';

export type FlagValue = boolean | number | string | { [k: string]: FlagValue };

export interface FlagEntry {
  name: string;
  value: FlagValue;
  /** In-game minute the flag was set. */
  setAt: number;
  /** Optional visibility set: which NPCs already "know" this. Public if undefined. */
  knownBy?: CastId[] | 'public';
}

export class ConsequenceStore {
  private flags = new Map<string, FlagEntry>();

  set(name: string, value: FlagValue, setAt: number, knownBy: CastId[] | 'public' = 'public'): void {
    this.flags.set(name, { name, value, setAt, knownBy });
  }

  get(name: string): FlagEntry | null {
    return this.flags.get(name) ?? null;
  }

  has(name: string): boolean {
    const e = this.flags.get(name);
    if (!e) return false;
    if (typeof e.value === 'boolean') return e.value;
    return true;
  }

  /** Numeric increment (used for kill counts, alarm levels, etc). */
  inc(name: string, by: number, setAt: number): number {
    const cur = this.flags.get(name);
    const prev = (cur && typeof cur.value === 'number') ? cur.value : 0;
    const next = prev + by;
    this.set(name, next, setAt, cur?.knownBy);
    return next;
  }

  /** All flags this NPC knows about. */
  knownBy(castId: CastId): FlagEntry[] {
    const out: FlagEntry[] = [];
    for (const e of this.flags.values()) {
      if (e.knownBy === undefined || e.knownBy === 'public') { out.push(e); continue; }
      if (Array.isArray(e.knownBy) && e.knownBy.includes(castId)) out.push(e);
    }
    return out;
  }

  /** Flat list. Use for save/load + debug. */
  all(): FlagEntry[] {
    return [...this.flags.values()];
  }

  clear(): void { this.flags.clear(); }
}

/** Format flags for prompt injection. Boolean true flags listed by name; valued flags as "name = value". */
export function formatFlagsForPrompt(entries: FlagEntry[]): string {
  if (entries.length === 0) return '(no special world flags)';
  const lines: string[] = [];
  for (const e of entries) {
    if (typeof e.value === 'boolean') {
      if (e.value) lines.push(`- ${e.name}`);
    } else if (typeof e.value === 'object') {
      lines.push(`- ${e.name} = ${JSON.stringify(e.value)}`);
    } else {
      lines.push(`- ${e.name} = ${e.value}`);
    }
  }
  return lines.length === 0 ? '(no special world flags)' : lines.join('\n');
}
