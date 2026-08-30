---
name: ms-build-paper
description: Build and inspect only the canonical Paper 2.0 PDF. Use for paper-only builds; use ms-build-research-artifacts when the user also wants the atlas or dramatic-recognition arc.
---

Build the research paper PDF and validate.

## Steps

1. Build the PDF (canonical Paper 2.0):
   ```bash
   npm run research:build:paper
   ```
   NOTE: `./build.sh full` builds the LEGACY Paper 1.0 from a *different*
   source file (`paper-full.md`), with its version scraped from that file's
   frontmatter — using it for the canonical paper silently ships a
   stale-version wrong paper. Use `npm run research:build:paper` unless you
   specifically want Paper 1.0.

2. Check for undefined citation keys in the build output (warnings from pandoc-citeproc).

3. Grep for stale cross-references — section numbers may have shifted:
   ```bash
   rg -n 'Section [0-9]|§[0-9]' docs/research/paper-full-2.0.md | head -20
   ```

4. Report:
   - Build success/failure
   - Output filename and version resolved from YAML frontmatter; if the matching
     PDF is absent, report a failed/missing artifact rather than selecting the
     newest unrelated PDF
   - Any citation warnings
   - Any obvious stale section references

## Paper conventions
- Canonical paper: `docs/research/paper-full-2.0.md` (build with `./build.sh paper2`)
- Consolidated npm command: `npm run research:build:paper`
- Version in YAML frontmatter `version:` field
- References: `docs/research/references.bib`
- Build outputs: `docs/research/paper-2.0-vX.Y.Z.pdf`
- Legacy Paper 1.0: `docs/research/paper-full.md` (`./build.sh full`) — superseded; do not build for current claims
- Legacy short paper: `docs/research/paper-short.md` (`./build.sh short`)
