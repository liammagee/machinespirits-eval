# Near And Medium Term Roadmap

This roadmap operationalizes `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md` after the
robustness verdict that the current hard-mode LLM evidence is flat against the
static baseline.

## Current Constraint

The current method does not establish robust positive effects under full
hard-curriculum LLM-learner evaluation. The major blocker is not only the
adaptive controller; it is also the evaluation design:

- the static tutor can often solve the current hard scenarios at ceiling;
- focused slices can look promising but do not generalize across curricula;
- rule-learner confirmation remains useful for regression only.

## Near-Term Track

### 1. Held-Out Hard Curricula

Add hard scenarios that were not used in the tuning loop and that exercise
different forms of adaptation:

- writing/argumentation: quote-dump evidence without warrant;
- science causal reasoning: changing multiple variables at once;
- programming/debugging: masking symptoms instead of tracing root cause;
- social-science measurement: treating one survey item as a construct.

These scenarios are available via:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --heldout \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/heldout-hard-llm-live \
  --timeout-ms 600000 \
  --permutations 200
```

### 2. Held-Out Robustness Gate

Evaluate held-out evidence separately from the original hard scenarios:

```bash
node prototypes/adaptive-persona-mvp/scripts/evaluate-robustness.js \
  --scenario-set heldout \
  --inputs prototypes/adaptive-persona-mvp/outputs \
  --out prototypes/adaptive-persona-mvp/outputs/robustness-evaluation-heldout \
  --permutations 1000
```

Promotion requires positive MVP, parent-dialogue, and outcome movement across
the full held-out set, not only one curriculum.

### 3. Transcript Evidence Pack

For every held-out live run:

```bash
node prototypes/adaptive-persona-mvp/scripts/export-transcript-digest.js \
  --input <heldout-report.json> \
  --out <heldout-output-dir>
```

The evidence pack should highlight:

- static baseline ceiling cases;
- static baseline failure cases;
- target repairs that visibly use challenge state;
- target over-directiveness or repeated transfer;
- learner-owned repair evidence.

## Medium-Term Track

### 1. Mechanism Attribution

Only after a held-out LLM run shows a public signal, run ablations:

- `controller_reflexive_psychodynamic_no_challenge_codex`;
- `controller_reflexive_psychodynamic_no_outcome_gate_codex`;
- `controller_reflexive_psychodynamic_ego_only_codex`;
- `controller_reflexive_psychodynamic_no_memory_codex`.

If the public held-out signal is flat, ablations are lower priority because
there is no effect to attribute.

### 2. State-Machine Formalization

Move the plain JavaScript finite state machine toward a LangGraph-equivalent
typed graph:

- typed state schemas for evidence, mastery, misconception, challenge state,
  relation, policy, persona, and memory;
- explicit guard logs for policy blocking and state transitions;
- deterministic replay from saved transcript events;
- declarative action-template merging.

### 3. Parent-Stack Adapter

Do not register a parent-project agent until the held-out prototype check is
interpretable. The safe adapter path is:

1. replay existing parent tutor-dialogue logs through the prototype state
   machine;
2. emit state labels and transition traces without changing parent scoring;
3. compare labels with judge or existing rubric outputs;
4. port only typed challenge state, outcome gates, and trace emission into
   `services/adaptiveTutor/`;
5. add a new adaptive cell rather than changing pre-existing cells.

## Decision Rule

If held-out LLM evaluation remains flat or negative, stop optimizing prompts in
the MVP. Treat the prototype as a mechanism-inspection tool and shift to parent
stack replay/adaptation experiments.

If held-out LLM evaluation shows a positive public signal, run replicated
held-out sweeps plus ablations before making any stronger claim.

## Current Held-Out Status

The first held-out LLM sweep produced a triage signal but not robustness:

- MVP `+5.625`;
- outcome `+25`;
- parent dialogue `-0.156`;
- robust held-out gate failed.

The actionable failure is counterfactual over-control. The controller rescues
resistant original branches in programming/debugging and social measurement,
but it often keeps repairing or summarizing ready learners after they have
already supplied the target success markers.

Near-term refinement before replicated held-out sweeps:

1. add a readiness-sensitive de-escalation guard; **done**
2. reduce `summarize_and_check` repetition after a ready branch has already
   transferred;
3. penalize unnecessary `repair_misrecognition` when the learner is merely
   objecting to repeated work rather than correcting the tutor's reading;
4. rerun held-out LLM and compare parent-dialogue movement on ready branches.

Focused programming rerun after the guard showed the guard firing correctly,
but not producing a public win because the static baseline solved the focused
slice at ceiling. This shifts the next medium-term priority from MVP prompt
tuning to evaluation and parent-stack integration:

- create trap designs where static transcript-only tutoring cannot infer the
  hidden learner state from the visible prompt alone; **initial trap track done**
- replay parent tutor-dialogue logs through the state machine; **read-only
  replay adapter done**
- port trace emission and challenge-state labels beside `services/adaptiveTutor/`
  only after replay proves the labels are informative.

## Trap And Parent-Replay Update

The next two tracks now exist as runnable prototype artifacts.

Hidden-state traps are available with `--traps`. They cover argument writing,
science fair-test design, programming debugging, and social-science
measurement. Each opening turn is intentionally ambiguous and tagged with
`trap_probe_required`, so the controller should first elicit a teach-back
rather than infer a misconception from the hidden branch. Original branches
then reveal false mastery; counterfactual branches reveal readiness and should
eventually de-escalate to `productive_struggle_hold`.

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/trap-scenarios-llm-live \
  --timeout-ms 600000
```

