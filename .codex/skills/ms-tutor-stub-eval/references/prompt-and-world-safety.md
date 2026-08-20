# Prompt and World Safety

Read this reference before any model-backed run and whenever prompts, worlds, public-evidence boundaries, or prompt-audit recovery are in scope.

## Prompt and World Authoring Boundary

Follow `docs/tutor-stub-prompt-and-world-authoring.md` when changing prompts,
authoring a dramatic-derivation world, or compiling a curriculum module into
this world format.

- The deterministic harness is the private planner and has the full world
  contract. It is not an LLM role.
- The speaking tutor receives only the public scene, public rule glosses,
  public dialogue, current public evidence, and a bounded response action.
  Never pass it the answer, future evidence, proof paths, IDs, or formal facts,
  even inside negative examples.
- Automated learners receive behavior-only briefs. Quantitative recurrence,
  scoring, classifier, DAG, and discrimination targets remain in the external
  profile contract and analyzers.
- Runtime prompt calls are fail-closed on budgets and the speaker-privilege
  boundary. A tutor prompt that fails only because identical long instruction
  lines were composed twice is compacted once, recorded as
  `prompt_audit_recovery`, and re-audited. A speaker-privilege failure blocks
  the contaminated call and permits one deterministic rebuild from the public
  turn contract only: base speaker rules, public continuity and evidence,
  response composition, any due dramatic release, the compact response
  configuration, and the learner message. The rebuilt prompt must pass both
  privilege and budget/duplication audits before a fresh call may proceed;
  otherwise the turn still stops.
- Every world must explicitly author `temporal_frame`, `scene_ecology`,
  `narrative_diction`, `ledger_term`, and `summary`.

Before any model-backed run, execute:

```bash
npm run derivation:quality
node --test tests/tutorStubPromptAudit.test.js tests/derivationWorldQuality.test.js
```

Use the normal `tutor-stub.js --dry-run --dag ...` JSON to verify that the
deterministic planner and the base prompt audits are recorded and passing.
