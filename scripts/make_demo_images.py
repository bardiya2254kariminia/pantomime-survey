#!/usr/bin/env python3
"""Generate clearly-labelled PLACEHOLDER images so the site can be tried before real results exist.

Writes public/images/Questions/q1..q3 and OVERWRITES public/welcome/*. Replace both with your own images.
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SIZE = 384
METHODS = ["Method_A", "Method_B", "Method_C", "Method_D", "Method_E"]


def figure(color, azimuth, label, jitter=0.0, tint=None):
    """A toy 'subject': a body plus a nose that moves around as the camera orbits."""
    img = Image.new("RGB", (SIZE, SIZE), (241, 245, 249))
    d = ImageDraw.Draw(img)
    cx, cy = SIZE // 2, SIZE // 2 + 20
    body = tint or color
    d.ellipse([cx - 90, cy - 40, cx + 90, cy + 130], fill=body)            # body
    d.ellipse([cx - 60, cy - 150, cx + 60, cy - 30], fill=body)            # head
    a = math.radians(azimuth + jitter)
    nx = cx + int(55 * math.sin(a))
    d.ellipse([nx - 14, cy - 104, nx + 14, cy - 76], fill=(30, 41, 59))    # nose shows the view
    for side in (-1, 1):
        ex = cx + int(30 * math.sin(a + side * 0.6))
        d.ellipse([ex - 7, cy - 125, ex + 7, cy - 111], fill=(255, 255, 255))
    d.rectangle([0, SIZE - 36, SIZE, SIZE], fill=(226, 232, 240))
    d.text((10, SIZE - 28), f"PLACEHOLDER · {label}", fill=(71, 85, 105))
    return img


def main():
    subjects = [((99, 102, 241), (16, 185, 129)), ((244, 114, 182), (251, 191, 36)), ((56, 189, 248), (248, 113, 113))]
    moves = [40, -35, 60]
    for i, ((ca, cb), move) in enumerate(zip(subjects, moves), start=1):
        folder = ROOT / "public" / "images" / "Questions" / f"q{i}"
        folder.mkdir(parents=True, exist_ok=True)
        figure(ca, 0, "A").save(folder / "img_a.png")
        figure(ca, move, "A'").save(folder / "img_a_prime.png")
        figure(cb, 0, "B").save(folder / "img_b.png")
        # Fake outputs of varying quality: right move, partial move, no move, wrong direction, wrong colour.
        outputs = [(move, None), (move * 0.5, None), (0, None), (-move, None), (move, ca)]
        for method, (az, tint) in zip(METHODS, outputs):
            # Never print the method name on an output: it would un-blind participants.
            figure(cb, az, "output", tint=tint).save(folder / f"{method}.png")
        # A positive move here turns the view right; in meta.json a camera orbiting right is negative azimuth.
        meta = {"camera": {"azimuth": -move, "elevation": 0, "zoom": 1}}
        (folder / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    welcome = ROOT / "public" / "welcome"
    welcome.mkdir(parents=True, exist_ok=True)
    figure((99, 102, 241), 0, "A").save(welcome / "img_a.png")
    figure((99, 102, 241), 40, "A'").save(welcome / "img_a_prime.png")
    figure((16, 185, 129), 0, "B").save(welcome / "img_b.png")
    figure((16, 185, 129), 40, "B'").save(welcome / "img_b_prime.png")
    print("demo images written")


if __name__ == "__main__":
    main()
