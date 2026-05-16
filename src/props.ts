/**
 * Interactable props placed throughout the mansion.
 * Each prop has a small composite mesh and may respond to E interaction.
 */
import * as THREE from 'three';
import { PhysicsWorld } from './physics';
import { Character } from './character';
import { OwnerId, ownerForPosition, Inventory } from './inventory';

export type PropKind =
  | 'chair' | 'bottle_wine' | 'bottle_brandy' | 'plate_food'
  | 'book' | 'crate' | 'cooking_pot' | 'vase'
  | 'candelabra' | 'painting' | 'pillow' | 'weapon_rack'
  | 'ruby_necklace' | 'chest_locked' | 'pots_kitchen';

export interface PlayerWorldState {
  drinksCount: number;
  drunk: boolean;
  hasNecklace: boolean;
  bookReadIds: Set<string>;
  cratesOpened: Set<string>;
  damageTaken: number;
}

export function newPlayerWorldState(): PlayerWorldState {
  return {
    drinksCount: 0,
    drunk: false,
    hasNecklace: false,
    bookReadIds: new Set(),
    cratesOpened: new Set(),
    damageTaken: 0,
  };
}

export interface PropInstance {
  id: string;
  kind: PropKind;
  label: string;
  group: THREE.Group;
  position: { x: number; y: number; z: number };
  consumed?: boolean;
  payload?: any;
  /** Who owns this prop. Set after placement via ownerForPosition. */
  owner: OwnerId;
  /** What inventory item ID this prop yields when taken (if any). */
  yieldsItemId?: string;
}

/** Map prop kind -> default item it yields. */
const PROP_YIELDS: Partial<Record<PropKind, string>> = {
  bottle_wine: 'wine_bottle',
  bottle_brandy: 'brandy_bottle',
  plate_food: 'plate_meal',
  book: 'diary', // overridden by label for specific books
  ruby_necklace: 'ruby_necklace',
};

function yieldFor(kind: PropKind, label: string): string | undefined {
  if (label === 'Ledger of accounts') return 'ledger';
  if (label === "A young man's diary") return 'diary';
  return PROP_YIELDS[kind];
}

function woodMat(c: number) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }); }
function ceramicMat(c: number) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 }); }
function metalMat(c: number) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.7 }); }
function clothMat(c: number) { return new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }); }

function buildChair(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.05, 0.45), woodMat(0x4a3018));
  seat.position.y = 0.4;
  seat.castShadow = true;
  g.add(seat);
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), woodMat(0x3a2412));
    leg.position.set(dx, 0.2, dz);
    leg.castShadow = true;
    g.add(leg);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.05), woodMat(0x4a3018));
  back.position.set(0, 0.65, -0.2);
  back.castShadow = true;
  g.add(back);
  return g;
}

function buildBottle(color: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 8), ceramicMat(color));
  body.position.y = 0.09;
  body.castShadow = true;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.07, 6), ceramicMat(color));
  neck.position.y = 0.21;
  g.add(neck);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6), woodMat(0x664422));
  cork.position.y = 0.255;
  g.add(cork);
  return g;
}

function buildPlate(): THREE.Group {
  const g = new THREE.Group();
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.015, 12), ceramicMat(0xeeeedd));
  dish.position.y = 0.01;
  dish.castShadow = true;
  g.add(dish);
  const food = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), ceramicMat(0x884422));
  food.scale.y = 0.5;
  food.position.y = 0.04;
  g.add(food);
  return g;
}

function buildBook(spineColor: number): THREE.Group {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.22), clothMat(spineColor));
  cover.position.y = 0.02;
  cover.castShadow = true;
  g.add(cover);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.2), ceramicMat(0xddccaa));
  pages.position.y = 0.025;
  g.add(pages);
  return g;
}

function buildCrate(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.6), woodMat(0x6e4520));
  box.position.y = 0.275;
  box.castShadow = true;
  g.add(box);
  for (const y of [0.1, 0.45]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.62), woodMat(0x4a2c12));
    band.position.y = y;
    g.add(band);
  }
  return g;
}

