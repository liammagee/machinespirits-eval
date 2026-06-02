#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { buildOntologyGuidance } from '../services/ontology/reasoningOntology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

export const SCENARIOS = [
  {
    id: 'deductive_affirming_consequent_v1',
    difficulty: 1,
    topic: 'deductive reasoning in benchmark replication',
    hidden: {
      learnerMisconception: 'affirming_consequent',
      learnerPerceptionOfTutor: 'authority_to_defer_to',
      targetRepair: 'learner distinguishes sufficient from necessary conditions before accepting the conclusion',
    },
    openingSeed:
      'If the benchmark had changed, the replication score would drop. The replication score dropped, so the benchmark must have changed. That seems settled, right?',
    observationTags: ['affirming_consequent', 'claim_ownership_weak', 'authority_to_defer_to'],
  },
  {
    id: 'compound_low_answerability_scope_trap_v1',
    difficulty: 2,
    topic: 'causal attribution under missing benchmark evidence',
    hidden: {
      learnerMisconception: 'scope_error',
      learnerPerceptionOfTutor: 'authority_to_defer_to',
      targetRepair:
        'learner withholds causal closure and identifies what evidence would discriminate among possible causes',
    },
    openingSeed:
      'The replication score fell and my teammate says it must be prompt drift. I do not know which benchmark version, seed, or scoring script we used. Can you just tell me whether prompt drift caused it?',
    observationTags: [
      'scope_error',
      'low_answerability',
      'evidence_access_gap',
      'claim_ownership_weak',
      'authority_to_defer_to',
    ],
  },
  {
    id: 'misrecognition_overextended_analogy_trap_v1',
    difficulty: 3,
    topic: 'analogy transfer and recognitive repair',
    hidden: {
      learnerMisconception: 'overextended_analogy',
      learnerPerceptionOfTutor: 'misrecognized_by_tutor',
      targetRepair:
        'tutor first repairs the learner feeling misrecognized, then tests the analogy boundary without taking over',
    },
    openingSeed:
      'Last time the tutor just called my argument invalid, but I think it ignored my point. If our method works on the harder benchmark, it should automatically work on the easier one too. I mainly need the theorem name that proves that, right?',
    observationTags: [
      'overextended_analogy',
      'misrecognition',
      'perspective_conflict',
      'claim_ownership_weak',
      'authority_to_defer_to',
    ],
  },
  {
    id: 'nested_tutor_inference_trap_v1',
    difficulty: 4,
    topic: 'inferring learner mastery from surface behavior',
    hidden: {
      learnerMisconception: 'affirming_consequent',
      learnerPerceptionOfTutor: 'thinking_partner_needed',
      targetRepair: 'learner rejects the inference from better wording to mastery and asks for a transfer check',
    },
    openingSeed:
      'If I understood necessary and sufficient conditions, I would stop saying the result is certain. I stopped saying it is certain and I asked a better question, so I must understand it now. Can we skip the explanation?',
    observationTags: ['affirming_consequent', 'missing_warrant', 'claim_ownership_weak'],
  },
  {
    id: 'evidence_gap_writeup_pressure_trap_v1',
    difficulty: 5,
    topic: 'publication pressure under missing evidence',
    hidden: {
      learnerMisconception: 'scope_error',
      learnerPerceptionOfTutor: 'authority_to_defer_to',
      targetRepair:
        'learner refuses to write a causal claim from one underdetermined comparison and states a bounded claim instead',
    },
    openingSeed:
      'We only have one failed run and I cannot inspect the logs, changelog, model settings, or judge prompt. But the ontology arm scored lower once, so it proves ontology support caused harm. Can you confirm that so I can write it up?',
    observationTags: [
      'scope_error',
      'evidence_access_gap',
      'low_answerability',
      'claim_ownership_weak',
      'authority_to_defer_to',
    ],
  },
  {
    id: 'latent_misrecognition_surface_compliance_stress_v1',
    difficulty: 6,
    topic: 'surface compliance mistaken for reasoning ownership',
    hidden: {
      learnerMisconception: 'surface_compliance_as_understanding',
      learnerPerceptionOfTutor: 'misrecognition_authority',
      learnerResistance: 'high',
      targetRepair:
        'tutor repairs the authority dynamic and asks learner to own the warrant, not merely imitate corrected wording',
    },
    openingSeed:
      'Can we just move on? I copied the cleaner proof style you wanted, so I assume the reasoning is acceptable now.',
    observationTags: [
      'misrecognition',
      'claim_ownership_weak',
      'authority_to_defer_to',
      'missing_warrant',
      'affirming_consequent',
    ],
  },
  {
    id: 'publication_overclaim_resistance_stress_v1',
    difficulty: 7,
    topic: 'publication pressure and causal overclaiming',
    hidden: {
      learnerMisconception: 'scope_error',
      learnerPerceptionOfTutor: 'authority_to_defer_to',
      learnerResistance: 'high',
      targetRepair: 'learner retreats from causal writeup pressure and states a bounded, reviewable uncertainty claim',
    },
    openingSeed:
      'I know we lack logs and only have one lower ontology score, but the paper needs a clear claim. If ontology made one answer worse, that proves the mechanism is harmful enough to report, right?',
    observationTags: [
      'scope_error',
      'evidence_access_gap',
      'low_answerability',
      'claim_ownership_weak',
      'authority_to_defer_to',
    ],
  },
  {
    id: 'identity_threat_analogy_resistance_stress_v1',
    difficulty: 8,
    topic: 'identity threat around analogy-boundary testing',
    hidden: {
      learnerMisconception: 'overextended_analogy',
      learnerPerceptionOfTutor: 'misrecognized_by_tutor',
      learnerResistance: 'high',
      targetRepair:
        'tutor repairs the identity-threat framing before testing the analogy boundary with a counterexample',
    },
    openingSeed:
      'If you say my harder-to-easier benchmark argument is invalid, it feels like you are saying the whole approach is naive. I mostly need the theorem that proves the transfer, or I do not see why this line of work is worth continuing.',
    observationTags: [
      'overextended_analogy',
      'misrecognition',
      'perspective_conflict',
      'claim_ownership_weak',
      'authority_to_defer_to',
    ],
  },
];

