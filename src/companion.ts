/**
 * Player-aligned companion that follows the player and fights assassins.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './physics';
import { Character, rollDice, rollAttackDamage } from './character';
import { Enemy } from './enemy';
import { FactionId } from './faction';
import { tryUpgradeWithVox, VOX_KEYS } from './voxModels';
import { Navigator } from './nav';

export interface CompanionDef {
  id: string;
  displayName: string;
  bodyColor: number;
  hairColor: number;
  combatStats: { hp: number; ac: number; attackBonus: number; damageDice: string; speed: number };
}

export const KARLA: CompanionDef = {
  id: 'karla',
  displayName: 'Karla',
  bodyColor: 0x884422,
  hairColor: 0xc8a070,
  combatStats: { hp: 32, ac: 16, attackBonus: 5, damageDice: '1d8+3', speed: 6 },
};

export class Companion {
  def: CompanionDef;
  body: CANNON.Body;
  group: THREE.Group;
  character: Character;
  isDead = false;
  faction: FactionId = 'player_party';
  private attackTimer = 0;
  private followDist = 2.5;
  private maxFollowDist = 12;
  private nav = new Navigator();

  constructor(def: CompanionDef, x: number, y: number, z: number, scene: THREE.Scene, physics: PhysicsWorld) {
    this.def = def;
    this.character = new Character(def.displayName);
    this.character.maxHp = def.combatStats.hp;
    this.character.hp = def.combatStats.hp;
    this.character.ac = def.combatStats.ac;

    this.body = physics.addDynamicSphere(x, y, z, 0.35, 60);
    this.body.fixedRotation = true;
    this.body.linearDamping = 0.85;

    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.bodyColor, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), bodyMat);
    torso.castShadow = true;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), new THREE.MeshStandardMaterial({ color: 0xddaa88 }));
    head.position.y = 0.55;
    head.castShadow = true;
    this.group.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), new THREE.MeshStandardMaterial({ color: def.hairColor }));
    hair.position.y = 0.76;
    this.group.add(hair);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    ring.position.y = -0.7;
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    this.group.position.set(x, y, z);
    scene.add(this.group);

    const voxKey = (VOX_KEYS.companion as Record<string, string>)[def.id];
    if (voxKey) void tryUpgradeWithVox(voxKey, this.group, { scale: 0.04, yOffset: -0.05 });
  }

  syncMesh() {
    this.group.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  takeHit(damage: number): { died: boolean } {
    if (this.isDead) return { died: false };
    this.character.takeDamage(damage);
    if (this.character.isDead()) { this.isDead = true; return { died: true }; }
    return { died: false };
  }

  update(dt: number, playerPos: THREE.Vector3, enemies: Enemy[]): { dealtTo?: Enemy; dmg?: number } | null {
    if (this.isDead) return null;
    this.syncMesh();
    this.attackTimer += dt;
    const me = this.body.position;

    let nearestEnemy: Enemy | null = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      if (e.isDead) continue;
      const dx = e.body.position.x - me.x;
      const dz = e.body.position.z - me.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < nearestDist) { nearestEnemy = e; nearestDist = d; }
    }

    if (nearestEnemy && nearestDist < 12) {
      const reach = 1.6;
      const dx = nearestEnemy.body.position.x - me.x;
      const dz = nearestEnemy.body.position.z - me.z;
      this.group.rotation.y = Math.atan2(dx, dz);
      if (nearestDist <= reach && this.attackTimer >= 2) {
        this.attackTimer = 0;
        const roll = rollDice(20);
        const total = roll + this.def.combatStats.attackBonus;
        if (roll !== 1 && (roll === 20 || total >= nearestEnemy.preset.ac)) {
          const dmg = rollAttackDamage(this.def.combatStats.damageDice, roll === 20);
          nearestEnemy.takeHit(dmg);
          return { dealtTo: nearestEnemy, dmg };
        }
        return null;
      } else if (nearestDist > reach * 0.9) {
        const v = this.def.combatStats.speed * 0.5;
        const steer = this.nav.steerToward(me, nearestEnemy.body.position, Math.floor(me.y - 0.5));
        const useDx = steer ? steer.dx : dx / Math.max(nearestDist, 0.01);
        const useDz = steer ? steer.dz : dz / Math.max(nearestDist, 0.01);
        this.body.velocity.x = useDx * v;
        this.body.velocity.z = useDz * v;
      } else {
        this.body.velocity.x = 0; this.body.velocity.z = 0;
      }
      return null;
    }

    const dx = playerPos.x - me.x;
    const dz = playerPos.z - me.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > this.maxFollowDist) {
      this.body.position.set(playerPos.x - 1.5, playerPos.y, playerPos.z - 1.5);
      this.body.velocity.set(0, 0, 0);
      return null;
    }
    if (d > this.followDist) {
      const v = 3.5;
      const steer = this.nav.steerToward(me, playerPos, Math.floor(me.y - 0.5));
      const useDx = steer ? steer.dx : dx / d;
      const useDz = steer ? steer.dz : dz / d;
      this.body.velocity.x = useDx * v;
      this.body.velocity.z = useDz * v;
      this.group.rotation.y = Math.atan2(useDx, useDz);
    } else {
      this.body.velocity.x = 0; this.body.velocity.z = 0;
    }
    return null;
  }
}
