/**
 * Long Watch — entry.
 * Iter 2: full mansion level wired in. Player spawns in the Entry Hall.
 */
import * as THREE from 'three';
import { VoxelWorld } from './world';
import { PhysicsWorld } from './physics';
import { Player } from './player';
import { Character } from './character';
import { buildMansion, MAP_W, MAP_H, MAP_D } from './mansion';
import { rollPlot, rollObjectivesForParty, summarizeForPlayer, OBJECTIVES, BOSSES } from './plot';
import { GameClock } from './clock';
import { CAST, CastMember, CastId, applyPlotContext } from './cast';
import { Enemy, EnemyKind, enrichPresetsFromSRD } from './enemy';
import { spawnAssassin, SpawnedAssassinGroup } from './assassin';
import { rollDice, rollNd, rollFormula, rollAttackDamage } from './character';
import { CLASSES, ClassId, applyClass } from './classes';
import { buildClueProps, attemptClue, CluePropInstance } from './clues';
import { newResourcePool, secondWind, actionSurge, cunningAction, sneakAttackDamage, channelDivinityTurnUndead, SPELLS, STARTING_SPELLS, ResourcePool } from './actions';
import { placeMansionProps, interactWithProp, newPlayerWorldState, PropInstance, PlayerWorldState, isPickupable } from './props';
import { Inventory, ITEM_DEFS, newReputation, adjustRep, SHOP_INVENTORIES, OwnerId, ItemDef } from './inventory';
import { defaultRelationships, isHostile, adjustAttitude, ASSASSIN_FACTION } from './faction';
import { Companion, KARLA } from './companion';
import { WorldFeed } from './events';
import { Memory, formatMemoryForPrompt } from './memory';
import { ConsequenceStore, formatFlagsForPrompt } from './consequences';
import { buildCatacombs, Catacombs } from './catacombs';
import { currentSpot } from './schedules';
import { computeWitnesses, diffuseRumors } from './witnesses';
import { unlockAudio, play as playSfx, setAmbient } from './audio';
import { spawnBurst, tickParticles, bindParticleScene } from './particles';
import { attachFpHands, swingAnim, tickFpHands } from './fpHands';
import { resolveAttack, applyCombatFrame } from './combat';
import { getSeed, setSeed } from './rng';
import { startGameActor } from './gameState';
import { maybeJoinRoom, Multiplayer } from './multiplayer';
import { isVisibleOnFloor } from './fov';
import { setNavWorld } from './nav';
import * as CANNON from 'cannon-es';

const startBtn = document.getElementById('start-btn') as HTMLButtonElement | null;
const startScreen = document.getElementById('start-screen');
const clockEl = document.getElementById('clock');
const statsEl = document.getElementById('stats-panel');
const objEl = document.getElementById('objective-card');

// === Renderer ===
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14110d);
scene.fog = new THREE.FogExp2(0x14110d, 0.022);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

bindParticleScene(scene);
const ambientLight = new THREE.AmbientLight(0x556677, 0.5);
scene.add(ambientLight);
const hemiLight = new THREE.HemisphereLight(0x668899, 0x332211, 0.4);
scene.add(hemiLight);

// --- Iter 46: candle flicker + dawn dim/bright cycle ---
const candleLights: THREE.PointLight[] = [];
const candleSpots = [
  { x: 17.5, y: 2.5, z: 8,  c: 0xffaa55 }, // entry hall
  { x: 6,    y: 2.5, z: 8,  c: 0xffaa55 }, // study
  { x: 42,   y: 2.5, z: 7,  c: 0xffaa55 }, // kitchen
  { x: 30,   y: 7.4, z: 22, c: 0xffaa55 }, // library
  { x: 27.5, y: 7.4, z: 10, c: 0xffaa55 }, // wallace bedroom
  { x: 40,   y: 2.5, z: 38, c: 0xffaa55 }, // courtyard
];
for (const s of candleSpots) {
  const l = new THREE.PointLight(s.c, 0.8, 7, 1.8);
  l.position.set(s.x, s.y, s.z);
  scene.add(l);
  candleLights.push(l);
}
function tickCandles(dt: number) {
  for (const l of candleLights) {
    // Stochastic flicker: small random walk around baseline 0.8.
    const noise = (Math.random() - 0.5) * 0.4;
    l.intensity = Math.max(0.35, Math.min(1.1, l.intensity + noise * dt * 4));
  }
}
function tickDawnDim() {
  // Sky brightens gradually after the dawn flag fires.
  if (consequences.has('dawn_reached')) {
    ambientLight.intensity = Math.min(1.5, ambientLight.intensity + 0.0005);
    hemiLight.intensity = Math.min(1.2, hemiLight.intensity + 0.0004);
  }
}

// === World + Physics + Mansion ===
const world = new VoxelWorld(MAP_W, MAP_H, MAP_D);
const physics = new PhysicsWorld();
const mansion = buildMansion(world, physics, scene);
scene.add(world.group);
// Register the world for NPC A* navigation (cast.ts / enemy.ts / companion.ts).
setNavWorld(world);

// === Player ===
const player = new Player(camera, physics, world);
player.setPosition(mansion.spawnPoint.x, mansion.spawnPoint.y, mansion.spawnPoint.z);
scene.add(player.yaw);

// === Cast members ===
const castMembers: CastMember[] = (Object.keys(CAST) as CastId[]).map(id => new CastMember(CAST[id], scene, physics));

// === Commoners (atmosphere; no AI dialogue, no schedules) ===
// Three procedurally-named figures milling about the courtyard. Static so they
// don't tangle with cast AI, but they have name sprites for ambience.
{
  const courtyardSpots = [
    { x: 12, z: 35 },
    { x: 17, z: 41 },
    { x: 21, z: 38 },
  ];
  for (const spot of courtyardSpots) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.7, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.85 }),
    );
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.32),
      new THREE.MeshStandardMaterial({ color: 0xddbb99 }),
    );
    head.position.y = 0.5;
    g.add(head);
    const name = (window as { __names?: { commonerName?: () => string } }).__names?.commonerName?.() ?? 'Stranger';
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ccc'; ctx.font = '22px serif'; ctx.textAlign = 'center';
      ctx.fillText(name, 100, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.position.y = 1.2;
    sprite.scale.set(1.2, 0.3, 1);
    g.add(sprite);
    g.position.set(spot.x, 1.4, spot.z);
    scene.add(g);
  }
}

// === Clue props ===
const clueProps: CluePropInstance[] = buildClueProps(scene);

// === Mansion props ===
const props: PropInstance[] = placeMansionProps(scene, physics);
const worldState: PlayerWorldState = newPlayerWorldState();
const inventory = new Inventory();
const reputation = newReputation();
const factionRel = defaultRelationships();
const companions: Companion[] = [
  new Companion(KARLA, mansion.spawnPoint.x - 1.5, mansion.spawnPoint.y, mansion.spawnPoint.z - 1.5, scene, physics),
];

interface ThrowableProjectile {
  body: CANNON.Body;
  mesh: THREE.Mesh;
  def: ItemDef;
  ageMs: number;
  alive: boolean;
}
let throwables: ThrowableProjectile[] = [];

function findThrowableItem(): string | null {
  // Find first throwable in inventory
  for (const s of inventory.stacks) {
    const d = ITEM_DEFS[s.defId];
    if (d?.throwable) return s.defId;
  }
  return null;
}

function throwItem(defId: string) {
  const def = ITEM_DEFS[defId];
  if (!def?.throwable) { logCombat('That item cannot be thrown.'); return; }
  if (!inventory.remove(defId, 1)) return;
  const eye = player.getEyePosition();
  const dir = player.getLookDirection();
  // Spawn slightly in front to avoid self-collision
  const spawn = eye.clone().add(dir.clone().multiplyScalar(0.5));
  const body = physics.addDynamicSphere(spawn.x, spawn.y, spawn.z, 0.1, 0.4);
  body.linearDamping = 0.05;
  // Velocity = look dir * 16 m/s + slight upward lift
  const speed = 16;
  body.velocity.set(dir.x * speed, dir.y * speed + 2, dir.z * speed);

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshStandardMaterial({ color: def.throwColor ?? 0x884422, emissive: def.throwColor ?? 0x884422, emissiveIntensity: 0.1 }),
  );
  mesh.position.copy(spawn);
  scene.add(mesh);
  throwables.push({ body, mesh, def, ageMs: 0, alive: true });
  logCombat(`You hurl ${def.name}.`);
}

function updateThrowables(dtSeconds: number) {
  let anyHit = false;
  for (const t of throwables) {
    if (!t.alive) continue;
    t.ageMs += dtSeconds * 1000;
    t.mesh.position.set(t.body.position.x, t.body.position.y, t.body.position.z);

    const dice = t.def.damageThrown ?? '1d3';
    const rollDmg = () => Math.max(1, rollFormula(dice));
    // Enemy collision
    if (assassinGroup) {
      for (const en of assassinGroup.enemies) {
        if (en.isDead) continue;
        const dx = en.body.position.x - t.body.position.x;
        const dy = en.body.position.y + 0.4 - t.body.position.y;
        const dz = en.body.position.z - t.body.position.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 0.55) {
          const dmg = rollDmg();
          en.takeHit(dmg);
          logCombat(`Your thrown ${t.def.name} hits ${en.preset.name} for ${dmg}!`);
          if (en.isDead) { logCombat(`${en.preset.name} falls.`); en.destroy(scene, physics); }
          anyHit = true;
          t.alive = false;
          scene.remove(t.mesh);
          try { physics.removeBody(t.body); } catch {}
          break;
        }
      }
    }
    // Cast collision
    if (t.alive) {
      for (const cm of castMembers) {
        if (cm.isDead) continue;
        const dx = cm.body.position.x - t.body.position.x;
        const dy = cm.body.position.y + 0.4 - t.body.position.y;
        const dz = cm.body.position.z - t.body.position.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < 0.55) {
          const dmg = rollDmg();
          logCombat(`Your thrown ${t.def.name} strikes ${cm.def.displayName}!`);
          handleCastDamage(cm, dmg, true);
          t.alive = false;
          scene.remove(t.mesh);
          try { physics.removeBody(t.body); } catch {}
          break;
        }
      }
    }
    // Timeout / fall through floor
    if (t.alive && (t.ageMs > 4000 || t.body.position.y < -2)) {
      t.alive = false;
      scene.remove(t.mesh);
      try { physics.removeBody(t.body); } catch {}
    }
  }
  if (throwables.some(t => !t.alive)) throwables = throwables.filter(t => t.alive);
  if (anyHit && assassinGroup && assassinGroup.enemies.every(e => e.isDead)) {
    triggerEnding('assassin_defeated');
  }
}

