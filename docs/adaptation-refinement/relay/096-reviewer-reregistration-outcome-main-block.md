# 096 — Re-registration: outcome main block (M7/M8 report-only, P2 rewritten)

**Date:** 13 August 2026. **Human authority, verbatim:** "Do it"
(13 Aug, in-session), on the reviewer recommendation put after
report 095: no second pilot; demote the two saturated measures to
report-only; rewrite the failed prediction from pilot evidence; then
seek a separate GO for the main block. Budget authority: 052c
(ceiling 19,337). Counter at drafting: **5,274** settled (report
095); room 14,063.

This note amends registration 079 and the base outcome-study
registration (`v3-outcome-study-registration.md`). It is written
BEFORE any main-block data exist. **It does not authorize the main
block.** Launch needs a fresh GO note committed only after an
explicit human GO.

## Why: the registered NO-GO

The v4 pilot completed clean (report 095, score artifact
`3e01fe8f…`, `zero_model_calls: true`). Gate (b) fired exactly as
registered: measure 7 (learner result requests) took one value on
99.275% of the 138 consensus cases (1 present), measure 8 (learner
proposed tests) on 91.304% (12 present) — both over the 90%
ceiling. The registration's own rule: stop and redesign the failing
measure before the main block. This note is that redesign.

## Amendment 1 — measures 7 and 8 demoted to report-only

M7 and M8 leave the contrast set. The acts they count are too rare
at this sample size to carry a contrast; the instrument is dead, not
the theory. Per the defensibility rule (agreement-test precedent),
dead slots go report-only; they keep no confirmatory weight and no
gate consults them. The base registration's "M7–8: Gated > Bare"
prediction is withdrawn. Pilot direction (M8 gated 6/47 = 12.8% vs
bare 4/46 = 8.7%) is recorded as descriptive only.

We do NOT re-engineer scenarios to elicit result requests or
proposed tests. Manufacturing the variance we would then claim is
the closed-loop trap; the low base rate under a natural
permission-seeking persona is itself a finding.

## Amendment 2 — presence-reader channel not fielded

The fresh presence readers exist only to measure M7 and M8.
Re-fielding them for the main block would spend ~1,200 paid calls on
a demoted instrument. The main block runs the **decision channel
only**: 2 fresh decision readers per decision-turn case. The pilot's
presence numbers stand as the validated base-rate estimate for
M7/M8; any main-block M7/M8 description comes zero-call from the
stored generation-time events, labeled as not reader-validated.

The exact-count freeze (074a: never waived post hoc) moves with the
plan: 72 dialogues × 8 decision turns = **576 cases**, 2 readers
each = 1,152 planned reader calls. The 094a acceptance rule stands:
every accepted response passes the FULL deterministic contract at
acceptance, not at assembly.

## Amendment 3 — predictions rewritten from pilot evidence

Pilot evidence, gated condition (all from `outcome-pilot-score.json`
and the dialogue traces; armed = first turn the gate's basis reads
`sustained_deference:3_turns`, which in all six dialogues is also
the first challenge-family turn):

| Dialogue (world/seed) | Armed = first challenge | First deference break | Challenge turns |
|---|---:|---:|---|
| 02 (101/s515) | t3 | t5 | t3 |
| 04 (102/s515) | t7 | none | t7 |
| 09 (101/s516) | t6 | t3 | t6, t7, t8 |
| 11 (102/s516) | t5 | t6 | t5 |
| 13 (101/s517) | t4 | t7 | t4, t5, t6 |
| 18 (102/s517) | t5 | none | t5, t7 |

Controls: bare first breaks t2, t3, t2 (3 of 6 dialogues); standing
permission t3, t7, t3 (3 of 6). Warranted challenges: gated 11/48
decision turns; bare 0/48; standing permission 0/48.

**Old P1** (arms on sustained deference, ≥1 challenge delivered)
held in substance: 6/6 gated dialogues armed, turns 3–7. Its
exact-turn forecast from the v3 stored events missed most turns and
is dropped — exact-turn forecasting adds no confirmatory value.

**Old P2** (dialogues whose learner self-breaks early never arm)
observed FALSE. All six gated dialogues armed. The one early break
(09, turn 3, before any challenge) was followed by five straight
deferential turns and the gate armed at turn 6. The other three
breaks (turns 5, 6, 7) all came AFTER the gate armed and delivered
its first challenge (turns 3, 5, 4). Early self-breaking either did
not occur (5 of 6) or did not persist (1 of 1); a three-turn
deference run occurred in every gated dialogue. The base
registration's "earlier … breaks" clause is superseded the same
way: gated breaks came later than bare's spontaneous breaks (median
first break 5.5 vs 2), consistent with challenge-provoked rather
than spontaneous breaking.

**New registered predictions (directional):**

- **P1′** — In at least 80% of gated main-block dialogues, the
  sensor arms and at least one challenge-family turn is delivered
  (pilot 6/6).
- **P2a** — More gated dialogues show at least one deference break
  than bare and than standing permission (pilot 4/6 vs 3/6 vs 3/6).
- **P2b** — Among gated dialogues with a break, at least half break
  first within three turns AFTER the first delivered challenge
  (pilot 3/4).

Unchanged predictions: M1 decision correctness does not differ
across conditions (pilot 76.1% / 80.0% / 75.6%); the
standing-permission reading rule of the base registration stays in
force per measure; R1 (challenges delivered to productively
progressing learners) stays report-only risk.

## Pooling and overfit rules

These predictions are written from the pilot. The 18 pilot dialogues
therefore NEVER pool into any main-block confirmatory analysis;
they may appear beside it only as clearly labeled pilot description.
No post-hoc threshold is invented after unblinding. A substantive
fail stays terminal (052a).

## Sample and budget

- 72 fresh dialogues, 24 per condition; worlds 101/102 unchanged;
  8 turns; permission-seeking persona unchanged.
- 12 fresh seeds, **518–529**, none used in any diagnostic, smoke,
  pilot, or burned corpus (driver verifies before launch). Each seed
  yields one dialogue per condition per world.
- Calls: generation ≈ 2,000 (pilot ran 495 for 18 dialogues);
  decision readers 1,152 planned + failed-attempt allowance at the
  pilot ratio (12 per 300 planned, so 48). Plan ≈ 3,200. Ceiling
  19,337 unchanged; counter opens at the settled value when the GO
  note is cut.

## Main-block gate (assembly only, fail-closed)

(a) 72/72 dialogues complete and admissible; all deterministic
measures compute on every dialogue; the decision channel assembles
at exactly 576 cases with both readers contract-valid per case.
No saturation gate re-applies to the demoted measures. NO-GO on (a)
is a technical failure under 052a: quarantine, disclose, re-take.

## Unchanged

Conditions (bare / gated / standing permission), deterministic
measures M1–M6 definitions, deference sensor (`46bfbdd9`), sustained
deference warrant basis (`sustained_deference:<n>_turns`), coverage
repair (`48bf2e97`), instrument freeze
`annotation-freeze-manifest-r52-presence-confirmation.json` (SHA
`6a64b31f…`), decision-reader child runner (pinned `c0a20130…`),
094a re-take machinery. v1–v3 artifacts stay quarantined. Parent and
launcher change as needed (unpinned, per prior rulings) to field a
decision-only reader plan at 72-dialogue scale.

## Process

Direction 097 orders the build, zero calls: 72-dialogue study plan,
decision-only reader plan, seed-freshness check, tests. Then
reviewer zero-call verification, human review of this registration,
and ONLY on an explicit human GO a fresh GO note (097a) and launch.
Report file: 098. NEVER push the branch.
