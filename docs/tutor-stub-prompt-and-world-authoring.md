# Tutor-stub prompt and world authoring

This is the authoring contract for future tutor-stub scenarios and for curriculum modules compiled into dramatic-derivation worlds. It keeps proof control mechanical, speaking prompts economical, learner behavior credible, and world language intentional.

## Role boundary

The deterministic harness is the private planner. It may read the concealed answer, formal facts and rules, authored proof paths, the complete premise ledger, and the release schedule. This is a programmatic role; it is not another model call.

Before learner-language analysis, the harness also computes a narrower public-only learner-DAG preflight from the prior public learner record, committed public evidence, and public rules. That preflight may constrain which premise ids and conclusions are eligible, but it commits nothing and must never be treated as evidence that the learner voiced them. The analysis model proposes a semantic mapping from the current learner language; the deterministic postprocessor remains the sole authority for accepting learner-DAG progress.

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

## Opening the public scene

The harness owns only four opening requirements:

- state or enact the public situation;
- keep the exact public question visible;
- imply no evidence that is unavailable at the opening;
- when no clue is available, invite observation or clarification.

It does not own a reusable opening sentence. For each world, the opening is
either exact authored speech or a fresh realization by the active speaking
tutor model (Terra by default) from a public-only opening frame. The frame
contains the setting, question, presentation metadata, and only those premise
surfaces scheduled for the opening. It never contains the secret, future
releases, proof paths, formal facts, or learner-DAG state.

Exact authorship is optional:

```yaml
opening_frame:
  # Optional: a shorter public situation for model realization. Otherwise the
  # normal world setting is used.
  situation: >-
    Priya has the fridge door open and the incident log lies blank by the sink.

  # Optional: exact tutor speech. Omit this field to let the speaking model
  # realize the frame in the world's authored diction.
  authored_text: >-
    Priya has the fridge door open and the office is already pointing at
    Dario. The incident log is still blank: Who took Priya's labelled lunchbox
    from shelf two of the studio fridge? Tell me what you want checked first —
    or stop me if any part of that question needs unpacking.
```

Every candidate is audited for the four requirements and the normal public
evidence boundary before it enters history. A failed model realization falls
back to a deterministic opening assembled from that world's public situation,
question, in-world ledger term, and opening clues. The former shared “Keep the
case question in view” boilerplate is not part of this fallback.

## Dramatic clue releases

A public tutor turn after learner speech is one atomic assistant message and one continuous public performance. Internally it has two auditable functions: uptake responds to the learner's actual contribution by crediting, answering, qualifying, correcting, or receiving it; development performs the selected next pedagogical action. These functions must flow as one utterance, without a blank line, arrow, heading, role label, theatrical aside, or audible change into a second tutor voice. The private planner builds this composition from the public learner analysis, learner-DAG assessment, and independently selected response configuration; the speaking tutor realizes it without naming that machinery. Learner-responsive action families such as accountable answering are realized in uptake; progression actions such as staging the next step are realized in development alongside the expected DAG or interaction move. The engagement stance, audience, language, and scene settings govern both.

The response configuration also selects an independent `actorial_part`: scene partner, evidence examiner, record-keeper, authored clue source, advocate, skeptic, or keeper of the final finding. Stance determines how the tutor relates; action family determines the pedagogical operation; the part determines what the tutor visibly does in the scene. Each stance is compiled into a concrete `actorial_performance` tactic—such as an evidentiary boundary, rapid handoff, shared-scene invitation, measured testimony, or dramatic counterpressure—so a structurally fixed clue source can still perform differently from turn to turn. The same adaptive temperature sharpens or broadens stance and part distributions, but does not temperature-scale the other axes. For an authored clue source, realize the part by speaking its clue from inside the role in first person, inside quotation marks. A role-name prefix or stage direction such as “Front-desk clerk, opening the log:” is description of acting, not acting, and is rejected. Other parts use concrete first-person action or direct speech as their contract requires. A part is a public performance contract, never a knowledge privilege: it may use only already-public evidence or the clue explicitly due in the current turn.

A scheduled release is a public dramatic development function, not an invisible state update or a visibly separate message. On every turn with newly available evidence, the continuous reply must let a character, object, interruption, gesture, or spoken line signal the clue's arrival inside the scene; directly enact its source or handle its exhibit using the selected performance tactic; and keep the learner inside the scene with one light interpretive question. Do not announce the acting with phrases such as “let's role-play,” “I'll be the clerk,” or “back to the case.” Guards reject those meta-theatrical frames, role-label stage directions, and releases where the selected part or performance tactic remains merely a label. They audit uptake and development separately in the trace while preserving a single seamless public utterance and any already-safe learner acknowledgement during repair. Evidence is committed only after the complete transactional turn passes its checks.

The default follows `via`: `director` evidence is enacted as an in-scene role, while `tutor` evidence is presented as an exhibit, record, observation, or demonstration. For a more exact performance, author a release presentation:

```yaml
release_schedule:
  - turn: 5
    premise: p_notice
    via: director
    presentation:
      mode: enacted_role
      role: building manager reading the lift notice
      cue: "She unfolds the notice and reads the small print aloud."
```

Supported modes are `enacted_role` and `presented_exhibit`. A role or cue may change how the clue enters, but must not add evidence beyond the linked premise surface. Write cues as playable stage business or direct speech—not an instruction to announce role-play. Avoid generic omniscient narration when an existing witness, clerk, examiner, document, or physical exhibit can carry the information inside the scene.

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
