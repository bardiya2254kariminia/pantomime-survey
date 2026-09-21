#!/usr/bin/env python3
"""Add what each question's camera dome needs to its folder in public/images/Questions/.

    q1/meta.json       gains "poses": where the cameras of A and B stand
    q1/dome/logo_a.png the subject of A, seen from the front, as a round badge
    q1/dome/logo_b.png the subject of B, likewise

The dome on each question shows the four cameras: A, A' = A + move, B and
B' = B + move (B' is drawn as a question mark, since B' is what participants
have to imagine). meta.json already holds the move; this adds the two starting
poses, read from scripts/question_sources.json, which build_questions_from_evals.py
writes. The logos come from each sample's canonical front view
(reference/input_base.png), because A and B themselves are often side views.

Logos live in a dome/ subfolder so build_samples.py, which treats every image in
the question folder itself as a method output, does not pick them up.

Run after build_questions_from_evals.py, then `npm run samples`.
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "public" / "images" / "Questions"
SOURCES = ROOT / "scripts" / "question_sources.json"
LOGO = 160
# Every front view has its subject centred, full length: this square keeps it and drops most background.
CROP = (0.14, 0.10, 0.86, 0.82)


def pose(camera: dict) -> dict:
    return {"azimuth": camera["az"], "elevation": camera["el"], "distance": camera["dist"]}


def logo(front: Path, out: Path):
    im = Image.open(front).convert("RGB")
    w, h = im.size
    im = im.crop((int(CROP[0] * w), int(CROP[1] * h), int(CROP[2] * w), int(CROP[3] * h)))
    im = im.resize((LOGO, LOGO), Image.LANCZOS)
    mask = Image.new("L", (LOGO, LOGO), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, LOGO - 1, LOGO - 1), fill=255)
    badge = Image.new("RGBA", (LOGO, LOGO))
    badge.paste(im, (0, 0), mask)
    out.parent.mkdir(exist_ok=True)
    badge.save(out)


def main():
    doc = json.loads(SOURCES.read_text())
    dataset = Path(doc["dataset_root"])
    for qid, q in doc["questions"].items():
        folder = QUESTIONS / qid
        meta_path = folder / "meta.json"
        meta = json.loads(meta_path.read_text())
        meta["poses"] = {"a": pose(q["A_camera"]), "b": pose(q["B_camera"])}
        meta_path.write_text(json.dumps(meta, indent=2) + "\n")
        for role in ("A", "B"):
            sample = dataset / Path(q[role]).parent
            logo(sample / "reference" / "input_base.png", folder / "dome" / f"logo_{role.lower()}.png")
        print(f"{qid}: A {meta['poses']['a']}  B {meta['poses']['b']}")


if __name__ == "__main__":
    main()