function buildCookingPot(): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.22, 12), metalMat(0x222222));
  pot.position.y = 0.11;
  pot.castShadow = true;
  g.add(pot);
  for (const dx of [-0.22, 0.22]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 8, Math.PI), metalMat(0x111111));
    handle.position.set(dx, 0.16, 0);
    handle.rotation.z = Math.PI / 2;
    g.add(handle);
  }
  const steam = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xccccdd, transparent: true, opacity: 0.3 }));
  steam.position.y = 0.35;
  g.add(steam);
  return g;
}

function buildVase(color: number): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.05, 8), ceramicMat(color));
  base.position.y = 0.025;
  g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.18, 8), ceramicMat(color));
  body.position.y = 0.14;
  body.castShadow = true;
  g.add(body);
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.03, 8), ceramicMat(color));
  lip.position.y = 0.245;
  g.add(lip);
  return g;
}

function buildCandelabra(): THREE.Group {
  const g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.4, 6), metalMat(0xd4a017));
  stem.position.y = 0.2;
  g.add(stem);
  for (const dx of [-0.1, 0, 0.1]) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 6), clothMat(0xeeeebb));
    candle.position.set(dx, 0.45, 0);
    g.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffaa33 }));
    flame.position.set(dx, 0.5, 0);
    g.add(flame);
  }
  const flameLight = new THREE.PointLight(0xff9933, 0.6, 3);
  flameLight.position.set(0, 0.5, 0);
  g.add(flameLight);
  return g;
}

function buildPainting(): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.04), woodMat(0xa57a3a));
  g.add(frame);
  const canvas = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.045), clothMat(0x4a3a55));
  g.add(canvas);
  return g;
}

function buildWeaponRack(): THREE.Group {
  const g = new THREE.Group();
  const rack = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.18), woodMat(0x4a2c12));
  rack.position.y = 0.7;
  rack.castShadow = true;
  g.add(rack);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.02), metalMat(0xbbbbcc));
    blade.position.set(-0.2 + i * 0.2, 0.9, 0.12);
    g.add(blade);
    const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), woodMat(0x3a2010));
    hilt.position.set(-0.2 + i * 0.2, 1.25, 0.12);
    g.add(hilt);
  }
  return g;
}

function buildPillow(color: number): THREE.Group {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.22), clothMat(color));
  p.position.y = 0.04;
  p.castShadow = true;
  g.add(p);
  return g;
}

function buildNecklace(): THREE.Group {
  const g = new THREE.Group();
  const ruby = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), new THREE.MeshStandardMaterial({ color: 0xcc1133, emissive: 0x880011, roughness: 0.2, metalness: 0.4 }));
  ruby.position.y = 0.04;
  g.add(ruby);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.005, 6, 16), metalMat(0xd4a017));
  chain.position.y = 0.08;
  chain.rotation.x = Math.PI / 2;
  g.add(chain);
  const glow = new THREE.PointLight(0xff2244, 0.4, 1.5);
  glow.position.y = 0.05;
  g.add(glow);
  return g;
}

function buildChestLocked(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), woodMat(0x5a3818));
  base.position.y = 0.2;
  base.castShadow = true;
  g.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.52), woodMat(0x3a2412));
  lid.position.y = 0.43;
  g.add(lid);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.04), metalMat(0xd4a017));
  lock.position.set(0, 0.4, 0.27);
  g.add(lock);
  for (const x of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.52), metalMat(0x3a3a3a));
    band.position.set(x, 0.2, 0);
    g.add(band);
  }
  return g;
}

function buildKitchenPots(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.10, 0.14, 8), metalMat(0x222222));
    pot.position.set(-0.2 + i * 0.2, 0.07, 0);
    pot.castShadow = true;
    g.add(pot);
  }
  const ladle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6), metalMat(0x666666));
  ladle.position.set(0.3, 0.25, 0.1);
  ladle.rotation.z = 0.3;
  g.add(ladle);
  return g;
}

