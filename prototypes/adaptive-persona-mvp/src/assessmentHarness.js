import { initializeMastery, updateMasteryForEvidence } from './knowledgeTracing.js';
import { extractEvidence, selectPolicy, transitionRelationState } from './stateMachine.js';
import { evolvePersona, initialPersona, renderTutorMessage } from './personaEngine.js';
import { callCodexJson } from './codexCli.js';
import { buildTutorPrompt } from './codexPrompts.js';
import { loadYaml } from './harness.js';
import {
  buildBlindJudgePrompt,
  buildLearnerOutcomePrompt,
  buildLearnerProxyPrompt,
  buildStaticTutorPrompt,
  dryRunBlindJudge,
  dryRunLearnerOutcome,
  dryRunLearnerProxyEvent,
  dryRunStaticTutorMessage,
} from './assessmentPrompts.js';
import {
  initialLearnerEvent,
  nextLearnerEvent,
  performOutcomeTask,
} from './dynamicLearner.js';
import {
  buildReflexiveEgoDraftPrompt,
  buildReflexiveEgoRevisionPrompt,
  buildReflexiveSuperegoPrompt,
  buildInitialReflexiveMemory,
  dryRunReflexiveTurn,
  updateReflexiveMemory,
} from './reflexivePrompts.js';
import {
  isReflexiveCondition,
  reflexiveVariantForCondition,
} from './reflexiveVariants.js';
import {
  initialChallengeState,
  updateChallengeState,
} from './challengeState.js';
import { conditionFeatures } from './conditionFeatures.js';
import { jaccardDistance } from './textMetrics.js';

const DEFAULT_CONDITIONS = Object.freeze(['static_codex', 'controller_codex']);

export async function runRealAssessment({
  scenarioId = null,
  scenarioIds = null,
  conditions = DEFAULT_CONDITIONS,
  model = null,
  judgeModel = null,
  learnerModel = null,
  learnerMode = 'rule',
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompts = false,
  reflexiveVariant = null,
} = {}) {
  const scenarioConfig = loadYaml('config/assessment-scenarios.yaml');
  const selectedIds = new Set([
    ...(Array.isArray(scenarioIds) ? scenarioIds : []),
    ...(scenarioId ? [scenarioId] : []),
  ]);
  const scenarios = scenarioConfig.scenarios
    .filter((scenario) => selectedIds.size === 0 || selectedIds.has(scenario.id));

  const results = [];
  for (const scenario of scenarios) {
    const scenarioResult = {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      discipline: scenario.discipline || 'unspecified',
      objective: scenario.objective,
      challengeProfile: scenario.challenge_profile || null,
      conditions: {},
      comparisons: {},
    };
    for (const condition of conditions) {
      const original = await runAssessmentBranch({
        scenario,
        hiddenState: scenario.hidden_original,
        branchName: 'original',
        condition,
        model,
        judgeModel,
        learnerModel,
        learnerMode,
        timeoutMs,
        dryRun,
        keepPrompts,
        reflexiveVariant,
      });
      const counterfactual = await runAssessmentBranch({
        scenario,
        hiddenState: scenario.hidden_counterfactual,
        branchName: 'counterfactual',
        condition,
        model,
        judgeModel,
        learnerModel,
        learnerMode,
        timeoutMs,
        dryRun,
        keepPrompts,
        reflexiveVariant,
      });
      scenarioResult.conditions[condition] = {
        original,
        counterfactual,
        counterfactualComparison: compareAssessmentBranches(original, counterfactual),
      };
    }
    scenarioResult.comparisons.baseline = compareConditions(scenarioResult.conditions);
    results.push(scenarioResult);
  }
  return results;
}

