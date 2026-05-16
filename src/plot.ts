/**
 * Plot tables for Long Watch.
 *
 * Each new game rolls:
 *  - Boss (1d8)     who paid for the hit
 *  - Assassin (1d6) who shows up
 *  - Twist (1d8)    surprise complication (8 -> roll twice, discard 1/8)
 *  - Per-player Secret Objective (1d12)
 *
 * Boss + Twist are HIDDEN from the player initially and revealed by investigation
 * clues, dialogue, or in-combat tells. Secret Objective is shown to the player
 * who owns it but never to others.
 */

export type BossId =
  | 'forewaters'
  | 'assassin_guild'
  | 'sea_goddess'
  | 'forsythe'
  | 'unseelie'
  | 'sentient_sword'
  | 'right_hand'
  | 'freelance';

export type AssassinId =
  | 'mooks'
  | 'cult_of_umberlee'
  | 'crimson_angel'
  | 'sebek_ari'
  | 'mezzoloth'
  | 'air_elemental';

export type TwistId =
  | 'none'
  | 'poisoned_heir'
  | 'assassin_kin'
  | 'fake_death'
  | 'doppelganger_matriarch'
  | 'heir_is_daughter'
  | 'heir_is_dragon';

export type ObjectiveId =
  | 'oblivious'
  | 'thief'
  | 'saboteur'
  | 'pacifist'
  | 'smitten'
  | 'seeker'
  | 'protector'
  | 'accomplice'
  | 'celebrity'
  | 'boozer'
  | 'leader'
  | 'traitor';

export interface BossDef { id: BossId; name: string; description: string; clueHint: string; }
export interface AssassinDef { id: AssassinId; name: string; description: string; }
export interface TwistDef { id: TwistId; name: string; description: string; }
export interface ObjectiveDef {
  id: ObjectiveId;
  name: string;
  description: string;
  leakBoss?: boolean;
  leakAssassin?: boolean;
}

export const BOSSES: Record<BossId, BossDef> = {
  forewaters:     { id: 'forewaters',     name: 'The Forewaters',         description: 'A rival merchant family with criminal underworld ties.',                       clueHint: 'Criminal underworld rumor (History or Investigation).' },
  assassin_guild: { id: 'assassin_guild', name: "The Assassin's Guild",   description: 'The Guild auditions new members against difficult targets.',                  clueHint: 'The assassin carries a Guild token.' },
  sea_goddess:    { id: 'sea_goddess',    name: 'The Sea Goddess',        description: 'Chaotic deity of the sea. Fletcher Mercantile has tamed too much.',           clueHint: "Assassin's holy symbols (Religion check)." },
  forsythe:       { id: 'forsythe',       name: 'Forsythe Forewater',     description: 'Once the Matriarch suitor — jilted for his cowardice and greed.',             clueHint: "Letters in the Matriarch's study." },
  unseelie:       { id: 'unseelie',       name: 'The Unseelie Court',     description: 'Fae rulers of the Shadowfell. The Matriarch owes an unpaid debt.',            clueHint: 'The assassin is under a geas.' },
  sentient_sword: { id: 'sentient_sword', name: 'Sunder, sentient sword', description: 'The blade commands its bearer. It hates structure and order.',                clueHint: 'The weapon itself reveals on handling.' },
  right_hand:     { id: 'right_hand',     name: 'The Right Hand',         description: 'The Matriarch enforcer — believes the Fletchers no longer serve justice.',   clueHint: 'Observation or Insight during the night.' },
  freelance:      { id: 'freelance',      name: 'No one (freelance)',     description: 'The assassin is acting alone. There is no Boss.',                             clueHint: 'No conclusive clue exists.' },
};

