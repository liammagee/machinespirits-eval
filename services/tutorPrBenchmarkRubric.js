import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

export const TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-rubric.v1';
export const TUTOR_PR_BENCHMARK_RUBRIC_LABELS = Object.freeze(['pass', 'fail', 'unsure']);

const MACHINE_RULES = new Set([
  'job_status',
  'safety_failure',
  'audit_issue_types',
  'hard_issue_types',
  'hard_guard_prefixes',
]);
const SEVERITIES = new Set(['hard', 'advisory', 'composite']);
const STATUSES = new Set(['calibration', 'active', 'retired']);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function nonEmptyString(value, label) {
  if (!String(value || '').trim()) throw new Error(`${label} is required`);
  return String(value).trim();
}

function stringList(value, label) {
  if (!Array.isArray(value) || !value.length || value.some((entry) => !String(entry || '').trim())) {
    throw new Error(`${label} must be a non-empty string list`);
  }
  return value.map((entry) => String(entry).trim());
}

export function validateTutorPrBenchmarkRubric(rubric) {
  if (rubric?.schema !== TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA) {
    throw new Error(`PR benchmark rubric schema must be ${TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA}`);
  }
  nonEmptyString(rubric.id, 'rubric.id');
  const version = nonEmptyString(rubric.version, 'rubric.version');
  if (!/^\d+\.\d+$/u.test(version)) throw new Error('PR benchmark rubric version must use major.minor form');
  if (!STATUSES.has(rubric.status)) throw new Error('PR benchmark rubric has an invalid status');
  nonEmptyString(rubric.supersedes, 'rubric.supersedes');
  nonEmptyString(rubric.unit, 'rubric.unit');
  stringList(rubric.scope?.in_scope, 'rubric.scope.in_scope');
  stringList(rubric.scope?.out_of_scope, 'rubric.scope.out_of_scope');
  if (
    Object.keys(rubric.labels || {}).length !== TUTOR_PR_BENCHMARK_RUBRIC_LABELS.length ||
    TUTOR_PR_BENCHMARK_RUBRIC_LABELS.some((label) => !String(rubric.labels?.[label] || '').trim())
  ) {
    throw new Error('PR benchmark rubric labels must define pass, fail, and unsure');
  }
  const axes = Object.entries(rubric.axes || {});
  if (!axes.length) throw new Error('PR benchmark rubric requires axes');
  for (const [axisId, axis] of axes) {
    if (!/^[a-z][a-z0-9_]*$/u.test(axisId)) throw new Error(`rubric axis ${axisId} has an invalid id`);
    for (const field of ['title', 'construct', 'question', 'pass_anchor', 'fail_anchor', 'unsure_anchor']) {
      nonEmptyString(axis?.[field], `rubric axis ${axisId}.${field}`);
    }
    if (!SEVERITIES.has(axis.severity)) throw new Error(`rubric axis ${axisId} has invalid severity`);
    stringList(axis.exclusions, `rubric axis ${axisId}.exclusions`);
    if (!MACHINE_RULES.has(axis.machine_rule?.kind)) {
      throw new Error(`rubric axis ${axisId} has an unsupported machine rule`);
    }
    if (axis.machine_rule.kind === 'audit_issue_types') {
      nonEmptyString(axis.machine_rule.audit, `rubric axis ${axisId}.machine_rule.audit`);
    }
    const ruleList = ['hard_issue_types', 'audit_issue_types'].includes(axis.machine_rule.kind)
      ? axis.machine_rule.issue_types
      : axis.machine_rule.kind === 'hard_guard_prefixes'
        ? axis.machine_rule.guard_prefixes
        : null;
    if (ruleList !== null) stringList(ruleList, `rubric axis ${axisId}.machine_rule`);
  }
  const axisIds = new Set(axes.map(([axisId]) => axisId));
  if (!axisIds.has(rubric.decision_policy?.overall_axis)) {
    throw new Error('rubric decision_policy.overall_axis must reference an axis');
  }
  if (rubric.axes[rubric.decision_policy.overall_axis].severity !== 'composite') {
    throw new Error('rubric decision_policy.overall_axis must reference a composite axis');
  }
  const hardAxes = stringList(rubric.decision_policy?.hard_axes, 'rubric decision_policy.hard_axes');
  const advisoryAxes = stringList(rubric.decision_policy?.advisory_axes, 'rubric decision_policy.advisory_axes');
  const classifiedAxes = [...hardAxes, ...advisoryAxes];
  if (new Set(classifiedAxes).size !== classifiedAxes.length) {
    throw new Error('rubric decision policy cannot classify an axis as both hard and advisory');
  }
  for (const axisId of classifiedAxes) {
    if (!axisIds.has(axisId)) throw new Error(`rubric decision policy references unknown axis ${axisId}`);
    const expectedSeverity = hardAxes.includes(axisId) ? 'hard' : 'advisory';
    if (rubric.axes[axisId].severity !== expectedSeverity) {
      throw new Error(`rubric decision policy classifies ${axisId} differently from its severity`);
    }
  }
  const expectedClassified = [...axisIds].filter((axisId) => axisId !== rubric.decision_policy.overall_axis);
  if (expectedClassified.some((axisId) => !classifiedAxes.includes(axisId))) {
    throw new Error('rubric decision policy must classify every non-overall axis');
  }
  if (rubric.decision_policy?.positive_class !== 'fail') {
    throw new Error('rubric decision_policy.positive_class must be fail');
  }
  stringList(rubric.decision_policy?.rules, 'rubric decision_policy.rules');
  return rubric;
}

export function loadTutorPrBenchmarkRubric(rubricPath, expected = {}) {
  const resolvedPath = path.resolve(rubricPath);
  const source = fs.readFileSync(resolvedPath, 'utf8');
  const rubric = validateTutorPrBenchmarkRubric(yaml.parse(source));
  if (expected.schema && rubric.schema !== expected.schema) {
    throw new Error(`PR benchmark rubric expected schema ${expected.schema}, found ${rubric.schema}`);
  }
  if (expected.version && rubric.version !== String(expected.version)) {
    throw new Error(`PR benchmark rubric expected version ${expected.version}, found ${rubric.version}`);
  }
  return {
    rubric,
    source,
    rubricPath: resolvedPath,
    sha256: sha256(source),
  };
}

export function resolveTutorPrBenchmarkRubric({ root, definition } = {}) {
  if (!String(definition?.path || '').trim() || path.isAbsolute(definition.path)) {
    throw new Error('benchmark rubric.path must be repository-relative');
  }
  const rubricPath = path.resolve(root, definition.path);
  const relative = path.relative(root, rubricPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('benchmark rubric.path escapes repository root');
  }
  return loadTutorPrBenchmarkRubric(rubricPath, definition);
}
