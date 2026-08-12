import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deriveAdaptiveWarrantShadow } from '../scripts/derive-adaptive-warrant-shadow.js';
import {
  applyAdaptiveWarrantSourcePatch,
  assessAdaptiveWarrantConfigurationTransition,
  buildAdaptiveWarrantSelectorApplicationAudit,
  hashAdaptiveWarrantResponseConfiguration,
} from '../services/adaptiveWarrantDeliveryContract.js';
import { buildTutorStubSimplifiedRecoveryConfiguration } from '../services/tutorStubGuardRecovery.js';
import { buildTutorStubSpeakingResponseConfiguration } from '../services/tutorStubPerformanceObligationContract.js';
import { enforceTutorStubWarrantGateFinalAuthority } from '../services/tutorStubWarrantGate.js';

import {
  assessAdaptiveWarrantDeliveryApplication,
  adaptiveWarrantStudyPreflightChecks,
  aggregateAdaptiveWarrantStudy,
  annotationCaseFingerprint,
  assertAdaptiveWarrantMechanismModelRefs,
  assertAdaptiveWarrantLaunchSource,
  buildAdaptiveWarrantBaselineJobs,
  buildAdaptiveWarrantLaunchAuthorizationRequest,
  buildAdaptiveWarrantNaturalSemanticArtifacts,
  buildBlindedAnnotationCorpus,
  collectAdaptiveWarrantStudySourceFiles,
  evaluateAdaptiveWarrantAnalysisCoverageHalt,
  evaluateAdaptiveWarrantDecisionGate,
  isUnhedgedOwnVoiceClaim,
  resolveAdaptiveWarrantStudyStatus,
  scoreAnnotationArtifacts,
  scoreBlindedAnnotations,
  summarizeAdaptiveWarrantAnalysisCoverage,
  summarizeAdaptiveWarrantTrace,
  validateAdaptiveWarrantAnnotationFreeze,
  validateBlindedAnnotationResponse,
  validateAdaptiveWarrantLaunchAuthorization,
  writeStudyArtifacts,
  ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
  ADAPTIVE_WARRANT_DECISION_GATE,
  ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_MINIMUM_TURNS,
  ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_RATE,
  ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC,
  MECHANISM_VALIDATION_CONDITIONS,
  MECHANISM_VALIDATION_PROFILES,
  MECHANISM_VALIDATION_WORLDS,
  STUDY_CONDITIONS,
  STUDY_PROFILES,
} from '../scripts/run-adaptive-warrant-baseline-study.js';
import { prepareAdaptiveWarrantSemanticAnnotationBatches } from '../scripts/prepare-adaptive-warrant-semantic-annotations.js';

function fileDigest(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function alignedDivergenceLabels(overrides = {}) {
  return Object.fromEntries(
    ['conceptual', 'interactional', 'engagement', 'pacing', 'epistemic', 'strategy_exhaustion'].map((dimension) => [
      dimension,
      {
        interpretation: 'aligned',
        magnitude: 'none',
        persistence: 'none',
        note: `The public ${dimension} evidence is aligned at this decision.`,
        ...(overrides[dimension] || {}),
      },
    ]),
  );
}

function resultRow({
  profile,
  condition,
  seed,
  world = null,
  growth = 0,
  breakTurn = null,
  firstWarrantTurn = null,
  firstRevisionTurn = null,
} = {}) {
  return {
    jobId: `${profile}-${condition}-${seed}`,
    profile,
    condition,
    seed,
    world,
    warrantGateMode: condition === 'instrumented' ? 'observe' : condition === 'intervening' ? 'active' : 'off',
    childStatus: 'ok',
    turnCount: 8,
    learnerAnalysisCallCount: 8,
    learnerAnalysisUnanalyzedCount: 0,
    learnerAnalysisUnanalyzedTurns: [],
    learnerAnalysisPromptFailureCount: 0,
    learnerAnalysisErrorCount: 0,
    learnerAnalysisCoverage: 1,
    learnerRecordGrowth: growth,
    firstUnhedgedOwnVoiceClaimTurn: breakTurn,
    deferenceBreakByHorizon: breakTurn !== null,
    firstWarrantTurn,
    firstRevisionTurn,
    revisionLagTurns:
      firstWarrantTurn === null || firstRevisionTurn === null ? null : firstRevisionTurn - firstWarrantTurn,
    warrantedButUnrevisedByHorizon: firstWarrantTurn !== null && firstRevisionTurn === null,
    liveWarrantCount: condition === 'baseline' ? 0 : 1,
    shadowWarrantCount: 1,
    overrideCount: condition === 'intervening' ? 1 : 0,
    gateOutcomeCoverage: condition === 'baseline' ? null : 1,
    liveShadowAgreement: condition === 'baseline' ? null : 1,
    liveShadowStructuredComparisonCount: 0,
    liveShadowStructuredMismatchCount: 0,
    fallbackCount: 0,
    leakFailureCount: 0,
    tracePath: `/tmp/${profile}-${condition}-${seed}.jsonl`,
    decisions: [
      {
        turn: 3,
        strategy_in_force: 'stage_next_step',
        actual_family: condition === 'intervening' ? 'challenge_resistance' : 'stage_next_step',
        revised: condition === 'intervening',
        gate: null,
        shadow: { revision_warranted: true },
      },
    ],
    publicTurns: [
      {
        turn: 1,
        learner: 'May I enter the first fact?',
        tutor: 'Look at the public assay.',
        dag_total: 4,
        grounded_count: 4,
        voiced_derived_count: 0,
        action_family: 'stage_next_step',
      },
      {
        turn: 2,
        learner: 'May I keep the same entry?',
        tutor: 'Make the entry in your own voice.',
        dag_total: 4,
        grounded_count: 4,
        voiced_derived_count: 0,
        action_family: 'stage_next_step',
      },
      {
        turn: 3,
        learner: 'The assay rules out clipping.',
        tutor: 'Yes. Test the next clue.',
        dag_total: 5,
        grounded_count: 5,
        voiced_derived_count: 0,
        action_family: condition === 'intervening' ? 'challenge_resistance' : 'stage_next_step',
      },
    ],
  };
}

test('study plan is a paired 3-condition x 3-profile matrix with frozen eight-turn commands', () => {
  const jobs = buildAdaptiveWarrantBaselineJobs({
    rootDir: '/tmp/warrant-study',
    runs: 5,
    masterSeed: 101,
    studyId: 'test-study',
    dryRun: true,
  });
  assert.equal(jobs.length, 45);
  for (const profile of STUDY_PROFILES) {
    for (const condition of STUDY_CONDITIONS) {
      const cell = jobs.filter((job) => job.profile === profile && job.condition === condition.id);
      assert.equal(cell.length, 5);
      assert.deepEqual(
        cell.map((job) => job.seed).sort((a, b) => a - b),
        [101, 102, 103, 104, 105],
      );
      for (const job of cell) {
        assert.ok(job.command.includes('--no-stop-on-grounded'));
        assert.equal(job.command[job.command.indexOf('--turns') + 1], '8');
        assert.equal(job.command[job.command.indexOf('--warrant-gate') + 1], condition.warrantGateMode);
        assert.equal(job.command[job.command.indexOf('--policies') + 1], 'dynamic');
        assert.equal(job.command[job.command.indexOf('--learner-analysis-prompt-profile') + 1], 'handbook_v1');
        assert.ok(job.command.includes('--dry-run'));
      }
    }
  }
});

test('analysis coverage guard halts on the first blind call and at the registered fifteen-percent threshold', () => {
  assert.equal(ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_RATE, 0.15);
  assert.equal(ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_MINIMUM_TURNS, 10);

  const firstCall = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: 1,
      learnerAnalysisUnanalyzedCount: 1,
      firstLearnerAnalysisStatus: 'unanalyzed',
    },
  ]);
  assert.equal(firstCall.status, 'coverage_halt');
  assert.equal(firstCall.reason, 'first_call_unanalyzed');

  const belowSupport = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: 9,
      learnerAnalysisUnanalyzedCount: 1,
      firstLearnerAnalysisStatus: 'analyzed',
    },
  ]);
  assert.equal(belowSupport.status, 'continue');

  const measuredExpectedRate = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: 10,
      learnerAnalysisUnanalyzedCount: 1,
      firstLearnerAnalysisStatus: 'analyzed',
    },
  ]);
  assert.equal(measuredExpectedRate.status, 'continue');

  const rateBreach = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: 10,
      learnerAnalysisUnanalyzedCount: 2,
      firstLearnerAnalysisStatus: 'analyzed',
    },
  ]);
  assert.equal(rateBreach.status, 'coverage_halt');
  assert.equal(rateBreach.reason, 'unanalyzed_rate_threshold');
  assert.equal(rateBreach.unanalyzed_rate, 0.2);

  const localPromptFailuresRemainInDenominator = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      turnCount: 10,
      learnerAnalysisCallCount: 8,
      learnerAnalysisUnanalyzedCount: 2,
      firstLearnerAnalysisStatus: 'analyzed',
    },
  ]);
  assert.equal(localPromptFailuresRemainInDenominator.analysis_turns, 10);
  assert.equal(localPromptFailuresRemainInDenominator.unanalyzed_rate, 0.2);
  assert.equal(localPromptFailuresRemainInDenominator.status, 'coverage_halt');
});

