#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_REQUEST = path.join(
  ROOT,
  'config',
  'tutor-stub-resistant-profile-discrimination-study-go-request.v1.json',
);

function parseArgs(argv) {
  const args = { request: DEFAULT_REQUEST, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--request') args.request = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/check-tutor-stub-resistant-profile-study-go-request.js [options]

Options:
  --request <json>  non-executable study GO request
  --json            emit machine-readable report

This is a zero-call, zero-write request validator. It cannot authorize or
launch the study.`);
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function sha256Json(value) {
  return sha256(JSON.stringify(value));
}

function assertion(checks, name, condition, detail) {
  if (!condition) throw new Error(`${name}: ${detail}`);
  checks.push({ name, pass: true, detail });
}

function rootPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function bindingPath(binding) {
  return path.isAbsolute(binding.path) ? binding.path : rootPath(binding.path);
}

function validateFileBinding(checks, name, binding) {
  const observed = sha256File(bindingPath(binding));
  assertion(checks, name, observed === binding.sha256, `${binding.path} remains ${binding.sha256}`);
}

function validateMachineLocalFileBinding(checks, name, binding) {
  const filePath = bindingPath(binding);
  if (!fs.existsSync(filePath)) {
    checks.push({
      name,
      pass: false,
      detail: `${binding.path} is unavailable on this machine`,
    });
    return false;
  }
  validateFileBinding(checks, name, binding);
  return true;
}

function commandArg(command, flag) {
  const index = command.indexOf(flag);
  return index === -1 ? null : command[index + 1];
}

function commandArgs(command, flag) {
  const values = [];
  for (let index = 0; index < command.length; index += 1) {
    if (command[index] === flag) values.push(command[index + 1]);
  }
  return values;
}

function sourceCommitAudit(source) {
  const result = spawnSync('git', ['show', '-s', '--format=%T', source.launchCommit], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    return {
      available: false,
      reason: 'launch commit object is unavailable in this checkout (expected in shallow CI checkouts)',
    };
  }
  const observedTree = result.stdout.trim();
  if (observedTree !== source.launchTree) {
    throw new Error(`source-launch-tree: expected ${source.launchTree}, observed ${observedTree}`);
  }
  return { available: true, observedTree };
}

function formatMarkdown(report) {
  return `${[
    '# Resistant Profile Study GO Request',
    '',
    `Status: **${report.status}**`,
    `Request SHA-256: \`${report.requestSha256}\``,
    `Launch commit: \`${report.launchCommit}\``,
    `Ready for explicit human approval: **${report.readyForExplicitHumanApproval ? 'yes' : 'no'}**`,
    `Live run authorized: **${report.liveRunAuthorized ? 'yes' : 'no'}**`,
    `Model calls made by this check: **${report.modelCalls}**`,
    `Production writes made by this check: **${report.productionWrites}**`,
    '',
    'Exact approval statement:',
    '',
    `> ${report.exactApprovalStatement}`,
    '',
    'This validator does not execute the live command.',
    '',
  ].join('\n')}\n`;
}

export function validateTutorStubResistantProfileStudyGoRequest({ requestPath = DEFAULT_REQUEST } = {}) {
  const request = readJson(requestPath);
  const checks = [];

  assertion(
    checks,
    'request-schema',
    request.schema === 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request.v1',
    request.schema,
  );
  assertion(
    checks,
    'request-hold-status',
    request.status === 'HOLD_PENDING_EXPLICIT_HUMAN_APPROVAL',
    'the request cannot authorize execution',
  );
  assertion(
    checks,
    'authorization-absent',
    request.authorization.explicitHumanApproval === null &&
      request.authorization.modelCallsAuthorized === false &&
      request.authorization.liveRunAuthorized === false,
    'no human approval, model call, or live run is encoded',
  );
  assertion(
    checks,
    'source-pin-shape',
    /^[0-9a-f]{40}$/u.test(request.source.launchCommit) && /^[0-9a-f]{40}$/u.test(request.source.launchTree),
    `launch source is ${request.source.launchCommit} / ${request.source.launchTree}`,
  );

  const sourceAudit = sourceCommitAudit(request.source);
  for (const entry of request.source.closure) {
    validateFileBinding(checks, `source-closure-${entry.path}`, entry);
  }
  checks.push({
    name: 'source-commit-object',
    pass: true,
    detail: sourceAudit.available ? `launch tree verified as ${sourceAudit.observedTree}` : sourceAudit.reason,
  });

  validateFileBinding(checks, 'registration-binding', request.bindings.registration);
  validateFileBinding(checks, 'readiness-hold-binding', request.bindings.liveReadinessHold);

  const hold = readJson(rootPath(request.bindings.liveReadinessHold.path));
  const readiness = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/check-tutor-stub-resistant-profile-live-readiness.js',
        '--hold',
        request.bindings.liveReadinessHold.path,
        '--json',
      ],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ),
  );
  assertion(
    checks,
    'live-readiness',
    readiness.packetValid === true &&
      readiness.routeVerificationPassed === true &&
      readiness.readyForStudyGoPreparation === true &&
      readiness.modelCalls === 0 &&
      readiness.productionWrites === 0,
    'the full readiness packet and consumed route canary remain valid with zero new calls and writes',
  );

  const endpoint = request.bindings.endpoint;
  assertion(
    checks,
    'endpoint-contract-file-binding',
    sha256File(rootPath(endpoint.contractPath)) === endpoint.contractFileSha256 &&
      endpoint.contractCanonicalSha256 === hold.endpoint.contractSha256,
    'the endpoint contract file and canonical runtime binding remain pinned',
  );
  assertion(
    checks,
    'endpoint-certificate-file-binding',
    sha256File(rootPath(endpoint.certificatePath)) === endpoint.certificateFileSha256 &&
      endpoint.preflightSha256 === hold.endpoint.preflightSha256,
    'the endpoint certificate and full-scale preflight remain pinned',
  );

  const route = request.bindings.routeCanary;
  const routeResult = readJson(rootPath(route.resultPath));
  assertion(
    checks,
    'route-result-binding',
    sha256File(rootPath(route.resultPath)) === route.resultSha256 &&
      sha256File(rootPath(route.authorizationConsumptionPath)) === route.authorizationConsumptionSha256 &&
      routeResult.status === 'passed' &&
      routeResult.modelCalls === 1 &&
      routeResult.sourceArtifactSha256 === route.sourceArtifactSha256 &&
      routeResult.executionHead === route.executionHead &&
      routeResult.observed.provider === route.observedProvider &&
      routeResult.observed.model === route.observedModel &&
      routeResult.observed.effort === route.observedEffort &&
      routeResult.observed.modelAttestationBasis === route.attestationBasis &&
      routeResult.observed.modelIndependentlyAttested === route.modelIndependentlyAttested,
    'the one consumed Luna route call remains exactly bound and is not independently attested',
  );

  const isReplacement = request.replacement?.type === 'fresh_profile_cohort_replacement';
  const isFreshMeasurementRecheck = request.recheck?.type === 'fresh_full_cohort_measurement_recheck';
  const isTechnicalRecovery =
    request.technicalRecovery?.type === 'fresh_destination_after_pre_model_dependency_failure';
  const isAxisHeldout = request.axisHeldout?.type === 'prospective_resistance_axis_heldout';
  const commandSource = request.bindings.commands.source;
  const liveCommand = commandSource === 'commands' ? request.commands?.live : hold.proposedCommands.live;
  const analyzeCommand = commandSource === 'commands' ? request.commands?.analyze : hold.proposedCommands.analyze;
  assertion(
    checks,
    'command-source',
    (commandSource === 'commands' && (isReplacement || isFreshMeasurementRecheck || isAxisHeldout)) ||
      commandSource === 'bindings.liveReadinessHold.path#proposedCommands',
    `command source is ${commandSource}`,
  );
  assertion(
    checks,
    'live-command-binding',
    Array.isArray(liveCommand) && sha256Json(liveCommand) === request.bindings.commands.liveArraySha256,
    `live command array remains ${request.bindings.commands.liveArraySha256}`,
  );
  assertion(
    checks,
    'analysis-command-binding',
    Array.isArray(analyzeCommand) && sha256Json(analyzeCommand) === request.bindings.commands.analyzeArraySha256,
    `analysis command array remains ${request.bindings.commands.analyzeArraySha256}`,
  );

  let priorArtifactsAvailable = true;
  if (isReplacement) {
    const retained = request.replacement.retainedPriorTraces;
    const excluded = request.replacement.excludedPriorTraces;
    const retainedProfiles = [...new Set(retained.map((entry) => entry.profile))].sort();
    const retainedRunsByProfile = Object.fromEntries(
      retainedProfiles.map((profile) => [
        profile,
        retained
          .filter((entry) => entry.profile === profile)
          .map((entry) => entry.run)
          .sort((left, right) => left - right)
          .join(','),
      ]),
    );
    assertion(
      checks,
      'replacement-design-binding',
      request.design.profiles.join(',') === 'frame_defiant' &&
        request.design.dialogues === 3 &&
        request.design.runsPerProfile === 3 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 3 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 144 &&
        request.budget.retryOrResumeAuthority === 'none',
      'three fresh frame_defiant dialogues and the 144-attempt no-retry ceiling remain frozen',
    );
    assertion(
      checks,
      'replacement-trace-partition',
      retained.length === 15 &&
        excluded.length === 3 &&
        request.replacement.retainedTraceCount === 15 &&
        request.replacement.excludedTraceCount === 3 &&
        request.replacement.freshTraceCount === 3 &&
        request.replacement.finalAnalysisTraceCount === 18 &&
        retainedProfiles.join(',') === 'bored,diligent,low_agency,low_trust_skeptic,skeptical' &&
        Object.values(retainedRunsByProfile).every((runs) => runs === '1,2,3') &&
        excluded.every((entry) => entry.profile === 'frame_defiant') &&
        excluded
          .map((entry) => entry.run)
          .sort((left, right) => left - right)
          .join(',') === '1,2,3' &&
        request.replacement.priorFrameDefiantTracesReused === false &&
        request.replacement.priorDialoguesResumed === false,
      '15 unaffected traces are retained and all three prior frame_defiant traces are excluded',
    );
    validateFileBinding(checks, 'prior-request-binding', {
      path: request.replacement.priorRequestPath,
      sha256: request.replacement.priorRequestSha256,
    });
    for (const [name, binding] of [
      ['prior-run-plan-binding', request.replacement.priorRunPlan],
      ['prior-qa-plan-binding', request.replacement.priorQaPlan],
      ...retained.map((entry) => [`retained-trace-${entry.profile}-r${entry.run}`, entry]),
      ...excluded.map((entry) => [`excluded-trace-${entry.profile}-r${entry.run}`, entry]),
    ]) {
      priorArtifactsAvailable = validateMachineLocalFileBinding(checks, name, binding) && priorArtifactsAvailable;
    }
    assertion(
      checks,
      'replacement-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === 'frame_defiant' &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260818' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh three-dialogue command preserves the frozen runtime configuration',
    );
    const retainedTracePaths = retained.map((entry) => entry.path);
    const analysisTracePaths = commandArgs(analyzeCommand, '--trace');
    assertion(
      checks,
      'replacement-analysis-command-shape',
      analyzeCommand[0] === 'node' &&
        analyzeCommand[1] === 'scripts/analyze-tutor-stub-profile-discrimination.js' &&
        JSON.stringify(analysisTracePaths) === JSON.stringify(retainedTracePaths) &&
        excluded.every((entry) => !analysisTracePaths.includes(entry.path)) &&
        commandArg(analyzeCommand, '--trace-root') === request.destination.artifactRoot &&
        commandArg(analyzeCommand, '--required-traces') === '18' &&
        commandArg(analyzeCommand, '--required-profiles') === request.design.analysisProfiles.join(',') &&
        commandArg(analyzeCommand, '--required-runs-per-profile') === '3' &&
        commandArg(analyzeCommand, '--required-turns') === '8' &&
        commandArg(analyzeCommand, '--required-policies') === 'field' &&
        commandArg(analyzeCommand, '--required-tutor-model') === request.design.models.tutor &&
        commandArg(analyzeCommand, '--required-analysis-model') === request.design.models.analysis &&
        commandArg(analyzeCommand, '--required-learner-model') === request.design.models.learner &&
        analyzeCommand.includes('--require-pooled'),
      'the analysis combines only the 15 pinned prior traces with the fresh sealed root',
    );
  } else if (isAxisHeldout) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const expectedProfiles = 'diligent,low_agency,bored,skeptical,low_trust_skeptic,frame_defiant';
    const analysisShell = analyzeCommand[2] || '';
    assertion(
      checks,
      'axis-heldout-design-binding',
      request.design.profiles.join(',') === expectedProfiles &&
        request.design.dialogues === 18 &&
        request.design.runsPerProfile === 3 &&
        request.design.runSeed === 20260819 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 18 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 864 &&
        request.budget.retryOrResumeAuthority === 'bounded_technical_recovery',
      'six fresh three-run profile cohorts and the 864-attempt bounded-recovery ceiling remain frozen',
    );
    assertion(
      checks,
      'axis-heldout-evidence-boundary',
      request.axisHeldout.priorArtifactsReused === false &&
        request.axisHeldout.priorResultRewritten === false &&
        request.axisHeldout.historicalEvidencePooled === false &&
        request.axisHeldout.calibrationUsedForThresholdDesignOnly === true &&
        request.axisHeldout.registeredNegativeReportSha256 === registered.preservation.registeredNegativeReportSha256,
      'prior traces and negative results remain read-only, unpooled calibration inputs',
    );
    const recovery = request.axisHeldout.recoveryBoundary;
    assertion(
      checks,
      'axis-heldout-bounded-recovery-authority',
      recovery.sameLaunchSource === true &&
        recovery.sameModelProviderRoute === true &&
        recovery.sameProfilesPoliciesSeedConfigurationAndRubric === true &&
        recovery.samePayloadAndDataScope === true &&
        recovery.freshNonOverwritingDestinationForRecoveredUnits === true &&
        recovery.rerunValidOutputs === false &&
        recovery.selectAmongOutcomes === false &&
        recovery.maximumTotalStudyAttemptsUnchanged === 864,
      'technical recovery is limited to missing or failed units under the unchanged design and ceiling',
    );
    assertion(
      checks,
      'axis-heldout-measurement-binding',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.resistance-axis-discrimination.v1' &&
        request.measurement.coPrimaryProfiles.join(',') === 'bored,frame_defiant' &&
        request.measurement.diagnosticProfiles.join(',') === 'low_agency,skeptical,low_trust_skeptic' &&
        request.measurement.epistemicTrustRole === 'descriptive_only_no_threshold_no_pass_contribution' &&
        registered.gates.profiles.bored.axis === 'effort_investment' &&
        registered.gates.profiles.bored.minimumObservedRate === 0.45 &&
        registered.gates.profiles.frame_defiant.axis === 'frame_legitimacy' &&
        registered.gates.profiles.frame_defiant.minimumObservedRate === 0.4 &&
        registered.gates.epistemicTrustRole === 'descriptive_only_no_threshold_no_pass_contribution',
      'bored effort and frame legitimacy are primary while low trust remains descriptive-only',
    );
    assertion(
      checks,
      'axis-heldout-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === expectedProfiles &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260819' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh 18-dialogue command preserves the registered axis-study runtime',
    );
    assertion(
      checks,
      'axis-heldout-analysis-command-shape',
      analyzeCommand.length === 3 &&
        analyzeCommand[0] === 'zsh' &&
        analyzeCommand[1] === '-lc' &&
        analysisShell.includes('/*/traces/*/*.jsonl') &&
        analysisShell.includes('trace_args+=(--trace "$trace")') &&
        analysisShell.includes('scripts/analyze-tutor-stub-resistance-axis-calibration.js') &&
        analysisShell.includes('--registration config/tutor-stub-resistance-axis-heldout-registration.v1.json') &&
        analysisShell.includes('--required-traces 18') &&
        analysisShell.includes(`--required-profiles ${expectedProfiles}`) &&
        analysisShell.includes('--required-runs-per-profile 3') &&
        analysisShell.includes('--required-turns 8') &&
        analysisShell.includes('--required-policies field') &&
        analysisShell.includes(`--required-tutor-model ${request.design.models.tutor}`) &&
        analysisShell.includes(`--required-analysis-model ${request.design.models.analysis}`) &&
        analysisShell.includes(`--required-learner-model ${request.design.models.learner}`) &&
        !analysisShell.includes('--require-pooled') &&
        !analysisShell.includes('target-average-cosine') &&
        !analysisShell.includes('nearest-neighbor') &&
        analysisShell.includes(`--out "$artifact_root/resistance-axis-discrimination.json"`),
      'the analysis selects exact dialogue traces and excludes the failed pooled and nearest-neighbour geometry',
    );
  } else if (isFreshMeasurementRecheck) {
    const registered = readJson(rootPath(request.bindings.registration.path));
    const expectedProfiles = 'diligent,low_agency,bored,skeptical,low_trust_skeptic,frame_defiant';
    const analysisShell = analyzeCommand[2] || '';
    const retryBoundaryValid = isTechnicalRecovery
      ? request.budget.retryOrResumeAuthority === 'bounded_technical_recovery'
      : request.budget.retryOrResumeAuthority === 'none';
    assertion(
      checks,
      'measurement-recheck-design-binding',
      request.design.profiles.join(',') === expectedProfiles &&
        request.design.dialogues === 18 &&
        request.design.runsPerProfile === 3 &&
        request.design.parallelism === 3 &&
        request.budget.dialogues === 18 &&
        request.budget.maximumAttemptsPerDialogue === 48 &&
        request.budget.maximumPlannedModelAttempts === 864 &&
        retryBoundaryValid,
      isTechnicalRecovery
        ? 'six fresh three-run profile cohorts and the 864-attempt bounded-recovery ceiling remain frozen'
        : 'six fresh three-run profile cohorts and the 864-attempt no-retry ceiling remain frozen',
    );
    assertion(
      checks,
      'measurement-recheck-boundary',
      request.recheck.priorArtifactsReused === false &&
        request.recheck.priorDialoguesResumed === false &&
        request.recheck.priorResultRewritten === false &&
        request.recheck.thresholdsChanged === false &&
        request.recheck.prospectiveExactTraceReplay.modelCalls === 0,
      'the new cohort neither reuses old traces nor rewrites the registered negative result or thresholds',
    );
    if (isTechnicalRecovery) {
      validateFileBinding(checks, 'measurement-recheck-recovery-prior-request-binding', {
        path: request.technicalRecovery.priorRequestPath,
        sha256: request.technicalRecovery.priorRequestSha256,
      });
      const dependency = request.technicalRecovery.dependencyPreparation;
      const excluded = request.technicalRecovery.excludedUnplannedSmoke;
      const recovery = request.technicalRecovery.recoveryBoundary;
      const sourceClosure = Object.fromEntries(request.source.closure.map((entry) => [entry.path, entry.sha256]));
      assertion(
        checks,
        'measurement-recheck-technical-recovery-basis',
        request.technicalRecovery.priorInvocation.outcome === 'technical_failure_before_model_call' &&
          request.technicalRecovery.priorInvocation.errorCode === 'ERR_MODULE_NOT_FOUND' &&
          request.technicalRecovery.priorInvocation.missingPackage === 'yaml' &&
          request.technicalRecovery.priorInvocation.completedModelCalls === 0 &&
          request.technicalRecovery.priorInvocation.reservedModelCalls === 0 &&
          request.technicalRecovery.priorInvocation.artifactDestinationCreated === false &&
          request.technicalRecovery.priorInvocation.reused === false &&
          request.technicalRecovery.priorInvocation.resumed === false,
        'the consumed request failed before any model call or requested artifact creation',
      );
      assertion(
        checks,
        'measurement-recheck-dependency-preparation',
        dependency.packageJsonSha256 === sourceClosure['package.json'] &&
          dependency.packageLockSha256 === sourceClosure['package-lock.json'] &&
          dependency.installedYamlVersion === '2.9.0' &&
          dependency.modelCalls === 0 &&
          dependency.productionWrites === 0,
        'the compatible dependency tree and safe zero-call module-load check are source-bound',
      );
      assertion(
        checks,
        'measurement-recheck-excluded-unplanned-smoke',
        excluded.profile === 'diligent' &&
          excluded.policies.join(',') === 'bland,dynamic,state,field,trajectory,dynamical_system' &&
          excluded.runSeed === 20260711 &&
          excluded.completedModelCalls === 29 &&
          excluded.interruptedReservations === 6 &&
          excluded.completedTrials === 0 &&
          excluded.artifactPreserved === true &&
          excluded.reused === false &&
          excluded.resumed === false &&
          excluded.analyzed === false &&
          excluded.eligibleForStudyAssembly === false,
        'the unplanned default-run artifacts are preserved but excluded from recovery and study assembly',
      );
      assertion(
        checks,
        'measurement-recheck-bounded-recovery-authority',
        recovery.sameLaunchSource === true &&
          recovery.sameModelProviderRoute === true &&
          recovery.sameProfilesPoliciesSeedConfigurationAndRubric === true &&
          recovery.samePayloadAndDataScope === true &&
          recovery.freshNonOverwritingDestination === true &&
          recovery.rerunValidOutputs === false &&
          recovery.selectAmongOutcomes === false &&
          recovery.maximumTotalStudyAttemptsUnchanged === 864,
        'technical recovery is limited to missing or failed units under the unchanged design and ceiling',
      );
    }
    validateFileBinding(checks, 'measurement-recheck-prior-request-binding', {
      path: request.recheck.priorRequestPath,
      sha256: request.recheck.priorRequestSha256,
    });
    const priorReport = request.recheck.priorCanonicalReport;
    if (fs.existsSync(bindingPath(priorReport))) {
      validateFileBinding(checks, 'measurement-recheck-prior-report-binding', priorReport);
    } else {
      assertion(
        checks,
        'measurement-recheck-prior-report-digest',
        /^[0-9a-f]{64}$/u.test(priorReport.sha256) && priorReport.result === 'failed_registered_co_primary_gate',
        'the machine-local canonical report is unavailable here; its negative result and digest remain frozen',
      );
    }
    assertion(
      checks,
      'measurement-recheck-instrument',
      request.measurement.reportSchema === 'machinespirits.tutor-stub.profile-discrimination.v4' &&
        request.measurement.behaviorVectorMarkers.join(',') ===
          'explicitRecollection,learnerAcceleration,boredWithholding,frameJurisdictionDispute' &&
        request.measurement.nearestNeighborAnchorMinimumSignatureTargetPassRate === 0.4 &&
        registered.gates.profiles.bored.minimumSignatureTargetPassRate === 0.4 &&
        registered.gates.profiles.frame_defiant.minimumSignatureTargetPassRate === 0.4 &&
        request.measurement.analysisTraceSelection === 'exact_profile_trace_files_only' &&
        request.measurement.analysisSelectorExcludesRunEvents === true,
      'analyzer v4, both resistant markers, and the unchanged 0.40 anchor floor remain explicit',
    );
    assertion(
      checks,
      'measurement-recheck-live-command-shape',
      liveCommand[0] === 'node' &&
        liveCommand[1] === 'scripts/run-tutor-stub-qa-matrix.js' &&
        commandArg(liveCommand, '--profiles') === expectedProfiles &&
        commandArg(liveCommand, '--policies') === 'field' &&
        commandArg(liveCommand, '--runs') === '3' &&
        commandArg(liveCommand, '--run-seed') === '20260818' &&
        commandArg(liveCommand, '--turns') === '8' &&
        commandArg(liveCommand, '--safety-turns') === '8' &&
        commandArg(liveCommand, '--model-call-budget') === '48' &&
        commandArg(liveCommand, '--model') === request.design.models.tutor &&
        commandArg(liveCommand, '--analysis-model') === request.design.models.analysis &&
        commandArg(liveCommand, '--auto-learner-model') === request.design.models.learner &&
        commandArg(liveCommand, '--world') === request.design.world &&
        commandArg(liveCommand, '--dag-mode') === 'strict_dag' &&
        commandArg(liveCommand, '--register-palette') === 'safe' &&
        commandArg(liveCommand, '--register-overlay-threshold') === '0.7' &&
        commandArg(liveCommand, '--release-speed') === '1' &&
        commandArg(liveCommand, '--cli-effort') === request.design.cliEffort &&
        commandArg(liveCommand, '--history-turns') === '4' &&
        commandArg(liveCommand, '--max-tokens') === '4096' &&
        commandArg(liveCommand, '--parallelism') === '3' &&
        commandArg(liveCommand, '--trace-dir') === request.destination.artifactRoot &&
        liveCommand.includes('--no-html-report') &&
        liveCommand.includes('--no-memory-summary') &&
        liveCommand.includes('--no-analyze') &&
        !liveCommand.includes('--keep-going'),
      'the fresh 18-dialogue command preserves the frozen runtime configuration',
    );
    assertion(
      checks,
      'measurement-recheck-analysis-command-shape',
      analyzeCommand.length === 3 &&
        analyzeCommand[0] === 'zsh' &&
        analyzeCommand[1] === '-lc' &&
        analysisShell.includes('/*/traces/*/*.jsonl') &&
        analysisShell.includes('trace_args+=(--trace "$trace")') &&
        !analysisShell.includes('--trace-root') &&
        analysisShell.includes('--required-traces 18') &&
        analysisShell.includes(`--required-profiles ${expectedProfiles}`) &&
        analysisShell.includes('--required-runs-per-profile 3') &&
        analysisShell.includes('--required-turns 8') &&
        analysisShell.includes('--required-policies field') &&
        analysisShell.includes(`--required-tutor-model ${request.design.models.tutor}`) &&
        analysisShell.includes(`--required-analysis-model ${request.design.models.analysis}`) &&
        analysisShell.includes(`--required-learner-model ${request.design.models.learner}`) &&
        analysisShell.includes('--require-pooled') &&
        analysisShell.includes(`--out "$artifact_root/profile-discrimination.json"`),
      'the analysis selects only exact dialogue traces and retains every registered assembly gate',
    );
  } else {
    assertion(
      checks,
      'design-binding',
      request.design.dialogues === hold.budget.dialogues &&
        request.design.parallelism === hold.budget.parallelism &&
        request.budget.maximumAttemptsPerDialogue === hold.budget.maximumAttemptsPerDialogue &&
        request.budget.maximumPlannedModelAttempts === hold.budget.maximumPlannedModelAttempts &&
        request.budget.retryOrResumeAuthority === 'none',
      '18 dialogues, parallelism 3, and the 864-attempt no-retry ceiling remain frozen',
    );
  }
  assertion(
    checks,
    'payload-boundary',
    request.payload.humanSubjectData === false &&
      request.payload.privateArchiveData === false &&
      request.payload.trainingReuseStatus === 'not_applicable',
    'only repository-authored automated-study material is in scope',
  );
  assertion(
    checks,
    'fresh-destination',
    request.destination.createOnce === true &&
      request.destination.mustNotExistBeforeLaunch === true &&
      !fs.existsSync(rootPath(request.destination.artifactRoot)),
    `${request.destination.artifactRoot} does not exist`,
  );

  const requestSha256 = sha256File(requestPath);
  const recoveryAuthorityClause =
    isTechnicalRecovery || request.budget.retryOrResumeAuthority === 'bounded_technical_recovery'
      ? 'bounded technical recovery authority for missing or failed units only.'
      : 'no retry or resume authority.';
  const exactApprovalStatement =
    `I approve ${path.relative(ROOT, requestPath)} at SHA-256 ${requestSha256} for one ` +
    `${request.design.dialogues}-dialogue Luna ${isReplacement ? 'replacement study' : 'study'}, ` +
    `with a hard ceiling of ${request.budget.maximumPlannedModelAttempts} model attempts and ${recoveryAuthorityClause}`;

  return {
    schema: 'machinespirits.tutor-stub.resistant-profile-discrimination-study-go-request-report.v1',
    status: request.status,
    requestPath: path.relative(ROOT, requestPath),
    requestSha256,
    launchCommit: request.source.launchCommit,
    launchTree: request.source.launchTree,
    sourceCommitObjectAvailable: sourceAudit.available,
    packetValid: true,
    readyForExplicitHumanApproval: !isReplacement || priorArtifactsAvailable,
    priorArtifactsAvailable,
    explicitHumanApproval: false,
    modelCallsAuthorized: false,
    liveRunAuthorized: false,
    modelCalls: 0,
    productionWrites: 0,
    budget: request.budget,
    destination: request.destination,
    exactApprovalStatement,
    checks,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = validateTutorStubResistantProfileStudyGoRequest({ requestPath: args.request });
  process.stdout.write(args.json ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
