/**
 * NPC schedules.
 *
 * Each cast NPC has a list of waypoints they rotate through over the night.
 * `currentSpot(npc, minute)` returns the active waypoint at a given in-game
 * minute. Caller (main.ts) only applies it while the NPC is in `idle` state
 * (not fleeing/fighting/alarmed).
 */
import type { CastId } from './cast';

export interface ScheduleSpot {
  fromMinute: number;
  x: number; y: number; z: number;
  label: string;
}

export type Schedule = ScheduleSpot[];

/** Per-NPC schedules. Minutes are absolute since midnight (21*60 = 9:00 PM). */
export const SCHEDULES: Record<CastId, Schedule> = {
  matriarch: [
    { fromMinute: 21 * 60,      x: 17.5, y: 1.5, z: 8,  label: 'Entry Hall briefing' },
    { fromMinute: 21 * 60 + 30, x: 6,    y: 1.5, z: 8,  label: 'Study - reviewing letters' },
    { fromMinute: 22 * 60,      x: 17.5, y: 1.5, z: 14, label: 'Entry Hall - watching doors' },
    { fromMinute: 23 * 60,      x: 6,    y: 1.5, z: 8,  label: 'Study - waiting alone' },
    { fromMinute: 24 * 60,      x: 17.5, y: 1.5, z: 8,  label: 'Entry Hall again' },
    { fromMinute: 27 * 60,      x: 6,    y: 1.5, z: 8,  label: 'Study at dawn' },
  ],
  heir: [
    { fromMinute: 21 * 60,      x: 27.5, y: 6.5, z: 10, label: 'Bedroom (locked door)' },
    { fromMinute: 25 * 60,      x: 27.5, y: 6.5, z: 10, label: 'Bedroom (pacing)' },
  ],
  right_hand: [
    { fromMinute: 21 * 60,      x: 42, y: 6.5, z: 8,   label: 'Upstairs hall, watching' },
    { fromMinute: 21 * 60 + 30, x: 30, y: 6.5, z: 22,  label: 'Library, between shelves' },
    { fromMinute: 22 * 60,      x: 42, y: 1.5, z: 22,  label: 'Storage corridor' },
    { fromMinute: 23 * 60,      x: 17.5, y: 1.5, z: 14, label: 'Entry Hall sweep' },
    { fromMinute: 24 * 60,      x: 42, y: 6.5, z: 8,   label: 'Upstairs again' },
  ],
  cook: [
    { fromMinute: 21 * 60,      x: 42, y: 1.5, z: 7,  label: 'Kitchen, prep' },
    { fromMinute: 23 * 60,      x: 42, y: 1.5, z: 14, label: 'Kitchen alcove with wine' },
    { fromMinute: 25 * 60,      x: 42, y: 1.5, z: 7,  label: 'Kitchen - cast iron in hand' },
  ],
  butler: [
    { fromMinute: 21 * 60,      x: 17.5, y: 1.5, z: 5, label: 'Entry Hall door' },
    { fromMinute: 22 * 60,      x: 17.5, y: 1.5, z: 8, label: 'Entry Hall - announcing' },
    { fromMinute: 24 * 60,      x: 17.5, y: 1.5, z: 5, label: 'Entry Hall door again' },
  ],
  maid: [
    { fromMinute: 21 * 60,      x: 30, y: 1.5, z: 21, label: 'Upstairs linen press' },
    { fromMinute: 22 * 60,      x: 30, y: 6.5, z: 22, label: 'Library - peeking at books' },
    { fromMinute: 23 * 60,      x: 30, y: 1.5, z: 21, label: 'Linen press, listening' },
  ],
  gardener: [
    { fromMinute: 21 * 60,      x: 40, y: 1.5, z: 38, label: 'Courtyard perimeter' },
    { fromMinute: 22 * 60,      x: 15.5, y: 1.5, z: 38, label: 'Herb shed' },
    { fromMinute: 23 * 60,      x: 40, y: 1.5, z: 38, label: 'Courtyard again' },
  ],
};

export function currentSpot(npc: CastId, currentMinute: number): ScheduleSpot | null {
  const sched = SCHEDULES[npc];
  if (!sched || sched.length === 0) return null;
  let active = sched[0];
  for (const s of sched) {
    if (s.fromMinute <= currentMinute) active = s;
    else break;
  }
  return active;
}
