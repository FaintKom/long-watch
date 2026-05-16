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
// Iter 53: tone.js is loaded lazily on first unlockAudio() call so the initial
// JS bundle is ~250 KB lighter for players who never interact with audio.
// Types are loose-typed (any) because we cannot statically import Tone in
// declarations without pulling it into the cold-start bundle.
type ToneModule = typeof import('tone');
let Tone: ToneModule | null = null;

let unlocked = false;
let limiter: any = null;
let metalSynth: any = null;
let membraneSynth: any = null;
let noiseSynth: any = null;
let pluckSynth: any = null;
let pmSynth: any = null;

// --- Ambient loops (Iter 46) ---
let ambientNoise: any = null;
let ambientFilter: any = null;
let ambientGain: any = null;
let currentAmbient: AmbientName | 'off' = 'off';

export type AmbientName = 'study' | 'kitchen' | 'courtyard' | 'cellar' | 'combat' | 'catacombs' | 'off';

export async function unlockAudio(): Promise<void> {
  if (unlocked) return;
  try {
    Tone = await import('tone');
    await Tone.start();
  } catch {
    return;
  }
  unlocked = true;
  const T: any = Tone;
  limiter = new T.Limiter(-6).toDestination();
  metalSynth = new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.2, release: 0.1 } }).connect(limiter);
  membraneSynth = new T.MembraneSynth({ octaves: 4, pitchDecay: 0.05 }).connect(limiter);
  noiseSynth = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.005, decay: 0.15, sustain: 0 } }).connect(limiter);
  pluckSynth = new T.PluckSynth({ attackNoise: 0.5, dampening: 4000, resonance: 0.7 }).connect(limiter);
  pmSynth = new T.PolySynth(T.FMSynth).connect(limiter);

  ambientGain = new T.Gain(0).connect(limiter);
  ambientFilter = new T.Filter({ frequency: 600, type: 'lowpass', rolloff: -12 }).connect(ambientGain);
  ambientNoise = new T.Noise({ type: 'brown' }).connect(ambientFilter);
  ambientNoise.start();
}

/**
 * Swap the ambient loop to a per-location preset. Smoothly ramps gain.
 * Called from main.ts when player crosses rooms or phase changes.
 */
export function setAmbient(name: AmbientName): void {
  if (!unlocked || !ambientFilter || !ambientGain || !ambientNoise || !Tone) return;
  if (currentAmbient === name) return;
  currentAmbient = name;
  const now = Tone.now();
  // Presets: filter cutoff, noise type, gain level.
  const presets: Record<AmbientName, { freq: number; type: 'pink' | 'brown' | 'white'; gain: number }> = {
    off:        { freq: 800, type: 'brown',  gain: 0.0 },
    study:      { freq: 320, type: 'brown',  gain: 0.04 },  // low-pass hush
    kitchen:    { freq: 1200, type: 'pink',  gain: 0.05 },  // fire crackle hint
    courtyard:  { freq: 2200, type: 'pink',  gain: 0.07 },  // wind
    cellar:     { freq: 220, type: 'brown',  gain: 0.06 },  // deep echo
    combat:     { freq: 1600, type: 'pink',  gain: 0.10 },  // tension noise
    catacombs:  { freq: 180, type: 'brown',  gain: 0.09 },  // sub-rumble
  };
  const p = presets[name];
  ambientFilter.frequency.linearRampTo(p.freq, 1.2, now);
  ambientNoise.type = p.type;
  ambientGain.gain.linearRampTo(p.gain, 1.2, now);
}

export type SfxName =
  | 'attack_swing' | 'attack_hit' | 'enemy_falls'
  | 'door_burst' | 'glass_shatter' | 'chime'
  | 'rumble' | 'dawn_bell' | 'scream' | 'spell_cast';

export function play(name: SfxName): void {
  if (!unlocked || !Tone) return;
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
