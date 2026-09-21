#!/usr/bin/env python3
"""Turn a hand-picked list of eval pairs into the survey's question folders.

Reads the analogy index (`eval_pair_idx.json`), the PanToMime dataset and the
baseline outputs under /workspace/ablation_results, and writes one folder per
question into public/images/Questions/:

    q1/
      img_a.png  img_a_prime.png  img_b.png   <- from the dataset (A, A', B)
      Method_A.png ... Method_I.png           <- one per baseline, blinded
      meta.json                               <- camera delta + the edits

B' (the ground truth) is deliberately NOT copied: the survey asks participants
to imagine it, and showing it would give the answer away.

The questions are SELECTION, below -- chosen by hand from the pairs the authors
reviewed, then ordered so that no two neighbouring questions share a prompt.
Re-run this whenever that list changes, then `npm run samples`.

Conventions, all verified against the dataset (see datasets/README.md):

  azimuth    passes through unchanged. In both the dataset and src/lib/camera.js
             a negative azimuth means the camera orbits to the RIGHT.
  elevation  passes through unchanged; positive moves up.
  zoom       derived from the dataset's `distance` LABEL (1 = medium shot,
             3 = wide shot). Measured on controlled pairs -- same azimuth and
             elevation, distance 1 vs 3 -- the subject changes by about 2x, so
             1 -> 3 is 0.5x (zoom out) and 3 -> 1 is 2x (zoom in).

Azimuth deltas are wrapped into (-180, 180]: the index stores A' minus A
literally, so an orbit from +90 to -135 is recorded as -225 where the camera
actually travelled +135. Participants are shown the move that happened.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUESTIONS = ROOT / "public" / "images" / "Questions"

INDEX = Path("/workspace/Pantomime-baselines-ablation/ablation/eval_pair_idx.json")
ABLATION = Path("/workspace/ablation_results")

# Blinded code -> where that method's eval{i}.png lives, relative to ABLATION.
# The codes are what the browser sees and what Firestore stores. The real names
# are put back at READ time, from src/config/methods.json, so the report and the
# exports name baselines while the participant's page and its image URLs do not.
# PanToMime is read from the ablation arm the study settled on -- NOT from
# PanToMime/results/images, which only ever held a two-sample smoke test.
METHODS = {
    "Method_A": ("Edit-Transfer", "Edit-Transfer/results/images"),
    "Method_B": ("Flux2-Klein-9B", "Flux2-Klein-9B/results/images"),
    "Method_C": ("GPTImage-2.5-Sunburst", "GPTImage-2.5-Sunburst/results/images"),
    "Method_D": ("LoRWeB", "LoRWeB/results/images"),
    "Method_E": ("NanoBanana-2", "NanoBanana-2/results/images"),
    "Method_F": ("PanToMime", "PanToMime/arms_ckpt4500/full/results/images"),
    "Method_G": ("Qwen-Image-Edit-2511", "Qwen-Image-Edit-2511/results/images"),
    "Method_H": ("RelationAdapter", "RelationAdapter/results/images"),
    "Method_I": ("VisualCloze", "VisualCloze/results/images"),
}

# q1..q15, in the order participants see them: 11 pairs the authors kept from the
# first 20-question draft, plus 4 they picked for simple camera moves (eval425,
# eval443, eval432) or kept from that draft (eval86).
#
# Ordered easy -> hard so participants learn the task on single-parameter moves
# before meeting full orbits: one parameter changed (smallest turn first), then
# two, then azimuth + elevation + distance together. Within that, no two
# neighbours share a prompt.
SELECTION = [
    # one camera parameter
    "eval425",  # beach hat + sitting           el +30
    "eval174",  # barcelona jersey              az -45
    "eval443",  # orange hair + gold chain      az -90
    "eval497",  # ice shard between the hands   az -90
    "eval538",  # unfold wings + open mouth     az -90
    "eval403",  # jumping pose                  az -135
    "eval493",  # fireball between the hands    az -135
    # two
    "eval432",  # rugby armor + oil painting            el +30  dist +2
    "eval40",   # sad expression                az -90  el +30
    # all three
    "eval129",  # baseball cap + sitting        az +45  el -30  dist -2
    "eval169",  # cowboy hat + sitting          az +90  el +30  dist +2
    "eval131",  # baseball cap + sitting        az -90  el +30  dist +2
    "eval59",   # raise hands + b&w sketch      az -90  el +30  dist +2
    "eval70",   # car lights + oil painting     az +90  el +30  dist +2
    "eval86",   # unfold wings + open mouth     az +90  el +30  dist +2
]

# distance is a shot label, so the zoom factor comes from a table, not a ratio.
ZOOM_FOR_DELTA_DISTANCE = {0: 1, 2: 0.5, -2: 2}


def log(msg: str) -> None:
    print(f"[build_questions] {msg}", flush=True)


def wrap_azimuth(degrees: int) -> int:
    """Into (-180, 180]: the orbit the camera actually travelled."""
    wrapped = (degrees + 180) % 360 - 180
    return 180 if wrapped == -180 else wrapped


def meta_for(record: dict) -> dict:
    d = record["delta_camera"]
    if d["dist"] not in ZOOM_FOR_DELTA_DISTANCE:
        raise SystemExit(f"unexpected distance delta {d['dist']} -- the dataset only labels 1 and 3")
    meta = {
        "camera": {
            "azimuth": wrap_azimuth(d["az"]),
            "elevation": d["el"],
            "zoom": ZOOM_FOR_DELTA_DISTANCE[d["dist"]],
        }
    }
    for i, prompt in enumerate(record["prompts"], start=1):
        meta[f"edit{i}"] = prompt
    return meta


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    dry_run = "--dry-run" in argv

    if not INDEX.is_file():
        log(f"ERROR: index not found: {INDEX}")
        return 2
    doc = json.loads(INDEX.read_text())
    samples = doc["samples"]
    dataset_root = Path(doc["meta"]["dataset_root"])

    missing = [k for k in SELECTION if k not in samples]
    if missing:
        log(f"ERROR: not in the index: {', '.join(missing)}")
        return 2
    if len(set(SELECTION)) != len(SELECTION):
        log("ERROR: SELECTION lists the same pair twice")
        return 2

    # Every selected pair must have every method, or the question is unrankable.
    gaps = []
    for key in SELECTION:
        for code, (name, rel) in METHODS.items():
            if not (ABLATION / rel / f"{key}.png").is_file():
                gaps.append(f"{key}: {name}")
    if gaps:
        log(f"ERROR: missing generations -- {'; '.join(gaps)}")
        return 2

    if dry_run:
        log("dry run: nothing written")
    else:
        # Rewrite q1..qN from scratch so a shortened SELECTION cannot leave a
        # stale question behind for build_samples.py to pick up.
        for old in QUESTIONS.glob("q*"):
            if old.is_dir():
                shutil.rmtree(old)
        QUESTIONS.mkdir(parents=True, exist_ok=True)

    for i, key in enumerate(SELECTION, start=1):
        record = samples[key]
        folder = QUESTIONS / f"q{i}"
        meta = meta_for(record)
        cam = meta["camera"]
        edits = ", ".join(record["prompts"])
        log(f"q{i:<3} {key:<8} az {cam['azimuth']:>+5}  el {cam['elevation']:>+4}  "
            f"zoom {cam['zoom']:<4} | {edits}")
        if dry_run:
            continue

        folder.mkdir(parents=True, exist_ok=True)
        for name, path_key in (("img_a", "A_path"), ("img_a_prime", "A_prime_path"), ("img_b", "B_path")):
            shutil.copyfile(dataset_root / record[path_key], folder / f"{name}.png")
        for code, (_, rel) in METHODS.items():
            shutil.copyfile(ABLATION / rel / f"{key}.png", folder / f"{code}.png")
        (folder / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")

    if dry_run:
        return 0

    # The blinding key, in two places because they have different audiences:
    # scripts/ is the researcher's copy and never ships, while src/config/ is
    # read by the results page (a lazy chunk participants never download) so the
    # report can name baselines instead of codes.
    key = {code: name for code, (name, _) in METHODS.items()}
    (ROOT / "scripts" / "method_blinding.json").write_text(json.dumps(key, indent=2) + "\n")
    (ROOT / "src" / "config" / "methods.json").write_text(json.dumps(key, indent=2) + "\n")
    (ROOT / "scripts" / "question_sources.json").write_text(
        json.dumps({
            "index": str(INDEX),
            "dataset_root": str(dataset_root),
            "baselines_root": str(ABLATION),
            "questions": {
                f"q{i}": {
                    "eval_key": key,
                    "prompt_group": samples[key]["prompt_group"],
                    "prompts": samples[key]["prompts"],
                    "A": samples[key]["A_path"],
                    "A_prime": samples[key]["A_prime_path"],
                    "B": samples[key]["B_path"],
                    "B_prime_ground_truth": samples[key]["B_prime_path"],
                    "A_camera": samples[key]["A_camera"],
                    "B_camera": samples[key]["B_camera"],
                    "delta_camera_raw": samples[key]["delta_camera"],
                    "meta": meta_for(samples[key]),
                }
                for i, key in enumerate(SELECTION, start=1)
            },
        }, indent=2) + "\n")

    log(f"wrote {len(SELECTION)} question folder(s) to {QUESTIONS.relative_to(ROOT)}")
    log("next: npm run samples")
    return 0


if __name__ == "__main__":
    sys.exit(main())
