#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');

const DEFAULTS = {
  codexBin: 'codex',
  count: null,
  format: 'png',
  html: 'notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html',
  imageDir: 'notes/poetics/images',
  imagePrefix: 'dramatic-recognition-arc',
  sandbox: 'workspace-write',
  timeoutMs: 20 * 60 * 1000,
  ephemeral: true,
  codexMemories: false,
};

const PREFERRED_PANEL_IDS = [
  'paper',
  'proxy',
  'sidecar',
  'habit-break',
  'ending',
  'oedipus',
  'family',
  'surface',
  'boundary',
];

const STYLE_GUIDE = `
Machine Spirits editorial cartoon style, leaning film noir by default:
- Warm paper ground with visible grain, pushed through a low-key noir palette: cream, charcoal, ink brown, smoke grey, brick red, moss, and ochre.
- High-contrast chiaroscuro lighting, hard shadows, venetian-blind slashes, stage haze, lamplight cones, and noir investigation-board composition.
- Scientific comic rather than glossy sci-fi: hand-inked lines, margin labels, arrows, crop marks, small registers, and evidence tags.
- Tutor and learner can appear as simple silhouettes, masks, or diagrammatic figures, never as copyrighted characters.
- Use sparse lettering only: one compact title and at most two short labels. Avoid long quoted text.
- The image should work as a clear article illustration in an HTML img tag, not as a screenshot, poster, or murky mood piece.
`.trim();

const STOPWORDS = new Set(
  `
  a about above after again against all am an and any are as at be because been before being below
  between both but by can could did do does doing down during each few for from further had has
  have having he her here hers herself him himself his how i if in into is it its itself just
  me more most my myself no nor not of off on once only or other our ours ourselves out over own
  same she should so some such than that the their theirs them themselves then there these they
  this those through to too under until up very was we were what when where which while who whom
  why will with you your yours yourself yourselves
  `.trim().split(/\s+/),
);

function printHelp() {
  console.log(`
Usage:
  node scripts/generate-poetics-arc-images.js [options]

Analyzes the dramatic-recognition arc HTML note, writes cartoon-image prompts,
runs Codex CLI once per prompt to create managed image files, and inserts or
updates managed <img> blocks in the HTML file.

Options:
  --html <path>          Source/target HTML. Default: ${DEFAULTS.html}
  --image-dir <path>     Image output directory. Default: ${DEFAULTS.imageDir}
  --count <number>       Number of image prompts/panels. Default: main numbered section count.
  --format <svg|png>     Image format Codex should create. Default: ${DEFAULTS.format}
  --image-prefix <slug>  Managed image filename prefix. Default: ${DEFAULTS.imagePrefix}
  --prompt-file <path>   Prompt text file. Default: <image-dir>/<html-stem>-image-prompts.txt
  --manifest-file <path> Manifest JSON file. Default: <image-dir>/<html-stem>-images.json
  --codex-bin <path>     Codex executable. Default: ${DEFAULTS.codexBin}
  --model <model>        Pass -m <model> to codex exec.
  --codex-arg <arg>      Extra argument passed to codex exec. Repeatable.
  --sandbox <mode>       Codex exec sandbox. Default: ${DEFAULTS.sandbox}
  --dangerous            Pass --dangerously-bypass-approvals-and-sandbox.
  --persist-codex        Persist Codex exec sessions instead of using --ephemeral.
  --codex-memories       Let Codex exec use the user's configured memories setting.
  --timeout-ms <number>  Timeout per Codex image call. Default: ${DEFAULTS.timeoutMs}
  --dry-run              Analyze and write prompt/manifest only; do not run Codex or edit HTML.
  --skip-codex           Do not run Codex; update HTML against existing managed images.
  --skip-html            Do not edit HTML after image generation.
  --allow-missing        Allow HTML update even if managed image files are missing.
  -h, --help             Show this help.
`);
}

