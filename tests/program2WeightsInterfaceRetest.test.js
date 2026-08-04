import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import {
  PROGRAM2_COMMITTEE_SCHEMA,
  buildCommitteeCompositionBlock,
  extractCommitteeSpanV1,
  extractCuePreservingCommitteeSpanV2,
  resolveCueBlindCommitteeDelivery,
  runCueBlindCommitteeBattery,
} from '../services/program2CommitteeEngine.js';
import { deriveProgram2Budget, deriveProgram2WorldReachability } from '../services/program2ExperimentSafety.js';
import { buildProgram2WeightsInterfaceRetestPilotBundle } from '../services/program2Phase5ePilotBundle.js';
import { createTutorStubTutorCommitteeRuntime } from '../services/tutorStubTutorCommitteeRuntime.js';
import {
  WEIGHTS_INTERFACE_RETEST_SPEC,
  buildWeightsInterfaceRetestPilotPlan,
  buildWeightsInterfaceRetestPlan,
  validateWeightsInterfaceRetestPlan,
} from '../scripts/run-program2-live-pilot.js';
import { analyzeWeightsInterfaceRetestRows } from '../scripts/analyze-program2-weights-interface-retest.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const WORLD = yaml.parse(fs.readFileSync(path.join(ROOT, 'config/drama-derivation/world-005-marrick.yaml'), 'utf8'));

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

test('retest horizon reaches the frozen Marrick coverage threshold without changing the world', () => {
  const failedHistorical = deriveProgram2WorldReachability(WORLD, { horizon: 16, coverageThreshold: 0.8 });
  const retest = deriveProgram2WorldReachability(WORLD, {
    horizon: WEIGHTS_INTERFACE_RETEST_SPEC.primaryHorizon,
    coverageThreshold: 0.8,
  });
  assert.equal(failedHistorical.pass, false);
  assert.equal(failedHistorical.maxCoverageAtHorizon, 4 / 6);
  assert.equal(retest.pass, true);
  assert.equal(retest.maxCoverageAtHorizon, 1);
  assert.equal(retest.paths[0].releasedCount, 6);
});

test('v1 and v2 implement the frozen deterministic extraction contrast', () => {
  assert.deepEqual(extractCommitteeSpanV1('Which record matters? Which rule connects it?'), {
    status: 'ok',
    span: 'Which record matters? Which rule connects it?',
    questionCount: 2,
    carriedStatement: false,
  });
  assert.deepEqual(extractCuePreservingCommitteeSpanV2('The record is public. What follows? Which hunch wins?'), {
    status: 'ok',
    span: 'The record is public. What follows?',
    questionCount: 2,
    carriedStatement: true,
  });
  assert.equal(extractCuePreservingCommitteeSpanV2('A plain statement.').status, 'no_span');
});

test('cue-blind enforcement accepts nuisance checks and falls back to the original greedy mini', () => {
  const spanResult = extractCuePreservingCommitteeSpanV2('The evidence is public. What follows?');
  const battery = runCueBlindCommitteeBattery({
    composedText: `Stay with the page. ${spanResult.span}`,
    span: spanResult.span,
    publicEvidenceSafe: true,
    noNewPremise: true,
  });
  assert.equal(battery.pass, true);
  const accepted = resolveCueBlindCommitteeDelivery({
    miniText: 'The evidence is public. What follows?',
    spanResult,
    composedText: `Stay with the page. ${spanResult.span}`,
    battery,
  });
  assert.equal(accepted.composerAccepted, true);
  assert.equal(accepted.miniResamples, 0);
  assert.equal(accepted.cueInspectedAfterExtraction, false);

  const fallback = resolveCueBlindCommitteeDelivery({
    miniText: 'Original greedy mini.',
    spanResult: { status: 'no_span', span: null },
  });
  assert.equal(fallback.deliveredText, 'Original greedy mini.');
  assert.equal(fallback.fallbackSource, 'original_greedy_mini');
  assert.equal(fallback.composerCalls, 0);

  assert.doesNotMatch(runCueBlindCommitteeBattery.toString(), /WARRANT_CUE|semantic/iu);
  assert.doesNotMatch(resolveCueBlindCommitteeDelivery.toString(), /WARRANT_CUE|semantic/iu);
});

