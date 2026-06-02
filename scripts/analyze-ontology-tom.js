#!/usr/bin/env node

// Post-hoc ToM/anagnorisis readout over an existing ontology A/B pilot run.
//
// Runs the ontology ToM modules (defined ABox + acquired snapshot + anagnorisis
// overlap) over the REAL (or mock) dialogues an ontology-ab-pilot run already
// produced — NO new LLM calls. Architecture-independent: the same heuristic text
// detectors run on BOTH arms. This is a SCREEN, not an effect estimate (heuristic
// proxies, small N, AI-generated dialogues). See the soft-joint notes below.
//
// Usage: node scripts/analyze-ontology-tom.js <pilot-run.json> [more.json ...]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GROUNDED, HYPOTHESIZED, checkSnapshot } from '../services/ontology/acquiredAbox.js';
import { specToDefinedABox, anagnorisisOverlap } from '../services/ontology/definedAbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

// ── Heuristic text detectors (SOFT JOINTS — keyword proxies, identical across arms) ──
const GOAL_PATTERNS =
  /\b(another premise|rules out|rule out|does not identify|do not identify|cannot conclude|can'?t conclude|should not say|shouldn'?t say|bounded claim|only shows|compatible with|does not prove|doesn'?t prove|necessary (and|vs|versus) sufficient|i need to own|own the (warrant|reasoning)|underdetermined|one possible cause)\b/i;
const TUTOR_INVITE_PATTERNS =
  /\b(spell out|what would|which premise|can you (say|show|articulate|name)|does that (prove|show|mean)|in your own|own the (warrant|reasoning|conclusion)|why do you|what rules out|how would you|put it in your)\b/i;
const TUTOR_TELL_PATTERNS =
  /\b(the answer is|the theorem|here is the|let me show|you should just|the rule is|simply put|the correct|that'?s affirming|this is affirming|it'?s a fallacy called)\b/i;

function detectLearnerReachedGoal(text) {
  return GOAL_PATTERNS.test(String(text || ''));
}
function detectTutorMove(text) {
  const t = String(text || '');
  const invite = TUTOR_INVITE_PATTERNS.test(t);
  const tell = TUTOR_TELL_PATTERNS.test(t);
  if (invite && !tell) return 'invite';
  if (tell && !invite) return 'tell';
  return 'mixed';
}

function dialogueParts(dialogue = []) {
  const learner = dialogue.filter((m) => m.role === 'learner');
  const tutor = dialogue.filter((m) => m.role === 'tutor');
  return {
    firstTutor: tutor[0]?.content || '',
    lastLearner: learner.at(-1)?.content || '',
  };
}

// Score one arm's dialogue with the ToM modules + the heuristic detectors.
async function scoreArmDialogue(scenario, dialogue) {
  const def = specToDefinedABox(scenario);
  const { firstTutor, lastLearner } = dialogueParts(dialogue);

  // Anagnorisis: did the learner come to own the conclusion / articulate the warrant?
  const reached = detectLearnerReachedGoal(lastLearner);
  const learnerRecords = reached
    ? [
        {
          role: 'learner',
          subject: 'learner',
          dimension: 'claim_ownership',
          type: 'ConclusionOwned',
          turn: 1,
          tier: GROUNDED,
        },
        ...(def.targetKC
          ? [
              {
                role: 'learner',
                subject: `learner__${def.targetKC}`,
                dimension: 'kc_status',
                type: 'KCMastered',
                turn: 1,
                tier: GROUNDED,
              },
            ]
          : []),
      ]
    : [];
  const overlap = anagnorisisOverlap(learnerRecords, def.goal, 1);

  // Recognition move + the productive-vs-unproductive ToM inconsistency split.
  // A deferring learner (perception = AuthorityToDeferTo) treated as a thinking-partner
  // (an INVITE move) is PRODUCTIVE scaffolding — surfaced via the consistency machinery.
  const move = detectTutorMove(firstTutor);
  let scaffold = false;
  let tomInconsistent = null;
  if (def.perception === 'AuthorityToDeferTo' && (move === 'invite' || move === 'tell')) {
    const treatAs = move === 'invite' ? 'ThinkingPartner' : 'AuthorityToDeferTo';
    const tom = [
      {
        role: 'tutor',
        subject: 'learner',
        dimension: 'perceived_role',
        type: 'AuthorityToDeferTo',
        turn: 1,
        tier: GROUNDED,
      },
      { role: 'tutor', subject: 'learner', dimension: 'perceived_role', type: treatAs, turn: 1, tier: HYPOTHESIZED },
    ];
    const snap = await checkSnapshot(tom, { role: 'tutor', turn: 1 });
    tomInconsistent = !snap.full;
    scaffold = tomInconsistent; // treat-as-partner over a deferring learner = productive
  }

  return { reached, overlap, move, scaffold, tomInconsistent };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function rate(xs) {
  return xs.length ? xs.filter(Boolean).length / xs.length : 0;
}

function scenarioReportsOf(report) {
  if (Array.isArray(report.scenarioReports)) return report.scenarioReports;
  if (Array.isArray(report.runs)) return [report];
  return [];
}

async function analyzeFile(file) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const arms = {};
  const perScenario = [];

  for (const sr of scenarioReportsOf(report)) {
    const scenario = sr.scenario;
    const rows = { scenarioId: scenario.id, arms: {} };
    for (const run of sr.runs || []) {
      for (const arm of ['baseline', 'ontology']) {
        if (!run[arm]) continue;
        const scored = await scoreArmDialogue(scenario, run[arm].dialogue || []);
        arms[arm] = arms[arm] || { overlap: [], reached: [], scaffold: [], judgeTotal: [] };
        arms[arm].overlap.push(scored.overlap);
        arms[arm].reached.push(scored.reached);
        arms[arm].scaffold.push(scored.scaffold);
        if (run[arm].score?.total != null) arms[arm].judgeTotal.push(run[arm].score.total);
        rows.arms[arm] = scored;
      }
    }
    perScenario.push(rows);
  }

  const summary = {};
  for (const arm of Object.keys(arms)) {
    summary[arm] = {
      n: arms[arm].overlap.length,
      anagnorisisOverlap: mean(arms[arm].overlap),
      reachedGoalRate: rate(arms[arm].reached),
      scaffoldRate: rate(arms[arm].scaffold),
      judgeTotalMean: mean(arms[arm].judgeTotal),
    };
  }
  return { file: path.relative(ROOT_DIR, file), backend: report.backend, summary, perScenario };
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(3) : '—';
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node scripts/analyze-ontology-tom.js <pilot-run.json> [more.json ...]');
    process.exit(1);
  }
  for (const file of files) {
    const r = await analyzeFile(file);
    console.log(`\n=== ${r.file}  (backend: ${r.backend}) ===`);
    console.log('arm       n   anagnorisis  reachedGoal  scaffold   judgeTotal');
    for (const arm of ['baseline', 'ontology']) {
      const s = r.summary[arm];
      if (!s) continue;
      console.log(
        `${arm.padEnd(9)} ${String(s.n).padEnd(3)} ${fmt(s.anagnorisisOverlap).padEnd(12)} ${fmt(s.reachedGoalRate).padEnd(12)} ${fmt(s.scaffoldRate).padEnd(10)} ${fmt(s.judgeTotalMean)}`,
      );
    }
    const b = r.summary.baseline;
    const o = r.summary.ontology;
    if (b && o) {
      console.log(
        `Δ(ontology−baseline): anagnorisis ${fmt(o.anagnorisisOverlap - b.anagnorisisOverlap)}, scaffold ${fmt(o.scaffoldRate - b.scaffoldRate)}, judgeTotal ${fmt(o.judgeTotalMean - b.judgeTotalMean)}`,
      );
    }
  }
  console.log(
    '\nNOTE: post-hoc, heuristic keyword proxies (soft joints), small N, AI-generated dialogues — a screen, not an effect estimate.',
  );
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
