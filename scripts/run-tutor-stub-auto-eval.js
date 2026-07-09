#!/usr/bin/env node
/**
 * Run unattended tutor-stub dialogues with an automated learner.
 *
 * Default comparison:
 *   negative floor vs dynamic preconscious register policy vs random register policy.
 *
 * Usage:
 *   npm run tutor:stub:auto-eval -- --dry-run
 *   npm run tutor:stub:auto-eval -- --runs 2
 *   npm run tutor:stub:auto-eval -- --runs 1 --turns 8
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  learnerProfileContract,
  learnerProfileContractSummary,
  learnerProfileDescription,
  learnerProfileIds,
  learnerProfileListText,
  learnerProfilePrompt,
  normalizeLearnerProfileId,
} from './tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const DEFAULT_CODEX_MODEL_REF = 'codex.gpt-5.5';

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '1' },
    turns: { type: 'string', default: 'until-grounded' },
    policies: { type: 'string', default: 'negative,dynamic,random' },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || DEFAULT_CODEX_MODEL_REF },
    'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || DEFAULT_CODEX_MODEL_REF },
    'auto-learner-model': {
      type: 'string',
      default:
        process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL ||
        process.env.TUTOR_STUB_AUTO_LEARNER_MODEL ||
        DEFAULT_CODEX_MODEL_REF,
    },
    'auto-learner-profile': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_PROFILE || '',
    },
    'auto-learner-profile-id': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_PROFILE_ID || 'diligent',
    },
    'report-from': { type: 'string', default: '' },
    'resume-from': { type: 'string', default: '' },
    'resume-statuses': { type: 'string', default: 'failed' },
    index: { type: 'boolean', default: false },
    'index-root': { type: 'string', default: process.env.TUTOR_STUB_EVAL_INDEX_ROOT || '.tutor-stub-auto-eval' },
    world: { type: 'string', default: process.env.TUTOR_STUB_EVAL_WORLD || 'world_005_marrick' },
    'trace-dir': { type: 'string', default: process.env.TUTOR_STUB_EVAL_TRACE_DIR || '.tutor-stub-auto-eval' },
    ledger: { type: 'string', default: process.env.TUTOR_STUB_EVAL_LEDGER || '.tutor-stub-auto-eval/ledger.jsonl' },
    'register-palette': { type: 'string', default: 'all' },
    'dag-mode': { type: 'string', default: process.env.TUTOR_STUB_EVAL_DAG_MODE || process.env.TUTOR_STUB_DAG_MODE || 'strict_dag' },
    'first-message': { type: 'string', default: '' },
    'cli-effort': { type: 'string', default: process.env.TUTOR_STUB_EVAL_CLI_EFFORT || '' },
    'max-tokens': { type: 'string', default: process.env.TUTOR_STUB_EVAL_MAX_TOKENS || '' },
    'history-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_HISTORY_TURNS || '' },
    parallelism: { type: 'string', default: process.env.TUTOR_STUB_EVAL_PARALLELISM || '1' },
    'progress-interval': { type: 'string', default: process.env.TUTOR_STUB_EVAL_PROGRESS_INTERVAL || '30' },
    'until-grounded': { type: 'boolean', default: false },
    'safety-turns': { type: 'string', default: process.env.TUTOR_STUB_EVAL_SAFETY_TURNS || '80' },
    'no-dag': { type: 'boolean', default: false },
    'no-stop-on-grounded': { type: 'boolean', default: false },
    'no-progress': { type: 'boolean', default: false },
    'no-html-report': { type: 'boolean', default: false },
    'no-ledger': { type: 'boolean', default: false },
    'no-memory-summary': { type: 'boolean', default: false },
    'keep-going': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    'list-learner-profiles': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

function printHelp() {
  console.log(`Usage:
  npm run tutor:stub:auto-eval -- [options]

Options:
  --runs <n>                 repetitions per policy (default: 1)
  --turns <n|until-grounded> max automated learner turns per dialogue (default: until-grounded)
  --policies <csv>           register policies to compare (default: negative,dynamic,random)
                              known: dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,continuous_dynamical_system,continuous_empirical_dynamical_system,bland,random,negative
  --model <ref>              tutor model (default: codex.gpt-5.5)
  --analysis-model <ref>     classifier + learner-DAG model (default: codex.gpt-5.5)
  --auto-learner-model <ref> automated learner model (default: codex.gpt-5.5)
  --auto-learner-profile <text>
  --auto-learner-profile-id <id>
                              built-in profile when no custom text is supplied
                              (default: diligent; use --list-learner-profiles)
  --report-from <json>       build HTML from an existing auto-eval JSON summary
  --resume-from <json>       rerun rows from an existing auto-eval JSON summary
  --resume-statuses <csv>    statuses to rerun with --resume-from (default: failed)
  --index                    build/update the local report index and exit
  --index-root <path>        report index root (default: .tutor-stub-auto-eval)
  --world <id|path|none>     default: world_005_marrick
  --trace-dir <path>         default: .tutor-stub-auto-eval
  --ledger <path>            append/upsert eval ledger JSONL (default: .tutor-stub-auto-eval/ledger.jsonl)
  --register-palette <mode>  default: all
  --dag-mode <mode>          strict_dag, human_scaffold, or defeasible_human_scaffold
  --first-message <text>     seed the first learner turn instead of using tutor opening
  --cli-effort <level>       low, medium, high, xhigh, max, or config for CLI providers
  --max-tokens <n>           tutor response token cap passed to tutor-stub
  --history-turns <n>        raw recent turns passed to tutor-stub after compact memory
  --parallelism <n>          child dialogues to run concurrently (default: 1)
  --progress-interval <sec>  active turn progress cadence (default: 30)
  --until-grounded           legacy alias for --turns until-grounded
  --safety-turns <n>         runaway guard for --until-grounded (default: 80)
  --no-dag                   omit tutor proof-DAG context
  --no-stop-on-grounded      run until --turns even after grounded closure
  --no-progress              suppress the terminal progress bar
  --no-html-report           skip the rich standalone HTML report
  --no-ledger                skip the ignored auto-eval ledger
  --no-memory-summary        disable tutor-stub compact dialogue memory
  --keep-going               continue after a failed run
  --dry-run                  print commands only
  --list-learner-profiles    print built-in automated learner profiles
`);
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function turnsArg() {
  return args['until-grounded'] || args.turns === 'until-grounded'
    ? 'until-grounded'
    : String(positiveInt(args.turns, '--turns'));
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizePolicyName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/gu, '_');
}

function policyCsv(value) {
  return csv(value).map(normalizePolicyName).filter(Boolean);
}

function assertSupportedModelRefs(refs) {
  for (const [label, ref] of Object.entries(refs)) {
    const normalized = String(ref || '')
      .trim()
      .toLowerCase();
    if (UNSUPPORTED_CODEX_MINI_REFS.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.5 for CLI-backed Codex, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

function resolvedAutoLearnerProfileId() {
  const id = normalizeLearnerProfileId(args['auto-learner-profile-id']);
  if (!learnerProfileContract(id)) {
    throw new Error(
      `Unknown --auto-learner-profile-id: ${args['auto-learner-profile-id']}. ` +
        `Known: ${learnerProfileIds().join(', ')}`,
    );
  }
  return id;
}

function resolvedAutoLearnerProfile() {
  const custom = String(args['auto-learner-profile'] || '').trim();
  if (custom) return custom;
  return learnerProfilePrompt(resolvedAutoLearnerProfileId());
}

function autoLearnerProfileLabel() {
  return String(args['auto-learner-profile'] || '').trim() ? 'custom' : resolvedAutoLearnerProfileId();
}

function printLearnerProfiles() {
  console.log(learnerProfileListText());
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function safeTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function safeSlug(value) {
  return String(value || 'run')
    .replace(/[^a-z0-9._-]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
}

function displayCommand(parts) {
  const redacted = [];
  for (let index = 0; index < parts.length; index += 1) {
    redacted.push(parts[index]);
    if (parts[index] === '--auto-learner-profile') {
      redacted.push('[auto learner profile omitted]');
      index += 1;
    }
  }
  return `node ${redacted.map((part) => JSON.stringify(part)).join(' ')}`;
}

function flagValue(parts, flag) {
  const index = parts.indexOf(flag);
  return index === -1 ? null : parts[index + 1] || null;
}

function withFlagValue(parts, flag, value) {
  if (value === undefined || value === null || value === '') return parts;
  const out = [...parts];
  const index = out.indexOf(flag);
  if (index === -1) {
    out.push(flag, String(value));
  } else {
    out[index + 1] = String(value);
  }
  return out;
}

function withBooleanFlag(parts, flag, enabled) {
  if (!enabled || parts.includes(flag)) return parts;
  return [...parts, flag];
}

function assertSupportedChildArgs(childArgs) {
  assertSupportedModelRefs({
    '--model': flagValue(childArgs, '--model'),
    '--classifier-model': flagValue(childArgs, '--classifier-model'),
    '--learner-record-model': flagValue(childArgs, '--learner-record-model'),
    '--auto-learner-model': flagValue(childArgs, '--auto-learner-model'),
  });
}

function listTraceFiles(traceDir) {
  if (!fs.existsSync(traceDir)) return [];
  return fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => path.join(traceDir, name))
    .sort();
}

function runStatePath(traceDir) {
  return path.join(traceDir, 'run-state.json');
}

function writeJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  fs.writeFileSync(tmpPath, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmpPath, filePath);
}

function countBy(values) {
  const counts = {};
  for (const value of values) {
    const key = String(value || 'none');
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts, { limit = 6 } = {}) {
  return Object.entries(counts || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ');
}

const REPORT_POLICY_ORDER = [
  'bland',
  'random',
  'state',
  'field',
  'trajectory',
  'dynamic',
  'dynamical_system',
  'empirical_dynamical_system',
  'continuous_dynamical_system',
  'continuous_empirical_dynamical_system',
  'negative',
];

function reportPolicyRank(policy) {
  const rank = REPORT_POLICY_ORDER.indexOf(String(policy || ''));
  return rank === -1 ? REPORT_POLICY_ORDER.length : rank;
}

function compareReportPolicies(left, right) {
  const rankDelta = reportPolicyRank(left) - reportPolicyRank(right);
  if (rankDelta) return rankDelta;
  return String(left || '').localeCompare(String(right || ''));
}

function compareReportRows(left, right) {
  const policyDelta = compareReportPolicies(left?.policy, right?.policy);
  if (policyDelta) return policyDelta;
  return Number(left?.runIndex || 0) - Number(right?.runIndex || 0);
}

function mean(values) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return 0;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

function entropy(values) {
  const filtered = values.filter(Boolean);
  if (!filtered.length) return 0;
  const counts = Object.values(countBy(filtered));
  const total = filtered.length;
  const raw = counts.reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log2(p);
  }, 0);
  return Number(raw.toFixed(3));
}

function scoreValue(score) {
  if (score && typeof score === 'object' && score.score !== undefined) return score.score;
  if (score !== undefined && score !== null) return score;
  return '?';
}

function clampField01(value) {
  if (!Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.min(1, Number(value)));
}

function roundField(value) {
  return Number((Number(value) || 0).toFixed(3));
}

function fieldScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? clampField01(numeric / 5) : 0;
}

function fieldDelta(current, previous) {
  return roundField((current || 0) - (previous || 0));
}

function numericScore(score) {
  const raw = scoreValue(score);
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatSignedField(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
}

function formatPositiveField(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return numeric.toFixed(3);
}

function displayBottleneck(value, { groundedClosure = false } = {}) {
  const raw = String(value || '').trim();
  if (groundedClosure || raw === 'grounded_asserted_secret') return 'closed';
  if (!raw) return 'open';
  return raw;
}

function displayStopReason(value) {
  if (value === 'auto_grounded_closure') return 'grounded closure';
  return value || 'no stop reason';
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function wordsInText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function lightweightFieldTurn(turn, previous = null) {
  const classification = turn?.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const register = turn?.registerSelection || {};
  const priorEfficacy = turn?.previousRegisterEfficacy || null;
  const leakOk = !turn?.tutorLeakAudit || turn.tutorLeakAudit.ok === true;
  const conceptual = fieldScore(scores.conceptual_engagement);
  const readiness = fieldScore(scores.epistemic_readiness);
  const coverage = clampField01(Number(assessment.bestPathCoverage || 0));
  const grounded = clampField01(Number(metrics.groundedCount || 0) / 8);
  const missing = clampField01(Number(metrics.missingPremiseCount || 0) / 8);
  const overreach = /overconfident|answer_seeking|overleaps_evidence|unsupported|resistant/iu.test(
    [turnAnalysis.epistemic_stance, turnAnalysis.evidence_use, assessment.bottleneck, priorEfficacy?.label]
      .filter(Boolean)
      .join(' '),
  )
    ? 0.25
    : 0;
  const responseWords = wordsInText(turn?.tutor);
  const brevity = clampField01(1 - Math.max(0, responseWords - 95) / 130);
  const registerConfidence = Number.isFinite(Number(register.confidence))
    ? clampField01(Number(register.confidence))
    : 0.5;
  const efficacyScore = priorEfficacy ? clampField01((Number(priorEfficacy.progressScore || 0) + 4) / 8) : 0.5;

  const learnerMastery = roundField(0.34 * conceptual + 0.26 * readiness + 0.3 * coverage + 0.1 * grounded);
  const learnerRisk = roundField(clampField01(0.45 * missing + 0.25 * (1 - readiness) + overreach));
  const tutorAlignment = roundField(
    clampField01(0.3 * registerConfidence + 0.24 * efficacyScore + 0.22 * brevity + 0.24 * (leakOk ? 1 : 0)),
  );
  const jointMomentum = roundField(
    clampField01(
      0.42 * Math.max(0, fieldDelta(learnerMastery, previous?.learnerMastery)) +
        0.28 * Math.max(0, fieldDelta(coverage, previous?.coverage)) +
        0.18 * efficacyScore +
        (0.12 * (turn?.tutorDag?.leavesReleased || 0)) / Math.max(1, turn?.tutorDag?.leavesTotal || 1),
    ),
  );

  return {
    turn: turn.turn,
    learnerMastery,
    learnerRisk,
    tutorAlignment,
    jointMomentum,
    coverage,
    groundedCount: Number(metrics.groundedCount || 0),
    missingCount: Number(metrics.missingPremiseCount || 0),
    conceptual,
    readiness,
    register: register.selected_register || null,
    bottleneck: assessment.bottleneck || 'unknown',
    learnerMove: turnAnalysis.discourse_move || 'unknown',
    speed: previous
      ? roundField(
          Math.sqrt(
            fieldDelta(learnerMastery, previous.learnerMastery) ** 2 +
              fieldDelta(learnerRisk, previous.learnerRisk) ** 2 +
              fieldDelta(tutorAlignment, previous.tutorAlignment) ** 2 +
              fieldDelta(jointMomentum, previous.jointMomentum) ** 2,
          ),
        )
      : 0,
  };
}

function buildLightweightDialogueField(turnRecords = []) {
  const rows = [];
  for (const turn of turnRecords) {
    rows.push(lightweightFieldTurn(turn, rows.at(-1) || null));
  }
  const first = rows[0] || {};
  const final = rows.at(-1) || {};
  return {
    schema: 'machinespirits.tutor-stub.lightweight-field.v1',
    turnCount: rows.length,
    rows,
    summary: {
      finalTurn: final.turn || null,
      meanSpeed: roundField(rows.reduce((sum, row) => sum + row.speed, 0) / Math.max(1, rows.length)),
      fieldDelta: {
        learnerMastery: fieldDelta(final.learnerMastery, first.learnerMastery),
        learnerRisk: fieldDelta(final.learnerRisk, first.learnerRisk),
        tutorAlignment: fieldDelta(final.tutorAlignment, first.tutorAlignment),
        jointMomentum: fieldDelta(final.jointMomentum, first.jointMomentum),
      },
      final: {
        learnerMastery: final.learnerMastery ?? null,
        learnerRisk: final.learnerRisk ?? null,
        tutorAlignment: final.tutorAlignment ?? null,
        jointMomentum: final.jointMomentum ?? null,
        coverage: final.coverage ?? null,
        bottleneck: final.bottleneck || null,
      },
    },
  };
}

function roundOptionalField(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(3)) : null;
}

function numberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizedField01(value, fallback = 0) {
  const numeric = numberOrNull(value);
  return numeric === null ? fallback : clampField01(numeric);
}

function textSnippet(value, maxLength = 180) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function compactNumericMap(object, { limit = Infinity, abs = false, minAbs = 0 } = {}) {
  const entries = Object.entries(object || {})
    .map(([key, value]) => [key, numberOrNull(value)])
    .filter(([, value]) => value !== null && Math.abs(value) >= minAbs)
    .sort((a, b) => {
      const left = abs ? Math.abs(a[1]) : a[1];
      const right = abs ? Math.abs(b[1]) : b[1];
      return right - left || a[0].localeCompare(b[0]);
    })
    .slice(0, limit);
  return Object.fromEntries(entries.map(([key, value]) => [key, roundOptionalField(value)]));
}

function mergeCounts(countObjects = []) {
  const out = {};
  for (const counts of countObjects) {
    for (const [key, value] of Object.entries(counts || {})) {
      out[key] = (out[key] || 0) + Number(value || 0);
    }
  }
  return out;
}

function compactRegisterDistribution(selection = {}) {
  const distribution = Array.isArray(selection.distribution)
    ? selection.distribution
        .map((entry) => ({
          register: String(entry?.register || entry?.selected_register || '').trim(),
          probability: roundOptionalField(entry?.probability),
          weight: roundOptionalField(entry?.weight),
        }))
        .filter((entry) => entry.register)
    : [];
  if (distribution.length) {
    return {
      source: 'policy_distribution',
      rows: distribution.sort(
        (a, b) => Number(b.probability || 0) - Number(a.probability || 0) || a.register.localeCompare(b.register),
      ),
    };
  }
  const selected = String(selection.selected_register || '').trim();
  if (!selected) return { source: 'none', rows: [] };
  return {
    source: 'selected_only',
    rows: [
      {
        register: selected,
        probability: roundOptionalField(selection.selected_probability ?? 1),
        weight: null,
      },
    ],
  };
}

function seriesMetric(values) {
  const finite = values.map(numberOrNull).filter((value) => value !== null);
  const current = finite.at(-1) ?? null;
  const previous = finite.length >= 2 ? finite.at(-2) : null;
  const beforePrevious = finite.length >= 3 ? finite.at(-3) : null;
  const velocity = current !== null && previous !== null ? current - previous : null;
  const previousVelocity = previous !== null && beforePrevious !== null ? previous - beforePrevious : null;
  const acceleration = velocity !== null && previousVelocity !== null ? velocity - previousVelocity : null;
  let slope = null;
  if (finite.length >= 2) {
    const points = finite.map((value, index) => ({ x: index, y: value }));
    const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
    const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
    if (denominator) {
      const numerator = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
      slope = numerator / denominator;
    }
  }
  return {
    current: roundOptionalField(current),
    previous: roundOptionalField(previous),
    velocity: roundOptionalField(velocity),
    previousVelocity: roundOptionalField(previousVelocity),
    acceleration: roundOptionalField(acceleration),
    slope: roundOptionalField(slope),
  };
}

function reconstructedTrajectoryFromFieldRows(fieldRows, index, { window = 5 } = {}) {
  const rows = fieldRows.slice(Math.max(0, index + 1 - window), index + 1);
  const fieldValues = rows.map((row) => row.learnerMastery);
  const dagValues = rows.map((row) => row.coverage);
  const riskValues = rows.map((row) => row.learnerRisk);
  const field = seriesMetric(fieldValues);
  const dag = seriesMetric(dagValues);
  const risk = seriesMetric(riskValues);
  const fieldSlope = Number(field.slope || 0);
  const dagSlope = Number(dag.slope || 0);
  const riskSlope = Number(risk.slope || 0);
  const fieldVelocity = Number(field.velocity || 0);
  const dagVelocity = Number(dag.velocity || 0);
  const riskVelocity = Number(risk.velocity || 0);
  return {
    schema: 'machinespirits.tutor-stub.reconstructed-trajectory.v1',
    window,
    pointCount: rows.length,
    points: rows.map((row) => ({
      turn: row.turn,
      fieldScore: row.learnerMastery,
      dagScore: row.coverage,
      riskScore: row.learnerRisk,
      bottleneck: row.bottleneck,
    })),
    field,
    dag,
    risk,
    flags: {
      plateau: rows.length >= 3 && Math.abs(fieldSlope) < 0.025 && Math.abs(dagSlope) < 0.025 && riskSlope >= -0.025,
      fieldRegression: rows.length >= 2 && (fieldVelocity < -0.04 || fieldSlope < -0.025),
      riskRising: rows.length >= 2 && (riskVelocity > 0.04 || riskSlope > 0.025),
      fieldOnlyDrift: rows.length >= 3 && fieldSlope > 0.025 && dagSlope <= 0.015,
      dagOnlyDrift: rows.length >= 3 && dagSlope > 0.025 && fieldSlope < 0.015,
      stableConvergence: rows.length >= 3 && dagSlope > 0.025 && fieldSlope >= -0.015 && riskSlope <= 0.025,
      coerciveProgress: rows.length >= 2 && dagVelocity > 0.08 && (fieldVelocity < -0.02 || riskVelocity > 0.04),
      noisyAcceleration:
        rows.length >= 3 &&
        (Math.abs(Number(field.acceleration || 0)) > 0.08 ||
          Math.abs(Number(dag.acceleration || 0)) > 0.08 ||
          Math.abs(Number(risk.acceleration || 0)) > 0.08),
      nearClosure: Number(rows.at(-1)?.coverage || 0) >= 0.8,
    },
  };
}

function compactTrajectoryMetric(metric = {}) {
  return {
    current: roundOptionalField(metric.current),
    previous: roundOptionalField(metric.previous),
    velocity: roundOptionalField(metric.velocity),
    previousVelocity: roundOptionalField(metric.previousVelocity),
    acceleration: roundOptionalField(metric.acceleration),
    slope: roundOptionalField(metric.slope),
  };
}

function compactTrajectory(trajectory, fallbackTrajectory) {
  const source = trajectory ? 'register_policy' : 'reconstructed_field';
  const selected = trajectory || fallbackTrajectory || {};
  return {
    schema: selected.schema || null,
    source,
    window: selected.window ?? null,
    pointCount: selected.pointCount ?? null,
    points: (selected.points || []).map((point) => ({
      turn: point.turn ?? null,
      fieldScore: roundOptionalField(point.fieldScore),
      dagScore: roundOptionalField(point.dagScore),
      riskScore: roundOptionalField(point.riskScore),
      bottleneck: point.bottleneck || null,
    })),
    field: compactTrajectoryMetric(selected.field),
    dag: compactTrajectoryMetric(selected.dag),
    risk: compactTrajectoryMetric(selected.risk),
    flags: Object.fromEntries(Object.entries(selected.flags || {}).map(([key, value]) => [key, Boolean(value)])),
  };
}

function classifierStateFeatures(turn = {}, fieldRow = {}) {
  const classification = turn.classification || {};
  const turnAnalysis = classification.turn || {};
  const scores = turnAnalysis.scores || {};
  return {
    requestType: turnAnalysis.request_type || 'unknown',
    discourseMove: turnAnalysis.discourse_move || 'unknown',
    evidenceUse: turnAnalysis.evidence_use || 'unknown',
    epistemicStance: turnAnalysis.epistemic_stance || 'unknown',
    agency: turnAnalysis.agency || 'unknown',
    affect: turnAnalysis.affect || 'unknown',
    scores: {
      conceptual: roundOptionalField(fieldRow.conceptual ?? fieldScore(scores.conceptual_engagement)),
      epistemicReadiness: roundOptionalField(fieldRow.readiness ?? fieldScore(scores.epistemic_readiness)),
      learnerSurface: roundOptionalField(mean([fieldRow.conceptual, fieldRow.readiness])),
    },
  };
}

function approximateDynamicalStateVector({ turn, fieldRow, trajectory, selection }) {
  const assessment = turn?.tutorLearnerDagModel?.assessment || {};
  const metrics = turn?.tutorLearnerDagModel?.metrics || {};
  const flags = trajectory?.flags || {};
  const coverage = normalizedField01(assessment.bestPathCoverage ?? fieldRow.coverage, 0);
  const missingNeed = clampField01(
    Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0) / 8,
  );
  const unsupportedNeed = clampField01(Number(assessment.unsupportedAssertionCount || 0) / 3);
  const conceptual = normalizedField01(fieldRow.conceptual, 0.5);
  const readiness = normalizedField01(fieldRow.readiness, 0.5);
  const risk = normalizedField01(fieldRow.learnerRisk, 0);
  const alignment = normalizedField01(fieldRow.tutorAlignment, 0.5);
  const momentum = normalizedField01(fieldRow.jointMomentum, 0);
  const selectedProbability = numberOrNull(selection?.selected_probability);
  const negativeValence =
    selection?.valence === 'negative' || ['ironic', 'sarcastic', 'face_threat'].includes(selection?.selected_register);
  return {
    evidence_gap: roundField(clampField01((1 - coverage) * 0.58 + missingNeed * 0.32 + (1 - conceptual) * 0.1)),
    warrant_gap: roundField(
      clampField01(
        unsupportedNeed * 0.45 +
          (assessment.bottleneck === 'assertion_gap' ? 0.3 : 0) +
          (assessment.bottleneck === 'premature_assertion' ? 0.35 : 0) +
          (1 - readiness) * 0.15,
      ),
    ),
    agency_deficit: roundField(clampField01(1 - readiness + (selection?.action_family === 'answer_supply' ? 0.2 : 0))),
    affective_risk: roundField(risk),
    recognition_pressure: roundField(clampField01((1 - alignment) * 0.45 + risk * 0.3 + (negativeValence ? 0.25 : 0))),
    coercion_risk: roundField(
      clampField01((negativeValence ? 0.35 : 0) + (flags.coerciveProgress ? 0.35 : 0) + risk * 0.2),
    ),
    integration_need: roundField(
      clampField01(1 - conceptual + (assessment.bottleneck === 'learner_integration_gap' ? 0.25 : 0)),
    ),
    compression_need: roundField(clampField01((1 - conceptual) * 0.45 + (1 - readiness) * 0.25 + missingNeed * 0.3)),
    momentum: roundField(momentum),
    stagnation: roundField(clampField01((flags.plateau ? 0.55 : 0) + (Number(fieldRow.speed || 0) < 0.035 ? 0.18 : 0))),
    disruption_need: roundField(
      clampField01((flags.plateau ? 0.5 : 0) + (flags.fieldRegression ? 0.25 : 0) + (1 - readiness) * 0.2),
    ),
    tempo_affordance: roundField(
      clampField01(
        momentum * (1 - risk) + (selection?.request_type === 'transfer_demand_or_named_material' ? 0.12 : 0),
      ),
    ),
    closure_pressure: roundField(
      clampField01(
        coverage * 0.65 + (assessment.finalSecretEntailed ? 0.25 : 0) + (assessment.assertedSecret ? 0.2 : 0),
      ),
    ),
    field_regression: roundField(
      clampField01((flags.fieldRegression ? 0.65 : 0) + Math.max(0, -Number(trajectory?.field?.velocity || 0)) * 3),
    ),
    empirical_uncertainty: roundField(selectedProbability === null ? 0.8 : clampField01(1 - selectedProbability)),
  };
}

function frameEvents({ turn, fieldRow, trajectory, selection }) {
  const events = new Set();
  if (fieldRow.bottleneck) events.add(fieldRow.bottleneck);
  if (turn?.humanDiscourseFrame?.sideArc?.detected) events.add(`side_arc:${turn.humanDiscourseFrame.sideArc.type || 'unknown'}`);
  if (turn?.humanDiscourseFrame?.proofDebt?.status && turn.humanDiscourseFrame.proofDebt.status !== 'none_open') {
    events.add(`proof_debt:${turn.humanDiscourseFrame.proofDebt.status}`);
  }
  if (turn?.humanDiscourseFrame?.warrantPremiseAudit?.status) {
    events.add(`warrant_stocktake:${turn.humanDiscourseFrame.warrantPremiseAudit.status}`);
  }
  for (const flag of selection?.risk_flags || []) events.add(flag);
  for (const [flag, enabled] of Object.entries(trajectory?.flags || {})) {
    if (enabled) events.add(flag);
  }
  if (turn?.tutorLeakAudit?.ok === false) events.add('leak_audit_flag');
  if (turn?.tutorResponseRepaired) events.add('repaired_response');
  if (turn?.tutorDeterministicFallback) events.add('deterministic_fallback');
  return Array.from(events).filter(Boolean).slice(0, 10);
}

function compactFrameState({ turn, fieldRow, selection }) {
  const model = turn?.tutorLearnerDagModel || {};
  const metrics = model.metrics || {};
  const assessment = model.assessment || {};
  const policyFeatures =
    selection?.state_policy?.features ||
    selection?.field_policy?.features ||
    selection?.trajectory_policy?.features ||
    selection?.dynamical_system_policy?.features;
  const classifier = {
    ...classifierStateFeatures(turn, fieldRow),
    ...(policyFeatures
      ? {
          requestType: policyFeatures.requestType || policyFeatures.request_type || undefined,
          discourseMove: policyFeatures.discourseMove || policyFeatures.discourse_move || undefined,
          evidenceUse: policyFeatures.evidenceUse || policyFeatures.evidence_use || undefined,
          epistemicStance: policyFeatures.epistemicStance || policyFeatures.epistemic_stance || undefined,
          agency: policyFeatures.agency || undefined,
          affect: policyFeatures.affect || undefined,
          scores: policyFeatures.scores || classifierStateFeatures(turn, fieldRow).scores,
        }
      : {}),
  };
  return {
    classifier,
    dag: {
      bottleneck: assessment.bottleneck || 'unknown',
      bestPathCoverage: roundOptionalField(assessment.bestPathCoverage ?? fieldRow.coverage),
      missingPremiseCount: Number(
        metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0,
      ),
      groundedCount: Number(metrics.groundedCount ?? fieldRow.groundedCount ?? 0),
      voicedDerivedCount: Number(metrics.voicedDerivedCount || 0),
      unsupportedAssertionCount: Number(assessment.unsupportedAssertionCount || 0),
      finalSecretEntailed: assessment.finalSecretEntailed === true,
      assertedSecret: assessment.assertedSecret === true,
      assertedMirror: assessment.assertedMirror === true,
    },
  };
}

function buildAnimatedVizFrame({ turn, index, fieldRows }) {
  const fieldRow = fieldRows[index] || lightweightFieldTurn(turn, fieldRows[index - 1] || null);
  const selection = turn?.registerSelection || {};
  const fallbackTrajectory = reconstructedTrajectoryFromFieldRows(fieldRows, index);
  const policyTrajectory =
    selection.dynamical_system_policy?.trajectory || selection.trajectory_policy?.trajectory || null;
  const trajectory = compactTrajectory(policyTrajectory, fallbackTrajectory);
  const stateVector =
    selection.dynamical_system_policy?.state_vector ||
    approximateDynamicalStateVector({ turn, fieldRow, trajectory, selection });
  const derivativeVector = selection.dynamical_system_policy?.derivative_vector || {
    field_velocity: trajectory.field.velocity,
    field_slope: trajectory.field.slope,
    field_acceleration: trajectory.field.acceleration,
    dag_velocity: trajectory.dag.velocity,
    dag_slope: trajectory.dag.slope,
    dag_acceleration: trajectory.dag.acceleration,
    risk_velocity: trajectory.risk.velocity,
    risk_slope: trajectory.risk.slope,
    risk_acceleration: trajectory.risk.acceleration,
  };
  const distribution = compactRegisterDistribution(selection);
  return {
    schema: 'machinespirits.tutor-stub.animated-viz-frame.v1',
    turn: turn?.turn ?? index + 1,
    policy: selection.policy || null,
    selectedRegister: selection.selected_register || null,
    register: {
      policy: selection.policy || null,
      selected: selection.selected_register || null,
      probability: roundOptionalField(selection.selected_probability),
      vector: selection.register_vector || selection.continuous_register_policy?.register_vector || null,
      vectorEntropyBits: roundOptionalField(
        selection.register_vector_entropy_bits ?? selection.continuous_register_policy?.entropy_bits,
      ),
      continuous: selection.continuous_register_policy || null,
      distributionSource: distribution.source,
      distribution: distribution.rows,
      scores: compactNumericMap(
        selection.dynamical_system_policy?.scores ||
          selection.trajectory_policy?.scores ||
          selection.state_policy?.scores ||
          selection.field_policy?.scores ||
          {},
        { limit: 12 },
      ),
      logits: compactNumericMap(selection.dynamical_system_policy?.logits || {}, { limit: 12 }),
    },
    state: compactFrameState({ turn, fieldRow, selection }),
    humanDiscourse: turn?.humanDiscourseFrame || null,
    field: {
      learnerMastery: fieldRow.learnerMastery,
      learnerRisk: fieldRow.learnerRisk,
      tutorAlignment: fieldRow.tutorAlignment,
      jointMomentum: fieldRow.jointMomentum,
      coverage: fieldRow.coverage,
      speed: fieldRow.speed,
      bottleneck: fieldRow.bottleneck,
      learnerMove: fieldRow.learnerMove,
    },
    trajectory,
    dynamics: {
      source: selection.dynamical_system_policy ? 'dynamical_system_policy' : 'reconstructed_state',
      stateVector: compactNumericMap(stateVector),
      derivativeVector: compactNumericMap(derivativeVector),
      attractors: compactNumericMap(selection.dynamical_system_policy?.attractors || {}, { limit: 12 }),
      selectedContributions: (selection.dynamical_system_policy?.selected_contributions || []).slice(0, 8),
      empirical: selection.dynamical_system_policy?.empirical || null,
      corpusEmpirical: selection.dynamical_system_policy?.corpus_empirical || null,
      continuous: selection.continuous_register_policy || selection.dynamical_system_policy?.continuous_register_policy || null,
      mapping: selection.dynamical_system_policy?.mapping || null,
    },
    events: frameEvents({ turn, fieldRow, trajectory, selection }),
    snippets: {
      learner: textSnippet(turn?.learner),
      tutor: textSnippet(turn?.tutor),
    },
  };
}

function buildAnimatedRunVisualization(turnRecords = [], fieldViz = null) {
  const fieldRows = fieldViz?.rows?.length ? fieldViz.rows : buildLightweightDialogueField(turnRecords).rows;
  const frames = turnRecords.map((turn, index) => buildAnimatedVizFrame({ turn, index, fieldRows }));
  if (!frames.length) return null;
  const registerPalette = Array.from(
    new Set(
      frames.flatMap((frame) => [
        frame.selectedRegister,
        ...frame.register.distribution.map((entry) => entry.register),
        ...Object.keys(frame.register.scores || {}),
      ]),
    ),
  ).filter(Boolean);
  const dynamicsAxes = Array.from(new Set(frames.flatMap((frame) => Object.keys(frame.dynamics.stateVector || {}))));
  return {
    schema: 'machinespirits.tutor-stub.run-animation.v1',
    turnCount: frames.length,
    registerPalette,
    dynamicsAxes,
    layers: {
      state: true,
      field: true,
      trajectory: true,
      dynamicalSystem: frames.some((frame) => frame.dynamics.source === 'dynamical_system_policy'),
      registers: frames.some((frame) => frame.register.distribution.length),
    },
    frames,
  };
}

function compactTranscriptTurn({ turn, index, fieldRows }) {
  const fieldRow = fieldRows[index] || lightweightFieldTurn(turn, fieldRows[index - 1] || null);
  const selection = turn?.registerSelection || {};
  const fallbackTrajectory = reconstructedTrajectoryFromFieldRows(fieldRows, index);
  const policyTrajectory =
    selection.dynamical_system_policy?.trajectory || selection.trajectory_policy?.trajectory || null;
  const trajectory = compactTrajectory(policyTrajectory, fallbackTrajectory);
  const state = compactFrameState({ turn, fieldRow, selection });
  const analysis = turn?.classification?.turn || {};
  const efficacy = turn?.previousRegisterEfficacy || null;
  const leakAudit = turn?.tutorLeakAudit || null;
  return {
    schema: 'machinespirits.tutor-stub.transcript-turn.v1',
    turn: turn?.turn ?? index + 1,
    learner: String(turn?.learner || ''),
    tutor: String(turn?.tutor || ''),
    excerpts: {
      learner: textSnippet(turn?.learner, 260),
      tutor: textSnippet(turn?.tutor, 260),
    },
    register: {
      policy: selection.policy || null,
      selected: selection.selected_register || null,
      mode: selection.selected_mode || null,
      actionFamily: selection.action_family || null,
      valence: selection.valence || null,
      probability: roundOptionalField(selection.selected_probability ?? selection.confidence),
      vector: selection.register_vector || selection.continuous_register_policy?.register_vector || null,
      vectorEntropyBits: roundOptionalField(
        selection.register_vector_entropy_bits ?? selection.continuous_register_policy?.entropy_bits,
      ),
      continuous: selection.continuous_register_policy || null,
      reason: textSnippet(selection.register_reason, 360),
      evidenceSpan: textSnippet(selection.evidence_span, 260),
      expectedDagMove: textSnippet(selection.expected_dag_move, 260),
      expectedFieldMove: textSnippet(selection.expected_field_move, 260),
      riskFlags: Array.isArray(selection.risk_flags) ? selection.risk_flags.slice(0, 8) : [],
    },
    learnerState: {
      summary: textSnippet(analysis.summary, 320),
      requestType: state.classifier.requestType || analysis.request_type || 'unknown',
      discourseMove: state.classifier.discourseMove || analysis.discourse_move || 'unknown',
      evidenceUse: state.classifier.evidenceUse || analysis.evidence_use || 'unknown',
      epistemicStance: state.classifier.epistemicStance || analysis.epistemic_stance || 'unknown',
      agency: state.classifier.agency || analysis.agency || 'unknown',
      affect: state.classifier.affect || analysis.affect || 'unknown',
      scores: state.classifier.scores || {},
    },
    dag: state.dag,
    humanDiscourse: turn?.humanDiscourseFrame || null,
    field: {
      learnerMastery: fieldRow.learnerMastery,
      learnerRisk: fieldRow.learnerRisk,
      tutorAlignment: fieldRow.tutorAlignment,
      jointMomentum: fieldRow.jointMomentum,
      coverage: fieldRow.coverage,
      speed: fieldRow.speed,
      bottleneck: fieldRow.bottleneck,
      learnerMove: fieldRow.learnerMove,
    },
    trajectory: {
      source: trajectory.source,
      fieldVelocity: roundOptionalField(trajectory.field?.velocity),
      dagVelocity: roundOptionalField(trajectory.dag?.velocity),
      riskVelocity: roundOptionalField(trajectory.risk?.velocity),
      flags: trajectory.flags || {},
    },
    events: frameEvents({ turn, fieldRow, trajectory, selection }),
    response: {
      repaired: Boolean(turn?.tutorResponseRepaired),
      deterministicFallback: Boolean(turn?.tutorDeterministicFallback),
      leakOk: leakAudit ? leakAudit.ok !== false : null,
      leaks: Array.isArray(leakAudit?.leaks) ? leakAudit.leaks.map((leak) => textSnippet(leak, 160)).slice(0, 5) : [],
      efficacyLabel: efficacy?.label || null,
      efficacyProgressScore: roundOptionalField(efficacy?.progressScore),
    },
  };
}

function buildTranscriptDrilldown(turnRecords = [], fieldViz = null) {
  const fieldRows = fieldViz?.rows?.length ? fieldViz.rows : buildLightweightDialogueField(turnRecords).rows;
  const turns = turnRecords.map((turn, index) => compactTranscriptTurn({ turn, index, fieldRows }));
  if (!turns.length) return null;
  return {
    schema: 'machinespirits.tutor-stub.transcript-drilldown.v1',
    turnCount: turns.length,
    turns,
  };
}

function trainingDelta(nextField = {}, currentField = {}, key) {
  if (!nextField || nextField[key] === undefined || !currentField || currentField[key] === undefined) return null;
  return fieldDelta(nextField[key], currentField[key]);
}

function rewardProxyFromFrames({ frame, nextFrame, transcriptTurn }) {
  const currentField = frame?.field || {};
  const nextField = nextFrame?.field || null;
  const deltas = nextField
    ? {
        learnerMastery: trainingDelta(nextField, currentField, 'learnerMastery'),
        learnerRisk: trainingDelta(nextField, currentField, 'learnerRisk'),
        coverage: trainingDelta(nextField, currentField, 'coverage'),
        tutorAlignment: trainingDelta(nextField, currentField, 'tutorAlignment'),
        jointMomentum: trainingDelta(nextField, currentField, 'jointMomentum'),
      }
    : {
        learnerMastery: null,
        learnerRisk: null,
        coverage: null,
        tutorAlignment: null,
        jointMomentum: null,
      };
  const leakPenalty = transcriptTurn?.response?.leakOk === false ? 1 : 0;
  const repairedPenalty = transcriptTurn?.response?.repaired ? 0.25 : 0;
  const score =
    deltas.learnerMastery === null
      ? null
      : roundOptionalField(
          Number(deltas.learnerMastery || 0) * 0.38 -
            Number(deltas.learnerRisk || 0) * 0.28 +
            Number(deltas.coverage || 0) * 0.24 +
            Number(deltas.jointMomentum || 0) * 0.1 -
            leakPenalty * 0.8 -
            repairedPenalty,
        );
  return {
    schema: 'machinespirits.tutor-stub.reward-proxy.v1',
    score,
    deltas,
    penalties: {
      leak: leakPenalty,
      repaired: repairedPenalty,
    },
    note:
      'Exploratory proxy only: positive mastery/coverage/momentum and falling risk are useful for transition-model fitting, not a paper-grade learning effect.',
  };
}

function buildTurnTrainingExamples({ animatedViz = null, transcript = null } = {}) {
  const frames = Array.isArray(animatedViz?.frames) ? animatedViz.frames : [];
  const turns = Array.isArray(transcript?.turns) ? transcript.turns : [];
  if (!frames.length && !turns.length) return null;
  const count = Math.max(frames.length, turns.length);
  const examples = [];
  for (let index = 0; index < count; index += 1) {
    const frame = frames[index] || {};
    const turn = turns[index] || {};
    const nextFrame = frames[index + 1] || null;
    const rewardProxy = rewardProxyFromFrames({ frame, nextFrame, transcriptTurn: turn });
    examples.push({
      schema: 'machinespirits.tutor-stub.turn-training-example.v1',
      turn: frame.turn ?? turn.turn ?? index + 1,
      policy: frame.policy || turn.register?.policy || null,
      action: {
        selectedRegister: frame.selectedRegister || turn.register?.selected || null,
        registerPolicy: frame.register?.policy || turn.register?.policy || null,
        registerVector: frame.register?.vector || turn.register?.vector || null,
        registerDistribution: frame.register?.distribution || null,
        registerVectorEntropyBits: frame.register?.vectorEntropyBits ?? turn.register?.vectorEntropyBits ?? null,
        tutorText: turn.tutor || frame.snippets?.tutor || '',
      },
      stateBeforeAction: {
        learnerText: turn.learner || frame.snippets?.learner || '',
        learnerState: turn.learnerState || frame.state?.classifier || {},
        dag: frame.state?.dag || turn.dag || {},
        field: frame.field || turn.field || {},
        stateVector: frame.dynamics?.stateVector || {},
        derivativeVector: frame.dynamics?.derivativeVector || {},
        trajectory: frame.trajectory || turn.trajectory || {},
        humanDiscourse: frame.humanDiscourse || turn.humanDiscourse || null,
      },
      outcomeAfterNextLearner: nextFrame
        ? {
            nextTurn: nextFrame.turn ?? null,
            dag: nextFrame.state?.dag || {},
            field: nextFrame.field || {},
            stateVector: nextFrame.dynamics?.stateVector || {},
            derivativeVector: nextFrame.dynamics?.derivativeVector || {},
            groundedClosure:
              nextFrame.state?.dag?.bottleneck === 'grounded_asserted_secret' ||
              (nextFrame.state?.dag?.finalSecretEntailed === true && nextFrame.state?.dag?.assertedSecret === true),
          }
        : null,
      response: turn.response || {},
      events: Array.from(new Set([...(frame.events || []), ...(turn.events || [])])).filter(Boolean),
      rewardProxy,
      frame,
      transcriptTurn: turn,
    });
  }
  return {
    schema: 'machinespirits.tutor-stub.turn-training-examples.v1',
    purpose: 'transition_and_reward_modeling',
    turnCount: examples.length,
    examples,
  };
}

function summarizeLearnerBehavior(turnRecords = []) {
  const analyses = turnRecords.map((turn) => turn?.classification?.turn || null).filter(Boolean);
  const conceptualScores = analyses
    .map((turn) => numericScore(turn.scores?.conceptual_engagement))
    .filter((value) => value !== null);
  const readinessScores = analyses
    .map((turn) => numericScore(turn.scores?.epistemic_readiness))
    .filter((value) => value !== null);
  const learnerWords = turnRecords.map((turn) => wordsInText(turn?.learner)).filter((value) => value > 0);
  const firstTurn = turnRecords[0] || {};
  const finalTurn = turnRecords.at(-1) || {};
  return {
    schema: 'machinespirits.tutor-stub.learner-behavior-summary.v1',
    turnCount: turnRecords.length,
    classifiedTurnCount: analyses.length,
    meanLearnerWords: mean(learnerWords),
    meanConceptualEngagement: mean(conceptualScores),
    meanEpistemicReadiness: mean(readinessScores),
    requestTypeCounts: countBy(analyses.map((turn) => turn.request_type).filter(Boolean)),
    discourseMoveCounts: countBy(analyses.map((turn) => turn.discourse_move).filter(Boolean)),
    evidenceUseCounts: countBy(analyses.map((turn) => turn.evidence_use).filter(Boolean)),
    epistemicStanceCounts: countBy(analyses.map((turn) => turn.epistemic_stance).filter(Boolean)),
    agencyCounts: countBy(analyses.map((turn) => turn.agency).filter(Boolean)),
    affectCounts: countBy(analyses.map((turn) => turn.affect).filter(Boolean)),
    firstLearner: textSnippet(firstTurn.learner, 220),
    finalLearner: textSnippet(finalTurn.learner, 220),
    firstClassification: textSnippet(firstTurn.classification?.turn?.summary, 220),
    finalClassification: textSnippet(finalTurn.classification?.turn?.summary, 220),
  };
}

function summarizeHumanDiscourse(turnRecords = []) {
  const frames = turnRecords.map((turn) => turn?.humanDiscourseFrame).filter(Boolean);
  if (!frames.length) return null;
  const finalFrame = frames.at(-1) || null;
  const proofDebtCounts = frames.reduce(
    (acc, frame) => {
      acc.open += Number(frame?.proofDebt?.counts?.open || 0);
      acc.harmful += Number(frame?.proofDebt?.counts?.harmful || 0);
      acc.discharged += Number(frame?.proofDebt?.counts?.discharged || 0);
      return acc;
    },
    { open: 0, harmful: 0, discharged: 0 },
  );
  return {
    schema: 'machinespirits.tutor-stub.human-discourse-summary.v1',
    mode: finalFrame?.mode || frames[0]?.mode || null,
    scaffoldActive: frames.some((frame) => frame.scaffoldActive),
    turnCount: frames.length,
    sideArcCount: frames.filter((frame) => frame.sideArc?.detected).length,
    proofDebtCounts,
    finalStatus: finalFrame?.warrantPremiseAudit?.proofStatus || null,
    finalProofDebtStatus: finalFrame?.proofDebt?.status || null,
    finalBranch: finalFrame?.scaffoldState?.branch || null,
    finalFrame,
  };
}

function fieldPolyline(rows, key, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const y = padding.top + (1 - clampField01(row[key])) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function fieldTurnMarkers(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  return rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const label = escapeXml(
        `${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${displayBottleneck(row.bottleneck)}`,
      );
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 9).toFixed(
        1,
      )}" r="2.5" fill="#0A0A0A"><title>${label}</title></circle>`;
    })
    .join('\n');
}

function fieldTurnAxis(rows, { width, height, padding }) {
  if (!rows.length) return '';
  const xSpan = Math.max(1, rows.length - 1);
  const tickEvery = Math.max(1, Math.ceil(rows.length / 6));
  const baseline = padding.top + height;
  const ticks = rows
    .map((row, index) => {
      const x = padding.left + (index / xSpan) * width;
      const showLabel = rows.length <= 8 || index === 0 || index === rows.length - 1 || index % tickEvery === 0;
      return [
        `<line x1="${x.toFixed(1)}" y1="${baseline.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(baseline + 7).toFixed(
          1,
        )}" stroke="#0A0A0A" stroke-width="1" />`,
        showLabel
          ? `<text x="${x.toFixed(1)}" y="${(baseline + 22).toFixed(
              1,
            )}" text-anchor="middle" font-size="10" fill="#525252">${escapeXml(row.turn ?? index + 1)}</text>`
          : '',
      ].join('');
    })
    .join('\n');
  return `${ticks}
  <text x="${(padding.left + width / 2).toFixed(1)}" y="${(baseline + 44).toFixed(
    1,
  )}" text-anchor="middle" font-size="11" font-weight="700" fill="#0A0A0A">turns</text>`;
}

function renderLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 88, right: 34, bottom: 68, left: 58 };
  const chartWidth = 660;
  const chartHeight = 220;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#0A0A0A', ''],
    ['learnerRisk', 'risk', '#E63946', '8 5'],
    ['tutorAlignment', 'alignment', '#0057B8', '2 5'],
    ['jointMomentum', 'momentum', '#D98E04', '12 4 2 4'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#D4D4D8" />`,
        `<text x="${padding.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#525252">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color, dash]) =>
        `<polyline points="${fieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"${
          dash ? ` stroke-dasharray="${dash}"` : ''
        }><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 145}, 62)"><rect width="11" height="11" fill="${color}" stroke="#0A0A0A" /><text x="16" y="10" font-size="11" font-weight="700" fill="#0A0A0A">${label}: ${escapeXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const riskReduction = Number.isFinite(Number(delta.learnerRisk)) ? -Number(delta.learnerRisk) : Number.NaN;
  const deltaText = `mastery gain ${formatSignedField(delta.learnerMastery)} | risk reduction ${formatPositiveField(
    riskReduction,
  )} | alignment change ${formatSignedField(delta.tutorAlignment)} | momentum change ${formatSignedField(delta.jointMomentum)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img">
  <title>${escapeXml(title)}</title>
  <desc>Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#FFFFFF" />
  <rect width="100%" height="8" fill="#E63946" />
  <text x="${padding.left}" y="28" font-size="18" font-weight="700" fill="#0A0A0A">${escapeXml(title)}</text>
  <text x="${padding.left}" y="49" font-size="12" fill="#525252">turns ${field.turnCount}; mean speed ${escapeXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${escapeXml(deltaText)}; status ${escapeXml(displayBottleneck(final.bottleneck))}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#FAFAFA" stroke="#0A0A0A" stroke-width="1.5" />
  ${gridLines}
  ${lines}
  ${fieldTurnAxis(rows, { width: chartWidth, height: chartHeight, padding })}
  ${fieldTurnMarkers(rows, { width: chartWidth, height: chartHeight, padding })}
  ${legend}
</svg>`;
}

function progressBar(completed, total, { width = 28 } = {}) {
  const ratio = total ? Math.max(0, Math.min(1, completed / total)) : 0;
  const filled = Math.round(ratio * width);
  const bar = `${'#'.repeat(filled)}${'-'.repeat(Math.max(0, width - filled))}`;
  return `[${bar}] ${completed}/${total} ${Math.round(ratio * 100)}%`;
}

function printProgress({ completed, total, label = '' }) {
  if (args['no-progress']) return;
  const suffix = label ? ` ${label}` : '';
  console.log(`[auto-eval] ${progressBar(completed, total)}${suffix}`);
}

function printTurnProgress({ completed, total, activeJobs, results }) {
  if (args['no-progress'] || args['dry-run']) return;
  const active = Array.from(activeJobs.values());
  if (!active.length) return;
  const turnCap =
    turnsArg() === 'until-grounded'
      ? positiveInt(args['safety-turns'], '--safety-turns')
      : positiveInt(args.turns, '--turns');
  const completedTurns = results.reduce((sum, result) => {
    const summaries = Array.isArray(result.traceSummaries) ? result.traceSummaries : [];
    return sum + summaries.reduce((inner, summary) => inner + Number(summary.turnCount || 0), 0);
  }, 0);
  const activeSummaries = active.map(summarizeJobProgress);
  const activeTurns = activeSummaries.reduce((sum, summary) => sum + summary.turns, 0);
  const totalTurns = completedTurns + activeTurns;
  const maxTurns = total * turnCap;
  const activeText = activeSummaries
    .map((summary) => {
      const coverage = summary.coverage === null ? '' : ` c${summary.coverage}`;
      const bottleneck = summary.bottleneck ? ` ${displayBottleneck(summary.bottleneck)}` : '';
      const last = summary.lastType ? ` ${summary.lastType}` : '';
      return `${summary.key}:${summary.turns}t${coverage}${bottleneck}${last}`;
    })
    .join(' | ');
  console.log(
    `[auto-eval] ${progressBar(completed, total)} turns ${totalTurns}/${maxTurns} max; active ${active.length}/${total - completed}: ${activeText}`,
  );
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function readTraceEvents(tracePath) {
  if (!tracePath || !fs.existsSync(tracePath)) return [];
  return fs.readFileSync(tracePath, 'utf8').split('\n').filter(Boolean).map(parseJsonLine).filter(Boolean);
}

function latestTraceFile(traceDir) {
  return listTraceFiles(traceDir).at(-1) || null;
}

function summarizeJobProgress(job) {
  const tracePath = latestTraceFile(job.traceDir);
  if (!tracePath) {
    return {
      key: job.key,
      turns: 0,
      coverage: null,
      bottleneck: '',
      lastType: 'starting',
    };
  }
  const events = readTraceEvents(tracePath);
  const turns = events.filter((event) => event.type === 'turn_complete');
  const lastTurn = turns.at(-1)?.turnRecord || {};
  const assessment = lastTurn.tutorLearnerDagModel?.assessment || {};
  return {
    key: job.key,
    turns: turns.length,
    coverage: assessment.bestPathCoverage ?? null,
    bottleneck: assessment.bottleneck || '',
    lastType: events.at(-1)?.type || '',
  };
}

function summarizeResultProgress(result) {
  const summary = Array.isArray(result?.traceSummaries) ? result.traceSummaries.at(-1) : null;
  return {
    key: result?.key || `${safeSlug(result?.policy || 'unknown')}-r${result?.runIndex || '?'}`,
    turns: Number(summary?.turnCount || 0),
    coverage: summary?.bestPathCoverage ?? null,
    bottleneck: summary?.bottleneck || '',
    lastType: summary?.stopReason || result?.status || '',
  };
}

function summarizeTrace(tracePath, traceDir) {
  const events = readTraceEvents(tracePath);
  const turns = events.filter((event) => event.type === 'turn_complete');
  const turnRecords = turns.map((event) => event.turnRecord).filter(Boolean);
  const runEnds = events.filter((event) => event.type === 'run_end' || event.type === 'auto_learner_run_end');
  const fieldWrite = events.filter((event) => event.type === 'field_visualization_write').at(-1) || null;
  const fieldViz = buildLightweightDialogueField(turnRecords);
  const animatedViz = buildAnimatedRunVisualization(turnRecords, fieldViz);
  const transcript = buildTranscriptDrilldown(turnRecords, fieldViz);
  const trainingExamples = buildTurnTrainingExamples({ animatedViz, transcript });
  const learnerBehavior = summarizeLearnerBehavior(turnRecords);
  const humanDiscourse = summarizeHumanDiscourse(turnRecords);
  const lastTurn = turns.at(-1)?.turnRecord || {};
  const assessment = lastTurn.tutorLearnerDagModel?.assessment || {};
  const metrics = lastTurn.tutorLearnerDagModel?.metrics || {};
  const registers = turns.map((event) => event.turnRecord?.registerSelection?.selected_register).filter(Boolean);
  const efficacies = turns.map((event) => event.turnRecord?.previousRegisterEfficacy?.label).filter(Boolean);
  const leakCount = turns.reduce((sum, event) => {
    const leaks = event.turnRecord?.tutorLeakAudit?.leaks;
    if (Array.isArray(leaks)) return sum + leaks.length;
    return sum + (event.turnRecord?.tutorLeakAudit?.ok === false ? 1 : 0);
  }, 0);
  const groundedClosure = Boolean(
    assessment.bottleneck === 'grounded_asserted_secret' ||
    (assessment.finalSecretEntailed === true && assessment.assertedSecret === true),
  );
  const modelErrors = events.filter((event) => /error/i.test(String(event.type)));
  return {
    trace: path.relative(ROOT, tracePath),
    traceRelative: path.relative(traceDir, tracePath),
    events: events.length,
    turnCount: turns.length,
    lastTurn: turns.at(-1)?.turn ?? null,
    stopReason: runEnds.at(-1)?.reason || null,
    groundedClosure,
    bestPathCoverage: Number(assessment.bestPathCoverage ?? 0),
    missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? 0),
    bottleneck: assessment.bottleneck || 'unknown',
    finalLearner: lastTurn.learner || '',
    finalTutor: lastTurn.tutor || '',
    registerCounts: countBy(registers),
    registerEntropy: entropy(registers),
    efficacyCounts: countBy(efficacies),
    leakCount,
    repairedCount: turns.filter((event) => event.turnRecord?.tutorResponseRepaired).length,
    fallbackCount: turns.filter((event) => event.turnRecord?.tutorDeterministicFallback).length,
    errorCount: modelErrors.length,
    field: fieldViz.turnCount
      ? {
          final: fieldViz.summary.final || null,
          delta: fieldViz.summary.fieldDelta || null,
          meanSpeed: fieldViz.summary.meanSpeed ?? null,
          source: fieldWrite?.summary ? 'trace_event' : 'reconstructed',
        }
      : fieldWrite?.summary
        ? {
            final: fieldWrite.summary.final || null,
            delta: fieldWrite.summary.fieldDelta || null,
            meanSpeed: fieldWrite.summary.meanSpeed ?? null,
            source: 'trace_event',
          }
        : null,
    fieldViz: fieldViz.turnCount ? fieldViz : null,
    animatedViz,
    transcript,
    trainingExamples,
    learnerBehavior,
    humanDiscourse,
  };
}

function resolveTracePath(tracePath, traceDir) {
  if (!tracePath) return null;
  if (path.isAbsolute(tracePath)) return tracePath;
  const fromTraceDir = path.join(traceDir, tracePath);
  if (fs.existsSync(fromTraceDir)) return fromTraceDir;
  return path.join(ROOT, tracePath);
}

function resultRows(results) {
  return results.flatMap((result) => {
    const summaries = Array.isArray(result.traceSummaries) ? result.traceSummaries : [];
    if (!summaries.length) {
      return [
        {
          policy: result.policy,
          runIndex: result.runIndex,
          status: result.status,
          exitCode: result.exitCode ?? null,
          signal: result.signal || null,
          trace: null,
          log: result.log || null,
          turnCount: 0,
          groundedClosure: false,
          bestPathCoverage: 0,
          missingPremiseCount: null,
          bottleneck: 'none',
          stopReason: result.status,
          registerCounts: {},
          registerEntropy: 0,
          efficacyCounts: {},
          leakCount: 0,
          repairedCount: 0,
          fallbackCount: 0,
          errorCount: 0,
          field: null,
          fieldViz: null,
          animatedViz: null,
          transcript: null,
          trainingExamples: null,
          learnerBehavior: null,
        },
      ];
    }
    return summaries.map((summary) => ({
      policy: result.policy,
      runIndex: result.runIndex,
      status: result.status,
      exitCode: result.exitCode ?? null,
      signal: result.signal || null,
      log: result.log || null,
      ...summary,
    }));
  });
}

function summarizeRows(rows) {
  const completed = rows.filter((row) => row.status !== 'dry_run');
  const scored = completed.filter((row) => row.status !== 'failed');
  const scoredRegisters = scored.flatMap((row) =>
    Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
      Array.from({ length: count }, () => register),
    ),
  );
  const byPolicy = {};
  for (const row of rows) {
    if (!byPolicy[row.policy]) byPolicy[row.policy] = [];
    byPolicy[row.policy].push(row);
  }
  const summarizeBucket = (bucketRows) => {
    const liveRows = bucketRows.filter((row) => row.status !== 'dry_run');
    const okRows = liveRows.filter((row) => row.status !== 'failed');
    const registers = okRows.flatMap((row) =>
      Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
        Array.from({ length: count }, () => register),
      ),
    );
    return {
      rows: bucketRows.length,
      ok: okRows.length,
      failed: liveRows.filter((row) => row.status === 'failed').length,
      dryRun: bucketRows.filter((row) => row.status === 'dry_run').length,
      grounded: okRows.filter((row) => row.groundedClosure).length,
      groundedRate: okRows.length
        ? Number((okRows.filter((row) => row.groundedClosure).length / okRows.length).toFixed(3))
        : 0,
      meanTurns: mean(okRows.map((row) => row.turnCount)),
      meanCoverage: mean(okRows.map((row) => row.bestPathCoverage)),
      meanMissing: mean(okRows.map((row) => row.missingPremiseCount)),
      meanFieldMasteryDelta: mean(okRows.map((row) => row.field?.delta?.learnerMastery)),
      meanFieldRiskDelta: mean(okRows.map((row) => row.field?.delta?.learnerRisk)),
      registerCounts: countBy(registers),
      registerEntropy: entropy(registers),
      leakCount: okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0),
      errorCount: okRows.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
    };
  };
  return {
    rows: rows.length,
    completed: completed.length,
    ok: scored.length,
    failed: completed.filter((row) => row.status === 'failed').length,
    dryRun: rows.filter((row) => row.status === 'dry_run').length,
    grounded: scored.filter((row) => row.groundedClosure).length,
    groundedRate: scored.length
      ? Number((scored.filter((row) => row.groundedClosure).length / scored.length).toFixed(3))
      : 0,
    meanTurns: mean(scored.map((row) => row.turnCount)),
    meanCoverage: mean(scored.map((row) => row.bestPathCoverage)),
    meanMissing: mean(scored.map((row) => row.missingPremiseCount)),
    registerCounts: countBy(scoredRegisters),
    registerEntropy: entropy(scoredRegisters),
    leakCount: scored.reduce((sum, row) => sum + Number(row.leakCount || 0), 0),
    errorCount: scored.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
    byPolicy: Object.fromEntries(
      Object.entries(byPolicy).map(([policy, bucketRows]) => [policy, summarizeBucket(bucketRows)]),
    ),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pctBar(value, { max = 1 } = {}) {
  const ratio = max ? Math.max(0, Math.min(1, Number(value || 0) / max)) : 0;
  return `<span class="mini-bar"><span style="width:${Math.round(ratio * 100)}%"></span></span>`;
}

function htmlMetric(label, value, sub = '') {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div>`;
}

function htmlMetricInfo(label, tooltip, value, sub = '') {
  return `<div class="metric"><div class="metric-label">${infoTerm(label, tooltip)}</div><div class="metric-value">${escapeHtml(value)}</div><div class="metric-sub">${escapeHtml(sub)}</div></div>`;
}

function machineSpiritsReportCss() {
  return `
    @import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=JetBrains+Mono:wght@400;500;600&display=swap");

    :root {
      color-scheme: light;
      --paper:#FFFFFF;
      --paper-2:#F4F4F5;
      --paper-3:#FAFAFA;
      --paper-4:#FFFFFF;
      --ink:#0A0A0A;
      --ink-2:#262626;
      --ink-3:#525252;
      --ink-4:#8A8A8A;
      --linen:#D4D4D8;
      --moss:#171717;
      --moss-deep:#000000;
      --moss-soft:#ECECEC;
      --brick:#E63946;
      --brick-d:#C1121F;
      --brick-soft:#FBE3E5;
      --blue:#0057B8;
      --blue-soft:#DDEBFF;
      --yellow:#F2B705;
      --yellow-soft:#FFF1B8;
      --green:#009B72;
      --green-soft:#DDF7EE;
      --violet:#6B4EFF;
      --violet-soft:#E8E3FF;
      --magenta:#D72670;
      --magenta-soft:#FFE0EE;
      --ochre:#737373;
      --ochre-d:#525252;
      --ochre-soft:#EDEDED;
      --indigo:#404040;
      --indigo-soft:#EDEDED;
      --red-mark:#E63946;
      --rule:rgba(10,10,10,0.22);
      --rule-soft:rgba(10,10,10,0.09);
      --ease:cubic-bezier(.22,.61,.36,1);
      --bg:var(--paper);
      --panel:var(--paper-4);
      --panel-2:var(--paper-2);
      --muted:var(--ink-3);
      --line:var(--rule);
      --accent:var(--moss-deep);
      --accent-soft:var(--moss-soft);
      --text:var(--ink-2);
      --good:var(--moss-deep);
      --warn:var(--ochre-d);
      --bad:var(--brick-d);
      --red:var(--red-mark);
      --blue:var(--indigo);
    }
    * { box-sizing:border-box; }
    html, body { margin:0; padding:0; max-width:100%; overflow-x:hidden; }
    html { background:var(--paper); -webkit-text-size-adjust:100%; }
    body {
      min-height:100vh;
      background:var(--paper);
      color:var(--ink-2);
      font-family:"Source Serif 4", "Source Serif Pro", Cambria, Georgia, serif;
      font-feature-settings:"ss01", "kern", "liga";
      font-optical-sizing:auto;
      font-size:15px;
      line-height:1.5;
      letter-spacing:0.003em;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
      position:relative;
    }
    body::before {
      content:"";
      position:fixed;
      inset:0;
      z-index:-2;
      pointer-events:none;
      background:
        radial-gradient(130% 90% at 50% 0%, transparent 48%, rgba(10,10,10,0.06) 100%),
        radial-gradient(75% 55% at 8% 92%, rgba(230,57,70,0.04), transparent 70%),
        radial-gradient(70% 60% at 96% 14%, rgba(10,10,10,0.04), transparent 70%);
      mix-blend-mode:multiply;
    }
    body::after {
      content:"";
      position:fixed;
      inset:0;
      z-index:-1;
      pointer-events:none;
      opacity:0.14;
      background-image:radial-gradient(rgba(20,16,12,0.55) 0.5px, transparent 0.5px);
      background-size:3px 3px;
      mix-blend-mode:multiply;
    }
    h1, h2, h3, h4 {
      font-family:"Fraunces", "Source Serif 4", Georgia, serif;
      font-optical-sizing:auto;
      font-variation-settings:"SOFT" 50, "WONK" 1, "opsz" 96;
      color:var(--ink);
      font-weight:500;
      letter-spacing:-0.012em;
      line-height:1.12;
      margin:0 0 0.5em;
    }
    h1 { font-size:clamp(1.6rem, 1.1rem + 1.2vw, 2.35rem); }
    h2 { margin:34px 0 12px; font-size:1.2rem; }
    h3 { font-size:1rem; }
    a { color:var(--brick-d); text-underline-offset:2px; }
    a:hover { color:var(--brick); }
    code, kbd, samp, .sub, .muted, .metric-label, .metric-sub, .control span, th, button, input, select, textarea, .chip, .status, .scope-badge, .scope-note, .learner-eyebrow, .readout-label, .snippet-label, .event-chip, .live-count, .live-run-meta, .live-run-progress, .index-measure em, .index-measure span, .read-first-note {
      font-family:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    header {
      max-width:1360px;
      margin:0 auto;
      padding:28px clamp(18px, 4vw, 44px) 18px;
      border-bottom:1px solid var(--rule);
    }
    main {
      max-width:1360px;
      margin:0 auto;
      padding:22px clamp(18px, 4vw, 44px) 44px;
    }
    main.report-main { max-width:1540px; }
    .report-shell {
      display:grid;
      grid-template-columns:190px minmax(0,1fr);
      gap:22px;
      align-items:start;
    }
    .report-content { min-width:0; }
    .report-section {
      min-width:0;
      scroll-margin-top:18px;
    }
    .report-nav {
      position:sticky;
      top:14px;
      max-height:calc(100vh - 28px);
      overflow:auto;
      border:1px solid var(--rule);
      background:rgba(247,239,221,0.88);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
      padding:12px;
    }
    .report-nav-title {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.12em;
      text-transform:uppercase;
      margin-bottom:8px;
    }
    .report-nav-list { display:grid; gap:4px; }
    .report-nav a {
      display:block;
      border-left:3px solid var(--rule);
      color:var(--ink-2);
      padding:6px 8px 6px 9px;
      text-decoration:none;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      line-height:1.25;
    }
    .report-nav a:hover, .report-nav a:focus {
      border-left-color:var(--brick);
      background:var(--brick-soft);
      color:var(--brick-d);
      outline:0;
    }
    .visually-hidden {
      position:absolute;
      width:1px;
      height:1px;
      overflow:hidden;
      clip:rect(0 0 0 0);
      white-space:nowrap;
      clip-path:inset(50%);
    }
    .sub, .muted {
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.04em;
    }
    .header-links { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    .header-links a, .field-link, .live-actions a, .live-links a, .actions a {
      display:inline-flex;
      align-items:center;
      min-height:28px;
      border:1px solid var(--rule);
      background:var(--paper-4);
      color:var(--brick-d);
      padding:3px 9px;
      text-decoration:none;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.02em;
    }
    .header-links a:hover, .field-link:hover, .live-actions a:hover, .live-links a:hover, .actions a:hover {
      background:var(--brick-soft);
      color:var(--brick-d);
    }
    .summary-panel { display:grid; grid-template-columns:minmax(0,1fr) 330px; gap:14px; align-items:start; margin:18px 0 4px; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:16px 0; }
    .summary-panel .metrics { margin:0; }
    .big-picture {
      margin:18px 0 20px;
      border-top:2px solid var(--ink);
      padding-top:14px;
    }
    .big-picture-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin:0 0 12px;
    }
    .big-picture-head h2 { margin:0; }
    .big-picture-head p {
      margin:4px 0 0;
      max-width:980px;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .big-picture-grid {
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:14px;
      align-items:start;
    }
    .big-picture-panel {
      min-width:0;
      grid-column:1 / -1;
      background:rgba(247,239,221,0.76);
      border:1px solid var(--rule);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
      padding:14px 15px;
      overflow:hidden;
    }
    .big-picture-panel-wide {
      grid-column:1 / -1;
    }
    .big-picture-panel h3 {
      margin:0 0 9px;
      font-size:1rem;
    }
    .learner-infographic {
      display:grid;
      gap:12px;
    }
    .learner-dashboard-grid {
      display:grid;
      grid-template-columns:minmax(0,1.34fr) minmax(280px,.66fr);
      gap:12px;
      align-items:stretch;
    }
    .learner-snapshot {
      display:grid;
      gap:10px;
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--red-mark);
      padding:12px;
    }
    .learner-snapshot-head {
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:flex-start;
      border-bottom:2px solid var(--ink);
      padding-bottom:8px;
    }
    .learner-snapshot-head strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.1em;
      text-transform:uppercase;
    }
    .learner-snapshot-head span {
      color:var(--ink-3);
      font-size:12px;
      line-height:1.25;
    }
    .learner-kpi-grid {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:8px;
    }
    .learner-kpi {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--kpi-accent, var(--ink));
      padding:9px 10px;
    }
    .learner-kpi span {
      display:block;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-kpi strong {
      display:block;
      margin-top:2px;
      color:var(--ink);
      font-family:"Fraunces", Georgia, serif;
      font-size:24px;
      line-height:1;
      overflow-wrap:anywhere;
    }
    .learner-kpi em {
      display:block;
      margin-top:3px;
      color:var(--ink-3);
      font-size:11px;
      font-style:normal;
      line-height:1.25;
    }
    .learner-profile-bars {
      display:grid;
      gap:8px;
    }
    .learner-rowbar {
      display:grid;
      gap:7px;
      border:2px solid var(--ink);
      background:var(--paper);
      padding:8px;
      box-shadow:3px 3px 0 var(--row-accent, var(--ink));
    }
    .learner-rowbar-head {
      display:flex;
      justify-content:space-between;
      gap:8px;
      align-items:baseline;
    }
    .learner-rowbar strong {
      color:var(--ink);
      font-size:14px;
      line-height:1.1;
      overflow-wrap:anywhere;
    }
    .learner-rowbar-head span {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      white-space:nowrap;
    }
    .learner-mini-bars {
      display:grid;
      gap:4px;
    }
    .learner-mini-bar {
      display:grid;
      grid-template-columns:70px minmax(0,1fr) 42px;
      gap:7px;
      align-items:center;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      text-transform:uppercase;
      letter-spacing:0.05em;
    }
    .learner-mini-track {
      height:9px;
      border:1px solid var(--ink);
      background:var(--paper-2);
      overflow:hidden;
    }
    .learner-mini-track span {
      display:block;
      width:var(--bar-width,0%);
      height:100%;
      background:var(--bar-color,var(--red-mark));
    }
    .big-picture-read {
      margin:0;
      padding-left:18px;
      color:var(--ink-2);
      font-size:13px;
      line-height:1.45;
    }
    .big-picture-read li { margin:6px 0; }
    .big-picture-table { min-width:760px; }
    .big-picture-table .numeric { text-align:right; white-space:nowrap; }
    .big-picture-viz-grid {
      display:grid;
      grid-template-columns:minmax(0,1fr);
      gap:12px;
      align-items:start;
      margin-top:12px;
    }
    .big-picture-viz-grid > * {
      min-width:0;
    }
    .viz-frame {
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--ink);
      min-width:0;
      overflow:hidden;
    }
    .viz-frame svg {
      display:block;
      width:100%;
      height:auto;
      min-height:260px;
    }
    .viz-caption {
      display:grid;
      gap:5px;
      padding:8px 10px;
      border-top:2px solid var(--ink);
      background:var(--paper-3);
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      line-height:1.35;
    }
    .learner-readout {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(190px,1fr));
      gap:8px;
      margin:0;
      counter-reset:learner-note;
    }
    .learner-readout-card {
      position:relative;
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--red-mark);
      padding:10px 11px 10px 46px;
    }
    .learner-readout-card::before {
      counter-increment:learner-note;
      content:counter(learner-note, decimal-leading-zero);
      position:absolute;
      left:10px;
      top:10px;
      width:25px;
      height:25px;
      border:2px solid var(--ink);
      background:var(--ink);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      font-weight:800;
      line-height:21px;
      text-align:center;
    }
    .learner-readout-card strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-readout-card p {
      margin:5px 0 0;
      color:var(--ink-2);
      font-size:12px;
      line-height:1.35;
    }
    .learner-card-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));
      gap:9px;
      min-width:0;
    }
    .learner-card {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--card-accent, var(--ink));
      padding:10px;
    }
    .learner-card strong {
      display:block;
      color:var(--ink);
      font-family:"Fraunces", Georgia, serif;
      font-size:18px;
      line-height:1.1;
      overflow-wrap:anywhere;
    }
    .learner-card dl {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:7px 9px;
      margin:9px 0 0;
    }
    .learner-card dt {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:10px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .learner-card dd {
      margin:1px 0 0;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:13px;
      font-weight:700;
    }
    @media (min-width: 1180px) {
      .big-picture-viz-grid {
        grid-template-columns:minmax(420px,1.1fr) minmax(300px,.9fr);
      }
    }
    .policy-bars {
      display:grid;
      gap:8px;
    }
    .policy-bar-row {
      display:grid;
      grid-template-columns:minmax(120px,190px) minmax(160px,1fr) auto;
      gap:10px;
      align-items:center;
    }
    .policy-bar-row strong {
      overflow-wrap:anywhere;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    .policy-bar {
      height:15px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--ink);
      overflow:hidden;
    }
    .policy-bar span {
      display:block;
      height:100%;
      width:var(--bar-width,0%);
      background:var(--bar-color,var(--red));
    }
    .policy-bar-meta {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      white-space:nowrap;
    }
    .big-picture-cautions {
      display:grid;
      gap:8px;
      margin:12px 0 0;
    }
    .big-picture-cautions div {
      border-left:4px solid var(--red);
      background:rgba(255,255,255,0.34);
      padding:8px 10px;
      color:var(--ink-2);
      font-size:12px;
      line-height:1.4;
    }
    .metric, .metric-guide, .learner-profile-card, .learner-behavior-card, .field-card, .viz-player, .live-run-card, table {
      background:rgba(247,239,221,0.86);
      border:1px solid var(--rule);
      box-shadow:0 12px 30px rgba(28,22,16,0.05);
    }
    .metric { padding:13px 14px; }
    .metric-label { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    .metric-value { margin-top:3px; color:var(--ink); font-family:"Fraunces", Georgia, serif; font-size:28px; font-weight:600; line-height:1.05; }
    .metric-sub { color:var(--ink-3); font-size:12px; min-height:18px; }
    .metric-guide { padding:13px 15px; }
    .metric-guide h3 { margin:0 0 9px; }
    .metric-guide dl, .viz-sidebar dl { margin:0; display:grid; gap:8px; }
    .metric-guide dl div, .viz-sidebar dl div { border-top:1px solid var(--rule-soft); padding-top:8px; }
    .metric-guide dl div:first-child, .viz-sidebar dl div:first-child { border-top:0; padding-top:0; }
    .metric-guide dt, .viz-sidebar dt, .learner-chip-grid strong { font-weight:600; color:var(--ink); }
    .metric-guide dd, .viz-sidebar dd { margin:2px 0 0; color:var(--ink-3); font-size:12px; }
    .read-first-note {
      margin:0 0 10px;
      max-width:980px;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .signal-guide {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(210px,1fr));
      gap:10px;
      margin:12px 0 0;
    }
    .signal-guide div {
      border:1px solid var(--rule);
      background:rgba(247,239,221,0.62);
      padding:10px 11px;
    }
    .signal-guide strong {
      display:block;
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .signal-guide p {
      margin:4px 0 0;
      color:var(--ink-3);
      font-size:12px;
      line-height:1.42;
    }
    .learner-panel { display:grid; grid-template-columns:minmax(260px,.85fr) minmax(360px,1.5fr); gap:14px; margin:18px 0 4px; }
    .learner-profile-card, .learner-behavior-card { padding:15px; }
    .learner-eyebrow { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.12em; }
    .learner-profile-card h3 { margin:4px 0 8px; font-size:1.35rem; }
    .learner-profile-card p, .viz-sidebar p, .field-card-summary, .learner-example, .live-job p { color:var(--ink-2); }
    .learner-profile-card dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:0; }
    .learner-profile-card dt, .learner-stat span, .learner-example-label {
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      text-transform:uppercase;
      letter-spacing:0.11em;
    }
    .learner-profile-card dd { margin:2px 0 0; font-weight:600; color:var(--ink); }
    .learner-score-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:8px; margin:8px 0 12px; }
    .learner-stat { border:1px solid var(--rule-soft); padding:9px; background:rgba(251,246,232,0.8); }
    .learner-stat strong { display:block; margin-top:2px; font-family:"Fraunces", Georgia, serif; font-size:20px; color:var(--ink); }
    .learner-stat em { display:block; color:var(--ink-3); font-style:normal; font-size:11px; }
    .learner-chip-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px; }
    .learner-chip, .chip, .event-chip, .status, .scope-badge, .field-badge {
      display:inline-block;
      border:1px solid var(--rule);
      background:var(--paper-3);
      color:var(--ink-2);
      padding:2px 7px;
      font-size:12px;
      white-space:nowrap;
    }
    .learner-chip { margin:0 5px 5px 0; }
    .chip { margin:0 4px 4px 0; }
    .scope-badge {
      margin:0 4px 4px 0;
      background:var(--paper-4);
      color:var(--ink);
      font-weight:700;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    .scope-badge.matrix {
      background:var(--red);
      border-color:var(--ink);
      color:var(--paper);
    }
    .scope-note {
      display:block;
      margin-top:4px;
      color:var(--brick-d);
      font-size:11px;
      line-height:1.35;
      letter-spacing:0.02em;
    }
    .scope-notice {
      margin:0 0 16px;
      border-left:8px solid var(--red);
      background:var(--brick-soft);
      padding:12px 14px;
      color:var(--ink-2);
      box-shadow:4px 4px 0 var(--ink);
    }
    .scope-notice strong {
      display:block;
      color:var(--ink);
      margin-bottom:3px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      letter-spacing:0.08em;
      text-transform:uppercase;
    }
    .scope-notice p { margin:0; font-size:13px; line-height:1.4; }
    .scope-notice a { font-family:"JetBrains Mono", ui-monospace, monospace; font-size:12px; }
    .learner-empty { color:var(--ink-3); font-size:12px; }
    .learner-examples { display:grid; gap:8px; margin-top:12px; }
    .learner-example { border-top:1px solid var(--rule-soft); padding-top:8px; font-size:12px; }
    .field-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:14px; }
    .field-card { overflow:hidden; }
    .field-card-head {
      display:flex;
      justify-content:space-between;
      gap:12px;
      padding:12px 14px;
      border-bottom:1px solid var(--rule);
      background:rgba(233,223,199,0.72);
    }
    .field-card h3 { margin:0 0 3px; }
    .field-actions { display:flex; align-items:flex-start; gap:8px; }
    .field-badge { align-self:flex-start; background:var(--paper-4); }
    .field-card-summary { padding:9px 14px; font-size:12px; border-bottom:1px solid var(--rule-soft); }
    .field-svg { overflow-x:auto; background:var(--paper-4); }
    .field-svg svg { display:block; width:100%; min-width:640px; height:auto; }
    .viz-player { overflow:hidden; }
    .viz-layout { display:grid; grid-template-columns:minmax(0,1fr) 310px; }
    .viz-main { min-width:0; overflow:hidden; }
    .viz-sidebar { border-left:1px solid var(--rule); background:rgba(233,223,199,0.56); padding:14px; }
    .viz-sidebar h3 { margin:0 0 8px; }
    .viz-sidebar p { margin:0 0 12px; font-size:12px; }
    .viz-toolbar, .toolbar {
      border-bottom:1px solid var(--rule);
      background:rgba(233,223,199,0.72);
    }
    .viz-toolbar {
      display:grid;
      grid-template-columns:minmax(220px,1.1fr) minmax(280px,2.2fr) minmax(240px,1.2fr) minmax(160px,.8fr);
      gap:10px;
      align-items:end;
      padding:12px 14px;
    }
    .viz-toolbar label, .control { display:flex; flex-direction:column; gap:4px; color:var(--ink-3); font-size:12px; }
    .viz-control-group { min-width:0; }
    .viz-group-label {
      display:block;
      color:var(--ink-3);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      letter-spacing:0.11em;
      text-transform:uppercase;
      margin-bottom:4px;
    }
    .viz-toolbar select, .viz-toolbar button, .viz-toolbar input, input, select, button {
      width:100%;
      min-height:38px;
      border:1px solid var(--rule);
      background:var(--paper-4);
      color:var(--ink);
      padding:7px 9px;
      border-radius:0;
      font:inherit;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    button {
      width:auto;
      cursor:pointer;
      color:var(--brick-d);
      font-weight:600;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    button:hover { background:var(--brick-soft); }
    .viz-mode-buttons, .viz-step-buttons { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
    .viz-mode-buttons button, .viz-step-buttons button { width:auto; }
    .viz-mode-buttons button.active {
      border-color:var(--moss-deep);
      background:var(--moss-deep);
      color:var(--paper);
    }
    .viz-range-label input { min-width:150px; accent-color:var(--brick); }
    .viz-help-strip {
      border-bottom:1px solid var(--rule);
      padding:9px 14px;
      color:var(--ink-2);
      background:rgba(247,239,221,0.82);
      font-size:12px;
    }
    .viz-canvas-wrap { background:var(--paper-4); }
    .viz-canvas-wrap canvas { display:block; width:100%; height:420px; }
    .viz-readout {
      margin:0;
      min-height:118px;
      padding:12px 14px;
      border-top:1px solid var(--rule);
      background:rgba(241,233,216,0.88);
      color:var(--ink-2);
    }
    .viz-readout-head { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:10px; font-size:12px; }
    .viz-readout-head strong { color:var(--ink); font-size:13px; }
    .viz-readout-head span { border:1px solid var(--rule); padding:2px 7px; background:var(--paper-4); color:var(--ink-3); }
    .viz-readout-grid { display:grid; grid-template-columns:minmax(210px,.9fr) minmax(190px,.7fr) minmax(260px,1.4fr); gap:10px; }
    .readout-card { min-width:0; border:1px solid var(--rule); background:var(--paper-4); padding:9px 10px; }
    .readout-card strong { display:block; color:var(--ink); margin-top:3px; overflow-wrap:anywhere; }
    .readout-card em { display:block; margin-top:3px; color:var(--ink-3); font-style:normal; font-size:12px; overflow-wrap:anywhere; }
    .readout-style {
      border-left:6px solid var(--style-color, var(--moss-deep));
      background:linear-gradient(90deg, color-mix(in srgb, var(--style-color, var(--moss-deep)) 12%, var(--paper-4)), var(--paper-4) 70%);
    }
    .readout-label { display:block; color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    .style-swatch { display:inline-block; width:10px; height:10px; margin-right:7px; background:var(--style-color, var(--moss-deep)); vertical-align:middle; }
    .event-list { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
    .event-chip { background:var(--moss-soft); color:var(--moss-deep); }
    .event-none { color:var(--ink-3); background:var(--paper-4); }
    .viz-readout-lines { display:grid; gap:7px; margin-top:10px; font-size:13px; line-height:1.35; }
    .viz-readout-lines p { display:grid; grid-template-columns:74px minmax(0,1fr); gap:8px; margin:0; }
    .snippet-label { align-self:start; padding:2px 7px; text-transform:uppercase; letter-spacing:0.08em; font-size:10px; font-weight:700; text-align:center; }
    .snippet-label.learner { background:var(--indigo-soft); color:var(--indigo); }
    .snippet-label.tutor { background:var(--moss-soft); color:var(--moss-deep); }
    .transcript-explorer {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:6px 6px 0 var(--red-mark);
      overflow:hidden;
    }
    .transcript-toolbar {
      display:grid;
      grid-template-columns:minmax(220px,1.25fr) minmax(310px,1.7fr) minmax(150px,.7fr) minmax(220px,1fr);
      gap:14px;
      align-items:stretch;
      padding:14px;
      border-bottom:4px solid var(--ink);
      background:var(--paper);
    }
    .transcript-toolbar label, .transcript-control-group {
      position:relative;
      min-width:0;
      min-height:88px;
      display:flex;
      flex-direction:column;
      gap:6px;
      padding:14px 12px 12px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--group-accent, var(--ink));
    }
    .transcript-toolbar label::before, .transcript-control-group::before {
      content:"";
      position:absolute;
      top:-2px;
      left:-2px;
      right:-2px;
      height:9px;
      background:var(--group-accent, var(--ink));
      border-bottom:2px solid var(--ink);
    }
    .transcript-run-control { --group-accent:var(--blue); --group-label-ink:var(--paper); }
    .transcript-view-control { --group-accent:var(--red-mark); --group-label-ink:var(--paper); }
    .transcript-turn-control { --group-accent:var(--yellow); --group-label-ink:var(--ink); }
    .transcript-search-control { --group-accent:var(--green); --group-label-ink:var(--paper); }
    .transcript-toolbar label > span:first-child, .transcript-group-label {
      align-self:flex-start;
      margin:2px 0;
      padding:4px 8px;
      border:2px solid var(--ink);
      background:var(--group-accent, var(--ink));
      color:var(--group-label-ink, var(--paper));
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.08em;
      line-height:1;
      text-transform:uppercase;
    }
    .transcript-toolbar select, .transcript-toolbar input {
      margin-top:auto;
      width:100%;
      min-width:0;
    }
    .transcript-mode-buttons { display:flex; flex-wrap:wrap; gap:8px; }
    .transcript-mode-buttons button {
      flex:1 1 88px;
      min-width:0;
      min-height:38px;
      border-left-width:6px;
      border-left-color:var(--red-mark);
      box-shadow:2px 2px 0 var(--ink);
    }
    .transcript-mode-buttons button.active {
      background:var(--red-mark);
      color:var(--paper);
      box-shadow:inset 0 -5px 0 var(--ink), 2px 2px 0 var(--ink);
    }
    .transcript-summary {
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      align-items:center;
      padding:10px 14px;
      border-bottom:2px solid var(--ink);
      background:var(--paper-2);
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
    }
    .transcript-body {
      min-width:0;
      padding:18px;
      background:var(--paper);
    }
    .transcript-empty {
      border:2px dashed var(--ink);
      padding:18px;
      color:var(--ink-3);
      background:var(--paper-3);
    }
    .transcript-card, .transcript-plate, .transcript-note-card, .transcript-line, .transcript-lane {
      min-width:0;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:3px 3px 0 var(--ink);
    }
    .transcript-card, .transcript-plate, .transcript-note-card { padding:14px; }
    .transcript-card + .transcript-card, .transcript-plate + .transcript-plate { margin-top:14px; }
    .transcript-card-head, .transcript-plate-head, .transcript-line-head, .transcript-note-head {
      display:flex;
      flex-wrap:wrap;
      justify-content:space-between;
      gap:8px;
      align-items:flex-start;
      margin-bottom:10px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      font-weight:800;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    .transcript-register-mark {
      display:inline-flex;
      align-items:center;
      gap:6px;
      border:2px solid var(--ink);
      background:var(--style-color, var(--red-mark));
      color:var(--style-ink, var(--paper));
      padding:2px 7px;
      line-height:1.1;
    }
    .transcript-dot {
      width:10px;
      height:10px;
      display:inline-block;
      background:currentColor;
      border:1px solid var(--ink);
    }
    .transcript-voice-grid, .transcript-plate-voices {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:12px;
      align-items:start;
    }
    .transcript-speaker {
      display:inline-block;
      margin:0 0 5px;
      padding:2px 7px;
      border:2px solid var(--ink);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.1em;
      text-transform:uppercase;
    }
    .transcript-speaker.tutor { background:var(--green); }
    .transcript-speaker.learner { background:var(--blue); }
    .transcript-speech {
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      color:var(--ink);
      font-size:14px;
      line-height:1.55;
    }
    .transcript-meta-strip {
      display:flex;
      flex-wrap:wrap;
      gap:6px;
      margin-top:11px;
    }
    .transcript-pill {
      display:inline-block;
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      padding:2px 7px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      line-height:1.25;
    }
    .transcript-pill.hot {
      background:var(--red-mark);
      color:var(--paper);
    }
    .transcript-pill.good {
      background:var(--green);
      color:var(--paper);
    }
    .transcript-script { display:grid; gap:10px; }
    .transcript-line {
      padding:12px;
      border-left-width:8px;
    }
    .transcript-line.learner { border-left-color:var(--blue); }
    .transcript-line.tutor { border-left-color:var(--green); }
    .transcript-swimlane { display:grid; gap:10px; }
    .transcript-swim-head, .transcript-swim-row {
      display:grid;
      grid-template-columns:minmax(0,1fr) 54px minmax(0,1fr);
      gap:14px;
      align-items:start;
    }
    .transcript-swim-head {
      position:sticky;
      top:0;
      z-index:2;
      background:var(--paper);
      padding-bottom:6px;
    }
    .transcript-swim-label {
      border-bottom:4px solid var(--ink);
      padding:5px 8px;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:11px;
      font-weight:800;
      letter-spacing:0.14em;
      text-transform:uppercase;
    }
    .transcript-swim-label.learner { text-align:right; border-bottom-color:var(--blue); }
    .transcript-swim-label.tutor { border-bottom-color:var(--green); }
    .transcript-spine {
      position:relative;
      min-height:42px;
    }
    .transcript-spine::before {
      content:"";
      position:absolute;
      left:50%;
      top:-10px;
      bottom:-10px;
      width:3px;
      transform:translateX(-50%);
      background:var(--ink);
    }
    .transcript-bead {
      position:relative;
      z-index:1;
      display:block;
      width:32px;
      height:32px;
      margin:4px auto;
      border:2px solid var(--ink);
      background:var(--red-mark);
      color:var(--paper);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      font-weight:800;
      line-height:28px;
      text-align:center;
    }
    .transcript-lane {
      padding:12px;
      box-shadow:none;
    }
    .transcript-lane.empty {
      visibility:hidden;
    }
    .transcript-plate {
      border-left-width:10px;
      border-left-color:var(--red-mark);
    }
    .transcript-plate-reason {
      margin-top:12px;
      padding-top:10px;
      border-top:2px solid var(--ink);
      color:var(--ink-3);
      font-size:13px;
      line-height:1.45;
    }
    .transcript-notes-grid {
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
      gap:12px;
    }
    .transcript-note-card p { margin:5px 0 0; color:var(--ink-3); font-size:13px; line-height:1.42; }
    .transcript-jump-active {
      outline:3px solid var(--red-mark);
      outline-offset:3px;
    }
    .table-scroll {
      max-width:100%;
      min-width:0;
      overflow-x:auto;
      overflow-y:hidden;
      padding:0 10px 10px 0;
      margin:0 0 10px;
    }
    table { width:100%; border-collapse:collapse; overflow:hidden; }
    .table-scroll table {
      margin:0;
    }
    .policy-comparison-table {
      min-width:1080px;
    }
    .read-first-table {
      min-width:1160px;
    }
    .run-details-table {
      min-width:1540px;
    }
    th, td { padding:9px 10px; border-bottom:1px solid var(--rule); text-align:left; vertical-align:top; }
    th {
      background:rgba(233,223,199,0.82);
      color:var(--ink-2);
      font-size:12px;
      text-transform:uppercase;
      letter-spacing:0.09em;
      white-space:nowrap;
    }
    tr:last-child td { border-bottom:0; }
    td strong { color:var(--ink); font-weight:600; }
    .run-details-table th, .run-details-table td {
      line-height:1.25;
      overflow-wrap:anywhere;
    }
    .run-details-table th:nth-child(1), .run-details-table td:nth-child(1),
    .run-details-table th:nth-child(3), .run-details-table td:nth-child(3),
    .run-details-table th:nth-child(4), .run-details-table td:nth-child(4),
    .run-details-table th:nth-child(6), .run-details-table td:nth-child(6),
    .run-details-table th:nth-child(7), .run-details-table td:nth-child(7),
    .run-details-table th:nth-child(8), .run-details-table td:nth-child(8),
    .run-details-table th:nth-child(13), .run-details-table td:nth-child(13),
    .run-details-table th:nth-child(14), .run-details-table td:nth-child(14),
    .run-details-table th:nth-child(15), .run-details-table td:nth-child(15),
    .run-details-table th:nth-child(16), .run-details-table td:nth-child(16) {
      white-space:nowrap;
    }
    .run-details-table th:nth-child(5), .run-details-table td:nth-child(5),
    .run-details-table th:nth-child(9), .run-details-table td:nth-child(9),
    .run-details-table th:nth-child(11), .run-details-table td:nth-child(11),
    .run-details-table th:nth-child(12), .run-details-table td:nth-child(12) {
      max-width:240px;
    }
    .index-measure strong {
      display:block;
      color:var(--ink);
      font-size:14px;
      line-height:1.2;
      white-space:nowrap;
    }
    .index-measure strong span {
      color:var(--ink-3);
      font-size:11px;
      font-weight:500;
      letter-spacing:0.05em;
    }
    .index-measure em {
      display:block;
      margin-top:2px;
      color:var(--ink-3);
      font-size:11px;
      font-style:normal;
      letter-spacing:0.02em;
      white-space:normal;
    }
    .index-measure a { color:var(--brick-d); text-decoration-thickness:1px; text-underline-offset:2px; }
    .mini-bar { display:inline-block; width:72px; height:7px; margin-left:6px; background:var(--paper-2); overflow:hidden; vertical-align:middle; }
    .mini-bar span { display:block; height:100%; background:var(--moss-deep); }
    .status { background:var(--moss-soft); color:var(--moss-deep); }
    .status.failed, .status.aborted { background:var(--brick-soft); color:var(--brick-d); }
    .status.dry_run, .status.stale { background:var(--ochre-soft); color:var(--ochre-d); }
    .actions { white-space:nowrap; }
    .actions a { margin-right:6px; }
    .info-term {
      position:relative;
      display:inline-block;
      color:var(--brick-d);
      cursor:help;
      text-decoration:underline dotted rgba(124,44,31,0.52);
      text-underline-offset:3px;
    }
    .info-term:focus { outline:2px solid rgba(230,57,70,0.30); outline-offset:2px; }
    .info-term::after {
      content:attr(data-tip);
      position:absolute;
      left:0;
      top:calc(100% + 7px);
      z-index:20;
      width:min(320px,80vw);
      padding:8px 10px;
      border:1px solid var(--rule);
      background:var(--ink);
      color:var(--paper);
      box-shadow:0 10px 28px rgba(28,22,16,0.22);
      text-transform:none;
      letter-spacing:0;
      font-family:"Source Serif 4", Georgia, serif;
      font-size:12px;
      line-height:1.35;
      font-weight:400;
      white-space:normal;
      opacity:0;
      transform:translateY(-3px);
      pointer-events:none;
      transition:opacity .12s var(--ease), transform .12s var(--ease);
    }
    .info-term:hover::after, .info-term:focus::after { opacity:1; transform:translateY(0); }
    .toolbar {
      display:grid;
      grid-template-columns:minmax(220px,2fr) repeat(5,minmax(108px,1fr));
      align-items:end;
      gap:10px;
      margin:18px 0 10px;
      padding:12px;
      border:1px solid var(--rule);
    }
    .toolbar .control:first-child { grid-column:span 2; }
    .report-list {
      margin:18px 0 0;
      border-top:2px solid var(--ink);
      padding-top:14px;
    }
    .report-list-head {
      display:flex;
      justify-content:space-between;
      gap:16px;
      align-items:flex-start;
      margin:0 0 10px;
    }
    .report-list h2 {
      margin:0;
    }
    .report-list p {
      margin:3px 0 0;
      color:var(--ink-3);
      font-size:12px;
      letter-spacing:0.02em;
    }
    .report-index-scroll {
      max-height:min(72vh, 820px);
      overflow:auto;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:5px 5px 0 var(--ink);
      padding:0;
      margin:10px 0 0;
    }
    .report-index-scroll table {
      min-width:1820px;
      margin:0;
      border:0;
      box-shadow:none;
      background:var(--paper);
      table-layout:fixed;
    }
    .report-index-table th, .report-index-table td {
      box-sizing:border-box;
      padding:8px 10px;
      overflow-wrap:anywhere;
    }
    .report-index-table th:nth-child(1), .report-index-table td:nth-child(1) { width:410px; }
    .report-index-table th:nth-child(2), .report-index-table td:nth-child(2) { width:126px; }
    .report-index-table th:nth-child(3), .report-index-table td:nth-child(3) { width:104px; }
    .report-index-table th:nth-child(4), .report-index-table td:nth-child(4) { width:170px; }
    .report-index-table th:nth-child(5), .report-index-table td:nth-child(5) { width:220px; }
    .report-index-table th:nth-child(6), .report-index-table td:nth-child(6) { width:120px; }
    .report-index-table th:nth-child(7), .report-index-table td:nth-child(7) { width:130px; }
    .report-index-table th:nth-child(8), .report-index-table td:nth-child(8) { width:95px; }
    .report-index-table th:nth-child(9), .report-index-table td:nth-child(9) { width:230px; }
    .report-index-table th:nth-child(10), .report-index-table td:nth-child(10) { width:215px; }
    .report-index-table td:nth-child(2),
    .report-index-table td:nth-child(3),
    .report-index-table td:nth-child(6),
    .report-index-table td:nth-child(7),
    .report-index-table td:nth-child(8) {
      overflow-wrap:normal;
    }
    .report-index-table thead th {
      position:sticky;
      top:0;
      z-index:3;
      border-bottom:2px solid var(--ink);
      background:var(--paper-2);
    }
    .report-index-table tbody tr {
      background:var(--paper);
    }
    .report-index-table tbody tr:nth-child(even) {
      background:var(--paper-3);
    }
    .report-index-table tbody tr[hidden] {
      display:none;
    }
    .report-index-table tbody tr:first-child td {
      border-top:2px solid var(--ink);
    }
    .report-index-table td {
      background:inherit;
    }
    .report-index-table .links-cell {
      width:126px;
      min-width:126px;
      max-width:126px;
      background:inherit;
    }
    .report-index-table .actions a,
    .report-index-table .actions .muted {
      display:inline-block;
      margin:0 6px 6px 0;
    }
    .report-index-table .links-cell.actions {
      white-space:normal;
    }
    .report-index-table .links-cell a,
    .report-index-table .links-cell .muted {
      display:block;
      width:max-content;
      max-width:100%;
      margin:0 0 8px;
      box-sizing:border-box;
    }
    .report-index-table .links-cell a:last-child,
    .report-index-table .links-cell .muted:last-child {
      margin-bottom:0;
    }
    .control span { color:var(--ink-3); font-size:11px; text-transform:uppercase; letter-spacing:0.11em; }
    input { box-sizing:border-box; }
    select { box-sizing:border-box; }
    .live-runs { margin:0 0 18px; }
    .live-runs-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin:0 0 10px; }
    .live-runs h2 { margin:0; }
    .live-runs p { margin:3px 0 0; color:var(--ink-3); font-size:12px; }
    .live-dot {
      display:inline-block;
      width:9px;
      height:9px;
      margin-right:7px;
      background:var(--brick);
      box-shadow:0 0 0 rgba(230,57,70,0.45);
      animation:livePulse 1.4s infinite;
    }
    .live-count { border:1px solid var(--rule); padding:3px 8px; background:var(--paper-4); color:var(--brick-d); font-size:12px; font-weight:700; white-space:nowrap; }
    .live-run-card { border-left:5px solid var(--brick); padding:13px; margin-bottom:10px; }
    .live-run-card.stale { border-left-color:var(--ochre); }
    .live-run-card.aborted { border-left-color:var(--brick-d); }
    .live-run-top { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
    .live-run-top h3 { margin:0 0 3px; }
    .live-run-top p { margin:3px 0 0; color:var(--ink-3); font-size:12px; }
    .live-run-progress { display:grid; grid-template-columns:minmax(180px,1fr) auto; gap:10px; align-items:center; margin:10px 0; color:var(--ink-3); font-size:12px; }
    .live-progress { display:block; height:10px; overflow:hidden; background:var(--paper-2); border:1px solid var(--rule-soft); }
    .live-progress span {
      display:block;
      height:100%;
      min-width:8px;
      background:repeating-linear-gradient(45deg, var(--brick) 0 8px, var(--ochre) 8px 16px);
      animation:liveStripe 1s linear infinite;
    }
    .live-run-meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; color:var(--ink-3); font-size:12px; margin-bottom:9px; }
    .live-jobs { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:8px; }
    .live-job { border:1px solid var(--rule); padding:9px; background:rgba(251,246,232,0.84); }
    .live-job.running { border-color:var(--moss); background:var(--moss-soft); }
    .live-job.failed { border-color:var(--brick); background:var(--brick-soft); }
    .live-job div:first-child { display:flex; justify-content:space-between; gap:8px; }
    .live-job div:first-child span { color:var(--ink-3); font-size:12px; }
    .live-job p { margin:4px 0 5px; font-size:12px; }
    .live-actions { margin-top:10px; font-size:12px; }
    .live-actions a, .live-links a { margin-right:6px; }
    body::before {
      background:
        linear-gradient(to right, rgba(10,10,10,0.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(10,10,10,0.05) 1px, transparent 1px);
      background-size:56px 56px, 56px 56px;
      mix-blend-mode:multiply;
    }
    body::after {
      opacity:0.22;
      background:
        radial-gradient(circle at 12% 18%, rgba(230,57,70,0.22) 0 2px, transparent 2px),
        radial-gradient(circle at 82% 22%, rgba(10,10,10,0.16) 0 1.2px, transparent 1.2px),
        radial-gradient(circle at 28% 78%, rgba(230,57,70,0.18) 0 1.5px, transparent 1.5px),
        repeating-linear-gradient(135deg, transparent 0 17px, rgba(10,10,10,0.055) 17px 18px);
      background-size:34px 34px, 27px 27px, 42px 42px, 100% 100%;
      mix-blend-mode:multiply;
    }
    header {
      position:relative;
      max-width:none;
      border-bottom:4px solid var(--ink);
      background:var(--paper);
    }
    header::after {
      content:"";
      position:absolute;
      right:clamp(18px, 4vw, 44px);
      bottom:-4px;
      width:min(28vw, 360px);
      height:12px;
      background:var(--red-mark);
    }
    h1 {
      max-width:980px;
      font-weight:800;
      text-transform:uppercase;
      letter-spacing:0;
    }
    h2 {
      border-top:4px solid var(--ink);
      padding-top:10px;
      text-transform:uppercase;
      letter-spacing:0;
    }
    h2::before {
      content:"";
      display:inline-block;
      width:0.65em;
      height:0.65em;
      margin-right:0.42em;
      background:var(--red-mark);
      vertical-align:0.02em;
    }
    .header-links a, .field-link, .live-actions a, .live-links a, .actions a {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:3px 3px 0 var(--red-mark);
      text-transform:uppercase;
      font-weight:700;
    }
    .header-links a:hover, .field-link:hover, .live-actions a:hover, .live-links a:hover, .actions a:hover {
      background:var(--ink);
      color:var(--paper);
    }
    .metric, .metric-guide, .learner-profile-card, .learner-behavior-card, .field-card, .viz-player, .live-run-card, table, .report-nav {
      background:var(--paper);
      border:2px solid var(--ink);
      box-shadow:6px 6px 0 var(--ink);
    }
    table {
      box-shadow:4px 4px 0 var(--ink);
    }
    .metric:nth-child(2n), .field-card:nth-child(3n), .learner-behavior-card, .viz-player {
      box-shadow:6px 6px 0 var(--red-mark);
    }
    .metric { min-height:126px; }
    .metric-label, .report-nav-title, .control span, th, .learner-eyebrow, .readout-label, .viz-group-label {
      color:var(--ink);
      font-weight:800;
      letter-spacing:0.08em;
    }
    .metric-value {
      color:var(--ink);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:34px;
      font-weight:800;
    }
    .metric-sub, .sub, .muted { color:var(--ink-3); }
    .report-nav {
      background:
        linear-gradient(90deg, var(--red-mark) 0 9px, transparent 9px),
        var(--paper);
    }
    .report-nav a {
      border-left:4px solid var(--ink);
      color:var(--ink);
      font-weight:700;
      text-transform:uppercase;
    }
    .report-nav a:hover, .report-nav a:focus {
      border-left-color:var(--red-mark);
      background:var(--ink);
      color:var(--paper);
    }
    .metric-guide, .viz-sidebar {
      background:
        linear-gradient(90deg, var(--red-mark) 0 8px, transparent 8px),
        var(--paper);
    }
    .metric-guide dl div, .viz-sidebar dl div, .learner-example {
      border-top:2px solid var(--ink);
    }
    .learner-stat, .learner-chip, .chip, .event-chip, .status, .field-badge, .readout-card {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
    }
    .status {
      background:var(--ink);
      color:var(--paper);
      font-weight:800;
      text-transform:uppercase;
    }
    .status.failed, .status.aborted, .status.dry_run, .status.stale {
      background:var(--red-mark);
      color:var(--paper);
    }
    .field-card-head, .viz-toolbar, .toolbar {
      background:
        linear-gradient(90deg, var(--ink) 0 14px, transparent 14px),
        var(--paper-2);
      border-bottom:2px solid var(--ink);
    }
    th {
      background:var(--paper-2);
      border-bottom:3px solid var(--ink);
      box-shadow:inset 0 6px 0 var(--ink);
      padding-top:18px;
    }
    th, td { border-bottom:2px solid var(--ink); }
    tr:nth-child(even) td { background:var(--paper-3); }
    .viz-sidebar { border-left:2px solid var(--ink); }
    .viz-help-strip, .viz-readout {
      background:var(--paper);
      border-top:2px solid var(--ink);
      border-bottom:2px solid var(--ink);
    }
    .viz-canvas-wrap, .field-svg { background:var(--paper); }
    .viz-toolbar select, .viz-toolbar button, .viz-toolbar input, input, select, button {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      font-weight:700;
    }
    .viz-toolbar {
      grid-template-columns:repeat(auto-fit, minmax(min(100%, 230px), 1fr));
      gap:14px;
      align-items:stretch;
      background:var(--paper);
      border-bottom:4px solid var(--ink);
      padding:14px;
    }
    .viz-toolbar label, .viz-control-group {
      position:relative;
      min-width:0;
      min-height:92px;
      padding:14px 12px 12px;
      border:2px solid var(--ink);
      background:var(--paper);
      box-shadow:4px 4px 0 var(--group-accent, var(--ink));
    }
    .viz-toolbar label::before, .viz-control-group::before {
      content:"";
      position:absolute;
      top:-2px;
      left:-2px;
      right:-2px;
      height:9px;
      background:var(--group-accent, var(--ink));
      border-bottom:2px solid var(--ink);
    }
    .viz-run-control { --group-accent:var(--blue); --group-label-ink:var(--paper); }
    .viz-view-control { --group-accent:var(--red-mark); --group-label-ink:var(--paper); }
    .viz-variable-control { --group-accent:var(--violet); --group-label-ink:var(--paper); }
    .viz-playback-control { --group-accent:var(--yellow); --group-label-ink:var(--ink); }
    .viz-turn-control { --group-accent:var(--green); --group-label-ink:var(--paper); }
    .viz-control-disabled {
      opacity:0.62;
    }
    .viz-toolbar label > span:first-child, .viz-group-label {
      align-self:flex-start;
      margin:2px 0 2px;
      padding:4px 8px;
      border:2px solid var(--ink);
      background:var(--group-accent, var(--ink));
      color:var(--group-label-ink, var(--paper));
      line-height:1;
    }
    .viz-toolbar select, .viz-toolbar input {
      margin-top:auto;
    }
    .viz-mode-buttons, .viz-step-buttons {
      gap:8px;
    }
    .viz-mode-buttons button {
      flex:1 1 118px;
      min-width:0;
      min-height:42px;
      border-left-width:6px;
      border-left-color:var(--red-mark);
      background:var(--paper);
      box-shadow:2px 2px 0 var(--ink);
    }
    .viz-mode-buttons button.active {
      background:var(--red-mark);
      color:var(--paper);
      box-shadow:inset 0 -5px 0 var(--ink), 2px 2px 0 var(--ink);
    }
    .viz-step-buttons button {
      flex:1 1 74px;
      min-height:42px;
      box-shadow:2px 2px 0 var(--yellow);
    }
    .viz-step-buttons button[data-viz-play] {
      background:var(--blue);
      color:var(--paper);
    }
    .viz-step-buttons button[data-viz-reset] {
      background:var(--yellow-soft);
      color:var(--ink);
    }
    .viz-range-label input[type="range"] {
      accent-color:var(--green);
    }
    .viz-readout-head span {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:2px 2px 0 var(--red-mark);
    }
    .readout-card {
      box-shadow:none;
      border:2px solid var(--ink);
    }
    .readout-style {
      border-left:10px solid var(--style-color, var(--ink));
    }
    .snippet-label.learner {
      background:var(--blue);
      color:var(--paper);
    }
    .snippet-label.tutor {
      background:var(--green);
      color:var(--paper);
    }
    button:hover, .viz-mode-buttons button.active {
      background:var(--red-mark);
      border-color:var(--ink);
      color:var(--paper);
    }
    .mini-bar {
      background:var(--paper-2);
      border:1px solid var(--ink);
    }
    .mini-bar span { background:var(--red-mark); }
    .info-term {
      color:var(--ink);
      font-weight:800;
      text-decoration:underline solid var(--red-mark);
    }
    .info-term::after {
      border:2px solid var(--ink);
      background:var(--paper);
      color:var(--ink);
      box-shadow:5px 5px 0 var(--red-mark);
    }
    .live-dot, .live-progress span {
      background:var(--red-mark);
    }
    .live-progress {
      background:var(--paper);
      border:2px solid var(--ink);
    }
    .live-job { background:var(--paper); border:2px solid var(--ink); }
    .live-job.running { background:var(--paper-2); border-color:var(--ink); }
    .live-job.failed { background:var(--brick-soft); border-color:var(--red-mark); }
    @keyframes livePulse {
      0% { box-shadow:0 0 0 0 rgba(230,57,70,0.42); }
      70% { box-shadow:0 0 0 9px rgba(230,57,70,0); }
      100% { box-shadow:0 0 0 0 rgba(230,57,70,0); }
    }
    @keyframes liveStripe { from { background-position:0 0; } to { background-position:23px 0; } }
    @media (max-width: 1220px) {
      .viz-toolbar {
        grid-template-columns:repeat(auto-fit, minmax(min(100%, 220px), 1fr));
      }
    }
    @media (max-width: 1100px) {
      .report-shell { grid-template-columns:1fr; gap:14px; }
      .report-section { scroll-margin-top:92px; }
      .report-nav {
        position:sticky;
        top:0;
        z-index:12;
        max-height:none;
        overflow-x:auto;
      }
      .report-nav-list {
        display:flex;
        gap:6px;
        min-width:max-content;
      }
      .report-nav a {
        border-left:0;
        border-bottom:3px solid var(--rule);
        padding:6px 8px;
        white-space:nowrap;
      }
      .report-nav a:hover, .report-nav a:focus { border-bottom-color:var(--brick); }
    }
    @media (max-width: 900px) {
      .summary-panel, .learner-panel, .viz-layout, .big-picture-grid, .big-picture-viz-grid, .learner-dashboard-grid { grid-template-columns:1fr; }
      .big-picture-head { display:block; }
      .viz-sidebar { border-left:0; border-top:1px solid var(--rule); }
      .viz-toolbar, .toolbar, .transcript-toolbar { grid-template-columns:1fr; }
      .toolbar .control:first-child { grid-column:1 / -1; }
      .viz-canvas-wrap canvas { height:360px; }
      .viz-readout-grid { grid-template-columns:1fr; }
      .viz-readout-lines p { grid-template-columns:1fr; }
      .transcript-voice-grid, .transcript-plate-voices, .transcript-swim-head, .transcript-swim-row { grid-template-columns:1fr; }
      .transcript-swim-label.spine, .transcript-spine { display:none; }
      .transcript-swim-label.learner { text-align:left; }
      .transcript-lane.empty { display:none; }
      .table-scroll { padding-right:6px; }
      .live-run-progress { grid-template-columns:1fr; }
    }
    @media (max-width: 560px) {
      header, main { padding-left:16px; padding-right:16px; }
      .metrics { grid-template-columns:1fr; }
      .policy-bar-row { grid-template-columns:1fr; gap:5px; }
      .policy-bar-meta { white-space:normal; }
    }
  `;
}

function hrefRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).split(path.sep).join('/');
}

function formatFieldValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
}

function fieldSummaryText(row) {
  const final = row.field?.final || {};
  const delta = row.field?.delta || {};
  const riskReduction = Number.isFinite(Number(delta.learnerRisk)) ? -Number(delta.learnerRisk) : Number.NaN;
  return [
    `final mastery ${formatFieldValue(final.learnerMastery)}`,
    `risk ${formatFieldValue(final.learnerRisk)}`,
    `alignment ${formatFieldValue(final.tutorAlignment)}`,
    `momentum ${formatFieldValue(final.jointMomentum)}`,
    `mastery gain ${formatSignedField(delta.learnerMastery)}`,
    `risk reduction ${formatPositiveField(riskReduction)}`,
    `status ${displayBottleneck(final.bottleneck || row.bottleneck, { groundedClosure: row.groundedClosure })}`,
  ].join(' · ');
}

function fieldRowTitle(row) {
  return `${row.policy} run ${row.runIndex}`;
}

function learnerProfileFromSummary(summary = {}) {
  const config = summary.config || {};
  const id = String(config.autoLearnerProfileId || '').trim();
  const builtInDescription = learnerProfileDescription(id);
  const commandProfile = (summary.results || [])
    .map((result) => (Array.isArray(result.command) ? flagValue(result.command, '--auto-learner-profile') : null))
    .find(Boolean);
  const description = builtInDescription || commandProfile || '';
  return {
    id: id || (description ? 'custom' : 'unknown'),
    source: builtInDescription ? 'built-in contract' : description ? 'custom' : 'unknown',
    description,
    model: config.autoLearnerModel || null,
  };
}

function aggregateLearnerBehavior(rows = []) {
  const behaviors = rows.map((row) => row.learnerBehavior).filter(Boolean);
  if (!behaviors.length) return null;
  return {
    rowCount: behaviors.length,
    turnCount: behaviors.reduce((sum, behavior) => sum + Number(behavior.turnCount || 0), 0),
    classifiedTurnCount: behaviors.reduce((sum, behavior) => sum + Number(behavior.classifiedTurnCount || 0), 0),
    meanLearnerWords: mean(behaviors.map((behavior) => behavior.meanLearnerWords)),
    meanConceptualEngagement: mean(behaviors.map((behavior) => behavior.meanConceptualEngagement)),
    meanEpistemicReadiness: mean(behaviors.map((behavior) => behavior.meanEpistemicReadiness)),
    requestTypeCounts: mergeCounts(behaviors.map((behavior) => behavior.requestTypeCounts)),
    discourseMoveCounts: mergeCounts(behaviors.map((behavior) => behavior.discourseMoveCounts)),
    evidenceUseCounts: mergeCounts(behaviors.map((behavior) => behavior.evidenceUseCounts)),
    epistemicStanceCounts: mergeCounts(behaviors.map((behavior) => behavior.epistemicStanceCounts)),
    agencyCounts: mergeCounts(behaviors.map((behavior) => behavior.agencyCounts)),
    affectCounts: mergeCounts(behaviors.map((behavior) => behavior.affectCounts)),
    examples: behaviors
      .map((behavior, index) => ({
        label: `run ${index + 1}`,
        firstLearner: behavior.firstLearner,
        finalLearner: behavior.finalLearner,
        firstClassification: behavior.firstClassification,
        finalClassification: behavior.finalClassification,
      }))
      .filter((example) => example.firstLearner || example.finalLearner)
      .slice(0, 3),
  };
}

function renderCountChips(counts, { limit = 6 } = {}) {
  const entries = Object.entries(counts || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, limit);
  if (!entries.length) return '<span class="learner-empty">none</span>';
  return entries
    .map(([key, value]) => `<span class="learner-chip">${escapeHtml(key)} <b>${escapeHtml(value)}</b></span>`)
    .join('');
}

function learnerStat(label, value, sub = '') {
  return `<div class="learner-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(sub)}</em></div>`;
}

function renderLearnerProfileSection(summary, rows) {
  const profile = learnerProfileFromSummary(summary);
  const behavior = aggregateLearnerBehavior(rows);
  const description = profile.description || 'No automated learner profile text was preserved in this summary.';
  const examples = behavior?.examples?.length
    ? `<div class="learner-examples">
        ${behavior.examples
          .map(
            (example) => `<div class="learner-example">
              <div class="learner-example-label">${escapeHtml(example.label)}</div>
              <div><strong>Opening:</strong> ${escapeHtml(example.firstClassification || example.firstLearner || '')}</div>
              <div><strong>Final:</strong> ${escapeHtml(example.finalClassification || example.finalLearner || '')}</div>
            </div>`,
          )
          .join('\n')}
      </div>`
    : '';
  return `<section class="learner-panel">
    <div class="learner-profile-card">
      <div class="learner-eyebrow">Automated learner</div>
      <h3>${escapeHtml(profile.id)}</h3>
      <p>${escapeHtml(description)}</p>
      <dl>
        <div><dt>source</dt><dd>${escapeHtml(profile.source)}</dd></div>
        <div><dt>model</dt><dd>${escapeHtml(profile.model || 'unknown')}</dd></div>
      </dl>
    </div>
    <div class="learner-behavior-card">
      <div class="learner-eyebrow">Observed behavior</div>
      <div class="learner-score-grid">
        ${learnerStat('Turns', behavior?.turnCount ?? 0, `${behavior?.classifiedTurnCount ?? 0} classified`)}
        ${learnerStat('Words/Turn', behavior?.meanLearnerWords ?? 0, 'mean learner length')}
        ${learnerStat('Conceptual', behavior?.meanConceptualEngagement ?? 0, 'mean 1-5 score')}
        ${learnerStat('Readiness', behavior?.meanEpistemicReadiness ?? 0, 'mean 1-5 score')}
      </div>
      <div class="learner-chip-grid">
        <div><strong>Moves</strong>${renderCountChips(behavior?.discourseMoveCounts)}</div>
        <div><strong>Stance</strong>${renderCountChips(behavior?.epistemicStanceCounts)}</div>
        <div><strong>Evidence</strong>${renderCountChips(behavior?.evidenceUseCounts)}</div>
        <div><strong>Agency</strong>${renderCountChips(behavior?.agencyCounts)}</div>
        <div><strong>Requests</strong>${renderCountChips(behavior?.requestTypeCounts)}</div>
      </div>
      ${examples}
    </div>
  </section>`;
}

function fieldSvgDirForReport(htmlPath) {
  const ext = path.extname(htmlPath);
  const stem = path.basename(htmlPath, ext || '.html');
  return path.join(path.dirname(htmlPath), `${stem}-field-svg`);
}

function fieldSvgFilename(row, index) {
  const traceStem = row.trace ? path.basename(row.trace, path.extname(row.trace)) : '';
  const bits = [
    String(index + 1).padStart(2, '0'),
    safeSlug(row.policy || 'policy'),
    `r${safeSlug(row.runIndex || 'x')}`,
    safeSlug(traceStem).slice(0, 42),
  ].filter(Boolean);
  return `${bits.join('-')}.svg`;
}

function writeFieldSvgArtifacts({ rows, htmlPath }) {
  if (!htmlPath) return [];
  const fieldRows = rows.filter((row) => row.fieldViz?.rows?.length);
  if (!fieldRows.length) return [];
  const svgDir = fieldSvgDirForReport(htmlPath);
  fs.mkdirSync(svgDir, { recursive: true });
  return fieldRows.map((row, index) => {
    const svgPath = path.join(svgDir, fieldSvgFilename(row, index));
    fs.writeFileSync(svgPath, `${renderLightweightFieldSvg(row.fieldViz, { title: fieldRowTitle(row) })}\n`);
    row.fieldSvg = {
      path: path.relative(ROOT, svgPath),
      href: path.relative(path.dirname(htmlPath), svgPath),
    };
    return svgPath;
  });
}

function safeJsonForScript(value) {
  return String(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

function reportRowId(row, index, prefix = 'row') {
  const traceStem = row.trace ? path.basename(row.trace, path.extname(row.trace)) : '';
  return [
    prefix,
    String(index + 1).padStart(2, '0'),
    safeSlug(row.policy || 'policy'),
    `r${safeSlug(row.runIndex || 'x')}`,
    safeSlug(traceStem).slice(0, 36),
  ]
    .filter(Boolean)
    .join('-');
}

function animatedVizRowId(row, index) {
  return reportRowId(row, index, 'viz');
}

function transcriptRowId(row, index) {
  return reportRowId(row, index, 'transcript');
}

function animatedVizReportPayload(rows) {
  const vizRows = rows.filter((row) => row.animatedViz?.frames?.length);
  return {
    schema: 'machinespirits.tutor-stub.report-animation.v1',
    rows: vizRows.map((row, index) => ({
      id: animatedVizRowId(row, index),
      title: fieldRowTitle(row),
      policy: row.policy,
      runIndex: row.runIndex,
      status: row.status,
      groundedClosure: row.groundedClosure,
      stopReason: row.stopReason || null,
      turnCount: row.turnCount,
      trace: row.trace || null,
      viz: row.animatedViz,
    })),
  };
}

function transcriptReportPayload(rows) {
  return {
    schema: 'machinespirits.tutor-stub.report-transcripts.v1',
    rows: rows.flatMap((row, index) =>
      row.transcript?.turns?.length
        ? [
            {
              id: transcriptRowId(row, index),
              title: fieldRowTitle(row),
              policy: row.policy,
              runIndex: row.runIndex,
              status: row.status,
              groundedClosure: row.groundedClosure,
              stopReason: row.stopReason || null,
              turnCount: row.turnCount,
              trace: row.trace || null,
              transcript: row.transcript,
            },
          ]
        : [],
    ),
  };
}

function infoTerm(label, tooltip) {
  return `<span class="info-term" tabindex="0" data-tip="${escapeHtml(tooltip)}">${escapeHtml(label)}</span>`;
}

const REPORT_TERM_TOOLTIPS = {
  ok: 'Rows that completed without a technical failure. Dry-run rows are configuration checks and failed rows are excluded from most means.',
  grounded:
    'Rows where the learner reached grounded asserted-secret closure: the final secret was asserted and entailed by grounded evidence in the learner-DAG.',
  meanTurns: 'Mean number of learner turns used by OK rows before grounded closure or another stop condition.',
  meanCoverage:
    'Mean learner-DAG best-path coverage across OK rows. It is a 0 to 1 score for how much of the target evidence path is grounded.',
  meanMissing:
    'Mean count of still-missing premises on the learner-DAG best path at the end of OK rows. Lower is better.',
  masteryDelta:
    'Mean change in the reconstructed learner-mastery field from first to final turn for OK rows. Higher gain is better.',
  riskDelta:
    'Risk reduction is the fall in reconstructed learner risk from first to final turn. Positive values mean risk went down.',
  topRegisters: 'Most frequently selected tutor discourse registers in the OK rows for this policy.',
  entropy:
    'Shannon entropy in bits over selected tutor registers for OK rows. 0 means one register dominated; higher means more register diversity.',
  bottleneck:
    'The final learner-DAG limiting condition. Grounded asserted-secret closure is displayed as closed rather than as a remaining bottleneck.',
  fieldDelta: 'Compact field movement: learner mastery gain and learner risk reduction from first to final turn.',
  efficacy: 'Counts of register-selection efficacy labels emitted by the register policy or classifier.',
  leaks: 'Tutor leak audit count: places where the tutor appears to reveal or overgive protected solution information.',
};

function reportInfoTerm(key, label) {
  return infoTerm(label, REPORT_TERM_TOOLTIPS[key] || label);
}

function policyReadFirstSummaries(rows = [], summary = {}) {
  const byPolicy = new Map();
  for (const row of rows) {
    const key = row.policy || 'unknown';
    if (!byPolicy.has(key)) byPolicy.set(key, []);
    byPolicy.get(key).push(row);
  }
  const safetyTurns = Number(summary.config?.safetyTurns || 120) || 120;
  return [...byPolicy.entries()]
    .map(([policy, policyRows]) => {
      const liveRows = policyRows.filter((row) => row.status !== 'dry_run');
      const okRows = liveRows.filter((row) => row.status !== 'failed');
      const totalTurns = okRows.reduce((sum, row) => sum + Number(row.turnCount || 0), 0);
      const registers = okRows.flatMap((row) =>
        Object.entries(row.registerCounts || {}).flatMap(([register, count]) =>
          Array.from({ length: Number(count || 0) }, () => register),
        ),
      );
      const efficacyCounts = mergeCounts(okRows.map((row) => row.efficacyCounts));
      const positiveProgress = Number(efficacyCounts.positive_progress || 0);
      const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
      const progressRate = efficacyTotal ? positiveProgress / efficacyTotal : 0;
      const registerEntropy = entropy(registers);
      const finalMastery = mean(okRows.map((row) => row.field?.final?.learnerMastery));
      const finalRisk = mean(okRows.map((row) => row.field?.final?.learnerRisk));
      const masteryGain = mean(okRows.map((row) => row.field?.delta?.learnerMastery));
      const riskReduction = mean(okRows.map((row) => -Number(row.field?.delta?.learnerRisk)));
      const meanTurns = mean(okRows.map((row) => row.turnCount));
      const closureRate = okRows.length ? okRows.filter((row) => row.groundedClosure).length / okRows.length : 0;
      const meanCoverage = mean(okRows.map((row) => row.bestPathCoverage));
      const leaks = okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0);
      const leakDiscipline = clampField01(1 - leaks / Math.max(1, totalTurns));
      const turnEfficiency = clampField01(1 - meanTurns / safetyTurns);
      const registerUsefulness = clampField01((registerEntropy / Math.log2(9)) * (0.5 + 0.5 * progressRate));
      const signalScore = roundField(
        0.3 * closureRate +
          0.16 * meanCoverage +
          0.17 * clampField01(masteryGain) +
          0.14 * clampField01(riskReduction) +
          0.14 * leakDiscipline +
          0.06 * turnEfficiency +
          0.03 * registerUsefulness,
      );
      return {
        policy,
        rows: policyRows.length,
        ok: okRows.length,
        failed: liveRows.filter((row) => row.status === 'failed').length,
        closureRate: roundField(closureRate),
        meanCoverage,
        meanTurns,
        finalMastery,
        finalRisk,
        masteryGain,
        riskReduction,
        leaks,
        leakDiscipline,
        registerEntropy,
        progressRate: roundField(progressRate),
        signalScore,
      };
    })
    .sort((left, right) => right.signalScore - left.signalScore || compareReportPolicies(left.policy, right.policy));
}

function readFirstVerdict(row, index) {
  if (row.failed) return 'technical failure present';
  if (row.closureRate < 1) return 'incomplete closure';
  if (row.leaks > 0) return 'closed, but leak caution';
  if (index === 0) return 'strongest current signal';
  if (row.masteryGain >= 0.45 && row.riskReduction >= 0.3) return 'strong field movement';
  if (row.registerEntropy >= 2 && row.progressRate >= 0.4) return 'varied registers with progress';
  if (row.registerEntropy < 0.2) return 'stable baseline';
  return 'clean closure';
}

function renderSignalGuide() {
  const signals = [
    [
      'Mastery gain',
      'How far the learner moved toward owning the proof. Read it with final mastery, because a large gain can still end below full command.',
    ],
    [
      'Risk reduction',
      'How much overreach, missing-premise, or readiness risk fell. Read it with final risk, because the best rows end low, not merely lower.',
    ],
    [
      'Leak discipline',
      'Whether closure was earned without protected-answer leakage. Clean closure is stronger evidence than fast closure with leaks.',
    ],
    [
      'Turn count',
      'Efficiency after the safety checks pass. Shorter is only better when closure, coverage, and leak discipline are already clean.',
    ],
    [
      'Register variation',
      'Entropy or diversity in tutor registers. It is purposeful when it coincides with progress, and just noisy when the field does not move.',
    ],
  ];
  return `<div class="signal-guide" aria-label="Signal guide">
    ${signals
      .map(
        ([label, description]) => `<div>
          <strong>${escapeHtml(label)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>`,
      )
      .join('\n')}
  </div>`;
}

function renderReadFirstRanking(rows, summary) {
  const ranked = policyReadFirstSummaries(rows, summary);
  const body = ranked
    .map(
      (row, index) => `<tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(row.policy)}</strong></td>
        <td>${escapeHtml(readFirstVerdict(row, index))}</td>
        <td>${escapeHtml(row.ok)}/${escapeHtml(row.failed)}</td>
        <td>${Math.round(row.closureRate * 100)}%</td>
        <td>${escapeHtml(row.meanTurns)}</td>
        <td>${escapeHtml(formatFieldValue(row.finalMastery))}</td>
        <td>${escapeHtml(formatFieldValue(row.finalRisk))}</td>
        <td>${escapeHtml(formatSignedField(row.masteryGain))}</td>
        <td>${escapeHtml(formatPositiveField(row.riskReduction))}</td>
        <td>${escapeHtml(row.leaks ? `${row.leaks} leak${row.leaks === 1 ? '' : 's'}` : 'clean')}</td>
        <td>${escapeHtml(`${row.registerEntropy} bits; ${Math.round(row.progressRate * 100)}% progress`)}</td>
      </tr>`,
    )
    .join('\n');
  return `<section id="read-first" class="report-section read-first">
    <h2>Read This First</h2>
    <p class="read-first-note">Ranking prioritizes grounded closure, full evidence coverage, mastery gain, risk reduction, leak discipline, turn efficiency, and register variation that coincides with progress. Treat it as a triage view, then inspect the detailed tables below.</p>
    <div class="table-scroll" role="region" aria-label="Read this first policy ranking" tabindex="0">
      <table class="read-first-table">
        <thead><tr>
          <th>Rank</th>
          <th>Policy</th>
          <th>Read</th>
          <th>OK/Failed</th>
          <th>Closure</th>
          <th>Turns</th>
          <th>Final Mastery</th>
          <th>Final Risk</th>
          <th>Mastery Gain</th>
          <th>Risk Reduction</th>
          <th>Leak Discipline</th>
          <th>Register Variation</th>
        </tr></thead>
        <tbody>${body || '<tr><td colspan="12">No completed policy rows.</td></tr>'}</tbody>
      </table>
    </div>
    ${renderSignalGuide()}
  </section>`;
}

function renderReportMetricGuide() {
  const terms = [
    ['Mastery Gain', REPORT_TERM_TOOLTIPS.masteryDelta],
    ['Risk Reduction', REPORT_TERM_TOOLTIPS.riskDelta],
    ['Leak Discipline', REPORT_TERM_TOOLTIPS.leaks],
    ['Mean Coverage', REPORT_TERM_TOOLTIPS.meanCoverage],
    ['Register Entropy', REPORT_TERM_TOOLTIPS.entropy],
  ];
  return `<aside class="metric-guide" aria-label="Metric explanations">
    <h3>Reading The Metrics</h3>
    <dl>
      ${terms
        .map(
          ([term, description]) => `<div>
            <dt>${escapeHtml(term)}</dt>
            <dd>${escapeHtml(description)}</dd>
          </div>`,
        )
        .join('\n')}
    </dl>
  </aside>`;
}

function renderReportSectionNav() {
  const sections = [
    ['run-summary', 'Run Summary'],
    ['read-first', 'Read This First'],
    ['learner-profile', 'Learner Profile'],
    ['policy-comparison', 'Policy Comparison'],
    ['turn-replay', 'Turn Replay'],
    ['transcripts', 'Transcripts'],
    ['field-trajectories', 'Field Trajectories'],
    ['run-details', 'Run Details'],
  ];
  return `<aside class="report-nav" aria-label="Eval report sections">
    <div class="report-nav-title">Sections</div>
    <nav class="report-nav-list">
      ${sections.map(([id, label]) => `<a href="#${escapeHtml(id)}">${escapeHtml(label)}</a>`).join('\n')}
    </nav>
  </aside>`;
}

function renderTranscriptExplorer(rows) {
  const payload = transcriptReportPayload(rows);
  if (!payload.rows.length) {
    return '<p class="sub">No transcript turns were found in these traces.</p>';
  }
  return `<div class="transcript-explorer" id="tutor-stub-transcript-explorer">
    <div class="transcript-toolbar">
      <label class="transcript-run-control"><span>Policy Run</span><select data-transcript-run></select></label>
      <div class="transcript-control-group transcript-view-control">
        <span class="transcript-group-label">View</span>
        <div class="transcript-mode-buttons" role="tablist" aria-label="Transcript view">
          <button type="button" data-transcript-mode="plates" class="active">Plates</button>
          <button type="button" data-transcript-mode="excerpts">Excerpts</button>
          <button type="button" data-transcript-mode="script">Script</button>
          <button type="button" data-transcript-mode="swimlanes">Swimlanes</button>
          <button type="button" data-transcript-mode="notes">Notes</button>
        </div>
      </div>
      <label class="transcript-turn-control"><span>Turn</span><select data-transcript-turn></select></label>
      <label class="transcript-search-control"><span>Search</span><input type="search" data-transcript-search placeholder="text, register, event"></label>
    </div>
    <div class="transcript-summary" data-transcript-summary></div>
    <div class="transcript-body" data-transcript-body aria-live="polite"></div>
  </div>
  <script type="application/json" id="tutor-stub-transcript-data">${safeJsonForScript(JSON.stringify(payload))}</script>
  <script>
  (function () {
    var root = document.getElementById('tutor-stub-transcript-explorer');
    var dataNode = document.getElementById('tutor-stub-transcript-data');
    if (!root || !dataNode) return;
    var payload;
    try {
      payload = JSON.parse(dataNode.textContent || '{}');
    } catch (error) {
      return;
    }
    var rows = payload.rows || [];
    if (!rows.length) return;
    var runSelect = root.querySelector('[data-transcript-run]');
    var turnSelect = root.querySelector('[data-transcript-turn]');
    var searchInput = root.querySelector('[data-transcript-search]');
    var summary = root.querySelector('[data-transcript-summary]');
    var body = root.querySelector('[data-transcript-body]');
    var modeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-transcript-mode]'));
    var activeRow = rows[0];
    var activeMode = 'plates';
    var activeTurn = '';
    var registerMeta = {
      plain: { label: 'Plain', color: '#0A0A0A', ink: '#FFFFFF' },
      precise: { label: 'Precise', color: '#0057B8', ink: '#FFFFFF' },
      brisk: { label: 'Brisk', color: '#D98E04', ink: '#0A0A0A' },
      warm: { label: 'Warm', color: '#E63946', ink: '#FFFFFF' },
      witnessing: { label: 'Witnessing', color: '#009B72', ink: '#FFFFFF' },
      charismatic: { label: 'Charismatic', color: '#6B4EFF', ink: '#FFFFFF' },
      ironic: { label: 'Ironic', color: '#737373', ink: '#FFFFFF' },
      sarcastic: { label: 'Sarcastic', color: '#000000', ink: '#FFFFFF' },
      face_threat: { label: 'Face threat', color: '#D72670', ink: '#FFFFFF' }
    };

    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"]/g, function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;'
        }[char];
      });
    }

    function normal(value) {
      return String(value == null ? '' : value).toLowerCase();
    }

    function pct(value) {
      var number = Number(value);
      return Number.isFinite(number) ? Math.round(number * 100) + '%' : 'n/a';
    }

    function fmt(value) {
      var number = Number(value);
      return Number.isFinite(number) ? number.toFixed(3) : 'n/a';
    }

    function proofStatus(value) {
      return value === 'grounded_asserted_secret' ? 'closed' : value || 'open';
    }

    function metaForRegister(register) {
      var key = String(register || 'none');
      return registerMeta[key] || { label: key.replace(/_/g, ' '), color: '#0A0A0A', ink: '#FFFFFF' };
    }

    function registerMark(turn) {
      var key = turn.register && turn.register.selected ? turn.register.selected : 'none';
      var meta = metaForRegister(key);
      return '<span class="transcript-register-mark" style="--style-color:' + esc(meta.color) + ';--style-ink:' + esc(meta.ink) + '">' +
        '<span class="transcript-dot" aria-hidden="true"></span>' + esc(meta.label) + '</span>';
    }

    function chip(label, value, tone) {
      if (value === undefined || value === null || value === '') return '';
      return '<span class="transcript-pill' + (tone ? ' ' + esc(tone) : '') + '">' + esc(label) + ': ' + esc(value) + '</span>';
    }

    function eventChips(turn) {
      var events = (turn.events || []).slice(0, 8);
      var risks = ((turn.register && turn.register.riskFlags) || []).slice(0, 5);
      var all = events.concat(risks.filter(function (flag) { return events.indexOf(flag) === -1; }));
      if (!all.length) return '<span class="transcript-pill">events: none</span>';
      return all.map(function (event) {
        return '<span class="transcript-pill hot">' + esc(proofStatus(event)) + '</span>';
      }).join('');
    }

    function turnSearchText(turn) {
      return [
        turn.learner,
        turn.tutor,
        turn.register && turn.register.selected,
        turn.register && turn.register.reason,
        turn.field && turn.field.bottleneck,
        turn.learnerState && turn.learnerState.discourseMove,
        turn.learnerState && turn.learnerState.epistemicStance,
        (turn.events || []).join(' ')
      ].filter(Boolean).join(' ');
    }

    function filteredTurns() {
      var query = normal(searchInput && searchInput.value);
      return ((activeRow.transcript && activeRow.transcript.turns) || []).filter(function (turn) {
        if (activeTurn && String(turn.turn) !== String(activeTurn)) return false;
        return !query || normal(turnSearchText(turn)).indexOf(query) !== -1;
      });
    }

    function metaStrip(turn) {
      var state = turn.learnerState || {};
      var dag = turn.dag || {};
      var response = turn.response || {};
      return '<div class="transcript-meta-strip">' +
        chip('proof status', proofStatus((turn.field && turn.field.bottleneck) || dag.bottleneck)) +
        chip('coverage', pct(dag.bestPathCoverage)) +
        chip('missing', dag.missingPremiseCount) +
        chip('move', state.discourseMove) +
        chip('stance', state.epistemicStance) +
        chip('agency', state.agency) +
        chip('efficacy', response.efficacyLabel) +
        (response.repaired ? chip('repair', 'yes', 'good') : '') +
        eventChips(turn) +
      '</div>';
    }

    function voiceBlock(kind, text, compact) {
      return '<section class="transcript-voice transcript-voice-' + esc(kind) + '">' +
        '<span class="transcript-speaker ' + esc(kind) + '">' + esc(kind) + '</span>' +
        '<div class="transcript-speech">' + esc(text || (compact ? '' : 'No text captured.')) + '</div>' +
      '</section>';
    }

    function renderExcerpts(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return turns.map(function (turn) {
        return '<article class="transcript-card" data-transcript-turn-card="' + esc(turn.turn) + '">' +
          '<div class="transcript-card-head"><span>Turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-voice-grid">' +
            voiceBlock('learner', turn.excerpts && turn.excerpts.learner, false) +
            voiceBlock('tutor', turn.excerpts && turn.excerpts.tutor, false) +
          '</div>' +
          metaStrip(turn) +
        '</article>';
      }).join('');
    }

    function renderScript(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-script">' + turns.map(function (turn) {
        return '<section class="transcript-line learner">' +
          '<div class="transcript-line-head"><span>Learner · turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-speech">' + esc(turn.learner || '') + '</div>' +
        '</section>' +
        '<section class="transcript-line tutor">' +
          '<div class="transcript-line-head"><span>Tutor · turn ' + esc(turn.turn) + '</span></div>' +
          '<div class="transcript-speech">' + esc(turn.tutor || '') + '</div>' +
          metaStrip(turn) +
        '</section>';
      }).join('') + '</div>';
    }

    function renderSwimlanes(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-swimlane">' +
        '<div class="transcript-swim-head">' +
          '<span class="transcript-swim-label tutor">tutor</span>' +
          '<span class="transcript-swim-label spine" aria-hidden="true"></span>' +
          '<span class="transcript-swim-label learner">learner</span>' +
        '</div>' +
        turns.map(function (turn) {
          return '<div class="transcript-swim-row">' +
            '<section class="transcript-lane tutor">' +
              '<span class="transcript-speaker tutor">tutor</span>' +
              '<div class="transcript-speech">' + esc(turn.tutor || '') + '</div>' +
            '</section>' +
            '<div class="transcript-spine"><span class="transcript-bead">' + esc(turn.turn) + '</span></div>' +
            '<section class="transcript-lane learner">' +
              '<span class="transcript-speaker learner">learner</span>' +
              '<div class="transcript-speech">' + esc(turn.learner || '') + '</div>' +
              metaStrip(turn) +
            '</section>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    function renderPlates(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return turns.map(function (turn) {
        var register = turn.register || {};
        return '<article class="transcript-plate">' +
          '<div class="transcript-plate-head"><span>Turn ' + esc(turn.turn) + ' · ' + esc(activeRow.policy) + '</span>' + registerMark(turn) + '</div>' +
          '<div class="transcript-plate-voices">' +
            voiceBlock('learner', turn.learner, false) +
            voiceBlock('tutor', turn.tutor, false) +
          '</div>' +
          metaStrip(turn) +
          '<div class="transcript-plate-reason">' +
            '<strong>Register rationale:</strong> ' + esc(register.reason || 'No register rationale was captured for this turn.') +
            (register.expectedDagMove ? '<br><strong>DAG move:</strong> ' + esc(register.expectedDagMove) : '') +
            (register.expectedFieldMove ? '<br><strong>Field move:</strong> ' + esc(register.expectedFieldMove) : '') +
          '</div>' +
        '</article>';
      }).join('');
    }

    function renderNotes(turns) {
      if (!turns.length) return '<div class="transcript-empty">No matching transcript turns.</div>';
      return '<div class="transcript-notes-grid">' + turns.map(function (turn) {
        var state = turn.learnerState || {};
        var dag = turn.dag || {};
        var field = turn.field || {};
        var trajectory = turn.trajectory || {};
        var human = turn.humanDiscourse || {};
        var scaffold = human.scaffoldState || {};
        var debt = human.proofDebt || {};
        var audit = human.warrantPremiseAudit || {};
        return '<article class="transcript-note-card">' +
          '<div class="transcript-note-head"><span>Turn ' + esc(turn.turn) + '</span>' + registerMark(turn) + '</div>' +
          '<p><strong>Learner state:</strong> ' + esc([state.requestType, state.discourseMove, state.evidenceUse, state.epistemicStance, state.agency].filter(Boolean).join(' · ')) + '</p>' +
          (state.summary ? '<p><strong>Classifier summary:</strong> ' + esc(state.summary) + '</p>' : '') +
          '<p><strong>DAG:</strong> coverage ' + esc(pct(dag.bestPathCoverage)) + ', missing ' + esc(dag.missingPremiseCount) + ', grounded ' + esc(dag.groundedCount) + ', proof status ' + esc(proofStatus(dag.bottleneck || field.bottleneck)) + '</p>' +
          (human.mode && human.mode !== 'strict_dag' ? '<p><strong>Human scaffold:</strong> ' + esc((scaffold.branch && (scaffold.branch.label || scaffold.branch.id)) || 'open scaffold') + '; side arc ' + esc((human.sideArc && human.sideArc.detected) ? human.sideArc.type : 'none') + '; proof debt ' + esc(debt.status || 'unknown') + '; warrants explicit/missing ' + esc((audit.counts && audit.counts.explicitWarrants) || 0) + '/' + esc((audit.counts && audit.counts.missingWarrants) || 0) + '</p>' : '') +
          '<p><strong>Field:</strong> mastery ' + esc(fmt(field.learnerMastery)) + ', risk ' + esc(fmt(field.learnerRisk)) + ', alignment ' + esc(fmt(field.tutorAlignment)) + ', momentum ' + esc(fmt(field.jointMomentum)) + '</p>' +
          '<p><strong>Trajectory:</strong> field v ' + esc(fmt(trajectory.fieldVelocity)) + ', DAG v ' + esc(fmt(trajectory.dagVelocity)) + ', risk v ' + esc(fmt(trajectory.riskVelocity)) + '</p>' +
          metaStrip(turn) +
        '</article>';
      }).join('') + '</div>';
    }

    function renderBody() {
      var turns = filteredTurns();
      modeButtons.forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-transcript-mode') === activeMode);
      });
      var finalTurn = ((activeRow.transcript && activeRow.transcript.turns) || []).slice(-1)[0] || {};
      if (summary) {
        summary.innerHTML = [
          chip('policy', activeRow.policy),
          chip('run', activeRow.runIndex),
          chip('turns', activeRow.turnCount),
          chip('status', activeRow.status, activeRow.status === 'ok' ? 'good' : ''),
          chip('closure', activeRow.groundedClosure ? 'grounded' : 'open', activeRow.groundedClosure ? 'good' : 'hot'),
          chip('final status', proofStatus(finalTurn.field && finalTurn.field.bottleneck)),
          chip('shown', turns.length + '/' + (((activeRow.transcript && activeRow.transcript.turns) || []).length))
        ].join('');
      }
      if (activeMode === 'script') body.innerHTML = renderScript(turns);
      else if (activeMode === 'swimlanes') body.innerHTML = renderSwimlanes(turns);
      else if (activeMode === 'notes') body.innerHTML = renderNotes(turns);
      else if (activeMode === 'excerpts') body.innerHTML = renderExcerpts(turns);
      else body.innerHTML = renderPlates(turns);
    }

    function syncTurnOptions() {
      var turns = (activeRow.transcript && activeRow.transcript.turns) || [];
      turnSelect.innerHTML = '<option value="">All turns</option>' + turns.map(function (turn) {
        return '<option value="' + esc(turn.turn) + '"' + (String(turn.turn) === String(activeTurn) ? ' selected' : '') + '>turn ' + esc(turn.turn) + '</option>';
      }).join('');
    }

    function selectRunById(id) {
      var index = rows.findIndex(function (row) { return row.id === id; });
      if (index < 0) return;
      activeRow = rows[index];
      activeTurn = '';
      runSelect.value = String(index);
      syncTurnOptions();
      renderBody();
      root.classList.add('transcript-jump-active');
      window.setTimeout(function () { root.classList.remove('transcript-jump-active'); }, 900);
    }

    rows.forEach(function (row, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'policy ' + row.policy + ' · run ' + row.runIndex + ' · ' + row.turnCount + 't · ' + row.status;
      runSelect.appendChild(option);
    });
    runSelect.addEventListener('change', function () {
      activeRow = rows[Number(runSelect.value) || 0] || rows[0];
      activeTurn = '';
      if (searchInput) searchInput.value = '';
      syncTurnOptions();
      renderBody();
    });
    turnSelect.addEventListener('change', function () {
      activeTurn = turnSelect.value;
      renderBody();
    });
    searchInput.addEventListener('input', renderBody);
    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        activeMode = button.getAttribute('data-transcript-mode') || 'plates';
        renderBody();
      });
    });
    document.addEventListener('click', function (event) {
      var trigger = event.target && event.target.closest ? event.target.closest('[data-transcript-jump]') : null;
      if (!trigger) return;
      selectRunById(trigger.getAttribute('data-transcript-jump'));
    });
    window.tutorStubTranscriptSelect = selectRunById;
    syncTurnOptions();
    renderBody();
  })();
  </script>`;
}

function renderAnimatedVizGuide() {
  const terms = [
    [
      'Field signals',
      'The learner-discourse movement surface: mastery, risk, alignment, momentum, evidence use, agency, and stance across turns.',
    ],
    [
      'Learner-DAG',
      'The tutor-side learner-DAG model: how much of the proof path appears grounded, voiced, missing, or unsupported.',
    ],
    [
      'Risk score',
      'A compact warning score for fragile progress: unsupported assertions, premature secret claims, face pressure, or rising recognition cost.',
    ],
    [
      'Derivative trace',
      'The recent path through field, DAG, and risk values. It asks whether the dialogue is moving, stalling, regressing, or converging.',
    ],
    [
      'Velocity',
      'The latest turn-to-turn change. Positive field/DAG velocity is usually good; positive risk velocity is usually bad.',
    ],
    [
      'Slope',
      'The short-window trend line. It is less twitchy than one-turn velocity and helps identify plateau or convergence.',
    ],
    ['Acceleration', 'Change in velocity. Large acceleration can mean a real phase shift or an unstable/noisy turn.'],
    [
      'Proof status',
      'The current proof-path state. Missing evidence, learner integration gap, and premature assertion are open states; grounded asserted-secret closure is shown as closed.',
    ],
    [
      'Register/style',
      'The discursive strategy selected for the tutor turn, such as precise, warm, brisk, witnessing, or a negative control register.',
    ],
    [
      'Policy distribution',
      'The policy probability spread over available registers. Continuous policies show the weighted stance blend; selected-only policies show observed frequency instead.',
    ],
    [
      'Policy Compare',
      'A variable-first replay view: choose one variable, then compare the per-turn policy means across all runs in the report.',
    ],
  ];
  return `<aside class="viz-sidebar" aria-label="Turn replay explanation">
    <h3>Reading The Replay</h3>
    <p>
      The ${infoTerm('register policy', 'The algorithm being benchmarked, such as field, trajectory, dynamical_system, or continuous_dynamical_system.')} belongs to the
      selected eval row. The buttons choose only the ${infoTerm(
        'visual view',
        'The lens used to draw the same turn sequence; it does not change the underlying policy.',
      )}. Each frame combines ${infoTerm('field signals', terms[0][1])}, ${infoTerm('learner-DAG', terms[1][1])},
      ${infoTerm('risk', terms[2][1])}, and ${infoTerm('register/style', terms[8][1])}.
    </p>
    <dl>
      ${terms
        .map(
          ([term, description]) => `<div>
            <dt>${infoTerm(term, description)}</dt>
            <dd>${escapeHtml(description)}</dd>
          </div>`,
        )
        .join('\n')}
    </dl>
  </aside>`;
}

function renderAnimatedVizSection(rows) {
  const payload = animatedVizReportPayload(rows);
  if (!payload.rows.length) {
    return '<p class="sub">No turn-by-turn visualization frames were found in these traces.</p>';
  }
  return `<div class="viz-player" id="tutor-stub-viz-player">
    <div class="viz-layout">
      <div class="viz-main">
        <div class="viz-toolbar">
          <label class="viz-select-label viz-run-control"><span>Policy Run</span><select data-viz-run></select></label>
          <div class="viz-control-group viz-view-control">
            <span class="viz-group-label">View</span>
            <div class="viz-mode-buttons" role="tablist" aria-label="Visualization view">
              <button type="button" data-viz-mode="state">State Snapshot</button>
              <button type="button" data-viz-mode="field" class="active">Interaction Field</button>
              <button type="button" data-viz-mode="trajectory">Derivative Trace</button>
              <button type="button" data-viz-mode="dynamics">System Model</button>
              <button type="button" data-viz-mode="registers">Register Lens</button>
              <button type="button" data-viz-mode="compare">Policy Compare</button>
            </div>
          </div>
          <label class="viz-select-label viz-variable-control"><span>Variable</span><select data-viz-variable></select></label>
          <div class="viz-control-group viz-playback-control">
            <span class="viz-group-label">Playback</span>
            <div class="viz-step-buttons" aria-label="Turn playback controls">
              <button type="button" data-viz-prev>Prev</button>
              <button type="button" data-viz-play>Play</button>
              <button type="button" data-viz-reset>Reset</button>
              <button type="button" data-viz-next>Next</button>
            </div>
          </div>
          <label class="viz-range-label viz-turn-control"><span>Turn</span><input type="range" min="0" value="0" step="1" data-viz-range></label>
        </div>
        <div class="viz-help-strip" data-viz-help></div>
        <div class="viz-canvas-wrap"><canvas data-viz-canvas></canvas></div>
        <div class="viz-readout" data-viz-readout aria-live="polite"></div>
      </div>
      ${renderAnimatedVizGuide()}
    </div>
  </div>
  <script type="application/json" id="tutor-stub-viz-data">${safeJsonForScript(JSON.stringify(payload))}</script>
  <script>
  (function () {
    var root = document.getElementById('tutor-stub-viz-player');
    var dataNode = document.getElementById('tutor-stub-viz-data');
    if (!root || !dataNode) return;
    var payload;
    try {
      payload = JSON.parse(dataNode.textContent || '{}');
    } catch (error) {
      return;
    }
    var rows = payload.rows || [];
    if (!rows.length) return;
    var canvas = root.querySelector('[data-viz-canvas]');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    var select = root.querySelector('[data-viz-run]');
    var range = root.querySelector('[data-viz-range]');
    var readout = root.querySelector('[data-viz-readout]');
    var helpStrip = root.querySelector('[data-viz-help]');
    var playButton = root.querySelector('[data-viz-play]');
    var resetButton = root.querySelector('[data-viz-reset]');
    var variableSelect = root.querySelector('[data-viz-variable]');
    var modeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-viz-mode]'));
    var activeRow = rows[0];
    var activeIndex = 0;
    var mode = 'field';
    var compareVariableKey = 'coverage';
    var timer = null;
    var viewLabels = {
      state: 'State Snapshot',
      field: 'Interaction Field',
      trajectory: 'Derivative Trace',
      dynamics: 'System Model',
      registers: 'Register Lens',
      compare: 'Policy Compare'
    };
    var palette = {
      learnerMastery: '#0A0A0A',
      learnerRisk: '#E63946',
      tutorAlignment: '#0057B8',
      jointMomentum: '#D98E04',
      field: '#009B72',
      dag: '#0057B8',
      risk: '#E63946'
    };
    var policyOrder = ['bland', 'random', 'state', 'field', 'trajectory', 'dynamic', 'dynamical_system', 'empirical_dynamical_system', 'continuous_dynamical_system', 'continuous_empirical_dynamical_system', 'negative'];
    var policyPalette = {
      bland: '#0A0A0A',
      random: '#737373',
      state: '#0057B8',
      field: '#009B72',
      trajectory: '#6B4EFF',
      dynamic: '#D72670',
      dynamical_system: '#D98E04',
      empirical_dynamical_system: '#F2B705',
      continuous_dynamical_system: '#8A5A00',
      continuous_empirical_dynamical_system: '#B88700',
      negative: '#E63946'
    };
    var compareVariables = [
      {
        key: 'coverage',
        label: 'Evidence Coverage',
        group: 'Learner-DAG',
        value: function (frame) { return (frame.field && frame.field.coverage) ?? (frame.state && frame.state.dag && frame.state.dag.bestPathCoverage); },
        display: function (value) { return pct(value); }
      },
      {
        key: 'learnerMastery',
        label: 'Learner Mastery',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.learnerMastery; },
        display: format
      },
      {
        key: 'learnerRisk',
        label: 'Learner Risk',
        group: 'Field',
        lowerBetter: true,
        value: function (frame) { return frame.field && frame.field.learnerRisk; },
        display: format
      },
      {
        key: 'tutorAlignment',
        label: 'Tutor Alignment',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.tutorAlignment; },
        display: format
      },
      {
        key: 'jointMomentum',
        label: 'Joint Momentum',
        group: 'Field',
        value: function (frame) { return frame.field && frame.field.jointMomentum; },
        display: format
      },
      {
        key: 'conceptual',
        label: 'Conceptual Engagement',
        group: 'Classifier',
        value: function (frame) { return frame.state && frame.state.classifier && frame.state.classifier.scores && frame.state.classifier.scores.conceptual; },
        display: format
      },
      {
        key: 'epistemicReadiness',
        label: 'Epistemic Readiness',
        group: 'Classifier',
        value: function (frame) { return frame.state && frame.state.classifier && frame.state.classifier.scores && frame.state.classifier.scores.epistemicReadiness; },
        display: format
      },
      {
        key: 'missingPremises',
        label: 'Missing Premises',
        group: 'Learner-DAG',
        lowerBetter: true,
        value: function (frame) {
          var count = frame.state && frame.state.dag ? Number(frame.state.dag.missingPremiseCount) : NaN;
          return Number.isFinite(count) ? Math.max(0, Math.min(1, count / 8)) : null;
        },
        display: function (value) {
          var number = Number(value);
          return Number.isFinite(number) ? Math.round(number * 8) + ' missing' : 'n/a';
        }
      }
    ];
    var registerOrder = ['plain', 'precise', 'brisk', 'warm', 'witnessing', 'charismatic', 'ironic', 'sarcastic', 'face_threat'];
    var registerMeta = {
      plain: { label: 'Plain', group: 'clarify', color: '#0A0A0A', note: 'plain-language re-entry' },
      precise: { label: 'Precise', group: 'warrant', color: '#0057B8', note: 'distinction or proof step' },
      brisk: { label: 'Brisk', group: 'pace', color: '#D98E04', note: 'faster stepwise movement' },
      warm: { label: 'Warm', group: 'repair', color: '#E63946', note: 'readiness and affect repair' },
      witnessing: { label: 'Witnessing', group: 'recognition', color: '#009B72', note: 'acknowledge learner position' },
      charismatic: { label: 'Charismatic', group: 'disrupt', color: '#6B4EFF', note: 'interrupt stuck low agency' },
      ironic: { label: 'Ironic', group: 'negative/probe', color: '#737373', note: 'mismatch cue' },
      sarcastic: { label: 'Sarcastic', group: 'negative/probe', color: '#000000', note: 'hostile challenge probe' },
      face_threat: { label: 'Face threat', group: 'negative/probe', color: '#D72670', note: 'status-pressure probe' }
    };

    function finite(value, fallback) {
      var number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function clamp01(value) {
      return Math.max(0, Math.min(1, finite(value, 0)));
    }

    function format(value) {
      var number = Number(value);
      return Number.isFinite(number) ? number.toFixed(3) : 'n/a';
    }

    function pct(value) {
      var number = Number(value);
      return Number.isFinite(number) ? Math.round(number * 100) + '%' : 'n/a';
    }

    function metaForRegister(register) {
      var key = String(register || 'none');
      return registerMeta[key] || {
        label: key.replace(/_/g, ' ').replace(/\\b\\w/g, function (match) { return match.toUpperCase(); }),
        group: 'other',
        color: '#0A0A0A',
        note: 'unclassified register'
      };
    }

    function registerLabel(register) {
      var meta = metaForRegister(register);
      return meta.label + (register && meta.label.toLowerCase().replace(/ /g, '_') !== register ? ' (' + register + ')' : '');
    }

    function viewLabel(key) {
      return viewLabels[key] || key || 'View';
    }

    function escapeReadoutHtml(value) {
      return String(value || '').replace(/[&<>"]/g, function (char) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;'
        }[char];
      });
    }

    function proofStatus(value) {
      return value === 'grounded_asserted_secret' ? 'closed' : value || 'open';
    }

    function eventChips(events) {
      var list = (events || []).slice(0, 6);
      if (!list.length) return '<span class="event-chip event-none">none</span>';
      return list.map(function (event) {
        return '<span class="event-chip">' + escapeReadoutHtml(proofStatus(event)) + '</span>';
      }).join('');
    }

    function truncateText(value, maxWidth) {
      var raw = String(value || '');
      if (ctx.measureText(raw).width <= maxWidth) return raw;
      var suffix = '...';
      var textValue = raw;
      while (textValue.length > 1 && ctx.measureText(textValue + suffix).width > maxWidth) {
        textValue = textValue.slice(0, -1);
      }
      return textValue + suffix;
    }

    function currentFrames() {
      return (activeRow.viz && activeRow.viz.frames) || [];
    }

    function compareFrameCount() {
      return rows.reduce(function (max, row) {
        return Math.max(max, ((row.viz && row.viz.frames) || []).length);
      }, 0);
    }

    function activeFrameCount() {
      return mode === 'compare' ? compareFrameCount() : currentFrames().length;
    }

    function currentFrame() {
      var frames = currentFrames();
      return frames[Math.max(0, Math.min(activeIndex, frames.length - 1))] || null;
    }

    function compareVariable() {
      return compareVariables.find(function (variable) { return variable.key === compareVariableKey; }) || compareVariables[0];
    }

    function policyRank(policy) {
      var index = policyOrder.indexOf(String(policy || ''));
      return index === -1 ? policyOrder.length : index;
    }

    function policyColor(policy, index) {
      var key = String(policy || '');
      var fallback = ['#0A0A0A', '#0057B8', '#009B72', '#E63946', '#6B4EFF', '#D98E04', '#D72670', '#737373'];
      return policyPalette[key] || fallback[index % fallback.length];
    }

    function policyGroups() {
      var groups = {};
      rows.forEach(function (row) {
        var key = row.policy || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      });
      return Object.keys(groups)
        .sort(function (left, right) {
          return policyRank(left) - policyRank(right) || left.localeCompare(right);
        })
        .map(function (policy, index) {
          return {
            policy: policy,
            rows: groups[policy],
            color: policyColor(policy, index),
          };
        });
    }

    function frameForRow(row, index) {
      var frames = (row.viz && row.viz.frames) || [];
      return frames[index] || null;
    }

    function meanFinite(values) {
      var finiteValues = values.map(Number).filter(Number.isFinite);
      if (!finiteValues.length) return null;
      return finiteValues.reduce(function (sum, value) { return sum + value; }, 0) / finiteValues.length;
    }

    function valueForPolicyAt(group, index, variable) {
      return meanFinite(
        group.rows.map(function (row) {
          var frame = frameForRow(row, index);
          return frame ? variable.value(frame) : null;
        }),
      );
    }

    function resizeCanvas() {
      var rect = canvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      var width = Math.max(320, Math.floor(rect.width));
      var height = Math.max(320, Math.floor(rect.height));
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function clear(width, height) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(230,57,70,0.08)';
      ctx.fillRect(0, 0, width, 10);
      ctx.fillStyle = 'rgba(10,10,10,0.06)';
      for (var gx = 0; gx < width; gx += 56) ctx.fillRect(gx, 0, 1, height);
      for (var gy = 0; gy < height; gy += 56) ctx.fillRect(0, gy, width, 1);
    }

    function text(value, x, y, options) {
      var opts = options || {};
      ctx.fillStyle = opts.color || '#0A0A0A';
      ctx.font = (opts.weight ? opts.weight + ' ' : '') + (opts.size || 12) + 'px "Source Serif 4", Georgia, serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'alphabetic';
      ctx.fillText(String(value), x, y);
    }

    function rectBar(label, value, x, y, width, color) {
      var bounded = clamp01(value);
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, 12);
      ctx.fillStyle = color || '#0A0A0A';
      ctx.fillRect(x, y, width * bounded, 12);
      text(label, x, y - 4, { color: '#0A0A0A', size: 11, weight: '700' });
      text(format(value), x + width + 8, y + 10, { color: '#525252', size: 11 });
    }

    function labeledBar(label, value, x, y, width, color, valueLabel) {
      var bounded = clamp01(value);
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, 14);
      ctx.fillStyle = color || '#0A0A0A';
      ctx.fillRect(x, y, width * bounded, 14);
      text(truncateText(label, width - 46), x, y - 5, { color: '#0A0A0A', size: 11, weight: '700' });
      text(valueLabel || pct(value), x + width + 8, y + 11, { color: '#525252', size: 11 });
    }

    function drawPlotLegend(series, x, y, maxWidth) {
      text('key', x, y, { color: '#0A0A0A', size: 11, weight: '700' });
      var cursorX = x + 34;
      var cursorY = y;
      series.forEach(function (item) {
        var labelWidth = ctx.measureText(item.label).width + 34;
        if (cursorX + labelWidth > x + maxWidth && cursorX > x + 34) {
          cursorX = x + 34;
          cursorY += 19;
        }
        ctx.fillStyle = item.color;
        ctx.fillRect(cursorX, cursorY - 10, 12, 12);
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 1;
        ctx.strokeRect(cursorX, cursorY - 10, 12, 12);
        text(item.label, cursorX + 17, cursorY, { color: '#0A0A0A', size: 11, weight: '700' });
        cursorX += labelWidth;
      });
    }

    function drawTurnAxis(frames, x, y, width, height) {
      var count = Math.max(1, frames.length - 1);
      var baseline = y + height;
      var tickEvery = Math.max(1, Math.ceil(frames.length / 6));
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 1;
      for (var index = 0; index < frames.length; index += 1) {
        var tx = x + (index / count) * width;
        ctx.beginPath();
        ctx.moveTo(tx, baseline);
        ctx.lineTo(tx, baseline + 7);
        ctx.stroke();
        if (frames.length <= 8 || index === 0 || index === frames.length - 1 || index % tickEvery === 0) {
          text(String(frames[index].turn || index + 1), tx, baseline + 21, {
            color: '#525252',
            size: 10,
            align: 'center'
          });
        }
      }
      text('turns', x + width / 2, baseline + 41, { color: '#0A0A0A', size: 11, weight: '700', align: 'center' });
    }

    function drawPlot(series, options) {
      var opts = options || {};
      var frames = opts.frames || currentFrames();
      var x = opts.x || 44;
      var y = opts.y || 58;
      var width = opts.width || 640;
      var height = opts.height || 240;
      var count = Math.max(1, frames.length - 1);
      ctx.strokeStyle = '#E4E4E7';
      ctx.lineWidth = 1;
      for (var grid = 0; grid <= 4; grid += 1) {
        var gy = y + height - (grid / 4) * height;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + width, gy);
        ctx.stroke();
        text((grid / 4).toFixed(2), x - 8, gy + 4, { color: '#525252', size: 10, align: 'right' });
      }
      text('score (0-1)', x, y - 11, { color: '#525252', size: 10, weight: '700' });
      drawPlotLegend(series, opts.legendX || x + 138, opts.legendY || y - 33, opts.legendWidth || width - 138);
      ctx.strokeStyle = 'rgba(10,10,10,0.08)';
      ctx.lineWidth = 1;
      for (var turnGrid = 0; turnGrid < frames.length; turnGrid += 1) {
        var tx = x + (turnGrid / count) * width;
        ctx.beginPath();
        ctx.moveTo(tx, y);
        ctx.lineTo(tx, y + height);
        ctx.stroke();
      }
      ctx.strokeStyle = '#0A0A0A';
      ctx.strokeRect(x, y, width, height);
      series.forEach(function (item, seriesIndex) {
        var points = [];
        var started = false;
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = item.lineWidth || 3.5;
        ctx.setLineDash(item.dash || []);
        for (var index = 0; index <= activeIndex && index < frames.length; index += 1) {
          var rawValue = item.value(frames[index], index);
          var numericValue = Number(rawValue);
          if (!Number.isFinite(numericValue)) continue;
          var value = clamp01(numericValue);
          var px = x + (index / count) * width;
          var py = y + height - value * height;
          points.push({ x: px, y: py, active: index === activeIndex });
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          }
          else ctx.lineTo(px, py);
        }
        if (started) ctx.stroke();
        ctx.setLineDash([]);
        points.forEach(function (point) {
          ctx.beginPath();
          ctx.fillStyle = point.active ? item.color : '#FFFFFF';
          ctx.strokeStyle = item.color;
          ctx.lineWidth = point.active ? 3 : 2;
          ctx.arc(point.x, point.y, point.active ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
      });
      drawTurnAxis(frames, x, y, width, height);
      var cursorX = x + (Math.max(0, Math.min(activeIndex, count)) / count) * width;
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, y);
      ctx.lineTo(cursorX, y + height);
      ctx.stroke();
    }

    function drawState(frame, width, height) {
      text('State Snapshot', 28, 34, { size: 18, weight: '700' });
      var scores = (frame.state.classifier && frame.state.classifier.scores) || {};
      rectBar('conceptual', scores.conceptual, 38, 82, width * 0.36, '#0057B8');
      rectBar('readiness', scores.epistemicReadiness, 38, 126, width * 0.36, '#009B72');
      rectBar('surface', scores.learnerSurface, 38, 170, width * 0.36, '#D98E04');
      rectBar('coverage', frame.state.dag.bestPathCoverage, 38, 214, width * 0.36, '#E63946');
      var rightX = width * 0.52;
      text('DAG', rightX, 82, { size: 13, weight: '700' });
      text('proof status: ' + proofStatus(frame.state.dag.bottleneck), rightX, 112, { color: '#0A0A0A' });
      text('grounded: ' + frame.state.dag.groundedCount + '   missing: ' + frame.state.dag.missingPremiseCount, rightX, 140, { color: '#0A0A0A' });
      text('unsupported: ' + frame.state.dag.unsupportedAssertionCount, rightX, 168, { color: '#0A0A0A' });
      text('request: ' + ((frame.state.classifier && frame.state.classifier.requestType) || 'unknown'), rightX, 214, { color: '#0A0A0A' });
      text('move: ' + ((frame.state.classifier && frame.state.classifier.discourseMove) || 'unknown'), rightX, 242, { color: '#0A0A0A' });
    }

    function drawField(frame, width, height) {
      text('Interaction Field', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'mastery', color: palette.learnerMastery, lineWidth: 4, value: function (row) { return row.field.learnerMastery; } },
        { label: 'risk', color: palette.learnerRisk, dash: [9, 5], lineWidth: 4, value: function (row) { return row.field.learnerRisk; } },
        { label: 'alignment', color: palette.tutorAlignment, dash: [2, 5], value: function (row) { return row.field.tutorAlignment; } },
        { label: 'momentum', color: palette.jointMomentum, dash: [12, 4, 2, 4], value: function (row) { return row.field.jointMomentum; } }
      ], { x: 54, y: 88, width: width - 108, height: height - 178, legendX: 210, legendY: 52, legendWidth: width - 250 });
    }

    function drawTrajectory(frame, width, height) {
      text('Derivative Trace', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'field', color: palette.field, lineWidth: 4, value: function (row) { return row.trajectory.field.current; } },
        { label: 'dag', color: palette.dag, dash: [2, 5], value: function (row) { return row.trajectory.dag.current; } },
        { label: 'risk', color: palette.risk, dash: [9, 5], lineWidth: 4, value: function (row) { return row.trajectory.risk.current; } }
      ], { x: 54, y: 88, width: width * 0.58, height: height - 178, legendX: 230, legendY: 52, legendWidth: width * 0.5 });
      var x = width * 0.7;
      var y = 82;
      text('velocity / slope / acceleration', x, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
      ['field', 'dag', 'risk'].forEach(function (key, index) {
        var metric = frame.trajectory[key] || {};
        var yy = y + index * 76;
        text(key, x, yy, { color: palette[key], size: 13, weight: '700' });
        text('v ' + format(metric.velocity), x, yy + 24, { color: '#0A0A0A' });
        text('s ' + format(metric.slope), x + 86, yy + 24, { color: '#0A0A0A' });
        text('a ' + format(metric.acceleration), x + 172, yy + 24, { color: '#0A0A0A' });
      });
    }

    function drawPolicyCompare(width, height) {
      var variable = compareVariable();
      var groups = policyGroups();
      var maxFrames = Math.max(1, compareFrameCount());
      var frames = Array.from({ length: maxFrames }, function (_, index) {
        return { turn: index + 1 };
      });
      text('Policy Compare', 28, 34, { size: 18, weight: '700' });
      text(variable.label + ' · ' + variable.group + (variable.lowerBetter ? ' · lower is better' : ''), 28, 58, {
        color: '#525252',
        size: 12,
        weight: '700'
      });
      drawPlot(
        groups.map(function (group) {
          return {
            label: group.policy + (group.rows.length > 1 ? ' (' + group.rows.length + ')' : ''),
            color: group.color,
            lineWidth: group.policy === activeRow.policy ? 4.5 : 3,
            dash: group.policy === 'random' ? [2, 5] : group.policy === 'negative' ? [9, 5] : [],
            value: function (_point, index) {
              return valueForPolicyAt(group, index, variable);
            },
          };
        }),
        {
          frames: frames,
          x: 54,
          y: 104,
          width: width - 108,
          height: height - 202,
          legendX: 210,
          legendY: 72,
          legendWidth: width - 250,
        },
      );
    }

    function drawHeatmap(object, x, y, width, cellHeight) {
      var entries = Object.entries(object || {});
      if (!entries.length) {
        text('no vector data', x, y + 18, { color: '#525252' });
        return;
      }
      entries.forEach(function (entry, index) {
        var key = entry[0];
        var value = clamp01(entry[1]);
        var yy = y + index * cellHeight;
        var heatColors = ['#F4F4F5', '#DDEBFF', '#DDF7EE', '#FFF1B8', '#FFE0EE', '#FBE3E5'];
        ctx.fillStyle = heatColors[Math.min(heatColors.length - 1, Math.floor(value * heatColors.length))];
        ctx.fillRect(x, yy, width, cellHeight - 3);
        text(key, x + 8, yy + cellHeight - 10, { color: '#0A0A0A', size: 11 });
        text(format(value), x + width - 8, yy + cellHeight - 10, { color: '#0A0A0A', size: 11, align: 'right' });
      });
    }

    function drawDynamics(frame, width, height) {
      text('System Model', 28, 34, { size: 18, weight: '700' });
      text('source: ' + (frame.dynamics.source || 'unknown'), 28, 56, { color: '#525252', size: 12 });
      drawHeatmap(frame.dynamics.stateVector || {}, 34, 82, width * 0.46, 22);
      var rightX = width * 0.56;
      text('attractors / derivatives', rightX, 82, { size: 13, weight: '700' });
      var bars = Object.keys(frame.dynamics.attractors || {}).length ? frame.dynamics.attractors : frame.dynamics.derivativeVector;
      Object.entries(bars || {}).slice(0, 12).forEach(function (entry, index) {
        rectBar(entry[0], Math.abs(finite(entry[1], 0)), rightX, 116 + index * 24, width * 0.28, index % 2 ? '#0057B8' : '#E63946');
      });
    }

    function registerKeysForRun() {
      var seen = {};
      currentFrames().forEach(function (frame) {
        if (frame.selectedRegister) seen[frame.selectedRegister] = true;
        (frame.register.distribution || []).forEach(function (entry) {
          if (entry.register) seen[entry.register] = true;
        });
        Object.keys(frame.register.scores || {}).forEach(function (key) {
          seen[key] = true;
        });
      });
      return Object.keys(seen).sort(function (left, right) {
        var leftIndex = registerOrder.indexOf(left);
        var rightIndex = registerOrder.indexOf(right);
        leftIndex = leftIndex === -1 ? 999 : leftIndex;
        rightIndex = rightIndex === -1 ? 999 : rightIndex;
        return leftIndex - rightIndex || left.localeCompare(right);
      });
    }

    function registerCountsThrough(index) {
      var counts = {};
      currentFrames().slice(0, index + 1).forEach(function (frame) {
        var key = frame.selectedRegister || 'none';
        counts[key] = (counts[key] || 0) + 1;
      });
      return counts;
    }

    function drawRegisterTimeline(frames, x, y, width, height) {
      text('selection timeline', x, y - 12, { color: '#0A0A0A', size: 12, weight: '700' });
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(x, y, width, height);
      var count = Math.max(1, frames.length);
      frames.forEach(function (row, index) {
        var meta = metaForRegister(row.selectedRegister);
        var start = x + (index / count) * width;
        var end = x + ((index + 1) / count) * width;
        ctx.fillStyle = meta.color;
        ctx.fillRect(start, y, Math.max(1, end - start + 0.5), height);
      });
      var cursorX = x + ((activeIndex + 0.5) / count) * width;
      ctx.strokeStyle = '#E63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, y - 5);
      ctx.lineTo(cursorX, y + height + 5);
      ctx.stroke();
      ctx.strokeStyle = '#0A0A0A';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      text('1', x, y + height + 18, { color: '#525252', size: 10 });
      text(String(frames.length), x + width, y + height + 18, { color: '#525252', size: 10, align: 'right' });
    }

    function drawRegisterLegend(keys, x, y, width, height) {
      text('key', x, y, { size: 13, weight: '700' });
      var rowHeight = 34;
      keys.slice(0, Math.floor((height - 30) / rowHeight)).forEach(function (key, index) {
        var meta = metaForRegister(key);
        var yy = y + 26 + index * rowHeight;
        ctx.fillStyle = meta.color;
        ctx.fillRect(x, yy - 10, 12, 12);
        text(meta.label, x + 18, yy, { color: '#0A0A0A', size: 12, weight: '700' });
        text(truncateText(meta.group + ' | ' + meta.note, width - 18), x + 18, yy + 16, { color: '#525252', size: 10 });
      });
    }

    function drawCurrentRegisterCard(frame, x, y, width) {
      var meta = metaForRegister(frame.selectedRegister);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, width, 108);
      ctx.strokeStyle = '#0A0A0A';
      ctx.strokeRect(x, y, width, 108);
      ctx.fillStyle = meta.color;
      ctx.fillRect(x + 12, y + 18, 18, 18);
      text('current register', x + 12, y + 14, { color: '#525252', size: 11 });
      text(meta.label, x + 40, y + 32, { color: '#0A0A0A', size: 16, weight: '700' });
      text(String(frame.selectedRegister || 'none'), x + 40, y + 52, { color: '#525252', size: 11 });
      text('register policy: ' + (frame.register.policy || activeRow.policy || 'unknown'), x + 12, y + 78, { color: '#0A0A0A', size: 11 });
      text('kind: ' + meta.group, x + 12, y + 96, { color: '#0A0A0A', size: 11 });
    }

    function drawRegisters(frame, width, height) {
      text('Register Lens', 28, 34, { size: 18, weight: '700' });
      var frames = currentFrames();
      var keys = registerKeysForRun();
      var leftX = 34;
      var rightWidth = Math.min(300, Math.max(230, width * 0.28));
      var rightX = width - rightWidth - 28;
      var leftWidth = Math.max(320, rightX - leftX - 28);
      drawCurrentRegisterCard(frame, rightX, 62, rightWidth);
      drawRegisterLegend(keys, rightX, 196, rightWidth, height - 210);
      drawRegisterTimeline(frames, leftX, 78, leftWidth, 54);

      var rows = frame.register.distribution || [];
      var hasPolicyDistribution = frame.register.distributionSource === 'policy_distribution' && rows.length > 1;
      var y = 182;
      var barWidth = leftWidth - 76;
      if (hasPolicyDistribution) {
        text('current probability distribution', leftX, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
        rows.slice(0, 9).forEach(function (entry, index) {
          var meta = metaForRegister(entry.register);
          var selected = entry.register === frame.selectedRegister;
          labeledBar(
            meta.label + (selected ? '  selected' : ''),
            entry.probability,
            leftX,
            y + index * 30,
            barWidth,
            selected ? '#0A0A0A' : meta.color,
            pct(entry.probability),
          );
        });
      } else {
        var counts = registerCountsThrough(activeIndex);
        var total = Math.max(1, activeIndex + 1);
        text('selection frequency through this turn', leftX, y - 24, { color: '#0A0A0A', size: 12, weight: '700' });
        keys
          .map(function (key) {
            return { register: key, count: counts[key] || 0 };
          })
          .filter(function (entry) {
            return entry.count > 0;
          })
          .sort(function (left, right) {
            return right.count - left.count || registerOrder.indexOf(left.register) - registerOrder.indexOf(right.register);
          })
          .slice(0, 9)
          .forEach(function (entry, index) {
            var meta = metaForRegister(entry.register);
            labeledBar(
              meta.label,
              entry.count / total,
              leftX,
              y + index * 30,
              barWidth,
              meta.color,
              entry.count + '/' + total,
            );
          });
      }
      text('source: ' + frame.register.distributionSource, leftX, height - 26, { color: '#525252', size: 11 });
    }

    function updateReadout(frame) {
      if (!readout || !frame) return;
      var meta = metaForRegister(frame.selectedRegister || 'none');
      var registerKey = frame.selectedRegister || 'none';
      var bottleneck = proofStatus(frame.field && frame.field.bottleneck);
      var learner = (frame.snippets && frame.snippets.learner) || '';
      var tutor = (frame.snippets && frame.snippets.tutor) || '';
      readout.innerHTML = [
        '<div class="viz-readout-head">',
          '<strong>' + escapeReadoutHtml(activeRow.title) + '</strong>',
          '<span>turn ' + escapeReadoutHtml(frame.turn) + '/' + escapeReadoutHtml(activeRow.viz.turnCount) + '</span>',
          '<span>view ' + escapeReadoutHtml(viewLabel(mode)) + '</span>',
        '</div>',
        '<div class="viz-readout-grid">',
          '<section class="readout-card readout-style" style="--style-color:' + escapeReadoutHtml(meta.color) + '">',
            '<span class="readout-label">style / register</span>',
            '<strong><span class="style-swatch"></span>' + escapeReadoutHtml(meta.label) + '</strong>',
            '<em>' + escapeReadoutHtml(registerKey) + ' · ' + escapeReadoutHtml(meta.group) + ' · ' + escapeReadoutHtml(meta.note) + '</em>',
          '</section>',
          '<section class="readout-card readout-bottleneck">',
            '<span class="readout-label">proof status</span>',
            '<strong>' + escapeReadoutHtml(bottleneck) + '</strong>',
          '</section>',
          '<section class="readout-card readout-events">',
            '<span class="readout-label">events</span>',
            '<div class="event-list">' + eventChips(frame.events) + '</div>',
          '</section>',
        '</div>',
        '<div class="viz-readout-lines">',
          '<p><span class="snippet-label learner">learner</span><span>' + escapeReadoutHtml(learner) + '</span></p>',
          '<p><span class="snippet-label tutor">tutor</span><span>' + escapeReadoutHtml(tutor) + '</span></p>',
        '</div>'
      ].join('');
    }

    function updateCompareReadout() {
      if (!readout) return;
      var variable = compareVariable();
      var groups = policyGroups();
      var values = groups
        .map(function (group) {
          var value = valueForPolicyAt(group, activeIndex, variable);
          return {
            policy: group.policy,
            color: group.color,
            runs: group.rows.length,
            value: value,
          };
        })
        .filter(function (entry) {
          return Number.isFinite(Number(entry.value));
        });
      var sorted = values.slice().sort(function (left, right) {
        return variable.lowerBetter ? left.value - right.value : right.value - left.value;
      });
      var leader = sorted[0] || null;
      var low = values.length ? Math.min.apply(null, values.map(function (entry) { return entry.value; })) : null;
      var high = values.length ? Math.max.apply(null, values.map(function (entry) { return entry.value; })) : null;
      var spread = Number.isFinite(high) && Number.isFinite(low) ? high - low : null;
      readout.innerHTML = [
        '<div class="viz-readout-head">',
          '<strong>Policy comparison</strong>',
          '<span>turn ' + escapeReadoutHtml(activeIndex + 1) + '/' + escapeReadoutHtml(compareFrameCount()) + '</span>',
          '<span>variable ' + escapeReadoutHtml(variable.label) + '</span>',
        '</div>',
        '<div class="viz-readout-grid">',
          '<section class="readout-card readout-style" style="--style-color:' + escapeReadoutHtml(leader ? leader.color : '#0A0A0A') + '">',
            '<span class="readout-label">leading policy</span>',
            '<strong><span class="style-swatch"></span>' + escapeReadoutHtml(leader ? leader.policy : 'n/a') + '</strong>',
            '<em>' + escapeReadoutHtml(leader ? variable.display(leader.value) : 'no policy has a value at this turn') + '</em>',
          '</section>',
          '<section class="readout-card">',
            '<span class="readout-label">comparison rule</span>',
            '<strong>' + escapeReadoutHtml(variable.lowerBetter ? 'lower is better' : 'higher is better') + '</strong>',
            '<em>policy mean when multiple runs exist</em>',
          '</section>',
          '<section class="readout-card">',
            '<span class="readout-label">spread</span>',
            '<strong>' + escapeReadoutHtml(format(spread)) + '</strong>',
            '<em>high minus low at this turn</em>',
          '</section>',
        '</div>',
        '<div class="viz-readout-lines">',
          sorted.slice(0, 9).map(function (entry) {
            return '<p><span class="snippet-label tutor" style="background:' + escapeReadoutHtml(entry.color) + '">' +
              escapeReadoutHtml(entry.policy) +
              '</span><span>' + escapeReadoutHtml(variable.display(entry.value)) +
              (entry.runs > 1 ? ' · mean of ' + escapeReadoutHtml(entry.runs) + ' runs' : '') +
              '</span></p>';
          }).join('') || '<p><span class="snippet-label tutor">none</span><span>No policy has this variable at the current turn.</span></p>',
        '</div>'
      ].join('');
    }

    function helpTextForMode() {
      if (mode === 'state') {
        return 'View: State Snapshot. Shows the current classifier and learner-DAG snapshot, including request type, proof coverage, missing premises, and proof status.';
      }
      if (mode === 'trajectory') {
        return 'View: Derivative Trace. Shows field, DAG, and risk movement over recent turns. v/s/a are velocity, slope, and acceleration.';
      }
      if (mode === 'dynamics') {
        return 'View: System Model. Shows state-vector axes and derivative/attractor signals when the selected register policy emits them.';
      }
      if (mode === 'registers') {
        return 'View: Register Lens. Shows selected tutor register/style over time; bars show either policy probabilities or observed frequency for selected-only policies.';
      }
      if (mode === 'compare') {
        return 'View: Policy Compare. Select one variable and animate policy means against each other turn by turn. If a policy has several runs, its line is the per-turn mean.';
      }
      return 'View: Interaction Field. Shows mastery, risk, tutor alignment, and joint momentum across turns.';
    }

    function draw() {
      var width = canvas.clientWidth || 960;
      var height = canvas.clientHeight || 420;
      clear(width, height);
      if (mode === 'compare') {
        drawPolicyCompare(width, height);
        text('turn ' + (activeIndex + 1), width - 28, 34, { align: 'right', color: '#525252', size: 12, weight: '700' });
        updateCompareReadout();
        return;
      }
      var frame = currentFrame();
      if (!frame) return;
      if (mode === 'state') drawState(frame, width, height);
      else if (mode === 'trajectory') drawTrajectory(frame, width, height);
      else if (mode === 'dynamics') drawDynamics(frame, width, height);
      else if (mode === 'registers') drawRegisters(frame, width, height);
      else drawField(frame, width, height);
      text('turn ' + frame.turn, width - 28, 34, { align: 'right', color: '#525252', size: 12, weight: '700' });
      updateReadout(frame);
    }

    function syncControls() {
      var count = activeFrameCount();
      range.max = String(Math.max(0, count - 1));
      range.value = String(activeIndex);
      modeButtons.forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-viz-mode') === mode);
      });
      if (select) {
        select.disabled = mode === 'compare';
        var selectBox = select.closest ? select.closest('label') : null;
        if (selectBox) selectBox.classList.toggle('viz-control-disabled', mode === 'compare');
      }
      if (variableSelect) {
        variableSelect.disabled = mode !== 'compare';
        var variableBox = variableSelect.closest ? variableSelect.closest('label') : null;
        if (variableBox) variableBox.classList.toggle('viz-control-disabled', mode !== 'compare');
      }
      if (helpStrip) helpStrip.textContent = helpTextForMode();
      if (playButton) playButton.textContent = timer ? 'Pause' : 'Play';
    }

    function setIndex(value) {
      var count = activeFrameCount();
      activeIndex = Math.max(0, Math.min(Number(value) || 0, Math.max(0, count - 1)));
      syncControls();
      draw();
    }

    function stop() {
      if (timer) window.clearInterval(timer);
      timer = null;
      syncControls();
    }

    rows.forEach(function (row, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'policy ' + row.policy + ' · run ' + row.runIndex + ' · ' + row.turnCount + 't · ' + row.status;
      select.appendChild(option);
    });
    compareVariables.forEach(function (variable) {
      var option = document.createElement('option');
      option.value = variable.key;
      option.textContent = variable.label + ' · ' + variable.group + (variable.lowerBetter ? ' · lower better' : '');
      variableSelect.appendChild(option);
    });
    variableSelect.value = compareVariableKey;
    select.addEventListener('change', function () {
      stop();
      activeRow = rows[Number(select.value) || 0] || rows[0];
      setIndex(0);
    });
    variableSelect.addEventListener('change', function () {
      compareVariableKey = variableSelect.value || 'coverage';
      draw();
    });
    range.addEventListener('input', function () {
      stop();
      setIndex(range.value);
    });
    root.querySelector('[data-viz-prev]').addEventListener('click', function () {
      stop();
      setIndex(activeIndex - 1);
    });
    root.querySelector('[data-viz-next]').addEventListener('click', function () {
      stop();
      setIndex(activeIndex + 1);
    });
    playButton.addEventListener('click', function () {
      if (timer) {
        stop();
        return;
      }
      timer = window.setInterval(function () {
        var count = activeFrameCount();
        if (activeIndex >= count - 1) {
          stop();
          return;
        }
        setIndex(activeIndex + 1);
      }, 850);
      syncControls();
    });
    resetButton.addEventListener('click', function () {
      stop();
      setIndex(0);
    });
    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        mode = button.getAttribute('data-viz-mode') || 'field';
        setIndex(activeIndex);
      });
    });
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(canvas);
    }
    window.addEventListener('resize', resizeCanvas);
    syncControls();
    resizeCanvas();
  })();
  </script>`;
}

function renderFieldTrajectories(rows) {
  const fieldRows = rows.filter((row) => row.fieldViz?.rows?.length);
  if (!fieldRows.length) {
    return '<p class="sub">No field trajectory data was found in these traces.</p>';
  }
  return `<div class="field-grid">
    ${fieldRows
      .map((row) => {
        const title = fieldRowTitle(row);
        const final = row.field?.final || {};
        return `<article class="field-card">
          <div class="field-card-head">
            <div>
              <h3>${escapeHtml(title)}</h3>
              <div class="sub">${escapeHtml(row.status)} · ${escapeHtml(row.turnCount)} turns · ${escapeHtml(
                displayStopReason(row.stopReason),
              )}</div>
            </div>
            <div class="field-actions">
              ${row.fieldSvg?.href ? `<a class="field-link" href="${escapeHtml(row.fieldSvg.href)}">svg</a>` : ''}
              <div class="field-badge">${escapeHtml(displayBottleneck(final.bottleneck || row.bottleneck, { groundedClosure: row.groundedClosure }))}</div>
            </div>
          </div>
          <div class="field-card-summary">${escapeHtml(fieldSummaryText(row))}</div>
          <div class="field-svg">${renderLightweightFieldSvg(row.fieldViz, { title })}</div>
        </article>`;
      })
      .join('\n')}
  </div>`;
}

function renderHtmlReport(summary, rows, { htmlPath = '' } = {}) {
  const reportDir = htmlPath
    ? path.dirname(resolvePath(htmlPath))
    : resolveTracePath(summary.config?.traceDir || '.', ROOT);
  const indexHref = hrefRelative(reportDir, path.join(indexRootDir(), 'index.html'));
  const guideHref = hrefRelative(reportDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const reportScope = reportScopeForSummary({
    jsonPath: summary.report?.json || '',
    summary,
    config: summary.config || {},
    rootDir: reportDir,
  });
  const orderedRows = rows.slice().sort(compareReportRows);
  const policyRows = Object.entries(summary.aggregates.byPolicy)
    .sort(([left], [right]) => compareReportPolicies(left, right))
    .map(
      ([policy, bucket]) => `<tr>
        <td><strong>${escapeHtml(policy)}</strong></td>
        <td>${bucket.ok}</td>
        <td>${bucket.grounded}/${bucket.ok}</td>
        <td>${Math.round(bucket.groundedRate * 100)}%</td>
        <td>${bucket.meanTurns}</td>
        <td>${bucket.meanCoverage} ${pctBar(bucket.meanCoverage)}</td>
        <td>${bucket.meanMissing}</td>
        <td>${bucket.meanFieldMasteryDelta}</td>
        <td>${formatPositiveField(-Number(bucket.meanFieldRiskDelta))}</td>
        <td>${escapeHtml(formatCounts(bucket.registerCounts))}</td>
        <td>${bucket.registerEntropy}</td>
      </tr>`,
    )
    .join('\n');
  const runRows = orderedRows
    .map((row, index) => {
      const transcriptId = row.transcript?.turns?.length ? transcriptRowId(row, index) : '';
      return `<tr>
        <td>${escapeHtml(row.policy)}</td>
        <td>${escapeHtml(row.runIndex)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${row.groundedClosure ? 'yes' : 'no'}</td>
        <td>${escapeHtml(displayStopReason(row.stopReason))}</td>
        <td>${escapeHtml(row.turnCount)}</td>
        <td>${row.bestPathCoverage} ${pctBar(row.bestPathCoverage)}</td>
        <td>${escapeHtml(row.missingPremiseCount ?? '')}</td>
        <td>${escapeHtml(displayBottleneck(row.bottleneck, { groundedClosure: row.groundedClosure }))}</td>
        <td>${escapeHtml(
          row.field?.delta
            ? `mastery gain ${formatSignedField(row.field.delta.learnerMastery)} / risk reduction ${formatPositiveField(
                -Number(row.field.delta.learnerRisk),
              )}`
            : '',
        )}</td>
        <td>${escapeHtml(formatCounts(row.registerCounts, { limit: 4 }))}</td>
        <td>${escapeHtml(formatCounts(row.efficacyCounts, { limit: 4 }))}</td>
        <td>${escapeHtml(row.leakCount)}</td>
        <td>${transcriptId ? `<a href="#transcripts" data-transcript-jump="${escapeHtml(transcriptId)}">transcript</a>` : ''}</td>
        <td>${row.trace ? `<a href="${escapeHtml(path.relative(summary.config.traceDir || '.', path.join(ROOT, row.trace)))}">trace</a>` : ''}</td>
        <td>${row.log ? `<a href="${escapeHtml(path.relative(summary.config.traceDir || '.', path.join(ROOT, row.log)))}">log</a>` : ''}</td>
      </tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tutor Stub Auto-Eval Report</title>
  <style>
    ${machineSpiritsReportCss()}
  </style>
</head>
<body>
  <header>
    <h1>Tutor Stub Auto-Eval Report</h1>
    ${renderReportScopeBadge(reportScope)}
    <div class="sub">Started ${escapeHtml(summary.startedAt)} · completed ${escapeHtml(summary.completedAt)} · world ${escapeHtml(summary.config.world)} · DAG discourse ${escapeHtml(summary.config.dagMode || 'strict_dag')}</div>
    <div class="header-links">
      <a href="${escapeHtml(indexHref)}">report index</a>
      <a href="${escapeHtml(guideHref)}">arc guide</a>
    </div>
  </header>
  <main class="report-main">
    <div class="report-shell">
      ${renderReportSectionNav()}
      <div class="report-content">
        <section id="run-summary" class="report-section">
          <h2 class="visually-hidden">Run Summary</h2>
          ${renderReportScopeNotice(reportScope)}
          <div class="summary-panel">
            <div class="metrics">
              ${htmlMetricInfo('Rows', REPORT_TERM_TOOLTIPS.ok, summary.aggregates.rows, `${summary.aggregates.failed} failed · ${summary.aggregates.dryRun} dry-run`)}
              ${htmlMetricInfo('Grounded', REPORT_TERM_TOOLTIPS.grounded, `${summary.aggregates.grounded}/${summary.aggregates.ok}`, `${Math.round(summary.aggregates.groundedRate * 100)}% closure`)}
              ${htmlMetricInfo('Mean Turns', REPORT_TERM_TOOLTIPS.meanTurns, summary.aggregates.meanTurns, `safety cap ${summary.config.safetyTurns}`)}
              ${htmlMetricInfo('Mean Coverage', REPORT_TERM_TOOLTIPS.meanCoverage, summary.aggregates.meanCoverage, 'learner-DAG best path')}
              ${htmlMetricInfo('Mean Missing', REPORT_TERM_TOOLTIPS.meanMissing, summary.aggregates.meanMissing, 'remaining premises')}
              ${htmlMetricInfo('DAG Mode', 'Discourse mode for translating the strict proof DAG into tutor behavior. strict_dag is the audit baseline; human_scaffold and defeasible_human_scaffold add human-facing warrant/proof-debt scaffolds.', summary.config.dagMode || 'strict_dag', summary.config.dagMode === 'strict_dag' || !summary.config.dagMode ? 'strict audit' : 'human scaffold active')}
            </div>
            ${renderReportMetricGuide()}
          </div>
        </section>

        ${renderReadFirstRanking(orderedRows, summary)}

        <section id="learner-profile" class="report-section">
          <h2>Learner Profile</h2>
          ${renderLearnerProfileSection(summary, rows)}
        </section>

        <section id="policy-comparison" class="report-section">
          <h2>Policy Comparison</h2>
          <div class="table-scroll" role="region" aria-label="Policy comparison table" tabindex="0">
          <table class="policy-comparison-table">
      <thead><tr>
        <th>Policy</th>
        <th>${reportInfoTerm('ok', 'OK')}</th>
        <th>${reportInfoTerm('grounded', 'Grounded')}</th>
        <th>Rate</th>
        <th>${reportInfoTerm('meanTurns', 'Mean Turns')}</th>
        <th>${reportInfoTerm('meanCoverage', 'Mean Coverage')}</th>
        <th>${reportInfoTerm('meanMissing', 'Mean Missing')}</th>
        <th>${reportInfoTerm('masteryDelta', 'Mastery Gain')}</th>
        <th>${reportInfoTerm('riskDelta', 'Risk Reduction')}</th>
        <th>${reportInfoTerm('topRegisters', 'Top Registers')}</th>
        <th>${reportInfoTerm('entropy', 'Entropy')}</th>
      </tr></thead>
      <tbody>${policyRows || '<tr><td colspan="11">No policy rows.</td></tr>'}</tbody>
          </table>
          </div>
        </section>

        <section id="turn-replay" class="report-section">
          <h2>Turn Replay</h2>
          ${renderAnimatedVizSection(orderedRows)}
        </section>

        <section id="transcripts" class="report-section">
          <h2>Transcripts</h2>
          ${renderTranscriptExplorer(orderedRows)}
        </section>

        <section id="field-trajectories" class="report-section">
          <h2>Field Trajectories</h2>
          ${renderFieldTrajectories(orderedRows)}
        </section>

        <section id="run-details" class="report-section">
          <h2>Run Details</h2>
          <div class="table-scroll" role="region" aria-label="Run details table" tabindex="0">
          <table class="run-details-table">
      <thead><tr>
        <th>Policy</th>
        <th>Run</th>
        <th>Status</th>
        <th>${reportInfoTerm('grounded', 'Grounded')}</th>
        <th>Stop</th>
        <th>${reportInfoTerm('meanTurns', 'Turns')}</th>
        <th>${reportInfoTerm('meanCoverage', 'Coverage')}</th>
        <th>${reportInfoTerm('meanMissing', 'Missing')}</th>
        <th>${reportInfoTerm('bottleneck', 'Proof Status')}</th>
        <th>${reportInfoTerm('fieldDelta', 'Field Movement')}</th>
        <th>${reportInfoTerm('topRegisters', 'Registers')}</th>
        <th>${reportInfoTerm('efficacy', 'Efficacy')}</th>
        <th>${reportInfoTerm('leaks', 'Leaks')}</th>
        <th>Transcript</th>
        <th>Trace</th>
        <th>Log</th>
      </tr></thead>
      <tbody>${runRows || '<tr><td colspan="16">No run rows.</td></tr>'}</tbody>
          </table>
          </div>
        </section>
      </div>
    </div>
  </main>
</body>
</html>
`;
}

function writeHtmlReport({ summary, rows, htmlPath }) {
  const fieldSvgPaths = writeFieldSvgArtifacts({ rows, htmlPath });
  fs.writeFileSync(htmlPath, renderHtmlReport(summary, rows, { htmlPath }));
  console.log(`[auto-eval] wrote ${htmlPath}`);
  if (fieldSvgPaths.length) {
    console.log(`[auto-eval] wrote ${fieldSvgPaths.length} field SVGs to ${fieldSvgDirForReport(htmlPath)}`);
  }
  writeReportIndex();
}

function relativeReportPath(filePath) {
  if (!filePath) return null;
  return path.relative(ROOT, resolvePath(filePath));
}

function compactPolicyLedger(aggregates = {}) {
  return Object.fromEntries(
    Object.entries(aggregates.byPolicy || {}).map(([policy, row]) => [
      policy,
      {
        rows: row.rows || 0,
        ok: row.ok || 0,
        failed: row.failed || 0,
        grounded: row.grounded || 0,
        groundedRate: row.groundedRate || 0,
        meanTurns: row.meanTurns ?? null,
        meanCoverage: row.meanCoverage ?? null,
        meanMissing: row.meanMissing ?? null,
        registerCounts: row.registerCounts || {},
        registerEntropy: row.registerEntropy ?? null,
        leakCount: row.leakCount || 0,
        errorCount: row.errorCount || 0,
      },
    ]),
  );
}

function ledgerEntryForSummary({ summary, summaryPath, htmlPath }) {
  const config = summary.config || {};
  const aggregates = summary.aggregates || {};
  return {
    schema: 'machinespirits.tutor-stub.auto-eval-ledger.v1',
    recordedAt: new Date().toISOString(),
    startedAt: summary.startedAt || null,
    completedAt: summary.completedAt || null,
    runId: path.basename(summaryPath || summary.report?.json || 'auto-eval', '.json'),
    report: {
      json: relativeReportPath(summaryPath || summary.report?.json),
      html: relativeReportPath(htmlPath || summary.report?.html),
    },
    config: {
      runs: config.runs ?? null,
      policies: config.policies || [],
      turns: config.turns ?? null,
      safetyTurns: config.safetyTurns ?? null,
      parallelism: config.parallelism ?? null,
      model: config.model || null,
      analysisModel: config.analysisModel || null,
      autoLearnerModel: config.autoLearnerModel || null,
      autoLearnerProfileId: config.autoLearnerProfileId || null,
      world: config.world || null,
      maxTokens: config.maxTokens ?? null,
      historyTurns: config.historyTurns ?? null,
      memorySummary: config.memorySummary || null,
      resumedFrom: config.resumedFrom || null,
      resumeStatuses: config.resumeStatuses || null,
      dryRun: Boolean(config.dryRun),
    },
    totals: {
      rows: aggregates.rows || 0,
      completed: aggregates.completed || 0,
      ok: aggregates.ok || 0,
      failed: aggregates.failed || 0,
      dryRun: aggregates.dryRun || 0,
      grounded: aggregates.grounded || 0,
      groundedRate: aggregates.groundedRate || 0,
      meanTurns: aggregates.meanTurns ?? null,
      meanCoverage: aggregates.meanCoverage ?? null,
      meanMissing: aggregates.meanMissing ?? null,
      registerCounts: aggregates.registerCounts || {},
      registerEntropy: aggregates.registerEntropy ?? null,
      leakCount: aggregates.leakCount || 0,
      errorCount: aggregates.errorCount || 0,
    },
    byPolicy: compactPolicyLedger(aggregates),
  };
}

function readLedgerEntries(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return [];
  return fs
    .readFileSync(ledgerPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function markdownEscape(value) {
  return String(value ?? '')
    .replace(/\|/gu, '\\|')
    .replace(/\n/gu, ' ');
}

function formatLedgerPolicies(entry) {
  const policies = Array.isArray(entry.config?.policies) ? entry.config.policies : Object.keys(entry.byPolicy || {});
  return policies.join(', ');
}

function formatLedgerReports(entry) {
  const links = [];
  if (entry.report?.html) links.push(`[html](${entry.report.html})`);
  if (entry.report?.json) links.push(`[json](${entry.report.json})`);
  return links.join(' ');
}

function renderLedgerMarkdown(entries) {
  const lines = [
    '# Tutor Stub Auto-Eval Ledger',
    '',
    'This ledger is local/ignored and separate from the main evaluation database.',
    '',
    '| Recorded | Run | Policies | OK/Failed | Grounded | Mean Turns | Registers | Reports |',
    '|---|---|---|---:|---:|---:|---|---|',
  ];
  for (const entry of entries.slice().reverse()) {
    lines.push(
      [
        markdownEscape(entry.recordedAt || ''),
        markdownEscape(entry.runId || ''),
        markdownEscape(formatLedgerPolicies(entry)),
        `${entry.totals?.ok ?? 0}/${entry.totals?.failed ?? 0}`,
        markdownEscape(entry.totals?.groundedRate ?? ''),
        markdownEscape(entry.totals?.meanTurns ?? ''),
        markdownEscape(
          Object.entries(entry.totals?.registerCounts || {})
            .map(([key, value]) => `${key}:${value}`)
            .join(', '),
        ),
        formatLedgerReports(entry),
      ].join(' | '),
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function indexRootDir() {
  return resolvePath(args['index-root']);
}

function skipIndexScanDir(name) {
  return name === 'logs' || name === 'traces' || name.endsWith('-field-svg');
}

function listAutoEvalSummaryFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipIndexScanDir(entry.name)) stack.push(entryPath);
        continue;
      }
      if (/^auto-eval-.*\.json$/u.test(entry.name)) files.push(entryPath);
    }
  }
  return files;
}

function listAutoEvalRunStateFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipIndexScanDir(entry.name)) stack.push(entryPath);
        continue;
      }
      if (entry.name === 'run-state.json') files.push(entryPath);
    }
  }
  return files;
}

function reportHtmlPathForSummary(summary, jsonPath) {
  const sibling = jsonPath.replace(/\.json$/u, '.html');
  const reported = summary?.report?.html ? resolvePath(summary.report.html) : null;
  if (reported && fs.existsSync(reported)) return reported;
  if (fs.existsSync(sibling)) return sibling;
  return reported || sibling;
}

function reportFieldSvgFiles(htmlPath) {
  const svgDir = fieldSvgDirForReport(htmlPath);
  if (!fs.existsSync(svgDir)) return [];
  return fs
    .readdirSync(svgDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
    .map((entry) => path.join(svgDir, entry.name))
    .sort();
}

function shortDate(value) {
  if (!value) return '';
  return String(value)
    .replace(/\.\d{3}Z$/u, 'Z')
    .replace('T', ' ');
}

function indexAggregates(summary) {
  if (summary?.aggregates?.byPolicy) return summary.aggregates;
  return summarizeRows(resultRows(summary?.results || []));
}

function indexNumberOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function indexDetailRows(summary) {
  const rows = Array.isArray(summary?.rows) ? summary.rows : resultRows(summary?.results || []);
  return rows.map((row) => {
    const efficacyCounts = row.efficacyCounts || {};
    const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    return {
      policy: row.policy || 'unknown',
      status: row.status || 'unknown',
      groundedClosure: row.groundedClosure === true,
      turnCount: indexNumberOrNull(row.turnCount),
      bestPathCoverage: indexNumberOrNull(row.bestPathCoverage),
      missingPremiseCount: indexNumberOrNull(row.missingPremiseCount),
      leakCount: Number(row.leakCount || 0),
      errorCount: Number(row.errorCount || 0),
      registerEntropy: indexNumberOrNull(row.registerEntropy),
      registerCounts: row.registerCounts || {},
      efficacyCounts,
      efficacyTotal,
      positiveProgress: Number(efficacyCounts.positive_progress || 0),
      finalMastery: indexNumberOrNull(row.field?.final?.learnerMastery),
      finalRisk: indexNumberOrNull(row.field?.final?.learnerRisk),
      masteryGain: indexNumberOrNull(row.field?.delta?.learnerMastery),
      riskReduction:
        row.field?.delta?.learnerRisk === undefined || row.field?.delta?.learnerRisk === null
          ? null
          : -Number(row.field.delta.learnerRisk),
    };
  });
}

function qaMatrixChildInfoForPath(filePath) {
  if (!filePath) return null;
  const resolved = resolvePath(String(filePath));
  const parts = resolved.split(path.sep).filter(Boolean);
  const matrixIndex = parts.findIndex((part) => /^qa-matrix-\d{4}-/u.test(part));
  if (matrixIndex === -1 || matrixIndex + 1 >= parts.length) return null;
  const matrixId = parts[matrixIndex];
  const profile = parts[matrixIndex + 1];
  if (!profile || profile === 'logs' || profile === 'traces' || profile.endsWith('.json') || profile.endsWith('.md')) {
    return null;
  }
  const rootPrefix = resolved.startsWith(path.sep) ? path.sep : '';
  const matrixRoot = path.join(rootPrefix, ...parts.slice(0, matrixIndex + 1));
  return {
    kind: 'qa_matrix_child',
    matrixId,
    profile,
    matrixRoot,
    planPath: path.join(matrixRoot, 'qa-plan.json'),
  };
}

function qaMatrixChildInfoForSummary({ jsonPath = '', summary = {}, config = {} } = {}) {
  const candidates = [
    jsonPath,
    summary.report?.json,
    summary.report?.html,
    config.traceDir,
    summary.resume?.sourcePath,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const info = qaMatrixChildInfoForPath(candidate);
    if (info) return info;
  }
  return null;
}

function reportScopeForSummary({ jsonPath = '', summary = {}, config = {}, rootDir = ROOT } = {}) {
  const qaChild = qaMatrixChildInfoForSummary({ jsonPath, summary, config });
  if (!qaChild) {
    return {
      kind: 'standalone',
      label: 'Standalone auto-eval',
      note: 'Standalone auto-eval report.',
      matrixId: '',
      profile: '',
      planHref: '',
    };
  }
  const planHref = fs.existsSync(qaChild.planPath) ? hrefRelative(rootDir, qaChild.planPath) : '';
  return {
    kind: qaChild.kind,
    label: `QA matrix child: ${qaChild.profile}`,
    note: `One learner-profile slice of ${qaChild.matrixId}; not the consolidated QA matrix.`,
    matrixId: qaChild.matrixId,
    profile: qaChild.profile,
    planHref,
  };
}

function renderReportScopeBadge(scope) {
  if (scope?.kind === 'qa_matrix_child') {
    return `<span class="scope-badge matrix">${escapeHtml(scope.label)}</span>`;
  }
  return '';
}

function renderReportScopeNotice(scope) {
  if (scope?.kind !== 'qa_matrix_child') return '';
  return `<div class="scope-notice">
    <strong>${escapeHtml(scope.label)}</strong>
    <p>${escapeHtml(scope.note)} ${scope.planHref ? `<a href="${escapeHtml(scope.planHref)}">qa plan</a>` : ''}</p>
  </div>`;
}

function indexRunKind({ reportName, summary, config, aggregates, status }) {
  if (config.dryRun || aggregates.dryRun === aggregates.rows || status === 'dry_run') return 'dry';
  const smokeText = [
    reportName,
    config.traceDir,
    summary?.resume?.sourcePath,
    summary?.report?.json,
    summary?.report?.html,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/(^|[^a-z0-9])smoke([^a-z0-9]|$)/u.test(smokeText)) return 'smoke';
  return 'real';
}

function indexRunKindLabel(kind) {
  if (kind === 'dry') return 'dry run';
  if (kind === 'smoke') return 'smoke run';
  return 'real run';
}

function readIndexSummary(jsonPath, rootDir) {
  try {
    const summary = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const aggregates = indexAggregates(summary);
    const config = summary.config || {};
    const htmlPath = reportHtmlPathForSummary(summary, jsonPath);
    const svgFiles = reportFieldSvgFiles(htmlPath);
    const detailRows = indexDetailRows(summary);
    const okDetailRows = detailRows.filter((row) => row.status !== 'dry_run' && row.status !== 'failed');
    const efficacyCounts = mergeCounts(okDetailRows.map((row) => row.efficacyCounts));
    const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
    const relJson = hrefRelative(rootDir, jsonPath);
    const relParent = path.dirname(relJson);
    const reportName =
      relParent && relParent !== '.'
        ? `${relParent}/${path.basename(jsonPath, '.json')}`
        : path.basename(jsonPath, '.json');
    const reportScope = reportScopeForSummary({ jsonPath, summary, config, rootDir });
    const policies =
      Array.isArray(config.policies) && config.policies.length
        ? config.policies
        : Object.keys(aggregates.byPolicy || {});
    const policyText = policies.join(' ');
    const completedAt = summary.completedAt || summary.startedAt || '';
    const completedMs =
      Date.parse(completedAt) || Date.parse(summary.startedAt || '') || fs.statSync(jsonPath).mtimeMs || 0;
    const status =
      config.dryRun || aggregates.dryRun === aggregates.rows ? 'dry_run' : aggregates.failed ? 'failed' : 'ok';
    const runKind = indexRunKind({ reportName, summary, config, aggregates, status });
    const htmlExists = fs.existsSync(htmlPath);
    return {
      reportName,
      reportScope,
      runKind,
      jsonPath,
      htmlPath,
      htmlExists,
      jsonHref: hrefRelative(rootDir, jsonPath),
      htmlHref: htmlExists ? hrefRelative(rootDir, htmlPath) : '',
      svgHref: svgFiles.length ? `${hrefRelative(rootDir, fieldSvgDirForReport(htmlPath))}/` : '',
      svgCount: svgFiles.length,
      completedAt,
      startedAt: summary.startedAt || '',
      status,
      policies,
      learnerProfile: config.autoLearnerProfileId || '',
      world: config.world || '',
      dagMode: config.dagMode || 'strict_dag',
      turns: config.turns || '',
      safetyTurns: config.safetyTurns ?? '',
      model: config.model || '',
      analysisModel: config.analysisModel || '',
      autoLearnerModel: config.autoLearnerModel || '',
      rows: aggregates.rows || 0,
      ok: aggregates.ok || 0,
      failed: aggregates.failed || 0,
      dryRun: aggregates.dryRun || 0,
      grounded: aggregates.grounded || 0,
      groundedRate: aggregates.groundedRate || 0,
      meanTurns: aggregates.meanTurns ?? '',
      meanCoverage: aggregates.meanCoverage ?? '',
      meanMissing: aggregates.meanMissing ?? '',
      leakCount: aggregates.leakCount || 0,
      registerEntropy: aggregates.registerEntropy ?? '',
      finalMastery: mean(okDetailRows.map((row) => row.finalMastery)),
      finalRisk: mean(okDetailRows.map((row) => row.finalRisk)),
      masteryGain: mean(okDetailRows.map((row) => row.masteryGain)),
      riskReduction: mean(okDetailRows.map((row) => row.riskReduction)),
      progressRate: efficacyTotal
        ? Number((Number(efficacyCounts.positive_progress || 0) / efficacyTotal).toFixed(3))
        : 0,
      detailRows,
      policyText,
      completedMs,
      searchText: [
        reportName,
        reportScope.label,
        reportScope.note,
        reportScope.matrixId,
        reportScope.profile,
        runKind,
        indexRunKindLabel(runKind),
        status,
        policyText,
        config.autoLearnerProfileId,
        config.world,
        config.dagMode || 'strict_dag',
        config.turns,
        config.safetyTurns,
        config.model,
        config.analysisModel,
        config.autoLearnerModel,
        aggregates.rows ? `${aggregates.rows} rows` : '',
        aggregates.ok ? `${aggregates.ok} ok` : '',
        aggregates.failed ? `${aggregates.failed} failed` : '',
        aggregates.grounded ? `${aggregates.grounded} grounded` : '',
        shortDate(completedAt),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  } catch (error) {
    return {
      reportName: path.basename(jsonPath, '.json'),
      reportScope: {
        kind: 'unknown',
        label: 'Unreadable report',
        note: 'Could not parse report summary.',
        matrixId: '',
        profile: '',
        planHref: '',
      },
      runKind: 'smoke',
      jsonPath,
      htmlPath: '',
      htmlExists: false,
      jsonHref: hrefRelative(rootDir, jsonPath),
      htmlHref: '',
      svgHref: '',
      svgCount: 0,
      completedAt: '',
      startedAt: '',
      status: 'failed',
      policies: [],
      learnerProfile: '',
      world: '',
      dagMode: 'strict_dag',
      turns: '',
      safetyTurns: '',
      model: '',
      analysisModel: '',
      autoLearnerModel: '',
      rows: 0,
      ok: 0,
      failed: 1,
      dryRun: 0,
      grounded: 0,
      groundedRate: 0,
      meanTurns: '',
      meanCoverage: '',
      meanMissing: '',
      leakCount: 0,
      registerEntropy: '',
      finalMastery: 0,
      finalRisk: 0,
      masteryGain: 0,
      riskReduction: 0,
      progressRate: 0,
      detailRows: [],
      policyText: '',
      completedMs: fs.existsSync(jsonPath) ? fs.statSync(jsonPath).mtimeMs : 0,
      searchText: `${path.basename(jsonPath)} parse error`.toLowerCase(),
      parseError: error.message,
    };
  }
}

function readIndexRunState(statePath, rootDir) {
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    const updatedMs = Date.parse(state.updatedAt || '') || fs.statSync(statePath).mtimeMs || 0;
    const stale = state.status === 'running' && Date.now() - updatedMs > 15 * 60 * 1000;
    const status = stale ? 'stale' : state.status || 'running';
    const relState = hrefRelative(rootDir, statePath);
    const relParent = path.dirname(relState);
    const runName = relParent && relParent !== '.' ? relParent : path.basename(path.dirname(statePath));
    const reportScope = reportScopeForSummary({
      jsonPath: statePath,
      summary: { report: { json: statePath } },
      config: state.config || {},
      rootDir,
    });
    const jobs = (state.jobs || []).map((job) => {
      const traceDir = job.traceDir ? resolvePath(job.traceDir) : '';
      const latestTrace = traceDir ? latestTraceFile(traceDir) : null;
      const logPath = job.log ? resolvePath(job.log) : '';
      return {
        ...job,
        logHref: logPath ? hrefRelative(rootDir, logPath) : '',
        traceHref: latestTrace ? hrefRelative(rootDir, latestTrace) : '',
        traceDirHref: traceDir ? hrefRelative(rootDir, traceDir) : '',
      };
    });
    const activeJobs = jobs.filter((job) => job.status === 'running');
    return {
      runName,
      reportScope,
      statePath,
      stateHref: relState,
      status,
      pid: state.pid || '',
      startedAt: state.startedAt || '',
      updatedAt: state.updatedAt || '',
      updatedMs,
      traceDir: state.traceDir || '',
      traceDirHref: state.traceDir ? hrefRelative(rootDir, resolvePath(state.traceDir)) : '',
      config: state.config || {},
      policies: state.config?.policies || [],
      learnerProfile: state.config?.autoLearnerProfileId || '',
      world: state.config?.world || '',
      dagMode: state.config?.dagMode || 'strict_dag',
      totals: state.totals || {},
      jobs,
      activeJobs,
      searchText: [
        runName,
        reportScope.label,
        reportScope.note,
        reportScope.matrixId,
        reportScope.profile,
        status,
        state.config?.autoLearnerProfileId,
        state.config?.world,
        state.config?.dagMode || 'strict_dag',
        ...(state.config?.policies || []),
        shortDate(state.startedAt || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  } catch (error) {
    return {
      runName: path.basename(path.dirname(statePath)),
      reportScope: {
        kind: 'unknown',
        label: 'Unreadable run state',
        note: 'Could not parse run-state file.',
        matrixId: '',
        profile: '',
        planHref: '',
      },
      statePath,
      stateHref: hrefRelative(rootDir, statePath),
      status: 'stale',
      pid: '',
      startedAt: '',
      updatedAt: '',
      updatedMs: fs.existsSync(statePath) ? fs.statSync(statePath).mtimeMs : 0,
      traceDir: '',
      traceDirHref: '',
      config: {},
      policies: [],
      learnerProfile: '',
      world: '',
      dagMode: 'strict_dag',
      totals: { jobs: 0, completed: 0, active: 0, queued: 0, failed: 0 },
      jobs: [],
      activeJobs: [],
      searchText: `${path.basename(statePath)} parse error`.toLowerCase(),
      parseError: error.message,
    };
  }
}

function policyChips(policies) {
  if (!policies?.length) return '<span class="muted">none</span>';
  return policies.map((policy) => `<span class="chip">${escapeHtml(policy)}</span>`).join('');
}

function indexSelectOptions(values) {
  return values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
}

function formatIndexMeasure(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(digits).replace(/\.?0+$/u, '');
}

function renderIndexCoverageCell(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '<span class="muted">not scored</span>';
  const bounded = Math.max(0, Math.min(1, numeric));
  return `<div class="index-measure">
    <strong>${Math.round(bounded * 100)}% <span>evidence path</span></strong>
    <em>mean learner-DAG coverage ${escapeHtml(formatIndexMeasure(numeric))}</em>
  </div>`;
}

function indexReportActionLinks(row) {
  return `${
    row.htmlHref
      ? `<a href="${escapeHtml(row.htmlHref)}">report</a>`
      : '<span class="muted">report</span>'
  } <a href="${escapeHtml(row.jsonHref)}">json</a>`;
}

function renderIndexFieldSnapshotCell(row) {
  const count = Number(row.svgCount || 0);
  const label = `${count} field ${count === 1 ? 'snapshot' : 'snapshots'}`;
  const body = row.svgHref ? `<a href="${escapeHtml(row.svgHref)}">${escapeHtml(label)}</a>` : escapeHtml(label);
  return `<div class="index-measure">
    <strong>${body}</strong>
    <em>${count ? 'static SVG exports for inspection' : 'no exported field artifacts'}</em>
  </div>`;
}

function uniqueIndexValues(rows, selector) {
  return Array.from(
    new Set(
      rows
        .flatMap((row) => selector(row))
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function indexProgressBar(rate) {
  const bounded = Math.max(0, Math.min(1, Number(rate || 0)));
  return `<span class="live-progress" aria-label="${Math.round(bounded * 100)}% complete"><span style="width:${Math.round(
    bounded * 100,
  )}%"></span></span>`;
}

function renderLiveJob(job) {
  const coverage = job.coverage === null || job.coverage === undefined ? '' : ` · c${escapeHtml(job.coverage)}`;
  const bottleneck = job.bottleneck ? ` · ${escapeHtml(displayBottleneck(job.bottleneck))}` : '';
  const lastType = job.lastType ? ` · ${escapeHtml(job.lastType)}` : '';
  const links = [
    job.logHref ? `<a href="${escapeHtml(job.logHref)}">log</a>` : '',
    job.traceHref ? `<a href="${escapeHtml(job.traceHref)}">trace</a>` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<article class="live-job ${escapeHtml(job.status || 'queued')}">
    <div><strong>${escapeHtml(job.policy)} r${escapeHtml(job.runIndex)}</strong> <span>${escapeHtml(job.status || 'queued')}</span></div>
    <p>${escapeHtml(job.turns || 0)} turns${coverage}${bottleneck}${lastType}</p>
    <div class="live-links">${links || '<span class="muted">waiting for trace</span>'}</div>
  </article>`;
}

function renderLiveRuns(activeRuns) {
  if (!activeRuns.length) return '';
  return `<section class="live-runs" aria-label="Runs in progress">
    <div class="live-runs-head">
      <div>
        <h2><span class="live-dot"></span>Runs In Progress</h2>
        <p>Updated as active auto-eval workers write trace and log files. This page refreshes every 30 seconds while runs are visible.</p>
      </div>
      <span class="live-count">${escapeHtml(activeRuns.length)} active</span>
    </div>
    ${activeRuns
      .map((run) => {
        const totals = run.totals || {};
        const rate =
          totals.progressRate ?? (totals.jobs ? Number(totals.completed || 0) / Number(totals.jobs || 1) : 0);
        const activeJobs = run.activeJobs.length
          ? run.activeJobs
          : run.jobs.filter((job) => job.status !== 'queued').slice(-6);
        return `<article class="live-run-card ${escapeHtml(run.status)}" data-search="${escapeHtml(run.searchText)}">
          <div class="live-run-top">
            <div>
              <h3>${escapeHtml(run.runName)}</h3>
              <p>${escapeHtml(run.learnerProfile || 'unknown learner')} · ${escapeHtml(run.world || 'unknown world')} · ${escapeHtml(
                run.dagMode || 'strict_dag',
              )} · pid ${escapeHtml(
                run.pid || 'n/a',
              )}</p>
            </div>
            <span class="status ${escapeHtml(run.status)}">${escapeHtml(run.status)}</span>
          </div>
          <div class="live-run-progress">
            ${indexProgressBar(rate)}
            <span>${escapeHtml(totals.completed || 0)}/${escapeHtml(totals.jobs || 0)} jobs · ${escapeHtml(totals.active || 0)} active · ${escapeHtml(
              totals.queued || 0,
            )} queued · ${escapeHtml(totals.failed || 0)} failed</span>
          </div>
          <div class="live-run-meta">
            <span>started ${escapeHtml(shortDate(run.startedAt))}</span>
            <span>updated ${escapeHtml(shortDate(run.updatedAt))}</span>
            <span>${policyChips(run.policies)}</span>
          </div>
          <div class="live-jobs">${activeJobs.map(renderLiveJob).join('\n') || '<span class="muted">No active jobs.</span>'}</div>
          <div class="live-actions">
            <a href="${escapeHtml(run.stateHref)}">state json</a>
            ${run.traceDirHref ? `<a href="${escapeHtml(run.traceDirHref)}">trace dir</a>` : ''}
          </div>
        </article>`;
      })
      .join('\n')}
  </section>`;
}

function meanIndexNumbers(values) {
  const finite = values
    .filter((value) => value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  if (!finite.length) return null;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(3));
}

function formatIndexPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${Math.round(numeric * 100)}%`;
}

function formatIndexField(value) {
  return value === null || value === undefined ? 'n/a' : formatFieldValue(value);
}

function formatIndexSigned(value) {
  return value === null || value === undefined ? 'n/a' : formatSignedField(value);
}

function formatIndexPositive(value) {
  return value === null || value === undefined ? 'n/a' : formatPositiveField(value);
}

function indexProjectionPoint(row, index = 0) {
  const meanTurns = Number(row.meanTurns);
  const turnEfficiency = Number.isFinite(meanTurns) ? clampField01(1 - meanTurns / 120) : 0;
  return {
    key: row.key,
    x: Number(row.closureRate || 0),
    y: turnEfficiency,
    z: Number(row.signalScore || 0),
    radius: Math.max(4, Math.min(18, 4 + Math.sqrt(Number(row.ok || 0)) * 2)),
    colorIndex: index,
    metrics: {
      ok: row.ok,
      failed: row.failed,
      closureRate: row.closureRate,
      meanTurns: row.meanTurns,
      meanCoverage: row.meanCoverage,
      leakCount: row.leakCount,
      signalScore: row.signalScore,
    },
  };
}

function recentIndexReportRows(rows, { limit = 12 } = {}) {
  return rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).slice(0, limit);
}

function indexReportTime(row = {}) {
  const parsed = Date.parse(row.completedAt || row.startedAt || '');
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(row.completedMs || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function indexLatestReportByLearner(reportRows) {
  const byLearner = new Map();
  for (const row of reportRows) {
    const learner = row.learnerProfile || row.reportScope?.profile || 'default';
    if (!learner) continue;
    const existing = byLearner.get(learner);
    if (!existing || indexReportTime(row) > indexReportTime(existing)) {
      byLearner.set(learner, row);
    }
  }
  return [...byLearner.values()].sort((left, right) =>
    String(left.learnerProfile || left.reportScope?.profile || '').localeCompare(
      String(right.learnerProfile || right.reportScope?.profile || ''),
    ),
  );
}

function indexLearnerLensReports(rows, { activeRuns = [] } = {}) {
  const realReports = rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0);
  const activeMatrixIds = new Set(
    activeRuns
      .map((run) => run.reportScope?.matrixId)
      .filter(Boolean),
  );
  const matrixGroups = new Map();
  for (const row of realReports) {
    const scope = row.reportScope || {};
    if (scope.kind !== 'qa_matrix_child' || !scope.matrixId) continue;
    if (!matrixGroups.has(scope.matrixId)) matrixGroups.set(scope.matrixId, []);
    matrixGroups.get(scope.matrixId).push(row);
  }
  const cohorts = [...matrixGroups.entries()]
    .map(([matrixId, groupRows]) => {
      const reports = indexLatestReportByLearner(groupRows);
      const activeProfiles = new Set(
        activeRuns
          .filter((run) => run.reportScope?.matrixId === matrixId)
          .map((run) => run.learnerProfile || run.reportScope?.profile)
          .filter(Boolean),
      );
      return {
        kind: 'qa_matrix_matched',
        matrixId,
        reports,
        profileCount: reports.length,
        rowCount: reports.reduce((sum, row) => sum + Number(row.ok || 0), 0),
        completedMs: Math.max(...reports.map(indexReportTime), 0),
        active: activeMatrixIds.has(matrixId),
        activeProfiles: [...activeProfiles],
      };
    })
    .filter((cohort) => cohort.profileCount >= 2)
    .sort(
      (left, right) =>
        Number(right.active) - Number(left.active) ||
        right.completedMs - left.completedMs ||
        right.profileCount - left.profileCount ||
        right.rowCount - left.rowCount,
    );
  const selected = cohorts[0];
  if (selected) {
    const selectedNames = new Set(selected.reports.map((row) => row.reportName).filter(Boolean));
    return {
      ...selected,
      label: `${selected.active ? 'current' : 'latest'} matched QA cohort`,
      note: `One latest report per learner profile from ${selected.matrixId}.`,
      omittedReportCount: realReports.filter((row) => !selectedNames.has(row.reportName)).length,
    };
  }
  const reports = recentIndexReportRows(rows);
  return {
    kind: 'recent_reports',
    matrixId: '',
    label: 'recent real reports',
    note: 'No comparable QA-matrix learner cohort was available, so this falls back to the recent real-report lens.',
    reports,
    profileCount: new Set(reports.map((row) => row.learnerProfile || 'default')).size,
    rowCount: reports.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    completedMs: Math.max(...reports.map(indexReportTime), 0),
    active: false,
    activeProfiles: [],
    omittedReportCount: 0,
  };
}

function expandIndexDetailRows(reportRows) {
  return reportRows.flatMap((report) =>
    (report.detailRows || []).map((row) => ({
      ...row,
      reportName: report.reportName,
      learnerProfile: report.learnerProfile || 'default',
    })),
  );
}

function summarizeIndexDetailRows(rows) {
  const liveRows = rows.filter((row) => row.status !== 'dry_run');
  const okRows = liveRows.filter((row) => row.status !== 'failed');
  const totalTurns = okRows.reduce((sum, row) => sum + Number(row.turnCount || 0), 0);
  const efficacyCounts = mergeCounts(okRows.map((row) => row.efficacyCounts));
  const efficacyTotal = Object.values(efficacyCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const leakCount = okRows.reduce((sum, row) => sum + Number(row.leakCount || 0), 0);
  const registerCounts = mergeCounts(okRows.map((row) => row.registerCounts));
  const registers = Object.entries(registerCounts).flatMap(([register, count]) =>
    Array.from({ length: Number(count || 0) }, () => register),
  );
  return {
    rows: liveRows.length,
    ok: okRows.length,
    failed: liveRows.filter((row) => row.status === 'failed').length,
    grounded: okRows.filter((row) => row.groundedClosure).length,
    closureRate: okRows.length
      ? Number((okRows.filter((row) => row.groundedClosure).length / okRows.length).toFixed(3))
      : 0,
    meanTurns: meanIndexNumbers(okRows.map((row) => row.turnCount)),
    meanCoverage: meanIndexNumbers(okRows.map((row) => row.bestPathCoverage)),
    meanMissing: meanIndexNumbers(okRows.map((row) => row.missingPremiseCount)),
    finalMastery: meanIndexNumbers(okRows.map((row) => row.finalMastery)),
    finalRisk: meanIndexNumbers(okRows.map((row) => row.finalRisk)),
    masteryGain: meanIndexNumbers(okRows.map((row) => row.masteryGain)),
    riskReduction: meanIndexNumbers(okRows.map((row) => row.riskReduction)),
    registerEntropy: entropy(registers),
    progressRate: efficacyTotal
      ? Number((Number(efficacyCounts.positive_progress || 0) / efficacyTotal).toFixed(3))
      : 0,
    leakCount,
    leakDiscipline: clampField01(1 - leakCount / Math.max(1, totalTurns)),
    reportCount: new Set(rows.map((row) => row.reportName).filter(Boolean)).size,
  };
}

function indexSignalScore(stats) {
  const finalMastery = stats.finalMastery === null ? Number(stats.meanCoverage || 0) : Number(stats.finalMastery);
  const finalRisk = stats.finalRisk === null ? 0.5 : Number(stats.finalRisk);
  const masteryGain = stats.masteryGain === null ? 0 : Number(stats.masteryGain);
  const riskReduction = stats.riskReduction === null ? 0 : Number(stats.riskReduction);
  const turnEfficiency = clampField01(1 - Number(stats.meanTurns || 0) / 120);
  return roundField(
    0.22 * Number(stats.closureRate || 0) +
      0.16 * Number(stats.meanCoverage || 0) +
      0.14 * clampField01(finalMastery) +
      0.12 * clampField01(1 - finalRisk) +
      0.12 * clampField01(masteryGain) +
      0.1 * clampField01(riskReduction) +
      0.08 * Number(stats.leakDiscipline || 0) +
      0.04 * turnEfficiency +
      0.02 * Number(stats.progressRate || 0),
  );
}

function aggregateIndexDetailRows(rows, keyFn) {
  const buckets = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()].map(([key, bucketRows]) => {
    const stats = summarizeIndexDetailRows(bucketRows);
    return {
      key,
      ...stats,
      signalScore: indexSignalScore(stats),
    };
  });
}

function indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens = null }) {
  if (!reports.length)
    return ['No completed real reports are available yet. Run or rebuild a report to populate the dashboard.'];
  const bullets = [];
  const coverageText =
    stats.meanCoverage === null
      ? 'coverage is not yet available'
      : `${formatIndexPercent(stats.meanCoverage)} mean evidence coverage`;
  bullets.push(
    `Recent lens covers ${reports.length} real report${reports.length === 1 ? '' : 's'} and ${stats.ok} completed row${
      stats.ok === 1 ? '' : 's'
    }: ${stats.grounded}/${stats.ok} reached closed proof-state (${formatIndexPercent(stats.closureRate)}), with ${coverageText}.`,
  );
  const topPolicy = policyStats[0];
  if (topPolicy) {
    bullets.push(
      `Strongest policy signal in this lens is ${topPolicy.key}: ${formatIndexPercent(topPolicy.closureRate)} closure, ${
        topPolicy.meanTurns === null ? 'n/a' : topPolicy.meanTurns
      } mean turns, final M/R ${formatIndexField(topPolicy.finalMastery)}/${formatIndexField(topPolicy.finalRisk)}, and ${topPolicy.leakCount} leak${
        topPolicy.leakCount === 1 ? '' : 's'
      }.`,
    );
  }
  if (learnerStats.length > 1) {
    const slowest = learnerStats
      .filter((row) => Number.isFinite(Number(row.meanTurns)))
      .slice()
      .sort((left, right) => Number(right.meanTurns) - Number(left.meanTurns))[0];
    const lensLabel = learnerLens?.kind === 'qa_matrix_matched' ? ` in the ${learnerLens.label}` : '';
    bullets.push(
      `Learner robustness is being checked across ${learnerStats.length} profile${
        learnerStats.length === 1 ? '' : 's'
      }${lensLabel}; ${
        slowest ? `${slowest.key} is currently the slowest at ${slowest.meanTurns} mean turns.` : 'turn counts are not yet comparable.'
      }`,
    );
  }
  if (stats.leakCount > 0) {
    bullets.push(
      `Main open caution is leak discipline: ${stats.leakCount} leak audit flag${
        stats.leakCount === 1 ? '' : 's'
      } appear in the recent lens, so closure should be read alongside proof safety.`,
    );
  }
  if (stats.failed > 0) {
    bullets.push(
      `There ${stats.failed === 1 ? 'is' : 'are'} ${stats.failed} failed row${
        stats.failed === 1 ? '' : 's'
      } in the recent lens; inspect those before treating policy differences as pedagogical effects.`,
    );
  }
  return bullets;
}

function indexLearnerRobustnessRead({ learnerStats, activeRuns = [], learnerLens = null }) {
  const rows = learnerStats.slice(0, 6);
  if (!rows.length) {
    return [
      {
        label: 'No Data',
        text: 'No learner-profile rows are available yet.',
      },
    ];
  }
  const comparable = rows.filter((row) => Number.isFinite(Number(row.closureRate)) && Number.isFinite(Number(row.meanTurns)));
  const strong = comparable.filter((row) => Number(row.closureRate) >= 0.95 && Number(row.meanCoverage || 0) >= 0.95);
  const turns = strong.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const minTurns = turns.length ? Math.min(...turns) : null;
  const maxTurns = turns.length ? Math.max(...turns) : null;
  const weaker = comparable.filter((row) => Number(row.closureRate) < 0.95 || Number(row.meanCoverage || 0) < 0.95);
  const reportCounts = rows.map((row) => Number(row.reportCount || 0)).filter(Number.isFinite);
  const minReports = reportCounts.length ? Math.min(...reportCounts) : null;
  const maxReports = reportCounts.length ? Math.max(...reportCounts) : null;
  const notes = [
    learnerLens?.kind === 'qa_matrix_matched'
      ? {
          label: 'Matched Lens',
          text: `${learnerLens.label}: ${learnerLens.note} ${learnerLens.omittedReportCount} older or non-matching real report${
            learnerLens.omittedReportCount === 1 ? ' is' : 's are'
          } excluded from this learner-profile comparison.`,
        }
      : {
          label: 'Lens',
          text: learnerLens?.note || 'Learner rows are read from the same recent-report lens as the overall summary.',
        },
    {
      label: 'How To Read',
      text: 'Right means more closed proof-state. Up means fewer turns because the y-axis is turn efficiency. Larger bubbles mean more completed OK rows.',
    },
  ];
  const closureValues = comparable.map((row) => Number(row.closureRate)).filter(Number.isFinite);
  const coverageValues = comparable.map((row) => Number(row.meanCoverage)).filter(Number.isFinite);
  const allTurns = comparable.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const closureSpread = closureValues.length ? Math.max(...closureValues) - Math.min(...closureValues) : null;
  const coverageSpread = coverageValues.length ? Math.max(...coverageValues) - Math.min(...coverageValues) : null;
  const turnSpread = allTurns.length ? Math.max(...allTurns) - Math.min(...allTurns) : null;
  if (strong.length >= Math.max(2, rows.length - 1)) {
    notes.push({
      label: 'Main Pattern',
      text: `${strong.length}/${rows.length} profiles cluster at high closure and full evidence coverage${
        minTurns !== null && maxTurns !== null ? `, with about ${minTurns.toFixed(1)}-${maxTurns.toFixed(1)} turns` : ''
      }. That reads as high learner robustness, not strong learner separation.`,
    });
  } else {
    notes.push({
      label: 'Main Pattern',
      text: `${strong.length}/${rows.length} profiles are currently in the high-closure/full-coverage region. The learner profile effect is not flat yet.`,
    });
  }
  if (
    rows.length > 1 &&
    closureSpread !== null &&
    coverageSpread !== null &&
    turnSpread !== null &&
    closureSpread <= 0.02 &&
    coverageSpread <= 0.02 &&
    turnSpread <= 2
  ) {
    notes.push({
      label: 'Differentiation',
      text: `Closure, evidence coverage, and turn counts are nearly flat in this matched lens. The current profiles are not drawing a strong learner-separation signal here; read cost, leaks, and policy deltas before scaling profile sweeps.`,
    });
  }
  if (weaker.length) {
    const weakerNames = weaker.map((row) => row.key).join(', ');
    const lensName = learnerLens?.label || 'learner lens';
    notes.push({
      label: 'Caution',
      text: `${weakerNames} ${weaker.length === 1 ? 'sits' : 'sit'} outside the main cluster in this ${lensName}. Treat that as provisional when report counts differ or a QA slice is still running.`,
    });
  } else if (minReports !== null && maxReports !== null && minReports !== maxReports) {
    notes.push({
      label: 'Caution',
      text: `Report counts vary from ${minReports} to ${maxReports}, so small differences should not be read as stable learner-profile effects yet.`,
    });
  }
  const activeLearners = activeRuns.map((run) => run.learnerProfile).filter(Boolean);
  if (activeLearners.length) {
    const sameMatrixActive =
      learnerLens?.matrixId &&
      activeRuns.some((run) => run.reportScope?.matrixId === learnerLens.matrixId && run.status !== 'completed');
    notes.push({
      label: 'Live Run',
      text: `${[...new Set(activeLearners)].join(', ')} still has an active slice${
        sameMatrixActive ? ` in ${learnerLens.matrixId}` : ''
      }; refresh after completion before treating this as final.`,
    });
  }
  notes.push({
    label: 'Where To Look',
    text: 'If closure and coverage are flat, the remaining differences are mostly turn cost, leaks, and policy/register behavior rather than basic learner reachability.',
  });
  return notes;
}

function renderIndexBigPicture({ rows, activeRuns = [], hiddenByDefault = 0 }) {
  const reports = recentIndexReportRows(rows);
  const detailRows = expandIndexDetailRows(reports);
  const stats = summarizeIndexDetailRows(detailRows);
  const learnerLens = indexLearnerLensReports(rows, { activeRuns });
  const learnerDetailRows = expandIndexDetailRows(learnerLens.reports);
  const policyStats = aggregateIndexDetailRows(detailRows, (row) => row.policy).sort(
    (left, right) => right.signalScore - left.signalScore || compareReportPolicies(left.key, right.key),
  );
  const learnerStats = aggregateIndexDetailRows(learnerDetailRows, (row) => row.learnerProfile).sort(
    (left, right) => right.closureRate - left.closureRate || Number(left.meanTurns || 0) - Number(right.meanTurns || 0),
  );
  const bullets = indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens });
  const cautions = [
    hiddenByDefault
      ? `${hiddenByDefault} dry/smoke report${hiddenByDefault === 1 ? '' : 's'} are hidden from this lens by default.`
      : null,
    activeRuns.length
      ? `${activeRuns.length} run${activeRuns.length === 1 ? ' is' : 's are'} active or stale; refresh after completion for the final picture.`
      : null,
    reports.length < rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).length
      ? 'The headline uses the latest 12 real reports with completed rows; use filters below for older history.'
      : null,
  ].filter(Boolean);
  const policyRows = policyStats
    .slice(0, 7)
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.key)}</strong></td>
        <td class="numeric">${escapeHtml(row.ok)}/${escapeHtml(row.failed)}</td>
        <td class="numeric">${escapeHtml(formatIndexPercent(row.closureRate))}</td>
        <td class="numeric">${escapeHtml(formatIndexField(row.meanCoverage))}</td>
        <td class="numeric">${escapeHtml(formatIndexField(row.finalMastery))}/${escapeHtml(formatIndexField(row.finalRisk))}</td>
        <td class="numeric">${escapeHtml(formatIndexSigned(row.masteryGain))}/${escapeHtml(formatIndexPositive(row.riskReduction))}</td>
        <td class="numeric">${escapeHtml(row.leakCount)}</td>
        <td class="numeric">${escapeHtml(formatIndexMeasure(row.signalScore))}</td>
      </tr>`,
    )
    .join('\n');
  const learnerVizRows = learnerStats.slice(0, 6);
  const learnerVizColors = ['#E63946', '#0057B8', '#009B72', '#F2B705', '#6B4EFF', '#D72670'];
  const learnerOk = learnerVizRows.reduce((sum, row) => sum + Number(row.ok || 0), 0);
  const learnerFailed = learnerVizRows.reduce((sum, row) => sum + Number(row.failed || 0), 0);
  const learnerClosure = meanIndexNumbers(learnerVizRows.map((row) => row.closureRate));
  const learnerCoverage = meanIndexNumbers(learnerVizRows.map((row) => row.meanCoverage));
  const learnerTurns = learnerVizRows.map((row) => Number(row.meanTurns)).filter(Number.isFinite);
  const learnerTurnRange = learnerTurns.length
    ? `${Number(Math.min(...learnerTurns).toFixed(1))}${
        Math.max(...learnerTurns) === Math.min(...learnerTurns)
          ? ''
          : `-${Number(Math.max(...learnerTurns).toFixed(1))}`
      }`
    : 'n/a';
  const learnerActiveProfiles = learnerLens.activeProfiles || [];
  const learnerKpis = [
    {
      label: 'Profiles',
      value: learnerVizRows.length || learnerLens.profileCount || 0,
      sub: learnerLens.label,
      color: '#0057B8',
    },
    {
      label: 'Closure',
      value: formatIndexPercent(learnerClosure),
      sub: 'mean across shown profiles',
      color: '#009B72',
    },
    {
      label: 'Coverage',
      value: formatIndexPercent(learnerCoverage),
      sub: 'mean evidence path',
      color: '#E63946',
    },
    {
      label: 'Turn Spread',
      value: learnerTurnRange,
      sub: 'lower is faster closure',
      color: '#F2B705',
    },
    {
      label: 'Rows',
      value: `${learnerOk}/${learnerFailed}`,
      sub: 'OK/failed in matched lens',
      color: '#6B4EFF',
    },
    {
      label: 'Live',
      value: learnerActiveProfiles.length ? learnerActiveProfiles.join(', ') : 'none',
      sub: learnerActiveProfiles.length ? 'slice still running' : 'no active learner slice',
      color: '#0A0A0A',
    },
  ]
    .map(
      (item) =>
        `<div class="learner-kpi" style="--kpi-accent:${escapeHtml(item.color)}"><span>${escapeHtml(
          item.label,
        )}</span><strong>${escapeHtml(item.value)}</strong><em>${escapeHtml(item.sub)}</em></div>`,
    )
    .join('\n');
  const learnerMiniBar = (label, value, color) => {
    const bounded = clampField01(value);
    return `<div class="learner-mini-bar"><span>${escapeHtml(label)}</span><span class="learner-mini-track"><span style="--bar-width:${Math.round(
      bounded * 100,
    )}%;--bar-color:${escapeHtml(color)}"></span></span><b>${Math.round(bounded * 100)}%</b></div>`;
  };
  const learnerProfileBars = learnerVizRows
    .map((row, index) => {
      const color = learnerVizColors[index % learnerVizColors.length];
      const turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clampField01(1 - Number(row.meanTurns) / 120) : 0;
      return `<article class="learner-rowbar" style="--row-accent:${escapeHtml(color)}">
        <div class="learner-rowbar-head"><strong>${escapeHtml(row.key)}</strong><span>${escapeHtml(row.ok)}/${escapeHtml(
          row.failed,
        )} rows</span></div>
        <div class="learner-mini-bars">
          ${learnerMiniBar('Closure', row.closureRate, color)}
          ${learnerMiniBar('Coverage', row.meanCoverage, '#0A0A0A')}
          ${learnerMiniBar('Speed', turnEfficiency, '#E63946')}
        </div>
      </article>`;
    })
    .join('\n');
  const learnerReadoutCards = indexLearnerRobustnessRead({ learnerStats, activeRuns, learnerLens })
    .map(
      (row) =>
        `<article class="learner-readout-card"><strong>${escapeHtml(row.label || 'Read')}</strong><p>${escapeHtml(
          row.text || '',
        )}</p></article>`,
    )
    .join('\n');
  return `<section class="big-picture" id="big-picture" aria-label="Big picture summary">
    <div class="big-picture-head">
      <div>
        <h2>Big Picture</h2>
        <p>Deterministic rollup over the latest real, completed reports. It summarizes closure, evidence coverage, policy signal, learner-profile robustness, and the main cautions before you open individual reports.</p>
      </div>
      <span class="live-count">${escapeHtml(reports.length)} report${reports.length === 1 ? '' : 's'}</span>
    </div>
    <div class="big-picture-grid">
      <div class="big-picture-panel">
        <h3>Overall Read</h3>
        <ul class="big-picture-read">
          ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('\n')}
        </ul>
        ${
          cautions.length
            ? `<div class="big-picture-cautions">${cautions.map((caution) => `<div>${escapeHtml(caution)}</div>`).join('\n')}</div>`
            : ''
        }
      </div>
      <div class="big-picture-panel">
        <h3>Learner Robustness</h3>
        <p class="muted">${escapeHtml(learnerLens.label)} · ${escapeHtml(learnerLens.note)}</p>
        <div class="learner-infographic">
          <div class="learner-dashboard-grid">
            <div class="viz-frame">
              <div class="learner-profile-bars">${learnerProfileBars || '<span class="muted">No learner-profile rows yet.</span>'}</div>
              <div class="viz-caption"><span>Each learner bar shows closure, evidence coverage, and speed as normalized rates.</span><span>Use the dynamic index for the full scatter map when JavaScript is available.</span></div>
            </div>
            <div class="learner-snapshot">
              <div class="learner-snapshot-head"><div><strong>Learner Snapshot</strong><span>${escapeHtml(
                learnerLens.note,
              )}</span></div></div>
              <div class="learner-kpi-grid">${learnerKpis}</div>
            </div>
          </div>
          <div class="learner-readout">${learnerReadoutCards}</div>
        </div>
      </div>
    </div>
    <div class="table-scroll" role="region" aria-label="Policy signal table" tabindex="0">
      <table class="big-picture-table">
        <thead><tr>
          <th>Policy</th>
          <th>OK/Failed</th>
          <th>Closure</th>
          <th>Coverage</th>
          <th>Final M/R</th>
          <th>Gain/Reduction</th>
          <th>Leaks</th>
          <th>Signal</th>
        </tr></thead>
        <tbody>${policyRows || '<tr><td colspan="8">No policy rows yet.</td></tr>'}</tbody>
      </table>
    </div>
  </section>`;
}

function indexBigPictureModel({ rows, activeRuns = [], hiddenByDefault = 0 }) {
  const reports = recentIndexReportRows(rows);
  const detailRows = expandIndexDetailRows(reports);
  const stats = summarizeIndexDetailRows(detailRows);
  const learnerLens = indexLearnerLensReports(rows, { activeRuns });
  const learnerDetailRows = expandIndexDetailRows(learnerLens.reports);
  const policyStats = aggregateIndexDetailRows(detailRows, (row) => row.policy).sort(
    (left, right) => right.signalScore - left.signalScore || compareReportPolicies(left.key, right.key),
  );
  const learnerStats = aggregateIndexDetailRows(learnerDetailRows, (row) => row.learnerProfile).sort(
    (left, right) => right.closureRate - left.closureRate || Number(left.meanTurns || 0) - Number(right.meanTurns || 0),
  );
  const bullets = indexBigPictureBullets({ stats, policyStats, learnerStats, reports, learnerLens });
  const cautions = [
    hiddenByDefault
      ? `${hiddenByDefault} dry/smoke report${hiddenByDefault === 1 ? '' : 's'} are hidden from this lens by default.`
      : null,
    activeRuns.length
      ? `${activeRuns.length} run${activeRuns.length === 1 ? ' is' : 's are'} active or stale; refresh after completion for the final picture.`
      : null,
    reports.length < rows.filter((row) => row.runKind === 'real' && Number(row.ok || 0) > 0).length
      ? 'The headline uses the latest 12 real reports with completed rows; use filters below for older history.'
      : null,
  ].filter(Boolean);
  return {
    reportCount: reports.length,
    bullets,
    cautions,
    learnerLens: {
      kind: learnerLens.kind,
      matrixId: learnerLens.matrixId,
      label: learnerLens.label,
      note: learnerLens.note,
      profileCount: learnerLens.profileCount,
      rowCount: learnerLens.rowCount,
      omittedReportCount: learnerLens.omittedReportCount,
      active: learnerLens.active,
      activeProfiles: learnerLens.activeProfiles,
    },
    learnerReadout: indexLearnerRobustnessRead({ learnerStats, activeRuns, learnerLens }),
    policyStats: policyStats.slice(0, 7),
    learnerStats: learnerStats.slice(0, 6),
    projections: {
      axes: {
        x: 'closureRate',
        y: 'turnEfficiency',
        z: 'signalScore',
        radius: 'completedRows',
      },
      learners: learnerStats.slice(0, 6).map(indexProjectionPoint),
      policies: policyStats.slice(0, 7).map(indexProjectionPoint),
    },
  };
}

function indexRowData(row) {
  return {
    reportName: row.reportName || '',
    reportScope: row.reportScope || {
      kind: 'standalone',
      label: 'Standalone auto-eval',
      note: 'Standalone auto-eval report.',
      matrixId: '',
      profile: '',
      planHref: '',
    },
    runKind: row.runKind || 'real',
    htmlExists: Boolean(row.htmlExists),
    jsonHref: row.jsonHref || '',
    htmlHref: row.htmlHref || '',
    svgHref: row.svgHref || '',
    svgCount: Number(row.svgCount || 0),
    completedAt: row.completedAt || '',
    startedAt: row.startedAt || '',
    status: row.status || '',
    policies: row.policies || [],
    learnerProfile: row.learnerProfile || '',
    world: row.world || '',
    turns: row.turns || '',
    safetyTurns: row.safetyTurns ?? '',
    model: row.model || '',
    analysisModel: row.analysisModel || '',
    autoLearnerModel: row.autoLearnerModel || '',
    rows: Number(row.rows || 0),
    ok: Number(row.ok || 0),
    failed: Number(row.failed || 0),
    dryRun: Number(row.dryRun || 0),
    grounded: Number(row.grounded || 0),
    groundedRate: Number(row.groundedRate || 0),
    meanTurns: row.meanTurns ?? '',
    meanCoverage: row.meanCoverage ?? '',
    meanMissing: row.meanMissing ?? '',
    leakCount: Number(row.leakCount || 0),
    registerEntropy: row.registerEntropy ?? '',
    finalMastery: row.finalMastery ?? 0,
    finalRisk: row.finalRisk ?? 0,
    masteryGain: row.masteryGain ?? 0,
    riskReduction: row.riskReduction ?? 0,
    progressRate: row.progressRate ?? 0,
    detailRows: row.detailRows || [],
    policyText: row.policyText || '',
    completedMs: Number(row.completedMs || 0),
    searchText: row.searchText || '',
    parseError: row.parseError || '',
  };
}

function indexDataModel({ rows, activeRuns = [], rootDir, generatedAt }) {
  const guideHref = hrefRelative(rootDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const defaultRows = rows.filter((row) => row.runKind === 'real');
  const hiddenByDefault = rows.length - defaultRows.length;
  const totals = {
    reports: defaultRows.length,
    htmlReports: defaultRows.filter((row) => row.htmlExists).length,
    totalReports: rows.length,
    ok: defaultRows.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    failed: defaultRows.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    dryRun: defaultRows.reduce((sum, row) => sum + Number(row.dryRun || 0), 0),
    grounded: defaultRows.reduce((sum, row) => sum + Number(row.grounded || 0), 0),
    svgs: defaultRows.reduce((sum, row) => sum + Number(row.svgCount || 0), 0),
    hiddenByDefault,
  };
  return {
    schema: 'machinespirits.tutor-stub.report-index-data.v1',
    generatedAt,
    rootLabel: path.relative(ROOT, rootDir) || '.',
    guideHref,
    refreshMs: 30000,
    totals,
    options: {
      status: uniqueIndexValues(rows, (row) => [row.status]),
      learner: uniqueIndexValues(rows, (row) => [row.learnerProfile]),
      policy: uniqueIndexValues(rows, (row) => row.policies || []),
      world: uniqueIndexValues(rows, (row) => [row.world]),
    },
    bigPicture: indexBigPictureModel({ rows, activeRuns, hiddenByDefault }),
    rows: rows.map(indexRowData),
    activeRuns,
  };
}

function renderReportIndexShell({ rootDir, generatedAt }) {
  const assetVersion = encodeURIComponent(generatedAt || new Date().toISOString());
  const cssHref = `${hrefRelative(rootDir, path.join(rootDir, 'assets', 'tutor-stub-report.css'))}?v=${assetVersion}`;
  const appHref = `${hrefRelative(rootDir, path.join(rootDir, 'assets', 'tutor-stub-index.js'))}?v=${assetVersion}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tutor Stub Reports</title>
  <link rel="stylesheet" href="${escapeHtml(cssHref)}">
</head>
<body>
  <div id="tutor-stub-index-app" data-index-root data-index-data="index-data.json" data-generated-at="${escapeHtml(generatedAt)}">
    <header>
      <h1>Tutor Stub Reports</h1>
      <div class="muted">Loading report index...</div>
    </header>
  </div>
  <script src="${escapeHtml(appHref)}"></script>
</body>
</html>
`;
}

function tutorStubIndexClientJs() {
  return String.raw`(function () {
  var app = document.querySelector('[data-index-root]');
  if (!app) return;
  var state = { data: null };
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function shortDate(value) {
    return String(value || '').replace(/\.\d{3}Z$/g, 'Z').replace('T', ' ');
  }
  function indexRunKindLabel(kind) {
    if (kind === 'dry') return 'dry run';
    if (kind === 'smoke') return 'smoke run';
    return 'real run';
  }
  function scopeBadge(scope) {
    if (scope && scope.kind === 'qa_matrix_child') {
      return '<span class="scope-badge matrix">' + esc(scope.label || 'QA matrix child') + '</span>';
    }
    return '';
  }
  function scopeNote(scope) {
    if (scope && scope.kind === 'qa_matrix_child') {
      var link = scope.planHref ? ' <a href="' + esc(scope.planHref) + '">qa plan</a>' : '';
      return '<span class="scope-note">' + esc(scope.note || 'QA matrix child report.') + link + '</span>';
    }
    return '';
  }
  function infoTerm(label, tooltip) {
    return '<span class="info-term" tabindex="0" data-tip="' + esc(tooltip || label) + '">' + esc(label) + '</span>';
  }
  function htmlMetric(label, value, sub) {
    return '<div class="metric"><div class="metric-label">' + label + '</div><div class="metric-value">' + esc(value) + '</div><div class="metric-sub">' + esc(sub || '') + '</div></div>';
  }
  function policyChips(policies) {
    if (!policies || !policies.length) return '<span class="muted">none</span>';
    return policies.map(function (policy) { return '<span class="chip">' + esc(policy) + '</span>'; }).join('');
  }
  function pct(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? Math.round(numeric * 100) + '%' : 'n/a';
  }
  function field(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
  }
  function signed(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 'n/a';
    return (numeric >= 0 ? '+' : '') + numeric.toFixed(3);
  }
  function positive(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(3) : 'n/a';
  }
  function measure(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '';
    return String(Number(numeric.toFixed(3)));
  }
  function clamp01(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(1, numeric));
  }
  function vizColor(index) {
    var colors = ['#E63946', '#0057B8', '#009B72', '#F2B705', '#6B4EFF', '#D72670', '#0A0A0A', '#737373'];
    return colors[Math.abs(Number(index || 0)) % colors.length];
  }
  function turnLabel(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? String(Number(numeric.toFixed(1))) : 'n/a';
  }
  function coverageCell(value) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return '<span class="muted">not scored</span>';
    var bounded = Math.max(0, Math.min(1, numeric));
    return '<div class="index-measure"><strong>' + Math.round(bounded * 100) + '% <span>evidence path</span></strong><em>mean learner-DAG coverage ' + esc(measure(numeric)) + '</em></div>';
  }
  function fieldSnapshotCell(row) {
    var count = Number(row.svgCount || 0);
    var label = count + ' field ' + (count === 1 ? 'snapshot' : 'snapshots');
    var body = row.svgHref ? '<a href="' + esc(row.svgHref) + '">' + esc(label) + '</a>' : esc(label);
    return '<div class="index-measure"><strong>' + body + '</strong><em>' + (count ? 'static SVG exports for inspection' : 'no exported field artifacts') + '</em></div>';
  }
  function reportActionLinks(row) {
    return (row.htmlHref ? '<a href="' + esc(row.htmlHref) + '">report</a>' : '<span class="muted">report</span>') + ' <a href="' + esc(row.jsonHref) + '">json</a>';
  }
  function optionHtml(values) {
    return (values || []).map(function (value) { return '<option value="' + esc(value) + '">' + esc(value) + '</option>'; }).join('');
  }
  function progressBar(rate) {
    var bounded = Math.max(0, Math.min(1, Number(rate || 0)));
    return '<span class="live-progress" aria-label="' + Math.round(bounded * 100) + '% complete"><span style="width:' + Math.round(bounded * 100) + '%"></span></span>';
  }
  function renderLiveJob(job) {
    var coverage = job.coverage == null ? '' : ' · c' + esc(job.coverage);
    var bottleneck = job.bottleneck ? ' · ' + esc(job.bottleneck === 'grounded_asserted_secret' ? 'closed' : job.bottleneck) : '';
    var lastType = job.lastType ? ' · ' + esc(job.lastType) : '';
    var links = [job.logHref ? '<a href="' + esc(job.logHref) + '">log</a>' : '', job.traceHref ? '<a href="' + esc(job.traceHref) + '">trace</a>' : ''].filter(Boolean).join(' ');
    return '<article class="live-job ' + esc(job.status || 'queued') + '"><div><strong>' + esc(job.policy) + ' r' + esc(job.runIndex) + '</strong> <span>' + esc(job.status || 'queued') + '</span></div><p>' + esc(job.turns || 0) + ' turns' + coverage + bottleneck + lastType + '</p><div class="live-links">' + (links || '<span class="muted">waiting for trace</span>') + '</div></article>';
  }
  function renderLiveRuns(activeRuns) {
    if (!activeRuns || !activeRuns.length) return '';
    return '<section class="live-runs" aria-label="Runs in progress"><div class="live-runs-head"><div><h2><span class="live-dot"></span>Runs In Progress</h2><p>Updated as active auto-eval workers write trace and log files. This page refreshes itself while runs are visible.</p></div><span class="live-count">' + esc(activeRuns.length) + ' active</span></div>' +
      activeRuns.map(function (run) {
        var totals = run.totals || {};
        var rate = totals.progressRate != null ? totals.progressRate : (totals.jobs ? Number(totals.completed || 0) / Number(totals.jobs || 1) : 0);
        var activeJobs = run.activeJobs && run.activeJobs.length ? run.activeJobs : (run.jobs || []).filter(function (job) { return job.status !== 'queued'; }).slice(-6);
        return '<article class="live-run-card ' + esc(run.status) + '" data-search="' + esc(run.searchText) + '"><div class="live-run-top"><div><h3>' + esc(run.runName) + '</h3>' + scopeBadge(run.reportScope) + '<p>' + esc(run.learnerProfile || 'unknown learner') + ' · ' + esc(run.world || 'unknown world') + ' · ' + esc(run.dagMode || 'strict_dag') + ' · pid ' + esc(run.pid || 'n/a') + '</p>' + scopeNote(run.reportScope) + '</div><span class="status ' + esc(run.status) + '">' + esc(run.status) + '</span></div><div class="live-run-progress">' + progressBar(rate) + '<span>' + esc(totals.completed || 0) + '/' + esc(totals.jobs || 0) + ' jobs · ' + esc(totals.active || 0) + ' active · ' + esc(totals.queued || 0) + ' queued · ' + esc(totals.failed || 0) + ' failed</span></div><div class="live-run-meta"><span>started ' + esc(shortDate(run.startedAt)) + '</span><span>updated ' + esc(shortDate(run.updatedAt)) + '</span><span>' + policyChips(run.policies) + '</span></div><div class="live-jobs">' + (activeJobs.map(renderLiveJob).join('\n') || '<span class="muted">No active jobs.</span>') + '</div><div class="live-actions"><a href="' + esc(run.stateHref) + '">state json</a> ' + (run.traceDirHref ? '<a href="' + esc(run.traceDirHref) + '">trace dir</a>' : '') + '</div></article>';
      }).join('\n') + '</section>';
  }
  function projectionFor(row, index) {
    var turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clamp01(1 - Number(row.meanTurns) / 120) : 0;
    return {
      key: row.key,
      x: clamp01(row.closureRate),
      y: turnEfficiency,
      z: clamp01(row.signalScore),
      radius: Math.max(5, Math.min(18, 5 + Math.sqrt(Number(row.ok || 0)) * 2)),
      colorIndex: index
    };
  }
  function learnerProjection(model) {
    var projected = model && model.projections && model.projections.learners;
    if (projected && projected.length) return projected;
    return (model.learnerStats || []).map(projectionFor);
  }
  function renderLearnerMap(model) {
    var rows = model.learnerStats || [];
    if (!rows.length) return '<div class="viz-frame"><div class="viz-caption">No learner profile rows yet.</div></div>';
    var points = learnerProjection(model);
    var byKey = {};
    rows.forEach(function (row) { byKey[row.key] = row; });
    var width = 760;
    var height = 330;
    var left = 76;
    var right = 28;
    var top = 28;
    var bottom = 62;
    var chartW = width - left - right;
    var chartH = height - top - bottom;
    var grid = [0, 0.25, 0.5, 0.75, 1].map(function (tick) {
      var x = left + tick * chartW;
      var y = top + (1 - tick) * chartH;
      return '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + chartH) + '" stroke="#D4D4D8" stroke-width="1"/><text x="' + x + '" y="' + (top + chartH + 25) + '" text-anchor="middle" font-size="11" fill="#525252">' + Math.round(tick * 100) + '%</text><line x1="' + left + '" y1="' + y + '" x2="' + (left + chartW) + '" y2="' + y + '" stroke="#E5E5E5" stroke-width="1"/><text x="' + (left - 12) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#525252">' + Math.round(tick * 100) + '%</text>';
    }).join('');
    var labeledPoints = points.map(function (point, index) {
      var row = byKey[point.key] || rows[index] || {};
      var x = left + clamp01(point.x) * chartW;
      var y = top + (1 - clamp01(point.y)) * chartH;
      var radius = Number(point.radius || 9);
      var color = vizColor(point.colorIndex == null ? index : point.colorIndex);
      return { point: point, row: row, x: x, y: y, radius: radius, color: color, index: index, labelY: y + 4 };
    });
    var sortedLabels = labeledPoints.slice().sort(function (a, b) { return a.labelY - b.labelY; });
    var minLabelGap = 21;
    var minLabelY = top + 16;
    var maxLabelY = top + chartH - 8;
    sortedLabels.forEach(function (item, index) {
      item.labelY = Math.max(minLabelY, Math.min(maxLabelY, item.labelY));
      if (index > 0) item.labelY = Math.max(item.labelY, sortedLabels[index - 1].labelY + minLabelGap);
    });
    var overflow = sortedLabels.length ? sortedLabels[sortedLabels.length - 1].labelY - maxLabelY : 0;
    if (overflow > 0) {
      sortedLabels.forEach(function (item) { item.labelY -= overflow; });
      for (var i = sortedLabels.length - 2; i >= 0; i -= 1) {
        sortedLabels[i].labelY = Math.min(sortedLabels[i].labelY, sortedLabels[i + 1].labelY - minLabelGap);
      }
      sortedLabels.forEach(function (item) {
        item.labelY = Math.max(minLabelY, Math.min(maxLabelY, item.labelY));
      });
    }
    var pointSvg = labeledPoints.map(function (item) {
      var row = item.row;
      var x = item.x;
      var y = item.y;
      var radius = item.radius;
      var color = item.color;
      var labelSideLeft = x > width - right - 160;
      var labelX = labelSideLeft ? Math.max(left + 108, x - radius - 12) : Math.min(width - right - 108, x + radius + 12);
      var labelAnchor = labelSideLeft ? 'end' : 'start';
      var lineX = labelSideLeft ? labelX + 6 : labelX - 6;
      var labelY = item.labelY;
      var title = row.key + ': closure ' + pct(row.closureRate) + ', turns ' + turnLabel(row.meanTurns) + ', leaks ' + (row.leakCount || 0);
      return '<g><title>' + esc(title) + '</title><line x1="' + x.toFixed(1) + '" y1="' + y.toFixed(1) + '" x2="' + lineX.toFixed(1) + '" y2="' + labelY.toFixed(1) + '" stroke="#0A0A0A" stroke-width="1"/><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + radius.toFixed(1) + '" fill="' + color + '" fill-opacity="0.86" stroke="#0A0A0A" stroke-width="2"/><rect x="' + (labelSideLeft ? (labelX + 8) : (labelX - 16)).toFixed(1) + '" y="' + (labelY - 10).toFixed(1) + '" width="10" height="10" fill="' + color + '" stroke="#0A0A0A" stroke-width="1"/><text x="' + labelX.toFixed(1) + '" y="' + labelY.toFixed(1) + '" text-anchor="' + labelAnchor + '" font-size="13" font-weight="700" fill="#0A0A0A">' + esc(row.key || item.point.key) + '</text></g>';
    }).join('');
    return '<div class="viz-frame"><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Learner robustness map"><rect x="0" y="0" width="' + width + '" height="' + height + '" fill="#FFFFFF"/><rect x="' + left + '" y="' + top + '" width="' + chartW + '" height="' + chartH + '" fill="#FAFAFA" stroke="#0A0A0A" stroke-width="2"/>' + grid + '<text x="' + (left + chartW / 2) + '" y="' + (height - 16) + '" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A">closure rate</text><text transform="translate(22 ' + (top + chartH / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" font-weight="700" fill="#0A0A0A">turn efficiency</text>' + pointSvg + '</svg><div class="viz-caption"><span>x = closure; y = faster completion; bubble = completed rows; color separates learner profiles.</span><span>Projection data also includes z = composite signal for later 3D/WebGL views.</span></div></div>';
  }
  function meanValue(values) {
    var finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) return null;
    return finite.reduce(function (sum, value) { return sum + value; }, 0) / finite.length;
  }
  function rangeLabel(values, formatter) {
    var finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) return 'n/a';
    var min = Math.min.apply(Math, finite);
    var max = Math.max.apply(Math, finite);
    if (Math.abs(max - min) < 0.0001) return formatter(min);
    return formatter(min) + '-' + formatter(max);
  }
  function renderLearnerKpis(model) {
    var rows = model.learnerStats || [];
    var lens = model.learnerLens || {};
    var ok = rows.reduce(function (sum, row) { return sum + Number(row.ok || 0); }, 0);
    var failed = rows.reduce(function (sum, row) { return sum + Number(row.failed || 0); }, 0);
    var closure = meanValue(rows.map(function (row) { return row.closureRate; }));
    var coverage = meanValue(rows.map(function (row) { return row.meanCoverage; }));
    var turnRange = rangeLabel(rows.map(function (row) { return row.meanTurns; }), function (value) { return Number(value.toFixed(1)); });
    var activeProfiles = lens.activeProfiles && lens.activeProfiles.length ? lens.activeProfiles : [];
    var cards = [
      ['Profiles', rows.length || (lens.profileCount || 0), esc(lens.label || 'learner lens'), '#0057B8'],
      ['Closure', closure == null ? 'n/a' : pct(closure), 'mean across shown profiles', '#009B72'],
      ['Coverage', coverage == null ? 'n/a' : pct(coverage), 'mean evidence path', '#E63946'],
      ['Turn Spread', turnRange, 'lower is faster closure', '#F2B705'],
      ['Rows', ok + '/' + failed, 'OK/failed in matched lens', '#6B4EFF'],
      ['Live', activeProfiles.length ? activeProfiles.join(', ') : 'none', activeProfiles.length ? 'slice still running' : 'no active learner slice', '#0A0A0A']
    ];
    return '<div class="learner-snapshot"><div class="learner-snapshot-head"><div><strong>Learner Snapshot</strong><span>' + esc(lens.note || 'Matched learner-profile lens.') + '</span></div></div><div class="learner-kpi-grid">' + cards.map(function (card) {
      return '<div class="learner-kpi" style="--kpi-accent:' + esc(card[3]) + '"><span>' + esc(card[0]) + '</span><strong>' + esc(card[1]) + '</strong><em>' + esc(card[2]) + '</em></div>';
    }).join('') + '</div></div>';
  }
  function learnerMiniBar(label, value, color) {
    var bounded = clamp01(value);
    return '<div class="learner-mini-bar"><span>' + esc(label) + '</span><span class="learner-mini-track"><span style="--bar-width:' + Math.round(bounded * 100) + '%;--bar-color:' + esc(color) + '"></span></span><b>' + Math.round(bounded * 100) + '%</b></div>';
  }
  function renderLearnerBars(rows) {
    if (!rows || !rows.length) return '<div class="muted">No learner profile rows yet.</div>';
    return '<div class="learner-profile-bars">' + rows.map(function (row, index) {
      var color = vizColor(index);
      var turnEfficiency = Number.isFinite(Number(row.meanTurns)) ? clamp01(1 - Number(row.meanTurns) / 120) : 0;
      return '<article class="learner-rowbar" style="--row-accent:' + esc(color) + '"><div class="learner-rowbar-head"><strong>' + esc(row.key) + '</strong><span>' + esc(row.ok) + '/' + esc(row.failed) + ' rows</span></div><div class="learner-mini-bars">' + learnerMiniBar('Closure', row.closureRate, color) + learnerMiniBar('Coverage', row.meanCoverage, '#0A0A0A') + learnerMiniBar('Speed', turnEfficiency, '#E63946') + '</div></article>';
    }).join('') + '</div>';
  }
  function renderLearnerReadout(model) {
    var rows = model.learnerReadout || [];
    if (!rows.length) return '';
    return '<div class="learner-readout">' + rows.map(function (row) {
      return '<article class="learner-readout-card"><strong>' + esc(row.label || 'Read') + '</strong><p>' + esc(row.text || '') + '</p></article>';
    }).join('') + '</div>';
  }
  function renderLearnerRobustness(model) {
    return '<div class="learner-infographic"><div class="learner-dashboard-grid"><div>' + renderLearnerMap(model) + '</div><div>' + renderLearnerKpis(model) + '</div></div><div class="big-picture-viz-grid"><div>' + renderLearnerBars(model.learnerStats || []) + '</div><div>' + renderLearnerReadout(model) + '</div></div></div>';
  }
  function renderPolicySignal(model) {
    var rows = model.policyStats || [];
    if (!rows.length) return '<div class="muted">No policy rows yet.</div>';
    var maxSignal = rows.reduce(function (max, row) { return Math.max(max, Number(row.signalScore || 0)); }, 0) || 1;
    return '<div class="policy-bars">' + rows.map(function (row, index) {
      var color = vizColor(index);
      var width = Math.round((Number(row.signalScore || 0) / maxSignal) * 100);
      var meta = pct(row.closureRate) + ' closure · ' + turnLabel(row.meanTurns) + ' turns · ' + (row.leakCount || 0) + ' leaks';
      return '<div class="policy-bar-row"><strong>' + esc(row.key) + '</strong><div class="policy-bar" title="' + esc(meta) + '"><span style="--bar-width:' + width + '%;--bar-color:' + esc(color) + '"></span></div><span class="policy-bar-meta">' + esc(measure(row.signalScore)) + '</span></div>';
    }).join('') + '</div>';
  }
  function renderBigPicture(model) {
    model = model || { bullets: [], cautions: [], policyStats: [], learnerStats: [], reportCount: 0 };
    return '<section class="big-picture" id="big-picture" aria-label="Big picture summary"><div class="big-picture-head"><div><h2>Big Picture</h2><p>Deterministic rollup over the latest real, completed reports. It summarizes closure, evidence coverage, policy signal, learner-profile robustness, and the main cautions before you open individual reports.</p></div><span class="live-count">' + esc(model.reportCount) + ' report' + (model.reportCount === 1 ? '' : 's') + '</span></div><div class="big-picture-grid"><div class="big-picture-panel big-picture-panel-wide"><h3>Overall Read</h3><ul class="big-picture-read">' + (model.bullets || []).map(function (bullet) { return '<li>' + esc(bullet) + '</li>'; }).join('\n') + '</ul>' + ((model.cautions || []).length ? '<div class="big-picture-cautions">' + model.cautions.map(function (caution) { return '<div>' + esc(caution) + '</div>'; }).join('\n') + '</div>' : '') + '</div><div class="big-picture-panel big-picture-panel-wide"><h3>Learner Robustness</h3>' + renderLearnerRobustness(model) + '</div></div><div class="big-picture-panel"><h3>Policy Signal</h3>' + renderPolicySignal(model) + '</div></section>';
  }
  function reportRow(row) {
    var scope = row.reportScope || {};
    var links = reportActionLinks(row);
    return '<tr data-search="' + esc(row.searchText) + '" data-status="' + esc(row.status) + '" data-learner="' + esc(row.learnerProfile || '') + '" data-policies="' + esc((row.policies || []).join('|')) + '" data-policy-text="' + esc(row.policyText || '') + '" data-world="' + esc(row.world || '') + '" data-dag-mode="' + esc(row.dagMode || 'strict_dag') + '" data-completed-ms="' + esc(row.completedMs || 0) + '" data-report-name="' + esc(row.reportName || '') + '" data-report-scope="' + esc(scope.kind || 'standalone') + '" data-run-kind="' + esc(row.runKind || 'real') + '" data-grounded-rate="' + esc(row.groundedRate == null ? '' : row.groundedRate) + '" data-turns="' + esc(row.meanTurns == null ? '' : row.meanTurns) + '" data-coverage="' + esc(row.meanCoverage == null ? '' : row.meanCoverage) + '" data-rows="' + esc(row.rows || 0) + '" data-ok="' + esc(row.ok || 0) + '" data-failed="' + esc(row.failed || 0) + '" data-svgs="' + esc(row.svgCount || 0) + '"><td><div><strong>' + esc(shortDate(row.completedAt) || row.reportName) + '</strong> ' + scopeBadge(scope) + '</div><div class="muted">' + esc(row.reportName) + '</div><div class="muted">' + esc(row.world || '') + ' · ' + esc(row.dagMode || 'strict_dag') + ' · ' + esc(indexRunKindLabel(row.runKind || 'real')) + '</div>' + scopeNote(scope) + '</td><td class="actions links-cell">' + links + '</td><td><span class="status ' + esc(row.status) + '">' + esc(row.status) + '</span></td><td>' + policyChips(row.policies) + '</td><td><div>' + esc(row.learnerProfile || '') + '</div><div class="muted">' + esc(row.autoLearnerModel || '') + '</div></td><td>' + esc(row.ok) + '/' + esc(row.failed) + (row.dryRun ? ' · ' + esc(row.dryRun) + ' dry' : '') + '</td><td>' + esc(row.grounded) + '/' + esc(row.ok) + ' · ' + Math.round(Number(row.groundedRate || 0) * 100) + '%</td><td>' + esc(row.meanTurns) + '</td><td>' + coverageCell(row.meanCoverage) + '</td><td>' + fieldSnapshotCell(row) + '</td></tr>';
  }
  function render(data) {
    state.data = data;
    var totals = data.totals || {};
    var groundedRate = totals.ok ? Number((Number(totals.grounded || 0) / Number(totals.ok || 1)).toFixed(3)) : 0;
    var options = data.options || {};
    app.innerHTML = '<header><h1>Tutor Stub Reports</h1><div class="muted">Generated ' + esc(shortDate(data.generatedAt)) + ' · root ' + esc(data.rootLabel || '.') + ' · <a href="' + esc(data.guideHref || 'docs/tutor-stub-arc-guide.html') + '">arc guide</a></div></header><main>' + renderLiveRuns(data.activeRuns || []) + renderBigPicture(data.bigPicture) + '<section class="metrics">' + htmlMetric('Reports', totals.reports || 0, (totals.htmlReports || 0) + ' with HTML · ' + (totals.totalReports || 0) + ' total') + htmlMetric('Rows', Number(totals.ok || 0) + Number(totals.failed || 0) + Number(totals.dryRun || 0), (totals.failed || 0) + ' failed · ' + (totals.hiddenByDefault || 0) + ' hidden by default') + htmlMetric('Grounded', (totals.grounded || 0) + '/' + (totals.ok || 0), Math.round(groundedRate * 100) + '% closure') + htmlMetric(infoTerm('Field Snapshots', "Static SVG exports written beside reports for inspecting each row's interaction-field visualization. They are report artifacts, not scored rows."), totals.svgs || 0, 'static visualization exports') + htmlMetric('Active', (data.activeRuns || []).length, 'running or stale') + '</section><section class="report-list" id="report-list"><div class="report-list-head"><div><h2>Report List</h2><p>Filtered report rows. The table body scrolls inside this framed surface; the header stays visible while rows move underneath.</p></div></div><div class="toolbar"><label class="control"><span>Search</span><input data-filter placeholder="Search reports, policies, learner, model" aria-label="Search reports"></label><label class="control"><span>Run Set</span><select data-scope-filter aria-label="Choose which reports to include"><option value="real" selected>Real runs</option><option value="all">Everything</option></select></label><label class="control"><span>From</span><input type="date" data-date-from aria-label="Filter from completed date"></label><label class="control"><span>To</span><input type="date" data-date-to aria-label="Filter to completed date"></label><label class="control"><span>Status</span><select data-status-filter aria-label="Filter by status"><option value="">All</option>' + optionHtml(options.status) + '</select></label><label class="control"><span>Learner</span><select data-learner-filter aria-label="Filter by learner"><option value="">All</option>' + optionHtml(options.learner) + '</select></label><label class="control"><span>Policy</span><select data-policy-filter aria-label="Filter by policy"><option value="">All</option>' + optionHtml(options.policy) + '</select></label><label class="control"><span>World</span><select data-world-filter aria-label="Filter by world"><option value="">All</option>' + optionHtml(options.world) + '</select></label><label class="control"><span>Sort</span><select data-sort-key aria-label="Sort reports"><option value="date">Date</option><option value="status">Status</option><option value="learner">Learner</option><option value="policy">Policy</option><option value="grounded">Grounded</option><option value="coverage">Evidence Path</option><option value="turns">Turns</option><option value="rows">Rows</option><option value="failed">Failed</option><option value="svgs">Field Snapshots</option><option value="report">Report</option></select></label><label class="control"><span>Direction</span><select data-sort-dir aria-label="Sort direction"><option value="desc">Desc</option><option value="asc">Asc</option></select></label><button type="button" data-reset>Reset</button><span class="muted" data-count>0 shown</span></div><div class="table-scroll report-index-scroll" role="region" aria-label="Report table" tabindex="0"><table class="report-index-table"><thead><tr><th>Completed</th><th class="links-cell">Links</th><th>' + infoTerm('Status', 'Run-level technical status: ok has no failed rows, failed has one or more failed rows, dry_run is configuration-only output.') + '</th><th>Policies</th><th>Learner</th><th>' + infoTerm('OK/Failed', 'OK rows completed without a technical failure. Failed rows are generation, resume, or evaluation failures.') + '</th><th>' + infoTerm('Grounded', 'Rows where the learner reached grounded asserted-secret closure, shown as grounded over OK rows plus percentage.') + '</th><th>' + infoTerm('Turns', 'Mean learner turns used by completed rows before grounded closure or another stop condition.') + '</th><th>' + infoTerm('Evidence Path', 'Mean learner-DAG best-path coverage: how much of the target evidence path is grounded, shown as a percentage with the raw 0 to 1 coverage score underneath.') + '</th><th>' + infoTerm('Field Snapshots', 'Count of static SVG exports emitted beside the report for inspecting per-row interaction-field visualizations. This is an artifact count, not an evaluation score.') + '</th></tr></thead><tbody>' + ((data.rows || []).map(reportRow).join('\n') || '<tr><td colspan="10">No reports found.</td></tr>') + '</tbody></table></div></section></main>';
    bindControls();
    if (window.location.hash) {
      var anchor = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (anchor) window.requestAnimationFrame(function () { anchor.scrollIntoView({ block: 'start' }); });
    }
  }
  function bindControls() {
    var input = app.querySelector('[data-filter]');
    var scopeFilter = app.querySelector('[data-scope-filter]');
    var dateFrom = app.querySelector('[data-date-from]');
    var dateTo = app.querySelector('[data-date-to]');
    var statusFilter = app.querySelector('[data-status-filter]');
    var learnerFilter = app.querySelector('[data-learner-filter]');
    var policyFilter = app.querySelector('[data-policy-filter]');
    var worldFilter = app.querySelector('[data-world-filter]');
    var sortKey = app.querySelector('[data-sort-key]');
    var sortDir = app.querySelector('[data-sort-dir]');
    var reset = app.querySelector('[data-reset]');
    var tbody = app.querySelector('tbody');
    var rows = Array.from(app.querySelectorAll('tbody tr[data-search]'));
    var count = app.querySelector('[data-count]');
    var numericSortKeys = new Set(['date', 'grounded', 'coverage', 'turns', 'rows', 'failed', 'svgs']);
    var sortMap = { date: 'completedMs', status: 'status', learner: 'learner', policy: 'policyText', grounded: 'groundedRate', coverage: 'coverage', turns: 'turns', rows: 'rows', failed: 'failed', svgs: 'svgs', report: 'reportName' };
    function numberValue(row, key) {
      var value = Number(row.dataset[key] || '');
      return Number.isFinite(value) ? value : null;
    }
    function stringValue(row, key) {
      return String(row.dataset[key] || '').toLowerCase();
    }
    function dayStartMs(value) {
      if (!value) return null;
      var parsed = Date.parse(value + 'T00:00:00');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function dayEndMs(value) {
      if (!value) return null;
      var parsed = Date.parse(value + 'T23:59:59.999');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function compareValues(a, b, direction) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') return direction === 'asc' ? a - b : b - a;
      var base = String(a).localeCompare(String(b));
      return direction === 'asc' ? base : -base;
    }
    function rowMatches(row) {
      var q = (input && input.value || '').trim().toLowerCase();
      var scope = scopeFilter && scopeFilter.value || 'real';
      var status = statusFilter && statusFilter.value || '';
      var learner = learnerFilter && learnerFilter.value || '';
      var policy = policyFilter && policyFilter.value || '';
      var world = worldFilter && worldFilter.value || '';
      var fromMs = dayStartMs(dateFrom && dateFrom.value || '');
      var toMs = dayEndMs(dateTo && dateTo.value || '');
      var completedMs = numberValue(row, 'completedMs');
      if (scope === 'real' && row.dataset.runKind !== 'real') return false;
      if (q && !row.dataset.search.includes(q)) return false;
      if (fromMs !== null && (completedMs === null || completedMs < fromMs)) return false;
      if (toMs !== null && (completedMs === null || completedMs > toMs)) return false;
      if (status && row.dataset.status !== status) return false;
      if (learner && row.dataset.learner !== learner) return false;
      if (world && row.dataset.world !== world) return false;
      if (policy && !String(row.dataset.policies || '').split('|').includes(policy)) return false;
      return true;
    }
    function applyIndexControls() {
      var key = sortKey && sortKey.value || 'date';
      var direction = sortDir && sortDir.value || 'desc';
      var datasetKey = sortMap[key] || 'completedMs';
      var sortedRows = rows.slice().sort(function (a, b) {
        var aValue = numericSortKeys.has(key) ? numberValue(a, datasetKey) : stringValue(a, datasetKey);
        var bValue = numericSortKeys.has(key) ? numberValue(b, datasetKey) : stringValue(b, datasetKey);
        return compareValues(aValue, bValue, direction) || stringValue(a, 'reportName').localeCompare(stringValue(b, 'reportName'));
      });
      var shown = 0;
      sortedRows.forEach(function (row) {
        var visible = rowMatches(row);
        row.hidden = !visible;
        if (visible) shown += 1;
        if (tbody) tbody.appendChild(row);
      });
      if (count) count.textContent = shown + ' shown';
    }
    [input, scopeFilter, dateFrom, dateTo, statusFilter, learnerFilter, policyFilter, worldFilter, sortKey, sortDir].forEach(function (control) {
      if (control) control.addEventListener(control === input ? 'input' : 'change', applyIndexControls);
    });
    if (reset) reset.addEventListener('click', function () {
      if (input) input.value = '';
      if (scopeFilter) scopeFilter.value = 'real';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (statusFilter) statusFilter.value = '';
      if (learnerFilter) learnerFilter.value = '';
      if (policyFilter) policyFilter.value = '';
      if (worldFilter) worldFilter.value = '';
      if (sortKey) sortKey.value = 'date';
      if (sortDir) sortDir.value = 'desc';
      applyIndexControls();
    });
    applyIndexControls();
  }
  async function load() {
    var dataPath = app.getAttribute('data-index-data') || 'index-data.json';
    try {
      var response = await fetch(dataPath, { cache: 'no-store' });
      if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
      var data = await response.json();
      render(data);
      if ((data.activeRuns || []).length) {
        window.setTimeout(load, Number(data.refreshMs || 30000));
      }
    } catch (error) {
      app.innerHTML = '<header><h1>Tutor Stub Reports</h1><div class="muted">Could not load index data: ' + esc(error.message || error) + '</div></header>';
    }
  }
  load();
})();`;
}

function writeReportIndexAssets(rootDir) {
  const assetDir = path.join(rootDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(path.join(assetDir, 'tutor-stub-report.css'), machineSpiritsReportCss());
  fs.writeFileSync(path.join(assetDir, 'tutor-stub-index.js'), `${tutorStubIndexClientJs()}\n`);
}

function _renderReportIndex({ rows, activeRuns = [], rootDir, generatedAt }) {
  const guideHref = hrefRelative(rootDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const defaultRows = rows.filter((row) => row.runKind === 'real');
  const hiddenByDefault = rows.length - defaultRows.length;
  const totals = {
    reports: defaultRows.length,
    ok: defaultRows.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    failed: defaultRows.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    dryRun: defaultRows.reduce((sum, row) => sum + Number(row.dryRun || 0), 0),
    grounded: defaultRows.reduce((sum, row) => sum + Number(row.grounded || 0), 0),
    svgs: defaultRows.reduce((sum, row) => sum + Number(row.svgCount || 0), 0),
  };
  const groundedRate = totals.ok ? Number((totals.grounded / totals.ok).toFixed(3)) : 0;
  const statusOptions = uniqueIndexValues(rows, (row) => [row.status]);
  const learnerOptions = uniqueIndexValues(rows, (row) => [row.learnerProfile]);
  const policyOptions = uniqueIndexValues(rows, (row) => row.policies || []);
  const worldOptions = uniqueIndexValues(rows, (row) => [row.world]);
  const reportRows = rows
    .map(
      (row) => `<tr
        data-search="${escapeHtml(row.searchText)}"
        data-status="${escapeHtml(row.status)}"
        data-learner="${escapeHtml(row.learnerProfile || '')}"
        data-policies="${escapeHtml((row.policies || []).join('|'))}"
        data-policy-text="${escapeHtml(row.policyText || '')}"
        data-world="${escapeHtml(row.world || '')}"
        data-dag-mode="${escapeHtml(row.dagMode || 'strict_dag')}"
        data-completed-ms="${escapeHtml(row.completedMs || 0)}"
        data-report-name="${escapeHtml(row.reportName || '')}"
        data-run-kind="${escapeHtml(row.runKind || 'real')}"
        data-grounded-rate="${escapeHtml(row.groundedRate ?? '')}"
        data-turns="${escapeHtml(row.meanTurns ?? '')}"
        data-coverage="${escapeHtml(row.meanCoverage ?? '')}"
        data-rows="${escapeHtml(row.rows || 0)}"
        data-ok="${escapeHtml(row.ok || 0)}"
        data-failed="${escapeHtml(row.failed || 0)}"
        data-svgs="${escapeHtml(row.svgCount || 0)}">
        <td>
          <div><strong>${escapeHtml(shortDate(row.completedAt) || row.reportName)}</strong></div>
          <div class="muted">${escapeHtml(row.reportName)}</div>
          <div class="muted">${escapeHtml(row.world || '')} · ${escapeHtml(row.dagMode || 'strict_dag')} · ${escapeHtml(indexRunKindLabel(row.runKind || 'real'))}</div>
        </td>
        <td class="actions links-cell">${indexReportActionLinks(row)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${policyChips(row.policies)}</td>
        <td>
          <div>${escapeHtml(row.learnerProfile || '')}</div>
          <div class="muted">${escapeHtml(row.autoLearnerModel || '')}</div>
        </td>
        <td>${escapeHtml(row.ok)}/${escapeHtml(row.failed)}${row.dryRun ? ` · ${escapeHtml(row.dryRun)} dry` : ''}</td>
        <td>${escapeHtml(row.grounded)}/${escapeHtml(row.ok)} · ${Math.round(Number(row.groundedRate || 0) * 100)}%</td>
        <td>${escapeHtml(row.meanTurns)}</td>
        <td>${renderIndexCoverageCell(row.meanCoverage)}</td>
        <td>${renderIndexFieldSnapshotCell(row)}</td>
      </tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${activeRuns.length ? '<meta http-equiv="refresh" content="30">' : ''}
  <title>Tutor Stub Reports</title>
  <style>
    ${machineSpiritsReportCss()}
  </style>
</head>
<body>
  <header>
    <h1>Tutor Stub Reports</h1>
    <div class="muted">
      Generated ${escapeHtml(shortDate(generatedAt))} · root ${escapeHtml(path.relative(ROOT, rootDir) || '.')} ·
      <a href="${escapeHtml(guideHref || 'docs/tutor-stub-arc-guide.html')}">arc guide</a>
    </div>
  </header>
  <main>
    ${renderLiveRuns(activeRuns)}
    ${renderIndexBigPicture({ rows, activeRuns, hiddenByDefault })}
    <section class="metrics">
      ${htmlMetric('Reports', totals.reports, `${defaultRows.filter((row) => row.htmlExists).length} with HTML · ${rows.length} total`)}
      ${htmlMetric('Rows', totals.ok + totals.failed + totals.dryRun, `${totals.failed} failed · ${hiddenByDefault} hidden by default`)}
      ${htmlMetric('Grounded', `${totals.grounded}/${totals.ok}`, `${Math.round(groundedRate * 100)}% closure`)}
      ${htmlMetricInfo(
        'Field Snapshots',
        "Static SVG exports written beside reports for inspecting each row's interaction-field visualization. They are report artifacts, not scored rows.",
        totals.svgs,
        'static visualization exports',
      )}
      ${htmlMetric('Active', activeRuns.length, 'running or stale')}
    </section>
    <div class="toolbar">
      <label class="control">
        <span>Search</span>
        <input data-filter placeholder="Search reports, policies, learner, model" aria-label="Search reports">
      </label>
      <label class="control">
        <span>Run Set</span>
        <select data-scope-filter aria-label="Choose which reports to include">
          <option value="real" selected>Real runs</option>
          <option value="all">Everything</option>
        </select>
      </label>
      <label class="control">
        <span>From</span>
        <input type="date" data-date-from aria-label="Filter from completed date">
      </label>
      <label class="control">
        <span>To</span>
        <input type="date" data-date-to aria-label="Filter to completed date">
      </label>
      <label class="control">
        <span>Status</span>
        <select data-status-filter aria-label="Filter by status">
          <option value="">All</option>
          ${indexSelectOptions(statusOptions)}
        </select>
      </label>
      <label class="control">
        <span>Learner</span>
        <select data-learner-filter aria-label="Filter by learner">
          <option value="">All</option>
          ${indexSelectOptions(learnerOptions)}
        </select>
      </label>
      <label class="control">
        <span>Policy</span>
        <select data-policy-filter aria-label="Filter by policy">
          <option value="">All</option>
          ${indexSelectOptions(policyOptions)}
        </select>
      </label>
      <label class="control">
        <span>World</span>
        <select data-world-filter aria-label="Filter by world">
          <option value="">All</option>
          ${indexSelectOptions(worldOptions)}
        </select>
      </label>
      <label class="control">
        <span>Sort</span>
        <select data-sort-key aria-label="Sort reports">
          <option value="date">Date</option>
          <option value="status">Status</option>
          <option value="learner">Learner</option>
          <option value="policy">Policy</option>
          <option value="grounded">Grounded</option>
          <option value="coverage">Evidence Path</option>
          <option value="turns">Turns</option>
          <option value="rows">Rows</option>
          <option value="failed">Failed</option>
          <option value="svgs">Field Snapshots</option>
          <option value="report">Report</option>
        </select>
      </label>
      <label class="control">
        <span>Direction</span>
        <select data-sort-dir aria-label="Sort direction">
          <option value="desc">Desc</option>
          <option value="asc">Asc</option>
        </select>
      </label>
      <button type="button" data-reset>Reset</button>
      <span class="muted" data-count>${defaultRows.length} shown</span>
    </div>
    <div class="table-scroll report-index-scroll" role="region" aria-label="Report table" tabindex="0">
    <table class="report-index-table">
      <thead><tr>
        <th>Completed</th>
        <th class="links-cell">Links</th>
        <th>${infoTerm('Status', 'Run-level technical status: ok has no failed rows, failed has one or more failed rows, dry_run is configuration-only output.')}</th>
        <th>Policies</th>
        <th>Learner</th>
        <th>${infoTerm('OK/Failed', 'OK rows completed without a technical failure. Failed rows are generation, resume, or evaluation failures.')}</th>
        <th>${infoTerm('Grounded', 'Rows where the learner reached grounded asserted-secret closure, shown as grounded over OK rows plus percentage.')}</th>
        <th>${infoTerm('Turns', 'Mean learner turns used by completed rows before grounded closure or another stop condition.')}</th>
        <th>${infoTerm('Evidence Path', 'Mean learner-DAG best-path coverage: how much of the target evidence path is grounded, shown as a percentage with the raw 0 to 1 coverage score underneath.')}</th>
        <th>${infoTerm('Field Snapshots', 'Count of static SVG exports emitted beside the report for inspecting per-row interaction-field visualizations. This is an artifact count, not an evaluation score.')}</th>
      </tr></thead>
      <tbody>${reportRows || '<tr><td colspan="10">No reports found.</td></tr>'}</tbody>
    </table>
    </div>
  </main>
  <script>
    const input = document.querySelector('[data-filter]');
    const scopeFilter = document.querySelector('[data-scope-filter]');
    const dateFrom = document.querySelector('[data-date-from]');
    const dateTo = document.querySelector('[data-date-to]');
    const statusFilter = document.querySelector('[data-status-filter]');
    const learnerFilter = document.querySelector('[data-learner-filter]');
    const policyFilter = document.querySelector('[data-policy-filter]');
    const worldFilter = document.querySelector('[data-world-filter]');
    const sortKey = document.querySelector('[data-sort-key]');
    const sortDir = document.querySelector('[data-sort-dir]');
    const reset = document.querySelector('[data-reset]');
    const tbody = document.querySelector('tbody');
    const rows = Array.from(document.querySelectorAll('tbody tr[data-search]'));
    const count = document.querySelector('[data-count]');
    const numericSortKeys = new Set(['date', 'grounded', 'coverage', 'turns', 'rows', 'failed', 'svgs']);
    const sortMap = {
      date: 'completedMs',
      status: 'status',
      learner: 'learner',
      policy: 'policyText',
      grounded: 'groundedRate',
      coverage: 'coverage',
      turns: 'turns',
      rows: 'rows',
      failed: 'failed',
      svgs: 'svgs',
      report: 'reportName',
    };
    function numberValue(row, key) {
      const value = Number(row.dataset[key] || '');
      return Number.isFinite(value) ? value : null;
    }
    function stringValue(row, key) {
      return String(row.dataset[key] || '').toLowerCase();
    }
    function dayStartMs(value) {
      if (!value) return null;
      const parsed = Date.parse(value + 'T00:00:00');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function dayEndMs(value) {
      if (!value) return null;
      const parsed = Date.parse(value + 'T23:59:59.999');
      return Number.isFinite(parsed) ? parsed : null;
    }
    function compareValues(a, b, direction) {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') {
        return direction === 'asc' ? a - b : b - a;
      }
      const base = String(a).localeCompare(String(b));
      return direction === 'asc' ? base : -base;
    }
    function rowMatches(row) {
      const q = (input?.value || '').trim().toLowerCase();
      const scope = scopeFilter?.value || 'real';
      const status = statusFilter?.value || '';
      const learner = learnerFilter?.value || '';
      const policy = policyFilter?.value || '';
      const world = worldFilter?.value || '';
      const fromMs = dayStartMs(dateFrom?.value || '');
      const toMs = dayEndMs(dateTo?.value || '');
      const completedMs = numberValue(row, 'completedMs');
      if (scope === 'real' && row.dataset.runKind !== 'real') return false;
      if (q && !row.dataset.search.includes(q)) return false;
      if (fromMs !== null && (completedMs === null || completedMs < fromMs)) return false;
      if (toMs !== null && (completedMs === null || completedMs > toMs)) return false;
      if (status && row.dataset.status !== status) return false;
      if (learner && row.dataset.learner !== learner) return false;
      if (world && row.dataset.world !== world) return false;
      if (policy && !String(row.dataset.policies || '').split('|').includes(policy)) return false;
      return true;
    }
    function applyIndexControls() {
      const key = sortKey?.value || 'date';
      const direction = sortDir?.value || 'desc';
      const datasetKey = sortMap[key] || 'completedMs';
      const sortedRows = rows.slice().sort((a, b) => {
        const aValue = numericSortKeys.has(key) ? numberValue(a, datasetKey) : stringValue(a, datasetKey);
        const bValue = numericSortKeys.has(key) ? numberValue(b, datasetKey) : stringValue(b, datasetKey);
        return compareValues(aValue, bValue, direction) || stringValue(a, 'reportName').localeCompare(stringValue(b, 'reportName'));
      });
      let shown = 0;
      for (const row of sortedRows) {
        const visible = rowMatches(row);
        row.hidden = !visible;
        if (visible) shown += 1;
        tbody?.appendChild(row);
      }
      if (count) count.textContent = shown + ' shown';
    }
    for (const control of [input, scopeFilter, dateFrom, dateTo, statusFilter, learnerFilter, policyFilter, worldFilter, sortKey, sortDir]) {
      control?.addEventListener(control === input ? 'input' : 'change', applyIndexControls);
    }
    reset?.addEventListener('click', () => {
      if (input) input.value = '';
      if (scopeFilter) scopeFilter.value = 'real';
      if (dateFrom) dateFrom.value = '';
      if (dateTo) dateTo.value = '';
      if (statusFilter) statusFilter.value = '';
      if (learnerFilter) learnerFilter.value = '';
      if (policyFilter) policyFilter.value = '';
      if (worldFilter) worldFilter.value = '';
      if (sortKey) sortKey.value = 'date';
      if (sortDir) sortDir.value = 'desc';
      applyIndexControls();
    });
    applyIndexControls();
  </script>
</body>
</html>
`;
}

function writeReportIndex({ rootDir = indexRootDir(), quiet = false, updateShell = true, updateAssets = true } = {}) {
  fs.mkdirSync(rootDir, { recursive: true });
  const rows = listAutoEvalSummaryFiles(rootDir)
    .map((jsonPath) => readIndexSummary(jsonPath, rootDir))
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt || a.startedAt || '') || fs.statSync(a.jsonPath).mtimeMs;
      const bTime = Date.parse(b.completedAt || b.startedAt || '') || fs.statSync(b.jsonPath).mtimeMs;
      return bTime - aTime || a.reportName.localeCompare(b.reportName);
    });
  const activeRuns = listAutoEvalRunStateFiles(rootDir)
    .map((statePath) => readIndexRunState(statePath, rootDir))
    .filter((state) => !['completed', 'dry_run'].includes(state.status))
    .sort((a, b) => b.updatedMs - a.updatedMs || a.runName.localeCompare(b.runName));
  const generatedAt = new Date().toISOString();
  if (updateAssets) writeReportIndexAssets(rootDir);
  writeJsonAtomic(path.join(rootDir, 'index-data.json'), indexDataModel({ rows, activeRuns, rootDir, generatedAt }));
  const indexPath = path.join(rootDir, 'index.html');
  const dynamicIndexPath = path.join(rootDir, 'index-dynamic.html');
  const dynamicShell = renderReportIndexShell({ rootDir, generatedAt });
  if (updateShell || !fs.existsSync(dynamicIndexPath)) {
    fs.writeFileSync(dynamicIndexPath, dynamicShell);
  }
  const existingShell = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
  const hasDynamicShell = existingShell.includes('data-index-root') && existingShell.includes('index-data.json');
  if (updateShell || !hasDynamicShell) {
    fs.writeFileSync(indexPath, dynamicShell);
  }
  if (!quiet) console.log(`[auto-eval] index ${indexPath}`);
  return indexPath;
}

function writeEvalLedger({ summary, summaryPath, htmlPath }) {
  if (args['no-ledger']) return;
  const ledgerPath = resolvePath(args.ledger);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const entry = ledgerEntryForSummary({ summary, summaryPath, htmlPath });
  const entries = readLedgerEntries(ledgerPath).filter((row) => row.report?.json !== entry.report?.json);
  entries.push(entry);
  fs.writeFileSync(ledgerPath, `${entries.map((row) => JSON.stringify(row)).join('\n')}\n`);
  const markdownPath = ledgerPath.replace(/\.jsonl$/u, '.md');
  fs.writeFileSync(markdownPath, renderLedgerMarkdown(entries));
  console.log(`[auto-eval] ledger ${ledgerPath}`);
  console.log(`[auto-eval] ledger ${markdownPath}`);
}

function writeReportFromSummary(summaryPath) {
  const resolvedSummaryPath = resolvePath(summaryPath);
  const summary = JSON.parse(fs.readFileSync(resolvedSummaryPath, 'utf8'));
  const traceDir = resolveTracePath(summary.config?.traceDir || path.dirname(resolvedSummaryPath), ROOT);
  for (const result of summary.results || []) {
    const refreshed = (result.traces || [])
      .map((tracePath) => resolveTracePath(tracePath, traceDir))
      .filter((tracePath) => tracePath && fs.existsSync(tracePath))
      .map((tracePath) => summarizeTrace(tracePath, traceDir));
    if (refreshed.length) {
      result.traceSummaries = refreshed;
    } else if (!Array.isArray(result.traceSummaries)) {
      result.traceSummaries = [];
    }
  }
  const rows = resultRows(summary.results || []);
  summary.aggregates = summarizeRows(rows);
  summary.rows = rows;
  summary.report = {
    ...(summary.report || {}),
    html: resolvedSummaryPath.replace(/\.json$/u, '.html'),
  };
  writeHtmlReport({ summary, rows, htmlPath: summary.report.html });
  writeEvalLedger({ summary, summaryPath: resolvedSummaryPath, htmlPath: summary.report.html });
}

function tutorStubArgs({ policy, runIndex, totalRuns, traceDir }) {
  const autoTurns = turnsArg();
  const registerPalette = policy === 'negative' ? 'negative' : args['register-palette'];
  const command = [
    'scripts/tutor-stub.js',
    '--auto-learner',
    '--auto-turns',
    autoTurns,
    '--auto-safety-turns',
    String(positiveInt(args['safety-turns'], '--safety-turns')),
    '--auto-learner-profile',
    resolvedAutoLearnerProfile(),
    '--tutor-learner-dag',
    '--world',
    args.world,
    '--dag-mode',
    args['dag-mode'],
    '--register-policy',
    policy,
    '--register-palette',
    registerPalette,
    '--trace-dir',
    traceDir,
    '--no-stream',
    '--no-interim-animation',
  ];
  if (args.model !== DEFAULT_CODEX_MODEL_REF) command.push('--model', args.model);
  if (args['analysis-model'] !== DEFAULT_CODEX_MODEL_REF) {
    command.push('--classifier-model', args['analysis-model']);
    command.push('--learner-record-model', args['analysis-model']);
  }
  if (args['auto-learner-model'] !== DEFAULT_CODEX_MODEL_REF) {
    command.push('--auto-learner-model', args['auto-learner-model']);
  }
  if (!args['no-dag']) command.push('--dag');
  if (args['no-stop-on-grounded']) command.push('--no-auto-stop-on-grounded');
  if (args['first-message']) command.push('--once', args['first-message']);
  if (args['cli-effort']) command.push('--cli-effort', args['cli-effort']);
  if (args['max-tokens']) command.push('--max-tokens', String(positiveInt(args['max-tokens'], '--max-tokens')));
  if (args['history-turns'])
    command.push('--history-turns', String(positiveInt(args['history-turns'], '--history-turns')));
  if (args['no-memory-summary']) command.push('--no-memory-summary');
  command.push('--learner', `Automated learner run ${runIndex}/${totalRuns} for policy ${policy}.`);
  return command;
}

function buildJobs({ policies, runs, traceDir, parallelism }) {
  const jobs = [];
  for (const policy of policies) {
    for (let runIndex = 1; runIndex <= runs; runIndex += 1) {
      const key = `${safeSlug(policy)}-r${runIndex}`;
      const childTraceDir = parallelism > 1 ? path.join(traceDir, 'traces', key) : traceDir;
      const logPath = path.join(traceDir, 'logs', `${key}.log`);
      jobs.push({
        ordinal: jobs.length + 1,
        policy,
        runIndex,
        runs,
        key,
        traceDir: childTraceDir,
        logPath,
        childArgs: tutorStubArgs({ policy, runIndex, totalRuns: runs, traceDir: childTraceDir }),
      });
    }
  }
  return jobs;
}

function buildResumePlan(summaryPath) {
  const resolvedSummaryPath = resolvePath(summaryPath);
  const source = JSON.parse(fs.readFileSync(resolvedSummaryPath, 'utf8'));
  const traceDir = resolveTracePath(source.config?.traceDir || path.dirname(resolvedSummaryPath), ROOT);
  const retryStatuses = new Set(csv(args['resume-statuses']));
  const resumeStamp = safeTimestampForFile();
  const retainedResults = [];
  const jobs = [];

  for (const result of source.results || []) {
    if (!retryStatuses.has(result.status)) {
      retainedResults.push(result);
      continue;
    }
    const command = Array.isArray(result.command) ? result.command : null;
    if (!command || command.length < 2) {
      throw new Error(
        `Cannot resume ${result.policy || 'unknown'} run ${result.runIndex || '?'}: missing saved command`,
      );
    }
    const childArgs = command[0] === 'node' ? command.slice(1) : command;
    let adjustedChildArgs = withFlagValue(
      childArgs,
      '--max-tokens',
      args['max-tokens'] ? positiveInt(args['max-tokens'], '--max-tokens') : '',
    );
    adjustedChildArgs = withFlagValue(
      adjustedChildArgs,
      '--history-turns',
      args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : '',
    );
    adjustedChildArgs = withBooleanFlag(adjustedChildArgs, '--no-memory-summary', args['no-memory-summary']);
    assertSupportedChildArgs(adjustedChildArgs);
    const childTraceDir = flagValue(adjustedChildArgs, '--trace-dir');
    if (!childTraceDir) {
      throw new Error(`Cannot resume ${result.policy || 'unknown'} run ${result.runIndex || '?'}: missing --trace-dir`);
    }
    const policy = result.policy || 'unknown';
    const runIndex = Number(result.runIndex || jobs.length + 1);
    const key = `${safeSlug(policy)}-r${runIndex}`;
    jobs.push({
      ordinal: jobs.length + 1,
      policy,
      runIndex,
      runs: source.config?.runs || result.runIndex || 1,
      key,
      traceDir: childTraceDir,
      logPath: path.join(traceDir, 'logs', `${key}-resume-${resumeStamp}.log`),
      childArgs: adjustedChildArgs,
      resumedFrom: {
        summary: path.relative(ROOT, resolvedSummaryPath),
        status: result.status,
        traces: result.traces || [],
        log: result.log || null,
      },
    });
  }

  return {
    source,
    sourcePath: resolvedSummaryPath,
    traceDir,
    retainedResults,
    jobs,
    config: {
      ...(source.config || {}),
      traceDir,
      maxTokens: args['max-tokens']
        ? positiveInt(args['max-tokens'], '--max-tokens')
        : source.config?.maxTokens || source.config?.max_tokens || null,
      historyTurns: args['history-turns']
        ? positiveInt(args['history-turns'], '--history-turns')
        : source.config?.historyTurns || null,
      memorySummary: args['no-memory-summary'] ? { enabled: false } : source.config?.memorySummary || null,
      resumedFrom: path.relative(ROOT, resolvedSummaryPath),
      resumeStatuses: Array.from(retryStatuses),
    },
  };
}

function autoEvalConfigForState({ traceDir, configOverride = null }) {
  return (
    configOverride || {
      runs: positiveInt(args.runs, '--runs'),
      turns: turnsArg(),
      untilGrounded: Boolean(args['until-grounded']),
      safetyTurns: positiveInt(args['safety-turns'], '--safety-turns'),
      parallelism: positiveInt(args.parallelism, '--parallelism'),
      policies: policyCsv(args.policies),
      model: args.model,
      analysisModel: args['analysis-model'],
      autoLearnerModel: args['auto-learner-model'],
      autoLearnerProfileId: autoLearnerProfileLabel(),
      autoLearnerProfileContract:
        autoLearnerProfileLabel() === 'custom' ? null : learnerProfileContractSummary(resolvedAutoLearnerProfileId()),
      dagMode: args['dag-mode'],
      maxTokens: args['max-tokens'] ? positiveInt(args['max-tokens'], '--max-tokens') : null,
      historyTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      memorySummary: {
        enabled: !args['no-memory-summary'],
        rawRecentTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      },
      world: args.world,
      traceDir,
      dryRun: Boolean(args['dry-run']),
    }
  );
}

function buildRunState({
  traceDir,
  startedAt,
  jobs,
  activeJobs,
  results,
  completed,
  status,
  configOverride = null,
  resume = null,
}) {
  const totalJobs = jobs.length;
  const resultByKey = new Map(
    results.map((result) => [
      result.key || `${safeSlug(result.policy || 'unknown')}-r${result.runIndex || '?'}`,
      result,
    ]),
  );
  const activeKeys = new Set(activeJobs.keys());
  const jobRows = jobs.map((job) => {
    const result = resultByKey.get(job.key);
    const active = activeKeys.has(job.key);
    const progress = active ? summarizeJobProgress(job) : result ? summarizeResultProgress(result) : null;
    return {
      ordinal: job.ordinal,
      key: job.key,
      policy: job.policy,
      runIndex: job.runIndex,
      runs: job.runs,
      status: result?.status || (active ? 'running' : 'queued'),
      turns: progress?.turns || 0,
      coverage: progress?.coverage ?? null,
      bottleneck: progress?.bottleneck || '',
      lastType: progress?.lastType || '',
      log: path.relative(ROOT, job.logPath),
      traceDir: path.relative(ROOT, job.traceDir),
    };
  });
  return {
    schema: 'machinespirits.tutor-stub.auto-eval-run-state.v1',
    pid: process.pid,
    status,
    startedAt,
    updatedAt: new Date().toISOString(),
    traceDir: path.relative(ROOT, traceDir),
    config: autoEvalConfigForState({ traceDir, configOverride }),
    resume,
    totals: {
      jobs: totalJobs,
      completed,
      active: activeJobs.size,
      queued: Math.max(0, totalJobs - completed - activeJobs.size),
      ok: results.filter((result) => result.status === 'ok').length,
      failed: results.filter((result) => result.status === 'failed').length,
      dryRun: results.filter((result) => result.status === 'dry_run').length,
      progressRate: totalJobs ? Number((completed / totalJobs).toFixed(3)) : 0,
    },
    jobs: jobRows,
  };
}

function writeRunState(state) {
  const traceDir = resolvePath(state.config?.traceDir || state.traceDir || args['trace-dir']);
  const statePath = runStatePath(traceDir);
  writeJsonAtomic(statePath, state);
  return statePath;
}

function writeRunStateSnapshot(context) {
  const state = buildRunState(context);
  const statePath = writeRunState(state);
  if (!args['no-html-report']) writeReportIndex({ quiet: true, updateShell: false, updateAssets: false });
  return statePath;
}

function runChildJob(job) {
  return new Promise((resolve) => {
    fs.mkdirSync(job.traceDir, { recursive: true });
    fs.mkdirSync(path.dirname(job.logPath), { recursive: true });
    const before = new Set(listTraceFiles(job.traceDir));
    const log = fs.createWriteStream(job.logPath, { flags: 'w' });
    log.write(`[auto-eval] ${job.policy} run ${job.runIndex}/${job.runs}\n`);
    log.write(`${displayCommand(job.childArgs)}\n\n`);
    const child = spawn(process.execPath, job.childArgs, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TUTOR_STUB_EVAL_POLICY: job.policy,
        TUTOR_STUB_EVAL_RUN_INDEX: String(job.runIndex),
      },
    });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', (error) => {
      log.write(`\n[auto-eval] spawn error: ${error.message}\n`);
    });
    child.on('close', (status, signal) => {
      const after = listTraceFiles(job.traceDir);
      const newTraces = after.filter((file) => !before.has(file));
      const traceSummaries = newTraces.map((tracePath) => summarizeTrace(tracePath, job.traceDir));
      const result = {
        key: job.key,
        policy: job.policy,
        runIndex: job.runIndex,
        status: status === 0 ? 'ok' : 'failed',
        exitCode: status,
        signal: signal || null,
        traces: newTraces,
        traceSummaries,
        log: path.relative(ROOT, job.logPath),
        command: ['node', ...job.childArgs],
      };
      log.write(`\n[auto-eval] exit status=${status} signal=${signal || ''}\n`);
      log.end(() => resolve(result));
    });
  });
}

async function runJobs({ jobs, parallelism, traceDir, startedAt, configOverride = null, resume = null }) {
  const results = [];
  const activeJobs = new Map();
  let cursor = 0;
  let completed = 0;
  let aborted = false;
  const totalJobs = jobs.length;
  const stateContext = (status = aborted ? 'aborted' : 'running') => ({
    traceDir,
    startedAt,
    jobs,
    activeJobs,
    results,
    completed,
    status,
    configOverride,
    resume,
  });
  const progressIntervalSec = positiveInt(args['progress-interval'], '--progress-interval');
  const progressTimer = args['dry-run']
    ? null
    : setInterval(() => {
        printTurnProgress({ completed, total: totalJobs, activeJobs, results });
        writeRunStateSnapshot(stateContext());
      }, progressIntervalSec * 1000);
  writeRunStateSnapshot(stateContext(args['dry-run'] ? 'dry_run' : 'running'));

  async function worker() {
    while (!aborted && cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      activeJobs.set(job.key, job);
      writeRunStateSnapshot(stateContext());
      console.log(`\n[auto-eval] policy=${job.policy} run=${job.runIndex}/${job.runs}`);
      printProgress({
        completed,
        total: totalJobs,
        label: `running ${job.ordinal}/${totalJobs}: ${job.policy} ${job.runIndex}/${job.runs}; log ${path.relative(ROOT, job.logPath)}`,
      });
      console.log(displayCommand(job.childArgs));
      const result = args['dry-run']
        ? {
            key: job.key,
            policy: job.policy,
            runIndex: job.runIndex,
            status: 'dry_run',
            traces: [],
            traceSummaries: [],
            log: path.relative(ROOT, job.logPath),
            command: ['node', ...job.childArgs],
          }
        : await runChildJob(job);
      activeJobs.delete(job.key);
      results.push(result);
      completed += 1;
      writeRunStateSnapshot(stateContext());
      const primary = result.traceSummaries?.at(-1);
      const outcome = primary
        ? `${result.status}; turns ${primary.turnCount}; coverage ${primary.bestPathCoverage}; stop ${primary.stopReason || 'none'}`
        : result.status;
      printProgress({
        completed,
        total: totalJobs,
        label: `finished ${job.policy} ${job.runIndex}/${job.runs}: ${outcome}`,
      });
      if (result.status === 'failed' && !args['keep-going']) aborted = true;
    }
  }

  const workers = Array.from({ length: Math.min(parallelism, jobs.length) }, () => worker());
  try {
    await Promise.all(workers);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    writeRunStateSnapshot(stateContext(aborted ? 'aborted' : args['dry-run'] ? 'dry_run' : 'completed'));
  }
  return {
    results: results.sort((a, b) => {
      const policyOrder = jobs.findIndex((job) => job.policy === a.policy && job.runIndex === a.runIndex);
      const otherOrder = jobs.findIndex((job) => job.policy === b.policy && job.runIndex === b.runIndex);
      return policyOrder - otherOrder;
    }),
    aborted,
  };
}

async function main() {
  if (args.help) {
    printHelp();
    return;
  }
  if (args['list-learner-profiles']) {
    printLearnerProfiles();
    return;
  }
  if (args.index) {
    writeReportIndex();
    return;
  }
  if (args['report-from']) {
    writeReportFromSummary(args['report-from']);
    return;
  }
  if (args['resume-from']) {
    const plan = buildResumePlan(args['resume-from']);
    const parallelism = positiveInt(args.parallelism, '--parallelism');
    if (!plan.jobs.length) {
      console.log(
        `[auto-eval] no rows with status ${args['resume-statuses']} found in ${path.relative(ROOT, plan.sourcePath)}`,
      );
      writeSummary({
        traceDir: plan.traceDir,
        startedAt: new Date().toISOString(),
        results: plan.retainedResults,
        failed: false,
        configOverride: plan.config,
        resume: { sourcePath: plan.sourcePath, retried: 0, statuses: csv(args['resume-statuses']) },
      });
      return;
    }
    const startedAt = new Date().toISOString();
    printProgress({
      completed: 0,
      total: plan.jobs.length,
      label: `resuming ${plan.jobs.length} rows from ${path.relative(ROOT, plan.sourcePath)}; parallelism ${parallelism}`,
    });
    const resumeState = {
      sourcePath: path.relative(ROOT, plan.sourcePath),
      retried: plan.jobs.length,
      statuses: csv(args['resume-statuses']),
    };
    const { results: retriedResults, aborted } = await runJobs({
      jobs: plan.jobs,
      parallelism,
      traceDir: plan.traceDir,
      startedAt,
      configOverride: plan.config,
      resume: resumeState,
    });
    writeSummary({
      traceDir: plan.traceDir,
      startedAt,
      results: [...plan.retainedResults, ...retriedResults],
      failed: aborted,
      configOverride: plan.config,
      resume: {
        sourcePath: plan.sourcePath,
        retried: retriedResults.length,
        statuses: csv(args['resume-statuses']),
      },
    });
    if (aborted) process.exit(1);
    return;
  }

  const runs = positiveInt(args.runs, '--runs');
  const parallelism = positiveInt(args.parallelism, '--parallelism');
  assertSupportedModelRefs({
    '--model': args.model,
    '--analysis-model': args['analysis-model'],
    '--auto-learner-model': args['auto-learner-model'],
  });
  if (args['until-grounded'] && args['no-stop-on-grounded']) {
    throw new Error('--until-grounded cannot be combined with --no-stop-on-grounded');
  }
  const policies = policyCsv(args.policies);
  if (!policies.length) throw new Error('--policies must include at least one policy');
  const traceDir = resolvePath(args['trace-dir']);
  fs.mkdirSync(traceDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const jobs = buildJobs({ policies, runs, traceDir, parallelism });
  printProgress({ completed: 0, total: jobs.length, label: `starting; parallelism ${parallelism}` });
  const { results, aborted } = await runJobs({ jobs, parallelism, traceDir, startedAt });
  writeSummary({ traceDir, startedAt, results, failed: aborted });
  if (aborted) process.exit(1);
}

function writeSummary({ traceDir, startedAt, results, failed, configOverride = null, resume = null }) {
  fs.mkdirSync(traceDir, { recursive: true });
  const summary = {
    schema: 'machinespirits.tutor-stub.auto-eval.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    failed,
    config: autoEvalConfigForState({ traceDir, configOverride }),
    results,
  };
  if (resume) {
    summary.resume = {
      ...resume,
      sourcePath: resume.sourcePath ? path.relative(ROOT, resume.sourcePath) : null,
    };
  }
  const rows = resultRows(results);
  summary.aggregates = summarizeRows(rows);
  summary.rows = rows;
  const timestamp = safeTimestampForFile();
  const summaryPath = path.join(traceDir, `auto-eval-${timestamp}.json`);
  const htmlPath = path.join(traceDir, `auto-eval-${timestamp}.html`);
  summary.report = {
    json: summaryPath,
    html: args['no-html-report'] ? null : htmlPath,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\n[auto-eval] wrote ${summaryPath}`);
  if (!args['no-html-report']) {
    writeHtmlReport({ summary, rows, htmlPath });
  }
  writeEvalLedger({ summary, summaryPath, htmlPath: args['no-html-report'] ? null : htmlPath });
  if (args['no-html-report']) {
    writeReportIndex();
  }
}

try {
  await main();
} catch (error) {
  console.error(`[auto-eval] error: ${error.message}`);
  process.exit(1);
}
