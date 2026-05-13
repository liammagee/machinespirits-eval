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

// Architecture-aware compile. Defaults preserve cell_110 behaviour for
// callers that don't pass options.
const compileWithCheckpointer = (graphOptions = {}) =>
  buildGraph(graphOptions).compile({ checkpointer: new MemorySaver() });

// Counterfactual replay forks at a checkpoint *before* learnerProfileUpdate
// fires, so the perturbed hidden state flows through profile inference and
// downstream policy selection. The recognition_only, recognition_named_patterns,
// and ego_superego architectures don't include that node, so counterfactual
// is a no-op for them by design.
const ARCHITECTURES_WITH_PROFILE_UPDATE = new Set([
  'state_policy',
  'state_policy_with_validator',
  'state_policy_evidence_bound', // A14 Stage 1: falls through to state_policy topology in buildGraph, so the learnerProfileUpdate node is present and the fork point exists.
  'state_policy_evidence_bound_validated', // A14 Stage 3: adds groundingValidator after hypothesisUpdater but keeps the same learnerProfileUpdate fork point.
  'bilateral_tom',
  'bilateral_tom_named_patterns',
]);

const baseInitialState = (scenario) => ({
  dialogue: scenario.openingTurns ?? [],
  learnerProfile: initialLearnerProfile(),
  tutorInternal: initialTutorInternal(),
  constraintViolations: [],
  hiddenLearnerState: scenario.hidden,
  turn: 0,
  maxTurns: scenario.maxTurns ?? 4,
});

// LangGraph's default recursion limit is 25 node visits per invocation. The
// state_policy_with_validator architecture executes ~8 nodes per turn
// (learnerProfileUpdate, tutorEgoInitial, tutorSuperegoReview, tutorValidator,
// constraintCheck, tutorEgoRevision, tutorEmit, learnerTurn), so a 4-turn
// scenario needs ~32 visits. We size the limit generously above the worst
// case for the longest configured trap scenario (max_turns=4).
const RECURSION_LIMIT_PER_INVOKE = 80;

const buildInvokeConfig = (threadId) => ({
  configurable: { thread_id: threadId },
  recursionLimit: RECURSION_LIMIT_PER_INVOKE,
});

export async function runScenario(scenario, graphOptions = {}) {
  const graph = compileWithCheckpointer(graphOptions);
  const config = buildInvokeConfig(scenario.id);
  const final = await graph.invoke(baseInitialState(scenario), config);
  const history = [];
  for await (const snap of graph.getStateHistory(config)) history.push(snap);
  return { final, history, graph, config };
}

// Strategy 5: replay from a checkpoint with a perturbed hidden learner state
// and a forced learner-profile reset so the downstream tutor plan reflects
// the new hidden truth.
export async function runScenarioWithCounterfactual(scenario, perturbation, graphOptions = {}) {
  const original = await runScenario(scenario, graphOptions);

  const architecture = graphOptions.architecture ?? 'state_policy';
  if (!ARCHITECTURES_WITH_PROFILE_UPDATE.has(architecture)) {
    return { original, counterfactual: null, reason: `architecture ${architecture} has no learnerProfileUpdate node; counterfactual not applicable` };
  }

  // Find the earliest checkpoint after the trigger turn fired.
  const fork = original.history.find((s) =>
    s.values?.turn === (perturbation.forkAtTurn ?? scenario.hidden.triggerTurn)
    && s.next?.includes('learnerProfileUpdate'));

  if (!fork) {
    return { original, counterfactual: null, reason: 'no checkpoint matched fork criteria' };
  }

  const cfThreadId = `${scenario.id}__cf`;
  const cfConfig = buildInvokeConfig(cfThreadId);
  const cfGraph = compileWithCheckpointer(graphOptions);

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
