#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RESISTANT_LEARNER_AXIS_DEFINITIONS,
  resistantLearnerAxisMarkers,
} from '../services/resistantLearnerAxisObservation.js';
import { observeResistantLearnerTurn } from '../services/resistantLearnerObservation.js';
import { extractTutorStubResistanceActionRegisterPrefix } from '../services/tutorStubResistanceActionRegisterStudy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RESISTANT_PROFILE_AXIS_SIGNATURES = Object.freeze({
  bored: Object.freeze({
    expectedObservedAxes: Object.freeze(['effort_investment']),
    expectedAbsentAxes: Object.freeze(['learner_authorship', 'frame_legitimacy']),
  }),
  low_agency: Object.freeze({
    expectedObservedAxes: Object.freeze(['learner_authorship']),
    expectedAbsentAxes: Object.freeze(['effort_investment', 'frame_legitimacy']),
  }),
  skeptical: Object.freeze({
    expectedObservedAxes: Object.freeze(['evidential_orientation']),
    expectedAbsentAxes: Object.freeze(['epistemic_trust', 'frame_legitimacy']),
  }),
  low_trust_skeptic: Object.freeze({
    expectedObservedAxes: Object.freeze(['evidential_orientation', 'epistemic_trust']),
    expectedAbsentAxes: Object.freeze(['frame_legitimacy']),
  }),
  frame_defiant: Object.freeze({
    expectedObservedAxes: Object.freeze(['frame_legitimacy']),
    expectedAbsentAxes: Object.freeze(['learner_authorship']),
  }),
});

function csv(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseArgs(argv) {
  const args = {
    traces: [],
    out: '',
    registration: '',
    registeredReport: '',
    requiredRegisteredReportSha256: '',
    requiredTraces: null,
    requiredProfiles: [],
    requiredRunsPerProfile: null,
    requiredTurns: null,
    requiredPolicies: [],
    requiredModels: { tutor: '', analysis: '', learner: '' },
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') continue;
    if (token === '--trace') args.traces.push(path.resolve(argv[++index] || ''));
    else if (token === '--out') args.out = path.resolve(argv[++index] || '');
    else if (token === '--registration') args.registration = path.resolve(argv[++index] || '');
    else if (token === '--registered-report') args.registeredReport = path.resolve(argv[++index] || '');
    else if (token === '--required-registered-report-sha256') {
      args.requiredRegisteredReportSha256 = String(argv[++index] || '')
        .trim()
        .toLowerCase();
    } else if (token === '--required-traces') args.requiredTraces = positiveInteger(argv[++index], token);
    else if (token === '--required-profiles') args.requiredProfiles = csv(argv[++index]);
    else if (token === '--required-runs-per-profile') {
      args.requiredRunsPerProfile = positiveInteger(argv[++index], token);
    } else if (token === '--required-turns') args.requiredTurns = positiveInteger(argv[++index], token);
    else if (token === '--required-policies') args.requiredPolicies = csv(argv[++index]);
    else if (token === '--required-tutor-model') args.requiredModels.tutor = String(argv[++index] || '').trim();
    else if (token === '--required-analysis-model') {
      args.requiredModels.analysis = String(argv[++index] || '').trim();
    } else if (token === '--required-learner-model') {
      args.requiredModels.learner = String(argv[++index] || '').trim();
    } else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/analyze-tutor-stub-resistance-axis-calibration.js --trace <file>... [options]

Options:
  --registration <file>                       Freeze a prospective held-out axis gate
  --registered-report <file>                 Bind calibration to an immutable registered report
  --required-registered-report-sha256 <hex>  Require the registered report's exact SHA-256
  --required-traces <n>
  --required-profiles <csv>
  --required-runs-per-profile <n>
  --required-turns <n>
  --required-policies <csv>
  --required-tutor-model <id>
  --required-analysis-model <id>
  --required-learner-model <id>
  --json                                     Emit JSON (the only output format)
  --out <file>                               Write JSON to a file
`);
      process.exit(0);
    } else if (token.startsWith('--')) throw new Error(`Unknown option: ${token}`);
    else args.traces.push(path.resolve(token));
  }
  if (!args.traces.length) throw new Error('At least one --trace is required');
  if (args.requiredRegisteredReportSha256 && !args.registeredReport) {
    throw new Error('--required-registered-report-sha256 requires --registered-report');
  }
  return args;
}

function readJsonl(file) {
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return [];
  return text.split(/\r?\n/u).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON: ${error.message}`);
    }
  });
}

