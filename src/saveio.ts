/**
 * Pure save/load helpers.
 *
 * main.ts owns the heavy saveGame/loadGame/applyPendingLoad (those touch
 * runtime globals: character, gameClock, plot, memory, consequences, etc).
 * This module exposes only IO-shape transforms - base64 encoding, version
 * detection, v1 -> v2 migration with safe defaults - so they can be unit
 * tested without touching DOM or game state.
 */

export type SaveVersion = 1 | 2;

export interface SaveV1 {
  version: 1;
  chosenClass: string;
  character: { name: string; level: number; hp: number; maxHp: number; ac: number; stats: Record<string, number> };
  pool: unknown;
  learnedSpells: string[];
  plot: { revealed: Record<string, boolean>; [k: string]: unknown };
  clockMinute: number;
  assassinSpawned: boolean;
  assassinIds: unknown[];
  pos: { x: number; y: number; z: number; yaw: number; pitch: number };
  clueAttempted: { id: string; attempted: boolean }[];
  log: string[];
}

export interface SaveV2 extends Omit<SaveV1, 'version' | 'clueAttempted'> {
  version: 2;
  seed: string;
  savedAt: number;
  clueAttempted: { id: string; attempted: boolean; lastResult: unknown }[];
  memory: {
    events: unknown[];
    nextEventId: number;
    reflections: { npcId: string; list: unknown[] }[];
    nextReflectionId: number;
  };
  consequences: { name: string; value: unknown; setAt: number; knownBy?: string[] | 'public' }[];
  gamePhase: string;
  inCatacombs: boolean;
}

/** Detect version of an arbitrary parsed object. Returns null if invalid. */
export function detectVersion(data: unknown): SaveVersion | null {
  if (!data || typeof data !== 'object') return null;
  const v = (data as { version?: unknown }).version;
  if (v === 1) return 1;
  if (v === 2) return 2;
  return null;
}

/** base64 round-trip safe for Unicode strings. */
export function encodeSaveString(json: string): string {
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSaveString(b64: string): unknown | null {
  try {
    const json = decodeURIComponent(escape(atob(b64.trim())));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Migrate v1 save to v2 shape by filling new fields with safe defaults.
 * Does NOT validate that v1 itself is well-formed beyond the version tag.
 */
export function migrateV1ToV2(v1: SaveV1): SaveV2 {
  return {
    ...v1,
    version: 2,
    seed: `migrated-v1-${v1.clockMinute}-${Math.floor(Math.random() * 0xffff).toString(36)}`,
    savedAt: Date.now(),
    clueAttempted: v1.clueAttempted.map((c) => ({ id: c.id, attempted: c.attempted, lastResult: null })),
    memory: {
      events: [],
      nextEventId: 1,
      reflections: [],
      nextReflectionId: 1,
    },
    consequences: [],
    gamePhase: 'exploring',
    inCatacombs: false,
  };
}

/** Decode base64, detect version, migrate to v2 if v1. Returns null on parse failure. */
export function loadAndNormalizeToV2(b64: string): SaveV2 | null {
  const data = decodeSaveString(b64);
  const v = detectVersion(data);
  if (v === 2) return data as SaveV2;
  if (v === 1) return migrateV1ToV2(data as SaveV1);
  return null;
}
