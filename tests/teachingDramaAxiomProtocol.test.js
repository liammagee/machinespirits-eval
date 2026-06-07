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
import { materializeAttemptFixtures } from '../scripts/materialize-teaching-drama-axiom-attempts.js';
import { adjudicateTeachingDramaAxiomCard } from '../scripts/blind-teaching-drama-axiom-adjudication.js';
import { renderMarkdown as renderAttempt1Markdown, summarizeAttempt1Gate } from '../scripts/report-teaching-drama-axiom-attempt1.js';

const ROOT = path.resolve('.');
const PROTOCOL = path.join(ROOT, 'config', 'teaching-drama-axioms', 'a19-protocol.yaml');
const PILOT = path.join(ROOT, 'config', 'teaching-drama-axioms', 'pilot-families.yaml');

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
  assert.equal(report.summary.families, 4);
  assert.equal(report.summary.cards, 8);
  assert.deepEqual(report.provenance.zero_api, true);
  assert.equal(report.summary.verdict_counts.policy_headroom, 1);
  assert.equal(report.summary.verdict_counts.ceiling, 1);
  assert.equal(report.summary.verdict_counts.policy_failure, 1);
  assert.equal(report.summary.verdict_counts.cue_leak, 1);
  assert.equal(report.summary.verdict_counts.self_solve, 1);
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
    total_cards: 8,
    admitted_cards: 5,
    protocol_reject_cards: 1,
    artifact_cards: 2,
    policy_headroom_cards: 1,
  });
  const markdown = renderMarkdown(report);
  assert.match(markdown, /No pooled success rate is reported here/);
  assert.match(markdown, /Claims Not Licensed/);
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
  assert.match(fs.readFileSync(path.join(outDir, 'next-commands.sh'), 'utf8'), /fixture blind adjudication/);
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

test('fixture blind adjudication preserves alias withholding and classifies headroom', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-blind-'));
  const s0 = path.join(tmpDir, 's0.md');
  const s1 = path.join(tmpDir, 's1.md');
  fs.writeFileSync(
    s0,
    ['STAGE: The learner resists the move.', 'LEARNER: I still object.', 'TUTOR: I will validate then redirect.'].join('\n'),
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
