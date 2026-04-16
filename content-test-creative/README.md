# Creative Writing Test Content

Minimal content package for testing domain generalizability of the evaluation framework on an aesthetic / subjective domain.

## Purpose

This content extends domain coverage (A6 Phase 3) to creative writing feedback:

- **Subjective domain** (vs philosophy's conceptual / math's symbolic / programming's procedural) — testing whether recognition effects transfer to contexts where "right answers" don't exist and craft is judged by readers, not compilers.
- **Identity-entangled work** — creative writing brings personal voice and sometimes autobiographical material, so struggle often intersects with self-concept in a way debugging does not.
- **Beginning-writer demographic** — adults in a workshop-style course, most with no publication history.

## Content Structure

```
content-test-creative/
├── courses/
│   └── 301/
│       ├── course.md          # Course metadata
│       ├── lecture-1.md       # Showing vs Telling
│       ├── lecture-2.md       # Voice and Point of View
│       ├── lecture-3.md       # Revision as Re-Vision
│       └── lecture-4.md       # Giving and Receiving Feedback
├── scenarios-creative.yaml    # Test scenarios for creative writing content
└── README.md                  # This file
```

Short prose excerpts are used as examples throughout. The scope is literary short fiction and personal essay — not screenwriting, poetry form, or journalism.

## Validation

Quick checks after modifying scenarios:

```bash
# 1. Validate config (structure, course_ids, model refs)
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js validate-config

# 2. Dry-run a single multi-turn scenario (no API calls)
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario writing_frustration_to_breakthrough --dry-run

# 3. Dry-run all multi-turn scenarios at once
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario writing_frustration_to_breakthrough,writing_misconception_correction,writing_productive_deadlock \
  --dry-run
```

## Running Evaluations

Use environment variables to switch content domains:

```bash
# Run with creative writing content
EVAL_CONTENT_PATH=./content-test-creative \
EVAL_SCENARIOS_FILE=./content-test-creative/scenarios-creative.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs 3
```

## Scenarios

### Single-turn (core + mood)

| ID | Category | Content | Tests |
|----|----------|---------|-------|
| new_writer_first_visit | core | — | First visit welcoming |
| returning_writer_mid_course | core | lecture-1 | Course progression |
| struggling_writer | core | lecture-2 | Struggle recognition (voice block) |
| showing_telling_confusion | core | lecture-1 | Misconception handling (showing ≠ always better) |
| discouraged_by_critique | mood | lecture-4 | Emotional support after harsh workshop feedback |

### Multi-turn (A6 domain expansion)

Each parallels an elementary / programming / philosophy multi-turn scenario for cross-domain comparison.

| ID | Turns | Content | Mirrors |
|----|-------|---------|---------|
| writing_frustration_to_breakthrough | 3 | lecture-1 | code_frustration_to_breakthrough |
| writing_misconception_correction | 4 | lecture-2 | code_misconception_correction |
| writing_productive_deadlock | 5 | lecture-3 | code_productive_deadlock |

## Expected Differences

Compared to analytical content (math, programming, philosophy), creative writing content may show:

1. **No ground-truth** — responses can't be graded against a compiler or answer key; the judge must assess craft and rapport
2. **Autobiographical weight** — learners defend creative choices as expressions of self, not just answers
3. **Taste disagreements** — the tutor's aesthetic preferences differ from the learner's, creating space for real dialogue or imposition
4. **Revision as identity work** — "this is just how I write" resists change in ways that "my answer is 7" does not
5. **Vulnerability after critique** — emotional recovery scenarios may be more common than in procedural domains

## Analysis Questions

1. Does recognition theory improve scores in a subjective domain more or less than in analytical ones?
2. Do dialectical cells handle voice/taste conflicts better than rule-bound cells?
3. Does recognition help more when there is no objectively correct answer? (Prediction: yes — mutual recognition has less competition from rule-authority.)
4. Are `transformation_markers` drawn from aesthetic vocabulary (voice, texture, rhythm) as discriminative as analytical ones?
