# Social-Emotional Learning Test Content

Minimal content package for testing domain generalizability of the evaluation framework on a meta-skill / interpersonal domain.

## Purpose

This content extends domain coverage (A6 Phase 3b) to social-emotional learning (SEL) for adult returning students:

- **Meta-skill domain** (vs philosophy's conceptual / math's symbolic / programming's procedural / creative writing's aesthetic) — testing whether recognition effects transfer to contexts where the "content" *is* the interpersonal skill itself, not a body of subject knowledge.
- **Self-and-other awareness as content** — SEL does not have right answers or craft norms; the work is naming feelings, taking another person's perspective, regulating impulses. Rapport *is* the subject.
- **Adult-returning-student demographic** — students at a community college enrolled in a "college success" course covering self-management, communication, and help-seeking.

## Content Structure

```
content-test-sel/
├── courses/
│   └── 401/
│       ├── course.md          # Course metadata
│       ├── lecture-1.md       # Self-Awareness
│       ├── lecture-2.md       # Self-Management
│       ├── lecture-3.md       # Social Awareness
│       └── lecture-4.md       # Relationship Skills
├── scenarios-sel.yaml          # Test scenarios for SEL content
└── README.md                   # This file
```

The course is loosely modelled on the CASEL-5 competency framework, adapted for adult returning students in a community-college context. We cover four of the five CASEL competencies; responsible decision-making is integrated into the others rather than given a dedicated lecture.

## Validation

Quick checks after modifying scenarios:

```bash
# 1. Validate config (structure, course_ids, model refs)
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js validate-config

# 2. Dry-run a single multi-turn scenario (no API calls)
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario sel_frustration_to_breakthrough --dry-run

# 3. Dry-run all multi-turn scenarios at once
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified --runs 1 \
  --scenario sel_frustration_to_breakthrough,sel_misconception_correction,sel_productive_deadlock \
  --dry-run
```

## Running Evaluations

Use environment variables to switch content domains:

```bash
# Run with SEL content
EVAL_CONTENT_PATH=./content-test-sel \
EVAL_SCENARIOS_FILE=./content-test-sel/scenarios-sel.yaml \
node scripts/eval-cli.js run \
  --profiles cell_1_base_single_unified,cell_5_recog_single_unified \
  --runs 3
```

## Scenarios

### Single-turn (core + mood)

| ID | Category | Content | Tests |
|----|----------|---------|-------|
| new_sel_student_first_visit | core | — | First visit welcoming |
| returning_sel_student_mid_course | core | lecture-1 | Course progression |
| struggling_sel_student | core | lecture-2 | Struggle recognition (overwhelm) |
| feelings_confusion | core | lecture-1 | Misconception handling (stress ≠ anxiety ≠ overwhelm) |
| interpersonal_conflict | mood | lecture-4 | Emotional support after a fight with a study partner |

### Multi-turn (A6 domain expansion)

Each parallels an elementary / programming / creative / philosophy multi-turn scenario for cross-domain comparison.

| ID | Turns | Content | Mirrors |
|----|-------|---------|---------|
| sel_frustration_to_breakthrough | 3 | lecture-1 | writing_frustration_to_breakthrough |
| sel_misconception_correction | 4 | lecture-1 | writing_misconception_correction |
| sel_productive_deadlock | 5 | lecture-4 | writing_productive_deadlock |

## Expected Differences

Compared to analytical content (math, programming, philosophy) and aesthetic content (creative writing), SEL content may show:

1. **No external correctness check** — no compiler, no reader, no answer key; the only authority is the learner's own experience and the tutor's reflection
2. **Rapport is the content** — the quality of the tutor-learner relationship is not a means to learning; it *is* the learning
3. **Identity threats are direct** — "I'm not a person who asks for help" is the lesson, not a barrier to the lesson
4. **Very low baseline vocabulary** — many adult students have never been asked to name what they feel in finer granularity than "stressed" or "fine"
5. **Authenticity signal** — recognition-heavy tutors may do disproportionately well here because SEL collapses to "is this person actually being seen"

## Analysis Questions

1. Does recognition theory show its largest delta in SEL? (Prediction: yes. Recognition-vs-base should be maximally separated in a domain where rapport IS the content.)
2. Do dialectical cells produce more productive struggle in SEL than in analytical domains?
3. Which `transformation_markers` generalize across SEL? We expect the learner-evolving markers ("I hadn't thought of it that way" / "maybe what I'm actually feeling is") to be most discriminative.
4. Do the `forbidden_elements` lists need to be longer/stricter in SEL to catch dismissive or prescriptive responses?
