/**
 * Serializable game state. Designed to be the single source of truth that a
 * multiplayer Colyseus room can replicate to clients.
 *
 * Today this lives in browser memory. In multiplayer the server will own this
 * struct and broadcast diffs.
 */

import { PlotRoll, ObjectiveId } from './plot';
import { ClassId } from './classes';

export interface PlayerState {
  id: string;
  className: ClassId;
  charName: string;
  level: number;
  hp: number;
  maxHp: number;
  ac: number;
  x: number; y: number; z: number;
  yaw: number; pitch: number;
  objective: ObjectiveId;
  alive: boolean;
}

export interface CastState {
  id: string;
  alive: boolean;
  history: { role: 'user' | 'assistant'; content: string; playerId: string }[];
}

export interface EnemyState {
  id: string;
  kind: string;
  x: number; y: number; z: number;
  hp: number;
  maxHp: number;
}

export type GamePhase = 'lobby' | 'long_watch' | 'combat' | 'resolved';

export interface GameState {
  phase: GamePhase;
  clockMinute: number;
  plot: PlotRoll;
  players: Record<string, PlayerState>;
  cast: Record<string, CastState>;
  enemies: Record<string, EnemyState>;
  log: string[];
  endReason?: 'heir_alive_dawn' | 'assassin_defeated' | 'player_dead' | 'heir_dead';
}

export function emptyState(): GameState {
  return {
    phase: 'lobby',
    clockMinute: 21 * 60,
    plot: {
      bossRoll: 0, boss: 'freelance',
      assassinRoll: 0, assassin: 'mooks',
      twistRolls: [], twists: ['none'],
      assassinArrivalMinute: 0,
      revealed: { boss: false, assassin: false, twists: false },
    },
    players: {},
    cast: {},
    enemies: {},
    log: [],
  };
}

/** Per-player view that hides other players' objectives + unrevealed plot. */
export function viewForPlayer(state: GameState, viewerId: string): GameState {
  const cloned: GameState = JSON.parse(JSON.stringify(state));
  for (const pid of Object.keys(cloned.players)) {
    if (pid !== viewerId) cloned.players[pid].objective = 'oblivious' as ObjectiveId;
  }
  if (!cloned.plot.revealed.boss) cloned.plot.boss = 'freelance';
  if (!cloned.plot.revealed.assassin) cloned.plot.assassin = 'mooks';
  if (!cloned.plot.revealed.twists) cloned.plot.twists = ['none'];
  return cloned;
}