/**
 * Run AI for every cast member.
 * Determines per-NPC threat list based on faction relations:
 *   - Assassins are threats to fletcher_house cast (they'll fight if able, else flee)
 *   - Player is a threat if fletcher_house is hostile to player_party
 */
function tickCastAi(dt: number) {
  if (!started || endingShown) return;
  const playerPos = player.getPosition();

  // Build a generic threat list once per tick
  const enemyThreats = (assassinGroup?.enemies ?? []).filter(e => !e.isDead).map(e => ({
    pos: { x: e.body.position.x, y: e.body.position.y, z: e.body.position.z },
    ac: character.ac, // unused for enemy targeting back-to-us; AC of target = my AC? we pass enemy AC instead
    isAssassin: true,
    isPlayer: false,
    deal: (dmg: number) => e.takeHit(dmg),
  }));
  // Build enemy threats with correct AC
  const properEnemyThreats = (assassinGroup?.enemies ?? []).filter(e => !e.isDead).map(e => ({
    pos: { x: e.body.position.x, y: e.body.position.y, z: e.body.position.z },
    ac: e.preset.ac,
    isAssassin: true,
    isPlayer: false,
    deal: (dmg: number) => {
      e.takeHit(dmg);
      if (e.isDead) { logCombat(`${e.preset.name} falls.`); e.destroy(scene, physics); }
    },
  }));
  // Player threat — only present if fletcher_house is hostile to player_party
  const playerThreat = isHostile(factionRel, 'fletcher_house', 'player_party') ? [{
    pos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
    ac: character.ac,
    isAssassin: false,
    isPlayer: true,
    deal: (dmg: number) => { character.takeDamage(dmg); logCombat(`A household defender hits you for ${dmg}.`); renderStats(); },
  }] : [];

  const fleeAnchor = mansion.matriarchSpot;

  for (const cm of castMembers) {
    if (cm.isDead) continue;

    // State transitions based on environment:
    // 1. If alarmed state + close enemy assassin -> switch fighters to fighting, flee-ers to fleeing
    if (assassinGroup && assassinGroup.enemies.some(e => !e.isDead)) {
      // Distance to nearest assassin
      let nearest = Infinity;
      for (const e of assassinGroup.enemies) {
        if (e.isDead) continue;
        const dx = e.body.position.x - cm.body.position.x;
        const dz = e.body.position.z - cm.body.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < nearest) nearest = d;
      }
      if (nearest < 12) {
        if (cm.aiState === 'idle' || cm.aiState === 'alarmed') {
          if (cm.def.reactionOnPlayerAttack === 'fight') cm.aiState = 'fighting';
          else if (cm.def.id === 'heir') cm.aiState = 'fleeing';
          else cm.aiState = 'fleeing';
        }
      }
    }

    // Pick threats: assassins always; player too if hostile
    let threats = properEnemyThreats;
    if (cm.aiState === 'fighting' && playerThreat.length > 0) {
      threats = [...properEnemyThreats, ...playerThreat];
    }

    cm.updateAi(dt, playerPos, character.ac, threats, fleeAnchor, {
      d20: () => rollDice(20),
      rollDice: (formula: string) => Math.max(0, rollFormula(formula)),
    });

    // Schedule drift: if NPC is idle (no combat / no alarm) and the scheduled
    // spot is far, walk toward it. Uses the nav system on entity side via
    // direct velocity override (cast.updateAi sets zero in idle).
    if (cm.aiState === 'idle') {
      const spot = currentSpot(cm.def.id, gameClock.state.currentMinute);
      if (spot) {
        const dx = spot.x - cm.body.position.x;
        const dz = spot.z - cm.body.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d > 1.5) {
          const v = cm.def.combatStats.speed * 0.25;
          cm.body.velocity.x = (dx / d) * v;
          cm.body.velocity.z = (dz / d) * v;
          cm.group.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
  }

  // Death check on player
  if (character.isDead() && !endingShown) triggerEnding('player_dead');
}

function lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const steps = Math.ceil(Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2) * 3);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    const z = Math.floor(az + (bz - az) * t);
    if (world.isOpaque(x, y, z)) return false;
  }
  return true;
}

function witnessCheck(stealthTotal: number, ownerId: OwnerId): { caught: boolean; witnessName?: string } {
  const pos = player.getPosition();
  // The owner of the item is the strongest witness if nearby. Other NPCs check too.
  for (const cm of castMembers) {
    if (cm.def.id === 'gardener') continue; // gardener is outside
    if (cm.isDead) continue;
    const npcP = cm.body.position;
    const dist = Math.sqrt((pos.x - npcP.x) ** 2 + (pos.y - npcP.y) ** 2 + (pos.z - npcP.z) ** 2);
    if (dist > 12) continue;
    // Raycast LOS through voxels (3D-correct).
    if (!lineOfSight(pos.x, pos.y + 1.5, pos.z, npcP.x, npcP.y + 1.4, npcP.z)) continue;
    // Shadow-cast LOS + cone-of-vision on the NPC's floor slice.
    // NPC facing direction is encoded by group.rotation.y (atan2(dx,dz)).
    const facingY = cm.group.rotation.y;
    const facing = { dx: Math.sin(facingY), dz: Math.cos(facingY), coneRad: Math.PI * 0.55 }; // ~100deg cone
    if (!isVisibleOnFloor(world, npcP.x, npcP.z, pos.x, pos.z, npcP.y + 1.4, 12, facing)) continue;
    // Stand-in passive perception: 10 + WIS mod (estimated). Take 10 + 2 = 12.
    const perception = 12 + (cm.def.id === ownerId ? 3 : 0); // owner is more vigilant
    if (stealthTotal < perception) {
      return { caught: true, witnessName: cm.def.displayName };
    }
  }
  return { caught: false };
}

function nearestProp(): PropInstance | null {
  const pos = player.getPosition();
  let best: PropInstance | null = null;
  let bestDist = 1.6;
  for (const p of props) {
    if (p.consumed && (p.kind === 'bottle_wine' || p.kind === 'bottle_brandy' || p.kind === 'plate_food' || p.kind === 'ruby_necklace')) continue;
    const dx = pos.x - p.position.x;
    const dz = pos.z - p.position.z;
    const dy = pos.y - p.position.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
    if (d < bestDist) { best = p; bestDist = d; }
  }
  return best;
}

function nearestClue(): CluePropInstance | null {
  const pos = player.getPosition();
  let best: CluePropInstance | null = null;
  let bestDist = 2.0;
  for (const c of clueProps) {
    const dx = pos.x - c.mesh.position.x;
    const dz = pos.z - c.mesh.position.z;
    const dy = pos.y - c.mesh.position.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
    if (d < bestDist) { best = c; bestDist = d; }
  }
  return best;
}

// === Character + class picker ===
const character = new Character('Adventurer');
let chosenClass: ClassId = 'fighter';

function renderClassPicker() {
  const picker = document.getElementById('class-picker');
  if (!picker) return;
  let html = '';
  for (const cls of Object.values(CLASSES)) {
    const sel = cls.id === chosenClass ? ' selected' : '';
    html += `<div class="class-card${sel}" data-cls="${cls.id}">` +
      `<h3>${cls.name}</h3>` +
      `<div class="cls-desc">${cls.description}</div>` +
      `<div class="cls-stats">HP ${cls.hitDie + Math.floor(cls.hitDie / 2) * 3 + 6 + 4 * modCONmod(cls.stats.con)} · AC ${cls.ac} · ${cls.primary.toUpperCase()} ${cls.stats[cls.primary]}</div>` +
      `</div>`;
  }
  picker.innerHTML = html;
  picker.querySelectorAll('.class-card').forEach((el) => {
    el.addEventListener('click', () => {
      chosenClass = (el as HTMLElement).dataset.cls as ClassId;
      renderClassPicker();
    });
  });
}
function modCONmod(con: number) { return Math.floor((con - 10) / 2); }
applyClass(character, CLASSES[chosenClass]);
renderClassPicker();

function renderStats() {
  if (!statsEl) return;
  const s = character.stats;
  statsEl.innerHTML =
    `<b style="color:#fc4">${character.name}</b> Lv${character.level}<br>` +
    `<span style="color:#aaa">STR</span> <span style="color:#fc4">${s.str}</span> ` +
    `<span style="color:#aaa">DEX</span> <span style="color:#fc4">${s.dex}</span> ` +
    `<span style="color:#aaa">CON</span> <span style="color:#fc4">${s.con}</span><br>` +
    `<span style="color:#aaa">HP</span> <span style="color:#6cf">${character.hp}/${character.maxHp}</span> ` +
    `<span style="color:#aaa">AC</span> <span style="color:#6cf">${character.ac}</span>`;
}
renderStats();

// === Plot: roll the night ===
const plot = rollPlot();
applyPlotContext(CAST, plot.twists, plot.boss); // mutate cast personas based on rolled plot
const playerId = 'player-1';
const partyObjectives = rollObjectivesForParty([playerId]);
const myObjective = partyObjectives[0];
const summary = summarizeForPlayer(plot, myObjective.objective);

function renderObjectiveCard() {
  if (!objEl) return;
  const obj = summary.myObjective;
  let html = `<h4>SECRET OBJECTIVE</h4>` +
    `<div class="obj-name">${obj.name}</div>` +
    `<div class="obj-text">${obj.description}</div>`;
  if (summary.leakedBoss) {
    html += `<div style="margin-top:6px;color:#fa6;border-top:1px solid #553;padding-top:4px"><b>You know:</b> ${summary.leakedBoss.name}</div>`;
  }
  if (summary.leakedAssassin) {
    html += `<div style="margin-top:6px;color:#fa6;border-top:1px solid #553;padding-top:4px"><b>You know:</b> ${summary.leakedAssassin.name}</div>`;
  }
  html += `<div style="margin-top:8px;color:#666;font-size:10px">seed: ${getSeed()}</div>`;
  objEl.innerHTML = html;
}
renderObjectiveCard();
console.log('[Long Watch] Plot rolled:', {
  bossRoll: plot.bossRoll, boss: plot.boss,
  assassinRoll: plot.assassinRoll, assassin: plot.assassin,
  twistRolls: plot.twistRolls, twists: plot.twists,
  arrivalMinute: plot.assassinArrivalMinute,
  myObjective: myObjective.objective,
});

// === Game clock ===
let started = false;
const gameClock = new GameClock(plot.assassinArrivalMinute);

function paintClock() {
  if (!clockEl) return;
  clockEl.textContent = gameClock.formatted();
  if (gameClock.state.inCombat) clockEl.style.borderColor = '#f44';
  else clockEl.style.borderColor = '#555';
}
paintClock();

