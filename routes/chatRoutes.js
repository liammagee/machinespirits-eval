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
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import YAML from 'yaml';
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import interactionEngine, { extractTutorMessage } from '../services/learnerTutorInteractionEngine.js';
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

const LOCAL_PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
const CORE_PROMPTS_DIR = path.resolve(__dirname, '..', 'tutor-core', 'prompts');
const EVAL_DB_PATH = process.env.EVAL_DB_PATH || path.join(ROOT_DIR, 'data', 'evaluations.db');

function loadPromptFile(filename) {
  if (!filename) return '';
  const local = path.join(LOCAL_PROMPTS_DIR, filename);
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const core = path.join(CORE_PROMPTS_DIR, filename);
  if (fs.existsSync(core)) return fs.readFileSync(core, 'utf8');
  return '';
}

// Interface affordance prepended to every chat/pilot tutor turn at RUNTIME — it
// is deliberately NOT baked into the canonical cell prompt files, so the eval
// factorial's prompt_content_hash / config_hash stay untouched (this only shapes
// the live chat + pilot surfaces, not scored eval runs). Without it, tutors
// routinely say "watch this simulation" / "see the animation below" and then
// render nothing — actively unhelpful in a plain-text chat. Steer them to make
// ideas concrete in text instead.
const INTERFACE_AFFORDANCE = `==============================
INTERFACE CONSTRAINTS (read carefully)
==============================
You are speaking in a plain-text chat. Your reply is rendered as text with inline
math only. You CANNOT display interactive simulations, animations, applets,
sliders, graphs, videos, or images — there is no canvas the learner can watch.
Never tell the learner to "watch the simulation", "see the animation", "drag the
slider", or refer to any visual the interface cannot actually show; promising a
visual you can't render is worse than not mentioning one. Instead make the idea
concrete in text: worked numeric examples, step-by-step reasoning, and small
figures drawn with characters (e.g. a number line 0 --|--|--|-- 1, or 3/8 as
[##....] ) when a picture would help.`;

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

// Several content packages live at the repo root (content/, content-test-*/).
// Each has courses/<id>/course.md (with YAML frontmatter) and lecture-N.md files.
const REPO_ROOT = path.resolve(__dirname, '..');
const CONTENT_PACKAGES = [
  { id: 'main', dir: 'content', label: 'Main' },
  { id: 'history-tech', dir: 'content-history-tech', label: 'History of Tech' },
  { id: 'ethics-ai', dir: 'content-ethics-ai', label: 'Ethics of AI' },
  { id: 'ai-literacy', dir: 'content-ai-literacy', label: 'AI Literacy' },
  { id: 'stats', dir: 'content-stats-skeptics', label: 'Statistics' },
  { id: 'programming', dir: 'content-test-programming', label: 'Programming' },
  { id: 'creative', dir: 'content-test-creative', label: 'Creative' },
  { id: 'elementary', dir: 'content-test-elementary', label: 'Elementary' },
  { id: 'sel', dir: 'content-test-sel', label: 'SEL' },
  { id: 'support', dir: 'content-test-support', label: 'Support' },
  { id: 'poetics-rhetoric', dir: 'content-poetics-rhetoric', label: 'Poetics & Rhetoric' },
];

const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const SCENE_CONTEXT_MAX_CHARS = 20000;
const SCENE_DIRECTOR_MAX_CHARS = 8000;
const AI_FOUNDATIONS_FILES = {
  curriculum: 'ai-foundations.curriculum.yaml',
  worlds: 'ai-foundations.worlds.yaml',
  rhetoricalDramas: 'ai-foundations.rhetorical-dramas.yaml',
  mvpDramas: 'ai-foundations.mvp-dramas.yaml',
  generatedDramas: 'ai-foundations.dramas.yaml',
  plans: 'ai-foundations.rhetorical-dramatic-plans.yaml',
};

