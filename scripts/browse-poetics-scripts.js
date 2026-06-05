#!/usr/bin/env node
/**
 * Browser for generated poetics teaching scripts.
 *
 * Reads the poetics sidecar tables, not evaluation_results. Use
 * scripts/ingest-poetics-artifacts.js first when a new artifact root is added.
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { openPoeticsStore, upsertPoeticsLabel, upsertPoeticsReviewFlag } from '../services/poeticsStore.js';
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
  buildMockDeps as liveBuildMockDeps,
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
  if (normalized.startsWith('TUTOR')) return 'tutor';
  if (normalized.startsWith('LEARNER')) return 'learner';
  if (normalized.includes('SUPEREGO') || normalized.includes('EGO')) return 'internal';
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

function createPoeticsBrowserApp({ dbPath = null } = {}) {
  const db = openPoeticsStore(dbPath || undefined);
  const app = express();
  app.use(express.json({ limit: '64kb' }));
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
  app.get('/compose', (_req, res) => res.type('html').send(renderComposeHtml()));
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
      const out = await liveHumanTurn(body.id, body.text, deps);
      return res.json(out);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.get('/api/compose/live/:id', (req, res) => {
    try {
      return res.json({ session: liveViewSession(req.params.id) });
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
  app.get('/arc', (_req, res) => {
    const arcPath = path.resolve(ROOT, 'notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html');
    if (!fs.existsSync(arcPath)) return res.status(404).type('text').send('arc note not found');
    res.type('html').sendFile(arcPath);
  });
  app.get('/browse', (_req, res) => res.type('html').send(renderBrowserHtml()));
  app.get('/', (req, res) => {
    // Deep links from before the browser moved to /browse (e.g. /?runId=…,
    // /?itemId=…) still arrive at /. Preserve them by forwarding the query.
    const keys = Object.keys(req.query || {});
    if (keys.length) {
      const qs = new URLSearchParams(req.query).toString();
      return res.redirect(302, '/browse' + (qs ? '?' + qs : ''));
    }
    const stats = { ...corpusStats(db), replays: listReplayBundles().length };
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
  personas: ['struggling_anxious', 'confused_novice', 'eager_explorer', 'focused_achiever', 'adversarial_tester'],
  learnerArch: ['ego_superego_recognition_authentic', 'ego_superego_recognition', 'ego_superego', 'unified'],
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

const composeDatalist = (id, list) =>
  `<datalist id="${id}">${list.map((v) => `<option value="${escapeHtml(v)}"></option>`).join('')}</datalist>`;

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

// Single source of truth for the top nav. Every page already ships identical
// .rail*/.rail__btn CSS, so this stays markup-only; the active link gets
// aria-current + an inline accent (theme vars exist on every page) so no page
// needs a bespoke active-state rule. Replaces five hand-maintained, divergent rails.
function railHtml({ active = '', brand = 'machine spirits', sub = '', extra = '' } = {}) {
  const NAV = [
    ['home', '/', 'home', 'Dashboard — overview, live stats &amp; guided first steps'],
    ['browse', '/browse', 'browse', 'Browse generated scripts, full traces, critic scores &amp; labels'],
    ['compose', '/compose', 'compose', 'Assemble a drama-machine spec, validated live against the ontology'],
    ['ontology', '/ontology', 'ontology', 'The shared ontology — system, tutor &amp; learner lenses'],
    ['rubric', '/rubric', 'rubric', 'The poetics rubric — the 6 dramatic-form dimensions critics score against'],
    ['replays', '/replays', 'replays', 'Counterfactual replays diffed against their originals'],
    ['runs', '/runs', 'runs', 'Launch runs — generative · replay · adversarial-CLI · online scoring'],
  ];
  const links = NAV.map(([key, href, label, title]) => {
    const on = key === active;
    const attrs = on
      ? ' aria-current="page" style="color:var(--moss-deep);border-color:var(--moss);background:var(--moss-soft)"'
      : '';
    return `<a class="rail__btn" href="${href}" title="${title}"${attrs}>${label}</a>`;
  }).join('\n    ');
  return `<header class="rail">
  <div class="rail__inner">
    <span class="rail__brand">${brand}</span>
    <span class="rail__sub">${sub}</span>
    ${links}
    <a class="rail__arc" href="/arc" title="The dramatic-recognition arc synthesis note"><span>arc</span><span aria-hidden="true">→</span></a>
    ${extra}<button class="rail__btn" id="themeToggle" type="button">theme</button>
  </div>
</header>`;
}

