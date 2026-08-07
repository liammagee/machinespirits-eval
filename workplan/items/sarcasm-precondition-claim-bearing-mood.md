---
id: sarcasm-precondition-claim-bearing-mood
title: Sarcasm precondition — does a mood target block the manner because it offers no claim?
status: done
type: experiment
priority: P3
owner: claude
source: manual
created: 2026-08-07
updated: 2026-08-07
verification: A 16-row run reports, off one gate and one fold, whether the tutor held the sarcastic manner more often when the learner supplied a negatable claim alongside the mood; the manipulation check (did the tutor name a claim) gates the primary verdict, and person-attack violations stay separate from non-instantiation. Any claim lands in paper §6.7 first.
claim_status: exploratory
links:
  notes:
    - notes/2026-08-07-sarcasm-precondition-preregistration.md
    - notes/2026-08-06-sarcasm-determinate-negation-preregistration.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-05-87fe3664
    - eval-2026-08-06-4de45d05
    - eval-2026-08-07-e3dffab2
  items:
    - sarcasm-determinate-negation-grid
    - negative-register-effect-estimation-grid
    - eval-db-writer-reader-path-split
depends_on:
  - sarcasm-determinate-negation-grid
tags:
  - registers
  - negative-registers
  - stance-fidelity
  - determinate-negation
---

Follow-up to the determinate-negation grid's one real finding. Held to one
gate and one fold, the tightened sarcasm contract left fidelity flat (7/15
against the parent's 8/15) but moved *where* the manner survives: on
affective targets it went 5/6 → 0/6, on content-shaped targets 3/9 → 7/9.
Post hoc on thirty rows, so a hypothesis.

The hypothesis this run tests: the determinate contract asks the tutor to
name a learner claim and negate it. When the learner's resistance is a mood
— bored, frustrated — the only claim on the table is about the learner's own
state, and negating that is the person attack the same contract forbids. The
two halves of the contract conflict, and the tutor drops the manner.

If that is the mechanism, the fix is on the learner's side, not the tutor's:
give the bored learner something to *assert* alongside the mood, and the
manner should come back. The tutor's rule does not change at all in this run
— it still demands both the manner and a named target claim. What changes is
whether the learner supplies content that can be negated without attacking
the person.

Design frozen in the linked pre-registration note. One cell (202,
unchanged), four scenarios — boredom and frustration, each plain and
claim-bearing — four repeats, 16 rows, parent stacks and judges unchanged.
Every registered measure reads off one source at one fold, which is the
structural lesson of the parent's correction.

2026-08-07 Claude: Apparatus built and validated, zero paid rows. Two
claim-bearing scenarios added (each inherits its mood parent's persona and
resistance signal, adds `claim_bearing_resistance: true`, and puts one flat
claim about the material in the learner's opening — worded to avoid the
content-shaped targets' own vocabulary so the manipulation cannot smuggle in
irrelevance or rote-parroting). `CONTROLLED_SCENARIOS` in the matrix
reporter widened to 7 — that list is the reporter's SQL row filter, so the
ratchet test now names the new ids rather than only counting them. Plan
module, frozen launcher and 15 tests; Fisher exact extracted to
`services/fisherExact.js` so the two reports on this arc cannot drift into
disagreeing statistics. Dry-run plan SHA-256
6e57b44561bf290de4285554559bd98f74184abd010403321b8abc0683d42ebd (16 rows,
launch locked). Paid run gated on fresh operator authorization bound to that
SHA.

2026-08-07 Claude: Run `eval-2026-08-07-e3dffab2`, attended, operator-authorized
against that SHA on clean commit `81f465e4`. **Returned 14 of 16 rows** — two
attempts failed with "Ego returned empty content" on `turn_2_breakthrough_probe`,
one in plain boredom and one in claim-bearing boredom. Not restarted, not
widened. Counts by mood stayed balanced (boredom 3/3, frustration 4/4) but the
registered 8-vs-8 became 7 vs 7. The report fails closed at INCOMPLETE and names
both missing cells. Tutor v2.2 scored 14/14 (`claude-code/claude-sonnet-5`, mean
55.9); register rubric 26 slices, 0 failures (`claude-code.sonnet-5`).

**Verdict: inconclusive**, and the instrument is the finding. Checking the arms
against the parent run showed the `sarcastic_determinate` gate passing turns with
no sarcasm in them: it re-weights the register marker 35 → 25 to make room for
the named-target-claim component, the faithful band stays at 70, so a turn
missing only the marker scores 75 and was labelled `faithful`. There is a forcing
rule for a missing claim and none was ever written for a missing marker —
necessity had been left to arithmetic that the re-weighting repealed. Four of the
fourteen rows passed that way. Across the run, passing tracked the named claim
exactly (11 named and passed, 3 unnamed and failed) and had no relation to the
marker at all, so the measure registered as "held the manner" was measuring
"named a claim".

Repaired in `services/registerStanceFidelity.js`: both gates now require the
marker as a stated rule. Two tests pin it in
`tests/sarcasmDeterminateGateProvenance.test.js` — a real marker-less 75-scoring
turn from this run must not be faithful, and every passing row in the
decomposition export must carry the marker. Arms read 3/7 (plain mood) vs 4/7
(claim-bearing) repaired, and 6/7 vs 5/7 as the run actually scored — one row
apart in opposite directions, Fisher p = 1.0 either way. Neither supports nor
refutes the hypothesis; it stays open and needs a fresh design on the repaired
instrument, not a re-read of these rows.

The repair moves one published figure. The plain-gate headline of the parent grid
is untouched (8/15 vs 7/15 — the marker requirement always held there by
arithmetic), but the determinate column of the gate-sensitivity check falls from
8 and 7 to **3 and 5**, so v3.0.269's "both gates rank the arms identically" is
withdrawn. That column was never a valid robustness check anyway: requiring a
named claim *is* cell 202's treatment, so it grades the parent arm on a contract
the parent never received. Paper v3.0.270 (§6.7 new paragraph, §8.9 two scope
conditions, revision entry, superseded claims marked in place).

Operational note: the run's rows landed in the worktree-local
`data/evaluations.db` while every reader resolves the shared archive — see
`eval-db-writer-reader-path-split`. Rows and the 124 score-audit rows were copied
across; dialogue logs were unaffected.
