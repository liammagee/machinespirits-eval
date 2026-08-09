---
id: learner-profile-world-deconfound
title: "Deconfound the learner-profile recovery: cross personas and worlds"
status: active
type: experiment
priority: P1
owner: codex
source: manual
created: 2026-08-06
updated: 2026-08-09
branch: codex/learner-profile-world-deconfound-paid-launch
verification: "PR #605's green clean-main certificate pins the approved design,
  exact qd-v1, and frozen 20-job plan. Paid launch remains separately gated on
  an explicit authorization flip and attended checkpoints. Completion then
  requires all 20 new dialogues with no historical pooling, a committed private
  archive before outcome reading, and identical leave-one-out persona and world
  readings against the frozen 80% bar."
claim_status: methods
links:
  config:
    - config/learner-profile-world-deconfound.yaml
    - config/learner-profile-recovery-l1.json
  code:
    - scripts/review-learner-profile-world-deconfound.js
    - scripts/replay-learner-profile-recovery-l1.js
    - scripts/prepare-learner-profile-world-deconfound.js
    - services/tutorStubQuietDetectorV1.js
    - tests/learnerProfileWorldDeconfound.test.js
    - tests/learnerProfileRecoveryL1.test.js
    - tests/learnerProfileWorldDeconfoundPlan.test.js
  notes:
    - notes/2026-08-03-adaptive-causality-living-log.md
  paper:
    - docs/research/paper-full-2.0.md#624-the-four-locks-why-nothing-beat-the-bare-tutor-and-what-opened-when-each-was-removed-post-hoc-except-the-claim-gate-development-tier
  items:
    - adaptive-causality-crossed-effects
    - enforce-tutor-stub-artifact-lifecycle
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/603
    - https://github.com/liammagee/machinespirits-eval/pull/605
tags:
  - tutor-stub
  - learner-profiles
  - deconfound
  - prereg
---

# Deconfound the 88% learner-profile recovery

The living log's most repeated caveat, still open after the arc closed:
conduct-derived state-frequency profiles classify the two authored
personas at 88% leave-one-out by turn six (bar 80%; paper §6.24, phase
L1) — but each persona is paired with one world. The record-keeper lives
in the assay world (world-033, alder row redoubt) and the quietly
resistant tenant in the flat-share world (world-030, rowan flat), so the
classifier may be reading the learner's pattern, the world's content and
schedule, or their interaction. The log's own rule: a learner profile
counts as transportable only if it can be recovered across crossings.
This card runs the recovery half of that rule. Routing moves by
recovered profile across crossings is explicitly out of scope — a
follow-up card if recovery passes, per the reuse rule.

## Design (to freeze before any paid call)

**D1 — transplant the personas (free, authoring).** Adapt each persona
brief to the other world: surface only (names, scene roles, domestic
detail); the authored conduct disposition — what the persona presses on,
concedes to, or goes quiet about — stays untouched. User adjudicates
both transplants before any run, as R1's re-authored directives were.
Option, decided at freeze: a third authored persona in one existing
world, the log's strongest version of the test.

**D2 — the prospective balanced cells (paid, attended, local).** Both
personas in both worlds, k=5 dialogues per cell (20 paid dialogues).
This regenerates the two source-world cells beside the two crossed cells,
so all four cells share one source revision and runtime. Frozen baseline
full stack from the manifest, same seats as the earlier crossed experiment
(sonnet speaking, terra learner), worlds on their ratified schedules,
delivery verified in shipped prompts before any outcome is read. No
detector, card, or schedule changes — the instrument must meet the new
cohort unchanged. Before closeout, archive the completed light artifacts and
trace bundle outside ignored `exports/` with the repository's run-artifact
archiver.

**D3 — the recovery reading (free, replay).** Replay the standing
profile instrument (trigger plus exact qd-v1 quiet detector, per-dialogue
state-frequency estimates) over the prospective cohort only; leave-one-out
classification of PERSONA across all four cells, with the identical classifier
run against WORLD as a diagnostic. Historical dialogues are not pooled.

**Readings, fixed now.** Persona recovered across worlds at or above the
original 80% bar = the signal travels with the learner pattern;
transportability claimed within scope (two personas, two worlds,
simulated learners). Classification tracking the WORLD instead = the
88% re-reads as a world artifact; the paper's L1 claim gains that bound
with the same prominence as the original number. Partial or
interaction = reported as the measured bound, unspun. Whatever the
branch, per-cell state-frequency profiles are published beside the
classification so the basis of the verdict is inspectable.

**Cost and venue.** Exactly 20 paid dialogues plus free replays; attended;
runs in a local session (the CLI bridges and recorded artifacts live there).
The paid launch needs explicit operator authorization after the delivery plan
is verified, like every paid run since the grid.

**Limits, stated now.** Simulated learners; one tutor stack; two
authored personas (three at most); transplanted briefs are adaptations,
not new blind authoring; no human-learning claim. A pass licenses the
publication closeout's crossed holdout design, not a routing policy.

## Log

- 2026-08-09 — Activated in an isolated worktree from post-PR-#588 main. The
  first slice is free design work only: locate the two ratified source persona
  briefs, author surface-only cross-world transplants, and expose the exact
  diff for user adjudication. No model call or paid run is authorized.
- 2026-08-09 — Recovered the exact private briefs from the sealed August
  traces, froze both originals, and authored the record-keeper-in-Rowan and
  tenant-in-Alder transplants. Each cell also overrides the target world's
  public learner voice so the original world-specific persona cannot leak back
  into the learner prompt. A zero-model review command validates the 2x2
  crossing, five repeats per new cell, model seats, schedules, source-surface
  exclusions, 80% reading, pending human adjudication, and absent paid
  authorization. The proposed scope omits a third persona: the full 2x2 already
  breaks the original confound and keeps the first run to ten dialogues.