async function runAssessmentBranch({
  scenario,
  hiddenState,
  branchName,
  condition,
  model,
  judgeModel,
  learnerModel,
  learnerMode,
  timeoutMs,
  dryRun,
  keepPrompts,
  reflexiveVariant,
}) {
  const transcript = [];
  const stateTrace = [];
  const learnerTrace = [];
  let mastery = initializeMastery(scenario.kcs || {});
  let persona = initialPersona();
  let challengeState = initialChallengeState(scenario);
  const branchReflexiveVariant = reflexiveVariantForCondition(condition, reflexiveVariant);
  let reflexiveMemory = buildInitialReflexiveMemory(branchReflexiveVariant);
  let learnerEvent = initialLearnerEvent(scenario);
  const features = conditionFeatures(condition);
  transcript.push({ role: 'learner', content: learnerEvent.learner });

  for (let turnIndex = 0; turnIndex < scenario.max_tutor_turns; turnIndex++) {
    let tutorResult;
    if (features.controller) {
      const before = structuredClone(mastery);
      const evidence = extractEvidence(learnerEvent);
      mastery = updateMasteryForEvidence(mastery, evidence);
      challengeState = features.challengeState
        ? updateChallengeState({
            scenario,
            previous: challengeState,
            evidence,
            turnIndex,
          })
        : null;
      const ktState = evidence.kcCandidates[0] ? mastery[evidence.kcCandidates[0]] : null;
      const priorState = evidence.kcCandidates[0] ? before[evidence.kcCandidates[0]] : null;
      const masteryDelta = ktState && priorState ? ktState.pMastery - priorState.pMastery : 0;
      const relation = transitionRelationState({ evidence, mastery, challengeState });
      const policy = selectPolicy({
        evidence,
        mastery,
        ...relation,
        challengeState,
        useOutcomeGate: features.outcomeGate,
      });
      const evolved = evolvePersona(persona, policy, relation.relationState, challengeState);
      persona = evolved.persona;

      const stateTurn = {
        condition,
        eventId: learnerEvent.id,
        learner: learnerEvent.learner,
        evidence,
        relation,
        policy,
        challengeState: challengeState ? structuredClone(challengeState) : null,
        expectedPolicy: learnerEvent.expected_policy || null,
        mastery: structuredClone(mastery),
        masteryDelta: Number(masteryDelta.toFixed(4)),
        persona: structuredClone(persona),
        personaDelta: evolved.personaDelta,
      };

      const prompt = buildTutorPrompt({
        scenario,
        turn: stateTurn,
        dialogueHistory: transcript,
        evidence,
        relation,
        policy,
        mastery,
        persona,
      });
      const fallback = renderTutorMessage({ evidence, policy, mastery });
      let reflexiveTrace = null;
      if (isReflexiveCondition(condition)) {
        const reflexiveResult = await runReflexiveTutorPass({
          scenario,
          turn: stateTurn,
          dialogueHistory: transcript,
          evidence,
          relation,
          policy,
          mastery,
          persona,
          reflexiveMemory,
          fallback,
          model,
          timeoutMs,
          dryRun,
          keepPrompts,
          branchName,
          turnIndex,
          reflexiveVariant: branchReflexiveVariant,
        });
        tutorResult = reflexiveResult.tutorResult;
        reflexiveTrace = reflexiveResult.reflexiveTrace;
        reflexiveMemory = features.memory
          ? updateReflexiveMemory(
              reflexiveMemory,
              reflexiveTrace.superegoCritique,
              reflexiveTrace.egoRevision,
            )
          : buildInitialReflexiveMemory(branchReflexiveVariant);
      } else {
        tutorResult = dryRun
          ? { tutor_message: fallback, policy_alignment: 'DRY RUN controller fallback.', adaptation_observation: 'DRY RUN.' }
          : (await callCodexJson(prompt, {
              model,
              timeoutMs,
              label: `assessment-controller-tutor:${scenario.id}:${branchName}:${turnIndex}`,
            })).parsed;
      }
      const tutorMessage = cleanTutorMessage(tutorResult, fallback);
      stateTrace.push({
        ...stateTurn,
        tutorMessage,
        tutorPrompt: keepPrompts || dryRun ? prompt : undefined,
        codexTutor: tutorResult,
        reflexiveTrace,
        reflexiveVariant: isReflexiveCondition(condition) ? branchReflexiveVariant : undefined,
        reflexiveMemory: isReflexiveCondition(condition) ? structuredClone(reflexiveMemory) : undefined,
      });
      transcript.push({ role: 'tutor', content: tutorMessage });
    } else if (condition === 'static_codex') {
      const prompt = buildStaticTutorPrompt({ scenario, transcript });
      tutorResult = dryRun
        ? dryRunStaticTutorMessage({ scenario, transcript })
        : (await callCodexJson(prompt, {
            model,
            timeoutMs,
            label: `assessment-static-tutor:${scenario.id}:${branchName}:${turnIndex}`,
          })).parsed;
      const tutorMessage = cleanTutorMessage(tutorResult, tutorResult.tutor_message);
      stateTrace.push({
        eventId: learnerEvent.id,
        learner: learnerEvent.learner,
        policy: null,
        expectedPolicy: learnerEvent.expected_policy || null,
        tutorMessage,
        tutorPrompt: keepPrompts || dryRun ? prompt : undefined,
        codexTutor: tutorResult,
      });
      transcript.push({ role: 'tutor', content: tutorMessage });
    } else {
      throw new Error(`Unknown assessment condition: ${condition}`);
    }

    if (turnIndex < scenario.max_tutor_turns - 1) {
      learnerEvent = await getNextLearnerEvent({
        scenario,
        hiddenState,
        transcript,
        learnerTrace,
        lastTutorMessage: transcript.at(-1).content,
        turnIndex,
        learnerMode,
        learnerModel,
        timeoutMs,
        dryRun,
        keepPrompts,
      });
      transcript.push({ role: 'learner', content: learnerEvent.learner });
    }
  }

  const outcomeTask = await getOutcomeTask({
    scenario,
    hiddenState,
    transcript,
    learnerMode,
    learnerModel,
    timeoutMs,
    dryRun,
    keepPrompts,
  });
  const branch = {
    branchName,
    condition,
    hiddenType: hiddenState.type,
    learnerMode,
    transcript,
    stateTrace,
    learnerTrace,
    outcomeTask,
    challengeProfile: scenario.challenge_profile || null,
  };
  const judgePrompt = buildBlindJudgePrompt({ scenario, branch });
  const rawBlindJudge = dryRun
    ? dryRunBlindJudge({ branch })
    : (await callCodexJson(judgePrompt, {
        model: judgeModel || model,
        timeoutMs,
        label: `assessment-blind-judge:${scenario.id}:${condition}:${branchName}`,
      })).parsed;
  branch.blindJudge = normalizeBlindJudge(rawBlindJudge);
  if (keepPrompts || dryRun) branch.blindJudgePrompt = judgePrompt;
  return branch;
}

