import { createHash } from 'node:crypto';

import { buildTutorStubPromptSizeReportForRequest } from './tutorStubPromptSizeReport.js';

export const TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA =
  'machinespirits.tutor-stub.speaking-prompt.compact-no-source.v1';
export const TUTOR_STUB_COMPACT_SPEAKING_PROMPT_MODE = 'compact-no-source.v1';

const REQUIRED_AXES = Object.freeze([
  'engagement_stance',
  'action_family',
  'audience_register',
  'lexical_accessibility',
  'scene_immersion',
  'actorial_part',
]);
const V2_SURFACE_IDS = Object.freeze([
  'uptake',
  'performance_entry',
  'performance_response',
  'handoff',
]);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function lineValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return oneLine(String(text || '').match(new RegExp(`^${escaped}\\s*(.+)$`, 'imu'))?.[1]);
}

function namedTutor(systemPrompt) {
  return oneLine(
    String(systemPrompt || '').match(/\[Named tutor instance:\s*([^\]\n]+)\]/iu)?.[1],
  );
}

function publicWorld(contract, systemPrompt) {
  const world = contract?.performance?.obligation_contract?.public_context?.world || {};
  const title = oneLine(world.title || lineValue(systemPrompt, 'Topic:') || lineValue(systemPrompt, 'World:'));
  const question = oneLine(world.question || lineValue(systemPrompt, 'Public question:'));
  const diction = oneLine(world.narrative_diction || world.ledger_term);
  const publicObjects = (Array.isArray(world.public_objects) ? world.public_objects : [])
    .map(oneLine)
    .filter(Boolean)
    .slice(0, 4);
  if (!title || !question) {
    throw new Error('compact-no-source.v1 requires a public world title and question');
  }
  return { title, question, diction, publicObjects };
}

function currentPublicEvidence(contract) {
  const committed = Array.isArray(contract?.evidence?.committed_public_surfaces)
    ? contract.evidence.committed_public_surfaces.map(oneLine).filter(Boolean)
    : [];
  const contextRows = contract?.performance?.obligation_contract?.public_context?.turn?.public_evidence;
  const contextual = (Array.isArray(contextRows) ? contextRows : [])
    .map((row) => oneLine(row?.surface || row))
    .filter(Boolean);
  if (committed.length && contextual.length && JSON.stringify(committed) !== JSON.stringify(contextual)) {
    throw new Error('compact-no-source.v1 public evidence surfaces disagree across contracts');
  }
  const surfaces = committed.length ? committed : contextual;
  if (!surfaces.length) {
    throw new Error('compact-no-source.v1 requires at least one current public evidence surface');
  }
  return surfaces;
}

function requireNoSource(contract, jointHostPlan) {
  const dueRows = contract?.performance?.obligation_contract?.public_context?.turn?.due_evidence;
  const dueSurfaces = contract?.progression?.turn_focus_contract?.due_surfaces;
  const sources = contract?.evidence?.sources;
  const sourceActive =
    contract?.evidence?.active === true ||
    jointHostPlan?.slots?.source?.active === true ||
    (Array.isArray(dueRows) && dueRows.length > 0) ||
    (Array.isArray(dueSurfaces) && dueSurfaces.length > 0) ||
    (Array.isArray(sources) && sources.length > 0);
  if (sourceActive) {
    throw new Error('compact-no-source.v1 cannot compile a turn with current due evidence');
  }
}

function jointHostPlan(bundle) {
  const plan = bundle?.jointPerformanceFirstDraft?.host_plan;
  if (!plan || plan.schema !== 'machinespirits.tutor-stub.joint-performance-host-plan.v2') {
    throw new Error('compact-no-source.v1 requires the frozen V2 joint-performance host plan');
  }
  if (JSON.stringify(plan.ordered_surface_ids) !== JSON.stringify(V2_SURFACE_IDS)) {
    throw new Error('compact-no-source.v1 requires the unchanged V2 surface order');
  }
  const slots = plan.slots || {};
  if (
    !oneLine(slots.uptake?.instruction) ||
    !oneLine(slots.performance?.entry_instruction) ||
    !oneLine(slots.performance?.response_instruction) ||
    !oneLine(slots.handoff?.instruction)
  ) {
    throw new Error('compact-no-source.v1 requires complete V2 slot instructions');
  }
  return plan;
}

