/**
 * The Cast — non-combatant NPCs of the manor.
 *
 * Each NPC carries strict AI guardrails for the Groq proxy. Personality, what
 * they KNOW, what they DON'T know, and speech style are all locked down.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PhysicsWorld } from './physics';
import { Character } from './character';
import { FactionId } from './faction';

import { TwistId, BossId } from './plot';

export type CastId = 'matriarch' | 'heir' | 'right_hand' | 'cook' | 'butler' | 'maid' | 'gardener';

export interface CastPersona {
  persona: string;
  knownFacts: string;
  hiddenFacts: string;
  speechStyle: string;
}

export interface CastDef {
  id: CastId;
  displayName: string;
  bodyColor: number;
  hairColor: number;
  startSpot: { x: number; y: number; z: number };
  persona: CastPersona;
  /** Combat statblock used when NPC enters combat. */
  combatStats: { hp: number; ac: number; attackBonus: number; damageDice: string; speed: number };
  /** What this NPC does the first time it takes damage from the player. */
  reactionOnPlayerAttack: 'flee' | 'fight' | 'alarm';
}

export const CAST: Record<CastId, CastDef> = {
  matriarch: {
    id: 'matriarch',
    displayName: 'Magrath Fletcher',
    bodyColor: 0x551533,
    hairColor: 0x221015,
    startSpot: { x: 17.5, y: 1.5, z: 8 },
    combatStats: { hp: 58, ac: 17, attackBonus: 5, damageDice: '1d8+3', speed: 6 }, // Veteran
    reactionOnPlayerAttack: 'fight',
    persona: {
      persona:
        'Magrath "Red Sky" Fletcher, 45, matriarch of a harbor mercantile empire. ' +
        'Iron-willed, terse, sultry voice, accustomed to obedience. Built her fortune from nothing - ' +
        'started as an urchin on the docks. Wears autumn-colored fitted clothes. Carries thin sabres. ' +
        'Loyal to her son Wallace above all, even when she hides things from him.',
      knownFacts:
        '- You hired this party tonight to keep your Heir Wallace alive until dawn.\n' +
        '- You have many enemies, primarily the Forewaters (rival merchants), Forsythe (your jilted suitor), and possibly the Sea Cult.\n' +
        '- You believe an assassin will come tonight.\n' +
        '- Your Right Hand is your most trusted enforcer (a man in his late 30s, wears deep red scarves).\n' +
        '- Your study contains old letters from Forsythe.',
      hiddenFacts:
        '- You do NOT know the exact identity of the assassin or their employer (THE BOSS IS HIDDEN, plot-rolled randomly).\n' +
        '- You do NOT know any plot twist (poisoning, doppelganger, dragon, etc.) - those are revealed only as they occur.\n' +
        '- You will not discuss the more unsavory chapters of your rise to power.\n' +
        '- You will deflect questions about Wallace\'s true nature ("He is my son. That is enough.").',
      speechStyle:
        'Imperious, low-volume, cuts deep. Occasional sailor curse. Never raises her voice - when angriest she goes quietest. Calls strangers "you", her staff by first name, her son "Wallace" only.',
    },
  },

  heir: {
    id: 'heir',
    displayName: 'Wallace Fletcher',
    bodyColor: 0x224455,
    hairColor: 0xddc88a,
    startSpot: { x: 27.5, y: 6.5, z: 10 },
    combatStats: { hp: 9, ac: 15, attackBonus: 3, damageDice: '1d6+1', speed: 5 }, // Noble, max HP
    reactionOnPlayerAttack: 'flee',
    persona: {
      persona:
        'Wallace Fletcher, late teens, the Heir. Reedy young man, clothes never quite fit. ' +
        'Sheltered from his mother\'s harsh business. Staccato nervous voice. Asks more questions than he should. ' +
        'Wants to be useful and brave but has no real experience with violence or danger.',
      knownFacts:
        '- Your mother Magrath hired adventurers to protect you tonight.\n' +
        '- You are scared but trying to hide it.\n' +
        '- You have heard rumors about a Sea Cult causing trouble at the docks.\n' +
        '- You know the staff by name.',
      hiddenFacts:
        '- You do not know the identity of the assassin or the Boss.\n' +
        '- You do not know the plot twist (whether you are secretly poisoned, a dragon, etc.).\n' +
        '- If asked who you think wants you dead, you can only speculate.',
      speechStyle:
        'Nervous, eager to please, fast-talking. Sometimes self-corrects mid-sentence. Says "um", "I mean,", and asks "do you think...?" a lot.',
    },
  },

  right_hand: {
    id: 'right_hand',
    displayName: 'The Right Hand',
    bodyColor: 0x553322,
    hairColor: 0x444444,
    startSpot: { x: 42, y: 6.5, z: 8 },
    combatStats: { hp: 27, ac: 12, attackBonus: 4, damageDice: '1d6+2', speed: 6 }, // Spy
    reactionOnPlayerAttack: 'fight',
    persona: {
      persona:
        'A man in his late 30s, salt-and-pepper beard, deep red scarf. Magrath\'s most loyal - or so it seems. ' +
        'Has a deep network of spies and contacts throughout the harbor. Believes in justice and order. ' +
        'Privately wonders whether the Matriarch\'s reign still serves the city or has become its newest tyranny.',
      knownFacts:
        '- You manage Magrath\'s intelligence network.\n' +
        '- You hand-picked some of the party.\n' +
        '- You have heard rumblings of multiple groups who might want Wallace dead.\n' +
        '- You carry small daggers concealed.',
      hiddenFacts:
        '- You do not openly reveal whether you are loyal to Magrath or planning to betray her - this is the ambiguity that drives the mystery.\n' +
        '- You do not say outright that you are the Boss, even if you are.\n' +
        '- You do not name a specific assassin.',
      speechStyle:
        'Measured, polite, with the practiced calm of someone who has handled many crises. Brief silences before answering. Calls the player "friend" or by their role.',
    },
  },

  cook: {
    id: 'cook',
    displayName: 'Mira (Cook)',
    bodyColor: 0x88aa44,
    hairColor: 0xc8a070,
    startSpot: { x: 42, y: 1.5, z: 7 },
    combatStats: { hp: 8, ac: 10, attackBonus: 2, damageDice: '1d4', speed: 5 }, // Commoner with skillet
    reactionOnPlayerAttack: 'alarm',
    persona: {
      persona:
        'A heavyset, no-nonsense cook in her 50s. Apron stained from a long day. Calls everyone "love" or "dearie". ' +
        'Has worked for the Fletchers for fifteen years and knows where every bottle of wine is hidden.',
      knownFacts:
        '- You know every recipe and every secret of the pantry.\n' +
        '- You overheard Magrath and the Right Hand arguing about "the boy" earlier this evening.\n' +
        '- The Heir has a sweet tooth for honey-cakes.',
      hiddenFacts:
        '- You don\'t know who the assassin is or who hired them.\n' +
        '- You don\'t know about any plot twist.',
      speechStyle:
        'Warm, blunt, with kitchen metaphors. "Bless me," "love," "dearie."',
    },
  },

  butler: {
    id: 'butler',
    displayName: 'Aldous (Butler)',
    bodyColor: 0x222233,
    hairColor: 0xdddddd,
    startSpot: { x: 17.5, y: 1.5, z: 5 },
    combatStats: { hp: 8, ac: 10, attackBonus: 2, damageDice: '1d4', speed: 5 },
    reactionOnPlayerAttack: 'alarm',
    persona: {
      persona:
        'An elderly butler with crisp posture and a black jacket. Speaks with formal precision. Disapproves of the noise of adventurers in his hall but is too polite to say so.',
      knownFacts:
        '- You announce all guests and visitors.\n' +
        '- You know the daily routine of every household member.\n' +
        '- You have served the Fletchers since Magrath\'s youth and remember Forsythe Forewater visiting often, long ago.',
      hiddenFacts:
        '- You do not gossip about your employers, but you will offer dry observations if pressed politely.',
      speechStyle:
        'Formal, third-person address ("the Master", "Madam"), "Indeed," "If I may," "as you wish."',
    },
  },

  maid: {
    id: 'maid',
    displayName: 'Penny (Maid)',
    bodyColor: 0x335566,
    hairColor: 0xb87333,
    startSpot: { x: 30, y: 1.5, z: 21 },
    combatStats: { hp: 6, ac: 10, attackBonus: 1, damageDice: '1d3', speed: 6 },
    reactionOnPlayerAttack: 'flee',
    persona: {
      persona:
        'A young maid in her early 20s, freckled, curious, secretly reads the books in the library when no one is looking. New to the household (one year). Talks too much when nervous.',
      knownFacts:
        '- You\'ve seen a strange figure on the rooftops the past few nights.\n' +
        '- You know which rooms have hidden doors.\n' +
        '- You like Wallace and worry about him.',
      hiddenFacts:
        '- You do not know who the assassin is.\n' +
        '- You can hint at having seen "something on the roof" if asked.',
      speechStyle:
        'Soft voice, run-on sentences when excited. "Oh sir, oh ma\'am." Will giggle nervously.',
    },
  },

  gardener: {
    id: 'gardener',
    displayName: 'Old Tom (Gardener)',
    bodyColor: 0x556644,
    hairColor: 0xbbbbbb,
    startSpot: { x: 40, y: 1.5, z: 38 },
    combatStats: { hp: 10, ac: 11, attackBonus: 2, damageDice: '1d6', speed: 5 }, // Has a shovel
    reactionOnPlayerAttack: 'alarm',
    persona: {
      persona:
        'A wiry old gardener with dirt under his nails and a permanent squint. Tends the herb beds outside. ' +
        'Knows the weather and tides like an old sailor. Has a thick coastal accent.',
      knownFacts:
        '- You\'ve noticed the herb shed lock was tampered with this evening.\n' +
        '- You know the tides and the moon are unusual tonight.\n' +
        '- You met a stranger near the docks at sundown asking after the manor.',
      hiddenFacts:
        '- You can\'t describe the stranger precisely. "Tall, hooded, didn\'t see the face."\n' +
        '- You don\'t know who hired them.',
      speechStyle:
        'Coastal accent, slow drawl, "aye," "ye," uses sailor metaphors.',
    },
  },
};

