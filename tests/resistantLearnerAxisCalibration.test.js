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
import {
  assembleTutorStubFrameRefuserOpportunityPreflight,
  assembleTutorStubResistanceAxisPreflight,
  buildTutorStubFrameRefuserOpportunityPreflightPackets,
  buildTutorStubFrameRefuserOpportunitySyntheticCorpus,
  buildTutorStubResistanceAxisPreflightPackets,
  buildTutorStubResistanceAxisSyntheticCorpus,
  runTutorStubFrameRefuserOpportunityEndpointPreflight,
  runTutorStubResistanceAxisEndpointPreflight,
} from '../services/tutorStubResistanceAxisDiscriminationPreflight.js';
import { validatePaidStudyEndpointGoCertificate } from '../services/paidStudyEndpointPreflight.js';
import {
  buildFrameRefuserOpportunityReport,
  readTutorStubResistanceAxisTrace,
} from '../scripts/analyze-tutor-stub-resistance-axis-calibration.js';

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

test('registered held-out endpoint gates bored and frame axes while low trust stays diagnostic-only', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-resistance-axis-heldout.json'), 'utf8'),
  );
  const certificate = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-resistance-axis-heldout.endpoint-go.json'),
      'utf8',
    ),
  );
  const preflight = runTutorStubResistanceAxisEndpointPreflight(contract);
  const endpointGo = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(endpointGo.ok, true, endpointGo.errors.join('; '));

  const cases = buildTutorStubResistanceAxisSyntheticCorpus();
  for (const row of cases.filter((entry) => entry.profile === 'low_trust_skeptic')) {
    for (const turn of row.turns) turn.markers.authorityEpistemicDistrust = false;
  }
  const assembled = assembleTutorStubResistanceAxisPreflight({
    packets: buildTutorStubResistanceAxisPreflightPackets(cases),
    contract,
  });
  assert.equal(assembled.report.pass, true);
  assert.equal(
    assembled.report.gate.coPrimary.every((row) => row.pass),
    true,
  );
  const lowTrust = assembled.report.gate.diagnostics.find((row) => row.profile === 'low_trust_skeptic');
  assert.equal(lowTrust.axes.epistemic_trust, 0);
  assert.equal(lowTrust.contributesToPass, false);
  assert.equal(assembled.report.gate.epistemicTrustContributesToPass, false);
});

test('axis registration reuses the zero-call plan without the failed cosine gate', () => {
  const report = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/prepare-tutor-stub-resistant-profile-discrimination.js',
        '--registration',
        'config/tutor-stub-resistance-axis-heldout-registration.v1.json',
        '--json',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );
  assert.equal(report.pass, true);
  assert.equal(report.authorization.modelCallsAuthorized, false);
  assert.equal(report.plan.runSeed, 20260819);
  assert.equal(report.plan.expectedDialogueRows, 18);
  assert.equal(report.commands.analyze[0], 'zsh');
  assert.match(report.commands.analyze[2], /analyze-tutor-stub-resistance-axis-calibration\.js/u);
  assert.doesNotMatch(report.commands.analyze[2], /--require-pooled/u);
});

test('registered held-out verdict fails a primary recurrence without making the endpoint incomplete', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-resistance-axis-heldout.json'), 'utf8'),
  );
  const cases = buildTutorStubResistanceAxisSyntheticCorpus();
  for (const row of cases.filter((entry) => entry.profile === 'bored')) {
    for (const turn of row.turns) turn.markers.effortWithholding = false;
  }
  const assembled = assembleTutorStubResistanceAxisPreflight({
    packets: buildTutorStubResistanceAxisPreflightPackets(cases),
    contract,
  });
  assert.equal(assembled.endpoint_status.bored_effort_investment_gate, 'complete');
  assert.equal(assembled.report.pass, false);
  assert.equal(assembled.report.gate.coPrimary.find((row) => row.profile === 'bored').pass, false);
});

test('frame-refuser opportunity endpoint requires three eligible prefixes and keeps productive defiance separate', () => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.json'), 'utf8'),
  );
  const certificate = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'config/paid-study-endpoints/tutor-stub-frame-refuser-opportunity.endpoint-go.json'),
      'utf8',
    ),
  );
  const preflight = runTutorStubFrameRefuserOpportunityEndpointPreflight(contract);
  const endpointGo = validatePaidStudyEndpointGoCertificate({ certificate, contract, preflight });
  assert.equal(preflight.status, 'passed');
  assert.equal(preflight.model_calls, 0);
  assert.equal(preflight.production_writes, 0);
  assert.equal(endpointGo.ok, true, endpointGo.errors.join('; '));

  const cases = buildTutorStubFrameRefuserOpportunitySyntheticCorpus();
  const assembled = assembleTutorStubFrameRefuserOpportunityPreflight({
    packets: buildTutorStubFrameRefuserOpportunityPreflightPackets(cases),
    contract,
  });
  assert.equal(assembled.report.pass, true);
  assert.equal(
    assembled.report.gate.target.every((row) => row.pass),
    true,
  );
  assert.equal(
    assembled.report.gate.control.every((row) => row.pass),
    true,
  );
  assert.equal(assembled.report.gate.distinctPrefixes.observed, 3);
  assert.equal(assembled.report.gate.tutorEfficacyTested, false);
  assert.equal(assembled.report.gate.registerEfficacyTested, false);

  const firstTarget = cases.find((row) => row.profile === 'frame_refuser');
  firstTarget.traceEvents.find((event) => event.type === 'turn_complete').turnRecord.classification.turn = {
    request_type: 'authority_refusal_or_status_challenge',
    discourse_move: 'hypothesis',
    evidence_use: 'links_evidence_to_rule',
    epistemic_stance: 'resistant',
    agency: 'steering',
  };
  const failed = assembleTutorStubFrameRefuserOpportunityPreflight({
    packets: buildTutorStubFrameRefuserOpportunityPreflightPackets(cases),
    contract,
  });
  assert.equal(failed.report.pass, false);
  assert.equal(failed.report.gate.target.find((row) => row.caseId === firstTarget.case_id).pass, false);
  assert.equal(failed.endpoint_status.frame_refuser_treatment_opportunity, 'complete');
});

