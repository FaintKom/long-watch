/**
 * Builds the Fletcher manor — the playable level for Long Watch.
 *
 * Coordinate system (top-down):
 *   x = 0..49 (west to east)
 *   z = 0..49 (north to south)
 *   y: floor 1 ground = 1..4 (with floor slab at 0, ceiling at 5)
 *      floor 2 upper  = 6..9 (floor slab at 5, ceiling at 10)
 *      total height MAP_H = 12
 *
 * Room layout (floor 1):
 *   z 1-14:  Study | Entry Hall | Dining Hall | Kitchen
 *   z 15-28: Library | Main Hallway | Drawing Room | Servants' Hall
 *   z 29-48: Courtyard (large open) | Garden (smaller)
 *
 * Room layout (floor 2):
 *   z 1-14:  Matriarch's Bedroom | Upper Balcony | Heir's Bedroom | Right Hand's Office
 *   z 15-28: Guest A | Guest B | Servants' Quarters | Storage
 *   z 29-48: open above courtyard (no upper floor over that area)
 */

import { BlockType, BLOCK, VoxelWorld } from './world';
import { PhysicsWorld } from './physics';
import * as THREE from 'three';

export const MAP_W = 50;
export const MAP_H = 12;
export const MAP_D = 50;

export const FLOOR1_Y = 0;
export const FLOOR1_TOP = 4;
export const FLOOR2_Y = 5;
export const FLOOR2_TOP = 9;
export const ROOF_Y = 10;

export interface MansionLandmark {
  id: string;
  floor: 1 | 2;
  x: number;
  z: number;
  label: string;
}

export interface MansionData {
  landmarks: Record<string, MansionLandmark>;
  spawnPoint: THREE.Vector3;
  heirSpot: THREE.Vector3;
  matriarchSpot: THREE.Vector3;
  windowSpots: { x: number; y: number; z: number }[];
  lamps: { x: number; y: number; z: number; color: number; intensity: number }[];
}

function wallX(world: VoxelWorld, x0: number, x1: number, z: number, yLo: number, yHi: number, type: BlockType) {
  world.fill(x0, yLo, z, x1, yHi, z, type);
}

function wallZ(world: VoxelWorld, x: number, z0: number, z1: number, yLo: number, yHi: number, type: BlockType) {
  world.fill(x, yLo, z0, x, yHi, z1, type);
}

function carveDoor(world: VoxelWorld, x0: number, z0: number, x1: number, z1: number, yLo: number, yHi: number) {
  world.fill(x0, yLo, z0, x1, yHi, z1, BLOCK.AIR);
}

function placeWindow(world: VoxelWorld, x0: number, z0: number, x1: number, z1: number, yLo: number, yHi: number) {
  world.fill(x0, yLo, z0, x1, yHi, z1, BLOCK.GLASS);
}

function rect(world: VoxelWorld, x0: number, z0: number, x1: number, z1: number, yLo: number, yHi: number, type: BlockType) {
  for (let x = x0; x <= x1; x++) {
    for (let y = yLo; y <= yHi; y++) {
      world.set(x, y, z0, type);
      world.set(x, y, z1, type);
    }
  }
  for (let z = z0; z <= z1; z++) {
    for (let y = yLo; y <= yHi; y++) {
      world.set(x0, y, z, type);
      world.set(x1, y, z, type);
    }
  }
}

