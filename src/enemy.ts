/**
 * Hostile entity — used for assassin spawns and any other foes.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './physics';
import { Character, rollDice, rollAttackDamage } from './character';
import { FactionId } from './faction';
import { tryUpgradeWithVox, VOX_KEYS } from './voxModels';
import { getMonster, firstMeleeAttackFormula, firstAttackBonus, srdAC } from './srd';
import { Navigator } from './nav';

export type EnemyKind =
  | 'mook' | 'cultist' | 'priest' | 'fanatic' | 'giant_toad'
  | 'crimson_angel' | 'sebek_ari' | 'swarm_snakes' | 'mezzoloth' | 'air_elemental';

export interface EnemyPreset {
  name: string;
  hp: number;
  ac: number;
  attackBonus: number;
  damageDice: string;
  reach: number;
  speed: number;
  bodyColor: number;
  eyeColor: number;
  scale?: number;
  ai: 'melee' | 'ranged' | 'caster';
}

export const ENEMY_PRESETS: Record<EnemyKind, EnemyPreset> = {
  mook:          { name: 'Mook',          hp: 22, ac: 12, attackBonus: 4, damageDice: '1d6+2', reach: 1.6, speed: 6, bodyColor: 0x334422, eyeColor: 0xff3300, ai: 'melee' },
  cultist:       { name: 'Cultist',       hp: 16, ac: 12, attackBonus: 3, damageDice: '1d6+1', reach: 1.6, speed: 6, bodyColor: 0x442266, eyeColor: 0xaa44ff, ai: 'melee' },
  priest:        { name: 'Priest',        hp: 27, ac: 13, attackBonus: 5, damageDice: '1d6+3', reach: 1.6, speed: 5, bodyColor: 0x113355, eyeColor: 0x66ccff, ai: 'caster' },
  fanatic:       { name: 'Cult Fanatic',  hp: 33, ac: 13, attackBonus: 4, damageDice: '1d4+2', reach: 1.6, speed: 6, bodyColor: 0x553311, eyeColor: 0xff8800, ai: 'caster' },
  giant_toad:    { name: 'Giant Toad',    hp: 39, ac: 11, attackBonus: 4, damageDice: '1d10+2', reach: 1.6, speed: 4, bodyColor: 0x336622, eyeColor: 0x88ff44, ai: 'melee' },
  crimson_angel: { name: 'Crimson Angel', hp: 110, ac: 17, attackBonus: 7, damageDice: '1d8+4', reach: 1.6, speed: 8, bodyColor: 0xaa1133, eyeColor: 0xff0066, scale: 1.05, ai: 'melee' },
  sebek_ari:     { name: 'Sebek-Ari',     hp: 66, ac: 12, attackBonus: 5, damageDice: '1d6+3', reach: 1.6, speed: 6, bodyColor: 0x445533, eyeColor: 0xffcc22, scale: 1.05, ai: 'caster' },
  swarm_snakes:  { name: 'Swarm of Snakes', hp: 36, ac: 14, attackBonus: 5, damageDice: '2d6', reach: 1.0, speed: 4, bodyColor: 0x664422, eyeColor: 0xddaa00, ai: 'melee' },
  mezzoloth:     { name: 'Mezzoloth',     hp: 75, ac: 18, attackBonus: 7, damageDice: '2d6+3', reach: 1.8, speed: 5, bodyColor: 0x553322, eyeColor: 0xff4400, scale: 1.15, ai: 'melee' },
  air_elemental: { name: 'Air Elemental', hp: 90, ac: 15, attackBonus: 8, damageDice: '2d8', reach: 1.6, speed: 9, bodyColor: 0x88aacc, eyeColor: 0xddeeff, scale: 1.1, ai: 'melee' },
};

/**
 * Maps in-game EnemyKind → SRD `index` slugs (5e-bits canonical strings).
 * `null` = no canonical SRD counterpart (homebrew / non-SRD; preset stats stay).
 */
export const ENEMY_SRD_INDEX: Record<EnemyKind, string | null> = {
  mook: 'thug',
  cultist: 'cultist',
  priest: 'priest',
  fanatic: 'cult-fanatic',
  giant_toad: 'giant-toad',
  crimson_angel: null,
  sebek_ari: null,
  swarm_snakes: 'swarm-of-poisonous-snakes',
  mezzoloth: null,
  air_elemental: 'air-elemental',
};

/**
 * One-shot enrichment: overrides preset HP/AC/attack from canonical SRD where mapped.
 * Custom monsters (null mapping) and gameplay-tuned bosses are left alone.
 * Designed to be awaited once at boot before spawning enemies.
 */
