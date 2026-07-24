import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  DETERMINISTIC_EXPERIMENT_DRAW_SCHEMA,
  deriveDeterministicSeed,
  replayDeterministicChoice,
} from './deterministicExperimentSampler.js';

export {
  deriveDeterministicSeed,
  deterministicChoice,
  deterministicUnit,
  replayDeterministicChoice,
} from './deterministicExperimentSampler.js';

export const EXPERIMENT_RUN_PLAN_SCHEMA = 'machinespirits.experiment-run-plan.v1';
export const EXPERIMENT_RUN_EVENT_SCHEMA = 'machinespirits.experiment-run-event.v1';
export const EXPERIMENT_RUN_SEAL_SCHEMA = 'machinespirits.experiment-run-seal.v1';
export const EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA = 'machinespirits.experiment-random-draw-contract.v1';

export const EXPERIMENT_RUN_PLAN_FILE = 'run-plan.json';
export const EXPERIMENT_RUN_EVENTS_FILE = 'run-events.jsonl';
export const EXPERIMENT_RUN_SEAL_FILE = 'run-seal.json';

export const DEFAULT_EXPERIMENT_HASH_KINDS = Object.freeze([
  'runner',
  'analyzer',
  'policy',
  'profile',
  'prompt',
  'world',
  'config',
]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const TUTOR_STUB_POLICY_DRAW_SCHEMA = 'machinespirits.tutor-stub.policy-draw.v1';

function jsonClone(value) {
  if (value === undefined) return undefined;
  let encoded;
  try {
    encoded = JSON.stringify(value);
  } catch (error) {
    throw new Error(`value must be JSON serializable: ${error.message}`);
  }
  if (encoded === undefined) throw new Error('value must be JSON serializable');
  return JSON.parse(encoded);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

export function canonicalJson(value, { space = 0, trailingNewline = false } = {}) {
  const encoded = JSON.stringify(sortJson(jsonClone(value)), null, space || undefined);
  return trailingNewline ? `${encoded}\n` : encoded;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function hashCanonicalJson(value) {
  return sha256(canonicalJson(value));
}

export function hashFile(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function requireSha256(value, label) {
  if (!SHA256_PATTERN.test(String(value || ''))) {
    throw new Error(`${label} must be a lowercase SHA-256 hex digest`);
  }
  return String(value);
}

function normalizeModels(models) {
  requireObject(models, 'models');
  const roles = Object.entries(models);
  if (!roles.length) throw new Error('models must declare at least one role');
  return Object.fromEntries(
    roles
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([role, row]) => {
        requireNonEmptyString(role, 'model role');
        requireObject(row, `models.${role}`);
        const requested = requireNonEmptyString(row.requested, `models.${role}.requested`);
        const resolved = requireNonEmptyString(row.resolved, `models.${role}.resolved`);
        const observed =
          row.observed === null || row.observed === undefined || row.observed === ''
            ? null
            : requireNonEmptyString(row.observed, `models.${role}.observed`);
        let allowedObservedModels;
        if (row.allowedObservedModels !== undefined) {
          if (!Array.isArray(row.allowedObservedModels) || !row.allowedObservedModels.length) {
            throw new Error(`models.${role}.allowedObservedModels must be a non-empty array when present`);
          }
          allowedObservedModels = [
            ...new Set(
              row.allowedObservedModels.map((value) =>
                requireNonEmptyString(value, `models.${role}.allowedObservedModels[]`),
              ),
            ),
          ].sort();
          if (observed && !allowedObservedModels.includes(observed)) {
            throw new Error(`models.${role}.observed must be included in allowedObservedModels`);
          }
        }
        if (row.allowCliDefaultResolution !== undefined && typeof row.allowCliDefaultResolution !== 'boolean') {
          throw new Error(`models.${role}.allowCliDefaultResolution must be boolean when present`);
        }
        const allowCliDefaultResolution = row.allowCliDefaultResolution === true;
        if (allowCliDefaultResolution && !resolved.endsWith('/(cli-default)')) {
          throw new Error(`models.${role}.allowCliDefaultResolution requires resolved to end with /(cli-default)`);
        }
        const normalized = {
          requested,
          resolved,
          observed,
        };
        if (allowedObservedModels) normalized.allowedObservedModels = allowedObservedModels;
        if (allowCliDefaultResolution) normalized.allowCliDefaultResolution = true;
        return [role, normalized];
      }),
  );
}

/**
 * Collapse tutor-stub's implementation-specific model-call labels onto the
 * three frozen experiment roles. Keep this explicit: an unknown future role
 * must not silently become an analyzer and satisfy provenance by accident.
 */
export function tutorStubTraceModelRole(traceRole) {
  const normalized = String(traceRole || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (
    normalized === 'tutor' ||
    normalized.startsWith('tutor_stub_tutor') ||
    normalized === 'tutor_stub_opening' ||
    normalized === 'tutor_stub_clarifier' ||
    normalized === 'tutor_stub_curriculum_translator' ||
    normalized === 'tutor_stub_turn_translator'
  ) {
    return 'tutor';
  }
  if (
    normalized === 'learner' ||
    normalized.startsWith('tutor_stub_auto_learner') ||
    normalized.startsWith('tutor_stub_mixed_learner')
  ) {
    return 'learner';
  }
  if (normalized === 'analyzer' || normalized.startsWith('tutor_stub_learner_')) return 'analyzer';
  return null;
}

function normalizeHashes(hashes, requiredKinds) {
  requireObject(hashes, 'hashes');
  const normalized = {};
  for (const [kind, digest] of Object.entries(hashes)) {
    normalized[kind] = requireSha256(digest, `hashes.${kind}`);
  }
  for (const kind of requiredKinds) {
    if (!normalized[kind]) throw new Error(`hashes.${kind} is required`);
  }
  return Object.fromEntries(Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeGitProvenance(provenance) {
  const normalized = jsonClone(requireObject(provenance, 'provenance'));
  const git = requireObject(normalized.git, 'provenance.git');
  requireNonEmptyString(git.sha, 'provenance.git.sha');
  requireNonEmptyString(git.branch, 'provenance.git.branch');
  if (typeof git.dirty !== 'boolean') throw new Error('provenance.git.dirty must be boolean');
  requireSha256(git.fingerprintSha256, 'provenance.git.fingerprintSha256');
  return normalized;
}

function normalizeLineage(lineage = {}) {
  requireObject(lineage, 'lineage');
  const optionalId = (value, label) => {
    if (value === null || value === undefined || value === '') return null;
    return requireNonEmptyString(value, label);
  };
  const supersedes = lineage.supersedes ?? [];
  if (!Array.isArray(supersedes)) throw new Error('lineage.supersedes must be an array');
  return {
    parentRunId: optionalId(lineage.parentRunId, 'lineage.parentRunId'),
    resumeOf: optionalId(lineage.resumeOf, 'lineage.resumeOf'),
    supersedes: [...new Set(supersedes.map((value) => requireNonEmptyString(value, 'lineage.supersedes[]')))].sort(),
  };
}

function normalizeMasterSeed(masterSeed) {
  if (masterSeed === null || masterSeed === undefined || String(masterSeed).trim() === '') {
    throw new Error('masterSeed is required');
  }
  if (typeof masterSeed === 'number' && !Number.isSafeInteger(masterSeed)) {
    throw new Error('numeric masterSeed must be a safe integer');
  }
  if (!['number', 'string'].includes(typeof masterSeed)) {
    throw new Error('masterSeed must be a string or safe integer');
  }
  return masterSeed;
}

function normalizeJobs(runId, masterSeed, jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('jobs must be a non-empty array');
  const seen = new Set();
  const normalizedJobs = jobs.map((job, index) => {
    requireObject(job, `jobs[${index}]`);
    const id = requireNonEmptyString(job.id, `jobs[${index}].id`);
    if (seen.has(id)) throw new Error(`jobs[${index}].id duplicates ${id}`);
    seen.add(id);
    return { ...jsonClone(job), id };
  });
  const seeds = normalizedJobs.map((job, ordinal) => {
    const material = { kind: 'job', runId, jobId: job.id, ordinal };
    return {
      id: job.id,
      ordinal,
      material,
      seed: deriveDeterministicSeed(masterSeed, material),
    };
  });
  return {
    jobs: normalizedJobs,
    randomization: {
      algorithm: 'sha256-keyed-unit-v1',
      masterSeed: jsonClone(masterSeed),
      jobOrder: normalizedJobs.map((job) => job.id),
      jobs: seeds,
    },
  };
}

function validateRandomDrawContract(metadata, jobOrder) {
  const contract = metadata?.randomDrawContract;
  if (contract === null || contract === undefined) return;
  requireObject(contract, 'metadata.randomDrawContract');
  if (contract.schema !== EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA) {
    throw new Error(`metadata.randomDrawContract.schema must be ${EXPERIMENT_RANDOM_DRAW_CONTRACT_SCHEMA}`);
  }
  if (!Array.isArray(contract.requiredJobIds)) {
    throw new Error('metadata.randomDrawContract.requiredJobIds must be an array');
  }
  const required = contract.requiredJobIds.map((jobId) =>
    requireNonEmptyString(jobId, 'metadata.randomDrawContract.requiredJobIds[]'),
  );
  if (new Set(required).size !== required.length) {
    throw new Error('metadata.randomDrawContract.requiredJobIds must not contain duplicates');
  }
  const knownJobs = new Set(jobOrder);
  for (const jobId of required) {
    if (!knownJobs.has(jobId)) throw new Error(`metadata.randomDrawContract names unknown job ${jobId}`);
  }
  if (!Number.isSafeInteger(contract.minimumPerJob) || contract.minimumPerJob < 1) {
    throw new Error('metadata.randomDrawContract.minimumPerJob must be a positive safe integer');
  }
}

export function validateExperimentRunPlan(plan) {
  requireObject(plan, 'run plan');
  if (plan.schema !== EXPERIMENT_RUN_PLAN_SCHEMA) {
    throw new Error(`run plan schema must be ${EXPERIMENT_RUN_PLAN_SCHEMA}`);
  }
  const runId = requireNonEmptyString(plan.runId, 'runId');
  requireNonEmptyString(plan.createdAt, 'createdAt');
  requireNonEmptyString(plan.runner, 'runner');
  normalizeGitProvenance(plan.provenance);
  normalizeModels(plan.models);
  if (!Array.isArray(plan.requiredObservedModelRoles)) {
    throw new Error('requiredObservedModelRoles must be an array');
  }
  for (const role of plan.requiredObservedModelRoles) {
    requireNonEmptyString(role, 'requiredObservedModelRoles[]');
    if (!Object.hasOwn(plan.models, role)) {
      throw new Error(`required observed model role ${role} is missing from models`);
    }
  }
  const requiredKinds = Array.isArray(plan.requiredHashKinds)
    ? plan.requiredHashKinds.map((kind) => requireNonEmptyString(kind, 'requiredHashKinds[]'))
    : DEFAULT_EXPERIMENT_HASH_KINDS;
  normalizeHashes(plan.hashes, requiredKinds);
  normalizeLineage(plan.lineage);
  requireObject(plan.randomization, 'randomization');
  const masterSeed = normalizeMasterSeed(plan.randomization.masterSeed);
  if (!Array.isArray(plan.jobs) || !plan.jobs.length) throw new Error('jobs must be a non-empty array');
  const rebuilt = normalizeJobs(runId, masterSeed, plan.jobs);
  if (canonicalJson(rebuilt.randomization.jobOrder) !== canonicalJson(plan.randomization.jobOrder)) {
    throw new Error('randomization.jobOrder does not match jobs');
  }
  if (canonicalJson(rebuilt.randomization.jobs) !== canonicalJson(plan.randomization.jobs)) {
    throw new Error('randomization.jobs do not match deterministic per-job seeds');
  }
  validateRandomDrawContract(plan.metadata, rebuilt.randomization.jobOrder);
  return true;
}

export function buildExperimentRunPlan({
  runId,
  createdAt = new Date().toISOString(),
  runner,
  provenance,
  models,
  hashes,
  requiredHashKinds = DEFAULT_EXPERIMENT_HASH_KINDS,
  requiredObservedModelRoles = null,
  masterSeed,
  jobs,
  lineage = {},
  intent = {},
  metadata = {},
} = {}) {
  const normalizedRunId = requireNonEmptyString(runId, 'runId');
  const normalizedSeed = normalizeMasterSeed(masterSeed);
  const normalizedJobs = normalizeJobs(normalizedRunId, normalizedSeed, jobs);
  const normalizedModels = normalizeModels(models);
  const observedRoles = requiredObservedModelRoles ?? Object.keys(normalizedModels);
  if (!Array.isArray(observedRoles)) throw new Error('requiredObservedModelRoles must be an array');
  const plan = {
    schema: EXPERIMENT_RUN_PLAN_SCHEMA,
    runId: normalizedRunId,
    createdAt: requireNonEmptyString(createdAt, 'createdAt'),
    runner: requireNonEmptyString(runner, 'runner'),
    provenance: normalizeGitProvenance(provenance),
    models: normalizedModels,
    requiredObservedModelRoles: [...new Set(observedRoles)].sort(),
    requiredHashKinds: [...new Set(requiredHashKinds)].sort(),
    hashes: normalizeHashes(hashes, requiredHashKinds),
    randomization: normalizedJobs.randomization,
    lineage: normalizeLineage(lineage),
    intent: jsonClone(requireObject(intent, 'intent')),
    metadata: jsonClone(requireObject(metadata, 'metadata')),
    jobs: normalizedJobs.jobs,
  };
  validateExperimentRunPlan(plan);
  return plan;
}

function runPath(runDir, fileName) {
  return path.join(path.resolve(runDir), fileName);
}

function exclusiveWrite(filePath, content, label) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) throw new Error(`Refusing to overwrite immutable ${label} at ${filePath}`);
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${sha256(content).slice(0, 12)}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, content, { flag: 'wx', mode: 0o600 });
    fs.linkSync(temporary, filePath);
  } catch (error) {
    if (error?.code === 'EEXIST' && fs.existsSync(filePath)) {
      throw new Error(`Refusing to overwrite immutable ${label} at ${filePath}`);
    }
    throw error;
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function createRunPlan(runDir, plan) {
  validateExperimentRunPlan(plan);
  const filePath = runPath(runDir, EXPERIMENT_RUN_PLAN_FILE);
  const content = canonicalJson(plan, { space: 2, trailingNewline: true });
  exclusiveWrite(filePath, content, 'run plan');
  return { path: filePath, bytes: Buffer.byteLength(content), sha256: sha256(content), plan: jsonClone(plan) };
}

export function readRunEvents(runDir) {
  const filePath = runPath(runDir, EXPERIMENT_RUN_EVENTS_FILE);
  if (!fs.existsSync(filePath)) return [];
  const rows = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) continue;
    try {
      rows.push(JSON.parse(lines[index]));
    } catch (error) {
      throw new Error(`Invalid run event JSON at line ${index + 1}: ${error.message}`);
    }
  }
  return rows;
}

function eventHashPayload(event) {
  const payload = { ...event };
  delete payload.eventSha256;
  return payload;
}

export function appendRunEvent(runDir, event) {
  requireObject(event, 'run event');
  const planPath = runPath(runDir, EXPERIMENT_RUN_PLAN_FILE);
  if (!fs.existsSync(planPath)) throw new Error(`Cannot append run event before ${EXPERIMENT_RUN_PLAN_FILE}`);
  const sealPath = runPath(runDir, EXPERIMENT_RUN_SEAL_FILE);
  if (fs.existsSync(sealPath)) throw new Error(`Cannot append run event: run is already sealed at ${sealPath}`);
  const previous = readRunEvents(runDir);
  const record = {
    ...jsonClone(event),
    schema: EXPERIMENT_RUN_EVENT_SCHEMA,
    sequence: previous.length + 1,
    recordedAt: requireNonEmptyString(event.recordedAt || new Date().toISOString(), 'run event recordedAt'),
    previousEventSha256: previous.at(-1)?.eventSha256 || null,
  };
  record.type = requireNonEmptyString(event.type, 'run event type');
  record.eventSha256 = hashCanonicalJson(eventHashPayload(record));
  const line = `${canonicalJson(record)}\n`;
  const filePath = runPath(runDir, EXPERIMENT_RUN_EVENTS_FILE);
  const handle = fs.openSync(filePath, 'a', 0o600);
  try {
    fs.writeSync(handle, line);
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  return { path: filePath, event: record, bytesAppended: Buffer.byteLength(line) };
}

function posixRelative(root, filePath) {
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`artifact path must be inside run directory: ${filePath}`);
  }
  return relative.split(path.sep).join('/');
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (
        (entry.name === EXPERIMENT_RUN_SEAL_FILE && entryPath === path.join(root, EXPERIMENT_RUN_SEAL_FILE)) ||
        /^\.run-.*\.tmp$/u.test(entry.name)
      ) {
        continue;
      }
      if (entry.isSymbolicLink()) throw new Error(`run artifacts may not contain symbolic links: ${entryPath}`);
      if (entry.isDirectory()) stack.push(entryPath);
      else if (entry.isFile()) out.push(entryPath);
    }
  }
  return out.sort((left, right) => posixRelative(root, left).localeCompare(posixRelative(root, right)));
}

