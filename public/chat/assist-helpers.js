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

function hasValue(meta, value) {
  return Object.prototype.hasOwnProperty.call(meta, value);
}

function compactString(value, max = 240) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

export function normalizeFeaturesPatch(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of FEATURE_KEYS) {
    if (hasValue(raw, key) && hasValue(FEATURE_META[key], raw[key])) {
      out[key] = raw[key];
    }
  }
  if (out.critic && out.critic !== 'dialectical' && out.critic !== 'divergent') {
    out.stance = 'suspicious';
  }
  return out;
}

export function normalizeDirectorPatch(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of DIRECTOR_KEYS) {
    if (hasValue(raw, key) && hasValue(DIRECTOR_META[key], raw[key])) {
      out[key] = raw[key];
    }
  }
  if (hasValue(raw, 'scene')) {
    const scene = compactString(raw.scene, 160);
    if (scene) out.scene = scene;
  }
  if (hasValue(raw, 'note')) {
    const note = compactString(raw.note, 320);
    out.note = note || '';
  }
  return out;
}

export function normalizeAssistProposal(raw = {}, catalogs = {}) {
  if (!raw || typeof raw !== 'object') return { proposal: null, dropped: [] };
  const dropped = [];
  const proposal = {};

  const features = normalizeFeaturesPatch(raw.features);
  if (raw.features && typeof raw.features === 'object') {
    for (const key of Object.keys(raw.features)) {
      if (!(key in features)) dropped.push(`features.${key}`);
    }
  }
  if (Object.keys(features).length) proposal.features = features;

  if (hasValue(raw, 'topic')) {
    const topic = compactString(raw.topic, 220);
    if (topic) proposal.topic = topic;
    else dropped.push('topic');
  }

  const sceneRefs = new Set(catalogs.sceneRefs || []);
  const lectureRefs = new Set(catalogs.lectureRefs || []);
  if (hasValue(raw, 'curriculumRef')) {
    if (raw.curriculumRef == null || raw.curriculumRef === '') proposal.curriculumRef = null;
    else if (sceneRefs.has(raw.curriculumRef)) proposal.curriculumRef = raw.curriculumRef;
    else dropped.push('curriculumRef');
  }
  if (hasValue(raw, 'lectureRef')) {
    if (raw.lectureRef == null || raw.lectureRef === '') proposal.lectureRef = null;
    else if (lectureRefs.has(raw.lectureRef)) proposal.lectureRef = raw.lectureRef;
    else dropped.push('lectureRef');
  }

  const director = normalizeDirectorPatch(raw.director);
  if (raw.director && typeof raw.director === 'object') {
    for (const key of Object.keys(raw.director)) {
      if (!(key in director)) dropped.push(`director.${key}`);
    }
  }
  if (Object.keys(director).length) proposal.director = director;

  const personaIds = new Set(catalogs.personaIds || []);
  if (hasValue(raw, 'personaId')) {
    if (personaIds.has(raw.personaId)) proposal.personaId = raw.personaId;
    else dropped.push('personaId');
  }

  if (hasValue(raw, 'mode')) {
    if (VALID_MODES.has(raw.mode)) proposal.mode = raw.mode;
    else dropped.push('mode');
  }

  if (hasValue(raw, 'action')) {
    if (VALID_ACTIONS.has(raw.action)) proposal.action = raw.action;
    else dropped.push('action');
  }

  if (hasValue(raw, 'rationale')) {
    if (typeof raw.rationale === 'string') {
      const rationale = compactString(raw.rationale, 500);
      if (rationale) proposal.rationale = rationale;
    } else if (raw.rationale && typeof raw.rationale === 'object') {
      proposal.rationale = Object.fromEntries(
        Object.entries(raw.rationale)
          .map(([key, value]) => [key, compactString(value, 180)])
          .filter(([, value]) => value),
      );
    }
  }

  return { proposal: Object.keys(proposal).length ? proposal : null, dropped };
}

