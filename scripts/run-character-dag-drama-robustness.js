#!/usr/bin/env node
// Robustness wrapper for the synthetic Character-DAG drama framework.
//
// This keeps the core benchmark unchanged and runs deterministic fixture
// perturbations through the same artifact-producing runner.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import yaml from 'yaml';
import {
  DEFAULT_ARM_ORDER,
  DEFAULT_FIXTURE_PATH,
  FRAMEWORK_OBSERVER_VERSION,
  LLM_MODES,
  LEARNER_MODES,
  loadFrameworkFixture,
  parseSeedCount,
  runCharacterDagDramaFramework,
} from './run-character-dag-drama-framework.js';

export const DEFAULT_ROBUSTNESS_OUT_DIR = 'exports/character-dag-drama-framework-robustness';
export const DEFAULT_ROBUSTNESS_PERTURBATIONS = Object.freeze([
  'baseline',
  'noisy_openings',
  'harder_transfer',
  'state_dependent_transfer',
  'shuffled_scene_order',
]);
export const STRICT_ROBUSTNESS_PERTURBATIONS = Object.freeze([
  'baseline',
  'noisy_openings',
  'harder_transfer',
  'state_dependent_transfer',
]);
export const STRICT_FULL_FIRST_RESPONSE_RATE_FLOOR = 0.5;
export const STRICT_FULL_TRANSFER_FIRST_RESPONSE_RATE_FLOOR = 0.5;
export const STRICT_FULL_POLICY_FIRST_RESPONSE_MARGIN_FLOOR = 2;
export const STRICT_FULL_POLICY_TRANSFER_MARGIN_FLOOR = 2;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function rate(n, d) {
  return d ? Number((n / d).toFixed(3)) : 0;
}

export function parsePerturbationList(value) {
  const perturbations = String(value || '')
    .split(',')
    .map((item) => slug(item))
    .filter(Boolean);
  const selected = perturbations.length ? perturbations : [...DEFAULT_ROBUSTNESS_PERTURBATIONS];
  const known = new Set(DEFAULT_ROBUSTNESS_PERTURBATIONS);
  for (const perturbation of selected) {
    if (!known.has(perturbation)) throw new Error(`unknown robustness perturbation: ${perturbation}`);
  }
  return [...new Set(selected)];
}

function deterministicSceneShuffle(scenes) {
  const out = [];
  const seen = new Set();
  const step = scenes.length % 2 === 0 ? scenes.length - 3 : scenes.length - 2;
  let cursor = Math.floor(scenes.length / 2) - 1;
  while (out.length < scenes.length) {
    const index = ((cursor % scenes.length) + scenes.length) % scenes.length;
    if (!seen.has(index)) {
      seen.add(index);
      out.push(clone(scenes[index]));
    }
    cursor += step;
  }
  return out;
}

function noisyOpening(opening) {
  return [
    'I may be mixing two ideas and I am not sure which detail matters.',
    String(opening || ''),
    'I can try, but the route feels a little muddy.',
  ].join(' ');
}

function harderTransferOpening(scene) {
  if (!scene.transfer) return scene.opening;
  return [
    String(scene.opening || ''),
    'The previous solution looked similar, but one assumption may have moved, so a copied route could be misleading.',
    'I need to decide what carries over before trusting the move.',
  ].join(' ');
}

function stateDependentTransferOpening(scene) {
  if (!scene.transfer) return scene.opening;
  const openings = {
    scene_6_transfer_new_case:
      'This reminds me of earlier work, but I cannot reconstruct what from that work matters now without falling back into copying.',
    scene_7_transfer_boundary_case:
      'This feels close to a previous boundary case, but I cannot tell which part of the old work should guide me here.',
    scene_8_transfer_negative_case:
      'The old route is tempting, but I cannot tell from the surface similarity whether I should trust it here.',
  };
  return openings[scene.id] || 'This feels related to earlier work, but I cannot tell what should guide the next move.';
}

