#!/usr/bin/env bash
set -euo pipefail

PLAYWRIGHT_BIN="$(npm exec --yes --package=@playwright/test@1.55.0 -- sh -c 'command -v playwright')"
PLAYWRIGHT_NODE_MODULES="$(dirname "$(dirname "$PLAYWRIGHT_BIN")")"

NODE_PATH="$PLAYWRIGHT_NODE_MODULES${NODE_PATH:+:$NODE_PATH}" "$PLAYWRIGHT_BIN" test "$@"
