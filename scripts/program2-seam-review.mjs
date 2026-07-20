// Program-2 Phase 5 — E3 seam review (frozen bar: detection accuracy <= 0.65).
//
// Implements PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §3 E3 / Phase 2
// prereg §7 verbatim, applied live: 40 three-turn windows from committee-arm
// dialogues — 20 containing exactly one committee-delivered turn (source
// composed or fallback_*; frontier_mini_unavailable excluded), 20 containing
// none — shown to a single sonnet-class isolated reviewer who answers whether
// any tutor turn in the window was spoken by a different tutor (chance 0.5,
// the prior is stated), plus a 1-5 continuity rating (descriptive). Window
// sampling: mulberry32 seed 20260718. Zero-call by default; --live spends the
// 40 reviewer calls.
//
// Usage:
//   node scripts/program2-seam-review.mjs [--pilot-root <dir>] [--live] [--json <out>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { callAIWithCliBridge } from '../services/cliProviderBridge.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), '..');

const { values: args } = parseArgs({
  options: {
    'pilot-root': { type: 'string', default: path.resolve(REPO_ROOT, '../ms-phase5-pinned/exports/program2-live-pilot') },
    live: { type: 'boolean', default: false },
    json: { type: 'string' },
  },
});

const SEED = 20260718;
const N_PER_CLASS = 20;
const BAR = 0.65;
const COMMITTEE_SOURCES = new Set([
  'composed',
  'fallback_no_span',
  'fallback_span_lost',
  'fallback_multi_question',
  'fallback_empty',
  'fallback_error',
]);
const REVIEWER = { provider: 'claude-code', model: 'claude-sonnet-5' };

function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(rows, random) {
  const result = [...rows];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function loadCommitteeDialogues(root) {
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'launch-plan.json'), 'utf8')).plan;
  const dialogues = [];
  for (const job of plan.jobs) {
    if (job.arm !== 'committee') continue;
    const dir = path.join(root, 'traces', job.id);
    if (!fs.existsSync(dir)) continue;
    const sealedFile = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f))
      .find((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return text.includes('"type":"run_end"') || text.includes('"type": "run_end"');
      });
    if (!sealedFile) continue;
    const turns = [];
    const committeeTurns = new Map();
    for (const line of fs.readFileSync(sealedFile, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === 'turn_complete' && event.turnRecord) {
        turns.push({
          turn: Number(event.turnRecord.turn ?? turns.length + 1),
          learner: String(event.turnRecord.learner || ''),
          tutor: String(event.turnRecord.tutor || ''),
        });
      } else if (event.type === 'program2_committee_moment' && event.moment) {
        if (COMMITTEE_SOURCES.has(event.moment.source)) committeeTurns.set(Number(event.turn), event.moment.source);
      }
    }
    dialogues.push({ job: job.id, turns, committeeTurns });
  }
  return dialogues;
}

function buildWindows(dialogues) {
  const positives = [];
  const negatives = [];
  for (const dialogue of dialogues) {
    const byTurn = new Map(dialogue.turns.map((t) => [t.turn, t]));
    for (const t of dialogue.turns) {
      const window = [byTurn.get(t.turn - 1), t, byTurn.get(t.turn + 1)];
      if (window.some((w) => !w || !w.tutor)) continue;
      const committeeCount = window.filter((w) => dialogue.committeeTurns.has(w.turn)).length;
      const entry = {
        job: dialogue.job,
        centerTurn: t.turn,
        turns: window.map((w) => ({ turn: w.turn, learner: w.learner, tutor: w.tutor })),
        committeeTurn: window.find((w) => dialogue.committeeTurns.has(w.turn))?.turn ?? null,
        committeeSource: dialogue.committeeTurns.get(t.turn) || null,
      };
      if (committeeCount === 1 && dialogue.committeeTurns.has(t.turn)) positives.push(entry);
      else if (committeeCount === 0) negatives.push(entry);
    }
  }
  return { positives, negatives };
}

function windowPrompt(window) {
  const lines = [
    'You are reviewing a short excerpt from a tutoring dialogue set in a medieval assay-house mystery.',
    'In this study, exactly half of the excerpts contain ONE tutor turn that was authored by a different tutor than the others; the rest are all one tutor.',
    'Read the three exchanges, then answer.',
    '',
  ];
  for (const [index, t] of window.turns.entries()) {
    lines.push(`Exchange ${index + 1}:`, `Learner: ${t.learner}`, `Tutor: ${t.tutor}`, '');
  }
  lines.push(
    'Answer in exactly this format (three lines):',
    'different_tutor: yes|no',
    'which_exchange: 1|2|3|none',
    'continuity: 1-5 (5 = seamless single voice, 1 = obvious break)',
  );
  return lines.join('\n');
}

