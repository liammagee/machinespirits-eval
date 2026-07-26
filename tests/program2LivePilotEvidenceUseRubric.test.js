// The evidence_use rubric is versioned rather than edited in place, because
// swapping the classifier prompt changes which turns reach the compliance
// denominator and so shifts absolute levels (~1 point, measured on the 1,281
// graded warrant_skip turns in the Phase 5b/5c archive). These tests pin the two
// properties that make the version safe to carry: default plans are unchanged by
// the addition, and an opted-in plan cannot disagree with its own jobs.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_EVIDENCE_USE_RUBRICS,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import {
  buildPhase5LivePilotPlan,
  buildPhase5bLivePilotPlan,
  buildPhase5cLivePilotPlan,
  validatePhase5LivePilotPlan,
  validatePhase5bLivePilotPlan,
  validatePhase5cLivePilotPlan,
} from '../scripts/run-program2-live-pilot.js';

const RUBRIC_FLAG = '--learner-analysis-evidence-use-rubric';

const PLANS = [
  { label: 'phase5', build: buildPhase5LivePilotPlan, validate: validatePhase5LivePilotPlan, jobs: 24 },
  { label: 'phase5b', build: buildPhase5bLivePilotPlan, validate: validatePhase5bLivePilotPlan, jobs: 18 },
  { label: 'phase5c', build: buildPhase5cLivePilotPlan, validate: validatePhase5cLivePilotPlan, jobs: 18 },
];

for (const { label, build, validate, jobs } of PLANS) {
  test(`${label} default plan stamps v1 and emits no rubric flag`, () => {
    const plan = build();
    assert.equal(plan.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
    assert.equal(plan.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT);
    assert.equal(plan.jobs.length, jobs);
    for (const job of plan.jobs) {
      assert.ok(!job.command.includes(RUBRIC_FLAG), `${job.id} carries ${RUBRIC_FLAG} on a default plan`);
    }
  });

  test(`${label} default plan commands are unchanged by the rubric version`, () => {
    // The safety claim for in-flight arcs: passing the default explicitly and
    // omitting it entirely must produce identical commands, so a pre-versioning
    // plan and a post-versioning default plan are the same run.
    const implicit = build();
    const explicit = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT });
    assert.deepEqual(
      explicit.jobs.map((job) => job.command),
      implicit.jobs.map((job) => job.command),
    );
  });

  test(`${label} opted-in plan carries v2 on every job and nothing else moves`, () => {
    const base = build();
    const opted = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED });
    assert.equal(opted.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
    assert.equal(opted.jobs.length, base.jobs.length);
    for (const [index, job] of opted.jobs.entries()) {
      const flagIndex = job.command.indexOf(RUBRIC_FLAG);
      assert.ok(flagIndex >= 0, `${job.id} missing ${RUBRIC_FLAG}`);
      assert.equal(job.command[flagIndex + 1], TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
      // Removing the two inserted tokens must recover the default command
      // exactly: the rubric is the only thing the option is allowed to change.
      const stripped = [...job.command];
      stripped.splice(flagIndex, 2);
      assert.deepEqual(stripped, base.jobs[index].command);
    }
  });

  test(`${label} validator rejects a plan whose jobs disagree with its stamp`, () => {
    const plan = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED });
    assert.equal(validate(plan).ok, true);

    // Strip the flag from one job, leaving the header stamped v2: this is the
    // mismatch the stamp exists to catch, and it must fail closed.
    const tampered = {
      ...plan,
      jobs: plan.jobs.map((job, index) => {
        if (index !== 0) return job;
        const command = [...job.command];
        command.splice(command.indexOf(RUBRIC_FLAG), 2);
        return { ...job, command };
      }),
    };
    const result = validate(tampered);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.includes('evidence_use rubric') && error.includes(plan.jobs[0].id)),
      `expected a rubric mismatch error, got ${JSON.stringify(result.errors)}`,
    );
  });

  test(`${label} rejects an unknown rubric version`, () => {
    assert.throws(() => build({ evidenceUseRubric: 'v3' }), /invalid_evidence_use_rubric|unknown evidence_use rubric/);
  });
}
