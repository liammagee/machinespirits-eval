import fs from 'node:fs';

import { closure, factKey } from './dramaticDerivation/chainer.js';
import { auditTutorStubDialogueClosureResponse } from './tutorStubDialogueClosure.js';
import { auditTutorStubDramaticReleaseResponse } from './tutorStubDramaticRelease.js';
import { auditTutorStubEvidenceAssertions, tutorStubPrivateTokenAlreadyPublic } from './tutorStubEvidenceAssertion.js';
import { buildTutorStubFirstDraftContract, tutorStubFirstDraftContractPrompt } from './tutorStubFirstDraftContract.js';
import { compileTutorStubPerformanceObligationContract } from './tutorStubPerformanceObligationContract.js';
import { auditTutorStubGenerousInferenceResponse } from './tutorStubGenerousInference.js';
import { splitTutorStubPublicWords } from './tutorStubPublicText.js';
import { tutorStubPublicProvenanceText } from './tutorStubPublicProvenance.js';
import { auditTutorStubQuestionSupportResponse } from './tutorStubQuestionSupport.js';
import {
  auditTutorStubResponseComposition,
  formatTutorStubResponseComposition,
} from './tutorStubResponseComposition.js';
import { auditTutorStubResponseConfiguration } from './tutorStubResponseConfiguration.js';
import {
  auditTutorStubReleaseDelivery,
  auditTutorStubRepetitionResponse,
  tutorStubAnswerNameIsPublic,
} from './tutorStubResponseGuard.js';
import {
  tutorStubAnswerConclusionAsserted,
  tutorStubSecretConclusionWordPatterns,
} from './tutorStubConclusionAssertion.js';
import {
  tutorStubActorialPerformanceMayBeAdvisory,
  tutorStubGuardDeliveryDecision,
  tutorStubPolicyRecoveryAllowsPerformanceAdvisory,
} from './tutorStubGuardRecovery.js';
import { tutorStubGuardIssueRows } from './tutorStubGuardDisposition.js';
import {
  applyTutorStubPerformanceAdjudication,
  tutorStubPerformanceAdjudicationEligibility,
} from './tutorStubPerformanceAdjudication.js';

export const TUTOR_STUB_FROZEN_REPLAY_SCHEMA = 'machinespirits.tutor-stub.frozen-replay.v1';
export const TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA = 'machinespirits.tutor-stub.first-draft-regression-fixture.v1';

const FIRST_DRAFT_BLOCK =
  /\[Tutor-only first-draft performance contract\][\s\S]*?\[End tutor-only first-draft performance contract\]/u;
const PRIVATE_TOKEN_STOPWORDS = new Set([
  'about',
  'above',
  'after',
  'again',
  'alone',
  'answer',
  'assay',
  'because',
  'built',
  'before',
  'bench',
  'blank',
  'blanks',
  'building',
  'came',
  'cast',
  'coin',
  'coins',
  'comparison',
  'contrast',
  'counts',
  'could',
  'differs',
  'down',
  'every',
  'exactly',
  'evidence',
  'false',
  'finish',
  'finished',
  'hand',
  'lesson',
  'lessons',
  'line',
  'make',
  'measure',
  'measures',
  'mark',
  'might',
  'name',
  'nothing',
  'only',
  'plain',
  'progress',
  'public',
  'record',
  'results',
  'rule',
  'says',
  'scored',
  'shilling',
  'shillings',
  'should',
  'shown',
  'single',
  'still',
  'struck',
  'that',
  'their',
  'there',
  'thing',
  'things',
  'them',
  'these',
  'this',
  'trial',
  'turn',
  'twice',
  'verdict',
  'warrant',
  'what',
  'when',
  'where',
  'which',
  'with',
  'would',
]);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function auditConfigurationSlice(configuration = null) {
  if (!configuration) return null;
  return clone({
    schema: configuration.schema,
    policy: configuration.policy,
    engagement_stance: configuration.engagement_stance,
    action_family: configuration.action_family,
    audience_register: configuration.audience_register,
    lexical_accessibility: configuration.lexical_accessibility,
    scene_immersion: configuration.scene_immersion,
    actorial_part: configuration.actorial_part,
    actorial_part_label: configuration.actorial_part_label,
    actorial_host_part: configuration.actorial_host_part,
    actorial_host_part_label: configuration.actorial_host_part_label,
    actorial_performance: configuration.actorial_performance,
    surface_budgets: configuration.surface_budgets,
  });
}

