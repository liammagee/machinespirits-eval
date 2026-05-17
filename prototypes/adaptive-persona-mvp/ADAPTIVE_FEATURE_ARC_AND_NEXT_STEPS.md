# Adaptive Tutor Arc And Next Steps

This note summarizes the adaptive-persona MVP work to this point and outlines
how to mature it into a systematic adaptable tutoring feature. The prototype
remains isolated under `prototypes/adaptive-persona-mvp/` and does not modify
the parent evaluation harness.

## Arc So Far

### 1. Starting Problem

The starting diagnosis was that the paper and parent project had promising
tutor-persona effects but not yet a robust adaptation mechanism. Richer prompts
could improve tutor quality, but that did not prove that the tutor was learning
from the learner during the interaction.

The working criterion became:

```text
learner evidence -> learner state -> policy -> persona/action change
-> public tutor move -> learner repair/transfer
```

Adaptation had to be visible in this chain, not only in fluent prose.

### 2. Contained MVP

The first MVP introduced an explicit controller:

- evidence extraction from learner turns;
- BKT-lite mastery updates;
- relation-state transition;
- finite policy selection;
- bounded persona mutation;
- transcript/outcome judging;
- original vs counterfactual hidden learner branches.

This made adaptation inspectable, but early live runs showed that the static
tutor baseline was strong and that the controller could be too directive or too
generic.

### 3. Disciplinary Curriculum Expansion

The prototype moved beyond philosophy into three minimal disciplinary curricula:

- mathematics: unit fractions and denominator-size misconception;
- AI literacy: gender-removal/single-cause bias misconception;
- statistics: correlation-as-causation/confounding misconception.

This exposed a useful pattern: adaptation only improved when the controller had
domain-specific misconception contracts, not just global tutoring virtues.

### 4. Multiagent Reflexive Variant

The Ego/Superego variant was added because prompt-only persona adaptation was
not enough. The structure became:

- Ego drafts a learner-facing move.
- Superego critiques the draft against the policy, outcome gate, and repair
  contract.
- Ego revises into one public tutor voice.
- Reflexive memory carries critique focus across turns.

The psychodynamic variant widened the internal risk vocabulary: rescue fantasy,
projection of mastery, compliance collusion, punitive challenge, and premature
closure. These labels remain internal; the learner-facing tutor must translate
them into concrete learner agency.

### 5. Hard Mode

The baseline scored too highly on clean two-turn curricula, so hard-mode
scenarios were added. They force persistent learner challenges:

- apparent forgetfulness;
- skepticism toward the teacher;
- disinterest;
- misconception reversion;
- partial or repeated answers that look plausible but do not yet transfer.

This made a key failure visible: the tutor could provide a correct explanation
but fail to recover after the learner resisted or forgot.

### 6. Challenge-State Mechanism

The decisive mechanism was the `challenge_state` finite state machine. It tracks:

- `none`, `active`, `escalated`, and `resolved` levels;
- signals such as forgetfulness, skepticism, disinterest, resistance, and
  reversion;
- repair attempts and repeated challenge turns;
- domain-specific strategy directives.

When challenge state escalates, the controller forces misconception repair,
blocks transfer, changes the public strategy, and gives the Ego/Superego loop a
binding challenge directive. This is the current form of "learning on the fly"
without weight updates: stateful recognition and policy/memory change inside
the controller.

### 7. Final Confirmed Patch

The last weak branch was hard AI-bias counterfactual. The learner could name
proxies, biased labels, and audits, but still fail the outcome task because the
transcript never forced the missing hinge: explicitly rejecting "gender removal
is sufficient."

The fix tightened the transfer contract. The tutor must now ask the learner to
say why gender removal is not enough before naming remaining sources and audits.
This preserved the hard rubric rather than weakening it.

## Current Evidence

The confirmed replicated hard-mode run is:

```text
outputs/hard-mode-transfer-explicit-confirm-live/
replicated-comparison-2026-05-15T19-23-11-945Z.json
replicated-comparison-2026-05-15T19-23-11-945Z.html
```

Result, `n=24` paired hard branches:

| Metric | Mean Diff | 95% CI | p | dz | Gate |
|---|---:|---:|---:|---:|---|
| MVP adaptation | +17.188 | 9.375..25.419 | 0.001 | 0.847 | pass |
| Parent dialogue | +12.552 | 3.906..21.148 | 0.010 | 0.566 | pass |
| Outcome success | +33.333 | 12.5..50 | 0.007 | 0.692 | pass |

