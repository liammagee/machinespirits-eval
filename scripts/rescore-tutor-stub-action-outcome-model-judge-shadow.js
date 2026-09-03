#!/usr/bin/env node
/**
 * Re-score an archived action-outcome model-judge shadow run under the current validator.
 *
 * Reads only the archived destination (plan.json, prompts/, results/, failures/, report.json).
 * Makes no model calls and never writes into the archived run. Use it to see how a validator
 * change (for example quote-mark normalization) moves protocol validity and agreement
 * on responses that already exist.
 *
 * `--out` writes the public pair (README.md plus an aggregate rescore.json with no per-case
 * votes, quotes, or rationales), matching what the v1 public export withheld. `--full-out`
 * writes rescore-full.json with every row and vote; point it at the private archive.
 *
 * Usage:
 *   node scripts/rescore-tutor-stub-action-outcome-model-judge-shadow.js \
 *     --destination /absolute/path/to/private-archive/artifacts/tutor-stub-live/run-name \
 *     [--design config/tutor-stub-action-outcome-model-judge-shadow-design.v1.json] \
 *     [--out exports/action-outcome-model-judge-shadow/<name>] \
 *     [--full-out /absolute/path/to/private-archive/artifacts/tutor-stub-live/rescores/<name>]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH_V1,
  evaluateTutorStubActionOutcomeModelJudgeResponse,
  loadTutorStubActionOutcomeModelJudgeDesign,
  renderTutorStubActionOutcomeModelJudgeReport,
  summarizeTutorStubActionOutcomeModelJudge,
} from '../services/tutorStubActionOutcomeModelJudge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readDirectoryJson(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(directory, name)));
}

function summaryOf(report) {
  return {
    status: report.status,
    eligible_by_seat: Object.fromEntries(Object.entries(report.seats).map(([id, seat]) => [id, seat.eligible])),
    paired_protocol_valid_cases: report.agreement.paired_protocol_valid_cases,
    delivery_exact: report.agreement.delivery.exact,
    delivery_kappa: report.agreement.delivery.cohen_kappa,
    outcome_exact: report.agreement.outcome.exact,
    outcome_kappa: report.agreement.outcome.cohen_kappa,
    joint_exact: report.agreement.joint.exact,
    joint_kappa: report.agreement.joint.cohen_kappa,
    paired_measurement_indeterminate: report.yield.paired_measurement_indeterminate,
    exact_consensus_binary_records: report.yield.exact_consensus_binary_records,
    checks_pass: Object.fromEntries(Object.entries(report.diagnostic_checks).map(([id, check]) => [id, check.pass])),
  };
}

export function rescoreTutorStubActionOutcomeModelJudgeShadow({
  root = ROOT,
  destination,
  designPath = TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH_V1,
} = {}) {
  if (!destination || !path.isAbsolute(destination)) throw new Error('--destination must be an absolute path');
  const loaded = loadTutorStubActionOutcomeModelJudgeDesign({ root, designPath });
  const plan = readJson(path.join(destination, 'plan.json'));
  const archivedReportBytes = fs.readFileSync(path.join(destination, 'report.json'));
  const archivedReport = JSON.parse(archivedReportBytes.toString('utf8'));
  if (plan.study_id !== loaded.design.studyId || archivedReport.study_id !== loaded.design.studyId) {
    throw new Error(`archived study ${plan.study_id} does not match design ${loaded.design.studyId}`);
  }
  const publicCases = new Map();
  for (const prompt of readDirectoryJson(path.join(destination, 'prompts'))) {
    const parsed = JSON.parse(prompt.user_prompt);
    publicCases.set(prompt.case_id, parsed.public_case);
  }
  const seats = new Map(loaded.design.judges.seats.map((seat) => [seat.id, seat]));
  const archivedRecords = readDirectoryJson(path.join(destination, 'results'));
  const records = archivedRecords.map((record) => {
    const seat = seats.get(record.seat_id);
    const publicCase = publicCases.get(record.case_id);
    if (!seat || !publicCase)
      throw new Error(`archived record ${record.case_id}/${record.seat_id} has no seat or case`);
    const measurement = evaluateTutorStubActionOutcomeModelJudgeResponse({
      response: record.response,
      seat,
      prompt: { case_id: record.case_id },
      publicCase,
    });
    return { case_id: record.case_id, seat_id: record.seat_id, archived: record.measurement, measurement };
  });
  const failures = readDirectoryJson(path.join(destination, 'failures'));
  const machineKey = {
    cases: archivedReport.rows.map((row) => ({
      caseId: row.case_id,
      worldId: row.world_id,
      action: { move_family: row.move_family, action_type: row.action_type },
      auxiliaryOutcome: row.frozen_auxiliary.outcome,
      auxiliaryDeliveryVisible: row.frozen_auxiliary.delivery_visible,
    })),
  };
  const rescored = summarizeTutorStubActionOutcomeModelJudge({ loaded, plan, records, failures, machineKey });
  const archivedRows = new Map(archivedReport.rows.map((row) => [row.case_id, row]));
  const changedRows = rescored.rows
    .map((row) => {
      const before = archivedRows.get(row.case_id);
      const changed =
        before.both_eligible !== row.both_eligible ||
        before.joint_exact !== row.joint_exact ||
        before.consensus.disposition !== row.consensus.disposition;
      return changed
        ? {
            case_id: row.case_id,
            before: {
              both_eligible: before.both_eligible,
              joint_exact: before.joint_exact,
              consensus: before.consensus,
            },
            after: { both_eligible: row.both_eligible, joint_exact: row.joint_exact, consensus: row.consensus },
          }
        : null;
    })
    .filter(Boolean);
  const validityChanges = records
    .filter((record) => record.archived.eligible !== record.measurement.eligible)
    .map((record) => ({
      case_id: record.case_id,
      seat_id: record.seat_id,
      archived_issues: record.archived.issues,
      rescored_issues: record.measurement.issues,
      rescored_notes: record.measurement.notes,
    }));
  return {
    schema: 'machinespirits.tutor-stub.action-outcome-model-judge-shadow-rescore.v1',
    study_id: loaded.design.studyId,
    source: {
      destination,
      archived_report_sha256: crypto.createHash('sha256').update(archivedReportBytes).digest('hex'),
      design: { path: loaded.relativePath, sha256: loaded.sha256 },
      archived_records: archivedRecords.length,
      archived_failures: failures.length,
    },
    model_calls: 0,
    archived: summaryOf(archivedReport),
    rescored: summaryOf(rescored),
    validity_changes: validityChanges,
    changed_rows: changedRows,
    report: rescored,
  };
}

const PUBLIC_REPORT_KEYS = Object.freeze([
  'schema',
  'study_id',
  'status',
  'source_study_id',
  'claim_boundary',
  'human_gate_status',
  'controller_study_licensed',
  'seats',
  'agreement',
  'yield',
  'frozen_auxiliary_comparison',
  'diagnostic_checks',
]);

/** Drop per-case rows, disagreements, and votes so the public copy carries aggregates only. */
export function reduceRescoreToPublic(result) {
  const report = Object.fromEntries(
    PUBLIC_REPORT_KEYS.filter((key) => key in (result.report || {})).map((key) => [key, result.report[key]]),
  );
  return {
    ...result,
    public_reduction: 'per-case rows, disagreements, and seat quotations stay in the private archive',
    report,
  };
}

