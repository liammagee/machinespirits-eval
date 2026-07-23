/**
 * Interactive Chat Routes
 *
 * Exposes the tutor-side ego/superego loop over HTTP so a human can play
 * the learner role. Each POST /turn returns the full deliberation trace
 * (ego draft, superego critique, ego revision) so the architecture under
 * test is visible, not just the final message.
 *
 * Cell configs are read directly from config/tutor-agents.yaml — we do not
 * route through tutor-core's profile system, which lets this UI work for
 * eval-only cells (e.g. cells 22-79) without any additional plumbing.
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import interactionEngine, { extractTutorMessage } from '../services/learnerTutorInteractionEngine.js';
import {
  buildChatDirectorPlan,
  listCurricula,
  listCurriculumSceneSources,
  loadCurriculumContext,
} from '../services/legacyChatCurriculum.js';
import { loadPromptFile } from '../services/legacyChatPromptLoader.js';
import {
  callCli,
  callModel,
  cliModelLabel,
  normalizeCli,
  runTutorTurn,
  streamSingleAgentTurn,
} from '../services/legacyChatTutorEngine.js';
import * as pilotStore from '../services/pilotStore.js';
import { FEATURE_META, DIRECTOR_META, normalizeAssistProposal } from '../public/chat/assist-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const router = Router();

// This adapter serves ONLY the interactive /chat UI, never the eval runner.
// Reasoning models (e.g. kimi-k2.5) spend their token budget on hidden
// reasoning before emitting any visible content, so the experiment's
// config-driven cap (config/learner-agents.yaml: max_tokens 500) truncates
// them to an empty message here. Floor the interactive budget so reasoning
// models can finish thinking and still speak — without touching the
// experiment-load-bearing YAML.
const CHAT_MIN_MAX_TOKENS = 4000;

const EVAL_DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');

function cellSortKey(name) {
  const m = name.match(/^cell_(\d+)/);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

// Canonical id-director cell scores under v2.2 last-turn and the Weberian
// 8-dimension charisma rubric. Numbers from the full-N CLI Sonnet 4.6 pass
// (docs/cell-100-charisma-full-n-update.md, 2026-04-28); c109 is still
// pilot-N=6 (no confirmatory run yet) and is flagged so the UI can mark it
// as such. The chat UI surfaces these via the resolved-cell panel; they are
// not recomputed at chat time.
const CHARISMA_PROFILES = {
  cell_101: {
    designPoint: 'baseline',
    label: 'Baseline id-director',
    v22LastTurn: 55.5,
    charisma: 59.9,
    n: 79,
    blurb: 'Inversion alone — no classifier, no exemplars, no tuning.',
  },
  cell_102: {
    designPoint: 'baseline-recog',
    label: 'Baseline + recognition',
    v22LastTurn: 49.4,
    charisma: 54.1,
    n: 54,
    blurb: 'Recognition vocabulary only — both rubrics drift down.',
  },
  cell_103: {
    designPoint: 'classifier',
    label: 'Classifier only',
    v22LastTurn: 75.8,
    charisma: 64.3,
    n: 81,
    blurb: 'Register classifier lifts persona-shift floor; no recognition yet.',
  },
  cell_104: {
    designPoint: 'v22-specialist',
    label: 'v2.2 specialist',
    v22LastTurn: 80.6,
    charisma: 65.7,
    n: 81,
    blurb: 'Classifier + recognition — wins v2.2, mid on charisma.',
  },
  cell_105: {
    designPoint: 'charisma-specialist',
    label: 'Charisma specialist',
    v22LastTurn: 70.0,
    charisma: 71.0,
    n: 81,
    blurb: 'Verbose 800–1500 token id directives — wins charisma, mid on v2.2.',
  },
  cell_106: {
    designPoint: 'failure',
    label: 'Shared floor',
    v22LastTurn: 57.0,
    charisma: 36.4,
    n: 54,
    blurb: 'Terse 200–400 token directives under-specify the ego — fails both rubrics.',
  },
  cell_107: {
    designPoint: 'generalist',
    label: 'Balanced generalist',
    v22LastTurn: 78.5,
    charisma: 66.3,
    n: 27,
    blurb: 'Witness exemplars only — second on both rubrics, best balance.',
  },
  cell_108: {
    designPoint: 'composer-classifier',
    label: 'Classifier + exemplars',
    v22LastTurn: 72.6,
    charisma: 71.4,
    n: 27,
    blurb: 'Pilot lift regressed at full N — non-text levers compose roughly additively, not super-additively.',
  },
  cell_109: {
    designPoint: 'composer-charisma',
    label: 'Charisma-tuning + exemplars',
    v22LastTurn: 59.6,
    charisma: 77.7,
    n: 6,
    blurb: 'Two text-heavy levers stack — ego instruction-following degrades. Pilot N only.',
    pilotOnly: true,
  },
};

function charismaProfileFor(name) {
  const baseName = name?.match(/^cell_\d+/)?.[0] || null;
  return baseName ? CHARISMA_PROFILES[baseName] || null : null;
}

const RESULT_METRICS = [
  { key: 'tutorFirstTurn', label: 'tutor first turn', sumKey: 'tutorFirstTurnSum', nKey: 'tutorFirstTurnN' },
  { key: 'tutorLastTurn', label: 'tutor last turn', sumKey: 'tutorLastTurnSum', nKey: 'tutorLastTurnN' },
  { key: 'tutorHolistic', label: 'tutor holistic', sumKey: 'tutorHolisticSum', nKey: 'tutorHolisticN' },
  { key: 'dialogueQuality', label: 'dialogue quality', sumKey: 'dialogueQualitySum', nKey: 'dialogueQualityN' },
  { key: 'learnerHolistic', label: 'learner holistic', sumKey: 'learnerHolisticSum', nKey: 'learnerHolisticN' },
  { key: 'charisma', label: 'charisma', sumKey: 'charismaSum', nKey: 'charismaN' },
];

let resultStatsCache = null;

function formatScore(value) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(1));
}

function cellResultAliases(name) {
  const aliases = new Set([name]);
  const baseName = name?.match(/^cell_\d+/)?.[0] || null;
  if (baseName) aliases.add(baseName);
  return [...aliases];
}

function emptyResultStats(status = 'unavailable', note = 'No local evaluation DB found.') {
  return { status, byProfile: new Map(), note };
}

function loadResultStatsByProfile() {
  let stat;
  try {
    stat = fs.statSync(EVAL_DB_PATH);
  } catch {
    return emptyResultStats();
  }

  if (resultStatsCache?.dbPath === EVAL_DB_PATH && resultStatsCache?.mtimeMs === stat.mtimeMs) {
    return resultStatsCache.stats;
  }

  let db;
  try {
    db = new Database(EVAL_DB_PATH, { readonly: true, fileMustExist: true });
    const cols = new Set(
      db
        .prepare('PRAGMA table_info(evaluation_results)')
        .all()
        .map((c) => c.name),
    );
    for (const required of [
      'profile_name',
      'success',
      'run_id',
      'created_at',
      'tutor_first_turn_score',
      'tutor_last_turn_score',
      'tutor_holistic_overall_score',
      'dialogue_quality_score',
      'learner_holistic_overall_score',
      'tutor_charisma_overall_score',
    ]) {
      if (!cols.has(required)) {
        return emptyResultStats('unavailable', 'Local evaluation DB does not expose scored-result columns.');
      }
    }

    const rows = db
      .prepare(
        `
        SELECT
          profile_name AS profileName,
          COUNT(*) AS rowCount,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successRows,
          COUNT(DISTINCT CASE WHEN success = 1 THEN run_id END) AS runCount,
          MIN(CASE WHEN success = 1 THEN created_at END) AS firstSeenAt,
          MAX(CASE WHEN success = 1 THEN created_at END) AS lastSeenAt,

          COALESCE(SUM(CASE WHEN success = 1 AND tutor_first_turn_score IS NOT NULL THEN tutor_first_turn_score ELSE 0 END), 0) AS tutorFirstTurnSum,
          SUM(CASE WHEN success = 1 AND tutor_first_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS tutorFirstTurnN,

          COALESCE(SUM(CASE WHEN success = 1 AND tutor_last_turn_score IS NOT NULL THEN tutor_last_turn_score ELSE 0 END), 0) AS tutorLastTurnSum,
          SUM(CASE WHEN success = 1 AND tutor_last_turn_score IS NOT NULL THEN 1 ELSE 0 END) AS tutorLastTurnN,

          COALESCE(SUM(CASE WHEN success = 1 AND tutor_holistic_overall_score IS NOT NULL THEN tutor_holistic_overall_score ELSE 0 END), 0) AS tutorHolisticSum,
          SUM(CASE WHEN success = 1 AND tutor_holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS tutorHolisticN,

          COALESCE(SUM(CASE WHEN success = 1 AND dialogue_quality_score IS NOT NULL THEN dialogue_quality_score ELSE 0 END), 0) AS dialogueQualitySum,
          SUM(CASE WHEN success = 1 AND dialogue_quality_score IS NOT NULL THEN 1 ELSE 0 END) AS dialogueQualityN,

          COALESCE(SUM(CASE WHEN success = 1 AND learner_holistic_overall_score IS NOT NULL THEN learner_holistic_overall_score ELSE 0 END), 0) AS learnerHolisticSum,
          SUM(CASE WHEN success = 1 AND learner_holistic_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS learnerHolisticN,

          COALESCE(SUM(CASE WHEN success = 1 AND tutor_charisma_overall_score IS NOT NULL THEN tutor_charisma_overall_score ELSE 0 END), 0) AS charismaSum,
          SUM(CASE WHEN success = 1 AND tutor_charisma_overall_score IS NOT NULL THEN 1 ELSE 0 END) AS charismaN
        FROM evaluation_results
        WHERE profile_name IS NOT NULL
        GROUP BY profile_name
        `,
      )
      .all();

    const byProfile = new Map(rows.map((row) => [row.profileName, row]));
    const stats = { status: 'available', byProfile, note: null };
    resultStatsCache = { dbPath: EVAL_DB_PATH, mtimeMs: stat.mtimeMs, stats };
    return stats;
  } catch (err) {
    console.warn('[chat] result summary unavailable:', err.message);
    return emptyResultStats('unavailable', 'Local evaluation DB could not be read.');
  } finally {
    try {
      db?.close();
    } catch {
      // ignore close failures on read-only summary path
    }
  }
}

function combineResultRows(rows) {
  const combined = {
    rowCount: 0,
    successRows: 0,
    runCount: 0,
    firstSeenAt: null,
    lastSeenAt: null,
  };

  for (const def of RESULT_METRICS) {
    combined[def.sumKey] = 0;
    combined[def.nKey] = 0;
  }

  for (const row of rows) {
    combined.rowCount += Number(row.rowCount || 0);
    combined.successRows += Number(row.successRows || 0);
    combined.runCount += Number(row.runCount || 0);
    if (row.firstSeenAt && (!combined.firstSeenAt || row.firstSeenAt < combined.firstSeenAt)) {
      combined.firstSeenAt = row.firstSeenAt;
    }
    if (row.lastSeenAt && (!combined.lastSeenAt || row.lastSeenAt > combined.lastSeenAt)) {
      combined.lastSeenAt = row.lastSeenAt;
    }
    for (const def of RESULT_METRICS) {
      combined[def.sumKey] += Number(row[def.sumKey] || 0);
      combined[def.nKey] += Number(row[def.nKey] || 0);
    }
  }
  return combined;
}

function summarizeExistingResults(name, resultStats) {
  if (resultStats.status !== 'available') {
    return {
      status: resultStats.status,
      note: resultStats.note || 'Existing results are unavailable.',
      aliases: cellResultAliases(name),
      metrics: [],
    };
  }

  const aliases = cellResultAliases(name);
  const rows = aliases.map((alias) => resultStats.byProfile.get(alias)).filter(Boolean);
  if (!rows.length) {
    return {
      status: 'no_data',
      note: 'No existing scored rows found in the local evaluation DB for this cell.',
      aliases,
      metrics: [],
    };
  }

  const combined = combineResultRows(rows);
  const metrics = RESULT_METRICS.map((def) => {
    const n = Number(combined[def.nKey] || 0);
    if (!n) return null;
    return {
      key: def.key,
      label: def.label,
      n,
      average: formatScore(Number(combined[def.sumKey] || 0) / n),
    };
  }).filter(Boolean);

  if (!metrics.length) {
    return {
      status: 'unscored',
      note: `${combined.successRows} local row${combined.successRows === 1 ? '' : 's'} found, but no scored result metrics yet.`,
      aliases,
      rowCount: combined.rowCount,
      successRows: combined.successRows,
      runCount: combined.runCount,
      metrics: [],
    };
  }

  const byKey = new Map(metrics.map((m) => [m.key, m]));
  const parts = [];
  const first = byKey.get('tutorFirstTurn');
  const last = byKey.get('tutorLastTurn');
  if (first && last) {
    if (first.n === last.n) {
      const delta = formatScore(last.average - first.average);
      parts.push(`tutor first/last ${first.average}/${last.average} (${delta >= 0 ? '+' : ''}${delta})`);
    } else {
      parts.push(`tutor first/last ${first.average}/${last.average}`);
    }
  } else if (first) {
    parts.push(`tutor first-turn ${first.average}`);
  } else if (last) {
    parts.push(`tutor last-turn ${last.average}`);
  }

  for (const key of ['tutorHolistic', 'dialogueQuality', 'learnerHolistic', 'charisma']) {
    const metric = byKey.get(key);
    if (metric) parts.push(`${metric.label} ${metric.average}`);
  }

  const scoredRows = Math.max(...metrics.map((m) => m.n));
  return {
    status: 'available',
    note: `Existing local results, pooled scored rows on a 0-100 scale with metric N varying up to ${scoredRows}: ${parts.join('; ')}.`,
    aliases,
    rowCount: combined.rowCount,
    successRows: combined.successRows,
    scoredRows,
    runCount: combined.runCount,
    firstSeenAt: combined.firstSeenAt,
    lastSeenAt: combined.lastSeenAt,
    metrics,
  };
}

function summarizeCell(name, profile, orientations = {}, resultStats = null) {
  const factors = profile.factors || {};
  const ego = profile.ego
    ? {
        provider: profile.ego.provider,
        model: profile.ego.model,
        promptFile: profile.ego.prompt_file || null,
      }
    : null;
  const superego = profile.superego
    ? {
        provider: profile.superego.provider,
        model: profile.superego.model,
        promptFile: profile.superego.prompt_file || null,
      }
    : null;
  // Resolve the cell's pedagogical orientation. For dialectical_*/divergent_*
  // prompt types, the architectural-variant entry is shared across base/recog
  // ego variants — augment with `effectiveFamily` derived from recognition_mode
  // so the frontend can place each cell in the right ego family.
  const promptType = factors.prompt_type || null;
  const orientation = promptType ? orientations[promptType] || null : null;
  let effectiveFamily = orientation?.family || null;
  let effectiveSubfamily = orientation?.subfamily || null;
  if (orientation?.family === 'architectural_variant') {
    effectiveFamily = profile.recognition_mode ? 'intersubjective' : 'transmission';
    effectiveSubfamily = profile.recognition_mode ? 'hegelian_recognition' : orientation.subfamily || null;
  }
  return {
    name,
    description: profile.description || '',
    promptType,
    multiAgentTutor: !!factors.multi_agent_tutor,
    multiAgentLearner: !!factors.multi_agent_learner,
    learnerArchitecture: profile.learner_architecture || null,
    recognitionMode: !!profile.recognition_mode,
    conversationMode: profile.conversation_mode || null,
    runner: profile.runner || 'standard',
    dialogueEnabled: !!profile.dialogue?.enabled,
    maxRounds: profile.dialogue?.max_rounds ?? 0,
    // id-director extension: cells 101-109 use a back-stage id agent to author
    // the ego prompt each turn, scored under both v2.2 and the Weberian
    // charisma rubric. See public/eval/geist-in-the-machine.html §VII.
    idDirector: !!factors.id_director,
    charismaTarget: !!factors.charisma_target,
    witnessExemplars: !!factors.witness_exemplars,
    registerClassifier: !!factors.register_classifier,
    idTuning: factors.id_tuning || null,
    charismaProfile: factors.id_director ? charismaProfileFor(name) : null,
    resultSummary: summarizeExistingResults(name, resultStats || emptyResultStats()),
    ego,
    superego,
    orientation: orientation
      ? {
          promptType,
          family: orientation.family,
          subfamily: orientation.subfamily || null,
          effectiveFamily,
          effectiveSubfamily,
          shortLabel: orientation.short_label,
          lineage: orientation.lineage,
          viewOfLearner: orientation.view_of_learner,
          roleOfTutor: orientation.role_of_tutor,
          keyMechanism: orientation.key_mechanism,
          vocabulary: orientation.vocabulary || [],
          approxLengthWords: orientation.approx_length_words ?? null,
          effectVsBase: orientation.evaluation_effect_pooled_d_vs_base ?? null,
          note: orientation.evaluation_note || null,
        }
      : null,
  };
}

