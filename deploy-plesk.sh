#!/usr/bin/env bash
#
# deploy-plesk.sh — entry point for Plesk Git "Additional deployment actions".
#
# Plesk pulls this repo (source only; dist/ is gitignored), then runs this
# script. It builds the clean-URL dist/ tree and publishes it into the public
# docroot so the SOURCE files never serve — only the built output does.
#
# In Plesk → Domains → buildingteams.com → Git → "Additional deployment
# actions", paste exactly:
#
#     bash deploy-plesk.sh
#
# Override the target docroot with the DOCROOT env var if it differs from the
# Plesk default below.
#
set -euo pipefail

# Run from the repo (where this script lives), wherever Plesk checked it out.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Public docroot to publish into. Defaults to the httpdocs sibling of the repo
# checkout (works whether Plesk deploys to a private dir or to httpdocs itself).
# Override with the DOCROOT env var in Plesk if your docroot is non-standard.
DOCROOT="${DOCROOT:-$(dirname "$REPO_DIR")/httpdocs}"

# Find a Node binary. Plesk's deploy shell is non-interactive, so it does NOT
# source ~/.bashrc — meaning PATH-based tools like nodenv shims are invisible
# here even when `node` works in an SSH session. So we probe, in order:
#   1. node already on PATH
#   2. Plesk-bundled Node (/opt/plesk/node/*)
#   3. nodenv-installed Node (~/.nodenv/versions/*) — newest version wins
#   4. common nvm / system locations
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
elif ls -d /opt/plesk/node/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d /opt/plesk/node/*/bin/node | sort -V | tail -n1)"
elif ls -d "$HOME"/.nodenv/versions/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d "$HOME"/.nodenv/versions/*/bin/node | sort -V | tail -n1)"
elif ls -d "$HOME"/.nvm/versions/node/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d "$HOME"/.nvm/versions/node/*/bin/node | sort -V | tail -n1)"
elif [ -x /usr/local/bin/node ]; then
  NODE=/usr/local/bin/node
elif [ -x /usr/bin/node ]; then
  NODE=/usr/bin/node
else
  echo "ERROR: no node binary found. Install Node.js in Plesk (Tools & Settings" >&2
  echo "       -> Node.js) or add node to PATH, then redeploy." >&2
  exit 1
fi
echo "Using node: $NODE ($("$NODE" --version))"

# Build into a staging dir OUTSIDE the docroot. This keeps publishing safe even
# if Plesk checked the source out into httpdocs itself (source and output would
# otherwise overlap). The staging dir is always cleaned up.
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

# 1. Build the clean-URL tree into staging (also copies .htaccess + assets).
OUT_DIR="$STAGING" "$NODE" build.js

# 2. Publish: make the docroot identical to the build.
#    -c (checksum) so only genuinely content-changed files transfer, not every
#    file just because the rebuild touched its mtime — this keeps the IndexNow
#    list below to pages that actually changed.
#    --delete removes stale files (incl. any raw source Plesk left in the
#    docroot) so the server mirrors the build exactly.
#    .well-known/ is preserved so Let's Encrypt / ACME cert renewals keep working.
mkdir -p "$DOCROOT"
CHANGED="$(rsync -ac --delete --exclude '.well-known/' --out-format='%n' "$STAGING/" "$DOCROOT/")"

echo "Deployed $(find "$STAGING" -type f | wc -l) files (incl. .htaccess) to $DOCROOT"

# 3. IndexNow: instantly notify Bing/Yandex/Seznam/Naver of the pages that
#    changed this deploy. Free, no quota. (Google ignores IndexNow — GSC covers
#    Google.) Best-effort: never fail the deploy over it.
INDEXNOW_KEY="c35b47d14424e87c2e04a65ca746ff9f"
HOST="www.buildingteams.com"
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
