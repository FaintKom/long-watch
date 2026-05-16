/**
 * Long Watch — entry stub.
 * Engine systems (voxel world, physics, combat, classes, AI NPCs, etc.) will be
 * ported in over the next commits from the voxel-rpg base.
 *
 * This stub just wires the start screen + a placeholder scene so the project boots.
 */
import * as THREE from 'three';

const startBtn = document.getElementById('start-btn');
const startScreen = document.getElementById('start-screen');
const clockEl = document.getElementById('clock');
const statsEl = document.getElementById('stats-panel');
const objEl = document.getElementById('objective-card');

if (statsEl) {
  statsEl.innerHTML =
    '<b style="color:#fc4">Adventurer</b> Lv4<br>' +
    '<span style="color:#aaa">STR</span> <span style="color:#fc4">14</span> ' +
    '<span style="color:#aaa">DEX</span> <span style="color:#fc4">14</span> ' +
    '<span style="color:#aaa">CON</span> <span style="color:#fc4">14</span><br>' +
    '<span style="color:#aaa">HP</span> <span style="color:#6cf">28/28</span> ' +
    '<span style="color:#aaa">AC</span> <span style="color:#6cf">15</span>';
}

if (objEl) {
  objEl.innerHTML =
    '<h4>SECRET OBJECTIVE</h4>' +
    '<div class="obj-name">Oblivious</div>' +
    '<div class="obj-text">You have no secret objective. Why do you ask?</div>';
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111118);
scene.fog = new THREE.FogExp2(0x111118, 0.025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 5);

scene.add(new THREE.AmbientLight(0x556677, 0.6));
scene.add(new THREE.HemisphereLight(0x668899, 0x332211, 0.5));

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x4a4239, roughness: 0.85 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const lampLight = new THREE.PointLight(0xffaa44, 1.2, 12);
lampLight.position.set(0, 2, 0);
scene.add(lampLight);

const lampMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xffaa44 }),
);
lampMesh.position.copy(lampLight.position);
scene.add(lampMesh);

let started = false;

startBtn?.addEventListener('click', () => {
  if (started) return;
  started = true;
  startScreen!.style.display = 'none';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

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
}, 1000);

function animate() {
  requestAnimationFrame(animate);
  camera.position.x = Math.sin(performance.now() * 0.0003) * 4;
  camera.position.z = Math.cos(performance.now() * 0.0003) * 4;
  camera.lookAt(0, 1.6, 0);
  renderer.render(scene, camera);
}
animate();
