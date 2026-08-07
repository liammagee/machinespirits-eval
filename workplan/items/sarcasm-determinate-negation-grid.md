---
id: sarcasm-determinate-negation-grid
title: Sarcasm as determinate negation — cargo-bearing cue contract
status: done
type: experiment
priority: P3
owner: claude
source: manual
created: 2026-08-06
updated: 2026-08-08
verification: A 15-row run (or an explicit drop decision) reports fidelity vs the parent sarcasm arm, faithful-row conversion, and negation recovery, with exclusions and invalid violations separate; any claim lands in paper §6.7 first.
claim_status: exploratory
links:
  notes:
    - notes/2026-08-06-sarcasm-determinate-negation-preregistration.md
    - notes/2026-07-26-negative-register-effect-estimation-preregistration.md
  paper:
    - docs/research/paper-full-2.0.md#67-architectural-extension-the-id-director-family-and-charismatic-pedagogy
  runs:
    - eval-2026-08-05-87fe3664
    - eval-2026-08-06-4de45d05
  exports:
    - exports/sarcasm-determinate-negation-grid/eval-2026-08-06-4de45d05.json
  items:
    - negative-register-effect-estimation-grid
depends_on:
  - negative-register-effect-estimation-grid
tags:
  - registers
  - negative-registers
  - stance-fidelity
  - determinate-negation
---

Follow-up to the negative-register effect grid. The grid found sarcasm holds
its assigned manner most often (8/15 faithful) and converts least (5/8
positive; 0 positive on its faithful question-flood and rote-parroting
rows), while irony — the register that compiles into propositional moves —
both survives and converts. Working diagnosis: the sarcasm contract
enforces tone without cargo.

The proposal treats sarcasm as a double negation with a determinate target:
each sarcastic utterance must name a learner claim P and implicate not-P,
so the manner marker is the warrant for derived content. New measure:
negation recovery — does the learner voice the implicated correction?

Design frozen in the linked pre-registration note. One new cell (ID to be
allocated per registry discipline), five targets, three repeats, 15 rows,
parent-grid stacks and judges unchanged. Paid run gated on the standard
frozen-plan dry-run SHA plus explicit operator authorization.

2026-08-06 Claude: Card created with the design pre-registration; no cell
allocated, no code changed, no spend authorized.

2026-08-06 Claude: Apparatus built and validated, zero paid rows. Cell 202
allocated (registry ratchet bumped 205→206); new register
`sarcastic_determinate` + arm mapping in the stance registry; gate extended
with a named-target-claim signal that withholds the faithful label without
it (plain sarcastic scoring unchanged, test-pinned); negation-recovery
measure added (deterministic path + judge path) and the register scorer
persists stance + recovery per slice for this register only. Fixture
(8 hand-authored slices) passes 8/8 deterministic and 8/8 on the sonnet-5
judge path, including echo-is-not-recovery and paraphrase-counts. Frozen
launcher clones the parent discipline; dry-run plan SHA-256
b954b0dfe089f6d783bb34d825e8050686015425926638b1820cac07096c08d7 (15 rows,
launch locked). Fixture recalibration note: three authored slices first
failed the gate on move-verb wording and one expectation was corrected
(pure warmth = not_instantiated, not costume). Paid run remains gated on
fresh operator authorization bound to the dry-run SHA above.

2026-08-07 Claude: Paid run complete under operator authorization; report
COMPLETE at 15/15 rows. Run `eval-2026-08-06-4de45d05`, cell 202,
codex.gpt-5.5 in both generating seats, tutor rubric v2.2 and the register
rubric both judged by claude-code sonnet-5.

**Assigned** (all 15 rows, whether or not the tutor held the manner): tutor
v2.2 mean 54.92, register-rubric mean 66.85, positive local outcomes 11/15.

**Faithful** (rows where every determinate turn met the tightened contract):
6/15, of which 4 positive.

**Excluded for not instantiating the register: 9. Invalid person-attack
violations: 0.** The two counts stay separate; no row was excluded for an
attack.

**Negation recovery** (the new measure): all 6 faithful rows carry a verdict;
the learner voiced the implicated correction in 1. Co-movement with outcome
among faithful rows — recovered and positive 1, recovered and negative 0,
not recovered and positive 3, not recovered and negative 2.

Against the pre-registered estimands: (1) fidelity fell to 6/15 from the
parent sarcasm arm's 8/15, so demanding cargo cost manner-holding rather
than sharpening it — cross-run and unpowered **[WRONG — see the correction
entry below; the two counts came from different gates and different slice
folds, and like-for-like they are 7/15 and 8/15]**; (2) faithful-row conversion
4/6 against the parent's 5/8, flat within noise **[like-for-like 5/7 against
5/8]**; (3) the mechanism check is
uninformative rather than negative — one recovery event cannot say whether
recovery tracks outcomes, and three of the five faithful rows that never
recovered were positive anyway. Fidelity split by target: irrelevance 3/3
faithful, question_flood 2/3, rote_parroting 1/3, boredom 0/3,
frustration 0/3.

