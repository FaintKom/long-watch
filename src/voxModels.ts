/**
 * MagicaVoxel .vox model loader with graceful fallback.
 *
 * Looks up models under /models/<key>.vox at runtime (Vite serves `public/`).
 * If a model is missing or fails to load, the provided fallback group is kept.
 *
 * Usage:
 *   const fallback = buildBoxBody(...); // existing hand-built mesh
 *   tryUpgradeWithVox('matriarch', fallback, { scale: 0.045 });
 *
 * The function mutates `fallback` (replaces children) on success.
 * No-op on failure so the fallback is what the player sees.
 */
import * as THREE from 'three';
import { VOXLoader } from 'threejs-vox-loader';

const _loader = new VOXLoader({
  defaultMaterialOptions: { flatShading: true, roughness: 0.7, metalness: 0 },
  enableEmissive: true,
  enableMetalness: true,
  enableRoughness: true,
  lightIntensity: 5,
});

/** In-flight + completed caches so we never re-fetch the same model. */
const _cache = new Map<string, Promise<THREE.Group | null>>();
const _knownMissing = new Set<string>();

export interface VoxUpgradeOpts {
  /** Per-unit scale to apply after centering (MagicaVoxel voxels are ~1 unit; we use 0.03-0.07 for human-size NPCs). */
  scale?: number;
  /** Y offset after centering (set negative to drop feet to ground). */
  yOffset?: number;
  /** Optional rotation around Y. */
  rotationY?: number;
}

/**
 * Iter 63: temporarily disable vox upgrade. Our procedural .vox files (Iter 34
 * + v2/v3) omit nTRN/nGRP/nSHP scene-graph chunks; threejs-vox-loader v2.0.0
 * requires them and throws "_type" undefined inside its scene builder.
 *
 * Two real fixes pending:
 *  - regenerate .vox with full scene graph chunks in tools/gen-vox.mjs, OR
 *  - swap to MagicaVoxel-modeled or AI-generated (gen-vox-ai.mjs) .vox files
 *    that already include the scene graph.
 *
 * Until then we resolve null so box fallback meshes show.
 */
const VOX_LOADING_DISABLED = true;

function loadOnce(key: string): Promise<THREE.Group | null> {
  if (VOX_LOADING_DISABLED) return Promise.resolve(null);
  if (_cache.has(key)) return _cache.get(key)!;
  if (_knownMissing.has(key)) return Promise.resolve(null);
  const url = `/models/${key}.vox`;
  const p = new Promise<THREE.Group | null>((resolve) => {
    try {
      _loader.load(
        url,
        (voxScene: any) => {
          try {
            if (typeof voxScene.center === 'function') voxScene.center();
            resolve(voxScene as THREE.Group);
          } catch {
            _knownMissing.add(key);
            resolve(null);
          }
        },
        undefined,
        (_err: unknown) => {
          _knownMissing.add(key);
          resolve(null);
        },
      );
    } catch {
      _knownMissing.add(key);
      resolve(null);
    }
  });
  _cache.set(key, p);
  return p;
}

/**
 * Try to upgrade an existing fallback group with a loaded .vox model.
 * On success: removes all children of `fallback` and adds the scaled vox model in their place.
 * On failure: fallback is untouched.
 */
export async function tryUpgradeWithVox(
  key: string,
  fallback: THREE.Group,
  opts: VoxUpgradeOpts = {},
): Promise<boolean> {
  const model = await loadOnce(key);
  if (!model) return false;
  const cloned = model.clone(true);
  if (opts.scale) cloned.scale.setScalar(opts.scale);
  if (opts.yOffset) cloned.position.y += opts.yOffset;
  if (opts.rotationY) cloned.rotation.y = opts.rotationY;
  cloned.traverse((o) => {
    if ((o as any).isMesh) {
      (o as THREE.Mesh).castShadow = true;
      (o as THREE.Mesh).receiveShadow = true;
    }
  });
  // Preserve the selection ring (last child by convention) when replacing the body.
  const ring = fallback.children[fallback.children.length - 1];
  while (fallback.children.length > 0) fallback.remove(fallback.children[0]);
  fallback.add(cloned);
  if (ring) fallback.add(ring);
  return true;
}

/** Convention map: which .vox key to look up for each entity. Used by callers. */
export const VOX_KEYS = {
  cast: {
    matriarch: 'magrath',
    heir: 'wallace',
    right_hand: 'right_hand',
    cook: 'mira',
    butler: 'aldous',
    maid: 'penny',
    gardener: 'old_tom',
  },
  companion: { karla: 'karla' },
  enemy: {
    mook: 'mook',
    fanatic: 'fanatic',
    priest: 'priest',
    giant_toad: 'giant_toad',
    crimson_angel: 'crimson_angel',
    sebek_ari: 'sebek_ari',
    swarm_snakes: 'swarm_snakes',
    mezzoloth: 'mezzoloth',
    air_elemental: 'air_elemental',
  },
} as const;
