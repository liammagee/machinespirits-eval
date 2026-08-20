# Artifact bundle contract

Status: Wave 3C current-tree deduplication boundary, 2026-08-20.

PR [#714](https://github.com/liammagee/machinespirits-eval/pull/714)
established a verifiable and restorable evidence-bundle boundary before any
payload change. Wave 3C now removes only the redundant expanded manifest
members from the current tree. The Git-tracked archive and manifest remain the
durable replicated source: every complete Git clone receives both objects and
can verify or restore the payload without selecting an external store.

The runtime remains transport-neutral: an operator supplies an explicit local
archive path, and
`scripts/artifact-bundle.js` verifies, caches, or restores only that file. The
script does not resolve URLs, choose an external store, authenticate to a
service, or infer a source from machine state.

The first production specimen is the Green Room Gate 1 raw bundle:

- manifest:
  `exports/greenroom-gate1-2026-07-12/raw-bundle-manifest.json`;
- archive:
  `exports/greenroom-gate1-2026-07-12/raw-bundle.tar.gz`;
- archive size: 9,492,826 bytes;
- archive SHA-256:
  `d5c5c5e7315c52d84652b4e35d47b998f449f6241f71660fb8f02eb8fe5d2434`;
- restorable payload: exactly 26 files and 61,350,499 uncompressed bytes under
  `exports/greenroom-gate1-2026-07-12`.

The archive and manifest remain tracked. The 26 expanded members do not: each
was independently matched to its manifest byte count and SHA-256 and to the
corresponding byte-identical archive member before its explicit removal. This
does not authorize moving or untracking the archive or manifest, deleting any
other local copy, or changing the bundle's provenance or access class.

## Current-tree measurement

The measurement counts Git-tracked paths and their exact logical working-tree
bytes under `exports/greenroom-gate1-2026-07-12` at the Wave 3C base and after
the explicit manifest-derived deletion:

| State | Tracked paths | Logical bytes |
| --- | ---: | ---: |
| Before | 46 | 71,060,298 |
| After | 20 | 9,709,799 |
| Reduction | 26 | 61,350,499 |

The 20 retained paths are the archive, its manifest, the two Gate 1 reports,
the original Gate 1 manifest, placebo notes, eight transcript books, and the
six `performances/P3.book.md` through `performances/P8.book.md` files. The
reduction is checkout deduplication only: historical Git objects are unchanged.

## Manifest v1

`machinespirits.artifact-bundle-manifest.v1` has two integrity layers:

1. `archive` identifies the archive object itself.
2. `files` identifies the complete restored payload.

The archive object contains:

| Field | Contract |
| --- | --- |
| `path` | POSIX repository-relative identity of the archive; it is not a transport locator |
| `format` | `tar.gz` for this version |
| `root` | The one repository-relative root permitted for every archive member |
| `bytes` | Exact compressed byte length |
| `sha256` | Lower-case SHA-256 of the complete compressed archive |

Each `files` row retains the existing repository-relative `file`, exact
uncompressed `bytes`, and SHA-256. A v1 verifier must reject an unsupported
schema or format, an unsafe or duplicate path, a member outside `archive.root`,
an archive member missing from the manifest, an extra archive member, or any
byte-count or digest mismatch. The manifest path is the stable repository
identity; the archive supplied to a command may live elsewhere locally.

Version 1 deliberately accepts only canonical POSIX or GNU-compatible USTAR
regular-file headers with conventional 10 KiB tar-record padding. Links,
special files, PAX/GNU extension records, and other tar layouts fail closed.

## Explicit-local commands

All commands are deterministic and make zero model calls.

### Verify an archive

```bash
node scripts/artifact-bundle.js verify \
  --manifest exports/greenroom-gate1-2026-07-12/raw-bundle-manifest.json \
  --archive exports/greenroom-gate1-2026-07-12/raw-bundle.tar.gz
```

`verify` checks the compressed size and digest, the safe exact tar member set,
and every restored member's size and digest without changing the archive or
the repository.

### Fetch from an explicit local source into a cache

```bash
node scripts/artifact-bundle.js fetch \
  --manifest exports/greenroom-gate1-2026-07-12/raw-bundle-manifest.json \
  --source /absolute/path/to/raw-bundle.tar.gz \
  --cache-dir /absolute/path/to/artifact-cache
```

`fetch` means local materialization, not network retrieval. The source may have
arrived through a removable volume, Syncthing, or another operator-chosen
transport, but that transport is outside this command. The command verifies the
source first and reports the digest-addressed cached archive path. Cache objects
live at `<cache-dir>/sha256/<archive-sha256>.tar.gz` and are create-once: a
matching existing object may be reused, while conflicting bytes fail closed
rather than being overwritten. Standard output names the absolute archive path,
whether it was published or was a cache hit, and the verified file and byte
counts.

### Restore into an absent or empty directory

```bash
node scripts/artifact-bundle.js restore \
  --manifest exports/greenroom-gate1-2026-07-12/raw-bundle-manifest.json \
  --archive /absolute/path/to/cached/raw-bundle.tar.gz \
  --out /absolute/path/to/empty-or-absent-restore-root
```

`restore` accepts only an absent or empty `--out` directory. It extracts the
manifest root beneath that directory and verifies the exact 26-row payload
after extraction. It never merges into a populated tree, replaces an existing
file, or cleans up another path.

## Production drill

The first production drill uses the real tracked archive as the explicit local
source and retains its temporary cache and restored tree for inspection:

```bash
MANIFEST=exports/greenroom-gate1-2026-07-12/raw-bundle-manifest.json
ARCHIVE=exports/greenroom-gate1-2026-07-12/raw-bundle.tar.gz
DRILL_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/artifact-bundle-drill.XXXXXX")"

node scripts/artifact-bundle.js verify --manifest "$MANIFEST" --archive "$ARCHIVE"
node scripts/artifact-bundle.js fetch --manifest "$MANIFEST" --source "$ARCHIVE" --cache-dir "$DRILL_ROOT/cache"

CACHED_ARCHIVE="$DRILL_ROOT/cache/sha256/d5c5c5e7315c52d84652b4e35d47b998f449f6241f71660fb8f02eb8fe5d2434.tar.gz"
node scripts/artifact-bundle.js verify --manifest "$MANIFEST" --archive "$CACHED_ARCHIVE"
node scripts/artifact-bundle.js restore --manifest "$MANIFEST" --archive "$CACHED_ARCHIVE" --out "$DRILL_ROOT/restored"

printf 'Retained drill root: %s\n' "$DRILL_ROOT"
```

The drill passes only when both archive verifications and the post-restore
26-file verification pass, with the exact compressed and uncompressed
measurements above. The drill deliberately has no cleanup step.

## Wave 3C consumer boundary

Wave 3C was separately approved only after the Wave 3B boundary and production
drill passed. `scripts/analyze-step4-trigger-density.js::greenroomSources()` is
the live raw-payload consumer: it reads requested files from the fully verified
tracked bundle rather than assuming expanded manifest members exist, with
`tests/analyzeStep4TriggerDensity.test.js` retaining that regression boundary.
The six small `performances/P3.book.md` through `performances/P8.book.md` files
are not archive members and remain tracked.

The zero-call census also runs against the restored root:

```bash
node scripts/census-guard-template-rate.js \
  <restore-root>/exports/greenroom-gate1-2026-07-12 \
  --quiet
```

Its expected provenance stamp is `legacy format, 10 trace files; pre-catalog;
314 turns; 6% template; 89% model as written`. This command reads the restored
traces without calling a model or writing a result.

`scripts/greenroom-gate1-score.js` is a historical/manual model-backed
consumer of the same raw performances and may overwrite the closed Gate 1
reports. It is not part of migration verification and must not be run merely to
test this boundary. For deliberate reuse, first restore the verified bundle to
an explicit `<restore-root>`, then pass
`<restore-root>/exports/greenroom-gate1-2026-07-12` as `--gate-dir`; the script
header records that route without changing executable behavior.

Any later proposal to move or untrack the archive or manifest must name and
verify another durable replicated source and receive separate approval. A
cache, restored tree, retained drill, or local worktree is not a replacement
for the tracked source of record.

No history rewrite is part of this contract, so it cannot reduce historical Git
pack size. No archive or restore operation licenses evidence for training or
changes its provenance, retention, or access class.
