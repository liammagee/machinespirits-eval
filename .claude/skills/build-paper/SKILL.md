---
name: build-paper
description: Build the research paper PDF and check for issues
allowed-tools: Bash, Read, Grep, Glob
---

Build the research paper PDF and validate.

## Steps

1. Build the PDF:
   ```bash
   cd docs/research && ./build.sh full
   ```

2. Check for undefined citation keys in the build output (warnings from pandoc-citeproc).

3. Grep for stale cross-references — section numbers may have shifted:
   ```bash
   grep -n 'Section [0-9]' docs/research/paper-full.md | head -20
   ```

4. Report:
   - Build success/failure
   - Output filename and version (from YAML frontmatter)
   - Any citation warnings
   - Any obvious stale section references

## Paper conventions
- Full paper: `docs/research/paper-full.md`
- Version in YAML frontmatter `version:` field
- References: `docs/research/references.bib`
- Build outputs: `docs/research/paper-full-vX.Y.Z.pdf`
- Short paper: `docs/research/paper-short.md` (build with `./build.sh short`)