function inferProfile(file, metadata) {
  const profile = metadata.autoLearner?.profileId || metadata.autoLearnerProfileId || metadata.profileId;
  if (profile) return String(profile);
  const parts = file.split(path.sep);
  const tracesIndex = parts.lastIndexOf('traces');
  return tracesIndex > 0 ? parts[tracesIndex - 1] : 'unknown';
}

function inferPolicy(file, firstTurn) {
  if (firstTurn?.registerSelection?.policy) return String(firstTurn.registerSelection.policy);
  const parent = path.basename(path.dirname(file));
  const match = parent.match(/^(.+)-r\d+$/u);
  return match ? match[1] : parent;
}

export function readTutorStubResistanceAxisTrace(file) {
  const events = readJsonl(file);
  const start = events.find((event) => event.type === 'run_start') || {};
  const metadata = start.metadata || {};
  const opening = events.find((event) => event.type === 'tutor_opening')?.text || '';
  const turns = events
    .filter((event) => event.type === 'turn_complete' && event.turnRecord)
    .map((event) => event.turnRecord)
    .sort((left, right) => Number(left.turn || 0) - Number(right.turn || 0));
  return {
    caseId: start.runId || metadata.runId || null,
    file,
    profile: inferProfile(file, metadata),
    policy: inferPolicy(file, turns[0]),
    models: {
      tutor: metadata.modelRef || null,
      analysis: metadata.classifier?.modelRef || null,
      learner: metadata.autoLearner?.modelRef || null,
    },
    turns: turns.map((turn, index) => {
      const observationInput = {
        learnerText: turn.learner,
        classification: turn.classification?.turn || {},
        tutorText: index === 0 ? opening : turns[index - 1]?.tutor || '',
      };
      return {
        turn: Number(turn.turn),
        learnerText: turn.learner || '',
        classification: turn.classification || null,
        markers: resistantLearnerAxisMarkers(observationInput),
        publicObservation: observeResistantLearnerTurn(observationInput),
      };
    }),
  };
}

function round(value) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null;
}

function sameSet(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function countBy(rows, selector) {
  const counts = {};
  for (const row of rows) {
    const value = selector(row);
    counts[value] = (counts[value] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0])));
}

function reportPath(file) {
  return path.isAbsolute(file) ? path.relative(ROOT, file) : file;
}

function modelCheck(role, traces, requiredModel) {
  const observed = countBy(traces, (trace) => trace.models[role] || 'unknown');
  return {
    role,
    requiredModel: requiredModel || null,
    observed,
    pass: requiredModel ? Object.keys(observed).length === 1 && observed[requiredModel] === traces.length : true,
  };
}

function registrationResult(registrationPath) {
  if (!registrationPath) return null;
  const bytes = fs.readFileSync(registrationPath);
  const registration = JSON.parse(bytes.toString('utf8'));
  if (
    ![
      'machinespirits.tutor-stub.resistance-axis-discrimination-registration.v1',
      'machinespirits.tutor-stub.frame-refuser-opportunity-registration.v1',
    ].includes(registration.schema)
  ) {
    throw new Error(`unsupported registration schema: ${registration.schema}`);
  }
  return {
    path: path.relative(ROOT, registrationPath),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    registration,
  };
}

function hasObservation(turn, type, predicate = () => true) {
  return Boolean(turn?.publicObservation?.observations?.some((row) => row.type === type && predicate(row)));
}

