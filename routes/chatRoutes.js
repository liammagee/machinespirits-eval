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
import * as evalConfigLoader from '../services/evalConfigLoader.js';
import * as learnerConfigLoader from '../services/learnerConfigLoader.js';
import interactionEngine, { extractTutorMessage } from '../services/learnerTutorInteractionEngine.js';
import * as pilotStore from '../services/pilotStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const LOCAL_PROMPTS_DIR = path.resolve(__dirname, '..', 'prompts');
const CORE_PROMPTS_DIR = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '@machinespirits',
  'tutor-core',
  'prompts',
);

function loadPromptFile(filename) {
  if (!filename) return '';
  const local = path.join(LOCAL_PROMPTS_DIR, filename);
  if (fs.existsSync(local)) return fs.readFileSync(local, 'utf8');
  const core = path.join(CORE_PROMPTS_DIR, filename);
  if (fs.existsSync(core)) return fs.readFileSync(core, 'utf8');
  return '';
}

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
  cell_101: { designPoint: 'baseline',            label: 'Baseline id-director',         v22LastTurn: 55.5, charisma: 59.9, n: 79, blurb: 'Inversion alone — no classifier, no exemplars, no tuning.' },
  cell_102: { designPoint: 'baseline-recog',      label: 'Baseline + recognition',       v22LastTurn: 49.4, charisma: 54.1, n: 54, blurb: 'Recognition vocabulary only — both rubrics drift down.' },
  cell_103: { designPoint: 'classifier',          label: 'Classifier only',              v22LastTurn: 75.8, charisma: 64.3, n: 81, blurb: 'Register classifier lifts persona-shift floor; no recognition yet.' },
  cell_104: { designPoint: 'v22-specialist',      label: 'v2.2 specialist',              v22LastTurn: 80.6, charisma: 65.7, n: 81, blurb: 'Classifier + recognition — wins v2.2, mid on charisma.' },
  cell_105: { designPoint: 'charisma-specialist', label: 'Charisma specialist',          v22LastTurn: 70.0, charisma: 71.0, n: 81, blurb: 'Verbose 800–1500 token id directives — wins charisma, mid on v2.2.' },
  cell_106: { designPoint: 'failure',             label: 'Shared floor',                 v22LastTurn: 57.0, charisma: 36.4, n: 54, blurb: 'Terse 200–400 token directives under-specify the ego — fails both rubrics.' },
  cell_107: { designPoint: 'generalist',          label: 'Balanced generalist',          v22LastTurn: 78.5, charisma: 66.3, n: 27, blurb: 'Witness exemplars only — second on both rubrics, best balance.' },
  cell_108: { designPoint: 'composer-classifier', label: 'Classifier + exemplars',       v22LastTurn: 72.6, charisma: 71.4, n: 27, blurb: 'Pilot lift regressed at full N — non-text levers compose roughly additively, not super-additively.' },
  cell_109: { designPoint: 'composer-charisma',   label: 'Charisma-tuning + exemplars',  v22LastTurn: 59.6, charisma: 77.7, n:  6, blurb: 'Two text-heavy levers stack — ego instruction-following degrades. Pilot N only.', pilotOnly: true },
};

function charismaProfileFor(name) {
  const baseName = name?.match(/^cell_\d+/)?.[0] || null;
  return baseName ? (CHARISMA_PROFILES[baseName] || null) : null;
}

