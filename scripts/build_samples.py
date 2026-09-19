#!/usr/bin/env python3
"""Build src/data/samples.json from the question folders in public/images/.

Each question is one folder:

    public/images/<sample_id>/
        img_a.png         exemplar A
        img_a_prime.png   exemplar A'  (A after the change)
        img_b.png         query B      (the new subject)
        <Method>.png      one output per method; the file name (without extension) is the method name
        meta.json         optional: {"change": "camera orbits 30° left",
                                     "applied_edits": ["jumping pose"], "skipped_edits": []}

Questions appear in folder-name order unless public/images/order.txt lists sample ids
(one per line); folders missing from order.txt are then left out of the study.
Any of .png / .jpg / .jpeg / .webp works.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"
OUT = ROOT / "src" / "data" / "samples.json"
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
REFERENCE = {"img_a": "a", "img_a_prime": "a_prime", "img_b": "b"}


def build_sample(folder: Path):
    files = {p.stem: p for p in sorted(folder.iterdir()) if p.suffix.lower() in EXTS}
    missing = [name for name in REFERENCE if name not in files]
    if missing:
        raise SystemExit(f"{folder.name}: missing {', '.join(missing)}")

    rel = lambda p: p.relative_to(ROOT / "public").as_posix()
    sample = {"id": folder.name}
    sample.update({key: rel(files[stem]) for stem, key in REFERENCE.items()})

    meta_path = folder / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    for key in ("change", "applied_edits", "skipped_edits"):
        if meta.get(key):
            sample[key] = meta[key]

    sample["outputs"] = {stem: rel(p) for stem, p in files.items() if stem not in REFERENCE}
    if len(sample["outputs"]) < 2:
        raise SystemExit(f"{folder.name}: needs at least 2 method outputs, found {len(sample['outputs'])}")
    return sample


def main():
    folders = {p.name: p for p in sorted(IMAGES.iterdir()) if p.is_dir()} if IMAGES.exists() else {}
    if not folders:
        raise SystemExit(f"no question folders in {IMAGES}")

    order_file = IMAGES / "order.txt"
    if order_file.exists():
        order = [line.strip() for line in order_file.read_text().splitlines() if line.strip()]
        unknown = [s for s in order if s not in folders]
        if unknown:
            raise SystemExit(f"order.txt lists unknown folders: {', '.join(unknown)}")
    else:
        order = list(folders)

    samples = [build_sample(folders[s]) for s in order]

    methods = [set(s["outputs"]) for s in samples]
    if any(m != methods[0] for m in methods):
        print("WARNING: questions do not all have the same set of methods", file=sys.stderr)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(samples, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(samples)} questions, methods: {', '.join(sorted(methods[0]))}")


if __name__ == "__main__":
    main()
