---
id: human-validation-field-guide
title: "Publishable field guide for the remaining human validation work"
status: done
type: content
priority: P1
owner: codex
branch: codex/close-human-validation-field-guide
source: manual
created: 2026-09-01
updated: 2026-09-01
verification: "A self-contained Techne HTML guide first explains the adaptive-tutor project and evidence gap, then explains the purpose, contribution, roles, inputs, blinding, case-level procedures, stop conditions, outputs, and claim boundary for all six human-work streams. Every human-facing task link resolves to a downloadable, editable Word guide or Excel workbook rather than an organiser-only source format. The Office files pass package-integrity and visual checks; desktop and mobile page renders are inspected; and the dedicated machinespirits.org publisher stages the page plus its download directory and passes both a no-write dry run and a temporary-destination stage test."
links:
  notes:
    - notes/poetics/2026-09-01-human-validation-field-guide.html
    - notes/poetics/2026-09-01-human-validation-field-guide.standalone.html
    - notes/poetics/TECHNE-DOCS.md
    - notes/poetics/human-validation-files/human-validation-task-guide.docx
    - notes/poetics/human-validation-files/proof-dag-review-form.xlsx
    - notes/poetics/human-validation-files/state-move-coder-a.xlsx
    - notes/poetics/human-validation-files/state-move-coder-b.xlsx
    - notes/poetics/human-validation-files/impasse-review-form.xlsx
    - notes/poetics/human-validation-files/superego-taxonomy-review-form.xlsx
    - notes/poetics/human-validation-files/rubric-v3-coder-a.xlsx
    - notes/poetics/human-validation-files/rubric-v3-coder-b.xlsx
  items:
    - adaptive-causality-human-state-move-validation
    - adaptive-proof-dag-cross-world-validation
    - impasse-corpus-phase1
    - superego-taxonomy-human-validation
    - rubric-v3-calibration-and-held-out-acceptance
    - a1-human-learner-validation
  prs:
    - https://github.com/liammagee/machinespirits-eval/pull/931
  code:
    - notes/poetics/publish-human-validation-guide-to-site.js
tags:
  - human-validation
  - operations
  - techne
  - publication
milestone: adaptive-tutor-evidence-v1
---

Create one public, operationally precise guide to the human judgment still
required by the adaptive-tutor research programme. The page must distinguish
ready coding packets from the later human-subject study; preserve independent
coding, blinding, uncertainty, privacy, and claim boundaries; and provide a
rehearsable publication path without deploying or disclosing protected inputs.

2026-09-01 Codex: Drafted the guide from the six live human-owned or
human-blocked workplan cards and their committed packets/codebooks. Added a
dedicated standalone packaging and content-repository staging script whose
default modes do not deploy. Live publication remains a separate explicit
human action.

2026-09-01 Codex: Verified all eight navigation targets, six activity panels,
96 itemized procedural steps, theme switching, and zero browser errors. Desktop
and 390px mobile inspection passed after correcting long-code wrapping; the
standalone artifact has no local CSS/JS dependencies or horizontal overflow.
The workplan source check passed 584/584, the publisher dry run wrote nothing,
and a stage-only smoke test produced the expected self-contained HTML plus the
older metadata stub in a temporary destination.

2026-09-01 Codex: Rewrote the page for direct sharing with human reviewers.
Removed the research-operations tone, replaced specialist terms with short
plain-English explanations, moved file paths and commands into organiser-only
details, and recast every activity as a simple numbered procedure. The guide
still preserves the original task counts, review rules, stop points, and claim
limits.

2026-09-01 Codex: Rebuilt the page again as six card-specific assignment
sheets. Each sheet now says who acts, which linked files to open, exactly what
to enter, what to return, and what makes the task complete. It also makes the
status distinction explicit: four cards can be assigned now, rubric v3 first
needs a project-lead decision, and the human-learner pilot currently requires
study preparation rather than participant activity.

2026-09-01 Codex: Added the missing explanatory layer from first principles.
The guide now starts with the adaptive tutor's read → diagnose → choose → check
→ speak → observe loop, separates established simulated conduct from unproven
human validity and learning, and precedes every procedure with the question the
card addresses, why human judgment is needed, and what the returned work adds
to the project.

2026-09-01 Codex: Replaced the human-facing source-format handoff with an
editable Office packet: one plain-English Word guide plus seven task-specific
Excel workbooks. The public page now links only to those downloads; source
YAML, JSON, Markdown, and analysis scripts remain available to organisers in
the repository but are no longer presented as reviewer work surfaces. The
taxonomy download is a public template and codebook only: its protected 40-item
sample remains private and must be inserted by the organiser before assignment.
Extended the site publisher to stage the complete download directory beside the
page.

2026-09-01 Codex: DONE after PR #931 merged as `eda7bccd` with all required CI
checks green. The public guide and its downloadable Word and Excel packets are
now present on `main`; live publication remains an explicit separate action.
