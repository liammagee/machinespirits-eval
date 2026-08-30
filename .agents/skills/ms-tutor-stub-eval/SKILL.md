---
name: ms-tutor-stub-eval
description: Configure, run, recover, or analyze tutor-stub detective-world experiments, including human sessions, automated policy or learner evals, QA matrices, field reports, and cross-run comparisons. Use ms-tutor-stub-study-status for a read-only status snapshot; inspection or analysis alone never authorizes model calls.
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
  in an already authorized run and only when the study question and design,
  model/provider, world/profile, seed/configuration/rubric, data/payload scope,
  and maximum attempt/spend ceiling remain unchanged. Record the source commit
  and dirt state as provenance; do not bind approval to source-file digests or
  treat a code-defect fix as a new scientific design. Preserve every completed
  and failed attempt; recover only missing or failed units through the existing
  mechanism into a fresh non-overwriting destination or checkpoint. Never
  rerun valid outputs or choose among outcomes.
- Stop and ask if a failure may be substantive, the same failure repeats and
  suggests an unresolved code defect, or recovery would change the study
  design, sealed data inputs, route, scope, budget, or interpretation.
- For a registered paid study, follow
  `docs/paid-study-authorization-policy.md`: a merged design, a clean detached
  launch commit containing it, and a signed GO note. Use the shared runner's
  create-once, ceiling, ledger, and archive behavior; never recreate the retired
  digest-bound request/certificate machinery inside this skill.

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

- Mode: `human`, `auto-eval`, `resume`, `analyze`, or `multi-eval`; default to
  `auto-eval` for an authorized comparison and `human` when the user will play
  the learner. ABM inspection, dry-run, and summarization are available, but
  the current ABM wrapper is not an approved live route because it does not
  pass the automated-eval lab and a hard per-dialogue model-call budget to its
  child processes.
- World: `world_005_marrick`.
- Automated learner: `diligent`; use `core` routinely, `sentinel` for a
  cheap discrimination screen, `stress` for targeted failure modes, and
  `audit` only when an all-profile sweep is intentional.
- Runs: 3 for baseline comparisons and 5 for core/frontier policy comparisons.
  Auto-eval parallelism defaults to 8.
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
  `.tutor-stub-auto-eval/<descriptive-run-id>`. ABM dry-run and report artifacts
  default under `exports/tutor-stub-abm-panel`. Keep the local ignored ledger
  unless the user explicitly opts out.

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
- For a status-only request about one existing QA or study session, stop routing
  here and use `$ms-tutor-stub-study-status` so the exact-worktree reporter and
  its read-only boundary are loaded.

## Execution flow

1. Classify the request as zero-call inspection/analysis or authorized live
   execution. Record the exact source SHA, dirt state, and relevant existing
   artifact/run.
2. Read the mode reference and any linked safety/default reference before
   forming the command.
3. Before a model-backed run, complete the prompt/world preflight. Always
   dry-run first when model refs, policies, profiles, or output directories
   changed.
4. Run only the authorized bounded unit. On technical failure, apply the
   unchanged-study recovery rule above and any stricter registered-study runner
   rule; otherwise stop rather than widening scope.
5. Report the exact command or analysis source, source SHA, observed models,
   world/profile/policies, seeds/runs, output paths, completed/failed units, and
   whether the result is technical, incomplete, or interpretable. Stop when the
   requested gate is met.

## Long-running study status

Before launch, after each cohort or other meaningful milestone, at every
technical stop, before and after any recovery, before analysis, and at least
every 60–90 seconds while a long-running study remains active, send a
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

For a zero-call filesystem snapshot, use `$ms-tutor-stub-study-status` rather
than recreating its exact-worktree resolution here. Its reporter reads plans,
events, traces, budgets, and seals only; it does not prove live process or
provider activity and must not be used as recovery authority.
