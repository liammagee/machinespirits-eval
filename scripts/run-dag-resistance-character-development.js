#!/usr/bin/env node
// Longitudinal character-state experiment for the adaptive DAG/resistance
// mechanism. Unlike the flat comparison harness, this runs linked scenes for
// the same learner and carries a compact evidence-derived character state
// across scenes for the memory arms.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import yaml from 'yaml';
import { runScenario } from '../services/adaptiveTutor/runner.js';
import {
  characterMaturityScore,
  characterStateForTutorContext,
  initialCharacterState,
  shouldUseMatureFirstResponse,
  updateCharacterStateFromEvidence,
} from '../services/adaptiveTutor/characterState.js';
import { setActiveCellConfig, clearActiveCellConfig } from '../services/adaptiveTutor/realLLM.js';

const DEFAULT_OUT_DIR = 'exports/adaptive-dag-resistance-character-development';

const WORLD_SPEC = {
  id: 'W_AF6_CURRICULUM_LONGITUDINAL',
  version: 'ms-world-adaptation-v0.1',
  source_curriculum_id: 'ai_foundations_v1',
  module_id: 'AF6',
  spec_hash: 'sha256:dag-resistance-character-development',
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

const SCENES = Object.freeze([
  {
    id: 'scene_1_boredom',
    signal: 'boredom',
    opening: 'This feels dead, like I am only filling out a worksheet instead of learning anything.',
    resistanceEvidence: ['renewed content-bearing work', 'learner-owned test case'],
  },
  {
    id: 'scene_2_frustration',
    signal: 'frustration',
    opening: 'I am stuck and frustrated; I keep repeating the sequence and it still feels inert.',
    resistanceEvidence: ['renewed attempt after affective repair', 'smaller learner-owned move'],
  },
  {
    id: 'scene_3_irrelevance',
    signal: 'irrelevance',
    opening: 'Why should I care about this? I do not see why it matters for the task.',
    resistanceEvidence: ['learner-owned relevance test', 'task reorientation'],
  },
  {
    id: 'scene_4_question_flood',
    signal: 'question_flood',
    opening: 'Why Hegel? What does this do? Why does it matter? Why not just use the formula?',
    resistanceEvidence: ['collapsed question set', 'state-disambiguating response'],
  },
  {
    id: 'scene_5_rote_parroting',
    signal: 'rote_parroting',
    opening: 'So I just repeat master, servant, recognition, formula? This still feels like parroting.',
    resistanceEvidence: ['learner-authored prediction', 'non-formulaic learner rationale'],
  },
  {
    id: 'scene_6_transfer',
    signal: 'irrelevance',
    transfer: true,
    opening:
      'New case: this looks formally valid, but I do not yet see why the proof move matters for deciding the actual problem.',
    resistanceEvidence: ['learner-owned relevance test', 'task reorientation'],
  },
]);

const ARM_ORDER = ['no_memory_baseline', 'character_state_only', 'v2_policy_only', 'character_state_plus_v2'];
const ARM_CONFIG = Object.freeze({
  no_memory_baseline: {
    label: 'no-memory baseline',
    memory: false,
    v2: false,
  },
  character_state_only: {
    label: 'character-state only',
    memory: true,
    v2: false,
  },
  v2_policy_only: {
    label: 'v2 policy only',
    memory: false,
    v2: true,
  },
  character_state_plus_v2: {
    label: 'character-state + v2 policy',
    memory: true,
    v2: true,
  },
});

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    outDir: DEFAULT_OUT_DIR,
    llm: 'mock',
    provider: null,
    model: null,
    arms: ARM_ORDER,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out-dir') opts.outDir = argv[++i];
    else if (arg.startsWith('--out-dir=')) opts.outDir = arg.slice('--out-dir='.length);
    else if (arg === '--llm') opts.llm = argv[++i];
    else if (arg.startsWith('--llm=')) opts.llm = arg.slice('--llm='.length);
    else if (arg === '--provider') opts.provider = argv[++i];
    else if (arg.startsWith('--provider=')) opts.provider = arg.slice('--provider='.length);
    else if (arg === '--model') opts.model = argv[++i];
    else if (arg.startsWith('--model=')) opts.model = arg.slice('--model='.length);
    else if (arg === '--arms') opts.arms = parseArms(argv[++i]);
    else if (arg.startsWith('--arms=')) opts.arms = parseArms(arg.slice('--arms='.length));
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  opts.llm = String(opts.llm || 'mock').toLowerCase();
  if (!['mock', 'real'].includes(opts.llm)) throw new Error(`--llm must be mock or real (got ${opts.llm})`);
  return opts;
}

