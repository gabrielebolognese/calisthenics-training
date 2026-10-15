// Short beeps through Web Audio, unlocked on the START tap (brief §7). They must mix with music:
// the audio session type asks iOS to mix or briefly duck other audio instead of stopping it.

export type AudioMode = 'transient' | 'ambient';
export type BeepKind = 'tick' | 'go' | 'end' | 'round';

let ctx: AudioContext | null = null;
let enabled = true;

/** Applies the audio session type. Returns what the browser accepted, for Settings and DECISIONS A01. */
export function setAudioSession(mode: AudioMode): string {
  const session = navigator.audioSession;
  if (!session) return 'unsupported';
  for (const type of mode === 'transient' ? ['transient', 'ambient'] : ['ambient']) {
    try {
      session.type = type;
      if (session.type === type) return type;
    } catch {
      // Try the next type.
    }
  }
  return 'failed';
}

/** Call inside a tap handler: iOS only lets audio start from a user gesture. */
export function unlockAudio(mode: AudioMode): void {
  setAudioSession(mode);
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  void ctx.resume();
  // A silent buffer finishes the unlock on older iOS versions.
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

const SOUNDS: Record<BeepKind, { freq: number; ms: number; gain: number }> = {
  tick: { freq: 880, ms: 90, gain: 0.25 },
  round: { freq: 1100, ms: 160, gain: 0.35 },
  go: { freq: 1320, ms: 220, gain: 0.4 },
  end: { freq: 660, ms: 450, gain: 0.4 },
};

export function beep(kind: BeepKind): void {
  if (!enabled || !ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const { freq, ms, gain } = SOUNDS[kind];
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}
