#!/usr/bin/env node
/**
 * Model-invariance follow-up for the yoked-contingency causal test.
 *
 * This wrapper keeps the frozen G1 plan artifact as the primary input, can
 * regenerate G1 plans with non-Codex planners, and runs the same hard-transfer
 * G2 endpoint across held-out learner models.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backendDetail, canonicalBackend, fmt } from './run-yoked-contingency-g0-paid-smoke.js';
import { runG1PaidSmoke, writeG1PaidSmokeArtifacts } from './run-yoked-contingency-g1-paid-smoke.js';
import {
  runG2IndependentOutcome,
  writeG2IndependentOutcomeArtifacts,
} from './run-yoked-contingency-g2-independent-outcome.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  g1Json: path.join(ROOT, 'exports', 'yoked-contingency-g1-scaled.json'),
  learnerBackends: ['mock'],
  plannerBackends: [],
  includeFrozen: true,
  learnerProtocol: 'rule-transfer-novice',
  posttestProfile: 'hard-transfer',
  sessionLimit: 1,
  maxCallsPerRun: 3,
  maxPlanCalls: 3,
  planTurns: 4,
  outDir: path.join(ROOT, 'exports', 'yoked-contingency-model-invariance'),
};

function csv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function slugify(value) {
  return (
    String(value || 'none')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'none'
  );
}

export function parseArgs(argv) {
  const args = { ...DEFAULTS, write: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--g1-json') args.g1Json = argv[++i];
    else if (a === '--learner-backends') args.learnerBackends = csv(argv[++i]);
    else if (a === '--planner-backends') args.plannerBackends = csv(argv[++i]);
    else if (a === '--learner-protocol') args.learnerProtocol = argv[++i];
    else if (a === '--posttest-profile') args.posttestProfile = argv[++i];
    else if (a === '--session-limit') args.sessionLimit = Number(argv[++i]);
    else if (a === '--max-calls-per-run') args.maxCallsPerRun = Number(argv[++i]);
    else if (a === '--max-plan-calls') args.maxPlanCalls = Number(argv[++i]);
    else if (a === '--plan-turns') args.planTurns = Number(argv[++i]);
    else if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--skip-frozen') args.includeFrozen = false;
    else if (a === '--dry-run') {
      args.learnerBackends = ['mock'];
      args.plannerBackends = [];
    } else if (a === '--no-write') args.write = false;
    else if (a === '-h' || a === '--help') {
      console.log(`Usage: node scripts/run-yoked-contingency-model-invariance.js [options]

Options:
  --g1-json <path>                         Frozen G1 artifact (default: exports/yoked-contingency-g1-scaled.json)
  --learner-backends <csv>                 Held-out learner backends, e.g. claude-code:haiku,claude-code:sonnet,openrouter
  --planner-backends <csv>                 Optional G1 planner regeneration backends
  --learner-protocol <rule-transfer-novice|calibrated-novice|standard>
  --posttest-profile <hard-transfer|pilot>
  --session-limit <n>                      First-N G1 sessions per G2 run (default: 1)
  --max-calls-per-run <n>                  G2 model-call cap per learner/backend cell (default: 3)
  --max-plan-calls <n>                     G1 model-call cap per regenerated planner (default: 3)
  --plan-turns <n>                         G1 plan turns for regenerated planners (default: 4)
  --out-dir <path>                         Artifact directory
  --skip-frozen                            Do not evaluate the frozen G1 artifact
  --dry-run                                Mock learner only; no model calls
  --no-write                               Return result without writing artifacts`);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${a}`);
    }
  }
  if (!args.learnerBackends.length) throw new Error('--learner-backends must include at least one backend');
  if (!Number.isInteger(args.sessionLimit) || args.sessionLimit < 1)
    throw new Error('--session-limit must be a positive integer');
  if (!Number.isInteger(args.maxCallsPerRun) || args.maxCallsPerRun < 1) {
    throw new Error('--max-calls-per-run must be a positive integer');
  }
  if (!Number.isInteger(args.maxPlanCalls) || args.maxPlanCalls < 1)
    throw new Error('--max-plan-calls must be a positive integer');
  if (!Number.isInteger(args.planTurns) || args.planTurns < 1)
    throw new Error('--plan-turns must be a positive integer');
  return args;
}

export function classifyG2Boundary(result) {
  if (!result) return 'runtime_error';
  const s = result.summary;
  if (s.invalidAnswerCount > 0) return 'boundary_invalid_answers';
  if (s.promptFamilyLabelLeakCount > 0) return 'boundary_hidden_label_leak';
  if (s.delta2_diagnosis <= 0) return 'boundary_same_state_not_above_different_state';
  if (s.sameGreaterSessionCount < result.thresholds.requiredSameGreaterSessionCount) {
    return 'boundary_session_sign_not_preserved';
  }
  if (result.thresholds.scaledSignTestPMax !== null && s.signTestOneSidedP > result.thresholds.scaledSignTestPMax) {
    return 'boundary_scaled_sign_test';
  }
  return 'supports_invariance_endpoint';
}

function summarizeG2(result) {
  const s = result.summary;
  return {
    status: result.status,
    boundaryClass: classifyG2Boundary(result),
    sessionCount: s.sessionCount,
    sourceSessionCount: s.sourceSessionCount,
    modelCalls: s.modelCalls.total,
    delta1_responsiveness: s.delta1_responsiveness,
    delta2_diagnosis: s.delta2_diagnosis,
    sameGreaterSessionCount: s.sameGreaterSessionCount,
    signTestOneSidedP: s.signTestOneSidedP,
    invalidAnswerCount: s.invalidAnswerCount,
    promptFamilyLabelLeakCount: s.promptFamilyLabelLeakCount,
  };
}

async function buildPlanArtifacts({
  g1Json,
  plannerBackends,
  includeFrozen,
  outDir,
  sessionLimit,
  maxPlanCalls,
  planTurns,
  items,
  write,
}) {
  const artifacts = [];
  if (includeFrozen) {
    if (typeof g1Json === 'string' && !fs.existsSync(g1Json)) {
      throw new Error(`frozen G1 artifact not found: ${g1Json}`);
    }
    artifacts.push({
      label: 'frozen_g1',
      kind: 'frozen',
      backend: null,
      backendDetail: null,
      g1Json,
      jsonPath: typeof g1Json === 'string' ? path.relative(ROOT, path.resolve(g1Json)) : 'in_memory',
    });
  }

  for (const plannerBackend of plannerBackends) {
    const plannerSlug = slugify(plannerBackend);
    const planOutDir = path.join(outDir, 'g1-plans');
    const outJson = path.join(planOutDir, `${plannerSlug}.json`);
    const outMd = path.join(planOutDir, `${plannerSlug}.md`);
    const g1 = await runG1PaidSmoke({
      backend: plannerBackend,
      sessions: sessionLimit,
      planTurns,
      maxCalls: maxPlanCalls,
      items: items || undefined,
    });
    artifacts.push({
      label: `regenerated_${plannerSlug}`,
      kind: 'regenerated',
      backend: canonicalBackend(plannerBackend),
      backendDetail: backendDetail(plannerBackend),
      g1Json: g1,
      jsonPath: path.relative(ROOT, outJson),
      summary: g1.summary,
      status: g1.status,
    });
    if (write) writeG1PaidSmokeArtifacts({ result: g1, outJson, outMd });
  }
  return artifacts;
}

export async function runModelInvarianceMatrix({
  g1Json = DEFAULTS.g1Json,
  learnerBackends = DEFAULTS.learnerBackends,
  plannerBackends = DEFAULTS.plannerBackends,
  includeFrozen = DEFAULTS.includeFrozen,
  learnerProtocol = DEFAULTS.learnerProtocol,
  posttestProfile = DEFAULTS.posttestProfile,
  sessionLimit = DEFAULTS.sessionLimit,
  maxCallsPerRun = DEFAULTS.maxCallsPerRun,
  maxPlanCalls = DEFAULTS.maxPlanCalls,
  planTurns = DEFAULTS.planTurns,
  outDir = DEFAULTS.outDir,
  write = true,
  items = null,
} = {}) {
  const startedAt = new Date().toISOString();
  if (write) fs.mkdirSync(outDir, { recursive: true });
  const planArtifacts = await buildPlanArtifacts({
    g1Json,
    plannerBackends,
    includeFrozen,
    outDir,
    sessionLimit,
    maxPlanCalls,
    planTurns,
    items,
    write,
  });

  const rows = [];
  for (const plan of planArtifacts) {
    for (const learnerBackend of learnerBackends) {
      const rowSlug = `${slugify(plan.label)}__${slugify(learnerBackend)}`;
      const outJson = path.join(outDir, 'g2-runs', `${rowSlug}.json`);
      const outMd = path.join(outDir, 'g2-runs', `${rowSlug}.md`);
      try {
        const g2 = await runG2IndependentOutcome({
          g1Json: plan.g1Json,
          backend: learnerBackend,
          learnerProtocol,
          posttestProfile,
          sessionLimit,
          maxCalls: maxCallsPerRun,
          items,
        });
        if (write) writeG2IndependentOutcomeArtifacts({ result: g2, outJson, outMd });
        rows.push({
          planLabel: plan.label,
          planKind: plan.kind,
          planBackend: plan.backend,
          planBackendDetail: plan.backendDetail,
          planJson: plan.jsonPath,
          learnerBackend: canonicalBackend(learnerBackend),
          learnerBackendDetail: backendDetail(learnerBackend),
          artifactJson: path.relative(ROOT, outJson),
          artifactMd: path.relative(ROOT, outMd),
          summary: summarizeG2(g2),
        });
      } catch (err) {
        rows.push({
          planLabel: plan.label,
          planKind: plan.kind,
          planBackend: plan.backend,
          planBackendDetail: plan.backendDetail,
          planJson: plan.jsonPath,
          learnerBackend: canonicalBackend(learnerBackend),
          learnerBackendDetail: backendDetail(learnerBackend),
          artifactJson: path.relative(ROOT, outJson),
          artifactMd: path.relative(ROOT, outMd),
          summary: {
            status: 'runtime_error',
            boundaryClass: 'boundary_runtime_or_infra_failure',
            error: String(err?.message || err),
          },
        });
      }
    }
  }

  const supportedRows = rows.filter((row) => row.summary.boundaryClass === 'supports_invariance_endpoint');
  const status =
    rows.length > 0 && supportedRows.length === rows.length
      ? 'pass_model_invariance_matrix'
      : supportedRows.length > 0
        ? 'mixed_model_invariance_boundary'
        : 'fail_model_invariance_matrix';
  const result = {
    schema: 'yoked_contingency_model_invariance_matrix_v0_1',
    generatedAt: new Date().toISOString(),
    startedAt,
    status,
    boundary:
      'model-invariance follow-up only; failures are boundary evidence until replicated at scaled N and integrated into paper-full-2.0.md',
    plan: 'PLAN_2_0/yoked-contingency-model-invariance-plan.md',
    controls: {
      learnerProtocol,
      posttestProfile,
      sessionLimit,
      maxCallsPerRun,
      maxPlanCalls,
      planTurns,
      includeFrozen,
    },
    planArtifacts: planArtifacts.map(({ g1Json: _g1Json, ...artifact }) => artifact),
    rows,
    summary: {
      rowCount: rows.length,
      supportCount: supportedRows.length,
      boundaryCount: rows.length - supportedRows.length,
      learnerBackends: learnerBackends.map((backend) => backendDetail(backend)),
      plannerBackends: plannerBackends.map((backend) => backendDetail(backend)),
    },
  };
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'matrix.json'), `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, 'matrix.md'), renderModelInvarianceReport(result));
  }
  return result;
}

export function renderModelInvarianceReport(result) {
  const lines = [];
  lines.push('# Yoked-contingency model-invariance matrix');
  lines.push('');
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push(`Status: ${result.status}`);
  lines.push('');
  lines.push(`Boundary: ${result.boundary}.`);
  lines.push('');
  lines.push('## Five-step protocol');
  lines.push('');
  lines.push('1. Keep the frozen G1 plan artifact as a condition.');
  lines.push('2. Re-run G2 with held-out learner model variants.');
  lines.push('3. Optionally regenerate G1 plans with non-Codex planners.');
  lines.push('4. Use the same hard-transfer, rule-transfer endpoint and require same-state > different-state.');
  lines.push('5. Record non-passes as boundary evidence.');
  lines.push('');
  lines.push('## Controls');
  lines.push('');
  lines.push(`- Learner protocol: ${result.controls.learnerProtocol}`);
  lines.push(`- Posttest profile: ${result.controls.posttestProfile}`);
  lines.push(`- Session limit: ${result.controls.sessionLimit}`);
  lines.push(`- G2 max calls per row: ${result.controls.maxCallsPerRun}`);
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  lines.push('| Plan | Learner | Boundary class | Status | Sessions | delta2 | same > different | Invalid | Leaks |');
  lines.push('|---|---|---|---|---:|---:|---:|---:|---:|');
  for (const row of result.rows) {
    const s = row.summary;
    lines.push(
      `| ${row.planLabel} | ${row.learnerBackendDetail?.label || row.learnerBackend} | ${s.boundaryClass} | ${s.status} | ${
        s.sessionCount ?? 'n/a'
      } | ${typeof s.delta2_diagnosis === 'number' ? fmt(s.delta2_diagnosis) : 'n/a'} | ${
        s.sameGreaterSessionCount ?? 'n/a'
      } | ${s.invalidAnswerCount ?? 'n/a'} | ${s.promptFamilyLabelLeakCount ?? 'n/a'} |`,
    );
  }
  lines.push('');
  lines.push('## Read');
  lines.push('');
  if (result.status === 'pass_model_invariance_matrix') {
    lines.push('Every matrix row preserved the same-state advantage on the frozen endpoint.');
  } else {
    lines.push(
      'This is not yet a model-invariant main-paper claim. The non-supporting rows identify model or infrastructure boundaries that must be explained or resolved before scaling.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runModelInvarianceMatrix(args);
  if (args.write) {
    console.log(`wrote ${path.join(args.outDir, 'matrix.json')}`);
    console.log(`wrote ${path.join(args.outDir, 'matrix.md')}`);
  }
  console.log(`${result.status}: support=${result.summary.supportCount}/${result.summary.rowCount}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
