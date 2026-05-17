import * as THREE from 'three';

/**
 * Mansion voxel palette.
 * IDs are stable for serialization. Add new blocks only at the end.
 */
export const BLOCK = {
  AIR: 0,
  WOOD_FLOOR: 1,
  WOOD_WALL: 2,
  PLASTER: 3,
  STONE: 4,
  MARBLE: 5,
  CARPET: 6,
  BRICK: 7,
  GLASS: 8,
  DARK_WOOD: 9,
  GOLD: 10,
  WATER: 11,
  DOOR: 12,
  IRON: 13,
} as const;

export type BlockType = (typeof BLOCK)[keyof typeof BLOCK];

const BLOCK_COLORS: Record<number, number> = {
  [BLOCK.WOOD_FLOOR]:  0x9a6e3a,
  [BLOCK.WOOD_WALL]:   0x6b4823,
  [BLOCK.PLASTER]:     0xd9cdb6,
  [BLOCK.STONE]:       0x6e6e6e,
  [BLOCK.MARBLE]:      0xddddd0,
  [BLOCK.CARPET]:      0x882233,
  [BLOCK.BRICK]:       0x884433,
  [BLOCK.GLASS]:       0x88bbcc,
  [BLOCK.DARK_WOOD]:   0x3d2814,
  [BLOCK.GOLD]:        0xd4a017,
  [BLOCK.WATER]:       0x2255aa,
  [BLOCK.DOOR]:        0x4a2f10,
  [BLOCK.IRON]:        0x4a4a55,
};

const TRANSPARENT_BLOCKS = new Set<number>([BLOCK.AIR, BLOCK.WATER, BLOCK.GLASS]);
const NON_SOLID_BLOCKS = new Set<number>([BLOCK.AIR, BLOCK.WATER]);

export class VoxelWorld {
  width: number;
  height: number;
  depth: number;
  data: Uint8Array;
  group: THREE.Group;
  private meshes: (THREE.InstancedMesh | THREE.Mesh)[] = [];

  constructor(w: number, h: number, d: number) {
    this.width = w;
    this.height = h;
    this.depth = d;
    this.data = new Uint8Array(w * h * d);
    this.group = new THREE.Group();
  }

  private idx(x: number, y: number, z: number): number {
    return x + z * this.width + y * this.width * this.depth;
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
  }

  set(x: number, y: number, z: number, type: BlockType) {
    if (this.inBounds(x, y, z)) this.data[this.idx(x, y, z)] = type;
  }

  get(x: number, y: number, z: number): BlockType {
    if (!this.inBounds(x, y, z)) return BLOCK.AIR;
    return this.data[this.idx(x, y, z)] as BlockType;
  }

  /** Solid for physics/pathing. Water is not solid. Glass IS solid (you can't walk through). */
  isSolid(x: number, y: number, z: number): boolean {
    const b = this.get(x, y, z);
    return !NON_SOLID_BLOCKS.has(b);
  }

  /** Opaque for face culling and LOS. Glass and water do not occlude. */
  isOpaque(x: number, y: number, z: number): boolean {
    const b = this.get(x, y, z);
    return !TRANSPARENT_BLOCKS.has(b);
  }

  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, type: BlockType) {
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          this.set(x, y, z, type);
  }

  rebuild() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
      else (m.material as THREE.Material).dispose();
      this.group.remove(m);
    }
    this.meshes = [];

    const blocksByType = new Map<number, THREE.Matrix4[]>();

    for (let y = 0; y < this.height; y++) {
      for (let z = 0; z < this.depth; z++) {
        for (let x = 0; x < this.width; x++) {
          const b = this.get(x, y, z);
          if (b === BLOCK.AIR) continue;

          const hasExposed =
            !this.isOpaque(x - 1, y, z) || !this.isOpaque(x + 1, y, z) ||
            !this.isOpaque(x, y - 1, z) || !this.isOpaque(x, y + 1, z) ||
            !this.isOpaque(x, y, z - 1) || !this.isOpaque(x, y, z + 1);

          if (!hasExposed) continue;

          if (!blocksByType.has(b)) blocksByType.set(b, []);
          const mat = new THREE.Matrix4();
          mat.setPosition(x + 0.5, y + 0.5, z + 0.5);
          blocksByType.get(b)!.push(mat);
        }
      }
    }

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    for (const [type, matrices] of blocksByType) {
      const color = BLOCK_COLORS[type] ?? 0xff00ff;
      const isGlass = type === BLOCK.GLASS;
      const isWater = type === BLOCK.WATER;
      const isMetallic = type === BLOCK.GOLD || type === BLOCK.IRON;

      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: isMetallic ? 0.35 : isGlass ? 0.1 : 0.85,
        metalness: isMetallic ? 0.7 : 0.0,
        transparent: isGlass || isWater,
        opacity: isGlass ? 0.35 : isWater ? 0.5 : 1.0,
      });

      const instanced = new THREE.InstancedMesh(boxGeo, material, matrices.length);
      for (let i = 0; i < matrices.length; i++) {
        instanced.setMatrixAt(i, matrices[i]);
      }
      // Iter 69 perf: voxel walls neither cast nor receive shadows. With
      // thousands of instances on PCFShadowMap, shadow pass ate GPU memory
      // until crash. Static voxel art looks fine flat-lit.
      instanced.castShadow = false;
      instanced.receiveShadow = false;
      this.group.add(instanced);
      this.meshes.push(instanced);
    }
  }
}
