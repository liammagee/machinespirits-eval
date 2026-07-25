import { createHash } from 'node:crypto';

export const TUTOR_STUB_CURRICULUM_RUNTIME_SCHEMA = 'machinespirits.tutor-stub.curriculum-runtime.v1';
export const TUTOR_STUB_CURRICULUM_PUBLIC_SCHEMA = 'machinespirits.tutor-stub.curriculum-progress.v1';
export const TUTOR_STUB_CURRICULUM_PHASES = Object.freeze([
  'diagnostic',
  'scaffold',
  'independent_check',
  'transfer',
]);

function compact(value, max = 360) {
  const text = String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function moduleMap(curriculum) {
  return new Map((curriculum?.modules || []).map((module) => [module.id, module]));
}

function prerequisiteMap(curriculum) {
  const prerequisites = new Map((curriculum?.modules || []).map((module) => [module.id, new Set()]));
  for (const association of curriculum?.associations || []) {
    if (association?.relation !== 'prerequisite_of') continue;
    if (prerequisites.has(association.to)) prerequisites.get(association.to).add(association.from);
  }
  for (const module of curriculum?.modules || []) {
    for (const prerequisite of module.prerequisite_ids || []) {
      if (prerequisites.has(module.id)) prerequisites.get(module.id).add(prerequisite);
    }
  }
  return prerequisites;
}

function orderedModules(curriculum) {
  return [...(curriculum?.modules || [])].sort(
    (left, right) =>
      Number(left.sequence ?? Number.MAX_SAFE_INTEGER) - Number(right.sequence ?? Number.MAX_SAFE_INTEGER) ||
      left.id.localeCompare(right.id),
  );
}

function assertRuntime(runtime) {
  if (runtime?.schema !== TUTOR_STUB_CURRICULUM_RUNTIME_SCHEMA) {
    throw new Error(`curriculum runtime must use ${TUTOR_STUB_CURRICULUM_RUNTIME_SCHEMA}`);
  }
  return runtime;
}

function currentRecord(runtime) {
  const record = runtime.modules[runtime.currentModuleId];
  if (!record) throw new Error(`curriculum runtime has no current module ${runtime.currentModuleId}`);
  return record;
}

function currentPhaseRecord(runtime) {
  return currentRecord(runtime).phases[runtime.currentPhase];
}

function evidenceId({ moduleId, phase, turnId, text }) {
  return createHash('sha256')
    .update([moduleId, phase, turnId || '', String(text || '').trim()].join('\u0000'))
    .digest('hex')
    .slice(0, 16);
}

function phaseInstruction(module, phase) {
  if (phase === 'diagnostic') {
    return `Ask the learner to attempt the essential question in their own terms before teaching. Elicit a causal model, uncertainties, and a proposed artifact or test. Do not announce misconception labels.`;
  }
  if (phase === 'scaffold') {
    return `Use one bounded scaffold from the canonical tasks or knowledge components. Ask the learner to revise the artifact; do not supply the finished artifact or verifier answer.`;
  }
  if (phase === 'independent_check') {
    return `Remove the scaffold. Ask for an independent response that can be checked against the private verifier contract. Do not tell the learner the verifier internals. A human or trusted adapter must explicitly record pass or revise.`;
  }
  return `Present the transfer challenge in a changed context. Ask the learner to justify what transfers and what changes. A human or trusted adapter must explicitly record pass or revise.`;
}

export function createTutorStubCurriculumRuntime(bundle, { moduleId = null, now = () => new Date() } = {}) {
  const curriculum = bundle?.curriculum;
  const modules = orderedModules(curriculum);
  if (!curriculum?.id || !modules.length) throw new Error('curriculum runtime requires a canonical curriculum');
  const selected = moduleId || bundle?.module?.id || modules[0].id;
  if (!modules.some((module) => module.id === selected)) throw new Error(`unknown curriculum module ${selected}`);
  const createdAt = now().toISOString();
  return {
    schema: TUTOR_STUB_CURRICULUM_RUNTIME_SCHEMA,
    version: 1,
    curriculumId: curriculum.id,
    sourceRef: bundle.sourceRef || null,
    sourceHash: curriculum.source?.source_hash || null,
    currentModuleId: selected,
    currentPhase: 'diagnostic',
    createdAt,
    updatedAt: createdAt,
    completionAuthority: bundle.sourceRef === 'workplan:live' ? 'external_workplan_verification_only' : 'session_mastery_only',
    modules: Object.fromEntries(
      modules.map((module) => [
        module.id,
        {
          id: module.id,
          status: module.id === selected ? 'in_progress' : 'not_started',
          directEntry: module.id === selected && selected !== modules[0].id,
          masteredAt: null,
          phases: Object.fromEntries(
            TUTOR_STUB_CURRICULUM_PHASES.map((phase) => [
              phase,
              { status: phase === 'diagnostic' && module.id === selected ? 'active' : 'not_started', evidence: [], decision: null },
            ]),
          ),
        },
      ]),
    ),
  };
}

export function recordTutorStubCurriculumEvidence(runtime, { text, turnId = null, at = new Date().toISOString() } = {}) {
  assertRuntime(runtime);
  const normalized = String(text || '').trim();
  if (!normalized) return runtime;
  const record = currentRecord(runtime);
  const phase = currentPhaseRecord(runtime);
  const id = evidenceId({ moduleId: record.id, phase: runtime.currentPhase, turnId, text: normalized });
  if (phase.evidence.some((entry) => entry.id === id)) return runtime;
  phase.evidence.push({ id, turnId, at, source: 'public_learner_turn', text: normalized });
  record.status = 'in_progress';
  runtime.updatedAt = at;
  return runtime;
}

function beginPhase(runtime, phase, at) {
  runtime.currentPhase = phase;
  const phaseRecord = currentRecord(runtime).phases[phase];
  phaseRecord.status = 'active';
  runtime.updatedAt = at;
}

export function advanceTutorStubCurriculumRuntime(
  runtime,
  { decision = null, actor = 'human_operator', note = null, at = new Date().toISOString() } = {},
) {
  assertRuntime(runtime);
  const normalizedDecision = decision ? String(decision).trim().toLowerCase() : null;
  if (normalizedDecision && !['pass', 'revise'].includes(normalizedDecision)) {
    throw new Error('curriculum progression decision must be pass or revise');
  }
  const phaseName = runtime.currentPhase;
  const phase = currentPhaseRecord(runtime);
  if (!phase.evidence.length) {
    return { advanced: false, reason: 'evidence_required', runtime };
  }
  if (['independent_check', 'transfer'].includes(phaseName) && !normalizedDecision) {
    return { advanced: false, reason: 'explicit_decision_required', runtime };
  }
  if (normalizedDecision) phase.decision = { value: normalizedDecision, actor, note: compact(note, 240) || null, at };
  if (normalizedDecision === 'revise') {
    phase.status = 'needs_revision';
    beginPhase(runtime, 'scaffold', at);
    return { advanced: true, outcome: 'revision_requested', phase: runtime.currentPhase, runtime };
  }
  phase.status = 'complete';
  if (phaseName === 'diagnostic') {
    beginPhase(runtime, 'scaffold', at);
    return { advanced: true, outcome: 'phase_advanced', phase: runtime.currentPhase, runtime };
  }
  if (phaseName === 'scaffold') {
    beginPhase(runtime, 'independent_check', at);
    return { advanced: true, outcome: 'phase_advanced', phase: runtime.currentPhase, runtime };
  }
  if (phaseName === 'independent_check') {
    beginPhase(runtime, 'transfer', at);
    return { advanced: true, outcome: 'phase_advanced', phase: runtime.currentPhase, runtime };
  }
  const record = currentRecord(runtime);
  record.status = 'mastered';
  record.masteredAt = at;
  runtime.updatedAt = at;
  return { advanced: true, outcome: 'module_mastered', phase: runtime.currentPhase, moduleId: record.id, runtime };
}

export function selectTutorStubCurriculumRuntimeModule(
  runtime,
  curriculum,
  moduleId,
  { at = new Date().toISOString(), allowDirectEntry = false } = {},
) {
  assertRuntime(runtime);
  const modules = moduleMap(curriculum);
  if (!modules.has(moduleId)) throw new Error(`unknown curriculum module ${moduleId}`);
  const prerequisites = prerequisiteMap(curriculum).get(moduleId) || new Set();
  const missing = [...prerequisites].filter((id) => runtime.modules[id]?.status !== 'mastered');
  if (missing.length && !allowDirectEntry) return { selected: false, reason: 'prerequisites_incomplete', missing, runtime };
  runtime.currentModuleId = moduleId;
  const record = currentRecord(runtime);
  record.directEntry = record.directEntry || missing.length > 0;
  const active = TUTOR_STUB_CURRICULUM_PHASES.find((phase) => record.phases[phase].status === 'active');
  const firstIncomplete = TUTOR_STUB_CURRICULUM_PHASES.find((phase) => record.phases[phase].status !== 'complete');
  runtime.currentPhase = active || firstIncomplete || 'transfer';
  if (record.status !== 'mastered') record.phases[runtime.currentPhase].status = 'active';
  if (record.status === 'not_started') record.status = 'in_progress';
  runtime.updatedAt = at;
  return { selected: true, moduleId, phase: runtime.currentPhase, directEntry: missing.length > 0, runtime };
}

export function tutorStubCurriculumPrivatePrompt(bundle, runtime) {
  assertRuntime(runtime);
  const module = moduleMap(bundle.curriculum).get(runtime.currentModuleId);
  if (!module) throw new Error(`unknown curriculum module ${runtime.currentModuleId}`);
  return [
    `Current course phase: ${runtime.currentPhase}`,
    phaseInstruction(module, runtime.currentPhase),
    `Private verifier contract: ${(module.verifiers || []).map((value) => compact(value)).join(' | ') || 'No verifier supplied.'}`,
    `Private misconception probes: ${(module.misconception_signatures || []).map((value) => compact(value)).join(' | ') || 'None supplied.'}`,
    module.mastery_gate ? `Private mastery gate: ${compact(module.mastery_gate, 900)}` : null,
    module.transfer_challenge ? `Public transfer challenge when the transfer phase begins: ${compact(module.transfer_challenge, 900)}` : null,
    'Never reveal verifier internals, misconception identifiers, answer keys, or a pass decision. Only an explicit operator or trusted evaluation adapter records pass or revise.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function tutorStubCurriculumPublicProjection(bundle, runtime) {
  assertRuntime(runtime);
  const prerequisites = prerequisiteMap(bundle.curriculum);
  const modules = orderedModules(bundle.curriculum).map((module) => {
    const record = runtime.modules[module.id];
    const missing = [...(prerequisites.get(module.id) || [])].filter((id) => runtime.modules[id]?.status !== 'mastered');
    return {
      id: module.id,
      sequence: module.sequence ?? null,
      title: module.title,
      essentialQuestion: module.essential_question || null,
      artifact: module.main_artifact || null,
      status: record.status,
      available: module.id === runtime.currentModuleId || missing.length === 0,
      prerequisiteModuleIds: [...(prerequisites.get(module.id) || [])],
      missingPrerequisiteModuleIds: missing,
      phaseEvidenceCounts: Object.fromEntries(
        TUTOR_STUB_CURRICULUM_PHASES.map((phase) => [phase, record.phases[phase].evidence.length]),
      ),
      explicitDecisions: Object.fromEntries(
        TUTOR_STUB_CURRICULUM_PHASES.map((phase) => [phase, record.phases[phase].decision?.value || null]),
      ),
    };
  });
  const current = modules.find((module) => module.id === runtime.currentModuleId);
  return {
    schema: TUTOR_STUB_CURRICULUM_PUBLIC_SCHEMA,
    version: 1,
    curriculum: {
      id: bundle.curriculum.id,
      title: bundle.curriculum.title,
      sourceRef: bundle.sourceRef || null,
      sourceHash: bundle.curriculum.source?.source_hash || null,
    },
    currentModule: current,
    currentPhase: runtime.currentPhase,
    currentPhaseEvidenceCount: current?.phaseEvidenceCounts?.[runtime.currentPhase] || 0,
    modules,
    completionAuthority: runtime.completionAuthority,
    externalCompletionInferred: false,
    updatedAt: runtime.updatedAt,
  };
}