let assassinGroup: SpawnedAssassinGroup | null = null;
const combatLog: string[] = [];
const memory = new Memory();
const consequences = new ConsequenceStore();
const gameActor = startGameActor((snap) => console.log('[gameState]', snap.value));
// Opt-in P2P via ?room=NAME URL param. Null when single-player.
const mp: Multiplayer | null = maybeJoinRoom(scene);
if (mp) mp.onChat((peerId, text) => logCombat(`[peer ${peerId.slice(0, 4)}] ${text}`));
/** Backwards-compat alias for code that still reads the raw feed (e.g. save/load). */
const worldFeed: WorldFeed = memory.feed;
/** Log to UI combat log AND chronicle to long-term memory (public visibility). For targeted events use memory.addEvent with a CastId[] visibility. */
function logCombat(line: string) {
  combatLog.push(line);
  console.log('[Long Watch]', line);
  const el = document.getElementById('combat-log');
  if (el) el.innerHTML = combatLog.slice(-8).map(l => `<div>${l}</div>`).join('');
  memory.addEvent(line, gameClock.state.currentMinute, 'public');
}

gameClock.onTick = (e) => {
  paintClock();
  if (e.triggerWarning) {
    logCombat('A chill runs through the manor. Something draws near.');
    consequences.set('assassin_arrival_imminent', true, gameClock.state.currentMinute);
    dispatchOffscreenBeat('warning');
    gameActor.send({ type: 'WARNING' });
    autoSave('warning');
  }
  if (e.triggerAssassin) {
    assassinGroup = spawnAssassin(plot.assassin, scene, physics, mansion);
    logCombat(assassinGroup.flavor);
    plot.revealed.assassin = true;
    consequences.set('assassin_arrived', true, gameClock.state.currentMinute);
    consequences.set('assassin_kind', plot.assassin, gameClock.state.currentMinute);
    renderObjectiveCard();
    dispatchOffscreenBeat('assassin_arrived');
    playSfx('door_burst');
    setAmbient('combat');
    gameActor.send({ type: 'ASSASSIN_ARRIVED' });
    autoSave('assassin_arrived');
  }
  if (e.triggerDawn) {
    logCombat('Dawn breaks. The Heir survives.');
    consequences.set('dawn_reached', true, gameClock.state.currentMinute);
    playSfx('dawn_bell');
    gameActor.send({ type: 'DAWN' });
    triggerEnding('heir_alive_dawn');
  }
};

/** Track room entries to fire enter_room cost on threshold crossing. */
let lastLandmarkId: string | null = null;
function detectRoomEntry() {
  if (!started || gameClock.state.inCombat || gameClock.state.done) return;
  const pos = player.getPosition();
  let nearest: string | null = null;
  let nearestDist = Infinity;
  for (const lm of Object.values(mansion.landmarks)) {
    const dx = pos.x - (lm.x + 0.5);
    const dz = pos.z - (lm.z + 0.5);
    const expectedFloorY = lm.floor === 1 ? 1.5 : 6.5;
    const dy = pos.y - expectedFloorY;
    const d2 = dx * dx + dz * dz + dy * dy * 0.5;
    if (d2 < nearestDist) { nearestDist = d2; nearest = lm.id; }
  }
  if (nearest && nearest !== lastLandmarkId && nearestDist < 50) {
    lastLandmarkId = nearest;
    gameClock.advance('enter_room');
    // Iter 46: swap ambient by room family. Best-effort fuzzy match on landmark id.
    if (inCatacombs) setAmbient('catacombs');
    else if (gameClock.state.inCombat) setAmbient('combat');
    else if (/study|library|bedroom/i.test(nearest)) setAmbient('study');
    else if (/kitchen|cook|dining/i.test(nearest)) setAmbient('kitchen');
    else if (/courtyard|garden|outside|herb/i.test(nearest)) setAmbient('courtyard');
    else if (/cellar|storage|basement/i.test(nearest)) setAmbient('cellar');
    else setAmbient('study');
  }
}

let resourcePool: ResourcePool = newResourcePool(chosenClass);
let learnedSpells: string[] = STARTING_SPELLS[chosenClass];
/** Index of currently selected spell for cast. */
let activeSpellIdx = 0;

// Kick off SRD enrichment in parallel with the user reading the intro screen.
// Spawned enemies (assassin arrival is minutes into the game) will see the canonical stats.
void enrichPresetsFromSRD().catch((e) => console.warn('[SRD] enrichment skipped:', e));

startBtn?.addEventListener('click', () => {
  if (started) return;
  applyClass(character, CLASSES[chosenClass]);
  character.name = CLASSES[chosenClass].name;
  resourcePool = newResourcePool(chosenClass);
  learnedSpells = STARTING_SPELLS[chosenClass];
  activeSpellIdx = 0;
  renderStats();
  renderActionBar();
  started = true;
  attachFpHands(camera, chosenClass);
  gameActor.send({ type: 'START' });
  startScreen!.style.display = 'none';
  renderer.domElement.requestPointerLock();
});

function renderInventoryPanel() {
  const el = document.getElementById('inv-panel');
  if (!el) return;
  let html = '<h4>INVENTORY</h4>' +
    `<div class="inv-line gold-line"><span>Gold</span><span>${inventory.gold} gp</span></div>`;
  if (inventory.stacks.length === 0) {
    html += '<div style="color:#888">(empty)</div>';
  } else {
    for (const s of inventory.stacks) {
      const def = ITEM_DEFS[s.defId];
      if (!def) continue;
      const countStr = def.stackable ? ` x${s.count}` : '';
      html += `<div class="inv-line"><span>${def.name}${countStr}</span><span style="color:#888">${def.value}gp</span></div>`;
    }
  }
  el.innerHTML = html;
}
renderInventoryPanel();

let shopActiveNpc: CastMember | null = null;
function openShop(cm: CastMember) {
  const offers = SHOP_INVENTORIES[cm.def.id];
  if (!offers || offers.length === 0) {
    logCombat(`${cm.def.displayName} has nothing to sell.`);
    return;
  }
  shopActiveNpc = cm;
  document.exitPointerLock?.();
  renderShop();
}
function closeShop() {
  shopActiveNpc = null;
  document.getElementById('shop-panel')!.classList.remove('active');
  setTimeout(() => renderer.domElement.requestPointerLock(), 100);
}
function renderShop() {
  const panel = document.getElementById('shop-panel')!;
  if (!shopActiveNpc) { panel.classList.remove('active'); return; }
  const offers = SHOP_INVENTORIES[shopActiveNpc.def.id] || [];
  let html = `<h3>${shopActiveNpc.def.displayName} — Shop</h3>` +
    `<div style="margin-bottom:10px"><span class="shop-gold">Your gold: ${inventory.gold} gp</span></div>`;
  for (const offer of offers) {
    const def = ITEM_DEFS[offer.itemId];
    if (!def) continue;
    const canAfford = inventory.gold >= offer.price && offer.stock !== 0;
    html += `<div class="shop-row">` +
      `<div><b>${def.name}</b><br><span style="color:#888;font-size:11px">${offer.stock < 0 ? '∞' : offer.stock} in stock</span></div>` +
      `<div style="text-align:right"><div class="shop-gold">${offer.price} gp</div>` +
      `<button class="shop-buy" data-item="${offer.itemId}" ${!canAfford ? 'disabled' : ''}>Buy</button></div>` +
      `</div>`;
  }
  html += `<button class="shop-close">Close (Esc)</button>`;
  panel.innerHTML = html;
  panel.classList.add('active');
  panel.querySelectorAll('.shop-buy').forEach((b) => {
    b.addEventListener('click', () => {
      const itemId = (b as HTMLElement).dataset.item!;
      const offer = offers.find(o => o.itemId === itemId);
      if (!offer || inventory.gold < offer.price || offer.stock === 0) return;
      inventory.gold -= offer.price;
      if (offer.stock > 0) offer.stock--;
      inventory.add(itemId);
      adjustRep(reputation, shopActiveNpc!.def.id, 2);
      logCombat(`Bought ${ITEM_DEFS[itemId].name} for ${offer.price} gp.`);
      renderShop();
      renderInventoryPanel();
    });
  });
  panel.querySelector('.shop-close')?.addEventListener('click', () => closeShop());
}

function renderActionBar() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const buttons: { key: string; name: string; meta: string; disabled: boolean; onclick: () => void }[] = [];

  if (chosenClass === 'fighter') {
    buttons.push({
      key: 'Y', name: 'Second Wind', meta: `${resourcePool.secondWindLeft}/1`,
      disabled: resourcePool.secondWindLeft <= 0,
      onclick: () => { const r = secondWind(resourcePool, character); r.log.forEach(logCombat); renderStats(); renderActionBar(); },
    });
    buttons.push({
      key: 'U', name: 'Action Surge', meta: `${resourcePool.actionSurgeLeft}/1`,
      disabled: resourcePool.actionSurgeLeft <= 0,
      onclick: () => { const r = actionSurge(resourcePool); r.log.forEach(logCombat); renderActionBar(); },
    });
  }
  if (chosenClass === 'rogue') {
    buttons.push({
      key: 'B', name: 'Cunning Action', meta: 'bonus',
      disabled: false,
      onclick: () => { const r = cunningAction(); r.log.forEach(logCombat); },
    });
    buttons.push({
      key: 'V', name: 'Sneak Attack', meta: 'on hit',
      disabled: false,
      onclick: () => { logCombat('Sneak Attack readied — your next hit with advantage adds 2d6.'); sneakReady = true; },
    });
  }
  if (chosenClass === 'cleric') {
    buttons.push({
      key: 'Y', name: 'Turn Undead', meta: `${resourcePool.channelDivinityLeft}/1`,
      disabled: resourcePool.channelDivinityLeft <= 0,
      onclick: () => {
        const enemies = assassinGroup ? assassinGroup.enemies.filter(e => !e.isDead) : [];
        const r = channelDivinityTurnUndead(resourcePool, character, enemies);
        r.log.forEach(logCombat);
        renderActionBar();
      },
    });
  }

  // Spells for wizard/cleric
  for (let i = 0; i < learnedSpells.length; i++) {
    const sp = SPELLS[learnedSpells[i]];
    if (!sp) continue;
    const key = (i + 1).toString();
    const slotInfo = sp.level === 0 ? 'cantrip' : `L${sp.level} (${resourcePool.spellSlots[sp.level - 1] ?? 0}/${resourcePool.spellSlotsMax[sp.level - 1] ?? 0})`;
    buttons.push({
      key, name: sp.name, meta: slotInfo,
      disabled: sp.level > 0 && (resourcePool.spellSlots[sp.level - 1] ?? 0) <= 0,
      onclick: () => castSpellByIndex(i),
    });
  }

  let html = '';
  for (const b of buttons) {
    html += `<button class="ab-btn${b.disabled ? ' disabled' : ''}" data-id="${b.name}">` +
      `<span class="ab-key">${b.key}</span>` +
      `<span class="ab-name">${b.name}</span>` +
      `<span class="ab-meta">${b.meta}</span>` +
      `</button>`;
  }
  bar.innerHTML = html;
  const btns = bar.querySelectorAll('.ab-btn');
  buttons.forEach((b, i) => {
    btns[i]?.addEventListener('click', () => { if (!b.disabled) b.onclick(); });
  });
}

