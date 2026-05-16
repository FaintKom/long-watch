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
import { Enemy } from './enemy';
import { spawnAssassin, SpawnedAssassinGroup } from './assassin';
import { rollDice, rollNd } from './character';
import { CLASSES, ClassId, applyClass } from './classes';
import { buildClueProps, attemptClue, CluePropInstance } from './clues';
import { newResourcePool, secondWind, actionSurge, cunningAction, sneakAttackDamage, channelDivinityTurnUndead, SPELLS, STARTING_SPELLS, ResourcePool } from './actions';
import { placeMansionProps, interactWithProp, newPlayerWorldState, PropInstance, PlayerWorldState, isPickupable } from './props';
import { Inventory, ITEM_DEFS, newReputation, adjustRep, SHOP_INVENTORIES, OwnerId, ItemDef } from './inventory';
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

scene.add(new THREE.AmbientLight(0x556677, 0.5));
scene.add(new THREE.HemisphereLight(0x668899, 0x332211, 0.4));

// === World + Physics + Mansion ===
const world = new VoxelWorld(MAP_W, MAP_H, MAP_D);
const physics = new PhysicsWorld();
const mansion = buildMansion(world, physics, scene);
scene.add(world.group);

// === Player ===
const player = new Player(camera, physics, world);
player.setPosition(mansion.spawnPoint.x, mansion.spawnPoint.y, mansion.spawnPoint.z);
scene.add(player.yaw);

// === Cast members ===
const castMembers: CastMember[] = (Object.keys(CAST) as CastId[]).map(id => new CastMember(CAST[id], scene, physics));

// === Clue props ===
const clueProps: CluePropInstance[] = buildClueProps(scene);

// === Mansion props ===
const props: PropInstance[] = placeMansionProps(scene, physics);
const worldState: PlayerWorldState = newPlayerWorldState();
const inventory = new Inventory();
const reputation = newReputation();

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
    function rollDmg(): number {
      const m = dice.match(/(\d+)d(\d+)(?:\+(\d+))?/);
      if (!m) return 1;
      const n = parseInt(m[1]);
      const sides = parseInt(m[2]);
      const b = m[3] ? parseInt(m[3]) : 0;
      let r = 0; for (let i = 0; i < n; i++) r += Math.floor(Math.random() * sides) + 1;
      return r + b;
    }
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
    const npcP = cm.body.position;
    const dist = Math.sqrt((pos.x - npcP.x) ** 2 + (pos.y - npcP.y) ** 2 + (pos.z - npcP.z) ** 2);
    if (dist > 12) continue;
    if (!lineOfSight(pos.x, pos.y + 1.5, pos.z, npcP.x, npcP.y + 1.4, npcP.z)) continue;
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
function logCombat(line: string) {
  combatLog.push(line);
  console.log('[Long Watch]', line);
  const el = document.getElementById('combat-log');
  if (el) el.innerHTML = combatLog.slice(-8).map(l => `<div>${l}</div>`).join('');
}

gameClock.onTick = (e) => {
  paintClock();
  if (e.triggerWarning) logCombat('A chill runs through the manor. Something draws near.');
  if (e.triggerAssassin) {
    assassinGroup = spawnAssassin(plot.assassin, scene, physics, mansion);
    logCombat(assassinGroup.flavor);
    plot.revealed.assassin = true;
    renderObjectiveCard();
  }
  if (e.triggerDawn) {
    logCombat('Dawn breaks. The Heir survives.');
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
  }
}

