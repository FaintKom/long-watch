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
import { rollPlot, rollObjectivesForParty, summarizeForPlayer, OBJECTIVES } from './plot';
import { GameClock } from './clock';
import { CAST, CastMember, CastId } from './cast';

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

// === Character ===
const character = new Character('Adventurer');
character.maxHp = 28; character.hp = 28; character.ac = 15;

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

gameClock.onTick = (e) => {
  paintClock();
  if (e.triggerWarning) console.log('[Long Watch] Half-hour warning — assassin draws near.');
  if (e.triggerAssassin) console.log('[Long Watch] The assassin has arrived. (Combat hook pending Iter later.)');
  if (e.triggerDawn) console.log('[Long Watch] Dawn breaks. The Heir survives.');
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

startBtn?.addEventListener('click', () => {
  if (started) return;
  started = true;
  startScreen!.style.display = 'none';
  renderer.domElement.requestPointerLock();
});

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
  const nearest = nearestCastMember();
  if (nearest) {
    interactHint.textContent = `[E] Speak with ${nearest.def.displayName}`;
    interactHint.style.display = 'block';
  } else {
    interactHint.style.display = 'none';
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
  if (inDialogueWith) {
    if (e.code === 'Escape') closeDialogue();
    return;
  }
  if (e.code === 'KeyE') {
    const cm = nearestCastMember();
    if (cm) openDialogue(cm);
  }
});

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
  renderer.render(scene, camera);
}
animate();
