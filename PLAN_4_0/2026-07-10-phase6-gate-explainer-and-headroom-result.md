# The Four-Arm Phase 6 Gate — and Where It Sits After the Headroom Contrast

Date: 2026-07-10
Status: explainer + result note. No new empirical claims beyond the artifacts cited; the headroom result is exploratory (n=3 per cell, single model stack).

## Context: two halves of one question

The preconscious branch carries two adaptation mechanisms, tested on two different substrates:

- **Register policies** (tutor stub): *what tone* the tutor adopts each turn. Tested by the outcome-headroom contrast, run 2026-07-10 — result below.
- **Field planner** (dramatic-derivation runtime): *what move* the tutor makes each turn. Tested by the Phase 6 gate — designed, machinery ready, **not yet run**.

## What the Phase 6 gate is

The pre-registered promotion experiment for the field-theory runtime (PLAN_4_0). The planner is a deterministic controller: each turn it computes learner/tutor/discourse "fields" from the public board, scores all eight conduct move families against hand-coded expected-movement tables, and picks one (ask a scope test, consolidate a subproof, release the next exhibit, ...). The gate asks the only question that matters about it: **does giving this controller authority over the tutor help, compared to the tutor playing well on its own?**

### The four arms

| Arm | What the tutor gets | What it isolates |
| --- | --- | --- |
| `baseline` | current best hidden+proofDebt config, no field machinery | the control |
| `field_report_only` | the field *summary* in its prompt — no recommendation, no authority | instrumentation placebo: does merely seeing the dashboard change behavior? |
| `field_planner_advisory` | the planner's chosen move as advice it may override | does planner *advice* help? |
| `field_planner_enforce` | the planner's move is binding; non-compliant output is mechanically rewritten | does planner *control* help? |

The placebo arm was fixed on 2026-07-10 (it had been byte-identical to baseline — see the adaptation review note). It now runs `--field-report-context`, genuinely injecting the field report, so the design can separate "the planner decided well" from "any field-shaped text in the prompt changes the tutor."

### Scoring and decision rules

Entirely architecture-independent: grounded anagnorisis (deterministic entailment over the learner's public fact board), turns-to-grounded among successes, plus hard safety gates (release-schedule adherence, zero unreleased-premise leaks, no fabricated facts, non-leak audits — report-context audit failures count too).

Frozen decision rules, deliberately hostile to self-flattery:

1. A planner arm must beat baseline on outcome or efficiency.
2. The improvement must NOT be reproduced by `field_report_only` (else it is a prompt-context effect, not planner control).
3. Safety gates no worse than baseline.
4. If `enforce` wins by breaking release discipline, that is a **negative control** — the adversarial-superego lesson that an override channel can force outcomes without any model of the learner.

### Design constraints (frozen before launch)

- **Failure mode required.** Baseline already solves the smoke worlds cleanly (~20–23 turns), so a no-decay gate self-returns "ceiling result, nothing claimable." Default: decay 0.08, mutate-share 0.25 (matching the mock decay smoke). Alternative: the resistant worlds (world-010, world-019).
- **World set.** Smoke trio marrick + hethel + world-019 per the plan (the runner's smoke profile currently omits world-019 — add it or record the deviation).
- **Seeds are labels in real mode** (they pair decay trajectories, not model behavior) — report per-arm distributions, not seed-paired deltas.
- Run from a committed SHA only; the runner writes the frozen manifest before any model call.

### Shape and cost

4 arms x 3 worlds x k=5 seeds = 60 real dialogues on codex.gpt-5.5, sequential in real mode — roughly a full attended quota day. k=10 for a promotable claim. What exists so far is plumbing only: mock smokes and one real enforce-only row with no baseline arm.

If it passes, it licenses exactly one narrow claim: *field planning improves a predeclared controller failure mode without harming proof reliability.* Launch card: `workplan/items/field-planner-phase6-gate.md`.

## Where the other half landed: headroom contrast result (run 2026-07-10)

Artifact root `.tutor-stub-auto-eval/headroom-contrast-n3-live/`, SHA bd4532fe, 60/60 rows. The summaries requested `codex.gpt-5.5`, but authoritative `run_start` metadata records `codex.gpt-5.6-terra` for tutor, classifier, and learner in all 60 rows. Card: `workplan/items/tutor-stub-headroom-contrast.md` (review, exploratory).

The arena worked — 3 of 4 profiles came off the grounding ceiling (proof_skipper 12/15, false_memory 14/15, affective_resistant 11/15). Consolidated outcome-only ranking (mean / worst outcome score):

| Policy | Mean | Worst | Delta vs bland (mean/worst) | Verdict |
| --- | --- | --- | --- | --- |
| dynamic | 0.940 | 0.871 | +0.026 / -0.085 | robust |
| field | 0.939 | 0.871 | +0.025 / 0 | robust |
| bland | 0.913 | 0.864 | — | robust |
| dynamical_system | 0.926 | 0.828 | +0.012 / -0.036 | robust |
| negative | 0.884 | 0.647 | -0.029 / -0.309 | learner-sensitive |

Findings:

1. **Register choice has outcome consequences — shown by the hostile arm, profile-dependently.** Negative beat bland on both cognitive-failure profiles (+0.094 / +0.096) then went 0/3 on affective_resistant (every row rode the 40-turn cap). The reversal is exactly what the sharpened profiles were built to detect; the simulated learner population now genuinely discriminates policies.
2. **Adaptive selection buys nothing measurable over plain-fixed.** Mean deltas +0.012 to +0.026 at n=3 per cell; bland never collapsed (worst cell 2/3); dynamic lost its edge on the affective profile; dynamical_system ranks below bland on worst-case. field is the only arm that never lost to bland in any cell — directional at best at this n.
3. Defensible exploratory sentence: *hostile registers collapse on affect-sensitive learners; adaptive register selection shows no outcome advantage over a plain fixed register.* Any claim wording requires same-design replication on a second model family (Sonnet 5 via the claude-code bridge is the obvious choice).

## Relation

The two experiments are complementary probes of the same underlying question — does engineered adaptation machinery add anything beyond what the model already does in context? The headroom contrast answered for *tone selection* (register policies): choice matters, selection doesn't yet. The Phase 6 gate will answer for *move planning* (conduct control) on the runtime where proof success is mechanically checked.