function selectedAxes(bundle, contract) {
  const configuration =
    bundle?.speakingResponseConfiguration || bundle?.selectedResponseConfiguration || {};
  const axes = {
    engagement_stance:
      configuration.engagement_stance || contract?.performance?.engagement_stance,
    action_family: configuration.action_family || contract?.development?.action_family,
    audience_register: configuration.audience_register || contract?.language?.audience_register,
    lexical_accessibility:
      configuration.lexical_accessibility || contract?.language?.lexical_accessibility,
    scene_immersion: configuration.scene_immersion || contract?.language?.scene_immersion,
    actorial_part: configuration.actorial_part || contract?.performance?.actorial_part,
  };
  for (const axis of REQUIRED_AXES) {
    if (!oneLine(axes[axis])) throw new Error(`compact-no-source.v1 requires selected axis ${axis}`);
    axes[axis] = oneLine(axes[axis]);
  }
  return axes;
}

function selectedPerformance(bundle, contract) {
  const configuration =
    bundle?.speakingResponseConfiguration || bundle?.selectedResponseConfiguration || {};
  const selected = configuration.actorial_performance || {};
  const id = oneLine(selected.id || contract?.performance?.tactic);
  const label = oneLine(selected.label || contract?.performance?.tactic_label || id);
  if (!id || !label) {
    throw new Error('compact-no-source.v1 requires the selected performance tactic');
  }
  return { id, label };
}

function axisDecisions(axes, contract, plan) {
  return [
    {
      axis: 'engagement_stance',
      selected: axes.engagement_stance,
      instruction: oneLine(plan.slots.performance.stance_instruction || contract?.performance?.stance_instruction),
    },
    {
      axis: 'action_family',
      selected: axes.action_family,
      instruction: oneLine(contract?.development?.instruction || plan.slots.handoff.instruction),
    },
    {
      axis: 'audience_register',
      selected: axes.audience_register,
      instruction: oneLine(contract?.language?.audience_instruction),
    },
    {
      axis: 'lexical_accessibility',
      selected: axes.lexical_accessibility,
      instruction: oneLine(contract?.language?.lexical_instruction),
    },
    {
      axis: 'scene_immersion',
      selected: axes.scene_immersion,
      instruction: oneLine(contract?.language?.scene_instruction),
    },
    {
      axis: 'actorial_part',
      selected: axes.actorial_part,
      instruction: oneLine(contract?.performance?.part_instruction || plan.slots.performance.entry_instruction),
    },
  ];
}

function responseDecision(contract) {
  const focus = contract?.progression?.turn_focus_contract || {};
  return oneLine(
    focus.semantic_focus_candidates?.pedagogical_need ||
      focus.semantic_focus_candidates?.summary ||
      contract?.learner_move,
  );
}

function handoffTurnFocus(contract, fallback) {
  const groups = contract?.progression?.turn_focus_contract?.primary_groups;
  return oneLine(
    (Array.isArray(groups) ? groups.find((group) => oneLine(group?.surface))?.surface : '') ||
      contract?.progression?.turn_focus_contract?.primary_surface ||
      fallback,
  );
}

function compactSystemPrompt({ tutor, world }) {
  const sceneCues = [world.diction, ...world.publicObjects].filter(Boolean).join('; ');
  const named = tutor || 'the continuing speaking tutor';
  return [
    `You are ${named} in an established public inquiry.`,
    'Continue the exact public conversation in one voice. Answer the learner’s actual words first, then develop the inquiry.',
    '# Detective-story world',
    `World: ${world.title}`,
    `Public question: ${world.question}`,
    sceneCues ? `Diction and scene cues: ${sceneCues}.` : null,
    '# Speaking-tutor evidence contract',
    'Use only the public history and current public evidence supplied for this turn. Never invent or reveal future evidence, an answer key, a hidden path, or private bookkeeping.',
    'Preserve evidentiary actors, relation, and polarity. No selected part grants knowledge beyond that boundary.',
    `[Named tutor instance: ${named}]`,
    'Stay inside the scene. Do not announce a role, strategy, configuration, or analysis, and do not call either speaker the tutor or the learner.',
    'Prefer concrete public words and do not reopen a point the learner has already settled.',
    '[End named tutor instance]',
  ]
    .filter(Boolean)
    .join('\n');
}

