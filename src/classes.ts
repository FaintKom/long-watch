/**
 * D&D 5e classes tuned for Long Watch — every PC enters at level 4.
 */
import { Character, DndStats, Ability, modifier } from './character';

export type ClassId = 'fighter' | 'rogue' | 'wizard' | 'cleric';

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  hitDie: 6 | 8 | 10 | 12;
  primary: Ability;
  stats: DndStats;
  ac: number;
  saves: Ability[];
  skills: string[];
  features: string[];
  spellSlots: number[];
  cantripsKnown: number;
  spellsKnown: number;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: 'fighter',
    name: 'Fighter',
    description: 'Heavy armor, fast strikes, Second Wind heal. Front line.',
    hitDie: 10,
    primary: 'str',
    stats: { str: 16, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    ac: 16,
    saves: ['str', 'con'],
    skills: ['str:athletics', 'wis:perception', 'cha:intimidation'],
    features: ['Second Wind (heal 1d10+4)', 'Action Surge 1/rest', 'Fighting Style: Dueling (+2 dmg one-handed)'],
    spellSlots: [],
    cantripsKnown: 0,
    spellsKnown: 0,
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    description: 'Sneak Attack 2d6, Cunning Action, Expertise. Strike + slip.',
    hitDie: 8,
    primary: 'dex',
    stats: { str: 10, dex: 16, con: 14, int: 13, wis: 12, cha: 8 },
    ac: 14,
    saves: ['dex', 'int'],
    skills: ['dex:stealth', 'dex:sleight_of_hand', 'int:investigation', 'wis:perception', 'cha:deception'],
    features: ['Sneak Attack 2d6 (advantage or flank)', 'Cunning Action: bonus Dash/Disengage/Hide', 'Expertise (Stealth, Perception)'],
    spellSlots: [],
    cantripsKnown: 0,
    spellsKnown: 0,
  },
  wizard: {
    id: 'wizard',
    name: 'Wizard',
    description: 'Arcane caster. Many spells, fragile body. Control + knowledge.',
    hitDie: 6,
    primary: 'int',
    stats: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
    ac: 12,
    saves: ['int', 'wis'],
    skills: ['int:arcana', 'int:history', 'int:investigation', 'wis:insight'],
    features: ['Arcane Recovery (recover 2 slots/day)', '5 cantrips, prepare 7 spells/day'],
    spellSlots: [4, 3, 0, 0],
    cantripsKnown: 5,
    spellsKnown: 7,
  },
  cleric: {
    id: 'cleric',
    name: 'Cleric',
    description: 'Divine caster. Heavy armor, heals, party support.',
    hitDie: 8,
    primary: 'wis',
    stats: { str: 13, dex: 10, con: 14, int: 8, wis: 16, cha: 12 },
    ac: 18,
    saves: ['wis', 'cha'],
    skills: ['wis:medicine', 'wis:insight', 'cha:persuasion', 'int:religion'],
    features: ['Channel Divinity 1/rest', 'Domain spells', 'Heavy armor + shield'],
    spellSlots: [4, 3, 0, 0],
    cantripsKnown: 4,
    spellsKnown: 5,
  },
};

export function applyClass(character: Character, cls: ClassDef) {
  character.stats = { ...cls.stats };
  const conMod = modifier(character.stats.con);
  const avg = Math.floor(cls.hitDie / 2) + 1;
  character.maxHp = cls.hitDie + avg * 3 + conMod * 4;
  character.hp = character.maxHp;
  character.ac = cls.ac;
  character.saveProficiencies = new Set(cls.saves);
  character.skillProficiencies = new Set(cls.skills);
  character.level = 4;
}