// ── Shared page chrome ────────────────────────────────────────────────────────
// One source of truth for the theme tokens, resets, and the rail (nav) styling
// that every dashboard page shares. Before this, each render*Html() inlined its
// own copy of these ~13 lines and they had quietly drifted (e.g. body
// line-height 1.6 vs 1.5). Centralising them here means the rail/menu looks
// identical across home · compose · ontology · rubric · replays · runs, and any
// future chrome change is a one-line edit. Page-specific CSS is passed in via
// `css`. (The richer /browse page predates this and keeps its own bespoke
// chrome — levelling the others up to it is the polish pass, not this refactor.)
const BASE_CSS = `:root{ color-scheme: light dark; --paper:#F4EEDD; --paper-2:#ECE3CB; --paper-3:#F8F2E2; --paper-4:#FBF6E8; --ink:#14100C; --ink-2:#2C241B; --ink-3:#5C5040; --ink-4:#8C7E6A; --linen:#D8C7A9; --moss:#56683A; --moss-deep:#3A4824; --moss-soft:#E3E6CE; --brick:#A53E2E; --brick-d:#7C2C1F; --brick-soft:#F3DDD6; --ochre:#C08A3E; --ochre-d:#8C5F1F; --ochre-soft:#F5E6C2; --indigo:#5A6797; --indigo-soft:#E2E5F0; --rule:rgba(28,22,16,.18); --rule-soft:rgba(28,22,16,.10); }
[data-theme="dark"]{ --paper:#14100C; --paper-2:#1B1612; --paper-3:#1F1A14; --paper-4:#221C16; --ink:#F4EEDD; --ink-2:#E0D8C3; --ink-3:#B9AD96; --ink-4:#8C7E6A; --linen:#3A322A; --moss:#8DA868; --moss-deep:#B5CD92; --moss-soft:#2C3520; --brick:#E36953; --brick-d:#F08A75; --brick-soft:#3A1C16; --ochre:#E6B265; --ochre-d:#F3CB88; --ochre-soft:#3A2C12; --indigo:#98A6D4; --indigo-soft:#1F2434; --rule:rgba(244,238,221,.18); --rule-soft:rgba(244,238,221,.08); }
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{ background:var(--paper); color:var(--ink); font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif; }
em{ font-style:italic; }
code,pre{ font-family: ui-monospace,'SF Mono',Menlo,monospace; }
.rail{ position:sticky; top:0; z-index:10; background:var(--paper-3); border-bottom:1px solid var(--rule); }
.rail__inner{ display:flex; align-items:center; gap:14px; padding:10px 18px; }
.rail__brand{ font-family:Georgia,serif; font-style:italic; font-size:18px; color:var(--moss-deep); }
.rail__sub{ color:var(--ink-3); font-size:12px; flex:1; }
.rail__arc,.rail__btn{ display:inline-flex; align-items:center; gap:6px; font:12px ui-monospace,monospace; text-decoration:none; color:var(--ink-2); border:1px solid var(--rule); padding:5px 10px; background:var(--paper-4); cursor:pointer; }
.rail__arc{ color:#fff; background:var(--brick); border-color:var(--brick-d); }
[data-theme="dark"] .rail__arc{ color:var(--paper); }`;

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
    disciplines: [],
    ...stats,
  };
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const disciplines = s.disciplines || [];
  const disciplineChips = disciplines.length
    ? disciplines
        .map((d) => {
          const label = escapeHtml(String(d.name).replace(/_/g, ' '));
          const href = '/browse?discipline=' + encodeURIComponent(d.name);
          return `<a class="chip" href="${href}"><span>${label}</span><span class="chip__n">${fmt(d.n)}</span></a>`;
        })
        .join('')
    : '<span class="muted">no disciplines tagged yet — generate a run to populate the corpus</span>';

  const statCell = (n, label) =>
    `<div class="stat"><div class="stat__n">${fmt(n)}</div><div class="stat__l">${label}</div></div>`;
  const statStrip = [
    statCell(s.scripts, 'scripts'),
    statCell(s.runs, 'runs'),
    statCell(disciplines.length, 'disciplines'),
    statCell(s.scores, 'critic scores'),
    statCell(s.critics, 'critics'),
    statCell(s.replays, 'replays'),
  ].join('');
  const statSub =
    `${fmt(s.scored)} of ${fmt(s.scripts)} scripts scored · ${fmt(s.labels)} human labels · ` +
    (s.openFlags
      ? `<strong class="flag">${fmt(s.openFlags)} open review flag${s.openFlags === 1 ? '' : 's'}</strong>`
      : '0 open review flags');

  const RUNGS = [
    [
      1,
      'Read a finished drama',
      'Open the browser and read one generated script end to end — a tutoring dialogue staged as a short play, turn by turn.',
      '/browse',
      'browse',
    ],
    [
      2,
      'Learn the shared vocabulary',
      'Open the ontology to see the terms the whole system reasons in — moves, agencies, recognition — through system, tutor &amp; learner lenses.',
      '/ontology',
      'ontology',
    ],
    [
      3,
      'Compose your own spec',
      'Assemble a drama-machine spec in the composer; it validates live against the ontology as you build the turn plan.',
      '/compose',
      'compose',
    ],
    [
      4,
      'Stage a run',
      'Launch a generation from the runs console — free/mock by default, with every cost class shown before you ever commit a paid call.',
      '/runs',
      'runs',
    ],
    [
      5,
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

  const ACTS = [
    [
      'act--moss',
      'Understand',
      [
        [
          'Browse scripts',
          'Every generated drama with its full trace, critic scores &amp; human labels — filter by run, discipline or free text.',
          '/browse',
          'open browser',
        ],
        [
          'Ontology atlas',
          'The shared TBox the system reasons in, projected into system, tutor &amp; learner lenses with the raw rules per module.',
          '/ontology',
          'open atlas',
        ],
      ],
    ],
    [
      'act--ochre',
      'Create',
      [
        [
          'Drama composer',
          'Assemble an Aristotelian spec — mythos, ethos, turn plan — validated live against the poetics ontology as you go.',
          '/compose',
          'open composer',
        ],
        [
          'Runs console',
          'Launch generative · replay · adversarial-CLI · online-scoring runs, with cost classes shown and a dry-run default.',
          '/runs',
          'open console',
        ],
      ],
    ],
    [
      'act--indigo',
      'Recognize',
      [
        [
          'Replays',
          'Counterfactual revisions diffed against their originals — see where one changed move reshapes the recognition.',
          '/replays',
          'open replays',
        ],
        [
          'The arc',
          'The synthesis note tracing the whole dramatic-recognition arc, from the paper through to this workbench.',
          '/arc',
          'read the arc',
        ],
      ],
    ],
  ];
  const actsHtml = ACTS.map(
    ([cls, name, cards]) => `
      <section class="act ${cls}">
        <h3 class="act__h">${name}</h3>
        <div class="act__cards">
          ${cards
            .map(
              ([t, d, href, cta]) =>
                `<a class="card" href="${href}"><div class="card__t">${t}</div><div class="card__d">${d}</div><div class="card__cta">${cta} →</div></a>`,
            )
            .join('')}
        </div>
      </section>`,
  ).join('');

  return `${pageHead({
    title: 'machine spirits · poetics workbench',
    css: `
.wrap{ max-width:1080px; margin:0 auto; padding:0 22px 64px; }
.welcome{ margin:18px 0 0; border:1px solid var(--moss); background:var(--moss-soft); padding:16px 18px; }
.welcome__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--moss-deep); }
.welcome h2{ margin:7px 0 6px; font:italic 22px/1.2 Georgia,serif; color:var(--ink); }
.welcome p{ margin:0; color:var(--ink-2); max-width:66ch; }
.welcome__btns{ display:flex; gap:10px; margin-top:13px; flex-wrap:wrap; }
.hero{ padding:40px 0 10px; }
.hero__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-4); }
.hero h1{ margin:10px 0 12px; font:italic 40px/1.05 Georgia,serif; color:var(--ink); }
.hero p{ margin:0 0 20px; font-size:16px; color:var(--ink-2); max-width:70ch; }
.hero__cta{ display:flex; gap:12px; flex-wrap:wrap; }
.btn{ display:inline-flex; align-items:center; gap:7px; font:13px ui-monospace,monospace; text-decoration:none; cursor:pointer; border:1px solid var(--rule); background:var(--paper-4); color:var(--ink); padding:9px 15px; }
.btn.primary{ background:var(--moss-deep); color:var(--paper); border-color:var(--moss-deep); }
.btn.ghost{ background:transparent; }
.stats{ display:grid; grid-template-columns:repeat(6,1fr); gap:1px; background:var(--rule); border:1px solid var(--rule); margin:30px 0 8px; }
@media(max-width:760px){ .stats{ grid-template-columns:repeat(3,1fr); } .hero h1{ font-size:32px; } }
.stat{ background:var(--paper-4); padding:16px 14px; }
.stat__n{ font:600 26px/1 Georgia,serif; color:var(--moss-deep); }
.stat__l{ font:11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-4); margin-top:8px; }
.stats__sub{ font:12px/1.6 ui-monospace,monospace; color:var(--ink-4); margin:0 0 30px; }
.stats__sub .flag{ color:var(--brick-d); }
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
.acts{ display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
@media(max-width:820px){ .acts{ grid-template-columns:1fr; } }
.act{ border:1px solid var(--rule); background:var(--paper-3); border-top:3px solid var(--ink-4); }
.act--moss{ border-top-color:var(--moss); }
.act--ochre{ border-top-color:var(--ochre); }
.act--indigo{ border-top-color:var(--indigo); }
.act__h{ margin:0; padding:12px 14px 4px; font:italic 18px Georgia,serif; color:var(--ink); }
.act__cards{ padding:6px 12px 13px; display:flex; flex-direction:column; gap:8px; }
.card{ display:block; text-decoration:none; border:1px solid var(--rule); background:var(--paper-4); padding:11px 12px; }
.card:hover{ border-color:var(--ink-3); }
.card__t{ font:600 13px/1.3 -apple-system,system-ui,sans-serif; color:var(--ink); }
.card__d{ color:var(--ink-3); font-size:12px; margin:4px 0 8px; }
.card__cta{ font:11px ui-monospace,monospace; color:var(--moss-deep); }
.reflect{ margin-top:46px; border:1px dashed var(--rule); background:var(--paper-3); padding:18px 20px; }
.reflect__k{ font:600 11px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.08em; color:var(--ochre-d); }
.reflect h3{ margin:9px 0 13px; font:italic 19px Georgia,serif; color:var(--ink); }
.reflect ul{ margin:0; padding:0; list-style:none; display:grid; gap:11px; }
.reflect li{ color:var(--ink-2); font-size:13px; max-width:80ch; padding-left:14px; border-left:2px solid var(--rule); }
.reflect li b{ color:var(--moss-deep); }
.muted{ color:var(--ink-4); font-style:italic; }
.foot{ margin-top:32px; color:var(--ink-4); font:11px ui-monospace,monospace; }
`,
  })}
<body>
${railHtml({ active: 'home', brand: 'machine spirits', sub: 'a drama-machine for tutoring — generate · score · recognize' })}
<div class="wrap">

  <div class="welcome" id="welcome" hidden>
    <div class="welcome__k">new here · welcome</div>
    <h2>First time at the workbench?</h2>
    <p>This is a research instrument that stages tutoring dialogues as <em>drama</em> and reads them the way a literary critic would — for dramatic form, not for what is in anyone's head. You don't need to know the codebase. The five-step tour below walks the whole surface; take it at your own pace.</p>
    <div class="welcome__btns">
      <button class="btn primary" id="welcomeBegin" type="button">begin the tour ↓</button>
      <button class="btn ghost" id="welcomeDismiss" type="button">I'll explore on my own</button>
    </div>
  </div>

  <header class="hero">
    <div class="hero__k">machine spirits · poetics workbench</div>
    <h1>Tutoring, staged as drama.</h1>
    <p>Generate tutoring dialogues that turn on a <em>peripeteia</em> — a reversal of understanding — score them as a literary critic would on dramatic form, and study where recognition does and doesn't cohere. Browse what's been made, compose something new, or replay a single changed move.</p>
    <div class="hero__cta">
      <a class="btn primary" href="/browse">Read a script →</a>
      <a class="btn ghost" href="/compose">Compose one →</a>
    </div>
  </header>

  <div class="stats">${statStrip}</div>
  <p class="stats__sub">${statSub}</p>

  <p class="chips__lead">The corpus spans ${disciplines.length} field${disciplines.length === 1 ? '' : 's'} — jump straight into one:</p>
  <div class="chips">${disciplineChips}</div>

  <h2 class="section">Start here · a five-step tour</h2>
  <p class="section__sub">Each step assumes only the one before it. Tick what you already know; your progress is remembered on this device.</p>
  <div class="ladder" id="ladder">
    <div class="ladder__head">
      <div class="prog"><div class="prog__fill" id="progFill"></div></div>
      <span class="prog__label" id="progLabel">not started</span>
      <a class="ladder__reset" id="resetTour" href="#">reset</a>
    </div>
    ${rungsHtml}
  </div>

  <h2 class="section">Everything, in three acts</h2>
  <p class="section__sub">The workbench falls into the shape it studies: understand the material, create something new, recognize what changed.</p>
  <div class="acts">${actsHtml}</div>

  <div class="reflect">
    <div class="reflect__k">applying our own lessons</div>
    <h3>This workbench is built from the pedagogy it studies.</h3>
    <ul>
      <li><b>Recognition.</b> It greets a first-time visitor and names where they are before instructing — the mutual recognition the tutor is asked to extend the learner.</li>
      <li><b>Scaffolding.</b> The tour is a zone-of-proximal-development ladder: one rung at a time, you set the pace, and you can mark what you already command.</li>
      <li><b>Dramatic form.</b> The features group into three acts — understand, create, recognize — the arc of an <em>anagnorisis</em>, the same shape the critic looks for in a script.</li>
    </ul>
  </div>

  <p class="foot">machine spirits · poetics — localhost workbench · read-only dashboard</p>
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
  var wb = $('welcomeBegin'); if (wb) wb.addEventListener('click', function(){ dismissWelcome(); var l = $('ladder'); if (l) l.scrollIntoView({ behavior:'smooth', block:'start' }); });

  var TOTAL = 5;
  function isDone(n){ try { return localStorage.getItem('poetics-rung-'+n)==='1'; } catch (_e) { return false; } }
  function setDone(n, v){ try { localStorage.setItem('poetics-rung-'+n, v ? '1' : '0'); } catch (_e) {} }
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
section.sec{ border:1px solid var(--rule); background:var(--paper-4); }
.sec > h3{ margin:0; padding:9px 12px; font:600 12px/1 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.06em; color:var(--ink-2); background:var(--paper-2); border-bottom:1px solid var(--rule); }
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
${MODETABS_CSS}
`,
  })}
