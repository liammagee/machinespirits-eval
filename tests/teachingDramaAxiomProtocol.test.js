import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';
import {
  classifyCardVerdict,
  validateTeachingDramaAxiomProtocol,
} from '../scripts/validate-teaching-drama-axiom-protocol.js';
import {
  baselineSummary,
  denominatorSummary,
  renderMarkdown,
} from '../scripts/report-teaching-drama-axiom-framework.js';
import { materializeAttemptFixtures } from '../scripts/materialize-teaching-drama-axiom-attempts.js';
import {
  adjudicateTeachingDramaAxiomCard,
  adjudicateTeachingDramaAxiomCardFreeText,
  classForExtraction,
} from '../scripts/blind-teaching-drama-axiom-adjudication.js';
import { buildAdjudicationPacket } from '../scripts/build-a19-adjudication-packet.js';
import { induceTeachingDramaAxiom, validateTeachingDramaAxiomMemory } from '../scripts/induce-teaching-drama-axiom.js';
import {
  renderMarkdown as renderAttempt1Markdown,
  summarizeAttempt1Gate,
} from '../scripts/report-teaching-drama-axiom-attempt1.js';
import {
  summarizeGeneralizationLoops,
  validateGeneralizationLoopConfig,
} from '../scripts/run-a19-generalization-loop.js';
import { mergeA19AdjudicationCodes } from '../scripts/merge-a19-adjudication-codes.js';
import { cardSpecsFromConfig, dashId, summarizeCardResults } from '../scripts/run-a19-stability-screen.js';

const ROOT = path.resolve('.');
const PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const PILOT = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');
const GENERALIZATION_LOOPS = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-generalization-loops.yaml');
const ADJUDICATION_PANEL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-adjudication-panel.yaml');

function writeYaml(filePath, data) {
  fs.writeFileSync(filePath, yaml.stringify(data), 'utf8');
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function attempt1Manifest(scoreOverrides = {}, backends = { generator: 'mock', checker: 'mock' }) {
  const scores = {
    old_warrant_misclassification: 0.8,
    resistance_diagnosis: 0.8,
    strategy_revision_accountability: 0.8,
    recursive_dyadic_update: 0.8,
    non_leakage: 1,
    ...scoreOverrides,
  };
  return {
    records: [
      {
        generator: { backend: backends.generator, promptHashes: { system: 'g', user: 'u' } },
        checker: { backend: backends.checker, promptHashes: { system: 'c', user: 'u' } },
        paths: {
          revisedPublic: '/tmp/revised-public.txt',
          revisionJson: '/tmp/revision.json',
          checkJson: '/tmp/check.json',
        },
        check: {
          recommended_action: 'accept_for_blind_panel',
          scores,
        },
        gate: {
          status: 'survivor',
          scores: Object.fromEntries(
            Object.entries(scores).map(([field, value]) => [
              field,
              {
                value,
                threshold: field === 'non_leakage' ? 0.9 : 0.7,
                passes: value >= (field === 'non_leakage' ? 0.9 : 0.7),
              },
            ]),
          ),
        },
      },
    ],
  };
}

function baseFixture(overrides = {}) {
  return {
    meta: {
      schema_version: 'teaching-drama-axiom-families-v0.1',
      protocol_id: 'A19',
      protocol_version: 'a19-drama-axiom-transfer-v0.8',
      prompt_version: 'a19-fixture-test',
      fixture_only: true,
      no_model_calls: true,
    },
    families: [
      {
        family_id: 'test_family',
        learner_resistance_type: 'counter_warrant',
        tutor_infelicity_type: 'validation_without_engagement',
        evaluation_design: {
          s0_baseline_stratum: 'recursive_full_no_policy_memory',
          s0_claim_boundary: 'no_policy_memory_counterfactual_replay',
          s0_escalation_rule: 'stronger claims require recursive_full_no_policy_memory',
        },
        training_seed: {
          seed_id: 'seed',
          public_setup: 'The learner gives a counterexample without naming the target policy.',
          learner_resistance: 'That rule fails under this condition.',
          expected_failure: 'validation_without_engagement',
          old_rule_decoy: 'validate_then_redirect',
        },
        target_policy: {
          policy_id: 'scope_test',
          trigger: 'counterexample offered',
          avoid_move: 'validate and redirect',
          preferred_move: 'ask a scope test',
          applicability_conditions: ['learner gives a warrant'],
          anti_conditions: ['learner asks only for vocabulary'],
          repair_type: 'ask_scope_test',
        },
        plausible_repairs: ['validate_then_redirect', 'explain_more_slowly', 'scope_test'],
        cue_map: {
          selected_relation_type: 'warrant_scope',
          requires_constructed_device: true,
          counterexample_present: true,
          model_tier_scope: 'fixture_model',
          domain_scope: 'test_domain',
          leakage_risks: [],
        },
        heldout_siblings: [
          {
            sibling_id: 'sib_a',
            public_setup: 'The learner gives another counterexample.',
            headroom_prediction: 's0_decoy_s1_target',
            target_aliases: ['scope test'],
            decoy_aliases: ['validate then redirect'],
            selected_policy_markers: ['warrant boundary'],
            blind_adjudication: {
              withhold_from_critic: ['target_aliases', 'decoy_aliases', 'arm_provenance', 'policy_memory_condition'],
              neutral_option_space: 'repair A | repair B',
            },
            fixture_adjudication: {
              s0: { committed_option_class: 'decoy', basis_label: 'validation_redirect', artifact_flags: [] },
              s1: { committed_option_class: 'target', basis_label: 'named_relation', artifact_flags: [] },
              expected_card_verdict: 'policy_headroom',
            },
          },
          {
            sibling_id: 'sib_b',
            public_setup: 'The learner gives a boundary case.',
            headroom_prediction: 's0_self_solves',
            target_aliases: ['boundary test'],
            decoy_aliases: ['define term again'],
            selected_policy_markers: ['scope boundary'],
            blind_adjudication: {
              withhold_from_critic: ['target_aliases', 'decoy_aliases', 'arm_provenance', 'policy_memory_condition'],
              neutral_option_space: 'repair A | repair B',
            },
            fixture_adjudication: {
              s0: { committed_option_class: 'target', basis_label: 'ordinary_public_inference', artifact_flags: [] },
              s1: { committed_option_class: 'target', basis_label: 'named_relation', artifact_flags: [] },
              expected_card_verdict: 'ceiling',
            },
          },
        ],
        ...overrides,
      },
    ],
  };
}

test('A19 validator accepts the checked-in pilot fixtures', () => {
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath: PILOT });
  assert.equal(report.status, 'pass');
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.families, 12);
  assert.equal(report.summary.cards, 38);
  assert.deepEqual(report.provenance.zero_api, true);
  assert.equal(report.summary.verdict_counts.policy_headroom, 14);
  assert.equal(report.summary.verdict_counts.ceiling, 14);
  assert.equal(report.summary.verdict_counts.policy_failure, 1);
  assert.equal(report.summary.verdict_counts.cue_leak, 1);
  assert.equal(report.summary.verdict_counts.self_solve, 5);
  assert.equal(report.summary.verdict_counts.arbiter_disagreement, 1);
  assert.equal(report.summary.verdict_counts.neither_correct, 1);
  assert.equal(report.summary.verdict_counts.protocol_reject, 1);
});

