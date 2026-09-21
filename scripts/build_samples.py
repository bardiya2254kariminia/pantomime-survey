#!/usr/bin/env python3
"""Build src/data/samples.json from the question folders in public/images/Questions/.

Each question is one folder (q1, q2, q3, ...):

    public/images/Questions/q1/
        img_a.png         exemplar A
        img_a_prime.png   exemplar A'  (A after the change)
        img_b.png         query B      (the new subject)
        <Method>.png      one output per method; the file name (without extension) is the method name,
                          unless scripts/method_blinding.json renames it (see below)
        meta.json         optional, e.g.
                          {
                            "camera": {"azimuth": -40, "elevation": 10, "zoom": 1.2},
                            "edit1": "jumping",
                            "edit2": "sunglasses"
                          }

Camera (all optional):
    azimuth    degrees; negative = camera orbits right, positive = left
    elevation  degrees; positive = camera moves up, negative = down
    zoom       factor; 1 = unchanged, above 1 = zoom in, below 1 = zoom out
The camera values may also be written at the top level instead of inside "camera".

Camera dome (optional, written by scripts/build_dome_assets.py):
    "poses": {"a": {"azimuth": 0, "elevation": 0, "distance": 1}, "b": {...}}
                          where the cameras of A and B stand; A' and B' are these plus "camera"
    dome/logo_a.png, dome/logo_b.png
                          round front-view badges of the two subjects, shown in the dome's centre

Questions appear in natural order (q2 before q10) unless public/images/Questions/order.txt
lists folder names (one per line); folders missing from order.txt are then left out.
Any of .png / .jpg / .jpeg / .webp works.

scripts/method_blinding.json, when present, maps a file stem to the method name to use:

    {"Method_A": "Edit-Transfer", "Method_F": "PanToMime", ...}

The images keep their neutral file names, so nothing in a participant's image URLs
names a baseline, while the answers the study records -- display_order, rank1, rank2,
rank3 -- carry the real baseline name instead of a code that needs a key to read.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images" / "Questions"
OUT = ROOT / "src" / "data" / "samples.json"
BLINDING = ROOT / "scripts" / "method_blinding.json"
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
REFERENCE = {"img_a": "a", "img_a_prime": "a_prime", "img_b": "b"}
CAMERA_DEFAULTS = {"azimuth": 0, "elevation": 0, "zoom": 1}
EDIT_KEY = re.compile(r"^edit(\d+)$")


def natural_key(name: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", name)]


def read_meta(folder: Path):
    meta_path = folder / "meta.json"
    if not meta_path.exists():
        return {}
    try:
        meta = json.loads(meta_path.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{folder.name}/meta.json is not valid JSON: {e}")

    out = {}
    unknown = []

    camera_src = dict(meta.get("camera") or {})
    for key in CAMERA_DEFAULTS:
        if key in meta:
            camera_src[key] = meta[key]
    if camera_src:
        camera = {}
        for key, default in CAMERA_DEFAULTS.items():
            value = camera_src.pop(key, default)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise SystemExit(f"{folder.name}/meta.json: camera {key} must be a number, got {value!r}")
            camera[key] = value
        if camera["zoom"] <= 0:
            raise SystemExit(f"{folder.name}/meta.json: zoom is a factor (1 = unchanged), got {camera['zoom']}")
        unknown += [f"camera.{k}" for k in camera_src]
        out["camera"] = camera

    edits = []
    for key, value in meta.items():
        m = EDIT_KEY.match(key)
        if m:
            if not isinstance(value, str) or not value.strip():
                raise SystemExit(f"{folder.name}/meta.json: {key} must be a non-empty string")
            edits.append((int(m.group(1)), value.strip()))
        elif key not in ("camera", "poses") and key not in CAMERA_DEFAULTS:
            unknown.append(key)
    if edits:
        out["edits"] = [value for _, value in sorted(edits)]

    if "poses" in meta:
        poses = meta["poses"]
        for role in ("a", "b"):
            p = poses.get(role) if isinstance(poses, dict) else None
            if not isinstance(p, dict) or not all(
                isinstance(p.get(k), (int, float)) and not isinstance(p.get(k), bool)
                for k in ("azimuth", "elevation", "distance")
            ):
                raise SystemExit(f"{folder.name}/meta.json: poses.{role} needs numeric azimuth, elevation and distance")
        out["poses"] = {role: {k: poses[role][k] for k in ("azimuth", "elevation", "distance")} for role in ("a", "b")}

    if unknown:
        print(f"WARNING: {folder.name}/meta.json: ignoring unknown keys {', '.join(unknown)}", file=sys.stderr)
    return out


def method_names():
    """File stem -> the name to record for it. Empty when nothing is being renamed."""
    if not BLINDING.exists():
        return {}
    try:
        names = json.loads(BLINDING.read_text())
    except json.JSONDecodeError as e:
        raise SystemExit(f"{BLINDING.name} is not valid JSON: {e}")
    if not all(isinstance(v, str) and v.strip() for v in names.values()):
        raise SystemExit(f"{BLINDING.name}: every value must be a non-empty method name")
    duplicates = {n for n in names.values() if list(names.values()).count(n) > 1}
    if duplicates:
        raise SystemExit(f"{BLINDING.name}: two codes map to the same name: {', '.join(sorted(duplicates))}")
    return names


def build_sample(folder: Path, names: dict):
    files = {p.stem: p for p in sorted(folder.iterdir()) if p.suffix.lower() in EXTS}
    missing = [name for name in REFERENCE if name not in files]
    if missing:
        raise SystemExit(f"{folder.name}: missing {', '.join(missing)}")

    rel = lambda p: p.relative_to(ROOT / "public").as_posix()
    sample = {"id": folder.name}
    sample.update({key: rel(files[stem]) for stem, key in REFERENCE.items()})
    sample.update(read_meta(folder))
    logos = {role: folder / "dome" / f"logo_{role}.png" for role in ("a", "b")}
    if all(p.exists() for p in logos.values()):
        sample["logos"] = {role: rel(p) for role, p in logos.items()}

    sample["outputs"] = {names.get(stem, stem): rel(p) for stem, p in files.items() if stem not in REFERENCE}
    if len(sample["outputs"]) < 2:
        raise SystemExit(f"{folder.name}: needs at least 2 method outputs, found {len(sample['outputs'])}")
    return sample


def main():
    folders = {p.name: p for p in IMAGES.iterdir() if p.is_dir()} if IMAGES.exists() else {}
    if not folders:
        raise SystemExit(f"no question folders in {IMAGES}")

    order_file = IMAGES / "order.txt"
    if order_file.exists():
        order = [line.strip() for line in order_file.read_text().splitlines() if line.strip()]
        unknown = [s for s in order if s not in folders]
        if unknown:
            raise SystemExit(f"order.txt lists unknown folders: {', '.join(unknown)}")
    else:
        order = sorted(folders, key=natural_key)

    names = method_names()
    samples = [build_sample(folders[s], names) for s in order]

    methods = [set(s["outputs"]) for s in samples]
    if any(m != methods[0] for m in methods):
        print("WARNING: questions do not all have the same set of methods", file=sys.stderr)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(samples, indent=2, ensure_ascii=False) + "\n")
    if names:
        print(f"method names from {BLINDING.relative_to(ROOT)} (images keep their blinded file names)")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(samples)} questions ({', '.join(order)}), methods: {', '.join(sorted(methods[0]))}")


if __name__ == "__main__":
    main()