<body>
${railHtml({ active: 'compose', brand: 'drama composer', sub: 'assemble a drama-machine spec · validated live against the poetics ontology' })}
${modeTabsHtml('spec')}
<div class="compose">
  <form class="cform" id="cform" onsubmit="return false">
    <section class="sec"><h3>Drama · mythos / melos</h3><div class="body">
      <label class="fld">id<input type="text" id="d-id" value="D_LOG_PERIPETEIA_1"></label>
      <label class="fld">max_turns<input type="number" id="d-maxturns" min="1" value="7"></label>
      <label class="fld wide">topic<input type="text" id="d-topic" value="logarithms as the inverse of exponentiation"></label>
      <label class="fld wide">hamartia — the misconception that drives the plot<input type="text" id="d-hamartia" value="treats log(a+b) as log a + log b"></label>
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
    <section class="sec"><h3>Thought &amp; diction · dianoia / lexis</h3><div class="body">
      <label class="fld">pedagogical_approach<input type="text" id="d-pedagogical" value="socratic_elenchus"></label>
      <label class="fld">dialogue_approach<input type="text" id="d-dialogue" value="aristotelian_reversal"></label>
      <label class="fld wide">voice.register<input type="text" id="v-register" value="plain; the learner a little defensive"></label>
    </div></section>
    <section class="sec"><h3>Spectacle · opsis</h3><div class="body">
      <label class="fld wide">scene.setting<input type="text" id="s-setting" value="a library tutoring booth, the evening before a quiz"></label>
      <label class="fld">relationship<input type="text" id="s-relationship" value="a paid tutor and a resentful teenager"></label>
      <label class="fld">stakes<input type="text" id="s-stakes" value="the quiz is tomorrow morning"></label>
      <label class="fld">opening_speaker<select id="s-open">${composeOptions(V.speakers, 'learner')}</select></label>
      <label class="fld">ending_speaker<select id="s-end">${composeOptions(V.speakers, 'learner')}</select></label>
      <label class="fld wide">object<input type="text" id="s-object" value="a half-finished worksheet with log(a+b) = log a + log b circled"></label>
      <label class="fld">stage_direction_policy<select id="s-stagepolicy">${composeOptions(V.stagePolicy, 'short')}</select></label>
      <label class="fld">stage_direction_style<select id="s-stagestyle">${composeOptions(V.stageStyle, 'object_business')}</select></label>
    </div></section>
    <section class="sec"><h3>Cast · who plays each role</h3><div class="body">
      <label class="fld">director<input type="text" id="c-director" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">tutor<input type="text" id="c-tutor" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">learner<input type="text" id="c-learner" list="castList" value="llm:api:sonnet"></label>
      <label class="fld">critic<input type="text" id="c-critic" list="castList" value="llm:api:gpt"></label>
      <label class="fld">default_backend<input type="text" id="c-backend" value="api"></label>
      <div class="muted" style="grid-column:1/-1">grammar: <code>human</code> · <code>llm:&lt;backend&gt;:&lt;model&gt;</code> · <code>mock</code> — backends claude · codex · gemini · api</div>
    </div></section>
    <section class="sec"><h3>Audience · critic config</h3><div class="body">
      <label class="fld wide">panel — comma-separated judge models<input type="text" id="a-panel" list="panelList" value="gpt, deepseek-v4-pro, qwen3.7-max, gemini-3.5-flash"></label>
      <label class="fld">consensus<input type="text" id="a-consensus" value="3-of-4"></label>
      <label class="fld">grading<select id="a-grading">${composeOptions(V.grading, 'graded')}</select></label>
      <label class="fld">blinding<select id="a-blinding">${composeOptions(V.blinding, 'arm-blind')}</select></label>
      <label class="fld">rubric<input type="text" id="a-rubric" value="poetics-v1.0"></label>
    </div></section>
    <section class="sec"><h3>Turn plan · per-turn adaptation moves</h3><div class="body one">
      <div id="turnPlan"></div>
      <div class="addbar"><button type="button" class="btn" id="addTurn">+ add turn</button><button type="button" class="btn" id="suggestTurn" title="Sample a valid turn from the ontology, conditioned on the tutor architecture (alter-egos)">✨ suggest a turn</button><span class="muted">⚠ anti-pattern moves are checked against the turn's target form by the ontology, live.</span></div>
    </div></section>
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
function renderTurns(){ $('turnPlan').innerHTML = turns.length ? turns.map(turnRowHtml).join('') : '<div class="muted">No turns. Add one.</div>'; }
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
  return `<nav class="modetabs" aria-label="compose mode">
    ${tab('spec', '/compose', '◐ Spec · batch', 'Assemble a full drama spec and write it as YAML for batch generation')}
    ${tab('live', '/compose/live', '● Live · sit-in', 'Sit in: you play one seat, the AI plays the other, turn by turn')}
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
@media (max-width:900px){ .live{ grid-template-columns:1fr; } }
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
`,
  })}
