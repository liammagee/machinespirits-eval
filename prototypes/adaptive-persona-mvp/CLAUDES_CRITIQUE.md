# Claude's Critique of the Adaptive Persona MVP

A four-part review of the prototype after reading the arc summary, the
confirmed-run JSON evidence (`outputs/hard-mode-transfer-explicit-confirm-live/
replicated-comparison-2026-05-15T19-23-11-945Z.json`), the rule learner
(`src/dynamicLearner.js`), the controller core (`src/stateMachine.js`,
`src/evaluator.js`, `src/rubricComparison.js`, `src/harness.js`,
`src/assessmentHarness.js`), the challenge-state FSM
(`src/challengeState.js`), the parent rubric judge
(`src/parentRubricJudge.js`), the blind judge and static baseline prompts
(`src/assessmentPrompts.js`), the hard scenarios
(`config/assessment-scenarios.yaml`), the hard rubric
(`config/hard-adaptation-rubric.yaml`), and the iteration history
(`ITERATION_RESULTS.md`).

The review answers four questions the project owner asked:

1. Is the direction promising and credible?
2. Can it be integrated into the main line of research?
3. Can it be verified there?
4. What are the limitations?

## Observation that frames everything else

A three-side closed loop. Per the patch history (`ITERATION_RESULTS.md` lines
416-425), the fix for hard AI counterfactual was to *simultaneously*

- add "explicitly reject gender removal sufficiency" to the tutor's action
  template,
- update the rule learner so it emits that rejection only when the tutor
  reaches `transfer_challenge`, and
- tighten `performOutcomeTask`'s `rejectsSimpleFix` keyword check.

That is a coordinated three-side edit to make a closed loop close. It works,
but what it proves is that three hand-authored phrase lists can be aligned,
not that an adaptive controller is reading learner behaviour.

## 1. Is the direction promising and credible?

Promising mechanism, weak evidence. The architectural commitments are sound
and worth keeping:

- Externalised state that survives across turns: mastery via BKT-lite,
  `challengeState` FSM with `none -> active -> escalated -> resolved` levels,
  `relationState`, `persona`, `reflexiveMemory`.
- Programmatic policy gates that block transfer until repair markers appear
  (`buildOutcomeGate` in `stateMachine.js`).
- Action templates that merge domain misconception directives with
  challenge-state directives before being injected into the tutor prompt
  (`mergeActionTemplates` in `stateMachine.js`).
- Reflexive critique loop as a soft constraint on directiveness: Ego draft,
  Superego critique, Ego revision.

This is recognisably the same shape as `cell_110`'s `services/adaptiveTutor/`
(LangGraph state plus counterfactual replay), and that lineage is the right
target. The prototype has done the work of turning "adaptation" into a
measurable graph of state transitions instead of leaving it as a prompt-style
claim.

The headline result, however, is not credible as written. Three structural
problems.

### a) Closed-circuit gameability

`dynamicLearner.js` is a deterministic lookup table. `detectTutorMove`
regex-matches tutor text against the same phrase list (`proxy`, `audit`,
`biased labels`, `same whole`, `controlled comparison`, ...) that the
controller's domain templates instruct the tutor to produce. The learner then
returns a canned response containing the same keywords that
`performOutcomeTask` and the MVP rubric will look for. The 2026-05-15 hard-AI
patch edits three sides of that loop in one commit: tutor action template,
learner-proxy response template, and outcome scorer keywords. The +33pt
outcome gain is what happens when three hand-authored phrase lists are
aligned, not evidence that the controller reads learner behaviour.

### b) Effective n is roughly 6, not 24

The `n=24` is `3 scenarios x 2 branches x 4 repeats`. The four repeats reuse
the same scenario contract, the same `hidden_original`/`hidden_counterfactual`,
and the same misconception template. They are pseudo-replicates, not
independent observations. Per-cell variance confirms this:

- `mathematics|original` MVP diffs: `[5, 50, 0, 0]`.
- `statistics|original` outcome: `[0, 100, 0, 100]`.

Both are bimodal, not Gaussian. The sign-flip permutation `p=0.001` does real
work on the paired structure, but the `dz=0.847` is computed against an SD
that this kind of pseudo-replication compresses.

### c) Baseline is at the ceiling on half the cells

