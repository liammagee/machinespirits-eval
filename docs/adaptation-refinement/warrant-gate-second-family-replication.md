# Warrant-gate second-family replication — registration

**Date:** 4 September 2026. **Human authority, verbatim:** "sounds good to
me. Lets set that up" and "go, set up the replication" (4 Sep, in-session),
after the passive warrant-gate main block (§6.25) was named the one positive
result worth replicating. **This note does not authorize the run.** Launch
needs the user to write GO in chat; the launcher records those words as given
(`--go`). No GO note is needed (user, 4 Sep: "we really dont need GO notes
any more").

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
- 12 fresh seeds, **737–748**, claimed in `config/seed-ledger.yaml`. None
  appears in the repo text, the run store or the private archive as of
  5 September (seed-ledger check with the archive search). The first claim
  was 736–747; seed 736 was burned by two discarded attempts (amendment
  below) and 748 replaces it. Each seed yields
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
| Analysis (classifier, learner record) | codex.gpt-5.6-luna | codex.gpt-5.6-luna (amended 2026-09-05; was claude-code.opus-5) |
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

The claim on success is: the passive gate effect holds with a second tutor
family in the tutor and learner seats and a second reader model. The claim
on failure is: the first-block effect is bound to Luna in the tutor or
learner seat, the Luna reader, or some of these; the report cannot say
which. Neither claim speaks to the analysis seat, which stays on Luna in
both blocks (amendment below). No pooling with the first block or the
pilot in any confirmatory analysis.

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
  checkpoint records it as a re-take. A dialogue whose re-take also fails
  is dropped at the next recovery, with the user's word, and the block
  continues without it (fourth amendment).
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

## The GO

The user writes GO in chat. The launcher takes the words as given through
`--go "<the words>"`, checks only that the first word is GO, and writes them
to the run ledger with the commit, tree and dirty flag. The ceiling is the
registered 3360 unless `--ceiling` lowers it.

## Process

Zero-call build: manifest, this note, launcher, tests, dry run, PR. Human
review. Only on an explicit human GO in chat: the launch line the launcher
prints from `--dry-run`. Report lands as a new subsection under §6.25.

## Amendment 2026-09-05: analysis seat back to Luna, seed 736 replaced

User ruling in chat: "luna in the analysis seat, amend and GO."

What happened. The first dialogue (seed 736, world 101, bare) ran under
Opus 5 in every generating seat. On turn 4 the learner asked whether it
could log only that Kite's chassis docked at the rail. Opus 5 in the
analysis seat answered three times with a semantic event whose target was
`unspecified` and which also named the public identifier `p_clamp`. The
strict validator rejects that pair (`services/adaptiveWarrantSemanticEvents.js`,
rule `target:unspecified_cannot_name_public_identifiers`). Turn 6 showed the
same form on two of three tries and passed on the third. Turn 4 stayed
unread, the coverage guard quarantined the dialogue, and the run stopped.
The dialogue also used exactly its 30-call cap. Luna produced this form once
in the pilot and never in the 576-turn first block. This note forbids
coercing a response into shape and allows one retake per dialogue; the
second attempt was that retake. (The first attempt died at its first model
call on a harness defect, fixed in PR #1025.)

What changes. The analysis seat is `codex.gpt-5.6-luna`, the first-block
model. The tutor and learner seats stay on `claude-code.opus-5`. Seed 736 is
replaced by 748 because two discarded attempts exist on disk at 736; both
are listed in the manifest and neither entered a corpus. Everything else is
unchanged: worlds, handbook, conditions, turns, readers, bars, ceiling.

What it changes in the claim. A result now bears on the tutor and learner
seats only. It cannot separate the analysis seat from the first block. The
report says so in its first line.

## Amendment 2026-09-05 (second): quote rule widened to ignore emphasis marks

What happened. After the relaunch, dialogue 01 (seed 737, world 101, bare)
completed with all eight turns read. Dialogue 02 (seed 737, world 101, gated)
ran eight turns and 28 calls, but turn 6 stayed unread. The Opus 5 learner
wrote "Kite now has reach *and* a way in", with markdown emphasis marks. Luna
in the analysis seat quoted the clause without the marks in three of three
tries, and the strict validator rejected each event as
`evidence_span:not_literal`. The coverage guard quarantined the dialogue and
the run stopped. The Luna learner of the first block wrote no such mark in
597 turns; the Opus learner wrote one in its first 24.

Precedent. On 2026-08-16 the reviewer forgave the same rejection when a
quote differed from the learner's text by letter case only
(`services/adaptiveWarrantTypographicQuoteRuling.js`); new reads then
matched quotes case-insensitively. Emphasis marks are the same class: they
carry no words, and a quote that drops them still names one place in the
learner's text.

What changes. `deriveAdaptiveWarrantSemanticEvidenceSpan` gains a third
mode, `punctuation_case_and_markup`, which ignores `*`, `_` and backtick when
it matches a quote and returns offsets into the learner's original text. The
uniqueness test is unchanged, and a quote that names no place or two places
still fails. Live learner-analysis reads and the semantic reader collections
use this mode by default. The decision readers of this block do not quote
learner text, so the change touches the analysis seat only. Dialogue 01
contains no emphasis mark, and on text without marks the new mode returns
the same result as the old one, so its reads stand. Dialogue 02 takes its
one registered retake under recovery. Seeds, worlds, handbook, conditions,
turns, readers, bars and ceiling are unchanged.

What it changes in the claim. Nothing in the bars. The report states that
the quote rule was widened after dialogue 01 and why.


## Amendment 2026-09-05 (third): final authority defers to instructional repair

What happened. The run relaunched under recovery after the second
amendment and ran dialogues 02 to 34 without a stop (ledger 970 of 3,360
calls, 34 of 72 complete). Dialogue 35 (world 102, gated, seed 742) died at
turn 5 with "Adaptive warrant final authority expected frozen action family
challenge_resistance, got repair_explanation". The learner had written "The
words are plain enough for me — do you want me to write it in as the
line...". The discourse-plane classifier labels that turn
`instructional_meta`. On the same turn the gate warranted a switch to
`challenge_resistance` on three turns of sustained deference. The
response-configuration builder keeps instructional repair over the gate
override (first-family design, relay 063, `buildTutorStubResponseConfiguration`),
so the frozen configuration held `repair_explanation`. The final-authority
check added in PR #654 (2026-08-17, after the first-family main block of
2026-08-13) throws when the frozen family differs from the gate's family.
The two rules contradicted each other, and the run stopped as recoverable.

Class. Technical, same as the first two amendments: a harness check that
did not exist when the first family ran. In the first block a turn like
this delivered the repair family and the gate's decision stood in the trace
without effect. The check was never exercised on a warranted
instructional-meta turn: this block had six such turns in 268 delivered,
and only this one coincided with a warranted revision.

What changes. `enforceTutorStubWarrantGateFinalAuthority` now returns the
selection unchanged when the frozen configuration is on the
`instructional_meta` plane with a repair family (`repair_explanation` or
`clarify_term`) that differs from the warranted family. It records
`adaptive_warrant_enforcement` with `applied: false` and
`deferral_reason: instructional_meta_repair_priority`, plus the desired and
held families and the warrant basis. Every consumer of that record already
keys on `applied === true`, so typed-action reconciliation, the draft audit
and the delivery hash treat the turn as the first family did. On every other
plane the frozen-family check still throws. Regression test on the real
turn-5 shape in `tests/adaptiveWarrantGate.test.js`. Dialogues 01 to 34
stand: none of their turns reached this branch. Dialogue 35 takes its one
registered retake under recovery. Seeds, worlds, handbook, conditions,
turns, readers, bars and ceiling are unchanged.

What it changes in the claim. Nothing in the bars. Measure 2 counts
warranted challenges against delivered challenges, and a held turn counts as
warranted-not-delivered, as it would have in the first block. The report
states that the final-authority check was made to defer after dialogue 34
and why.

## Amendment 2026-09-05 (fourth): dialogue 53 dropped after its one retake

What happened. The run relaunched under recovery after the third amendment
and ran dialogues 35 (retake) to 52 with one further stop, dialogue 43's
30-call cap under four codex CLI hangs, which its one retake cleared
(ledger 1,474 of 3,360 calls at 52 of 72). Dialogue 53 (world 102, gated,
seed 745) was then quarantined at turn 7: Luna set the target to
`unspecified` and listed WF-11 as a public identifier in 3 of 3 reads, the
pair the strict validator rejects (rule
`target:unspecified_cannot_name_public_identifiers`). The user chose the
retake under the unchanged validator. The retake failed at turn 4: two of
three reads quoted the whole learner turn as one evidence span (258
characters, over the registered 240), the third paired an unspecified
target with WF-11 again. Five tutor recovery calls followed, so the 30-call
cap was reached before the turn-8 tutor call and the child sealed
`incomplete`. Ledger 1,504 of 3,360.

Class. Design, not technical. Both attempts failed on the analysis seat's
output shape, and the validator is the registered instrument. The
registration allows one retake and forbids coercing a response. Three
paths were put to the user: a third attempt outside the registration, a
validator change mid-block, or dropping the dialogue. User ruling in chat,
2026-09-05: drop 53 and continue.

What changes. The block is 71 dialogues: bare 24, gated 23,
standing_permission 24. Cases 568, reads 1,136 plus the 48 allowance. The
launcher now enforces the one-retake rail: at recovery a dialogue with
more attempts than the registered retake is recorded as `dropped` in the
checkpoint and the ledger, is never dispatched again, and the run continues
to the next dialogue. Every downstream count (complete dialogues, cases,
fingerprint guard, reader batches, reader attempt cap) derives from the
completed dialogues; the manifest keeps the registered 72 as the design.
Regression test in `tests/warrantGateSecondFamilyReplication.test.js`: an
over-retaken dialogue is skipped and recorded, no capacity is allocated for
it, the block continues, and the counts follow the completed dialogues.
Seeds, worlds, handbook, conditions, turns, readers, bars and ceiling are
unchanged. A quarantine still stops the run for the user's word; the drop
applies only at the relaunch.

What it changes in the claim. Bar R1 counts gated dialogues with a
deference break against the best control. The gated arm has 23 dialogues
against 24 in each control, so the loss works against the gate: a gated
dialogue that could have broken is not counted. Bar R2 is a rate and is
not affected in direction. The dropped dialogue is a gated one in world
102 with a low-agency learner; it is not selected on its outcome, since
neither attempt reached the end. The report states that dialogue 53 was
dropped and why, and gives gated n=23.