<body>
${railHtml({
  active: 'compose',
  brand: 'live compose',
  sub: 'sit in · you play one seat, the AI plays the other, turn by turn',
})}
${modeTabsHtml('live')}
<div class="live">
  <main class="stage">
    <section class="setup" id="setup">
      <div class="setup__head">
        <h2>Sit in on a scene</h2>
        <p class="setup__lede">Take one chair — Learner or Tutor — and the AI takes the other, driven by the same engines the scored runs use. Drive the tempo turn by turn, then save the transcript to run through the critics later.</p>
      </div>
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
      <div class="setgrid">
        <label class="fld wide">topic<input id="f-topic" type="text" value="logarithms as the inverse of exponentiation"></label>
        <label class="fld wide">hamartia — the misconception in play (optional)<input id="f-hamartia" type="text" value="treats log(a+b) as log a + log b"></label>
        <div class="grp" id="grpTutor">
          <label class="fld">AI tutor · prompt<select id="f-prompt">${composeOptions(['recognition', 'base'], 'recognition')}</select></label>
          <label class="fld">AI tutor · architecture<select id="f-tarch">${composeOptions(['ego_superego', 'ego_only'], 'ego_superego')}</select></label>
        </div>
        <div class="grp" id="grpLearner" hidden>
          <label class="fld">AI learner · persona<select id="f-persona">${composeOptions(V.personas, 'struggling_anxious')}</select></label>
          <label class="fld">AI learner · architecture<select id="f-larch">${composeOptions(V.learnerArch, 'ego_superego_recognition_authentic')}</select></label>
        </div>
        <label class="fld">opening speaker<select id="f-open">${composeOptions(['tutor', 'learner'], 'tutor')}</select></label>
        <label class="fld">max turns<input id="f-max" type="number" min="2" max="40" value="16"></label>
      </div>
      <label class="dry"><input type="checkbox" id="f-mock"> ✦ free preview — canned AI lines, no spend (logarithms demo)</label>
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
    <div class="lpanel"><div class="lpanel__h">spend</div><div class="lpanel__b"><div class="spend"><span class="spend__usd" id="spendUsd">$0.0000</span><span class="spend__sub" id="spendTok">0 tokens</span></div></div></div>
    <div class="lpanel"><div class="lpanel__h">save transcript</div><div class="lpanel__b lpanel__b--col">
      <input id="saveName" type="text" placeholder="filename (optional)">
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
var S = { id:null, mock:false, humanRole:'learner', aiRole:'tutor', status:'idle', nextSpeaker:null };

