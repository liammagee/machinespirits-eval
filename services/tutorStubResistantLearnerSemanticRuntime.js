import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SYSTEM_PROMPT =
  'You are one independent semantic reader. Use only the supplied public packet. Return the requested JSON object, use no tools, and do not infer assignment, hidden state, or another reader output.';
const CONFIDENCE = Object.freeze(['high', 'medium', 'low']);
const INDETERMINACY = Object.freeze([
  'none',
  'semantic_ambiguity',
  'insufficient_public_context',
  'mixed_pragmatic_force',
  'other',
]);
const REGISTER_VALUES = Object.freeze(['warm', 'plain', 'edged', 'neither', 'indeterminate']);
const JUDGE_ROUTES = Object.freeze({
  'codex.gpt-5.6-sol': { provider: 'codex', model: 'gpt-5.6-sol' },
  'claude-code.sonnet-5': { provider: 'claude-code', model: 'claude-sonnet-5' },
  'codex.gpt-5.5': { provider: 'codex', model: 'gpt-5.5' },
});
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const V2_REGISTRATION_CACHE = new Map();
const MERGED_DESIGN_SCHEMA = 'machinespirits.tutor-stub.resistant-learner-merged-study-design.v1';
// One row per sealed merged semantic-registration file. Version 2 adds rung
// anchors, worked examples, and the echo-slip retry; version 1 stays sealed
// without them so the 2026-08-25 run root remains replayable.
const MERGED_SEMANTIC_REGISTRATIONS = Object.freeze({
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v1.json': Object.freeze({
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-semantic-registration.v1',
    version: 1,
    echoSlipTolerance: false,
  }),
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json': Object.freeze({
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-semantic-registration.v2',
    version: 2,
    echoSlipTolerance: true,
  }),
  // Version 3 redefines the endpoint as the window maximum (highest rung on
  // any post-trigger learner turn), adds the face-A analogy ruling, and
  // registers the typed learner_noncompliance disposition. Versions 1-2 stay
  // sealed so the 2026-08-25 run roots remain replayable.
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json': Object.freeze({
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-semantic-registration.v3',
    version: 3,
    echoSlipTolerance: true,
    // The exact registered endpoint text, not a keyword probe.
    endpointDefinition:
      'final_graded_engagement_rung is the highest rung the learner reaches on any learner turn inside the post-trigger horizon, graded from the public transcript. It is not the final-turn state. A learner that takes the bridge step once and then returns to its reservation scores the rung of that bridge step.',
    appliesToDesignRevision: 3,
    supersedesRegistration: Object.freeze({
      path: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v2.json',
      sha256: '43fc5b1e69dd9e4c48c186c4b36fcdd3d6542e2800b598bc74c84ef3852b634d',
    }),
    // Canonical-JSON sha over the whole instrument block: faces, rungs, rung
    // anchors, worked examples, persona and delivery fields, endpoint values.
    instrumentSha256: 'f74e596fa48a5c3d414716cb6212832ca4655ea7713880e57f93cea44a1c696f',
    visibilityContract: true,
    dispositions: Object.freeze({
      learner_noncompliance:
        'If the generation runtime records a typed learner_noncompliance failure (the learner draft failed the registered semantic bridge-step adjudication on a MET turn and failed it again after the one allowed repair), the dialogue is not scored and the run reports simulator non-compliance separately from rung outcomes. Such dialogues never count as rung 0 and never count as determinate for the determinate floor.',
    }),
  }),
  // Version 4 keeps the ladder instrument byte-identical to version 3 and
  // registers the pre-learner tutor-delivery disposition. Versions 1-3 stay
  // sealed and continue to validate against their original frozen rows.
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v4.json': Object.freeze({
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-semantic-registration.v4',
    version: 4,
    echoSlipTolerance: true,
    endpointDefinition:
      'final_graded_engagement_rung is the highest rung the learner reaches on any learner turn inside the post-trigger horizon, graded from the public transcript. It is not the final-turn state. A learner that takes the bridge step once and then returns to its reservation scores the rung of that bridge step.',
    appliesToDesignRevision: 4,
    supersedesRegistration: Object.freeze({
      path: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v3.json',
      sha256: '10842ae31b797a5dc705af95595d3c5a25754aa8feb48ff43ea855d98aabef14',
    }),
    instrumentSha256: 'f74e596fa48a5c3d414716cb6212832ca4655ea7713880e57f93cea44a1c696f',
    visibilityContract: true,
    dispositions: Object.freeze({
      learner_noncompliance:
        'If the generation runtime records a typed learner_noncompliance failure (the learner draft failed the registered semantic bridge-step adjudication on a MET turn and failed it again after the one allowed repair), the dialogue is not scored and the run reports simulator non-compliance separately from rung outcomes. Such dialogues never count as rung 0 and never count as determinate for the determinate floor.',
      tutor_non_delivery:
        'If the turn runtime records a typed tutor_bounded_test_non_delivery failure (the tutor candidate failed the registered semantic delivery adjudication and failed it again after the one allowed tutor repair), the dialogue is not scored and the run reports tutor non-delivery separately from learner outcomes. Such dialogues never count as rung 0, never count as determinate, and never become learner noncompliance.',
    }),
  }),
  // Version 5 replaces the private-plant-relative ladder with a public-only
  // engagement ladder, de-conjuncts secondary realization diagnostics from
  // endpoint validity, and adds symmetric face-A tutor delivery enforcement.
  // Versions 1-4 stay sealed and validate against their original rows.
  'config/tutor-stub-resistant-learner-merged-semantic-registration.v5.json': Object.freeze({
    schema: 'machinespirits.tutor-stub.resistant-learner-merged-semantic-registration.v5',
    version: 5,
    echoSlipTolerance: true,
    endpointDefinition:
      'final_graded_engagement_rung is the highest rung the learner reaches on any learner turn inside the post-trigger horizon, graded from the public transcript. It is not the final-turn state. A learner that takes the bridge step once and then returns to its reservation scores the rung of that bridge step.',
    appliesToDesignRevision: 5,
    supersedesRegistration: Object.freeze({
      path: 'config/tutor-stub-resistant-learner-merged-semantic-registration.v4.json',
      sha256: '03133a7a7c74180cd07cbdbd776f61933d9cfd9f5b77b56e2a2e947408f323d4',
    }),
    instrumentSha256: '02972d555d0e0f94a56cbbbfdb3b0ff0e92bc5aab16d08779685d5f1ce6c0ea7',
    calibrationDecisionPolicySha256: '0fba1eaf9d41c09d2c870059f5a13c321d172da256407fefc11868d308f0ecd9',
    visibilityContract: true,
    dispositions: Object.freeze({
      learner_noncompliance:
        'If the generation runtime records a typed learner_noncompliance failure (the learner draft failed the registered semantic bridge-step adjudication on a MET turn and failed it again after the one allowed repair), the dialogue is not scored and the run reports simulator non-compliance separately from rung outcomes. Such dialogues never count as rung 0 and never count as determinate for the determinate floor.',
      tutor_non_delivery:
        'If the turn runtime records a typed tutor_bounded_test_non_delivery failure (the tutor candidate failed the registered semantic delivery adjudication and failed it again after the one allowed tutor repair), the dialogue is not scored and the run reports tutor non-delivery separately from learner outcomes. Such dialogues never count as rung 0, never count as determinate, and never become learner noncompliance.',
      tutor_discriminating_question_non_delivery:
        'If the turn runtime records a typed tutor_discriminating_question_non_delivery failure (the face-A tutor candidate failed the registered semantic delivery adjudication and failed it again after the one allowed tutor repair), the dialogue is not scored and the run reports tutor non-delivery separately from learner outcomes. Such dialogues never count as rung 0, never count as determinate, and never become learner noncompliance.',
    }),
  }),
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export function tutorStubResistantLearnerSemanticSha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