export function buildMansion(world: VoxelWorld, physics: PhysicsWorld, scene: THREE.Scene): MansionData {
  // === FLOORS ===
  world.fill(0, FLOOR1_Y, 0, MAP_W - 1, FLOOR1_Y, MAP_D - 1, BLOCK.WOOD_FLOOR);
  world.fill(11, FLOOR1_Y, 1, 24, FLOOR1_Y, 14, BLOCK.MARBLE);                // Entry Hall floor
  world.fill(15, FLOOR1_Y, 15, 20, FLOOR1_Y, 28, BLOCK.CARPET);               // Hallway runner
  world.fill(0, FLOOR1_Y, 29, 30, FLOOR1_Y, 48, BLOCK.STONE);                 // Courtyard stone
  world.fill(31, FLOOR1_Y, 29, 49, FLOOR1_Y, 48, BLOCK.MARBLE);               // Garden tiles

  // === FLOOR 2 SLAB ===
  world.fill(0, FLOOR2_Y, 0, MAP_W - 1, FLOOR2_Y, 28, BLOCK.WOOD_FLOOR);
  world.fill(13, FLOOR2_Y, 4, 22, FLOOR2_Y, 11, BLOCK.AIR);                   // Open balcony above Entry Hall

  // === ROOF ===
  world.fill(0, ROOF_Y, 0, MAP_W - 1, ROOF_Y, 28, BLOCK.WOOD_WALL);

  // === OUTER WALLS ===
  rect(world, 0, 0, MAP_W - 1, 28, 1, FLOOR1_TOP, BLOCK.PLASTER);
  rect(world, 0, 29, 30, 48, 1, FLOOR1_TOP, BLOCK.STONE);
  rect(world, 31, 29, 49, 48, 1, FLOOR1_TOP, BLOCK.STONE);
  rect(world, 0, 0, MAP_W - 1, 28, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);

  // === FLOOR 1 INTERIOR WALLS ===
  wallX(world, 0, MAP_W - 1, 14, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallX(world, 0, MAP_W - 1, 28, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 10, 1, 13, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 25, 1, 13, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 35, 1, 13, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 10, 15, 27, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 21, 15, 27, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 35, 15, 27, 1, FLOOR1_TOP, BLOCK.PLASTER);
  wallZ(world, 30, 29, 48, 1, FLOOR1_TOP, BLOCK.STONE);

  // === FLOOR 2 INTERIOR WALLS ===
  wallX(world, 0, MAP_W - 1, 14, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 12, 1, 13, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 23, 1, 13, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 35, 1, 13, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 13, 15, 27, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 25, 15, 27, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);
  wallZ(world, 38, 15, 27, FLOOR2_Y + 1, FLOOR2_TOP, BLOCK.PLASTER);

  // === DOORWAYS (carve through walls) ===
  carveDoor(world, 17, 14, 18, 14, 1, 3);
  carveDoor(world, 17, 28, 18, 28, 1, 3);
  carveDoor(world, 10, 6, 10, 7, 1, 3);
  carveDoor(world, 25, 6, 25, 7, 1, 3);
  carveDoor(world, 35, 6, 35, 7, 1, 3);
  carveDoor(world, 10, 20, 10, 21, 1, 3);
  carveDoor(world, 21, 20, 21, 21, 1, 3);
  carveDoor(world, 35, 20, 35, 21, 1, 3);
  carveDoor(world, 30, 36, 30, 37, 1, 3);
  carveDoor(world, 17, 0, 18, 0, 1, 3);
  carveDoor(world, MAP_W - 1, 20, MAP_W - 1, 21, 1, 3);

  carveDoor(world, 12, 6, 12, 7, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 23, 6, 23, 7, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 35, 6, 35, 7, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 13, 20, 13, 21, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 25, 20, 25, 21, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 38, 20, 38, 21, FLOOR2_Y + 1, FLOOR2_Y + 3);
  carveDoor(world, 18, 14, 19, 14, FLOOR2_Y + 1, FLOOR2_Y + 3);

  // === STAIRS ===
  for (let s = 0; s < 4; s++) {
    const stepY = 1 + s;
    const stepZ = 11 - s;
    world.fill(17, stepY, stepZ, 18, stepY, stepZ, BLOCK.WOOD_FLOOR);
  }
  world.fill(17, FLOOR2_Y, 7, 18, FLOOR2_Y, 8, BLOCK.AIR);

  for (let s = 0; s < 4; s++) {
    const stepY = 1 + s;
    const stepZ = 24 + s;
    world.fill(40, stepY, stepZ, 41, stepY, stepZ, BLOCK.WOOD_FLOOR);
  }
  world.fill(40, FLOOR2_Y, 27, 41, FLOOR2_Y, 28, BLOCK.AIR);

  // === WINDOWS ===
  const windowSpots: { x: number; y: number; z: number }[] = [];
  placeWindow(world, 4, 0, 5, 0, 2, 3); windowSpots.push({ x: 4, y: 2, z: 0 });
  placeWindow(world, 28, 0, 29, 0, 2, 3); windowSpots.push({ x: 28, y: 2, z: 0 });
  placeWindow(world, 40, 0, 41, 0, 2, 3); windowSpots.push({ x: 40, y: 2, z: 0 });
  placeWindow(world, 29, 0, 30, 0, FLOOR2_Y + 2, FLOOR2_Y + 3);
  windowSpots.push({ x: 29, y: FLOOR2_Y + 2, z: 0 });
  placeWindow(world, 0, 20, 0, 21, 2, 3); windowSpots.push({ x: 0, y: 2, z: 20 });

  // === FIREPLACES (brick) ===
  world.fill(2, 1, 1, 3, 3, 1, BLOCK.BRICK);
  world.fill(25, 1, 27, 26, 3, 27, BLOCK.BRICK);
  world.fill(30, 1, 1, 31, 3, 1, BLOCK.BRICK);

  // === FURNITURE STUBS ===
  world.fill(5, 1, 8, 7, 1, 9, BLOCK.DARK_WOOD);                 // Study desk
  world.fill(28, 1, 4, 33, 1, 11, BLOCK.DARK_WOOD);              // Dining table
  world.fill(15, 1, 24, 17, 2, 26, BLOCK.DARK_WOOD);             // Drawing room piano
  world.fill(1, 1, 16, 1, 3, 27, BLOCK.DARK_WOOD);               // Library shelves
  world.fill(26, FLOOR2_Y + 1, 9, 28, FLOOR2_Y + 1, 12, BLOCK.DARK_WOOD); // Heir's bed
  world.fill(3, FLOOR2_Y + 1, 9, 5, FLOOR2_Y + 1, 12, BLOCK.DARK_WOOD);   // Matriarch's bed
  world.fill(40, FLOOR2_Y + 1, 8, 43, FLOOR2_Y + 1, 9, BLOCK.DARK_WOOD);  // Right Hand desk

  // === LAMP POSITIONS ===
  const lamps = [
    { x: 18, y: 3.5, z: 7, color: 0xffcc66, intensity: 1.8 },
    { x: 5,  y: 3.5, z: 5, color: 0xff9944, intensity: 1.0 },
    { x: 30, y: 3.5, z: 7, color: 0xff9944, intensity: 1.2 },
    { x: 42, y: 3.5, z: 7, color: 0xff9944, intensity: 1.0 },
    { x: 5,  y: 3.5, z: 22, color: 0xff9944, intensity: 1.0 },
    { x: 16, y: 3.5, z: 22, color: 0xff9944, intensity: 0.9 },
    { x: 28, y: 3.5, z: 22, color: 0xff9944, intensity: 1.0 },
    { x: 42, y: 3.5, z: 22, color: 0xff9944, intensity: 1.0 },
    { x: 15, y: 3.5, z: 38, color: 0x8899bb, intensity: 0.8 },
    { x: 40, y: 3.5, z: 38, color: 0x8899bb, intensity: 0.6 },
    { x: 6,  y: FLOOR2_Y + 3.5, z: 7,  color: 0xff9944, intensity: 1.0 },
    { x: 17, y: FLOOR2_Y + 3.5, z: 7,  color: 0xffcc66, intensity: 1.2 },
    { x: 28, y: FLOOR2_Y + 3.5, z: 7,  color: 0xff9944, intensity: 1.0 },
    { x: 42, y: FLOOR2_Y + 3.5, z: 7,  color: 0xff9944, intensity: 1.0 },
    { x: 7,  y: FLOOR2_Y + 3.5, z: 22, color: 0xff9944, intensity: 0.9 },
    { x: 19, y: FLOOR2_Y + 3.5, z: 22, color: 0xff9944, intensity: 0.9 },
    { x: 32, y: FLOOR2_Y + 3.5, z: 22, color: 0xff9944, intensity: 0.9 },
    { x: 44, y: FLOOR2_Y + 3.5, z: 22, color: 0xff9944, intensity: 0.9 },
  ];

  // === BUILD PHYSICS COLLIDERS ===
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

  // === LAMPS ===
  for (const lamp of lamps) {
    const light = new THREE.PointLight(lamp.color, lamp.intensity, 16, 1.4);
    light.position.set(lamp.x + 0.5, lamp.y, lamp.z + 0.5);
    light.castShadow = false;
    scene.add(light);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshBasicMaterial({ color: lamp.color }),
    );
    glow.position.copy(light.position);
    scene.add(glow);
  }

  const moon = new THREE.DirectionalLight(0x6688bb, 0.25);
  moon.position.set(20, 30, 35);
  moon.target.position.set(15, 0, 38);
  scene.add(moon);
  scene.add(moon.target);

  world.rebuild();

  const landmarks: Record<string, MansionLandmark> = {
    entry_hall:        { id: 'entry_hall',        floor: 1, x: 17, z: 8,  label: 'Entry Hall' },
    study:             { id: 'study',             floor: 1, x: 5,  z: 6,  label: "Matriarch's Study" },
    dining_hall:       { id: 'dining_hall',       floor: 1, x: 30, z: 7,  label: 'Dining Hall' },
    kitchen:           { id: 'kitchen',           floor: 1, x: 42, z: 7,  label: 'Kitchen' },
    library:           { id: 'library',           floor: 1, x: 5,  z: 21, label: 'Library' },
    hallway:           { id: 'hallway',           floor: 1, x: 17, z: 21, label: 'Main Hallway' },
    drawing_room:      { id: 'drawing_room',      floor: 1, x: 28, z: 21, label: 'Drawing Room' },
    servants_hall:     { id: 'servants_hall',     floor: 1, x: 42, z: 21, label: "Servants' Hall" },
    courtyard:         { id: 'courtyard',         floor: 1, x: 15, z: 38, label: 'Courtyard' },
    garden:            { id: 'garden',            floor: 1, x: 40, z: 38, label: 'Garden' },
    matriarch_bedroom: { id: 'matriarch_bedroom', floor: 2, x: 6,  z: 6,  label: "Matriarch's Bedroom" },
    upper_balcony:     { id: 'upper_balcony',     floor: 2, x: 17, z: 7,  label: 'Upper Balcony' },
    heir_bedroom:      { id: 'heir_bedroom',      floor: 2, x: 28, z: 7,  label: "Heir's Bedroom" },
    right_hand_office: { id: 'right_hand_office', floor: 2, x: 42, z: 7,  label: "Right Hand's Office" },
    guest1:            { id: 'guest1',            floor: 2, x: 6,  z: 21, label: 'Guest Room A' },
    guest2:            { id: 'guest2',            floor: 2, x: 19, z: 21, label: 'Guest Room B' },
    servants_quarters: { id: 'servants_quarters', floor: 2, x: 32, z: 21, label: "Servants' Quarters" },
    storage:           { id: 'storage',           floor: 2, x: 44, z: 21, label: 'Storage' },
  };

  return {
    landmarks,
    spawnPoint: new THREE.Vector3(17.5, 2, 12),
    heirSpot: new THREE.Vector3(27.5, FLOOR2_Y + 2, 10.5),
    matriarchSpot: new THREE.Vector3(17.5, 2, 8),
    windowSpots,
    lamps,
  };
}