function pickSeat(role){
  S.humanRole = role; S.aiRole = role==='learner' ? 'tutor' : 'learner';
  $('seatLearner').classList.toggle('seat--on', role==='learner');
  $('seatTutor').classList.toggle('seat--on', role==='tutor');
  $('grpTutor').hidden = role!=='learner';
  $('grpLearner').hidden = role!=='tutor';
}
function autoGrow(el){ if(!el) return; el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,180)+'px'; }

async function postJson(url, body){
  var res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  var data = {}; try { data = await res.json(); } catch(_e){}
  if(!res.ok){ var err = new Error(data.error || res.statusText); Object.assign(err, data); throw err; }
  return data;
}
function whoLabel(role, by){ return role + ' · ' + (by==='human' ? 'you' : 'ai'); }

function renderSession(sess){
  S.id = sess.id; S.status = sess.status; S.nextSpeaker = sess.nextSpeaker;
  S.humanRole = sess.humanRole; S.aiRole = sess.aiRole;
  $('setup').classList.add('setup--min');
  $('transcript').hidden = false; $('liveside').hidden = false; $('composerForm').hidden = false;
  var html = '';
  sess.transcript.forEach(function(t){
    html += '<div class="line line--'+t.role+(t.by==='human'?' line--mine':'')+'">'
      + '<div class="who">'+esc(whoLabel(t.role, t.by))+'</div>'
      + '<div class="bubble">'+nl2br(t.text)+'</div></div>';
  });
  $('transcript').innerHTML = html || '<div class="t-empty">the stage is set — make the first move</div>';
  $('transcript').scrollTop = $('transcript').scrollHeight;
  var tok = (Number(sess.spend.inputTokens||0)+Number(sess.spend.outputTokens||0));
  $('spendUsd').textContent = '$'+Number(sess.spend.estimatedCostUsd||0).toFixed(4);
  $('spendTok').textContent = tok.toLocaleString()+' tokens · '+sess.turnCount+'/'+sess.maxTurns+' turns';
  $('sceneMeta').innerHTML = 'you are the <b>'+esc(sess.humanRole)+'</b><br>AI is the <b>'+esc(sess.aiRole)+'</b><br>'
    + (sess.aiRole==='tutor' ? ('cell <code>'+esc(sess.tutorCell)+'</code>') : ('persona <code>'+esc(sess.persona)+'</code>'))
    + (S.mock ? '<br><span class="metered--free">free preview</span>' : '');
  var done = sess.status!=='live';
  var yours = sess.nextSpeaker===sess.humanRole && !done;
  $('composerInput').disabled = !yours; $('sendBtn').disabled = !yours;
  if(done){ $('composerHint').innerHTML = 'scene ended ('+esc(sess.stoppedReason||sess.status)+') — save it, or reload to start another'; }
  else if(yours){ $('composerHint').innerHTML = '<kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline · you are the <b>'+esc(sess.humanRole)+'</b>'; setTimeout(function(){ $('composerInput').focus(); }, 0); }
  else { $('composerHint').textContent = 'the '+sess.aiRole+' is thinking…'; }
}
function appendOptimistic(text){
  var t = $('transcript');
  t.insertAdjacentHTML('beforeend',
    '<div class="line line--'+S.humanRole+' line--mine"><div class="who">'+esc(whoLabel(S.humanRole,'human'))+'</div><div class="bubble">'+nl2br(text)+'</div></div>'
    + '<div class="line line--'+S.aiRole+' line--ghost"><div class="who">'+esc(whoLabel(S.aiRole,'ai'))+'</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div></div>');
  t.scrollTop = t.scrollHeight;
}
async function refresh(){ try { var r = await fetch('/api/compose/live/'+S.id); var d = await r.json(); if(d.session) renderSession(d.session); } catch(_e){} }