let sneakReady = false;

function castSpellByIndex(idx: number) {
  const id = learnedSpells[idx];
  if (!id) return;
  const sp = SPELLS[id];
  if (!sp) return;
  // Find nearest enemy as target if there is combat
  let target = null as null | import('./enemy').Enemy;
  if (assassinGroup) {
    const pos = player.getPosition();
    let bestDist = 20;
    for (const en of assassinGroup.enemies) {
      if (en.isDead) continue;
      const dx = en.body.position.x - pos.x;
      const dz = en.body.position.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestDist) { target = en; bestDist = d; }
    }
  }
  const result = sp.cast(character, resourcePool, target);
  result.log.forEach(logCombat);
  if (target && target.isDead) {
    logCombat(`${target.preset.name} falls.`);
    target.destroy(scene, physics);
    if (assassinGroup && assassinGroup.enemies.every(e => e.isDead)) triggerEnding('assassin_defeated');
  }
  renderStats();
  renderActionBar();
}

renderer.domElement.addEventListener('click', () => {
  if (started && !document.pointerLockElement) renderer.domElement.requestPointerLock();
  void unlockAudio();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Dialogue / interaction ===
const interactHint = document.getElementById('interact-hint')!;
const dialoguePanel = document.getElementById('dialogue-panel')!;
let inDialogueWith: CastMember | null = null;
let streamingReply = false;

function nearestCastMember(): CastMember | null {
  const pos = player.getPosition();
  let best: CastMember | null = null;
  let bestDist = 3.0; // interaction range
  for (const cm of castMembers) {
    const p = cm.body.position;
    const dx = pos.x - p.x;
    const dz = pos.z - p.z;
    const dy = pos.y - p.y;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
    if (d < bestDist) { best = cm; bestDist = d; }
  }
  return best;
}

function updateInteractHint() {
  if (!started || inDialogueWith) {
    interactHint.style.display = 'none';
    return;
  }
  const clue = nearestClue();
  if (clue) {
    interactHint.textContent = `[E] Examine ${clue.def.label}`;
    interactHint.style.display = 'block';
    return;
  }
  const prop = nearestProp();
  if (prop) {
    const verb = propActionVerb(prop);
    const willSteal = isPickupable(prop) && prop.owner !== 'player' && prop.owner !== 'unclaimed' &&
      !(prop.owner === 'house' && prop.kind !== 'ruby_necklace');
    const ownership = willSteal ? ` <span style="color:#f55">[STEAL · owner: ${prop.owner}]</span>` : '';
    interactHint.innerHTML = `[E] ${verb} ${prop.label}${ownership}`;
    interactHint.style.display = 'block';
    return;
  }
  const nearest = nearestCastMember();
  if (nearest) {
    const hasShop = !!SHOP_INVENTORIES[nearest.def.id];
    const shopHint = hasShop ? ' · [T] shop' : '';
    interactHint.textContent = `[E] Speak with ${nearest.def.displayName}${shopHint}`;
    interactHint.style.display = 'block';
  } else {
    interactHint.style.display = 'none';
  }
}

function propActionVerb(p: PropInstance): string {
  switch (p.kind) {
    case 'chair':              return 'Sit at';
    case 'bottle_wine':
    case 'bottle_brandy':      return 'Drink';
    case 'plate_food':         return 'Eat from';
    case 'book':               return 'Read';
    case 'crate':              return 'Search';
    case 'chest_locked':       return 'Pick lock on';
    case 'ruby_necklace':      return 'Take';
    case 'weapon_rack':        return 'Examine';
    case 'cooking_pot':
    case 'pots_kitchen':       return 'Inspect';
    case 'candelabra':         return 'Take';
    case 'vase':               return 'Take';
    case 'painting':
    case 'pillow':             return 'Examine';
    default:                   return 'Use';
  }
}

function openDialogue(cm: CastMember) {
  inDialogueWith = cm;
  document.exitPointerLock?.();
  renderDialogue();
}

function closeDialogue() {
  inDialogueWith = null;
  dialoguePanel.classList.remove('active');
  dialoguePanel.innerHTML = '';
  setTimeout(() => renderer.domElement.requestPointerLock(), 100);
}

function renderDialogue() {
  if (!inDialogueWith) return;
  const cm = inDialogueWith;
  let html = `<div class="dlg-name">${cm.def.displayName}</div>` +
             `<div class="dlg-stream" id="dlg-stream">${cm.history.length === 0 ? '<i style="color:#888">(say something)</i>' : ''}</div>`;
  for (const turn of cm.history.slice(-6)) {
    const cls = turn.role === 'user' ? 'dlg-history-line you' : 'dlg-history-line';
    const speaker = turn.role === 'user' ? 'You' : cm.def.displayName;
    html += `<div class="${cls}"><b>${speaker}:</b> ${escapeHtml(turn.content)}</div>`;
  }
  html += `<div class="dlg-row">` +
    `<input id="dlg-input" type="text" placeholder="Ask anything... (Esc to leave)" maxlength="200" autocomplete="off" />` +
    `<button id="dlg-send">Send</button>` +
    `</div>` +
    `<div class="dlg-hint">In-character chat. AI-driven via Groq.</div>`;
  dialoguePanel.innerHTML = html;
  dialoguePanel.classList.add('active');

  const sendBtn = document.getElementById('dlg-send');
  const inp = document.getElementById('dlg-input') as HTMLInputElement | null;
  if (sendBtn && inp) {
    const submit = () => {
      const txt = inp.value.trim();
      if (!txt || streamingReply) return;
      inp.value = '';
      streamReply(txt);
    };
    sendBtn.addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeDialogue(); }
      else e.stopPropagation();
    });
    setTimeout(() => inp.focus(), 60);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

async function streamReply(message: string) {
  if (!inDialogueWith) return;
  const cm = inDialogueWith;
  const rep = reputation.withNpc[cm.def.id] ?? 0;
  // Hard rep gate: if NPC actively hostile or rep <= -50, refuse to talk
  if (rep <= -50 || (isHostile(factionRel, 'fletcher_house', 'player_party') && cm.faction === 'fletcher_house')) {
    const stream = document.getElementById('dlg-stream');
    if (stream) stream.textContent = `${cm.def.displayName}: "Get out of my sight."`;
    return;
  }
  cm.pushHistory('user', message);
  // Player-told info: scoped to this NPC's memory so it sticks across the night,
  // and so rumor diffusion can propagate it from this NPC to others on contact.
  memory.addEvent(`[told by player] ${message.slice(0, 200)}`, gameClock.state.currentMinute, [cm.def.id]);
  gameClock.advance('ai_chat_turn');

  streamingReply = true;
  const stream = document.getElementById('dlg-stream');
  if (stream) stream.textContent = `${cm.def.displayName}: `;
  let acc = '';

  try {
    let attitudeContext = '';
    if (rep <= -25) attitudeContext = `Current attitude toward player: COLD / DISTRUSTFUL (rep ${rep}). You are guarded, terse, less helpful.`;
    else if (rep >= 25) attitudeContext = `Current attitude toward player: WARM / FRIENDLY (rep ${rep}).`;
    else attitudeContext = `Current attitude toward player: NEUTRAL (rep ${rep}).`;
    if (reputation.alarmed) attitudeContext += ' The household is ON ALARM tonight (intrusion or theft has occurred).';

    const personaWithRep = cm.def.persona.persona + '\n\nCURRENT MOOD CONTEXT: ' + attitudeContext;
    const currentMinute = gameClock.state.currentMinute;
    const memoryItems = memory.relevantFor(cm.def.id, message, currentMinute, 8);
    const eventsBlock = formatMemoryForPrompt(memoryItems);
    const currentTime = gameClock.formatted();
    // Per-NPC top-2 reflections injected separately so the model sees the
    // distilled "voice" before raw events (Bobby-Gray pattern #1).
    const topReflections = (memory.reflections.get(cm.def.id) ?? [])
      .slice(-2)
      .map(r => `- ${r.text}`)
      .join('\n');
    // Consequence flags this NPC knows about.
    const flagsKnown = consequences.knownBy(cm.def.id);
    const flagsBlock = formatFlagsForPrompt(flagsKnown);
    // Kick a reflection if this NPC has accumulated enough new events. Fire-and-forget.
    memory.maybeReflect(cm.def.id, cm.def.displayName, cm.def.persona.persona, currentMinute);
    // Consolidate older reflections into a summary when the list grows. Fire-and-forget.
    memory.maybeConsolidate(cm.def.id, cm.def.displayName, cm.def.persona.persona, currentMinute);

    const resp = await fetch('/api/npc-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcName: cm.def.displayName,
        persona: personaWithRep,
        backstory: cm.def.persona.backstory,
        positionTonight: cm.def.persona.positionTonight,
        motivation: cm.def.persona.motivation,
        dailyRoutine: cm.def.persona.dailyRoutine,
        relationships: cm.def.persona.relationships,
        knownFacts: cm.def.persona.knownFacts,
        hiddenFacts: cm.def.persona.hiddenFacts,
        speechStyle: cm.def.persona.speechStyle,
        voiceSamples: cm.def.persona.voiceSamples,
        recentEvents: eventsBlock,
        topReflections,
        worldFlags: flagsBlock,
        currentTime,
        history: cm.history.slice(0, -1),
        message,
      }),
    });
    if (!resp.ok || !resp.body) {
      if (stream) stream.textContent = `${cm.def.displayName}: (silence...)`;
      streamingReply = false;
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.token) {
            acc += parsed.token;
            if (stream) stream.textContent = `${cm.def.displayName}: ${acc}`;
          }
        } catch {}
      }
    }
    cm.pushHistory('assistant', acc);
    renderDialogue();
  } catch (err) {
    if (stream) stream.textContent = `${cm.def.displayName}: (connection lost)`;
  }
  streamingReply = false;
}

