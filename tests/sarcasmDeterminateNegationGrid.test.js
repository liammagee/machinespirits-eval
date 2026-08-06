import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

import {
  buildSarcasmDeterminateNegationGridPlan,
  summarizeSarcasmDeterminateNegationGrid,
  validateSarcasmDeterminateNegationGridPlan,
} from '../services/sarcasmDeterminateNegationGrid.js';
import { followUpCommands, generationCommand } from '../scripts/run-sarcasm-determinate-negation-grid.js';
import { evaluateRegisterStanceFidelity, findNamedTargetClaim } from '../services/registerStanceFidelity.js';
import { evaluateNegationRecoveryDeterministic } from '../services/negationRecovery.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'config/register-exemplars/sarcasm-determinate-negation.yaml');

function completeAnalyses() {
  const scenarios = ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting'];
  const analyses = [];
  for (const target of scenarios) {
    for (let repeat = 1; repeat <= 3; repeat += 1) {
      const faithful = repeat !== 2;
      analyses.push({
        rowId: `${target}-${repeat}`,
        profileName: 'cell_202_id_director_sarcastic_determinate_challenge_breakthrough_dynamic_verified',
        scenarioId: `charisma_desire_resistance_breakthrough_${target}`,
        targetSignal: target,
        tutorV22Score: 60,
        tutorRubricVersion: '2.2',
        tutorJudgeModel: 'claude-code/claude-sonnet-5',
        registerRubricScore: 70,
        registerJudgeModel: 'claude-code.sonnet-5',
        stanceFidelity: {
          applies: true,
          countsAsArmEvidence: faithful,
          countsAsExcludedNoncompliance: !faithful,
          countsAsInvalidViolation: false,
        },
        recovery: faithful ? { recovered: repeat === 1 } : null,
      });
    }
  }
  return analyses;
}

describe('sarcasm determinate-negation grid', () => {
  it('freezes a deterministic 1 x 5 x 3 plan', () => {
    const first = buildSarcasmDeterminateNegationGridPlan();
    const second = buildSarcasmDeterminateNegationGridPlan();
    const validation = validateSarcasmDeterminateNegationGridPlan(first);
    assert.equal(validation.ok, true);
    assert.equal(first.plannedRows, 15);
    assert.equal(validation.observedCells, 5);
    assert.equal(first.planSha256, second.planSha256);
  });

  it('pins generation and scoring seams to the parent grid', () => {
    const generation = generationCommand();
    const followUps = followUpCommands('eval-example');
    assert.equal(generation[generation.indexOf('--tutor-model') + 1], 'codex.gpt-5.5');
    assert.equal(generation[generation.indexOf('--learner-model') + 1], 'codex.gpt-5.5');
    assert.ok(generation.includes('--skip-rubric'));
    assert.equal(followUps[0][followUps[0].indexOf('--model') + 1], 'claude-sonnet-5');
    assert.equal(followUps[1][followUps[1].indexOf('--judge') + 1], 'claude-code.sonnet-5');
  });

  it('reports COMPLETE only when faithful rows carry recovery verdicts', () => {
    const complete = summarizeSarcasmDeterminateNegationGrid(completeAnalyses());
    assert.equal(complete.status, 'COMPLETE');
    assert.equal(complete.observedRows, 15);

    const missingRecovery = completeAnalyses();
    missingRecovery[0].recovery = null;
    const incomplete = summarizeSarcasmDeterminateNegationGrid(missingRecovery);
    assert.equal(incomplete.status, 'INCOMPLETE');
    assert.ok(incomplete.errors.some((error) => error.includes('missing negation-recovery verdict')));
  });

  it('withholds the faithful label from determinate sarcasm without a named target claim', () => {
    const learnerMessage = 'That is the formula I memorized, so the master stays free forever.';
    const withoutClaim = evaluateRegisterStanceFidelity({
      registerName: 'sarcastic_determinate_challenge',
      tutorMessage:
        'Wonderful — apparently the formula settles everything. Test the claim against the recognition passage and name what the master receives.',
      learnerMessage,
      postLearnerMessage: 'Fine, I will test it.',
    });
    assert.notEqual(withoutClaim.label, 'faithful');
    assert.ok(withoutClaim.missing.includes('named_target_claim'));

    const withClaim = evaluateRegisterStanceFidelity({
      registerName: 'sarcastic_determinate_challenge',
      tutorMessage:
        'Wonderful — "the master stays free forever," a formula so tidy it conveniently skips the chapter. If mastery worked, then he would get real recognition. Test the formula and name what he actually receives.',
      learnerMessage,
      postLearnerMessage: 'Fine, I will test it.',
    });
    assert.equal(withClaim.label, 'faithful');
    assert.equal(withClaim.namedTargetClaim.named, true);
  });

  it('does not change the plain sarcastic register scoring', () => {
    const plain = evaluateRegisterStanceFidelity({
      registerName: 'sarcastic_challenge',
      tutorMessage:
        'Wonderful — apparently the formula settles everything. Test the claim against the recognition passage and name what the master receives.',
      learnerMessage: 'That is the formula I memorized.',
      postLearnerMessage: 'Fine, I will test it.',
    });
    assert.equal(plain.label, 'faithful');
    assert.equal(plain.namedTargetClaim, undefined);
  });

  it('detects named claims by echoed quote and by naming frame', () => {
    const learner = 'The duel is just a metaphor and I can pass the quiz without it.';
    assert.equal(findNamedTargetClaim('Apparently "the duel is just a metaphor" settles it.', learner).named, true);
    assert.equal(findNamedTargetClaim('Your claim that the duel is decorative is wonderful.', learner).named, true);
    assert.equal(findNamedTargetClaim('Wonderful, apparently everything is settled now.', learner).named, false);
  });

  it('stays out of every automatic tutor-stub palette but accepts an explicit listing', async () => {
    const { buildTutorStubRegisterPalette } = await import('../services/tutorStubRegisterPalette.js');
    const { getEngagementStanceDefinitions } = await import('../services/engagementRegisterRegistry.js');
    const definitions = getEngagementStanceDefinitions();
    assert.equal(definitions.sarcastic_determinate?.experiment_arm_only, true);
    for (const mode of ['all', 'non-simulated', 'simulated']) {
      const palette = buildTutorStubRegisterPalette(mode, { definitions });
      assert.ok(!palette.includes('sarcastic_determinate'), `mode ${mode} must exclude the experiment arm`);
      assert.ok(palette.includes('sarcastic'), `mode ${mode} keeps the plain sarcastic register`);
    }
    const explicit = buildTutorStubRegisterPalette('sarcastic_determinate', { definitions });
    assert.deepEqual(explicit, ['sarcastic_determinate']);
  });

  it('holds the fixture: stance labels and deterministic recovery verdicts', () => {
    const fixture = yaml.parse(fs.readFileSync(FIXTURE, 'utf8'));
    for (const exemplar of fixture.exemplars) {
      const stance = evaluateRegisterStanceFidelity({
        registerName: fixture.register,
        tutorMessage: exemplar.tutor_message,
        learnerMessage: exemplar.learner_message,
        postLearnerMessage: exemplar.post_learner_message,
      });
      assert.equal(stance.label, exemplar.expected.stance_fidelity, `${exemplar.id} stance`);
      if (exemplar.corrected_claim) {
        const recovery = evaluateNegationRecoveryDeterministic({
          correctedClaim: exemplar.corrected_claim,
          postLearnerMessage: exemplar.post_learner_message,
        });
        assert.equal(recovery.recovered, Boolean(exemplar.expected.negation_recovery), `${exemplar.id} recovery`);
      }
    }
  });
});
