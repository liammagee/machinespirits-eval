---
name: ms-build-paper
description: Build the research paper PDF and check for issues
allowed-tools: Bash, Read, Grep, Glob
---

Build the research paper PDF and validate.

## Steps

1. Build the PDF (canonical Paper 2.0):
   ```bash
   cd docs/research && ./build.sh paper2
   ```
   NOTE: `./build.sh full` builds the LEGACY Paper 1.0 from a *different*
   source file (`paper-full.md`), with its version scraped from that file's
   frontmatter — using it for the canonical paper silently ships a
   stale-version wrong paper. Use `paper2` unless you specifically want
   Paper 1.0.

2. Check for undefined citation keys in the build output (warnings from pandoc-citeproc).

3. Grep for stale cross-references — section numbers may have shifted:
   ```bash
   grep -n 'Section [0-9]' docs/research/paper-full-2.0.md | head -20
   ```

4. Report:
   - Build success/failure
   - Output filename and version (from YAML frontmatter)
   - Any citation warnings
   - Any obvious stale section references

## Paper conventions
- Canonical paper: `docs/research/paper-full-2.0.md` (build with `./build.sh paper2`)
- Version in YAML frontmatter `version:` field
- References: `docs/research/references.bib`
- Build outputs: `docs/research/paper-2.0-vX.Y.Z.pdf`
- Legacy Paper 1.0: `docs/research/paper-full.md` (`./build.sh full`) — superseded; do not build for current claims
- Legacy short paper: `docs/research/paper-short.md` (`./build.sh short`)
