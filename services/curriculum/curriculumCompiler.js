import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'yaml';

const DEFAULT_SCHEMA_VERSION = 'ms-curriculum-v0.1';
const WORLD_COLLECTION_SCHEMA_VERSION = 'ms-curriculum-worlds-v0.1';
const WORLD_ADAPTATION_SCHEMA_VERSION = 'ms-world-adaptation-v0.1';

const GRAPH_NODE_TO_MODULE = {
  B: 'AF0',
  M1: 'AF1',
  M2: 'AF2',
  M3: 'AF3',
  M4: 'AF4',
  M5: 'AF5',
  M6: 'AF6',
  M7: 'AF7',
  M8: 'AF8',
  M9: 'AF9',
  M10: 'AF10',
  M11: 'AF11',
  M12: 'AF12',
};

const MVP_MODULE_IDS = new Set(['AF1', 'AF4', 'AF5', 'AF6', 'AF11', 'AF12']);

const ADAPTIVE_ACTION_TYPES = new Set([
  'observe_no_intervention',
  'diagnose_with_discriminating_question',
  'elicit_prediction',
  'request_evidence',
  'ask_strategy_choice',
  'contrast_models',
  'fade_hint',
  'minimal_hint',
  'lower_cognitive_load',
  'repair_overconfidence',
  'challenge_without_telling',
  'reanchor_goal',
  'summarize_and_release',
  'explain_principle',
  'model_worked_example',
  'name_the_disagreement',
  'acknowledge_and_redirect',
  'repair_misrecognition',
  'mirror_and_extend',
  'withhold_answer',
]);

const DEFAULT_WORLD_ACTION_POLICY = Object.freeze({
  allowed_action_families: [
    'diagnose_with_discriminating_question',
    'request_evidence',
    'ask_strategy_choice',
    'contrast_models',
    'minimal_hint',
    'challenge_without_telling',
    'reanchor_goal',
    'repair_overconfidence',
    'name_the_disagreement',
    'withhold_answer',
    'explain_principle',
  ],
  preferred_action_families: [
    'diagnose_with_discriminating_question',
    'request_evidence',
    'contrast_models',
    'ask_strategy_choice',
  ],
  disallowed_action_families: ['model_worked_example'],
});

const MODULE_WORLD_ACTION_PREFERENCES = {
  AF1: ['diagnose_with_discriminating_question', 'reanchor_goal', 'request_evidence', 'ask_strategy_choice'],
  AF4: ['request_evidence', 'contrast_models', 'reanchor_goal', 'repair_overconfidence'],
  AF5: ['request_evidence', 'ask_strategy_choice', 'repair_overconfidence', 'minimal_hint'],
  AF6: ['repair_overconfidence', 'request_evidence', 'contrast_models', 'challenge_without_telling'],
  AF11: ['name_the_disagreement', 'request_evidence', 'withhold_answer', 'challenge_without_telling'],
  AF12: ['ask_strategy_choice', 'request_evidence', 'contrast_models', 'observe_no_intervention'],
};

const DEFAULT_WORLD_FORBIDDEN_MOVES = Object.freeze([
  {
    id: 'no_hidden_label_exposure',
    move: 'hidden_label_exposure',
    description: 'Do not expose curriculum misconception labels, answer keys, or verifier internals to the learner.',
  },
  {
    id: 'no_premature_proof_supply',
    move: 'supply_decisive_step',
    description: 'Do not supply the decisive proof or artifact repair before the learner commits to a testable move.',
  },
  {
    id: 'no_artifact_replacement',
    move: 'replace_learner_plan',
    description: 'Do not replace the learner-authored artifact or plan with a tutor-authored finished answer.',
  },
]);

