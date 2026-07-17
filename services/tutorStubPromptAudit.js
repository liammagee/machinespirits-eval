export const TUTOR_STUB_PROMPT_AUDIT_SCHEMA = 'machinespirits.tutor-stub.prompt-audit.v1';
export const TUTOR_STUB_SPEAKER_PRIVILEGE_SCHEMA = 'machinespirits.tutor-stub.speaker-privilege-audit.v1';
export const TUTOR_STUB_PROMPT_ARCHITECTURE_SCHEMA = 'machinespirits.tutor-stub.prompt-architecture.v1';

export const TUTOR_STUB_PROMPT_BUDGETS = Object.freeze({
  tutor_system: Object.freeze({ maxChars: 16_000, maxApproxTokens: 4_000 }),
  tutor_turn: Object.freeze({ maxChars: 42_000, maxApproxTokens: 10_500 }),
  learner_analysis: Object.freeze({ maxChars: 30_000, maxApproxTokens: 7_500 }),
  automated_learner: Object.freeze({ maxChars: 24_000, maxApproxTokens: 6_000 }),
  mixed_learner: Object.freeze({ maxChars: 28_000, maxApproxTokens: 7_000 }),
  clarifier: Object.freeze({ maxChars: 16_000, maxApproxTokens: 4_000 }),
  performance_adjudication: Object.freeze({ maxChars: 12_000, maxApproxTokens: 3_000 }),
  default: Object.freeze({ maxChars: 32_000, maxApproxTokens: 8_000 }),
});

