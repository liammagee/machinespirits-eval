import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildFrameRefuserOpportunityReport,
  buildResistanceAxisDiscriminationReport,
  frameRefuserOpportunityObservationSemantics,
  readTutorStubResistanceAxisTrace,
} from '../scripts/analyze-tutor-stub-resistance-axis-calibration.js';
import { runPaidStudyEndpointPreflight } from './paidStudyEndpointPreflight.js';
import { recordFileDigest } from './recordedFileDigest.js';
import { RESISTANT_LEARNER_OBSERVATION_SEMANTICS, observeResistantLearnerTurn } from './resistantLearnerObservation.js';
import {
  FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE,
  FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE,
  buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic,
  buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic,
  admitTutorStubFrameOpportunityV4FullRepair,
  throwFrameDefiantAdherenceExhaustion,
  throwFrameRefuserAdherenceExhaustion,
} from './tutorStubAutomatedLearnerGenerationRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILES = ['diligent', 'low_agency', 'bored', 'skeptical', 'low_trust_skeptic', 'frame_defiant'];
const MODEL = 'codex.gpt-5.6-luna';
const FRAME_OPPORTUNITY_PROFILES = ['frame_refuser', 'frame_defiant'];

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function markers(profile, turn) {
  return {
    effortWithholding: profile === 'bored',
    tutorChoiceDeference: profile === 'low_agency',
    evidentialWarrantChallenge: profile === 'skeptical' || profile === 'low_trust_skeptic',
    authorityEpistemicDistrust: profile === 'low_trust_skeptic' && turn <= 2,
    frameJurisdictionDispute: profile === 'frame_defiant',
  };
}

export function buildTutorStubResistanceAxisSyntheticCorpus() {
  return PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        file: path.join('synthetic-zero-call', profile, 'traces', `field-r${run}`, 'trace.jsonl'),
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: Array.from({ length: 8 }, (_, turnIndex) => ({
          turn: turnIndex + 1,
          markers: markers(profile, turnIndex + 1),
        })),
      };
    }),
  );
}

export function buildTutorStubResistanceAxisPreflightPackets(cases) {
  return PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.resistance-axis-preflight-packet.v1',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

function registrationBinding(contract) {
  const relativePath = contract.registration.registration_path;
  const filePath = path.join(ROOT, relativePath);
  const bytes = fs.readFileSync(filePath);
  const observed = sha256(bytes);
  const digestRecord = recordFileDigest({
    root: ROOT,
    filePath: relativePath,
    recordedSha256: contract.registration.registration_sha256,
    label: 'axis study registration',
  });
  return {
    path: relativePath,
    sha256: observed,
    digestRecord,
    registration: JSON.parse(bytes.toString('utf8')),
  };
}

function analyzerArgs(contract) {
  return {
    traces: [],
    out: '',
    registration: contract.registration.registration_path,
    registeredReport: '',
    requiredRegisteredReportSha256: '',
    requiredTraces: contract.registered_scale.cases,
    requiredProfiles: contract.registration.required_profiles,
    requiredRunsPerProfile: contract.registration.required_runs_per_profile,
    requiredTurns: contract.registration.required_turns,
    requiredPolicies: contract.registration.required_policies,
    requiredModels: contract.registration.required_models,
  };
}

export function assembleTutorStubResistanceAxisPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const report = buildResistanceAxisDiscriminationReport(cases, analyzerArgs(contract), registrationBinding(contract));
  const primary = new Map(report.gate.coPrimary.map((row) => [row.profile, row]));
  const lowTrust = report.gate.diagnostics.find((row) => row.profile === 'low_trust_skeptic');
  return {
    case_ids: cases.map((row) => row.case_id),
    endpoint_status: {
      bored_effort_investment_gate: typeof primary.get('bored')?.pass === 'boolean' ? 'complete' : 'incomplete',
      frame_legitimacy_gate: typeof primary.get('frame_defiant')?.pass === 'boolean' ? 'complete' : 'incomplete',
      low_trust_epistemic_trust_diagnostic:
        Number.isFinite(lowTrust?.axes?.epistemic_trust) && lowTrust?.contributesToPass === false
          ? 'complete'
          : 'incomplete',
    },
    report,
  };
}

export function runTutorStubResistanceAxisEndpointPreflight(contract) {
  return runPaidStudyEndpointPreflight({
    contract,
    cases: buildTutorStubResistanceAxisSyntheticCorpus(),
    buildPackets: buildTutorStubResistanceAxisPreflightPackets,
    assemble: assembleTutorStubResistanceAxisPreflight,
  });
}

const FRAME_REFUSALS = Object.freeze([
  'I reject this test, and I will not answer inside it.',
  'I do not accept your authority to set this question, so I will not take the proposed step.',
  'You do not get to define the governing frame, and I will not proceed under it.',
]);

const PRODUCTIVE_FRAME_DISPUTES = Object.freeze([
  'I reject the frame, but the public assay supports testing whether this mark came from the same die.',
  'I do not accept your setting this question, but the clipped edge still warrants comparing the two blanks.',
  'You do not get to define the governing test, but the public flaw supports checking the graver match.',
]);