function parseVerdict(text) {
  const different = /different_tutor:\s*(yes|no)/iu.exec(text || '')?.[1]?.toLowerCase() || null;
  const which = /which_exchange:\s*(1|2|3|none)/iu.exec(text || '')?.[1]?.toLowerCase() || null;
  const continuity = Number(/continuity:\s*([1-5])/iu.exec(text || '')?.[1]) || null;
  return { different, which, continuity };
}

const dialogues = loadCommitteeDialogues(path.resolve(args['pilot-root']));
const { positives, negatives } = buildWindows(dialogues);
const random = mulberry32(SEED);
const chosenPositives = shuffle(positives, random).slice(0, N_PER_CLASS);
const chosenNegatives = shuffle(negatives, random).slice(0, N_PER_CLASS);
const battery = shuffle(
  [
    ...chosenPositives.map((w) => ({ ...w, label: 'committee' })),
    ...chosenNegatives.map((w) => ({ ...w, label: 'all_frontier' })),
  ],
  random,
);

console.log(
  `[seam-review] dialogues ${dialogues.length}; candidate windows: ${positives.length} committee, ${negatives.length} all-frontier; battery ${battery.length} (${chosenPositives.length}+${chosenNegatives.length})`,
);

if (!args.live) {
  console.log('[seam-review] zero-call mode — pass --live to spend the reviewer calls');
  if (args.json) {
    fs.writeFileSync(
      path.resolve(args.json),
      `${JSON.stringify({ schema: 'machinespirits.program2.seam-review-battery.v1', seed: SEED, battery }, null, 2)}\n`,
    );
    console.log(`[seam-review] wrote battery ${args.json}`);
  }
  process.exit(0);
}

const results = [];
let done = 0;
for (const window of battery) {
  let verdict = { different: null, which: null, continuity: null };
  let error = null;
  try {
    const result = await callAIWithCliBridge(
      REVIEWER,
      'You are a careful literary reviewer of dialogue transcripts. Answer only in the requested format.',
      windowPrompt(window),
      'program2_seam_reviewer',
      { effort: 'low' },
    );
    verdict = parseVerdict(result.text);
  } catch (err) {
    error = String(err?.message || err).slice(0, 200);
  }
  results.push({
    job: window.job,
    centerTurn: window.centerTurn,
    label: window.label,
    committeeSource: window.committeeSource,
    verdict,
    error,
  });
  done += 1;
  if (done % 5 === 0) console.error(`[seam-review] ${done}/${battery.length}`);
}

const scored = results.filter((r) => r.verdict.different);
const correct = scored.filter(
  (r) => (r.label === 'committee' && r.verdict.different === 'yes') || (r.label === 'all_frontier' && r.verdict.different === 'no'),
).length;
const accuracy = scored.length ? correct / scored.length : null;
const meanContinuity = (rows) => {
  const values = rows.map((r) => r.verdict.continuity).filter(Boolean);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
};

const artifact = {
  schema: 'machinespirits.program2.seam-review.v1',
  preregistration: 'PROGRAM-2-PHASE5-LIVE-PILOT-PREREGISTRATION.md §3 E3',
  generatedAt: new Date().toISOString(),
  seed: SEED,
  reviewer: REVIEWER,
  n: scored.length,
  correct,
  accuracy,
  bar: BAR,
  parity: accuracy !== null ? accuracy <= BAR : null,
  meanContinuity: {
    committee: meanContinuity(results.filter((r) => r.label === 'committee')),
    all_frontier: meanContinuity(results.filter((r) => r.label === 'all_frontier')),
  },
  results,
};

console.log(
  `[seam-review] accuracy ${correct}/${scored.length} = ${accuracy?.toFixed(3)} (bar <= ${BAR}) -> ${artifact.parity ? 'PARITY' : 'SEAM DETECTED'}`,
);
console.log(
  `[seam-review] continuity committee ${artifact.meanContinuity.committee?.toFixed(2)} vs all-frontier ${artifact.meanContinuity.all_frontier?.toFixed(2)}`,
);
if (args.json) {
  fs.writeFileSync(path.resolve(args.json), `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(`[seam-review] wrote ${args.json}`);
}
