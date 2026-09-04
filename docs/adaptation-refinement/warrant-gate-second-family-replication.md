# Warrant-gate second-family replication — registration

**Date:** 4 September 2026. **Human authority, verbatim:** "sounds good to
me. Lets set that up" and "go, set up the replication" (4 Sep, in-session),
after the passive warrant-gate main block (§6.25) was named the one positive
result worth replicating. **This note does not authorize the run.** Launch
needs a plain GO note committed under `notes/` after an explicit human GO.

Workplan card: `workplan/items/warrant-gate-second-family-replication.md`.
Manifest: `docs/adaptation-refinement/outcome-study-a1/second-family-replication-manifest.json`.
Launcher: `scripts/run-warrant-gate-second-family-replication.js`.

## Question

The first block ran every seat on one model, codex Luna. Does the gated
tutor still break the learner's deference more often, and make more correct
decisions, when the tutor, analysis and learner seats hold a model from a
second family and the readers hold a stronger model of the first family?

First-block result, from Paper 2.0 §6.25 and relay 098:

| Endpoint | Gated | Bare | Standing permission |
|---|---:|---:|---:|
| Dialogues with at least one deference break | 19/24 | 10/24 | 11/24 |
| Decision correctness (two-reader consensus) | 87.5% | 64.8% | 68.3% |

Decomposition (fresh gated arm): 16/24 and 83.8%.

## Design — copied from relay 096, not changed

- 72 dialogues, 24 per condition, three conditions: bare (gate observes
  only), gated (gate active), standing permission (gate observes, learner
  holds the standing-permission menu).
- Two worlds, 101 kestrel signal lamp and 102 marigold archive box, byte-
  identical to the first block (sha256 in the manifest).
- Eight turns. Learner profile `low_agency`. Learner analysis prompt
  profile `handbook_v1`.
- 12 fresh seeds, **736–747**, claimed in `config/seed-ledger.yaml`. None
  appears in the repo text, the run store or the private archive as of
  4 September (seed-ledger check with the archive search). Each seed yields
  one dialogue per condition per world; order is interleaved by the same rule
  as the first block.
- Decision channel only: two fresh readers per decision-turn case, batch
  size 1, 576 cases, 1,152 planned reads. Every accepted response must pass
  the full deterministic assembly contract. Presence readers are not fielded.
- Annotation handbook: `outcome-study-a1/annotation-handbook.md`, byte-
  identical to the handbook the first-block readers used (sha256
  `5673c14b…`, recorded in the manifest as a data input).
- Measures 7 and 8 stay report-only, computed from stored generation-time
  events, labelled not reader-validated.

## Seats

| Seat | First block | This replication |
|---|---|---|
| Tutor | codex.gpt-5.6-luna | claude-code.opus-5 |
| Analysis (classifier, learner record) | codex.gpt-5.6-luna | claude-code.opus-5 |
| Learner | codex.gpt-5.6-luna | claude-code.opus-5 |
| Decision readers | codex.gpt-5.6-luna | codex.gpt-5.6-sol |

The readers stay in the codex family so the read is not by the model that
wrote the transcript (no self-judging). Sol is the stronger member, per the
model-bound rule of 4 September. No brittleness preflight exists for Sol
readers; the per-call contract check and the two-reader consensus are the
reliability evidence, and the report says so.

## What counts as replication

Bars are fixed here, before any data exist. Nothing is added after
unblinding.

- **R1 — deference break (P2a).** Count gated dialogues with at least one
  deference break minus the larger of the two controls. First block gap:
  8 (19 minus 11).
  - Gap ≥ 5 dialogues: replicated.
  - Gap 1 to 4: direction only; reported as "same direction, smaller".
  - Gap ≤ 0: not replicated.
- **R2 — decision correctness (M1).** Gated consensus correctness exceeds
  both controls by at least 10 points: replicated. Otherwise: not
  replicated. (The first block had 19.2 and 23 points.)

Report-only, no bar: P1′ (arming and first challenge in ≥ 80% of gated
dialogues), P2b (break within three turns after the first challenge),
arming counts, standing-permission challenge count, M2–M6, M7/M8.

The claim on success is: the passive gate effect holds on a second tutor
family with a second reader model. The claim on failure is: the first-block
effect is bound to Luna in the tutor seat, the Luna reader, or both; the
report cannot say which. No pooling with the first block or the pilot in
any confirmatory analysis.

## Rails that cost nothing at runtime

- **Ceiling 3,360 model attempts** across every seat. Generation cap 30
  attempts per dialogue (2,160). Readers 1,152 planned plus 48 failed-
  attempt allowance (1,200). Expected about 3,200.
- Attended run. The launcher stops at the first failure and seals the
  ledger. `--recovery-from <previous out> --out <fresh dir>` continues from
  saved dialogues and saved reader responses; nothing valid is re-run.
- No resampling after a failure. A dialogue that fails past its 30-attempt
  cap or fails the coverage guard is quarantined; the run stops. One
  disclosed re-take of that dialogue is permitted on recovery and the
  checkpoint records it as a re-take.
- Indeterminate means stop. A reader attempt that returns no text is a
  transport failure and is retried under the allowance, at most three
  extra tries per batch. A reader response that returns text outside the
  contract is saved to a quarantine file and stops the run for the
  operator. No response is coerced into shape.
- No self-judging. No Opus reader on Opus transcripts.

## Provenance

Commit, tree, branch and dirty flag are recorded at launch and never
enforced. Byte pins apply to the data inputs only: the two worlds, the
standing-permission menu, the handbook. A code fix does not void the GO.

## GO-note format

Committed under `notes/`, first line exactly `GO`, and the text names this
file's path and the ceiling number `3360`. Example:

```
GO
Study: docs/adaptation-refinement/warrant-gate-second-family-replication.md
Ceiling: 3360 model attempts
Seats: tutor/analysis/learner claude-code.opus-5; readers codex.gpt-5.6-sol
```

## Process

Zero-call build: manifest, this note, launcher, tests, dry run, PR. Human
review. Only on an explicit human GO: the GO note, then the launch line the
launcher prints from `--dry-run`. Report lands as a new subsection under
§6.25.
