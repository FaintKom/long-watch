/**
 * D&D 5e SRD loader.
 *
 * Sources canonical monster/spell statblocks from the 5e-bits/5e-database JSON
 * (mirrored at public/srd/monsters.json + spells.json). Game-side wrappers (Enemy,
 * action SPELLS) can call into this for canon-correct HP/AC/attacks while
 * keeping their gameplay-tuned overrides.
 *
 * Lookup uses the SRD `index` string (e.g. "mage", "priest", "thug", "swarm-of-poisonous-snakes").
 */

export interface SrdMonster {
  index: string;
  name: string;
  size: string;
  type: string;
  armor_class: { type: string; value: number }[];
  hit_points: number;
  hit_dice: string;
  hit_points_roll: string;
  speed: Record<string, string>;
  strength: number; dexterity: number; constitution: number;
  intelligence: number; wisdom: number; charisma: number;
  challenge_rating: number;
  proficiency_bonus: number;
  xp: number;
  actions?: SrdMonsterAction[];
  special_abilities?: { name: string; desc: string }[];
  damage_vulnerabilities: string[];
  damage_resistances: string[];
  damage_immunities: string[];
  condition_immunities: { name: string }[] | string[];
  senses: Record<string, string | number>;
  languages: string;
}

export interface SrdMonsterAction {
  name: string;
  desc: string;
  attack_bonus?: number;
  damage?: {
    damage_dice?: string;
    damage_type?: { name: string };
    choose?: number;
    type?: string;
  }[];
}

export interface SrdSpell {
  index: string;
  name: string;
  level: number;
  range: string;
  school: { name: string };
  damage?: {
    damage_at_slot_level?: Record<string, string>;
    damage_at_character_level?: Record<string, string>;
    damage_type?: { name: string };
  };
  dc?: { dc_type: { name: string }; dc_success?: string };
  desc: string[];
}

let _monsters: SrdMonster[] | null = null;
let _spells: SrdSpell[] | null = null;
let _monsterIndex: Map<string, SrdMonster> | null = null;
let _spellIndex: Map<string, SrdSpell> | null = null;

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`SRD fetch failed: ${path} (${res.status})`);
  return (await res.json()) as T;
}

export async function loadMonsters(): Promise<SrdMonster[]> {
  if (_monsters) return _monsters;
  _monsters = await loadJson<SrdMonster[]>('/srd/monsters.json');
  _monsterIndex = new Map(_monsters.map(m => [m.index, m]));
  return _monsters;
}

export async function loadSpells(): Promise<SrdSpell[]> {
  if (_spells) return _spells;
  _spells = await loadJson<SrdSpell[]>('/srd/spells.json');
  _spellIndex = new Map(_spells.map(s => [s.index, s]));
  return _spells;
}

export async function getMonster(index: string): Promise<SrdMonster | null> {
  if (!_monsterIndex) await loadMonsters();
  return _monsterIndex!.get(index) ?? null;
}

export async function getSpell(index: string): Promise<SrdSpell | null> {
  if (!_spellIndex) await loadSpells();
  return _spellIndex!.get(index) ?? null;
}

/** Extract the first melee action's `damage_dice + modifier` formula in NdM(+B) form, if any. */
export function firstMeleeAttackFormula(m: SrdMonster): string | null {
  if (!m.actions) return null;
  for (const a of m.actions) {
    if (!a.damage || !a.damage.length) continue;
    const dd = a.damage[0].damage_dice;
    if (dd) return dd;
  }
  return null;
}

export function firstAttackBonus(m: SrdMonster): number | null {
  if (!m.actions) return null;
  for (const a of m.actions) if (typeof a.attack_bonus === 'number') return a.attack_bonus;
  return null;
}

/** Best-effort AC (returns the first armor_class entry value). */
export function srdAC(m: SrdMonster): number {
  return m.armor_class[0]?.value ?? 10;
}

/** Parse "40 ft." -> tiles (1 tile = 5 ft.). Returns 5 if missing. */
export function speedTiles(m: SrdMonster): number {
  const raw = m.speed.walk ?? '30 ft.';
  const n = parseInt(raw, 10);
  if (Number.isFinite(n)) return Math.max(1, Math.round(n / 5));
  return 6;
}
