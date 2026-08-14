# 074a — Reviewer verdict: outcome pilot v3 closed as a technical stop at assembly

**Date:** 13 August 2026. **Reviews:** driver report 074. **Basis:** independent
read-only checks of the preserved run artifacts; zero model calls.

## Verification of report 074

All checked claims hold:

1. **143 / 144 cases.** The checkpoint records exactly one unanalyzed turn in
   the pilot: dialogue 11 (world 102, seed 516, gated), turn 5
   (`learnerAnalysisUnanalyzedCount = 1`, turns `[5]`). Every other dialogue is
   8 for 8.
2. **Calls.** 454 generation reservations, all on sealed children; zero reader
   reservations. Counter 3,613 + 454 = **4,067 / 11,337**; 662 calls of the
   authorized 1,116 block unspent.
3. **No quarantine in the checkpoint; 18 / 18 rows complete;** status still
   `generation`; no natural freeze, no reader artifact, no outcome report.
4. **Stop conduct.** No retry, resume, amendment, or repair appears in the
   artifacts. The stop is clean.

## Cause of the missing 144th case

The trace names it exactly. At dialogue 11 turn 5 the strict public
learner-analysis call returned semantic events that failed validation:

```text
invalid_semantic_events: events[0].target:unspecified_cannot_name_public_identifiers
```

The learner's turn was "Would a camera or escort record showing WF-11 at bay
three be the right thing to check?" — the extractor emitted an event whose
target it could not name from public identifiers, the contract's target rule
(amended v3.1) rejected it, and the harness recorded the turn as unanalyzed
(`learner_analysis_unanalyzed`, signal state `none`). One shot, no retry, by
design.

Two design facts follow:

- **The instrument freeze and the outcome-case freeze disagree about gaps.**
  The frozen reader instrument (r52 presence-confirmation freeze) tolerates
  unanalyzed turns — its own coverage block records 5 unanalyzed in 192 turns
  (2.6%). The outcome pilot's case guard demands exactly 144. A corpus the
  instrument accepts can still fail assembly. Any re-registration must pick
  one rule: a declared coverage floor with a case count that adjusts, or an
  exact count with a declared recovery path for extraction refusals.
- **This is the known discard channel, not a new fault.** The rejected event
  fell to one of the two v3.1 rules already shown to carry 22 of 25 discards.
  A bounded, declared recovery (for example one re-ask on
  `invalid_semantic_events`, logged and capped) would very likely have
  produced the 144th case for one extra call.

## Verdict

**Technical stop at assembly (registration §6 class (a)); the pilot closes
without an outcome ruling.** Per note 052a: quarantine, disclose, re-take.
Specifically:

1. The 18 v3 dialogues stay quarantined as report 074 disposes them: preserve
   unchanged; never admit, pool, or score them as outcome evidence.
2. **Do not launch the readers on this corpus.** The generation traces already
   show zero delivered challenge moves in all 144 turns, so GO criterion (c)
   — a nonzero warranted-challenge rate in the gated condition — cannot be
   met. 576 reader calls would buy a formal scoring record of a failure we
   can already read deterministically. This is not a waiver of a failed
   check: no check is being passed; the pilot is closed as failed-at-assembly
   with the substantive defect disclosed below.
3. **Do not re-take generation under the current instrument.** A re-take
   would fail criterion (c) again for the same reason.

## Substantive defects disclosed (diagnostic, not scored)

Recorded so the re-registration addresses them; none of this pools with any
scored result:

1. **No challenge moves anywhere.** 0 of 144 turns delivered the
   challenge-resistance family, in any condition. Measure 2 reads zero and
   measure 2's blind-spot audit has nothing to sample.
2. **The deference sensor is blind to permission-tagged analysis.** The gate's
   challenge trigger needs sustained deference or a low-agency label, but the
   label derivation marked deference present on only 1 of 40 gated
   decision turns while the learner asked permission nearly every turn. The
   model-side extractor did emit record-entry permission events; the
   deterministic derivation does not count them as deference and discards
   uncertain-status events.
3. **Measure 3 reads the same flag,** so deference-streak lengths are
   near-zero everywhere and risk single-value saturation under criterion (b).
4. **Assembly fragility.** Bare and standing-permission traces carry no
   learner signal at decision time (the shadow pass must stamp them), and the
   one extraction refusal above cost the pilot its case count.

## Disposition

1. The 662 unspent calls of the authorized block return to the pool; counter
   stands at **4,067 / 11,337**.
2. Next steps are free and diagnostic, on quarantined copies, clearly labeled,
   nothing pooled: (a) replay a corrected deference-label rule over the stored
   event envelopes of all 18 dialogues; (b) counterfactual gate replay with
   corrected signals to see where challenges would arm. Results inform a
   re-registration; they are not evidence.
3. Any live call — smoke or re-take — needs a fresh authorization note. The
   72-dialogue main block stays unauthorized.
4. No branch push.