test('live mechanism authorization binds the frozen model destination, private payload scope, and source closure', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-launch-authorization-'));
  try {
    const excludedCorpusPath = path.join(rootDir, 'excluded.json');
    fs.writeFileSync(excludedCorpusPath, '{"schema":"prior-corpus"}\n');
    const jobs = buildAdaptiveWarrantBaselineJobs({
      rootDir: path.join(rootDir, 'dry-run'),
      runs: 1,
      masterSeed: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed,
      studyId: 'mechanism-dry-run',
      dryRun: true,
      worlds: MECHANISM_VALIDATION_WORLDS,
      profiles: MECHANISM_VALIDATION_PROFILES,
      conditions: MECHANISM_VALIDATION_CONDITIONS,
      horizon: 8,
      mechanismValidation: true,
    });
    const plan = {
      schema: 'machinespirits.adaptation-refinement.baseline-study.v1',
      studyId: 'mechanism-dry-run',
      design: 'docs/adaptation-refinement/baseline-comparison-design.md',
      provenance: {
        gitCommit: '1'.repeat(40),
        gitStatus: '',
        combinedSha256: 'a'.repeat(64),
        childPolicySha256: 'b'.repeat(64),
      },
      config: {
        runs: 1,
        masterSeed: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed,
        parallelism: 6,
        horizon: 8,
        policy: 'dynamic',
        worlds: MECHANISM_VALIDATION_WORLDS,
        profiles: MECHANISM_VALIDATION_PROFILES,
        conditions: MECHANISM_VALIDATION_CONDITIONS,
        model: 'codex.gpt-5.6-luna',
        analysisModel: 'codex.gpt-5.6-luna',
        learnerModel: 'codex.gpt-5.6-luna',
        maxTokens: 4096,
        historyTurns: 4,
        modelCallBudgetPerDialogue: 64,
        mechanismValidation: true,
        contractValidation: false,
        annotationExpectedCases: 96,
        annotationAllDecisions: true,
        annotationConditions: ['instrumented'],
        excludedAnnotationCorpora: [excludedCorpusPath],
        learnerAnalysisPromptProfile: 'handbook_v1',
        fixedSeams: ['same Luna model routing with handbook_v1 learner analysis'],
        dryRun: true,
      },
      jobs,
    };
    const request = buildAdaptiveWarrantLaunchAuthorizationRequest(plan);
    assert.equal(request.contract.execution.dialogues, 24);
    assert.equal(request.contract.execution.maximum_tutor_decisions, 192);
    assert.deepEqual(request.contract.authorized_destinations, ['OpenAI Codex CLI (ChatGPT-account route)']);
    assert.equal(request.contract.annotation.excluded_prior_corpora[0].sha256.length, 64);
    assert.equal(request.contract.private_payload_scope_sha256.length, 64);
    assert.equal(request.approvable, true);
    assert.equal(request.contract.source.git_commit, '1'.repeat(40));
    assert.equal(request.contract.source.worktree_clean, true);
    assert.equal(request.authorization_template.approved_source_provenance_sha256, 'a'.repeat(64));
    assert.equal(request.authorization_template.approved_child_policy_sha256, 'b'.repeat(64));
    assert.equal(request.contract.execution.study_plan_execution_sha256.length, 64);
    assert.equal(request.contract.execution.maximum_model_calls, 1536);

    const authorization = {
      ...request.authorization_template,
      approved: true,
      approved_by: 'workspace_owner',
      approved_at: '2026-08-10T12:00:00.000Z',
    };
    const audit = validateAdaptiveWarrantLaunchAuthorization(authorization, request);
    assert.equal(audit.accepted, true);
    assert.equal(audit.approval_digest, request.approval_digest);
    assert.equal(audit.approved_source_provenance_sha256, 'a'.repeat(64));
    assert.equal(audit.approved_child_policy_sha256, 'b'.repeat(64));

    const liveJobs = buildAdaptiveWarrantBaselineJobs({
      rootDir: path.join(rootDir, 'live-run'),
      runs: 1,
      masterSeed: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed,
      studyId: 'mechanism-live',
      dryRun: false,
      worlds: MECHANISM_VALIDATION_WORLDS,
      profiles: MECHANISM_VALIDATION_PROFILES,
      conditions: MECHANISM_VALIDATION_CONDITIONS,
      horizon: 8,
      mechanismValidation: true,
    });
    assert.deepEqual(
      liveJobs.map((job) => job.id),
      jobs.map((job) => job.id),
    );
    const equivalentLivePlan = {
      ...plan,
      studyId: 'mechanism-live',
      config: { ...plan.config, dryRun: false },
      jobs: liveJobs,
    };
    const equivalentLiveRequest = buildAdaptiveWarrantLaunchAuthorizationRequest(equivalentLivePlan);
    assert.equal(equivalentLiveRequest.approval_digest, request.approval_digest);
    assert.equal(validateAdaptiveWarrantLaunchAuthorization(authorization, equivalentLiveRequest).accepted, true);

    const commandMutations = [
      ['--world', 'world_999_drift'],
      ['--auto-learner-profile-id', 'diligent'],
      ['--warrant-gate', 'off'],
      ['--run-seed', '999'],
      ['--turns', '9'],
      ['--cli-effort', 'high'],
      ['--max-tokens', '2048'],
      ['--model-call-budget', '63'],
      ['--history-turns', '3'],
      ['--register-temperature', '0.25'],
    ];
    for (const [flag, replacement] of commandMutations) {
      const changedJobs = structuredClone(liveJobs);
      const flagIndex = changedJobs[0].command.indexOf(flag);
      assert.ok(flagIndex >= 0, `expected ${flag} in frozen live command`);
      changedJobs[0].command[flagIndex + 1] = replacement;
      const changedRequest = buildAdaptiveWarrantLaunchAuthorizationRequest({
        ...equivalentLivePlan,
        jobs: changedJobs,
      });
      assert.notEqual(changedRequest.approval_digest, request.approval_digest, flag);
      assert.throws(
        () => validateAdaptiveWarrantLaunchAuthorization(authorization, changedRequest),
        /approval_digest/u,
        flag,
      );
    }
    const withoutNoStop = structuredClone(liveJobs);
    const noStopIndex = withoutNoStop[0].command.indexOf('--no-stop-on-grounded');
    assert.ok(noStopIndex >= 0, 'expected --no-stop-on-grounded in frozen live command');
    withoutNoStop[0].command.splice(noStopIndex, 1);
    const noStopRequest = buildAdaptiveWarrantLaunchAuthorizationRequest({
      ...equivalentLivePlan,
      jobs: withoutNoStop,
    });
    assert.notEqual(noStopRequest.approval_digest, request.approval_digest);
    assert.throws(() => validateAdaptiveWarrantLaunchAuthorization(authorization, noStopRequest), /approval_digest/u);
    const reorderedRequest = buildAdaptiveWarrantLaunchAuthorizationRequest({
      ...equivalentLivePlan,
      jobs: [...liveJobs].reverse(),
    });
    assert.notEqual(reorderedRequest.approval_digest, request.approval_digest);
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization(authorization, reorderedRequest),
      /approval_digest/u,
    );

    const reroutedRequest = buildAdaptiveWarrantLaunchAuthorizationRequest({
      ...plan,
      config: { ...plan.config, learnerModel: 'openrouter.gpt-mini' },
    });
    assert.notEqual(reroutedRequest.approval_digest, request.approval_digest);
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization(authorization, reroutedRequest),
      /approval_digest, approved_destinations/u,
    );
    assert.throws(
      () =>
        validateAdaptiveWarrantLaunchAuthorization(
          { ...authorization, private_payload_scope_sha256: 'b'.repeat(64) },
          request,
        ),
      /private_payload_scope_sha256/u,
    );
    assert.throws(
      () =>
        validateAdaptiveWarrantLaunchAuthorization(
          { ...authorization, approved_source_provenance_sha256: 'c'.repeat(64) },
          request,
        ),
      /approved_source_provenance_sha256/u,
    );
    assert.throws(
      () =>
        validateAdaptiveWarrantLaunchAuthorization(
          { ...authorization, approved_child_policy_sha256: 'c'.repeat(64) },
          request,
        ),
      /approved_child_policy_sha256/u,
    );

    const authorizationWithExtraField = { ...authorization, comment: 'unbound metadata' };
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization(authorizationWithExtraField, request),
      /authorization_fields/u,
    );
    const authorizationWithMissingField = { ...authorization };
    delete authorizationWithMissingField.approved_by;
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization(authorizationWithMissingField, request),
      /authorization_fields/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved: 'true' }, request),
      /approved/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approval_digest: 1 }, request),
      /approval_digest/u,
    );
    assert.throws(
      () =>
        validateAdaptiveWarrantLaunchAuthorization(
          { ...authorization, approval_digest: request.approval_digest.toUpperCase() },
          request,
        ),
      /approval_digest/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved_destinations: [42] }, request),
      /approved_destinations_type/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved_by: {} }, request),
      /approved_by/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved_by: 'workspace\nowner' }, request),
      /approved_by/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved_at: 0 }, request),
      /approved_at/u,
    );
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization({ ...authorization, approved_at: '0' }, request),
      /approved_at/u,
    );
    assert.throws(
      () =>
        validateAdaptiveWarrantLaunchAuthorization(
          { ...authorization, approved_at: '2026-08-10T22:00:00+10:00' },
          request,
        ),
      /approved_at/u,
    );

    const tamperedRequest = {
      ...request,
      contract: { ...request.contract, network_effect: 'tampered after digest issuance' },
    };
    assert.throws(
      () => validateAdaptiveWarrantLaunchAuthorization(authorization, tamperedRequest),
      /request_approval_digest/u,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('live mechanism source gate requires the exact clean committed HEAD', () => {
  const provenance = {
    gitCommit: 'a'.repeat(40),
    gitStatus: '',
    combinedSha256: 'c'.repeat(64),
    childPolicySha256: 'd'.repeat(64),
  };
  assert.deepEqual(assertAdaptiveWarrantLaunchSource(provenance, 'a'.repeat(40)), {
    git_commit: 'a'.repeat(40),
    worktree_clean: true,
  });
  assert.throws(() => assertAdaptiveWarrantLaunchSource(provenance, 'short'), /exact 40-character HEAD/u);
  assert.throws(() => assertAdaptiveWarrantLaunchSource(provenance, 'b'.repeat(40)), /does not match --expected-sha/u);
  assert.throws(
    () => assertAdaptiveWarrantLaunchSource({ ...provenance, gitStatus: ' M changed.js' }, 'a'.repeat(40)),
    /clean committed worktree/u,
  );
  assert.throws(
    () => assertAdaptiveWarrantLaunchSource({ ...provenance, gitStatus: undefined }, 'a'.repeat(40)),
    /could not verify worktree cleanliness/u,
  );
  assert.throws(
    () => assertAdaptiveWarrantLaunchSource({ ...provenance, combinedSha256: null }, 'a'.repeat(40)),
    /source-closure hash/u,
  );
  assert.throws(
    () => assertAdaptiveWarrantLaunchSource({ ...provenance, childPolicySha256: null }, 'a'.repeat(40)),
    /child policy-closure hash/u,
  );
});

test('mechanism model routing is frozen before authorization', () => {
  assert.deepEqual(
    assertAdaptiveWarrantMechanismModelRefs({
      model: 'codex.gpt-5.6-luna',
      analysisModel: 'codex.gpt-5.6-luna',
      learnerModel: 'codex.gpt-5.6-luna',
    }),
    {
      tutor: 'codex.gpt-5.6-luna',
      learner_analysis: 'codex.gpt-5.6-luna',
      automated_learner: 'codex.gpt-5.6-luna',
    },
  );
  assert.throws(
    () =>
      assertAdaptiveWarrantMechanismModelRefs({
        model: 'codex.gpt-5.6-luna',
        analysisModel: 'codex.other',
        learnerModel: 'openrouter.other',
      }),
    /mismatched learner_analysis, automated_learner/u,
  );
});

test('mechanism-validation plan is the frozen two-world, six-profile, observe-active matrix', () => {
  assert.equal(ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed, 513);
  const jobs = buildAdaptiveWarrantBaselineJobs({
    rootDir: '/tmp/warrant-mechanism-study',
    runs: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.runs,
    masterSeed: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed,
    worlds: MECHANISM_VALIDATION_WORLDS,
    profiles: MECHANISM_VALIDATION_PROFILES,
    conditions: MECHANISM_VALIDATION_CONDITIONS,
    horizon: ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.horizon,
    studyId: 'mechanism-study',
    mechanismValidation: true,
    dryRun: true,
  });
  assert.equal(jobs.length, 24);
  assert.equal(new Set(jobs.map((job) => job.id)).size, 24);
  assert.deepEqual([...new Set(jobs.map((job) => job.world))].sort(), [...MECHANISM_VALIDATION_WORLDS].sort());
  assert.deepEqual([...new Set(jobs.map((job) => job.profile))].sort(), [...MECHANISM_VALIDATION_PROFILES].sort());
  assert.deepEqual([...new Set(jobs.map((job) => job.condition))].sort(), ['instrumented', 'intervening']);
  assert.ok(
    jobs.every(
      (job) =>
        job.seed === ADAPTIVE_WARRANT_MECHANISM_VALIDATION_SPEC.masterSeed &&
        job.horizon === 8 &&
        job.mechanismValidation,
    ),
  );
  assert.ok(jobs.every((job) => job.command[job.command.indexOf('--turns') + 1] === '8'));
  assert.ok(jobs.every((job) => job.command[job.command.indexOf('--world') + 1] === job.world));
  assert.ok(jobs.every((job) => !job.id.includes('baseline')));
});

test('sentinel-only natural catalogues freeze reader packets without exposing the sentinel as an entry ID', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-sentinel-catalogue-'));
  try {
    const learner = 'What public evidence can we examine first?';
    const semanticArtifacts = buildAdaptiveWarrantNaturalSemanticArtifacts([
      {
        sample_id: 'sentinel-only-1',
        gate: {
          semantic_event_extraction: {
            events: [
              {
                speech_act: 'tutor_directed_public_result_request',
                target: {
                  kind: 'other',
                  target_id: 'unspecified',
                  public_identifier_ids: [],
                  requested_value_types: [],
                  component_ids: [],
                },
              },
            ],
          },
        },
      },
    ]);
    const catalogueEntryIds = [
      ...semanticArtifacts.catalog.targets.map((row) => row.target_id),
      ...semanticArtifacts.catalog.public_identifiers.map((row) => row.public_identifier_id),
      ...semanticArtifacts.catalog.components.map((row) => row.component_id),
      ...semanticArtifacts.catalog.action_objects.map((row) => row.action_object_id),
    ];
    assert.equal(catalogueEntryIds.includes('unspecified'), false);
    assert.deepEqual(
      semanticArtifacts.catalog.public_identifiers.map((row) => row.public_identifier_id),
      ['natural-public-id-unresolved'],
    );
    const sparseArtifacts = buildAdaptiveWarrantNaturalSemanticArtifacts(
      Array.from({ length: 5 }, (_, index) => ({
        sample_id: `sparse-named-${index + 1}`,
        gate: {
          semantic_event_extraction: {
            events: [
              {
                speech_act: 'tutor_directed_public_result_request',
                target: {
                  kind: 'record_entry',
                  target_id: `natural-target-sparse-record-${index + 1}`,
                  public_identifier_ids: [],
                  requested_value_types: [],
                  component_ids: [],
                },
              },
            ],
          },
        },
      })),
    );
    assert.deepEqual(
      sparseArtifacts.catalog.public_identifiers.map((row) => row.public_identifier_id),
      ['natural-public-id-unresolved'],
    );
    assert.deepEqual(
      sparseArtifacts.catalog.components.map((row) => row.component_id),
      ['bounded_finding'],
    );

    const corpusPath = path.join(rootDir, 'sentinel-corpus.json');
    const handbookPath = path.join(rootDir, 'semantic-handbook.md');
    fs.writeFileSync(
      corpusPath,
      `${JSON.stringify(
        {
          schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
          study_id: 'semantic-brittleness-preflight-sentinel-only',
          blinded: true,
          semantic_annotation_catalog: semanticArtifacts.catalog,
          cases: [
            {
              sample_id: 'sentinel-only-1',
              current_learner_turn: { turn: 1, learner },
              public_evidence_at_decision: [],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    fs.writeFileSync(handbookPath, '# Frozen sentinel-only semantic handbook\n');
    const frozen = prepareAdaptiveWarrantSemanticAnnotationBatches({
      corpusPath,
      handbookPath,
      outputDir: path.join(rootDir, 'reader-packets'),
      corpusRole: 'natural_prevalence',
      batchSize: 1,
      maximumCalls: 2,
      preflightMode: true,
    });
    assert.equal(frozen.manifest.readers.length, 2);
    assert.equal(frozen.authorizationRequest.call_budget.planned_calls, 2);

    const sparseCorpusPath = path.join(rootDir, 'sparse-corpus.json');
    fs.writeFileSync(
      sparseCorpusPath,
      `${JSON.stringify(
        {
          schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
          study_id: 'semantic-brittleness-preflight-sparse-natural-catalogue',
          blinded: true,
          semantic_annotation_catalog: sparseArtifacts.catalog,
          cases: [
            {
              sample_id: 'sparse-named-1',
              current_learner_turn: { turn: 1, learner },
              public_evidence_at_decision: [],
            },
          ],
        },
        null,
        2,
      )}\n`,
    );
    const sparseFrozen = prepareAdaptiveWarrantSemanticAnnotationBatches({
      corpusPath: sparseCorpusPath,
      handbookPath,
      outputDir: path.join(rootDir, 'sparse-reader-packets'),
      corpusRole: 'natural_prevalence',
      batchSize: 1,
      maximumCalls: 2,
      preflightMode: true,
    });
    assert.equal(sparseFrozen.manifest.readers.length, 2);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('study provenance binds the complete tutor-stub integration closure', () => {
  const files = new Set(collectAdaptiveWarrantStudySourceFiles());
  for (const required of [
    'scripts/tutor-stub.js',
    'services/tutorStubApplicationState.js',
    'services/tutorStubInteractiveLearnerRuntime.js',
    'services/tutorStubPointOfActionCoaching.js',
    'services/tutorStubResponseConfigurationSelectionRuntime.js',
    'services/tutorStubTurnOrchestration.js',
    'services/tutorStubTutorTurnPipeline.js',
    'services/tutorStubTutorTurnPreparation.js',
    'services/tutorStubTypedActionRestoration.js',
    'services/tutorStubWarrantGate.js',
    'tests/tutorStubAutoEvalEvidence.test.js',
  ]) {
    assert.ok(files.has(required), `study provenance omitted ${required}`);
  }
  const preflightFiles = adaptiveWarrantStudyPreflightChecks().flatMap(([, args]) => args);
  assert.ok(preflightFiles.includes('tests/tutorStubAutoEvalEvidence.test.js'));
});

test('deference-break measure is public-text-only and distinguishes permission from own-voice claims', () => {
  assert.equal(isUnhedgedOwnVoiceClaim('May I enter that the assay rules out clipping?'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('I think the assay rules out clipping.'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('What does the assay show?'), false);
  assert.equal(isUnhedgedOwnVoiceClaim('The assay rules out clipping; these shillings were newly struck.'), true);
});

test('aggregator keeps manipulation checks separate and computes paired downstream contrasts', () => {
  const rows = [];
  for (const profile of STUDY_PROFILES) {
    rows.push(resultRow({ profile, condition: 'baseline', seed: 101, growth: 0, breakTurn: null }));
    rows.push(
      resultRow({
        profile,
        condition: 'instrumented',
        seed: 101,
        growth: 0,
        breakTurn: null,
        firstWarrantTurn: 3,
      }),
    );
    rows.push(
      resultRow({
        profile,
        condition: 'intervening',
        seed: 101,
        growth: 2,
        breakTurn: 5,
        firstWarrantTurn: 3,
        firstRevisionTurn: 3,
      }),
    );
  }
  const aggregates = aggregateAdaptiveWarrantStudy(rows, { horizon: 8 });
  assert.equal(aggregates.byCell.low_agency.intervening.meanLearnerRecordGrowth, 2);
  assert.equal(aggregates.byCell.low_agency.intervening.meanLearnerAnalysisCoverage, 1);
  assert.equal(aggregates.byCell.low_agency.intervening.meanRevisionLagTurns, 0);
  assert.equal(aggregates.byCell.low_agency.intervening.overrideSessions, 1);
  assert.equal(aggregates.byCell.low_agency.instrumented.meanRevisionLagTurns, null);
  assert.equal(aggregates.byCell.low_agency.instrumented.warrantedButUnrevised, 1);
  assert.equal(aggregates.byCell.low_agency.baseline.meanLiveShadowAgreement, null);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineLearnerRecordGrowth, 2);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineDeferenceBreakRate, 1);
  assert.equal(aggregates.pairedContrasts.low_agency.activeMinusBaselineDeferenceBreakTurn, -4);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineLearnerRecordGrowth, 0);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineDeferenceBreakRate, 0);
  assert.equal(aggregates.pairedContrasts.low_agency.instrumentedMinusBaselineDeferenceBreakTurn, 0);
});

test('study status fails closed when a completed row used learner-analysis fallback', () => {
  const jobs = [{ id: 'one' }];
  const valid = resultRow({ profile: 'low_agency', condition: 'baseline', seed: 101 });
  assert.equal(resolveAdaptiveWarrantStudyStatus([valid], jobs), 'complete');
  assert.equal(resolveAdaptiveWarrantStudyStatus([{ ...valid, learnerAnalysisCoverage: 0 }], jobs), 'invalid_analysis');
  const withinRegisteredCoverage = {
    ...valid,
    learnerAnalysisUnanalyzedCount: 1,
    learnerAnalysisUnanalyzedTurns: [2],
    learnerAnalysisErrorCount: 1,
    learnerAnalysisCoverage: 0.875,
  };
  assert.equal(resolveAdaptiveWarrantStudyStatus([withinRegisteredCoverage], jobs), 'complete');
  assert.equal(
    resolveAdaptiveWarrantStudyStatus([{ ...valid, promptAuditRecoveryCount: 1 }], jobs),
    'invalid_analysis',
  );
});

test('analysis coverage summary records overall and per-dialogue denominators for the gate ruling', () => {
  const rows = [
    resultRow({ profile: 'diligent', condition: 'instrumented', seed: 506 }),
    {
      ...resultRow({ profile: 'diligent', condition: 'intervening', seed: 506 }),
      learnerAnalysisUnanalyzedCount: 1,
      learnerAnalysisUnanalyzedTurns: [4],
      learnerAnalysisCoverage: 0.875,
    },
  ];
  const coverage = summarizeAdaptiveWarrantAnalysisCoverage(rows);
  assert.equal(coverage.analysis_turns, 16);
  assert.equal(coverage.analyzed_turns, 15);
  assert.equal(coverage.unanalyzed_turns, 1);
  assert.equal(coverage.coverage, 0.9375);
  assert.equal(coverage.gate_ruling, 'within_registered_coverage');
  assert.deepEqual(coverage.dialogues[1].unanalyzed_turn_numbers, [4]);
});

test('coverage-halt finalization writes all sealed rows without freezing partial annotation artifacts', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-coverage-halt-finalization-'));
  try {
    const row = {
      ...resultRow({ profile: 'diligent', condition: 'instrumented', seed: 506 }),
      learnerAnalysisCallCount: 6,
      learnerAnalysisUnanalyzedCount: 2,
      learnerAnalysisUnanalyzedTurns: [7, 8],
      learnerAnalysisCoverage: 0.75,
    };
    const plan = {
      studyId: 'coverage-halt-finalization',
      design: 'docs/adaptation-refinement/baseline-comparison-design.md',
      jobs: [{ id: row.jobId }],
      config: {
        runs: 1,
        horizon: 8,
        worlds: [row.world],
        profiles: [row.profile],
        conditions: [{ id: row.condition, warrantGateMode: row.warrantGateMode }],
        mechanismValidation: true,
      },
    };
    const study = writeStudyArtifacts({
      rootDir,
      plan,
      rows: [row],
      status: 'coverage_halt',
      coverageHalt: { status: 'coverage_halt', reason: 'unanalyzed_rate_threshold' },
    });
    assert.equal(study.status, 'coverage_halt');
    assert.equal(study.rows.length, 1);
    assert.equal(study.analysisCoverage.analysis_turns, 8);
    assert.equal(study.analysisCoverage.unanalyzed_turns, 2);
    assert.equal(fs.existsSync(path.join(rootDir, 'study-results.json')), true);
    assert.equal(fs.existsSync(path.join(rootDir, 'annotation-sample.blinded.json')), false);
    assert.equal(fs.existsSync(path.join(rootDir, 'annotation-key.private.json')), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('running mechanism finalization does not freeze or validate a partial reader corpus', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-running-finalization-'));
  try {
    const row = resultRow({ profile: 'diligent', condition: 'instrumented', seed: 508 });
    const plan = {
      studyId: 'running-finalization',
      design: 'docs/adaptation-refinement/baseline-comparison-design.md',
      jobs: [{ id: row.jobId }],
      config: {
        runs: 1,
        horizon: 8,
        worlds: [row.world],
        profiles: [row.profile],
        conditions: [{ id: row.condition, warrantGateMode: row.warrantGateMode }],
        mechanismValidation: true,
      },
    };
    const study = writeStudyArtifacts({ rootDir, plan, rows: [row], status: 'running' });
    assert.equal(study.status, 'running');
    assert.equal(study.rows.length, 1);
    assert.equal(study.analysisCoverage.analysis_turns, 8);
    assert.equal(fs.existsSync(path.join(rootDir, 'study-results.json')), true);
    assert.equal(fs.existsSync(path.join(rootDir, 'annotation-sample.blinded.json')), false);
    assert.equal(fs.existsSync(path.join(rootDir, 'annotation-key.private.json')), false);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('delivery application proves observe inertia and active final-authority delivery', () => {
  const auditedText = (text) => ({
    schema: 'machinespirits.tutor-stub.audited-public-text.v1',
    normalization: 'one_line_whitespace',
    sha256: createHash('sha256')
      .update(
        String(text || '')
          .replace(/\s+/gu, ' ')
          .trim(),
      )
      .digest('hex'),
  });
  const configurationAudit = (configuration) => ({
    axes: {
      action_family: { selected: configuration.action_family, visible: true },
      engagement_stance: { selected: configuration.engagement_stance, visible: true },
    },
  });
  const firstDraftContract = (configuration, publicObligationContract = null) => ({
    development: { action_family: configuration.action_family },
    performance: {
      engagement_stance: configuration.engagement_stance,
      actorial_part: configuration.actorial_part,
      tactic: configuration.actorial_performance.id,
      obligation_contract: null,
    },
    progression: publicObligationContract ? { public_obligation_contract: publicObligationContract } : {},
  });
  const target = {
    kind: 'weight_or_ring_result',
    signature: 'weight_or_ring_result:coin',
    public_terms: ['balance', 'ring', 'coin'],
    subject_terms: ['coin'],
    required_components: [
      { id: 'weight_reading', terms: ['balance', 'weight', 'weigh', 'weighing', 'reading'] },
      { id: 'ring_sound', terms: ['ring', 'sound'] },
    ],
    source_surface: 'What do the balance and ring show about the coin?',
  };
  const directive = {
    obligation_id: 'public-obligation-001',
    target: structuredClone(target),
    acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
  };
  const observeDecision = {
    schema: 'machinespirits.tutor-stub.warrant-gate.v5',
    mode: 'observe',
    revision_warranted: false,
    current_candidate_override_required: false,
    pre_gate_proposed_action_family: 'stage_next_step',
    policy: null,
    override: null,
    public_obligation: { blocking_obligation: null },
    obligation_directive: null,
  };
  const observeConfiguration = {
    action_family: 'stage_next_step',
    engagement_stance: 'precise',
    actorial_part: 'examiner',
    actorial_performance: {
      id: 'evidentiary_boundary',
      label: 'evidentiary boundary',
      contract: 'State the exact support and its limit.',
    },
  };
  const observeText = 'The public record keeps the next comparison bounded.';
  const observeSource = { action_family: 'stage_next_step', engagement_stance: 'precise' };
  const observeSelectorApplication = buildAdaptiveWarrantSelectorApplicationAudit({
    decision: observeDecision,
    preGateSource: observeSource,
    postGateSource: observeSource,
    responseConfiguration: observeConfiguration,
  });
  const observeRecord = {
    tutor: observeText,
    responseConfiguration: structuredClone(observeConfiguration),
    speakingResponseConfiguration: structuredClone(observeConfiguration),
    deliveredResponseConfiguration: structuredClone(observeConfiguration),
    responseConfigurationTransition: null,
    registerSelection: {
      warrant_gate: structuredClone(observeDecision),
      warrant_gate_application: observeSelectorApplication,
    },
    firstDraftContract: firstDraftContract(observeConfiguration),
    responseConfigurationAudit: configurationAudit(observeConfiguration),
    tutorGuardAccounting: {
      finalDelivery: {
        source: 'original_candidate',
        deliveryConfiguration: structuredClone(observeConfiguration),
        configurationTransition: null,
        candidate: { text: observeText },
        auditOk: true,
        audits: {
          deliveryOk: true,
          auditedText: auditedText(observeText),
          responseConfigurationAudit: configurationAudit(observeConfiguration),
        },
      },
    },
  };
  const observe = assessAdaptiveWarrantDeliveryApplication({ decision: observeDecision, record: observeRecord });
  assert.equal(observe.ok, true);

  const invisibleObserveRecord = structuredClone(observeRecord);
  invisibleObserveRecord.responseConfigurationAudit.axes.action_family.visible = false;
  invisibleObserveRecord.tutorGuardAccounting.finalDelivery.audits.responseConfigurationAudit.axes.action_family.visible = false;
  assert.equal(
    assessAdaptiveWarrantDeliveryApplication({ decision: observeDecision, record: invisibleObserveRecord }).ok,
    true,
    'observe mode owns selector inertia, not the baseline family realization',
  );

  const activeHoldDecision = { ...structuredClone(observeDecision), mode: 'active' };
  const activeHoldRecord = structuredClone(invisibleObserveRecord);
  activeHoldRecord.registerSelection.warrant_gate = structuredClone(activeHoldDecision);
  activeHoldRecord.registerSelection.warrant_gate_application = buildAdaptiveWarrantSelectorApplicationAudit({
    decision: activeHoldDecision,
    preGateSource: observeSource,
    postGateSource: observeSource,
    responseConfiguration: observeConfiguration,
  });
  assert.equal(
    assessAdaptiveWarrantDeliveryApplication({ decision: activeHoldDecision, record: activeHoldRecord }).ok,
    true,
    'an active hold is also gate-inert and does not own family realization',
  );

  const mutatedObserveRecord = structuredClone(observeRecord);
  for (const configuration of [
    mutatedObserveRecord.responseConfiguration,
    mutatedObserveRecord.speakingResponseConfiguration,
    mutatedObserveRecord.deliveredResponseConfiguration,
    mutatedObserveRecord.tutorGuardAccounting.finalDelivery.deliveryConfiguration,
  ]) {
    configuration.action_family = 'answer_accountably';
  }
  mutatedObserveRecord.firstDraftContract.development.action_family = 'answer_accountably';
  mutatedObserveRecord.responseConfigurationAudit = configurationAudit(
    mutatedObserveRecord.deliveredResponseConfiguration,
  );
  mutatedObserveRecord.tutorGuardAccounting.finalDelivery.audits.responseConfigurationAudit = configurationAudit(
    mutatedObserveRecord.deliveredResponseConfiguration,
  );
  const observedIntervention = assessAdaptiveWarrantDeliveryApplication({
    decision: observeDecision,
    record: mutatedObserveRecord,
  });
  assert.equal(observedIntervention.ok, false);
  assert.ok(observedIntervention.mismatches.includes('selector_selected_action_family_mismatch'));

  const activeDecision = {
    schema: 'machinespirits.tutor-stub.warrant-gate.v5',
    mode: 'active',
    revision_warranted: true,
    current_candidate_override_required: true,
    pre_gate_proposed_action_family: 'stage_next_step',
    warrant_basis: 'public_obligation_open:public-obligation-001',
    decision_kind: 'commitment_revision',
    policy: {
      family: 'answer_accountably',
      stance_hint: 'precise',
      rationale: 'Resolve the public result request.',
    },
    override: {
      action_family: 'answer_accountably',
      engagement_stance: 'precise',
      reason:
        'Adaptive warrant gate: public_obligation_open:public-obligation-001 — Resolve the public result request.',
    },
    public_obligation: {
      blocking_obligation: { id: 'public-obligation-001', target: structuredClone(target) },
    },
    obligation_directive: directive,
  };
  const selectedBeforeOptional = {
    action_family: 'answer_accountably',
    engagement_stance: 'precise',
    actorial_part: 'examiner',
    actorial_performance: {
      id: 'evidentiary_boundary',
      label: 'evidentiary boundary',
      contract: 'State the exact support and its limit.',
    },
    public_obligation_directive: structuredClone(directive),
    compatibility: {},
  };
  const preGateSource = { action_family: 'stage_next_step', engagement_stance: 'plain' };
  const postGateSource = applyAdaptiveWarrantSourcePatch(preGateSource, activeDecision);
  const selectorApplication = buildAdaptiveWarrantSelectorApplicationAudit({
    decision: activeDecision,
    preGateSource,
    postGateSource,
    actionFamilyOverrideInput: { family: 'answer_accountably', reason: activeDecision.override.reason },
    publicObligationDirectiveInput: directive,
    responseConfiguration: selectedBeforeOptional,
  });
  const frozenSelection = {
    warrant_gate: structuredClone(activeDecision),
    warrant_gate_application: selectorApplication,
    action_family: 'answer_accountably',
    response_configuration: structuredClone(selectedBeforeOptional),
  };
  const preFinalSelection = structuredClone(frozenSelection);
  preFinalSelection.action_family = 'stage_next_step';
  preFinalSelection.response_configuration.action_family = 'stage_next_step';
  const finalSelection = enforceTutorStubWarrantGateFinalAuthority(preFinalSelection, activeDecision, {
    frozenPreOptionalSelection: frozenSelection,
  });
  const delivered = finalSelection.response_configuration;
  const compiledObligation = {
    complete: true,
    obligation_id: directive.obligation_id,
    target: { ...structuredClone(target), progression_terms: ['balance', 'ring', 'coin'] },
    acceptable_outcomes: structuredClone(directive.acceptable_outcomes),
  };
  const activeText = 'The balance comparison is not public yet; the weighing record is the next condition.';
  const activeRecord = {
    tutor: activeText,
    registerSelection: structuredClone(finalSelection),
    preFinalWarrantSelection: structuredClone(preFinalSelection),
    responseConfiguration: structuredClone(delivered),
    speakingResponseConfiguration: structuredClone(delivered),
    deliveredResponseConfiguration: structuredClone(delivered),
    responseConfigurationTransition: null,
    firstDraftContract: firstDraftContract(delivered, compiledObligation),
    responseConfigurationAudit: configurationAudit(delivered),
    tutorGuardAccounting: {
      finalDelivery: {
        source: 'original_candidate',
        deliveryConfiguration: structuredClone(delivered),
        configurationTransition: null,
        candidate: { text: activeText },
        auditOk: true,
        audits: {
          deliveryOk: true,
          auditedText: auditedText(activeText),
          responseConfigurationAudit: configurationAudit(delivered),
          liveTurnProgressionAudit: {
            ok: true,
            public_obligation: {
              active: true,
              resolved: true,
              obligation_id: 'public-obligation-001',
              outcome: 'named_unavailability_with_concrete_next_step',
              delivery: {
                obligation_id: 'public-obligation-001',
                status: 'deferred',
                target_named: true,
                unavailable_claimed: true,
                concrete_next_step: 'weighing record',
                terminal_question_count: 0,
                required_components_answered: false,
                component_delivery: [
                  { id: 'weight_reading', answered: false },
                  { id: 'ring_sound', answered: false },
                ],
              },
            },
          },
        },
      },
    },
  };
  assert.equal(
    hashAdaptiveWarrantResponseConfiguration(activeRecord.responseConfiguration),
    selectorApplication.selected_response_configuration_sha256,
  );
  assert.equal(assessAdaptiveWarrantDeliveryApplication({ decision: activeDecision, record: activeRecord }).ok, true);
  const invisibleActiveRecord = structuredClone(activeRecord);
  invisibleActiveRecord.responseConfigurationAudit.axes.action_family.visible = false;
  invisibleActiveRecord.tutorGuardAccounting.finalDelivery.audits.responseConfigurationAudit.axes.action_family.visible = false;
  const invisibleActiveAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: invisibleActiveRecord,
  });
  assert.equal(invisibleActiveAssessment.ok, false);
  assert.ok(invisibleActiveAssessment.mismatches.includes('delivered_action_family_not_visible'));
  const forgedSelectorRecord = structuredClone(activeRecord);
  forgedSelectorRecord.registerSelection.warrant_gate_application = buildAdaptiveWarrantSelectorApplicationAudit({
    decision: activeDecision,
    preGateSource,
    postGateSource: { ...postGateSource, arbitrary_guard_bypass: true },
    actionFamilyOverrideInput: { family: 'answer_accountably', reason: activeDecision.override.reason },
    publicObligationDirectiveInput: directive,
    responseConfiguration: selectedBeforeOptional,
  });
  const forgedSelectorAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: forgedSelectorRecord,
  });
  assert.equal(forgedSelectorAssessment.ok, false);
  assert.ok(forgedSelectorAssessment.mismatches.includes('selector_source_projection_mismatch'));
  assert.ok(forgedSelectorAssessment.mismatches.includes('selector_unexpected_source_fields_changed'));

  const forgedOverrideDecision = structuredClone(activeDecision);
  forgedOverrideDecision.override.engagement_stance = 'face_threat';
  forgedOverrideDecision.override.reason = 'Unrelated hostile override.';
  const forgedOverrideAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: forgedOverrideDecision,
    record: activeRecord,
  });
  assert.equal(forgedOverrideAssessment.ok, false);
  assert.ok(forgedOverrideAssessment.mismatches.includes('active_override_policy_projection_mismatch'));

  const missedConfiguration = {
    ...structuredClone(delivered),
    action_family: 'stage_next_step',
    public_obligation_directive: null,
  };
  const missed = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: {
      ...structuredClone(activeRecord),
      deliveredResponseConfiguration: missedConfiguration,
      tutorGuardAccounting: {
        finalDelivery: {
          ...structuredClone(activeRecord.tutorGuardAccounting.finalDelivery),
          deliveryConfiguration: structuredClone(missedConfiguration),
        },
      },
    },
  });
  assert.equal(missed.ok, false);
  assert.ok(missed.mismatches.includes('active_action_family_not_delivered'));
  assert.ok(missed.mismatches.includes('active_obligation_directive_mismatch'));

  const recoveryConfiguration = buildTutorStubSimplifiedRecoveryConfiguration(delivered);
  const recoveryTransition = recoveryConfiguration.recovery_transition;
  const recoveryRecord = structuredClone(activeRecord);
  recoveryRecord.deliveredResponseConfiguration = structuredClone(recoveryConfiguration);
  recoveryRecord.responseConfigurationTransition = structuredClone(recoveryTransition);
  recoveryRecord.responseConfigurationAudit = configurationAudit(recoveryConfiguration);
  recoveryRecord.tutorGuardAccounting.finalDelivery = {
    ...recoveryRecord.tutorGuardAccounting.finalDelivery,
    source: 'composition_repair_candidate',
    deliveryConfiguration: structuredClone(recoveryConfiguration),
    configurationTransition: structuredClone(recoveryTransition),
  };
  recoveryRecord.tutorGuardAccounting.finalDelivery.audits.responseConfigurationAudit =
    configurationAudit(recoveryConfiguration);
  assert.equal(assessAdaptiveWarrantDeliveryApplication({ decision: activeDecision, record: recoveryRecord }).ok, true);

  const cueFreePlainRecovery = structuredClone(recoveryRecord);
  cueFreePlainRecovery.responseConfigurationAudit.axes.engagement_stance.visible = false;
  cueFreePlainRecovery.tutorGuardAccounting.finalDelivery.audits.responseConfigurationAudit.axes.engagement_stance.visible = false;
  assert.equal(
    assessAdaptiveWarrantDeliveryApplication({ decision: activeDecision, record: cueFreePlainRecovery }).ok,
    true,
    'plain recovery is an exact configuration transition, not an affirmative stance operation',
  );

  const obligationWithUnrelatedProgressionWarning = structuredClone(recoveryRecord);
  obligationWithUnrelatedProgressionWarning.tutorGuardAccounting.finalDelivery.audits.liveTurnProgressionAudit.ok = false;
  obligationWithUnrelatedProgressionWarning.tutorGuardAccounting.finalDelivery.audits.liveTurnProgressionAudit.issues =
    [{ type: 'required_exact_handoff_question_missing' }];
  assert.equal(
    assessAdaptiveWarrantDeliveryApplication({
      decision: activeDecision,
      record: obligationWithUnrelatedProgressionWarning,
    }).ok,
    true,
    'an unrelated progression warning does not erase a resolved obligation sub-audit',
  );

  const unresolvedObligation = structuredClone(obligationWithUnrelatedProgressionWarning);
  unresolvedObligation.tutorGuardAccounting.finalDelivery.audits.liveTurnProgressionAudit.public_obligation.resolved = false;
  const unresolvedAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: unresolvedObligation,
  });
  assert.equal(unresolvedAssessment.ok, false);
  assert.ok(unresolvedAssessment.mismatches.includes('active_obligation_not_realized_in_public_delivery'));

  const mutatedRecovery = structuredClone(recoveryRecord);
  mutatedRecovery.deliveredResponseConfiguration.actorial_part_selection.authored_role = 'invented witness';
  mutatedRecovery.tutorGuardAccounting.finalDelivery.deliveryConfiguration.actorial_part_selection.authored_role =
    'invented witness';
  assert.equal(
    assessAdaptiveWarrantDeliveryApplication({ decision: activeDecision, record: mutatedRecovery }).ok,
    false,
  );

  const forgedAuthority = structuredClone(activeRecord);
  forgedAuthority.responseConfiguration.adaptive_warrant_enforcement.schema = 'forged-final-authority';
  forgedAuthority.speakingResponseConfiguration.adaptive_warrant_enforcement.schema = 'forged-final-authority';
  forgedAuthority.deliveredResponseConfiguration.adaptive_warrant_enforcement.schema = 'forged-final-authority';
  forgedAuthority.tutorGuardAccounting.finalDelivery.deliveryConfiguration.adaptive_warrant_enforcement.schema =
    'forged-final-authority';
  forgedAuthority.registerSelection.response_configuration.adaptive_warrant_enforcement.schema =
    'forged-final-authority';
  forgedAuthority.registerSelection.adaptive_warrant_enforcement.schema = 'forged-final-authority';
  const forgedAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: forgedAuthority,
  });
  assert.equal(forgedAssessment.ok, false);
  assert.ok(forgedAssessment.mismatches.includes('active_final_authority_schema_mismatch'));

  const staleAuditText = structuredClone(activeRecord);
  staleAuditText.tutor = 'Completely unrelated prose.';
  staleAuditText.tutorGuardAccounting.finalDelivery.candidate.text = 'Completely unrelated prose.';
  const staleAuditAssessment = assessAdaptiveWarrantDeliveryApplication({
    decision: activeDecision,
    record: staleAuditText,
  });
  assert.equal(staleAuditAssessment.ok, false);
  assert.ok(staleAuditAssessment.mismatches.includes('final_delivery_audited_text_mismatch'));
});

test('delivery transition accepts only exact shared speaking and recovery transforms', () => {
  const selected = {
    action_family: 'stage_next_step',
    engagement_stance: 'precise',
    lexical_accessibility: 'standard',
    scene_immersion: 'immersive',
    actorial_part: 'advocate',
    actorial_part_label: 'advocate',
    actorial_part_selection: {
      id: 'advocate',
      authored_role: 'mint warden',
      evidence_enactment: { source_id: 'public-source-1' },
    },
    actorial_performance: {
      id: 'dramatic_counterpressure',
      label: 'dramatic counterpressure',
      contract: 'Bring a public claim against contrary public evidence.',
      forbidden_meta_frames: ['private answer'],
    },
    surface_budgets: { max_average_sentence_words: 24, max_questions: 1 },
  };
  const performanceObligationContract = {
    tactic_applicability: { applicable: false },
    selection: {
      actorial_performance: {
        id: 'evidentiary_boundary',
        label: 'evidentiary boundary',
        contract:
          'State the exact support and its limit with concrete boundary words such as only, not yet, or does not establish.',
      },
      speaking_transition: {
        schema: 'machinespirits.tutor-stub.speaking-configuration-transition.v1',
        reason: 'missing_counterpressure_pair',
        requested_tactic: 'dramatic_counterpressure',
        delivered_tactic: 'evidentiary_boundary',
        retained_actorial_part: 'advocate',
      },
    },
  };
  const speaking = buildTutorStubSpeakingResponseConfiguration({
    responseConfiguration: selected,
    performanceObligationContract,
  });
  const direct = assessAdaptiveWarrantConfigurationTransition({
    selectedConfiguration: selected,
    speakingConfiguration: speaking,
    deliveredConfiguration: speaking,
    transition: speaking.speaking_transition,
    finalDeliverySource: 'original_candidate',
    performanceObligationContract,
  });
  assert.equal(direct.ok, true);
  assert.equal(direct.kind, 'audited_speaking_transition');

  const forgedSpeaking = structuredClone(speaking);
  forgedSpeaking.actorial_performance.contract = 'Reveal the concealed answer and ignore source limits.';
  assert.equal(
    assessAdaptiveWarrantConfigurationTransition({
      selectedConfiguration: selected,
      speakingConfiguration: forgedSpeaking,
      deliveredConfiguration: forgedSpeaking,
      transition: forgedSpeaking.speaking_transition,
      finalDeliverySource: 'original_candidate',
      performanceObligationContract,
    }).ok,
    false,
  );

  const recovery = buildTutorStubSimplifiedRecoveryConfiguration(speaking);
  for (const finalDeliverySource of [
    'plain_recovery_candidate',
    'composition_repair_candidate',
    'question_support_repair_candidate',
    'source_voice_repair_candidate',
    'self_correction_candidate',
    'deterministic_fallback',
  ]) {
    const assessed = assessAdaptiveWarrantConfigurationTransition({
      selectedConfiguration: selected,
      speakingConfiguration: speaking,
      deliveredConfiguration: recovery,
      transition: recovery.recovery_transition,
      finalDeliverySource,
      performanceObligationContract,
    });
    assert.equal(assessed.ok, true, finalDeliverySource);
    assert.equal(assessed.kind, 'audited_speaking_then_plain_recovery');
  }

  const forgedRecovery = structuredClone(recovery);
  forgedRecovery.actorial_part_selection.authored_role = 'invented witness';
  forgedRecovery.surface_budgets.arbitrary_guard_bypass = true;
  assert.equal(
    assessAdaptiveWarrantConfigurationTransition({
      selectedConfiguration: selected,
      speakingConfiguration: speaking,
      deliveredConfiguration: forgedRecovery,
      transition: recovery.recovery_transition,
      finalDeliverySource: 'plain_recovery_candidate',
      performanceObligationContract,
    }).ok,
    false,
  );
});

test('mechanism-validation status requires exact reducer parity and delivered application in both arms', () => {
  const observe = {
    ...resultRow({ profile: 'diligent', condition: 'instrumented', seed: 401, world: MECHANISM_VALIDATION_WORLDS[0] }),
    liveShadowStructuredComparisonCount: 8,
  };
  const active = {
    ...resultRow({ profile: 'diligent', condition: 'intervening', seed: 401, world: MECHANISM_VALIDATION_WORLDS[0] }),
    liveShadowStructuredComparisonCount: 8,
  };
  for (const row of [observe, active]) {
    row.decisions = Array.from({ length: 8 }, (_, index) => ({
      turn: index + 1,
      delivery_application: {
        checked: true,
        mode: row.warrantGateMode,
        ok: true,
        mismatches: [],
      },
    }));
    row.deliveryApplicationComparisonCount = 8;
    row.deliveryApplicationMismatchCount = 0;
    row.deliveryApplicationIssueCount = 0;
  }
  const jobs = [{ id: observe.jobId }, { id: active.jobId }];
  const options = { horizon: 8, requireStructuredParity: true, requireDeliveryApplication: true };
  assert.equal(resolveAdaptiveWarrantStudyStatus([observe, active], jobs, options), 'complete');
  assert.equal(
    resolveAdaptiveWarrantStudyStatus([observe, { ...active, liveShadowStructuredComparisonCount: 0 }], jobs, options),
    'invalid_parity',
  );
  assert.equal(
    resolveAdaptiveWarrantStudyStatus([observe, { ...active, liveShadowStructuredMismatchCount: 1 }], jobs, options),
    'invalid_parity',
  );
  const missedDelivery = structuredClone(active);
  missedDelivery.decisions[4].delivery_application = {
    checked: true,
    mode: 'active',
    ok: false,
    mismatches: ['active_action_family_not_delivered'],
  };
  missedDelivery.deliveryApplicationMismatchCount = 1;
  missedDelivery.deliveryApplicationIssueCount = 1;
  assert.equal(
    resolveAdaptiveWarrantStudyStatus([observe, missedDelivery], jobs, options),
    'invalid_delivery_application',
  );
});

test('offline shadow aligns DAG growth with the next decision-time learner record', () => {
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-shadow-parity-'));
  const tracePath = path.join(traceDir, 'trace.jsonl');
  const events = [];
  for (const turn of [1, 2, 3]) {
    events.push({
      type: 'tutor_first_draft_contract',
      turn,
      contract: {
        development: { action_family: 'stage_next_step' },
        performance: { engagement_stance: 'precise', actorial_part: 'examiner', tactic: 'evidentiary_boundary' },
      },
    });
    events.push({ type: 'auto_learner_turn', turn, text: `Neutral learner turn ${turn}.` });
    events.push({
      type: 'turn_complete',
      turn,
      turnRecord: {
        stateObservation: {
          dag: { grounded_count: turn === 1 ? 0 : 1, voiced_derived_count: 0 },
        },
      },
    });
  }
  fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  try {
    const decisions = deriveAdaptiveWarrantShadow(tracePath).sessions[0].decisions;
    assert.equal(decisions[0].turn, 2);
    assert.equal(decisions[0].trouble_turns.length, 0);
    assert.equal(decisions[1].turn, 3);
    assert.deepEqual(
      decisions[1].trouble_turns.map((row) => row.turn),
      [2],
    );
    assert.equal(decisions[1].revision_warranted, false);
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('live and offline gates agree on public-obligation creation and cross-family persistence', async () => {
  const { createTutorStubWarrantGate } = await import('../services/tutorStubWarrantGate.js');
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-contract-parity-'));
  const tracePath = path.join(traceDir, 'trace.jsonl');
  const learnerTurns = [
    'I would examine the shilling before naming a hand.',
    'What do the balance and ring show?',
    'The town verdict concerns access, but it does not show who struck this shilling.',
  ];
  const actionFamilies = ['stage_next_step', 'clarify_distinction', 'clarify_distinction'];
  const events = [];
  const live = createTutorStubWarrantGate({ mode: 'observe' });
  const liveDecisions = [];
  for (const turn of [1, 2, 3]) {
    const learnerText = learnerTurns[turn - 1];
    const turnClassification = {
      turn: {
        request_type: 'stepwise_support_request',
        discourse_move: turn === 2 ? 'question' : 'claim',
        evidence_use: turn === 1 ? 'none' : 'cites_public_evidence',
        epistemic_stance: 'reflective',
        agency: 'steering',
      },
    };
    liveDecisions.push(
      live.assess({
        turn,
        learnerText,
        classification: turnClassification,
        dagModel: { learnerRecord: { grounded: Array.from({ length: 5 }, (_, index) => `f${index}`) } },
        priorActionFamily: turn === 1 ? 'stage_next_step' : actionFamilies[turn - 2],
        proposedActionFamily: actionFamilies[turn - 1],
      }),
    );
    const tutorText =
      turn === 2
        ? 'The balance and ring result is not yet recorded. What does the town verdict establish?'
        : 'Keep the public evidence bounded.';
    live.recordTurnOutcome({
      turn,
      actionFamily: actionFamilies[turn - 1],
      tutorText,
    });
    events.push({
      type: 'tutor_first_draft_contract',
      turn,
      contract: {
        development: { action_family: actionFamilies[turn - 1] },
        performance: { engagement_stance: 'precise', actorial_part: 'examiner', tactic: 'evidentiary_boundary' },
      },
    });
    events.push({ type: 'auto_learner_turn', turn, text: learnerText });
    events.push({
      type: 'turn_complete',
      turn,
      turnRecord: {
        learner: learnerText,
        tutor: tutorText,
        classification: turnClassification,
        stateObservation: { dag: { grounded_count: 5, voiced_derived_count: 0 } },
        deliveredResponseConfiguration: {
          action_family: actionFamilies[turn - 1],
          engagement_stance: 'precise',
          actorial_part: 'examiner',
          actorial_performance: { id: 'evidentiary_boundary' },
        },
        dramaticRelease: { frame: { entries: [] } },
      },
    });
  }
  fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  try {
    const offline = deriveAdaptiveWarrantShadow(tracePath).sessions[0].decisions;
    assert.equal(offline.length, 2);
    for (const [index, decision] of offline.entries()) {
      const liveDecision = liveDecisions[index + 1];
      assert.equal(decision.revision_warranted, liveDecision.revision_warranted);
      assert.equal(decision.warrant_basis, liveDecision.warrant_basis);
      assert.equal(
        decision.public_obligation.blocking_obligation?.id || null,
        liveDecision.public_obligation.blocking_obligation?.id || null,
      );
      assert.equal(
        decision.public_obligation.blocking_obligation?.status || null,
        liveDecision.public_obligation.blocking_obligation?.status || null,
      );
    }
    assert.equal(offline[0].revision_warranted, true);
    assert.equal(offline[0].policy.family, 'answer_accountably');
    assert.equal(offline[1].revision_warranted, true);
    assert.equal(offline[1].policy.family, 'answer_accountably');
    assert.equal(offline[1].public_obligation.blocking_obligation.status, 'overdue');
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('structured offline replay reconstructs turn one and exact input/ledger parity in observe and active modes', async () => {
  const { createTutorStubWarrantGate } = await import('../services/tutorStubWarrantGate.js');
  const { projectAdaptiveWarrantEvidenceAvailability } =
    await import('../services/adaptiveWarrantInquiryCompletion.js');
  const traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-structured-parity-'));
  try {
    for (const mode of ['observe', 'active']) {
      const tracePath = path.join(traceDir, `${mode}.jsonl`);
      const gate = createTutorStubWarrantGate({ mode });
      const events = [];
      const liveDecisions = [];
      let priorDeliveredActionFamily = null;
      for (const turn of [1, 2, 3]) {
        const learnerText =
          turn === 1
            ? 'What do the balance and ring show?'
            : turn === 2
              ? 'I would compare that result with the public assay.'
              : 'The assay supports the bounded comparison, but not a final culprit.';
        const classification = {
          combined: true,
          turn: {
            request_type: turn === 1 ? 'stepwise_support_request' : 'none',
            discourse_move: turn === 1 ? 'question' : 'claim',
            evidence_use: turn === 1 ? 'none' : 'cites_public_evidence',
            epistemic_stance: 'reflective',
            agency: 'steering',
          },
        };
        const dagModel = {
          turn,
          learnerRecord: { grounded: Array.from({ length: turn }, (_, index) => `f${index + 1}`), voicedDerived: [] },
          assessment: {
            bottleneck: 'missing_premise',
            unsupportedAssertionCount: 0,
            missingPremises: [],
            finalSecretEntailed: false,
            assertedSecret: false,
          },
          memoryReliability: { activeDroppedCount: 0 },
        };
        const releasePacing = {
          turn,
          signal: { direction: 'steady' },
          schedule: [
            { premise: 'p1', authoredTurn: 1, effectiveTurn: 1, releasedTurn: null },
            { premise: 'p2', authoredTurn: 4, effectiveTurn: 4, releasedTurn: null },
          ],
        };
        const dialogueClosureFrame = { strictGrounded: false, authoredDagSatisfied: false };
        const proposedActionFamily = 'stage_next_step';
        const decision = gate.assess({
          turn,
          learnerText,
          classification,
          dagModel,
          priorActionFamily: priorDeliveredActionFamily,
          proposedActionFamily,
          dialogueClosureFrame,
          evidenceAvailability: projectAdaptiveWarrantEvidenceAvailability(releasePacing, { turn }),
          pacingSignal: releasePacing.signal,
          unsupportedAssertionCount: 0,
          activeDroppedFactCount: 0,
          releasedEvidenceIntegrated: true,
        });
        liveDecisions.push(decision);
        const deliveredActionFamily = decision.override?.action_family || proposedActionFamily;
        const tutorText =
          turn === 1
            ? 'The balance and ring result is not yet recorded; the next public step is to weigh it.'
            : 'Keep the comparison bounded to the public assay.';
        const deliveredResponseConfiguration = {
          action_family: deliveredActionFamily,
          engagement_stance: 'precise',
          actorial_part: 'examiner',
          actorial_performance: { id: 'evidentiary_boundary' },
        };
        gate.recordTurnOutcome({
          turn,
          actionFamily: deliveredActionFamily,
          pacingSignal: releasePacing.signal,
          tutorText,
          releasedEvidence: [],
          deliveredResponseConfiguration,
        });
        events.push({
          type: 'tutor_first_draft_contract',
          turn,
          contract: {
            development: { action_family: deliveredActionFamily },
            performance: {
              engagement_stance: 'precise',
              actorial_part: 'examiner',
              tactic: 'evidentiary_boundary',
            },
          },
        });
        events.push({ type: 'auto_learner_turn', turn, text: learnerText });
        events.push({
          type: 'turn_complete',
          turn,
          turnRecord: {
            turn,
            learner: learnerText,
            tutor: tutorText,
            classification,
            tutorLearnerDagModel: dagModel,
            stateObservation: {
              dag: { grounded_count: dagModel.learnerRecord.grounded.length, voiced_derived_count: 0 },
            },
            deliveredResponseConfiguration,
            warrantGateDecision: decision,
            registerSelection: { warrant_gate: decision },
            dialogueClosure: { frame: dialogueClosureFrame },
            releasePacing,
            dramaticRelease: { frame: { entries: [] } },
          },
        });
        priorDeliveredActionFamily = deliveredActionFamily;
      }
      fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
      const offline = deriveAdaptiveWarrantShadow(tracePath, { includeTurnOne: true }).sessions[0].decisions;
      assert.deepEqual(
        offline.map((decision) => decision.turn),
        [1, 2, 3],
      );
      assert.deepEqual(
        offline.map((decision) => decision.input_digest),
        liveDecisions.map((decision) => decision.input_digest),
      );
      assert.deepEqual(
        offline.map((decision) => decision.public_obligation_before),
        liveDecisions.map((decision) => decision.public_obligation_before),
      );
      assert.deepEqual(
        offline.map((decision) => decision.divergence),
        liveDecisions.map((decision) => decision.divergence),
      );
      assert.ok(
        offline.every(
          (decision) =>
            decision.divergence.length === 6 &&
            decision.input_snapshot.schema === 'machinespirits.adaptation-refinement.warrant-decision-input.v2',
        ),
      );
      for (const decisions of [liveDecisions, offline]) {
        assert.equal(decisions[1].public_obligation.blocking_obligation, null);
        assert.equal(decisions[1].public_obligation.obligations[0].status, 'deferred');
        assert.equal(decisions[2].public_obligation.blocking_obligation, null);
        assert.equal(decisions[2].public_obligation.obligations[0].status, 'deferred');
      }
      const summary = summarizeAdaptiveWarrantTrace({
        tracePath,
        job: {
          id: `${mode}-parity`,
          runIndex: 1,
          seed: 401,
          world: MECHANISM_VALIDATION_WORLDS[0],
          profile: 'diligent',
          condition: mode === 'observe' ? 'instrumented' : 'intervening',
          warrantGateMode: mode,
          mechanismValidation: true,
        },
        childStatus: 'ok',
      });
      assert.equal(summary.decisions.length, 3);
      assert.equal(summary.liveShadowStructuredComparisonCount, 3);
      assert.equal(summary.liveShadowStructuredMismatchCount, 0);
      assert.ok(summary.decisions.every((row) => row.live_shadow_parity_mode === 'structured_v1'));
    }
  } finally {
    fs.rmSync(traceDir, { recursive: true, force: true });
  }
});

test('annotation corpus hides condition and keeps the arm mapping in a separate key', () => {
  const rows = [
    resultRow({ profile: 'low_agency', condition: 'baseline', seed: 101 }),
    resultRow({ profile: 'low_agency', condition: 'instrumented', seed: 101 }),
    resultRow({ profile: 'low_agency', condition: 'intervening', seed: 101 }),
  ];
  rows[0].decisions[0].gate = {
    revision_warranted: true,
    action_contract: {
      contract: {
        schema: 'machinespirits.adaptation-refinement.action-family-contract.v1',
        expected_learner_responses: ['examines_or_uses_named_public_material'],
        expected_response_match: 'any',
        deadline_turns: 2,
        success_transition: 'stage_next_step',
        defeat_transition: 'clarify_distinction',
        expiry_transition: 'answer_accountably',
        exit_on_success: true,
        terminal: false,
      },
      instance: {
        started_turn: 1,
        response_count: 1,
        from_family: null,
      },
      transition: {
        type: 'stage_next_step',
        revision_warranted: true,
        recommended_action_family: 'stage_next_step',
        discharge_prior_trouble: true,
      },
    },
  };
  const { corpus, key } = buildBlindedAnnotationCorpus(rows, { perCell: 1, studyId: 'test' });
  const repeated = buildBlindedAnnotationCorpus([...rows].reverse(), { perCell: 1, studyId: 'test' });
  assert.equal(corpus.cases.length, 3);
  assert.equal(key.cases.length, 3);
  assert.deepEqual(repeated, { corpus, key });
  assert.equal('condition' in corpus.cases[0], false);
  assert.equal('profile' in corpus.cases[0], false);
  assert.ok(key.cases.every((row) => row.condition));
  assert.ok(corpus.cases.every((row) => row.revision_warranted === null));
  assert.deepEqual(
    corpus.cases.map((row) => row.sample_id),
    key.cases.map((row) => row.sample_id),
  );
  assert.ok(corpus.cases.every((row) => /^case-[0-9a-f]{24}$/u.test(row.sample_id)));
  assert.ok(corpus.cases.every((row) => !/^case-\d{3}$/u.test(row.sample_id)));
  assert.ok(corpus.cases.every((row, index) => key.cases[index].source_fingerprint === annotationCaseFingerprint(row)));
  const contractKey = key.cases.find((row) => row.job_id === rows[0].jobId);
  const contractCase = corpus.cases.find((row) => row.sample_id === contractKey.sample_id);
  assert.equal('transition' in contractCase.normative_action_contract, false);
  assert.equal(contractCase.normative_action_contract.defeat_transition, 'clarify_distinction');
  assert.deepEqual(contractCase.normative_action_contract_instance, {
    started_turn: 1,
    response_count: 1,
    from_family: null,
  });
  assert.equal(contractKey.gate.action_contract.transition.revision_warranted, true);
  assert.equal(corpus.sampling.ordering, 'deterministic_global_sha256_v1');
  assert.equal(corpus.sampling.sample_id_scheme, 'opaque_sha256_96bit_v1');
});

test('mechanism corpus freezes all 96 observe decisions and excludes active predictions', () => {
  const rows = [];
  for (const world of MECHANISM_VALIDATION_WORLDS) {
    for (const profile of MECHANISM_VALIDATION_PROFILES) {
      for (const condition of MECHANISM_VALIDATION_CONDITIONS) {
        const row = resultRow({ profile, condition: condition.id, seed: 401, world });
        row.jobId = `${world}-${profile}-${condition.id}`;
        row.childEvidence = {
          ok: true,
          run_id: row.jobId,
          parent_run_id: 'mechanism-freeze',
          plan_sha256: 'a'.repeat(64),
          seal_sha256: 'b'.repeat(64),
          artifacts: [],
          event_count: 1,
        };
        row.publicInquiryBrief = {
          opening_text: 'A public inquiry opens with no hidden evidence disclosed.',
          public_situation: 'The learner and tutor examine a bounded public record.',
          public_question: 'What does the public record establish?',
          opening_evidence: [],
          public_requirements: ['Use only public evidence.'],
        };
        row.decisions = Array.from({ length: 8 }, (_, index) => ({
          turn: index + 1,
          strategy_in_force: index === 0 ? null : 'stage_next_step',
          actual_family: 'stage_next_step',
          revised: false,
          gate: {
            revision_warranted: false,
            prior_delivered_action_family: index === 0 ? null : 'stage_next_step',
            pre_gate_proposed_action_family: 'stage_next_step',
            public_obligation: { speech_act: { kind: 'other' }, obligations: [], blocking_obligation: null },
            inquiry_completion: { status: 'open', checks: { release_scope_known: true } },
          },
          shadow: null,
        }));
        row.publicTurns = Array.from({ length: 8 }, (_, index) => ({
          turn: index + 1,
          learner: `Public learner turn ${index + 1}.`,
          tutor: `Public tutor turn ${index + 1}.`,
          dag_total: index + 1,
          grounded_count: index + 1,
          voiced_derived_count: 0,
          action_family: 'stage_next_step',
        }));
        row.liveShadowStructuredComparisonCount = 8;
        row.liveShadowStructuredMismatchCount = 0;
        rows.push(row);
      }
    }
  }
  const annotation = buildBlindedAnnotationCorpus(rows, {
    studyId: 'mechanism-freeze',
    worlds: MECHANISM_VALIDATION_WORLDS,
    profiles: MECHANISM_VALIDATION_PROFILES,
    conditions: MECHANISM_VALIDATION_CONDITIONS.filter((row) => row.id === 'instrumented'),
    includeAllDecisions: true,
    minimumTurn: 1,
    predictionBalanced: false,
  });
  assert.equal(annotation.corpus.cases.length, 96);
  assert.equal(annotation.key.cases.length, 96);
  assert.ok(annotation.key.cases.every((row) => row.condition === 'instrumented'));
  assert.deepEqual(
    [...new Set(annotation.key.cases.map((row) => row.turn))].sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(annotation.corpus.sampling.all_available_decisions, true);
  assert.equal(annotation.corpus.sampling.prediction_balanced_within_cell, false);
  for (const world of MECHANISM_VALIDATION_WORLDS) {
    for (const profile of MECHANISM_VALIDATION_PROFILES) {
      assert.equal(annotation.key.cases.filter((row) => row.world === world && row.profile === profile).length, 8);
    }
  }
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-mechanism-freeze-'));
  try {
    const excludedCorpusPath = path.join(rootDir, 'prior-corpus.json');
    fs.writeFileSync(excludedCorpusPath, `${JSON.stringify({ cases: [] })}\n`);
    const plan = {
      studyId: 'mechanism-freeze',
      design: 'docs/adaptation-refinement/baseline-comparison-design.md',
      jobs: rows.map((row) => ({ id: row.jobId })),
      config: {
        runs: 1,
        horizon: 8,
        world: null,
        worlds: MECHANISM_VALIDATION_WORLDS,
        profiles: MECHANISM_VALIDATION_PROFILES,
        conditions: MECHANISM_VALIDATION_CONDITIONS,
        annotationPerCell: 8,
        annotationConditions: ['instrumented'],
        annotationAllDecisions: true,
        contractValidation: false,
        mechanismValidation: true,
        excludedAnnotationCorpora: [excludedCorpusPath],
        requiredExcludedAnnotationCorpora: [excludedCorpusPath],
      },
    };
    const missingExclusionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-mechanism-no-exclusion-'));
    try {
      assert.throws(
        () =>
          writeStudyArtifacts({
            rootDir: missingExclusionRoot,
            plan: {
              ...plan,
              config: { ...plan.config, excludedAnnotationCorpora: [] },
            },
            rows,
            status: 'complete',
          }),
        /requires at least one explicitly excluded prior corpus/u,
      );
    } finally {
      fs.rmSync(missingExclusionRoot, { recursive: true, force: true });
    }
    writeStudyArtifacts({ rootDir, plan, rows, status: 'complete' });
    const frozenCorpus = JSON.parse(fs.readFileSync(path.join(rootDir, 'annotation-sample.blinded.json'), 'utf8'));
    const frozenKey = JSON.parse(fs.readFileSync(path.join(rootDir, 'annotation-key.private.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'annotation-freeze-manifest.json'), 'utf8'));
    assert.equal(frozenCorpus.cases.length, 96);
    assert.ok(frozenKey.cases.every((row) => row.condition === 'instrumented'));
    assert.equal(manifest.schema, 'machinespirits.adaptation-refinement.warrant-mechanism-validation-freeze.v1');
    assert.equal(manifest.prediction_balanced_diagnostic_sample, false);
    assert.equal(manifest.all_observe_decisions, true);
    assert.deepEqual(manifest.structured_parity.comparisons_by_mode, { observe: 96, active: 96 });
    assert.equal(manifest.structured_parity.mismatches, 0);
    assert.equal(manifest.annotation_handbook.sha256, frozenCorpus.provenance.annotation_handbook.sha256);
    assert.equal(manifest.coverage.exact_dialogue_coverage, true);
    assert.equal(manifest.coverage.learner_analysis.coverage, 1);
    assert.equal(manifest.coverage.learner_analysis.gate_ruling, 'within_registered_coverage');
    assert.equal(manifest.coverage.learner_analysis.dialogues.length, 24);
    assert.equal(manifest.coverage.annotation.exact, true);
    assert.equal(manifest.coverage.annotation.active_cases, 0);
    assert.equal(manifest.study_plan.sha256.length, 64);
    assert.equal(manifest.protocol.sha256.length, 64);
    assert.ok(fs.existsSync(path.join(rootDir, 'annotation-handbook.md')));
    const corpusPath = path.join(rootDir, 'annotation-sample.blinded.json');
    const keyPath = path.join(rootDir, 'annotation-key.private.json');
    const manifestPath = path.join(rootDir, 'annotation-freeze-manifest.json');
    const frozenCorpusText = fs.readFileSync(corpusPath, 'utf8');
    const frozenKeyText = fs.readFileSync(keyPath, 'utf8');
    const frozenManifestText = fs.readFileSync(manifestPath, 'utf8');
    assert.equal(validateAdaptiveWarrantAnnotationFreeze({ rootDir, corpusPath, keyPath }).audit.ok, true);

    fs.writeFileSync(
      corpusPath,
      `${JSON.stringify({ ...JSON.parse(frozenCorpusText), schema: 'warrant-annotation-corpus.v2' }, null, 2)}\n`,
    );
    assert.throws(
      () =>
        scoreAnnotationArtifacts({
          rootDir,
          annotationAPath: path.join(rootDir, 'missing-reader-a.json'),
          annotationBPath: path.join(rootDir, 'missing-reader-b.json'),
          corpusFilename: 'annotation-sample.blinded.json',
          keyFilename: 'annotation-key.private.json',
          outputFilename: 'scores.json',
          evaluationBoundary: 'mechanism-schema-downgrade-regression',
        }),
      /requires the frozen v4 corpus schema/u,
    );
    fs.writeFileSync(corpusPath, frozenCorpusText);

    fs.appendFileSync(keyPath, ' ');
    assert.throws(() => validateAdaptiveWarrantAnnotationFreeze({ rootDir, corpusPath, keyPath }), /key drift/u);
    fs.writeFileSync(keyPath, frozenKeyText);

    const incompleteKey = JSON.parse(frozenKeyText);
    incompleteKey.cases.pop();
    fs.writeFileSync(keyPath, `${JSON.stringify(incompleteKey, null, 2)}\n`);
    const reboundManifest = JSON.parse(frozenManifestText);
    reboundManifest.key.sha256 = fileDigest(keyPath);
    fs.writeFileSync(manifestPath, `${JSON.stringify(reboundManifest, null, 2)}\n`);
    assert.throws(
      () => validateAdaptiveWarrantAnnotationFreeze({ rootDir, corpusPath, keyPath }),
      /exactly the frozen corpus sample ids/u,
    );
    fs.writeFileSync(keyPath, frozenKeyText);
    fs.writeFileSync(manifestPath, frozenManifestText);

    const fingerprintKey = JSON.parse(frozenKeyText);
    fingerprintKey.cases[0].source_fingerprint = '0'.repeat(64);
    fs.writeFileSync(keyPath, `${JSON.stringify(fingerprintKey, null, 2)}\n`);
    const fingerprintManifest = JSON.parse(frozenManifestText);
    fingerprintManifest.key.sha256 = fileDigest(keyPath);
    fs.writeFileSync(manifestPath, `${JSON.stringify(fingerprintManifest, null, 2)}\n`);
    assert.throws(
      () => validateAdaptiveWarrantAnnotationFreeze({ rootDir, corpusPath, keyPath }),
      /source fingerprint mismatch/u,
    );
    fs.writeFileSync(keyPath, frozenKeyText);
    fs.writeFileSync(manifestPath, frozenManifestText);

    fs.appendFileSync(path.join(rootDir, 'annotation-handbook.md'), '\npost-freeze mutation\n');
    assert.throws(
      () => validateAdaptiveWarrantAnnotationFreeze({ rootDir, corpusPath, keyPath }),
      /annotation handbook drift/u,
    );
    assert.throws(
      () => writeStudyArtifacts({ rootDir, plan, rows, status: 'complete' }),
      /freeze burned by annotation handbook drift/u,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('annotation corpus offset freezes a disjoint validation decision per cell', () => {
  const rows = ['baseline', 'instrumented', 'intervening'].map((condition) => {
    const row = resultRow({ profile: 'low_agency', condition, seed: 101 });
    row.decisions.push({ ...row.decisions[0], turn: 4 });
    row.publicTurns.push({ ...row.publicTurns.at(-1), turn: 4 });
    return row;
  });
  const primary = buildBlindedAnnotationCorpus(rows, { perCell: 1, studyId: 'test' });
  const validation = buildBlindedAnnotationCorpus(rows, {
    perCell: 1,
    studyId: 'test-validation',
    samplingSeed: 'test',
    offsetPerCell: 1,
    sampleIdPrefix: 'validation-case',
  });
  const primarySources = new Set(primary.key.cases.map((row) => `${row.job_id}:${row.turn}`));
  const validationSources = validation.key.cases.map((row) => `${row.job_id}:${row.turn}`);
  assert.equal(validationSources.length, 3);
  assert.ok(validationSources.every((source) => !primarySources.has(source)));
  assert.ok(validation.corpus.cases.every((row) => row.sample_id.startsWith('validation-case-')));
});

test('zero-overlap fingerprint is stable across v1 rows and v3 projection enrichment', () => {
  const stableSource = {
    transcript_before_decision: [{ turn: 1, learner: 'What does the record show?', tutor: 'Read the entry.' }],
    current_learner_turn: { turn: 2, learner: 'The entry is still missing the result.' },
    learner_record_at_decision: { grounded_count: 1, voiced_derived_count: 0, total: 1 },
  };
  const oldRow = { sample_id: 'old', ...stableSource, strategy_in_force: 'stage_next_step' };
  const enrichedRow = {
    sample_id: 'new',
    ...stableSource,
    public_inquiry_brief: { public_question: 'What does the record establish?' },
    strategy_in_force: 'stage_next_step',
    prior_delivered_action_family: 'stage_next_step',
    pre_gate_proposed_action_family: 'close_inquiry',
    public_evidence_availability: { known: true, remaining_licensed_count: 2 },
  };
  assert.equal(annotationCaseFingerprint(oldRow), annotationCaseFingerprint(enrichedRow));
  const reorderedSource = {
    learner_record_at_decision: { total: 1, voiced_derived_count: 0, grounded_count: 1 },
    current_learner_turn: { learner: 'The entry is still missing the result.', turn: 2 },
    transcript_before_decision: [{ tutor: 'Read the entry.', learner: 'What does the record show?', turn: 1 }],
  };
  assert.notEqual(JSON.stringify(stableSource), JSON.stringify(reorderedSource));
  assert.equal(annotationCaseFingerprint(stableSource), annotationCaseFingerprint(reorderedSource));
});

test('annotation scorer excludes uncertain consensus and reports decision precision and recall', () => {
  const annotatorA = {
    cases: [
      { sample_id: 'a', revision_warranted: 'yes' },
      { sample_id: 'b', revision_warranted: 'no' },
      { sample_id: 'c', revision_warranted: 'yes' },
      { sample_id: 'd', revision_warranted: 'uncertain' },
    ],
  };
  const annotatorB = {
    cases: [
      { sample_id: 'a', revision_warranted: 'yes' },
      { sample_id: 'b', revision_warranted: 'no' },
      { sample_id: 'c', revision_warranted: 'no' },
      { sample_id: 'd', revision_warranted: 'uncertain' },
    ],
  };
  const key = {
    cases: [
      { sample_id: 'a', shadow: { revision_warranted: true } },
      { sample_id: 'b', shadow: { revision_warranted: true } },
      { sample_id: 'c', shadow: { revision_warranted: false } },
      { sample_id: 'd', shadow: { revision_warranted: false } },
    ],
  };
  const scores = scoreBlindedAnnotations({ annotatorA, annotatorB, key });
  assert.equal(scores.metrics.scoredConsensusCases, 2);
  assert.equal(scores.metrics.uncertainCases, 2);
  assert.equal(scores.metrics.truePositive, 1);
  assert.equal(scores.metrics.falsePositive, 1);
  assert.equal(scores.metrics.precision, 0.5);
  assert.equal(scores.metrics.recall, 1);
  assert.equal(scores.metrics.accuracy, 0.5);
});

test('blind annotation validation fails closed before the private key is needed', () => {
  const corpus = {
    study_id: 'test-study',
    blinded: true,
    cases: [{ sample_id: 'a' }, { sample_id: 'b' }],
  };
  const valid = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v1',
    study_id: 'test-study',
    corpus_sha256: 'frozen',
    cases: [
      { sample_id: 'a', revision_warranted: 'yes', note: 'Persistent strategy failure.' },
      { sample_id: 'b', revision_warranted: 'uncertain', note: 'Evidence supports either reading.' },
    ],
  };
  assert.deepEqual(validateBlindedAnnotationResponse({ response: valid, corpus, expectedCorpusSha256: 'frozen' }), {
    ok: true,
    cases: 2,
    counts: { yes: 1, no: 0, uncertain: 1 },
  });
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...valid, cases: valid.cases.slice(0, 1) },
        corpus,
        expectedCorpusSha256: 'frozen',
      }),
    /exactly 2 frozen cases/u,
  );
  assert.throws(
    () => validateBlindedAnnotationResponse({ response: valid, corpus, expectedCorpusSha256: 'changed' }),
    /corpus_sha256/u,
  );
});

test('v4 corpus rejects schema downgrade and requires independent response identities before key access', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warrant-independent-annotations-'));
  try {
    const corpusPath = path.join(rootDir, 'annotation-sample.blinded.json');
    const corpus = {
      schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
      study_id: 'mechanism-identities',
      blinded: true,
      cases: [{ sample_id: 'case-001', current_learner_turn: { turn: 1 } }],
    };
    fs.writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
    const corpusSha256 = fileDigest(corpusPath);
    const row = {
      sample_id: 'case-001',
      speech_act: 'other',
      open_obligation_source_turns: [],
      obligation_state: 'none',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: 'no',
      current_candidate_override_required: 'no',
      primary_warrant_basis: 'none',
      recommended_action_family: 'hold',
      divergence_by_dimension: alignedDivergenceLabels(),
      note: 'The public record does not warrant a transition.',
    };
    const response = {
      schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v4',
      study_id: corpus.study_id,
      corpus_sha256: corpusSha256,
      annotator_id: 'reader-a',
      annotation_run_id: 'run-a',
      cases: [row],
    };
    const downgraded = {
      schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v2',
      study_id: corpus.study_id,
      corpus_sha256: corpusSha256,
      cases: [
        {
          sample_id: row.sample_id,
          revision_warranted: 'no',
          recommended_action_family: 'hold',
          note: row.note,
        },
      ],
    };
    assert.throws(
      () => validateBlindedAnnotationResponse({ response: downgraded, corpus, expectedCorpusSha256: corpusSha256 }),
      /requires a v4 annotation response/u,
    );
    assert.throws(
      () =>
        validateBlindedAnnotationResponse({
          response: { ...response, annotator_id: undefined },
          corpus,
          expectedCorpusSha256: corpusSha256,
        }),
      /requires annotator_id/u,
    );

    const annotationAPath = path.join(rootDir, 'annotation-a.json');
    const annotationBPath = path.join(rootDir, 'annotation-b.json');
    fs.writeFileSync(annotationAPath, `${JSON.stringify(response, null, 2)}\n`);
    assert.throws(
      () =>
        scoreAnnotationArtifacts({
          rootDir,
          annotationAPath,
          annotationBPath: annotationAPath,
          corpusFilename: 'annotation-sample.blinded.json',
          keyFilename: 'missing-private-key.json',
          outputFilename: 'scores.json',
          evaluationBoundary: 'test',
        }),
      /distinct response files/u,
    );

    fs.writeFileSync(annotationBPath, `${JSON.stringify({ ...response, annotation_run_id: 'run-b' }, null, 2)}\n`);
    assert.throws(
      () =>
        scoreAnnotationArtifacts({
          rootDir,
          annotationAPath,
          annotationBPath,
          corpusFilename: 'annotation-sample.blinded.json',
          keyFilename: 'missing-private-key.json',
          outputFilename: 'scores.json',
          evaluationBoundary: 'test',
        }),
      /distinct annotator_id/u,
    );

    fs.writeFileSync(annotationBPath, `${JSON.stringify({ ...response, annotator_id: 'reader-b' }, null, 2)}\n`);
    assert.throws(
      () =>
        scoreAnnotationArtifacts({
          rootDir,
          annotationAPath,
          annotationBPath,
          corpusFilename: 'annotation-sample.blinded.json',
          keyFilename: 'missing-private-key.json',
          outputFilename: 'scores.json',
          evaluationBoundary: 'test',
        }),
      /distinct annotation_run_id/u,
    );
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test('v4 annotation validation rejects contamination, non-typed values, and inconsistent divergence labels', () => {
  const corpus = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: 'strict-v4-shape',
    blinded: true,
    cases: [{ sample_id: 'case-opaque', current_learner_turn: { turn: 2 } }],
  };
  const row = {
    sample_id: 'case-opaque',
    speech_act: 'other',
    open_obligation_source_turns: [],
    obligation_state: 'none',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'no',
    primary_warrant_basis: 'none',
    recommended_action_family: 'hold',
    divergence_by_dimension: alignedDivergenceLabels(),
    note: 'Only public decision-time evidence was used.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v4',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen-v4-shape',
    annotator_id: 'reader-a',
    annotation_run_id: 'run-a',
    cases: [row],
  };
  assert.equal(
    validateBlindedAnnotationResponse({
      response,
      corpus,
      expectedCorpusSha256: response.corpus_sha256,
    }).ok,
    true,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...response, private_key_sha256: 'secret-source-contamination' },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /unknown fields: private_key_sha256/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...response, cases: [{ ...row, condition: 'instrumented' }] },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /unknown fields: condition/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...response, cases: { [row.sample_id]: row } },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /cases must be an array/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...response, cases: [{ ...row, commitment_transition_warranted: true }] },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /commitment_transition_warranted must be a string/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: { ...response, cases: [{ ...row, open_obligation_source_turns: ['1'] }] },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /open_obligation_source_turns must contain positive integers/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: {
          ...response,
          cases: [
            {
              ...row,
              divergence_by_dimension: alignedDivergenceLabels({
                conceptual: { interpretation: 'stalled', magnitude: 'none', persistence: 'sustained' },
              }),
            },
          ],
        },
        corpus,
        expectedCorpusSha256: response.corpus_sha256,
      }),
    /non-aligned conceptual divergence requires non-none magnitude/u,
  );

  const contractCorpus = {
    ...corpus,
    study_id: 'strict-v4-contract-shape',
    cases: [
      {
        sample_id: 'case-contract',
        current_learner_turn: { turn: 3 },
        normative_action_contract: {
          schema: 'machinespirits.adaptation-refinement.action-family-contract.v1',
          expected_learner_responses: ['examines_or_uses_named_public_material'],
          deadline_turns: 2,
          success_transition: 'renew',
          defeat_transition: 'clarify_distinction',
          expiry_transition: 'answer_accountably',
          exit_on_success: false,
          terminal: false,
        },
      },
    ],
  };
  const contractRow = {
    ...row,
    sample_id: 'case-contract',
    commitment_transition_warranted: 'yes',
    current_candidate_override_required: 'yes',
    primary_warrant_basis: 'action_contract',
    recommended_action_family: 'clarify_distinction',
    note: 'The public uptake evidence defeats the raw expected-response contract.',
  };
  const contractResponse = {
    ...response,
    study_id: contractCorpus.study_id,
    cases: [contractRow],
  };
  assert.equal(
    validateBlindedAnnotationResponse({
      response: contractResponse,
      corpus: contractCorpus,
      expectedCorpusSha256: contractResponse.corpus_sha256,
    }).ok,
    true,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: {
          ...contractResponse,
          cases: [{ ...contractRow, recommended_action_family: 'stage_next_step' }],
        },
        corpus: contractCorpus,
        expectedCorpusSha256: contractResponse.corpus_sha256,
      }),
    /not a declared public contract successor/u,
  );
});

test('annotation scorer rejects missing and duplicate private-key sample ids', () => {
  const annotatorA = { cases: [{ sample_id: 'a', revision_warranted: 'yes' }] };
  const annotatorB = { cases: [{ sample_id: 'a', revision_warranted: 'yes' }] };
  assert.throws(
    () => scoreBlindedAnnotations({ annotatorA, annotatorB, key: { cases: [] } }),
    /exactly the same sample ids/u,
  );
  assert.throws(
    () =>
      scoreBlindedAnnotations({
        annotatorA,
        annotatorB,
        key: { cases: [{ sample_id: 'a' }, { sample_id: 'a' }] },
      }),
    /duplicate sample ids/u,
  );
});

test('v2 annotations validate successor families and the scorer gates decision plus transition quality', () => {
  const corpus = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-corpus.v2',
    study_id: 'contract-validation',
    blinded: true,
    cases: Array.from({ length: 12 }, (_, index) => ({ sample_id: `c${index + 1}` })),
  };
  const labels = [
    ['yes', 'stage_next_step'],
    ['yes', 'answer_accountably'],
    ...Array.from({ length: 10 }, () => ['no', 'hold']),
  ];
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v2',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen-v2',
    cases: corpus.cases.map((row, index) => ({
      sample_id: row.sample_id,
      revision_warranted: labels[index][0],
      recommended_action_family: labels[index][1],
      note: 'Decision-time evidence supports this transition.',
    })),
  };
  assert.equal(validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256: 'frozen-v2' }).ok, true);
  const key = {
    cases: corpus.cases.map((row, index) => ({
      sample_id: row.sample_id,
      profile: index >= 8 ? 'diligent' : 'low_agency',
      shadow: {
        revision_warranted: labels[index][0] === 'yes',
        policy: labels[index][0] === 'yes' ? { family: labels[index][1] } : null,
      },
    })),
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.metrics.precision, 1);
  assert.equal(score.metrics.recall, 1);
  assert.equal(score.metrics.transitionAccuracy, 1);
  assert.equal(score.metrics.diligentFalsePositiveRate, 0);
  const gate = evaluateAdaptiveWarrantDecisionGate(score, { liveShadowAgreement: 1 });
  assert.equal(gate.passed, true);
  assert.ok(gate.checks.every((row) => row.passed));
});

test('v3 mechanism annotations validate typed states and score ledger, closure, and override separately', () => {
  const corpus = {
    study_id: 'mechanism-validation',
    blinded: true,
    cases: ['request', 'proposal', 'complete', 'unsafe-close'].map((sample_id) => ({ sample_id })),
  };
  const rows = [
    {
      sample_id: 'request',
      speech_act: 'tutor_directed_public_result_request',
      open_obligation_source_turns: [1],
      obligation_state: 'open',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: 'yes',
      current_candidate_override_required: 'yes',
      primary_warrant_basis: 'public_obligation',
      recommended_action_family: 'answer_accountably',
    },
    {
      sample_id: 'proposal',
      speech_act: 'learner_proposed_test',
      open_obligation_source_turns: [],
      obligation_state: 'none',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: 'no',
      current_candidate_override_required: 'no',
      primary_warrant_basis: 'none',
      recommended_action_family: 'hold',
    },
    {
      sample_id: 'complete',
      speech_act: 'other',
      open_obligation_source_turns: [],
      obligation_state: 'none',
      inquiry_state: 'complete',
      commitment_transition_warranted: 'yes',
      current_candidate_override_required: 'yes',
      primary_warrant_basis: 'inquiry_completion',
      recommended_action_family: 'close_inquiry',
    },
    {
      sample_id: 'unsafe-close',
      speech_act: 'other',
      open_obligation_source_turns: [],
      obligation_state: 'none',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: 'no',
      current_candidate_override_required: 'no',
      primary_warrant_basis: 'none',
      recommended_action_family: 'hold',
    },
  ].map((row) => ({ ...row, note: 'Typed decision-time evidence supports this label.' }));
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen-v3',
    cases: rows,
  };
  assert.equal(validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256: 'frozen-v3' }).ok, true);
  const projection = ({
    speech,
    obligation = null,
    inquiry = 'open',
    basis = 'none',
    family = null,
    transition,
    override,
    remaining = 0,
  }) => ({
    revision_warranted: basis !== 'none',
    commitment_transition_warranted: transition,
    current_candidate_override_required: override,
    warrant_basis: basis,
    policy: family ? { family } : null,
    public_obligation: {
      speech_act: { kind: speech },
      blocking_obligation: obligation,
      obligations: obligation ? [obligation] : [],
    },
    inquiry_completion: {
      status: inquiry,
      checks: { remaining_licensed_evidence_count: remaining },
    },
  });
  const key = {
    cases: [
      {
        sample_id: 'request',
        shadow: projection({
          speech: 'tutor_directed_public_result_request',
          obligation: { id: 'public-obligation-001', status: 'open', created_turn: 1 },
          basis: 'public_obligation_open:public-obligation-001',
          family: 'answer_accountably',
          transition: true,
          override: true,
        }),
      },
      {
        sample_id: 'proposal',
        shadow: projection({ speech: 'learner_proposed_test', transition: false, override: false }),
      },
      {
        sample_id: 'complete',
        shadow: projection({
          speech: 'other',
          inquiry: 'complete',
          basis: 'inquiry_complete:strict_grounded_asserted',
          family: 'close_inquiry',
          transition: true,
          override: true,
        }),
      },
      {
        sample_id: 'unsafe-close',
        shadow: projection({
          speech: 'other',
          inquiry: 'open',
          basis: 'inquiry_complete:strict_grounded_asserted',
          family: 'close_inquiry',
          transition: true,
          override: true,
          remaining: 2,
        }),
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.metrics.requestProposalMacroF1, 1);
  assert.equal(score.metrics.obligationLifecycleAccuracy, 1);
  assert.equal(score.metrics.inquiryCompletionPrecision, 1);
  assert.equal(score.metrics.inquiryCompletionRecall, 1);
  assert.equal(score.metrics.closureSafetyViolations, 1);
  assert.equal(score.metrics.candidateOverrideAccuracy, 0.75);
});

test('v4 scorer measures interpretation, magnitude, persistence, and joint divergence on every DAG layer', () => {
  const corpus = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: 'multidimensional-divergence',
    blinded: true,
    cases: [
      { sample_id: 'aligned', current_learner_turn: { turn: 2 } },
      { sample_id: 'divergent', current_learner_turn: { turn: 4 } },
    ],
  };
  const divergent = alignedDivergenceLabels({
    conceptual: { interpretation: 'productive', magnitude: 'moderate', persistence: 'sustained' },
    interactional: { interpretation: 'stalled', magnitude: 'moderate', persistence: 'sustained' },
    engagement: { interpretation: 'stalled', magnitude: 'high', persistence: 'sustained' },
    pacing: { interpretation: 'productive', magnitude: 'low', persistence: 'single_turn' },
    epistemic: { interpretation: 'unsafe', magnitude: 'moderate', persistence: 'single_turn' },
    strategy_exhaustion: { interpretation: 'stalled', magnitude: 'moderate', persistence: 'sustained' },
  });
  const mechanismRow = (sampleId, divergence) => ({
    sample_id: sampleId,
    speech_act: 'other',
    open_obligation_source_turns: [],
    obligation_state: 'none',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'no',
    primary_warrant_basis: 'none',
    recommended_action_family: 'hold',
    divergence_by_dimension: divergence,
    note: 'The public decision-time evidence supports these typed labels.',
  });
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v4',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen-v4',
    annotator_id: 'reader-a',
    annotation_run_id: 'run-a',
    cases: [mechanismRow('aligned', alignedDivergenceLabels()), mechanismRow('divergent', divergent)],
  };
  assert.equal(validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256: 'frozen-v4' }).ok, true);
  const numericPersistence = { none: 0, single_turn: 1, sustained: 2 };
  const projection = (labels) => ({
    revision_warranted: false,
    commitment_transition_warranted: false,
    current_candidate_override_required: false,
    warrant_basis: 'none',
    policy: null,
    public_obligation: { speech_act: { kind: 'other' }, obligations: [], blocking_obligation: null },
    inquiry_completion: { status: 'open', checks: {} },
    divergence: Object.entries(labels).map(([dimension, value]) => ({
      dimension,
      interpretation: value.interpretation,
      magnitude: value.magnitude,
      persistence: numericPersistence[value.persistence],
    })),
  });
  const key = {
    cases: [
      { sample_id: 'aligned', shadow: projection(alignedDivergenceLabels()) },
      { sample_id: 'divergent', shadow: projection(divergent) },
    ],
  };
  const responseB = { ...response, annotator_id: 'reader-b', annotation_run_id: 'run-b' };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: responseB, key });
  for (const dimension of Object.keys(divergent)) {
    const metrics = score.metrics.divergenceDimensionMetrics[dimension];
    assert.equal(metrics.hard_consensus_rate, 1);
    assert.equal(metrics.nonaligned_consensus_cases, 1);
    assert.equal(metrics.interpretation_macro_f1, 1);
    assert.equal(metrics.magnitude_accuracy, 1);
    assert.equal(metrics.persistence_accuracy, 1);
    assert.equal(metrics.joint_accuracy, 1);
  }
  const gate = evaluateAdaptiveWarrantDecisionGate(score, {
    liveShadowAgreement: 1,
    structuredParityComparisons: 2,
    structuredParityComparisonsByMode: { observe: 1, active: 1 },
    structuredParityMismatches: 0,
    requireMechanismMetrics: true,
  });
  assert.equal(
    gate.checks.some((row) => row.id === 'divergence_conceptual_interpretation_macro_f1'),
    false,
  );
  assert.equal(
    gate.checks.some((row) => row.id === 'divergence_evaluable_dimensions'),
    false,
  );
  assert.equal(
    gate.support_boundary.divergence.every((row) => row.interpretation_evaluable === false),
    true,
  );
});

test('obligation lifecycle exactness rejects the wrong unresolved source turn even when state matches', () => {
  const row = {
    sample_id: 'open-source-turn',
    speech_act: 'other',
    open_obligation_source_turns: [1],
    obligation_state: 'open',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'yes',
    current_candidate_override_required: 'yes',
    primary_warrant_basis: 'public_obligation',
    recommended_action_family: 'answer_accountably',
    note: 'The unresolved tutor obligation originates at learner turn one.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: [row],
  };
  const keyForSourceTurn = (createdTurn) => ({
    cases: [
      {
        sample_id: row.sample_id,
        turn: 3,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: true,
          current_candidate_override_required: true,
          warrant_basis: 'public_obligation_open:public-obligation-001',
          policy: { family: 'answer_accountably' },
          public_obligation: {
            speech_act: { kind: 'other' },
            blocking_obligation: { id: 'public-obligation-001', status: 'open', created_turn: createdTurn },
            obligations: [
              { id: 'public-obligation-001', status: 'open', created_turn: createdTurn },
              { id: 'public-obligation-002', status: 'satisfied', created_turn: 2 },
            ],
          },
          inquiry_completion: { status: 'open', checks: {} },
        },
      },
    ],
  });

  const wrong = scoreBlindedAnnotations({
    annotatorA: response,
    annotatorB: response,
    key: keyForSourceTurn(2),
  });
  assert.equal(wrong.cases[0].obligation_state_consensus, 'open');
  assert.equal(wrong.cases[0].predicted_obligation_state, 'open');
  assert.deepEqual(wrong.cases[0].obligation_source_turns_consensus, [1]);
  assert.deepEqual(wrong.cases[0].predicted_open_obligation_source_turns, [2]);
  assert.equal(wrong.cases[0].obligation_source_turns_match, false);
  assert.equal(wrong.metrics.obligationLifecycleAccuracy, 0);
  assert.equal(wrong.metrics.obligationPersistenceAccuracy, 0);

  const exact = scoreBlindedAnnotations({
    annotatorA: response,
    annotatorB: response,
    key: keyForSourceTurn(1),
  });
  assert.deepEqual(exact.cases[0].predicted_open_obligation_source_turns, [1]);
  assert.equal(exact.cases[0].obligation_source_turns_match, true);
  assert.equal(exact.metrics.obligationLifecycleAccuracy, 1);
  assert.equal(exact.metrics.obligationPersistenceAccuracy, 1);
});

test('v3 successor denominator requires a gold commitment transition and an exact predicted transition', () => {
  const cases = [
    {
      sample_id: 'basis-only',
      commitment_transition_warranted: 'no',
    },
    {
      sample_id: 'transition',
      commitment_transition_warranted: 'yes',
    },
  ];
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: cases.map((row) => ({
      ...row,
      speech_act: 'other',
      open_obligation_source_turns: [],
      obligation_state: 'none',
      inquiry_state: 'incomplete',
      current_candidate_override_required: 'yes',
      primary_warrant_basis: 'immediate_repair',
      recommended_action_family: 'repair_explanation',
      note: 'The public repair signal fixes the recommended family.',
    })),
  };
  const key = {
    cases: cases.map((row) => ({
      sample_id: row.sample_id,
      shadow: {
        revision_warranted: true,
        commitment_transition_warranted: false,
        current_candidate_override_required: true,
        warrant_basis: 'immediate:repair_request',
        policy: { family: 'repair_explanation' },
        public_obligation: { speech_act: { kind: 'other' }, obligations: [] },
        inquiry_completion: { status: 'open', checks: {} },
      },
    })),
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.cases.find((row) => row.sample_id === 'basis-only').transition_scored, false);
  assert.equal(score.cases.find((row) => row.sample_id === 'transition').transition_match, false);
  assert.equal(score.metrics.transitionConsensusCases, 1);
  assert.equal(score.metrics.transitionAccuracy, 0);
});

test('candidate safety remains distinct from whole-inquiry completion in annotation scoring', () => {
  const row = {
    sample_id: 'unsafe-close-candidate',
    speech_act: 'learner_proposed_test',
    open_obligation_source_turns: [],
    obligation_state: 'satisfied',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'yes',
    primary_warrant_basis: 'candidate_safety',
    recommended_action_family: 'stage_next_step',
    note: 'The close candidate is unsafe while licensed public evidence still remains.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: [row],
  };
  const key = {
    cases: [
      {
        sample_id: row.sample_id,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: false,
          current_candidate_override_required: true,
          warrant_basis: 'inquiry_incomplete_candidate:licensed_evidence_remains',
          policy: { family: 'stage_next_step' },
          public_obligation: {
            speech_act: { kind: 'learner_proposed_test' },
            obligations: [{ id: 'public-obligation-001', status: 'satisfied', created_turn: 1 }],
          },
          inquiry_completion: {
            status: 'open',
            checks: { remaining_licensed_evidence_count: 2 },
          },
        },
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.cases[0].predicted_primary_warrant_basis, 'candidate_safety');
  assert.equal(score.cases[0].predicted_inquiry_state, 'incomplete');
  assert.equal(score.cases[0].predicted_commitment_transition, 'no');
  assert.equal(score.cases[0].predicted_candidate_override, 'yes');
  assert.equal(score.metrics.primaryWarrantBasisAccuracy, 1);
});

test('closure safety uses gold incomplete inquiry and unresolved obligation even when the gate calls itself complete', () => {
  const row = {
    sample_id: 'unsafe-gold-close',
    speech_act: 'other',
    open_obligation_source_turns: [1],
    obligation_state: 'open',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'yes',
    current_candidate_override_required: 'yes',
    primary_warrant_basis: 'public_obligation',
    recommended_action_family: 'answer_accountably',
    note: 'The prior public result request remains unresolved.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: [row],
  };
  const key = {
    cases: [
      {
        sample_id: row.sample_id,
        turn: 2,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: true,
          current_candidate_override_required: true,
          warrant_basis: 'inquiry_complete:strict_grounded_asserted',
          policy: { family: 'close_inquiry' },
          public_obligation: { speech_act: { kind: 'other' }, obligations: [] },
          inquiry_completion: { status: 'complete', checks: { remaining_licensed_evidence_count: 0 } },
        },
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.cases[0].predicted_inquiry_state, 'complete');
  assert.equal(score.metrics.closureSafetyViolations, 1);
});

test('closure safety keeps an accountable deferred obligation recorded but nonblocking', () => {
  const row = {
    sample_id: 'safe-deferred-close',
    speech_act: 'other',
    open_obligation_source_turns: [1],
    obligation_state: 'deferred',
    inquiry_state: 'complete',
    commitment_transition_warranted: 'yes',
    current_candidate_override_required: 'no',
    primary_warrant_basis: 'inquiry_completion',
    recommended_action_family: 'close_inquiry',
    note: 'The unavailable result has a concrete future condition and does not block terminal closure.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: [row],
  };
  const key = {
    cases: [
      {
        sample_id: row.sample_id,
        turn: 2,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: true,
          current_candidate_override_required: false,
          warrant_basis: 'inquiry_complete:strict_grounded_asserted',
          policy: { family: 'close_inquiry' },
          public_obligation: {
            speech_act: { kind: 'other' },
            obligations: [{ id: 'public-obligation-001', status: 'deferred', created_turn: 1 }],
          },
          inquiry_completion: { status: 'complete', checks: { remaining_licensed_evidence_count: 0 } },
        },
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.cases[0].predicted_obligation_state, 'deferred');
  assert.equal(score.metrics.closureSafetyViolations, 0);
});

test('proposed-test false-obligation denominator survives lifecycle disagreement', () => {
  const base = {
    sample_id: 'proposal-disputed-debt',
    speech_act: 'learner_proposed_test',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'no',
    current_candidate_override_required: 'no',
    note: 'The learner proposes their own test rather than requesting a tutor result.',
  };
  const annotatorA = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    cases: [
      {
        ...base,
        open_obligation_source_turns: [],
        obligation_state: 'none',
        primary_warrant_basis: 'none',
        recommended_action_family: 'hold',
      },
    ],
  };
  const annotatorB = {
    ...annotatorA,
    cases: [
      {
        ...base,
        open_obligation_source_turns: [1],
        obligation_state: 'open',
        primary_warrant_basis: 'public_obligation',
        recommended_action_family: 'answer_accountably',
      },
    ],
  };
  const key = {
    cases: [
      {
        sample_id: base.sample_id,
        turn: 2,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: true,
          current_candidate_override_required: true,
          warrant_basis: 'public_obligation_open:public-obligation-001',
          policy: { family: 'answer_accountably' },
          public_obligation: {
            speech_act: { kind: 'learner_proposed_test', creates_obligation: true },
            events: [{ type: 'created', obligation_id: 'public-obligation-001', turn: 2 }],
            obligations: [{ id: 'public-obligation-001', status: 'open' }],
          },
          inquiry_completion: { status: 'open', checks: {} },
        },
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA, annotatorB, key });
  assert.equal(score.cases[0].speech_act_consensus, 'learner_proposed_test');
  assert.equal(score.cases[0].obligation_state_consensus, 'uncertain');
  assert.equal(score.metrics.proposedTestFalseObligationRate, 1);
});

test('request/proposal macro-F1 counts false positives made on other public speech acts', () => {
  const speechActs = ['tutor_directed_public_result_request', 'learner_proposed_test', 'other'];
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    study_id: 'speech-act-fp',
    corpus_sha256: 'frozen',
    cases: speechActs.map((speech_act, index) => ({
      sample_id: `speech-${index + 1}`,
      speech_act,
      open_obligation_source_turns: speech_act === 'tutor_directed_public_result_request' ? [1] : [],
      obligation_state: speech_act === 'tutor_directed_public_result_request' ? 'open' : 'none',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: speech_act === 'tutor_directed_public_result_request' ? 'yes' : 'no',
      current_candidate_override_required: speech_act === 'tutor_directed_public_result_request' ? 'yes' : 'no',
      primary_warrant_basis: speech_act === 'tutor_directed_public_result_request' ? 'public_obligation' : 'none',
      recommended_action_family: speech_act === 'tutor_directed_public_result_request' ? 'answer_accountably' : 'hold',
      note: 'The public turn fixes the speech-act label.',
    })),
  };
  const predictedActs = [
    'tutor_directed_public_result_request',
    'learner_proposed_test',
    'tutor_directed_public_result_request',
  ];
  const key = {
    cases: predictedActs.map((speechAct, index) => ({
      sample_id: `speech-${index + 1}`,
      shadow: {
        revision_warranted: index === 0,
        commitment_transition_warranted: index === 0,
        current_candidate_override_required: index === 0,
        warrant_basis: index === 0 ? 'public_obligation_open:public-obligation-001' : 'none',
        policy: index === 0 ? { family: 'answer_accountably' } : null,
        public_obligation: {
          speech_act: { kind: speechAct },
          blocking_obligation: index === 0 ? { id: 'public-obligation-001', status: 'open' } : null,
          obligations: index === 0 ? [{ id: 'public-obligation-001', status: 'open' }] : [],
        },
        inquiry_completion: { status: 'open', checks: {} },
      },
    })),
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.metrics.resultRequestConsensusCases, 1);
  assert.equal(score.metrics.proposedTestConsensusCases, 1);
  assert.equal(score.metrics.requestProposalMacroF1, 0.833);
});

test('mechanism decision gate requires nonzero structured parity in observe and active arms', () => {
  const gate = evaluateAdaptiveWarrantDecisionGate(
    { metrics: { mechanismHardConsensusRate: 1 } },
    {
      liveShadowAgreement: 1,
      structuredParityComparisons: 8,
      structuredParityComparisonsByMode: { observe: 8, active: 0 },
      structuredParityMismatches: 0,
    },
  );
  const checks = Object.fromEntries(gate.checks.map((row) => [row.id, row]));
  assert.equal(checks.structured_parity_comparisons.passed, true);
  assert.equal(checks.structured_parity_observe_comparisons.passed, true);
  assert.equal(checks.structured_parity_active_comparisons.passed, false);
  assert.equal(checks.structured_parity_mismatches.passed, true);
  assert.equal(gate.passed, false);
});

test('mechanism gate quotes the registered analysis coverage and uses analyzed parity denominators', () => {
  const analysisCoverage = {
    threshold: 0.15,
    analysis_turns: 16,
    analyzed_turns: 15,
    unanalyzed_turns: 1,
    unanalyzed_rate: 0.0625,
    coverage: 0.9375,
    gate_ruling: 'within_registered_coverage',
    by_condition: {
      instrumented: { analyzed_turns: 8 },
      intervening: { analyzed_turns: 7 },
    },
    dialogues: [],
  };
  const gate = evaluateAdaptiveWarrantDecisionGate(
    { metrics: { mechanismHardConsensusRate: 1 } },
    {
      liveShadowAgreement: 1,
      structuredParityComparisons: 15,
      structuredParityComparisonsByMode: { observe: 8, active: 7 },
      structuredParityMismatches: 0,
      analysisCoverage,
    },
  );
  const checks = Object.fromEntries(gate.checks.map((row) => [row.id, row]));
  assert.equal(checks.learner_analysis_unanalyzed_rate.passed, true);
  assert.equal(checks.structured_parity_comparisons.threshold, 15);
  assert.equal(checks.structured_parity_active_comparisons.threshold, 7);
  assert.equal(gate.analysis_coverage_ruling.coverage, 0.9375);
});

test('mechanism gate cannot downgrade to legacy checks and gates all typed decision accuracies', () => {
  const baseMetrics = {
    rawAnnotatorAgreement: 1,
    scoredConsensusCases: 36,
    consensusPositiveCases: 12,
    consensusNegativeCases: 24,
    precision: 1,
    recall: 1,
    accuracy: 1,
    transitionConsensusCases: 10,
    transitionAccuracy: 1,
    diligentConsensusNegativeCases: 1,
    diligentFalsePositiveRate: 0,
  };
  const parity = {
    liveShadowAgreement: 1,
    structuredParityComparisons: 2,
    structuredParityComparisonsByMode: { observe: 1, active: 1 },
    structuredParityMismatches: 0,
    requireMechanismMetrics: true,
  };
  const downgraded = evaluateAdaptiveWarrantDecisionGate({ metrics: baseMetrics }, parity);
  assert.equal(downgraded.passed, false);
  assert.equal(downgraded.checks.find((row) => row.id === 'mechanism_hard_consensus_rate').passed, false);

  const mechanismMetrics = {
    ...baseMetrics,
    mechanismHardConsensusRate: 1,
    resultRequestConsensusCases: 8,
    proposedTestConsensusCases: 8,
    requestProposalMacroF1: 1,
    obligationLifecycleAccuracy: 1,
    obligationPersistenceCases: 8,
    obligationResolutionCases: 6,
    proposedTestFalseObligationRate: 0,
    inquiryCompleteConsensusCases: 8,
    inquiryIncompleteConsensusCases: 12,
    inquiryCompletionPrecision: 1,
    inquiryCompletionRecall: 1,
    commitmentTransitionAccuracy: 0,
    candidateOverrideAccuracy: 0,
    primaryWarrantBasisAccuracy: 0,
    closureSafetyViolations: 0,
  };
  const failedTyped = evaluateAdaptiveWarrantDecisionGate({ metrics: mechanismMetrics }, parity);
  const failedChecks = Object.fromEntries(failedTyped.checks.map((row) => [row.id, row]));
  assert.equal(failedTyped.passed, false);
  assert.equal(failedChecks.commitment_transition_accuracy.passed, false);
  assert.equal(failedChecks.candidate_override_accuracy.passed, false);
  assert.equal(failedChecks.primary_warrant_basis_accuracy.passed, false);
  assert.equal(
    failedChecks.commitment_transition_accuracy.threshold,
    ADAPTIVE_WARRANT_DECISION_GATE.minimum_commitment_transition_accuracy,
  );

  const preregisteredCut = evaluateAdaptiveWarrantDecisionGate(
    {
      metrics: {
        ...mechanismMetrics,
        mechanismHardConsensusRate: 0.667,
      },
    },
    parity,
  );
  assert.equal(preregisteredCut.passed, true);
  assert.equal(preregisteredCut.mechanism_typing_claim.status, 'cut_below_consensus_floor');
  assert.equal(preregisteredCut.checks.find((row) => row.id === 'mechanism_hard_consensus_rate').controlling, false);
  assert.equal(preregisteredCut.checks.find((row) => row.id === 'commitment_transition_accuracy').controlling, false);

  const passed = evaluateAdaptiveWarrantDecisionGate(
    {
      metrics: {
        ...mechanismMetrics,
        commitmentTransitionAccuracy: 1,
        candidateOverrideAccuracy: 1,
        primaryWarrantBasisAccuracy: 1,
      },
    },
    parity,
  );
  assert.equal(passed.passed, true);
});

test('representative v2 gate reports rare support without importing diagnostic quotas', () => {
  const divergenceDimensions = [
    'conceptual',
    'interactional',
    'engagement',
    'pacing',
    'epistemic',
    'strategy_exhaustion',
  ];
  const divergence = Object.fromEntries(
    divergenceDimensions.map((dimension, index) => [
      dimension,
      {
        hard_consensus_rate: 1,
        nonaligned_consensus_cases: index === 4 ? 0 : 2,
        interpretation_macro_f1: 1,
        magnitude_accuracy: 1,
        persistence_accuracy: 1,
        joint_accuracy: 1,
      },
    ]),
  );
  const metrics = {
    rawAnnotatorAgreement: 1,
    scoredConsensusCases: 75,
    consensusPositiveCases: 26,
    consensusNegativeCases: 49,
    precision: 1,
    recall: 1,
    accuracy: 1,
    transitionConsensusCases: 10,
    transitionAccuracy: 1,
    diligentConsensusNegativeCases: 10,
    diligentFalsePositiveRate: 0,
    mechanismHardConsensusRate: 1,
    resultRequestConsensusCases: 10,
    proposedTestConsensusCases: 18,
    requestProposalMacroF1: 1,
    obligationLifecycleAccuracy: 1,
    obligationPersistenceCases: 1,
    obligationResolutionCases: 1,
    proposedTestFalseObligationRate: 0,
    inquiryCompleteConsensusCases: 4,
    inquiryIncompleteConsensusCases: 89,
    inquiryCompletionPrecision: 1,
    inquiryCompletionRecall: 1,
    commitmentTransitionAccuracy: 1,
    candidateOverrideAccuracy: 1,
    primaryWarrantBasisAccuracy: 1,
    closureSafetyViolations: 0,
    divergenceDimensionMetrics: divergence,
  };
  const result = evaluateAdaptiveWarrantDecisionGate(
    { metrics },
    {
      liveShadowAgreement: 1,
      structuredParityComparisons: 192,
      structuredParityComparisonsByMode: { observe: 96, active: 96 },
      structuredParityMismatches: 0,
      requireMechanismMetrics: true,
    },
  );
  assert.equal(result.schema, 'machinespirits.adaptation-refinement.warrant-decision-gate.v3');
  assert.equal(result.passed, true);
  assert.equal(
    result.checks.some((row) => row.id === 'obligation_persistence_cases'),
    false,
  );
  assert.equal(
    result.checks.some((row) => row.id === 'obligation_resolution_cases'),
    false,
  );
  assert.equal(
    result.checks.some((row) => row.id === 'divergence_evaluable_dimensions'),
    false,
  );
  assert.equal(
    result.checks.some((row) => row.id === 'divergence_epistemic_interpretation_macro_f1'),
    false,
  );
  assert.equal(result.support_boundary.rare_state_diagnostic_gate_eligible, false);
});

test('decision gate leaves naturally unsupported diligent and transition cells not evaluable', () => {
  const metrics = {
    rawAnnotatorAgreement: 1,
    scoredConsensusCases: 12,
    consensusPositiveCases: 2,
    consensusNegativeCases: 10,
    precision: 1,
    recall: 1,
    accuracy: 1,
    transitionConsensusCases: 1,
    transitionAccuracy: null,
    diligentConsensusNegativeCases: 0,
    diligentFalsePositiveRate: null,
  };
  const gate = evaluateAdaptiveWarrantDecisionGate(
    { metrics },
    {
      liveShadowAgreement: 1,
    },
  );
  const checks = Object.fromEntries(gate.checks.map((row) => [row.id, row]));
  assert.equal(checks.diligent_consensus_negative_cases, undefined);
  assert.equal(checks.diligent_false_positive_rate, undefined);
  assert.equal(checks.transition_consensus_cases, undefined);
  assert.equal(checks.transition_accuracy, undefined);
  assert.equal(gate.passed, true);
});

test('v3 annotation vocabulary preserves obligation-closing withdrawal and transfer acts', () => {
  const corpus = {
    study_id: 'closing-acts',
    blinded: true,
    cases: [
      { sample_id: 'withdraw', current_learner_turn: { turn: 2 } },
      { sample_id: 'transfer', current_learner_turn: { turn: 2 } },
    ],
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    study_id: corpus.study_id,
    corpus_sha256: 'frozen',
    cases: [
      ['withdraw', 'withdrawal'],
      ['transfer', 'transfer_to_learner'],
    ].map(([sample_id, speech_act]) => ({
      sample_id,
      speech_act,
      open_obligation_source_turns: [],
      obligation_state: 'withdrawn_or_transferred',
      inquiry_state: 'incomplete',
      commitment_transition_warranted: 'no',
      current_candidate_override_required: 'no',
      primary_warrant_basis: 'none',
      recommended_action_family: 'hold',
      note: 'The learner explicitly closes the prior public obligation.',
    })),
  };
  assert.equal(validateBlindedAnnotationResponse({ response, corpus, expectedCorpusSha256: 'frozen' }).ok, true);
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: {
          ...response,
          cases: response.cases.map((row, index) =>
            index === 0 ? { ...row, obligation_state: 'open', open_obligation_source_turns: [] } : row,
          ),
        },
        corpus,
        expectedCorpusSha256: 'frozen',
      }),
    /requires an open obligation source turn/u,
  );
  assert.throws(
    () =>
      validateBlindedAnnotationResponse({
        response: {
          ...response,
          cases: response.cases.map((row, index) =>
            index === 0 ? { ...row, obligation_state: 'open', open_obligation_source_turns: [3] } : row,
          ),
        },
        corpus,
        expectedCorpusSha256: 'frozen',
      }),
    /future open obligation source turn/u,
  );
});

test('proposal scoring preserves prior deferred debt without calling the proposal a new obligation', () => {
  const row = {
    sample_id: 'proposal-with-prior-debt',
    speech_act: 'learner_proposed_test',
    open_obligation_source_turns: [1],
    obligation_state: 'deferred',
    inquiry_state: 'incomplete',
    commitment_transition_warranted: 'yes',
    current_candidate_override_required: 'yes',
    primary_warrant_basis: 'public_obligation',
    recommended_action_family: 'answer_accountably',
    note: 'The earlier request remains deferred; this turn only proposes a learner-run test.',
  };
  const response = {
    schema: 'machinespirits.adaptation-refinement.warrant-annotation-response.v3',
    study_id: 'proposal-prior-debt',
    corpus_sha256: 'frozen',
    cases: [row],
  };
  const key = {
    cases: [
      {
        sample_id: row.sample_id,
        turn: 3,
        shadow: {
          revision_warranted: true,
          commitment_transition_warranted: true,
          current_candidate_override_required: true,
          warrant_basis: 'public_obligation_deferred:public-obligation-001',
          policy: { family: 'answer_accountably' },
          public_obligation: {
            speech_act: { kind: 'learner_proposed_test', creates_obligation: false },
            events: [{ type: 'deferred', obligation_id: 'public-obligation-001', turn: 2 }],
            blocking_obligation: null,
            obligations: [
              { id: 'public-obligation-001', status: 'deferred', created_turn: 1 },
              { id: 'public-obligation-002', status: 'satisfied', created_turn: 2 },
            ],
          },
          inquiry_completion: { status: 'open', checks: {} },
        },
      },
    ],
  };
  const score = scoreBlindedAnnotations({ annotatorA: response, annotatorB: response, key });
  assert.equal(score.cases[0].predicted_obligation_state, 'deferred');
  assert.equal(score.cases[0].predicted_current_turn_obligation_creation, false);
  assert.equal(score.metrics.proposedTestFalseObligationRate, 0);
  assert.equal(score.metrics.obligationLifecycleAccuracy, 1);

  const disagreement = scoreBlindedAnnotations({
    annotatorA: response,
    annotatorB: {
      ...response,
      cases: [{ ...row, open_obligation_source_turns: [2] }],
    },
    key,
  });
  assert.equal(disagreement.cases[0].obligation_source_turns_consensus, null);
  assert.equal(disagreement.metrics.mechanismHardConsensusCases, 0);
});
