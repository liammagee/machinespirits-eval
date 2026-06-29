#!/usr/bin/env node
// Deterministic mock ablation for the unified proof-DAG + learner-resistance
// adaptation policy layer. Runs DAG-only, resistance-only, and combined arms
// across the controlled resistance signals in an isolated temp DB/logs dir.
//
// No paid API calls.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import Database from 'better-sqlite3';
import yaml from 'yaml';

const DEFAULT_OUT_DIR = 'exports/adaptive-dag-resistance-comparison';
const PROFILE_NAME = 'mock_dag_resistance_comparison';
const ARM_ORDER = ['dag_only', 'resistance_only', 'combined'];
const ARM_LABELS = {
  dag_only: 'DAG-only',
  resistance_only: 'resistance-only',
  combined: 'combined',
};

const WORLD_SPEC = {
  id: 'W_AF6_CURRICULUM',
  version: 'ms-world-adaptation-v0.1',
  source_curriculum_id: 'ai_foundations_v1',
  module_id: 'AF6',
  spec_hash: 'sha256:dag-resistance-comparison',
  action_policy: {
    allowed_action_families: ['request_evidence'],
    preferred_action_families: ['request_evidence'],
    disallowed_action_families: [
      'diagnose_with_discriminating_question',
      'model_worked_example',
      'explain_principle',
      'lower_cognitive_load',
    ],
  },
  expected_transitions: [
    {
      action_type: 'request_evidence',
      success_evidence: ['learner-authored rationale'],
      failure_evidence: ['mere agreement'],
      world_success_observables: ['Learner supplies their own rationale before tutor proof supply.'],
    },
  ],
  forbidden_moves: [
    { id: 'no_hidden_label_exposure', move: 'hidden_label_exposure' },
    { id: 'no_premature_proof_supply', move: 'supply_decisive_step' },
  ],
};

const RESISTANCE_CASES = [
  {
    signal: 'boredom',
    opening:
      'This is starting to feel boring and dead, like I am only filling out a worksheet instead of learning anything.',
    resistanceEvidence: ['renewed content-bearing work', 'learner-owned test case'],
  },
  {
    signal: 'frustration',
    opening: 'I am stuck and frustrated; the sequence still feels inert no matter how many times I repeat it.',
    resistanceEvidence: ['renewed attempt after affective repair', 'smaller learner-owned move'],
  },
  {
    signal: 'irrelevance',
    opening: 'Why should I care about this? I do not see the point or why this matters for the actual task.',
    resistanceEvidence: ['learner-owned relevance test', 'task reorientation'],
  },
  {
    signal: 'question_flood',
    opening:
      'Why Hegel? What does this do? What is the point? Why should this matter before I can just use the formula?',
    resistanceEvidence: ['collapsed question set', 'state-disambiguating response'],
  },
  {
    signal: 'rote_parroting',
    opening: 'So I just repeat master, servant, recognition, formula? This still feels like parroting.',
    resistanceEvidence: ['learner-authored prediction', 'non-formulaic learner rationale'],
  },
];

const NEGATIVE_CONTROLS = [
  {
    id: 'mere_agreement',
    label: 'mere agreement',
    response: 'Okay.',
  },
  {
    id: 'formula_parroting',
    label: 'formula parroting',
    response: 'Master, servant, recognition, formula.',
  },
  {
    id: 'tutor_rationale_adoption',
    label: 'tutor rationale adoption',
    response: 'As you said, your reason explains it.',
  },
  {
    id: 'vague_explain_more',
    label: 'vague explain more',
    response: 'Can you explain more?',
  },
];

const CONDITION_ORDER = ['positive', ...NEGATIVE_CONTROLS.map((control) => control.id)];
const CONTROL_LABELS = Object.freeze({
  positive: 'positive uptake',
  ...Object.fromEntries(NEGATIVE_CONTROLS.map((control) => [control.id, control.label])),
});

function proofEvidenceForSignal(signal) {
  if (signal === 'boredom') {
    return 'Because I can test one concrete case instead of dead worksheet repetition.';
  }
  if (signal === 'frustration') {
    return 'Because I can try one small step: test one case before repeating the whole sequence.';
  }
  if (signal === 'irrelevance') {
    return 'The task asks why this matters, because a concrete case shows the point of the relation.';
  }
  if (signal === 'question_flood') {
    return 'The task asks me to collapse this to one main question, because the relation changes across cases.';
  }
  if (signal === 'rote_parroting') {
    return 'I predict the formula breaks when the case changes, because I need to explain the relation in my own words.';
  }
  return 'Because the case changes the relation.';
}

