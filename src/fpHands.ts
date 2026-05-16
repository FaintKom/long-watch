/**
 * First-person weapon mesh rigged to the camera.
 *
 * `attachFpHands(camera, classId)` adds a class-themed weapon as a camera
 * child positioned in the lower-right. `swingAnim()` triggers a short rotation
 * tween. `tickFpHands(dt)` runs the tween and an idle bob.
 */
import * as THREE from 'three';
import type { ClassId } from './classes';

let weaponMesh: THREE.Mesh | null = null;
let weaponBase: { rx: number; ry: number; rz: number } = { rx: 0, ry: 0, rz: 0 };
let swingT = 0;

export function attachFpHands(camera: THREE.Camera, classId: ClassId): void {
  let geo: THREE.BufferGeometry;
  let color = 0xcccccc;
  switch (classId) {
    case 'fighter':
      geo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
      color = 0xddddee;
      break;
    case 'rogue':
      geo = new THREE.BoxGeometry(0.05, 0.3, 0.05);
      color = 0x444444;
      break;
    case 'wizard':
      geo = new THREE.BoxGeometry(0.05, 0.7, 0.05);
      color = 0x8b5a2b;
      break;
    case 'cleric':
      geo = new THREE.BoxGeometry(0.08, 0.45, 0.08);
      color = 0xc4a060;
      break;
    default:
      geo = new THREE.BoxGeometry(0.06, 0.5, 0.06);
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  weaponMesh = new THREE.Mesh(geo, mat);
  weaponMesh.position.set(0.28, -0.32, -0.6);
  weaponMesh.rotation.set(-0.3, -0.2, 0.4);
  weaponBase = { rx: weaponMesh.rotation.x, ry: weaponMesh.rotation.y, rz: weaponMesh.rotation.z };
  camera.add(weaponMesh);

  if (classId === 'wizard') {
    const tip = new THREE.PointLight(0x88aaff, 0.6, 1.2);
    tip.position.set(0, 0.4, 0);
    weaponMesh.add(tip);
  }
}

export function swingAnim(): void {
  swingT = 0.3;
}

export function tickFpHands(dt: number): void {
  if (!weaponMesh) return;
  if (swingT > 0) {
    swingT = Math.max(0, swingT - dt);
    const k = swingT / 0.3;
    weaponMesh.rotation.x = weaponBase.rx - (1 - k) * 0.9;
    weaponMesh.rotation.z = weaponBase.rz + (1 - k) * 0.7;
  } else {
    const t = performance.now() / 1000;
    weaponMesh.position.y = -0.32 + Math.sin(t * 1.4) * 0.01;
    weaponMesh.rotation.x = weaponBase.rx + Math.sin(t * 1.0) * 0.02;
  }
}