async function runReflexiveTutorPass({
  scenario,
  turn,
  dialogueHistory,
  evidence,
  relation,
  policy,
  mastery,
  persona,
  reflexiveMemory,
  fallback,
  model,
  timeoutMs,
  dryRun,
  keepPrompts,
  branchName,
  turnIndex,
  reflexiveVariant,
}) {
  const features = conditionFeatures(turn?.condition || '');
  const memoryForTurn = features.memory
    ? reflexiveMemory
    : buildInitialReflexiveMemory(reflexiveVariant);
  const egoDraftPrompt = buildReflexiveEgoDraftPrompt({
    scenario,
    turn,
    dialogueHistory,
    evidence,
    relation,
    policy,
    mastery,
    persona,
    reflexiveMemory: memoryForTurn,
    reflexiveVariant,
  });
  const dry = dryRunReflexiveTurn({
    fallback,
    policy,
    reflexiveMemory: memoryForTurn,
    reflexiveVariant,
  });
  const egoDraft = dryRun
    ? dry.egoDraft
    : (await callCodexJson(egoDraftPrompt, {
        model,
        timeoutMs,
        label: `assessment-reflexive-ego-draft:${scenario.id}:${branchName}:${turnIndex}`,
      })).parsed;

  if (!features.superego) {
    const tutorMessage = typeof egoDraft?.draft_message === 'string' && egoDraft.draft_message.trim()
      ? egoDraft.draft_message.trim()
      : fallback;
    return {
      tutorResult: {
        tutor_message: tutorMessage,
        policy_alignment: 'Superego ablation: Ego draft used without critique or revision.',
        adaptation_observation: 'No Superego revision was applied.',
      },
      reflexiveTrace: {
        egoDraft,
        superegoCritique: {
          critique: 'Superego disabled by ablation condition.',
          adaptation_risk: 'superego_disabled',
          required_revision: '',
          memory_update: {},
        },
        egoRevision: {
          tutor_message: tutorMessage,
          revision_note: 'Superego disabled by ablation condition.',
          reflexive_adaptation: 'No Superego revision was applied.',
        },
        reflexiveVariant,
        prompts: keepPrompts || dryRun ? {
          egoDraftPrompt,
          superegoPrompt: null,
          egoRevisionPrompt: null,
        } : undefined,
      },
    };
  }

  const superegoPrompt = buildReflexiveSuperegoPrompt({
    scenario,
    turn,
    dialogueHistory,
    evidence,
    relation,
    policy,
    mastery,
    persona,
    reflexiveMemory: memoryForTurn,
    egoDraft,
    reflexiveVariant,
  });
  const superegoCritique = dryRun
    ? dry.superegoCritique
    : (await callCodexJson(superegoPrompt, {
        model,
        timeoutMs,
        label: `assessment-reflexive-superego:${scenario.id}:${branchName}:${turnIndex}`,
      })).parsed;

  const egoRevisionPrompt = buildReflexiveEgoRevisionPrompt({
    scenario,
    turn,
    dialogueHistory,
    evidence,
    relation,
    policy,
    mastery,
    persona,
    reflexiveMemory: memoryForTurn,
    egoDraft,
    superegoCritique,
    reflexiveVariant,
  });
  const egoRevision = dryRun
    ? dry.egoRevision
    : (await callCodexJson(egoRevisionPrompt, {
        model,
        timeoutMs,
        label: `assessment-reflexive-ego-revision:${scenario.id}:${branchName}:${turnIndex}`,
      })).parsed;

  return {
    tutorResult: {
      tutor_message: egoRevision.tutor_message,
      policy_alignment: egoRevision.revision_note || '',
      adaptation_observation: egoRevision.reflexive_adaptation || '',
    },
    reflexiveTrace: {
      egoDraft,
      superegoCritique,
      egoRevision,
      reflexiveVariant,
      prompts: keepPrompts || dryRun ? {
        egoDraftPrompt,
        superegoPrompt,
        egoRevisionPrompt,
      } : undefined,
    },
  };
}

