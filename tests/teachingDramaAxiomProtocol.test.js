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
import { denominatorSummary, renderMarkdown } from '../scripts/report-teaching-drama-axiom-framework.js';

const ROOT = path.resolve('.');
const PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const PILOT = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');

function writeYaml(filePath, data) {
  fs.writeFileSync(filePath, yaml.stringify(data), 'utf8');
}

function baseFixture(overrides = {}) {
  return {
    meta: {
      schema_version: 'teaching-drama-axiom-families-v0.1',
      protocol_id: 'A19',
      protocol_version: 'a19-drama-axiom-transfer-v0.1',
      prompt_version: 'a19-fixture-test',
      fixture_only: true,
      no_model_calls: true,
    },
    families: [
      {
        family_id: 'test_family',
        learner_resistance_type: 'counter_warrant',
        tutor_infelicity_type: 'validation_without_engagement',
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
  assert.equal(report.summary.families, 3);
  assert.equal(report.summary.cards, 6);
  assert.deepEqual(report.provenance.zero_api, true);
  assert.equal(report.summary.verdict_counts.policy_headroom, 1);
  assert.equal(report.summary.verdict_counts.ceiling, 1);
  assert.equal(report.summary.verdict_counts.policy_failure, 1);
  assert.equal(report.summary.verdict_counts.cue_leak, 1);
  assert.equal(report.summary.verdict_counts.self_solve, 1);
  assert.equal(report.summary.verdict_counts.arbiter_disagreement, 1);
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
    classifyCardVerdict(mk({ committed_option_class: 'decoy', artifact_flags: [] }, { committed_option_class: 'target', artifact_flags: [] }), protocol),
    'policy_headroom',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'target', basis_label: 'ordinary_public_inference', artifact_flags: [] }, { committed_option_class: 'target', artifact_flags: [] }), protocol),
    'ceiling',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'target', basis_label: 'registered_relation_without_policy', artifact_flags: [] }, { committed_option_class: 'target', artifact_flags: [] }), protocol),
    'self_solve',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'decoy', artifact_flags: [] }, { committed_option_class: 'decoy', artifact_flags: [] }), protocol),
    'policy_failure',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'target', artifact_flags: ['cue_leak'] }, { committed_option_class: 'target', artifact_flags: [] }), protocol),
    'cue_leak',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'neither', artifact_flags: ['arbiter_disagreement'] }, { committed_option_class: 'neither', artifact_flags: [] }), protocol),
    'arbiter_disagreement',
  );
  assert.equal(
    classifyCardVerdict(mk({ committed_option_class: 'neither', artifact_flags: [] }, { committed_option_class: 'neither', artifact_flags: [] }), protocol),
    'neither_correct',
  );
});

test('framework report separates denominators and refuses a pooled rate', () => {
  const report = validateTeachingDramaAxiomProtocol({ protocolPath: PROTOCOL, configPath: PILOT });
  const denominators = denominatorSummary(report.cards);
  assert.deepEqual(denominators, {
    total_cards: 6,
    admitted_cards: 4,
    protocol_reject_cards: 0,
    artifact_cards: 2,
    policy_headroom_cards: 1,
  });
  const markdown = renderMarkdown(report);
  assert.match(markdown, /No pooled success rate is reported here/);
  assert.match(markdown, /Claims Not Licensed/);
});