function renderRescore(result) {
  const lines = [
    `# Re-score of ${result.study_id} under the current validator`,
    '',
    'No model calls. The archived responses are unchanged; only the validator moved.',
    '',
    '| Measure | Archived | Re-scored |',
    '|---|---:|---:|',
  ];
  const rows = [
    ['Eligible, Sol', 'eligible_by_seat.judge_sol'],
    ['Eligible, Opus', 'eligible_by_seat.judge_opus'],
    ['Paired protocol-valid cases', 'paired_protocol_valid_cases'],
    ['Delivery exact', 'delivery_exact'],
    ['Delivery kappa', 'delivery_kappa'],
    ['Outcome exact', 'outcome_exact'],
    ['Outcome kappa', 'outcome_kappa'],
    ['Joint exact', 'joint_exact'],
    ['Joint kappa', 'joint_kappa'],
    ['Paired measurement indeterminate', 'paired_measurement_indeterminate'],
    ['Exact-consensus binary records', 'exact_consensus_binary_records'],
    ['Status', 'status'],
  ];
  const pick = (object, dotted) => dotted.split('.').reduce((value, key) => value?.[key], object);
  const show = (value) => {
    if (value && typeof value === 'object' && 'numerator' in value) return `${value.numerator}/${value.denominator}`;
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(3);
    return String(value);
  };
  for (const [label, key] of rows) {
    lines.push(`| ${label} | ${show(pick(result.archived, key))} | ${show(pick(result.rescored, key))} |`);
  }
  lines.push('', '## Validity changes', '');
  if (!result.validity_changes.length) lines.push('None.');
  for (const change of result.validity_changes) {
    lines.push(
      `- ${change.case_id}/${change.seat_id}: archived issues ${JSON.stringify(change.archived_issues)} -> re-scored issues ${JSON.stringify(change.rescored_issues)}, notes ${JSON.stringify(change.rescored_notes)}`,
    );
  }
  lines.push('', '## Rows whose consensus changed', '');
  if (!result.changed_rows.length) lines.push('None.');
  for (const row of result.changed_rows) {
    lines.push(
      `- ${row.case_id}: ${row.before.consensus.disposition} (joint_exact ${row.before.joint_exact}) -> ${row.after.consensus.disposition} (joint_exact ${row.after.joint_exact})`,
    );
  }
  lines.push('', '## Re-scored report', '', renderTutorStubActionOutcomeModelJudgeReport(result.report));
  return lines.join('\n');
}

export async function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      destination: { type: 'string' },
      design: { type: 'string', default: TUTOR_STUB_ACTION_OUTCOME_MODEL_JUDGE_DESIGN_PATH_V1 },
      out: { type: 'string' },
      'full-out': { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });
  if (values.help || !values.destination) {
    process.stdout.write(
      'usage: rescore-tutor-stub-action-outcome-model-judge-shadow.js --destination <absolute archived run> [--design <path>] [--out <public dir>] [--full-out <private dir>]\n',
    );
    return null;
  }
  const result = rescoreTutorStubActionOutcomeModelJudgeShadow({
    destination: path.resolve(values.destination),
    designPath: values.design,
  });
  if (values.out) {
    const outDirectory = path.resolve(ROOT, values.out);
    fs.mkdirSync(outDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(outDirectory, 'rescore.json'),
      `${JSON.stringify(reduceRescoreToPublic(result), null, 2)}\n`,
    );
    fs.writeFileSync(path.join(outDirectory, 'README.md'), `${renderRescore(result)}\n`);
    process.stdout.write(`${path.join(outDirectory, 'README.md')}\n`);
  }
  if (values['full-out']) {
    const fullDirectory = path.resolve(values['full-out']);
    fs.mkdirSync(fullDirectory, { recursive: true });
    fs.writeFileSync(path.join(fullDirectory, 'rescore-full.json'), `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${path.join(fullDirectory, 'rescore-full.json')}\n`);
  }
  const { report: _report, ...summary } = result;
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  return result;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
