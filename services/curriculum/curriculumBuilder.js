import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { jsonrepair } from 'jsonrepair';

import {
  compileCurriculumToDramaSpec,
  compileCurriculumToRhetoricalDramaticPlans,
  compileCurriculumToWorldAdaptationSpec,
  validateCanonicalCurriculum,
} from './curriculumCompiler.js';

export const CURRICULUM_BUILDER_SCHEMA = 'ms-curriculum-builder-v0.1';
export const CURRICULUM_SCHEMA = 'ms-curriculum-v0.1';
export const DEFAULT_CURRICULUM_BUILDER_MODEL = 'codex.gpt-5.6-terra';

const STANDARD_PROFILE = Object.freeze({
  spine: '1EdTech CASE 1.1 inspired',
  note: 'Curriculum, modules, and knowledge components map to CASE documents/items/associations; verifier, misconception, evidence, and drama fields are Machine Spirits extensions.',
  extensions: ['ms:evidence', 'ms:verifier', 'ms:misconception', 'ms:drama_binding', 'ms:world_adaptation'],
});

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function list(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(/[;\n]/u).map(cleanText).filter(Boolean);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

export function curriculumBuilderSlug(value, fallback = 'curriculum') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLowerCase();
  return slug || fallback;
}

function modulePrefix(value, curriculumId) {
  const explicit = String(value || '')
    .replace(/[^a-zA-Z0-9]/gu, '')
    .toUpperCase()
    .slice(0, 8);
  if (explicit) return explicit;
  const initials = String(curriculumId || '')
    .split(/[_\s-]+/u)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return initials || 'M';
}

function normalizeReferenceIds(value) {
  return unique(list(value).map((entry) => entry.toUpperCase()));
}

function normalizeKnowledgeComponents(value, moduleId) {
  const rows = Array.isArray(value) ? value : list(value);
  return rows.map((entry, index) => {
    const source = typeof entry === 'string' ? { statement: entry } : entry || {};
    return {
      id: cleanText(source.id) || `${moduleId}-KC${String(index + 1).padStart(2, '0')}`,
      statement: cleanText(source.statement || source.text || source.outcome),
      ...(normalizeReferenceIds(source.reference_ids || source.references).length
        ? { reference_ids: normalizeReferenceIds(source.reference_ids || source.references) }
        : {}),
    };
  });
}

function normalizeModule(source, index, prefix) {
  const moduleId = cleanText(source.id) || `${prefix}${index + 1}`;
  const referenceIds = normalizeReferenceIds(source.reference_ids || source.references);
  return {
    id: moduleId,
    sequence: Number.isFinite(Number(source.sequence)) ? Number(source.sequence) : index + 1,
    title: cleanText(source.title) || `Module ${index + 1}`,
    hours: source.hours == null ? null : cleanText(source.hours),
    main_artifact: cleanText(source.main_artifact || source.artifact),
    primary_verifier: cleanText(source.primary_verifier || source.verifier),
    essential_question: cleanText(source.essential_question || source.question),
    knowledge_components: normalizeKnowledgeComponents(
      source.knowledge_components || source.learning_outcomes || source.outcomes,
      moduleId,
    ),
    canonical_tasks: list(source.canonical_tasks || source.tasks),
    verifiers: list(source.verifiers || source.verifier_evidence || source.primary_verifier || source.verifier),
    misconception_signatures: list(source.misconception_signatures || source.misconceptions),
    mastery_gate: cleanText(source.mastery_gate) || null,
    transfer_challenge: cleanText(source.transfer_challenge) || null,
    prerequisite_ids: unique(list(source.prerequisite_ids || source.prerequisites)),
    ...(referenceIds.length ? { reference_ids: referenceIds } : {}),
    world_adaptation: { runnable: source.world_adaptation?.runnable !== false },
  };
}

function normalizeReferences(references = []) {
  return references.map((reference, index) => ({
    id: cleanText(reference.id).toUpperCase() || `REF${String(index + 1).padStart(2, '0')}`,
    type: cleanText(reference.type) || 'reference',
    title: cleanText(reference.title) || cleanText(reference.url || reference.path) || `Reference ${index + 1}`,
    ...(reference.url ? { url: String(reference.url) } : {}),
    ...(reference.path ? { path: path.normalize(String(reference.path)) } : {}),
    ...(reference.media_type ? { media_type: cleanText(reference.media_type) } : {}),
    ...(reference.accessed_at ? { accessed_at: String(reference.accessed_at) } : {}),
    ...(reference.content_sha256 ? { content_sha256: String(reference.content_sha256) } : {}),
    ...(reference.excerpt ? { excerpt: cleanText(reference.excerpt) } : {}),
    ...(reference.extraction_status ? { extraction_status: cleanText(reference.extraction_status) } : {}),
  }));
}