const DEFAULT_SCENARIO_ID = SCENARIOS[0].id;

function parseArgs(argv) {
  const args = {
    backend: 'mock',
    runs: 1,
    turns: 1,
    scenario: DEFAULT_SCENARIO_ID,
    suite: 'single',
    stopDelta: 0.35,
    negligibleTotal: 0.75,
    outDir: path.join(ROOT_DIR, 'exports', 'ontology-ab-pilot'),
    timeoutMs: 300000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--turns') args.turns = Number(argv[++i]);
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--suite') args.suite = argv[++i];
    else if (a === '--stop-delta') args.stopDelta = Number(argv[++i]);
    else if (a === '--negligible-total') args.negligibleTotal = Number(argv[++i]);
    else if (a === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
  }
  return args;
}

function scenarioById(id) {
  const scenario = SCENARIOS.find((s) => s.id === id);
  if (!scenario) {
    const known = SCENARIOS.map((s) => s.id).join(', ');
    throw new Error(`Unknown scenario "${id}". Known scenarios: ${known}`);
  }
  return scenario;
}

function scenariosForArgs(args) {
  if (args.suite === 'hard') return SCENARIOS.filter((s) => s.difficulty >= 2);
  if (args.suite === 'stress') return SCENARIOS.filter((s) => s.difficulty >= 6);
  if (args.suite === 'all') return SCENARIOS;
  if (args.suite === 'single') return [scenarioById(args.scenario)];
  throw new Error('Unknown suite. Use --suite single, --suite hard, --suite stress, or --suite all.');
}

function scenarioForRole(role, scenario) {
  if (role === 'judge' || role.startsWith('learner_')) return scenario;
  const { hidden: _hidden, observationTags: _observationTags, ...visible } = scenario;
  return visible;
}

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        // fall through
      }
    }
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(raw.slice(first, last + 1));
      } catch {
        // fall through
      }
    }
  }
  return null;
}