async function begin(){
  $('setupErr').textContent=''; S.mock = $('f-mock').checked;
  var spec = { humanRole:S.humanRole, topic:$('f-topic').value, hamartia:$('f-hamartia').value,
    promptType:$('f-prompt').value, tutorArchitecture:$('f-tarch').value,
    persona:$('f-persona').value, learnerArchitecture:$('f-larch').value,
    openingSpeaker:$('f-open').value, maxTurns:Number($('f-max').value)||16 };
  $('beginBtn').disabled=true; $('beginBtn').textContent='setting the scene…';
  try { var r = await postJson('/api/compose/live/start', { spec:spec, mock:S.mock }); renderSession(r.session); }
  catch(e){ $('setupErr').textContent='could not start: '+(e.message||e); $('beginBtn').disabled=false; $('beginBtn').textContent='Begin the scene →'; }
}
async function send(){
  var text = $('composerInput').value.trim();
  if(!text || S.status!=='live') return;
  $('composerInput').disabled=true; $('sendBtn').disabled=true;
  appendOptimistic(text); $('composerHint').textContent='the '+S.aiRole+' is thinking…';
  try { var r = await postJson('/api/compose/live/turn', { id:S.id, text:text, mock:S.mock });
    $('composerInput').value=''; autoGrow($('composerInput')); renderSession(r.session); }
  catch(e){ $('composerHint').innerHTML='<span class="metered">turn failed: '+esc(e.message||String(e))+'</span>'; await refresh(); }
}
async function save(){
  if(!S.id) return; $('saveRes').textContent='saving…';
  try { var r = await postJson('/api/compose/live/save', { id:S.id, filename:$('saveName').value.trim() });
    $('saveRes').innerHTML='saved <code>'+esc(r.path)+'</code> · '+r.bytes+' bytes'; }
  catch(e){ $('saveRes').textContent='save failed: '+(e.message||e); }
}

