# Plan 2.5 AF6 Origin Separation v2

Date: 2026-06-21

## Purpose

This is the next loop after `plan25-af6-subtype-contrast-v1` failed its promotion rule.

V1 held the scene after the learner had already generated the null-classifier worry and did not include concrete table counts in the frozen prefix. The evidence-route tutor branch therefore produced calculation without a strong self-reframe, while controls could still look like organic metric repair.

V2 changes the prefix, not the scorer. The learner now begins by defending the headline accuracy claim while concrete confusion-matrix counts are visible:

- TP = 10
- FN = 50
- FP = 10
- TN = 930
- accuracy = 94%
- majority-class null floor = 94%
- minority recall = 16.7%

This creates a sharper origin test: the evidence-route branch has enough public data to force completion, while the controls must not leak the route from the tutor side.

## Artifacts

- `config/poetics-calibration/plan25-af6-origin-separation-v2/frozen-prefix-T01-counts-visible-before-tutor.txt`
- `config/poetics-calibration/plan25-af6-origin-separation-v2/branch-spec.yaml`

## Branches

1. `evidence_route_count_refutation`: tutor supplies the old-route / Gate A / Gate B / replacement-claim sequence.
2. `organic_silent_hold_control`: tutor supplies no route, no ownership demand, and no new calculation.
3. `refusal_ownership_no_metric_route`: tutor applies ownership/refusal pressure without supplying the metric route.

## Promotion Rule

Run order:

1. Mock replay with mock scoring to verify artifacts and leakage audits.
2. Cheap live replay with Codex learner and Codex critic.
3. Promote only if the cheap live replay separates origin cleanly:
   - evidence branch: `recognition / peripeteia_induced / evidence_route`
   - cold control: `none` or `organic`, not induced evidence-route
   - refusal branch: `refusal_authority_ownership`, not evidence-route

If the cheap replay separates, the next step is a small fresh claim-bearing battery using the v2 prefix family and a non-author critic. If it fails, record the failure mode and redesign again before paid full fidelity.

## Execution Result

Mock preflight passed:

```bash
node scripts/replay-plan25-prefix-branches.js \
  --design config/poetics-calibration/plan25-af6-origin-separation-v2/branch-spec.yaml \
  --out-dir exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-origin-separation-v2/mock-replay \
  --mock --score-mock --force
```

Two Codex-learner / Codex-critic live draws passed the predeclared gate after deterministic analyzer repairs:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-origin-separation-v2/live-replay-codex-learner-codex-critic-20260621/screen-analysis.md`
- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-origin-separation-v2/live-replay-codex-learner-codex-critic-rep2-20260621/screen-analysis.md`

One cross-bridge Claude-learner / Codex-critic draw also passed:

- `exports/plan2_5-rhetorical-dramatic-eval/plan25-af6-origin-separation-v2/live-replay-claude-learner-codex-critic-20260621/screen-analysis.md`

The analyzer repairs were measurement-side and are now covered by focused tests:

- `scripts/lib/recognitionOrigin.js` now treats withdrawing / stand-behind language as ownership.
- Tutor evidence-route detection no longer scans critic justification prose as if it were tutor-supplied route evidence.
- `scripts/analyze-plan25-branch-screen.js` recomputes origin/subtype against the current deterministic classifier and lets the public transcript supplement scorer evidence snippets for subtype demarcation.
- `node --test tests/recognitionOriginSubtype.test.js` passes.

## Claim Boundary

Paper-bearing claim:

> In a prefix-controlled AF6 screen with concrete counts visible, the v2 design separates three origin mechanisms across three live draws: evidence-route tutor pressure yields `peripeteia_induced / evidence_route`; cold hold yields organic or no tutor-origin repair; refusal/ownership pressure yields `refusal_authority_ownership` rather than evidence-route attribution.

Not licensed:

- Plan 2.5 proves a broad AF6 pedagogical effect.
- The result generalizes across fresh scenes.
- The result is a main-harness tutor-quality effect.
- The result is human-learning evidence or deployment evidence.

The contribution is now an instrument/design result: the subtype/origin separation problem is solved for this AF6 prefix family well enough to become a bounded sidecar claim, but any stronger Plan 2.5 efficacy claim still needs a fresh predeclared battery.