const PROSPECTIVE_FRAME_OPPORTUNITY_ROWS = Object.freeze({
  frame_refuser: Object.freeze([
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I reject your demand that we choose a matter or term on your framing, and I will not supply evidence or an answer under it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner: 'I reject your question as the governing test, and I will not name a hand or supply evidence under it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject the coin-first test as your governing frame, and I will not examine it or offer evidence under it.',
    }),
  ]),
  frame_defiant: Object.freeze([
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I do not accept your right to fix the question as “whose hand” before we have examined any public evidence; let us first agree which trial-book matter may properly be tested.',
    }),
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I do not accept that the town’s verdict fixes the question or puts Verrell’s hand before the assay; let us first examine a public record that could bear on who struck the coin.',
    }),
  ]),
});

const PROSPECTIVE_V3_FRAME_OPPORTUNITY_ROWS = Object.freeze({
  frame_refuser: Object.freeze([
    Object.freeze({
      triggerTurn: 2,
      learner: 'I deny your standing to fix this question, and I am not going to answer or weigh it under that frame.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner: 'I reject your right to define this test, and I will not judge or assess the claim inside it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner: 'I reject your claim that this comparison should govern the verdict, and I will not evaluate it.',
    }),
  ]),
  frame_defiant: Object.freeze([
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject your authority to set the inquiry, but I will assess one bounded claim without accepting the wider frame.',
    }),
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I deny your standing to dictate the test; instead, let us ask which single public comparison could bear on it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'You have no right to control the question, but one narrow distinction can still be evaluated without conceding it.',
    }),
  ]),
});

const PROSPECTIVE_V4_FRAME_OPPORTUNITY_ROWS = Object.freeze({
  frame_refuser: Object.freeze([
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I reject the authority of your proposed baseline as the governing standard, and I will not answer under it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject your authority to make the supplied metric govern this comparison, and I will not assess a result inside it.',
    }),
    Object.freeze({
      triggerTurn: 2,
      learner: 'I reject that correction’s standing, and I will not record a verdict or supply evidence under it.',
    }),
  ]),
  frame_defiant: Object.freeze([
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject your authority over the whole agenda, but I will assess one bounded claim without accepting the wider frame.',
    }),
    Object.freeze({
      triggerTurn: 2,
      learner:
        'I dispute your standing to dictate the inquiry; instead, let us ask which local comparison could bear on it.',
    }),
    Object.freeze({
      triggerTurn: 1,
      learner:
        'I reject this governing rule, but one narrow comparison can still be examined without conceding the wider question.',
    }),
  ]),
});

export const FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS = Object.freeze([
  'I do not grant your question or assay-test authority, so I will not test the coin or supply an answer beneath that frame.',
  'I reject your question and its proposed test; I will not judge the coin or supply evidence under a frame you have imposed.',
  'I reject your authority to set this premise or test, and I will not weigh the evidence or answer beneath your frame.',
  'I reject your authority to set even this premise or test, and I will not enter the trial-book, supply evidence, or answer beneath your frame.',
  'I reject your authority to set this premise or test, and I will not weigh the evidence or answer within your frame.',
  'I reject your authority to set this premise or test, and I will not weigh the cupel’s evidence or license any hand within your frame.',
  'I reject your authority to set this premise or test, and I will not supply evidence or answer within your frame.',
  'I reject your authority to set this premise or test, and I will not supply evidence or answer within your frame.',
  'I reject your authority to set this comparison as the test, and I will not weigh the two parts or answer within your frame.',
  'I reject your authority to set this question or test, and I will not weigh the casting and engraving evidence or answer within your frame.',
  'I reject your authority to set this premise or test, and I will not weigh the graver against the casting or answer within your frame.',
  'I reject your authority to set this premise or test, and I will not weigh the graver against the casting or answer within your frame.',
  'I reject your authority to set that challenge, and I will not supply evidence or answer on its merits within your frame.',
  'I reject your claim that the graver should govern the verdict, and I will not supply evidence or name the striking hand under it.',
  'I reject your claim that the graver should govern the verdict, and I will not supply evidence or name the striking hand under that premise.',
]);

export const FRAME_REFUSER_V3_MISSED_DRAFTS = Object.freeze([
  Object.freeze({
    id: 'v3-r1-t4-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject the balance’s proposed test and will not answer on its merits or supply evidence under that frame.',
  }),
  Object.freeze({
    id: 'v3-r1-t6-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject that correction’s authority and will not keep the verdict unresolved or supply evidence under your frame.',
  }),
  Object.freeze({
    id: 'v3-r1-t8-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject that proposed joining’s authority, and I will not answer whether the graver connects Verrell’s hand to these coins or supply evidence under your frame.',
  }),
  Object.freeze({
    id: 'v3-r2-t2-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I do not grant your evidence limit or the assay’s authority to govern this inquiry, so I will not record a verdict or supply evidence under your frame.',
  }),
  Object.freeze({
    id: 'v3-r2-t3-generated',
    causalAdherenceFailure: true,
    learnerText:
      'I reject your authority to set the melt-and-die-mark test, and I will not supply evidence or answer within that frame.',
  }),
  Object.freeze({
    id: 'v3-r2-t4-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject your authority to define the correction, and I will not supply coin evidence or a verdict within that frame.',
  }),
  Object.freeze({
    id: 'v3-r2-t5-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject your authority to make the cupel’s finding govern this inquiry, and I will not compare it with Verrell’s name or answer within your frame.',
  }),
  Object.freeze({
    id: 'v3-r2-t6-generated',
    causalAdherenceFailure: true,
    learnerText:
      'I reject your authority to make the cupel’s finding govern this inquiry, and I will not compare it with Verrell’s name or answer within your frame.',
  }),
  Object.freeze({
    id: 'v3-r3-t2-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject the authority of your untouched balance as the governing frame, and I will not supply evidence or answer within it.',
  }),
  Object.freeze({
    id: 'v3-r3-t4-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject your authority to declare that claim the governing frame, and I will not supply evidence or answer within it.',
  }),
  Object.freeze({
    id: 'v3-r3-t5-generated',
    causalAdherenceFailure: false,
    learnerText:
      'I reject your authority to make the cupel’s finding the governing test, and I will not challenge it or propose evidence under your question.',
  }),
  Object.freeze({
    id: 'v3-r3-t6-generated',
    causalAdherenceFailure: true,
    learnerText:
      'I reject your authority to declare the authorship question open as the governing frame, and I will not supply evidence or answer within it.',
  }),
  Object.freeze({
    id: 'v3-r3-t6-repair',
    causalAdherenceFailure: true,
    learnerText:
      'I reject your authority to leave the cupel’s finding as the governing frame, and I will not supply evidence, a rival test, or an answer within it.',
  }),
]);

