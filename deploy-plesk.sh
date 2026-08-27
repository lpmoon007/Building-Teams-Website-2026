#!/usr/bin/env bash
#
# deploy-plesk.sh — entry point for Plesk Git "Additional deployment actions".
#
# PREBUILT MODEL: the clean-URL site is built in CI and committed to dist/, so
# this script does NO Node/build work on the server — it just publishes the
# committed dist/ into the public docroot. Nothing here depends on Node being
# installed or on PATH, so the deploy can't fail on a missing build toolchain.
#
# In Plesk -> Domains -> buildingteams.com -> Git -> "Additional deployment
# actions", paste exactly:
#
#     bash deploy-plesk.sh
#
# Override the target docroot with the DOCROOT env var if it differs from the
# auto-detected one below.
#
set -euo pipefail

# Run from the repo (where this script lives), wherever Plesk checked it out.
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

# Resolve the public docroot to publish into, in priority order:
#   1. DOCROOT env var (set this in Plesk if auto-detection is ever wrong).
#   2. The repo dir itself, when Plesk checked the repo out INTO the docroot
#      (its basename is httpdocs) — the common Plesk layout with Server path
#      "/httpdocs".
#   3. An httpdocs sibling of the repo checkout.
if [ -n "${DOCROOT:-}" ]; then
  :
elif [ "$(basename "$REPO_DIR")" = "httpdocs" ]; then
  DOCROOT="$REPO_DIR"
else
  DOCROOT="$(dirname "$REPO_DIR")/httpdocs"
fi

# The committed build must be present — fail loudly rather than publishing an
# empty tree that would blank the live site.
if [ ! -f "$REPO_DIR/dist/index.html" ]; then
  echo "ERROR: dist/index.html not found in the repo. The build output must be" >&2
  echo "       committed (run 'node build.js' locally and commit dist/)." >&2
  exit 1
fi

# Stage the committed build OUTSIDE the docroot first, so the --delete publish
# below is safe even when Plesk checked the repo out into the docroot itself
# (repo and docroot overlap). Without this, rsync --delete could remove the
# very dist/ it is copying from.
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
cp -a "$REPO_DIR/dist/." "$STAGING/"

# Publish: make the docroot identical to the committed build.
#   -c (checksum) so only genuinely content-changed files transfer.
#   --delete removes stale files (incl. any raw source Plesk left in the
#   docroot — source .html with spaces, build.js, the dist/ dir itself, etc.)
#   so the server mirrors the build exactly and serves ONLY the built site.
#   .well-known/ is preserved so Let's Encrypt / ACME cert renewals keep working.
mkdir -p "$DOCROOT"
CHANGED="$(rsync -ac --delete --exclude '.well-known/' --out-format='%n' "$STAGING/" "$DOCROOT/")"

echo "Published $(find "$STAGING" -type f | wc -l) files to $DOCROOT"
BUILD_ID="$(grep -o '<!-- build: [^>]*-->' "$STAGING/index.html" 2>/dev/null || true)"
[ -n "$BUILD_ID" ] && echo "Live build marker: $BUILD_ID"

# IndexNow: instantly notify Bing/Yandex/Seznam/Naver of the pages that changed
# this deploy. Free, no quota. (Google ignores IndexNow — GSC covers Google.)
# Best-effort: never fail the deploy over it.
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
