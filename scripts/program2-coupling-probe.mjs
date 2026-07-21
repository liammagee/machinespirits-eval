#!/usr/bin/env node
// Program-2 offline protected-span coupling probe
// (PROGRAM-2-PHASE2-PREREGISTRATION.md §10 Amendment 1; plan §8 coupling
// mode 3 / HANDOFF H4).
//
// For each held-out warrant_skip moment: take the tuned instruct arm's
// already-generated greedy reply, extract its question sentence(s) as the
// protected span, ask a sonnet-class frontier model (isolated CLI bridge)
// to compose the tutor turn around the span VERBATIM, enforce span
// containment fail-closed (any loss → deliver the mini's own reply), and
// write the delivered texts for grading by the frozen grader's
// --grade-file mode. Exploratory tier; no H-W claim; ≤65 frontier calls.
//
// Usage:
//   node scripts/program2-coupling-probe.mjs \
//     [--tuned <json>] [--out <jsonl>] [--limit N] \
//     [--composer <provider.model>]   (default claude-code.claude-sonnet-5,
//                                      the Phase 4 pin; split on FIRST dot)
//
// 2026-07-21 additions (behavior-preserving under defaults): --composer
// parameterizes the frontier family (terra cross-family probe); rows now
// also record the extracted span and the raw composed text even when the
// battery falls back (additive fields — grade-file mode reads only
// turnId/text/source); the out file is appended incrementally and already-
// present turnIds are skipped on re-run (checkpoint/resume).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const { values: args } = parseArgs({
  options: {
    tuned: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/program-2/floor/tuned-sft-instruct-v2-q8-ollama.json'),
    },
    dataset: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/program-2/datasets/v1'),
    },
    out: {
      type: 'string',
      default: path.join(os.homedir(), '.machinespirits-data/program-2/floor/coupling-probe-delivered.jsonl'),
    },
    limit: { type: 'string' },
    composer: { type: 'string', default: 'claude-code.claude-sonnet-5' },
  },
});

const composerDot = args.composer.indexOf('.');
if (composerDot <= 0 || composerDot === args.composer.length - 1) {
  console.error(`--composer must be <provider>.<model> (got "${args.composer}")`);
  process.exit(1);
}
const COMPOSER = {
  provider: args.composer.slice(0, composerDot),
  model: args.composer.slice(composerDot + 1),
};

const tuned = JSON.parse(fs.readFileSync(args.tuned, 'utf8'));
const miniReplies = new Map(
  tuned.rows
    .filter((r) => r.decoding === 'greedy' && r.split === 'heldout' && !r.error && r.text)
    .map((r) => [r.turnId, r.text]),
);
const moments = fs
  .readFileSync(path.join(args.dataset, 'eval-moments.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((m) => m.split === 'heldout' && m.trigger === 'warrant_skip' && miniReplies.has(m.turnId));

// Protected span: the mini reply's question sentence(s), extracted
// deterministically — maximal '?'-terminated substrings, trimmed.
function questionSentences(text) {
  return (String(text).match(/[^.!?\n]+\?/gu) || []).map((s) => s.trim()).filter((s) => s.length > 8);
}
function normalize(text) {
  return String(text).replace(/\s+/gu, ' ').trim();
}

let targets = moments;
if (args.limit) targets = targets.slice(0, Number(args.limit));

// Checkpoint/resume: skip turnIds already present in the out file.
const alreadyDone = new Set();
if (fs.existsSync(args.out)) {
  for (const line of fs.readFileSync(args.out, 'utf8').split('\n').filter(Boolean)) {
    alreadyDone.add(JSON.parse(line).turnId);
  }
}
if (alreadyDone.size) console.error(`[probe] resuming: ${alreadyDone.size} rows already in ${args.out}`);
targets = targets.filter((m) => !alreadyDone.has(m.turnId));

const delivered = [];
let done = 0;
for (const moment of targets) {
  const miniText = miniReplies.get(moment.turnId);
  const spans = questionSentences(miniText);
  let row;
  if (!spans.length) {
    row = { turnId: moment.turnId, text: miniText, source: 'fallback_no_span' };
  } else {
    const span = spans.join(' ');
    const userPrompt = [
      moment.request.messages.at(-1)?.content || '',
      '',
      '--- Composition task (harness instruction) ---',
      'Compose your tutor turn for this moment. Requirements:',
      `1. Include this question VERBATIM, word for word, as the turn's only question: "${span}"`,
      '2. Ask no other question anywhere in the turn.',
      '3. Introduce no new case facts, clues, or evidence the dialogue has not already made public.',
      '4. Keep the scene voice and address the learner directly.',
      'Write only the tutor turn.',
    ].join('\n');
    try {
      const result = await callAIWithCliBridge(
        COMPOSER,
        moment.request.systemPrompt,
        userPrompt,
        'program2_coupling_composer',
        {
          messageHistory: moment.request.messages.slice(0, -1),
          effort: 'low',
        },
      );
      const composed = (result.text || '').trim();
      if (composed && normalize(composed).includes(normalize(span))) {
        row = { turnId: moment.turnId, text: composed, source: 'composed', span, rawComposed: composed };
      } else {
        row = {
          turnId: moment.turnId,
          text: miniText,
          source: composed ? 'fallback_span_lost' : 'fallback_empty',
          span,
          rawComposed: composed || null,
        };
      }
    } catch (err) {
      row = {
        turnId: moment.turnId,
        text: miniText,
        source: 'fallback_error',
        span,
        error: String(err.message || err).slice(0, 200),
      };
    }
  }
  delivered.push(row);
  fs.appendFileSync(args.out, JSON.stringify(row) + '\n');
  done += 1;
  if (done % 5 === 0) console.error(`[probe] ${done}/${targets.length}`);
}

const bySource = {};
for (const r of delivered) bySource[r.source] = (bySource[r.source] || 0) + 1;
console.log(
  JSON.stringify(
    { composer: args.composer, newRows: delivered.length, skippedExisting: alreadyDone.size, bySource, out: args.out },
    null,
    2,
  ),
);
