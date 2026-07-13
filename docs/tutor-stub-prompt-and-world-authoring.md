# Tutor-stub prompt and world authoring

This is the authoring contract for future tutor-stub scenarios and for curriculum modules compiled into dramatic-derivation worlds. It keeps proof control mechanical, speaking prompts economical, learner behavior credible, and world language intentional.

## Role boundary

The deterministic harness is the private planner. It may read the concealed answer, formal facts and rules, authored proof paths, the complete premise ledger, and the release schedule. This is a programmatic role; it is not another model call.

The speaking tutor is a public-state realizer. Its prompt may contain only:

- the public scene and question;
- natural-language rule glosses;
- public dialogue and compact public memory;
- evidence already released or explicitly due on the current turn;
- a bounded pedagogical action or response configuration.

Never pass the speaking tutor the answer, future evidence, proof paths, premise or rule IDs, formal fact notation, or a “do not reveal” copy of any of those things. Negative examples still disclose the material they quote.

The automated learner receives a behavior brief, not its measurement contract. State the recurring behavior, triggers, forbidden normalization, qualitative repair pattern, and public speech rules. Keep recurrence rates, turn deadlines, score bands, classifier targets, DAG targets, bottleneck labels, and discrimination thresholds in the external profile contract and analyzers.

## Prompt discipline

Each instruction should have one owner and appear once:

- system prompt: stable role, public world, public rules, and speaking boundary;
- turn prompt: compact public continuity, current evidence window, current learner move, and current action configuration;
- deterministic guards: release, leak, closure, repetition, and proof-state enforcement;
- analyzers: classification and measurement schemas;
- learner behavior brief: only behavior needed to produce the next public learner turn.

Do not ask a speaking model to reason about a constraint that the harness can enforce exactly. Do not repeat the latest public line both in native message history and in a separate transcript block. Prefer ordinary public language over internal labels.

Runtime calls are audited by `services/tutorStubPromptAudit.js`. The audit records character and approximate-token budgets, duplicated long instruction lines, and speaker-privilege violations. Base and turn prompts fail closed when a gate is crossed. Prompt audit snapshots are retained in traces.

## World and curriculum compilation

For a curriculum module, first identify the learning claim that should become mechanically warranted. Then author the smallest proof DAG that preserves the real conceptual dependencies.

1. Give every rule a plain-language public gloss.
2. Give every premise a learner-facing surface and an explicit evidence role.
3. Declare every minimal proof path, and remove premises that are not necessary to any intended path.
4. Mark genuine alternative routes explicitly; do not duplicate facts merely to pad the dialogue.
5. Use mirror, corroboration, orientation, and texture evidence deliberately. They must serve the learning or dramatic structure, not create redundant reasoning chores.
6. Release evidence in meaningful batches. Do not make the learner restate an inference and then separately record the same inference.
7. Keep the secret contingent on staged evidence rather than guessable from general knowledge or the public question.
8. Author presentation explicitly for every world: `temporal_frame`, `scene_ecology`, `narrative_diction`, `ledger_term`, and `summary`. There is no implicit “period language” fallback.
9. Put quantitative success criteria in the harness and reports, not in tutor or learner speech prompts.

The final language pass should ask: could a learner understand every public clue and rule without seeing the formal graph; does every requested reasoning step change what is licensed; and does the diction belong to this particular world rather than to a generic detective template?

## Required checks

Run the catalog authoring tool before any model-backed evaluation:

```bash
npm run derivation:quality
```

It checks proof lint, minimal and fully declared paths, duplicate facts, evidence roles, release progress, secret/mirror incompatibility, eligibility, and explicit presentation metadata.

Inspect the prompt architecture without a model call:

```bash
node scripts/tutor-stub.js \
  --dry-run \
  --no-trace \
  --world world_005_marrick \
  --dag \
  --tutor-learner-dag \
  --dag-mode defeasible_human_scaffold
```

The JSON must report `planner.owner = deterministic_harness`, `planner.modelCall = false`, and passing `baseSystem` and `baseSpeakerPrivilege` audits.

Run the regression gates:

```bash
node --test tests/tutorStubPromptAudit.test.js tests/derivationWorldQuality.test.js
```

Only after these pass should a new world proceed to deterministic smoke checks and then paid model runs.
