# Course 479 tutor instrument plan

**What**: a refined tutor chat for the Fall 2026 run of EPOL 479 (starts
~2026-08-24). The existing course stands — no new lectures. The new thing is
an instrument on machinespirits.org where students explore Hegel, Freud, and
machine learning by talking to the tutor **with its inner life visible**:
every turn shows the ego's draft, the superego's critique, and the revision.
Thinking out loud, on both sides of the screen. Students never touch this
repo.

## The instrument

A "Tutor Lab" chat page on machinespirits.org (fly.io, the website repo's
Express stack). One conversation pane, one deliberation pane.

Switches the student can flip, per session or mid-conversation:

- **Critic**: off / advisory / adversarial. (Our decisive result: the polite
  critic scored far below no critic at all; the adversarial one far above.
  Students can feel that difference, not just read it.)
- **Prompt stance**: recognition / placebo / enhanced / naive — the same
  four stances as the factorial experiments, frozen from this repo's
  `prompts/`.
- **Learner mirror**: show or hide what the tutor believes about the learner
  so far.

Plus: concept presets that drop a session into the middle of an idea
(recognition and the master–bondsman scene; the internal critic; what it
takes to adapt), and a transcript download so seminar discussion can work on
the students' own conversations.

Cost and access: a class key (the website already has auth) and a
per-session budget. **Model serving: the codex and claude CLIs run ON the
fly.io machine and drive the tutor through tutor-core's provider hook**
(user decision 2026-08-09) — subscription quota rather than per-token API
billing. The eval repo's bridge (`services/cliProviderBridge.js`) is the
adapter to carry over: it is nearly self-contained, with strict environment
allowlists per CLI, and already authenticates Claude by OAuth token env var
and codex by config-home env var — both deployable as fly.io secrets. An
API-key provider (Anthropic/OpenRouter) stays configured as the fallback
when quota runs dry mid-seminar. Never nemotron/kimi as the default stack.
One caveat either way: the hook returns whole replies, so the deliberation
pane streams stage by stage, not token by token — fine for its purpose.

## Engine choice (the one big decision)

Run **this repo's tutor-core** inside the website, not the website's own
older ego/superego engine. tutor-core was vendored from an npm package and
kept behind a one-way seam so it could be re-extracted; the behaviors the
switches expose were built and tested here, and re-implementing them in the
website's engine invites drift from the paper. The website keeps its
existing tutor suite untouched; the Tutor Lab is a new surface mounting
tutor-core behind one API route. The website's trace-viewer patterns
(dialogue-trace and reasoning-trace panels) can be reused for the
deliberation pane.

## Work split

| Repo | Work |
|---|---|
| `machinespirits-eval` (worktree `../ms-course-479`) | Check and document the tutor-core seam for re-extraction; freeze the four prompt stances and the three critic settings as a named "course-479" profile set; write the concept presets; export 2–3 reference transcripts for the course page. |
| `../machinespirits-website` | Tutor Lab page + one Express route mounting tutor-core; stream the deliberation to the UI; switches; class key + per-session budget; fly.io deploy. |
| `../machinespirits-content-philosophy` | New folder `courses/479-fall-2026/` (agreed): a short course page for the term pointing at the Tutor Lab, plus one-page activity sheets that pair a concept preset with a discussion question. No lecture re-authoring. |

Standing rules that still bite: any number quoted on a course page traces to
`docs/research/paper-full-2.0.md` (claim-audit before `./publish`); the
instrument shows dramatic and structural behavior, never claims to read
minds; the eval repo's paid surfaces stay off the student path.

## Timeline (two weeks to day 1)

**Week of Aug 10** — seam check; tutor-core running behind a website route
with the mock provider (no spend); deliberation pane wired to the stream;
freeze the prompt stances.

**Week of Aug 17** — switches, presets, class key, budget; real-provider
smoke with a seminar's worth of parallel sessions; deploy; publish the
`479-fall-2026` course page with the lab link and the first activity sheets.

During term: add presets and activity sheets week by week as the seminar
finds what it wants to poke at.

## Open choices (lean stated, steerable)

- **Vendor vs package**: lean is to vendor tutor-core into the website the
  same way it was vendored here, with the same never-import-back rule.
  Republishing it as an npm package is cleaner long-term but slower now.
- **Anonymous or keyed**: lean is class-keyed only for launch; a public
  no-key mode with a tight budget could come later.
- **Transcripts as data**: downloads for the students' own use only. Keeping
  server copies for research would need consent forms — out of scope unless
  you want it.
