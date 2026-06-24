---
id: d2-cross-application-role-reframed-study
title: D2. True cross-application role-reframed study
status: blocked
type: research
priority: P2
owner: codex
source: todo
created: 2026-06-23
updated: 2026-06-24
verification: "D2 sidecar scaffold validates with
  scripts/run-d2-role-transfer.js validate; empirical completion requires real
  generation plus three-judge scoring and analysis."
blocked_by: "Paid generation plus three-judge scoring has not been launched;
  run the commands in notes/d2-role-transfer-scaffold.md after explicit paid-run
  approval."
claim_status: planned
links:
  notes:
    - TODO.md#D2
    - notes/design-d2-path2-cross-application.md
    - notes/d2-cross-application-role-reframed-gate.md
    - notes/d2-role-transfer-scaffold.md
  paper: §8.2
tags:
  - d2
  - cross-application
  - separate-study
milestone: paper-2-evidence-cleanup
branch: codex/d2-d6-followups
---

TODO §D2 Path 1 is closed; Path 2 is the true cross-application study with role-reframed prompts. It is deferred because it requires prompt/content/rubric authoring and may be separate-paper scope.

2026-06-24 Codex: Closed as current-paper cleanup. The true cross-application role-reframed study remains a separate-study idea because it requires new prompt, content, and rubric authoring; it should not sit in the active triage lane as present debt.

2026-06-24 Codex: Follow-up arc gate recorded in
`notes/d2-cross-application-role-reframed-gate.md`. The empirical study is
fully gated until a fresh implementation item opens role-native prompt/content
authoring, role-fit scoring, fresh cell IDs, budget, and optional therapy safety
review.

2026-06-24 Codex: Reopened per user request and created the D2 Path 2 sidecar
scaffold: `config/d2-role-transfer.yaml`,
`config/evaluation-rubric-d2-role-transfer.yaml`, six `prompts/d2/*.md` files,
and `scripts/run-d2-role-transfer.js`. No-cost validation and mock analysis pass.
The empirical study is still blocked because the paid real generation plus
three-judge scoring sequence has not been explicitly launched.
