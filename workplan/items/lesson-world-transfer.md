---
id: lesson-world-transfer
title: "Carry the graduated-release tutor to plain lesson plans: genre words out of the code, lesson worlds in"
status: active
type: infra
priority: P1
owner: claude
source: manual
created: 2026-09-02
updated: 2026-09-02
verification: "The tutor-stub code carries no detective nouns as fixed text (the world's presentation.frame supplies them; a world with no frame block keeps every prompt byte-for-byte); at least three ordinary lesson worlds besides world-037 pass derivation:lint with a lesson frame and a stress schedule; and one attended planted-stress run per lesson world on the codex or Sonnet CLI is packed under notes/poetics/hero-demo-runs/ with the plain-tutor and adaptive columns."
branch: claude/de-genre-tutor-stub
depends_on: []
links:
  items:
    - state-detection-without-word-lists
    - hero-demo-ghost-world-examples
    - tutor-stub-closure-assertion-timing
  notes:
    - notes/poetics/hero-demo-runs/2026-09-01-adjudication-draft.md
    - notes/poetics/hero-demo-runs/2026-09-02-lesson-worlds-bench.md
tags:
  - adaptive-tutor
  - worlds
  - lesson
---

## Why

Most of the adaptive tutor's worlds are detective stories. The engine (proof
DAG, release schedule, slope, gates) reads no genre words, but the tutor-stub
prompts and three closing-word checks carried detective nouns as fixed text
("Detective-story world", "investigator", "suspect", "close the case"). A
maths lesson world got those words too. The question behind this card: how
far does the graduated-release mechanism carry to ordinary lesson plans that
keep the sense of discovery and drop the intrigue.

## Steps

1. Genre words out of the code. New module `services/tutorStubWorldFrame.js`
   resolves an optional `presentation.frame` block (kind `inquiry` or
   `lesson`, per-noun overrides, `closing_words`). Inquiry defaults equal the
   old strings, so frozen fixtures stay byte-identical. Hooked into the
   public world prompt, the teaching charter, the compact speaking prompt,
   the opening prompt, the learner classifier prompt, the clarification
   translator, the human-discourse and closure contexts, and the three
   closing-word sites. `derivation:lint` reports a defective block.
   world-037 declares `kind: lesson`.
2. Author three or four more ordinary lesson worlds with a lesson frame and a
   stress schedule; lint them.
3. Run each with the learner DAG on under the forced-card bench, plain tutor
   and adaptive columns, attended, on the codex or Sonnet CLI; pack the
   traces.
4. Then the detector card (`state-detection-without-word-lists`). Do not
   build a lesson-plan-to-world compiler yet.

## Log

- 2026-09-02: step 1 built on branch `claude/de-genre-tutor-stub`.
- 2026-09-02: step 1 committed (24caad348) and step 2 committed (bd2bf097c) on claude/de-genre-tutor-stub. Worlds 038-040 lint PASS, quality PASS. Step 3 designed in notes/poetics/hero-demo-runs/2026-09-02-lesson-worlds-bench.md with DAG-on recipes; waits on go + ceiling. Push blocked by the pre-push benchmark hook (needs the user to run it).
- 2026-09-02: step 3 ran under the go (ceiling 600 dialogue calls, 24 judge calls; used 313 and 6). Six attended runs on 038/039/040, learner DAG on, forced-card and plants-only versions, Sonnet 5 both seats, judge codex.gpt-5.6-sol on 34 plants: 23 HIT, 2 PARTIAL, 9 MISS. 039 closed in both versions; 038 plants and 040 plants hit the cap; 040 forced stopped at turn 16 on a CLI timeout, not resampled. 040 was re-authored after a zero-call misfire (predicate rename, question re-worded). Traces packed under notes/poetics/hero-demo-runs/world-03{8,9}/ and world-040/, archived in the private repo (dba9634fa). Commit f9236d2c3. Results and three defects in notes/poetics/hero-demo-runs/2026-09-02-lesson-worlds-bench.md.
- 2026-09-02: the authored openings of 037, 038 and 039 failed the opening audit, so every run on them (hero runs included) spoke the fallback opening. Fixed in 4a7e1cc59; all four lesson worlds now pass offline. The closure defect (assertion must land at or after grounding) is carded as tutor-stub-closure-assertion-timing. Steps 1-3 done; step 4 is the detector card, unstarted. PR #944 open.
- 2026-09-02: step 4 done offline on the same branch: the form detector replayed and re-trained with the three lesson worlds (form-v3), detector card closed with its limits recorded. Note notes/poetics/hero-demo-runs/2026-09-02-step5-lesson-fold.md. The lesson-plan compiler stays unbuilt.
