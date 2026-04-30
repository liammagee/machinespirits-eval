// Runner with checkpointing and counterfactual fork.
//
// `runScenario` does a normal run.
// `runScenarioWithCounterfactual` does a normal run, then forks from a
// chosen checkpoint with a perturbed learner profile and replays. This is
// the operationalisation of Strategy 5 (counterfactual replay): does the
// tutor's downstream plan diverge when the hidden learner state changes,
// holding everything else fixed?

import { MemorySaver } from '@langchain/langgraph';
import { buildGraph } from './graph.js';
import { initialLearnerProfile, initialTutorInternal } from './stateSchema.js';

const compileWithCheckpointer = () => buildGraph().compile({ checkpointer: new MemorySaver() });

const baseInitialState = (scenario) => ({
  dialogue: scenario.openingTurns ?? [],
  learnerProfile: initialLearnerProfile(),
  tutorInternal: initialTutorInternal(),
  constraintViolations: [],
  hiddenLearnerState: scenario.hidden,
  turn: 0,
  maxTurns: scenario.maxTurns ?? 4,
});

export async function runScenario(scenario) {
  const graph = compileWithCheckpointer();
  const config = { configurable: { thread_id: scenario.id } };
  const final = await graph.invoke(baseInitialState(scenario), config);
  const history = [];
  for await (const snap of graph.getStateHistory(config)) history.push(snap);
  return { final, history, graph, config };
}

// Strategy 5: replay from a checkpoint with a perturbed hidden learner state
// and a forced learner-profile reset so the downstream tutor plan reflects
// the new hidden truth.
export async function runScenarioWithCounterfactual(scenario, perturbation) {
  const original = await runScenario(scenario);

  // Find the earliest checkpoint after the trigger turn fired.
  const fork = original.history.find((s) =>
    s.values?.turn === (perturbation.forkAtTurn ?? scenario.hidden.triggerTurn)
    && s.next?.includes('learnerProfileUpdate'));

  if (!fork) {
    return { original, counterfactual: null, reason: 'no checkpoint matched fork criteria' };
  }

  const cfThreadId = `${scenario.id}__cf`;
  const cfConfig = { configurable: { thread_id: cfThreadId } };
  const cfGraph = compileWithCheckpointer();

  // Seed the CF thread with the forked snapshot's values, but with the
  // perturbation applied to hiddenLearnerState. The replay then exercises
  // the downstream nodes against a different hidden truth.
  const seed = {
    ...fork.values,
    hiddenLearnerState: { ...fork.values.hiddenLearnerState, ...perturbation.hiddenOverrides },
    constraintViolations: [],
  };
  const cfFinal = await cfGraph.invoke(seed, cfConfig);
  const cfHistory = [];
  for await (const snap of cfGraph.getStateHistory(cfConfig)) cfHistory.push(snap);

  return { original, counterfactual: { final: cfFinal, history: cfHistory }, forkPoint: fork };
}

// Divergence metric. Looks at three layers:
//   1. Policy actions chosen by tutorEgoInitial across the run.
//   2. Learner-profile trajectory (agencySignal + confidence).
//   3. Final tutor message text (cheapest proxy, surface-level).
// Adaptation should manifest at layers 1 and 2 even when 3 doesn't move.
export function divergenceReport(original, counterfactual) {
  if (!counterfactual) return { divergent: false, note: 'no counterfactual run' };

  const policyTrace = (history) => history
    .map((s) => s.values?.tutorInternal?.policyAction)
    .filter((p) => p && p !== '');
  const profileTrace = (history) => history
    .map((s) => s.values?.learnerProfile)
    .filter(Boolean)
    .map((p) => `${p.agencySignal}/${p.confidence.toFixed(2)}`);
  const tutorTexts = (state) => state.dialogue.filter((m) => m.role === 'tutor').map((m) => m.content);

  return {
    policyActions: { original: policyTrace(original.history), counterfactual: policyTrace(counterfactual.history) },
    profileEvolution: { original: profileTrace(original.history), counterfactual: profileTrace(counterfactual.history) },
    tutorTexts: { original: tutorTexts(original.final), counterfactual: tutorTexts(counterfactual.final) },
  };
}

// Compact pass/fail: did anything diverge?
export function summariseDivergence(report) {
  if (!report?.policyActions) return { anyDivergence: false };
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return {
    policyDivergence: !eq(report.policyActions.original, report.policyActions.counterfactual),
    profileDivergence: !eq(report.profileEvolution.original, report.profileEvolution.counterfactual),
    textDivergence: !eq(report.tutorTexts.original, report.tutorTexts.counterfactual),
    anyDivergence: !eq(report.policyActions.original, report.policyActions.counterfactual)
      || !eq(report.profileEvolution.original, report.profileEvolution.counterfactual)
      || !eq(report.tutorTexts.original, report.tutorTexts.counterfactual),
  };
}