const MODULE_DRAMA_DEFAULTS = {
  AF0: { persona: 'confused_novice', pedagogical: 'vygotsky_zpd_scaffolding', dialogue: 'workshop_clinic' },
  AF1: { persona: 'focused_achiever', pedagogical: 'socratic_elenchus', dialogue: 'courtroom_cross_examination' },
  AF2: { persona: 'focused_achiever', pedagogical: 'socratic_elenchus', dialogue: 'socratic_short_exchange' },
  AF3: { persona: 'confused_novice', pedagogical: 'socratic_elenchus', dialogue: 'socratic_short_exchange' },
  AF4: { persona: 'focused_achiever', pedagogical: 'vygotsky_zpd_scaffolding', dialogue: 'workshop_clinic' },
  AF5: { persona: 'focused_achiever', pedagogical: 'bloom_cognitive_ladder', dialogue: 'workshop_clinic' },
  AF6: { persona: 'adversarial_tester', pedagogical: 'socratic_elenchus', dialogue: 'courtroom_cross_examination' },
  AF7: { persona: 'confused_novice', pedagogical: 'bloom_cognitive_ladder', dialogue: 'workshop_clinic' },
  AF8: { persona: 'eager_explorer', pedagogical: 'montessori_prepared_environment', dialogue: 'workshop_clinic' },
  AF9: { persona: 'adversarial_tester', pedagogical: 'hegelian_recognition', dialogue: 'online_thread' },
  AF10: { persona: 'focused_achiever', pedagogical: 'socratic_elenchus', dialogue: 'workshop_clinic' },
  AF11: { persona: 'adversarial_tester', pedagogical: 'hidden_curriculum', dialogue: 'miller_social_reckoning' },
  AF12: { persona: 'focused_achiever', pedagogical: 'hegelian_recognition', dialogue: 'workshop_clinic' },
};

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { data: {}, body: markdown };
  return {
    data: yaml.parse(match[1]) || {},
    body: markdown.slice(match[0].length),
  };
}

function firstHeading(body) {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim() || null;
}

function normalizeWhitespace(text) {
  return String(text || '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdown(text) {
  return normalizeWhitespace(text)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\([^)]+\)/g, '$1');
}

function parseTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const cells = trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => stripMarkdown(cell.trim()));
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return null;
  return cells;
}

function parseCourseMap(markdown) {
  const section = markdown.match(/## 7\. Course map\n\n([\s\S]*?)(?=\n---\n|\n# 8\.|\n## Module 0)/)?.[1] || '';
  const rows = section.split('\n').map(parseTableRow).filter(Boolean);
  const dataRows = rows.slice(1);
  const byId = new Map();
  for (const row of dataRows) {
    const moduleMatch = row[0]?.match(/^(\d+)\.\s+(.+)$/);
    if (!moduleMatch) continue;
    const id = `AF${moduleMatch[1]}`;
    byId.set(id, {
      hours: row[1] || null,
      main_artifact: row[2] || null,
      primary_verifier: row[3] || null,
    });
  }
  return byId;
}

function parsePrerequisites(markdown) {
  const block = markdown.match(/```mermaid\nflowchart LR\n([\s\S]*?)```/)?.[1] || '';
  const prerequisites = [];
  for (const line of block.split('\n')) {
    const match = line.trim().match(/^(\w+)\s+-->\s+(\w+)$/);
    if (!match) continue;
    const from = GRAPH_NODE_TO_MODULE[match[1]];
    const to = GRAPH_NODE_TO_MODULE[match[2]];
    if (from && to) prerequisites.push({ from, to, relation: 'prerequisite_of' });
  }
  return prerequisites;
}

function findModuleBlocks(markdown) {
  const starts = [...markdown.matchAll(/^## Module (\d+) [—-] (.+)$/gm)].map((match) => ({
    number: Number(match[1]),
    title: stripMarkdown(match[2]),
    index: match.index,
    headingLength: match[0].length,
  }));
  return starts.map((start, i) => {
    const next = starts[i + 1]?.index ?? markdown.search(/\n## 9\.1 Knowledge component structure/);
    const end = next > start.index ? next : markdown.length;
    return {
      ...start,
      id: `AF${start.number}`,
      block: markdown.slice(start.index + start.headingLength, end).trim(),
    };
  });
}

function sectionText(block, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`(?:^|\\n)### ${escaped}\\s*\\n+([\\s\\S]*?)(?=\\n### |\\n## |$)`));
  return match ? normalizeWhitespace(match[1]) : '';
}

function parseBullets(text) {
  const bullets = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (bullet) {
      if (current) bullets.push(stripMarkdown(current));
      current = bullet[1].trim();
      continue;
    }
    if (current && line.trim()) current += ` ${line.trim()}`;
  }
  if (current) bullets.push(stripMarkdown(current));
  return bullets;
}

