# lantern revise probe — cross-arm digest

Group `lantern-revise-probe` · world `world-002-lantern` · script `lantern-v001` · 2026-06-11.
Scoring plan fixed BEFORE either paid arm in
`notes/poetics/2026-06-11-act-bounded-learner-design.md` §6 (commit 846d530a) —
clean pre-registration, unlike the bounded-v2 pair's disclosed mid-pair fix.
Diagnostics computed by `lantern-revise-contrast.mjs` from each arm's `result.json` only.

Both arms: stage v2 (acts, min 3 / max 8 turns), bounded learner, decay
`{rate:0.75, graceTurns:1, maxConcurrent:2, startTurn:1, mutateShare:1.0, seed:1}`
on lantern's 5/10 mutable premises. ON = `--reconstruct`; OFF = default mechanisms.
Casting as bounded-v2: codex director/tutor/superego, Sonnet learner, Fable critic.

**The question** (§6): mutations don't self-announce (a false form sits on the
board as if true; deletions at least leave absences). Does the explicit theory
channel help the tutor catch and the learner retract false beliefs — the one
regime where explicit other-modelling retained a theoretical edge?

## Headline table (harness-ledgered quantities)

| quantity | ON (reconstruct) | OFF (default) |
|---|---|---|
| verdict | grounded_anagnorisis | grounded_anagnorisis |
| turns | 20/26 | 20/26 |
| act spans | A1[1-4] A2[5-10] A3[11-16] A4[17-20] | identical |
| forced → asserted gap | 0 (t20→t20) | 0 (t20→t20) |
| slips (mutate / delete) | 7 (5 / 2) | 6 (4 / 2) |
| **false-belief debts: opened / retracted / standing at end** | **5 / 5 / 0** | **4 / 4 / 0** |
| retraction latencies (turns) | 1, 8, 7, 1, 1 (mean 3.6) | 1, 1, 4, 1 (mean 1.75) |
| retraction context (move / restage / spontaneous) | 1 / 1 / 3 | 1 / 1 / 2 |
| fully revised (struck + restored) | 3/5 | 2/4 |
| false-form consequences in ledger (derive/adopt/voice on a false form) | none | none |
| deletion debts repaired (all tutor, all reach-backs) | 5/7 (2 open at end) | 4/6 (2 open at end) |
| mean repair latency | 4.4 | 3.75 |
| degraded integral | 29 | 30 |
| F final / min | 0.833 / 0.636 | 0.833 / 0.700 |
| D reversals / longest plateau (aporia window 6) | 2 / 2 | 2 / 3 |
| releases on cue | 8/8 | 8/8 |
| voiced / overreaches / lucky leaps | 3 / 0 / 0 | 3 / 1 / 0 |
| wall clock | 21.3 min | 18.0 min |

Exposure caveat (carried from §5): same seed ≠ same slip schedule once repairs
free `maxConcurrent` slots — ON drew one extra mutation. Compare economies,
not per-slip outcomes. The act spans, forced turn, and verdict turn are
nonetheless identical across arms — the closest to a matched pair the harness
has produced.

## ON-arm theory channel (reconstruction; arm-internal, per §6)

- Missing-detection: 12/37 (32.4%) — up from nocturne's 12.3% (smaller world,
  10 vs 13 premises).
- **Mistaken-detection: 2/17 (11.8%)** — the revise-relevant quantity, and the
  channel is nearly blind to exactly the slips that don't self-announce.
  Frame (ii)'s trigger ("materially above bounded-v2's 12.3%") is NOT met.
- Mean Jaccard(missing): 0.292.
- Theory→retraction coupling (k=3): 2/5 retractions preceded by the theory
  naming the premise mistaken — both on m_post, both AFTER the tutor's
  counter-mirror move at t14 had already targeted it (confounded with
  move-prompting). Converse: 1/2 caught instances retracted within 3 turns.

## The retraction story (what actually closed the false-belief debts)

Both arms retracted **100%** of false forms; the OFF arm did it *faster*
(mean latency 1.75 vs 3.6, max 4 vs 8). Context mix is the same in both arms:
mostly **spontaneous** (the learner strikes the false form unprompted, usually
latency 1), once **move-prompted** (the tutor's question makes the learner
re-read its line), once **restage-prompted** (the false form falls when the
tutor re-stages the true premise).

The cleanest single observation: the t18 `m_key` mutation — same premise,
same false form (`onlyKeyTo southStack brandt`), same turn in both arms —
was spontaneously struck at t19 in BOTH arms, theory channel or no.

The dangerous false form (Brandt's name on the South Stack key, which arms a
second mirror — the critic's "any footfall would have named Brandt the
lighter") stood 8 turns in ON (t7→t15) vs 4 in OFF (t10→t14); both fell
restage-prompted. No ledger-visible inference was ever built on a false form
in either arm, and neither ending was corrupted (frame (iv) datum: did not
occur).

Asymmetry worth keeping: **the two debts sort by visibility.** False forms
are visible objects on the learner's own board — the learner polices them
itself (spontaneous strikes dominate). Deletions are absences — invisible to
their owner, and re-adoption was 0 in both arms; every deletion repair came
from the tutor reaching back across act boundaries (as in bounded-v2). The
learner audits what it can see; the tutor restores what the learner can't.
The theory channel changes neither half.

## Reading (per the §6 frame, fixed before the arms ran; n=1 per arm)

Outcome **(i)**: the OFF arm retracts at the same rate and lower latency.
**Redundancy extends to revise.** The fifth mechanism's last pre-registered
edge — explicit reconstruction should catch mutations because they don't
self-announce — did not cash: mistaken-detection ran at 11.8% (vs 32.4%
missing-detection in the same arm), and the only coupled retractions were
already move-prompted. The reconstruction channel stays what bounded-v2 left
it: a free arm-internal diagnostic, not a mechanism. Outcome (ii)'s follow-up
trigger is not met; outcome (iii)'s charter-obligation design input is still
live but now as *staging* improvement (the lantern critic's "no bare
re-entry" clause), not as a rescue of the theory channel.

With this, the explicit-other-modelling family is **six nulls** across recall
(bounded-v2) and revise (this pair) regimes: ontology-ToM, bilateral-ToM
(§6.8), concealed-interior (§6.10), stall-watcher precondition (§6.13.6),
reconstruction-recall, reconstruction-revise. What both arms again establish
positively: default tutor mechanisms + the learner's own board hygiene close
both debt types under aggressive mutation, and the drama survives — both
endings grounded, gap 0, on the same turn.

## Instrument note (defect found and fixed during this pair)

The ON critic's audit line — "the panel holds one false form to run's end
that the transcript shows struck at turn 17" — was a real defect in
`diagnose.js corruptionReport`: false-belief debts were premise-keyed, so a
premise re-mutating while an earlier false form still stood (m_post t10 →
re-mutate t15) orphaned the older row and dropped its later retraction.
Fixed (match by false-form identity; regression test
`tests/dramaticDerivationCorruption.test.js`), both arms' `diagnosis.json` +
`transcript.md` regenerated; the panel now agrees with the raw ledger and the
critic. The contrast script always matched by form, so no §6 quantity moved.
The Fable critic caught a live instrumentation bug from the transcript — the
second time a critic's notice has paid for itself in QA.