function predictionForSignal(signal) {
  if (signal === 'irrelevance') {
    return 'I predict the point matters when the task asks me to test a case.';
  }
  if (signal === 'frustration') {
    return 'I predict one small try will show where I am stuck.';
  }
  return 'I predict the formula breaks when the case changes, because I need to explain the relation in my own words.';
}

function strategyChoiceForSignal(signal) {
  if (signal === 'boredom') return 'I choose to test one concrete case.';
  return 'I choose one small test case before asking for another explanation.';
}

function diagnosticForSignal(signal) {
  if (signal === 'question_flood') {
    return 'The task asks me to collapse this to one main question: what changes if the relation changes?';
  }
  return 'The task asks me to name the missing step before continuing.';
}

function positiveScriptedResponses(signal) {
  return {
    diagnose_with_discriminating_question: diagnosticForSignal(signal),
    elicit_prediction: predictionForSignal(signal),
    request_evidence: proofEvidenceForSignal(signal),
    ask_strategy_choice: strategyChoiceForSignal(signal),
    default: proofEvidenceForSignal(signal),
  };
}

function negativeScriptedResponses(control) {
  return { default: control.response };
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    outDir: null,
    keepTemp: false,
    verbose: false,
    llm: 'mock',
    conditions: null,
    runsPerConfig: 1,
    maxCostUsd: null,
    provider: null,
    model: null,
    strict: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out-dir') {
      opts.outDir = argv[++i];
    } else if (arg.startsWith('--out-dir=')) {
      opts.outDir = arg.slice('--out-dir='.length);
    } else if (arg === '--keep-temp') {
      opts.keepTemp = true;
    } else if (arg === '--verbose') {
      opts.verbose = true;
    } else if (arg === '--llm') {
      opts.llm = argv[++i];
    } else if (arg.startsWith('--llm=')) {
      opts.llm = arg.slice('--llm='.length);
    } else if (arg === '--conditions') {
      opts.conditions = argv[++i];
    } else if (arg.startsWith('--conditions=')) {
      opts.conditions = arg.slice('--conditions='.length);
    } else if (arg === '--runs') {
      opts.runsPerConfig = Number(argv[++i]);
    } else if (arg.startsWith('--runs=')) {
      opts.runsPerConfig = Number(arg.slice('--runs='.length));
    } else if (arg === '--max-cost') {
      opts.maxCostUsd = Number(argv[++i]);
    } else if (arg.startsWith('--max-cost=')) {
      opts.maxCostUsd = Number(arg.slice('--max-cost='.length));
    } else if (arg === '--provider') {
      opts.provider = argv[++i];
    } else if (arg.startsWith('--provider=')) {
      opts.provider = arg.slice('--provider='.length);
    } else if (arg === '--model') {
      opts.model = argv[++i];
    } else if (arg.startsWith('--model=')) {
      opts.model = arg.slice('--model='.length);
    } else if (arg === '--strict') {
      opts.strict = true;
    } else if (arg === '--no-strict') {
      opts.strict = false;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  opts.llm = String(opts.llm || 'mock').toLowerCase();
  if (!['mock', 'real'].includes(opts.llm)) throw new Error(`--llm must be mock or real (got ${opts.llm})`);
  if (opts.conditions == null) opts.conditions = opts.llm === 'real' ? 'positive' : 'all';
  opts.conditions = String(opts.conditions || 'all').toLowerCase();
  if (!['all', 'positive', 'negative'].includes(opts.conditions)) {
    throw new Error(`--conditions must be all, positive, or negative (got ${opts.conditions})`);
  }
  if (!Number.isInteger(opts.runsPerConfig) || opts.runsPerConfig < 1) {
    throw new Error(`--runs must be a positive integer (got ${opts.runsPerConfig})`);
  }
  if (opts.maxCostUsd != null && !(opts.maxCostUsd > 0)) {
    throw new Error(`--max-cost must be a positive number (got ${opts.maxCostUsd})`);
  }
  if (opts.llm === 'real' && !(opts.maxCostUsd > 0)) {
    throw new Error('--llm real requires --max-cost <usd>; use an explicit ceiling for metered runs');
  }
  if (opts.strict == null) opts.strict = opts.llm === 'mock';
  if (!opts.outDir) opts.outDir = opts.llm === 'real' ? `${DEFAULT_OUT_DIR}-real` : DEFAULT_OUT_DIR;
  return opts;
}

