# Brief: reconciling the tutor-stub and cell-based harnesses

**Date:** 16 August 2026. **Status:** exploration brief — design work only.
No paid model calls. Read-only survey first; no code changes until the map
is done and a human has read it.

## The question

The repo now runs two worlds that both claim to be "the tutor":

- **The cell world.** A tutor is a profile in `config/tutor-agents.yaml`
  (cells 1–205+), run by the evaluation runner or a specialised runner,
  scored by LLM judges under versioned rubrics, with rows landing in the
  evaluation database. The factorial machinery, the id-director family,
  and the adaptive LangGraph cells all live here.
- **The tutor-stub world.** A tutor is a configured stub with typed parts:
  the proof-DAG over content, action-family contracts with expected
  learner response and deadlines, the warrant gate, register-policy
  overlays (including the edge-timing overlay), move libraries. Scoring
  leans on deterministic readers and blind human readings more than on
  LLM judges.

Findings cross between them informally (the edge-timing policy was born
in one and folded into the other), but nothing states how a claim made in
one world transfers to the other, or which parts are duplicates.

## Deliverable

One survey note that maps the two worlds side by side. For each row, say
where the thing lives in each world, and whether the two are the same
thing, siblings, or unrelated:

1. What defines a tutor (cell YAML vs stub config).
2. What defines a learner (dynamic ego–superego learner and personas vs
   scripted or stub-side learners).
3. What defines a run (run IDs, database rows, logs vs stub transcripts
   and artifacts).
4. What defines a score (LLM judges under versioned rubrics vs
   deterministic readers, gates, blind human readings).
5. What defines adaptation (router or policy switches in traces vs typed
   contracts, the warrant gate, the obligation ledger).
6. The shared seams that already exist — start with the edge-timing
   register overlay and the proof-DAG reads inside the edge-timing
   detector — and any one-way dependency rules they must keep.
7. Things that exist only in one world and why (the factorial registry
   and judge pipeline; the typed contracts and proof-DAG).

Close the note with two or three reconciliation options and their costs —
for example: leave them separate with a stated transfer rule; give the
stub a cell wrapper so stub tutors get database rows and judge scores;
extract the typed contracts as a service the cell world can call. Do not
pick one in the survey; that is a later, human decision.

## Starting points

- `config/tutor-agents.yaml`, `services/evalProfileRegistry.js`,
  `services/evaluationStore.js` (cell world spine).
- `docs/tutor-stub-cli.md`,
  `docs/adaptation-refinement/normative-adaptive-dialogue-architecture.md`,
  `services/tutorStubEdgeTimingPolicy.js` (stub world spine).
- `workplan/items/adaptive-warrant-contract-redesign.md` and its successor
  card (the live normative line — coordinate, do not touch).
- `notes/2026-08-16-edged-register-calibration-draft.md` (the paused
  edged-register line in `../ms-edged-register`; its Stage-0 build will
  touch the id-director side — coordinate before changing shared
  services).

## Rules for this line

- Design work only; nothing registered, armed, or run.
- Commit in this worktree; never push without a human ruling.
- Board views (`workplan/BOARD.md`, `workplan/board.json`) are never
  committed on this branch.
