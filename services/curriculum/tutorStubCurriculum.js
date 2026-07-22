import path from 'node:path';

import { loadCanonicalCurriculum } from './curriculumCompiler.js';
import { buildWorkplanCurriculum } from './workplanCurriculum.js';

function compact(value, max = 1200) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function list(values, max = 8) {
  return (Array.isArray(values) ? values : [])
    .map((value) => compact(value))
    .filter(Boolean)
    .slice(0, max);
}

function referencePaths(module) {
  const links = module?.workplan_binding?.links || {};
  return Object.entries(links)
    .flatMap(([kind, value]) => (Array.isArray(value) ? value : [value]).map((entry) => `${kind}: ${entry}`))
    .filter(Boolean)
    .slice(0, 12);
}

export function loadTutorStubCurriculum(ref, options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const normalized = String(ref || '').trim();
  if (!normalized) throw new Error('--curriculum requires "workplan" or a canonical curriculum YAML path');
  const curriculum = ['workplan', 'board', 'current-board'].includes(normalized.toLowerCase())
    ? buildWorkplanCurriculum({ itemsDir: path.join(root, 'workplan', 'items') })
    : loadCanonicalCurriculum(path.resolve(root, normalized));
  return {
    curriculum,
    sourceRef: ['workplan', 'board', 'current-board'].includes(normalized.toLowerCase())
      ? 'workplan:live'
      : path.relative(root, path.resolve(root, normalized)),
  };
}

export function listTutorStubCurriculumModules(bundle) {
  return (bundle?.curriculum?.modules || []).map((module) => ({
    id: module.id,
    sequence: module.sequence ?? null,
    title: module.title,
    status: module.workplan_binding?.status || null,
    priority: module.workplan_binding?.priority || null,
    owner: module.workplan_binding?.owner || null,
    essentialQuestion: module.essential_question || null,
  }));
}

export function selectTutorStubCurriculumModule(bundle, moduleRef) {
  const modules = bundle?.curriculum?.modules || [];
  const needle = String(moduleRef || '').trim();
  if (!needle) throw new Error('--curriculum requires --module <id>; use --list-curriculum-modules to browse');
  const exact = modules.find((module) => module.id === needle);
  if (exact) return exact;
  const lower = needle.toLowerCase();
  const matches = modules.filter(
    (module) =>
      module.id.toLowerCase().includes(lower) ||
      String(module.title || '')
        .toLowerCase()
        .includes(lower),
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`ambiguous --module "${needle}": ${matches.map((module) => module.id).join(', ')}`);
  }
  throw new Error(`unknown curriculum module "${needle}"; use --list-curriculum-modules to browse`);
}

export function renderTutorStubCurriculumModule(bundle, module) {
  if (!bundle?.curriculum || !module) return '';
  const curriculum = bundle.curriculum;
  const workplan = module.workplan_binding || null;
  const tasks = list(module.canonical_tasks);
  const components = (module.knowledge_components || [])
    .map((component) => `${component.id}: ${compact(component.statement)}`)
    .slice(0, 8);
  const verifiers = list(module.verifiers);
  const misconceptions = list(module.misconception_signatures, 6);
  const references = referencePaths(module);
  return [
    '# Reflective curriculum source',
    `Curriculum: ${curriculum.title} (${curriculum.id})`,
    `Source: ${bundle.sourceRef}`,
    curriculum.source?.source_hash ? `Source snapshot: ${curriculum.source.source_hash}` : null,
    `Module: ${module.id} — ${module.title}`,
    workplan
      ? `Current workplan state: ${workplan.priority || 'P?'} · ${workplan.status || 'open'} · ${workplan.type || 'work'} · owner ${workplan.owner || 'unassigned'}`
      : null,
    workplan?.blocked_by ? `Blocked by: ${compact(workplan.blocked_by)}` : null,
    workplan?.depends_on?.length ? `Declared dependencies: ${workplan.depends_on.join(', ')}` : null,
    module.essential_question ? `Essential question: ${compact(module.essential_question)}` : null,
    module.main_artifact ? `Learner-authored artifact: ${compact(module.main_artifact)}` : null,
    components.length ? `Source knowledge:\n${components.map((entry) => `- ${entry}`).join('\n')}` : null,
    tasks.length ? `Inquiry tasks:\n${tasks.map((entry) => `- ${entry}`).join('\n')}` : null,
    verifiers.length ? `Reasoning checks:\n${verifiers.map((entry) => `- ${entry}`).join('\n')}` : null,
    misconceptions.length
      ? `Plausible reasoning failures to test rather than announce:\n${misconceptions.map((entry) => `- ${entry}`).join('\n')}`
      : null,
    module.mastery_gate ? `Dialogue mastery gate: ${compact(module.mastery_gate)}` : null,
    module.transfer_challenge ? `Transfer challenge: ${compact(module.transfer_challenge)}` : null,
    references.length
      ? `Repository references to inspect rather than invent:\n${references.map((entry) => `- ${entry}`).join('\n')}`
      : null,
    workplan?.declared_completion_verification
      ? `Actual workplan completion gate: ${compact(workplan.declared_completion_verification)}`
      : null,
    '',
    'Curriculum-use rules:',
    '- Treat the learner as a collaborator reasoning about this work, not as a quiz-taker recalling card text.',
    '- Ask for the learner’s causal model, uncertainties, tradeoffs, and proposed tests; do not merely summarize the card.',
    '- Distinguish facts present in this source from hypotheses that require repository inspection or an experiment.',
    '- Do not claim the workplan item is complete, validated, merged, or empirically supported from dialogue alone.',
    '- Prefer one concrete next reasoning move per turn, and invite the learner to challenge the tutor’s framing.',
    curriculum.projection_boundary ? `Boundary: ${compact(curriculum.projection_boundary)}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function tutorStubCurriculumBundle(ref, moduleRef, options = {}) {
  const bundle = loadTutorStubCurriculum(ref, options);
  const module = selectTutorStubCurriculumModule(bundle, moduleRef);
  return {
    ...bundle,
    module,
    prompt: renderTutorStubCurriculumModule(bundle, module),
  };
}
