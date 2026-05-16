/**
 * Faction system. Attitudes between factions determine who attacks whom on sight.
 * attitude < -25: hostile. attitude -25..25: neutral. attitude > 25: friendly.
 */
import { AssassinId } from './plot';

export type FactionId =
  | 'fletcher_house'
  | 'player_party'
  | 'forewater'
  | 'assassin_guild'
  | 'sea_cult'
  | 'unseelie'
  | 'sentient_sword'
  | 'freelance';

export interface FactionRelationship {
  factions: Record<FactionId, Partial<Record<FactionId, number>>>;
}

export function defaultRelationships(): FactionRelationship {
  const all: FactionId[] = ['fletcher_house', 'player_party', 'forewater', 'assassin_guild', 'sea_cult', 'unseelie', 'sentient_sword', 'freelance'];
  const matrix: any = {};
  for (const a of all) {
    matrix[a] = {};
    for (const b of all) {
      matrix[a][b] = a === b ? 100 : -50;
    }
  }
  matrix['fletcher_house']['player_party'] = 60;
  matrix['player_party']['fletcher_house'] = 60;
  return { factions: matrix };
}

export function attitudeBetween(rel: FactionRelationship, a: FactionId, b: FactionId): number {
  return rel.factions[a]?.[b] ?? 0;
}

export function isHostile(rel: FactionRelationship, a: FactionId, b: FactionId): boolean {
  return attitudeBetween(rel, a, b) < -25;
}

export function isFriendly(rel: FactionRelationship, a: FactionId, b: FactionId): boolean {
  return attitudeBetween(rel, a, b) > 25;
}

export function adjustAttitude(rel: FactionRelationship, a: FactionId, b: FactionId, delta: number) {
  const cur = rel.factions[a]?.[b] ?? 0;
  rel.factions[a]![b] = Math.max(-100, Math.min(100, cur + delta));
}

export const ASSASSIN_FACTION: Record<AssassinId, FactionId> = {
  mooks: 'forewater',
  cult_of_umberlee: 'sea_cult',
  crimson_angel: 'assassin_guild',
  sebek_ari: 'freelance',
  mezzoloth: 'sea_cult',
  air_elemental: 'sea_cult',
};