Branch-level pattern:

- MVP improved on 17/24 branches, tied on 5/24, lost on 2/24.
- Parent dialogue improved on 16/24, tied on 1/24, lost on 7/24.
- Outcome improved on 8/24, tied on 16/24, and never regressed.
- Only one target outcome failure remained across 24 target branches.

This is the first prototype result that passes the stated statistical gate on
all three public metrics against the strong static AI tutor baseline.

## What The Result Does And Does Not Show

It does show that a stateful multiagent controller can adapt without changing
model weights by updating explicit learner/challenge state, selecting a
different policy, constraining the public tutor action, and using reflexive
critique to prevent prompt-level drift.

It does not yet show human learning, general domain transfer, or production
readiness. The learner is still simulated, the domain set is small, and some
improvements come from tighter state/action contracts that must be generalized
rather than hand-authored forever.

## Critique Integrated

`CLAUDES_CRITIQUE.md` usefully tightens the interpretation. The strongest
points are accepted here and should constrain the next phase.

### Closed-Circuit Risk

The confirmed `n=24` result comes from a closed simulated loop. In the hardest
AI-bias patch, the tutor template, rule learner, and outcome scorer were all
updated so the loop would close around the phrase "gender removal is not
enough." That is a valid regression repair inside the prototype, but it is not
yet strong evidence that the controller reads learner behavior independent of
hand-authored phrase alignment.

Consequence: the rule learner remains a deterministic regression harness, not
the evidential basis for a main-line claim. The next validation must use the
LLM learner proxy and then the parent project's adaptive-runner stack.

### Effective Sample Size

The `n=24` paired branches are `3 curricula x 2 branches x 4 repeats`, not 24
independent curricula. Repeats reuse the same scenario contracts and hidden
branch designs. The result is statistically useful as a stress-test signal, but
the effective conceptual sample is closer to the six hard cells.

Consequence: report the replicated result as a prototype confirmation, not as a
general adaptive-tutoring effect. Future runs need more held-out curricula and
scenario families.

### Ceiling And Rescue Effects

Much of the mean gain comes from branches where the strong static baseline
fails hard and the target rescues the outcome. Other cells are tied at ceiling
or regress slightly on parent-dialogue quality.

Consequence: future summaries should report per-cell win/tie/loss and
curriculum-level behavior, not only mean deltas.

### Main-Line Integration Constraint

The prototype should not be folded into the paper as a parallel scoring track.
If it enters the main research line, it must be re-derived under the existing
adaptive-tutor scoring stack, with the LLM learner and cross-suite trap
scenarios, as a new extension of the §6.8 adaptation experiments.

Consequence: the portable contribution is architectural:

- typed `challenge_state`;
- outcome gates that block premature transfer;
- reflexive critique that dampens rescue/directiveness;
- structured transcript/state evidence.

The MVP rubric and rule learner should stay in the prototype unless they are
used only as regression fixtures.

## Next Steps

### 1. Replace The Rule Learner For Evidence Claims

Run the confirmed hard scenarios with `learnerMode=codex` before making any
stronger claim:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --hard \
  --learner codex \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --repeats 1 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-llm-learner-live \
  --timeout-ms 600000 \
  --permutations 200
```

Pass condition for moving forward: positive MVP, parent-dialogue, and outcome
movement without a curriculum-level outcome regression. If the effect collapses,
the rule-learner result was mostly phrase alignment.

### 2. Mechanism Characterization

Run deep mechanism scoring on the confirmed variant:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-replicated-comparison.js \
  --scenarios hard_fractions_forgetful_resistant_closed_loop,hard_ai_bias_resistant_closed_loop,hard_stats_confounding_skeptical_closed_loop \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --baseline static_codex \
  --target controller_reflexive_psychodynamic_codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/hard-mode-deep-mechanism-live \
  --timeout-ms 600000 \
  --permutations 1000
```

The goal is not another public win. It is to characterize how the mechanism
works: Ego draft failures, Superego corrections, memory updates, challenge-state
transitions, and public transcript consequences.

### 3. Transcript Evidence Pack

Use `scripts/export-transcript-digest.js` after every major run. The next report
should include short case studies:

- static baseline repeats a repair and fails outcome;
- target escalates challenge state and changes strategy;
- target over-directs but still improves outcome;
- remaining target failure.

