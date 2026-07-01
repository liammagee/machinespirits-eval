# Archive replication — option 1 (Syncthing + DB snapshots)

The canonical data archive `~/.machinespirits-data` (the evaluations DB plus ~7 GB of
immutable dialogue logs) is machine-local by decision (A) of the workplan item
`consolidate-logs-db-private-archive`. This note is how it is replicated across machines.

## The shape of the problem

The archive is **two stores with opposite replication needs**, and the mistake is to
treat them as one folder:

| Store | Shape | Replication |
| --- | --- | --- |
| `logs/` | ~7 GB, ~50k JSON files, **content-hash filenames → immutable, append-only** | trivial — conflict-free, only new files transfer |
| `evaluations.db` (+ `*-writing-pad.db`) | SQLite in **WAL mode, written live during runs** | **never file-sync a live SQLite — it corrupts** |

## The design

- **Logs → Syncthing** (real-time, peer-to-peer, no cloud). Immutable filenames mean
  no conflicts ever. `~/.machinespirits-data/logs` is a **materialized real directory**
  (2026-06-28): it was previously a symlink to `machinespirits-eval-private/logs`, but a
  symlink pointing *outside* the shared folder does not sync its content, so the tree was
  copied in place (the private repo's copy is untouched and the swap is reversible). New
  logs written by `evaluationStore` (`LOGS_ROOT`) land here directly.
- **Hot DBs → consistent snapshots, then Syncthing.** A scheduled job copies each live
  DB via SQLite's online `.backup` API (safe while in use, does not touch the source)
  into `snapshots/`, and Syncthing carries those static files. We never sync the live
  DB itself.
- **`.stignore`** keeps Syncthing off the live DBs and their WAL/SHM sidecars.

## Historical private Git archive policy

The old `machinespirits-eval-private` repository is a legacy mirror, not the
active archive. Its historical `logs/` tree remains useful for provenance and
manual recovery, but new writes should not target it and the project should not
add more dialogue logs to ordinary Git history there.

Policy:

- **Freeze the private Git repository as historical/read-only.** Do not rewrite
  history, migrate to Git LFS, or delete its `logs/` tree as routine public-repo
  maintenance.
- **Treat `~/.machinespirits-data` as canonical.** Active logs live in
  `~/.machinespirits-data/logs`; consistent DB copies live in
  `~/.machinespirits-data/snapshots`.
- **Use Syncthing plus DB snapshots for replication.** This is the supported
  recovery path for another machine.
- **Reopen private-repo migration only as a separate, explicit maintenance
  project.** Git LFS migration or history rewrite is justified only if clone
  size or hosting policy becomes a material problem, and it should be scheduled
  with a fresh backup and recovery test.

## What is set up on this machine

1. **Snapshot job.** `scripts/snapshot-archive.sh` is installed at
   `~/.machinespirits-data/snapshot-archive.sh`; the launchd agent
   `com.machinespirits.archive-snapshot` runs it every 6 h (and on load), writing
   `snapshots/{evaluations,tutor-writing-pad,learner-writing-pad,writing-pads}.db`.
2. **Syncthing** (`brew install syncthing`, started as a login service) with the folder
   **`machinespirits-archive` → `~/.machinespirits-data`**, `.stignore` applied.

This machine's Device ID is shown in the GUI (`http://127.0.0.1:8384`) and via
`syncthing cli show system | grep myID`.

## Pair another machine (the remaining step)

Syncthing pairing needs both machines, so this part is manual. On the **other** machine:

1. `brew install syncthing && brew services start syncthing`
2. Copy the ignore + snapshot script + load the snapshot job:
   ```bash
   DH="$HOME/.machinespirits-data"; mkdir -p "$DH/snapshots"
   cp scripts/archive.stignore "$DH/.stignore"
   cp scripts/snapshot-archive.sh "$DH/snapshot-archive.sh"; chmod +x "$DH/snapshot-archive.sh"
   sed "s|__DATA_HOME__|$DH|g" scripts/com.machinespirits.archive-snapshot.plist \
     > ~/Library/LaunchAgents/com.machinespirits.archive-snapshot.plist
   launchctl load ~/Library/LaunchAgents/com.machinespirits.archive-snapshot.plist
   ```
3. In each machine's GUI (`http://127.0.0.1:8384`): **Add Remote Device** and paste the
   other's Device ID; accept on the far side. Then on the machine that has the data,
   open folder `machinespirits-archive` → **Edit → Sharing** → tick the new device; the
   far side accepts the share with path `~/.machinespirits-data`.

After the first sync, `logs/` and `snapshots/` are present on both.

## Using the data on a synced machine

- **Logs** are live at `~/.machinespirits-data/logs` — provenance/validators resolve
  there automatically (see `evaluationStore.js` `LOGS_ROOT`).
- **DB**: the synced `snapshots/evaluations.db` is the consistent copy. To use it as the
  live DB on a machine that does not itself run evals, point `EVAL_DB_PATH` at it (or
  `cp snapshots/evaluations.db ~/.machinespirits-data/evaluations.db`). Do **not** sync
  the live `evaluations.db` between machines that both write it — that is what the
  `.stignore` prevents.

## Why not just sync the whole folder?

A live SQLite DB in WAL mode has a main file plus `-wal`/`-shm` sidecars that change
together; a file-sync tool that copies them at inconsistent moments produces a corrupt
or rolled-back DB. The `.backup` snapshot is a single, internally-consistent file that
is safe to replicate.

## Tuning

- **Snapshot cadence**: `StartInterval` in the plist (default `21600` = 6 h). The logs
  sync in real time regardless; this only governs how fresh the replicated DB snapshot is.
- **More hot stores**: add their filenames to `DBS=(...)` in `snapshot-archive.sh` and to
  `.stignore`.
