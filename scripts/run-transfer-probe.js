/**
 * Transfer probe runner — crossed-effects experiment
 * (card: adaptive-causality-crossed-effects).
 *
 * Poses the per-world near-twin incident (config/crossed-effects/
 * transfer-probes.yaml) to the SAME simulated learner that lived the
 * dialogue, with the dialogue's public transcript as context, then scores
 * the answer against the deterministic key. No judge model. One call per
 * probe; the answer, per-lesson verdicts, and matched/violated tokens are
 * written beside the trace.
 *
 * Usage:
 *   node scripts/run-transfer-probe.js --trace-dir <dir> [--brief <file>]
 *     [--learner-model codex.gpt-5.6-terra] [--out <file>] [--dry-run]
 *
 * --dry-run renders the probe prompt and scores a canned answer of "" so
 * the key plumbing can be tested without a paid call.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBES = parseYaml(fs.readFileSync(path.join(ROOT, 'config', 'crossed-effects', 'transfer-probes.yaml'), 'utf8'));

function parseArgs(argv) {
  const opts = { traceDir: null, brief: null, model: 'codex.gpt-5.6-terra', out: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--trace-dir') opts.traceDir = argv[++i];
    else if (a === '--brief') opts.brief = argv[++i];
    else if (a === '--learner-model') opts.model = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else throw new Error(`unknown flag ${a}`);
  }
  if (!opts.traceDir) throw new Error('need --trace-dir');
  return opts;
}

function loadDialogue(traceDir) {
  const fl = fs.readdirSync(traceDir).find((x) => x.endsWith('.jsonl'));
  if (!fl) throw new Error(`no trace in ${traceDir}`);
  const events = fs
    .readFileSync(path.join(traceDir, fl), 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
  const worldId =
    events.find((e) => e.worldId)?.worldId ||
    (traceDir.includes('world_033') ? 'world_033_alder_row_redoubt' : 'world_030_rowan_flat');
  const turns = events
    .filter((e) => e.type === 'turn_complete')
    .map((e) => ({
      turn: e.turn,
      learner: String(e.turnRecord.learner || ''),
      tutor: String(e.turnRecord.tutor || ''),
    }));
  return { worldId, turns };
}

const clean = (s) =>
  String(s || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// A key group passes when: every all_of row has at least one token present,
// and no none_of pattern appears. Case-insensitive substring matching, the
// world-closure convention.
export function scoreAgainstKey(answerText, key) {
  const hay = clean(answerText).toLowerCase();
  const matched = [];
  const missingRows = [];
  for (const row of key.all_of) {
    const hitToken = row.find((t) => hay.includes(String(t).toLowerCase()));
    if (hitToken) matched.push(hitToken);
    else missingRows.push(row);
  }
  // A forbidden pattern counts only in a sentence with no negation and no
  // conditional marker, so refusing the move by naming it ("we don't log
  // condensation") and staking it properly ("if the entry shows a bead,
  // write that") do not fail the key. Known limit, pilot-calibrated: a
  // non-assertive hedge that also endorses slips the guard.
  const NON_ASSERTIVE =
    /\b(?:don't|do not|not|no|never|won't|wouldn't|shouldn't|can't|isn't|aren't|wrong|refuse|rather than|if|unless|until|only when)\b/;
  const sentences = hay.split(/(?<=[.!?])\s+/);
  const violated = (key.none_of || []).filter((t) =>
    sentences.some((s) => s.includes(String(t).toLowerCase()) && !NON_ASSERTIVE.test(s)),
  );
  return { pass: missingRows.length === 0 && violated.length === 0, matched, missingRows, violated };
}

async function main() {
  const opts = parseArgs(process.argv);
  const { worldId, turns } = loadDialogue(path.resolve(ROOT, opts.traceDir));
  const probe = PROBES.probes[worldId];
  if (!probe) throw new Error(`no probe for ${worldId}`);

  const transcript = turns.map((t) => `TUTOR: ${clean(t.tutor)}\nYOU: ${clean(t.learner)}`).join('\n\n');
  const brief = opts.brief ? fs.readFileSync(path.resolve(opts.brief), 'utf8') : '';
  const sys = [
    brief || 'You are the learner from the conversation below, still in character.',
    'The conversation you lived through, in order:',
    transcript.slice(-14000),
  ].join('\n\n');
  const user = [
    probe.voice.trim(),
    '',
    probe.incident.trim(),
    '',
    'Answer in your own voice, 4-8 sentences, addressing both of the two points put to you.',
  ].join('\n');

  let answer = '';
  if (!opts.dryRun) {
    const res = await callAIWithCliBridge(
      resolveModelRef(opts.model),
      sys,
      user,
      `transfer-probe-${path.basename(opts.traceDir)}`,
      { timeoutMs: 240000 },
    );
    answer = String(res.text || '').trim();
  }

  const result = {
    schema: 'machinespirits.transfer-probe.v1',
    probeVersion: PROBES.version,
    worldId,
    traceDir: opts.traceDir,
    model: opts.model,
    dryRun: opts.dryRun,
    answer,
    exhibit: scoreAgainstKey(answer, probe.key.exhibit),
    stake: scoreAgainstKey(answer, probe.key.stake),
  };
  result.pass = result.exhibit.pass && result.stake.pass;

  const outPath = opts.out || path.join(path.resolve(ROOT, opts.traceDir), 'transfer-probe.json');
  fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `${worldId} ${path.basename(opts.traceDir)}: exhibit ${result.exhibit.pass ? 'PASS' : 'fail'}, stake ${result.stake.pass ? 'PASS' : 'fail'}${opts.dryRun ? ' (dry-run)' : ''}`,
  );
  if (!opts.dryRun) console.log(`answer: ${clean(answer).slice(0, 220)}`);
}

function resolveModelRef(ref) {
  const [provider, ...rest] = String(ref).split('.');
  return { provider, model: rest.join('.') };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
