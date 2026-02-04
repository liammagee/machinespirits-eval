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

## Running Evaluations

Use environment variables to switch content domains:

```bash
# Run with elementary content
EVAL_CONTENT_PATH=./content-test-elementary \
EVAL_SCENARIOS_FILE=./content-test-elementary/scenarios-elementary.yaml \
node scripts/eval-cli.js run \
  --profiles cell_5_recog_single_unified,cell_7_recog_multi_unified \
  --scenarios struggling_student,concept_confusion,frustrated_student \
  --runs 3
```

## Scenarios

| ID | Name | Tests |
|----|------|-------|
| new_student_first_visit | New Student - First Visit | First visit welcoming |
| returning_student_mid_course | Returning Student - Mid Course | Course progression |
| struggling_student | Struggling Student | Struggle recognition |
| concept_confusion | Concept Confusion | Misconception handling |
| frustrated_student | Frustrated Student | Emotional support |

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
