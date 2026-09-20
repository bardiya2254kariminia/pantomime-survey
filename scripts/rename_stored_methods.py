#!/usr/bin/env python3
"""Rewrite responses that were stored with a blinded code into baseline names.

    python3 scripts/rename_stored_methods.py              # dry run, changes nothing
    python3 scripts/rename_stored_methods.py --apply      # write them back

Answers submitted before the rename hold "Method_F" where they now hold
"PanToMime". `fetch_responses.py` already resolves those on the way out, so the
exported JSON reads correctly either way -- this is for making the documents
themselves read correctly in the Firebase console.

Only `rankings[].rank<N>` and `rankings[].display_order` are touched, and only
values that appear in scripts/method_blinding.json. A document already holding
names is left exactly as it is, so running this twice is safe.

Firestore rules say `allow update: if false`. A service-account credential
bypasses the rules, which is why this needs the same key as fetch_responses.py
and why --apply is not the default.

Every document it is about to change is written to a backup file first, so a bad
run can be undone by hand from that file.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_responses import (  # noqa: E402  -- one implementation of each, shared
    COLLECTION, DATABASE, PROJECT, access_token, decode, fetch_documents,
    load_blinding, log, rank_keys,
)

ROOT = Path(__file__).resolve().parent.parent


def encode(value):
    """A plain Python value -> the Firestore REST typed value. Inverse of decode()."""
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, str):
        return {"stringValue": value}
    if isinstance(value, list):
        return {"arrayValue": {"values": [encode(v) for v in value]}}
    if isinstance(value, dict):
        return {"mapValue": {"fields": {k: encode(v) for k, v in value.items()}}}
    raise TypeError(f"cannot encode {type(value).__name__}: {value!r}")


def rename_rankings(rankings: list, names: dict) -> tuple[list, int]:
    """Return the rewritten rankings and how many values changed."""
    changed = 0
    out = []
    for r in rankings or []:
        new = dict(r)
        for k in rank_keys(r):
            if r[k] in names:
                new[k] = names[r[k]]
                changed += 1
        order = r.get("display_order")
        if isinstance(order, list) and any(m in names for m in order):
            new["display_order"] = [names.get(m, m) for m in order]
            changed += sum(1 for m in order if m in names)
        out.append(new)
    return out, changed


def patch_document(token: str, project: str, database: str, collection: str,
                   doc_id: str, rankings: list) -> None:
    import requests

    url = (f"https://firestore.googleapis.com/v1/projects/{project}"
           f"/databases/{urllib.parse.quote(database, safe='')}"
           f"/documents/{collection}/{doc_id}")
    # updateMask keeps this to the one field; every other field is left untouched,
    # including submitted_at, which a whole-document write would have to resend.
    r = requests.patch(
        url,
        headers={"Authorization": f"Bearer {token}"},
        params={"updateMask.fieldPaths": "rankings"},
        json={"fields": {"rankings": encode(rankings)}},
        timeout=60,
    )
    if not r.ok:
        raise SystemExit(f"[rename_stored_methods] ERROR: {doc_id}: {r.status_code} {r.text[:400]}")


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Rewrite blinded method codes in stored responses into baseline names.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--key", default="", metavar="FILE",
                   help="service-account JSON key (else GOOGLE_APPLICATION_CREDENTIALS, "
                        "else ./serviceAccountKey.json)")
    p.add_argument("--access-token", default="", metavar="TOKEN")
    p.add_argument("--apply", action="store_true", help="actually write (default: dry run)")
    p.add_argument("--backup", default="results/before_rename_<date>.json",
                   help="where the untouched originals are saved before writing")
    p.add_argument("--project", default=PROJECT)
    p.add_argument("--database", default=DATABASE)
    p.add_argument("--collection", default=COLLECTION)
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)

    key = args.key
    if not key and not args.access_token and (ROOT / "serviceAccountKey.json").is_file():
        key = str(ROOT / "serviceAccountKey.json")

    names = load_blinding()
    if not names:
        log("ERROR: scripts/method_blinding.json is missing; nothing to rename from")
        return 2

    token = access_token(key or None, args.access_token or None)
    log(f"reading {args.project}/{args.database}/{args.collection}")
    docs = fetch_documents(token, args.project, args.database, args.collection)

    pending = []
    for d in docs:
        rankings, changed = rename_rankings(d.get("rankings") or [], names)
        if changed:
            pending.append((d, rankings, changed))

    log(f"{len(docs)} document(s); {len(pending)} hold codes that need renaming")
    for d, _, changed in pending:
        log(f"  {d['_document_id']}  ({d.get('study_id', '?')})  {changed} value(s)")

    if not pending:
        log("nothing to do")
        return 0

    if not args.apply:
        d, rankings, _ = pending[0]
        log("dry run -- nothing written. First document would change like this:")
        log(f"  before: {json.dumps(d['rankings'][0], sort_keys=True)}")
        log(f"  after : {json.dumps(rankings[0], sort_keys=True)}")
        log("re-run with --apply to write it")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    backup = Path(args.backup.replace("<date>", stamp))
    if not backup.is_absolute():
        backup = ROOT / backup
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(json.dumps([d for d, _, _ in pending], indent=2, ensure_ascii=False) + "\n")
    log(f"originals saved to {backup}")

    for d, rankings, _ in pending:
        patch_document(token, args.project, args.database, args.collection,
                       d["_document_id"], rankings)
        log(f"  rewrote {d['_document_id']}")

    log(f"renamed {len(pending)} document(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