export function buildRobustnessFixture(rawFixture, perturbation) {
  const fixture = clone(rawFixture);
  const normalized = slug(perturbation || 'baseline');
  fixture.version = `${fixture.version || '1.0'}+robustness.${normalized}`;
  fixture.world_spec = fixture.world_spec || {};
  fixture.world_spec.spec_hash = `${fixture.world_spec.spec_hash || 'unknown'}+robustness.${normalized}`;
  fixture.robustness_perturbation = {
    id: normalized,
    synthetic_only: true,
    description: robustnessDescription(normalized),
  };

  if (normalized === 'baseline') return fixture;

  if (normalized === 'noisy_openings') {
    fixture.scenes = (fixture.scenes || []).map((scene) => ({
      ...scene,
      opening: noisyOpening(scene.opening),
    }));
    return fixture;
  }

  if (normalized === 'harder_transfer') {
    fixture.scenes = (fixture.scenes || []).map((scene) => ({
      ...scene,
      opening: harderTransferOpening(scene),
    }));
    return fixture;
  }

  if (normalized === 'state_dependent_transfer') {
    fixture.scenes = (fixture.scenes || []).map((scene) => ({
      ...scene,
      opening: stateDependentTransferOpening(scene),
      dramatic_contract: scene.transfer
        ? {
            ...(scene.dramatic_contract || {}),
            public_pressure:
              'Learner must recover the prior relevance-check habit without the opening naming the decisive condition.',
          }
        : scene.dramatic_contract,
    }));
    return fixture;
  }

  if (normalized === 'shuffled_scene_order') {
    fixture.scenes = deterministicSceneShuffle(fixture.scenes || []);
    return fixture;
  }

  throw new Error(`unknown robustness perturbation: ${normalized}`);
}

function robustnessDescription(perturbation) {
  switch (perturbation) {
    case 'baseline':
      return 'Unmodified fixture, used as the locked reference condition.';
    case 'noisy_openings':
      return 'Adds learner uncertainty and mild wording noise to every opening stance.';
    case 'harder_transfer':
      return 'Adds explicit analogy-boundary pressure to transfer scenes.';
    case 'state_dependent_transfer':
      return 'Makes transfer scenes depend on matched prior character state by removing condition-level hints from the opening.';
    case 'shuffled_scene_order':
      return 'Runs the same scenes in deterministic shuffled order to stress dependence on arc sequencing.';
    default:
      return 'Unknown robustness perturbation.';
  }
}

function writeVariantFixture({ rawFixture, perturbation, outDir }) {
  const fixture = buildRobustnessFixture(rawFixture, perturbation);
  const fixturesDir = path.join(outDir, 'fixtures');
  fs.mkdirSync(fixturesDir, { recursive: true });
  const fixturePath = path.join(fixturesDir, `${perturbation}.yaml`);
  fs.writeFileSync(fixturePath, yaml.stringify(fixture));
  return { fixture, fixturePath };
}

function armAggregate(report, arm) {
  return report.aggregates.byArm[arm] || null;
}

function countGap(a, b, key) {
  return Number(a?.[key] || 0) - Number(b?.[key] || 0);
}

function compactDiagnosticAudit(report) {
  const audit = report.aggregates.diagnostic_audit || {
    failed_acceptance_gates: [],
    scene_issue_n: 0,
    issue_counts: {},
    scene_issues: [],
  };
  return {
    observer_version: report.observer?.version || null,
    reanalyze_existing: report.observer?.reanalyze_existing === true,
    failed_acceptance_gates: audit.failed_acceptance_gates || [],
    scene_issue_n: audit.scene_issue_n || 0,
    issue_counts: audit.issue_counts || {},
    sample_scene_issues: (audit.scene_issues || []).slice(0, 12),
  };
}

