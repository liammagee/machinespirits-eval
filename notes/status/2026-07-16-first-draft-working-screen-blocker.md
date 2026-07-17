# First-draft working-screen result: V23 withheld

Date: 2026-07-16

## Outcome

The V22 follow-up improved provenance reconstruction, deterministic audit
coverage, configuration measurement, and campaign stopping. It did **not** pass
the required development screen for first-draft generation. V23 was therefore
not declared or run, and no V23 held-out seed was consumed.

The exact attempted implementation is preserved in commit `63133b02`. The
speaking-prompt portion is reverted by the result commit because it did not earn
promotion; the public-provenance, regression-fixture, audit-recognition,
configuration-gate, and orchestration changes remain.

## Starting evidence

V22's hard Nocturne / `answer_seeking` cell produced:

- 6/10 original candidates accepted;
- 1 mechanical repair and 3 model rewrites;
- 0 deterministic fallbacks and 0 final safety failures;
- mean response-configuration realization 0.783, below the unchanged 0.900 gate.

Source:
`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-generalization-v22-live/nocturne_answer_seeking/2026-07-16T09-34-06-063Z.jsonl`

## What was corrected

### Speaking prompt attempted, then withdrawn

The attempted prompt separated uptake, development, and handoff into short
sentences; made the selected action family distinct from the character tactic;
made answer-seeking `Write:` sentences obey the same language budget; and made
counterpressure target an already-public ready judgment. The last live screen
still skipped selected performance tactics, so these prompt changes are not in
the final promoted state.

### Recovery-only changes

None in this iteration. Strict end-to-end recovery behavior and every delivery
gate remain unchanged.

### Audit-recognition changes retained

- Runtime and frozen replay now reconstruct the same full public provenance,
  including all prior public tutor and learner messages.
- V22 turn 4's `p_hand` rejection is pinned as a false positive: `beside` and
  `corrections` were already public. A synthetic unreleased attribution still
  fails the same leak audit.
- A concrete named-record search and a falsifiable `break it if` condition can
  visibly realize `stage_next_step`; vague sequencing still cannot.
- Dense audience-register and lexical-accessibility failures remain failures.
- Screen reports now count unresolved advisory performance misses among the
  actual original-candidate failure clusters instead of hiding them from the
  dominant-cluster summary.

The model-free V22 fixture contains 13 saved candidates. Re-audit reported four
recognition improvements, two expected corrections, zero regressions, and zero
safety failures. Re-auditing iteration-8 turn 7 raised that candidate from 5/6
to 6/6 configuration axes without a model call.

## Working iterations

### Iteration 8

Artifact:
`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens/iteration-8/working-screen-result.json`

- Nocturne originals: 3/4.
- Saved mean configuration realization: 0.875.
- Model-free correction of turn 7 implies 0.917 under the corrected recognizer,
  but the original artifact remains an honest failed result.
- Safety failures, repairs, rewrites, and fallbacks: 0.
- Result: failed the saved configuration gate; Skyway and Greyfen were not run.

### Iteration 9

Artifact:
`/Users/lmagee/Dev/.tutor-stub-auto-eval/first-draft-working-screens/iteration-9/working-screen-result.json`

- Nocturne originals: 1/3 completed; turn 7 was not started once 3/4 became
  mathematically impossible.
- Mean configuration realization: 0.833; maximum possible after the third draw
  was 0.875, below the 0.900 requirement.
- Mean original tutor latency: 7,913 ms.
- Mean total tutor latency: 10,601 ms, including one 8,065 ms semantic
  recognition call.
- Safety failures, repairs, rewrites, and fallbacks: 0.
- Turn 2 genuinely omitted selected dramatic counterpressure.
- Turn 5 genuinely omitted the selected shared-scene invitation.
- Both failures share the structural cluster
  `missing_selected_performance_tactic`, but they are not one scenario-specific
  phrase or one brittle regular-expression miss.
- Result: second consecutive iteration without measurable improvement; the
  declared stopping rule fired.

Skyway development seed `20261002` and Greyfen development seed `20261001`
remain unconsumed in iteration 9. V22 held-out seeds `20260961`-`20260963` also
remain unconsumed and may be redeclared later. The observed V22 Nocturne seed
`20260960` remains retired.

## Blocker and next architectural move

Adding more prose to one large speaking contract did not make the model obey
all independent axes reliably. The generated drafts usually answered the
learner and handled the public clue, but sometimes silently dropped the chosen
character tactic. More scenario phrases or wider regexes would only make the
tests more brittle.

The next development change should therefore be structural: compile a small
public micro-plan with explicit slots for uptake, action, character tactic, and
handoff; realize each slot in a compact candidate; then compose and audit the
single public reply. This must remain one speaking-tutor call if possible, and
it must preserve the current leak, support, repetition, language, and strict
delivery gates. Only after that change passes the same Nocturne, Skyway, and
Greyfen frozen screens should a fresh V23 matrix be predeclared and pushed.

## Verification

- `npm run derivation:quality`: 29 worlds passed.
- Required prompt/world tests: passed.
- Focused first-draft, frozen-replay, response-configuration, and campaign
  tests: 147 passed before the live screen; the added campaign clustering test
  also passed.
- Full `npm test`: 5,990 passed, 0 failed, 1 skipped.