export const ASSASSINS: Record<AssassinId, AssassinDef> = {
  mooks:            { id: 'mooks',            name: 'The Mooks',          description: 'A gang of low-life human mercenaries from the harbor underbelly.' },
  cult_of_umberlee: { id: 'cult_of_umberlee', name: 'The Sea Cult',       description: 'Priests and fanatics of the chaotic sea goddess.' },
  crimson_angel:    { id: 'crimson_angel',    name: 'The Crimson Angel',  description: 'A solo assassin of legend. Leaves bloody calling cards.' },
  sebek_ari:        { id: 'sebek_ari',        name: 'Sebek-Ari',          description: 'A Yuan-ti who manipulates from shadow and summons snakes.' },
  mezzoloth:        { id: 'mezzoloth',        name: 'A summoned Mezzoloth',description: 'A ruthless yugoloth bound by ritual. Disrupt the summoner.' },
  air_elemental:    { id: 'air_elemental',    name: 'An Air Elemental',   description: 'A summoned storm spirit. Silence the cultist controlling it.' },
};

export const TWISTS: Record<TwistId, TwistDef> = {
  none:                    { id: 'none',                    name: 'No Twist',                 description: 'What you see is what you get.' },
  poisoned_heir:           { id: 'poisoned_heir',           name: 'The Heir is poisoned',     description: 'A servant slipped him slow poison. Adrenaline will trigger it.' },
  assassin_kin:            { id: 'assassin_kin',            name: 'Assassin is kin',          description: "The assassin is connected to a party member's past." },
  fake_death:              { id: 'fake_death',              name: 'The Heir fakes his death', description: 'Wallace has been seduced by the cult and will stage his own murder.' },
  doppelganger_matriarch:  { id: 'doppelganger_matriarch',  name: 'The Matriarch is an impostor', description: "The 'Matriarch' is a doppelganger. The real one is hidden." },
  heir_is_daughter:        { id: 'heir_is_daughter',        name: 'The Heir is a daughter',   description: 'Wallace is, in truth, Walla. The party must notice.' },
  heir_is_dragon:          { id: 'heir_is_dragon',          name: 'The Heir is a dragon',     description: 'Wallace is a polymorphed blue dragon wyrmling.' },
};

export const OBJECTIVES: Record<ObjectiveId, ObjectiveDef> = {
  oblivious:  { id: 'oblivious',  name: 'Oblivious',  description: 'You have no secret objective. Why do you ask?' },
  thief:      { id: 'thief',      name: 'Thief',      description: 'Steal as many valuables as possible before dawn.' },
  saboteur:   { id: 'saboteur',   name: 'Saboteur',   description: 'You and the Heir must survive; the rest of the party must die.', leakBoss: true },
  pacifist:   { id: 'pacifist',   name: 'Pacifist',   description: 'No sentient creature dies tonight, not if you can help it.' },
  smitten:    { id: 'smitten',    name: 'Smitten',    description: 'Your character is smitten with someone in the party or cast. Win their affection.' },
  seeker:     { id: 'seeker',     name: 'Seeker',     description: "The Heir wears a ruby necklace; it must be in your possession by morning." },
  protector:  { id: 'protector',  name: 'Protector',  description: 'You must take damage in place of at least two other party members.' },
  accomplice: { id: 'accomplice', name: 'Accomplice', description: 'The Assassin must survive the night.', leakAssassin: true },
  celebrity:  { id: 'celebrity',  name: 'Celebrity',  description: 'You must have the killing blow on the Assassin — or convincingly take credit.' },
  boozer:     { id: 'boozer',     name: 'Boozer',     description: 'Find and consume enough alcohol to become intoxicated.' },
  leader:     { id: 'leader',     name: 'Leader',     description: 'Devise a plan to save the Heir. The party must follow this plan.' },
  traitor:    { id: 'traitor',    name: 'Traitor',    description: 'The Heir must die tonight.', leakBoss: true },
};