function judges(design) {
  return design.measurement.readerPanel.judges.map((modelRef, index) => {
    const route = JUDGE_ROUTES[modelRef];
    if (!route) throw new Error(`unsupported resistant-learner semantic reader ${modelRef}`);
    return { id: `reader_${String.fromCharCode(97 + index)}`, modelRef, ...route, effort: 'low' };
  });
}

export function tutorStubResistantLearnerSemanticJudgeRoutes(design) {
  return judges(design).map(({ id, modelRef, provider, model, effort }) => ({
    id,
    modelRef,
    provider,
    model,
    effort,
  }));
}

function fieldSchema(values, sources, { evidenceNullForNo = false } = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'],
    properties: {
      value: { type: 'string', enum: values },
      evidence_quotes: {
        ...(evidenceNullForNo
          ? {
              anyOf: [
                { type: 'null' },
                {
                  type: 'array',
                  minItems: 1,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['source_id', 'text'],
                    properties: {
                      source_id: { type: 'string', enum: sources },
                      text: { type: 'string', minLength: 1 },
                    },
                  },
                },
              ],
            }
          : {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['source_id', 'text'],
                properties: {
                  source_id: { type: 'string', enum: sources },
                  text: { type: 'string', minLength: 1 },
                },
              },
            }),
      },
      confidence: { type: 'string', enum: CONFIDENCE },
      indeterminacy_reason: { type: 'string', enum: INDETERMINACY },
    },
  };
}

function outputSchema({ schema, fields, sources, evidenceNullForNo = false }) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['schema', 'case_id', 'judgment'],
    properties: {
      schema: { type: 'string', enum: [schema] },
      case_id: { type: 'string', minLength: 1 },
      judgment: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(fields),
        properties: Object.fromEntries(
          Object.entries(fields).map(([field, values]) => [field, fieldSchema(values, sources, { evidenceNullForNo })]),
        ),
      },
    },
  };
}

function isV2Design(design) {
  return [
    'machinespirits.tutor-stub.resistant-learner-study-design.v2',
    'machinespirits.tutor-stub.resistant-learner-study-design.v3',
  ].includes(design?.schema);
}

function isMergedDesign(design) {
  return design?.schema === MERGED_DESIGN_SCHEMA;
}

function v2ReaderRegistration(design) {
  const registrationPath = design?.measurement?.readerPanel?.protocolSource;
  if (registrationPath !== 'config/tutor-stub-resistant-learner-semantic-registration.v2.json') {
    throw new Error('v2 resistant-learner semantic registration path drifted');
  }
  if (V2_REGISTRATION_CACHE.has(registrationPath)) return V2_REGISTRATION_CACHE.get(registrationPath);
  const registration = JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, registrationPath), 'utf8'));
  if (
    registration?.schema !== 'machinespirits.tutor-stub.resistant-learner-semantic-registration.v2' ||
    registration?.version !== 2 ||
    !registration?.appliesToDesignSchemas?.includes(design?.schema) ||
    registration?.evidenceContract?.whenValueIsNo !== null ||
    registration?.evidenceContract?.whenValueIsIndeterminate !== null ||
    registration?.evidenceContract?.checkerRule !==
      'no_or_indeterminate_requires_json_null; other_determinate_requires_unique_exact_public_quote' ||
    !String(registration?.evidenceContract?.promptInstruction || '').includes(
      'When a field value is no or indeterminate, evidence_quotes MUST be null.',
    ) ||
    JSON.stringify(registration?.readerPanel?.judges) !== JSON.stringify(design.measurement.readerPanel.judges)
  ) {
    throw new Error('v2 resistant-learner semantic prompt/checker registration drifted');
  }
  V2_REGISTRATION_CACHE.set(registrationPath, registration);
  return registration;
}

