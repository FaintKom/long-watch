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

  // --- Iter 42: expanded Wizard cantrips ---
  shocking_grasp: {
    id: 'shocking_grasp', name: 'Shocking Grasp', level: 0,
    description: 'Cantrip. Melee spell attack, 1d8 lightning. Target loses reactions.',
    cast: (char, _pool, target) => target ? attackVsAC(char, target, 'int', '1d8') : { log: ['No target.'] },
  },
  acid_splash: {
    id: 'acid_splash', name: 'Acid Splash', level: 0,
    description: 'Cantrip. DEX save vs DC; 1d6 acid on fail.',
    cast: (char, _pool, target) => {
      if (!target) return { log: ['No target.'] };
      const dc = 8 + char.prof() + modifier(char.stats.int);
      const sv = rollDice(20);
      if (sv >= dc) return { log: [`Acid Splash: target saves (${sv} vs ${dc}).`] };
      const dmg = rollDice(6);
      target.takeHit(dmg);
      return { log: [`Acid Splash: ${dmg} acid damage.`], damageDealt: dmg };
    },
  },
  light: {
    id: 'light', name: 'Light', level: 0,
    description: 'Cantrip. Object sheds bright light. (Flavor.)',
    cast: () => ({ log: ['You touch a small stone; it glows with a steady, candle-clean light.'] }),
  },

  // --- Iter 42: expanded Wizard L1-L2 ---
  thunderwave: {
    id: 'thunderwave', name: 'Thunderwave', level: 1,
    description: 'L1 slot. CON save vs DC; 2d8 thunder on fail. Pushes target 10ft.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[0]--;
      const dc = 8 + char.prof() + modifier(char.stats.int);
      const sv = rollDice(20);
      const dmg = rollNd(2, 8);
      if (sv >= dc) {
        const half = Math.floor(dmg / 2);
        target.takeHit(half);
        return { log: [`Thunderwave: target saves (${sv} vs ${dc}), takes ${half}.`], damageDealt: half };
      }
      target.takeHit(dmg);
      return { log: [`Thunderwave: ${dmg} thunder damage, ${target.preset.name} reels.`], damageDealt: dmg };
    },
  },
  mage_armor: {
    id: 'mage_armor', name: 'Mage Armor', level: 1,
    description: 'L1 slot. +3 AC for the night.',
    cast: (char, pool) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      pool.spellSlots[0]--;
      char.addAC(3);
      return { log: ['Mage Armor: +3 AC.'] };
    },
  },
  scorching_ray: {
    id: 'scorching_ray', name: 'Scorching Ray', level: 2,
    description: 'L2 slot. Three ranged spell attacks, 2d6 fire each.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[1] <= 0) return { log: ['No L2 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[1]--;
      const log: string[] = [];
      let total = 0;
      const atk = char.prof() + modifier(char.stats.int);
      for (let i = 0; i < 3; i++) {
        const roll = rollDice(20);
        if (roll === 1) { log.push(`Ray ${i + 1}: fumble.`); continue; }
        if (roll === 20 || roll + atk >= target.preset.ac) {
          const d = rollAttackDamage('2d6', roll === 20);
          target.takeHit(d);
          total += d;
          log.push(`Ray ${i + 1}: HIT ${d}.`);
        } else {
          log.push(`Ray ${i + 1}: miss (${roll + atk}).`);
        }
      }
      return { log: [`Scorching Ray total: ${total}.`, ...log], damageDealt: total };
    },
  },
  shatter: {
    id: 'shatter', name: 'Shatter', level: 2,
    description: 'L2 slot. CON save; 3d8 thunder on fail.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[1] <= 0) return { log: ['No L2 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[1]--;
      const dc = 8 + char.prof() + modifier(char.stats.int);
      const sv = rollDice(20);
      const dmg = rollNd(3, 8);
      if (sv >= dc) {
        const half = Math.floor(dmg / 2);
        target.takeHit(half);
        return { log: [`Shatter: saved, ${half}.`], damageDealt: half };
      }
      target.takeHit(dmg);
      return { log: [`Shatter: ${dmg} thunder damage.`], damageDealt: dmg };
    },
  },

  // --- Iter 42: expanded Cleric ---
  spare_the_dying: {
    id: 'spare_the_dying', name: 'Spare the Dying', level: 0,
    description: 'Cantrip. Stabilises self if low HP (heals 1).',
    cast: (char) => {
      if (char.hp <= 0) return { log: ['You cannot cast on yourself when down.'] };
      char.heal(1);
      return { log: ['Spare the Dying: bleeding slows; +1 HP.'], healed: 1 };
    },
  },
  bless: {
    id: 'bless', name: 'Bless', level: 1,
    description: 'L1 slot. +1d4 to your next attack rolls and saves (+2 AC simulated).',
    cast: (char, pool) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      pool.spellSlots[0]--;
      char.addAC(2);
      return { log: ['Bless: +2 AC simulated as buffed posture.'] };
    },
  },
  healing_word: {
    id: 'healing_word', name: 'Healing Word', level: 1,
    description: 'L1 slot. Bonus action heal, 1d4 + WIS.',
    cast: (char, pool) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      pool.spellSlots[0]--;
      const heal = rollDice(4) + modifier(char.stats.wis);
      char.heal(heal);
      return { log: [`Healing Word: +${heal} HP.`], healed: heal };
    },
  },
  inflict_wounds: {
    id: 'inflict_wounds', name: 'Inflict Wounds', level: 1,
    description: 'L1 slot. Melee spell attack, 3d10 necrotic.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[0] <= 0) return { log: ['No L1 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[0]--;
      return attackVsAC(char, target, 'wis', '3d10');
    },
  },
  spiritual_weapon: {
    id: 'spiritual_weapon', name: 'Spiritual Weapon', level: 2,
    description: 'L2 slot. Force weapon attack, 1d8 + WIS, sticks for the encounter.',
    cast: (char, pool, target) => {
      if (pool.spellSlots[1] <= 0) return { log: ['No L2 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[1]--;
      const atk = char.prof() + modifier(char.stats.wis);
      const roll = rollDice(20);
      if (roll === 1) return { log: ['Spiritual Weapon: fumble.'] };
      if (roll === 20 || roll + atk >= target.preset.ac) {
        const d = rollAttackDamage('1d8', roll === 20) + modifier(char.stats.wis);
        target.takeHit(d);
        return { log: [`Spiritual Weapon: HIT for ${d} force damage.`], damageDealt: d };
      }
      return { log: [`Spiritual Weapon: miss (${roll + atk}).`] };
    },
  },
  hold_person: {
    id: 'hold_person', name: 'Hold Person', level: 2,
    description: 'L2 slot. WIS save; target loses next attack on fail (simulated as miss).',
    cast: (char, pool, target) => {
      if (pool.spellSlots[1] <= 0) return { log: ['No L2 slots.'] };
      if (!target) return { log: ['No target.'] };
      pool.spellSlots[1]--;
      const dc = 8 + char.prof() + modifier(char.stats.wis);
      const sv = rollDice(20);
      if (sv >= dc) return { log: [`Hold Person: ${target.preset.name} resists (${sv} vs ${dc}).`] };
      // Simulate by dealing a token psychic 1 damage and "freezing" their AI for 2 turns.
      target.takeHit(1);
      return { log: [`Hold Person: ${target.preset.name} is paralysed for a beat.`], damageDealt: 1 };
    },
  },
  prayer_of_healing: {
    id: 'prayer_of_healing', name: 'Prayer of Healing', level: 2,
    description: 'L2 slot. Self heal 2d8 + WIS.',
    cast: (char, pool) => {
      if (pool.spellSlots[1] <= 0) return { log: ['No L2 slots.'] };
      pool.spellSlots[1]--;
      const heal = rollNd(2, 8) + modifier(char.stats.wis);
      char.heal(heal);
      return { log: [`Prayer of Healing: +${heal} HP.`], healed: heal };
    },
  },
};

export const STARTING_SPELLS: Record<ClassId, string[]> = {
  fighter: [],
  rogue: [],
  wizard: [
    // cantrips
    'fire_bolt', 'ray_of_frost', 'shocking_grasp', 'acid_splash', 'light',
    // L1
    'magic_missile', 'burning_hands', 'thunderwave', 'mage_armor',
    // L2
    'scorching_ray', 'shatter',
  ],
  cleric: [
    // cantrips
    'sacred_flame', 'spare_the_dying', 'light',
    // L1
    'guiding_bolt', 'cure_wounds', 'bless', 'healing_word', 'inflict_wounds',
    // L2
    'spiritual_weapon', 'hold_person', 'prayer_of_healing',
  ],
};
