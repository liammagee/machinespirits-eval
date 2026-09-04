#!/usr/bin/env node
/**
 * Re-read recorded hold speech-check drafts with another model.
 *
 * The live speech check (services/tutorStubStressHoldTurn.js) reads each held
 * draft with the learner seat's model and records the reading in the trace
 * (`learner_stress_hold_speech_check`). This script rebuilds the same prompt
 * from the trace (the recorded `model_call` prompt when it is there, else the
 * schedule and the tutor line), sends it to a second model, and writes the two
 * readings side by side. One call per draft that had a live reading; a
 * released draft had none and gets none. Nothing is retried or resampled.
 *
 * usage:
 *   node scripts/replay-hold-speech-check.js --schedule <yaml> --out <json> \
 *     [--model claude-code.claude-opus-5] [--dry-run] <trace.jsonl>...
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  loadTutorStubStressSchedule,
  tutorStubStressHoldSpeechCheckPrompt,
  parseTutorStubStressHoldSpeechCheck,
} from '../services/tutorStubStressSchedule.js';
import { parseModelRef } from './label-learner-state-model.js';

const SYSTEM_PROMPT = 'You read one line of learner speech and answer with one JSON object. No prose.';

function readEvents(tracePath) {
  const events = [];
  for (const line of fs.readFileSync(tracePath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* skip torn line */
    }
  }
  return events;
}

export function collectHoldDrafts(tracePath, schedule) {
  const events = readEvents(tracePath);
  const tutorByTurn = new Map();
  const livePrompts = [];
  for (const e of events) {
    if (e.type === 'turn_complete' && e.turnRecord?.tutor) tutorByTurn.set(Number(e.turn), String(e.turnRecord.tutor));
    if (e.type === 'model_call' && e.role === 'tutor_stub_stress_hold_speech_check' && e.request?.prompt) {
      livePrompts.push({ turn: Number(e.turn), prompt: String(e.request.prompt) });
    }
  }
  const items = [];
  for (const e of events) {
    if (e.type !== 'learner_stress_hold_speech_check') continue;
    const plant = schedule.plants.find((p) => p.turn === Number(e.plantTurn));
    if (!plant) throw new Error(`${tracePath}: no plant at turn ${e.plantTurn} in schedule ${schedule.scheduleId}`);
    const tutorReplyText = tutorByTurn.get(Number(e.turn) - 1) || '';
    const turnPrompts = livePrompts.filter((p) => p.turn === Number(e.turn));
    let readIndex = 0;
    e.drafts.forEach((draft, index) => {
      if (draft.holds === null || draft.holds === undefined) return;
      const recorded = turnPrompts[readIndex]?.prompt || null;
      readIndex += 1;
      items.push({
        trace: tracePath,
        turn: Number(e.turn),
        plantTurn: Number(e.plantTurn),
        state: e.state,
        draftIndex: index,
        verdict: draft.verdict,
        text: draft.text,
        liveHolds: draft.holds,
        liveCopy: draft.copy ?? null,
        liveReason: draft.reason ?? null,
        promptSource: recorded ? 'recorded' : 'rebuilt',
        prompt: recorded || tutorStubStressHoldSpeechCheckPrompt({ plant, speech: draft.text, tutorReplyText }),
      });
    });
  }
  return items;
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const dryRun = argv.includes('--dry-run');
  const model = flag('--model', 'claude-code.claude-opus-5');
  const schedulePath = flag('--schedule', null);
  const out = flag('--out', null);
  const traces = argv.filter(
    (a, i) => !a.startsWith('--') && !['--model', '--schedule', '--out'].includes(argv[i - 1]),
  );
  if (!schedulePath || !out || !traces.length) {
    console.error(
      'usage: node scripts/replay-hold-speech-check.js --schedule <yaml> --out <json> [--model <ref>] [--dry-run] <trace.jsonl>...',
    );
    process.exit(2);
  }
  const schedule = loadTutorStubStressSchedule(path.resolve(schedulePath));
  const items = traces.flatMap((t) => collectHoldDrafts(path.resolve(t), schedule));
  if (dryRun) {
    for (const it of items)
      console.log(
        `${path.relative(process.cwd(), it.trace)} t${it.turn} draft ${it.draftIndex} live=${it.liveHolds} ${it.promptSource} prompt ${it.prompt.length} chars`,
      );
    console.log(`${items.length} drafts, ${items.length} calls to ${model}`);
    return;
  }
  const { callAIWithCliBridge } = await import('../services/cliProviderBridge.js');
  const modelRef = parseModelRef(model);
  const rows = [];
  for (const it of items) {
    const label = `hold-speech-recheck-t${it.turn}-d${it.draftIndex}`;
    const res = await callAIWithCliBridge(modelRef, SYSTEM_PROMPT, it.prompt, label, { timeoutMs: 300000 });
    const text = typeof res === 'string' ? res : (res?.content ?? res?.text ?? JSON.stringify(res));
    const reading = parseTutorStubStressHoldSpeechCheck(text);
    const row = {
      ...it,
      prompt: undefined,
      recheckModel: model,
      recheckHolds: reading.holds,
      recheckCopy: reading.copy,
      recheckReason: reading.reason,
      recheckRaw: reading.raw,
    };
    row.agree = reading.holds === null ? null : reading.holds === it.liveHolds;
    rows.push(row);
    console.log(
      `${path.basename(path.dirname(it.trace))} t${it.turn} d${it.draftIndex}: live ${it.liveHolds} / ${model} ${reading.holds} ${row.agree === null ? '(unparsed)' : row.agree ? 'agree' : 'DIFFER'}`,
    );
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(
      out,
      `${JSON.stringify({ model, schedule: path.resolve(schedulePath), readAt: new Date().toISOString(), rows }, null, 2)}\n`,
    );
  }
  const agree = rows.filter((r) => r.agree === true).length;
  const differ = rows.filter((r) => r.agree === false).length;
  const unparsed = rows.filter((r) => r.agree === null).length;
  console.log(`${rows.length} drafts: agree ${agree}, differ ${differ}, unparsed ${unparsed} -> ${out}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain)
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
