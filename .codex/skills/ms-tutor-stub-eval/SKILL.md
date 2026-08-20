---
name: ms-tutor-stub-eval
description: Run, resume, analyze, or configure tutor-stub detective-world experiments, including human sessions, automated policy and learner evals, ABM or QA panels, field and cross-run analysis, and bounded recovery of an already authorized run. An analysis or configuration request is not authority for a new model-backed run.
---

# Tutor Stub Eval

Use this skill for `scripts/tutor-stub.js`,
`scripts/run-tutor-stub-auto-eval.js`,
`scripts/run-tutor-stub-qa-matrix.js`,
`scripts/run-tutor-stub-abm-panel.js`,
`scripts/analyze-tutor-stub-field-traces.js`, and
`scripts/analyze-tutor-stub-auto-evals.js`. Work from the repository root.

## Authority

- Zero-call inspection, help, dry-run, validation, and analysis of existing
  artifacts do not authorize a model/provider call. Stay zero-call when the
  user asks to inspect, configure, plan, dry-run, analyze, or discuss.
- Start a new model-backed run only with literal user authority to run it.
  Confirm the model/provider route, world/profile/policy scope, seeds or run
  count, data/payload scope, output destination, and maximum attempt/spend
  ceiling when they are not already fixed. Do not infer authority from an old
  run, a workplan card, a prior dry-run, or loading this skill.
- Standing technical-recovery authority applies only after a technical failure
  in an already authorized run and only inside its frozen source/digests,
  model/provider, world/profile, seed/configuration/rubric, data/payload scope,
  and maximum attempt/spend ceiling. Preserve every completed and failed
  attempt; resume only missing or failed units through the existing mechanism
  into a fresh non-overwriting destination or checkpoint. Never rerun valid
  outputs or choose among outcomes.
- Stop and ask if a failure may be substantive, the same failure repeats and
  suggests a code defect, or recovery would change any frozen input, route,
  scope, budget, or interpretation.

## Always-loaded safety

- The deterministic harness owns the private world contract. The speaking tutor
  receives only public scene, dialogue, due evidence, public rules, and a
  bounded response action—never the answer, future evidence, proof paths,
  private IDs, or formal hidden facts. Automated learners receive behavior-only
  briefs, not scoring or discrimination targets.
- Prompt calls fail closed on speaker privilege and audited budgets. Follow the
  one permitted deterministic rebuild described in the prompt/world reference;
  if it does not pass re-audit, stop the turn.
- Preserve trace, prompt/model, learner-authorship, configuration, and output
  provenance. Treat observed model provenance in reports as authoritative;
  requested configuration in a plan is intent only.
- Default automated stopping is grounded closure with
  `--safety-turns 120`. Treat `auto_safety_turn_cap` as incomplete, and
  distinguish quota/network/output-limit failures from pedagogical failures.
- Negative, random, and bland arms are controls, not recommended pedagogy.
  Compare adaptive policies only when a same-run baseline/control is present.

## Mode and core defaults

Ask at most 1–3 concise questions when a materially important choice is missing.
Use defaults only inside the mode and execution scope the user authorized.

- Mode: `human`, `auto-eval`, `resume`, `abm-panel`, `analyze`, or
  `multi-eval`; default to `auto-eval` for an authorized comparison and
  `human` when the user will play the learner.
- World: `world_005_marrick`.
- Automated learner: `diligent`; use `core` routinely, `sentinel` for a
  cheap discrimination screen, `stress` for targeted failure modes, and
  `audit` only when an all-profile sweep is intentional.
- Runs: 3 for baseline comparisons, 5 for core/frontier policy comparisons,
  and 1 for ABM panels. Auto-eval parallelism defaults to 8; ABM is serial.
- Stop/token defaults: `--turns until-grounded`, `--safety-turns 120`, and
  `--max-tokens 4096`; auxiliary history defaults to `--history-turns 4`.
- Interactive roles default to speaking tutor `codex.gpt-5.6-terra` at
  medium effort, classifier/reasoning `codex.gpt-5.6-sol`, and automated
  learner `codex.gpt-5.6-terra`. Generic automated launches default
  otherwise-unpinned Codex roles to `codex.gpt-5.6-luna`. Frozen experiment
  pins and explicit authorized overrides win.
- Do not recommend `codex.mini`, `codex.gpt-mini`, or
  `codex.gpt-5-mini`; this local Codex route rejects them.
- Auto-eval output defaults under
  `.tutor-stub-auto-eval/<descriptive-run-id>`; ABM output defaults under
  `exports/tutor-stub-abm-panel`. Keep the local ignored ledger unless the
  user explicitly opts out.

## Route to detail

Read only the references needed for the current mode:

- Before composing or changing any launch, read
  [runtime and policy defaults](references/runtime-and-policy-defaults.md).
- Before every model-backed run, and for prompt/world authoring or prompt-audit
  work, read [prompt and world safety](references/prompt-and-world-safety.md).
- For passthrough, direct, scaffold, mixed, coach, voice, feedback, tuning,
  `--resume-last`, or interactive commands, read
  [human sessions](references/human-sessions.md).
- For auto-eval, failed-row resume, ABM, or policy-by-learner QA, read
  [automated runs and recovery](references/automated-runs-and-recovery.md).
- For existing artifacts, the report index, profile discrimination, field/state
  reports, multi-eval comparisons, SQL ingest, or result interpretation, read
  [analysis and results](references/analysis-and-results.md).

## Execution flow

1. Classify the request as zero-call inspection/analysis or authorized live
   execution. Record the exact source SHA and relevant existing artifact/run.
2. Read the mode reference and any linked safety/default reference before
   forming the command.
3. Before a model-backed run, complete the prompt/world preflight. Always
   dry-run first when model refs, policies, profiles, or output directories
   changed.
4. Run only the authorized bounded unit. On technical failure, apply the frozen
   recovery rule above; otherwise stop rather than widening scope.
5. Report the exact command or analysis source, source SHA, observed models,
   world/profile/policies, seeds/runs, output paths, completed/failed units, and
   whether the result is technical, incomplete, or interpretable. Stop when the
   requested gate is met.

## Long-running study status

Before launch, after each cohort or other meaningful milestone, at every
technical stop, before and after any recovery, and before analysis, send a
plain-language block in this form:

```text
State: RUNNING | PAUSED | BLOCKED | ANALYZING | COMPLETE
Model activity: active | inactive | not verifiable
Units: complete / active / failed / missing
Turns: completed / planned
Calls: reserved / completed / failed / hard ceiling
Repairs or recovery: counts and affected units
Last verified event: timestamp and evidence source
Current issue: plain-language description
Next safe action: action plus stopping condition
Human decision required: yes/no
```

Translate activity labels into concrete meaning: “investigating” must say what
evidence is being read, “monitoring” must say which event or artifact would
count as change, and “defining” must name the unfinished output. Report
configuration drift and distinguish provider-call failures from local budget or
runtime stops. If activity cannot be verified from process or provider
evidence, say `not verifiable`; timestamps alone do not prove a model call is
running. When nothing material changed, send the same block with `no material
change`. A worker sends this block to its coordinator, and the coordinator
relays it in plain language rather than forwarding an internal event name.

For a zero-call filesystem snapshot, use:

```bash
node scripts/report-tutor-stub-study-status.js <qa-artifact-root>
node scripts/report-tutor-stub-study-status.js <qa-artifact-root> --json
```

This reporter reads plans, events, traces, budgets, and seals only. It does not
prove live process or provider activity and must not be used as recovery
authority.
