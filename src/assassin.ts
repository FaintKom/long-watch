/**
 * Spawn helpers per AssassinId. Determines how many enemies appear and where.
 */
import * as THREE from 'three';
import { PhysicsWorld } from './physics';
import { Enemy, EnemyKind } from './enemy';
import { AssassinId } from './plot';
import { MansionData } from './mansion';

export interface SpawnSet {
  party: EnemyKind[];
  entryFlavor: string;
  entryPoint: 'front_door' | 'window_heir' | 'courtyard' | 'mid_house';
}

export const ASSASSIN_SPAWNS: Record<AssassinId, SpawnSet> = {
  mooks:            { party: ['mook', 'mook', 'mook', 'mook'],          entryFlavor: 'The front door bursts open. Four Mooks storm in.',            entryPoint: 'front_door' },
  cult_of_umberlee: { party: ['priest', 'fanatic', 'giant_toad'],        entryFlavor: 'Salt water seeps through the courtyard. The Sea Cult arrives.', entryPoint: 'courtyard' },
  crimson_angel:    { party: ['crimson_angel'],                          entryFlavor: 'A pane shatters. The Crimson Angel descends in red silence.', entryPoint: 'window_heir' },
  sebek_ari:        { party: ['sebek_ari', 'swarm_snakes'],              entryFlavor: 'Shadows pool, and Sebek-Ari uncoils from them.',             entryPoint: 'mid_house' },
  mezzoloth:        { party: ['mezzoloth'],                              entryFlavor: 'The air tears. A Mezzoloth steps through.',                  entryPoint: 'mid_house' },
  air_elemental:    { party: ['air_elemental'],                          entryFlavor: 'A howling wind gathers - an Air Elemental coalesces.',       entryPoint: 'window_heir' },
};

function spawnPointFor(entry: SpawnSet['entryPoint'], mansion: MansionData): THREE.Vector3 {
  switch (entry) {
    case 'front_door':   return new THREE.Vector3(17.5, 1.5, 2);
    case 'window_heir':  return new THREE.Vector3(29.5, 6.5, 2);
    case 'courtyard':    return new THREE.Vector3(15.5, 1.5, 38);
    case 'mid_house':    return new THREE.Vector3(mansion.landmarks.hallway.x + 0.5, 1.5, mansion.landmarks.hallway.z + 0.5);
  }
}

export interface SpawnedAssassinGroup {
  id: AssassinId;
  enemies: Enemy[];
  flavor: string;
}

export function spawnAssassin(id: AssassinId, scene: THREE.Scene, physics: PhysicsWorld, mansion: MansionData): SpawnedAssassinGroup {
  const set = ASSASSIN_SPAWNS[id];
  const base = spawnPointFor(set.entryPoint, mansion);
  const enemies: Enemy[] = [];
  for (let i = 0; i < set.party.length; i++) {
    const offsetX = (i - (set.party.length - 1) / 2) * 1.2;
    const e = new Enemy(set.party[i], base.x + offsetX, base.y, base.z, scene, physics);
    enemies.push(e);
  }
  return { id, enemies, flavor: set.entryFlavor };
}
