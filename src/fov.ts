/**
 * Field-of-view and A* helpers backed by rot-js.
 *
 * Voxel world is 3D; rot-js works in 2D. We operate on a Y-slice taken at
 * `eyeY` (head height for a standing NPC on a given floor). Walls/doors
 * block visibility; open air does not.
 *
 * Uses:
 * - `isVisibleOnFloor(world, fromX, fromZ, toX, toZ, eyeY, range?, facing?)` -
 *   replaces raycast-only LOS with cone-of-vision support. If `facing` is given,
 *   target must lie inside the NPC's facing cone.
 * - `pathOnFloor(world, fromX, fromZ, toX, toZ, floorY)` - returns waypoint list
 *   for NPCs to follow instead of straight-line velocity. (Wired in Iter 33.)
 */
import { FOV, Path } from 'rot-js';

interface VoxelLike {
  isOpaque(x: number, y: number, z: number): boolean;
}

function opacityCb(world: VoxelLike, y: number): (x: number, z: number) => boolean {
  return (x, z) => !world.isOpaque(x, y, z);
}

/** Visibility on a single Y-slice with optional cone-of-vision gate. */
export function isVisibleOnFloor(
  world: VoxelLike,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  eyeY: number,
  range = 12,
  facing?: { dx: number; dz: number; coneRad: number },
): boolean {
  const ix = Math.floor(fromX);
  const iz = Math.floor(fromZ);
  const tx = Math.floor(toX);
  const tz = Math.floor(toZ);
  const dx = tx - ix;
  const dz = tz - iz;
  if (dx * dx + dz * dz > range * range) return false;

  if (facing) {
    const tlen = Math.sqrt(dx * dx + dz * dz);
    if (tlen > 0.0001) {
      const flen = Math.sqrt(facing.dx * facing.dx + facing.dz * facing.dz) || 1;
      const dot = (dx / tlen) * (facing.dx / flen) + (dz / tlen) * (facing.dz / flen);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > facing.coneRad) return false;
    }
  }

  const fov = new FOV.PreciseShadowcasting(opacityCb(world, Math.floor(eyeY)));
  let seen = false;
  fov.compute(ix, iz, range, (x: number, z: number) => {
    if (x === tx && z === tz) seen = true;
  });
  return seen;
}

/** A* path on a fixed-floor grid. Returns array of {x,z} waypoints incl. start+end. Empty if unreachable. */
export function pathOnFloor(
  world: VoxelLike,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  floorY: number,
): { x: number; z: number }[] {
  const ix = Math.floor(fromX);
  const iz = Math.floor(fromZ);
  const tx = Math.floor(toX);
  const tz = Math.floor(toZ);
  const fy = Math.floor(floorY);
  const passable = (x: number, z: number) => !world.isOpaque(x, fy, z) && !world.isOpaque(x, fy + 1, z);
  const astar = new Path.AStar(tx, tz, passable, { topology: 8 });
  const out: { x: number; z: number }[] = [];
  astar.compute(ix, iz, (x: number, z: number) => out.push({ x, z }));
  return out;
}
