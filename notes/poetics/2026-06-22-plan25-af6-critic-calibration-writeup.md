# Plan 2.5 AF6 Critic Calibration Write-up

Date: 2026-06-22

Status: diagnostic write-up. This is not a fresh-scene generalization claim and
not a broad Plan 2.5 efficacy claim.

Source notes:

- `notes/poetics/2026-06-22-plan25-af6-generalization-and-efficacy-plan.md`
- `notes/poetics/2026-06-22-plan25-af6-generalization-local-diagnostic.md`

## Paper-ready summary

The Plan 2.5 AF6 fresh-scene screen should be preserved, for now, as a
critic-calibration result rather than promoted as a generalization result. Across
five fresh AF6-style scenes, the screen is highly sensitive to critic family and
critic capability. The Codex+Claude diagnostic panel reaches 4/5 scene gates, but
that result is not author-family clean because the scenes were Codex-authored
and Codex was one critic. Local and Antigravity substitute critics fail either by
flattening the intended mechanism branches, by missing tutor-origin evidence, or
by over-attributing recognition in controls. A stronger hosted non-author critic,
OpenRouter GLM 5.2, changes the picture: paired with Claude Code, it passes 3/5
scene gates and 13/15 branch gates, recovering all five intended evidence-route
branches and all five intended refusal-ownership branches in its own row-level
origin assignments. The remaining failures are concentrated in strict
origin/control calibration: one organic silent-hold control is over-attributed as
induced, and the below-null-floor scene remains unstable on the refusal branch.

The diagnostic conclusion is therefore not that AF6 fresh-scene generalization
has been shown. It is that model power and critic calibration materially
determine whether AF6 origin mechanisms are adjudicated as intended. The
mechanism detector appears promising under a strong critic, but the strict
origin/control gate is too brittle to bear a broad claim. Before any promotion,
the gate should be redesigned to separate two tasks that the current screen
entangles: detecting the intended induced mechanism, and preventing
over-attribution in organic controls. The redesigned gate should then be frozen
and tested prospectively.

## What was tested

The screen asks whether a critic can distinguish three AF6 origin mechanisms on
fresh prefixes:

1. `evidence_route_count_refutation`: the tutor induces recognition by changing
   the learner's metric route.
2. `organic_silent_hold_control`: the learner reorients without a tutor-supplied
   mechanism, which should remain organic or non-induced.
3. `refusal_ownership_no_metric_route`: the tutor induces recognition by
   shifting the learner toward ownership / authorization without supplying a
   replacement metric route.

The intended promotion rule was stricter than ordinary form classification. A
scene passes only if both critics agree branch by branch on required form, origin
class, subtype, minimum mechanism scores, required learner-side numeric
revisions, and control constraints. This makes the screen useful as a
demarcation instrument, but also exposes it to critic calibration differences.

The five fresh scenes were:

| Scene | Intended stress |
|---|---|
| `tier_a_null_floor_96_recall_20` corrected | Headline accuracy clears a null floor but minority recall remains poor. |
| `tier_a_null_floor_90_recall_15` | Same Tier A structure at lower headline accuracy and recall. |
| `tier_a_below_floor_recall_14` | Headline accuracy already falls below the null floor, making repair more obvious. |
| `tier_b_precision_recall_confusion` tightened | Confuses precision with recall; later tightened to make route reversal explicit. |
| `tier_b_specificity_recall_confusion` | Confuses specificity with recall. |

## Critic-panel results

| Critic pairing | Scope | Result | Diagnostic read |
|---|---:|---:|---|
| Codex + Claude Code | Full five-scene diagnostic | 4/5 scenes | Strong local signal, but not author-family clean because Codex authored scenes and also served as a critic. |
| Claude Code + Phi-4 | Full five-scene rerun | 0/5 scenes | Phi often credits learner recontextualization but assigns low tutor-mechanism evidence, flattening induced-origin branches. |
| Claude Code + DeepSeek-R1 8B | Corrected known-good smoke | Fail | Misses the evidence route and refusal ownership on the corrected scene. |
| Claude Code + DeepSeek-R1 14B | Corrected known-good smoke | Fail | Keeps the organic control safe, but misses both intended mechanism branches. |
| DeepSeek-R1 32B local | Corrected known-good smoke | Impractical | Produced no first judgment after more than ten minutes. |
| Claude Code + `agy` Gemini 3.1 Pro High | Corrected known-good smoke | Fail | Sees form, but misattributes evidence route as organic and over-attributes the organic control. |
| Claude Code + `agy` Gemini 3.5 Flash High | Corrected known-good smoke | Fail | Keeps the control safe, but misses the intended mechanism branches. |
| Claude Code + `agy` GPT-OSS 120B Medium | Corrected known-good smoke | Fail | After parser retry hardening, parses cleanly but treats intended branches as organic. |
| Claude Code + OpenRouter GLM 5.2 | Full five-scene battery | 3/5 scenes, 13/15 branches | Strongest non-author result. Recovers all intended mechanism branches, but still fails the strict scene-level gate on one control over-attribution and the below-floor refusal branch. |

## GLM 5.2 result in detail

The GLM 5.2 result is the main reason this should be written up rather than
discarded as a failed promotion. It shows a qualitative jump from weaker or less
calibrated critics.

