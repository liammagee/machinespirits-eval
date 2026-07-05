import { deriveObjectOwnershipState } from './objectOwnership.js';

export const LEARNER_TRANSFORMATION_SCHEMA = 'dramatic-derivation.learner-transformation.v0';

export const LEARNER_TRANSFORMATION_REQUIRED_FAMILIES = Object.freeze([
  'own_words',
  'use_in_path',
  'discriminate_wrong_route',
  'purpose_link',
]);

const FAMILY_SET = new Set([
  'own_words',
  'use_in_path',
  'discriminate_wrong_route',
  'near_transfer',
  'recover_after_break',
  'purpose_link',
]);

const FORBIDDEN_KEYS = new Set([
  'secret',
  'proofPath',
  'proof_path',
  'rawBoard',
  'raw_board',
  'hiddenBoard',
  'hidden_board',
  'corruptionLedger',
  'corruption_ledger',
  'D',
  'dNow',
  'dIfRestored',
  'deltaD',
  'finalD',
  'trajectoryD',
  'boardD',
  'sourcePremiseIds',
  'sourceProofPathIds',
  'proofTree',
  'closureTrace',
  'premiseId',
  'premiseIds',
  'ruleId',
  'ruleIds',
  'predicate',
  'predicateName',
  'releaseSchedule',
  'release_schedule',
  'releasedFacts',
  'released_facts',
  'ledger',
]);

function auditForbiddenKeys(value, path = []) {
  const leaks = [];
  if (!value || typeof value !== 'object') return leaks;
  if (Array.isArray(value)) {
    value.forEach((item, index) => leaks.push(...auditForbiddenKeys(item, [...path, String(index)])));
    return leaks;
  }
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (FORBIDDEN_KEYS.has(key)) leaks.push({ path: nextPath.join('.'), key });
    leaks.push(...auditForbiddenKeys(child, nextPath));
  }
  return leaks;
}

export function auditLearnerTransformationPublicInput(input = {}) {
  const leaks = auditForbiddenKeys(input);
  return {
    ok: leaks.length === 0,
    leaks,
    forbiddenKeys: [...FORBIDDEN_KEYS].sort(),
  };
}

function cleanText(value, fallback = null, max = 220) {
  if (typeof value !== 'string') return fallback;
  const text = value.replace(/\s+/gu, ' ').trim();
  return text ? text.slice(0, max) : fallback;
}

function cleanList(value, maxItems = 8, maxChars = 90) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, null, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function publicTranscript(transcript = []) {
  return (Array.isArray(transcript) ? transcript : [])
    .filter((line) => ['learner', 'tutor', 'stage', 'director'].includes(line?.role))
    .map((line) => ({
      turn: Number.isFinite(Number(line.turn)) ? Number(line.turn) : null,
      role: line.role === 'director' ? 'stage' : line.role,
      text: cleanText(line.text, '', 500),
      ...(line.meta?.exchange ? { meta: { exchange: line.meta.exchange } } : {}),
    }))
    .filter((line) => line.text);
}

function targetField(target = {}, camel, snake = null, fallback = null) {
  return cleanText(target?.[camel] ?? (snake ? target?.[snake] : undefined), fallback, 260);
}

function targetKeywords(target = {}) {
  return cleanList(target.objectKeywords || target.object_keywords || target.keywords, 18, 60);
}

function requiredFamilies(target = {}) {
  const raw = Array.isArray(target.requiredFamilies)
    ? target.requiredFamilies
    : Array.isArray(target.required_families)
      ? target.required_families
      : LEARNER_TRANSFORMATION_REQUIRED_FAMILIES;
  const selected = raw.map((item) => String(item || '').trim()).filter((item) => FAMILY_SET.has(item));
  return selected.length ? [...new Set(selected)] : [...LEARNER_TRANSFORMATION_REQUIRED_FAMILIES];
}

