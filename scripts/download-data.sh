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
DEFAULT_TAG="v2.3.14"
TAG="${DEFAULT_TAG}"
DATA_DIR="$HOME/.machinespirits-data"
LINK_DIR="$(cd "$(dirname "$0")/.." && pwd)/data"

# Argument parsing — supports:
#   ./download-data.sh                        (uses default tag)
#   ./download-data.sh v2.3.14                (positional)
#   ./download-data.sh --tag v2.3.14          (separate value)
#   ./download-data.sh --tag=v2.3.14          (= form)
while [ $# -gt 0 ]; do
  case "$1" in
    --tag)
      TAG="${2:?--tag requires a value}"
      shift 2
      ;;
    --tag=*)
      TAG="${1#--tag=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--tag <release-tag> | <release-tag>]"
      echo "  Default tag: ${DEFAULT_TAG}"
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Usage: $0 [--tag <release-tag> | <release-tag>]" >&2
      exit 1
      ;;
    *)
      TAG="$1"
      shift
      ;;
  esac
done

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