/**
 * Find every deterministic tutor-stub policy draw embedded in a JSON trace
 * record. New traces carry the canonical draw under `decision`; the fallback
 * keeps already-written v1 compatibility envelopes replayable.
 */
export function extractTutorStubPolicyDrawDecisions(value) {
  const decisions = [];
  const seen = new WeakSet();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (node.schema === TUTOR_STUB_POLICY_DRAW_SCHEMA) {
      const decision = node.decision || {
        schema: DETERMINISTIC_EXPERIMENT_DRAW_SCHEMA,
        algorithm: node.method,
        masterSeed: node.runSeed,
        material: node.material,
        seedMaterial: node.seedMaterial,
        seed: node.seed,
        draw: node.draw,
        distribution: node.distribution,
        selectedIndex: node.selectedIndex,
        selectedValue: node.selectedValue,
      };
      decisions.push(jsonClone(decision));
      return;
    }
    for (const child of Array.isArray(node) ? node : Object.values(node)) visit(child);
  }
  visit(value);
  return decisions;
}

function artifactSchema(filePath) {
  try {
    if (filePath.endsWith('.json')) {
      const value = readJson(filePath);
      return value?.schema || value?.schemaVersion || null;
    }
    if (filePath.endsWith('.jsonl')) {
      const first = fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .find((line) => line.trim());
      if (!first) return null;
      const value = JSON.parse(first);
      return value?.schema || value?.schemaVersion || null;
    }
  } catch {
    return null;
  }
  return null;
}

