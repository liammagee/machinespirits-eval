#!/usr/bin/env bash
#
# snapshot-archive.sh — consistent snapshots of the hot SQLite stores in the
# canonical data archive, for option-1 multi-host replication.
#
# Why: the dialogue logs in the archive are immutable (content-hash filenames) and
# Syncthing replicates them conflict-free. The SQLite DBs are WAL-mode and *live* —
# syncing a hot DB file directly corrupts it. So we never sync the live DBs; instead
# this script writes a CONSISTENT copy of each via SQLite's online `.backup` API
# (safe to run while the DB is in use, does not touch the source) into
# <archive>/snapshots/, which IS synced. See docs/archive-replication.md.
#
# Idempotent + safe: writes to a temp file then atomically renames, so Syncthing
# never sees a half-written snapshot. Per-DB failures warn and continue.
#
# Schedule it via launchd (scripts/com.machinespirits.archive-snapshot.plist) or
# run it by hand. Override the archive location with MS_DATA_HOME.

set -uo pipefail

DATA_HOME="${MS_DATA_HOME:-$HOME/.machinespirits-data}"
SNAP_DIR="$DATA_HOME/snapshots"

if [ ! -d "$DATA_HOME" ]; then
  echo "snapshot-archive: data home not found: $DATA_HOME" >&2
  exit 1
fi
mkdir -p "$SNAP_DIR"

# The hot stores (extend if more are added). Glob is intentional: only existing
# DBs are snapshotted; the writing-pad DBs may be absent on some hosts.
DBS=(evaluations.db tutor-writing-pad.db learner-writing-pad.db writing-pads.db)

rc=0
for db in "${DBS[@]}"; do
  src="$DATA_HOME/$db"
  [ -f "$src" ] || continue
  tmp="$SNAP_DIR/.$db.tmp"
  if sqlite3 "$src" ".backup '$tmp'" 2>/dev/null && [ -s "$tmp" ]; then
    mv -f "$tmp" "$SNAP_DIR/$db"
  else
    echo "snapshot-archive: WARN snapshot failed for $db" >&2
    rm -f "$tmp"
    rc=1
  fi
done

echo "snapshot-archive: $(date -u +%FT%TZ) → $SNAP_DIR"
exit $rc