function summarizeRun({ perturbation, report, artifacts }) {
  const full = armAggregate(report, 'full_character_dag_drama');
  const policy = armAggregate(report, 'policy_only');
  const shuffled = armAggregate(report, 'shuffled_character_state');
  return {
    perturbation,
    description: robustnessDescription(perturbation),
    strict_gate_member: STRICT_ROBUSTNESS_PERTURBATIONS.includes(perturbation),
    acceptance_passed: report.aggregates.acceptance_passed,
    acceptance_gates: report.aggregates.acceptance_gates,
    artifacts,
    arm_order: report.arm_order,
    byArm: report.aggregates.byArm,
    diagnostic_audit: compactDiagnosticAudit(report),
    decisive_gaps: {
      full_minus_policy_first_response_n: countGap(full, policy, 'first_response_success_n'),
      full_minus_shuffled_first_response_n: countGap(full, shuffled, 'first_response_success_n'),
      policy_minus_full_burden_n: countGap(policy, full, 'followup_or_unresolved_burden_n'),
      shuffled_minus_full_burden_n: countGap(shuffled, full, 'followup_or_unresolved_burden_n'),
      full_minus_policy_transfer_first_n: countGap(full, policy, 'transfer_first_response_success_n'),
      full_minus_shuffled_transfer_first_n: countGap(full, shuffled, 'transfer_first_response_success_n'),
    },
    rates: {
      full_first_response: rate(full?.first_response_success_n || 0, full?.scenes || 0),
      policy_first_response: rate(policy?.first_response_success_n || 0, policy?.scenes || 0),
      shuffled_first_response: rate(shuffled?.first_response_success_n || 0, shuffled?.scenes || 0),
      full_transfer_first_response: rate(full?.transfer_first_response_success_n || 0, full?.transfer_scene_n || 0),
      policy_transfer_first_response: rate(
        policy?.transfer_first_response_success_n || 0,
        policy?.transfer_scene_n || 0,
      ),
      shuffled_transfer_first_response: rate(
        shuffled?.transfer_first_response_success_n || 0,
        shuffled?.transfer_scene_n || 0,
      ),
    },
  };
}

function evaluateRobustnessGates(runs) {
  const strictRuns = runs.filter((run) => run.strict_gate_member);
  const strictFullPolicyTransferGap = strictRuns.reduce(
    (sum, run) => sum + run.decisive_gaps.full_minus_policy_transfer_first_n,
    0,
  );
  return {
    strict_perturbations_acceptance_passed: strictRuns.every((run) => run.acceptance_passed),
    all_perturbations_no_target_evidence_label_leak: runs.every(
      (run) => run.acceptance_gates.no_target_evidence_label_leak,
    ),
    all_perturbations_no_public_theory_or_process_leak: runs.every(
      (run) => run.acceptance_gates.no_public_theory_or_process_leak,
    ),
    strict_full_beats_policy_on_first_response: strictRuns.every(
      (run) => run.decisive_gaps.full_minus_policy_first_response_n > 0,
    ),
    strict_full_beats_shuffled_on_first_response: strictRuns.every(
      (run) => run.decisive_gaps.full_minus_shuffled_first_response_n > 0,
    ),
    strict_full_reduces_policy_burden: strictRuns.every((run) => run.decisive_gaps.policy_minus_full_burden_n > 0),
    strict_full_reduces_shuffled_burden: strictRuns.every((run) => run.decisive_gaps.shuffled_minus_full_burden_n > 0),
    strict_full_transfer_stronger_or_policy_ceiling_matched: strictRuns.every(
      (run) => run.acceptance_gates.full_transfer_stronger_or_policy_ceiling_matched === true,
    ),
    strict_full_first_response_rate_floor: strictRuns.every(
      (run) => run.rates.full_first_response >= STRICT_FULL_FIRST_RESPONSE_RATE_FLOOR,
    ),
    strict_full_transfer_first_response_rate_floor: strictRuns.every(
      (run) => run.rates.full_transfer_first_response >= STRICT_FULL_TRANSFER_FIRST_RESPONSE_RATE_FLOOR,
    ),
    strict_full_policy_first_response_margin_floor: strictRuns.every(
      (run) => run.decisive_gaps.full_minus_policy_first_response_n >= STRICT_FULL_POLICY_FIRST_RESPONSE_MARGIN_FLOOR,
    ),
    strict_full_policy_transfer_margin_floor:
      strictRuns.length === 0 || strictFullPolicyTransferGap >= STRICT_FULL_POLICY_TRANSFER_MARGIN_FLOOR,
  };
}

