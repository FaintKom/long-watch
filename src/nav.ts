/**
 * Per-entity navigator built on rot-js A*.
 *
 * Each AI entity owns one `Navigator` and calls `steerToward(myPos, targetPos, floorY)`
 * every tick. The navigator caches the last-computed path and only re-plans when:
 *   - target tile changed, OR
 *   - `replanIntervalMs` has elapsed since the last plan, OR
 *   - the entity drifted too far from the cached path.
 *
 * Returns a unit-length (dx, dz) steering vector pointing at the next waypoint,
 * or `null` if no path was found (caller should fall back to straight-line or idle).
 *
 * Iter 59: multi-floor routing via registered stair portals. When the target is
 * on a different floor than the entity, steerToward picks the nearest portal
 * endpoint on the entity's own floor and routes there. Once the entity climbs
 * the stairs (physics-driven), the next tick sees the new floor Y and replans
 * directly to the real target.
 */
import { Path } from 'rot-js';

export interface NavWorld {
  isSolid(x: number, y: number, z: number): boolean;
}

/**
 * Module-level world reference. Set once at boot from main.ts so individual
 * entities don't have to thread the world through their constructors.
 */
let _navWorld: NavWorld | null = null;
export function setNavWorld(w: NavWorld): void { _navWorld = w; }
export function hasNavWorld(): boolean { return _navWorld !== null; }

/** Stair portal pairs. Each portal links a low Y endpoint to a high Y endpoint. */
const _portals: { low: Vec3; high: Vec3 }[] = [];
export function registerPortal(low: Vec3, high: Vec3): void {
  _portals.push({ low: { ...low }, high: { ...high } });
}
export function clearPortals(): void { _portals.length = 0; }
export function portalCount(): number { return _portals.length; }

/** For a given entity Y, return the endpoint on the same floor + opposite endpoint. */
function nearestPortal(my: Vec3): { mine: Vec3; far: Vec3 } | null {
  if (_portals.length === 0) return null;
  let best: { mine: Vec3; far: Vec3; d: number } | null = null;
  for (const p of _portals) {
    const lowDy = Math.abs(my.y - p.low.y);
    const highDy = Math.abs(my.y - p.high.y);
    const onLow = lowDy <= highDy;
    const mine = onLow ? p.low : p.high;
    const far = onLow ? p.high : p.low;
    const dx = mine.x - my.x;
    const dz = mine.z - my.z;
    const d = dx * dx + dz * dz;
    if (!best || d < best.d) best = { mine, far, d };
  }
  return best ? { mine: best.mine, far: best.far } : null;
}

export interface Vec3 { x: number; y: number; z: number }

interface CachedPath {
  waypoints: { x: number; z: number }[];
  /** Index of the next waypoint to head toward. */
  cursor: number;
  /** Target tile that the path was computed for. */
  targetX: number;
  targetZ: number;
  /** Wall-clock when path was computed. */
  computedAt: number;
}

export class Navigator {
  private cache: CachedPath | null = null;
  /** Min ms between re-plans even if target unchanged. */
  replanIntervalMs = 1500;
  /** If entity drifts farther than this from cached path, force replan. */
  driftTiles = 2.5;

  constructor(private world: NavWorld | null = null) {}

  private resolveWorld(): NavWorld | null {
    return this.world ?? _navWorld;
  }

  /**
   * Compute a steering vector toward `target`. The vector is unit-length in world units.
   * Returns null if no path.
   */
  steerToward(my: Vec3, target: Vec3, floorY?: number): { dx: number; dz: number } | null {
    const world = this.resolveWorld();
    if (!world) return null;
    const fy = Math.floor(floorY ?? my.y);

    // Cross-floor: route via nearest portal endpoint on entity's floor.
    let effectiveTarget = target;
    if (Math.abs(target.y - my.y) > 2) {
      const portal = nearestPortal(my);
      if (!portal) return null; // no portal registered, caller falls back
      effectiveTarget = portal.mine;
    }

    const mx = Math.floor(my.x);
    const mz = Math.floor(my.z);
    const tx = Math.floor(effectiveTarget.x);
    const tz = Math.floor(effectiveTarget.z);

    if (mx === tx && mz === tz) return { dx: 0, dz: 0 };

    const now = performance.now();
    const targetMoved = !this.cache || this.cache.targetX !== tx || this.cache.targetZ !== tz;
    const stale = !this.cache || (now - this.cache.computedAt) > this.replanIntervalMs;
    const drifted = this.cache ? this.distanceToPath(mx, mz) > this.driftTiles : true;

    if (targetMoved || stale || drifted) {
      this.replan(mx, mz, tx, tz, fy, now, world);
    }

    if (!this.cache || this.cache.waypoints.length === 0) return null;

    // Advance cursor past waypoints we have already reached.
    while (
      this.cache.cursor < this.cache.waypoints.length - 1 &&
      this.cache.waypoints[this.cache.cursor].x === mx &&
      this.cache.waypoints[this.cache.cursor].z === mz
    ) {
      this.cache.cursor++;
    }
    const wp = this.cache.waypoints[this.cache.cursor];
    if (!wp) return null;

    const dx = (wp.x + 0.5) - my.x;
    const dz = (wp.z + 0.5) - my.z;
    const mag = Math.sqrt(dx * dx + dz * dz);
    if (mag < 0.0001) return { dx: 0, dz: 0 };
    return { dx: dx / mag, dz: dz / mag };
  }

  private replan(fromX: number, fromZ: number, toX: number, toZ: number, floorY: number, now: number, world: NavWorld): void {
    // Passable: foot and head voxels at this floor must NOT be solid.
    const passable = (x: number, z: number) => {
      if (world.isSolid(x, floorY, z)) return false;
      if (world.isSolid(x, floorY + 1, z)) return false;
      return true;
    };
    if (!passable(toX, toZ)) {
      // Snap target to an open neighbor.
      const neighbors: [number, number][] = [
        [toX + 1, toZ], [toX - 1, toZ], [toX, toZ + 1], [toX, toZ - 1],
        [toX + 1, toZ + 1], [toX - 1, toZ - 1], [toX + 1, toZ - 1], [toX - 1, toZ + 1],
      ];
      const ok = neighbors.find(([x, z]) => passable(x, z));
      if (!ok) {
        this.cache = null;
        return;
      }
      toX = ok[0];
      toZ = ok[1];
    }
    const astar = new Path.AStar(toX, toZ, passable, { topology: 8 });
    const waypoints: { x: number; z: number }[] = [];
    astar.compute(fromX, fromZ, (x: number, z: number) => waypoints.push({ x, z }));
    if (waypoints.length === 0) {
      this.cache = null;
      return;
    }
    this.cache = { waypoints, cursor: 0, targetX: toX, targetZ: toZ, computedAt: now };
  }

  private distanceToPath(mx: number, mz: number): number {
    if (!this.cache) return Infinity;
    let best = Infinity;
    for (const w of this.cache.waypoints) {
      const d = Math.abs(w.x - mx) + Math.abs(w.z - mz);
      if (d < best) best = d;
    }
    return best;
  }

  /** Force a replan on next call. Use after the entity teleports. */
  invalidate(): void {
    this.cache = null;
  }
}
