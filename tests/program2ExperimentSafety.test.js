import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import yaml from 'yaml';

import {
  buildProgram2LaunchCertificate,
  createProgram2ProviderBudget,
  createProgram2ProviderBudgetFromEnvironment,
  deriveProgram2Budget,
  deriveProgram2WorldReachability,
  evaluateProgram2LiveFutility,
  evaluateProgram2PilotEvidence,
  evaluateProgram2RowGuardrails,
  validateProgram2CertificateEvidenceBindings,
  validateProgram2LaunchCertificate,
} from '../services/program2ExperimentSafety.js';
import { buildPhase5LivePilotPlan, validatePhase5LivePilotPlan } from '../scripts/run-program2-live-pilot.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORLD = yaml.parse(fs.readFileSync(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'), 'utf8'));

function factorialPlan() {
  const profiles = ['proof_skipper', 'overwhelmed_novice'];
  const conditions = ['trained_v1', 'trained_v2', 'untuned_v1', 'untuned_v2'];
  const jobs = [];
  for (const profile of profiles) {
    for (let repeat = 1; repeat <= 6; repeat += 1) {
      for (const condition of conditions) {
        jobs.push({
          id: `job-${jobs.length + 1}`,
          ordinal: jobs.length + 1,
          profile,
          repeat,
          condition,
          blockKey: `${profile}:${repeat}`,
        });
      }
    }
  }
  return {
    schema: 'test.program2.factorial-plan.v1',
    primaryHorizon: 16,
    safetyTurns: 40,
    maxTokens: 4096,
    jobs,
  };
}

function rowFor(job, { opportunities = 7, coverage = 1, safety = true, leaks = [] } = {}) {
  return {
    job,
    warrant: { opp: opportunities, comp: 0 },
    fixedHorizon: { coverageAtHorizon: coverage, hardSafetyPassed: safety },
    leakTurns: leaks,
    moments: [],
  };
}

function completePilotRows(plan, options = {}) {
  const firstByGroup = new Map();
  for (const job of plan.jobs) {
    const key = `${job.profile}|${job.condition ?? job.arm}`;
    if (!firstByGroup.has(key)) firstByGroup.set(key, rowFor(job, options));
  }
  return [...firstByGroup.values()];
}

function passingAudits() {
  return [
    {
      bound: true,
      expectedPlanSha256: 'pilot-plan',
      audit: {
        status: 'pass',
        plan: { sha256: 'pilot-plan' },
        checks: Array.from({ length: 11 }, (_, index) => ({ id: `c${index}`, pass: true })),
      },
    },
  ];
}

const TEST_BINDINGS = { files: [{ role: 'fixture', file: 'fixture.json', sha256: 'fixture' }] };

test('static reachability catches the impossible Marrick coverage at turn 16', () => {
  const result = deriveProgram2WorldReachability(WORLD, { horizon: 16, coverageThreshold: 0.8 });
  assert.equal(result.pass, false);
  assert.equal(result.paths[0].premiseCount, 6);
  assert.equal(result.paths[0].releasedCount, 4);
  assert.equal(result.maxCoverageAtHorizon, 4 / 6);
  assert.deepEqual(result.paths[0].unavailable, ['p_graver', 'p_holder']);
});

test('launch and analyzer helpers share all-row coverage and safety semantics', () => {
  const plan = factorialPlan();
  const rows = [rowFor(plan.jobs[0], { coverage: 2 / 3 }), rowFor(plan.jobs[1], { coverage: 1, safety: false })];
  const result = evaluateProgram2RowGuardrails(rows, { coverageThreshold: 0.8 });
  assert.equal(result.pass, false);
  assert.deepEqual(
    result.coverage.failures.map((entry) => entry.jobId),
    [plan.jobs[0].id],
  );
  assert.deepEqual(
    result.safety.failures.map((entry) => entry.jobId),
    [plan.jobs[1].id],
  );
});

test('cohort pilot evidence covers every profile and condition with an opportunity reserve', () => {
  const plan = factorialPlan();
  const oneProfileRows = completePilotRows({
    ...plan,
    jobs: plan.jobs.filter((job) => job.profile === 'proof_skipper'),
  });
  const missing = evaluateProgram2PilotEvidence({ plan, rows: oneProfileRows });
  assert.equal(missing.pass, false);
  assert.equal(missing.missingGroups.length, 4);

  const underpowered = evaluateProgram2PilotEvidence({
    plan,
    rows: completePilotRows(plan, { opportunities: 3 }),
  });
  assert.equal(underpowered.opportunityPower.pass, false);

  const powered = evaluateProgram2PilotEvidence({
    plan,
    rows: completePilotRows(plan, { opportunities: 7 }),
  });
  assert.equal(powered.pass, true);
});