function inventoryFor(runDir) {
  const root = path.resolve(runDir);
  return walkFiles(root).map((filePath) => {
    const stat = fs.statSync(filePath);
    return {
      path: posixRelative(root, filePath),
      sha256: hashFile(filePath),
      bytes: stat.size,
      schema: artifactSchema(filePath),
    };
  });
}

export function createRunSeal(
  runDir,
  { closedAt = new Date().toISOString(), status = 'complete', metadata = {} } = {},
) {
  const root = path.resolve(runDir);
  const sealPath = runPath(root, EXPERIMENT_RUN_SEAL_FILE);
  if (fs.existsSync(sealPath)) throw new Error(`Refusing to overwrite immutable run seal at ${sealPath}`);
  const planPath = runPath(root, EXPERIMENT_RUN_PLAN_FILE);
  const eventsPath = runPath(root, EXPERIMENT_RUN_EVENTS_FILE);
  if (!fs.existsSync(planPath)) throw new Error(`Cannot seal run without ${EXPERIMENT_RUN_PLAN_FILE}`);
  if (!fs.existsSync(eventsPath)) throw new Error(`Cannot seal run without ${EXPERIMENT_RUN_EVENTS_FILE}`);
  const plan = readJson(planPath);
  validateExperimentRunPlan(plan);
  const events = readRunEvents(root);
  const eventErrors = [];
  verifyEventChain(events, eventErrors);
  if (eventErrors.length) throw new Error(`Cannot seal invalid run events: ${eventErrors.join('; ')}`);
  const inventory = inventoryFor(root);
  const byPath = new Map(inventory.map((entry) => [entry.path, entry]));
  const planEntry = byPath.get(EXPERIMENT_RUN_PLAN_FILE);
  const eventsEntry = byPath.get(EXPERIMENT_RUN_EVENTS_FILE);
  const seal = {
    schema: EXPERIMENT_RUN_SEAL_SCHEMA,
    runId: plan.runId,
    closedAt: requireNonEmptyString(closedAt, 'closedAt'),
    status: requireNonEmptyString(status, 'status'),
    planSha256: planEntry.sha256,
    eventsSha256: eventsEntry.sha256,
    eventCount: events.length,
    inventorySha256: hashCanonicalJson(inventory),
    artifactInventory: inventory,
    metadata: jsonClone(requireObject(metadata, 'seal metadata')),
  };
  const content = canonicalJson(seal, { space: 2, trailingNewline: true });
  exclusiveWrite(sealPath, content, 'run seal');
  return { path: sealPath, bytes: Buffer.byteLength(content), sha256: sha256(content), seal };
}

