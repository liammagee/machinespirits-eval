import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildLearnerMovePrompt,
  buildTutorMovePrompt,
  normalizeRoleMove,
  runRoleSeparatedEvaluation,
  stripA19Metadata,
} from '../scripts/run-a19-role-separated-eval.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

test('role-separated prompts keep policy memory out of the learner prompt', () => {
  const publicTranscript = stripA19Metadata(`# A19 Held-Out Base: x

FAMILY: hidden_family
SIBLING: hidden_sibling

STAGE: A learner is choosing evidence.
LEARNER: The vivid quote feels strongest.
TUTOR: I will keep using vividness.

HEADROOM_PREDICTION: hidden`);

  assert.equal(
    publicTranscript,
    [
      'STAGE: A learner is choosing evidence.',
      'LEARNER: The vivid quote feels strongest.',
      'TUTOR: I will keep using vividness.',
    ].join('\n'),
  );

  const policyMemory = 'A19 admitted teaching-drama axiom\n- axiom_id: secret_axiom\n- repair_type: name_warrant';
  const tutorPrompt = buildTutorMovePrompt({ publicTranscript, policyMemoryText: policyMemory });
  assert.match(tutorPrompt.systemPrompt, /secret_axiom/);

  const learnerPrompt = buildLearnerMovePrompt({
    publicTranscript,
    tutorMove: 'TUTOR: Which evidence role supports the traffic-change claim?',
  });
  assert.doesNotMatch(learnerPrompt.systemPrompt, /secret_axiom|policy memory|S1_policy_memory/);
  assert.doesNotMatch(learnerPrompt.userPrompt, /secret_axiom|policy memory|S1_policy_memory/);
});

test('normalizeRoleMove emits exactly the requested public role prefix', () => {
  assert.equal(
    normalizeRoleMove('I will ask for the evidence role.', 'tutor'),
    'TUTOR: I will ask for the evidence role.',
  );
  assert.equal(
    normalizeRoleMove('LEARNER: I can only use what is public.', 'learner'),
    'LEARNER: I can only use what is public.',
  );
});

test('mock role-separated run assembles S0 and S1 public arms before blind adjudication', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'a19-role-separated-'));
  const config = path.join(tmp, 'pilot-families.yaml');
  const materializedRoot = path.join(tmp, 'materialized');
  const familyDir = path.join(materializedRoot, 'role-sep-family', 'role-sep-family-a');
  const axiom = path.join(tmp, 'axiom.json');
  const outDir = path.join(tmp, 'out');

  fs.mkdirSync(familyDir, { recursive: true });
  fs.writeFileSync(
    path.join(familyDir, 'heldout-base.full.md'),
    [
      '# A19 Held-Out Base: role_sep_family_a',
      '',
      'FAMILY: role_sep_family',
      'SIBLING: role_sep_family_a',
      'PHASE: heldout_sibling_base',
      '',
      'STAGE: The learner has a vivid quote that does not support the claim.',
      'LEARNER: The quote is vivid, but it does not show the traffic changed.',
      'TUTOR: I will keep using vivid evidence as the strongest evidence.',
      '',
      'HEADROOM_PREDICTION: s0_may_keep_vividness',
    ].join('\n'),
  );

  fs.writeFileSync(
    config,
    [
      'families:',
      '  - family_id: role_sep_family',
      '    target_policy:',
      '      policy_id: evidence_role_policy',
      '      repair_type: name_warrant',
      '    plausible_repairs:',
      '      - evidence_role_policy',
      '      - choose_vivid_evidence',
      '    heldout_siblings:',
      '      - sibling_id: role_sep_family_a',
      '        target_aliases:',
      '          - evidence role',
      '        decoy_aliases:',
      '          - vivid evidence',
      '        blind_adjudication:',
      '          neutral_option_space: repair A | repair B | repair C',
    ].join('\n'),
  );

  writeJson(axiom, {
    schema_version: 'a19-teaching-drama-axiom-v0.1',
    status: 'admitted',
    axiom_id: 'role_sep_axiom_001',
    repair_type: 'name_warrant',
    trigger: 'learner notices vivid evidence has the wrong role',
    avoided_move: 'choose vivid evidence',
    replacement_move: 'ask which evidence role supports the claim',
    applicability_conditions: ['public role mismatch is visible'],
    anti_conditions: ['learner only asks for style'],
  });

  const { summary } = await runRoleSeparatedEvaluation({
    config,
    familyId: 'role_sep_family',
    siblingIds: ['role_sep_family_a'],
    materializedRoot,
    axiom,
    outDir,
    k: 1,
    tutorGenerator: 'mock',
    learnerGenerator: 'mock',
    stocktakeGenerator: 'mock',
    blindMode: 'mock',
    critics: 1,
    force: true,
  });

  assert.equal(summary.role_separation.transcript_rewriter_used, false);
  assert.equal(summary.role_separation.learner_sees_policy_memory, false);
  assert.equal(summary.cards[0].policy_headroom_count, 1);
  const s1Transcript = fs.readFileSync(
    path.join(outDir, 'role-sep-family-a', 'seed1', 's1-role', 'assembled-public.txt'),
    'utf8',
  );
  assert.match(s1Transcript, /^TUTOR:/m);
  assert.match(s1Transcript, /^LEARNER:/m);
  assert.doesNotMatch(s1Transcript, /FAMILY:|HEADROOM_PREDICTION|role_sep_axiom_001/);
});