function lineForMissing(family, target = {}) {
  const label = targetField(target, 'currentObject', 'current_object', 'the current public object');
  switch (family) {
    case 'own_words':
      return `Ask the learner to put ${label} in their own words, preserving why the old view looked responsible.`;
    case 'use_in_path':
      return `Have the learner use ${label} in the next public step, not merely name it.`;
    case 'discriminate_wrong_route':
      return 'Contrast the tempting old route with the revised route; do not shame the old route out of the room.';
    case 'purpose_link':
      return `Ask why ${label} matters for the public question.`;
    case 'near_transfer':
      return `Invite a nearby parallel case so the learner can move the structure beyond this exact line.`;
    case 'recover_after_break':
      return `Return to ${label} after an interruption and see whether the learner still owns it.`;
    default:
      return `Test ${label} again without treating surface assent as ownership.`;
  }
}

function recommendedMode(missing = [], status = 'unknown') {
  if (status === 'transformed') return 'hold_proof_course';
  if (missing.includes('own_words')) return 'teach_back';
  if (missing.includes('discriminate_wrong_route')) return 'contrast_case';
  if (missing.includes('near_transfer')) return 'analogy_bridge';
  if (missing.includes('purpose_link')) return 'purpose_bridge';
  if (missing.includes('use_in_path')) return 'use_in_chain';
  return 'slow_recap';
}

function needsLateOwnershipCheck(missing = [], finalAssertionAvailable = false) {
  return (
    finalAssertionAvailable === true &&
    missing.length > 0 &&
    missing.every((family) => family === 'own_words' || family === 'purpose_link')
  );
}

function needsTransferGate(missing = [], finalAssertionAvailable = false, transferGate = false) {
  return (
    transferGate === true && finalAssertionAvailable === true && missing.length === 1 && missing[0] === 'near_transfer'
  );
}

function nextTutorConduct(missing = [], target = {}, { finalAssertionAvailable = false, transferGate = false } = {}) {
  if (!missing.length) return ['Do not keep testing ownership; carry the proof course forward.'];
  const conduct = [];
  if (needsTransferGate(missing, finalAssertionAvailable, transferGate)) {
    conduct.push(
      'Before inviting closure, ask for one compact parallel case that uses the same public distinction beyond this exact record.',
    );
  }
  if (needsLateOwnershipCheck(missing, finalAssertionAvailable)) {
    const label = targetField(target, 'currentObject', 'current_object', 'the current public object');
    conduct.push(
      `Before inviting closure, ask for one compact learner restatement of why ${label} matters and how it changes the earlier view.`,
    );
  }
  conduct.push(...missing.map((family) => lineForMissing(family, target)));
  return conduct.slice(0, 3);
}

function transformationStatus(ownership, missing = []) {
  if (missing.length === 0 && ownership.ownershipLevel !== 'echo_only' && ownership.ownershipLevel !== 'absent') {
    return 'transformed';
  }
  if (ownership.echoOnly || ownership.ownershipLevel === 'echo_only') return 'echo_without_ownership';
  if (ownership.score <= 0) return 'not_started';
  if (ownership.score <= 2) return 'surface_progress';
  return 'partial_ownership';
}

function rejectedState(inputAudit) {
  const state = {
    schema: LEARNER_TRANSFORMATION_SCHEMA,
    publicOnly: true,
    authority: 'tutor_private_public_ownership_proof',
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    enabled: false,
    target: null,
    status: 'rejected',
    complete: false,
    finalAssertionAvailable: false,
    transferGate: false,
    transferGateActive: false,
    nearTransferRequired: false,
    lateOwnershipCheck: false,
    requiredFamilies: [...LEARNER_TRANSFORMATION_REQUIRED_FAMILIES],
    passedFamilies: [],
    missingFamilies: [...LEARNER_TRANSFORMATION_REQUIRED_FAMILIES],
    ownership: null,
    recommendedMode: 'slow_recap',
    nextTutorConduct: ['input rejected by public-only audit'],
    evidence: ['input rejected by public-only audit'],
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditLearnerTransformationPublicInput(state),
  };
}