export function buildCurriculumFromBrief(brief, options = {}) {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) {
    throw new Error('curriculum builder brief must be an object');
  }
  const title = cleanText(brief.title);
  if (!title) throw new Error('curriculum builder brief needs a title');
  const id = curriculumBuilderSlug(brief.id || `${title}_v1`);
  const references = normalizeReferences(options.references || brief.references || []);
  const prefix = modulePrefix(brief.module_prefix, id);
  const moduleRows = Array.isArray(brief.modules) ? brief.modules : [];
  if (!moduleRows.length) throw new Error('curriculum builder brief needs at least one module');
  const modules = moduleRows.map((module, index) => normalizeModule(module || {}, index, prefix));
  const sequential = brief.sequential_prerequisites !== false;
  const explicitAssociations = Array.isArray(brief.associations) ? brief.associations : [];
  const associations = explicitAssociations.length
    ? explicitAssociations.map((association) => ({
        from: cleanText(association.from),
        to: cleanText(association.to),
        relation: cleanText(association.relation) || 'prerequisite_of',
      }))
    : modules.flatMap((module, index) => {
        const prerequisiteIds = module.prerequisite_ids.length
          ? module.prerequisite_ids
          : sequential && index > 0
            ? [modules[index - 1].id]
            : [];
        return prerequisiteIds.map((from) => ({ from, to: module.id, relation: 'prerequisite_of' }));
      });

  const curriculum = {
    schema_version: CURRICULUM_SCHEMA,
    id,
    version: cleanText(brief.version) || '1.0.0',
    title,
    discipline: curriculumBuilderSlug(brief.discipline || id.replace(/_v\d+$/u, '')),
    status: cleanText(brief.status) || 'Draft curriculum',
    date: cleanText(brief.date) || options.date || new Date().toISOString().slice(0, 10),
    audience: cleanText(brief.audience) || null,
    delivery: cleanText(brief.delivery) || null,
    duration: {
      full_course: cleanText(brief.duration?.full_course || brief.duration) || null,
      mvp: cleanText(brief.duration?.mvp) || null,
    },
    prerequisites_text: cleanText(brief.prerequisites_text) || null,
    course_goal: cleanText(brief.course_goal || brief.goal) || null,
    source: {
      format: 'curriculum_builder',
      builder_schema: CURRICULUM_BUILDER_SCHEMA,
      brief_path: options.briefPath ? path.normalize(options.briefPath) : null,
      generated_with_model: options.generatedWithModel || null,
    },
    standard_profile: { ...STANDARD_PROFILE, extensions: [...STANDARD_PROFILE.extensions] },
    references,
    modules: modules.map(({ prerequisite_ids: _prerequisiteIds, ...module }) => module),
    associations,
    mvp: {
      module_ids: modules.map((module) => module.id),
      focus: list(brief.mvp?.focus || brief.course_goal || brief.goal),
    },
    build: {
      schema: CURRICULUM_BUILDER_SCHEMA,
      created_at: options.createdAt || new Date().toISOString(),
      source_count: references.length,
      boundary:
        'References inform authoring but do not verify mastery. World specs constrain action and remain separate from independent learning evaluation.',
    },
  };
  validateCurriculumBuilderCurriculum(curriculum);
  return curriculum;
}