window.addEventListener('keydown', (e) => {
  if (!started) return;
  if (shopActiveNpc) {
    if (e.code === 'Escape') closeShop();
    return;
  }
  if (inDialogueWith) {
    if (e.code === 'Escape') closeDialogue();
    return;
  }
  if (e.code === 'Escape') {
    if (pauseMenuOpen) closePause();
    else openPause();
    return;
  }
  if (e.code === 'KeyC') {
    toggleCluePanel();
    return;
  }
  if (e.code === 'KeyT') {
    // Open shop with nearest cast member who sells
    const cm = nearestCastMember();
    if (cm && SHOP_INVENTORIES[cm.def.id]) openShop(cm);
    else if (cm) logCombat(`${cm.def.displayName} has nothing to sell.`);
    return;
  }
  if (e.code === 'KeyI') {
    for (const s of inventory.stacks) {
      const def = ITEM_DEFS[s.defId];
      if (def?.onUse) {
        const lines = def.onUse(character);
        lines.forEach(logCombat);
        inventory.remove(s.defId, 1);
        renderStats();
        renderInventoryPanel();
        return;
      }
    }
    logCombat('No usable item.');
    return;
  }
  if (e.code === 'KeyG') {
    const id = findThrowableItem();
    if (id) { throwItem(id); renderInventoryPanel(); }
    else logCombat('Nothing to throw.');
    return;
  }
  if (e.code === 'KeyE') {
    const clue = nearestClue();
    if (clue) {
      examineClue(clue);
      return;
    }
    const prop = nearestProp();
    if (prop) {
      if (prop.kind === 'trapdoor') {
        enterCatacombs();
        return;
      }
      const r = interactWithProp(prop, character, worldState, scene, {
        witnessRollCheck: (s) => witnessCheck(s, prop.owner),
        inventory,
        removePhysicsBody: (b) => physics.removeBody(b),
      });
      r.log.forEach(logCombat);
      if (r.wasTheft && r.caught && r.theftOwner && r.theftOwner !== 'house' && r.theftOwner !== 'player') {
        reputation.caughtCount++;
        reputation.alarmed = true;
        // Scope the "theft caught" flag to NPCs who actually saw it (and the owner).
        const propPos = prop.position;
        const ownerId = r.theftOwner as CastId;
        const theftWitnesses = computeWitnesses(castMembers, {
          pos: propPos, world, raycast: lineOfSight, coneAware: true, range: 8,
          alwaysIncludes: [ownerId],
        });
        consequences.set(`theft_caught_from_${ownerId}`, true, gameClock.state.currentMinute, theftWitnesses);
        adjustRep(reputation, r.theftOwner as any, -40);
        logCombat(`Reputation with ${r.theftOwner} drops sharply.`);
        // Witness propagation: other NPCs within 6m also learn of the theft
        const pp = player.getPosition();
        for (const other of castMembers) {
          if (other.isDead || other.def.id === r.theftOwner) continue;
          const dx = other.body.position.x - pp.x;
          const dz = other.body.position.z - pp.z;
          if (Math.sqrt(dx * dx + dz * dz) < 6) {
            adjustRep(reputation, other.def.id as any, -10);
            logCombat(`${other.def.displayName} murmurs at the disturbance.`);
          }
        }
        if (reputation.caughtCount >= 3) {
          logCombat('*** The household has had enough of you. ***');
          adjustAttitude(factionRel, 'fletcher_house', 'player_party', -60);
          triggerEnding('heir_dead');
        }
      }
      renderStats();
      renderInventoryPanel();
      return;
    }
    const cm = nearestCastMember();
    if (cm) openDialogue(cm);
  }
  if (e.code === 'KeyY') {
    if (chosenClass === 'fighter') {
      const r = secondWind(resourcePool, character); r.log.forEach(logCombat); renderStats(); renderActionBar();
    } else if (chosenClass === 'cleric') {
      const enemies = assassinGroup ? assassinGroup.enemies.filter(en => !en.isDead) : [];
      const r = channelDivinityTurnUndead(resourcePool, character, enemies); r.log.forEach(logCombat); renderActionBar();
    }
  }
  if (e.code === 'KeyU' && chosenClass === 'fighter') {
    const r = actionSurge(resourcePool); r.log.forEach(logCombat); renderActionBar();
  }
  if (e.code === 'KeyV' && chosenClass === 'rogue') {
    sneakReady = true; logCombat('Sneak Attack readied.');
  }
  if (e.code === 'KeyB' && chosenClass === 'rogue') {
    const r = cunningAction(); r.log.forEach(logCombat);
  }
  // Spell hotkeys 1-9
  if (e.code.startsWith('Digit')) {
    const idx = parseInt(e.code.slice(5)) - 1;
    if (idx >= 0 && idx < learnedSpells.length) castSpellByIndex(idx);
  }
  if (e.code === 'F5') { e.preventDefault(); saveGame(); }
  if (e.code === 'F9') { e.preventDefault(); loadGame(); }
});

function examineClue(c: CluePropInstance) {
  if (c.attempted) {
    logCombat(`(${c.def.label}: already examined)`);
    return;
  }
  c.attempted = true;
  gameClock.advance('investigate');
  const res = attemptClue(c.def, character, plot);
  c.lastResult = res;
  consequences.set(`clue_examined_${c.def.id}`, res.passed, gameClock.state.currentMinute);
  logCombat(`${c.def.label}: ${c.def.flavorOnFind}`);
  logCombat(`Roll ${res.roll} (total ${res.total}) vs DC ${c.def.check.dc}: ${res.passed ? 'PASS' : 'FAIL'} - ${res.text}`);
  if (res.revealedBoss) {
    logCombat(`*** You have proven the Boss. ***`);
    consequences.set('boss_proven', true, gameClock.state.currentMinute);
    consequences.set('boss_id', plot.boss, gameClock.state.currentMinute);
    renderObjectiveCard();
  }
  renderCluePanel();
}

let cluePanelOpen = false;
function toggleCluePanel() {
  cluePanelOpen = !cluePanelOpen;
  const el = document.getElementById('clue-panel');
  if (!el) return;
  el.classList.toggle('open', cluePanelOpen);
  if (cluePanelOpen) renderCluePanel();
}

function renderCluePanel() {
  const el = document.getElementById('clue-panel');
  if (!el) return;
  const examined = clueProps.filter(c => c.attempted);
  let html = `<h4>EVIDENCE LOG  <span style="color:#888;font-weight:normal">[C to close]</span></h4>`;
  if (examined.length === 0) {
    html += `<div class="clue-empty">You have not examined any clues yet. Glowing objects scattered through the manor reveal who hired the contract.</div>`;
  } else {
    for (const c of examined) {
      const r = c.lastResult;
      const passed = r?.passed;
      const passClass = passed ? 'passed' : 'failed';
      const passWord = passed ? 'PASS' : 'FAIL';
      html += `<div class="clue-entry">`;
      html += `<div class="clue-label">${escapeHtml(c.def.label)}</div>`;
      html += `<div class="clue-result ${passClass}">${passWord} — ${r ? escapeHtml(r.text) : ''}</div>`;
      if (passed) {
        const names = c.def.reveals.map(b => BOSSES[b]?.name ?? b).join(', ');
        html += `<div class="clue-reveals">Points at: ${escapeHtml(names)}</div>`;
      }
      html += `</div>`;
    }
  }
  // Append world flags so the player can see what NPCs know.
  const flags = consequences.all().filter(f => f.value === true || (typeof f.value !== 'boolean'));
  if (flags.length > 0) {
    html += `<div class="clue-flags"><b>World state:</b><br>` +
      flags.slice(-10).map(f => {
        if (typeof f.value === 'boolean') return `- ${escapeHtml(f.name)}`;
        return `- ${escapeHtml(f.name)} = ${escapeHtml(String(f.value))}`;
      }).join('<br>') +
      `</div>`;
  }
  el.innerHTML = html;
}

// LMB to attack — prefers nearest enemy in reach, then cast member (intentional violence)
const PLAYER_MELEE_REACH = 2.0;
window.addEventListener('mousedown', (e) => {
  if (!started || inDialogueWith || endingShown) return;
  if (e.button !== 0 || !document.pointerLockElement) return;

  const pos = player.getPosition();
  // First: any enemy in reach (mansion assassins OR catacombs ambush)
  let enemyTarget: Enemy | null = null;
  let bestEnemyDist = PLAYER_MELEE_REACH;
  const enemyPool: Enemy[] = [
    ...(assassinGroup ? assassinGroup.enemies : []),
    ...catacombsEnemies,
  ];
  for (const en of enemyPool) {
    if (en.isDead) continue;
    const dx = en.body.position.x - pos.x;
    const dz = en.body.position.z - pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestEnemyDist) { enemyTarget = en; bestEnemyDist = d; }
  }
  if (enemyTarget) { swingAt(enemyTarget); return; }

  // Then: cast member in reach (player chose to hit a friendly)
  let castTarget: CastMember | null = null;
  let bestCastDist = PLAYER_MELEE_REACH;
  for (const cm of castMembers) {
    if (cm.isDead) continue;
    const dx = cm.body.position.x - pos.x;
    const dz = cm.body.position.z - pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestCastDist) { castTarget = cm; bestCastDist = d; }
  }
  if (castTarget) swingAtCast(castTarget);
});

function swingAt(target: Enemy) {
  swingAnim();
  let sneakDmg = 0;
  if (chosenClass === 'rogue' && sneakReady) {
    sneakDmg = sneakAttackDamage(character);
    sneakReady = false;
  }
  const frame = resolveAttack(
    { name: 'You', attackBonus: 5, damageDice: '1d8+3', damageWord: 'steel' },
    { name: target.preset.name, ac: target.preset.ac, hp: target.character.hp, maxHp: target.character.maxHp },
    { bonusDamage: sneakDmg, fumbleLine: 'You miss wildly!' },
  );
  applyCombatFrame(frame, {
    takeHit: (dmg) => target.takeHit(dmg),
    log: logCombat,
    playSfx,
    onLethal: () => { target.destroy(scene, physics); },
    onResolved: (f) => {
      if (f.hit) {
        spawnBurst({
          origin: { x: target.body.position.x, y: target.body.position.y + 0.5, z: target.body.position.z },
          color: f.critical ? 0xffeeaa : 0xffaa44,
          count: f.critical ? 36 : 18,
          speed: f.critical ? 3.5 : 2.5,
          lifeSeconds: 0.6,
        });
      }
      if (sneakDmg > 0 && f.hit) logCombat(`(...includes ${sneakDmg} sneak attack damage.)`);
    },
  });
  if (assassinGroup && assassinGroup.enemies.every(e => e.isDead)) {
    triggerEnding('assassin_defeated');
  }
}

function swingAtCast(cm: CastMember) {
  const roll = rollDice(20);
  const total = roll + 5;
  if (roll === 1) { logCombat(`Your blade glances off ${cm.def.displayName}.`); return; }
  if (roll === 20 || total >= cm.character.ac) {
    const dmg = rollNd(roll === 20 ? 2 : 1, 8) + 3;
    handleCastDamage(cm, dmg, true);
  } else {
    logCombat(`${cm.def.displayName} dodges your strike.`);
  }
}

/**
 * Single funnel for damage applied to a Cast NPC (LMB, throw, AoE).
 * Updates reputation, household alarm state, ending triggers.
 */
