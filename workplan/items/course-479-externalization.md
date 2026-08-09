---
id: course-479-externalization
title: Tutor Lab instrument for course 479 (Fall 2026)
status: active
type: content
priority: P1
owner: human
source: manual
created: 2026-08-09
updated: 2026-08-09
verification: "A Tutor Lab chat is live on machinespirits.org before day 1: tutor-core runs behind a website route, each turn shows draft/critique/revision, students can switch critic setting (off/advisory/adversarial) and prompt stance (recognition/placebo/enhanced/naive), access is class-keyed with a per-session budget; courses/479-fall-2026 has a course page pointing at it; students need no access to this repo."
claim_status: methods
depends_on: []
links:
  notes:
    - COURSE-479-PLAN.md
tags:
  - course
  - teaching
  - externalization
  - content-philosophy
---

Build a refined tutor chat instrument for the Fall 2026 run of course 479
(starts ~2026-08-24). The existing course stands; the new thing is a "Tutor
Lab" on machinespirits.org where students explore Hegel, Freud, and machine
learning by talking to the tutor with its deliberation visible (ego draft,
superego critique, revision) and switchable critic settings and prompt
stances — the same variants as the factorial experiments.

Engine: this repo's tutor-core, mounted inside the website's Express stack
(the seam was kept one-way for re-extraction); NOT the website's older
ego/superego engine. Provider on fly.io is API-key based (no CLI bridges);
never nemotron/kimi by default.

Full plan: `COURSE-479-PLAN.md` (repo root, worktree `../ms-course-479`).

Completion boundary:

- This card covers the eval-repo side: seam check for re-extraction, the
  frozen "course-479" profile set (4 prompt stances x 3 critic settings),
  concept presets, and a few reference transcripts.
- Website surface and content-repo course page tracked in those repos.
- Course pages are spin-offs under the single-paper rule: claim-audit before
  each publish.
- The eval repo's paid surfaces (poetics job launcher, pilot UI) stay off the
  student path.

2026-08-09 Claude: Seam check PASSED — see `TUTOR-CORE-SEAM-CHECK.md`. Bare
copy of tutor-core installed and ran the full ego/superego loop standalone
with a stub model (draft, rejection, revision, approval). Deliberation trace
and per-stage streaming come free. Added `tests/tutorCoreSeamGuard.test.js`
so the one-way rule now fails a build instead of a code review. Next: freeze
the course-479 stance profiles so tutor-core loads them without the eval
repo's prompt loader.

2026-08-09 Claude: Profile set FROZEN. 12 profiles (`course479_<stance>_<critic>`,
4 stances x off/advisory/adversarial) added to tutor-core's bundled config;
the one drifted prompt (placebo ego — hardcoded lecture IDs vs placeholders)
synced from the authoritative `prompts/`. Standalone sweep in the scratch copy
passed 12/12: right stance text reaches the model, critic runs only when
configured, advocate/advisory and adversary/adversarial prompts land as
claimed. Pinned by `tests/course479ProfileSet.test.js` (wiring + anti-drift
vs `prompts/`). Model names are aliases; the deploy overlay must pin Sonnet 5
(bundled alias still says 4.5). Next: concept presets + reference transcripts.