function topologicalModuleOrder(curriculum) {
  const ids = curriculum.modules.map((module) => module.id);
  const indegree = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, []]));
  const seenEdges = new Set();
  for (const association of curriculum.associations || []) {
    if (association.relation !== 'prerequisite_of') continue;
    if (association.from === association.to)
      throw new Error(`module ${association.from} cannot be its own prerequisite`);
    const edgeKey = `${association.from}->${association.to}`;
    if (seenEdges.has(edgeKey)) throw new Error(`duplicate prerequisite edge ${edgeKey}`);
    seenEdges.add(edgeKey);
    outgoing.get(association.from).push(association.to);
    indegree.set(association.to, indegree.get(association.to) + 1);
  }
  const queue = ids.filter((id) => indegree.get(id) === 0);
  const ordered = [];
  while (queue.length) {
    const id = queue.shift();
    ordered.push(id);
    for (const next of outgoing.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (ordered.length !== ids.length) {
    const cyclic = ids.filter((id) => !ordered.includes(id));
    throw new Error(`curriculum prerequisite graph contains a cycle involving: ${cyclic.join(', ')}`);
  }
  return ordered;
}

export function validateCurriculumBuilderCurriculum(curriculum, source = '<builder>') {
  validateCanonicalCurriculum(curriculum, source);
  const referenceIds = new Set((curriculum.references || []).map((reference) => reference.id));
  if (referenceIds.size !== (curriculum.references || []).length) {
    throw new Error(`curriculum ${source}: duplicate reference id`);
  }
  for (const module of curriculum.modules) {
    const missing = [];
    if (!module.essential_question) missing.push('essential_question');
    if (!module.main_artifact) missing.push('main_artifact');
    if (!module.primary_verifier) missing.push('primary_verifier');
    if (!module.knowledge_components?.length) missing.push('knowledge_components');
    if (!module.canonical_tasks?.length) missing.push('canonical_tasks');
    if (!module.verifiers?.length) missing.push('verifiers');
    if (!module.misconception_signatures?.length) missing.push('misconception_signatures');
    if (missing.length) throw new Error(`curriculum ${source}: module ${module.id} missing ${missing.join(', ')}`);
    for (const referenceId of module.reference_ids || []) {
      if (!referenceIds.has(referenceId)) {
        throw new Error(`curriculum ${source}: module ${module.id} references unknown source ${referenceId}`);
      }
    }
    for (const kc of module.knowledge_components || []) {
      for (const referenceId of kc.reference_ids || []) {
        if (!referenceIds.has(referenceId)) {
          throw new Error(
            `curriculum ${source}: knowledge component ${kc.id} references unknown source ${referenceId}`,
          );
        }
      }
    }
  }
  const order = topologicalModuleOrder(curriculum);
  return {
    valid: true,
    moduleCount: curriculum.modules.length,
    knowledgeComponentCount: curriculum.modules.reduce(
      (total, module) => total + module.knowledge_components.length,
      0,
    ),
    associationCount: (curriculum.associations || []).length,
    referenceCount: (curriculum.references || []).length,
    topologicalOrder: order,
  };
}

function decodeHtml(value) {
  const entities = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return entities[entity.toLowerCase()] ?? match;
  });
}

export function extractCurriculumWebText(html) {
  const raw = String(html || '');
  const title = decodeHtml(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1] || '')
    .replace(/\s+/gu, ' ')
    .trim();
  const text = decodeHtml(
    raw
      .replace(/<!--[\s\S]*?-->/gu, ' ')
      .replace(/<(script|style|svg|noscript|nav|footer)[^>]*>[\s\S]*?<\/\1>/giu, ' ')
      .replace(/<br\s*\/?\s*>/giu, '\n')
      .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/giu, '\n')
      .replace(/<[^>]+>/gu, ' '),
  )
    .replace(/[ \t]+/gu, ' ')
    .replace(/\s*\n\s*/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
  return { title, text };
}

function contentHash(text) {
  return `sha256:${createHash('sha256').update(text).digest('hex')}`;
}

