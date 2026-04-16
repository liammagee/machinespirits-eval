# Introductory Programming Test Content

Minimal content package for testing domain generalizability of the evaluation framework on a STEM procedural domain.

## Purpose

This content extends domain coverage (A6 Phase 2) to introductory programming:

- **Procedural domain** (vs philosophy's conceptual / math's symbolic) — testing whether recognition effects transfer to contexts where the learner is primarily *making things work*, not *understanding ideas*.
- **Debugging as epistemic work** — bugs create natural impasses where the learner has a concrete stuck point, not just conceptual confusion. Good candidate for productive-struggle measurement.
- **Beginner programmer demographic** — adults or older students with no prior coding experience.

## Content Structure

```
content-test-programming/
├── courses/
│   └── 201/
│       ├── course.md          # Course metadata
│       ├── lecture-1.md       # Variables and Values
│       ├── lecture-2.md       # Making Decisions: If and Else
│       ├── lecture-3.md       # Loops: Doing Things Many Times
│       └── lecture-4.md       # When Things Go Wrong: Debugging
├── scenarios-programming.yaml  # Test scenarios for programming content
└── README.md                   # This file
```

Python is the example language throughout (most accessible syntax for true beginners).

## Validation

Quick checks after modifying scenarios:

```bash
# 1. Validate config (structure, course_ids, model refs)
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js validate-config

# 2. Dry-run a single multi-turn scenario (no API calls)
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario code_frustration_to_breakthrough --dry-run

# 3. Dry-run all multi-turn scenarios at once
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario code_frustration_to_breakthrough,code_misconception_correction,code_productive_deadlock \
  --dry-run
```

## Running Evaluations

Use environment variables to switch content domains:

```bash
# Run with programming content
EVAL_CONTENT_PATH=./content-test-programming \
EVAL_SCENARIOS_FILE=./content-test-programming/scenarios-programming.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs 3
```

## Scenarios

### Single-turn (core + mood)

| ID | Category | Content | Tests |
|----|----------|---------|-------|
| new_programmer_first_visit | core | — | First visit welcoming |
| returning_programmer_mid_course | core | lecture-1 | Course progression |
| struggling_programmer | core | lecture-2 | Struggle recognition |
| syntax_confusion | core | lecture-1 | Misconception handling (= vs ==) |
| frustrated_debugger | mood | lecture-4 | Emotional support under debugging pressure |

### Multi-turn (A6 domain expansion)

Each parallels an elementary / philosophy multi-turn scenario for cross-domain comparison.

| ID | Turns | Content | Mirrors |
|----|-------|---------|---------|
| code_frustration_to_breakthrough | 3 | lecture-3 | math_frustration_to_breakthrough |
| code_misconception_correction | 4 | lecture-1 | math_misconception_correction |
| code_productive_deadlock | 5 | lecture-4 | math_productive_deadlock |

## Expected Differences

Compared to elementary math and philosophy content, programming content may show:

1. **Concrete error signals** — tracebacks, wrong output, infinite loops
2. **Syntactic noise** — learner confusion often mixes conceptual and syntactic causes
3. **Debugging as deliberation** — "I don't understand why this is broken" is a first-class struggle type
4. **Faster iteration** — shorter feedback loops (run code → see result) than philosophical argument
5. **Identity-level "I'm not a programmer" claims** — similar to math anxiety but with a specific cultural charge

## Analysis Questions

1. Does recognition theory improve scores on programming content?
2. Does debugging struggle (concrete, testable) differ from conceptual struggle in how recognition helps?
3. Which transformation markers generalize across domains (math, programming, philosophy)?
4. Are dialectical cells more helpful in programming than in fixed-answer math? (We predict yes — bug hypothesis refinement IS dialectic.)