function parseArgs(argv) {
  const opts = {
    ...DEFAULTS,
    allowMissing: false,
    codexArgs: [],
    dangerous: false,
    dryRun: false,
    skipCodex: false,
    skipHtml: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[i];
    };

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--html') {
      opts.html = next();
    } else if (arg === '--image-dir') {
      opts.imageDir = next();
    } else if (arg === '--count') {
      opts.count = parsePositiveInt(next(), 'count');
    } else if (arg === '--format') {
      opts.format = next().toLowerCase();
    } else if (arg === '--image-prefix') {
      opts.imagePrefix = slugify(next()) || DEFAULTS.imagePrefix;
    } else if (arg === '--prompt-file') {
      opts.promptFile = next();
    } else if (arg === '--manifest-file') {
      opts.manifestFile = next();
    } else if (arg === '--codex-bin') {
      opts.codexBin = next();
    } else if (arg === '--model') {
      opts.model = next();
    } else if (arg === '--codex-arg') {
      opts.codexArgs.push(next());
    } else if (arg === '--sandbox') {
      opts.sandbox = next();
    } else if (arg === '--dangerous') {
      opts.dangerous = true;
    } else if (arg === '--persist-codex') {
      opts.ephemeral = false;
    } else if (arg === '--codex-memories') {
      opts.codexMemories = true;
    } else if (arg === '--timeout-ms') {
      opts.timeoutMs = parsePositiveInt(next(), 'timeout-ms');
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--skip-codex') {
      opts.skipCodex = true;
    } else if (arg === '--skip-html') {
      opts.skipHtml = true;
    } else if (arg === '--allow-missing') {
      opts.allowMissing = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!['svg', 'png'].includes(opts.format)) {
    throw new Error(`--format must be svg or png, got: ${opts.format}`);
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

function resolvePath(input) {
  if (path.isAbsolute(input)) return path.normalize(input);
  return path.resolve(ROOT, input);
}

function relativeToRoot(target) {
  const rel = path.relative(ROOT, target);
  return rel && !rel.startsWith('..') ? rel.split(path.sep).join('/') : target;
}

function relativeFromHtml(htmlPath, targetPath) {
  return path.relative(path.dirname(htmlPath), targetPath).split(path.sep).join('/');
}

function readInputs(opts) {
  const htmlPath = resolvePath(opts.html);
  const imageDir = resolvePath(opts.imageDir);
  if (!fs.existsSync(htmlPath)) throw new Error(`HTML file not found: ${htmlPath}`);

  const htmlStem = path.basename(htmlPath, path.extname(htmlPath));
  const promptFile = resolvePath(opts.promptFile || path.join(opts.imageDir, `${htmlStem}-image-prompts.txt`));
  const manifestFile = resolvePath(opts.manifestFile || path.join(opts.imageDir, `${htmlStem}-images.json`));
  const html = fs.readFileSync(htmlPath, 'utf8');

  return { html, htmlPath, imageDir, promptFile, manifestFile };
}

function extractArticleAnalysis(html) {
  const bodyForText = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, ' ');

  const title =
    textFromFirstMatch(html, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i) ||
    textFromFirstMatch(html, /<title\b[^>]*>([\s\S]*?)<\/title>/i) ||
    'Dramatic recognition arc';
  const description = getMetaContent(html, 'description');
  const plainText = normalizeWhitespace(stripHtml(bodyForText));
  const keywords = topKeywords(plainText, 18);
  const sections = extractSections(html);

  return {
    description,
    keywords,
    plainText,
    sections,
    title,
  };
}

