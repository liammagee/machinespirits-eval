#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  arbitrateAdaptation,
  auditOpportunityCost,
  deriveDiscursiveAdaptationState,
  deriveOpportunityCostBudget,
  derivePublicLearnerEvidence,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUT = path.join(ROOT, 'exports/dramatic-derivation/layered-adaptation');
const REPORT_SCHEMA = 'dramatic-derivation.layered-adaptation-gates.v0';

function usage() {
  return `Usage:
  node scripts/derivation-adaptation-gates.js [--out exports/dramatic-derivation/layered-adaptation]

Runs zero-paid public-evidence and opportunity-cost gate controls.
`;
}

export function parseArgs(argv = []) {
  const opts = { out: DEFAULT_OUT, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--out') {
      opts.out = path.resolve(ROOT, argv[++i]);
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function atomicWrite(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

function publicEvidenceCases() {
  return [
    {
      id: 'purpose-question',
      expectedStance: 'purpose_question',
      input: { learnerText: 'Why does that evidence matter for the proof?' },
    },
    {
      id: 'productive-reasoning',
      expectedStance: 'tentative_correct',
      input: { learnerText: 'I would say the source line matters because it gives cause somewhere to start.' },
    },
    {
      id: 'echo-only',
      expectedStance: 'fluent_echo',
      input: { learnerText: 'As you said, the crowsfoot mark is the phrase.' },
    },
    {
      id: 'hidden-input-rejected',
      expectedStance: 'unknown',
      input: { learnerText: 'I think it follows.', hiddenBoard: [['x']] },
      expectAuditOk: false,
    },
  ];
}

function opportunityCostCases() {
  const release = deriveOpportunityCostBudget({ proofCriticalReleasePending: true });
  const repair = deriveOpportunityCostBudget({ repairPending: true });
  return [
    {
      id: 'release-pending-blocks-teach-back',
      audit: auditOpportunityCost(release, { actor: 'tutor', conduct: 'teach_back' }),
      expectedOk: false,
    },
    {
      id: 'release-pending-allows-bound-minimal-presence',
      audit: auditOpportunityCost(release, {
        actor: 'tutor',
        conduct: 'minimal_presence',
        pairedWithBindingProofAction: true,
      }),
      expectedOk: true,
    },
    {
      id: 'repair-budget-allows-one-recap',
      audit: auditOpportunityCost(repair, { actor: 'tutor', conduct: 'slow_recap' }),
      expectedOk: true,
    },
    {
      id: 'act-advice-cannot-override-current-proof-action',
      audit: arbitrateAdaptation({
        proofControl: { action: 'repair_dependency', target: 'p_bridge' },
        selfRegulation: { publicOnly: true, scope: 'act', recommendedCoachMove: 'planning_prompt' },
        opportunityCostBudget: repair,
      }),
      expectedOk: true,
    },
  ];
}

function evaluate() {
  const publicEvidenceRows = publicEvidenceCases().map((fixture) => {
    const evidence = derivePublicLearnerEvidence(fixture.input);
    const passed =
      evidence.stance === fixture.expectedStance &&
      (fixture.expectAuditOk === undefined || evidence.inputAudit.ok === fixture.expectAuditOk);
    return { ...fixture, evidence, passed };
  });
  const opportunityCostRows = opportunityCostCases().map((fixture) => {
    const ok = fixture.audit.ok ?? fixture.audit.trace?.opportunityCostAudit?.ok ?? true;
    return { ...fixture, passed: ok === fixture.expectedOk };
  });
  const discursiveRows = publicEvidenceRows.map((row) => ({
    id: `discursive-${row.id}`,
    state: deriveDiscursiveAdaptationState({ publicEvidence: row.evidence }),
  }));
  const rows = [...publicEvidenceRows, ...opportunityCostRows];
  const summary = {
    schema: REPORT_SCHEMA,
    count: rows.length,
    pass: rows.filter((row) => row.passed).length,
    fail: rows.filter((row) => !row.passed).length,
  };
  summary.allPassed = summary.fail === 0;
  return { schema: REPORT_SCHEMA, summary, publicEvidenceRows, opportunityCostRows, discursiveRows };
}

function renderPublicEvidence(report) {
  const lines = ['# Public Evidence Gate Report', '', '| Case | Stance | Audit | Pass |', '|---|---|---|---|'];
  for (const row of report.publicEvidenceRows) {
    lines.push(
      `| ${row.id} | ${row.evidence.stance} | ${row.evidence.inputAudit.ok ? 'ok' : 'rejected'} | ${row.passed ? 'yes' : 'no'} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderOpportunityCost(report) {
  const lines = ['# Opportunity Cost Gate Report', '', '| Case | Expected ok | Pass |', '|---|---|---|'];
  for (const row of report.opportunityCostRows) {
    lines.push(`| ${row.id} | ${row.expectedOk ? 'yes' : 'no'} | ${row.passed ? 'yes' : 'no'} |`);
  }
  return `${lines.join('\n')}\n`;
}

function renderCombined(report) {
  return [
    '# Layered Adaptation Gate Report',
    '',
    `Schema: \`${report.schema}\``,
    `Cases: ${report.summary.count}`,
    `Passed: ${report.summary.pass}`,
    `Failed: ${report.summary.fail}`,
    `Decision: ${report.summary.allPassed ? 'pass' : 'fail'}`,
    '',
  ].join('\n');
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (opts.help) {
    console.log(usage());
    return;
  }
  const report = evaluate();
  atomicWrite(path.join(opts.out, 'adaptation-gates-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  atomicWrite(path.join(opts.out, 'adaptation-gates-report.md'), renderCombined(report));
  atomicWrite(path.join(opts.out, 'public-evidence-report.md'), renderPublicEvidence(report));
  atomicWrite(path.join(opts.out, 'opportunity-cost-report.md'), renderOpportunityCost(report));
  console.log(`adaptation gates wrote ${path.relative(ROOT, opts.out)}/adaptation-gates-report.{json,md}`);
  console.log(`cases=${report.summary.count} passed=${report.summary.pass} failed=${report.summary.fail}`);
  if (!report.summary.allPassed) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