export async function loadCurriculumSourceMaterials(
  { urls = [], files = [] } = {},
  { fetchImpl = globalThis.fetch, now = () => new Date(), maxBytes = 2_000_000, maxModelChars = 24_000 } = {},
) {
  const materials = [];
  for (const urlValue of urls) {
    const url = new URL(urlValue);
    if (!['http:', 'https:'].includes(url.protocol))
      throw new Error(`unsupported source URL protocol: ${url.protocol}`);
    if (typeof fetchImpl !== 'function') throw new Error('web source loading requires fetch');
    const response = await fetchImpl(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'MachineSpirits-CurriculumBuilder/0.1' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`source ${url} returned HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`source ${url} exceeds ${maxBytes} bytes`);
    const mediaType = String(response.headers.get('content-type') || 'text/plain')
      .split(';')[0]
      .trim();
    if (!/^(text\/|application\/(json|xhtml\+xml|xml))/u.test(mediaType)) {
      throw new Error(
        `source ${url} has unsupported media type ${mediaType}; provide extracted HTML, text, or Markdown`,
      );
    }
    const raw = bytes.toString('utf8');
    const extracted = /html|xhtml/u.test(mediaType) ? extractCurriculumWebText(raw) : { title: '', text: raw.trim() };
    materials.push({
      type: 'web',
      title: extracted.title || url.hostname,
      url: response.url || url.toString(),
      media_type: mediaType,
      accessed_at: now().toISOString(),
      content_sha256: contentHash(extracted.text),
      excerpt: cleanText(extracted.text.slice(0, 600)),
      extraction_status: extracted.text ? 'extracted' : 'empty',
      content: extracted.text.slice(0, maxModelChars),
    });
  }
  for (const fileValue of files) {
    const filePath = path.resolve(fileValue);
    const stats = fs.statSync(filePath);
    if (stats.size > maxBytes) throw new Error(`source file ${filePath} exceeds ${maxBytes} bytes`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const extracted = /\.html?$/iu.test(filePath) ? extractCurriculumWebText(raw) : { title: '', text: raw.trim() };
    materials.push({
      type: 'local',
      title: extracted.title || path.basename(filePath),
      path: filePath,
      media_type: /\.html?$/iu.test(filePath) ? 'text/html' : 'text/plain',
      accessed_at: now().toISOString(),
      content_sha256: contentHash(extracted.text),
      excerpt: cleanText(extracted.text.slice(0, 600)),
      extraction_status: extracted.text ? 'extracted' : 'empty',
      content: extracted.text.slice(0, maxModelChars),
    });
  }
  return materials.map((material, index) => ({
    ...material,
    id: `REF${String(index + 1).padStart(2, '0')}`,
  }));
}

export function curriculumReferencesFromMaterials(materials = []) {
  return materials.map(({ content: _content, ...reference }) => reference);
}

export function curriculumBuilderDraftPrompt({ brief, materials = [], moduleCount = null }) {
  const sourceBlocks = materials.map(
    (material) =>
      `## ${material.id}: ${material.title}\nLocation: ${material.url || material.path}\nContent hash: ${material.content_sha256}\n\n${material.content}`,
  );
  return [
    '# Curriculum drafting task',
    '',
    'Turn the course brief and supplied reference extracts into a curriculum-builder brief.',
    'Return JSON only. Do not include markdown fences or commentary.',
    '',
    'Requirements:',
    `- Produce ${moduleCount || brief.module_count || 'the smallest coherent number of'} modules.`,
    '- Each module needs: title, essential_question, main_artifact, primary_verifier, at least two knowledge_components, at least one canonical_task, verifier, misconception_signature, mastery_gate, and transfer_challenge.',
    '- prerequisite_ids must form a directed acyclic graph and may only use module ids in this response.',
    '- A verifier must describe observable or mechanically checkable evidence; it cannot merely say an LLM will judge quality.',
    '- Misconception signatures must be plausible learner beliefs, not labels or caricatures.',
    '- Use reference_ids only when a supplied source directly supports that module or knowledge component.',
    '- Do not treat a reference as proof that a learner mastered anything.',
    '',
    'Output shape:',
    JSON.stringify(
      {
        title: 'Course title',
        id: 'course_id_v1',
        discipline: 'discipline_slug',
        audience: 'Audience',
        delivery: 'Delivery mode',
        course_goal: 'Observable course-level goal',
        module_prefix: 'XX',
        sequential_prerequisites: false,
        modules: [
          {
            id: 'XX1',
            title: 'Module title',
            essential_question: 'Question?',
            main_artifact: 'Learner-authored artifact',
            primary_verifier: 'Primary observable verifier',
            knowledge_components: [{ statement: 'Outcome', reference_ids: ['REF01'] }],
            canonical_tasks: ['Task'],
            verifiers: ['Verifier evidence'],
            misconception_signatures: ['Plausible mistaken belief'],
            mastery_gate: 'Observable gate',
            transfer_challenge: 'Novel transfer task',
            prerequisite_ids: [],
            reference_ids: ['REF01'],
          },
        ],
      },
      null,
      2,
    ),
    '',
    'Course brief:',
    JSON.stringify(brief, null, 2),
    ...(sourceBlocks.length ? ['', '# Reference extracts', ...sourceBlocks] : []),
  ].join('\n');
}

export function parseCurriculumBuilderDraftResponse(text) {
  const stripped = String(text || '')
    .replace(/```(?:json)?/giu, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('curriculum drafting model returned no JSON object');
  return JSON.parse(jsonrepair(stripped.slice(start, end + 1)));
}

export function compileCurriculumBuilderBundle(curriculum, { rhetorical = false } = {}) {
  const validation = validateCurriculumBuilderCurriculum(curriculum);
  const worlds = compileCurriculumToWorldAdaptationSpec(curriculum, { mode: 'all' });
  const dramas = compileCurriculumToDramaSpec(curriculum, { mode: 'all', source: 'curriculum' });
  const rhetoricalPlans = rhetorical ? compileCurriculumToRhetoricalDramaticPlans(curriculum, { mode: 'all' }) : null;
  const rhetoricalDramas = rhetorical
    ? compileCurriculumToDramaSpec(curriculum, {
        mode: 'all',
        source: 'rhetorical_dramatic_plan',
        arms: ['adaptive_curriculum_drama'],
      })
    : null;
  return { validation, worlds, dramas, rhetoricalPlans, rhetoricalDramas };
}

export function curriculumBuilderOutputPaths(curriculumPath) {
  const absolute = path.resolve(curriculumPath);
  const base = absolute.replace(/\.curriculum\.ya?ml$/iu, '').replace(/\.ya?ml$/iu, '');
  return {
    curriculum: absolute,
    worlds: `${base}.worlds.yaml`,
    dramas: `${base}.dramas.yaml`,
    rhetoricalPlans: `${base}.rhetorical-dramatic-plans.yaml`,
    rhetoricalDramas: `${base}.rhetorical-dramas.yaml`,
    report: `${base}.builder-report.md`,
  };
}

function mermaidLabel(value) {
  return cleanText(value).replace(/["<>]/gu, '');
}

export function renderCurriculumBuilderReport({ curriculum, validation, outputs = {}, compiled = true }) {
  const moduleMap = new Map(curriculum.modules.map((module) => [module.id, module]));
  const graph = [
    'flowchart LR',
    ...curriculum.modules.map((module) => `  ${module.id}["${mermaidLabel(`${module.id} · ${module.title}`)}"]`),
    ...(curriculum.associations || [])
      .filter((association) => association.relation === 'prerequisite_of')
      .map((association) => `  ${association.from} --> ${association.to}`),
  ];
  const moduleRows = curriculum.modules.map(
    (module) =>
      `| ${module.id} | ${module.title} | ${module.knowledge_components.length} | ${module.canonical_tasks.length} | ${module.verifiers.length} | ${module.misconception_signatures.length} |`,
  );
  const referenceRows = (curriculum.references || []).map(
    (reference) =>
      `- **${reference.id} — ${reference.title}.** ${reference.url || reference.path || ''} (${reference.content_sha256 || 'no hash'})`,
  );
  const outputRows = Object.entries(outputs)
    .filter(([, value]) => value)
    .map(([key, value]) => `- ${key}: \`${value}\``);
  const firstDramaId = `D_${curriculum.modules[0].id}_CURRICULUM`;
  const dryRunCommand = outputs.dramas
    ? `node scripts/generate-pedagogical-dramas.js --dry-run --spec ${outputs.dramas} --only ${firstDramaId} --max-turns 2`
    : null;
  return [
    `# ${curriculum.title} — curriculum build report`,
    '',
    `- Curriculum: \`${curriculum.id}\` v${curriculum.version}`,
    `- Modules: ${validation.moduleCount}; knowledge components: ${validation.knowledgeComponentCount}`,
    `- Prerequisite edges: ${validation.associationCount}; references: ${validation.referenceCount}`,
    `- Topological order: ${validation.topologicalOrder.join(' → ')}`,
    `- Compiler status: ${compiled ? 'canonical curriculum, worlds, and dramas compiled' : 'canonical curriculum only'}`,
    '',
    '## Prerequisite DAG',
    '',
    '```mermaid',
    ...graph,
    '```',
    '',
    '## Module readiness',
    '',
    '| ID | Module | KCs | Tasks | Verifiers | Misconceptions |',
    '|---|---|---:|---:|---:|---:|',
    ...moduleRows,
    '',
    '## Sources',
    '',
    ...(referenceRows.length ? referenceRows : ['No external references were supplied.']),
    '',
    '## Artifacts',
    '',
    ...outputRows,
    '',
    ...(dryRunCommand
      ? [
          '## Next safe check',
          '',
          '```bash',
          dryRunCommand,
          '```',
          '',
          'This checks routing and turn-plan shape without writing a transcript or calling a model. Move to `--mock` only after this succeeds.',
          '',
        ]
      : []),
    '## Boundary',
    '',
    'The prerequisite graph structures progression. The compiled world specs constrain tutor action. Neither is an evaluator: learning claims still require learner evidence, verifier results, transcript-quality analysis, or an independent judge.',
    '',
    ...[...moduleMap.values()].flatMap((module) => [
      `### ${module.id} — ${module.title}`,
      '',
      `Essential question: ${module.essential_question}`,
      '',
      `Artifact: ${module.main_artifact}`,
      '',
      `Primary verifier: ${module.primary_verifier}`,
      '',
    ]),
  ].join('\n');
}