export function deriveLearnerTransformationState(input = {}) {
  const {
    target = null,
    transcript = [],
    learnerText = null,
    enabled = true,
    finalAssertionAvailable = false,
    transferGate = false,
  } = input;
  const inputAudit = auditLearnerTransformationPublicInput(input);
  if (!inputAudit.ok) return rejectedState(inputAudit);
  if (!enabled || !target || typeof target !== 'object') return null;

  const publicLines = publicTranscript(transcript);
  const currentObject = targetField(target, 'currentObject', 'current_object', 'the learner-owned revision');
  const keywords = targetKeywords(target);
  const ownership = deriveObjectOwnershipState({
    currentObject,
    objectKeywords: keywords,
    transcript: publicLines,
    ...(learnerText ? { learnerText } : {}),
    recoveryProbe: Boolean(target.recoveryProbe || target.recovery_probe),
    transferObserved: Boolean(target.transferObserved || target.transfer_observed),
  });
  const required = requiredFamilies(target);
  const passed = ownership.probes.filter((probe) => probe.passed).map((probe) => probe.family);
  const missing = required.filter((family) => !passed.includes(family));
  const nearTransferRequired = required.includes('near_transfer');
  const transferGateActive = needsTransferGate(missing, finalAssertionAvailable, transferGate);
  const status = transformationStatus(ownership, missing);
  const complete = status === 'transformed';
  const state = {
    schema: LEARNER_TRANSFORMATION_SCHEMA,
    publicOnly: true,
    authority: 'tutor_private_public_ownership_proof',
    mayOverrideProofControl: false,
    proofControlAuthority: 'none',
    enabled: true,
    target: {
      currentObject,
      transformationGoal: targetField(target, 'transformationGoal', 'transformation_goal', null),
      publicTrigger: targetField(target, 'publicTrigger', 'public_trigger', null),
      exitCondition: targetField(
        target,
        'exitCondition',
        'exit_condition',
        'learner can revise the public claim while preserving face and grounding',
      ),
    },
    status,
    complete,
    finalAssertionAvailable: finalAssertionAvailable === true,
    transferGate: transferGate === true,
    transferGateActive,
    nearTransferRequired,
    lateOwnershipCheck: needsLateOwnershipCheck(missing, finalAssertionAvailable),
    requiredFamilies: required,
    passedFamilies: passed,
    missingFamilies: missing,
    ownership: {
      schema: ownership.schema,
      currentObject: ownership.currentObject,
      ownershipLevel: ownership.ownershipLevel,
      score: ownership.score,
      maxScore: ownership.maxScore,
      echoOnly: ownership.echoOnly,
      gaps: ownership.gaps,
      probes: ownership.probes,
    },
    recommendedMode: recommendedMode(missing, status),
    nextTutorConduct: nextTutorConduct(missing, target, { finalAssertionAvailable, transferGate }),
    evidence: ownership.evidence.slice(0, 5),
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditLearnerTransformationPublicInput(state),
  };
}

export function learnerTransformationLines(state) {
  if (
    !state ||
    state.publicOnly !== true ||
    state.mayOverrideProofControl !== false ||
    state.inputAudit?.ok === false
  ) {
    return [];
  }
  if (!state.enabled) return [];
  const missing = state.missingFamilies?.length ? state.missingFamilies.join(', ') : 'none';
  return [
    '',
    'LEARNER OWNERSHIP PROOF (tutor-private public conduct advisory, no proof-control authority):',
    `- target object: ${state.target?.currentObject || 'the current public revision'}`,
    ...(state.target?.transformationGoal ? [`- transformation goal: ${state.target.transformationGoal}`] : []),
    ...(state.target?.publicTrigger
      ? [`- transformation trigger to cultivate, not quote: ${state.target.publicTrigger}`]
      : []),
    `- status: ${state.status}; ownership level: ${state.ownership?.ownershipLevel || 'unknown'}; complete: ${state.complete ? 'yes' : 'no'}`,
    ...(state.lateOwnershipCheck
      ? ['- late ownership check: proof closure may be available; request learner ownership before inviting closure.']
      : []),
    ...(state.transferGateActive
      ? [
          '- transfer gate: proof closure may be available; ask for one compact nearby parallel before inviting final assertion.',
        ]
      : []),
    `- required public ownership evidence: ${state.requiredFamilies.join(', ')}`,
    `- missing now: ${missing}`,
    ...(state.nearTransferRequired && state.missingFamilies?.includes('near_transfer')
      ? [
          '- near transfer is still missing: do not treat final-answer fluency as durable ownership until the learner tries a nearby parallel.',
        ]
      : []),
    ...(state.nextTutorConduct?.length ? [`- next tutor conduct: ${state.nextTutorConduct.join(' ')}`] : []),
    ...(state.evidence?.length ? [`- public evidence: ${state.evidence.slice(0, 2).join('; ')}`] : []),
    'Do not treat echo, quick assent, or final-answer fluency as ownership. Ask for ownership in the same proof movement when possible; do not use this block to release, hold, restore, assert, or change the proof target.',
  ];
}