function markdownRobustnessReport(summary) {
  const lines = [];
  lines.push('# Character-DAG Drama Robustness Report');
  lines.push('');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push(`Fixture: \`${summary.fixture_path}\``);
  lines.push(`LLM mode: \`${summary.llm_mode}\``);
  lines.push(`Learner mode: \`${summary.learner_mode}\``);
  lines.push(`Seeds per perturbation: ${summary.seed_count}`);
  lines.push(`Arms: \`${summary.arm_order.join(',')}\``);
  lines.push(`Observer version: \`${summary.observer.framework_observer_version}\``);
  lines.push(
    `Robustness floors: full first-response >= ${summary.thresholds.full_first_response_rate_floor}, full transfer first-response >= ${summary.thresholds.full_transfer_first_response_rate_floor}`,
  );
  lines.push(
    `Robustness margins: per-perturbation full-policy first-response gap >= ${summary.thresholds.full_policy_first_response_margin_floor}, aggregate strict full-policy transfer gap >= ${summary.thresholds.full_policy_transfer_margin_floor}`,
  );
  lines.push('');
  lines.push('## Boundary');
  lines.push('');
  lines.push(
    'This is a synthetic-only robustness screen. It tests whether the existing framework result is stable under deterministic fixture perturbations; it does not claim human learning or real interior change.',
  );
  lines.push('');
  lines.push('## Perturbation Results');
  lines.push('');
  lines.push(
    '| perturbation | strict | acceptance | full first | policy first | shuffled first | full-policy first gap | full-shuffled first gap | full transfer | policy transfer | burden gap vs policy | burden gap vs shuffled |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const run of summary.runs) {
    const full = run.byArm.full_character_dag_drama;
    const policy = run.byArm.policy_only;
    const shuffled = run.byArm.shuffled_character_state;
    lines.push(
      `| ${run.perturbation} | ${run.strict_gate_member ? 'yes' : 'no'} | ${run.acceptance_passed ? 'PASS' : 'FAIL'} | ${full?.first_response_success_n || 0}/${full?.scenes || 0} | ${policy?.first_response_success_n || 0}/${policy?.scenes || 0} | ${shuffled?.first_response_success_n || 0}/${shuffled?.scenes || 0} | ${run.decisive_gaps.full_minus_policy_first_response_n} | ${run.decisive_gaps.full_minus_shuffled_first_response_n} | ${full?.transfer_first_response_success_n || 0}/${full?.transfer_scene_n || 0} | ${policy?.transfer_first_response_success_n || 0}/${policy?.transfer_scene_n || 0} | ${run.decisive_gaps.policy_minus_full_burden_n} | ${run.decisive_gaps.shuffled_minus_full_burden_n} |`,
    );
  }
  lines.push('');
  lines.push('## Robustness Gates');
  lines.push('');
  for (const [gate, passed] of Object.entries(summary.robustness_gates)) {
    lines.push(`- ${gate}: ${passed ? 'PASS' : 'FAIL'}`);
  }
  lines.push('');
  lines.push(`Overall robustness status: ${summary.robustness_passed ? 'PASS' : 'FAIL'}`);
  lines.push('');
  lines.push('## Diagnostic Audit');
  lines.push('');
  for (const run of summary.runs) {
    const audit = run.diagnostic_audit;
    const failed = audit.failed_acceptance_gates.length ? audit.failed_acceptance_gates.join(', ') : 'none';
    const issueCounts = Object.entries(audit.issue_counts)
      .sort()
      .map(([issue, count]) => `${issue}=${count}`)
      .join(', ');
    lines.push(
      `- ${run.perturbation}: failed_gates=${failed}; scene_issues=${audit.scene_issue_n}; issue_counts=${issueCounts || 'none'}`,
    );
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(`- Selected strict perturbations are \`${summary.strict_perturbations.join('`, `') || 'none'}\`.`);
  lines.push(
    '- `shuffled_scene_order` is diagnostic: it stresses dependence on arc sequencing and is not required to preserve the original acceptance result.',
  );
  lines.push('- All per-perturbation core artifacts are kept under `runs/<perturbation>/`.');
  return `${lines.join('\n')}\n`;
}

function writeRobustnessArtifacts({ outDir, summary }) {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'robustness-summary.json');
  const reportPath = path.join(outDir, 'robustness-report.md');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(reportPath, markdownRobustnessReport(summary));
  return { summaryPath, reportPath };
}

