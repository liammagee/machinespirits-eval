# 123 — Registered re-analysis: P3 re-based on the decision readers

Date: 2026-08-16
Workplan item: guarded-learner-outcome-study
Follows: relay 116 (act list), relay 117 (P3 registration), relay 120
(reader GO), relay 121 (warranted-shift re-analysis), relay 122 (the
finding this note answers), defect-ledger row 27.
Status: **SEALED 2026-08-16. Zero calls. No spend is authorized by
this note.** The human ruled on §5, quoted verbatim:

> 1. Yes. 2. Count the turn

So this re-basing is the registered answer to relay 117's P3 question,
and the act-consensus rule is list membership: a turn counts when both
readers name an act on the registered list. The scoring script commits
before the compute runs (§4).

## 1. The question — relay 117's P3, unchanged

> The evidence-move rate in the two learner turns after a **delivered**
> challenge is higher than the rate after a **shadow-selected, not
> delivered** moment in the control versions.

The registered instrument for the act side (the presence readers) was
never fielded (relay 122). This note re-bases the act source. Nothing
else moves.

## 2. The measure, deterministic and already paid for

Three parts, each from stored artifacts:

- **Moments and windows.** From the stored gate traces in the run's
  `dialogues/` directory, through the frozen scorer's own exported
  functions — delivered challenges, shadow selections, and the
  two-turn reply window (`findDeliveredChallenges`,
  `findShadowSelections`, `RESPONSE_WINDOW_TURNS` in
  `scripts/score-guarded-pilot-primary-endpoint.js`). The frozen file
  is imported, never edited. A moment with no reply turn left leaves
  the denominator on both sides, as relay 117 registered.
- **Acts.** The registered evidence-act list is relay 116's, unchanged:
  a proposed test, a public result request, or a record-entry request.
  The source changes: each decision reader tagged every case with one
  speech act, and those tags use the same act names. A window turn
  counts as an evidence move when **both** decision readers tag it
  with an act on the registered list (membership in the list, not the
  exact same act).
- **The contrast.** Evidence-move windows / all windows, delivered
  side against shadow side, counted at moment level with the
  dialogue-level count reported beside it — the relay 117 shape.

Reported beside, description only: exact-act agreement within the
list; windows where only one reader named a listed act; the share of
window turns where the readers disagreed on the act at all (a bound on
what one-tag-per-turn coarseness can hide); per-side window counts.
The turn ruling 001 dropped (dialogue 34, turn 8) has no reader tags;
a window that contains it is scored on its remaining turn and
disclosed, following ruling 002's treatment of per-turn series.

## 3. Prediction

Inherited, not chosen here: relay 117 sealed P3's direction before the
run (delivered higher), with the pilot at 3/10 against 2/35. That
registration stands. Nothing gates on the result; a flat or reversed
result is a finding, as 117 already said.

## 4. Rules

- This is a registered post-hoc re-analysis and is always labeled as
  such; it never stands in a table as the pre-registered P3. The paper
  reports both: the registered instrument went unmeasured (relay 122),
  and this re-basing answers the question with the after-the-fact
  label.
- One contrast, sealed before computing. No threshold is invented
  after the numbers exist.
- The 18 pilot dialogues never pool in.
- The scoring script lands and is committed **before** the compute
  runs. Frozen files are imported, never edited.
- Stored artifacts are read, never edited.
- The decision readers give one act per turn where the presence
  instrument would have given a set. The under-count falls on both
  sides; the disagreement share in §2 is reported as the bound, and if
  it differs materially by side, the rate does not stand alone.

## 5. What the human rules to seal

1. Seal this re-basing as the registered answer to relay 117's P3
   question — yes or no.
2. The act-consensus rule: both readers name **an act on the list**
   (recommended — exact-act consensus would drop turns the readers
   describe the same way at list grain), or rule exact-act consensus
   instead.

NEVER push this branch.
