/**
 * Clue props — interactable objects that reveal Boss identity through skill checks.
 */
import * as THREE from 'three';
import { Character } from './character';
import { PlotRoll, BossId } from './plot';

export interface ClueDef {
  id: string;
  label: string;
  position: { x: number; y: number; z: number };
  check: { ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'; skill?: string; dc: number };
  reveals: BossId[];
  flavorOnFind: string;
  flavorOnSuccess: string;
  flavorOnFail: string;
  color: number;
}

export const CLUES: ClueDef[] = [
  {
    id: 'letters_study',
    label: "Stack of old letters",
    position: { x: 6, y: 1.5, z: 8 },
    check: { ability: 'int', skill: 'investigation', dc: 13 },
    reveals: ['forsythe'],
    flavorOnFind: "A bundle of handwritten letters tied with red ribbon, in a woman's hand.",
    flavorOnSuccess: "You match the handwriting and the dates: these are from Forsythe Forewater, and they grow venomous.",
    flavorOnFail: "Old paper. You can't make sense of who wrote what to whom.",
    color: 0xeeddaa,
  },
  {
    id: 'guild_token',
    label: "An odd small token",
    position: { x: 17.5, y: 1.0, z: 2 },
    check: { ability: 'int', skill: 'investigation', dc: 12 },
    reveals: ['assassin_guild'],
    flavorOnFind: "A blackened bronze token, three crossed daggers etched on one side.",
    flavorOnSuccess: "You recognize the mark - the Assassin's Guild. They paid the contract.",
    flavorOnFail: "Some kind of gang token. Could be anyone's.",
    color: 0x6e6e88,
  },
  {
    id: 'salt_relic',
    label: "Sea-soaked holy symbol",
    position: { x: 15.5, y: 1.0, z: 38 },
    check: { ability: 'int', skill: 'religion', dc: 13 },
    reveals: ['sea_goddess'],
    flavorOnFind: "A drowned-pearl symbol on a wet chain, smelling of brine.",
    flavorOnSuccess: "Umberlee, the Sea Goddess. This was a holy errand.",
    flavorOnFail: "Religious, you think, but you can't place the cult.",
    color: 0x88bbcc,
  },
  {
    id: 'sword_sunder',
    label: "A dark scimitar",
    position: { x: 28, y: 1.0, z: 7 },
    check: { ability: 'wis', skill: 'insight', dc: 14 },
    reveals: ['sentient_sword'],
    flavorOnFind: "A glistening scimitar of dark metal. Runes shift when you look at them sideways.",
    flavorOnSuccess: "The blade WANTS to be touched. This is no ordinary weapon — it commanded its bearer.",
    flavorOnFail: "Ugly thing. You leave it well alone.",
    color: 0x442255,
  },
  {
    id: 'right_hand_dagger',
    label: "The Right Hand's hidden dagger",
    position: { x: 42, y: 6.5, z: 9 },
    check: { ability: 'int', skill: 'investigation', dc: 15 },
    reveals: ['right_hand'],
    flavorOnFind: "A dagger hidden between a map and a sealed letter. The dagger is fresh-oiled.",
    flavorOnSuccess: "The letter is from him to himself - a confession. He hired the assassin.",
    flavorOnFail: "A dagger and a stack of correspondence. Normal for his office.",
    color: 0x8a4455,
  },
  {
    id: 'criminal_rumor',
    label: "Wine-stained gossip",
    position: { x: 41, y: 1.5, z: 6 },
    check: { ability: 'cha', skill: 'persuasion', dc: 12 },
    reveals: ['forewaters'],
    flavorOnFind: "A trembling wine glass on the counter and a guilty look.",
    flavorOnSuccess: "She whispers: \"The Forewaters were skulking around the docks last week, asking about the Heir.\"",
    flavorOnFail: "She clams up.",
    color: 0xd4a017,
  },
  {
    id: 'fae_geas',
    label: "Silvery thread",
    position: { x: 16.5, y: 1.0, z: 2 },
    check: { ability: 'int', skill: 'arcana', dc: 14 },
    reveals: ['unseelie'],
    flavorOnFind: "A thread you almost miss, like spider-silk gone wrong.",
    flavorOnSuccess: "Geas - a fae binding spell. The Unseelie Court compelled this kill.",
    flavorOnFail: "You're sure it's nothing. (You're not sure.)",
    color: 0xddddee,
  },
];

export interface ClueAttemptResult {
  passed: boolean;
  roll: number;
  total: number;
  revealedBoss: boolean;
  text: string;
}

export interface CluePropInstance {
  def: ClueDef;
  mesh: THREE.Mesh;
  attempted: boolean;
  /** Last attempt result; null until the player has examined this clue. */
  lastResult: ClueAttemptResult | null;
}

export function buildClueProps(scene: THREE.Scene): CluePropInstance[] {
  const result: CluePropInstance[] = [];
  for (const c of CLUES) {
    const mat = new THREE.MeshStandardMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0.25 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.32), mat);
    mesh.position.set(c.position.x + 0.5, c.position.y, c.position.z + 0.5);
    mesh.castShadow = true;
    scene.add(mesh);
    const light = new THREE.PointLight(c.color, 0.5, 2);
    light.position.copy(mesh.position);
    light.position.y += 0.3;
    scene.add(light);
    result.push({ def: c, mesh, attempted: false, lastResult: null });
  }
  return result;
}

export function attemptClue(clue: ClueDef, character: Character, plot: PlotRoll): ClueAttemptResult {
  const check = character.skillCheck(clue.check.ability, clue.check.skill ?? clue.check.ability);
  const passed = check.total >= clue.check.dc;
  let revealedBoss = false;
  if (passed && clue.reveals.includes(plot.boss)) {
    plot.revealed.boss = true;
    revealedBoss = true;
  }
  const text = passed ? clue.flavorOnSuccess : clue.flavorOnFail;
  return { passed, roll: check.roll, total: check.total, revealedBoss, text };
}
