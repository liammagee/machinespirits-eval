---
name: ms-curriculum-drama
description: Compile an authored curriculum (a course → its modules) into a runnable suite of teaching dramas via the curriculum→world→drama pipeline, then generate and render them. Use when the user wants to turn the AI-Foundations (or any canonical) curriculum into dramas, "compile the curriculum to dramas/worlds", refresh `curriculum/ai-foundations.*.yaml`, run a curriculum module as a light drama, or render a curriculum-drama transcript to HTML. This is the structured, course-derived entry point; for a one-off drama from a freeform brief use /ms-drama-machine instead.
argument-hint: "[--module AF6] [--mode mvp|all] [--from-rhetorical-plans] [--dry-run|--mock|--run] [--generator claude] [--render]"
allowed-tools: Bash, Read, Write
---

You drive the **curriculum → world → drama** pipeline: a CASE-inspired curriculum object is compiled into locked world contracts and rhetorical-dramatic plans, lowered to a drama spec, generated into transcripts, and (optionally) rendered to HTML. Your job is to run the right stretch of that chain for what the user asked, keeping the cost ladder and the artifact boundary intact.

**Read the source of truth first — do not invent file shapes, flags, or module ids:**
- `curriculum/CURRICULUM-FORMAT.md` — the curriculum object schema + the drama/world compilation contracts.
- `notes/poetics/2026-06-19-curriculum-world-adaptation-guide.html` — the canonical end-to-end walkthrough (artifact map, operational semantics, light-run cost ladder, acceptance checks).
- `services/curriculum/curriculumCompiler.js` — the compiler the four `curriculum:*` scripts call (exports `compileCurriculumTo{WorldAdaptationSpec,RhetoricalDramaticPlans,DramaSpec}`, validators, hashers).
- `notes/poetics/drama-machine/` — the slot/move vocabulary the compiled `turn_plan`s draw from (shared with /ms-drama-machine).

## The three artifacts (and the one boundary)

| Layer | File | Job |
|---|---|---|
| Curriculum object (source of truth) | `curriculum/ai-foundations.curriculum.yaml` | CASE-style course graph: modules, knowledge components, tasks, verifiers, misconception signatures, prerequisites |
| World adaptation spec (locked contract) | `curriculum/ai-foundations.worlds.yaml` | per-module allowed/preferred/disallowed action families, expected transitions, forbidden moves, deterministic `spec_hash` |
| Drama spec (enactment) | `curriculum/ai-foundations.dramas.yaml`, `.mvp-dramas.yaml`, `.rhetorical-dramas.yaml` | teachable scenes (tutor/learner/director/persona/turn_plan) for the generator |

**Boundary (state it whenever you run anything): the world spec constrains and annotates action — it is NOT the evaluator.** Success comes from learner turns, verifier evidence, transcript quality, or an independent judge. Compile first, then run; a live dialogue must never invent its own world contract. This skill builds and runs dramas — it adds **no empirical claims**. Anything claim-like belongs in `docs/research/paper-full-2.0.md`, not here.

## 0. Guard: never start a second generation loop

Before any `--mock`/`--run` generation step:

```bash
ps -axo pid,stat,command | rg 'generate-pedagogical-dramas|run-poetics-(adaptation-loop|production-batch)' | rg -v ' rg ' || echo "no loop running"
```

If a loop IS running, STOP and tell the user — do not launch a parallel paid generation. (Compile + dry-run steps are safe to run alongside.)

## 1. Compile the chain (all free, deterministic, side-effect = writes a YAML)

Run only the stretch the request needs. Each step's input defaults to the previous artifact; pass `--check` to validate without writing.

```bash
# a. markdown → canonical curriculum object (only when the source .md changed)
npm run curriculum:convert:ai-foundations            # add -- --check to validate only

# b. canonical → locked world specs
npm run curriculum:compile:worlds                    # -- --check to validate hashes only; -- --all for every module

# c. canonical → rhetorical-dramatic plans (the rhetorical lineage)
npm run curriculum:compile:rhetorical-dramatic-plans # -- --mvp (default) | --all | --arms a,b

# d. plans/curriculum → drama spec
npm run curriculum:compile:drama -- --mvp --out curriculum/ai-foundations.mvp-dramas.yaml
# the rhetorical suite the live loop uses is the --from-rhetorical-plans projection:
npm run curriculum:compile:drama -- --mvp --from-rhetorical-plans \
  --out curriculum/ai-foundations.rhetorical-dramas.yaml
```

Notes:
- **MVP slice** = modules AF1, AF4, AF5, AF6, AF11, AF12 (`--mvp`, the default for plans/worlds). `--all`/`--mode all` only when every module is runtime-ready (has verifier + misconception evidence).
- `compile:drama` `--source` is `curriculum` (default) or `rhetorical_dramatic_plan` (`--from-rhetorical-plans`). Compiled drama ids are `D_AF<N>_CURRICULUM[_ADAPTIVE]`.
- Re-running a compile is the correct way to refresh a stale `curriculum/*.yaml` after editing the source — the outputs are generated, not hand-maintained.

