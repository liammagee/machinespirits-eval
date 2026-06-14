#!/usr/bin/env node
/**
 * Browser for generated poetics teaching scripts.
 *
 * Reads the poetics sidecar tables, not evaluation_results. Use
 * scripts/ingest-poetics-artifacts.js first when a new artifact root is added.
 */

// Load .env first: this server hosts metered surfaces (the live-compose turn engine
// and setup guide both read OPENROUTER_API_KEY at call time), so the key must be in
// process.env before any request lands. Matches the repo convention (eval-cli.js).
import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { openPoeticsStore, upsertPoeticsLabel, upsertPoeticsReviewFlag } from '../services/poeticsStore.js';
import { resolveBasicAuthGuard, makeRoleGate } from '../services/httpBasicAuth.js';
import { mountEvalSurfaces } from '../services/evalSurfaces.js';
import { classifyPoeticsConsensus, parseCriticFormString } from './lib/poeticsConsensus.js';
import { ORIGIN_CLASSES, originCounts, recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';
import { validateTurnPlan } from '../services/ontology/reasoningOntology.js';
import { sampleTurnPlan, agenciesForArchitecture } from '../services/ontology/turnPlanSampler.js';
import { buildOntologyView, ALL_MODULES, DEFAULT_MODULES } from '../services/ontology/ontologyView.js';
import {
  listReplayBundles,
  readReplayBundle,
  readReplayItem,
  GATE_BUCKETS,
} from '../services/poetics/replayBundles.js';
import {
  loadWorld as loadDerivationWorld,
  renderProof as renderDerivationProof,
  renderProofProse as renderDerivationProofProse,
  renderEvalPanel as renderDerivationEvalPanel,
  stagingSegments as derivationStagingSegments,
} from '../services/dramaticDerivation/index.js';
import {
  planJob,
  launchJob,
  listJobs,
  getJob,
  stopJob,
  describeKinds,
  COST_CLASSES,
} from '../services/poetics/jobRunner.js';
import {
  startSession as liveStartSession,
  humanTurn as liveHumanTurn,
  viewSession as liveViewSession,
  saveSession as liveSaveSession,
  endSession as liveEndSession,
  scoreSession as liveScoreSession,
  buildMockDeps as liveBuildMockDeps,
  proposeSpec as liveProposeSpec,
  buildMockGuideDeps as liveBuildMockGuideDeps,
  listCourses as liveListCourses,
  getLectureContent as liveGetLectureContent,
  LIVE_VOCAB,
} from '../services/poetics/liveCompose.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const TUTOR_ADAPTATION_ANALYZER_VERSION = 'tutor-adaptation-v4';

function parseArgs(argv) {
  const args = {
    dbPath: null,
    port: 3466,
    host: '127.0.0.1',
    open: true,
    runId: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--port') args.port = Number.parseInt(argv[++i], 10);
    else if (token === '--host') args.host = argv[++i];
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--no-open') args.open = false;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/browse-poetics-scripts.js [--port 3466] [--host 127.0.0.1]
      [--run-id ID] [--db FILE] [--no-open]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  if (!Number.isInteger(args.port) || args.port < 1) throw new Error('--port must be a positive integer');
  return args;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function resolveArtifact(relPath) {
  if (!relPath) return null;
  const abs = path.resolve(ROOT, relPath);
  if (!abs.startsWith(`${ROOT}${path.sep}`)) throw new Error(`artifact escapes repo root: ${relPath}`);
  return abs;
}

function readArtifact(relPath, maxChars = 90000) {
  const abs = resolveArtifact(relPath);
  if (!abs || !fs.existsSync(abs)) return null;
  const text = fs.readFileSync(abs, 'utf8');
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[truncated]` : text;
}

function stripOuterPair(text, open, close) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
    return trimmed.slice(open.length, trimmed.length - close.length).trim();
  }
  return trimmed;
}

function stripOuterSpeechQuotes(text) {
  return stripOuterPair(stripOuterPair(text, '"', '"'), '\u201c', '\u201d');
}

function classifyTranscriptSpeaker(label) {
  const normalized = String(label || '').toUpperCase();
  if (normalized === 'STAGE' || normalized === 'DIRECTOR' || normalized === 'CHORUS') return 'stage';
  if (normalized.includes('SUPEREGO') || normalized.includes('EGO')) return 'internal';
  if (normalized.startsWith('TUTOR')) return 'tutor';
  if (normalized.startsWith('LEARNER')) return 'learner';
  return 'other';
}

function splitTranscriptBlocking(content, type) {
  const normalized = String(content || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!normalized) return { blocking: '', speech: '' };
  if (type === 'stage') {
    return { blocking: stripOuterPair(normalized, '[', ']'), speech: '' };
  }
  const lines = normalized.split('\n');
  const blocking = [];
  while (lines.length) {
    const line = lines[0].trim();
    if (!line) {
      lines.shift();
      if (blocking.length) break;
      continue;
    }
    if (line.startsWith('[') && line.endsWith(']')) {
      blocking.push(stripOuterPair(line, '[', ']'));
      lines.shift();
      continue;
    }
    break;
  }
  return {
    blocking: blocking.join('\n'),
    speech: stripOuterSpeechQuotes(lines.join('\n').trim()),
  };
}

function parseTranscriptPreview(text) {
  const source = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim();
  if (!source) return [];
  const marker =
    /^(STAGE|DIRECTOR|CHORUS|TUTOR(?:\s+EGO|\s+SUPEREGO)?|LEARNER(?:\s+EGO|\s+SUPEREGO)?|SUPEREGO|EGO):\s*(.*)$/i;
  const blocks = [];
  let current = null;

  function flush() {
    if (!current) return;
    const raw = current.lines.join('\n').trim();
    if (!raw) {
      current = null;
      return;
    }
    const parts = splitTranscriptBlocking(raw, current.type);
    blocks.push({
      speaker: current.speaker,
      type: current.type,
      blocking: parts.blocking,
      speech: parts.speech,
      raw,
    });
    current = null;
  }

  for (const line of source.split('\n')) {
    const match = line.match(marker);
    if (match) {
      flush();
      const speaker = match[1].toUpperCase();
      current = {
        speaker,
        type: classifyTranscriptSpeaker(speaker),
        lines: [match[2] || ''],
      };
      continue;
    }
    if (!current) {
      current = {
        speaker: 'TEXT',
        type: 'other',
        lines: [],
      };
    }
    current.lines.push(line);
  }
  flush();
  return blocks.map((block, index) => ({ ...block, index: index + 1 }));
}

const LEMONFOX_TTS_URL = 'https://api.lemonfox.ai/v1/audio/speech';
const MAX_TTS_CHARS = 30000;
const TTS_RESPONSE_FORMATS = new Set(['mp3', 'opus', 'aac', 'flac', 'pcm', 'ogg', 'wav']);
const TTS_LANGUAGES = new Set(['en-us', 'en-gb']);
const TTS_ROLE_VOICE = {
  director: 'onyx',
  stage: 'alloy',
  tutor: 'michael',
  learner: 'sarah',
  internal: 'echo',
  tutor_superego: 'echo',
  learner_superego: 'nova',
  default: 'heart',
};
const TTS_VOICES_BY_LANGUAGE = {
  'en-us': new Set([
    'heart',
    'bella',
    'michael',
    'alloy',
    'aoede',
    'kore',
    'jessica',
    'nicole',
    'nova',
    'river',
    'sarah',
    'sky',
    'echo',
    'eric',
    'fenrir',
    'liam',
    'onyx',
    'puck',
    'adam',
    'santa',
  ]),
  'en-gb': new Set(['alice', 'emma', 'isabella', 'lily', 'daniel', 'fable', 'george', 'lewis']),
};

function normalizeTtsText(text) {
  const cleaned = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!cleaned) {
    const error = new Error('missing text');
    error.statusCode = 400;
    throw error;
  }
  if (cleaned.length > MAX_TTS_CHARS) {
    const error = new Error(`text exceeds ${MAX_TTS_CHARS.toLocaleString('en-US')} character TTS limit`);
    error.statusCode = 413;
    throw error;
  }
  return cleaned;
}

function normalizeTtsRole(role) {
  const normalized = String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  if (normalized.includes('superego') || normalized.includes('ego')) return normalized;
  if (['director', 'stage', 'tutor', 'learner', 'internal'].includes(normalized)) return normalized;
  return 'default';
}

function defaultVoiceForRole(role) {
  const normalized = normalizeTtsRole(role);
  if (normalized.includes('tutor_superego')) return TTS_ROLE_VOICE.tutor_superego;
  if (normalized.includes('learner_superego')) return TTS_ROLE_VOICE.learner_superego;
  if (normalized.includes('superego') || normalized.includes('ego')) return TTS_ROLE_VOICE.internal;
  return TTS_ROLE_VOICE[normalized] || TTS_ROLE_VOICE.default;
}

function normalizeTtsRequest(input = {}) {
  const language = TTS_LANGUAGES.has(String(input.language || '').toLowerCase())
    ? String(input.language).toLowerCase()
    : 'en-us';
  const role = normalizeTtsRole(input.role);
  const allowedVoices = TTS_VOICES_BY_LANGUAGE[language] || TTS_VOICES_BY_LANGUAGE['en-us'];
  const requestedVoice = String(input.voice || '')
    .trim()
    .toLowerCase();
  const fallbackVoice = defaultVoiceForRole(role);
  const voice = allowedVoices.has(requestedVoice)
    ? requestedVoice
    : allowedVoices.has(fallbackVoice)
      ? fallbackVoice
      : TTS_ROLE_VOICE.default;
  const responseFormat = TTS_RESPONSE_FORMATS.has(
    String(input.responseFormat || input.response_format || '').toLowerCase(),
  )
    ? String(input.responseFormat || input.response_format).toLowerCase()
    : 'mp3';
  const rawSpeed = Number(input.speed ?? 1);
  const speed = Number.isFinite(rawSpeed) ? Math.min(4, Math.max(0.5, rawSpeed)) : 1;
  return {
    text: normalizeTtsText(input.text || input.input),
    role,
    voice,
    language,
    responseFormat,
    speed,
  };
}

function audioContentType(format) {
  if (format === 'mp3') return 'audio/mpeg';
  if (format === 'aac') return 'audio/aac';
  if (format === 'flac') return 'audio/flac';
  if (format === 'wav') return 'audio/wav';
  if (format === 'opus') return 'audio/opus';
  if (format === 'ogg') return 'audio/ogg';
  if (format === 'pcm') return 'audio/L16';
  return 'application/octet-stream';
}

async function synthesizeLemonFoxSpeech(
  input = {},
  { apiKey = process.env.LEMONFOX_API_KEY, fetchImpl = globalThis.fetch } = {},
) {
  if (!apiKey) {
    const error = new Error('LEMONFOX_API_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }
  if (typeof fetchImpl !== 'function') {
    const error = new Error('fetch is not available in this runtime');
    error.statusCode = 500;
    throw error;
  }
  const request = normalizeTtsRequest(input);
  const response = await fetchImpl(LEMONFOX_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: audioContentType(request.responseFormat),
    },
    body: JSON.stringify({
      input: request.text,
      voice: request.voice,
      language: request.language,
      response_format: request.responseFormat,
      speed: request.speed,
    }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.text()).slice(0, 600);
    } catch {
      detail = '';
    }
    const error = new Error(`Lemon Fox TTS failed (${response.status})${detail ? `: ${detail}` : ''}`);
    error.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
    throw error;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get('content-type') || audioContentType(request.responseFormat),
    request,
  };
}

function listRuns(db) {
  return db
    .prepare(
      `
      SELECT
        r.id,
        r.source_root AS sourceRoot,
        r.batch_id AS batchId,
        r.generator,
        r.git_commit AS gitCommit,
        COUNT(DISTINCT i.id) AS itemCount,
        COUNT(DISTINCT s.id) AS scoreCount,
        COUNT(DISTINCT l.id) AS labelCount,
        COUNT(DISTINCT rf.id) AS reviewFlagCount,
        MAX(r.created_at) AS createdAt
      FROM poetics_runs r
      LEFT JOIN poetics_items i ON i.run_id = r.id
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_labels l ON l.item_id = i.id
      LEFT JOIN poetics_review_flags rf ON rf.item_id = i.id AND rf.resolved_at IS NULL
      GROUP BY r.id
      ORDER BY r.created_at DESC, r.id DESC
    `,
    )
    .all();
}

// Per-run recontextualization series — one value per scored script, oldest →
// newest — for the dashboard feed's inline sparklines. recontextualization is
// the headline dramatic-form dimension (the one the Signal histograms lead
// with), so a feed row's spark shows the shape of that run's recohering at a
// glance. One query for all the given run ids; returns Map<runId, number[]>.
function runScoreSeries(db, runIds) {
  const ids = (Array.isArray(runIds) ? runIds : []).filter(Boolean);
  if (!ids.length) return new Map();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT i.run_id AS runId, s.recontextualization AS rc
       FROM poetics_items i JOIN poetics_scores s ON s.item_id = i.id
       WHERE i.run_id IN (${placeholders}) AND s.recontextualization IS NOT NULL
       ORDER BY s.created_at ASC, s.id ASC`,
    )
    .all(...ids);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.runId)) map.set(row.runId, []);
    map.get(row.runId).push(row.rc);
  }
  return map;
}

// Distinct, non-empty disciplines present in poetics_items, for the browser's
// discipline filter dropdown (sourced live so new disciplines need no code edit).
function distinctDisciplines(db) {
  return db
    .prepare(
      `SELECT DISTINCT discipline FROM poetics_items
       WHERE discipline IS NOT NULL AND discipline <> ''
       ORDER BY discipline`,
    )
    .all()
    .map((row) => row.discipline);
}

// Corpus-level counts for the dashboard's orientation strip + feature cards. Pure
// DB reads (replay-bundle count is layered on in the route, since that's filesystem).
function corpusStats(db) {
  const scalar = (sql) => db.prepare(sql).get().n;
  return {
    scripts: scalar('SELECT COUNT(*) AS n FROM poetics_items'),
    runs: scalar('SELECT COUNT(DISTINCT run_id) AS n FROM poetics_items'),
    scored: scalar('SELECT COUNT(DISTINCT item_id) AS n FROM poetics_scores'),
    scores: scalar('SELECT COUNT(*) AS n FROM poetics_scores'),
    critics: scalar('SELECT COUNT(DISTINCT critic_model) AS n FROM poetics_scores'),
    labels: scalar('SELECT COUNT(*) AS n FROM poetics_labels'),
    openFlags: scalar('SELECT COUNT(*) AS n FROM poetics_review_flags WHERE resolved_at IS NULL'),
    disciplines: db
      .prepare(
        `SELECT discipline AS name, COUNT(*) AS n FROM poetics_items
         WHERE discipline IS NOT NULL AND discipline <> ''
         GROUP BY discipline ORDER BY n DESC, name`,
      )
      .all(),
    // The LLM critic's dramatic-form verdict on each scored script
    // (recognition / flat / trap). Counted per critic-verdict row, NOT per
    // script — an item scored by several critics contributes several rows.
    formClass: db
      .prepare(
        `SELECT COALESCE(form_class, '(unclassified)') AS name, COUNT(*) AS n
         FROM poetics_scores GROUP BY form_class ORDER BY n DESC`,
      )
      .all(),
    // Where the corpus lands on each dramatic-form dimension. The rubric is a
    // 0–100 scale quantized to five levels {0,25,50,75,100}; one GROUP BY per
    // dimension returns [{lv, n}], binned into a fixed 5-bar histogram at
    // render time. Dimension names are a hardcoded allowlist (not user input).
    scoreDist: (() => {
      const dims = ['recontextualization', 'stated_insight', 'rupture', 'global_coherence'];
      const out = {};
      for (const d of dims) {
        out[d] = db
          .prepare(
            `SELECT CAST(${d} AS INTEGER) AS lv, COUNT(*) AS n
             FROM poetics_scores WHERE ${d} IS NOT NULL GROUP BY lv ORDER BY lv`,
          )
          .all();
      }
      return out;
    })(),
  };
}

function listItems(db, filters = {}) {
  const where = [];
  const params = {};
  if (filters.runIds?.length) {
    const runPlaceholders = filters.runIds.map((runId, idx) => {
      const key = `runId${idx}`;
      params[key] = runId;
      return `@${key}`;
    });
    where.push(`i.run_id IN (${runPlaceholders.join(', ')})`);
  } else if (filters.runId) {
    where.push('i.run_id = @runId');
    params.runId = filters.runId;
  }
  if (filters.arm) {
    where.push('i.arm = @arm');
    params.arm = filters.arm;
  }
  if (filters.discipline) {
    where.push('i.discipline = @discipline');
    params.discipline = filters.discipline;
  }
  if (filters.role) {
    if (filters.role === 'target') where.push("i.unit_id LIKE 'target-%'");
    else {
      where.push('i.control_role = @role');
      params.role = filters.role;
    }
  }
  if (filters.q) {
    // Free-text across the item's own queryable columns plus the critic's
    // form verdict (recognition / trap / flat). Transcript *body* lives on
    // disk (sample_path / full_transcript_path), not the DB, so it is not
    // searched here — the placeholder reflects exactly what is matchable.
    where.push(
      `(i.id LIKE @q OR i.tid LIKE @q OR i.drama_id LIKE @q OR i.discipline LIKE @q ` +
        `OR i.unit_id LIKE @q OR i.intended_lean LIKE @q OR i.condition_name LIKE @q ` +
        `OR i.control_family LIKE @q OR i.arm LIKE @q ` +
        `OR EXISTS (SELECT 1 FROM poetics_scores sq WHERE sq.item_id = i.id AND sq.form_class LIKE @q))`,
    );
    params.q = `%${filters.q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `
      SELECT
        i.id,
        i.run_id AS runId,
        i.unit_id AS unitId,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id AS dramaId,
        i.discipline,
        i.condition_name AS conditionName,
        i.intended_lean AS intendedLean,
        i.control_family AS controlFamily,
        i.control_role AS controlRole,
        i.sample_path AS samplePath,
        i.full_transcript_path AS fullTranscriptPath,
        i.created_at AS createdAt,
        GROUP_CONCAT(DISTINCT s.critic_model || '=' || COALESCE(s.form_class, '')) AS criticForms,
        MAX(a.learner_self_reframe) AS learnerSelfReframe,
        MAX(a.tutor_contingent_adaptation) AS tutorContingentAdaptation,
        MAX(a.tutor_adaptation_score) AS tutorAdaptationScore,
        MAX(a.metadata) AS tutorAdaptationMetadata,
        COUNT(DISTINCT s.id) AS scoreCount,
        (
          SELECT COUNT(*)
          FROM poetics_scores sx
          WHERE sx.item_id = i.id
            AND (
              CAST(json_extract(sx.metadata, '$.actional_breakthrough') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.learner_actional_breakthrough.score100') AS REAL) >= 75
            )
        ) AS actionalBreakthroughCount,
        (
          SELECT COUNT(*)
          FROM poetics_scores sx
          WHERE sx.item_id = i.id
            AND (
              CAST(json_extract(sx.metadata, '$.adaptive_mechanism_quality') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.tutor_adaptive_mechanism_quality.score100') AS REAL) >= 75
            )
        ) AS adaptiveMechanismQualityCount,
        (
          SELECT COUNT(*)
          FROM poetics_scores sx
          WHERE sx.item_id = i.id
            AND (
              CAST(json_extract(sx.metadata, '$.actional_breakthrough') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.learner_actional_breakthrough.score100') AS REAL) >= 75
            )
            AND (
              CAST(sx.recontextualization AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.learner_self_reframe.score100') AS REAL) >= 75
            )
            AND (
              CAST(json_extract(sx.metadata, '$.tutor_adaptive_mechanism') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.tutor_strategic_reversal') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.tutor_adaptive_mechanism.score100') AS REAL) >= 75
              OR CAST(json_extract(sx.metadata, '$.role_symmetric_scores.tutor_strategy_reversal.score100') AS REAL) >= 75
            )
        ) AS endingShapeCount,
        (
          SELECT COUNT(*)
          FROM poetics_scores sx
          WHERE sx.item_id = i.id
            AND json_extract(sx.metadata, '$.recognition_origin.class') = 'peripeteia_induced'
        ) AS peripeteiaOriginCount,
        (
          SELECT COUNT(*)
          FROM poetics_scores sx
          WHERE sx.item_id = i.id
            AND json_extract(sx.metadata, '$.recognition_origin.class') = 'organic'
        ) AS organicOriginCount,
        COUNT(DISTINCT l.id) AS labelCount,
        COUNT(DISTINCT rf.id) AS reviewFlagCount
      FROM poetics_items i
      LEFT JOIN poetics_scores s ON s.item_id = i.id
      LEFT JOIN poetics_tutor_adaptations a
        ON a.item_id = i.id AND a.analyzer_version = '${TUTOR_ADAPTATION_ANALYZER_VERSION}'
      LEFT JOIN poetics_labels l ON l.item_id = i.id
      LEFT JOIN poetics_review_flags rf ON rf.item_id = i.id AND rf.resolved_at IS NULL
      ${whereSql}
      GROUP BY i.id
      ORDER BY i.run_id DESC, i.repeat, i.unit_id, i.arm, i.tid
      LIMIT 800
    `,
    )
    .all(params)
    .filter((row) => {
      const forms = parseCriticForms(row.criticForms);
      if (filters.queue === 'disagreements') {
        const uniqueForms = new Set(forms.map((entry) => entry.form).filter(Boolean));
        if (uniqueForms.size <= 1) return false;
      }
      if ((filters.queue === 'review' || filters.queue === 'flagged') && Number(row.reviewFlagCount || 0) < 1) {
        return false;
      }
      if (filters.unlabelled && Number(row.labelCount || 0) > 0) return false;
      if (!filters.form && !filters.critic && filters.queue !== 'adaptation-failures') return true;
      return forms.some((entry) => {
        if (filters.form && entry.form !== filters.form) return false;
        if (filters.critic && !entry.critic.includes(filters.critic)) return false;
        return true;
      });
    })
    .map((row, index) => {
      const hydrated = {
        ...row,
        learnerSelfReframe: row.learnerSelfReframe == null ? null : Boolean(row.learnerSelfReframe),
        tutorContingentAdaptation:
          row.tutorContingentAdaptation == null ? null : Boolean(row.tutorContingentAdaptation),
        tutorAdaptationScore: row.tutorAdaptationScore == null ? null : Number(row.tutorAdaptationScore),
        tutorAdaptationMetadata: decodeJson(row.tutorAdaptationMetadata, {}),
        criticForms: parseCriticForms(row.criticForms),
        actionalBreakthroughCount: Number(row.actionalBreakthroughCount || 0),
        adaptiveMechanismQualityCount: Number(row.adaptiveMechanismQualityCount || 0),
        endingShapeCount: Number(row.endingShapeCount || 0),
        peripeteiaOriginCount: Number(row.peripeteiaOriginCount || 0),
        organicOriginCount: Number(row.organicOriginCount || 0),
      };
      hydrated.branchValidity = hydrated.tutorAdaptationMetadata?.branch_validity || null;
      hydrated.peripeteia = hydrated.tutorAdaptationMetadata?.peripeteia || null;
      hydrated.peripeteiaTutorAdaptation = Boolean(
        hydrated.peripeteia?.tutor_adaptive_mechanism || hydrated.peripeteia?.tutor_strategy_reversal,
      );
      hydrated.peripeteiaScore =
        hydrated.peripeteia?.tutor_peripeteia_score == null ? null : Number(hydrated.peripeteia.tutor_peripeteia_score);
      hydrated.consensus = classifyPoeticsConsensus(hydrated.criticForms);
      if (filters.queue === 'adaptation-failures' && !isAdaptationFailureListItem(hydrated)) return null;
      return filters.blind ? blindItem(hydrated, index) : hydrated;
    })
    .filter(Boolean);
}

function isAdaptationFailureListItem(row) {
  const arm = String(row.arm || '');
  if (!['peripeteia-only', 'reframe+peripeteia', 'tutor-uptake-only', 'reframe+tutor-uptake'].includes(arm)) {
    return false;
  }
  const peripeteia = row.tutorAdaptationMetadata?.peripeteia || {};
  const branchValidity = row.tutorAdaptationMetadata?.branch_validity || null;
  if (branchValidity && branchValidity.valid === false) return true;
  if (row.consensus?.claimStatus && row.consensus.claimStatus !== 'claimable') return true;
  if (Number(row.scoreCount || 0) < 4) return true;
  if (arm.includes('peripeteia')) {
    if (!peripeteia.private_mechanism_declared) return true;
    if (!(peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal)) return true;
  }
  if (arm.includes('tutor-uptake') && !row.tutorContingentAdaptation) return true;
  if (arm.includes('reframe') && !row.learnerSelfReframe) return true;
  return false;
}

function blindItem(row, index = 0) {
  return {
    id: row.id,
    blindId: `S${String(index + 1).padStart(3, '0')}`,
    runId: row.runId,
    tid: row.tid,
    createdAt: row.createdAt,
    labelCount: row.labelCount,
    reviewFlagCount: row.reviewFlagCount,
  };
}

function parseCriticForms(value) {
  return parseCriticFormString(value);
}

function scoreValue(value) {
  return value == null || value === '' ? null : Number(value);
}

function scorePasses(value, threshold = 75) {
  const numeric = scoreValue(value);
  return numeric != null && Number.isFinite(numeric) && numeric >= threshold;
}

function roleSymmetricScoresForScore(row) {
  const metadata = row.metadata || {};
  const roleScores = metadata.role_symmetric_scores || {};
  const learner = roleScores.learner_self_reframe || {};
  const actional = roleScores.learner_actional_breakthrough || {};
  const tutor = roleScores.tutor_contingent_adaptation || {};
  const reversal = roleScores.tutor_adaptive_mechanism || roleScores.tutor_strategy_reversal || {};
  const quality = roleScores.tutor_adaptive_mechanism_quality || {};
  return {
    learnerSelfReframeScore: scoreValue(learner.score100 ?? row.recontextualization),
    learnerSelfReframeEvidence: learner.evidence || row.recohered_earlier || '',
    learnerSelfReframeSource: learner.source || 'recontextualization_axis',
    learnerActionalBreakthroughScore: scoreValue(actional.score100 ?? metadata.actional_breakthrough),
    learnerActionalBreakthroughEvidence: actional.evidence || metadata.actional_breakthrough_evidence || '',
    learnerActionalBreakthroughJustification:
      actional.justification || metadata.actional_breakthrough_justification || '',
    learnerActionalBreakthroughTurn: actional.learnerTurn || metadata.actional_breakthrough_learner_turn || null,
    learnerActionalBreakthroughSource: actional.source || (metadata.actional_breakthrough == null ? null : 'metadata'),
    tutorContingentAdaptationScore: scoreValue(tutor.score100 ?? metadata.tutor_contingent_adaptation),
    tutorContingentAdaptationEvidence: tutor.evidence || metadata.tutor_adaptation_evidence || '',
    tutorContingentAdaptationJustification: tutor.justification || metadata.tutor_adaptation_justification || '',
    tutorContingentAdaptationSource: tutor.source || (metadata.tutor_contingent_adaptation == null ? null : 'metadata'),
    tutorStrategyReversalScore: scoreValue(
      reversal.score100 ?? metadata.tutor_adaptive_mechanism ?? metadata.tutor_strategic_reversal,
    ),
    tutorStrategyReversalEvidence: reversal.evidence || metadata.tutor_reversal_evidence || '',
    tutorStrategyReversalJustification: reversal.justification || metadata.tutor_reversal_justification || '',
    tutorStrategyReversalTrigger: reversal.triggerLearnerTurn || metadata.reversal_trigger_learner_turn || null,
    tutorStrategyReversalSource: reversal.source || (metadata.tutor_strategic_reversal == null ? null : 'metadata'),
    tutorAdaptiveMechanismQualityScore: scoreValue(quality.score100 ?? metadata.adaptive_mechanism_quality),
    tutorAdaptiveMechanismQualityEvidence: quality.evidence || metadata.adaptive_mechanism_quality_evidence || '',
    tutorAdaptiveMechanismQualityJustification:
      quality.justification || metadata.adaptive_mechanism_quality_justification || '',
    tutorAdaptiveMechanismQualitySource:
      quality.source || (metadata.adaptive_mechanism_quality == null ? null : 'metadata'),
  };
}

function endingShapeDiagnosticsForScores(scores = []) {
  const rows = scores.map((score) => {
    const role = score.roleScores || roleSymmetricScoresForScore(score);
    const tutorAdaptiveMove = scorePasses(role.tutorStrategyReversalScore);
    const learnerPerformance = scorePasses(role.learnerActionalBreakthroughScore);
    const learnerReorientation = scorePasses(role.learnerSelfReframeScore);
    const adaptiveQuality = scorePasses(role.tutorAdaptiveMechanismQualityScore);
    return {
      critic: score.critic_model,
      form: score.form_class,
      tutorAdaptiveMove,
      learnerPerformance,
      learnerReorientation,
      adaptiveQuality,
      completeEndingShape: tutorAdaptiveMove && learnerPerformance && learnerReorientation,
      scores: {
        tutorAdaptiveMove: role.tutorStrategyReversalScore,
        learnerPerformance: role.learnerActionalBreakthroughScore,
        learnerReorientation: role.learnerSelfReframeScore,
        adaptiveQuality: role.tutorAdaptiveMechanismQualityScore,
      },
      evidence: {
        tutorAdaptiveMove: role.tutorStrategyReversalEvidence,
        learnerPerformance: role.learnerActionalBreakthroughEvidence,
        learnerReorientation: role.learnerSelfReframeEvidence,
        adaptiveQuality: role.tutorAdaptiveMechanismQualityEvidence,
      },
    };
  });
  const count = (key) => rows.filter((row) => row[key]).length;
  const totalCritics = rows.length;
  const diagnostics = {
    totalCritics,
    tutorAdaptiveMoveVotes: count('tutorAdaptiveMove'),
    learnerPerformanceVotes: count('learnerPerformance'),
    learnerReorientationVotes: count('learnerReorientation'),
    adaptiveQualityVotes: count('adaptiveQuality'),
    completeEndingShapeVotes: count('completeEndingShape'),
    criticRows: rows,
    disagreementFlags: [],
  };
  if (totalCritics > 1) {
    for (const [key, label] of [
      ['tutorAdaptiveMove', 'tutor adaptive move'],
      ['learnerPerformance', 'learner public performance'],
      ['learnerReorientation', 'learner reorientation'],
      ['adaptiveQuality', 'adaptive mechanism quality'],
      ['completeEndingShape', 'complete ending shape'],
    ]) {
      const votes = count(key);
      if (votes > 0 && votes < totalCritics) {
        diagnostics.disagreementFlags.push(`${label}: ${votes}/${totalCritics}`);
      }
    }
  }
  return diagnostics;
}

function originDiagnosticsForScores(scores = []) {
  const rows = scores.map((score) => {
    const origin = score.metadata?.recognition_origin || score.recognitionOrigin || recognitionOriginForScoreRow(score);
    return {
      critic: score.critic_model,
      form: score.form_class,
      originClass: origin.class || 'none',
      basis: origin.basis || '',
      justification: origin.justification || '',
      completeEndingShape: Boolean(origin.completeEndingShape),
      scores: origin.scores || {},
      evidence: origin.evidence || {},
    };
  });
  const counts = originCounts(rows.map((row) => ({ class: row.originClass })));
  const totalCritics = rows.length;
  const diagnostics = {
    totalCritics,
    counts,
    criticRows: rows,
    disagreementFlags: [],
  };
  if (totalCritics > 1) {
    const active = ORIGIN_CLASSES.filter((name) => counts[name] > 0);
    if (active.length > 1) {
      diagnostics.disagreementFlags.push(
        `origin disagreement: ${active.map((name) => `${name} ${counts[name]}/${totalCritics}`).join(', ')}`,
      );
    }
    if (counts.organic > 0 && counts.peripeteia_induced > 0) {
      diagnostics.disagreementFlags.push(
        `organic/peripeteia split: organic ${counts.organic}/${totalCritics}, peripeteia ${counts.peripeteia_induced}/${totalCritics}`,
      );
    }
  }
  return diagnostics;
}

function getItem(db, id) {
  const item = db
    .prepare(
      `
      SELECT
        i.*,
        r.source_root AS source_root,
        r.batch_id AS batch_id
      FROM poetics_items i
      JOIN poetics_runs r ON r.id = i.run_id
      WHERE i.id = ?
    `,
    )
    .get(id);
  if (!item) return null;
  const scores = db
    .prepare(
      `
      SELECT critic_model, score_file, form_class, recontextualization, stated_insight,
        rupture, global_coherence, pivot_learner_turn, recohered_earlier,
        stated_insight_evidence, flags, metadata
      FROM poetics_scores
      WHERE item_id = ?
      ORDER BY critic_model
    `,
    )
    .all(id)
    .map((row) => ({
      ...row,
      flags: decodeJson(row.flags, []),
      metadata: decodeJson(row.metadata, {}),
    }))
    .map((row) => ({
      ...row,
      roleScores: roleSymmetricScoresForScore(row),
      recognitionOrigin: row.metadata?.recognition_origin || recognitionOriginForScoreRow(row),
    }));
  const consensus = classifyPoeticsConsensus(
    scores.map((score) => ({ critic: score.critic_model, form: score.form_class })),
  );
  const labels = db
    .prepare(
      `
      SELECT labeller_id, perspective, label_file, form_class, pivot_learner_turn,
        rationale, metadata, labelled_at
      FROM poetics_labels
      WHERE item_id = ?
      ORDER BY perspective, labeller_id
    `,
    )
    .all(id)
    .map((row) => ({ ...row, metadata: decodeJson(row.metadata, {}) }));
  const reviewFlags = db
    .prepare(
      `
      SELECT flagger_id, flag_type, priority, reason, metadata, resolved_at, created_at
      FROM poetics_review_flags
      WHERE item_id = ?
      ORDER BY resolved_at IS NOT NULL, priority DESC, created_at DESC
    `,
    )
    .all(id)
    .map((row) => ({ ...row, metadata: decodeJson(row.metadata, {}) }));
  const tutorAdaptation = db
    .prepare(
      `
      SELECT analyzer_version, source_trace_path, cue_policy, cue_turn_number,
        pivot_learner_turn, learner_self_reframe, learner_reframe_score,
        tutor_pre_turn, tutor_post_turn, tutor_strategy_before, tutor_strategy_after,
        tutor_strategy_shift, pre_tutor_pivot_overlap, post_tutor_pivot_overlap,
        uptake_delta, shared_salient_terms, tutor_contingent_adaptation,
        tutor_adaptation_score, evidence, metadata, created_at
      FROM poetics_tutor_adaptations
      WHERE item_id = ?
      ORDER BY analyzer_version = '${TUTOR_ADAPTATION_ANALYZER_VERSION}' DESC, created_at DESC
      LIMIT 1
    `,
    )
    .get(id);
  const sampleText = readArtifact(item.sample_path) || '';
  const fullTranscriptText = readArtifact(item.full_transcript_path) || '';
  return {
    item: {
      id: item.id,
      runId: item.run_id,
      unitId: item.unit_id,
      repeat: item.repeat,
      arm: item.arm,
      tid: item.tid,
      dramaId: item.drama_id,
      discipline: item.discipline,
      conditionName: item.condition_name,
      intendedLean: item.intended_lean,
      controlFamily: item.control_family,
      controlRole: item.control_role,
      samplePath: item.sample_path,
      fullTranscriptPath: item.full_transcript_path,
      keyPath: item.key_path,
      sourceRoot: item.source_root,
      batchId: item.batch_id,
      createdAt: item.created_at,
      qualityStatus: item.quality_status,
      qualityWarnings: decodeJson(item.quality_warnings, []),
      metadata: decodeJson(item.metadata, {}),
    },
    scores,
    consensus,
    endingShapeDiagnostics: endingShapeDiagnosticsForScores(scores),
    originDiagnostics: originDiagnosticsForScores(scores),
    labels,
    reviewFlags,
    tutorAdaptation: tutorAdaptation
      ? {
          ...tutorAdaptation,
          learner_self_reframe: Boolean(tutorAdaptation.learner_self_reframe),
          tutor_strategy_shift: Boolean(tutorAdaptation.tutor_strategy_shift),
          tutor_contingent_adaptation: Boolean(tutorAdaptation.tutor_contingent_adaptation),
          shared_salient_terms: decodeJson(tutorAdaptation.shared_salient_terms, []),
          metadata: decodeJson(tutorAdaptation.metadata, {}),
        }
      : null,
    sampleText,
    fullTranscriptText,
    samplePreview: parseTranscriptPreview(sampleText),
    fullTranscriptPreview: parseTranscriptPreview(fullTranscriptText),
  };
}

function getBlindItem(db, id, { labellerId = null } = {}) {
  const detail = getItem(db, id);
  if (!detail) return null;
  const ownLabel = labellerId
    ? detail.labels.find((label) => label.labeller_id === labellerId && label.perspective === 'human-browser') || null
    : null;
  return {
    item: {
      id: detail.item.id,
      runId: detail.item.runId,
      tid: detail.item.tid,
    },
    label: ownLabel,
    sampleText: detail.sampleText,
    samplePreview: detail.samplePreview,
  };
}

const LABEL_FORMS = new Set(['recognition', 'trap', 'flat']);

function normalizeLabellerId(value) {
  return String(value || '')
    .trim()
    .replace(/[^\w-]/g, '');
}

function saveBrowserLabel(db, input) {
  const itemId = String(input.itemId || '').trim();
  const labellerId = normalizeLabellerId(input.labellerId);
  const formClass = String(input.formClass || '').trim();
  if (!itemId) throw new Error('missing itemId');
  if (!labellerId) throw new Error('missing labellerId');
  if (!LABEL_FORMS.has(formClass)) throw new Error('formClass must be recognition|trap|flat');
  const item = db.prepare('SELECT id, run_id FROM poetics_items WHERE id = ?').get(itemId);
  if (!item) throw new Error(`unknown itemId: ${itemId}`);
  const pivot =
    input.pivotLearnerTurn == null || input.pivotLearnerTurn === ''
      ? null
      : Number.parseInt(input.pivotLearnerTurn, 10);
  if (pivot != null && (!Number.isInteger(pivot) || pivot < 1)) throw new Error('pivotLearnerTurn must be positive');
  upsertPoeticsLabel(db, {
    itemId,
    labellerId,
    perspective: 'human-browser',
    labelFile: `browser:${item.run_id}:${labellerId}`,
    formClass,
    pivotLearnerTurn: pivot,
    rationale: input.rationale || null,
    labelledAt: new Date().toISOString(),
    metadata: {
      rubricVersion: 'phase2-form-3way-v1',
      interface: 'poetics-browser',
      blind: true,
    },
  });
  return getBlindItem(db, itemId, { labellerId });
}

function normalizeReviewPriority(value) {
  const priority = String(value || 'normal').trim();
  return ['low', 'normal', 'high'].includes(priority) ? priority : 'normal';
}

function saveBrowserReviewFlag(db, input) {
  const itemId = String(input.itemId || '').trim();
  const flaggerId = normalizeLabellerId(input.flaggerId || 'codex');
  const flagType = normalizeLabellerId(input.flagType || 'human_review') || 'human_review';
  if (!itemId) throw new Error('missing itemId');
  if (!flaggerId) throw new Error('missing flaggerId');
  const item = db.prepare('SELECT id, run_id FROM poetics_items WHERE id = ?').get(itemId);
  if (!item) throw new Error(`unknown itemId: ${itemId}`);
  upsertPoeticsReviewFlag(db, {
    itemId,
    flaggerId,
    flagType,
    priority: normalizeReviewPriority(input.priority),
    reason: input.reason || null,
    metadata: {
      interface: input.interface || 'poetics-browser',
      source: input.source || null,
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
    },
  });
  return getItem(db, itemId);
}

function createPoeticsBrowserApp({ dbPath = null, host = '127.0.0.1' } = {}) {
  const db = openPoeticsStore(dbPath || undefined);
  const app = express();
  // Liveness probe with no auth — registered before the guard so a load
  // balancer's health check (e.g. fly) gets a 200, not a 401. It returns only
  // "ok", so it leaks nothing.
  app.get('/healthz', (_req, res) => res.type('text/plain').send('ok\n'));
  // Basic-auth guard before every data route. Open on localhost with no creds;
  // throws (refuses to start) on a public bind without creds — see httpBasicAuth.js.
  const authGuard = resolveBasicAuthGuard({ prefix: 'POETICS', host, realm: 'machine spirits poetics' });
  if (authGuard) {
    app.use(authGuard);
    console.log('[poetics] basic-auth ENABLED (credentials required)');
  }
  // Default-deny role gate (Design A — perimeter RBAC). No-op on localhost-open
  // and for the admin role; restricts a 'participant' credential to the pilot +
  // adjudication allowlist (services/httpBasicAuth.js PARTICIPANT_ALLOWLIST), so
  // every metered/researcher surface on this consolidated app stays admin-only.
  app.use(makeRoleGate());
  app.use(express.json({ limit: '256kb' }));
  app.use('/images', express.static(path.resolve(ROOT, 'notes/poetics/images'), { index: false }));
  app.use('/assets', express.static(path.resolve(ROOT, 'notes/poetics/assets'), { index: false }));
  app.use('/docs/research', express.static(path.resolve(ROOT, 'docs/research'), { index: false }));
  app.locals.db = db;
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/api/runs', (_req, res) => res.json({ runs: listRuns(db), disciplines: distinctDisciplines(db) }));
  app.get('/api/stats', (_req, res) => res.json({ ...corpusStats(db), replays: listReplayBundles().length }));
  app.get('/api/items', (req, res) => {
    const runIds = String(req.query.runIds || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    res.json({
      items: listItems(db, {
        runId: req.query.runId || null,
        runIds,
        q: req.query.q || null,
        arm: req.query.arm || null,
        discipline: req.query.discipline || null,
        role: req.query.role || null,
        form: req.query.form || null,
        critic: req.query.critic || null,
        queue: req.query.queue || null,
        unlabelled: req.query.unlabelled === '1',
        blind: req.query.blind === '1',
      }),
    });
  });
  app.get('/api/item', (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'missing id' });
    const item =
      req.query.blind === '1'
        ? getBlindItem(db, id, { labellerId: normalizeLabellerId(req.query.labeller || '') })
        : getItem(db, id);
    if (!item) return res.status(404).json({ error: 'not found' });
    return res.json(item);
  });
  app.post('/api/labels', (req, res) => {
    try {
      const detail = saveBrowserLabel(db, req.body || {});
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.post('/api/review-flags', (req, res) => {
    try {
      const detail = saveBrowserReviewFlag(db, req.body || {});
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.post('/api/tts', async (req, res) => {
    try {
      const speech = await synthesizeLemonFoxSpeech(req.body || {});
      return res
        .status(200)
        .set({
          'Content-Type': speech.contentType,
          'Cache-Control': 'no-store',
          'X-TTS-Voice': speech.request.voice,
          'X-TTS-Role': speech.request.role,
        })
        .send(speech.buffer);
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message || String(error) });
    }
  });
  app.get('/compose', (_req, res) => res.type('html').send(renderComposeHtml()));
  // Standalone nav fragment so the static tool surfaces (/chat, /adjudication,
  // /pilot-admin) can fetch + inject the SAME rail the rendered pages carry.
  // railHtml() is the single source of nav truth; `bare: true` drops the bits
  // that belong only to a dashboard-rendered page (the shader canvas, the x-ray
  // overlay, the grid/theme toggles, and the three enhancer scripts) so the
  // fragment carries only the rail + its own .rail* CSS — no host-page CSS bleed
  // and no duplicate #field/#xrayGrid ids. See public/components/rail-inject.js.
  app.get('/_nav.html', (req, res) =>
    res.type('html').send(railHtml({ active: String((req.query && req.query.active) || ''), bare: true })),
  );
  app.post('/api/compose/validate', async (req, res) => {
    try {
      const spec = (req.body && req.body.spec) || {};
      const turnPlan = Array.isArray(spec.turn_plan) ? spec.turn_plan : [];
      const targets = (spec.drama && spec.drama.targets) || [];
      const validation = await validateTurnPlan(turnPlan, targets);
      return res.json({ ok: true, validation, yaml: specToYaml(spec) });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.post('/api/compose/write', async (req, res) => {
    try {
      const spec = (req.body && req.body.spec) || {};
      const force = !!(req.body && req.body.force);
      const turnPlan = Array.isArray(spec.turn_plan) ? spec.turn_plan : [];
      const targets = (spec.drama && spec.drama.targets) || [];
      const validation = await validateTurnPlan(turnPlan, targets);
      if (!validation.ok && !force) {
        return res.status(409).json({ error: 'turn_plan has form conflicts', needsForce: true, validation });
      }
      const yamlText = specToYaml(spec);
      const filename = safeDramaFilename(req.body && req.body.filename, spec.drama && spec.drama.id);
      const destDir = path.resolve(ROOT, 'exports/drama-specs');
      const dest = path.resolve(destDir, filename);
      if (!dest.startsWith(`${destDir}${path.sep}`)) {
        return res.status(400).json({ error: 'unsafe filename' });
      }
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(dest, yamlText, 'utf8');
      return res.json({
        ok: true,
        path: path.relative(ROOT, dest),
        bytes: Buffer.byteLength(yamlText),
        yaml: yamlText,
        validation,
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  // The sampler walks the SAME ontology the validator checks: suggest a valid, varied turn
  // for the given targets + role, conditioned on the tutor architecture (the alter-egos).
  app.post('/api/compose/suggest', async (req, res) => {
    try {
      const body = req.body || {};
      const targets = Array.isArray(body.targets) && body.targets.length ? body.targets : ['peripeteia'];
      const role = ['tutor', 'learner', 'director'].includes(body.role) ? body.role : 'tutor';
      const agencies = body.architecture ? agenciesForArchitecture(body.architecture) : undefined;
      const entry = await sampleTurnPlan(targets, role, {
        agencies,
        persona: body.persona,
        seed: String(body.seed || ''),
      });
      return res.json({
        ok: true,
        turn: { turn: entry.at?.turn ?? 3, role: entry.role, target: entry.target || '', moves: entry.moves },
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  // ── Live "sit-in" compose (human plays one seat, AI plays the other) ────────
  // METERED + localhost-only, same posture as the /runs launcher below: every AI
  // turn is a real LLM call UNLESS the request opts into mock deps (free, canned
  // logarithm lines — for trialling the UI). Session state is in-memory in
  // services/poetics/liveCompose.js; nothing touches the eval DB. The client is
  // authoritative for the mock flag and re-sends it on every turn.
  app.get('/compose/live', (_req, res) => res.type('html').send(renderComposeLiveHtml()));
  app.post('/api/compose/live/start', async (req, res) => {
    try {
      const body = req.body || {};
      const deps = body.mock ? liveBuildMockDeps() : {};
      const out = await liveStartSession(body.spec || {}, deps);
      return res.status(201).json(out);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.post('/api/compose/live/turn', async (req, res) => {
    try {
      const body = req.body || {};
      const deps = body.mock ? liveBuildMockDeps() : {};
      // The client re-sends its console (deliberation) toggle on every turn; the
      // per-turn meta (time/latency/tokens) always ships regardless of this flag.
      const out = await liveHumanTurn(body.id, body.text, deps, { debug: !!body.showDeliberation });
      return res.json(out);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.get('/api/compose/live/:id', (req, res) => {
    try {
      const debug = req.query.debug === '1' || req.query.debug === 'true';
      return res.json({ session: liveViewSession(req.params.id, { debug }) });
    } catch (error) {
      return res.status(error.statusCode || 404).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.post('/api/compose/live/save', (req, res) => {
    try {
      const body = req.body || {};
      const out = liveSaveSession(body.id, { filename: body.filename });
      return res.json({ ok: true, ...out });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  // Terminate a live scene early. Idempotent: marks the session done so no more
  // turns can be appended, then the client can score the (now frozen) transcript.
  app.post('/api/compose/live/:id/end', (req, res) => {
    try {
      const body = req.body || {};
      return res.json({ ok: true, session: liveEndSession(req.params.id, body.reason || 'user_ended') });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  // Score the transcript-so-far against the poetics rubric. Metered (one critic
  // call) unless body.mock swaps in the deterministic free-preview verdict.
  app.post('/api/compose/live/:id/score', async (req, res) => {
    try {
      const body = req.body || {};
      const deps = body.mock ? liveBuildMockDeps() : {};
      const out = await liveScoreSession(req.params.id, deps);
      return res.json({ ok: true, ...out });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  // The "reading" behind the scene: when a sit-in is bound to a course lecture, the
  // human learner can read the SAME text the AI tutor is grounded in (closing the
  // tutor-reads / learner-can't asymmetry). Read-only, no spend — just resolves the ref.
  app.get('/api/compose/live/lecture/:ref', (req, res) => {
    try {
      const lecture = liveGetLectureContent(req.params.ref);
      if (!lecture)
        return res.status(404).json({ error: `no lecture for ref '${req.params.ref}'`, code: 'LIVE_NO_LECTURE' });
      const { courseId, courseTitle, lectureNum, lectureRef, title } = lecture;
      return res.json({
        ok: true,
        lecture: { courseId, courseTitle, lectureNum, lectureRef, title, html: mdLectureToHtml(lecture.text) },
      });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  // The "describe it in plain language" guide: an LLM reads a free-text wish and
  // proposes a full compose spec, clamped to the live vocabulary + real course
  // catalog. Metered (one OpenRouter call) unless body.mock is set, which swaps
  // in a deterministic canned spec for a zero-cost preview.
  app.post('/api/compose/live/guide', async (req, res) => {
    try {
      const body = req.body || {};
      const catalog = {
        courses: liveListCourses(),
        personas: COMPOSER_VOCAB.personas,
        learnerArch: COMPOSER_VOCAB.learnerArch,
      };
      const deps = body.mock ? liveBuildMockGuideDeps() : {};
      const out = await liveProposeSpec({ description: body.description, catalog }, deps);
      return res.json({ ok: true, ...out });
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.get('/ontology', (_req, res) => res.type('html').send(renderOntologyHtml()));
  app.get('/rubric', (_req, res) => res.type('html').send(renderRubricHtml()));
  app.get('/api/ontology', (req, res) => {
    try {
      const view = ['system', 'tutor', 'learner'].includes(req.query.view) ? req.query.view : 'system';
      const modules = parseModulesParam(req.query.modules);
      return res.json(buildOntologyView({ view, modules }));
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.get('/replays', (_req, res) => res.type('html').send(renderReplaysHtml()));
  app.get('/api/replays', (_req, res) => res.json({ bundles: listReplayBundles() }));
  app.get('/api/replays/:bundle', (req, res) => {
    const name = req.params.bundle;
    if (!isSafeBundleName(name)) return res.status(400).json({ error: 'invalid bundle name' });
    const bundle = readReplayBundle(name);
    if (!bundle) return res.status(404).json({ error: 'bundle not found' });
    return res.json(bundle);
  });
  app.get('/api/replays/:bundle/item', (req, res) => {
    const name = req.params.bundle;
    const itemId = req.query.id;
    if (!isSafeBundleName(name)) return res.status(400).json({ error: 'invalid bundle name' });
    if (!itemId) return res.status(400).json({ error: 'missing item id' });
    const item = readReplayItem(name, String(itemId));
    if (!item) return res.status(404).json({ error: 'item not found' });
    return res.json(item);
  });

  // ── Job launcher (POST surfaces spawn whitelisted CLI scripts) ──────────────
  // Localhost-only, no auth (deferred per 2026-06-04 decision). The UI defaults
  // every form to free/mock/dry-run; planJob previews the exact argv before any
  // spawn, and metered/quota jobs are serialised by jobRunner's lock.
  app.get('/runs', (_req, res) => res.type('html').send(renderRunsHtml()));
  app.get('/api/jobs/kinds', (_req, res) => res.json({ kinds: describeKinds(), costClasses: COST_CLASSES }));
  app.post('/api/jobs/plan', (req, res) => {
    const { kind, params } = req.body || {};
    try {
      return res.json({ plan: planJob({ kind, params }) });
    } catch (error) {
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.post('/api/jobs', (req, res) => {
    const { kind, params } = req.body || {};
    try {
      const job = launchJob({ kind, params });
      return res.status(201).json({ job });
    } catch (error) {
      if (error.code === 'SERIAL_BUSY') return res.status(409).json({ error: error.message });
      return res.status(400).json({ error: error.message || String(error) });
    }
  });
  app.get('/api/jobs', (_req, res) => res.json({ jobs: listJobs() }));
  app.get('/api/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'job not found' });
    return res.json({ job });
  });
  app.post('/api/jobs/:id/stop', (req, res) => {
    const job = stopJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'job not found' });
    return res.json({ job });
  });
  // GET /summary wraps the raw synthesis note (served at /arc) in a same-origin
  // iframe beneath the standard scriptorium rail, so it carries the common nav
  // links without fighting the doc's own viewport-anchored chrome. /arc still
  // serves the bare techne doc — it's both the iframe src and a legacy alias for
  // any external/published references to the old path.
  app.get('/summary', (_req, res) => res.type('html').send(summaryWrapperHtml()));
  app.get('/arc', (_req, res) => {
    const notePath = path.resolve(ROOT, 'notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html');
    if (!fs.existsSync(notePath)) return res.status(404).type('text').send('summary note not found');
    res.type('html').sendFile(notePath);
  });
  // GET /story serves the bare "story so far" techne note (relative assets/*
  // resolve against /assets, served by the static route above). Unlike the
  // durable /summary synthesis, this is a dated, provisional lab-notebook
  // narrative of the adaptation arc — it links to /summary + the paper for the
  // claims that have earned the right to be stable.
  app.get('/story', (_req, res) =>
    res.type('html').send(
      framedNoteHtml({
        active: 'story',
        sub: 'the story so far — a dated, provisional narrative of the adaptation arc',
        src: '/story-doc',
        title: 'The story so far · the adaptation arc',
        hint: orientBand(
          'story so far',
          'a dated, provisional lab-notebook narrative of the adaptation arc',
          'project notes; the working surfaces are on the rail above',
        ),
      }),
    ),
  );
  app.get('/story-doc', (_req, res) => {
    const notePath = path.resolve(ROOT, 'notes/poetics/2026-06-06-adaptation-story-so-far.html');
    if (!fs.existsSync(notePath)) return res.status(404).type('text').send('story-so-far note not found');
    res.type('html').sendFile(notePath);
  });
  // GET /repertoire serves the bare "three instruments, one repertoire" techne
  // note (relative assets/* resolve against /assets, served by the static route
  // above). It analyses the three measurement instruments (ontology memory ·
  // small rhetorical phrasing · large dramatic turns) by grain, then proposes a
  // repertoire of controlled adaptive mechanisms to exploit the few real wins,
  // with a filterable gallery of failed & minimally-succeeded adaptation. Like
  // /story it narrates and links; durable claims live in /summary + the paper.
  app.get('/repertoire', (_req, res) =>
    res.type('html').send(
      framedNoteHtml({
        active: 'repertoire',
        sub: 'three instruments, one repertoire — measurement grain & a repertoire of controlled adaptive mechanisms',
        src: '/repertoire-doc',
        title: 'Controlled adaptation repertoire · machine spirits',
        hint: orientBand(
          'repertoire',
          'what the three measurement instruments caught, and the adaptive mechanisms the wins might become',
          'project notes; the working surfaces are on the rail above',
        ),
      }),
    ),
  );
  app.get('/repertoire-doc', (_req, res) => {
    const notePath = path.resolve(ROOT, 'notes/poetics/2026-06-06-controlled-adaptation-repertoire.html');
    if (!fs.existsSync(notePath)) return res.status(404).type('text').send('repertoire note not found');
    res.type('html').sendFile(notePath);
  });
  // GET /board serves the bare "development board" techne note (relative assets/*
  // resolve against /assets, served by the static route above). It is a read-only
  // rendering of TODO.md: the 48 tracked items as a two-axis filterable board
  // (status × theme), with the 8 open items given detailed treatment and the 40
  // closed/ruled-out items archived as one-line cards. It originates no claims —
  // durable results live in /summary + the paper; TODO.md remains the source.
  app.get('/board', (_req, res) =>
    res.type('html').send(
      framedNoteHtml({
        active: 'board',
        sub: 'the development board — TODO.md as a two-axis filterable board (status × theme)',
        src: '/board-doc',
        title: 'Development board · machine spirits',
        hint: orientBand(
          'board',
          'a read-only rendering of TODO.md — every tracked item as a status × theme grid',
          'project notes; the working surfaces are on the rail above',
        ),
      }),
    ),
  );
  app.get('/board-doc', (_req, res) => {
    const notePath = path.resolve(ROOT, 'notes/poetics/2026-06-06-development-board.html');
    if (!fs.existsSync(notePath)) return res.status(404).type('text').send('development-board note not found');
    res.type('html').sendFile(notePath);
  });
  app.get('/derivation', (_req, res) => res.type('html').send(renderDerivationIndexHtml(listDerivationRuns())));
  app.get('/derivation/:label', (req, res) => {
    const run = readDerivationRun(req.params.label);
    if (!run) return res.status(404).type('text').send('derivation run not found');
    res.type('html').send(renderDerivationRunHtml(run));
  });
  app.get('/browse', (_req, res) => res.type('html').send(renderBrowserHtml()));
  // Fold in the eval server's surfaces (the four /api/* routers + the public/
  // UI dirs: /chat, /pilot, /pilot-admin, /adjudication, /components, /docs) so
  // this one port hosts both the poetics scriptorium and the eval app. Shared
  // with server.js via services/evalSurfaces.js — single source, no drift.
  // Mounted AFTER the poetics routes (so /api/* and /compose stay poetics-owned)
  // and AFTER /docs/research (line ~864, { index:false }) so the paper subtree
  // keeps precedence over the broader /docs mount here; BEFORE the catch-all '/'.
  mountEvalSurfaces(app, { root: ROOT });
  app.get('/', (req, res) => {
    // Deep links from before the browser moved to /browse (e.g. /?runId=…,
    // /?itemId=…) still arrive at /. Preserve them by forwarding the query.
    const keys = Object.keys(req.query || {});
    if (keys.length) {
      const qs = new URLSearchParams(req.query).toString();
      return res.redirect(302, '/browse' + (qs ? '?' + qs : ''));
    }
    const derivationRuns = listDerivationRuns();
    // The deterministic rule-checker's verdict on each proof run (grounded /
    // disengagement / aporia). Tallied here from the diagnoses already loaded —
    // NOT a quality score, just the outcome the checker decided.
    const proofVerdicts = {};
    for (const r of derivationRuns) {
      const v = r?.diagnosis?.verdict || '(none)';
      proofVerdicts[v] = (proofVerdicts[v] || 0) + 1;
    }
    const recentRuns = listRuns(db).slice(0, 6);
    // Attach each feed row's recontextualization series for its inline sparkline.
    const seriesMap = runScoreSeries(
      db,
      recentRuns.map((r) => r.id),
    );
    for (const r of recentRuns) r.spark = seriesMap.get(r.id) || [];
    const stats = {
      ...corpusStats(db),
      replays: listReplayBundles().length,
      proofRuns: derivationRuns.length,
      proofVerdicts,
      recentRuns,
    };
    return res.type('html').send(renderDashboardHtml(stats));
  });
  return app;
}

// ── Drama composer (GET /compose) ─────────────────────────────────────────────
// A form-based front-end to the drama-machine spec model (notes/poetics/drama-
// machine/SPEC.md): renders the Aristotelian slots, validates a turn_plan against
// the poetics ontology live (POST /api/compose/validate), and writes a
// .drama.yaml (POST /api/compose/write). The same headless work the
// /ms-drama-machine skill does, with human visibility.
const COMPOSER_VOCAB = Object.freeze({
  forms: [
    'peripeteia',
    'anagnorisis',
    'catharsis',
    'surprise_inevitability',
    'unity_of_action',
    'hamartia_integration',
  ],
  promptTypes: ['recognition', 'base', 'placebo', 'naive', 'dialectical_suspicious', 'matched_recognition'],
  tutorArch: ['ego_superego', 'ego_only', 'id_director'],
  superego: ['suspicious', 'standard', 'adversary', 'advocate', 'strict', 'coupling'],
  // Sourced from the live engine so the sit-in form, its CLI, and the LLM guide
  // can't drift (see liveCompose.LIVE_VOCAB).
  personas: LIVE_VOCAB.personas,
  learnerArch: LIVE_VOCAB.learnerArch,
  continuationPolicy: ['none', 'anchor', 'revoice', 'reconsider', 'reframe'],
  adaptationPolicy: [
    'none',
    'routine',
    'uptake',
    'peripeteia',
    'uptake+peripeteia',
    'socratic_discovery',
    'reveal_secret',
  ],
  speakers: ['learner', 'tutor', 'director'],
  stagePolicy: ['sparse', 'none', 'none_except_required_cue', 'short', 'interventionist', 'rich'],
  stageStyle: [
    'object_business',
    'bare_transcript',
    'scene_heading',
    'ambient_pressure',
    'placard_caption',
    'thread_metadata',
    'choric_margin',
    'rich_scene_work',
  ],
  grading: ['graded', 'binary'],
  blinding: ['arm-blind', 'omniscient', 'fully-blind'],
  roles: ['tutor', 'learner', 'director'],
  movesByRole: {
    tutor: [
      'stock_take',
      'route_change',
      'action_gate',
      'uptake',
      'meter',
      'recognition_press',
      'withhold',
      'reveal',
      'register_shift',
      'status_shift',
      'foreshadow',
    ],
    learner: ['revoice', 'reconsider', 'reframe', 'perform_device', 'voice_misfit', 'genuine_anagnorisis', 'aporia'],
    director: ['inject_revisit_cue', 'inject_reversal_pressure', 'scene_interruption'],
  },
  // Moves/triggers the ontology flags as contraindicating a form — selectable so
  // the live validator visibly fires (hold ⊣ peripeteia, pseudo_catharsis ⊣ catharsis).
  antiPatterns: ['hold', 'pseudo_catharsis'],
  castSuggest: ['llm:api:sonnet', 'llm:claude:opus', 'llm:codex', 'llm:gemini', 'human', 'mock'],
  panelSuggest: ['gpt', 'deepseek-v4-pro', 'qwen3.7-max', 'gemini-3.5-flash'],
});

// Recursively drop null / '' / empty arrays / empty objects so the emitted YAML is clean.
function pruneEmpty(value) {
  if (Array.isArray(value)) {
    const arr = value.map(pruneEmpty).filter((v) => v !== undefined);
    return arr.length ? arr : undefined;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const pv = pruneEmpty(v);
      if (pv !== undefined) out[k] = pv;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === '') return undefined;
  return value;
}

function specToYaml(spec) {
  return YAML.stringify(pruneEmpty(spec) || {}, { lineWidth: 0 });
}

// Path-safe basename for a written spec: strip any directory, force a .drama.yaml suffix.
function safeDramaFilename(name, fallbackId) {
  const base = String(name || fallbackId || 'drama').trim();
  let slug = base
    .replace(/\.drama\.ya?ml$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  if (!slug) slug = 'drama';
  return `${slug}.drama.yaml`;
}

const composeOptions = (list, selected) =>
  list
    .map((v) => `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`)
    .join('');

// Same as composeOptions but renders friendlier display labels (underscores →
// spaces) while keeping the raw value — so the form still POSTs the exact vocab
// term but the reader sees "ego superego" instead of "ego_superego".
const composeOptionsPretty = (list, selected) =>
  list
    .map(
      (v) =>
        `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(
          String(v).replace(/_/g, ' '),
        )}</option>`,
    )
    .join('');

// The live-only AI-learner model picker. The blank default keeps the configured
// learner model (kimi-k2.5, a reasoning model that occasionally emits an empty
// external turn); the rest are raw OpenRouter slugs the engine uses verbatim
// (they contain "/", so they bypass dot-alias resolution) — a plain-completion
// escape hatch for when the default returns a blank line.
const LEARNER_MODEL_CHOICES = [
  { value: '', label: 'default · kimi-k2.5 (reasoning)' },
  { value: 'openai/gpt-5-mini', label: 'gpt-5-mini' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'claude sonnet 4.6' },
  { value: 'nvidia/nemotron-3-nano-30b-a3b', label: 'nemotron nano' },
  { value: 'z-ai/glm-4.7', label: 'glm 4.7' },
  { value: 'google/gemini-3-flash-preview', label: 'gemini 3 flash' },
];
const composeLearnerModelOptions = () =>
  LEARNER_MODEL_CHOICES.map((m) => `<option value="${escapeHtml(m.value)}">${escapeHtml(m.label)}</option>`).join('');

const composeDatalist = (id, list) =>
  `<datalist id="${id}">${list.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('')}</datalist>`;

// The syllabus picker for both composers. The course catalog lives in the engine
// (liveCompose.listCourses) so the picker, the AI guide, and the curriculum-injection
// bridge all read one source. Rather than one flat <select> burying the curriculum,
// it is a two-tier course → lesson picker (the syllabus, made explicit at both
// levels) with a caption that names the chosen course + its one-line subtitle.
// content-test-* courses come back flagged isFixture, so they sort last + are labelled.

// The catalog as client JSON — the lesson <select> is repopulated in the browser
// from this when a course is picked, so the two tiers stay in sync without a fetch.
const composeCoursesJson = () => JSON.stringify(liveListCourses());

// Course <select> options: a "free topic" sentinel + one option per course.
const composeCourseOptions = () =>
  ['<option value="">— free topic · no course —</option>']
    .concat(
      liveListCourses().map(
        (c) =>
          `<option value="${escapeHtml(c.courseId)}">${escapeHtml(
            c.isFixture ? `${c.courseTitle} · test fixture` : c.courseTitle,
          )}</option>`,
      ),
    )
    .join('');

// The two-tier picker markup: a course <select>, a lesson <select> (filled
// client-side), and a caption line. ids are caller-supplied so the live page can
// keep lessonId='f-lecture' (what begin()/applySpecToForm already read) while the
// spec page uses 'd-lecture'. lessonHint distinguishes "ground the tutor" (live,
// where the engine injects the lecture) from "borrow a topic" (spec, batch).
const composeSyllabusPicker = ({ courseId, lessonId, capId, lessonHint }) =>
  `<label class="fld">syllabus · course<select id="${courseId}">${composeCourseOptions()}</select><span class="hint">a real course to teach from — or leave free to teach from the topic alone</span></label>` +
  `<label class="fld">syllabus · lesson<select id="${lessonId}" disabled><option value="">— pick a course first —</option></select><span class="hint">${escapeHtml(
    lessonHint,
  )}</span></label>` +
  `<div class="syl-cap" id="${capId}"></div>`;

// Shared client wiring (injected into both composers' <script>, so the two pages
// can't drift). Relies on esc() + $ being defined in the host scope (both are).
// mkSyllabus repopulates the lesson <select> when the course changes, paints the
// caption, and calls onPick(option) when a lesson is chosen. setByRef() lets the
// AI guide drive it from a proposed lectureRef (derives the course from the ref).
const SYLLABUS_CLIENT_JS = `
function mkSyllabus(courses, courseSel, lessonSel, capEl, onPick){
  function findCourse(id){ for(var i=0;i<courses.length;i++){ if(courses[i].courseId===id) return courses[i]; } return null; }
  function fillLessons(cid, ref){
    var c = findCourse(cid);
    var html = '<option value="">'+(c ? '— whole course · pick a lesson —' : '— pick a course first —')+'</option>';
    if(c){ for(var i=0;i<c.lectures.length;i++){ var l=c.lectures[i]; html += '<option value="'+esc(l.ref)+'" data-topic="'+esc(l.title)+'">L'+l.num+' · '+esc(l.title)+'</option>'; } }
    lessonSel.innerHTML = html; lessonSel.disabled = !c;
    if(ref){ lessonSel.value = ref; }
  }
  function caption(){
    var c = findCourse(courseSel.value);
    if(!c){ capEl.innerHTML = '<span class="muted">no course — the scene teaches from the free-text topic below</span>'; return; }
    var l=null; for(var i=0;i<c.lectures.length;i++){ if(c.lectures[i].ref===lessonSel.value){ l=c.lectures[i]; break; } }
    var html = '<b>'+esc(c.courseTitle)+'</b>'+(c.courseSubtitle ? (' — '+esc(c.courseSubtitle)) : '');
    html += l ? ('<br><b>Lesson '+l.num+':</b> '+esc(l.title)) : ('<br><span class="muted">'+c.lectures.length+' lessons — pick one to ground the scene</span>');
    capEl.innerHTML = html;
  }
  courseSel.addEventListener('change', function(){ fillLessons(courseSel.value); caption(); if(onPick){ onPick(null); } });
  lessonSel.addEventListener('change', function(){ caption(); if(onPick){ onPick(lessonSel.options[lessonSel.selectedIndex]); } });
  caption();
  return {
    setByRef: function(ref){
      if(!ref){ courseSel.value=''; fillLessons(''); caption(); return; }
      var cid = String(ref).split('-lecture-')[0];
      courseSel.value = cid; fillLessons(cid, ref); caption();
    }
  };
}
`;

const composeFormChecks = (selected) =>
  COMPOSER_VOCAB.forms
    .map(
      (f) =>
        `<label class="chk"><input type="checkbox" class="f-target" value="${escapeHtml(f)}"${
          selected.includes(f) ? ' checked' : ''
        }> ${escapeHtml(f)}</label>`,
    )
    .join('');

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Minimal block-markdown → HTML for the sit-in "reading" panel: headings, paragraphs,
// `-`/`*`/`1.` lists, fenced code, blockquotes, rules, plus inline bold/italic/code. It
// mirrors the chat bubble's mdInline subset (asterisk emphasis only, so snake_case ids
// survive) but adds block structure so a whole lecture reads legibly. NOT a general
// CommonMark engine — scoped to lecture prose. esc-first, so lecture source can't inject
// markup. Rendered server-side (sane escaping) rather than in the client template string.
function mdLectureToHtml(md) {
  const inline = (t) =>
    escapeHtml(t)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  const lines = String(md ?? '')
    .replace(/<a\b[^>]*>\s*<\/a>/g, '') // drop empty anchor targets (e.g. <a id="…"></a>) that pollute headings
    .replace(/\r\n?/g, '\n')
    .split('\n');
  const out = [];
  let i = 0;
  const list = (tag, items) => `<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`;
  const blockStart = /^(#{1,6}\s|```|>|\s*[-*+]\s+|\s*\d+\.\s+|-{3,}\s*$|\*{3,}\s*$)/;
  while (i < lines.length) {
    const ln = lines[i];
    if (/^```/.test(ln)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }
    if (!ln.trim()) {
      i++;
      continue;
    }
    const h = ln.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(6, h[1].length + 3);
      out.push(`<h${lvl}>${inline(h[2].replace(/\s+#+\s*$/, ''))}</h${lvl}>`);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (/^>\s?/.test(ln)) {
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      out.push(list('ul', items));
      continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(list('ol', items));
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !blockStart.test(lines[i])) {
      p.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return out.join('');
}

// Single source of truth for the top-nav items, consumed by railHtml() — which
// every scriptorium page renders, including the /summary iframe wrapper. Adding an
// entry here adds the tab everywhere at once. Each entry is [key, href, label, title].
// The rail's destination table (key → href, label, title). The rail does NOT
// render these flat: it shows NAV_PRIMARY as plain links and folds the rest into
// the labelled NAV_GROUPS dropdowns, so the bar stays legible (was 10 flat links
// crowding one row). The former :8081 eval server's researcher-facing
// interactive surfaces (/chat, /adjudication) plus the operator console
// (/pilot-admin) fold in here as a "tools" group, so the primary bar stays at
// four. /pilot stays OUT of the rail — it is the participant study surface
// (reached by a study link), and must not leak researcher chrome to subjects.
const NAV = [
  ['home', '/', 'home', 'Dashboard — overview, live stats &amp; guided first steps'],
  [
    'browse',
    '/browse',
    'scripts',
    'Generated drama scripts scored by LLM critics — full traces, scores &amp; human labels',
  ],
  [
    'compose',
    '/compose/live',
    'compose a scene',
    'Sit in on a tutoring scene turn by turn — or switch to batch-spec mode to assemble a full spec',
  ],
  ['runs', '/runs', 'launch a run', 'Launch new runs — generative · replay · adversarial-CLI · online scoring'],
  ['ontology', '/ontology', 'ontology', 'The shared ontology — system, tutor &amp; learner lenses'],
  ['rubric', '/rubric', 'rubric', 'The poetics rubric — the 6 dramatic-form dimensions critics score against'],
  ['replays', '/replays', 'replays', 'Counterfactual replays diffed against their originals'],
  [
    'derivation',
    '/derivation',
    'proof runs',
    'Tutoring runs where the tutor must lead the learner to a hidden answer by inference — a fixed rule-checker (not an AI judge, not a quality score) decides whether they got there: grounded / impasse / disengaged',
  ],
  [
    'summary',
    '/summary',
    'summary',
    'The synthesis note — the whole dramatic-recognition arc, from the paper to this scriptorium',
  ],
  ['story', '/story', 'story', 'The story so far — a dated, provisional narrative of the adaptation arc'],
  [
    'repertoire',
    '/repertoire',
    'repertoire',
    'Three measurement instruments analysed by grain &amp; a repertoire of controlled adaptive mechanisms — with a gallery of failed &amp; minimally-succeeded adaptation',
  ],
  [
    'board',
    '/board',
    'board',
    'The development board — every tracked item as a filterable status × theme grid: what is open, what is closed, what is ruled out',
  ],
  [
    'tutor',
    '/chat',
    'tutor',
    'Interactive tutor — play the learner &amp; watch the ego/superego deliberation for any cell in tutor-agents.yaml',
  ],
  [
    'adjudicate',
    '/adjudication',
    'adjudicate',
    'Blinded A19 human-adjudication forms — complete coding tasks through the dashboard',
  ],
  [
    'pilot-admin',
    '/pilot-admin',
    'pilot admin',
    'Pilot operator console — session monitoring, recruitment toggle &amp; run launching (admin token-gated)',
  ],
];
// Shown flat, left-to-right: the three reading surfaces (scripts = critic-graded
// generation corpus at /browse; proof runs = rule-checked staging loop at
// /derivation; replays = counterfactual diffs) then the two make-something actions
// (compose a scene, launch a run).
const NAV_PRIMARY = ['home', 'browse', 'derivation', 'replays', 'compose', 'runs'];
// Folded into labelled dropdowns, in order: the reference surfaces, then the
// dated/durable techne notes. A group whose member is the active page shows a
// moss accent on its summary so the current location is still legible when closed.
const NAV_GROUPS = [
  ['tools', ['tutor', 'pilot-admin']],
  ['reference', ['ontology', 'rubric']],
  ['notes', ['summary', 'story', 'repertoire', 'board']],
];

// A per-page orientation band (the `hint` slot of railHtml): "<b>here</b> — what",
// then a pointer back to the working surfaces. Mirrors the corpus-distinction bands
// on /browse, /derivation and /runs so every page tells a first-time visitor where
// they are and how to get back to the things you read and make.
function orientBand(here, what, tail = 'the working surfaces are on the rail above') {
  return `<span><b>${here}</b> — ${what}</span><span class="navhint__sep">·</span><span>${tail}</span>`;
}

// Single source of truth for the top-nav markup + the specimen ground every page
// shares: a spinning brick mark, the prussian MMXXVI stamp, and the warm Klee-drift
// shader "field" canvas (ported from /chat). The active link gets aria-current + an
// inline accent (theme vars exist on every page) so no page needs a bespoke
// active-state rule. The shader self-gates on prefers-reduced-motion and is hidden
// by CSS in dark theme (it is a light-paper pigment field); the canvas + its IIFE
// ride here because every page already calls railHtml() exactly once, so this is the
// one place that puts the ground on all of them. `extra` (e.g. /browse's live DB
// beacon) sits to the LEFT of the nav links so the menu + theme-toggle cluster stays
// identical on every page, beacon or not.
function railHtml({ active = '', brand = 'machine spirits', sub = '', extra = '', hint = '', bare = false } = {}) {
  const byKey = Object.fromEntries(NAV.map((n) => [n[0], n]));
  const link = (key) => {
    const n = byKey[key];
    if (!n) return '';
    const [, href, label, title] = n;
    const on = key === active;
    const attrs = on
      ? ' aria-current="page" style="color:var(--moss-deep);border-color:var(--moss);background:var(--moss-soft)"'
      : '';
    return `<a class="rail__btn" href="${href}" title="${title}"${attrs}>${label}</a>`;
  };
  const primary = NAV_PRIMARY.map(link).join('\n    ');
  const groups = NAV_GROUPS.map(([label, keys]) => {
    // A closed group whose member is the current page keeps a moss accent so the
    // active location stays legible without opening the menu.
    const onAttrs = keys.includes(active) ? ' style="color:var(--moss-deep);border-color:var(--moss)"' : '';
    const items = keys.map(link).join('\n      ');
    return `<details class="rail__menu"><summary class="rail__btn"${onAttrs}>${label}</summary><div class="rail__pop">
      ${items}
    </div></details>`;
  }).join('\n    ');
  // railHtml owns BOTH the rail markup and its styling. The full rule set rides
  // inline here (like the canvas below), emitted as the first node in the body so
  // it parses before first paint. That makes it the single source: pages built via
  // pageHead()+BASE_CSS and the bespoke-head /browse (which skips BASE_CSS) all get
  // the identical rail with no second copy to drift. Do NOT re-add a .rail* block to
  // BASE_CSS or any page's head — change the rail here, once.
  return `<style id="rail-extra">
.rail{ position:sticky; top:0; z-index:30; background:color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); border-bottom:1px solid var(--rule); font-family:"JetBrains Mono","SFMono-Regular",Consolas,monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); }
.rail__inner{ display:flex; align-items:center; gap:.9em; padding:.55em clamp(.8rem,2vw,1.2rem); }
.rail__brand{ font-family:"Fraunces","Source Serif 4",Georgia,serif; font-style:italic; font-variation-settings:"SOFT" 50,"WONK" 1,"opsz" 96; font-size:17px; letter-spacing:-.005em; text-transform:none; color:var(--ink); flex:0 0 auto; }
.rail__brand::before{ content:""; }
.rail__sub{ flex:1 1 auto; color:var(--ink-3); text-transform:none; letter-spacing:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rail__glyph{ flex:0 0 auto; color:var(--brick); display:inline-flex; align-items:center; font-size:1.2em; line-height:1; transform-origin:50% 50%; animation:railspin 32s linear infinite; }
@keyframes railspin{ to{ transform:rotate(360deg); } }
.rail__stamp{ flex:0 0 auto; display:inline-flex; align-items:center; gap:.4em; color:var(--ink-3); letter-spacing:.18em; }
.rail__stamp-glyph{ color:var(--prussian); }
.rail__btn{ display:inline-flex; align-items:center; gap:.45em; border:1px solid var(--rule); background:transparent; color:var(--ink-3); font:inherit; padding:.32em .8em; cursor:pointer; text-decoration:none; flex:0 0 auto; transition:color .15s var(--ease), border-color .15s var(--ease); }
.rail__btn:hover{ color:var(--ink); border-color:var(--ink-3); }
/* live-status beacon — only rendered on pages that pass it via railHtml's \`extra\` slot (e.g. /browse) */
.rail__beacon{ display:inline-flex; align-items:center; gap:.55em; padding:.3em .75em; border:1px solid var(--rule); background:var(--paper-3); color:var(--ink-3); flex:0 0 auto; }
.rail__beacon[data-state="live"]{ color:var(--moss-deep); border-color:color-mix(in srgb, var(--moss) 55%, var(--rule)); }
.rail__beacon[data-state="offline"]{ color:var(--ink-3); }
.rail__dot{ width:7px; height:7px; border-radius:50%; background:var(--ink-4); flex:0 0 auto; }
.rail__beacon[data-state="checking"] .rail__dot{ background:var(--ochre); animation:railPulse 1.2s var(--ease) infinite; }
.rail__beacon[data-state="live"] .rail__dot{ background:var(--moss); animation:railPulse 2.2s var(--ease) infinite; }
@keyframes railPulse{ 0%{ box-shadow:0 0 0 0 color-mix(in srgb, currentColor 55%, transparent); } 70%{ box-shadow:0 0 0 7px color-mix(in srgb, currentColor 0%, transparent); } 100%{ box-shadow:0 0 0 0 color-mix(in srgb, currentColor 0%, transparent); } }
.rail__menu{ position:relative; flex:0 0 auto; }
.rail__menu>summary{ list-style:none; cursor:pointer; }
.rail__menu>summary::-webkit-details-marker{ display:none; }
.rail__menu>summary::after{ content:"▾"; margin-left:.4em; font-size:.8em; opacity:.55; }
.rail__menu[open]>summary{ color:var(--ink); border-color:var(--ink-3); }
.rail__pop{ position:absolute; top:calc(100% + 7px); right:0; min-width:190px; display:flex; flex-direction:column; gap:3px; padding:7px; background:color-mix(in srgb, var(--paper) 96%, transparent); border:1px solid var(--rule); border-radius:9px; box-shadow:0 10px 30px rgba(28,22,16,.18); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:40; }
.rail__pop .rail__btn{ border-color:transparent; justify-content:flex-start; width:100%; }
.rail__pop .rail__btn:hover{ border-color:var(--rule); background:var(--paper-3); }
/* orientation band — a per-page "what this is / where its siblings are" note, rendered just under the rail */
.navhint{ display:flex; flex-wrap:wrap; align-items:baseline; gap:.35em .9em; padding:.5em clamp(.8rem,2vw,1.2rem); border-bottom:1px solid var(--rule-soft); background:color-mix(in srgb, var(--paper) 70%, transparent); font-family:"JetBrains Mono","SFMono-Regular",Consolas,monospace; font-size:11px; letter-spacing:.03em; line-height:1.5; color:var(--ink-3); }
.navhint b{ color:var(--ink-2); font-weight:600; }
.navhint a{ color:var(--moss-deep); text-decoration:none; border-bottom:1px solid color-mix(in srgb, var(--moss) 42%, transparent); white-space:nowrap; }
.navhint a:hover{ border-bottom-color:var(--moss); }
.navhint .navhint__sep{ color:var(--ink-4); }
${
  bare
    ? ''
    : `.xray-overlay{ position:fixed; inset:0; pointer-events:none; z-index:12; opacity:0; transition:opacity .25s var(--ease,ease); }
body.xray-on .xray-overlay{ opacity:1; }
.xray-overlay__grid{ position:absolute; inset:0; padding-inline:var(--margin,clamp(12px,1.8vw,34px)); display:grid; grid-template-columns:repeat(60,1fr); column-gap:var(--gutter,clamp(3px,0.32vw,8px)); }
.xray-overlay__col{ background:color-mix(in oklab, var(--brick,#A53E2E) 7%, transparent); outline:1px dashed color-mix(in oklab, var(--brick,#A53E2E) 22%, transparent); outline-offset:-1px; }
.xray-overlay__col[data-i="23"], .xray-overlay__col[data-i="37"]{ background:color-mix(in oklab, var(--sun,#E4B644) 14%, transparent); outline-color:var(--brick,#A53E2E); }
.xray-overlay__col[data-i="30"]{ outline-color:color-mix(in oklab, var(--prussian,#2A4F6B) 55%, transparent); }
#gridToggle[aria-pressed="true"]{ color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }`
}
@media (max-width:860px){
  .rail__brand{ font-size:14px; }
  .rail__inner{ gap:.6em; padding:.45em .8em; }
  .rail__sub{ display:none; }
}
</style>
${
  bare
    ? ''
    : `<canvas id="field" aria-hidden="true" style="position:fixed;inset:0;width:100vw;height:100vh;z-index:-3;opacity:.5;pointer-events:none"></canvas>
<div class="xray-overlay" id="xrayOverlay" aria-hidden="true"><div class="xray-overlay__grid" id="xrayGrid"></div></div>`
}
<header class="rail">
  <div class="rail__inner">
    <span class="rail__glyph" aria-hidden="true">◐</span>
    <span class="rail__brand">${brand}</span>
    <span class="rail__sub">${sub}</span>
    ${extra}${primary}
    ${groups}
    ${
      bare
        ? ''
        : `<button class="rail__btn" id="gridToggle" type="button" aria-pressed="false" title="grid — toggle the 60-column layout overlay (alignment aid)">grid</button>
    <button class="rail__btn" id="themeToggle" type="button">theme</button>`
    }
    <span class="rail__stamp" aria-hidden="true"><span class="rail__stamp-glyph">◎</span>MMXXVI</span>
  </div>
</header>
${hint ? `<div class="navhint" role="note">${hint}</div>` : ''}${
    bare
      ? ''
      : `
<script>
(function () {
  var canvas = document.getElementById('field');
  if (!canvas) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power', alpha: true });
  if (!gl) return;
  var vs = 'attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }';
  var fs = [
    'precision highp float;',
    'uniform vec2 u_res; uniform float u_t; uniform vec2 u_mouse;',
    'float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
    '  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));',
    '  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y); }',
    'float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.52; } return v; }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy/u_res.xy;',
    '  vec2 p = (gl_FragCoord.xy - 0.5*u_res.xy)/min(u_res.x,u_res.y);',
    '  float t = u_t*0.015;',
    '  vec2 q = p*1.6 + vec2(t*0.4,-t*0.3);',
    '  vec2 r = p*2.3 - vec2(t*0.5, t*0.25);',
    '  float warm = fbm(q + vec2(fbm(q+t)));',
    '  float cool = fbm(r - vec2(fbm(r-t*0.7)));',
    '  vec2 m = (u_mouse - 0.5*u_res.xy)/min(u_res.x,u_res.y);',
    '  float md = length(p-m);',
    '  float bloom = smoothstep(0.55, 0.0, md) * 0.12;',
    '  vec3 paper    = vec3(0.945, 0.913, 0.847);',
    '  vec3 ochre    = vec3(0.753, 0.541, 0.243);',
    '  vec3 prussian = vec3(0.165, 0.310, 0.420);',
    '  vec3 brick    = vec3(0.647, 0.243, 0.180);',
    '  vec3 sulphur  = vec3(0.894, 0.714, 0.267);',
    '  vec3 col = paper;',
    '  col = mix(col, ochre,    smoothstep(0.38, 0.72, warm) * 0.45);',
    '  col = mix(col, sulphur,  smoothstep(0.55, 0.85, warm) * 0.22);',
    '  col = mix(col, prussian, smoothstep(0.46, 0.80, cool) * 0.16);',
    '  col = mix(col, brick,    smoothstep(0.72, 0.92, cool*warm) * 0.14);',
    '  float vig = smoothstep(1.2, 0.3, length(p));',
    '  col *= mix(0.90, 1.02, vig);',
    '  col += bloom * vec3(0.9, 0.55, 0.2);',
    '  float grain = (hash(gl_FragCoord.xy + vec2(t*120.0)) - 0.5) * 0.035;',
    '  col += grain;',
    '  float cx = uv.x * 60.0;',
    '  float line = smoothstep(0.985, 1.0, abs(fract(cx)-0.5)*2.0);',
    '  col = mix(col, col*0.94, line * 0.22);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\\n');
  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { return null; }
    return sh;
  }
  var v = compile(gl.VERTEX_SHADER, vs);
  var f = compile(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  var loc_pos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc_pos);
  gl.vertexAttribPointer(loc_pos, 2, gl.FLOAT, false, 0, 0);
  var u_res = gl.getUniformLocation(prog, 'u_res');
  var u_t = gl.getUniformLocation(prog, 'u_t');
  var u_mouse = gl.getUniformLocation(prog, 'u_mouse');
  var mouse = [0, 0]; var mouseTarget = [0, 0];
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(canvas.clientWidth * dpr);
    var h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', function (e) {
    mouseTarget[0] = e.clientX * dpr;
    mouseTarget[1] = (window.innerHeight - e.clientY) * dpr;
  }, { passive: true });
  var last = 0; var step = 1000 / 45; var darkCleared = false;
  function frame(now) {
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
      if (!darkCleared) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); darkCleared = true; }
      requestAnimationFrame(frame); return;
    }
    darkCleared = false;
    if (now - last >= step) {
      last = now;
      resize();
      mouse[0] += (mouseTarget[0] - mouse[0]) * 0.06;
      mouse[1] += (mouseTarget[1] - mouse[1]) * 0.06;
      gl.uniform2f(u_res, canvas.width, canvas.height);
      gl.uniform1f(u_t, now * 0.001);
      gl.uniform2f(u_mouse, mouse[0], mouse[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', function () { if (document.hidden) last = performance.now(); });
})();
</script>
<script>
(function () {
  // Rail dropdowns (native <details>): only one open at a time, close on
  // outside-click or Escape. Separate IIFE so it runs even when the shader IIFE
  // above bails early (reduced-motion / no-WebGL).
  var menus = [].slice.call(document.querySelectorAll('.rail__menu'));
  if (!menus.length) return;
  menus.forEach(function (m) {
    m.addEventListener('toggle', function () {
      if (m.open) menus.forEach(function (o) { if (o !== m) o.open = false; });
    });
  });
  document.addEventListener('click', function (e) {
    var inside = menus.some(function (m) { return m.contains(e.target); });
    if (!inside) menus.forEach(function (m) { m.open = false; });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') menus.forEach(function (m) { m.open = false; });
  });
})();
</script>
<script>
(function () {
  // Grid x-ray: a 60-column alignment overlay matching the --cols/--margin/--gutter
  // design grid this page already sits on (the faint vertical rules in body::before).
  // Builder aid, off by default; sessionStorage keeps it on across full-page nav
  // within a tab so an alignment pass survives clicking between pages, then clears
  // when the tab closes (no "still gridded tomorrow" surprise for a research viewer).
  var grid = document.getElementById('xrayGrid');
  var btn = document.getElementById('gridToggle');
  if (!grid || !btn) return;
  if (!grid.children.length) {
    for (var i = 0; i < 60; i++) {
      var c = document.createElement('div');
      c.className = 'xray-overlay__col';
      c.setAttribute('data-i', i);
      grid.appendChild(c);
    }
  }
  function apply(on) {
    document.body.classList.toggle('xray-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  try { if (sessionStorage.getItem('poetics-grid') === 'on') apply(true); } catch (_e) {}
  btn.addEventListener('click', function () {
    var on = !document.body.classList.contains('xray-on');
    apply(on);
    try { sessionStorage.setItem('poetics-grid', on ? 'on' : ''); } catch (_e) {}
  });
})();
</script>`
  }`;
}

// The summary note is an external techne-framework HTML doc that owns its own
// viewport-anchored chrome (a fixed TOC sidebar + a sticky section rail).
// Splicing a scriptorium strip above it loses the left of the strip under that
// fixed chrome, so GET /summary instead wraps the raw doc — served at /arc — in
// a same-origin iframe beneath the standard rail. The doc's fixed sidebar then
// anchors to the iframe, the rail owns the real top with the common links
// (summary active), and a small script mirrors the rail's light/dark into the
// framed doc so the two layers stay in step.
// Generalised note-wrapper: any raw techne doc served at a single-segment path
// (so its relative assets/* resolve to /assets/*) can be framed beneath the
// standard rail. `src` is that single-segment doc path, `active` the NAV key to
// highlight, `frameTitle` the iframe's a11y label (defaults to the page title).
// ── Dramatic-derivation staging-loop viewer ──────────────────────────────────
// Read-only window onto exports/dramatic-derivation/loop/<label>/ — each run
// dir holds {result.json, diagnosis.json, transcript.md} written by
// scripts/run-derivation-loop.js. Pages render from the STRUCTURED artifacts
// (result.json + diagnosis.json; world YAML loaded only as the author's-sketch
// fallback when the director declared no movements), not by parsing the
// markdown twin. No metered surface: spawns nothing, writes nothing — safe
// alongside the auth posture in the header note.
const DERIVATION_LOOP_DIR = path.resolve(ROOT, 'exports/dramatic-derivation/loop');
const DERIVATION_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/; // path-traversal guard

function listDerivationRuns() {
  if (!fs.existsSync(DERIVATION_LOOP_DIR)) return [];
  const runs = [];
  for (const name of fs.readdirSync(DERIVATION_LOOP_DIR)) {
    if (!DERIVATION_LABEL_RE.test(name)) continue;
    const diagPath = path.join(DERIVATION_LOOP_DIR, name, 'diagnosis.json');
    try {
      runs.push({
        label: name,
        mtimeMs: fs.statSync(diagPath).mtimeMs,
        diagnosis: JSON.parse(fs.readFileSync(diagPath, 'utf8')),
        hasNotice: fs.existsSync(path.join(DERIVATION_LOOP_DIR, name, 'commentary.md')),
      });
    } catch {
      /* partial or corrupt run dir — not listable */
    }
  }
  return runs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function readDerivationRun(label) {
  if (!DERIVATION_LABEL_RE.test(label)) return null;
  const dir = path.join(DERIVATION_LOOP_DIR, label);
  let diagnosis;
  let result;
  try {
    diagnosis = JSON.parse(fs.readFileSync(path.join(dir, 'diagnosis.json'), 'utf8'));
    result = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8'));
  } catch {
    return null;
  }
  let world = null;
  try {
    world = loadDerivationWorld(path.resolve(ROOT, diagnosis.worldPath));
  } catch {
    /* world file moved/renamed — declared movements still render; only the sketch fallback is lost */
  }
  let commentary = null;
  try {
    commentary = fs.readFileSync(path.join(dir, 'commentary.md'), 'utf8');
  } catch {
    /* no notice yet — the page shows the backfill hint */
  }
  return { label, diagnosis, result, world, commentary };
}

// Backend chips tolerate both ledger formats: per-role ({mode, roles:{...}},
// current) and the flat pre-per-role shape ({mode, provider, model}).
function derivationBackendChips(backend = {}) {
  const chips = [`mode ${backend.mode || '?'}`];
  if (backend.roles) {
    for (const [role, t] of Object.entries(backend.roles)) {
      chips.push(`${role} ${t.provider}/${t.model || '(cli default)'}`);
    }
  } else if (backend.provider) {
    chips.push(`all roles ${backend.provider}/${backend.model || '(cli default)'}`);
  }
  return chips;
}

// Compact backend cell for the runs index: group the roles by the model that
// played them, so a typical run (three tutor-side roles on one model, learner
// on another) reads as two lines instead of four near-identical ones. The
// "(cli default)" suffix is dropped — it carries no signal in a dense table.
function derivationBackendCell(backend = {}) {
  const short = (provider, model) => (model && model !== '(cli default)' ? `${provider}/${model}` : provider);
  let pairs;
  if (backend.roles) {
    pairs = Object.entries(backend.roles).map(([role, t]) => [role, short(t.provider, t.model)]);
  } else if (backend.provider) {
    return escapeHtml(short(backend.provider, backend.model));
  } else {
    return '—';
  }
  const byModel = new Map();
  for (const [role, model] of pairs) {
    if (!byModel.has(model)) byModel.set(model, []);
    byModel.get(model).push(role);
  }
  return [...byModel.entries()]
    .map(
      ([model, roles]) =>
        `<span class="bk"><span class="bk__m">${escapeHtml(model)}</span> <span class="bk__r">${escapeHtml(
          roles.join(', '),
        )}</span></span>`,
    )
    .join('');
}

const DERIVATION_SUCCESS_EVENTS = new Set(['forced', 'grounded_anagnorisis']);

// Trope glossary for the tutor's move-figure labels. The two figures the
// rhetoric ontology registers (anaphora, erotema) take their gloss verbatim
// from config/ontology/rhetoric-core.ttl rdfs:labels; the other three are
// glossed per the tutor scripts' own usage. Lookup is case-insensitive;
// unknown figures render as plain labels.
const DERIVATION_FIGURE_GLOSSARY = {
  erotema:
    'rhetorical question (erotema / interrogatio): a question asked not for information but to assert or press — the audience supplies the answer ("How long, Catiline, will you abuse our patience?").',
  anaphora: 'repetition at the START of successive clauses ("we shall fight … we shall fight …").',
  analogia:
    'argument by proportion — the known case carried onto the unknown one ("a watermark is to paper what a signature is not to music").',
  exemplum:
    'a concrete instance made to carry the rule — the particular case offered as evidence for the general claim.',
  aposiopesis:
    'breaking off mid-sentence and leaving the thought unfinished — the silence invites the hearer to complete the inference.',
};

// A move-figure label, expandable to its gloss when the glossary knows it.
function derivationFigureHtml(figure) {
  const name = String(figure || '—');
  const gloss = DERIVATION_FIGURE_GLOSSARY[name.toLowerCase().trim()];
  if (!gloss) return escapeHtml(name);
  return `<details class="figdef"><summary title="show what this figure is">${escapeHtml(name)}</summary><span class="figdef__t">${escapeHtml(gloss)}</span></details>`;
}

// Inline markdown → HTML for the derivation artifacts (escape first, then the
// few spans the panel/notice/proof actually use: \`code\`, **bold**, *italic*,
// and «fact» — the proof prose marks logical tokens with guillemets).
function derivationInlineMd(text) {
  return escapeHtml(String(text))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/«([^»]+)»/g, '<span class="fact">«$1»</span>');
}

// Block-level markdown → HTML, sized to what the run artifacts emit
// (renderEvalPanel, commentary.md): ##/### headings (mapped one level down so
// they sit under the page's own h2 sections), nested "- " lists, pipe tables,
// "> " blockquotes, paragraphs. Not a general markdown engine on purpose —
// the artifacts are ours, and everything is escaped before any tag is added.
function derivationMdToHtml(md) {
  const lines = String(md || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const out = [];
  const para = [];
  const quote = [];
  let listDepth = 0;
  let tableRows = null;

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${derivationInlineMd(para.join(' '))}</p>`);
    para.length = 0;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote>${derivationInlineMd(quote.join(' '))}</blockquote>`);
    quote.length = 0;
  };
  const closeLists = (to = 0) => {
    while (listDepth > to) {
      out.push('</ul>');
      listDepth -= 1;
    }
  };
  const flushTable = () => {
    if (!tableRows) return;
    const [head, ...body] = tableRows;
    const cells = (row, tag) => row.map((c) => `<${tag}>${derivationInlineMd(c)}</${tag}>`).join('');
    out.push(
      `<table><thead><tr>${cells(head, 'th')}</tr></thead>${
        body.length ? `<tbody>${body.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody>` : ''
      }</table>`,
    );
    tableRows = null;
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    closeLists();
    flushTable();
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\|.*\|$/.test(line.trim())) {
      flushPara();
      flushQuote();
      closeLists();
      const cells = line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      if (!tableRows) tableRows = [];
      tableRows.push(cells);
      continue;
    }
    if (tableRows) flushTable();
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      const level = Math.min(heading[1].length + 1, 4);
      out.push(`<h${level}>${derivationInlineMd(heading[2])}</h${level}>`);
      continue;
    }
    const item = line.match(/^(\s*)-\s+(.*)$/);
    if (item) {
      flushPara();
      flushQuote();
      const depth = Math.floor(item[1].length / 2) + 1;
      while (listDepth < depth) {
        out.push('<ul>');
        listDepth += 1;
      }
      closeLists(depth);
      out.push(`<li>${derivationInlineMd(item[2])}</li>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      closeLists();
      flushTable();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushQuote();
    closeLists();
    flushTable();
    para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

// The dramaturgical arc as an inline SVG: movement bands behind a step-after
// D(t) staircase, release ▲ ticks (hover = which premise, via whom), the
// forced moment as a dashed vertical, the grounded assertion as a star, event
// flags at the top. All colors ride the page's CSS variables, so dark mode
// follows for free. Tolerates the early-run diagnosis shape (no slope/staging).
function renderDerivationArcSvg({
  trajectory = [],
  segments = [],
  ledger = [],
  events = [],
  world = null,
  result = {},
}) {
  if (!trajectory.length) return '<p class="mono">(no trajectory recorded)</p>';
  const W = 940;
  const left = 44;
  const right = 16;
  const top = 16;
  const plotH = 220;
  const bottom = top + plotH;
  const H = bottom + 46;
  const t0 = trajectory[0].turn;
  const tN = Math.max(trajectory[trajectory.length - 1].turn, t0 + 1);
  const maxD = Math.max(...trajectory.map((p) => p.D), 1);
  const x = (turn) => left + ((turn - t0) / (tN - t0)) * (W - left - right);
  const y = (D) => bottom - (D / maxD) * plotH;
  const svg = [];

  // movement bands (alternating wash) + clipped names, full title on hover
  segments.forEach((seg, i) => {
    const x0 = Math.max(x(seg.turns[0] - 0.5), left);
    const x1 = Math.min(x(seg.turns[1] + 0.5), W - right);
    if (x1 <= x0) return;
    if (i % 2 === 0) {
      svg.push(
        `<rect x="${x0.toFixed(1)}" y="${top}" width="${(x1 - x0).toFixed(1)}" height="${plotH}" class="arc__band"/>`,
      );
    }
    const label = String(seg.title || '');
    const fit = Math.max(0, Math.floor((x1 - x0 - 10) / 6.4));
    const shown = label.length > fit ? `${label.slice(0, Math.max(fit - 1, 0))}…` : label;
    if (shown) {
      svg.push(
        `<text x="${(x0 + 5).toFixed(1)}" y="${top + 13}" class="arc__bandlabel">${escapeHtml(shown)}<title>${escapeHtml(
          `${label} (turns ${seg.turns[0]}–${seg.turns[1]}${seg.source === 'director' ? ', declared by the director' : ''})${seg.intent ? ` — ${seg.intent}` : ''}`,
        )}</title></text>`,
      );
    }
  });

  // D gridlines + axis labels (thin to every 2nd line when D runs deep)
  const dStep = maxD > 10 ? 2 : 1;
  for (let level = 0; level <= maxD; level += dStep) {
    svg.push(
      `<line x1="${left}" y1="${y(level).toFixed(1)}" x2="${W - right}" y2="${y(level).toFixed(1)}" class="arc__grid"/>`,
      `<text x="${left - 6}" y="${(y(level) + 3.5).toFixed(1)}" text-anchor="end" class="arc__tick">${level}</text>`,
    );
  }
  // turn axis ticks every 5
  for (let turn = Math.ceil(t0 / 5) * 5; turn <= tN; turn += 5) {
    svg.push(
      `<line x1="${x(turn).toFixed(1)}" y1="${bottom}" x2="${x(turn).toFixed(1)}" y2="${bottom + 4}" class="arc__grid"/>`,
      `<text x="${x(turn).toFixed(1)}" y="${bottom + 15}" text-anchor="middle" class="arc__tick">${turn}</text>`,
    );
  }

  // the forced moment — dashed vertical where the board first compels S
  const forcedTurn = result.firstForcedTurn ?? null;
  if (forcedTurn !== null) {
    svg.push(
      `<line x1="${x(forcedTurn).toFixed(1)}" y1="${top}" x2="${x(forcedTurn).toFixed(1)}" y2="${bottom}" class="arc__forced"/>`,
      `<text x="${(x(forcedTurn) + 4).toFixed(1)}" y="${top + 30}" class="arc__forcedlabel">forced t${forcedTurn}</text>`,
    );
  }

  // step-after staircase: D holds until the next turn moves it
  const d0 = trajectory[0];
  let dPath = `M ${x(d0.turn).toFixed(1)} ${y(d0.D).toFixed(1)}`;
  for (let i = 1; i < trajectory.length; i += 1) {
    dPath += ` H ${x(trajectory[i].turn).toFixed(1)} V ${y(trajectory[i].D).toFixed(1)}`;
  }
  svg.push(`<path d="${dPath}" class="arc__d"/>`);
  for (const p of trajectory) {
    svg.push(
      `<circle cx="${x(p.turn).toFixed(1)}" cy="${y(p.D).toFixed(1)}" r="2.4" class="arc__dot${p.forced ? ' arc__dot--forced' : ''}"><title>turn ${p.turn} — D=${p.D}${p.forced ? ' (S forced)' : ''}, ${p.groundedCount ?? '?'} facts grounded</title></circle>`,
    );
  }

  // release ▲ ticks under the axis — which premise, via whom, on hover
  const premiseById = new Map((world?.premises || []).map((p) => [p.id, p]));
  const relByTurn = new Map();
  for (const entry of ledger) {
    if (!relByTurn.has(entry.turn)) relByTurn.set(entry.turn, []);
    relByTurn.get(entry.turn).push(entry);
  }
  for (const [turn, entries] of relByTurn) {
    const title = entries
      .map((e) => {
        const surface = premiseById.get(e.premiseId)?.surface;
        return `${e.premiseId}${surface ? ` — ${surface}` : ''} (via ${e.via})`;
      })
      .join('\n');
    svg.push(
      `<text x="${x(turn).toFixed(1)}" y="${bottom + 30}" text-anchor="middle" class="arc__rel">▲<title>${escapeHtml(`released turn ${turn}:\n${title}`)}</title></text>`,
    );
  }

  // event flags inside the top edge (stacked when a turn carries several)
  const evByTurn = new Map();
  for (const event of events) {
    if (!evByTurn.has(event.turn)) evByTurn.set(event.turn, []);
    evByTurn.get(event.turn).push(event);
  }
  for (const [turn, list] of evByTurn) {
    list.forEach((e, i) => {
      const ok = DERIVATION_SUCCESS_EVENTS.has(e.type);
      svg.push(
        `<text x="${x(turn).toFixed(1)}" y="${top + 44 + i * 13}" text-anchor="middle" class="arc__flag ${ok ? 'arc__flag--ok' : 'arc__flag--bad'}">⚑<title>${escapeHtml(`${e.type} — ${e.detail || ''}`)}</title></text>`,
      );
    });
  }

  // the grounded assertion — a star where the recognition landed
  const assertedTurn = result.assertedGroundedTurn ?? null;
  if (assertedTurn !== null) {
    const at = trajectory.find((p) => p.turn === assertedTurn);
    svg.push(
      `<text x="${x(assertedTurn).toFixed(1)}" y="${(y(at ? at.D : 0) - 8).toFixed(1)}" text-anchor="middle" class="arc__star">★<title>grounded assertion at turn ${assertedTurn}</title></text>`,
    );
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="arc" role="img" aria-label="D(t) — remaining derivation distance per turn, with movements, releases and events">${svg.join('')}</svg>`;
}

// The slope line under the arc, in words (mirrors the ASCII curve's caption).
function derivationSlopeCaption(slope) {
  if (!slope) return '';
  const overall = slope.overall?.ratePerTurn;
  const perAct = (slope.perAct || [])
    .map((a) => `${a.act} ${a.ratePerTurn === null ? '—' : a.ratePerTurn.toFixed(2)}`)
    .join(' · ');
  return `<p class="slopecap">slope ${overall === null || overall === undefined ? '—' : overall.toFixed(2)} D/turn overall (D ${slope.d0}→${slope.dFinal})${perAct ? ` · per movement: ${perAct}` : ''} — D counts the premises still missing for the nearest proof of the secret; ▲ marks evidence entering the room.</p>`;
}

function shortFactLabel(fact) {
  if (!Array.isArray(fact) || !fact.length) return '—';
  return fact.join(' ');
}

function targetProgress(target) {
  const total = target?.sourcePremiseIds?.length || 0;
  const held = target?.heldSourcePremiseIds?.length || 0;
  const decayed = target?.decayedSourcePremiseIds?.length || 0;
  return { total, held, decayed, pct: total ? held / total : target?.derived ? 1 : 0 };
}

function renderDerivationLogicVisualizer(logicProjection) {
  const turns = logicProjection?.turns || [];
  if (!turns.length) {
    return '<p class="notice-missing">No logic projection snapshots are present for this run. New loop artifacts include them automatically.</p>';
  }

  const W = 940;
  const labelW = 92;
  const right = 12;
  const top = 20;
  const rowH = 34;
  const gap = 8;
  const rows = [
    { key: 'rules', label: 'rules fired' },
    { key: 'unvoiced', label: 'unvoiced' },
    { key: 'secret', label: 'secret path' },
    { key: 'mirror', label: 'mirror path' },
  ];
  const H = top + rows.length * rowH + (rows.length - 1) * gap + 36;
  const colW = (W - labelW - right) / Math.max(turns.length, 1);
  const maxRules = Math.max(1, ...turns.map((t) => t.counts?.firedHyperedges || 0));
  const maxUnvoiced = Math.max(1, ...turns.map((t) => t.counts?.derivedUnvoiced || 0));
  const yFor = (i) => top + i * (rowH + gap);
  const svg = [];

  rows.forEach((row, i) => {
    const y = yFor(i);
    svg.push(
      `<text x="8" y="${y + rowH / 2 + 4}" class="logicviz__label">${escapeHtml(row.label)}</text>`,
      `<line x1="${labelW}" y1="${y + rowH}" x2="${W - right}" y2="${y + rowH}" class="logicviz__rule"/>`,
    );
  });

  turns.forEach((turn, i) => {
    const x = labelW + i * colW;
    const cx = x + colW / 2;
    const activity = (turn.counts?.firedHyperedges || 0) + (turn.counts?.derivedUnvoiced || 0);
    if (activity > 0) {
      svg.push(`<rect x="${x.toFixed(1)}" y="${top - 8}" width="${colW.toFixed(1)}" height="${H - top - 18}" class="logicviz__active"/>`);
    }
    if (i % 2 === 0) {
      svg.push(`<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="logicviz__tick">t${turn.turn}</text>`);
    }

    const rules = turn.counts?.firedHyperedges || 0;
    const ruleH = rules ? Math.max(3, (rules / maxRules) * (rowH - 8)) : 0;
    const rulesTitle = (turn.firedHyperedges || [])
      .map((edge) => `${edge.ruleId} → ${shortFactLabel(edge.outputFact)}`)
      .join('\n');
    svg.push(
      `<rect x="${(x + 3).toFixed(1)}" y="${(yFor(0) + rowH - ruleH).toFixed(1)}" width="${Math.max(2, colW - 6).toFixed(1)}" height="${ruleH.toFixed(1)}" class="logicviz__bar logicviz__bar--rules"><title>${escapeHtml(rulesTitle || `turn ${turn.turn}: no rule hyperedges fired`)}</title></rect>`,
    );

    const unvoiced = turn.counts?.derivedUnvoiced || 0;
    const unvoicedH = unvoiced ? Math.max(3, (unvoiced / maxUnvoiced) * (rowH - 8)) : 0;
    const unvoicedTitle = (turn.derivedUnvoiced || [])
      .map((node) => `${shortFactLabel(node.fact)} (${node.rule || 'rule?'})`)
      .join('\n');
    svg.push(
      `<rect x="${(x + 3).toFixed(1)}" y="${(yFor(1) + rowH - unvoicedH).toFixed(1)}" width="${Math.max(2, colW - 6).toFixed(1)}" height="${unvoicedH.toFixed(1)}" class="logicviz__bar logicviz__bar--unvoiced"><title>${escapeHtml(unvoicedTitle || `turn ${turn.turn}: no derived-unvoiced facts`)}</title></rect>`,
    );

    for (const [rowIndex, targetKey] of [
      [2, 'secret'],
      [3, 'mirror'],
    ]) {
      const target = turn[targetKey];
      const p = targetProgress(target);
      const y = yFor(rowIndex);
      const w = Math.max(2, colW - 6);
      const fill = Math.max(0, Math.min(1, p.pct)) * w;
      const title = `${targetKey} ${target?.derived ? 'derived' : 'not derived'} at turn ${turn.turn}
held ${p.held}/${p.total} source premises${target?.missingSourcePremiseIds?.length ? `; missing ${target.missingSourcePremiseIds.join(', ')}` : ''}${target?.decayedSourcePremiseIds?.length ? `; decayed ${target.decayedSourcePremiseIds.join(', ')}` : ''}`;
      svg.push(
        `<rect x="${(x + 3).toFixed(1)}" y="${(y + 8).toFixed(1)}" width="${w.toFixed(1)}" height="${(rowH - 16).toFixed(1)}" class="logicviz__path"><title>${escapeHtml(title)}</title></rect>`,
        `<rect x="${(x + 3).toFixed(1)}" y="${(y + 8).toFixed(1)}" width="${fill.toFixed(1)}" height="${(rowH - 16).toFixed(1)}" class="logicviz__pathfill logicviz__pathfill--${targetKey}"><title>${escapeHtml(title)}</title></rect>`,
      );
      if (p.decayed) {
        svg.push(
          `<text x="${cx.toFixed(1)}" y="${(y + rowH - 5).toFixed(1)}" text-anchor="middle" class="logicviz__decay">×<title>${escapeHtml(title)}</title></text>`,
        );
      }
      if (target?.derived) {
        svg.push(
          `<text x="${cx.toFixed(1)}" y="${(y + 20).toFixed(1)}" text-anchor="middle" class="logicviz__derived">●<title>${escapeHtml(title)}</title></text>`,
        );
      }
    }
  });

  const activeTurns = turns.filter(
    (t) =>
      (t.firedHyperedges || []).length ||
      (t.derivedUnvoiced || []).length ||
      t.secret?.derived ||
      t.mirror?.derived ||
      (t.decayedProofCriticalSources || []).length,
  );
  const details = activeTurns.length
    ? activeTurns
        .map((turn) => {
          const rules = (turn.firedHyperedges || [])
            .map((edge) => `<li><code>${escapeHtml(edge.ruleId)}</code> → <code>${escapeHtml(shortFactLabel(edge.outputFact))}</code></li>`)
            .join('');
          const unvoiced = (turn.derivedUnvoiced || [])
            .map((node) => `<li><code>${escapeHtml(shortFactLabel(node.fact))}</code>${node.rule ? ` via <code>${escapeHtml(node.rule)}</code>` : ''}</li>`)
            .join('');
          const secret = targetProgress(turn.secret);
          const mirror = targetProgress(turn.mirror);
          return `<details class="logicturn"><summary><span class="mono">t${turn.turn}</span> rules ${turn.counts?.firedHyperedges || 0} · unvoiced ${turn.counts?.derivedUnvoiced || 0} · secret ${secret.held}/${secret.total}${turn.secret?.derived ? ' forced' : ''} · mirror ${mirror.held}/${mirror.total}${turn.mirror?.derived ? ' derived' : ''}</summary>
<div class="logicturn__grid">
<div><strong>rules fired</strong>${rules ? `<ul>${rules}</ul>` : '<p class="mono">none</p>'}</div>
<div><strong>derived but unvoiced</strong>${unvoiced ? `<ul>${unvoiced}</ul>` : '<p class="mono">none</p>'}</div>
<div><strong>path status</strong><p class="mono">secret held ${secret.held}/${secret.total}${turn.secret?.decayedSourcePremiseIds?.length ? ` · decayed ${escapeHtml(turn.secret.decayedSourcePremiseIds.join(', '))}` : ''}<br>mirror held ${mirror.held}/${mirror.total}${turn.mirror?.decayedSourcePremiseIds?.length ? ` · decayed ${escapeHtml(turn.mirror.decayedSourcePremiseIds.join(', '))}` : ''}</p></div>
</div></details>`;
        })
        .join('\n')
    : '<p class="mono">No derived facts or target-path changes were recorded.</p>';

  return `<div class="logicviz">
<svg viewBox="0 0 ${W} ${H}" class="logicviz__svg" role="img" aria-label="Logic projection by turn: fired rules, unvoiced derived facts, secret path, and mirror path">${svg.join('')}</svg>
<p class="slopecap">The logic view is harness-only: it renders the learner board closure from <code>WorldIR.logic</code>. Bar height shows rule firings and unvoiced derivations; path fill shows how many source premises for the secret or mirror are held; ● means the target fact is derived; × marks decayed proof-critical source material.</p>
<div class="logicviz__details">${details}</div>
</div>`;
}

const DERIVATION_CSS = `
.wrap{max-width:1020px;margin:0 auto;padding:18px var(--margin) 80px}
.wrap h1{font-family:Fraunces,serif;font-weight:600;font-size:var(--s-4);margin:.3em 0 .15em}
.wrap .lede{color:var(--ink-3);margin:0 0 14px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}
.chip{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule);border-radius:4px;padding:2px 8px;background:var(--paper-4)}
.chip--ok{background:var(--moss-soft);border-color:var(--moss);color:var(--moss-deep)}
.chip--bad{background:var(--brick-soft);border-color:var(--brick);color:var(--brick-d)}
.tts-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:14px 0 18px;padding:9px 10px;border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4)}
.tts-toolbar--compact{margin:4px 0 8px}
.tts-control,.tts-btn{border:1px solid var(--rule);background:var(--paper);color:var(--moss-deep);cursor:pointer;font-family:"JetBrains Mono",monospace;text-transform:uppercase}
.tts-control{min-height:28px;padding:5px 10px;font-size:var(--s-0);letter-spacing:.08em}
.tts-btn{margin-right:7px;padding:2px 7px;font-size:10px;letter-spacing:.07em;vertical-align:middle}
.tts-control:hover,.tts-btn:hover{color:var(--brick-d);border-color:var(--brick)}
.tts-check,.tts-status{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.tts-check{display:inline-flex;gap:5px;align-items:center}
.tts-status[data-state="error"]{color:var(--brick-d)}
pre.panel{background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:6px;padding:12px;overflow-x:auto;font-size:var(--s-0);line-height:1.35}
h2.sect{font-family:Fraunces,serif;font-weight:600;margin:1.7em 0 .4em;font-size:var(--s-3);border-bottom:1px solid var(--rule);padding-bottom:.2em}
.turn{margin:14px 0;padding:10px 14px;border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4)}
.turn__n{font-family:"JetBrains Mono",monospace;color:var(--ink-3);font-size:var(--s-0);margin-bottom:4px}
.line{margin:7px 0;transition:background .12s var(--ease),box-shadow .12s var(--ease)}
.line[data-tts-click="1"]{cursor:pointer;border-radius:4px;padding:3px 5px;margin-left:-5px}
.line[data-tts-click="1"]:focus{outline:2px solid color-mix(in srgb,var(--moss) 70%,transparent);outline-offset:2px}
.line[data-tts-click="1"]:hover,.line.is-playing{background:var(--paper-2);box-shadow:inset 3px 0 0 var(--moss)}
.line--director{font-style:italic;color:var(--ink-3)}
.line .who{font-weight:600}
.line--tutor .who{color:var(--moss-deep)}
.line--learner .who{color:var(--indigo)}
.tmeta{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);margin:2px 0 0 14px}
.tmeta[data-tts-click="1"]{cursor:pointer;border-radius:4px;padding:3px 5px;margin-left:9px}
.tmeta[data-tts-click="1"]:hover,.tmeta.is-playing{background:var(--paper-2);box-shadow:inset 3px 0 0 var(--brick)}
.tmeta .release{color:var(--moss-deep);background:var(--moss-soft);padding:0 5px;border-radius:3px}
.tmeta .assert{color:var(--brick-d);font-weight:600}
.flag{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);margin:6px 0 0 14px;padding:2px 8px;border-radius:4px}
.flag--ok{background:var(--moss-soft);color:var(--moss-deep)}
.flag--bad{background:var(--brick-soft);color:var(--brick-d)}
table.idx{border-collapse:collapse;width:100%;font-size:var(--s-1)}
table.idx th,table.idx td{border-bottom:1px solid var(--rule-soft);padding:8px 10px;text-align:left;vertical-align:top}
table.idx th{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
.mono{font-family:"JetBrains Mono",monospace;font-size:var(--s-0)}
.wrap a{color:var(--moss-deep)}
.sect__intent{display:block;font-family:"Source Serif 4",Georgia,serif;font-style:italic;font-weight:400;font-size:var(--s-1);color:var(--ink-3);margin-top:2px}
details.figdef{display:inline}
details.figdef summary{display:inline;cursor:pointer;list-style:none;text-decoration:underline dotted;text-underline-offset:2px}
details.figdef summary::-webkit-details-marker{display:none}
details.figdef[open] summary{color:var(--moss-deep)}
.figdef__t{display:block;margin:4px 0 2px;padding:5px 9px;border-left:2px solid var(--moss);background:var(--paper-2);color:var(--ink-2);font-style:italic;max-width:62ch;white-space:normal}
.mdblock{max-width:74ch}
.mdblock p{margin:.55em 0;line-height:1.55}
.mdblock ul{margin:.4em 0 .4em 1.2em;padding:0}
.mdblock li{margin:.25em 0;line-height:1.5}
.mdblock code{font-family:"JetBrains Mono",monospace;font-size:.9em;background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:3px;padding:0 4px}
.mdblock h3,.mdblock h4{font-family:Fraunces,serif;font-weight:600;margin:1.1em 0 .3em}
.mdblock table{border-collapse:collapse;margin:.6em 0;font-size:var(--s-1)}
.mdblock th,.mdblock td{border-bottom:1px solid var(--rule-soft);padding:5px 10px;text-align:left}
.mdblock th{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);text-transform:uppercase;letter-spacing:.06em}
.mdblock blockquote{margin:.6em 0;padding:2px 12px;border-left:2px solid var(--rule);color:var(--ink-3);font-style:italic}
.mdblock--notice{font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-2)}
.mdblock--notice p{line-height:1.62}
.mdblock--notice blockquote{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-style:normal}
.fact{font-family:"JetBrains Mono",monospace;font-size:.88em;color:var(--moss-deep);white-space:nowrap}
svg.arc{display:block;width:100%;height:auto;margin:6px 0 2px;background:var(--paper-4);border:1px solid var(--rule-soft);border-radius:6px}
.arc text{font-family:"JetBrains Mono",monospace;font-size:10.5px;fill:var(--ink-3)}
.arc__band{fill:var(--rule-soft);fill-opacity:.28}
.arc__bandlabel{font-size:11px;fill:var(--ink-2)}
.arc__grid{stroke:var(--rule-soft);stroke-width:1}
.arc__tick{font-size:10px}
.arc__d{fill:none;stroke:var(--moss-deep);stroke-width:2.2;stroke-linejoin:round}
.arc__dot{fill:var(--moss-deep)}
.arc__dot--forced{fill:var(--indigo)}
.arc__forced{stroke:var(--indigo);stroke-width:1.2;stroke-dasharray:4 3}
.arc__forcedlabel{fill:var(--indigo);font-size:10.5px}
.arc__rel{fill:var(--moss-deep);font-size:11px;cursor:default}
.arc__flag{font-size:12px;cursor:default}
.arc__flag--ok{fill:var(--moss-deep)}
.arc__flag--bad{fill:var(--brick-d)}
.arc__star{fill:var(--brick-d);font-size:16px;cursor:default}
.slopecap{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);margin:4px 0 0}
.notice-missing{color:var(--ink-3);font-style:italic}
.logicviz{margin:8px 0 20px}
.logicviz__svg{display:block;width:100%;height:auto;margin:6px 0 4px;background:var(--paper-4);border:1px solid var(--rule-soft);border-radius:6px}
.logicviz__label,.logicviz__tick{font-family:"JetBrains Mono",monospace;font-size:10px;fill:var(--ink-3)}
.logicviz__label{fill:var(--ink-2)}
.logicviz__rule{stroke:var(--rule-soft);stroke-width:1}
.logicviz__active{fill:var(--ochre-soft);fill-opacity:.38}
.logicviz__bar{rx:2}
.logicviz__bar--rules{fill:var(--moss-deep)}
.logicviz__bar--unvoiced{fill:var(--brick)}
.logicviz__path{fill:var(--paper-2);stroke:var(--rule);stroke-width:1}
.logicviz__pathfill{opacity:.75}
.logicviz__pathfill--secret{fill:var(--indigo)}
.logicviz__pathfill--mirror{fill:var(--ochre)}
.logicviz__decay{font-family:"JetBrains Mono",monospace;font-size:16px;fill:var(--brick-d)}
.logicviz__derived{font-family:"JetBrains Mono",monospace;font-size:13px;fill:var(--paper)}
.logicviz__details{margin-top:10px}
.logicturn{border:1px solid var(--rule-soft);border-radius:6px;background:var(--paper-4);margin:7px 0;padding:7px 10px}
.logicturn summary{cursor:pointer;color:var(--ink-2)}
.logicturn__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}
.logicturn__grid strong{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;letter-spacing:.04em;color:var(--ink-3)}
.logicturn__grid ul{margin:.35em 0 0 1.15em;padding:0}
.logicturn__grid li{margin:.2em 0;line-height:1.35}
@media (max-width:760px){.logicturn__grid{grid-template-columns:1fr}.logicviz__svg{min-width:760px}.logicviz{overflow-x:auto}}
/* ── derivation index: scoreboard · toolbar · readability panel · win flags ── */
.wrap--wide{max-width:1180px}
.idx-scoreboard{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 14px}
.idx-tally{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);border:1px solid var(--rule);border-radius:5px;padding:3px 10px;background:var(--paper-4);color:var(--ink-2)}
.idx-tally b{color:var(--ink);font-size:var(--s-1)}
.idx-tally--win{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
.idx-tally--win b{color:var(--ochre-d)}
.idx-tools{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 18px;padding:10px 12px;border:1px solid var(--rule-soft);border-radius:8px;background:var(--paper-4)}
.idx-search{flex:1 1 220px;min-width:160px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);padding:6px 10px;border:1px solid var(--rule);border-radius:5px;background:var(--paper);color:var(--ink)}
.idx-search:focus{outline:2px solid color-mix(in srgb,var(--ochre) 55%,transparent);outline-offset:1px;border-color:var(--ochre)}
.idx-seg{display:inline-flex;border:1px solid var(--rule);border-radius:5px;overflow:hidden}
.idx-seg button{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);text-transform:uppercase;letter-spacing:.05em;padding:5px 11px;border:0;border-right:1px solid var(--rule);background:var(--paper);color:var(--ink-3);cursor:pointer;transition:background .12s var(--ease),color .12s var(--ease)}
.idx-seg button:last-child{border-right:0}
.idx-seg button:hover{color:var(--ink)}
.idx-seg button.is-on{background:var(--ochre-soft);color:var(--ochre-d)}
.idx-check,.idx-sort{display:inline-flex;align-items:center;gap:6px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.idx-sort select{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);padding:5px 8px;border:1px solid var(--rule);border-radius:5px;background:var(--paper);color:var(--ink)}
.idx-count{margin-left:auto;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3)}
.idx-flatcount{margin:0 0 6px}
.idx-empty{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-3);background:var(--paper-2);border:1px dashed var(--rule);border-radius:8px;padding:18px;text-align:center;margin:6px 0 24px}
.idx-panel{background:var(--paper-2);border:1px solid var(--rule-soft);border-radius:8px;padding:2px 12px;margin:6px 0 24px;overflow-x:auto}
/* runs table: fixed columns (colgroup-driven) + tokens that wrap inside cells */
table.idx--runs{table-layout:fixed}
table.idx--runs td{overflow-wrap:anywhere}
table.idx--runs th,table.idx--runs td{padding-left:8px;padding-right:8px}
/* headers stay whole-word (no mid-word breaks) and crisp/dark, not pale */
table.idx--runs thead th{vertical-align:bottom;white-space:normal;overflow-wrap:normal;word-break:normal;font-size:0.68rem;letter-spacing:.03em;line-height:1.22;color:var(--ink-2);border-bottom:1px solid var(--rule)}
table.idx--runs tbody tr.idx-row td{border-bottom:0;padding-bottom:4px}
/* full-width summary caption row beneath each run */
.idx-sum td{padding:2px 12px 12px 16px;border-bottom:1px solid var(--rule-soft)}
.idx-sum .run-summary{display:block;margin:0;max-width:84ch;font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-1);color:var(--ink-2);line-height:1.5}
tr.idx-sum--win{box-shadow:inset 3px 0 0 var(--ochre);background:color-mix(in srgb,var(--ochre-soft) 32%,transparent)}
tr.idx-sum--win.is-alt{background:color-mix(in srgb,var(--ochre-soft) 52%,transparent)}
/* compressed backend cell: model + the roles that used it */
.bk{display:block}
.bk__m{color:var(--ink-2)}
.bk__r{color:var(--ink-3)}
table.idx tbody tr.idx-row{transition:background .12s var(--ease)}
table.idx tbody tr.is-alt{background:color-mix(in srgb,var(--linen) 15%,transparent)}
table.idx tbody tr.idx-row:hover{background:var(--paper-4)}
tr.idx-row--win{box-shadow:inset 3px 0 0 var(--ochre);background:color-mix(in srgb,var(--ochre-soft) 32%,transparent)}
tr.idx-row--win.is-alt{background:color-mix(in srgb,var(--ochre-soft) 52%,transparent)}
tr.idx-row--win:hover{background:color-mix(in srgb,var(--ochre-soft) 62%,transparent)}
.run-name{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:600}
.run-summary{display:block;margin-top:3px;font-family:"Source Serif 4",Georgia,serif;font-size:var(--s-0);color:var(--ink-3);line-height:1.42;max-width:48ch;white-space:normal}
/* outcome badge: one distinct treatment per verdict, with a leading status dot */
.vchip{display:inline-flex;align-items:center;gap:5px;font-family:"JetBrains Mono",monospace;font-size:var(--s-0);font-weight:600;border:1px solid var(--rule);border-radius:5px;padding:2px 9px 2px 7px;white-space:nowrap}
.vchip::before{content:"";flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:currentColor}
.vchip--grounded{background:var(--ochre-soft);border-color:var(--ochre);color:var(--ochre-d)}
.vchip--disengaged{background:color-mix(in srgb,var(--ink-3) 14%,var(--paper));border-color:var(--ink-4);color:var(--ink-2)}
.vchip--impasse{background:var(--brick-soft);border-color:var(--brick);color:var(--brick-d)}
.dvscore{font-family:"JetBrains Mono",monospace;font-size:var(--s-0);color:var(--ink-2)}
.dvscore--win{color:var(--ochre-d);font-weight:600}
.dvscore__bar{display:inline-block;width:34px;height:6px;border-radius:3px;background:var(--paper-3);border:1px solid var(--rule-soft);vertical-align:middle;margin-left:6px;overflow:hidden}
.dvscore__bar i{display:block;height:100%;background:var(--ochre)}
.winflag{margin-left:5px}
.when{white-space:nowrap;line-height:1.32}
.when__t{color:var(--ink-3)}
@media (max-width:760px){.idx-sum{display:none}}
`;

// The three verdicts the deterministic checker emits, in plain words. The win
// is grounded_anagnorisis (the learner reached the secret and its proof closed);
// the other two are the failure taxonomy.
const DERIVATION_VERDICT_LABEL = {
  grounded_anagnorisis: 'grounded',
  disengagement: 'disengaged',
  aporia: 'impasse',
};
// Each verdict gets its own badge treatment so the two failure modes
// (disengaged vs impasse) no longer collapse into one undifferentiated red.
const DERIVATION_VERDICT_CLASS = {
  grounded_anagnorisis: 'vchip--grounded',
  disengagement: 'vchip--disengaged',
  aporia: 'vchip--impasse',
};

// One plain-language sentence per run, leading with the outcome — for readers
// who don't carry the jargon. Deterministic facts only (no judge): the verdict,
// how far the proof got (D counts the premises still missing; d0 is the full
// set, so d0−dFinal is how many were established), and how the scheduled
// evidence reveals landed.
function derivationPlainSummary(d) {
  const slope = d.learningSlope || {};
  const d0 = typeof slope.d0 === 'number' ? slope.d0 : null;
  const dFinal = typeof slope.dFinal === 'number' ? slope.dFinal : null;
  const grounded = d0 !== null && dFinal !== null ? d0 - dFinal : null;
  const steps = grounded !== null ? `${grounded} of ${d0} proof step${d0 === 1 ? '' : 's'} established` : null;
  const adherence = d.releaseAdherence || {};
  const devs = adherence.deviations?.length || 0;
  const cues =
    typeof adherence.onCue === 'number'
      ? `${adherence.onCue} planned reveal${adherence.onCue === 1 ? '' : 's'} on cue${devs ? `, ${devs} off-schedule` : ''}`
      : null;
  const turn = d.turnsPlayed ?? '?';
  let lead;
  if (d.verdict === 'grounded_anagnorisis') {
    lead = `The learner reached the hidden answer at turn ${d.assertedGroundedTurn ?? turn} and the proof closed`;
  } else if (d.verdict === 'disengagement') {
    lead = `The learner disengaged at turn ${turn}, before the proof closed`;
  } else if (d.verdict === 'aporia') {
    lead = `The dialogue reached an impasse at turn ${turn} with no way forward`;
  } else {
    lead = `Run ended at turn ${turn}`;
  }
  const tail = [steps, cues].filter(Boolean).join('; ');
  return tail ? `${lead} — ${tail}.` : `${lead}.`;
}

// The deterministic "score": proof steps established (d0−dFinal) out of d0, with
// a 🏁 + completion bar when the proof actually closed (dFinal 0 = a win). Not a
// judge's rating — it reads straight off the D-curve. Returns the cell HTML plus
// the integer value the client uses to sort by "most proof steps".
function derivationScoreCell(d) {
  const slope = d.learningSlope || {};
  const d0 = typeof slope.d0 === 'number' ? slope.d0 : null;
  const dFinal = typeof slope.dFinal === 'number' ? slope.dFinal : null;
  if (d0 === null || dFinal === null || d0 <= 0) {
    return { html: '<span class="dvscore">—</span>', value: -1 };
  }
  const grounded = d0 - dFinal;
  const pct = Math.max(0, Math.min(100, Math.round((grounded / d0) * 100)));
  const win = dFinal === 0;
  const flag = win ? ' <span class="winflag" title="proof closed">🏁</span>' : '';
  const html = `<span class="dvscore${win ? ' dvscore--win' : ''}" title="${grounded} of ${d0} proof steps established">${grounded}/${d0}${flag}<span class="dvscore__bar"><i style="width:${pct}%"></i></span></span>`;
  return { html, value: grounded };
}

// When the run finished, from the diagnosis artifact's mtime (no wall-clock
// stamp is written into the run). Compact two lines — "Jun 12, 2026" over the
// HH:MM — with the full ISO timestamp on hover; value is the epoch ms the client
// sorts on.
const DERIVATION_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function derivationWhenCell(mtimeMs) {
  if (!mtimeMs) return { html: '<span class="mono">—</span>', value: 0 };
  const dt = new Date(mtimeMs);
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${DERIVATION_MONTHS[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
  const time = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const html = `<span class="when" title="${escapeHtml(dt.toISOString())}">${date}<br><span class="when__t">${time}</span></span>`;
  return { html, value: mtimeMs };
}

// Client wiring for the index: live search, outcome filter, real-only toggle,
// and sort — all in-page over the rows already rendered (no fetch). Each section
// (experimental group) sorts and zebra-stripes independently; a group with no
// matching rows hides itself, and the toolbar shows a live shown/grounded count.
const DERIVATION_INDEX_CLIENT = `<script>
(function () {
  var root = document.querySelector('[data-derivation-index]');
  if (!root) return;
  var search = root.querySelector('.idx-search');
  var seg = [].slice.call(root.querySelectorAll('.idx-seg button'));
  var realChk = root.querySelector('.idx-real');
  var sortSel = root.querySelector('.idx-sortsel');
  var countEl = root.querySelector('[data-idx-count]');
  var emptyEl = root.querySelector('[data-idx-empty]');
  var sections = [].slice.call(root.querySelectorAll('.idx-group'));
  var verdict = 'all';
  var WIN = 'grounded_anagnorisis';
  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function rowsOf(sec) { return [].slice.call(sec.querySelectorAll('tr.idx-row')); }
  function matches(tr) {
    var q = (search && search.value || '').trim().toLowerCase();
    if (q && (tr.dataset.label || '').indexOf(q) < 0) return false;
    if (verdict !== 'all' && tr.dataset.verdict !== verdict) return false;
    if (realChk && realChk.checked && tr.dataset.mode !== 'real') return false;
    return true;
  }
  function compare(key, a, b) {
    var ord = num(a.dataset.ord) - num(b.dataset.ord);
    if (key === 'wins') {
      var aw = a.dataset.verdict === WIN ? 0 : 1;
      var bw = b.dataset.verdict === WIN ? 0 : 1;
      return (aw - bw) || ord;
    }
    if (key === 'score') return (num(b.dataset.score) - num(a.dataset.score)) || ord;
    if (key === 'turns') return (num(a.dataset.turns) - num(b.dataset.turns)) || ord;
    if (key === 'cost') return (num(b.dataset.cost) - num(a.dataset.cost)) || ord;
    if (key === 'label') {
      var an = a.dataset.name || '', bn = b.dataset.name || '';
      return an < bn ? -1 : an > bn ? 1 : 0;
    }
    return ord;
  }
  // Order the GROUP sections for the current key, using each section's best
  // visible run — so the whole page reorders, not just rows within a group.
  // (Without this, sorting only shuffles rows inside each of the ~20 condition
  // groups and the page looks unchanged.) Ties fall back to recency (min ord).
  function compareSection(key, a, b) {
    if (key === 'wins') return (b.wins - a.wins) || (a.ord - b.ord);
    if (key === 'score') return (b.score - a.score) || (a.ord - b.ord);
    if (key === 'turns') return (a.turns - b.turns) || (a.ord - b.ord);
    if (key === 'cost') return (b.cost - a.cost) || (a.ord - b.ord);
    if (key === 'label') return a.group < b.group ? -1 : a.group > b.group ? 1 : 0;
    return a.ord - b.ord;
  }
  // Each run renders as two rows: the data row (.idx-row) and a full-width
  // summary caption row (.idx-sum) right after it. Stash the caption on its
  // data row so sort/filter/striping move and hide them together as one unit.
  sections.forEach(function (sec) {
    rowsOf(sec).forEach(function (tr) {
      var nx = tr.nextElementSibling;
      tr.sumRow = nx && nx.classList && nx.classList.contains('idx-sum') ? nx : null;
    });
  });
  function apply() {
    var key = sortSel ? sortSel.value : 'recent';
    var shown = 0, wins = 0;
    var stats = sections.map(function (sec) {
      var tbody = sec.querySelector('tbody');
      var rows = rowsOf(sec);
      rows.sort(function (a, b) { return compare(key, a, b); });
      rows.forEach(function (tr) { tbody.appendChild(tr); if (tr.sumRow) tbody.appendChild(tr.sumRow); });
      var visible = 0, secWins = 0, alt = false;
      var agg = { ord: Infinity, wins: 0, score: -1, turns: Infinity, cost: -1, group: sec.getAttribute('data-group') || '' };
      rows.forEach(function (tr) {
        var ok = matches(tr);
        tr.hidden = !ok;
        tr.classList.remove('is-alt');
        if (tr.sumRow) { tr.sumRow.hidden = !ok; tr.sumRow.classList.remove('is-alt'); }
        if (!ok) return;
        visible += 1; shown += 1;
        if (alt) { tr.classList.add('is-alt'); if (tr.sumRow) tr.sumRow.classList.add('is-alt'); }
        alt = !alt;
        agg.ord = Math.min(agg.ord, num(tr.dataset.ord));
        agg.score = Math.max(agg.score, num(tr.dataset.score));
        agg.turns = Math.min(agg.turns, num(tr.dataset.turns));
        agg.cost = Math.max(agg.cost, num(tr.dataset.cost));
        if (tr.dataset.verdict === WIN) { wins += 1; secWins += 1; agg.wins += 1; }
      });
      sec.hidden = visible === 0;
      var counter = sec.querySelector('[data-sec-count]');
      if (counter) counter.textContent = visible + (visible === 1 ? ' run' : ' runs') + (secWins ? ' \\u00b7 ' + secWins + ' grounded' : '');
      return agg;
    });
    if (sections.length > 1 && sections[0].parentNode) {
      var parent = sections[0].parentNode;
      stats
        .map(function (agg, i) { return { agg: agg, sec: sections[i] }; })
        .sort(function (a, b) { return compareSection(key, a.agg, b.agg); })
        .forEach(function (s) { parent.appendChild(s.sec); });
    }
    if (emptyEl) emptyEl.hidden = shown !== 0;
    if (countEl) countEl.textContent = shown + ' shown \\u00b7 ' + wins + ' grounded';
  }
  if (search) search.addEventListener('input', apply);
  if (realChk) realChk.addEventListener('change', apply);
  if (sortSel) sortSel.addEventListener('change', apply);
  seg.forEach(function (b) {
    b.addEventListener('click', function () {
      verdict = b.dataset.verdict;
      seg.forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      apply();
    });
  });
  // Seed the outcome filter from ?verdict= so the dashboard Signal chart can
  // deep-link into one outcome (e.g. /derivation?verdict=aporia). Only a value
  // matching one of the toggle buttons is honoured; anything else stays 'all'.
  try {
    var qv = new URL(window.location.href).searchParams.get('verdict');
    var match = qv && seg.filter(function (b) { return b.dataset.verdict === qv; })[0];
    if (match) {
      verdict = qv;
      seg.forEach(function (x) {
        var on = x === match;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }
  } catch (_e) {
    /* malformed URL — leave the filter at 'all' */
  }
  apply();
})();
</script>`;

function renderDerivationIndexHtml(runs) {
  // Stable "most recent" ordering: the list arrives mtime-sorted, so the index
  // here is what the client sorts back to when it resets to recency.
  runs.forEach((run, i) => {
    run.ord = i;
  });
  const rowHtml = ({ label, diagnosis: d, hasNotice, ord, mtimeMs }) => {
    const events = Object.entries(d.eventsByType || {})
      .map(([k, v]) => {
        const txt = `${escapeHtml(k)}×${v}`;
        return DERIVATION_SUCCESS_EVENTS.has(k) ? txt : `<span style="color:var(--brick-d)">${txt}</span>`;
      })
      .join(', ');
    const verdictOk = d.verdict === 'grounded_anagnorisis';
    const verdictLabel = DERIVATION_VERDICT_LABEL[d.verdict] || d.verdict || '?';
    const verdictClass = DERIVATION_VERDICT_CLASS[d.verdict] || 'vchip--disengaged';
    const score = derivationScoreCell(d);
    const when = derivationWhenCell(mtimeMs);
    const summary = derivationPlainSummary(d);
    const adherence = d.releaseAdherence || {};
    const sg = d.tutorFigures?.superego;
    const staging = [
      d.staging
        ? d.staging.source === 'director'
          ? `${d.staging.movements.length} mv${d.staging.tutorNotes?.length ? ` · ${d.staging.tutorNotes.length} notes` : ''}`
          : 'sketch held'
        : '—',
      ...(sg ? [`sego ${sg.interventions}/${sg.watched}${d.tutorStallWatch ? ' +stall' : ''}`] : []),
    ].join(' · ');
    const marks = [
      hasNotice ? ' <span title="critic’s notice on file" style="color:var(--moss-deep)">✎</span>' : '',
      d.criticFeedback
        ? ` <span title="counsel folded in from ${escapeHtml(d.criticFeedback.source)}" style="color:var(--moss-deep)">⟲</span>`
        : '',
    ].join('');
    // data-* attributes drive client-side search / filter / sort.
    const haystack = escapeHtml(`${label} ${summary}`.toLowerCase());
    return `<tr class="idx-row${verdictOk ? ' idx-row--win' : ''}" data-ord="${ord}" data-name="${escapeHtml(
      label.toLowerCase(),
    )}" data-label="${haystack}" data-verdict="${escapeHtml(d.verdict || '?')}" data-mode="${escapeHtml(
      d.backend?.mode || '?',
    )}" data-score="${score.value}" data-turns="${d.turnsPlayed ?? 0}" data-cost="${d.usage?.costUSD ?? 0}" data-mtime="${when.value}">
<td><a class="run-name" href="/derivation/${encodeURIComponent(label)}">${escapeHtml(label)}</a>${marks}</td>
<td><span class="vchip ${verdictClass}">${escapeHtml(verdictLabel)}</span></td>
<td>${score.html}</td>
<td class="mono">${d.firstForcedTurn ?? '—'} → ${d.assertedGroundedTurn ?? '—'}</td>
<td class="mono">${d.turnsPlayed ?? '?'}/${d.turnCap ?? '?'}</td>
<td class="mono">${events || '—'}</td>
<td class="mono">${adherence.onCue ?? '—'} on cue${adherence.deviations?.length ? `, <span style="color:var(--brick-d)">${adherence.deviations.length} dev</span>` : ''}</td>
<td class="mono">${staging}</td>
<td class="mono">${derivationBackendCell(d.backend)}</td>
<td class="mono">${d.elapsedMs ? `${(d.elapsedMs / 1000).toFixed(0)}s` : '—'} · $${(d.usage?.costUSD ?? 0).toFixed(2)}</td>
<td class="mono">${when.html}</td>
</tr>
<tr class="idx-sum${verdictOk ? ' idx-sum--win' : ''}"><td colspan="11"><span class="run-summary">${escapeHtml(summary)}</span></td></tr>`;
  };
  const tableFor = (rs) =>
    `<div class="idx-panel"><table class="idx idx--runs"><colgroup><col style="width:10%"><col style="width:12%"><col style="width:9%"><col style="width:7%"><col style="width:6%"><col style="width:11%"><col style="width:7%"><col style="width:9%"><col style="width:11%"><col style="width:7%"><col style="width:11%"></colgroup><thead><tr><th>run</th><th>outcome</th><th>proof</th><th>forced → asserted</th><th>turns</th><th>events</th><th>releases</th><th>dramaturgy</th><th>backend</th><th>wall · cost</th><th>when</th></tr></thead><tbody>${rs
      .map(rowHtml)
      .join('\n')}</tbody></table></div>`;
  const winCount = (rs) => rs.filter((r) => r.diagnosis.verdict === 'grounded_anagnorisis').length;
  const countText = (rs) => {
    const w = winCount(rs);
    return `${rs.length} run${rs.length === 1 ? '' : 's'}${w ? ` · ${w} grounded` : ''}`;
  };
  // Experimental-condition grouping (diagnosis.group, set by --group or the
  // backfill script): one section per group, ordered by each group's most
  // recent run (the list arrives mtime-sorted). All-ungrouped keeps a single
  // flat section. Each section is its own client-sortable unit.
  const grouped = new Map();
  for (const run of runs) {
    const key = run.diagnosis.group || '(ungrouped)';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(run);
  }
  const flat = grouped.size === 1 && grouped.has('(ungrouped)');
  const body = !runs.length
    ? '<p>No runs found. Run <span class="mono">npm run derivation:loop</span> first.</p>'
    : flat
      ? `<section class="idx-group" data-group="(all)"><p class="mono idx-flatcount" style="color:var(--ink-3)" data-sec-count>${countText(
          runs,
        )}</p>${tableFor(runs)}</section>`
      : [...grouped.entries()]
          .map(
            ([g, rs]) =>
              `<section class="idx-group" data-group="${escapeHtml(g)}"><h2 class="sect">${escapeHtml(
                g,
              )} <span class="mono" style="color:var(--ink-3);font-weight:normal" data-sec-count>${countText(
                rs,
              )}</span></h2>${tableFor(rs)}</section>`,
          )
          .join('\n');
  // Top-line scoreboard — wins vs the two failure modes, across every run on
  // disk (not just what the filters currently show; the client updates a live
  // "shown" tally in the toolbar instead).
  const tally = { grounded_anagnorisis: 0, disengagement: 0, aporia: 0, other: 0 };
  for (const run of runs) {
    const v = run.diagnosis.verdict;
    if (v in tally) tally[v] += 1;
    else tally.other += 1;
  }
  const scoreboard = runs.length
    ? `<div class="idx-scoreboard">
<span class="idx-tally idx-tally--win"><b>${tally.grounded_anagnorisis}</b> grounded</span>
<span class="idx-tally"><b>${tally.disengagement}</b> disengaged</span>
<span class="idx-tally"><b>${tally.aporia}</b> impasse</span>
${tally.other ? `<span class="idx-tally"><b>${tally.other}</b> other</span>` : ''}
<span class="idx-tally"><b>${runs.length}</b> runs total</span>
</div>`
    : '';
  const toolbar = runs.length
    ? `<div class="idx-tools" role="search">
<input type="search" class="idx-search" placeholder="search runs by name or summary…" aria-label="Search runs by name or summary">
<div class="idx-seg" role="group" aria-label="Filter by outcome">
<button type="button" data-verdict="all" class="is-on" aria-pressed="true">all</button>
<button type="button" data-verdict="grounded_anagnorisis" aria-pressed="false">wins</button>
<button type="button" data-verdict="disengagement" aria-pressed="false">disengaged</button>
<button type="button" data-verdict="aporia" aria-pressed="false">impasse</button>
</div>
<label class="idx-check"><input type="checkbox" class="idx-real"> real only</label>
<label class="idx-sort">sort
<select class="idx-sortsel" aria-label="Sort runs">
<option value="recent">most recent</option>
<option value="wins">wins first</option>
<option value="score">most proof steps</option>
<option value="turns">fewest turns</option>
<option value="cost">highest cost</option>
<option value="label">name A–Z</option>
</select>
</label>
<span class="idx-count" data-idx-count></span>
</div>`
    : '';
  return `${pageHead({ title: 'Derivation runs · machine spirits', css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: 'proof runs — a fixed rule-checker decides each outcome, no AI judge anywhere',
  hint: '<span><b>proof runs</b> — a fixed rule-checker (not an AI judge, not a quality score) decides whether the learner reached the hidden answer</span><span class="navhint__sep">·</span><span>for generated drama graded by AI critics, see <a href="/browse">scripts</a></span>',
})}
<main class="wrap wrap--wide" data-derivation-index>
<h1>Proof runs — did the learner reach the hidden answer?</h1>
<p class="lede">Each row is one tutoring run. The tutor has to lead the learner to a hidden conclusion purely by inference, and a fixed rule-checker — not an AI judge — decides the outcome: a run is <strong>grounded</strong> when the learner reaches the hidden conclusion and its proof closes; otherwise it ends in an <strong>impasse</strong> or the learner <strong>disengages</strong>. Runs are grouped by experimental condition (the <span class="mono">--group</span> flag); artifacts live under <span class="mono">exports/dramatic-derivation/loop/</span>.</p>
${scoreboard}
${toolbar}
${runs.length ? '<p class="idx-empty" data-idx-empty hidden>No runs match your search or filters.</p>' : ''}
${runs.length ? '<details class="idx-legend"><summary class="mono" style="cursor:pointer;color:var(--ink-3);font-size:12px">what the columns mean</summary><p class="mono" style="color:var(--ink-3);font-size:11px;line-height:1.6;margin:.4em 0 .8em">proof = how many of the required reasoning steps the learner established · forced → asserted = the turn the hidden fact had to be handed to the learner vs the turn the learner stated it themselves · events = per-turn flags from the rule-checker (plot move, repair, decay, act end…) · releases = planned fact-reveals that landed on cue vs off-schedule (dev) · dramaturgy = director-declared scene moves</p></details>' : ''}
${body}
</main>
${DERIVATION_INDEX_CLIENT}
</body></html>`;
}

function renderDerivationRunHtml({ label, diagnosis, result, world, commentary }) {
  // Realized staging: director-declared movements when there are any, the
  // author's sketch otherwise — same segments feed the headers AND the curve.
  const segments = derivationStagingSegments(result, world);
  const segmentFor = (turn) => segments.find((s) => turn >= s.turns[0] && turn <= s.turns[1]) || null;
  const byTurn = new Map();
  for (const line of result.transcript || []) {
    if (!byTurn.has(line.turn)) byTurn.set(line.turn, []);
    byTurn.get(line.turn).push(line);
  }
  const eventsByTurn = new Map();
  for (const event of result.events || []) {
    if (!eventsByTurn.has(event.turn)) eventsByTurn.set(event.turn, []);
    eventsByTurn.get(event.turn).push(event);
  }

  const blocks = [];
  let currentSegment = null;
  for (const [turn, turnLines] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
    const segment = segmentFor(turn);
    if (segment && segment !== currentSegment) {
      currentSegment = segment;
      const declared = segment.source === 'director' ? ' — declared by the director' : '';
      const intent = segment.intent ? `<span class="sect__intent">${escapeHtml(segment.intent)}</span>` : '';
      blocks.push(
        `<h2 class="sect">${escapeHtml(segment.title)} <span class="mono" style="color:var(--ink-3)">(turns ${segment.turns[0]}–${segment.turns[1]}${declared})</span>${intent}</h2>`,
      );
    }
    const lines = turnLines
      .map((line) => {
        const rawText = (line.text || '').trim();
        const text = escapeHtml(rawText);
        if (line.role === 'director') {
          const dbits = [];
          if (line.meta?.phase?.name)
            dbits.push(
              `<div class="tmeta">— declares the movement <strong>${escapeHtml(line.meta.phase.name)}</strong>${line.meta.phase.intent ? `: ${escapeHtml(line.meta.phase.intent)}` : ''}</div>`,
            );
          if (line.meta?.tutorNote)
            dbits.push(`<div class="tmeta">— note to the tutor: “${escapeHtml(line.meta.tutorNote)}”</div>`);
          if (line.meta?.release)
            dbits.push(
              `<div class="tmeta">— releases <span class="release">${escapeHtml(line.meta.release)}</span></div>`,
            );
          return `<div class="line line--director tts-fragment"${ttsDataAttrs('director', rawText, 'Director')}>${rawText ? ttsPlayButton('director') : ''}${text}</div>${dbits.join('')}`;
        }
        if (line.role === 'tutor') {
          const move = line.meta?.move;
          const bits = [];
          if (move)
            bits.push(
              `move: ${derivationFigureHtml(move.figure)} → ${escapeHtml(move.targetPremise || '—')} (${escapeHtml(move.intent || '—')})`,
            );
          if (line.meta?.release) bits.push(`releases <span class="release">${escapeHtml(line.meta.release)}</span>`);
          const delib = line.meta?.deliberation;
          const delibNote = (delib?.note || '').trim();
          const voice = delib?.intervened
            ? `<div class="tmeta tts-fragment"${ttsDataAttrs('tutor_superego', delibNote, 'Tutor superego')}>${delibNote ? ttsPlayButton('tutor superego') : ''}— the second voice: “${escapeHtml(delib.note || '')}”${
                delib.draftFigure && move?.figure && delib.draftFigure !== move.figure
                  ? ` (draft ${escapeHtml(delib.draftFigure)} → ${escapeHtml(move.figure)})`
                  : ' (figure held)'
              }</div>`
            : '';
          return `<div class="line line--tutor tts-fragment"${ttsDataAttrs('tutor', rawText, 'Tutor')}>${rawText ? ttsPlayButton('tutor') : ''}<span class="who">Tutor:</span> ${text}</div>${bits.length ? `<div class="tmeta">— ${bits.join(', ')}</div>` : ''}${voice}`;
        }
        if (line.role === 'learner') {
          const meta = line.meta || {};
          const bits = [];
          if (meta.adopt?.length)
            bits.push(`adopts ${meta.adopt.map((f) => `<code>${escapeHtml(f.join(' '))}</code>`).join(', ')}`);
          if (meta.retract?.length)
            bits.push(`retracts ${meta.retract.map((f) => `<code>${escapeHtml(f.join(' '))}</code>`).join(', ')}`);
          if (meta.hypothesis) bits.push(`hypothesis: ${escapeHtml(meta.hypothesis)}`);
          if (meta.asserts)
            bits.push(`<span class="assert">asserts <code>${escapeHtml(meta.asserts.join(' '))}</code></span>`);
          return `<div class="line line--learner tts-fragment"${ttsDataAttrs('learner', rawText, 'Learner')}>${rawText ? ttsPlayButton('learner') : ''}<span class="who">Learner:</span> ${text}</div>${bits.length ? `<div class="tmeta">— ${bits.join(' · ')}</div>` : ''}`;
        }
        return `<div class="line">${text}</div>`;
      })
      .join('\n');
    const flags = (eventsByTurn.get(turn) || [])
      .map(
        (e) =>
          `<span class="flag ${DERIVATION_SUCCESS_EVENTS.has(e.type) ? 'flag--ok' : 'flag--bad'}">⚑ ${escapeHtml(e.type)} — ${escapeHtml(e.detail || '')}</span>`,
      )
      .join('\n');
    blocks.push(`<div class="turn"><div class="turn__n">turn ${turn}</div>${lines}${flags}</div>`);
  }

  const verdictOk = result.verdict === 'grounded_anagnorisis';
  const adherence = diagnosis.releaseAdherence || {};
  const stagingChip = diagnosis.staging
    ? diagnosis.staging.source === 'director'
      ? `${diagnosis.staging.movements.length} movements declared${diagnosis.staging.tutorNotes?.length ? ` · ${diagnosis.staging.tutorNotes.length} tutor notes` : ''}`
      : 'sketch held (no movements declared)'
    : null;
  const sg = diagnosis.tutorFigures?.superego;
  const superegoChip = sg
    ? `superego ${sg.interventions}/${sg.watched} interventions · ${sg.withinTurnChanges} within-turn figure changes${diagnosis.tutorStallWatch ? ' · stall-watch v3' : ''}`
    : null;
  const dials = diagnosis.dials || {};
  const chips = [
    `<span class="chip ${verdictOk ? 'chip--ok' : 'chip--bad'}">${escapeHtml(result.verdict || '?')}</span>`,
    ...(diagnosis.group ? [`<span class="chip">group ${escapeHtml(diagnosis.group)}</span>`] : []),
    ...(diagnosis.criticFeedback
      ? [`<span class="chip">⟲ counsel from ${escapeHtml(diagnosis.criticFeedback.source)}</span>`]
      : []),
    `<span class="chip">turns ${result.turnsPlayed}/${diagnosis.turnCap ?? '?'}</span>`,
    `<span class="chip">forced ${result.firstForcedTurn ?? '—'} → asserted ${result.assertedGroundedTurn ?? '—'}</span>`,
    `<span class="chip">releases ${adherence.onCue ?? '—'} on cue · ${adherence.deviations?.length ?? 0} dev · ${adherence.missed?.length ?? 0} missed · ${adherence.unscheduled?.length ?? 0} unscheduled</span>`,
    ...(stagingChip ? [`<span class="chip">${escapeHtml(stagingChip)}</span>`] : []),
    ...(superegoChip ? [`<span class="chip">${escapeHtml(superegoChip)}</span>`] : []),
    ...(dials.recognition || dials.charisma
      ? [`<span class="chip">dials recognition ${dials.recognition || 0}/3 · charisma ${dials.charisma || 0}/3</span>`]
      : []),
    ...derivationBackendChips(diagnosis.backend).map((c) => `<span class="chip">${escapeHtml(c)}</span>`),
    `<span class="chip">${diagnosis.elapsedMs ? `${(diagnosis.elapsedMs / 1000).toFixed(1)}s` : '—'} · ${diagnosis.usage?.calls ?? '?'} calls · $${(diagnosis.usage?.costUSD ?? 0).toFixed(4)}</span>`,
  ].join('\n');

  const discipline = Object.entries(diagnosis.dialogueDiscipline || {})
    .map(
      ([role, s]) =>
        `<tr><td>${escapeHtml(role)}</td><td class="mono">${s.turns}</td><td class="mono">${s.avgSentences} (max ${s.maxSentences})</td><td class="mono">${s.avgWords}</td></tr>`,
    )
    .join('\n');

  return `${pageHead({ title: `${label} · derivation`, css: DERIVATION_CSS })}
<body>
${railHtml({
  active: 'derivation',
  sub: `proof run — ${label}`,
  hint: `<span><b>one proof run</b> — ${escapeHtml(label)}</span><span class="navhint__sep">·</span><span>back to all <a href="/derivation">proof runs</a>, or read generated drama in <a href="/browse">scripts</a></span>`,
})}
<main class="wrap">
<p class="mono" style="margin-top:14px"><a href="/derivation">← all runs</a></p>
<h1>${escapeHtml(world?.title || result.worldId || label)}</h1>
<p class="lede mono">${escapeHtml(label)} · script ${escapeHtml(diagnosis.scriptPath || '?')}${diagnosis.note ? ` · ${escapeHtml(diagnosis.note)}` : ''}</p>
<div class="chips">${chips}</div>
${transcriptTtsToolbarHtml({ fullLabel: 'Play full transcript', includeLabel: 'include tutor superego' })}
${
  commentary
    ? `<h2 class="sect">Critic's commentary</h2><div class="mdblock mdblock--notice">${derivationMdToHtml(commentary.replace(/^# .*\n+/, ''))}</div>`
    : `<h2 class="sect">Critic's commentary</h2><p class="notice-missing">No notice for this run yet — backfill with <span class="mono">npm run derivation:critic -- --label ${escapeHtml(label)}</span>.</p>`
}
<h2 class="sect">The dramaturgical arc — D(t), remaining derivation distance</h2>
${renderDerivationArcSvg({
  trajectory: result.trajectory || [],
  segments,
  ledger: result.ledger || [],
  events: result.events || [],
  world,
  result,
})}
${derivationSlopeCaption(diagnosis.learningSlope || null)}
<h2 class="sect">Logic projection — board closure by turn</h2>
${renderDerivationLogicVisualizer(diagnosis.logicProjection || null)}
<h2 class="sect">Dialogue discipline</h2>
<table class="idx"><thead><tr><th>role</th><th>turns</th><th>avg sentences</th><th>avg words</th></tr></thead><tbody>${discipline}</tbody></table>
${blocks.join('\n')}
${
  result.proof
    ? `<h2 class="sect">The extracted proof (what did the forcing)</h2><pre class="panel">${escapeHtml(renderDerivationProof(result.proof))}</pre><div class="mdblock">${derivationMdToHtml(renderDerivationProofProse(result.proof, world, { ledger: result.ledger }))}</div>`
    : ''
}
<h2 class="sect">Instrument panel (programmatic eval — no judge)</h2>
<div class="mdblock">${derivationMdToHtml(renderDerivationEvalPanel(diagnosis).replace(/^## .*\n+/, ''))}</div>
</main>
${TRANSCRIPT_TTS_CLIENT}
<script>window.TranscriptTts.bind(document.body);</script>
</body></html>`;
}

function framedNoteHtml({ active, sub, src, title, frameTitle, hint = '', brand = 'machine spirits' }) {
  const css = `html,body{height:100%}
body{display:flex;flex-direction:column;overflow:hidden}
.rail{flex:0 0 auto}
.navhint{flex:0 0 auto}
.summaryframe{flex:1 1 auto;width:100%;border:0;display:block;background:var(--paper)}`;
  return `${pageHead({ title, css })}
<body>
${railHtml({ active, brand, sub, hint })}
<iframe id="summaryFrame" class="summaryframe" src="${src}" title="${frameTitle || title}"></iframe>
<script>
(function () {
  try { if (localStorage.getItem('poetics-theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (_e) {}
  var f = document.getElementById('summaryFrame');
  function syncFrame() { try { f.contentDocument.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || ''); } catch (_e) {} }
  f.addEventListener('load', function () {
    try {
      var doc = f.contentDocument;
      if (doc && doc.head && !doc.querySelector('base[target]')) {
        var b = doc.createElement('base'); b.setAttribute('target', '_top');
        doc.head.insertBefore(b, doc.head.firstChild);
      }
    } catch (_e) {}
    syncFrame();
  });
  var t = document.getElementById('themeToggle');
  if (t) t.addEventListener('click', function () {
    var d = document.documentElement, nx = d.getAttribute('data-theme') === 'dark' ? '' : 'dark';
    if (nx) d.setAttribute('data-theme', 'dark'); else d.removeAttribute('data-theme');
    try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
    syncFrame();
  });
})();
</script>
</body>
</html>`;
}

function summaryWrapperHtml() {
  return framedNoteHtml({
    active: 'summary',
    sub: 'the synthesis note — the whole dramatic-recognition arc, from the paper to this scriptorium',
    src: '/arc',
    title: 'Summary · the dramatic-recognition arc',
    frameTitle: 'From Paper 2.0 to dramatic recognition — the synthesis note',
    hint: orientBand(
      'summary',
      'the durable synthesis note tracing the whole dramatic-recognition arc',
      'project writing; the working surfaces are on the rail above',
    ),
  });
}

// ── Shared page chrome ────────────────────────────────────────────────────────
// One source of truth for the theme tokens, type, resets, and the rail (nav)
// styling that every dashboard page shares. Before this, each render*Html()
// inlined its own copy and they had quietly drifted (e.g. body line-height
// 1.6 vs 1.5). Centralising them here means home · compose · ontology · rubric ·
// replays · runs are byte-identical in their chrome, and any future change is a
// one-line edit. The design lineage is levelled up to match the richer /browse
// page: Fraunces (display) / Source Serif 4 (body) / JetBrains Mono (rail +
// code), a faint paper-grain wash, and a frosted rail with the ▸ brand mark.
// The token set is a superset of /browse's (incl. --ease + legacy aliases), so
// /browse could later drop its bespoke copy and adopt pageHead() too.
// Page-specific CSS is passed in via `css` and appended after this.
const BASE_CSS = `@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:opsz,wght@8..60,200..900&family=JetBrains+Mono:wght@300..700&display=swap");
:root{ color-scheme: light dark; --paper:#F1E9D8; --paper-2:#E9DFC7; --paper-3:#EFE4CC; --paper-4:#F7EFDD; --ink:#181310; --ink-2:#3A2F27; --ink-3:#6A5C50; --ink-4:#695B47; --linen:#D8C7A9; --moss:#56683A; --moss-deep:#3A4824; --moss-soft:#E3E6CE; --brick:#A53E2E; --brick-d:#7C2C1F; --brick-soft:#F3DDD6; --ochre:#C08A3E; --ochre-d:#835A1B; --ochre-soft:#F5E6C2; --indigo:#2A4F6B; --indigo-soft:#DCE6EE; --prussian:#2A4F6B; --sun:#E4B644; --red-mark:#D62828; --rule:rgba(28,22,16,.18); --rule-soft:rgba(28,22,16,.10); --ease:cubic-bezier(.22,.61,.36,1); --cols:60; --gutter:clamp(3px,0.32vw,8px); --margin:clamp(12px,1.8vw,34px); --lead:1.5; --lead-tight:1.05; --s-0:clamp(0.70rem,0.66rem + 0.14vw,0.78rem); --s-1:clamp(0.82rem,0.78rem + 0.18vw,0.94rem); --s-2:clamp(0.95rem,0.88rem + 0.32vw,1.14rem); --s-3:clamp(1.18rem,1.02rem + 0.74vw,1.62rem); --s-4:clamp(1.65rem,1.28rem + 1.72vw,2.60rem); --s-5:clamp(2.40rem,1.60rem + 3.80vw,4.80rem); --bg:var(--paper); --panel:var(--paper-4); --muted:var(--ink-3); --line:var(--rule); --accent:var(--moss-deep); --accent-soft:var(--moss-soft); --warn:var(--ochre-d); --trap:var(--brick-d); --flat:var(--ink-3); }
[data-theme="dark"]{ --paper:#14100C; --paper-2:#1B1612; --paper-3:#1F1A14; --paper-4:#221C16; --ink:#F4EEDD; --ink-2:#E0D8C3; --ink-3:#B9AD96; --ink-4:#8C7E6A; --linen:#3A322A; --moss:#8DA868; --moss-deep:#B5CD92; --moss-soft:#2C3520; --brick:#E36953; --brick-d:#F08A75; --brick-soft:#3A1C16; --ochre:#E6B265; --ochre-d:#F3CB88; --ochre-soft:#3A2C12; --indigo:#7FA6CC; --indigo-soft:#1B2A38; --prussian:#7FA6CC; --sun:#E4B644; --red-mark:#E8584B; --rule:rgba(244,238,221,.18); --rule-soft:rgba(244,238,221,.08); }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
html{ background:var(--paper); -webkit-text-size-adjust:100%; }
body{ background:transparent; color:var(--ink-2); font-family:"Source Serif 4","Iowan Old Style",Georgia,serif; font-optical-sizing:auto; font-size:var(--s-1); line-height:var(--lead); letter-spacing:.003em; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; position:relative; min-height:100vh; }
/* warm "specimen" ground — a vignette + two faint pigment glows (ported from /chat's klee-aged paper) */
body::before{ content:""; position:fixed; inset:0; z-index:-2; pointer-events:none; mix-blend-mode:multiply; background:linear-gradient(to right, rgba(24,16,12,.05) 1px, transparent 1px), radial-gradient(120% 80% at 50% 10%, transparent 40%, rgba(24,19,16,.10) 100%), radial-gradient(70% 50% at 10% 90%, rgba(165,62,46,.07), transparent 60%), radial-gradient(60% 50% at 95% 20%, rgba(42,79,107,.07), transparent 60%); background-size:calc((100vw - 2 * var(--margin)) / var(--cols)) 100%, auto, auto, auto; background-position:var(--margin) 0, 0 0, 0 0, 0 0; background-repeat:repeat-x, no-repeat, no-repeat, no-repeat; }
[data-theme="dark"] body::before{ mix-blend-mode:screen; background:linear-gradient(to right, rgba(244,238,221,.05) 1px, transparent 1px), radial-gradient(120% 80% at 50% 10%, transparent 40%, rgba(0,0,0,.28) 100%), radial-gradient(70% 50% at 10% 90%, rgba(227,105,83,.06), transparent 60%), radial-gradient(60% 50% at 95% 20%, rgba(143,176,204,.06), transparent 60%); }
body::after{ content:""; position:fixed; inset:0; z-index:-1; pointer-events:none; opacity:.14; background-image:radial-gradient(rgba(20,16,12,.55) .5px, transparent .5px); background-size:3px 3px; mix-blend-mode:multiply; }
[data-theme="dark"] body::after{ opacity:.08; background-image:radial-gradient(rgba(244,238,221,.45) .5px, transparent .5px); mix-blend-mode:screen; }
button,input,select,textarea{ font:inherit; color:inherit; }
em{ font-style:italic; }
code,pre{ font-family:"JetBrains Mono",ui-monospace,'SF Mono',Menlo,monospace; }
::selection{ background:color-mix(in srgb, var(--ochre) 50%, transparent); color:var(--ink); }
/* the rail (.rail*, .rail__beacon, .rail__menu, x-ray overlay) is styled once in
   railHtml()'s inline <style id="rail-extra"> so it ships identically everywhere —
   do not re-add a .rail* block here. */
/* shader field — Klee-drift pigment ground; light theme only, JS self-gates on reduced-motion */
#field{ position:fixed; inset:0; width:100vw; height:100vh; z-index:-3; opacity:.5; pointer-events:none; }
[data-theme="dark"] #field{ display:none; }
@media (prefers-reduced-motion: reduce){ #field{ display:none; } *,*::before,*::after{ animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; } }`;

// Emit the <!doctype>…</head> shell with the shared chrome + this page's own CSS.
// Each render*Html() then continues with its <body>. Keeps every page's <head>
// byte-identical (charset, viewport, theme tokens) without copy-paste.
function pageHead({ title, css = '' } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${BASE_CSS}
${css}
</style>
</head>`;
}

const TRANSCRIPT_TTS_CLIENT = `<script>
(function () {
  if (window.TranscriptTts) return;
  var audio = new Audio();
  var objectUrl = null;
  var token = 0;
  var controller = null;
  var playingNode = null;

  function clean(text) {
    return String(text || '').replace(/\\s+/g, ' ').trim();
  }
  function roleIsInternal(role) {
    var r = String(role || '').toLowerCase();
    return r.indexOf('superego') >= 0 || r.indexOf('ego') >= 0 || r === 'internal';
  }
  function setStatus(root, text, mode) {
    var host = root && root.querySelector ? root : document;
    host.querySelectorAll('[data-tts-status]').forEach(function (el) {
      el.textContent = text || '';
      el.dataset.state = mode || '';
    });
  }
  function releaseUrl() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
  function clearPlaying() {
    if (playingNode) playingNode.classList.remove('is-playing');
    playingNode = null;
  }
  function stop(root) {
    token += 1;
    if (controller) controller.abort();
    controller = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    releaseUrl();
    clearPlaying();
    setStatus(root || document, 'stopped', '');
  }
  function fragmentFromNode(node, includeSpeaker) {
    if (!node) return null;
    var text = clean(node.dataset.ttsText || '');
    if (!text) return null;
    var role = node.dataset.ttsRole || 'default';
    var speaker = clean(node.dataset.ttsSpeaker || role);
    return {
      role: role,
      speaker: speaker,
      text: includeSpeaker && speaker ? speaker + '. ' + text : text,
      node: node,
    };
  }
  async function fetchSpeech(fragment, signal) {
    var response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: signal,
      body: JSON.stringify({
        text: fragment.text,
        role: fragment.role,
        responseFormat: 'mp3',
      }),
    });
    if (!response.ok) {
      var message = 'TTS failed';
      try {
        var json = await response.json();
        if (json && json.error) message = json.error;
      } catch (_e) {
        try { message = await response.text(); } catch (_e2) {}
      }
      throw new Error(message);
    }
    return response.blob();
  }
  function playBlob(blob, runToken) {
    return new Promise(function (resolve, reject) {
      releaseUrl();
      objectUrl = URL.createObjectURL(blob);
      audio.src = objectUrl;
      audio.onended = resolve;
      audio.onerror = function () { reject(new Error('audio playback failed')); };
      audio.play().then(function () {
        if (runToken !== token) resolve();
      }).catch(reject);
    });
  }
  async function playUnit(fragment, runToken, signal, root) {
    if (!fragment || runToken !== token) return;
    clearPlaying();
    playingNode = fragment.node || null;
    if (playingNode) playingNode.classList.add('is-playing');
    setStatus(root, 'loading ' + (fragment.speaker || fragment.role || 'fragment'), 'loading');
    var blob = await fetchSpeech(fragment, signal);
    if (runToken !== token || signal.aborted) return;
    setStatus(root, 'playing ' + (fragment.speaker || fragment.role || 'fragment'), 'playing');
    await playBlob(blob, runToken);
  }
  async function playFragment(node, root) {
    stop(root);
    token += 1;
    controller = new AbortController();
    var runToken = token;
    var fragment = fragmentFromNode(node, false);
    try {
      await playUnit(fragment, runToken, controller.signal, root || document);
      if (runToken === token) setStatus(root || document, 'done', '');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(root || document, error.message || String(error), 'error');
    } finally {
      if (runToken === token) {
        clearPlaying();
        controller = null;
      }
    }
  }
  async function playTranscript(root) {
    var host = root && root.querySelector ? root : document;
    var includeInternal = !!(host.querySelector('[data-tts-include-internal]') || {}).checked;
    var nodes = Array.from(host.querySelectorAll('[data-tts-text]')).filter(function (node) {
      var role = node.dataset.ttsRole || '';
      return includeInternal || !roleIsInternal(role);
    });
    var fragments = nodes.map(function (node) { return fragmentFromNode(node, true); }).filter(Boolean);
    if (!fragments.length) {
      setStatus(host, 'no transcript fragments visible', 'error');
      return;
    }
    stop(host);
    token += 1;
    controller = new AbortController();
    var runToken = token;
    try {
      for (var i = 0; i < fragments.length; i += 1) {
        if (runToken !== token || controller.signal.aborted) break;
        setStatus(host, (i + 1) + '/' + fragments.length + ' ' + (fragments[i].speaker || fragments[i].role), 'loading');
        await playUnit(fragments[i], runToken, controller.signal, host);
      }
      if (runToken === token) setStatus(host, 'done', '');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(host, error.message || String(error), 'error');
    } finally {
      if (runToken === token) {
        clearPlaying();
        controller = null;
      }
    }
  }
  function bind(root) {
    if (!root || root.dataset.ttsBound === '1') return;
    root.dataset.ttsBound = '1';
    root.addEventListener('click', function (event) {
      var stopButton = event.target.closest('[data-tts-stop]');
      if (stopButton) {
        event.preventDefault();
        stop(root);
        return;
      }
      var fullButton = event.target.closest('[data-tts-full]');
      if (fullButton) {
        event.preventDefault();
        playTranscript(root);
        return;
      }
      var playButton = event.target.closest('[data-tts-play]');
      if (playButton) {
        event.preventDefault();
        playFragment(playButton.closest('[data-tts-text]'), root);
        return;
      }
      if (event.target.closest('a, button, input, label, select, summary, details, textarea')) return;
      var card = event.target.closest('[data-tts-click="1"]');
      if (card) playFragment(card, root);
    });
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = event.target.closest('[data-tts-click="1"]');
      if (!card) return;
      event.preventDefault();
      playFragment(card, root);
    });
  }
  window.TranscriptTts = { bind: bind, playTranscript: playTranscript, playFragment: playFragment, stop: stop };
})();
</script>`;

function transcriptTtsToolbarHtml({
  fullLabel = 'Play transcript',
  includeLabel = 'include superego',
  compact = false,
} = {}) {
  return `<div class="tts-toolbar${compact ? ' tts-toolbar--compact' : ''}">
    <button type="button" class="tts-control" data-tts-full>${escapeHtml(fullLabel)}</button>
    <button type="button" class="tts-control" data-tts-stop>Stop</button>
    <label class="tts-check"><input type="checkbox" data-tts-include-internal> ${escapeHtml(includeLabel)}</label>
    <span class="tts-status" data-tts-status></span>
  </div>`;
}

function ttsDataAttrs(role, text, speaker = role, { click = true } = {}) {
  const cleaned = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  return ` data-tts-role="${escapeHtml(role)}" data-tts-speaker="${escapeHtml(speaker)}" data-tts-text="${escapeHtml(cleaned)}"${click ? ' data-tts-click="1" tabindex="0"' : ''}`;
}

function ttsPlayButton(label = 'fragment') {
  return `<button type="button" class="tts-btn" data-tts-play title="Play ${escapeHtml(label)}" aria-label="Play ${escapeHtml(label)}">play</button>`;
}

// ── Dashboard mini-charts (server-rendered, palette-themed) ───────────────────
// Pure functions returning HTML/CSS bar charts — no client JS, no chart library.
// Every bar maps directly to a DB count, so the picture cannot drift from the
// number it claims to show. Colours are CSS custom-property references so the
// same category reads consistently across the light/dark themes.
const fmtCount = (n) => Number(n || 0).toLocaleString('en-US');

// A proportional stacked bar + legend from [{label, n, color, href?}]. Percentages
// are of the summed n, so callers pass exactly the segments they want totalled
// (e.g. the three classified form-classes, excluding nulls). A segment carrying an
// `href` renders as a link (both the bar slice and its legend entry) so the chart
// doubles as navigation into that slice; an anchor is keyboard-focusable for free,
// and the bar slice — which has no text of its own — gets an aria-label.
function splitBarHtml(segments, { ariaLabel = 'distribution' } = {}) {
  const list = Array.isArray(segments) ? segments : [];
  const total = list.reduce((sum, x) => sum + (x.n || 0), 0) || 1;
  const pct = (n) => (n / total) * 100;
  const bar = list
    .filter((x) => x.n > 0)
    .map((x) => {
      const style = `width:${pct(x.n).toFixed(2)}%;background:${x.color}`;
      const title = `${escapeHtml(x.label)} ${fmtCount(x.n)} (${Math.round(pct(x.n))}%)`;
      return x.href
        ? `<a class="vbar__seg vbar__seg--link" href="${escapeHtml(x.href)}" style="${style}" title="${title}" aria-label="${title}"></a>`
        : `<span class="vbar__seg" style="${style}" title="${title}"></span>`;
    })
    .join('');
  const legend = list
    .map((x) => {
      const inner =
        `<span class="leg__dot" style="background:${x.color}"></span>` +
        `${escapeHtml(x.label)} <b>${fmtCount(x.n)}</b> <span class="leg__pct">${Math.round(pct(x.n))}%</span>`;
      return x.href
        ? `<a class="leg leg--link" href="${escapeHtml(x.href)}">${inner}</a>`
        : `<span class="leg">${inner}</span>`;
    })
    .join('');
  return `<div class="vbar" role="img" aria-label="${escapeHtml(ariaLabel)}">${bar}</div><div class="legs">${legend}</div>`;
}

// A 5-bar mini-histogram for one 0–100 quantized dramatic-form dimension.
// `levels` is [{lv, n}] (any subset of {0,25,50,75,100}); bars are rendered at
// all five fixed bins so dimensions stay visually comparable, with the
// count-weighted mean printed beneath.
function histHtml(label, levels) {
  const BINS = [0, 25, 50, 75, 100];
  const byLv = new Map((Array.isArray(levels) ? levels : []).map((x) => [Number(x.lv), x.n]));
  const counts = BINS.map((b) => byLv.get(b) || 0);
  const max = Math.max(1, ...counts);
  const totalN = counts.reduce((sum, n) => sum + n, 0) || 1;
  const avg = Math.round(BINS.reduce((sum, b, i) => sum + b * counts[i], 0) / totalN);
  const bars = BINS.map(
    (b, i) =>
      `<span class="hbar" style="height:${Math.max(2, (counts[i] / max) * 100).toFixed(1)}%"` +
      ` title="${b}: ${fmtCount(counts[i])}"></span>`,
  ).join('');
  return (
    `<div class="hist"><div class="hist__bars">${bars}</div>` +
    `<div class="hist__l">${escapeHtml(label)}</div><div class="hist__avg">avg ${avg}</div></div>`
  );
}

// An inline sparkline for one run's per-script score series (0–100 each). One
// thin bar per scored script, oldest → newest; a 0 reads as a baseline gap so a
// weak script shows as a dip. Every value is rendered (no cap), so the glyph
// stays a faithful one-bar-per-script picture; the exact dimension, count and
// mean ride along in the title for hover. Empty series → a muted placeholder.
function sparkBarHtml(values, { dimension = 'recontextualization' } = {}) {
  const list = (Array.isArray(values) ? values : []).filter((v) => Number.isFinite(v));
  if (!list.length) return '<span class="spark spark--empty" aria-hidden="true"></span>';
  const bars = list
    .map((v) => `<span class="spark__b" style="height:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></span>`)
    .join('');
  const avg = Math.round(list.reduce((sum, v) => sum + v, 0) / list.length);
  const title = `${dimension} across ${fmtCount(list.length)} scored script${list.length === 1 ? '' : 's'} · avg ${avg}`;
  return `<span class="spark" role="img" aria-label="${escapeHtml(title)}" title="${escapeHtml(title)}">${bars}</span>`;
}

// ── Dashboard front door (GET /) ──────────────────────────────────────────────
// The app's introduction + onboarding. Renders live corpus stats server-side
// (no fetch flash, works JS-off), a first-visit recognition banner, a five-rung
// scaffolding tour with localStorage progress, the full feature map grouped into
// three acts (understand → create → recognize), and a reflexive note naming the
// pedagogy the UI itself borrows. Takes the corpusStats() object + replay count.
function renderDashboardHtml(stats = {}) {
  const s = {
    scripts: 0,
    runs: 0,
    scored: 0,
    scores: 0,
    critics: 0,
    labels: 0,
    openFlags: 0,
    replays: 0,
    proofRuns: 0,
    disciplines: [],
    ...stats,
  };
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const disciplines = s.disciplines || [];
  const recentRuns = Array.isArray(stats.recentRuns) ? stats.recentRuns : [];
  const disciplineChips = disciplines.length
    ? disciplines
        .map((d) => {
          const label = escapeHtml(String(d.name).replace(/_/g, ' '));
          const href = '/browse?discipline=' + encodeURIComponent(d.name);
          return `<a class="chip" href="${href}"><span>${label}</span><span class="chip__n">${fmt(d.n)}</span></a>`;
        })
        .join('')
    : '<span class="muted">no disciplines tagged yet — generate a run to populate the corpus</span>';

  // SQLite CURRENT_TIMESTAMP is UTC and space-separated ("2026-06-05 16:20:01");
  // parse as UTC, then render a coarse "Xh ago" against the server clock (this is
  // a live server render, so Date.now() is fine here — unlike workflow scripts).
  const parseTs = (str) => {
    if (!str) return null;
    const ms = Date.parse(String(str).replace(' ', 'T') + 'Z');
    return Number.isFinite(ms) ? ms : null;
  };
  const relTime = (ms) => {
    if (!ms) return '—';
    const sec = Math.round((Date.now() - ms) / 1000);
    if (sec < 0) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
    return `${Math.round(sec / 86400)}d ago`;
  };
  const pctScored = s.scripts ? Math.round((s.scored / s.scripts) * 100) : 0;
  const lastRunRel = recentRuns.length ? relTime(parseTs(recentRuns[0].createdAt)) : '—';

  // Status command-bar digest: a factual one-liner, not a fabricated liveness
  // claim (there is no cheap "a run is executing right now" signal). The dot and
  // the open-flags segment turn amber only when something actually needs you.
  const statusSegs = [
    `${fmt(s.scripts)} scripts`,
    `${fmt(s.proofRuns)} proof runs`,
    `last run ${lastRunRel}`,
    `${pctScored}% scored`,
  ]
    .map((t) => `<span class="cr-status__seg">${t}</span>`)
    .join('');
  const statusLine =
    statusSegs +
    (s.openFlags
      ? `<span class="cr-status__seg is-warn">${fmt(s.openFlags)} open flag${s.openFlags === 1 ? '' : 's'}</span>`
      : '');

  // Three instrument panels — same numbers as the old flat strip, regrouped as
  // gauges: what exists (corpus) · what's moving (activity) · what needs review.
  const opsRow = (n, label, warn = false) =>
    `<div class="ops-row${warn ? ' is-warn' : ''}"><span class="ops-row__n">${n}</span><span class="ops-row__l">${label}</span></div>`;
  const opsHtml = [
    `<div class="ops-panel"><div class="ops-panel__h">corpus</div>${opsRow(fmt(s.scripts), 'scripts')}${opsRow(fmt(s.proofRuns), 'proof runs')}${opsRow(fmt(s.replays), 'replays')}</div>`,
    `<div class="ops-panel"><div class="ops-panel__h">activity</div>${opsRow(fmt(s.runs), 'runs')}${opsRow(lastRunRel, 'last run')}${opsRow(fmt(disciplines.length), 'disciplines')}</div>`,
    `<div class="ops-panel"><div class="ops-panel__h">review</div>${opsRow(`${pctScored}%`, `scored · ${fmt(s.scored)}/${fmt(s.scripts)}`)}${opsRow(fmt(s.labels), `human labels · ${fmt(s.critics)} critics`)}${opsRow(fmt(s.openFlags), `open flag${s.openFlags === 1 ? '' : 's'}`, s.openFlags > 0)}</div>`,
  ].join('');

  // Recent-runs monitoring feed — the genuinely "control room" piece, drawn from
  // the same per-run query the run list uses (newest-first, with live counts).
  const feedHtml = recentRuns.length
    ? recentRuns
        .map(
          (r) =>
            `<a class="feed-row" href="/browse?runId=${encodeURIComponent(r.id)}"><span class="feed-row__dot${
              r.reviewFlagCount ? ' is-warn' : ''
            }"></span><span class="feed-row__id">${escapeHtml(String(r.id))}</span><span class="feed-row__m">${fmt(
              r.itemCount,
            )} scripts · ${fmt(r.scoreCount)} scored${
              r.reviewFlagCount ? ` · ${fmt(r.reviewFlagCount)} flag${r.reviewFlagCount === 1 ? '' : 's'}` : ''
            }</span>${sparkBarHtml(r.spark)}<span class="feed-row__t">${relTime(parseTs(r.createdAt))}</span></a>`,
        )
        .join('')
    : '<div class="feed-empty">no runs yet — launch one to populate the corpus</div>';

  // ── Corpus-signal charts ────────────────────────────────────────────────────
  // Two verdict splits side by side — the LLM critic's dramatic-form class on
  // scored scripts vs the deterministic rule-checker's outcome on proof runs —
  // then where the script scores land on each dramatic-form dimension. Each
  // headline % is of the bar's own total (classified verdicts / decided runs).
  // Each form-class segment deep-links into /browse pre-filtered to that class
  // (the browse client seeds its form filter from ?form=); recognition/flat/trap
  // are exactly the formSelect option values, so the link lands on a live filter.
  const fcMap = new Map((Array.isArray(s.formClass) ? s.formClass : []).map((r) => [r.name, r.n]));
  const fcSegments = [
    { label: 'recognition', n: fcMap.get('recognition') || 0, color: 'var(--moss)', href: '/browse?form=recognition' },
    { label: 'flat', n: fcMap.get('flat') || 0, color: 'var(--ink-4)', href: '/browse?form=flat' },
    { label: 'trap', n: fcMap.get('trap') || 0, color: 'var(--brick)', href: '/browse?form=trap' },
  ];
  const fcClassified = fcSegments.reduce((sum, x) => sum + x.n, 0);
  const fcUnclassified = fcMap.get('(unclassified)') || 0;
  const fcRecogPct = fcClassified ? Math.round((fcSegments[0].n / fcClassified) * 100) : 0;

  const PV_META = {
    grounded_anagnorisis: { label: 'grounded', color: 'var(--moss)' },
    disengagement: { label: 'disengagement', color: 'var(--ink-4)' },
    aporia: { label: 'aporia', color: 'var(--brick)' },
  };
  // Each verdict segment deep-links into /derivation pre-filtered to that outcome
  // (its index client seeds the outcome toggle from ?verdict=). Only the three
  // verdicts the index recognises get a link; any unknown key stays a plain span.
  const proofVerdicts = s.proofVerdicts && typeof s.proofVerdicts === 'object' ? s.proofVerdicts : {};
  const pvSegments = Object.entries(proofVerdicts)
    .filter(([k]) => k !== '(none)')
    .map(([k, n]) => ({
      label: PV_META[k]?.label || k.replace(/_/g, ' '),
      n,
      color: PV_META[k]?.color || 'var(--ochre)',
      ...(PV_META[k] ? { href: '/derivation?verdict=' + encodeURIComponent(k) } : {}),
    }))
    .sort((a, b) => b.n - a.n);
  const pvTotal = pvSegments.reduce((sum, x) => sum + x.n, 0);
  const pvGroundedPct = pvTotal ? Math.round(((proofVerdicts.grounded_anagnorisis || 0) / pvTotal) * 100) : 0;

  const scoreDist = s.scoreDist && typeof s.scoreDist === 'object' ? s.scoreDist : {};
  const DIST_DIMS = [
    ['recontextualization', 'recontextualization'],
    ['stated_insight', 'stated insight'],
    ['rupture', 'rupture'],
    ['global_coherence', 'global coherence'],
  ];
  const distHtml = DIST_DIMS.map(([key, label]) => histHtml(label, scoreDist[key] || [])).join('');
  const distTotal = DIST_DIMS.reduce(
    (sum, [key]) => sum + (scoreDist[key] || []).reduce((a, x) => a + (x.n || 0), 0),
    0,
  );

  const RUNGS = [
    [
      1,
      'Read a finished drama',
      'Open the browser and read one generated script end to end — a tutoring dialogue staged as a short play, turn by turn.',
      '/browse',
      'scripts',
    ],
    [
      2,
      'See the other corpus — proof runs',
      'Open the proof runs: the same kind of tutoring dialogue, but here the tutor must lead the learner to a hidden answer by inference, and a fixed rule-checker — not an AI critic — decides whether they truly got there.',
      '/derivation',
      'proof runs',
    ],
    [
      3,
      'Learn the shared vocabulary',
      'Open the ontology to see the terms the whole system reasons in — moves, agencies, recognition — through system, tutor &amp; learner lenses.',
      '/ontology',
      'ontology',
    ],
    [
      4,
      'Compose a scene',
      'Sit in on a live tutoring scene and play one seat turn by turn — or switch to batch mode to assemble a full spec, validated live against the ontology as you build the turn plan.',
      '/compose/live',
      'compose a scene',
    ],
    [
      5,
      'Launch a run',
      'Launch a generation from the runs console — free/mock by default, with every cost class shown before you ever commit a paid call.',
      '/runs',
      'launch a run',
    ],
    [
      6,
      'Read a recognition',
      'Open a counterfactual replay diffed against its original — where a single changed move reshapes the drama.',
      '/replays',
      'replays',
    ],
  ];
  const rungsHtml = RUNGS.map(
    ([n, title, desc, href, label]) => `
      <div class="rung" id="rung-${n}">
        <button class="rung__check" data-rung="${n}" type="button" aria-label="mark step ${n} complete"><span class="rung__num">${n}</span><span class="rung__tick" aria-hidden="true">✓</span></button>
        <div class="rung__body">
          <div class="rung__title">${title}</div>
          <div class="rung__desc">${desc}</div>
        </div>
        <a class="rung__go" data-rung="${n}" href="${href}">${label} →</a>
      </div>`,
  ).join('');

  // The five working surfaces — the rail's primary row, minus home. Three
  // collections of finished tutoring dialogue (scripts, proof runs, replays) and
  // the two tools that make more. Grouping them here, matched and adjacent, mirrors
  // the rail. The pair most often confused — scripts vs proof runs — sit side by
  // side, with what decides each outcome (an AI critic vs a fixed rule-checker)
  // stated in the card tag.
  const SURFACES = [
    [
      'surf--corpus',
      'graded by an AI critic',
      'scripts',
      'Tutoring dialogues staged as short plays. An AI critic grades each one on dramatic form (was a reversal of understanding earned?). Filter by run, discipline or free text.',
      '/browse',
    ],
    [
      'surf--corpus',
      'checked by a fixed rule',
      'proof runs',
      'Tutoring runs where the tutor must lead the learner to a hidden answer by inference. A fixed rule-checker — not an AI judge, not a quality score — decides whether the learner genuinely got there. (The project calls these derivation runs.)',
      '/derivation',
    ],
    [
      'surf--corpus',
      'one move changed',
      'replays',
      'A finished script re-run with a single move altered, then diffed against the original — so you can see how one change reshapes where recognition does or does not cohere.',
      '/replays',
    ],
    [
      'surf--make',
      'make · a scene',
      'compose a scene',
      'Sit in on a live tutoring scene and play one seat turn by turn — or switch to batch mode to assemble a full spec, validated live against the poetics ontology.',
      '/compose/live',
    ],
    [
      'surf--make',
      'make · a run',
      'launch a run',
      'Spawn runs — generative · replay · adversarial-CLI · online-scoring. Free/mock by default; cost shown before any paid call.',
      '/runs',
    ],
  ];
  const surfacesHtml = SURFACES.map(
    ([cls, kind, name, desc, href]) => `
      <a class="surf ${cls}" href="${href}">
        <div class="surf__k">${kind}</div>
        <div class="surf__t">${name}</div>
        <div class="surf__d">${desc}</div>
        <div class="surf__go">open →</div>
      </a>`,
  ).join('');

  // Everything that isn't a working surface: reference material and the project's
  // own writing. Lighter weight than the surfaces above — read at leisure.
  const REFS = [
    [
      'Ontology atlas',
      'The shared TBox the system reasons in, projected into system, tutor &amp; learner lenses with the raw rules per module.',
      '/ontology',
    ],
    [
      'Summary',
      'The synthesis note tracing the whole dramatic-recognition arc, from the paper through to this scriptorium.',
      '/summary',
    ],
    [
      'Adaptation — story so far',
      'A dated lab-notebook narrative of every path tried toward making the tutor adapt: what works, what is a null, what is still live. Provisional by design.',
      '/story',
    ],
    [
      'Three instruments — one repertoire',
      'The ontology memory model, the small-rhetoric scorers &amp; the dramatic-form rubric — what each measured by grain, and how the few wins might become adaptive mechanisms.',
      '/repertoire',
    ],
    [
      'The development board',
      'A read-only rendering of TODO.md: every tracked item as a filterable status × theme grid. Originates no claims — the source stays in TODO.md.',
      '/board',
    ],
  ];
  const refsHtml = REFS.map(
    ([t, d, href]) =>
      `<a class="card" href="${href}"><div class="card__t">${t}</div><div class="card__d">${d}</div><div class="card__cta">open →</div></a>`,
  ).join('');

  return `${pageHead({
    title: 'machine spirits · poetics scriptorium',
    css: `
.wrap{ max-width:1080px; margin:0 auto; padding:0 22px 64px; }
.welcome{ margin:18px 0 0; border:1px solid var(--rule); border-left:3px solid var(--moss); background:var(--paper-4); padding:16px 18px; }
.welcome__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--moss-deep); }
.welcome h2{ margin:7px 0 6px; font:italic 22px/1.2 "Fraunces","Source Serif 4",Georgia,serif; font-variation-settings:"SOFT" 50,"WONK" 1,"opsz" 72; color:var(--ink); }
.welcome p{ margin:0; color:var(--ink-2); max-width:66ch; }
.welcome__btns{ display:flex; gap:10px; margin-top:13px; flex-wrap:wrap; }
.cr-head{ margin:18px 0 0; border:1px solid var(--rule); background:var(--paper-4); border-top:3px solid var(--moss-deep); padding:20px 22px 18px; }
.cr-head__top{ display:flex; align-items:flex-start; justify-content:space-between; gap:18px 24px; flex-wrap:wrap; }
.cr-head__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.12em; color:var(--ink-4); }
.cr-head h1{ margin:9px 0 4px; font:italic 34px/1.04 "Fraunces","Source Serif 4",Georgia,serif; font-variation-settings:"SOFT" 50,"WONK" 1,"opsz" 96; letter-spacing:-.015em; color:var(--ink); }
.cr-head__tag{ font:13px/1.3 ui-monospace,monospace; color:var(--ink-3); }
.cr-status{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; font:11px/1.4 ui-monospace,monospace; color:var(--ink-3); border:1px solid var(--rule); background:var(--paper-3); padding:8px 12px; }
.cr-status__dot{ flex:none; width:8px; height:8px; border-radius:50%; background:var(--moss); box-shadow:0 0 0 3px var(--rule-soft); }
.cr-status__dot.is-warn{ background:var(--brick); box-shadow:0 0 0 3px var(--ochre-soft); }
.cr-status__seg{ white-space:nowrap; }
.cr-status__seg + .cr-status__seg{ padding-left:10px; border-left:1px solid var(--rule); }
.cr-status__seg.is-warn{ color:var(--brick-d); font-weight:600; }
.cr-head__lede{ margin:14px 0 0; font-size:14px; line-height:1.55; color:var(--ink-2); max-width:80ch; }
.cr-head__lede a{ color:var(--moss-deep); text-decoration:none; white-space:nowrap; }
.cr-head__lede a:hover{ text-decoration:underline; }
.cr-cmd{ display:flex; gap:10px; flex-wrap:wrap; margin-top:16px; }
.cmd{ display:inline-flex; align-items:center; gap:8px; text-decoration:none; font:600 13px ui-monospace,monospace; border:1px solid var(--rule); background:var(--paper); color:var(--ink); padding:11px 16px; transition:border-color .15s ease, background .15s ease; }
.cmd:hover{ border-color:var(--ink-3); }
.cmd__i{ font-size:13px; color:var(--ink-4); }
.cmd--go{ background:var(--moss-deep); border-color:var(--moss-deep); color:var(--paper); }
.cmd--go .cmd__i{ color:var(--paper); }
.cmd--go:hover{ background:var(--moss); border-color:var(--moss); }
@media(max-width:600px){ .cr-head h1{ font-size:28px; } .cmd{ flex:1 1 auto; justify-content:center; } }
.btn{ display:inline-flex; align-items:center; gap:7px; font:13px ui-monospace,monospace; text-decoration:none; cursor:pointer; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink); padding:9px 15px; }
.btn.primary{ background:var(--moss-deep); color:var(--paper); border-color:var(--moss-deep); }
.btn.ghost{ background:transparent; }
.ops{ display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:var(--rule); border:1px solid var(--rule); }
@media(max-width:760px){ .ops{ grid-template-columns:1fr; } }
.ops-panel{ background:var(--paper-4); padding:14px 16px; }
.ops-panel__h{ font:600 10px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-4); margin-bottom:10px; }
.ops-row{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; padding:6px 0; }
.ops-row + .ops-row{ border-top:1px solid var(--rule-soft); }
.ops-row__n{ font:600 20px/1 Georgia,serif; color:var(--moss-deep); white-space:nowrap; }
.ops-row__l{ font:11px/1.3 ui-monospace,monospace; color:var(--ink-4); text-align:right; }
.ops-row.is-warn .ops-row__n{ color:var(--brick-d); }
.feed{ margin-top:18px; border:1px solid var(--rule); background:var(--paper-4); }
.feed__h{ display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid var(--rule); font:600 10px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.09em; color:var(--ink-4); }
.feed__h a{ text-transform:none; letter-spacing:0; font-weight:400; color:var(--moss-deep); text-decoration:none; }
.feed__h a:hover{ text-decoration:underline; }
.feed-row{ display:flex; align-items:center; gap:12px; padding:9px 14px; text-decoration:none; }
.feed-row + .feed-row{ border-top:1px solid var(--rule-soft); }
.feed-row:hover{ background:var(--paper-3); }
.feed-row__dot{ flex:none; width:7px; height:7px; border-radius:50%; background:var(--moss); }
.feed-row__dot.is-warn{ background:var(--brick); }
.feed-row__id{ flex:none; max-width:34ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:600 12px ui-monospace,monospace; color:var(--ink); }
.feed-row__m{ flex:1; font:11px ui-monospace,monospace; color:var(--ink-4); }
.feed-row__t{ flex:none; font:11px ui-monospace,monospace; color:var(--ink-4); }
.feed-empty{ padding:16px 14px; font:italic 12px ui-monospace,monospace; color:var(--ink-4); }
.spark{ flex:none; display:flex; align-items:flex-end; gap:1px; width:88px; height:20px; }
.spark__b{ flex:1 1 0; min-width:0; background:var(--moss); opacity:.7; border-radius:1px 1px 0 0; }
.feed-row:hover .spark__b{ opacity:.9; }
.spark--empty{ flex:none; width:88px; height:20px; }
@media(max-width:600px){ .spark,.spark--empty{ display:none; } }
.sig{ display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.sig-card{ border:1px solid var(--rule); background:var(--paper-4); padding:14px 16px; }
.sig-card__top{ display:flex; align-items:baseline; justify-content:space-between; gap:12px; margin-bottom:11px; }
.sig-card__k{ font:600 10px/1.3 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-4); }
.sig-card__big{ font:600 26px/1 -apple-system,system-ui,sans-serif; color:var(--moss-deep); white-space:nowrap; }
.sig-card__pct{ font-size:15px; color:var(--ink-4); }
.sig-card__lbl{ font:600 11px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-3); margin-left:3px; }
.sig-card__foot{ margin-top:10px; font:11px ui-monospace,monospace; color:var(--ink-4); }
.sig-card__none{ color:var(--ink-4); }
.sig-empty{ margin-top:2px; padding:10px 0 2px; font:italic 12px/1.5 ui-monospace,monospace; color:var(--ink-4); }
.vbar{ display:flex; height:18px; border-radius:3px; overflow:hidden; background:var(--rule-soft); }
.vbar__seg{ height:100%; }
.vbar__seg + .vbar__seg{ box-shadow:inset 1px 0 0 var(--paper-4); }
.vbar__seg--link{ display:block; text-decoration:none; transition:filter .12s var(--ease); }
.vbar__seg--link:hover{ filter:brightness(1.12) saturate(1.08); }
.vbar__seg--link:focus-visible{ outline:2px solid var(--ochre-d); outline-offset:2px; }
.legs{ display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:9px; }
.leg{ display:inline-flex; align-items:center; gap:6px; font:12px ui-monospace,monospace; color:var(--ink-3); }
.leg--link{ text-decoration:none; cursor:pointer; border-radius:3px; transition:color .12s var(--ease); }
.leg--link:hover{ color:var(--ink); }
.leg--link:hover .leg__dot{ box-shadow:0 0 0 2px var(--ochre-soft); }
.leg--link:focus-visible{ outline:2px solid var(--ochre-d); outline-offset:2px; }
.leg__dot{ flex:none; width:9px; height:9px; border-radius:2px; }
.leg b{ color:var(--ink); font-weight:600; }
.leg__pct{ color:var(--ink-4); }
.dist{ margin-top:12px; border:1px solid var(--rule); background:var(--paper-4); padding:14px 16px; }
.dist__h{ font:600 10px/1.3 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-4); margin-bottom:14px; }
.dist__grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.hist{ display:flex; flex-direction:column; align-items:center; }
.hist__bars{ display:flex; align-items:flex-end; justify-content:center; gap:3px; height:54px; width:100%; padding:0 4px; }
.hbar{ flex:1; max-width:14px; background:var(--moss); border-radius:2px 2px 0 0; opacity:.85; }
.hist__l{ margin-top:7px; font:11px/1.3 ui-monospace,monospace; color:var(--ink-3); text-align:center; }
.hist__avg{ margin-top:2px; font:10px ui-monospace,monospace; color:var(--ink-4); }
@media(max-width:760px){ .sig{ grid-template-columns:1fr; } }
@media(max-width:520px){ .dist__grid{ grid-template-columns:repeat(2,1fr); } }
.chips__lead{ font:13px/1.5 ui-monospace,monospace; color:var(--ink-3); margin:0 0 10px; }
.chips{ display:flex; flex-wrap:wrap; gap:8px; margin:0 0 8px; }
.chip{ display:inline-flex; align-items:center; gap:8px; text-decoration:none; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink-2); padding:5px 11px; font:12px ui-monospace,monospace; }
.chip:hover{ border-color:var(--moss); color:var(--moss-deep); }
.chip__n{ color:var(--ink-4); }
h2.section{ font:600 13px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3); margin:46px 0 5px; }
.section__sub{ color:var(--ink-4); margin:0 0 16px; font-size:13px; max-width:74ch; }
.ladder{ border:1px solid var(--rule); background:var(--paper-3); }
.ladder__head{ display:flex; align-items:center; gap:14px; padding:12px 16px; border-bottom:1px solid var(--rule); }
.prog{ flex:1; height:6px; background:var(--rule-soft); position:relative; overflow:hidden; border-radius:3px; }
.prog__fill{ position:absolute; inset:0 auto 0 0; width:0; background:var(--moss); transition:width .35s ease; }
.prog__label{ font:11px ui-monospace,monospace; color:var(--ink-4); white-space:nowrap; }
.ladder__reset{ font:11px ui-monospace,monospace; color:var(--ink-4); text-decoration:none; border:1px solid var(--rule); padding:4px 9px; }
.ladder__reset:hover{ color:var(--brick-d); border-color:var(--brick); }
.rung{ display:flex; align-items:flex-start; gap:14px; padding:14px 16px; border-bottom:1px solid var(--rule-soft); }
.rung:last-child{ border-bottom:0; }
.rung__check{ flex:none; width:30px; height:30px; border-radius:50%; border:1px solid var(--rule); background:var(--paper); color:var(--ink-3); cursor:pointer; display:grid; place-items:center; font:600 13px ui-monospace,monospace; padding:0; }
.rung__tick{ display:none; font-size:15px; }
.rung--done .rung__check{ background:var(--moss); border-color:var(--moss-deep); color:#fff; }
[data-theme="dark"] .rung--done .rung__check{ color:var(--paper); }
.rung--done .rung__num{ display:none; }
.rung--done .rung__tick{ display:block; }
.rung--done .rung__title{ color:var(--ink-4); }
.rung--next{ background:var(--ochre-soft); }
.rung--next .rung__check{ border-color:var(--ochre); color:var(--ochre-d); box-shadow:0 0 0 3px var(--ochre-soft); }
.rung__body{ flex:1; }
.rung__title{ font:600 14px/1.3 -apple-system,system-ui,sans-serif; color:var(--ink); }
.rung__desc{ color:var(--ink-3); font-size:13px; margin-top:3px; max-width:74ch; }
.rung__go{ flex:none; align-self:center; text-decoration:none; font:12px ui-monospace,monospace; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink-2); padding:7px 12px; }
.rung__go:hover{ border-color:var(--moss); color:var(--moss-deep); }
.surfaces{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
@media(max-width:900px){ .surfaces{ grid-template-columns:repeat(2,1fr); } }
@media(max-width:520px){ .surfaces{ grid-template-columns:1fr; } }
.surf{ display:flex; flex-direction:column; text-decoration:none; border:1px solid var(--rule); background:var(--paper-4); border-top:3px solid var(--ink-4); padding:13px 13px 12px; transition:border-color .15s ease; }
.surf:hover{ border-color:var(--ink-3); }
.surf--corpus{ border-top-color:var(--moss); }
.surf--make{ border-top-color:var(--ochre); }
.surf__k{ font:600 10px/1.3 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-4); }
.surf__t{ font:600 16px/1.1 "JetBrains Mono",ui-monospace,monospace; color:var(--ink); margin:7px 0 0; }
.surf__d{ color:var(--ink-3); font-size:12px; line-height:1.5; margin:6px 0 0; flex:1; }
.surf__go{ font:11px ui-monospace,monospace; color:var(--moss-deep); margin-top:10px; }
.surf--make .surf__go{ color:var(--ochre-d); }
.surf--corpus:hover{ border-color:var(--moss); }
.surf--make:hover{ border-color:var(--ochre); }
.refs{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
@media(max-width:820px){ .refs{ grid-template-columns:1fr; } }
.card{ display:block; text-decoration:none; border:1px solid var(--rule); background:var(--paper-4); padding:11px 12px; }
.card:hover{ border-color:var(--ink-3); }
.card__t{ font:600 13px/1.3 -apple-system,system-ui,sans-serif; color:var(--ink); }
.card__d{ color:var(--ink-3); font-size:12px; margin:4px 0 8px; }
.card__cta{ font:11px ui-monospace,monospace; color:var(--moss-deep); }
.reflect{ margin-top:46px; border:1px dashed var(--rule); background:var(--paper-3); padding:18px 20px; }
.reflect__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ochre-d); }
.reflect h3{ margin:9px 0 13px; font:italic 19px "Fraunces","Source Serif 4",Georgia,serif; font-variation-settings:"SOFT" 50,"opsz" 48; color:var(--ink); }
.reflect ul{ margin:0; padding:0; list-style:none; display:grid; gap:11px; }
.reflect li{ color:var(--ink-2); font-size:13px; max-width:80ch; padding-left:14px; border-left:2px solid var(--rule); }
.reflect li b{ color:var(--moss-deep); }
.muted{ color:var(--ink-4); font-style:italic; }
details.tour{ margin-top:30px; border:1px solid var(--rule); background:var(--paper-3); }
.tour__sum{ display:flex; align-items:center; gap:14px; padding:12px 16px; cursor:pointer; list-style:none; }
.tour__sum::-webkit-details-marker{ display:none; }
.tour__lead{ font:13px ui-monospace,monospace; color:var(--ink-3); }
.tour__lead b{ color:var(--moss-deep); }
.tour__chev{ flex:none; font-size:12px; color:var(--ink-4); transition:transform .2s ease; }
details.tour[open] .tour__chev{ transform:rotate(180deg); }
.tour .ladder{ border:0; border-top:1px solid var(--rule); background:transparent; }
.foot{ margin-top:32px; color:var(--ink-4); font:11px ui-monospace,monospace; }
`,
  })}
<body>
${railHtml({ active: 'home', brand: 'machine spirits', sub: 'a drama-machine for tutoring — generate · score · recognize' })}
<div class="wrap">

  <div class="welcome" id="welcome" hidden>
    <div class="welcome__k">new here · welcome</div>
    <h2>First time at the scriptorium?</h2>
    <p>This is a research instrument that stages tutoring dialogues as <em>drama</em> and reads them the way a literary critic would — for dramatic form, not for what is in anyone's head. You don't need to know the codebase. The six-step tour below walks the whole surface; take it at your own pace.</p>
    <div class="welcome__btns">
      <button class="btn primary" id="welcomeBegin" type="button">begin the tour ↓</button>
      <button class="btn ghost" id="welcomeDismiss" type="button">I'll explore on my own</button>
    </div>
  </div>

  <header class="cr-head">
    <div class="cr-head__top">
      <div class="cr-head__id">
        <div class="cr-head__k">machine spirits · poetics</div>
        <h1>Eval control room</h1>
        <div class="cr-head__tag">Tutoring, staged as drama.</div>
      </div>
      <div class="cr-status" role="status" aria-label="corpus status">
        <span class="cr-status__dot${s.openFlags ? ' is-warn' : ''}" aria-hidden="true"></span>
        ${statusLine}
      </div>
    </div>
    <p class="cr-head__lede">Generate tutoring dialogues that hinge on a reversal of understanding, score them on dramatic form, then study where recognition coheres. Launch and watch runs here; read, compose and inspect from the consoles below. <a href="#why">Why it's built this way ↓</a></p>
    <div class="cr-cmd">
      <a class="cmd cmd--go" href="/runs"><span class="cmd__i" aria-hidden="true">▸</span> Launch a run</a>
      <a class="cmd" href="/compose/live"><span class="cmd__i" aria-hidden="true">✎</span> Compose a scene</a>
      <a class="cmd" href="/browse"><span class="cmd__i" aria-hidden="true">⊞</span> Browse scripts</a>
      <a class="cmd" href="/derivation"><span class="cmd__i" aria-hidden="true">⌗</span> Proof runs</a>
    </div>
  </header>

  <h2 class="section">Operations</h2>
  <p class="section__sub">Live counts across the corpus, the run activity, and what's waiting on review. The flag light turns amber when something needs you.</p>
  <div class="ops">${opsHtml}</div>

  <h2 class="section">Signal</h2>
  <p class="section__sub">What the two corpora hold, read straight from the database. An AI critic sorts each scored script's dramatic form into recognition, flat, or trap; a fixed rule-checker sorts each proof run into grounded, disengagement, or aporia — the same three-way shape, two different ways of scoring. Below that, where the script scores land on each dramatic-form dimension.</p>
  <div class="sig">
    <div class="sig-card">
      <div class="sig-card__top">
        <span class="sig-card__k">scripts · critic verdict</span>
        <span class="sig-card__big">${
          fcClassified
            ? `${fcRecogPct}<span class="sig-card__pct">%</span> <span class="sig-card__lbl">recognition</span>`
            : '<span class="sig-card__none">—</span>'
        }</span>
      </div>
      ${
        fcClassified
          ? splitBarHtml(fcSegments, { ariaLabel: 'critic form-class split: recognition, flat, trap' }) +
            `<div class="sig-card__foot">${fmt(fcClassified)} critic verdict${fcClassified === 1 ? '' : 's'}${fcUnclassified ? ` · ${fmt(fcUnclassified)} unclassified` : ''}</div>`
          : '<div class="sig-empty">no scored scripts yet — an AI critic sorts each script into recognition, flat, or trap once it has graded the corpus</div>'
      }
    </div>
    <div class="sig-card">
      <div class="sig-card__top">
        <span class="sig-card__k">proof runs · rule-checker verdict</span>
        <span class="sig-card__big">${
          pvTotal
            ? `${pvGroundedPct}<span class="sig-card__pct">%</span> <span class="sig-card__lbl">grounded</span>`
            : '<span class="sig-card__none">—</span>'
        }</span>
      </div>
      ${
        pvTotal
          ? splitBarHtml(pvSegments, { ariaLabel: 'proof-run verdict split: grounded, disengagement, aporia' }) +
            `<div class="sig-card__foot">${fmt(pvTotal)} proof run${pvTotal === 1 ? '' : 's'} · a checker outcome, not a quality score</div>`
          : '<div class="sig-empty">no proof runs yet — a fixed rule-checker decides each outcome once a run lands</div>'
      }
    </div>
  </div>
  <div class="dist">
    <div class="dist__h">script scores · where the corpus lands on each dramatic-form dimension (0–100)</div>
    ${
      distTotal
        ? `<div class="dist__grid">${distHtml}</div>`
        : '<div class="sig-empty">no scored scripts yet — dimension scores appear here once the corpus has been graded</div>'
    }
  </div>

  <div class="feed">
    <div class="feed__h"><span>recent runs</span><a href="/browse">all runs →</a></div>
    ${feedHtml}
  </div>

  <p class="chips__lead">The corpus spans ${disciplines.length} field${disciplines.length === 1 ? '' : 's'} — jump straight into one:</p>
  <div class="chips">${disciplineChips}</div>

  <details class="tour" id="tourDetails">
    <summary class="tour__sum">
      <span class="tour__lead">new here? <b>a six-step tour</b> of the whole surface</span>
      <span class="prog" aria-hidden="true"><span class="prog__fill" id="progFill"></span></span>
      <span class="prog__label" id="progLabel">not started</span>
      <span class="tour__chev" aria-hidden="true">▾</span>
    </summary>
    <div class="ladder" id="ladder">
      <div class="ladder__head"><a class="ladder__reset" id="resetTour" href="#">reset progress</a></div>
      ${rungsHtml}
    </div>
  </details>

  <h2 class="section">Consoles</h2>
  <p class="section__sub">The five working consoles in the top rail — three collections of finished tutoring dialogue (graded by an AI critic, checked by a fixed rule-checker, or diffed one move at a time) and the two that make more. Everything else is reference &amp; reading, below.</p>
  <div class="surfaces">${surfacesHtml}</div>

  <h2 class="section">Reference &amp; reading</h2>
  <p class="section__sub">Background, analysis, and the project's own notes — read at your leisure.</p>
  <div class="refs">${refsHtml}</div>

  <div class="reflect" id="why">
    <div class="reflect__k">why the site is built this way</div>
    <h3>This scriptorium is built from the pedagogy it studies.</h3>
    <ul>
      <li><b>Recognition.</b> It greets a first-time visitor and names where they are before instructing — the mutual recognition the tutor is asked to extend the learner.</li>
      <li><b>Scaffolding.</b> The tour is a zone-of-proximal-development ladder: one rung at a time, you set the pace, and you can mark what you already command.</li>
      <li><b>Dramatic form.</b> The six-step tour traces an <em>anagnorisis</em> — read the material, make something new, recognize what changed — the same shape the critic looks for in a script.</li>
    </ul>
  </div>

  <p class="foot">machine spirits · poetics — localhost control room · read-only</p>
</div>
<script>
(function(){
  function $(id){ return document.getElementById(id); }
  try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
  var tb = $('themeToggle');
  if (tb) tb.addEventListener('click', function(){
    var d = document.documentElement; var nx = d.getAttribute('data-theme')==='dark' ? '' : 'dark';
    if (nx) d.setAttribute('data-theme','dark'); else d.removeAttribute('data-theme');
    try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
  });

  var welcomed = false;
  try { welcomed = localStorage.getItem('poetics-welcomed')==='1'; } catch (_e) {}
  var banner = $('welcome');
  if (banner && !welcomed) banner.hidden = false;
  function dismissWelcome(){ if (banner) banner.hidden = true; try { localStorage.setItem('poetics-welcomed','1'); } catch (_e) {} }
  var wd = $('welcomeDismiss'); if (wd) wd.addEventListener('click', dismissWelcome);
  var wb = $('welcomeBegin'); if (wb) wb.addEventListener('click', function(){ dismissWelcome(); var d = $('tourDetails'); if (d) d.open = true; var l = d || $('ladder'); if (l) l.scrollIntoView({ behavior:'smooth', block:'start' }); });

  var TOTAL = 6;
  function isDone(n){ try { return localStorage.getItem('poetics-rung-v2-'+n)==='1'; } catch (_e) { return false; } }
  function setDone(n, v){ try { localStorage.setItem('poetics-rung-v2-'+n, v ? '1' : '0'); } catch (_e) {} }
  function paint(){
    var count = 0, next = 0;
    for (var i = 1; i <= TOTAL; i++){
      var row = $('rung-'+i); if (!row) continue;
      var d = isDone(i); if (d) count++;
      row.classList.toggle('rung--done', d);
      row.classList.remove('rung--next');
      if (!d && !next) next = i;
    }
    if (next){ var nr = $('rung-'+next); if (nr) nr.classList.add('rung--next'); }
    var fill = $('progFill'); if (fill) fill.style.width = Math.round(count/TOTAL*100)+'%';
    var lbl = $('progLabel');
    if (lbl) lbl.textContent = count===0 ? 'not started' : count===TOTAL ? 'tour complete — you have seen the whole surface' : count+' of '+TOTAL+' done';
  }
  var checks = document.querySelectorAll('.rung__check');
  for (var c = 0; c < checks.length; c++){
    checks[c].addEventListener('click', function(){ var n = +this.getAttribute('data-rung'); setDone(n, !isDone(n)); paint(); });
  }
  var gos = document.querySelectorAll('.rung__go');
  for (var g = 0; g < gos.length; g++){
    gos[g].addEventListener('click', function(){ setDone(+this.getAttribute('data-rung'), true); });
  }
  var reset = $('resetTour');
  if (reset) reset.addEventListener('click', function(e){ e.preventDefault(); for (var i = 1; i <= TOTAL; i++) setDone(i, false); paint(); });
  paint();
})();
</script>
</body>
</html>`;
}

function renderComposeHtml() {
  const V = COMPOSER_VOCAB;
  return `${pageHead({
    title: 'Drama Composer · poetics',
    css: `
.compose{ display:grid; grid-template-columns: minmax(0,1.3fr) minmax(330px,.9fr); align-items:start; }
@media (max-width:900px){ .compose{ grid-template-columns:1fr; } }
.cform{ padding:18px 20px; display:flex; flex-direction:column; gap:16px; max-height:calc(100vh - 52px); overflow:auto; }
.cside{ position:sticky; top:52px; padding:16px 16px; display:flex; flex-direction:column; gap:14px; border-left:1px solid var(--rule); max-height:calc(100vh - 52px); overflow:auto; background:var(--paper-3); }
.sec{ border:1px solid var(--rule); background:var(--paper-4); }
.sec > h3{ margin:0; padding:9px 12px; font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); }
details.sec > summary{ margin:0; padding:9px 12px; font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); cursor:pointer; list-style:none; display:flex; align-items:center; gap:8px; user-select:none; }
details.sec:not([open]) > summary{ border-bottom:none; }
details.sec > summary::-webkit-details-marker{ display:none; }
details.sec > summary::before{ content:'▸'; color:var(--ink-4); font-size:9px; transition:transform .12s ease; }
details.sec[open] > summary::before{ transform:rotate(90deg); }
details.sec > summary:hover{ color:var(--ink); }
.sec .opt{ margin-left:auto; font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink-4); font:11px ui-monospace,monospace; }
.advnote{ font:10px ui-monospace,monospace; color:var(--ink-4); text-transform:uppercase; letter-spacing:.05em; display:flex; align-items:center; gap:12px; padding:2px 0; }
.advnote::before,.advnote::after{ content:''; height:1px; background:var(--rule); flex:1; }
.sec > .body{ padding:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px 14px; }
.sec > .body.one{ grid-template-columns:1fr; }
label.fld,.fld{ display:flex; flex-direction:column; gap:4px; font-size:11px; color:var(--ink-3); text-transform:uppercase; letter-spacing:.04em; }
.fld.wide,label.fld.wide{ grid-column:1 / -1; }
input[type=text],input[type=number],select,textarea{ width:100%; font:13px ui-monospace,monospace; color:var(--ink); background:var(--paper); border:1px solid var(--rule); padding:6px 8px; }
textarea{ min-height:46px; resize:vertical; }
.checks{ display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:4px; }
label.chk{ display:inline-flex; align-items:center; gap:5px; font:12px ui-monospace,monospace; color:var(--ink-2); text-transform:none; letter-spacing:0; }
label.chk-anti{ color:var(--brick-d); }
.turn-row{ border:1px solid var(--rule); margin-bottom:8px; background:var(--paper-3); }
.turn-grid{ display:flex; align-items:center; gap:10px; padding:8px 10px; border-bottom:1px solid var(--rule-soft); }
label.mini{ display:inline-flex; align-items:center; gap:6px; font:11px ui-monospace,monospace; color:var(--ink-3); text-transform:uppercase; }
label.mini input,label.mini select{ width:auto; }
label.mini .t-turn{ width:56px; }
.t-del{ margin-left:auto; border:1px solid var(--rule); background:var(--paper-4); color:var(--brick-d); cursor:pointer; width:26px; height:26px; }
.turn-row .moves{ display:flex; flex-wrap:wrap; gap:6px 12px; padding:8px 10px; }
.btn{ font:12px ui-monospace,monospace; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink); padding:7px 12px; cursor:pointer; }
.btn.primary{ background:var(--moss-deep); color:var(--paper); border-color:var(--moss-deep); }
.addbar{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.panel{ border:1px solid var(--rule); background:var(--paper-4); }
.panel-head{ padding:7px 10px; font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); }
#validationPanel{ padding:10px; display:flex; flex-direction:column; gap:6px; }
.v-head{ font:600 13px/1.3 ui-monospace,monospace; }
.v-line{ font:12px/1.45 ui-monospace,monospace; padding:6px 8px; border-left:3px solid var(--rule); background:var(--paper-3); }
.v-ok{ color:var(--moss-deep); }
.v-conflict{ color:var(--brick-d); border-left-color:var(--brick); background:var(--brick-soft); }
.v-warn{ color:var(--ochre-d); border-left-color:var(--ochre); background:var(--ochre-soft); }
.v-serve{ color:var(--moss); border-left-color:var(--moss); background:var(--moss-soft); }
.v-line code{ background:rgba(127,127,127,.15); padding:0 3px; }
.yaml{ margin:0; padding:12px; font:12px/1.5 ui-monospace,monospace; color:var(--ink-2); white-space:pre-wrap; max-height:330px; overflow:auto; }
.writebar{ padding:12px; display:flex; flex-direction:column; gap:8px; }
.write-result{ font:12px ui-monospace,monospace; color:var(--ink-3); min-height:16px; }
.write-result code,.run-hint code{ background:rgba(127,127,127,.15); padding:0 3px; color:var(--moss-deep); }
.run-hint{ font:11px/1.5 ui-monospace,monospace; color:var(--ink-4); border-top:1px dashed var(--rule); padding-top:8px; }
.muted{ color:var(--ink-4); font-style:italic; font-size:11px; }
.fld .hint{ font:10.5px/1.4 -apple-system,system-ui,sans-serif; color:var(--ink-4); text-transform:none; letter-spacing:0; font-weight:400; }
.syl-cap{ grid-column:1 / -1; font:11.5px/1.5 -apple-system,system-ui,sans-serif; color:var(--ink-2); background:var(--paper-3); border-left:3px solid var(--moss); border-radius:0 6px 6px 0; padding:7px 11px; }
.syl-cap b{ color:var(--moss-deep); }
${MODETABS_CSS}
`,
  })}
<body>
${railHtml({
  active: 'compose',
  brand: 'drama composer',
  sub: 'assemble a drama-machine spec · validated live against the poetics ontology',
  hint: '<span><b>compose · spec mode</b> — assemble a full drama-machine spec, validated live against the ontology</span><span class="navhint__sep">·</span><span>or <a href="/compose/live">sit in on a live scene</a></span>',
})}
${modeTabsHtml('spec')}
<div class="compose">
  <form class="cform" id="cform" onsubmit="return false">
    <section class="sec"><h3>Drama · mythos / melos</h3><div class="body">
      <label class="fld">id<input type="text" id="d-id" value="D_LOG_PERIPETEIA_1"></label>
      <label class="fld">max_turns<input type="number" id="d-maxturns" min="1" value="7"></label>
      ${composeSyllabusPicker({
        courseId: 'd-course',
        lessonId: 'd-lecture',
        capId: 'd-syl-cap',
        lessonHint: 'fills the topic from this lesson · the batch spec teaches from the topic text',
      })}
      <label class="fld wide">topic<input type="text" id="d-topic" value="logarithms as the inverse of exponentiation"></label>
      <label class="fld wide">hamartia <span class="muted">— the misconception that drives the plot</span><input type="text" id="d-hamartia" placeholder="the specific wrong idea the learner keeps reaching for"></label>
      <label class="fld">continuation_policy<select id="d-cont">${composeOptions(V.continuationPolicy, 'reframe')}</select></label>
      <label class="fld">tutor_adaptation_policy<select id="d-adapt">${composeOptions(V.adaptationPolicy, 'peripeteia')}</select></label>
      <div class="fld wide"><span>targets — dramatic forms to bias toward</span><div class="checks">${composeFormChecks(['peripeteia', 'catharsis'])}</div></div>
    </div></section>
    <section class="sec"><h3>Tutor · ethos</h3><div class="body">
      <label class="fld">prompt_type<select id="t-prompt">${composeOptions(V.promptTypes, 'recognition')}</select></label>
      <label class="fld">architecture<select id="t-arch">${composeOptions(V.tutorArch, 'ego_superego')}</select></label>
      <label class="fld">superego_disposition<select id="t-superego">${composeOptions(V.superego, 'suspicious')}</select></label>
      <label class="chk" style="align-self:end"><input type="checkbox" id="t-recog" checked> recognition_mode</label>
    </div></section>
    <section class="sec"><h3>Learner · ethos</h3><div class="body">
      <label class="fld">persona<select id="l-persona">${composeOptions(V.personas, 'struggling_anxious')}</select></label>
      <label class="fld">architecture<select id="l-arch">${composeOptions(V.learnerArch, 'ego_superego_recognition_authentic')}</select></label>
      <label class="fld">superego_disposition<input type="text" id="l-superego" value="recognition_authentic"></label>
      <label class="fld wide">start_state<textarea id="l-start">wants the rule memorised before the quiz; mistrusts 'inverse' as hand-waving</textarea></label>
    </div></section>
    <div class="advnote">advanced · sensible defaults already set — open only what you want to shape</div>
    <details class="sec"><summary>Thought &amp; diction · dianoia / lexis<span class="opt">socratic · aristotelian reversal</span></summary><div class="body">
      <label class="fld">pedagogical_approach<input type="text" id="d-pedagogical" value="socratic_elenchus"></label>
      <label class="fld">dialogue_approach<input type="text" id="d-dialogue" value="aristotelian_reversal"></label>
      <label class="fld wide">voice.register<input type="text" id="v-register" value="plain; the learner a little defensive"></label>
    </div></details>
    <details class="sec"><summary>Spectacle · opsis<span class="opt">library booth · before the quiz</span></summary><div class="body">
      <label class="fld wide">scene.setting<input type="text" id="s-setting" value="a library tutoring booth, the evening before a quiz"></label>
      <label class="fld">relationship<input type="text" id="s-relationship" value="a paid tutor and a resentful teenager"></label>
      <label class="fld">stakes<input type="text" id="s-stakes" value="the quiz is tomorrow morning"></label>
      <label class="fld">opening_speaker<select id="s-open">${composeOptions(V.speakers, 'learner')}</select></label>
      <label class="fld">ending_speaker<select id="s-end">${composeOptions(V.speakers, 'learner')}</select></label>
      <label class="fld wide">object<input type="text" id="s-object" value="a half-finished worksheet with log(a+b) = log a + log b circled"></label>
      <label class="fld">stage_direction_policy<select id="s-stagepolicy">${composeOptions(V.stagePolicy, 'short')}</select></label>
      <label class="fld">stage_direction_style<select id="s-stagestyle">${composeOptions(V.stageStyle, 'object_business')}</select></label>
    </div></details>
    <details class="sec"><summary>Cast · who plays each role<span class="opt">sonnet cast · gpt critic</span></summary><div class="body">
      <label class="fld">director<input type="text" id="c-director" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">tutor<input type="text" id="c-tutor" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">learner<input type="text" id="c-learner" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">critic<input type="text" id="c-critic" list="castList" value="llm:api:gpt"></label>
      <label class="fld">default_backend<input type="text" id="c-backend" value="api"></label>
      <div class="muted" style="grid-column:1/-1">grammar: <code>human</code> · <code>llm:&lt;backend&gt;:&lt;model&gt;</code> · <code>mock</code> — backends claude · codex · gemini · api</div>
    </div></details>
    <details class="sec"><summary>Audience · critic config<span class="opt">4-judge panel · 3-of-4</span></summary><div class="body">
      <label class="fld wide">panel — comma-separated judge models<input type="text" id="a-panel" list="panelList" value="gpt, deepseek-v4-pro, qwen3.7-max, gemini-3.5-flash"></label>
      <label class="fld">consensus<input type="text" id="a-consensus" value="3-of-4"></label>
      <label class="fld">grading<select id="a-grading">${composeOptions(V.grading, 'graded')}</select></label>
      <label class="fld">blinding<select id="a-blinding">${composeOptions(V.blinding, 'arm-blind')}</select></label>
      <label class="fld">rubric<input type="text" id="a-rubric" value="poetics-v1.0"></label>
    </div></details>
    <details class="sec"><summary>Turn plan · per-turn adaptation moves<span class="opt"><span id="turnPlanCount">4 turns</span> · live-validated</span></summary><div class="body one">
      <div id="turnPlan"></div>
      <div class="addbar"><button type="button" class="btn" id="addTurn">+ add turn</button><button type="button" class="btn" id="suggestTurn" title="Sample a valid turn from the ontology, conditioned on the tutor architecture (alter-egos)">✨ suggest a turn</button><span class="muted">⚠ anti-pattern moves are checked against the turn's target form by the ontology, live.</span></div>
    </div></details>
  </form>
  <aside class="cside">
    <div class="panel"><div class="panel-head">ontology validation · live</div><div id="validationPanel"></div></div>
    <div class="panel"><div class="panel-head">spec.yaml</div><pre id="yamlPreview" class="yaml">…</pre></div>
    <div class="panel"><div class="panel-head">write</div><div class="writebar">
      <input type="text" id="filename" placeholder="filename (defaults to drama id)">
      <button type="button" class="btn primary" id="writeBtn">Write .drama.yaml</button>
      <div id="writeResult" class="write-result"></div>
      <div class="run-hint">Writes to <code>exports/drama-specs/</code>. To generate + judge it, lower per SPEC.md §7 (or invoke the <code>/ms-drama-machine</code> skill with <code>--run</code>).</div>
    </div></div>
  </aside>
</div>
${composeDatalist('castList', V.castSuggest)}
${composeDatalist('panelList', V.panelSuggest)}
<script>
const VOCAB = ${JSON.stringify(V)};
const $ = (id) => document.getElementById(id);
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var COMPOSE_COURSES = ${composeCoursesJson()};
${SYLLABUS_CLIENT_JS}
function val(id){ var e=$(id); return e ? String(e.value).trim() : ''; }
function checkedBox(id){ var e=$(id); return e ? !!e.checked : false; }
function oNone(v){ return v==='none' ? '' : v; }

var turns = [
  { turn:1, role:'director', target:'', moves:['inject_revisit_cue'] },
  { turn:3, role:'tutor', target:'peripeteia', moves:['stock_take','route_change','action_gate'] },
  { turn:3, role:'learner', target:'', moves:['perform_device'] },
  { turn:6, role:'tutor', target:'anagnorisis', moves:['recognition_press'] }
];

function movesFor(role){
  var base = (VOCAB.movesByRole[role] || []).slice();
  VOCAB.antiPatterns.forEach(function(m){ if(base.indexOf(m)<0) base.push(m); });
  return base;
}
function turnRowHtml(t){
  var roleOpts = VOCAB.roles.map(function(r){ return '<option value="'+r+'"'+(r===t.role?' selected':'')+'>'+r+'</option>'; }).join('');
  var formOpts = '<option value="">(inherit targets)</option>' + VOCAB.forms.map(function(f){ return '<option value="'+f+'"'+(f===t.target?' selected':'')+'>'+f+'</option>'; }).join('');
  var moveChecks = movesFor(t.role).map(function(m){
    var anti = VOCAB.antiPatterns.indexOf(m)>=0;
    return '<label class="chk'+(anti?' chk-anti':'')+'"><input type="checkbox" class="t-move" value="'+esc(m)+'"'+(t.moves.indexOf(m)>=0?' checked':'')+'> '+esc(m)+(anti?' ⚠':'')+'</label>';
  }).join('');
  return '<div class="turn-row">'
    + '<div class="turn-grid">'
    + '<label class="mini">turn <input type="number" min="1" class="t-turn" value="'+esc(t.turn)+'"></label>'
    + '<label class="mini">role <select class="t-role">'+roleOpts+'</select></label>'
    + '<label class="mini">target <select class="t-target">'+formOpts+'</select></label>'
    + '<button type="button" class="t-del" title="remove turn">✕</button>'
    + '</div>'
    + '<div class="moves">'+moveChecks+'</div>'
    + '</div>';
}
function renderTurns(){ $('turnPlan').innerHTML = turns.length ? turns.map(turnRowHtml).join('') : '<div class="muted">No turns. Add one.</div>'; var c=$('turnPlanCount'); if(c) c.textContent = turns.length + ' turn' + (turns.length===1?'':'s'); }
function readTurnsFromDom(){
  var next = [];
  document.querySelectorAll('#turnPlan .turn-row').forEach(function(row){
    next.push({
      turn: Number(row.querySelector('.t-turn').value) || 1,
      role: row.querySelector('.t-role').value,
      target: row.querySelector('.t-target').value,
      moves: Array.prototype.slice.call(row.querySelectorAll('.t-move:checked')).map(function(c){ return c.value; })
    });
  });
  turns = next;
}
function rowIndex(row){ return Array.prototype.indexOf.call(row.parentNode.children, row); }

function readSpec(){
  readTurnsFromDom();
  var targets = Array.prototype.slice.call(document.querySelectorAll('.f-target:checked')).map(function(c){ return c.value; });
  var drama = {
    id: val('d-id'),
    targets: targets,
    topic: val('d-topic'),
    hamartia: val('d-hamartia'),
    continuation_policy: oNone(val('d-cont')),
    tutor_adaptation_policy: oNone(val('d-adapt')),
    tutor: { prompt_type: val('t-prompt'), architecture: val('t-arch'), superego_disposition: val('t-superego'), recognition_mode: checkedBox('t-recog') || '' },
    learner: { persona: val('l-persona'), architecture: val('l-arch'), superego_disposition: val('l-superego'), start_state: val('l-start') },
    pedagogical_approach: val('d-pedagogical'),
    dialogue_approach: val('d-dialogue'),
    voice: { register: val('v-register') },
    scene: { setting: val('s-setting'), relationship: val('s-relationship'), stakes: val('s-stakes'), opening_speaker: val('s-open'), ending_speaker: val('s-end'), object: val('s-object'), stage_direction_policy: val('s-stagepolicy'), stage_direction_style: val('s-stagestyle') },
    max_turns: Number(val('d-maxturns')) || ''
  };
  var cast = { director: val('c-director'), tutor: val('c-tutor'), learner: val('c-learner'), critic: val('c-critic'), default_backend: val('c-backend') };
  var audience = { panel: val('a-panel').split(',').map(function(s){ return s.trim(); }).filter(Boolean), consensus: val('a-consensus'), grading: val('a-grading'), blinding: val('a-blinding'), rubric: val('a-rubric') };
  var turn_plan = turns.map(function(t){ var e = { at: { turn: t.turn }, role: t.role, moves: t.moves }; if (t.target) e.target = t.target; return e; });
  return { drama: drama, cast: cast, audience: audience, turn_plan: turn_plan };
}

async function postJson(url, body){
  var res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  var data = {};
  try { data = await res.json(); } catch (_e) {}
  if (!res.ok){ var err = new Error(data.error || res.statusText); Object.assign(err, data); throw err; }
  return data;
}

var vTimer = null;
function scheduleValidate(){ clearTimeout(vTimer); vTimer = setTimeout(validate, 280); }
function fmtTurn(x){ return (x.turn!=null ? ('turn '+x.turn) : 'turn') + (x.role ? (' · '+x.role) : ''); }
function codes(list){ return list.map(function(m){ return '<code>'+esc(m)+'</code>'; }).join(', '); }
function renderValidation(v){
  var html = '';
  if (v.ok) html += '<div class="v-head v-ok">✓ no form conflicts · '+v.turns+' turn'+(v.turns===1?'':'s')+'</div>';
  else html += '<div class="v-head v-conflict">✕ '+v.conflicts.length+' form conflict'+(v.conflicts.length===1?'':'s')+'</div>';
  v.conflicts.forEach(function(c){ html += '<div class="v-line v-conflict"><b>'+esc(fmtTurn(c))+'</b> targets <b>'+esc(c.form)+'</b> but includes '+codes(c.moves)+' — contraindicates it</div>'; });
  v.warnings.forEach(function(w){ html += '<div class="v-line v-warn"><b>'+esc(fmtTurn(w))+'</b> '+esc(w.message)+'</div>'; });
  v.serves.forEach(function(s){ html += '<div class="v-line v-serve"><b>'+esc(fmtTurn(s))+'</b> '+codes(s.moves)+' → serves <b>'+esc(s.form)+'</b></div>'; });
  $('validationPanel').innerHTML = html || '<div class="muted">no turns to validate</div>';
}
async function validate(){
  var spec = readSpec();
  try {
    var r = await postJson('/api/compose/validate', { spec: spec });
    renderValidation(r.validation);
    $('yamlPreview').textContent = r.yaml;
  } catch (e) {
    $('validationPanel').innerHTML = '<div class="v-line v-conflict">validation error: '+esc(e.message)+'</div>';
  }
}
async function write(force){
  var spec = readSpec();
  try {
    var r = await postJson('/api/compose/write', { spec: spec, filename: val('filename'), force: !!force });
    $('writeResult').innerHTML = 'wrote <code>'+esc(r.path)+'</code> · '+r.bytes+' bytes';
    if (r.validation) renderValidation(r.validation);
  } catch (e) {
    if (e.needsForce){
      var n = e.validation ? e.validation.conflicts.length : '?';
      if (window.confirm('turn_plan has '+n+' form conflict(s). Write the spec anyway?')) return write(true);
      $('writeResult').textContent = 'not written — resolve conflicts or confirm';
    } else { $('writeResult').textContent = 'error: '+esc(e.message); }
  }
}

// turn-plan delegation (survives innerHTML re-renders — bound on the container)
$('turnPlan').addEventListener('change', function(e){
  var row = e.target.closest('.turn-row'); if(!row) return;
  readTurnsFromDom();
  if (e.target.classList.contains('t-role')){
    var i = rowIndex(row); var allowed = movesFor(turns[i].role);
    turns[i].moves = turns[i].moves.filter(function(m){ return allowed.indexOf(m)>=0; });
    renderTurns();
  }
  scheduleValidate();
});
$('turnPlan').addEventListener('input', function(e){ if (e.target.classList.contains('t-turn')){ readTurnsFromDom(); scheduleValidate(); } });
$('turnPlan').addEventListener('click', function(e){
  if (!e.target.classList.contains('t-del')) return;
  readTurnsFromDom(); turns.splice(rowIndex(e.target.closest('.turn-row')), 1); renderTurns(); scheduleValidate();
});
$('addTurn').addEventListener('click', function(){ readTurnsFromDom(); turns.push({ turn: turns.length ? turns[turns.length-1].turn : 1, role:'tutor', target:'', moves:[] }); renderTurns(); scheduleValidate(); });
$('suggestTurn').addEventListener('click', async function(){
  readTurnsFromDom();
  var targets = Array.prototype.slice.call(document.querySelectorAll('.f-target:checked')).map(function(c){ return c.value; });
  try {
    var r = await postJson('/api/compose/suggest', { targets: targets, role: 'tutor', architecture: val('t-arch'), seed: 'suggest-' + turns.length + '-' + Date.now() });
    if (r && r.turn) { turns.push(r.turn); renderTurns(); scheduleValidate(); }
  } catch (e) { /* sampler unavailable; leave the plan unchanged */ }
});
$('writeBtn').addEventListener('click', function(){ write(false); });
document.addEventListener('change', function(e){ if (e.target.closest('#cform') && !e.target.closest('#turnPlan')) scheduleValidate(); });
document.addEventListener('input', function(e){ if (e.target.closest('#cform') && !e.target.closest('#turnPlan')) scheduleValidate(); });
$('themeToggle').addEventListener('click', function(){
  var d = document.documentElement; var nx = d.getAttribute('data-theme')==='dark' ? '' : 'dark';
  if (nx) d.setAttribute('data-theme','dark'); else d.removeAttribute('data-theme');
  try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
});
try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
// The syllabus picker is a topic-seeding aid here: the batch pipeline teaches
// from drama.topic (it has no lecture-binding), so picking a lesson fills the
// topic + retargets the hamartia placeholder, then re-validates. d-lecture is
// deliberately NOT read by readSpec — it would be a dead key in the .drama.yaml.
// We also re-derive the scene id from the lesson so it never reads stale (the
// shipped "D_LOG_PERIPETEIA_1" makes no sense once a non-logs lesson is chosen),
// but only while the id is still the auto value — a user-typed id is left alone.
var autoId = 'D_LOG_PERIPETEIA_1';
function topicToId(t){
  var s = String(t).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40).replace(/_+$/,'');
  return 'D_' + (s || 'SCENE') + '_1';
}
var SYL = mkSyllabus(COMPOSE_COURSES, $('d-course'), $('d-lecture'), $('d-syl-cap'), function(opt){
  var t = opt && opt.getAttribute && opt.getAttribute('data-topic');
  if(t){
    $('d-topic').value = t;
    if($('d-id').value === autoId){ autoId = topicToId(t); $('d-id').value = autoId; }
  }
  $('d-hamartia').placeholder = t
    ? ('the misreading a learner keeps bringing to “'+t+'”')
    : 'the specific wrong idea the learner keeps reaching for';
  scheduleValidate();
});
void SYL;
renderTurns();
validate();
</script>
</body>
</html>`;
}

// ── Compose mode tabs (shared between Spec + Live) ────────────────────────────
// Two ways to compose: Spec (batch — write a full .drama.yaml) and Live (sit-in —
// play one seat in real time). One markup+CSS source so the two pages can't drift.
function modeTabsHtml(active) {
  const tab = (key, href, label, hint) =>
    `<a class="modetab${key === active ? ' on' : ''}" href="${href}"${
      key === active ? ' aria-current="page"' : ''
    } title="${hint}">${label}</a>`;
  // Live (sit-in) is the more obvious entry point, so it leads; Spec (batch) follows.
  return `<nav class="modetabs" aria-label="compose mode">
    ${tab('live', '/compose/live', '● Live · sit-in', 'Sit in: you play one seat, the AI plays the other, turn by turn')}
    ${tab('spec', '/compose', '◐ Spec · batch', 'Assemble a full drama spec and write it as YAML for batch generation')}
  </nav>`;
}
const MODETABS_CSS = `.modetabs{ display:flex; gap:3px; padding:9px 18px 0; background:var(--paper-3); border-bottom:1px solid var(--rule); }
.modetab{ font:12px ui-monospace,monospace; text-decoration:none; color:var(--ink-3); padding:7px 14px; border:1px solid var(--rule); border-bottom:none; background:var(--paper-2); border-radius:7px 7px 0 0; }
.modetab:hover{ color:var(--ink); }
.modetab.on{ color:var(--moss-deep); background:var(--paper-4); font-weight:600; position:relative; top:1px; }`;

// ── Live "sit-in" compose (GET /compose/live) ─────────────────────────────────
// A real-time chat where the human takes one chair (tutor or learner) and the AI
// takes the other, driven by the SAME turn engines the scored runs use (so the
// sit-in can't drift from them). METERED: each AI turn is a real LLM call unless
// "free preview" (mock deps) is on. Server engine: services/poetics/liveCompose.js.
function renderComposeLiveHtml() {
  const V = COMPOSER_VOCAB;
  return `${pageHead({
    title: 'Live Compose · poetics',
    css: `
code{ font-family: ui-monospace,'SF Mono',Menlo,monospace; background:rgba(127,127,127,.15); padding:0 3px; border-radius:3px; }
kbd{ font:11px ui-monospace,monospace; background:var(--paper-2); border:1px solid var(--rule); border-bottom-width:2px; border-radius:4px; padding:1px 5px; color:var(--ink-2); }
${MODETABS_CSS}
.live{ display:grid; grid-template-columns: minmax(0,1fr) 270px; align-items:start; max-width:1180px; margin:0 auto; }
/* setup state: the live rail (#liveside) and any reading are still hidden, so collapse to
   one centered column — otherwise the setup card sits against an empty 270px rail. */
.live:not(.live--reading):has(#liveside[hidden]){ grid-template-columns:minmax(0,1fr); max-width:760px; }
@media (max-width:900px){ .live{ grid-template-columns:1fr; } }
/* when a reading is bound, the lecture becomes a third co-equal column to the LEFT of the
   chat (reading · chat · meta-rail) so the source text and the conversation share prominence. */
.live--reading{ grid-template-columns: minmax(300px,0.92fr) minmax(360px,1fr) 244px; max-width:1420px; }
@media (max-width:1080px){
  .live--reading{ grid-template-columns:1fr; max-width:780px; }
  .live--reading .stage{ order:1; }
  .live--reading .readpane{ order:2; position:static; max-height:58vh; border-right:0; border-top:1px solid var(--rule); }
  .live--reading .liveside{ order:3; }
}
.stage{ display:flex; flex-direction:column; min-height:calc(100vh - 95px); padding:18px 20px; }
/* setup card */
.setup{ border:1px solid var(--rule); background:var(--paper-4); padding:18px; display:flex; flex-direction:column; gap:16px; }
.setup--min{ display:none; }
.setup__head h2{ margin:0 0 4px; font:600 19px/1.2 Georgia,serif; color:var(--moss-deep); }
.setup__lede{ margin:0; color:var(--ink-3); font-size:13px; max-width:62ch; }
.seatpick{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media (max-width:560px){ .seatpick{ grid-template-columns:1fr; } }
.seat{ text-align:left; border:1px solid var(--rule); background:var(--paper-3); padding:13px 15px; cursor:pointer; display:flex; flex-direction:column; gap:2px; border-radius:8px; transition:border-color .12s,background .12s; }
.seat:hover{ border-color:var(--moss); }
.seat--on{ border-color:var(--moss-deep); background:var(--moss-soft); box-shadow:inset 3px 0 0 var(--moss-deep); }
.seat__k{ font:10px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-4); }
.seat__v{ font:600 17px/1.1 Georgia,serif; color:var(--ink); }
.seat__d{ font-size:11.5px; color:var(--ink-3); margin-top:3px; }
.setgrid{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:11px 14px; }
.grp{ display:contents; }
/* an author display:contents would otherwise beat the UA [hidden] rule, so the
   seat toggle could never hide the opposite role's dials — pin it explicitly. */
.grp[hidden]{ display:none; }
/* syllabus caption — names the chosen course (+ subtitle) and lesson */
.syl-cap{ grid-column:1 / -1; font:11.5px/1.5 -apple-system,system-ui,sans-serif; color:var(--ink-2); background:var(--paper-3); border-left:3px solid var(--moss); border-radius:0 6px 6px 0; padding:7px 11px; }
.syl-cap b{ color:var(--moss-deep); }
label.fld{ display:flex; flex-direction:column; gap:4px; font:11px ui-monospace,monospace; color:var(--ink-3); text-transform:uppercase; letter-spacing:.04em; }
label.fld.wide{ grid-column:1 / -1; }
input[type=text],input[type=number],select{ width:100%; font:13px ui-monospace,monospace; color:var(--ink); background:var(--paper); border:1px solid var(--rule); padding:6px 8px; border-radius:5px; }
.dry{ display:inline-flex; align-items:center; gap:7px; font:12px ui-monospace,monospace; color:var(--ink-2); cursor:pointer; }
.setup__go{ display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.btn{ font:12px ui-monospace,monospace; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink); padding:8px 14px; cursor:pointer; border-radius:6px; }
.btn:disabled{ opacity:.5; cursor:default; }
.btn.primary{ background:var(--moss-deep); color:var(--paper); border-color:var(--moss-deep); font-weight:600; }
.metered{ font:11px ui-monospace,monospace; color:var(--brick-d); }
.metered--free{ color:var(--moss); }
.err{ color:var(--brick-d); font:12px ui-monospace,monospace; min-height:15px; }
/* transcript */
.transcript{ flex:1; display:flex; flex-direction:column; gap:13px; padding:6px 2px 16px; overflow-y:auto; }
.t-empty{ color:var(--ink-4); font-style:italic; text-align:center; padding:40px 0; }
.line{ display:flex; flex-direction:column; gap:3px; max-width:78%; }
.line--tutor{ align-self:flex-start; align-items:flex-start; }
.line--learner{ align-self:flex-end; align-items:flex-end; }
.who{ font:10px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-4); padding:0 4px; }
.bubble{ padding:9px 13px; border-radius:13px; font-size:13.5px; line-height:1.5; border:1px solid var(--rule); white-space:normal; }
.line--tutor .bubble{ background:var(--moss-soft); border-color:var(--moss); border-bottom-left-radius:4px; }
.line--learner .bubble{ background:var(--ochre-soft); border-color:var(--ochre); border-bottom-right-radius:4px; }
.line--mine .bubble{ box-shadow:0 1px 0 rgba(0,0,0,.05); outline:2px solid var(--ink); outline-offset:-2px; }
.line--ghost .bubble{ opacity:.7; }
.bubble strong{ font-weight:650; color:var(--ink); }
.bubble em{ font-style:italic; }
.bubble code{ font-size:.9em; background:color-mix(in srgb, var(--ink) 8%, transparent); border:1px solid var(--rule-soft); border-radius:4px; padding:.04em .35em; }
.composing{ font-style:italic; color:var(--ink-3); }
.dots{ display:inline-flex; gap:4px; align-items:center; height:18px; }
.dots i{ width:6px; height:6px; border-radius:50%; background:var(--ink-3); animation:blink 1.2s infinite ease-in-out; }
.dots i:nth-child(2){ animation-delay:.2s; } .dots i:nth-child(3){ animation-delay:.4s; }
@keyframes blink{ 0%,80%,100%{ opacity:.25; } 40%{ opacity:1; } }
/* composer */
.composer{ position:sticky; bottom:0; background:var(--paper); border-top:1px solid var(--rule); padding:12px 2px 10px; }
.composer__row{ display:flex; gap:9px; align-items:flex-end; }
.composer textarea{ flex:1; font:14px/1.5 -apple-system,system-ui,sans-serif; color:var(--ink); background:var(--paper-4); border:1px solid var(--rule); border-radius:9px; padding:9px 12px; min-height:2.6rem; max-height:180px; resize:none; overflow-y:auto; }
.composer textarea:disabled{ opacity:.55; }
.composer__hint{ font:11px ui-monospace,monospace; color:var(--ink-4); padding:6px 4px 0; }
/* Both panes carry display:flex, which beats the UA [hidden]{display:none} rule —
   so in the setup state they'd stay laid out and steal grid tracks (the empty reading
   pane was filling the wide column and squeezing the setup form). Pin hidden explicitly,
   same fix as .grp[hidden] above. They reveal via showReading()/.live--reading. */
.liveside[hidden], .readpane[hidden]{ display:none; }
/* side rail */
.liveside{ position:sticky; top:95px; padding:18px 16px; display:flex; flex-direction:column; gap:13px; border-left:1px solid var(--rule); background:var(--paper-3); min-height:calc(100vh - 95px); }
.lpanel{ border:1px solid var(--rule); background:var(--paper-4); border-radius:7px; overflow:hidden; }
.lpanel__h{ padding:7px 11px; font:600 10px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.07em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); }
.lpanel__b{ padding:11px; font:12px/1.5 ui-monospace,monospace; color:var(--ink-2); }
.lpanel__b--col{ display:flex; flex-direction:column; gap:8px; }
.spend{ display:flex; flex-direction:column; gap:2px; }
.spend__usd{ font:600 22px/1 Georgia,serif; color:var(--moss-deep); }
.spend__sub{ font:11px ui-monospace,monospace; color:var(--ink-4); }
.saveres{ font:11px ui-monospace,monospace; color:var(--ink-3); min-height:14px; }
.muted{ color:var(--ink-4); font-style:italic; }
/* the reading — a co-equal pane beside the chat: the lecture the AI tutor was grounded in,
   so the human learner reads the same source. Full-height sticky column, scrolls on its own. */
.readpane{ position:sticky; top:95px; max-height:calc(100vh - 95px); display:flex; flex-direction:column; background:var(--paper-3); border-right:1px solid var(--rule); }
.readpane__h{ flex:none; display:flex; align-items:baseline; gap:10px; padding:13px 18px 11px; background:var(--paper-2); border-bottom:1px solid var(--rule); }
.readpane__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--moss-deep); }
.readpane__meta{ margin-left:auto; text-align:right; font:11px/1.4 ui-monospace,monospace; color:var(--ink-4); }
.readpane__b{ flex:1; min-height:0; overflow-y:auto; padding:17px 19px 24px; font-family:"Source Serif 4","Source Serif Pro",Cambria,Georgia,serif; font-size:14.5px; line-height:1.66; color:var(--ink-2); }
.readpane__b > :first-child{ margin-top:0; }
.readpane__b > :last-child{ margin-bottom:0; }
.readpane__b h4{ margin:18px 0 7px; font:600 17px/1.25 Georgia,serif; color:var(--ink); }
.readpane__b h5{ margin:15px 0 5px; font:600 14.5px/1.25 Georgia,serif; color:var(--ink); }
.readpane__b h6{ margin:14px 0 5px; font:600 11px/1.2 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3); }
.readpane__b p{ margin:0 0 11px; }
.readpane__b ul,.readpane__b ol{ margin:0 0 11px; padding-left:22px; }
.readpane__b li{ margin:0 0 4px; }
.readpane__b blockquote{ margin:0 0 11px; padding:3px 0 3px 13px; border-left:3px solid var(--moss); color:var(--ink-3); font-style:italic; }
.readpane__b hr{ border:0; border-top:1px solid var(--rule); margin:15px 0; }
.readpane__b code{ font:0.88em ui-monospace,monospace; background:color-mix(in srgb, var(--ink) 8%, transparent); border:1px solid var(--rule-soft); border-radius:4px; padding:.04em .35em; }
.readpane__b pre{ margin:0 0 11px; padding:10px 12px; background:var(--paper-2); border:1px solid var(--rule); border-radius:6px; overflow-x:auto; }
.readpane__b pre code{ background:none; border:0; padding:0; font-size:12px; line-height:1.5; }
.readpane__empty{ margin:auto; padding:30px 22px; text-align:center; color:var(--ink-4); font-style:italic; }
/* guide hero — describe it in plain language, the LLM dials it in */
.guide{ border:1px solid var(--rule); border-left:3px solid var(--moss); background:var(--paper-4); border-radius:11px; padding:17px 19px; display:flex; flex-direction:column; gap:12px; }
.guide__head h2{ margin:0 0 5px; font:600 21px/1.15 Georgia,serif; color:var(--moss-deep); }
.guide__head h2 .spark{ font-style:normal; }
.guide__lede{ margin:0; color:var(--ink-2); font-size:13.5px; line-height:1.5; max-width:66ch; }
.guide__row textarea{ width:100%; font:14.5px/1.55 -apple-system,system-ui,sans-serif; color:var(--ink); background:var(--paper); border:1px solid var(--rule); border-radius:9px; padding:11px 13px; min-height:3.6rem; max-height:220px; resize:vertical; }
.guide__row textarea:focus{ outline:2px solid var(--moss); outline-offset:-1px; }
.guide__go{ display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
.guide__out{ font-size:13px; line-height:1.6; color:var(--ink-2); border-left:3px solid var(--moss-deep); background:var(--paper-4); padding:9px 13px; border-radius:0 7px 7px 0; }
.guide__out b{ color:var(--moss-deep); }
.guide__out.err{ border-left-color:var(--brick); color:var(--brick-d); }
/* "or" divider between the guided path and the manual dials */
.setup__or{ display:flex; align-items:center; gap:13px; color:var(--ink-4); font:10.5px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.09em; margin:2px 0; }
.setup__or::before, .setup__or::after{ content:''; flex:1; height:1px; background:var(--rule); }
/* progressive disclosure — the eight expert dials, collapsed by default */
details.adv{ border:1px solid var(--rule); border-radius:8px; background:var(--paper-3); }
details.adv > summary{ cursor:pointer; padding:11px 14px; font:12px ui-monospace,monospace; color:var(--ink-2); list-style:none; display:flex; align-items:center; gap:10px; user-select:none; }
details.adv > summary::-webkit-details-marker{ display:none; }
details.adv > summary::before{ content:'▸'; color:var(--ink-4); transition:transform .12s; }
details.adv[open] > summary::before{ transform:rotate(90deg); }
details.adv > summary:hover{ color:var(--ink); }
.adv__hint{ color:var(--ink-4); font-size:11px; }
details.adv > .setgrid{ padding:2px 14px 15px; }
/* per-field plain-language hint under a dial */
.fld .hint{ font:10.5px/1.4 -apple-system,system-ui,sans-serif; color:var(--ink-4); text-transform:none; letter-spacing:0; font-weight:400; }
/* per-message meta row (time · gen latency · tokens) — always available on the
   wire, shown only when the "message details" view toggle is on */
.meta{ font:10px ui-monospace,monospace; color:var(--ink-4); padding:1px 5px 0; }
.line--learner .meta{ text-align:right; }
/* the AI's thinking clock — a live elapsed counter so a slow turn reads as
   progress, not dead air */
.thinkclock{ font:10px ui-monospace,monospace; color:var(--ink-3); margin-left:6px; }
/* opt-in deliberation console under an AI bubble (ego/superego steps) */
.delib{ margin:3px 4px 0; border:1px solid var(--rule); border-radius:7px; background:var(--paper-2); max-width:100%; }
.delib > summary{ cursor:pointer; padding:5px 9px; font:9.5px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-3); list-style:none; }
.delib > summary::-webkit-details-marker{ display:none; }
.delib > summary::before{ content:'▸ '; }
.delib[open] > summary::before{ content:'▾ '; }
.delib__step{ border-top:1px solid var(--rule); padding:7px 10px; }
.delib__h{ font:10px ui-monospace,monospace; color:var(--moss-deep); margin-bottom:3px; }
.delib__h code{ font-size:9.5px; }
.delib__c{ font:12px/1.5 -apple-system,system-ui,sans-serif; color:var(--ink-2); white-space:normal; }
.caveat{ font:11px/1.45 -apple-system,system-ui,sans-serif; color:var(--brick-d); }
.spend__note{ font:10.5px/1.45 -apple-system,system-ui,sans-serif; color:var(--ink-4); margin-top:7px; padding-top:7px; border-top:1px dotted var(--rule); }
.spend__note code{ font-size:10px; }
/* end & score the scene at any point — terminate early, then read the dramatic
   form of the transcript-so-far against the poetics rubric */
.endrow{ display:flex; gap:8px; }
.endrow .btn{ flex:1; }
.scoreres{ font:11px/1.5 ui-monospace,monospace; color:var(--ink-3); min-height:14px; }
.score__overall{ font:600 22px/1 Georgia,serif; color:var(--moss-deep); }
.score__headline{ font:11px/1.45 -apple-system,system-ui,sans-serif; color:var(--ink-2); font-style:italic; margin:4px 0 8px; }
.score__dim{ display:grid; grid-template-columns:1fr auto; gap:1px 8px; padding:5px 0; border-top:1px solid var(--rule); }
.score__dname{ font:10.5px ui-monospace,monospace; color:var(--ink-2); }
.score__dval{ font:10.5px ui-monospace,monospace; color:var(--moss-deep); text-align:right; }
.score__dwhy{ grid-column:1/3; font:10.5px/1.4 -apple-system,system-ui,sans-serif; color:var(--ink-4); }
`,
  })}
<body>
${railHtml({
  active: 'compose',
  brand: 'live compose',
  sub: 'sit in · you play one seat, the AI plays the other, turn by turn',
  hint: '<span><b>compose a scene</b> — sit in and play one seat of a live tutoring scene, or switch to batch-spec mode</span><span class="navhint__sep">·</span><span>then <a href="/runs">launch a run</a> to generate at scale, or read finished ones in <a href="/browse">scripts</a></span>',
})}
${modeTabsHtml('live')}
<div class="live" id="liveGrid">

  <aside class="readpane" id="readingPane" hidden>
    <div class="readpane__h"><span class="readpane__k">the reading</span><span class="readpane__meta" id="readingMeta"></span></div>
    <div class="readpane__b" id="readingBody"></div>
  </aside>

  <main class="stage">
    <section class="setup" id="setup">
      <!-- Guided path: describe it in plain language, the LLM dials the machine in -->
      <div class="guide">
        <div class="guide__head">
          <h2><span class="spark">✦</span> Compose a scene</h2>
          <p class="guide__lede">Say what you want to explore in plain language — who you'd like to play, what's being taught, what should go wrong — and the guide sets the machine up for you. Everything it picks lands in the dials below, ready to tweak. No vocabulary required.</p>
        </div>
        <div class="guide__row">
          <textarea id="g-desc" rows="2" placeholder="e.g. I want to play a nervous student who keeps splitting log(a+b) into log a + log b, and have the AI tutor push me toward a real click of understanding."></textarea>
        </div>
        <div class="guide__go">
          <button type="button" class="btn primary" id="guideBtn">Compose it for me →</button>
          <label class="dry"><input type="checkbox" id="f-mock"> free preview — canned AI, no spend</label>
        </div>
        <div class="guide__out" id="guideOut" hidden></div>
      </div>

      <div class="setup__or"><span>or set the dials yourself</span></div>

      <!-- Seat: the one choice everyone makes -->
      <div class="seatpick">
        <button type="button" class="seat seat--on" id="seatLearner">
          <span class="seat__k">I play the</span><span class="seat__v">Learner</span>
          <span class="seat__d">the AI is the tutor — probe how it teaches under pressure</span>
        </button>
        <button type="button" class="seat" id="seatTutor">
          <span class="seat__k">I play the</span><span class="seat__v">Tutor</span>
          <span class="seat__d">the AI is the learner — stage a recognition, test a persona</span>
        </button>
      </div>

      <!-- Essentials: plain-language, always visible. The syllabus picker is
           tutor-only (a lecture grounds the AI tutor; it has no meaning when the
           AI plays the learner) — pickSeat() toggles #sylBox with the seat. -->
      <div class="setgrid">
        <div class="grp" id="sylBox">${composeSyllabusPicker({
          courseId: 'f-course',
          lessonId: 'f-lecture',
          capId: 'f-syl-cap',
          lessonHint: 'ground the AI tutor in a real lesson — sets the topic too',
        })}</div>
        <label class="fld wide">topic<input id="f-topic" type="text" placeholder="pick a lesson above, or type what the scene is about"><span class="hint">what the scene is about — auto-filled when you choose a lesson</span></label>
        <label class="fld wide">hamartia <span class="muted">(optional)</span><input id="f-hamartia" type="text" placeholder="the specific wrong idea the learner keeps reaching for"><span class="hint">the tragic flaw the scene turns on — leave blank, type your own, or let the guide suggest one</span></label>
      </div>

      <!-- Expert dials: collapsed by default so newcomers needn't read them -->
      <details class="adv" id="advBox">
        <summary>Fine-tune the machine <span class="adv__hint">stance · deliberation · persona · tempo</span></summary>
        <div class="setgrid">
          <div class="grp" id="grpTutor">
            <label class="fld">AI tutor · stance<select id="f-prompt">${composeOptionsPretty(
              ['recognition', 'base'],
              'recognition',
            )}</select><span class="hint">recognition aims for a genuine click of understanding · base is plain, competent teaching</span></label>
            <label class="fld">AI tutor · deliberation<select id="f-tarch">${composeOptionsPretty(
              ['ego_superego', 'ego_only'],
              'ego_superego',
            )}</select><span class="hint">ego only answers in one pass · ego superego drafts, self-critiques, then revises</span></label>
            <label class="fld wide"><span class="dry" style="text-transform:none;letter-spacing:0;"><input type="checkbox" id="f-concise" checked> concise replies</span><span class="hint">keep each AI-tutor turn short and to one question — faster and cheaper. Off restores the full instrument behavior (longer, multi-question turns).</span></label>
          </div>
          <div class="grp" id="grpLearner" hidden>
            <label class="fld">AI learner · persona<select id="f-persona">${composeOptionsPretty(
              V.personas,
              'struggling_anxious',
            )}</select><span class="hint">the kind of student the AI plays</span></label>
            <label class="fld">AI learner · deliberation<select id="f-larch">${composeOptionsPretty(
              V.learnerArch,
              'ego_superego_recognition_authentic',
            )}</select><span class="hint">how much inner back-and-forth the AI learner does before it speaks</span></label>
            <label class="fld">AI learner · model<select id="f-lmodel">${composeLearnerModelOptions()}</select><span class="hint">the default is a reasoning model that occasionally returns a blank turn — pick a plain-completion model if a learner line comes back empty</span></label>
          </div>
          <label class="fld">opening speaker<select id="f-open">${composeOptionsPretty(
            ['tutor', 'learner'],
            'tutor',
          )}</select><span class="hint">who moves first</span></label>
          <label class="fld">max turns<input id="f-max" type="number" min="2" max="40" value="16"><span class="hint">scene length cap</span></label>
        </div>
      </details>

      <div class="setup__go">
        <button type="button" class="btn primary" id="beginBtn">Begin the scene →</button>
        <span class="metered" id="meterNote">metered · real LLM calls per AI turn · localhost only</span>
      </div>
      <div class="err" id="setupErr"></div>
    </section>

    <div class="transcript" id="transcript" hidden></div>

    <form class="composer" id="composerForm" hidden onsubmit="return false">
      <div class="composer__row">
        <textarea id="composerInput" rows="1" placeholder="your line…"></textarea>
        <button type="button" class="btn primary" id="sendBtn">send</button>
      </div>
      <div class="composer__hint" id="composerHint"></div>
    </form>
  </main>

  <aside class="liveside" id="liveside" hidden>
    <div class="lpanel"><div class="lpanel__h">scene</div><div class="lpanel__b" id="sceneMeta"></div></div>
    <div class="lpanel"><div class="lpanel__h">spend</div><div class="lpanel__b"><div class="spend"><span class="spend__usd" id="spendUsd">$0.0000</span><span class="spend__sub" id="spendTok">0 tokens</span></div>
      <div class="spend__note">A flat estimate: <code>(input + output tokens) ÷ 1000 × $0.01</code>, summed over every AI turn. It is a deliberately high, single-rate ceiling — not per-model billing or input-vs-output pricing — so the real OpenRouter cost is at or below this.</div>
    </div></div>
    <div class="lpanel"><div class="lpanel__h">view</div><div class="lpanel__b lpanel__b--col">
      <label class="dry"><input type="checkbox" id="optMeta"> message details <span class="muted">— time · gen · tokens</span></label>
      <label class="dry"><input type="checkbox" id="optDelib"> AI deliberation <span class="muted">— ego / superego</span></label>
      <div class="caveat" id="delibCaveat" hidden>You're the tutor — this exposes the AI learner's private reasoning. The instrument is meant to read recognition only from the surface, so treat this as inspection/debugging, not part of the scene.</div>
    </div></div>
    <div class="lpanel"><div class="lpanel__h">end &amp; score</div><div class="lpanel__b lpanel__b--col">
      <div class="endrow"><button type="button" class="btn" id="endBtn">End scene</button><button type="button" class="btn" id="scoreBtn">Score scene</button></div>
      <span class="hint" id="scoreHint">end the scene whenever you like; scoring reads the transcript-so-far for dramatic form (one critic call unless free preview)</span>
      <div class="scoreres" id="scoreRes"></div>
    </div></div>
    <div class="lpanel"><div class="lpanel__h">save transcript</div><div class="lpanel__b lpanel__b--col">
      <input id="saveName" type="text" placeholder="filename (auto-named if blank)">
      <button type="button" class="btn" id="saveBtn">Save to exports/</button>
      <div class="saveres" id="saveRes"></div>
    </div></div>
    <div class="lpanel"><div class="lpanel__h">what is this</div><div class="lpanel__b"><span class="muted">Hand-probing the instrument. Human-as-learner tests how the tutor teaches; human-as-tutor lets you stage a recognition to test judge-gullibility (paper §D6).</span></div></div>
  </aside>
</div>
<script>
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function nl2br(s){ return esc(s).replace(/\\n/g, '<br>'); }
// Tutor + learner turns arrive as markdown (the models emphasise terms with *italic*
// / **bold** and cite refs in \`code\`). Render a safe inline subset so the bubble
// reads as prose, not raw syntax. esc() runs FIRST (text is untrusted model output),
// then we split on backticks so code spans are verbatim and emphasis never reaches
// inside them; only **/* asterisk emphasis is supported (underscore emphasis is
// skipped so snake_case ids like cell_7_recog survive untouched).
function mdEmph(t){ return t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>').replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>'); }
function mdInline(s){ var parts = esc(s).split('\`'); var out = ''; for (var i = 0; i < parts.length; i++){ out += (i % 2 === 1) ? ('<code>' + parts[i] + '</code>') : mdEmph(parts[i]); } return out.replace(/\\n/g, '<br>'); }
var S = { id:null, mock:false, humanRole:'learner', aiRole:'tutor', status:'idle', nextSpeaker:null,
  showMeta:false, showDelib:false, lastSession:null, namePrefilled:false, timer:null, tStart:0, readingRef:null };

// View prefs persist across reloads (purely client-side display toggles).
function getPref(k, dflt){ try { var v=localStorage.getItem(k); return v==null?dflt:(v==='1'); } catch(_e){ return dflt; } }
function setPref(k, on){ try { localStorage.setItem(k, on?'1':'0'); } catch(_e){} }

// Per-message meta is always on the wire (it isn't the AI's private interior), so
// these are pure display formatters; the toggle just shows/hides the row.
function fmtClock(ms){ if(!ms) return ''; try { return new Date(ms).toLocaleTimeString(); } catch(_e){ return ''; } }
function fmtDur(ms){ if(ms==null) return ''; return ms<1000 ? (ms+'ms') : ((ms/1000).toFixed(1)+'s'); }
function turnMetaHtml(t){
  if(!S.showMeta) return '';
  var bits=[];
  if(t.at) bits.push('sent '+esc(fmtClock(t.at)));
  if(t.by==='ai'){
    if(t.latencyMs!=null) bits.push('gen '+esc(fmtDur(t.latencyMs)));
    // Always show the token count for an AI turn (the user asked for "tokens used"):
    // a real turn reads e.g. "1,204 tok"; a free-preview turn truthfully reads "0 tok".
    var tok=(Number(t.inputTokens||0)+Number(t.outputTokens||0));
    bits.push(tok.toLocaleString()+' tok');
  }
  return bits.length ? ('<div class="meta">'+bits.join(' · ')+'</div>') : '';
}
// The deliberation console: ego/superego steps under an AI bubble. Only rendered
// when the toggle is on AND the server shipped the content (debug view).
function turnDelibHtml(t){
  if(!S.showDelib || t.by!=='ai' || !t.deliberation || !t.deliberation.length) return '';
  var steps = t.deliberation.map(function(d){
    var head = esc(d.label || d.role || 'step')
      + (d.model ? (' · <code>'+esc(d.model)+'</code>') : '')
      + (d.latencyMs!=null ? (' · '+esc(fmtDur(d.latencyMs))) : '');
    return '<div class="delib__step"><div class="delib__h">'+head+'</div><div class="delib__c">'+nl2br(d.content||'')+'</div></div>';
  }).join('');
  var n = t.deliberation.length;
  return '<details class="delib"><summary>deliberation · '+n+' step'+(n===1?'':'s')+'</summary>'+steps+'</details>';
}
// A live elapsed-seconds counter shown in the AI's ghost bubble while it generates,
// so a slow (multi-call) turn reads as progress rather than dead air.
function startThinkTimer(){
  stopThinkTimer(); S.tStart = Date.now();
  S.timer = setInterval(function(){
    var s = ((Date.now()-S.tStart)/1000).toFixed(1)+'s';
    var els = document.getElementsByClassName('thinkclock');
    for(var i=0;i<els.length;i++){ els[i].textContent = s; }
  }, 100);
}
function stopThinkTimer(){ if(S.timer){ clearInterval(S.timer); S.timer=null; } }
var COMPOSE_COURSES = ${composeCoursesJson()};
var SYL = null; // the syllabus picker controller (course→lesson); wired at load
${SYLLABUS_CLIENT_JS}

function pickSeat(role){
  S.humanRole = role; S.aiRole = role==='learner' ? 'tutor' : 'learner';
  $('seatLearner').classList.toggle('seat--on', role==='learner');
  $('seatTutor').classList.toggle('seat--on', role==='tutor');
  $('grpTutor').hidden = role!=='learner';
  $('grpLearner').hidden = role!=='tutor';
  // The syllabus grounds the AI tutor; hide it when the human plays tutor (AI=learner).
  var sb = $('sylBox'); if(sb) sb.hidden = role!=='learner';
}
function autoGrow(el){ if(!el) return; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,180)+'px'; }

async function postJson(url, body){
  var res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  var data = {}; try { data = await res.json(); } catch(_e){}
  if(!res.ok){ var err = new Error(data.error || res.statusText); Object.assign(err, data); throw err; }
  return data;
}
function whoLabel(role, by){ return role + ' · ' + (by==='human' ? 'you' : 'ai'); }

function modelsLineHtml(sess){
  var m = sess.aiModels||{}; var bits=[];
  if(m.ego) bits.push('ego <code>'+esc(m.ego)+'</code>');
  if(m.superego) bits.push('superego <code>'+esc(m.superego)+'</code>');
  return bits.length ? ('<br>'+bits.join('<br>')) : '';
}
// The cell isn't a free choice — it is the join of the two tutor dials (stance ×
// deliberation). Recognition + ego/superego is the page default, which is why a
// fresh scene lands on cell_7. Spell that out so the cell id isn't a mystery.
function cellWhyHtml(sess){
  var pt = sess.promptType==='base' ? 'base' : 'recognition';
  var ta = sess.tutorArchitecture==='ego_only' ? 'ego only' : 'ego + superego';
  var isDefault = (pt==='recognition' && sess.tutorArchitecture==='ego_superego');
  return '<br><span class="muted">'+esc(pt)+' stance · '+esc(ta)+' → this cell'+(isDefault?' (the default)':'')+'</span>';
}
// The tutor teaches FROM a lecture; without surfacing it the human learner is
// asked to recognise a text they cannot see. So when the AI holds the tutor seat
// the lecture becomes a pane co-equal with the chat (the grid grows a third column
// via .live--reading). Fetch it once per ref (the markdown is rendered to safe HTML
// server-side), cache the ref on S so polls/later turns do not refetch. Only the
// tutor seat is grounded in a reading, so the learner seat hides the pane.
function loadReading(ref){
  var pane = $('readingPane'); if(!pane) return;
  pane.hidden = false;
  var grid = $('liveGrid'); if(grid) grid.classList.add('live--reading');
  if(S.readingRef === ref) return;
  S.readingRef = ref;
  $('readingMeta').textContent = 'loading…';
  $('readingBody').innerHTML = '<div class="readpane__empty">loading the reading…</div>';
  fetch('/api/compose/live/lecture/'+encodeURIComponent(ref))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(!d || !d.ok || !d.lecture){ throw new Error((d && d.error) || 'no lecture'); }
      var L = d.lecture;
      $('readingMeta').textContent = [L.courseTitle, 'lecture '+L.lectureNum].filter(Boolean).join(' · ');
      $('readingBody').innerHTML = L.html || '';
      $('readingBody').scrollTop = 0;
    })
    .catch(function(e){
      S.readingRef = null;
      $('readingMeta').textContent = '';
      $('readingBody').innerHTML = '<div class="readpane__empty">could not load the reading ('+esc(e.message||String(e))+')</div>';
    });
}
function hideReading(){ var p=$('readingPane'); if(p){ p.hidden = true; } var grid=$('liveGrid'); if(grid) grid.classList.remove('live--reading'); S.readingRef = null; }
function renderSession(sess){
  S.lastSession = sess; stopThinkTimer();
  S.id = sess.id; S.status = sess.status; S.nextSpeaker = sess.nextSpeaker;
  S.humanRole = sess.humanRole; S.aiRole = sess.aiRole;
  $('setup').classList.add('setup--min');
  $('transcript').hidden = false; $('liveside').hidden = false; $('composerForm').hidden = false;
  // Pre-fill the save box with a good timestamped default (once), leaving it editable
  // and never clobbering whatever the user has already typed.
  if(!S.namePrefilled && sess.suggestedFilename){ var sn=$('saveName'); if(sn && !sn.value){ sn.value=sess.suggestedFilename; } S.namePrefilled=true; }
  var html = '';
  sess.transcript.forEach(function(t){
    html += '<div class="line line--'+t.role+(t.by==='human'?' line--mine':'')+'">'
      + '<div class="who">'+esc(whoLabel(t.role, t.by))+'</div>'
      + '<div class="bubble">'+mdInline(t.text)+'</div>'
      + turnMetaHtml(t)
      + turnDelibHtml(t)
      + '</div>';
  });
  $('transcript').innerHTML = html || '<div class="t-empty">the stage is set — make the first move</div>';
  $('transcript').scrollTop = $('transcript').scrollHeight;
  var tok = (Number(sess.spend.inputTokens||0)+Number(sess.spend.outputTokens||0));
  $('spendUsd').textContent = '$'+Number(sess.spend.estimatedCostUsd||0).toFixed(4);
  $('spendTok').textContent = tok.toLocaleString()+' tokens · '+sess.turnCount+'/'+sess.maxTurns+' turns';
  $('sceneMeta').innerHTML = 'you are the <b>'+esc(sess.humanRole)+'</b><br>AI is the <b>'+esc(sess.aiRole)+'</b><br>'
    + (sess.aiRole==='tutor' ? ('cell <code>'+esc(sess.tutorCell)+'</code>'+cellWhyHtml(sess)) : ('persona <code>'+esc(sess.persona)+'</code>'))
    + (sess.aiRole==='tutor' && sess.lectureRef ? ('<br>teaching <code>'+esc(sess.lectureRef)+'</code>') : '')
    + modelsLineHtml(sess)
    + (sess.aiRole==='learner' && sess.learnerModel ? ('<br>learner model <code>'+esc(sess.learnerModel)+'</code>') : '')
    + (sess.aiRole==='tutor' ? ('<br>concise <b>'+(sess.concise?'on':'off')+'</b>') : '')
    + (S.mock ? '<br><span class="metered--free">free preview</span>' : '');
  var done = sess.status!=='live';
  var yours = sess.nextSpeaker===sess.humanRole && !done;
  $('composerInput').disabled = !yours; $('sendBtn').disabled = !yours;
  if(done){ $('composerHint').innerHTML = 'scene ended ('+esc(sess.stoppedReason||sess.status)+') — save it, or reload to start another'; }
  else if(yours){ $('composerHint').innerHTML = '<kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline · you are the <b>'+esc(sess.humanRole)+'</b>'; setTimeout(function(){ $('composerInput').focus(); }, 0); }
  else { $('composerHint').textContent = 'the '+sess.aiRole+' is thinking…'; }
  // A scored session carries its verdict on the wire, so re-renders (polls, later
  // turns) keep showing it; an unscored render leaves the panel untouched so a
  // transient "scoring…" / error message isn't clobbered.
  if(sess.score) renderScore(sess.score);
  // Surface the lecture the tutor is teaching from, so the human learner can read
  // what they are being asked to recognise. Only the tutor seat carries a reading.
  if(sess.aiRole==='tutor' && sess.lectureRef) loadReading(sess.lectureRef); else hideReading();
  updateDelibCaveat();
}
function appendOptimistic(text){
  var t = $('transcript');
  t.insertAdjacentHTML('beforeend',
    '<div class="line line--'+S.humanRole+' line--mine"><div class="who">'+esc(whoLabel(S.humanRole,'human'))+'</div><div class="bubble">'+mdInline(text)+'</div></div>'
    + '<div class="line line--'+S.aiRole+' line--ghost"><div class="who">'+esc(whoLabel(S.aiRole,'ai'))+'</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span><span class="thinkclock">0.0s</span></div></div>');
  t.scrollTop = t.scrollHeight;
  startThinkTimer();
}
async function refresh(){ try { var u='/api/compose/live/'+S.id+(S.showDelib?'?debug=1':''); var r = await fetch(u); var d = await r.json(); if(d.session) renderSession(d.session); } catch(_e){} }

// Set a <select> only if the proposed value is one of its options, so a value the
// server clamped away can't blank the control.
function setSelect(id, val){
  var el = $(id); if(!el || val==null || val==='') return;
  for(var i=0;i<el.options.length;i++){ if(el.options[i].value===val){ el.value=val; return; } }
}
// Pour an LLM-proposed spec into the form. The form stays the source of truth —
// begin() reads it, not the guide — so every machine choice is visible + editable.
function applySpecToForm(spec){
  if(!spec) return;
  if(spec.humanRole==='tutor' || spec.humanRole==='learner') pickSeat(spec.humanRole);
  if(spec.topic) $('f-topic').value = spec.topic;
  if('hamartia' in spec) $('f-hamartia').value = spec.hamartia || '';
  setSelect('f-prompt', spec.promptType);
  setSelect('f-tarch', spec.tutorArchitecture);
  if(SYL) SYL.setByRef(spec.lectureRef);
  setSelect('f-persona', spec.persona);
  setSelect('f-larch', spec.learnerArchitecture);
  setSelect('f-lmodel', spec.learnerModel);
  setSelect('f-open', spec.openingSpeaker);
  if(spec.maxTurns) $('f-max').value = spec.maxTurns;
  $('advBox').open = true; // reveal what was dialled in
}
// Metered (one OpenRouter call) unless free preview is on — then a canned spec.
async function guide(){
  var desc = $('g-desc').value.trim();
  var out = $('guideOut');
  if(!desc){ out.hidden=false; out.className='guide__out err'; out.textContent='describe the scene you want first'; $('g-desc').focus(); return; }
  S.mock = $('f-mock').checked;
  $('guideBtn').disabled=true; var lab=$('guideBtn').textContent; $('guideBtn').textContent='composing…';
  out.hidden=false; out.className='guide__out'; out.innerHTML='<span class="muted">the guide is setting the dials…</span>';
  try {
    var r = await postJson('/api/compose/live/guide', { description:desc, mock:S.mock });
    applySpecToForm(r.spec);
    var bits = [];
    if(r.rationale) bits.push('<b>set-up:</b> '+esc(r.rationale));
    if(r.notes) bits.push('<span class="muted">'+esc(r.notes)+'</span>');
    bits.push('<span class="muted">— dialled in below; tweak anything, then begin the scene.</span>');
    out.innerHTML = bits.join('<br>');
  } catch(e){
    out.className='guide__out err';
    out.textContent = (e.code==='LIVE_NO_API_KEY')
      ? 'no OpenRouter key on this server — tick “free preview” for a canned demo, or set the dials by hand.'
      : 'guide failed: '+(e.message||String(e));
  } finally {
    $('guideBtn').disabled=false; $('guideBtn').textContent=lab;
  }
}

function showStage(){
  $('setup').classList.add('setup--min');
  $('transcript').hidden=false; $('liveside').hidden=false; $('composerForm').hidden=false;
}
function restoreSetup(){
  $('setup').classList.remove('setup--min');
  $('transcript').hidden=true; $('liveside').hidden=true; $('composerForm').hidden=true;
}
// Show the stage the instant Begin is clicked, so the metered opening turn never
// reads as dead air: an animated ghost stands in for the AI's opening line (when
// the AI opens) until /start returns and renderSession swaps in the real turn.
function renderSceneLoading(aiOpens){
  showStage();
  $('transcript').innerHTML = aiOpens
    ? ('<div class="line line--'+S.aiRole+' line--ghost"><div class="who">'+esc(whoLabel(S.aiRole,'ai'))
        +'</div><div class="bubble"><span class="composing">composing the opening line</span> <span class="dots"><i></i><i></i><i></i></span><span class="thinkclock">0.0s</span></div></div>')
    : '<div class="t-empty">setting the scene… <span class="dots"><i></i><i></i><i></i></span></div>';
  $('sceneMeta').innerHTML = 'you are the <b>'+esc(S.humanRole)+'</b><br>AI is the <b>'+esc(S.aiRole)+'</b><br><span class="muted">setting the scene…</span>';
  $('spendUsd').textContent='$0.0000'; $('spendTok').textContent='0 tokens';
  $('composerInput').disabled=true; $('sendBtn').disabled=true;
  $('composerHint').textContent = aiOpens ? ('the '+S.aiRole+' is composing the opening line…') : 'setting the scene…';
  if(aiOpens) startThinkTimer();
}
async function begin(){
  $('setupErr').textContent=''; S.mock = $('f-mock').checked;
  // A lecture only grounds the AI when it plays the tutor; never send one for an
  // AI learner (the syllabus picker is hidden in that seat anyway).
  var spec = { humanRole:S.humanRole, topic:$('f-topic').value, hamartia:$('f-hamartia').value,
    promptType:$('f-prompt').value, tutorArchitecture:$('f-tarch').value,
    lectureRef:(S.aiRole==='tutor' ? ($('f-lecture')||{}).value : '')||'',
    persona:$('f-persona').value, learnerArchitecture:$('f-larch').value,
    learnerModel:(S.aiRole==='learner' ? ($('f-lmodel')||{}).value : '')||'',
    openingSpeaker:$('f-open').value, maxTurns:Number($('f-max').value)||16,
    concise:($('f-concise') ? $('f-concise').checked : true),
    showDeliberation:S.showDelib };
  $('beginBtn').disabled=true; $('beginBtn').textContent='setting the scene…';
  renderSceneLoading(spec.openingSpeaker===S.aiRole);
  try { var r = await postJson('/api/compose/live/start', { spec:spec, mock:S.mock }); renderSession(r.session); }
  catch(e){ restoreSetup(); $('setupErr').textContent='could not start: '+(e.message||e); $('beginBtn').disabled=false; $('beginBtn').textContent='Begin the scene →'; }
}
async function send(){
  var text = $('composerInput').value.trim();
  if(!text || S.status!=='live') return;
  $('composerInput').disabled=true; $('sendBtn').disabled=true;
  appendOptimistic(text); $('composerHint').textContent='the '+S.aiRole+' is thinking…';
  try { var r = await postJson('/api/compose/live/turn', { id:S.id, text:text, mock:S.mock, showDeliberation:S.showDelib });
    $('composerInput').value=''; autoGrow($('composerInput')); renderSession(r.session); }
  catch(e){ $('composerHint').innerHTML='<span class="metered">turn failed: '+esc(e.message||String(e))+'</span>'; await refresh(); }
}
async function save(){
  if(!S.id) return; $('saveRes').textContent='saving…';
  try { var r = await postJson('/api/compose/live/save', { id:S.id, filename:$('saveName').value.trim() });
    $('saveRes').innerHTML='saved <code>'+esc(r.path)+'</code> · '+r.bytes+' bytes'; }
  catch(e){ $('saveRes').textContent='save failed: '+(e.message||e); }
}
// End the scene early (idempotent on the server). Freezes the transcript so no
// further turns can be appended; the composer locks because renderSession sees
// status==='done'. Re-fetch (debug-aware) so the frozen view is consistent.
async function endScene(){
  if(!S.id) return;
  if(S.status!=='live'){ $('scoreRes').textContent='the scene has already ended.'; return; }
  $('endBtn').disabled=true;
  try { await postJson('/api/compose/live/'+S.id+'/end', { reason:'user_ended' }); await refresh(); }
  catch(e){ $('scoreRes').textContent='could not end the scene: '+(e.message||e); }
  finally { $('endBtn').disabled=false; }
}
// Score the transcript-so-far on dramatic form (the poetics rubric). Metered — one
// critic call — unless free preview is on, which returns a canned zero-spend verdict.
// You can score a live scene mid-play or a finished one; it doesn't end the scene.
async function scoreScene(){
  if(!S.id) return;
  if(!S.lastSession || !S.lastSession.turnCount){ $('scoreRes').textContent='play at least one turn before scoring.'; return; }
  $('scoreBtn').disabled=true; var lab=$('scoreBtn').textContent; $('scoreBtn').textContent='scoring…';
  $('scoreRes').innerHTML='<span class="muted">the critic is reading the scene'+(S.mock?' (free preview)':'')+'…</span>';
  try {
    var r = await postJson('/api/compose/live/'+S.id+'/score', { mock:S.mock });
    if(r.session) renderSession(r.session); else renderScore(r.score);
  } catch(e){
    $('scoreRes').textContent = (e.code==='LIVE_NO_API_KEY')
      ? 'no OpenRouter key on this server — tick “free preview” for a canned score.'
      : 'score failed: '+(e.message||String(e));
  } finally { $('scoreBtn').disabled=false; $('scoreBtn').textContent=lab; }
}
// Render a dramatic-form verdict (overall + per-dimension, each with the moment the
// critic cited) into the score panel. The poetics rubric is 1–5.
function renderScore(score){
  if(!score){ return; }
  var html = '<div><span class="score__overall">'+esc(String(score.overall))+'</span> <span class="muted">/ 5 · dramatic form</span></div>';
  if(score.headline) html += '<div class="score__headline">'+esc(score.headline)+'</div>';
  (score.dimensions||[]).forEach(function(d){
    html += '<div class="score__dim"><span class="score__dname">'+esc(d.name||d.id)+'</span>'
      + '<span class="score__dval">'+esc(String(d.score))+'/5</span>'
      + (d.why ? '<span class="score__dwhy">'+esc(d.why)+'</span>' : '')+'</div>';
  });
  var foot=[];
  if(score.model) foot.push('critic <code>'+esc(score.model)+'</code>');
  if(score.scoredAtTurn!=null) foot.push('scored at turn '+esc(String(score.scoredAtTurn)));
  if(score.rubricVersion) foot.push('rubric v'+esc(String(score.rubricVersion)));
  if(foot.length) html += '<div class="score__dwhy" style="border-top:1px dotted var(--rule);padding-top:5px;margin-top:5px;">'+foot.join(' · ')+'</div>';
  $('scoreRes').innerHTML = html;
}
// The caveat fires only when the console would expose the AI LEARNER's interior
// (human-as-tutor) — the surface-only signal the instrument must not peek at. The
// AI tutor's own ego/superego is not that hidden-interior signal, so no caveat there.
function updateDelibCaveat(){ var c=$('delibCaveat'); if(c) c.hidden = !(S.showDelib && S.aiRole==='learner'); }
// "message details" is a pure view filter — the meta is already on the wire — so a
// re-render from the cached session is enough.
function onMetaToggle(){ S.showMeta = $('optMeta').checked; setPref('live-meta', S.showMeta); if(S.lastSession) renderSession(S.lastSession); }
// "AI deliberation" content is shipped only when asked for (debug view), so turning
// it on re-fetches so past turns gain their steps; turning it off just hides them.
async function onDelibToggle(){
  S.showDelib = $('optDelib').checked; setPref('live-delib', S.showDelib); updateDelibCaveat();
  if(S.showDelib && S.id){ await refresh(); }
  else if(S.lastSession){ renderSession(S.lastSession); }
}

$('seatLearner').addEventListener('click', function(){ pickSeat('learner'); });
$('seatTutor').addEventListener('click', function(){ pickSeat('tutor'); });
$('guideBtn').addEventListener('click', guide);
$('g-desc').addEventListener('keydown', function(e){ if(e.key==='Enter' && (e.metaKey||e.ctrlKey)){ e.preventDefault(); guide(); } });
$('beginBtn').addEventListener('click', begin);
$('sendBtn').addEventListener('click', send);
$('saveBtn').addEventListener('click', save);
$('endBtn').addEventListener('click', endScene);
$('scoreBtn').addEventListener('click', scoreScene);
$('optMeta').addEventListener('change', onMetaToggle);
$('optDelib').addEventListener('change', onDelibToggle);
$('composerInput').addEventListener('input', function(){ autoGrow($('composerInput')); });
$('composerInput').addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
$('f-mock').addEventListener('change', function(){
  var on = $('f-mock').checked;
  $('meterNote').textContent = on ? 'free preview · canned AI lines · no spend' : 'metered · real LLM calls per AI turn · localhost only';
  $('meterNote').classList.toggle('metered--free', on);
});
// Wire the course→lesson syllabus picker. Choosing a lesson aligns the free-text
// topic with it (so the injected lecture + topic stay coherent) and retargets the
// hamartia *placeholder* at the chosen lesson. Both fields start blank: the topic is
// auto-filled only while a lesson is chosen, and cleared again when the lesson is
// deselected — but a topic the human typed themselves is never clobbered.
var topicAutoFilled = false;
$('f-topic').addEventListener('input', function(){ topicAutoFilled = false; });
SYL = mkSyllabus(COMPOSE_COURSES, $('f-course'), $('f-lecture'), $('f-syl-cap'), function(opt){
  var t = opt && opt.getAttribute && opt.getAttribute('data-topic');
  if(t){
    $('f-topic').value = t;
    topicAutoFilled = true;
  } else if(topicAutoFilled){
    // Lesson cleared (course change or the blank "— lesson —" option) and the topic
    // still holds the title we auto-filled — blank it so no stale topic lingers.
    $('f-topic').value = '';
    topicAutoFilled = false;
  }
  $('f-hamartia').placeholder = t
    ? ('the misreading a learner keeps bringing to “'+t+'”')
    : 'the specific wrong idea the learner keeps reaching for';
});
$('themeToggle').addEventListener('click', function(){ var d=document.documentElement; var nx=d.getAttribute('data-theme')==='dark'?'':'dark'; if(nx)d.setAttribute('data-theme','dark'); else d.removeAttribute('data-theme'); try{ localStorage.setItem('poetics-theme',nx); }catch(_e){} });
try { if(localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch(_e){}
// Restore the view toggles (message details + deliberation console) from prefs.
S.showMeta = getPref('live-meta', false); S.showDelib = getPref('live-delib', false);
if($('optMeta')) $('optMeta').checked = S.showMeta;
if($('optDelib')) $('optDelib').checked = S.showDelib;
pickSeat('learner');
</script>
</body>
</html>`;
}

// ── Ontology atlas (GET /ontology) ────────────────────────────────────────────
// A read-only viewer over the shared TBox (config/ontology/*.ttl), projected into
// three lenses by services/ontology/ontologyView.js: `system` (the whole loaded
// vocabulary), `tutor` and `learner` (the per-role projections — moves, role-scoped
// classes, interior agencies, and the decision/state layers). Module toggles let a
// reader scope the view; a source panel shows the raw TTL + N3 rules per module.

// CSV `modules` query param -> validated module list (unknown names dropped; empty
// falls back to the default set). Mirrors loadModuleSources' validation contract.
function parseModulesParam(value) {
  if (value == null || value === '') return DEFAULT_MODULES;
  const requested = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((name) => ALL_MODULES.includes(name));
  return requested.length ? requested : DEFAULT_MODULES;
}

// Replay bundle names are timestamped slugs (e.g. codex-rewrite-claude-check-T15-…);
// since the model does path.join(REPLAYS_DIR, name), reject anything that isn't a
// flat slug so a request can't traverse out with `..` or an absolute path.
function isSafeBundleName(name) {
  return typeof name === 'string' && /^[A-Za-z0-9._-]+$/u.test(name) && name !== '.' && name !== '..';
}

function renderOntologyHtml() {
  return `${pageHead({
    title: 'Ontology Atlas · poetics',
    css: `
.controls{ position:sticky; top:51px; z-index:9; display:flex; flex-wrap:wrap; align-items:center; gap:10px 18px; padding:10px 18px; background:var(--paper-2); border-bottom:1px solid var(--rule); }
.lenses{ display:inline-flex; border:1px solid var(--rule); }
.lens{ font:12px ui-monospace,monospace; padding:6px 14px; background:var(--paper-4); color:var(--ink-2); border:0; border-right:1px solid var(--rule); cursor:pointer; }
.lens:last-child{ border-right:0; }
.lens.active{ background:var(--moss-deep); color:var(--paper); }
.modbar{ display:inline-flex; flex-wrap:wrap; gap:4px 12px; align-items:center; }
.modbar .lbl{ font:11px ui-monospace,monospace; color:var(--ink-4); text-transform:uppercase; letter-spacing:.05em; }
label.mod{ display:inline-flex; align-items:center; gap:5px; font:12px ui-monospace,monospace; color:var(--ink-2); }
.spacer{ flex:1; }
.counts{ font:11px ui-monospace,monospace; color:var(--ink-4); }
main{ padding:18px 22px; max-width:1100px; }
.blurb{ font-size:13px; color:var(--ink-3); border-left:3px solid var(--moss); background:var(--paper-4); padding:8px 12px; margin-bottom:16px; }
section.sec{ border:1px solid var(--rule); background:var(--paper-4); margin-bottom:16px; }
.sec > h3{ margin:0; padding:9px 12px; font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); display:flex; gap:8px; align-items:baseline; }
.sec > h3 .h-note{ font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink-4); }
.sec > .body{ padding:12px; }
.chips{ display:flex; flex-wrap:wrap; gap:6px; }
.chip{ font:12px ui-monospace,monospace; padding:2px 8px; border:1px solid var(--rule); background:var(--paper-3); color:var(--ink-2); }
.chip.form{ color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }
.chip.anti{ color:var(--brick-d); border-color:var(--brick); background:var(--brick-soft); }
.chip.reg{ color:var(--indigo); background:var(--indigo-soft); border-color:var(--indigo); }
.chip.agency{ color:var(--ochre-d); background:var(--ochre-soft); border-color:var(--ochre); }
button.chip{ font:12px ui-monospace,monospace; cursor:default; }
.chip.rolelink{ cursor:pointer; color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }
.chip.rolelink:hover{ background:var(--moss-deep); color:var(--paper); }
.legend{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 10px; padding:6px 22px; border-bottom:1px solid var(--rule-soft); background:var(--paper-3); }
.legend .lbl{ font:11px ui-monospace,monospace; color:var(--ink-4); text-transform:uppercase; letter-spacing:.05em; }
.legend .chip{ font-size:11px; }
.legend-x{ color:var(--ink-4); font-style:italic; font-size:11px; margin-right:4px; }
.tbl{ width:100%; border-collapse:collapse; font:12px ui-monospace,monospace; }
.tbl th,.tbl td{ text-align:left; padding:6px 8px; border-bottom:1px solid var(--rule-soft); vertical-align:top; }
.tbl th{ color:var(--ink-4); text-transform:uppercase; font-size:10px; letter-spacing:.05em; }
.tbl td code{ color:var(--ink); }
.tree, .tree ul{ list-style:none; margin:0; padding-left:16px; }
.tree{ padding-left:0; font:12px/1.6 ui-monospace,monospace; }
.tree li{ position:relative; padding-left:2px; }
.tree .cid{ color:var(--ink); }
.tree .lbl{ color:var(--moss-deep); font-style:italic; }
.tree .cmt{ color:var(--ink-4); font-style:italic; white-space:normal; max-width:760px; }
.grp{ margin-bottom:12px; }
.grp__h{ font:600 12px ui-monospace,monospace; color:var(--moss-deep); margin-bottom:5px; }
.cmt-inline{ color:var(--ink-4); font-style:italic; }
.muted{ color:var(--ink-4); font-style:italic; }
.src{ margin-bottom:14px; }
.src h4{ margin:0 0 4px; font:600 12px ui-monospace,monospace; color:var(--ink-2); }
.src pre{ margin:0 0 8px; padding:10px; background:var(--paper-3); border:1px solid var(--rule); font:11px/1.5 ui-monospace,monospace; color:var(--ink-2); white-space:pre-wrap; max-height:340px; overflow:auto; }
.loading{ color:var(--ink-4); font-style:italic; padding:24px; }
`,
  })}
<body>
${railHtml({
  active: 'ontology',
  brand: 'ontology atlas',
  sub: 'the shared TBox · system-wide, and the tutor &amp; learner role projections',
  hint: orientBand(
    'ontology',
    'the shared vocabulary the whole system reasons in — moves, agencies, recognition',
    'reference; the make-and-read surfaces are on the rail above',
  ),
})}
<div class="controls">
  <div class="lenses" id="lenses">
    <button class="lens active" data-view="system">system-wide</button>
    <button class="lens" data-view="tutor">tutor</button>
    <button class="lens" data-view="learner">learner</button>
  </div>
  <div class="modbar" id="modbar"><span class="lbl">modules</span></div>
  <div class="spacer"></div>
  <label class="mod"><input type="checkbox" id="srcToggle"> source</label>
  <span class="counts" id="counts"></span>
</div>
<div class="legend" id="legend">
  <span class="lbl">chips</span>
  <span class="chip form">form</span><span class="legend-x">aims at a dramatic form</span>
  <span class="chip anti">form</span><span class="legend-x">contraindicates one</span>
  <span class="chip reg">register</span><span class="legend-x">the voice a move speaks in</span>
  <span class="chip agency">agency</span><span class="legend-x">an interior deliberation seat</span>
  <span class="chip">plain</span><span class="legend-x">a class or named individual</span>
</div>
<main id="content"><div class="loading">loading…</div></main>
<script>
const ALL_MODULES = ${JSON.stringify(ALL_MODULES)};
const DEFAULT_MODULES = ${JSON.stringify(DEFAULT_MODULES)};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { view:'system', modules:new Set(DEFAULT_MODULES), source:false };

function chips(list, cls){ return '<div class="chips">'+(list&&list.length?list.map(function(x){ return '<span class="chip '+(cls||'')+'">'+esc(x)+'</span>'; }).join(''):'<span class="muted">none</span>')+'</div>'; }
// Role-view chips double as lens jumps: tutor_* → tutor lens, learner_* → learner lens.
function roleViewChips(list){
  return '<div class="chips">'+(list&&list.length?list.map(function(v){
    var lens = v.indexOf('tutor')===0 ? 'tutor' : (v.indexOf('learner')===0 ? 'learner' : '');
    return lens ? '<button type="button" class="chip rolelink" data-lens="'+lens+'" title="open the '+lens+' lens">'+esc(v)+' ↗</button>'
                : '<span class="chip">'+esc(v)+'</span>';
  }).join(''):'<span class="muted">none</span>')+'</div>';
}
function formChips(aims, contra){
  var out = (aims||[]).map(function(f){ return '<span class="chip form">'+esc(f)+'</span>'; });
  out = out.concat((contra||[]).map(function(f){ return '<span class="chip anti">⊣ '+esc(f)+'</span>'; }));
  return out.length ? '<div class="chips">'+out.join('')+'</div>' : '<span class="muted">—</span>';
}
function section(title, note, body){
  return '<section class="sec"><h3>'+esc(title)+(note?' <span class="h-note">'+esc(note)+'</span>':'')+'</h3><div class="body">'+body+'</div></section>';
}

function renderModbar(){
  var html = '<span class="lbl">modules</span>';
  ALL_MODULES.forEach(function(m){
    html += '<label class="mod"><input type="checkbox" data-mod="'+esc(m)+'"'+(state.modules.has(m)?' checked':'')+'> '+esc(m)+'</label>';
  });
  $('modbar').innerHTML = html;
}

function tree(nodes){
  if (!nodes || !nodes.length) return '';
  return '<ul class="tree">'+nodes.map(function(n){
    return '<li><span class="cid">'+esc(n.id)+'</span>'+(n.label?' <span class="lbl">'+esc(n.label)+'</span>':'')+
      (n.comment?'<div class="cmt">'+esc(n.comment)+'</div>':'')+tree(n.children)+'</li>';
  }).join('')+'</ul>';
}

function movesTable(moves){
  if (!moves.length) return '<div class="muted">no moves in the loaded modules</div>';
  return '<table class="tbl"><thead><tr><th>move</th><th>register</th><th>forms</th></tr></thead><tbody>'+
    moves.map(function(m){
      return '<tr><td><code>'+esc(m.id)+'</code>'+(m.comment?'<div class="cmt-inline">'+esc(m.comment)+'</div>':'')+'</td>'+
        '<td>'+(m.register&&m.register.length?m.register.map(function(r){return '<span class="chip reg">'+esc(r)+'</span>';}).join(' '):'<span class="muted">—</span>')+'</td>'+
        '<td>'+formChips(m.aimsAtForm, m.contraindicatesForm)+'</td></tr>';
    }).join('')+'</tbody></table>';
}

function renderSystem(d){
  var html = '<div class="blurb">The <strong>system lens</strong> shows the whole TBox at once: <strong>classes</strong> (the type taxonomy), <strong>object properties</strong> (relations between individuals), <strong>datatype properties</strong> (literal-valued attributes — booleans, scores, counts), and <strong>named individuals</strong> (concrete instances). Switch to the tutor / learner lenses for each role&rsquo;s slice.</div>';
  html += section('Loaded ontologies', d.modules.map(function(m){return m.name;}).join(' ⊕ '),
    d.ontologies.map(function(o){ return '<div class="grp"><div class="grp__h">'+esc(o.label||o.id)+' <span class="muted">('+esc(o.module)+')</span></div>'+(o.comment?'<div class="cmt-inline">'+esc(o.comment)+'</div>':'')+'</div>'; }).join(''));
  html += section('Class taxonomy', d.counts.classes+' classes', tree(d.classTree));
  html += section('Object properties', d.objectProperties.length+' properties',
    '<table class="tbl"><thead><tr><th>property</th><th>domain → range</th><th>comment</th></tr></thead><tbody>'+
    d.objectProperties.map(function(p){
      var dr = (p.domain.join(', ')||'·')+' → '+(p.range.join(', ')||'·');
      return '<tr><td><code>'+esc(p.id)+'</code></td><td>'+esc(dr)+'</td><td class="cmt-inline">'+esc(p.comment||'')+'</td></tr>';
    }).join('')+'</tbody></table>');
  html += section('Datatype properties', d.datatypeProperties.length+' properties',
    d.datatypeProperties.length ? '<table class="tbl"><thead><tr><th>property</th><th>domain → range</th><th>comment</th></tr></thead><tbody>'+
    d.datatypeProperties.map(function(p){
      var dr = (p.domain.join(', ')||'·')+' → '+(p.range.join(', ')||'·');
      return '<tr><td><code>'+esc(p.id)+'</code></td><td>'+esc(dr)+'</td><td class="cmt-inline">'+esc(p.comment||'')+'</td></tr>';
    }).join('')+'</tbody></table>' : '<div class="muted">no datatype properties in the loaded modules</div>');
  html += section('Named individuals', d.counts.individuals+' individuals, grouped by type',
    d.individualGroups.map(function(g){
      return '<div class="grp"><div class="grp__h">'+esc(g.type)+' <span class="muted">('+g.items.length+')</span></div>'+
        '<div class="chips">'+g.items.map(function(it){ return '<span class="chip">'+esc(it.id)+'</span>'; }).join('')+'</div></div>';
    }).join(''));
  html += section('Role views', 'the four ego/superego deliberation seats — click to open a role lens', roleViewChips(d.roleViews));
  return html;
}

function renderRole(d){
  var html = '<div class="blurb">'+esc(d.blurb)+'</div>';
  var ag = '<div class="grp"><div class="grp__h">interior agencies</div>'+chips(d.interiorAgencies, 'agency')+'</div>';
  ag += '<div class="grp"><div class="grp__h">role views</div>'+chips(d.roleViews)+'</div>';
  ag += '<div class="grp"><div class="grp__h">advances forms <span class="muted">(performsMove ⨝ aimsAtForm)</span></div>'+chips(d.advancesForms, 'form')+'</div>';
  html += section('Role at a glance', (d.character&&d.character.comment)?d.character.comment:'', ag);
  html += section('Moves performed', d.moves.length+' moves · performedByRole '+d.role, movesTable(d.moves));
  if (d.role === 'tutor'){
    html += section('Evidence → policy guards', d.guards.length+' learner-state guards the tutor reasons over',
      d.guards.length ? '<table class="tbl"><thead><tr><th>learner state</th><th>supports</th><th>contraindicates</th><th>missing KC</th><th>recognition</th></tr></thead><tbody>'+
      d.guards.map(function(g){
        return '<tr><td><code>'+esc(g.state)+'</code></td><td>'+codeList(g.supportsPolicy)+'</td><td>'+codeList(g.contraindicatesPolicy)+'</td><td>'+codeList(g.indicatesMissingKC)+'</td><td>'+codeList(g.supportsRecognitionMove)+'</td></tr>';
      }).join('')+'</tbody></table>' : '<div class="muted">load the reasoning module to see the guard table</div>');
    html += section('Policy actions & tactics', d.policyActions.length+' actions · '+d.tactics.length+' tactic class(es)',
      '<div class="grp"><div class="grp__h">PolicyAction space</div><div class="chips">'+
      d.policyActions.map(function(a){ return '<span class="chip">'+esc(a.id)+(a.requiresKC.length?' <span class="muted">·'+esc(a.requiresKC.join(','))+'</span>':'')+'</span>'; }).join('')+'</div></div>'+
      '<div class="grp"><div class="grp__h">tactic classes (⊑ PolicyAction)</div>'+chips(d.tactics.map(function(t){return t.id;}))+'</div>');
    if (d.plotDevices.length) html += section('Plot devices deployed', 'mythos — continuation, adaptation, reversal',
      d.plotDevices.map(function(grp){
        return '<div class="grp"><div class="grp__h">'+esc(grp.type)+'</div>'+grp.items.map(function(it){
          return '<div><code>'+esc(it.id)+'</code> '+formChips(it.aimsAtForm, it.contraindicatesForm)+'</div>';
        }).join('')+'</div>';
      }).join(''));
  } else {
    html += section('State-space the learner can occupy', 'subclass families it moves between',
      d.stateFamilies.map(function(f){
        return '<div class="grp"><div class="grp__h">'+esc(f.family)+(f.label?' <span class="muted">'+esc(f.label)+'</span>':'')+' ('+f.members.length+')</div>'+
          '<div class="chips">'+f.members.map(function(mb){ return '<span class="chip" title="'+esc(mb.comment||'')+'">'+esc(mb.id)+'</span>'; }).join('')+'</div></div>';
      }).join(''));
  }
  html += section('Role-scoped classes', 'classes named '+(d.role==='tutor'?'Tutor*':'Learner*')+' + their subclasses',
    '<table class="tbl"><thead><tr><th>class</th><th>⊑ parent</th><th>comment</th></tr></thead><tbody>'+
    d.roleClasses.map(function(c){
      return '<tr><td><code>'+esc(c.id)+'</code></td><td class="muted">'+esc((c.subClassOf||[]).join(', '))+'</td><td class="cmt-inline">'+esc(c.comment||'')+'</td></tr>';
    }).join('')+'</tbody></table>');
  return html;
}

function codeList(list){ return (list&&list.length)?list.map(function(x){return '<code>'+esc(x)+'</code>';}).join(' '):'<span class="muted">—</span>'; }

function renderSource(modules){
  return section('Source · raw TTL + N3 rules', 'as loaded from config/ontology/',
    modules.map(function(m){
      var out = '<div class="src"><h4>'+esc(m.tboxFile)+' <span class="muted">('+m.classes+' classes, '+m.individuals+' individuals)</span></h4><pre>'+esc(m.tboxText)+'</pre>';
      if (m.rulesText) out += '<h4>'+esc(m.rulesFile)+'</h4><pre>'+esc(m.rulesText)+'</pre>';
      return out + '</div>';
    }).join(''));
}

async function load(){
  $('content').innerHTML = '<div class="loading">loading…</div>';
  var qs = 'view='+encodeURIComponent(state.view)+'&modules='+encodeURIComponent([...state.modules].join(','));
  try {
    var res = await fetch('/api/ontology?'+qs);
    var d = await res.json();
    if (!res.ok) throw new Error(d.error || res.statusText);
    var body = state.view === 'system' ? renderSystem(d) : renderRole(d);
    if (state.source) body += renderSource(d.modules);
    $('content').innerHTML = body;
    var c = d.counts ? (d.counts.classes+' classes · '+d.counts.individuals+' individuals') : (d.moves.length+' moves · '+d.roleClasses.length+' role classes');
    $('counts').textContent = c;
  } catch (e){
    $('content').innerHTML = '<div class="loading">error: '+esc(e.message)+'</div>';
  }
}

function gotoLens(view){
  if (state.view === view) return;
  state.view = view;
  [].forEach.call($('lenses').children, function(x){ x.classList.toggle('active', x.getAttribute('data-view')===view); });
  load();
}
$('lenses').addEventListener('click', function(e){
  var b = e.target.closest('.lens'); if(!b) return;
  gotoLens(b.getAttribute('data-view'));
});
// Role-view chips inside the rendered content jump to the matching role lens.
$('content').addEventListener('click', function(e){
  var b = e.target.closest('.rolelink'); if(!b) return;
  gotoLens(b.getAttribute('data-lens'));
});
$('modbar').addEventListener('change', function(e){
  var m = e.target.getAttribute('data-mod'); if(!m) return;
  if (e.target.checked) state.modules.add(m); else state.modules.delete(m);
  load();
});
$('srcToggle').addEventListener('change', function(e){ state.source = e.target.checked; load(); });
$('themeToggle').addEventListener('click', function(){
  var dd = document.documentElement; var nx = dd.getAttribute('data-theme')==='dark' ? '' : 'dark';
  if (nx) dd.setAttribute('data-theme','dark'); else dd.removeAttribute('data-theme');
  try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
});
try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
renderModbar();
load();
</script>
</body>
</html>`;
}

// ── Poetics rubric reference (GET /rubric) ────────────────────────────────────
// A read-only reference page for config/evaluation-rubric-poetics.yaml — the 6
// dramatic-form dimensions every critic scores against. The browse "scores" tab
// links here so a reader can move transcript → its scores → the dimension that
// defines each axis. Parsed at request time so rubric edits show live.
function loadPoeticsRubric() {
  const raw = fs.readFileSync(path.resolve(ROOT, 'config/evaluation-rubric-poetics.yaml'), 'utf8');
  return YAML.parse(raw) || {};
}

function renderRubricHtml() {
  let rubric;
  try {
    rubric = loadPoeticsRubric();
  } catch (err) {
    rubric = { __error: err.message };
  }
  const dims = rubric.dimensions || {};
  const scale = rubric.scale || {};
  const labels = scale.labels || {};
  const e = escapeHtml;

  const scaleRows = Object.keys(labels)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => `<tr><td class="lv">${e(k)}</td><td>${e(labels[k])}</td></tr>`)
    .join('');

  const dimCards = Object.keys(dims)
    .map((key) => {
      const d = dims[key] || {};
      const crit = d.criteria || {};
      const critRows = [5, 4, 3, 2, 1]
        .filter((n) => crit[n] != null)
        .map((n) => `<tr><td class="lv">${n}</td><td>${e(crit[n])}</td></tr>`)
        .join('');
      const pct = d.weight != null ? Math.round(Number(d.weight) * 100) + '%' : '';
      return `<section class="dim" id="dim-${e(key)}">
      <div class="dim__h">
        <h3>${e(d.name || key)}</h3>
        ${pct ? `<span class="wt" title="weight in the composite">${e(pct)}</span>` : ''}
      </div>
      <p class="dim__desc">${e(d.description || '')}</p>
      ${critRows ? `<table class="tbl crit"><thead><tr><th>level</th><th>anchor</th></tr></thead><tbody>${critRows}</tbody></table>` : ''}
    </section>`;
    })
    .join('');

  const errBanner = rubric.__error
    ? `<div class="blurb" style="border-left-color:var(--brick);background:var(--brick-soft)">could not load the rubric: ${e(rubric.__error)}</div>`
    : '';

  return `${pageHead({
    title: 'poetics rubric · machine spirits',
    css: `
main{ max-width:900px; margin:0 auto; padding:22px 22px 64px; }
.blurb{ font-size:13px; color:var(--ink-3); border-left:3px solid var(--moss); background:var(--paper-4); padding:10px 14px; margin:0 0 18px; }
.blurb a{ color:var(--moss-deep); }
.meta{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; }
.meta .chip{ font:12px ui-monospace,monospace; padding:3px 9px; border:1px solid var(--rule); background:var(--paper-3); color:var(--ink-2); }
h2.sec-h{ font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-3); margin:22px 0 10px; }
.tbl{ width:100%; border-collapse:collapse; font-size:13px; background:var(--paper-4); border:1px solid var(--rule); }
.tbl th,.tbl td{ text-align:left; padding:7px 10px; border-bottom:1px solid var(--rule-soft); vertical-align:top; }
.tbl th{ color:var(--ink-4); text-transform:uppercase; font-size:10px; letter-spacing:.05em; }
.tbl td.lv{ font:600 13px ui-monospace,monospace; color:var(--moss-deep); width:48px; text-align:center; }
.dim{ border:1px solid var(--rule); background:var(--paper-4); margin-bottom:14px; }
.dim__h{ display:flex; align-items:baseline; gap:10px; padding:10px 14px; background:var(--paper-2); border-bottom:1px solid var(--rule); }
.dim__h h3{ margin:0; font:600 15px Georgia,serif; font-style:italic; color:var(--ink); }
.dim__h .wt{ font:600 11px ui-monospace,monospace; color:var(--moss-deep); background:var(--moss-soft); border:1px solid var(--moss); padding:1px 7px; border-radius:9px; }
.dim__desc{ margin:0; padding:11px 14px; color:var(--ink-2); }
.crit{ border:0; border-top:1px solid var(--rule-soft); }
`,
  })}
<body>
${railHtml({
  active: 'rubric',
  brand: 'poetics rubric',
  sub: 'the 6 dramatic-form dimensions critics score against',
  hint: orientBand(
    'rubric',
    'the six dramatic-form dimensions an AI critic scores each script against',
    'reference; the make-and-read surfaces are on the rail above',
  ),
})}
<main>
  ${errBanner}
  <div class="blurb">Whole-transcript rubric for <em>dramatic form</em> — it classifies the shape of the dialogue (reversal, recognition, surprise-yet-inevitability), <strong>not</strong> what is in anyone's head. Each browse <a href="/browse">scores</a> row is a critic applying these dimensions; the vocabulary they formalise lives in the <a href="/ontology">ontology atlas</a>.</div>
  <div class="meta">
    ${rubric.name ? `<span class="chip">${e(rubric.name)}</span>` : ''}
    ${rubric.version ? `<span class="chip">v${e(rubric.version)}</span>` : ''}
    ${rubric.unit_of_analysis ? `<span class="chip">unit: ${e(rubric.unit_of_analysis)}</span>` : ''}
    ${scale.min != null ? `<span class="chip">scale ${e(scale.min)}–${e(scale.max)}</span>` : ''}
  </div>
  ${scaleRows ? `<h2 class="sec-h">Scale anchors</h2><table class="tbl"><thead><tr><th>level</th><th>meaning</th></tr></thead><tbody>${scaleRows}</tbody></table>` : ''}
  <h2 class="sec-h">Dimensions${Object.keys(dims).length ? ' · ' + Object.keys(dims).length : ''}</h2>
  ${dimCards || '<div class="blurb">no dimensions found in the rubric file</div>'}
</main>
<script>
(function(){
  var btn = document.getElementById('themeToggle');
  try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
  if (btn) btn.addEventListener('click', function(){
    var dd = document.documentElement; var nx = dd.getAttribute('data-theme')==='dark' ? '' : 'dark';
    if (nx) dd.setAttribute('data-theme','dark'); else dd.removeAttribute('data-theme');
    try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
  });
})();
</script>
</body></html>`;
}

// ── Discursive replays (GET /replays) ─────────────────────────────────────────
// A read-only diff viewer over exports/discursive-replays/<bundle>/. Each bundle is
// a counterfactual-revision run: original public transcripts rewritten once, then
// locally gated into survivor/needs_revision/rejected buckets. Left rail picks a
// bundle and lists its items colour-coded by gate verdict; the detail pane shows the
// unified original↔revised diff, the per-criterion gate scores, the adversarial
// checker's findings, and — the conceptual payload — the hidden-state-use ledger that
// licenses the claim boundary "counterfactual_revision_not_online_adaptation".
function renderReplaysHtml() {
  return `${pageHead({
    title: 'Discursive Replays · poetics',
    css: `
.controls{ position:sticky; top:51px; z-index:9; display:flex; flex-wrap:wrap; align-items:center; gap:10px 16px; padding:9px 18px; background:var(--paper-2); border-bottom:1px solid var(--rule); }
.controls label{ font:12px ui-monospace,monospace; color:var(--ink-3); display:inline-flex; align-items:center; gap:6px; }
.controls select{ font:12px ui-monospace,monospace; background:var(--paper-4); color:var(--ink); border:1px solid var(--rule); padding:4px 8px; }
.meta{ font:11px ui-monospace,monospace; color:var(--ink-4); display:inline-flex; gap:8px; flex-wrap:wrap; align-items:center; }
.boundary{ font:11px ui-monospace,monospace; color:var(--moss-deep); border:1px dashed var(--moss); background:var(--moss-soft); padding:2px 8px; }
.spacer{ flex:1; }
.counts{ font:11px ui-monospace,monospace; color:var(--ink-4); }
.bk{ font:11px ui-monospace,monospace; padding:1px 7px; border:1px solid var(--rule); }
.bk.b-survivors{ color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }
.bk.b-needs_revision{ color:var(--ochre-d); border-color:var(--ochre); background:var(--ochre-soft); }
.bk.b-rejected{ color:var(--brick-d); border-color:var(--brick); background:var(--brick-soft); }
.bk.b-dry_run{ color:var(--indigo); border-color:var(--indigo); background:var(--indigo-soft); }
.bk.b-unchecked,.bk.b-disabled,.bk.b-unknown{ color:var(--ink-4); }
.layout{ display:grid; grid-template-columns: 340px 1fr; height: calc(100vh - 93px); }
.list{ border-right:1px solid var(--rule); overflow:auto; background:var(--paper-3); }
.detail{ overflow:auto; padding:16px 22px; max-width:1000px; }
.item{ display:block; width:100%; text-align:left; border:0; border-bottom:1px solid var(--rule-soft); border-left:3px solid var(--ink-4); background:transparent; color:var(--ink); cursor:pointer; padding:9px 12px; font:inherit; }
.item:hover{ background:var(--paper-4); }
.item.sel{ background:var(--paper-4); border-left-width:5px; }
.item.b-survivors{ border-left-color:var(--moss); }
.item.b-needs_revision{ border-left-color:var(--ochre); }
.item.b-rejected{ border-left-color:var(--brick); }
.item.b-dry_run{ border-left-color:var(--indigo); }
.item__id{ font:12px ui-monospace,monospace; color:var(--ink-2); word-break:break-all; }
.item__row{ display:flex; gap:8px; align-items:center; margin-top:4px; }
.pill{ font:10px ui-monospace,monospace; padding:1px 6px; border:1px solid var(--rule); color:var(--ink-3); }
.pill.ok{ color:var(--moss-deep); border-color:var(--moss); }
.pill.no{ color:var(--brick-d); border-color:var(--brick); }
.pill.mut{ color:var(--ink-4); }
.dh{ margin:0 0 4px; font-family:Georgia,serif; font-size:17px; font-style:italic; color:var(--moss-deep); word-break:break-all; }
.dsub{ font:11px ui-monospace,monospace; color:var(--ink-4); margin-bottom:14px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
section.sec{ border:1px solid var(--rule); background:var(--paper-4); margin-bottom:16px; }
.sec > h3{ margin:0; padding:8px 12px; font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); display:flex; gap:8px; align-items:baseline; }
.sec > h3 .h-note{ font-weight:400; text-transform:none; letter-spacing:0; color:var(--ink-4); }
.sec > .body{ padding:12px; }
.diff{ font:12px/1.55 ui-monospace,monospace; border:1px solid var(--rule); overflow:auto; }
.drow{ display:flex; white-space:pre-wrap; }
.drow .g{ flex:0 0 86px; text-align:right; padding:0 8px; color:var(--ink-4); background:var(--paper-3); border-right:1px solid var(--rule-soft); user-select:none; }
.drow .t{ flex:1; padding:0 10px; }
.drow.del{ background:var(--brick-soft); }
.drow.del .t{ color:var(--brick-d); }
.drow.add{ background:var(--moss-soft); }
.drow.add .t{ color:var(--moss-deep); }
.drow .mk{ display:inline-block; width:10px; color:var(--ink-4); }
.tbl{ width:100%; border-collapse:collapse; font:12px ui-monospace,monospace; }
.tbl th,.tbl td{ text-align:left; padding:5px 8px; border-bottom:1px solid var(--rule-soft); vertical-align:top; }
.tbl th{ color:var(--ink-4); text-transform:uppercase; font-size:10px; letter-spacing:.05em; }
.yes{ color:var(--moss-deep); } .nay{ color:var(--brick-d); }
.find{ border-left:3px solid var(--ochre); background:var(--ochre-soft); padding:6px 10px; margin-bottom:6px; font-size:12px; }
.find .sev{ font:10px ui-monospace,monospace; text-transform:uppercase; color:var(--ochre-d); margin-right:6px; }
.find code{ color:var(--ink); background:var(--paper-3); padding:0 3px; border:1px solid var(--rule-soft); }
.find .rec{ margin-top:4px; color:var(--ink-3); font-style:italic; }
.find.major,.find.error{ border-left-color:var(--brick); background:var(--brick-soft); } .find.major .sev,.find.error .sev{ color:var(--brick-d); }
.find.warning{ border-left-color:var(--ochre); }
.find.info,.find.note{ border-left-color:var(--moss); background:var(--moss-soft); } .find.info .sev,.find.note .sev{ color:var(--moss-deep); }
.ledger{ border:1px solid var(--rule); margin-bottom:8px; }
.ledger__h{ font:600 12px ui-monospace,monospace; color:var(--ink-2); padding:6px 10px; background:var(--paper-2); border-bottom:1px solid var(--rule-soft); }
.ledger__b{ padding:8px 10px; font-size:12px; }
.kv{ display:grid; grid-template-columns: 130px 1fr; gap:2px 10px; }
.kv .k{ color:var(--ink-4); font:11px ui-monospace,monospace; }
.kv .v{ color:var(--ink-2); }
.quote{ border-left:2px solid var(--rule); padding-left:8px; color:var(--ink-3); font-style:italic; }
.chips{ display:flex; flex-wrap:wrap; gap:5px; }
.chip{ font:11px ui-monospace,monospace; padding:1px 7px; border:1px solid var(--rule); background:var(--paper-3); color:var(--ink-2); }
.risk{ font:10px ui-monospace,monospace; padding:1px 6px; border:1px solid var(--rule); }
.risk.low{ color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }
.risk.medium{ color:var(--ochre-d); border-color:var(--ochre); background:var(--ochre-soft); }
.risk.high{ color:var(--brick-d); border-color:var(--brick); background:var(--brick-soft); }
.muted{ color:var(--ink-4); font-style:italic; }
.loading{ color:var(--ink-4); font-style:italic; padding:24px; }
`,
  })}
<body>
${railHtml({
  active: 'replays',
  brand: 'discursive replays',
  sub: 'counterfactual revisions of public transcripts · diffed against the originals &amp; locally gated',
  hint: '<span><b>replays</b> — a finished script re-run with one move changed, diffed against the original</span><span class="navhint__sep">·</span><span>see also <a href="/browse">scripts</a> &amp; <a href="/derivation">proof runs</a></span>',
})}
<div class="controls">
  <label>bundle <select id="bundleSel"></select></label>
  <span class="meta" id="bundleMeta"></span>
  <div class="spacer"></div>
  <span class="counts" id="counts"></span>
</div>
<div class="layout">
  <div class="list" id="list"><div class="loading">loading…</div></div>
  <div class="detail" id="detail" role="region" aria-label="Replay detail" tabindex="0"><div class="loading">pick an item on the left.</div></div>
</div>
<script>
const GATE_BUCKETS = ${JSON.stringify(GATE_BUCKETS)};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { bundle:null, item:null, items:[] };

function fmtBuckets(buckets){
  return GATE_BUCKETS.filter(function(b){ return (buckets[b]||0) > 0; })
    .map(function(b){ return '<span class="bk b-'+b+'">'+b.replace(/_/g,' ')+' '+buckets[b]+'</span>'; }).join('') || '<span class="muted">no items</span>';
}
function passPill(p){
  if (p === true) return '<span class="pill ok">✓ pass</span>';
  if (p === false) return '<span class="pill no">✗ fail</span>';
  return '<span class="pill mut">unchecked</span>';
}

async function loadBundles(){
  try {
    const res = await fetch('/api/replays');
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || res.statusText);
    const sel = $('bundleSel');
    if (!d.bundles.length){ sel.innerHTML='<option>(none)</option>'; $('list').innerHTML='<div class="loading">no replay bundles under exports/discursive-replays/</div>'; return; }
    sel.innerHTML = d.bundles.map(function(b){
      const n = b.count!=null?b.count:'?';
      return '<option value="'+esc(b.name)+'">'+esc(b.name)+'  ('+esc(b.generator||'?')+'→'+esc(b.checker||'none')+', '+n+')</option>';
    }).join('');
    state.bundle = d.bundles[0].name;
    sel.value = state.bundle;
    loadBundle(state.bundle);
  } catch (e){ $('list').innerHTML='<div class="loading">error: '+esc(e.message)+'</div>'; }
}

async function loadBundle(name){
  state.bundle = name; state.item = null;
  $('list').innerHTML = '<div class="loading">loading…</div>';
  $('detail').innerHTML = '<div class="loading">pick an item on the left.</div>';
  try {
    const res = await fetch('/api/replays/'+encodeURIComponent(name));
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || res.statusText);
    state.items = d.items || [];
    $('bundleMeta').innerHTML =
      fmtBuckets(d.buckets||{}) +
      (d.claimBoundary?' <span class="boundary" title="every item in this bundle is a one-shot rewrite, not an online tutor run">'+esc(d.claimBoundary)+'</span>':'') +
      (d.nextStageRule?' <span title="local gate next-stage rule">→ '+esc(d.nextStageRule)+'</span>':'');
    $('counts').textContent = state.items.length + ' item(s)';
    renderList();
    if (state.items.length) selectItem(state.items[0].itemId);
  } catch (e){ $('list').innerHTML='<div class="loading">error: '+esc(e.message)+'</div>'; }
}

function renderList(){
  if (!state.items.length){ $('list').innerHTML='<div class="loading">this bundle has no records.</div>'; return; }
  $('list').innerHTML = state.items.map(function(it){
    const ds = it.scores && it.scores.length ? it.scores.filter(function(s){return s.passes===true;}).length+'/'+it.scores.length+' gates' : '';
    return '<button class="item b-'+esc(it.bucket)+(it.itemId===state.item?' sel':'')+'" data-id="'+esc(it.itemId)+'">'+
      '<div class="item__id">'+esc(shortId(it.itemId))+'</div>'+
      '<div class="item__row">'+
        '<span class="bk b-'+esc(it.bucket)+'">'+esc(it.bucket.replace(/_/g,' '))+'</span>'+
        passPill(it.passes)+
        (it.findingsCount?'<span class="pill mut">'+it.findingsCount+' finding'+(it.findingsCount===1?'':'s')+'</span>':'')+
        (ds?'<span class="pill mut">'+ds+'</span>':'')+
      '</div></button>';
  }).join('');
}
function shortId(id){ const p = String(id).split(':'); return p.length>1 ? p.slice(1).join(':') : id; }

async function selectItem(itemId){
  state.item = itemId; renderList();
  $('detail').innerHTML = '<div class="loading">loading…</div>';
  try {
    const res = await fetch('/api/replays/'+encodeURIComponent(state.bundle)+'/item?id='+encodeURIComponent(itemId));
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || res.statusText);
    renderDetail(d);
  } catch (e){ $('detail').innerHTML='<div class="loading">error: '+esc(e.message)+'</div>'; }
}

function section(title, note, body){
  return '<section class="sec"><h3>'+esc(title)+(note?' <span class="h-note">'+esc(note)+'</span>':'')+'</h3><div class="body">'+body+'</div></section>';
}

function diffHtml(diff, stats){
  if (!diff || !diff.length) return '<div class="muted">no diff — transcripts not materialised (dry-run or pending).</div>';
  const rows = diff.map(function(r){
    const cls = r.type==='add'?'add':(r.type==='del'?'del':'');
    const mk = r.type==='add'?'+':(r.type==='del'?'−':' ');
    const g = (r.aLine==null?'':r.aLine) + '·' + (r.bLine==null?'':r.bLine);
    return '<div class="drow '+cls+'"><span class="g">'+esc(g)+'</span><span class="t"><span class="mk">'+mk+'</span>'+esc(r.text)+'</span></div>';
  }).join('');
  return '<div class="diff">'+rows+'</div>';
}

function scoresTable(scores){
  if (!scores || !scores.length) return '<div class="muted">no gate scores.</div>';
  const anyThr = scores.some(function(s){ return s.threshold!=null; });
  return '<table class="tbl"><thead><tr><th>criterion</th><th>raw</th>'+(anyThr?'<th>value</th><th>threshold</th><th>pass</th>':'')+'</tr></thead><tbody>'+
    scores.map(function(s){
      const pass = s.passes===true?'<span class="yes">✓</span>':(s.passes===false?'<span class="nay">✗</span>':'—');
      return '<tr><td><code>'+esc(s.criterion)+'</code></td><td>'+esc(s.raw==null?'—':s.raw)+'</td>'+
        (anyThr?'<td>'+esc(s.value==null?'—':s.value)+'</td><td>'+esc(s.threshold==null?'—':s.threshold)+'</td><td>'+pass+'</td>':'')+'</tr>';
    }).join('')+'</tbody></table>';
}

function findingsHtml(findings){
  if (!findings || !findings.length) return '<div class="muted">no findings.</div>';
  return findings.map(function(f){
    if (typeof f === 'string') return '<div class="find note"><span class="sev">note</span>'+esc(f)+'</div>';
    const sev = (f.severity||'note').toLowerCase();
    const body = f.evidence || f.note || f.message || f.detail || JSON.stringify(f);
    const crit = f.criterion ? '<code>'+esc(f.criterion)+'</code> ' : '';
    const rec = f.recommendation && !/^none\\b/i.test(String(f.recommendation))
      ? '<div class="rec">→ '+esc(f.recommendation)+'</div>' : '';
    return '<div class="find '+esc(sev)+'"><span class="sev">'+esc(sev)+'</span>'+crit+esc(body)+rec+'</div>';
  }).join('');
}

// Gate failures/warnings are either plain criterion strings (smoke fixtures) or
// {criterion,evidence,recommendation} objects (real runs). Render a compact chip per
// reason, evidence in the tooltip — the full prose already shows under findings.
function gateChips(list){
  return (list||[]).map(function(x){
    if (x && typeof x === 'object'){
      const label = x.criterion || x.id || x.name || 'reason';
      const tip = x.evidence || x.recommendation || x.message || '';
      return '<span class="chip" title="'+esc(tip)+'">'+esc(label)+'</span>';
    }
    return '<span class="chip">'+esc(x)+'</span>';
  }).join(' ');
}

function moveLedgerHtml(ledger){
  if (!ledger || !ledger.length) return '<div class="muted">no move ledger.</div>';
  return ledger.map(function(m){
    let kv = '';
    const add = function(k,v){ if (v) kv += '<div class="k">'+esc(k)+'</div><div class="v">'+esc(v)+'</div>'; };
    add('learner signal', m.learnerSignal);
    if (m.evidenceQuote) kv += '<div class="k">evidence</div><div class="v quote">'+esc(m.evidenceQuote)+'</div>';
    add('tutor hypothesis', m.tutorHypothesis);
    add('tactic', m.tactic);
    add('public action', m.publicAction);
    add('learner uptake', m.learnerUptakeOrContest);
    add('tutor revision', m.tutorRevision);
    const terms = (m.ontologyTerms||[]).length ? '<div class="k">ontology</div><div class="v"><div class="chips">'+m.ontologyTerms.map(function(t){return '<span class="chip">'+esc(t)+'</span>';}).join('')+'</div></div>' : '';
    return '<div class="ledger"><div class="ledger__h">'+esc(m.turn||'turn')+'</div><div class="ledger__b"><div class="kv">'+kv+terms+'</div></div></div>';
  }).join('');
}

function hiddenStateHtml(ledger){
  if (!ledger || !ledger.length) return '<div class="muted">no hidden-state-use ledger.</div>';
  return ledger.map(function(h){
    const risk = (h.leakageRisk||'').toLowerCase();
    const riskBadge = risk ? '<span class="risk '+esc(risk)+'">leakage: '+esc(risk)+'</span>' : '';
    return '<div class="ledger"><div class="ledger__h">'+esc(h.usedFor||'use')+' '+riskBadge+'</div><div class="ledger__b">'+
      '<div class="kv"><div class="k">private fact</div><div class="v">'+esc(h.privateFact||'—')+'</div>'+
      (h.publicLicenseQuote?'<div class="k">public licence</div><div class="v quote">'+esc(h.publicLicenseQuote)+'</div>':'')+
      '</div></div></div>';
  }).join('');
}

function renderDetail(d){
  let html = '<div class="dh">'+esc(shortId(d.itemId))+'</div>';
  html += '<div class="dsub">'+
    '<span class="bk b-'+esc(d.bucket)+'">'+esc(d.bucket.replace(/_/g,' '))+'</span>'+
    '<span>status '+esc(d.status)+'</span>'+
    (d.escalate?'<span class="nay">escalate</span>':'')+
    '<span>'+esc((d.generator&&d.generator.backend)||'?')+'→'+esc((d.checker&&d.checker.backend)||'none')+'</span>'+
    (d.runId?'<span>run '+esc(d.runId)+'</span>':'')+
    (d.source?'<span>'+esc(d.source)+'</span>':'')+
  '</div>';

  // Diff
  const st = d.diffStats||{};
  html += section('Original ↔ revised', '+'+(st.added||0)+' −'+(st.deleted||0)+' · '+(st.unchanged||0)+' unchanged', diffHtml(d.diff, st));

  // Gate verdict
  const passLine = (d.passes===true?'checker passed':(d.passes===false?'checker failed':'unchecked')) + (d.claimBoundaryOk===true?' · claim boundary ok':(d.claimBoundaryOk===false?' · claim boundary VIOLATED':''));
  html += section('Local gate scores', passLine, scoresTable(d.scores));

  // Findings
  if (d.findings && d.findings.length) html += section('Checker findings', d.findings.length+' flagged', findingsHtml(d.findings));
  if ((d.failures&&d.failures.length)||(d.warnings&&d.warnings.length)){
    let fw = '';
    if (d.failures&&d.failures.length) fw += '<div class="grp"><strong class="nay">gate failures:</strong> '+gateChips(d.failures)+'</div>';
    if (d.warnings&&d.warnings.length) fw += '<div class="grp" style="margin-top:6px"><strong>warnings:</strong> '+gateChips(d.warnings)+'</div>';
    html += section('Gate verdict detail','the local-threshold reasons it landed in this bucket (full text under findings)',fw);
  }

  // Revision rationale
  if (d.revision){
    const r = d.revision;
    if (r.moveLedger && r.moveLedger.length) html += section('Move ledger', 'why each turn was rewritten', moveLedgerHtml(r.moveLedger));
    if (r.hiddenStateLedger && r.hiddenStateLedger.length) html += section('Hidden-state-use ledger', 'the claim-boundary audit · private fact → public licence', hiddenStateHtml(r.hiddenStateLedger));
    if (r.nonLeakageCheck){
      const nlc = r.nonLeakageCheck;
      const notes = (nlc.notes||[]).map(function(n){return '<div class="find"><span class="sev">note</span>'+esc(n)+'</div>';}).join('');
      html += section('Non-leakage check', nlc.passes===true?'passes':(nlc.passes===false?'FAILS':''), notes || '<div class="muted">no notes.</div>');
    }
    if (r.summary) html += section('Revision summary','',esc(r.summary));
  }

  $('detail').innerHTML = html;
}

$('bundleSel').addEventListener('change', function(e){ loadBundle(e.target.value); });
$('list').addEventListener('click', function(e){ const b=e.target.closest('.item'); if(b) selectItem(b.getAttribute('data-id')); });
$('themeToggle').addEventListener('click', function(){
  const dd = document.documentElement; const nx = dd.getAttribute('data-theme')==='dark' ? '' : 'dark';
  if (nx) dd.setAttribute('data-theme','dark'); else dd.removeAttribute('data-theme');
  try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
});
try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
loadBundles();
</script>
</body>
</html>`;
}

function renderRunsHtml() {
  return `${pageHead({
    title: 'Run launcher · poetics',
    css: `
.controls{ position:sticky; top:51px; z-index:9; display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; padding:9px 18px; background:var(--paper-2); border-bottom:1px solid var(--rule); }
.tabs{ display:flex; gap:0; }
.tab{ font:12px ui-monospace,monospace; color:var(--ink-3); border:1px solid var(--rule); border-right:0; padding:5px 12px; background:var(--paper-4); cursor:pointer; }
.tab:last-child{ border-right:1px solid var(--rule); }
.tab.sel{ color:var(--ink); background:var(--paper); border-bottom-color:var(--paper); font-weight:600; }
.safety{ font:11px ui-monospace,monospace; color:var(--ochre-d); border:1px dashed var(--ochre); background:var(--ochre-soft); padding:2px 8px; }
.spacer{ flex:1; }
.layout{ display:grid; grid-template-columns: minmax(380px, 460px) 1fr; height: calc(100vh - 93px); }
.formcol{ border-right:1px solid var(--rule); overflow:auto; background:var(--paper-3); padding:16px 18px; }
.jobscol{ overflow:auto; padding:16px 20px; max-width:1100px; }
.kind-title{ font-family:Georgia,serif; font-style:italic; font-size:17px; color:var(--moss-deep); margin:0 0 2px; }
.kind-blurb{ font:11px ui-monospace,monospace; color:var(--ink-4); margin-bottom:14px; }
.field{ margin-bottom:11px; }
.field.hidden{ display:none; }
.field > label{ display:block; font:11px ui-monospace,monospace; color:var(--ink-3); margin-bottom:3px; }
.field input[type=text],.field input[type=number],.field select{ width:100%; font:12px ui-monospace,monospace; background:var(--paper-4); color:var(--ink); border:1px solid var(--rule); padding:5px 8px; }
.field.check{ display:flex; align-items:center; gap:7px; }
.field.check > label{ margin:0; color:var(--ink-2); font-size:12px; }
.field .help{ display:block; font:10px ui-monospace,monospace; color:var(--ink-4); margin-top:2px; }
.checks{ display:flex; flex-wrap:wrap; gap:8px 16px; margin:6px 0 12px; }
.checks .field.check{ margin:0; }
.review{ border:1px solid var(--rule); background:var(--paper-4); margin-top:6px; }
.review__h{ font:600 11px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); padding:7px 10px; display:flex; align-items:center; gap:8px; }
.review__b{ padding:10px; }
.cost{ font:10px ui-monospace,monospace; padding:1px 8px; border:1px solid var(--rule); text-transform:uppercase; letter-spacing:.04em; }
.cost.free{ color:var(--moss-deep); border-color:var(--moss); background:var(--moss-soft); }
.cost.quota{ color:var(--ochre-d); border-color:var(--ochre); background:var(--ochre-soft); }
.cost.metered{ color:var(--brick-d); border-color:var(--brick); background:var(--brick-soft); }
.cost.bad{ color:var(--brick-d); border-color:var(--brick); }
.costnote{ font:11px/1.45 ui-monospace,monospace; color:var(--ink-3); margin:8px 0; }
.costnote.metered{ color:var(--brick-d); font-weight:600; }
.cmd{ font:11px/1.5 ui-monospace,monospace; background:var(--paper-2); border:1px solid var(--rule-soft); padding:7px 9px; white-space:pre-wrap; word-break:break-all; color:var(--ink-2); margin:0 0 10px; }
.confirm{ margin:8px 0; }
.confirm input{ width:100%; font:12px ui-monospace,monospace; background:var(--paper); color:var(--brick-d); border:1px solid var(--brick); padding:5px 8px; }
.btn{ font:12px ui-monospace,monospace; color:var(--ink); border:1px solid var(--ink-3); padding:7px 14px; background:var(--paper-4); cursor:pointer; }
.btn:hover{ border-color:var(--ink); }
.btn.go{ color:#fff; background:var(--moss); border-color:var(--moss-deep); }
.btn.warn{ color:#fff; background:var(--ochre-d); border-color:var(--ochre-d); }
.btn.danger{ color:#fff; background:var(--brick); border-color:var(--brick-d); }
[data-theme="dark"] .btn.go,[data-theme="dark"] .btn.warn,[data-theme="dark"] .btn.danger{ color:var(--paper); }
.btn[disabled]{ opacity:.45; cursor:not-allowed; }
.err{ color:var(--brick-d); font:11px ui-monospace,monospace; margin-top:8px; }
.sec-h{ font:600 12px ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); margin:0 0 8px; display:flex; align-items:center; gap:8px; }
.tbl{ width:100%; border-collapse:collapse; font:12px ui-monospace,monospace; }
.tbl th,.tbl td{ text-align:left; padding:6px 8px; border-bottom:1px solid var(--rule-soft); vertical-align:middle; }
.tbl th{ color:var(--ink-4); text-transform:uppercase; font-size:10px; letter-spacing:.05em; }
.jobrow{ cursor:pointer; }
.jobrow:hover{ background:var(--paper-4); }
.jobrow.sel{ background:var(--paper-4); }
.st{ display:inline-flex; align-items:center; gap:6px; }
.st::before{ content:''; width:8px; height:8px; border-radius:50%; background:var(--ink-4); }
.st.running::before{ background:var(--ochre); animation: pulse 1.1s ease-in-out infinite; }
.st.done::before{ background:var(--moss); }
.st.failed::before,.st.error::before{ background:var(--brick); }
.st.stopped::before{ background:var(--ink-4); }
@keyframes pulse{ 0%,100%{ opacity:1 } 50%{ opacity:.3 } }
.joblog{ margin-top:18px; }
.joblog pre{ font:11px/1.5 ui-monospace,monospace; background:#0c0a08; color:#d8d2c4; border:1px solid var(--rule); padding:10px 12px; max-height:42vh; overflow:auto; white-space:pre-wrap; word-break:break-word; }
[data-theme="dark"] .joblog pre{ background:#080604; }
.muted{ color:var(--ink-4); font-style:italic; }
.loading{ color:var(--ink-4); font-style:italic; padding:18px 0; }
.tiny{ font:10px ui-monospace,monospace; color:var(--ink-4); }
`,
  })}
<body>
${railHtml({
  active: 'runs',
  brand: 'run launcher',
  sub: 'spawn generative · replay · adversarial-CLI · online-score runs — localhost only, no auth (deferred)',
  hint: '<span><b>launch</b> — spawn new runs</span><span class="navhint__sep">·</span><span>to explore finished ones, see <a href="/browse">scripts</a> or <a href="/derivation">proof runs</a></span>',
})}
<div class="controls">
  <div class="tabs" id="tabs"></div>
  <div class="spacer"></div>
  <span class="safety">forms default to free · mock · dry-run — metered $ needs type-to-confirm</span>
</div>
<div class="layout">
  <div class="formcol">
    <h2 class="kind-title" id="kindTitle"></h2>
    <div class="kind-blurb" id="kindBlurb"></div>
    <form id="form" autocomplete="off"></form>
    <div class="checks" id="checks"></div>
    <div class="review">
      <div class="review__h">review &amp; launch <span class="cost bad" id="costBadge">—</span></div>
      <div class="review__b">
        <div class="costnote" id="costNote"></div>
        <pre class="cmd" id="cmd">—</pre>
        <div class="confirm" id="confirmRow" style="display:none">
          <input type="text" id="confirmInput" placeholder="type RUN to authorise metered spend">
        </div>
        <button class="btn" id="launchBtn" type="button" disabled>launch</button>
        <div class="err" id="formErr"></div>
      </div>
    </div>
  </div>
  <div class="jobscol">
    <div class="sec-h">jobs <span class="tiny" id="jobsCount"></span></div>
    <div id="jobs"><div class="loading">no jobs yet — launch one on the left.</div></div>
    <div class="joblog" id="joblog"></div>
  </div>
</div>
<script>
const KINDS = ${JSON.stringify(describeKinds())};
const COST = ${JSON.stringify(COST_CLASSES)};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { kind:'replay', fields:[], plan:null, jobs:[], selJob:null };

// ── Per-kind form specs. showIf is evaluated against the live param object so the
// input set narrows to what the selected script actually consumes. ───────────────
const FORMS = {
  replay: {
    blurb: 'One bounded counterfactual rewrite of an existing public transcript → optional adversarial check → local gate.',
    fields: [
      { name:'mode', type:'select', label:'input', options:['item','run','transcript'], def:'item' },
      { name:'itemId', type:'text', label:'item id(s)', placeholder:'run:dialogueId:turn  (comma-separated for many)', showIf:(p)=>p.mode==='item' },
      { name:'runId', type:'text', label:'run id', placeholder:'evaluation run id', showIf:(p)=>p.mode==='run' },
      { name:'limit', type:'number', label:'limit', placeholder:'max items from the run', showIf:(p)=>p.mode==='run' },
      { name:'transcript', type:'text', label:'transcript path', placeholder:'/path/to/public.txt', showIf:(p)=>p.mode==='transcript' },
      { name:'generator', type:'select', label:'generator', options:['mock','codex','claude','agy','gemini'], def:'mock', help:'mock = free; others route through the CLI/Max plan (quota)' },
      { name:'checker', type:'select', label:'checker', options:['none','mock','codex','claude','agy','gemini','adversarial'], def:'none' },
      { name:'db', type:'text', label:'db (optional)', placeholder:'override evaluations.db' },
      { name:'outDir', type:'text', label:'out dir (optional)', placeholder:'exports/discursive-replays/…' },
    ],
    checks: [
      { name:'mock', label:'mock (force free)' },
      { name:'dryRun', label:'dry-run' },
      { name:'force', label:'force' },
    ],
  },
  generate: {
    blurb: 'Generate a new pedagogical drama transcript headlessly (--non-interactive is always added).',
    fields: [
      { name:'id', type:'text', label:'id (optional)', placeholder:'auto-id if blank' },
      { name:'generator', type:'text', label:'generator (optional)', placeholder:'codex | claude | openrouter | …' },
      { name:'model', type:'text', label:'model (optional)', placeholder:'org/model ⇒ METERED · bare name ⇒ quota' },
      { name:'effort', type:'text', label:'effort (optional)', placeholder:'low | medium | high' },
      { name:'maxTurns', type:'number', label:'max turns (optional)' },
      { name:'title', type:'text', label:'title (optional)' },
      { name:'outRoot', type:'text', label:'out root (optional)', placeholder:'exports/drama-generator' },
      { name:'roleMap', type:'text', label:'role map (optional)' },
    ],
    checks: [
      { name:'mock', label:'mock', def:true },
      { name:'dryRun', label:'dry-run' },
      { name:'specOnly', label:'spec-only' },
      { name:'force', label:'force' },
    ],
  },
  'adversarial-score': {
    blurb: 'Run the structure critic (CLI) over a sample dir. "rules" = pure local computation, no model calls.',
    fields: [
      { name:'critic', type:'select', label:'critic', options:['rules','codex','claude','claude-code'], def:'rules', help:'rules = free; codex/claude route through the CLI/Max plan (quota)' },
      { name:'sampleDir', type:'text', label:'sample dir (required)', placeholder:'exports/…/samples' },
      { name:'key', type:'text', label:'key yaml (required)', placeholder:'…/key.yaml' },
      { name:'out', type:'text', label:'out file (optional)' },
      { name:'concurrency', type:'number', label:'concurrency (optional)' },
      { name:'batchSize', type:'number', label:'batch size (optional)' },
    ],
    checks: [
      { name:'mock', label:'mock' },
      { name:'failOnViolation', label:'fail on violation' },
    ],
  },
  'online-score': {
    blurb: 'Backfill OpenRouter scoring for a batch root. REAL metered spend on your API key unless mock/dry-run.',
    fields: [
      { name:'mode', type:'select', label:'target', options:['run','root'], def:'run' },
      { name:'runId', type:'text', label:'run id', placeholder:'calibration run id', showIf:(p)=>p.mode==='run' },
      { name:'rootDir', type:'text', label:'root dir', placeholder:'config/poetics-calibration/<run>', showIf:(p)=>p.mode==='root' },
      { name:'model', type:'text', label:'model', placeholder:'anthropic/claude-sonnet-4.6' },
      { name:'scoreConcurrency', type:'number', label:'score concurrency (optional)', placeholder:'3' },
    ],
    checks: [
      { name:'dryRun', label:'dry-run', def:true },
      { name:'mock', label:'mock' },
      { name:'force', label:'force' },
      { name:'allowQualityWarnings', label:'allow quality warnings' },
    ],
  },
};

function renderTabs(){
  $('tabs').innerHTML = KINDS.map(function(k){
    return '<button class="tab'+(k.kind===state.kind?' sel':'')+'" data-kind="'+esc(k.kind)+'" title="'+esc(k.script)+'">'+esc(k.title.split(' — ')[0])+'</button>';
  }).join('');
}

function fieldHtml(f){
  const id = 'f_'+f.name;
  let input;
  if (f.type==='select'){
    input = '<select id="'+id+'" name="'+esc(f.name)+'">'+f.options.map(function(o){
      return '<option'+(o===f.def?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select>';
  } else if (f.type==='number'){
    input = '<input type="number" id="'+id+'" name="'+esc(f.name)+'" min="1" placeholder="'+esc(f.placeholder||'')+'">';
  } else {
    input = '<input type="text" id="'+id+'" name="'+esc(f.name)+'" placeholder="'+esc(f.placeholder||'')+'" value="'+esc(f.def||'')+'">';
  }
  return '<div class="field" data-field="'+esc(f.name)+'"><label for="'+id+'">'+esc(f.label)+'</label>'+input+
    (f.help?'<span class="help">'+esc(f.help)+'</span>':'')+'</div>';
}

function checkHtml(c){
  const id = 'f_'+c.name;
  return '<div class="field check"><input type="checkbox" id="'+id+'" name="'+esc(c.name)+'"'+(c.def?' checked':'')+'><label for="'+id+'">'+esc(c.label)+'</label></div>';
}

function renderForm(){
  const spec = FORMS[state.kind];
  state.fields = spec.fields;
  const meta = KINDS.find(function(k){ return k.kind===state.kind; }) || {};
  $('kindTitle').textContent = meta.title || state.kind;
  $('kindBlurb').textContent = spec.blurb;
  $('form').innerHTML = spec.fields.map(fieldHtml).join('');
  $('checks').innerHTML = spec.checks.map(checkHtml).join('');
  updateVisibility();
  schedulePlan();
}

function collectParams(){
  const spec = FORMS[state.kind];
  const p = {};
  spec.fields.forEach(function(f){
    const el = $('f_'+f.name); if (!el) return;
    const v = el.value; if (v!=='' && v!=null) p[f.name]=v;
  });
  spec.checks.forEach(function(c){
    const el = $('f_'+c.name); if (el && el.checked) p[c.name]=true;
  });
  return p;
}

function updateVisibility(){
  const p = collectParams();
  FORMS[state.kind].fields.forEach(function(f){
    if (!f.showIf) return;
    const wrap = document.querySelector('.field[data-field="'+f.name+'"]');
    if (wrap) wrap.classList.toggle('hidden', !f.showIf(p));
  });
}

let planTimer = null;
function schedulePlan(){ clearTimeout(planTimer); planTimer = setTimeout(refreshPlan, 220); }

async function refreshPlan(){
  const body = { kind: state.kind, params: collectParams() };
  try {
    const res = await fetch('/api/jobs/plan', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok){ showPlanError(d.error || res.statusText); return; }
    state.plan = d.plan; renderReview(d.plan);
  } catch (e){ showPlanError(e.message); }
}

function showPlanError(msg){
  state.plan = null;
  $('costBadge').className = 'cost bad'; $('costBadge').textContent = 'invalid';
  $('costNote').textContent = ''; $('cmd').textContent = '—';
  $('confirmRow').style.display='none';
  $('formErr').textContent = msg;
  const btn = $('launchBtn'); btn.disabled = true; btn.className='btn'; btn.textContent='launch';
}

function renderReview(plan){
  $('formErr').textContent='';
  const cc = plan.costClass;
  $('costBadge').className = 'cost '+cc;
  $('costBadge').textContent = cc==='metered' ? 'metered $' : cc;
  $('costNote').className = 'costnote'+(cc==='metered'?' metered':'');
  $('costNote').textContent = plan.costNote || '';
  $('cmd').textContent = plan.command;
  const btn = $('launchBtn');
  if (cc==='metered'){
    $('confirmRow').style.display='block';
    btn.className='btn danger'; btn.textContent='launch — METERED $';
    btn.disabled = ($('confirmInput').value.trim().toUpperCase() !== 'RUN');
  } else {
    $('confirmRow').style.display='none';
    btn.disabled = false;
    if (cc==='quota'){ btn.className='btn warn'; btn.textContent='launch — quota drain'; }
    else { btn.className='btn go'; btn.textContent='launch — free'; }
  }
}

async function launch(){
  if (!state.plan) return;
  const btn = $('launchBtn'); btn.disabled = true;
  $('formErr').textContent='';
  const body = { kind: state.kind, params: collectParams() };
  try {
    const res = await fetch('/api/jobs', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok){ $('formErr').textContent = (res.status===409?'serial lock: ':'')+(d.error||res.statusText); refreshPlan(); return; }
    state.selJob = d.job.id;
    $('confirmInput').value=''; refreshPlan();
    await refreshJobs();
  } catch (e){ $('formErr').textContent = e.message; refreshPlan(); }
}

function ago(ts){ if(!ts) return ''; const s = Math.round((Date.now()-ts)/1000); return s<60? s+'s' : (s<3600? Math.round(s/60)+'m' : Math.round(s/3600)+'h'); }

async function refreshJobs(){
  try {
    const res = await fetch('/api/jobs'); const d = await res.json();
    state.jobs = d.jobs || []; renderJobs();
  } catch (_e) { /* keep last */ }
}

function renderJobs(){
  $('jobsCount').textContent = state.jobs.length ? state.jobs.length+' total' : '';
  if (!state.jobs.length){ $('jobs').innerHTML='<div class="loading">no jobs yet — launch one on the left.</div>'; $('joblog').innerHTML=''; return; }
  $('jobs').innerHTML = '<table class="tbl"><thead><tr><th>status</th><th>cost</th><th>label</th><th>started</th><th>pid</th><th></th></tr></thead><tbody>'+
    state.jobs.map(function(j){
      const stop = j.status==='running' ? '<button class="btn danger" data-stop="'+esc(j.id)+'" style="padding:3px 9px">stop</button>' : '';
      const exit = (j.status==='failed'||j.status==='error') ? ' <span class="tiny">('+(j.error?esc(j.error):'exit '+j.exitCode)+')</span>' : '';
      return '<tr class="jobrow'+(j.id===state.selJob?' sel':'')+'" data-job="'+esc(j.id)+'">'+
        '<td><span class="st '+esc(j.status)+'">'+esc(j.status)+'</span>'+exit+'</td>'+
        '<td><span class="cost '+esc(j.costClass)+'">'+esc(j.costClass==='metered'?'metered $':j.costClass)+'</span></td>'+
        '<td>'+esc(j.label)+'</td>'+
        '<td class="tiny">'+esc(ago(j.startedAt))+' ago</td>'+
        '<td class="tiny">'+esc(j.pid||'—')+'</td>'+
        '<td>'+stop+'</td></tr>';
    }).join('')+'</tbody></table>';
  renderJobLog();
}

function renderJobLog(){
  const j = state.jobs.find(function(x){ return x.id===state.selJob; });
  if (!j){ $('joblog').innerHTML=''; return; }
  $('joblog').innerHTML = '<div class="sec-h">log · '+esc(j.label)+'</div>'+
    '<pre class="cmd" style="white-space:pre-wrap">'+esc(j.command)+'</pre>'+
    '<pre>'+esc(j.logTail || '(no output yet)')+'</pre>';
}

// ── Wiring ──────────────────────────────────────────────────────────────────────
renderTabs();
renderForm();
$('tabs').addEventListener('click', function(e){ const b=e.target.closest('.tab'); if(!b) return; state.kind=b.getAttribute('data-kind'); renderTabs(); renderForm(); });
$('form').addEventListener('input', function(){ updateVisibility(); schedulePlan(); });
$('form').addEventListener('change', function(){ updateVisibility(); schedulePlan(); });
$('checks').addEventListener('change', schedulePlan);
$('confirmInput').addEventListener('input', function(){ if (state.plan) renderReview(state.plan); });
$('launchBtn').addEventListener('click', launch);
$('jobs').addEventListener('click', function(e){
  const stop = e.target.closest('[data-stop]');
  if (stop){ e.stopPropagation(); fetch('/api/jobs/'+encodeURIComponent(stop.getAttribute('data-stop'))+'/stop',{method:'POST'}).then(refreshJobs); return; }
  const row = e.target.closest('[data-job]'); if (row){ state.selJob = row.getAttribute('data-job'); renderJobs(); }
});
$('themeToggle').addEventListener('click', function(){
  const dd = document.documentElement; const nx = dd.getAttribute('data-theme')==='dark' ? '' : 'dark';
  if (nx) dd.setAttribute('data-theme','dark'); else dd.removeAttribute('data-theme');
  try { localStorage.setItem('poetics-theme', nx); } catch (_e) {}
});
try { if (localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch (_e) {}
refreshJobs();
setInterval(refreshJobs, 1500);
</script>
</body>
</html>`;
}

function renderBrowserHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Poetics Script Browser</title>
<style>
@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Source+Serif+4:opsz,wght@8..60,200..900&family=JetBrains+Mono:wght@300..700&display=swap");

:root {
  color-scheme: light dark;
  --paper:       #F1E9D8;
  --paper-2:     #E9DFC7;
  --paper-3:     #EFE4CC;
  --paper-4:     #F7EFDD;
  --ink:         #181310;
  --ink-2:       #3A2F27;
  --ink-3:       #6A5C50;
  --ink-4:       #695B47;
  --linen:       #D8C7A9;
  --moss:        #56683A;
  --moss-deep:   #3A4824;
  --moss-soft:   #E3E6CE;
  --brick:       #A53E2E;
  --brick-d:     #7C2C1F;
  --brick-soft:  #F3DDD6;
  --ochre:       #C08A3E;
  --ochre-d:     #835A1B;
  --ochre-soft:  #F5E6C2;
  --indigo:      #2A4F6B;
  --indigo-soft: #DCE6EE;
  --rule:        rgba(28, 22, 16, 0.18);
  --rule-soft:   rgba(28, 22, 16, 0.10);
  --ease:        cubic-bezier(.22,.61,.36,1);

  /* legacy aliases so existing markup keeps working */
  --bg: var(--paper);
  --panel: var(--paper-4);
  --muted: var(--ink-3);
  --line: var(--rule);
  --accent: var(--moss-deep);
  --accent-soft: var(--moss-soft);
  --warn: var(--ochre-d);
  --trap: var(--brick-d);
  --flat: var(--ink-3);
}

[data-theme="dark"] {
  --paper:       #14100C;
  --paper-2:     #1B1612;
  --paper-3:     #1F1A14;
  --paper-4:     #221C16;
  --ink:         #F4EEDD;
  --ink-2:       #E0D8C3;
  --ink-3:       #B9AD96;
  --ink-4:       #8C7E6A;
  --linen:       #3A322A;
  --moss:        #8DA868;
  --moss-deep:   #B5CD92;
  --moss-soft:   #2C3520;
  --brick:       #E36953;
  --brick-d:     #F08A75;
  --brick-soft:  #3A1C16;
  --ochre:       #E6B265;
  --ochre-d:     #F3CB88;
  --ochre-soft:  #3A2C12;
  --indigo:      #7FA6CC;
  --indigo-soft: #1B2A38;
  --rule:        rgba(244, 238, 221, 0.18);
  --rule-soft:   rgba(244, 238, 221, 0.08);
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { background: var(--paper); -webkit-text-size-adjust: 100%; }

body {
  font-family: "Source Serif 4", "Source Serif Pro", Cambria, Georgia, serif;
  font-feature-settings: "ss01", "kern", "liga";
  font-optical-sizing: auto;
  background: var(--paper);
  color: var(--ink-2);
  font-size: 14.5px;
  line-height: 1.5;
  letter-spacing: 0.003em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  position: relative;
  min-height: 100vh;
}
body::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0.14;
  background-image: radial-gradient(rgba(20,16,12,0.55) 0.5px, transparent 0.5px);
  background-size: 3px 3px;
  mix-blend-mode: multiply;
}
body[data-theme="dark"]::after {
  opacity: 0.08;
  background-image: radial-gradient(rgba(244,238,221,0.45) 0.5px, transparent 0.5px);
  mix-blend-mode: screen;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}
::selection {
  background: color-mix(in srgb, var(--ochre) 50%, transparent);
  color: var(--ink);
}

/* ═══════ top rail ═══════ */
/* The rail (.rail*, .rail__beacon, .rail__menu, x-ray overlay) is styled once in
   railHtml()'s inline <style id="rail-extra">, which rides on this page too even
   though /browse skips BASE_CSS. Kept out of this head copy so it cannot drift —
   this block formerly diverged (a ▸ brand caret, a private beacon copy). */

/* ═══════ application grid ═══════ */
.app {
  display: grid;
  grid-template-columns: minmax(320px, 30vw) 1fr;
  min-height: calc(100vh - 40px);
}
.sidebar {
  border-right: 1px solid var(--rule);
  background: var(--paper-3);
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
}
.mast {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--rule);
}
h1 {
  font-family: "Fraunces", "Source Serif 4", Georgia, serif;
  font-optical-sizing: auto;
  font-variation-settings: "SOFT" 50, "WONK" 1, "opsz" 96;
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--ink);
  margin: 0 0 6px;
  line-height: 1.1;
}
.sub {
  font-family: "JetBrains Mono", monospace;
  color: var(--ink-3);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  line-height: 1.45;
}

.filters {
  display: grid;
  gap: 9px;
  padding: 14px 20px 16px;
  border-bottom: 1px solid var(--rule);
}
.filters select, .filters input {
  width: 100%;
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--ink);
  min-height: 32px;
  padding: 6px 9px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  letter-spacing: 0.04em;
  border-radius: 0;
  transition: border-color .12s var(--ease), box-shadow .12s var(--ease);
}
.filters select:focus, .filters input:focus {
  outline: none;
  border-color: var(--brick);
  box-shadow: inset 0 -1px 0 var(--brick);
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* ═══════ item list ═══════ */
.items {
  overflow: auto;
  background: var(--paper-3);
}
.item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--rule-soft);
  background: transparent;
  text-align: left;
  padding: 13px 20px 13px 18px;
  display: grid;
  gap: 6px;
  cursor: pointer;
  transition: background .12s var(--ease), padding .12s var(--ease);
  font-family: "Source Serif 4", serif;
  border-left: 3px solid transparent;
}
.item:hover {
  background: color-mix(in srgb, var(--moss-soft) 55%, var(--paper-3));
}
.item.active {
  background: color-mix(in srgb, var(--moss-soft) 100%, transparent);
  border-left-color: var(--moss-deep);
}
.item-main {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-family: "JetBrains Mono", monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}
.item-meta, .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.06em;
}

/* ═══════ chips ═══════ */
.chip {
  border: 1px solid var(--rule);
  padding: 2px 7px;
  background: var(--paper-4);
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: lowercase;
  font-variant-numeric: tabular-nums;
  line-height: 1.45;
}
.chip.recognition {
  color: var(--moss-deep);
  border-color: color-mix(in srgb, var(--moss) 55%, var(--rule));
  background: color-mix(in srgb, var(--moss-soft) 65%, var(--paper-4));
}
.chip.trap {
  color: var(--brick-d);
  border-color: color-mix(in srgb, var(--brick) 45%, var(--rule));
  background: color-mix(in srgb, var(--brick-soft) 55%, var(--paper-4));
}
.chip.flat {
  color: var(--ink-3);
  border-color: var(--rule);
  background: var(--paper-4);
}
.chip.review {
  color: var(--ochre-d);
  border-color: color-mix(in srgb, var(--ochre) 55%, var(--rule));
  background: color-mix(in srgb, var(--ochre-soft) 60%, var(--paper-4));
}
.chip.peripeteia {
  color: var(--indigo);
  border-color: color-mix(in srgb, var(--indigo) 45%, var(--rule));
  background: color-mix(in srgb, var(--indigo-soft) 65%, var(--paper-4));
}
.chip.organic {
  color: var(--ochre-d);
  border-color: color-mix(in srgb, var(--ochre) 40%, var(--rule));
  background: color-mix(in srgb, var(--ochre-soft) 45%, var(--paper-4));
}
.chip.claimable {
  color: var(--moss-deep);
  border-color: color-mix(in srgb, var(--moss) 65%, var(--rule));
  background: color-mix(in srgb, var(--moss-soft) 90%, var(--paper-4));
  font-weight: 600;
}
.chip.boundary {
  color: var(--ochre-d);
  border-color: color-mix(in srgb, var(--ochre) 55%, var(--rule));
  background: color-mix(in srgb, var(--ochre-soft) 70%, var(--paper-4));
}
.chip.negative {
  color: var(--ink-3);
  border-color: var(--rule);
  background: var(--paper-4);
}
.chip.insufficient {
  color: var(--ink-4);
  border-color: var(--rule-soft);
  background: var(--paper-4);
  font-style: italic;
}

.review-button {
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--ochre-d);
  padding: 6px 11px;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: color .12s var(--ease), border-color .12s var(--ease), background .12s var(--ease);
}
.review-button:hover { color: var(--brick); border-color: var(--brick); }
.review-button.flagged {
  background: color-mix(in srgb, var(--ochre-soft) 80%, var(--paper-4));
  border-color: var(--ochre);
  color: var(--ochre-d);
  font-weight: 600;
}

/* ═══════ main pane ═══════ */
.main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
  background: var(--paper);
}
.detail-head {
  padding: 18px 26px 14px;
  border-bottom: 1px solid var(--rule);
  background: color-mix(in srgb, var(--paper-4) 70%, var(--paper));
}
.detail-title {
  display: flex;
  gap: 14px;
  align-items: baseline;
  justify-content: space-between;
}
.detail-title h2 {
  font-family: "Fraunces", "Source Serif 4", Georgia, serif;
  font-optical-sizing: auto;
  font-variation-settings: "SOFT" 50, "WONK" 1, "opsz" 96;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.012em;
  color: var(--ink);
  margin: 0;
  line-height: 1.15;
}

/* ═══════ tabs ═══════ */
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--rule);
  background: var(--paper-3);
}
.tab {
  border: 0;
  border-right: 1px solid var(--rule-soft);
  padding: 11px 18px;
  background: transparent;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-3);
  transition: color .12s var(--ease), background .12s var(--ease), box-shadow .12s var(--ease);
}
.tab:hover { color: var(--ink); }
.tab.active {
  background: var(--paper);
  color: var(--brick-d);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--brick);
}
.preview-link {
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--moss-deep);
  text-decoration: none;
  padding: 6px 11px;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: color .12s var(--ease), border-color .12s var(--ease);
}
.preview-link:hover { color: var(--brick); border-color: var(--brick); }

.tts-toolbar {
  max-width: 70rem;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.tts-control,
.tts-btn {
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--moss-deep);
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  text-transform: uppercase;
}
.tts-control {
  min-height: 28px;
  padding: 5px 10px;
  font-size: 10.5px;
  letter-spacing: 0.11em;
}
.tts-btn {
  padding: 3px 7px;
  font-size: 9.5px;
  letter-spacing: 0.08em;
}
.tts-control:hover,
.tts-btn:hover {
  color: var(--brick-d);
  border-color: var(--brick);
}
.tts-check,
.tts-status {
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  letter-spacing: 0.05em;
  color: var(--ink-3);
}
.tts-check {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tts-status[data-state="error"] {
  color: var(--brick-d);
}

.pane {
  overflow: auto;
  padding: 26px clamp(20px, 3vw, 32px) 40px;
  background: var(--paper);
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.55;
  font-family: "JetBrains Mono", monospace;
  font-size: 12.5px;
  color: var(--ink-2);
  margin: 0;
  padding: 14px 16px;
  background: var(--paper-4);
  border: 1px solid var(--rule);
}

/* ═══════ script preview ═══════ */
.script-preview {
  max-width: 62rem;
  margin: 0 auto;
  display: grid;
  gap: 14px;
}
.view-toggle {
  display: flex;
  justify-content: flex-end;
  max-width: 70rem;
  margin: 0 auto 12px;
}
.vt-btn {
  font: 11px/1 "JetBrains Mono", monospace;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--ink-3);
  padding: 5px 12px;
  cursor: pointer;
}
.vt-btn + .vt-btn { border-left: none; }
.vt-btn.active { background: var(--moss-deep); color: var(--paper); border-color: var(--moss-deep); }
.swimlane {
  max-width: 70rem;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.swim-head {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--paper);
  padding-bottom: 4px;
}
.swim-label {
  font: 700 10.5px/1 "JetBrains Mono", monospace;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 6px 10px;
  border-bottom: 2px solid var(--rule);
}
.swim-label.tutor { color: var(--moss-deep); border-bottom-color: var(--moss-deep); }
.swim-label.learner { color: var(--ochre-d); border-bottom-color: var(--ochre-d); }
.swim-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: start;
}
.swim-row.span { grid-template-columns: 1fr; }
.swim-row .lane { min-width: 0; }
.swim-row.span .scene-card { max-width: 48rem; margin: 0 auto; opacity: 0.92; }
.swimlane .scene-card { margin: 0; }
.scene-card {
  border: 1px solid var(--rule);
  background: var(--paper-4);
  padding: 14px 18px;
  position: relative;
  transition: border-color .12s var(--ease), box-shadow .12s var(--ease), background .12s var(--ease);
}
.scene-card[data-tts-click="1"] {
  cursor: pointer;
}
.scene-card[data-tts-click="1"]:focus {
  outline: 2px solid color-mix(in srgb, var(--moss) 70%, transparent);
  outline-offset: 2px;
}
.scene-card[data-tts-click="1"]:hover,
.scene-card.is-playing {
  border-color: var(--moss);
  box-shadow: inset 3px 0 0 var(--moss);
}
.scene-card.stage {
  background: color-mix(in srgb, var(--linen) 28%, var(--paper-4));
  color: var(--ink-3);
  font-style: italic;
  border-style: dashed;
}
.scene-card.tutor {
  border-left: 4px solid var(--moss-deep);
}
.scene-card.learner {
  border-left: 4px solid var(--ochre-d);
}
.scene-card.internal {
  border-left: 4px solid var(--brick-d);
  background: color-mix(in srgb, var(--brick-soft) 22%, var(--paper-4));
}
.scene-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 10px;
}
.speaker {
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ink);
}
.turn-num {
  font-family: "JetBrains Mono", monospace;
  color: var(--ink-3);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}
.blocking {
  color: var(--ink-3);
  font-family: "Source Serif 4", serif;
  font-style: italic;
  font-size: 12.5px;
  line-height: 1.5;
  margin-bottom: 10px;
}
.speech {
  white-space: pre-wrap;
  line-height: 1.62;
  font-family: "Source Serif 4", "Source Serif Pro", Georgia, serif;
  font-size: 15.5px;
  color: var(--ink);
}
.inline-aside {
  color: var(--ink-3);
  font-style: italic;
}

/* ═══════ tables ═══════ */
table {
  width: 100%;
  border-collapse: collapse;
  font-family: "Source Serif 4", serif;
  font-size: 13px;
  color: var(--ink-2);
  margin: 0 0 20px;
}
th, td {
  border-bottom: 1px solid var(--rule-soft);
  text-align: left;
  vertical-align: top;
  padding: 9px 8px;
}
thead th {
  border-bottom: 2px solid var(--ink);
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
}
tbody th {
  width: 36%;
  color: var(--ink-3);
  font-family: "JetBrains Mono", monospace;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: none;
}

/* ═══════ score notes and diagnostics ═══════ */
.score-note {
  border: 0;
  border-left: 3px solid var(--brick);
  background: color-mix(in srgb, var(--brick-soft) 25%, var(--paper-4));
  padding: 12px 16px;
  margin: 0 0 16px;
  font-family: "Source Serif 4", serif;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ink-2);
}
.score-note strong {
  font-family: "Fraunces", "Source Serif 4", serif;
  font-style: italic;
  font-variation-settings: "SOFT" 50, "WONK" 1, "opsz" 96;
  font-weight: 500;
  color: var(--ink);
  font-size: 14.5px;
  letter-spacing: -0.005em;
  margin-right: 0.25em;
}
.score-xref {
  display: inline;
  color: var(--ink-3);
}
.score-note a {
  color: var(--moss-deep);
  text-decoration: none;
  border-bottom: 1px solid var(--moss);
  white-space: nowrap;
}
.score-note a:hover {
  color: var(--brick-d);
  border-color: var(--brick);
}
.diagnostic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin: 0 0 20px;
}
.diagnostic-card {
  border: 1px solid var(--rule);
  border-radius: 0;
  padding: 12px 14px;
  background: var(--paper-4);
}
.diagnostic-card strong {
  display: block;
  font-family: "JetBrains Mono", monospace;
  font-size: 10.5px;
  color: var(--ink-3);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 600;
}
.diagnostic-card .metric {
  margin-top: 6px;
  font-family: "Fraunces", "Source Serif 4", serif;
  font-optical-sizing: auto;
  font-variation-settings: "opsz" 144;
  font-size: 32px;
  font-weight: 500;
  color: var(--brick-d);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.diagnostic-card .quote {
  margin-top: 9px;
  color: var(--ink-3);
  font-family: "Source Serif 4", serif;
  font-style: italic;
  font-size: 12px;
  line-height: 1.45;
  border-top: 1px solid var(--rule-soft);
  padding-top: 7px;
}
.metric-help {
  color: var(--ink-3);
  font-family: "Source Serif 4", serif;
  font-style: italic;
  font-size: 11.5px;
  line-height: 1.4;
  margin-top: 4px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
}
.score-table { margin-bottom: 20px; }
.evidence-cell {
  max-width: 460px;
  font-family: "Source Serif 4", serif;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink-2);
}
.empty {
  color: var(--ink-3);
  padding: 32px;
  font-family: "Source Serif 4", serif;
  font-style: italic;
  text-align: center;
  font-size: 14px;
}
.empty--scaffold { padding: 40px 28px; }
.empty__lead { font-style: normal; font-family: inherit; font-size: 15px; color: var(--ink); margin: 0 0 6px; line-height: 1.45; }
.empty__lead strong { color: var(--moss-deep); font-weight: 600; }
.empty__help { font-style: italic; margin: 0 0 16px; color: var(--ink-3); }
.empty__actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; font-style: normal; font-family: inherit; }
.empty__btn { display: inline-block; padding: 7px 14px; border: 1px solid var(--rule); border-radius: 7px; background: var(--paper-3); color: var(--ink-2); font-size: 13px; cursor: pointer; text-decoration: none; }
.empty__btn:hover { border-color: var(--moss); color: var(--moss-deep); }
.empty__btn--go { background: var(--moss-soft); border-color: var(--moss); color: var(--moss-deep); }

/* ═══════ blind mode ═══════ */
.blind .score-only,
.blind .tab[data-tab="full"],
.blind .tab[data-tab="scores"],
.blind .tab[data-tab="meta"] {
  display: none;
}

/* ═══════ label panel ═══════ */
.label-panel {
  border-top: 1px solid var(--rule);
  margin-top: 24px;
  padding-top: 20px;
  display: grid;
  gap: 12px;
  max-width: 56rem;
}
.label-rubric {
  border: 0;
  border-left: 3px solid var(--moss);
  background: color-mix(in srgb, var(--moss-soft) 40%, var(--paper-4));
  padding: 12px 16px;
  font-family: "Source Serif 4", serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ink-2);
}
.label-rubric strong {
  font-family: "Fraunces", "Source Serif 4", serif;
  font-style: italic;
  font-variation-settings: "SOFT" 50, "WONK" 1, "opsz" 96;
  font-weight: 500;
  color: var(--ink);
}
.label-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.label-choice {
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--ink-2);
  padding: 9px 16px;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transition: color .15s var(--ease), border-color .15s var(--ease), background .15s var(--ease);
}
.label-choice:hover { color: var(--ink); border-color: var(--ink-3); }
.label-choice.active {
  background: color-mix(in srgb, var(--moss-soft) 80%, var(--paper-4));
  border-color: var(--moss-deep);
  color: var(--moss-deep);
  font-weight: 700;
}
.label-fields {
  display: grid;
  grid-template-columns: 200px 1fr auto;
  gap: 10px;
  align-items: end;
}
.label-fields input,
.label-fields textarea {
  width: 100%;
  border: 1px solid var(--rule);
  background: var(--paper-4);
  color: var(--ink);
  padding: 8px 10px;
  font-family: "Source Serif 4", serif;
  font-size: 13px;
  transition: border-color .12s var(--ease), box-shadow .12s var(--ease);
}
.label-fields input:focus,
.label-fields textarea:focus {
  outline: none;
  border-color: var(--brick);
  box-shadow: inset 0 -1px 0 var(--brick);
}
.label-fields textarea {
  min-height: 44px;
  resize: vertical;
  line-height: 1.5;
}
.label-fields button {
  border: 1px solid var(--brick);
  background: var(--brick);
  color: var(--paper);
  padding: 10px 18px;
  cursor: pointer;
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  transition: background .15s var(--ease);
}
.label-fields button:hover { background: var(--brick-d); }

/* ═══════ responsive ═══════ */
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 46vh 54vh; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--rule); }
  .label-fields { grid-template-columns: 1fr; }
  /* rail responsive rules live in rail-extra's own @media query (single source) */
  .detail-title h2 { font-size: 20px; }
  .pane { padding: 18px 18px 28px; }
}
</style>
</head>
<body>
${railHtml({
  active: 'browse',
  brand: 'poetics',
  sub: 'sidecar browser · public scripts, full traces, critic scores, labels as perspective',
  extra:
    '<span class="rail__beacon" id="railBeacon" data-state="checking" title="Sidecar database connection"><span class="rail__dot"></span><span id="railBeaconText">checking</span></span>',
  hint: '<span><b>scripts</b> — tutoring dialogues graded by an AI critic on dramatic form</span><span class="navhint__sep">·</span><span>for runs where a fixed rule-checker (not an AI critic) decides whether the learner reached a hidden answer, see <a href="/derivation">proof runs</a></span>',
})}
<div id="app" class="app">
  <aside class="sidebar">
    <div class="mast">
      <h1 id="appTitle">Poetics Script Browser</h1>
      <div id="appSub" class="sub">Generated public scripts, full traces, critic scores, and labels-as-perspective.</div>
    </div>
    <div class="filters">
      <select id="runSelect" aria-label="Select run"></select>
      <input id="searchInput" placeholder="Search id · drama · discipline · condition · arm · critic form (recognition/trap/flat)">
      <select id="disciplineSelect" aria-label="Filter by discipline"><option value="">all disciplines</option></select>
      <input id="labellerInput" class="blind-only" placeholder="Labeller id">
      <div class="filter-row score-only">
        <select id="roleSelect" aria-label="Filter by role">
          <option value="">all roles</option>
          <option value="target">target</option>
          <option value="flat_control">flat controls</option>
          <option value="boundary_trap_control">boundary traps</option>
          <option value="hard_trap_control">hard traps</option>
        </select>
        <select id="formSelect" aria-label="Filter by critic form">
          <option value="">all forms</option>
          <option value="recognition">recognition</option>
          <option value="trap">trap</option>
          <option value="flat">flat</option>
        </select>
      </div>
    </div>
    <div id="items" class="items"></div>
  </aside>
  <main class="main">
    <div id="detailHead" class="detail-head">
      <div class="detail-title">
        <h2>Select a script</h2>
        <span class="sub">Sidecar DB</span>
      </div>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="preview">Preview</button>
      <button class="tab" data-tab="sample">Raw Public</button>
      <button class="tab" data-tab="full">Full</button>
      <button class="tab" data-tab="scores">Scores</button>
      <button class="tab" data-tab="meta">Meta</button>
    </div>
    <div id="pane" class="pane"><div class="empty">No script selected.</div></div>
  </main>
</div>
${TRANSCRIPT_TTS_CLIENT}
<script>
const ORIGIN_CLASSES = ${JSON.stringify(ORIGIN_CLASSES)};
const state = {
  runs: [],
  items: [],
  selected: null,
  detail: null,
  tab: 'preview',
  blind: false,
  labeller: '',
  selectedLabel: null,
  queue: '',
  runIds: [],
  unlabelled: false,
  flagger: 'codex',
  initialItemId: '',
  previewMode: 'script',
};
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inlineEsc = (s) => esc(s).replace(/\\[([^\\]]+)\\]/g, '<span class="inline-aside">[$1]</span>');
const scoreOrNA = (value) => value == null || value === '' || Number.isNaN(Number(value)) ? 'n/a' : Number(value).toFixed(1);
const voteMetric = (count, total) => total ? count + '/' + total : 'n/a';
const boolOrNA = (value) => value == null ? 'n/a' : value ? 'true' : 'false';
const scoreOrigin = (score) => score?.metadata?.recognition_origin || score?.recognitionOrigin || { class: 'none' };
const formatTimestamp = (value) => {
  if (!value) return '';
  return String(value).replace('T', ' ').replace(/\\.\\d+(Z)?$/, '').replace(/Z$/, '').slice(0, 16);
};

function metricLabel(label, help) {
  return esc(label) + '<div class="metric-help">' + esc(help) + '</div>';
}

function firstEvidence(rows, key) {
  const row = (rows || []).find((entry) => entry[key] && entry.evidence?.[key]) ||
    (rows || []).find((entry) => entry.evidence?.[key]);
  return row?.evidence?.[key] ? row.critic + ': ' + row.evidence[key] : '';
}

function renderEndingShapeDiagnostics(detail) {
  const diag = detail.endingShapeDiagnostics;
  if (!diag || !diag.totalCritics) return '';
  const cards = [
    ['Tutor adaptive move', diag.tutorAdaptiveMoveVotes, firstEvidence(diag.criticRows, 'tutorAdaptiveMove')],
    ['Learner performance', diag.learnerPerformanceVotes, firstEvidence(diag.criticRows, 'learnerPerformance')],
    ['Learner reorientation', diag.learnerReorientationVotes, firstEvidence(diag.criticRows, 'learnerReorientation')],
    ['Complete ending shape', diag.completeEndingShapeVotes, 'Requires tutor move + learner performance + learner reorientation from the same critic.'],
  ].map(([label, count, evidence]) =>
    '<div class="diagnostic-card"><strong>' + esc(label) + '</strong>' +
    '<div class="metric">' + esc(voteMetric(count, diag.totalCritics)) + '</div>' +
    (evidence ? '<div class="quote">' + esc(evidence) + '</div>' : '') +
    '</div>'
  ).join('');
  const flags = (diag.disagreementFlags || []).length
    ? '<div class="chips">' + diag.disagreementFlags.map((flag) => '<span class="chip review">' + esc(flag) + '</span>').join('') + '</div>'
    : '<div class="chips"><span class="chip recognition">no axis disagreement</span></div>';
  return '<div class="score-note"><strong>Ending-shape diagnostics.</strong> This panel isolates the mechanism we are trying to tune: tutor changes public device after pressure, learner performs that device, then learner visibly reorients the prior difficulty. Counts are critic votes, not deterministic ground truth.</div>' +
    '<div class="diagnostic-grid">' + cards + '</div>' + flags;
}

function renderOriginDiagnostics(detail) {
  const diag = detail.originDiagnostics;
  if (!diag || !diag.totalCritics) return '';
  const cards = ORIGIN_CLASSES.map((originClass) => {
    const count = diag.counts?.[originClass] || 0;
    const row = (diag.criticRows || []).find((entry) => entry.originClass === originClass);
    const evidence = row?.evidence?.tutorAdaptiveMechanism || row?.evidence?.learnerSelfReframe || row?.justification || '';
    return '<div class="diagnostic-card"><strong>' + esc(originClass.replace(/_/g, ' ')) + '</strong>' +
      '<div class="metric">' + esc(voteMetric(count, diag.totalCritics)) + '</div>' +
      (evidence ? '<div class="quote">' + esc(row.critic + ': ' + evidence) + '</div>' : '') +
      '</div>';
  }).join('');
  const flags = (diag.disagreementFlags || []).length
    ? '<div class="chips">' + diag.disagreementFlags.map((flag) => '<span class="chip review">' + esc(flag) + '</span>').join('') + '</div>'
    : '<div class="chips"><span class="chip recognition">origin agreement</span></div>';
  return '<div class="score-note"><strong>Recognition-origin diagnostics.</strong> This separates whether recognition is absent, organic, induced by the tutor peripeteia chain, a pseudo-cathartic false closure, or ambiguous. These labels are derived from each critic\\'s own role-symmetric axis scores.</div>' +
    '<div class="diagnostic-grid">' + cards + '</div>' + flags;
}

function previewHref(item) {
  if (!item) return '#';
  const params = new URLSearchParams();
  params.set('runId', item.runId);
  params.set('itemId', item.id);
  params.set('tab', 'preview');
  return '/browse?' + params.toString();
}

function ttsClean(s) {
  return String(s || '').replace(/\\s+/g, ' ').trim();
}
function ttsAttrs(role, speaker, text) {
  const cleaned = ttsClean(text);
  if (!cleaned) return '';
  return ' data-tts-role="' + esc(role || 'default') + '" data-tts-speaker="' + esc(speaker || role || 'Fragment') + '" data-tts-text="' + esc(cleaned) + '" data-tts-click="1" tabindex="0"';
}
function ttsButton(label) {
  return '<button type="button" class="tts-btn" data-tts-play title="Play ' + esc(label || 'fragment') + '" aria-label="Play ' + esc(label || 'fragment') + '">play</button>';
}
function renderTtsToolbar() {
  return '<div class="tts-toolbar">' +
    '<button type="button" class="tts-control" data-tts-full>Play visible transcript</button>' +
    '<button type="button" class="tts-control" data-tts-stop>Stop</button>' +
    '<label class="tts-check"><input type="checkbox" data-tts-include-internal> include superego</label>' +
    '<span class="tts-status" data-tts-status></span>' +
    '</div>';
}
function sceneCardHtml(block) {
  const type = block.type || 'other';
  const speech = block.speech || (type === 'stage' ? '' : block.raw || '');
  const blocking = block.blocking || (type === 'stage' ? block.raw || '' : '');
  const audioText = speech || blocking || block.raw || '';
  const audioRole = type === 'stage' ? 'stage' : type;
  const speaker = type === 'stage' ? 'Stage direction' : block.speaker || 'Text';
  const head = type === 'stage'
    ? '<div class="scene-head"><span class="speaker">STAGE DIRECTION</span><span class="turn-num">' + esc(String(block.index || '')) + '</span>' + (audioText ? ttsButton('stage direction') : '') + '</div>'
    : '<div class="scene-head"><span class="speaker">' + esc(block.speaker || 'TEXT') + '</span><span class="turn-num">' + esc(String(block.index || '')) + '</span>' + (audioText ? ttsButton(block.speaker || 'fragment') : '') + '</div>';
  return '<section class="scene-card ' + esc(type) + '"' + ttsAttrs(audioRole, speaker, audioText) + '>' + head +
    (blocking ? '<div class="blocking">[' + inlineEsc(blocking).replace(/^\\[|\\]$/g, '') + ']</div>' : '') +
    (speech ? '<div class="speech">' + inlineEsc(speech) + '</div>' : '') +
    '</section>';
}
function renderTranscriptPreview(blocks, fallbackText) {
  if (!blocks || blocks.length === 0) {
    return '<pre>' + esc(fallbackText || 'No public sample found.') + '</pre>';
  }
  return '<div class="script-preview">' + blocks.map(sceneCardHtml).join('') + '</div>';
}
function renderSwimlane(blocks, fallbackText) {
  if (!blocks || blocks.length === 0) {
    return '<pre>' + esc(fallbackText || 'No public sample found.') + '</pre>';
  }
  const rows = blocks.map((block) => {
    const type = block.type || 'other';
    const card = sceneCardHtml(block);
    if (type === 'tutor') return '<div class="swim-row"><div class="lane">' + card + '</div><div class="lane empty" aria-hidden="true"></div></div>';
    if (type === 'learner') return '<div class="swim-row"><div class="lane empty" aria-hidden="true"></div><div class="lane">' + card + '</div></div>';
    return '<div class="swim-row span">' + card + '</div>';
  }).join('');
  return '<div class="swimlane"><div class="swim-head"><span class="swim-label tutor">tutor</span><span class="swim-label learner">learner</span></div>' + rows + '</div>';
}
function renderScriptView(blocks, fallbackText) {
  const mode = state.previewMode === 'swimlane' ? 'swimlane' : 'script';
  const toggle = '<div class="view-toggle">' +
    '<button type="button" class="vt-btn' + (mode === 'script' ? ' active' : '') + '" data-view="script">script</button>' +
    '<button type="button" class="vt-btn' + (mode === 'swimlane' ? ' active' : '') + '" data-view="swimlane">swimlane</button>' +
    '</div>';
  const body = mode === 'swimlane' ? renderSwimlane(blocks, fallbackText) : renderTranscriptPreview(blocks, fallbackText);
  return renderTtsToolbar() + toggle + body;
}

function renderAdaptationSidecar(adaptation) {
  if (!adaptation) return '<div class="empty">No tutor adaptation sidecar row found.</div>';
  const strategy = [adaptation.tutor_strategy_before, adaptation.tutor_strategy_after].filter(Boolean).join(' -> ');
  const peripeteia = adaptation.metadata?.peripeteia || null;
  const branch = adaptation.metadata?.branch_validity || null;
  const branchHtml = branch ? '<h3>Branch validity diagnostics</h3>' +
    '<div class="score-note"><strong>Private event check.</strong> This verifies that the branch actually supplied the private event it was designed to test. Peripeteia arms require a learnerReversalEventUsed; uptake arms require a learnerReframeEventUsed.</div>' +
    '<table><tbody>' +
    '<tr><th>' + metricLabel('Branch valid', 'True when every private event required by this arm was actually used by a tutor turn after the shared prefix.') + '</th><td>' + esc(boolOrNA(branch.valid)) + '</td></tr>' +
    '<tr><th>' + metricLabel('learnerReversalEventUsed', 'Required for peripeteia arms. This is the tutor-private resistance, breakdown, pseudo-catharsis, closure-pressure, or misfit event consumed by the tutor.') + '</th><td>' + esc(boolOrNA(branch.learner_reversal_event_used)) + ' ' + esc(branch.requires_learner_reversal_event ? '(required)' : '(not required)') + '</td></tr>' +
    '<tr><th>' + metricLabel('learnerReframeEventUsed', 'Required for uptake arms. This is the tutor-private learner self-reframe event consumed by the tutor.') + '</th><td>' + esc(boolOrNA(branch.learner_reframe_event_used)) + ' ' + esc(branch.requires_learner_reframe_event ? '(required)' : '(not required)') + '</td></tr>' +
    '</tbody></table>' : '';
  const peripeteiaHtml = peripeteia ? '<h3>Peripeteia tutor adaptation sidecar (main)</h3>' +
    '<div class="score-note"><strong>Main adaptation target.</strong> This checks whether learner resistance, breakdown, false closure, or misfit creates dramatic pressure, and whether the tutor breaks a failed tutoring habit by inventing a new learning mechanism after the ego/superego review.</div>' +
    '<table><tbody>' +
    '<tr><th>' + metricLabel('Learner reversal pressure', 'Rule detection of resistance, breakdown, false closure, contradiction, or mismatch in the learner turn.') + '</th><td>' + esc(boolOrNA(peripeteia.learner_reversal_pressure)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Peripeteia tutor adaptation', 'Rule detection that the following tutor turn changes route, task, role, object, evidence standard, representation, cognitive load, interruption, social consequence, or affective register.') + '</th><td>' + esc(boolOrNA(peripeteia.tutor_strategy_reversal)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Peripeteia adaptation score', '0-100 heuristic score for resistance pressure plus tutor mechanism shift. This does not require a learner self-reframe.') + '</th><td>' + esc(scoreOrNA(peripeteia.tutor_peripeteia_score)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Trigger / outcome', 'Trigger type and next learner outcome: recognition, trap, maintained resistance, flat, or unknown.') + '</th><td>' + esc([peripeteia.trigger_type, peripeteia.learner_outcome_after_reversal].filter(Boolean).join(' -> ') || 'n/a') + '</td></tr>' +
    '<tr><th>' + metricLabel('Rule evidence excerpts', 'Excerpt pair used by the peripeteia analyzer.') + '</th><td class="evidence-cell">' + esc(peripeteia.evidence || '') + '</td></tr>' +
    '</tbody></table>' : '';
  return branchHtml + peripeteiaHtml + '<h3>Recognition-contingent tutor uptake sidecar (secondary)</h3>' +
    '<div class="score-note"><strong>Secondary closure pattern.</strong> This deterministic analyzer is not an LLM critic score. It checks whether a learner self-reframe is followed by a tutor move that takes up that changed frame. Useful, but not the main adaptation trigger.</div>' +
    '<table><tbody>' +
    '<tr><th>' + metricLabel('Learner self-reframe (sidecar)', 'Rule detection that a later learner turn revisits or reframes the learner\\'s own earlier wording.') + '</th><td>' + esc(boolOrNA(adaptation.learner_self_reframe)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Recognition-contingent tutor uptake (sidecar)', 'Rule detection that the next tutor turn takes up the learner\\'s revised frame rather than merely continuing the old plan.') + '</th><td>' + esc(boolOrNA(adaptation.tutor_contingent_adaptation)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Heuristic uptake score', '0-100 sidecar score combining post-tutor overlap, positive uptake delta, novel shared terms, and strategy shift; gated by learner self-reframe.') + '</th><td>' + esc(scoreOrNA(adaptation.tutor_adaptation_score)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Tutor uptake delta', 'Post-tutor overlap with learner pivot terms minus pre-tutor overlap. Negative means the next tutor reused fewer pivot terms.') + '</th><td>' + esc(scoreOrNA(adaptation.uptake_delta)) + '</td></tr>' +
    '<tr><th>' + metricLabel('Tutor strategy before -> after', 'Coarse rule-coded strategy on the tutor turn before and after the learner pivot.') + '</th><td>' + esc(strategy || 'n/a') + '</td></tr>' +
    '<tr><th>' + metricLabel('Novel shared pivot terms', 'Salient learner-pivot terms that appear in the next tutor turn and did not appear in the previous tutor turn.') + '</th><td>' + esc((adaptation.shared_salient_terms || []).join(', ') || 'n/a') + '</td></tr>' +
    '<tr><th>' + metricLabel('Rule evidence excerpts', 'Excerpt pair used by the sidecar analyzer.') + '</th><td class="evidence-cell">' + esc(adaptation.evidence || '') + '</td></tr>' +
    '</tbody></table>';
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || await res.text());
  return res.json();
}

function formChip(entry) {
  const short = entry.critic.split('/').pop().replace(/-.+$/, '');
  return '<span class="chip ' + esc(entry.form) + '">' + esc(short + ': ' + entry.form) + '</span>';
}

function consensusChip(consensus) {
  if (!consensus) return '';
  const label = consensus.claimStatus === 'claimable'
    ? 'claimable'
    : consensus.claimStatus === 'boundary'
      ? 'boundary'
      : consensus.claimStatus === 'negative'
        ? 'negative'
        : 'insufficient';
  const detail = consensus.totalCritics
    ? ' · ' + consensus.recognitionVotes + '/' + consensus.totalCritics + ' recog'
    : '';
  return '<span class="chip ' + esc(label) + '">' + esc(label + detail) + '</span>' +
    (consensus.disagreement ? '<span class="chip review">critic disagreement</span>' : '');
}

function renderConsensusPanel(consensus) {
  if (!consensus) return '<div class="score-note">No critic consensus row found.</div>';
  const votes = (consensus.votes || [])
    .map((vote) => '<span class="chip ' + esc(vote.form) + '">' + esc(vote.critic + ': ' + vote.form) + '</span>')
    .join(' ');
  return '<div class="score-note"><strong>Consensus adjudication.</strong> ' +
    esc(consensus.ruleDescription || '3-of-4 recognition is claimable; 2-of-4 is boundary; 0-1-of-4 is negative.') +
    '<div class="chips" style="margin-top:8px">' +
    consensusChip(consensus) +
    '<span class="chip">' + esc('class: ' + (consensus.consensusClass || 'n/a')) + '</span>' +
    '</div><div class="chips" style="margin-top:8px">' +
    votes +
    '</div></div>';
}

function renderRuns() {
  const select = el('runSelect');
  const totalItems = state.runs.reduce((sum, run) => sum + (Number(run.itemCount) || 0), 0);
  // "all runs" default so cross-cutting filters (discipline, search) span the whole
  // corpus. Without it, runSelect pins to the most-recent run — which may be narrow
  // (e.g. replay-only), making a discipline pick silently AND to zero results.
  select.innerHTML =
    '<option value="">all runs · ' + totalItems + ' scripts</option>' +
    state.runs.map((run) =>
      '<option value="' + esc(run.id) + '">' +
      esc(run.id + ' · ' + formatTimestamp(run.createdAt) + ' · ' + run.itemCount + ' items · ' + run.scoreCount + ' scores' + (run.reviewFlagCount ? ' · ' + run.reviewFlagCount + ' flags' : '')) + '</option>'
    ).join('');
  if (state.runIds.length) {
    const label = state.runIds.join(', ');
    select.innerHTML = '<option value="">' + esc(label + ' · focused queue') + '</option>' + select.innerHTML;
    select.value = '';
    select.disabled = true;
  }
}

function activeFilterSummary() {
  const parts = [];
  const get = (id) => (el(id) ? el(id).value : '');
  const disc = get('disciplineSelect');
  const q = el('searchInput') ? el('searchInput').value : '';
  const run = get('runSelect');
  const role = get('roleSelect');
  const form = get('formSelect');
  if (disc) parts.push('discipline <strong>' + esc(disc) + '</strong>');
  if (q) parts.push('search <strong>&ldquo;' + esc(q) + '&rdquo;</strong>');
  if (run) parts.push('run <strong>' + esc(run) + '</strong>');
  if (role) parts.push('role <strong>' + esc(role) + '</strong>');
  if (form) parts.push('form <strong>' + esc(form) + '</strong>');
  return parts;
}

function renderEmptyState() {
  const parts = activeFilterSummary();
  const hasFilters = parts.length > 0;
  const lead = hasFilters
    ? 'No scripts match ' + parts.join(' · ') + '.'
    : 'No scripts in the corpus yet.';
  const help = hasFilters
    ? 'Loosen a filter, or generate a transcript for this slice.'
    : 'Generate the first drama transcript to populate the scriptorium.';
  return '<div class="empty empty--scaffold">' +
    '<p class="empty__lead">' + lead + '</p>' +
    '<p class="empty__help">' + help + '</p>' +
    '<div class="empty__actions">' +
    (hasFilters ? '<button type="button" id="clearFilters" class="empty__btn">Clear filters</button>' : '') +
    '<a class="empty__btn empty__btn--go" href="/compose">Generate a script &rarr;</a>' +
    '</div></div>';
}

function clearBrowseFilters() {
  ['disciplineSelect', 'runSelect', 'roleSelect', 'formSelect'].forEach((id) => { const e = el(id); if (e) e.value = ''; });
  if (el('searchInput')) el('searchInput').value = '';
  state.selected = null;
  loadItems();
}

function renderItems() {
  const root = el('items');
  if (!state.items.length) {
    root.innerHTML = renderEmptyState();
    const clear = el('clearFilters');
    if (clear) clear.addEventListener('click', clearBrowseFilters);
    return;
  }
  root.innerHTML = state.items.map((item) => {
    const active = state.selected === item.id ? ' active' : '';
    if (state.blind) {
      return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
        '<div class="item-main"><span>' + esc(item.blindId || item.tid || 'script') + '</span><span>' + esc(item.tid || '') + '</span></div>' +
        '<div class="item-meta"><span>public transcript</span><span>' + esc(formatTimestamp(item.createdAt) || 'no timestamp') + '</span><span>' + esc(item.labelCount ? 'labelled' : 'unlabelled') + '</span>' +
        (item.reviewFlagCount ? '<span>review flagged</span>' : '') + '</div>' +
        '</button>';
    }
    const role = item.controlRole || (item.unitId || '').replace(/-.+$/, '');
    return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
      '<div class="item-main"><span>' + esc(item.tid + ' · ' + (item.dramaId || '')) + '</span><span>' + esc(item.arm || '') + '</span></div>' +
      '<div class="item-meta"><span>' + esc(item.repeat || '') + '</span><span>' + esc(role || '') + '</span><span>' + esc(item.discipline || '') + '</span><span>' + esc(formatTimestamp(item.createdAt) || 'no timestamp') + '</span></div>' +
    '<div class="chips">' + item.criticForms.map(formChip).join('') +
      consensusChip(item.consensus) +
      (item.scoreCount ? '<span class="chip recognition">' + esc('action ' + item.actionalBreakthroughCount + '/' + item.scoreCount) + '</span>' : '') +
      (item.scoreCount ? '<span class="chip">' + esc('quality ' + item.adaptiveMechanismQualityCount + '/' + item.scoreCount) + '</span>' : '') +
      (item.scoreCount ? '<span class="chip">' + esc('ending ' + item.endingShapeCount + '/' + item.scoreCount) + '</span>' : '') +
      (item.scoreCount ? '<span class="chip peripeteia">' + esc('origin P ' + item.peripeteiaOriginCount + '/' + item.scoreCount) + '</span>' : '') +
      (item.scoreCount ? '<span class="chip organic">' + esc('origin O ' + item.organicOriginCount + '/' + item.scoreCount) + '</span>' : '') +
      (item.peripeteiaScore == null ? '' : '<span class="chip">' + esc('peripeteia ' + Math.round(item.peripeteiaScore)) + '</span>') +
      (item.peripeteiaTutorAdaptation ? '<span class="chip recognition">public mechanism</span>' : '') +
      (item.tutorAdaptationScore == null ? '' : '<span class="chip">' + esc('uptake ' + Math.round(item.tutorAdaptationScore)) + '</span>') +
      (item.branchValidity && item.branchValidity.valid === false ? '<span class="chip review">branch event missing</span>' : '') +
      (item.learnerSelfReframe ? '<span class="chip recognition">learner reframe</span>' : '') +
      (item.tutorContingentAdaptation ? '<span class="chip recognition">tutor uptake</span>' : '') +
      (item.reviewFlagCount ? '<span class="chip review">review × ' + esc(item.reviewFlagCount) + '</span>' : '') +
      '</div>' +
      '</button>';
  }).join('');
  root.querySelectorAll('.item').forEach((button) => button.addEventListener('click', () => selectItem(button.dataset.id)));
}

function renderDetailHead() {
  const detail = state.detail;
  if (!detail) return;
  const item = detail.item;
  if (state.blind) {
    el('detailHead').innerHTML = '<div class="detail-title"><h2>' +
      esc(item.tid || 'Script') +
      '</h2><span class="sub">blind human scoring</span></div>';
    return;
  }
  const activeFlags = (detail.reviewFlags || []).filter((flag) => !flag.resolved_at);
  el('detailHead').innerHTML = '<div class="detail-title"><h2>' +
    esc(item.tid + ' · ' + (item.dramaId || item.unitId)) +
    '</h2><span class="sub">' + esc([item.runId, item.repeat, item.arm, formatTimestamp(item.createdAt) && ('script ' + formatTimestamp(item.createdAt))].filter(Boolean).join(' / ')) + '</span></div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">' +
    '<div class="chips" style="margin-top:8px">' +
    consensusChip(detail.consensus) +
    [item.discipline, item.conditionName, item.intendedLean, item.controlRole, item.controlFamily].filter(Boolean).map((v) => '<span class="chip">' + esc(v) + '</span>').join('') +
    activeFlags.map((flag) => '<span class="chip review">' + esc(flag.flag_type + ' · ' + flag.priority) + '</span>').join('') +
    '</div>' +
    '<a class="preview-link" href="' + esc(previewHref(item)) + '">Preview Link</a>' +
    '<button id="flagReview" class="review-button' + (activeFlags.length ? ' flagged' : '') + '">' +
    esc(activeFlags.length ? 'Flagged for Review' : 'Flag for Review') +
    '</button></div>';
  wireReviewFlagButton();
}

function wireReviewFlagButton() {
  const button = el('flagReview');
  if (!button) return;
  button.addEventListener('click', async () => {
    const reason = window.prompt('Reason for human review', 'critic disagreement needs human perspective');
    if (reason == null) return;
    button.textContent = 'Flagging...';
    try {
      const saved = await postJson('/api/review-flags', {
        itemId: state.detail.item.id,
        flaggerId: state.flagger || 'codex',
        flagType: 'human_review',
        priority: 'normal',
        reason,
        source: 'browser-manual-flag',
      });
      state.detail = saved.detail;
      renderDetailHead();
      renderPane();
      await loadItems();
    } catch (err) {
      button.textContent = err.message;
    }
  });
}

function renderPane() {
  const detail = state.detail;
  if (!detail) return;
  const pane = el('pane');
  if (state.blind) {
    const current = detail.label || {};
    state.selectedLabel = state.selectedLabel || current.form_class || null;
    pane.innerHTML = renderScriptView(detail.samplePreview, detail.sampleText) + renderLabelPanel(current);
    wireLabelPanel();
  } else if (state.tab === 'preview') {
    pane.innerHTML = renderOriginDiagnostics(detail) + renderEndingShapeDiagnostics(detail) + renderScriptView(detail.samplePreview, detail.sampleText);
  } else if (state.tab === 'sample') {
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>';
  } else if (state.tab === 'full') {
    pane.innerHTML = renderScriptView(detail.fullTranscriptPreview, detail.fullTranscriptText || 'No full transcript found.');
  } else if (state.tab === 'scores') {
    const adaptation = detail.tutorAdaptation;
    const adaptationHtml = renderAdaptationSidecar(adaptation);
    pane.innerHTML = renderConsensusPanel(detail.consensus) +
      renderOriginDiagnostics(detail) +
      renderEndingShapeDiagnostics(detail) +
      '<div class="score-note"><strong>LLM critic scores.</strong> Each row is one critic model judging the same public transcript. Learner self-reframe is the existing recontextualization axis. Actional breakthrough is separate: did the learner perform a new device or criterion even without narrating self-reframe? Peripeteia tutor adaptation asks whether the tutor visibly changed mechanism after pressure. Adaptive mechanism quality asks whether that new public device is fitted and usable, not just different. Recognition-contingent uptake is a secondary closure axis after a learner reframe. New axes show n/a for older scorer artifacts. <span class="score-xref">Each axis is defined in the <a href="/rubric">poetics rubric &rarr;</a>; the dramatic-form vocabulary lives in the <a href="/ontology">ontology atlas &rarr;</a>.</span></div>' +
      '<table class="score-table"><thead><tr><th>Critic</th><th>Form</th><th>Origin</th><th>Learner reframe (LLM)</th><th>Actional breakthrough (LLM)</th><th>Peripeteia tutor adaptation (LLM)</th><th>Adaptive mechanism quality (LLM)</th><th>Recognition-contingent uptake (LLM)</th><th>Insight</th><th>Pivot</th><th>Evidence</th></tr></thead><tbody>' +
      detail.scores.map((s) => {
        const role = s.roleScores || {};
        const evidence = [
          role.learnerSelfReframeEvidence ? 'learner: ' + role.learnerSelfReframeEvidence : '',
          role.learnerActionalBreakthroughEvidence ? 'action: ' + role.learnerActionalBreakthroughEvidence : '',
          role.tutorStrategyReversalEvidence ? 'mechanism: ' + role.tutorStrategyReversalEvidence : '',
          role.tutorAdaptiveMechanismQualityEvidence ? 'quality: ' + role.tutorAdaptiveMechanismQualityEvidence : '',
          role.tutorContingentAdaptationEvidence ? 'tutor: ' + role.tutorContingentAdaptationEvidence : '',
          s.stated_insight_evidence ? 'insight: ' + s.stated_insight_evidence : '',
        ].filter(Boolean).join(' / ');
        const origin = scoreOrigin(s);
        return '<tr><td>' + esc(s.critic_model) + '</td><td>' + esc(s.form_class) + '</td><td>' +
          esc(origin.class || 'none') + '</td><td>' +
          esc(scoreOrNA(role.learnerSelfReframeScore)) + '</td><td>' +
          esc(scoreOrNA(role.learnerActionalBreakthroughScore)) + '</td><td>' +
          esc(scoreOrNA(role.tutorStrategyReversalScore)) + '</td><td>' +
          esc(scoreOrNA(role.tutorAdaptiveMechanismQualityScore)) + '</td><td>' +
          esc(scoreOrNA(role.tutorContingentAdaptationScore)) + '</td><td>' +
          esc(scoreOrNA(s.stated_insight)) + '</td><td>' + esc(s.pivot_learner_turn ?? 'n/a') +
          '</td><td class="evidence-cell">' + esc(evidence) + '</td></tr>';
      }).join('') +
      '</tbody></table>' + adaptationHtml;
  } else {
    pane.innerHTML =
      '<pre>' +
      esc(
        JSON.stringify(
          {
            item: detail.item,
            consensus: detail.consensus,
            labels: detail.labels,
            reviewFlags: detail.reviewFlags,
            tutorAdaptation: detail.tutorAdaptation,
            originDiagnostics: detail.originDiagnostics,
            endingShapeDiagnostics: detail.endingShapeDiagnostics,
          },
          null,
          2,
        ),
      ) +
      '</pre>';
  }
}

function renderLabelPanel(current) {
  const selected = state.selectedLabel || current.form_class || '';
  const button = (form, label) =>
    '<button class="label-choice' + (selected === form ? ' active' : '') + '" data-label="' + form + '">' + label + '</button>';
  return '<div class="label-panel">' +
    '<div class="label-rubric">' +
    '<strong>Form label.</strong> Recognition means a later learner turn re-reads the learner\\'s own earlier turn. ' +
    'Trap means no re-reading, but an insight declaration. Flat means neither.' +
    '</div>' +
    '<div class="label-buttons">' +
    button('recognition', 'Recognition') + button('trap', 'Trap') + button('flat', 'Flat') +
    '</div>' +
    '<div class="label-fields">' +
    '<label><span class="sub">Pivot learner turn</span><input id="pivotInput" type="number" min="1" value="' + esc(current.pivot_learner_turn || '') + '"></label>' +
    '<label><span class="sub">Rationale</span><textarea id="rationaleInput">' + esc(current.rationale || '') + '</textarea></label>' +
    '<button id="saveLabel">Save Label</button>' +
    '</div>' +
    '<div id="labelStatus" class="sub">' + (current.form_class ? 'Current label: ' + esc(current.form_class) : 'No label saved yet.') + '</div>' +
    '</div>';
}

function wireLabelPanel() {
  document.querySelectorAll('.label-choice').forEach((button) => button.addEventListener('click', () => {
    state.selectedLabel = button.dataset.label;
    renderPane();
  }));
  const save = el('saveLabel');
  if (!save) return;
  save.addEventListener('click', async () => {
    const status = el('labelStatus');
    if (!state.selectedLabel) {
      status.textContent = 'Choose recognition, trap, or flat before saving.';
      return;
    }
    if (!state.labeller) {
      status.textContent = 'Enter a labeller id in the sidebar.';
      return;
    }
    status.textContent = 'Saving...';
    try {
      const saved = await postJson('/api/labels', {
        itemId: state.detail.item.id,
        labellerId: state.labeller,
        formClass: state.selectedLabel,
        pivotLearnerTurn: el('pivotInput').value,
        rationale: el('rationaleInput').value,
      });
      state.detail = saved.detail;
      status.textContent = 'Saved.';
      renderPane();
      await loadItems();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

async function loadItems() {
  const params = new URLSearchParams();
  if (state.runIds.length) params.set('runIds', state.runIds.join(','));
  else if (el('runSelect').value) params.set('runId', el('runSelect').value);
  if (el('searchInput').value) params.set('q', el('searchInput').value);
  if (state.queue) params.set('queue', state.queue);
  if (state.unlabelled) params.set('unlabelled', '1');
  if (el('disciplineSelect') && el('disciplineSelect').value) params.set('discipline', el('disciplineSelect').value);
  if (state.blind) {
    params.set('blind', '1');
  } else {
    if (el('roleSelect').value) params.set('role', el('roleSelect').value);
    if (el('formSelect').value) params.set('form', el('formSelect').value);
  }
  const data = await getJson('/api/items?' + params.toString());
  state.items = data.items;
  renderItems();
  if (state.initialItemId) {
    const itemId = state.initialItemId;
    state.initialItemId = '';
    await selectItem(itemId);
    return;
  }
  if (!state.selected && state.items[0]) await selectItem(state.items[0].id);
}

async function selectItem(id) {
  state.selected = id;
  state.selectedLabel = null;
  const params = new URLSearchParams({ id });
  if (state.blind) {
    params.set('blind', '1');
    if (state.labeller) params.set('labeller', state.labeller);
  }
  state.detail = await getJson('/api/item?' + params.toString());
  renderItems();
  renderDetailHead();
  renderPane();
}

function initTheme() {
  const btn = el('themeToggle');
  let theme = 'light';
  try {
    const stored = localStorage.getItem('poetics-browser-theme');
    if (stored === 'dark' || stored === 'light') theme = stored;
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch (_) {}
  applyTheme(theme);
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = document.body.getAttribute('data-theme') || 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  const btn = el('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('poetics-browser-theme', theme); } catch (_) {}
}
function setBeacon(state, text) {
  const beacon = el('railBeacon');
  const label = el('railBeaconText');
  if (beacon) beacon.setAttribute('data-state', state);
  if (label) label.textContent = text;
}

async function init() {
  initTheme();
  setBeacon('checking', 'checking');
  let runs;
  try {
    runs = await getJson('/api/runs');
  } catch (err) {
    setBeacon('offline', 'offline');
    throw err;
  }
  state.runs = runs.runs;
  const discSel = el('disciplineSelect');
  if (discSel)
    discSel.innerHTML =
      '<option value="">all disciplines</option>' +
      (runs.disciplines || []).map((d) => '<option value="' + esc(d) + '">' + esc(d) + '</option>').join('');
  setBeacon('live', 'live · ' + state.runs.length + ' run' + (state.runs.length === 1 ? '' : 's'));
  const url = new URL(window.location.href);
  state.blind = url.searchParams.get('mode') === 'label' || url.searchParams.get('blind') === '1';
  state.labeller = (url.searchParams.get('labeller') || '').replace(/[^\\w-]/g, '');
  state.flagger = (url.searchParams.get('flagger') || 'codex').replace(/[^\\w-]/g, '') || 'codex';
  state.queue = (url.searchParams.get('queue') || '').replace(/[^\\w-]/g, '');
  state.runIds = (url.searchParams.get('runIds') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  state.unlabelled = url.searchParams.get('unlabelled') === '1';
  state.initialItemId = url.searchParams.get('itemId') || url.searchParams.get('id') || '';
  const requestedTab = url.searchParams.get('tab') || url.searchParams.get('view') || '';
  if (['preview', 'sample', 'full', 'scores', 'meta'].includes(requestedTab)) state.tab = requestedTab;
  // Seed the critic-form filter from ?form= so the dashboard Signal chart can
  // deep-link straight into one form-class (e.g. /browse?form=recognition).
  // loadItems() reads formSelect.value, so set the control before the first load.
  const requestedForm = url.searchParams.get('form') || '';
  if (['recognition', 'trap', 'flat'].includes(requestedForm) && el('formSelect')) el('formSelect').value = requestedForm;
  document.body.classList.toggle('blind', state.blind);
  if (state.blind) {
    el('appTitle').textContent = 'Poetics Human Scoring';
    el('appSub').textContent = state.queue === 'review' || state.queue === 'flagged'
      ? 'Blind flagged-case labelling. Critic scores, flag reasons, and held-out keys are hidden.'
      : state.queue === 'disagreements'
        ? 'Blind disagreement-case labelling. Critic scores and held-out keys are hidden.'
        : state.queue === 'adaptation-failures'
          ? 'Blind adaptation-failure labelling. Critic scores and held-out keys are hidden.'
        : 'Blind public-script labelling. Critic scores and held-out keys are hidden.';
    el('searchInput').placeholder = 'Filter by neutral script id';
    el('labellerInput').value = state.labeller;
  } else {
    el('labellerInput').style.display = 'none';
    if (state.queue === 'adaptation-failures') {
      el('appSub').textContent = 'Adaptive-arm debugging queue: cases where consensus, quality gates, or tutor-adaptation sidecars flag a weak public mechanism shift.';
    }
  }
  renderRuns();
  const runId = url.searchParams.get('runId');
  if (runId && !state.runIds.length) el('runSelect').value = runId;
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === state.tab));
  await loadItems();
  ['runSelect', 'roleSelect', 'formSelect', 'disciplineSelect'].forEach((id) => el(id).addEventListener('change', () => { state.selected = null; loadItems(); }));
  el('labellerInput').addEventListener('input', () => { state.labeller = el('labellerInput').value.replace(/[^\\w-]/g, ''); if (state.selected) selectItem(state.selected); });
  el('searchInput').addEventListener('input', () => { clearTimeout(window.__q); window.__q = setTimeout(() => { state.selected = null; loadItems(); }, 160); });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    state.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    renderPane();
  }));
  el('pane').addEventListener('click', (e) => {
    const btn = e.target.closest('.vt-btn');
    if (!btn) return;
    state.previewMode = btn.dataset.view === 'swimlane' ? 'swimlane' : 'script';
    renderPane();
  });
  window.TranscriptTts.bind(el('pane'));
}
init().catch((err) => { el('items').innerHTML = '<div class="empty">' + esc(err.message) + '</div>'; });
</script>
</body>
</html>`;
}

function launchUrl(args) {
  const params = new URLSearchParams();
  if (args.runId) params.set('runId', args.runId);
  const query = params.toString();
  return `http://${args.host}:${args.port}${query ? `/?${query}` : ''}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const app = createPoeticsBrowserApp({ dbPath: args.dbPath, host: args.host });
  const server = app.listen(args.port, args.host, () => {
    const url = launchUrl(args);
    console.log(`poetics script browser: ${url}`);
    if (args.open) exec(`open ${JSON.stringify(url)}`);
  });
  const close = () => {
    app.locals.db?.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(1);
  }
}

export {
  corpusStats,
  createPoeticsBrowserApp,
  endingShapeDiagnosticsForScores,
  originDiagnosticsForScores,
  getBlindItem,
  getItem,
  listItems,
  listRuns,
  normalizeTtsRequest,
  parseTranscriptPreview,
  renderBrowserHtml,
  renderDashboardHtml,
  renderDerivationLogicVisualizer,
  renderOntologyHtml,
  renderRubricHtml,
  saveBrowserLabel,
  saveBrowserReviewFlag,
  synthesizeLemonFoxSpeech,
  TTS_ROLE_VOICE,
};
