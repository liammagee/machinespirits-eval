# 117 — DRAFT registration: guarded-learner main block

Date: 2026-08-15
Workplan item: guarded-learner-outcome-study
Follows: relay 110 (pilot registration), relay 116 (act list), the pilot's
gate report (PASS on all three slots) and primary-endpoint report
Status: **DRAFT. Nothing is registered and no spend is authorized.** Three
decisions in §2 are the human's. When they are answered, this file is
renamed to drop "draft", the answers are quoted verbatim, and the run still
needs its own GO note quoting approval of the spend.

## 1. What the main block asks

The pilot licensed this question and supplied the numbers under it. The
main block asks it with enough data to mean something:

> Does a delivered challenge move a guarded learner to produce a public
> evidence check, where the same moment without a challenge does not?

The pilot's answer, small and directional: after the 10 delivered
challenges, both readers saw an evidence move 3 times (3/10). At the 36
matched shadow moments in the two control versions — turns where the gate
selected a challenge but, watching only, delivered nothing, with at least
one reply turn following — the rate was 2/36, and both hits sit in one
dialogue. Same sensor, same learner persona, same reading; the only
difference is whether the challenge reached the learner.

## 2. The three decisions

**OD1 — the confirmatory contrast.** I propose the shadow contrast above
as the registered prediction, instead of making the control versions
deliver challenges. Making controls deliver would destroy them as
controls; the shadow gate already marks the matched moments, and the
presence readers already cover every turn, so the baseline costs nothing.
Lean: register the contrast (P3 below); the raw endpoint level stays
report-only, never a number to beat.

**OD2 — sample and spend.** Mirror the passive main block: 72 fresh
dialogues, 24 per condition, worlds 101/102, 8 turns, guarded persona.
Both reader channels this time — the primary endpoint reads the presence
readers, so they cannot be dropped the way the passive block dropped
them. Plan ≈ 4,500 calls, cap 4,800 (§5). Counter opens at 11,559 of
19,337; even at the cap it ends under 16,400. Lean: yes.

**OD3 — decision correctness.** Registered as endpoint 2 (relay 110,
unchanged from §6.25), but the pilot's value has not been read yet. It is
a zero-call read off the pilot's decision readers. Lean: read it before
this draft is sealed, and register the same prediction the passive block
carried — no difference across conditions — only if the pilot agrees.

## 3. Design

- 72 fresh dialogues: 3 conditions (bare / gated / standing permission)
  x 2 worlds (101, 102) x 12 seeds.
- Seeds: **530–541 proposed**, subject to the driver's check that none
  appear in any diagnostic, smoke, pilot, or burned corpus. Pilot seeds
  515–517, passive main block 518–529, and smoke seed 550 are all
  excluded already.
- Guarded persona unchanged from the pilot. Contract v3.3 unchanged.
- Both reader channels, full coverage: presence and decision, two readers
  each, 576 cases per reader (72 x 8).
- Report-only endpoint 5 (defensive-act counts) reads the live extraction
  the gate stores on every decision; zero calls, unchanged from relay 112.

## 4. Endpoints and predictions

Endpoints 1–5 unchanged from relay 110 §3, with the primary endpoint's
act list and counting rules fixed by relay 116 (both readers for the
headline; short reply windows stay in the denominator; the gate's own
uptake check is never the endpoint).

Predictions, written from pilot evidence only:

- **P1** — In at least 80% of gated dialogues that carry a defensive
  stretch (three or more consecutive defended over-claim turns), the
  sensor arms on a stretch. Pilot 5/5; the one stretch-free dialogue
  left the denominator, as registered.
- **P2** — At least one challenge is delivered in at least two thirds of
  gated dialogues. Pilot 5/6.
- **P3 (primary, directional)** — The evidence-move rate in the two
  learner turns after a **delivered** challenge is higher than the rate
  after a **shadow-selected, not delivered** moment in the control
  versions. Pilot 3/10 against 2/36. Counted at moment level; windows
  can overlap, so the dialogue-level count is reported beside it, and
  shadow moments with no reply turn left (a turn-8 selection) leave the
  denominator on both sides of the contrast.
- **M1** — decision correctness does not differ across conditions.
  **Held open under OD3** until the pilot value is read.

The endpoint level itself (pilot 0.30) is report-only. A flat or null
contrast is a finding: it would say the guarded learner's evidence
moves come on the learner's own schedule, and the challenge only fronts
them. Nothing in this design gates on P3.

## 5. Budget

- Generation: ≈ 2,000 planned (pilot ratio ~27 calls per dialogue),
  cap 2,160 (30 per dialogue).
- Readers: 2,304 planned (4 readers x 576), failed-attempt allowance at
  the pilot ratio (one retry per channel per ~289) plus the relay 094a
  re-take allowance of 10 per channel, all inside the cap.
- Plan ≈ 4,500; **absolute cap 4,800**. The budget is not raised
  mid-run. Counter opens 11,559 / 19,337.

## 6. Main-block gate (assembly only, fail-closed)

As the passive block: 72/72 dialogues complete and admissible, every
deterministic measure computes on every dialogue, and both channels
assemble contract-valid — presence and decision each at exactly 576
cases per reader. A NO-GO here is a technical failure under the 052a
rule: quarantine, disclose, re-take within the allowance. No slot gates
on any endpoint.

## 7. Pooling and overfit rules

The 18 pilot dialogues never pool into any confirmatory table; they may
stand beside one only as labeled pilot description. No threshold is
invented after unblinding. A substantive fail is terminal — stop and
report, never patch a live run.

## 8. Stop rules

Carried unchanged from relays 110 §5 and 115 §9: a defensive turn read
as a low-agency deferral is terminal; persona collapse (the guarded
learner stops over-claiming) stops the run; one retry per failed call;
one re-take per quarantined reading, per 094a; the budget is not raised.

## 9. After the run

Archive first, then commit in the private repo. Then assembly, the
acceptance audit over all reader responses, the gate in §6, then the
scores. The two pilot scorers (`score-guarded-pilot-gate.js`,
`score-guarded-pilot-primary-endpoint.js`) pin the pilot's shape — 18
dialogues, 6 gated — and refuse anything else, so the build phase adds a
main-block shape (72 / 24) behind a flag, with a test on each shape, and
changes nothing in the counting rules. That build lands and is committed
**before** the GO note, so the run is scored by frozen code. Then the
decision-correctness instrument per OD3. Interpretation stays reserved
to the reviewer.

NEVER push this branch.
