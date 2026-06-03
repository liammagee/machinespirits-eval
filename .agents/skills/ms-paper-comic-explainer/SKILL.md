---
name: ms-paper-comic-explainer
description: Generate Machine Spirits-style comic panels from a PDF paper, create ChatGPT image prompts, render optional PNG panels, or compose generated SVG/PNG panels into an explainer HTML file with distributed section-level placement.
argument-hint: "[pdf-or-out-dir] [template-html]"
allowed-tools: Bash, Read, Grep, Glob
---

Use `scripts/generate-paper-comics.js` through `npm run paper:comics -- ...`.

## Interactive Intake

If `$ARGUMENTS` is incomplete, infer defaults from the repo and ask one concise question before running. Capture:

- Mode: generate from PDF, compose existing panels into HTML, make PNGs, make ChatGPT prompts, or a combined run.
- PDF path: default `docs/research/paper-2.0-v3.0.79.pdf` if present.
- Image count: default `12` for the paper 2/geist explainer, otherwise `6`.
- Output directory: default latest `public/eval/generated/paper-comics/*` with a `manifest.json`, or derive one from the PDF slug.
- HTML template: default `public/eval/geist-explained.html` if present.
- HTML output: default `<template-base>-with-distributed-comics.html`.
- Image source: default `auto`; use `png` only when the user asks for PNG insertion.

## Run Patterns

Compose existing panels into the explainer with smart section placement:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-placement distributed --html-image-source auto
```

Use PNGs in the composed page:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --png-only
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --compose-html-only --html-placement distributed --html-image-source png
```

Generate ChatGPT prompts:

```bash
npm run paper:comics -- --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --chatgpt-prompts-only
```

Generate a fresh run from a PDF and compose it:

```bash
npm run paper:comics -- docs/research/paper-2.0-v3.0.79.pdf --count 12 --out-dir public/eval/generated/paper-comics/paper-2-0-v3-0-79 --html-template public/eval/geist-explained.html --html-placement distributed --html-image-source auto
```

## Validation

Before running, validate required paths. If using `--html-image-source png`, either run `--png-only` first or confirm PNG files exist. If running the OpenAI Image API, require `OPENAI_API_KEY`.

After composing, run:

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

Check `public/eval/generated/paper-comics/<run>/composed-html-report.json` to confirm each image was matched to a section rather than all inserted in one location.
