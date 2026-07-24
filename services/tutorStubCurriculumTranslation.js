export const TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA = 'machinespirits.tutor-stub.curriculum-translation.v1';
export const TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA = 'machinespirits.tutor-stub.tutor-output-translation.v1';

export const TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS = Object.freeze([
  'basic',
  'intermediate',
  'advanced',
  'proficient',
]);

export const TUTOR_STUB_CURRICULUM_TRANSLATION_PROFILES = Object.freeze({
  basic: Object.freeze({
    label: 'Basic',
    guide:
      'Use common words, short sentences, and one idea at a time. Explain every necessary technical term in everyday words.',
  }),
  intermediate: Object.freeze({
    label: 'Intermediate',
    guide:
      'Use familiar contemporary standard English, mostly short sentences, and brief explanations for discipline-specific terms.',
  }),
  advanced: Object.freeze({
    label: 'Advanced',
    guide:
      'Use precise contemporary standard English with moderate sentence complexity. Keep useful discipline vocabulary and explain uncommon apparatus terms.',
  }),
  proficient: Object.freeze({
    label: 'Proficient',
    guide:
      'Use concise, idiomatic, and fully nuanced contemporary standard English. Preserve technical precision without needless apparatus jargon or archaic academic phrasing.',
  }),
});

export const TUTOR_STUB_CURRICULUM_TRANSLATOR_SYSTEM_PROMPT = [
  'You translate curriculum wording into accessible contemporary standard English.',
  'Translate meaning and wording only. Do not teach the lesson, answer its questions, add examples, or introduce facts.',
  'Preserve the learning challenge, technical distinctions, evidence requirements, verification standard, and uncertainty of every source segment.',
  'A simpler language level must never become an easier intellectual task.',
  'Where a technical term is essential, retain it and explain it in language appropriate to the requested level.',
  'Return one JSON object only. Do not use Markdown or prose outside the JSON.',
].join('\n');

export const TUTOR_STUB_TUTOR_OUTPUT_TRANSLATOR_SYSTEM_PROMPT = [
  'You rewrite one already-public tutor utterance into accessible contemporary standard English.',
  'Use only the supplied utterance. Do not draw on hidden context, continue the lesson, answer its question, or add facts.',
  'Preserve its public claims, literal observations, proper names, numbers, quoted evidence, uncertainty, and pedagogical intent.',
  'Replace world-specific jargon, apparatus labels, dramatic metaphors, and role-play phrasing with ordinary literal wording whenever they are not essential to meaning.',
  'Keep an essential technical term only when removing it would change the meaning, and explain it briefly at the requested language level.',
  'Return one JSON object only. Do not use Markdown or prose outside the JSON.',
].join('\n');

const SECTION_LABELS = Object.freeze({
  title: 'Title',
  essential_question: 'Essential question',
  main_artifact: 'What you will make',
  knowledge_component: 'What you need to understand',
  canonical_task: 'Inquiry task',
  verifier: 'How the work is checked',
  mastery_gate: 'Completion standard',
  transfer_challenge: 'Transfer challenge',
});