function parseNumberedItems(text) {
  const items = [];
  let current = null;
  for (const line of String(text || '').split('\n')) {
    const item = line.match(/^\s*\d+\.\s+(.+)$/);
    if (item) {
      if (current) items.push(stripMarkdown(current));
      current = item[1].trim();
      continue;
    }
    if (current && line.trim()) current += ` ${line.trim()}`;
  }
  if (current) items.push(stripMarkdown(current));
  return items;
}

function parseKnowledgeComponents(text, moduleId) {
  return parseBullets(text).map((entry, index) => {
    const match = entry.match(/^([A-Z]+-[A-Z]?\d+)\s+(.+?)\.?$/);
    if (!match) {
      return {
        id: `${moduleId}-KC${String(index + 1).padStart(2, '0')}`,
        statement: entry,
        source: 'generated_id',
      };
    }
    return {
      id: match[1],
      statement: match[2].replace(/\.$/, ''),
    };
  });
}

function parseEssentialQuestion(block) {
  return stripMarkdown(block.match(/\*\*Essential question:\*\*\s*(.+)$/m)?.[1] || '');
}

function parseModule(block, moduleId) {
  const knowledgeComponents = parseKnowledgeComponents(sectionText(block, 'Knowledge components'), moduleId);
  const capstoneBrief = sectionText(block, 'Capstone brief');
  const mechanicallyChecked = sectionText(block, 'Mechanically checked deliverables');
  const expertReviewed = sectionText(block, 'Human or expert-reviewed deliverables');
  const capstoneCompletion = sectionText(block, 'Capstone completion standard');
  const canonicalTasks = parseBullets(sectionText(block, 'Canonical tasks'));
  const misconceptionSignatures = parseBullets(sectionText(block, 'Misconception signatures'));
  const verifiersText = sectionText(block, 'Verifiers');
  const transferChallenge = sectionText(block, 'Transfer challenge');
  const masteryGate = sectionText(block, 'Mastery gate');
  const capstoneTasks = parseNumberedItems(capstoneBrief);
  const capstoneVerifiers = [
    ...parseBullets(mechanicallyChecked),
    ...parseBullets(expertReviewed).map((entry) => `Expert review: ${entry}`),
  ];
  const capstoneMisconceptions =
    moduleId === 'AF12'
      ? [
          'A successful capstone must recommend deployment.',
          'Passing hidden tests is enough even when leakage, provenance, or risk evidence fails.',
          'A final model metric is the same as a justified system claim.',
          'Expert review can override failed deterministic correctness or reproducibility gates.',
        ]
      : [];

  return {
    essential_question: parseEssentialQuestion(block) || null,
    knowledge_components: knowledgeComponents,
    canonical_tasks: canonicalTasks.length ? canonicalTasks : capstoneTasks,
    verifiers: verifiersText ? [stripMarkdown(verifiersText)] : capstoneVerifiers,
    misconception_signatures: misconceptionSignatures.length ? misconceptionSignatures : capstoneMisconceptions,
    mastery_gate: masteryGate ? stripMarkdown(masteryGate) : capstoneCompletion ? stripMarkdown(capstoneCompletion) : null,
    transfer_challenge: transferChallenge ? stripMarkdown(transferChallenge) : null,
  };
}