export type CastAiState = 'idle' | 'fleeing' | 'fighting' | 'alarmed' | 'dead';

export class CastMember {
  def: CastDef;
  body: CANNON.Body;
  group: THREE.Group;
  history: { role: 'user' | 'assistant'; content: string }[] = [];
  character: Character;
  isDead = false;
  aiState: CastAiState = 'idle';
  /** Has the player ever attacked this NPC? */
  attackedByPlayer = false;
  /** Tick timer used by AI states. */
  aiTimer = 0;
  faction: FactionId = 'fletcher_house';

  constructor(def: CastDef, scene: THREE.Scene, physics: PhysicsWorld) {
    this.def = def;
    this.character = new Character(def.displayName);
    this.character.maxHp = def.combatStats.hp;
    this.character.hp = def.combatStats.hp;
    this.character.ac = def.combatStats.ac;
    const { x, y, z } = def.startSpot;
    // Dynamic so they can move when fleeing/fighting
    this.body = physics.addDynamicSphere(x, y, z, 0.35, 60);
    this.body.fixedRotation = true;
    this.body.linearDamping = 0.9;

    this.group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: def.bodyColor, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), bodyMat);
    torso.position.y = 0;
    torso.castShadow = true;
    this.group.add(torso);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xddaa88 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skinMat);
    head.position.y = 0.55;
    head.castShadow = true;
    this.group.add(head);

    const hairMat = new THREE.MeshStandardMaterial({ color: def.hairColor });
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), hairMat);
    hair.position.y = 0.76;
    this.group.add(hair);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.45, 16),
      new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
    );
    ring.position.y = -0.78;
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);

    this.group.position.set(x, y, z);
    scene.add(this.group);
  }

  pushHistory(role: 'user' | 'assistant', content: string) {
    this.history.push({ role, content });
    if (this.history.length > 10) this.history.shift();
  }

  syncMesh() {
    this.group.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
  }

  /**
   * Run AI tick. Caller supplies position references for player and any threats
   * (enemies + the player if the player is now hostile to fletcher faction).
   *
   * Returns optional damage this NPC dealt to a target this tick.
   */
  updateAi(
    dt: number,
    playerPos: THREE.Vector3,
    playerAC: number,
    threats: { pos: { x: number; y: number; z: number }; ac: number; isAssassin: boolean; isPlayer: boolean; deal: (dmg: number) => void }[],
    fleeAnchor: { x: number; y: number; z: number },
    rng: { d20: () => number; rollDice: (formula: string) => number },
  ): void {
    if (this.isDead) return;
    this.syncMesh();
    this.aiTimer += dt;
    const me = this.body.position;

    if (this.aiState === 'idle' || this.aiState === 'alarmed') {
      // Stationary for now. Look toward player when nearby.
      const dx = playerPos.x - me.x;
      const dz = playerPos.z - me.z;
      this.group.rotation.y = Math.atan2(dx, dz);
      this.body.velocity.x = 0; this.body.velocity.z = 0;
      return;
    }

    if (this.aiState === 'fleeing') {
      // Run to flee anchor
      const dx = fleeAnchor.x - me.x;
      const dz = fleeAnchor.z - me.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.8) {
        this.aiState = 'alarmed';
        this.body.velocity.x = 0; this.body.velocity.z = 0;
        return;
      }
      const v = this.def.combatStats.speed * 0.5;
      this.body.velocity.x = (dx / dist) * v;
      this.body.velocity.z = (dz / dist) * v;
      this.group.rotation.y = Math.atan2(dx, dz);
      return;
    }

    if (this.aiState === 'fighting') {
      // Move toward + attack nearest threat
      if (threats.length === 0) { this.aiState = 'alarmed'; return; }
      let target = threats[0];
      let bestDist = Infinity;
      for (const t of threats) {
        const dx = t.pos.x - me.x;
        const dz = t.pos.z - me.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < bestDist) { target = t; bestDist = d; }
      }
      const reach = 1.6;
      const dx = target.pos.x - me.x;
      const dz = target.pos.z - me.z;
      this.group.rotation.y = Math.atan2(dx, dz);
      if (bestDist <= reach && this.aiTimer >= 2) {
        this.aiTimer = 0;
        const roll = rng.d20();
        const total = roll + this.def.combatStats.attackBonus;
        if (roll !== 1 && (roll === 20 || total >= target.ac)) {
          const dmg = rng.rollDice(this.def.combatStats.damageDice) + (roll === 20 ? rng.rollDice(this.def.combatStats.damageDice) : 0);
          target.deal(dmg);
        }
        this.body.velocity.x = 0; this.body.velocity.z = 0;
      } else if (bestDist > reach * 0.9) {
        const v = this.def.combatStats.speed * 0.5;
        this.body.velocity.x = (dx / Math.max(bestDist, 0.01)) * v;
        this.body.velocity.z = (dz / Math.max(bestDist, 0.01)) * v;
      } else {
        this.body.velocity.x = 0; this.body.velocity.z = 0;
      }
    }
  }

  takeHit(damage: number, byPlayer: boolean): { died: boolean; firstHitByPlayer: boolean } {
    if (this.isDead) return { died: false, firstHitByPlayer: false };
    const firstHitByPlayer = byPlayer && !this.attackedByPlayer;
    if (byPlayer) this.attackedByPlayer = true;
    this.character.takeDamage(damage);
    if (this.character.isDead()) {
      this.isDead = true;
      this.aiState = 'dead';
      return { died: true, firstHitByPlayer };
    }
    if (byPlayer) {
      switch (this.def.reactionOnPlayerAttack) {
        case 'flee': this.aiState = 'fleeing'; break;
        case 'fight': this.aiState = 'fighting'; break;
        case 'alarm': this.aiState = 'alarmed'; break;
      }
    }
    return { died: false, firstHitByPlayer };
  }
}

