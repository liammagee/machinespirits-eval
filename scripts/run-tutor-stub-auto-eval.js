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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UNSUPPORTED_CODEX_MINI_REFS = new Set(['codex.mini', 'codex.gpt-mini', 'codex.gpt-5-mini']);
const AUTO_LEARNER_PROFILES = {
  diligent:
    'A curious but fallible learner. They follow the tutor, sometimes ask for evidence, and sometimes make short partial claims.',
  answer_seeking:
    'A completion-oriented learner. They want the exact trial-book line, often ask what to write next, and may mistake copied wording for understanding.',
  skeptical:
    'A skeptical learner. They challenge the tutor framing, ask why a warrant counts, and resist committing until public evidence is explicit.',
  overconfident:
    'An overconfident learner. They jump to culprit or story conclusions from weak clues and need to be pulled back to public evidence.',
  low_agency:
    'A hesitant low-agency learner. They ask permission, avoid committing to claims, and prefer the tutor to choose unless explicitly prompted.',
  memory_limited:
    'A memory-limited learner. They mainly track the last few public clues, lose earlier evidence, and need re-grounding before inference.',
};

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '1' },
    turns: { type: 'string', default: 'until-grounded' },
    policies: { type: 'string', default: 'negative,dynamic,random' },
    model: { type: 'string', default: process.env.TUTOR_STUB_EVAL_MODEL || 'openai.mini' },
    'analysis-model': { type: 'string', default: process.env.TUTOR_STUB_EVAL_ANALYSIS_MODEL || 'codex.gpt-5.5' },
    'auto-learner-model': {
      type: 'string',
      default: process.env.TUTOR_STUB_EVAL_AUTO_LEARNER_MODEL || process.env.TUTOR_STUB_AUTO_LEARNER_MODEL || 'openai.mini',
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
                              known: dynamic,state,field,trajectory,dynamical_system,empirical_dynamical_system,bland,random,negative
  --model <ref>              tutor model (default: openai.mini)
  --analysis-model <ref>     classifier + learner-DAG model (default: codex.gpt-5.5)
  --auto-learner-model <ref> automated learner model (default: openai.mini)
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
  return String(value || '').trim().toLowerCase().replace(/-/gu, '_');
}

function policyCsv(value) {
  return csv(value).map(normalizePolicyName).filter(Boolean);
}

function assertSupportedModelRefs(refs) {
  for (const [label, ref] of Object.entries(refs)) {
    const normalized = String(ref || '').trim().toLowerCase();
    if (UNSUPPORTED_CODEX_MINI_REFS.has(normalized)) {
      throw new Error(
        `${label}=${ref} is not supported by the local Codex CLI ChatGPT-account route. ` +
          'Use codex.gpt-5.5 for CLI-backed Codex, or openai.mini/openrouter.gpt-mini for GPT mini.',
      );
    }
  }
}

function normalizeLearnerProfileId(value) {
  return String(value || 'diligent').trim().toLowerCase().replace(/-/gu, '_');
}

function resolvedAutoLearnerProfileId() {
  const id = normalizeLearnerProfileId(args['auto-learner-profile-id']);
  if (!AUTO_LEARNER_PROFILES[id]) {
    throw new Error(
      `Unknown --auto-learner-profile-id: ${args['auto-learner-profile-id']}. ` +
        `Known: ${Object.keys(AUTO_LEARNER_PROFILES).join(', ')}`,
    );
  }
  return id;
}

function resolvedAutoLearnerProfile() {
  const custom = String(args['auto-learner-profile'] || '').trim();
  if (custom) return custom;
  return AUTO_LEARNER_PROFILES[resolvedAutoLearnerProfileId()];
}

function autoLearnerProfileLabel() {
  return String(args['auto-learner-profile'] || '').trim() ? 'custom' : resolvedAutoLearnerProfileId();
}

function printLearnerProfiles() {
  for (const [id, profile] of Object.entries(AUTO_LEARNER_PROFILES)) {
    console.log(`${id}: ${profile}`);
  }
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

function formatSignedField(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'n/a';
  return `${numeric >= 0 ? '+' : ''}${numeric}`;
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
  const overreach =
    /overconfident|answer_seeking|overleaps_evidence|unsupported|resistant/iu.test(
      [
        turnAnalysis.epistemic_stance,
        turnAnalysis.evidence_use,
        assessment.bottleneck,
        priorEfficacy?.label,
      ]
        .filter(Boolean)
        .join(' '),
    )
      ? 0.25
      : 0;
  const responseWords = wordsInText(turn?.tutor);
  const brevity = clampField01(1 - Math.max(0, responseWords - 95) / 130);
  const registerConfidence = Number.isFinite(Number(register.confidence)) ? clampField01(Number(register.confidence)) : 0.5;
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
        0.12 * (turn?.tutorDag?.leavesReleased || 0) / Math.max(1, turn?.tutorDag?.leavesTotal || 1),
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
  const text = String(value || '').replace(/\s+/gu, ' ').trim();
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
      rows: distribution.sort((a, b) => Number(b.probability || 0) - Number(a.probability || 0) || a.register.localeCompare(b.register)),
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
  const missingNeed = clampField01(Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0) / 8);
  const unsupportedNeed = clampField01(Number(assessment.unsupportedAssertionCount || 0) / 3);
  const conceptual = normalizedField01(fieldRow.conceptual, 0.5);
  const readiness = normalizedField01(fieldRow.readiness, 0.5);
  const risk = normalizedField01(fieldRow.learnerRisk, 0);
  const alignment = normalizedField01(fieldRow.tutorAlignment, 0.5);
  const momentum = normalizedField01(fieldRow.jointMomentum, 0);
  const selectedProbability = numberOrNull(selection?.selected_probability);
  const negativeValence = selection?.valence === 'negative' || ['ironic', 'sarcastic', 'face_threat'].includes(selection?.selected_register);
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
    coercion_risk: roundField(clampField01((negativeValence ? 0.35 : 0) + (flags.coerciveProgress ? 0.35 : 0) + risk * 0.2)),
    integration_need: roundField(clampField01(1 - conceptual + (assessment.bottleneck === 'learner_integration_gap' ? 0.25 : 0))),
    compression_need: roundField(clampField01((1 - conceptual) * 0.45 + (1 - readiness) * 0.25 + missingNeed * 0.3)),
    momentum: roundField(momentum),
    stagnation: roundField(clampField01((flags.plateau ? 0.55 : 0) + (Number(fieldRow.speed || 0) < 0.035 ? 0.18 : 0))),
    disruption_need: roundField(clampField01((flags.plateau ? 0.5 : 0) + (flags.fieldRegression ? 0.25 : 0) + (1 - readiness) * 0.2)),
    tempo_affordance: roundField(clampField01(momentum * (1 - risk) + (selection?.request_type === 'transfer_demand_or_named_material' ? 0.12 : 0))),
    closure_pressure: roundField(clampField01(coverage * 0.65 + (assessment.finalSecretEntailed ? 0.25 : 0) + (assessment.assertedSecret ? 0.2 : 0))),
    field_regression: roundField(clampField01((flags.fieldRegression ? 0.65 : 0) + Math.max(0, -(Number(trajectory?.field?.velocity || 0))) * 3)),
    empirical_uncertainty: roundField(selectedProbability === null ? 0.8 : clampField01(1 - selectedProbability)),
  };
}

