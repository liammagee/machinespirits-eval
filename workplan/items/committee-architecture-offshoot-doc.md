---
id: committee-architecture-offshoot-doc
title: "Committee-architecture design document (Program-2 offshoot)"
status: active
type: paper
priority: P2
owner: claude
source: manual
created: 2026-07-21
updated: 2026-07-21
verification: "docs/research/committee-architecture.md exists, introduces no
  original empirical claims (every number cites paper §6.18–§6.21 /
  §7.11–§7.12; design facts cite the Program-2 preregs), and the repo claim
  validators pass on the branch that carries it. Updated when the KTO and
  Phase 5c folds seal (its §1 and §10 point at in-flight work)."
claim_status: scope-bound
links:
  paper: docs/research/paper-full-2.0.md#621-program-2-live
  notes:
    - docs/research/committee-architecture.md
    - notes/program-2/2026-07-21-adaptation-architecture-offshoot.md
    - PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md
    - PROGRAM-2-PHASE5B-FALLBACK-BATTERY-PREREGISTRATION.md
  items:
    - program-2-context-vs-weights-finetune
tags:
  - tutor-stub
  - fine-tune
  - committee
  - paper-framing
milestone: adaptive-tutor-evidence-v1
branch: claude/program-2-adaptation-offshoot
---

Paper-subordinate design/synthesis document for the Program-2 committee
architecture: the detector / specialist / composer / battery / fallback
assembly, the Phase 4/5/5b evidence table, the checker-coverage design law
("the leak is where the checker is not"), the exhaust loop as the adaptation
engine, the fine-tune-per-curriculum lifecycle with measured costs, the
validation-gated move library, the registered Phase 5c transfer probe, and
bounds. House rule: the document introduces NO original empirical claims —
it inherits everything from paper §6.18–§6.21 and §7.11–§7.12 (basis note
committed verbatim at
notes/program-2/2026-07-21-adaptation-architecture-offshoot.md).

Follow-ups queued behind in-flight work: fold the KTO verdict into its §1
and the Phase 5c verdict into its §10 once those seal in the paper (each
gets its own paper fold first, per the authoring discipline).

2026-07-21 Claude: Drafted and committed on branch
claude/program-2-adaptation-offshoot (0dad9255), alongside the §6.21 paper
fold (v3.0.221, 71b063d8). Validators at fold time: paper-manifest 60
pass / 0 fail; integrity-audit 17 pass / 12 warn (pre-existing) / 0 fail;
provable-discourse 81 pass / 18 warn / 0 fail. Note "type: writing" was
requested for this card but the workplan validator's TYPES enum has no
writing entry — typed as paper (the repo's writing-work type).