test('validator rejects fixtures that omit alias and provenance withholding', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-protocol-'));
  const fixture = baseFixture();
  fixture.families[0].heldout_siblings[0].blind_adjudication.withhold_from_critic = ['target_aliases'];
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /must withhold aliases, provenance, and policy condition/);
});

test('validator rejects selected policy markers leaked into public fields', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-marker-leak-'));
  const fixture = baseFixture();
  fixture.families[0].heldout_siblings[0].public_setup = 'The learner explicitly asks for a warrant boundary.';
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /selected policy markers appear in public/);
});

test('validator rejects selected policy markers leaked into held-out learner resistance', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-marker-leak-learner-'));
  const fixture = baseFixture();
  fixture.families[0].heldout_siblings[0].learner_resistance =
    'I think the answer needs a warrant boundary before we continue.';
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /selected policy markers appear in public/);
});

test('validator requires cue-map model tier and domain scope', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-cue-scope-'));
  const fixture = baseFixture();
  delete fixture.families[0].cue_map.model_tier_scope;
  delete fixture.families[0].cue_map.domain_scope;
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /cue_map\.model_tier_scope/);
  assert.match(JSON.stringify(report.issues), /cue_map\.domain_scope/);
});

test('validator requires registered S0 baseline strata', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-s0-strata-'));
  const fixture = baseFixture();
  fixture.families[0].evaluation_design.s0_baseline_stratum = 'unregistered_s0';
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /unknown S0 baseline stratum/);
});

test('validator requires repair-misalignment subtypes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-repair-subtype-'));
  const fixture = baseFixture({
    learner_resistance_type: 'frustration',
    tutor_infelicity_type: 'failure_to_repair_rupture',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'repair_misalignment',
      repair_subtype: 'not_a_registered_subtype',
    },
  });
  fixture.families[0].heldout_siblings[0].target_repair_subtype = 'not_a_registered_subtype';
  fixture.families[0].heldout_siblings[1].target_repair_subtype = 'not_a_registered_subtype';
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /unknown repair_misalignment subtype/);
});

test('validator requires public obligations for ambiguous repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-repair-obligations-'));
  const fixture = baseFixture({
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'offer_diagnostic_options',
      public_obligations: ['name_two_or_more_possible_stuck_locations'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /withhold_final_answer_until_after_diagnostic_choice/);
});

test('validator requires public obligations for preserve-struggle repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-preserve-obligations-'));
  const fixture = baseFixture({
    learner_resistance_type: 'over_compliance',
    tutor_infelicity_type: 'over_scaffolding',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'preserve_struggle',
      public_obligations: ['explicitly_withhold_copyable_completion'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /require_bounded_learner_owned_decision/);
});

test('validator requires public obligations for instructional-contract repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-contract-obligations-'));
  const fixture = baseFixture({
    learner_resistance_type: 'meta_challenge',
    tutor_infelicity_type: 'failure_to_repair_rupture',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'instructional_contract_repair',
      public_obligations: ['acknowledge_tutor_contribution_to_contract_drift'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /offer_learner_choice_of_repair_path/);
});

test('validator requires public obligations for claim-address repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-claim-address-obligations-'));
  const fixture = baseFixture({
    learner_resistance_type: 'counter_warrant',
    tutor_infelicity_type: 'redirect_after_resistance',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'claim_address_repair',
      public_obligations: ['identify_the_claim_or_warrant_the_tutor_misaddressed'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /restate_the_learner_claim_as_the_next_addressed_object/);
});

test('validator requires public obligations for commitment-ledger repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-commitment-ledger-obligations-'));
  const fixture = baseFixture({
    learner_resistance_type: 'meta_challenge',
    tutor_infelicity_type: 'failure_to_repair_rupture',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'commitment_ledger_repair',
      public_obligations: ['cite_two_conflicting_public_tutor_commitments'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /state_the_new_commitment_boundary/);
});

test('validator requires public obligations for learner-standing repair types', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-learner-standing-obligations-'));
  const fixture = baseFixture({
    learner_resistance_type: 'meta_challenge',
    tutor_infelicity_type: 'moral_flattery',
    target_policy: {
      ...baseFixture().families[0].target_policy,
      repair_type: 'learner_standing_repair',
      public_obligations: ['name_the_misrecognition_or_moral_flattening'],
    },
  });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /target_policy\.public_obligations/);
  assert.match(JSON.stringify(report.issues), /offer_a_non_content_continuation_or_stop_option/);
});

test('validator requires the protocol changelog', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-changelog-'));
  const protocol = yaml.parse(fs.readFileSync(PROTOCOL, 'utf8'));
  delete protocol.meta.changelog_path;
  const protocolPath = path.join(tmpDir, 'bad-protocol.yaml');
  writeYaml(protocolPath, protocol);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath, configPath: PILOT });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /protocol\.meta\.changelog_path/);
});

test('validator rejects target policies without anti-conditions', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-anti-condition-'));
  const fixture = baseFixture({ target_policy: { ...baseFixture().families[0].target_policy, anti_conditions: [] } });
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /must include anti-conditions/);
});