function usage() {
  return [
    'Usage: node scripts/run-dag-resistance-character-development.js [options]',
    '',
    'Runs linked DAG/resistance scenes with optional persistent character state.',
    '',
    'Options:',
    '  --llm mock|real          Backend. Default: mock',
    '  --provider NAME         Real backend provider override',
    '  --model ALIAS_OR_ID     Real backend model override',
    '  --arms A,B,C            Optional comma-separated arm subset',
    '  --out-dir DIR           Default: exports/adaptive-dag-resistance-character-development',
    '  --verbose               Print scene-level progress',
  ].join('\n');
}

function parseArms(value) {
  if (Array.isArray(value)) return value;
  const arms = String(value || '')
    .split(',')
    .map((arm) => arm.trim())
    .filter(Boolean);
  if (!arms.length) return ARM_ORDER;
  for (const arm of arms) {
    if (!ARM_CONFIG[arm]) throw new Error(`unknown arm: ${arm}`);
  }
  return [...new Set(arms)];
}

function resistancePolicy(scene) {
  return {
    resistance_signal_policy: true,
    resistance_signal_target: scene.signal,
    resistance_signal_gate: scene.resistanceEvidence.map((label) => ({ label, required: true })),
  };
}

function v2PolicyForArm(arm) {
  if (!ARM_CONFIG[arm]?.v2) return {};
  return {
    staged_combined_closure: true,
    typed_evidence_contracts: true,
    typed_staged_followup: true,
    semantic_outcome_observer: true,
  };
}

function partialResponse() {
  return 'Because the relation I named supports the next step.';
}

function matureResponse(signal) {
  if (signal === 'boredom') {
    return 'Because the relation I named supports the next step, I will test one concrete case and say what it shows.';
  }
  if (signal === 'frustration') {
    return 'Because the relation I named supports the next step, I will make one small try and see exactly where it sticks.';
  }
  if (signal === 'irrelevance') {
    return 'Because the relation I named supports the next step, this step matters for the actual task: it decides whether the method is valid for this case.';
  }
  if (signal === 'question_flood') {
    return 'Because the relation I named supports the next step, my one main question is what changes when the relation changes.';
  }
  if (signal === 'rote_parroting') {
    return 'I predict the formula breaks when the case changes, because I need to explain the relation in my own words rather than repeat labels.';
  }
  return 'Because the relation I named supports the next step, I can test the case in my own words.';
}

function stagedResponse(signal) {
  if (signal === 'boredom') return 'I will test one concrete case and say what it shows.';
  if (signal === 'frustration') return 'I will make one small try and name exactly where it sticks.';
  if (signal === 'irrelevance')
    return 'This step matters for the actual task because it decides whether the method is valid here.';
  if (signal === 'question_flood') return 'My one main question is what changes when the relation changes.';
  if (signal === 'rote_parroting')
    return 'I predict the formula breaks when the case changes rather than just repeating the labels.';
  return 'I will add the missing evidence in my own words.';
}

export function learnerResponseMode({ arm, characterState, scene }) {
  const config = ARM_CONFIG[arm];
  if (!config?.memory) return 'partial';
  return shouldUseMatureFirstResponse(characterState, { signal: scene.signal, transfer: scene.transfer })
    ? 'mature'
    : 'partial';
}

export function buildSceneScenario({ arm, scene, sceneIndex, characterState }) {
  const mode = learnerResponseMode({ arm, characterState, scene });
  const scripted = {
    request_evidence: mode === 'mature' ? matureResponse(scene.signal) : partialResponse(scene.signal),
    staged_followup: stagedResponse(scene.signal),
    default: mode === 'mature' ? matureResponse(scene.signal) : partialResponse(scene.signal),
  };
  return {
    id: `character_${arm}_${scene.id}`,
    hidden: {
      actualMisconception: `longitudinal resistance signal: ${scene.signal}`,
      actualSophistication: 'intermediate',
      triggerTurn: -1,
      triggerSignal: scene.opening,
      scriptedResponses: scripted,
      characterState: characterStateForTutorContext(characterState),
      responseMode: mode,
    },
    openingTurns: [
      {
        role: 'learner',
        content: scene.opening,
      },
    ],
    maxTurns: ARM_CONFIG[arm]?.v2 ? 3 : 2,
    sceneIndex,
    responseMode: mode,
  };
}

