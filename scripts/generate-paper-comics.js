#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const DEFAULTS = {
  count: 6,
  codexBin: 'codex',
  explainer: 'public/eval/geist-in-the-machine.html',
  format: 'svg',
  imageModel: 'gpt-image-2',
  imageQuality: 'medium',
  imageSize: '1536x1024',
  maxChars: 24_000,
  openaiApiKeyEnv: 'OPENAI_API_KEY',
  outDir: 'public/eval/generated/paper-comics',
  pngConcurrency: 1,
  timeoutMs: 20 * 60 * 1000,
};

const MACHINE_SPIRITS_STYLE = `
Machine Spirits in-house comic style:
- Editorial scientific comic, not glossy sci-fi and not generic corporate vector art.
- Warm paper ground: #F4EEDD / #ECE3CB / #F8F2E2 with subtle grain.
- Ink palette: #14100C and #2C241B, with brick red #A53E2E / #7C2C1F, moss #56683A / #3A4824, ochre #C08A3E, and linen #D8C7A9.
- Swiss-grid composition with visible rules, margin labels, small numbered registers, and compact JetBrains-Mono-like annotations.
- Fraunces-like display lettering for short headings; Source-Serif-like captions.
- Trash-polka influence should be restrained: offset brick-red stamps, rough ink hatching, angular arrows, crop marks, and occasional collage fragments.
- Use diagrams, masks, speech bubbles, tutor/learner silhouettes, judge panels, and machine/ghost metaphors as visual vocabulary.
- Keep visual density high but legible; leave paper breathing room. Avoid neon, gradients-as-style, 3D renders, stock anime, and copyrighted characters.
- Text inside each image must be sparse: one compact title, one short label, and at most one speech bubble under 12 words.
`.trim();

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-paper-comics.js --pdf <paper.pdf> [options]
  node scripts/generate-paper-comics.js <paper.pdf> --count 8

Creates a Codex CLI generation brief for comic-strip explainer images from a
PDF paper, then invokes \`codex exec\` unless --dry-run is set. Composed HTML
uses distributed section-level insertions by default.

Options:
  --pdf, --paper <path>       Source PDF paper. Positional PDF is also accepted.
  -n, --count <number>        Notional number of images/panels to create. Default: ${DEFAULTS.count}
  --out-dir <path>            Output directory. Default: ${DEFAULTS.outDir}
  --explainer <path>          Explainer HTML path used for relative embed links.
                              Default: ${DEFAULTS.explainer}
  --title <text>              Human title for the generated strip.
  --format <svg|png>          Preferred image format. Default: ${DEFAULTS.format}
  --model <model>             Pass a model to codex exec.
  --codex-bin <path>          Codex executable. Default: ${DEFAULTS.codexBin}
  --codex-arg <arg>           Extra argument passed to codex exec. Repeatable.
  --html-template <path>      Template HTML to copy and augment with comic images.
  --html-output <path>        Composed HTML output path. Defaults to
                              <template-name>-with-distributed-comics.html.
  --compose-html-only         Compose HTML from an existing manifest/embed without
                              rerunning Codex.
  --html-placement <mode>     distributed or strip. Default: distributed.
  --html-image-source <kind>  auto, svg, or png. Default: auto.
  --insert-before-id <id>     Strip mode: insert before a specific element id.
  --insert-after-id <id>      Strip mode: insert after a specific element id.
  --html-section-title <text> Override the inserted image section title.
  --png-too                   After Codex generation, create PNG panels using
                              the OpenAI Image API.
  --png-only                  Create PNG panels from an existing manifest.json
                              without rerunning Codex.
  --chatgpt-prompts-too       After Codex generation, create paste-ready
                              ChatGPT image prompts from manifest.json.
  --chatgpt-prompts-only      Create paste-ready ChatGPT image prompts from an
                              existing manifest.json without rerunning Codex.
  --force-png                 Regenerate existing PNG panel files.
  --image-model <model>       OpenAI image model. Default: ${DEFAULTS.imageModel}
  --image-size <WxH|auto>     PNG size. Default: ${DEFAULTS.imageSize}
  --image-quality <quality>   low, medium, high, or auto. Default: ${DEFAULTS.imageQuality}
  --openai-api-key-env <env>  Env var containing the API key. Default: ${DEFAULTS.openaiApiKeyEnv}
  --png-concurrency <number>  Parallel PNG requests. Default: ${DEFAULTS.pngConcurrency}
  --max-chars <number>        Max extracted PDF characters in the Codex brief.
                              Default: ${DEFAULTS.maxChars}
  --timeout-ms <number>       Codex execution timeout. Default: ${DEFAULTS.timeoutMs}
  --patch-explainer           Ask Codex to insert the generated snippet into the
                              explainer HTML. Default is snippet-only.
  --preview-only              Create/refresh <out-dir>/preview.html from an
                              existing embed.html without calling Codex.
  --no-extract                Do not pre-extract PDF text; pass the PDF path only.
  --full-auto                 Pass --full-auto to codex.
  --dangerous                 Pass --dangerously-bypass-approvals-and-sandbox.
  --dry-run                   Write prompt/brief files but do not call Codex.
  -h, --help                  Show this help.

Output:
  <out-dir>/codex-prompt.md
  <out-dir>/generation-brief.md
  <out-dir>/manifest.json           (created by Codex during generation)
  <out-dir>/embed.html              (created by Codex during generation)
  <out-dir>/preview.html            (standalone local preview wrapper)
  <out-dir>/panel-01.svg ...        (or requested fallback/bitmap format)
  <template-name>-with-distributed-comics.html  (when --html-template is set)
`);
}

function parseArgs(argv) {
  const opts = {
    ...DEFAULTS,
    codexArgs: [],
    dryRun: false,
    fullAuto: false,
    dangerous: false,
    noExtract: false,
    patchExplainer: false,
    previewOnly: false,
    pngOnly: false,
    pngToo: false,
    composeHtmlOnly: false,
    htmlImageSource: 'auto',
    htmlPlacement: 'distributed',
    chatgptPromptsOnly: false,
    chatgptPromptsToo: false,
    forcePng: false,
    title: null,
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--pdf' || arg === '--paper') {
      opts.pdf = next();
    } else if (arg === '--count' || arg === '-n') {
      opts.count = parsePositiveInt(next(), 'count');
    } else if (arg === '--out-dir') {
      opts.outDir = next();
      opts.outDirWasSet = true;
    } else if (arg === '--explainer') {
      opts.explainer = next();
      opts.explainerWasSet = true;
    } else if (arg === '--title') {
      opts.title = next();
    } else if (arg === '--format') {
      opts.format = next().toLowerCase();
    } else if (arg === '--model') {
      opts.model = next();
    } else if (arg === '--codex-bin') {
      opts.codexBin = next();
    } else if (arg === '--codex-arg') {
      opts.codexArgs.push(next());
    } else if (arg === '--html-template') {
      opts.htmlTemplate = next();
    } else if (arg === '--html-output') {
      opts.htmlOutput = next();
    } else if (arg === '--compose-html-only') {
      opts.composeHtmlOnly = true;
    } else if (arg === '--html-placement') {
      opts.htmlPlacement = next().toLowerCase();
    } else if (arg === '--html-image-source') {
      opts.htmlImageSource = next().toLowerCase();
    } else if (arg === '--insert-before-id') {
      opts.insertBeforeId = next();
    } else if (arg === '--insert-after-id') {
      opts.insertAfterId = next();
    } else if (arg === '--html-section-title') {
      opts.htmlSectionTitle = next();
    } else if (arg === '--png-too') {
      opts.pngToo = true;
    } else if (arg === '--png-only') {
      opts.pngOnly = true;
    } else if (arg === '--chatgpt-prompts-too') {
      opts.chatgptPromptsToo = true;
    } else if (arg === '--chatgpt-prompts-only' || arg === '--prompt-pack-only') {
      opts.chatgptPromptsOnly = true;
    } else if (arg === '--force-png') {
      opts.forcePng = true;
    } else if (arg === '--image-model') {
      opts.imageModel = next();
    } else if (arg === '--image-size') {
      opts.imageSize = next();
    } else if (arg === '--image-quality') {
      opts.imageQuality = next();
    } else if (arg === '--openai-api-key-env') {
      opts.openaiApiKeyEnv = next();
    } else if (arg === '--png-concurrency') {
      opts.pngConcurrency = parsePositiveInt(next(), 'png-concurrency');
    } else if (arg === '--max-chars') {
      opts.maxChars = parsePositiveInt(next(), 'max-chars');
    } else if (arg === '--timeout-ms') {
      opts.timeoutMs = parsePositiveInt(next(), 'timeout-ms');
    } else if (arg === '--patch-explainer') {
      opts.patchExplainer = true;
    } else if (arg === '--preview-only') {
      opts.previewOnly = true;
    } else if (arg === '--no-extract') {
      opts.noExtract = true;
    } else if (arg === '--full-auto') {
      opts.fullAuto = true;
    } else if (arg === '--dangerous') {
      opts.dangerous = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  if (!opts.pdf && positionals.length > 0) opts.pdf = positionals[0];
  if (!['svg', 'png'].includes(opts.format)) {
    throw new Error(`--format must be svg or png, got: ${opts.format}`);
  }
  if (!['low', 'medium', 'high', 'auto'].includes(opts.imageQuality)) {
    throw new Error(`--image-quality must be low, medium, high, or auto, got: ${opts.imageQuality}`);
  }
  if (!['auto', 'svg', 'png'].includes(opts.htmlImageSource)) {
    throw new Error(`--html-image-source must be auto, svg, or png, got: ${opts.htmlImageSource}`);
  }
  if (!['distributed', 'strip'].includes(opts.htmlPlacement)) {
    throw new Error(`--html-placement must be distributed or strip, got: ${opts.htmlPlacement}`);
  }

  return opts;
}

function parsePositiveInt(raw, label) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`--${label} must be a positive integer`);
  }
  return value;
}

