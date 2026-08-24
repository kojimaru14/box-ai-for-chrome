#!/usr/bin/env bash
set -euo pipefail

# Script to create a ZIP package of the Chrome extension for publishing.
# Zips the contents of extension/ so manifest.json is at the archive root.
# Repo-root files (README, PrivacyPolicy, this script, .git) are not included.

ROOT="$(cd "$(dirname "$0")" && pwd)"
EXT="$ROOT/extension"

# Extract name and version from manifest.json for default output filename
VERSION=$(grep -Po '"version"\s*:\s*"\K[^"]+' "$EXT/manifest.json")
NAME=$(basename "$ROOT")
OUTPUT="${NAME}_${VERSION}.zip"

# Allow custom output filename as first argument
if [[ $# -gt 0 ]]; then
  OUTPUT="$1"
fi

# Resolve relative output paths against the repo root
case "$OUTPUT" in
  /*) ;;
  [A-Za-z]:*) ;;
  *) OUTPUT="$ROOT/$OUTPUT" ;;
esac

echo "Packaging extension into: $OUTPUT"

(
  cd "$EXT"
  zip -r "$OUTPUT" .
)

echo "Created $OUTPUT"
