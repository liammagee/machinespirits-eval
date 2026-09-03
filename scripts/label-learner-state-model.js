#!/usr/bin/env node
/**
 * Candidate (a) of workplan/items/state-detection-without-word-lists.md step 2:
 * a model reads each learner turn and names the learner's state from a fixed
 * list. World-neutral by construction — the prompt names states, not story
 * things. Scored against the planted state like every other detector.
 *
 *   node scripts/label-learner-state-model.js --trace <file> [--trace ...] [--bench-dir <dir>]
 *        [--model claude-code.claude-sonnet-5] [--out exports/form-state-detector/labels.jsonl]
 *        [--live --max-calls N] [--score <labels.jsonl>] [--json]
 *
 * DRY BY DEFAULT: prints how many calls a live run would make and one sample
 * prompt, writes nothing paid. `--live` makes the calls through the CLI bridge
 * (subscription seat, no API key) and stops at --max-calls; that flag is the
 * spend ceiling and is required with --live. `--score` replays a finished label
 * file against the planted turns with the same verdicts the scorer uses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TUTOR_STUB_PLANT_STATE_TO_PRESSURE } from '../services/tutorStubMannerSwitch.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The CLI bridge takes `{ provider, model }`, not the dotted CLI string.
 * 'claude-code.claude-sonnet-5' becomes { provider: 'claude-code', model: 'claude-sonnet-5' }.
 * A bare string reached the bridge on the first live run (2026-09-02) and every
 * call failed before any process started ("provider unknown").
 */
export function parseModelRef(dotted) {
  const [provider, ...rest] = String(dotted || '').split('.');
  if (!provider || !rest.length) throw new Error(`model must be provider.model, got "${dotted}"`);
  return { provider, model: rest.join('.') };
}
const STATES = ['jumping_ahead', 'irritated', 'frustrated', 'forgetting', 'opposed', 'bored', 'lost', 'neutral'];
const STATE_GLOSS = {
  jumping_ahead: 'demanding the conclusion or the answer before the evidence supports it',
  irritated: 'rubbed wrong by the exchange or by how the tutor talks; mocking or sharp',
  frustrated: 'feeling their effort is not paying off; asking what it counted for',
  forgetting: 'asserting something as already settled or already done that the record does not support',
  opposed: 'defending a position because of a personal cost to giving it up',
  bored: 'attention drifting, going flat, short assent, wanting to be done',
  lost: 'confused about where the inquiry stands; cannot tell which is which',
  neutral: 'none of the above — working the problem, agreeing, asking an ordinary question',
};
const PRESSURE_STATES = new Set(Object.keys(TUTOR_STUB_PLANT_STATE_TO_PRESSURE));
const QUIET_STATES = new Set(['bored', 'lost']);

function collectFlag(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[++i]);
  return out;
}

function findTraces(dir) {
  const out = [];
  const stack = [path.resolve(ROOT, dir)];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) stack.push(path.join(d, e.name));
      else if (e.name.endsWith('.jsonl') && !e.name.includes('summary')) out.push(path.join(d, e.name));
    }
  }
  return out.sort();
}

function loadTurns(tracePath) {
  const ev = fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .filter((l) => l.includes('"turn_complete"') || l.includes('"learner_stress_plant"'))
    .map((l) => JSON.parse(l));
  const plants = Object.fromEntries(ev.filter((e) => e.type === 'learner_stress_plant').map((e) => [e.turn, e.state]));
  const turns = ev
    .filter((e) => e.type === 'turn_complete')
    .sort((a, b) => a.turn - b.turn)
    .map((e) => ({ turn: e.turn, learner: e.turnRecord?.learner || '', tutor: e.turnRecord?.tutor || '' }));
  const items = [];
  let lastTutor = '';
  for (const t of turns) {
    if (t.learner.trim())
      items.push({
        trace: path.relative(ROOT, tracePath),
        turn: t.turn,
        planted: plants[t.turn] || null,
        learner: t.learner,
        tutorBefore: lastTutor,
      });
    lastTutor = t.tutor;
  }
  return items;
}

export function buildPrompt(item) {
  const list = STATES.map((s) => `- ${s}: ${STATE_GLOSS[s]}`).join('\n');
  return [
    "You read one turn of a tutoring dialogue and name the learner's state.",
    "Judge only the form of the learner's line — who it addresses, what it asks or asserts, its tone — not the subject matter.",
    'States:',
    list,
    '',
    item.tutorBefore
      ? `Tutor said before: ${JSON.stringify(item.tutorBefore.slice(0, 600))}`
      : 'Tutor said before: (opening turn)',
    `Learner says: ${JSON.stringify(item.learner)}`,
    '',
    'Answer with one state name from the list and nothing else.',
  ].join('\n');
}

function parseLabel(text) {
  const t = String(text || '')
    .toLowerCase()
    .replace(/[^a-z_\s]/g, ' ');
  const hit = STATES.find((s) => new RegExp(`\\b${s}\\b`).test(t));
  return hit || 'unparsed';
}

function verdict(planted, read) {
  const pressure = PRESSURE_STATES.has(read);
  if (PRESSURE_STATES.has(planted)) return read === planted ? 'right' : pressure ? 'wrong-kind' : 'silent';
  if (QUIET_STATES.has(planted)) return read === planted ? 'quiet-right' : pressure ? 'wrong-fire' : 'quiet-ok';
  return read === 'neutral' ? 'neutral-ok' : 'false-alarm';
}