- `ai_literacy|original`: baseline 92.5, target 91.3 (-1.3).
- `statistics|counterfactual`: baseline 86.3, target 97.5.
- Outcome is tied at 100 in 16/24 branches.

The +17/+12.6/+33 means are driven by approximately six branches where the
baseline catastrophically fails (outcome 0) and the target rescues to 100.
That is a real rescue story, but it is not a uniformly larger effect.

So: a credible mechanism design, with the evidence over-reaching what the
simulator can support. The prototype's own `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md`
already acknowledges this ("the learner is still simulated"). The README's
next-steps put LLM learner proxies first for exactly this reason. That
ordering is right.

## 2. Can it be integrated into the main line of research?

Yes, and a path already exists. `cell_110`'s `services/adaptiveTutor/` is
structurally the same architecture: externalised learner state, programmatic
constraints, counterfactual replay. The prototype's contribution is three
concrete additions that `cell_110` lacks.

1. **`challengeState` FSM**: `none/active/escalated/resolved` with hand-coded
   signal detectors (forgetfulness, skepticism, disinterest, reversion). This
   is the most generalisable piece. It would slot into
   `services/adaptiveTutor/stateSchema.js` and `policyActions.js`.
2. **Reflexive Ego/Superego revision loop with psychodynamic vocabulary**
   (rescue fantasy, projection of mastery, compliance collusion). This
   already exists in the main repo as cells 22-33 for the standard runner;
   bringing it into the adaptive runner is straightforward.
3. **Outcome gate** that blocks `transfer_challenge` until repair markers are
   observed. This is the cleanest pedagogical primitive in the prototype:
   declarative, inspectable, testable.

### Integration shape (without contaminating §6.8's pre-registered scoring)

- Add `services/adaptiveTutor/challengeState.js`, ported from
  `prototypes/adaptive-persona-mvp/src/challengeState.js`, but rewrite the
  regex signal detectors to read structured fields the existing LangGraph
  nodes emit, not raw learner text.
- Add new cells (e.g. `cell_126_langgraph_adaptive_challenge_state`,
  `cell_127_langgraph_adaptive_reflexive`) in `EVAL_ONLY_PROFILES` and
  `config/tutor-agents.yaml`, `runner: adaptive`.
- Run on `config/cross-suite-trap-scenarios.yaml` against the existing
  `cell_125_dialogue_engine_crosssuite_baseline` and
  `cell_124_langgraph_adaptive_crosssuite`. Same `strategy_shift_correctness`
  scoring as §6.8.7.
- Use the `ego_superego` LLM learner, not the rule learner. The whole point
  of `cell_110` and §6.8 was that the simulated learner is an LLM with its
  own deliberation, not a phrase-list lookup.
- This becomes a new §6.8.8 in `docs/research/paper-full-2.0.md`, not a
  spin-off. The single-paper discipline applies. Framing: "the §6.8.6
  ablations isolated state-schema contribution; this §6.8.8 extension adds a
  typed challenge-state FSM and asks whether it improves over `cell_110`'s
  state policy on the same cross-suite."

Do not port the prototype's MVP adaptation rubric or the rule learner. Both
are simulator-aligned scoring. Cells must be judged by the project's v2.2
dialogue/tutor rubric and the binary `strict_shift` already used in §6.8.

## 3. Can it be verified in the main line?

Yes, but only after the simulator is replaced. Verification means: re-derive
the prototype's claims under the main-line scoring stack with an LLM learner,
on scenarios that aren't keyword-aligned with the rule learner's phrase
tables. Concretely:

1. **Replay the same three hard scenarios** (`hard_fractions_...`,
   `hard_ai_bias_...`, `hard_stats_...`) with `learnerMode: 'codex'`, i.e.
   the LLM learner proxy that already exists at `assessmentPrompts.js:82`
   (`buildLearnerProxyPrompt`). The summary doc lists this as task #1 of
   next-steps, and it is the load-bearing one. If the controller still wins
   +17 against an LLM learner that does not share the keyword detector's
   phrase table, the mechanism claim survives. If the effect collapses, the
   +17 was vocabulary alignment.
2. **Run `config/cross-suite-trap-scenarios.yaml` through the ported
   controller.** This is the test that integrates cleanly into §6.8.7's
   already-published comparison framework.