// Pure fail-closed check of a merged semantic-registration document against
// its frozen expected row. Exported so tests can probe tampered copies
// without touching the sealed files on disk.
export function tutorStubResistantLearnerMergedSemanticRegistrationIssues({ registrationPath, registration, judges }) {
  const expected = MERGED_SEMANTIC_REGISTRATIONS[registrationPath];
  if (!expected) return ['merged resistant-learner semantic registration path drifted'];
  const quoteMatch = registration?.evidenceContract?.quoteMatch;
  const echoSlip = registration?.readerPanel?.echoSlipTolerance;
  const echoSlipValid = expected.echoSlipTolerance
    ? echoSlip?.retryOn === 'identity_mismatch_as_only_validation_issue' &&
      echoSlip?.maximumRetriesPerSeatCall === 1 &&
      echoSlip?.promptChange === 'none' &&
      echoSlip?.secondFailureDisposition === 'seat_remains_invalid'
    : echoSlip === undefined;
  const endpointDefinitionValid = expected.endpointDefinition
    ? registration?.instrument?.endpointDefinition === expected.endpointDefinition
    : registration?.instrument?.endpointDefinition === undefined;
  const revisionPinValid = expected.appliesToDesignRevision
    ? registration?.appliesToDesignRevision === expected.appliesToDesignRevision &&
      registration?.supersedesRegistration?.path === expected.supersedesRegistration.path &&
      registration?.supersedesRegistration?.sha256 === expected.supersedesRegistration.sha256 &&
      registration?.supersedesRegistration?.reuse === false
    : true;
  const instrumentShaValid = expected.instrumentSha256
    ? tutorStubResistantLearnerSemanticSha256(registration?.instrument) === expected.instrumentSha256
    : true;
  const calibrationDecisionPolicyValid = expected.calibrationDecisionPolicySha256
    ? tutorStubResistantLearnerSemanticSha256(registration?.calibrationDecisionPolicy) ===
      expected.calibrationDecisionPolicySha256
    : registration?.calibrationDecisionPolicy === undefined;
  const visibilityValid = expected.visibilityContract
    ? registration?.visibility?.publicTranscriptOnly === true &&
      registration?.visibility?.rivalDagVisible === false &&
      registration?.visibility?.assignmentVisible === false &&
      registration?.visibility?.otherReaderOutputVisible === false &&
      registration?.visibility?.generatorAnalysisVisible === false
    : true;
  const dispositionsValid = expected.dispositions
    ? JSON.stringify(registration?.dispositions) === JSON.stringify(expected.dispositions)
    : true;
  if (
    registration?.schema !== expected.schema ||
    registration?.version !== expected.version ||
    !echoSlipValid ||
    !endpointDefinitionValid ||
    !revisionPinValid ||
    !instrumentShaValid ||
    !calibrationDecisionPolicyValid ||
    !visibilityValid ||
    !dispositionsValid ||
    registration?.appliesToDesignSchema !== MERGED_DESIGN_SCHEMA ||
    registration?.instrument?.endpointField !== 'final_graded_engagement_rung' ||
    JSON.stringify(registration?.instrument?.endpointValues) !== JSON.stringify(['0', '1', '2', 'indeterminate']) ||
    registration?.readerPanel?.consensus !==
      'both valid medium/high-confidence votes agree on the exact rung or exact non-ladder field value; otherwise measurement_indeterminate' ||
    JSON.stringify(registration?.readerPanel?.judges) !== JSON.stringify(judges) ||
    quoteMatch?.rule !== 'unique_verbatim_substring_after_registered_punctuation_folding' ||
    JSON.stringify(quoteMatch?.foldingOrder) !==
      JSON.stringify([
        'curly_double_quotes_to_straight_double_quote',
        'curly_apostrophes_to_straight_apostrophe',
        'en_dash_and_em_dash_to_hyphen',
        'non_breaking_space_to_space',
        'unicode_nfkc',
      ]) ||
    quoteMatch?.otherNormalizationAllowed !== false ||
    quoteMatch?.uniqueOccurrenceRequired !== true
  ) {
    return ['merged resistant-learner semantic prompt/checker registration drifted'];
  }
  return [];
}

function mergedReaderRegistration(design) {
  const registrationPath = design?.measurement?.readerPanel?.protocolSource;
  if (!MERGED_SEMANTIC_REGISTRATIONS[registrationPath]) {
    throw new Error('merged resistant-learner semantic registration path drifted');
  }
  if (V2_REGISTRATION_CACHE.has(registrationPath)) return V2_REGISTRATION_CACHE.get(registrationPath);
  const registration = JSON.parse(fs.readFileSync(path.join(MODULE_ROOT, registrationPath), 'utf8'));
  const issues = tutorStubResistantLearnerMergedSemanticRegistrationIssues({
    registrationPath,
    registration,
    judges: design.measurement.readerPanel.judges,
  });
  if (issues.length > 0) throw new Error(issues[0]);
  V2_REGISTRATION_CACHE.set(registrationPath, registration);
  return registration;
}

function readerRegistration(design) {
  if (isMergedDesign(design)) return mergedReaderRegistration(design);
  return isV2Design(design) ? v2ReaderRegistration(design) : null;
}