test('an apparatus-only pilot may defer opportunity power to a terminal cohort gate', () => {
  const plan = factorialPlan();
  const result = evaluateProgram2PilotEvidence({
    plan,
    rows: completePilotRows(plan, { opportunities: 0 }),
    gateSpec: { requirePilotOpportunityPower: false },
  });

  assert.equal(result.pass, true);
  assert.equal(result.opportunityPower.pass, true);
  assert.equal(result.opportunityPower.observedPass, false);
  assert.equal(result.opportunityPower.requiredForCertificate, false);
});

test('budget certificate freezes the two-attempt provider ceiling', () => {
  const budget = deriveProgram2Budget(factorialPlan());
  assert.equal(budget.pass, true);
  assert.equal(budget.maxRetries, 48);
  assert.equal(budget.maxProviderCallsPerAttempt, 320);
  assert.equal(budget.maxProviderCalls, 30_720);
  assert.equal(budget.maxReservedOutputTokens, 30_720 * 4096);
});

test('a certificate is bound to its source, plan, evidence, and zero-model checks', () => {
  const plan = factorialPlan();
  const sourceSha = 'a'.repeat(40);
  const failed = buildProgram2LaunchCertificate({
    phase: 'cohort',
    plan,
    sourceSha,
    world: WORLD,
    pilotRows: completePilotRows(plan),
    pilotAudits: passingAudits(),
    evidenceBindings: TEST_BINDINGS,
  });
  assert.equal(failed.status, 'fail');
  assert.equal(failed.checks.staticReachability.pass, false);

  const feasibleWorld = structuredClone(WORLD);
  for (const release of feasibleWorld.release_schedule) {
    if (['p_graver', 'p_holder'].includes(release.premise)) release.turn = 16;
  }
  const passed = buildProgram2LaunchCertificate({
    phase: 'cohort',
    plan,
    sourceSha,
    world: feasibleWorld,
    pilotRows: completePilotRows(plan),
    pilotAudits: passingAudits(),
    evidenceBindings: TEST_BINDINGS,
  });
  assert.equal(passed.status, 'pass');
  assert.equal(validateProgram2LaunchCertificate(passed, { plan, sourceSha, phase: 'cohort' }).pass, true);
  const drifted = structuredClone(plan);
  drifted.jobs[0].id = 'changed';
  assert.match(
    validateProgram2LaunchCertificate(passed, { plan: drifted, sourceSha, phase: 'cohort' }).errors.join(' '),
    /plan hash mismatch/u,
  );
});

test('evidence bindings reject changed, missing, and escaping files', () => {
  const fixture = path.join(ROOT, 'package.json');
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(fixture)).digest('hex');
  const base = { evidenceBindings: { files: [{ role: 'package', file: 'package.json', sha256 }] } };
  assert.equal(validateProgram2CertificateEvidenceBindings(base, { root: ROOT }).pass, true);
  assert.equal(
    validateProgram2CertificateEvidenceBindings(
      { evidenceBindings: { files: [{ role: 'changed', file: 'package.json', sha256: '0'.repeat(64) }] } },
      { root: ROOT },
    ).pass,
    false,
  );
  assert.equal(
    validateProgram2CertificateEvidenceBindings(
      { evidenceBindings: { files: [{ role: 'missing', file: 'missing.json', sha256: '0'.repeat(64) }] } },
      { root: ROOT },
    ).pass,
    false,
  );
  assert.equal(
    validateProgram2CertificateEvidenceBindings(
      { evidenceBindings: { files: [{ role: 'escape', file: '../outside', sha256: '0'.repeat(64) }] } },
      { root: ROOT },
    ).pass,
    false,
  );
});