function compactUserPrompt({
  learnerText,
  focus,
  responseDecisionText,
  evidence,
  axes,
  performance,
  decisions,
  contract,
  plan,
  handoffFocus,
}) {
  const maxWords = Number(contract?.language?.host_sentence_word_target || 24);
  const draftingWords = Math.min(maxWords, Math.max(8, maxWords - 3));
  const axisRows = decisions.map(
    (row) => `- ${row.axis}=${row.selected}: ${row.instruction || 'make this selection visible'}`,
  );
  const performanceInstructions = [
    plan.slots.performance.response_instruction,
    plan.slots.performance.compatibility_instruction,
    plan.slots.performance.stance_instruction,
  ]
    .map(oneLine)
    .filter(Boolean)
    .join(' ');
  return [
    `[${TUTOR_STUB_COMPACT_SPEAKING_PROMPT_MODE}]`,
    `LATEST LEARNER (exact): ${learnerText}`,
    `TURN FOCUS (exact): ${focus}`,
    '',
    '[Tutor-only public evidence window]',
    'CURRENT PUBLIC EVIDENCE (exhaustive):',
    ...evidence.map((surface, index) => `${index + 1}. ${surface}`),
    'No new evidence may enter this reply. Infer only from the public history and this list; do not imply that another clue, person, record, or object has appeared.',
    '[End tutor-only public evidence window]',
    '',
    '[Tutor-only compact response decision]',
    responseDecisionText ? `RESPONSE DECISION: ${responseDecisionText}` : null,
    'This is the compiled turn decision. Do not reproduce its label or infer additional state.',
    '[End tutor-only compact response decision]',
    '',
    '[Tutor-only compact scaffold]',
    'SIX SELECTED AXES — realize them in the named owners; never name them in the reply:',
    ...axisRows,
    'RESPONSE BEHAVIOR:',
    '- Respond first, then develop; do not substitute generic praise or another question for a requested answer.',
    '- Keep performance declarative and grounded in named public material. Make the part an action or judgment, not an announcement of acting.',
    '- Make handoff a concrete operation on already-public material, not merely a conclusion about whether a case stands.',
    '- Ask no question unless the HANDOFF instruction explicitly permits one.',
    '[End tutor-only compact scaffold]',
    '',
    '[Tutor-only joint-performance host plan]',
    'Return exactly one JSON object and nothing else:',
    '{"uptake":"...","performance":{"entry":"...","response":"..."},"handoff":"..."}',
    'Keep exactly those keys and that order. Each value is one complete public sentence on one line with terminal punctuation and valid JSON escaping.',
    `Use at most ${draftingWords} words per sentence. Use one voice, common words, and one relation per sentence. Only uptake may use quotation marks when its instruction requires them.`,
    'SLOT OWNERSHIP:',
    `UPTAKE owns the direct response to the learner: ${oneLine(plan.slots.uptake.instruction)}`,
    `PERFORMANCE ENTRY owns the ${axes.actorial_part} part and begins the performed claim: ${oneLine(plan.slots.performance.entry_instruction)}`,
    `PERFORMANCE RESPONSE owns ${performance.id} (${performance.label}) and the ${axes.engagement_stance} stance: ${performanceInstructions}`,
    `HANDOFF alone owns ${axes.action_family}: ${oneLine(plan.slots.handoff.instruction)}`,
    `HANDOFF FOCUS: Keep both the public subject and its condition visible in the operation: “${handoffFocus}”. Naming only a generic record or exhibit loses the learner’s focus.`,
    'Do not move a PERFORMANCE duty into HANDOFF or a HANDOFF operation into PERFORMANCE.',
    '- Return only the JSON object.',
    '[End tutor-only joint-performance host plan]',
  ]
    .filter((row) => row !== null)
    .join('\n');
}

