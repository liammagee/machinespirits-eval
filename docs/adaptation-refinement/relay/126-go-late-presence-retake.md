# 126 — GO note: retake of the 5 quarantined late-presence readings

Date: 2026-08-17
Workplan item: guarded-learner-outcome-study
Authority: reviewer ruling 004
(`docs/adaptation-refinement/guarded-main-block/reviewer-ruling-004-quarantined-reading-retake.json`)
— the reviewer chose the retake in chat ("seems cheap to go for option
1", then "GO, write the note"). Ruling 003's three dropped events stay
dropped; this note does not touch them.
Status: **AWAITING EXPLICIT HUMAN APPROVAL. No call is authorized
until the human approves this note in chat.**

## 1. What this note asks to run

Re-take the 5 assembly-invalid readings of the late presence read
(relay 124, GO relay 125): 3 blinded cases, re-read by the frozen
presence readers through two fresh single-shard collections. One
retake per quarantined reading (note 120); if a retaken reading is
again assembly-invalid there is no second retake — that pair falls to
a disclosed drop ruling. Label unchanged wherever cited:
**late-scored registered endpoint, disclosed instrument amendment**.

## 2. The dry preparation's own numbers (copied, not composed)

From `late-presence/retakes/retake-preparation-manifest.json`, written
by the committed preparer (`scripts/prepare-late-presence-retake.js`,
zero calls):

| Collection | Cases | Planned calls | Largest packet |
|---|---|---|---|
| world_102_marigold_archive_box--gated | 1 | 2 | 39,752 |
| world_102_marigold_archive_box--standing_permission | 2 | 4 | 39,903 |

- Total planned calls: **6**, largest packet **39,903** of the frozen
  60,000-byte cap. Handbook byte-identical to the pilot's, sha256
  `0a8e0d29ee870ea9eef1c74dee880c50665f4315950989a42b5bf35e63aa558b`.
- 6 calls, not 5: the frozen preparer requires exactly two readers per
  collection, so the standing-permission collection also draws a
  presence-reader-b reading of `case-d9db44be3662bb53c7cfdad6`, which
  was never quarantined. Fixed rule (ruling 004, before launch): that
  extra reading replaces nothing — the original valid reading stands;
  the extra response is stored, disclosed, unused.
- Each collection reuses its shard's own blinded corpus (filtered to
  the quarantined cases, same sample ids) and shard catalogue; the
  shard freeze manifest carries one disclosed repoint (corpus binding).

## 3. Budget

Campaign counter after the relay 125 read: **15,077 of 19,337**. This
retake adds 6: **15,077 + 6 = 15,083 of 19,337**.

## 4. Route and seats

Frozen Luna route. Both authorization requests pin destination
`OpenAI Codex CLI (ChatGPT-account route)` and model
`codex.gpt-5.6-luna` (checked on the prepared artifacts); the launcher
refuses anything else. Reader effort: the launcher default (`medium`).

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
collection; `$RUN` is
`/Users/lmagee/Dev/machinespirits/ms-guarded-learner/.tutor-stub-auto-eval/guarded-learner-main-block-2026-08-15`:

```bash
node scripts/run-adaptive-warrant-semantic-readers.js \
  --manifest "$RUN/late-presence/retakes/<shard>/collection/semantic-annotation-collection-manifest.json" \
  --freeze-manifest "$RUN/late-presence/retakes/<shard>/freeze-manifest.json" \
  --authorization-request "$RUN/late-presence/retakes/<shard>/collection/semantic-annotation-authorization-request.json" \
  --out "$RUN/late-presence/retakes/<shard>/responses" \
  --approved-by "relay 126 GO, user approval 2026-08-17"
```

for `<shard>` in the two table rows, in table order. A stopped
collection resumes with `--resume` under this same approval — a resume
of THIS retake, within its 6-call budget, is covered; any new read is
not.

## 6. After the retake (zero further calls)

The adapter (`scripts/score-late-presence-read.js`) gains the ruling
004 path before scoring: the original shard collections assemble with
the 5 quarantined batches omitted through derived collection manifests
(originals untouched, omissions disclosed), the two retake collections
assemble under full frozen verification, and the merge slots each
retaken case into its quarantined slot — the merged set must still
equal the 260 window cases per reader exactly. The forced extra
reading is not merged. Then: score through the frozen endpoint scorer,
result into note 124, RUN-LEDGER row, archive to the private repo.

## 7. Rules

- The 18 pilot dialogues never pool in.
- Stored artifacts are read, never edited. Frozen files are imported,
  never edited.
- Ruling 003's evidence miscount is disclosed beside every use of the
  result (see ruling 004's correction field).
- NEVER push this branch.

**STOP. The paid retake starts only on explicit human approval of
this note in chat.**