| Scene | Gate | Branch detail |
|---|---:|---|
| `tier_a_null_floor_96_recall_20` corrected | PASS | 3/3 branches pass. |
| `tier_a_null_floor_90_recall_15` | FAIL | Evidence-route and refusal-ownership pass; organic silent-hold control fails because GLM over-attributes induced refusal/authority. |
| `tier_a_below_floor_recall_14` | FAIL | Evidence-route and organic control pass; refusal-ownership remains 1/2. |
| `tier_b_precision_recall_confusion` tightened | PASS | 3/3 branches pass. |
| `tier_b_specificity_recall_confusion` | PASS | 3/3 branches pass. |

Aggregate:

- Scene gates: 3/5.
- Branch gates: 13/15.
- Intended evidence-route branches recovered: 5/5.
- Intended refusal-ownership branches recovered in GLM's row-level assignments:
  5/5.
- Organic-control anomalies: 1/5 scene-level gate failures from GLM
  over-attribution.
- Boundary-scene anomaly: below-null-floor refusal branch remains unstable.

This pattern supports a model-power / critic-calibration interpretation. GLM
5.2 is strong enough to identify the intended mechanism branches across the
scene set. The failure is no longer mainly mechanism invisibility; it is the
strict origin/control composition of the gate.

## Why this is not a generalization claim

The result does not license "Plan 2.5 generalizes across fresh scenes" for three
reasons.

First, the scene-level promotion gate remains below the pre-existing bar. The
best author-clean critic pairing, Claude Code + GLM 5.2, gives 3/5 scenes rather
than the intended 4/5 threshold.

Second, the failures are not random noise around a passed instrument. They expose
a structural ambiguity in the gate. The current gate asks the critic to perform
mechanism detection and origin-control policing in a single pass. GLM 5.2 can
detect the mechanism branches, but the same scoring layer still over-attributes
one organic control. That means a strict scene pass currently measures a
compound of mechanism sensitivity and control conservatism.

Third, the scene set remains a diagnostic construction rather than a clean
confirmatory set. It was useful for finding the failure mode, but the broad
claim should only be attempted after a redesigned origin/control gate is
predeclared and frozen.

## What this does license

This diagnostic licenses the following bounded claim:

> In the Plan 2.5 AF6 fresh-scene screen, origin adjudication is strongly
> critic-power and critic-calibration sensitive. Weaker local and Antigravity
> substitute critics either miss or flatten the intended mechanisms, while
> OpenRouter GLM 5.2 paired with Claude Code recovers 13/15 branch gates and all
> intended mechanism branches, but still fails the strict scene-level promotion
> gate because of origin/control instability.

This is a useful result because it explains why previous negative or partial
screens should not be read as simple mechanism failure. It also explains why a
future promotion attempt should not merely "try a stronger critic" again. The
next step is a gate redesign.

## Required redesign before promotion

Before any broad Plan 2.5 or fresh-scene generalization claim, redesign the
strict origin/control gate.

The redesigned gate should separate:

1. **Mechanism detection.** Did the critic identify the intended induced
   mechanism branch when the branch is present?
2. **Control conservatism.** Did the critic refrain from attributing induced
   origin in organic controls?
3. **Boundary handling.** Are below-null-floor cases part of the promotion
   denominator, or explicitly classified as boundary diagnostics?

The current screen entangles those three decisions. GLM 5.2 shows that the first
task can succeed even while the second and third remain unstable. A prospective
promotion should freeze separate pass rules for mechanism sensitivity, control
specificity, and boundary-scene inclusion before another full battery.

## Suggested placement

Do not add this to the main claim path as evidence that Plan 2.5 generalizes.
Use it as a bounded diagnostic note in the poetics section, or as an
appendix-style calibration result.

Suitable paper prose:

> A follow-up AF6 fresh-scene screen did not yet support a generalization claim,
> but it exposed an important calibration boundary. Across five fresh
> AF6-style scenes, a Codex+Claude diagnostic panel reached 4/5 scene gates, but
> that result was not author-family clean. Local and Antigravity substitute
> critics failed the corrected known-good screen or the full battery. By
> contrast, Claude Code paired with OpenRouter GLM 5.2 passed 3/5 scene gates and
> 13/15 branch gates, recovering all intended evidence-route and
> refusal-ownership mechanisms while still failing one organic control and one
> below-floor refusal branch. We therefore treat the result as a
> critic-calibration finding rather than as a fresh-scene generalization result:
> stronger critics can see the intended AF6 mechanisms, but the strict
> origin/control gate must be redesigned and prospectively re-frozen before it
> can bear a broad claim.

## Evidence paths

Primary GLM 5.2 reports:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-a-96-corrected-codex-learner-codex-claude-critics-20260622/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_null_floor_90_recall_15/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_a_below_floor_recall_14/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-tier-b-precision-tightened-codex-learner-codex-claude-critics-20260622/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-generalization/live-diagnostic-codex-learner-codex-claude-critics-20260622/tier_b_specificity_recall_confusion/non-author-claude-openrouter-glm52-analysis/screen-analysis.md`

Diagnostic source note:

- `notes/poetics/2026-06-22-plan25-af6-generalization-local-diagnostic.md`

Planning source note:

- `notes/poetics/2026-06-22-plan25-af6-generalization-and-efficacy-plan.md`
