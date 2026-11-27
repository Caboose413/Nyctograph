"""Builds the SkyRings loop behind The Caretaker's archived message.

Takes 3.5 s from the middle of Resources/SkyRings.mp4, crops off the editor toolbar /
taskbar edges, and plays it forward then backward (a seamless ~7 s loop).

Outputs:
  media/carrier-loop.mp4 + media/carrier-loop-poster.jpg   site loop, 1280x720, silent, no text
  Resources/Marketing/carrier-message.mp4                   1920x1080, 7 s, message decoding on top
  Resources/Marketing/carrier-message.png                   its last frame (message complete)

Run from the Website folder:  python tools/carrier-video.py
Needs Pillow + numpy and Blender (BLENDER below) to read and encode video.
"""
import importlib.util
import os
import random
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BLENDER = r"E:\blender-5.3.0\blender.exe"
SOURCE = os.path.join(ROOT, "Resources", "SkyRings.mp4")
FIRST, LAST = 260, 364            # 3.5 s around the middle of the 623-frame source (30 fps)
CROP = (214, 181, 1707, 1021)     # inside the UE toolbar (top 25 px) and taskbar (bottom 48 px), ring high in frame

spec = importlib.util.spec_from_file_location("captures", os.path.join(ROOT, "tools", "corrupt-captures.py"))
captures = importlib.util.module_from_spec(spec)
spec.loader.exec_module(captures)
LINES = captures.CARRIER_LINES
font, wrap = captures.font, captures.wrap

HELPER = r'''
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
mode = argv[0]
sc = bpy.context.scene
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.sequence_editor_create()
ed = sc.sequence_editor
sc.render.resolution_percentage = 100
sc.render.fps = 30
if mode == "extract":
    src, out, first, last = argv[1], argv[2], int(argv[3]), int(argv[4])
    ed.strips.new_movie("m", src, 1, 1)
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    sc.render.image_settings.file_format = "PNG"
    for f in range(first, last + 1):
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out, "src_%05d.png" % f)
        bpy.ops.render.render(write_still=True)
else:
    folder, out, w, h = argv[1], argv[2], int(argv[3]), int(argv[4])
    files = sorted(f for f in os.listdir(folder) if f.endswith(".png"))
    strip = ed.strips.new_image("seq", os.path.join(folder, files[0]), 1, 1)
    for f in files[1:]:
        strip.elements.append(f)
    sc.frame_start, sc.frame_end = 1, len(files)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    ims = sc.render.image_settings
    try:
        ims.media_type = "VIDEO"
    except (AttributeError, TypeError):
        pass
    ims.file_format = "FFMPEG"
    sc.render.ffmpeg.format = "MPEG4"
    sc.render.ffmpeg.codec = "H264"
    sc.render.ffmpeg.constant_rate_factor = "HIGH"
    sc.render.ffmpeg.audio_codec = "NONE"
    sc.render.filepath = out
    sc.render.use_file_extension = False
    bpy.ops.render.render(animation=True)
'''


def blender(helper, *args):
    subprocess.run([BLENDER, "-b", "--factory-startup", "--python", helper, "--", *args],
                   check=True, stdout=subprocess.DEVNULL)


def pingpong(frames):
    return frames + frames[-2:0:-1]


def grade(img, w, h):
    """Darken the lower part so the message reads over the bright clouds."""
    arr = np.asarray(img, dtype=np.float32)
    y = np.linspace(0, 1, h)[:, None, None]
    shade = 0.92 - np.clip((y - 0.45) / 0.4, 0, 1) * 0.74
    shade = shade - np.clip((0.16 - y) / 0.16, 0, 1) * 0.5   # header band
    arr = arr * shade
    arr[1::2] *= 0.94
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


class ShadowDraw:
    """ImageDraw with a soft dark offset under every text call."""

    def __init__(self, img):
        self.draw = ImageDraw.Draw(img)

    def textlength(self, *args, **kwargs):
        return self.draw.textlength(*args, **kwargs)

    def text(self, xy, text, font=None, fill=None):
        x, y = xy
        for dx, dy in ((2, 2), (0, 2), (2, 0)):
            self.draw.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0))
        self.draw.text(xy, text, font=font, fill=fill)