function verifyEventChain(events, errors) {
  let previous = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.schema !== EXPERIMENT_RUN_EVENT_SCHEMA) errors.push(`event ${index + 1} has invalid schema`);
    if (event.sequence !== index + 1) errors.push(`event ${index + 1} has invalid sequence ${event.sequence}`);
    if (event.previousEventSha256 !== previous) errors.push(`event ${index + 1} breaks the hash chain`);
    const expected = hashCanonicalJson(eventHashPayload(event));
    if (event.eventSha256 !== expected) errors.push(`event ${index + 1} checksum mismatch`);
    previous = event.eventSha256;
  }
}

export function replayRunRandomization(runDir, { enforceDrawContract = true, exemptDrawContractJobIds = null } = {}) {
  const errors = [];
  let plan;
  let events;
  try {
    plan = readJson(runPath(runDir, EXPERIMENT_RUN_PLAN_FILE));
    validateExperimentRunPlan(plan);
  } catch (error) {
    return {
      ok: false,
      errors: [`run plan cannot be replayed: ${error.message}`],
      jobOrder: [],
      jobs: [],
      decisions: [],
    };
  }
  try {
    events = readRunEvents(runDir);
  } catch (error) {
    return {
      ok: false,
      errors: [`run events cannot be replayed: ${error.message}`],
      jobOrder: [],
      jobs: [],
      decisions: [],
    };
  }
  const jobs = plan.randomization.jobs.map((job) => {
    const expectedSeed = deriveDeterministicSeed(plan.randomization.masterSeed, job.material);
    const matches = expectedSeed === job.seed;
    if (!matches) errors.push(`job seed mismatch for ${job.id}`);
    return { ...jsonClone(job), expectedSeed, matches };
  });
  const knownJobIds = new Set(plan.randomization.jobOrder);
  const plannedJobById = new Map(plan.jobs.map((job) => [job.id, job]));
  const decisionsByJob = new Map();
  const decisions = events
    .filter((event) => event.type === 'random_draw')
    .map((event) => {
      try {
        if (canonicalJson(event.decision?.masterSeed) !== canonicalJson(plan.randomization.masterSeed)) {
          errors.push(`random draw master seed differs from frozen plan at event ${event.sequence}`);
        }
        const jobId = typeof event.jobId === 'string' ? event.jobId.trim() : '';
        if (!jobId) errors.push(`random draw at event ${event.sequence} is missing jobId`);
        else if (!knownJobIds.has(jobId))
          errors.push(`random draw at event ${event.sequence} names unknown job ${jobId}`);
        else {
          decisionsByJob.set(jobId, (decisionsByJob.get(jobId) || 0) + 1);
          const job = plannedJobById.get(jobId);
          for (const field of ['profile', 'policy', 'repeat']) {
            if (job?.[field] === undefined) continue;
            if (canonicalJson(event.decision?.material?.[field]) !== canonicalJson(job[field])) {
              errors.push(`random draw ${field} differs from frozen job ${jobId} at event ${event.sequence}`);
            }
          }
        }
        const sourceJobId = event.sourceJobId || jobId;
        const materialJobId = event.decision?.material?.jobId || null;
        if (sourceJobId && materialJobId !== sourceJobId) {
          errors.push(`random draw source job differs from decision material at event ${event.sequence}`);
        }
        const replay = replayDeterministicChoice(event.decision);
        if (!replay.matches) errors.push(`random draw mismatch at event ${event.sequence}`);
        return { sequence: event.sequence, ...replay };
      } catch (error) {
        errors.push(`random draw at event ${event.sequence} cannot be replayed: ${error.message}`);
        return { sequence: event.sequence, matches: false, error: error.message };
      }
    });
  const drawContract = enforceDrawContract ? plan.metadata?.randomDrawContract || null : null;
  if (drawContract) {
    const exempt = exemptDrawContractJobIds instanceof Set ? exemptDrawContractJobIds : null;
    for (const jobId of drawContract.requiredJobIds) {
      // Rows queued for re-run legitimately carry no draw decisions (a failed
      // or window-killed dialogue never drew); exempt exactly those job ids so
      // a partial source can still seed a resume. Every other integrity check
      // still applies to it.
      if (exempt && exempt.has(jobId)) continue;
      const observed = decisionsByJob.get(jobId) || 0;
      if (observed < drawContract.minimumPerJob) {
        errors.push(
          `random draw contract missing decisions for ${jobId}: observed ${observed}, required ${drawContract.minimumPerJob}`,
        );
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    jobOrder: [...plan.randomization.jobOrder],
    jobs,
    decisions,
  };
}

function modelProvider(modelLabel) {
  const normalized = String(modelLabel || '').trim();
  const separator = normalized.indexOf('/');
  return separator > 0 ? normalized.slice(0, separator) : null;
}

function modelContractAcceptsObserved(contract, observed) {
  const allowed = contract.allowedObservedModels || [];
  if (allowed.length) return allowed.includes(observed);
  if (contract.observed) return contract.observed === observed;
  if (contract.resolved === observed) return true;
  if (!contract.allowCliDefaultResolution) return false;
  return modelProvider(contract.resolved) !== null && modelProvider(contract.resolved) === modelProvider(observed);
}

function verifyObservedModelProvenance(plan, events, errors, { requirePresence = true } = {}) {
  const observedByRole = new Map();
  for (const event of events.filter((row) => row.type === 'model_observed')) {
    const role = typeof event.role === 'string' ? event.role.trim() : '';
    if (!role || !Object.hasOwn(plan.models || {}, role)) {
      errors.push(`model observation declares unknown role ${role || '(missing)'}`);
      continue;
    }
    const contract = plan.models[role];
    if (event.requested !== contract.requested) {
      errors.push(
        `model observation requested value for role ${role} differs from frozen plan: ${JSON.stringify(
          event.requested,
        )} != ${JSON.stringify(contract.requested)}`,
      );
    }
    if (event.resolved !== contract.resolved) {
      errors.push(
        `model observation resolved value for role ${role} differs from frozen plan: ${JSON.stringify(
          event.resolved,
        )} != ${JSON.stringify(contract.resolved)}`,
      );
    }
    const observed = typeof event.observed === 'string' ? event.observed.trim() : '';
    if (!observed) {
      errors.push(`model observation for role ${role} is missing observed model`);
      continue;
    }
    if (!modelContractAcceptsObserved(contract, observed)) {
      errors.push(`observed model ${observed} for role ${role} is outside frozen contract ${contract.resolved}`);
    }
    if (!observedByRole.has(role)) observedByRole.set(role, new Set());
    observedByRole.get(role).add(observed);
  }
  for (const [role, observations] of observedByRole) {
    if (observations.size <= 1) continue;
    const contract = plan.models[role];
    const explicitlyAllowed = contract.allowedObservedModels || [];
    if (![...observations].every((observed) => explicitlyAllowed.includes(observed))) {
      errors.push(`conflicting observed models for role ${role}: ${[...observations].sort().join(', ')}`);
    }
  }
  if (!requirePresence) return;
  for (const role of plan.requiredObservedModelRoles || []) {
    if (!observedByRole.get(role)?.size) errors.push(`missing observed model provenance for role ${role}`);
  }
}

/**
 * Verify a sealed experiment run.
 *
 * `completeness: false` switches to integrity-only verification: everything
 * recorded must still be authentic and internally consistent (event hash
 * chain, seal inventory, per-draw replay, observed-model consistency), but
 * the frozen presence contracts (random-draw minimums per job, required
 * observed-model roles) are not enforced, here or in nested runs. Use it when
 * reading evidence out of a sealed-but-incomplete run (e.g. a QA-matrix child
 * whose failed jobs never drew); a run that passes integrity-only but fails
 * the default full verification is honest about being incomplete, not
 * corrupt.
 *
 * `exemptDrawContractJobIds` is narrower: it waives only the required draw
 * minimum for the named jobs in this run. Recorded draws are still replayed,
 * every other job keeps its minimum, and all other completeness and integrity
 * checks remain active. Resume uses this only for rows it will replace in a
 * new sealed sibling transaction.
 */
export function verifyExperimentRun(runDir, { completeness = true, exemptDrawContractJobIds = null } = {}) {
  const root = path.resolve(runDir);
  const errors = [];
  const warnings = [];
  let plan = null;
  let seal = null;
  let events = [];
  try {
    plan = readJson(runPath(root, EXPERIMENT_RUN_PLAN_FILE));
    validateExperimentRunPlan(plan);
  } catch (error) {
    errors.push(`invalid or missing ${EXPERIMENT_RUN_PLAN_FILE}: ${error.message}`);
  }
  try {
    events = readRunEvents(root);
    if (!events.length) errors.push(`${EXPERIMENT_RUN_EVENTS_FILE} contains no events`);
    verifyEventChain(events, errors);
  } catch (error) {
    errors.push(`invalid or missing ${EXPERIMENT_RUN_EVENTS_FILE}: ${error.message}`);
  }
  try {
    seal = readJson(runPath(root, EXPERIMENT_RUN_SEAL_FILE));
    if (seal.schema !== EXPERIMENT_RUN_SEAL_SCHEMA) errors.push(`invalid ${EXPERIMENT_RUN_SEAL_FILE} schema`);
  } catch (error) {
    errors.push(`invalid or missing ${EXPERIMENT_RUN_SEAL_FILE}: ${error.message}`);
  }

  let actualInventory = [];
  if (seal) {
    try {
      actualInventory = inventoryFor(root);
      const sealedInventory = Array.isArray(seal.artifactInventory) ? seal.artifactInventory : [];
      const actualByPath = new Map(actualInventory.map((entry) => [entry.path, entry]));
      const sealedByPath = new Map(sealedInventory.map((entry) => [entry.path, entry]));
      if (sealedByPath.size !== sealedInventory.length) errors.push('run seal contains duplicate artifact paths');
      for (const entry of sealedInventory) {
        const actual = actualByPath.get(entry.path);
        if (!actual) {
          errors.push(`missing sealed artifact ${entry.path}`);
          continue;
        }
        if (actual.sha256 !== entry.sha256) errors.push(`checksum mismatch for sealed artifact ${entry.path}`);
        if (actual.bytes !== entry.bytes) errors.push(`byte-count mismatch for sealed artifact ${entry.path}`);
        if ((actual.schema || null) !== (entry.schema || null))
          errors.push(`schema mismatch for sealed artifact ${entry.path}`);
      }
      for (const entry of actualInventory) {
        if (!sealedByPath.has(entry.path)) errors.push(`unsealed artifact ${entry.path}`);
      }
      if (seal.inventorySha256 !== hashCanonicalJson(sealedInventory))
        errors.push('artifact inventory checksum mismatch');
      if (seal.planSha256 !== sealedByPath.get(EXPERIMENT_RUN_PLAN_FILE)?.sha256)
        errors.push('plan checksum mismatch in seal');
      if (seal.eventsSha256 !== sealedByPath.get(EXPERIMENT_RUN_EVENTS_FILE)?.sha256)
        errors.push('events checksum mismatch in seal');
      if (seal.eventCount !== events.length) errors.push('event count mismatch in seal');
      if (plan && seal.runId !== plan.runId) errors.push('run id mismatch between plan and seal');
    } catch (error) {
      errors.push(`artifact inventory verification failed: ${error.message}`);
    }
  }

  if (seal && actualInventory.length) {
    for (const entry of actualInventory.filter((artifact) => artifact.path.endsWith(`/${EXPERIMENT_RUN_SEAL_FILE}`))) {
      const childDir = path.dirname(path.join(root, entry.path));
      const childVerification = verifyExperimentRun(childDir, { completeness });
      if (!childVerification.ok) {
        errors.push(
          `nested run ${path.relative(root, childDir).split(path.sep).join('/')} failed verification: ${childVerification.errors.join('; ')}`,
        );
      } else if (plan && childVerification.plan?.lineage?.parentRunId !== plan.runId) {
        errors.push(
          `nested run ${path.relative(root, childDir).split(path.sep).join('/')} declares parent ${
            childVerification.plan?.lineage?.parentRunId || '(missing)'
          }; expected ${plan.runId}`,
        );
      }
    }
  }

  const replay = replayRunRandomization(root, { enforceDrawContract: completeness, exemptDrawContractJobIds });
  if (!replay.ok) errors.push(...replay.errors);
  if (plan) verifyObservedModelProvenance(plan, events, errors, { requirePresence: completeness });
  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
    eventCount: events.length,
    inventory: actualInventory,
    plan,
    seal,
    replay,
  };
}

export function assertExperimentRun(runDir, options = {}) {
  const verification = verifyExperimentRun(runDir, options);
  if (!verification.ok) {
    throw new Error(`Experiment run verification failed:\n- ${verification.errors.join('\n- ')}`);
  }
  return verification;
}

function git(repoRoot, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trimEnd();
  } catch (error) {
    if (allowFailure) return null;
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr || error.message}`);
  }
}

export function captureGitProvenanceSummary({ repoRoot = process.cwd() } = {}) {
  // Light per-run header stamp (sha/branch/dirty only). Sealed experiment
  // runs must keep using captureGitFingerprint, which additionally hashes
  // the working-tree status, patch, and untracked files.
  const root = path.resolve(git(repoRoot, ['rev-parse', '--show-toplevel']));
  const sha = requireNonEmptyString(git(root, ['rev-parse', 'HEAD']), 'Git SHA');
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true }) || '(detached)';
  const status = git(root, ['status', '--porcelain=v1']);
  return { sha, branch, dirty: Boolean(status) };
}

export function captureGitFingerprint({ repoRoot = process.cwd() } = {}) {
  const root = path.resolve(git(repoRoot, ['rev-parse', '--show-toplevel']));
  const sha = requireNonEmptyString(git(root, ['rev-parse', 'HEAD']), 'Git SHA');
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { allowFailure: true }) || '(detached)';
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const patch = git(root, ['diff', '--binary', '--no-ext-diff', 'HEAD', '--']);
  const untrackedPaths = status
    .split('\0')
    .filter((row) => row.startsWith('?? '))
    .map((row) => row.slice(3))
    .sort();
  const untracked = untrackedPaths.map((relative) => {
    const filePath = path.resolve(root, relative);
    const safeRelative = path.relative(root, filePath);
    if (safeRelative.startsWith('..') || path.isAbsolute(safeRelative)) {
      throw new Error(`untracked Git path escapes repository: ${relative}`);
    }
    const stat = fs.statSync(filePath);
    return { path: relative.split(path.sep).join('/'), bytes: stat.size, sha256: hashFile(filePath) };
  });
  const statusSha256 = sha256(status);
  const patchSha256 = sha256(patch);
  const fingerprintSha256 = hashCanonicalJson({ sha, branch, statusSha256, patchSha256, untracked });
  return {
    sha,
    branch,
    dirty: Boolean(status),
    statusSha256,
    patchSha256,
    untracked,
    fingerprintSha256,
    repoRoot: root,
  };
}
