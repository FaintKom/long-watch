/**
 * Long Watch — entry.
 * Iter 1: core engine wired (voxel world, physics, FPS player, character).
 * A small test room is built so the engine + controls can be exercised before
 * the full mansion (Iter 2) lands.
 */
import * as THREE from 'three';
import { VoxelWorld, BLOCK } from './world';
import { PhysicsWorld } from './physics';
import { Player } from './player';
import { Character } from './character';

const MAP_W = 24;
const MAP_H = 8;
const MAP_D = 24;

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
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1612);
scene.fog = new THREE.FogExp2(0x1a1612, 0.025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);

scene.add(new THREE.AmbientLight(0x556677, 0.55));
scene.add(new THREE.HemisphereLight(0x668899, 0x332211, 0.45));

// === World + Physics ===
const world = new VoxelWorld(MAP_W, MAP_H, MAP_D);
const physics = new PhysicsWorld();

// Build a small test parlour: wood floor, plaster walls, carpet runner, fireplace,
// chandelier candle, window.
world.fill(0, 0, 0, MAP_W - 1, 0, MAP_D - 1, BLOCK.WOOD_FLOOR);
// Carpet runner
world.fill(10, 0, 4, 13, 0, MAP_D - 5, BLOCK.CARPET);
// Outer walls (plaster)
const WALL_H = 4;
world.fill(0, 1, 0, MAP_W - 1, WALL_H, 0, BLOCK.PLASTER);
world.fill(0, 1, MAP_D - 1, MAP_W - 1, WALL_H, MAP_D - 1, BLOCK.PLASTER);
world.fill(0, 1, 0, 0, WALL_H, MAP_D - 1, BLOCK.PLASTER);
world.fill(MAP_W - 1, 1, 0, MAP_W - 1, WALL_H, MAP_D - 1, BLOCK.PLASTER);
// Windows on one wall
world.fill(6, 2, 0, 7, 3, 0, BLOCK.GLASS);
world.fill(16, 2, 0, 17, 3, 0, BLOCK.GLASS);
// Fireplace (brick)
world.fill(11, 1, 0, 12, 3, 0, BLOCK.BRICK);
world.set(11, 1, 1, BLOCK.BRICK);
world.set(12, 1, 1, BLOCK.BRICK);
// Dining table (dark wood)
world.fill(10, 1, 14, 13, 1, 18, BLOCK.DARK_WOOD);
// Bookshelves
world.fill(1, 1, 2, 1, 3, 8, BLOCK.DARK_WOOD);
world.fill(MAP_W - 2, 1, 2, MAP_W - 2, 3, 8, BLOCK.DARK_WOOD);
// Doorway in far wall
world.fill(11, 1, MAP_D - 1, 12, 3, MAP_D - 1, BLOCK.AIR);

// Add static physics colliders for solid blocks (only those with exposed face)
for (let y = 0; y < MAP_H; y++) {
  for (let z = 0; z < MAP_D; z++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!world.isSolid(x, y, z)) continue;
      const exposed =
        !world.isSolid(x - 1, y, z) || !world.isSolid(x + 1, y, z) ||
        !world.isSolid(x, y - 1, z) || !world.isSolid(x, y + 1, z) ||
        !world.isSolid(x, y, z - 1) || !world.isSolid(x, y, z + 1);
      if (!exposed) continue;
      physics.addStaticBox(x + 0.5, y + 0.5, z + 0.5, 1, 1, 1);
    }
  }
}

world.rebuild();
scene.add(world.group);

// Warm lamp lights in the room
function addLamp(x: number, y: number, z: number, color = 0xffaa44, intensity = 1.0) {
  const light = new THREE.PointLight(color, intensity, 12, 1.5);
  light.position.set(x, y, z);
  scene.add(light);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 6, 6),
    new THREE.MeshBasicMaterial({ color }),
  );
  glow.position.set(x, y, z);
  scene.add(glow);
}
addLamp(6, 3.2, 4, 0xff9a44, 1.2);
addLamp(MAP_W - 6, 3.2, 4, 0xff9a44, 1.2);
addLamp(MAP_W / 2, 3.3, MAP_D / 2, 0xffcc66, 1.5);
addLamp(11.5, 2.3, 0.5, 0xff7733, 1.4); // fireplace

// === Player ===
const player = new Player(camera, physics, world);
player.setPosition(MAP_W / 2, 2, MAP_D / 2 + 3);
scene.add(player.yaw);

// === Character ===
const character = new Character('Adventurer');
// Long Watch starting stats are roughly balanced; we keep auto-rolled for now
character.maxHp = 28;
character.hp = 28;
character.ac = 15;

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

if (objEl) {
  objEl.innerHTML =
    '<h4>SECRET OBJECTIVE</h4>' +
    '<div class="obj-name">Oblivious</div>' +
    '<div class="obj-text">You have no secret objective. Why do you ask?</div>';
}

// === Game clock (placeholder — full event-time hybrid lands in later iter) ===
let started = false;
let clockMin = 21 * 60; // 9:00 PM
function formatClock(totalMin: number): string {
  const h24 = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const period = h24 >= 12 && h24 < 24 ? 'PM' : 'AM';
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}
setInterval(() => {
  if (!started) return;
  clockMin++;
  if (clockEl) clockEl.textContent = formatClock(clockMin);
}, 2500); // 1 in-game minute every 2.5 real sec, placeholder pacing

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

// === Game loop ===
let prevTime = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  if (!started) { renderer.render(scene, camera); return; }

  physics.step(dt);
  player.update(dt);
  renderer.render(scene, camera);
}
animate();
