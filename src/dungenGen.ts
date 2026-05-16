/**
 * Procedural dungeon generator built on Labyrinthos.js.
 *
 * Long Watch is a hand-built mansion, but Iter 35 wires Labyrinthos in for an
 * optional "catacombs" sub-level (act-2 escape route) and any future random
 * dungeon variants. The generator emits a 2D grid (0 = floor, 1 = wall) plus
 * picked spawn / exit tiles.
 *
 * Voxel build (extruding the grid into world.ts) is out of scope for this
 * iteration - use `gridToAscii()` to preview and decide on a builder later.
 */
import labyrinthos from 'labyrinthos';

export type DungeonAlgorithm =
  | 'RecursiveDivision'   // mostly-open rooms with carved walls - good for catacombs/crypts
  | 'RecursiveBacktrack'  // classic dense maze - good for sewer tunnels
  | 'CellularAutomata'    // organic caves
  | 'BinaryTree'
  | 'GrowingTree';

export interface DungeonOpts {
  width: number;
  height: number;
  algorithm?: DungeonAlgorithm;
  /** Seed for reproducible runs. */
  seed?: number;
}

export interface DungeonGrid {
  width: number;
  height: number;
  /** Row-major 1D array. 0 = floor, 1 = wall. */
  data: number[];
  at(x: number, y: number): number;
  isFloor(x: number, y: number): boolean;
  isWall(x: number, y: number): boolean;
  /** Picked spawn point (first reachable floor tile from top-left). */
  spawn: { x: number; y: number };
  /** Picked exit point (farthest reachable floor tile from spawn). */
  exit: { x: number; y: number };
}

interface LabTileMap {
  data: number[] | number[][];
  width: number;
  height: number;
  fill: (v: number) => void;
  seed?: (n: number) => void;
}

type LabRoot = {
  TileMap: new (o: { width: number; height: number }) => LabTileMap;
  mazes: Record<string, (tm: LabTileMap, opts: unknown) => void>;
};

const lab = labyrinthos as unknown as LabRoot;

export function generateDungeon(opts: DungeonOpts): DungeonGrid {
  const algorithm = opts.algorithm ?? 'RecursiveDivision';
  const tm = new lab.TileMap({ width: opts.width, height: opts.height });

  if (typeof tm.seed === 'function' && typeof opts.seed === 'number') {
    tm.seed(opts.seed);
  }

  // RecursiveDivision carves walls into open space (fill 0 first).
  // RecursiveBacktrack carves passages out of walls (fill 1 first).
  if (algorithm === 'RecursiveDivision') tm.fill(0);
  else tm.fill(1);

  const fn = lab.mazes[algorithm];
  if (!fn) throw new Error(`Unknown dungeon algorithm: ${algorithm}`);
  fn(tm, {});

  const raw = tm.data as number[] | number[][];
  const flat: number[] = Array.isArray(raw[0]) ? (raw as number[][]).flat() : (raw as number[]);

  const w = opts.width;
  const h = opts.height;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 1 : flat[y * w + x]);
  const isFloor = (x: number, y: number) => at(x, y) === 0;
  const isWall = (x: number, y: number) => at(x, y) === 1;

  let spawn = { x: 0, y: 0 };
  outer:
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (isFloor(x, y)) { spawn = { x, y }; break outer; }

  const exit = farthestFloor(spawn, w, h, flat);

  return { width: w, height: h, data: flat, at, isFloor, isWall, spawn, exit };
}

function farthestFloor(start: { x: number; y: number }, w: number, h: number, data: number[]): { x: number; y: number } {
  const dist = new Int32Array(w * h).fill(-1);
  const q: number[] = [start.x + start.y * w];
  dist[q[0]] = 0;
  let last = q[0];
  while (q.length > 0) {
    const cur = q.shift()!;
    last = cur;
    const cx = cur % w;
    const cy = Math.floor(cur / w);
    const ns: [number, number][] = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of ns) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (data[idx] !== 0) continue;
      if (dist[idx] !== -1) continue;
      dist[idx] = dist[cur] + 1;
      q.push(idx);
    }
  }
  return { x: last % w, y: Math.floor(last / w) };
}

/** ASCII representation. Walls = #, floors = . (spawn = S, exit = X). */
export function gridToAscii(grid: DungeonGrid): string {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = '';
    for (let x = 0; x < grid.width; x++) {
      if (grid.spawn.x === x && grid.spawn.y === y) row += 'S';
      else if (grid.exit.x === x && grid.exit.y === y) row += 'X';
      else row += grid.isFloor(x, y) ? '.' : '#';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

/**
 * Convenience: 30x20 RecursiveDivision catacombs under the mansion.
 * Use this when wiring the "escape via trapdoor" act-2 level later.
 */
export function generateCatacombs(seed?: number): DungeonGrid {
  return generateDungeon({ width: 30, height: 20, algorithm: 'RecursiveDivision', seed });
}