function frameEvents({ turn, fieldRow, trajectory, selection }) {
  const events = new Set();
  if (fieldRow.bottleneck) events.add(fieldRow.bottleneck);
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
    selection?.state_policy?.features || selection?.field_policy?.features || selection?.trajectory_policy?.features || selection?.dynamical_system_policy?.features;
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
      missingPremiseCount: Number(metrics.missingPremiseCount ?? assessment.missingPremiseCount ?? fieldRow.missingCount ?? 0),
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
  const policyTrajectory = selection.dynamical_system_policy?.trajectory || selection.trajectory_policy?.trajectory || null;
  const trajectory = compactTrajectory(policyTrajectory, fallbackTrajectory);
  const stateVector = selection.dynamical_system_policy?.state_vector || approximateDynamicalStateVector({ turn, fieldRow, trajectory, selection });
  const derivativeVector =
    selection.dynamical_system_policy?.derivative_vector || {
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
      const label = escapeXml(`${row.turn}: ${row.learnerMove} / ${row.register || 'no-register'} / ${row.bottleneck}`);
      return `<circle cx="${x.toFixed(1)}" cy="${(padding.top + height + 18).toFixed(
        1,
      )}" r="2.8" fill="#475569"><title>${label}</title></circle>`;
    })
    .join('\n');
}

