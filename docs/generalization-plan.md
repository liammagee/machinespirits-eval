# Generalization Plan: Domain-Agnostic Educational Tutor Evaluation Framework

## Objective

Make machinespirits-eval reusable for any educational domain (language learning, mathematics, science, history, etc.) without losing the Hegelian recognition study as a first-class configuration.

## Current State

The system has ~85% generic infrastructure and ~15% Hegelian-specific coupling. The coupling concentrates in three areas: hardcoded dimension arrays, study-specific DB columns, and recognition-theory prompt files.

---

## Phase 1: YAML-Driven Dimension Groups (fixes v2.2 adoption too) — IMPLEMENTED

**Status**: Implemented. All rubric YAML files (v1.0, v2.0, v2.1, v2.2, production) now have `group: base` or `group: treatment` on every dimension. Code reads groups from YAML via `getDimensionsByGroup()` and `calculateGroupScore()`.

**Problem**: Three places hardcode the 14 v2.1 dimension names. These arrays are already incompatible with v2.2 rubrics (8 different dimension names). Any new domain's rubric would also produce 0 from `calculateBaseScore()` / `calculateRecognitionScore()`.

**Solution**: Add a `group` field to each dimension in the rubric YAML. Code reads groups from YAML instead of hardcoded arrays.

### YAML schema change

```yaml
dimensions:
  relevance:
    name: "Relevance"
    weight: 0.10
    group: base            # NEW — "base", "treatment", or any domain-specific label
    description: "..."

  mutual_recognition:
    name: "Mutual Recognition"
    weight: 0.10
    group: treatment       # NEW
    description: "..."
```

For v2.2:
```yaml
  perception_quality:
    group: base
  recognition_quality:
    group: treatment
```

For a hypothetical language-learning rubric:
```yaml
  grammatical_accuracy:
    group: linguistic
  communicative_competence:
    group: communicative
```

### Code changes

| File | Change |
|------|--------|
| `services/evalConfigLoader.js` | Add `getDimensionsByGroup(groupName)` helper that reads `group` from YAML |
| `services/rubricEvaluator.js:1206-1223` | Replace `BASE_DIMENSIONS` / `RECOGNITION_DIMENSIONS` constants with `evalConfigLoader.getDimensionsByGroup('base')` / `getDimensionsByGroup('treatment')` |
| `services/rubricEvaluator.js:1232-1285` | `calculateBaseScore()` and `calculateRecognitionScore()` call the new helpers |
| `services/rubricEvaluator.js:781-796` | `regexScoreRescue()` reads all dimension keys from YAML via `Object.keys(evalConfigLoader.getRubricDimensions())` instead of hardcoded list |
| `services/evaluationRunner.js:3189-3206` | Replace duplicated `baseDims` / `recognitionDims` arrays with calls to `getDimensionsByGroup()` |
| `config/evaluation-rubric.yaml` (v2.1) | Add `group: base` or `group: treatment` to each dimension |
| `config/rubrics/v2.2/evaluation-rubric.yaml` | Add `group:` fields to each of the 8 dimensions |

**Rename exported functions** for clarity:
- `calculateBaseScore()` → `calculateGroupScore('base')` (or keep both as aliases)
- `calculateRecognitionScore()` → `calculateGroupScore('treatment')`

**Backward compat**: If a dimension has no `group` field, default to `'base'`. This means existing YAML files work without modification until groups are added.

### Tests

- Verify `getDimensionsByGroup('base')` returns correct dimension keys for v2.1 and v2.2
- Verify `calculateBaseScore()` produces same results as before when YAML groups match the old arrays
- Verify v2.2 rubric produces non-zero scores from `calculateBaseScore()` / `calculateRecognitionScore()`
- Verify a rubric with custom group names (e.g., `linguistic` / `communicative`) works

### Confirmed v2.2 bug

