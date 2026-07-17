import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TUTOR_STUB_TUNING_RUNTIME_SCHEMA = 'machinespirits.tutor-stub.tuning-runtime.v1';
export const TUTOR_STUB_TUNING_VERSION_SCHEMA = 'machinespirits.tutor-stub.tutor-version.v1';
export const TUTOR_STUB_TUNING_CANDIDATE_SCHEMA = 'machinespirits.tutor-stub.tuning-candidate.v1';
export const TUTOR_STUB_TUNING_REPLAY_SCHEMA = 'machinespirits.tutor-stub.tuning-replay-plan.v1';

export const TUTOR_STUB_TUNING_MODES = ['off', 'capture', 'on', 'canary'];
export const TUTOR_STUB_FEEDBACK_REASONS = {
  ignored_me: {
    label: 'did not respond to me',
    scope: 'tutor_policy',
    rule: 'Begin by answering or accurately acknowledging the learner’s specific words; only then develop the lesson.',
  },
  too_abstract: {
    label: 'too abstract',
    scope: 'tutor_prompt',
    rule: 'Replace abstract instructional labels with the concrete people, objects, records, and actions already public in the scene.',
  },
  repetitive: {
    label: 'repetitive',
    scope: 'tutor_policy',
    rule: 'Do not restate the previous question or clue frame; acknowledge what is settled and make the next public move observably different.',
  },
  too_slow: {
    label: 'too slow',
    scope: 'learner_preference',
    rule: 'When the learner asks to move faster, shorten the acknowledgement and advance one available clue without demanding an already implied bridge.',
  },
  too_fast: {
    label: 'too fast',
    scope: 'learner_preference',
    rule: 'When the learner signals overload, pause release, restate the last concrete clue plainly, and ask what needs clarifying.',
  },
  unsupported_question: {
    label: 'could not know the answer',
    scope: 'guard_or_policy',
    rule: 'Before asking a question, ensure its answer is supported by public discourse; otherwise supply a clue, bounded choice, or concrete example first.',
  },
  broke_character: {
    label: 'broke character',
    scope: 'tutor_prompt',
    rule: 'Perform the selected public part directly; never announce role-play, describe the part from outside it, or refer to the tutor or learner.',
  },
  helpful_acknowledgement: {
    label: 'good acknowledgement',
    scope: 'positive_evidence',
    rule: null,
  },
  helpful_pacing: {
    label: 'good pacing',
    scope: 'positive_evidence',
    rule: null,
  },
  custom: {
    label: 'other',
    scope: 'manual_review',
    rule: null,
  },
};

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function hash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function now() {
  return new Date().toISOString();
}

