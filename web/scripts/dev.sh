#!/usr/bin/env bash
# Usage:
#   ./dev.sh          — start the dev server + open the build page in a browser
#   ./dev.sh regen    — regenerate split.html and raw.html then exit
#   ./dev.sh <other>  — forwarded to dev.mjs as a subcommand
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -eq 0 ]; then
  open "http://localhost:5173/build.html?split=1"
  node "$DIR/dev.mjs"
else
  node "$DIR/dev.mjs" "$@"
fi
