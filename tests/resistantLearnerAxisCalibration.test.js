import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RESISTANT_LEARNER_AXIS_DEFINITIONS,
  observeResistantLearnerAxes,
} from '../services/resistantLearnerAxisObservation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function classification({ discourseMove = 'question', evidenceUse = 'none', agency = 'steering' } = {}) {
  return {
    request_type: 'synthetic',
    discourse_move: discourseMove,
    evidence_use: evidenceUse,
    epistemic_stance: 'resistant',
    agency,
  };
}

test('calibration-only axes distinguish public resistance kinds without changing the registered observer', () => {
  assert.deepEqual(
    RESISTANT_LEARNER_AXIS_DEFINITIONS.map((definition) => definition.axis),
    ['effort_investment', 'learner_authorship', 'evidential_orientation', 'epistemic_trust', 'frame_legitimacy'],
  );

  const cases = [
    ['Sure. Whatever.', classification({ discourseMove: 'off_task', agency: 'complying' }), 'effort_investment'],
    ['Can you choose which part of the blank I should examine first?', classification(), 'learner_authorship'],
    ['What public evidence links this flaw to the striking hand?', classification(), 'evidential_orientation'],
    ['What public evidence ties it to Verrell rather than your assumption?', classification(), 'epistemic_trust'],
    [
      'I will test the graver’s die-flaw, but not under your authority to decide what it proves.',
      classification({ discourseMove: 'challenge' }),
      'frame_legitimacy',
    ],
  ];
  for (const [learnerText, turnClassification, axis] of cases) {
    const result = observeResistantLearnerAxes({ learnerText, classification: turnClassification });
    assert.equal(result.authority, 'calibration_only');
    assert.equal(result.changes_registered_observation, false);
    assert.notEqual(result.axes[axis].state, 'not_observed', learnerText);
  }

  const ordinary = observeResistantLearnerAxes({
    learnerText: 'The die flaw links the blank to this graver, so I would test that match next.',
    classification: classification({ discourseMove: 'inference', evidenceUse: 'links_evidence_to_rule' }),
  });
  assert.equal(
    Object.values(ordinary.axes).every((axis) => axis.state === 'not_observed'),
    true,
  );
});

function writeTrace(root, profile, learner, turnClassification) {
  const directory = path.join(root, profile, 'traces', 'field-r1');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'trace.jsonl');
  const events = [
    {
      type: 'run_start',
      metadata: {
        profileId: profile,
        modelRef: 'codex.gpt-5.6-luna',
        classifier: { modelRef: 'codex.gpt-5.6-luna' },
        autoLearner: { modelRef: 'codex.gpt-5.6-luna' },
      },
    },
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 1,
        learner,
        tutor: 'Continue with the public evidence.',
        classification: { turn: turnClassification },
        registerSelection: { policy: 'field' },
      },
    },
  ];
  fs.writeFileSync(file, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  return file;
}

test('standalone calibration binds an unchanged negative report and emits no replacement verdict', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'resistant-axis-calibration-'));
  try {
    const rows = [
      ['diligent', 'The die flaw links the blank to this graver.', classification({ discourseMove: 'inference' })],
      ['bored', 'Sure. Whatever.', classification({ discourseMove: 'off_task', agency: 'complying' })],
      ['low_agency', 'Can you choose which part I should test?', classification()],
      ['skeptical', 'What public evidence links this flaw to the striking hand?', classification()],
      ['low_trust_skeptic', 'What public evidence ties it to Verrell rather than your assumption?', classification()],
      [
        'frame_defiant',
        'I will test the graver’s die-flaw, but not under your authority to decide what it proves.',
        classification({ discourseMove: 'challenge' }),
      ],
    ];
    const traces = rows.map(([profile, learner, turnClassification]) =>
      writeTrace(temporary, profile, learner, turnClassification),
    );
    const registeredReport = path.join(temporary, 'registered-result.json');
    fs.writeFileSync(
      registeredReport,
      `${JSON.stringify({ schema: 'machinespirits.tutor-stub.profile-discrimination.v4', gate: { pass: false } })}\n`,
    );
    const registeredSha = crypto.createHash('sha256').update(fs.readFileSync(registeredReport)).digest('hex');
    const traceArgs = traces.flatMap((trace) => ['--trace', trace]);
    const report = JSON.parse(
      execFileSync(
        process.execPath,
        [
          'scripts/analyze-tutor-stub-resistance-axis-calibration.js',
          ...traceArgs,
          '--registered-report',
          registeredReport,
          '--required-registered-report-sha256',
          registeredSha,
          '--required-traces',
          '6',
          '--required-profiles',
          'diligent,bored,low_agency,skeptical,low_trust_skeptic,frame_defiant',
          '--required-runs-per-profile',
          '1',
          '--required-turns',
          '1',
          '--required-policies',
          'field',
          '--required-tutor-model',
          'codex.gpt-5.6-luna',
          '--required-analysis-model',
          'codex.gpt-5.6-luna',
          '--required-learner-model',
          'codex.gpt-5.6-luna',
          '--json',
        ],
        { cwd: ROOT, encoding: 'utf8' },
      ),
    );

    assert.equal(report.schema, 'machinespirits.tutor-stub.resistance-axis-calibration.v1');
    assert.equal(report.authority, 'calibration_only');
    assert.equal(report.changesRegisteredResult, false);
    assert.equal(report.pass, null);
    assert.equal(report.integrity.pass, true);
    assert.equal(report.integrity.registeredResult.unchanged, true);
    assert.equal(report.integrity.registeredResult.registeredGatePass, false);
    assert.equal(
      report.profiles.find((profile) => profile.profile === 'low_agency').axes.learner_authorship.observedRate,
      1,
    );
    assert.equal(
      report.profiles.find((profile) => profile.profile === 'low_trust_skeptic').axes.epistemic_trust.observedRate,
      1,
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
