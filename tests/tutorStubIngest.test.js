import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('tutor-stub auto-eval summaries ingest into namespaced SQL tables', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutor-stub-ingest-'));
  const dbPath = path.join(tmp, 'evaluations.db');
  const summaryPath = path.join(tmp, 'auto-eval-2026-07-08T00-00-00-000Z.json');
  const tracePath = path.join(tmp, 'trace.jsonl');
  fs.writeFileSync(tracePath, '');
  fs.writeFileSync(
    summaryPath,
    `${JSON.stringify(
      {
        schema: 'machinespirits.tutor-stub.auto-eval.v1',
        startedAt: '2026-07-08T00:00:00.000Z',
        completedAt: '2026-07-08T00:01:00.000Z',
        failed: false,
        config: {
          runs: 1,
          turns: 'until-grounded',
          untilGrounded: true,
          safetyTurns: 120,
          parallelism: 1,
          policies: ['field'],
          model: 'openai.mini',
          analysisModel: 'codex.gpt-5.5',
          autoLearnerModel: 'openai.mini',
          autoLearnerProfileId: 'skeptical',
          maxTokens: 4096,
          historyTurns: 4,
          memorySummary: { enabled: true, rawRecentTurns: 4 },
          world: 'world_005_marrick',
          traceDir: tmp,
        },
        aggregates: {
          rows: 1,
          completed: 1,
          ok: 1,
          failed: 0,
          dryRun: 0,
          grounded: 1,
          groundedRate: 1,
          meanTurns: 12,
          meanCoverage: 1,
          meanMissing: 0,
          registerCounts: { plain: 2, precise: 3 },
          registerEntropy: 0.971,
          leakCount: 0,
          errorCount: 0,
        },
        rows: [
          {
            policy: 'field',
            runIndex: 1,
            status: 'ok',
            exitCode: 0,
            signal: null,
            log: path.join(tmp, 'field-r1.log'),
            trace: tracePath,
            traceRelative: 'trace.jsonl',
            events: 10,
            turnCount: 12,
            lastTurn: 12,
            stopReason: 'auto_grounded_closure',
            groundedClosure: true,
            bestPathCoverage: 1,
            missingPremiseCount: 0,
            bottleneck: 'grounded_asserted_secret',
            finalLearner: 'Edony struck the light shillings.',
            finalTutor: 'Case closed.',
            registerCounts: { plain: 2, precise: 3 },
            registerEntropy: 0.971,
            responseConfigurationVisibility: {
              mean_realization_rate: 0.8,
              pairwise_visible_difference_rate: 1,
            },
            efficacyCounts: { positive_progress: 1 },
            leakCount: 0,
            repairedCount: 1,
            fallbackCount: 0,
            errorCount: 0,
            field: { final: { mastery: 1 } },
            trainingExamples: {
              schema: 'machinespirits.tutor-stub.turn-training-examples.v1',
              purpose: 'transition_and_reward_modeling',
              turnCount: 1,
              examples: [
                {
                  schema: 'machinespirits.tutor-stub.turn-training-example.v1',
                  turn: 1,
                  policy: 'field',
                  action: {
                    engagementStance: 'precise',
                    selectedRegister: 'precise',
                    actionFamily: 'close_inquiry',
                    audienceRegister: 'informed_peer',
                    lexicalAccessibility: 'technical',
                    sceneImmersion: 'immersive',
                    responseConfiguration: {
                      engagement_stance: 'precise',
                      action_family: 'close_inquiry',
                      audience_register: 'informed_peer',
                      lexical_accessibility: 'technical',
                      scene_immersion: 'immersive',
                    },
                    responseConfigurationAudit: {
                      realization_rate: 0.8,
                      transcript_visible: true,
                    },
                    registerPolicy: 'field',
                    registerVector: { precise: 0.72, warm: 0.28 },
                    registerDistribution: [
                      { register: 'precise', probability: 0.72 },
                      { register: 'warm', probability: 0.28 },
                    ],
                    registerVectorEntropyBits: 0.855,
                    tutorText: 'Case closed.',
                  },
                  stateBeforeAction: {
                    learnerText: 'The assay now licenses Edony.',
                    learnerState: { requestType: 'evidence_to_claim' },
                    dag: { bottleneck: 'assertion_gap', bestPathCoverage: 0.75, missingPremiseCount: 1 },
                    field: { learnerMastery: 0.7, learnerRisk: 0.2, coverage: 0.75, jointMomentum: 0.4 },
                    stateVector: { evidence_gap: 0.25, warrant_gap: 0.4 },
                    derivativeVector: { field_velocity: 0.1, risk_velocity: -0.04 },
                    trajectory: { source: 'dynamical_system_policy' },
                    humanDiscourse: {
                      schema: 'machinespirits.tutor-stub.human-discourse-frame.v1',
                      mode: 'defeasible_human_scaffold',
                      scaffoldActive: true,
                      scaffoldState: {
                        branch: { id: 'blank_chain', label: 'blank and metal provenance' },
                        localQuestion: 'What does the metal evidence license?',
                      },
                      sideArc: { detected: false, type: null },
                      proofDebt: { status: 'open_proof_debt', counts: { open: 1, harmful: 0, discharged: 0 } },
                      warrantPremiseAudit: {
                        proofStatus: 'provisional_scaffold',
                        counts: { explicitWarrants: 0, missingWarrants: 1 },
                      },
                    },
                  },
                  outcomeAfterNextLearner: {
                    nextTurn: 2,
                    dag: { bottleneck: 'grounded_asserted_secret', bestPathCoverage: 1 },
                    field: { learnerMastery: 0.9, learnerRisk: 0.1, coverage: 1, jointMomentum: 0.55 },
                    stateVector: { evidence_gap: 0, warrant_gap: 0.1 },
                    groundedClosure: true,
                  },
                  response: { leakOk: true, efficacyLabel: 'positive_progress' },
                  events: ['assertion_gap'],
                  rewardProxy: {
                    schema: 'machinespirits.tutor-stub.reward-proxy.v1',
                    score: 0.17,
                    deltas: {
                      learnerMastery: 0.2,
                      learnerRisk: -0.1,
                      coverage: 0.25,
                      jointMomentum: 0.15,
                    },
                  },
                  frame: { turn: 1, selectedRegister: 'precise' },
                  transcriptTurn: { turn: 1, learner: 'The assay now licenses Edony.', tutor: 'Case closed.' },
                },
              ],
            },
          },
        ],
        report: { html: path.join(tmp, 'auto-eval-2026-07-08T00-00-00-000Z.html') },
      },
      null,
      2,
    )}\n`,
  );

  execFileSync(process.execPath, ['scripts/ingest-tutor-stub-auto-evals.js', summaryPath, '--db', dbPath], {
    cwd: ROOT,
    stdio: 'pipe',
  });

  const analysis = JSON.parse(
    execFileSync(
      process.execPath,
      ['scripts/analyze-tutor-stub-auto-evals.js', '--db', dbPath, '--no-ledger', '--no-dir', '--json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ),
  );
  assert.deepEqual(analysis.sources, { db: 1 });
  assert.equal(analysis.latest.runId, 'auto-eval-2026-07-08T00-00-00-000Z');
  assert.equal(analysis.policySummary[0].policy, 'field');

  const db = new Database(dbPath, { readonly: true });
  try {
    const run = db
      .prepare('SELECT id, auto_learner_profile_id, ok_rows, grounded_rows FROM tutor_stub_eval_runs')
      .get();
    assert.equal(run.id, 'auto-eval-2026-07-08T00-00-00-000Z');
    assert.equal(run.auto_learner_profile_id, 'skeptical');
    assert.equal(run.ok_rows, 1);
    assert.equal(run.grounded_rows, 1);

    const row = db
      .prepare(
        `SELECT policy, turn_count, grounded_closure, configuration_realization_rate,
                configuration_visible_difference_rate
         FROM tutor_stub_eval_rows`,
      )
      .get();
    assert.equal(row.policy, 'field');
    assert.equal(row.turn_count, 12);
    assert.equal(row.grounded_closure, 1);
    assert.equal(row.configuration_realization_rate, 0.8);
    assert.equal(row.configuration_visible_difference_rate, 1);

    const registerTotal = db.prepare('SELECT SUM(count) AS total FROM tutor_stub_register_counts').get();
    assert.equal(registerTotal.total, 5);

    const turnFrame = db
      .prepare(
        `SELECT engagement_stance, selected_register, action_family, audience_register,
                lexical_accessibility, scene_immersion, response_configuration_json,
                response_configuration_audit_json, configuration_realization_rate,
                configuration_transcript_visible, register_vector_json, state_vector_json, dag_json,
                human_discourse_json, scaffold_state_json, side_arc_json,
                proof_debt_json, warrant_premise_audit_json,
                learner_text, tutor_text, delta_mastery, delta_risk, delta_coverage
         FROM tutor_stub_turn_frames`,
      )
      .get();
    assert.equal(turnFrame.selected_register, 'precise');
    assert.equal(turnFrame.engagement_stance, 'precise');
    assert.equal(turnFrame.action_family, 'close_inquiry');
    assert.equal(turnFrame.audience_register, 'informed_peer');
    assert.equal(turnFrame.lexical_accessibility, 'technical');
    assert.equal(turnFrame.scene_immersion, 'immersive');
    assert.equal(JSON.parse(turnFrame.response_configuration_json).engagement_stance, 'precise');
    assert.equal(JSON.parse(turnFrame.response_configuration_audit_json).transcript_visible, true);
    assert.equal(turnFrame.configuration_realization_rate, 0.8);
    assert.equal(turnFrame.configuration_transcript_visible, 1);
    assert.deepEqual(JSON.parse(turnFrame.register_vector_json), { precise: 0.72, warm: 0.28 });
    assert.deepEqual(JSON.parse(turnFrame.state_vector_json), { evidence_gap: 0.25, warrant_gap: 0.4 });
    assert.equal(JSON.parse(turnFrame.dag_json).bottleneck, 'assertion_gap');
    assert.equal(JSON.parse(turnFrame.human_discourse_json).mode, 'defeasible_human_scaffold');
    assert.equal(JSON.parse(turnFrame.scaffold_state_json).branch.id, 'blank_chain');
    assert.equal(JSON.parse(turnFrame.side_arc_json).detected, false);
    assert.equal(JSON.parse(turnFrame.proof_debt_json).status, 'open_proof_debt');
    assert.equal(JSON.parse(turnFrame.warrant_premise_audit_json).proofStatus, 'provisional_scaffold');
    assert.equal(turnFrame.learner_text, 'The assay now licenses Edony.');
    assert.equal(turnFrame.tutor_text, 'Case closed.');
    assert.equal(turnFrame.delta_mastery, 0.2);
    assert.equal(turnFrame.delta_risk, -0.1);
    assert.equal(turnFrame.delta_coverage, 0.25);

    const trainingView = db
      .prepare(
        `SELECT policy, engagement_stance, selected_register, action_family,
                audience_register, lexical_accessibility, scene_immersion,
                configuration_realization_rate, delta_mastery, human_discourse_json
         FROM v_tutor_stub_turn_training`,
      )
      .get();
    assert.equal(trainingView.policy, 'field');
    assert.equal(trainingView.selected_register, 'precise');
    assert.equal(trainingView.engagement_stance, 'precise');
    assert.equal(trainingView.action_family, 'close_inquiry');
    assert.equal(trainingView.audience_register, 'informed_peer');
    assert.equal(trainingView.lexical_accessibility, 'technical');
    assert.equal(trainingView.scene_immersion, 'immersive');
    assert.equal(trainingView.configuration_realization_rate, 0.8);
    assert.equal(trainingView.delta_mastery, 0.2);
    assert.equal(JSON.parse(trainingView.human_discourse_json).scaffoldActive, true);

    const view = db.prepare('SELECT policy, rows, ok_rate, grounded_rate FROM v_tutor_stub_policy_summary').get();
    assert.equal(view.policy, 'field');
    assert.equal(view.rows, 1);
    assert.equal(view.ok_rate, 1);
    assert.equal(view.grounded_rate, 1);
  } finally {
    db.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