function cleanLine(value, max = 500) {
  return String(value || '')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, max);
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function appendJsonl(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`);
}

export function resolveTutorStubTuningDir(value = null) {
  const selected = cleanLine(value || process.env.TUTOR_STUB_TUNING_DIR || '.tutor-stub-tuning', 2000);
  return path.isAbsolute(selected) ? selected : path.join(ROOT, selected);
}

export function normalizeTutorStubTuningMode(value) {
  const normalized = cleanLine(value || 'off').toLowerCase();
  const alias = normalized === 'session' ? 'on' : normalized;
  if (!TUTOR_STUB_TUNING_MODES.includes(alias)) {
    throw new Error(`tuning mode must be one of ${TUTOR_STUB_TUNING_MODES.join(', ')}`);
  }
  return alias;
}

export function normalizeTutorStubFeedbackReason(value, rating = null) {
  const normalized = cleanLine(value)
    .toLowerCase()
    .replace(/[\s-]+/gu, '_');
  if (!normalized) return null;
  if (!TUTOR_STUB_FEEDBACK_REASONS[normalized]) {
    throw new Error(`unknown feedback reason "${value}"; use ${Object.keys(TUTOR_STUB_FEEDBACK_REASONS).join(', ')}`);
  }
  if (rating === 'up' && !normalized.startsWith('helpful_') && normalized !== 'custom') {
    return 'custom';
  }
  return normalized;
}

function tutorDir(root, tutorId) {
  return path.join(root, 'tutors', tutorId);
}

function manifestPath(root, tutorId) {
  return path.join(tutorDir(root, tutorId), 'manifest.json');
}

function versionPath(root, tutorId, version) {
  return path.join(tutorDir(root, tutorId), 'versions', `v${String(version).padStart(3, '0')}.json`);
}

function candidatePath(root, tutorId, candidateId) {
  return path.join(tutorDir(root, tutorId), 'candidates', `${candidateId}.json`);
}

function sourceVersion(instance) {
  return {
    schema: TUTOR_STUB_TUNING_VERSION_SCHEMA,
    tutorId: instance.id,
    version: instance.sourceVersion,
    parentVersion: null,
    createdAt: null,
    source: 'repository',
    rolePromptHash: instance.rolePromptHash,
    promptBook: [],
    policyRules: [],
    modelDefaults: clone(instance.modelDefaults || {}),
    candidateIds: [],
  };
}

function initialManifest(instance) {
  return {
    schema: 'machinespirits.tutor-stub.tuning-manifest.v1',
    tutorId: instance.id,
    title: instance.title,
    sourceVersion: instance.sourceVersion,
    sourceRolePromptHash: instance.rolePromptHash,
    stableVersion: instance.sourceVersion,
    canaryVersion: null,
    previousStableVersions: [],
    createdAt: now(),
    updatedAt: now(),
  };
}

function ensureStore(instance, root, { write = true } = {}) {
  const manifestFile = manifestPath(root, instance.id);
  if (fs.existsSync(manifestFile)) {
    const existing = readJson(manifestFile);
    if (
      Number(existing.sourceVersion) === Number(instance.sourceVersion) &&
      existing.sourceRolePromptHash &&
      existing.sourceRolePromptHash !== instance.rolePromptHash
    ) {
      throw new Error(
        `${instance.id}@v${instance.sourceVersion} changed after its local tuning store was created; bump source_version or use a fresh tuning store`,
      );
    }
    return existing;
  }
  const manifest = initialManifest(instance);
  if (write) {
    writeJson(manifestFile, manifest);
    writeJson(versionPath(root, instance.id, instance.sourceVersion), sourceVersion(instance));
    appendJsonl(path.join(tutorDir(root, instance.id), 'ledger.jsonl'), {
      at: now(),
      type: 'initialize',
      tutorId: instance.id,
      version: instance.sourceVersion,
      rolePromptHash: instance.rolePromptHash,
    });
  }
  return manifest;
}

function loadVersion(instance, root, version) {
  const file = versionPath(root, instance.id, version);
  if (fs.existsSync(file)) return readJson(file);
  if (Number(version) === Number(instance.sourceVersion)) return sourceVersion(instance);
  throw new Error(`${instance.id} has no tutor version v${version}`);
}

export function createTutorStubTuningRuntime({ instance, mode = 'off', dir = null, write = true } = {}) {
  if (!instance?.id) throw new Error('a resolved tutor instance is required for tuning');
  const normalizedMode = normalizeTutorStubTuningMode(mode);
  const root = resolveTutorStubTuningDir(dir);
  const manifest = ensureStore(instance, root, { write: Boolean(write && normalizedMode !== 'off') });
  if (normalizedMode === 'canary' && !manifest.canaryVersion) {
    throw new Error(`${instance.id} has no approved canary; use /tune approve <candidate> first`);
  }
  const selectedVersion =
    instance.requestedVersion ??
    (normalizedMode === 'canary' && manifest.canaryVersion ? manifest.canaryVersion : manifest.stableVersion);
  const version = loadVersion(instance, root, selectedVersion);
  return {
    schema: TUTOR_STUB_TUNING_RUNTIME_SCHEMA,
    mode: normalizedMode,
    enabled: normalizedMode !== 'off',
    captureEnabled: normalizedMode !== 'off',
    tutorId: instance.id,
    tutorTitle: instance.title,
    root,
    writeEnabled: Boolean(write),
    manifest,
    version,
    activeVersion: version.version,
    activeRef: `${instance.id}@v${version.version}`,
    sourceRolePromptHash: instance.rolePromptHash,
    sessionCandidateIds: [],
    sessionFeedbackCount: 0,
    sessionNotes: [],
  };
}

export function setTutorStubTuningMode(runtime, mode, { instance = null } = {}) {
  const normalized = normalizeTutorStubTuningMode(mode);
  if (
    normalized === 'canary' &&
    (!runtime.manifest?.canaryVersion || Number(runtime.activeVersion) !== Number(runtime.manifest.canaryVersion))
  ) {
    throw new Error('restart with --tuning canary to pin the approved canary before the dialogue begins');
  }
  runtime.mode = normalized;
  runtime.enabled = normalized !== 'off';
  runtime.captureEnabled = normalized !== 'off';
  if (instance && normalized !== 'off') {
    runtime.manifest = ensureStore(instance, runtime.root, { write: runtime.writeEnabled });
  }
  return tutorStubTuningSnapshot(runtime);
}

export function tutorStubTuningPrompt(runtime) {
  if (!runtime?.version) return '';
  const notes = Array.isArray(runtime.version.promptBook) ? runtime.version.promptBook : [];
  const rules = Array.isArray(runtime.version.policyRules) ? runtime.version.policyRules : [];
  if (!notes.length && !rules.length) return '';
  return [
    `[Reviewed tutor memory — ${runtime.activeRef}]`,
    ...notes.map((note) => `- Craft note: ${cleanLine(note)}`),
    ...rules.map((rule) => `- Operational rule: ${cleanLine(rule)}`),
    'These reviewed notes never override public-evidence, release, safety, or closure constraints.',
    '[End reviewed tutor memory]',
  ].join('\n');
}

export function tutorStubTuningTurnAdvisory(runtime) {
  if (!runtime?.enabled) return '';
  const recent = runtime.sessionNotes.slice(-2).map((note) => cleanLine(note.text));
  if (!recent.length) return '';
  return [
    '[Private tuning-session observation]',
    ...recent.map((note) => `- ${note}`),
    'Use this only as provisional craft guidance for the current session. Do not mention it publicly.',
    '[End tuning-session observation]',
  ].join('\n');
}

export function recordTutorStubTuningNote(runtime, text, provenance = {}) {
  if (!runtime?.enabled) throw new Error('tuning mode is off; use /tune on first');
  const note = {
    schema: 'machinespirits.tutor-stub.tuning-note.v1',
    id: `note-${hash(`${runtime.tutorId}|${now()}|${text}`).slice(0, 12)}`,
    at: now(),
    text: cleanLine(text),
    provenance: clone(provenance),
  };
  if (!note.text) throw new Error('tuning note cannot be empty');
  runtime.sessionNotes.push(note);
  if (runtime.writeEnabled) appendJsonl(path.join(tutorDir(runtime.root, runtime.tutorId), 'notes.jsonl'), note);
  return note;
}

export function recordTutorStubTuningFeedback(runtime, observation) {
  if (!runtime?.captureEnabled || !observation) return null;
  const record = {
    ...clone(observation),
    tutor: { id: runtime.tutorId, version: runtime.activeVersion, ref: runtime.activeRef },
  };
  runtime.sessionFeedbackCount += 1;
  if (runtime.writeEnabled) {
    appendJsonl(path.join(tutorDir(runtime.root, runtime.tutorId), 'feedback.jsonl'), record);
  }
  return record;
}

function candidateProposal(reason) {
  const definition = TUTOR_STUB_FEEDBACK_REASONS[reason] || TUTOR_STUB_FEEDBACK_REASONS.custom;
  if (!definition.rule) {
    return {
      kind: 'manual_review',
      scope: definition.scope,
      rule: null,
      explanation: 'The evidence is retained, but no prompt change is compiled automatically from free-form feedback.',
    };
  }
  return {
    kind: definition.scope === 'tutor_prompt' ? 'prompt_note' : 'policy_rule',
    scope: definition.scope,
    rule: definition.rule,
    explanation: `Compile the typed ${definition.label} signal as a bounded ${definition.scope.replace(/_/gu, ' ')} candidate.`,
  };
}

export function synthesizeTutorStubTuningCandidate(
  runtime,
  {
    rating,
    reason = null,
    comment = '',
    observation = null,
    publicMessages = [],
    runId = null,
    targetTurnId = null,
    systemPromptHash = null,
    systemPrompt = null,
    speaker = null,
  } = {},
) {
  if (!runtime?.enabled || runtime.mode === 'capture') return null;
  const normalizedRating = cleanLine(rating).toLowerCase();
  if (normalizedRating !== 'down') return null;
  const normalizedReason = normalizeTutorStubFeedbackReason(reason || 'custom', normalizedRating) || 'custom';
  const proposal = candidateProposal(normalizedReason);
  const fingerprint = hash(
    JSON.stringify({
      tutorId: runtime.tutorId,
      version: runtime.activeVersion,
      runId,
      targetTurnId,
      normalizedReason,
      comment,
    }),
  );
  const id = `cand-${fingerprint.slice(0, 12)}`;
  const replay = {
    schema: TUTOR_STUB_TUNING_REPLAY_SCHEMA,
    candidateId: id,
    tutorRef: runtime.activeRef,
    runId,
    targetTurnId,
    systemPromptHash,
    publicMessages: clone(publicMessages),
    candidateOverlay: proposal.rule,
    speakerRequest: {
      systemPrompt: String(systemPrompt || ''),
      messages: clone(publicMessages),
      userPrompt: String(speaker?.userPrompt || ''),
      modelRef: speaker?.modelRef || null,
      provider: speaker?.provider || null,
      model: speaker?.model || null,
      temperature: speaker?.temperature ?? null,
      maxTokens: speaker?.maxTokens ?? null,
      effort: speaker?.effort || null,
    },
    comparison: 'frozen_public_prefix_baseline_vs_candidate',
    generatedResponses: [],
    judgments: [],
  };
  const candidate = {
    schema: TUTOR_STUB_TUNING_CANDIDATE_SCHEMA,
    id,
    tutorId: runtime.tutorId,
    baseVersion: runtime.activeVersion,
    status: proposal.rule ? 'approval_required' : 'insufficient_evidence',
    createdAt: now(),
    evidence: {
      rating: normalizedRating,
      reason: normalizedReason,
      reasonLabel: TUTOR_STUB_FEEDBACK_REASONS[normalizedReason].label,
      comment: cleanLine(comment),
      observation: clone(observation),
    },
    proposal,
    replay,
    canaryVersion: null,
    validation: null,
    promotedVersion: null,
  };
  const file = candidatePath(runtime.root, runtime.tutorId, id);
  if (runtime.writeEnabled) {
    if (!fs.existsSync(file)) writeJson(file, candidate);
    writeJson(path.join(tutorDir(runtime.root, runtime.tutorId), 'replays', `${id}.json`), replay);
    appendJsonl(path.join(tutorDir(runtime.root, runtime.tutorId), 'ledger.jsonl'), {
      at: now(),
      type: 'candidate_created',
      candidateId: id,
      status: candidate.status,
      reason: normalizedReason,
    });
  }
  if (!runtime.sessionCandidateIds.includes(id)) runtime.sessionCandidateIds.push(id);
  return candidate;
}

export function listTutorStubTuningCandidates(runtime) {
  const dir = path.join(tutorDir(runtime.root, runtime.tutorId), 'candidates');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(dir, name)));
}

export function readTutorStubTuningCandidate(runtime, id) {
  const file = candidatePath(runtime.root, runtime.tutorId, cleanLine(id));
  if (!fs.existsSync(file)) throw new Error(`unknown tuning candidate "${id}"`);
  return readJson(file);
}

function saveCandidate(runtime, candidate, event) {
  writeJson(candidatePath(runtime.root, runtime.tutorId, candidate.id), candidate);
  appendJsonl(path.join(tutorDir(runtime.root, runtime.tutorId), 'ledger.jsonl'), {
    at: now(),
    candidateId: candidate.id,
    ...event,
  });
  return candidate;
}

export function approveTutorStubTuningCandidate(runtime, id) {
  if (!runtime?.writeEnabled) throw new Error('tuning writes are disabled');
  const candidate = readTutorStubTuningCandidate(runtime, id);
  if (!candidate.proposal?.rule) throw new Error('candidate has no compilable rule');
  if (candidate.status !== 'approval_required') {
    throw new Error(`candidate ${id} is ${candidate.status}, not awaiting approval`);
  }
  const manifest = readJson(manifestPath(runtime.root, runtime.tutorId));
  if (Number(candidate.baseVersion) !== Number(manifest.stableVersion)) {
    throw new Error(
      `candidate was built from v${candidate.baseVersion}, but stable is now v${manifest.stableVersion}; replay and create a fresh candidate`,
    );
  }
  const parent = loadVersion(
    { id: runtime.tutorId, sourceVersion: manifest.sourceVersion, modelDefaults: {} },
    runtime.root,
    candidate.baseVersion,
  );
  const existing = [...(parent.policyRules || []), ...(parent.promptBook || [])];
  if (existing.includes(candidate.proposal.rule))
    throw new Error('candidate rule is already present in the stable tutor');
  const versionsDir = path.join(tutorDir(runtime.root, runtime.tutorId), 'versions');
  const versions = fs.existsSync(versionsDir)
    ? fs
        .readdirSync(versionsDir)
        .map((name) => Number(name.match(/^v(\d+)\.json$/u)?.[1]))
        .filter(Number.isFinite)
    : [manifest.sourceVersion];
  const nextVersion = Math.max(...versions, manifest.sourceVersion) + 1;
  const next = {
    ...clone(parent),
    schema: TUTOR_STUB_TUNING_VERSION_SCHEMA,
    version: nextVersion,
    parentVersion: parent.version,
    createdAt: now(),
    source: 'approved_tuning_candidate',
    promptBook:
      candidate.proposal.kind === 'prompt_note'
        ? [...(parent.promptBook || []), candidate.proposal.rule]
        : [...(parent.promptBook || [])],
    policyRules:
      candidate.proposal.kind === 'policy_rule'
        ? [...(parent.policyRules || []), candidate.proposal.rule]
        : [...(parent.policyRules || [])],
    candidateIds: [...(parent.candidateIds || []), candidate.id],
  };
  writeJson(versionPath(runtime.root, runtime.tutorId, nextVersion), next);
  manifest.canaryVersion = nextVersion;
  manifest.updatedAt = now();
  writeJson(manifestPath(runtime.root, runtime.tutorId), manifest);
  candidate.status = 'canary';
  candidate.canaryVersion = nextVersion;
  saveCandidate(runtime, candidate, { type: 'candidate_approved_to_canary', version: nextVersion });
  runtime.manifest = manifest;
  return { candidate, version: next };
}

export function validateTutorStubTuningCandidate(runtime, id, rating, note = '') {
  if (!runtime?.writeEnabled) throw new Error('tuning writes are disabled');
  const candidate = readTutorStubTuningCandidate(runtime, id);
  if (candidate.status !== 'canary') throw new Error('candidate must be approved to canary before validation');
  const normalized = cleanLine(rating).toLowerCase();
  if (!['up', 'down'].includes(normalized)) throw new Error('candidate validation must be up or down');
  candidate.validation = { at: now(), rating: normalized, note: cleanLine(note), source: 'human_replay_judgment' };
  candidate.status = normalized === 'up' ? 'validated' : 'rejected';
  return saveCandidate(runtime, candidate, { type: 'candidate_validated', rating: normalized });
}

export function promoteTutorStubTuningCandidate(runtime, id) {
  if (!runtime?.writeEnabled) throw new Error('tuning writes are disabled');
  const candidate = readTutorStubTuningCandidate(runtime, id);
  if (candidate.validation?.rating !== 'up' || !candidate.canaryVersion) {
    throw new Error('candidate must be approved to canary and validated helpful before promotion');
  }
  const manifest = readJson(manifestPath(runtime.root, runtime.tutorId));
  manifest.previousStableVersions = [...(manifest.previousStableVersions || []), manifest.stableVersion];
  manifest.stableVersion = candidate.canaryVersion;
  manifest.canaryVersion = null;
  manifest.updatedAt = now();
  writeJson(manifestPath(runtime.root, runtime.tutorId), manifest);
  candidate.status = 'promoted';
  candidate.promotedVersion = candidate.canaryVersion;
  candidate.promotedAt = now();
  saveCandidate(runtime, candidate, { type: 'candidate_promoted', version: candidate.promotedVersion });
  runtime.manifest = manifest;
  return candidate;
}

export function rejectTutorStubTuningCandidate(runtime, id, note = '') {
  if (!runtime?.writeEnabled) throw new Error('tuning writes are disabled');
  const candidate = readTutorStubTuningCandidate(runtime, id);
  candidate.status = 'rejected';
  candidate.rejectedAt = now();
  candidate.rejectionNote = cleanLine(note);
  return saveCandidate(runtime, candidate, { type: 'candidate_rejected' });
}

export function rollbackTutorStubTutorVersion(runtime, requestedVersion = null) {
  if (!runtime?.writeEnabled) throw new Error('tuning writes are disabled');
  const manifest = readJson(manifestPath(runtime.root, runtime.tutorId));
  const target =
    requestedVersion === null
      ? manifest.previousStableVersions?.at(-1)
      : Number(String(requestedVersion).replace(/^v/iu, ''));
  if (!Number.isInteger(target)) throw new Error('no previous stable tutor version is available');
  loadVersion({ id: runtime.tutorId, sourceVersion: manifest.sourceVersion, modelDefaults: {} }, runtime.root, target);
  const previous = manifest.stableVersion;
  manifest.stableVersion = target;
  manifest.canaryVersion = null;
  manifest.previousStableVersions = (manifest.previousStableVersions || []).filter((version) => version !== target);
  manifest.updatedAt = now();
  writeJson(manifestPath(runtime.root, runtime.tutorId), manifest);
  appendJsonl(path.join(tutorDir(runtime.root, runtime.tutorId), 'ledger.jsonl'), {
    at: now(),
    type: 'rollback',
    fromVersion: previous,
    toVersion: target,
  });
  runtime.manifest = manifest;
  return { fromVersion: previous, toVersion: target };
}

export function tutorStubTuningReplayPath(runtime, id) {
  const file = path.join(tutorDir(runtime.root, runtime.tutorId), 'replays', `${cleanLine(id)}.json`);
  if (!fs.existsSync(file)) throw new Error(`no replay plan for "${id}"`);
  return file;
}

export function tutorStubTuningSnapshot(runtime) {
  if (!runtime) return null;
  return {
    schema: TUTOR_STUB_TUNING_RUNTIME_SCHEMA,
    mode: runtime.mode,
    enabled: runtime.enabled,
    tutorId: runtime.tutorId,
    tutorTitle: runtime.tutorTitle,
    activeVersion: runtime.activeVersion,
    activeRef: runtime.activeRef,
    stableVersion: runtime.manifest?.stableVersion ?? null,
    canaryVersion: runtime.manifest?.canaryVersion ?? null,
    sourceRolePromptHash: runtime.sourceRolePromptHash,
    promptBookEntries: runtime.version?.promptBook?.length || 0,
    policyRuleCount: runtime.version?.policyRules?.length || 0,
    sessionFeedbackCount: runtime.sessionFeedbackCount || 0,
    sessionCandidateIds: [...(runtime.sessionCandidateIds || [])],
    sessionNotes: clone(runtime.sessionNotes || []),
    storeDir: runtime.root,
  };
}