let propIdCounter = 0;
export function createProp(kind: PropKind, label: string, x: number, y: number, z: number, scene: THREE.Scene, physics: PhysicsWorld, payload?: any): PropInstance {
  let group: THREE.Group;
  let physicsSize = { x: 0.3, y: 0.3, z: 0.3 };
  switch (kind) {
    case 'chair':         group = buildChair();           physicsSize = { x: 0.45, y: 0.9, z: 0.45 }; break;
    case 'bottle_wine':   group = buildBottle(0x882211); physicsSize = { x: 0.15, y: 0.3, z: 0.15 }; break;
    case 'bottle_brandy': group = buildBottle(0xa07020); physicsSize = { x: 0.15, y: 0.3, z: 0.15 }; break;
    case 'plate_food':    group = buildPlate();           physicsSize = { x: 0.26, y: 0.06, z: 0.26 }; break;
    case 'book':          group = buildBook(payload?.color ?? 0x5e2a1a); physicsSize = { x: 0.18, y: 0.05, z: 0.22 }; break;
    case 'crate':         group = buildCrate();           physicsSize = { x: 0.6, y: 0.55, z: 0.6 }; break;
    case 'cooking_pot':   group = buildCookingPot();      physicsSize = { x: 0.36, y: 0.22, z: 0.36 }; break;
    case 'vase':          group = buildVase(payload?.color ?? 0x2a4a6a); physicsSize = { x: 0.18, y: 0.27, z: 0.18 }; break;
    case 'candelabra':    group = buildCandelabra();      physicsSize = { x: 0.1, y: 0.5, z: 0.1 }; break;
    case 'painting':      group = buildPainting();        physicsSize = { x: 0.5, y: 0.7, z: 0.1 }; break;
    case 'pillow':        group = buildPillow(payload?.color ?? 0x664488); physicsSize = { x: 0.32, y: 0.08, z: 0.22 }; break;
    case 'weapon_rack':   group = buildWeaponRack();      physicsSize = { x: 0.6, y: 1.4, z: 0.18 }; break;
    case 'ruby_necklace': group = buildNecklace();        physicsSize = { x: 0.18, y: 0.1, z: 0.18 }; break;
    case 'chest_locked':  group = buildChestLocked();     physicsSize = { x: 0.7, y: 0.46, z: 0.5 }; break;
    case 'pots_kitchen':  group = buildKitchenPots();     physicsSize = { x: 0.7, y: 0.2, z: 0.3 }; break;
  }
  group.position.set(x, y, z);
  scene.add(group);
  if (kind !== 'plate_food' && kind !== 'book' && kind !== 'ruby_necklace' && kind !== 'painting' && kind !== 'pillow') {
    physics.addStaticBox(x, y + physicsSize.y / 2, z, physicsSize.x, physicsSize.y, physicsSize.z);
  }
  const isUpper = y >= 5;
  const owner = ownerForPosition(x, y, z, isUpper);
  const yieldsItemId = yieldFor(kind, label);
  return { id: `prop_${propIdCounter++}_${kind}`, kind, label, group, position: { x, y, z }, payload, owner, yieldsItemId };
}

