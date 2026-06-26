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

# Public docroot to publish into. Override in Plesk via an env var if needed.
DOCROOT="${DOCROOT:-/var/www/vhosts/buildingteams.com/httpdocs}"

# Find a Node binary: prefer one on PATH, else the newest Plesk-bundled Node.
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
elif ls -d /opt/plesk/node/*/bin/node >/dev/null 2>&1; then
  NODE="$(ls -d /opt/plesk/node/*/bin/node | sort -V | tail -n1)"
else
  echo "ERROR: no node binary found. Install Node.js in Plesk (Tools & Settings" >&2
  echo "       -> Node.js) or add node to PATH, then redeploy." >&2
  exit 1
fi
echo "Using node: $NODE ($("$NODE" --version))"

# 1. Build the clean-URL tree (also copies .htaccess + assets into dist/).
"$NODE" build.js

# 2. Publish: make the docroot identical to dist/.
#    --delete removes stale files so the server mirrors the build exactly.
#    .well-known/ is preserved so Let's Encrypt / ACME cert renewals keep working.
mkdir -p "$DOCROOT"
rsync -a --delete --exclude '.well-known/' dist/ "$DOCROOT/"

echo "Deployed $(find dist -type f | wc -l) files (incl. .htaccess) to $DOCROOT"