function resolveInsideRootOrAbsolute(input) {
  if (path.isAbsolute(input)) return path.normalize(input);
  return path.resolve(ROOT, input);
}

function relativeToRoot(target) {
  const rel = path.relative(ROOT, target);
  return rel && !rel.startsWith('..') ? rel : target;
}

function relativeFromExplainer(explainerPath, assetPath) {
  const fromDir = path.dirname(explainerPath);
  return path.relative(fromDir, assetPath).split(path.sep).join('/');
}

function relativeFromDirectory(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/') || '.';
}

function isInsideRoot(target) {
  const rel = path.relative(ROOT, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function slugFromPdf(pdfPath) {
  return (
    path
      .basename(pdfPath, path.extname(pdfPath))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'paper'
  );
}

function defaultComposedHtmlPath(templatePath, imageSource, htmlPlacement) {
  const ext = path.extname(templatePath) || '.html';
  const stem = path.basename(templatePath, ext);
  const imagePart = imageSource === 'png' ? 'png-comics' : 'comics';
  const suffix = htmlPlacement === 'distributed' ? `with-distributed-${imagePart}` : `with-${imagePart}`;
  return path.join(path.dirname(templatePath), `${stem}-${suffix}${ext}`);
}

async function extractPdfText(pdfPath, maxChars) {
  const attempts = [
    {
      label: 'pdftotext',
      command: 'pdftotext',
      args: ['-layout', '-enc', 'UTF-8', pdfPath, '-'],
    },
    {
      label: 'mutool',
      command: 'mutool',
      args: ['draw', '-F', 'txt', '-o', '-', pdfPath],
    },
    {
      label: 'python-pypdf',
      command: 'python3',
      args: [
        '-c',
        [
          'import sys',
          'pdf_path = sys.argv[1]',
          'reader = None',
          'errors = []',
          'for name in ("pypdf", "PyPDF2"):',
          '    try:',
          '        mod = __import__(name)',
          '        reader = mod.PdfReader(pdf_path)',
          '        break',
          '    except Exception as exc:',
          '        errors.append(f"{name}: {exc}")',
          'if reader is None:',
          '    raise SystemExit("; ".join(errors))',
          'for page in reader.pages:',
          '    print(page.extract_text() or "")',
        ].join('\n'),
        pdfPath,
      ],
    },
  ];

  const errors = [];
  for (const attempt of attempts) {
    try {
      const stdout = await collectCommand(attempt.command, attempt.args, {
        cwd: ROOT,
        timeoutMs: 60_000,
      });
      const cleaned = cleanExtractedText(stdout);
      if (cleaned.length > 500) {
        return {
          label: attempt.label,
          text: excerptText(cleaned, maxChars),
          rawChars: cleaned.length,
        };
      }
      errors.push(`${attempt.label}: extracted too little text (${cleaned.length} chars)`);
    } catch (error) {
      errors.push(`${attempt.label}: ${error.message}`);
    }
  }

  return {
    label: 'none',
    text: '',
    rawChars: 0,
    errors,
  };
}

function cleanExtractedText(raw) {
  return String(raw || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function excerptText(text, maxChars) {
  if (text.length <= maxChars) return text;

  const markerBudget = 260;
  const available = Math.max(1_000, maxChars - markerBudget);
  const third = Math.floor(available / 3);
  const start = text.slice(0, third);
  const middleStart = Math.max(0, Math.floor(text.length / 2 - third / 2));
  const middle = text.slice(middleStart, middleStart + third);
  const end = text.slice(-third);

  return [
    start,
    `\n\n[... ${text.length - available} characters omitted; middle excerpt follows ...]\n\n`,
    middle,
    '\n\n[... final excerpt follows ...]\n\n',
    end,
  ].join('');
}

function buildBrief(opts, resolved) {
  const ext = opts.format;
  const countPad = String(opts.count).length;
  const panelList = Array.from({ length: opts.count }, (_, index) => {
    const n = String(index + 1).padStart(Math.max(2, countPad), '0');
    return `- panel-${n}.${ext}`;
  }).join('\n');

  return `
# Paper Comic Strip Generation Brief

Title: ${resolved.title}
Source PDF: ${relativeToRoot(resolved.pdfPath)}
Explainer target: ${relativeToRoot(resolved.explainerPath)}
Output directory: ${relativeToRoot(resolved.outDir)}
Requested image count: ${opts.count}
Preferred format: ${opts.format}

## Expected Assets

${panelList}
- manifest.json
- embed.html
- preview.html
- README.md

## Style

${MACHINE_SPIRITS_STYLE}

## Embed Contract

Images are intended for an explainer page like \`${relativeToRoot(resolved.explainerPath)}\`.
The generated \`embed.html\` should use relative URLs from the explainer file to the assets.
Suggested class names: \`paper-comic-strip\`, \`paper-comic-panel\`, \`paper-comic-panel__img\`,
\`paper-comic-panel__caption\`.
The generated \`preview.html\` is standalone and should be safe to open directly from the output directory.
If PNGs are requested later, \`embed-png.html\` and \`preview-png.html\` should point at the PNG files.
If ChatGPT prompts are requested later, \`chatgpt-image-prompts.md\` and
\`chatgpt-image-prompts.html\` should contain paste-ready prompts.
`.trim();
}

function buildCodexPrompt(opts, resolved, extraction) {
  const relOut = relativeToRoot(resolved.outDir);
  const relPdf = relativeToRoot(resolved.pdfPath);
  const relExplainer = relativeToRoot(resolved.explainerPath);
  const ext = opts.format;
  const countPad = Math.max(2, String(opts.count).length);
  const expectedFiles = Array.from({ length: opts.count }, (_, index) => {
    const n = String(index + 1).padStart(countPad, '0');
    return `${relOut}/panel-${n}.${ext}`;
  });
  const relativeAssetPrefix = relativeFromExplainer(
    resolved.explainerPath,
    path.join(resolved.outDir, 'panel-01.svg'),
  ).replace(/panel-01\.svg$/, '');

  const extractionBlock = extraction.text
    ? `
The script already extracted a bounded PDF excerpt with ${extraction.label}
(${extraction.rawChars} source characters before trimming):

<pdf_excerpt>
${extraction.text}
</pdf_excerpt>
`
    : `
No reliable PDF text extraction was available before this Codex call.
Inspect the PDF directly if useful:
${relPdf}
Extraction errors:
${(extraction.errors || []).map((e) => `- ${e}`).join('\n') || '- none recorded'}
`;

  return `
You are Codex running inside the Machine Spirits evaluation repository.
Create comic-strip image assets for an explainer article from the PDF paper below.

Do the work directly in the repository. Do not ask clarifying questions.

Source PDF: ${relPdf}
Explainer target: ${relExplainer}
Output directory: ${relOut}
Requested count: exactly ${opts.count} images
Preferred image format: ${opts.format}
Human title: ${resolved.title}

Use this in-house visual style exactly as the governing art direction:

${MACHINE_SPIRITS_STYLE}

Deliverables:
1. Create exactly these image asset files:
${expectedFiles.map((f) => `   - ${f}`).join('\n')}
2. Create ${relOut}/manifest.json with:
   {
     "title": string,
     "source_pdf": string,
     "explainer": string,
     "style": "machinespirits-in-house-comic-v1",
     "images": [
       {
         "file": string,
         "embed_src": string,
         "alt": string,
         "caption": string,
         "paper_claim": string,
         "visual_metaphor": string
       }
     ]
   }
3. Create ${relOut}/embed.html with a copy-pasteable HTML section for the explainer.
   Use relative asset URLs from ${relExplainer}; the asset URL prefix should begin like:
   ${relativeAssetPrefix}
4. Create ${relOut}/preview.html as a standalone page for local review. It may wrap embed.html
   or duplicate the section, but image links must resolve correctly when preview.html is opened
   directly from ${relOut}.
5. If PNG generation is requested after this Codex step, the wrapper script will create
   ${relOut}/embed-png.html and ${relOut}/preview-png.html from manifest.json.
6. If ChatGPT prompt generation is requested after this Codex step, the wrapper script will
   create ${relOut}/chatgpt-image-prompts.md and ${relOut}/chatgpt-image-prompts.html from manifest.json.
7. Create ${relOut}/README.md documenting the generation brief, source PDF, requested count,
   and any fallback you used.
8. ${
    opts.patchExplainer
      ? `Patch ${relExplainer} to include the generated embed section at a sensible place. Preserve existing style and content.`
      : `Do not edit ${relExplainer}; only create the embed snippet.`
  }

Image requirements:
- SVG is acceptable and preferred for Codex CLI reliability. If an image-generation tool is available
  and you can create polished PNGs, you may use it only if the final files match the requested names.
- If true PNG generation is unavailable, create valid standalone SVG files even when PNG was requested,
  and record the fallback clearly in manifest.json and README.md.
- Each image should work as an independent comic panel/strip in an HTML <img> tag.
- Use a 16:10 or 3:2 composition, around 1600 by 1000 for SVG viewBox.
- Include <title> and <desc> metadata in every SVG.
- Make the sequence coherent: start with the paper's central problem, then method/apparatus,
  main finding, mechanism, complication/null or boundary, and implication.
- Use concise visual storytelling. Avoid long quotes, tiny unreadable text, and decorative clutter.
- Keep speech bubbles under 12 words. Avoid verbatim blocks from the paper.
- Do not introduce copyrighted characters or website screenshots.

${extractionBlock}

Return a brief final note listing the files created.
`.trim();
}

async function collectCommand(command, args, { cwd, timeoutMs }) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
      }
    });
  });
}