function usage() {
  return [
    'Usage: node scripts/run-dag-resistance-comparison.js [options]',
    '',
    'Runs a mock or real ablation over DAG-only, resistance-only, and combined policy-layer arms.',
    '',
    'Options:',
    '  --llm mock|real          Backend. Default: mock',
    '  --conditions all|positive|negative',
    '                          Default: all for mock, positive for real',
    '  --runs N                Repetitions per scenario. Default: 1',
    '  --max-cost USD          Required for --llm real',
    '  --provider NAME         Optional real backend provider override',
    '  --model ALIAS_OR_ID     Optional real backend model override',
    '  --strict / --no-strict  Throw on validation failures. Default: strict for mock, non-strict for real',
    '  --out-dir DIR           Default: exports/adaptive-dag-resistance-comparison[-real]',
    '  --keep-temp             Preserve isolated temp DB/logs',
  ].join('\n');
}

function scenarioId(signal, arm, control = 'positive') {
  return `dag_resistance_${signal}_${arm}_${control}`;
}

function resistancePolicy(signal, resistanceEvidence) {
  return {
    resistance_breakthrough_diagnostic: true,
    resistance_signal_target: signal,
    resistance_signal_gate: resistanceEvidence.map((label) => ({ label, required: true })),
  };
}

function controlsForConditions(conditions) {
  if (conditions === 'positive') return [{ id: 'positive', label: 'positive uptake' }];
  if (conditions === 'negative') return NEGATIVE_CONTROLS;
  return [{ id: 'positive', label: 'positive uptake' }, ...NEGATIVE_CONTROLS];
}

export function buildComparisonScenarios({ conditions = 'all', scripted = true } = {}) {
  const scenarios = [];
  const metadata = new Map();
  const controls = controlsForConditions(conditions);
  for (const spec of RESISTANCE_CASES) {
    for (const arm of ARM_ORDER) {
      for (const control of controls) {
        const extras = {};
        if (arm === 'dag_only' || arm === 'combined') extras.world_adaptation_spec = WORLD_SPEC;
        if (arm === 'resistance_only' || arm === 'combined') {
          Object.assign(extras, resistancePolicy(spec.signal, spec.resistanceEvidence));
        }
        const id = scenarioId(spec.signal, arm, control.id);
        const hidden = {
          actual_misconception: `resistance signal: ${spec.signal}`,
          actual_sophistication: 'intermediate',
          trigger_turn: -1,
          trigger_signal: spec.opening,
        };
        if (scripted) {
          hidden.scripted_responses =
            control.id === 'positive' ? positiveScriptedResponses(spec.signal) : negativeScriptedResponses(control);
        }
        scenarios.push({
          id,
          name: `${spec.signal} / ${ARM_LABELS[arm]} / ${control.label}`,
          scenario_type: spec.signal,
          opening: spec.opening,
          max_turns: 2,
          hidden,
          ...extras,
        });
        metadata.set(id, {
          signal: spec.signal,
          arm,
          control: control.id,
          controlLabel: control.label,
          expectedOutcome: control.id === 'positive' ? 'success' : 'non_success',
          expectedResistanceEvidence: spec.resistanceEvidence,
        });
      }
    }
  }
  return { scenarios, metadata };
}

