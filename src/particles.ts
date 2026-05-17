/**
 * Lightweight particle system for one-off bursts (sparks, smoke puffs).
 * `spawnBurst()` allocates a small THREE.Points cloud and lets it age out
 * over `lifeSeconds`. `tickParticles(dt)` advances and disposes finished bursts.
 */
import * as THREE from 'three';

interface Burst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  life: number;
  gravity: number;
}

const active: Burst[] = [];
/** Iter 64 perf: hard cap so rapid LMB triggers don't pile up GPU allocations. */
const MAX_ACTIVE_BURSTS = 8;
let _scene: THREE.Scene | null = null;
export function bindParticleScene(scene: THREE.Scene): void { _scene = scene; }

export interface BurstOpts {
  origin: { x: number; y: number; z: number };
  count?: number;
  color?: number;
  size?: number;
  spread?: number;
  speed?: number;
  gravity?: number;
  lifeSeconds?: number;
}

export function spawnBurst(opts: BurstOpts): void {
  if (!_scene) return;
  if (active.length >= MAX_ACTIVE_BURSTS) return; // overflow drop
  const count = opts.count ?? 24;
  const size = opts.size ?? 0.06;
  const spread = opts.spread ?? 0.6;
  const speed = opts.speed ?? 2.0;
  const life = opts.lifeSeconds ?? 0.7;

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = opts.origin.x;
    positions[i * 3 + 1] = opts.origin.y;
    positions[i * 3 + 2] = opts.origin.z;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * speed * (0.5 + Math.random() * spread);
    velocities[i * 3 + 1] = Math.cos(phi) * speed * (0.5 + Math.random() * spread);
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed * (0.5 + Math.random() * spread);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: opts.color ?? 0xffaa44,
    size, transparent: true, opacity: 0.95, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  _scene.add(points);
  active.push({ points, velocities, age: 0, life, gravity: opts.gravity ?? 4.0 });
}

export function tickParticles(dt: number): void {
  if (!_scene) return;
  for (let i = active.length - 1; i >= 0; i--) {
    const b = active[i];
    b.age += dt;
    const pos = b.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let p = 0; p < arr.length; p += 3) {
      arr[p]     += b.velocities[p]     * dt;
      arr[p + 1] += b.velocities[p + 1] * dt;
      arr[p + 2] += b.velocities[p + 2] * dt;
      b.velocities[p + 1] -= b.gravity * dt;
    }
    pos.needsUpdate = true;
    const t = 1 - b.age / b.life;
    (b.points.material as THREE.PointsMaterial).opacity = Math.max(0, t);
    if (b.age >= b.life) {
      _scene.remove(b.points);
      b.points.geometry.dispose();
      (b.points.material as THREE.PointsMaterial).dispose();
      active.splice(i, 1);
    }
  }
}
