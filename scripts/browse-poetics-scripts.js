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
import { openPoeticsStore, upsertPoeticsLabel, upsertPoeticsReviewFlag } from '../services/poeticsStore.js';
import { classifyPoeticsConsensus, parseCriticFormString } from './lib/poeticsConsensus.js';
import { ORIGIN_CLASSES, originCounts, recognitionOriginForScoreRow } from './lib/recognitionOrigin.js';

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
  if (filters.role) {
    if (filters.role === 'target') where.push("i.unit_id LIKE 'target-%'");
    else {
      where.push('i.control_role = @role');
      params.role = filters.role;
    }
  }
  if (filters.q) {
    where.push(
      `(i.id LIKE @q OR i.tid LIKE @q OR i.drama_id LIKE @q OR i.discipline LIKE @q OR i.unit_id LIKE @q OR i.intended_lean LIKE @q)`,
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
  app.locals.db = db;
  app.get('/favicon.ico', (_req, res) => res.status(204).end());
  app.get('/api/runs', (_req, res) => res.json({ runs: listRuns(db) }));
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
  app.get('/arc', (_req, res) => {
    const arcPath = path.resolve(ROOT, 'notes/poetics/2026-05-26-paper-to-dramatic-recognition-arc.html');
    if (!fs.existsSync(arcPath)) return res.status(404).type('text').send('arc note not found');
    res.type('html').sendFile(arcPath);
  });
  app.get('/', (_req, res) => res.type('html').send(renderBrowserHtml()));
  return app;
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
<header class="rail">
  <div class="rail__inner">
    <span class="rail__brand">poetics</span>
    <span class="rail__sub" id="railSub">sidecar browser · public scripts, full traces, critic scores, labels as perspective</span>
    <span class="rail__beacon" id="railBeacon" data-state="checking" title="Sidecar database connection">
      <span class="rail__dot"></span>
      <span id="railBeaconText">checking</span>
    </span>
    <button class="rail__btn" id="themeToggle" type="button" aria-label="Toggle dark mode">theme</button>
  </div>
</header>
<div id="app" class="app">
  <aside class="sidebar">
    <div class="mast">
      <h1 id="appTitle">Poetics Script Browser</h1>
      <div id="appSub" class="sub">Generated public scripts, full traces, critic scores, and labels-as-perspective.</div>
    </div>
    <div class="filters">
      <select id="runSelect"></select>
      <input id="searchInput" placeholder="Filter by T id, drama id, unit, discipline">
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
};
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inlineEsc = (s) => esc(s).replace(/\\[([^\\]]+)\\]/g, '<span class="inline-aside">[$1]</span>');
const scoreOrNA = (value) => value == null || value === '' || Number.isNaN(Number(value)) ? 'n/a' : Number(value).toFixed(1);
const voteMetric = (count, total) => total ? count + '/' + total : 'n/a';
const boolOrNA = (value) => value == null ? 'n/a' : value ? 'true' : 'false';
const scoreOrigin = (score) => score?.metadata?.recognition_origin || score?.recognitionOrigin || { class: 'none' };

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
  return '/?' + params.toString();
}

function renderTranscriptPreview(blocks, fallbackText) {
  if (!blocks || blocks.length === 0) {
    return '<pre>' + esc(fallbackText || 'No public sample found.') + '</pre>';
  }
  return '<div class="script-preview">' + blocks.map((block) => {
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
  }).join('') + '</div>';
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
  select.innerHTML = state.runs.map((run, idx) =>
    '<option value="' + esc(run.id) + '"' + (idx === 0 ? ' selected' : '') + '>' +
    esc(run.id + ' · ' + run.itemCount + ' items · ' + run.scoreCount + ' scores' + (run.reviewFlagCount ? ' · ' + run.reviewFlagCount + ' flags' : '')) + '</option>'
  ).join('');
  if (state.runIds.length) {
    const label = state.runIds.join(', ');
    select.innerHTML = '<option value="">' + esc(label + ' · focused queue') + '</option>' + select.innerHTML;
    select.value = '';
    select.disabled = true;
  }
}

