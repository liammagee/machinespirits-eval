---
name: ms-eval-instruments
description: Map of every instrument that scores tutor performance — four families, where each channel's outputs live, how to read disagreement between them, and how to rebuild the all-channel A/B dashboard. Read-only; never starts runs or calls paid APIs.
argument-hint: [family or channel name]
---

Answer questions about how tutor performance is measured, and keep the channels
straight. If `$ARGUMENTS` names a family or channel, answer for that one and
stop. This skill never starts runs, never calls a model, never writes the DB.

## The four families

**1. Rubric scoring — an LLM judge reads a dialogue.**

| Instrument | Where | Outputs |
|---|---|---|
| v2.2 tutor rubric (8 dims, per turn; active default) | `config/evaluation-rubric-*.yaml` | `evaluation_results` columns via `eval-cli evaluate` |
| Mirrored learner / dialogue / deliberation rubrics | same | same, symmetric columns |
| v3.0 suite (general factor + content accuracy; opt-in) | `config/rubrics/v3.0/` | separate artifacts; never mixed with v2.2 |
| Charisma v1.0 (Weber; id-director cells 101-109 only) | `config/evaluation-rubric-charisma.yaml` | `tutor_charisma_*` columns |
| Poetics v1.0 (Aristotle; whole transcript, not turns) | `config/evaluation-rubric-poetics.yaml` | `npm run poetics:*` exports |

Rule: never rescore historical data under a newer rubric version, and never
average across rubric versions or across these instruments.

**2. Deterministic checks — code, no judge.**

| Instrument | Where | Outputs |
|---|---|---|
| Tutor-stub guard audit (broken rules per turn) | `services/tutorStub*Audit*.js` and assertion services | each A/B run's `report.json` |
| Trap-scenario strategy-shift scorers | `scripts/analyze-strategy-shift.js`, `scripts/grade-adaptive-dialogue.js` | per-run exports |
| Agon game (zero-judge, §6.15) | agon scripts | exports |
| Machine-checked proof artifacts (§6.20–6.22) | `artifact_json` snapshots | paper-linked exports |

**3. Tutor-stub comparison channels — the current A/B arc.**

| Channel | What the scorer sees | Where verdicts land |
|---|---|---|
| Frozen-replay guard audit | the reply + the full authored guard set | `exports/tutor-stub-ab/<run>/report.json` |
| PR benchmark rubric (7 axes, Sonnet judge) | the reply + the authored obligations | `exports/tutor-stub-ab/pr-benchmark-*.json`; also gates pushes |
| Blind pairwise judge | two candidate replies + the public scene only | `exports/tutor-stub-ab/pairwise-judging-*.jsonl` |
| Clue-shown pairwise judge | blind view + the clue the world schedules that turn | same, files with `-due` |
| Showcase (free-running, scored v2.2 + v3.0 + PR bench side by side) | whole fresh dialogues | `exports/tutor-stub-showcase/<run>/` |

The first two share the authored plan's yardstick; the pairwise judges share
nothing with it. That separation is deliberate — see "Reading disagreement".

**4. Computed process measures — no scorer at all.**

Adaptation / learner-growth / bilateral indices, trace incorporation analysis,
trajectory curves, within-test change, cross-judge reliability. Registry with
flags: `scripts/ANALYSIS-SCRIPTS.md`. Never guess a script name; read that file.

## Reading disagreement

Channels are kept separate so they can disagree, and the disagreement is a
finding, not an error to reconcile. Worked example (2026-07-29): the per-turn
performance contract wins every channel that grades against the authored plan
(guard audit 1.67 vs 5.04 broken rules per turn; PR bench 8/13 vs 1/12
delivery passes) and loses both pairwise channels (15% blind, 25% clue-shown).
Countable cause: 26 of the contract's 36-rule win comes from rules keyed on the
plan's own named slots, 10 from rules keyed on the shared public scene. Full
record: `workplan/items/tutor-instrumentation-ab-harness.md`.

Before citing any cross-channel comparison, say which channel each number came
from and never present a plan-aware number and a plan-blind number as the same
scale.

## The dashboard

One page over the frozen A/B pool, every channel's reading side by side,
verdicts attached only where run, case, version and model lane all match:

```bash
node scripts/build-tutor-stub-ab-dashboard.js
```

Writes `exports/tutor-stub-ab/dashboard.html`. `--all-runs` widens from
LLM-read runs to every run on disk; `--runs a,b` adds named runs; `--out`
moves the output. Pure file reads — free, safe to rerun any time.
