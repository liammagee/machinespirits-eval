#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  estimateLearnerStateBelief,
  legacyReactiveAction,
  selectPedagogicalAction,
} from '../services/adaptiveTutor/actionPolicy.js';
import { createAdaptationContract } from '../services/adaptiveTutor/adaptationContract.js';
import {
  appendPendingIntervention,
  closePendingIntervention,
  createPendingIntervention,
} from '../services/adaptiveTutor/interventionLedger.js';
import {
  detectOutcomeEvidence,
  inferObservedTransition,
  observeInterventionOutcome,
} from '../services/adaptiveTutor/outcomeObserver.js';
import {
  repairActionFromGate,
  validateProofReleaseOwnershipGate,
} from '../services/adaptiveTutor/proofReleaseOwnershipGate.js';
import {
  metricLabel,
  pairedBootstrapIntervals,
  pairedDifferences,
  summarizeConditions,
} from '../services/adaptiveTutor/adaptationMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_SUITE = path.join(ROOT, 'config/adaptation-discrimination-scenarios.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'exports/adaptation-policy-evaluation.json');
const TURNS = Number(process.env.ADAPTATION_EVAL_TURNS || 3);
const GATED_MODES = new Set(['contract_gate', 'closed_loop', 'closed_loop_counterfactual']);
const CLOSED_MODES = new Set(['closed_loop', 'closed_loop_counterfactual']);

const IDEAL_ACTIONS = Object.freeze({
  productive_progress: ['observe_no_intervention', 'ask_strategy_choice', 'request_evidence'],
  missing_prerequisite: ['minimal_hint', 'request_evidence', 'ask_strategy_choice', 'model_worked_example', 'explain_principle'],
  low_confidence: ['elicit_prediction', 'ask_strategy_choice', 'fade_hint'],
  approval_dependency: ['ask_strategy_choice', 'request_evidence', 'elicit_prediction'],
  task_misread: ['reanchor_goal', 'ask_strategy_choice', 'diagnose_with_discriminating_question'],
  notation_overload: ['minimal_hint', 'request_evidence', 'reanchor_goal'],
  answer_seeking: ['ask_strategy_choice', 'elicit_prediction'],
  correct_alternative_model: ['request_evidence', 'contrast_models', 'challenge_without_telling'],
});

function usage() {
  return `Usage:
  node scripts/evaluate-adaptation-policy.js \\
    [--suite config/adaptation-discrimination-scenarios.json] \\
    [--compare legacy,contract,contract_gate,closed_loop] \\
    [--output exports/adaptation-policy-evaluation.json]
`;
}

function parseArgs(argv) {
  const opts = {
    suite: DEFAULT_SUITE,
    compare: ['legacy', 'contract', 'contract_gate', 'closed_loop'],
    output: DEFAULT_OUTPUT,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    if (arg === '--suite') {
      opts.suite = resolvePath(argv[++i], 'suite');
      continue;
    }
    if (arg === '--compare') {
      opts.compare = String(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === '--output') {
      opts.output = resolvePath(argv[++i], 'output');
      continue;
    }
    throw new Error(`Unknown argument ${arg}\n${usage()}`);
  }
  return opts;
}

function resolvePath(value, label) {
  if (!value) throw new Error(`Missing value for --${label}\n${usage()}`);
  return path.isAbsolute(value) ? value : path.resolve(ROOT, value);
}

function loadSuite(file) {
  const suite = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(suite.scenarios) || suite.scenarios.length === 0) {
    throw new Error(`Adaptation suite has no scenarios: ${file}`);
  }
  return suite;
}

function topHypothesisId(belief) {
  return [...(belief?.hypotheses || [])].sort((a, b) => Number(b.probability) - Number(a.probability))[0]?.id || null;
}

function isIdealAction(hiddenState, actionType, turnIndex) {
  if (actionType === 'diagnose_with_discriminating_question') return turnIndex === 0;
  return (IDEAL_ACTIONS[hiddenState] || []).includes(actionType);
}

