import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..');

function configuration(register) {
  return {
    engagement_stance: register,
    action_family: register === 'plain' ? 'clarify_term' : 'challenge_resistance',
    audience_register: 'adult_novice',
    lexical_accessibility: register === 'plain' ? 'plain' : 'standard',
    scene_immersion: 'grounded',
    actorial_part: register === 'plain' ? 'scene_partner' : 'skeptic',
  };
}

function turnRecord(runId, turn, register, { rating = null, outcome = null, evaluatedRegister = null } = {}) {
  const previousTurn = turn - 1;
  const responseConfiguration = configuration(register);
  return {
    turn,
    turnId: `${runId}:t${String(turn).padStart(3, '0')}`,
    learner: `learner turn ${turn}`,
    classification: {
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'claim',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'grounded',
        agency: 'attempting',
        scores: {},
      },
    },
    tutorLearnerDagModel: { metrics: {}, assessment: { bestPathCoverage: 0.3 } },
    registerSelection: {
      selected_register: register,
      policy: 'test_policy',
      response_configuration: responseConfiguration,
    },
    responseConfiguration,
    tutor: `Tutor response ${turn} in ${register}.`,
    provider: 'codex',
    model: 'test-model',
    tutorLeakAudit: { ok: true },
    ...(turn > 1
      ? {
          learnerInput: {
            tutorFeedback: {
              requested: true,
              supplied: true,
              rating,
              targetTutorTurn: previousTurn,
              targetTutorTurnId: `${runId}:t${String(previousTurn).padStart(3, '0')}`,
              source: 'human_learner',
            },
          },
          previousRegisterEfficacy: {
            selected_register: evaluatedRegister,
            registerTurn: previousTurn,
            evaluatedAtTurn: turn,
            label: outcome > 0 ? 'positive_progress' : 'regression_or_overreach',
            progressScore: outcome > 0 ? 4 : -4,
            dagProgress: outcome > 0,
            field: { delta: outcome > 0 ? 0.2 : -0.2 },
          },
        }
      : {}),
  };
}

function writeTrace(file, runId) {
  const rows = [];
  for (let turn = 1; turn <= 5; turn += 1) {
    const evaluatedRegister = turn > 1 && turn % 2 === 0 ? 'plain' : 'warm';
    const register = turn % 2 === 1 ? 'plain' : 'warm';
    rows.push({
      type: 'turn_complete',
      runId,
      turn,
      turnRecord: turnRecord(runId, turn, register, {
        rating: evaluatedRegister === 'plain' ? 'up' : 'down',
        outcome: evaluatedRegister === 'plain' ? 1 : -1,
        evaluatedRegister,
      }),
    });
  }
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

function writeRatingOnlyTrace(file, runId) {
  const target = turnRecord(runId, 1, 'plain');
  const rows = [
    { type: 'turn_complete', runId, turn: 1, turnRecord: target },
    {
      type: 'tutor_feedback_rating_recorded',
      runId,
      turn: 1,
      turnId: target.turnId,
      record: {
        schema: 'machinespirits.tutor-stub.feedback-rating-record.v1',
        feedback: { rating: 'up', helpfulness: 1 },
        ratedResponse: {
          turn: 1,
          turnId: target.turnId,
          responseConfiguration: configuration('plain'),
          responseConfigurationAudit: { transcript_visible: true },
          provider: 'codex',
          model: 'test-model',
          safety: { passed: true },
        },
        provenance: { runId, worldId: 'test-world', learnerProfileId: 'diligent' },
      },
    },
  ];
  fs.writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

test('register-prior builder scans human ratings, deduplicates repeated traces, and gates use on held-out runs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-priors-'));
  const traces = path.join(temp, 'traces');
  const out = path.join(temp, 'priors.json');
  fs.mkdirSync(traces, { recursive: true });
  for (let index = 0; index < 5; index += 1) {
    writeTrace(path.join(traces, `run-${index}.jsonl`), `run-${index}`);
  }
  writeTrace(path.join(traces, 'run-0-copy.jsonl'), 'run-0');
  writeRatingOnlyTrace(path.join(traces, 'rating-only.jsonl'), 'rating-only');

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, 'scripts/build-tutor-stub-register-priors.js'),
      '--root',
      traces,
      '--exports-root',
      path.join(temp, 'no-exports'),
      '--out',
      out,
      '--min-n',
      '1',
    ],
    { cwd: ROOT, stdio: 'pipe' },
  );

  const prior = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(prior.schema, 'machinespirits.tutor-stub.register-empirical-priors.v2');
  assert.equal(prior.source.rawObservationCount, 25);
  assert.equal(prior.source.observationCount, 21);
  assert.equal(prior.source.duplicateObservationCount, 4);
  assert.equal(prior.source.humanFeedbackObservationCount, 21);
  assert.equal(prior.humanHelpfulnessPriors.register.plain.n, 11);
  assert.equal(prior.humanHelpfulnessPriors.register.warm.n, 10);
  assert.equal(prior.humanHelpfulnessPriors.runtimeUse, 'advisory_only');
  assert.equal(prior.validation.status, 'passed');
  assert.equal(prior.deployment.objectiveRegisterPriorEligible, true);
  assert.deepEqual(prior.deployment.eligibleModels, ['codex/test-model']);
  assert.equal(prior.modelPriors['codex/test-model'].validation.status, 'passed');
  assert.equal(prior.deployment.humanPreferencePriorEligible, false);
});