export function placeMansionProps(scene: THREE.Scene, physics: PhysicsWorld): PropInstance[] {
  const props: PropInstance[] = [];

  // ENTRY HALL
  props.push(createProp('candelabra', 'Tall candelabra', 14, 1, 5, scene, physics));
  props.push(createProp('candelabra', 'Tall candelabra', 22, 1, 5, scene, physics));
  props.push(createProp('vase', 'Blue porcelain vase', 16, 1, 13, scene, physics, { color: 0x3355aa }));
  props.push(createProp('painting', 'Portrait of a younger Magrath', 11.05, 2.5, 7, scene, physics));
  props.push(createProp('painting', 'Seascape', 23.95, 2.5, 7, scene, physics));

  // DINING HALL — chairs around table, plates, wine bottles
  for (let i = 0; i < 4; i++) {
    props.push(createProp('chair', 'Dining chair', 27, 1, 5 + i * 2, scene, physics));
    props.push(createProp('chair', 'Dining chair', 34, 1, 5 + i * 2, scene, physics));
  }
  for (let i = 0; i < 3; i++) {
    props.push(createProp('plate_food', 'Plate of food', 29 + i * 1.5, 2, 7.5, scene, physics));
  }
  props.push(createProp('bottle_wine', 'Bottle of wine', 29, 2, 5, scene, physics));
  props.push(createProp('bottle_wine', 'Bottle of wine', 32, 2, 10, scene, physics));
  props.push(createProp('candelabra', 'Dining candelabra', 30.5, 2, 7.5, scene, physics));

  // KITCHEN
  props.push(createProp('pots_kitchen', 'Hanging pots', 41, 2.5, 4, scene, physics));
  props.push(createProp('cooking_pot', 'Cooking pot on the hob', 40, 1, 6, scene, physics));
  props.push(createProp('plate_food', 'Tray of honey-cakes', 42, 1, 9, scene, physics));
  props.push(createProp('bottle_brandy', 'Bottle of brandy', 43, 1, 10, scene, physics));
  props.push(createProp('crate', 'Crate of vegetables', 44, 1, 6, scene, physics));

  // STUDY
  props.push(createProp('chair', 'Study chair', 5, 1, 6, scene, physics));
  props.push(createProp('book', 'Ledger of accounts', 6, 2, 8.5, scene, physics, { color: 0x3a3018 }));
  props.push(createProp('candelabra', 'Desk candelabra', 7.5, 2, 8.5, scene, physics));
  props.push(createProp('painting', "Portrait of Magrath's late husband", 1.05, 2.5, 5, scene, physics));

  // LIBRARY
  for (let i = 0; i < 4; i++) {
    props.push(createProp('book', `Tome ${i + 1}`, 2, 2 + i * 0.4, 18 + i * 2, scene, physics, { color: 0x3a1a1a + i * 0x101010 }));
  }
  props.push(createProp('chair', 'Reading chair', 7, 1, 22, scene, physics));
  props.push(createProp('candelabra', 'Reading candelabra', 8, 1, 22, scene, physics));

  // DRAWING ROOM
  props.push(createProp('chair', 'Wingback chair', 26, 1, 19, scene, physics));
  props.push(createProp('chair', 'Wingback chair', 30, 1, 19, scene, physics));
  props.push(createProp('vase', 'Tall floor vase', 22, 1, 18, scene, physics, { color: 0x884466 }));
  props.push(createProp('painting', 'Old sailing-ship painting', 25.5, 2.5, 14.05, scene, physics));

  // SERVANTS' HALL
  props.push(createProp('chair', 'Servants chair', 41, 1, 18, scene, physics));
  props.push(createProp('chair', 'Servants chair', 43, 1, 18, scene, physics));
  props.push(createProp('crate', 'Linens crate', 40, 1, 26, scene, physics));

  // COURTYARD
  props.push(createProp('candelabra', 'Courtyard brazier', 8, 1, 35, scene, physics));
  props.push(createProp('candelabra', 'Courtyard brazier', 22, 1, 35, scene, physics));
  props.push(createProp('vase', 'Garden urn', 5, 1, 45, scene, physics, { color: 0x666644 }));

  // UPPER FLOOR
  // Matriarch's bedroom
  props.push(createProp('pillow', 'Embroidered pillow', 4, 6.55, 9, scene, physics, { color: 0x884444 }));
  props.push(createProp('pillow', 'Embroidered pillow', 4.5, 6.55, 9, scene, physics, { color: 0x884444 }));
  props.push(createProp('candelabra', 'Bedside candelabra', 4, 6, 11, scene, physics));
  props.push(createProp('chest_locked', "Matriarch's locked chest", 8, 6, 12, scene, physics));

  // Heir's bedroom — RUBY NECKLACE for Seeker
  props.push(createProp('pillow', 'Velvet pillow', 27, 6.55, 9, scene, physics, { color: 0x2255aa }));
  props.push(createProp('pillow', 'Velvet pillow', 27.5, 6.55, 9, scene, physics, { color: 0x2255aa }));
  props.push(createProp('candelabra', "Heir's bedside candelabra", 31, 6, 10, scene, physics));
  props.push(createProp('book', "A young man's diary", 28, 6.55, 7, scene, physics, { color: 0x224488 }));
  props.push(createProp('ruby_necklace', 'A glittering ruby necklace', 27, 6.6, 13, scene, physics));

  // Right Hand's office
  props.push(createProp('chair', "Right Hand's chair", 41, 6, 9, scene, physics));
  props.push(createProp('candelabra', 'Office candelabra', 43, 6, 8, scene, physics));
  props.push(createProp('weapon_rack', 'Weapon rack', 40, 6, 12, scene, physics));

  // Guest rooms
  props.push(createProp('pillow', 'Guest pillow', 6, 6.55, 20, scene, physics, { color: 0x554466 }));
  props.push(createProp('chair', 'Guest chair', 10, 6, 22, scene, physics));
  props.push(createProp('pillow', 'Guest pillow', 19, 6.55, 20, scene, physics, { color: 0x444466 }));

  // Servants' Quarters
  props.push(createProp('pillow', "Servant's pillow", 28, 6.55, 22, scene, physics, { color: 0x554433 }));
  props.push(createProp('crate', 'Personal effects crate', 32, 6, 24, scene, physics));

  // Storage room
  props.push(createProp('crate', 'Old storage crate', 42, 6, 22, scene, physics));
  props.push(createProp('crate', 'Old storage crate', 44, 6, 22, scene, physics));
  props.push(createProp('chest_locked', 'Old sealed chest', 46, 6, 24, scene, physics));

  return props;
}

