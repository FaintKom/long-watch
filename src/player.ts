import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './physics';
import { VoxelWorld } from './world';

const WALK_SPEED = 5;
const SPRINT_SPEED = 9;
const CROUCH_SPEED = 2.5;
const JUMP_VELOCITY = 8;
const EYE_HEIGHT = 1.6;
const CROUCH_EYE_HEIGHT = 0.9;
const MOUSE_SENSITIVITY = 0.002;
const PLAYER_RADIUS = 0.35;
const PLAYER_MASS = 70;
const INTERACT_RANGE = 3.5;

/**
 * First-person FPS controller with optional turn-based movement budget.
 */
export class Player {
  camera: THREE.PerspectiveCamera;
  body: CANNON.Body;
  yaw: THREE.Object3D;
  pitch = 0;
  yawAngle = 0;

  isCrouching = false;
  isSprinting = false;
  isGrounded = false;

  movementLocked = false;
  movementBudget = Infinity;
  lastBudgetPos: THREE.Vector3 | null = null;
  onMovementExhausted?: () => void;
  onMovementStep?: (dist: number) => void;

  private keys: Record<string, boolean> = {};
  private physics: PhysicsWorld;
  private currentEyeHeight = EYE_HEIGHT;

  constructor(camera: THREE.PerspectiveCamera, physics: PhysicsWorld, _world: VoxelWorld) {
    this.camera = camera;
    this.physics = physics;

    this.yaw = new THREE.Object3D();
    this.yaw.add(camera);
    camera.position.set(0, 0, 0);

    this.body = physics.addDynamicSphere(5, 3, 5, PLAYER_RADIUS, PLAYER_MASS);
    this.body.angularDamping = 1;
    this.body.fixedRotation = true;

    this.setupInput();
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyC') this.isCrouching = !this.isCrouching;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) {
        this.yawAngle -= e.movementX * MOUSE_SENSITIVITY;
        this.pitch -= e.movementY * MOUSE_SENSITIVITY;
        this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
      }
    });
  }

  setPosition(x: number, y: number, z: number) {
    this.body.position.set(x, y, z);
    this.body.velocity.set(0, 0, 0);
  }

  update(dt: number) {
    this.checkGround();

    const targetEye = this.isCrouching ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
    this.currentEyeHeight += (targetEye - this.currentEyeHeight) * Math.min(1, dt * 12);

    this.isSprinting = !!(this.keys['ShiftLeft'] || this.keys['ShiftRight']);
    const speed = this.isCrouching ? CROUCH_SPEED : (this.isSprinting ? SPRINT_SPEED : WALK_SPEED);

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyD']) moveDir.add(right);
    if (this.keys['KeyA']) moveDir.sub(right);

    if (moveDir.lengthSq() > 0) moveDir.normalize().multiplyScalar(speed);

    if (this.movementLocked || this.movementBudget <= 0) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    } else {
      this.body.velocity.x = moveDir.x;
      this.body.velocity.z = moveDir.z;
    }

    if (this.keys['Space'] && this.isGrounded && !this.movementLocked) {
      this.body.velocity.y = JUMP_VELOCITY;
    }

    if (this.lastBudgetPos && isFinite(this.movementBudget)) {
      const bp = this.body.position;
      const dx = bp.x - this.lastBudgetPos.x;
      const dz = bp.z - this.lastBudgetPos.z;
      const stepDist = Math.sqrt(dx * dx + dz * dz);
      if (stepDist > 0.001) {
        this.movementBudget -= stepDist;
        this.onMovementStep?.(stepDist);
        if (this.movementBudget <= 0) {
          this.movementBudget = 0;
          this.body.velocity.x = 0;
          this.body.velocity.z = 0;
          this.onMovementExhausted?.();
        }
        this.lastBudgetPos.set(bp.x, bp.y, bp.z);
      }
    }

    this.yaw.rotation.set(0, this.yawAngle, 0);
    this.camera.rotation.set(this.pitch, 0, 0);

    const bp = this.body.position;
    this.yaw.position.set(bp.x, bp.y + this.currentEyeHeight, bp.z);
  }

  private checkGround() {
    const p = this.body.position;
    const from = new CANNON.Vec3(p.x, p.y, p.z);
    const to = new CANNON.Vec3(p.x, p.y - PLAYER_RADIUS - 0.15, p.z);
    const result = new CANNON.RaycastResult();
    this.physics.world.raycastClosest(from, to, { skipBackfaces: true }, result);
    this.isGrounded = result.hasHit;
  }

  isMoving(): boolean {
    const v = this.body.velocity;
    return Math.sqrt(v.x * v.x + v.z * v.z) > 0.5;
  }

  getLookDirection(): THREE.Vector3 {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yawAngle);
    return dir;
  }

  getEyePosition(): THREE.Vector3 {
    return this.yaw.position.clone();
  }

  getRayTarget(): THREE.Vector3 {
    return this.getEyePosition().add(this.getLookDirection().multiplyScalar(INTERACT_RANGE));
  }

  getPosition(): THREE.Vector3 {
    const p = this.body.position;
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  enableBudget(meters: number) {
    this.movementBudget = meters;
    const p = this.body.position;
    this.lastBudgetPos = new THREE.Vector3(p.x, p.y, p.z);
  }

  disableBudget() {
    this.movementBudget = Infinity;
    this.lastBudgetPos = null;
  }

  setBudget(meters: number) {
    this.movementBudget = meters;
    const p = this.body.position;
    if (this.lastBudgetPos) this.lastBudgetPos.set(p.x, p.y, p.z);
    else this.lastBudgetPos = new THREE.Vector3(p.x, p.y, p.z);
  }
}