function renderLightweightFieldSvg(field, { title = 'Tutor Stub Interaction Field' } = {}) {
  const rows = field?.rows || [];
  const padding = { top: 64, right: 34, bottom: 68, left: 58 };
  const chartWidth = 660;
  const chartHeight = 220;
  const svgWidth = chartWidth + padding.left + padding.right;
  const svgHeight = chartHeight + padding.top + padding.bottom;
  const final = field?.summary?.final || {};
  const delta = field?.summary?.fieldDelta || {};
  const series = [
    ['learnerMastery', 'mastery', '#2563eb'],
    ['learnerRisk', 'risk', '#dc2626'],
    ['tutorAlignment', 'alignment', '#059669'],
    ['jointMomentum', 'momentum', '#7c3aed'],
  ];
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((value) => {
      const y = padding.top + (1 - value) * chartHeight;
      return [
        `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(padding.left + chartWidth).toFixed(
          1,
        )}" y2="${y.toFixed(1)}" stroke="#e2e8f0" />`,
        `<text x="${padding.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#64748b">${value.toFixed(
          2,
        )}</text>`,
      ].join('\n');
    })
    .join('\n');
  const lines = series
    .map(
      ([key, label, color]) =>
        `<polyline points="${fieldPolyline(rows, key, {
          width: chartWidth,
          height: chartHeight,
          padding,
        })}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><title>${label}</title></polyline>`,
    )
    .join('\n');
  const legend = series
    .map(
      ([key, label, color], index) =>
        `<g transform="translate(${padding.left + index * 135}, ${svgHeight - 24})"><rect width="11" height="11" rx="2" fill="${color}" /><text x="16" y="10" font-size="11" fill="#334155">${label}: ${escapeXml(
          final[key] ?? 'n/a',
        )}</text></g>`,
    )
    .join('\n');
  const deltaText = `delta M ${formatSignedField(delta.learnerMastery)} | R ${formatSignedField(
    delta.learnerRisk,
  )} | A ${formatSignedField(delta.tutorAlignment)} | P ${formatSignedField(delta.jointMomentum)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img">
  <title>${escapeXml(title)}</title>
  <desc>Lightweight tutor-stub field visualization across ${rows.length} completed turn(s).</desc>
  <rect width="100%" height="100%" fill="#f8fafc" />
  <text x="${padding.left}" y="26" font-size="18" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  <text x="${padding.left}" y="47" font-size="12" fill="#475569">turns ${field.turnCount}; mean speed ${escapeXml(
    field.summary?.meanSpeed ?? 'n/a',
  )}; ${escapeXml(deltaText)}; bottleneck ${escapeXml(final.bottleneck || 'unknown')}</text>
  <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="#ffffff" stroke="#cbd5e1" />
  ${gridLines}
  ${lines}
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
  const turnCap = turnsArg() === 'until-grounded'
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
      const bottleneck = summary.bottleneck ? ` ${summary.bottleneck}` : '';
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
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseJsonLine)
    .filter(Boolean);
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

function summarizeTrace(tracePath, traceDir) {
  const events = readTraceEvents(tracePath);
  const turns = events.filter((event) => event.type === 'turn_complete');
  const turnRecords = turns.map((event) => event.turnRecord).filter(Boolean);
  const runEnds = events.filter((event) => event.type === 'run_end' || event.type === 'auto_learner_run_end');
  const fieldWrite = events.filter((event) => event.type === 'field_visualization_write').at(-1) || null;
  const fieldViz = buildLightweightDialogueField(turnRecords);
  const animatedViz = buildAnimatedRunVisualization(turnRecords, fieldViz);
  const lastTurn = turns.at(-1)?.turnRecord || {};
  const assessment = lastTurn.tutorLearnerDagModel?.assessment || {};
  const metrics = lastTurn.tutorLearnerDagModel?.metrics || {};
  const registers = turns
    .map((event) => event.turnRecord?.registerSelection?.selected_register)
    .filter(Boolean);
  const efficacies = turns
    .map((event) => event.turnRecord?.previousRegisterEfficacy?.label)
    .filter(Boolean);
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
    Object.entries(row.registerCounts || {}).flatMap(([register, count]) => Array.from({ length: count }, () => register)),
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
      Object.entries(row.registerCounts || {}).flatMap(([register, count]) => Array.from({ length: count }, () => register)),
    );
    return {
      rows: bucketRows.length,
      ok: okRows.length,
      failed: liveRows.filter((row) => row.status === 'failed').length,
      dryRun: bucketRows.filter((row) => row.status === 'dry_run').length,
      grounded: okRows.filter((row) => row.groundedClosure).length,
      groundedRate: okRows.length ? Number((okRows.filter((row) => row.groundedClosure).length / okRows.length).toFixed(3)) : 0,
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
    groundedRate: scored.length ? Number((scored.filter((row) => row.groundedClosure).length / scored.length).toFixed(3)) : 0,
    meanTurns: mean(scored.map((row) => row.turnCount)),
    meanCoverage: mean(scored.map((row) => row.bestPathCoverage)),
    meanMissing: mean(scored.map((row) => row.missingPremiseCount)),
    registerCounts: countBy(scoredRegisters),
    registerEntropy: entropy(scoredRegisters),
    leakCount: scored.reduce((sum, row) => sum + Number(row.leakCount || 0), 0),
    errorCount: scored.reduce((sum, row) => sum + Number(row.errorCount || 0), 0),
    byPolicy: Object.fromEntries(Object.entries(byPolicy).map(([policy, bucketRows]) => [policy, summarizeBucket(bucketRows)])),
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
  return [
    `final M ${formatFieldValue(final.learnerMastery)}`,
    `R ${formatFieldValue(final.learnerRisk)}`,
    `A ${formatFieldValue(final.tutorAlignment)}`,
    `P ${formatFieldValue(final.jointMomentum)}`,
    `delta M ${formatSignedField(delta.learnerMastery)}`,
    `R ${formatSignedField(delta.learnerRisk)}`,
  ].join(' · ');
}

function fieldRowTitle(row) {
  return `${row.policy} run ${row.runIndex}`;
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

function animatedVizRowId(row, index) {
  const traceStem = row.trace ? path.basename(row.trace, path.extname(row.trace)) : '';
  return [
    'viz',
    String(index + 1).padStart(2, '0'),
    safeSlug(row.policy || 'policy'),
    `r${safeSlug(row.runIndex || 'x')}`,
    safeSlug(traceStem).slice(0, 36),
  ]
    .filter(Boolean)
    .join('-');
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

function renderAnimatedVizSection(rows) {
  const payload = animatedVizReportPayload(rows);
  if (!payload.rows.length) {
    return '<p class="sub">No turn-by-turn visualization frames were found in these traces.</p>';
  }
  return `<div class="viz-player" id="tutor-stub-viz-player">
    <div class="viz-toolbar">
      <label class="viz-select-label"><span>Run</span><select data-viz-run></select></label>
      <div class="viz-mode-buttons" role="tablist" aria-label="Visualization mode">
        <button type="button" data-viz-mode="state">State</button>
        <button type="button" data-viz-mode="field" class="active">Field</button>
        <button type="button" data-viz-mode="trajectory">Trajectory</button>
        <button type="button" data-viz-mode="dynamics">Dynamics</button>
        <button type="button" data-viz-mode="registers">Registers</button>
      </div>
      <div class="viz-step-buttons">
        <button type="button" data-viz-prev>Prev</button>
        <button type="button" data-viz-play>Play</button>
        <button type="button" data-viz-next>Next</button>
      </div>
      <label class="viz-range-label"><span>Turn</span><input type="range" min="0" value="0" step="1" data-viz-range></label>
    </div>
    <div class="viz-canvas-wrap"><canvas data-viz-canvas></canvas></div>
    <pre class="viz-readout" data-viz-readout></pre>
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
    var playButton = root.querySelector('[data-viz-play]');
    var modeButtons = Array.prototype.slice.call(root.querySelectorAll('[data-viz-mode]'));
    var activeRow = rows[0];
    var activeIndex = 0;
    var mode = 'field';
    var timer = null;
    var palette = {
      learnerMastery: '#2563eb',
      learnerRisk: '#dc2626',
      tutorAlignment: '#059669',
      jointMomentum: '#7c3aed',
      field: '#2563eb',
      dag: '#059669',
      risk: '#dc2626'
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

    function currentFrames() {
      return (activeRow.viz && activeRow.viz.frames) || [];
    }

    function currentFrame() {
      var frames = currentFrames();
      return frames[Math.max(0, Math.min(activeIndex, frames.length - 1))] || null;
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    function text(value, x, y, options) {
      var opts = options || {};
      ctx.fillStyle = opts.color || '#17201b';
      ctx.font = (opts.weight ? opts.weight + ' ' : '') + (opts.size || 12) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = opts.align || 'left';
      ctx.textBaseline = opts.baseline || 'alphabetic';
      ctx.fillText(String(value), x, y);
    }

    function rectBar(label, value, x, y, width, color) {
      var bounded = clamp01(value);
      ctx.fillStyle = '#e7ece8';
      ctx.fillRect(x, y, width, 12);
      ctx.fillStyle = color || '#2f6f63';
      ctx.fillRect(x, y, width * bounded, 12);
      text(label, x, y - 4, { color: '#34433c', size: 11 });
      text(format(value), x + width + 8, y + 10, { color: '#66736c', size: 11 });
    }

    function drawPlot(series, options) {
      var opts = options || {};
      var frames = currentFrames();
      var x = opts.x || 44;
      var y = opts.y || 58;
      var width = opts.width || 640;
      var height = opts.height || 240;
      var count = Math.max(1, frames.length - 1);
      ctx.strokeStyle = '#d9e0dc';
      ctx.lineWidth = 1;
      for (var grid = 0; grid <= 4; grid += 1) {
        var gy = y + height - (grid / 4) * height;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x + width, gy);
        ctx.stroke();
        text((grid / 4).toFixed(2), x - 8, gy + 4, { color: '#66736c', size: 10, align: 'right' });
      }
      ctx.strokeStyle = '#b9c6bf';
      ctx.strokeRect(x, y, width, height);
      series.forEach(function (item, seriesIndex) {
        ctx.beginPath();
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 3;
        for (var index = 0; index <= activeIndex && index < frames.length; index += 1) {
          var value = clamp01(item.value(frames[index]));
          var px = x + (index / count) * width;
          var py = y + height - value * height;
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        text(item.label, x + seriesIndex * 132, y + height + 28, { color: item.color, size: 12, weight: '700' });
      });
      var cursorX = x + (Math.max(0, Math.min(activeIndex, count)) / count) * width;
      ctx.strokeStyle = '#17201b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cursorX, y);
      ctx.lineTo(cursorX, y + height);
      ctx.stroke();
    }

    function drawState(frame, width, height) {
      text('Learner/DAG State', 28, 34, { size: 18, weight: '700' });
      var scores = (frame.state.classifier && frame.state.classifier.scores) || {};
      rectBar('conceptual', scores.conceptual, 38, 82, width * 0.36, '#2563eb');
      rectBar('readiness', scores.epistemicReadiness, 38, 126, width * 0.36, '#059669');
      rectBar('surface', scores.learnerSurface, 38, 170, width * 0.36, '#7c3aed');
      rectBar('coverage', frame.state.dag.bestPathCoverage, 38, 214, width * 0.36, '#2f6f63');
      var rightX = width * 0.52;
      text('DAG', rightX, 82, { size: 13, weight: '700' });
      text('bottleneck: ' + (frame.state.dag.bottleneck || 'unknown'), rightX, 112, { color: '#34433c' });
      text('grounded: ' + frame.state.dag.groundedCount + '   missing: ' + frame.state.dag.missingPremiseCount, rightX, 140, { color: '#34433c' });
      text('unsupported: ' + frame.state.dag.unsupportedAssertionCount, rightX, 168, { color: '#34433c' });
      text('request: ' + ((frame.state.classifier && frame.state.classifier.requestType) || 'unknown'), rightX, 214, { color: '#34433c' });
      text('move: ' + ((frame.state.classifier && frame.state.classifier.discourseMove) || 'unknown'), rightX, 242, { color: '#34433c' });
    }

    function drawField(frame, width, height) {
      text('Field Trajectory', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'mastery', color: palette.learnerMastery, value: function (row) { return row.field.learnerMastery; } },
        { label: 'risk', color: palette.learnerRisk, value: function (row) { return row.field.learnerRisk; } },
        { label: 'alignment', color: palette.tutorAlignment, value: function (row) { return row.field.tutorAlignment; } },
        { label: 'momentum', color: palette.jointMomentum, value: function (row) { return row.field.jointMomentum; } }
      ], { x: 54, y: 64, width: width - 108, height: height - 142 });
    }

    function drawTrajectory(frame, width, height) {
      text('Trajectory Derivatives', 28, 34, { size: 18, weight: '700' });
      drawPlot([
        { label: 'field', color: palette.field, value: function (row) { return row.trajectory.field.current; } },
        { label: 'dag', color: palette.dag, value: function (row) { return row.trajectory.dag.current; } },
        { label: 'risk', color: palette.risk, value: function (row) { return row.trajectory.risk.current; } }
      ], { x: 54, y: 64, width: width * 0.58, height: height - 142 });
      var x = width * 0.7;
      var y = 82;
      text('velocity / slope / acceleration', x, y - 24, { color: '#34433c', size: 12, weight: '700' });
      ['field', 'dag', 'risk'].forEach(function (key, index) {
        var metric = frame.trajectory[key] || {};
        var yy = y + index * 76;
        text(key, x, yy, { color: palette[key], size: 13, weight: '700' });
        text('v ' + format(metric.velocity), x, yy + 24, { color: '#34433c' });
        text('s ' + format(metric.slope), x + 86, yy + 24, { color: '#34433c' });
        text('a ' + format(metric.acceleration), x + 172, yy + 24, { color: '#34433c' });
      });
    }

    function drawHeatmap(object, x, y, width, cellHeight) {
      var entries = Object.entries(object || {});
      if (!entries.length) {
        text('no vector data', x, y + 18, { color: '#66736c' });
        return;
      }
      entries.forEach(function (entry, index) {
        var key = entry[0];
        var value = clamp01(entry[1]);
        var yy = y + index * cellHeight;
        var intensity = Math.round(245 - value * 115);
        ctx.fillStyle = 'rgb(' + intensity + ',' + Math.round(250 - value * 70) + ',' + Math.round(246 - value * 110) + ')';
        ctx.fillRect(x, yy, width, cellHeight - 3);
        text(key, x + 8, yy + cellHeight - 10, { color: '#17201b', size: 11 });
        text(format(value), x + width - 8, yy + cellHeight - 10, { color: '#17201b', size: 11, align: 'right' });
      });
    }

    function drawDynamics(frame, width, height) {
      text('Dynamical System', 28, 34, { size: 18, weight: '700' });
      text('source: ' + (frame.dynamics.source || 'unknown'), 28, 56, { color: '#66736c', size: 12 });
      drawHeatmap(frame.dynamics.stateVector || {}, 34, 82, width * 0.46, 22);
      var rightX = width * 0.56;
      text('attractors / derivatives', rightX, 82, { size: 13, weight: '700' });
      var bars = Object.keys(frame.dynamics.attractors || {}).length ? frame.dynamics.attractors : frame.dynamics.derivativeVector;
      Object.entries(bars || {}).slice(0, 12).forEach(function (entry, index) {
        rectBar(entry[0], Math.abs(finite(entry[1], 0)), rightX, 116 + index * 24, width * 0.28, '#2f6f63');
      });
    }

    function drawRegisters(frame, width, height) {
      text('Register Distribution', 28, 34, { size: 18, weight: '700' });
      var rows = frame.register.distribution || [];
      if (!rows.length) {
        text('no register distribution', 34, 86, { color: '#66736c' });
        return;
      }
      var x = 44;
      var y = 76;
      var barWidth = width - 280;
      rows.slice(0, 12).forEach(function (entry, index) {
        var yy = y + index * 28;
        var selected = entry.register === frame.selectedRegister;
        rectBar(entry.register + (selected ? ' *' : ''), entry.probability, x, yy, barWidth, selected ? '#7c3aed' : '#2f6f63');
      });
      text('selected: ' + (frame.selectedRegister || 'none'), width - 210, 92, { color: '#34433c', size: 13, weight: '700' });
      text('source: ' + frame.register.distributionSource, width - 210, 122, { color: '#66736c' });
    }

    function updateReadout(frame) {
      if (!readout || !frame) return;
      readout.textContent = [
        activeRow.title + ' | turn ' + frame.turn + '/' + activeRow.viz.turnCount + ' | ' + mode,
        'register: ' + (frame.selectedRegister || 'none') + ' | bottleneck: ' + (frame.field.bottleneck || 'unknown') + ' | events: ' + (frame.events || []).join(', '),
        'learner: ' + ((frame.snippets && frame.snippets.learner) || ''),
        'tutor: ' + ((frame.snippets && frame.snippets.tutor) || '')
      ].join('\\n');
    }

    function draw() {
      var width = canvas.clientWidth || 960;
      var height = canvas.clientHeight || 420;
      var frame = currentFrame();
      clear(width, height);
      if (!frame) return;
      if (mode === 'state') drawState(frame, width, height);
      else if (mode === 'trajectory') drawTrajectory(frame, width, height);
      else if (mode === 'dynamics') drawDynamics(frame, width, height);
      else if (mode === 'registers') drawRegisters(frame, width, height);
      else drawField(frame, width, height);
      text('turn ' + frame.turn, width - 28, 34, { align: 'right', color: '#66736c', size: 12, weight: '700' });
      updateReadout(frame);
    }

    function syncControls() {
      var frames = currentFrames();
      range.max = String(Math.max(0, frames.length - 1));
      range.value = String(activeIndex);
      modeButtons.forEach(function (button) {
        button.classList.toggle('active', button.getAttribute('data-viz-mode') === mode);
      });
      if (playButton) playButton.textContent = timer ? 'Pause' : 'Play';
    }

    function setIndex(value) {
      var frames = currentFrames();
      activeIndex = Math.max(0, Math.min(Number(value) || 0, Math.max(0, frames.length - 1)));
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
      option.textContent = row.title + ' (' + row.turnCount + 't, ' + row.status + ')';
      select.appendChild(option);
    });
    select.addEventListener('change', function () {
      stop();
      activeRow = rows[Number(select.value) || 0] || rows[0];
      setIndex(0);
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
        var frames = currentFrames();
        if (activeIndex >= frames.length - 1) {
          stop();
          return;
        }
        setIndex(activeIndex + 1);
      }, 850);
      syncControls();
    });
    modeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        mode = button.getAttribute('data-viz-mode') || 'field';
        syncControls();
        draw();
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
                row.stopReason || 'no stop reason',
              )}</div>
            </div>
            <div class="field-actions">
              ${row.fieldSvg?.href ? `<a class="field-link" href="${escapeHtml(row.fieldSvg.href)}">svg</a>` : ''}
              <div class="field-badge">${row.groundedClosure ? 'grounded' : escapeHtml(final.bottleneck || row.bottleneck || 'open')}</div>
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
  const guideHref = hrefRelative(reportDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const policyRows = Object.entries(summary.aggregates.byPolicy)
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
        <td>${bucket.meanFieldRiskDelta}</td>
        <td>${escapeHtml(formatCounts(bucket.registerCounts))}</td>
        <td>${bucket.registerEntropy}</td>
      </tr>`,
    )
    .join('\n');
  const runRows = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.policy)}</td>
        <td>${escapeHtml(row.runIndex)}</td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${row.groundedClosure ? 'yes' : 'no'}</td>
        <td>${escapeHtml(row.stopReason || '')}</td>
        <td>${escapeHtml(row.turnCount)}</td>
        <td>${row.bestPathCoverage} ${pctBar(row.bestPathCoverage)}</td>
        <td>${escapeHtml(row.missingPremiseCount ?? '')}</td>
        <td>${escapeHtml(row.bottleneck)}</td>
        <td>${escapeHtml(
          row.field?.delta
            ? `M ${formatSignedField(row.field.delta.learnerMastery)} / R ${formatSignedField(row.field.delta.learnerRisk)}`
            : '',
        )}</td>
        <td>${escapeHtml(formatCounts(row.registerCounts, { limit: 4 }))}</td>
        <td>${escapeHtml(formatCounts(row.efficacyCounts, { limit: 4 }))}</td>
        <td>${escapeHtml(row.leakCount)}</td>
        <td>${row.trace ? `<a href="${escapeHtml(path.relative(summary.config.traceDir || '.', path.join(ROOT, row.trace)))}">trace</a>` : ''}</td>
        <td>${row.log ? `<a href="${escapeHtml(path.relative(summary.config.traceDir || '.', path.join(ROOT, row.log)))}">log</a>` : ''}</td>
      </tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tutor Stub Auto-Eval Report</title>
  <style>
    :root { color-scheme: light; --ink:#17201b; --muted:#66736c; --line:#d9e0dc; --paper:#fbfcfb; --panel:#ffffff; --accent:#2f6f63; --warn:#9c5a12; --bad:#9a2f36; }
    body { margin:0; font:14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
    header { padding:28px 32px 18px; border-bottom:1px solid var(--line); background:linear-gradient(180deg,#fff,#f4f7f5); }
    h1 { margin:0 0 8px; font-size:26px; letter-spacing:0; }
    h2 { margin:30px 0 12px; font-size:18px; }
    main { max-width:1280px; margin:0 auto; padding:22px 32px 40px; }
    .sub { color:var(--muted); }
    .header-links { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; }
    .header-links a { border:1px solid var(--line); border-radius:7px; padding:5px 9px; background:#fff; text-decoration:none; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:18px 0 4px; }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:12px; }
    .metric-label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .metric-value { font-size:24px; font-weight:700; margin-top:4px; }
    .metric-sub { color:var(--muted); font-size:12px; min-height:18px; }
    .field-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(360px,1fr)); gap:14px; }
    .field-card { background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .field-card-head { display:flex; justify-content:space-between; gap:12px; padding:12px 14px; border-bottom:1px solid var(--line); background:#f7faf8; }
    .field-card h3 { margin:0 0 3px; font-size:15px; }
    .field-actions { display:flex; align-items:flex-start; gap:8px; }
    .field-link { border:1px solid var(--line); border-radius:999px; padding:3px 8px; background:#fff; font-size:12px; text-decoration:none; white-space:nowrap; }
    .field-badge { align-self:flex-start; border:1px solid var(--line); border-radius:999px; padding:3px 8px; color:#34433c; background:#fff; font-size:12px; white-space:nowrap; }
    .field-card-summary { padding:9px 14px; color:#34433c; font-size:12px; border-bottom:1px solid var(--line); }
    .field-svg { overflow-x:auto; background:#f8fafc; }
    .field-svg svg { display:block; width:100%; min-width:640px; height:auto; }
    .viz-player { background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    .viz-toolbar { display:grid; grid-template-columns:minmax(220px,1.2fr) auto auto minmax(180px,.9fr); gap:10px; align-items:end; padding:12px 14px; border-bottom:1px solid var(--line); background:#f7faf8; }
    .viz-toolbar label { display:flex; flex-direction:column; gap:4px; color:var(--muted); font-size:12px; }
    .viz-toolbar select, .viz-toolbar button, .viz-toolbar input { font:inherit; }
    .viz-toolbar select { width:100%; border:1px solid var(--line); border-radius:6px; padding:7px 8px; background:#fff; color:var(--ink); }
    .viz-mode-buttons, .viz-step-buttons { display:flex; flex-wrap:wrap; gap:6px; }
    .viz-mode-buttons button, .viz-step-buttons button { border:1px solid var(--line); border-radius:6px; background:#fff; color:#34433c; padding:7px 9px; cursor:pointer; }
    .viz-mode-buttons button.active { border-color:var(--accent); background:#eaf3f0; color:#17443b; font-weight:700; }
    .viz-range-label input { width:100%; min-width:150px; accent-color:var(--accent); }
    .viz-canvas-wrap { background:#fff; }
    .viz-canvas-wrap canvas { display:block; width:100%; height:420px; }
    .viz-readout { margin:0; padding:12px 14px; border-top:1px solid var(--line); background:#f8faf9; color:#34433c; white-space:pre-wrap; overflow-wrap:anywhere; font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; min-height:88px; }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th, td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { background:#eef4f1; font-size:12px; color:#34433c; text-transform:uppercase; letter-spacing:.04em; }
    tr:last-child td { border-bottom:0; }
    .mini-bar { display:inline-block; width:72px; height:7px; margin-left:6px; border-radius:999px; background:#e1e7e4; overflow:hidden; vertical-align:middle; }
    .mini-bar span { display:block; height:100%; background:var(--accent); }
    .status { display:inline-block; padding:2px 7px; border-radius:999px; background:#e8eee9; font-size:12px; }
    .status.failed { background:#f5dddd; color:var(--bad); }
    .status.dry_run { background:#f3eadc; color:var(--warn); }
    a { color:var(--accent); }
    @media (max-width: 820px) {
      .viz-toolbar { grid-template-columns:1fr; }
      .viz-canvas-wrap canvas { height:360px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Tutor Stub Auto-Eval Report</h1>
    <div class="sub">Started ${escapeHtml(summary.startedAt)} · completed ${escapeHtml(summary.completedAt)} · world ${escapeHtml(summary.config.world)}</div>
    <div class="header-links"><a href="${escapeHtml(guideHref)}">arc guide</a></div>
  </header>
  <main>
    <section class="metrics">
      ${htmlMetric('Rows', summary.aggregates.rows, `${summary.aggregates.failed} failed · ${summary.aggregates.dryRun} dry-run`)}
      ${htmlMetric('Grounded', `${summary.aggregates.grounded}/${summary.aggregates.ok}`, `${Math.round(summary.aggregates.groundedRate * 100)}% closure`)}
      ${htmlMetric('Mean Turns', summary.aggregates.meanTurns, `safety cap ${summary.config.safetyTurns}`)}
      ${htmlMetric('Mean Coverage', summary.aggregates.meanCoverage, 'learner-DAG best path')}
      ${htmlMetric('Mean Missing', summary.aggregates.meanMissing, 'remaining premises')}
    </section>

    <h2>Policy Comparison</h2>
    <table>
      <thead><tr><th>Policy</th><th>OK</th><th>Grounded</th><th>Rate</th><th>Mean Turns</th><th>Mean Coverage</th><th>Mean Missing</th><th>Mastery Δ</th><th>Risk Δ</th><th>Top Registers</th><th>Entropy</th></tr></thead>
      <tbody>${policyRows || '<tr><td colspan="11">No policy rows.</td></tr>'}</tbody>
    </table>

    <h2>Animated Dynamics</h2>
    ${renderAnimatedVizSection(rows)}

    <h2>Field Trajectories</h2>
    ${renderFieldTrajectories(rows)}

    <h2>Run Details</h2>
    <table>
      <thead><tr><th>Policy</th><th>Run</th><th>Status</th><th>Grounded</th><th>Stop</th><th>Turns</th><th>Coverage</th><th>Missing</th><th>Bottleneck</th><th>Field Δ</th><th>Registers</th><th>Efficacy</th><th>Leaks</th><th>Trace</th><th>Log</th></tr></thead>
      <tbody>${runRows || '<tr><td colspan="15">No run rows.</td></tr>'}</tbody>
    </table>
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
  return String(value ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
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
        markdownEscape(Object.entries(entry.totals?.registerCounts || {}).map(([key, value]) => `${key}:${value}`).join(', ')),
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
  return String(value).replace(/\.\d{3}Z$/u, 'Z').replace('T', ' ');
}

function indexAggregates(summary) {
  if (summary?.aggregates?.byPolicy) return summary.aggregates;
  return summarizeRows(resultRows(summary?.results || []));
}

function readIndexSummary(jsonPath, rootDir) {
  try {
    const summary = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const aggregates = indexAggregates(summary);
    const config = summary.config || {};
    const htmlPath = reportHtmlPathForSummary(summary, jsonPath);
    const svgFiles = reportFieldSvgFiles(htmlPath);
    const relJson = hrefRelative(rootDir, jsonPath);
    const relParent = path.dirname(relJson);
    const reportName =
      relParent && relParent !== '.'
        ? `${relParent}/${path.basename(jsonPath, '.json')}`
        : path.basename(jsonPath, '.json');
    const policies = Array.isArray(config.policies) && config.policies.length ? config.policies : Object.keys(aggregates.byPolicy || {});
    const completedAt = summary.completedAt || summary.startedAt || '';
    const status = config.dryRun || aggregates.dryRun === aggregates.rows ? 'dry_run' : aggregates.failed ? 'failed' : 'ok';
    const htmlExists = fs.existsSync(htmlPath);
    return {
      reportName,
      jsonPath,
      htmlPath,
      htmlExists,
      jsonHref: hrefRelative(rootDir, jsonPath),
      htmlHref: htmlExists ? hrefRelative(rootDir, htmlPath) : '',
      svgHref: svgFiles[0] ? hrefRelative(rootDir, svgFiles[0]) : '',
      svgCount: svgFiles.length,
      completedAt,
      startedAt: summary.startedAt || '',
      status,
      policies,
      learnerProfile: config.autoLearnerProfileId || '',
      world: config.world || '',
      turns: config.turns || '',
      safetyTurns: config.safetyTurns ?? '',
      model: config.model || '',
      analysisModel: config.analysisModel || '',
      rows: aggregates.rows || 0,
      ok: aggregates.ok || 0,
      failed: aggregates.failed || 0,
      dryRun: aggregates.dryRun || 0,
      grounded: aggregates.grounded || 0,
      groundedRate: aggregates.groundedRate || 0,
      meanTurns: aggregates.meanTurns ?? '',
      meanCoverage: aggregates.meanCoverage ?? '',
      meanMissing: aggregates.meanMissing ?? '',
      searchText: [
        reportName,
        status,
        policies.join(' '),
        config.autoLearnerProfileId,
        config.world,
        config.model,
        config.analysisModel,
        shortDate(completedAt),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    };
  } catch (error) {
    return {
      reportName: path.basename(jsonPath, '.json'),
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
      turns: '',
      safetyTurns: '',
      model: '',
      analysisModel: '',
      rows: 0,
      ok: 0,
      failed: 1,
      dryRun: 0,
      grounded: 0,
      groundedRate: 0,
      meanTurns: '',
      meanCoverage: '',
      meanMissing: '',
      searchText: `${path.basename(jsonPath)} parse error`.toLowerCase(),
      parseError: error.message,
    };
  }
}

function policyChips(policies) {
  if (!policies?.length) return '<span class="muted">none</span>';
  return policies.map((policy) => `<span class="chip">${escapeHtml(policy)}</span>`).join('');
}

function renderReportIndex({ rows, rootDir, generatedAt }) {
  const guideHref = hrefRelative(rootDir, path.join(ROOT, 'docs', 'tutor-stub-arc-guide.html'));
  const totals = {
    reports: rows.length,
    ok: rows.reduce((sum, row) => sum + Number(row.ok || 0), 0),
    failed: rows.reduce((sum, row) => sum + Number(row.failed || 0), 0),
    dryRun: rows.reduce((sum, row) => sum + Number(row.dryRun || 0), 0),
    grounded: rows.reduce((sum, row) => sum + Number(row.grounded || 0), 0),
    svgs: rows.reduce((sum, row) => sum + Number(row.svgCount || 0), 0),
  };
  const groundedRate = totals.ok ? Number((totals.grounded / totals.ok).toFixed(3)) : 0;
  const reportRows = rows
    .map(
      (row) => `<tr data-search="${escapeHtml(row.searchText)}">
        <td>
          <div><strong>${escapeHtml(shortDate(row.completedAt) || row.reportName)}</strong></div>
          <div class="muted">${escapeHtml(row.reportName)}</div>
        </td>
        <td><span class="status ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${policyChips(row.policies)}</td>
        <td>${escapeHtml(row.learnerProfile || '')}</td>
        <td>${escapeHtml(row.ok)}/${escapeHtml(row.failed)}${row.dryRun ? ` · ${escapeHtml(row.dryRun)} dry` : ''}</td>
        <td>${escapeHtml(row.grounded)}/${escapeHtml(row.ok)} · ${Math.round(Number(row.groundedRate || 0) * 100)}%</td>
        <td>${escapeHtml(row.meanTurns)}</td>
        <td>${escapeHtml(row.meanCoverage)}</td>
        <td>${row.svgHref ? `<a href="${escapeHtml(row.svgHref)}">${escapeHtml(row.svgCount)} svg</a>` : escapeHtml(row.svgCount)}</td>
        <td class="actions">
          ${row.htmlHref ? `<a href="${escapeHtml(row.htmlHref)}">report</a>` : '<span class="muted">report</span>'}
          <a href="${escapeHtml(row.jsonHref)}">json</a>
        </td>
      </tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tutor Stub Reports</title>
  <style>
    :root { color-scheme: light; --ink:#17201b; --muted:#65736b; --line:#d9e0dc; --paper:#fbfcfb; --panel:#fff; --accent:#2f6f63; --bad:#9a2f36; --warn:#9c5a12; --blue:#275f9f; }
    body { margin:0; font:14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:var(--ink); background:var(--paper); }
    header { padding:24px 32px 16px; border-bottom:1px solid var(--line); background:#fff; }
    main { max-width:1280px; margin:0 auto; padding:20px 32px 40px; }
    h1 { margin:0 0 6px; font-size:24px; letter-spacing:0; }
    .muted { color:var(--muted); font-size:12px; }
    .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin:16px 0; }
    .metric { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:11px 12px; }
    .metric-label { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .metric-value { font-size:22px; font-weight:700; margin-top:3px; }
    .metric-sub { color:var(--muted); font-size:12px; min-height:18px; }
    .toolbar { display:flex; align-items:center; gap:10px; margin:18px 0 10px; }
    input { width:min(420px,100%); border:1px solid var(--line); border-radius:6px; padding:8px 10px; font:inherit; background:#fff; color:var(--ink); }
    table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:8px; overflow:hidden; }
    th, td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
    th { background:#eef4f1; color:#34433c; font-size:12px; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .chip { display:inline-block; margin:0 4px 4px 0; border:1px solid var(--line); border-radius:999px; padding:2px 7px; background:#f8faf9; font-size:12px; white-space:nowrap; }
    .status { display:inline-block; border-radius:999px; padding:2px 7px; background:#e8eee9; font-size:12px; white-space:nowrap; }
    .status.failed { background:#f5dddd; color:var(--bad); }
    .status.dry_run { background:#f3eadc; color:var(--warn); }
    a { color:var(--accent); }
    .actions { white-space:nowrap; }
    .actions a { margin-right:8px; }
    @media (max-width: 860px) {
      main, header { padding-left:16px; padding-right:16px; }
      table { display:block; overflow-x:auto; }
    }
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
    <section class="metrics">
      ${htmlMetric('Reports', totals.reports, `${rows.filter((row) => row.htmlExists).length} with HTML`)}
      ${htmlMetric('Rows', totals.ok + totals.failed + totals.dryRun, `${totals.failed} failed · ${totals.dryRun} dry-run`)}
      ${htmlMetric('Grounded', `${totals.grounded}/${totals.ok}`, `${Math.round(groundedRate * 100)}% closure`)}
      ${htmlMetric('Field SVGs', totals.svgs, 'standalone artifacts')}
    </section>
    <div class="toolbar">
      <input data-filter placeholder="Filter" aria-label="Filter reports">
      <span class="muted" data-count>${rows.length} shown</span>
    </div>
    <table>
      <thead><tr><th>Completed</th><th>Status</th><th>Policies</th><th>Learner</th><th>OK/Failed</th><th>Grounded</th><th>Turns</th><th>Coverage</th><th>SVGs</th><th>Links</th></tr></thead>
      <tbody>${reportRows || '<tr><td colspan="10">No reports found.</td></tr>'}</tbody>
    </table>
  </main>
  <script>
    const input = document.querySelector('[data-filter]');
    const rows = Array.from(document.querySelectorAll('tbody tr[data-search]'));
    const count = document.querySelector('[data-count]');
    function applyFilter() {
      const q = (input?.value || '').trim().toLowerCase();
      let shown = 0;
      for (const row of rows) {
        const visible = !q || row.dataset.search.includes(q);
        row.hidden = !visible;
        if (visible) shown += 1;
      }
      if (count) count.textContent = shown + ' shown';
    }
    input?.addEventListener('input', applyFilter);
    applyFilter();
  </script>
</body>
</html>
`;
}

function writeReportIndex({ rootDir = indexRootDir() } = {}) {
  fs.mkdirSync(rootDir, { recursive: true });
  const rows = listAutoEvalSummaryFiles(rootDir)
    .map((jsonPath) => readIndexSummary(jsonPath, rootDir))
    .sort((a, b) => {
      const aTime = Date.parse(a.completedAt || a.startedAt || '') || fs.statSync(a.jsonPath).mtimeMs;
      const bTime = Date.parse(b.completedAt || b.startedAt || '') || fs.statSync(b.jsonPath).mtimeMs;
      return bTime - aTime || a.reportName.localeCompare(b.reportName);
    });
  const indexPath = path.join(rootDir, 'index.html');
  fs.writeFileSync(indexPath, renderReportIndex({ rows, rootDir, generatedAt: new Date().toISOString() }));
  console.log(`[auto-eval] index ${indexPath}`);
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
    '--model',
    args.model,
    '--classifier-model',
    args['analysis-model'],
    '--learner-record-model',
    args['analysis-model'],
    '--auto-learner-model',
    args['auto-learner-model'],
    '--auto-learner-profile',
    resolvedAutoLearnerProfile(),
    '--tutor-learner-dag',
    '--world',
    args.world,
    '--register-policy',
    policy,
    '--register-palette',
    registerPalette,
    '--trace-dir',
    traceDir,
    '--no-stream',
    '--no-interim-animation',
  ];
  if (!args['no-dag']) command.push('--dag');
  if (args['no-stop-on-grounded']) command.push('--no-auto-stop-on-grounded');
  if (args['first-message']) command.push('--once', args['first-message']);
  if (args['cli-effort']) command.push('--cli-effort', args['cli-effort']);
  if (args['max-tokens']) command.push('--max-tokens', String(positiveInt(args['max-tokens'], '--max-tokens')));
  if (args['history-turns']) command.push('--history-turns', String(positiveInt(args['history-turns'], '--history-turns')));
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
      throw new Error(`Cannot resume ${result.policy || 'unknown'} run ${result.runIndex || '?'}: missing saved command`);
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

async function runJobs({ jobs, parallelism }) {
  const results = [];
  const activeJobs = new Map();
  let cursor = 0;
  let completed = 0;
  let aborted = false;
  const totalJobs = jobs.length;
  const progressIntervalSec = positiveInt(args['progress-interval'], '--progress-interval');
  const progressTimer = args['no-progress'] || args['dry-run']
    ? null
    : setInterval(() => {
        printTurnProgress({ completed, total: totalJobs, activeJobs, results });
      }, progressIntervalSec * 1000);

  async function worker() {
    while (!aborted && cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      activeJobs.set(job.key, job);
      console.log(`\n[auto-eval] policy=${job.policy} run=${job.runIndex}/${job.runs}`);
      printProgress({
        completed,
        total: totalJobs,
        label: `running ${job.ordinal}/${totalJobs}: ${job.policy} ${job.runIndex}/${job.runs}; log ${path.relative(ROOT, job.logPath)}`,
      });
      console.log(displayCommand(job.childArgs));
      const result = args['dry-run']
        ? {
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
    const { results: retriedResults, aborted } = await runJobs({ jobs: plan.jobs, parallelism });
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
  const { results, aborted } = await runJobs({ jobs, parallelism });
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
    config: configOverride || {
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
      maxTokens: args['max-tokens'] ? positiveInt(args['max-tokens'], '--max-tokens') : null,
      historyTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      memorySummary: {
        enabled: !args['no-memory-summary'],
        rawRecentTurns: args['history-turns'] ? positiveInt(args['history-turns'], '--history-turns') : null,
      },
      world: args.world,
      traceDir,
      dryRun: Boolean(args['dry-run']),
    },
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
