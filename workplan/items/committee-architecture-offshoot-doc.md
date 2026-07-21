---
id: committee-architecture-offshoot-doc
title: "Committee-architecture design document (Program-2 offshoot)"
status: done
type: paper
priority: P2
owner: claude
source: manual
created: 2026-07-21
updated: 2026-07-22
verification: "docs/research/committee-architecture.md exists, introduces no
  original empirical claims (every number cites paper §6.18–§6.22 /
  §7.11–§7.12; design facts cite the Program-2 preregs), and the repo claim
  validators pass. Both pending folds are now incorporated: §10 carries the
  Phase 5c pass (§6.21) and §1/§11 carry the KTO spent/byte-identical
  outcome (§6.20/§6.21 status notes)."
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

Follow-ups (both now closed): fold the KTO verdict into its §1 and the
Phase 5c verdict into its §10 once those seal in the paper — 5c closed in
the §6.22 fold commit (eadc6054, merged PR #141); KTO closed in the
decisions-codicil commit after the v3.0.226 paper caveat landed.

2026-07-21 Claude: Drafted and committed on branch
claude/program-2-adaptation-offshoot (0dad9255), alongside the §6.21 paper
fold (v3.0.221, 71b063d8). Validators at fold time: paper-manifest 60
pass / 0 fail; integrity-audit 17 pass / 12 warn (pre-existing) / 0 fail;
provable-discourse 81 pass / 18 warn / 0 fail. Note "type: writing" was
requested for this card but the workplan validator's TYPES enum has no
writing entry — typed as paper (the repo's writing-work type).

2026-07-22 Claude: CARD CLOSED. The 5c follow-up was completed inside the
§6.22 fold (eadc6054, merged PR #141): §10 rewritten to the pass
(0.508 vs 0.306, costume leak zero, coverage-caveated; cites §6.21),
evidence table gained the 5c and offline-probe rows, §11 bounds updated.
The KTO follow-up closed in this commit once the paper carried the
v3.0.226 caveat: §1 now records the runs as spent and behaviorally inert
(byte-identical to SFT, both arms; the SFT artifact is the programme's
final trained specialist) and §11 lists KTO as measured-and-null, citing
the §6.20/§6.21 status notes. No open follow-ups remain; the doc tracks
paper v3.0.226+.