test('headroom classifier covers all non-reject verdict classes', () => {
  const protocol = yaml.parse(fs.readFileSync(PROTOCOL, 'utf8'));
  const mk = (s0, s1) => ({ fixture_adjudication: { s0, s1 } });
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'decoy', artifact_flags: [] },
        { committed_option_class: 'target', artifact_flags: [] },
      ),
      protocol,
    ),
    'policy_headroom',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'target', basis_label: 'ordinary_public_inference', artifact_flags: [] },
        { committed_option_class: 'target', artifact_flags: [] },
      ),
      protocol,
    ),
    'ceiling',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'target', basis_label: 'registered_relation_without_policy', artifact_flags: [] },
        { committed_option_class: 'target', artifact_flags: [] },
      ),
      protocol,
    ),
    'self_solve',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'decoy', artifact_flags: [] },
        { committed_option_class: 'decoy', artifact_flags: [] },
      ),
      protocol,
    ),
    'policy_failure',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'target', artifact_flags: ['cue_leak'] },
        { committed_option_class: 'target', artifact_flags: [] },
      ),
      protocol,
    ),
    'cue_leak',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'neither', artifact_flags: ['arbiter_disagreement'] },
        { committed_option_class: 'neither', artifact_flags: [] },
      ),
      protocol,
    ),
    'arbiter_disagreement',
  );
  assert.equal(
    classifyCardVerdict(
      mk(
        { committed_option_class: 'neither', artifact_flags: [] },
        { committed_option_class: 'neither', artifact_flags: [] },
      ),
      protocol,
    ),
    'neither_correct',
  );
});

test('validator requires a known protocol reject reason', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-protocol-reject-'));
  const fixture = baseFixture();
  const rejectCard = fixture.families[0].heldout_siblings[0];
  delete rejectCard.fixture_adjudication;
  rejectCard.protocol_reject = true;
  rejectCard.protocol_reject_reason = 'not_a_registered_reason';
  rejectCard.expected_card_verdict = 'protocol_reject';
  const configPath = path.join(tmpDir, 'bad.yaml');
  writeYaml(configPath, fixture);
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /unknown protocol reject reason/);
});

test('framework report separates denominators and refuses a pooled rate', () => {
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath: PILOT });
  const denominators = denominatorSummary(report.cards);
  assert.deepEqual(denominators, {
    total_cards: 38,
    admitted_cards: 35,
    protocol_reject_cards: 1,
    artifact_cards: 2,
    policy_headroom_cards: 14,
  });
  const markdown = renderMarkdown(report);
  const baselines = baselineSummary(report.cards);
  assert.deepEqual(baselines.weak_single_pass_no_policy_memory, {
    total_cards: 2,
    policy_headroom_cards: 1,
  });
  assert.match(markdown, /No pooled success rate is reported here/);
  assert.match(markdown, /protocol-screen-only/);
  assert.match(markdown, /Claims Not Licensed/);
});

test('A19 stability harness resolves card specs and summarizes rerun verdicts', () => {
  const config = yaml.parse(fs.readFileSync(PILOT, 'utf8'));
  const specs = cardSpecsFromConfig(config, {
    familyId: 'surface_agreement_uptake',
    siblingIds: ['surface_agreement_uptake_c', 'surface_agreement_uptake_e'],
    materializedRoot: '/tmp/materialized',
    axiom: '/tmp/axiom.json',
  });
  assert.equal(dashId('surface_agreement_uptake_c'), 'surface-agreement-uptake-c');
  assert.equal(specs.length, 2);
  assert.equal(specs[0].target_repair_type, 'transfer_control');
  assert.match(specs[0].transcript, /surface-agreement-uptake-c\/heldout-base\.full\.md$/);
  assert.match(specs[0].decoy_repair_types, /praise_and_close/);
  assert.match(specs[0].decoy_repair_types, /repeat_the_explanation/);

  const summary = summarizeCardResults(specs[0], [
    {
      seed: 1,
      status: 'complete',
      card_verdict: 'policy_headroom',
      s0_class: 'neither',
      s1_class: 'target',
    },
    {
      seed: 2,
      status: 'complete',
      card_verdict: 'policy_headroom',
      s0_class: 'decoy',
      s1_class: 'target',
    },
  ]);
  assert.equal(summary.k_completed, 2);
  assert.equal(summary.policy_headroom_count, 2);
  assert.equal(summary.s0_target_count, 0);
  assert.equal(summary.s1_target_count, 2);
  assert.equal(summary.interpretation, 'stable_policy_headroom');
});

test('attempt materializer writes A18 replay and A19 blind-adjudication commands', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-materialize-'));
  const outDir = path.join(tmpDir, 'out');
  const plan = materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
    force: true,
  });
  assert.equal(plan.validation.status, 'pass');
  assert.equal(plan.families.length, 1);
  const family = plan.families[0];
  assert.ok(fs.existsSync(family.attempt1_training_transcript));
  assert.ok(fs.existsSync(family.axiom_template));
  assert.match(family.attempt1_replay_command_text, /replay-discursive-transcript\.js/);
  assert.match(family.attempt1_replay_command_text, /--recursive-tutor-learning-gate/);
  assert.ok(fs.existsSync(family.heldout[0].heldout_base_transcript));
  assert.ok(fs.existsSync(family.heldout[0].s0_public_transcript));
  assert.ok(fs.existsSync(family.heldout[0].s1_public_transcript));
  assert.match(family.heldout[0].blind_adjudication_command_text, /blind-teaching-drama-axiom-adjudication\.js/);
  assert.match(family.axiom_induction_command_text, /induce-teaching-drama-axiom\.js/);
  assert.match(family.heldout[0].s1_axiom_replay_command_text, /--policy-memory/);
  assert.match(
    family.heldout[0].s1_axiom_replay_command_text,
    /exports\/a19\/axioms\/counter-warrant-scope\/axiom\.json/,
  );
  assert.match(fs.readFileSync(path.join(outDir, 'next-commands.sh'), 'utf8'), /fixture blind adjudication/);
  assert.match(fs.readFileSync(path.join(outDir, 'next-commands.sh'), 'utf8'), /exactly one admitted axiom/);
});

test('attempt materializer uses held-out sibling learner resistance when present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-materialize-heldout-learner-'));
  const configPath = path.join(tmpDir, 'fixture.yaml');
  const fixture = baseFixture();
  fixture.families[0].heldout_siblings[0].learner_resistance = 'This is the held-out learner line.';
  writeYaml(configPath, fixture);
  const outDir = path.join(tmpDir, 'out');
  const plan = materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath,
    outDir,
    familyId: 'test_family',
    force: true,
  });
  const heldoutText = fs.readFileSync(plan.families[0].heldout[0].heldout_base_transcript, 'utf8');
  assert.match(heldoutText, /LEARNER: This is the held-out learner line\./);
  assert.doesNotMatch(heldoutText, /LEARNER: That rule fails under this condition\./);
});