function frameRefuserPrefix(trace, mustShowByTurn) {
  try {
    const prefix = extractTutorStubResistanceActionRegisterPrefix({
      tracePath: trace.file,
      profile: 'frame_refuser',
      requireFrozenBundle: false,
    });
    return {
      pass: prefix.trigger_turn <= mustShowByTurn,
      triggerTurn: prefix.trigger_turn,
      publicPrefixSha256: prefix.public_prefix_sha256,
      sourceTraceSha256: prefix.source_trace_sha256,
      reason: prefix.trigger_turn <= mustShowByTurn ? 'eligible_refusal_prefix' : 'eligible_prefix_after_deadline',
    };
  } catch (error) {
    return {
      pass: false,
      triggerTurn: null,
      publicPrefixSha256: null,
      sourceTraceSha256: null,
      reason: error.message,
    };
  }
}

export function buildFrameRefuserOpportunityReport(traces, args, registrationBinding) {
  const calibration = buildResistanceAxisCalibrationReport(traces, args);
  const registration = registrationBinding.registration;
  const targetProfile = registration.gates.targetProfile;
  const controlProfile = registration.gates.controlProfile;
  const mustShowByTurn = registration.gates.mustShowByTurn;
  const targetRows = traces
    .filter((trace) => trace.profile === targetProfile)
    .map((trace) => {
      const refusalByDeadline = trace.turns.some(
        (turn) => turn.turn <= mustShowByTurn && hasObservation(turn, 'frame_jurisdiction_refusal'),
      );
      const prefix = frameRefuserPrefix(trace, mustShowByTurn);
      return {
        caseId: trace.caseId,
        trace: reportPath(trace.file),
        refusalByDeadline,
        eligiblePrefix: prefix,
        protectedAndUptakeGuardPass: prefix.pass,
        pass: refusalByDeadline && prefix.pass,
      };
    });
  const controlRows = traces
    .filter((trace) => trace.profile === controlProfile)
    .map((trace) => {
      const productiveDisputeByDeadline = trace.turns.some(
        (turn) =>
          turn.turn <= mustShowByTurn &&
          hasObservation(turn, 'frame_jurisdiction_dispute', (row) => row.features?.content_bearing === true) &&
          !hasObservation(turn, 'frame_jurisdiction_refusal'),
      );
      const refusalLeakage = trace.turns.some((turn) => hasObservation(turn, 'frame_jurisdiction_refusal'));
      return {
        caseId: trace.caseId,
        trace: reportPath(trace.file),
        productiveDisputeByDeadline,
        refusalLeakage,
        pass: productiveDisputeByDeadline && !refusalLeakage,
      };
    });
  const prefixHashes = targetRows.map((row) => row.eligiblePrefix.publicPrefixSha256).filter(Boolean);
  const distinctPrefixes = {
    required: registration.gates.requiredDistinctTargetPrefixes,
    observed: new Set(prefixHashes).size,
    hashes: prefixHashes,
    pass:
      prefixHashes.length === targetRows.length &&
      new Set(prefixHashes).size >= registration.gates.requiredDistinctTargetPrefixes,
  };
  const assemblyPass = calibration.integrity.assembly.pass;
  const pass =
    assemblyPass &&
    targetRows.length > 0 &&
    targetRows.every((row) => row.pass) &&
    controlRows.length > 0 &&
    controlRows.every((row) => row.pass) &&
    distinctPrefixes.pass;
  return {
    ...calibration,
    schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-gate.v1',
    authority: 'prospective_instrument_opportunity_gate',
    pass,
    registration: {
      path: registrationBinding.path,
      sha256: registrationBinding.sha256,
      decisionRule: registration.gates.decisionRule,
    },
    changesRegisteredResult: false,
    priorRegisteredResultRewritten: false,
    gate: {
      mode: 'frame_refuser_opportunity_with_productive_frame_defiant_control',
      assembly: calibration.integrity.assembly,
      targetProfile,
      controlProfile,
      mustShowByTurn,
      target: targetRows,
      control: controlRows,
      distinctPrefixes,
      tutorEfficacyTested: false,
      registerEfficacyTested: false,
      pass,
    },
  };
}

