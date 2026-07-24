/**
 * Consolidated human-labelling datasets.
 *
 * The superego-taxonomy adapter deliberately delegates to humanCodingStore so
 * its analyzer-compatible CSV contract remains unchanged. The tutor-stub
 * impasse corpus uses a JSON rater sidecar because its labels are multi-field
 * and Phase II will need the full structured judgment.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getCodebook as getHumanCodingCodebook,
  getComparison as getHumanCodingComparison,
  getItems as getHumanCodingItems,
  getStatus as getHumanCodingStatus,
  HumanCodingError,
  safeCoderId,
  saveCoding as saveHumanCoding,
} from './humanCodingStore.js';
import {
  CODER_IDENTITY_SCHEMA,
  coderArtifactToken,
  coderIdFromArtifactToken,
  legacyImpasseCoderKey,
} from './labellingCoderIdentity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const LABELLING_GAME_DATASETS = Object.freeze({
  SUPEREGO_TAXONOMY: 'superego-taxonomy',
  TUTOR_STUB_IMPASSES: 'tutor-stub-impasses',
});

const DEFAULT_IMPASSE_SOURCE = path.join(ROOT, 'notes', 'impasse', '2026-07-17-phase1-episodes.json');
const DEFAULT_IMPASSE_OUTPUT_DIR = path.join(ROOT, 'exports');
const IMPASSE_RATER_PREFIX = 'impasse-corpus-phase1-rater-';

export const IMPASSE_TYPES = Object.freeze([
  {
    id: 'comprehension',
    name: 'Comprehension',
    definition: "The learner did not understand the tutor's words or request.",
  },
  {
    id: 'task_framing',
    name: 'Task framing',
    definition: 'The words were understandable, but the required move or purpose of the activity was not.',
  },
  {
    id: 'affective',
    name: 'Affective',
    definition: 'Frustration, irritation, embarrassment, or withdrawal drove the breakdown.',
  },
  {
    id: 'pacing_stall',
    name: 'Pacing or stall',
    definition: 'The exchange looped, repeated, or stopped making progress.',
  },
  {
    id: 'uptake_echo',
    name: 'Uptake or echo',
    definition: 'The tutor ignored, misread, or merely echoed the learner contribution, or induced parroting.',
  },
  {
    id: 'other',
    name: 'Other',
    definition: 'A communicative breakdown not covered by the other types; explain it in notes.',
  },
]);

const IMPASSE_TYPE_IDS = new Set(IMPASSE_TYPES.map((entry) => entry.id));
const IMPASSE_VALUES = new Set(['yes', 'no']);
const ADDRESSED_VALUES = new Set(['yes', 'partly', 'no']);
const RESOLUTION_VALUES = new Set(['yes', 'no', 'session_ended']);

function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

function normalizeDatasetId(datasetId) {
  const value = String(datasetId || LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY)
    .trim()
    .toLowerCase();
  const aliases = new Map([
    ['taxonomy', LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY],
    ['superego', LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY],
    ['human-validation', LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY],
    ['impasse', LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES],
    ['impasses', LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES],
    ['tutor-stub', LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES],
  ]);
  const resolved = aliases.get(value) || value;
  if (!Object.values(LABELLING_GAME_DATASETS).includes(resolved)) {
    throw new HumanCodingError(`unknown labelling dataset: ${datasetId}`, {
      status: 404,
      code: 'unknown_labelling_dataset',
    });
  }
  return resolved;
}

function resolveImpasseWorkspace(env = process.env) {
  return {
    sourcePath: path.resolve(env.LABELLING_GAME_IMPASSE_DATASET || DEFAULT_IMPASSE_SOURCE),
    outputDir: path.resolve(
      env.LABELLING_GAME_IMPASSE_OUTPUT_DIR || env.EVAL_EXPORTS_DIR || DEFAULT_IMPASSE_OUTPUT_DIR,
    ),
  };
}

function impasseRaterPath(workspace, coderId) {
  return path.join(workspace.outputDir, `${IMPASSE_RATER_PREFIX}${coderArtifactToken(safeCoderId(coderId))}.json`);
}

function legacyImpasseRaterPath(workspace, coderId) {
  const legacyKey = legacyImpasseCoderKey(coderId);
  return legacyKey ? path.join(workspace.outputDir, `${IMPASSE_RATER_PREFIX}${legacyKey}.json`) : null;
}

function readImpasseCorpus(workspace) {
  if (!fs.existsSync(workspace.sourcePath)) {
    throw new HumanCodingError(`impasse dataset not found: ${repoRel(workspace.sourcePath)}`, {
      status: 404,
      code: 'impasse_dataset_missing',
    });
  }
  const parsed = JSON.parse(fs.readFileSync(workspace.sourcePath, 'utf8'));
  if (!Array.isArray(parsed.episodes)) {
    throw new HumanCodingError('impasse dataset has no episodes[] array', {
      status: 422,
      code: 'invalid_impasse_dataset',
    });
  }
  return parsed;
}

function emptyImpasseCoding(itemId) {
  return {
    item_id: itemId,
    impasse: '',
    impasse_types: [],
    tutor_addressed: '',
    resolved_within_2: '',
    notes: '',
  };
}

function readImpasseRater(workspace, coderId) {
  const filePath = impasseRaterPath(workspace, coderId);
  const legacyPath = legacyImpasseRaterPath(workspace, coderId);
  if (legacyPath && fs.existsSync(legacyPath)) {
    throw new HumanCodingError('legacy coder artifact must be migrated before it can be edited', {
      status: 409,
      code: fs.existsSync(filePath) ? 'coder_artifact_collision' : 'coder_artifact_migration_required',
      details: {
        legacy_path: repoRel(legacyPath),
        current_path: fs.existsSync(filePath) ? repoRel(filePath) : null,
        migration_command: 'npm run labelling-game:coder-artifacts -- --check',
      },
    });
  }
  if (!fs.existsSync(filePath)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const expectedCoderId = safeCoderId(coderId);
  if (
    safeCoderId(parsed.coder_id) !== expectedCoderId ||
    parsed.coder_identity?.schema !== CODER_IDENTITY_SCHEMA ||
    parsed.coder_identity?.artifact_token !== coderArtifactToken(expectedCoderId)
  ) {
    throw new HumanCodingError('coder artifact identity does not match its filename', {
      status: 409,
      code: 'coder_artifact_identity_mismatch',
      details: { rater_path: repoRel(filePath) },
    });
  }
  return new Map((parsed.items || []).map((item) => [item.item_id, item]));
}

function impasseCodingComplete(coding) {
  return Boolean(
    IMPASSE_VALUES.has(coding.impasse) &&
    ADDRESSED_VALUES.has(coding.tutor_addressed) &&
    RESOLUTION_VALUES.has(coding.resolved_within_2) &&
    (coding.impasse !== 'yes' || (Array.isArray(coding.impasse_types) && coding.impasse_types.length > 0)),
  );
}

function normalizeEnum(value, allowed, field, { allowEmpty = true } = {}) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/gu, '_');
  if (!normalized && allowEmpty) return '';
  if (!allowed.has(normalized)) {
    throw new HumanCodingError(`invalid ${field}: ${value}`, {
      status: 422,
      code: `invalid_${field}`,
      details: { allowed: [...allowed] },
    });
  }
  return normalized;
}

function normalizeImpasseTypes(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const normalized = values
    .map((entry) =>
      String(entry || '')
        .trim()
        .toLowerCase()
        .replace(/[\s/-]+/gu, '_'),
    )
    .filter(Boolean);
  const invalid = normalized.filter((entry) => !IMPASSE_TYPE_IDS.has(entry));
  if (invalid.length) {
    throw new HumanCodingError(`invalid impasse type: ${invalid.join(', ')}`, {
      status: 422,
      code: 'invalid_impasse_type',
      details: { allowed: [...IMPASSE_TYPE_IDS] },
    });
  }
  return [...new Set(normalized)];
}

function normalizeImpasseCoding(coding = {}, prior = {}) {
  const impasse = normalizeEnum(coding.impasse ?? prior.impasse, IMPASSE_VALUES, 'impasse');
  const impasseTypes = normalizeImpasseTypes(coding.impasse_types ?? prior.impasse_types);
  const notes = String(coding.notes ?? prior.notes ?? '')
    .trim()
    .slice(0, 5000);
  if (impasse === 'yes' && impasseTypes.length === 0) {
    throw new HumanCodingError('at least one impasse type is required when impasse=yes', {
      status: 422,
      code: 'impasse_type_required',
    });
  }
  if (impasseTypes.includes('other') && !notes) {
    throw new HumanCodingError('notes are required when impasse type other is selected', {
      status: 422,
      code: 'impasse_other_notes_required',
    });
  }
  return {
    item_id: prior.item_id,
    impasse,
    impasse_types: impasse === 'no' ? [] : impasseTypes,
    tutor_addressed: normalizeEnum(
      coding.tutor_addressed ?? prior.tutor_addressed,
      ADDRESSED_VALUES,
      'tutor_addressed',
    ),
    resolved_within_2: normalizeEnum(
      coding.resolved_within_2 ?? prior.resolved_within_2,
      RESOLUTION_VALUES,
      'resolved_within_2',
    ),
    notes,
  };
}

function impasseProgress(items) {
  const complete = items.filter((item) => item.labelling_complete).length;
  return {
    total: items.length,
    complete,
    remaining: items.length - complete,
    lowConfidence: 0,
  };
}

function impasseItem(episode, coding) {
  const complete = impasseCodingComplete(coding);
  return {
    item_id: episode.episode_id,
    episode_id: episode.episode_id,
    session_date: episode.session_date,
    session_file: episode.session_file,
    turn_range: episode.turn_range,
    mixed: Boolean(episode.mixed),
    signals_fired: episode.signals_fired || [],
    core_heuristics: episode.core_heuristics || [],
    excerpt_turns: episode.excerpt_turns || [],
    followup_turns: episode.followup_turns || [],
    session_end: episode.session_end || {},
    ...coding,
    labelling_complete: complete,
    labelling_summary: complete
      ? `${coding.impasse}${coding.impasse_types.length ? ` · ${coding.impasse_types.join(', ')}` : ''}`
      : 'open',
  };
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function impasseRaterSummaries(workspace) {
  if (!fs.existsSync(workspace.outputDir)) return [];
  return fs
    .readdirSync(workspace.outputDir)
    .filter((name) => name.startsWith(IMPASSE_RATER_PREFIX) && name.endsWith('.json'))
    .sort()
    .map((name) => {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(workspace.outputDir, name), 'utf8'));
        const artifactKey = name.slice(IMPASSE_RATER_PREFIX.length, -'.json'.length);
        const decodedCoderId = coderIdFromArtifactToken(artifactKey);
        const items = parsed.items || [];
        const complete = items.filter(impasseCodingComplete).length;
        return {
          coder_id: decodedCoderId || parsed.coder_id || artifactKey,
          identity_format: decodedCoderId ? 'v1' : 'legacy',
          complete,
          total: items.length,
          path: repoRel(path.join(workspace.outputDir, name)),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function getImpasseStatus(env = process.env) {
  const workspace = resolveImpasseWorkspace(env);
  const exists = fs.existsSync(workspace.sourcePath);
  const total = exists ? readImpasseCorpus(workspace).episodes.length : 0;
  return {
    success: true,
    dataset_id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
    sample: { exists, total, path: repoRel(workspace.sourcePath) },
    output_dir: repoRel(workspace.outputDir),
    raters: impasseRaterSummaries(workspace),
    comparison_available: false,
    commands: { check_coder_artifacts: 'npm run labelling-game:coder-artifacts -- --check' },
  };
}

function getImpasseCodebook() {
  return {
    success: true,
    dataset_id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
    categories: IMPASSE_TYPES,
    task: {
      primary_object:
        'Decide whether the excerpt contains a communicative impasse, then characterize its form and outcome.',
      not_the_task: 'Do not score general tutor quality or infer unreleased story facts.',
      rule: 'Use only the visible exchange and supplied follow-up. Multiple impasse types may apply.',
      required_fields: ['impasse', 'tutor_addressed', 'resolved_within_2'],
      conditional_fields: { impasse_yes: ['impasse_types'] },
    },
    fields: {
      impasse: [...IMPASSE_VALUES],
      tutor_addressed: [...ADDRESSED_VALUES],
      resolved_within_2: [...RESOLUTION_VALUES],
    },
  };
}

function getImpasseItems({ coderId, env = process.env } = {}) {
  const workspace = resolveImpasseWorkspace(env);
  const safeId = safeCoderId(coderId);
  const corpus = readImpasseCorpus(workspace);
  const saved = readImpasseRater(workspace, safeId);
  const items = corpus.episodes.map((episode) =>
    impasseItem(episode, { ...emptyImpasseCoding(episode.episode_id), ...(saved.get(episode.episode_id) || {}) }),
  );
  return {
    success: true,
    dataset_id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
    coder_id: safeId,
    rater_path: repoRel(impasseRaterPath(workspace, safeId)),
    progress: impasseProgress(items),
    items,
  };
}

function saveImpasseCoding({ coderId, itemId, coding, env = process.env } = {}) {
  const workspace = resolveImpasseWorkspace(env);
  const safeId = safeCoderId(coderId);
  const corpus = readImpasseCorpus(workspace);
  const episode = corpus.episodes.find((entry) => entry.episode_id === itemId);
  if (!episode) {
    throw new HumanCodingError(`item_id not found in impasse dataset: ${itemId}`, {
      status: 404,
      code: 'item_not_found',
    });
  }
  const saved = readImpasseRater(workspace, safeId);
  const prior = { ...emptyImpasseCoding(itemId), ...(saved.get(itemId) || {}), item_id: itemId };
  const normalized = normalizeImpasseCoding(coding, prior);
  saved.set(itemId, normalized);

  const filePath = impasseRaterPath(workspace, safeId);
  const orderedItems = corpus.episodes.map(
    (entry) => saved.get(entry.episode_id) || emptyImpasseCoding(entry.episode_id),
  );
  writeJsonAtomic(filePath, {
    schema: 'machinespirits.labelling-game.impasse-rater.v1',
    dataset_id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
    coder_id: safeId,
    coder_identity: {
      schema: CODER_IDENTITY_SCHEMA,
      artifact_token: coderArtifactToken(safeId),
    },
    source: repoRel(workspace.sourcePath),
    updated_at: new Date().toISOString(),
    items: orderedItems,
  });

  const response = getImpasseItems({ coderId: safeId, env });
  return {
    success: true,
    dataset_id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
    coder_id: safeId,
    item_id: itemId,
    rater_path: repoRel(filePath),
    progress: response.progress,
    item: response.items.find((item) => item.item_id === itemId),
  };
}

function taxonomyStatus(env = process.env) {
  return {
    ...getHumanCodingStatus(env),
    dataset_id: LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY,
    comparison_available: true,
  };
}

function taxonomyCodebook(env = process.env) {
  const codebook = getHumanCodingCodebook(env);
  return {
    ...codebook,
    dataset_id: LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY,
    task: {
      ...codebook.task,
      not_the_task: 'Do not decide whether the critique is correct.',
      rule: 'Pick one primary label; use secondary labels only for close ties.',
    },
  };
}

function taxonomyItems({ coderId, env = process.env } = {}) {
  const result = getHumanCodingItems({ coderId, env });
  return {
    ...result,
    dataset_id: LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY,
    items: result.items.map((item) => ({
      ...item,
      labelling_complete: Boolean(item.human_primary),
      labelling_summary: item.human_primary || 'open',
    })),
  };
}

export function listLabellingGameDatasets({ env = process.env } = {}) {
  const taxonomy = taxonomyStatus(env);
  const impasses = getImpasseStatus(env);
  return {
    success: true,
    datasets: [
      {
        id: LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY,
        title: 'Superego critique taxonomy',
        short_title: 'Superego taxonomy',
        description: '40 blinded Paper 2.0 critiques requiring an independent human category label.',
        total: taxonomy.sample.total,
        available: taxonomy.sample.exists,
        comparison_available: true,
      },
      {
        id: LABELLING_GAME_DATASETS.TUTOR_STUB_IMPASSES,
        title: 'Tutor-stub communicative impasses',
        short_title: 'Tutor-stub impasses',
        description: '29 candidate breakdown episodes from human and mixed tutor-stub sessions.',
        total: impasses.sample.total,
        available: impasses.sample.exists,
        comparison_available: false,
      },
    ],
  };
}

export function getLabellingGameStatus({ datasetId, env = process.env } = {}) {
  return normalizeDatasetId(datasetId) === LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY
    ? taxonomyStatus(env)
    : getImpasseStatus(env);
}

export function getLabellingGameCodebook({ datasetId, env = process.env } = {}) {
  return normalizeDatasetId(datasetId) === LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY
    ? taxonomyCodebook(env)
    : getImpasseCodebook();
}

export function getLabellingGameItems({ datasetId, coderId, env = process.env } = {}) {
  return normalizeDatasetId(datasetId) === LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY
    ? taxonomyItems({ coderId, env })
    : getImpasseItems({ coderId, env });
}

export function saveLabellingGameCoding({ datasetId, coderId, itemId, coding, env = process.env } = {}) {
  if (normalizeDatasetId(datasetId) !== LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY) {
    return saveImpasseCoding({ coderId, itemId, coding, env });
  }
  const result = saveHumanCoding({ coderId, itemId, coding, env });
  return {
    ...result,
    dataset_id: LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY,
    item: {
      ...result.item,
      labelling_complete: Boolean(result.item.human_primary),
      labelling_summary: result.item.human_primary || 'open',
    },
  };
}

export function getLabellingGameComparison({ datasetId, coderId, allowPartial = false, env = process.env } = {}) {
  const normalized = normalizeDatasetId(datasetId);
  if (normalized !== LABELLING_GAME_DATASETS.SUPEREGO_TAXONOMY) {
    throw new HumanCodingError('this dataset has no hidden AI key to compare against', {
      status: 409,
      code: 'comparison_unavailable',
    });
  }
  return {
    ...getHumanCodingComparison({ coderId, allowPartial, env }),
    dataset_id: normalized,
  };
}

export { HumanCodingError };