Deviations, all recorded rather than patched around: (a) on the first
register-scoring pass one slice's recovery judge hit the 600s ceiling and
wrote nothing; a second pass scored it, no plan or model change; (b) the
report crashed on first run because it treated the read-only database
opener as returning a handle when it returns a record — fixed; (c) the
registered positive-local-outcome measure was never wired into the report,
so both positive counters read a field nothing set and sat at zero while
the report still passed COMPLETE. Fixed by taking the verdict from the
parent grid's matrix reporter (the registered definition, zero model
calls), with a test that fails the report closed on a missing verdict and a
second test pinning the two classifications against drift. The numbers
above come from the repaired report and were cross-checked by hand against
the matrix reporter's own row verdicts.

Reading, held to the pre-registered boundary: fifteen rows, one register,
one stack, simulated learners only. On this stack the manner-as-content
proposal does not cash out behaviourally — naming the target claim did not
get learners to voice the correction — and the parent grid's sarcasm result
stands as a manner-only effect.

2026-08-07 Claude (correction): the "fidelity fell" reading above is wrong.
It differenced two numbers that were not comparable, in two ways at once.

*Gate.* `sarcastic_determinate` is not the plain `sarcastic` gate with a
requirement bolted on. It re-weights every component to make room for the
new one — register marker 35→25, target discipline 20→15, next move 20→15,
repair 15→10, named target claim 0→25 — so a turn that passes one gate is
not a member of the set that passes the other. *Fold.* The grid report
requires every register slice in a row to pass (about 1.8 slices per row);
the parent's 8/15 came from the matrix reporter, which scores the single
turn where the tutor adopts the register. The published comparison crossed
both lines.

Fixed by `scripts/analyze-sarcasm-determinate-gate-decomposition.js`, which
re-scores all 30 rows of both runs under both gates on one fold:

| | plain gate | determinate gate | named a claim |
|---|---|---|---|
| parent 197 | 8/15 | 8/15 [→ 3/15] | 8/15 |
| determinate 202 | 7/15 | 7/15 [→ 5/15] | 9/15 |

Fidelity is flat under the plain gate: 8/15 against 7/15. Conversion is 5/7
against 5/8. Assigned-arm positives 11/15 against 7/15, Fisher p=0.26 — not
separating.

**The determinate column above is wrong**, and so is the sentence that used
to follow it here — "both gates rank the two arms the same way, so the
ordering never depended on the gate". The determinate gate was admitting
turns that carried no register marker at all, because it re-weighted the
marker to 25 while leaving the faithful band at 70, so a turn missing only
the marker scored 75. Repaired, that column reads **3/15 and 5/15**, which
reverses the ranking. Found the next day by
[[sarcasm-precondition-claim-bearing-mood]], whose outcome entry has the
detail; withdrawn in the paper at v3.0.270.

The column was never a valid cross-arm check in the first place: requiring a
named target claim *is* cell 202's treatment, so scoring the parent under it
grades a control on a contract it never received. Everything else on this
card is computed on the plain gate and is unaffected.

What is real is a change in *where* the manner survives: boredom and
frustration go 5/6 → 0/6 (p=0.015), while irrelevance, question-flood and
rote-parroting go 3/9 → 7/9 (p=0.15). Chosen after seeing the data, six and
nine rows, two partitions of the same thirty — a hypothesis for a fresh
design, not a tested contrast.

Why the tighter contract could not move the total, across all 30 rows: the
register marker alone predicts every pass and every fail (present-passed 15,
present-failed 0, absent-passed 0, absent-failed 15), while the named target
claim is close to independent of the outcome (8/9/7/6). The failing turns
score 65 with the marker as their only missing component — they do the
target discipline, the next move and the repair path in an earnest voice.
The contract added a requirement that a turn can meet without holding the
manner, so meeting it exerts no pull toward the manner. Testability helps
when the model does not know what you want; it helps least when the test
passes without doing the thing.

Provenance repairs shipped with the correction, so this cannot recur: stance
verdicts are now computed for **every** negative register rather than the
determinate one alone (the parent arm stored none, which is why anyone had
to recompute from dialogue logs at all); every verdict carries `gateRegister`
and `gateVersion`; and `assertComparable` throws when two verdict sets
disagree on gate, version or fold. Seven tests in
`tests/sarcasmDeterminateGateProvenance.test.js`, including a source guard
against the single-register gating coming back. No new run, no re-judging,
no historical row rewritten — the recomputation is an export
(`exports/sarcasm-determinate-gate-decomposition.{json,md}`).

Paper: corrected in §6.7 and §8.9 at v3.0.269; the two superseded claims in
the v3.0.268 revision entry are marked in place rather than deleted.
