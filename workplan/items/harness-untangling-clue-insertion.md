---
id: harness-untangling-clue-insertion
title: "Untangling 1: insert the due clue into the model's reply instead of replacing the reply"
status: active
type: infra
priority: P2
owner: claude
source: manual
created: 2026-08-02
updated: 2026-08-02
verification: "Gate registered before any change: (a) flag off — behavior
  byte-identical, hermetic suite green; (b) flag on, k=3 live — at release
  turns where the draft fails ONLY the release-delivery family, the
  delivered reply is the model draft with the due clue sentence inserted
  (traced), template whole-reply replacements at those turns fall to zero,
  release audits pass on the composed reply, leaks stay zero."
claim_status: methods
depends_on:
  - adaptation-plan-3-phase-p
tags:
  - tutor-stub
  - harness
---

The composer is the measured voice seam (P2) and the measured mask over
every interesting demand turn (Gate H, S2 live, L2 first demands). Its
job — the scheduled clue must arrive — is legitimate; its method —
discard the model's reply and ship a template — is the tangle. The fix:
when the ONLY failing hard checks are release delivery, keep the draft
and append the due clue's sentence (the same renderer the template
uses), re-audit, and deliver the composition. Env-gated
(TUTOR_STUB_CLUE_INSERTION=1), traced as clueInserted, wholesale
fallback retained for every other failure family and as the audit-fail
fallback.