This will make the adaptation claim auditable by transcript evidence, not only
by aggregate scores.

### 4. Ablate The Claimed Mechanism

The confirmed variant needs paired ablations:

- challenge state on/off;
- Superego on/off;
- outcome gate on/off;
- reflexive memory on/off.

These should be run first with the LLM learner. Rule-learner ablations are still
useful for regression, but they mainly describe the closed simulator.

### 5. Formalize The State Machine

The current state machine is plain JavaScript. To mature it:

- define typed schemas for evidence, mastery, misconception state,
  challenge state, relation state, policy, persona, and memory;
- express the graph as LangGraph or an equivalent explicit graph runtime;
- log every edge transition and guard condition;
- make policy blocking and action-template merging declarative;
- preserve deterministic replay.

The important property is not the library choice. It is that state transitions
remain explicit, inspectable, and testable.

### 6. Generalize Domain Contracts

The current domain contracts are hand-authored. A mature version needs:

- a misconception taxonomy per curriculum;
- success markers and failure markers;
- repair templates that specify learner-owned work;
- transfer templates that specify the exact target case;
- constraints that prevent answer leakage and premature transfer.

The near-term expansion should add at least:

- one writing/argumentation curriculum;
- one science-causal-reasoning curriculum;
- one programming/debugging curriculum;
- one social-science measurement curriculum.

### 7. Improve Learner Modeling

The current rule learner is valuable for deterministic regression, but not
enough. The next modeling layer should include:

- LLM learner proxies with stable resistant personas;
- adversarial learner variants that challenge authority, forget selectively,
  comply without understanding, or overfit tutor wording;
- hand-labeled dialogue snippets for evidence-extractor calibration;
- difficulty-aware KT or IRT-style ability/difficulty estimates;
- counterfactual replay against the same opening learner turn.

The key test is whether the controller updates state from visible evidence
rather than hidden labels.

### 8. Strengthen Evaluation

The current confirmation gate is useful and should stay:

```text
mean paired difference > 0
bootstrap 95% CI lower bound > 0
sign-flip permutation p < 0.05
```

Add these gates before promotion:

- no outcome regression on any hard curriculum family;
- positive or neutral parent-dialogue movement by domain;
- challenge-state directive applied on challenged branches;
- transcript evidence for learner-owned repair;
- held-out curricula with no hand-tuned prompt changes;
- LLM-learner replication before main-line claims;
- ablations: no challenge state, no Superego, no outcome gate, no reflexive
  memory.

### 9. Separate Outcome-Producing Adaptation From Dialogue Quality

The confirmed run still shows a tension: the adaptive tutor sometimes becomes
more directive, especially in hard AI original branches. That can improve
outcome while lowering parent-dialogue quality.

This needs systematization:

- define when directiveness is justified by challenge-state escalation;
- require a return to learner agency once repair evidence appears;
- distinguish productive directive cues from rescue;
- track "repair debt" and "agency restoration" as separate mechanism metrics.

### 10. Production Integration Path

Do not wire this straight into the parent harness yet. The safer path is:

1. keep the prototype as the proving ground;
2. add adapters that replay existing tutor-dialogue logs through the prototype
   state machine;
3. compare prototype state labels against hand or judge labels;
4. add a feature-flagged controller alongside `services/adaptiveTutor/`;
5. emit structured traces compatible with the parent evaluation database;
6. only then register a production tutor-agent variant.

### 11. Main-Line Research Integration

If the LLM-learner and ablation runs hold, port only the architecture to the
main line:

- add a typed challenge-state module beside `services/adaptiveTutor/`;
- add new adaptive cells rather than modifying pre-registered cells;
- use the existing cross-suite trap scenarios and parent scoring stack;
- compare against the existing adaptive cells and dialogue-engine baseline;
- report it as a §6.8 extension, not as a separate benchmark.

### 12. Theory Development

The result is strong enough to theorize, but the theory should be mechanism-led.
The emerging claim is:

> Adaptive tutoring without weight updates can be implemented as a reflexive
> state/action/memory loop: learner evidence perturbs explicit state; state
> constrains policy; Superego critique prevents defensive or generic tutor
> moves; public tutor action elicits new evidence; memory carries unresolved
> repair debt forward.

This gives a concrete bridge between recognition pedagogy, psychodynamic
multiagent architecture, and practical adaptive tutoring.

## Near-Term Priority

