# 125 — GO note: the late presence read on the stored main block

Date: 2026-08-17
Workplan item: guarded-learner-outcome-study
Registration: relay 124 (SEALED 2026-08-17, human ruling verbatim
"1 yes, 2 windows only").
Status: **AWAITING EXPLICIT HUMAN APPROVAL. No call is authorized
until the human approves this note in chat.**

## 1. What this note asks to run

The registered late read of relay 117's P3 on the stored overconfident
main block (`guarded-learner-main-block-2026-08-15`): the two frozen
presence readers on every turn inside a delivered or shadow reply
window, nothing else. Label wherever cited: **late-scored registered
endpoint, disclosed instrument amendment**.

## 2. The dry preparation's own numbers (copied, not composed)

From `late-presence/preparation-manifest.json`, written by the
committed preparer (`scripts/prepare-late-presence-read.js`, zero
calls):

- Window cases: **260** over **261** window turns. The one turn with
  no corpus case is exactly the ruled-out turn
  `outcome-pilot-34-world_102_marigold_archive_box-s659-standing_permission#8`
  (ruling 002).
- Moments: delivered **71** (66 with a reply turn), shadow **163**
  (152 with a reply turn) — the same denominators as relay 123 (66 /
  152).
- Planned calls: **520** total (260 cases × 2 readers, batch size 1).
- Largest packet: **46,749** bytes of the frozen 60,000-byte cap.
  Every response schema fits the frozen 14,000-byte cap.
- Handbook: byte-identical to the pilot's, sha256
  `0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b`.
- Six shards (world × condition), each through the frozen preparer
  unchanged:

| Shard | Cases | Planned calls | Largest packet |
|---|---|---|---|
| world_101_kestrel_signal_lamp--bare | 32 | 64 | 46,749 |
| world_101_kestrel_signal_lamp--gated | 46 | 92 | 39,173 |
| world_101_kestrel_signal_lamp--standing_permission | 50 | 100 | 32,576 |
| world_102_marigold_archive_box--bare | 40 | 80 | 39,909 |
| world_102_marigold_archive_box--gated | 44 | 88 | 40,644 |
| world_102_marigold_archive_box--standing_permission | 48 | 96 | 40,031 |

A free probe replicated every launcher refusal check on all six
shards (approval bindings, freeze artifact re-hashing, preflight and
schema-acceptance validators, per-packet shas, schema totality, call
budget): PASS, 520 packets audited.

## 3. Budget

Campaign counter before this read: **14,557 of 19,337** (relay 124
§5). This read adds 520: **14,557 + 520 = 15,077 of 19,337**.

## 4. Route and seats

Frozen Luna route. Each shard's authorization request pins
destination `OpenAI Codex CLI (ChatGPT-account route)` and model
`codex.gpt-5.6-luna`; the launcher refuses anything else. Reader
effort: the launcher default (`medium`).

## 5. The commands (copied from the launcher's usage line)

Usage, copied verbatim from the frozen launcher:

> Usage: node scripts/run-adaptive-warrant-semantic-readers.js
> --manifest \<collection\> --freeze-manifest \<freeze\>
> --authorization-request \<request\> --out \<dir\> --approved-by
> \<standing-authorization-record\> [--effort medium] [--resume]
> [--quarantine-manifest \<manifest\>]

Run from the parked checkout
(`/Users/lmagee/Dev/machinespirits/ms-guarded-readers-pinned`, clean
at `a0de1500` — the launcher refuses elsewhere). One command per
shard; `$RUN` is
`/Users/lmagee/Dev/machinespirits/ms-guarded-learner/.tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15`:

```bash
node scripts/run-adaptive-warrant-semantic-readers.js \
  --manifest "$RUN/late-presence/<shard>/collection/semantic-annotation-collection-manifest.json" \
  --freeze-manifest "$RUN/late-presence/<shard>/freeze-manifest.json" \
  --authorization-request "$RUN/late-presence/<shard>/collection/semantic-annotation-authorization-request.json" \
  --out "$RUN/late-presence/<shard>/responses" \
  --approved-by "relay 125 GO, user approval 2026-08-17"
```

for `<shard>` in the six table rows, in table order. A stopped shard
resumes with `--resume` under this same approval — a resume of THIS
read, within its 520-call budget, is covered; any new read is not.

## 6. After the read (zero further calls)

The committed adapter (`scripts/score-late-presence-read.js`,
committed before this note per relay 124 §5) assembles each shard
through the frozen assembler, merges into the two run-root reader
files, and scores through the frozen endpoint scorer with the
main-block shape. Side reports, description only: either-reader,
second-count band, rejected-wide band, shadow split by condition,
agreement with relay 123 on the same windows. Then: result recorded
in note 124, RUN-LEDGER row, archive to the private repo.

## 7. Rules

- The 18 pilot dialogues never pool in.
- Stored artifacts are read, never edited. Frozen files are imported,
  never edited.
- A flat or reversed result is a finding: P3 then closes late in the
  negative, with the label. If the direction holds, P3 closes in the
  positive, with the label.
- NEVER push this branch.

**STOP. The paid read starts only on explicit human approval of this
note in chat.**
