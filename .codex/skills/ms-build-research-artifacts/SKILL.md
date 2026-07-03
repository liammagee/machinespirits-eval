---
name: ms-build-research-artifacts
description: Build the current Paper 2.0 PDF, research atlas, and dramatic-recognition arc artifacts through the consolidated npm build scripts. Use when asked to build or refresh the latest pdf, paper, atlas, arc, standalone arc, or all research publication artifacts on main.
allowed-tools: Bash, Read, Grep, Glob
---

Build the publication artifacts from the repo root using the consolidated npm
surface. Prefer these commands over rediscovering lower-level scripts.

## Commands

```bash
npm run research:build:paper   # canonical Paper 2.0 PDF only
npm run research:build:atlas   # atlas validate/build outputs
npm run research:build:arc     # managed arc HTML refresh + standalone package
npm run research:build         # paper + atlas + arc
```

Compatibility aliases remain available:

- `npm run paper:build` builds Paper 2.0. Do not use `docs/research/build.sh full`
  unless the user explicitly asks for legacy Paper 1.0.
- `npm run atlas:build` and `npm run atlas:validate` are the atlas primitives.
- `npm run poetics:arc-html` refreshes managed arc HTML without generating new
  images, then `npm run poetics:package-arc` writes the standalone HTML.

## Workflow

1. Confirm the checkout and cleanliness:
   ```bash
   git status --short --branch
   ```
   If on `main` and clean, fast-forward first with `git pull --ff-only`.

2. Run the requested consolidated build command. For the usual full refresh:
   ```bash
   npm run research:build 2>&1 | tee /tmp/research-build.log
   ```

3. Validate and inspect:
   ```bash
   npm run atlas:validate
   rg -n "warning|undefined|Citation|pandoc-citeproc|not found" /tmp/research-build.log || true
   git diff --check
   git status --short --branch
   ```

4. Report artifact paths:
   - `docs/research/paper-2.0-vX.Y.Z.pdf`
   - `docs/research/atlas/build/spine.pdf`
   - `docs/research/atlas/build/modules/*.pdf`
   - `notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.standalone.html`

## Gotchas

- Paper 2.0 source is `docs/research/paper-full-2.0.md`; the frontmatter
  `version:` determines the PDF filename.
- Paper PDFs and atlas build outputs are ignored local artifacts unless the user
  asks to publish or copy them elsewhere.
- The arc HTML refresh can create timestamp-only or whitespace-only diffs in
  tracked arc files. If there is no substantive content change and the user only
  asked to build, normalize or restore those diffs so `main` stays clean.
