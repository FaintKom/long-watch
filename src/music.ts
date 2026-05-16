/**
 * Procedural music (Iter 58 stretch).
 *
 * Phase-driven ambient music via tone.js:
 *   - exploring: slow pad + sparse pluck (A min7)
 *   - combat: low bass + quick pluck stabs (F whole-tone)
 *   - catacombs: deep sub + rare bell (low F sus)
 *   - off: silence
 *
 * Cold-start cost is zero - startMusic() dynamically imports tone.js the first
 * time it is called. setPhase fades volume over 2 seconds.
 */

let _started = false;
let T: any = null;

let pad: any = null;
let pluck: any = null;
let bell: any = null;
let bass: any = null;
let masterGain: any = null;
let loopId: number | null = null;
let currentPhase: MusicPhase = 'off';

export type MusicPhase = 'off' | 'exploring' | 'combat' | 'catacombs';

const SCALES: Record<MusicPhase, { root: number; intervals: number[]; tempoMs: number }> = {
  off:        { root: 0,  intervals: [],            tempoMs: 0 },
  exploring:  { root: 57, intervals: [0, 3, 7, 10], tempoMs: 1800 },
  combat:     { root: 53, intervals: [0, 1, 6, 8],  tempoMs: 700 },
  catacombs:  { root: 41, intervals: [0, 5, 7, 12], tempoMs: 2200 },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export async function startMusic(): Promise<void> {
  if (_started) return;
  try {
    T = await import('tone');
    await T.start();
  } catch {
    return;
  }
  _started = true;
  masterGain = new T.Gain(0).toDestination();
  pad = new T.PolySynth(T.AMSynth, { volume: -18 }).connect(masterGain);
  pluck = new T.PluckSynth({ attackNoise: 0.4, dampening: 5000, resonance: 0.85 }).connect(masterGain);
  bell = new T.MetalSynth({ envelope: { attack: 0.001, decay: 0.6, release: 0.4 } }).connect(masterGain);
  bell.volume.value = -22;
  bass = new T.MonoSynth({ oscillator: { type: 'sawtooth' }, volume: -22 }).connect(masterGain);
  setPhase('exploring');
  tickLoop();
}

function tickLoop(): void {
  if (!T || !masterGain) return;
  const scale = SCALES[currentPhase];
  if (currentPhase === 'off' || scale.tempoMs === 0) {
    loopId = setTimeout(tickLoop, 500) as unknown as number;
    return;
  }
  const intervalIdx = Math.floor(Math.random() * scale.intervals.length);
  const noteMidi = scale.root + scale.intervals[intervalIdx];
  const freq = midiToFreq(noteMidi);
  const now = T.now();

  if (currentPhase === 'exploring') {
    if (Math.random() < 0.25) {
      const chord = scale.intervals.slice(0, 3).map(i => midiToFreq(scale.root + i));
      pad?.triggerAttackRelease(chord, '2n', now);
    } else if (Math.random() < 0.5) {
      pluck?.triggerAttackRelease(freq, '4n', now);
    }
  } else if (currentPhase === 'combat') {
    if (Math.random() < 0.6) bass?.triggerAttackRelease(midiToFreq(scale.root - 12), '16n', now);
    if (Math.random() < 0.8) pluck?.triggerAttackRelease(freq, '32n', now);
  } else if (currentPhase === 'catacombs') {
    if (Math.random() < 0.2) bell?.triggerAttackRelease(freq * 2, '4n', now);
    if (Math.random() < 0.4) bass?.triggerAttackRelease(midiToFreq(scale.root - 12), '2n', now);
  }
  loopId = setTimeout(tickLoop, scale.tempoMs * (0.8 + Math.random() * 0.4)) as unknown as number;
}

export function setPhase(phase: MusicPhase): void {
  if (currentPhase === phase) return;
  currentPhase = phase;
  if (!_started || !T || !masterGain) return;
  const target = phase === 'off' ? 0 : phase === 'combat' ? 0.5 : 0.35;
  masterGain.gain.linearRampTo(target, 2.0, T.now());
}
