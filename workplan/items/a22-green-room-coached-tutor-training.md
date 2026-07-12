---
id: a22-green-room-coached-tutor-training
title: A22. Green Room — coached tutor training, rehearsal, and the prompt book
status: done
type: experiment
priority: P1
owner: unassigned
source: manual
created: 2026-07-11
updated: 2026-07-12
verification: Gates 0-3 of GREEN-ROOM-PLAN.md executed in order with results
  recorded (or the arc stopped at a failed gate with the null written up as the
  closing paragraph), and the resulting section landed in paper-full-2.0.md.
claim_status: scope-bound
branch: claude/tutor-coaching-memory-system-vvvrl8
links:
  paper: §6.16
  notes:
    - GREEN-ROOM-PLAN.md
    - notes/2026-07-12-greenroom-gate1-diagnosis.md
  items:
    - a1-human-learner-validation
    - d3-insight-action-gap-heavy-bridge-followups
    - sepo-self-evolving-prompt-agent-for-system-prompt-optimizati
    - a18-38-teacher-as-learner-ml-fine-tuning-ladder
tags:
  - green-room
  - coach
  - memory
  - tutor-training
  - a22
---

Cross-run tutor training as theatre: after every performance a judge-tier
**coach** holds a notes session (a real conversation, not one-way mining) with
the actor, distilling ≤3 bankable behavioural notes into a versioned,
token-budgeted, per-profile prompt book (`MEMORY.md`) that future runs open
with; rehearsal loops vs mock learners and mid-performance side-coaching
complete the apparatus. Profiles fork at memory versions = comparable training
levels. Full review + design + pre-registration skeleton:
`GREEN-ROOM-PLAN.md` (cells 201–208, claims C1 biography / C2 note-uptake /
C3 weak-actor distillation / C4 headline lift, gates 0–3 with no
tune-and-retry branch).

Positioning: engages the memory/adaptation graveyard head-on (A5, A7, A14,
A15, A16, rich-memory null) and occupies the one un-pulled configuration —
a stronger model authoring curated cross-session guidance natively from the
target actor's own transcripts (the gap between §7.8.1's +114% native
optimisation and §7.8.3's insufficient hand-me-down transfer; A18.37 is the
behavioural-channel precedent).

Next action: land the Gate-1 null + Gate-0 positive + C1 biography as a
paper-full-2.0.md section (owner sign-off on framing); Gates 2-3 cancelled
per the no-tune-and-retry rule. Any redesigned uptake test is a new
pre-registered item.

2026-07-11 claude: arc proposed; plan doc drafted on branch, card opened.
2026-07-11 human: GREENLIT. P0 decisions recorded in GREEN-ROOM-PLAN.md §0.1 —
first wave binds to the preconscious tutor-stub variant on the Marrick family
(world-005 train; hold-outs sealed: world-018-edmund near-transfer,
world-009-ravensmark far-transfer); coach codex.sol / actor codex.luna;
coach-informed but tutor-driven (registry-variance-failure trigger, ⚑ to
reconcile against the worktree at P1); single anchor, no in-loop-superego arm
(standing note: the coach may be an alternative superego architecture);
Gate 0 owner-reviewed; cells 201-208 reserved for the later fold-in.
2026-07-11 claude: preconscious branch confirmed pushed; both ⚑ flags
resolved against it (registry-variance = register-policy layer over
engagementRegisterRegistry.js; MEMORY.md injection mirrors the
--field-report-context pattern as --prompt-book-context). Four
substrate-inherited constraints recorded as plan §0.2 (headroom arena for
outcome gates, no model monoculture, outcome-only scoring, no
machine-local provenance).
2026-07-11 human: P0 numbers RATIFIED (book 1,800 tokens; Gate 0 = 4/5
owner-judged; Gate 1 = >=60% note-compliance improvement vs never-issued
placebo; Gate 2 = k>=5/arm, coached-luna > untrained-luna on outcome-only
channels AND >=20% luna->sol gap closure on held-out worlds). Gate 0 to run
on owner's machine.
2026-07-11 claude: Gate-0 runner shipped (scripts/greenroom-gate0.js +
tests/greenroomGate0.test.js, 11 tests green, dry-run smoke verified);
runbook at plan §7.1.
2026-07-11 claude: DRESS REHEARSAL run in-session (claude-code.opus coach /
claude-code.sonnet actor — NOT the ratified sol/luna gate; this container
lacks the codex CLI) on 2 committed cast-layer transcripts from the
preconscious branch: 2/2 sessions completed, 6/6 bankable notes with
verbatim quotes + third-party checks, confidence 0.82 both. One parser
lesson banked: lenient trailing-comma JSON handling (test added). Evidence
committed at exports/greenroom-gate0-dress-rehearsal-2026-07-11/.
2026-07-12 human: models RE-PINNED to the Claude stack (plan §0.1.4) —
coach claude-code.claude-opus-4-8, actor claude-code.claude-sonnet-5, weak
actor claude-code.claude-haiku-4-5-20251001; codex sol/luna kept as
preferred restoration. Non-Anthropic rejudge now REQUIRED before any
positive C3/C4 claim (§0.2.2).
2026-07-12 claude: RATIFIED GATE 0 RUN in-session (5 sessions, seed 1, six
committed cast-layer transcripts, manifest at commit 7164538): 5/5 sessions
completed, 15/15 notes parsed, confidences 0.78-0.82. Cross-session
convergence observed: over-braking after correct statements, withholding
terminal recognition, re-eliciting already-produced distinctions each
flagged independently in 2-3 sessions — the C1 notes-taxonomy signal.
Evidence at exports/greenroom-gate0-2026-07-12/. Awaiting owner scoring.
2026-07-12 human: GATE 0 SCORED — PASS 5/5 ("all five qualify").
2026-07-12 claude: P1 substrate shipped (greenroom store/CLI/notes engine,
26 tests); Gate 1 executed in-session per §7.2 (8 performances, 6 sessions,
book v0->v6 frozen; P4@v3 closed at 31 turns, sole closure); raw payloads
bundled (tar.gz + sha256 manifest) after diff bloat; uptake scoring in
flight.
2026-07-12 claude: GATE 1 FAIL — 3/17 notes improved (18%) vs 60% bar,
placebo 0/2; arc stops per pre-registration, Gates 2-3 cancelled. Standing:
Gate-0 pass, the curated-book C1 artifact (v6, net compression across 3
edits), P4's uncorroborated early closure, and the substrate. Report at
exports/greenroom-gate1-2026-07-12/gate1-report.{md,json}.
2026-07-12 claude: LANDED — paper §6.16 (v3.0.212) with the Gate-0 pass,
Gate-1 null, curation/biography positives, and the §6.15-boundary reading;
diagnosis note saved. Card closes done/scope-bound per its verification
clause. Successor levers (compile-to-policy, rehearsal, side-coaching cell
206) are future pre-registrations, not this item.