test('attempt-1 report separates fixture survivors from empirical survivors', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-attempt1-'));
  const outDir = path.join(tmpDir, 'out');
  materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
    force: true,
  });
  writeJson(path.join(outDir, 'counter-warrant-scope', 'attempt1-replay', 'manifest.json'), attempt1Manifest());
  const report = summarizeAttempt1Gate({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.empirical_status, 'fixture_only_no_empirical_claim');
  assert.equal(report.summary.fixture_survivors, 1);
  assert.equal(report.summary.survivors, 0);
  assert.equal(report.families[0].next_gate, 'requires_real_attempt1_before_empirical_s0s1');
  assert.match(renderAttempt1Markdown(report), /Mock-backed survivors are fixture survivors/);
});

test('attempt-1 report blocks S0/S1 when confident misclassification is missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-attempt1-block-'));
  const outDir = path.join(tmpDir, 'out');
  materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
    force: true,
  });
  writeJson(
    path.join(outDir, 'counter-warrant-scope', 'attempt1-replay', 'manifest.json'),
    attempt1Manifest({ old_warrant_misclassification: 0.6 }),
  );
  const report = summarizeAttempt1Gate({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
  });
  assert.equal(report.status, 'fail');
  assert.equal(report.summary.blocked, 1);
  assert.equal(report.families[0].next_gate, 'stop_before_s0s1');
  assert.deepEqual(report.families[0].blockers[0], {
    field: 'old_warrant_misclassification',
    threshold: 0.7,
    value: 0.6,
    reason: 'below_threshold',
  });
});

test('attempt-1 report accepts a real per-family attempt directory as empirical survivor', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-attempt1-real-'));
  const outDir = path.join(tmpDir, 'fixture-out');
  const realDir = path.join(tmpDir, 'real-counter-warrant');
  materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
    force: true,
  });
  writeJson(path.join(realDir, 'manifest.json'), attempt1Manifest({}, { generator: 'codex', checker: 'claude' }));
  const report = summarizeAttempt1Gate({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    attempt1Dirs: { counter_warrant_scope: realDir },
    familyId: 'counter_warrant_scope',
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.empirical_status, 'real_attempt1_present');
  assert.equal(report.summary.survivors, 1);
  assert.equal(report.summary.fixture_survivors, 0);
  assert.equal(report.families[0].status, 'survivor');
  assert.equal(report.families[0].next_gate, 'eligible_for_s0s1_contrast');
  assert.equal(report.families[0].manifest_path, path.relative(ROOT, path.join(realDir, 'manifest.json')));
});

test('attempt-1 report normalizes recursive tutor scores from real replay manifests', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-attempt1-real-shape-'));
  const outDir = path.join(tmpDir, 'fixture-out');
  const realDir = path.join(tmpDir, 'real-counter-warrant');
  materializeAttemptFixtures({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    familyId: 'counter_warrant_scope',
    force: true,
  });
  const manifest = attempt1Manifest({}, { generator: 'codex', checker: 'claude' });
  const record = manifest.records[0];
  record.check.scores = {
    old_warrant_misclassification: 9,
    resistance_diagnosis: 8,
    strategy_revision_accountability: 9,
    recursive_dyadic_update: 8,
    non_leakage: 10,
  };
  record.gate.scores = {
    old_warrant_misclassification: { raw: 9, value: 0.9, scale: '0-10', threshold: 0.7, passes: true },
    non_leakage: { raw: 10, value: 1, scale: '0-10', threshold: 0.9, passes: true },
  };
  record.gate.recursive_tutor_learning_gate = {
    scores: {
      resistance_diagnosis: { raw: 8, value: 0.8, scale: '0-10', threshold: 0.7, passes: true },
      strategy_revision_accountability: { raw: 9, value: 0.9, scale: '0-10', threshold: 0.7, passes: true },
      recursive_dyadic_update: { raw: 8, value: 0.8, scale: '0-10', threshold: 0.7, passes: true },
    },
  };
  writeJson(path.join(realDir, 'manifest.json'), manifest);
  const report = summarizeAttempt1Gate({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    outDir,
    attempt1Dirs: { counter_warrant_scope: realDir },
    familyId: 'counter_warrant_scope',
  });
  assert.equal(report.status, 'pass');
  assert.equal(report.families[0].scores.resistance_diagnosis, 0.8);
  assert.equal(report.families[0].scores.strategy_revision_accountability, 0.9);
  assert.equal(report.families[0].scores.recursive_dyadic_update, 0.8);
  assert.match(renderAttempt1Markdown(report), /counter_warrant_scope[\s\S]+0\.9 \| 0\.8 \| 0\.9 \| 0\.8 \| 1/);
});

test('fixture blind adjudication preserves alias withholding and classifies headroom', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-blind-'));
  const s0 = path.join(tmpDir, 's0.md');
  const s1 = path.join(tmpDir, 's1.md');
  fs.writeFileSync(
    s0,
    ['STAGE: The learner resists the move.', 'LEARNER: I still object.', 'TUTOR: I will validate then redirect.'].join(
      '\n',
    ),
    'utf8',
  );
  fs.writeFileSync(
    s1,
    ['STAGE: The learner resists the move.', 'LEARNER: I still object.', 'TUTOR: I will ask a scope test.'].join('\n'),
    'utf8',
  );
  const report = adjudicateTeachingDramaAxiomCard({
    protocolPath: PROTOCOL,
    s0,
    s1,
    targetAliases: ['scope test'],
    decoyAliases: ['validate then redirect'],
    optionSpace: 'repair A | repair B',
    familyId: 'test_family',
    siblingId: 'sib_a',
    runId: 'fixture-run',
  });
  assert.equal(report.card_verdict, 'policy_headroom');
  assert.equal(report.arms.s0.committed_option_class, 'decoy');
  assert.equal(report.arms.s1.committed_option_class, 'target');
  assert.equal(report.critic_prompt_audit.target_aliases_visible_to_critic, false);
  assert.equal(report.critic_prompt_audit.decoy_aliases_visible_to_critic, false);
});

