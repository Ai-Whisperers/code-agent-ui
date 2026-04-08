#!/usr/bin/env bash
# Thin wrapper that calls the backend repo's secret-fetch script in --frontend mode.
# Assumes the backend repo is checked out as a sibling directory.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BE_SCRIPT="$SCRIPT_DIR/../../code-agent/scripts/aiw-fetch-secrets.sh"
if [[ ! -x "$BE_SCRIPT" ]]; then
  echo "ERROR: backend secret-fetch script not found at $BE_SCRIPT" >&2
  echo "Clone Ai-Whisperers/code-agent as a sibling directory first." >&2
  exit 1
fi
exec "$BE_SCRIPT" --frontend "$@"