function writePreviewHtml(
  resolved,
  { embedFile = 'embed.html', previewFile = 'preview.html', titleSuffix = 'comic preview' } = {},
) {
  const embedPath = path.join(resolved.outDir, embedFile);
  if (!fs.existsSync(embedPath)) return false;

  const previewPath = path.join(resolved.outDir, previewFile);
  const baseHref = relativeFromDirectory(resolved.outDir, path.dirname(resolved.explainerPath));
  const embed = fs.readFileSync(embedPath, 'utf8');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<base href="${baseHref}/" />
<title>${escapeHtml(resolved.title)} - ${escapeHtml(titleSuffix)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:opsz,wght@8..60,200..900&family=JetBrains+Mono:wght@300..700&display=swap" />
<style>
  :root {
    --paper: #F4EEDD;
    --ink: #14100C;
    --ink-2: #2C241B;
    --rule: rgba(28, 22, 16, 0.18);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink-2);
    font-family: "Source Serif 4", Georgia, serif;
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    opacity: 0.16;
    background-image: radial-gradient(rgba(20,16,12,0.55) 0.5px, transparent 0.5px);
    background-size: 3px 3px;
    mix-blend-mode: multiply;
  }
  main {
    width: min(92rem, calc(100vw - 2rem));
    margin: 0 auto;
    padding: clamp(1rem, 4vw, 4rem);
  }
  .preview-note {
    border-bottom: 1px solid var(--rule);
    color: #5C5040;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    margin-bottom: 2rem;
    padding-bottom: 0.75rem;
    text-transform: uppercase;
  }
</style>
</head>
<body>
<main>
  <p class="preview-note">standalone preview / embed paths resolved from explainer root</p>
${indent(embed.trim(), 2)}
</main>
</body>
</html>
`;
  fs.writeFileSync(previewPath, html);
  return previewPath;
}

function composeHtmlFromTemplate(resolved, opts) {
  if (!resolved.htmlTemplatePath) {
    throw new Error('Missing --html-template <path>');
  }
  if (!fs.existsSync(resolved.htmlTemplatePath)) {
    throw new Error(`Template HTML not found: ${resolved.htmlTemplatePath}`);
  }
  if (path.resolve(resolved.htmlTemplatePath) === path.resolve(resolved.htmlOutputPath)) {
    throw new Error('--html-output must be a new file, not the template path');
  }

  const { manifest } = loadManifest(resolved.outDir);
  const template = fs.readFileSync(resolved.htmlTemplatePath, 'utf8');
  const inserted =
    opts.htmlPlacement === 'strip'
      ? insertImageSection(template, buildComposedImageSection(resolved, manifest, opts), opts)
      : insertDistributedImageSections(template, resolved, manifest, opts);
  fs.mkdirSync(path.dirname(resolved.htmlOutputPath), { recursive: true });
  fs.writeFileSync(resolved.htmlOutputPath, inserted.html);

  const reportPath = path.join(resolved.outDir, 'composed-html-report.json');
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        template: relativeToRoot(resolved.htmlTemplatePath),
        output: relativeToRoot(resolved.htmlOutputPath),
        image_source: opts.htmlImageSource,
        placement: opts.htmlPlacement,
        insertion: inserted.reason,
        placements: inserted.placements || [],
        generated_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${relativeToRoot(resolved.htmlOutputPath)}`);
  console.log(`Wrote ${relativeToRoot(reportPath)}`);
  return resolved.htmlOutputPath;
}

