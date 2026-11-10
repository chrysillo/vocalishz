# Vocalishz (Android)

Tuner for guitar, bass and ukulele, plus a vocal coach with warm-ups built around your own range.

## Running it
1. Open this folder in Android Studio and let Gradle sync.
2. Set **Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK** to JDK 21 (e.g. `jbr-21`). Gradle 8 cannot run on Java 25, and fails with a bare `25.0.3` error.
3. Turn on USB debugging on the phone, plug it in, press ▶.

From a terminal: `./gradlew assembleDebug test` with `JAVA_HOME` pointing at a JDK 21. `test` runs the Kotlin unit tests and, when Node is installed, the JS tests in `app/src/test/js` (`node --test app/src/test/js/*.test.js` on its own).

## How it's built
No third-party dependencies, only the Android framework (JUnit for unit tests; the JS tests use Node's built-in runner).

| File | Role |
|---|---|
| `app/src/main/assets/index.html` | Markup for every screen, an SVG icon sprite, and the script order |
| `assets/css/app.css` | Layout and components; colours only through theme tokens |
| `assets/js/notes.js`, `store.js`, `ui.js`, `audio.js`, `pitch.js` | Note maths and naming; validated settings in `localStorage`; DOM helpers and the progress ring; native bridge (mic, pitch events, tones, muting the mic while a tone plays); pitch smoothing (`Tracker`) and "held in tune" timing (`Holder`) |
| `assets/js/app.js` | Router: tabs reset the history, other screens push on top, `V.app.back()` is called by the Android back button. Also binds every `.seg[data-setting]` control to its setting |
| `assets/js/tuner.js`, `settings.js`, `range.js`, `warmups.js`, `challenge.js` | One file per screen. Each registers `{ enter, leave, wantsMic }`; the router turns the mic on only while the current screen wants it |
| `design/theme-canyon.json` | The only place colours are defined (Canyon light and dark). `:app:generateTheme` turns it into `theme.css` (CSS variables, dark via `prefers-color-scheme`) and `colors.xml` (`canyon_light_*`, `canyon_dark_*`, plus day/night `theme_*` aliases) at build time |
| `res/values{,-night,-v27,-night-v27}/themes.xml` | Day/night app theme: window background and system bars |
| `MainActivity.kt` | Hosts the WebView (navigation limited to bundled assets), mic permission, reference tones on one background thread, back button, JS bridge (`Android.*`) |
| `PitchDetector.kt` | Mic capture (`AudioRecord`, 44.1 kHz decimated to 22.05 kHz) on its own thread |
| `Yin.kt` | YIN pitch detection, pure Kotlin with no Android APIs; tested in `app/src/test/.../YinTest.kt` |

- Native to JS: `onPitch(hz, clarity, level)` about 43 times a second (`hz` is 0 when silent or unclear), `onMicState('on'|'denied')`.
- JS to native: `Android.startMic()`, `Android.stopMic()`, `Android.playTone(hz, seconds)`. `playTone` ignores non-finite values and clamps `hz` to 20–5000 and `seconds` to 0.05–5; a new tone replaces one still playing.
- The mic runs only on screens that listen (Tuner, range test, your turn in a warm-up, a running challenge) and only while the app is in the foreground: a `startMic()` made while paused waits for `onResume`. The WebView and its timers pause with the app. If access is denied, tapping the notice asks again.
- YIN settings: 2048-sample window, hop 512, threshold 0.15, range 35 to 1600 Hz. `YinTest` pins under 2 cents of error on synthetic tones from 41 Hz (bass low E) to 1047 Hz.
- Settings are stored in `localStorage` under the key `vocalishz`: `{ mode, a4, tunerView, names, hold, tolerance, range, challengeRoot }`.
- Targets Android 16 (SDK 36, edge-to-edge, so the root view pads for the system bars; back uses `OnBackInvokedCallback` on Android 13+); min SDK 26. Portrait only, by design.
- Release builds are shrunk with R8; the default rules keep the `@JavascriptInterface` methods.

## Status
**v0.2, done:** Canyon theme (light and dark), and every screen from the designs that the app uses.
- **Tuner:** instrument dropdown (Chromatic, Guitar, Bass, Ukulele), dial or bar view, string buttons that play their note and get a check mark once tuned.
- **Settings:** voice type, range and keyboard; range test (lowest, then highest steady note held for 1 s); note names (letters, solfège, both); hold time; pitch tolerance; A4 reference; tuner view.
- **Warm-ups:** optional guided session: Siren, 5-note scale, Triad arpeggio, Fifth jumps. Each rep is played first, then sung back note by note; a note passes when held in tune. Reps step up a semitone within your range.
- **Challenge, drop the ball:** sing a major scale Do to Do with no prompts; each rung breaks only when its note is held in tune. Timed, key adjustable. No scores kept.
- Not yet tested with a real instrument or voice on the phone.

## Priorities
Held to the highest bar: mic capture and pitch detection (`PitchDetector.kt`, `Yin.kt`), the JS bridge (`MainActivity.kt`), and the note and hold maths (`notes.js`, `pitch.js`).

## Known debt
- Screen scripts (`tuner.js`, `warmups.js`, `challenge.js`, `range.js`) have no tests; only the pure modules (`notes.js`, `store.js`, `pitch.js`) do.
- Not yet tested with a real instrument or voice on the phone.

## Ideas
- Range test history.
- More tunings (drop D, 5-string bass).