test('committee runtime enacts the cue-blind v2 path with one composer call and zero mini resamples', async () => {
  const trace = [];
  const miniText = 'The record is public. What follows? Which hunch wins?';
  const composedText = 'Stay with the page. The record is public. What follows?';
  const roles = [];
  const bindCommittee = createTutorStubTutorCommitteeRuntime({
    PROGRAM2_COMMITTEE_SCHEMA,
    appendTraceEvent: (target, event) => target.push(event),
    auditTutorResponseLeak: () => ({ ok: true, leaks: [] }),
    buildCommitteeCompositionBlock,
    committeeMiniGenerate: async () => ({ text: miniText, latencyMs: 1 }),
    extractCommitteeSpanV1,
    extractCuePreservingCommitteeSpanV2,
    reserveTutorStubMeteredModelCall: ({ role }) => roles.push(role),
    resolveCueBlindCommitteeDelivery,
    runCueBlindCommitteeBattery,
    tutorStubPointOfActionTargetText: () => 'Ask for the public warrant.',
  });
  const { invokeCommitteeFirstDraft } = bindCommittee({
    context: [],
    effectiveSpeakerInstructionTexts: ['system'],
    effectiveSpeakerSystemPrompt: 'system',
    effectiveSpeakerUserPrompt: 'learner prompt',
    firstDraftContract: null,
    invokeTutorAttempt: async ({ role }) => {
      roles.push(role);
      return { text: composedText, latencyMs: 2 };
    },
    learnerText: 'I think the tool mark proves it.',
    maxTokens: 200,
    nextTutorGuardCallId: () => '1:1',
    roleBase: 'tutor_stub_tutor',
    speakerPrivilegeAudit: { ok: true },
    speakerPublicPremiseIds: new Set(),
    state: {
      pointOfAction: { current: { assigned_trigger: 'warrant_skip' } },
      committee: {
        miniModel: 'program2-sft-instruct-v2',
        spanInterface: 'v2',
        fallbackPolicy: 'cue_blind',
        ollamaUrl: 'http://127.0.0.1:11434',
        numCtx: 4096,
        timeoutMs: 1_000,
      },
    },
    trace,
    tutorStreamMode: 'none',
    tutorTurn: 7,
    world: {},
  });

  const response = await invokeCommitteeFirstDraft();
  const event = trace.find((row) => row.type === 'program2_committee_moment');
  assert.equal(response.text, composedText);
  assert.equal(event.moment.span, 'The record is public. What follows?');
  assert.equal(event.moment.enforcementLedger.composerCalls, 1);
  assert.equal(event.moment.enforcementLedger.miniResamples, 0);
  assert.equal(event.moment.enforcementLedger.cueInspectedAfterExtraction, false);
  assert.equal(roles.filter((role) => role.includes('committee_composer')).length, 1);
  assert.equal(
    roles.some((role) => role.includes('committee_mini_resample')),
    false,
  );
});

test('excluded pilot covers every profile and cell in two complete blocks', () => {
  const plan = buildWeightsInterfaceRetestPilotPlan({ outputRoot: '/tmp/program2-retest-pilot-test' });
  const validation = validateWeightsInterfaceRetestPlan(plan, { pilot: true });
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(validation.jobCount, 8);
  assert.equal(validation.balancedCellCount, 8);
  assert.equal(validation.completeBlockCount, 2);
  assert.equal(plan.primaryHorizon, 22);
  assert.equal(plan.certificateGateSpec, WEIGHTS_INTERFACE_RETEST_SPEC.pilotGateSpec);
  assert.equal(deriveProgram2Budget(plan).maxProviderCalls, 5_120);
});

