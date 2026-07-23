import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export function listCurricula() {
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

export function listCurriculumSceneSources({ includeRaw = false } = {}) {
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

export function findCurriculumSceneSource(curriculumRef) {
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
export function loadCurriculumContext(lectureRefOrOptions, maybeCurriculumRef = null) {
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

export function buildChatDirectorPlan({ sourceContext = null, director = null, topic = 'general conversation' } = {}) {
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

export function buildCurriculumPromptBlock(curriculum) {
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

export function buildDirectorPromptBlock(directorPlan) {
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