def text_frame(img, t, total):
    """Message overlay for frame t: header, decoding lines, footer."""
    w, h = img.size
    draw = ShadowDraw(img)
    small, mid, body = font(22), font(30), font(31)
    draw.text((40, 34), "NYCTOGRAPH // UNIT NX-2142 // UNRESOLVED CARRIER", font=small, fill=(150, 170, 190))
    draw.text((40, 66), "INCOMING CARRIER", font=mid, fill=(238, 247, 251))
    age = "SENT \u2592\u2592\u2592\u2592\u2592\u2592\u2592 YEARS AGO"
    draw.text((w - 40 - draw.textlength(age, font=mid), 66), age, font=mid, fill=(224, 180, 105))

    # each line decodes in its own window, then everything holds to the end
    windows = [(6, 62), (70, 118), (126, 160)]
    rng = random.Random(t)
    noise = "\u2592\u2591\u2593ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    blocks = [wrap(draw, text, body, w * 0.8) for text in LINES]
    line_h, gap = 44, 22
    height = sum(len(b) for b in blocks) * line_h + gap * (len(blocks) - 1)
    y = h - 110 - height
    for i, (text, block) in enumerate(zip(LINES, blocks)):
        start, end = windows[i]
        if t < start:
            break
        shown = len(text) if t >= end else int(len(text) * (t - start) / (end - start))
        colour = (224, 180, 105) if i == len(LINES) - 1 else (239, 226, 200)
        pos = 0
        for line in block:
            out = ""
            for k, ch in enumerate(line):
                idx = pos + k
                if idx < shown or ch == " ":
                    out += ch
                elif idx < shown + 10:
                    out += rng.choice(noise)
            draw.text((w * 0.1, y), out, font=body, fill=colour)
            pos += len(line) + 1
            y += line_h
        y += gap
    foot = "TRANSLATION: ROUGH  //  SOURCE: UNRESOLVED" if t >= windows[-1][1] else "TRANSLATING ..."
    draw.text((40, h - 64), foot, font=small, fill=(224, 180, 105))
    draw.text((w - 40 - draw.textlength("CELESTIAL", font=small), h - 64), "CELESTIAL", font=small, fill=(150, 170, 190))
    return img


def main():
    work = tempfile.mkdtemp(prefix="carrier-")
    try:
        helper = os.path.join(work, "helper.py")
        with open(helper, "w", encoding="utf-8") as f:
            f.write(HELPER)
        src_dir, loop_dir, mkt_dir = (os.path.join(work, n) for n in ("src", "loop", "mkt"))
        for d in (src_dir, loop_dir, mkt_dir):
            os.makedirs(d)

        print("extracting frames", FIRST, "-", LAST)
        blender(helper, "extract", SOURCE, src_dir, str(FIRST), str(LAST))
        frames = pingpong(sorted(os.listdir(src_dir)))
        print(len(frames), "frames =", round(len(frames) / 30, 2), "s")

        for i, name in enumerate(frames):
            src = Image.open(os.path.join(src_dir, name)).convert("RGB").crop(CROP)
            src.resize((1280, 720), Image.LANCZOS).save(os.path.join(loop_dir, "%05d.png" % i))
            big = grade(src.resize((1920, 1080), Image.LANCZOS), 1920, 1080)
            text_frame(big, i, len(frames)).save(os.path.join(mkt_dir, "%05d.png" % i))
            if i == 0:
                src.resize((1280, 720), Image.LANCZOS).save(
                    os.path.join(ROOT, "media", "carrier-loop-poster.jpg"), quality=82, optimize=True)

        # marketing still: the last frame, message complete
        shutil.copyfile(os.path.join(mkt_dir, "%05d.png" % (len(frames) - 1)),
                        os.path.join(ROOT, "Resources", "Marketing", "carrier-message.png"))

        print("encoding")
        blender(helper, "encode", loop_dir, os.path.join(ROOT, "media", "carrier-loop.mp4"), "1280", "720")
        blender(helper, "encode", mkt_dir, os.path.join(ROOT, "Resources", "Marketing", "carrier-message.mp4"), "1920", "1080")
    finally:
        shutil.rmtree(work, ignore_errors=True)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
