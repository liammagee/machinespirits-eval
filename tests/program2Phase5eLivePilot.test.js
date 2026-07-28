import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PHASE5E_SPEC,
  PHASE5E_PILOT_SPEC,
  PHASE5F_PILOT_SPEC,
  buildPhase5eLivePilotPlan,
  buildPhase5eR2ExactPipelinePilotPlan,
  buildPhase5fExactPipelinePilotPlan,
  validatePhase5eLivePilotPlan,
  validatePhase5eR2ExactPipelinePilotPlan,
  validatePhase5fExactPipelinePilotPlan,
} from '../scripts/run-program2-live-pilot.js';
import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  auditTutorStubDramaticReleaseResponse,
  buildTutorStubDramaticReleaseFrame,
  deterministicTutorStubDramaticReleaseFallback,
} from '../services/tutorStubDramaticRelease.js';
import {
  buildProgram2Phase5ePilotBundle,
  loadProgram2Phase5eRows,
} from '../services/program2Phase5ePilotBundle.js';
import { evaluateProgram2LiveFutility, program2PlanSha256 } from '../services/program2ExperimentSafety.js';
import { buildCertificateFromFiles } from '../scripts/certify-program2-launch.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

function optionsFromCommand(command) {
  const options = {};
  for (let index = 2; index < command.length; index += 1) {
    if (!String(command[index]).startsWith('--')) continue;
    const key = command[index].slice(2);
    const next = command[index + 1];
    options[key] = next && !String(next).startsWith('--') ? next : true;
    if (options[key] !== true) index += 1;
  }
  return options;
}