function learnerResponse({ hiddenState, actionType, turnIndex }) {
  if (actionType === 'diagnose_with_discriminating_question') {
    return {
      missing_prerequisite:
        "The prerequisite is the basic idea I'm missing: I don't understand what relation has to stay invariant.",
      low_confidence:
        "I think it works because it preserves the same relation, but I'm not sure enough to trust my own reason.",
      approval_dependency:
        'I know I would choose the common-denominator strategy, but I was waiting for approval before committing.',
      task_misread: 'I misread the task; I thought the question asks for a computation, not a comparison.',
      notation_overload: 'The notation and symbols are the problem; with a concrete example I can follow the idea.',
      answer_seeking: 'I mostly want you to just tell me the answer instead of making the next choice myself.',
      correct_alternative_model:
        'I have another way: my model compares the same relation through a different representation.',
      productive_progress:
        'Next I would test the boundary case because the claim depends on whether the relation still holds there.',
    }[hiddenState];
  }

  const ideal = isIdealAction(hiddenState, actionType, turnIndex);
  if (!ideal) {
    if (actionType === 'explain_principle' || actionType === 'model_worked_example') {
      return 'Ok, using your explanation, I can copy that step.';
    }
    return 'Ok.';
  }

  return {
    missing_prerequisite:
      'Because the hint preserves the invariant, next I would use that relation to make the step myself.',
    low_confidence:
      'I predict the relation will stay unchanged, and I choose to test my strategy before asking you to confirm.',
    approval_dependency:
      'I choose the common-denominator strategy myself because it gives evidence I can compare without waiting for approval.',
    task_misread: 'The task asks me to compare the two quantities, so next I will reorient to that goal.',
    notation_overload:
      'With the notation reduced, next I would choose a concrete representation because it preserves the same relation.',
    answer_seeking:
      'I choose to try the next step myself: my strategy is to make a small prediction before seeing the answer.',
    correct_alternative_model:
      'Because my alternative model preserves the same relation, I can justify that representation in my own words.',
    productive_progress:
      'I will keep going: next I would test the boundary case because that preserves the learner-owned route.',
  }[hiddenState];
}

function strictJointSuccess(learnerTurn) {
  const evidence = detectOutcomeEvidence(learnerTurn).categories;
  const learnerAuthored = evidence['learner-authored choice'] || evidence['learner-authored rationale'];
  const forbidden =
    evidence['mere agreement'] ||
    evidence['verbatim adoption of tutor rationale'] ||
    evidence['tutor-completed step'] ||
    evidence['premature tutor validation'];
  return learnerAuthored && !forbidden;
}