test('free-text blind adjudication maps paraphrased scope repairs by hidden repair type', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-free-text-'));
  const s0 = path.join(tmpDir, 's0.md');
  const s1 = path.join(tmpDir, 's1.md');
  fs.writeFileSync(
    s0,
    [
      'STAGE: The learner says a rule fails when an exception is present.',
      'LEARNER: The usual condition is present, but the exception changes the result.',
      'TUTOR: Change the test: hold the usual condition fixed and compare the exception-absent case with the exception-present case.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    s1,
    [
      'STAGE: The learner says a rule fails when an exception is present.',
      'LEARNER: The usual condition is present, but the exception changes the result.',
      'TUTOR: Give the rule with the boundary included, and say which case defeats the broad version.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    s0,
    s1,
    targetAliases: ['scope test', 'warrant boundary', 'exception condition'],
    decoyAliases: ['validate then redirect', 'explain more slowly'],
    targetRepairType: 'ask_scope_test',
    decoyRepairTypes: ['validate_redirect', 'repeat_explanation'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'counter_warrant_scope',
    siblingId: 'counter_warrant_scope_a',
    runId: 'free-text-fixture',
    mock: true,
  });
  assert.equal(report.card_verdict, 'ceiling');
  assert.equal(report.arms.s0.committed_option_class, 'target');
  assert.equal(report.arms.s1.committed_option_class, 'target');
  assert.equal(report.critic_prompt_audit.target_repair_type_visible_to_critic, false);
  assert.deepEqual(report.critic_model_provenance, {
    backend: 'deterministic_free_text_mock',
    cli: null,
    cliVersion: null,
    model: 'mock',
    requestedModel: 'mock',
    resolvedModel: 'mock',
    modelResolution: 'explicit_cli_arg',
    reasoningEffort: null,
    reasoningEffortSource: null,
  });
});

test('free-text blind adjudication calibrates transfer-control repairs from fresh public tests', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-transfer-control-'));
  const s0 = path.join(tmpDir, 's0.md');
  const s1 = path.join(tmpDir, 's1.md');
  fs.writeFileSync(
    s0,
    [
      'STAGE: The learner says yes but repeats an old procedure.',
      'LEARNER: Yes, I get it, so I still use the old shortcut.',
      'TUTOR: Try the public check on a fresh case before we close.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    s1,
    [
      'STAGE: The learner says yes but repeats an old procedure.',
      'LEARNER: Yes, I get it, so I still use the old shortcut.',
      'TUTOR: Use the discriminating test on the next example and show which rule survives.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    s0,
    s1,
    targetAliases: ['action gate', 'apply the new rule', 'concrete test'],
    decoyAliases: ['praise and close', 'repeat explanation'],
    targetRepairType: 'transfer_control',
    decoyRepairTypes: ['praise_close', 'repeat_explanation'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'surface_agreement_uptake',
    siblingId: 'calibration',
    runId: 'transfer-control-calibration',
    mock: true,
  });
  assert.equal(report.card_verdict, 'ceiling');
  assert.equal(report.arms.s0.committed_option_class, 'target');
  assert.equal(report.arms.s1.committed_option_class, 'target');
});

test('free-text single-arm headroom recognizes S0 baseline labels', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-single-arm-'));
  const s0 = path.join(tmpDir, 's0.md');
  fs.writeFileSync(
    s0,
    [
      'STAGE: The learner asks for the answer.',
      'LEARNER: I cannot tell where I am stuck.',
      'TUTOR: Try it on the next concrete case before we close.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: s0,
    armLabel: 'S0_weak_no_policy',
    targetAliases: ['diagnostic menu'],
    decoyAliases: ['give the answer'],
    targetRepairType: 'offer_diagnostic_options',
    decoyRepairTypes: ['give_full_answer_to_reduce_frustration'],
    optionSpace: 'repair A | repair B',
    familyId: 'test_family',
    siblingId: 'sib_a',
    runId: 'single-arm-fixture',
    mock: true,
  });
  assert.equal(report.arm.label, 'S0_weak_no_policy');
  assert.equal(report.arm.committed_option_class, 'neither');
  assert.equal(report.headroom_screen.s0_has_observable_headroom, true);
});

test('free-text diagnostic-options audit flags transfer-control granularity risk', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-diagnostic-risk-'));
  const armPath = path.join(tmpDir, 'arm.md');
  fs.writeFileSync(
    armPath,
    [
      'STAGE: The learner asks for the answer because the source of stuckness is unclear.',
      'LEARNER: I cannot tell whether the setup, the next operation, or the checking step is broken. Can you tell me the answer?',
      'TUTOR: Choose one diagnostic option first: A setup, B next operation, or C checking step.',
      'LEARNER: I choose C.',
      'TUTOR: Try it on the next example before we close.',
      'LEARNER: So the next case works because the corrected check gives the same result.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: armPath,
    armLabel: 'S1_policy_memory',
    targetAliases: ['diagnostic options', 'choose the stuck point', 'bounded hint menu'],
    decoyAliases: ['give the answer', 'full worked solution'],
    targetRepairType: 'offer_diagnostic_options',
    decoyRepairTypes: ['give_full_answer_to_reduce_frustration'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'productive_impasse_answer_leakage',
    siblingId: 'granularity_fixture',
    runId: 'diagnostic-risk-fixture',
    mock: true,
  });
  assert.equal(report.arm.committed_option_class, 'neither');
  assert.equal(report.arm.repair_type, 'transfer_control');
  assert.equal(report.arm.target_obligation_audit.diagnostic_options_present, true);
  assert.equal(report.arm.target_obligation_audit.competing_transfer_control_signal, true);
  assert.equal(report.arm.target_obligation_audit.target_granularity_risk, true);
});

test('free-text mapper recognizes instructional-contract repair without transfer control', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-contract-repair-'));
  const armPath = path.join(tmpDir, 'arm.md');
  fs.writeFileSync(
    armPath,
    [
      'STAGE: The learner says the revision target keeps changing.',
      'LEARNER: I need to know what we are doing here before I write another version.',
      'TUTOR: You are right that I shifted the working agreement. I am going to pause the content task, own that drift, and offer two repair paths: we can first choose the claim focus, or we can first choose the evidence order.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: armPath,
    armLabel: 'S1_policy_memory',
    targetAliases: ['instructional contract', 'working agreement', 'repair path'],
    decoyAliases: ['restate the assignment goal', 'explain the rubric again'],
    targetRepairType: 'instructional_contract_repair',
    decoyRepairTypes: ['restate_the_assignment_goal'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'instructional_contract_drift',
    siblingId: 'contract_fixture',
    runId: 'contract-repair-fixture',
    mock: true,
  });
  assert.equal(report.arm.committed_option_class, 'target');
  assert.equal(report.arm.repair_type, 'instructional_contract_repair');
  assert.equal(report.arm.target_obligation_audit.instructional_contract_repair_present, true);
  assert.equal(report.arm.target_obligation_audit.competing_transfer_control_signal, false);
  assert.equal(report.arm.target_obligation_audit.target_granularity_risk, false);
});

test('free-text mapper recognizes claim-address repair without transfer control', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-claim-address-repair-'));
  const armPath = path.join(tmpDir, 'arm.md');
  fs.writeFileSync(
    armPath,
    [
      'STAGE: The learner says the tutor answered a different concern.',
      'LEARNER: I am not asking about citation format. I am asking whether this source belongs in the paragraph.',
      'TUTOR: I answered the wrong concern. I withdraw that framing: format is not the issue you raised. The claim I need to answer now is whether the source does any work in this paragraph.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: armPath,
    armLabel: 'S1_policy_memory',
    targetAliases: ['claim address repair', 'withdraw misaddressed framing'],
    decoyAliases: ['repeat citation rule', 'explain the format again'],
    targetRepairType: 'claim_address_repair',
    decoyRepairTypes: ['repeat_original_explanation'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'addressed_claim_withdrawal',
    siblingId: 'claim_address_fixture',
    runId: 'claim-address-fixture',
    mock: true,
  });
  assert.equal(report.arm.committed_option_class, 'target');
  assert.equal(report.arm.repair_type, 'claim_address_repair');
  assert.equal(report.arm.target_obligation_audit.claim_address_repair_present, true);
  assert.equal(report.arm.target_obligation_audit.competing_transfer_control_signal, false);
  assert.equal(report.arm.target_obligation_audit.target_granularity_risk, false);
});

test('free-text mapper recognizes commitment-ledger repair without transfer control', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-commitment-ledger-repair-'));
  const armPath = path.join(tmpDir, 'arm.md');
  fs.writeFileSync(
    armPath,
    [
      'STAGE: The learner says two tutor commitments cannot both govern.',
      'LEARNER: You said you would not choose the claim for me, but now you are telling me which claim to use.',
      'TUTOR: I need to repair my public commitments first: I said I would not choose the claim, and I just started choosing it. I retract the second move. The new boundary is that I can name tradeoffs, but you choose the claim before I continue.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: armPath,
    armLabel: 'S1_policy_memory',
    targetAliases: ['commitment ledger repair', 'retract one commitment'],
    decoyAliases: ['continue choosing the claim', 'restate the thesis'],
    targetRepairType: 'commitment_ledger_repair',
    decoyRepairTypes: ['continue_original_instruction'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'public_commitment_contradiction',
    siblingId: 'commitment_ledger_fixture',
    runId: 'commitment-ledger-fixture',
    mock: true,
  });
  assert.equal(report.arm.committed_option_class, 'target');
  assert.equal(report.arm.repair_type, 'commitment_ledger_repair');
  assert.equal(report.arm.target_obligation_audit.commitment_ledger_repair_present, true);
  assert.equal(report.arm.target_obligation_audit.competing_transfer_control_signal, false);
  assert.equal(report.arm.target_obligation_audit.target_granularity_risk, false);
});

test('free-text mapper recognizes learner-standing repair without transfer control', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-learner-standing-repair-'));
  const armPath = path.join(tmpDir, 'arm.md');
  fs.writeFileSync(
    armPath,
    [
      'STAGE: The learner says reassurance flattened a disclosure.',
      'LEARNER: I am not asking you to tell me I am a good person. I am asking whether I had standing to make that choice.',
      'TUTOR: I flattened your disclosure into reassurance. You control how much of this you disclose here. The question is accountability, not whether I can make you feel better or give advice. We can stop this thread, or continue only by naming what decision boundary you want me to address.',
    ].join('\n'),
    'utf8',
  );
  const report = await adjudicateTeachingDramaAxiomCardFreeText({
    protocolPath: PROTOCOL,
    singleArm: armPath,
    armLabel: 'S1_policy_memory',
    targetAliases: ['learner standing repair', 'disclosure boundary'],
    decoyAliases: ['reassure good intentions', 'give partner advice'],
    targetRepairType: 'learner_standing_repair',
    decoyRepairTypes: ['reassure_and_redirect'],
    optionSpace: 'repair A | repair B | repair C',
    familyId: 'moral_disclosure_standing_repair',
    siblingId: 'learner_standing_fixture',
    runId: 'learner-standing-fixture',
    mock: true,
  });
  assert.equal(report.arm.committed_option_class, 'target');
  assert.equal(report.arm.repair_type, 'learner_standing_repair');
  assert.equal(report.arm.target_obligation_audit.learner_standing_repair_present, true);
  assert.equal(report.arm.target_obligation_audit.competing_transfer_control_signal, false);
  assert.equal(report.arm.target_obligation_audit.target_granularity_risk, false);
});

