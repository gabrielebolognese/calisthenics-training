// Service worker registration (brief §14). A new version installs on its own, but never while a
// session is running: the page reload that activates it waits until the session ends.
import { registerSW } from 'virtual:pwa-register';

let busy = false;
let apply: (() => void) | null = null;

export function setTraining(on: boolean): void {
  busy = on;
  if (!on && apply) apply();
}

export function initPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      apply = () => void update(true);
      if (!busy) apply();
    },
    onRegisteredSW(_url, reg) {
      // Look for a new version every hour while the app is open.
      if (reg) setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
}
