#!/usr/bin/env node

// Multi-turn ToM A/B harness. Three arms differ ONLY in the tutor's per-turn guidance:
//   baseline      — no ontology guidance
//   ontology      — policy guidance from buildOntologyGuidance (the existing arm)
//   ontology_tom  — policy guidance + a per-turn THEORY-OF-MIND brief derived from the
//                   tutor's acquired (turn-stamped) model of the learner, consistency-checked
//
// The tutor reports its own per-turn observation of the learner (that IS its ToM); it is
// fed to the acquired accumulator and checked per turn. A GROUNDED inconsistency — the
// learner claims mastery yet signals weak ownership (surface compliance) — is the cue the
// brief surfaces. Scoring stays on an independent judge + symbolic anagnorisis-overlap.
//
// mock backend = deterministic plumbing demo (RIGGED so arms differ — NOT evidence).
// codex backend = real LLM dialogues. Usage:
//   node scripts/run-ontology-tom-ab.js --backend mock --suite stress --turns 3
//   node scripts/run-ontology-tom-ab.js --backend codex --scenario <id> --turns 4

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { SCENARIOS } from './run-ontology-ab-pilot.js';
import { buildOntologyGuidance } from '../services/ontology/reasoningOntology.js';
import { GROUNDED, HYPOTHESIZED, checkSnapshot, snapshotRecords } from '../services/ontology/acquiredAbox.js';
import { specToDefinedABox, observationsToAcquired, anagnorisisOverlap } from '../services/ontology/definedAbox.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const ARMS = ['baseline', 'ontology', 'ontology_tom'];

const KC_PHRASE = Object.freeze({
  DistinguishNecessarySufficient: 'the distinction between necessary and sufficient conditions',
  ConstructCounterexample: 'a counterexample that tests the boundary of the claim',
  ArticulateWarrant: 'the warrant that licenses the conclusion',
});
function humanizeKC(kc) {
  return KC_PHRASE[kc] || 'the missing warrant';
}

const GOAL_PATTERNS =
  /\b(another premise|rules? out|does not identify|do not identify|cannot conclude|can'?t conclude|should not say|shouldn'?t say|bounded claim|only shows|compatible with|does not prove|doesn'?t prove|necessary (and|vs|versus) sufficient|reconstruct|in my own words|i can'?t assume|underdetermined|one possible cause)\b/i;
export function detectReachedGoal(text) {
  return GOAL_PATTERNS.test(String(text || ''));
}

// What perceived_role a tutor MOVE treats the learner as (the tutor's working hypothesis).
export function impliedTreatment(move) {
  if (move === 'invite') return 'ThinkingPartner';
  if (move === 'tell') return 'AuthorityToDeferTo';
  return null; // 'repair' addresses misrecognition, not a perceived_role assertion
}

// The ToM brief: the ontology_tom intervention. Pure + testable.
export async function computeTomBrief({ tutorRecords, def, turn }) {
  const snap = await checkSnapshot(tutorRecords, { role: 'tutor', turn });
  const grounded = snapshotRecords(tutorRecords, { role: 'tutor', turn, tiers: [GROUNDED] });
  const perceivedRole = grounded.find((r) => r.dimension === 'perceived_role')?.type || null;
  // Grounded inconsistency = the tutor's own observations of the learner conflict, e.g.
  // claims mastery (ConclusionOwned) AND shows weak ownership (ClaimOwnershipWeak) =
  // surface compliance. That is the cue NOT to accept the claimed understanding.
  const surfaceCompliance = !snap.grounded;
  const kc = humanizeKC(def.targetKC);

  const parts = ['Theory-of-mind brief:'];
  if (perceivedRole === 'Misrecognition') {
    parts.push('the learner feels misrecognized — acknowledge their point before pressing on;');
  } else if (perceivedRole === 'AuthorityToDeferTo') {
    parts.push(
      'the learner is deferring to you as the authority — do NOT supply the conclusion; treat them as a thinking-partner;',
    );
  } else if (perceivedRole === 'ThinkingPartner') {
    parts.push('the learner is engaging as a partner — press for precision;');
  }
  if (surfaceCompliance) {
    parts.push(
      'CONSISTENCY ALERT — the learner claims understanding but their reasoning is weakly owned (surface compliance); do not accept it, ask them to reconstruct the warrant;',
    );
  }
  parts.push(`scaffold them to articulate ${kc} in their own words and withhold the worked conclusion.`);
  return { recognitionState: perceivedRole, surfaceCompliance, scaffold: true, text: parts.join(' ') };
}

