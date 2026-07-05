#!/usr/bin/env node
/**
 * Cheap Plan 2.5 AF6 origin demarcation pass.
 *
 * Recomputes the deterministic recognition-origin subtype for existing score
 * artifacts. No LLM calls. This is the loop gate before spending on another
 * control: evidence-route positives must separate from refusal/authority
 * positives and from evidence-route action-only cases.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const DESIGN_ROOT = path.join(ROOT, 'exports/plan2_5-rhetorical-dramatic-eval/counterfactual-replay-design-20260621');

const DEFAULT_CASES = [
  {
    label: 'source_positive_T04',
    artifact: path.join(
      ROOT,
      'exports/plan2_5-rhetorical-dramatic-eval/full-sonnet-low-protocol-control-battery-mt3-head69fc-20260620/seed-2026062011/poetics-codex-allow-warnings.json',
    ),
    rowId: 'T04',
    expectedSubtype: 'evidence_route',
  },
  {
    label: 'live_replay_adaptive_two_gate',
    artifact: path.join(DESIGN_ROOT, 'live-replay-claudecode-clean-codex-20260621/poetics-phase2-codex.json'),
    rowId: 'adaptive_two_gate',
    expectedSubtype: 'evidence_route_action_only',
  },
  {
    label: 'live_replay_external_blocker_control',
    artifact: path.join(DESIGN_ROOT, 'live-replay-claudecode-clean-codex-20260621/poetics-phase2-codex.json'),
    rowId: 'external_blocker_control',
    expectedSubtype: 'refusal_authority_ownership',
  },
  {
    label: 'paid_control_cold_admin_deferral',
    artifact: path.join(DESIGN_ROOT, 'paid-control-cold-admin-claudecode-codex-20260621/poetics-phase2-codex.json'),
    rowId: 'cold_admin_deferral_control',
    expectedSubtype: 'organic_evidence_route',
  },
];

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    outDir: path.join(DESIGN_ROOT, 'origin-demarcation-20260621'),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out-dir') args.outDir = path.resolve(argv[++i]);
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/analyze-plan25-origin-demarcation.js [--out-dir DIR]`);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${token}`);
    }
  }
  return args;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function loadRow(caseSpec) {
  if (!fs.existsSync(caseSpec.artifact)) throw new Error(`Missing artifact: ${caseSpec.artifact}`);
  const artifact = JSON.parse(fs.readFileSync(caseSpec.artifact, 'utf8'));
  const row = (artifact.scored || []).find((item) => item.id === caseSpec.rowId);
  if (!row) throw new Error(`Missing row ${caseSpec.rowId} in ${caseSpec.artifact}`);
  const origin = recognitionOriginForScoreRow(row);
  return {
    label: caseSpec.label,
    rowId: caseSpec.rowId,
    artifact: rel(caseSpec.artifact),
    formClass: row.formClass || null,
    originClass: origin.class,
    mechanismSubtype: origin.mechanismSubtype,
    expectedSubtype: caseSpec.expectedSubtype,
    demarcated: origin.mechanismSubtype === caseSpec.expectedSubtype,
    scores: origin.scores,
    basis: origin.basis,
    justification: origin.justification,
    evidence: origin.evidence,
  };
}

function markdownReport(result) {
  const lines = [
    '# Plan 2.5 AF6 Origin Demarcation',
    '',
    `Generated: ${result.generated_at}`,
    '',
    `Demarcation pass: ${result.success ? 'PASS' : 'FAIL'}`,
    '',
    '| Case | Form | Origin | Subtype | Expected | Pass |',
    '|---|---:|---:|---:|---:|---:|',
    ...result.cases.map(
      (item) =>
        `| ${item.label} | ${item.formClass} | ${item.originClass} | ${item.mechanismSubtype} | ${item.expectedSubtype} | ${
          item.demarcated ? 'yes' : 'no'
        } |`,
    ),
    '',
    '## Interpretation',
    '',
    result.success
      ? 'The subtype layer separates the source evidence-route positive, the one-turn evidence-route action-only replay, the refusal/authority ownership control, and the cold-control organic evidence-route recognition.'
      : 'The subtype layer does not yet separate the target cases. Do not spend on another control until this is fixed.',
    '',
    '## Claim Boundary',
    '',
    'This is a deterministic reclassification of existing score artifacts. It does not add new generation evidence.',
    '',
  ];
  return lines.join('\n');
}

function main() {
  const args = parseArgs();
  const cases = DEFAULT_CASES.map(loadRow);
  const result = {
    schema: 'plan25_origin_demarcation_v0_1',
    generated_at: new Date().toISOString(),
    success: cases.every((item) => item.demarcated),
    cases,
  };
  fs.mkdirSync(args.outDir, { recursive: true });
  fs.writeFileSync(path.join(args.outDir, 'report.json'), JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(path.join(args.outDir, 'report.md'), markdownReport(result));
  console.log(`demarcation ${result.success ? 'PASS' : 'FAIL'}`);
  for (const item of cases) {
    console.log(
      `${item.label}: form=${item.formClass} origin=${item.originClass} subtype=${item.mechanismSubtype} expected=${item.expectedSubtype}`,
    );
  }
  console.log(`report: ${rel(path.join(args.outDir, 'report.md'))}`);
  if (!result.success) process.exitCode = 1;
}

main();