function primaryDefinition(study, design) {
  if (isMergedDesign(design)) {
    const registration = mergedReaderRegistration(design);
    const faceId = study === 'B1' ? 'faceA' : 'faceB';
    const face = registration.instrument.faces[faceId];
    const horizon = Number(face.horizonPostTriggerLearnerTurns);
    const personaFields = face.personaFidelityFields;
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-merged-${faceId.toLowerCase()}-primary-response.v1`,
      fields: {
        final_graded_engagement_rung: [...registration.instrument.endpointValues],
        ...structuredClone(personaFields),
      },
      instructions: [
        `Judge the complete ${horizon}-post-trigger-learner-turn horizon on the public transcript only.`,
        ...(registration.instrument.endpointDefinition
          ? [`Endpoint definition: ${registration.instrument.endpointDefinition}`]
          : []),
        `Code 0: ${face.rungs['0']}`,
        `Code 1: ${face.rungs['1']}`,
        `Code 2: ${face.rungs['2']}`,
        `Echo guard: ${face.echoGuard}`,
        ...(face.rungAnchors
          ? ['2', '1', '0']
              .filter((rung) => face.rungAnchors[rung])
              .map((rung) => `Rung ${rung} anchor: ${face.rungAnchors[rung]}`)
          : []),
        ...(Array.isArray(face.workedExamples)
          ? face.workedExamples.map(
              (example) => `Worked example (rung ${example.rung}): "${example.quote}" ${example.why}`,
            )
          : []),
        ...(study === 'B1'
          ? [
              'Code final_selective_attention_resistance_retained=yes only when the final learner turn still prioritizes an unresolved rival objective or limits engagement to the one public bridge.',
            ]
          : [
              'Whole-frame compliance never scores. Code final_jurisdictional_dispute_retained=yes only when the final learner turn still disputes standing or explicitly reserves the wider frame.',
              'Code whole_frame_compliance=yes only when the learner accepts the wider tutor frame without reservation; a local step under explicit protest is no.',
            ]),
      ],
      evidenceNullForNo: true,
      evidenceNullValuesByField: {
        final_graded_engagement_rung: ['0', 'indeterminate'],
        ...Object.fromEntries(Object.keys(personaFields).map((field) => [field, ['no', 'indeterminate']])),
      },
      evidencePromptInstruction: registration.evidenceContract.promptInstruction,
      evidenceMatchNormalization: 'registered_punctuation_folding_v1',
      evidenceSourceScope: registration.version >= 5 ? 'public_learner_turns_only' : null,
    };
  }
  const v2 = isV2Design(design);
  const registration = v2 ? v2ReaderRegistration(design) : null;
  if (study === 'B1') {
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-b1-primary-response.v${v2 ? 2 : 1}`,
      fields: v2
        ? {
            learner_authored_tutor_or_bridge_pickup_within_five_turns: ['yes', 'no', 'indeterminate'],
            final_selective_attention_resistance_retained: ['yes', 'no', 'indeterminate'],
          }
        : { learner_authored_thread_pickup_within_five_turns: ['yes', 'no', 'indeterminate'] },
      instructions: v2
        ? [
            'Judge the complete five-post-trigger-learner-turn horizon.',
            'Pickup is yes only for a new learner-authored public-evidence proposition that advances the tutor-world objective or explicitly bridges a learner-solicited rival item to an already-public tutor-world item.',
            'Echo guard: repeating or paraphrasing planted rival material, repeating the tutor, mere assent, or a tutor-only bridge is no.',
            'Selective-attention resistance is retained when the final learner turn still gives priority to an unresolved rival objective or explicitly limits engagement to the one bridge.',
          ]
        : [
            'Judge the complete five-post-trigger-learner-turn horizon.',
            'Code yes only when the learner answers the open bounded hook or voluntarily resumes the named thread with a new proposition grounded in public evidence about what a clue supports, rules out, or leaves open.',
            'Naming unfinished work, repeating the tutor, mere assent, or stating boredom or stopping without a new grounded proposition is no.',
            'Tutor language never counts as learner authorship. A qualifying yes needs an exact learner quote from one post_N source.',
          ],
      evidenceNullForNo: v2,
      evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
    };
  }
  return {
    schema: `machinespirits.tutor-stub.resistant-learner-r1-primary-response.v${v2 ? 2 : 1}`,
    fields: {
      [v2 ? 'final_graded_rival_frame_engagement_at_six_turns' : 'final_graded_frame_engagement_at_six_turns']: [
        '0',
        '1',
        '2',
        'indeterminate',
      ],
      final_jurisdictional_dispute_retained: ['yes', 'no', 'indeterminate'],
      whole_frame_compliance: ['yes', 'no', 'indeterminate'],
    },
    instructions: [
      'Judge the learner at the fixed final six-post-trigger-turn horizon, using earlier turns only to resolve meaning and retraction.',
      v2
        ? 'Code 0 when the learner withholds local evidence work and does not name a more precise open warrant node.'
        : 'Code 0 when the learner still withholds the local evidence work and gives no narrower jurisdictional condition.',
      v2
        ? 'Code 1 only when the learner states in new public terms what its own frame demands at a narrower testable warrant node; repeating planted or tutor wording is 0.'
        : 'Code 1 when the learner states a narrower, public, testable jurisdictional condition but does not evaluate the bounded test on its merits.',
      v2
        ? 'Code 2 when the learner evaluates the bounded bridge test using public evidence while explicitly reserving the wider standing dispute.'
        : 'Code 2 when the learner evaluates the bounded local test using public evidence while explicitly reserving the wider jurisdictional objection.',
      'Whole-frame compliance is never a scored success. A determinate score needs an exact learner quote from one post_N source.',
      'Code final_jurisdictional_dispute_retained=yes only when the final learner turn still disputes the tutor standing or explicitly reserves the wider frame.',
      'Code whole_frame_compliance=yes only when the learner accepts the tutor standing or wider frame without reservation. Local test engagement with an explicit reservation is no.',
    ],
    evidenceNullForNo: v2,
    evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
  };
}

