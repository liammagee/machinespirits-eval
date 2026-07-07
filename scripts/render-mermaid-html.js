#!/usr/bin/env node
/**
 * Render a Mermaid .mmd file into a standalone HTML review page.
 *
 * The generated page uses public/components/mermaid-file-viewer.js and embeds the
 * Mermaid source as a fallback, so the page is still inspectable if the sibling
 * .mmd fetch fails when opened from the local filesystem.
 *
 * Usage:
 *   node scripts/render-mermaid-html.js docs/research/adaptive-tutelage-components.mmd
 *   node scripts/render-mermaid-html.js path/to/diagram.mmd --out path/to/diagram.html
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const COMPONENT_PATH = path.join(ROOT, 'public/components/mermaid-file-viewer.js');

function usage() {
  console.log(`Usage:
  node scripts/render-mermaid-html.js <diagram.mmd> [--out diagram.html]
      [--title "Title"] [--caption "Caption"] [--component path/to/component.js]`);
}

function parseArgs(argv) {
  const options = {
    input: null,
    out: null,
    title: null,
    caption: null,
    component: COMPONENT_PATH,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    } else if (token === '--out') {
      options.out = path.resolve(argv[++i]);
    } else if (token === '--title') {
      options.title = argv[++i];
    } else if (token === '--caption') {
      options.caption = argv[++i];
    } else if (token === '--component') {
      options.component = path.resolve(argv[++i]);
    } else if (!options.input) {
      options.input = path.resolve(token);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!options.input) throw new Error('Missing input .mmd file.');
  if (!options.out) options.out = options.input.replace(/\.mmd$/i, '.html');
  if (options.out === options.input) options.out = `${options.input}.html`;
  if (!options.title) options.title = titleFromFilename(options.input);
  if (!options.caption) {
    options.caption = 'Rendered Mermaid source with editable source shown below.';
  }

  return options;
}

function titleFromFilename(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}

function htmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function embeddedScriptText(value) {
  return String(value ?? '').replace(/<\/script/gi, '<\\/script');
}

function posixRelative(fromDir, targetPath) {
  const rel = path.relative(fromDir, targetPath) || '.';
  return rel.split(path.sep).join('/');
}

function buildHtml({ input, out, title, caption, component, source }) {
  const outDir = path.dirname(out);
  const componentSrc = posixRelative(outDir, component);
  const mermaidSrc = posixRelative(outDir, input);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${htmlText(title)}</title>
<style>
  :root {
    --paper: #f4eedd;
    --paper-2: #fbf6e8;
    --ink: #14100c;
    --ink-2: #2c241b;
    --ink-3: #5c5040;
    --rule: rgba(20, 16, 12, 0.18);
  }

  * { box-sizing: border-box; }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background: var(--paper);
    color: var(--ink-2);
    font-family: Georgia, Cambria, "Times New Roman", serif;
  }

  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(140% 90% at 50% 0%, transparent 55%, rgba(20, 16, 12, 0.08)),
      radial-gradient(80% 70% at 8% 92%, rgba(165, 62, 46, 0.06), transparent 70%);
  }

  main {
    width: min(96rem, calc(100vw - 2rem));
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 3rem) 0;
  }

  .kicker {
    margin: 0 0 0.5rem;
    color: var(--ink-3);
    font: 0.75rem/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 62rem;
    margin: 0 0 0.75rem;
    color: var(--ink);
    font-size: clamp(2rem, 1.25rem + 3vw, 4.4rem);
    line-height: 1;
    letter-spacing: 0;
  }

  .intro {
    max-width: 54rem;
    margin: 0 0 1.5rem;
    color: var(--ink-3);
    font-size: 1.05rem;
    line-height: 1.55;
  }

  .panel {
    border: 1px solid var(--rule);
    border-radius: 8px;
    background: rgba(251, 246, 232, 0.88);
    padding: clamp(0.8rem, 2vw, 1.4rem);
  }
</style>
</head>
<body>
<main>
  <p class="kicker">Mermaid HTML render</p>
  <h1>${htmlText(title)}</h1>
  <p class="intro">
    This page is generated from <code>${htmlText(path.basename(input))}</code>.
    The diagram renders through the reusable <code>mermaid-file-viewer</code>
    component and embeds the Mermaid source for review.
  </p>
  <section class="panel">
    <mermaid-file-viewer
      title="${htmlAttr(title)}"
      caption="${htmlAttr(caption)}"
      src="${htmlAttr(mermaidSrc)}"
    >
      <script type="text/plain" data-mermaid-source>${embeddedScriptText(source)}</script>
    </mermaid-file-viewer>
  </section>
</main>
<script src="${htmlAttr(componentSrc)}"></script>
</body>
</html>
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!existsSync(options.input)) throw new Error(`Input not found: ${options.input}`);
  if (!existsSync(options.component)) throw new Error(`Component not found: ${options.component}`);

  const source = readFileSync(options.input, 'utf8').trim();
  const html = buildHtml({ ...options, source });
  mkdirSync(path.dirname(options.out), { recursive: true });
  writeFileSync(options.out, html, 'utf8');
  console.log(`Wrote ${path.relative(ROOT, options.out)}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