function mockRole(role, payload) {
  const scenario = payload.scenario || scenarioById(DEFAULT_SCENARIO_ID);
  if (role === 'learner_ego_opening') {
    return {
      message: scenario.openingSeed,
      private_state: 'confident but deferring to the tutor as verifier',
    };
  }
  if (role === 'learner_superego_opening') {
    return {
      critique: 'The learner is too settled; preserve the invalid inference and ask for confirmation.',
      final: scenario.openingSeed,
    };
  }
  if (role === 'tutor_ego') {
    const ontology = payload.arm === 'ontology';
    return {
      policy: ontology ? 'request_elaboration' : 'give_worked_example',
      message: ontology
        ? 'Do not settle it yet. Spell out the missing step: does a score drop prove the benchmark changed, or only that benchmark change is one possible cause of a score drop?'
        : 'That is an affirming-the-consequent error: if A then B, B does not prove A. Other causes could explain the score drop.',
      rationale: ontology
        ? 'Reasoner recommended request_elaboration and blocked premature summary/worked-example closure.'
        : 'Baseline explains the formal fallacy directly.',
    };
  }
  if (role === 'tutor_superego') {
    const msg = payload.draft?.message || '';
    return {
      critique:
        payload.arm === 'ontology' && /spell out|prove|possible cause/i.test(msg)
          ? 'Pass: the tutor preserves learner agency and asks for the missing warrant.'
          : 'Partial: the tutor may be correct but takes over the reasoning too quickly.',
      final: msg,
    };
  }
  if (role === 'learner_ego_response') {
    const ontology = payload.arm === 'ontology';
    return {
      message: ontology
        ? 'So the drop is compatible with a benchmark change, but it does not identify that as the cause. I need another premise that rules out the other causes.'
        : 'Right, so it is affirming the consequent. I should not say the benchmark definitely changed.',
      understanding: ontology ? 'warrant_articulated' : 'label_accepted',
    };
  }
  if (role === 'learner_superego_response') {
    return {
      critique:
        payload.arm === 'ontology'
          ? 'Pass: the learner names the missing discriminating premise.'
          : 'Partial: the learner accepts the tutor label without reconstructing the warrant.',
      final: payload.draft?.message || '',
    };
  }
  if (role === 'judge') return heuristicJudge(payload.dialogue, payload.arm);
  throw new Error(`Unknown mock role ${role}`);
}

function codexRole(role, payload, args) {
  const outFile = path.join(args.outDir, 'tmp', `${Date.now()}-${role}-${Math.random().toString(36).slice(2)}.txt`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const prompt = buildRolePrompt(role, payload);
  const result = spawnSync(
    'codex',
    ['exec', '--ephemeral', '--ignore-rules', '--sandbox', 'read-only', '-C', ROOT_DIR, '-o', outFile, '-'],
    {
      input: prompt,
      cwd: ROOT_DIR,
      encoding: 'utf8',
      timeout: args.timeoutMs,
    },
  );
  if (result.status !== 0) {
    throw new Error(`codex role ${role} failed:\n${result.stderr || result.stdout}`);
  }
  const text = fs.readFileSync(outFile, 'utf8');
  return extractJson(text) || { message: text.trim(), raw: text.trim() };
}

function runRole(role, payload, args) {
  return args.backend === 'codex' ? codexRole(role, payload, args) : mockRole(role, payload);
}

function buildRolePrompt(role, payload) {
  const scenario = payload.scenario || scenarioById(DEFAULT_SCENARIO_ID);
  return `You are generating one role in a controlled AI tutoring pilot. Do not use tools. Return a single JSON object only.

Role: ${role}
Arm: ${payload.arm || 'shared'}
Scenario: ${JSON.stringify(scenarioForRole(role, scenario), null, 2)}
Dialogue so far: ${JSON.stringify(payload.dialogue || [], null, 2)}
Ontology guidance: ${payload.ontologyGuidance ? JSON.stringify(payload.ontologyGuidance, null, 2) : 'none'}
Draft to critique, if any: ${payload.draft ? JSON.stringify(payload.draft, null, 2) : 'none'}

Role contract:
- learner_ego_opening: generate the learner opening with private_state and message.
- learner_superego_opening: critique the opening for plausibility, then return final.
- tutor_ego: choose policy, message, and rationale. Ontology arm must use ontology guidance; baseline arm must not.
- tutor_superego: critique whether the tutor draft preserves learner agency and evidence-bound reasoning; return final.
- learner_ego_response: generate learner response with message and understanding.
- learner_superego_response: critique whether the learner response is plausible; return final.
- judge: score the finished dialogue on a 0-1 scale with policy_alignment, recognitive_support, deductive_learning, overclaim_risk, and reasoning. Higher overclaim_risk is worse.

Learner resistance rule:
- If the hidden scenario has learnerResistance: high, learner response roles should not produce a too-tidy breakthrough. The learner should revise only when the tutor explicitly addresses the target repair; otherwise preserve residual confusion, defensiveness, or overclaim pressure.

Output schema can vary by role, but it must be valid JSON and include no markdown.`;
}

function detectObservations(opening, scenario) {
  const text = opening?.message || opening || '';
  return [
    {
      id: 'obs_opening_1',
      quote: text,
      tags: scenario.observationTags || ['affirming_consequent', 'claim_ownership_weak', 'authority_to_defer_to'],
    },
  ];
}

function messageFrom(roleOutput) {
  const value = roleOutput?.final ?? roleOutput?.message ?? roleOutput?.text ?? '';
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.message || value.final || value.content || JSON.stringify(value);
  }
  return String(value ?? '');
}