test('free-text mapper treats transcript-backed concrete application as transfer control', () => {
  const transcript = [
    'STAGE: The learner agrees but repeats an invalid logarithm split.',
    'LEARNER: Okay, so log(8 + 2) can still become log(8) plus log(2).',
    'TUTOR: From here, the check is: after any proposed split, recombine the outside operation and see whether it gives the same inside input. Try log(5 + 3).',
    'LEARNER: log(5 + 3) is log(8). If I split it, log(5) + log(3) recombines to log(15), so I should not split addition inside a log.',
  ].join('\n');
  const matched = classForExtraction(
    {
      committed_repair:
        'Installs a general validity check after any proposed split, recombining the outside operation and confirming it yields the same inside input.',
      committing_quote:
        'From here, the check is: after any proposed split, recombine the outside operation and see whether it gives the same inside input.',
      repair_type: 'name_warrant',
      public_evidence_summary:
        'The tutor committed to a recombine-and-compare check, and the learner then applied it to log(5+3).',
    },
    {
      targetAliases: ['fresh case', 'public check', 'value check', 'discriminating test', 'next expression'],
      decoyAliases: ['praise and close', 'repeat explanation'],
      targetRepairType: 'transfer_control',
      decoyRepairTypes: ['praise_close', 'repeat_explanation'],
      transcript,
    },
  );
  assert.equal(matched, 'target');
});

test('free-text mapper ignores decoy aliases when the repair explicitly rejects them', () => {
  const matched = classForExtraction(
    {
      committed_repair:
        'Convert both readings onto a single common scale before averaging rather than averaging the raw printed numbers.',
      committing_quote: 'Convert one reading so both are on the same scale, then average.',
      repair_type: 'name_warrant',
      public_evidence_summary: 'The tutor rejects averaging the numbers and commits to unit conversion first.',
    },
    {
      targetAliases: ['convert units', 'same scale', 'unit conversion'],
      decoyAliases: ['average the numbers', 'explain the formula again'],
      targetRepairType: 'name_warrant',
      decoyRepairTypes: ['average_displayed_numbers', 'explain_the_formula_again'],
    },
  );
  assert.equal(matched, 'target');
});