function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return {};
  const yaml = raw.slice(3, end).trim();
  const out = {};
  for (const line of yaml.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

function readLectureTitle(lectureMd) {
  // First non-empty H2 or H1
  const lines = lectureMd.split('\n').slice(0, 40);
  for (const line of lines) {
    const m = line.match(/^#+\s*(?:<[^>]+>)?\s*(.+?)\s*$/);
    if (m && m[1] && !m[1].startsWith('---')) return m[1].replace(/<[^>]+>/g, '').trim();
  }
  return null;
}

function listCurricula() {
  const packages = [];
  for (const pkg of CONTENT_PACKAGES) {
    const coursesDir = path.join(REPO_ROOT, pkg.dir, 'courses');
    if (!fs.existsSync(coursesDir)) continue;
    const courseIds = fs.readdirSync(coursesDir).filter((id) => {
      const f = path.join(coursesDir, id, 'course.md');
      return fs.existsSync(f);
    });
    if (courseIds.length === 0) continue;
    const courses = courseIds.map((id) => {
      const raw = fs.readFileSync(path.join(coursesDir, id, 'course.md'), 'utf-8');
      const meta = parseFrontmatter(raw);
      const lectureFiles = fs
        .readdirSync(path.join(coursesDir, id))
        .filter((f) => /^lecture-\d+\.md$/.test(f))
        .sort((a, b) => {
          const na = parseInt(a.match(/\d+/)[0], 10);
          const nb = parseInt(b.match(/\d+/)[0], 10);
          return na - nb;
        });
      const lectures = lectureFiles.map((f) => {
        const num = parseInt(f.match(/\d+/)[0], 10);
        const ref = `${id}-lecture-${num}`;
        try {
          const raw2 = fs.readFileSync(path.join(coursesDir, id, f), 'utf-8');
          const title = readLectureTitle(raw2) || `Lecture ${num}`;
          return { ref, num, title };
        } catch {
          return { ref, num, title: `Lecture ${num}` };
        }
      });
      return {
        id,
        title: meta.title || `Course ${id}`,
        instructor: meta.instructor || null,
        semester: meta.semester || null,
        packageDir: pkg.dir,
        lectures,
      };
    });
    packages.push({ id: pkg.id, label: pkg.label, dir: pkg.dir, courses });
  }
  return packages;
}

function clipText(text, maxChars = SCENE_CONTEXT_MAX_CHARS) {
  const value = String(text || '').trim();
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[truncated for token budget]`;
}

function readYamlFile(filename) {
  const file = path.join(CURRICULUM_DIR, filename);
  if (!fs.existsSync(file)) return {};
  return YAML.parse(fs.readFileSync(file, 'utf8')) || {};
}

function loadAiFoundationsArtifacts() {
  return {
    curriculum: readYamlFile(AI_FOUNDATIONS_FILES.curriculum),
    worlds: readYamlFile(AI_FOUNDATIONS_FILES.worlds),
    rhetoricalDramas: readYamlFile(AI_FOUNDATIONS_FILES.rhetoricalDramas),
    mvpDramas: readYamlFile(AI_FOUNDATIONS_FILES.mvpDramas),
    generatedDramas: readYamlFile(AI_FOUNDATIONS_FILES.generatedDramas),
    plans: readYamlFile(AI_FOUNDATIONS_FILES.plans),
  };
}

function moduleSequence(moduleId, modulesById = new Map()) {
  const seq = Number(modulesById.get(moduleId)?.sequence);
  return Number.isFinite(seq) ? seq : 999;
}

function firstListItem(value) {
  return Array.isArray(value) && value.length ? value[0] : null;
}

function listCurriculumSceneSources({ includeRaw = false } = {}) {
  const artifacts = loadAiFoundationsArtifacts();
  const modules = Array.isArray(artifacts.curriculum.modules) ? artifacts.curriculum.modules : [];
  const modulesById = new Map(modules.map((m) => [m.id, m]));
  const sources = [];

  for (const module of modules) {
    const source = {
      ref: `module:${module.id}`,
      kind: 'module',
      sourceGroup: 'curriculum modules',
      id: module.id,
      label: `${module.id} - ${module.title}`,
      title: module.title,
      topic: firstListItem(module.canonical_tasks) || module.essential_question || module.title,
      moduleId: module.id,
      moduleTitle: module.title,
      artifact: module.main_artifact || null,
      verifier: module.primary_verifier || null,
      dramaticShape: 'curriculum spine',
      summary: module.essential_question || '',
      sortGroup: 10,
      sortKey: moduleSequence(module.id, modulesById),
    };
    if (includeRaw) source._raw = module;
    sources.push(source);
  }

  const worlds = Array.isArray(artifacts.worlds.world_adaptation_specs) ? artifacts.worlds.world_adaptation_specs : [];
  for (const world of worlds) {
    const module = modulesById.get(world.module_id);
    const verifier = firstListItem(world.learner_state_evidence?.verifier_signals) || module?.primary_verifier || null;
    const source = {
      ref: `world:${world.id}`,
      kind: 'world',
      sourceGroup: 'world policies',
      id: world.id,
      label: `${world.module_id} world - ${world.module_title || module?.title || world.id}`,
      title: world.module_title || module?.title || world.id,
      topic: module?.essential_question || module?.title || world.id,
      moduleId: world.module_id || null,
      moduleTitle: world.module_title || module?.title || null,
      artifact: module?.main_artifact || null,
      verifier,
      dramaticShape: 'world constraint policy',
      summary: `Allowed actions: ${(world.action_policy?.preferred_action_families || []).slice(0, 4).join(', ')}`,
      sortGroup: 20,
      sortKey: moduleSequence(world.module_id, modulesById),
    };
    if (includeRaw) {
      source._raw = world;
      source._module = module || null;
    }
    sources.push(source);
  }

  const addDramaSet = (key, label, sortGroup, dramas = []) => {
    for (const drama of dramas) {
      const binding = drama.curriculum_binding || {};
      const module = modulesById.get(binding.module_id);
      const source = {
        ref: `drama:${key}#${drama.id}`,
        kind: key === 'rhetorical' ? 'rhetorical_drama' : key === 'mvp' ? 'mvp_drama' : 'generated_drama',
        sourceGroup: label,
        id: drama.id,
        label: `${binding.module_id || drama.id} - ${drama.topic || drama.scenario_name || drama.id}`,
        title: drama.topic || drama.scenario_name || drama.id,
        topic: drama.topic || module?.essential_question || drama.scenario_name || drama.id,
        moduleId: binding.module_id || null,
        moduleTitle: binding.module_title || module?.title || null,
        artifact: binding.main_artifact || module?.main_artifact || null,
        verifier: binding.primary_verifier || module?.primary_verifier || null,
        dramaticShape: drama.dramatic_shape || drama.dialogue_approach || 'pedagogical drama',
        persona: drama.persona || null,
        directorPolicy: drama.director_revisit_policy || drama.tutor_adaptation_policy || null,
        turnCount: Array.isArray(drama.turn_plan) ? drama.turn_plan.length : 0,
        summary: drama.learner_start_state || drama.dramatic_shape || '',
        sortGroup,
        sortKey: moduleSequence(binding.module_id, modulesById),
      };
      if (includeRaw) {
        source._raw = drama;
        source._module = module || null;
        source._sourceKey = key;
      }
      sources.push(source);
    }
  };

  addDramaSet('rhetorical', 'rhetorical dramas', 30, artifacts.rhetoricalDramas.dramas || []);
  addDramaSet('mvp', 'mvp dramas', 40, artifacts.mvpDramas.dramas || []);
  addDramaSet('generated', 'generated dramas', 50, artifacts.generatedDramas.dramas || []);

  const plans = Array.isArray(artifacts.plans.rhetorical_dramatic_plans)
    ? artifacts.plans.rhetorical_dramatic_plans
    : [];
  for (const plan of plans) {
    const module = modulesById.get(plan.module_id);
    const source = {
      ref: `plan:${plan.id}`,
      kind: 'dramatic_plan',
      sourceGroup: 'act/scene plans',
      id: plan.id,
      label: `${plan.module_id} plan - ${plan.curriculum_spine?.target_task || plan.module_title || plan.id}`,
      title: plan.curriculum_spine?.target_task || plan.module_title || plan.id,
      topic: plan.curriculum_spine?.target_task || module?.essential_question || plan.module_title || plan.id,
      moduleId: plan.module_id || null,
      moduleTitle: plan.module_title || module?.title || null,
      artifact: plan.curriculum_spine?.artifact || module?.main_artifact || null,
      verifier: plan.curriculum_spine?.verifier || module?.primary_verifier || null,
      dramaticShape: plan.pacing?.dramatic_shape || plan.pacing?.beat_pattern || 'dramatic plan',
      directorPolicy: plan.pacing?.beat_pattern || null,
      turnCount: Array.isArray(plan.pacing?.turn_plan) ? plan.pacing.turn_plan.length : 0,
      summary: plan.scene
        ? `${plan.scene.setting || ''}; ${plan.scene.object || ''}; ${plan.scene.stakes || ''}`.trim()
        : '',
      sortGroup: 60,
      sortKey: moduleSequence(plan.module_id, modulesById),
    };
    if (includeRaw) {
      source._raw = plan;
      source._module = module || null;
    }
    sources.push(source);
  }

  return sources
    .sort((a, b) => {
      if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup;
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.label.localeCompare(b.label);
    })
    .map((source) => {
      if (includeRaw) return source;
      const { _raw, _module, _sourceKey, sortGroup: _sortGroup, sortKey: _sortKey, ...pub } = source;
      return pub;
    });
}