function writeSyntheticPilotTrace(root, job) {
  const directory = path.join(root, 'traces', job.id);
  fs.mkdirSync(directory, { recursive: true });
  const options = optionsFromCommand(job.command);
  const events = [
    {
      type: 'run_start',
      metadata: {
        experiment: { jobId: job.id, profile: job.profile, repeat: job.repeat },
        scenarioPicker: { selectedScenarioId: options.world },
        sessionRecipe: { config: { options } },
      },
    },
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 16,
        tutorLearnerDagModel: { assessment: { bestPathCoverage: 1 } },
        tutorGuardAccounting: { finalDelivery: { auditOk: true } },
        tutorLeakAudit: { ok: true, leaks: [] },
      },
    },
    ...[1, 2, 3].map((turn) => ({
      type: 'point_of_action_compliance',
      compliance: { turn, trigger: 'warrant_skip', compliant: turn === 1 },
    })),
    ...(job.arm === 'committee'
      ? [{ type: 'program2_committee_moment', turn: 1, moment: { source: 'composed' } }]
      : []),
    { type: 'run_end' },
  ];
  fs.writeFileSync(path.join(directory, 'sealed.jsonl'), `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
}

describe('Program-2 Phase 5e live-pilot plan', () => {
  it('builds the frozen 10 committee + 8 fresh-control Skyway design', () => {
    const plan = buildPhase5eLivePilotPlan({ outputRoot: 'regression-output' });
    const validation = validatePhase5eLivePilotPlan(plan);

    assert.deepEqual(validation, { ok: true, errors: [], jobCount: 18, balancedCellCount: 4 });
    assert.equal(plan.schema, 'machinespirits.tutor-stub.program2-phase5e-r2-plan.v1');
    assert.equal(plan.runSeed, 20260726);
    assert.equal(plan.world, 'world_026_skyway_bakery');
    assert.equal(plan.jobs.filter((job) => job.arm === 'committee').length, 10);
    assert.equal(plan.jobs.filter((job) => job.arm === 'silent_control').length, 8);
    assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 18);

    for (const job of plan.jobs) {
      assert.equal(flagValue(job.command, '--world'), PHASE5E_SPEC.world);
      assert.equal(flagValue(job.command, '--run-seed'), String(PHASE5E_SPEC.runSeed));
      assert.equal(flagValue(job.command, '--learner-analysis-evidence-use-rubric'), 'v1');
      assert.equal(
        flagValue(job.command, '--committee-fallback-policy'),
        job.arm === 'committee' ? PHASE5E_SPEC.fallbackPolicy : null,
      );
    }
  });

  it('pins the historical v1 evidence-use boundary and rejects current-default drift', () => {
    assert.equal(PHASE5E_SPEC.evidenceUseRubric, 'v1');
    assert.throws(
      () => buildPhase5eLivePilotPlan({ evidenceUseRubric: 'v2_bridge_voiced' }),
      /pins evidence_use rubric v1/u,
    );
  });

  it('builds one exact-pipeline pilot dialogue per profile x arm cell', () => {
    const plan = buildPhase5eR2ExactPipelinePilotPlan({ outputRoot: 'pilot-output' });
    assert.deepEqual(validatePhase5eR2ExactPipelinePilotPlan(plan), {
      ok: true,
      errors: [],
      jobCount: 4,
      balancedCellCount: 4,
    });
    assert.equal(plan.schema, PHASE5E_PILOT_SPEC.schema);
    assert.deepEqual(
      [...new Set(plan.jobs.map((job) => `${job.profile}|${job.arm}`))].sort(),
      [
        'affective_resistant|committee',
        'affective_resistant|silent_control',
        'proof_skipper|committee',
        'proof_skipper|silent_control',
      ],
    );
    for (const job of plan.jobs) {
      assert.equal(flagValue(job.command, '--world'), PHASE5E_SPEC.world);
      assert.equal(flagValue(job.command, '--run-seed'), String(PHASE5E_SPEC.runSeed));
      assert.equal(flagValue(job.command, '--learner-analysis-evidence-use-rubric'), 'v1');
    }
  });

  it('prepares zero-model pilot and cohort certificate plans with concrete r2 evidence paths', () => {
    const pilotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-phase5e-r2-pilot-'));
    const cohortRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-phase5e-r2-cohort-'));
    const pilot = spawnSync(
      process.execPath,
      ['scripts/run-program2-live-pilot.js', '--prepare-certificate', '--plan', '5e-pilot', '--output-dir', pilotRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(pilot.status, 0, `${pilot.stdout}\n${pilot.stderr}`);
    assert.match(pilot.stdout, /certificate plan PASS; 0 model calls/u);
    assert.match(pilot.stdout, /--phase pilot/u);
    assert.match(pilot.stdout, /program-2-phase5e-r2-pilot-gates\.json/u);
    assert.equal(JSON.parse(fs.readFileSync(path.join(pilotRoot, 'launch-plan.json'), 'utf8')).plan.jobs.length, 4);

    const cohort = spawnSync(
      process.execPath,
      ['scripts/run-program2-live-pilot.js', '--prepare-certificate', '--plan', '5e', '--output-dir', cohortRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(cohort.status, 0, `${cohort.stdout}\n${cohort.stderr}`);
    assert.match(cohort.stdout, /--phase cohort/u);
    assert.match(cohort.stdout, /program2-live-pilot-5e-r2-pilot\/pilot-bundle\.json/u);
    assert.match(cohort.stdout, /program-2-phase5e-r2-gates\.json/u);
    assert.equal(JSON.parse(fs.readFileSync(path.join(cohortRoot, 'launch-plan.json'), 'utf8')).plan.jobs.length, 18);
  });

  it('freezes a four-dialogue Phase 5f pilot on the post-training unseen Tideway world', () => {
    const plan = buildPhase5fExactPipelinePilotPlan({ outputRoot: 'phase5f-pilot-output' });
    assert.deepEqual(validatePhase5fExactPipelinePilotPlan(plan), {
      ok: true,
      errors: [],
      jobCount: 4,
      balancedCellCount: 4,
    });
    assert.equal(plan.schema, PHASE5F_PILOT_SPEC.schema);
    assert.equal(plan.world, 'world_031_tideway_makerspace');
    assert.equal(plan.runSeed, 20260728);
    assert.equal(plan.evidenceUseRubric, 'v1');
    assert.deepEqual(
      [...new Set(plan.jobs.map((job) => `${job.profile}|${job.arm}`))].sort(),
      [
        'affective_resistant|committee',
        'affective_resistant|silent_control',
        'proof_skipper|committee',
        'proof_skipper|silent_control',
      ],
    );
    for (const job of plan.jobs) {
      assert.equal(flagValue(job.command, '--world'), PHASE5F_PILOT_SPEC.world);
      assert.equal(flagValue(job.command, '--run-seed'), String(PHASE5F_PILOT_SPEC.runSeed));
      assert.equal(flagValue(job.command, '--learner-analysis-evidence-use-rubric'), 'v1');
    }
  });

  it('prepares the Phase 5f certificate plan without making model calls', () => {
    const pilotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-phase5f-pilot-'));
    const pilot = spawnSync(
      process.execPath,
      ['scripts/run-program2-live-pilot.js', '--prepare-certificate', '--plan', '5f-pilot', '--output-dir', pilotRoot],
      { cwd: ROOT, encoding: 'utf8' },
    );
    assert.equal(pilot.status, 0, `${pilot.stdout}\n${pilot.stderr}`);
    assert.match(pilot.stdout, /certificate plan PASS; 0 model calls/u);
    assert.match(pilot.stdout, /--phase pilot/u);
    assert.match(pilot.stdout, /world-031-tideway-makerspace\.yaml/u);
    assert.match(pilot.stdout, /program-2-phase5f-pilot-gates\.json/u);
    const artifact = JSON.parse(fs.readFileSync(path.join(pilotRoot, 'launch-plan.json'), 'utf8'));
    assert.equal(artifact.modelCallsBeforeArtifact, 0);
    assert.equal(artifact.plan.jobs.length, 4);
    assert.equal(artifact.plan.world, PHASE5F_PILOT_SPEC.world);
  });

  it('builds a cohort-bound 11-check bundle from four sealed exact-pipeline traces', () => {
    const scratchRoot = fs.mkdtempSync(path.join(ROOT, 'exports', 'program2-phase5e-r2-bundle-test-'));
    try {
      const pilotRoot = path.join(scratchRoot, 'pilot');
      const cohortPlan = buildPhase5eLivePilotPlan({ outputRoot: path.join(scratchRoot, 'cohort') });
      const pilotPlan = buildPhase5eR2ExactPipelinePilotPlan({ outputRoot: pilotRoot });
      for (const job of pilotPlan.jobs) writeSyntheticPilotTrace(pilotRoot, job);
      const bundle = buildProgram2Phase5ePilotBundle({
        cohortPlan,
        pilotPlan,
        pilotRoot,
        repositoryRoot: ROOT,
        cohortSourceSha: 'a'.repeat(40),
        pilotSourceSha: 'a'.repeat(40),
      });
      assert.equal(bundle.audit.status, 'pass', JSON.stringify(bundle.audit.checks, null, 2));
      assert.equal(bundle.audit.checks.length, 11);
      assert.equal(bundle.rows.length, 4);
      assert.equal(bundle.expectedPlanSha256, program2PlanSha256(cohortPlan));
      assert.equal(bundle.expectedSourceSha, 'a'.repeat(40));
      assert.equal(bundle.evidenceBindings.files.length, 4);
      assert.ok(bundle.rows.every((row) => row.warrant.opp === 3));
      assert.ok(bundle.rows.every((row) => row.fixedHorizon.hardSafetyPassed === true));
      assert.equal(loadProgram2Phase5eRows({ plan: pilotPlan, root: pilotRoot }).length, 4);

      const pilotGateSpecFile = path.join(
        ROOT,
        'config/adaptive-tutor-evidence/program-2-phase5e-r2-pilot-gates.json',
      );
      const pilotGateSpec = JSON.parse(fs.readFileSync(pilotGateSpecFile, 'utf8'));
      const liveCheck = evaluateProgram2LiveFutility({
        plan: pilotPlan,
        rows: bundle.rows,
        contract: { gateSpec: pilotGateSpec },
      });
      assert.equal(liveCheck.pass, true, liveCheck.reasons.join('; '));
      const badRows = structuredClone(bundle.rows);
      badRows[0].fixedHorizon.coverageAtHorizon = 0.5;
      assert.equal(
        evaluateProgram2LiveFutility({
          plan: pilotPlan,
          rows: badRows,
          contract: { gateSpec: pilotGateSpec },
        }).pass,
        false,
      );

      const cohortPlanFile = path.join(scratchRoot, 'cohort-plan.json');
      const bundleFile = path.join(scratchRoot, 'pilot-bundle.json');
      fs.writeFileSync(cohortPlanFile, JSON.stringify({ plan: cohortPlan }));
      fs.writeFileSync(bundleFile, JSON.stringify(bundle));
      const certificate = buildCertificateFromFiles({
        planFile: cohortPlanFile,
        worldFile: path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'),
        phase: 'cohort',
        pilotBundleFiles: [bundleFile],
        gateSpecFile: path.join(ROOT, 'config/adaptive-tutor-evidence/program-2-phase5e-r2-gates.json'),
        sourceSha: 'a'.repeat(40),
      });
      assert.equal(certificate.status, 'pass', JSON.stringify(certificate.checks, null, 2));
      assert.equal(certificate.evidenceBindings.files.filter((entry) => entry.role.startsWith('pilot_trace:')).length, 4);
      const driftedSource = buildCertificateFromFiles({
        planFile: cohortPlanFile,
        worldFile: path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'),
        phase: 'cohort',
        pilotBundleFiles: [bundleFile],
        gateSpecFile: path.join(ROOT, 'config/adaptive-tutor-evidence/program-2-phase5e-r2-gates.json'),
        sourceSha: 'b'.repeat(40),
      });
      assert.equal(driftedSource.status, 'fail');
      assert.equal(driftedSource.checks.pilotProvenance.pass, false);
    } finally {
      fs.rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it('enacts the Skyway launch log when the turn-9 p_warm release falls back deterministically', () => {
    const world = loadWorld(
      fileURLToPath(new URL('../config/drama-derivation/world-026-skyway-bakery.yaml', import.meta.url)),
    );
    const release = world.releaseSchedule.find((entry) => entry.premise === 'p_warm');
    const premise = world.premiseById.get('p_warm');

    assert.deepEqual(release, {
      turn: 9,
      premise: 'p_warm',
      via: 'tutor',
      presentation: {
        mode: 'enacted_role',
        role: 'loftmistress opening and reading the ovenloft launch log',
        cue: 'She lays the launch log open between you, taps the dawn initials, and reads its line aloud.',
      },
    });

    const frame = buildTutorStubDramaticReleaseFrame({
      dueEvidence: [
        {
          ...premise,
          premise: 'p_warm',
          turn: release.turn,
          via: release.via,
          presentation: release.presentation,
        },
      ],
      world,
    });
    const text = deterministicTutorStubDramaticReleaseFallback({
      frame,
      support: {},
      responseConfiguration: {
        engagement_stance: 'plain',
        actorial_part: 'record_keeper',
      },
      variationKey: 'program2-phase5e-p-warm',
      world,
    });
    const audit = auditTutorStubDramaticReleaseResponse({ frame, text });

    assert.equal(frame.requiresEnactment, true);
    assert.equal(frame.requiresExhibitHandoff, false);
    assert.match(text, /launch log|ovenloft/iu);
    assert.equal(audit.enactmentVisible, true, text);
    assert.equal(audit.ok, true, `${text}\n${JSON.stringify(audit.issues)}`);
  });
});