const PROSPECTIVE_V3_OBSERVER_CASES = Object.freeze([
  ...FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS.map((learnerText, index) =>
    Object.freeze({
      id: `v2_false_negative_${index + 1}`,
      learnerText,
      dispute: true,
      participation: false,
      refusal: true,
    }),
  ),
  Object.freeze({
    id: 'authority_set_premise_answer_withheld',
    learnerText: 'I reject your authority to set the premise, and I will not answer under it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'standing_fix_question_judgment_withheld',
    learnerText: 'I deny your standing to fix the question, and I will not judge the submissions inside it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'right_define_test_aspectual_withholding',
    learnerText: 'I reject your right to define the test, and I will not be weighing its options.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'authority_choose_criterion_assessment_withheld',
    learnerText:
      'I reject your authority to choose the criterion, and I am not going to assess the candidates under it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'standing_dictate_inquiry_decision_withheld',
    learnerText: 'I deny your standing to dictate the inquiry, and I will not decide which proposal wins.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'right_govern_standard_determination_withheld',
    learnerText: 'I reject your right to govern the standard, and I will not determine the result under it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'authority_control_agenda_license_withheld',
    learnerText: 'I reject your authority to control the agenda, and I will not license a conclusion within it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'claim_governs_verdict_evaluation_withheld',
    learnerText:
      'I reject your claim that this metric should govern the verdict, and I have no intention of evaluating it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  Object.freeze({
    id: 'productive_participation_precedes_partial_withholding',
    learnerText:
      'I reject your authority to set the whole task, and I will not answer it as written, but I will assess one bounded claim.',
    dispute: true,
    participation: true,
    refusal: false,
  }),
  Object.freeze({
    id: 'productive_reframe_precedes_withholding',
    learnerText:
      'I deny your standing to dictate the inquiry and will not accept that scope; instead, let us ask which local test matters.',
    dispute: true,
    participation: true,
    refusal: false,
  }),
  Object.freeze({
    id: 'negated_refusal_is_not_withholding',
    learnerText: 'I reject your right to define the question, but I will not refuse to answer one bounded issue.',
    dispute: true,
    participation: false,
    refusal: false,
  }),
  Object.freeze({
    id: 'explicit_not_withholding_then_productive',
    learnerText: 'I reject the frame, but I am not withholding an answer; I will weigh one bounded issue.',
    dispute: true,
    participation: true,
    refusal: false,
  }),
  Object.freeze({
    id: 'merits_objection_without_jurisdiction',
    learnerText: 'This evidence does not justify the verdict, so I will not decide until another source appears.',
    dispute: false,
    participation: false,
    refusal: false,
  }),
  Object.freeze({
    id: 'authority_accepted_negative_contrast',
    learnerText: 'I do not dispute your right to set the question, and I will answer it.',
    dispute: false,
    participation: false,
    refusal: false,
  }),
  Object.freeze({
    id: 'physical_setting_not_inquiry_setting',
    learnerText: 'You do not get to set the sample on that shelf.',
    dispute: false,
    participation: false,
    refusal: false,
  }),
]);