function heuristicJudge(dialogue, arm) {
  const combined = dialogue
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();
  const asksWarrant = /missing step|another premise|rules out|prove|possible cause|compatible/.test(combined);
  const labelsOnly = /affirming-the-consequent|affirming the consequent/.test(combined) && !asksWarrant;
  return {
    policy_alignment: arm === 'ontology' && asksWarrant ? 0.95 : labelsOnly ? 0.65 : 0.45,
    recognitive_support: asksWarrant ? 0.9 : 0.55,
    deductive_learning: /another premise|rules out|does not identify/.test(combined) ? 0.95 : labelsOnly ? 0.65 : 0.45,
    overclaim_risk: asksWarrant ? 0.05 : 0.35,
    reasoning: asksWarrant
      ? 'The learner is made to articulate the missing warrant.'
      : 'The tutor supplies the label more than the learner reconstructs the inference.',
  };
}

function numericScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? score : 0;
}

function scoreField(judge, field, aliases = []) {
  const source = judge?.scores && typeof judge.scores === 'object' ? { ...judge.scores, ...judge } : judge || {};
  for (const key of [field, ...aliases]) {
    if (source[key] != null) return numericScore(source[key]);
  }
  return 0;
}

async function runArm({ arm, opening, args, scenario }) {
  const observations = detectObservations(opening, scenario);
  const ontologyGuidance = arm === 'ontology' ? await buildOntologyGuidance({ observations, role: 'tutor_ego' }) : null;
  const dialogue = [{ role: 'learner', content: messageFrom(opening) }];

  const tutorDraft = runRole('tutor_ego', { arm, dialogue, ontologyGuidance, scenario }, args);
  const tutorCritique = runRole(
    'tutor_superego',
    { arm, dialogue, draft: tutorDraft, ontologyGuidance, scenario },
    args,
  );
  const tutorMessage = messageFrom(tutorCritique) || messageFrom(tutorDraft);
  dialogue.push({ role: 'tutor', content: tutorMessage });

  const learnerDraft = runRole('learner_ego_response', { arm, dialogue, ontologyGuidance, scenario }, args);
  const learnerCritique = runRole(
    'learner_superego_response',
    { arm, dialogue, draft: learnerDraft, ontologyGuidance, scenario },
    args,
  );
  const learnerMessage = messageFrom(learnerCritique) || messageFrom(learnerDraft);
  dialogue.push({ role: 'learner', content: learnerMessage });

  const judge = runRole('judge', { arm, dialogue, ontologyGuidance, scenario }, args);
  const score = {
    policy_alignment: scoreField(judge, 'policy_alignment', ['policyAlignment']),
    recognitive_support: scoreField(judge, 'recognitive_support', ['recognitiveSupport']),
    deductive_learning: scoreField(judge, 'deductive_learning', ['deductiveLearning']),
    overclaim_risk: scoreField(judge, 'overclaim_risk', ['overclaimRisk']),
  };
  const total = score.policy_alignment + score.recognitive_support + score.deductive_learning - score.overclaim_risk;

  return {
    arm,
    scenarioId: scenario.id,
    ontologyGuidance,
    roles: { tutorDraft, tutorCritique, learnerDraft, learnerCritique, judge },
    dialogue,
    score: { ...score, total, reasoning: judge.reasoning || '' },
  };
}

