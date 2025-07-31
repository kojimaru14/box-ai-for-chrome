#!/usr/bin/env bash
set -euo pipefail

# Script to create a ZIP package of the Chrome extension for publishing.
# Excludes unnecessary files like .git, markdown files, and this script itself.

# Extract name and version from manifest.json for default output filename
VERSION=$(grep -Po '"version"\s*:\s*"\K[^"]+' manifest.json)
NAME=$(grep -Po '"name"\s*:\s*"\K[^"]+' manifest.json | tr '[:space:]' '_')
OUTPUT="${NAME}_${VERSION}.zip"

# Allow custom output filename as first argument
if [[ $# -gt 0 ]]; then
  OUTPUT="$1"
fi

echo "Packaging extension into: $OUTPUT"

# Patterns to exclude from the ZIP
EXCLUDE_PATTERNS=(
  ".git/*"
  ".gitignore"
  ".gitattributes"
  "*.md"
  "*.zip"
  "zip-extension.sh"
)

# Build zip exclude arguments
EXCLUDE_ARGS=()
for pat in "${EXCLUDE_PATTERNS[@]}"; do
  EXCLUDE_ARGS+=("-x" "$pat")
done

# Create the zip archive
zip -r "$OUTPUT" . "${EXCLUDE_ARGS[@]}"

echo "Created $OUTPUT"
