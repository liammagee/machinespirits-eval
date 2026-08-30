---
name: ms-drama-machine
description: Assemble a reproducible pedagogical-drama spec from a freeform brief and validate its slot and turn-plan design. Use for one-off drama specification; use ms-curriculum-drama for course-derived suites. Generation and judging are currently out of scope because their combined model-call ceiling is not enforced.
---

You assemble a **drama** for the drama machine. A drama is a binding of values to slots across the six Aristotelian parts (mythos/ethos/dianoia/lexis/opsis/melos) + the audience + the cast. Your job: turn the user's brief into a *complete, valid, runnable* spec, being honest about what runs today vs what is roadmap.

## Current execution boundary

This skill ends after writing and validating the spec. Do not lower into a
tracked config path, generate transcripts, or invoke either critic. The current
generation and panel-judging chain does not expose one enforced aggregate
model-call ceiling, and the historical `--consensus` example is not accepted by
the graded critic. A later runtime-hardening task may re-enable those stages.

**The model is the source of truth — read it first, do not invent slot values:**
- `notes/poetics/drama-machine/TAXONOMY.md` — every slot, its value space, and WIRED/PARTIAL/TO-BUILD status
- `notes/poetics/drama-machine/SPEC.md` — the `drama:` / `cast:` / `audience:` / `turn_plan:` schema and how each lowers to existing tools
- `notes/poetics/drama-machine/ADAPTATION-MOVES.md` — the per-role move catalog for `turn_plan:` (and the §0 boundary: this is a generative palette, NOT a measurement instrument)
- `config/ontology/poetics-core.ttl` + `poetics-rules.n3` — the formal ontology used to validate a turn_plan

## 1. Parse the brief → fill the slots

Read TAXONOMY.md and SPEC.md, then map the user's phrases onto slots. Mark each slot `inferred` (stated), `sampled` (you chose it), or `default`. Common mappings:

| Phrase in brief | Slot |
|---|---|
| "Socratic / recognition / behaviorist tutor" | `drama.tutor.prompt_type` + `pedagogical_approach` |
| "anxious / confused / adversarial learner" | `drama.learner.persona` |
| "on <topic>" | `drama.topic` (+ infer a plausible `hamartia`) |
| "with peripeteia / catharsis / recognition" | `drama.targets` → biases `tutor_adaptation_policy`, `dialogue_approach`, `turn_plan` |
| "I'll play the learner / tutor" | `cast.learner: human` / `cast.tutor: human` |
| "judged by <models> / k-of-n / graded" | `audience.panel` / `consensus` / `grading` |
| "a guided-discovery / withheld secret" | `drama.secret` (Oedipus device) |