The 2 existing v2.2 scored rows (`eval-2026-02-27-cc34311e_rubric-v2.2`) show the issue:
- `tutor_first_turn_score` = 31.2 (correct — `calculateOverallScore()` reads all dimensions from YAML)
- `base_score` = 0.0 (broken — no v2.2 keys match `BASE_DIMENSIONS`)
- `recognition_score` = 0.0 (broken — no v2.2 keys match `RECOGNITION_DIMENSIONS`)

**Severity**: Low for now. The overall score is correct, and the split scores are only used in `analyze-eval-results.js` for the base/recognition decomposition. No analysis script has been run on v2.2 data yet. But any future v2.2 production run would have silently zeroed split scores.

### Immediate value

This phase alone unblocks v2.2 adoption — it's not just a generalization change, it's a prerequisite for the rubric version the study already needs.

---

## Phase 2: Generalize DB Column Names

**Problem**: Three DB columns embed study-specific semantics:
- `base_score` — assumes a "base" vs "treatment" binary split
- `recognition_score` — assumes Hegelian recognition is the treatment
- `factor_recognition` — names the experimental factor

Six legacy `score_*` columns (`score_relevance`, `score_specificity`, `score_pedagogical`, `score_personalization`, `score_actionability`, `score_tone`) are v1 artifacts that only partially populate. The real per-dimension data flows through `tutor_scores` / `scores_with_reasoning` JSON columns.

**Solution**: Add generic alias columns; keep legacy columns for backward compat.

### Schema migration

```sql
-- Generic aliases (new columns)
ALTER TABLE evaluation_results ADD COLUMN group_a_score REAL;   -- maps to base_score
ALTER TABLE evaluation_results ADD COLUMN group_b_score REAL;   -- maps to recognition_score
ALTER TABLE evaluation_results ADD COLUMN factor_condition TEXT; -- maps to factor_recognition (TEXT not BOOLEAN, supports >2 conditions)

-- Backfill from existing columns
UPDATE evaluation_results SET group_a_score = base_score WHERE base_score IS NOT NULL;
UPDATE evaluation_results SET group_b_score = recognition_score WHERE recognition_score IS NOT NULL;
UPDATE evaluation_results SET factor_condition = CASE WHEN factor_recognition = 1 THEN 'recognition' ELSE 'base' END WHERE factor_recognition IS NOT NULL;
```

### Code changes

| File | Change |
|------|--------|
| `services/evaluationStore.js` | Add migration; write to both old and new columns during transition |
| `services/evaluationRunner.js:4067-4072` | ANOVA `scoreTypes` reads group names from rubric YAML metadata |
| Analysis scripts | Accept both old and new column names (query helper) |

### Design decision: group names from YAML

The rubric YAML gains a top-level `score_groups` section:

```yaml
score_groups:
  base:
    label: "Base Pedagogical Score"
    column: "group_a_score"    # DB column for aggregate
  treatment:
    label: "Recognition Score"
    column: "group_b_score"
```

A language-learning rubric:
```yaml
score_groups:
  linguistic:
    label: "Linguistic Competence"
    column: "group_a_score"
  communicative:
    label: "Communicative Competence"
    column: "group_b_score"
```

This way the DB schema is generic (group_a, group_b) but the display labels and analysis labels come from the rubric.

---

## Phase 3: Content and Prompt Abstraction

**Problem**: Scenario YAML, prompt files, and content packages embed Hegelian philosophy content.

**Solution**: Factor into a "domain pack" pattern.

### Domain pack structure

```
domains/
  hegelian-recognition/         # Current study
    scenarios.yaml
    content/                    # Course materials
    prompts/
      tutor-ego.md
      tutor-ego-recognition.md
      tutor-superego.md
      learner-ego.md
      learner-ego-recognition.md
      ...
  language-learning/            # Example new domain
    scenarios.yaml
    content/
    prompts/
      ...
```

### Configuration

A top-level `domain` field in `tutor-agents.yaml` or a new `config/domain.yaml`:

```yaml
domain:
  name: hegelian-recognition
  scenarios_file: domains/hegelian-recognition/scenarios.yaml
  content_dir: domains/hegelian-recognition/content
  prompts_dir: domains/hegelian-recognition/prompts
```

### Code changes

