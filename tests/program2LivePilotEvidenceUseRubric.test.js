// The evidence_use rubric is versioned rather than edited in place, because
// swapping the classifier prompt changes which turns reach the compliance
// denominator and so shifts absolute levels (~1 point, measured on the 1,135
// firing warrant_skip turns in the Program 2 archive). The default is now
// v2_bridge_voiced. These tests pin the three properties that keep that safe: a
// plan says which version it ran, an opted-in v1 plan is byte-recoverable to the
// default command set, and a plan cannot disagree with its own jobs — including
// the pre-versioning plans that carry no stamp at all.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_EVIDENCE_USE_RUBRICS,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY,
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
  test(`${label} default plan stamps v2_bridge_voiced and emits no rubric flag`, () => {
    const plan = build();
    assert.equal(plan.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
    assert.equal(plan.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT);
    assert.equal(plan.jobs.length, jobs);
    // A job omits the flag exactly when it runs the generation-time default, so
    // the stamp — not the command line — is what records the version.
    for (const job of plan.jobs) {
      assert.ok(!job.command.includes(RUBRIC_FLAG), `${job.id} carries ${RUBRIC_FLAG} on a default plan`);
    }
  });

  test(`${label} passing the default explicitly changes nothing`, () => {
    const implicit = build();
    const explicit = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT });
    assert.deepEqual(
      explicit.jobs.map((job) => job.command),
      implicit.jobs.map((job) => job.command),
    );
    assert.equal(explicit.evidenceUseRubric, implicit.evidenceUseRubric);
  });

  test(`${label} opting back to v1 carries the flag on every job and moves nothing else`, () => {
    // Reproducing the published Phase 5/5b/5c figures means running the old
    // instrument, so v1 has to stay reachable by name and cost exactly two tokens.
    const base = build();
    const legacy = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY });
    assert.equal(legacy.evidenceUseRubric, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
    assert.equal(legacy.jobs.length, base.jobs.length);
    for (const [index, job] of legacy.jobs.entries()) {
      const flagIndex = job.command.indexOf(RUBRIC_FLAG);
      assert.ok(flagIndex >= 0, `${job.id} missing ${RUBRIC_FLAG}`);
      assert.equal(job.command[flagIndex + 1], TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
      // Removing the two inserted tokens must recover the default command
      // exactly: the rubric is the only thing the option is allowed to change.
      const stripped = [...job.command];
      stripped.splice(flagIndex, 2);
      assert.deepEqual(stripped, base.jobs[index].command);
    }
  });

  test(`${label} validator rejects a plan whose jobs disagree with its stamp`, () => {
    const plan = build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY });
    assert.equal(validate(plan).ok, true);

    // Strip the flag from one job, leaving the header stamped v1: the job would
    // now run v2 under a v1 label, which is the mismatch the stamp exists to
    // catch, and it must fail closed.
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

  test(`${label} validator rejects a pre-versioning plan instead of reinterpreting it`, () => {
    // Plan files written before the rubric was versioned are on disk with no
    // stamp, and every one of them ran v1. Resolving an absent stamp against the
    // current default would silently relabel those runs as v2, so an unstamped
    // plan is pinned to v1 and then fails: re-running one has to name its rubric.
    const plan = build();
    const unstamped = { ...plan };
    delete unstamped.evidenceUseRubric;
    const result = validate(unstamped);
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some(
        (error) => error.includes('predates evidence_use rubric versioning') && error.includes(RUBRIC_FLAG),
      ),
      `expected an unstamped-plan error naming the flag, got ${JSON.stringify(result.errors)}`,
    );
    // And the remedy the message prescribes actually validates.
    assert.equal(validate(build({ evidenceUseRubric: TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY })).ok, true);
  });

  test(`${label} rejects an unknown rubric version`, () => {
    assert.throws(() => build({ evidenceUseRubric: 'v3' }), /invalid_evidence_use_rubric|unknown evidence_use rubric/);
  });
}