export async function runCharacterDagDramaRobustness({
  fixturePath = DEFAULT_FIXTURE_PATH,
  outDir = DEFAULT_ROBUSTNESS_OUT_DIR,
  llm = 'mock',
  provider = null,
  model = null,
  arms = ['policy_only', 'full_character_dag_drama', 'shuffled_character_state'],
  learnerMode = 'llm',
  seeds = 3,
  perturbations = null,
  verbose = false,
  checkpoint = null,
  resume = false,
  reanalyzeExisting = false,
} = {}) {
  const llmMode = String(llm || 'mock').toLowerCase();
  const normalizedLearnerMode = String(learnerMode || 'llm').toLowerCase();
  if (!LLM_MODES.includes(llmMode)) throw new Error(`llm must be mock or real (got ${llm})`);
  if (!LEARNER_MODES.includes(normalizedLearnerMode)) {
    throw new Error(`learnerMode must be scripted or llm (got ${learnerMode})`);
  }
  const seedCount = parseSeedCount(seeds);
  const fixture = loadFrameworkFixture(fixturePath);
  const rawFixture = fixture.raw;
  const perturbationOrder = Array.isArray(perturbations)
    ? perturbations.map(slug)
    : parsePerturbationList(perturbations);
  const armOrder = Array.isArray(arms)
    ? arms
    : String(arms || '')
        .split(',')
        .map((arm) => arm.trim())
        .filter(Boolean);
  const selectedArms = armOrder.length ? armOrder : [...DEFAULT_ARM_ORDER];
  const runs = [];
  for (const perturbation of perturbationOrder) {
    const { fixturePath: variantFixturePath } = writeVariantFixture({
      rawFixture,
      perturbation,
      outDir,
    });
    const runOutDir = path.join(outDir, 'runs', perturbation);
    const { report, artifacts } = await runCharacterDagDramaFramework({
      fixturePath: variantFixturePath,
      outDir: runOutDir,
      llm: llmMode,
      provider,
      model,
      arms: selectedArms,
      learnerMode: normalizedLearnerMode,
      seeds: seedCount,
      verbose,
      checkpoint,
      resume,
      reanalyzeExisting,
    });
    runs.push(summarizeRun({ perturbation, report, artifacts }));
  }
  const robustnessGates = evaluateRobustnessGates(runs);
  const summary = {
    generated_at: new Date().toISOString(),
    kind: 'character_dag_drama_robustness',
    fixture_path: fixture.path,
    llm_mode: llmMode,
    learner_mode: normalizedLearnerMode,
    seed_count: seedCount,
    arm_order: selectedArms,
    perturbation_order: perturbationOrder,
    strict_perturbations: STRICT_ROBUSTNESS_PERTURBATIONS.filter((perturbation) =>
      perturbationOrder.includes(perturbation),
    ),
    thresholds: {
      full_first_response_rate_floor: STRICT_FULL_FIRST_RESPONSE_RATE_FLOOR,
      full_transfer_first_response_rate_floor: STRICT_FULL_TRANSFER_FIRST_RESPONSE_RATE_FLOOR,
      full_policy_first_response_margin_floor: STRICT_FULL_POLICY_FIRST_RESPONSE_MARGIN_FLOOR,
      full_policy_transfer_margin_floor: STRICT_FULL_POLICY_TRANSFER_MARGIN_FLOOR,
    },
    observer: {
      framework_observer_version: FRAMEWORK_OBSERVER_VERSION,
      reanalyze_existing: Boolean(reanalyzeExisting),
    },
    robustness_gates: robustnessGates,
    robustness_passed: Object.values(robustnessGates).every(Boolean),
    runs,
  };
  const artifacts = writeRobustnessArtifacts({ outDir, summary });
  return { summary, artifacts };
}

