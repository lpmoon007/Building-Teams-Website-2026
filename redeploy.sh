#!/usr/bin/env bash
#
# redeploy.sh — one-command manual deploy for buildingteams.com.
#
# Self-contained: it does NOT need to run from inside a checkout. It clones the
# latest main fresh, builds the clean-URL dist/ tree, publishes it into the
# public docroot, and pings IndexNow for the pages that changed.
#
# Install once on the server (independent of any checkout):
#   curl-free — just paste the heredoc your assistant provided into ~/redeploy.sh
# Then, any time you want to push the latest live:
#   bash ~/redeploy.sh
#
# Override the docroot if it is non-standard:
#   DOCROOT=/path/to/httpdocs bash ~/redeploy.sh
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/lpmoon007/building-teams-website-2026.git}"
BRANCH="${BRANCH:-main}"
DOCROOT="${DOCROOT:-$HOME/httpdocs}"
INDEXNOW_KEY="c35b47d14424e87c2e04a65ca746ff9f"
HOST="www.buildingteams.com"

# --- 1. Find a Node binary (non-interactive shells don't see nodenv shims) ---
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
elif ls -d "$HOME"/.nodenv/versions/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d "$HOME"/.nodenv/versions/*/bin/node | sort -V | tail -n1)"
elif ls -d /opt/plesk/node/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d /opt/plesk/node/*/bin/node | sort -V | tail -n1)"
elif ls -d "$HOME"/.nvm/versions/node/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node | sort -V | tail -n1)"
else
  echo "ERROR: no node binary found." >&2; exit 1
fi
echo "Using node: $NODE ($("$NODE" --version))"

# --- 2. Fresh checkout of the latest main into a temp dir ---
SRC="$(mktemp -d)"; BUILD="$(mktemp -d)"
trap 'rm -rf "$SRC" "$BUILD"' EXIT
echo "Cloning $BRANCH…"
GIT_TERMINAL_PROMPT=0 git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$SRC" >/dev/null 2>&1
( cd "$SRC" && echo "At commit: $(git log --oneline -1)" )

# --- 3. Build the clean-URL tree into staging (also copies .htaccess + assets) ---
( cd "$SRC" && OUT_DIR="$BUILD" "$NODE" build.js >/dev/null )
echo "Built $(find "$BUILD" -type f | wc -l) files."

# --- 4. Publish: mirror the build into the docroot.
#        -c so only content-changed files transfer; --delete removes stale files;
#        .well-known/ preserved so ACME / Let's Encrypt renewals keep working. ---
mkdir -p "$DOCROOT"
CHANGED="$(rsync -ac --delete --exclude '.well-known/' --out-format='%n' "$BUILD/" "$DOCROOT/")"
echo "Published to $DOCROOT"
echo "Changed files: $(printf '%s\n' "$CHANGED" | grep -c . || true)"

# --- 5. IndexNow: notify Bing/Yandex/Seznam of changed pages (best-effort) ---
URLS="$( { printf '%s\n' "$CHANGED" \
  | grep -E '(^|/)index\.html$' \
  | sed -E "s#(^|.*/)index\.html\$#\1#; s#^#https://${HOST}/#" \
  | sort -u; } || true )"
if [ -n "$URLS" ] && command -v curl >/dev/null 2>&1; then
  URLLIST="$(printf '%s\n' "$URLS" | sed 's/.*/"&"/' | paste -sd, -)"
  PAYLOAD="{\"host\":\"${HOST}\",\"key\":\"${INDEXNOW_KEY}\",\"keyLocation\":\"https://${HOST}/${INDEXNOW_KEY}.txt\",\"urlList\":[${URLLIST}]}"
  echo "IndexNow: notifying $(printf '%s\n' "$URLS" | wc -l) changed URL(s)…"
  curl -sS -m 20 -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$PAYLOAD" -o /dev/null -w "IndexNow HTTP %{http_code}\n" || echo "IndexNow ping failed (non-fatal)."
else
  echo "IndexNow: no changed HTML pages to submit."
fi

# --- 6. Sanity check the live homepage ---
if grep -q '>Resources</a>' "$DOCROOT/index.html" 2>/dev/null; then
  echo "✓ Deploy verified (homepage nav present)."
else
  echo "⚠ Homepage nav check did not match — inspect $DOCROOT/index.html"
fi
echo "DONE."
