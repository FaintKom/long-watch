/**
 * Atomic combat resolution (Bobby-Gray pattern #3).
 *
 *   "Every narration block must be sent" - the most-missed step is bundling
 *    the stat delta with the prose in a single frame so voxel state and
 *    narrative state can't desync.
 *
 * `resolveAttack(attacker, target, opts)` returns a CombatFrame:
 *   - roll + total + AC
 *   - damage (0 on miss)
 *   - critical flag, fumble flag
 *   - postHp on target
 *   - lethal flag
 *   - narrative line (one sentence)
 *   - sfxCue (audio name to play)
 *
 * Callers (swingAt, swingAtCast, enemy attacks, spell attacks) commit the
 * frame via applyCombatFrame which:
 *   1. mutates target HP / death flag via the supplied takeHit adapter
 *   2. logs the narrative
 *   3. plays the SFX cue
 *   4. emits a flags side-effect via onLethal / onResolved hooks
 *
 * No mid-resolution side effects allowed in resolveAttack - that is the whole
 * point. Determinism flows from resolveAttack; the apply step is pure I/O.
 */
import { rollDice, rollAttackDamage } from './character';

export interface AttackerInfo {
  name: string;
  attackBonus: number;
  damageDice: string;
  /** Optional damage type word ("steel", "fire", "claws"). Narrative flavor only. */
  damageWord?: string;
}

export interface TargetInfo {
  name: string;
  ac: number;
  hp: number;
  maxHp: number;
}

export interface CombatFrameOpts {
  /** Extra flat damage added on hit (sneak attack, smite, etc). */
  bonusDamage?: number;
  /** Override the natural-1 fumble line. */
  fumbleLine?: string;
  /** If true, suppress the verbose hit line and use a terse "X hits Y (N)." */
  terse?: boolean;
}

export type SfxCue =
  | 'attack_swing' | 'attack_hit' | 'enemy_falls'
  | 'spell_cast'   | 'glass_shatter';

export interface CombatFrame {
  attacker: AttackerInfo;
  target: TargetInfo;
  roll: number;
  total: number;
  hit: boolean;
  critical: boolean;
  fumble: boolean;
  damage: number;
  /** Target HP AFTER damage. Lethal when 0. */
  postHp: number;
  lethal: boolean;
  narrative: string;
  sfxCue: SfxCue;
}

/** Pure resolver. Does NOT mutate target or play sound. */
export function resolveAttack(att: AttackerInfo, tgt: TargetInfo, opts: CombatFrameOpts = {}): CombatFrame {
  const roll = rollDice(20);
  const total = roll + att.attackBonus;
  const fumble = roll === 1;
  const critical = roll === 20;
  const hit = !fumble && (critical || total >= tgt.ac);

  let damage = 0;
  if (hit) {
    damage = rollAttackDamage(att.damageDice, critical) + (opts.bonusDamage ?? 0);
    damage = Math.max(1, damage);
  }
  const postHp = Math.max(0, tgt.hp - damage);
  const lethal = hit && postHp === 0;

  const dword = att.damageWord ?? 'steel';
  let narrative: string;
  let sfxCue: SfxCue;
  if (fumble) {
    narrative = opts.fumbleLine ?? `${att.name} fumbles and misses ${tgt.name} entirely.`;
    sfxCue = 'attack_swing';
  } else if (!hit) {
    narrative = `${att.name} swings; ${tgt.name} turns the blow aside.`;
    sfxCue = 'attack_swing';
  } else if (critical) {
    narrative = `${att.name} drives ${dword} home - critical, ${damage} to ${tgt.name}.`;
    sfxCue = lethal ? 'enemy_falls' : 'attack_hit';
  } else if (lethal) {
    narrative = `${att.name} cuts ${tgt.name} down. ${damage} damage, ${tgt.name} falls.`;
    sfxCue = 'enemy_falls';
  } else {
    narrative = opts.terse
      ? `${att.name} hits ${tgt.name} (${damage}).`
      : `${att.name} hits ${tgt.name} for ${damage}.`;
    sfxCue = 'attack_hit';
  }

  return { attacker: att, target: tgt, roll, total, hit, critical, fumble, damage, postHp, lethal, narrative, sfxCue };
}

export interface CombatApplyHooks {
  takeHit: (damage: number) => void;
  log: (line: string) => void;
  playSfx: (name: SfxCue) => void;
  onLethal?: (frame: CombatFrame) => void;
  onResolved?: (frame: CombatFrame) => void;
}

export function applyCombatFrame(frame: CombatFrame, hooks: CombatApplyHooks): void {
  if (frame.damage > 0) hooks.takeHit(frame.damage);
  hooks.log(frame.narrative);
  hooks.playSfx(frame.sfxCue);
  if (frame.lethal && hooks.onLethal) hooks.onLethal(frame);
  if (hooks.onResolved) hooks.onResolved(frame);
}
