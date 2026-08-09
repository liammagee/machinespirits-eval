# Baseline Comparison Design (§15.7 / Phase 5)

**Status:** design only — the paid study is a follow-up decision.
**Question:** does the explicit warrant gate produce behaviour materially different from the uninstrumented stub, and is the difference an improvement at the decision level and downstream?

## Conditions

| Condition | Gate mode | What it isolates |
|---|---|---|
| baseline | off | the frontier model's implicit adaptation, unchanged pipeline |
| instrumented | observe | decision-quality measurement with zero behaviour change — how often would the gate have fired, and would gold agree |
| intervening | active | the full loop: warranted revisions override family + stance |

## Learners (automated profiles)

- `low_agency` — the target case; the gate should fire and hand agency back.
- `diligent` — false-positive control; the gate should rarely fire, and firings here count against it.
- `affective_resistant` — pressure case; checks the gate's complaint track against the face-threat machinery rather than duplicating it.

## Size and cost

10 sessions per condition-learner cell (90 sessions), fixed 8 learner turns, run seeds pinned per session index. At roughly the observed cost of the generation sessions used in this arc, that is well inside a subscription evening; halve to 5 per cell for a pilot gate.

## Measures — decision level and downstream kept separate

Decision level (scored on a sampled subset with fresh two-annotator gold, protocol as in `gold-annotations-first-corpus.md`):

1. Warrant precision/recall against consensus labels; uncertain rows reported, not scored.
2. Turns from first warranted point to first revision (the "held past warrant" lag the shadow found in the July sessions).

Downstream (architecture-independent channels only — the gate's own signals must not score its success):

3. Learner record growth per session: grounded facts entered by session end (the deference sessions sat at 4 the whole way).
4. Deference break: the turn index of the learner's first unhedged own-voice claim, if any.
5. Optional: existing tutor-turn scoring (v2.2) on transcripts, blind to condition.

## Reading rules

- The active condition can only claim an improvement on measures 3–5; measure 1–2 gains are expected by construction and count as manipulation checks.
- A null on 3–5 with clean 1–2 means the instrumentation is measurable but not yet consequential — report as such, do not re-frame.
- Diligent-learner firings are the false-positive denominator; report them with every headline number.

## Known asymmetry to close first

The live gate's decision-time pool lacks post-turn audits (uptake, repetition, guards) that the offline shadow uses. Either fold them in via a post-turn outcome hook before the study, or state that the live gate runs on the signal + record-growth subset and size expectations accordingly.