function registeredResult(args) {
  if (!args.registeredReport) return null;
  const bytes = fs.readFileSync(args.registeredReport);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const report = JSON.parse(bytes.toString('utf8'));
  return {
    path: path.relative(ROOT, args.registeredReport),
    schema: report.schema || null,
    sha256,
    requiredSha256: args.requiredRegisteredReportSha256 || null,
    unchanged: args.requiredRegisteredReportSha256 ? sha256 === args.requiredRegisteredReportSha256 : true,
    registeredGatePass: report.gate?.pass ?? null,
  };
}

export function buildResistanceAxisCalibrationReport(traces, args) {
  const profiles = [...new Set(traces.map((trace) => trace.profile))].sort();
  const policies = [...new Set(traces.map((trace) => trace.policy))].sort();
  const runsPerProfile = countBy(traces, (trace) => trace.profile);
  const models = Object.keys(args.requiredModels).map((role) => modelCheck(role, traces, args.requiredModels[role]));
  const assemblyChecks = {
    traceCount: args.requiredTraces == null || traces.length === args.requiredTraces,
    profileSet: !args.requiredProfiles.length || sameSet(profiles, args.requiredProfiles),
    runsPerProfile:
      args.requiredRunsPerProfile == null ||
      profiles.every((profile) => runsPerProfile[profile] === args.requiredRunsPerProfile),
    turns: args.requiredTurns == null || traces.every((trace) => trace.turns.length === args.requiredTurns),
    policySet: !args.requiredPolicies.length || sameSet(policies, args.requiredPolicies),
    models: models.every((model) => model.pass),
  };
  const registered = registeredResult(args);
  const profileSummaries = profiles.map((profile) => {
    const profileTurns = traces.filter((trace) => trace.profile === profile).flatMap((trace) => trace.turns);
    const axes = Object.fromEntries(
      RESISTANT_LEARNER_AXIS_DEFINITIONS.map((definition) => {
        const observedTurns = profileTurns.filter((turn) => turn.markers[definition.marker]).length;
        return [
          definition.axis,
          {
            marker: definition.marker,
            observedState: definition.observedState,
            eligibleTurns: profileTurns.length,
            observedTurns,
            observedRate: round(observedTurns / profileTurns.length),
          },
        ];
      }),
    );
    return { profile, traces: runsPerProfile[profile], turns: profileTurns.length, axes };
  });
  const profileSignatures = Object.entries(RESISTANT_PROFILE_AXIS_SIGNATURES).map(([profile, signature]) => {
    const summary = profileSummaries.find((row) => row.profile === profile) || null;
    const rates = (axisNames) =>
      axisNames.map((axis) => ({ axis, observedRate: summary?.axes?.[axis]?.observedRate ?? null }));
    const expectedObserved = rates(signature.expectedObservedAxes);
    const expectedAbsent = rates(signature.expectedAbsentAxes);
    return {
      profile,
      expectedObserved,
      expectedAbsent,
      evaluable: [...expectedObserved, ...expectedAbsent].every((axis) => Number.isFinite(axis.observedRate)),
    };
  });
  const assemblyPass = Object.values(assemblyChecks).every(Boolean);
  return {
    schema: 'machinespirits.tutor-stub.resistance-axis-calibration.v1',
    generatedAt: new Date().toISOString(),
    authority: 'calibration_only',
    changesRegisteredResult: false,
    pass: null,
    input: {
      traces: traces.map((trace) => reportPath(trace.file)),
      axisDefinitions: RESISTANT_LEARNER_AXIS_DEFINITIONS,
    },
    integrity: {
      pass: assemblyPass && (registered?.unchanged ?? true),
      registeredResult: registered,
      assembly: {
        pass: assemblyPass,
        checks: assemblyChecks,
        observedTraces: traces.length,
        observedProfiles: profiles,
        observedRunsPerProfile: runsPerProfile,
        observedPolicies: policies,
        models,
      },
    },
    profiles: profileSummaries,
    profileSignatures,
  };
}

