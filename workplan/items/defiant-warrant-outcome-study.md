---
id: defiant-warrant-outcome-study
title: "Defiant-learner warrant arc: does serving the frame's warrant settle the frame and unblock the proof?"
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-08-29
updated: 2026-08-29
verification: >-
  A committed registration names the arms, the endpoints, the fidelity
  floors, and the spend ceiling before any paid call. The Gate-1 pilot
  runs only on the operator's plain GO; its measured baselines freeze the
  main-block thresholds; the main block runs only on a second GO. Results
  land in paper-full-2.0.md under its claim discipline, and all paid
  artifacts pass npm run archive:runs into the private archive repository.
claim_status: planned
depends_on:
  - adaptive-warrant-outcome-study
  - resistance-action-register-integration
links:
  notes:
    - docs/adaptation-refinement/2026-08-29-defiant-warrant-outcome-design.md
    - docs/adaptation-refinement/new-learner-profiles-bored-defiant.md
    - docs/tutor-stub-resistance-axis-heldout-registration.md
  items:
    - adaptive-warrant-outcome-study
    - resistance-action-register-integration
    - resistant-learner-strategy-close
tags:
  - tutor-stub
  - warrant-gate
  - resistant-learners
  - frame-defiance
  - pre-registered
---

## The question

The warrant arc so far: the passive-learner study closed scope-bound
(paper §6.25) and the overconfident-learner study closed positive
(§6.26). The 2026-08-16 design doc named two further learners, bored and
defiant, as designed only. The bored move line is closed — five
registered boredom studies, no claim, no further paid call authorized
under that line. The defiant side is the one still open.

The sealed held-out baseline (2026-08-19, instrument gate PASSED) shows
what the defiant learner actually does: in all 24 sealed turns it pairs a
jurisdiction dispute with a bounded merits engagement, and in almost
every turn it asks the tutor for the warrant of the frame itself — "what
makes this assay's frame binding?" The learner runs a standing warrant
demand at the tutor. No sealed dialogue ever settles the frame (0/3).

So the study question is the inversion of §6.26: there the tutor demanded
warrants from the learner; here the learner demands them from the tutor.
Does a tutor that serves the frame's warrant — states what the test can
and cannot establish, and offers the frame as conditional — settle the
frame and unblock the proof, against a tutor that presses the assigned
test without grounds?

## Why the channels have room

- Frame settlement: baseline 0/3 dialogues. The persona contract forbids
  conceding merely to a re-explanation, but allows one full repair per 8
  turns — so the channel can move and is not pinned open or shut.
- Strict-DAG coverage at turn 8: the contract expects coverage
  "blocked_until_frame_distinction", so the arm that draws the
  distinction should show more machine-checked coverage. No reader sits
  in this channel.
- Dead channels, not registered: per-turn dispute rate and merits
  engagement are both near ceiling in the sealed baseline (24/24 turns);
  first-merits-engagement turn is always 1-2. These are descriptive only.

## Boundaries

- Learner is `frame_defiant` only. The `frame_refuser` cards
  (refusal-narrowing, satisfiable-condition) belong to another session
  and share no driver, endpoint, or persona with this card.
- The closed warrant-outcome driver takes no new profiles (amendment
  2026-08-18). This study gets its own small treatment seam and its own
  registration.
- Authorization follows the 2026-08-21 hard rule: this registration plus
  a spend ceiling; the operator's plain GO covers the study; a code-defect
  fix never voids it; provenance is recorded, not enforced. No digest
  machinery, no freeze/void cycles.
- Never nemotron/kimi. Generation on codex.gpt-5.6-luna; any reader seat
  on claude-code Sonnet 5, unless the operator rules otherwise.

## Critical path

- P0 (zero-call, done in draft): baseline read of the sealed held-out
  frame_defiant traces; channel-room findings recorded in the design note.
- P1 (zero-call): build the warrant-serving / warrant-withholding
  treatment seam on the tutor-stub field policy; mock smoke; delivered
  conduct is read from tutor text, never from arm assignment.
- Gate 1 (paid, after plain GO): calibration pilot, 18 dialogues
  (2 arms x 9), 8 turns, world 005 Marrick, strict DAG, fresh seed.
  Measures baseline endpoint rates and delivered-conduct fidelity.
  Ceiling: 864 generation attempts plus a bounded reader budget.
- Gate 2 (paid, after second GO): powered main block sized from Gate-1
  numbers, under the design doc's per-profile cost shape.
- Closeout: paper section under the claim discipline, archive:runs,
  private-repo commit.

## Log

- 2026-08-29: Card opened on operator instruction ("pick up the
  defiant-learner warrant arc"). State surveyed: instrument gate passed
  2026-08-19 (dispute 14/24 = 0.583 over the 0.40 floor, by turn 2,
  specificity clean); outcome side never designed past the profile doc.
  P0 baseline read done from the archived sealed traces (zero calls).
  Draft registration committed for human review. No paid call until the
  operator's GO.
- 2026-08-29: Operator gave the plain GO. P1 built zero-call: design JSON
  (`config/tutor-stub-defiant-warrant-outcome-pilot.v1.json`), study
  module (validate / plan / conduct card / configure with launch-pin
  drift guard), standing conduct-card seam in tutor turn preparation
  (manner-switch-card pattern, permission-shaped), CLI args + dispatch,
  launcher `scripts/run-tutor-stub-defiant-warrant-pilot.js`
  (preflight / live / analyze; provenance recorded, never enforced),
  conduct codebook, 10 unit tests green. Wiring smoke: preflight passed
  zero-call; a deliberately drifted stub launch failed closed naming
  every drifted pin before any model call. Next: attended Gate-1 launch.
- 2026-08-29: Gate-1 pilot ran to completion (destination
  `.tutor-stub-auto-eval/defiant-warrant-gate1-2026-08-29-r3`, archived).
  Three launches: two died on zero-cost launch-guard defects (eval-repeat
  base, host-rewritten profile arg, equality budget pin on recovery
  attempts — all fixed with tests, commits 6cabdb7d/0789d6ce/a7c3392f);
  one was killed from outside as a session-tied background task. Rebuilt
  as a detached launcher with a death-note log and a --resume mode that
  replays the spend ledger and adopts orphaned attempts. Final state:
  16/18 dialogues terminal, 527/864 reservations, 2 unresolved (budgets
  consumed by interruptions, not resampled). Ledger-replayed dialogues
  now measured from on-disk traces (a2760afc).
- 2026-08-29: Sonnet conduct-reader pass ran per the codebook: 110/110
  turns coded, 0 reader errors, 110/400 calls. Delivered-conduct
  fidelity: warrant_serving 8/8; warrant_withholding 0/8 (7 delivered as
  serving, 1 mixed). The withholding conduct card was injected but the
  tutor model takes the standing question up anyway — instruction cannot
  subtract the model's default warrant-serving conduct. Gate 1 therefore
  STOPS: no threshold freeze, no main block on these numbers. Endpoint
  direction (settlement 2/8 vs 1/8; coverage 0.042 vs 0.021) is
  uninterpretable without a delivered contrast.
- 2026-08-29: Operator chose the structural path: enforce withholding in
  the stub machinery (move/constraint seam), not by louder instruction.
  Design v2 + re-run to follow.