## 2. Generate — cost ladder, never skip a rung

The generator is `scripts/generate-pedagogical-dramas.js`. Always climb **dry-run → mock → attended real**, and select a single drama with `--only` while iterating.

```bash
# (i) dry-run — routing/shuffle/persona/turn-plan shape, no writes, no LLM (FREE)
node scripts/generate-pedagogical-dramas.js --dry-run \
  --spec curriculum/ai-foundations.mvp-dramas.yaml --only D_AF6_CURRICULUM --max-turns 2

# (ii) mock — a real transcript artifact with no API cost (FREE)
node scripts/generate-pedagogical-dramas.js --mock --force \
  --spec curriculum/ai-foundations.mvp-dramas.yaml --only D_AF6_CURRICULUM --max-turns 2 \
  --out-dir exports/curriculum-light-drama/sample \
  --transcripts-dir exports/curriculum-light-drama/transcripts \
  --delib-dir exports/curriculum-light-drama/deliberation \
  --writing-pad-dir exports/curriculum-light-drama/writing-pad \
  --key exports/curriculum-light-drama/key.yaml

# (iii) attended real — PAID. Confirm with the user before spending; run in background for multi-drama.
node scripts/generate-pedagogical-dramas.js --force \
  --spec curriculum/ai-foundations.rhetorical-dramas.yaml --only D_AF11_CURRICULUM_ADAPTIVE \
  --generator claude --model sonnet --claude-persistent-workers \
  --out-dir <run>/samples --delib-dir <run>/deliberations \
  --transcripts-dir <run>/transcripts --key <run>/key.yaml
```

Generation flags worth knowing (verify against the arg parser, don't guess):
- `--generator claude|codex|agy` — `claude` = Max-plan CLI (attended); `codex` = the production-batch default. They draw on **separate quota pools** — switching changes which drains. `--model` sets the alias (e.g. `sonnet`); `--effort low|medium|high|xhigh|max` (claude only).
- `--claude-persistent-workers` reuses workers across dramas; `--role-map "tutor=claude,learner=claude,director=claude"` for mixed casts.
- `--paired-adaptation-arms <arm,...>` for contrastive arms (e.g. `routine,peripeteia`); `--affective-adaptation-policy none|procedural_sensitive` (drama spec may already set this — the flag overrides).
- A paid run is **attended and human-gated** (see the project's paid-run discipline): confirm scope, prefer one drama first, watch quota.

## 3. Render (optional) — transcript → HTML dialog

`scripts/render-light-drama-dialog-html.js` turns a generated transcript into a readable dialog page, stripping world ids / hashes / misconception ids from public text.

```bash
npm run drama:render -- \
  --transcript <run>/transcripts/<id>.json \
  --full <run>/samples/<id>.txt \
  --key <run>/key.yaml \
  --out exports/curriculum-light-drama/<id>.html \
  --title "AF11 — Stakeholder & harm map"
```

`--transcript` and `--out` are required; `--full` adds the director scene-card preamble; `--key` adds persona/shape metadata; `--public-out` writes a public-safe copy. (`npm run drama:render` is an alias for `node scripts/render-light-drama-dialog-html.js`.)

## 4. Acceptance checks (offer after a compile/run)

From the guide — a curriculum-world-drama slice is ready only when: canonical parse validates (tasks+verifiers+misconceptions present); every world spec has a deterministic `spec_hash` that fails validation if edited (`compile:worlds -- --check`); the adaptive selector respects allowed/preferred/disallowed families; the gate rejects a disallowed world action even if supplied manually; the MVP drama dry-runs with no writes/LLM; and a small adaptive scenario runs in mock with `world_adaptation_source`. The contract tests are `tests/curriculumCompiler.test.js`, `tests/curriculumOntologyParity.test.js`, `tests/generatePedagogicalDramas.test.js` — run them after touching the compiler or spec shape.

## 5. Report

Give: which compile steps ran and what they wrote (file + count, e.g. "6 rhetorical dramatic plans, mode=mvp"); the generation tier reached (dry-run/mock/real) and transcript path; any rendered HTML; and the boundary reminder — a clean compile and a well-formed turn_plan are **not** evidence the drama taught anything.

## Critical rules
- **Compile first, then run.** Don't generate against a hand-edited drama spec when the curriculum source changed — recompile.
- **Cost ladder, every time.** dry-run → mock → (confirm) → real. Default `--generator` choice matters: don't switch claude↔codex unasked (separate quotas).
- **One loop at a time.** Honour §0; the live AF11 loop must not be doubled.
- **World spec ≠ evaluator; no empirical claims here.** Independent outcome/quality analysis stays required; findings live in the paper.
- **Generated files are generated.** Refresh `curriculum/ai-foundations.*.yaml` by recompiling, not by hand-editing the outputs.
