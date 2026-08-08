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
import { callModelCliText } from '../services/cliProviderBridge.js';
import { buildSetPlan, blindOrder, CONDITIONS, LEARNER_TURNS } from '../services/registerEyeballSet.js';

const DEFAULT_OUT = 'exports/register-eyeball-set';
const PROVIDER = 'codex';
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

/**
 * One call, one draw. Rejects rather than retrying — a retry would be a second
 * draw, and the set's whole claim is that it did not shop for a better one.
 *
 * The call goes through `cliProviderBridge`, which is what every other paid
 * caller in the repo uses: it spawns from an empty temp directory so the writer
 * cannot pick up this repo's ambient agent instructions, parses the event
 * stream rather than scraping the banner out of stdout, and registers the launch
 * with the model-CLI launch manifest. The committed artefacts under
 * `tests/fixtures/register-eyeball-set/` predate this and were drawn through a
 * hand-rolled `codex exec` without that isolation — a rerun is a fresh draw, not
 * a reproduction, so the fixtures stand as the record of what was read.
 */
function callWriter(prompt) {
  return callModelCliText({
    provider: PROVIDER,
    model: MODEL,
    prompt,
    role: 'register-eyeball-set-writer',
    timeoutMs: CALL_TIMEOUT_MS,
  });
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
        cell.reply = (await callWriter(cell.prompt)).trim();
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