function updateAxes(axes, transition) {
  const next = { ...axes };
  for (const axis of ['proof', 'release', 'ownership', 'conceptual_mastery', 'metacognitive_accuracy']) {
    next[axis] = clamp01(Number(next[axis] || 0) + Number(transition?.[axis] || 0));
  }
  return next;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function uniformBeliefFromSurface(scenario) {
  const labels = Object.keys(IDEAL_ACTIONS);
  const p = Number((1 / labels.length).toFixed(6));
  return {
    version: '1.0',
    turn_index: 0,
    learner_project: {
      goal: 'make a task-relevant next move with learner-authored reasoning',
      current_plan: scenario.surface,
      commitment: 'uncommitted',
      next_authorship_opportunity: 'choose or justify the next task-relevant move',
    },
    hypotheses: labels.map((id) => ({ id, probability: p, evidence: [scenario.surface], disconfirming_evidence: [] })),
    axes: {
      proof: 0.25,
      release: 0.25,
      ownership: 0.25,
      conceptual_mastery: 0.25,
      metacognitive_accuracy: 0.25,
      affective_readiness: 0.65,
    },
    uncertainty: { entropy: 1, needs_discrimination: true, reason: 'Legacy baseline does not model hidden state.' },
  };
}

function makeContract({ scenario, turnIndex, mode, stateBelief, selectedAction, candidateActions, gateResult }) {
  return createAdaptationContract({
    contractId: `synthetic-${scenario.id}-${mode}-turn-${turnIndex}`,
    dialogueId: scenario.id,
    turnIndex,
    stateBelief,
    selectedAction,
    candidateActions,
    gateResult,
    policyMode: mode,
  });
}

function selectActionForMode({ mode, stateBelief, ledger, turnIndex }) {
  if (mode === 'legacy') {
    return { selectedAction: legacyReactiveAction({ turnIndex }), candidateActions: [] };
  }
  return selectPedagogicalAction({ stateBelief, interventionLedger: ledger, mode });
}

function gateAction({ mode, stateBelief, selectedAction, candidateActions, ledger }) {
  let gateResult = { allowed: true, violations: [], repairs: [] };
  let action = selectedAction;
  let repairedFrom = null;
  if (GATED_MODES.has(mode)) {
    gateResult = validateProofReleaseOwnershipGate({
      stateBelief,
      selectedAction: action,
      candidateActions,
      interventionLedger: ledger,
    });
    if (!gateResult.allowed) {
      const repaired = repairActionFromGate(action, gateResult);
      if (repaired?.action_type && repaired.action_type !== action.action_type) {
        repairedFrom = action.action_type;
        action = repaired;
        gateResult = validateProofReleaseOwnershipGate({
          stateBelief,
          selectedAction: action,
          candidateActions,
          interventionLedger: ledger,
        });
      }
    }
  }
  return { selectedAction: repairedFrom ? { ...action, repaired_from: repairedFrom } : action, gateResult };
}

function runScenarioMode(scenario, mode) {
  let dialogue = [{ role: 'learner', content: scenario.surface }];
  let ledger = [];
  let pendingIntervention = null;
  let finalBelief = mode === 'legacy' ? uniformBeliefFromSurface(scenario) : null;
  let calibrationBelief = null;
  let finalAxes = { ...uniformBeliefFromSurface(scenario).axes };
  const actions = [];
  const turnRows = [];
  const contracts = [];

  for (let turnIndex = 0; turnIndex < TURNS; turnIndex += 1) {
    if (CLOSED_MODES.has(mode) && pendingIntervention) {
      const closed = closePendingIntervention({
        ledger,
        learnerTurn: dialogue[dialogue.length - 1]?.content || '',
        turnIndex,
      });
      ledger = closed.ledger;
      pendingIntervention = closed.pendingIntervention;
    }

    const stateBelief =
      mode === 'legacy'
        ? uniformBeliefFromSurface(scenario)
        : estimateLearnerStateBelief({
            dialogue,
            interventionLedger: ledger,
            turnIndex,
            maxHypotheses: 3,
          });
    const selection = selectActionForMode({ mode, stateBelief, ledger, turnIndex });
    const gated = gateAction({
      mode,
      stateBelief,
      selectedAction: selection.selectedAction,
      candidateActions: selection.candidateActions,
      ledger,
    });
    const contract = makeContract({
      scenario,
      turnIndex,
      mode,
      stateBelief,
      selectedAction: gated.selectedAction,
      candidateActions: selection.candidateActions,
      gateResult: gated.gateResult,
    });
    contracts.push(contract);

    if (CLOSED_MODES.has(mode)) {
      const appended = appendPendingIntervention(ledger, contract);
      ledger = appended.ledger;
      pendingIntervention = appended.pendingIntervention;
    }

    const actionType = contract.selected_action.action_type;
    const learnerTurn = learnerResponse({ hiddenState: scenario.hiddenState, actionType, turnIndex });
    const instantPending = createPendingIntervention(contract);
    const observation = observeInterventionOutcome({
      pendingIntervention: instantPending,
      learnerTurn,
      turnIndex,
    });
    const transition = inferObservedTransition(learnerTurn);
    finalAxes = updateAxes(finalAxes, transition);
    actions.push({
      action_type: actionType,
      control_cost: contract.selected_action.control_cost,
      gate_allowed: contract.gate_result.allowed,
    });
    turnRows.push({
      turn_index: turnIndex,
      action_type: actionType,
      learner_turn: learnerTurn,
      observation,
      strict_joint_success: actionType !== 'diagnose_with_discriminating_question' && strictJointSuccess(learnerTurn),
      action_state_fit: isIdealAction(scenario.hiddenState, actionType, turnIndex),
      counterfactual_regret: isIdealAction(scenario.hiddenState, actionType, turnIndex) ? 0 : 0.75,
    });
    dialogue = [
      ...dialogue,
      { role: 'tutor', content: actionType },
      { role: 'learner', content: learnerTurn },
    ];

    if (mode !== 'legacy') {
      finalBelief = estimateLearnerStateBelief({
        dialogue,
        interventionLedger: ledger,
        turnIndex: turnIndex + 1,
        maxHypotheses: 3,
      });
      if (!calibrationBelief && actionType === 'diagnose_with_discriminating_question') {
        calibrationBelief = finalBelief;
      }
    }
  }

  if (CLOSED_MODES.has(mode) && pendingIntervention) {
    const closed = closePendingIntervention({
      ledger,
      learnerTurn: dialogue[dialogue.length - 1]?.content || '',
      turnIndex: TURNS,
    });
    ledger = closed.ledger;
  }

  const observed = dialogue.filter((m) => m.role === 'learner').slice(1).map((m) => m.content);
  const finalEvidence = observed.map((text) => detectOutcomeEvidence(text).categories);
  const proofReleaseMismatch = turnRows.some((row) => {
    if (row.action_type === 'diagnose_with_discriminating_question') return false;
    const tr = row.observation.observed_transition || {};
    return Number(tr.proof || 0) > 0 && Number(tr.release || 0) === 0;
  });

  return {
    scenario_id: scenario.id,
    hidden_state: scenario.hiddenState,
    condition: mode,
    final_belief: calibrationBelief || finalBelief || uniformBeliefFromSurface(scenario),
    final_axes: finalAxes,
    actions,
    contracts,
    closed_interventions: CLOSED_MODES.has(mode)
      ? ledger.filter((record) => record.status === 'closed')
      : turnRows.map((row, idx) => ({
          contract_id: contracts[idx].contract_id,
          action_type: row.action_type,
          status: 'closed',
          outcome: row.observation.outcome,
          observed_transition: row.observation.observed_transition,
        })),
    strict_joint_success: turnRows.some((row) => row.strict_joint_success),
    proof_release_mismatch: proofReleaseMismatch,
    action_state_fit: turnRows.every((row) => row.action_state_fit || row.action_type === 'diagnose_with_discriminating_question'),
    counterfactual_regret: turnRows.reduce((sum, row) => sum + row.counterfactual_regret, 0) / Math.max(1, turnRows.length),
    turns: turnRows,
    evidence_categories: finalEvidence,
    top_hypothesis: topHypothesisId(finalBelief),
  };
}

function renderMarkdown(report) {
  const treatment = report.conditions.includes('closed_loop') ? 'closed_loop' : report.conditions[0];
  const baseline = report.conditions.includes('legacy') ? 'legacy' : report.conditions[1];
  const metrics = [
    'strictJointSuccess',
    'stateTop1Accuracy',
    'stateBrierScore',
    'interventionSuccessRate',
    'actionStateFitRate',
    'tutorControlCost',
    'proofReleaseMismatchRate',
    'counterfactualRegret',
    'finalProof',
    'finalRelease',
    'finalOwnership',
  ];
  const lines = [
    '# Adaptation policy evaluation',
    '',
    '**Evaluation type:** deterministic synthetic policy-level mechanics test',
    `**Suite version:** ${report.suiteVersion}`,
    `**Scenarios:** ${report.scenarioCount}`,
    `**Tutor turns per dialogue:** ${report.turnsPerDialogue}`,
    '',
    '> This deterministic oracle evaluation validates mechanics and discriminability only. It is not evidence of real learner adaptation or repository-integrated performance.',
    '',
    '## Aggregate results',
    '',
    `| Metric | ${treatment} | ${baseline} | ${treatment} - ${baseline} |`,
    '|---|---:|---:|---:|',
  ];
  for (const metric of metrics) {
    const t = report.aggregates[treatment]?.[metric] ?? 0;
    const b = report.aggregates[baseline]?.[metric] ?? 0;
    lines.push(`| ${labelForAggregate(metric)} | ${fmt(t)} | ${fmt(b)} | ${fmt(t - b)} |`);
  }
  lines.push('', '## Paired bootstrap intervals', '');
  for (const [metric, ci] of Object.entries(report.pairedBootstrapIntervals || {})) {
    lines.push(`- **${metricLabel(metric)}:** mean difference ${fmt(ci.mean)}, 95% bootstrap CI [${fmt(ci.lower)}, ${fmt(ci.upper)}]`);
  }
  lines.push('', '## Scenario traces', '');
  lines.push('| Scenario | Hidden state | ' + report.conditions.map((c) => `${c} actions`).join(' | ') + ' |');
  lines.push('|---|---|' + report.conditions.map(() => '---|').join(''));
  for (const scenario of report.scenarios) {
    const cells = report.conditions.map((condition) => {
      const row = report.rows.find((r) => r.scenario_id === scenario.id && r.condition === condition);
      return row ? row.actions.map((a) => a.action_type).join(' -> ') : '';
    });
    lines.push(`| ${scenario.id} | ${scenario.hiddenState} | ${cells.join(' | ')} |`);
  }
  lines.push(
    '',
    '## Interpretation',
    '',
    'The closed-loop condition is expected to win this oracle fixture when it uses diagnostic actions to resolve state uncertainty, then selects lower-control actions matched to the revealed learner cause and closes intervention outcomes. Treat these results as a mechanics check before repository-integrated and real-LLM evaluation.',
    '',
  );
  return `${lines.join('\n')}\n`;
}

function labelForAggregate(metric) {
  return {
    strictJointSuccess: 'Strict joint proof/release/ownership success',
    stateTop1Accuracy: 'State top-1 accuracy',
    stateBrierScore: 'State Brier score (lower is better)',
    interventionSuccessRate: 'Intervention success rate',
    actionStateFitRate: 'Action-state fit rate',
    tutorControlCost: 'Tutor control cost',
    proofReleaseMismatchRate: 'Proof/release mismatch rate',
    counterfactualRegret: 'Counterfactual regret',
    finalProof: 'Final proof',
    finalRelease: 'Final release',
    finalOwnership: 'Final ownership',
  }[metric] || metric;
}

function fmt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : '';
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }
  const suite = loadSuite(opts.suite);
  const rows = [];
  for (const scenario of suite.scenarios) {
    for (const mode of opts.compare) {
      rows.push(runScenarioMode(scenario, mode));
    }
  }
  const aggregates = summarizeConditions(rows, opts.compare);
  const treatment = opts.compare.includes('closed_loop') ? 'closed_loop' : opts.compare[0];
  const baseline = opts.compare.includes('legacy') ? 'legacy' : opts.compare[1];
  const report = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    evaluation_kind: 'synthetic-policy-level',
    suiteVersion: suite.version,
    scenarioCount: suite.scenarios.length,
    turnsPerDialogue: TURNS,
    suite_hash: createHash('sha256').update(JSON.stringify(suite)).digest('hex'),
    conditions: opts.compare,
    primary_metrics: aggregates,
    aggregates,
    pairedDifferences: pairedDifferences(rows, treatment, baseline),
    pairedBootstrapIntervals: pairedBootstrapIntervals(rows, treatment, baseline),
    scenarios: suite.scenarios,
    rows,
    limitations: [
      'Synthetic hidden states are oracle-controlled.',
      'Learner continuations are deterministic text fixtures.',
      'This report validates mechanics and discriminability, not real learner adaptation.',
    ],
  };
  fs.mkdirSync(path.dirname(opts.output), { recursive: true });
  fs.writeFileSync(opts.output, `${JSON.stringify(report, null, 2)}\n`);
  const mdPath = opts.output.replace(/\.json$/u, '.md');
  fs.writeFileSync(mdPath, renderMarkdown(report));
  console.log(`Wrote ${path.relative(process.cwd(), opts.output)}`);
  console.log(`Wrote ${path.relative(process.cwd(), mdPath)}`);
  const closed = aggregates.closed_loop;
  const legacy = aggregates.legacy;
  if (closed && legacy) {
    console.log(
      `closed_loop strictJoint=${fmt(closed.strictJointSuccess)} vs legacy=${fmt(legacy.strictJointSuccess)}; stateTop1=${fmt(closed.stateTop1Accuracy)} vs ${fmt(legacy.stateTop1Accuracy)}`,
    );
  }
}

main();