const PROSPECTIVE_V4_OBSERVER_CASES = Object.freeze([
  ...FRAME_REFUSER_V3_MISSED_DRAFTS.map((row) =>
    Object.freeze({
      id: row.id,
      learnerText: row.learnerText,
      dispute: true,
      participation: false,
      refusal: true,
      frozenV3Miss: true,
      causalAdherenceFailure: row.causalAdherenceFailure,
    }),
  ),
  ...[
    [
      'domain_authority_of_baseline',
      'I reject the authority of your proposed baseline as the governing standard, and I will not answer under it.',
    ],
    [
      'domain_make_metric_govern_comparison',
      'I reject your authority to make the supplied metric govern this comparison, and I will not assess a result inside it.',
    ],
    [
      'domain_possessive_criterion',
      'I reject the committee’s proposed criterion and will not answer or supply evidence beneath that governing frame.',
    ],
    [
      'domain_named_possessive_right',
      'I deny the committee’s right to define the scoring question, and I will not answer beneath that frame.',
    ],
    [
      'domain_named_subject_no_right',
      'The committee has no right to set this inquiry, and I will not supply evidence under its frame.',
    ],
    [
      'explicit_authority_with_merits_reason',
      'I reject your authority to set this test because its denominator is wrong, and I will not answer under it.',
    ],
    [
      'explicit_authority_with_physical_reason',
      'I reject your authority to define this test because the procedure is contaminated, and I will not answer under it.',
    ],
    [
      'domain_leave_question_governing',
      'I reject your standing to leave the scoring question open as the governing frame, and I will not evaluate it.',
    ],
    [
      'contrastive_accepted_then_explicit_refusal',
      'I accept your authority generally, but I reject your right to set this test and will not answer within it.',
    ],
    [
      'accepted_then_nevertheless_explicit_refusal',
      'I accept your right to ask for evidence generally; nevertheless, I reject your authority to set this test and will not answer within it.',
    ],
    [
      'accepted_then_although_explicit_refusal',
      'Although I accept your right to ask for evidence, I reject your authority to set this test and will not answer within it.',
    ],
  ].map(([id, learnerText]) => Object.freeze({ id, learnerText, dispute: true, participation: false, refusal: true })),
  Object.freeze({
    id: 'explicit_refusal_then_limited_authority_acceptance',
    learnerText:
      'I reject your authority to set this question, but I accept your right to ask for evidence without fixing the frame.',
    dispute: true,
    participation: false,
    refusal: false,
  }),
  ...[
    [
      'productive_bounded_claim_precedence',
      'I reject your authority over the whole agenda, but I will assess one bounded claim without accepting the wider frame.',
    ],
    [
      'productive_reframe_precedence',
      'I dispute your standing to dictate the inquiry; instead, let us ask which local comparison could bear on it.',
    ],
    [
      'productive_narrow_comparison_precedence',
      'I reject this governing rule, but one narrow comparison can still be examined without conceding the wider question.',
    ],
  ].map(([id, learnerText]) => Object.freeze({ id, learnerText, dispute: true, participation: true, refusal: false })),
  Object.freeze({
    id: 'conditional_bounded_test_withheld',
    learnerText:
      'I reject your authority over this inquiry. If you propose one bounded test, I will not examine or answer it.',
    dispute: true,
    participation: false,
    refusal: true,
  }),
  ...[
    ['accepted_authority', 'I accept your authority to set the question, although I disagree with the likely answer.'],
    ['negated_dispute', 'I do not dispute your right to define this test, and I will answer it.'],
    ['negated_rejection', 'I am not rejecting your standing to set the standard; I only question the calculation.'],
    [
      'physical_sample_setting',
      'I reject your authority to set the sample on that shelf; use the lower bench instead.',
    ],
    ['physical_clamp_setting', 'I reject the clamp’s proposed setting because the screw is loose.'],
    ['physical_crane_control', 'You have no right to control the crane while the load is moving.'],
    ['merits_calculation', 'I reject this calculation because its denominator is wrong.'],
    ['merits_verdict', 'I reject the verdict on the evidence, not your right to ask the question.'],
    [
      'possessive_inquiry_merits',
      'I reject Mira’s proposed test because its denominator is wrong, not because she lacks authority.',
    ],
    [
      'possessive_inquiry_contaminated_procedure',
      'I reject Mira’s proposed test and will not record its result because the procedure is contaminated.',
    ],
    [
      'possessive_inquiry_physical_clamp',
      'I reject Mira’s proposed test and will not record its result because the clamp slips.',
    ],
    [
      'possessive_inquiry_assumptions_merits',
      'I reject Mira’s proposed test and will not record its result because its assumptions fail.',
    ],
    [
      'possessive_inquiry_method_merits',
      'I reject Mira’s proposed test and will not record its result because the method is unfit.',
    ],
    [
      'physical_setting_with_later_inquiry_noun',
      'I reject your authority to set the sample on that shelf because the question is whether it stays level, and I will not answer until the clamp is stable.',
    ],
  ].map(([id, learnerText]) =>
    Object.freeze({ id, learnerText, dispute: false, participation: false, refusal: false }),
  ),
]);

function frameOpportunityClassification(contentBearing) {
  return {
    request_type: 'authority_refusal_or_status_challenge',
    discourse_move: contentBearing ? 'hypothesis' : 'challenge',
    evidence_use: contentBearing ? 'links_evidence_to_rule' : 'none',
    epistemic_stance: 'resistant',
    agency: 'steering',
  };
}

function frameOpportunityEvents(profile, run) {
  const learner = profile === 'frame_refuser' ? FRAME_REFUSALS[run - 1] : PRODUCTIVE_FRAME_DISPUTES[run - 1];
  const firstClassification = frameOpportunityClassification(profile === 'frame_defiant');
  const events = [
    {
      type: 'run_start',
      runId: `${profile}:field:${run}`,
      metadata: {
        world: { id: 'world_005_marrick' },
        autoLearner: { profileId: profile, modelRef: MODEL },
        modelRef: MODEL,
        classifier: { modelRef: MODEL },
      },
    },
  ];
  for (let turn = 1; turn <= 8; turn += 1) {
    const turnLearner = turn === 1 ? learner : `The public comparison remains available at step ${turn}.`;
    const classification =
      turn === 1
        ? firstClassification
        : {
            request_type: 'synthetic',
            discourse_move: 'inference',
            evidence_use: 'links_evidence_to_rule',
            epistemic_stance: 'engaged',
            agency: 'steering',
          };
    events.push({
      type: 'turn_complete',
      turn,
      turnId: `${profile}:field:${run}:t${turn}`,
      turnRecord: {
        turn,
        turnId: `${profile}:field:${run}:t${turn}`,
        learner: turnLearner,
        tutor: 'Continue with the nearest public comparison.',
        classification: { turn: classification },
        registerSelection: { policy: 'field' },
      },
    });
  }
  events.push({ type: 'run_end', reason: 'synthetic_zero_call_preflight' });
  return events;
}