let resourcePool: ResourcePool = newResourcePool(chosenClass);
let learnedSpells: string[] = STARTING_SPELLS[chosenClass];
/** Index of currently selected spell for cast. */
let activeSpellIdx = 0;

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
  cm.pushHistory('user', message);
  gameClock.advance('ai_chat_turn');

  streamingReply = true;
  const stream = document.getElementById('dlg-stream');
  if (stream) stream.textContent = `${cm.def.displayName}: `;
  let acc = '';

  try {
    const resp = await fetch('/api/npc-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        npcName: cm.def.displayName,
        persona: cm.def.persona.persona,
        knownFacts: cm.def.persona.knownFacts,
        hiddenFacts: cm.def.persona.hiddenFacts,
        speechStyle: cm.def.persona.speechStyle,
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
      const r = interactWithProp(prop, character, worldState, scene, {
        witnessRollCheck: (s) => witnessCheck(s, prop.owner),
        inventory,
        removePhysicsBody: (b) => physics.removeBody(b),
      });
      r.log.forEach(logCombat);
      if (r.wasTheft && r.caught && r.theftOwner && r.theftOwner !== 'house' && r.theftOwner !== 'player') {
        reputation.caughtCount++;
        reputation.alarmed = true;
        adjustRep(reputation, r.theftOwner as any, -40);
        logCombat(`Reputation with ${r.theftOwner} drops sharply.`);
        if (reputation.caughtCount >= 3) {
          logCombat('*** The household has had enough of you. ***');
          triggerEnding('heir_dead'); // banishment
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
  logCombat(`${c.def.label}: ${c.def.flavorOnFind}`);
  logCombat(`Roll ${res.roll} (total ${res.total}) vs DC ${c.def.check.dc}: ${res.passed ? 'PASS' : 'FAIL'} - ${res.text}`);
  if (res.revealedBoss) {
    logCombat(`*** You have proven the Boss. ***`);
    renderObjectiveCard();
  }
}

// LMB to attack — prefers nearest enemy in reach, then cast member (intentional violence)
const PLAYER_MELEE_REACH = 2.0;
window.addEventListener('mousedown', (e) => {
  if (!started || inDialogueWith || endingShown) return;
  if (e.button !== 0 || !document.pointerLockElement) return;

  const pos = player.getPosition();
  // First: any enemy in reach
  let enemyTarget: Enemy | null = null;
  let bestEnemyDist = PLAYER_MELEE_REACH;
  if (assassinGroup) {
    for (const en of assassinGroup.enemies) {
      if (en.isDead) continue;
      const dx = en.body.position.x - pos.x;
      const dz = en.body.position.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestEnemyDist) { enemyTarget = en; bestEnemyDist = d; }
    }
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
  const roll = rollDice(20);
  const total = roll + 5;
  if (roll === 1) { logCombat('You miss wildly!'); return; }
  if (roll === 20 || total >= target.preset.ac) {
    let dmg = rollNd(roll === 20 ? 2 : 1, 8) + 3;
    let sneakDmg = 0;
    if (chosenClass === 'rogue' && sneakReady) {
      sneakDmg = sneakAttackDamage(character);
      sneakReady = false;
    }
    target.takeHit(dmg + sneakDmg);
    logCombat(`You hit ${target.preset.name} for ${dmg + sneakDmg} damage${sneakDmg ? ` (incl. ${sneakDmg} sneak)` : ''}.${roll === 20 ? ' CRITICAL!' : ''}`);
    if (target.isDead) {
      logCombat(`${target.preset.name} falls.`);
      target.destroy(scene, physics);
    }
    if (assassinGroup && assassinGroup.enemies.every(e => e.isDead)) {
      triggerEnding('assassin_defeated');
    }
  } else {
    logCombat(`Your strike glances off ${target.preset.name}.`);
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
    logCombat(`*** ${cm.def.displayName} cries out. The household is alarmed. ***`);
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

let endingShown = false;
function triggerEnding(reason: 'heir_alive_dawn' | 'assassin_defeated' | 'player_dead' | 'heir_dead') {
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

// === Save / Load ===
const SAVE_KEY = 'long-watch-save-v1';
function saveGame() {
  if (!started) return;
  try {
    const data = {
      version: 1,
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
      plot: {
        ...plot,
        revealed: { ...plot.revealed },
      },
      clockMinute: gameClock.state.currentMinute,
      assassinSpawned: !!assassinGroup,
      assassinIds: assassinGroup ? assassinGroup.enemies.map(e => ({ kind: e.kind, hp: e.character.hp, x: e.body.position.x, y: e.body.position.y, z: e.body.position.z, dead: e.isDead })) : [],
      pos: { x: player.body.position.x, y: player.body.position.y, z: player.body.position.z, yaw: player.yawAngle, pitch: player.pitch },
      clueAttempted: clueProps.map(c => ({ id: c.def.id, attempted: c.attempted })),
      log: combatLog.slice(-30),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    logCombat('Game saved.');
  } catch (err) {
    logCombat('Save failed.');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { logCombat('No save found.'); return; }
    const data = JSON.parse(raw);
    if (data.version !== 1) { logCombat('Save version mismatch.'); return; }
    sessionStorage.setItem('__pendingLoad', raw);
    window.location.reload();
  } catch (err) {
    logCombat('Load failed.');
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
      if (saved) c.attempted = saved.attempted;
    }
    for (const line of data.log) combatLog.push(line);
    renderStats();
    renderActionBar();
    renderObjectiveCard();
    started = true;
    startScreen!.style.display = 'none';
    setTimeout(() => renderer.domElement.requestPointerLock(), 200);
    logCombat('Game loaded.');
    return true;
  } catch (err) {
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

// Expose for debugging
(window as any).__debug = { world, physics, mansion, player, character, plot, OBJECTIVES, summary, gameClock, castMembers };

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

  // Sync cast meshes (they're dynamic bodies now)
  for (const cm of castMembers) cm.syncMesh();

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