router.get('/curricula', (req, res) => {
  try {
    res.json({ packages: listCurricula(), sceneSources: listCurriculumSceneSources() });
  } catch (err) {
    console.error('[chat] curricula error:', err);
    res.status(500).json({ error: err.message });
  }
});

function findCurriculumSceneSource(curriculumRef) {
  if (!curriculumRef) return null;
  return listCurriculumSceneSources({ includeRaw: true }).find((source) => source.ref === curriculumRef) || null;
}

function yamlSnippet(value, maxChars = 6000) {
  if (value == null) return '';
  return clipText(YAML.stringify(value).trim(), maxChars);
}

function buildModuleContextText(module) {
  const lines = [
    `CURRICULUM MODULE ${module.id}: ${module.title}`,
    module.essential_question ? `Essential question: ${module.essential_question}` : null,
    module.main_artifact ? `Main artifact: ${module.main_artifact}` : null,
    module.primary_verifier ? `Verifier: ${module.primary_verifier}` : null,
    Array.isArray(module.canonical_tasks)
      ? `Canonical tasks:\n${module.canonical_tasks.map((t) => `- ${t}`).join('\n')}`
      : null,
    Array.isArray(module.knowledge_components)
      ? `Knowledge components:\n${module.knowledge_components.map((kc) => `- ${kc.id}: ${kc.statement}`).join('\n')}`
      : null,
    Array.isArray(module.misconception_signatures)
      ? `Misconception signatures:\n${module.misconception_signatures.map((m) => `- ${m}`).join('\n')}`
      : null,
    module.transfer_challenge ? `Transfer challenge: ${module.transfer_challenge}` : null,
    module.mastery_gate ? `Mastery gate: ${module.mastery_gate}` : null,
  ].filter(Boolean);
  return clipText(lines.join('\n\n'));
}

function buildWorldContextText(world, module = null) {
  const evidence = world.learner_state_evidence || {};
  const action = world.action_policy || {};
  const lines = [
    `WORLD ADAPTATION SPEC ${world.id}: ${world.module_title || module?.title || world.module_id}`,
    module ? buildModuleContextText(module) : null,
    Array.isArray(evidence.verifier_signals)
      ? `Verifier signals:\n${evidence.verifier_signals.map((s) => `- ${s}`).join('\n')}`
      : null,
    Array.isArray(evidence.knowledge_components)
      ? `Observable knowledge evidence:\n${evidence.knowledge_components
          .map((kc) => `- ${kc.kc_id}: ${kc.statement}\n  evidence: ${(kc.observable_evidence || []).join('; ')}`)
          .join('\n')}`
      : null,
    Array.isArray(evidence.misconception_signatures)
      ? `Misconception evidence:\n${evidence.misconception_signatures
          .map((m) => `- ${m.statement}\n  observable: ${(m.observable_evidence || []).join('; ')}`)
          .join('\n')}`
      : null,
    `Action policy:\n${yamlSnippet(action, 5000)}`,
    Array.isArray(world.expected_transitions)
      ? `Expected transitions:\n${yamlSnippet(world.expected_transitions, 5000)}`
      : null,
  ].filter(Boolean);
  return clipText(lines.join('\n\n'));
}

function buildDramaContextText(drama, module = null) {
  const binding = drama.curriculum_binding || {};
  const publicConstraints = binding.rhetorical_public_constraints || {};
  const lines = [
    `PEDAGOGICAL DRAMA ${drama.id}: ${drama.topic || drama.scenario_name || ''}`,
    module ? buildModuleContextText(module) : null,
    drama.learner_start_state ? `Learner start state: ${drama.learner_start_state}` : null,
    drama.learner_voice_constraint ? `Learner voice: ${drama.learner_voice_constraint}` : null,
    drama.tutor_voice_constraint ? `Tutor voice: ${drama.tutor_voice_constraint}` : null,
    drama.intended_tutor_character ? `Tutor character: ${drama.intended_tutor_character}` : null,
    drama.dramatic_shape ? `Dramatic shape: ${drama.dramatic_shape}` : null,
    binding.main_artifact ? `Artifact: ${binding.main_artifact}` : null,
    binding.primary_verifier ? `Verifier: ${binding.primary_verifier}` : null,
    Object.keys(publicConstraints).length ? `Public constraints:\n${yamlSnippet(publicConstraints, 6000)}` : null,
    Array.isArray(drama.turn_plan) ? `Turn plan:\n${yamlSnippet(drama.turn_plan, 6000)}` : null,
  ].filter(Boolean);
  return clipText(lines.join('\n\n'));
}

