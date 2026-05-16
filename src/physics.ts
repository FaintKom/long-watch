import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  world: CANNON.World;

  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -20, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;
    this.world.defaultContactMaterial.restitution = 0.1;
  }

  addStaticBox(px: number, py: number, pz: number, sx: number, sy: number, sz: number): CANNON.Body {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      position: new CANNON.Vec3(px, py, pz),
    });
    this.world.addBody(body);
    return body;
  }

  addDynamicSphere(px: number, py: number, pz: number, radius: number, mass: number): CANNON.Body {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Sphere(radius),
      position: new CANNON.Vec3(px, py, pz),
      linearDamping: 0.3,
    });
    this.world.addBody(body);
    return body;
  }

  addDynamicBox(px: number, py: number, pz: number, sx: number, sy: number, sz: number, mass: number): CANNON.Body {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
      position: new CANNON.Vec3(px, py, pz),
      linearDamping: 0.4,
    });
    this.world.addBody(body);
    return body;
  }

  removeBody(body: CANNON.Body) {
    this.world.removeBody(body);
  }

  step(dt: number) {
    this.world.step(1 / 60, dt, 3);
  }
}
