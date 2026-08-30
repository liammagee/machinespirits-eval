---
id: codex-skill-best-practice-refresh
title: Refresh repository Codex skills against current skill guidance
status: done
type: maintenance
priority: P1
owner: codex
source: manual
created: 2026-08-28
updated: 2026-08-28
verification: All repository Codex skills validate, resolve from the canonical discovery root without duplicate names, reference current commands and policies, and pass focused skill, workplan, formatting, and diff checks.
branch: main
tags:
  - codex
  - skills
  - maintenance
milestone: evaluation-infrastructure
---

Audit and revise every repository skill visible to Codex using the current
OpenAI skill guidance: focused triggers, valid frontmatter, progressive
disclosure, explicit workflow boundaries, proportionate authorization, and no
duplicate-name discovery surfaces.

Acceptance:

- The union of `.agents/skills/` and legacy `.codex/skills/` has one canonical
  definition per skill name under the current repository discovery convention.
- Every skill passes the bundled structural validator and points only to
  current commands, paths, or clearly marked output examples.
- Oversized entrypoints route conditional detail into focused references.
- Paid-call, destructive, and live-study workflows preserve explicit authority
  and current project policy without recreating retired approval machinery.
- Skill-sync documentation and checks describe the canonical layout.

Closure (2026-08-28):

- Reviewed all 31 canonical Codex skills against the current OpenAI authoring
  guidance and the live repository commands, configuration, and policies.
- Consolidated Codex discovery under `.agents/skills/`, removed duplicate legacy
  `.codex/skills/` definitions, and kept the two configured Claude mirrors in
  sync.
- Reworked activation descriptions and unsupported frontmatter, moved large
  historical recipes behind focused references, and added explicit inputs,
  outputs, authority boundaries, stopping conditions, and safe fallbacks.
- Narrowed model-backed workflows whose current runtimes do not expose a hard
  aggregate call or spend ceiling. Those routes remain inspection, dry-run, or
  mock-only until the runtime safety boundary exists.
- Added `docs/codex-skills.md` and structural validation to
  `scripts/sync-agent-skills.js`, including optional `agents/openai.yaml`
  checks and focused regression coverage.
- Verification passed: 31/31 bundled OpenAI skill validations, 49/49 focused
  tests, skill mirror and structure checks, the 111-script analysis registry
  check, hermetic evaluation configuration validation (213 profiles, 30
  scenarios, 8 providers), 550/550 workplan items, and `git diff --check`.
