export const FEATURE_META = {
  approach: {
    standard: 'default AI tutor',
    polished: 'best-practice pedagogy',
    recognition: 'Hegelian recognition theory',
    placebo: 'length-matched control',
    minimalist: 'naive baseline',
    charismatic: 'Weberian id-director',
  },
  critic: {
    none: 'single voice',
    pedagogical: 'standard superego critic',
    dialectical: 'critic engages the ego',
    divergent: 'alternate-stance critic',
    hardwired: 'rules baked into the ego',
  },
  stance: {
    suspicious: 'questions the draft',
    adversary: 'challenges the draft',
    advocate: 'supports the draft',
  },
  learnerModel: {
    surface: 'unified learner voice',
    reflective: 'learner ego plus superego',
  },
  charismaVariant: {
    generalist: 'balanced generalist frontier point',
    'v22-specialist': 'recognition/pedagogy specialist frontier point',
    'charisma-specialist': 'charisma rubric specialist frontier point',
  },
};

export const DIRECTOR_META = {
  mode: {
    'scene-card': 'inject a compact private scene card',
    strict: 'prioritize the private director frame',
    off: 'no private director frame',
  },
  act: {
    setup: 'establish the public task and relationship',
    complication: 'make the obstacle visible',
    peripeteia: 'turn the route or assumption',
    recognition: 'make the learner recognize the issue',
    catharsis: 'close with owned evidence or action',
  },
  beat: {
    opening: 'opening line or first probe',
    stock_take: 'take stock of what is known',
    route_change: 'change strategy',
    action_gate: 'require a learner-authored move',
    recognition_press: 'press the recognition moment',
    closure: 'close the scene',
  },
};

const FEATURE_KEYS = Object.keys(FEATURE_META);
const DIRECTOR_KEYS = Object.keys(DIRECTOR_META);
const VALID_MODES = new Set(['human', 'teacher', 'auto']);
const VALID_ACTIONS = new Set(['none', 'start_scene', 'open_batch_launcher']);

function owns(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function compactString(value, max = 240) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function normalizeFeatures(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of FEATURE_KEYS) {
    if (owns(raw, key) && owns(FEATURE_META[key], raw[key])) out[key] = raw[key];
  }
  if (out.critic && out.critic !== 'dialectical' && out.critic !== 'divergent') out.stance = 'suspicious';
  return out;
}

function normalizeDirector(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of DIRECTOR_KEYS) {
    if (owns(raw, key) && owns(DIRECTOR_META[key], raw[key])) out[key] = raw[key];
  }
  if (owns(raw, 'scene')) {
    const scene = compactString(raw.scene, 160);
    if (scene) out.scene = scene;
  }
  if (owns(raw, 'note')) out.note = compactString(raw.note, 320) || '';
  return out;
}

export function normalizeAssistProposal(raw = {}, catalogs = {}) {
  if (!raw || typeof raw !== 'object') return { proposal: null, dropped: [] };
  const dropped = [];
  const proposal = {};
  const features = normalizeFeatures(raw.features);
  for (const key of Object.keys(raw.features || {})) {
    if (!owns(features, key)) dropped.push(`features.${key}`);
  }
  if (Object.keys(features).length) proposal.features = features;

  if (owns(raw, 'topic')) {
    const topic = compactString(raw.topic, 220);
    if (topic) proposal.topic = topic;
    else dropped.push('topic');
  }
  for (const [key, values] of [
    ['curriculumRef', catalogs.sceneRefs],
    ['lectureRef', catalogs.lectureRefs],
  ]) {
    if (!owns(raw, key)) continue;
    if (raw[key] == null || raw[key] === '') proposal[key] = null;
    else if (new Set(values || []).has(raw[key])) proposal[key] = raw[key];
    else dropped.push(key);
  }

  const director = normalizeDirector(raw.director);
  for (const key of Object.keys(raw.director || {})) {
    if (!owns(director, key)) dropped.push(`director.${key}`);
  }
  if (Object.keys(director).length) proposal.director = director;

  if (owns(raw, 'personaId')) {
    if (new Set(catalogs.personaIds || []).has(raw.personaId)) proposal.personaId = raw.personaId;
    else dropped.push('personaId');
  }
  if (owns(raw, 'mode')) {
    if (VALID_MODES.has(raw.mode)) proposal.mode = raw.mode;
    else dropped.push('mode');
  }
  if (owns(raw, 'action')) {
    if (VALID_ACTIONS.has(raw.action)) proposal.action = raw.action;
    else dropped.push('action');
  }
  if (owns(raw, 'rationale')) {
    if (typeof raw.rationale === 'string') proposal.rationale = compactString(raw.rationale, 500);
    else if (raw.rationale && typeof raw.rationale === 'object') {
      proposal.rationale = Object.fromEntries(
        Object.entries(raw.rationale)
          .map(([key, value]) => [key, compactString(value, 180)])
          .filter(([, value]) => value),
      );
    }
  }
  return { proposal: Object.keys(proposal).length ? proposal : null, dropped };
}