$('seatLearner').addEventListener('click', function(){ pickSeat('learner'); });
$('seatTutor').addEventListener('click', function(){ pickSeat('tutor'); });
$('beginBtn').addEventListener('click', begin);
$('sendBtn').addEventListener('click', send);
$('saveBtn').addEventListener('click', save);
$('composerInput').addEventListener('input', function(){ autoGrow($('composerInput')); });
$('composerInput').addEventListener('keydown', function(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } });
$('f-mock').addEventListener('change', function(){
  var on = $('f-mock').checked;
  $('meterNote').textContent = on ? 'free preview · canned AI lines · no spend' : 'metered · real LLM calls per AI turn · localhost only';
  $('meterNote').classList.toggle('metered--free', on);
});
$('themeToggle').addEventListener('click', function(){ var d=document.documentElement; var nx=d.getAttribute('data-theme')==='dark'?'':'dark'; if(nx)d.setAttribute('data-theme','dark'); else d.removeAttribute('data-theme'); try{ localStorage.setItem('poetics-theme',nx); }catch(_e){} });
try { if(localStorage.getItem('poetics-theme')==='dark') document.documentElement.setAttribute('data-theme','dark'); } catch(_e){}
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
.blurb{ font-size:13px; color:var(--ink-3); border-left:3px solid var(--moss); background:var(--moss-soft); padding:8px 12px; margin-bottom:16px; }
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
${railHtml({ active: 'ontology', brand: 'ontology atlas', sub: 'the shared TBox · system-wide, and the tutor &amp; learner role projections' })}
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
.blurb{ font-size:13px; color:var(--ink-3); border-left:3px solid var(--moss); background:var(--moss-soft); padding:10px 14px; margin:0 0 18px; }
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
${railHtml({ active: 'rubric', brand: 'poetics rubric', sub: 'the 6 dramatic-form dimensions critics score against' })}
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
${railHtml({ active: 'replays', brand: 'discursive replays', sub: 'counterfactual revisions of public transcripts · diffed against the originals &amp; locally gated' })}
<div class="controls">
  <label>bundle <select id="bundleSel"></select></label>
  <span class="meta" id="bundleMeta"></span>
  <div class="spacer"></div>
  <span class="counts" id="counts"></span>
