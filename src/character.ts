/**
 * D&D 5e character model, tuned for Long Watch (4th-level adventurers).
 */
import { Dice } from 'dice-typescript';

const _dice = new Dice();

/**
 * Evaluate a dice formula like "2d6+3", "1d20kh1" (advantage = keep highest 1 of 2d20),
 * "4d6dl1" (drop lowest), "1d6!" (exploding). Returns the total.
 * Use for any formula coming from data (item.damageDice, monster.attack, etc).
 */
export function rollFormula(formula: string): number {
  try {
    return _dice.roll(formula).total;
  } catch {
    // Fallback: parse simple "NdM+B" or "NdM"
    const m = formula.match(/^(\d+)d(\d+)(?:\+(\d+))?$/);
    if (!m) return 0;
    return rollNd(parseInt(m[1]), parseInt(m[2])) + (m[3] ? parseInt(m[3]) : 0);
  }
}

/** Roll N copies of a formula and sum (used for crit-doubling: rollFormulaN(2, "1d8+3")). */
export function rollFormulaN(times: number, formula: string): number {
  let total = 0;
  for (let i = 0; i < times; i++) total += rollFormula(formula);
  return total;
}

/**
 * 5e attack damage. Splits "NdM(+B)" → rolls N dice (doubled on crit) plus B once.
 * Falls back to rollFormula for non-trivial formulas (kh/dl/!) — those are passed through as-is.
 */
export function rollAttackDamage(formula: string, critical = false): number {
  const m = formula.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
  if (!m) {
    // Complex formula — let dice-typescript handle, no automatic crit doubling.
    return critical ? rollFormulaN(2, formula) : rollFormula(formula);
  }
  const n = parseInt(m[1]);
  const sides = parseInt(m[2]);
  const sign = m[3] === '-' ? -1 : 1;
  const bonus = m[4] ? sign * parseInt(m[4]) : 0;
  return rollNd(critical ? n * 2 : n, sides) + bonus;
}

export interface DndStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export type Ability = keyof DndStats;

export function modifier(stat: number): number {
  return Math.floor((stat - 10) / 2);
}

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollNd(n: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += rollDice(sides);
  return total;
}

/** Standard 5e proficiency bonus by level. */
export function proficiencyBonus(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function roll4d6drop1(): number {
  const rolls = [rollDice(6), rollDice(6), rollDice(6), rollDice(6)];
  rolls.sort((a, b) => a - b);
  return rolls[1] + rolls[2] + rolls[3];
}

export class Character {
  name: string;
  level = 4; // Long Watch is a 4th-level adventure
  stats: DndStats;
  hp: number;
  maxHp: number;
  ac: number;
  xp = 2700; // 4th-level baseline
  /** Abilities the character is proficient with for saves. */
  saveProficiencies: Set<Ability> = new Set();
  /** Skills with proficiency. Stored as "ability:skill_name" strings, e.g. "dex:stealth". */
  skillProficiencies: Set<string> = new Set();

  constructor(name: string) {
    this.name = name;
    this.stats = {
      str: roll4d6drop1(), dex: roll4d6drop1(), con: roll4d6drop1(),
      int: roll4d6drop1(), wis: roll4d6drop1(), cha: roll4d6drop1(),
    };
    this.maxHp = 28 + modifier(this.stats.con) * 4;
    this.hp = this.maxHp;
    this.ac = 10 + modifier(this.stats.dex);
  }

  prof(): number {
    return proficiencyBonus(this.level);
  }

  abilityCheck(ability: Ability): { roll: number; total: number } {
    const roll = rollDice(20);
    return { roll, total: roll + modifier(this.stats[ability]) };
  }

  skillCheck(ability: Ability, skillName: string): { roll: number; total: number } {
    const roll = rollDice(20);
    const proficient = this.skillProficiencies.has(`${ability}:${skillName}`);
    return { roll, total: roll + modifier(this.stats[ability]) + (proficient ? this.prof() : 0) };
  }

  savingThrow(ability: Ability): { roll: number; total: number } {
    const roll = rollDice(20);
    const proficient = this.saveProficiencies.has(ability);
    return { roll, total: roll + modifier(this.stats[ability]) + (proficient ? this.prof() : 0) };
  }

  attackRoll(ability: Ability = 'str'): { roll: number; total: number } {
    const roll = rollDice(20);
    return { roll, total: roll + modifier(this.stats[ability]) + this.prof() };
  }

  meleeAttack(targetAC: number, ability: Ability = 'str', damageDice = '1d6'): { hit: boolean; damage: number; critical: boolean } {
    const { roll, total } = this.attackRoll(ability);
    const critical = roll === 20;
    if (roll === 1) return { hit: false, damage: 0, critical: false };
    if (critical || total >= targetAC) {
      const dmg = rollAttackDamage(damageDice, critical) + modifier(this.stats[ability]);
      return { hit: true, damage: Math.max(1, dmg), critical };
    }
    return { hit: false, damage: 0, critical: false };
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  addAC(bonus: number) {
    this.ac += bonus;
  }
}
