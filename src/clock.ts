/**
 * Game clock — hybrid event-driven + slow idle drift.
 *
 * Time advances when meaningful actions occur (entering a new room, talking,
 * searching). Idle exploration costs ~2 in-game min per real minute. Combat
 * pauses the clock entirely.
 *
 * The clock is the only mechanism that brings the assassin closer. When
 * `currentMinute >= assassinArrivalMinute`, combat is triggered.
 */

export type ActionCost =
  | 'enter_room'
  | 'short_chat'
  | 'ai_chat_turn'
  | 'investigate'
  | 'read_document'
  | 'drink'
  | 'rest_one_hour'
  | 'idle_drift';

export const ACTION_MINUTES: Record<ActionCost, number> = {
  enter_room: 2,
  short_chat: 10,
  ai_chat_turn: 5,
  investigate: 15,
  read_document: 5,
  drink: 15,
  rest_one_hour: 60,
  idle_drift: 1,
};

export interface ClockState {
  currentMinute: number;
  assassinArrivalMinute: number;
  dawnMinute: number;
  inCombat: boolean;
  done: boolean;
}

export interface ClockTickEvent {
  minute: number;
  triggerAssassin: boolean;
  triggerDawn: boolean;
  triggerWarning: boolean;
}

export class GameClock {
  state: ClockState;
  onTick?: (e: ClockTickEvent) => void;

  private warningFired = false;
  private _fractional = 0;
  /** In-game minutes per real second of game time. */
  driftPerSecond = 1 / 30;

  constructor(arrivalMinute: number) {
    this.state = {
      currentMinute: 21 * 60, // 9:00 PM
      assassinArrivalMinute: arrivalMinute,
      dawnMinute: 24 * 60 + 5 * 60, // 5:00 AM next day
      inCombat: false,
      done: false,
    };
  }

  formatted(): string { return formatMinute(this.state.currentMinute); }

  advance(cost: ActionCost) {
    if (this.state.done || this.state.inCombat) return;
    this.advanceMinutes(ACTION_MINUTES[cost]);
  }

  driftStep(realDtSeconds: number) {
    if (this.state.done || this.state.inCombat) return;
    const delta = realDtSeconds * this.driftPerSecond;
    if (delta <= 0) return;
    this._fractional += delta;
    if (this._fractional >= 1) {
      const whole = Math.floor(this._fractional);
      this._fractional -= whole;
      this.advanceMinutes(whole);
    }
  }

  enterCombat() { this.state.inCombat = true; }
  exitCombat() { this.state.inCombat = false; }

  private advanceMinutes(min: number) {
    if (min <= 0) return;
    const prev = this.state.currentMinute;
    this.state.currentMinute += min;

    const e: ClockTickEvent = {
      minute: this.state.currentMinute,
      triggerAssassin: prev < this.state.assassinArrivalMinute && this.state.currentMinute >= this.state.assassinArrivalMinute,
      triggerDawn: prev < this.state.dawnMinute && this.state.currentMinute >= this.state.dawnMinute,
      triggerWarning: false,
    };

    if (!this.warningFired
        && this.state.currentMinute >= this.state.assassinArrivalMinute - 30
        && this.state.currentMinute < this.state.assassinArrivalMinute) {
      this.warningFired = true;
      e.triggerWarning = true;
    }

    if (e.triggerAssassin) this.state.inCombat = true;
    if (e.triggerDawn) this.state.done = true;

    this.onTick?.(e);
  }

  setMinute(m: number) {
    this.state.currentMinute = m;
  }
}

export function formatMinute(totalMin: number): string {
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = ((totalMin % 60) + 60) % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const period = h24 >= 12 && h24 < 24 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