function graphOptionsForArm(arm, scene) {
  return {
    architecture: 'state_policy_closed_loop',
    adaptationPolicyMode: 'closed_loop',
    adaptivePolicy: {
      mode: 'closed_loop',
      world_adaptation_spec: WORLD_SPEC,
      ...resistancePolicy(scene),
      ...v2PolicyForArm(arm),
    },
  };
}

function firstClosedRecord(result) {
  return result.final.interventionLedger?.find((record) => record?.status === 'closed') || null;
}

function evidenceLabels(record) {
  const labels = new Set();
  for (const entry of record?.evidence || []) {
    for (const [label, value] of Object.entries(entry?.categories || {})) {
      if (value === true) labels.add(label);
    }
  }
  return [...labels].sort();
}

function tutorTexts(result) {
  return (result.final.dialogue || []).filter((message) => message.role === 'tutor').map((message) => message.content);
}

async function runArm({ arm, llm, verbose }) {
  let characterState = initialCharacterState({ learnerId: `learner-${arm}`, arm });
  const sceneRows = [];
  for (let i = 0; i < SCENES.length; i++) {
    const scene = SCENES[i];
    const before = characterState;
    const scenario = buildSceneScenario({ arm, scene, sceneIndex: i, characterState: before });
    const result = await runScenario(scenario, graphOptionsForArm(arm, scene));
    const closed = firstClosedRecord(result);
    const stagedFollowup = (closed?.evidence || []).length > 1;
    const firstResponseSuccess = closed?.outcome === 'success' && !stagedFollowup;
    characterState = updateCharacterStateFromEvidence(before, {
      evidence: closed?.evidence || [],
      sceneId: scene.id,
      outcome: closed?.outcome || null,
      stagedFollowup,
    });
    const row = {
      arm,
      label: ARM_CONFIG[arm].label,
      scene_id: scene.id,
      scene_index: i,
      signal: scene.signal,
      transfer: Boolean(scene.transfer),
      response_mode: scenario.responseMode,
      outcome: closed?.outcome || null,
      first_response_success: firstResponseSuccess,
      staged_followup: stagedFollowup,
      evidence_labels: evidenceLabels(closed),
      tutor_turns: tutorTexts(result).length,
      maturity_before: characterMaturityScore(before),
      maturity_after: characterMaturityScore(characterState),
      character_axes_after: characterState.axes,
      tutor_texts: tutorTexts(result),
    };
    sceneRows.push(row);
    if (verbose) {
      console.log(
        `[character] ${arm} ${scene.id}: outcome=${row.outcome} first=${row.first_response_success} staged=${row.staged_followup} maturity=${row.maturity_after}`,
      );
    }
  }
  return { arm, label: ARM_CONFIG[arm].label, final_character_state: characterState, scenes: sceneRows };
}

function aggregateArm(armResult) {
  const scenes = armResult.scenes;
  const transferScenes = scenes.filter((scene) => scene.transfer);
  return {
    label: armResult.label,
    character_state_routed: Boolean(ARM_CONFIG[armResult.arm]?.memory),
    v2_policy: Boolean(ARM_CONFIG[armResult.arm]?.v2),
    scenes: scenes.length,
    success_n: scenes.filter((scene) => scene.outcome === 'success').length,
    first_response_success_n: scenes.filter((scene) => scene.first_response_success).length,
    staged_followup_n: scenes.filter((scene) => scene.staged_followup).length,
    mature_response_n: scenes.filter((scene) => scene.response_mode === 'mature').length,
    transfer_success_n: transferScenes.filter((scene) => scene.outcome === 'success').length,
    transfer_first_response_success_n: transferScenes.filter((scene) => scene.first_response_success).length,
    final_maturity: characterMaturityScore(armResult.final_character_state),
    final_axes: armResult.final_character_state.axes,
  };
}

function aggregateReport(arms) {
  const byArm = Object.fromEntries(arms.map((armResult) => [armResult.arm, aggregateArm(armResult)]));
  return { byArm };
}

