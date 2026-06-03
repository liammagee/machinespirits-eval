---
name: ms-paper-comic-explainer
description: Use this skill when Codex should generate Machine Spirits-style comic panels from a PDF paper, create ChatGPT image prompts, render optional PNG panels, or compose generated SVG/PNG panels into an explainer HTML file such as public/eval/geist-explained.html. The skill prompts for missing parameters, applies repo defaults, validates paths and image assets, and uses scripts/generate-paper-comics.js.
---

# Paper Comic Explainer

## Default Workflow

Use `npm run paper:comics -- ...` from the repo root. Prefer composing generated images into a real explainer page with distributed placements:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-placement distributed --html-image-source auto
```

`distributed` places each panel near a matching section; `strip` keeps the old single gallery behavior. `auto` uses a PNG when `manifest.json` has a valid `png_file`, otherwise SVG. Use `--html-image-source png` only after PNGs exist.

## Interactive Intake

If the user does not provide enough information, discover what can be inferred locally, then ask one concise question with defaults filled in. Capture:

- Mode: generate from PDF, compose existing panels into HTML, make PNGs, make ChatGPT prompts, or a combined run.
- PDF path: default to `docs/research/paper-2.0-v3.0.79.pdf` if it exists; otherwise ask.
- Image count: default to `12` for the paper 2/geist explainer workflow, otherwise `6`.
- Output directory: default to an existing latest directory under `public/eval/generated/paper-comics/`, or derive `public/eval/generated/paper-comics/<pdf-slug>`.
- HTML template: default to `public/eval/geist-explained.html` if it exists.
- HTML output: default to `<template-base>-with-distributed-comics.html` beside the template.
- Image source for the composed page: default `auto`; use `png` only when the user asks for PNG insertion.

Do not ask for options that are already clear from the request and local files.

## Validation

Before running, check required inputs:

```bash
test -f scripts/generate-paper-comics.js
test -f public/eval/geist-explained.html
test -f public/eval/generated/paper-comics/paper-2-0-v3-0-79/manifest.json
```

For API PNG generation, require the configured API key env var before running `--png-only` or `--png-too`:

```bash
test -n "$OPENAI_API_KEY"
```

After composing HTML, validate the script and local image references:

```bash
node --check scripts/generate-paper-comics.js
node - public/eval/geist-explained-with-distributed-comics.html <<'NODE'
const fs = require('fs');
const path = require('path');
const htmlPath = process.argv[2];
const html = fs.readFileSync(htmlPath, 'utf8');
const root = path.dirname(htmlPath);
const missing = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((src) => !/^(https?:|data:)/.test(src))
  .filter((src) => !fs.existsSync(path.resolve(root, src)));
if (missing.length) {
  console.error(missing.join('\n'));
  process.exit(1);
}
console.log('All local image references exist.');
NODE
```

Review `public/eval/generated/paper-comics/<run>/composed-html-report.json` for section ids and placement scores.

## Common Commands

Compose existing generated panels into an explainer:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-placement distributed --html-image-source auto
```

Generate PNGs, then force the composed HTML to use PNGs:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --png-only
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-placement distributed --html-image-source png
```

Generate ChatGPT image prompts for manual pasting:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --chatgpt-prompts-only
```

Generate a fresh run from a PDF and compose it:

```bash
npm run paper:comics -- docs/research/paper-2.0-v3.0.79.pdf --count 12 --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --html-placement distributed --html-image-source auto
```
