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
 *        [--model claude-code.claude-sonnet-5] [--dry-run] [--from-raw <saved.raw.txt>]
 */

import fs from 'node:fs';
import path from 'node:path';

import { parseModelRef } from './label-learner-state-model.js';

const FIELDS = ['realized', 'move', 'uptake', 'eased'];

/**
 * Pull the answer array out of a reply. A reader may echo the array inside
 * other text first (Opus on step 6 put an escaped copy inside a shell
 * command before the real array), so first-`[` to last-`]` is not enough.
 * Walk the `[` positions from the last one back and take the first slice
 * that parses as an array of objects.
 */
export function extractAnswerArray(text) {
  const raw = String(text || '');
  const end = raw.lastIndexOf(']');
  if (end < 0) return null;
  let start = raw.lastIndexOf('[', end);
  while (start >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(parsed) && parsed.every((r) => r && typeof r === 'object' && !Array.isArray(r))) {
        return parsed;
      }
    } catch {
      /* keep walking back */
    }
    if (start === 0) break; // lastIndexOf('[', -1) would return 0 again
    start = raw.lastIndexOf('[', start - 1);
  }
  return null;
}

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
  const fromRaw = flag('--from-raw', null);
  let text;
  if (fromRaw) {
    // Re-parse a saved reply after a parser fix. No paid call, no resample.
    text = fs.readFileSync(path.resolve(fromRaw), 'utf8');
  } else {
    const { callAIWithCliBridge } = await import('../services/cliProviderBridge.js');
    const modelRef = parseModelRef(model);
    const label = `blind-packet-reader-${path.basename(path.dirname(packetPath))}`;
    const res = await callAIWithCliBridge(modelRef, '', prompt, label, { timeoutMs: 600000 });
    text = typeof res === 'string' ? res : (res?.content ?? res?.text ?? JSON.stringify(res));
  }
  const rows = normaliseSubmission(extractAnswerArray(text), expected);
  const rawPath = out.replace(/\.json$/u, '') + '.raw.txt';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  if (!fromRaw) fs.writeFileSync(rawPath, String(text));
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
