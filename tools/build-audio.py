"""Builds the intro's sound set (media/audio/*.mp3) from the game's own sounds.

Reads the WAVs, mixes to mono, trims, levels them (loops by loudness, one-shots by peak),
turns loops into seamless crossfaded loops, and encodes MP3 with Blender's audio library (aud).
Also writes media/audio/audio-data.js (the same sounds as base64) for file:// pages.
Glitch bursts, data chirps and decode ticks are made live in core/audio.js, not here.

Run from the Website folder:  python tools/build-audio.py
Needs numpy and Blender (BLENDER below).
"""
import base64
import json
import os
import shutil
import subprocess
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"E:\blender-5.3.0\blender.exe"
GAME = r"F:\Work\Celestial\Celestial"
CONTENT = os.path.join(GAME, "Content", "Celestial", "Audio")
CONVERTED = os.path.join(GAME, "Saved", "celconvert")
RATE = 44100

# name: (source, kind, options)
#   kind "loop": level by RMS to `db`, cut to `seconds`, crossfade the seam
#   kind "shot": level by peak to `db`, optional `seconds` cut and fade-out
SOUNDS = {
    "hum":       (os.path.join(CONTENT, "Machines", "SW_Machine_Hum.wav"), "loop", {"db": -22, "seconds": 16}),
    "engine":    (os.path.join(CONVERTED, "sounds", "machines", "SW_Machine_FuelCell.wav"), "loop", {"db": -18, "seconds": 9}),
    "field":     (os.path.join(CONVERTED, "sounds", "machines", "SW_Machine_Field.wav"), "loop", {"db": -24, "seconds": 10}),
    "rumble":    (os.path.join(CONVERTED, "eye_rumble", "SW_EyeRumble_Loop.wav"), "loop", {"db": -16, "seconds": 20}),
    "wind":      (os.path.join(CONVERTED, "loops", "SW_CelestialWind_Loop.wav"), "loop", {"db": -20, "seconds": 20, "start": 30}),
    "beep-long": (os.path.join(CONTENT, "Machines", "SW_Machine_Beep_03.wav"), "shot", {"db": -6}),
    "beep-ok":   (os.path.join(CONTENT, "Machines", "SW_Machine_Beep_01.wav"), "shot", {"db": -6}),
    "beep-soft": (os.path.join(CONTENT, "Machines", "SW_Machine_Beep_04.wav"), "shot", {"db": -8}),
    "alert":     (os.path.join(CONTENT, "Machines", "SW_Machine_Alert.wav"), "shot", {"db": -4}),
    "charge":    (os.path.join(CONVERTED, "turret_laser", "SW_Turret_Charge_01.wav"), "shot", {"db": -4}),
    "boom":      (os.path.join(CONTENT, "Impacts", "SW_Impact_Boom_02.wav"), "shot", {"db": -2}),
    "o2":        (os.path.join(CONVERTED, "audio", "S_O2_Warning.wav"), "shot", {"db": -6}),
    "heartbeat": (os.path.join(CONVERTED, "audio", "Heartbeat.wav"), "shot", {"db": -3}),
}

HELPER = r'''
import aud, sys
argv = sys.argv[sys.argv.index("--") + 1:]
for src, out in zip(argv[0::2], argv[1::2]):
    aud.Sound(src).write(out, 44100, aud.CHANNELS_MONO, aud.FORMAT_S16, aud.CONTAINER_MP3, aud.CODEC_MP3, 112000)
'''


def read(path):
    with wave.open(path) as w:
        n, ch, sr, sw = w.getnframes(), w.getnchannels(), w.getframerate(), w.getsampwidth()
        raw = w.readframes(n)
    dtype = {2: np.int16, 4: np.int32}[sw]
    a = np.frombuffer(raw, dtype=dtype).astype(np.float64) / np.iinfo(dtype).max
    a = a.reshape(-1, ch).mean(axis=1)
    if sr != RATE:
        t_old = np.arange(len(a)) / sr
        t_new = np.arange(int(len(a) * RATE / sr)) / RATE
        a = np.interp(t_new, t_old, a)
    return a


def db(x):
    return 10 ** (x / 20)


def make_loop(a, seconds, level_db, start=0.0, fade=1.5):
    s = int(start * RATE)
    n = int(seconds * RATE)
    f = int(fade * RATE)
    body = a[s:s + n + f]
    if len(body) < n + f:
        body = np.tile(a, int(np.ceil((n + f) / len(a))) + 1)[: n + f]
    # crossfade the tail over the head so the loop has no seam
    ramp = np.linspace(0, 1, f)
    out = body[:n].copy()
    out[:f] = body[:f] * ramp + body[n:n + f] * (1 - ramp)
    rms = np.sqrt((out ** 2).mean())
    return out * db(level_db) / max(rms, 1e-9)


def make_shot(a, level_db):
    a = a[np.argmax(np.abs(a) > 1e-4):]  # drop leading silence
    fade = min(len(a), int(0.01 * RATE))
    a[-fade:] *= np.linspace(1, 0, fade)
    return a * db(level_db) / max(np.abs(a).max(), 1e-9)


def write(path, a):
    a = np.clip(a, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def main():
    out_dir = os.path.join(ROOT, "media", "audio")
    os.makedirs(out_dir, exist_ok=True)
    work = tempfile.mkdtemp(prefix="celaudio-")
    try:
        args = []
        for name, (src, kind, opt) in SOUNDS.items():
            a = read(src)
            a = make_loop(a, opt["seconds"], opt["db"], opt.get("start", 0)) if kind == "loop" else make_shot(a, opt["db"])
            tmp = os.path.join(work, name + ".wav")
            write(tmp, a)
            args += [tmp, os.path.join(out_dir, name + ".mp3")]
            print(f"{name:10s} {len(a) / RATE:5.1f}s  from {os.path.basename(src)}")
        helper = os.path.join(work, "mix.py")
        with open(helper, "w", encoding="utf-8") as f:
            f.write(HELPER)
        subprocess.run([BLENDER, "-b", "--factory-startup", "--python", helper, "--", *args],
                       check=True, stdout=subprocess.DEVNULL)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    # Same sounds as base64 for pages opened straight from disk (file:// blocks fetch).
    # core/audio.js only loads this when fetching the MP3s fails.
    embedded = {}
    for name in SOUNDS:
        with open(os.path.join(out_dir, name + ".mp3"), "rb") as f:
            embedded[name] = base64.b64encode(f.read()).decode("ascii")
    with open(os.path.join(out_dir, "audio-data.js"), "w", encoding="utf-8") as f:
        f.write("// Generated by tools/build-audio.py. Fallback for file:// where fetch is blocked.\n")
        f.write("window.CelAudioData = " + json.dumps(embedded) + ";\n")
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir) if f.endswith(".mp3"))
    print(f"done: {len(SOUNDS)} files, {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
