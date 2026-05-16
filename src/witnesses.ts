/**
 * Witness propagation.
 *
 * "If they didn't see it, they don't know it." When the player commits a
 * notable action (attack, theft, descent into catacombs, ...), this module
 * computes which NPCs could plausibly have observed it. Other systems
 * (off-screen beats, memory events, consequence flags) take only this set
 * as their visibility list - everyone else stays ignorant until they:
 *   - witness a later event,
 *   - bump into a witness (rumor diffusion, below), or
 *   - are told directly in dialogue with the player.
 *
 * Rules for "did NPC X witness event E":
 *   1. X is alive.
 *   2. Same floor (|dy| <= 2.5).
 *   3. Within `range` world units (default 12).
 *   4. Voxel raycast line-of-sight is clear (3D, through walls/floors).
 *   5. Event is inside X's facing cone (PI*0.55 ~ 100deg). If `coneAware=false`
 *      we drop the cone gate - useful for things NPCs notice through sound
 *      (a scream, a body falling).
 *
 * Plus a special-case: the victim of an action is always a witness.
 */
import type { CastMember, CastId } from './cast';
import { isVisibleOnFloor } from './fov';

interface VoxelLike {
  isOpaque(x: number, y: number, z: number): boolean;
}

export interface WitnessOpts {
  /** World position of the event. */
  pos: { x: number; y: number; z: number };
  /** Voxel world for FOV / occlusion. */
  world: VoxelLike;
  /** Max range. */
  range?: number;
  /** If true, NPC must face the event (sight). False = sound (any direction). */
  coneAware?: boolean;
  /** Optional CastId always added (e.g. the victim of an attack). */
  alwaysIncludes?: CastId[];
  /** 3D voxel raycast LOS callback supplied by main.ts. */
  raycast: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean;
}

export function computeWitnesses(cast: CastMember[], opts: WitnessOpts): CastId[] {
  const set = new Set<CastId>(opts.alwaysIncludes ?? []);
  const range = opts.range ?? 12;
  const coneAware = opts.coneAware ?? true;

  for (const cm of cast) {
    if (cm.isDead) continue;
    if (set.has(cm.def.id)) continue;
    const np = cm.body.position;
    if (Math.abs(np.y - opts.pos.y) > 2.5) continue;
    const dx = opts.pos.x - np.x;
    const dz = opts.pos.z - np.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > range) continue;

    // 3D voxel raycast first: catches floor-to-floor separation.
    if (!opts.raycast(np.x, np.y + 1.4, np.z, opts.pos.x, opts.pos.y + 1.0, opts.pos.z)) continue;

    if (coneAware) {
      const facingY = cm.group.rotation.y;
      const facing = { dx: Math.sin(facingY), dz: Math.cos(facingY), coneRad: Math.PI * 0.55 };
      if (!isVisibleOnFloor(opts.world, np.x, np.z, opts.pos.x, opts.pos.z, np.y + 1.4, range, facing)) continue;
    } else {
      if (!isVisibleOnFloor(opts.world, np.x, np.z, opts.pos.x, opts.pos.z, np.y + 1.4, range)) continue;
    }

    set.add(cm.def.id);
  }

  return [...set];
}

/**
 * NPC-to-NPC rumor diffusion.
 *
 * If two NPCs are within `shareDistance` and have line-of-sight, the older
 * memory items unique to one of them are copied (as "[rumor from <name>]"
 * prefixed events) into the other's memory feed. We only share original
 * events (not other rumors and not private off-screen beats) to avoid
 * runaway re-propagation.
 *
 * Returns the number of items diffused this call.
 */
export interface RumorOpts {
  cast: CastMember[];
  world: VoxelLike;
  raycast: (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => boolean;
  /** Adapter to push a scoped event into memory. */
  pushEvent: (text: string, minute: number, visibility: CastId[]) => void;
  /** Adapter that returns events visible to a given NPC (most recent N). */
  eventsVisibleTo: (id: CastId, count: number) => { text: string; inGameMinute: number }[];
  /** Current in-game minute. */
  currentMinute: number;
  shareDistance?: number;
}

export function diffuseRumors(opts: RumorOpts): number {
  const cast = opts.cast;
  const dShare = opts.shareDistance ?? 3.0;
  let diffused = 0;

  for (let i = 0; i < cast.length; i++) {
    const a = cast[i];
    if (a.isDead) continue;
    for (let j = i + 1; j < cast.length; j++) {
      const b = cast[j];
      if (b.isDead) continue;
      const dx = a.body.position.x - b.body.position.x;
      const dz = a.body.position.z - b.body.position.z;
      if (Math.abs(a.body.position.y - b.body.position.y) > 2.5) continue;
      if (Math.sqrt(dx * dx + dz * dz) > dShare) continue;
      if (!opts.raycast(a.body.position.x, a.body.position.y + 1.4, a.body.position.z,
                        b.body.position.x, b.body.position.y + 1.4, b.body.position.z)) continue;

      diffused += shareOne(a, b, opts);
      diffused += shareOne(b, a, opts);
    }
  }
  return diffused;
}

function shareOne(from: CastMember, to: CastMember, opts: RumorOpts): number {
  const fromEvents = opts.eventsVisibleTo(from.def.id, 12);
  const toEvents = new Set(opts.eventsVisibleTo(to.def.id, 64).map((e) => e.text));
  let added = 0;
  for (const ev of fromEvents) {
    if (added >= 2) break;
    if (ev.text.startsWith('[rumor')) continue;
    if (ev.text.startsWith('[off-screen]')) continue; // private actions stay private
    const rumored = `[rumor from ${from.def.displayName}] ${ev.text}`;
    if (toEvents.has(rumored)) continue;
    opts.pushEvent(rumored, opts.currentMinute, [to.def.id]);
    toEvents.add(rumored);
    added++;
  }
  return added;
}