function buildComposedImageSection(resolved, manifest, opts) {
  const images = normalizeManifestImages(manifest);
  const sectionTitle =
    opts.htmlSectionTitle ||
    inferTitleFromEmbed(resolved.outDir) ||
    manifest.display_title ||
    manifest.title ||
    `Comic explainer in ${images.length} panels`;
  const kicker = inferKickerFromEmbed(resolved.outDir) || 'comic explainer / generated image sequence';
  const figures = images
    .map((image, index) => {
      const assetPath = resolveManifestImageAsset(resolved, image, index, opts.htmlImageSource);
      const src = relativeFromDirectory(path.dirname(resolved.htmlOutputPath), assetPath);
      const caption = image.caption || image.paper_claim || '';
      return `    <figure class="paper-comic-panel">
      <img class="paper-comic-panel__img" src="${escapeHtml(src)}" alt="${escapeHtml(image.alt || caption)}" loading="lazy" decoding="async" />
      <figcaption class="paper-comic-panel__caption">${escapeHtml(caption)}</figcaption>
    </figure>`;
    })
    .join('\n');

  return `
<!-- paper-comics:begin source="${escapeHtml(relativeToRoot(resolved.outDir))}" -->
<section class="paper-comic-strip paper-comic-strip--composed" id="paper-comics">
  <style>
    .paper-comic-strip {
      --comic-paper: #F4EEDD;
      --comic-ink: #14100C;
      --comic-rule: rgba(20, 16, 12, 0.18);
      display: grid;
      gap: clamp(1.25rem, 2vw, 2rem);
      margin: clamp(2.5rem, 7vw, 6rem) auto;
      max-width: 92rem;
      padding: 0 clamp(1rem, 4vw, 4rem);
    }
    .paper-comic-strip__header {
      border-top: 1px solid var(--comic-rule);
      border-bottom: 1px solid var(--comic-rule);
      padding: 0.9rem 0;
    }
    .paper-comic-strip__kicker {
      font-family: "JetBrains Mono", monospace;
      font-size: 0.72rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #5C5040;
      margin: 0 0 0.35rem;
    }
    .paper-comic-strip__title {
      font-family: "Fraunces", "Source Serif 4", Georgia, serif;
      color: var(--comic-ink);
      font-size: clamp(1.8rem, 4vw, 3.6rem);
      line-height: 1.05;
      margin: 0;
    }
    .paper-comic-panel {
      margin: 0;
      display: grid;
      gap: 0.65rem;
    }
    .paper-comic-panel__img {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid var(--comic-rule);
      background: var(--comic-paper);
    }
    .paper-comic-panel__caption {
      max-width: 58rem;
      color: #2C241B;
      font-family: "Source Serif 4", Georgia, serif;
      font-size: clamp(0.95rem, 1.1vw, 1.08rem);
      line-height: 1.45;
    }
  </style>
  <header class="paper-comic-strip__header">
    <p class="paper-comic-strip__kicker">${escapeHtml(kicker)}</p>
    <h2 class="paper-comic-strip__title">${escapeHtml(sectionTitle)}</h2>
  </header>
${figures}
</section>
<!-- paper-comics:end -->
`.trim();
}

function insertDistributedImageSections(template, resolved, manifest, opts) {
  const sections = extractTemplateSections(template);
  if (sections.length === 0) {
    return insertImageSection(template, buildComposedImageSection(resolved, manifest, opts), opts);
  }

  const images = normalizeManifestImages(manifest);
  const placements = images.map((image, index) => {
    const section = chooseTemplateSectionForImage(image, sections, index);
    return {
      image,
      index,
      section,
      score: scoreImageForSection(image, section, index),
    };
  });

  const bySection = new Map();
  for (const placement of placements) {
    if (!bySection.has(placement.section.id)) bySection.set(placement.section.id, []);
    bySection.get(placement.section.id).push(placement);
  }

  const injections = [];
  injections.push({
    index: sections[0].start,
    html: buildDistributedComicStyle(),
  });

  for (const [sectionId, sectionPlacements] of bySection.entries()) {
    const section = sections.find((candidate) => candidate.id === sectionId);
    injections.push({
      index: section.openEnd,
      html: buildInlinePanelGroup(resolved, section, sectionPlacements, opts),
    });
  }

  injections.sort((a, b) => b.index - a.index);
  let html = template;
  for (const injection of injections) {
    html = `${html.slice(0, injection.index)}\n${injection.html}\n${html.slice(injection.index)}`;
  }

  return {
    html,
    reason: `distributed across ${bySection.size} matched section(s)`,
    placements: placements.map((placement) => ({
      panel: placement.index + 1,
      section_id: placement.section.id,
      score: placement.score,
      caption: placement.image.caption || null,
    })),
  };
}

function extractTemplateSections(html) {
  const sectionRegex = /<section\b([^>]*)>/gi;
  const sections = [];
  let match;
  while ((match = sectionRegex.exec(html))) {
    const attrs = match[1] || '';
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (id === 'paper-comics') continue;
    const start = match.index;
    const openEnd = sectionRegex.lastIndex;
    const nextStart = findNextSectionStart(html, openEnd);
    const end = nextStart === -1 ? findClosingBoundary(html, openEnd) : nextStart;
    const body = html.slice(openEnd, end);
    const heading = firstTagText(body, 'h2') || firstTagText(body, 'h1') || '';
    const kicker = classText(body, 's__kicker') || classText(body, 'hero__rune') || '';
    const text = stripHtml(body).replace(/\s+/g, ' ').slice(0, 2200);
    sections.push({
      id,
      attrs,
      start,
      openEnd,
      end,
      heading,
      kicker,
      text,
      signature: normalizeMatchText([id, heading, kicker, text].join(' ')),
    });
  }
  return sections;
}

function findNextSectionStart(html, fromIndex) {
  const next = html.slice(fromIndex).search(/<section\b/i);
  return next === -1 ? -1 : fromIndex + next;
}

function findClosingBoundary(html, fromIndex) {
  const footer = html.slice(fromIndex).search(/<footer\b/i);
  if (footer !== -1) return fromIndex + footer;
  const bodyClose = html.slice(fromIndex).search(/<\/body>/i);
  if (bodyClose !== -1) return fromIndex + bodyClose;
  return html.length;
}