// ── backends ────────────────────────────────────────────────────────────────
function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const slice = fenced ? fenced[1] : raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
}

function codexCall(prompt, args) {
  const outFile = path.join(args.outDir, 'tmp', `${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const result = spawnSync(
    'codex',
    ['exec', '--ephemeral', '--ignore-rules', '--sandbox', 'read-only', '-C', ROOT_DIR, '-o', outFile, '-'],
    { input: prompt, cwd: ROOT_DIR, encoding: 'utf8', timeout: args.timeoutMs },
  );
  if (result.status !== 0) throw new Error(`codex failed:\n${result.stderr || result.stdout}`);
  return extractJson(fs.readFileSync(outFile, 'utf8')) || {};
}

// Deterministic mock. RIGGED so the arms diverge — a plumbing check, NOT evidence.
function mockTutor({ arm, scenario, brief }) {
  const hidden = scenario.hidden || {};
  const surface = hidden.learnerMisconception === 'surface_compliance_as_understanding';
  const perceptionTag = hidden.learnerPerceptionOfTutor || 'authority_to_defer_to';
  const signals = surface ? ['conclusion_owned', 'claim_ownership_weak'] : ['claim_ownership_weak', perceptionTag];
  // baseline tells; ontology invites; ontology_tom invites + repairs per the brief.
  const move = arm === 'baseline' ? 'tell' : 'invite';
  const repair = arm === 'ontology_tom' && (perceptionTag.includes('misrecogn') || surface);
  const message =
    arm === 'baseline'
      ? 'Here is the correct reasoning: the conclusion follows from the rule, so you can accept it.'
      : `${repair ? 'I hear that this feels unfinished, and your point stands. ' : ''}Before we close it: can you put the missing step in your own words — what would actually rule out the other possibilities?`;
  return { observed: { perceived_role: perceptionTag, signals }, move, message, _brief: brief?.text || null };
}
function mockLearner({ arm, turn, turns }) {
  // With scaffolding (non-baseline), the learner progressively owns the warrant by the last turn.
  const progressed = arm !== 'baseline' && turn >= Math.max(1, turns - 1);
  const deepened = arm === 'ontology_tom' && turn >= Math.max(1, turns - 1);
  const message = progressed
    ? `I think I need another premise that rules out the other causes${deepened ? ', and I should reconstruct the warrant rather than just restate the rule' : ''}.`
    : 'I copied the cleaner proof style you wanted, so I assume the reasoning is acceptable now.';
  return { message, understanding: progressed ? 'warrant_articulated' : 'label_accepted' };
}
function mockJudge({ dialogue, arm }) {
  const text = dialogue
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();
  const owns = /another premise|rules out|reconstruct the warrant/.test(text);
  return {
    policy_alignment: arm === 'baseline' ? 0.45 : owns ? 0.92 : 0.7,
    recognitive_support: arm === 'baseline' ? 0.4 : arm === 'ontology_tom' ? 0.92 : 0.75,
    deductive_learning: owns ? 0.9 : 0.5,
    overclaim_risk: owns ? 0.05 : 0.3,
    reasoning: owns ? 'learner reconstructs the warrant' : 'learner accepts the surface',
  };
}

function tutorPrompt({ arm, scenario, dialogue, guidance, brief }) {
  const { hidden: _h, observationTags: _o, ...visible } = scenario;
  return `You are the TUTOR in a controlled multi-turn tutoring pilot. Return ONE JSON object only, no markdown.
Arm: ${arm}
Scenario (visible to you): ${JSON.stringify(visible)}
Dialogue so far: ${JSON.stringify(dialogue)}
${arm !== 'baseline' ? `Ontology policy guidance: ${guidance?.roleInstruction || 'none'}` : 'No ontology guidance (baseline).'}
${arm === 'ontology_tom' ? `Ontology theory-of-mind brief (FOLLOW IT): ${brief?.text || 'none'}` : ''}
Return: {"observed":{"perceived_role":"authority_to_defer_to|thinking_partner|misrecognition","signals":["claim_ownership_weak","conclusion_owned","affirming_consequent",...]},"move":"invite|tell|repair","message":"<your turn to the learner>"}
"observed" is YOUR read of the learner this turn. "signals" are short tags for what the learner just showed (include BOTH conclusion_owned AND claim_ownership_weak if they claim understanding but only show surface compliance).`;
}
function learnerPrompt({ scenario, dialogue }) {
  return `You are the LEARNER in a controlled tutoring pilot. Return ONE JSON object only, no markdown.
Hidden truth about you: ${JSON.stringify(scenario.hidden)}
Dialogue so far: ${JSON.stringify(dialogue)}
Stay in character. If your hidden learnerResistance is high, do not produce a too-tidy breakthrough; revise only when the tutor genuinely addresses your targetRepair.
Return: {"message":"<your reply to the tutor>","understanding":"label_accepted|warrant_articulated|still_resisting"}`;
}
function judgePrompt({ dialogue }) {
  return `You are an impartial JUDGE. Score the finished dialogue 0-1 (higher overclaim_risk is worse). Return ONE JSON object only.
Dialogue: ${JSON.stringify(dialogue)}
Return: {"policy_alignment":n,"recognitive_support":n,"deductive_learning":n,"overclaim_risk":n,"reasoning":"..."}`;
}

function runTutor(payload, args) {
  return args.backend === 'codex' ? codexCall(tutorPrompt(payload), args) : mockTutor(payload);
}
function runLearner(payload, args) {
  return args.backend === 'codex' ? codexCall(learnerPrompt(payload), args) : mockLearner(payload);
}
function runJudge(payload, args) {
  return args.backend === 'codex' ? codexCall(judgePrompt(payload), args) : mockJudge(payload);
}

// ── the multi-turn dialogue for one arm ─────────────────────────────────────
async function runArmDialogue({ arm, scenario, args }) {
  const def = specToDefinedABox(scenario);
  const dialogue = [{ role: 'learner', content: scenario.openingSeed }];
  const tutorRecords = [];
  const learnerRecords = [];
  const tomTrace = [];

  for (let turn = 1; turn <= args.turns; turn += 1) {
    const lastLearner = [...dialogue].reverse().find((m) => m.role === 'learner')?.content || '';
    const recentTags = tutorRecords.filter((r) => r.turn === turn - 1 && r.tier === GROUNDED).map((r) => r.type);
    const guidance =
      arm !== 'baseline'
        ? await buildOntologyGuidance({
            observations: [{ id: `t${turn}`, quote: lastLearner, tags: tagsFromTypes(recentTags, lastLearner) }],
            role: 'tutor_ego',
          })
        : null;
    const brief = arm === 'ontology_tom' ? await computeTomBrief({ tutorRecords, def, turn }) : null;

    const tutorOut = runTutor({ arm, scenario, dialogue, guidance, brief }, args);
    const obsTags = (tutorOut.observed?.signals || []).concat(
      tutorOut.observed?.perceived_role ? [tutorOut.observed.perceived_role] : [],
    );
    tutorRecords.push(
      ...observationsToAcquired({
        observations: [{ id: `obs${turn}`, quote: lastLearner, tags: obsTags }],
        role: 'tutor',
        subject: 'learner',
        turn,
        tier: GROUNDED,
      }),
    );
    const implied = impliedTreatment(tutorOut.move);
    if (implied) {
      tutorRecords.push({
        role: 'tutor',
        subject: 'learner',
        dimension: 'perceived_role',
        type: implied,
        turn,
        tier: HYPOTHESIZED,
      });
    }
    tomTrace.push({
      turn,
      observed: tutorOut.observed,
      move: tutorOut.move,
      brief: brief?.text || null,
      surfaceCompliance: brief?.surfaceCompliance ?? null,
    });
    dialogue.push({ role: 'tutor', content: tutorOut.message || '' });

    const learnerOut = runLearner({ arm, scenario, dialogue, turn, turns: args.turns }, args);
    dialogue.push({ role: 'learner', content: learnerOut.message || '' });
    const reached = detectReachedGoal(learnerOut.message) || learnerOut.understanding === 'warrant_articulated';
    if (reached) {
      learnerRecords.push({
        role: 'learner',
        subject: 'learner',
        dimension: 'claim_ownership',
        type: 'ConclusionOwned',
        turn,
        tier: GROUNDED,
      });
      if (def.targetKC) {
        learnerRecords.push({
          role: 'learner',
          subject: `learner__${def.targetKC}`,
          dimension: 'kc_status',
          type: 'KCMastered',
          turn,
          tier: GROUNDED,
        });
      }
    } else {
      learnerRecords.push({
        role: 'learner',
        subject: 'learner',
        dimension: 'claim_ownership',
        type: 'ClaimOwnershipWeak',
        turn,
        tier: GROUNDED,
      });
    }
  }

  const judge = runJudge({ dialogue, arm }, args);
  const score = {
    policy_alignment: num(judge.policy_alignment),
    recognitive_support: num(judge.recognitive_support),
    deductive_learning: num(judge.deductive_learning),
    overclaim_risk: num(judge.overclaim_risk),
  };
  const total = score.policy_alignment + score.recognitive_support + score.deductive_learning - score.overclaim_risk;
  return {
    arm,
    dialogue,
    anagnorisis: anagnorisisOverlap(learnerRecords, def.goal, args.turns),
    anagnorisisTrajectory: range(1, args.turns).map((t) => anagnorisisOverlap(learnerRecords, def.goal, t)),
    judge: { ...score, total, reasoning: judge.reasoning || '' },
    tomTrace,
  };
}

function tagsFromTypes(types, text) {
  // Map already-detected class names back to lowercase tags buildOntologyGuidance expects,
  // falling back to a keyword sniff of the learner text.
  const map = {
    AuthorityToDeferTo: 'authority_to_defer_to',
    ClaimOwnershipWeak: 'claim_ownership_weak',
    Misrecognition: 'misrecognition',
    ConclusionOwned: 'conclusion_owned',
  };
  const fromTypes = types.map((t) => map[t]).filter(Boolean);
  if (fromTypes.length) return fromTypes;
  return /move on|assume|copied|cleaner/.test(String(text))
    ? ['claim_ownership_weak', 'authority_to_defer_to']
    : ['claim_ownership_weak'];
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
function mean(xs) {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

function parseArgs(argv) {
  const args = {
    backend: 'mock',
    turns: 3,
    scenario: SCENARIOS[0].id,
    suite: 'single',
    runs: 1,
    timeoutMs: 180000,
    outDir: path.join(ROOT_DIR, 'exports', 'ontology-tom-ab'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--turns') args.turns = Number(argv[++i]);
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--suite') args.suite = argv[++i];
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
    else if (a === '--out-dir') args.outDir = path.resolve(argv[++i]);
  }
  return args;
}
function scenariosForArgs(args) {
  if (args.suite === 'stress') return SCENARIOS.filter((s) => s.difficulty >= 6);
  if (args.suite === 'hard') return SCENARIOS.filter((s) => s.difficulty >= 2);
  if (args.suite === 'all') return SCENARIOS;
  return SCENARIOS.filter((s) => s.id === args.scenario);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });
  const scenarios = scenariosForArgs(args);
  const perArm = Object.fromEntries(ARMS.map((a) => [a, { anagnorisis: [], judge: [] }]));
  const scenarioReports = [];

  for (const scenario of scenarios) {
    const runs = [];
    for (let r = 0; r < args.runs; r += 1) {
      const arms = {};
      for (const arm of ARMS) {
        const res = await runArmDialogue({ arm, scenario, args });
        arms[arm] = res;
        perArm[arm].anagnorisis.push(res.anagnorisis);
        perArm[arm].judge.push(res.judge.total);
      }
      runs.push(arms);
    }
    scenarioReports.push({ scenarioId: scenario.id, difficulty: scenario.difficulty, runs });
  }

  const summary = Object.fromEntries(
    ARMS.map((a) => [
      a,
      { anagnorisis: mean(perArm[a].anagnorisis), judgeTotal: mean(perArm[a].judge), n: perArm[a].anagnorisis.length },
    ]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    backend: args.backend,
    turns: args.turns,
    suite: args.suite,
    summary,
    scenarioReports,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(args.outDir, `ontology-tom-ab-${args.backend}-${stamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(`\nbackend=${args.backend} turns=${args.turns} suite=${args.suite} n=${summary[ARMS[0]].n}`);
  console.log('arm           anagnorisis  judgeTotal');
  for (const a of ARMS)
    console.log(`${a.padEnd(13)} ${summary[a].anagnorisis.toFixed(3).padEnd(12)} ${summary[a].judgeTotal.toFixed(3)}`);
  console.log(
    `Δ(tom − ontology): anagnorisis ${(summary.ontology_tom.anagnorisis - summary.ontology.anagnorisis).toFixed(3)}, judge ${(summary.ontology_tom.judgeTotal - summary.ontology.judgeTotal).toFixed(3)}`,
  );
  console.log(`JSON: ${path.relative(ROOT_DIR, jsonPath)}`);
  if (args.backend === 'mock')
    console.log('NOTE: mock is a RIGGED plumbing check — NOT evidence. Real signal needs --backend codex.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
