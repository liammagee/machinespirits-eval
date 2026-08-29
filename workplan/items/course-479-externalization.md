---
id: course-479-externalization
title: Tutor Lab instrument for course 479 (Fall 2026)
status: blocked
type: content
priority: P1
owner: human
source: manual
created: 2026-08-09
updated: 2026-08-29
verification: "A Tutor Lab chat is live on machinespirits.org before day 1: tutor-core runs behind a website route, each turn shows draft/critique/revision, students can switch critic setting (off/advisory/adversarial) and prompt stance (recognition/placebo/enhanced/naive), access is class-keyed with a per-session budget; courses/479-fall-2026 has a course page pointing at it; students need no access to this repo."
claim_status: methods
depends_on: []
blocked_by: "Codex Luna passed the live single-turn smoke, but the one-shared-CPU deployment failed the 24-turn seminar gate at concurrency 6 (15 passed, 3 timed out at 300 seconds, 6 unrun); choose queued/backpressured serving or added compute before a new prospective bounded load check."
links:
  notes:
    - COURSE-479-PLAN.md
  prs:
    - https://github.com/liammagee/machinespirits/pull/53
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
ego/superego engine. The deployed provider plan is `codex.gpt-5.6-luna` at
medium effort through the CLI bridge as primary and `anthropic.sonnet`
through the API as fallback; never nemotron/kimi by default.

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

2026-08-09 Claude: Concept presets FROZEN — `config/course-479-presets.yaml`,
six presets (two kinds of learning; experience and error; mutual recognition;
the internal critic; adaptation and the trap; Hegel's revenge), each with a
learner picture, curriculum menu keyed to the standing 479 lectures, opening
message, default frozen profile, and a "try this" switch experiment. Guarded
by `tests/course479Presets.test.js`, which also runs every preset through the
dialogue engine with a stub model. USER DECISION: codex/claude CLIs will run
on the fly.io machine and drive the tutor through the provider hook
(subscription quota); `services/cliProviderBridge.js` is the adapter to port;
API-key providers stay as fallback. Plan + seam-check docs updated.

2026-08-09 Claude: Reference transcripts GENERATED on the real serving path —
`scripts/generate-course-transcripts.js` ran the frozen profiles over the
claude CLI bridge (Sonnet 5 via the CLI's sonnet alias), scripted learner held
constant within each pair. Five transcripts, three turns each, full
deliberation per turn (every turn shows at least one rejection and revision):
the week-2 recognition/placebo pair, the week-3 advisory/adversarial critic
pair, and the week-4 trap (tutor names the misconception on turn 1). JSON in
`exports/course-479/transcripts/` (gitignored), archived to the private repo
at `artifacts/course-479/` (commit d15490ae). Eval-repo side of the card is
now done: seam check, frozen profiles, presets, transcripts. Remaining work
moves to the website (Tutor Lab surface, bridge port, deploy) and content
repo (479-fall-2026 page + techne renders of these transcripts).

2026-08-09 Claude: WEBSITE SIDE BUILT — worktree `../ms-website-tutor-lab`,
branch `tutor-lab`, commit 9afeb87. Vendored tutor-core (VENDORED.md carries
the one-way rule + re-sync procedure), ported the CLI bridge with its two
helpers, added `/api/tutor-lab` (presets + turn, class-key gate, per-session
and concurrency budgets, mock mode) and the two-pane `/tutor-lab` page.
Verified end to end: mock loop in the browser; one real claude-CLI turn
through the route (rounds=2, rejection then approved revision). Remaining for
deploy is on the website card `course-479-tutor-lab`: Dockerfile CLI install
+ secrets, Sonnet-5 provider overlay, API-key fallback, seminar load check.

2026-08-29 Codex: WEBSITE AND COURSE SURFACES ARE LIVE — website PRs #50 and
#51 deployed the Tutor Lab, provider overlay, class-key gate, budgets, presets,
and required secrets. Content PRs #8 and #9 published the course entry point,
six-preset activity guide, and three reference deliberations, then corrected
their canonical public links after live verification found a relative-link
fallback. The pages explicitly identify the examples as scripted design
material, not real-student records or evidence of learning gains; no new
empirical claim was introduced.

A real deployed two-round turn returned HTTP 200 from `claude-code.sonnet`,
exposed the six expected trace stages, consumed one of 30 session turns, and
made five primary model calls with no fallback. The seminar check then
attempted 12 sessions x 2 turns at concurrency 6. It produced no aggregate
result within 45 minutes on the one-shared-CPU Fly machine and was stopped;
no client, Claude, or Codex process remained. Because the script buffers
results, the exact completed-call count is unavailable and must not be
inferred. Website PR #52 records the same blocker. Do not close this card or
rerun the model-backed check until the owner chooses between API-primary
serving and a queued/scaled CLI topology, then validates the selected path
under the same 12 x 2 workload.

2026-08-29 Codex: WEBSITE PR #53 SWITCHED THE LIVE ROUTE TO CODEX LUNA. The
owner enabled device-code authorization, authenticated the production Codex
CLI with ChatGPT on its persistent volume, and authorized the bounded serving
check. A live one-turn smoke completed in 44.8 seconds on
`codex.gpt-5.6-luna` at medium effort with no fallback.

The registered 12-session x 2-turn check then ran at concurrency 6 with a
300-second per-turn timeout. Luna successfully served 15 of 24 planned turns;
3 timed out at the client boundary and 6 did not run to completion. No
successful response used fallback. Because interrupted route requests left
server-side CLI children running, the Fly machine was restarted to terminate
them; it returned healthy, retained the ChatGPT login, and had no Codex worker
left. The live surface is usable at low concurrency, but classroom readiness
is still blocked on a topology decision: queue/backpressure on the existing
machine or added compute, followed by a new prospective bounded load check.