export interface PropInteractResult {
  log: string[];
  /** True if this interaction was a theft attempt that completed (success or caught). */
  wasTheft?: boolean;
  /** Owner if it was theft. */
  theftOwner?: OwnerId;
  /** True if player got caught stealing. */
  caught?: boolean;
}

export interface TheftContext {
  /** Caller checks this and supplies witnesses. */
  witnessRollCheck: (stealthCheckTotal: number) => { caught: boolean; witnessName?: string };
  inventory: Inventory;
}

const READABLE_BOOKS: Record<string, string> = {
  'Ledger of accounts': "Columns of numbers in two hands - hers in black, his in red. You note the dates: he died ten years ago.",
  "A young man's diary": '"Mother says he loved the sea. I think she means my father. She never says his name."',
  'Tome 1': "An old treatise on tides and currents. Boring, until you notice a map of the docks pressed inside.",
  'Tome 2': "A book on heraldry. The Forewater family crest is marked with a small angry pen-stroke.",
  'Tome 3': "Sermons of Umberlee. The pages are dog-eared, but you don't think by her hand.",
  'Tome 4': "A bound collection of poetry. One signature reads 'F.F.' - the rest is hers.",
};

export function interactWithProp(
  prop: PropInstance,
  character: Character,
  worldState: PlayerWorldState,
  scene: THREE.Scene,
  theft?: TheftContext,
): PropInteractResult {
  const log: string[] = [];

  // === THEFT GATE ===
  // If this prop yields a takable item and the owner is not the player/house, the player is stealing.
  const isPickup =
    prop.yieldsItemId !== undefined &&
    !prop.consumed &&
    (prop.kind === 'bottle_wine' || prop.kind === 'bottle_brandy' || prop.kind === 'plate_food' ||
     prop.kind === 'book' || prop.kind === 'ruby_necklace');
  if (isPickup && theft && prop.owner !== 'player' && prop.owner !== 'unclaimed') {
    const isTheft = prop.owner !== 'house' || prop.yieldsItemId === 'ruby_necklace';
    if (isTheft) {
      const stealthCheck = character.skillCheck('dex', 'stealth');
      const witnessOutcome = theft.witnessRollCheck(stealthCheck.total);
      log.push(`You attempt to take ${prop.label} (DEX Stealth ${stealthCheck.total}).`);
      if (witnessOutcome.caught) {
        log.push(`*** Caught! ${witnessOutcome.witnessName ?? 'A witness'} sees you. ***`);
        return { log, wasTheft: true, theftOwner: prop.owner, caught: true };
      }
      log.push(`You slip the ${prop.label.toLowerCase()} into your pocket. No one saw.`);
      theft.inventory.add(prop.yieldsItemId!);
      // Mark consumed and remove visual
      scene.remove(prop.group);
      prop.consumed = true;
      // Also update worldState flags for objectives
      if (prop.kind === 'ruby_necklace') worldState.hasNecklace = true;
      if (prop.kind === 'bottle_wine' || prop.kind === 'bottle_brandy') {
        worldState.drinksCount = worldState.drinksCount; // consumed via use, not pickup
      }
      return { log, wasTheft: true, theftOwner: prop.owner, caught: false };
    }
  }

  switch (prop.kind) {
    case 'chair':
      log.push(`You take a moment to rest in the ${prop.label.toLowerCase()}.`);
      character.heal(1);
      break;
    case 'bottle_wine':
    case 'bottle_brandy':
      worldState.drinksCount++;
      log.push(`You take a long pull from the ${prop.label.toLowerCase()}.`);
      if (worldState.drinksCount >= 3 && !worldState.drunk) {
        worldState.drunk = true;
        log.push("*** You are intoxicated. (Boozer objective progressed.) ***");
      }
      scene.remove(prop.group);
      prop.consumed = true;
      break;
    case 'plate_food': {
      const heal = 5;
      character.heal(heal);
      log.push(`You eat from the ${prop.label.toLowerCase()}. +${heal} HP.`);
      scene.remove(prop.group);
      prop.consumed = true;
      break;
    }
    case 'book': {
      const text = READABLE_BOOKS[prop.label] ?? 'Pages of dense prose. Nothing leaps out at you.';
      log.push(`${prop.label}: "${text}"`);
      worldState.bookReadIds.add(prop.label);
      prop.consumed = true;
      break;
    }
    case 'crate':
      if (prop.consumed) {
        log.push(`The ${prop.label.toLowerCase()} has already been searched.`);
      } else {
        const rolls = ['a few silver pieces', 'a rolled cloth bandage', 'a stale loaf of bread', 'an oil lantern', 'a small dagger'];
        const item = rolls[Math.floor(Math.random() * rolls.length)];
        log.push(`You pry open the ${prop.label.toLowerCase()}. Inside: ${item}.`);
        if (item.includes('bandage') || item.includes('bread')) character.heal(3);
        worldState.cratesOpened.add(prop.id);
        prop.consumed = true;
      }
      break;
    case 'cooking_pot':
    case 'pots_kitchen':
      log.push("Stew simmers. It smells good, but it isn't yours to eat.");
      break;
    case 'vase':
    case 'painting':
    case 'candelabra':
    case 'pillow':
      log.push(`You examine the ${prop.label.toLowerCase()}. Nothing remarkable.`);
      break;
    case 'weapon_rack':
      log.push('Polished sabres on display. None of them is for you.');
      break;
    case 'ruby_necklace':
      if (worldState.hasNecklace) {
        log.push('You already have the ruby necklace.');
      } else {
        worldState.hasNecklace = true;
        log.push('*** You pocket the ruby necklace. (Seeker objective progressed.) ***');
        scene.remove(prop.group);
        prop.consumed = true;
      }
      break;
    case 'chest_locked': {
      if (prop.consumed) {
        log.push('The chest is empty.');
      } else {
        const check = character.skillCheck('dex', 'sleight_of_hand');
        const dc = 15;
        log.push(`You attempt the lock: roll ${check.roll} + mod = ${check.total} vs DC ${dc}.`);
        if (check.total >= dc) {
          log.push('Click. The lid lifts. Inside: a small velvet bag of gold (about 50 pieces).');
          prop.consumed = true;
        } else {
          log.push('The lock holds.');
        }
      }
      break;
    }
  }
  return { log };
}