function normalizedInstructionLine(line) {
  const value = String(line || '')
    .trim()
    .replace(/^(?:[-*]|\d+[.)])\s+/u, '')
    .replace(/\s+/gu, ' ')
    .replace(/[.:;]+$/u, '')
    .toLowerCase();
  if (value.length < 48) return null;
  if (/^(?:#|\[|\{|\}|"|turn \d+|tutor:|learner:)/u.test(value)) return null;
  return value;
}

function duplicateInstructionLines(texts) {
  const counts = new Map();
  const original = new Map();
  for (const text of texts) {
    for (const line of String(text || '').split('\n')) {
      const normalized = normalizedInstructionLine(line);
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
      if (!original.has(normalized)) original.set(normalized, line.trim());
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([normalized, count]) => ({ line: original.get(normalized), normalized, count }))
    .sort((left, right) => right.count - left.count || left.normalized.localeCompare(right.normalized));
}

export function recoverTutorStubDuplicateInstructionLines({ texts = [], duplicateInstructionLines = [] } = {}) {
  const targets = new Set(
    (Array.isArray(duplicateInstructionLines) ? duplicateInstructionLines : [])
      .map((row) => String(row?.normalized || '').trim())
      .filter(Boolean),
  );
  const seen = new Set();
  const removedLines = [];
  const recoveredTexts = (Array.isArray(texts) ? texts : [texts]).map((text, textIndex) => {
    const kept = [];
    for (const line of String(text || '').split('\n')) {
      const normalized = normalizedInstructionLine(line);
      if (!normalized || !targets.has(normalized)) {
        kept.push(line);
        continue;
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        kept.push(line);
        continue;
      }
      removedLines.push({ textIndex, line: line.trim(), normalized });
    }
    return kept.join('\n');
  });
  return {
    applied: removedLines.length > 0,
    texts: recoveredTexts,
    removedLines,
  };
}

export function tutorStubPromptSurfaceForRole(role) {
  const value = String(role || '').toLowerCase();
  if (value.includes('performance_adjudication') || value.includes('actorial_adjudication')) {
    return 'performance_adjudication';
  }
  if (value.includes('auto_learner')) return 'automated_learner';
  if (value.includes('mixed_learner')) return 'mixed_learner';
  if (value.includes('learner_analysis') || value.includes('learner_record') || value.includes('classifier')) {
    return 'learner_analysis';
  }
  if (value.includes('clarifier')) return 'clarifier';
  if (value.includes('tutor')) return 'tutor_turn';
  return 'default';
}

export function auditTutorStubPrompt({
  surface = 'default',
  systemPrompt = '',
  userPrompt = '',
  messageHistory = [],
  instructionTexts = null,
  budget = null,
} = {}) {
  const resolvedBudget = budget || TUTOR_STUB_PROMPT_BUDGETS[surface] || TUTOR_STUB_PROMPT_BUDGETS.default;
  const historyText = (Array.isArray(messageHistory) ? messageHistory : [])
    .map((message) => String(message?.content || ''))
    .join('\n\n');
  const totalText = [systemPrompt, historyText, userPrompt].filter(Boolean).join('\n\n');
  const chars = totalText.length;
  const approximateTokens = Math.ceil(chars / 4);
  const duplicates = duplicateInstructionLines(instructionTexts || [systemPrompt, userPrompt]);
  const violations = [];
  if (chars > resolvedBudget.maxChars) {
    violations.push({
      code: 'character_budget_exceeded',
      actual: chars,
      limit: resolvedBudget.maxChars,
    });
  }
  if (approximateTokens > resolvedBudget.maxApproxTokens) {
    violations.push({
      code: 'approximate_token_budget_exceeded',
      actual: approximateTokens,
      limit: resolvedBudget.maxApproxTokens,
    });
  }
  if (duplicates.length) {
    violations.push({
      code: 'duplicate_instruction_lines',
      actual: duplicates.length,
      limit: 0,
    });
  }
  return {
    schema: TUTOR_STUB_PROMPT_AUDIT_SCHEMA,
    surface,
    budget: { ...resolvedBudget },
    chars,
    approximateTokens,
    duplicateInstructionLines: duplicates,
    violations,
    ok: violations.length === 0,
  };
}

function factText(fact) {
  if (!Array.isArray(fact) || !fact.length) return '';
  const [relation, ...terms] = fact;
  return `${relation}(${terms.join(', ')})`;
}

function includesNeedle(text, needle) {
  const value = String(needle || '').trim();
  return value.length >= 4 && String(text || '').includes(value);
}

function escapedLiteral(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const PRIVATE_SPEAKER_MARKERS = Object.freeze([
  'Concealed answer',
  'Hidden premise ledger',
  'Authored proof path',
  'Release schedule',
  'First scheduled entailment turn',
  'Tutor desire-DAG',
]);

function privateSpeakerContentNeedles(world, tutorTurn) {
  if (!world) return [...PRIVATE_SPEAKER_MARKERS];
  const needles = [
    ...PRIVATE_SPEAKER_MARKERS,
    world.secret?.surface,
    factText(world.secret?.fact),
    factText(world.mirror?.fact),
  ];
  for (const premise of world.premises || []) {
    const release = (world.releaseSchedule || []).find((entry) => entry.premise === premise.id);
    if (Number(release?.turn) <= Number(tutorTurn)) continue;
    needles.push(premise.surface, factText(premise.fact));
  }
  return needles.map((needle) => String(needle || '').trim()).filter((needle) => needle.length >= 4);
}

export function sanitizeTutorStubSpeakerAdvisory({ world = null, tutorTurn = 0, text = '' } = {}) {
  let sanitized = String(text || '');
  const privateNeedles = privateSpeakerContentNeedles(world, tutorTurn);
  sanitized = sanitized
    .split('\n')
    .filter((line) => !privateNeedles.some((needle) => includesNeedle(line, needle)))
    .join('\n');
  // A surface can itself contain a newline. Remove any residual exact span so
  // the final privilege audit remains fail-closed even for multiline worlds.
  for (const needle of privateNeedles) {
    sanitized = sanitized.replace(new RegExp(escapedLiteral(needle), 'gu'), '');
  }
  if (!world) return sanitized;
  for (const rule of world.rules || []) {
    if (!rule?.id) continue;
    sanitized = sanitized.replace(new RegExp(escapedLiteral(rule.id), 'gu'), 'the relevant public evidence rule');
  }
  for (const premise of world.premises || []) {
    if (!premise?.id) continue;
    sanitized = sanitized.replace(new RegExp(escapedLiteral(premise.id), 'gu'), 'the relevant public evidence item');
  }
  return sanitized;
}

export function auditTutorStubSpeakerPrivilege({
  world = null,
  tutorTurn = 0,
  systemPrompt = '',
  privateAdvisory = '',
} = {}) {
  const inspected = [systemPrompt, privateAdvisory].filter(Boolean).join('\n\n');
  const issues = [];
  const add = (code, source, needle) => {
    if (!includesNeedle(inspected, needle)) return;
    issues.push({ code, source, needle: String(needle).trim() });
  };
  for (const marker of [...PRIVATE_SPEAKER_MARKERS]) {
    add('planner_marker_in_speaker_prompt', 'planner_contract', marker);
  }
  if (world) {
    add('concealed_answer_surface', 'secret', world.secret?.surface);
    add('concealed_answer_fact', 'secret', factText(world.secret?.fact));
    add('mirror_fact_notation', 'mirror', factText(world.mirror?.fact));
    for (const rule of world.rules || []) add('private_rule_id', rule.id, rule.id);
    for (const premise of world.premises || []) {
      add('private_premise_id', premise.id, premise.id);
      const release = (world.releaseSchedule || []).find((entry) => entry.premise === premise.id);
      if (Number(release?.turn) > Number(tutorTurn)) {
        add('future_evidence_surface', premise.id, premise.surface);
        add('future_fact_notation', premise.id, factText(premise.fact));
      }
    }
  }
  const unique = [...new Map(issues.map((issue) => [`${issue.code}\u0000${issue.needle}`, issue])).values()];
  return {
    schema: TUTOR_STUB_SPEAKER_PRIVILEGE_SCHEMA,
    tutorTurn: Number(tutorTurn) || 0,
    speakerAccess: 'public_scene_public_rules_and_evidence_available_through_current_turn',
    issues: unique,
    ok: unique.length === 0,
  };
}

export function recoverTutorStubSpeakerPrompt({
  world = null,
  tutorTurn = 0,
  baseSystemPrompt = '',
  continuityPrompt = '',
  publicEvidencePrompt = '',
  firstDraftContractPrompt = '',
  responseCompositionPrompt = '',
  dramaticReleasePrompt = '',
  responseConfigurationPrompt = '',
  learnerPrompt = '',
  messageHistory = [],
} = {}) {
  const advisoryParts = [
    continuityPrompt,
    publicEvidencePrompt,
    firstDraftContractPrompt,
    responseCompositionPrompt,
    dramaticReleasePrompt,
    responseConfigurationPrompt,
  ]
    .filter(Boolean)
    .map((text) => sanitizeTutorStubSpeakerAdvisory({ world, tutorTurn, text }));
  const userPrompt = [...advisoryParts, learnerPrompt].filter(Boolean).join('\n\n');
  const instructionTexts = [baseSystemPrompt, ...advisoryParts].filter(Boolean);
  const speakerPrivilegeAudit = auditTutorStubSpeakerPrivilege({
    world,
    tutorTurn,
    systemPrompt: baseSystemPrompt,
    privateAdvisory: advisoryParts.join('\n\n'),
  });
  const promptAudit = auditTutorStubPrompt({
    surface: 'tutor_turn',
    systemPrompt: baseSystemPrompt,
    userPrompt,
    messageHistory,
    instructionTexts,
  });
  return {
    schema: 'machinespirits.tutor-stub.speaker-prompt-recovery.v1',
    method: 'rebuild_from_public_turn_contract',
    applied: speakerPrivilegeAudit.ok && promptAudit.ok,
    systemPrompt: baseSystemPrompt,
    userPrompt,
    instructionTexts,
    speakerPrivilegeAudit,
    promptAudit,
    includedSurfaces: {
      continuity: Boolean(continuityPrompt),
      publicEvidence: Boolean(publicEvidencePrompt),
      firstDraftContract: Boolean(firstDraftContractPrompt),
      responseComposition: Boolean(responseCompositionPrompt),
      dramaticRelease: Boolean(dramaticReleasePrompt),
      responseConfiguration: Boolean(responseConfigurationPrompt),
      learnerMessage: Boolean(learnerPrompt),
    },
  };
}

export function tutorStubPromptArchitecture({ dagEnabled = false } = {}) {
  return {
    schema: TUTOR_STUB_PROMPT_ARCHITECTURE_SCHEMA,
    planner: {
      owner: 'deterministic_harness',
      access: dagEnabled ? 'full_world_contract' : 'public_topic_only',
      modelCall: false,
    },
    speakingTutor: {
      access: dagEnabled
        ? 'public_scene_public_rule_glosses_and_evidence_available_through_current_turn'
        : 'public_topic_and_transcript',
      concealedAnswer: false,
      futureEvidence: false,
      proofPaths: false,
      formalFactNotation: false,
    },
    automatedLearner: {
      access: 'public_scene_and_public_transcript_only',
      profilePrompt: 'behavior_only',
      measurementTargets: 'external_contract_and_analyzer_only',
    },
    audit: {
      budgets: TUTOR_STUB_PROMPT_BUDGETS,
      duplicateInstructions: true,
      speakerPrivilege: Boolean(dagEnabled),
    },
  };
}