function renderItems() {
  const root = el('items');
  if (!state.items.length) {
    root.innerHTML = '<div class="empty">No scripts match the current filters.</div>';
    return;
  }
  root.innerHTML = state.items.map((item) => {
    const active = state.selected === item.id ? ' active' : '';
    if (state.blind) {
      return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
        '<div class="item-main"><span>' + esc(item.blindId || item.tid || 'script') + '</span><span>' + esc(item.tid || '') + '</span></div>' +
        '<div class="item-meta"><span>public transcript</span><span>' + esc(item.labelCount ? 'labelled' : 'unlabelled') + '</span>' +
        (item.reviewFlagCount ? '<span>review flagged</span>' : '') + '</div>' +
        '</button>';
    }
    const role = item.controlRole || (item.unitId || '').replace(/-.+$/, '');
    return '<button class="item' + active + '" data-id="' + esc(item.id) + '">' +
      '<div class="item-main"><span>' + esc(item.tid + ' · ' + (item.dramaId || '')) + '</span><span>' + esc(item.arm || '') + '</span></div>' +
      '<div class="item-meta"><span>' + esc(item.repeat || '') + '</span><span>' + esc(role || '') + '</span><span>' + esc(item.discipline || '') + '</span></div>' +
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
    '</h2><span class="sub">' + esc([item.runId, item.repeat, item.arm].filter(Boolean).join(' / ')) + '</span></div>' +
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
    pane.innerHTML = renderTranscriptPreview(detail.samplePreview, detail.sampleText) + renderLabelPanel(current);
    wireLabelPanel();
  } else if (state.tab === 'preview') {
    pane.innerHTML = renderOriginDiagnostics(detail) + renderEndingShapeDiagnostics(detail) + renderTranscriptPreview(detail.samplePreview, detail.sampleText);
  } else if (state.tab === 'sample') {
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>';
  } else if (state.tab === 'full') {
    pane.innerHTML = renderTranscriptPreview(detail.fullTranscriptPreview, detail.fullTranscriptText || 'No full transcript found.');
  } else if (state.tab === 'scores') {
    const adaptation = detail.tutorAdaptation;
    const adaptationHtml = renderAdaptationSidecar(adaptation);
    pane.innerHTML = renderConsensusPanel(detail.consensus) +
      renderOriginDiagnostics(detail) +
      renderEndingShapeDiagnostics(detail) +
      '<div class="score-note"><strong>LLM critic scores.</strong> Each row is one critic model judging the same public transcript. Learner self-reframe is the existing recontextualization axis. Actional breakthrough is separate: did the learner perform a new device or criterion even without narrating self-reframe? Peripeteia tutor adaptation asks whether the tutor visibly changed mechanism after pressure. Adaptive mechanism quality asks whether that new public device is fitted and usable, not just different. Recognition-contingent uptake is a secondary closure axis after a learner reframe. New axes show n/a for older scorer artifacts.</div>' +
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
  ['runSelect', 'roleSelect', 'formSelect'].forEach((id) => el(id).addEventListener('change', () => { state.selected = null; loadItems(); }));
  el('labellerInput').addEventListener('input', () => { state.labeller = el('labellerInput').value.replace(/[^\\w-]/g, ''); if (state.selected) selectItem(state.selected); });
  el('searchInput').addEventListener('input', () => { clearTimeout(window.__q); window.__q = setTimeout(() => { state.selected = null; loadItems(); }, 160); });
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    state.tab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    renderPane();
  }));
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
  createPoeticsBrowserApp,
  endingShapeDiagnosticsForScores,
  originDiagnosticsForScores,
  getBlindItem,
  getItem,
  listItems,
  listRuns,
  parseTranscriptPreview,
  renderBrowserHtml,
  saveBrowserLabel,
  saveBrowserReviewFlag,
};
