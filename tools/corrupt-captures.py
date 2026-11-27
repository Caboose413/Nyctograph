"""Builds the "half-recovered" capture stills for the buffer-recovery intro.

Each clean game frame is turned into an image that looks like it stopped loading:
top part decoded, a stalled macroblock row, a coarse first-pass band, then a smeared
void where the data ends. Bitstream-style damage (shifted slices, channel splits,
wrong-colour blocks, colour drift) is added on top.

Captures marked "clean" (before the Caretaker's message) are left whole: noise and scanlines only.

Outputs:
  media/captures/capture-0N.jpg       web stills used by the site (no text burned in)
  Resources/Marketing/capture-0N.png  1920x1080 marketing stills with the unit caption

Run from the Website folder:  python tools/corrupt-captures.py
Needs Pillow + numpy. Each capture has a fixed seed, so reruns give the same damage.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLOCK = 16

CAPTURES = [
    # Before the message: clean, everything nominal.
    {
        "id": "capture-01",
        "src": "Resources/Captures/01-undock (intro f164).png",
        "seed": 1001,
        "clean": True,
        "label": "CAPTURE 01 // UNDOCK // PRE-FLIGHT",
        "stamp": "T-00:01:40",
    },
    {
        "id": "capture-02",
        "src": "Resources/Captures/02-drive-start (intro f200).png",
        "seed": 1002,
        "clean": True,
        "label": "CAPTURE 02 // DRIVE START // ENGINES NOMINAL",
        "stamp": "T+00:00:00",
    },
    # After the message: damaged.
    {
        "id": "capture-03",
        "src": "Resources/Captures/03-field-active (intro f438).png",
        "seed": 2202,
        "stop": 0.51,       # fraction of height that fully decoded
        "coarse": 0.18,     # band below the stop that only got the first, blocky pass
        "void": "grey",
        "label": "CAPTURE 03 // FIELD SPIKE",
        "stamp": "T+00:00:4▒",
    },
    {
        "id": "capture-04",
        "src": "Resources/Captures/04-transit (intro f620).png",
        "seed": 3303,
        "stop": 0.43,
        "coarse": 0.22,
        "void": "smear",
        "label": "CAPTURE 04 // TRANSIT // CLOCK DISAGREES",
        "stamp": "T+▒▒▒:▒▒:▒▒",
    },
    {
        "id": "capture-05",
        "src": "Resources/1194910_7.jpg",
        "seed": 4404,
        "stop": 0.58,
        "coarse": 0.14,
        "void": "grey",
        "label": "CAPTURE 05 // SURFACE // NO CATALOGUE MATCH",
        "stamp": "DAY 001",
    },
]


def clean_frame(cap, size):
    """Nominal capture: full frame, only sensor noise and scanlines."""
    rng = np.random.default_rng(cap["seed"])
    img = load(cap["src"], size)
    img += rng.normal(0, 3.0, img.shape)
    img[1::2] *= 0.95
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), {"stop": 1.0, "stopCol": 0.0, "coarseEnd": 1.0}


def load(path, size):
    img = Image.open(os.path.join(ROOT, path)).convert("RGB")
    return np.asarray(img.resize(size, Image.LANCZOS), dtype=np.float32)


def coarse_pass(region, rng):
    """First progressive pass: one colour per block, slightly off in chroma."""
    h, w, _ = region.shape
    out = region.copy()
    for y in range(0, h, BLOCK):
        for x in range(0, w, BLOCK):
            block = region[y:y + BLOCK, x:x + BLOCK]
            out[y:y + BLOCK, x:x + BLOCK] = block.mean(axis=(0, 1))
    # chroma lags behind luma on the first pass
    out[..., 0] = np.roll(out[..., 0], BLOCK // 2, axis=1)
    out[..., 2] = np.roll(out[..., 2], -BLOCK // 2, axis=1)
    return out


def corrupt(cap, size):
    if cap.get("clean"):
        return clean_frame(cap, size)
    rng = np.random.default_rng(cap["seed"])
    w, h = size
    img = load(cap["src"], size)
    clean = img.copy()

    rows = h // BLOCK
    stop_row = int(rows * cap["stop"])
    coarse_rows = max(1, int(rows * cap["coarse"]))
    stop_y = stop_row * BLOCK
    stop_col = int(rng.integers(w // BLOCK // 5, w // BLOCK * 4 // 5)) * BLOCK

    # 1. colour drift: a bit error a few rows above the stop shifts every later block's DC
    drift_row = max(0, stop_row - int(rng.integers(2, 6)))
    drift_y = drift_row * BLOCK
    drift_x = int(rng.integers(0, w // BLOCK)) * BLOCK
    tint = rng.choice([[-28, 22, -18], [24, -26, 20], [-20, -6, 30]])
    img[drift_y:drift_y + BLOCK, drift_x:] += tint
    img[drift_y + BLOCK:stop_y] += np.array(tint) * 0.7

    # 2. wrong-colour blocks scattered near the damage
    for _ in range(int(rng.integers(14, 26))):
        by = int(rng.integers(max(0, stop_row - 9), stop_row + 1)) * BLOCK
        bx = int(rng.integers(0, w // BLOCK)) * BLOCK
        span = int(rng.integers(1, 6)) * BLOCK
        dc = rng.choice([[40, 255, 120], [255, 40, 200], [30, 30, 30], [220, 220, 220], [90, 200, 255]])
        mix = rng.uniform(0.35, 0.8)
        img[by:by + BLOCK, bx:bx + span] = img[by:by + BLOCK, bx:bx + span] * (1 - mix) + np.array(dc) * mix

    # 3. stalled row: only blocks up to stop_col arrived
    coarse_top = stop_y
    coarse_bottom = min(h, stop_y + coarse_rows * BLOCK)
    coarse = coarse_pass(clean[coarse_top:coarse_bottom], rng)
    img[coarse_top:coarse_bottom] = coarse
    img[stop_y:stop_y + BLOCK, :stop_col] = clean[stop_y:stop_y + BLOCK, :stop_col]

    # 4. the void below: smeared last row, or decoder grey, fading into dark
    void_top = coarse_bottom
    if void_top < h:
        depth = h - void_top
        fade = (np.linspace(1.0, 0.0, depth) ** 1.5 * 0.9 + 0.08)[:, None, None]
        if cap["void"] == "smear":
            last = img[void_top - 1:void_top]
            smear = np.repeat(last, depth, axis=0)
            # smear wobbles sideways a little as it runs down
            for y in range(depth):
                if y % 3 == 0:
                    smear[y] = np.roll(smear[y], int(rng.integers(-3, 4)), axis=0)
            img[void_top:] = smear * fade + 10 * (1 - fade)
        else:
            grey = np.full((depth, w, 3), 46.0)
            grey[: BLOCK * 2] = img[void_top - 1:void_top] * 0.55 + 46 * 0.45
            img[void_top:] = grey * (0.55 + 0.45 * fade)
        # stray scan streaks in the void
        for _ in range(int(rng.integers(4, 9))):
            y = void_top + int(rng.integers(0, depth))
            x0 = int(rng.integers(0, w // 2))
            x1 = x0 + int(rng.integers(w // 8, w // 2))
            src_y = int(rng.integers(0, stop_y))
            img[y:y + 2, x0:x1] = clean[src_y:src_y + 2, x0:x1] * 0.6

    # 5. shifted slices and channel splits in the decoded part
    for _ in range(int(rng.integers(4, 8))):
        y = int(rng.integers(0, max(1, stop_y - 40)))
        band = int(rng.integers(3, 34))
        shift = int(rng.integers(18, 170)) * int(rng.choice([-1, 1]))
        img[y:y + band] = np.roll(img[y:y + band], shift, axis=1)
    for _ in range(int(rng.integers(2, 4))):
        y = int(rng.integers(0, max(1, stop_y - 60)))
        band = int(rng.integers(20, 70))
        img[y:y + band, :, 0] = np.roll(img[y:y + band, :, 0], 9, axis=1)
        img[y:y + band, :, 2] = np.roll(img[y:y + band, :, 2], -9, axis=1)

    # 6. sensor noise + scanlines
    img += rng.normal(0, 4.5, img.shape)
    img[1::2] *= 0.93

    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)), {
        "stop": round(stop_y / h, 4),
        "stopCol": round(stop_col / w, 4),
        "coarseEnd": round(coarse_bottom / h, 4),
    }


def font(size):
    for name in ("CascadiaMono.ttf", "consola.ttf"):
        path = os.path.join(os.environ.get("WINDIR", "C:/Windows"), "Fonts", name)
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def caption(img, cap, info):
    draw = ImageDraw.Draw(img)
    w, h = img.size
    small, big = font(22), font(30)
    pct = int(info["stop"] * 100 + info["stopCol"] * 100 * (1 / (h / BLOCK)))
    draw.text((40, 34), "NYCTOGRAPH // UNIT NX-2142 // BUFFER RECOVERY", font=small, fill=(125, 149, 171))
    draw.text((40, 66), cap["label"], font=big, fill=(238, 247, 251))
    stamp_w = draw.textlength(cap["stamp"], font=big)
    draw.text((w - 40 - stamp_w, 66), cap["stamp"], font=big, fill=(224, 180, 105))
    if cap.get("clean"):
        draw.text((40, h - 64), "RECEIVED 100%  //  NOMINAL", font=small, fill=(95, 212, 230))
    else:
        draw.text((40, h - 64), f"RECOVERED {pct}%  //  DATA ENDS", font=small, fill=(255, 122, 107))
    mark = "CELESTIAL"
    mark_w = draw.textlength(mark, font=small)
    draw.text((w - 40 - mark_w, h - 64), mark, font=small, fill=(125, 149, 171))
    return img


# Keep in sync with carrierMessage in core/content.js. Used by tools/carrier-video.py.
CARRIER_LINES = [
    "While I stand here, in the wake of time flowing away into the river of the abyss, the divine celestial, waiting.",
    "A path that follows, to see the now: an inverse point in space, converging into waves of time.",
    "So deep that only forward was possible, because back was too far.",
]


def wrap(draw, text, fnt, width):
    lines, line = [], ""
    for word in text.split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) > width and line:
            lines.append(line)
            line = word
        else:
            line = test
    return lines + [line]


def main():
    os.makedirs(os.path.join(ROOT, "media", "captures"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "Resources", "Marketing"), exist_ok=True)
    manifest = {}
    for cap in CAPTURES:
        web, info = corrupt(cap, (1600, 900))
        web.save(os.path.join(ROOT, "media", "captures", cap["id"] + ".jpg"), quality=82, optimize=True, progressive=True)
        big, big_info = corrupt(cap, (1920, 1080))
        caption(big, cap, big_info).save(os.path.join(ROOT, "Resources", "Marketing", cap["id"] + ".png"), optimize=True)
        manifest[cap["id"]] = info
        print(cap["id"], info)
    json.dump(manifest, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