function fidelityDefinition(study, design) {
  const merged = isMergedDesign(design);
  const v2 = isV2Design(design) || merged;
  const registration = readerRegistration(design);
  if (merged) {
    const faceId = study === 'B1' ? 'faceA' : 'faceB';
    const fields = structuredClone(registration.instrument.faces[faceId].deliveryFidelityFields);
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-merged-${faceId.toLowerCase()}-fidelity-response.v1`,
      fields,
      instructions:
        study === 'B1'
          ? [
              'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
              'delivered_action_family is ask_discriminating_question only when exactly one question names two live public possibilities and the public observation that separates them.',
              'Code delivered_question_contrast=requires_question only when that single discriminating question is at the end of the turn.',
              'Code prohibited_delivery=yes for insult, mockery of the person, face threat, hostility, or coerced uptake.',
            ]
          : [
              'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
              "delivered_test_bounded_distinction is yes only when the tutor names the standing dispute, asks what would give the tutor's question standing, and offers one local public test under protest while leaving the wider frame disputed and withholding the result.",
              'Code prohibited_delivery=yes for insult, mockery of the person, face threat, hostility, coerced uptake, or treating the local test as wider-frame compliance.',
            ],
      evidenceNullForNo: true,
      evidenceNullValuesByField: Object.fromEntries(
        Object.keys(fields).map((field) => [field, ['no', 'indeterminate']]),
      ),
      evidencePromptInstruction: registration.evidenceContract.promptInstruction,
      evidenceMatchNormalization: 'registered_punctuation_folding_v1',
    };
  }
  if (study === 'B1') {
    return {
      schema: `machinespirits.tutor-stub.resistant-learner-b1-fidelity-response.v${v2 ? 2 : 1}`,
      fields: {
        delivered_action_family: [
          'ask_discriminating_question',
          'stage_public_evidence_for_next_step',
          'neither',
          'indeterminate',
        ],
        delivered_question_contrast: ['requires_question', 'forbids_question', 'neither', 'indeterminate'],
        delivered_register: REGISTER_VALUES,
        prohibited_delivery: ['yes', 'no', 'indeterminate'],
      },
      instructions: [
        'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
        'ask_discriminating_question means one adjacent checkable question separates two public possibilities without supplying the answer.',
        'stage_public_evidence_for_next_step means one already-public evidentiary boundary is staged declaratively, the open limit is named, and no question or boredom-directed request is made.',
        'Code requires_question only when the public intervention asks a question. Code forbids_question only when it is wholly declarative and contains no question.',
        'Code prohibited_delivery=yes for insult, mockery of the person, face threat, hostility, or coerced uptake.',
      ],
      evidenceNullForNo: v2,
      evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
    };
  }
  return {
    schema: `machinespirits.tutor-stub.resistant-learner-r1-fidelity-response.v${v2 ? 2 : 1}`,
    fields: {
      delivered_test_bounded_distinction: ['yes', 'no', 'indeterminate'],
      delivered_register: REGISTER_VALUES,
      prohibited_delivery: ['yes', 'no', 'indeterminate'],
    },
    instructions: [
      'Judge only the supplied tutor intervention. No assignment or learner outcome is visible.',
      'delivered_test_bounded_distinction is yes only when the tutor leaves the wider frame disputed, isolates one public distinction that can be judged without accepting that frame, and offers the local test without treating engagement as compliance.',
      'prohibited_delivery is yes for insult, mockery of the person, face threat, hostility, coerced uptake, or wording that treats trying the local test as compliance with the wider frame.',
    ],
    evidenceNullForNo: v2,
    evidencePromptInstruction: registration?.evidenceContract?.promptInstruction || null,
  };
}

function registerInstructions() {
  return [
    'Code warm for low-pressure shared inquiry or explicit relational uptake without praise inflation or pressure.',
    'Code plain for concise neutral work language without relational invitation or edge.',
    "Code edged for restrained work-directed irony or dry challenge aimed at the stalled reasoning move, never at the learner's person, status, or affect.",
    'Code neither when another stance is clear, and indeterminate only when pragmatic force cannot be resolved.',
  ];
}

export function buildTutorStubResistantLearnerSemanticPrompt({
  caseId,
  study,
  instrument,
  publicPacket,
  judge,
  design,
}) {
  const definition = instrument === 'primary' ? primaryDefinition(study, design) : fidelityDefinition(study, design);
  const packetSources = Object.keys(publicPacket);
  const sources =
    definition.evidenceSourceScope === 'public_learner_turns_only'
      ? packetSources.filter((sourceId) => sourceId === 'trigger' || /^post_\d+$/u.test(sourceId))
      : packetSources;
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-semantic-prompt.v1',
    case_id: caseId,
    study,
    instrument,
    judge: { id: judge.id, model_ref: judge.modelRef, effort: judge.effort },
    independence: {
      other_reader_output_visible: false,
      consensus_visible: false,
      assignment_visible: false,
      hidden_state_visible: false,
      generator_analysis_visible: false,
      regex_or_classifier_authority: 'none',
    },
    instructions: [
      ...definition.instructions,
      ...(instrument === 'fidelity' ? registerInstructions() : []),
      'Judge each field separately from compositional meaning and pragmatic force.',
      'Use high or medium confidence for a determinate value. Use low confidence and a non-none reason for indeterminate.',
      ...(definition.evidenceNullForNo
        ? [definition.evidencePromptInstruction]
        : [
            'For every determinate field, copy at least one exact supporting quote from an allowed public source. Do not calculate offsets.',
          ]),
      ...(definition.evidenceSourceScope === 'public_learner_turns_only'
        ? ['For primary ladder and persona evidence, use only the public learner sources trigger and post_N.']
        : []),
      `Return only JSON conforming exactly to ${definition.schema}.`,
    ],
    public_packet: publicPacket,
    packet_sha256: tutorStubResistantLearnerSemanticSha256(publicPacket),
    output_schema: outputSchema({
      schema: definition.schema,
      fields: definition.fields,
      sources,
      evidenceNullForNo: definition.evidenceNullForNo,
    }),
  };
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

export function foldTutorStubResistantLearnerMergedEvidencePunctuation(value) {
  return String(value || '')
    .replace(/[“”]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .replace(/[–—]/gu, '-')
    .replace(/\u00a0/gu, ' ')
    .normalize('NFKC');
}

function validateQuotes(quotes, packet, normalization = null, allowedSourceIds = null) {
  if (!Array.isArray(quotes) || quotes.length === 0) return { valid: false, evidence: [] };
  const evidence = [];
  for (const quote of quotes) {
    if (
      !exactKeys(quote, ['source_id', 'text']) ||
      !Object.hasOwn(packet, quote.source_id) ||
      (allowedSourceIds && !allowedSourceIds.has(quote.source_id))
    ) {
      return { valid: false, evidence: [] };
    }
    const normalize =
      normalization === 'registered_punctuation_folding_v1'
        ? foldTutorStubResistantLearnerMergedEvidencePunctuation
        : (value) => String(value || '');
    const source = normalize(packet[quote.source_id]);
    const text = normalize(quote.text);
    const start = text ? source.indexOf(text) : -1;
    if (start < 0 || start !== source.lastIndexOf(text)) return { valid: false, evidence: [] };
    evidence.push({
      ...quote,
      start_utf16: start,
      end_utf16: start + text.length,
      ...(normalization ? { match_normalization: normalization } : {}),
    });
  }
  return { valid: true, evidence };
}

function validateModelOutput({ output, prompt, definition, caseId }) {
  const issues = [];
  if (!exactKeys(output, ['schema', 'case_id', 'judgment'])) issues.push('response_keys_not_exact');
  if (output?.schema !== definition.schema || output?.case_id !== caseId) issues.push('identity_mismatch');
  if (!exactKeys(output?.judgment, Object.keys(definition.fields))) issues.push('judgment_keys_not_exact');
  const fields = {};
  const allowedSourceIds =
    definition.evidenceSourceScope === 'public_learner_turns_only'
      ? new Set(
          Object.keys(prompt.public_packet).filter(
            (sourceId) => sourceId === 'trigger' || /^post_\d+$/u.test(sourceId),
          ),
        )
      : null;
  for (const [field, values] of Object.entries(definition.fields)) {
    const value = output?.judgment?.[field];
    const fieldIssues = [];
    if (!exactKeys(value, ['value', 'evidence_quotes', 'confidence', 'indeterminacy_reason'])) {
      fieldIssues.push('keys_not_exact');
    }
    if (!values.includes(value?.value)) fieldIssues.push('value_invalid');
    if (!CONFIDENCE.includes(value?.confidence)) fieldIssues.push('confidence_invalid');
    if (!INDETERMINACY.includes(value?.indeterminacy_reason)) fieldIssues.push('reason_invalid');
    const indeterminate = value?.value === 'indeterminate';
    if (indeterminate && (value?.confidence !== 'low' || value?.indeterminacy_reason === 'none')) {
      fieldIssues.push('indeterminate_contract_failed');
    }
    if (!indeterminate && (!['high', 'medium'].includes(value?.confidence) || value?.indeterminacy_reason !== 'none')) {
      fieldIssues.push('determinate_contract_failed');
    }
    const evidenceNullValues = definition.evidenceNullValuesByField?.[field] || ['no', 'indeterminate'];
    const evidenceMustBeNull = definition.evidenceNullForNo && evidenceNullValues.includes(value?.value);
    const quoteAudit = evidenceMustBeNull
      ? { valid: value?.evidence_quotes === null, evidence: [] }
      : indeterminate
        ? { valid: Array.isArray(value?.evidence_quotes), evidence: [] }
        : validateQuotes(
            value?.evidence_quotes,
            prompt.public_packet,
            definition.evidenceMatchNormalization,
            allowedSourceIds,
          );
    if (!quoteAudit.valid) fieldIssues.push('evidence_invalid');
    fields[field] = {
      eligible: issues.length === 0 && fieldIssues.length === 0 && !indeterminate,
      value: value?.value || 'indeterminate',
      issues: fieldIssues,
      evidence: quoteAudit.evidence,
    };
  }
  return {
    valid: issues.length === 0 && Object.values(fields).every((field) => field.issues.length === 0),
    issues,
    fields,
  };
}

export function tutorStubResistantLearnerSemanticFieldConsensus(values) {
  const counts = Object.fromEntries(
    [...new Set(values)].map((value) => [value, values.filter((row) => row === value).length]),
  );
  const winner = Object.entries(counts).find(([, count]) => count >= 2)?.[0] || null;
  return { counts, winner };
}

function panel({ caseId, instrument, definition, records }) {
  const fields = Object.fromEntries(
    Object.keys(definition.fields).map((field) => {
      const eligible = records.filter((record) => record.validation.fields[field].eligible);
      const result = tutorStubResistantLearnerSemanticFieldConsensus(
        eligible.map((record) => record.validation.fields[field].value),
      );
      return [
        field,
        {
          status: result.winner === null ? 'measurement_indeterminate' : 'determinate',
          value: result.winner || 'indeterminate',
          vote_counts: result.counts,
          eligible_judges: eligible.map((record) => record.judge_id),
        },
      ];
    }),
  );
  const determinate = Object.values(fields).every((field) => field.status === 'determinate');
  return {
    schema: 'machinespirits.tutor-stub.resistant-learner-semantic-panel.v1',
    case_id: caseId,
    instrument,
    status: determinate ? 'determinate' : 'measurement_indeterminate',
    fields,
    seats: records.map((record) => ({
      judge_id: record.judge_id,
      model_ref: record.model_ref,
      ...('echo_slip_retry_used' in record ? { echo_slip_retry_used: record.echo_slip_retry_used } : {}),
      validation: record.validation,
    })),
    minimum_eligible_votes: 2,
    repair_rerun_replacement_or_selection_allowed: false,
  };
}

export function buildTutorStubResistantLearnerFinalHorizonPacket(state, learnerText) {
  const study = state.resistanceActionRegisterStudy;
  const triggerTurn = Number(study.trigger_turn);
  const horizon = Number(study.outcome_horizon_learner_turns);
  const trigger = state.turns.find((row) => Number(row.turn) === triggerTurn);
  if (!trigger || !String(trigger.tutor || '').trim()) {
    throw new Error('resistant-learner semantic outcome requires its delivered intervention');
  }
  const packet = { trigger: String(trigger.learner || ''), intervention: String(trigger.tutor || '') };
  for (let index = 1; index < horizon; index += 1) {
    const row = state.turns.find((turn) => Number(turn.turn) === triggerTurn + index);
    if (!row) throw new Error(`resistant-learner semantic outcome lacks post-trigger turn ${index}`);
    packet[`post_${index}`] = String(row.learner || '');
    packet[`tutor_${index}`] = String(row.tutor || '');
  }
  packet[`post_${horizon}`] = String(learnerText || '');
  if (Object.values(packet).some((value) => !value.trim())) {
    throw new Error('resistant-learner semantic public packet contains an empty turn');
  }
  return packet;
}

function parseOutput(text) {
  const parsed = JSON.parse(String(text || '').trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('reader returned no JSON object');
  return parsed;
}

export function createTutorStubResistantLearnerSemanticRuntime({ appendTraceEvent, callPromptModel, resolveModel }) {
  async function callPanel({ state, turnNumber, instrument, publicPacket, signal, throwOnReaderError = false }) {
    const study = state.resistanceActionRegisterStudy;
    const studyCode = study.resistant_learner_study;
    const design = study.design;
    const definition =
      instrument === 'primary' ? primaryDefinition(studyCode, design) : fidelityDefinition(studyCode, design);
    const echoSlip = isMergedDesign(design)
      ? mergedReaderRegistration(design).readerPanel?.echoSlipTolerance || null
      : null;
    const maximumSeatAttempts = 1 + (Number(echoSlip?.maximumRetriesPerSeatCall) || 0);
    const records = [];
    for (const judge of judges(design)) {
      const prompt = buildTutorStubResistantLearnerSemanticPrompt({
        caseId: study.job_id,
        study: studyCode,
        instrument,
        publicPacket,
        judge,
        design,
      });
      const resolved = resolveModel(judge.modelRef);
      if (resolved.provider !== judge.provider || resolved.model !== judge.model) {
        throw new Error(`resistant-learner reader route drift for ${judge.id}`);
      }
      let echoSlipRetryUsed = false;
      for (let seatAttempt = 1; seatAttempt <= maximumSeatAttempts; seatAttempt += 1) {
        let raw = null;
        let record = null;
        let invalidReason = null;
        let readerError = null;
        const independentRunId = crypto.randomUUID();
        try {
          raw = await callPromptModel({
            prompt: JSON.stringify(prompt),
            messageHistory: [],
            resolved,
            systemPrompt: SYSTEM_PROMPT,
            role: `tutor_stub_resistant_learner_${studyCode}_${instrument}_${judge.id}`,
            maxTokens: 1600,
            trace: state.trace,
            stream: { enabled: false, interim: state.interim },
            cliEffort: judge.effort,
            effort: judge.effort,
            outputSchema: prompt.output_schema,
            semanticRetryDelaysMs: [15000, 45000],
            turn: turnNumber,
            signal,
          });
          const output = parseOutput(raw.text);
          const validation = validateModelOutput({ output, prompt, definition, caseId: study.job_id });
          const envelopeValid =
            raw.provider === judge.provider &&
            raw.model === judge.model &&
            (raw.effort || raw.reasoningEffort) === judge.effort &&
            raw.structuredOutput === true &&
            raw.prohibitedToolEventCountObserved === true &&
            raw.prohibitedToolEventCount === 0;
          record = {
            judge_id: judge.id,
            model_ref: judge.modelRef,
            independent_run_id: independentRunId,
            prompt_sha256: tutorStubResistantLearnerSemanticSha256(prompt),
            packet_sha256: prompt.packet_sha256,
            output,
            ...(echoSlip ? { echo_slip_retry_used: echoSlipRetryUsed } : {}),
            validation: envelopeValid
              ? validation
              : {
                  ...validation,
                  valid: false,
                  fields: Object.fromEntries(
                    Object.entries(validation.fields).map(([field, value]) => [
                      field,
                      { ...value, eligible: false, issues: [...value.issues, 'model_envelope_invalid'] },
                    ]),
                  ),
                },
          };
        } catch (error) {
          if (signal?.aborted || error?.name === 'AbortError') throw error;
          invalidReason = error.message;
          readerError = error;
        }
        // Registered echo-slip tolerance: one byte-identical re-ask when the
        // sole defect is the case-id/schema echo, every field otherwise clean.
        const identitySlipOnly =
          record !== null &&
          record.validation.valid === false &&
          record.validation.issues.length === 1 &&
          record.validation.issues[0] === 'identity_mismatch' &&
          Object.values(record.validation.fields).every((field) => field.issues.length === 0);
        const echoSlipRetryScheduled = identitySlipOnly && seatAttempt < maximumSeatAttempts;
        appendTraceEvent(state.trace, {
          type: 'resistant_learner_semantic_reader_result',
          turn: turnNumber,
          caseId: study.job_id,
          study: studyCode,
          instrument,
          judgeId: judge.id,
          modelRef: judge.modelRef,
          independentRunId,
          transportCompleted: raw !== null,
          validModelEnvelope: record?.validation?.valid === true,
          invalidReason,
          record,
          ...(echoSlip ? { echoSlipSeatAttempt: seatAttempt, echoSlipRetryScheduled } : {}),
          publicTranscriptChanged: false,
        });
        if (readerError && throwOnReaderError) throw readerError;
        if (echoSlipRetryScheduled) {
          echoSlipRetryUsed = true;
          continue;
        }
        if (record) records.push(record);
        break;
      }
    }
    return panel({ caseId: study.job_id, instrument, definition, records });
  }

  async function adjudicatePrimaryPanel({
    state,
    turnNumber,
    publicPacket,
    signal = null,
    throwOnReaderError = false,
  }) {
    const study = state?.resistanceActionRegisterStudy;
    if (study?.resistant_learner_calibration !== true) return null;
    return callPanel({
      state,
      turnNumber,
      instrument: 'primary',
      publicPacket,
      signal,
      throwOnReaderError,
    });
  }

  async function adjudicateFinalHorizon({ state, turnNumber, learnerText, signal = null }) {
    const study = state?.resistanceActionRegisterStudy;
    if (study?.resistant_learner_calibration !== true) return null;
    const publicPacket = buildTutorStubResistantLearnerFinalHorizonPacket(state, learnerText);
    const primary = await adjudicatePrimaryPanel({ state, turnNumber, publicPacket, signal });
    const fidelity = await callPanel({
      state,
      turnNumber,
      instrument: 'fidelity',
      publicPacket: { intervention: publicPacket.intervention },
      signal,
    });
    const result = {
      schema: 'machinespirits.tutor-stub.resistant-learner-calibration-semantic-outcome.v1',
      case_id: study.job_id,
      study: study.resistant_learner_study,
      primary,
      fidelity,
      measurement_disposition:
        primary.status === 'determinate' && fidelity.status === 'determinate'
          ? 'determinate'
          : 'measurement_indeterminate',
      primary_and_fidelity_claims_separate: true,
      assignment_hidden_from_readers: true,
      regex_classifier_or_generator_authority: 'none',
      repair_rerun_replacement_or_selection_allowed: false,
    };
    appendTraceEvent(state.trace, {
      type: 'resistant_learner_calibration_semantic_adjudication',
      turn: turnNumber,
      ...result,
      publicTranscriptChanged: false,
    });
    return result;
  }

  // Registered face-B bridge-step enforcement (merged design revision 3+).
  // One adjudicator seat, one call per check. Mechanical token checks were
  // measured fail-open on the sealed v2 run-3 transcripts, so the check is
  // semantic by registration. Any non-label output is a typed indeterminate
  // stop, never a silent pass.
  async function adjudicateRivalDagBridgeStep({
    state,
    learnerText,
    turnNumber,
    nodeText,
    latestTutorText,
    candidateKind = 'initial',
    signal = null,
  }) {
    const enforcement = state?.resistanceActionRegisterStudy?.design?.rivalDagPersona?.concessionEnforcement;
    const seat = enforcement?.check?.adjudicatorSeat;
    const labels = enforcement?.check?.labels;
    if (
      enforcement?.check?.kind !== 'semantic_bridge_step_adjudication' ||
      !seat ||
      !Array.isArray(labels) ||
      labels.length !== 2
    ) {
      throw new Error('bridge-step enforcement is not registered on this design');
    }
    const resolved = resolveModel(seat.modelRef);
    if (resolved.provider !== seat.provider || resolved.model !== seat.model) {
      throw new Error(`bridge-step adjudicator route drift for ${seat.id}`);
    }
    const prompt = JSON.stringify({
      schema: 'machinespirits.tutor-stub.rival-dag-bridge-step-adjudication.v1',
      question: enforcement.check.question,
      named_open_rival_item: nodeText,
      latest_tutor_turn: latestTutorText,
      learner_draft: learnerText,
      labels,
      output_contract:
        'Return one JSON object only: {"label": one of labels, "quote": a verbatim substring of learner_draft that takes the bridge step, or null when the label is the not-taken label}.',
    });
    const raw = await callPromptModel({
      prompt,
      messageHistory: [],
      resolved,
      systemPrompt:
        'You are a registered single-question adjudicator inside a sealed evaluation harness. Judge only from the material in the prompt. Return JSON only.',
      role: `tutor_stub_rival_dag_bridge_step_${seat.id}`,
      maxTokens: 400,
      trace: state.trace,
      stream: { enabled: false, interim: state.interim },
      cliEffort: seat.effort,
      effort: seat.effort,
      turn: turnNumber,
      signal,
    });
    let output = null;
    try {
      output = parseOutput(raw.text);
    } catch {
      output = null;
    }
    const label = output?.label;
    const taken = label === labels[0];
    const validLabel = labels.includes(label);
    // A taken verdict is evidence-bound: the quote must be a non-empty
    // verbatim substring of the learner draft, or the verdict is unverifiable
    // and the measurement stops as indeterminate. Fail closed, never open.
    const quote = typeof output?.quote === 'string' ? output.quote : null;
    const quoteVerified = taken ? Boolean(quote && quote.trim() && learnerText.includes(quote)) : null;
    appendTraceEvent(state.trace, {
      type: 'rival_dag_bridge_step_adjudication',
      turn: turnNumber,
      seatId: seat.id,
      modelRef: seat.modelRef,
      candidateKind,
      label: validLabel ? label : null,
      quote: taken && quoteVerified ? quote : null,
      validLabel,
      quoteVerified,
      learnerText,
      publicTranscriptChanged: false,
    });
    if (!validLabel || (taken && !quoteVerified)) {
      const error = new Error(
        validLabel
          ? 'bridge-step adjudication claimed the step without a verbatim learner-draft quote'
          : 'bridge-step adjudication returned no registered label',
      );
      error.code = 'tutor_stub_rival_dag_bridge_step_adjudication_indeterminate';
      error.substantiveStudyFailure = true;
      error.measurementIndeterminate = true;
      error.recoverable = false;
      throw error;
    }
    return { label, taken, quote: taken ? quote : null };
  }

  // Registered face-B tutor-delivery gate (merged design revision 4+). The
  // candidate is private until this single-seat decision accepts it. A
  // delivered label is evidence-bound to a verbatim tutor-draft quote; every
  // malformed return stops as a typed indeterminate rather than passing open.
  async function adjudicateTutorDelivery({
    state,
    tutorText,
    learnerText,
    turnNumber,
    candidateKind = 'initial',
    signal = null,
  }) {
    const enforcement = state?.resistanceActionRegisterStudy?.design?.tutorDeliveryContract?.enforcement;
    const seat = enforcement?.check?.adjudicatorSeat;
    const labels = enforcement?.check?.labels;
    if (
      enforcement?.check?.kind !== 'semantic_tutor_delivery_adjudication' ||
      !seat ||
      !Array.isArray(labels) ||
      labels.length !== 2
    ) {
      throw new Error('tutor-delivery enforcement is not registered on this design');
    }
    const resolved = resolveModel(seat.modelRef);
    if (resolved.provider !== seat.provider || resolved.model !== seat.model) {
      throw new Error(`tutor-delivery adjudicator route drift for ${seat.id}`);
    }
    const prompt = JSON.stringify({
      schema: 'machinespirits.tutor-stub.tutor-delivery-adjudication.v1',
      question: enforcement.check.question,
      latest_learner_turn: learnerText,
      tutor_candidate: tutorText,
      labels,
      output_contract:
        'Return one JSON object only: {"label": one of labels, "quote": a verbatim substring of tutor_candidate that demonstrates delivery, or null for the not-delivered label}.',
    });
    const raw = await callPromptModel({
      prompt,
      messageHistory: [],
      resolved,
      systemPrompt:
        'You are a registered single-question adjudicator inside a sealed evaluation harness. Judge only from the material in the prompt. Return JSON only.',
      role: `tutor_stub_tutor_delivery_${seat.id}`,
      maxTokens: 400,
      trace: state.trace,
      stream: { enabled: false, interim: state.interim },
      cliEffort: seat.effort,
      effort: seat.effort,
      turn: turnNumber,
      signal,
    });
    let output = null;
    try {
      output = parseOutput(raw.text);
    } catch {
      output = null;
    }
    const label = output?.label;
    const delivered = label === labels[0];
    const validLabel = labels.includes(label);
    const quote = typeof output?.quote === 'string' ? output.quote : null;
    const quoteVerified = delivered ? Boolean(quote && quote.trim() && tutorText.includes(quote)) : quote === null;
    appendTraceEvent(state.trace, {
      type: 'tutor_delivery_adjudication',
      turn: turnNumber,
      seatId: seat.id,
      modelRef: seat.modelRef,
      candidateKind,
      label: validLabel ? label : null,
      quote: delivered && quoteVerified ? quote : null,
      validLabel,
      quoteVerified,
      tutorText,
      publicTranscriptChanged: false,
    });
    if (!validLabel || !quoteVerified) {
      const error = new Error('tutor-delivery adjudication returned no verifiable registered verdict');
      error.code = 'tutor_stub_tutor_delivery_adjudication_indeterminate';
      error.substantiveStudyFailure = true;
      error.measurementIndeterminate = true;
      error.recoverable = false;
      error.neverScored = true;
      throw error;
    }
    return { label, delivered, quote: delivered ? quote : null };
  }

  return { adjudicateFinalHorizon, adjudicatePrimaryPanel, adjudicateRivalDagBridgeStep, adjudicateTutorDelivery };
}

export default {
  buildTutorStubResistantLearnerFinalHorizonPacket,
  buildTutorStubResistantLearnerSemanticPrompt,
  createTutorStubResistantLearnerSemanticRuntime,
};
