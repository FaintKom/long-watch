#!/usr/bin/env node
/**
 * Combat balance Monte Carlo simulator.
 *
 * Runs N synthetic encounters per (class × assassin party) cell, records win
 * rate + median rounds-to-resolve + median player HP remaining. Prints a
 * markdown table. No game globals touched - dice mirror the in-game formulas.
 *
 * Usage:
 *   node tools/balance-sim.mjs [trials=200] [seed=balance-1]
 *
 * Tweak ENEMY tables / CLASS profiles at top to model overrides.
 *
 * Limitations: no NPC ally combat, no spells, no class signature actions, no
 * sneak attack bonuses, no positional. Treats it as Lv4 melee swing vs grouped
 * enemy AI all swinging back each round.
 */
import seedrandom from 'seedrandom';

const trials = parseInt(process.argv[2] ?? '200', 10);
const seed = process.argv[3] ?? 'balance-1';
Math.random = seedrandom(seed);

const ENEMY = {
  mook:          { hp: 32, ac: 11, atk: 4, dmg: { n: 1, s: 6, b: 2 } },
  cultist:       { hp: 9,  ac: 12, atk: 3, dmg: { n: 1, s: 6, b: 1 } },
  priest:        { hp: 27, ac: 13, atk: 5, dmg: { n: 1, s: 6, b: 3 } },
  fanatic:       { hp: 33, ac: 13, atk: 4, dmg: { n: 1, s: 4, b: 2 } },
  giant_toad:    { hp: 39, ac: 11, atk: 4, dmg: { n: 1, s: 10, b: 2 } },
  crimson_angel: { hp: 110, ac: 17, atk: 7, dmg: { n: 1, s: 8, b: 4 } },
  sebek_ari:     { hp: 66, ac: 12, atk: 5, dmg: { n: 1, s: 6, b: 3 } },
  swarm_snakes:  { hp: 36, ac: 14, atk: 5, dmg: { n: 2, s: 6, b: 0 } },
  mezzoloth:     { hp: 75, ac: 18, atk: 7, dmg: { n: 2, s: 6, b: 3 } },
  air_elemental: { hp: 90, ac: 15, atk: 8, dmg: { n: 2, s: 8, b: 0 } },
};

const ASSASSIN_PARTIES = {
  mooks:            ['mook', 'mook', 'mook', 'mook'],
  cult_of_umberlee: ['priest', 'fanatic', 'giant_toad'],
  crimson_angel:    ['crimson_angel'],
  sebek_ari:        ['sebek_ari', 'swarm_snakes'],
  mezzoloth:        ['mezzoloth'],
  air_elemental:    ['air_elemental'],
};

const CLASS = {
  fighter: { hp: 36, ac: 16, atk: 5, dmg: { n: 1, s: 8, b: 3 } },
  rogue:   { hp: 28, ac: 14, atk: 6, dmg: { n: 1, s: 6, b: 4 } },
  wizard:  { hp: 22, ac: 12, atk: 3, dmg: { n: 1, s: 8, b: 0 } },
  cleric:  { hp: 32, ac: 16, atk: 4, dmg: { n: 1, s: 8, b: 3 } },
};

// Iter 61: allies that join combat (Karla follows player closely; Right Hand
// and Magrath arrive after `arriveRound` rounds because they're patrolling
// other rooms).
const ALLIES = [
  { name: 'Karla',       hp: 32, ac: 16, atk: 5, dmg: { n: 1, s: 8, b: 3 }, arriveRound: 1 },
  { name: 'Right Hand',  hp: 27, ac: 12, atk: 4, dmg: { n: 1, s: 6, b: 2 }, arriveRound: 4 },
  { name: 'Magrath',     hp: 58, ac: 17, atk: 5, dmg: { n: 1, s: 8, b: 3 }, arriveRound: 3 },
];

function d20() { return 1 + Math.floor(Math.random() * 20); }
function rollDmg(d) {
  let r = 0;
  for (let i = 0; i < d.n; i++) r += 1 + Math.floor(Math.random() * d.s);
  return r + (d.b ?? 0);
}

