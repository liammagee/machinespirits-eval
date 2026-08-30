---
name: ms-discuss-paper
description: Read the latest canonical Paper 2.0 and prepare a current philosophy, pedagogy, methodology, and technology briefing for discussion. Read-only; use ms-author-paper2 for edits, ms-build-paper for PDF builds, and ms-litreview for corpus-wide literature synthesis.
---

# Discuss Paper 2.0

Use `docs/research/paper-full-2.0.md` as the canonical source. This skill never
edits or builds it.

## Establish freshness

1. Read frontmatter version/title/date.
2. Derive the current heading map with `rg -n '^#{1,3} '`. Locate revision
   history by heading text, not a frozen appendix letter; it is currently
   Appendix F but may move again.
3. Resolve the PDF expected from the frontmatter version. Distinguish:

   - matching PDF present;
   - only stale PDFs present; and
   - no PDF present.

   Do not rebuild under this read-only skill.
4. Read the latest revision entries and the sections implicated by the user's
   topic. Do not rely on a static token count, panel description, or section
   map.

## Build the briefing

Cover only lenses relevant to the request, or all four when asked:

- philosophy: recognition, authority, desire, poetics, and the limits the paper
  places on those lenses;
- pedagogy: tutor/learner mechanisms, guided discovery, adaptation, and what is
  actually measured;
- methodology: designs, instruments, judges, provenance, null/indeterminate
  results, and claim boundaries;
- technology: current architectures, runners, model roles, artifacts, and
  operational constraints.

Locate themes dynamically across the whole current section 6/7 range and
appendices; do not stop at an older §6.10 map. Separate the paper's thesis,
evidence, interpretation, and open questions.

## Output

Lead with the paper's current central argument in a short paragraph. Then give
the requested lens briefing, strongest evidence, live tensions or nulls, and
2–4 questions worth discussing. Cite section headings and current version, not
line numbers that will drift. State whether the matching PDF was current,
stale, or missing.