function handleCastDamage(cm: CastMember, dmg: number, byPlayer: boolean) {
  if (cm.isDead) return;
  const result = cm.takeHit(dmg, byPlayer);
  logCombat(`${cm.def.displayName} takes ${dmg} damage. (${cm.character.hp}/${cm.character.maxHp})`);
  if (byPlayer && result.firstHitByPlayer) {
    adjustRep(reputation, cm.def.id as any, -50);
    reputation.alarmed = true;
    // Scope: only NPCs who actually saw it know. Victim is always a witness.
    const witnesses = computeWitnesses(castMembers, {
      pos: { x: cm.body.position.x, y: cm.body.position.y, z: cm.body.position.z },
      world,
      raycast: lineOfSight,
      coneAware: false, // an attack is loud - sound carries
      alwaysIncludes: [cm.def.id],
    });
    // Household-alarmed flag still global (cries propagate), but the
    // attacker-identity flag is scoped to actual witnesses.
    consequences.set('household_alarmed', true, gameClock.state.currentMinute);
    consequences.set(`player_attacked_${cm.def.id}`, true, gameClock.state.currentMinute, witnesses);
    consequences.inc('cast_npcs_attacked_by_player', 1, gameClock.state.currentMinute);
    dispatchOffscreenBeat(`player_attacked_${cm.def.id}`, witnesses);
    // Tank faction relationship — fletcher_house now hostile to player_party
    adjustAttitude(factionRel, 'fletcher_house', 'player_party', -40);
    adjustAttitude(factionRel, 'player_party', 'fletcher_house', -40);
    logCombat(`*** ${cm.def.displayName} cries out. The household is alarmed. ***`);
    if (isHostile(factionRel, 'fletcher_house', 'player_party')) {
      logCombat('*** The Fletcher household considers you an enemy. ***');
    }
  }
  if (result.died) {
    logCombat(`*** ${cm.def.displayName} falls and does not rise. ***`);
    if (cm.def.id === 'heir') {
      triggerEnding('heir_dead');
      return;
    }
    if (cm.def.id === 'matriarch') {
      logCombat('Without Magrath, the contract is void. You will not see dawn welcome.');
      triggerEnding('heir_dead');
      return;
    }
    // Other casts: stronger alarm cascade
    reputation.alarmed = true;
    for (const other of castMembers) {
      if (other.isDead || other === cm) continue;
      adjustRep(reputation, other.def.id as any, -30);
    }
  }
}

// --- NPC-to-NPC dialogue (occasional) ---
const lastTalkAt = new Map<string, number>(); // pair key -> in-game minute
const talkInFlight = new Set<string>();
function pairKey(a: string, b: string): string { return [a, b].sort().join('|'); }

function tryNpcTalkPair(a: CastMember, b: CastMember): void {
  if (a.isDead || b.isDead) return;
  if (a.aiState !== 'idle' && a.aiState !== 'alarmed') return;
  if (b.aiState !== 'idle' && b.aiState !== 'alarmed') return;
  const key = pairKey(a.def.id, b.def.id);
  if (talkInFlight.has(key)) return;
  const last = lastTalkAt.get(key) ?? -9999;
  if (gameClock.state.currentMinute - last < 20) return; // 20 in-game min cooldown
  // Distance + LOS
  const ax = a.body.position.x, az = a.body.position.z;
  const bx = b.body.position.x, bz = b.body.position.z;
  if (Math.abs(a.body.position.y - b.body.position.y) > 2) return;
  if (Math.sqrt((ax - bx) ** 2 + (az - bz) ** 2) > 2.5) return;
  if (!lineOfSight(ax, a.body.position.y + 1.4, az, bx, b.body.position.y + 1.4, bz)) return;

  talkInFlight.add(key);
  lastTalkAt.set(key, gameClock.state.currentMinute);

  const aRecent = memory.feed.recentFor(a.def.id, 4).map(e => e.text).join(' / ');
  const bRecent = memory.feed.recentFor(b.def.id, 4).map(e => e.text).join(' / ');

  fetch('/api/npc-talk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      a: { id: a.def.id, displayName: a.def.displayName, persona: a.def.persona.persona },
      b: { id: b.def.id, displayName: b.def.displayName, persona: b.def.persona.persona },
      flags: formatFlagsForPrompt(consequences.all()),
      currentTime: gameClock.formatted(),
      aRecentEvents: aRecent,
      bRecentEvents: bRecent,
    }),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`npc-talk ${r.status}`);
      const data = (await r.json()) as { lines?: { npcId: string; text: string }[] };
      const lines = data.lines ?? [];
      for (const ln of lines) {
        const text = `${ln.npcId === a.def.id ? a.def.displayName : b.def.displayName}: "${ln.text}"`;
        // Both NPCs hear it (proximity); push as scoped event.
        memory.addEvent(`[overheard] ${text}`, gameClock.state.currentMinute, [a.def.id, b.def.id]);
      }
      if (lines.length > 0) console.log('[npc-talk]', a.def.id, '<>', b.def.id, lines);
    })
    .catch((e) => console.warn('[npc-talk] failed:', e))
    .finally(() => { talkInFlight.delete(key); });
}

let npcTalkCheckClock = 0;
function tickNpcTalk(dt: number): void {
  npcTalkCheckClock += dt;
  if (npcTalkCheckClock < 5.0) return;
  npcTalkCheckClock = 0;
  for (let i = 0; i < castMembers.length; i++) {
    for (let j = i + 1; j < castMembers.length; j++) {
      tryNpcTalkPair(castMembers[i], castMembers[j]);
    }
  }
}

// --- NPC-to-NPC rumor diffusion ---
let rumorClock = 0;
function tickRumorDiffusion(dt: number): void {
  rumorClock += dt;
  if (rumorClock < 3.0) return; // every 3 real seconds
  rumorClock = 0;
  if (castMembers.length === 0) return;
  diffuseRumors({
    cast: castMembers,
    world,
    raycast: lineOfSight,
    pushEvent: (text, minute, visibility) => { memory.addEvent(text, minute, visibility); },
    eventsVisibleTo: (id, count) => memory.feed.recentFor(id, count),
    currentMinute: gameClock.state.currentMinute,
  });
}

// --- Off-screen NPC beats (Bobby-Gray pattern #5) ---
let beatInFlight = false;
/**
 * Ask Groq for one short third-person action per witnessing NPC and push them as
 * NPC-scoped memory events. Fire-and-forget. Witness set defaults to ALL active
 * NPCs (manor-wide events like dawn / clock chime); pass a narrower CastId[] for
 * scoped events so only NPCs who actually saw it react.
 */
function dispatchOffscreenBeat(beatLabel: string, witnessIds?: CastId[]): void {
  if (beatInFlight) return;
  beatInFlight = true;
  const alive = castMembers.filter((cm) => !cm.isDead);
  const filter = witnessIds ? new Set(witnessIds) : null;
  const activeNpcs = alive
    .filter((cm) => filter === null || filter.has(cm.def.id))
    .map((cm) => ({
      id: cm.def.id,
      displayName: cm.def.displayName,
      persona: cm.def.persona.persona,
      positionTonight: cm.def.persona.positionTonight ?? '',
      motivation: cm.def.persona.motivation ?? '',
    }));
  if (activeNpcs.length === 0) { beatInFlight = false; return; }
  const flagsBlock = formatFlagsForPrompt(consequences.all());
  fetch('/api/npc-beat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      npcs: activeNpcs,
      flags: flagsBlock,
      currentTime: gameClock.formatted(),
      beatLabel,
    }),
  })
    .then(async (r) => {
      if (!r.ok) throw new Error(`npc-beat ${r.status}`);
      const data = (await r.json()) as { actions?: { npcId: string; text: string }[] };
      const actions = data.actions ?? [];
      for (const a of actions) {
        // Visibility scoped to the NPC who took the action - others don't know.
        memory.addEvent(`[off-screen] ${a.text}`, gameClock.state.currentMinute, [a.npcId as CastId]);
      }
      if (actions.length > 0) {
        console.log('[Long Watch] off-screen beat actions:', actions);
      }
    })
    .catch((e) => console.warn('[off-screen-beat] failed:', e))
    .finally(() => { beatInFlight = false; });
}

// --- Act-2 catacombs (escape route) ---
let catacombs: Catacombs | null = null;
let inCatacombs = false;
/** Enemies spawned exclusively inside the catacombs. Separate from the mansion's assassinGroup. */
const catacombsEnemies: Enemy[] = [];

function enterCatacombs() {
  if (inCatacombs) return;
  inCatacombs = true;
  gameActor.send({ type: 'CATACOMBS_ENTER' });
  autoSave('catacombs_enter');
  playSfx('rumble');
  setAmbient('catacombs');
  logCombat('You descend through the trapdoor into damp stone.');
  // Only NPCs near the storage-room trapdoor "see" the descent.
  const trapdoorPos = { x: 44, y: 1.05, z: 27 };
  const witnesses = computeWitnesses(castMembers, {
    pos: trapdoorPos, world, raycast: lineOfSight, coneAware: false, range: 10,
  });
  consequences.set('entered_catacombs', true, gameClock.state.currentMinute, witnesses.length > 0 ? witnesses : 'public');
  dispatchOffscreenBeat('player_descended_catacombs', witnesses.length > 0 ? witnesses : undefined);
  // Hide the mansion mesh and freeze cast meshes so they don't render below.
  world.group.visible = false;
  for (const cm of castMembers) cm.group.visible = false;
  catacombs = buildCatacombs(scene, physics, { seed: plot.bossRoll });
  player.setPosition(catacombs.spawn.x, catacombs.spawn.y, catacombs.spawn.z);
  player.yaw.position.set(catacombs.spawn.x, catacombs.spawn.y, catacombs.spawn.z);

  // Hostile encounter: if the assassin has already breached the mansion,
  // a rear-guard waits inside. Three staged waves at distance fractions 0.3 /
  // 0.65 / 0.9 of the spawn->exit Manhattan path. Each wave is small (1-2
  // enemies) so combat stays fast.
  if (consequences.has('assassin_arrived')) {
    const ambushKind: EnemyKind = plot.assassin === 'cult_of_umberlee' ? 'fanatic' : 'mook';
    schedulePendingWaves(ambushKind);
  }
}

interface PendingWave {
  frac: number;
  size: number;
  spawned: boolean;
}
let pendingWaves: PendingWave[] = [];
let waveKind: EnemyKind = 'mook';

function schedulePendingWaves(kind: EnemyKind) {
  waveKind = kind;
  pendingWaves = [
    { frac: 0.30, size: 1, spawned: false },
    { frac: 0.65, size: 2, spawned: false },
    { frac: 0.90, size: 2, spawned: false },
  ];
  consequences.set('catacombs_ambush', true, gameClock.state.currentMinute);
  logCombat('You sense movement deeper in the dark.');
  gameClock.enterCombat();
}