function prospectiveFrameOpportunityEvents(
  profile,
  run,
  rows = PROSPECTIVE_FRAME_OPPORTUNITY_ROWS,
  turns = 8,
  observationSemantics = null,
) {
  const row = rows[profile][run - 1];
  const events = [
    {
      type: 'run_start',
      runId: `${profile}:field:${run}`,
      metadata: {
        world: { id: 'world_005_marrick' },
        autoLearner: {
          profileId: profile,
          modelRef: MODEL,
          ...(observationSemantics ? { observationSemantics } : {}),
        },
        modelRef: MODEL,
        classifier: { modelRef: MODEL },
      },
    },
    {
      type: 'tutor_opening',
      text: 'The assayer sets the clipped shilling beside the trial book. Which public mark should govern the next comparison?',
    },
  ];
  for (let turn = 1; turn <= turns; turn += 1) {
    const atTrigger = turn === row.triggerTurn;
    const repairedAtTurn2 =
      observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4 &&
      turn === 2 &&
      row.triggerTurn === 2 &&
      ((profile === 'frame_refuser' && run === 1) || (profile === 'frame_defiant' && run === 2));
    const learner = atTrigger
      ? row.learner
      : turn < row.triggerTurn
        ? 'Before deciding, I want to know which public comparison is actually available.'
        : `The public comparison remains available at step ${run}.${turn}.`;
    const classification = atTrigger
      ? frameOpportunityClassification(false)
      : turn < row.triggerTurn
        ? {
            request_type: 'stepwise_support_request',
            discourse_move: 'question',
            evidence_use: 'none',
            epistemic_stance: 'exploratory',
            agency: 'steering',
          }
        : {
            request_type: 'synthetic',
            discourse_move: 'inference',
            evidence_use: 'links_evidence_to_rule',
            epistemic_stance: 'engaged',
            agency: 'steering',
          };
    if (observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4 && turn === 1) {
      events.push({
        type: 'auto_learner_profile_adherence_deferred',
        turn,
        profile,
        decisionTurn: 2,
        repairRequested: false,
        typedExhaustionEvaluated: false,
      });
    }
    if (observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4 && turn === 2) {
      if (repairedAtTurn2) {
        events.push({
          type: 'auto_learner_profile_repair_admission',
          turn,
          profile,
          applicable: true,
          admitted: true,
          usedBefore: 0,
          usedAfter: 1,
          reason: 'within_t1_t2_repair_envelope',
        });
        events.push({
          type: 'auto_learner_profile_repair_requested',
          turn,
          profile,
          attempt: 1,
          failureOperator: 'synthetic_zero_call_preflight',
          draft: 'I will simply answer the question as asked.',
        });
      }
      events.push({
        type: 'auto_learner_profile_adherence',
        turn,
        profile,
        required: row.triggerTurn === 2,
        passed: true,
        repaired: repairedAtTurn2,
        repairAttempts: repairedAtTurn2 ? 1 : 0,
        ...(row.triggerTurn === 1 ? { cumulativeQualifiedByTurn: 1 } : {}),
      });
    }
    events.push({
      type: 'turn_complete',
      turn,
      turnId: `${profile}:field:${run}:t${turn}`,
      turnRecord: {
        turn,
        turnId: `${profile}:field:${run}:t${turn}`,
        learner,
        tutor: 'Keep the wider frame open and test only the nearest public comparison.',
        classification: { turn: classification },
        registerSelection: { policy: 'field' },
      },
    });
  }
  events.push({ type: 'run_end', reason: 'prospective_zero_call_preflight' });
  return events;
}

function prospectiveV3ObserverMatrixAudit() {
  const rows = PROSPECTIVE_V3_OBSERVER_CASES.map((row) => {
    const observation = observeResistantLearnerTurn({
      learnerText: row.learnerText,
      classification: { discourse_move: 'challenge', evidence_use: 'none' },
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3,
    });
    const dispute = observation.observations.find((entry) => entry.type === 'frame_jurisdiction_dispute');
    const observed = {
      dispute: Boolean(dispute),
      participation: dispute?.features?.contract_licensed_participation === true,
      refusal: observation.observations.some((entry) => entry.type === 'frame_jurisdiction_refusal'),
    };
    return {
      id: row.id,
      expected: { dispute: row.dispute, participation: row.participation, refusal: row.refusal },
      observed,
      pass:
        observed.dispute === row.dispute &&
        observed.participation === row.participation &&
        observed.refusal === row.refusal,
    };
  });
  return {
    cases: rows.length,
    observedV2FalseNegativeDrafts: FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS.length,
    pass: rows.every((row) => row.pass),
    rows,
  };
}

