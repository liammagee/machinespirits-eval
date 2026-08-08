#!/usr/bin/env node
/**
 * Generate the hand-marked register set: 5 real learner turns x 4 conditions,
 * one draw each, no retries and no cherry-picking.
 *
 * Writes three files to the output directory:
 *   - set.json          everything, including which condition wrote which turn
 *   - blind.md          the 20 turns in fixed shuffled order, conditions hidden
 *   - key.md            id -> condition, to be read only after marking
 *
 * Usage:
 *   node scripts/generate-register-eyeball-set.js --out exports/register-eyeball-set
 *   node scripts/generate-register-eyeball-set.js --dry-run     # print prompts only
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildSetPlan, blindOrder, CONDITIONS, LEARNER_TURNS } from '../services/registerEyeballSet.js';

const DEFAULT_OUT = 'exports/register-eyeball-set';
const MODEL = 'gpt-5.5';
const CONCURRENCY = 4;
const CALL_TIMEOUT_MS = 5 * 60 * 1000;

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--out') args.out = argv[++i];
    else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/** One codex call, one draw. Rejects rather than retrying — a retry would be a second draw. */
function callCodex(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', ['exec', '--skip-git-repo-check', '-c', `model=${MODEL}`, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`codex call timed out after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);
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
      if (code !== 0) {
        reject(new Error(`codex exited ${code}: ${stderr.trim().slice(0, 500)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * `codex exec` prints a session banner and a "codex" marker before the reply.
 * Everything after the last marker line is the model's own text.
 */
function extractReply(raw) {
  const lines = raw.split('\n');
  let start = 0;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (/^\[[\d-]{10}T[\d:]{8}\]\s+codex\s*$/.test(lines[i].trim()) || lines[i].trim() === 'codex') {
      start = i + 1;
      break;
    }
  }
  return lines
    .slice(start)
    .join('\n')
    .replace(/^\[[\d-]{10}T[\d:]{8}\][^\n]*$/gm, '')
    .replace(/^\s*tokens used:.*$/gim, '')
    .trim();
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function pump() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump));
  return results;
}

function renderBlind(cells) {
  const ordered = blindOrder(cells);
  const parts = [
    '# Register eyeball set — blind',
    '',
    'Twenty tutor turns. Five real learner turns, four writing conditions each,',
    'one draw per cell, no retries. The condition that produced each turn is not',
    'shown here — read `key.md` only after marking.',
    '',
    'For each turn, mark: is it ironic? is it sarcastic? does it threaten face?',
    'Quote the words that decide it.',
    '',
    '---',
    '',
  ];
  for (const cell of ordered) {
    parts.push(`## ${cell.id}`);
    parts.push('');
    parts.push(`**Learner (${cell.learnerKind}):** ${cell.learnerText}`);
    parts.push('');
    parts.push('**Tutor:**');
    parts.push('');
    parts.push(cell.reply ?? '_(generation failed)_');
    parts.push('');
    parts.push('---');
    parts.push('');
  }
  return parts.join('\n');
}

function renderKey(cells) {
  const ordered = blindOrder(cells);
  const parts = [
    '# Register eyeball set — key',
    '',
    'Read only after marking `blind.md`.',
    '',
    '| id | condition | learner turn | chars |',
    '| --- | --- | --- | --- |',
  ];
  for (const cell of ordered) {
    parts.push(`| ${cell.id} | ${cell.condition} | ${cell.learnerKind} | ${cell.reply?.length ?? 0} |`);
  }
  parts.push('');
  parts.push('## Manner instructions used');
  parts.push('');
  for (const [name, condition] of Object.entries(CONDITIONS)) {
    parts.push(`**${name}** — ${condition.manner ?? '_(no manner named; control)_'}`);
    parts.push('');
  }
  return parts.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const cells = buildSetPlan();

  if (args.dryRun) {
    for (const cell of cells) {
      console.log(`\n===== ${cell.id}  ${cell.condition} / ${cell.learnerKind} =====`);
      console.log(cell.prompt);
    }
    console.log(
      `\n${cells.length} cells: ${LEARNER_TURNS.length} learner turns x ${Object.keys(CONDITIONS).length} conditions`,
    );
    return;
  }

  const outDir = path.resolve(process.cwd(), args.out);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`Generating ${cells.length} turns on ${MODEL}, ${CONCURRENCY} at a time...`);
  const failures = [];
  await runPool(
    cells,
    async (cell) => {
      try {
        const raw = await callCodex(cell.prompt);
        cell.reply = extractReply(raw);
        console.log(`  ${cell.id} ${cell.condition}/${cell.learnerKind} — ${cell.reply.length} chars`);
      } catch (error) {
        cell.reply = null;
        cell.error = error.message;
        failures.push(cell.id);
        console.error(`  ${cell.id} FAILED — ${error.message}`);
      }
    },
    CONCURRENCY,
  );

  fs.writeFileSync(
    path.join(outDir, 'set.json'),
    `${JSON.stringify({ model: MODEL, conditions: CONDITIONS, cells }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(outDir, 'blind.md'), renderBlind(cells));
  fs.writeFileSync(path.join(outDir, 'key.md'), renderKey(cells));

  console.log(`\nWrote ${outDir}/{set.json,blind.md,key.md}`);
  if (failures.length) {
    console.error(`${failures.length} generation(s) failed: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
