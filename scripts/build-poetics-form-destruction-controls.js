#!/usr/bin/env node
/**
 * Build deterministic shuffled-turn controls for poetics FORM scoring.
 *
 * This is a zero-spend companion to score-poetics-phase2.js. It takes a directory
 * of public transcript .txt files, shuffles the dialogue turn order while keeping
 * stage directions as context, and writes a parallel sample directory plus a
 * manifest. The resulting directory can be scored by the existing poetics scorer.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function usage() {
  return `Usage:
  node scripts/build-poetics-form-destruction-controls.js \\
    --sample-dir DIR --out-dir DIR [--seed 20260615] [--suffix -shuffled] [--force]

Purpose:
  Create turn-order destruction controls for poetics scoring. No model calls.

Notes:
  - STAGE blocks are preserved at the top in original order.
  - All non-stage dialogue blocks are shuffled deterministically.
  - If a shuffle accidentally preserves the original order, it is rotated once.`;
}

function parseArgs(argv) {
  const options = {
    sampleDir: null,
    outDir: null,
    seed: 20260615,
    suffix: '',
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--sample-dir') options.sampleDir = path.resolve(argv[++i]);
    else if (token === '--out-dir') options.outDir = path.resolve(argv[++i]);
    else if (token === '--seed') options.seed = Number.parseInt(argv[++i], 10);
    else if (token === '--suffix') options.suffix = argv[++i] || '';
    else if (token === '--force') options.force = true;
    else if (token === '--dry-run') options.dryRun = true;
    else if (token === '--help' || token === '-h') {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!options.sampleDir) throw new Error('--sample-dir is required');
  if (!options.outDir) throw new Error('--out-dir is required');
  if (path.resolve(options.sampleDir) === path.resolve(options.outDir)) {
    throw new Error('--out-dir must be different from --sample-dir');
  }
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be an integer');
  return options;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseTurnBlocks(raw) {
  const blocks = [];
  let current = null;
  const roleLine = /^([A-Z][A-Z0-9_ -]*|[A-Z]):\s*(.*)$/;

  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(roleLine);
    if (match) {
      if (current) blocks.push(current);
      current = { role: match[1].trim(), lines: [`${match[1].trim()}: ${match[2]}`] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      current = { role: 'UNLABELLED', lines: [line] };
    }
  }
  if (current) blocks.push(current);
  return blocks.filter((block) => block.lines.some((line) => line.trim()));
}

function isStage(block) {
  return block.role === 'STAGE' || block.role === 'S';
}

function shuffleBlocks(blocks, seed) {
  const rng = mulberry32(seed);
  const stage = blocks.filter(isStage);
  const dialogue = blocks.filter((block) => !isStage(block));
  const shuffled = dialogue.map((block, index) => ({ block, index }));

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const unchanged =
    shuffled.length > 1 && shuffled.every((entry, index) => entry.index === index);
  if (unchanged) shuffled.push(shuffled.shift());

  return [...stage, ...shuffled.map((entry) => entry.block)];
}

function renderBlocks(blocks) {
  return `${blocks.map((block) => block.lines.join('\n').trim()).join('\n\n')}\n`;
}

function outputName(filename, suffix) {
  if (!suffix) return filename;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  return `${base}${suffix}${ext || '.txt'}`;
}

function buildControls(options) {
  const entries = fs
    .readdirSync(options.sampleDir)
    .filter((file) => file.endsWith('.txt'))
    .sort();
  if (entries.length === 0) throw new Error(`No .txt samples found in ${options.sampleDir}`);

  if (fs.existsSync(options.outDir) && !options.force && !options.dryRun) {
    const existing = fs.readdirSync(options.outDir);
    if (existing.length > 0) {
      throw new Error(`Output directory is not empty: ${options.outDir} (use --force)`);
    }
  }

  const manifest = {
    schema: 'poetics.form_destruction_controls.v1',
    generatedAt: new Date().toISOString(),
    sampleDir: path.relative(ROOT, options.sampleDir),
    outDir: path.relative(ROOT, options.outDir),
    seed: options.seed,
    suffix: options.suffix,
    policy: 'preserve stage blocks, shuffle dialogue blocks, rotate unchanged shuffles',
    files: [],
  };

  if (!options.dryRun) fs.mkdirSync(options.outDir, { recursive: true });

  for (let index = 0; index < entries.length; index++) {
    const file = entries[index];
    const inputPath = path.join(options.sampleDir, file);
    const raw = fs.readFileSync(inputPath, 'utf8');
    const blocks = parseTurnBlocks(raw);
    const shuffled = shuffleBlocks(blocks, options.seed + index);
    const rendered = renderBlocks(shuffled);
    const outFile = outputName(file, options.suffix);
    const outPath = path.join(options.outDir, outFile);

    const dialogueBefore = blocks.filter((block) => !isStage(block)).map((block) => block.role);
    const dialogueAfter = shuffled.filter((block) => !isStage(block)).map((block) => block.role);
    manifest.files.push({
      source: file,
      output: outFile,
      turnCount: blocks.length,
      stageCount: blocks.filter(isStage).length,
      dialogueCount: dialogueBefore.length,
      sourceSha256: hashText(raw),
      outputSha256: hashText(rendered),
      dialogueRolesBefore: dialogueBefore,
      dialogueRolesAfter: dialogueAfter,
    });

    if (!options.dryRun) fs.writeFileSync(outPath, rendered);
  }

  if (!options.dryRun) {
    fs.writeFileSync(path.join(options.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const manifest = buildControls(options);
    console.log(
      JSON.stringify(
        {
          outDir: manifest.outDir,
          files: manifest.files.length,
          seed: manifest.seed,
          dryRun: options.dryRun,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    process.exit(1);
  }
}

export { buildControls, isStage, parseArgs, parseTurnBlocks, renderBlocks, shuffleBlocks };
