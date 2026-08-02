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

## Status (2026-08-02): fires correctly; composition conflicts with duplicate-delivery; next lever named

Three iterations. (1) Flag-off gate PASSED (hermetic suite green,
byte-identical path). (2) First live k=3: insertion never fired — the
clue-delivery failure lives under the alignment guard's exact-quotation
rule, not the release guards; eligibility widened (one dialogue's t2
draft passed unaided — first ever). (3) Second live k=3 + diagnostic:
insertion fires at every eligible turn (7/7) and every composition is
rejected as `duplicate_clue_delivery` — good drafts PARAPHRASE the due
clue, so appending the exact rendering delivers it twice. Blind
appending is the wrong composition. **Next lever, named: span
replacement** — the duplicate detector already locates clue content in
the draft; the repair is swapping the paraphrase span for the exact
rendering rather than appending. Card stays open at that lever; the
wholesale composer remains the delivery path meanwhile. Leaks 0
throughout all iterations.
