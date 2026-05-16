/**
 * Class signature actions and spells.
 */
import { Character, rollDice, rollNd, modifier, rollAttackDamage } from './character';
import { ClassId } from './classes';
import { Enemy } from './enemy';

export interface ResourcePool {
  secondWindLeft: number;
  actionSurgeLeft: number;
  channelDivinityLeft: number;
  spellSlots: number[];
  spellSlotsMax: number[];
}

export function newResourcePool(classId: ClassId): ResourcePool {
  const slots = classId === 'wizard' || classId === 'cleric' ? [4, 3] : [];
  return {
    secondWindLeft: classId === 'fighter' ? 1 : 0,
    actionSurgeLeft: classId === 'fighter' ? 1 : 0,
    channelDivinityLeft: classId === 'cleric' ? 1 : 0,
    spellSlots: [...slots],
    spellSlotsMax: [...slots],
  };
}

export interface ActionResult {
  log: string[];
  damageDealt?: number;
  healed?: number;
  turnedUndead?: boolean;
}

export function secondWind(pool: ResourcePool, character: Character): ActionResult {
  if (pool.secondWindLeft <= 0) return { log: ['Second Wind already used.'] };
  pool.secondWindLeft--;
  const heal = rollDice(10) + character.level;
  character.heal(heal);
  return { log: [`Second Wind: heal ${heal} HP.`], healed: heal };
}

export function actionSurge(pool: ResourcePool): ActionResult {
  if (pool.actionSurgeLeft <= 0) return { log: ['Action Surge already used.'] };
  pool.actionSurgeLeft--;
  return { log: ['Action Surge: take another action immediately.'] };
}

export function sneakAttackDamage(_character: Character): number {
  return rollNd(2, 6);
}

export function cunningAction(): ActionResult {
  return { log: ['Cunning Action: Dash / Disengage / Hide as a bonus action.'] };
}

export function channelDivinityTurnUndead(pool: ResourcePool, character: Character, enemies: Enemy[]): ActionResult {
  if (pool.channelDivinityLeft <= 0) return { log: ['Channel Divinity already used.'] };
  pool.channelDivinityLeft--;
  const dc = 8 + character.prof() + modifier(character.stats.wis);
  const log: string[] = [`Channel Divinity: Turn Undead (DC ${dc}).`];
  let turned = 0;
  for (const en of enemies) {
    const save = rollDice(20);
    if (save < dc) { log.push(`  ${en.preset.name} is turned and recoils.`); turned++; }
    else log.push(`  ${en.preset.name} resists.`);
  }
  return { log, turnedUndead: turned > 0 };
}

export interface SpellDef {
  id: string;
  name: string;
  level: 0 | 1 | 2;
  description: string;
  cast: (character: Character, pool: ResourcePool, target: Enemy | null) => ActionResult;
}

function attackVsAC(character: Character, target: Enemy, ability: 'int' | 'wis', damageDice: string): ActionResult {
  const atkBonus = character.prof() + modifier(character.stats[ability]);
  const roll = rollDice(20);
  const total = roll + atkBonus;
  if (roll === 1) return { log: ['Spell attack: 1 - fumble.'] };
  if (roll === 20 || total >= target.preset.ac) {
    const dmg = rollAttackDamage(damageDice, roll === 20);
    if (dmg <= 0) return { log: ['Hit, but no damage configured.'] };
    target.takeHit(dmg);
    return { log: [`Spell ${total} vs AC ${target.preset.ac}: HIT for ${dmg}.`], damageDealt: dmg };
  }
  return { log: [`Spell ${total} vs AC ${target.preset.ac}: miss.`] };
}

export const SPELLS: Record<string, SpellDef> = {
  fire_bolt: {
    id: 'fire_bolt', name: 'Fire Bolt', level: 0,
    description: 'Cantrip. Ranged spell attack, 1d10 fire.',
    cast: (char, _pool, target) => target ? attackVsAC(char, target, 'int', '1d10') : { log: ['No target.'] },
  },
  ray_of_frost: {
    id: 'ray_of_frost', name: 'Ray of Frost', level: 0,
    description: 'Cantrip. Ranged spell attack, 1d8 cold.',
    cast: (char, _pool, target) => target ? attackVsAC(char, target, 'int', '1d8') : { log: ['No target.'] },
  },
  magic_missile: {
    id: 'magic_missile', name: 'Magic Missile', level: 1,
    description: 'L1 slot. 3 auto-hit darts, 1d4+1 force each.',
    cast: (_char, pool, target) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[0]--;
      let total = 0;
      for (let i = 0; i < 3; i++) total += rollDice(4) + 1;
      target.takeHit(total);
      return { log: [`Magic Missile: 3 darts -> ${total} force damage.`], damageDealt: total };
    },
  },
  burning_hands: {
    id: 'burning_hands', name: 'Burning Hands', level: 1,
    description: 'L1 slot. 3d6 fire, 15ft cone.',
    cast: (_char, pool, target) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[0]--;
      const dmg = rollNd(3, 6);
      target.takeHit(dmg);
      return { log: [`Burning Hands: ${dmg} fire damage.`], damageDealt: dmg };
    },
  },
  cure_wounds: {
    id: 'cure_wounds', name: 'Cure Wounds', level: 1,
    description: 'L1 slot. Heal target 1d8 + WIS.',
    cast: (char, pool) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      pool.spellSlots[0]--;
      const heal = rollDice(8) + modifier(char.stats.wis);
      char.heal(heal);
      return { log: [`Cure Wounds: +${heal} HP.`], healed: heal };
    },
  },
  guiding_bolt: {
    id: 'guiding_bolt', name: 'Guiding Bolt', level: 1,
    description: 'L1 slot. Ranged spell attack, 4d6 radiant.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[0]--;
      return attackVsAC(char, target, 'wis', '4d6');
    },
  },
  sacred_flame: {
    id: 'sacred_flame', name: 'Sacred Flame', level: 0,
    description: 'Cantrip. DEX save vs DC; 1d8 radiant on fail.',
    cast: (char, _pool, target) => {
      if (!target) return { log: ['No target.'] };
      const dc = 8 + char.prof() + modifier(char.stats.wis);
      const targetSave = rollDice(20);
      if (targetSave >= dc) return { log: [`Sacred Flame: target saves (${targetSave} vs ${dc}).`] };
      const dmg = rollDice(8);
      target.takeHit(dmg);
      return { log: [`Sacred Flame: ${dmg} radiant damage.`], damageDealt: dmg };
    },
  },
};

export const STARTING_SPELLS: Record<ClassId, string[]> = {
  fighter: [],
  rogue: [],
  wizard: ['fire_bolt', 'ray_of_frost', 'magic_missile', 'burning_hands'],
  cleric: ['sacred_flame', 'guiding_bolt', 'cure_wounds'],
};
