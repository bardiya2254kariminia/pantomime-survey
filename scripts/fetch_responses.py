#!/usr/bin/env python3
"""Download every study response from Firestore into one JSON file.

    python3 scripts/fetch_responses.py --key serviceAccountKey.json

The results page can already export the same answers from the browser. This is
the headless version: it runs on a server, needs nobody signed in, and is the
thing to point a cron job or an analysis notebook at.

Auth. Firestore rules let only admins read `responses`, so this needs a Google
credential. Easiest is a service-account key, which bypasses the rules:

    Firebase console -> Project settings -> Service accounts
      -> Generate new private key   (downloads a .json)

Pass it with --key, or set GOOGLE_APPLICATION_CREDENTIALS. Keep the file out of
git: it is a password to the whole project. If you already have a token from
somewhere else (`gcloud auth print-access-token`), --access-token takes it and
no key is needed.

Output. One JSON document: what was fetched, the per-method table, and every
response. Answers now record the baseline name itself ("PanToMime"), but early
ones recorded a blinded code ("Method_F"); scripts/method_blinding.json maps the
old codes onto the same baseline so both count as one method. The raw stored
value is always kept next to the resolved one, so nothing is lost.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLINDING = ROOT / "scripts" / "method_blinding.json"

PROJECT = "pantomime-baseline"
DATABASE = "(default)"
COLLECTION = "responses"
SCOPE = "https://www.googleapis.com/auth/datastore"


def log(msg: str) -> None:
    print(f"[fetch_responses] {msg}", file=sys.stderr, flush=True)


def die(msg: str, hint: str = "") -> None:
    log(f"ERROR: {msg}")
    if hint:
        log(hint)
    raise SystemExit(2)


# --------------------------------------------------------------------------- #
# Firestore REST
# --------------------------------------------------------------------------- #

def access_token(key_path: str | None, given: str | None) -> str:
    if given:
        return given

    key_path = key_path or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not key_path:
        die("no credential",
            "pass --key <serviceAccountKey.json>, set GOOGLE_APPLICATION_CREDENTIALS, "
            "or pass --access-token. See this file's docstring for where to get a key.")
    if not Path(key_path).is_file():
        die(f"key file not found: {key_path}")

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        die("the google-auth package is missing",
            "install it with:  uv pip install google-auth requests   "
            "(fetch_responses.sh does this for you)")

    creds = service_account.Credentials.from_service_account_file(key_path, scopes=[SCOPE])
    creds.refresh(Request())
    return creds.token


def decode(value: dict):
    """One Firestore REST typed value -> a plain Python value."""
    if "nullValue" in value:
        return None
    for key in ("stringValue", "booleanValue", "timestampValue", "bytesValue", "referenceValue"):
        if key in value:
            return value[key]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return float(value["doubleValue"])
    if "arrayValue" in value:
        return [decode(v) for v in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        return {k: decode(v) for k, v in value["mapValue"].get("fields", {}).items()}
    if "geoPointValue" in value:
        return value["geoPointValue"]
    # A type this script has not met yet is handed over untouched rather than dropped.
    return value


def fetch_documents(token: str, project: str, database: str, collection: str) -> list[dict]:
    import requests

    base = (f"https://firestore.googleapis.com/v1/projects/{project}"
            f"/databases/{urllib.parse.quote(database, safe='')}/documents/{collection}")
    headers = {"Authorization": f"Bearer {token}"}
    docs, page, page_token = [], 0, None

    while True:
        params = {"pageSize": 300}
        if page_token:
            params["pageToken"] = page_token
        r = requests.get(base, headers=headers, params=params, timeout=60)
        if r.status_code == 403:
            die("Firestore refused the read (403)",
                "the service account needs read access to this project, or the token has expired")
        if r.status_code == 404:
            die(f"no such collection or database: {collection} in {project}/{database}")
        r.raise_for_status()

        body = r.json()
        for d in body.get("documents", []):
            fields = {k: decode(v) for k, v in d.get("fields", {}).items()}
            fields["_document_id"] = d["name"].rsplit("/", 1)[-1]
            fields["_update_time"] = d.get("updateTime")
            docs.append(fields)
        page += 1
        page_token = body.get("nextPageToken")
        log(f"  page {page}: {len(docs)} document(s) so far")
        if not page_token:
            return docs


# --------------------------------------------------------------------------- #
# naming and statistics
# --------------------------------------------------------------------------- #

def load_blinding() -> dict:
    if not BLINDING.is_file():
        return {}
    return json.loads(BLINDING.read_text())


def rank_keys(ranking: dict) -> list[str]:
    return sorted((k for k in ranking if k.startswith("rank") and k[4:].isdigit()),
                  key=lambda k: int(k[4:]))


def resolve(responses: list[dict], names: dict) -> list[dict]:
    """Add the resolved baseline name beside every stored code, in place of nothing."""
    out = []
    for resp in responses:
        rankings = []
        for r in resp.get("rankings") or []:
            named = dict(r)
            for k in rank_keys(r):
                if r[k]:
                    named[f"{k}_method"] = names.get(r[k], r[k])
            if r.get("display_order"):
                named["display_order_methods"] = [names.get(m, m) for m in r["display_order"]]
            rankings.append(named)
        out.append({**resp, "rankings": rankings})
    return out


def method_table(responses: list[dict], names: dict) -> list[dict]:
    """Borda count, the same arithmetic the results page shows: 1st = N points."""
    n_ranks = max((len(rank_keys(r)) for resp in responses for r in resp.get("rankings") or []),
                  default=0)
    stats: dict[str, dict] = {}

    def bucket(raw):
        m = names.get(raw, raw)
        return stats.setdefault(m, {"method": m, "counts": [0] * n_ranks, "points": 0, "shown": 0})

    for resp in responses:
        for r in resp.get("rankings") or []:
            for raw in r.get("display_order") or []:
                bucket(raw)["shown"] += 1
            for i, k in enumerate(rank_keys(r)):
                if r[k]:
                    s = bucket(r[k])
                    s["counts"][i] += 1
                    s["points"] += n_ranks - i

    table = []
    for s in stats.values():
        shown = s["shown"]
        table.append({
            **s,
            "first_place_rate": round(s["counts"][0] / shown, 4) if shown else None,
            "top_k_rate": round(sum(s["counts"]) / shown, 4) if shown else None,
            "avg_points_per_showing": round(s["points"] / shown, 4) if shown else None,
        })
    return sorted(table, key=lambda s: s["points"], reverse=True)


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #

def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Download the study responses from Firestore into one JSON file.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--key", default="", metavar="FILE",
                   help="service-account JSON key (else GOOGLE_APPLICATION_CREDENTIALS)")
    p.add_argument("--access-token", default="", metavar="TOKEN",
                   help="use this OAuth token instead of a key file")
    p.add_argument("--out", default="results/responses_<date>.json",
                   help="output file; <date> becomes today's date")
    p.add_argument("--project", default=PROJECT)
    p.add_argument("--database", default=DATABASE, help="Firestore database id")
    p.add_argument("--collection", default=COLLECTION)
    p.add_argument("--include-tests", action="store_true",
                   help="also keep runs from `npm run dev` (study_id ending in -dev)")
    p.add_argument("--study-id", default="", help="keep only this exact study_id")
    return p.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    out_path = Path(args.out.replace("<date>", stamp)).expanduser()
    if not out_path.is_absolute():
        out_path = ROOT / out_path

    token = access_token(args.key or None, args.access_token or None)
    log(f"reading {args.project}/{args.database}/{args.collection}")
    docs = fetch_documents(token, args.project, args.database, args.collection)

    total = len(docs)
    tests = [d for d in docs if str(d.get("study_id", "")).endswith("-dev")]
    if not args.include_tests:
        docs = [d for d in docs if d not in tests]
    if args.study_id:
        docs = [d for d in docs if d.get("study_id") == args.study_id]

    # Newest first, matching how the results page lists submissions.
    docs.sort(key=lambda d: str(d.get("submitted_at") or ""), reverse=True)

    names = load_blinding()
    responses = resolve(docs, names)
    table = method_table(docs, names)

    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": {"project": args.project, "database": args.database, "collection": args.collection},
        "filters": {"include_tests": args.include_tests, "study_id": args.study_id or None},
        "counts": {
            "documents_in_collection": total,
            "test_runs": len(tests),
            "responses_kept": len(responses),
            "answers_kept": sum(len(r.get("rankings") or []) for r in responses),
        },
        "method_names": names,
        "method_summary": table,
        "responses": responses,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    log(f"{total} document(s), {len(tests)} test run(s), {len(responses)} kept")
    if table:
        log("methods by points:")
        for s in table:
            log(f"  {s['method']:<24} {s['points']:>5} pts   1st {s['counts'][0]:>3}   shown {s['shown']:>4}")
    print(out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