router.get('/cells', (req, res) => {
  try {
    const data = evalConfigLoader.loadTutorAgents();
    const profiles = data?.profiles || {};
    const orientations = data?.pedagogical_orientations || {};
    const resultStats = loadResultStatsByProfile();
    const cells = Object.entries(profiles)
      .map(([name, profile]) => summarizeCell(name, profile, orientations, resultStats))
      .sort((a, b) => {
        const ka = cellSortKey(a.name);
        const kb = cellSortKey(b.name);
        if (ka !== kb) return ka - kb;
        return a.name.localeCompare(b.name);
      });
    res.json({ count: cells.length, cells, orientations });
  } catch (err) {
    console.error('[chat] cells error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/models', (_req, res) => {
  try {
    const providers = evalConfigLoader.loadProviders()?.providers || {};
    const openrouter = providers.openrouter || {};
    const models = Object.entries(openrouter.models || {})
      .map(([alias, modelId]) => ({
        provider: 'openrouter',
        alias,
        value: `openrouter.${alias}`,
        model: modelId,
        label: `${alias} · ${modelId}`,
      }))
      .sort((a, b) => a.alias.localeCompare(b.alias));
    res.json({
      defaultValue: '',
      models,
      providers: [
        {
          id: 'openrouter',
          label: 'OpenRouter',
          models,
        },
      ],
    });
  } catch (err) {
    console.error('[chat] models error:', err);
    res.status(500).json({ error: err.message });
  }
});

function chatCellCandidates() {
  const data = evalConfigLoader.loadTutorAgents();
  const profiles = data?.profiles || {};
  const orientations = data?.pedagogical_orientations || {};
  const resultStats = loadResultStatsByProfile();
  return Object.entries(profiles)
    .filter(([name]) => /^cell_\d/.test(name))
    .map(([name, profile]) => summarizeCell(name, profile, orientations, resultStats));
}

function resolveFeatureSelection(rawFeatures = {}) {
  const features = normalizeFeatures(rawFeatures || {});
  const candidates = chatCellCandidates();
  const target = deriveTarget(features);
  const scored = candidates.map((cell) => scoreCell(cell, target));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const na = cellSortKey(a.cell.name);
    const nb = cellSortKey(b.cell.name);
    return na - nb;
  });

  const best = scored[0];
  const maxScore = DIMENSION_WEIGHTS.reduce((s, d) => s + d.weight, 0);
  const exact = best ? best.matches.every((m) => m.match) : false;

  return {
    features,
    target,
    maxScore,
    matchQuality: exact ? 'exact' : 'closest',
    resolved: best
      ? {
          ...best.cell,
          score: best.score,
          matches: best.matches,
        }
      : null,
    alternatives: scored.slice(1, 4).map((s) => ({
      name: s.cell.name,
      description: s.cell.description,
      score: s.score,
      relaxed: s.matches.filter((m) => !m.match).map((m) => m.dimension),
    })),
  };
}

// Human-readable features map to cell characteristics. The resolver scores every
// cell against the requested target and returns the best match plus a description
// of which dimensions matched exactly vs were relaxed.
router.post('/resolve', (req, res) => {
  try {
    res.json(resolveFeatureSelection(req.body || {}));
  } catch (err) {
    console.error('[chat] resolve error:', err);
    res.status(500).json({ error: err.message });
  }
});

const VOICE_TO_PROMPT_TYPE = {
  standard: 'base',
  polished: 'enhanced',
  recognition: 'recognition',
  placebo: 'placebo',
  minimalist: 'naive',
  // The charismatic approach maps onto the id-director family (cells 101-109).
  // All id-director cells share prompt_type:base; the `idDirector` target
  // dimension below is what biases resolution toward them.
  charismatic: 'base',
};

const DIMENSION_WEIGHTS = [
  { dimension: 'promptType', weight: 3 },
  { dimension: 'criticPresent', weight: 2 },
  { dimension: 'learnerModel', weight: 2 },
  { dimension: 'recognitionMode', weight: 1 },
  { dimension: 'idDirector', weight: 3 },
];

function normalizeFeatures(raw) {
  const approach = ['standard', 'polished', 'recognition', 'placebo', 'minimalist', 'charismatic'].includes(
    raw.approach,
  )
    ? raw.approach
    : 'standard';
  const critic = ['none', 'pedagogical', 'dialectical', 'divergent', 'hardwired'].includes(raw.critic)
    ? raw.critic
    : 'none';
  let stance = ['suspicious', 'adversary', 'advocate'].includes(raw.stance) ? raw.stance : 'suspicious';
  if (critic !== 'dialectical' && critic !== 'divergent') stance = null;
  const learnerModel = raw.learnerModel === 'reflective' ? 'reflective' : 'surface';
  // charismaVariant: which design-point on the Pareto frontier the user wants
  // when approach==='charismatic'. Defaults to the balanced generalist (c107).
  const charismaVariant = ['generalist', 'v22-specialist', 'charisma-specialist'].includes(raw.charismaVariant)
    ? raw.charismaVariant
    : 'generalist';
  return { approach, critic, stance, learnerModel, charismaVariant };
}

function deriveTarget({ approach, critic, stance, learnerModel, charismaVariant }) {
  let promptType;
  if (critic === 'hardwired') promptType = 'hardwired';
  else if (critic === 'dialectical') promptType = `dialectical_${stance}`;
  else if (critic === 'divergent') promptType = `divergent_${stance}`;
  else promptType = VOICE_TO_PROMPT_TYPE[approach] || 'base';
  // The v2.2-specialist frontier point (cell_104) is the only id-director cell
  // with prompt_type:recognition; aligning the target here so the recognition
  // vocabulary in the id's directives lines up with the recognitionMode flag
  // below. Without this, cell_104 loses the promptType dimension (worth 3) and
  // gets out-scored by cell_101 (base/no-recognition) on a 3-vs-1 trade.
  if (approach === 'charismatic' && charismaVariant === 'v22-specialist') {
    promptType = 'recognition';
  }
  return {
    promptType,
    criticPresent: critic !== 'none' && critic !== 'hardwired',
    learnerArchitecture: learnerModel === 'reflective' ? 'ego_superego' : 'unified',
    recognitionMode: approach === 'recognition' || (approach === 'charismatic' && charismaVariant === 'v22-specialist'),
    idDirector: approach === 'charismatic',
    charismaVariant,
  };
}

function scoreCell(cell, target) {
  const matches = [];
  // prompt_type (weight 3)
  matches.push({
    dimension: 'promptType',
    want: target.promptType,
    have: cell.promptType,
    match: cell.promptType === target.promptType,
  });
  // critic present (weight 2) — has superego block
  matches.push({
    dimension: 'criticPresent',
    want: target.criticPresent,
    have: !!cell.superego,
    match: !!cell.superego === target.criticPresent,
  });
  // learner model (weight 2) — prefix match so ego_superego_authentic etc. collapse to ego_superego
  const cellLearnerFamily = (cell.learnerArchitecture || '').startsWith('ego_superego') ? 'ego_superego' : 'unified';
  matches.push({
    dimension: 'learnerModel',
    want: target.learnerArchitecture,
    have: cellLearnerFamily,
    match: cellLearnerFamily === target.learnerArchitecture,
  });
  // recognition mode (weight 1)
  matches.push({
    dimension: 'recognitionMode',
    want: target.recognitionMode,
    have: cell.recognitionMode,
    match: cell.recognitionMode === target.recognitionMode,
  });
  // id-director dimension (weight 3) — charismatic approach biases here
  matches.push({
    dimension: 'idDirector',
    want: target.idDirector,
    have: cell.idDirector,
    match: cell.idDirector === target.idDirector,
  });

  let score = matches.reduce((s, m) => {
    if (!m.match) return s;
    const w = DIMENSION_WEIGHTS.find((d) => d.dimension === m.dimension)?.weight || 0;
    return s + w;
  }, 0);

  // Charisma variant tiebreak: when the user picks an id-director frontier
  // point, prefer the matching design-point cell. Generalist → c107 (witness
  // exemplars only), v22-specialist → c104 (classifier + recognition),
  // charisma-specialist → c105 (id_tuning:charisma).
  if (target.idDirector && cell.idDirector) {
    if (
      target.charismaVariant === 'generalist' &&
      cell.witnessExemplars &&
      !cell.registerClassifier &&
      cell.idTuning !== 'charisma'
    ) {
      score += 1;
    } else if (target.charismaVariant === 'v22-specialist' && cell.recognitionMode && cell.registerClassifier) {
      score += 1;
    } else if (
      target.charismaVariant === 'charisma-specialist' &&
      cell.idTuning === 'charisma' &&
      !cell.witnessExemplars
    ) {
      score += 1;
    }
  }

  return { cell, score, matches };
}

// Personas from `learner-agents.yaml` are sparse (many are `{}` — empty
// persona_modifier stubs that the engine accepts as valid IDs but have no
// descriptions). We enrich them with hand-written sketches so the picker
// shows meaningful choices to humans.
const PERSONA_SKETCHES = {
  eager_novice: { name: 'Eager Novice', hint: 'enthusiastic · easily overwhelmed' },
  confused_novice: { name: 'Confused Novice', hint: 'lost but curious · asks a lot' },
  eager_explorer: { name: 'Eager Explorer', hint: 'delighted by tangents · open' },
  focused_achiever: { name: 'Focused Achiever', hint: 'goal-oriented · wants closure' },
  struggling_anxious: { name: 'Struggling Anxious', hint: 'easily frustrated · needs reassurance' },
  adversarial_tester: { name: 'Adversarial Tester', hint: 'challenges the tutor · probes reasoning' },
};

function listChatPersonas() {
  const base = learnerConfigLoader.listPersonas();
  const known = new Set(base.map((p) => p.id));
  // Surface persona-modifier stubs from YAML too (they're valid persona IDs)
  const yamlModifiers = learnerConfigLoader.loadConfig?.()?.persona_modifiers || {};
  const extraIds = Object.keys(yamlModifiers).filter((id) => !known.has(id));
  return [...base, ...extraIds.map((id) => ({ id, name: null, description: null }))].map((p) => {
    const sketch = PERSONA_SKETCHES[p.id];
    return {
      id: p.id,
      name: p.name || sketch?.name || p.id.replace(/_/g, ' '),
      hint: sketch?.hint || p.description || '',
      defaultArchitecture: p.defaultArchitecture || null,
    };
  });
}

// ════════════════════════════════════════════════════════════════════
//  CURRICULUM (content packages on disk)
// ════════════════════════════════════════════════════════════════════

router.get('/curricula', (req, res) => {
  try {
    res.json({ packages: listCurricula(), sceneSources: listCurriculumSceneSources() });
  } catch (err) {
    console.error('[chat] curricula error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/personas', (req, res) => {
  try {
    res.json({ personas: listChatPersonas() });
  } catch (err) {
    console.error('[chat] personas error:', err);
    res.status(500).json({ error: err.message });
  }
});

const CHAT_ASSIST_PROMPT_FILE = 'chat-assist-concierge.md';
const CHAT_ASSIST_MODEL = process.env.CHAT_ASSIST_MODEL || 'openrouter.gpt-mini';
const ASSIST_CATALOG_TTL_MS = 5 * 60 * 1000;
let assistCatalogCache = null;

function compactAssistLine(value, max = 260) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function truncateAssistBlock(lines, maxChars = 4000) {
  const out = [];
  let used = 0;
  for (const line of lines) {
    const text = String(line || '');
    if (!text) continue;
    if (used + text.length + 1 > maxChars) {
      out.push(`[catalog clipped after ${out.length} entries]`);
      break;
    }
    out.push(text);
    used += text.length + 1;
  }
  return out.join('\n');
}

function featureCatalogText() {
  const sections = [];
  for (const [dimension, values] of Object.entries(FEATURE_META)) {
    sections.push(
      `${dimension}: ${Object.entries(values)
        .map(([value, hint]) => `${value} (${hint})`)
        .join('; ')}`,
    );
  }
  return sections.join('\n');
}

function directorCatalogText() {
  const sections = [];
  for (const [dimension, values] of Object.entries(DIRECTOR_META)) {
    sections.push(
      `${dimension}: ${Object.entries(values)
        .map(([value, hint]) => `${value} (${hint})`)
        .join('; ')}`,
    );
  }
  return sections.join('\n');
}

function buildAssistCatalog() {
  const now = Date.now();
  if (assistCatalogCache && now - assistCatalogCache.createdAt < ASSIST_CATALOG_TTL_MS) {
    return assistCatalogCache.catalog;
  }

  const personas = listChatPersonas();
  const sceneSources = listCurriculumSceneSources();
  const packages = listCurricula();
  const lectureRefs = [];
  const curriculumLines = [];
  for (const pkg of packages) {
    for (const course of pkg.courses || []) {
      curriculumLines.push(`- ${pkg.label} / ${course.id}: ${course.title}`);
      for (const lec of course.lectures || []) {
        lectureRefs.push(lec.ref);
        curriculumLines.push(`  - ${lec.ref}: ${lec.title}`);
      }
    }
  }

  const sceneLines = sceneSources.map((src) =>
    [
      `- ${src.ref}: ${src.label}`,
      src.topic ? `topic=${compactAssistLine(src.topic, 140)}` : null,
      src.summary ? `summary=${compactAssistLine(src.summary, 140)}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  );

  const text = [
    'FEATURE VOCABULARY',
    featureCatalogText(),
    '',
    'PERSONAS',
    personas.map((p) => `- ${p.id}: ${p.name}${p.hint ? ` (${p.hint})` : ''}`).join('\n'),
    '',
    'DIRECTOR VOCABULARY',
    directorCatalogText(),
    '',
    'SCENE SOURCES',
    truncateAssistBlock(sceneLines, 4000),
    '',
    'CURRICULUM PACKAGES AND LECTURES',
    truncateAssistBlock(curriculumLines, 4000),
  ].join('\n');

  const catalog = {
    text,
    personas,
    sceneRefs: sceneSources.map((src) => src.ref),
    lectureRefs,
    personaIds: personas.map((p) => p.id),
  };
  assistCatalogCache = { createdAt: now, catalog };
  return catalog;
}

function sanitizeAssistMessages(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-12)
    .map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: compactAssistLine(m?.content, 1500),
    }))
    .filter((m) => m.content);
}

function extractAssistJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function resolveAssistPreview(currentConfig = {}, proposal = null) {
  const currentFeatures = normalizeFeatures(currentConfig?.features || {});
  const proposedFeatures = proposal?.features && typeof proposal.features === 'object' ? proposal.features : {};
  const resolved = resolveFeatureSelection({ ...currentFeatures, ...proposedFeatures });
  return {
    name: resolved.resolved?.name || null,
    matchQuality: resolved.matchQuality,
    score: resolved.resolved?.score ?? null,
    maxScore: resolved.maxScore,
  };
}

function finalizeAssistResponse({ message, rawProposal, currentConfig, totals = {}, catalog }) {
  const { proposal, dropped } = normalizeAssistProposal(rawProposal || {}, {
    sceneRefs: catalog.sceneRefs,
    lectureRefs: catalog.lectureRefs,
    personaIds: catalog.personaIds,
  });
  const dropNote = dropped.length ? ` Dropped unsupported field(s): ${dropped.join(', ')}.` : '';
  return {
    message: `${compactAssistLine(message, 1200) || 'I drafted a staging proposal.'}${dropNote}`,
    proposal,
    resolved: proposal ? resolveAssistPreview(currentConfig, proposal) : null,
    totals: {
      latencyMs: totals.latencyMs || 0,
      outputTokens: totals.outputTokens || 0,
    },
  };
}

function dryRunAssistProposal(messages = [], currentConfig = {}) {
  const latest = messages[messages.length - 1]?.content || '';
  const text = latest.toLowerCase();
  const proposal = {
    features: {},
    action: 'none',
    rationale: {},
  };

  if (text.includes('charismatic') || text.includes('weber')) {
    proposal.features.approach = 'charismatic';
    proposal.features.charismaVariant = 'generalist';
    proposal.rationale['features.approach'] = 'The request asks for a charismatic tutor.';
  } else if (text.includes('recognition') || text.includes('hegel')) {
    proposal.features.approach = 'recognition';
    proposal.rationale['features.approach'] = 'The request foregrounds recognition/Hegelian framing.';
  } else if (text.includes('minimal') || text.includes('naive')) {
    proposal.features.approach = 'minimalist';
    proposal.rationale['features.approach'] = 'The request asks for a minimal baseline.';
  }

  if (text.includes('dialectical critic')) {
    proposal.features.critic = 'dialectical';
    proposal.features.stance = text.includes('advocate')
      ? 'advocate'
      : text.includes('adversar')
        ? 'adversary'
        : 'suspicious';
    proposal.rationale['features.critic'] = 'The request asks for a dialectical critic.';
  } else if (text.includes('divergent critic')) {
    proposal.features.critic = 'divergent';
    proposal.features.stance = text.includes('advocate')
      ? 'advocate'
      : text.includes('adversar')
        ? 'adversary'
        : 'suspicious';
    proposal.rationale['features.critic'] = 'The request asks for a divergent critic.';
  } else if (text.includes('pedagogical critic')) {
    proposal.features.critic = 'pedagogical';
    proposal.rationale['features.critic'] = 'The request asks for a pedagogical critic.';
  } else if (text.includes('hardwired critic')) {
    proposal.features.critic = 'hardwired';
    proposal.rationale['features.critic'] = 'The request asks for hardwired critique.';
  }

  if (text.includes('anxious')) {
    proposal.personaId = 'struggling_anxious';
    proposal.rationale.personaId = 'An anxious learner maps to the struggling_anxious persona.';
  } else if (text.includes('adversarial') || text.includes('challenge')) {
    proposal.personaId = 'adversarial_tester';
    proposal.rationale.personaId = 'A challenging learner maps to the adversarial_tester persona.';
  }

  if (text.includes('ai plays both') || text.includes('ai writes both') || text.includes('both sides')) {
    proposal.mode = 'auto';
    proposal.action = 'start_scene';
    proposal.rationale.mode = 'AI writes both sides means the synthetic learner and tutor should advance together.';
  }

  const topic = latest
    .replace(/^stage\s+(a\s+)?(drama|scene)\s+(about|on)\s+/i, '')
    .replace(/\s+(with|using|make)\s+.*$/i, '')
    .replace(/,\s*(with|make|ai plays|ai writes).*$/i, '')
    .trim();
  if (topic && topic.length > 8) {
    proposal.topic = topic.slice(0, 180);
    proposal.rationale.topic = 'Use the user description as the scene topic.';
  } else if (currentConfig?.topic) {
    proposal.topic = currentConfig.topic;
  }

  if (!Object.keys(proposal.features).length) {
    proposal.features.approach = currentConfig?.features?.approach || 'standard';
  }
  return proposal;
}

router.get('/assist/health', (_req, res) => {
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY;
  res.json({
    ok: hasOpenRouter,
    provider: hasOpenRouter ? 'openrouter' : 'none',
    model: CHAT_ASSIST_MODEL,
  });
});

router.post('/assist', async (req, res) => {
  const startedAt = Date.now();
  try {
    const catalog = buildAssistCatalog();
    const messages = sanitizeAssistMessages(req.body?.messages || []);
    const currentConfig =
      req.body?.currentConfig && typeof req.body.currentConfig === 'object' ? req.body.currentConfig : {};
    const cli = normalizeCli(req.body);
    const dryRun = req.body?.dryRun === true;

    if (!messages.length) {
      return res.status(400).json({ error: 'messages must include at least one user message' });
    }

    if (dryRun) {
      return res.json(
        finalizeAssistResponse({
          message: 'Dry-run concierge proposal. No model call was made.',
          rawProposal: dryRunAssistProposal(messages, currentConfig),
          currentConfig,
          catalog,
        }),
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!cli.provider && !apiKey) {
      return res.status(503).json({
        error: 'OPENROUTER_API_KEY is not set — either pick a local CLI substrate or use dry run.',
      });
    }

    const prompt =
      loadPromptFile(CHAT_ASSIST_PROMPT_FILE) || 'You are a concise stage manager for a pedagogical drama.';
    const system = `${prompt}\n\nCATALOG\n${catalog.text}`;
    const userPayload = JSON.stringify(
      {
        messages,
        currentConfig,
        requiredJsonShape: {
          message: 'short prose reply',
          proposal: {
            features: { approach: 'optional', critic: 'optional', stance: 'optional', learnerModel: 'optional' },
            topic: 'optional',
            curriculumRef: 'optional or null',
            lectureRef: 'optional or null',
            director: { mode: 'optional', act: 'optional', beat: 'optional', scene: 'optional', note: 'optional' },
            personaId: 'optional',
            mode: 'optional human|teacher|auto',
            action: 'optional none|start_scene|open_batch_launcher',
            rationale: 'optional string or object',
          },
        },
      },
      null,
      2,
    );

    const call = async (user) => {
      if (cli.provider) return callCli(cli, { system, user });
      const modelRef = resolveOpenRouterModelOverride(CHAT_ASSIST_MODEL);
      return callModel(apiKey, {
        modelId: modelRef.model,
        system,
        user,
        temperature: 0.2,
        maxTokens: 900,
      });
    };

    let out = await call(userPayload);
    let parsed = extractAssistJson(out.content);
    if (!parsed) {
      out = await call(`${userPayload}\n\nYour previous response was not valid JSON. Return one JSON object only.`);
      parsed = extractAssistJson(out.content);
    }

    if (!parsed) {
      return res.json({
        message: compactAssistLine(out.content, 1200) || 'The concierge did not return parseable JSON.',
        proposal: null,
        resolved: null,
        totals: {
          latencyMs: Date.now() - startedAt,
          outputTokens: out.outputTokens || 0,
        },
      });
    }

    return res.json(
      finalizeAssistResponse({
        message: parsed.message,
        rawProposal: parsed.proposal,
        currentConfig,
        totals: {
          latencyMs: Date.now() - startedAt,
          outputTokens: out.outputTokens || 0,
        },
        catalog,
      }),
    );
  } catch (err) {
    console.error('[chat] assist error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate a learner turn for auto-learner mode. Uses the interaction engine's
// generateLearnerResponse so when a cell has `learner_architecture: ego_superego`
// we get the learner's own ego/superego deliberation trace — symmetric to the tutor.
router.post('/learner-turn', async (req, res) => {
  const {
    cellName,
    history = [],
    topic = 'general conversation',
    lectureRef = null,
    curriculumRef = null,
    director = null,
    personaId = 'eager_novice',
    dryRun = false,
  } = req.body || {};
  const cli = normalizeCli(req.body);

  if (!cellName) return res.status(400).json({ error: 'cellName is required' });

  const profile = evalConfigLoader.loadTutorAgents()?.profiles?.[cellName];
  if (!profile) return res.status(404).json({ error: `cell "${cellName}" not found` });

  const learnerProfileName = profile.learner_architecture || 'unified';
  const lastTutor = [...history].reverse().find((h) => h.role === 'tutor');
  const tutorMessage = lastTutor?.content || `Let's begin a conversation about ${topic}. What's on your mind?`;
  const curriculum = loadCurriculumContext({ lectureRef, curriculumRef });
  const directorPlan = buildChatDirectorPlan({ sourceContext: curriculum, director, topic });

  if (dryRun === true) {
    return res.json(buildDryRunLearnerTurn({ learnerProfileName, personaId, topic, tutorMessage }));
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!cli.provider && !apiKey) {
    return res.status(503).json({
      error: 'OPENROUTER_API_KEY is not set — either pick a local CLI substrate or set the key.',
    });
  }

  // Build an llmCall adapter the engine expects: (modelRef, systemPrompt, messages, options)
  // When a CLI substrate is selected, every call routes through the local
  // `claude` or `codex` CLI — same interface, different substrate. Otherwise: OpenRouter.
  const llmCall = async (modelRef, systemPrompt, messages, options = {}) => {
    if (cli.provider) {
      const userPrompt = (messages || []).map((m) => m.content).join('\n\n');
      const out = await callCli(cli, { system: systemPrompt, user: userPrompt });
      return {
        content: out.content,
        usage: { inputTokens: out.inputTokens, outputTokens: out.outputTokens },
        model: cliModelLabel(cli),
        provider: `${cli.provider}-cli`,
        latencyMs: out.latencyMs,
      };
    }
    let modelId = modelRef;
    if (!modelRef) {
      modelId = 'nvidia/nemotron-3-nano-30b-a3b';
    } else if (!modelRef.includes('/') && modelRef.includes('.')) {
      modelId = evalConfigLoader.resolveModel(modelRef).model;
    }
    const start = Date.now();
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:8081/chat',
        'X-Title': 'Machine Spirits Chat (auto-learner)',
      },
      body: JSON.stringify({
        model: modelId,
        temperature: options.temperature ?? 0.7,
        max_tokens: Math.max(options.maxTokens ?? CHAT_MIN_MAX_TOKENS, CHAT_MIN_MAX_TOKENS),
        messages: [
          { role: 'system', content: systemPrompt },
          ...(messages || []).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        ],
      }),
    });
    const latencyMs = Date.now() - start;
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
    }
    const payload = await response.json();
    return {
      content: payload.choices?.[0]?.message?.content || '',
      usage: {
        inputTokens: payload.usage?.prompt_tokens || 0,
        outputTokens: payload.usage?.completion_tokens || 0,
      },
      model: modelId,
      latencyMs,
    };
  };

  const trace = {
    metrics: {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      learnerInputTokens: 0,
      learnerOutputTokens: 0,
      tutorInputTokens: 0,
      tutorOutputTokens: 0,
    },
  };

  try {
    const result = await interactionEngine.generateLearnerResponse({
      tutorMessage,
      topic,
      conversationHistory: history.map((m) => ({ role: m.role, content: m.content })),
      learnerProfile: learnerProfileName,
      personaId,
      llmCall,
      memoryContext: null,
      directorPlan,
      trace,
    });

    const deliberation = normalizeLearnerDeliberation(result.internalDeliberation || []);
    res.json({
      message: result.externalMessage || '',
      deliberation,
      emotionalState: result.emotionalState || null,
      understandingLevel: result.understandingLevel || null,
      suggestsEnding: !!result.suggestsEnding,
      learnerProfile: learnerProfileName,
      personaId,
      totals: {
        inputTokens: trace.metrics.learnerInputTokens,
        outputTokens: trace.metrics.learnerOutputTokens,
        latencyMs: deliberation.reduce((s, d) => s + (d.latencyMs || 0), 0),
      },
    });
  } catch (err) {
    console.error('[chat] learner-turn error:', err);
    res.status(500).json({ error: err.message });
  }
});

// The engine tags learner deliberation entries as
// 'ego_initial' / 'superego' / 'ego_revision' (plus sometimes 'unified' for single-agent).
// Normalize to the same shape the tutor trace uses so the frontend renders both identically.
function normalizeLearnerDeliberation(entries) {
  return entries.map((e) => {
    const role = e.role || '';
    let normalizedRole;
    let label;
    if (role === 'ego_initial' || role === 'ego') {
      normalizedRole = 'ego';
      label = 'Ego — initial draft';
    } else if (role === 'superego') {
      normalizedRole = 'superego';
      label = 'Superego — critique';
    } else if (role === 'ego_revision' || role === 'ego_final' || role === 'synthesis') {
      normalizedRole = 'ego_revision';
      label = 'Ego revision — final';
    } else if (role === 'unified' || role === 'unified_learner') {
      normalizedRole = 'ego';
      label = 'Learner — unified response';
    } else {
      normalizedRole = 'ego';
      label = `Learner — ${role}`;
    }
    return {
      role: normalizedRole,
      label,
      content: e.content || '',
      model: e.metrics?.model || null,
      provider: e.metrics?.provider || null,
      latencyMs: e.metrics?.latencyMs || null,
      inputTokens: e.metrics?.inputTokens || 0,
      outputTokens: e.metrics?.outputTokens || 0,
    };
  });
}

function dryRunMetrics(model = 'dry-run') {
  return {
    model,
    provider: 'dry-run',
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

// Live-chat sampling overrides. Blank/absent fields fall through to the cell
// YAML hyperparameters. Temperature applies to the tutor ego only (the
// superego review keeps its own configured temperature); maxTokens caps both.
function normalizeSampling(raw) {
  const out = { temperature: null, maxTokens: null };
  if (!raw || typeof raw !== 'object') return out;
  if (raw.temperature != null && raw.temperature !== '') {
    const t = Number(raw.temperature);
    if (Number.isFinite(t)) out.temperature = Math.min(Math.max(t, 0), 2);
  }
  if (raw.maxTokens != null && raw.maxTokens !== '') {
    const m = Number(raw.maxTokens);
    if (Number.isFinite(m)) out.maxTokens = Math.min(Math.max(Math.round(m), 64), 8000);
  }
  return out;
}

function resolveOpenRouterModelOverride(raw) {
  if (raw == null) return null;
  const value =
    typeof raw === 'string' ? raw.trim() : typeof raw === 'object' ? String(raw.model || raw.alias || '').trim() : '';
  if (!value || value === 'cell-default') return null;

  if (typeof raw === 'object' && raw.provider && raw.provider !== 'openrouter') {
    throw new Error(`chat model overrides currently support openrouter only, got "${raw.provider}"`);
  }
  if (value.includes('/') || value.startsWith('~')) {
    return evalConfigLoader.resolveModel({ provider: 'openrouter', model: value });
  }
  if (value.startsWith('openrouter.')) {
    return evalConfigLoader.resolveModel(value);
  }
  if (value.includes('.')) {
    throw new Error(`chat model overrides currently support openrouter only, got "${value}"`);
  }
  return evalConfigLoader.resolveModel(`openrouter.${value}`);
}

function buildDryRunLearnerTurn({ learnerProfileName, personaId, topic, tutorMessage }) {
  const dynamicLearner = String(learnerProfileName || '').startsWith('ego_superego');
  const message = `(dry run) I can answer from a learner stance: I heard the tutor ask about ${topic}, and I would try a tentative explanation before checking it.`;
  const rawDeliberation = dynamicLearner
    ? [
        {
          role: 'ego_initial',
          content: `(dry run) Initial learner reaction to: ${tutorMessage}`,
          metrics: dryRunMetrics('dry-run/learner-ego'),
        },
        {
          role: 'superego',
          content: '(dry run) Check whether the learner is merely agreeing or naming what remains unclear.',
          metrics: dryRunMetrics('dry-run/learner-superego'),
        },
        {
          role: 'ego_revision',
          content: message,
          metrics: dryRunMetrics('dry-run/learner-ego-revision'),
        },
      ]
    : [
        {
          role: 'unified',
          content: message,
          metrics: dryRunMetrics('dry-run/unified-learner'),
        },
      ];
  const deliberation = normalizeLearnerDeliberation(rawDeliberation);
  return {
    message,
    deliberation,
    emotionalState: 'curious',
    understandingLevel: dynamicLearner ? 'revising' : 'initial',
    suggestsEnding: false,
    learnerProfile: learnerProfileName,
    personaId,
    dryRun: true,
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    },
  };
}

function buildDryRunTutorTurn({
  profile,
  learnerMessage,
  topic,
  egoModelOverride = null,
  superegoModelOverride = null,
}) {
  const promptType = profile.factors?.prompt_type || null;
  const recognitionMode = !!profile.recognition_mode;
  const egoDryRunModel = egoModelOverride?.model || 'dry-run/tutor-ego';
  const superegoDryRunModel = superegoModelOverride?.model || 'dry-run/tutor-superego';
  const egoDraft = `(dry run) I hear the learner saying: "${learnerMessage}". For ${topic}, I would answer with a short worked example and then ask the learner to make the next move.`;
  const deliberation = [
    {
      role: 'ego',
      label: 'Ego — initial draft',
      content: egoDraft,
      model: egoDryRunModel,
      provider: egoModelOverride?.provider || 'dry-run',
      temperature: 0,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
    },
  ];
  let finalMessage = egoDraft;
  let wasRevised = false;

  if (profile.superego) {
    const critique = [
      'CRITIQUE: (dry run) Keep the response concrete and avoid over-explaining before the learner acts.',
      'IMPROVED: (dry run) Let us test your idea with one small example. What would happen first, and what evidence would tell you that move is right?',
    ].join('\n');
    finalMessage =
      '(dry run) Let us test your idea with one small example. What would happen first, and what evidence would tell you that move is right?';
    wasRevised = true;
    deliberation.push(
      {
        role: 'superego',
        label: 'Superego — critique',
        content: critique,
        model: superegoDryRunModel,
        provider: superegoModelOverride?.provider || 'dry-run',
        temperature: 0,
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
      },
      {
        role: 'ego_revision',
        label: 'Ego revision — adopts superego edits',
        content: finalMessage,
        derivedFrom: 'superego IMPROVED section',
      },
    );
  }

  return {
    finalMessage,
    wasRevised,
    deliberation,
    architecture: {
      hasSuperego: !!profile.superego,
      promptType,
      recognitionMode,
    },
    dryRun: true,
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
    },
  };
}

router.post('/turn', async (req, res) => {
  // learnerMessage is only read; the others are mutated by the pilot-mode
  // override block below (cellName, lectureRef, history, topic, useClaudeCli).
  const { learnerMessage } = req.body || {};
  const dryRun = req.body?.dryRun || false;
  // Curtain-up turn: the tutor speaks first, with no learner line yet.
  const instigate = req.body?.instigate === true;
  let {
    cellName,
    history = [],
    topic = 'general conversation',
    lectureRef = null,
    curriculumRef = null,
    director = null,
    useClaudeCli = false,
  } = req.body || {};
  const { modelOverrides = null, egoModelOverride = null, superegoModelOverride = null } = req.body || {};
  const sampling = normalizeSampling(req.body?.sampling);
  let cli = normalizeCli(req.body);
  const sessionId = req.body?.sessionId || null;

  if ((!learnerMessage || !String(learnerMessage).trim()) && !instigate) {
    return res.status(400).json({ error: 'learnerMessage is required (or set instigate: true)' });
  }

  // Pilot mode: the session record is authoritative for cellName, lectureRef,
  // history, and substrate. Anything client-supplied for those fields is
  // ignored to preserve blinding and prevent participants from steering
  // their own assignment.
  let pilotSession = null;
  if (sessionId) {
    pilotSession = pilotStore.getSession(sessionId);
    if (!pilotSession) {
      return res.status(404).json({ error: `pilot session ${sessionId} not found` });
    }
    if (pilotSession.status !== pilotStore.PILOT_STATUSES.TUTORING) {
      return res.status(409).json({
        error: `pilot session not in tutoring phase (current: ${pilotSession.status})`,
        code: 'PILOT_WRONG_PHASE',
      });
    }
    if (pilotStore.isTutoringExpired(pilotSession)) {
      pilotStore.endTutoring(sessionId, { reason: 'timed_out' });
      return res.status(410).json({
        error: 'tutoring time cap exceeded',
        code: 'PILOT_TIMED_OUT',
      });
    }
    cellName = pilotSession.condition_cell;
    lectureRef = pilotSession.scenario_lecture_ref;
    curriculumRef = null;
    director = null;
    useClaudeCli = false; // pilot is locked to OpenRouter
    cli = { provider: null, model: null, effort: null };
    if (instigate) return res.status(400).json({ error: 'instigate is not allowed for pilot sessions' });
    // Authoritative server-side history — replay from DB rather than trust client
    const dbTurns = pilotStore.listTurns(sessionId);
    history = dbTurns.map((t) => ({ role: t.role, content: t.content }));
    if (!topic || topic === 'general conversation') {
      topic = 'fractions tutoring session';
    }
  }

  if (!cellName) return res.status(400).json({ error: 'cellName is required' });

  const data = evalConfigLoader.loadTutorAgents();
  const profile = data?.profiles?.[cellName];
  if (!profile) return res.status(404).json({ error: `cell "${cellName}" not found` });
  if (!profile.ego) return res.status(400).json({ error: `cell "${cellName}" has no ego config` });

  let egoOverrideRef = null;
  let superegoOverrideRef = null;
  if (!pilotSession && !cli.provider) {
    try {
      const overrides = modelOverrides && typeof modelOverrides === 'object' ? modelOverrides : {};
      egoOverrideRef = resolveOpenRouterModelOverride(egoModelOverride ?? overrides.ego ?? overrides.tutorEgo);
      superegoOverrideRef = resolveOpenRouterModelOverride(
        superegoModelOverride ?? overrides.superego ?? overrides.tutorSuperego,
      );
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (dryRun === true) {
    if (pilotSession) {
      return res.status(400).json({ error: 'dryRun is not allowed for pilot sessions' });
    }
    return res.json(
      buildDryRunTutorTurn({
        profile,
        learnerMessage: instigate ? '(curtain rises — the tutor opens the scene)' : String(learnerMessage),
        topic: String(topic),
        egoModelOverride: egoOverrideRef,
        superegoModelOverride: superegoOverrideRef,
      }),
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!cli.provider && !apiKey) {
    return res.status(503).json({
      error: 'OPENROUTER_API_KEY is not set — either pick a local CLI substrate or set the key.',
    });
  }

  // Streaming branch: ?stream=1 + single-agent cell + OpenRouter substrate.
  // Multi-agent cells fall through to the non-streaming path because the
  // superego review needs the complete ego output before it can begin.
  // Claude CLI substrate is also non-streaming (the CLI returns once).
  const wantsStream = req.query.stream === '1' || req.query.stream === 'true';
  if (wantsStream && !profile.superego && !cli.provider) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      const curriculum = loadCurriculumContext({ lectureRef, curriculumRef });
      const directorPlan = buildChatDirectorPlan({ sourceContext: curriculum, director, topic });
      const result = await streamSingleAgentTurn({
        profile,
        apiKey,
        history,
        learnerMessage: String(learnerMessage),
        topic: String(topic),
        curriculum,
        directorPlan,
        egoModelOverride: egoOverrideRef,
        temperature: sampling.temperature,
        maxTokens: sampling.maxTokens,
        onDelta: (d) => send({ delta: d }),
      });

      // Some ego prompts emit JSON suggestion arrays — extract the prose.
      // If the cleaned text differs, tell the client to replace its
      // accumulator with the canonical version.
      const renderableFinal = extractTutorMessage(result.finalMessage) || result.finalMessage;
      if (renderableFinal !== result.finalMessage) {
        send({ replace: renderableFinal });
      }

      if (pilotSession) {
        const egoPromptText = loadPromptFile(profile.ego.prompt_file);
        const configHash = pilotStore.computeConfigHash({
          cellName,
          egoConfig: profile.ego,
          superegoConfig: null,
          egoPromptText,
          superegoPromptText: '',
          topic,
          lectureText: curriculum?.text || '',
        });

        pilotStore.appendTurn(sessionId, {
          role: 'learner',
          content: String(learnerMessage),
          configHash,
        });

        const tutorTurn = pilotStore.appendTurn(sessionId, {
          role: 'tutor',
          content: renderableFinal,
          deliberation: result.deliberation,
          wasRevised: false,
          configHash,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs: result.latencyMs,
          egoModel: result.egoModel,
        });

        const refreshed = pilotStore.getSession(sessionId);
        send({
          done: true,
          finalMessage: renderableFinal,
          sessionId,
          turnIndex: tutorTurn.turnIndex,
          tutoringTimeRemainingMs: pilotStore.tutoringTimeRemainingMs(refreshed),
        });
      } else {
        send({
          done: true,
          finalMessage: renderableFinal,
          architecture: {
            hasSuperego: false,
            promptType: profile.factors?.prompt_type || null,
            recognitionMode: !!profile.recognition_mode,
          },
          totals: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            latencyMs: result.latencyMs,
          },
        });
      }
    } catch (err) {
      console.error('[chat] stream turn error:', err);
      send({ error: err.message });
    } finally {
      res.end();
    }
    return;
  }

  try {
    const curriculum = loadCurriculumContext({ lectureRef, curriculumRef });
    const directorPlan = buildChatDirectorPlan({ sourceContext: curriculum, director, topic });
    const trace = await runTutorTurn({
      profile,
      apiKey,
      history,
      instigate,
      learnerMessage: String(learnerMessage || ''),
      topic: String(topic),
      curriculum,
      directorPlan,
      useClaudeCli: !!useClaudeCli,
      cli,
      egoModelOverride: egoOverrideRef,
      superegoModelOverride: superegoOverrideRef,
      temperature: sampling.temperature,
      maxTokens: sampling.maxTokens,
    });

    if (pilotSession) {
      // Persist BOTH the learner message and the tutor response. config_hash
      // is computed once and shared across the pair (same model state for
      // this round); dialogue_content_hash is computed cumulatively inside
      // pilotStore.appendTurn.
      const egoPromptText = loadPromptFile(profile.ego.prompt_file);
      const superegoPromptText = profile.superego ? loadPromptFile(profile.superego.prompt_file) : '';
      const configHash = pilotStore.computeConfigHash({
        cellName,
        egoConfig: profile.ego,
        superegoConfig: profile.superego,
        egoPromptText,
        superegoPromptText,
        topic,
        lectureText: curriculum?.text || '',
      });

      pilotStore.appendTurn(sessionId, {
        role: 'learner',
        content: String(learnerMessage),
        configHash,
      });

      const egoEntry = trace.deliberation.find((d) => d.role === 'ego');
      const superegoEntry = trace.deliberation.find((d) => d.role === 'superego');

      const tutorTurn = pilotStore.appendTurn(sessionId, {
        role: 'tutor',
        content: trace.finalMessage,
        deliberation: trace.deliberation,
        wasRevised: trace.wasRevised,
        configHash,
        inputTokens: trace.totals?.inputTokens,
        outputTokens: trace.totals?.outputTokens,
        latencyMs: trace.totals?.latencyMs,
        egoModel: egoEntry?.model || null,
        superegoModel: superegoEntry?.model || null,
      });

      const refreshed = pilotStore.getSession(sessionId);
      return res.json({
        finalMessage: trace.finalMessage,
        sessionId,
        turnIndex: tutorTurn.turnIndex,
        tutoringTimeRemainingMs: pilotStore.tutoringTimeRemainingMs(refreshed),
      });
    }

    if (curriculum) {
      trace.curriculum = {
        kind: curriculum.kind,
        courseId: curriculum.courseId,
        courseTitle: curriculum.courseTitle,
        lectureRef: curriculum.lectureRef || null,
        sourceRef: curriculum.sourceRef || curriculum.lectureRef || null,
        moduleId: curriculum.moduleId || null,
        title: curriculum.title || null,
        dramaticShape: curriculum.dramaticShape || null,
      };
    }
    res.json(trace);
  } catch (err) {
    console.error('[chat] turn error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

// Compatibility exports for older callers. The implementations are owned by
// route-free domain services; new non-route consumers use legacyChatEngine.js.
export { runTutorTurn, loadCurriculumContext, loadPromptFile };
