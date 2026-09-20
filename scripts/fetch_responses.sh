#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Download every study response from Firestore into one JSON file.
#
#   bash scripts/fetch_responses.sh
#
# Credentials. Firestore rules let only admins read the answers, so this needs a
# Google credential. Get one once:
#
#   Firebase console -> Project settings -> Service accounts
#     -> Generate new private key        (downloads a .json)
#
# Put that file somewhere outside the repo and point KEY at it, or drop it in as
# serviceAccountKey.json (already git-ignored) and this script finds it:
#
#   KEY=~/keys/pantomime-admin.json bash scripts/fetch_responses.sh
#
# It is a password to the whole Firebase project -- do not commit it or share it.
#
# Other options:
#   OUT=my.json                bash scripts/fetch_responses.sh   # where to write
#   INCLUDE_TESTS=1            bash scripts/fetch_responses.sh   # keep `npm run dev` runs
#   STUDY_ID=pantomime-v1      bash scripts/fetch_responses.sh   # one study version only
#   ACCESS_TOKEN=ya29....      bash scripts/fetch_responses.sh   # skip the key file
# ---------------------------------------------------------------------------
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"

KEY="${KEY:-${GOOGLE_APPLICATION_CREDENTIALS:-}}"
OUT="${OUT:-${ROOT}/results/responses_<date>.json}"
INCLUDE_TESTS="${INCLUDE_TESTS:-0}"
STUDY_ID="${STUDY_ID:-}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"
PROJECT="${PROJECT:-pantomime-baseline}"
DATABASE="${DATABASE:-(default)}"
COLLECTION="${COLLECTION:-responses}"

# The usual place to leave the key, and the name .gitignore already covers.
if [ -z "$KEY" ] && [ -z "$ACCESS_TOKEN" ] && [ -f "${ROOT}/serviceAccountKey.json" ]; then
  KEY="${ROOT}/serviceAccountKey.json"
fi

if [ -z "$KEY" ] && [ -z "$ACCESS_TOKEN" ]; then
  cat >&2 <<'MSG'
No credential found.

  1. Firebase console -> Project settings -> Service accounts -> Generate new private key
  2. Save the downloaded .json as serviceAccountKey.json next to package.json
     (or run this with KEY=/path/to/that/file)

That file is a password to the Firebase project: keep it out of git and off chat.
MSG
  exit 2
fi

# This instance's Python lives in a venv; fall back to whatever python3 is on PATH.
PY="python3"
if [ -x /venv/main/bin/python3 ]; then
  PY=/venv/main/bin/python3
fi

# google-auth signs the service-account JWT; requests does the HTTP. Installed on
# demand so a fresh clone needs no setup step of its own.
if [ -z "$ACCESS_TOKEN" ] && ! "$PY" -c 'import google.oauth2, requests' >/dev/null 2>&1; then
  echo "==> installing google-auth and requests" >&2
  if command -v uv >/dev/null 2>&1; then
    uv pip install --python "$PY" google-auth requests >&2
  else
    "$PY" -m pip install --quiet google-auth requests >&2
  fi
fi

ARGS=(--out "$OUT" --project "$PROJECT" --database "$DATABASE" --collection "$COLLECTION")
[ -n "$KEY" ] && ARGS+=(--key "$KEY")
[ -n "$ACCESS_TOKEN" ] && ARGS+=(--access-token "$ACCESS_TOKEN")
[ -n "$STUDY_ID" ] && ARGS+=(--study-id "$STUDY_ID")
[ "$INCLUDE_TESTS" = "1" ] && ARGS+=(--include-tests)

echo "========================================="
echo " PanToMime study: collect responses"
echo "-----------------------------------------"
echo " Project:        $PROJECT"
echo " Database:       $DATABASE"
echo " Collection:     $COLLECTION"
echo " Credential:     ${KEY:-<access token>}"
echo " Output:         $OUT"
echo " Include tests:  $INCLUDE_TESTS"
echo " Study id:       ${STUDY_ID:-<all>}"
echo "========================================="

WRITTEN="$("$PY" -u "${SCRIPT_DIR}/fetch_responses.py" "${ARGS[@]}")"
echo ">>> Wrote: $WRITTEN"
