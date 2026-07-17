# First-draft generalization V20 — held-out result

**Date:** 2026-07-16  
**Verdict:** **FAIL**  
**Frozen code:** `df8ccfa9785249ea22a36cb9a85cf448f6f359f0`  
**Frozen config:** `config/tutor-stub-campaigns/first-draft-generalization-v20.yaml`  
**Config SHA-256:** `c1f61302dba7b70f812999cfd007cb7dc1deea66f132428fb7b25536fbccbf99`

V20 stopped after its hard, predeclared Tallow Street / `answer_seeking`
cell failed one strict delivery gate. The three remaining cells were not
started. Their seeds remain unconsumed. No code or configuration changed
between the frozen declaration and the held-out call.

## Hard-cell accounting

| Measure | Tallow / answer-seeking |
|---|---:|
| Completed tutor turns | 10 |
| Original candidates accepted | 8/10 (80%) |
| Mechanical repair turns | 1 |
| Model rewrite turns | 2 |
| Deterministic fallback turns | 0 |
| Final safety failures | 0 |
| Errors / quarantines | 0 / 0 |
| Mean original tutor latency | 7,585 ms |
| Mean total tutor latency | 10,392.7 ms |
| Host visibility | 100% |
| Mean configuration realization | 0.933 |
| Distinct host parts | 4 |

Mechanical repair and model rewrite overlap on turn 5: the original and the
first policy rewrite both failed learner-uptake composition, after which a
mechanical composition repair produced the safe delivered response. Turn 8's
original failed the dramatic-release entrance and exhibit-action checks; its
policy rewrite passed. No turn reached deterministic fallback.

## Gate result

The hard cell passed every predeclared first-draft threshold and every strict
gate except `duplicate_clue_delivery_turns: 0`.

Turn 1 stated the `p_new` clue twice: first as the learner's requested `Write:`
sentence, then again in enacted source speech. The delivery audits accepted the
response, but the post-run character audit correctly counted two clue-bearing
sentences for the same premise. This is a real strict failure, not a safety
leak, and it is not reclassified as first-draft success.

Dominant failed-candidate clusters were:

- `response_composition:missing_learner_uptake` — 2 audit occurrences on turn
  5 (original and policy rewrite);
- `dramatic_release:opaque_clue_release` — 1 original on turn 8;
- `dramatic_release:missing_exhibit_action` — 1 original on turn 8;
- post-run `duplicate_clue_delivery` — 1 delivered turn, turn 1.

The duplicate-clue result also identifies a guard-coverage gap: the strict
post-run gate sees a repeated clue that the per-turn delivery guard did not
block. The strict gate should be preserved; future development should make a
requested entry and a due clue complementary rather than paraphrasing the same
premise twice, and should enforce that before delivery.

## Seed disposition

| Cell | Seed | Disposition |
|---|---:|---|
| Tallow / answer-seeking | 20260940 | consumed; failed and retired |
| Emberwick / premature closure | 20260941 | unconsumed |
| Larkspur / low-trust skeptic | 20260942 | unconsumed |
| Clockwork / diligent | 20260943 | unconsumed |

The unstarted seeds may be used only with an explicitly predeclared future
matrix. They were not exposed to a model in V20.

## Working-screen development record

All seven iterations used one original tutor draw per frozen turn, no learner
generation, no learner classification or DAG update, no recovery, and no
fallback. Safety failures were zero throughout.

| Iteration | Speaking-prompt change | Recovery-only change | Audit-recognition-only change | Result | Mean original / total latency | Main clusters |
|---|---|---|---|---|---:|---|
| 1 | Combined action and character as one mandatory beat; concrete learner response and public object | Separate answer-seeking direct-answer recovery retained | Narrow evidence, clarification, closure, and exhibit recognition | Greyfen 0/2; Skyway unstarted | 8,167.5 ms | missing part/tactic; missing return |
| 2 | Hard combined beat; first-person advocate; marked clue question | unchanged | Imperative clue return | Greyfen 1/3; Skyway unstarted | 7,421 ms | missing part/tactic |
| 3 | Contrary evidence must collide with the accusation and expose a defeat condition | unchanged | Concrete lab counterpressure | Greyfen 2/4; Skyway unstarted | 8,839 ms | missing part/tactic |
| 4 | unchanged | unchanged | Falsifiable advocate form | Greyfen 2/4; Skyway unstarted | 6,556 ms | missing part/tactic |
| 5 | Canonical accountable `My case is …; break it if …` sentence | unchanged | Exact accountable-case recognition | Greyfen 4/4; Skyway 1/3 | Greyfen 7,932.5 ms; Skyway 6,126.7 ms | Skyway missing part/tactic |
| 6 | Explicit scene-partner placement; expected-shortcut counterpressure | unchanged | Expected route/shortcut can visibly break | Skyway 1/3; Greyfen unstarted | 6,425.7 ms | missing uptake; missing tactic |
| 7 | Requested entries begin `Write:`; contrary evidence explicitly “breaks” the easy answer | unchanged | none | **Skyway 3/4; Greyfen 3/4 — PASS** | Skyway 7,672.8 ms; Greyfen 7,015.8 ms | one opaque release; one missing clarification invitation |

Every working-screen mechanical repair, model rewrite, deterministic fallback,
and final safety-failure count was zero by construction and observation. The
iteration-7 aggregate mean original and total tutor latency was 7,344.3 ms.

## Artifacts

- V20 campaign result: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live/campaign-result.json`
- Tallow auto-eval: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live/tallow_answer_seeking/auto-eval-2026-07-16T07-09-28-450Z.json`
- Tallow trace: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v20-live/tallow_answer_seeking/2026-07-16T07-03-36-147Z.jsonl`
- Passing working screen: `/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens/iteration-7/working-screen-result.json`

## Claim boundary

The frozen-prefix workflow produced a substantial development improvement, and
the hard held-out cell generalized first-draft acceptance to 80% with no
fallback or safety failure. V20 nevertheless failed its declared acceptance
contract because one delivered clue was duplicated and three predeclared cells
were therefore not run. No broad held-out generalization claim is warranted.