function tickCatacombsWaves() {
  if (!inCatacombs || !catacombs) return;
  if (pendingWaves.length === 0) return;
  const p = player.getPosition();
  for (const wave of pendingWaves) {
    if (wave.spawned) continue;
    const wavePts = catacombs.pickWavePoints(wave.frac, wave.size);
    if (wavePts.length === 0) { wave.spawned = true; continue; }
    // Trigger when player is within 6 world units of any of the wave's tiles.
    let triggered = false;
    for (const wp of wavePts) {
      const dx = p.x - wp.x; const dz = p.z - wp.z;
      if (Math.abs(p.y - wp.y) < 3 && Math.sqrt(dx * dx + dz * dz) < 6) { triggered = true; break; }
    }
    if (!triggered) continue;
    wave.spawned = true;
    for (const wp of wavePts) {
      const e = new Enemy(waveKind, wp.x, wp.y, wp.z, scene, physics);
      e.faction = ASSASSIN_FACTION[plot.assassin];
      catacombsEnemies.push(e);
    }
    logCombat(`${wavePts.length} ${waveKind === 'fanatic' ? 'fanatics' : 'mooks'} step out of an alcove.`);
  }
}

function tickCatacombsLoot() {
  if (!inCatacombs || !catacombs) return;
  if (catacombs.lootSpots.length === 0) return;
  const p = player.getPosition();
  for (let i = catacombs.lootSpots.length - 1; i >= 0; i--) {
    const ls = catacombs.lootSpots[i];
    const dx = p.x - ls.x; const dy = p.y - ls.y; const dz = p.z - ls.z;
    if (dx * dx + dy * dy + dz * dz < 1.4 * 1.4) {
      // Award random loot: small gold or healing draught flag.
      const gold = 25 + Math.floor(Math.random() * 40);
      inventory.gold = (inventory.gold ?? 0) + gold;
      logCombat(`You pocket a loose pouch of ${gold} gp from the cache.`);
      consequences.inc('catacombs_loot_taken', 1, gameClock.state.currentMinute);
      catacombs.lootSpots.splice(i, 1);
      playSfx('chime');
    }
  }
}

function tickCatacombsEnemies(dt: number): void {
  if (!inCatacombs || catacombsEnemies.length === 0) return;
  const playerPos = player.getPosition();
  for (const e of catacombsEnemies) {
    if (e.isDead) continue;
    const dmg = e.updateAi(dt, playerPos, character.ac, character);
    if (dmg > 0) {
      logCombat(`Catacombs ${e.preset.name} hits you for ${dmg}.`);
      renderStats();
    }
    if (e.isDead) {
      logCombat(`Catacombs ${e.preset.name} falls.`);
      e.destroy(scene, physics);
    }
  }
  // Clear dead ones and exit combat if all gone.
  for (let i = catacombsEnemies.length - 1; i >= 0; i--) {
    if (catacombsEnemies[i].isDead) catacombsEnemies.splice(i, 1);
  }
  if (catacombsEnemies.length === 0 && consequences.has('catacombs_ambush')) {
    gameClock.exitCombat();
    logCombat('The catacombs go silent again. The exit is clear.');
  }
}

function checkCatacombsExit() {
  if (!inCatacombs || !catacombs || endingShown) return;
  const p = player.getPosition();
  if (catacombs.isOnExit(p)) {
    logCombat('You stumble out into the dockside fog. The Heir is far behind you - and so is the contract.');
    consequences.set('escaped_via_catacombs', true, gameClock.state.currentMinute);
    gameActor.send({ type: 'CATACOMBS_EXIT' });
    triggerEnding('escaped_catacombs');
  }
}

let endingShown = false;
function triggerEnding(reason: 'heir_alive_dawn' | 'assassin_defeated' | 'player_dead' | 'heir_dead' | 'escaped_catacombs') {
  if (endingShown) return;
  endingShown = true;
  document.exitPointerLock?.();
  const end = document.getElementById('end-screen');
  const title = document.getElementById('end-title');
  const body = document.getElementById('end-body');
  if (!end || !title || !body) return;
  if (reason === 'heir_alive_dawn' || reason === 'assassin_defeated') {
    title.textContent = 'DAWN';
    title.style.color = '#fc4';
    const bossLine = plot.revealed.boss
      ? `<div style="margin-top:8px;color:#fc4">You proved the Boss: <b>${BOSSES[plot.boss].name}</b>. Magrath adds 1,000 gold to the purse.</div>`
      : '<div style="margin-top:8px;color:#aaa">You could not prove who paid for the hit.</div>';
    body.innerHTML =
      `<p>The Heir lives. Magrath presses 1,000 gold pieces into your hand.</p>` +
      bossLine +
      `<p style="margin-top:14px;color:#888;font-size:12px">Your objective was: <b>${summary.myObjective.name}</b></p>`;
  } else if (reason === 'escaped_catacombs') {
    title.textContent = 'ESCAPED';
    title.style.color = '#fa6';
    body.innerHTML =
      `<p>You surface in the dockside fog. No gold, no patron, no Heir on your conscience.</p>` +
      `<p style="margin-top:8px;color:#aaa">Magrath will hunt your name through every port that owes her a favor.</p>` +
      `<p style="margin-top:14px;color:#888;font-size:12px">Your objective was: <b>${summary.myObjective.name}</b></p>`;
  } else {
    title.textContent = 'YOU FAILED';
    title.style.color = '#f33';
    body.innerHTML =
      `<p>The Heir is dead. Magrath, grief-stricken, drives you from the city.</p>` +
      `<p style="margin-top:14px;color:#888;font-size:12px">"Leave my house, leave my city, and pray that I never lay eyes on any of you again."</p>`;
  }
  end.classList.add('active');
}

(window as any).__triggerEnding = triggerEnding;

document.getElementById('end-restart')?.addEventListener('click', () => window.location.reload());

// === Save / Load (schema v2: adds memory, consequences, gameActor state, seed) ===
const SAVE_KEY = 'long-watch-save-v2';
const LEGACY_SAVE_KEY = 'long-watch-save-v1';
const MAX_SLOTS = 5;
function slotKey(i: number): string { return `${SAVE_KEY}/slot-${i}`; }

/** List slots with their saved metadata. */
function listSaveSlots(): { slot: number; exists: boolean; minute?: number; chosenClass?: string; savedAt?: number }[] {
  const out: { slot: number; exists: boolean; minute?: number; chosenClass?: string; savedAt?: number }[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const raw = localStorage.getItem(slotKey(i));
    if (!raw) { out.push({ slot: i, exists: false }); continue; }
    try {
      const d = JSON.parse(raw);
      out.push({ slot: i, exists: true, minute: d.clockMinute, chosenClass: d.chosenClass, savedAt: d.savedAt });
    } catch {
      out.push({ slot: i, exists: false });
    }
  }
  return out;
}

/** activeSaveSlot: 0..MAX_SLOTS-1. Defaults to 0; pause menu lets user pick. */
let activeSaveSlot = 0;

/** Auto-save on milestone events. Always writes to the reserved last slot. */
function autoSave(_label: string): void {
  if (!started || endingShown) return;
  try {
    saveGame(MAX_SLOTS - 1);
  } catch {
    /* best-effort, silent */
  }
}

function saveGame(slot: number = activeSaveSlot) {
  if (!started) return;
  try {
    const data = {
      version: 2,
      seed: getSeed(),
      savedAt: Date.now(),
      chosenClass,
      character: {
        name: character.name,
        level: character.level,
        hp: character.hp,
        maxHp: character.maxHp,
        ac: character.ac,
        stats: { ...character.stats },
      },
      pool: resourcePool,
      learnedSpells,
      plot: { ...plot, revealed: { ...plot.revealed } },
      clockMinute: gameClock.state.currentMinute,
      assassinSpawned: !!assassinGroup,
      assassinIds: assassinGroup ? assassinGroup.enemies.map(e => ({ kind: e.kind, hp: e.character.hp, x: e.body.position.x, y: e.body.position.y, z: e.body.position.z, dead: e.isDead })) : [],
      pos: { x: player.body.position.x, y: player.body.position.y, z: player.body.position.z, yaw: player.yawAngle, pitch: player.pitch },
      clueAttempted: clueProps.map(c => ({ id: c.def.id, attempted: c.attempted, lastResult: c.lastResult })),
      log: combatLog.slice(-30),
      // --- Iter 40: persist Memory + ConsequenceStore + gameActor phase ---
      memory: {
        events: memory.feed.events,
        nextEventId: (memory.feed as unknown as { nextId: number }).nextId,
        reflections: Array.from(memory.reflections.entries()).map(([npcId, list]) => ({ npcId, list })),
        nextReflectionId: (memory as unknown as { nextReflectionId: number }).nextReflectionId,
      },
      consequences: consequences.all(),
      gamePhase: String(gameActor.getSnapshot().value),
      inCatacombs,
    };
    const json = JSON.stringify(data);
    localStorage.setItem(slotKey(slot), json);
    // Also mirror to the legacy single-slot key so /F5 keystroke + auto-recover
    // still pick something up.
    localStorage.setItem(SAVE_KEY, json);
    logCombat(`Game saved to slot ${slot + 1}.`);
  } catch (err) {
    console.error('save error', err);
    logCombat('Save failed.');
  }
}

function loadGame(slot: number = activeSaveSlot) {
  try {
    let raw = localStorage.getItem(slotKey(slot));
    if (!raw) raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
      if (!legacy) { logCombat('No save found.'); return; }
      raw = legacy;
    }
    const data = JSON.parse(raw);
    if (data.version !== 1 && data.version !== 2) { logCombat('Save version mismatch.'); return; }
    sessionStorage.setItem('__pendingLoad', raw);
    window.location.reload();
  } catch (err) {
    logCombat('Load failed.');
  }
}

/** Returns a base64 string of the current save (active slot). */
function exportSaveString(): string | null {
  const raw = localStorage.getItem(slotKey(activeSaveSlot)) ?? localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try { return btoa(unescape(encodeURIComponent(raw))); } catch { return null; }
}