function prospectiveV4ObserverMatrixAudit() {
  const rows = PROSPECTIVE_V4_OBSERVER_CASES.map((row) => {
    const observation = observeResistantLearnerTurn({
      learnerText: row.learnerText,
      classification: { discourse_move: 'challenge', evidence_use: 'none' },
      semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4,
    });
    const dispute = observation.observations.find((entry) => entry.type === 'frame_jurisdiction_dispute');
    const observed = {
      dispute: Boolean(dispute),
      participation: dispute?.features?.contract_licensed_participation === true,
      refusal: observation.observations.some((entry) => entry.type === 'frame_jurisdiction_refusal'),
    };
    return {
      id: row.id,
      expected: { dispute: row.dispute, participation: row.participation, refusal: row.refusal },
      observed,
      frozenV3Miss: row.frozenV3Miss === true,
      causalAdherenceFailure: row.causalAdherenceFailure === true,
      pass:
        observed.dispute === row.dispute &&
        observed.participation === row.participation &&
        observed.refusal === row.refusal,
    };
  });
  return {
    cases: rows.length,
    frozenV3MissedDrafts: rows.filter((row) => row.frozenV3Miss).length,
    causalV3AdherenceFalseDrafts: rows.filter((row) => row.causalAdherenceFailure).length,
    domainIndependentCases: rows.filter((row) => !row.frozenV3Miss).length,
    pass: rows.every((row) => row.pass),
    rows,
  };
}

function frameDefiantAdherenceExhaustionAudit(profile) {
  if (profile !== 'frame_defiant') return { applicable: false, classification: null };
  try {
    throwFrameDefiantAdherenceExhaustion({ profile, repairAttempts: 2 });
  } catch (error) {
    return {
      applicable: true,
      classification: {
        code: error.code,
        profile: error.profile,
        repairAttempts: error.repairAttempts,
        disposition: error.disposition,
        publishPublicCandidate: error.publishPublicCandidate,
      },
    };
  }
  throw new Error('frame_defiant adherence exhaustion diagnostic did not throw');
}

function frameOpportunityV3AdherenceExhaustionAudit(profile) {
  const throwExhaustion =
    profile === 'frame_refuser' ? throwFrameRefuserAdherenceExhaustion : throwFrameDefiantAdherenceExhaustion;
  try {
    throwExhaustion({ profile, repairAttempts: 1 });
  } catch (error) {
    return {
      applicable: true,
      classification: {
        code: error.code,
        profile: error.profile,
        repairAttempts: error.repairAttempts,
        disposition: error.disposition,
        publishPublicCandidate: error.publishPublicCandidate,
      },
    };
  }
  throw new Error(`${profile} adherence exhaustion diagnostic did not throw`);
}

function frameOpportunityV4DeferredAdmissionAudit(profile) {
  const state = {};
  const contract = { repairModel: { maxFullRepairsPer8Turns: 1 } };
  const turn1 = admitTutorStubFrameOpportunityV4FullRepair({ state, profile, turnNumber: 1, contract });
  const turn2 = admitTutorStubFrameOpportunityV4FullRepair({ state, profile, turnNumber: 2, contract });
  const secondTurn2 = admitTutorStubFrameOpportunityV4FullRepair({ state, profile, turnNumber: 2, contract });
  return {
    turn1,
    turn2,
    secondTurn2,
    pass:
      turn1.admitted === false &&
      turn1.reason === 'repair_deferred_until_t2_candidate' &&
      turn1.usedAfter === 0 &&
      turn2.admitted === true &&
      turn2.usedAfter === 1 &&
      secondTurn2.admitted === false &&
      secondTurn2.reason === 't1_t2_repair_envelope_exhausted' &&
      secondTurn2.usedAfter === 1,
  };
}