async function getNextLearnerEvent({
  scenario,
  hiddenState,
  transcript,
  learnerTrace,
  lastTutorMessage,
  turnIndex,
  learnerMode,
  learnerModel,
  timeoutMs,
  dryRun,
  keepPrompts,
}) {
  if (learnerMode === 'rule') {
    return nextLearnerEvent({ scenario, hiddenState, lastTutorMessage, turnIndex });
  }
  if (learnerMode !== 'codex') {
    throw new Error(`Unknown learner mode: ${learnerMode}`);
  }

  const prompt = buildLearnerProxyPrompt({
    scenario,
    hiddenState,
    transcript,
    turnIndex,
  });
  const parsed = dryRun
    ? dryRunLearnerProxyEvent({ scenario, hiddenState, lastTutorMessage, turnIndex })
    : (await callCodexJson(prompt, {
        model: learnerModel,
        timeoutMs,
        label: `assessment-learner-proxy:${scenario.id}:${hiddenState.type}:${turnIndex}`,
      })).parsed;
  const event = normalizeLearnerProxyEvent(parsed, scenario, turnIndex);
  learnerTrace.push({
    mode: 'codex',
    event,
    stressSignal: parsed.stress_signal || '',
    prompt: keepPrompts || dryRun ? prompt : undefined,
  });
  return event;
}

async function getOutcomeTask({
  scenario,
  hiddenState,
  transcript,
  learnerMode,
  learnerModel,
  timeoutMs,
  dryRun,
  keepPrompts,
}) {
  if (learnerMode === 'rule') {
    return performOutcomeTask({ scenario, hiddenState, transcript });
  }
  const prompt = buildLearnerOutcomePrompt({ scenario, hiddenState, transcript });
  const parsed = dryRun
    ? dryRunLearnerOutcome({ scenario, hiddenState, transcript })
    : (await callCodexJson(prompt, {
        model: learnerModel,
        timeoutMs,
        label: `assessment-learner-outcome:${scenario.id}:${hiddenState.type}`,
      })).parsed;
  const out = {
    prompt: typeof parsed.prompt === 'string' ? parsed.prompt : scenario.outcome_task.prompt,
    learner_answer: typeof parsed.learner_answer === 'string' ? parsed.learner_answer : '',
    success: Boolean(parsed.success),
    self_assessment: typeof parsed.self_assessment === 'string' ? parsed.self_assessment : '',
    hidden_type: hiddenState.type,
  };
  if (keepPrompts || dryRun) out.learnerOutcomePrompt = prompt;
  return out;
}