</div>
<div class="layout">
  <div class="list" id="list"><div class="loading">loading…</div></div>
  <div class="detail" id="detail"><div class="loading">pick an item on the left.</div></div>
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
${railHtml({ active: 'runs', brand: 'run launcher', sub: 'spawn generative · replay · adversarial-CLI · online-score runs — localhost only, no auth (deferred)' })}
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
  --paper:       #F4EEDD;
  --paper-2:     #ECE3CB;
  --paper-3:     #F8F2E2;
  --paper-4:     #FBF6E8;
  --ink:         #14100C;
  --ink-2:       #2C241B;
  --ink-3:       #5C5040;
  --ink-4:       #8C7E6A;
  --linen:       #D8C7A9;
  --moss:        #56683A;
  --moss-deep:   #3A4824;
  --moss-soft:   #E3E6CE;
  --brick:       #A53E2E;
  --brick-d:     #7C2C1F;
  --brick-soft:  #F3DDD6;
  --ochre:       #C08A3E;
  --ochre-d:     #8C5F1F;
  --ochre-soft:  #F5E6C2;
  --indigo:      #5A6797;
  --indigo-soft: #E2E5F0;
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
  --indigo:      #98A6D4;
  --indigo-soft: #1F2434;
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
.rail {
  position: sticky;
  top: 0;
  z-index: 30;
  background: color-mix(in srgb, var(--paper) 92%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--rule);
  font-family: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.rail__inner {
  display: flex;
  align-items: center;
  gap: 0.9em;
  padding: 0.55em clamp(0.8rem, 2vw, 1.2rem);
}
.rail__brand {
  font-family: "Fraunces", "Source Serif 4", Georgia, serif;
  font-style: italic;
  font-variation-settings: "SOFT" 50, "WONK" 1, "opsz" 96;
  font-size: 17px;
  letter-spacing: -0.005em;
  text-transform: none;
  color: var(--ink);
  flex: 0 0 auto;
}
.rail__brand::before {
  content: "▸ ";
  color: var(--brick);
  font-style: normal;
}
.rail__sub {
  flex: 1 1 auto;
  color: var(--ink-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rail__beacon {
  display: inline-flex;
  align-items: center;
  gap: 0.55em;
  padding: 0.3em 0.75em;
  border: 1px solid var(--rule);
  background: var(--paper-3);
  color: var(--ink-3);
  flex: 0 0 auto;
}
.rail__beacon[data-state="live"] {
  color: var(--moss-deep);
  border-color: color-mix(in srgb, var(--moss) 55%, var(--rule));
}
.rail__beacon[data-state="offline"] { color: var(--ink-3); }
.rail__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ink-4);
  flex: 0 0 auto;
}
.rail__beacon[data-state="checking"] .rail__dot {
  background: var(--ochre);
  animation: railPulse 1.2s var(--ease) infinite;
}
.rail__beacon[data-state="live"] .rail__dot {
  background: var(--moss);
  animation: railPulse 2.2s var(--ease) infinite;
}
@keyframes railPulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent); }
  70% { box-shadow: 0 0 0 7px color-mix(in srgb, currentColor 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 0%, transparent); }
}
.rail__btn {
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--ink-3);
  font: inherit;
  padding: 0.32em 0.8em;
  cursor: pointer;
  transition: color .15s var(--ease), border-color .15s var(--ease);
  flex: 0 0 auto;
}
.rail__btn:hover { color: var(--ink); border-color: var(--ink-3); }
.rail__arc {
  display: inline-flex;
  align-items: center;
  gap: 0.45em;
  padding: 0.4em 0.95em;
  background: var(--brick);
  color: var(--paper);
  border: 1px solid var(--brick);
  text-decoration: none;
  font-weight: 600;
  letter-spacing: 0.14em;
  flex: 0 0 auto;
  white-space: nowrap;
  transition: background .15s var(--ease), border-color .15s var(--ease), transform .15s var(--ease);
}
.rail__arc:hover {
  background: var(--brick-d);
  border-color: var(--brick-d);
  transform: translateY(-1px);
}
.rail__arc__arrow { font-weight: 400; font-size: 1.15em; line-height: 1; }

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
  .rail__brand { font-size: 14px; }
  .rail__inner { gap: 0.6em; padding: 0.45em 0.8em; }
  .rail__sub { display: none; }
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
})}
<div id="app" class="app">
  <aside class="sidebar">
    <div class="mast">
      <h1 id="appTitle">Poetics Script Browser</h1>
      <div id="appSub" class="sub">Generated public scripts, full traces, critic scores, and labels-as-perspective.</div>
    </div>
    <div class="filters">
      <select id="runSelect"></select>
      <input id="searchInput" placeholder="Search id · drama · discipline · condition · arm · critic form (recognition/trap/flat)">
      <select id="disciplineSelect"><option value="">all disciplines</option></select>
      <input id="labellerInput" class="blind-only" placeholder="Labeller id">
      <div class="filter-row score-only">
        <select id="roleSelect">
          <option value="">all roles</option>
          <option value="target">target</option>
          <option value="flat_control">flat controls</option>
          <option value="boundary_trap_control">boundary traps</option>
          <option value="hard_trap_control">hard traps</option>
        </select>
        <select id="formSelect">
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

function sceneCardHtml(block) {
  const type = block.type || 'other';
  const speech = block.speech || (type === 'stage' ? '' : block.raw || '');
  const blocking = block.blocking || (type === 'stage' ? block.raw || '' : '');
  const head = type === 'stage'
    ? '<div class="scene-head"><span class="speaker">STAGE DIRECTION</span><span class="turn-num">' + esc(String(block.index || '')) + '</span></div>'
    : '<div class="scene-head"><span class="speaker">' + esc(block.speaker || 'TEXT') + '</span><span class="turn-num">' + esc(String(block.index || '')) + '</span></div>';
  return '<section class="scene-card ' + esc(type) + '">' + head +
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
  return toggle + body;
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
    : 'Generate the first drama transcript to populate the workbench.';
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
  const app = createPoeticsBrowserApp({ dbPath: args.dbPath });
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
  parseTranscriptPreview,
  renderBrowserHtml,
  renderDashboardHtml,
  renderOntologyHtml,
  renderRubricHtml,
  saveBrowserLabel,
  saveBrowserReviewFlag,
};