export function applyProposalToState(current = {}, proposal = {}) {
  const next = {
    ...current,
    features: { ...(current.features || {}) },
    director: { ...(current.director || {}) },
    modelOverrides: { ...(current.modelOverrides || {}) },
  };
  const normalized = proposal || {};

  if (normalized.features) next.features = { ...next.features, ...normalizeFeaturesPatch(normalized.features) };
  if (typeof normalized.topic === 'string') next.topic = normalized.topic;
  if (Object.prototype.hasOwnProperty.call(normalized, 'curriculumRef')) {
    next.curriculumRef = normalized.curriculumRef || null;
    if (next.curriculumRef) next.lectureRef = null;
  }
  if (Object.prototype.hasOwnProperty.call(normalized, 'lectureRef')) {
    next.lectureRef = normalized.lectureRef || null;
    if (next.lectureRef) next.curriculumRef = null;
  }
  if (normalized.director) next.director = { ...next.director, ...normalizeDirectorPatch(normalized.director) };
  if (typeof normalized.personaId === 'string') next.personaId = normalized.personaId;
  if (VALID_MODES.has(normalized.mode)) next.mode = normalized.mode;
  return next;
}

export function proposalRows(proposal = {}) {
  const rows = [];
  const rationale = proposal?.rationale && typeof proposal.rationale === 'object' ? proposal.rationale : {};
  const add = (field, value) => {
    if (value == null || value === '') return;
    rows.push({
      field,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      rationale: rationale[field] || (typeof proposal.rationale === 'string' ? proposal.rationale : ''),
    });
  };
  for (const [key, value] of Object.entries(proposal?.features || {})) add(`features.${key}`, value);
  add('topic', proposal.topic);
  add('curriculumRef', proposal.curriculumRef);
  add('lectureRef', proposal.lectureRef);
  for (const [key, value] of Object.entries(proposal?.director || {})) add(`director.${key}`, value);
  add('personaId', proposal.personaId);
  add('mode', proposal.mode);
  add('action', proposal.action);
  return rows;
}

export function chatMountInfo(pathname = '/') {
  const path = String(pathname || '/');
  const adminChatAt = path.indexOf('/admin/chat');
  if (adminChatAt !== -1) {
    const prefix = path.slice(0, adminChatAt);
    return {
      apiBase: `${prefix}/admin/api/chat`,
      runLauncherBase: `${prefix}/admin/runs`,
    };
  }
  return {
    apiBase: '/api/chat',
    runLauncherBase: '/admin/runs',
  };
}

export function featuresFromCell(cell = {}) {
  if (!cell || typeof cell !== 'object') return { manual: true, features: {} };
  const features = {
    approach: 'standard',
    critic: 'none',
    stance: 'suspicious',
    learnerModel: String(cell.learnerArchitecture || '').startsWith('ego_superego') ? 'reflective' : 'surface',
    charismaVariant: 'generalist',
  };

  if (cell.idDirector) {
    features.approach = 'charismatic';
    const point = cell.charismaProfile?.designPoint || '';
    if (point === 'v22-specialist') features.charismaVariant = 'v22-specialist';
    else if (point === 'charisma-specialist') features.charismaVariant = 'charisma-specialist';
    else features.charismaVariant = 'generalist';
    return { manual: false, features };
  }

  const promptType = String(cell.promptType || '');
  if (promptType === 'recognition') features.approach = 'recognition';
  else if (promptType === 'enhanced' || promptType === 'matched_pedagogical') features.approach = 'polished';
  else if (promptType === 'placebo') features.approach = 'placebo';
  else if (promptType === 'naive') features.approach = 'minimalist';
  else features.approach = 'standard';

  const dialectical = promptType.match(/^dialectical_(suspicious|adversary|advocate)$/);
  const divergent = promptType.match(/^divergent_(suspicious|adversary|advocate)$/);
  if (dialectical) {
    features.critic = 'dialectical';
    features.stance = dialectical[1];
  } else if (divergent) {
    features.critic = 'divergent';
    features.stance = divergent[1];
  } else if (promptType === 'hardwired') {
    features.critic = 'hardwired';
  } else if (cell.superego) {
    features.critic = 'pedagogical';
  }

  const lossy =
    ((dialectical || divergent) && !!cell.recognitionMode) ||
    ![
      'base',
      'recognition',
      'enhanced',
      'matched_pedagogical',
      'placebo',
      'naive',
      'hardwired',
      ...Object.keys(FEATURE_META.stance).flatMap((s) => [`dialectical_${s}`, `divergent_${s}`]),
    ].includes(promptType);

  return { manual: lossy, features };
}