function extractSections(html) {
  const sections = [];
  const tagRe = /<section\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const id = getAttr(tag, 'id');
    const className = getAttr(tag, 'class') || '';
    if (!id || !className.split(/\s+/).includes('s')) continue;

    const closeIndex = findMatchingSectionClose(html, match.index);
    if (closeIndex === -1) continue;
    const block = html.slice(match.index, closeIndex + '</section>'.length);
    const content = block
      .replace(/<details\b[^>]*class=["'][^"']*\btx\b[^"']*["'][\s\S]*?<\/details>/gi, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ');
    const heading =
      textFromFirstMatch(content, /<h2\b[^>]*class=["'][^"']*\bs__h\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i) ||
      textFromFirstMatch(content, /<h3\b[^>]*class=["'][^"']*\bs__sub\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i) ||
      textFromFirstMatch(content, /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i) ||
      id.replace(/-/g, ' ');
    const kicker = textFromFirstMatch(content, /<p\b[^>]*class=["'][^"']*\bs__kicker\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const text = normalizeWhitespace(stripHtml(content));
    const sectionNumber = parseSectionNumber(content);
    sections.push({
      block,
      closeIndex,
      heading,
      id,
      index: sections.length,
      kicker,
      openIndex: match.index,
      sentences: importantSentences(text),
      sectionNumber,
      text,
    });
  }
  return sections;
}

function parseSectionNumber(content) {
  const raw = textFromFirstMatch(content, /<h2\b[^>]*class=["'][^"']*\bs__num\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
  const match = raw.match(/^(\d+)([a-z]?)/i);
  if (!match) return null;
  return {
    label: `${match[1]}${match[2] || ''}`,
    number: Number.parseInt(match[1], 10),
    suffix: match[2] || '',
  };
}

function findMatchingSectionClose(html, startIndex) {
  const tokenRe = /<\/?section\b[^>]*>/gi;
  tokenRe.lastIndex = startIndex;
  let depth = 0;
  let match;
  while ((match = tokenRe.exec(html))) {
    if (match[0].startsWith('</')) {
      depth -= 1;
      if (depth === 0) return match.index;
    } else {
      depth += 1;
    }
  }
  return -1;
}

function selectSectionsForPanels(sections, count) {
  const targetCount = count || inferDefaultPanelCount(sections);
  const mainSections = selectMainNumberedSections(sections);
  if (!count && mainSections.length > 0) return mainSections;

  const byId = new Map(sections.map((section) => [section.id, section]));
  const selected = [];
  for (const id of PREFERRED_PANEL_IDS) {
    if (selected.length >= targetCount) break;
    const section = byId.get(id);
    if (section) selected.push(section);
  }
  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((section) => section.id));
    for (const section of sections) {
      if (selected.length >= targetCount) break;
      if (selectedIds.has(section.id)) continue;
      if (section.id === 'glossary') continue;
      selected.push(section);
    }
  }
  return selected.slice(0, targetCount).sort((a, b) => a.openIndex - b.openIndex);
}

function inferDefaultPanelCount(sections) {
  const mainSections = selectMainNumberedSections(sections);
  return mainSections.length || Math.min(PREFERRED_PANEL_IDS.length, sections.length);
}

function selectMainNumberedSections(sections) {
  return sections
    .filter((section) => {
      const number = section.sectionNumber;
      return number && number.number > 0 && number.suffix === '';
    })
    .sort((a, b) => a.openIndex - b.openIndex);
}

function buildPanels({ analysis, htmlPath, imageDir, opts, selectedSections }) {
  const pad = Math.max(2, String(selectedSections.length).length);
  return selectedSections.map((section, index) => {
    const panelNumber = index + 1;
    const number = String(panelNumber).padStart(pad, '0');
    const imageFile = `${opts.imagePrefix}-${number}.${opts.format}`;
    const imagePath = path.join(imageDir, imageFile);
    const src = relativeFromHtml(htmlPath, imagePath);
    const metaphor = inferVisualMetaphor(section);
    const caption = buildCaption(section);
    const alt = buildAlt(section, metaphor);
    const prompt = buildCodexImagePrompt({
      analysis,
      caption,
      imagePath,
      metaphor,
      opts,
      panelNumber,
      section,
      total: selectedSections.length,
    });

    return {
      alt,
      caption,
      codex_prompt: prompt,
      image_file: relativeToRoot(imagePath),
      image_path: imagePath,
      image_src: src,
      panel: panelNumber,
      section_heading: section.heading,
      section_id: section.id,
      section_kicker: section.kicker || null,
      visual_metaphor: metaphor,
    };
  });
}

function inferVisualMetaphor(section) {
  const id = section.id;
  const text = `${section.heading} ${section.text}`.toLowerCase();
  const byId = {
    paper:
      'a research paper unfolding into a theatre stage, with supported calibration lit clearly and adaptive responsiveness marked as a smaller unresolved shadow',
    proxy:
      'a modest slope gauge beside a stage door, showing that a flat average curve is only a coarse proxy for recognition',
    sidecar:
      'a three-lane evidence bench comparing strong, boundary, and risk claims, with the clean-anchor run pinned as a live exhibit',
    'habit-break':
      'a tutor at a forked path changing tools only after the learner shows a concrete stuck point',
    ending:
      'a learner trying the tutor device, then turning back to redraw the original difficulty',
    oedipus:
      'a sealed Oedipus dossier under stage light, with one panel marked guided discovery and another marked fragile replication',
    family:
      'three prompt-family masks on a rehearsal wall, where intersubjective pedagogy glows more strongly than theory vocabulary',
    surface:
      'a question mark and several surface cues acting as weather vanes, useful only when tied to the whole dialogue scene',
    boundary:
      'a narrow doorway labelled dramatic mechanism, opening from a larger null-result wall into a disciplined next experiment',
    'starting-point':
      'a paper mechanism diagram becoming a theatre stage, with one lane labelled calibration and one lane labelled adaptive null',
    arc:
      'a measured slope chart dissolving into a staged learner-tutor encounter under a spotlight',
    evidence:
      'an evidence wall with strong, boundary, and risk cards connected to a small poetics browser terminal',
    adaptation:
      'a tutor at a forked path changing tools only after the learner shows a concrete stuck point',
    'ending-shape':
      'a learner trying the tutor device, then turning back to redraw the original difficulty',
    'landing-update-0528':
      'case files, witnesses, and a critic panel showing a result that will not stabilize',
    conceptual:
      'a ruler for average slopes laid beside a blueprint for dramatic mechanism specification',
    'durable-output':
      'a compact control loop machine: observe, classify, choose, generate, check, update',
    'paper-implication':
      'a null-result seal reframed into a narrower guided-discovery doorway where deep secrets need help',
  };
  if (byId[id]) return byId[id];
  if (text.includes('evidence')) return byId.evidence;
  if (text.includes('ending')) return byId['ending-shape'];
  if (text.includes('adapt')) return byId.adaptation;
  if (text.includes('paper')) return byId['paper-implication'];
  return 'an editorial comic panel translating the section into tutor-learner mechanism diagrams';
}

function buildCaption(section) {
  const headingKey = simplifyForComparison(section.heading);
  const sentence =
    section.sentences.find((candidate) => simplifyForComparison(candidate) !== headingKey) ||
    section.sentences[0] ||
    section.heading;
  const label = trimTrailingSentencePunctuation(section.kicker || section.heading);
  return clampText(`${label}: ${sentence}`, 220);
}

function buildAlt(section, metaphor) {
  return clampText(`Editorial cartoon for ${section.heading}: ${metaphor}.`, 180);
}

function trimTrailingSentencePunctuation(text) {
  return text.replace(/[.!?]+$/g, '');
}

function buildCodexImagePrompt({ analysis, caption, imagePath, metaphor, opts, panelNumber, section, total }) {
  const target = relativeToRoot(imagePath);
  const excerpt = section.sentences.slice(0, 4).join(' ');
  const outputContract =
    opts.format === 'svg'
      ? `Create a valid standalone SVG at ${target}. Use viewBox "0 0 1600 1000", include <title> and <desc>, and do not rely on external assets.`
      : `Create a valid PNG image at ${target}. If you need to draft vector art first, convert it so the final file at that path is a real PNG.`;

  return `
You are Codex running inside the Machine Spirits evaluation repository.
Create one cartoon image file for the dramatic-recognition arc note.

Target file: ${target}
Panel: ${panelNumber} of ${total}
Target article section: #${section.id}
Section heading: ${section.heading}
Article title: ${analysis.title}

${outputContract}
Do not edit the HTML file. Do not create unrelated files. Overwrite the target file if it already exists.

Art direction:
${STYLE_GUIDE}

Textual context to complement:
${excerpt || section.text.slice(0, 700)}

Image concept:
${metaphor}

Caption this image will carry in the page:
${caption}

Composition requirements:
- Landscape editorial cartoon, roughly 16:10.
- Keep labels sparse and legible: no more than three in-image labels, each under six words.
- Show a tutor-learner mechanism, a measurement apparatus, or an evidence/control-loop metaphor.
- Avoid photorealism, corporate-vector stock style, copyrighted characters, screenshots, and dense prose.

Return a short final note listing the created file.
`.trim();
}

function writePromptPack({ analysis, manifestFile, panels, promptFile, opts }) {
  fs.mkdirSync(path.dirname(promptFile), { recursive: true });
  const selected = panels
    .map(
      (panel) =>
        `- ${String(panel.panel).padStart(2, '0')} #${panel.section_id}: ${panel.section_heading} -> ${panel.image_file}`,
    )
    .join('\n');
  const body = `
# Cartoon Image Prompts

Source HTML: ${relativeToRoot(resolvePath(opts.html))}
Generated at: ${new Date().toISOString()}
Panel count: ${panels.length}
Format: ${opts.format}

## Text Analysis

Title: ${analysis.title}
Description: ${analysis.description || 'n/a'}
Top terms: ${analysis.keywords.join(', ')}

Selected sections:
${selected}

## Prompts

${panels
  .map(
    (panel) => `
### Prompt ${String(panel.panel).padStart(2, '0')} - #${panel.section_id}

Target image: ${panel.image_file}
HTML src: ${panel.image_src}
Caption: ${panel.caption}
Alt: ${panel.alt}
Visual metaphor: ${panel.visual_metaphor}

\`\`\`
${panel.codex_prompt}
\`\`\`
`.trim(),
  )
  .join('\n\n')}
`.trim();
  fs.writeFileSync(promptFile, `${body}\n`);

  const manifest = {
    generated_at: new Date().toISOString(),
    html: relativeToRoot(resolvePath(opts.html)),
    image_format: opts.format,
    image_prefix: opts.imagePrefix,
    prompt_file: relativeToRoot(promptFile),
    style: 'machinespirits-poetics-editorial-cartoon-v1',
    title: analysis.title,
    images: panels.map((panel) => ({
      alt: panel.alt,
      caption: panel.caption,
      image_file: panel.image_file,
      image_src: panel.image_src,
      panel: panel.panel,
      section_heading: panel.section_heading,
      section_id: panel.section_id,
      section_kicker: panel.section_kicker,
      visual_metaphor: panel.visual_metaphor,
    })),
  };
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function runCodexForPanels(panels, opts) {
  ensureCodexSkillSupportDirs();
  for (const panel of panels) {
    console.log(
      `Generating ${panel.image_file} with ${opts.codexBin} (${panel.panel}/${panels.length})...`,
    );
    await runCodex(panel.codex_prompt, panel, opts);
  }
}

function ensureCodexSkillSupportDirs() {
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const imagegenDir = path.join(codexHome, 'skills', '.system', 'imagegen');
  if (!fs.existsSync(path.join(imagegenDir, 'SKILL.md'))) return;
  for (const dirName of ['references']) {
    fs.mkdirSync(path.join(imagegenDir, dirName), { recursive: true });
  }
}

async function runCodex(prompt, panel, opts) {
  const lastMessagePath = path.join(path.dirname(panel.image_path), `${path.basename(panel.image_path)}.codex.txt`);
  const args = ['exec', '-C', ROOT];
  if (opts.ephemeral) args.push('--ephemeral');
  if (!opts.codexMemories) args.push('-c', 'memories=false');
  if (opts.dangerous) {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  } else {
    args.push('-s', opts.sandbox);
  }
  if (opts.model) args.push('-m', opts.model);
  args.push('--output-last-message', lastMessagePath);
  args.push(...opts.codexArgs);
  args.push('-');

  await new Promise((resolve, reject) => {
    const child = spawn(opts.codexBin, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        CODEX_GENERATED_POETICS_ARC_IMAGE: '1',
      },
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error(`codex timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    function finish(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    }

    child.stdin.on('error', (error) => {
      if (error.code !== 'EPIPE') finish(reject, error);
    });
    child.on('error', (error) => finish(reject, error));
    child.on('close', (code) => {
      if (code === 0) finish(resolve);
      else finish(reject, new Error(`codex exited with code ${code}`));
    });
    child.stdin.end(prompt);
  });
}

function validateImages(panels, allowMissing) {
  const missing = panels.filter((panel) => !fs.existsSync(panel.image_path));
  if (missing.length && !allowMissing) {
    throw new Error(
      `Managed image files were not created:\n${missing.map((panel) => `- ${panel.image_file}`).join('\n')}`,
    );
  }
  return missing;
}

function updateHtmlWithImages(html, panels) {
  let next = stripManagedImageBlocks(html);
  next = upsertManagedStyle(next);

  const sections = extractSections(next);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const insertions = panels
    .map((panel) => {
      const section = byId.get(panel.section_id);
      return {
        block: buildFigureBlock(panel),
        index: section ? section.closeIndex : fallbackInsertionIndex(next),
      };
    })
    .sort((a, b) => b.index - a.index);

  for (const insertion of insertions) {
    next = `${next.slice(0, insertion.index)}\n${insertion.block}\n${next.slice(insertion.index)}`;
  }
  return next;
}

function stripManagedImageBlocks(html) {
  return html.replace(
    /\n?\s*<!-- poetics-arc-images:begin\b[\s\S]*?<!-- poetics-arc-images:end\b[^>]*-->\n?/g,
    '\n',
  );
}

function upsertManagedStyle(html) {
  const styleBlock = buildManagedStyleBlock();
  const styleRe = /\/\* poetics-arc-images:style:begin \*\/[\s\S]*?\/\* poetics-arc-images:style:end \*\//;
  if (styleRe.test(html)) return html.replace(styleRe, styleBlock);
  const closeStyle = html.indexOf('</style>');
  if (closeStyle === -1) {
    throw new Error('Cannot find </style> in target HTML for managed image styles');
  }
  return `${html.slice(0, closeStyle)}\n\n${styleBlock}\n${html.slice(closeStyle)}`;
}

function buildManagedStyleBlock() {
  return `
  /* poetics-arc-images:style:begin */
  .arc-cartoon {
    margin: clamp(1.1rem, 2vw, 1.8rem) 0 clamp(1.4rem, 2.4vw, 2.2rem);
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
    padding: clamp(0.8rem, 1.7vw, 1.1rem) 0;
  }
  .arc-cartoon__img {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid var(--rule);
    background: var(--paper-3);
  }
  .arc-cartoon figcaption {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.7em;
    margin-top: 0.7em;
    color: var(--ink-3);
    font-family: "JetBrains Mono", monospace;
    font-size: var(--s-mini);
    letter-spacing: 0.03em;
    line-height: 1.55;
  }
  .arc-cartoon figcaption span {
    color: var(--brick-d);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  @media (max-width: 44rem) {
    .arc-cartoon figcaption {
      grid-template-columns: 1fr;
      gap: 0.3em;
    }
  }
  /* poetics-arc-images:style:end */`.trimEnd();
}

function buildFigureBlock(panel) {
  const number = String(panel.panel).padStart(2, '0');
  return `          <!-- poetics-arc-images:begin panel="${number}" section="${escapeHtml(panel.section_id)}" -->
          <figure class="arc-cartoon" data-arc-image-panel="${number}" data-arc-image-section="${escapeHtml(panel.section_id)}">
            <img class="arc-cartoon__img" src="${escapeHtml(panel.image_src)}" alt="${escapeHtml(panel.alt)}" loading="lazy" decoding="async" />
            <figcaption><span>Panel ${number}</span>${escapeHtml(panel.caption)}</figcaption>
          </figure>
          <!-- poetics-arc-images:end panel="${number}" -->`;
}

function fallbackInsertionIndex(html) {
  const shellEnd = html.indexOf('\n  </div><!-- /shell -->');
  if (shellEnd !== -1) return shellEnd;
  const mainEnd = html.indexOf('</main>');
  if (mainEnd !== -1) return mainEnd;
  return html.length;
}

function importantSentences(text) {
  const keywords = /(adapt|recogn|evidence|null|boundary|mechanism|tutor|learner|score|critic|control|secret|discovery|paper|result|claim|reframe|ending|pressure)/i;
  const sentences = splitSentences(text);
  const cleaned = sentences
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 40 && sentence.length < 360);
  const important = cleaned.filter((sentence) => keywords.test(sentence));
  return uniqueStrings([...important, ...cleaned]).slice(0, 6);
}

function splitSentences(text) {
  const decimalMarker = '__DECIMAL_POINT__';
  const protectedText = normalizeWhitespace(text).replace(/(\d)\.(\d)/g, `$1${decimalMarker}$2`);
  return (protectedText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) =>
    sentence.replace(new RegExp(decimalMarker, 'g'), '.'),
  );
}

function topKeywords(text, limit) {
  const counts = new Map();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));
  for (const word of words) {
    const normalized = word.replace(/^-+|-+$/g, '');
    if (!normalized || STOPWORDS.has(normalized)) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'));
  return match ? match[2] : null;
}

