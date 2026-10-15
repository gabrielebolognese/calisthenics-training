// Voice cues through speechSynthesis (brief §7): "Set 2 of 4. Archer HSPU. 2 per side."

let enabled = true;

export function setVoiceEnabled(on: boolean): void {
  enabled = on;
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

/** Call inside the START tap: iOS only lets speech start from a user gesture the first time. */
export function primeVoice(): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function say(text: string): void {
  if (!enabled || !text || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

/** "Rest 3 minutes", "Rest 90 seconds", "Rest 2 minutes 30". */
export function spokenDuration(seconds: number): string {
  if (seconds < 120 && seconds % 60 !== 0) return `${seconds} seconds`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} minutes ${s}` : `${m} ${m === 1 ? 'minute' : 'minutes'}`;
}