function buildPlanContextText(plan, module = null) {
  const lines = [
    `RHETORICAL DRAMATIC PLAN ${plan.id}: ${plan.curriculum_spine?.target_task || plan.module_title || ''}`,
    module ? buildModuleContextText(module) : null,
    plan.curriculum_spine ? `Curriculum spine:\n${yamlSnippet(plan.curriculum_spine, 5000)}` : null,
    plan.rhetoric ? `Rhetoric:\n${yamlSnippet(plan.rhetoric, 4000)}` : null,
    plan.pacing ? `Pacing and beats:\n${yamlSnippet(plan.pacing, 7000)}` : null,
    plan.character ? `Characters:\n${yamlSnippet(plan.character, 5000)}` : null,
    plan.scene ? `Scene:\n${yamlSnippet(plan.scene, 3000)}` : null,
    plan.public_prompt_constraints
      ? `Public prompt constraints:\n${yamlSnippet(plan.public_prompt_constraints, 4000)}`
      : null,
  ].filter(Boolean);
  return clipText(lines.join('\n\n'));
}

function directorInterventionsFromTurnPlan(turnPlan = []) {
  if (!Array.isArray(turnPlan)) return [];
  return turnPlan
    .filter((step) => step?.role === 'director' || step?.cue)
    .map((step) => {
      const cue = step.cue || {};
      const turn = Number(step.at?.turn ?? step.turn ?? 1);
      const policy = cue.policy || cue.revisit_policy || step.revisit_policy || null;
      const anchor = cue.anchor || cue.revisit_anchor || step.revisit_anchor || null;
      const moves = Array.isArray(step.moves) ? step.moves.join(', ') : '';
      return {
        turn: Number.isFinite(turn) ? turn : 1,
        timing: 'before_learner',
        cue_kind: moves || 'director_cue',
        instruction:
          cue.instruction ||
          `Keep this beat active: ${policy ? `${policy} ` : ''}${anchor || 'the current learner frame'}.`,
        revisit_policy: policy,
        requested_revisit_policy: policy,
        revisit_anchor: anchor,
      };
    });
}