export async function enrichPresetsFromSRD(): Promise<void> {
  await Promise.all((Object.keys(ENEMY_SRD_INDEX) as EnemyKind[]).map(async (kind) => {
    const idx = ENEMY_SRD_INDEX[kind];
    if (!idx) return;
    try {
      const m = await getMonster(idx);
      if (!m) return;
      const preset = ENEMY_PRESETS[kind];
      preset.hp = m.hit_points;
      preset.ac = srdAC(m);
      const ab = firstAttackBonus(m);
      if (ab !== null) preset.attackBonus = ab;
      const dd = firstMeleeAttackFormula(m);
      if (dd) preset.damageDice = dd;
    } catch (e) {
      console.warn(`[SRD] enrich failed for ${kind} (${idx}):`, e);
    }
  }));
}

let enemyIdCounter = 0;

export class Enemy {
  id: string;
  kind: EnemyKind;
  preset: EnemyPreset;
  character: Character;
  body: CANNON.Body;
  group: THREE.Group;
  isDead = false;
  faction: FactionId = 'freelance';
  private moveTimer = 0;
  private nav = new Navigator();

  constructor(kind: EnemyKind, x: number, y: number, z: number, scene: THREE.Scene, physics: PhysicsWorld) {
    this.kind = kind;
    this.id = `enemy_${enemyIdCounter++}`;
    const preset = ENEMY_PRESETS[kind];
    this.preset = preset;

    this.character = new Character(preset.name);
    this.character.maxHp = preset.hp;
    this.character.hp = preset.hp;
    this.character.ac = preset.ac;

    this.body = physics.addDynamicSphere(x, y, z, 0.4, 50);
    this.body.fixedRotation = true;
    this.body.angularDamping = 1;
    this.body.linearDamping = 0.95;

    this.group = new THREE.Group();
    const scale = preset.scale ?? 1;
    const bodyMat = new THREE.MeshStandardMaterial({ color: preset.bodyColor, roughness: 0.75 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.7 * scale, 0.35 * scale), bodyMat);
    torso.castShadow = true;
    this.group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.4 * scale, 0.4 * scale), bodyMat);
    head.position.y = 0.55 * scale;
    head.castShadow = true;
    this.group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: preset.eyeColor });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05 * scale, 6, 6), eyeMat);
    eyeL.position.set(-0.1 * scale, 0.58 * scale, 0.21 * scale);
    this.group.add(eyeL);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.1 * scale;
    this.group.add(eyeR);

    // Iter 64 perf: drop per-enemy PointLight - emissive eye spheres pop in
    // the dark without dragging shader cost.

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45 * scale, 0.5 * scale, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.position.y = -0.7;
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    // Iter 56 a11y: 4-segment diamond outer ring distinguishes enemies from allies
    // by shape rather than color alone.
    const diamondRing = new THREE.Mesh(
      new THREE.RingGeometry(0.55 * scale, 0.6 * scale, 4),
      new THREE.MeshBasicMaterial({ color: 0xff3344, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    diamondRing.position.y = -0.69;
    diamondRing.rotation.x = -Math.PI / 2;
    diamondRing.rotation.z = Math.PI / 4;
    this.group.add(diamondRing);

    this.group.position.set(x, y, z);
    scene.add(this.group);

    const voxKey = (VOX_KEYS.enemy as Record<string, string>)[kind];
    if (voxKey) void tryUpgradeWithVox(voxKey, this.group, { scale: 0.04, yOffset: -0.05 });
  }

  syncMesh() {
    const p = this.body.position;
    this.group.position.set(p.x, p.y, p.z);
  }

  updateAi(dt: number, playerPos: THREE.Vector3, playerAC: number, playerCharacter: Character): number {
    if (this.isDead || this.character.isDead()) return 0;
    this.syncMesh();
    this.moveTimer += dt;

    const dx = playerPos.x - this.body.position.x;
    const dz = playerPos.z - this.body.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    this.group.rotation.y = Math.atan2(dx, dz);

    if (dist <= this.preset.reach && this.moveTimer > 2) {
      this.moveTimer = 0;
      const roll = rollDice(20);
      const total = roll + this.preset.attackBonus;
      if (roll !== 1 && (roll === 20 || total >= playerAC)) {
        const dmg = rollAttackDamage(this.preset.damageDice, roll === 20);
        playerCharacter.takeDamage(dmg);
        return dmg;
      }
      return 0;
    }

    if (dist > this.preset.reach * 0.9) {
      const v = this.preset.speed * 0.4;
      const steer = this.nav.steerToward(this.body.position, playerPos, Math.floor(this.body.position.y - 0.5));
      const useDx = steer ? steer.dx : dx / Math.max(dist, 0.01);
      const useDz = steer ? steer.dz : dz / Math.max(dist, 0.01);
      this.body.velocity.x = useDx * v;
      this.body.velocity.z = useDz * v;
    } else {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }
    return 0;
  }

  takeHit(damage: number) {
    this.character.takeDamage(damage);
    if (this.character.isDead()) this.isDead = true;
  }

  destroy(scene: THREE.Scene, physics: PhysicsWorld) {
    scene.remove(this.group);
    try { physics.removeBody(this.body); } catch {}
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}