function score(rows) {
  const t = {
    shouldFire: 0,
    fired: 0,
    rightKind: 0,
    quiet: 0,
    quietRight: 0,
    wrongFire: 0,
    neutral: 0,
    falseAlarm: 0,
    unparsed: 0,
  };
  for (const r of rows) {
    const v = verdict(r.planted || 'neutral', r.read);
    if (r.read === 'unparsed') t.unparsed += 1;
    if (PRESSURE_STATES.has(r.planted)) {
      t.shouldFire += 1;
      if (v === 'right' || v === 'wrong-kind') t.fired += 1;
      if (v === 'right') t.rightKind += 1;
    } else if (QUIET_STATES.has(r.planted)) {
      t.quiet += 1;
      if (v === 'quiet-right') t.quietRight += 1;
      if (v === 'wrong-fire') t.wrongFire += 1;
    } else {
      t.neutral += 1;
      if (v === 'false-alarm') t.falseAlarm += 1;
    }
  }
  return {
    firedAsPressure: `${t.fired}/${t.shouldFire}`,
    rightKind: `${t.rightKind}/${t.shouldFire}`,
    quietRight: `${t.quietRight}/${t.quiet}`,
    wrongFiresAtQuiet: `${t.wrongFire}/${t.quiet}`,
    neutralFalseAlarms: `${t.falseAlarm}/${t.neutral}`,
    unparsed: t.unparsed,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const KNOWN = new Set(['--trace', '--bench-dir', '--model', '--out', '--live', '--max-calls', '--score', '--json']);
  for (let i = 0; i < args.length; i++) {
    if (!KNOWN.has(args[i])) throw new Error(`unknown argument: ${JSON.stringify(args[i])}`);
    if (!['--live', '--json'].includes(args[i])) i += 1;
  }
  const json = args.includes('--json');

  if (args.includes('--score')) {
    const file = path.resolve(ROOT, args[args.indexOf('--score') + 1]);
    const rows = fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    const s = score(rows);
    if (json) console.log(JSON.stringify({ labels: file, rows: rows.length, ...s }, null, 2));
    else
      console.log(
        `${rows.length} labelled turns · fired ${s.firedAsPressure} · right kind ${s.rightKind} · quiet right ${s.quietRight} · wrong-fire at quiet ${s.wrongFiresAtQuiet} · false alarms ${s.neutralFalseAlarms} · unparsed ${s.unparsed}`,
      );
    return;
  }

  const files = [
    ...collectFlag(args, '--trace').map((f) => path.resolve(ROOT, f)),
    ...collectFlag(args, '--bench-dir').flatMap(findTraces),
  ];
  if (!files.length) throw new Error('give --trace or --bench-dir');
  for (const f of files) if (!fs.existsSync(f)) throw new Error(`trace not found: ${f}`);
  const items = files.flatMap(loadTurns);
  const planted = items.filter((i) => i.planted).length;
  const model = args.includes('--model') ? args[args.indexOf('--model') + 1] : 'claude-code.claude-sonnet-5';
  const live = args.includes('--live');
  const maxCalls = args.includes('--max-calls') ? Number(args[args.indexOf('--max-calls') + 1]) : null;
  if (live && !(maxCalls > 0)) throw new Error('--live needs --max-calls N (the spend ceiling)');

  if (!live) {
    const summary = {
      mode: 'dry',
      traces: files.length,
      turnsToLabel: items.length,
      plantedTurns: planted,
      model,
      samplePrompt: buildPrompt(items[0]),
    };
    if (json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(
        `dry run: ${files.length} traces, ${items.length} learner turns to label (${planted} planted), model ${model}`,
      );
      console.log(`one call per turn — a live run would make ${items.length} calls. Add --live --max-calls N to run.`);
      console.log('\nsample prompt:\n' + summary.samplePrompt);
    }
    return;
  }

  const { callAIWithCliBridge } = await import('../services/cliProviderBridge.js');
  const modelRef = parseModelRef(model);
  const outArg = args.includes('--out')
    ? args[args.indexOf('--out') + 1]
    : 'exports/form-state-detector/model-labels.jsonl';
  const outPath = path.resolve(ROOT, outArg);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const done = new Set(
    fs.existsSync(outPath)
      ? fs
          .readFileSync(outPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((l) => {
            const r = JSON.parse(l);
            return `${r.trace}#${r.turn}`;
          })
      : [],
  );
  let calls = 0;
  for (const item of items) {
    if (done.has(`${item.trace}#${item.turn}`)) continue;
    if (calls >= maxCalls) break;
    calls += 1;
    let res;
    try {
      res = await callAIWithCliBridge(modelRef, '', buildPrompt(item), `label-learner-state-${calls}`, {
        timeoutMs: 240000,
      });
    } catch (err) {
      fs.appendFileSync(
        outPath,
        `${JSON.stringify({ ...item, model, read: 'unparsed', error: String(err?.message || err) })}\n`,
      );
      continue; // one attempt per turn; no resampling after a failure
    }
    const text = typeof res === 'string' ? res : (res?.content ?? res?.text ?? JSON.stringify(res));
    fs.appendFileSync(
      outPath,
      `${JSON.stringify({ ...item, model, read: parseLabel(text), raw: String(text).slice(0, 200) })}\n`,
    );
    if (!json) console.log(`${item.trace} t${item.turn} planted=${item.planted || '-'} read=${parseLabel(text)}`);
  }
  console.log(`made ${calls} calls (ceiling ${maxCalls}); labels in ${outArg}. Score with --score ${outArg}`);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