If the topic is given but the misconception is not, **propose** a `hamartia` (the misconception that will be the plot's mainspring) and say so.

## 2. Sample the unspecified slots (the stochastic assembly)

Fill remaining slots from priors. Vary draws by `--seed` (default: derive from the drama id so it is reproducible — do **not** rely on randomness; pick deterministically from the seed). Priors:

- `targets: [peripeteia]` → `tutor_adaptation_policy: peripeteia`, `dialogue_approach: aristotelian_reversal`, a turn_plan with `[stock_take, route_change, action_gate]` at a mid beat.
- `targets: [anagnorisis]` → `socratic_discovery` (if a `secret` is present) or a `recognition_press` turn_plan near the close.
- `targets: [catharsis]` → `ending_speaker: learner`, a `perform_device` learner move at close, and **exclude** `pseudo_catharsis` from every catharsis-target turn.
- persona unset → weight by topic difficulty (`struggling_anxious` for a hard misconception, `eager_explorer` otherwise).
- `pedagogical_approach`/`dialogue_approach` unset → draw from the approach databases; prefer pairs whose `turn_shape` matches the targets.
- voice/scene unset → leave to the director's seeded fallback (do not over-specify).

State the priors you used and which slots they filled.

**Ontology-grounded sampling (preferred for the `turn_plan`).** The hand-priors above are the
lightweight path; the principled one is the turn-plan sampler, which walks the SAME poetics
TBox `validateTurnPlan` checks — `services/ontology/turnPlanSampler.js`
(`sampleTurnPlan(targets, role, {agencies, persona, seed})` / `sampleDramaSpec({...})`),
runnable as `npm run poetics:sample-turn-plan <role> <targets> <count> <architecture> <persona>`
or via the composer's "✨ suggest a turn" button (`POST /api/compose/suggest`). It is **valid by
construction** (round-trips through `validateTurnPlan`) and **conditioned on the cast's
alter-egos**: an `ego_only` tutor cannot draw `route_change` (no superego mechanism-critic);
a persona caps the move count. Prefer it for the `turn_plan`; use the hand-priors only for the
slots it does not cover.

## 3. Validate

1. **Slot values** against the TAXONOMY enums — reject any value not in the value space (or mark it free-text where the slot allows).
2. **turn_plan form-conflicts** via the maintained ontology sampler and
   validator. Prefer `npm run poetics:sample-turn-plan <role> <targets> <count>
   <architecture> <persona>` and plans returned by `sampleDramaSpec`, which
   round-trip through `validateTurnPlan`. Do not author a temporary reasoner
   script in the repository. Reject any turn for which the maintained validator
   reports a form conflict.
3. **Coherence**: every `target` should have at least one move that `aimsAtForm` it (check the closure for `ms:moveServesTarget`), else warn the target is unsupported.

## 4. Emit the spec for approval

Write the unified `drama: / cast: / audience: / turn_plan:` spec to an explicit
user path or, by default, a unique file under `exports/drama-specs/`. Never
write generated output into `config/poetics-calibration`. Show it inline and
call out, explicitly:
- which blocks **RUN TODAY** vs **TO-BUILD** (per SPEC.md), and
- any **TO-BUILD** slot the user requested (e.g. `cast.tutor: human`, `act_structure`, `learners[]`, `beat:` addressing) — say plainly it will be echoed but not yet honoured, and offer the wired fallback (e.g. `at: { turn: N }` instead of `{ beat: ... }`).

Stop here. The spec is the deliverable; a request to run it requires a separate
runtime route with enforceable generation and judging ceilings.

## 5. Historical lowering notes — do not execute

Lower per SPEC.md §7 (you are the loader until roadmap #1 lands):

1. Write the `drama:` block as a `dramas:`-list YAML the generator reads — to `config/poetics-calibration/<name>.yaml` (tell the user; this is the one place a generated file leaves cwd, because the generator + critic both read `--spec` from there). Carry `secret`, `persona`, `tutor_profile`/`learner_profile` (resolve `prompt_type`+`architecture`→ a profile name), approaches, scene, `tutor_adaptation_policy`, and any `turn_plan` (threaded onto the director plan by the generator and honoured per-turn by the engine).
2. **Cast:**
   - all `llm:*` → `--generator <backend>` + `--role-map "tutor=<b>,learner=<b>,director=<b>"` (+ model alias).
   - `cast.learner: human` → do **not** run the generator; hand off to
     `$ms-play-tutor` (Codex-simulated tutor, human learner) and stop.
   - `cast.tutor: human` → not wired; say so and offer `$ms-play-tutor` (which
     makes Codex the tutor and the human the learner—the inverse) or an `llm:*`
     tutor in a separately bounded runtime.
   - `--mock` or any `mock` cast → add the `--mock` flag (with any valid `--generator`) for a free plumbing check.
3. **Generate:**
   ```bash
   node scripts/generate-pedagogical-dramas.js --spec config/poetics-calibration/<name>.yaml \
     --paired-adaptation-arms <arms or the policy> --generator <backend> --role-map "..." \
     --out-dir exports/drama-<name>/txt --delib-dir exports/drama-<name>/delib \
     --transcripts-dir exports/drama-<name>/transcripts --key exports/drama-<name>/key.yaml
   ```
   This is a **paid** run on non-mock backends — confirm before spending; run in the background for multi-arm.
4. **Score (audience):**
   ```bash
   node scripts/critic-poetics-omniscient-graded.js --spec config/poetics-calibration/<name>.yaml \
     --sample-root exports/drama-<name>/txt --panel <audience.panel> [--consensus k]
   ```
   (binary critic `critic-poetics-omniscient.js` if `grading: binary`.)

## 6. Report

Give: the filled spec path, the slot table (inferred/sampled/default), any form-conflict rejections, and — if run — the transcript path + the panel verdict. Keep the boundary honest: the critic judges the artifact blind; a well-formed turn_plan is not evidence the drama taught anything (ADAPTATION-MOVES.md §0).

## Notes
- **No empirical claims.** This skill builds and runs dramas; it does not add findings. Anything claim-like belongs in `docs/research/paper-full-2.0.md`, not here.
- **Mock first.** Always offer a `--mock` plumbing pass before a paid `--run`.
- **Reproducible, not random.** Derive sampling from `--seed`/id so a re-run reproduces the spec; vary the seed to explore alternatives.
- Works for any guided-discovery `secret` drama, the genre/classic suites, and plain recognition dramas — the slot model is shared.
