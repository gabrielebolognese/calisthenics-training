# iPhone checklist

Manual tests to run on the phone (brief §15). The app lives at
**https://gabrielebolognese.github.io/calisthenics-training/**. Note the result next to each line. Anything that fails goes back to me with what you saw.

The wake lock needs iOS 18.4 or later when launched from the home screen.

## Install

- [ ] Open the URL in Safari → Share → **Add to Home Screen**. The icon shows green rings on black, named "Train".
- [ ] Launch it from the home screen: no Safari bars, black status bar, content clear of the notch and the home indicator.
- [ ] Onboarding shows your week 0 numbers. Tap Start: Today shows "Block 1 · Week 1 · Day 1: Push A" with exact numbers.

## Screen stays on

- [ ] Tap START, put the phone down, don't touch it for 3 minutes: the screen stays on. The player says "Screen on" at the top right.
- [ ] Switch to another app and back during a rest: still "Screen on" a moment later.
- [ ] Low Power Mode on, then START: if the lock is refused, the player says "Screen may lock" with the Auto-Lock hint. Write down what happened.

## Timers

- [ ] Lock the phone mid-rest, unlock after 30 s: the rest shows the right remaining time (30 s less, not paused).
- [ ] Lock the phone during a rest and leave it locked past the end of the rest: after unlocking, the app has moved on to "Get in position" for the next set, with a fresh 5 s countdown.
- [ ] Holds start on their own after the 5 s countdown, beep at the end, and rest starts by itself.

## Resume

- [ ] Mid-session, swipe the app away (kill it). Reopen: "Resume session" appears. Tap CONTINUE: same step, right time, sound back on.

## Sound with music

Start music in Spotify or Apple Music, then START a session.

- [ ] Beeps play over the music, and the music keeps playing.
- [ ] Voice cues ("Set 2 of 4…", "Rest 90 seconds") play, and the music keeps playing (ducked briefly is fine, stopping is not).
- [ ] Settings → Mixing with music → try "Duck briefly" and "Mix". Which one works better? Does the ring/silent switch mute the beeps?
- [ ] Note in DECISIONS.md A01: which mode, and whether music ever stopped.

## Offline

- [ ] Airplane mode on, close the app fully, reopen from the home screen: Today loads, a session runs, it saves.

## Data

- [ ] Settings → Export backup: a JSON file is saved (Files app).
- [ ] Settings → Reset all data (three taps): onboarding appears.
- [ ] Onboarding → Start, then Settings → Import backup → choose the file: Log shows your sessions again and Today is back at the right day.

## Updates

- [ ] After I push a change: open the app, wait a few seconds, close and reopen it. The new version loads. It never reloads in the middle of a session.