function getMetaContent(html, name) {
  const re = new RegExp(`<meta\\b(?=[^>]*\\bname=["']${escapeRegExp(name)}["'])(?=[^>]*\\bcontent=(["'])(.*?)\\1)[^>]*>`, 'i');
  const match = html.match(re);
  return match ? decodeHtml(match[2]) : '';
}

function textFromFirstMatch(html, re) {
  const match = html.match(re);
  return match ? normalizeWhitespace(stripHtml(match[1])) : '';
}

function stripHtml(text) {
  return decodeHtml(
    String(text || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, '. ')
      .replace(/<[^>]*>/g, ' '),
  );
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number.parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([.!?])\s*\./g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function clampText(text, max) {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}...`;
}

function simplifyForComparison(text) {
  return normalizeWhitespace(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printHelp();
    return;
  }

  const inputs = readInputs(opts);
  const analysis = extractArticleAnalysis(inputs.html);
  if (!analysis.sections.length) {
    throw new Error(`No article sections found in ${inputs.htmlPath}`);
  }

  fs.mkdirSync(inputs.imageDir, { recursive: true });
  const selectedSections = selectSectionsForPanels(analysis.sections, opts.count);
  const panels = buildPanels({
    analysis,
    htmlPath: inputs.htmlPath,
    imageDir: inputs.imageDir,
    opts,
    selectedSections,
  });

  writePromptPack({
    analysis,
    manifestFile: inputs.manifestFile,
    panels,
    promptFile: inputs.promptFile,
    opts,
  });
  console.log(`Wrote ${relativeToRoot(inputs.promptFile)}`);
  console.log(`Wrote ${relativeToRoot(inputs.manifestFile)}`);

  if (opts.dryRun) {
    console.log('Dry run: skipped Codex image generation and HTML update.');
    return;
  }

  if (!opts.skipCodex) {
    await runCodexForPanels(panels, opts);
  } else {
    console.log('Skipped Codex image generation.');
  }

  const missing = validateImages(panels, opts.allowMissing);
  if (missing.length) {
    console.warn(`Continuing with ${missing.length} missing managed image file(s).`);
  }

  if (!opts.skipHtml) {
    const updated = updateHtmlWithImages(inputs.html, panels);
    fs.writeFileSync(inputs.htmlPath, updated);
    console.log(`Updated ${relativeToRoot(inputs.htmlPath)}`);
  } else {
    console.log('Skipped HTML update.');
  }
}

main().catch((error) => {
  console.error(`generate-poetics-arc-images: ${error.message}`);
  process.exitCode = 1;
});
