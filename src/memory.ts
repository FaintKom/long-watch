/**
 * NPC long-term memory (ai-town inspired).
 *
 * Three layers:
 *   1. Raw events  - every notable thing in the world, kept in a WorldFeed.
 *   2. Reflections - short first-person summaries an NPC has formed about
 *                    what they witnessed. Generated periodically via Groq.
 *   3. Retrieval   - given the player's current message, return the top-K
 *                    most relevant memory items (mix of events + reflections)
 *                    scored by recency + lexical overlap + importance.
 *
 * No external embedding service: similarity is a cheap Jaccard over tokenized
 * lowercased word sets. Enough to pick out keyword-relevant memories without
 * paying for an embedding API or shipping transformers.js to the bundle.
 *
 * Reflection generation is fire-and-forget. The next streamReply will see new
 * reflections once the network call resolves.
 */
import { CastId } from './cast';
import { WorldFeed, WorldEvent } from './events';

export interface Reflection {
  id: number;
  npcId: CastId;
  /** In-game minute when the reflection was formed. */
  atMinute: number;
  text: string;
  /** Importance weight (1.0 = baseline, >1 = more salient). */
  importance: number;
}

export interface MemoryItem {
  kind: 'event' | 'reflection';
  text: string;
  minute: number;
  importance: number;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s.toLowerCase()
      .replace(/[^a-zа-яё0-9]+/giu, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export class Memory {
  feed: WorldFeed;
  /** Reflections grouped by NPC id. */
  reflections: Map<CastId, Reflection[]> = new Map();
  /** How many new events each NPC has seen since their last reflection. */
  private unreflectedCount: Map<CastId, number> = new Map();
  private nextReflectionId = 1;
  /** Trigger threshold - fire a reflection after this many new events. */
  reflectionThreshold = 8;
  /** Max reflections kept per NPC (oldest dropped). */
  maxReflectionsPerNpc = 20;
  /** Threshold to fire a consolidation pass (collapse oldest N into 1 summary). */
  consolidateThreshold = 15;
  /** How many oldest reflections to merge per consolidate run. */
  consolidateBatchSize = 10;
  private reflecting: Set<CastId> = new Set();
  private consolidating: Set<CastId> = new Set();

  constructor(feed?: WorldFeed) {
    this.feed = feed ?? new WorldFeed();
  }

  /** Add a world event AND bump each watching NPC's unreflected counter. */
  addEvent(text: string, inGameMinute: number, visibility: 'public' | CastId[] = 'public'): WorldEvent {
    const e = this.feed.add(text, inGameMinute, visibility);
    const seers = visibility === 'public' ? ALL_CAST_IDS : visibility;
    for (const id of seers) {
      this.unreflectedCount.set(id, (this.unreflectedCount.get(id) ?? 0) + 1);
    }
    return e;
  }

  /** Record a reflection manually (also used by the Groq callback). */
  addReflection(npcId: CastId, text: string, atMinute: number, importance = 1.4): Reflection {
    const r: Reflection = { id: this.nextReflectionId++, npcId, atMinute, text, importance };
    const list = this.reflections.get(npcId) ?? [];
    list.push(r);
    if (list.length > this.maxReflectionsPerNpc) list.shift();
    this.reflections.set(npcId, list);
    return r;
  }

  /**
   * Top-K memory items for an NPC, scored by recency + lexical relevance + importance.
   * Mixes raw events with formed reflections.
   */
  relevantFor(npcId: CastId, query: string, currentMinute: number, k = 8): MemoryItem[] {
    const queryTokens = tokenize(query);
    const events = this.feed.recentFor(npcId, 32);
    const refls = this.reflections.get(npcId) ?? [];
    const items: { item: MemoryItem; score: number }[] = [];

    for (const e of events) {
      const sim = jaccard(queryTokens, tokenize(e.text));
      const ageMin = Math.max(0, currentMinute - e.inGameMinute);
      const recency = Math.exp(-ageMin / 60);
      const score = 0.55 * recency + 0.35 * sim + 0.10;
      items.push({
        item: { kind: 'event', text: e.text, minute: e.inGameMinute, importance: 1.0 },
        score,
      });
    }
    for (const r of refls) {
      const sim = jaccard(queryTokens, tokenize(r.text));
      const ageMin = Math.max(0, currentMinute - r.atMinute);
      const recency = Math.exp(-ageMin / 60);
      const score = 0.35 * recency + 0.45 * sim + 0.20 * r.importance;
      items.push({
        item: { kind: 'reflection', text: r.text, minute: r.atMinute, importance: r.importance },
        score,
      });
    }

    items.sort((a, b) => b.score - a.score);
    return items.slice(0, k).map(x => x.item);
  }

  /**
   * If this NPC has accumulated >= threshold un-reflected events, fire a Groq
   * reflection call. Returns true if a request was actually fired.
   */
  maybeReflect(
    npcId: CastId,
    displayName: string,
    personaSnippet: string,
    currentMinute: number,
    opts: { endpoint?: string } = {},
  ): boolean {
    const count = this.unreflectedCount.get(npcId) ?? 0;
    if (count < this.reflectionThreshold) return false;
    if (this.reflecting.has(npcId)) return false;
    const events = this.feed.recentFor(npcId, count);
    if (events.length === 0) return false;
    this.reflecting.add(npcId);
    this.unreflectedCount.set(npcId, 0);

    const endpoint = opts.endpoint ?? '/api/npc-reflect';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        personaSnippet,
        events: events.map(e => ({ minute: e.inGameMinute, text: e.text })),
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`reflect ${r.status}`);
        const data = await r.json() as { reflections?: string[] };
        const list = data.reflections ?? [];
        for (const txt of list) {
          if (txt && txt.trim().length > 0) {
            this.addReflection(npcId, txt.trim(), currentMinute, 1.4);
          }
        }
      })
      .catch((e) => {
        console.warn('[memory] reflect failed for', npcId, e);
      })
      .finally(() => {
        this.reflecting.delete(npcId);
      });
    return true;
  }

  clear(): void {
    this.feed.clear();
    this.reflections.clear();
    this.unreflectedCount.clear();
    this.reflecting.clear();
    this.consolidating.clear();
    this.nextReflectionId = 1;
  }

  /**
   * If an NPC has accumulated > `consolidateThreshold` reflections, kick a
   * Groq call to summarise the oldest `consolidateBatchSize` of them into a
   * single first-person bullet, then replace them with the consolidated entry.
   * Fire-and-forget. Returns true if a request was actually fired.
   */
  maybeConsolidate(
    npcId: CastId,
    displayName: string,
    personaSnippet: string,
    currentMinute: number,
    opts: { endpoint?: string } = {},
  ): boolean {
    const list = this.reflections.get(npcId) ?? [];
    if (list.length <= this.consolidateThreshold) return false;
    if (this.consolidating.has(npcId)) return false;
    const batch = list.slice(0, this.consolidateBatchSize);
    if (batch.length === 0) return false;
    this.consolidating.add(npcId);

    const endpoint = opts.endpoint ?? '/api/npc-reflect';
    const fakeEvents = batch.map((r) => ({ minute: r.atMinute, text: r.text }));
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        personaSnippet: `${personaSnippet}\n\nYou are summarising your own older thoughts into ONE consolidated reflection.`,
        events: fakeEvents,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`consolidate ${r.status}`);
        const data = (await r.json()) as { reflections?: string[] };
        const merged = (data.reflections ?? []).join(' ').trim().slice(0, 320);
        if (merged.length > 0) {
          // Drop the consolidated batch from the front and prepend the merged one.
          const remaining = list.slice(this.consolidateBatchSize);
          remaining.unshift({
            id: this.nextReflectionId++, npcId, atMinute: currentMinute,
            text: `(consolidated) ${merged}`,
            importance: 1.6,
          });
          this.reflections.set(npcId, remaining);
        }
      })
      .catch((e) => console.warn('[memory] consolidate failed for', npcId, e))
      .finally(() => { this.consolidating.delete(npcId); });
    return true;
  }
}

/** All cast NPC ids - used to fan out public events to every unreflected counter. */
const ALL_CAST_IDS: CastId[] = ['matriarch', 'heir', 'right_hand', 'cook', 'butler', 'maid', 'gardener'];

/** Format a memory list (events + reflections) for prompt injection. */
export function formatMemoryForPrompt(items: MemoryItem[]): string {
  if (items.length === 0) return '(none yet - the night is quiet)';
  return items.map(it => {
    const tag = it.kind === 'reflection' ? '~thought~' : '~event~';
    const h24 = Math.floor(it.minute / 60) % 24;
    const m = ((it.minute % 60) + 60) % 60;
    const h12 = ((h24 + 11) % 12) + 1;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const t = `${h12}:${m.toString().padStart(2, '0')} ${period}`;
    return `- ${tag} [${t}] ${it.text}`;
  }).join('\n');
}
