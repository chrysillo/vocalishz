# Roadmap

How the app is meant to fit together, what is done, and what comes next.

## The big picture: warm-ups vs challenge

The two tabs do different jobs, and each follows its own teaching order.

| | Warm-ups | Challenge (Thread the Needle) |
|---|---|---|
| Purpose | Get the voice ready | Test ear and pitch control |
| Feel | Gentle, guided, can't fail | A game: timed, best times kept |
| Prompts | Each rep is played first, then sung back | No reference tones; sing from memory |
| Order | Middle of the range outwards: easy note → slides → steps → arpeggios → full-range siren | Steps → thirds → arpeggio → fifths and octaves |
| Tolerance | Slides use a fixed ±50 cents; other stages use the setting | The setting (Easy / Medium / Strict) |

### Research behind it

Most sources are voice teachers rather than studies; the one solid reference is Titze's 2001 *Journal of Singing* article.

- **Warm-up order.** Teachers broadly agree: breath and gentle sound, then slides, then scales, then arpeggios. Titze recommends lip trills, tongue trills, humming and narrow-tube (straw) phonation on glides, scales or arpeggios.
- **Start in the middle, then widen.** Begin on a comfortable mid-range note, keep early slides inside a comfortable part of the range, and leave the extremes for later. The old warm-up opened with a siren across the whole range, which is the hardest exercise in the set.
- **Pitch training order.** Match one note first (unison), then steps (seconds), then thirds, then arpeggios, fifths and octaves.

Sources:
- [Titze, "Voice Research: The Five Best Vocal Warm-up Exercises", Journal of Singing 57(3), 2001](https://iro.uiowa.edu/esploro/outputs/journalArticle/Voice-Research-The-Five-Best-Vocal/9984719854102771)
- [ChoralNet warm-up discussion](https://choralnet.org/archives/570285)
- [10 vocal warm-up exercises, Songwriting Magazine](https://www.songwritingmagazine.co.uk/tips/10-vocal-warm-up-exercises)
- [The 5 Best Vocal Warmups, Toronto Arts Academy](https://torontoartsacademy.com/best-vocal-warmups/)
- [How to warm up before singing, Singing Carrots](https://singingcarrots.com/blog/how-to-warm-up-before-singing-easy-vocal-warm-ups-for-beginners/)
- [14-day pitch and intonation course, 30 Day Singer](https://www.30daysinger.com/tutorial/14-day-pitch-and-intonation-course-with-camille/3)
- [How to sing in tune for beginners, 30 Day Singer](https://30daysinger.com/tutorial/how-to-sing-in-tune-for-beginners-part-1/3)
- [Pitch training for singers, Soundbrenner](https://www.soundbrenner.com/blogs/articles/pitch-training-for-singers-simple-daily-exercises)
- [What is ear training?, Wisseloord](https://wisseloord.org/?p=48289)

## Done in v0.3

### Tuner
- Reads against the nearest chromatic note in every mode, so any note moves the needle; string buttons still light up and get their check mark when you hit a string.
- Cents readout removed; the line under the note shows only Hz.
- A string is marked tuned after 0.25 s within ±8 cents (the green zone stays ±5).
- Screen stays on while the tuner is open.

### Range result
- After a range test: "You sing like a Baritone", your notes and span, a chart of your range against the typical voice types, and how your top, bottom and span compare. No percentile: the app has no data on how ranges are spread.

### Warm-ups
- Reordered from the middle of the range outwards: Hum a note, Gentle slides (Sol down to Do), 5-note scale, Arpeggio, Octave arpeggio, Siren last. Fifth jumps moved to the challenge.
- Each warm-up can be started on its own from the list; Start warm-up runs them all.
- Scrolling pitch chart: your voice as a coloured line against the target band, which is as tall as the tolerance and fills as you hold. A hit flashes the band and leaves a green dot.
- Listen keeps your place; tapping it while the notes play, or Start singing, skips straight to your turn.
- Easy / Medium / Strict tolerance on the session screen.

### Challenge: Thread the Needle
- A ball follows your pitch. Each note is a wall with a hole at that note; hold the ball in the hole to fill it, the ball shoots through and the wall bursts into confetti.
- Five levels: Up the scale, Down the scale, Scale in thirds, Arpeggio, Fifths & octaves. Best time kept per level, with "New best!" on the finish.
- One colour per scale degree (no greens, which mean "in tune"), on walls, lanes and chips; sky background, light and dark.

### Settings
- Theme: System, Light or Dark. The page swaps its colour tokens on `data-theme`; the native window and system bars follow, and the choice is kept natively so the app opens in it.
- Keep screen on: in the tuner (default) or always.

## Done in v0.4

- **Echo level** (first in the list): eight random notes in the key, each played as its wall slides in, so you match by ear.
- **Minor scale** and **Random intervals** levels. Random courses never repeat a note back to back, and stay put until you finish and play again. Minor-key solfège reads Me, Le, Te.
- Levels and courses live in `courses.js` (pure, tested); walls and chips are coloured by scale degree from there too.
- **Warm-up sounds:** each stage says what to sing it on: hum, then lip trill, then "ah" for the scales and arpeggios, lip trill or "oo" for the siren. Gentle semi-occluded sounds first, as Titze recommends. Shown in the list and the session header. Stage 1 is now "Find your note".
- **Range test history:** the last ten tests are kept; Settings lists earlier ones under your current range.
- **More tunings:** Guitar Drop D and DADGAD, 5-string bass.
- **Tests** for the courses, range history and best times (20 JS tests in all).

## Next

- **Test with a real voice and instruments on the phone.** Everything so far has been checked with simulated pitch input.
- **Tests for the screen scripts and canvas views** (`warmups.js`, `challenge.js`, `chart.js`, `holes.js`); the pure modules are covered.
- Remove the unused rungs-and-ball mode from `chart.js`, left from an earlier challenge design.
