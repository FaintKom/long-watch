/**
 * Synthesized SFX via tone.js. No external audio files - everything is
 * generated at runtime so the bundle stays lean.
 *
 * Tone.js requires a user-gesture before AudioContext starts. We expose
 * `unlockAudio()` which main.ts calls on the first pointer-lock click,
 * and `play(name)` which is a no-op until audio is unlocked.
 *
 * Catalog (call by name):
 *   - 'attack_swing'    one-handed sword swing
 *   - 'attack_hit'      metal clang
 *   - 'enemy_falls'     dull thud
 *   - 'door_burst'      booming entry
 *   - 'glass_shatter'   bottle / vase break
 *   - 'chime'           reflection complete
 *   - 'rumble'          catacombs descent
 *   - 'dawn_bell'       dawn ending
 *   - 'scream'          NPC alarm
 *   - 'spell_cast'      magic launch
 */
import * as Tone from 'tone';

let unlocked = false;
let limiter: Tone.Limiter | null = null;
let metalSynth: Tone.MetalSynth | null = null;
let membraneSynth: Tone.MembraneSynth | null = null;
let noiseSynth: Tone.NoiseSynth | null = null;
let pluckSynth: Tone.PluckSynth | null = null;
let pmSynth: Tone.PolySynth | null = null;

export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  try {
    await Tone.start();
  } catch {
    return;
  }
  unlocked = true;
  limiter = new Tone.Limiter(-6).toDestination();
  metalSynth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.2, release: 0.1 } }).connect(limiter);
  membraneSynth = new Tone.MembraneSynth({ octaves: 4, pitchDecay: 0.05 }).connect(limiter);
  noiseSynth = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).connect(limiter);
  pluckSynth = new Tone.PluckSynth({ attackNoise: 0.5, dampening: 4000, resonance: 0.7 }).connect(limiter);
  pmSynth = new Tone.PolySynth(Tone.FMSynth).connect(limiter);
}

export type SfxName =
  | 'attack_swing' | 'attack_hit' | 'enemy_falls'
  | 'door_burst' | 'glass_shatter' | 'chime'
  | 'rumble' | 'dawn_bell' | 'scream' | 'spell_cast';

export function play(name: SfxName): void {
  if (!unlocked) return;
  const now = Tone.now();
  try {
    switch (name) {
      case 'attack_swing':
        noiseSynth?.triggerAttackRelease('16n', now);
        break;
      case 'attack_hit':
        metalSynth?.triggerAttackRelease('C4', '32n', now);
        break;
      case 'enemy_falls':
        membraneSynth?.triggerAttackRelease('C2', '8n', now);
        membraneSynth?.triggerAttackRelease('A1', '8n', now + 0.08);
        break;
      case 'door_burst':
        membraneSynth?.triggerAttackRelease('C1', '4n', now);
        noiseSynth?.triggerAttackRelease('8n', now + 0.02);
        break;
      case 'glass_shatter':
        metalSynth?.triggerAttackRelease('A5', '32n', now);
        noiseSynth?.triggerAttackRelease('16n', now + 0.03);
        break;
      case 'chime':
        pluckSynth?.triggerAttackRelease('E5', '4n', now);
        pluckSynth?.triggerAttackRelease('B5', '4n', now + 0.18);
        break;
      case 'rumble':
        membraneSynth?.triggerAttackRelease('C0', '2n', now);
        break;
      case 'dawn_bell':
        pluckSynth?.triggerAttackRelease('C5', '2n', now);
        pluckSynth?.triggerAttackRelease('E5', '2n', now + 0.08);
        pluckSynth?.triggerAttackRelease('G5', '2n', now + 0.16);
        break;
      case 'scream':
        pmSynth?.triggerAttackRelease('A5', '8n', now);
        pmSynth?.triggerAttackRelease('G#5', '8n', now + 0.07);
        break;
      case 'spell_cast':
        pluckSynth?.triggerAttackRelease('G4', '16n', now);
        pluckSynth?.triggerAttackRelease('D5', '16n', now + 0.06);
        pluckSynth?.triggerAttackRelease('A5', '16n', now + 0.12);
        break;
    }
  } catch (e) {
    console.warn('[audio] play failed:', name, e);
  }
}
