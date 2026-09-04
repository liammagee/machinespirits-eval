#!/usr/bin/env bash
#
# snapshot-archive.sh — consistent snapshots of the hot SQLite stores in the
# canonical data archive, for option-1 multi-host replication.
#
# Why: Syncthing must never carry a live SQLite file (WAL + concurrent writers
# = corruption). This script produces static, consistent copies via SQLite's
# online backup API; Syncthing carries those.
#
# Two layers per DB:
#   snapshots/<db>                   rolling: the latest consistent copy,
#                                    replaced every run. Protects against disk
#                                    loss only. A row deleted by mistake is gone
#                                    from it at the next run.
#   snapshots/dated/<db>.<date>.zst  one compressed copy per UTC day, kept for
#                                    MS_SNAPSHOT_KEEP_DAYS (default 28). Rows
#                                    deleted or overwritten today can be read
#                                    back from an earlier day. (2026-09-03: the
#                                    §7.9 analyzer rows were lost with no dated
#                                    copy to read them back from.)
#
# Schedule it via launchd (see scripts/com.machinespirits.archive-snapshot.plist)
# or cron. Override the archive location with MS_DATA_HOME, the keep window with
# MS_SNAPSHOT_KEEP_DAYS. Pruning goes by the date in the file name, not mtime:
# Syncthing and cp change mtimes.

set -uo pipefail

DATA_HOME="${MS_DATA_HOME:-$HOME/.machinespirits-data}"
SNAP_DIR="$DATA_HOME/snapshots"
DATED_DIR="$SNAP_DIR/dated"
KEEP_DAYS="${MS_SNAPSHOT_KEEP_DAYS:-28}"
TODAY="$(date -u +%F)"
DBS=(evaluations.db tutor-writing-pad.db learner-writing-pad.db writing-pads.db)

case "$KEEP_DAYS" in
  ''|*[!0-9]*) echo "snapshot-archive: WARN MS_SNAPSHOT_KEEP_DAYS='$KEEP_DAYS' is not a whole number; using 28" >&2; KEEP_DAYS=28 ;;
esac

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "snapshot-archive: sqlite3 not found" >&2
  exit 1
fi

if command -v zstd >/dev/null 2>&1; then
  EXT="zst"
  compress() { zstd -q -3 -T0 -c "$1"; }
else
  EXT="gz"
  compress() { gzip -c "$1"; }
fi

mkdir -p "$SNAP_DIR" "$DATED_DIR"

rc=0
for db in "${DBS[@]}"; do
  src="$DATA_HOME/$db"
  [ -f "$src" ] || continue

  # Rolling copy: write to a temp file next to the target, then atomic rename.
  tmp="$SNAP_DIR/.$db.tmp"
  if sqlite3 "$src" ".backup '$tmp'" 2>/dev/null; then
    mv -f "$tmp" "$SNAP_DIR/$db"
  else
    echo "snapshot-archive: WARN backup failed for $db" >&2
    rm -f "$tmp"
    rc=1
    continue
  fi

  # Dated copy: at most one per UTC day, compressed from the fresh rolling copy.
  dated="$DATED_DIR/$db.$TODAY.$EXT"
  [ -s "$dated" ] && continue
  tmp2="$DATED_DIR/.$db.$TODAY.tmp"
  if compress "$SNAP_DIR/$db" > "$tmp2" && [ -s "$tmp2" ]; then
    mv -f "$tmp2" "$dated"
  else
    echo "snapshot-archive: WARN dated copy failed for $db" >&2
    rm -f "$tmp2"
    rc=1
  fi
done

# Prune dated copies older than the keep window (BSD date first, then GNU).
pruned=0
if cutoff="$(date -u -v-"${KEEP_DAYS}"d +%F 2>/dev/null)" || cutoff="$(date -u -d "-${KEEP_DAYS} days" +%F 2>/dev/null)"; then
  for f in "$DATED_DIR"/*.????-??-??.*; do
    [ -e "$f" ] || continue
    fdate="$(basename "$f" | sed -E 's/.*\.([0-9]{4}-[0-9]{2}-[0-9]{2})\.[a-z]+$/\1/')"
    case "$fdate" in ????-??-??) ;; *) continue ;; esac
    if [[ "$fdate" < "$cutoff" ]]; then
      rm -f "$f"
      pruned=$((pruned + 1))
    fi
  done
else
  echo "snapshot-archive: WARN could not compute the prune cutoff; nothing pruned" >&2
fi

kept="$(find "$DATED_DIR" -maxdepth 1 -type f -name '*.????-??-??.*' | wc -l | tr -d ' ')"
echo "snapshot-archive: $(date -u +%FT%TZ) rolling copies in $SNAP_DIR; dated copies: $kept kept, $pruned pruned (window ${KEEP_DAYS}d)"
exit $rc
