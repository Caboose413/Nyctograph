# Celestial // Nyctograph

Interactive ARG prototype for **Celestial**, built as a static web page (same setup as Project Dead Drop: no build step, GitHub Pages ready).

The player finds the **Nyctograph**, the decoder unit of the man who reached this world first and ran out of air. They wake it, read his recordings, and finish deciphering the Thetan script he couldn't. A voice on the unit, **The Caretaker**, helps them along. It is helpful. Mostly.

## Play locally

Open `index.html` in a browser. Nothing else is needed.

## Current features

- Buffer recovery intro (before the login): two clean captures of the flight (undock, drive start: all nominal), then The Caretaker's message cuts into the feed (gold interference, then the message decodes as a rough translation in about 7 s over a looping SkyRings clip, `media/carrier-loop.mp4`), and the three captures after it arrive damaged (field spike, black-hole transit, the surface): received block by block, stalling where the data ends, tearing while on screen. Shown on the first visit and after a reset; `Replay recovered buffer` on the login, or `index.html?captures`, plays it again.
- Intro sound and effects: a "Begin recovery" gate (browsers only allow sound after a click) with a Sound on/off toggle (remembered). Game sounds for each beat (unit hum, engine and field whine at drive start, the eye-rumble under the message, alert and charge on the field spike, boom on the transit, wind and O2 warning on the surface, a slowing heartbeat at the end); glitch bursts, data chirps and decode ticks are synthesised live. Screen: CRT power-on/off, rolling scan bar, engine rumble, hard shake and gold page flicker when the carrier cuts in, red alert pulse, white flash, red/cyan split on bad data. Cues live in `CUES` in `core/captures.js`. Reduced motion turns the screen effects off.
- The Caretaker reacts when asked about the message: it deflects in the first layer, half-admits in The Ritual, owns it in The Machine; before the unit is awake only a fragment gets through.
- Boot gate: unit ID + passphrase written in Thetan glyphs, solved from a calibration strip on the same page.
- Terminal archive (`help`, `ls`, `cd`, `cat`, `translate`, `lexicon`, `map`, `say`, `status`) with clickable listings.
- Thetan script: 26 glyphs. Known signs are captioned; unknown signs take pencil guesses that sync across every capture.
- Chapters unlock in layers: Owner Camp -> The Ritual -> The Machine (waits for an in-game field glyph).
- Surface feed: a dimmed in-game loop plays behind the panels (falls back to the starfield; reduced motion shows the still), and `surface/feed-000` shows the unit's camera on the new arrival's camp.
- Rotating survey globe with recovered locations and the "walk any bearing, you return here" great circle.
- The Caretaker: static in-world replies by keyword and story layer, with escalating hints. Optional LLM bridge.
- Progress is saved in localStorage; "Reset unit" clears it.

## Project layout

- `index.html`, `styles.css`: entry page and look.
- `core/content.js`: all story text, folders, captures, map points and the buffer-recovery captures. Add chapters here.
- `core/captures.js`: the buffer-recovery intro player and its sound/effect cues.
- `core/audio.js`: intro sound (Web Audio): game sounds from `media/audio/`, plus synthesised glitches and ticks.
- `core/secrets.js`: answers as salted fingerprints (never plain text).
- `core/glyphs.js`: the Thetan glyph set and its renderer.
- `core/commands.js`: console commands, translation checks, unlock rewards.
- `core/caretaker.js`: The Caretaker's replies and hints.
- `core/planet-map.js`: survey globe.
- `core/sky-feed.js`: backdrop video start/fallback.
- `media/`: web-ready footage (720p silent loops + poster stills). Full-quality source cuts live in `Resources/`.
- `tools/fingerprint.js`: makes a fingerprint for a new answer.
- `tools/build-audio.py`: builds `media/audio/*.mp3` from the game's WAVs (`Celestial/Content/Celestial/Audio` and `Celestial/Saved/celconvert`): mono, levelled, seamless loops, MP3 via Blender's `aud`. Also writes `media/audio/audio-data.js` (same sounds as base64), loaded only when the page is opened from disk, where `fetch` is blocked.
- `tools/carrier-video.py`: cuts 3.5 s from the middle of `Resources/SkyRings.mp4`, crops off the editor toolbar and taskbar, and plays it forward then back (seamless 6.9 s loop). Writes the site loop `media/carrier-loop.mp4` + poster, and the marketing video and still `Resources/Marketing/carrier-message.mp4` / `.png` with the message decoding on top. Run `python tools/carrier-video.py` (Pillow + numpy + Blender at `E:/blender-5.3.0`).
- `tools/corrupt-captures.py`: makes the capture stills (clean ones before the message, damaged after) (`media/captures/`) and captioned 1920x1080 marketing stills (`Resources/Marketing/`) from clean frames in `Resources/Captures/`. It also holds `CARRIER_LINES`, the message text for the marketing video: keep it in sync with `carrierMessage` in `core/content.js`. Run `python tools/corrupt-captures.py` (Pillow + numpy); copy its `stop` / `stopCol` / `coarseEnd` output into the captures list in `core/content.js`.
- `docs/`: private design notes and solutions (ignored by Git).

## Adding a puzzle

1. Add a capture to `core/content.js` (`type: "inscription"`, `puzzle.text`, `learns`, `unlocks`).
2. Add a secret id with a new salt in `core/secrets.js`, then run
   `node tools/fingerprint.js <secretId> "<answer>"` and paste the number into `fingerprints`.
3. Handle the new `unlocks` context in `onSolved` in `core/commands.js` and give The Caretaker lines for it.

## Caretaker LLM bridge (optional)

Set `CARETAKER_ENDPOINT` in `core/config.js`. The page POSTs `{ message, contexts, history }` and expects `{ reply }`. When it's empty or offline, the static replies are used.