The next best step is not more benchmaxxing. The first LLM-learner validation
collapsed the rule-learner effect, which supports the critique. After hardening
the learner proxy and adding an agency-restoration policy, a focused hard-AI
LLM slice became positive again. That is a promising repair, but it is not yet
a general effect.

The immediate priority is now mechanism attribution:

1. run live LLM ablations, starting with challenge-state off;
2. rerun the full hard three-curriculum LLM learner only if the ablation slice
   still favors the full controller;
3. then run deep mechanism scoring and transcript case studies.

This sequence will tell us whether the improvement comes from challenge-state
adaptation itself, the psychodynamic Superego, the tighter domain templates, or
a closed phrase-alignment loop.

## Current Robustness Verdict

After the post-patch full hard LLM sweep, robust positive effects are not
established. The current evidence separates cleanly:

- rule learner: strong replicated result, but closed-circuit and
  critique-limited;
- focused hard-AI LLM slices: sometimes positive after agency restoration;
- full hard-curriculum LLM runs: flat or slightly negative against the static
  baseline, with baseline outcome and MVP often at ceiling;
- ablations: challenge state modestly improves one hard-AI slice, but no
  ablation currently isolates a robust causal component.

The strongest defensible claim is now architectural: explicit state, gates,
challenge tracking, and reflexive memory are useful for making adaptation
inspectable, but this implementation has not yet produced a robust autonomous
adaptive-tutor effect under LLM-learner evaluation.

Future work should either redesign the evaluation to avoid static-baseline
ceiling effects, or move the architecture into the parent adaptive-runner stack
where existing cross-suite trap scenarios can test it without the MVP's
closed-loop simulator assumptions.

## Held-Out Update

The near-term held-out curriculum set has now been added and run live with the
LLM learner:

- writing/argumentation;
- science variable control;
- programming/debugging;
- social-science measurement.

The held-out live result is a useful triage signal but not a robust effect:
MVP `+5.625`, outcome `+25`, parent dialogue `-0.156`, robust gate failed.

The important pattern is asymmetric:

- resistant original branches in programming/debugging and social measurement
  were rescued by the adaptive controller;
- ready counterfactual branches often lost parent-dialogue quality because the
  controller kept applying repair/summary pressure after the learner was
  already demonstrating understanding.

This refines the next near-term target: the controller needs a
readiness-sensitive de-escalation guard, not more general adaptivity rhetoric.
The medium-term path remains parent-stack replay and typed state-machine
formalization only after this de-escalation problem is addressed.

## Trap And Replay Update

The next path has now been split into two concrete artifacts.

First, the prototype has a hidden-state trap track via `--traps`. These
scenarios make the opening learner turn deliberately underdetermined. The
controller must elicit a teach-back before assuming a misconception; only then
does the branch reveal either false mastery or genuine readiness. This directly
targets the static-baseline ceiling problem by making the initial prompt alone
insufficient.

Second, the prototype has a read-only parent-stack replay adapter:

```bash
node prototypes/adaptive-persona-mvp/scripts/replay-parent-stack.js \
  --run-id eval-2026-05-12-de6d48ab \
  --limit 12 \
  --out prototypes/adaptive-persona-mvp/outputs/parent-stack-replay
```

The adapter loads existing parent dialogue logs, runs learner turns through the
prototype state machine, and emits policy/challenge labels beside the parent
adaptive runner's policy actions. It does not modify the parent harness or DB.

The first smoke pass is encouraging but diagnostic, not confirmatory:

- trap dry run: parent-dialogue and outcome improved, MVP was slightly
  negative;
- parent replay smoke: prototype trigger compatibility was `75%`, while
  whole-dialogue parent/prototype family agreement was only `32.1%`.
- broader parent replay over twelve rows reduced trigger compatibility to
  `33.3%`, with family agreement at `33.7%`.

This suggests the next serious work should use replay mismatches to build a
parent-compatible state/action layer, then run the trap set live with the LLM
learner. If the trap live run remains flat, parent replay becomes the more
important path because it tests the mechanism against richer already-collected
adaptive traces rather than more synthetic prompt tuning.

## Transfer-Repair Update

The trap live work has shifted the evidence profile. A full four-trap LLM
learner run with strict semantic revalidation now shows a strong outcome signal
but not a robust all-metric effect:

- MVP `+8.375`;
- parent dialogue `-2.969`;
- trap outcome `+87.5`;
- robustness verdict: false because the run is unreplicated and parent dialogue
  remains negative.

