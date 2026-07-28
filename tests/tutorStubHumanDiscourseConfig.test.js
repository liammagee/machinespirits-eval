import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_HUMAN_DISCOURSE_PHASE,
  TUTOR_STUB_HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA,
  buildTutorStubHumanDiscourseRunConfig,
} from '../services/tutorStubHumanDiscourseConfig.js';

const TRACE_FIELDS = [
  'humanDiscourseFrame',
  'scaffoldState',
  'sideArc',
  'discoursePlane',
  'proofDebt',
  'warrantPremiseAudit',
  'generousInference',
  'conversationalCompletion',
  'questionSupport',
];

test('human discourse config preserves the three mode contracts', () => {
  const cases = [
    {
      dagMode: 'strict_dag',
      scaffoldActive: false,
      stepCompression: {
        enabled: false,
        policy: 'strict proof audit only',
        maxExplicitDemandsPerTurn: 0,
      },
      scaffoldPolicy: 'strict DAG audit only; no human-scaffold prompt adaptation',
    },
    {
      dagMode: 'human_scaffold',
      scaffoldActive: true,
      stepCompression: {
        enabled: false,
        policy: 'frame one local warrant without expanding the whole proof chain',
        maxExplicitDemandsPerTurn: 1,
      },
      scaffoldPolicy: 'frame local human-facing warrants while strict DAG audit remains authoritative',
    },
    {
      dagMode: 'defeasible_human_scaffold',
      scaffoldActive: true,
      stepCompression: {
        enabled: true,
        policy:
          'accept obvious public bridges as implied proof debt; ask for explicit warrants only when the leap is unsafe, conflicting, or case-closing',
        maxExplicitDemandsPerTurn: 1,
      },
      scaffoldPolicy:
        'allow learner-owned compressed inference, keep implied proof debt internal, and only surface warrant gaps when they matter',
    },
  ];

  for (const expected of cases) {
    assert.deepEqual(
      buildTutorStubHumanDiscourseRunConfig({
        dagMode: expected.dagMode,
        dagEnabled: 1,
        tutorLearnerDagEnabled: 0,
      }),
      {
        schema: TUTOR_STUB_HUMAN_DISCOURSE_RUN_CONFIG_SCHEMA,
        dagMode: expected.dagMode,
        strictAuditDag: true,
        tutorLearnerDag: false,
        phase: TUTOR_STUB_HUMAN_DISCOURSE_PHASE,
        scaffoldActive: expected.scaffoldActive,
        stepCompression: expected.stepCompression,
        scaffoldPolicy: expected.scaffoldPolicy,
        traceFields: TRACE_FIELDS,
        behaviorChange: expected.scaffoldActive,
      },
    );
  }
});

test('human discourse config coerces only the runtime enablement flags', () => {
  const config = buildTutorStubHumanDiscourseRunConfig({
    dagMode: 'strict_dag',
    dagEnabled: '',
    tutorLearnerDagEnabled: 'enabled',
  });

  assert.equal(config.strictAuditDag, false);
  assert.equal(config.tutorLearnerDag, true);
  assert.equal(config.dagMode, 'strict_dag');
});