function summarizeCell(name, profile, orientations = {}) {
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
    effectiveSubfamily = profile.recognition_mode
      ? 'hegelian_recognition'
      : (orientation.subfamily || null);
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
    const cells = Object.entries(profiles)
      .map(([name, profile]) => summarizeCell(name, profile, orientations))
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

// Human-readable features map to cell characteristics. The resolver scores every
// cell against the requested target and returns the best match plus a description
// of which dimensions matched exactly vs were relaxed.
router.post('/resolve', (req, res) => {
  try {
    const features = normalizeFeatures(req.body || {});
    const data = evalConfigLoader.loadTutorAgents();
    const profiles = data?.profiles || {};
    const orientations = data?.pedagogical_orientations || {};
    const candidates = Object.entries(profiles)
      .filter(([name]) => /^cell_\d/.test(name))
      .map(([name, profile]) => summarizeCell(name, profile, orientations));

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
    const exact = best.matches.every((m) => m.match);

    res.json({
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
    });
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
  const approach = ['standard', 'polished', 'recognition', 'placebo', 'minimalist', 'charismatic'].includes(raw.approach)
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
  const cellLearnerFamily = (cell.learnerArchitecture || '').startsWith('ego_superego')
    ? 'ego_superego'
    : 'unified';
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
    if (target.charismaVariant === 'generalist' && cell.witnessExemplars && !cell.registerClassifier && cell.idTuning !== 'charisma') {
      score += 1;
    } else if (target.charismaVariant === 'v22-specialist' && cell.recognitionMode && cell.registerClassifier) {
      score += 1;
    } else if (target.charismaVariant === 'charisma-specialist' && cell.idTuning === 'charisma' && !cell.witnessExemplars) {
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
  eager_novice:     { name: 'Eager Novice',       hint: 'enthusiastic · easily overwhelmed' },
  confused_novice:  { name: 'Confused Novice',    hint: 'lost but curious · asks a lot' },
  eager_explorer:   { name: 'Eager Explorer',     hint: 'delighted by tangents · open' },
  focused_achiever: { name: 'Focused Achiever',   hint: 'goal-oriented · wants closure' },
  struggling_anxious:{name: 'Struggling Anxious', hint: 'easily frustrated · needs reassurance' },
  adversarial_tester:{name: 'Adversarial Tester', hint: 'challenges the tutor · probes reasoning' },
};

// ════════════════════════════════════════════════════════════════════
//  CURRICULUM (content packages on disk)
// ════════════════════════════════════════════════════════════════════

// Several content packages live at the repo root (content/, content-test-*/).
// Each has courses/<id>/course.md (with YAML frontmatter) and lecture-N.md files.
const REPO_ROOT = path.resolve(__dirname, '..');
const CONTENT_PACKAGES = [
  { id: 'main',         dir: 'content',                 label: 'Main' },
  { id: 'history-tech', dir: 'content-history-tech',    label: 'History of Tech' },
  { id: 'ethics-ai',    dir: 'content-ethics-ai',       label: 'Ethics of AI' },
  { id: 'ai-literacy',  dir: 'content-ai-literacy',     label: 'AI Literacy' },
  { id: 'stats',        dir: 'content-stats-skeptics',  label: 'Statistics' },
  { id: 'programming',  dir: 'content-test-programming', label: 'Programming' },
  { id: 'creative',     dir: 'content-test-creative',   label: 'Creative' },
  { id: 'elementary',   dir: 'content-test-elementary', label: 'Elementary' },
  { id: 'sel',          dir: 'content-test-sel',        label: 'SEL' },
  { id: 'support',      dir: 'content-test-support',    label: 'Support' },
];

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
      const lectureFiles = fs.readdirSync(path.join(coursesDir, id))
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

router.get('/curricula', (req, res) => {
  try {
    res.json({ packages: listCurricula() });
  } catch (err) {
    console.error('[chat] curricula error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Load a lecture's full text to inject into the tutor's system prompt.
function loadCurriculumContext(lectureRef) {
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
      const truncated = cleaned.length > maxChars
        ? cleaned.slice(0, maxChars) + '\n\n[… truncated for token budget …]'
        : cleaned;
      return {
        courseId,
        courseTitle: courseMeta.title || `Course ${courseId}`,
        lectureNum: Number(lectureNum),
        lectureRef,
        text: truncated,
      };
    }
  }
  return null;
}

router.get('/personas', (req, res) => {
  try {
    const base = learnerConfigLoader.listPersonas();
    const known = new Set(base.map((p) => p.id));
    // Surface persona-modifier stubs from YAML too (they're valid persona IDs)
    const yamlModifiers = learnerConfigLoader.loadConfig?.()?.persona_modifiers || {};
    const extraIds = Object.keys(yamlModifiers).filter((id) => !known.has(id));
    const enriched = [
      ...base,
      ...extraIds.map((id) => ({ id, name: null, description: null })),
    ].map((p) => {
      const sketch = PERSONA_SKETCHES[p.id];
      return {
        id: p.id,
        name: p.name || sketch?.name || p.id.replace(/_/g, ' '),
        hint: sketch?.hint || p.description || '',
        defaultArchitecture: p.defaultArchitecture || null,
      };
    });
    res.json({ personas: enriched });
  } catch (err) {
    console.error('[chat] personas error:', err);
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
    personaId = 'eager_novice',
    useClaudeCli = false,
  } = req.body || {};

  if (!cellName) return res.status(400).json({ error: 'cellName is required' });

  const profile = evalConfigLoader.loadTutorAgents()?.profiles?.[cellName];
  if (!profile) return res.status(404).json({ error: `cell "${cellName}" not found` });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!useClaudeCli && !apiKey) {
    return res.status(503).json({
      error: 'OPENROUTER_API_KEY is not set — either enable the Claude CLI toggle or set the key.',
    });
  }

  const learnerProfileName = profile.learner_architecture || 'unified';
  const lastTutor = [...history].reverse().find((h) => h.role === 'tutor');
  const tutorMessage = lastTutor?.content
    || `Let's begin a conversation about ${topic}. What's on your mind?`;

  // Build an llmCall adapter the engine expects: (modelRef, systemPrompt, messages, options)
  // When useClaudeCli is true, every call is routed through the local `claude` CLI
  // (Opus 4.7) — same interface, different substrate. Otherwise: OpenRouter.
  const llmCall = async (modelRef, systemPrompt, messages, options = {}) => {
    if (useClaudeCli) {
      const userPrompt = (messages || []).map((m) => m.content).join('\n\n');
      const out = await callClaudeCli({ system: systemPrompt, user: userPrompt });
      return {
        content: out.content,
        usage: { inputTokens: out.inputTokens, outputTokens: out.outputTokens },
        model: CLAUDE_CLI_MODEL,
        provider: 'claude-cli',
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
        max_tokens: options.maxTokens ?? 1500,
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

router.post('/turn', async (req, res) => {
  // learnerMessage is only read; the others are mutated by the pilot-mode
  // override block below (cellName, lectureRef, history, topic, useClaudeCli).
  const { learnerMessage } = req.body || {};
  let {
    cellName,
    history = [],
    topic = 'general conversation',
    lectureRef = null,
    useClaudeCli = false,
  } = req.body || {};
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
    useClaudeCli = false; // pilot is locked to OpenRouter
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

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!useClaudeCli && !apiKey) {
    return res.status(503).json({
      error: 'OPENROUTER_API_KEY is not set — either enable the Claude CLI toggle or set the key.',
    });
  }

  // Streaming branch: ?stream=1 + single-agent cell + OpenRouter substrate.
  // Multi-agent cells fall through to the non-streaming path because the
  // superego review needs the complete ego output before it can begin.
  // Claude CLI substrate is also non-streaming (the CLI returns once).
  const wantsStream = req.query.stream === '1' || req.query.stream === 'true';
  if (wantsStream && !profile.superego && !useClaudeCli) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    try {
      const curriculum = lectureRef ? loadCurriculumContext(lectureRef) : null;
      const result = await streamSingleAgentTurn({
        profile,
        apiKey,
        history,
        learnerMessage: String(learnerMessage),
        topic: String(topic),
        curriculum,
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
    const curriculum = lectureRef ? loadCurriculumContext(lectureRef) : null;
    const trace = await runTutorTurn({
      profile,
      apiKey,
      history,
      learnerMessage: String(learnerMessage),
      topic: String(topic),
      curriculum,
      useClaudeCli: !!useClaudeCli,
    });

    if (pilotSession) {
      // Persist BOTH the learner message and the tutor response. config_hash
      // is computed once and shared across the pair (same model state for
      // this round); dialogue_content_hash is computed cumulatively inside
      // pilotStore.appendTurn.
      const egoPromptText = loadPromptFile(profile.ego.prompt_file);
      const superegoPromptText = profile.superego
        ? loadPromptFile(profile.superego.prompt_file)
        : '';
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
        courseId: curriculum.courseId,
        courseTitle: curriculum.courseTitle,
        lectureRef: curriculum.lectureRef,
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

async function callClaudeCli({ system, user }) {
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const start = Date.now();
  // Note: we do NOT pass --bare because that disables keychain auth (the user's
  // Claude subscription). We disable all tools so the ego/superego stay pure
  // text generators, and --no-session-persistence keeps the CLI from polluting
  // the resume history with chat turns.
  const args = [
    '-p', fullPrompt,
    '--model', CLAUDE_CLI_MODEL,
    '--output-format', 'json',
    '--no-session-persistence',
    '--disallowedTools', 'Bash,Edit,Write,Read,Grep,Glob,WebFetch,WebSearch,Task,NotebookEdit,AskUserQuestion',
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn(CLAUDE_CLI_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already exited */ }
      reject(new Error(`claude CLI timed out after ${CLAUDE_CLI_TIMEOUT_MS}ms`));
    }, CLAUDE_CLI_TIMEOUT_MS);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
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
  profile, apiKey, history, learnerMessage, topic, curriculum = null, onDelta,
}) {
  const conversationContext = recentContext(history);
  const egoModelRef = evalConfigLoader.resolveModel(`${profile.ego.provider}.${profile.ego.model}`);
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = curriculum
    ? `

==============================
CURRICULUM CONTEXT
==============================
You are currently teaching **${curriculum.courseTitle}** (${curriculum.courseId}), specifically Lecture ${curriculum.lectureNum}.
Draw from this material where relevant; ground your response in its specifics rather than generic knowledge.

--- LECTURE CONTENT (${curriculum.lectureRef}) ---
${curriculum.text}
--- END LECTURE CONTENT ---
`
    : '';

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}
${curriculumBlock}
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
    egoProvider: profile.ego.provider,
    inputTokens,
    outputTokens,
    latencyMs,
    deliberation: [{
      role: 'ego',
      label: 'Ego — initial draft',
      content: accumulated,
      model: egoModelRef.model,
      provider: profile.ego.provider,
      temperature: egoTemp,
      latencyMs,
      inputTokens,
      outputTokens,
    }],
  };
}

async function runTutorTurn({ profile, apiKey, history, learnerMessage, topic, curriculum = null, useClaudeCli = false }) {
  const conversationContext = recentContext(history);
  const deliberation = [];

  const egoModelRef = evalConfigLoader.resolveModel(
    `${profile.ego.provider}.${profile.ego.model}`,
  );
  const egoPromptBody = loadPromptFile(profile.ego.prompt_file);
  const egoTemp = profile.ego.hyperparameters?.temperature ?? 0.6;
  const egoMaxTokens = profile.ego.hyperparameters?.max_tokens ?? 2000;

  const curriculumBlock = curriculum
    ? `

==============================
CURRICULUM CONTEXT
==============================
You are currently teaching **${curriculum.courseTitle}** (${curriculum.courseId}), specifically Lecture ${curriculum.lectureNum}.
Draw from this material where relevant; ground your response in its specifics rather than generic knowledge.

--- LECTURE CONTENT (${curriculum.lectureRef}) ---
${curriculum.text}
--- END LECTURE CONTENT ---
`
    : '';

  const egoSystem = `${egoPromptBody || 'You are a thoughtful AI tutor.'}
${curriculumBlock}
Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner just said:
"${learnerMessage}"

Draft your initial response as a tutor. Be warm but intellectually challenging. Don't be condescending. Build on their words. Provide ONLY the response text (no JSON, no meta-commentary).`;

  const egoOut = useClaudeCli
    ? await callClaudeCli({ system: egoSystem, user: learnerMessage })
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
    model: useClaudeCli ? CLAUDE_CLI_MODEL : egoModelRef.model,
    provider: useClaudeCli ? 'claude-cli' : profile.ego.provider,
    temperature: egoTemp,
    latencyMs: egoOut.latencyMs,
    inputTokens: egoOut.inputTokens,
    outputTokens: egoOut.outputTokens,
  });

  let finalMessage = egoDraft;
  let superegoCritique = null;
  let wasRevised = false;

  if (profile.superego) {
    const superModelRef = evalConfigLoader.resolveModel(
      `${profile.superego.provider}.${profile.superego.model}`,
    );
    const superPromptBody = loadPromptFile(profile.superego.prompt_file);
    const superTemp = profile.superego.hyperparameters?.temperature ?? 0.2;
    const superMaxTokens = profile.superego.hyperparameters?.max_tokens ?? 2000;

    const superSystem = `${superPromptBody || 'You are a pedagogical critic reviewing tutor responses.'}

Topic: ${topic}

Recent conversation:
${conversationContext || '(none)'}

The learner said:
"${learnerMessage}"

The tutor's DRAFT response:
"${egoDraft}"

Critique this draft for pedagogical soundness, emotional attunement, Socratic quality, and ZPD awareness. Then provide an improved version (or write "APPROVED" if the draft is already strong).

Format strictly:
CRITIQUE: [your analysis]
IMPROVED: [refined response, or "APPROVED"]`;

    const superOut = useClaudeCli
      ? await callClaudeCli({ system: superSystem, user: egoDraft })
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
      model: useClaudeCli ? CLAUDE_CLI_MODEL : superModelRef.model,
      provider: useClaudeCli ? 'claude-cli' : profile.superego.provider,
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
