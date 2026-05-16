import { initializeMastery, updateMasteryForEvidence } from './knowledgeTracing.js';
import { extractEvidence, selectPolicy, transitionRelationState } from './stateMachine.js';
import { evolvePersona, initialPersona, renderTutorMessage } from './personaEngine.js';
import { evaluateTrace } from './evaluator.js';
import { compareTraces, loadYaml } from './harness.js';
import { callCodexJson } from './codexCli.js';
import {
  buildDryRunObserverResponse,
  buildDryRunTutorResponse,
  buildObserverPrompt,
  buildTutorPrompt,
} from './codexPrompts.js';

export async function runScenarioWithCodex(scenario, rubric, options = {}) {
  let mastery = initializeMastery(scenario.kcs || {});
  let persona = initialPersona();
  const turns = [];
  const dialogueHistory = [];
  const events = applyCounterfactual(scenario.events || [], options.counterfactual);

  for (const event of events) {
    const before = structuredClone(mastery);
    const evidence = extractEvidence(event);
    mastery = updateMasteryForEvidence(mastery, evidence);
    const ktState = evidence.kcCandidates[0] ? mastery[evidence.kcCandidates[0]] : null;
    const priorState = evidence.kcCandidates[0] ? before[evidence.kcCandidates[0]] : null;
    const masteryDelta = ktState && priorState ? ktState.pMastery - priorState.pMastery : 0;
    const relation = transitionRelationState({ evidence, mastery });
    const policy = selectPolicy({ evidence, mastery, ...relation });
    const evolved = evolvePersona(persona, policy, relation.relationState);
    persona = evolved.persona;

    const baseTurn = {
      eventId: event.id,
      learner: event.learner,
      evidence,
      relation,
      policy,
      expectedPolicy: event.expected_policy || null,
      mastery: structuredClone(mastery),
      masteryDelta: Number(masteryDelta.toFixed(4)),
      persona: structuredClone(persona),
      personaDelta: evolved.personaDelta,
    };

    const deterministicTutorMessage = renderTutorMessage({ evidence, policy, mastery });
    const prompt = buildTutorPrompt({
      scenario,
      turn: baseTurn,
      dialogueHistory,
      evidence,
      relation,
      policy,
      mastery,
      persona,
    });

    const codexTutor = options.dryRun
      ? buildDryRunTutorResponse(policy)
      : (await callCodexJson(prompt, {
          model: options.model,
          timeoutMs: options.timeoutMs,
          label: `codex-tutor:${scenario.id}:${event.id}`,
        })).parsed;

    const tutorMessage = typeof codexTutor.tutor_message === 'string' && codexTutor.tutor_message.trim()
      ? codexTutor.tutor_message.trim()
      : deterministicTutorMessage;

    const turn = {
      ...baseTurn,
      tutorMessage,
      deterministicTutorMessage,
      codexTutor,
      codexTutorPrompt: options.keepPrompts || options.dryRun ? prompt : undefined,
    };
    turns.push(turn);
    dialogueHistory.push({ role: 'learner', content: event.learner });
    dialogueHistory.push({ role: 'tutor', content: tutorMessage });
  }

  const trace = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    objective: scenario.objective,
    llm: {
      provider: 'codex-cli',
      model: options.model || 'codex-default',
      dryRun: Boolean(options.dryRun),
    },
    turns,
  };

  if (!options.skipCounterfactual && scenario.counterfactual) {
    const cf = await runScenarioWithCodex(scenario, rubric, {
      ...options,
      counterfactual: scenario.counterfactual,
      skipCounterfactual: true,
      skipObserver: true,
    });
    trace.counterfactual = cf;
    trace.counterfactualComparison = compareTraces(trace, cf);
  }

  trace.evaluation = evaluateTrace(trace, rubric);

  if (!options.skipObserver) {
    const observerPrompt = buildObserverPrompt({ trace, rubric });
    trace.codexObservation = options.dryRun
      ? buildDryRunObserverResponse()
      : (await callCodexJson(observerPrompt, {
          model: options.observerModel || options.model,
          timeoutMs: options.timeoutMs,
          label: `codex-observer:${scenario.id}`,
        })).parsed;
    if (options.keepPrompts || options.dryRun) trace.codexObserverPrompt = observerPrompt;
  }

  return trace;
}

function applyCounterfactual(events, counterfactual) {
  if (!counterfactual) return events;
  return events.map((event) => {
    if (event.id !== counterfactual.event_id) return event;
    return {
      ...event,
      ...(counterfactual.replace || {}),
    };
  });
}

export async function runAllWithCodex({
  scenarioId = null,
  model = null,
  observerModel = null,
  timeoutMs = 360_000,
  dryRun = false,
  keepPrompts = false,
} = {}) {
  const scenarioConfig = loadYaml('config/scenarios.yaml');
  const rubric = loadYaml('config/adaptation-rubric.yaml');
  const scenarios = scenarioConfig.scenarios
    .filter((scenario) => !scenarioId || scenario.id === scenarioId);
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenarioWithCodex(scenario, rubric, {
      model,
      observerModel,
      timeoutMs,
      dryRun,
      keepPrompts,
    }));
  }
  return results;
}