function parseMvp(markdown) {
  const mvpBlock = markdown.match(/## 14\.2 MVP modules\n\n([\s\S]*?)(?=\n### Indicative scope)/)?.[1] || '';
  const focus = parseBullets(mvpBlock);
  return {
    module_ids: [...MVP_MODULE_IDS],
    focus,
  };
}

export function parseAiFoundationsMarkdown(markdown, options = {}) {
  const { data: frontmatter, body } = extractFrontmatter(markdown);
  const title = firstHeading(body) || frontmatter.title || 'Untitled curriculum';
  const courseMap = parseCourseMap(body);
  const moduleBlocks = findModuleBlocks(body);
  const prerequisites = parsePrerequisites(body);

  const modules = moduleBlocks.map((moduleBlock) => {
    const mapEntry = courseMap.get(moduleBlock.id) || {};
    return {
      id: moduleBlock.id,
      sequence: moduleBlock.number,
      title: moduleBlock.title,
      ...mapEntry,
      ...parseModule(moduleBlock.block, moduleBlock.id),
    };
  });

  return {
    schema_version: options.schemaVersion || DEFAULT_SCHEMA_VERSION,
    id: options.id || 'ai_foundations_v1',
    version: options.version || '1.0.0',
    title,
    status: frontmatter.status || null,
    date: frontmatter.date || null,
    audience: frontmatter.audience || null,
    delivery: frontmatter.delivery || null,
    duration: {
      full_course: frontmatter.full_course_duration || null,
      mvp: frontmatter.mvp_duration || null,
    },
    prerequisites_text: frontmatter.prerequisites || null,
    source: {
      format: 'markdown',
      path: options.sourcePath ? path.normalize(options.sourcePath) : null,
    },
    standard_profile: {
      spine: '1EdTech CASE 1.1 inspired',
      note: 'Curriculum, modules, and knowledge components map to CASE documents/items/associations; verifier, misconception, evidence, and drama fields are Machine Spirits extensions.',
      extensions: ['ms:evidence', 'ms:verifier', 'ms:misconception', 'ms:drama_binding', 'ms:world_adaptation'],
    },
    modules,
    associations: prerequisites,
    mvp: parseMvp(body),
  };
}

export function loadCanonicalCurriculum(filePath) {
  const raw = yaml.parse(fs.readFileSync(filePath, 'utf8'));
  validateCanonicalCurriculum(raw, filePath);
  return raw;
}

export function validateCanonicalCurriculum(curriculum, source = '<inline>') {
  const fail = (message) => {
    throw new Error(`curriculum ${source}: ${message}`);
  };
  if (!curriculum || typeof curriculum !== 'object') fail('not an object');
  if (!curriculum.schema_version) fail('missing schema_version');
  if (!curriculum.id) fail('missing id');
  if (!Array.isArray(curriculum.modules) || curriculum.modules.length === 0) fail('modules must be a non-empty array');

  const moduleIds = new Set();
  const kcIds = new Set();
  for (const module of curriculum.modules) {
    if (!module.id) fail('module missing id');
    if (moduleIds.has(module.id)) fail(`duplicate module id ${module.id}`);
    moduleIds.add(module.id);
    if (!module.title) fail(`module ${module.id} missing title`);
    if (!Array.isArray(module.knowledge_components)) {
      fail(`module ${module.id} knowledge_components must be an array`);
    }
    for (const kc of module.knowledge_components) {
      if (!kc.id || !kc.statement) fail(`module ${module.id} has malformed knowledge component`);
      if (kcIds.has(kc.id)) fail(`duplicate knowledge component id ${kc.id}`);
      kcIds.add(kc.id);
    }
  }
  for (const association of curriculum.associations || []) {
    if (!moduleIds.has(association.from)) fail(`association references unknown from module ${association.from}`);
    if (!moduleIds.has(association.to)) fail(`association references unknown to module ${association.to}`);
  }
  return true;
}

function compactList(items, max = 3) {
  return (items || []).filter(Boolean).slice(0, max);
}

function uniqueList(items = []) {
  return [...new Set((items || []).filter(Boolean))];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function firstOrFallback(items, fallback) {
  return compactList(items, 1)[0] || fallback;
}

function sentenceFragment(text) {
  return String(text || '')
    .trim()
    .replace(/[.!?]+$/u, '');
}

function dramaIdFor(moduleId) {
  return `D_${moduleId}_CURRICULUM`;
}

function routeChangeFrom(module) {
  return sentenceFragment(firstOrFallback(module.misconception_signatures, module.essential_question || module.title));
}

function routeChangeTo(module) {
  return sentenceFragment(firstOrFallback(module.canonical_tasks, module.main_artifact || module.title));
}

function learnerStartState(module) {
  const misconception = firstOrFallback(module.misconception_signatures, 'has a plausible but untested first framing');
  const task = firstOrFallback(module.canonical_tasks, module.main_artifact || 'produce a checkable artifact');
  const verifier = firstOrFallback(module.verifiers, module.primary_verifier || 'the curriculum verifier');
  return [
    `The learner is working on ${module.main_artifact || module.title}.`,
    `Likely first misframing: ${sentenceFragment(misconception)}.`,
    `Immediate task: ${sentenceFragment(task)}.`,
    `The scene should make the artifact answerable to ${sentenceFragment(verifier)}.`,
  ].join(' ');
}

function dramaShape(module) {
  const from = routeChangeFrom(module);
  const to = routeChangeTo(module);
  return `${from} -> artifact-mediated test -> ${to}`;
}

function turnPlanFor(module) {
  return [
    {
      at: { turn: 1 },
      role: 'director',
      moves: ['inject_revisit_cue'],
      cue: { policy: 'reframe', anchor: 'misframing-candidate' },
    },
    {
      at: { turn: 3 },
      role: 'tutor',
      when_trigger: ['pseudo_catharsis', 'closure_pressure', 'resistance', 'misfit'],
      moves: ['stock_take', 'route_change', 'action_gate'],
      route_change: { from: routeChangeFrom(module), to: routeChangeTo(module) },
      forbid: ['hold'],
    },
    {
      at: { turn: 3 },
      role: 'learner',
      moves: ['perform_device'],
      forbid: ['pseudo_catharsis'],
    },
    {
      at: { turn: 5 },
      role: 'tutor',
      moves: ['recognition_press'],
    },
  ];
}

function moduleHasRunnableWorldEvidence(module) {
  return (
    runnableWorldModule(module) &&
    Boolean(firstOrFallback(module.verifiers, module.primary_verifier)) &&
    compactList(module.misconception_signatures, 1).length > 0
  );
}

function publicWorldConstraintProjection(spec) {
  const successObservables = uniqueList(
    (spec.expected_transitions || []).flatMap((transition) => transition.world_success_observables || []),
  ).slice(0, 5);
  return {
    artifact: spec.outcome_observability?.artifact || null,
    primary_verifier: spec.outcome_observability?.primary_verifier || null,
    verifier_evidence: compactList(spec.outcome_observability?.verifier_evidence || [], 3),
    preferred_action_families: compactList(spec.action_policy?.preferred_action_families || [], 6),
    disallowed_action_families: compactList(spec.action_policy?.disallowed_action_families || [], 6),
    success_observables: successObservables,
    forbidden_public_moves: compactList(
      (spec.forbidden_moves || []).map((move) => move.description || move.move),
      4,
    ),
    boundary: 'Public-safe projection for drama generation; hidden misconception IDs and answer keys are not included.',
  };
}

function worldDramaBindingForModule(module, curriculum) {
  if (!moduleHasRunnableWorldEvidence(module)) return null;
  const spec = worldAdaptationSpecForModule(module, curriculum);
  return {
    world_adaptation_spec_id: spec.id,
    world_adaptation_spec_version: spec.version,
    world_adaptation_spec_hash: spec.spec_hash,
    world_locked_at_compile_time: spec.locked_at_compile_time,
    world_public_constraints: publicWorldConstraintProjection(spec),
  };
}

function dramaForModule(module, curriculum) {
  const defaults = MODULE_DRAMA_DEFAULTS[module.id] || MODULE_DRAMA_DEFAULTS.AF1;
  const worldBinding = worldDramaBindingForModule(module, curriculum);
  return {
    id: dramaIdFor(module.id),
    discipline: 'ai_foundations',
    topic: module.essential_question || module.title,
    persona: defaults.persona,
    condition: 'recognition',
    tutor_profile: 'recognition',
    learner_profile: 'ego_superego_recognition_authentic',
    pedagogical_approach: defaults.pedagogical,
    dialogue_approach: defaults.dialogue,
    director_revisit_policy: 'reframe',
    director_revisit_anchor: 'misframing-candidate',
    tutor_adaptation_policy: 'peripeteia',
    opening_speaker: 'learner',
    ending_speaker: 'learner',
    scenario_name: `${curriculum.id}: ${module.id} ${module.title}`,
    learner_start_state: learnerStartState(module),
    learner_voice_constraint:
      'The learner should expose the first framing in ordinary working speech before the tutor corrects it. Keep the artifact visible in the dialogue.',
    intended_tutor_character:
      'Evidence-bearing adaptive tutor: separate diagnosis, action selection, artifact verification, and outcome closure.',
    intended_lean: 'curriculum_drama',
    dramatic_shape: dramaShape(module),
    curriculum_binding: {
      curriculum_id: curriculum.id,
      module_id: module.id,
      module_title: module.title,
      kc_ids: module.knowledge_components.map((kc) => kc.id),
      main_artifact: module.main_artifact || null,
      primary_verifier: module.primary_verifier || null,
      misconceptions: compactList(module.misconception_signatures, 6),
      ...(worldBinding || {}),
    },
    turn_plan: turnPlanFor(module),
  };
}

function worldIdFor(moduleId) {
  return `W_${moduleId}_CURRICULUM`;
}

function stableForHash(value) {
  if (Array.isArray(value)) return value.map(stableForHash);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => key !== 'spec_hash')
      .sort()
      .map((key) => [key, stableForHash(value[key])]),
  );
}