function rateForProfileAxis(profileSummaries, profile, axis) {
  return profileSummaries.find((row) => row.profile === profile)?.axes?.[axis]?.observedRate ?? null;
}

export function buildResistanceAxisDiscriminationReport(traces, args, registrationBinding) {
  const calibration = buildResistanceAxisCalibrationReport(traces, args);
  const registration = registrationBinding.registration;
  const coPrimary = registration.gates.coPrimaryProfiles.map((profile) => {
    const gate = registration.gates.profiles[profile];
    const observedRate = rateForProfileAxis(calibration.profiles, profile, gate.axis);
    const targetTraces = traces.filter((trace) => trace.profile === profile);
    const deadlinePass =
      targetTraces.length > 0 &&
      targetTraces.every((trace) =>
        trace.turns.some((turn) => turn.turn <= gate.mustShowByTurn && turn.markers[gate.marker] === true),
      );
    const nonTargetRates = calibration.profiles
      .filter((row) => row.profile !== profile)
      .map((row) => ({ profile: row.profile, observedRate: row.axes[gate.axis].observedRate }));
    const maximumNonTargetRate = nonTargetRates.length
      ? Math.max(...nonTargetRates.map((row) => row.observedRate))
      : null;
    const ratePass = Number.isFinite(observedRate) && observedRate >= gate.minimumObservedRate;
    const specificityPass = Number.isFinite(maximumNonTargetRate) && maximumNonTargetRate <= gate.maximumNonTargetRate;
    return {
      profile,
      role: 'co_primary',
      axis: gate.axis,
      marker: gate.marker,
      observedRate,
      minimumObservedRate: gate.minimumObservedRate,
      ratePass,
      mustShowByTurn: gate.mustShowByTurn,
      deadlinePass,
      maximumNonTargetRate,
      maximumAllowedNonTargetRate: gate.maximumNonTargetRate,
      nonTargetRates,
      specificityPass,
      pass: ratePass && deadlinePass && specificityPass,
    };
  });
  const diagnostics = registration.gates.diagnosticProfiles.map((profile) => ({
    profile,
    role: 'diagnostic_control',
    axes: Object.fromEntries(
      registration.gates.diagnosticAxes.map((axis) => [axis, rateForProfileAxis(calibration.profiles, profile, axis)]),
    ),
    contributesToPass: false,
  }));
  const assemblyPass = calibration.integrity.assembly.pass;
  const pass = assemblyPass && coPrimary.every((row) => row.pass);
  return {
    ...calibration,
    schema: 'machinespirits.tutor-stub.resistance-axis-discrimination.v1',
    authority: 'prospective_registered_endpoint',
    pass,
    registration: {
      path: registrationBinding.path,
      sha256: registrationBinding.sha256,
      decisionRule: registration.gates.decisionRule,
    },
    changesRegisteredResult: false,
    priorRegisteredResultRewritten: false,
    gate: {
      mode: 'co_primary_axes_with_diagnostic_controls',
      assembly: calibration.integrity.assembly,
      coPrimary,
      diagnostics,
      epistemicTrustContributesToPass: false,
      pass,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const traces = args.traces.map(readTutorStubResistanceAxisTrace);
  const binding = registrationResult(args.registration);
  const report =
    binding?.registration?.schema === 'machinespirits.tutor-stub.frame-refuser-opportunity-registration.v1'
      ? buildFrameRefuserOpportunityReport(traces, args, binding)
      : binding
        ? buildResistanceAxisDiscriminationReport(traces, args, binding)
        : buildResistanceAxisCalibrationReport(traces, args);
  if (!report.integrity.pass) throw new Error('calibration integrity checks failed');
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, output);
  } else process.stdout.write(output);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(1);
  }
}
