#!/usr/bin/env bash
#
# Download evaluation databases from the GitHub release.
# Creates symlinks in data/ pointing to ~/.machinespirits-data/.
#
# Usage: ./scripts/download-data.sh [--tag v2.3.14]
#
# Requires: gh (GitHub CLI), authenticated

set -euo pipefail

REPO="liammagee/machinespirits-eval"
TAG="${1:-v2.3.14}"
DATA_DIR="$HOME/.machinespirits-data"
LINK_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"

# Strip --tag prefix if provided
TAG="${TAG#--tag }"
TAG="${TAG#--tag=}"

echo "Downloading evaluation databases from release ${TAG}..."
echo "  Target: ${DATA_DIR}"
echo ""

mkdir -p "${DATA_DIR}"

DB_FILES=(evaluations.db learner-writing-pad.db tutor-writing-pad.db writing-pads.db)

for f in "${DB_FILES[@]}"; do
  if [ -f "${DATA_DIR}/${f}" ]; then
    echo "  [skip] ${f} (already exists)"
  else
    echo "  [download] ${f}..."
    gh release download "${TAG}" --repo "${REPO}" --pattern "${f}" --dir "${DATA_DIR}"
  fi
done

echo ""
echo "Creating symlinks in ${LINK_DIR}/..."

for f in "${DB_FILES[@]}"; do
  target="${DATA_DIR}/${f}"
  link="${LINK_DIR}/${f}"
  if [ -L "${link}" ]; then
    echo "  [skip] ${f} (symlink exists)"
  elif [ -f "${link}" ]; then
    echo "  [skip] ${f} (regular file exists — remove manually if you want a symlink)"
  else
    ln -s "${target}" "${link}"
    echo "  [link] ${f} -> ${target}"
  fi
done

echo ""
echo "Done. Verify with: node -e \"import Database from 'better-sqlite3'; const db = new Database('data/evaluations.db'); console.log(db.prepare('SELECT COUNT(*) as n FROM evaluation_results').get())\""