The parent replay adapter is available as:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 12 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay
```

It loads existing `evaluation_results` rows and `logs/tutor-dialogues/*.json`
traces, normalizes learner turns, runs them through the prototype state
machine, and emits prototype policy/challenge labels beside parent policy
actions. It is read-only and does not modify the parent DB or harness.

Current smoke evidence:

- trap dry run wrote `outputs/trap-scenarios-dry-run/` and produced positive
  parent-dialogue/outcome movement, but remains artifact-shape evidence only;
- parent replay smoke on four cross-suite adaptive rows wrote
  `outputs/parent-stack-replay-smoke/` with prototype trigger compatibility on
  `75%` of trigger branches and parent/prototype family agreement on `32.1%`
  of labelled turns.
- a broader twelve-row parent replay wrote `outputs/parent-stack-replay/` with
  prototype trigger compatibility on `33.3%` of trigger branches and
  parent/prototype family agreement on `33.7%` of labelled turns.

Follow-up parent-compatible mapping evidence:

- a twenty-four-row replay through the first mapped action layer wrote
  `outputs/parent-stack-replay-mapped/`, with raw prototype trigger
  compatibility on `25.0%` of trigger branches, parent-compatible trigger
  compatibility on `62.5%`, raw parent/prototype family agreement on `28.1%`,
  and mapped family agreement on `37.0%`;
- a scenario-prioritized mapping pass wrote
  `outputs/parent-stack-replay-mapped-v2/`, with parent-compatible trigger
  compatibility on `100.0%` of `48` trigger branches, but mapped
  whole-dialogue family agreement still only `37.5%` across `192` labelled
  turns.
- a diagnostic replay wrote `outputs/parent-stack-replay-mapped-diagnostics/`
  with mismatch tables. Trigger mismatches are empty; remaining disagreement is
  trajectory-level, especially scenario priors persisting after learner evidence
  has changed.
- a trajectory-aware mapping pass wrote
  `outputs/parent-stack-replay-trajectory-diagnostics/`. It preserved
  parent-compatible trigger compatibility at `100.0%`, raised mapped
  whole-dialogue family agreement to `54.7%`, and raised mapped non-trigger
  family agreement to `62.5%`.
- a transition diagnostic wrote
  `outputs/parent-stack-replay-transition-diagnostics/`. The harder
  transition metric is only `31.3%`, showing that the remaining problem is the
  sequence of action-family moves, not just single-turn label translation.
- the live LLM hidden-state trap sweep wrote `outputs/trap-scenarios-llm-live/`.
  It passed public triage on MVP and parent-dialogue deltas, but did not pass
  significance or robustness: MVP `+0.625`, parent dialogue `+0.625`, outcome
  `0`, one eligible run, eight paired branches.
- the trap robustness gate wrote `outputs/robustness-evaluation-traps/` and
  rejected robust positive effects because evidence is under-replicated, outcome
  is flat, and no public metric passes the non-trivial positive gate.

Interpretation: the prototype now has harder trap inputs, transcript-supported
trap outcomes, a transfer-observed gate, a read-only bridge into the parent
trace corpus, and a parent-compatible trigger-action adapter. The
trajectory-aware adapter now partially solves later-turn alignment too, and the
transition-aware adapter adds direct action-family sequence guards. The full
live trap rerun shows the harder gates are working: static original branches no
longer pass at ceiling. The adaptive target only clearly recovers programming,
however, and loses parent-dialogue ground overall. The next step is to improve
target transfer elicitation under these harder gates rather than relax the
gates.

Next non-integration replay work:

1. add decay/de-escalation to parent-compatible action mapping, so scenario
   family dominates the trigger turn but yields after learner-owned repair;
   **initial trajectory-aware pass done**
2. distinguish local clarification from substantive disagreement, especially
   `repair_misrecognition` vs `name_the_disagreement`;
3. separate overload from affective shutdown instead of collapsing both into
   the strongest repair family;
4. add trajectory-level checks that compare action-family transitions, not only
   individual-turn labels; **initial transition metric and transition-aware
   adapter done**
5. learn or hand-specify transition guards for scaffold -> substantive,
   substantive -> repair, and repair -> consolidation rhythms before any parent
   production adapter; **initial overload scaffold/substantive/repair guard
   done**
6. harden trap outcome tasks so baseline transcripts that repair once at
   surface level do not automatically pass; require delayed transfer,
   learner-owned boundary conditions, and resistance after apparent success;
   **transcript-supported trap validation done**
7. model transfer observation directly instead of treating a tutor transfer
   question as evidence of adaptation; **transfer-observed gate done**

Current non-integration targets:

1. rewrite transfer prompts/action templates so argument, science, and social
   measurement elicit learner-owned transfer by turn 2 instead of repeating a
   final transfer question; **initial `transfer_repair` pass done**
2. add an earlier "one-turn transfer repair" policy when `transferGate.status`
   remains `needs_learner_transfer` after a prior transfer prompt; **done for
   failed prompt attempts and last-response-turn hidden traps**
3. rerun the full live trap suite only after those target-behavior changes,
   because the latest full live run established no robust positive effect;
   **focused live science/social revalidation is positive, but full replicated
   trap evidence is still pending**
4. stabilize parent-dialogue losses by making transfer repair less checklist-like
   while preserving explicit learner-owned transfer markers;
5. add a reusable post-run revalidation script for expensive live transcript
   artifacts, so validator-marker updates are reproducible without reissuing
   LLM calls; **done as `scripts/revalidate-trap-report.js`**