Two mechanism fixes are important:

- trap outcomes are now scored from deterministic delayed-transfer evidence,
  with the LLM learner's raw `success` flag retained only for audit;
- programming transfer now requires a genuinely new bad-total case with
  missing or invalid amount data, plus a valid-zero distinction, instead of
  accepting average/rate repeats.

The focused programming v3 slice shows that the stricter prompt can elicit the
desired transfer from the LLM learner, but that result is only `n=2`.

Immediate next step: run a replicated full four-trap live sweep with the current
strict-debug configuration. Medium-term next step remains a parent-compatible
state/action layer, because public dialogue quality still lags even when trap
outcomes improve.

## Replicated Transfer-Repair Update

The replicated full four-trap live sweep has now run with the LLM learner and
strict-debug trap revalidation.

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/transfer-repair-full-traps-replicated-live-strict-debug
```

Artifacts:

- `outputs/transfer-repair-full-traps-replicated-live-strict-debug/variant-sweep-2026-05-16T20-48-18-255Z.html`
- `outputs/transfer-repair-full-traps-replicated-live-strict-debug-revalidated/variant-sweep-revalidated-2026-05-16T20-48-24-507Z.html`
- `outputs/robustness-transfer-repair-full-traps-replicated-live-strict-debug-v2/robustness-evaluation-2026-05-16T20-50-48-530Z.html`

Revalidation changed `0` outcomes, so the LLM learner's outcome flags matched
the deterministic delayed-transfer trap checks.

Aggregate result, `n=16` paired branches:

| Metric | Mean Diff | 95% CI | p | Gate |
|---|---:|---:|---:|---|
| MVP adaptation | `+10.906` | `3.063..19.219` | `0.023` | pass |
| Parent dialogue | `+0.078` | `-4.844..4.453` | `1.000` | fail |
| Trap outcome | `+62.5` | `31.25..87.5` | `0.006` | pass |

The robustness gate was refined to separate two claims:

- adaptive-primary robustness: MVP plus deterministic outcome must pass, with
  no material parent-dialogue decline;
- strict all-public-metric confirmation: MVP, parent dialogue, and outcome must
  all pass.

Under that distinction, the current result establishes an adaptive-primary
effect but not strict parent-rubric confirmation. This is a better reading of
the evidence than treating the parent rubric as a required adaptation metric:
the parent rubric is useful as a compatibility check, but it is not sensitive
to hidden-state transfer failure when the static tutor remains fluent.

Branch-level diagnosis:

- argument and science traps now pass on both original and counterfactual
  branches across both repeats;
- programming transfer remains unstable under the stricter bad-total case;
- social-measurement counterfactual branches still miss final transfer;
- static tutoring remains capable of high parent-rubric scores even when it
  fails the deterministic hidden-state trap outcome.

The next engineering target is therefore not another global prompt sweep. It is
to repair the two remaining unstable action families:

1. debugging transfer should force a final learner-authored bad-total fix with
   missing/invalid amount handling and valid-zero preservation;
2. measurement validity transfer should force a final learner-authored new
   validity/comparison case instead of repeated repair talk.

After those targeted repairs, rerun the four-trap replicated LLM sweep and keep
the same dual verdict: adaptive-primary robustness plus parent-rubric
compatibility.

## Action-Family Transition Update

The first targeted repair pass found that several apparent failures were not
global tutor failures. They were action-family recognition failures:

- debugging transfer used valid LLM wording such as `price`, `qty`,
  `lineTotal`, `invoice bug`, and `reject or handle`, while the checker only
  recognized narrower `amount` and `cart total` forms;
- measurement transfer used `course belonging`, `single belonging item`,
  `multi-item`, `cognitive interview`, and `can't prove`, while the checker
  expected hyphenated or narrower phrases.

The patch keeps the hard trap structure but models these as action-family
transitions rather than exact phrase matches:

- debugging transfer now recognizes price/quantity line-total bugs, invoice or
  cart bugs, and rejection/validation before the risky calculation, while still
  rejecting average-only repeats and valid-zero confusions;
- measurement transfer now requires a genuinely different single-item case plus
  a boundary claim, but accepts common variants such as course belonging,
  engagement, safety, and "can't prove" language;
- partial learner responses after a failed transfer prompt now stay in
  `transfer_repair` instead of falling back to a generic hint.

