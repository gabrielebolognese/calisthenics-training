// Keeps the screen on for the whole session (brief §9): Screen Wake Lock API first, re-acquired
// whenever the page becomes visible again; a hidden muted looping video as the fallback.
// The fallback video data comes from NoSleep.js (MIT, Rich Tibbett).
import { mp4, webm } from 'nosleep.js/src/media.js';

export type AwakeStatus = 'off' | 'native' | 'video' | 'failed';

type Listener = (s: AwakeStatus) => void;

class ScreenAwake {
  private sentinel: WakeLockSentinel | null = null;
  private video: HTMLVideoElement | null = null;
  private wanted = false;
  private listeners = new Set<Listener>();
  status: AwakeStatus = 'off';

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.status);
    return () => this.listeners.delete(l);
  }

  private set(s: AwakeStatus) {
    this.status = s;
    for (const l of this.listeners) l(s);
  }

  /** Call from the START tap so the video fallback is allowed to play. */
  start(): Promise<AwakeStatus> {
    if (!this.wanted) document.addEventListener('visibilitychange', this.onVisible);
    this.wanted = true;
    // Without the native API, start the video synchronously inside the gesture.
    if (!('wakeLock' in navigator)) return this.playVideo();
    return this.acquire();
  }

  stop(): void {
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
    this.video?.pause();
    this.set('off');
  }

  private onVisible = () => {
    if (this.wanted && document.visibilityState === 'visible' && !this.sentinel) void this.acquire();
  };

  private async acquire(): Promise<AwakeStatus> {
    if ('wakeLock' in navigator) {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        this.sentinel = sentinel;
        sentinel.addEventListener('release', () => {
          if (this.sentinel === sentinel) this.sentinel = null;
          if (this.wanted && document.visibilityState === 'visible') void this.acquire();
          else if (this.status === 'native') this.set('off');
        });
        this.video?.pause();
        this.set('native');
        return 'native';
      } catch {
        // Refused (Low Power Mode, not visible, unsupported in this context): fall back.
      }
    }
    return this.playVideo();
  }

  private async playVideo(): Promise<AwakeStatus> {
    try {
      if (!this.video) {
        const v = document.createElement('video');
        v.setAttribute('playsinline', '');
        v.setAttribute('muted', '');
        v.muted = true;
        v.loop = true;
        v.setAttribute('aria-hidden', 'true');
        v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0';
        for (const [type, src] of [['webm', webm], ['mp4', mp4]] as const) {
          const source = document.createElement('source');
          source.src = src;
          source.type = `video/${type}`;
          v.appendChild(source);
        }
        document.body.appendChild(v);
        this.video = v;
      }
      await this.video.play();
      this.set('video');
      return 'video';
    } catch {
      this.set('failed');
      return 'failed';
    }
  }
}

export const screenAwake = new ScreenAwake();
