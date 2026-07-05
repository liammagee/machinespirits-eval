---
id: blueprint-composition
title: Blueprint composition — one runnable tutor from the validated mechanisms
status: active
type: experiment
priority: P1
owner: claude
source: manual
created: 2026-07-02
updated: 2026-07-02
verification: Blueprint registry + loader tests pass; cells 199-200 validate and resolve via EVAL_ONLY_PROFILES; stage-0 no-paid checks pass; the pre-registered composition matrix (plan note §5) runs only after a separate go decision, with run IDs and per-suite local results recorded here.
claim_status: planned
links:
  notes:
    - notes/2026-07-02-blueprint-composition-plan.md
tags:
  - blueprint
  - composition
  - id-director
  - writing-pad
  - adaptation
  - evaluation
branch: worktree-blueprint-composition
---

Compose the paper's validated mechanisms into one runnable tutor and test
whether composition adds anything, following
`notes/2026-07-02-blueprint-composition-plan.md`. Mechanisms become named
modules in `config/tutor-blueprint.yaml` (evidence pointer + factor flags +
portability status); `cell_199_blueprint_kernel_verified` composes
orientation + writing pad + register router on the id-director chassis;
`cell_200_blueprint_full_verified` adds every module portable at
implementation time. The paper's own findings (universal substitution §6.4,
prosthesis-straitjacket §7.8.3, state-richness reversal §6.8.6) predict
sub-additivity — either outcome is a paper finding (§6.14 or §7 extension).

Acceptance:

- Blueprint modules are declared in config with evidence pointers and
  resolve deterministically to profile factor flags via a loader service
  with unit tests.
- Cells 199-200 registered in `config/tutor-agents.yaml` and
  `EVAL_ONLY_PROFILES`; cell-config-auditor and validate-config clean.
- Non-portable mechanisms (pacing guard; possibly action contracts) are
  declared as such with reasons, not silently dropped.
- Stage-0 no-paid checks pass (profile resolution, module validation,
  hermetic dry-run).
- The composition matrix is pre-registered in the plan note (§5) with
  frozen hypotheses H1-H3, per-suite local decision rules, and stop rules;
  no paid run without a recorded go decision.

2026-07-03 Claude: §11 carry-through decision run COMPLETE
(`eval-2026-07-03-f877e477` + supplement `eval-2026-07-03-4deae92a`; result
in note §11). Combined n=6/cell×scenario, 30 rows/arm: positives 193 30/30
vs kernel 24/30 — gap 6/30, exactly the pre-registered dissolve boundary.
**Verdict: DISSOLVED** (the material H2 claim is not licensed; strict
candidates statistically identical at 18/30 vs 17/30). Residual worth one
caveat line: the deficit is one-directional (193 mean higher on 5/5
scenarios) and concentrated in frustration (6/6 vs 3/6). Stop rule applies:
no further repeats on this contrast. §6.14 story = sub-additivity + a
frustration-subtype caveat, not a composition cost.

2026-07-03 Claude: H2 repeats contrast COMPLETE (`eval-2026-07-02-ad0b5a8b`,
30/30; pre-registration + result in note §10). Combined n=4/cell×scenario:
strict candidates EQUAL (12/20 both arms); positive local outcomes 193 20/20
vs kernel 15/20 (gap 5 rows — the frozen rule's middle zone: not confirmed,
not dissolved); 193 higher mean local score on 5/5 scenarios. The regression
attenuated and relocated: recognition orientation does not impair strict
breakthroughs but erodes the soft carry-through band (frustration 4/4 vs
1/4). PR #77 open. Optional next: +2 repeats/cell×scenario (20 rows) to
settle the positive-rate gap.

2026-07-03 Claude: Paid composition gate COMPLETE (user go 2026-07-02; frozen
plan + full results in the note §8-§9). Runs: canary
`eval-2026-07-02-b0be0524`; Block R `eval-2026-07-02-b4ccb58d` (20/20, scored,
codex judge); Block S `eval-2026-07-02-fe9404d2` + comparators
`eval-2026-07-02-a4260aa3`; Block T `eval-2026-07-02-6547750c` (cell 199;
strict-shift structurally non-evaluable on the id-director trap adapter —
exploratory-invalidated as provisioned). Bounded verdict: H1 sub-additivity
supported everywhere measured (kernel ≈ full: R overall 92.3 vs 92.0, S 97.2
vs 97.4); H3 straitjacket not triggered; H2 FAILS on the comparator's home
suite at n=1 — composite arms trail the plain cell-193 backbone on local
resistance uptake (positive 2/5 and 1/5 vs 5/5, mean 73.0/84.0 vs 90.0)
despite correct routing, pointing at recognition orientation as the costly
ingredient. Licensed next step: repeats-only cell 193-vs-199 contrast (3+
repeats × 5 scenarios), nothing broader. OpenRouter spend ≈$0.30; rest on
CLI quota.

2026-07-02 Claude: Implementation complete on `worktree-blueprint-composition`
(plan note §7 has the full log). Registry + loader + enforced-as-check tests,
action-contract middleware extracted from the LangGraph runner (ownership gate
excluded; observe-don't-repair), both id-director entry paths wired, cells
199-200 registered and validate-config clean. Stage-0 green: focused tests
76/76, blueprint tests 11/11, full hermetic suite green except 12 pre-existing
provableDiscourse failures reproduced identically on the base commit. Key
composability corrections recorded: writing_pad_enabled is dead config (pads
key on learnerId; only the drama pad lives on this chassis — A7 cross-session
claim NOT inherited), and the conventional superego structurally conflicts
with the id-director chassis. No paid run; the §5 matrix awaits a go decision.