| File | Change |
|------|--------|
| `services/evalConfigLoader.js` | Resolve scenario file from domain config (already supports `EVAL_SCENARIOS_FILE` env var — formalize) |
| `services/contentResolver.js` | Resolve content directory from domain config |
| Prompt file resolution in tutor-core | Accept a `prompts_dir` override |
| `config/tutor-agents.yaml` | Prompt file references become relative to domain prompts dir |

### Backward compat

If no `domain` config exists, fall back to current flat structure (`config/suggestion-scenarios.yaml`, `prompts/`, `content/`). Zero breakage for existing study.

---

## Phase 4: Cell Registry Auto-Discovery

**Problem**: `EVAL_ONLY_PROFILES` in `evaluationRunner.js:82-183` manually lists all 90+ cell names. Adding a new domain's cells requires manually extending this array.

**Solution**: Auto-discover cells from `tutor-agents.yaml`.

### Code changes

| File | Change |
|------|--------|
| `services/evaluationRunner.js` | `resolveEvalProfile()` reads all profile names from the YAML `configurations` object at startup. The `EVAL_ONLY_PROFILES` array becomes computed, not maintained. |

### Logic

```js
// Instead of:
const EVAL_ONLY_PROFILES = ['cell_1_base_single_unified', 'cell_2_base_single_psycho', ...];

// Auto-discover:
const EVAL_ONLY_PROFILES = Object.keys(evalConfigLoader.loadTutorAgents().configurations);
```

The `resolveEvalProfile()` mapping (cell name → tutor-core profile) can use YAML metadata:

```yaml
configurations:
  cell_1_base_single_unified:
    tutor_core_profile: budget     # NEW — explicit mapping
    factors:
      ...
```

If `tutor_core_profile` is absent, fall back to heuristic resolution (existing behavior).

---

## Phase 5: Cosmetic / Terminology Cleanup

Low-priority renames that complete the generalization:

| Current | General | Files |
|---------|---------|-------|
| `MUTUAL_RECOGNITION` outcome enum | `THEORETICAL_RECOGNITION` or remove | `learnerTutorInteractionEngine.js:62` |
| `recognition` scenario cluster | `treatment` or configurable | `evaluationRunner.js` cluster filter |
| `factor_recognition` references in analysis scripts | `factor_condition` | ~8 analysis scripts |

---

## Phasing and Dependencies

```
Phase 1 ──→ Phase 2 ──→ Phase 5
  │                        ↑
  │         Phase 3 ───────┘
  │
  └──→ Phase 4 (independent)
```

- **Phase 1** is the prerequisite for everything and independently valuable (unblocks v2.2)
- **Phase 2** depends on Phase 1 (group names in YAML drive column naming)
- **Phase 3** is independent content-layer work
- **Phase 4** is independent infrastructure cleanup
- **Phase 5** is cosmetic polish, depends on Phase 2

## Estimated Scope

| Phase | Files touched | Lines changed (est.) | Risk |
|-------|--------------|---------------------|------|
| 1 | 5 code + 2-4 YAML | ~80 | Low — pure refactor with clear tests |
| 2 | 3 code + migration | ~60 | Medium — DB schema change, needs backfill |
| 3 | 3 code + new config | ~40 code + content authoring | Low — new abstraction layer, no breaking changes |
| 4 | 1 code + YAML metadata | ~30 | Low — replaces manual array with auto-discovery |
| 5 | ~10 files | ~30 | Low — renames only |

**Total code changes**: ~240 lines across ~15 files. The bulk of real work for a new domain is content authoring (scenarios, prompts, rubric dimensions), which is already outside the codebase.

## What This Enables

A new domain deployment (e.g., language tutoring) would require:
1. A `domains/language-learning/` directory with scenarios, content, prompts
2. A rubric YAML with domain-appropriate dimensions and `group:` fields
3. Cell definitions in `tutor-agents.yaml` pointing to the new domain
4. Zero code changes

The ego/superego bilateral architecture, multi-provider judge pipeline, run/evaluate/rejudge CLI, and all analysis scripts would work unchanged.