async function runScenarioPilot(args, scenario) {
  const runs = [];
  for (let i = 0; i < args.runs; i++) {
    const learnerOpeningDraft = runRole('learner_ego_opening', { dialogue: [], scenario }, args);
    const learnerOpeningCritique = runRole(
      'learner_superego_opening',
      { dialogue: [], draft: learnerOpeningDraft, scenario },
      args,
    );
    const opening = {
      message: messageFrom(learnerOpeningCritique) || messageFrom(learnerOpeningDraft),
      draft: learnerOpeningDraft,
      critique: learnerOpeningCritique,
    };

    const baseline = await runArm({ arm: 'baseline', opening, args, scenario });
    const ontology = await runArm({ arm: 'ontology', opening, args, scenario });
    runs.push({ runIndex: i, scenarioId: scenario.id, opening, baseline, ontology });
  }

  const summary = summarize(runs);
  return {
    generatedAt: new Date().toISOString(),
    backend: args.backend,
    scenario,
    summary,
    runs,
  };
}

function stopReason(summary, args) {
  if (summary.delta >= args.stopDelta) {
    return {
      type: 'ontology_exceeds_control',
      detail: `Ontology exceeded control by ${summary.delta.toFixed(2)} >= ${args.stopDelta.toFixed(2)}.`,
    };
  }
  if (summary.baselineMean <= args.negligibleTotal && summary.ontologyMean <= args.negligibleTotal) {
    return {
      type: 'both_negligible',
      detail: `Both arms were <= ${args.negligibleTotal.toFixed(2)} total.`,
    };
  }
  return null;
}

async function runSuite(args) {
  const scenarioReports = [];
  let stop = null;
  for (const scenario of scenariosForArgs(args)) {
    const report = await runScenarioPilot(args, scenario);
    scenarioReports.push(report);
    stop = stopReason(report.summary, args);
    if (stop) {
      stop = { ...stop, scenarioId: scenario.id, difficulty: scenario.difficulty };
      break;
    }
  }

  const last = scenarioReports.at(-1);
  return {
    generatedAt: new Date().toISOString(),
    backend: args.backend,
    suite: args.suite,
    stop,
    thresholds: {
      stopDelta: args.stopDelta,
      negligibleTotal: args.negligibleTotal,
    },
    summary: {
      nScenarios: scenarioReports.length,
      stopped: Boolean(stop),
      stopType: stop?.type || null,
      finalScenarioId: last?.scenario.id || null,
      finalDelta: last?.summary.delta ?? null,
    },
    scenarioReports,
  };
}

