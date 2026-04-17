## content-test-support — Peer Support Listener Training (D2 Path 1 pilot)

Minimal content package for the D2 cross-application pilot. Tests whether the
recognition main effect transfers from traditional pedagogy (philosophy,
programming, math, creative writing, SEL) to a **coaching-a-support-volunteer**
domain, where the skill being taught is the *opposite* of knowledge transfer:
listener presence, sitting with distress, and declining to fix.

Structurally this is still a tutoring interaction — the "tutor" mentors a
trainee volunteer, and the "learner" is the trainee. But the domain is
adjacent-but-distinct from A6's five educational domains in that the content
being taught is itself a de-pedagogical skill (listening without advising).

**Path 2 (deferred)**: a true cross-application test would create a new cell
with a role-reframed tutor prompt (e.g., `tutor-ego-support-recognition.md`)
that casts the LLM directly as a peer support listener. That requires new
prompt authoring in tutor-core + new cell registration + EVAL_ONLY_PROFILES
updates; it is flagged in `TODO.md` D2 Path 2 as future work.

### Structure

- `courses/501/` — 4 lectures on peer support listener skills
- `scenarios-support.yaml` — 4 core + 1 mood = 5 scenarios

### Usage

```bash
EVAL_CONTENT_PATH=./content-test-support \
EVAL_SCENARIOS_FILE=./content-test-support/scenarios-support.yaml \
node scripts/eval-cli.js run --profiles cell_1_base_single_unified,cell_5_recog_single_unified --runs 3 --model anthropic.haiku --description "D2 Path 1: peer support listener coaching"
```
