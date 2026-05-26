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
      };
      hydrated.branchValidity = hydrated.tutorAdaptationMetadata?.branch_validity || null;
      hydrated.peripeteia = hydrated.tutorAdaptationMetadata?.peripeteia || null;
      hydrated.peripeteiaTutorAdaptation = Boolean(
        hydrated.peripeteia?.tutor_adaptive_mechanism || hydrated.peripeteia?.tutor_strategy_reversal,
      );
      hydrated.peripeteiaScore =
        hydrated.peripeteia?.tutor_peripeteia_score == null
          ? null
          : Number(hydrated.peripeteia.tutor_peripeteia_score);
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

function roleSymmetricScoresForScore(row) {
  const metadata = row.metadata || {};
  const roleScores = metadata.role_symmetric_scores || {};
  const learner = roleScores.learner_self_reframe || {};
  const actional = roleScores.learner_actional_breakthrough || {};
  const tutor = roleScores.tutor_contingent_adaptation || {};
  const reversal = roleScores.tutor_adaptive_mechanism || roleScores.tutor_strategy_reversal || {};
  return {
    learnerSelfReframeScore: scoreValue(learner.score100 ?? row.recontextualization),
    learnerSelfReframeEvidence: learner.evidence || row.recohered_earlier || '',
    learnerSelfReframeSource: learner.source || 'recontextualization_axis',
    learnerActionalBreakthroughScore: scoreValue(actional.score100 ?? metadata.actional_breakthrough),
    learnerActionalBreakthroughEvidence: actional.evidence || metadata.actional_breakthrough_evidence || '',
    learnerActionalBreakthroughJustification:
      actional.justification || metadata.actional_breakthrough_justification || '',
    learnerActionalBreakthroughTurn: actional.learnerTurn || metadata.actional_breakthrough_learner_turn || null,
    learnerActionalBreakthroughSource:
      actional.source || (metadata.actional_breakthrough == null ? null : 'metadata'),
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
  };
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
    .map((row) => ({ ...row, roleScores: roleSymmetricScoresForScore(row) }));
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
    sampleText: readArtifact(item.sample_path) || '',
    fullTranscriptText: readArtifact(item.full_transcript_path) || '',
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
:root {
  color-scheme: light;
  --bg: #f7f7f5;
  --panel: #ffffff;
  --ink: #1d2428;
  --muted: #69757c;
  --line: #d9dedc;
  --accent: #235c55;
  --accent-soft: #e1efeb;
  --warn: #8b4a16;
  --trap: #7a2f3b;
  --flat: #4b5c6b;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--ink);
}
button, input, select {
  font: inherit;
}
.app {
  display: grid;
  grid-template-columns: minmax(300px, 34vw) 1fr;
  min-height: 100vh;
}
.sidebar {
  border-right: 1px solid var(--line);
  background: var(--panel);
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
}
.mast {
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--line);
}
h1 {
  font-size: 16px;
  margin: 0 0 4px;
  letter-spacing: 0;
}
.sub {
  color: var(--muted);
  font-size: 12px;
}
.filters {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.filters select, .filters input {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  min-height: 34px;
  padding: 6px 8px;
}
.filter-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.items {
  overflow: auto;
}
.item {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
  padding: 10px 14px;
  display: grid;
  gap: 5px;
  cursor: pointer;
}
.item:hover, .item.active {
  background: var(--accent-soft);
}
.item-main {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-weight: 650;
  font-size: 13px;
}
.item-meta, .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  color: var(--muted);
  font-size: 11px;
}
.chip {
  border: 1px solid var(--line);
  padding: 2px 5px;
  background: #fff;
}
.chip.recognition { color: var(--accent); border-color: #8ab9ae; }
.chip.trap { color: var(--trap); border-color: #d19aa5; }
.chip.flat { color: var(--flat); border-color: #aeb8c1; }
.chip.review { color: var(--warn); border-color: #d2a272; }
.chip.claimable { color: var(--accent); border-color: #5fa092; background: #edf7f4; }
.chip.boundary { color: var(--warn); border-color: #d2a272; background: #fff8ee; }
.chip.negative { color: var(--flat); border-color: #aeb8c1; background: #f4f6f7; }
.chip.insufficient { color: var(--muted); border-color: var(--line); background: #fff; }
.review-button {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--warn);
  padding: 6px 8px;
  cursor: pointer;
}
.review-button.flagged {
  background: #fff3e6;
  border-color: #d2a272;
  font-weight: 650;
}
.main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
}
.detail-head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  background: #fbfbfa;
}
.detail-title {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}
.detail-title h2 {
  font-size: 17px;
  margin: 0;
}
.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
.tab {
  border: 0;
  border-right: 1px solid var(--line);
  padding: 9px 14px;
  background: transparent;
  cursor: pointer;
}
.tab.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 650;
}
.pane {
  overflow: auto;
  padding: 16px 18px 26px;
}
pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.45;
  font-size: 13px;
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
th, td {
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
  padding: 8px 6px;
}
th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.score-note {
  border: 1px solid var(--line);
  background: #fff;
  padding: 10px 12px;
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.45;
}
.metric-help {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.35;
  margin-top: 3px;
}
.score-table {
  margin-bottom: 16px;
}
.evidence-cell {
  max-width: 420px;
}
.empty {
  color: var(--muted);
  padding: 20px;
}
.blind .score-only,
.blind .tab[data-tab="full"],
.blind .tab[data-tab="scores"],
.blind .tab[data-tab="meta"] {
  display: none;
}
.label-panel {
  border-top: 1px solid var(--line);
  margin-top: 16px;
  padding-top: 14px;
  display: grid;
  gap: 10px;
  max-width: 780px;
}
.label-rubric {
  border: 1px solid var(--line);
  background: #fff;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.45;
}
.label-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.label-choice {
  border: 1px solid var(--line);
  background: #fff;
  padding: 8px 10px;
  cursor: pointer;
}
.label-choice.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 650;
}
.label-fields {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 8px;
  align-items: end;
}
.label-fields input,
.label-fields textarea {
  width: 100%;
  border: 1px solid var(--line);
  background: #fff;
  padding: 7px 8px;
}
.label-fields textarea {
  min-height: 38px;
  resize: vertical;
}
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; grid-template-rows: 46vh 54vh; }
  .sidebar { border-right: 0; border-bottom: 1px solid var(--line); }
  .label-fields { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
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
      <button class="tab active" data-tab="sample">Public</button>
      <button class="tab" data-tab="full">Full</button>
      <button class="tab" data-tab="scores">Scores</button>
      <button class="tab" data-tab="meta">Meta</button>
    </div>
    <div id="pane" class="pane"><div class="empty">No script selected.</div></div>
  </main>
</div>
<script>
const state = {
  runs: [],
  items: [],
  selected: null,
  detail: null,
  tab: 'sample',
  blind: false,
  labeller: '',
  selectedLabel: null,
  queue: '',
  runIds: [],
  unlabelled: false,
  flagger: 'codex',
};
const el = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scoreOrNA = (value) => value == null || value === '' || Number.isNaN(Number(value)) ? 'n/a' : Number(value).toFixed(1);
const boolOrNA = (value) => value == null ? 'n/a' : value ? 'true' : 'false';

function metricLabel(label, help) {
  return esc(label) + '<div class="metric-help">' + esc(help) + '</div>';
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
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>' + renderLabelPanel(current);
    wireLabelPanel();
  } else if (state.tab === 'sample') {
    pane.innerHTML = '<pre>' + esc(detail.sampleText || 'No public sample found.') + '</pre>';
  } else if (state.tab === 'full') {
    pane.innerHTML = '<pre>' + esc(detail.fullTranscriptText || 'No full transcript found.') + '</pre>';
  } else if (state.tab === 'scores') {
    const adaptation = detail.tutorAdaptation;
    const adaptationHtml = renderAdaptationSidecar(adaptation);
    pane.innerHTML = renderConsensusPanel(detail.consensus) +
      '<div class="score-note"><strong>LLM critic scores.</strong> Each row is one critic model judging the same public transcript. Learner self-reframe is the existing recontextualization axis. Actional breakthrough is separate: did the learner perform a new device or criterion even without narrating self-reframe? Peripeteia tutor adaptation is the main tutor-adaptation axis. Recognition-contingent uptake is a secondary closure axis after a learner reframe. New axes show n/a for older scorer artifacts.</div>' +
      '<table class="score-table"><thead><tr><th>Critic</th><th>Form</th><th>Learner reframe (LLM)</th><th>Actional breakthrough (LLM)</th><th>Peripeteia tutor adaptation (LLM)</th><th>Recognition-contingent uptake (LLM)</th><th>Insight</th><th>Pivot</th><th>Evidence</th></tr></thead><tbody>' +
      detail.scores.map((s) => {
        const role = s.roleScores || {};
        const evidence = [
          role.learnerSelfReframeEvidence ? 'learner: ' + role.learnerSelfReframeEvidence : '',
          role.learnerActionalBreakthroughEvidence ? 'action: ' + role.learnerActionalBreakthroughEvidence : '',
          role.tutorStrategyReversalEvidence ? 'mechanism: ' + role.tutorStrategyReversalEvidence : '',
          role.tutorContingentAdaptationEvidence ? 'tutor: ' + role.tutorContingentAdaptationEvidence : '',
          s.stated_insight_evidence ? 'insight: ' + s.stated_insight_evidence : '',
        ].filter(Boolean).join(' / ');
        return '<tr><td>' + esc(s.critic_model) + '</td><td>' + esc(s.form_class) + '</td><td>' +
          esc(scoreOrNA(role.learnerSelfReframeScore)) + '</td><td>' +
          esc(scoreOrNA(role.learnerActionalBreakthroughScore)) + '</td><td>' +
          esc(scoreOrNA(role.tutorStrategyReversalScore)) + '</td><td>' +
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

async function init() {
  const runs = await getJson('/api/runs');
  state.runs = runs.runs;
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
  getBlindItem,
  getItem,
  listItems,
  listRuns,
  renderBrowserHtml,
  saveBrowserLabel,
  saveBrowserReviewFlag,
};