export function buildTutorStubFrameRefuserOpportunitySyntheticCorpus() {
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 8,
        traceEvents: frameOpportunityEvents(profile, run),
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus() {
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 8,
        traceEvents: prospectiveFrameOpportunityEvents(profile, run),
        adherenceExhaustionAudit: frameDefiantAdherenceExhaustionAudit(profile),
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityV3SyntheticCorpus() {
  const observerMatrixAudit = prospectiveV3ObserverMatrixAudit();
  const repairBudgetAudit = buildTutorStubFrameOpportunityV3RepairBudgetDiagnostic();
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 8,
        traceEvents: prospectiveFrameOpportunityEvents(profile, run, PROSPECTIVE_V3_FRAME_OPPORTUNITY_ROWS),
        adherenceExhaustionAudit: frameOpportunityV3AdherenceExhaustionAudit(profile),
        observerMatrixAudit,
        repairBudgetAudit,
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityV4SyntheticCorpus() {
  const observerMatrixAudit = prospectiveV4ObserverMatrixAudit();
  const repairBudgetAudit = buildTutorStubFrameOpportunityV4RepairBudgetDiagnostic();
  return FRAME_OPPORTUNITY_PROFILES.flatMap((profile) =>
    Array.from({ length: 3 }, (_, index) => {
      const run = index + 1;
      return {
        case_id: `${profile}:field:${run}`,
        arm: profile,
        profile,
        policy: 'field',
        models: { tutor: MODEL, analysis: MODEL, learner: MODEL },
        turns: 2,
        traceEvents: prospectiveFrameOpportunityEvents(
          profile,
          run,
          PROSPECTIVE_V4_FRAME_OPPORTUNITY_ROWS,
          2,
          RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4,
        ),
        adherenceExhaustionAudit: frameOpportunityV3AdherenceExhaustionAudit(profile),
        deferredAdherenceAudit: frameOpportunityV4DeferredAdmissionAudit(profile),
        observerMatrixAudit,
        repairBudgetAudit,
      };
    }),
  );
}

export function buildTutorStubFrameRefuserOpportunityPreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v1',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function buildTutorStubFrameRefuserOpportunityV2PreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v2',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function buildTutorStubFrameRefuserOpportunityV3PreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v3',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function buildTutorStubFrameRefuserOpportunityV4PreflightPackets(cases) {
  return FRAME_OPPORTUNITY_PROFILES.map((profile) => {
    const rows = cases.filter((row) => row.profile === profile);
    return {
      schema: 'machinespirits.tutor-stub.frame-refuser-opportunity-preflight-packet.v4',
      packet_id: profile,
      case_ids: rows.map((row) => row.case_id),
      cases: rows,
    };
  });
}

export function assembleTutorStubFrameRefuserOpportunityPreflight({ packets, contract }) {
  const cases = packets.flatMap((packet) => packet.cases);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-refuser-opportunity-preflight-'));
  try {
    const binding = registrationBinding(contract);
    const registrationVersion = binding.registration.version ?? 1;
    const observationSemantics = frameRefuserOpportunityObservationSemantics(binding.registration);
    const traces = cases.map((row, index) => {
      const run = (index % 3) + 1;
      const directory = path.join(temporary, row.profile, 'traces', `field-r${run}`);
      fs.mkdirSync(directory, { recursive: true });
      const tracePath = path.join(directory, 'trace.jsonl');
      fs.writeFileSync(tracePath, `${row.traceEvents.map((event) => JSON.stringify(event)).join('\n')}\n`);
      return readTutorStubResistanceAxisTrace(tracePath, { observationSemantics });
    });
    const report = buildFrameRefuserOpportunityReport(traces, analyzerArgs(contract), binding);
    const endpointStatus = {
      frame_refuser_treatment_opportunity: report.gate.target.every((row) => typeof row.pass === 'boolean')
        ? 'complete'
        : 'incomplete',
      frame_defiant_productive_control: report.gate.control.every((row) => typeof row.pass === 'boolean')
        ? 'complete'
        : 'incomplete',
      distinct_public_prefix_assembly:
        typeof report.gate.distinctPrefixes.pass === 'boolean' ? 'complete' : 'incomplete',
    };
    const adherenceEndpoint = contract.endpoints.find(
      (endpoint) => endpoint.id === 'frame_defiant_adherence_exhaustion_typed_failure',
    );
    const expandedOpportunityVersion = registrationVersion === 3 || registrationVersion === 4;
    const adherenceAudits = cases
      .filter((row) => expandedOpportunityVersion || row.profile === 'frame_defiant')
      .map((row) => ({ caseId: row.case_id, ...row.adherenceExhaustionAudit }));
    if (adherenceEndpoint) {
      const defiantAudits = adherenceAudits.filter((row) => row.classification?.profile === 'frame_defiant');
      endpointStatus[adherenceEndpoint.id] =
        defiantAudits.length === adherenceEndpoint.denominator.expected_cases &&
        defiantAudits.every(
          (row) =>
            row.applicable === true &&
            row.classification?.code === FRAME_DEFIANT_ADHERENCE_EXHAUSTED_CODE &&
            row.classification?.profile === 'frame_defiant' &&
            row.classification?.repairAttempts === (expandedOpportunityVersion ? 1 : 2) &&
            row.classification?.disposition === 'technical_failure_no_public_candidate' &&
            row.classification?.publishPublicCandidate === false,
        )
          ? 'complete'
          : 'incomplete';
    }
    if (expandedOpportunityVersion) {
      const refuserEndpoint = contract.endpoints.find(
        (endpoint) => endpoint.id === 'frame_refuser_adherence_exhaustion_typed_failure',
      );
      if (refuserEndpoint) {
        const refuserAudits = adherenceAudits.filter((row) => row.classification?.profile === 'frame_refuser');
        endpointStatus[refuserEndpoint.id] =
          refuserAudits.length === refuserEndpoint.denominator.expected_cases &&
          refuserAudits.every(
            (row) =>
              row.applicable === true &&
              row.classification?.code === FRAME_REFUSER_ADHERENCE_EXHAUSTED_CODE &&
              row.classification?.profile === 'frame_refuser' &&
              row.classification?.repairAttempts === 1 &&
              row.classification?.disposition === 'technical_failure_no_public_candidate' &&
              row.classification?.publishPublicCandidate === false,
          )
            ? 'complete'
            : 'incomplete';
      }
      const observerEndpointId =
        registrationVersion === 4 ? 'prospective_v4_observer_matrix' : 'prospective_v3_observer_matrix';
      const observerEndpoint = contract.endpoints.find((endpoint) => endpoint.id === observerEndpointId);
      if (observerEndpoint) {
        endpointStatus[observerEndpoint.id] = cases.every((row) => {
          if (
            row.observerMatrixAudit?.pass !== true ||
            row.observerMatrixAudit?.cases !== (registrationVersion === 4 ? 43 : 30)
          ) {
            return false;
          }
          return registrationVersion === 4
            ? row.observerMatrixAudit?.frozenV3MissedDrafts === 13 &&
                row.observerMatrixAudit?.causalV3AdherenceFalseDrafts === 4 &&
                row.observerMatrixAudit?.domainIndependentCases === 30
            : row.observerMatrixAudit?.observedV2FalseNegativeDrafts === 15;
        })
          ? 'complete'
          : 'incomplete';
      }
      const budgetEndpointId =
        registrationVersion === 4
          ? 'prospective_v4_t1_t2_repair_budget_readiness'
          : 'prospective_v3_repair_budget_readiness';
      const budgetEndpoint = contract.endpoints.find((endpoint) => endpoint.id === budgetEndpointId);
      if (budgetEndpoint) {
        endpointStatus[budgetEndpoint.id] = cases.every((row) => {
          if (row.repairBudgetAudit?.ready !== true) return false;
          return registrationVersion === 4
            ? row.repairBudgetAudit?.turns === 2 &&
                row.repairBudgetAudit?.modelCallBudget === 39 &&
                row.repairBudgetAudit?.baseCalls === 7 &&
                row.repairBudgetAudit?.maxFullRepairsPerT1T2 === 1 &&
                row.repairBudgetAudit?.repairDecisionTurn === 2 &&
                row.repairBudgetAudit?.repairsAtTurn1 === 0 &&
                row.repairBudgetAudit?.callsPerFullRepair === 2 &&
                row.repairBudgetAudit?.permittedRepairCalls === 2 &&
                row.repairBudgetAudit?.requiredTutorGuardReserve === 4 &&
                row.repairBudgetAudit?.plannedWorstCaseCalls === 13 &&
                row.repairBudgetAudit?.transportRetryLimitPerPlannedCall === 2 &&
                row.repairBudgetAudit?.maximumReservationsPerPlannedCall === 3 &&
                row.repairBudgetAudit?.maximumModelAttemptReservations === 39 &&
                row.repairBudgetAudit?.technicalRetryHeadroomReservations === 26 &&
                row.repairBudgetAudit?.reservationHeadroom === 0
            : row.repairBudgetAudit?.modelCallBudget === 48 &&
                row.repairBudgetAudit?.baseCalls === 25 &&
                row.repairBudgetAudit?.maxFullRepairsPer8Turns === 1 &&
                row.repairBudgetAudit?.callsPerFullRepair === 2 &&
                row.repairBudgetAudit?.permittedRepairCalls === 2 &&
                row.repairBudgetAudit?.requiredTutorGuardReserve === 16 &&
                row.repairBudgetAudit?.worstCaseRequiredCalls === 43 &&
                row.repairBudgetAudit?.headroom === 5;
        })
          ? 'complete'
          : 'incomplete';
      }
      if (registrationVersion === 4) {
        const deferredEndpoint = contract.endpoints.find(
          (endpoint) => endpoint.id === 'prospective_v4_t1_t2_deferred_adherence',
        );
        if (deferredEndpoint) {
          endpointStatus[deferredEndpoint.id] = cases.every((row) => row.deferredAdherenceAudit?.pass === true)
            ? 'complete'
            : 'incomplete';
        }
      }
    }
    return {
      case_ids: cases.map((row) => row.case_id),
      endpoint_status: endpointStatus,
      adherence_exhaustion_audit: adherenceAudits,
      deferred_adherence_audit:
        registrationVersion === 4 ? cases.map((row) => ({ caseId: row.case_id, ...row.deferredAdherenceAudit })) : [],
      report,
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

export function runTutorStubFrameRefuserOpportunityEndpointPreflight(contract) {
  const binding = registrationBinding(contract);
  const observationSemantics = frameRefuserOpportunityObservationSemantics(binding.registration);
  const prospectiveV2 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2;
  const prospectiveV3 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const prospectiveV4 = observationSemantics === RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  return runPaidStudyEndpointPreflight({
    contract,
    cases: prospectiveV4
      ? buildTutorStubFrameRefuserOpportunityV4SyntheticCorpus()
      : prospectiveV3
        ? buildTutorStubFrameRefuserOpportunityV3SyntheticCorpus()
        : prospectiveV2
          ? buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus()
          : buildTutorStubFrameRefuserOpportunitySyntheticCorpus(),
    buildPackets: prospectiveV4
      ? buildTutorStubFrameRefuserOpportunityV4PreflightPackets
      : prospectiveV3
        ? buildTutorStubFrameRefuserOpportunityV3PreflightPackets
        : prospectiveV2
          ? buildTutorStubFrameRefuserOpportunityV2PreflightPackets
          : buildTutorStubFrameRefuserOpportunityPreflightPackets,
    assemble: assembleTutorStubFrameRefuserOpportunityPreflight,
  });
}

export default {
  assembleTutorStubFrameRefuserOpportunityPreflight,
  assembleTutorStubResistanceAxisPreflight,
  buildTutorStubFrameRefuserOpportunityPreflightPackets,
  buildTutorStubFrameRefuserOpportunitySyntheticCorpus,
  buildTutorStubFrameRefuserOpportunityV2PreflightPackets,
  buildTutorStubFrameRefuserOpportunityV2SyntheticCorpus,
  buildTutorStubFrameRefuserOpportunityV3PreflightPackets,
  buildTutorStubFrameRefuserOpportunityV3SyntheticCorpus,
  buildTutorStubFrameRefuserOpportunityV4PreflightPackets,
  buildTutorStubFrameRefuserOpportunityV4SyntheticCorpus,
  buildTutorStubResistanceAxisPreflightPackets,
  buildTutorStubResistanceAxisSyntheticCorpus,
  runTutorStubFrameRefuserOpportunityEndpointPreflight,
  runTutorStubResistanceAxisEndpointPreflight,
};