function resolveAttack(att, tgtAC) {
  const roll = d20();
  if (roll === 1) return { hit: false, damage: 0, critical: false };
  const crit = roll === 20;
  if (!crit && roll + att.atk < tgtAC) return { hit: false, damage: 0, critical: false };
  let dmg = rollDmg(att.dmg);
  if (crit) dmg += rollDmg(att.dmg);
  return { hit: true, damage: dmg, critical: crit };
}

function runEncounter(playerClass, partyKey) {
  const player = { ...CLASS[playerClass], hp: CLASS[playerClass].hp, dead: false };
  const allies = ALLIES.map((a) => ({ ...a, hp: a.hp, dead: false }));
  const enemies = ASSASSIN_PARTIES[partyKey].map((k) => ({ ...ENEMY[k], hp: ENEMY[k].hp, dead: false }));
  const friends = [player, ...allies];
  let rounds = 0;
  const maxRounds = 40;
  while (rounds < maxRounds) {
    rounds++;
    // Friendly side: each living friend who has arrived attacks first living enemy.
    for (const f of friends) {
      if (f.dead) continue;
      if (f.arriveRound !== undefined && rounds < f.arriveRound) continue;
      const tgt = enemies.find((e) => !e.dead);
      if (!tgt) {
        return { win: true, rounds, hpLeft: player.hp, hpRatio: player.hp / CLASS[playerClass].hp };
      }
      const r1 = resolveAttack(f, tgt.ac);
      if (r1.hit) {
        tgt.hp -= r1.damage;
        if (tgt.hp <= 0) tgt.dead = true;
      }
    }
    if (enemies.every((e) => e.dead)) {
      return { win: true, rounds, hpLeft: player.hp, hpRatio: player.hp / CLASS[playerClass].hp };
    }
    // Enemies: each living enemy attacks a random arrived+living friend (favouring player ~50%).
    for (const en of enemies) {
      if (en.dead) continue;
      const livingFriends = friends.filter((x) => !x.dead && (x.arriveRound === undefined || rounds >= x.arriveRound));
      if (livingFriends.length === 0) {
        return { win: false, rounds, hpLeft: 0, hpRatio: 0 };
      }
      // 50% chance target the player; otherwise spread among allies.
      let tgt;
      if (Math.random() < 0.5 && !player.dead) tgt = player;
      else {
        const otherFriends = livingFriends.filter((f) => f !== player);
        tgt = otherFriends.length > 0
          ? otherFriends[Math.floor(Math.random() * otherFriends.length)]
          : player;
      }
      const r2 = resolveAttack(en, tgt.ac);
      if (r2.hit) {
        tgt.hp -= r2.damage;
        if (tgt.hp <= 0) tgt.dead = true;
      }
    }
    if (player.dead) return { win: false, rounds, hpLeft: 0, hpRatio: 0 };
  }
  return { win: false, rounds: maxRounds, hpLeft: Math.max(0, player.hp), hpRatio: player.hp / CLASS[playerClass].hp };
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

const classes = Object.keys(CLASS);
const parties = Object.keys(ASSASSIN_PARTIES);

console.log(`Combat balance simulator (${trials} trials per cell, seed=${seed})\n`);
console.log('| Class   | ' + parties.map((p) => p.padEnd(24)).join(' | ') + ' |');
console.log('|---------|' + parties.map(() => '-'.repeat(26)).join('|') + '|');

for (const cls of classes) {
  const cells = [];
  for (const party of parties) {
    let wins = 0;
    const roundsList = [];
    const hpList = [];
    for (let i = 0; i < trials; i++) {
      const r = runEncounter(cls, party);
      if (r.win) wins++;
      roundsList.push(r.rounds);
      hpList.push(r.hpRatio);
    }
    const winPct = Math.round((wins / trials) * 100);
    const medR = median(roundsList);
    const medHp = Math.round(median(hpList) * 100);
    cells.push(`${String(winPct).padStart(3)}% win, r=${String(medR).padStart(2)}, hp=${String(medHp).padStart(3)}%`);
  }
  console.log(`| ${cls.padEnd(7)} | ${cells.map((c) => c.padEnd(24)).join(' | ')} |`);
}

console.log('\nLegend: winPct = playerVictory share, r = median rounds to outcome, hp = median end-of-fight HP fraction.');
console.log('Healthy range: 40-70% win rate, 5-12 rounds median, 20-60% hp left on win.');