test('live futility stops on irreversible gates but never tests a null effect', () => {
  const plan = factorialPlan();
  const coverageFailure = evaluateProgram2LiveFutility({
    plan,
    launchState: { jobs: {} },
    rows: [rowFor(plan.jobs[0], { coverage: 2 / 3 })],
  });
  assert.equal(coverageFailure.pass, false);
  assert.match(coverageFailure.reasons.join(' '), /coverage/u);
  assert.match(coverageFailure.note, /Treatment-effect estimates are intentionally absent/u);

  const condition = plan.jobs[0].condition;
  const attritions = plan.jobs.filter((job) => job.condition === condition).slice(0, 3);
  const launchState = {
    jobs: Object.fromEntries(attritions.map((job) => [job.id, { status: 'failed', attrition: true, attempts: 2 }])),
  };
  const missingnessFailure = evaluateProgram2LiveFutility({ plan, launchState, rows: [] });
  assert.equal(missingnessFailure.pass, false);
  assert.match(missingnessFailure.reasons.join(' '), /at most 9 sealed dialogues/u);
});

test('unknown sealed rows retain only their best-case opportunity contribution', () => {
  const plan = factorialPlan();
  const launchState = {
    jobs: Object.fromEntries(plan.jobs.map((job) => [job.id, { status: 'sealed', attempts: 1 }])),
  };
  const check = evaluateProgram2LiveFutility({ plan, launchState, rows: [] });
  assert.equal(check.pass, true);
});

test('provider budget reserves before dispatch and fails closed at both caps', () => {
  const budget = createProgram2ProviderBudget({ callLimit: 2, outputTokenLimit: 10 });
  assert.deepEqual(budget.reserve({ maxTokens: 4 }), {
    callsReserved: 1,
    outputTokensReserved: 4,
    requestedOutputTokens: 4,
    callLimit: 2,
    outputTokenLimit: 10,
  });
  assert.deepEqual(budget.reserve({ maxTokens: 6 }), {
    callsReserved: 2,
    outputTokensReserved: 10,
    requestedOutputTokens: 6,
    callLimit: 2,
    outputTokenLimit: 10,
  });
  assert.throws(
    () => budget.reserve({ maxTokens: 1 }),
    (error) => {
      assert.equal(error.code, 'PROGRAM2_PROVIDER_BUDGET_EXCEEDED');
      return true;
    },
  );
  assert.equal(createProgram2ProviderBudgetFromEnvironment({}), null);
  assert.throws(
    () =>
      createProgram2ProviderBudgetFromEnvironment({
        PROGRAM2_PROVIDER_CALL_LIMIT_PER_ATTEMPT: '2',
        PROGRAM2_PROVIDER_OUTPUT_TOKEN_LIMIT_PER_ATTEMPT: '0',
      }),
    /output-token limit/u,
  );
});

test('paid Program 2 launches fail before provider preflight when the certificate is absent', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-certificate-required-'));
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const result = spawnSync(
    process.execPath,
    [
      'scripts/run-program2-live-pilot.js',
      '--plan',
      '5',
      '--launch-approved',
      '--expected-sha',
      head,
      '--output-dir',
      outputRoot,
      '--limit-jobs',
      '0',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /requires --launch-certificate/u);
  assert.match(`${result.stdout}\n${result.stderr}`, /fresh launch certificate is required/u);
  assert.match(`${result.stdout}\n${result.stderr}`, /--prepare-certificate --plan 5/u);
  assert.match(`${result.stdout}\n${result.stderr}`, /npm run program2:certify-launch/u);
  assert.match(`${result.stdout}\n${result.stderr}`, /docs\/program2-launch-certificates\.md/u);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-plan.json')), false);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-attempt.json')), false);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-state.json')), false);
});

test('certificate preparation is an explicit zero-model workflow with an actionable reminder', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-certificate-prepare-'));
  const result = spawnSync(
    process.execPath,
    ['scripts/run-program2-live-pilot.js', '--prepare-certificate', '--plan', '5', '--output-dir', outputRoot],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const output = `${result.stdout}\n${result.stderr}`;
  const planPath = path.join(outputRoot, 'launch-plan.json');
  assert.equal(result.status, 0, output);
  assert.equal(fs.existsSync(planPath), true);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-state.json')), false);
  const artifact = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.equal(artifact.mode, 'certificate_preparation');
  assert.equal(artifact.modelCallsBeforeArtifact, 0);
  assert.equal(artifact.launchAuthorized, false);
  assert.match(output, /certificate plan PASS; 0 model calls/u);
  assert.match(output, /--world-file config\/drama-derivation\/world-005-marrick\.yaml/u);
  assert.match(output, /--phase pilot/u);
  assert.match(output, /--source-sha [0-9a-f]{40}/u);
  assert.match(output, /--launch-certificate .*launch-certificate\.json/u);
  assert.match(output, /Regenerate after any source, plan, world, gate, or pilot-evidence change/u);
});