function markdownReport(report) {
  const lines = [];
  lines.push('# DAG/Resistance Character Development Experiment');
  lines.push('');
  lines.push(`Generated: ${report.generated_at}`);
  lines.push(`LLM mode: \`${report.llm_mode}\``);
  lines.push(`Scenes per arm: ${SCENES.length}`);
  lines.push('');
  lines.push('## Claim Boundary');
  lines.push('');
  lines.push(
    'This is a longitudinal simulated-learner mechanism experiment. It tests whether a compact evidence-derived character state can reduce repeated local repair across linked scenes. It is not a human learning-outcome result.',
  );
  lines.push(
    'The character-state observer is computed for every arm for comparability, but only the memory arms route that state into later learner responses.',
  );
  lines.push('');
  lines.push('## Aggregate Result');
  lines.push('');
  lines.push(
    '| arm | state routed | success | first-response success | staged follow-ups | mature first responses | transfer first-response success | final maturity |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const arm of report.arm_order) {
    const a = report.aggregates.byArm[arm];
    lines.push(
      `| ${a.label} | ${a.character_state_routed ? 'yes' : 'no'} | ${a.success_n}/${a.scenes} | ${a.first_response_success_n}/${a.scenes} | ${a.staged_followup_n}/${a.scenes} | ${a.mature_response_n}/${a.scenes} | ${a.transfer_first_response_success_n}/1 | ${a.final_maturity.toFixed(3)} |`,
    );
  }
  lines.push('');
  lines.push('## Interpretation');
  lines.push('');
  lines.push(
    '- `v2_policy_only` can repair each scene locally, but repeated staged follow-ups mean the learner is not becoming more self-directing across scenes.',
  );
  lines.push(
    '- `character_state_plus_v2` tests the desired developmental signature: later scenes should need fewer staged follow-ups and more first-response evidence because the learner carries prior evidence forward.',
  );
  lines.push(
    '- The transfer scene checks whether the character state generalizes to a novel case rather than only memorizing a single resistance signal.',
  );
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function writeArtifacts({ outDir, report }) {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'summary.json');
  const reportPath = path.join(outDir, 'report.md');
  const fixturePath = path.join(outDir, 'scenario-fixture.yaml');
  fs.writeFileSync(summaryPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(reportPath, markdownReport(report));
  fs.writeFileSync(
    fixturePath,
    yaml.stringify({
      kind: 'dag_resistance_character_development_fixture',
      world_spec: WORLD_SPEC,
      arms: ARM_CONFIG,
      scenes: SCENES,
    }),
  );
  return { summaryPath, reportPath, fixturePath };
}

export async function runCharacterDevelopmentExperiment({
  outDir = DEFAULT_OUT_DIR,
  llm = 'mock',
  provider = null,
  model = null,
  arms = ARM_ORDER,
  verbose = false,
} = {}) {
  process.env.ADAPTIVE_TUTOR_LLM = llm;
  process.env.ADAPTIVE_POLICY_MODE = 'closed_loop';
  if (llm === 'real') {
    setActiveCellConfig({ provider, modelAlias: model });
  }
  const armOrder = parseArms(Array.isArray(arms) ? arms.join(',') : arms);
  try {
    const armResults = [];
    for (const arm of armOrder) {
      armResults.push(await runArm({ arm, llm, verbose }));
    }
    const report = {
      generated_at: new Date().toISOString(),
      kind: 'dag_resistance_character_development',
      llm_mode: llm,
      provider: provider || null,
      model: model || null,
      arm_order: armOrder,
      scene_order: SCENES.map((scene) => ({ id: scene.id, signal: scene.signal, transfer: Boolean(scene.transfer) })),
      arms: armResults,
      aggregates: aggregateReport(armResults),
    };
    const artifacts = writeArtifacts({ outDir, report });
    return { report, artifacts };
  } finally {
    if (llm === 'real') clearActiveCellConfig();
  }
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    console.log(usage());
    return;
  }
  const { report, artifacts } = await runCharacterDevelopmentExperiment(opts);
  console.log('DAG/resistance character-development experiment completed');
  console.log(`llm=${report.llm_mode}`);
  console.log(`arms=${report.arm_order.join(',')}`);
  console.log(`scenes=${report.scene_order.length}`);
  for (const [arm, aggregate] of Object.entries(report.aggregates.byArm)) {
    console.log(
      `${arm}: success=${aggregate.success_n}/${aggregate.scenes} first=${aggregate.first_response_success_n}/${aggregate.scenes} staged=${aggregate.staged_followup_n}/${aggregate.scenes} maturity=${aggregate.final_maturity.toFixed(3)}`,
    );
  }
  console.log(`report=${artifacts.reportPath}`);
  console.log(`summary=${artifacts.summaryPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