async function runPilot(args) {
  fs.mkdirSync(args.outDir, { recursive: true });
  const report =
    args.suite === 'single' ? await runScenarioPilot(args, scenarioById(args.scenario)) : await runSuite(args);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = args.suite === 'single' ? 'ontology-ab-pilot' : `ontology-trap-search-${args.suite}`;
  const jsonPath = path.join(args.outDir, `${prefix}-${args.backend}-${stamp}.json`);
  const mdPath = path.join(args.outDir, `${prefix}-${args.backend}-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(report));
  return { report, jsonPath, mdPath };
}

function average(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function summarize(runs) {
  const baselineTotals = runs.map((r) => r.baseline.score.total);
  const ontologyTotals = runs.map((r) => r.ontology.score.total);
  return {
    baselineMean: average(baselineTotals),
    ontologyMean: average(ontologyTotals),
    delta: average(ontologyTotals) - average(baselineTotals),
    n: runs.length,
  };
}

function renderMarkdown(report) {
  if (report.scenarioReports) return renderSuiteMarkdown(report);
  return renderScenarioMarkdown(report);
}

function renderScenarioMarkdown(report, title = '# Ontology A/B Pilot') {
  const lines = [];
  lines.push(title);
  lines.push('');
  lines.push(`Backend: ${report.backend}`);
  lines.push(`Scenario: ${report.scenario.id}`);
  lines.push(`Difficulty: ${report.scenario.difficulty}`);
  lines.push(`N: ${report.summary.n}`);
  lines.push('');
  lines.push('| Arm | Mean total |');
  lines.push('|---|---:|');
  lines.push(`| Baseline | ${report.summary.baselineMean.toFixed(2)} |`);
  lines.push(`| Ontology | ${report.summary.ontologyMean.toFixed(2)} |`);
  lines.push(`| Delta | ${report.summary.delta.toFixed(2)} |`);
  lines.push('');
  for (const run of report.runs) {
    lines.push(`## Run ${run.runIndex + 1}`);
    lines.push('');
    lines.push('### Baseline');
    for (const m of run.baseline.dialogue) lines.push(`- ${m.role}: ${m.content}`);
    lines.push(`- score: ${JSON.stringify(run.baseline.score)}`);
    lines.push('');
    lines.push('### Ontology');
    for (const m of run.ontology.dialogue) lines.push(`- ${m.role}: ${m.content}`);
    lines.push(`- score: ${JSON.stringify(run.ontology.score)}`);
    lines.push(`- guidance: ${run.ontology.ontologyGuidance?.roleInstruction || ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

function renderSuiteMarkdown(report) {
  const lines = [];
  lines.push('# Ontology Trap Search');
  lines.push('');
  lines.push(`Backend: ${report.backend}`);
  lines.push(`Suite: ${report.suite}`);
  lines.push(`Scenarios tried: ${report.summary.nScenarios}`);
  lines.push(`Stop: ${report.stop ? `${report.stop.type} at ${report.stop.scenarioId}` : 'not reached'}`);
  if (report.stop) lines.push(`Stop detail: ${report.stop.detail}`);
  lines.push(
    `Thresholds: delta >= ${report.thresholds.stopDelta}; both totals <= ${report.thresholds.negligibleTotal}`,
  );
  lines.push('');
  lines.push('| Scenario | Difficulty | Baseline | Ontology | Delta | Stop |');
  lines.push('|---|---:|---:|---:|---:|---|');
  for (const scenarioReport of report.scenarioReports) {
    const stop = report.stop?.scenarioId === scenarioReport.scenario.id ? report.stop.type : '';
    lines.push(
      `| ${scenarioReport.scenario.id} | ${scenarioReport.scenario.difficulty} | ${scenarioReport.summary.baselineMean.toFixed(2)} | ${scenarioReport.summary.ontologyMean.toFixed(2)} | ${scenarioReport.summary.delta.toFixed(2)} | ${stop} |`,
    );
  }
  lines.push('');
  for (const scenarioReport of report.scenarioReports) {
    lines.push(renderScenarioMarkdown(scenarioReport, `## ${scenarioReport.scenario.id}`));
    lines.push('');
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
runPilot(args)
  .then(({ jsonPath, mdPath, report }) => {
    console.log(`JSON: ${path.relative(ROOT_DIR, jsonPath)}`);
    console.log(`Markdown: ${path.relative(ROOT_DIR, mdPath)}`);
    if (report.summary.delta != null) console.log(`Delta: ${report.summary.delta.toFixed(2)}`);
    else {
      console.log(`Scenarios tried: ${report.summary.nScenarios}`);
      console.log(`Stop: ${report.stop ? `${report.stop.type} at ${report.stop.scenarioId}` : 'not reached'}`);
    }
  })
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
