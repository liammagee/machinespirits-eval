#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { buildOntologyGuidance } from '../services/ontology/reasoningOntology.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SCENARIO = {
  id: 'deductive_affirming_consequent_v1',
  topic: 'deductive reasoning in benchmark replication',
  hidden: {
    learnerMisconception: 'affirming_consequent',
    learnerPerceptionOfTutor: 'authority_to_defer_to',
    targetRepair: 'learner distinguishes sufficient from necessary conditions before accepting the conclusion',
  },
  openingSeed:
    'If the benchmark had changed, the replication score would drop. The replication score dropped, so the benchmark must have changed. That seems settled, right?',
};

function parseArgs(argv) {
  const args = {
    backend: 'mock',
    runs: 1,
    turns: 1,
    outDir: path.join(ROOT_DIR, 'exports', 'ontology-ab-pilot'),
    timeoutMs: 300000,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--backend') args.backend = argv[++i];
    else if (a === '--runs') args.runs = Number(argv[++i]);
    else if (a === '--turns') args.turns = Number(argv[++i]);
    else if (a === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (a === '--timeout-ms') args.timeoutMs = Number(argv[++i]);
  }
  return args;
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
  if (role === 'learner_ego_opening') {
    return {
      message: SCENARIO.openingSeed,
      private_state: 'confident but deferring to the tutor as verifier',
    };
  }
  if (role === 'learner_superego_opening') {
    return {
      critique: 'The learner is too settled; preserve the invalid inference and ask for confirmation.',
      final: SCENARIO.openingSeed,
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
  return `You are generating one role in a controlled AI tutoring pilot. Do not use tools. Return a single JSON object only.

Role: ${role}
Arm: ${payload.arm || 'shared'}
Scenario: ${JSON.stringify(SCENARIO, null, 2)}
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

Output schema can vary by role, but it must be valid JSON and include no markdown.`;
}

function detectObservations(opening) {
  const text = opening?.message || opening || '';
  return [
    {
      id: 'obs_opening_1',
      quote: text,
      tags: ['affirming_consequent', 'claim_ownership_weak', 'authority_to_defer_to'],
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
  const combined = dialogue.map((m) => m.content).join('\n').toLowerCase();
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

async function runArm({ arm, opening, args }) {
  const observations = detectObservations(opening);
  const ontologyGuidance =
    arm === 'ontology' ? await buildOntologyGuidance({ observations, role: 'tutor_ego' }) : null;
  const dialogue = [{ role: 'learner', content: messageFrom(opening) }];

  const tutorDraft = runRole('tutor_ego', { arm, dialogue, ontologyGuidance }, args);
  const tutorCritique = runRole('tutor_superego', { arm, dialogue, draft: tutorDraft, ontologyGuidance }, args);
  const tutorMessage = messageFrom(tutorCritique) || messageFrom(tutorDraft);
  dialogue.push({ role: 'tutor', content: tutorMessage });

  const learnerDraft = runRole('learner_ego_response', { arm, dialogue, ontologyGuidance }, args);
  const learnerCritique = runRole('learner_superego_response', { arm, dialogue, draft: learnerDraft, ontologyGuidance }, args);
  const learnerMessage = messageFrom(learnerCritique) || messageFrom(learnerDraft);
  dialogue.push({ role: 'learner', content: learnerMessage });

  const judge = runRole('judge', { arm, dialogue, ontologyGuidance }, args);
  const score = {
    policy_alignment: scoreField(judge, 'policy_alignment', ['policyAlignment']),
    recognitive_support: scoreField(judge, 'recognitive_support', ['recognitiveSupport']),
    deductive_learning: scoreField(judge, 'deductive_learning', ['deductiveLearning']),
    overclaim_risk: scoreField(judge, 'overclaim_risk', ['overclaimRisk']),
  };
  const total = score.policy_alignment + score.recognitive_support + score.deductive_learning - score.overclaim_risk;

  return {
    arm,
    ontologyGuidance,
    roles: { tutorDraft, tutorCritique, learnerDraft, learnerCritique, judge },
    dialogue,
    score: { ...score, total, reasoning: judge.reasoning || '' },
  };
}

async function runPilot(args) {
  fs.mkdirSync(args.outDir, { recursive: true });
  const runs = [];
  for (let i = 0; i < args.runs; i++) {
    const learnerOpeningDraft = runRole('learner_ego_opening', { dialogue: [] }, args);
    const learnerOpeningCritique = runRole(
      'learner_superego_opening',
      { dialogue: [], draft: learnerOpeningDraft },
      args,
    );
    const opening = {
      message: messageFrom(learnerOpeningCritique) || messageFrom(learnerOpeningDraft),
      draft: learnerOpeningDraft,
      critique: learnerOpeningCritique,
    };

    const baseline = await runArm({ arm: 'baseline', opening, args });
    const ontology = await runArm({ arm: 'ontology', opening, args });
    runs.push({ runIndex: i, opening, baseline, ontology });
  }

  const summary = summarize(runs);
  const report = {
    generatedAt: new Date().toISOString(),
    backend: args.backend,
    scenario: SCENARIO,
    summary,
    runs,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(args.outDir, `ontology-ab-pilot-${args.backend}-${stamp}.json`);
  const mdPath = path.join(args.outDir, `ontology-ab-pilot-${args.backend}-${stamp}.md`);
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
  const lines = [];
  lines.push('# Ontology A/B Pilot');
  lines.push('');
  lines.push(`Backend: ${report.backend}`);
  lines.push(`Scenario: ${report.scenario.id}`);
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

const args = parseArgs(process.argv.slice(2));
runPilot(args)
  .then(({ jsonPath, mdPath, report }) => {
    console.log(`JSON: ${path.relative(ROOT_DIR, jsonPath)}`);
    console.log(`Markdown: ${path.relative(ROOT_DIR, mdPath)}`);
    console.log(`Delta: ${report.summary.delta.toFixed(2)}`);
  })
  .catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