function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    fixturePath: DEFAULT_FIXTURE_PATH,
    outDir: DEFAULT_ROBUSTNESS_OUT_DIR,
    llm: 'mock',
    provider: null,
    model: null,
    arms: 'policy_only,full_character_dag_drama,shuffled_character_state',
    learnerMode: 'llm',
    seeds: 3,
    perturbations: null,
    verbose: false,
    checkpoint: null,
    resume: false,
    reanalyzeExisting: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--fixture') opts.fixturePath = argv[++i];
    else if (arg.startsWith('--fixture=')) opts.fixturePath = arg.slice('--fixture='.length);
    else if (arg === '--out-dir') opts.outDir = argv[++i];
    else if (arg.startsWith('--out-dir=')) opts.outDir = arg.slice('--out-dir='.length);
    else if (arg === '--llm') opts.llm = argv[++i];
    else if (arg.startsWith('--llm=')) opts.llm = arg.slice('--llm='.length);
    else if (arg === '--provider') opts.provider = argv[++i];
    else if (arg.startsWith('--provider=')) opts.provider = arg.slice('--provider='.length);
    else if (arg === '--model') opts.model = argv[++i];
    else if (arg.startsWith('--model=')) opts.model = arg.slice('--model='.length);
    else if (arg === '--arms') opts.arms = argv[++i];
    else if (arg.startsWith('--arms=')) opts.arms = arg.slice('--arms='.length);
    else if (arg === '--learner-mode') opts.learnerMode = argv[++i];
    else if (arg.startsWith('--learner-mode=')) opts.learnerMode = arg.slice('--learner-mode='.length);
    else if (arg === '--seeds') opts.seeds = argv[++i];
    else if (arg.startsWith('--seeds=')) opts.seeds = arg.slice('--seeds='.length);
    else if (arg === '--perturbations') opts.perturbations = argv[++i];
    else if (arg.startsWith('--perturbations=')) opts.perturbations = arg.slice('--perturbations='.length);
    else if (arg === '--verbose') opts.verbose = true;
    else if (arg === '--checkpoint') opts.checkpoint = true;
    else if (arg === '--no-checkpoint') opts.checkpoint = false;
    else if (arg === '--resume') {
      opts.resume = true;
      if (opts.checkpoint == null) opts.checkpoint = true;
    } else if (arg === '--reanalyze-existing') {
      opts.reanalyzeExisting = true;
      opts.resume = true;
      if (opts.checkpoint == null) opts.checkpoint = true;
    } else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function usage() {
  return [
    'Usage: node scripts/run-character-dag-drama-robustness.js [options]',
    '',
    'Runs deterministic robustness perturbations for the synthetic Character-DAG drama framework.',
    '',
    'Options:',
    '  --fixture FILE              Default: config/character-dag-drama-framework.yaml',
    '  --llm mock|real             Default: mock',
    '  --provider NAME             Real backend provider override',
    '  --model ALIAS_OR_ID         Real backend model override',
    '  --learner-mode MODE         scripted or llm. Default: llm',
    '  --seeds N                  Repeat each perturbation N times per arm. Default: 3',
    '  --arms A,B,C               Default: policy_only,full_character_dag_drama,shuffled_character_state',
    '  --perturbations A,B,C       Default: baseline,noisy_openings,harder_transfer,state_dependent_transfer,shuffled_scene_order',
    '  --out-dir DIR              Default: exports/character-dag-drama-framework-robustness',
    '  --checkpoint               Write checkpoints in each perturbation run',
    '  --no-checkpoint            Disable checkpointing',
    '  --resume                   Resume each perturbation from its run checkpoint',
    '  --reanalyze-existing       Re-score stored checkpoint rows without new LLM calls',
    '  --verbose                  Print scene-level progress',
  ].join('\n');
}

async function main() {
  const opts = parseArgs();
  if (opts.help) {
    console.log(usage());
    return;
  }
  const { summary, artifacts } = await runCharacterDagDramaRobustness(opts);
  console.log('Character-DAG drama robustness completed');
  console.log(`llm=${summary.llm_mode}`);
  console.log(`learner_mode=${summary.learner_mode}`);
  console.log(`seeds=${summary.seed_count}`);
  console.log(`arms=${summary.arm_order.join(',')}`);
  console.log(`perturbations=${summary.perturbation_order.join(',')}`);
  for (const run of summary.runs) {
    const full = run.byArm.full_character_dag_drama;
    const policy = run.byArm.policy_only;
    const shuffled = run.byArm.shuffled_character_state;
    console.log(
      `${run.perturbation}: acceptance=${run.acceptance_passed ? 'PASS' : 'FAIL'} full_first=${full?.first_response_success_n || 0}/${full?.scenes || 0} policy_first=${policy?.first_response_success_n || 0}/${policy?.scenes || 0} shuffled_first=${shuffled?.first_response_success_n || 0}/${shuffled?.scenes || 0}`,
    );
  }
  console.log(`robustness=${summary.robustness_passed ? 'PASS' : 'FAIL'}`);
  console.log(`report=${artifacts.reportPath}`);
  console.log(`summary=${artifacts.summaryPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