function normalizeLearnerProxyEvent(parsed, scenario, turnIndex) {
  const kc = Object.keys(scenario.kcs || {})[0];
  return {
    id: typeof parsed.id === 'string' ? parsed.id : `l${turnIndex + 1}`,
    learner: typeof parsed.learner === 'string' && parsed.learner.trim()
      ? parsed.learner.trim()
      : 'I need another step before I can answer that.',
    kc,
    outcome: oneOf(parsed.outcome, ['correct', 'partial', 'incorrect', 'unobserved'], 'partial'),
    affect: oneOf(parsed.affect, ['neutral', 'engaged', 'frustrated', 'discouraged'], 'neutral'),
    stance: oneOf(parsed.stance, ['claim', 'questioning', 'collaborative', 'compliant', 'corrective', 'dependent'], 'questioning'),
    expected_policy: oneOf(parsed.expected_policy, [
      'diagnostic_probe',
      'contrastive_probe',
      'minimal_hint',
      'faded_example',
      'productive_struggle_hold',
      'affective_repair',
      'repair_misrecognition',
      'misconception_repair',
      'teach_back',
      'transfer_challenge',
      'summarize_and_check',
    ], 'diagnostic_probe'),
  };
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cleanTutorMessage(result, fallback) {
  if (typeof result?.tutor_message === 'string' && result.tutor_message.trim()) {
    return result.tutor_message.trim();
  }
  return String(fallback || '').trim();
}

function normalizeBlindJudge(judge) {
  const out = { ...(judge || {}) };
  const score = out.weighted_score;
  if (typeof score === 'number' && score >= 1 && score <= 5) {
    out.raw_weighted_score = score;
    out.weighted_score = Number((((score - 1) / 4) * 100).toFixed(1));
    out.score_normalization = 'converted_from_1_5_to_0_100';
  }
  return out;
}

export function compareAssessmentBranches(original, counterfactual) {
  const originalTutor = original.transcript.filter((m) => m.role === 'tutor').map((m) => m.content);
  const counterTutor = counterfactual.transcript.filter((m) => m.role === 'tutor').map((m) => m.content);
  const textDistances = originalTutor.map((text, idx) => Number(jaccardDistance(text, counterTutor[idx] || '').toFixed(3)));
  const originalPolicies = original.stateTrace.map((t) => t.policy?.selectedPolicy || null);
  const counterPolicies = counterfactual.stateTrace.map((t) => t.policy?.selectedPolicy || null);
  const policyDiverged = JSON.stringify(originalPolicies) !== JSON.stringify(counterPolicies);
  const downstreamTextDiverged = textDistances.slice(1).some((d) => d >= 0.35);
  return {
    sameInitialLearnerTurn: original.transcript[0]?.content === counterfactual.transcript[0]?.content,
    originalHiddenType: original.hiddenType,
    counterfactualHiddenType: counterfactual.hiddenType,
    originalPolicies,
    counterfactualPolicies: counterPolicies,
    policyDiverged,
    tutorTextDistances: textDistances,
    downstreamTextDiverged,
    outcomeSuccessChanged: original.outcomeTask.success !== counterfactual.outcomeTask.success,
    adaptationSignal: policyDiverged || downstreamTextDiverged,
  };
}

export function compareConditions(conditionResults) {
  const staticOriginal = conditionResults.static_codex?.original;
  const controllerOriginal = conditionResults.controller_codex?.original;
  if (!staticOriginal || !controllerOriginal) return null;
  return {
    staticBlindScore: staticOriginal.blindJudge?.weighted_score ?? null,
    controllerBlindScore: controllerOriginal.blindJudge?.weighted_score ?? null,
    staticOutcomeSuccess: staticOriginal.outcomeTask.success,
    controllerOutcomeSuccess: controllerOriginal.outcomeTask.success,
    controllerScoreDelta: numericDelta(controllerOriginal.blindJudge?.weighted_score, staticOriginal.blindJudge?.weighted_score),
  };
}

function numericDelta(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number') return null;
  return Number((a - b).toFixed(1));
}

export function renderAssessmentMarkdown(results) {
  const lines = ['# Real Adaptation Assessment', ''];
  for (const result of results) {
    lines.push(`## ${result.scenarioId}`);
    lines.push('');
    lines.push(result.objective);
    lines.push('');
    for (const [condition, payload] of Object.entries(result.conditions)) {
      lines.push(`### ${condition}`);
      lines.push('');
      for (const branchName of ['original', 'counterfactual']) {
        const branch = payload[branchName];
        lines.push(`#### ${branchName} (${branch.hiddenType}, learner=${branch.learnerMode})`);
        lines.push('');
        lines.push(`Blind score: ${branch.blindJudge?.weighted_score ?? 'n/a'} — ${branch.blindJudge?.verdict || ''}`);
        lines.push('');
        lines.push(`Outcome success: ${branch.outcomeTask.success}`);
        lines.push('');
        lines.push('| Role | Content |');
        lines.push('|---|---|');
        for (const msg of branch.transcript) {
          lines.push(`| ${msg.role} | ${msg.content.replaceAll('|', '/')} |`);
        }
        lines.push('');
      }
      const cf = payload.counterfactualComparison;
      lines.push(`Counterfactual signal: policyDiverged=${cf.policyDiverged}; downstreamTextDiverged=${cf.downstreamTextDiverged}; adaptationSignal=${cf.adaptationSignal}`);
      lines.push('');
    }
    if (result.comparisons.baseline) {
      const b = result.comparisons.baseline;
      lines.push(`Baseline comparison: static=${b.staticBlindScore}, controller=${b.controllerBlindScore}, delta=${b.controllerScoreDelta}`);
      lines.push('');
    }
  }
  return `${lines.join('\n')}\n`;
}
