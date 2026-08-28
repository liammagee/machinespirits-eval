---
name: ms-paper-comic-explainer
description: Create prompts or bitmap panels from the current canonical Paper 2.0, or compose verified existing panels into explainer HTML. Resolve the matching paper version first; use the imagegen skill for raster generation and keep captions within the canonical paper's claim boundary.
---

# Paper Comic Explainer

Use `scripts/generate-paper-comics.js` through `npm run paper:comics -- ...` for
prompt preparation and deterministic composition. Use `$imagegen` for bitmap
generation unless the user explicitly requests the direct Image API and accepts
its cost.

## Resolve the source

1. Read the version from `docs/research/paper-full-2.0.md` frontmatter.
2. Resolve `docs/research/paper-2.0-v<version>.pdf`. If it is missing, use
   `$ms-build-paper` or stop; never silently select an older PDF.
3. Read the relevant canonical sections and establish a unique output directory
   that records the paper version.

## Choose one mode

- `prompts`: generate panel briefs/prompts only; no image-provider call.
- `generate`: create raster panels with `$imagegen`, preserving the prompt and
  paper-section provenance for each image.
- `compose`: place existing verified SVG/PNG panels into a named HTML template;
  no provider call.
- `combined`: generation and composition, with model-backed generation clearly
  separated from the deterministic compose step.

For prompt or compose flags, verify the current parser before use. Example:

```bash
npm run paper:comics -- \
  --out-dir public/eval/generated/paper-comics/paper-2-0-v<version> \
  --chatgpt-prompts-only

npm run paper:comics -- \
  --out-dir public/eval/generated/paper-comics/paper-2-0-v<version> \
  --html-template public/eval/geist-explained.html \
  --compose-html-only --html-placement distributed \
  --html-image-source auto
```

## Verify

- Confirm every source image exists, is the intended version, and appears in
  the manifest.
- Inspect `composed-html-report.json` for section placement and missing assets.
- Open the result for visual QA at representative desktop and mobile widths.
- Check every caption, numeric claim, and interpretive label against the exact
  canonical paper section. A comic may simplify presentation, not originate a
  claim.
- After substantive caption or claim-bearing edits, use the
  `paper-claim-auditor` reviewer.

Report paper version/PDF, mode, provider-call status, prompt/manifest paths,
HTML path, visual QA, claim audit, and any missing asset or indeterminate
caption.