test('free-text mapper ignores old-rule aliases when named as the failed shortcut', () => {
  const matched = classForExtraction(
    {
      committed_repair:
        'Convert both fractions to a common-size unit before adding, because the add-tops/add-bottoms shortcut changes the unit instead of joining same-size pieces.',
      committing_quote: 'The shortcut changes the unit instead of joining same-size pieces.',
      repair_type: 'name_warrant',
      public_evidence_summary:
        'The tutor names why the shortcut fails and directs the learner to make same-size pieces before adding.',
    },
    {
      targetAliases: ['common-size unit', 'same-size pieces'],
      decoyAliases: ['add tops and bottoms'],
      targetRepairType: 'ask_scope_test',
      decoyRepairTypes: ['add_numerators_and_denominators'],
    },
  );
  assert.equal(matched, 'target');
});

test('axiom induction admits one typed axiom and rejects full revision bundles as S1 memory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-axiom-induce-'));
  const attemptDir = path.join(tmpDir, 'attempt1');
  const itemDir = path.join(attemptDir, 'attempt1.full');
  fs.mkdirSync(itemDir, { recursive: true });
  const revision = {
    revised_public_transcript:
      'TUTOR: Let us compare exception-present and exception-absent cases.\nLEARNER: The exception case defeats the broader rule.',
    move_ledger: [
      {
        public_action: 'The tutor changes to a side-by-side scope test.',
        learner_actional_uptake: 'The learner applies the exception boundary.',
      },
    ],
  };
  const revisionPath = path.join(itemDir, 'revision.json');
  const revisedPublicPath = path.join(itemDir, 'revised-public.txt');
  writeJson(revisionPath, revision);
  fs.writeFileSync(revisedPublicPath, revision.revised_public_transcript, 'utf8');
  writeJson(path.join(attemptDir, 'manifest.json'), {
    generator: 'codex',
    checker: 'claude',
    records: [
      {
        paths: {
          revisionJson: revisionPath,
          revisedPublic: revisedPublicPath,
        },
        generator: {
          backend: 'codex',
          cli: 'codex exec',
          cliVersion: 'codex-cli-fixture',
          model: 'gpt-fixture',
          requestedModel: 'gpt-fixture',
          resolvedModel: 'gpt-fixture',
          modelResolution: 'explicit_cli_arg',
          reasoningEffort: 'xhigh',
          reasoningEffortSource: 'test_fixture',
          promptHashes: { system: 'g', user: 'u' },
        },
        checker: {
          backend: 'claude',
          cli: 'claude',
          cliVersion: 'claude-cli-fixture',
          model: 'sonnet-fixture',
          requestedModel: 'sonnet-fixture',
          resolvedModel: 'sonnet-fixture',
          modelResolution: 'explicit_cli_arg',
          reasoningEffort: 'high',
          reasoningEffortSource: 'test_fixture',
          promptHashes: { system: 'c', user: 'u' },
        },
        check: {
          recommended_action: 'accept_for_blind_panel',
          recursive_tutor_learning: {
            tutor_prior_strategy: 'Validate briefly and redirect to the original rule.',
            strategy_revision: 'Rejected the redirect; chose a scope test with matched exception cases.',
            downstream_feedback: 'The learner says the exception case defeats the broader rule.',
          },
        },
        gate: { status: 'survivor' },
      },
    ],
  });

  const axiom = induceTeachingDramaAxiom({
    protocolPath: PROTOCOL,
    configPath: PILOT,
    familyId: 'counter_warrant_scope',
    attempt1Dir: attemptDir,
  });
  assert.equal(axiom.status, 'admitted');
  assert.equal(axiom.gate.status, 'pass');
  assert.equal(axiom.policy_memory_contract.memory_unit, 'single_teaching_drama_axiom');
  assert.equal(axiom.policy_memory_contract.full_revision_bundle_allowed, false);
  assert.deepEqual(axiom.source_attempt1.generator_model_provenance, {
    backend: 'codex',
    cli: 'codex exec',
    cli_version: 'codex-cli-fixture',
    model: 'gpt-fixture',
    requested_model: 'gpt-fixture',
    resolved_model: 'gpt-fixture',
    model_resolution: 'explicit_cli_arg',
    reasoning_effort: 'xhigh',
    reasoning_effort_source: 'test_fixture',
  });
  assert.deepEqual(axiom.source_attempt1.checker_model_provenance, {
    backend: 'claude',
    cli: 'claude',
    cli_version: 'claude-cli-fixture',
    model: 'sonnet-fixture',
    requested_model: 'sonnet-fixture',
    resolved_model: 'sonnet-fixture',
    model_resolution: 'explicit_cli_arg',
    reasoning_effort: 'high',
    reasoning_effort_source: 'test_fixture',
  });

  const revisionGate = validateTeachingDramaAxiomMemory(revision);
  assert.equal(revisionGate.status, 'fail');
  assert.match(JSON.stringify(revisionGate.issues), /full_revision_bundle_not_allowed|not_single_teaching_drama_axiom/);
});

test('A19 generalization loop config separates repair, adjudication, and S0-condition tracks', () => {
  const config = yaml.parse(fs.readFileSync(GENERALIZATION_LOOPS, 'utf8'));
  const validation = validateGeneralizationLoopConfig(config);
  assert.equal(validation.status, 'pass');
  const summary = summarizeGeneralizationLoops(config, { configPath: GENERALIZATION_LOOPS });
  assert.equal(summary.status, 'pass');
  assert.equal(summary.tracks.length, 3);
  assert.deepEqual(summary.tracks.map((track) => track.track_id).sort(), [
    'adjudication_infrastructure',
    'alternate_s0_condition',
    'non_collapsing_repair_family',
  ]);
  const adjudication = summary.tracks.find((track) => track.track_id === 'adjudication_infrastructure');
  assert.equal(adjudication.distinct_result_known, true);
  assert.equal(
    adjudication.artifact_checks.every((artifact) => artifact.exists),
    true,
  );
  const repair = summary.tracks.find((track) => track.track_id === 'non_collapsing_repair_family');
  assert.equal(repair.distinct_result_known, true);
  assert.equal(repair.next_action, 'hold_boundary_until_next_preregistered_unit');
  const alternateS0 = summary.tracks.find((track) => track.track_id === 'alternate_s0_condition');
  assert.equal(alternateS0.distinct_result_known, true);
  assert.equal(alternateS0.next_action, 'hold_boundary_until_next_preregistered_unit');
});