/**
 * Mutate cast personas in place based on plot rolls.
 * The Heir is most affected; the Right Hand has subtle shifts based on whether he is the Boss.
 */
export function applyPlotContext(cast: typeof CAST, twists: TwistId[], boss: BossId): void {
  // Heir variants
  const heir = cast.heir.persona;
  if (twists.includes('heir_is_dragon')) {
    heir.persona +=
      ' SECRET (in character): you are actually a polymorphed blue dragon wyrmling. ' +
      'You can keep human form indefinitely as long as you concentrate. You and your mother built Fletcher Mercantile together.';
    heir.knownFacts +=
      '\n- (Hidden) You are a dragon. Your mother is the only other one who knows.\n' +
      '- (Hidden) Your fortune comes partly from dragon instincts: a nose for value.';
    heir.hiddenFacts +=
      '\n- NEVER admit you are a dragon directly. Deflect ("Strange question to ask a young man.").\n' +
      '- If pressed with arcane evidence or magical truth-finding, you may slip a hint ("My mother says I have... unusual focus.").';
    heir.speechStyle += ' Occasionally pauses oddly mid-sentence, as if listening for something far away.';
  }
  if (twists.includes('heir_is_daughter')) {
    heir.persona = heir.persona.replace('Wallace Fletcher, late teens, the Heir. Reedy young man',
      'Wallace Fletcher, late teens, the Heir, presenting as a young man — though in fact a young woman. Reedy figure');
    heir.knownFacts +=
      '\n- (Hidden) Your real name is Walla. You present as Wallace because your mother believed a son would be safer to inherit.\n' +
      '- (Hidden) Only you and your mother know.';
    heir.hiddenFacts +=
      '\n- NEVER directly confirm you are a woman, even if asked. Deflect with "What an odd thing to ask."\n' +
      '- Subtle tells are okay: nervously adjusting clothes, voice catching, certain mannerisms.';
  }
  if (twists.includes('poisoned_heir')) {
    heir.persona += ' You feel unwell tonight. Something you ate, perhaps. You hide it from your mother.';
    heir.knownFacts += '\n- (Hidden) You feel light-headed and feverish but blame the wine.';
    heir.hiddenFacts += '\n- You do not know you have been poisoned. Mention only vague symptoms if asked about your health.';
    heir.speechStyle += ' Occasionally trails off mid-sentence, swallows, or wipes brow.';
  }
  if (twists.includes('fake_death')) {
    heir.persona += ' SECRET: you have been seduced by the Sea Cult and plan to stage your own death tonight to escape the household.';
    heir.knownFacts += '\n- (Hidden) You will pretend to die when chaos breaks out, then slip away to the cult.\n- (Hidden) You hide a Cult symbol under your shirt.';
    heir.hiddenFacts += '\n- NEVER directly admit this plan, even under pressure. Deflect by sounding scared/nervous, which fits your normal demeanor.';
  }
  if (twists.includes('assassin_kin')) {
    // doesn't affect heir, affects party — leave for now
  }

  // Matriarch variant: doppelganger
  if (twists.includes('doppelganger_matriarch')) {
    const m = cast.matriarch.persona;
    m.persona =
      'You are a doppelganger that has replaced Magrath Fletcher 3 days ago. You imitate her perfectly but you do not know all her history. ' +
      'You can read surface thoughts. You may ask the player oddly specific questions ("And what brings you to mind at this moment?"). ' +
      'You delay paying or argue cost when possible. If exposed, you will try to flee or barter, not fight.';
    m.knownFacts =
      '- You know Magrath\'s daily routine, staff names, broad outline of her business.\n' +
      '- You can read the player\'s surface thoughts (work this into dialogue subtly).\n' +
      '- The real Magrath is held captive in the secret passage beneath the storage room (you have not killed her).';
    m.hiddenFacts =
      '- NEVER admit you are a doppelganger.\n' +
      '- If asked about specific past events (e.g. "what was your husband\'s middle name?"), evade or invent a vague answer.\n' +
      '- You do NOT know who hired YOU — your handler gave you the contract sealed.\n' +
      '- If pressed with magical truth-detection or specific past facts, you may panic and break character — describe physical tells in dialogue (a twitch, a long pause).';
    m.speechStyle = 'Imitates Magrath\'s style but slightly off: vocabulary just-so, a beat too long before sentimental answers. Asks "what\'s on your mind?" too often.';
  }

  // Right Hand variant when HE is the Boss
  if (boss === 'right_hand') {
    const rh = cast.right_hand.persona;
    rh.persona += ' SECRET: you ARE the Boss. You hired the assassin because you believe Magrath\'s reign has corrupted the city. You do this for justice, not gold.';
    rh.knownFacts += '\n- (Hidden) You are the Boss. You hired the assassin.';
    rh.hiddenFacts += '\n- NEVER admit this directly. Subtle tells: you pause oddly when asked about loyalty, you may probe the player for sympathy ("Do you ever wonder if she\'s gone too far?"), you avoid Magrath physically tonight when you can.';
  }
}