function countBy(values = []) {
  return values.reduce((acc, value) => {
    const key = value || '(empty)';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function firstClosedLedger(trace) {
  return (trace.original?.finalInterventionLedger || []).find((record) => record?.status === 'closed') || null;
}

function firstAdaptationContract(trace) {
  return trace.original?.perTurn?.find((record) => record?.adaptationContract)?.adaptationContract || null;
}

function policyLayerFor(contract) {
  return contract?.selected_action?.adaptation_policy_layer || contract?.selected_action?.policy_layer || null;
}

function baseScenarioId(id = '') {
  return String(id).replace(/__r\d+$/u, '');
}

function trueEvidenceLabels(record) {
  const categories = record?.evidence?.[0]?.categories || {};
  return Object.entries(categories)
    .filter(([, value]) => value === true)
    .map(([label]) => label)
    .sort();
}

function includesAll(haystack = [], needles = []) {
  const set = new Set(haystack);
  return needles.every((needle) => set.has(needle));
}

function layerMatches(row) {
  const hasProof = Boolean(row.policyLayer?.proof_dag?.id);
  const hasResistance = Boolean(row.policyLayer?.learner_resistance?.observed_signal);
  if (row.arm === 'dag_only') return hasProof && !hasResistance;
  if (row.arm === 'resistance_only') return !hasProof && hasResistance && row.observedResistance === row.signal;
  if (row.arm === 'combined') return hasProof && hasResistance && row.observedResistance === row.signal;
  return false;
}

function summarizeTrace({ row, trace, metadata }) {
  const contract = firstAdaptationContract(trace);
  const ledger = firstClosedLedger(trace);
  const selected = contract?.selected_action || {};
  const policyLayer = policyLayerFor(contract);
  const meta = metadata.get(row.scenario_id) || metadata.get(baseScenarioId(row.scenario_id));
  if (!meta) throw new Error(`missing scenario metadata for ${row.scenario_id}`);
  const requiredEvidence =
    ledger?.success_signal?.required_evidence || selected.success_signal?.required_evidence || [];
  const evidenceLabels = trueEvidenceLabels(ledger);
  const summary = {
    scenarioId: row.scenario_id,
    signal: meta.signal,
    arm: meta.arm,
    control: meta.control,
    controlLabel: meta.controlLabel,
    expectedOutcome: meta.expectedOutcome,
    selectedAction: selected.action_type || ledger?.action_type || null,
    firstOutcome: ledger?.outcome || null,
    requiredEvidence,
    forbiddenEvidence: ledger?.success_signal?.forbidden_evidence || selected.success_signal?.forbidden_evidence || [],
    requiredEvidenceSatisfied: includesAll(evidenceLabels, requiredEvidence),
    expectedResistanceEvidence: meta.expectedResistanceEvidence,
    expectedResistanceEvidenceSatisfied:
      meta.arm === 'dag_only' ? null : includesAll(evidenceLabels, meta.expectedResistanceEvidence),
    evidenceLabels,
    evidenceQuote: ledger?.evidence?.[0]?.quote || '',
    observedTransition: ledger?.observed_transition || {},
    proofDagId: policyLayer?.proof_dag?.id || null,
    observedResistance: policyLayer?.learner_resistance?.observed_signal || null,
    policyAxes: policyLayer?.policy_axes || [],
    policyLayer,
  };
  return {
    ...summary,
    policyLayerMatchesArm: layerMatches(summary),
    positiveClosure: meta.expectedOutcome === 'success' && summary.firstOutcome === 'success',
    falsePositiveRejected: meta.expectedOutcome === 'non_success' && summary.firstOutcome !== 'success',
  };
}

function aggregateRows(rows) {
  const positiveRows = rows.filter((row) => row.expectedOutcome === 'success');
  const negativeRows = rows.filter((row) => row.expectedOutcome === 'non_success');
  const byArm = {};
  for (const arm of ARM_ORDER) {
    const armRows = rows.filter((row) => row.arm === arm);
    const positiveArmRows = positiveRows.filter((row) => row.arm === arm);
    const negativeArmRows = negativeRows.filter((row) => row.arm === arm);
    byArm[arm] = {
      label: ARM_LABELS[arm],
      scenarioN: armRows.length,
      positiveN: positiveArmRows.length,
      positiveSuccessN: positiveArmRows.filter((row) => row.firstOutcome === 'success').length,
      positiveSuccessRate: positiveArmRows.length
        ? positiveArmRows.filter((row) => row.firstOutcome === 'success').length / positiveArmRows.length
        : 0,
      negativeN: negativeArmRows.length,
      negativeRejectedN: negativeArmRows.filter((row) => row.firstOutcome !== 'success').length,
      negativeRejectedRate: negativeArmRows.length
        ? negativeArmRows.filter((row) => row.firstOutcome !== 'success').length / negativeArmRows.length
        : 0,
      policyLayerMatchN: armRows.filter((row) => row.policyLayerMatchesArm).length,
      requiredEvidenceSatisfiedN: positiveArmRows.filter((row) => row.requiredEvidenceSatisfied).length,
      selectedActions: countBy(positiveArmRows.map((row) => row.selectedAction)),
      observedResistanceSignals: countBy(armRows.map((row) => row.observedResistance)),
    };
  }

  const bySignal = {};
  for (const spec of RESISTANCE_CASES) {
    const signalRows = positiveRows.filter((row) => row.signal === spec.signal);
    const armMap = Object.fromEntries(signalRows.map((row) => [row.arm, row]));
    const dagRequired = armMap.dag_only?.requiredEvidence || [];
    const combinedRequired = armMap.combined?.requiredEvidence || [];
    const hasPositiveRows = signalRows.length > 0;
    const signalNegativeRows = negativeRows.filter((row) => row.signal === spec.signal);
    bySignal[spec.signal] = {
      positiveRows: signalRows.length,
      negativeRows: signalNegativeRows.length,
      allArmsSucceeded: hasPositiveRows ? ARM_ORDER.every((arm) => armMap[arm]?.firstOutcome === 'success') : null,
      combinedHasBothPolicySources: hasPositiveRows
        ? Boolean(armMap.combined?.proofDagId && armMap.combined?.observedResistance)
        : null,
      combinedEvidenceJoin: hasPositiveRows
        ? includesAll(combinedRequired, dagRequired) && includesAll(combinedRequired, spec.resistanceEvidence)
        : null,
      dagOnlyAction: armMap.dag_only?.selectedAction || null,
      resistanceOnlyAction: armMap.resistance_only?.selectedAction || null,
      combinedAction: armMap.combined?.selectedAction || null,
      negativeControlsRejected: signalNegativeRows.length
        ? signalNegativeRows.every((row) => row.firstOutcome !== 'success')
        : null,
    };
  }

  const byControl = {};
  for (const control of CONDITION_ORDER) {
    const controlRows = rows.filter((row) => row.control === control);
    if (control === 'positive') {
      byControl[control] = {
        label: CONTROL_LABELS[control],
        rows: controlRows.length,
        successN: controlRows.filter((row) => row.firstOutcome === 'success').length,
        successRate: controlRows.length
          ? controlRows.filter((row) => row.firstOutcome === 'success').length / controlRows.length
          : 0,
        outcomes: countBy(controlRows.map((row) => row.firstOutcome)),
      };
    } else {
      byControl[control] = {
        label: CONTROL_LABELS[control],
        rows: controlRows.length,
        rejectedN: controlRows.filter((row) => row.firstOutcome !== 'success').length,
        rejectedRate: controlRows.length
          ? controlRows.filter((row) => row.firstOutcome !== 'success').length / controlRows.length
          : 0,
        accidentalSuccessN: controlRows.filter((row) => row.firstOutcome === 'success').length,
        outcomes: countBy(controlRows.map((row) => row.firstOutcome)),
      };
    }
  }

  return {
    byArm,
    bySignal,
    byControl,
    totals: {
      scenarioRows: rows.length,
      positiveRows: positiveRows.length,
      positiveSuccessRows: positiveRows.filter((row) => row.firstOutcome === 'success').length,
      negativeRows: negativeRows.length,
      negativeRejectedRows: negativeRows.filter((row) => row.firstOutcome !== 'success').length,
      accidentalNegativeSuccessRows: negativeRows.filter((row) => row.firstOutcome === 'success').length,
      policyLayerMatchRows: rows.filter((row) => row.policyLayerMatchesArm).length,
      combinedBothSourcesRows: positiveRows.filter(
        (row) => row.arm === 'combined' && row.proofDagId && row.observedResistance,
      ).length,
      resistanceOnlyDistinctActions: Object.keys(byArm.resistance_only.selectedActions).filter(
        (key) => key !== '(empty)',
      ).length,
    },
  };
}

function validateReport(report) {
  const failures = [];
  const expectedRows = report.plannedRows;
  if (report.rows.length !== expectedRows) failures.push(`expected ${expectedRows} rows, got ${report.rows.length}`);
  for (const row of report.rows) {
    if (row.expectedOutcome === 'success' && row.firstOutcome !== 'success') {
      failures.push(`${row.scenarioId}: first closed intervention outcome=${row.firstOutcome}`);
    }
    if (row.expectedOutcome === 'non_success' && row.firstOutcome === 'success') {
      failures.push(`${row.scenarioId}: negative control closed as success`);
    }
    if (!row.policyLayerMatchesArm) {
      failures.push(`${row.scenarioId}: policy layer does not match ${row.arm}`);
    }
    if (row.expectedOutcome === 'success' && !row.requiredEvidenceSatisfied) {
      failures.push(`${row.scenarioId}: required evidence not satisfied [${row.requiredEvidence.join(', ')}]`);
    }
    if (row.expectedOutcome === 'success' && row.arm !== 'dag_only' && !row.expectedResistanceEvidenceSatisfied) {
      failures.push(
        `${row.scenarioId}: resistance evidence not satisfied [${row.expectedResistanceEvidence.join(', ')}]`,
      );
    }
  }
  for (const [signal, contrast] of Object.entries(report.aggregates.bySignal)) {
    if (contrast.positiveRows > 0) {
      if (!contrast.allArmsSucceeded) failures.push(`${signal}: not all arms succeeded`);
      if (!contrast.combinedHasBothPolicySources) failures.push(`${signal}: combined arm lacks both policy sources`);
      if (!contrast.combinedEvidenceJoin)
        failures.push(`${signal}: combined evidence does not join DAG + route evidence`);
    }
    if (contrast.negativeRows > 0 && !contrast.negativeControlsRejected) {
      failures.push(`${signal}: at least one negative control closed as success`);
    }
  }
  if (report.aggregates.totals.positiveRows > 0 && report.aggregates.totals.resistanceOnlyDistinctActions < 3) {
    failures.push(
      `resistance-only routing collapsed to ${report.aggregates.totals.resistanceOnlyDistinctActions} distinct actions`,
    );
  }
  if (report.aggregates.totals.accidentalNegativeSuccessRows > 0) {
    failures.push(`${report.aggregates.totals.accidentalNegativeSuccessRows} negative-control rows closed as success`);
  }
  return failures;
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatList(values = []) {
  return values.length ? values.join(', ') : '-';
}

function yesNo(value) {
  if (value === null || value === undefined) return 'n/a';
  return value ? 'yes' : 'no';
}

function ratioCell(numerator, denominator, rate) {
  if (!denominator) return 'n/a';
  return `${numerator}/${denominator} (${formatRate(rate)})`;
}

function contractEvidenceLabels(row) {
  return row.evidenceLabels.filter((label) => row.requiredEvidence.includes(label));
}

export function markdownReport(report) {
  const lines = [];
  lines.push('# Adaptive DAG/Resistance Comparison');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run id: \`${report.runId}\``);
  lines.push(`LLM mode: \`${report.llmMode}\``);
  lines.push(`Conditions: \`${report.conditions}\``);
  lines.push(`Runs per scenario: ${report.runsPerConfig}`);
  if (report.maxCostUsd) lines.push(`Budget ceiling: $${report.maxCostUsd.toFixed(2)}`);
  lines.push(`Rows: ${report.rows.length}`);
  lines.push('');
  lines.push('## Claim Boundary');
  lines.push('');
  if (report.llmMode === 'real') {
    lines.push(
      'This is a real-LLM ablation over the mechanism-wiring harness, not an empirical learning-effect result. It checks whether proof-DAG constraints and learner-resistance routing operate as one adaptation policy layer under unscripted learner turns with observable evidence closure.',
    );
  } else {
    lines.push(
      'This is a deterministic mock ablation of mechanism wiring, not an empirical learning-effect result. It checks whether proof-DAG constraints and learner-resistance routing can operate as one adaptation policy layer with observable evidence closure, and whether shallow negative-control replies are rejected.',
    );
  }
  lines.push('');
  lines.push('## Aggregate Result');
  lines.push('');
  lines.push(
    '| arm | positive closure | negative controls rejected | policy-layer matches | positive selected actions |',
  );
  lines.push('|---|---:|---:|---:|---|');
  for (const arm of ARM_ORDER) {
    const aggregate = report.aggregates.byArm[arm];
    lines.push(
      `| ${aggregate.label} | ${ratioCell(
        aggregate.positiveSuccessN,
        aggregate.positiveN,
        aggregate.positiveSuccessRate,
      )} | ${ratioCell(aggregate.negativeRejectedN, aggregate.negativeN, aggregate.negativeRejectedRate)} | ${
        aggregate.policyLayerMatchN
      }/${aggregate.scenarioN} | ${Object.entries(aggregate.selectedActions)
        .map(([action, count]) => `${action}=${count}`)
        .join(', ')} |`,
    );
  }
  lines.push('');
  if (report.aggregates.totals.negativeRows > 0) {
    lines.push('## Negative Controls');
    lines.push('');
    lines.push('| control | rows | rejected | accidental successes | outcomes |');
    lines.push('|---|---:|---:|---:|---|');
    for (const control of NEGATIVE_CONTROLS) {
      const aggregate = report.aggregates.byControl[control.id];
      lines.push(
        `| ${aggregate.label} | ${aggregate.rows} | ${aggregate.rejectedN}/${aggregate.rows} (${formatRate(
          aggregate.rejectedRate,
        )}) | ${aggregate.accidentalSuccessN} | ${Object.entries(aggregate.outcomes)
          .map(([outcome, count]) => `${outcome}=${count}`)
          .join(', ')} |`,
      );
    }
    lines.push('');
  }
  lines.push('## Per-Signal Contrast');
  lines.push('');
  lines.push(
    '| signal | DAG-only action | resistance-only action | combined action | all succeeded | combined source join | evidence join |',
  );
  lines.push('|---|---|---|---|---:|---:|---:|');
  for (const signal of RESISTANCE_CASES.map((entry) => entry.signal)) {
    const contrast = report.aggregates.bySignal[signal];
    lines.push(
      `| ${signal} | ${contrast.dagOnlyAction} | ${contrast.resistanceOnlyAction} | ${contrast.combinedAction} | ${yesNo(
        contrast.allArmsSucceeded,
      )} | ${yesNo(contrast.combinedHasBothPolicySources)} | ${yesNo(contrast.combinedEvidenceJoin)} |`,
    );
  }
  lines.push('');
  lines.push('## Positive Row Detail');
  lines.push('');
  lines.push('| signal | arm | action | layer | required evidence | evidence observed | outcome |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const row of report.rows.filter((record) => record.expectedOutcome === 'success')) {
    const layer =
      row.arm === 'combined'
        ? `proof:${row.proofDagId} + resistance:${row.observedResistance}`
        : row.proofDagId
          ? `proof:${row.proofDagId}`
          : `resistance:${row.observedResistance}`;
    lines.push(
      `| ${row.signal} | ${ARM_LABELS[row.arm]} | ${row.selectedAction} | ${layer} | ${formatList(
        row.requiredEvidence,
      )} | ${formatList(contractEvidenceLabels(row))} | ${row.firstOutcome} |`,
    );
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    '- DAG-only enforces the proof-release route: the proof fixture constrains every case to `request_evidence` and requires learner-authored rationale before closure.',
  );
  lines.push(
    '- Resistance-only routes by learner resistance signal: the selected actions vary by signal while requiring resistance-breakthrough evidence.',
  );
  lines.push(
    '- Combined joins both sources: each combined row carries the proof-DAG identity and the matched resistance signal, and its success contract joins the proof-DAG evidence requirement with the signal-specific resistance evidence.',
  );
  if (report.aggregates.totals.negativeRows > 0) {
    lines.push(
      '- Negative controls reject shallow uptake: mere agreement, formula parroting, tutor-rationale adoption, and vague requests for more explanation do not close as success.',
    );
  } else {
    lines.push('- Negative controls were not included in this run.');
  }
  lines.push(
    '- The comparison supports a mechanical claim about policy-layer integration. It does not show that real learners improve more under the combined mechanism.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeArtifacts({ outDir, scenarioYaml, report }) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'summary.json');
  const mdPath = path.join(outDir, 'report.md');
  const fixturePath = path.join(outDir, 'scenario-fixture.yaml');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(mdPath, markdownReport(report));
  fs.writeFileSync(fixturePath, scenarioYaml);
  return { jsonPath, mdPath, fixturePath };
}

export async function runComparison({
  outDir = DEFAULT_OUT_DIR,
  keepTemp = false,
  verbose = false,
  llm = 'mock',
  conditions = llm === 'real' ? 'positive' : 'all',
  runsPerConfig = 1,
  maxCostUsd = null,
  provider = null,
  model = null,
  strict = llm === 'mock',
} = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dag-resistance-comparison-'));
  const tmpDb = path.join(tmpDir, 'evaluations.db');
  const tmpLogs = path.join(tmpDir, 'logs');
  const scenarioPath = path.join(tmpDir, 'scenarios.yaml');
  fs.mkdirSync(path.join(tmpLogs, 'tutor-dialogues'), { recursive: true });

  process.env.EVAL_DB_PATH = tmpDb;
  process.env.EVAL_LOGS_DIR = tmpLogs;
  process.env.ADAPTIVE_TUTOR_LLM = llm;
  process.env.ADAPTIVE_POLICY_MODE = 'closed_loop';

  const { scenarios, metadata } = buildComparisonScenarios({ conditions, scripted: llm === 'mock' });
  const scenarioYaml = yaml.stringify({ scenarios });
  fs.writeFileSync(scenarioPath, scenarioYaml);

  const { runAdaptiveEvaluation } = await import('../services/adaptiveTutor/index.js');
  const adaptiveConfig = {
    architecture: 'state_policy_closed_loop',
    counterfactual: { enabled: false },
    policy: { mode: 'closed_loop' },
  };
  if (provider) adaptiveConfig.provider = provider;
  if (model) adaptiveConfig.model = model;
  const result = await runAdaptiveEvaluation({
    profileName: PROFILE_NAME,
    evalProfile: {
      runner: 'adaptive',
      scenario_source: scenarioPath,
      adaptive: adaptiveConfig,
    },
    scenarios: 'all',
    runsPerConfig,
    description: `${llm} DAG-only vs resistance-only vs combined adaptation policy comparison (${conditions})`,
    dryRun: llm === 'mock',
    verbose,
    maxCostUsd,
  });

  const db = new Database(tmpDb, { readonly: true });
  const rows = db
    .prepare(
      `
        SELECT scenario_id, dialogue_id
        FROM evaluation_results
        WHERE run_id = ?
      `,
    )
    .all(result.runId);
  db.close();

  const summaries = rows
    .map((row) => {
      const tracePath = path.join(tmpLogs, 'tutor-dialogues', `${row.dialogue_id}.json`);
      const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
      return summarizeTrace({ row, trace, metadata });
    })
    .sort((a, b) => {
      const signalDelta =
        RESISTANCE_CASES.findIndex((entry) => entry.signal === a.signal) -
        RESISTANCE_CASES.findIndex((entry) => entry.signal === b.signal);
      if (signalDelta) return signalDelta;
      const conditionDelta = CONDITION_ORDER.indexOf(a.control) - CONDITION_ORDER.indexOf(b.control);
      if (conditionDelta) return conditionDelta;
      const armDelta = ARM_ORDER.indexOf(a.arm) - ARM_ORDER.indexOf(b.arm);
      if (armDelta) return armDelta;
      return a.scenarioId.localeCompare(b.scenarioId);
    });

  const report = {
    generatedAt: new Date().toISOString(),
    kind: 'adaptation_policy_layer_ablation',
    profileName: PROFILE_NAME,
    runId: result.runId,
    llmMode: result.llmMode,
    conditions,
    runsPerConfig,
    strict,
    maxCostUsd,
    provider: provider || null,
    model: model || null,
    budget: result.budget || null,
    runtime: {
      tempArtifactsPreserved: keepTemp,
      tmpDir: keepTemp ? tmpDir : null,
      tmpDb: keepTemp ? tmpDb : null,
      tmpLogs: keepTemp ? tmpLogs : null,
      scenarioPath: keepTemp ? scenarioPath : null,
    },
    scenarioTemplateN: scenarios.length,
    plannedRows: scenarios.length * runsPerConfig,
    scenarioN: scenarios.length * runsPerConfig,
    rowN: summaries.length,
    worldSpec: {
      id: WORLD_SPEC.id,
      version: WORLD_SPEC.version,
      module_id: WORLD_SPEC.module_id,
      spec_hash: WORLD_SPEC.spec_hash,
      allowed_action_families: WORLD_SPEC.action_policy.allowed_action_families,
    },
    rows: summaries,
    aggregates: aggregateRows(summaries),
  };
  const failures = validateReport(report);
  report.validation = {
    passed: failures.length === 0,
    failures,
  };

  const artifacts = writeArtifacts({ outDir, scenarioYaml, report });
  if (!keepTemp) {
    // Keep the temp path in the report for immediate local audit, but remove
    // the isolated DB/log payload by default so repeated runs do not pile up.
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  if (strict && failures.length) {
    const err = new Error(`DAG/resistance comparison failed:\n- ${failures.join('\n- ')}`);
    err.report = report;
    err.artifacts = artifacts;
    throw err;
  }

  return { report, artifacts };
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    console.log(usage());
    return;
  }
  const { report, artifacts } = await runComparison(opts);
  console.log(report.validation.passed ? 'DAG/resistance comparison passed' : 'DAG/resistance comparison completed');
  console.log(`runId=${report.runId}`);
  console.log(`llm=${report.llmMode}`);
  console.log(`conditions=${report.conditions}`);
  console.log(`strict=${report.strict}`);
  console.log(`rows=${report.rows.length}`);
  if (!report.validation.passed) console.log(`validationFailures=${report.validation.failures.length}`);
  if (report.budget) {
    console.log(`budget=$${report.budget.accumulatedUsd.toFixed(4)} / $${report.budget.maxUsd.toFixed(2)}`);
  }
  console.log(`report=${artifacts.mdPath}`);
  console.log(`summary=${artifacts.jsonPath}`);
  console.log(`scenarioFixture=${artifacts.fixturePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    if (err.artifacts) {
      console.error(`report=${err.artifacts.mdPath}`);
      console.error(`summary=${err.artifacts.jsonPath}`);
    }
    process.exit(1);
  });
}
