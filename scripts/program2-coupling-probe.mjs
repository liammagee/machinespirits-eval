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
//
// --span-mode v2 (2026-07-21, terra-probe follow-up; default v1 is the
// probe-identical rule, byte-preserved): cue-preserving extraction, the
// span-side analogue of the Phase 5b fallback trim. v2 selects ONE
// question sentence (preferring one that carries a frozen cue word, else
// the first), and when no question sentence carries a cue but a statement
// sentence does, carries that statement into the protected span ahead of
// the question. Motivated by the terra-probe decomposition: all v1
// one-question failures were span-borne (multi-question spans) and 20/25
// cue-free spans had the cue in a dropped statement sentence
// (notes/program-2/2026-07-21-terra-composer-probe.md).
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
    'span-mode': { type: 'string', default: 'v1' },
  },
});

const SPAN_MODE = args['span-mode'];
if (!['v1', 'v2'].includes(SPAN_MODE)) {
  console.error(`--span-mode must be v1 or v2 (got "${SPAN_MODE}")`);
  process.exit(1);
}
// Frozen six-word warrant cue (probe-local copy of WARRANT_CUE_RE in
// services/tutorStubPointOfActionCoaching.js:24 — keep in sync).
const CUE_RE = /\b(?:evidence|item|test|record|fact|rule)\b/iu;

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
function statementSentences(text) {
  return (String(text).match(/[^.!?\n]+[.!]/gu) || []).map((s) => s.trim()).filter((s) => s.length > 8);
}
// v2 span: one question sentence (cue-preferring), with the mini's
// cue-bearing statement carried ahead of it when no question has a cue.
// Returns { span, carriedStatement } or null when no question exists.
function extractSpanV2(text) {
  const questions = questionSentences(text);
  if (!questions.length) return null;
  const cueQuestion = questions.find((q) => CUE_RE.test(q));
  const chosen = cueQuestion || questions[0];
  if (cueQuestion) return { span: chosen, carriedStatement: false };
  const cueStatement = statementSentences(text).find((s) => CUE_RE.test(s));
  if (cueStatement) return { span: `${cueStatement} ${chosen}`, carriedStatement: true };
  return { span: chosen, carriedStatement: false };
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
  let span = null;
  let carriedStatement = false;
  if (SPAN_MODE === 'v1') {
    const spans = questionSentences(miniText);
    if (spans.length) span = spans.join(' ');
  } else {
    const v2 = extractSpanV2(miniText);
    if (v2) ({ span, carriedStatement } = v2);
  }
  let row;
  if (!span) {
    row = { turnId: moment.turnId, text: miniText, source: 'fallback_no_span' };
  } else {
    const spanRequirements =
      SPAN_MODE === 'v1'
        ? [
            `1. Include this question VERBATIM, word for word, as the turn's only question: "${span}"`,
            '2. Ask no other question anywhere in the turn.',
          ]
        : [
            `1. Include this passage VERBATIM, word for word, in your turn: "${span}"`,
            "2. Its question must be the turn's ONLY question — ask no other question anywhere in the turn.",
          ];
    const userPrompt = [
      moment.request.messages.at(-1)?.content || '',
      '',
      '--- Composition task (harness instruction) ---',
      'Compose your tutor turn for this moment. Requirements:',
      ...spanRequirements,
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
        row = {
          turnId: moment.turnId,
          text: composed,
          source: 'composed',
          span,
          carriedStatement,
          rawComposed: composed,
        };
      } else {
        row = {
          turnId: moment.turnId,
          text: miniText,
          source: composed ? 'fallback_span_lost' : 'fallback_empty',
          span,
          carriedStatement,
          rawComposed: composed || null,
        };
      }
    } catch (err) {
      row = {
        turnId: moment.turnId,
        text: miniText,
        source: 'fallback_error',
        span,
        carriedStatement,
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
    {
      composer: args.composer,
      spanMode: SPAN_MODE,
      newRows: delivered.length,
      skippedExisting: alreadyDone.size,
      bySource,
      out: args.out,
    },
    null,
    2,
  ),
);