/**
 * Opt-in compiler for a frozen, no-source V2 speaking request. It reads the
 * already-compiled turn decisions and never re-runs or serializes classifier,
 * learner-DAG, or scaffold histories.
 */
export function buildTutorStubCompactNoSourceRequest(bundle = null, { maxEstimatedTokens = 2500 } = {}) {
  if (!bundle?.request || !bundle?.firstDraftContract) {
    throw new Error('compact-no-source.v1 requires a frozen bundle request and first-draft contract');
  }
  const sourceRequest = bundle.request;
  const sourceMessages = Array.isArray(sourceRequest.messages) ? sourceRequest.messages : [];
  const latest = sourceMessages.at(-1);
  if (!latest || latest.role !== 'user') {
    throw new Error('compact-no-source.v1 requires a final private user instruction message');
  }
  const publicHistory = sourceMessages.slice(0, -1);
  if (!publicHistory.length) {
    throw new Error('compact-no-source.v1 requires complete public history before the private turn instruction');
  }

  const contract = bundle.firstDraftContract;
  const plan = jointHostPlan(bundle);
  requireNoSource(contract, plan);
  const evidence = currentPublicEvidence(contract);
  const axes = selectedAxes(bundle, contract);
  const performance = selectedPerformance(bundle, contract);
  const decisions = axisDecisions(axes, contract, plan);
  const world = publicWorld(contract, sourceRequest.systemPrompt);
  const learnerText = oneLine(
    bundle.learnerText || contract?.progression?.learner_uptake?.learner_surface,
  );
  const focus = oneLine(contract?.progression?.turn_focus_contract?.primary_surface || learnerText);
  const handoffFocus = handoffTurnFocus(contract, focus);
  if (!learnerText || !focus) {
    throw new Error('compact-no-source.v1 requires the latest learner text and turn focus');
  }

  const systemPrompt = compactSystemPrompt({
    tutor: namedTutor(sourceRequest.systemPrompt),
    world,
  });
  const userPrompt = compactUserPrompt({
    learnerText,
    focus,
    responseDecisionText: responseDecision(contract),
    evidence,
    axes,
    performance,
    decisions,
    contract,
    plan,
    handoffFocus,
  });
  const request = {
    ...clone(sourceRequest),
    systemPrompt,
    messages: [...clone(publicHistory), { role: 'user', content: userPrompt }],
  };
  const promptSize = buildTutorStubPromptSizeReportForRequest({
    callId: bundle.turnId || null,
    provider: request.provider || null,
    model: request.model || null,
    request,
  });
  if (promptSize.authoredTotal.estimatedTokens > maxEstimatedTokens) {
    throw new Error(
      `compact-no-source.v1 exceeds authored prompt target: ${promptSize.authoredTotal.estimatedTokens}>${maxEstimatedTokens}`,
    );
  }

  return {
    schema: TUTOR_STUB_COMPACT_SPEAKING_PROMPT_SCHEMA,
    mode: TUTOR_STUB_COMPACT_SPEAKING_PROMPT_MODE,
    request,
    compilation: {
      publicHistoryMessageCount: publicHistory.length,
      publicHistoryJsonSha256: sha256(JSON.stringify(publicHistory)),
      publicHistoryPreservedExactly: true,
      latestLearner: learnerText,
      turnFocus: focus,
      currentPublicEvidence: clone(evidence),
      noNewEvidence: true,
      selectedResponseAxes: clone(axes),
      selectedPerformance: clone(performance),
      axisOwnership: clone(plan.axis_ownership),
      v2OutputShapePreserved: true,
      omittedTechnicalHistories: ['learner_classifier', 'learner_dag', 'human_discourse_scaffold'],
      promptSize,
      maxEstimatedTokens,
    },
  };
}

export function replaceTutorStubFrozenRequestWithCompactNoSourcePrompt(
  bundle = null,
  options = {},
) {
  const result = buildTutorStubCompactNoSourceRequest(bundle, options);
  const refreshed = clone(bundle);
  refreshed.request = result.request;
  refreshed.compactSpeakingPrompt = result.compilation;
  refreshed.compactSpeakingPrompt.schema = result.schema;
  refreshed.compactSpeakingPrompt.mode = result.mode;
  return refreshed;
}