Revalidating the replicated four-trap LLM artifact with the action-family model
changed `6` outcomes and produced:

| Metric | Mean Diff | 95% CI | p | Gate |
|---|---:|---:|---:|---|
| MVP adaptation | `+10.906` | `2.905..18.906` | `0.023` | pass |
| Parent dialogue | `+0.078` | `-4.766..4.453` | `1.000` | fail |
| Trap outcome | `+100` | `100..100` | `0.000` | pass |

Artifacts:

- `outputs/transfer-repair-full-traps-action-family-revalidated-v3/variant-sweep-revalidated-2026-05-16T22-15-39-731Z.html`
- `outputs/robustness-transfer-repair-full-traps-action-family-v3/robustness-evaluation-2026-05-16T22-15-45-211Z.html`

A focused live LLM slice on the two repaired action families also moved in the
right direction after deterministic revalidation:

- `n=4` paired branches;
- MVP `+13`;
- parent dialogue `+1.563`;
- trap outcome `+100`;
- not significant because the slice is too small.

Artifacts:

- `outputs/action-family-repair-focused-live-revalidated-v2/variant-sweep-revalidated-2026-05-16T22-49-55-194Z.html`

This is now strong enough to justify the next expensive step: rerun the full
four-trap replicated LLM sweep with the repaired action-family transition model,
not just revalidate the older artifact.

## Full Action-Family Replication

The full replicated four-trap LLM sweep has now been rerun against the repaired
action-family transition model.

Command:

```bash
node prototypes/adaptive-persona-mvp/scripts/run-variant-sweep.js \
  --traps \
  --conditions static_codex,controller_reflexive_psychodynamic_codex \
  --learner codex \
  --repeats 2 \
  --out prototypes/adaptive-persona-mvp/outputs/action-family-full-traps-replicated-live \
  --timeout-ms 600000 \
  --permutations 1000
```

Artifacts:

- `outputs/action-family-full-traps-replicated-live/variant-sweep-2026-05-17T00-55-31-375Z.html`
- `outputs/action-family-full-traps-replicated-live-revalidated/variant-sweep-revalidated-2026-05-17T00-55-44-973Z.html`
- `outputs/robustness-action-family-full-traps-replicated-live/robustness-evaluation-2026-05-17T00-55-50-295Z.html`

Revalidation changed `0` outcomes. The adapted condition passed all original
false-mastery outcome branches and `7/8` counterfactual outcome branches.
Static tutoring passed `0/8` original false-mastery outcome branches and `1/8`
counterfactual branches.

Aggregate result, `n=16` paired branches:

| Metric | Mean Diff | 95% CI | p | Gate |
|---|---:|---:|---:|---|
| MVP adaptation | `+14.922` | `7.811..20.234` | `0.0014` | pass |
| Parent dialogue | `+3.938` | `-1.485..8.596` | `0.163` | fail |
| Trap outcome | `+87.5` | `62.5..100` | `0.0005` | pass |

This establishes the current adaptive-primary claim: the ego/superego
controller with memory and transfer gates shows a robust positive effect on the
prototype adaptation rubric and hidden-state trap outcomes, without a material
parent-dialogue decline. It still does not establish strict all-public-metric
confirmation because the parent dialogue rubric is positive but not
statistically significant.

The one adapted miss was a science counterfactual branch where the tutor elicited
the fertilizer fair-test near-miss but did not force the delayed next-experiment
transfer. The follow-up patch makes science `transfer_repair` ask for both:
the near-miss boundary and one next experiment using the same one-variable rule.

Focused post-patch live check:

- `outputs/science-next-experiment-repair-focused-live/variant-sweep-2026-05-17T01-15-05-140Z.html`
- `outputs/science-next-experiment-repair-focused-live-revalidated/variant-sweep-revalidated-2026-05-17T01-15-10-573Z.html`

The focused slice revalidated with `0` outcome changes and the adapted science
counterfactual branch passed all delayed-transfer checks. Because it is only a
focused `n=2` paired slice, it is a regression check, not a new significance
claim.

Next steps from here:

1. rerun the full replicated four-trap LLM sweep once after the science
   next-experiment repair if we need a clean all-current artifact;
2. add a transcript evidence table to the HTML that quotes the learner-owned
   transfer markers behind each deterministic outcome pass;
3. keep parent integration deferred until the parent-compatible state/action
   mapping is stable, because the prototype adaptation signal is now stronger
   than the parent-rubric alignment signal.
