# Elementary Fractions Test Content

Minimal content package for testing domain generalizability of the evaluation framework.

## Purpose

This content allows testing whether findings from the philosophy course (EPOL 479) generalize to:
- Different subject matter (elementary math vs graduate philosophy)
- Different learner demographics (grade 4 vs graduate students)
- Different content complexity (concrete vs abstract concepts)

## Content Structure

```
content-test-elementary/
├── courses/
│   └── 101/
│       ├── course.md          # Course metadata
│       ├── lecture-1.md       # What is a Fraction?
│       └── lecture-2.md       # Comparing Fractions
├── scenarios-elementary.yaml  # Test scenarios for elementary content
└── README.md                  # This file
```

## Validation

Quick checks after modifying scenarios:

```bash
# 1. Validate config (structure, course_ids, model refs)
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js validate-config

# 2. Dry-run a single multi-turn scenario (no API calls)
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario math_frustration_to_breakthrough --dry-run

# 3. Dry-run all multi-turn scenarios at once
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario math_frustration_to_breakthrough,math_misconception_correction,math_mutual_exploration,math_epistemic_resistance,math_affective_shutdown,math_productive_deadlock \
  --dry-run
```

## Running Evaluations

Use environment variables to switch content domains:

```bash
# Run with elementary content
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --scenario struggling_student,concept_confusion,frustrated_student \
  --runs 3
```

## Scenarios

### Single-turn (core + mood)

| ID | Category | Content | Tests |
|----|----------|---------|-------|
| new_student_first_visit | core | — | First visit welcoming |
| returning_student_mid_course | core | lecture-1 | Course progression |
| struggling_student | core | lecture-1 | Struggle recognition |
| concept_confusion | core | lecture-1 | Misconception handling |
| frustrated_student | mood | lecture-2 | Emotional support |

### Multi-turn (A6 domain expansion)

Each parallels a philosophy multi-turn scenario for cross-domain comparison.

| ID | Turns | Content | Mirrors |
|----|-------|---------|---------|
| math_frustration_to_breakthrough | 3 | lecture-2 | mood_frustration_to_breakthrough |
| math_misconception_correction | 4 | lecture-2 | misconception_correction_flow |
| math_mutual_exploration | 5 | lecture-1 | mutual_transformation_journey |
| math_epistemic_resistance | 5 | lecture-1 | epistemic_resistance_impasse |
| math_affective_shutdown | 5 | lecture-1 | affective_shutdown_impasse |
| math_productive_deadlock | 5 | lecture-2 | productive_deadlock_impasse |

## Expected Differences

Compared to philosophy content, elementary content may show:

1. **Lower vocabulary complexity** in tutor responses
2. **More concrete examples** (pizza, cookies vs Hegelian concepts)
3. **Simpler scaffolding** expectations
4. **Different struggle signals** (wrong answers vs conceptual confusion)

## Analysis Questions

1. Does recognition theory improve scores on elementary content?
2. Is the A×B interaction (recognition × multi-agent) preserved?
3. Do hardwired rules transfer across domains?
4. What domain-specific adjustments are needed for production?
