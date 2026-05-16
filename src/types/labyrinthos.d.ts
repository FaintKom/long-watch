declare module 'labyrinthos' {
  interface TileMapOptions {
    width?: number;
    height?: number;
    depth?: number;
  }
  export class TileMap {
    constructor(options?: TileMapOptions);
    width: number;
    height: number;
    depth: number;
    data: number[] | number[][];
    fill(value: number): void;
    fill2D(value: number): void;
    fill3D(value: number, z: number): void;
    seed(value: number): void;
    seedRandom(): void;
    scaleToTileRange(range: number): void;
    mask(format?: string[]): string[];
    getTileAt(x: number, y: number, z?: number): number;
  }
  export const mazes: Record<string, (tm: TileMap, opts?: unknown) => void>;
  export const shapes: Record<string, (tm: TileMap, opts?: unknown) => void>;
  export const terrains: Record<string, (tm: TileMap, opts?: unknown) => void>;
  const labyrinthos: {
    TileMap: typeof TileMap;
    mazes: typeof mazes;
    shapes: typeof shapes;
    terrains: typeof terrains;
  };
  export default labyrinthos;
}