/** Decodes a save string and reloads. Returns true on success. */
function importSaveString(b64: string): boolean {
  try {
    const json = decodeURIComponent(escape(atob(b64.trim())));
    const data = JSON.parse(json);
    if (data.version !== 1 && data.version !== 2) return false;
    sessionStorage.setItem('__pendingLoad', json);
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

function applyPendingLoad() {
  const raw = sessionStorage.getItem('__pendingLoad');
  if (!raw) return false;
  sessionStorage.removeItem('__pendingLoad');
  try {
    const data = JSON.parse(raw);
    chosenClass = data.chosenClass;
    applyClass(character, CLASSES[chosenClass]);
    character.name = data.character.name;
    character.hp = data.character.hp;
    character.maxHp = data.character.maxHp;
    character.ac = data.character.ac;
    character.level = data.character.level;
    character.stats = data.character.stats;
    resourcePool = data.pool;
    learnedSpells = data.learnedSpells;
    Object.assign(plot, data.plot);
    plot.revealed = { ...data.plot.revealed };
    gameClock.setMinute(data.clockMinute);
    player.setPosition(data.pos.x, data.pos.y, data.pos.z);
    player.yawAngle = data.pos.yaw;
    player.pitch = data.pos.pitch;
    for (const c of clueProps) {
      const saved = data.clueAttempted.find((x: any) => x.id === c.def.id);
      if (saved) {
        c.attempted = saved.attempted;
        if ('lastResult' in saved) c.lastResult = saved.lastResult ?? null;
      }
    }
    for (const line of data.log) combatLog.push(line);

    // --- Iter 40: restore Memory + ConsequenceStore + gameActor phase ---
    if (data.version === 2) {
      if (data.seed) setSeed(data.seed);
      if (data.memory) {
        memory.clear();
        (memory.feed as unknown as { events: typeof memory.feed.events }).events = data.memory.events ?? [];
        (memory.feed as unknown as { nextId: number }).nextId = data.memory.nextEventId ?? 1;
        for (const r of data.memory.reflections ?? []) {
          memory.reflections.set(r.npcId, r.list);
        }
        (memory as unknown as { nextReflectionId: number }).nextReflectionId = data.memory.nextReflectionId ?? 1;
      }
      consequences.clear();
      for (const f of data.consequences ?? []) {
        consequences.set(f.name, f.value, f.setAt, f.knownBy ?? 'public');
      }
      // Best-effort gamePhase restore via sequenced events.
      const phase = data.gamePhase as string;
      gameActor.send({ type: 'START' });
      if (phase === 'exploring_warned' || phase === 'combat' || phase === 'catacombs') gameActor.send({ type: 'WARNING' });
      if (phase === 'combat') gameActor.send({ type: 'ASSASSIN_ARRIVED' });
      if (phase === 'catacombs' || data.inCatacombs) gameActor.send({ type: 'CATACOMBS_ENTER' });
    }

    renderStats();
    renderActionBar();
    renderObjectiveCard();
    renderCluePanel();
    started = true;
    startScreen!.style.display = 'none';
    setTimeout(() => renderer.domElement.requestPointerLock(), 200);
    logCombat('Game loaded.');
    return true;
  } catch (err) {
    console.error('load error', err);
    return false;
  }
}

// === Mobile touch controls ===
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const mobileControls = document.getElementById('mobile-controls');
if (isMobile && mobileControls) mobileControls.classList.add('active');

function setupTouchControls() {
  const stick = document.getElementById('mc-move');
  const nub = document.getElementById('mc-move-nub');
  const look = document.getElementById('mc-look');
  const atk = document.getElementById('mc-attack');
  const inter = document.getElementById('mc-interact');
  const jmp = document.getElementById('mc-jump');

  if (stick && nub) {
    let stickStart: { x: number; y: number } | null = null;
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const rect = stick.getBoundingClientRect();
      stickStart = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!stickStart) return;
      const t = e.touches[0];
      const dx = t.clientX - stickStart.x;
      const dy = t.clientY - stickStart.y;
      const mag = Math.min(50, Math.sqrt(dx * dx + dy * dy));
      const ang = Math.atan2(dy, dx);
      (nub as HTMLElement).style.transform = `translate(calc(-50% + ${Math.cos(ang) * mag}px), calc(-50% + ${Math.sin(ang) * mag}px))`;
      (player as any).keys['KeyW'] = dy < -10;
      (player as any).keys['KeyS'] = dy > 10;
      (player as any).keys['KeyA'] = dx < -10;
      (player as any).keys['KeyD'] = dx > 10;
    });
    const stop = (e: TouchEvent) => {
      e.preventDefault();
      stickStart = null;
      (nub as HTMLElement).style.transform = 'translate(-50%, -50%)';
      (player as any).keys['KeyW'] = (player as any).keys['KeyS'] = (player as any).keys['KeyA'] = (player as any).keys['KeyD'] = false;
    };
    stick.addEventListener('touchend', stop);
    stick.addEventListener('touchcancel', stop);
  }
  if (look) {
    let last: { x: number; y: number } | null = null;
    look.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      last = { x: t.clientX, y: t.clientY };
    });
    look.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!last) return;
      const t = e.touches[0];
      const dx = t.clientX - last.x;
      const dy = t.clientY - last.y;
      player.yawAngle -= dx * 0.005;
      player.pitch -= dy * 0.005;
      player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
      last = { x: t.clientX, y: t.clientY };
    });
    look.addEventListener('touchend', (e) => { e.preventDefault(); last = null; });
  }
  atk?.addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new MouseEvent('mousedown', { button: 0 })); });
  inter?.addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
  jmp?.addEventListener('touchstart', (e) => { e.preventDefault(); (player as any).keys['Space'] = true; setTimeout(() => (player as any).keys['Space'] = false, 200); });
}
setupTouchControls();

// Run any pending load (after F9 reload)
setTimeout(applyPendingLoad, 0);

// --- Iter 43: Pause menu wiring ---
let pauseMenuOpen = false;
function renderPauseSlots() {
  const el = document.getElementById('pm-slots');
  if (!el) return;
  const slots = listSaveSlots();
  let html = '';
  for (const s of slots) {
    const label = s.exists
      ? `Slot ${s.slot + 1} - ${s.chosenClass ?? '?'} @ ${Math.floor((s.minute ?? 0) / 60)}:${String((s.minute ?? 0) % 60).padStart(2, '0')}`
      : `Slot ${s.slot + 1} (empty)`;
    html += `<div class="pm-slot">`;
    html += `<span class="pm-slot-label">${label}${activeSaveSlot === s.slot ? ' <b style="color:#fc4">[active]</b>' : ''}</span>`;
    html += `<button data-slot-pick="${s.slot}">Pick</button>`;
    if (s.exists) html += `<button data-slot-load="${s.slot}">Load</button>`;
    html += `</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('button[data-slot-pick]').forEach((b) => {
    b.addEventListener('click', (ev) => {
      const i = parseInt((ev.currentTarget as HTMLButtonElement).getAttribute('data-slot-pick') || '0', 10);
      activeSaveSlot = i;
      logCombat(`Active save slot: ${i + 1}.`);
      renderPauseSlots();
    });
  });
  el.querySelectorAll('button[data-slot-load]').forEach((b) => {
    b.addEventListener('click', (ev) => {
      const i = parseInt((ev.currentTarget as HTMLButtonElement).getAttribute('data-slot-load') || '0', 10);
      loadGame(i);
    });
  });
}

function openPause() {
  if (!started || endingShown) return;
  pauseMenuOpen = true;
  document.exitPointerLock?.();
  const m = document.getElementById('pause-menu');
  if (m) m.style.display = 'flex';
  renderPauseSlots();
}
function closePause() {
  pauseMenuOpen = false;
  const m = document.getElementById('pause-menu');
  if (m) m.style.display = 'none';
  if (started && !endingShown) renderer.domElement.requestPointerLock();
}

document.getElementById('pm-resume')?.addEventListener('click', closePause);
document.getElementById('pm-save')?.addEventListener('click', () => { saveGame(); renderPauseSlots(); });
document.getElementById('pm-load')?.addEventListener('click', () => loadGame());
document.getElementById('pm-export')?.addEventListener('click', () => {
  const s = exportSaveString();
  if (!s) { logCombat('No save to export.'); return; }
  navigator.clipboard?.writeText(s).then(() => logCombat('Save string copied to clipboard.'));
});
document.getElementById('pm-import')?.addEventListener('click', () => {
  const s = window.prompt('Paste save string:');
  if (!s) return;
  if (!importSaveString(s)) logCombat('Import failed: bad save string.');
});
document.getElementById('pm-quit')?.addEventListener('click', () => window.location.reload());

// Expose for debugging
(window as any).__debug = { world, physics, mansion, player, character, plot, OBJECTIVES, summary, gameClock, castMembers, memory, consequences, gameActor };
(window as any).__gameState = gameActor;
// Expose dungen + names for console hackers. Already in the static graph via
// catacombs.ts / assassin.ts so no extra payload.
import * as __dungen from './dungenGen';
import * as __names from './names';
(window as any).__dungen = __dungen;
(window as any).__names = __names;

let prevTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  if (!started) { renderer.render(scene, camera); return; }

  physics.step(dt);
  player.update(dt);
  gameClock.driftStep(dt);
  detectRoomEntry();
  updateInteractHint();
  updateThrowables(dt);
  checkCatacombsExit();
  tickCatacombsWaves();
  tickCatacombsLoot();
  tickCatacombsEnemies(dt);
  tickRumorDiffusion(dt);
  tickNpcTalk(dt);
  tickCandles(dt);
  tickDawnDim();
  tickParticles(dt);
  tickFpHands(dt);
  if (mp) {
    const p = player.getPosition();
    mp.pushSelfPos(p.x, p.y, p.z, player.yaw.rotation.y, character.name);
  }

  // === Cast AI ===
  tickCastAi(dt);

  // === Companions ===
  if (started && !endingShown) {
    const playerPos = player.getPosition();
    const enemies = assassinGroup ? assassinGroup.enemies : [];
    for (const c of companions) {
      const r = c.update(dt, playerPos, enemies);
      if (r?.dealtTo && r.dmg !== undefined) {
        logCombat(`${c.def.displayName} hits ${r.dealtTo.preset.name} for ${r.dmg}.`);
        if (r.dealtTo.isDead) { logCombat(`${r.dealtTo.preset.name} falls.`); r.dealtTo.destroy(scene, physics); }
      }
    }
    // Enemies can hit companions too
    for (const e of enemies) {
      if (e.isDead) continue;
      for (const c of companions) {
        if (c.isDead) continue;
        const dx = c.body.position.x - e.body.position.x;
        const dz = c.body.position.z - e.body.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < e.preset.reach) {
          // Enemy already hits player elsewhere; check if we want it to hit companions every 2s tick
          // We piggyback on Enemy.updateAi which targets the player. To have enemies hit Karla,
          // we randomly redirect 30% of enemy attacks. For simplicity skip now; karla draws aggro
          // by getting in their face, but enemy AI still targets player. Future iter.
        }
      }
    }
  }

  // Enemy tick
  if (assassinGroup && !endingShown) {
    const playerPos = player.getPosition();
    let anyAttacked = false;
    for (const en of assassinGroup.enemies) {
      if (en.isDead) continue;
      const dmg = en.updateAi(dt, playerPos, character.ac, character);
      if (dmg > 0) {
        anyAttacked = true;
        logCombat(`${en.preset.name} hits you for ${dmg}.`);
      }
    }
    if (anyAttacked) renderStats();
    if (character.isDead()) triggerEnding('heir_dead');
  }

  renderer.render(scene, camera);
}
animate();