test('cohort is a balanced 48-dialogue 2 x 2 matched design with frozen seams', () => {
  const plan = buildWeightsInterfaceRetestPlan({ outputRoot: '/tmp/program2-retest-cohort-test' });
  const validation = validateWeightsInterfaceRetestPlan(plan);
  assert.equal(validation.ok, true, validation.errors.join('; '));
  assert.equal(validation.jobCount, 48);
  assert.equal(validation.completeBlockCount, 12);
  assert.equal(deriveProgram2Budget(plan).maxProviderCalls, 30_720);
  for (const job of plan.jobs) {
    assert.equal(flagValue(job.command, '--committee-fallback-policy'), 'cue_blind');
    assert.equal(flagValue(job.command, '--committee-span-interface'), job.spanInterface);
    assert.equal(flagValue(job.command, '--committee-mini-model'), WEIGHTS_INTERFACE_RETEST_SPEC.weights[job.weight]);
    assert.equal(flagValue(job.command, '--model'), 'claude-code.sonnet-5');
    assert.equal(flagValue(job.command, '--classifier-model'), 'codex.gpt-5.6-terra');
  }
});

test('terminal analyzer licenses judging only after every frozen completion gate passes', () => {
  const plan = buildWeightsInterfaceRetestPlan({ outputRoot: '/tmp/program2-retest-analysis-test' });
  const rows = plan.jobs.map((job) => ({
    job,
    warrant: { opp: 7, comp: 0 },
    fixedHorizon: { coverageAtHorizon: 1, hardSafetyPassed: true },
    leakTurns: [],
    trace: { file: `${job.id}.jsonl`, sha256: 'a'.repeat(64) },
    moments: [
      {
        trigger: 'warrant_skip',
        miniText: 'Which record supports that inference?',
        span: 'Which record supports that inference?',
        fallback: { policy: 'cue_blind' },
        enforcementLedger: {
          selectedSpanStatus: 'ok',
          composerCalled: true,
          composerAccepted: true,
          fallbackSource: null,
          miniResamples: 0,
          composerCalls: 1,
          cueInspectedAfterExtraction: false,
        },
      },
    ],
  }));
  const gateSpec = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'config/adaptive-tutor-evidence/program-2-weights-interface-retest-gates.json'),
      'utf8',
    ),
  );
  const ready = analyzeWeightsInterfaceRetestRows({
    plan,
    rows,
    launchState: { jobs: {} },
    gateSpec,
    certificateBound: true,
  });
  assert.equal(ready.completionReady, true);
  assert.equal(ready.reading, 'ready_for_blinded_semantic_judging');

  const unbound = analyzeWeightsInterfaceRetestRows({
    plan,
    rows,
    launchState: { jobs: {} },
    gateSpec,
    certificateBound: false,
  });
  assert.equal(unbound.completionReady, false);
  assert.equal(unbound.gates.certificateBound.pass, false);
});

test('pilot bundle gate recognizes all eight exact-pipeline profile by condition groups', () => {
  const pilotRoot = fs.mkdtempSync('/tmp/program2-retest-bundle-test-');
  const cohortPlan = buildWeightsInterfaceRetestPlan({ outputRoot: '/tmp/program2-retest-cohort-bundle-test' });
  const pilotPlan = buildWeightsInterfaceRetestPilotPlan({ outputRoot: pilotRoot });
  const bundle = buildProgram2WeightsInterfaceRetestPilotBundle({
    cohortPlan,
    pilotPlan,
    pilotRoot,
    repositoryRoot: ROOT,
    cohortSourceSha: 'a'.repeat(40),
    pilotSourceSha: 'a'.repeat(40),
  });
  const checks = Object.fromEntries(bundle.audit.checks.map((entry) => [entry.id, entry]));
  assert.equal(checks.pilot_plan_schema.pass, true);
  assert.equal(checks.profile_arm_coverage.pass, true);
  assert.equal(checks.exact_pipeline_commands.pass, true);
  assert.equal(checks.sealed_trace_count.pass, false);
  assert.equal(bundle.audit.status, 'fail');
});