3. **Paired ablations of the three FSM additions** (challenge_state on/off ×
   Superego on/off × outcome gate on/off) on the LLM-learner version. The
   closing synthesis that `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md` §1 asks
   for ("characterise how the mechanism works") only becomes meaningful once
   the rule learner is removed; before that, ablations describe a circuit
   talking to itself.
4. **Reuse `cell_125` as the floor and `cell_110`/`cell_124` as the
   ceiling.** That gives an apples-to-apples comparison against the
   §6.8.4/.7 baselines without standing up new infrastructure.

If those three runs hold, `paper-full-2.0.md` §6.8.8 is the home. If only (1)
holds and (2)/(3) do not, it stays in the prototype directory as a contained
finding.

## 4. Limitations

### Mechanism limitations

- **Hand-coded domain directives carry significant load.**
  `challengeState.js` contains explicit per-domain strings like "For
  statistics... do not name heat, weather, water exposure, or swimming
  before the learner does." `domainMisconceptions.js` (167 LOC) is similarly
  hand-authored per discipline. The "mechanism" includes a non-trivial
  amount of curriculum-specific authoring that will not generalise to new
  domains without similar hand-work.
- **Signal detection is keyword regex.** `detectTutorMove`, the
  forgetfulness/skepticism detectors in `challengeState.js`, and the
  outcome-task success markers are all string-match. This is a brittle
  substrate for a "state machine that reads the learner" claim. In
  `paper-full-2.0.md`'s vocabulary, this is closer to the §6.8.6 P2.2
  "state schema" condition than to a learning-from-evidence mechanism.
- **The reflexive Superego is helpful but vocabulary-led.** The
  psychodynamic labels (rescue fantasy, etc.) are internal to the critic
  prompt; the actual constraint that survives is "do not be more directive
  than needed", which is a tone constraint, not a state-update mechanism.
  Iteration history (`ITERATION_RESULTS.md` lines 43-65) shows the
  all-variant triage initially failed on parent dialogue because controller
  repair moves were "too directive relative to the strong static baseline."
  The psychodynamic variant survived because its critic prompt damps
  directiveness. That is a real effect on dialogue tone, but it is not
  adaptation in the sense the framework promises.

### Evidence limitations

- **Closed-circuit simulator.** Already covered. The single most
  consequential limitation.
- **Effective n approximately 6.** Already covered.
- **Ceiling effects.** Already covered.
- **Variance is bimodal.** `[0, 100, 0, 100]` patterns suggest the
  controller occasionally hits the right rescue path and occasionally does
  not, rather than producing a uniform shift. The mean is the wrong summary
  statistic here.
- **`ai_literacy|original` is a regression.** -1.3 MVP, -9.7 parent
  dialogue, 0 outcome. The headline obscures this.
- **No deep-mechanism scoring on the confirmed variant.**
  `targetMechanismStatistics.deliberation` and `psychodynamic` are both
  `n=0` in the JSON (the run used `--skip-deep-reflexive`). The prototype's
  own next-steps name this as the priority, and it should be done before
  any integration.
- **Same model for tutor, learner-proxy, judge** (`codex-cli-default`).
  Cross-model judging matters more here than in v2.2 cross-judge work,
  because the parent dialogue judge is the only non-keyword signal channel.

### Framing limitations

- The paper-2.0 main line already has a clear story about adaptation in
  §6.8 (the trap-scenario suite). The prototype's "+17 vs static" claim, if
  folded in without re-derivation, would sit awkwardly next to §6.8.4's
  exploratory floor and §6.8.7's clean cross-suite test: different
  scenarios, different scoring, different learner architecture. Per the
  single-paper discipline, this cannot be a parallel-track contribution.
  It either lands as §6.8.8 with main-line scoring or it does not land.

## Synthesis

The prototype's value to paper-2.0 is architectural, not empirical. Three
pieces — the typed `challengeState` FSM, the outcome gate that blocks
transfer, and the reflexive critic's directiveness damping — are worth
porting into `services/adaptiveTutor/` and trying as new cells under
§6.8.7's cross-suite. The `n=24` result, as currently produced, is not
survivable as a main-line claim and should not be folded in. The right next
move is what the prototype's own §1 already asks for, plus task (1) from §5
of `ADAPTIVE_FEATURE_ARC_AND_NEXT_STEPS.md`: rerun the confirmed variant
against the LLM learner proxy on the main-line scoring stack, then decide
whether §6.8.8 exists.