function compact(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function list(value) {
  return (Array.isArray(value) ? value : value ? [value] : []).map(compact).filter(Boolean);
}

function safeId(value, fallback) {
  const id = compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
  return id || fallback;
}

function segment(id, section, text, sourceLabel = null) {
  return Object.freeze({
    id,
    section,
    label: SECTION_LABELS[section],
    sourceLabel,
    text: compact(text),
  });
}

export function tutorStubCurriculumTranslationSource(module) {
  if (!module || typeof module !== 'object' || Array.isArray(module)) {
    throw new Error('curriculum translation requires an active curriculum module');
  }
  const moduleId = compact(module.id);
  const title = compact(module.title);
  if (!moduleId || !title) throw new Error('curriculum translation requires a module id and title');

  const segments = [segment('title', 'title', title)];
  if (compact(module.essential_question)) {
    segments.push(segment('essential_question', 'essential_question', module.essential_question));
  }
  if (compact(module.main_artifact)) {
    segments.push(segment('main_artifact', 'main_artifact', module.main_artifact));
  }
  for (const [index, component] of (module.knowledge_components || []).entries()) {
    const text = compact(typeof component === 'string' ? component : component?.statement);
    if (!text) continue;
    const sourceLabel = compact(typeof component === 'string' ? '' : component?.id) || null;
    segments.push(
      segment(
        `knowledge_component_${safeId(sourceLabel, String(index + 1).padStart(2, '0'))}`,
        'knowledge_component',
        text,
        sourceLabel,
      ),
    );
  }
  for (const [index, text] of list(module.canonical_tasks).entries()) {
    segments.push(segment(`canonical_task_${String(index + 1).padStart(2, '0')}`, 'canonical_task', text));
  }
  for (const [index, text] of list(module.verifiers).entries()) {
    segments.push(segment(`verifier_${String(index + 1).padStart(2, '0')}`, 'verifier', text));
  }
  if (compact(module.mastery_gate)) {
    segments.push(segment('mastery_gate', 'mastery_gate', module.mastery_gate));
  }
  if (compact(module.transfer_challenge)) {
    segments.push(segment('transfer_challenge', 'transfer_challenge', module.transfer_challenge));
  }

  return Object.freeze({
    moduleId,
    moduleTitle: title,
    segments: Object.freeze(segments),
  });
}

export function normalizeTutorStubCurriculumTranslationLevels(value = '') {
  const requested = compact(value).toLowerCase();
  if (!requested || requested === 'all') return TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS;
  if (!TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(requested)) {
    throw new Error(
      `use /translate, /translate all, or /translate ${TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.join('|')}`,
    );
  }
  return Object.freeze([requested]);
}

export function normalizeTutorStubTutorOutputTranslationLevels(value = '') {
  const requested = compact(value).toLowerCase();
  if (!requested) return Object.freeze(['basic']);
  if (requested === 'all') return TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS;
  if (!TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(requested)) {
    throw new Error(
      `use /translate, /translate all, or /translate ${TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.join('|')}`,
    );
  }
  return Object.freeze([requested]);
}

export function buildTutorStubTutorOutputTranslationPrompt({ text, levels = ['basic'] }) {
  const sourceText = compact(text);
  if (!sourceText) throw new Error('tutor output translation requires a public tutor message');
  const normalizedLevels = Object.freeze(
    [...levels].map((level) => {
      const id = compact(level).toLowerCase();
      if (!TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(id)) {
        throw new Error(`unknown tutor output translation level: ${level}`);
      }
      return id;
    }),
  );
  const profiles = Object.fromEntries(
    normalizedLevels.map((level) => [level, TUTOR_STUB_CURRICULUM_TRANSLATION_PROFILES[level].guide]),
  );
  const outputExample = {
    variants: normalizedLevels.map((level) => ({ level, text: '<rewritten tutor utterance>' })),
  };
  return {
    sourceText,
    levels: normalizedLevels,
    prompt: [
      '# Latest public tutor utterance',
      '',
      JSON.stringify({ text: sourceText }, null, 2),
      '',
      '# Requested language profiles',
      '',
      JSON.stringify(profiles, null, 2),
      '',
      '# Output contract',
      '',
      `Return exactly this JSON shape and these requested levels: ${JSON.stringify(outputExample)}`,
      'Rewrite the whole utterance independently at each requested level.',
      'Keep its live question or invitation, but do not introduce a next step that was not already present.',
      'Do not mention reading levels, translation, the source text, the tutor, or the learner inside rewritten text.',
    ].join('\n'),
  };
}

export function buildTutorStubCurriculumTranslationPrompt({
  module,
  levels = TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS,
}) {
  const source = tutorStubCurriculumTranslationSource(module);
  const normalizedLevels = Object.freeze(
    [...levels].map((level) => {
      const id = compact(level).toLowerCase();
      if (!TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(id)) {
        throw new Error(`unknown curriculum translation level: ${level}`);
      }
      return id;
    }),
  );
  const sourceObject = Object.fromEntries(source.segments.map((entry) => [entry.id, entry.text]));
  const outputExample = {
    variants: normalizedLevels.map((level) => ({
      level,
      segments: Object.fromEntries(source.segments.map((entry) => [entry.id, '<translated text>'])),
    })),
  };
  const profiles = Object.fromEntries(
    normalizedLevels.map((level) => [level, TUTOR_STUB_CURRICULUM_TRANSLATION_PROFILES[level].guide]),
  );
  return {
    source,
    levels: normalizedLevels,
    prompt: [
      '# Canonical curriculum source',
      '',
      JSON.stringify({ moduleId: source.moduleId, title: source.moduleTitle, segments: sourceObject }, null, 2),
      '',
      '# Requested language profiles',
      '',
      JSON.stringify(profiles, null, 2),
      '',
      '# Output contract',
      '',
      `Return exactly this JSON shape and exactly these segment keys: ${JSON.stringify(outputExample)}`,
      'Translate each segment independently so item boundaries and verification requirements remain inspectable.',
      'Do not omit, merge, split, rename, or add segments. Keep identifiers unchanged.',
      'Do not mention reading levels, translation, the source text, the tutor, or the learner inside translated segments.',
    ].join('\n'),
  };
}

function parseJsonObject(text, label = 'curriculum translation') {
  const cleaned = String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`${label} did not return a JSON object`);
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

export function parseTutorStubTutorOutputTranslation(text, { sourceText, levels }) {
  const source = compact(sourceText);
  if (!source) throw new Error('tutor output translation parser requires a public tutor message');
  const normalizedLevels = Object.freeze(
    (levels?.length ? levels : ['basic']).map((level) => compact(level).toLowerCase()),
  );
  if (
    new Set(normalizedLevels).size !== normalizedLevels.length ||
    normalizedLevels.some((level) => !TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(level))
  ) {
    throw new Error('tutor output translation parser received an invalid level set');
  }
  const payload = parseJsonObject(text, 'tutor output translation');
  if (!Array.isArray(payload.variants) || payload.variants.length !== normalizedLevels.length) {
    throw new Error(`tutor output translation must return ${normalizedLevels.length} variant(s)`);
  }
  const variantsByLevel = new Map();
  for (const row of payload.variants) {
    const level = compact(row?.level).toLowerCase();
    if (!normalizedLevels.includes(level) || variantsByLevel.has(level)) {
      throw new Error(`tutor output translation returned an unexpected or duplicate level: ${level || '(blank)'}`);
    }
    const translated = compact(row?.text);
    if (!translated) throw new Error(`tutor output translation level ${level} returned blank text`);
    variantsByLevel.set(
      level,
      Object.freeze({
        level,
        label: TUTOR_STUB_CURRICULUM_TRANSLATION_PROFILES[level].label,
        text: translated,
      }),
    );
  }
  return Object.freeze({
    schema: TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA,
    sourceText: source,
    levels: normalizedLevels,
    variants: Object.freeze(normalizedLevels.map((level) => variantsByLevel.get(level))),
  });
}

export function renderTutorStubTutorOutputTranslation(translation) {
  if (translation?.schema !== TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA) {
    throw new Error(`expected ${TUTOR_STUB_TUTOR_OUTPUT_TRANSLATION_SCHEMA}`);
  }
  return translation.variants
    .flatMap((variant, index) => [...(index ? [''] : []), `${variant.label.toUpperCase()} ENGLISH`, variant.text])
    .join('\n');
}

export function parseTutorStubCurriculumTranslation(text, { module, levels }) {
  const source = tutorStubCurriculumTranslationSource(module);
  const normalizedLevels = Object.freeze(
    (levels?.length ? levels : TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS).map((level) => compact(level).toLowerCase()),
  );
  if (
    new Set(normalizedLevels).size !== normalizedLevels.length ||
    normalizedLevels.some((level) => !TUTOR_STUB_CURRICULUM_TRANSLATION_LEVELS.includes(level))
  ) {
    throw new Error('curriculum translation parser received an invalid level set');
  }
  const payload = parseJsonObject(text);
  if (!Array.isArray(payload.variants) || payload.variants.length !== normalizedLevels.length) {
    throw new Error(`curriculum translation must return ${normalizedLevels.length} variant(s)`);
  }
  const sourceIds = source.segments.map((entry) => entry.id);
  const sourceIdSet = new Set(sourceIds);
  const variantsByLevel = new Map();
  for (const row of payload.variants) {
    const level = compact(row?.level).toLowerCase();
    if (!normalizedLevels.includes(level) || variantsByLevel.has(level)) {
      throw new Error(`curriculum translation returned an unexpected or duplicate level: ${level || '(blank)'}`);
    }
    if (!row.segments || typeof row.segments !== 'object' || Array.isArray(row.segments)) {
      throw new Error(`curriculum translation level ${level} must contain a segments object`);
    }
    const returnedIds = Object.keys(row.segments);
    const missing = sourceIds.filter((id) => !returnedIds.includes(id));
    const extra = returnedIds.filter((id) => !sourceIdSet.has(id));
    if (missing.length || extra.length) {
      throw new Error(
        `curriculum translation level ${level} changed segment keys${missing.length ? `; missing ${missing.join(', ')}` : ''}${extra.length ? `; extra ${extra.join(', ')}` : ''}`,
      );
    }
    const translatedSegments = source.segments.map((entry) => {
      const translated = compact(row.segments[entry.id]);
      if (!translated) throw new Error(`curriculum translation level ${level} left ${entry.id} blank`);
      return Object.freeze({ ...entry, translated });
    });
    variantsByLevel.set(
      level,
      Object.freeze({
        level,
        label: TUTOR_STUB_CURRICULUM_TRANSLATION_PROFILES[level].label,
        segments: Object.freeze(translatedSegments),
      }),
    );
  }
  return Object.freeze({
    schema: TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA,
    moduleId: source.moduleId,
    moduleTitle: source.moduleTitle,
    levels: normalizedLevels,
    variants: Object.freeze(normalizedLevels.map((level) => variantsByLevel.get(level))),
  });
}

export function renderTutorStubCurriculumTranslation(translation) {
  if (translation?.schema !== TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA) {
    throw new Error(`expected ${TUTOR_STUB_CURRICULUM_TRANSLATION_SCHEMA}`);
  }
  const lines = [];
  for (const [variantIndex, variant] of translation.variants.entries()) {
    if (variantIndex) lines.push('');
    lines.push(`${variant.label.toUpperCase()} ENGLISH`);
    let previousSection = null;
    for (const entry of variant.segments) {
      const listSection = ['knowledge_component', 'canonical_task', 'verifier'].includes(entry.section);
      if (listSection) {
        if (entry.section !== previousSection) lines.push(`${entry.label}:`);
        lines.push(`- ${entry.translated}`);
      } else {
        lines.push(`${entry.label}: ${entry.translated}`);
      }
      previousSection = entry.section;
    }
  }
  return lines.join('\n');
}