test('A19 adjudication packet withholds private target and arm-provenance metadata', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-adjudication-packet-'));
  const s0 = path.join(tmpDir, 's0.txt');
  const s1 = path.join(tmpDir, 's1.txt');
  fs.writeFileSync(
    s0,
    [
      'STAGE: The learner says the tutor answered the wrong concern.',
      'TUTOR: I will keep explaining the original assignment requirement.',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    s1,
    [
      'STAGE: The learner says the tutor answered the wrong concern.',
      'TUTOR: I withdraw that framing and will restate the concern you actually raised before continuing.',
    ].join('\n'),
    'utf8',
  );
  const packet = buildAdjudicationPacket({
    panel: ADJUDICATION_PANEL,
    s0,
    s1,
    familyId: 'addressed_claim_withdrawal',
    siblingId: 'addressed_claim_withdrawal_fixture',
    targetAliases: ['private target alias'],
    decoyAliases: ['private decoy alias'],
    targetRepairType: 'claim_address_repair',
    decoyRepairTypes: ['repeat_explanation'],
    optionSpace: 'repair A | repair B | repair C',
    runId: 'packet-fixture',
  });
  const visible = JSON.stringify(packet.coder_packet);
  assert.equal(visible.includes('private target alias'), false);
  assert.equal(visible.includes('private decoy alias'), false);
  assert.equal(visible.includes('S0_no_policy'), false);
  assert.equal(visible.includes('S1_policy_memory'), false);
  assert.equal(packet.private_key.target_repair_type, 'claim_address_repair');
  assert.equal(packet.audit.target_aliases_visible_in_metadata, false);
  assert.equal(packet.audit.arm_provenance_visible_to_coder, false);
  assert.deepEqual(packet.audit.visible_alias_hits_in_public_transcripts, []);
  assert.equal(packet.coder_packet.response_schema.span_evidence.includes('exact public sentence'), true);
});

test('A19 adjudication merge preserves raw coder files and reports same-packet agreement', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-adjudication-merge-'));
  const s0 = path.join(tmpDir, 's0.txt');
  const s1 = path.join(tmpDir, 's1.txt');
  fs.writeFileSync(s0, 'TUTOR: I will ask a fresh test before closure.\n', 'utf8');
  fs.writeFileSync(s1, 'TUTOR: I cite both commitments, retract one, and state the new boundary.\n', 'utf8');
  const packet = buildAdjudicationPacket({
    panel: ADJUDICATION_PANEL,
    s0,
    s1,
    familyId: 'public_commitment_contradiction',
    siblingId: 'merge_fixture',
    targetAliases: ['private target alias'],
    decoyAliases: ['private decoy alias'],
    targetRepairType: 'commitment_ledger_repair',
    decoyRepairTypes: ['transfer_control'],
    optionSpace: 'repair A | repair B | repair C',
    runId: 'merge-packet-fixture',
  });
  const packetPath = path.join(tmpDir, 'packet.json');
  writeJson(packetPath, packet);
  const coder = (coderId) => ({
    schema_version: 'a19-adjudication-coder-response-v0.1',
    coder_id: coderId,
    packet_run_id: packet.run_id,
    coder_packet_sha256: packet.audit.coder_packet_sha256,
    arms: [
      {
        arm_label: 'arm_A',
        committed_option_class: 'neither',
        committed_repair: 'fresh application test',
        repair_type: 'transfer_control',
        basis_label: 'transfer_gate',
        confidence: 'high',
        span_evidence: 'ask a fresh test before closure',
        artifact_flags: ['none'],
      },
      {
        arm_label: 'arm_B',
        committed_option_class: 'target',
        committed_repair: 'commitment ledger repair',
        repair_type: 'commitment_ledger_repair',
        basis_label: 'commitment_accounting',
        confidence: 'high',
        span_evidence: 'cite both commitments, retract one',
        artifact_flags: ['none'],
      },
    ],
  });
  const coderA = path.join(tmpDir, 'coder-a.json');
  const coderB = path.join(tmpDir, 'coder-b.json');
  writeJson(coderA, coder('coder_a'));
  writeJson(coderB, coder('coder_b'));

  const report = mergeA19AdjudicationCodes({ packetPath, coderPaths: [coderA, coderB] });
  assert.equal(report.status, 'agreement_ready');
  assert.equal(report.coder_count, 2);
  assert.equal(report.arms.arm_A.raw_codes.length, 2);
  assert.equal(report.arms.arm_A.majority_code.repair_type.value, 'transfer_control');
  assert.equal(report.arms.arm_B.majority_code.committed_option_class.value, 'target');
  assert.equal(report.private_mapping_applied_after_raw_codes.arm_A.provenance, 'S0_no_policy');
  assert.deepEqual(report.issues, []);
});

test('A19 adjudication merge rejects coder files from a different packet hash', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-adjudication-merge-bad-'));
  const s0 = path.join(tmpDir, 's0.txt');
  const s1 = path.join(tmpDir, 's1.txt');
  fs.writeFileSync(s0, 'TUTOR: baseline.\n', 'utf8');
  fs.writeFileSync(s1, 'TUTOR: treatment.\n', 'utf8');
  const packet = buildAdjudicationPacket({
    panel: ADJUDICATION_PANEL,
    s0,
    s1,
    familyId: 'public_commitment_contradiction',
    siblingId: 'bad_merge_fixture',
    targetAliases: ['private target alias'],
    decoyAliases: ['private decoy alias'],
    targetRepairType: 'commitment_ledger_repair',
    decoyRepairTypes: ['transfer_control'],
    optionSpace: 'repair A | repair B | repair C',
    runId: 'bad-merge-packet-fixture',
  });
  const packetPath = path.join(tmpDir, 'packet.json');
  const coderPath = path.join(tmpDir, 'coder-bad.json');
  writeJson(packetPath, packet);
  writeJson(coderPath, {
    coder_id: 'coder_bad',
    packet_run_id: packet.run_id,
    coder_packet_sha256: 'not-the-packet-hash',
    arms: [
      {
        arm_label: 'arm_A',
        committed_option_class: 'neither',
        repair_type: 'transfer_control',
        basis_label: 'transfer_gate',
        confidence: 'low',
        span_evidence: 'baseline',
      },
      {
        arm_label: 'arm_B',
        committed_option_class: 'target',
        repair_type: 'commitment_ledger_repair',
        basis_label: 'commitment_accounting',
        confidence: 'low',
        span_evidence: 'treatment',
      },
    ],
  });
  const report = mergeA19AdjudicationCodes({ packetPath, coderPaths: [coderPath] });
  assert.equal(report.status, 'fail');
  assert.match(JSON.stringify(report.issues), /coder_packet_hash_mismatch/);
});