const BOSS_ORDER: BossId[] = ['forewaters', 'assassin_guild', 'sea_goddess', 'forsythe', 'unseelie', 'sentient_sword', 'right_hand', 'freelance'];
const ASSASSIN_ORDER: AssassinId[] = ['mooks', 'cult_of_umberlee', 'crimson_angel', 'sebek_ari', 'mezzoloth', 'air_elemental'];
const TWIST_ORDER: TwistId[] = ['none', 'poisoned_heir', 'assassin_kin', 'fake_death', 'doppelganger_matriarch', 'heir_is_daughter', 'heir_is_dragon'];
const OBJECTIVE_ORDER: ObjectiveId[] = ['oblivious', 'thief', 'saboteur', 'pacifist', 'smitten', 'seeker', 'protector', 'accomplice', 'celebrity', 'boozer', 'leader', 'traitor'];

function rollD(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export interface PlotRoll {
  bossRoll: number;
  boss: BossId;
  assassinRoll: number;
  assassin: AssassinId;
  twistRolls: number[];
  twists: TwistId[];
  assassinArrivalMinute: number;
  revealed: { boss: boolean; assassin: boolean; twists: boolean };
}

export function rollPlot(): PlotRoll {
  const bossRoll = rollD(8);
  const boss = BOSS_ORDER[bossRoll - 1];
  const assassinRoll = rollD(6);
  const assassin = ASSASSIN_ORDER[assassinRoll - 1];

  const twistRolls: number[] = [];
  const twists: TwistId[] = [];
  const first = rollD(8);
  twistRolls.push(first);
  if (first === 8) {
    for (let i = 0; i < 2; i++) {
      let r = rollD(8);
      while (r === 1 || r === 8) r = rollD(8);
      twistRolls.push(r);
      twists.push(TWIST_ORDER[r - 1]);
    }
  } else {
    twists.push(TWIST_ORDER[first - 1]);
  }

  const arrivalRoll = rollD(6);
  const assassinArrivalMinute = 1380 + arrivalRoll * 60; // 11 PM + 1d6 h

  return {
    bossRoll, boss,
    assassinRoll, assassin,
    twistRolls, twists,
    assassinArrivalMinute,
    revealed: { boss: false, assassin: false, twists: false },
  };
}

export interface PlayerObjective {
  playerId: string;
  rollValue: number;
  objective: ObjectiveId;
}

export function rollObjectivesForParty(playerIds: string[]): PlayerObjective[] {
  const used = new Set<ObjectiveId>();
  const result: PlayerObjective[] = [];
  for (const pid of playerIds) {
    let r: number;
    let obj: ObjectiveId;
    let safety = 50;
    do {
      r = rollD(12);
      obj = OBJECTIVE_ORDER[r - 1];
      safety--;
    } while (used.has(obj) && safety > 0);
    used.add(obj);
    result.push({ playerId: pid, rollValue: r, objective: obj });
  }
  return result;
}

export interface PlotSummaryForOwner {
  myObjective: ObjectiveDef;
  leakedBoss?: BossDef;
  leakedAssassin?: AssassinDef;
  knownBoss?: BossDef;
  knownAssassin?: AssassinDef;
  knownTwists?: TwistDef[];
  arrivalDeadlineMinute: number;
}

export function summarizeForPlayer(plot: PlotRoll, objective: ObjectiveId): PlotSummaryForOwner {
  const objDef = OBJECTIVES[objective];
  const summary: PlotSummaryForOwner = {
    myObjective: objDef,
    arrivalDeadlineMinute: plot.assassinArrivalMinute,
  };
  if (objDef.leakBoss) summary.leakedBoss = BOSSES[plot.boss];
  if (objDef.leakAssassin) summary.leakedAssassin = ASSASSINS[plot.assassin];
  if (plot.revealed.boss) summary.knownBoss = BOSSES[plot.boss];
  if (plot.revealed.assassin) summary.knownAssassin = ASSASSINS[plot.assassin];
  if (plot.revealed.twists) summary.knownTwists = plot.twists.map(t => TWISTS[t]);
  return summary;
}