function uniqueSortedTurns(values = []) {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isFinite(value)))].sort(
    (a, b) => a - b,
  );
}

function rowTurn(row = {}) {
  const value = Number(row.turn);
  return Number.isFinite(value) ? value : null;
}

function rowComplete(row = {}) {
  return row.complete === true || row.status === 'transformed';
}

function firstRowAtOrAfter(rows = [], turn = null) {
  if (!Number.isFinite(turn)) return null;
  return rows.find((row) => rowTurn(row) !== null && rowTurn(row) >= turn) || null;
}

export function summarizeLearnerTransformationDurability(input = {}) {
  const inputAudit = auditLearnerTransformationPublicInput(input);
  if (!inputAudit.ok) {
    return {
      schema: `${LEARNER_TRANSFORMATION_SCHEMA}.durability.v0`,
      publicOnly: true,
      authority: 'evaluation_only',
      mayOverrideProofControl: false,
      status: 'rejected',
      durable: false,
      inputAudit,
      nonLeakAudit: auditLearnerTransformationPublicInput({
        schema: `${LEARNER_TRANSFORMATION_SCHEMA}.durability.v0`,
        publicOnly: true,
        authority: 'evaluation_only',
        mayOverrideProofControl: false,
        status: 'rejected',
      }),
    };
  }

  const rows = (Array.isArray(input.rows) ? input.rows : [])
    .filter(Boolean)
    .map((row) => ({ ...row, turn: rowTurn(row) }))
    .filter((row) => row.turn !== null)
    .sort((a, b) => a.turn - b.turn);
  const releaseTurns = uniqueSortedTurns(input.releaseTurns || []);
  const finalTurn = Number.isFinite(Number(input.finalTurn))
    ? Number(input.finalTurn)
    : Number.isFinite(Number(input.assertedTurn))
      ? Number(input.assertedTurn)
      : rows.at(-1)?.turn || null;
  const firstComplete = rows.find(rowComplete) || null;
  const finalRow = firstRowAtOrAfter(rows, finalTurn) || rows.at(-1) || null;
  const releaseChallenges = firstComplete
    ? releaseTurns
        .filter((turn) => turn > firstComplete.turn)
        .map((turn) => {
          const row = firstRowAtOrAfter(rows, turn);
          return {
            releaseTurn: turn,
            checkTurn: row?.turn ?? null,
            status: row?.status || null,
            complete: row ? rowComplete(row) : false,
            missingFamilies: row?.missingFamilies || [],
          };
        })
    : [];
  const survivedAllReleaseChallenges =
    releaseChallenges.length > 0 && releaseChallenges.every((challenge) => challenge.complete === true);
  const finalComplete = finalRow ? rowComplete(finalRow) : false;
  const durable = Boolean(firstComplete && survivedAllReleaseChallenges && finalComplete);
  const status = durable
    ? 'durable_transformation'
    : firstComplete && releaseChallenges.length === 0 && finalComplete
      ? 'single_point_transformation'
      : firstComplete
        ? 'non_durable_transformation'
        : 'not_transformed';
  const state = {
    schema: `${LEARNER_TRANSFORMATION_SCHEMA}.durability.v0`,
    publicOnly: true,
    authority: 'evaluation_only',
    mayOverrideProofControl: false,
    status,
    durable,
    firstCompleteTurn: firstComplete?.turn ?? null,
    firstCompleteStatus: firstComplete?.status || null,
    releaseChallengeCount: releaseChallenges.length,
    survivedAllReleaseChallenges,
    finalTurn: finalTurn ?? null,
    finalStatus: finalRow?.status || null,
    finalComplete,
    releaseChallenges,
    inputAudit,
  };
  return {
    ...state,
    nonLeakAudit: auditLearnerTransformationPublicInput(state),
  };
}
