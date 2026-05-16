/**
 * Act-2 catacombs sub-level (escape route).
 *
 * On trapdoor interaction main.ts calls:
 *   1. mansion `world.group.visible = false`
 *   2. catacombs root added to scene + static physics bodies registered
 *   3. player teleported to catacombs spawn (Y_OFFSET above mansion roof)
 *
 * Catacombs grid comes from `generateCatacombs(seed)` (Labyrinthos). We extrude
 * the 2D wall grid into 3D as 1x3x1 stone boxes with a stone floor + ceiling.
 *
 * Scope: walls + floor + ceiling + spawn + exit marker. No props, no extra NPCs
 * yet - the value is the escape geometry. Hostile encounter inside is a future
 * hook (spawn one mook party from the player-attacked-imminent flag).
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import type { PhysicsWorld } from './physics';
import { generateCatacombs, DungeonGrid } from './dungenGen';

/** Vertical offset so catacombs sit far above the mansion (mansion top ~y=8). */
const Y_OFFSET = 30;
const CELL = 1.5;
const WALL_HEIGHT = 3.0;

export interface Catacombs {
  root: THREE.Group;
  grid: DungeonGrid;
  /** World-space spawn point on the catacombs floor. */
  spawn: THREE.Vector3;
  /** World-space exit-tile center (player ends the level by stepping here). */
  exit: THREE.Vector3;
  /** Static physics bodies we registered (for later cleanup). */
  bodies: CANNON.Body[];
  /** Returns true when world position is within `tolerance` (tiles) of the exit center. */
  isOnExit(pos: { x: number; y: number; z: number }, tolerance?: number): boolean;
  dispose(): void;
}

export function buildCatacombs(scene: THREE.Scene, physics: PhysicsWorld, opts: { seed?: number } = {}): Catacombs {
  const grid = generateCatacombs(opts.seed);
  const root = new THREE.Group();
  root.name = 'catacombs';
  root.position.y = Y_OFFSET;
  scene.add(root);

  const bodies: CANNON.Body[] = [];

  // --- Floor ---
  const floorGeo = new THREE.BoxGeometry(grid.width * CELL, 0.4, grid.height * CELL);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.position.set((grid.width * CELL) / 2 - CELL / 2, -0.2, (grid.height * CELL) / 2 - CELL / 2);
  floor.receiveShadow = true;
  root.add(floor);
  bodies.push(physics.addStaticBox(
    floor.position.x, floor.position.y + Y_OFFSET, floor.position.z,
    grid.width * CELL, 0.4, grid.height * CELL,
  ));

  // --- Ceiling cap ---
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x1a1820, roughness: 0.95 });
  const ceil = new THREE.Mesh(floorGeo, ceilMat);
  ceil.position.set((grid.width * CELL) / 2 - CELL / 2, WALL_HEIGHT + 0.2, (grid.height * CELL) / 2 - CELL / 2);
  root.add(ceil);

  // --- Walls (InstancedMesh + per-cell static colliders) ---
  const wallGeo = new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4248, roughness: 0.85 });
  const walls = new THREE.InstancedMesh(wallGeo, wallMat, grid.width * grid.height);
  walls.castShadow = true;
  walls.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let wallCount = 0;
  for (let z = 0; z < grid.height; z++) {
    for (let x = 0; x < grid.width; x++) {
      if (!grid.isWall(x, z)) continue;
      const wx = x * CELL;
      const wy = WALL_HEIGHT / 2;
      const wz = z * CELL;
      dummy.position.set(wx, wy, wz);
      dummy.updateMatrix();
      walls.setMatrixAt(wallCount++, dummy.matrix);
      bodies.push(physics.addStaticBox(wx, wy + Y_OFFSET, wz, CELL, WALL_HEIGHT, CELL));
    }
  }
  walls.count = wallCount;
  walls.instanceMatrix.needsUpdate = true;
  root.add(walls);

  // --- Lights ---
  const ambient = new THREE.AmbientLight(0x223344, 0.4);
  root.add(ambient);
  // Sparse torches along open tiles.
  let torchN = 0;
  for (let z = 1; z < grid.height; z++) {
    for (let x = 1; x < grid.width; x++) {
      if (!grid.isFloor(x, z)) continue;
      if ((torchN++) % 18 !== 0) continue;
      const t = new THREE.PointLight(0xffaa66, 1.4, 8, 1.5);
      t.position.set(x * CELL, WALL_HEIGHT - 0.4, z * CELL);
      root.add(t);
    }
  }

  // --- Spawn + exit markers ---
  const spawn = new THREE.Vector3(grid.spawn.x * CELL, 0.5 + Y_OFFSET, grid.spawn.y * CELL);
  const exit = new THREE.Vector3(grid.exit.x * CELL, 0.5 + Y_OFFSET, grid.exit.y * CELL);

  const exitMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.7, 24),
    new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  exitMarker.rotation.x = -Math.PI / 2;
  exitMarker.position.set(grid.exit.x * CELL, 0.05, grid.exit.y * CELL);
  root.add(exitMarker);

  const exitGlow = new THREE.PointLight(0xffcc44, 2.0, 6, 2);
  exitGlow.position.set(grid.exit.x * CELL, 1, grid.exit.y * CELL);
  root.add(exitGlow);

  function isOnExit(pos: { x: number; y: number; z: number }, tolerance = 1.0): boolean {
    if (Math.abs(pos.y - exit.y) > 3.0) return false;
    const dx = pos.x - exit.x;
    const dz = pos.z - exit.z;
    return Math.sqrt(dx * dx + dz * dz) < tolerance * CELL;
  }

  function dispose(): void {
    scene.remove(root);
    for (const b of bodies) physics.removeBody(b);
    bodies.length = 0;
    wallGeo.dispose();
    wallMat.dispose();
    floorGeo.dispose();
    floorMat.dispose();
    ceilMat.dispose();
  }

  return { root, grid, spawn, exit, bodies, isOnExit, dispose };
}