function chooseTemplateSectionForImage(image, sections, index) {
  const scored = sections.map((section) => ({
    section,
    score: scoreImageForSection(image, section, index),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].section;
}

function scoreImageForSection(image, section, index) {
  const source = normalizeMatchText(
    [image.caption, image.paper_claim, image.visual_metaphor, image.alt].filter(Boolean).join(' '),
  );
  const sectionTokens = new Set(section.signature.split(' ').filter((token) => token.length > 3));
  let score = 0;
  for (const token of source.split(' ')) {
    if (token.length > 3 && sectionTokens.has(token)) score += 2;
  }

  const phraseWeights = [
    ['information transfer empty vessel monotonal', 'why', 80],
    ['recognition interpretation autonomy subject hegelian', 'idea', 80],
    ['two voices ego superego architecture critique', 'built', 80],
    ['factorial design judges model process tracing provable evidence', 'test', 80],
    ['large improvement replicated model judge headline', 'finding1', 80],
    [
      'calibration floor variance weakest dimensions error correction superego substitution architecture weaker model',
      'finding2',
      90,
    ],
    ['adaptive responsiveness null trajectory multi turn trap', 'finding3', 90],
    ['learner effects tutor production asymmetry student threshold', 'finding4', 90],
    ['constructivist behaviorist intersubjective hegel vocabulary', 'finding5', 90],
    ['caveat bounded human learning outcome limitation', 'caveats', 70],
    ['takeaway apparatus contribution transferable designers builders researchers', 'matters', 70],
  ];
  for (const [terms, sectionId, weight] of phraseWeights) {
    if (section.id !== sectionId) continue;
    const hits = terms.split(' ').filter((term) => source.includes(term)).length;
    score += hits * weight;
  }

  const fallback = [
    'why',
    'idea',
    'test',
    'test',
    'finding2',
    'finding2',
    'finding2',
    'finding2',
    'finding3',
    'finding4',
    'finding5',
    'matters',
  ];
  if (section.id === fallback[index]) score += 40;
  return score;
}

function normalizeMatchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildDistributedComicStyle() {
  return `
<!-- paper-comics:style -->
<style>
  .paper-comic-inline {
    --comic-paper: #F4EEDD;
    --comic-ink: #14100C;
    --comic-rule: rgba(20, 16, 12, 0.18);
    display: grid;
    gap: 1.2rem;
    margin: clamp(1.5rem, 4vw, 3rem) 0 clamp(2rem, 5vw, 4rem);
  }
  .paper-comic-inline__label {
    color: #7C2C1F;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    margin: 0;
    text-transform: uppercase;
  }
  .paper-comic-inline__grid {
    display: grid;
    gap: 1rem;
  }
  .paper-comic-inline__figure {
    margin: 0;
    display: grid;
    gap: 0.6rem;
  }
  .paper-comic-inline__figure img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--comic-rule);
    background: var(--comic-paper);
  }
  .paper-comic-inline__figure figcaption {
    max-width: 58rem;
    color: #2C241B;
    font-family: "Source Serif 4", Georgia, serif;
    font-size: clamp(0.9rem, 1vw, 1rem);
    line-height: 1.45;
  }
  @media (min-width: 72rem) {
    .paper-comic-inline__grid[data-count="2"] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
<!-- /paper-comics:style -->`.trim();
}

function buildInlinePanelGroup(resolved, section, placements, opts) {
  const figures = placements
    .map((placement) => {
      const assetPath = resolveManifestImageAsset(resolved, placement.image, placement.index, opts.htmlImageSource);
      const src = relativeFromDirectory(path.dirname(resolved.htmlOutputPath), assetPath);
      const caption = placement.image.caption || placement.image.paper_claim || '';
      return `    <figure class="paper-comic-inline__figure">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(placement.image.alt || caption)}" loading="lazy" decoding="async" />
      <figcaption>${escapeHtml(caption)}</figcaption>
    </figure>`;
    })
    .join('\n');

  return `
<!-- paper-comics:inline section="${escapeHtml(section.id)}" -->
<aside class="paper-comic-inline" aria-label="Comic panels for ${escapeHtml(section.heading || section.id)}">
  <p class="paper-comic-inline__label">comic panels / ${escapeHtml(section.id)}</p>
  <div class="paper-comic-inline__grid" data-count="${placements.length}">
${figures}
  </div>
</aside>
<!-- /paper-comics:inline -->`.trim();
}

function firstTagText(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = html.match(re);
  return match ? stripHtml(match[1]).trim() : '';
}

function classText(html, className) {
  const escaped = escapeRegExp(className);
  const re = new RegExp(
    `<([a-zA-Z][\\w:-]*)\\b[^>]*\\bclass=["'][^"']*${escaped}[^"']*["'][^>]*>([\\s\\S]*?)</\\1>`,
    'i',
  );
  const match = html.match(re);
  return match ? stripHtml(match[2]).trim() : '';
}

function resolveManifestImageAsset(resolved, image, index, imageSource) {
  const pngCandidate = image.png_file ? path.resolve(resolved.outDir, image.png_file) : null;
  const svgCandidate = resolveManifestImageFile(resolved, image, index);

  if (imageSource === 'png') {
    if (!pngCandidate || !fs.existsSync(pngCandidate)) {
      throw new Error(
        `PNG requested but not found for panel ${index + 1}; run --png-only first or use --html-image-source svg`,
      );
    }
    return pngCandidate;
  }

  if (imageSource === 'auto' && pngCandidate && fs.existsSync(pngCandidate)) {
    return pngCandidate;
  }

  return svgCandidate;
}

function resolveManifestImageFile(resolved, image, index) {
  const candidates = [];
  if (image.file) candidates.push(image.file);
  if (image.embed_src) candidates.push(path.resolve(path.dirname(resolved.explainerPath), image.embed_src));
  candidates.push(`panel-${String(index + 1).padStart(2, '0')}.svg`);

  for (const candidate of candidates) {
    const full = path.isAbsolute(candidate) ? candidate : path.resolve(resolved.outDir, candidate);
    if (fs.existsSync(full)) return full;
  }

  throw new Error(`No image file found for panel ${index + 1}`);
}

function inferTitleFromEmbed(outDir) {
  const embedPath = path.join(outDir, 'embed.html');
  if (!fs.existsSync(embedPath)) return null;
  const embed = fs.readFileSync(embedPath, 'utf8');
  const match = embed.match(/<h2\b[^>]*class=["'][^"']*paper-comic-strip__title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
  return match ? stripHtml(match[1]).trim() : null;
}

function inferKickerFromEmbed(outDir) {
  const embedPath = path.join(outDir, 'embed.html');
  if (!fs.existsSync(embedPath)) return null;
  const embed = fs.readFileSync(embedPath, 'utf8');
  const match = embed.match(/<p\b[^>]*class=["'][^"']*paper-comic-strip__kicker[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripHtml(match[1]).trim() : null;
}

function insertImageSection(template, section, opts) {
  const marker = template.match(/<!--\s*paper-comics:insert\s*-->/i);
  if (marker) {
    return {
      html: `${template.slice(0, marker.index)}${marker[0]}\n${section}\n${template.slice(marker.index + marker[0].length)}`,
      reason: 'marker: paper-comics:insert',
    };
  }

  if (opts.insertBeforeId) {
    const target = findElementStartById(template, opts.insertBeforeId);
    if (!target) throw new Error(`Could not find --insert-before-id ${opts.insertBeforeId}`);
    return insertAt(template, target.start, section, `before id=${opts.insertBeforeId}`);
  }

  if (opts.insertAfterId) {
    const target = findElementById(template, opts.insertAfterId);
    if (!target) throw new Error(`Could not find --insert-after-id ${opts.insertAfterId}`);
    return insertAt(template, target.end, section, `after id=${opts.insertAfterId}`);
  }

  const firstContent = findFirstContentSection(template);
  if (firstContent) {
    return insertAt(template, firstContent.start, section, `before first content section id=${firstContent.id}`);
  }

  const footer = template.search(/<footer\b/i);
  if (footer !== -1) return insertAt(template, footer, section, 'before footer');

  const bodyClose = template.search(/<\/body>/i);
  if (bodyClose !== -1) return insertAt(template, bodyClose, section, 'before body close');

  return insertAt(template, template.length, section, 'end of file');
}

function insertAt(template, index, section, reason) {
  return {
    html: `${template.slice(0, index)}\n\n${section}\n\n${template.slice(index)}`,
    reason,
  };
}

function findFirstContentSection(html) {
  const sectionRegex = /<section\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = sectionRegex.exec(html))) {
    const id = match[1];
    if (['why', 'intro', 'overview', 'idea', 'built', 'test', 'finding1'].includes(id)) {
      return { id, start: match.index };
    }
  }
  const generic = html.match(/<section\b[^>]*>/i);
  return generic ? { id: 'first-section', start: generic.index } : null;
}

function findElementStartById(html, id) {
  const escaped = escapeRegExp(id);
  const re = new RegExp(`<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid=["']${escaped}["'][^>]*>`, 'i');
  const match = html.match(re);
  return match ? { tag: match[1].toLowerCase(), start: match.index } : null;
}

function findElementById(html, id) {
  const start = findElementStartById(html, id);
  if (!start) return null;
  const close = new RegExp(`</${escapeRegExp(start.tag)}>`, 'i');
  close.lastIndex = start.start;
  const rest = html.slice(start.start);
  const closeMatch = rest.match(close);
  if (!closeMatch) return { ...start, end: start.start };
  return {
    ...start,
    end: start.start + closeMatch.index + closeMatch[0].length,
  };
}

async function generatePngAssets(resolved, opts) {
  const { manifest, manifestPath } = loadManifest(resolved.outDir);
  const images = normalizeManifestImages(manifest);
  const promptDir = path.join(resolved.outDir, 'image-prompts');
  fs.mkdirSync(promptDir, { recursive: true });

  const planned = images.map((image, index) => {
    const base = panelBasename(image, index);
    const pngFile = `${base}.png`;
    const pngPath = path.join(resolved.outDir, pngFile);
    const prompt = buildPanelPngPrompt({ manifest, image, index, total: images.length, opts });
    const promptPath = path.join(promptDir, `${base}-png-prompt.md`);
    fs.writeFileSync(promptPath, `${prompt}\n`);
    return {
      image,
      index,
      base,
      pngFile,
      pngPath,
      prompt,
      promptPath,
    };
  });

  const planPath = path.join(resolved.outDir, 'png-generation-plan.json');
  fs.writeFileSync(
    planPath,
    `${JSON.stringify(
      {
        model: opts.imageModel,
        size: opts.imageSize,
        quality: opts.imageQuality,
        count: planned.length,
        prompts: planned.map((item) => relativeToRoot(item.promptPath)),
      },
      null,
      2,
    )}\n`,
  );

  if (opts.dryRun) {
    console.log(`Wrote ${relativeToRoot(planPath)}`);
    console.log('PNG dry run complete. Re-run without --dry-run to call the OpenAI Image API.');
    return [];
  }

  const apiKey = process.env[opts.openaiApiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing ${opts.openaiApiKeyEnv}; set it before using --png-only or --png-too`);
  }

  const toGenerate = planned.filter((item) => opts.forcePng || !fs.existsSync(item.pngPath));
  const skipped = planned.length - toGenerate.length;
  if (skipped > 0) {
    console.log(`Skipping ${skipped} existing PNG file(s); use --force-png to regenerate.`);
  }

  const generated = await mapLimit(toGenerate, opts.pngConcurrency, async (item) => {
    console.log(`Generating ${relativeToRoot(item.pngPath)} with ${opts.imageModel}...`);
    const result = await callOpenAIImageGeneration(item.prompt, opts, apiKey);
    fs.writeFileSync(item.pngPath, result.buffer);
    return {
      ...item,
      requestId: result.requestId,
      usage: result.usage,
    };
  });

  for (const item of planned) {
    item.image.png_file = item.pngFile;
    item.image.png_embed_src = relativeFromExplainer(resolved.explainerPath, item.pngPath);
    item.image.png_prompt = relativeToRoot(item.promptPath);
    item.image.png_model = opts.imageModel;
    item.image.png_size = opts.imageSize;
    item.image.png_quality = opts.imageQuality;
  }

  manifest.format = manifest.format || 'svg';
  manifest.png_generation = {
    model: opts.imageModel,
    size: opts.imageSize,
    quality: opts.imageQuality,
    output_format: 'png',
    updated_at: new Date().toISOString(),
    generated: generated.length,
    skipped_existing: skipped,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const embedPngPath = writePngEmbedHtml(resolved, manifest);
  const previewPngPath = writePreviewHtml(resolved, {
    embedFile: 'embed-png.html',
    previewFile: 'preview-png.html',
    titleSuffix: 'PNG comic preview',
  });
  console.log(`Wrote ${relativeToRoot(manifestPath)}`);
  console.log(`Wrote ${relativeToRoot(embedPngPath)}`);
  if (previewPngPath) console.log(`Wrote ${relativeToRoot(previewPngPath)}`);

  return generated;
}

function generateChatGPTPromptPack(resolved, opts) {
  const { manifest } = loadManifest(resolved.outDir);
  const images = normalizeManifestImages(manifest);
  const promptDir = path.join(resolved.outDir, 'chatgpt-prompts');
  fs.mkdirSync(promptDir, { recursive: true });

  const prompts = images.map((image, index) => {
    const base = panelBasename(image, index);
    const prompt = buildChatGPTPanelPrompt({ manifest, image, index, total: images.length, opts });
    const promptPath = path.join(promptDir, `${base}-chatgpt-prompt.md`);
    fs.writeFileSync(promptPath, `${prompt}\n`);
    return {
      image,
      index,
      base,
      prompt,
      promptPath,
    };
  });

  const packPath = path.join(resolved.outDir, 'chatgpt-image-prompts.md');
  const pack = buildChatGPTPromptPackMarkdown({ manifest, prompts, opts });
  fs.writeFileSync(packPath, `${pack}\n`);

  const htmlPath = path.join(resolved.outDir, 'chatgpt-image-prompts.html');
  const html = buildChatGPTPromptPackHtml({ manifest, prompts, opts });
  fs.writeFileSync(htmlPath, `${html}\n`);

  const indexPath = path.join(resolved.outDir, 'chatgpt-image-prompts.json');
  fs.writeFileSync(
    indexPath,
    `${JSON.stringify(
      {
        title: manifest.title || resolved.title,
        model_hint: opts.imageModel,
        size_hint: opts.imageSize,
        quality_hint: opts.imageQuality,
        prompt_pack: relativeToRoot(packPath),
        prompt_pack_html: relativeToRoot(htmlPath),
        prompts: prompts.map((item) => ({
          panel: item.index + 1,
          file_hint: `${item.base}.png`,
          prompt_file: relativeToRoot(item.promptPath),
          caption: item.image.caption || null,
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Wrote ${relativeToRoot(packPath)}`);
  console.log(`Wrote ${relativeToRoot(htmlPath)}`);
  console.log(`Wrote ${relativeToRoot(indexPath)}`);
  console.log(`Wrote ${prompts.length} individual ChatGPT prompt file(s) in ${relativeToRoot(promptDir)}`);
  return { packPath, htmlPath, indexPath, prompts };
}

function loadManifest(outDir) {
  const manifestPath = path.join(outDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${relativeToRoot(outDir)}; run Codex generation first`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifest, manifestPath };
}

function normalizeManifestImages(manifest) {
  if (!Array.isArray(manifest.images) || manifest.images.length === 0) {
    throw new Error('manifest.json must contain a non-empty images array');
  }
  return manifest.images;
}

function panelBasename(image, index) {
  const source = image.file || image.embed_src || `panel-${String(index + 1).padStart(2, '0')}.svg`;
  const basename = path.basename(source, path.extname(source));
  return basename || `panel-${String(index + 1).padStart(2, '0')}`;
}

function buildPanelPngPrompt({ manifest, image, index, total, opts }) {
  return `
Create one polished PNG comic panel for the Machine Spirits explainer.

Panel: ${index + 1} of ${total}
Series title: ${manifest.title || 'Machine Spirits paper comic'}
Output: ${opts.imageSize} PNG, opaque paper background, no border outside the image.

Use this in-house visual style:
${MACHINE_SPIRITS_STYLE}

Panel content:
- Paper claim: ${image.paper_claim || image.caption || image.alt || 'Summarize the paper visually.'}
- Caption context: ${image.caption || 'No caption provided.'}
- Visual metaphor: ${image.visual_metaphor || image.alt || 'Editorial scientific comic panel.'}
- Accessibility cue: ${image.alt || 'Machine Spirits comic panel.'}

Composition instructions:
- Make this a final raster illustration, not a screenshot of a web page.
- Use a 16:10 landscape composition with strong silhouette readability.
- Use sparse lettering only: one compact title or label and at most one short speech bubble.
- Preserve the Machine Spirits palette and print-grain feel.
- Avoid long paper quotations, tiny unreadable text, logos, watermarks, stock-photo realism, anime, and 3D rendering.
`.trim();
}

function buildChatGPTPanelPrompt({ manifest, image, index, total, opts }) {
  return `
Please generate a single image for a comic-strip explainer.

Use ${opts.imageModel} image generation if available. Create a landscape PNG-style image at about ${opts.imageSize}, with ${opts.imageQuality} or better rendering quality. Do not write explanatory text before or after the image.

Series: ${manifest.title || 'Machine Spirits paper comic'}
Panel: ${index + 1} of ${total}
Suggested file name after download: ${panelBasename(image, index)}.png

Style direction:
${MACHINE_SPIRITS_STYLE}

Panel content:
- Paper claim: ${image.paper_claim || image.caption || image.alt || 'Summarize the paper visually.'}
- Caption context: ${image.caption || 'No caption provided.'}
- Visual metaphor: ${image.visual_metaphor || image.alt || 'Editorial scientific comic panel.'}
- Accessibility cue: ${image.alt || 'Machine Spirits comic panel.'}

Composition:
- Final raster illustration, not a screenshot of a web page.
- 16:10 landscape composition with strong silhouette readability.
- Warm opaque paper background with subtle grain.
- Sparse lettering only: one compact title or label and at most one speech bubble under 12 words.
- Use the Machine Spirits palette, print-grain texture, small margin labels, crop marks, and restrained brick-red stamps.
- Avoid long paper quotations, tiny unreadable text, logos, watermarks, stock-photo realism, anime, and 3D rendering.
`.trim();
}

function buildChatGPTPromptPackMarkdown({ manifest, prompts, opts }) {
  const intro = `# ChatGPT Image Prompts

Source series: ${manifest.title || 'Machine Spirits paper comic'}
Model hint: ${opts.imageModel}
Size hint: ${opts.imageSize}
Quality hint: ${opts.imageQuality}

Paste one panel prompt at a time into ChatGPT image generation. Save each result using the suggested file name.
`;

  const sections = prompts
    .map(
      (item) => `## Panel ${item.index + 1}: ${item.base}.png

\`\`\`text
${item.prompt}
\`\`\``,
    )
    .join('\n\n');

  return `${intro.trim()}\n\n${sections}`;
}

function buildChatGPTPromptPackHtml({ manifest, prompts, opts }) {
  const cards = prompts
    .map((item) => {
      const promptId = `prompt-${String(item.index + 1).padStart(2, '0')}`;
      return `<article class="prompt-card">
  <header class="prompt-card__header">
    <div>
      <p class="prompt-card__kicker">panel ${item.index + 1}</p>
      <h2>${escapeHtml(item.base)}.png</h2>
    </div>
    <button type="button" data-copy="${promptId}">Copy prompt</button>
  </header>
  <p class="prompt-card__caption">${escapeHtml(item.image.caption || '')}</p>
  <pre id="${promptId}"><code>${escapeHtml(item.prompt)}</code></pre>
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(manifest.title || 'ChatGPT image prompts')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:opsz,wght@8..60,200..900&family=JetBrains+Mono:wght@300..700&display=swap" />
<style>
  :root {
    --paper: #F4EEDD;
    --paper-2: #ECE3CB;
    --paper-3: #F8F2E2;
    --ink: #14100C;
    --ink-2: #2C241B;
    --ink-3: #5C5040;
    --brick: #A53E2E;
    --brick-d: #7C2C1F;
    --moss: #56683A;
    --rule: rgba(28, 22, 16, 0.18);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100vh;
    background: var(--paper);
    color: var(--ink-2);
    font-family: "Source Serif 4", Georgia, serif;
    line-height: 1.55;
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    opacity: 0.14;
    background-image: radial-gradient(rgba(20,16,12,0.55) 0.5px, transparent 0.5px);
    background-size: 3px 3px;
    mix-blend-mode: multiply;
  }
  main {
    width: min(92rem, calc(100vw - 2rem));
    margin: 0 auto;
    padding: clamp(1rem, 4vw, 4rem);
  }
  .hero {
    border-bottom: 1px solid var(--rule);
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
  }
  .kicker, .prompt-card__kicker, .meta {
    color: var(--ink-3);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
  h1, h2 {
    color: var(--ink);
    font-family: "Fraunces", "Source Serif 4", Georgia, serif;
    font-weight: 500;
    letter-spacing: -0.01em;
    line-height: 1.05;
    margin: 0;
  }
  h1 { font-size: clamp(2.4rem, 6vw, 5.4rem); }
  h2 { font-size: clamp(1.25rem, 2vw, 1.9rem); }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.25rem;
    margin-top: 1rem;
  }
  .prompt-list {
    display: grid;
    gap: 1.25rem;
  }
  .prompt-card {
    background: var(--paper-3);
    border: 1px solid var(--rule);
    border-left: 4px solid var(--brick);
    padding: clamp(1rem, 2vw, 1.4rem);
  }
  .prompt-card__header {
    align-items: start;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
  }
  .prompt-card__caption {
    color: var(--ink-3);
    margin: 0.8rem 0 1rem;
    max-width: 60rem;
  }
  button {
    appearance: none;
    background: var(--ink);
    border: 1px solid var(--ink);
    color: var(--paper);
    cursor: pointer;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    padding: 0.55rem 0.75rem;
    text-transform: uppercase;
  }
  button:hover { background: var(--brick-d); border-color: var(--brick-d); }
  pre {
    background: var(--paper-2);
    border: 1px solid var(--rule);
    color: var(--ink);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 0;
    overflow-x: auto;
    padding: 1rem;
    white-space: pre-wrap;
  }
  .copied {
    background: var(--moss);
    border-color: var(--moss);
  }
</style>
</head>
<body>
<main>
  <section class="hero">
    <p class="kicker">ChatGPT image prompt pack</p>
    <h1>${escapeHtml(manifest.title || 'Machine Spirits comic prompts')}</h1>
    <div class="meta">
      <span>${escapeHtml(opts.imageModel)}</span>
      <span>${escapeHtml(opts.imageSize)}</span>
      <span>${escapeHtml(opts.imageQuality)} quality</span>
      <span>${prompts.length} panels</span>
    </div>
  </section>
  <section class="prompt-list">
${cards}
  </section>
</main>
<script>
  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copy);
      const text = target ? target.innerText : '';
      await navigator.clipboard.writeText(text);
      const previous = button.textContent;
      button.textContent = 'Copied';
      button.classList.add('copied');
      setTimeout(() => {
        button.textContent = previous;
        button.classList.remove('copied');
      }, 1200);
    });
  });
</script>
</body>
</html>`;
}

async function callOpenAIImageGeneration(prompt, opts, apiKey) {
  if (typeof fetch !== 'function') {
    throw new Error('This script needs Node.js fetch support; use Node 20+');
  }

  const body = {
    model: opts.imageModel,
    prompt,
    size: opts.imageSize,
    quality: opts.imageQuality,
    output_format: 'png',
    background: 'opaque',
    n: 1,
  };

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: openAIHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const requestId = response.headers.get('x-request-id');
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    // Surface the raw body below.
  }

  if (!response.ok) {
    const message = payload?.error?.message || text || `HTTP ${response.status}`;
    throw new Error(`OpenAI image generation failed${requestId ? ` (${requestId})` : ''}: ${message}`);
  }

  const b64 = payload?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(`OpenAI image response did not include data[0].b64_json${requestId ? ` (${requestId})` : ''}`);
  }

  return {
    buffer: Buffer.from(b64, 'base64'),
    requestId,
    usage: payload.usage || null,
  };
}

function openAIHeaders(apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  const organization = process.env.OPENAI_ORG_ID || process.env.OPENAI_ORGANIZATION;
  const project = process.env.OPENAI_PROJECT_ID || process.env.OPENAI_PROJECT;
  if (organization) headers['OpenAI-Organization'] = organization;
  if (project) headers['OpenAI-Project'] = project;
  return headers;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await fn(items[current], current);
      }
    }),
  );
  return results;
}

function writePngEmbedHtml(resolved, manifest) {
  const embedPath = path.join(resolved.outDir, 'embed.html');
  const embedPngPath = path.join(resolved.outDir, 'embed-png.html');
  let html = fs.existsSync(embedPath) ? fs.readFileSync(embedPath, 'utf8') : '';
  let replacements = 0;

  for (const image of normalizeManifestImages(manifest)) {
    if (!image.png_embed_src) continue;
    const src = image.embed_src || image.file;
    if (!src) continue;
    const nextHtml = html.replaceAll(src, image.png_embed_src);
    if (nextHtml !== html) replacements += 1;
    html = nextHtml;
  }

  if (!html || replacements === 0) {
    html = buildEmbedHtmlFromManifest(manifest, 'png');
  }
  html = html.replace('id="paper-comic-strip-title"', 'id="paper-comic-strip-title-png"');
  html = html.replace('aria-labelledby="paper-comic-strip-title"', 'aria-labelledby="paper-comic-strip-title-png"');
  html = html.replace('comic explainer /', 'png comic explainer /');
  fs.writeFileSync(embedPngPath, `${html.trim()}\n`);
  return embedPngPath;
}

function buildEmbedHtmlFromManifest(manifest, kind) {
  const titleId = kind === 'png' ? 'paper-comic-strip-title-png' : 'paper-comic-strip-title';
  const srcKey = kind === 'png' ? 'png_embed_src' : 'embed_src';
  const figures = normalizeManifestImages(manifest)
    .map((image) => {
      const src = image[srcKey] || image.embed_src || image.file;
      return `  <figure class="paper-comic-panel">
    <img class="paper-comic-panel__img" src="${escapeHtml(src)}" alt="${escapeHtml(image.alt || image.caption || '')}" loading="lazy" decoding="async" />
    <figcaption class="paper-comic-panel__caption">${escapeHtml(image.caption || '')}</figcaption>
  </figure>`;
    })
    .join('\n');

  return `<section class="paper-comic-strip" aria-labelledby="${titleId}">
  <header class="paper-comic-strip__header">
    <p class="paper-comic-strip__kicker">${kind === 'png' ? 'png comic explainer' : 'comic explainer'}</p>
    <h2 class="paper-comic-strip__title" id="${titleId}">${escapeHtml(manifest.title || 'Machine Spirits comic explainer')}</h2>
  </header>
${figures}
</section>`;
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function stripHtml(text) {
  return String(text)
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function runCodex(prompt, opts, resolved) {
  const lastMessagePath = path.join(resolved.outDir, 'codex-last-message.txt');
  const args = ['exec', '-C', ROOT, '-s', 'workspace-write'];
  const addDirs = new Set([resolved.outDir, path.dirname(resolved.pdfPath), path.dirname(resolved.explainerPath)]);
  for (const dir of addDirs) {
    if (!isInsideRoot(dir)) args.push('--add-dir', dir);
  }
  if (opts.fullAuto) args.push('--full-auto');
  if (opts.dangerous) args.push('--dangerously-bypass-approvals-and-sandbox');
  if (opts.model) args.push('-m', opts.model);
  args.push('--output-last-message', lastMessagePath);
  args.push(...opts.codexArgs);
  args.push('-');

  console.log(`Launching ${opts.codexBin} ${args.join(' ')}`);

  await new Promise((resolve, reject) => {
    const child = spawn(opts.codexBin, args, {
      cwd: ROOT,
      stdio: ['pipe', 'inherit', 'inherit'],
      env: {
        ...process.env,
        CODEX_GENERATED_PAPER_COMICS: '1',
      },
    });
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`codex timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') finish(reject, error);
    });
    child.on('error', (error) => {
      finish(reject, error);
    });
    child.on('close', (code) => {
      if (code === 0) {
        finish(resolve);
      } else {
        finish(reject, new Error(`codex exited with code ${code}`));
      }
    });
    child.stdin.end(prompt);
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }
  if (!opts.pdf && !opts.previewOnly && !opts.pngOnly && !opts.chatgptPromptsOnly && !opts.composeHtmlOnly) {
    throw new Error('Missing --pdf <paper.pdf>');
  }

  const htmlTemplatePath = opts.htmlTemplate ? resolveInsideRootOrAbsolute(opts.htmlTemplate) : null;
  const explainerPath = resolveInsideRootOrAbsolute(
    opts.explainerWasSet || !htmlTemplatePath ? opts.explainer : opts.htmlTemplate,
  );
  const outDirBase = resolveInsideRootOrAbsolute(opts.outDir);
  const pdfPath = opts.pdf ? resolveInsideRootOrAbsolute(opts.pdf) : null;
  const outDir = pdfPath && !opts.outDirWasSet ? path.join(outDirBase, slugFromPdf(pdfPath)) : outDirBase;
  const htmlOutputPath = opts.htmlOutput
    ? resolveInsideRootOrAbsolute(opts.htmlOutput)
    : htmlTemplatePath
      ? defaultComposedHtmlPath(htmlTemplatePath, opts.htmlImageSource, opts.htmlPlacement)
      : null;
  const title =
    opts.title ||
    (pdfPath ? `Comic explainer for ${path.basename(pdfPath)}` : `Comic preview for ${path.basename(outDir)}`);

  if (pdfPath && !fs.existsSync(pdfPath)) {
    throw new Error(`PDF not found: ${pdfPath}`);
  }
  if (!fs.existsSync(explainerPath)) {
    throw new Error(`Explainer file not found: ${explainerPath}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const resolved = { pdfPath, explainerPath, outDir, title, htmlTemplatePath, htmlOutputPath };

  if (opts.previewOnly) {
    const previewPath = writePreviewHtml(resolved);
    const previewPngPath = writePreviewHtml(resolved, {
      embedFile: 'embed-png.html',
      previewFile: 'preview-png.html',
      titleSuffix: 'PNG comic preview',
    });
    if (!previewPath) {
      throw new Error(`Cannot create preview: embed.html not found in ${relativeToRoot(outDir)}`);
    }
    console.log(`Wrote ${relativeToRoot(previewPath)}`);
    if (previewPngPath) console.log(`Wrote ${relativeToRoot(previewPngPath)}`);
    return;
  }

  if (opts.pngOnly) {
    const generated = await generatePngAssets(resolved, opts);
    if (generated.length > 0) {
      console.log(`Generated ${generated.length} PNG file(s).`);
    }
    return;
  }

  if (opts.chatgptPromptsOnly) {
    generateChatGPTPromptPack(resolved, opts);
    return;
  }

  if (opts.composeHtmlOnly) {
    composeHtmlFromTemplate(resolved, opts);
    return;
  }

  const extraction = opts.noExtract
    ? { label: 'disabled', text: '', rawChars: 0, errors: ['--no-extract was set'] }
    : await extractPdfText(pdfPath, opts.maxChars);

  const brief = buildBrief(opts, resolved);
  const prompt = buildCodexPrompt(opts, resolved, extraction);
  const briefPath = path.join(outDir, 'generation-brief.md');
  const promptPath = path.join(outDir, 'codex-prompt.md');
  fs.writeFileSync(briefPath, `${brief}\n`);
  fs.writeFileSync(promptPath, `${prompt}\n`);

  console.log(`Wrote ${relativeToRoot(briefPath)}`);
  console.log(`Wrote ${relativeToRoot(promptPath)}`);
  if (extraction.text) {
    console.log(
      `Extracted ${extraction.rawChars.toLocaleString()} chars via ${extraction.label}; prompt includes ${extraction.text.length.toLocaleString()} chars.`,
    );
  } else {
    console.log('No PDF text excerpt included; Codex will inspect the PDF path directly.');
  }

  if (opts.dryRun) {
    console.log('Dry run complete. Re-run without --dry-run to invoke Codex CLI.');
    return;
  }

  await runCodex(prompt, opts, resolved);
  const previewPath = writePreviewHtml(resolved);
  if (previewPath) {
    console.log(`Wrote ${relativeToRoot(previewPath)}`);
  }
  if (opts.pngToo) {
    const generated = await generatePngAssets(resolved, opts);
    if (generated.length > 0) {
      console.log(`Generated ${generated.length} PNG file(s).`);
    }
  }
  if (opts.chatgptPromptsToo) {
    generateChatGPTPromptPack(resolved, opts);
  }
  if (opts.htmlTemplate) {
    composeHtmlFromTemplate(resolved, opts);
  }
  console.log(`Done. Check ${relativeToRoot(outDir)} for generated assets.`);
}

main().catch((error) => {
  console.error(`generate-paper-comics: ${error.message}`);
  process.exit(1);
});