function stableStringify(value) {
  return JSON.stringify(stableForHash(value));
}

export function computeWorldAdaptationSpecHash(spec) {
  return `sha256:${createHash('sha256').update(stableStringify(spec)).digest('hex')}`;
}

function runnableWorldModule(module) {
  return module?.world_adaptation?.runnable !== false;
}

function assertRunnableWorldModule(module) {
  if (!runnableWorldModule(module)) return;
  if (!firstOrFallback(module.verifiers, module.primary_verifier)) {
    throw new Error(`module ${module.id} cannot compile world_adaptation_spec without verifier evidence`);
  }
  if (!compactList(module.misconception_signatures, 1).length) {
    throw new Error(`module ${module.id} cannot compile world_adaptation_spec without misconception evidence`);
  }
}

function misconceptionHypotheses(signature) {
  const lower = String(signature || '').toLowerCase();
  const ids = [];
  if (/right|correct|accuracy|complex|automatically|proves|best/u.test(lower)) ids.push('false_mastery');
  if (/causal|cause|represents|representative|stakeholder|objective/u.test(lower)) {
    ids.push('correct_alternative_model');
  }
  if (/task|asking|tool|ai|automation|decision|problem/u.test(lower)) ids.push('task_misread');
  if (/formula|memor|threshold|metric|label|schema|split|leak/u.test(lower)) ids.push('procedure_without_rationale');
  if (/answer|just tell|finish/u.test(lower)) ids.push('answer_seeking');
  return uniqueList(ids.length ? ids : ['correct_alternative_model', 'procedure_without_rationale']).slice(0, 3);
}

