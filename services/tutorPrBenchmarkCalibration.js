import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'yaml';

import { coderArtifactToken } from './labellingCoderIdentity.js';
import { safeCoderId } from './humanCodingStore.js';
import {
  loadTutorPrBenchmarkRubric,
  TUTOR_PR_BENCHMARK_RUBRIC_LABELS,
  TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA,
} from './tutorPrBenchmarkRubric.js';
import { TUTOR_PR_BENCHMARK_REPORT_SCHEMA } from './tutorStubPrBenchmark.js';

export const TUTOR_PR_CALIBRATION_CONFIG_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-calibration-config.v1';
export const TUTOR_PR_CALIBRATION_PACKET_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-calibration-packet.v1';
export const TUTOR_PR_CALIBRATION_MACHINE_KEY_SCHEMA =
  'machinespirits.tutor-stub.pr-benchmark-calibration-machine-key.v1';
export const TUTOR_PR_CALIBRATION_MANIFEST_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-calibration-manifest.v1';
export const TUTOR_PR_CALIBRATION_LABELS_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-calibration-labels.v1';
export const TUTOR_PR_CALIBRATION_ADJUDICATION_SCHEMA =
  'machinespirits.tutor-stub.pr-benchmark-calibration-adjudication.v1';
export const TUTOR_PR_CALIBRATION_ANALYSIS_SCHEMA = 'machinespirits.tutor-stub.pr-benchmark-calibration-analysis.v1';

const LABEL_VALUES = new Set(TUTOR_PR_BENCHMARK_RUBRIC_LABELS);
const GOLD_VALUES = new Set(['pass', 'fail']);
const PURPOSES = new Set(['development', 'acceptance']);
const RATER_PREFIX = 'rater-';

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function jsonHash(value) {
  return sha256(JSON.stringify(value));
}