function compactRecordedAttempt(attempt = null) {
  if (!attempt) return null;
  return {
    kind: attempt.kind,
    attempt: attempt.attempt,
    provider: attempt.provider,
    model: attempt.model,
    deliveryConfiguration: auditConfigurationSlice(attempt.deliveryConfiguration),
    candidate: clone(attempt.candidate),
    audits: clone(attempt.audits),
    auditOk: attempt.auditOk === true,
    generation: clone(attempt.generation),
  };
}

function readEvents(tracePath) {
  return fs
    .readFileSync(tracePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function answerTermForWorld(world) {
  const pattern = world?.questionPattern || [];
  const answerIndex = pattern.findIndex((part) => typeof part === 'string' && part.startsWith('?'));
  return answerIndex < 0 ? null : world?.secret?.fact?.[answerIndex] || null;
}

function candidatePublicPremiseIds(world, tutorTurn, publicPremiseIds = null) {
  if (publicPremiseIds instanceof Set) return new Set(publicPremiseIds);
  if (Array.isArray(publicPremiseIds)) return new Set(publicPremiseIds.filter(Boolean));
  return new Set(
    (world?.releaseSchedule || [])
      .filter((entry) => Number(entry.turn) <= Number(tutorTurn))
      .map((entry) => entry.premise),
  );
}

function publicFactsAtTurn(world, tutorTurn, publicPremiseIds) {
  const available = candidatePublicPremiseIds(world, tutorTurn, publicPremiseIds);
  const released = [...available].map((premiseId) => world?.premiseById?.get?.(premiseId)?.fact).filter(Boolean);
  return [...(world?.background || []), ...released];
}

function entailsFactAtTurn(world, tutorTurn, fact, publicPremiseIds) {
  return [...closure(publicFactsAtTurn(world, tutorTurn, publicPremiseIds), world?.rules || []).facts.values()].some(
    (entailed) => factKey(entailed) === factKey(fact),
  );
}

function publicTextForTurn({ world, tutorTurn, learnerText, priorTurns, publicPremiseIds }) {
  const available = candidatePublicPremiseIds(world, tutorTurn, publicPremiseIds);
  return tutorStubPublicProvenanceText({
    world,
    publicPremiseIds: available,
    priorTurns,
    learnerText,
  });
}

function tokenRegex(token) {
  return new RegExp(`\\b${String(token || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\b`, 'iu');
}

function unreleasedPremiseLeakRows({ text, world, tutorTurn, learnerText, priorTurns, publicPremiseIds }) {
  const available = candidatePublicPremiseIds(world, tutorTurn, publicPremiseIds);
  const publicTokens = new Set(
    splitTutorStubPublicWords(publicTextForTurn({ world, tutorTurn, learnerText, priorTurns, publicPremiseIds })),
  );
  const rows = [];
  for (const premise of world?.premises || []) {
    const release = (world?.releaseSchedule || []).find((entry) => entry.premise === premise.id);
    if (!release || available.has(premise.id)) continue;
    const factTokens = new Set(
      (premise.fact || [])
        .slice(1)
        .flatMap(splitTutorStubPublicWords)
        .filter(
          (token) =>
            token.length >= 4 &&
            !PRIVATE_TOKEN_STOPWORDS.has(token) &&
            !tutorStubPrivateTokenAlreadyPublic(token, publicTokens),
        ),
    );
    const surfaceTokens = new Set(
      splitTutorStubPublicWords(premise.surface).filter(
        (token) =>
          token.length >= 5 &&
          !PRIVATE_TOKEN_STOPWORDS.has(token) &&
          !tutorStubPrivateTokenAlreadyPublic(token, publicTokens),
      ),
    );
    const factMatches = [...factTokens].filter((token) => tokenRegex(token).test(text));
    const surfaceMatches = [...surfaceTokens].filter((token) => tokenRegex(token).test(text));
    if (factMatches.length || surfaceMatches.length >= 2) {
      rows.push({
        premise: premise.id,
        scheduledTurn: release.turn,
        matches: [...new Set([...factMatches, ...surfaceMatches])].sort(),
      });
    }
  }
  return rows;
}

export function auditTutorStubFrozenLeak({
  text = '',
  world = null,
  tutorTurn = null,
  learnerText = '',
  priorTurns = [],
  publicPremiseIds = [],
} = {}) {
  if (!world) return { ok: true, leaks: [] };
  const available = candidatePublicPremiseIds(world, tutorTurn, publicPremiseIds);
  const leaks = [];
  const answerTerm = answerTermForWorld(world);
  const answerTokens = splitTutorStubPublicWords(answerTerm);
  const mentionsAnswer = answerTokens.some((token) => tokenRegex(token).test(text));
  const publicText = publicTextForTurn({
    world,
    tutorTurn,
    learnerText,
    priorTurns,
    publicPremiseIds: available,
  });
  const answerNamePublic = tutorStubAnswerNameIsPublic({ answerTerm, publicText });
  const finalEntailed = entailsFactAtTurn(world, tutorTurn, world.secret.fact, available);

  if (mentionsAnswer && !finalEntailed && !answerNamePublic) {
    leaks.push({
      type: 'concealed_answer_name',
      reason: `mentions ${answerTerm} before the public record entails the answer`,
      matches: answerTokens,
    });
  }

  if (mentionsAnswer) {
    const lower = String(text || '').toLowerCase();
    const intermediateChecks = [
      {
        fact: ['castBlankFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/cast/u, /blank/u],
        label: 'private_blank_conclusion',
      },
      {
        fact: ['cutDieFor', world.questionPattern?.[1] || world.secret.fact?.[1], answerTerm],
        words: [/\bcut\b/u, /\bdie\b/u],
        label: 'private_die_conclusion',
      },
      {
        fact: world.secret.fact,
        words: [
          ...(world.secret?.fact?.[0] === 'struckBy'
            ? [/\bstruck\b/u, /\bstrike\b/u, /\bcoiner\b/u, /\bcoined\b/u, /\bmade\b/u]
            : []),
          ...tutorStubSecretConclusionWordPatterns(world.secret?.fact?.[0]),
        ],
        label: 'private_final_conclusion',
      },
    ];
    const worldRulePredicates = new Set(
      (world.rules || []).flatMap((rule) => [...(rule.if || []), ...(rule.then || [])]).map((fact) => fact?.[0]),
    );
    for (const check of intermediateChecks) {
      if (check.label !== 'private_final_conclusion' && !worldRulePredicates.has(check.fact[0])) {
        continue;
      }
      if (
        tutorStubAnswerConclusionAsserted({ text: lower, answerTerm, wordPatterns: check.words }) &&
        !entailsFactAtTurn(world, tutorTurn, check.fact, available)
      ) {
        leaks.push({
          type: check.label,
          reason: `states a conclusion about ${answerTerm} before that conclusion is derivable from released evidence`,
          fact: `${check.fact[0]}(${check.fact.slice(1).join(', ')})`,
        });
      }
    }
  }

  for (const row of unreleasedPremiseLeakRows({
    text,
    world,
    tutorTurn,
    learnerText,
    priorTurns,
    publicPremiseIds: available,
  })) {
    leaks.push({
      type: 'unreleased_premise_content',
      reason: `uses content from ${row.premise} before its scheduled release at turn ${row.scheduledTurn}`,
      premise: row.premise,
      matches: row.matches,
    });
  }

  const evidenceAssertionAudit = auditTutorStubEvidenceAssertions({ text, permittedText: publicText });
  leaks.push(...evidenceAssertionAudit.issues);
  return {
    ok: leaks.length === 0,
    leaks,
    finalEntailed,
    answerNamePublic,
    publicPremiseIds: [...available],
  };
}

function originalModelCall(events, turn) {
  return events.find(
    (event) => event.type === 'model_call' && Number(event.turn) === Number(turn) && event.role === 'tutor_stub_tutor',
  );
}

export function extractTutorStubFrozenTurn({ tracePath, turn } = {}) {
  const events = readEvents(tracePath);
  const completeEvents = events.filter((event) => event.type === 'turn_complete');
  const complete = completeEvents.find((event) => Number(event.turn) === Number(turn));
  if (!complete?.turnRecord) throw new Error(`trace has no completed turn ${turn}: ${tracePath}`);
  const modelCall = originalModelCall(events, turn);
  if (!modelCall?.request) throw new Error(`trace has no original speaking-tutor call for turn ${turn}: ${tracePath}`);
  const record = complete.turnRecord;
  const accounting = record.tutorGuardAccounting || {};
  const originalAttempt = (accounting.attempts || []).find((attempt) => attempt.kind === 'original_candidate');
  if (!originalAttempt) throw new Error(`turn ${turn} has no original-candidate accounting`);
  const priorTurns = completeEvents
    .filter((event) => Number(event.turn) < Number(turn))
    .map((event) => ({
      turn: Number(event.turn),
      turnId: event.turnRecord?.turnId || null,
      learner: event.turnRecord?.learner || '',
      tutor: event.turnRecord?.tutor || '',
    }));
  const runStart = events.find((event) => event.type === 'run_start') || {};
  const messages = clone(modelCall.request.messages || []);
  const latestRequest = messages.at(-1);
  if (!latestRequest || latestRequest.role !== 'user') {
    throw new Error(`turn ${turn} original call does not end in a user request`);
  }
  const firstDraftContract = buildTutorStubFirstDraftContract({
    learnerText: record.learner,
    responseConfiguration: record.responseConfiguration,
    responseCompositionFrame: record.responseComposition?.frame,
    dramaticReleaseFrame: record.dramaticRelease?.frame,
    questionSupport: record.questionSupport,
    dialogueClosureFrame: record.dialogueClosure?.frame,
  });
  const firstDraftPrompt = tutorStubFirstDraftContractPrompt(firstDraftContract);
  if (!FIRST_DRAFT_BLOCK.test(latestRequest.content)) {
    throw new Error(`turn ${turn} request does not contain a first-draft contract block`);
  }
  latestRequest.content = latestRequest.content.replace(FIRST_DRAFT_BLOCK, firstDraftPrompt);
  const priorTutorTexts = messages
    .slice(0, -1)
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content);
  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    sourceTrace: tracePath,
    runId: runStart.runId || null,
    turn: Number(turn),
    turnId: record.turnId || null,
    worldId:
      runStart.metadata?.scenarioPicker?.selectedScenarioId ||
      modelCall.request.systemPrompt?.match(/\bWorld:\s+([^\s—]+)/u)?.[1] ||
      null,
    learnerProfile: accounting.profile || runStart.metadata?.experiment?.profile || null,
    loopMode: runStart.metadata?.loopExecution?.mode || null,
    learnerText: record.learner || '',
    priorTurns,
    priorTutorTexts,
    selectedResponseConfiguration: clone(record.responseConfiguration),
    firstDraftContract,
    frames: {
      responseComposition: clone(record.responseComposition?.frame || null),
      dramaticRelease: clone(record.dramaticRelease?.frame || null),
      questionSupport: clone(record.questionSupport || null),
      dialogueClosure: clone(record.dialogueClosure?.frame || null),
      generousInference: clone(record.generousInference || null),
    },
    guards: clone(accounting.guards || {}),
    publicPremiseIds: clone(originalAttempt.audits?.leakAudit?.publicPremiseIds || []),
    duePremiseIds: (record.dramaticRelease?.frame?.entries || []).map((entry) => entry.premise).filter(Boolean),
    request: {
      systemPrompt: modelCall.request.systemPrompt,
      messages,
      config: clone(modelCall.request.config || {}),
      provider: modelCall.provider,
      model: modelCall.model,
      effort: modelCall.response?.effort || modelCall.request.config?.cliEffort || null,
    },
    semanticAdjudicatorDefault: clone({
      provider:
        runStart.metadata?.classifier?.resolved?.provider ||
        runStart.metadata?.tutorLearnerDag?.provider ||
        null,
      model:
        runStart.metadata?.classifier?.resolved?.model ||
        runStart.metadata?.tutorLearnerDag?.model ||
        null,
      effort: runStart.metadata?.cliEffort || 'low',
    }),
    recorded: {
      originalCandidate: compactRecordedAttempt(originalAttempt),
      attempts: (accounting.attempts || []).map(compactRecordedAttempt),
      finalDelivery: clone(accounting.finalDelivery || null),
    },
  };
}

/**
 * Recompile only the current speaking contract against an immutable public
 * prefix. This lets development screens exercise the current generation
 * prompt without rerunning the learner, classifier, DAG, or prior dialogue.
 */
export function refreshTutorStubFrozenFirstDraftRequest({ bundle, world } = {}) {
  if (!bundle || !world) throw new Error('frozen request refresh requires bundle and world');
  const refreshed = clone(bundle);
  const messages = refreshed.request?.messages || [];
  const latestRequest = messages.at(-1);
  if (!latestRequest || latestRequest.role !== 'user' || !FIRST_DRAFT_BLOCK.test(latestRequest.content)) {
    throw new Error(`frozen turn ${bundle.turn} request has no replaceable first-draft contract`);
  }
  const publicEvidence = (bundle.publicPremiseIds || [])
    .map((premiseId) => world?.premiseById?.get?.(premiseId))
    .filter(Boolean);
  const dueEvidence = (bundle.duePremiseIds || [])
    .map((premiseId) => world?.premiseById?.get?.(premiseId))
    .filter(Boolean);
  const performanceObligationContract = compileTutorStubPerformanceObligationContract({
    responseConfiguration: bundle.selectedResponseConfiguration,
    publicWorld: {
      visibility: 'public',
      title: world.title,
      setting: world.setting,
      question: world.question || world.publicQuestion,
      summary: world.openingFrame?.situation || world.openingSituation,
      temporal_frame: world.presentation?.temporal_frame,
      narrative_diction: world.presentation?.narrative_diction,
      ledger_term: world.presentation?.ledger_term,
      public_objects: [world.presentation?.ledger_term].filter(Boolean),
    },
    publicTurn: {
      visibility: 'public',
      learner_move: bundle.learnerText,
      pressure_target: bundle.learnerText,
      public_claims: [
        ...(bundle.priorTurns || []).slice(-2).flatMap((turn) => [turn.learner, turn.tutor]),
        bundle.learnerText,
      ],
      public_evidence: publicEvidence,
      due_evidence: dueEvidence,
    },
  });
  const firstDraftContract = buildTutorStubFirstDraftContract({
    learnerText: bundle.learnerText,
    responseConfiguration: bundle.selectedResponseConfiguration,
    responseCompositionFrame: bundle.frames?.responseComposition,
    dramaticReleaseFrame: bundle.frames?.dramaticRelease,
    questionSupport: bundle.frames?.questionSupport,
    dialogueClosureFrame: bundle.frames?.dialogueClosure,
    performanceObligationContract,
  });
  latestRequest.content = latestRequest.content.replace(
    FIRST_DRAFT_BLOCK,
    tutorStubFirstDraftContractPrompt(firstDraftContract),
  );
  refreshed.firstDraftContract = firstDraftContract;
  refreshed.performanceObligationContract = performanceObligationContract;
  refreshed.request.messages = messages;
  return refreshed;
}

export function auditTutorStubFrozenCandidate({
  bundle,
  world,
  text,
  deliveryConfiguration = null,
  candidateKind = 'original_candidate',
  performanceAdjudication = null,
  boundaryPolicy = 'strict',
} = {}) {
  if (!bundle || !world) throw new Error('frozen candidate audit requires bundle and world');
  const guards = bundle.guards || {};
  const learnerText = bundle.learnerText || '';
  let responseCompositionAudit = guards.responseComposition
    ? auditTutorStubResponseComposition({
        text,
        frame: bundle.frames?.responseComposition,
        learnerText,
      })
    : { ok: true, active: false, issues: [], segments: null };
  let auditedText = String(text || '').trim();
  const composedText = formatTutorStubResponseComposition(responseCompositionAudit);
  if (responseCompositionAudit.ok && composedText) {
    auditedText = composedText;
    responseCompositionAudit = auditTutorStubResponseComposition({
      text: auditedText,
      frame: bundle.frames?.responseComposition,
      learnerText,
    });
  }
  const leakAudit = guards.leak
    ? auditTutorStubFrozenLeak({
        text: auditedText,
        world,
        tutorTurn: bundle.turn,
        learnerText,
        priorTurns: bundle.priorTurns,
        publicPremiseIds: bundle.publicPremiseIds,
      })
    : { ok: true, leaks: [] };
  const scaffoldAudit = guards.humanScaffold
    ? auditTutorStubGenerousInferenceResponse({
        text: auditedText,
        resolution: bundle.frames?.generousInference,
      })
    : { ok: true, issues: [], similarity: 0 };
  const questionSupportAudit = guards.questionSupport
    ? auditTutorStubQuestionSupportResponse({ text: auditedText, support: bundle.frames?.questionSupport })
    : { ok: true, issues: [] };
  const dramaticReleaseAudit = guards.dramaticRelease
    ? auditTutorStubDramaticReleaseResponse({ text: auditedText, frame: bundle.frames?.dramaticRelease })
    : { ok: true, active: false, issues: [] };
  const responseConfigurationAudit = guards.actorialRealization
    ? auditTutorStubResponseConfiguration({
        text: auditedText,
        configuration: deliveryConfiguration || bundle.selectedResponseConfiguration,
        world,
        composition: responseCompositionAudit.segments,
      })
    : null;
  const repetitionAudit = guards.repetition
    ? auditTutorStubRepetitionResponse({ text: auditedText, recentTutorTexts: bundle.priorTutorTexts })
    : { ok: true, issues: [], maxSimilarity: 0 };
  const closureAudit = guards.dialogueClosure
    ? auditTutorStubDialogueClosureResponse({ text: auditedText, frame: bundle.frames?.dialogueClosure })
    : { ok: true, closesDialogue: false, invitesCheckIn: false, issues: [] };
  const releaseDeliveryAudit = auditTutorStubReleaseDelivery({
    text: auditedText,
    world,
    premiseIds: bundle.duePremiseIds,
  });
  let audits = {
    leakAudit,
    scaffoldAudit,
    questionSupportAudit,
    dramaticReleaseAudit,
    actorialRealizationAudit: responseConfigurationAudit?.actorial_realization || {
      ok: true,
      active: false,
      issues: [],
    },
    responseConfigurationAudit,
    responseCompositionAudit,
    repetitionAudit,
    closureAudit,
    releaseDeliveryAudit,
  };
  const performanceAdjudicationEligibility = tutorStubPerformanceAdjudicationEligibility({
    audits,
    contract: bundle.performanceObligationContract,
    configuration: deliveryConfiguration || bundle.selectedResponseConfiguration,
  });
  if (performanceAdjudication) {
    const applied = applyTutorStubPerformanceAdjudication({
      audits,
      adjudication: performanceAdjudication,
      eligibility: performanceAdjudicationEligibility,
    });
    audits = applied.audits;
  }
  const actorialRealizationAudit = audits.actorialRealizationAudit;
  const issueRows = tutorStubGuardIssueRows(audits);
  const allowActorialAdvisory =
    candidateKind === 'policy_repair_candidate'
      ? tutorStubPolicyRecoveryAllowsPerformanceAdvisory(actorialRealizationAudit, responseConfigurationAudit)
      : ['original_candidate', 'deterministic_fallback'].includes(candidateKind)
        ? tutorStubActorialPerformanceMayBeAdvisory(actorialRealizationAudit, responseConfigurationAudit)
        : false;
  const deliveryDecision = tutorStubGuardDeliveryDecision(issueRows, {
    allowActorialAdvisory,
    boundaryPolicy,
  });
  const failureClusters = Object.entries(audits).flatMap(([guard, audit]) => {
    if (!audit || audit.ok !== false) return [];
    const issues = audit.leaks || audit.issues || [];
    if (issues.length) return issues.map((issue) => `${guard}:${issue.type || 'failed'}`);
    if (audit.missingPremises?.length) return [`${guard}:missing_due_evidence`];
    return [`${guard}:failed`];
  });
  const safetyFailure = !leakAudit.ok;
  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    ok: deliveryDecision.ok,
    safetyFailure,
    auditedText,
    failureClusters,
    hardFailureClusters: deliveryDecision.hardIssues.map((issue) => `${issue.guard}:${issue.type || 'failed'}`),
    advisoryFailureClusters: deliveryDecision.advisoryIssues.map((issue) => `${issue.guard}:${issue.type || 'failed'}`),
    reportOnlyFailureClusters: deliveryDecision.reportOnlyIssues.map(
      (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
    ),
    shadowAdvisoryFailureClusters: deliveryDecision.shadow.advisoryIssues.map(
      (issue) => `${issue.guard}:${issue.type || 'failed'}${issue.axis ? `:${issue.axis}` : ''}`,
    ),
    deliveryDecision,
    audits,
    performanceAdjudicationEligibility,
    performanceAdjudication: performanceAdjudication || null,
  };
}

export function extractTutorStubRegressionFixture({ tracePath, turns = null } = {}) {
  const events = readEvents(tracePath);
  const availableTurns = events.filter((event) => event.type === 'turn_complete').map((event) => Number(event.turn));
  const selectedTurns = Array.isArray(turns) && turns.length ? turns.map(Number) : availableTurns;
  return {
    schema: TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
    sourceTrace: tracePath,
    cases: selectedTurns.map((turn) => {
      const bundle = extractTutorStubFrozenTurn({ tracePath, turn });
      return {
        id: `${bundle.runId || 'run'}:t${String(turn).padStart(3, '0')}`,
        turn,
        worldId: bundle.worldId,
        learnerProfile: bundle.learnerProfile,
        bundle,
        candidates: (bundle.recorded.attempts || []).map((attempt) => ({
          kind: attempt.kind,
          attempt: attempt.attempt,
          text: attempt.candidate?.text || '',
          deliveryConfiguration: clone(attempt.deliveryConfiguration || bundle.selectedResponseConfiguration),
          recordedAuditOk: attempt.auditOk === true,
          recordedFailureClusters: Object.entries(attempt.audits || {}).flatMap(([guard, audit]) => {
            if (!audit || typeof audit !== 'object' || audit.ok !== false) return [];
            return (audit.leaks || audit.issues || []).map((issue) => `${guard}:${issue.type || 'failed'}`);
          }),
        })),
      };
    }),
  };
}

export function summarizeTutorStubFrozenReplay(results = []) {
  const rows = Array.isArray(results) ? results : [];
  const strictOriginalAccepted = (audit) =>
    audit?.ok === true && audit?.audits?.actorialRealizationAudit?.ok === true;
  const accepted = rows.filter((row) => strictOriginalAccepted(row.audit)).length;
  const deterministicAccepted = rows.filter(
    (row) => strictOriginalAccepted(row.deterministicAudit || row.audit),
  ).length;
  const semanticRows = rows.filter((row) => row.semanticAdjudication?.called === true);
  const semanticErrorRows = rows.filter((row) => row.semanticAdjudication?.error);
  const semanticCorrections = rows.filter(
    (row) =>
      row.deterministicAudit?.audits?.actorialRealizationAudit?.ok === false &&
      row.audit?.audits?.actorialRealizationAudit?.ok === true,
  ).length;
  const failureCounts = {};
  for (const row of rows) {
    for (const cluster of row.audit?.failureClusters || []) {
      failureCounts[cluster] = Number(failureCounts[cluster] || 0) + 1;
    }
  }
  return {
    schema: TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
    draws: rows.length,
    deterministicOriginalCandidatesAccepted: deterministicAccepted,
    deterministicOriginalCandidateAcceptanceRate: rows.length ? deterministicAccepted / rows.length : null,
    semanticRecognitionCorrections: semanticCorrections,
    semanticAdjudicatorCalls: semanticRows.length,
    semanticAdjudicatorNewCalls: semanticRows.filter(
      (row) => row.semanticAdjudication?.newModelCall !== false,
    ).length,
    semanticAdjudicationsReused: semanticRows.filter(
      (row) => row.semanticAdjudication?.reusedRaw === true,
    ).length,
    semanticAdjudicatorErrors: semanticErrorRows.length,
    meanSemanticAdjudicationLatencyMs: semanticRows.length
      ? semanticRows.reduce((sum, row) => sum + Number(row.semanticAdjudication?.latencyMs || 0), 0) /
        semanticRows.length
      : null,
    originalCandidatesAccepted: accepted,
    originalCandidateAcceptanceRate: rows.length ? accepted / rows.length : null,
    safetyFailures: rows.filter((row) => row.audit?.safetyFailure).length,
    meanOriginalLatencyMs: rows.length
      ? rows.reduce((sum, row) => sum + Number(row.latencyMs || 0), 0) / rows.length
      : null,
    meanTotalScreenLatencyMs: rows.length
      ? rows.reduce(
          (sum, row) =>
            sum + Number(row.latencyMs || 0) + Number(row.semanticAdjudication?.latencyMs || 0),
          0,
        ) / rows.length
      : null,
    mechanicalRepairs: 0,
    modelRewrites: 0,
    deterministicFallbacks: 0,
    failureClusters: Object.entries(failureCounts)
      .map(([cluster, count]) => ({ cluster, count }))
      .sort((left, right) => right.count - left.count || left.cluster.localeCompare(right.cluster)),
  };
}