function evidenceForKnowledgeComponent(kc, module) {
  return [
    `Learner uses ${sentenceFragment(kc.statement)} while working on ${module.main_artifact || module.title}.`,
    `Learner connects the component to ${sentenceFragment(firstOrFallback(module.canonical_tasks, module.title))}.`,
  ];
}

function evidenceForMisconception(signature, module) {
  return [
    `Learner frames ${module.main_artifact || module.title} as: ${sentenceFragment(signature)}.`,
    `Learner resists or repairs the framing when asked for artifact-level evidence.`,
  ];
}

function actionPolicyForModule(module) {
  return {
    allowed_action_families: [...DEFAULT_WORLD_ACTION_POLICY.allowed_action_families],
    preferred_action_families: [
      ...(MODULE_WORLD_ACTION_PREFERENCES[module.id] || DEFAULT_WORLD_ACTION_POLICY.preferred_action_families),
    ],
    disallowed_action_families: [...DEFAULT_WORLD_ACTION_POLICY.disallowed_action_families],
  };
}

function expectedTransitionsForModule(module) {
  const task = sentenceFragment(firstOrFallback(module.canonical_tasks, module.main_artifact || module.title));
  const verifier = sentenceFragment(firstOrFallback(module.verifiers, module.primary_verifier || 'the verifier'));
  return [
    {
      action_type: 'diagnose_with_discriminating_question',
      success_evidence: ['state-disambiguating response'],
      failure_evidence: ['mere agreement', 'undifferentiated help request'],
      world_success_observables: [`Learner identifies which part of "${task}" is uncertain.`],
    },
    {
      action_type: 'request_evidence',
      success_evidence: ['learner-authored rationale'],
      failure_evidence: ['mere agreement', 'verbatim adoption of tutor rationale'],
      world_success_observables: [`Learner gives a reason that can be checked by ${verifier}.`],
    },
    {
      action_type: 'contrast_models',
      success_evidence: ['model comparison'],
      failure_evidence: ['mere agreement'],
      world_success_observables: ['Learner contrasts the misconception with an artifact-testable alternative.'],
    },
    {
      action_type: 'ask_strategy_choice',
      success_evidence: ['learner-authored choice'],
      failure_evidence: ['empty release', 'mere agreement'],
      world_success_observables: [`Learner chooses the next check for ${module.main_artifact || module.title}.`],
    },
    {
      action_type: 'withhold_answer',
      success_evidence: ['learner-authored next step'],
      failure_evidence: ['undifferentiated help request', 'empty release'],
      world_success_observables: ['Learner makes a bounded attempt before receiving validation.'],
    },
    {
      action_type: 'minimal_hint',
      success_evidence: ['learner-authored next step'],
      failure_evidence: ['evidence of deeper gap', 'undifferentiated help request'],
      world_success_observables: [`Learner uses the hint to advance ${sentenceFragment(module.main_artifact || module.title)}.`],
    },
  ];
}