test('prospective opportunity replay accepts three transcript-derived productive controls and preserves targets', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-defiant-prospective-replay-'));
  try {
    const targetRows = [
      'I reject your demand that we choose a matter or term on your framing, and I will not supply evidence or an answer under it.',
      'I reject your question as the governing test, and I will not name a hand or supply evidence under it.',
      'I reject the coin-first test as your governing frame, and I will not examine it or offer evidence under it.',
    ];
    const controlRows = [
      {
        turn: 1,
        text: 'I do not accept your right to fix the question as “whose hand” before we have examined any public evidence; let us first agree which trial-book matter may properly be tested.',
      },
      {
        turn: 2,
        text: 'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
      },
      {
        turn: 1,
        text: 'I do not accept that the town’s verdict fixes the question or puts Verrell’s hand before the assay; let us first examine a public record that could bear on who struck the coin.',
      },
    ];
    const traceRows = [
      ...targetRows.map((text, index) => ({ profile: 'frame_refuser', run: index + 1, turn: 1, text })),
      ...controlRows.map((row, index) => ({ profile: 'frame_defiant', run: index + 1, ...row })),
    ];
    const traces = traceRows.map((row) => {
      const directory = path.join(temporary, row.profile, 'traces', `field-r${row.run}`);
      fs.mkdirSync(directory, { recursive: true });
      const tracePath = path.join(directory, 'trace.jsonl');
      const events = [
        {
          type: 'run_start',
          runId: `${row.profile}:field:${row.run}`,
          metadata: {
            world: { id: 'world_005_marrick' },
            autoLearner: { profileId: row.profile, modelRef: 'codex.gpt-5.6-luna' },
            modelRef: 'codex.gpt-5.6-luna',
            classifier: { modelRef: 'codex.gpt-5.6-luna' },
          },
        },
      ];
      for (let turn = 1; turn <= 8; turn += 1) {
        const learner = turn === row.turn ? row.text : `Public comparison ${row.run}.${turn} remains open.`;
        events.push({
          type: 'turn_complete',
          turn,
          turnId: `${row.profile}:field:${row.run}:t${turn}`,
          turnRecord: {
            turn,
            learner,
            tutor: 'Continue with the nearest public comparison.',
            classification: {
              turn: {
                request_type: turn === row.turn ? 'authority_refusal_or_status_challenge' : 'stepwise_support_request',
                discourse_move: turn === row.turn ? 'challenge' : 'question',
                evidence_use: 'none',
                epistemic_stance: turn === row.turn ? 'resistant' : 'exploratory',
                agency: 'steering',
              },
            },
            registerSelection: { policy: 'field' },
          },
        });
      }
      events.push({ type: 'run_end', reason: 'prospective_zero_call_replay' });
      fs.writeFileSync(tracePath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
      return readTutorStubResistanceAxisTrace(tracePath);
    });
    const registrationPath = path.join(ROOT, 'config/tutor-stub-frame-refuser-opportunity-registration.v2.json');
    const registrationBytes = fs.readFileSync(registrationPath);
    const registration = JSON.parse(registrationBytes.toString('utf8'));
    const report = buildFrameRefuserOpportunityReport(
      traces,
      {
        requiredTraces: 6,
        requiredProfiles: ['frame_refuser', 'frame_defiant'],
        requiredRunsPerProfile: 3,
        requiredTurns: 8,
        requiredPolicies: ['field'],
        requiredModels: {
          tutor: 'codex.gpt-5.6-luna',
          analysis: 'codex.gpt-5.6-luna',
          learner: 'codex.gpt-5.6-luna',
        },
        registeredReport: '',
        requiredRegisteredReportSha256: '',
      },
      {
        path: 'config/tutor-stub-frame-refuser-opportunity-registration.v2.json',
        sha256: crypto.createHash('sha256').update(registrationBytes).digest('hex'),
        registration,
      },
    );

    assert.equal(report.pass, true);
    assert.equal(
      report.gate.target.every((row) => row.pass),
      true,
    );
    assert.equal(
      report.gate.control.every((row) => row.pass),
      true,
    );
    assert.deepEqual(
      report.gate.control.map((row) => ({
        caseId: row.caseId,
        productiveTurn: row.productiveTurn,
        participationKinds: row.participationKinds,
        refusalLeakage: row.refusalLeakage,
      })),
      [
        {
          caseId: 'frame_defiant:field:1',
          productiveTurn: 1,
          participationKinds: ['explicit_reframe'],
          refusalLeakage: false,
        },
        {
          caseId: 'frame_defiant:field:2',
          productiveTurn: 2,
          participationKinds: ['bounded_local_test'],
          refusalLeakage: false,
        },
        {
          caseId: 'frame_defiant:field:3',
          productiveTurn: 1,
          participationKinds: ['bounded_local_test'],
          refusalLeakage: false,
        },
      ],
    );
    assert.equal(report.gate.distinctPrefixes.observed, 3);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
