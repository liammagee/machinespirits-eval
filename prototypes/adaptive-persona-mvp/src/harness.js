import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import { initializeMastery, updateMasteryForEvidence } from './knowledgeTracing.js';
import { extractEvidence, selectPolicy, transitionRelationState } from './stateMachine.js';
import { evolvePersona, initialPersona, renderTutorMessage } from './personaEngine.js';
import { evaluateTrace } from './evaluator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export function loadYaml(relativePath) {
  return yaml.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf-8'));
}

export function runScenario(scenario, rubric, options = {}) {
  let mastery = initializeMastery(scenario.kcs || {});
  let persona = initialPersona();
  const turns = [];
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
    const tutorMessage = renderTutorMessage({ evidence, policy, mastery });

    turns.push({
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
      tutorMessage,
    });
  }

  const trace = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    objective: scenario.objective,
    turns,
  };

  if (!options.skipCounterfactual && scenario.counterfactual) {
    const cf = runScenario(scenario, rubric, {
      counterfactual: scenario.counterfactual,
      skipCounterfactual: true,
    });
    trace.counterfactual = cf;
    trace.counterfactualComparison = compareTraces(trace, cf);
  }

  trace.evaluation = evaluateTrace(trace, rubric);
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

export function compareTraces(original, counterfactual) {
  const targetId = original.turns.find((turn, idx) => {
    const cfTurn = counterfactual.turns[idx];
    return cfTurn && turn.learner !== cfTurn.learner;
  })?.eventId;
  const originalTurn = original.turns.find((turn) => turn.eventId === targetId) || original.turns.at(-1);
  const cfTurn = counterfactual.turns.find((turn) => turn.eventId === targetId) || counterfactual.turns.at(-1);

  return {
    eventId: targetId,
    policyDiverged: originalTurn?.policy.selectedPolicy !== cfTurn?.policy.selectedPolicy,
    masteryDiverged: JSON.stringify(compactMastery(originalTurn?.mastery)) !== JSON.stringify(compactMastery(cfTurn?.mastery)),
    personaDiverged: JSON.stringify(originalTurn?.persona) !== JSON.stringify(cfTurn?.persona),
    originalPolicy: originalTurn?.policy.selectedPolicy,
    counterfactualPolicy: cfTurn?.policy.selectedPolicy,
  };
}

function compactMastery(mastery = {}) {
  return Object.fromEntries(Object.entries(mastery).map(([kc, value]) => [kc, Number(value.pMastery.toFixed(3))]));
}

export function runAll({ scenarioId = null } = {}) {
  const scenarioConfig = loadYaml('config/scenarios.yaml');
  const rubric = loadYaml('config/adaptation-rubric.yaml');
  const scenarios = scenarioConfig.scenarios
    .filter((scenario) => !scenarioId || scenario.id === scenarioId);
  return scenarios.map((scenario) => runScenario(scenario, rubric));
}

export function renderMarkdownReport(results) {
  const lines = ['# Adaptive Persona MVP Run', ''];
  for (const result of results) {
    lines.push(`## ${result.scenarioId}`);
    lines.push('');
    lines.push(`Score: ${result.evaluation.weightedScore}`);
    if (result.codexObservation) {
      lines.push('');
      lines.push(`Codex observer: ${result.codexObservation.weighted_score ?? 'n/a'} — ${result.codexObservation.verdict || ''}`);
      if (result.codexObservation.observed_adaptation_chain) {
        lines.push('');
        lines.push(result.codexObservation.observed_adaptation_chain);
      }
    }
    lines.push('');
    lines.push(result.evaluation.summary);
    lines.push('');
    lines.push('| Turn | Expected | Actual | Relation | Mastery Delta | Tutor Move |');
    lines.push('|---|---|---|---|---:|---|');
    for (const turn of result.turns) {
      const msg = turn.tutorMessage.replaceAll('|', '/');
      lines.push(`| ${turn.eventId} | ${turn.expectedPolicy || ''} | ${turn.policy.selectedPolicy} | ${turn.relation.relationState} | ${turn.masteryDelta.toFixed(3)} | ${msg} |`);
    }
    if (result.counterfactualComparison) {
      const cf = result.counterfactualComparison;
      lines.push('');
      lines.push(`Counterfactual: ${cf.originalPolicy} -> ${cf.counterfactualPolicy}; policyDiverged=${cf.policyDiverged}; masteryDiverged=${cf.masteryDiverged}; personaDiverged=${cf.personaDiverged}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