function worldAdaptationSpecForModule(module, curriculum) {
  assertRunnableWorldModule(module);
  const verifier = firstOrFallback(module.verifiers, module.primary_verifier || 'curriculum verifier');
  const spec = {
    id: worldIdFor(module.id),
    version: WORLD_ADAPTATION_SCHEMA_VERSION,
    source_curriculum_id: curriculum.id,
    source_curriculum_version: curriculum.version || null,
    module_id: module.id,
    module_title: module.title,
    locked_at_compile_time: true,
    learner_state_evidence: {
      knowledge_components: module.knowledge_components.map((kc) => ({
        kc_id: kc.id,
        statement: kc.statement,
        observable_evidence: evidenceForKnowledgeComponent(kc, module),
      })),
      misconception_signatures: compactList(module.misconception_signatures, 8).map((signature, index) => ({
        id: `${module.id}-MIS${String(index + 1).padStart(2, '0')}`,
        statement: sentenceFragment(signature),
        likely_hypotheses: misconceptionHypotheses(signature),
        observable_evidence: evidenceForMisconception(signature, module),
      })),
      verifier_signals: compactList([module.primary_verifier, ...compactList(module.verifiers, 3)], 4).map((signal) =>
        sentenceFragment(signal),
      ),
    },
    action_policy: actionPolicyForModule(module),
    expected_transitions: expectedTransitionsForModule(module),
    forbidden_moves: cloneJson(DEFAULT_WORLD_FORBIDDEN_MOVES),
    outcome_observability: {
      artifact: module.main_artifact || null,
      primary_verifier: module.primary_verifier || null,
      verifier_evidence: compactList([verifier, module.mastery_gate, module.transfer_challenge], 4).map((entry) =>
        sentenceFragment(entry),
      ),
      independent_outcome_required: true,
      spec_is_not_evaluator: true,
    },
  };
  spec.spec_hash = computeWorldAdaptationSpecHash(spec);
  return spec;
}

function assertActionList(spec, key, source) {
  const values = spec.action_policy?.[key] || [];
  if (!Array.isArray(values)) throw new Error(`world adaptation ${source}: action_policy.${key} must be an array`);
  for (const actionType of values) {
    if (!ADAPTIVE_ACTION_TYPES.has(actionType)) {
      throw new Error(`world adaptation ${source}: unknown action type ${actionType}`);
    }
  }
}

