# Vocalishz (Android)

Tuner for guitar, bass and ukulele, plus a vocal coach with warm-ups built around your own range.

## Running it
1. Open this folder in Android Studio and let Gradle sync.
2. Set **Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK** to JDK 21 (e.g. `jbr-21`). Gradle 8.11.1 cannot run on Java 25, and fails with a bare `25.0.3` error.
3. Turn on USB debugging on the phone, plug it in, press ▶.

There is no `gradlew` script; build from Android Studio, or run the cached Gradle 8.11.1 distribution with `JAVA_HOME` pointing at a JDK 21.

## How it's built
No third-party dependencies, only the Android framework.

| File | Role |
|---|---|
| `app/src/main/assets/index.html` | The whole UI (HTML/CSS/JS in a WebView): tabs, tuner display, note maths |
| `MainActivity.kt` | Hosts the WebView, mic permission, plays reference tones, JS bridge (`Android.*`) |
| `PitchDetector.kt` | Mic capture (`AudioRecord`, 44.1 kHz decimated to 22.05 kHz) and YIN pitch detection |

- Native to JS: `onPitch(hz, clarity, level)` about 43 times a second (`hz` is 0 when silent or unclear), `onMicState('on'|'denied')`.
- JS to native: `Android.startMic()`, `Android.stopMic()`, `Android.playTone(hz, seconds)`.
- The mic runs only while the Tuner tab is open and the app is in the foreground.
- YIN settings: 2048-sample window, hop 512, threshold 0.15, range 35 to 1600 Hz. Checked against synthetic tones: under 2 cents of error from 41 Hz (bass low E) to 1047 Hz.
- Settings are stored in `localStorage` under the key `vocalishz`: `{ mode, a4 }`.
- Targets Android 15 (SDK 35, edge-to-edge, so the root view pads for the system bars); min SDK 26.

## Status
**v0.1, done:** Tuner tab.
- Modes: Chromatic, Guitar (E2 A2 D3 G3 B3 E4), Bass (E1 A1 D2 G2), Ukulele (G4 C4 E4 A4).
- Needle from -50 to +50 cents, green within ±5. Median-of-5 plus smoothing.
- Instrument modes snap to the nearest string. Tap a string to hear it; mic input is ignored while the tone plays.
- Adjustable A4 reference (415 to 466 Hz).
- Not yet tested with a real instrument on the phone.

## Roadmap
**v0.2: Range tab (calibration).**
- Slide down to your lowest comfortable note and hold it for about 1 s, then your highest.
- Save the low and high notes, and show a rough voice type (bass, baritone, tenor, alto, mezzo, soprano).
- Keep a history of tests so range changes show over time. Can be redone any time.
- First launch should send the user here.

**v0.3: Warm-ups tab.**
- Every exercise is fitted to the saved range. Start near the bottom, step up a semitone each repetition, stop before the top, then come back down.
- Exercises:
  - 5-note scale: 1-2-3-4-5-4-3-2-1
  - Triad arpeggio: 1-3-5-8-5-3-1
  - Chromatic: semitones up and down
  - Fifth jumps: 1-5-1, then 1-5-8-5-1
  - Siren: slide across the whole range
- Call and response: the app plays the phrase, then the user sings it back. This avoids the mic hearing the reference tone. A headphones sing-along mode could be added later as an option.
- Live graph: target notes as bands, the sung pitch as a line on top.

**v0.4: Scoring and progress.**
- Score each note by the share of time within about ±25 cents.
- History per exercise.
- Maybe a custom exercise builder.

**Possible extras:** a light/dark theme like Metronome's, more tunings (drop D, 5-string bass).
