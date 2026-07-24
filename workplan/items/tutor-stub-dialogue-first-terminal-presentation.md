---
id: tutor-stub-dialogue-first-terminal-presentation
title: "Make tutor-stub terminal output dialogue-first"
status: done
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-07-24
updated: 2026-07-24
verification: "Focused turn-timing, command-registry, turn-feedback, and interactive CLI regressions prove compact response details and an accurate foreground analysis/tutor/local timing breakdown appear before tutor speech when enabled, can be disabled for the session or at launch, and Escape on an empty unselected prompt suppresses the optional feedback request without changing public dialogue; the full tutor-stub interactive suite and workplan validation pass."
branch: codex/tutor-stub-dialogue-presentation
tags:
  - tutor-stub
  - cli
  - terminal-ux
  - feedback
---

Keep the terminal exchange visually centred on the tutor and learner rather than
ending each tutor message with implementation diagnostics. Put the compact
model/latency line before tutor speech, add explicit session and launch controls
for hiding it, and make Escape suppress optional tutor-feedback prompts for the
rest of the session when the input line is otherwise idle.

Acceptance criteria:

- Enabled compact response details precede the tutor utterance, leaving dialogue
  as the final visible response content.
- The live details include foreground wait split into learner-analysis, tutor,
  and local stages; prefetched work and tutor recovery calls are labeled without
  attributing their full background latency to the learner's wait.
- `/details on|off|status`, a launch flag, and an environment default control the
  compact line without changing technical debug views or public transcript state.
- Escape on an empty, unselected learner prompt disables optional tutor feedback
  for the session; Escape retains its existing selection-clear behavior.
- Help, status, command completion, trace settings, and CLI documentation describe
  the controls consistently.

2026-07-24 Codex: Activated on `codex/tutor-stub-dialogue-presentation` from
current `origin/main` after rechecking the presentation and feedback paths.

2026-07-24 Codex: Consolidated the implementation into this main-compatible
worktree, added the live foreground timing schema and formatter, and retained
the older prototype's useful multi-turn Escape-persistence coverage.

2026-07-24 Codex: Verification passed: 38/38 full interactive PTY tests; 66/66
focused timing, feedback, command-registry, and dry-run tests; the required
20/20 prompt/world tests; derivation quality; repository-wide ESLint; changed-
file Prettier; and the 167-item workplan check.