export function validateWorldAdaptationSpec(spec, source = '<inline>') {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error(`world adaptation ${source}: spec must be an object`);
  }
  for (const field of [
    'id',
    'version',
    'source_curriculum_id',
    'module_id',
    'locked_at_compile_time',
    'spec_hash',
    'learner_state_evidence',
    'action_policy',
    'expected_transitions',
    'forbidden_moves',
    'outcome_observability',
  ]) {
    if (spec[field] == null) throw new Error(`world adaptation ${source}: missing ${field}`);
  }
  if (spec.version !== WORLD_ADAPTATION_SCHEMA_VERSION) {
    throw new Error(`world adaptation ${source}: unsupported version ${spec.version}`);
  }
  if (spec.locked_at_compile_time !== true) {
    throw new Error(`world adaptation ${source}: locked_at_compile_time must be true`);
  }
  if (spec.spec_hash !== computeWorldAdaptationSpecHash(spec)) {
    throw new Error(`world adaptation ${source}: spec_hash does not match content`);
  }
  if (!Array.isArray(spec.learner_state_evidence?.knowledge_components)) {
    throw new Error(`world adaptation ${source}: learner_state_evidence.knowledge_components must be an array`);
  }
  if (!Array.isArray(spec.learner_state_evidence?.misconception_signatures)) {
    throw new Error(`world adaptation ${source}: learner_state_evidence.misconception_signatures must be an array`);
  }
  if (!spec.learner_state_evidence.misconception_signatures.length) {
    throw new Error(`world adaptation ${source}: misconception evidence is required`);
  }
  assertActionList(spec, 'allowed_action_families', source);
  assertActionList(spec, 'preferred_action_families', source);
  assertActionList(spec, 'disallowed_action_families', source);
  if (!Array.isArray(spec.expected_transitions) || !spec.expected_transitions.length) {
    throw new Error(`world adaptation ${source}: expected_transitions must be a non-empty array`);
  }
  for (const transition of spec.expected_transitions) {
    if (!ADAPTIVE_ACTION_TYPES.has(transition.action_type)) {
      throw new Error(`world adaptation ${source}: expected transition has unknown action ${transition.action_type}`);
    }
    if (!Array.isArray(transition.success_evidence) || !transition.success_evidence.length) {
      throw new Error(`world adaptation ${source}: transition ${transition.action_type} needs success_evidence`);
    }
  }
  if (!Array.isArray(spec.forbidden_moves) || !spec.forbidden_moves.length) {
    throw new Error(`world adaptation ${source}: forbidden_moves must be a non-empty array`);
  }
  if (!spec.outcome_observability?.primary_verifier && !spec.outcome_observability?.verifier_evidence?.length) {
    throw new Error(`world adaptation ${source}: outcome_observability needs verifier evidence`);
  }
  if (spec.outcome_observability?.spec_is_not_evaluator !== true) {
    throw new Error(`world adaptation ${source}: spec_is_not_evaluator must be true`);
  }
  return true;
}

export function compileCurriculumToWorldAdaptationSpec(curriculum, options = {}) {
  validateCanonicalCurriculum(curriculum);
  const mode = options.mode || 'mvp';
  const modules =
    mode === 'mvp' ? curriculum.modules.filter((module) => MVP_MODULE_IDS.has(module.id)) : curriculum.modules;
  if (modules.length === 0) throw new Error(`no modules selected for mode ${mode}`);
  const worldSpecs = modules.map((module) => worldAdaptationSpecForModule(module, curriculum));
  for (const spec of worldSpecs) validateWorldAdaptationSpec(spec, spec.id);
  return {
    meta: {
      schema_version: WORLD_COLLECTION_SCHEMA_VERSION,
      world_schema_version: WORLD_ADAPTATION_SCHEMA_VERSION,
      source_curriculum_id: curriculum.id,
      source_curriculum_version: curriculum.version || null,
      source_schema_version: curriculum.schema_version,
      mode,
      compiler: 'services/curriculum/curriculumCompiler.js',
      target: 'services/adaptiveTutor adaptivePolicyConfig.world_adaptation_spec',
      boundary:
        'Compiled before dialogue as a locked policy constraint. It is not an evaluator and cannot by itself prove learning success.',
    },
    world_adaptation_specs: worldSpecs,
  };
}

export function compileCurriculumToDramaSpec(curriculum, options = {}) {
  validateCanonicalCurriculum(curriculum);
  const mode = options.mode || 'all';
  const modules =
    mode === 'mvp' ? curriculum.modules.filter((module) => MVP_MODULE_IDS.has(module.id)) : curriculum.modules;
  if (modules.length === 0) throw new Error(`no modules selected for mode ${mode}`);
  return {
    meta: {
      schema_version: 'ms-curriculum-drama-v0.1',
      source_curriculum_id: curriculum.id,
      source_curriculum_version: curriculum.version || null,
      source_schema_version: curriculum.schema_version,
      mode,
      compiler: 'services/curriculum/curriculumCompiler.js',
      target: 'scripts/generate-pedagogical-dramas.js dramas[]',
      boundary:
        'This is a generator control file, not evidence that the curriculum teaches. Unknown curriculum_binding fields are held-out metadata for analysis.',
    },
    dramas: modules.map((module) => dramaForModule(module, curriculum)),
  };
}

export function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(value, { lineWidth: 110 }), 'utf8');
}
