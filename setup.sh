#!/usr/bin/env bash
# Build a self-contained Windows (x64) copy of the study site that runs with a double-click.
#
#   bash setup.sh
#
# Produces build/pantomime-survey-windows.zip containing:
#   - the project with the *Windows* builds of all npm packages (Vite and Tailwind ship native binaries,
#     so a node_modules installed on Linux does not work on Windows)
#   - a portable Node.js for Windows in .node\ (checksum-verified), so nothing has to be installed
#   - start-windows.bat        runs the site; answers go to Firebase as test runs
#   - start-windows-local.bat  runs the site; answers stay in the browser only
#
# The Linux node_modules in this folder is not touched.
set -euo pipefail

NODE_LINE="${NODE_LINE:-latest-v22.x}"   # Node.js release line to bundle
ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
STAGE="$BUILD/windows/pantomime-survey"
ZIP="$BUILD/pantomime-survey-windows.zip"
CACHE="$BUILD/cache"

say() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- tools -------------------------------------------------------------------------------------------
if ! command -v npm >/dev/null 2>&1 && [ -s /opt/nvm/nvm.sh ]; then
  . /opt/nvm/nvm.sh >/dev/null   # on this instance node/npm come from nvm
fi
for tool in npm curl sha256sum rsync python3; do
  command -v "$tool" >/dev/null 2>&1 || die "'$tool' is required but not installed"
done

# --- 1. copy the project -----------------------------------------------------------------------------
say "Copying project to build/windows/"
rm -rf "$BUILD/windows" "$ZIP"
mkdir -p "$STAGE" "$CACHE"
rsync -a \
  --exclude node_modules --exclude dist --exclude build --exclude .git \
  --exclude setup.sh --exclude '*.log' \
  "$ROOT/" "$STAGE/"

# --- 2. npm packages, Windows builds -----------------------------------------------------------------
say "Installing npm packages for Windows x64"
# --os/--cpu make npm pick the win32-x64 native packages instead of the Linux ones.
# --ignore-scripts: install scripts would run here on Linux, not on the Windows target.
(cd "$STAGE" && npm ci --os=win32 --cpu=x64 --ignore-scripts --no-audit --no-fund --loglevel=error)

# node_modules/.bin holds Linux symlinks that break on Windows; the .bat files call Vite directly instead.
rm -rf "$STAGE/node_modules/.bin"
find "$STAGE/node_modules" -type l -delete

# Every native package must now be the Windows build.
for pkg in @rolldown/binding-win32-x64-msvc @tailwindcss/oxide-win32-x64-msvc lightningcss-win32-x64-msvc; do
  [ -n "$(find "$STAGE/node_modules" -path "*/$pkg/*.node" -print -quit)" ] || die "missing Windows binary: $pkg"
done
if find "$STAGE/node_modules" -maxdepth 3 -type d -name '*linux-x64*' | grep -q .; then
  die "Linux native packages were installed; this npm does not honour --os/--cpu"
fi

# --- 3. portable Node.js for Windows -----------------------------------------------------------------
say "Downloading portable Node.js for Windows ($NODE_LINE)"
BASE_URL="https://nodejs.org/dist/$NODE_LINE"
curl -fsSL "$BASE_URL/SHASUMS256.txt" -o "$CACHE/SHASUMS256.txt"
NODE_ZIP="$(awk '/win-x64\.zip$/ {print $2}' "$CACHE/SHASUMS256.txt")"
[ -n "$NODE_ZIP" ] || die "could not find a win-x64 zip in $BASE_URL/SHASUMS256.txt"
if [ ! -f "$CACHE/$NODE_ZIP" ]; then
  curl -fL --progress-bar "$BASE_URL/$NODE_ZIP" -o "$CACHE/$NODE_ZIP.part"
  mv "$CACHE/$NODE_ZIP.part" "$CACHE/$NODE_ZIP"
fi
(cd "$CACHE" && grep " $NODE_ZIP\$" SHASUMS256.txt | sha256sum -c --quiet -) || {
  rm -f "$CACHE/$NODE_ZIP"; die "checksum mismatch for $NODE_ZIP (deleted, re-run to download again)"
}
python3 - "$CACHE/$NODE_ZIP" "$STAGE/.node" <<'EOF'
import sys, zipfile, shutil, pathlib
src, dest = sys.argv[1], pathlib.Path(sys.argv[2])
with zipfile.ZipFile(src) as z:
    top = z.namelist()[0].split('/')[0]          # node-vXX-win-x64/
    z.extractall(dest.parent / '_node_tmp')
shutil.move(str(dest.parent / '_node_tmp' / top), str(dest))
shutil.rmtree(dest.parent / '_node_tmp')
EOF
echo "bundled ${NODE_ZIP%.zip}"

# --- 4. launchers (CRLF line endings for cmd.exe) ----------------------------------------------------
say "Writing Windows launchers"
write_bat() {  # write_bat <file> <description> <extra vite args>
  {
    echo '@echo off'
    echo 'cd /d "%~dp0"'
    echo 'set "PATH=%~dp0.node;%PATH%"'
    echo "echo $2"
    echo 'echo The site opens at http://localhost:5173  (results: http://localhost:5173/#/results)'
    echo 'echo Close this window to stop it.'
    echo 'echo.'
    echo "node node_modules\\vite\\bin\\vite.js --host 127.0.0.1 --port 5173 --open $3"
    echo 'pause'
  } | sed 's/$/\r/' > "$STAGE/$1"
}
write_bat start-windows.bat "PanToMime study: answers go to Firebase, tagged as test runs." ""
write_bat start-windows-local.bat "PanToMime study, LOCAL MODE: answers stay in this browser only." "--mode offline"

{
  echo 'Double-click start-windows.bat to run the study site. It opens http://localhost:5173 in your browser.'
  echo ''
  echo 'start-windows.bat        answers are saved to Firebase, tagged as test runs'
  echo '                         (the results page hides them unless you tick "Include test runs")'
  echo 'start-windows-local.bat  answers stay in your browser only; nothing reaches Firebase'
  echo ''
  echo 'Results / report page:   http://localhost:5173/#/results  (sign in with Google)'
  echo ''
  echo 'Node.js is bundled in the .node folder, so nothing needs to be installed.'
  echo 'Extract this zip to a short path such as C:\pantomime-survey (very long paths can break node_modules).'
  echo 'Editing the text or questions: see README.md. The site reloads by itself when you save a file.'
} | sed 's/$/\r/' > "$STAGE/HOW-TO-RUN.txt"

# --- 5. zip ------------------------------------------------------------------------------------------
say "Creating build/pantomime-survey-windows.zip"
python3 - "$BUILD/windows" "$ZIP" <<'EOF'
import os, sys, zipfile
root, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for d, dirs, files in os.walk(root):
        for f in files:
            p = os.path.join(d, f)
            if not os.path.islink(p):
                z.write(p, os.path.relpath(p, root))
EOF

say "Done"
echo "  $(du -h "$ZIP" | cut -f1)  $ZIP"
echo
echo "Next: download that zip to your Windows PC, extract it (e.g. to C:\\), and double-click"
echo "      pantomime-survey\\start-windows.bat"