function clone(value) {
  return structuredClone(value);
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function readJson(filePath, label = 'JSON') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} could not be read: ${error.message}`);
  }
}

function normalizeGuard(value) {
  return String(value || '')
    .replace(/Audit$/u, '')
    .replace(/([a-z0-9])([A-Z])/gu, '$1_$2')
    .toLowerCase();
}

function normalizeLabel(value, { gold = false } = {}) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  const allowed = gold ? GOLD_VALUES : LABEL_VALUES;
  if (!allowed.has(normalized)) {
    throw new Error(`label must be one of ${[...allowed].join(', ')}`);
  }
  return normalized;
}

function validateConfig(config) {
  if (config?.schema !== TUTOR_PR_CALIBRATION_CONFIG_SCHEMA) {
    throw new Error(`calibration config schema must be ${TUTOR_PR_CALIBRATION_CONFIG_SCHEMA}`);
  }
  if (
    !Array.isArray(config.purposes) ||
    config.purposes.length !== PURPOSES.size ||
    new Set(config.purposes).size !== PURPOSES.size ||
    config.purposes.some((value) => !PURPOSES.has(value))
  ) {
    throw new Error('calibration config purposes must contain only development and acceptance');
  }
  if (
    !String(config.rubric?.path || '').trim() ||
    path.isAbsolute(config.rubric.path) ||
    config.rubric.schema !== TUTOR_PR_BENCHMARK_RUBRIC_SCHEMA ||
    !String(config.rubric.version || '').trim()
  ) {
    throw new Error('calibration config requires a config-relative versioned PR benchmark rubric');
  }
  if (!Number.isInteger(config.labels?.required_coders) || config.labels.required_coders < 2) {
    throw new Error('calibration config requires at least two independent coders');
  }
  if (!Number.isInteger(config.labels?.notes_max_chars) || config.labels.notes_max_chars < 1) {
    throw new Error('calibration config labels.notes_max_chars must be positive');
  }
  if (config.analysis?.enforcement !== 'report_only') {
    throw new Error('calibration analysis must remain report_only until thresholds are approved');
  }
  if (config.analysis?.positive_class !== 'fail' || typeof config.analysis?.thresholds?.approved !== 'boolean') {
    throw new Error('calibration analysis requires fail as the positive class and an explicit threshold approval');
  }
  return config;
}

export function loadTutorPrCalibrationConfig(configPath) {
  const source = fs.readFileSync(configPath, 'utf8');
  const config = validateConfig(yaml.parse(source));
  const rubricPath = path.resolve(path.dirname(configPath), config.rubric.path);
  const loadedRubric = loadTutorPrBenchmarkRubric(rubricPath, config.rubric);
  return {
    config,
    source,
    configPath: path.resolve(configPath),
    rubric: loadedRubric.rubric,
    rubricSource: loadedRubric.source,
    rubricPath: loadedRubric.rubricPath,
    rubricSha256: loadedRubric.sha256,
  };
}

function resolveRepoPath(root, relativePath, label) {
  if (!String(relativePath || '').trim() || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a repository-relative path`);
  }
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes the repository root`);
  return target;
}

function visibleCaseContext({ root, benchmarkCase }) {
  const fixturePath = resolveRepoPath(root, benchmarkCase.fixture, `case ${benchmarkCase.id}.fixture`);
  const fixtureSource = fs.readFileSync(fixturePath, 'utf8');
  if (sha256(fixtureSource) !== benchmarkCase.fixtureSha256) {
    throw new Error(`case ${benchmarkCase.id} fixture hash does not match the source report`);
  }
  const fixture = JSON.parse(fixtureSource);
  const matches = (fixture.cases || []).filter((entry) => entry.id === benchmarkCase.fixtureCaseId);
  if (matches.length !== 1) {
    throw new Error(`case ${benchmarkCase.id} expected one fixture row ${benchmarkCase.fixtureCaseId}`);
  }
  const bundle = matches[0].bundle;
  if (!bundle) throw new Error(`case ${benchmarkCase.id} fixture row has no frozen bundle`);
  return {
    prior_turns: clone(bundle.priorTurns || []),
    learner_text: String(bundle.learnerText || benchmarkCase.learnerText || ''),
  };
}

function hardIssues(job) {
  return (job.audit?.deliveryDecision?.hardIssues || []).map((issue) => ({
    guard: normalizeGuard(issue.guard),
    type: String(issue.type || 'failed'),
  }));
}

function machineLabelForAxis(axis, job) {
  const rule = axis.machine_rule;
  if (rule.kind === 'job_status') return job.status === 'pass' ? 'pass' : 'fail';
  if (rule.kind === 'safety_failure') return job.audit?.safetyFailure === true ? 'fail' : 'pass';
  if (rule.kind === 'audit_result') return job.audit?.audits?.[rule.audit]?.ok === true ? 'pass' : 'fail';
  const issues = hardIssues(job);
  if (rule.kind === 'hard_issue_types') {
    const types = new Set(rule.issue_types || []);
    return issues.some((issue) => types.has(issue.type)) ? 'fail' : 'pass';
  }
  const prefixes = (rule.guard_prefixes || []).map(normalizeGuard);
  return issues.some((issue) => prefixes.some((prefix) => issue.guard.startsWith(prefix))) ? 'fail' : 'pass';
}

function assertEmptyOutputDirectory(outDir) {
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
    throw new Error(`calibration workspace already exists and is not empty: ${outDir}`);
  }
}

export function prepareTutorPrCalibrationWorkspace({
  root,
  reportPath,
  configPath,
  outDir,
  purpose,
  now = () => new Date(),
} = {}) {
  if (!PURPOSES.has(purpose)) throw new Error('calibration purpose must be development or acceptance');
  const loaded = loadTutorPrCalibrationConfig(configPath);
  if (!loaded.config.purposes.includes(purpose)) throw new Error(`calibration purpose ${purpose} is not configured`);
  const target = path.resolve(outDir);
  assertEmptyOutputDirectory(target);
  const reportSource = fs.readFileSync(reportPath, 'utf8');
  const report = JSON.parse(reportSource);
  if (report?.schema !== TUTOR_PR_BENCHMARK_REPORT_SCHEMA) {
    throw new Error(`source report schema must be ${TUTOR_PR_BENCHMARK_REPORT_SCHEMA}`);
  }
  const sourceRubric = report.plan?.rubric;
  if (
    sourceRubric &&
    (sourceRubric.schema !== loaded.rubric.schema ||
      sourceRubric.version !== loaded.rubric.version ||
      sourceRubric.sha256 !== loaded.rubricSha256)
  ) {
    throw new Error('source report rubric does not match the calibration rubric');
  }
  if (purpose === 'acceptance') {
    const completed = (report.jobs || []).every((job) => ['pass', 'fail'].includes(job.status));
    const expected = report.plan?.jobs?.length;
    if (
      !['pass', 'fail'].includes(report.status) ||
      !completed ||
      report.jobs?.length !== expected ||
      report.metadata?.gitTreeState !== 'clean' ||
      !String(report.metadata?.gitSha || '').trim() ||
      !sourceRubric
    ) {
      throw new Error(
        'acceptance calibration requires a complete benchmark report from a clean recorded commit under the same rubric',
      );
    }
  }
  const cases = new Map((report.plan?.cases || []).map((entry) => [entry.id, entry]));
  const axes = Object.entries(loaded.rubric.axes).map(([id, axis]) => ({
    id,
    title: axis.title,
    construct: axis.construct,
    question: axis.question,
    severity: axis.severity,
    pass_anchor: axis.pass_anchor,
    fail_anchor: axis.fail_anchor,
    unsure_anchor: axis.unsure_anchor,
    exclusions: clone(axis.exclusions),
    values: [...LABEL_VALUES],
  }));
  const reportSha256 = sha256(reportSource);
  const visibleItems = [];
  const keyedItems = [];
  for (const job of report.jobs || []) {
    if (!['pass', 'fail'].includes(job.status) || typeof job.candidate !== 'string') continue;
    const benchmarkCase = cases.get(job.caseId);
    if (!benchmarkCase) throw new Error(`source report job ${job.id} references unknown case ${job.caseId}`);
    const context = visibleCaseContext({ root, benchmarkCase });
    const visible = {
      case_id: job.caseId,
      criterion: benchmarkCase.criterion || null,
      prior_turns: context.prior_turns,
      learner_text: context.learner_text,
      candidate: job.candidate,
    };
    const itemSha256 = jsonHash(visible);
    const itemId = `cal-${sha256(`${reportSha256}:${job.id}:${itemSha256}`).slice(0, 16)}`;
    visibleItems.push({ item_id: itemId, item_sha256: itemSha256, ...visible });
    keyedItems.push({
      item_id: itemId,
      item_sha256: itemSha256,
      source_job_id: job.id,
      source_case_id: job.caseId,
      source_model_id: job.modelId,
      source_provider: job.provider || null,
      source_model: job.model || null,
      candidate_sha256: sha256(job.candidate),
      machine_labels: Object.fromEntries(
        Object.entries(loaded.rubric.axes).map(([axisId, axis]) => [axisId, machineLabelForAxis(axis, job)]),
      ),
      safety_failure: job.audit?.safetyFailure === true,
      failure_clusters: job.failureClusters || job.audit?.failureClusters || [],
      hard_failure_clusters: job.hardFailureClusters || job.audit?.hardFailureClusters || [],
    });
  }
  if (!visibleItems.length) throw new Error('source report contains no completed candidates');
  const ordered = visibleItems
    .map((item, index) => ({ item, key: keyedItems[index] }))
    .sort((left, right) => left.item.item_id.localeCompare(right.item.item_id));
  const packetBase = {
    schema: TUTOR_PR_CALIBRATION_PACKET_SCHEMA,
    purpose,
    blinding: {
      model_identity_hidden: true,
      machine_verdict_hidden: true,
      machine_failures_hidden: true,
    },
    codebook: {
      rubric: {
        id: loaded.rubric.id,
        schema: loaded.rubric.schema,
        version: loaded.rubric.version,
        status: loaded.rubric.status,
        sha256: loaded.rubricSha256,
      },
      task: loaded.rubric.unit,
      scope: clone(loaded.rubric.scope),
      decision_policy: clone(loaded.rubric.decision_policy),
      values: clone(loaded.rubric.labels),
      axes,
    },
    items: ordered.map((entry) => entry.item),
  };
  const packetSha256 = jsonHash(packetBase);
  const packet = { ...packetBase, packet_sha256: packetSha256 };
  const machineKey = {
    schema: TUTOR_PR_CALIBRATION_MACHINE_KEY_SCHEMA,
    packet_sha256: packetSha256,
    source_report: path.resolve(reportPath),
    source_report_sha256: reportSha256,
    source_git_sha: report.metadata?.gitSha || null,
    source_git_tree_state: report.metadata?.gitTreeState || null,
    source_benchmark_config_sha256: report.plan?.configSha256 || null,
    rubric_schema: loaded.rubric.schema,
    rubric_version: loaded.rubric.version,
    rubric_sha256: loaded.rubricSha256,
    items: ordered.map((entry) => entry.key),
  };
  const machineKeySha256 = jsonHash(machineKey);
  const createdAt = now().toISOString();
  const manifest = {
    schema: TUTOR_PR_CALIBRATION_MANIFEST_SCHEMA,
    status: 'awaiting_labels',
    purpose,
    created_at: createdAt,
    packet_sha256: packetSha256,
    machine_key_sha256: machineKeySha256,
    config_sha256: sha256(loaded.source),
    rubric_schema: loaded.rubric.schema,
    rubric_version: loaded.rubric.version,
    rubric_sha256: loaded.rubricSha256,
    source_report_sha256: reportSha256,
    item_count: packet.items.length,
    required_coders: loaded.config.labels.required_coders,
    paths: {
      packet: 'packet.json',
      machine_key: 'machine-key.json',
      labels: 'labels/',
      adjudication: 'adjudication.json',
      analysis: 'analysis.json',
    },
  };
  fs.mkdirSync(path.join(target, 'labels'), { recursive: true });
  atomicWriteJson(path.join(target, 'packet.json'), packet);
  atomicWriteJson(path.join(target, 'machine-key.json'), machineKey);
  atomicWriteJson(path.join(target, 'manifest.json'), manifest);
  fs.writeFileSync(
    path.join(target, 'labels', 'README.md'),
    'Coder sidecars are written here by the calibration label command. Keep each coder identity independent.\n',
    'utf8',
  );
  return { workspace: target, manifest, packet, machineKey };
}

function loadWorkspace(workspaceDir, configPath) {
  const root = path.resolve(workspaceDir);
  const manifest = readJson(path.join(root, 'manifest.json'), 'calibration manifest');
  const packet = readJson(path.join(root, 'packet.json'), 'calibration packet');
  const machineKey = readJson(path.join(root, 'machine-key.json'), 'calibration machine key');
  const loadedConfig = loadTutorPrCalibrationConfig(configPath);
  const config = loadedConfig.config;
  if (manifest.schema !== TUTOR_PR_CALIBRATION_MANIFEST_SCHEMA) throw new Error('invalid calibration manifest schema');
  if (packet.schema !== TUTOR_PR_CALIBRATION_PACKET_SCHEMA) throw new Error('invalid calibration packet schema');
  if (machineKey.schema !== TUTOR_PR_CALIBRATION_MACHINE_KEY_SCHEMA) throw new Error('invalid machine-key schema');
  if (
    manifest.packet_sha256 !== packet.packet_sha256 ||
    machineKey.packet_sha256 !== packet.packet_sha256 ||
    manifest.machine_key_sha256 !== jsonHash(machineKey) ||
    manifest.config_sha256 !== sha256(loadedConfig.source) ||
    manifest.rubric_schema !== loadedConfig.rubric.schema ||
    manifest.rubric_version !== loadedConfig.rubric.version ||
    manifest.rubric_sha256 !== loadedConfig.rubricSha256 ||
    machineKey.rubric_schema !== loadedConfig.rubric.schema ||
    machineKey.rubric_version !== loadedConfig.rubric.version ||
    machineKey.rubric_sha256 !== loadedConfig.rubricSha256 ||
    packet.codebook?.rubric?.sha256 !== loadedConfig.rubricSha256
  ) {
    throw new Error('calibration workspace provenance mismatch');
  }
  const packetBase = clone(packet);
  delete packetBase.packet_sha256;
  if (jsonHash(packetBase) !== packet.packet_sha256) throw new Error('calibration packet content hash mismatch');
  if (manifest.item_count !== packet.items.length || machineKey.items.length !== packet.items.length) {
    throw new Error('calibration workspace item count mismatch');
  }
  const packetItems = new Map(packet.items.map((item) => [item.item_id, item.item_sha256]));
  if (packetItems.size !== packet.items.length) throw new Error('calibration packet contains duplicate item IDs');
  for (const key of machineKey.items) {
    if (packetItems.get(key.item_id) !== key.item_sha256) {
      throw new Error(`calibration machine-key item mismatch: ${key.item_id}`);
    }
  }
  return { root, manifest, packet, machineKey, config };
}

function raterPath(workspace, coderId) {
  return path.join(workspace.root, 'labels', `${RATER_PREFIX}${coderArtifactToken(safeCoderId(coderId))}.json`);
}

function emptyRater(workspace, coderId, now) {
  return {
    schema: TUTOR_PR_CALIBRATION_LABELS_SCHEMA,
    packet_sha256: workspace.packet.packet_sha256,
    coder_id: safeCoderId(coderId),
    created_at: now().toISOString(),
    updated_at: now().toISOString(),
    items: [],
  };
}

function validateRater(rater, workspace, filePath) {
  if (rater.schema !== TUTOR_PR_CALIBRATION_LABELS_SCHEMA) throw new Error(`invalid rater schema: ${filePath}`);
  if (rater.packet_sha256 !== workspace.packet.packet_sha256) {
    throw new Error(`rater packet provenance mismatch: ${filePath}`);
  }
  return rater;
}

function readRaters(workspace) {
  const directory = path.join(workspace.root, 'labels');
  if (!fs.existsSync(directory)) return [];
  const raters = fs
    .readdirSync(directory)
    .filter((name) => name.startsWith(RATER_PREFIX) && name.endsWith('.json'))
    .sort()
    .map((name) => {
      const filePath = path.join(directory, name);
      return validateRater(readJson(filePath, 'rater sidecar'), workspace, filePath);
    })
    .sort((left, right) => left.coder_id.localeCompare(right.coder_id));
  if (new Set(raters.map((rater) => safeCoderId(rater.coder_id))).size !== raters.length) {
    throw new Error('calibration workspace contains duplicate coder identities');
  }
  return raters;
}

function axisIds(workspace) {
  return workspace.packet.codebook.axes.map((axis) => axis.id);
}

function codingComplete(coding, axes) {
  return axes.every((axis) => LABEL_VALUES.has(coding?.labels?.[axis]));
}

export function getTutorPrCalibrationCodingSession({ workspaceDir, configPath, coderId } = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const normalizedCoder = safeCoderId(coderId);
  const filePath = raterPath(workspace, normalizedCoder);
  const rater = fs.existsSync(filePath)
    ? validateRater(readJson(filePath, 'rater sidecar'), workspace, filePath)
    : emptyRater(workspace, normalizedCoder, () => new Date());
  if (safeCoderId(rater.coder_id) !== normalizedCoder) throw new Error('rater identity does not match its filename');
  return {
    purpose: workspace.manifest.purpose,
    packet_sha256: workspace.packet.packet_sha256,
    codebook: clone(workspace.packet.codebook),
    items: clone(workspace.packet.items),
    saved: clone(rater.items || []),
  };
}

export function saveTutorPrCalibrationCoding({
  workspaceDir,
  configPath,
  coderId,
  itemId,
  labels,
  notes = '',
  now = () => new Date(),
} = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const item = workspace.packet.items.find((entry) => entry.item_id === itemId);
  if (!item) throw new Error(`unknown calibration item ${itemId}`);
  const normalizedCoder = safeCoderId(coderId);
  const filePath = raterPath(workspace, normalizedCoder);
  const rater = fs.existsSync(filePath)
    ? validateRater(readJson(filePath, 'rater sidecar'), workspace, filePath)
    : emptyRater(workspace, normalizedCoder, now);
  if (safeCoderId(rater.coder_id) !== normalizedCoder) throw new Error('rater identity does not match its filename');
  const axisLabels = {};
  for (const axis of axisIds(workspace)) axisLabels[axis] = normalizeLabel(labels?.[axis]);
  const normalizedNotes = String(notes || '').trim();
  if (normalizedNotes.length > workspace.config.labels.notes_max_chars) {
    throw new Error(`notes exceeds ${workspace.config.labels.notes_max_chars} characters`);
  }
  const next = {
    item_id: itemId,
    item_sha256: item.item_sha256,
    labels: axisLabels,
    notes: normalizedNotes,
  };
  const saved = new Map((rater.items || []).map((entry) => [entry.item_id, entry]));
  saved.set(itemId, next);
  rater.items = workspace.packet.items
    .filter((entry) => saved.has(entry.item_id))
    .map((entry) => saved.get(entry.item_id));
  rater.updated_at = now().toISOString();
  atomicWriteJson(filePath, rater);
  return { filePath, rater, item: next };
}

function readAdjudication(workspace) {
  const filePath = path.join(workspace.root, 'adjudication.json');
  if (!fs.existsSync(filePath)) return null;
  const value = readJson(filePath, 'calibration adjudication');
  if (
    value.schema !== TUTOR_PR_CALIBRATION_ADJUDICATION_SCHEMA ||
    value.packet_sha256 !== workspace.packet.packet_sha256
  ) {
    throw new Error('calibration adjudication provenance mismatch');
  }
  return value;
}

function completeRaters(workspace, raters) {
  const axes = axisIds(workspace);
  return raters.filter((rater) => {
    const rows = new Map((rater.items || []).map((item) => [item.item_id, item]));
    return workspace.packet.items.every((item) => {
      const coding = rows.get(item.item_id);
      return coding?.item_sha256 === item.item_sha256 && codingComplete(coding, axes);
    });
  });
}

function disagreements(workspace, raters) {
  if (raters.length < workspace.config.labels.required_coders) return [];
  const axes = axisIds(workspace);
  return workspace.packet.items.flatMap((item) =>
    axes.flatMap((axis) => {
      const values = raters.map((rater) => rater.items.find((entry) => entry.item_id === item.item_id)?.labels?.[axis]);
      const unique = [...new Set(values)];
      return unique.length === 1 && GOLD_VALUES.has(unique[0])
        ? []
        : [{ item_id: item.item_id, axis, values, coders: raters.map((rater) => rater.coder_id) }];
    }),
  );
}

function disagreementHash(dispute) {
  return jsonHash({
    item_id: dispute.item_id,
    axis: dispute.axis,
    coders: dispute.coders,
    values: dispute.values,
  });
}

function calibrationEvidenceHash(raters, adjudication) {
  return jsonHash({
    raters: [...raters]
      .sort((left, right) => left.coder_id.localeCompare(right.coder_id))
      .map((rater) => ({ coder_id: rater.coder_id, items: rater.items })),
    adjudication: adjudication
      ? {
          adjudicator_id: adjudication.adjudicator_id,
          items: adjudication.items,
        }
      : null,
  });
}

function analysisCurrent(workspace, raters, adjudication) {
  const filePath = path.join(workspace.root, 'analysis.json');
  if (!fs.existsSync(filePath)) return false;
  const analysis = readJson(filePath, 'calibration analysis');
  return (
    analysis.schema === TUTOR_PR_CALIBRATION_ANALYSIS_SCHEMA &&
    analysis.packet_sha256 === workspace.packet.packet_sha256 &&
    analysis.evidence_sha256 === calibrationEvidenceHash(raters, adjudication)
  );
}

export function getTutorPrCalibrationStatus({ workspaceDir, configPath } = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const raters = readRaters(workspace);
  const completed = completeRaters(workspace, raters);
  const disputes = disagreements(workspace, completed);
  const adjudication = readAdjudication(workspace);
  const adjudicated = new Map(
    (adjudication?.items || []).flatMap((item) =>
      Object.entries(item.labels || {}).map(([axis, value]) => [
        `${item.item_id}:${axis}`,
        { value, disagreement_sha256: item.evidence?.[axis]?.disagreement_sha256 },
      ]),
    ),
  );
  const unresolved = disputes.filter((row) => {
    const resolution = adjudicated.get(`${row.item_id}:${row.axis}`);
    return !GOLD_VALUES.has(resolution?.value) || resolution.disagreement_sha256 !== disagreementHash(row);
  });
  let state;
  if (completed.length < workspace.config.labels.required_coders) {
    state = completed.length === 1 ? 'awaiting_second_coder' : 'awaiting_labels';
  } else if (unresolved.length > 0) {
    state = 'awaiting_adjudication';
  } else if (analysisCurrent(workspace, completed, adjudication)) {
    state = 'complete';
  } else {
    state = 'ready_to_analyze';
  }
  const axes = axisIds(workspace);
  return {
    state,
    purpose: workspace.manifest.purpose,
    packet_sha256: workspace.packet.packet_sha256,
    items: workspace.packet.items.length,
    axes: axes.length,
    required_coders: workspace.config.labels.required_coders,
    raters: raters.map((rater) => {
      const completeItems = (rater.items || []).filter((item) => codingComplete(item, axes)).length;
      return {
        coder_id: rater.coder_id,
        complete_items: completeItems,
        total_items: workspace.packet.items.length,
        complete: completed.includes(rater),
      };
    }),
    complete_coders: completed.map((rater) => rater.coder_id),
    disagreements: disputes,
    unresolved_disagreements: unresolved,
  };
}

export function getTutorPrCalibrationAdjudicationSession({ workspaceDir, configPath } = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const status = getTutorPrCalibrationStatus({ workspaceDir, configPath });
  return {
    purpose: workspace.manifest.purpose,
    packet_sha256: workspace.packet.packet_sha256,
    codebook: clone(workspace.packet.codebook),
    items: clone(workspace.packet.items),
    disagreements: clone(status.disagreements),
    unresolved_disagreements: clone(status.unresolved_disagreements),
  };
}

export function saveTutorPrCalibrationAdjudication({
  workspaceDir,
  configPath,
  coderId,
  itemId,
  axis,
  value,
  notes = '',
  now = () => new Date(),
} = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const status = getTutorPrCalibrationStatus({ workspaceDir, configPath });
  const dispute = status.disagreements.find((row) => row.item_id === itemId && row.axis === axis);
  if (!dispute) {
    throw new Error(`no coder disagreement requires adjudication for ${itemId}:${axis}`);
  }
  const normalizedCoder = safeCoderId(coderId);
  if (dispute.coders.includes(normalizedCoder)) throw new Error('adjudicator must be independent of the packet coders');
  const normalizedValue = normalizeLabel(value, { gold: true });
  const normalizedNotes = String(notes || '').trim();
  if (normalizedNotes.length > workspace.config.labels.notes_max_chars) {
    throw new Error(`notes exceeds ${workspace.config.labels.notes_max_chars} characters`);
  }
  const filePath = path.join(workspace.root, 'adjudication.json');
  const adjudication = readAdjudication(workspace) || {
    schema: TUTOR_PR_CALIBRATION_ADJUDICATION_SCHEMA,
    packet_sha256: workspace.packet.packet_sha256,
    adjudicator_id: normalizedCoder,
    created_at: now().toISOString(),
    updated_at: now().toISOString(),
    items: [],
  };
  if (safeCoderId(adjudication.adjudicator_id) !== normalizedCoder) {
    throw new Error('adjudication artifact belongs to a different adjudicator');
  }
  const items = new Map((adjudication.items || []).map((item) => [item.item_id, item]));
  const packetItem = workspace.packet.items.find((item) => item.item_id === itemId);
  const prior = items.get(itemId) || {
    item_id: itemId,
    item_sha256: packetItem.item_sha256,
    labels: {},
    notes: {},
    evidence: {},
  };
  if (prior.item_sha256 !== packetItem.item_sha256) throw new Error('adjudication item provenance mismatch');
  prior.labels[axis] = normalizedValue;
  prior.notes[axis] = normalizedNotes;
  prior.evidence ||= {};
  prior.evidence[axis] = {
    disagreement_sha256: disagreementHash(dispute),
    coder_values: Object.fromEntries(dispute.coders.map((coder, index) => [coder, dispute.values[index]])),
  };
  items.set(itemId, prior);
  adjudication.items = workspace.packet.items
    .filter((item) => items.has(item.item_id))
    .map((item) => items.get(item.item_id));
  adjudication.updated_at = now().toISOString();
  atomicWriteJson(filePath, adjudication);
  return { filePath, adjudication };
}

function cohenKappa(pairs) {
  if (!pairs.length) return null;
  const agreement = pairs.filter(([left, right]) => left === right).length / pairs.length;
  const values = ['pass', 'fail'];
  const expected = values.reduce((sum, value) => {
    const leftRate = pairs.filter(([left]) => left === value).length / pairs.length;
    const rightRate = pairs.filter(([, right]) => right === value).length / pairs.length;
    return sum + leftRate * rightRate;
  }, 0);
  return expected === 1 ? (agreement === 1 ? 1 : null) : (agreement - expected) / (1 - expected);
}

function metricForRows(rows) {
  const tp = rows.filter((row) => row.human === 'fail' && row.machine === 'fail').length;
  const fp = rows.filter((row) => row.human === 'pass' && row.machine === 'fail').length;
  const fn = rows.filter((row) => row.human === 'fail' && row.machine === 'pass').length;
  const tn = rows.filter((row) => row.human === 'pass' && row.machine === 'pass').length;
  const ratio = (numerator, denominator) => (denominator ? numerator / denominator : null);
  return {
    n: rows.length,
    confusion: { true_fail: tp, false_fail: fp, missed_fail: fn, true_pass: tn },
    precision: ratio(tp, tp + fp),
    recall: ratio(tp, tp + fn),
    specificity: ratio(tn, tn + fp),
    agreement: ratio(tp + tn, rows.length),
  };
}

export function analyzeTutorPrCalibration({ workspaceDir, configPath, now = () => new Date() } = {}) {
  const workspace = loadWorkspace(workspaceDir, configPath);
  const status = getTutorPrCalibrationStatus({ workspaceDir, configPath });
  if (!['ready_to_analyze', 'complete'].includes(status.state)) {
    throw new Error(`calibration workspace is ${status.state}; complete labels and adjudication first`);
  }
  const raters = completeRaters(workspace, readRaters(workspace));
  const adjudication = readAdjudication(workspace);
  const adjudicated = new Map(
    (adjudication?.items || []).flatMap((item) =>
      Object.entries(item.labels || {}).map(([axis, value]) => [`${item.item_id}:${axis}`, value]),
    ),
  );
  const machine = new Map(workspace.machineKey.items.map((item) => [item.item_id, item]));
  const axes = axisIds(workspace);
  const goldRows = [];
  for (const item of workspace.packet.items) {
    for (const axis of axes) {
      const values = raters.map((rater) => rater.items.find((entry) => entry.item_id === item.item_id).labels[axis]);
      const unanimous = values.every((value) => value === values[0]) && GOLD_VALUES.has(values[0]);
      const human = unanimous ? values[0] : adjudicated.get(`${item.item_id}:${axis}`);
      if (!GOLD_VALUES.has(human)) throw new Error(`missing gold label for ${item.item_id}:${axis}`);
      goldRows.push({ item_id: item.item_id, axis, human, machine: machine.get(item.item_id).machine_labels[axis] });
    }
  }
  const firstTwo = raters.slice(0, 2);
  const metrics = Object.fromEntries(
    axes.map((axis) => {
      const rows = goldRows.filter((row) => row.axis === axis);
      const pairs = workspace.packet.items
        .map((item) =>
          firstTwo.map((rater) => rater.items.find((entry) => entry.item_id === item.item_id).labels[axis]),
        )
        .filter((pair) => pair.every((value) => GOLD_VALUES.has(value)));
      return [
        axis,
        {
          ...metricForRows(rows),
          inter_rater: {
            n: pairs.length,
            agreement: pairs.length ? pairs.filter(([left, right]) => left === right).length / pairs.length : null,
            cohen_kappa: cohenKappa(pairs),
            coders: firstTwo.map((rater) => rater.coder_id),
          },
        },
      ];
    }),
  );
  const thresholds = workspace.config.analysis.thresholds;
  const thresholdState = thresholds.approved ? 'approved' : 'approval_required';
  const report = {
    schema: TUTOR_PR_CALIBRATION_ANALYSIS_SCHEMA,
    packet_sha256: workspace.packet.packet_sha256,
    evidence_sha256: calibrationEvidenceHash(raters, adjudication),
    purpose: workspace.manifest.purpose,
    completed_at: now().toISOString(),
    enforcement: 'report_only',
    threshold_state: thresholdState,
    promotion_eligible: false,
    promotion_reasons: [
      'report_only_harness',
      ...(workspace.manifest.purpose === 'development' ? ['development_packet_cannot_promote'] : []),
      ...(!thresholds.approved ? ['acceptance_thresholds_not_approved'] : []),
    ],
    coder_ids: raters.map((rater) => rater.coder_id),
    adjudicator_id: adjudication?.adjudicator_id || null,
    rows: goldRows,
    metrics,
  };
  atomicWriteJson(path.join(workspace.root, 'analysis.json'), report);
  fs.writeFileSync(path.join(workspace.root, 'analysis.md'), renderTutorPrCalibrationAnalysisMarkdown(report), 'utf8');
  return report;
}

export function renderTutorPrCalibrationStatus(status) {
  const lines = [
    '# Tutor PR benchmark calibration status',
    '',
    `- State: **${status.state}**`,
    `- Purpose: \`${status.purpose}\``,
    `- Packet: \`${status.packet_sha256}\``,
    `- Items / axes: ${status.items} / ${status.axes}`,
    `- Complete coders: ${status.complete_coders.length}/${status.required_coders}`,
    `- Unresolved disagreements: ${status.unresolved_disagreements.length}`,
    '',
  ];
  for (const rater of status.raters) {
    lines.push(`- ${rater.coder_id}: ${rater.complete_items}/${rater.total_items}${rater.complete ? ' complete' : ''}`);
  }
  return `${lines.join('\n')}\n`;
}

export function renderTutorPrCalibrationAnalysisMarkdown(report) {
  const lines = [
    '# Tutor PR benchmark calibration analysis',
    '',
    `- Purpose: \`${report.purpose}\``,
    `- Enforcement: **${report.enforcement}**`,
    `- Threshold state: **${report.threshold_state}**`,
    `- Promotion eligible: **${report.promotion_eligible ? 'yes' : 'no'}**`,
    '',
    '| Axis | N | Agreement | Precision | Recall | Specificity | Human kappa |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  const display = (value) => (value === null ? 'n/a' : value.toFixed(3));
  for (const [axis, metric] of Object.entries(report.metrics)) {
    lines.push(
      `| ${axis} | ${metric.n} | ${display(metric.agreement)} | ${display(metric.precision)} | ${display(metric.recall)} | ${display(metric.specificity)} | ${display(metric.inter_rater.cohen_kappa)} |`,
    );
  }
  lines.push(
    '',
    'A development packet may diagnose and tune guards but cannot promote enforcement. Acceptance thresholds must be approved before the held-out packet is opened.',
    '',
  );
  return lines.join('\n');
}
