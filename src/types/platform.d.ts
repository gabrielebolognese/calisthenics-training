// Platform APIs missing from the DOM typings, and the NoSleep.js media module.

/// <reference types="vite-plugin-pwa/client" />

interface AudioSession {
  type: string;
}

interface Navigator {
  /** Audio Session API (Safari 16.4+). */
  audioSession?: AudioSession;
}

declare module 'nosleep.js/src/media.js' {
  export const webm: string;
  export const mp4: string;
}
