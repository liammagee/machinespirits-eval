/**
 * Judge planted replies — the disclosure instrument as a standing channel
 * (Phase J1, card: workplan/items/adaptation-plan-3-phase-j.md).
 *
 * For every planted moment in the given trace dirs, judges the delivered
 * tutor reply on a 1-10 scale under one of three channels, stored
 * separately per §6.23's two-readings convention:
 *
 * - blind:      "how good is this reply?" (no state shown)
 * - authored:   the planted state is named to the judge (§6.24 disclosure —
 *               near-doubles judge–gold alignment in two judge families)
 * - estimated:  the state the live trigger actually classified is named —
 *               what deployed judging would inherit (Phase J2)
 *
 * Usage:
 *   node scripts/judge-planted-replies.js --dirs <traceDir[,traceDir...]> \
 *     [--channel blind|authored|estimated] [--judge codex.gpt-5.6-sol] \
 *     [--out <file.json>]
 */

import fs from 'node:fs';
import path from 'node:path';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const STATE_GLOSS = {
  jumping_ahead: 'jumping ahead — demanding the conclusion before the evidence supports it',
  irritated: 'irritated — rubbed wrong by the exchange or its register',
  bored: 'bored — attention drifting, going flat',
  lost: 'lost — genuinely confused about where the inquiry stands',
  frustrated: 'frustrated — feeling their effort is not paying off',
  forgetting: 'forgetting — asserting a false memory as settled',
  opposed: 'opposed — defending a position for personal stakes',
};

const ESTIMATE_GLOSS = {
  mockery: 'pressing — mocking how the tutor talks',
  demand: 'pressing — demanding an action or verdict now',
  grievance: 'pressing — voicing that their effort is not paying off',
  settled_claim: 'asserting something as settled that may not be',
  stake: 'digging in — defending a position for personal stakes',
  defiance: 'digging in — resisting the current direction',
  concession: 'conceding a point',
  neutral: 'no particular state detected',
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const DIRS = String(flag('--dirs', '')).split(',').filter(Boolean);
const CHANNEL = flag('--channel', 'authored');
const JUDGE = flag('--judge', 'codex.gpt-5.6-sol');
const OUT = flag('--out', null);
if (!DIRS.length) {
  console.error(
    'usage: --dirs <traceDir[,traceDir]> [--channel blind|authored|estimated] [--judge provider.model] [--out file]',
  );
  process.exit(1);
}
const [provider, ...modelParts] = JUDGE.split('.');
const judgeRef = { provider, model: modelParts.join('.') };

const items = [];
for (const dir of DIRS) {
  const fl = fs.readdirSync(dir).find((x) => x.endsWith('.jsonl') && !x.includes('summary'));
  if (!fl) continue;
  const ev = fs
    .readFileSync(path.join(dir, fl), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const sw = Object.fromEntries(ev.filter((e) => e.type === 'tutor_manner_switch').map((e) => [e.turn, e.pressure]));
  const turns = Object.fromEntries(
    ev
      .filter((e) => e.type === 'turn_complete')
      .map((e) => [e.turn, { L: e.turnRecord?.learner || '', T: e.turnRecord?.tutor || '' }]),
  );
  for (const p of ev.filter((e) => e.type === 'learner_stress_plant')) {
    if (!turns[p.turn]) continue;
    items.push({
      dir,
      turn: p.turn,
      state: p.state,
      estimate: sw[p.turn] || 'neutral',
      gold: p.rightRepair || null,
      learner: turns[p.turn].L,
      tutor: turns[p.turn].T,
    });
  }
}

const headFor = (it) => {
  if (CHANNEL === 'authored') return `The learner at this moment is ${STATE_GLOSS[it.state] || it.state}.`;
  if (CHANNEL === 'estimated')
    return `A monitoring system estimates the learner at this moment is: ${ESTIMATE_GLOSS[it.estimate] || it.estimate}.`;
  return '';
};
const question =
  CHANNEL === 'blind'
    ? 'For each item, rate 1-10 how good the TUTOR REPLY is as tutoring, given the learner line.'
    : 'For each item, rate 1-10 how well the TUTOR REPLY addresses a learner in the stated condition — the right teaching response to that person at that moment, not merely good prose.';

const scores = [];
for (let i = 0; i < items.length; i += 8) {
  const batch = items.slice(i, i + 8);
  const lines = batch.map((it, j) => `${j + 1}. ${headFor(it)}\nLEARNER: ${it.learner}\nTUTOR REPLY: ${it.tutor}`);
  const prompt = [question, 'Return ONLY a JSON array: [{"n":1,"score":7}].', '', ...lines].join('\n');
  let res = null;
  for (let a = 0; a < 3 && !res; a++) {
    try {
      res = await callAIWithCliBridge(judgeRef, '', prompt, `judge-planted-${CHANNEL}-${i}`, { timeoutMs: 240000 });
    } catch (err) {
      console.error(`retry: ${String(err).slice(0, 80)}`);
    }
  }
  let tags = [];
  if (res) {
    try {
      tags = JSON.parse(res.text.replace(/^[^[]*/, '').replace(/[^\]]*$/, ''));
    } catch {
      // Unparseable judge output leaves this batch's scores null.
    }
  }
  for (let j = 0; j < batch.length; j++) scores.push(tags.find((t) => t.n === j + 1)?.score ?? null);
  console.error(`${CHANNEL} ${i + batch.length}/${items.length}`);
}

const rows = items.map((it, i) => ({
  dir: it.dir,
  turn: it.turn,
  state: it.state,
  estimate: it.estimate,
  gold: it.gold,
  channel: CHANNEL,
  judge: JUDGE,
  score: scores[i],
}));
const json = JSON.stringify(rows, null, 1);
if (OUT) fs.writeFileSync(OUT, json);
else console.log(json);