- 2026-08-09 — Provenance audit found that the original 88% L1 reading used
  pressure trigger v4 plus quiet detector qd-v1, while the current tree contains
  qd-v2. The design now pins qd-v1 and both source commits and makes exact-v1
  restoration plus reproduction of 56/64 an explicit pre-certificate gate.
  Merging this design does not itself make the paid experiment launch-ready.
- 2026-08-09 — After reviewing the zero-model design output, the user approved
  both exact transplanted persona briefs and their public learner-voice
  overrides, and confirmed omission of a third persona. The approved prompt
  and voice hashes are now frozen in the design. Paid authorization remains
  absent; the next gate is exact qd-v1 restoration and 56/64 reproduction.
- 2026-08-09 — Restored qd-v1 byte-for-byte from both named source commits
  (matching SHA-256 `318da00f…6c4`) and converted the recovered scratch command
  into a tracked, zero-model, fail-closed replay. The historical console output
  is recoverable (56/64 overall; 50/64, 49/64, 51/64, 54/64, and 53/64 at
  2/4/6/8/10 turns), but the ignored vector JSON and original 64 trace files
  are absent from the current checkout and local artifact searches. Therefore
  the original result has not been independently reproduced: raw-trace recovery
  remains a pre-certificate gate, and no paid call is authorized.
- 2026-08-09 — Exhausted the practical recovery paths: no local checkout,
  Trash/CloudStorage/Spotlight result, Time Machine data snapshot, remote
  instrumentation/archive ref, or GitHub Actions artifact contains the missing
  corpus (Actions retains only `risk-coverage`). The missing data also made the
  planned old-plus-new final reading impossible. At the user's direction to
  unblock what is possible, replaced that dependency with a prospective
  balanced 2x2: both personas in both worlds, five dialogues per cell, all
  generated under one source/runtime and analyzed without historical pooling.
  The historical 56/64 remains provenance-attested motivation for the frozen
  80% bar, not a rerun or cohort input. This doubles the prospective scope from
  10 to 20 dialogues; it does not authorize any paid call.
- 2026-08-09 — Added the zero-model prospective launch-plan builder. It derives
  one world overlay per cell so the approved public learner voice replaces the
  canonical world's persona voice, pins the matching private brief, expands
  five deterministic jobs per cell, preserves the Sonnet/Terra/Sol seats and
  metered admission, and can dry-run one job from each cell to prove delivery.
  The builder has no paid launch mode and reports `not_authorized` throughout.
- 2026-08-09 — Prepared the prospective draft plan and passed delivery checks
  for all four cells (20 unique jobs total). Each dry-run resolved the intended
  world and model seats, carried the exact private brief in the session recipe,
  exposed the frozen public learner voice in the world prompt, and passed
  metered research-use admission. No provider call ran. The free apparatus gate
  is complete; the remaining sequence is merge, clean-main certificate, then
  separate authorization for the 20-dialogue paid cohort.
- 2026-08-09 — Integrated the newly merged run-artifact safeguard into the
  frozen plan: a completed cohort cannot be closed out while its primary traces
  remain only under ignored `exports/`. The plan names the exact archive script
  and requires both the light artifacts and compressed traces to be preserved.
- 2026-08-09 — Picked up in the Claude session at the user's direction; the
  user re-read both transplanted briefs there and approved both unchanged,
  ratifying the recorded adjudication. One provenance fix on the way to merge:
  the two pinned qd-v1 source commits were wrong — neither 0ee6b9c2 nor
  e86a2d66 contains the detector file at all. The true span is 146a7b21
  (creates qd-v1, 2026-08-01) through 8e2addab (last commit carrying the
  qd-v1 bytes before the qd-v2 flip at a98d9c56). The frozen artifact was
  checked byte-identical against both true commits, so the restoration
  stands; only the recorded pins move, in the design YAML and the replay
  manifest. Tests 11/11 and the replay's fail-closed corpus report were
  re-run after the transfer.
- 2026-08-09 — Apparatus merged as PR #603; clean-main certificate generated
  at `50ccfcd0` and tracked as
  `config/learner-profile-world-deconfound-certificate.json`. On that SHA
  with a clean tree: the three suites 11/11, design review exits 0, the L1
  replay fails closed on the 18 absent corpus locations as designed, and the
  delivery dry-run prepares all 20 jobs and verifies delivery in all four
  cells with no model call (plan hash `7fbb5fe9…`). The certificate pins the
  qd-v1 artifact, replay manifest, design file, and the four approved
  brief/voice hashes. The one remaining gate is the user's separate
  authorization of the 20 paid dialogues.
- 2026-08-09 — Confirmed PR #605 merged with every reported check green, then
  started the paid-launch slice in a fresh `origin/main` worktree (the older
  dirty worktree was not reused). Added a fail-closed `--run-paid` mode: it
  accepts only the one-line `paid_authorization: authorized` flip, reads the
  certificate from tracked HEAD bytes, rechecks the certified design, qd-v1,
  replay-manifest, approved brief/voice hashes, exact `7fbb5fe9…` frozen-plan
  identity, 20-job balance, and Sonnet/Terra/Sol seats, then repeats all four
  delivery dry-runs before any paid call. Jobs run serially under a mandatory
  `--checkpoint-every` bound with durable pre/post-job state; an interrupted or
  failed in-flight job refuses automatic retry, and every resume is bound to
  one committed runner-source SHA with no tracked dirt permitted beyond the
  authorization file. The current mandatory live
  redacted-trace mirror is retained as a post-certificate safety transport,
  while the manifest separately records the certified and materialized hashes.
  Authorization remains `not_authorized`; no paid dialogue or outcome reading
  occurred in this slice.
