/**
 * File-backed store for the Paper 2.0 superego-taxonomy human-coding pilot.
 *
 * The existing offline analyzer expects one CSV per rater:
 *   exports/human-validation-pilot-rater-<id>.csv
 *
 * This service keeps that contract. The browser UI writes the same CSV shape
 * the spreadsheet workflow used, so `node scripts/human-validation-analyze.js`
 * continues to be the analysis authority.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  coderArtifactToken,
  coderIdFromArtifactToken,
  legacyTaxonomyCoderKey,
  normalizeCoderId,
} from './labellingCoderIdentity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_EXPORTS_DIR = path.join(ROOT, 'exports');
const DEFAULT_SAMPLE_NAME = 'human-validation-pilot-sample.csv';
const DEFAULT_KEY_NAME = 'human-validation-pilot-key.jsonl';
const DEFAULT_ANALYSIS_NAME = 'human-validation-pilot-analysis.md';
const DEFAULT_CODEBOOK = path.join(ROOT, 'docs', 'research', 'human-coding-codebook.md');
const DEFAULT_CLASSIFIED_INPUT = path.join(
  ROOT,
  'data',
  'paper2',
  'superego-critiques-classified-paper-6.2-n500.jsonl',
);

export const HUMAN_CODING_MAX_NOTES_CHARS = 5000;

export const HUMAN_CODING_COLUMNS = Object.freeze([
  'item_id',
  'feedback',
  'ego_generate',
  'ego_revision',
  'learner_context_snippet',
  'human_primary',
  'human_secondary',
  'human_confident',
  'human_notes',
]);

export const HUMAN_CODING_CATEGORIES = Object.freeze([
  {
    id: 'CONTEXT_BLINDNESS',
    name: 'Context blindness',
    definition:
      "The ego response is disconnected from the learner's actual context: wrong lecture, wrong topic, wrong level, or an ungrounded content reference.",
    signals: ['wrong lecture', 'not in current content', 'mismatched to level', 'unverified curriculum reference'],
    example:
      "Introduces a content reference that is not verified in the learner context, so the response should be grounded in the learner's actual curriculum position.",
    boundary:
      'If the critique emphasizes invented metrics, use FABRICATION. If it emphasizes the wrong curriculum location, use CONTEXT_BLINDNESS.',
  },
  {
    id: 'RECOGNITION_FAILURE',
    name: 'Recognition failure',
    definition:
      'The ego treats the learner as a passive data point rather than an autonomous intellectual agent whose contribution should be acknowledged.',
    signals: ['fails to acknowledge their argument', 'treating them as a data point', 'bypasses autonomy'],
    example:
      "Moves directly to a tool without first acknowledging the learner's sophisticated intellectual contribution.",
    boundary:
      'Use this as primary only when intellectual agency or recognition is the central problem; otherwise prefer the more specific category.',
  },
  {
    id: 'REDIRECTION',
    name: 'Redirection',
    definition:
      "The ego deflects from the learner's current question or struggle by routing them to new content instead of engaging what they raised.",
    signals: ['routes to new lecture', 'pivots away', 'directs them elsewhere', 'navigating away'],
    example:
      'The learner says their head is spinning, but the response sends them to a different lecture instead of stabilizing the current struggle.',
    boundary: 'Redirection chooses a new destination. Context blindness operates in the wrong place from the start.',
  },
  {
    id: 'FABRICATION',
    name: 'Fabrication',
    definition:
      'The ego invents engagement data such as session metrics, activity counts, time-on-page numbers, or behavioral patterns not present in context.',
    signals: ['invented', 'no evidence of', 'not in structured data', 'made up', 'fabricated'],
    example: 'Mentions generic time or note-taking data that the learner context never provided.',
    boundary: 'Fabrication adds false specificity. VAGUENESS omits required specificity.',
  },
  {
    id: 'VAGUENESS',
    name: 'Vagueness',
    definition:
      'The response lacks concrete detail: no specific concept, actionable target, activity ID, or curriculum-linked detail where one was needed.',
    signals: ['too general', 'generic', 'no specific concepts', 'missing activity ID'],
    example: 'The suggestion needs a concrete curriculum-linked activity and a clearer bridge to this specific moment.',
    boundary: 'Use when specificity is missing, not when the response invents false specifics.',
  },
  {
    id: 'EMOTIONAL_NEGLECT',
    name: 'Emotional neglect',
    definition:
      'The ego jumps to content without acknowledging affective signals such as frustration, joy, overwhelm, or repair moments.',
    signals: ['overwhelmed', 'frustrated', 'breakthrough', 'bypasses affect', 'does not validate feeling'],
    example:
      'Jumps straight into a simulation without first acknowledging that the learner explicitly said they feel overwhelmed.',
    boundary: 'Emotional neglect concerns affect. RECOGNITION_FAILURE concerns intellectual agency and contribution.',
  },
  {
    id: 'REGISTER_MISMATCH',
    name: 'Register mismatch',
    definition: "The vocabulary, tone, or pedagogical register is inappropriate for the learner's developmental level.",
    signals: ['wrong register', 'too advanced', 'too simple', 'tone mismatched', 'developmental level'],
    example: 'Uses graduate-level terminology with a learner whose profile indicates first exposure to the domain.',
    boundary: 'Register is surface communication. PEDAGOGICAL_MISJUDGMENT is a wrong read of the learner state.',
  },
  {
    id: 'PEDAGOGICAL_MISJUDGMENT',
    name: 'Pedagogical misjudgment',
    definition:
      "The ego misreads the learner's cognitive state: breakthrough vs struggle, readiness vs confusion, productive tension vs resolved understanding.",
    signals: ['misreads their state', 'prematurely resolves', 'treats struggle as resolved', 'confuses readiness'],
    example:
      'Validates a metaphor as perfect in a way that prematurely resolves the productive tension the learner is still working through.',
    boundary: 'Use this when the critique is about the learner-state diagnosis, not just word choice or tone.',
  },
  {
    id: 'LACK_OF_AGENCY',
    name: 'Lack of agency',
    definition:
      'The response funnels the learner with directive instruction where choice, inquiry, or a menu of next moves was warranted.',
    signals: ['directive instruction', 'no choice offered', 'funnels without autonomy', 'does not invite inquiry'],
    example: "Provides a directive next step without engaging the learner's own question about how the concept works.",
    boundary:
      'Recognition is retrospective: did the response honor what the learner already said? Agency is prospective: does it offer choice about what comes next?',
  },
  {
    id: 'MEMORY_FAILURE',
    name: 'Memory failure',
    definition:
      'The ego treats a returning learner as a stranger, failing to reference session history, prior commitments, or intellectual trajectory.',
    signals: ['returning user', '8 sessions', 'ignores history', 'prior work', 'treats as new learner'],
    example: "Fails to acknowledge the learner's significant history and evolution across prior sessions.",
    boundary:
      'Use when the critique centers accumulated history. Use CONTEXT_BLINDNESS for wrong current-curriculum grounding.',
  },
  {
    id: 'APPROVAL',
    name: 'Approval',
    definition: 'The superego approves without raising a substantive problem.',
    signals: ['looks good', 'approved', 'no issue', 'meets standards'],
    example: 'The feedback says the response is acceptable and gives no diagnosable critique.',
    boundary: 'Use sparingly. Prefer a substantive label when the feedback identifies any problem.',
  },
  {
    id: 'OTHER',
    name: 'Other',
    definition: 'The feedback raises a genuine problem that does not fit the taxonomy.',
    signals: ['miscellaneous', 'out of taxonomy'],
    example: 'A critique about a system or formatting issue unrelated to the tutoring taxonomy.',
    boundary: 'Prefer a best-fit substantive category unless nothing fits.',
  },
]);

const CATEGORY_IDS = new Set(HUMAN_CODING_CATEGORIES.map((entry) => entry.id));

export class HumanCodingError extends Error {
  constructor(message, { status = 400, code = 'human_coding_error', details = null } = {}) {
    super(message);
    this.name = 'HumanCodingError';
    this.httpStatus = status;
    this.code = code;
    if (details) this.details = details;
  }
}

export function repoRel(filePath) {
  return path.relative(ROOT, path.resolve(filePath));
}

export function resolveWorkspace(env = process.env) {
  const exportsDir = path.resolve(env.HUMAN_CODING_EXPORTS_DIR || env.EVAL_EXPORTS_DIR || DEFAULT_EXPORTS_DIR);
  const samplePath = path.resolve(env.HUMAN_CODING_SAMPLE || path.join(exportsDir, DEFAULT_SAMPLE_NAME));
  const outputDir = path.resolve(env.HUMAN_CODING_OUTPUT_DIR || path.dirname(samplePath));
  return {
    exportsDir,
    samplePath,
    keyPath: path.resolve(env.HUMAN_CODING_KEY || path.join(exportsDir, DEFAULT_KEY_NAME)),
    outputDir,
    analysisPath: path.resolve(env.HUMAN_CODING_ANALYSIS || path.join(exportsDir, DEFAULT_ANALYSIS_NAME)),
    codebookPath: path.resolve(env.HUMAN_CODING_CODEBOOK || DEFAULT_CODEBOOK),
    classifiedInputPath: path.resolve(env.HUMAN_CODING_CLASSIFIED_INPUT || DEFAULT_CLASSIFIED_INPUT),
  };
}

export function parseCsv(text) {
  const lines = String(text || '')
    .replace(/\r\n/gu, '\n')
    .split('\n')
    .filter((line) => line.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const parseRow = (line) => {
    const out = [];
    let cur = '';
    let inside = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inside) {
        if (c === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inside = false;
        } else {
          cur += c;
        }
      } else if (c === ',') {
        out.push(cur);
        cur = '';
      } else if (c === '"') {
        inside = true;
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseRow(lines[0]);
  return {
    header,
    rows: lines.slice(1).map((line) => {
      const cells = parseRow(line);
      const row = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] || '';
      return row;
    }),
  };
}

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value).replace(/\r?\n/gu, ' ').replace(/\s+/gu, ' ').trim();
  return /[",]/u.test(s) ? `"${s.replace(/"/gu, '""')}"` : s;
}

export function stringifyCsv(rows, header = HUMAN_CODING_COLUMNS) {
  const body = rows.map((row) => header.map((key) => csvEscape(row[key] || '')).join(','));
  return `${header.join(',')}\n${body.join('\n')}${body.length ? '\n' : ''}`;
}

function readCsvFile(filePath) {
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

function writeFileAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`,
  );
  fs.writeFileSync(tmpPath, text, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

export function safeCoderId(value) {
  try {
    return normalizeCoderId(value);
  } catch (error) {
    throw new HumanCodingError(error.message, {
      status: 400,
      code: error.code || 'invalid_coder_id',
    });
  }
}

function normalizeLabel(value, { allowEmpty = true } = {}) {
  const raw = String(value || '').trim();
  if (!raw && allowEmpty) return '';
  const label = raw.toUpperCase().replace(/[\s-]+/gu, '_');
  if (!CATEGORY_IDS.has(label)) {
    throw new HumanCodingError(`invalid category label: ${value}`, {
      status: 422,
      code: 'invalid_category',
      details: { allowed: [...CATEGORY_IDS] },
    });
  }
  return label;
}

function normalizeSecondary(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(',');
  const out = [];
  for (const part of parts) {
    const label = normalizeLabel(part, { allowEmpty: true });
    if (label && !out.includes(label)) out.push(label);
  }
  if (out.length > 2) {
    throw new HumanCodingError('human_secondary can contain at most two labels', {
      status: 422,
      code: 'too_many_secondary_labels',
    });
  }
  return out.join(',');
}

function normalizeConfidence(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!['1', '2', '3'].includes(raw)) {
    throw new HumanCodingError('human_confident must be 1, 2, or 3', {
      status: 422,
      code: 'invalid_confidence',
    });
  }
  return raw;
}

function normalizeNotes(value) {
  const notes = String(value || '').trim();
  if (notes.length > HUMAN_CODING_MAX_NOTES_CHARS) {
    throw new HumanCodingError(`human_notes is too long (max ${HUMAN_CODING_MAX_NOTES_CHARS} chars)`, {
      status: 422,
      code: 'notes_too_long',
    });
  }
  return notes;
}

function hasValidPrimaryLabel(value) {
  try {
    return Boolean(normalizeLabel(value, { allowEmpty: true }));
  } catch {
    return false;
  }
}

function requireSample(workspace) {
  if (!fs.existsSync(workspace.samplePath)) {
    throw new HumanCodingError(`human-coding sample not found: ${repoRel(workspace.samplePath)}`, {
      status: 404,
      code: 'sample_not_found',
      details: { samplePath: repoRel(workspace.samplePath), buildCommand: sampleBuildCommand(workspace) },
    });
  }
}

export function sampleBuildCommand(workspace = resolveWorkspace()) {
  const input = fs.existsSync(workspace.classifiedInputPath)
    ? repoRel(workspace.classifiedInputPath)
    : repoRel(DEFAULT_CLASSIFIED_INPUT);
  return `node scripts/human-validation-sample.js --input ${input} --size 40 --seed 20260416`;
}

export function readSample(workspace = resolveWorkspace()) {
  requireSample(workspace);
  const { rows } = readCsvFile(workspace.samplePath);
  return rows.filter((row) => row.item_id);
}

function raterFilePath(workspace, coderId) {
  return path.join(workspace.outputDir, `human-validation-pilot-rater-${coderArtifactToken(safeCoderId(coderId))}.csv`);
}

function legacyRaterFilePath(workspace, coderId) {
  const legacyKey = legacyTaxonomyCoderKey(coderId);
  return legacyKey ? path.join(workspace.outputDir, `human-validation-pilot-rater-${legacyKey}.csv`) : null;
}

function readCoderMap(workspace, coderId) {
  const filePath = raterFilePath(workspace, coderId);
  const legacyPath = legacyRaterFilePath(workspace, coderId);
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
  const { rows } = readCsvFile(filePath);
  return new Map(rows.filter((row) => row.item_id).map((row) => [row.item_id, row]));
}

function mergeCoderRows(workspace, coderId) {
  const sampleRows = readSample(workspace);
  const coded = readCoderMap(workspace, coderId);
  return sampleRows.map((sample) => {
    const existing = coded.get(sample.item_id) || {};
    return {
      item_id: sample.item_id || '',
      feedback: sample.feedback || '',
      ego_generate: sample.ego_generate || '',
      ego_revision: sample.ego_revision || '',
      learner_context_snippet: sample.learner_context_snippet || '',
      human_primary: existing.human_primary || sample.human_primary || '',
      human_secondary: existing.human_secondary || sample.human_secondary || '',
      human_confident: existing.human_confident || sample.human_confident || '',
      human_notes: existing.human_notes || sample.human_notes || '',
    };
  });
}

function progressForRows(rows) {
  const total = rows.length;
  const complete = rows.filter((row) => hasValidPrimaryLabel(row.human_primary)).length;
  const lowConfidence = rows.filter((row) => String(row.human_confident || '') === '1').length;
  return { total, complete, remaining: Math.max(0, total - complete), lowConfidence };
}

function requireKey(workspace) {
  if (!fs.existsSync(workspace.keyPath)) {
    throw new HumanCodingError(`human-coding AI key not found: ${repoRel(workspace.keyPath)}`, {
      status: 404,
      code: 'key_not_found',
      details: { keyPath: repoRel(workspace.keyPath), buildCommand: sampleBuildCommand(workspace) },
    });
  }
}

function readKeyMap(workspace) {
  requireKey(workspace);
  const text = fs.readFileSync(workspace.keyPath, 'utf8').trim();
  const map = new Map();
  if (!text) return map;
  for (const line of text.split('\n')) {
    const row = JSON.parse(line);
    if (row.item_id) map.set(row.item_id, row);
  }
  return map;
}

function cohensKappa(pairs) {
  if (pairs.length === 0) return { kappa: null, agreement: null, chance: null, n: 0 };
  const labels = Array.from(new Set(pairs.flatMap((pair) => [pair.human, pair.ai])));
  const n = pairs.length;
  let matching = 0;
  const marginalHuman = Object.fromEntries(labels.map((label) => [label, 0]));
  const marginalAi = Object.fromEntries(labels.map((label) => [label, 0]));
  for (const pair of pairs) {
    if (pair.human === pair.ai) matching++;
    marginalHuman[pair.human]++;
    marginalAi[pair.ai]++;
  }
  const agreement = matching / n;
  const chance = labels.reduce((sum, label) => sum + (marginalHuman[label] / n) * (marginalAi[label] / n), 0);
  const kappa = chance === 1 ? 1 : (agreement - chance) / (1 - chance);
  return { kappa, agreement, chance, n };
}

function perCategoryF1(pairs) {
  return HUMAN_CODING_CATEGORIES.map(({ id }) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const pair of pairs) {
      if (pair.ai === id && pair.human === id) tp++;
      else if (pair.ai === id && pair.human !== id) fp++;
      else if (pair.ai !== id && pair.human === id) fn++;
    }
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    const f1 =
      precision == null || recall == null || precision + recall === 0
        ? null
        : (2 * precision * recall) / (precision + recall);
    return { category: id, tp, fp, fn, precision, recall, f1 };
  }).filter((row) => row.tp || row.fp || row.fn);
}

function confusionMatrix(pairs) {
  const labels = HUMAN_CODING_CATEGORIES.map((entry) => entry.id);
  const rows = labels.map((ai) => ({
    ai,
    cells: Object.fromEntries(labels.map((human) => [human, 0])),
  }));
  const byAi = new Map(rows.map((row) => [row.ai, row]));
  for (const pair of pairs) {
    const row = byAi.get(pair.ai);
    if (row && row.cells[pair.human] !== undefined) row.cells[pair.human]++;
  }
  return rows.filter((row) => Object.values(row.cells).some((value) => value > 0));
}

export function listRaterSummaries(workspace = resolveWorkspace()) {
  if (!fs.existsSync(workspace.outputDir)) return [];
  return fs
    .readdirSync(workspace.outputDir)
    .filter((entry) => /^human-validation-pilot-rater-.+\.csv$/u.test(entry))
    .sort()
    .map((entry) => {
      const artifactKey = entry.replace(/^human-validation-pilot-rater-/u, '').replace(/\.csv$/u, '');
      const decodedCoderId = coderIdFromArtifactToken(artifactKey);
      const filePath = path.join(workspace.outputDir, entry);
      const { rows } = readCsvFile(filePath);
      return {
        coder_id: decodedCoderId || artifactKey,
        identity_format: decodedCoderId ? 'v1' : 'legacy',
        path: repoRel(filePath),
        updated_at: fs.statSync(filePath).mtime.toISOString(),
        ...progressForRows(rows),
      };
    });
}

export function getStatus(env = process.env) {
  const workspace = resolveWorkspace(env);
  const sampleExists = fs.existsSync(workspace.samplePath);
  let sample = { exists: false, path: repoRel(workspace.samplePath), total: 0 };
  if (sampleExists) {
    const rows = readSample(workspace);
    sample = { exists: true, path: repoRel(workspace.samplePath), total: rows.length };
  }
  const analysisExists = fs.existsSync(workspace.analysisPath);
  return {
    success: true,
    sample,
    key: { exists: fs.existsSync(workspace.keyPath), path: repoRel(workspace.keyPath) },
    codebook: { exists: fs.existsSync(workspace.codebookPath), path: repoRel(workspace.codebookPath) },
    analysis: {
      exists: analysisExists,
      path: repoRel(workspace.analysisPath),
      updated_at: analysisExists ? fs.statSync(workspace.analysisPath).mtime.toISOString() : null,
    },
    output_dir: repoRel(workspace.outputDir),
    raters: listRaterSummaries(workspace),
    categories: HUMAN_CODING_CATEGORIES,
    limits: { notes_max_chars: HUMAN_CODING_MAX_NOTES_CHARS },
    commands: {
      build_sample: sampleBuildCommand(workspace),
      analyze: 'node scripts/human-validation-analyze.js',
      check_coder_artifacts: 'npm run labelling-game:coder-artifacts -- --check',
    },
  };
}

export function getCodebook(env = process.env) {
  const workspace = resolveWorkspace(env);
  const markdown = fs.existsSync(workspace.codebookPath) ? fs.readFileSync(workspace.codebookPath, 'utf8') : '';
  return {
    success: true,
    path: repoRel(workspace.codebookPath),
    markdown,
    categories: HUMAN_CODING_CATEGORIES,
    task: {
      primary_object:
        'Classify what kind of problem the superego feedback is pointing out. Do not judge whether the feedback is correct.',
      required_field: 'human_primary',
      optional_fields: ['human_secondary', 'human_confident', 'human_notes'],
      reliability_floor: 'kappa >= 0.60',
    },
  };
}

export function getItems({ coderId, env = process.env } = {}) {
  const workspace = resolveWorkspace(env);
  const safeId = safeCoderId(coderId);
  const rows = mergeCoderRows(workspace, safeId);
  return {
    success: true,
    coder_id: safeId,
    rater_path: repoRel(raterFilePath(workspace, safeId)),
    progress: progressForRows(rows),
    items: rows,
  };
}

export function saveCoding({ coderId, itemId, coding, env = process.env } = {}) {
  const workspace = resolveWorkspace(env);
  const safeId = safeCoderId(coderId);
  const targetId = String(itemId || '').trim();
  if (!targetId) throw new HumanCodingError('item_id is required', { status: 400, code: 'item_id_required' });
  const rows = mergeCoderRows(workspace, safeId);
  const row = rows.find((entry) => entry.item_id === targetId);
  if (!row) {
    throw new HumanCodingError(`item_id not found in sample: ${targetId}`, {
      status: 404,
      code: 'item_not_found',
    });
  }
  row.human_primary = normalizeLabel(coding?.human_primary, { allowEmpty: true });
  row.human_secondary = normalizeSecondary(coding?.human_secondary);
  row.human_confident = normalizeConfidence(coding?.human_confident);
  row.human_notes = normalizeNotes(coding?.human_notes);

  const filePath = raterFilePath(workspace, safeId);
  writeFileAtomic(filePath, stringifyCsv(rows));
  return {
    success: true,
    coder_id: safeId,
    item_id: targetId,
    rater_path: repoRel(filePath),
    progress: progressForRows(rows),
    item: row,
  };
}

export function getComparison({ coderId, allowPartial = false, env = process.env } = {}) {
  const workspace = resolveWorkspace(env);
  const safeId = safeCoderId(coderId);
  const rows = mergeCoderRows(workspace, safeId);
  const progress = progressForRows(rows);
  if (progress.remaining > 0 && !allowPartial) {
    throw new HumanCodingError('comparison is locked until this coder has labelled every sample item', {
      status: 409,
      code: 'coding_incomplete',
      details: progress,
    });
  }

  const key = readKeyMap(workspace);
  const items = [];
  const pairs = [];
  for (const row of rows) {
    const ai = key.get(row.item_id);
    const human = normalizeLabel(row.human_primary, { allowEmpty: true });
    const aiPrimary = normalizeLabel(ai?.llm_primary, { allowEmpty: true });
    if (!human || !aiPrimary) {
      items.push({
        item_id: row.item_id,
        human_primary: human || null,
        ai_primary: aiPrimary || null,
        agreement: null,
        status: !human ? 'missing_human_label' : 'missing_ai_label',
      });
      continue;
    }
    const agreement = human === aiPrimary;
    const item = {
      item_id: row.item_id,
      human_primary: human,
      human_secondary: row.human_secondary || '',
      human_confident: row.human_confident || '',
      human_notes: row.human_notes || '',
      ai_primary: aiPrimary,
      ai_secondary: Array.isArray(ai?.llm_secondary) ? ai.llm_secondary : [],
      ai_confidence: ai?.llm_confidence ?? null,
      ai_rationale: ai?.llm_rationale || '',
      agreement,
      status: agreement ? 'agree' : 'disagree',
      feedback: row.feedback || '',
      ego_generate: row.ego_generate || '',
      ego_revision: row.ego_revision || '',
      learner_context_snippet: row.learner_context_snippet || '',
    };
    items.push(item);
    pairs.push({ item_id: row.item_id, human, ai: aiPrimary });
  }

  const stats = cohensKappa(pairs);
  const agreements = items.filter((item) => item.status === 'agree').length;
  const disagreements = items.filter((item) => item.status === 'disagree');
  return {
    success: true,
    coder_id: safeId,
    locked: false,
    progress,
    paths: {
      rater: repoRel(raterFilePath(workspace, safeId)),
      key: repoRel(workspace.keyPath),
    },
    stats: {
      ...stats,
      agreements,
      disagreements: disagreements.length,
    },
    per_category: perCategoryF1(pairs),
    confusion_matrix: confusionMatrix(pairs),
    items,
    disagreements,
  };
}
