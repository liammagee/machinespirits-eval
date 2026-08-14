# 107 — Build note: contract v3.3 and the guarded sensor

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Answers: relay 106 (human ruling, guarded pole basis and contract v3.3)
Status: build step 1 of 4 complete. No paid call was made. No run was started.

## What landed

Contract amendment v3.3, on branch `build/guarded-learner-v3.3` in the
worktree `../ms-guarded-learner`.

Three defensive speech acts join the catalogue, taking it from 15 to 18:

- `learner_overclaim_assertion` — the learner states as settled a claim the
  public record does not support.
- `learner_evidence_dismissal` — the learner rules a released result
  irrelevant to the claim.
- `learner_evidence_demand` — the learner requires the tutor to produce a
  public result before answering.

All three map to one new engagement label, `defended_overclaim`. Both schema
strings moved from `.v3.2` to `.v3.3` in the same commit.

### The preference rule

`learner_evidence_demand` is structurally identical to the existing
`tutor_directed_public_result_request`: same target kind, same requested
action, same executor set. That is deliberate. The words alone do not
separate a guarded learner from a passive one; what separates them is
whether a defended claim stands behind the request. The rule is therefore
about the turn, not the span: when the same turn also carries an over-claim
assertion, a deferential reading of the demand span is dropped, and only the
demand reading contributes. Without the assertion the deferential reading
stands untouched.

### The sensor

`adaptiveWarrantDefendedOverclaimStreak()` counts the unbroken run of
`defended_overclaim` signals at the end of the window. At the threshold —
default 3, the most the gate hands over — the engagement row reports
`sustained_defended_overclaim`, and `evaluateWarrant()` returns the basis
`sustained_defended_overclaim:3_turns` on the `challenge_resistance` family,
the same family relay 106 named. Below the threshold the row reports
`current_defended_overclaim` and warrants nothing.

## Two decisions worth recording

**The sealed pins were not touched.** The A1 manifest pins
`tutorStubWarrantGate.js` and `adaptiveWarrantPolicy.js` by sha256, and CI
compares the live bytes against those digests. Re-freezing them would erase
which bytes produced the closed study. There was no need: `evaluateWarrant()`
lives in the unpinned `adaptiveWarrantGateCore.js`, already receives the typed
divergence rows, and is itself the caller of the pinned policy recommender.
So the streak sensor went into the unpinned divergence layer, beside the
`sustained_low_agency_deferral` state it mirrors, and the basis and family
choice went into the unpinned core. All four pinned files verify
byte-identical after the change.

**No stored `input_digest` moves.** Three choices protect replays of the
sealed corpora: no field was added to the compiled signal object, so the new
state is read off the existing `labels` array; no divergence row was added,
so the existing engagement row carries both branches; and every new branch is
gated on the `defended_overclaim` label, which only a v3.3 act can produce.
No pre-v3.3 corpus carries that label.

**The passive pole cannot arm the guarded sensor.** `defended_overclaim`
sits after `low_agency_deferral` in the engagement precedence order, and both
new divergence branches require that no deferral is present. A turn that
defers keeps its deferential label and its deferential row even when it also
over-claims. Tests cover this in both directions.

## Tests

Twelve new tests, all passing, with the full warrant set at 257 pass / 0
fail:

- each defensive act encodes and contributes the label;
- a near-miss span for each act keeps its passive-pole reading;
- the preference rule fires only when a defended claim is present;
- a mixed turn keeps its deferential primary label;
- three straight turns arm the warrant, two do not;
- the guarded basis never displaces sustained deference;
- streak counting, threshold resolution, and passive-pole invariance at the
  divergence layer.

Three call sites carried a hardcoded count of 15 speech acts and now carry
18: the annotation test, and three checks in the brittleness preflight. They
were left as literals on purpose — they are a ratchet that makes any future
contract addition explicit.

## Still to build

2. Thread `--learner-profile` through the three sealed runner scripts
   instead of forking them.
3. The typed move menu and the concession guard on the learner driver.
4. Smoke C: one gated dialogue, guarded persona, fresh seed, mock readers,
   diagnostic, never pooled.

Registration follows smoke C, and the pilot needs its own committed GO note
plus explicit human approval before any paid call.