test('cohort certificate preparation names the required audited pilot inputs', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-cohort-certificate-prepare-'));
  const result = spawnSync(
    process.execPath,
    ['scripts/run-program2-live-pilot.js', '--prepare-certificate', '--plan', '5b', '--output-dir', outputRoot],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /--phase cohort/u);
  assert.match(result.stdout, /--pilot-bundle <audited-exact-pipeline-pilot-bundle\.json>/u);
  assert.match(result.stdout, /--gate-spec-file <frozen-gates\.json>/u);
});

test('launcher help makes the fresh-certificate prerequisite discoverable', () => {
  const result = spawnSync(process.execPath, ['scripts/run-program2-live-pilot.js', '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--prepare-certificate/u);
  assert.match(result.stdout, /fresh certificate/u);
  assert.match(result.stdout, /npm run program2:certify-launch/u);
  assert.match(result.stdout, /docs\/program2-launch-certificates\.md/u);
});

test('paid launch rejects a passing-looking certificate whose evidence is missing', () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program2-certificate-binding-'));
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  const plan = buildPhase5LivePilotPlan({ outputRoot });
  const feasibleWorld = structuredClone(WORLD);
  for (const release of feasibleWorld.release_schedule) {
    if (['p_graver', 'p_holder'].includes(release.premise)) release.turn = 16;
  }
  const certificate = buildProgram2LaunchCertificate({
    phase: 'pilot',
    plan,
    sourceSha: head,
    world: feasibleWorld,
    planValidation: validatePhase5LivePilotPlan(plan),
    evidenceBindings: { files: [{ role: 'pilot_trace', file: 'missing.jsonl', sha256: '0'.repeat(64) }] },
  });
  assert.equal(certificate.status, 'pass');
  const certificatePath = path.join(outputRoot, 'certificate.json');
  fs.writeFileSync(certificatePath, `${JSON.stringify(certificate, null, 2)}\n`);
  const result = spawnSync(
    process.execPath,
    [
      'scripts/run-program2-live-pilot.js',
      '--plan',
      '5',
      '--launch-approved',
      '--expected-sha',
      head,
      '--launch-certificate',
      certificatePath,
      '--output-dir',
      outputRoot,
      '--limit-jobs',
      '0',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /launch certificate evidence rejected/u);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-attempt.json')), false);
  assert.equal(fs.existsSync(path.join(outputRoot, 'launch-state.json')), false);
});

test('paid launch metadata cannot overwrite the certificate-bound launch plan', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/run-program2-live-pilot.js'), 'utf8');
  assert.match(source, /const launchPlanPath = path\.join\(outputRoot, 'launch-plan\.json'\)/u);
  assert.match(source, /launch\s*\? path\.join\(outputRoot, 'launch-attempt\.json'\)/u);
  assert.match(source, /planFile: launchPlanPath/u);
  assert.match(source, /Keep that prepared\s*\/\/ evidence immutable/u);
});

test('tutor runtime reserves the Program 2 budget before both external dispatch paths', () => {
  const transportSource = fs.readFileSync(path.join(ROOT, 'services/tutorStubPromptTransport.js'), 'utf8');
  const pipelineSource = fs.readFileSync(path.join(ROOT, 'services/tutorStubTutorTurnPipeline.js'), 'utf8');
  assert.equal(
    [transportSource, pipelineSource].reduce(
      (count, source) =>
        count +
        (source.match(/reserveProgram2ProviderBudget\(\{ maxTokens, trace, role, turn(?:: tutorTurn)? \}\);/gu)
          ?.length || 0),
      0,
    ),
    2,
  );
  for (const { source, reservation } of [
    { source: transportSource, reservation: 'reserveProgram2ProviderBudget({ maxTokens, trace, role, turn });' },
    {
      source: pipelineSource,
      reservation: 'reserveProgram2ProviderBudget({ maxTokens, trace, role, turn: tutorTurn });',
    },
  ]) {
    const reserveIndex = source.indexOf(reservation);
    const dispatchIndex = source.indexOf('callAIWithCliBridge(', reserveIndex);
    assert.ok(reserveIndex > 0 && dispatchIndex > reserveIndex);
  }
});