function directorSeedFromSource(source) {
  if (!source?._raw) return null;
  const raw = source._raw;
  const module = source._module || null;
  if (source.kind.endsWith('_drama')) {
    const publicConstraints = raw.curriculum_binding?.rhetorical_public_constraints || {};
    const scene = publicConstraints.scene || raw.learner_start_state || null;
    return {
      provenance: { sourceRef: source.ref, kind: source.kind, id: source.id },
      opening_speaker: raw.opening_speaker || 'learner',
      ending_speaker: raw.ending_speaker || null,
      scene_setting: scene,
      scene_opening: raw.learner_start_state || scene,
      stakes: publicConstraints.public_evidence_standard
        ? `Claims must remain answerable to ${publicConstraints.public_evidence_standard}.`
        : publicConstraints.action_gate || null,
      relationship: raw.intended_tutor_character || null,
      tutor_adaptation_policy: raw.tutor_adaptation_policy || null,
      affective_adaptation_policy: raw.affective_adaptation_policy || null,
      voice_constraints: [raw.tutor_voice_constraint, raw.learner_voice_constraint].filter(Boolean).join('\n'),
      side_constraints: {
        tutor: raw.tutor_voice_constraint || null,
        learner: raw.learner_voice_constraint || null,
      },
      turn_plan: raw.turn_plan || [],
      interventions: directorInterventionsFromTurnPlan(raw.turn_plan),
    };
  }
  if (source.kind === 'dramatic_plan') {
    const scene = raw.scene || {};
    return {
      provenance: { sourceRef: source.ref, kind: source.kind, id: source.id },
      opening_speaker: 'learner',
      scene_setting: [scene.setting, scene.object].filter(Boolean).join('; ') || null,
      stakes: scene.stakes || raw.character?.learner?.public_risk || null,
      relationship: raw.character?.relationship?.status_relation || null,
      tutor_adaptation_policy: raw.pacing?.beat_pattern || null,
      voice_constraints: [
        raw.character?.speech?.tutor_register ? `Tutor: ${raw.character.speech.tutor_register}` : null,
        raw.character?.speech?.learner_register ? `Learner: ${raw.character.speech.learner_register}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      side_constraints: {
        tutor: raw.character?.speech?.tutor_register || null,
        learner: raw.character?.speech?.learner_register || null,
      },
      turn_plan: raw.pacing?.turn_plan || [],
      interventions: directorInterventionsFromTurnPlan(raw.pacing?.turn_plan),
    };
  }
  return {
    provenance: { sourceRef: source.ref, kind: source.kind, id: source.id },
    opening_speaker: 'learner',
    scene_setting: source.artifact ? `Working scene: ${source.artifact}` : null,
    stakes: source.verifier ? `The learner's public claim must satisfy ${source.verifier}.` : null,
    relationship: module?.main_artifact ? `Tutor reviews the learner's ${module.main_artifact}.` : null,
    tutor_adaptation_policy: 'evidence-grounded coaching',
    voice_constraints: 'Keep the exchange public, artifact-grounded, and answerable to the selected curriculum source.',
    side_constraints: {
      tutor: 'Ask for learner-authored evidence before supplying the finished answer.',
      learner: 'Speak as a learner working on the public artifact, not as an evaluator.',
    },
    turn_plan: [],
    interventions: [],
  };
}

function contextFromSceneSource(source) {
  if (!source) return null;
  let text = '';
  if (source.kind === 'module') text = buildModuleContextText(source._raw);
  else if (source.kind === 'world') text = buildWorldContextText(source._raw, source._module);
  else if (source.kind.endsWith('_drama')) text = buildDramaContextText(source._raw, source._module);
  else if (source.kind === 'dramatic_plan') text = buildPlanContextText(source._raw, source._module);
  else text = source.summary || source.title || source.ref;

  return {
    kind: source.kind,
    sourceRef: source.ref,
    sourceLabel: source.sourceGroup,
    courseId: 'ai_foundations_v1',
    courseTitle: 'AI Foundations',
    title: source.title,
    topic: source.topic,
    moduleId: source.moduleId,
    moduleTitle: source.moduleTitle,
    artifact: source.artifact,
    verifier: source.verifier,
    dramaticShape: source.dramaticShape,
    text: clipText(text),
    directorSeed: directorSeedFromSource(source),
  };
}

// Load a lecture or compiled curriculum/drama source to inject into prompts.
function loadCurriculumContext(lectureRefOrOptions, maybeCurriculumRef = null) {
  const lectureRef =
    typeof lectureRefOrOptions === 'object' ? lectureRefOrOptions?.lectureRef || null : lectureRefOrOptions;
  const curriculumRef =
    typeof lectureRefOrOptions === 'object' ? lectureRefOrOptions?.curriculumRef || null : maybeCurriculumRef;
  if (curriculumRef) {
    return contextFromSceneSource(findCurriculumSceneSource(curriculumRef));
  }
  if (!lectureRef) return null;
  const m = lectureRef.match(/^(\d+)-lecture-(\d+)$/);
  if (!m) return null;
  const [, courseId, lectureNum] = m;
  // Find the package containing this course
  for (const pkg of CONTENT_PACKAGES) {
    const courseDir = path.join(REPO_ROOT, pkg.dir, 'courses', courseId);
    const lectureFile = path.join(courseDir, `lecture-${lectureNum}.md`);
    if (fs.existsSync(lectureFile)) {
      const courseMeta = fs.existsSync(path.join(courseDir, 'course.md'))
        ? parseFrontmatter(fs.readFileSync(path.join(courseDir, 'course.md'), 'utf-8'))
        : {};
      const lectureRaw = fs.readFileSync(lectureFile, 'utf-8');
      // Strip speaker notes and cap length
      const cleaned = lectureRaw.replace(/```notes\s*\n[\s\S]*?```/g, '').trim();
      const maxChars = 20000;
      const truncated =
        cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '\n\n[… truncated for token budget …]' : cleaned;
      return {
        kind: 'lecture',
        courseId,
        courseTitle: courseMeta.title || `Course ${courseId}`,
        lectureNum: Number(lectureNum),
        lectureRef,
        sourceRef: lectureRef,
        title: `Lecture ${lectureNum}`,
        text: truncated,
      };
    }
  }
  return null;
}

function buildChatDirectorPlan({ sourceContext = null, director = null, topic = 'general conversation' } = {}) {
  const hasDirectorControls = director && typeof director === 'object';
  const seed = sourceContext?.directorSeed || null;
  if (!hasDirectorControls && !seed) return null;

  const mode = ['off', 'scene-card', 'strict'].includes(director?.mode) ? director.mode : 'scene-card';
  if (mode === 'off') return null;

  const act = ['setup', 'complication', 'peripeteia', 'recognition', 'catharsis'].includes(director?.act)
    ? director.act
    : 'setup';
  const beat = ['opening', 'stock_take', 'route_change', 'action_gate', 'recognition_press', 'closure'].includes(
    director?.beat,
  )
    ? director.beat
    : 'opening';
  const sceneSetting =
    String(director?.scene || '').trim() ||
    seed?.scene_setting ||
    (sourceContext?.artifact ? `Working scene: ${sourceContext.artifact}` : `Teaching scene for ${topic}`);
  const note = String(director?.note || '').trim();
  const directorNote = [
    seed?.director_note,
    `Admin scene frame: act=${act}; beat=${beat}; source=${sourceContext?.sourceRef || 'freeform topic'}.`,
    mode === 'strict' ? 'Strict director mode: prioritize the act/scene beat over generic tutoring habits.' : null,
    note ? `Admin director note: ${note}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...(seed || {}),
    mode,
    act,
    current_beat: beat,
    scene_setting: sceneSetting,
    scene_opening: seed?.scene_opening || sceneSetting,
    stakes: seed?.stakes || (sourceContext?.verifier ? `Must satisfy ${sourceContext.verifier}.` : null),
    relationship: seed?.relationship || null,
    director_note: directorNote,
    register: 'public, artifact-grounded teaching speech',
    stage_direction_style: 'Use square-bracket action asides only when useful; keep most output as spoken dialogue.',
    tutor_adaptation_policy:
      director?.policy || seed?.tutor_adaptation_policy || (beat === 'route_change' ? 'peripeteia' : 'none'),
    affective_adaptation_policy: seed?.affective_adaptation_policy || 'procedural_sensitive',
    side_constraints: {
      ...(seed?.side_constraints || {}),
      tutor:
        seed?.side_constraints?.tutor ||
        'Do not expose hidden ids, answer keys, evaluator labels, or the director frame. Ask for learner-authored evidence.',
      learner:
        seed?.side_constraints?.learner ||
        'Stay in learner voice. Do not mention hidden director labels or evaluation machinery.',
    },
    interventions: Array.isArray(seed?.interventions) ? seed.interventions : [],
    turn_plan: Array.isArray(seed?.turn_plan) ? seed.turn_plan : [],
  };
}

function buildCurriculumPromptBlock(curriculum) {
  if (!curriculum) return '';
  const sourceTitle =
    curriculum.kind === 'lecture'
      ? `${curriculum.courseTitle} (${curriculum.courseId}), Lecture ${curriculum.lectureNum}`
      : `${curriculum.courseTitle || 'Curriculum'} - ${curriculum.title || curriculum.sourceRef}`;
  const sourceRef = curriculum.sourceRef || curriculum.lectureRef || '';
  return `

==============================
CURRICULUM / SCENE SOURCE
==============================
You are currently drawing from ${sourceTitle}.
Use this as grounding material for the scene. Keep public speech tied to the visible learner task, artifact, and evidence standard; do not mention hidden ids, hashes, answer keys, or verifier internals aloud.

--- SOURCE CONTEXT (${sourceRef}) ---
${curriculum.text}
--- END SOURCE CONTEXT ---
`;
}

function buildDirectorPromptBlock(directorPlan) {
  if (!directorPlan) return '';
  const lines = [
    'Private director / act-scene frame for this live teaching drama.',
    directorPlan.act ? `Act: ${directorPlan.act}` : null,
    directorPlan.current_beat ? `Beat: ${directorPlan.current_beat}` : null,
    directorPlan.scene_setting ? `Scene: ${directorPlan.scene_setting}` : null,
    directorPlan.relationship ? `Relationship: ${directorPlan.relationship}` : null,
    directorPlan.stakes ? `Stakes: ${directorPlan.stakes}` : null,
    directorPlan.tutor_adaptation_policy ? `Tutor adaptation policy: ${directorPlan.tutor_adaptation_policy}` : null,
    directorPlan.affective_adaptation_policy
      ? `Affective adaptation policy: ${directorPlan.affective_adaptation_policy}`
      : null,
    directorPlan.voice_constraints ? `Voice constraints:\n${directorPlan.voice_constraints}` : null,
    directorPlan.side_constraints?.tutor ? `Tutor-side constraint: ${directorPlan.side_constraints.tutor}` : null,
    directorPlan.director_note ? `Director note:\n${directorPlan.director_note}` : null,
    Array.isArray(directorPlan.turn_plan) && directorPlan.turn_plan.length
      ? `Act/scene turn plan:\n${yamlSnippet(directorPlan.turn_plan, 5000)}`
      : null,
    'Public speech rule: never mention the director, act label, scene card, hidden ids, hashes, answer keys, evaluator labels, or the review process. Make the drama legible through what the tutor asks, withholds, reframes, and invites the learner to author.',
  ].filter(Boolean);

  return `

==============================
PRIVATE DIRECTOR / ACT-SCENE FRAME
==============================
${clipText(lines.join('\n\n'), SCENE_DIRECTOR_MAX_CHARS)}
`;
}

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

  if (!learnerMessage || !String(learnerMessage).trim()) {
    return res.status(400).json({ error: 'learnerMessage is required' });
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
        learnerMessage: String(learnerMessage),
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
      learnerMessage: String(learnerMessage),
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

function recentContext(history) {
  return (history || [])
    .slice(-6)
    .map((m) => `${(m.role || 'unknown').toUpperCase()}: ${m.content || ''}`)
    .join('\n\n');
}

// Alternative backend: spawn the local `claude` CLI (non-interactive -p mode) so
// a user can test their chat architectures against Claude Opus 4.7 without
// touching any eval config or adding an API key. Same return shape as callModel
// so runTutorTurn can swap transparently.
const CLAUDE_CLI_BIN = process.env.CLAUDE_CLI_BIN || 'claude';
const CLAUDE_CLI_MODEL = process.env.CHAT_CLI_MODEL || 'claude-opus-4-7';
const CLAUDE_CLI_TIMEOUT_MS = Number(process.env.CHAT_CLI_TIMEOUT_MS) || 180_000;
const CODEX_CLI_BIN = process.env.CODEX_CLI_BIN || 'codex';
// No hardcoded codex default: ChatGPT-account codex rejects models outside its
// entitlement, so unless the user (or CHAT_CODEX_MODEL) names one we omit -m
// and let ~/.codex/config.toml decide.
const CODEX_CLI_MODEL = process.env.CHAT_CODEX_MODEL || null;
const CLI_PROVIDERS = ['claude', 'codex'];
const CLI_EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'];

// Normalize the substrate request: new-style { cli: { provider, model, effort } }
// with the legacy boolean useClaudeCli mapping to { provider: 'claude' }.
// model is a free string (validated only for shape); effort must be a known level.
function normalizeCli(body = {}) {
  const raw = body.cli && typeof body.cli === 'object' ? body.cli : {};
  let provider = CLI_PROVIDERS.includes(raw.provider) ? raw.provider : null;
  if (!provider && body.useClaudeCli === true) provider = 'claude';
  if (!provider) return { provider: null, model: null, effort: null };
  const model =
    typeof raw.model === 'string' && raw.model.trim() ? raw.model.trim().slice(0, 80).replace(/["\\]/g, '') : null;
  const effort = CLI_EFFORTS.includes(raw.effort) ? raw.effort : null;
  return { provider, model, effort };
}

function cliModelLabel(cli) {
  if (!cli?.provider) return null;
  if (cli.provider === 'codex') return cli.model || CODEX_CLI_MODEL || 'codex-config-default';
  return cli.model || CLAUDE_CLI_MODEL;
}

// Dispatch a pure text-generation call to the requested local CLI substrate.
function callCli(cli, { system, user }) {
  if (cli?.provider === 'codex') {
    return callCodexCli({ system, user, model: cli.model, effort: cli.effort });
  }
  return callClaudeCli({ system, user, model: cli?.model || null, effort: cli?.effort || null });
}

async function callClaudeCli({ system, user, model = null, effort = null }) {
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const start = Date.now();
  // Note: we do NOT pass --bare because that disables keychain auth (the user's
  // Claude subscription). We disable all tools so the ego/superego stay pure
  // text generators, and --no-session-persistence keeps the CLI from polluting
  // the resume history with chat turns.
  const args = [
    '-p',
    fullPrompt,
    '--model',
    model || CLAUDE_CLI_MODEL,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--disallowedTools',
    'Bash,Edit,Write,Read,Grep,Glob,WebFetch,WebSearch,Task,NotebookEdit,AskUserQuestion',
  ];
  if (effort) args.push('--effort', effort);
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_CLI_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* already exited */
      }
      reject(new Error(`claude CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (code !== 0) {
        return reject(new Error(`claude CLI exited ${code}: ${stderr.slice(0, 400)}`));
      }
      // --output-format json emits an array of stream events. Find the final
      // {type:"result", subtype:"success"} entry and read its .result field.
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let costUsd = 0;
      try {
        const payload = JSON.parse(stdout.trim());
        if (Array.isArray(payload)) {
          const resultEvent = [...payload].reverse().find((e) => e?.type === 'result');
          if (resultEvent) {
            if (resultEvent.is_error) {
              return reject(new Error(`claude CLI error: ${resultEvent.result || 'unknown'}`));
            }
            content = String(resultEvent.result || '').trim();
            inputTokens = resultEvent.usage?.input_tokens || 0;
            outputTokens = resultEvent.usage?.output_tokens || 0;
            costUsd = resultEvent.total_cost_usd || 0;
          }
        } else {
          // single-object format (fallback)
          content = String(payload.result ?? payload.text ?? payload.content ?? '').trim();
          inputTokens = payload.usage?.input_tokens || 0;
          outputTokens = payload.usage?.output_tokens || 0;
        }
      } catch {
        content = stdout.trim();
      }
      if (!inputTokens) inputTokens = Math.ceil(fullPrompt.length / 4);
      if (!outputTokens) outputTokens = Math.ceil(content.length / 4);
      resolve({ content, latencyMs, inputTokens, outputTokens, costUsd });
    });
  });
}

