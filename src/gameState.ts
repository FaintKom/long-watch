/**
 * Top-level game state machine (xstate v5).
 *
 * Formalises the major phases of a Long Watch session:
 *
 *   intro -> exploring -> [warning] -> exploring_warned -> [arrival] -> combat
 *                                                 \-> catacombs -> escaped
 *                     \-> dead / heir_dead / dawn
 *
 * Existing ad-hoc booleans (`started`, `endingShown`, `inCatacombs`) still drive
 * the actual gameplay - the machine is mirrored via send() calls so we can read
 * one coherent state for saves, debug output, and future analytics.
 *
 * Access via the actor returned by `startGameActor()`. main.ts exposes it on
 * `window.__gameState`.
 */
import { createMachine, createActor, type Actor } from 'xstate';

export type GameEvent =
  | { type: 'START' }
  | { type: 'WARNING' }
  | { type: 'ASSASSIN_ARRIVED' }
  | { type: 'COMBAT_RESOLVED' }
  | { type: 'CATACOMBS_ENTER' }
  | { type: 'CATACOMBS_EXIT' }
  | { type: 'DAWN' }
  | { type: 'PLAYER_DEAD' }
  | { type: 'HEIR_DEAD' };

export const gameMachine = createMachine({
  id: 'longWatch',
  initial: 'intro',
  types: {} as { events: GameEvent },
  states: {
    intro: {
      on: { START: 'exploring' },
    },
    exploring: {
      on: {
        WARNING: 'exploring_warned',
        CATACOMBS_ENTER: 'catacombs',
        PLAYER_DEAD: 'ending_dead',
        HEIR_DEAD: 'ending_heir_dead',
        DAWN: 'ending_dawn',
      },
    },
    exploring_warned: {
      on: {
        ASSASSIN_ARRIVED: 'combat',
        CATACOMBS_ENTER: 'catacombs',
        PLAYER_DEAD: 'ending_dead',
        HEIR_DEAD: 'ending_heir_dead',
        DAWN: 'ending_dawn',
      },
    },
    combat: {
      on: {
        COMBAT_RESOLVED: 'exploring_warned',
        CATACOMBS_ENTER: 'catacombs',
        PLAYER_DEAD: 'ending_dead',
        HEIR_DEAD: 'ending_heir_dead',
        DAWN: 'ending_dawn',
      },
    },
    catacombs: {
      on: {
        CATACOMBS_EXIT: 'ending_escaped',
        PLAYER_DEAD: 'ending_dead',
        DAWN: 'ending_dawn',
      },
    },
    ending_dawn: { type: 'final' },
    ending_dead: { type: 'final' },
    ending_heir_dead: { type: 'final' },
    ending_escaped: { type: 'final' },
  },
});

export type GameActor = Actor<typeof gameMachine>;

export function startGameActor(onTransition?: (snapshot: ReturnType<GameActor['getSnapshot']>) => void): GameActor {
  const actor = createActor(gameMachine);
  if (onTransition) actor.subscribe(onTransition);
  actor.start();
  return actor;
}
