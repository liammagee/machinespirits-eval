#!/usr/bin/env node
/**
 * Model second reader for a stress-bench blind packet.
 *
 * Reads ONLY the packet markdown (never the key or the judge file), sends it
 * to one model through the CLI bridge, and writes the model's answers as the
 * submission JSON that `stress-blind-packet.js compare` takes. One call per
 * packet, one attempt, no resampling after a failure.
 *
 * The reader must not be the judge's model family. The stress judge ran on
 * codex; the default reader here is Sonnet through the claude-code bridge.
 * A model reader stands in for a human second reader and does not replace
 * one: the note that cites its numbers must say so.
 *
 * Usage:
 *   node scripts/score-blind-packet-model.js <packet.md> --out <submission.json>
 *        [--model claude-code.claude-sonnet-5] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseJudgeJson } from './judge-stress-repair.js';
import { parseModelRef } from './label-learner-state-model.js';

const FIELDS = ['realized', 'move', 'uptake', 'eased'];

export function buildReaderPrompt(packetText) {
  return [
    'You are the second reader for the packet below. Follow its instructions exactly.',
    'Rule what you see in the three lines of each item. Do not guess which repair was wanted.',
    'Return ONLY the JSON array from the "Your answers" section, filled in, one object per item,',
    'with the fields n, realized, move, secondary, uptake, eased. Use only the tags and values the packet lists.',
    'No prose before or after the array.',
    '',
    '----- PACKET -----',
    packetText,
  ].join('\n');
}

export function normaliseSubmission(parsed, expectedCount) {
  if (!Array.isArray(parsed)) return null;
  const rows = parsed
    .filter((r) => r && typeof r === 'object' && Number.isInteger(Number(r.n)))
    .map((r) => ({
      n: Number(r.n),
      realized: r.realized ?? '',
      move: r.move ?? '',
      secondary: r.secondary ?? null,
      uptake: r.uptake ?? '',
      eased: r.eased ?? '',
    }))
    .sort((a, b) => a.n - b.n);
  if (expectedCount && rows.length !== expectedCount) return null;
  for (const row of rows) {
    for (const f of FIELDS) if (!row[f]) return null;
  }
  return rows;
}

function countItems(packetText) {
  return (packetText.match(/^### Item \d+/gmu) || []).length;
}

async function main() {
  const args = process.argv.slice(2);
  const packetPath = args.find((a) => !a.startsWith('--'));
  const flag = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const model = flag('--model', 'claude-code.claude-sonnet-5');
  const out = flag('--out', null);
  const dryRun = args.includes('--dry-run');
  if (!packetPath || !out) {
    console.error(
      'usage: node scripts/score-blind-packet-model.js <packet.md> --out <submission.json> [--model <ref>] [--dry-run]',
    );
    process.exit(2);
  }
  const packetText = fs.readFileSync(path.resolve(packetPath), 'utf8');
  const expected = countItems(packetText);
  const prompt = buildReaderPrompt(packetText);
  if (dryRun) {
    console.log(
      `${path.basename(path.dirname(packetPath))}: ${expected} items, prompt ${prompt.length} chars, model ${model}, 1 call`,
    );
    return;
  }
  const { callAIWithCliBridge } = await import('../services/cliProviderBridge.js');
  const modelRef = parseModelRef(model);
  const label = `blind-packet-reader-${path.basename(path.dirname(packetPath))}`;
  const res = await callAIWithCliBridge(modelRef, '', prompt, label, { timeoutMs: 600000 });
  const text = typeof res === 'string' ? res : (res?.content ?? res?.text ?? JSON.stringify(res));
  const rows = normaliseSubmission(parseJudgeJson(text), expected);
  const rawPath = out.replace(/\.json$/u, '') + '.raw.txt';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(rawPath, String(text));
  if (!rows) {
    console.error(`unparsed or incomplete reply (expected ${expected} items); raw saved to ${rawPath}; not retrying`);
    process.exit(1);
  }
  // `compare` takes a bare array; provenance goes in a sidecar.
  fs.writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
  fs.writeFileSync(
    out.replace(/\.json$/u, '') + '.meta.json',
    `${JSON.stringify({ reader: model, packet: path.resolve(packetPath), items: rows.length, readAt: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log(`${rows.length} items from ${model} -> ${out}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  main().catch((err) => {
    console.error(err?.stack || err);
    process.exit(1);
  });
}