// Codex CLI substrate: `codex exec` as a pure text generator. read-only
// sandbox + --skip-git-repo-check keep it from acting like an agent; the
// final assistant message is written to a temp file via -o (stable across
// codex versions, unlike the JSONL event stream). Token counts are estimated
// (subscription-billed; codex does not report usage through -o).
async function callCodexCli({ system, user, model = null, effort = null }) {
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const start = Date.now();
  const outFile = path.join(
    fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'ms-chat-codex-')),
    'last-message.txt',
  );
  const args = ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never', '-o', outFile];
  const chosenModel = model || CODEX_CLI_MODEL;
  if (chosenModel) args.push('-m', chosenModel);
  if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
  args.push(fullPrompt);
  return new Promise((resolve, reject) => {
    const proc = spawn(CODEX_CLI_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    const cleanup = () => {
      try {
        fs.rmSync(path.dirname(outFile), { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    };
    const timer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* already exited */
      }
      cleanup();
      reject(new Error(`codex CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    proc.stdout.on('data', () => {});
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      let content = '';
      try {
        content = fs.readFileSync(outFile, 'utf8').trim();
      } catch {
        content = '';
      }
      cleanup();
      if (code !== 0) {
        return reject(new Error(`codex CLI exited ${code}: ${stderr.slice(0, 400)}`));
      }
      if (!content) {
        return reject(new Error(`codex CLI returned no output: ${stderr.slice(0, 400)}`));
      }
      resolve({
        content,
        latencyMs,
        inputTokens: Math.ceil(fullPrompt.length / 4),
        outputTokens: Math.ceil(content.length / 4),
        costUsd: 0,
      });
    });
  });
}

async function callModel(apiKey, { modelId, system, user, temperature, maxTokens }) {
  const start = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:8081/chat',
      'X-Title': 'Machine Spirits Chat',
    },
    body: JSON.stringify({
      model: modelId,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  const latencyMs = Date.now() - start;
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '';
  return {
    content,
    latencyMs,
    inputTokens: payload.usage?.prompt_tokens || 0,
    outputTokens: payload.usage?.completion_tokens || 0,
  };
}

// Streaming single-agent path: only the ego call, OpenRouter `stream: true`,
// each delta forwarded via `onDelta` callback. Returns the same shape as a
// single-agent runTutorTurn would, so the caller can persist identically.
//
// Multi-agent cells (with superego) intentionally fall through to the
// non-streaming runTutorTurn — we'd have to buffer the ego output for the
// superego review anyway, defeating the streaming benefit.
async function streamSingleAgentTurn({
  profile,
  apiKey,
  history,
  learnerMessage,
  topic,
  curriculum = null,
  directorPlan = null,
  egoModelOverride = null,
  temperature = null,
  maxTokens = null,
  onDelta,
}) {
  const conversationContext = recentContext(history);
  const egoModelRef = egoModelOverride || evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = temperature ?? profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = maxTokens ?? profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = buildCurriculumPromptBlock(curriculum);
  const directorBlock = buildDirectorPromptBlock(directorPlan);

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner just said:
"${learnerMessage}"

Draft your initial response as a tutor. Be warm but intellectually challenging. Don't be condescending. Build on their words. Provide ONLY the response text (no JSON, no meta-commentary).`;

  const start = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'http://localhost:8081/chat',
      'X-Title': 'Machine Spirits Chat (streaming)',
    },
    body: JSON.stringify({
      model: egoModelRef.model,
      temperature: egoTemp,
      max_tokens: egoMaxTokens,
      stream: true,
      messages: [
        { role: 'system', content: egoSystem },
        { role: 'user', content: learnerMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let inputTokens = 0;
  let outputTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // partial last line stays in buffer
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]' || !data) continue;
      try {
        const obj = JSON.parse(data);
        const delta = obj.choices?.[0]?.delta?.content || '';
        if (delta) {
          accumulated += delta;
          if (typeof onDelta === 'function') onDelta(delta);
        }
        if (obj.usage) {
          inputTokens = obj.usage.prompt_tokens || inputTokens;
          outputTokens = obj.usage.completion_tokens || outputTokens;
        }
      } catch {
        // partial chunk; safe to skip — line will reassemble next loop
      }
    }
  }
  const latencyMs = Date.now() - start;
  if (!inputTokens) inputTokens = Math.ceil((egoSystem + learnerMessage).length / 4);
  if (!outputTokens) outputTokens = Math.ceil(accumulated.length / 4);

  return {
    finalMessage: accumulated,
    egoModel: egoModelRef.model,
    egoProvider: egoModelRef.provider,
    inputTokens,
    outputTokens,
    latencyMs,
    deliberation: [
      {
        role: 'ego',
        label: 'Ego — initial draft',
        content: accumulated,
        model: egoModelRef.model,
        provider: egoModelRef.provider,
        temperature: egoTemp,
        latencyMs,
        inputTokens,
        outputTokens,
      },
    ],
  };
}

async function runTutorTurn({
  profile,
  apiKey,
  history,
  learnerMessage,
  topic,
  curriculum = null,
  directorPlan = null,
  useClaudeCli = false,
  cli = null,
  // Optional, live-only knobs. Defaults preserve the scored instrument exactly:
  // styleDirective is appended to the ego draft + superego revision instructions
  // (e.g. a brevity / one-question-per-turn rule for the interactive sit-in), and
  // maxTokens caps the ego/superego output. Batch eval never sets either.
  styleDirective = '',
  maxTokens = null,
  temperature = null,
  egoModelOverride = null,
  superegoModelOverride = null,
}) {
  const conversationContext = recentContext(history);
  const deliberation = [];
  const styleLine = styleDirective ? `\n\n${styleDirective}` : '';
  // CLI substrate config: explicit `cli` wins; legacy useClaudeCli maps to claude.
  const cliCfg = cli?.provider ? cli : useClaudeCli ? { provider: 'claude', model: null, effort: null } : null;

  const egoModelRef = egoModelOverride || evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = temperature ?? profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = maxTokens ?? profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = buildCurriculumPromptBlock(curriculum);
  const directorBlock = buildDirectorPromptBlock(directorPlan);

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner just said:
"${learnerMessage}"

Draft your initial response as a tutor. Be warm but intellectually challenging. Don't be condescending. Build on their words.${styleLine} Provide ONLY the response text (no JSON, no meta-commentary).`;

  const egoOut = cliCfg
    ? await callCli(cliCfg, { system: egoSystem, user: learnerMessage })
    : await callModel(apiKey, {
        modelId: egoModelRef.model,
        system: egoSystem,
        user: learnerMessage,
        temperature: egoTemp,
        maxTokens: egoMaxTokens,
      });

  const egoDraft = egoOut.content;
  deliberation.push({
    role: 'ego',
    label: 'Ego — initial draft',
    content: egoDraft,
    model: cliCfg ? cliModelLabel(cliCfg) : egoModelRef.model,
    provider: cliCfg ? `${cliCfg.provider}-cli` : egoModelRef.provider,
    temperature: egoTemp,
    latencyMs: egoOut.latencyMs,
    inputTokens: egoOut.inputTokens,
    outputTokens: egoOut.outputTokens,
  });

  let finalMessage = egoDraft;
  let superegoCritique = null;
  let wasRevised = false;

  if (profile.superego) {
    const superModelRef =
      superegoModelOverride || evalConfigLoader.resolveModel(`${profile.superego.provider}.${profile.superego.model}`);
    const superPromptBody = loadPromptFile(profile.superego.prompt_file);
    const superTemp = profile.superego.hyperparameters?.temperature ?? 0.2;
    const superMaxTokens = maxTokens ?? profile.superego.hyperparameters?.max_tokens ?? 2000;

    const superSystem = `${superPromptBody || 'You are a pedagogical critic reviewing tutor responses.'}

${INTERFACE_AFFORDANCE}
${curriculumBlock}
${directorBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner said:
"${learnerMessage}"

The tutor's DRAFT response:
"${egoDraft}"

Critique this draft for pedagogical soundness, emotional attunement, Socratic quality, and ZPD awareness. Then provide an improved version (or write "APPROVED" if the draft is already strong).${styleLine ? `\n\nThe improved version MUST also obey:${styleLine}` : ''}

Format strictly:
CRITIQUE: [your analysis]
IMPROVED: [refined response, or "APPROVED"]`;

    const superOut = cliCfg
      ? await callCli(cliCfg, { system: superSystem, user: egoDraft })
      : await callModel(apiKey, {
          modelId: superModelRef.model,
          system: superSystem,
          user: egoDraft,
          temperature: superTemp,
          maxTokens: superMaxTokens,
        });

    superegoCritique = superOut.content;
    deliberation.push({
      role: 'superego',
      label: 'Superego — critique',
      content: superegoCritique,
      model: cliCfg ? cliModelLabel(cliCfg) : superModelRef.model,
      provider: cliCfg ? `${cliCfg.provider}-cli` : superModelRef.provider,
      temperature: superTemp,
      latencyMs: superOut.latencyMs,
      inputTokens: superOut.inputTokens,
      outputTokens: superOut.outputTokens,
    });

    const improvedMatch = superegoCritique.match(/IMPROVED:\s*([\s\S]*?)$/i);
    if (improvedMatch && improvedMatch[1]) {
      const improved = improvedMatch[1].trim();
      const approved = /^APPROVED\b/i.test(improved) || improved.length <= 20;
      if (!approved) {
        finalMessage = improved;
        wasRevised = true;
      }
    }

    deliberation.push({
      role: 'ego_revision',
      label: wasRevised ? 'Ego revision — adopts superego edits' : 'Ego revision — keeps draft (superego approved)',
      content: finalMessage,
      derivedFrom: wasRevised ? 'superego IMPROVED section' : 'original ego draft',
    });
  }

  // Some tutor prompts (notably the base tutor-ego.md) instruct the ego to emit
  // a JSON array of suggestion objects. Extract the natural-language message so
  // the chat UI can render prose. Same helper the eval engine uses for symmetry.
  const renderableFinal = extractTutorMessage(finalMessage) || finalMessage;

  return {
    finalMessage: renderableFinal,
    wasRevised,
    deliberation,
    architecture: {
      hasSuperego: !!profile.superego,
      promptType: profile.factors?.prompt_type || null,
      recognitionMode: !!profile.recognition_mode,
    },
    totals: {
      inputTokens: deliberation.reduce((s, d) => s + (d.inputTokens || 0), 0),
      outputTokens: deliberation.reduce((s, d) => s + (d.outputTokens || 0), 0),
      latencyMs: deliberation.reduce((s, d) => s + (d.latencyMs || 0), 0),
    },
  };
}

export default router;

// Re-exported for in-process reuse by the pilot autoplay engine
// (services/pilotAutoplay.js), which drives an llm learner through the SAME
// tutor loop a human participant drives. These are domain functions — an
// ego/superego tutor turn and the prompt/curriculum loaders — that live in this
// route module for historical reasons; the export shares the exact same code
// path the human /pilot turn uses, so the two learner sources cannot drift.
export { runTutorTurn, loadCurriculumContext, loadPromptFile };
