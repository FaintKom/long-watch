/**
 * Inventory + gold + ownership / theft mechanics.
 */
import { Character, rollDice } from './character';
import { CastId } from './cast';

export type OwnerId = CastId | 'player' | 'house' | 'unclaimed';

export interface ItemDef {
  id: string;
  name: string;
  value: number;
  stackable: boolean;
  onUse?: (character: Character) => string[];
  /** Can be thrown as a projectile. */
  throwable?: boolean;
  /** Damage dice when thrown and hits. Defaults to '1d3' if throwable. */
  damageThrown?: string;
  /** Color of the projectile sphere visual when thrown. */
  throwColor?: number;
}

export const ITEM_DEFS: Record<string, ItemDef> = {
  silver_pieces:    { id: 'silver_pieces',    name: 'Silver pieces',          value: 0,   stackable: true },
  gold_pieces:      { id: 'gold_pieces',      name: 'Gold pieces',            value: 0,   stackable: true },
  bread:            { id: 'bread',            name: 'Loaf of bread',          value: 2,   stackable: true, onUse: c => { c.heal(3); return ['You eat the bread. +3 HP.']; }, throwable: true, damageThrown: '1d2', throwColor: 0xa07555 },
  bandage:          { id: 'bandage',          name: 'Cloth bandage',          value: 3,   stackable: true, onUse: c => { c.heal(5); return ['You bind a wound. +5 HP.']; } },
  potion_healing:   { id: 'potion_healing',   name: 'Healing potion',         value: 50,  stackable: true, onUse: c => { const h = rollDice(4) + rollDice(4) + 2; c.heal(h); return [`You quaff the potion. +${h} HP.`]; }, throwable: true, damageThrown: '1d4', throwColor: 0x33aa44 },
  dagger:           { id: 'dagger',           name: 'Steel dagger',           value: 8,   stackable: false, throwable: true, damageThrown: '1d4+2', throwColor: 0xbbbbcc },
  longsword:        { id: 'longsword',        name: 'Longsword',              value: 25,  stackable: false },
  lantern:          { id: 'lantern',          name: 'Oil lantern',            value: 6,   stackable: false, throwable: true, damageThrown: '1d4', throwColor: 0xddaa44 },
  ruby_necklace:    { id: 'ruby_necklace',    name: 'Ruby necklace',          value: 250, stackable: false, throwable: true, damageThrown: '1d2', throwColor: 0xcc1133 },
  diary:            { id: 'diary',            name: "Heir's diary",           value: 5,   stackable: false, throwable: true, damageThrown: '1d3', throwColor: 0x224488 },
  ledger:           { id: 'ledger',           name: 'Account ledger',         value: 10,  stackable: false, throwable: true, damageThrown: '1d3', throwColor: 0x3a3018 },
  wine_bottle:      { id: 'wine_bottle',      name: 'Bottle of wine',         value: 5,   stackable: true,  throwable: true, damageThrown: '1d4', throwColor: 0x882211 },
  brandy_bottle:    { id: 'brandy_bottle',    name: 'Bottle of brandy',       value: 12,  stackable: true,  throwable: true, damageThrown: '1d4', throwColor: 0xa07020 },
  plate_meal:       { id: 'plate_meal',       name: 'Hot meal',               value: 1,   stackable: true,  onUse: c => { c.heal(5); return ['You eat the meal. +5 HP.']; }, throwable: true, damageThrown: '1d2', throwColor: 0xeeeedd },
  honey_cake:       { id: 'honey_cake',       name: 'Honey-cake',             value: 3,   stackable: true,  onUse: c => { c.heal(4); return ['Sweet and warm. +4 HP.']; }, throwable: true, damageThrown: '1d2', throwColor: 0xdd8844 },
  vase:             { id: 'vase',             name: 'Porcelain vase',         value: 8,   stackable: false, throwable: true, damageThrown: '1d6', throwColor: 0x3355aa },
  candelabra:       { id: 'candelabra',       name: 'Brass candelabra',       value: 12,  stackable: false, throwable: true, damageThrown: '1d6+1', throwColor: 0xd4a017 },
};

export interface InventoryStack {
  defId: string;
  count: number;
}

export class Inventory {
  stacks: InventoryStack[] = [];
  gold = 5;

  add(defId: string, count = 1): boolean {
    const def = ITEM_DEFS[defId];
    if (!def) return false;
    if (def.stackable) {
      const existing = this.stacks.find(s => s.defId === defId);
      if (existing) { existing.count += count; return true; }
    }
    this.stacks.push({ defId, count });
    return true;
  }

  remove(defId: string, count = 1): boolean {
    const idx = this.stacks.findIndex(s => s.defId === defId);
    if (idx === -1) return false;
    const stack = this.stacks[idx];
    if (stack.count > count) { stack.count -= count; return true; }
    this.stacks.splice(idx, 1);
    return true;
  }

  has(defId: string): boolean {
    return this.stacks.some(s => s.defId === defId);
  }

  totalWeight(): number {
    return this.stacks.reduce((sum, s) => sum + s.count, 0);
  }
}

export interface ReputationState {
  caughtCount: number;
  withNpc: Partial<Record<CastId, number>>;
  alarmed: boolean;
}

export function newReputation(): ReputationState {
  return { caughtCount: 0, withNpc: {}, alarmed: false };
}

export function adjustRep(rep: ReputationState, npc: CastId, delta: number) {
  rep.withNpc[npc] = Math.max(-100, Math.min(100, (rep.withNpc[npc] ?? 0) + delta));
}

export function ownerForPosition(x: number, _y: number, z: number, isUpper: boolean): OwnerId {
  if (!isUpper) {
    if (z >= 0 && z <= 14) {
      if (x <= 10) return 'matriarch';
      if (x <= 25) return 'matriarch';
      if (x <= 35) return 'matriarch';
      return 'cook';
    }
    if (z >= 15 && z <= 28) {
      if (x <= 10) return 'matriarch';
      if (x <= 21) return 'matriarch';
      if (x <= 35) return 'matriarch';
      return 'butler';
    }
    return 'house';
  }
  if (z >= 0 && z <= 14) {
    if (x <= 12) return 'matriarch';
    if (x <= 23) return 'matriarch';
    if (x <= 35) return 'heir';
    return 'right_hand';
  }
  if (z >= 15 && z <= 28) {
    if (x <= 13) return 'player';
    if (x <= 25) return 'player';
    if (x <= 38) return 'maid';
    return 'matriarch';
  }
  return 'house';
}

export interface ShopOffer {
  itemId: string;
  price: number;
  stock: number;
}

export const SHOP_INVENTORIES: Partial<Record<CastId, ShopOffer[]>> = {
  cook: [
    { itemId: 'bread', price: 2, stock: 3 },
    { itemId: 'honey_cake', price: 3, stock: 2 },
    { itemId: 'plate_meal', price: 1, stock: 5 },
  ],
  butler: [
    { itemId: 'lantern', price: 6, stock: 1 },
    { itemId: 'bandage', price: 3, stock: 4 },
  ],
  right_hand: [
    { itemId: 'dagger', price: 8, stock: 2 },
    { itemId: 'potion_healing', price: 50, stock: 1 },
    { itemId: 'bandage', price: 3, stock: 6 },
  ],
};
