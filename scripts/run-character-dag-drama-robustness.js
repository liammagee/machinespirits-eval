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
  NEGATIVE_CONTROL_ARM_ORDER,
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
export const DEFAULT_ROBUSTNESS_FAMILIES = Object.freeze(['base']);
export const EXPANDED_ROBUSTNESS_FAMILIES = Object.freeze([
  'base',
  'ratio_series',
  'definition_boundary',
  'causal_identification',
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

export function parseFamilyList(value) {
  const families = String(value || '')
    .split(',')
    .map((item) => slug(item))
    .filter(Boolean);
  const selected = families.length ? families : [...DEFAULT_ROBUSTNESS_FAMILIES];
  const known = new Set(EXPANDED_ROBUSTNESS_FAMILIES);
  for (const family of selected) {
    if (!known.has(family)) throw new Error(`unknown robustness fixture family: ${family}`);
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

function sceneOverride(scene, overrides) {
  const override = overrides[scene.id];
  if (!override) return scene;
  return {
    ...scene,
    ...override,
    dramatic_contract: {
      ...(scene.dramatic_contract || {}),
      ...(override.dramatic_contract || {}),
    },
  };
}

function familyDescription(family) {
  switch (family) {
    case 'base':
      return 'Base Character-DAG drama fixture.';
    case 'ratio_series':
      return 'Formal ratio/series family: repeated-surface checks must turn into convergence or validity checks.';
    case 'definition_boundary':
      return 'Definition-boundary family: visual similarity must turn into criterion satisfaction and boundary testing.';
    case 'causal_identification':
      return 'Causal-identification family: correlation-style checks must turn into evidence-bearing identification tests.';
    default:
      return 'Unknown fixture family.';
  }
}

export function buildFixtureFamily(rawFixture, family = 'base') {
  const normalized = slug(family || 'base');
  const fixture = clone(rawFixture);
  if (normalized === 'base') {
    fixture.fixture_family = {
      id: 'base',
      synthetic_only: true,
      description: familyDescription('base'),
    };
    return fixture;
  }

  const overridesByFamily = {
    ratio_series: {
      worldId: 'W_CHARACTER_DAG_DRAMA_RATIO_SERIES',
      hashSuffix: 'ratio-series',
      moduleId: 'AF6_RATIO_TRANSFER',
      sceneOverrides: {
        scene_1_setup_boredom: {
          opening:
            'This ratio exercise feels like dead symbol pushing; I am just filling boxes instead of seeing why it matters.',
          dramatic_contract: {
            public_pressure: 'Learner treats ratio work as inert form filling.',
          },
        },
        scene_2_pressure_frustration: {
          opening:
            'I keep recomputing the same ratios and getting stuck; I cannot tell which smaller move would actually help.',
          dramatic_contract: {
            public_pressure: 'Learner cannot turn frustration into one executable ratio check.',
          },
        },
        scene_3_peripeteia_irrelevance: {
          opening:
            'I was using the old check that the terms repeat, but that does not tell me whether the series settles.',
          dramatic_contract: {
            public_pressure: 'Learner must turn from repeated terms to a convergence-bearing ratio check.',
            old_check: 'repeated terms settle the problem',
            new_check: 'the ratio criterion decides whether the series has a valid finite result',
          },
        },
        scene_4_consolidation_question_flood: {
          opening: 'Why ratios? Why convergence? Why not just list more terms? Which question should I answer first?',
        },
        scene_5_consolidation_rote: {
          opening: 'So I just repeat common ratio, convergence, formula? That still sounds like parroting.',
        },
        scene_6_transfer_new_case: {
          opening:
            'New ratio case: it looks patterned, but I do not yet see why the ratio check decides the actual problem.',
          transfer_contract: {
            public_prior_check: 'ratio criterion',
            required_terms: ['ratio criterion', 'common ratio check', 'convergence condition'],
          },
        },
        scene_7_transfer_boundary_case: {
          opening:
            'Similar series, but one denominator changed and I do not know what from the earlier ratio argument carries over.',
          transfer_contract: {
            public_prior_check: 'common ratio check',
            required_terms: ['common ratio check', 'ratio criterion', 'convergence condition'],
          },
        },
        scene_8_transfer_negative_case: {
          opening:
            'Another series looks analogous, but I suspect the condition that made the ratio move valid may fail here.',
          transfer_contract: {
            public_prior_check: 'convergence condition',
            required_terms: ['convergence condition', 'ratio criterion', 'common ratio check'],
          },
        },
      },
    },
    definition_boundary: {
      worldId: 'W_CHARACTER_DAG_DRAMA_DEFINITION_BOUNDARY',
      hashSuffix: 'definition-boundary',
      moduleId: 'AF6_DEFINITION_BOUNDARY',
      sceneOverrides: {
        scene_1_setup_boredom: {
          opening:
            'This classification proof feels like matching shapes on a worksheet instead of learning a criterion.',
          dramatic_contract: {
            public_pressure: 'Learner treats the definition as dead classification.',
          },
        },
        scene_2_pressure_frustration: {
          opening: 'I keep checking examples and still cannot tell the smallest definition clause to test next.',
        },
        scene_3_peripeteia_irrelevance: {
          opening:
            'I was using the old check that the examples look alike, but that does not show whether the definition is satisfied.',
          dramatic_contract: {
            public_pressure: 'Learner must turn from visual similarity to criterion satisfaction.',
            old_check: 'similar examples settle the classification',
            new_check: 'the definition clause decides whether the classification is valid',
          },
        },
        scene_4_consolidation_question_flood: {
          opening:
            'Which clause matters? Why this definition? Why not just compare examples? What is the one hinge question?',
        },
        scene_5_consolidation_rote: {
          opening: 'So I just repeat necessary, sufficient, definition, example? That still feels like labels.',
        },
        scene_6_transfer_new_case: {
          opening:
            'New example: it looks like the same class, but I do not yet know which definition clause decides it.',
          transfer_contract: {
            public_prior_check: 'definition clause',
            required_terms: ['definition clause', 'criterion clause', 'classification criterion'],
          },
        },
        scene_7_transfer_boundary_case: {
          opening:
            'Similar object, but one clause from the earlier definition might be missing, and I do not know what carries over.',
          transfer_contract: {
            public_prior_check: 'criterion clause',
            required_terms: ['criterion clause', 'definition clause', 'classification criterion'],
          },
        },
        scene_8_transfer_negative_case: {
          opening:
            'Another object looks analogous, but I suspect the condition that made the earlier classification valid may fail.',
          transfer_contract: {
            public_prior_check: 'classification criterion',
            required_terms: ['classification criterion', 'definition clause', 'criterion clause'],
          },
        },
      },
    },
    causal_identification: {
      worldId: 'W_CHARACTER_DAG_DRAMA_CAUSAL_IDENTIFICATION',
      hashSuffix: 'causal-identification',
      moduleId: 'AF6_CAUSAL_IDENTIFICATION',
      sceneOverrides: {
        scene_1_setup_boredom: {
          opening:
            'This causal graph task feels like drawing arrows to satisfy a worksheet, not like evidence for a claim.',
          dramatic_contract: {
            public_pressure: 'Learner treats causal evidence as inert arrow drawing.',
          },
        },
        scene_2_pressure_frustration: {
          opening:
            'I keep redrawing the graph and getting frustrated; I cannot find the smallest evidence check to try.',
        },
        scene_3_peripeteia_irrelevance: {
          opening:
            'I was using the old check that two variables move together, but that does not show whether the causal claim is identified.',
          dramatic_contract: {
            public_pressure: 'Learner must turn from association to an identification-bearing evidence check.',
            old_check: 'co-movement settles the causal claim',
            new_check: 'the identifying condition decides whether the causal move is valid',
          },
        },
        scene_4_consolidation_question_flood: {
          opening: 'Why causal graph? Why not correlation? Which confound matters? What single question should I test?',
        },
        scene_5_consolidation_rote: {
          opening:
            'So I just repeat confound, intervention, backdoor, identification? That still feels like parroting.',
        },
        scene_6_transfer_new_case: {
          opening:
            'New causal case: the association is visible, but I do not yet see why the identifying check decides the actual problem.',
          transfer_contract: {
            public_prior_check: 'identifying condition',
            required_terms: ['identifying condition', 'identification check', 'adjustment condition'],
          },
        },
        scene_7_transfer_boundary_case: {
          opening:
            'Similar causal setup, but one adjustment variable may be missing, and I do not know what carries over.',
          transfer_contract: {
            public_prior_check: 'adjustment condition',
            required_terms: ['adjustment condition', 'identifying condition', 'identification check'],
          },
        },
        scene_8_transfer_negative_case: {
          opening:
            'Another graph looks analogous, but I suspect the condition that made the earlier identification valid may fail here.',
          transfer_contract: {
            public_prior_check: 'identification check',
            required_terms: ['identification check', 'identifying condition', 'adjustment condition'],
          },
        },
      },
    },
  };
  const spec = overridesByFamily[normalized];
  if (!spec) throw new Error(`unknown robustness fixture family: ${normalized}`);
  fixture.version = `${fixture.version || '1.0'}+family.${normalized}`;
  fixture.world_spec = {
    ...(fixture.world_spec || {}),
    id: spec.worldId,
    module_id: spec.moduleId,
    spec_hash: `${fixture.world_spec?.spec_hash || 'sha256:unknown'}+family.${spec.hashSuffix}`,
  };
  fixture.fixture_family = {
    id: normalized,
    synthetic_only: true,
    description: familyDescription(normalized),
  };
  fixture.scenes = (fixture.scenes || []).map((scene) => sceneOverride(scene, spec.sceneOverrides));
  return fixture;
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

function writeVariantFixture({ rawFixture, family, perturbation, outDir, multiFamily = false }) {
  const familyFixture = buildFixtureFamily(rawFixture, family);
  const fixture = buildRobustnessFixture(familyFixture, perturbation);
  const fixturesDir = path.join(outDir, 'fixtures');
  fs.mkdirSync(fixturesDir, { recursive: true });
  const fixturePath = multiFamily
    ? path.join(fixturesDir, `${family}__${perturbation}.yaml`)
    : path.join(fixturesDir, `${perturbation}.yaml`);
  fs.writeFileSync(fixturePath, yaml.stringify(fixture));
  return { fixture, fixturePath };
}

function armAggregate(report, arm) {
  return report.aggregates.byArm[arm] || null;
}

function countGap(a, b, key) {
  return Number(a?.[key] || 0) - Number(b?.[key] || 0);
}

function negativeControlArmsInRun(run) {
  return NEGATIVE_CONTROL_ARM_ORDER.filter((arm) => run.byArm?.[arm]);
}

function negativeControlDiagnostics(run) {
  const full = run.byArm.full_character_dag_drama;
  return negativeControlArmsInRun(run).map((arm) => {
    const control = run.byArm[arm];
    return {
      arm,
      label: control.label,
      state_control: control.state_control || null,
      full_minus_control_first_response_n: countGap(full, control, 'first_response_success_n'),
      full_minus_control_transfer_first_n: countGap(full, control, 'transfer_first_response_success_n'),
      control_minus_full_burden_n: countGap(control, full, 'followup_or_unresolved_burden_n'),
      control_first_response: `${control.first_response_success_n}/${control.scenes}`,
      control_transfer_first_response: `${control.transfer_first_response_success_n}/${control.transfer_scene_n}`,
    };
  });
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

function summarizeRun({ family, perturbation, report, artifacts }) {
  const full = armAggregate(report, 'full_character_dag_drama');
  const policy = armAggregate(report, 'policy_only');
  const shuffled = armAggregate(report, 'shuffled_character_state');
  const summary = {
    run_id: family && family !== 'base' ? `${family}/${perturbation}` : perturbation,
    family: family || 'base',
    family_description: familyDescription(family || 'base'),
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
  summary.negative_control_diagnostics = negativeControlDiagnostics(summary);
  return summary;
}

function evaluateRobustnessGates(runs) {
  const strictRuns = runs.filter((run) => run.strict_gate_member);
  const strictFullPolicyTransferGap = strictRuns.reduce(
    (sum, run) => sum + run.decisive_gaps.full_minus_policy_transfer_first_n,
    0,
  );
  const strictControlDiagnostics = strictRuns.flatMap((run) => run.negative_control_diagnostics || []);
  const hasNegativeControls = strictControlDiagnostics.length > 0;
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
    strict_full_beats_available_negative_controls_on_first_response:
      !hasNegativeControls || strictControlDiagnostics.every((row) => row.full_minus_control_first_response_n > 0),
    strict_full_beats_available_negative_controls_on_transfer:
      !hasNegativeControls ||
      strictControlDiagnostics.every(
        (row) =>
          row.full_minus_control_transfer_first_n > 0 ||
          (row.control_transfer_first_response.endsWith('/0') && row.full_minus_control_transfer_first_n === 0),
      ),
    strict_full_reduces_available_negative_control_burden:
      !hasNegativeControls || strictControlDiagnostics.every((row) => row.control_minus_full_burden_n > 0),
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
  lines.push(`Fixture families: \`${summary.family_order.join(',')}\``);
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
    '| family | perturbation | strict | acceptance | full first | policy first | shuffled first | full-policy first gap | full-shuffled first gap | full transfer | policy transfer | burden gap vs policy | burden gap vs shuffled |',
  );
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const run of summary.runs) {
    const full = run.byArm.full_character_dag_drama;
    const policy = run.byArm.policy_only;
    const shuffled = run.byArm.shuffled_character_state;
    lines.push(
      `| ${run.family} | ${run.perturbation} | ${run.strict_gate_member ? 'yes' : 'no'} | ${run.acceptance_passed ? 'PASS' : 'FAIL'} | ${full?.first_response_success_n || 0}/${full?.scenes || 0} | ${policy?.first_response_success_n || 0}/${policy?.scenes || 0} | ${shuffled?.first_response_success_n || 0}/${shuffled?.scenes || 0} | ${run.decisive_gaps.full_minus_policy_first_response_n} | ${run.decisive_gaps.full_minus_shuffled_first_response_n} | ${full?.transfer_first_response_success_n || 0}/${full?.transfer_scene_n || 0} | ${policy?.transfer_first_response_success_n || 0}/${policy?.transfer_scene_n || 0} | ${run.decisive_gaps.policy_minus_full_burden_n} | ${run.decisive_gaps.shuffled_minus_full_burden_n} |`,
    );
  }
  const controlRows = summary.runs.flatMap((run) =>
    (run.negative_control_diagnostics || []).map((row) => ({
      ...row,
      family: run.family,
      perturbation: run.perturbation,
    })),
  );
  if (controlRows.length) {
    lines.push('');
    lines.push('## Stronger Negative Controls');
    lines.push('');
    lines.push(
      '| family | perturbation | control | state control | control first | full-control first gap | control transfer | full-control transfer gap | control-full burden gap |',
    );
    lines.push('|---|---|---|---|---:|---:|---:|---:|---:|');
    for (const row of controlRows) {
      lines.push(
        `| ${row.family} | ${row.perturbation} | ${row.arm} | ${row.state_control || '-'} | ${row.control_first_response} | ${row.full_minus_control_first_response_n} | ${row.control_transfer_first_response} | ${row.full_minus_control_transfer_first_n} | ${row.control_minus_full_burden_n} |`,
      );
    }
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
  lines.push(
    '- Core artifacts are kept under `runs/<perturbation>/` for base-only runs and `runs/<family>/<perturbation>/` for multi-family runs.',
  );
  return `${lines.join('\n')}\n`;
}

function buildClaimAudit(summary) {
  const stateDependent = summary.runs.filter((run) => run.perturbation === 'state_dependent_transfer');
  const allRunsPassed = summary.runs.every((run) => run.acceptance_passed);
  const leakFree =
    summary.robustness_gates.all_perturbations_no_target_evidence_label_leak === true &&
    summary.robustness_gates.all_perturbations_no_public_theory_or_process_leak === true;
  return {
    status: summary.robustness_passed
      ? 'synthetic_apparatus_claim_supported'
      : 'synthetic_apparatus_claim_not_supported',
    claim_boundary: {
      allowed: [
        'Within this synthetic harness, proof-DAG transitions, resistance routing, peripeteia pressure, and matched character-state routing can be coordinated as one adaptation policy layer.',
        'Matched character-state routing can separate from policy-only and wrong-state controls on synthetic transfer scenes when the strict gates pass.',
        'The artifacts support benchmark-design and apparatus claims, not learning-outcome claims.',
      ],
      disallowed: [
        'Human learning improved.',
        'The learner underwent real interior character development.',
        'The tutor is deployment-ready or generally reliable.',
        'The result proves a general adaptive subject rather than a synthetic policy-layer mechanism.',
      ],
    },
    evidence_summary: {
      robustness_passed: summary.robustness_passed,
      perturbation_count: summary.runs.length,
      family_count: summary.family_order.length,
      all_runs_acceptance_passed: allRunsPassed,
      leak_free: leakFree,
      state_dependent_transfer: stateDependent.map((run) => ({
        family: run.family,
        full_transfer: `${run.byArm.full_character_dag_drama.transfer_first_response_success_n}/${run.byArm.full_character_dag_drama.transfer_scene_n}`,
        policy_transfer: `${run.byArm.policy_only.transfer_first_response_success_n}/${run.byArm.policy_only.transfer_scene_n}`,
        shuffled_transfer: `${run.byArm.shuffled_character_state.transfer_first_response_success_n}/${run.byArm.shuffled_character_state.transfer_scene_n}`,
      })),
    },
    required_next_evidence_for_stronger_claims: [
      'Run larger preregistered synthetic fixture families rather than perturbations of one fixture.',
      'Use human learner pilot outcomes for learning, transfer, and false-personalization measures.',
      'Preserve stale/overconfident/compressed state controls in any promoted benchmark.',
      'Keep public-safe state summaries auditable and forbid target evidence labels in learner-visible context.',
    ],
  };
}

function markdownClaimAudit(summary) {
  const audit = summary.claim_audit;
  const lines = [];
  lines.push('# Character-DAG Drama Claim Audit');
  lines.push('');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push(`Status: \`${audit.status}\``);
  lines.push('');
  lines.push('## Allowed Claims');
  lines.push('');
  for (const claim of audit.claim_boundary.allowed) lines.push(`- ${claim}`);
  lines.push('');
  lines.push('## Disallowed Claims');
  lines.push('');
  for (const claim of audit.claim_boundary.disallowed) lines.push(`- ${claim}`);
  lines.push('');
  lines.push('## Evidence Snapshot');
  lines.push('');
  lines.push(`- Robustness passed: ${audit.evidence_summary.robustness_passed ? 'yes' : 'no'}`);
  lines.push(`- Fixture families: ${audit.evidence_summary.family_count}`);
  lines.push(`- Perturbation-family runs: ${audit.evidence_summary.perturbation_count}`);
  lines.push(`- Leak-free: ${audit.evidence_summary.leak_free ? 'yes' : 'no'}`);
  if (audit.evidence_summary.state_dependent_transfer.length) {
    lines.push('');
    lines.push('| family | full transfer | policy transfer | shuffled transfer |');
    lines.push('|---|---:|---:|---:|');
    for (const row of audit.evidence_summary.state_dependent_transfer) {
      lines.push(`| ${row.family} | ${row.full_transfer} | ${row.policy_transfer} | ${row.shuffled_transfer} |`);
    }
  }
  lines.push('');
  lines.push('## Required Next Evidence');
  lines.push('');
  for (const item of audit.required_next_evidence_for_stronger_claims) lines.push(`- ${item}`);
  return `${lines.join('\n')}\n`;
}

function buildHumanPilotHypotheses(_summary) {
  return [
    {
      id: 'hp1_state_conditioned_transfer',
      hypothesis:
        'After a public evidence-derived state summary, human learners will produce higher first-attempt transfer explanations than learners receiving policy-only repair.',
      synthetic_source: 'state_dependent_transfer full-vs-policy split',
      human_measure: 'Held-out transfer item scored for rationale, boundary condition, and evidence check.',
      safety_boundary: 'Do not personalize beyond public learner work; no hidden trait inference.',
    },
    {
      id: 'hp2_wrong_state_harms_transfer',
      hypothesis:
        'Stale, overconfident, or mismatched state summaries will reduce transfer quality or increase blind analogy relative to matched public state.',
      synthetic_source: 'shuffled/stale/overconfident/compressed negative controls',
      human_measure: 'Transfer answer plus false-confidence and perceived-fit survey items.',
      safety_boundary: 'Expose the state summary as a tutor memory aid, not as a diagnosis of the learner.',
    },
    {
      id: 'hp3_peripeteia_relevance_pivot',
      hypothesis:
        'A tutor move that helps learners replace a surface check with a task-relevance check will improve explanation quality on near-transfer tasks.',
      synthetic_source: 'required peripeteia scenes and public-signature observer',
      human_measure: 'Pre/post coding for old-check rejection, new-check articulation, and task relevance.',
      safety_boundary:
        'Treat struggle as optional productive difficulty; allow opt-out and repair affective frustration.',
    },
    {
      id: 'hp4_burden_reduction_without_overclaim',
      hypothesis:
        'Matched public state should reduce repeated follow-up prompts without increasing leakage, over-directiveness, or learner dependence.',
      synthetic_source: 'staged-followup-or-unresolved burden gap',
      human_measure:
        'Number of tutor follow-ups, learner-owned next move, NASA-TLX-style burden, and short trust calibration.',
      safety_boundary: 'No claim of character development unless independent longitudinal human evidence supports it.',
    },
  ];
}

function markdownHumanPilotHypotheses(summary) {
  const lines = [];
  lines.push('# Human-Pilot Hypotheses from Character-DAG Drama Robustness');
  lines.push('');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push('');
  lines.push(
    'These hypotheses translate the synthetic apparatus result into possible human-learner pilot tests. They are not conclusions from the synthetic run.',
  );
  for (const hypothesis of summary.human_pilot_hypotheses) {
    lines.push('');
    lines.push(`## ${hypothesis.id}`);
    lines.push('');
    lines.push(`- Hypothesis: ${hypothesis.hypothesis}`);
    lines.push(`- Synthetic source: ${hypothesis.synthetic_source}`);
    lines.push(`- Human measure: ${hypothesis.human_measure}`);
    lines.push(`- Safety boundary: ${hypothesis.safety_boundary}`);
  }
  return `${lines.join('\n')}\n`;
}

function writeRobustnessArtifacts({ outDir, summary }) {
  fs.mkdirSync(outDir, { recursive: true });
  const summaryPath = path.join(outDir, 'robustness-summary.json');
  const reportPath = path.join(outDir, 'robustness-report.md');
  const claimAuditPath = path.join(outDir, 'claim-audit.md');
  const humanPilotHypothesesPath = path.join(outDir, 'human-pilot-hypotheses.md');
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(reportPath, markdownRobustnessReport(summary));
  fs.writeFileSync(claimAuditPath, markdownClaimAudit(summary));
  fs.writeFileSync(humanPilotHypothesesPath, markdownHumanPilotHypotheses(summary));
  return { summaryPath, reportPath, claimAuditPath, humanPilotHypothesesPath };
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
  families = null,
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
  const familyOrder = Array.isArray(families) ? families.map(slug) : parseFamilyList(families);
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
  const multiFamily = familyOrder.length > 1 || familyOrder[0] !== 'base';
  for (const family of familyOrder) {
    for (const perturbation of perturbationOrder) {
      const { fixturePath: variantFixturePath } = writeVariantFixture({
        rawFixture,
        family,
        perturbation,
        outDir,
        multiFamily,
      });
      const runOutDir = multiFamily
        ? path.join(outDir, 'runs', family, perturbation)
        : path.join(outDir, 'runs', perturbation);
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
      runs.push(summarizeRun({ family, perturbation, report, artifacts }));
    }
  }
  const robustnessGates = evaluateRobustnessGates(runs);
  const summary = {
    generated_at: new Date().toISOString(),
    kind: 'character_dag_drama_robustness',
    fixture_path: fixture.path,
    llm_mode: llmMode,
    learner_mode: normalizedLearnerMode,
    seed_count: seedCount,
    family_order: familyOrder,
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
  summary.claim_audit = buildClaimAudit(summary);
  summary.human_pilot_hypotheses = buildHumanPilotHypotheses(summary);
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
    families: null,
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
    else if (arg === '--families') opts.families = argv[++i];
    else if (arg.startsWith('--families=')) opts.families = arg.slice('--families='.length);
    else if (arg === '--expanded-families') opts.families = EXPANDED_ROBUSTNESS_FAMILIES.join(',');
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
    '  --families A,B,C            Default: base. Known: base,ratio_series,definition_boundary,causal_identification',
    '  --expanded-families         Alias for all known fixture families',
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
  console.log(`families=${summary.family_order.join(',')}`);
  console.log(`arms=${summary.arm_order.join(',')}`);
  console.log(`perturbations=${summary.perturbation_order.join(',')}`);
  for (const run of summary.runs) {
    const full = run.byArm.full_character_dag_drama;
    const policy = run.byArm.policy_only;
    const shuffled = run.byArm.shuffled_character_state;
    console.log(
      `${run.run_id || run.perturbation}: acceptance=${run.acceptance_passed ? 'PASS' : 'FAIL'} full_first=${full?.first_response_success_n || 0}/${full?.scenes || 0} policy_first=${policy?.first_response_success_n || 0}/${policy?.scenes || 0} shuffled_first=${shuffled?.first_response_success_n || 0}/${shuffled?.scenes || 0}`,
    );
  }
  console.log(`robustness=${summary.robustness_passed ? 'PASS' : 'FAIL'}`);
  console.log(`report=${artifacts.reportPath}`);
  console.log(`summary=${artifacts.summaryPath}`);
  console.log(`claim_audit=${artifacts.claimAuditPath}`);
  console.log(`human_pilot_hypotheses=${artifacts.humanPilotHypothesesPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.stack || err.message);
    process.exit(1);
  });
}
