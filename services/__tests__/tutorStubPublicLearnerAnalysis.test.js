import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { loadWorld } from '../dramaticDerivation/world.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  TutorStubPublicLearnerAnalysisError,
  analyzeTutorStubPublicLearnerTurn,
  buildTutorStubPublicLearnerAnalysisOutputSchema,
  buildTutorStubPublicLearnerAnalysisPrompt,
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
  buildTutorStubPublicLearnerAnalysisWorld,
  extractTutorStubPublicLearnerAnalysis,
  parseTutorStubPublicLearnerAnalysisInteractive,
  parseTutorStubPublicLearnerAnalysisStrict,
  postprocessTutorStubPublicLearnerAnalysis,
  splitTutorStubPublicLearnerAnalysis,
} from '../tutorStubPublicLearnerAnalysis.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function smokeWorld() {
  return loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml'));
}

function validAnalysis({ learnerRecord = {}, turn = {}, root = {} } = {}) {
  return {
    classification: {
      turn: {
        summary: 'The learner adopts one public clue.',
        request_type: 'stepwise_support_request',
        discourse_move: 'evidence_adoption',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'exploratory',
        affect: 'engaged',
        agency: 'attempting',
        scores: {
          conceptual_engagement: { score: 3, reason: 'Uses one relevant clue.' },
          epistemic_readiness: { score: 3, reason: 'Treats the conclusion as provisional.' },
        },
        pedagogical_need: 'Connect the clue to a public rule.',
        ...turn,
      },
      overall: {
        summary: 'The learner is beginning to use public evidence.',
        trajectory: 'early progress',
        recurring_pattern: 'none yet',
        current_state: 'one clue held',
        next_best_tutor_move: 'Ask for the next warranted link.',
      },
    },
    learner_record: {
      human_discourse: { proof_status: 'provisional_scaffold' },
      notes: 'One current public clue was used.',
      ...learnerRecord,
    },
    ...root,
  };
}

function providerCompleteAnalysis() {
  return validAnalysis({
    learnerRecord: {
      adopt: [],
      retract: [],
      derive: [],
      hypothesis: null,
      assert_answer: null,
      human_discourse: {
        proof_status: 'unclear',
        provisional_claims: [],
        implied_warrants: [],
        missing_warrants: [],
        implied_public_premises: [],
        suppressed_or_private_premises: [],
        common_sense_bridges: [],
        illicit_hidden_premises: [],
        proof_debt_candidates: [],
        side_arc: {
          detected: false,
          type: null,
          reason: null,
          return_target: null,
        },
      },
      notes: '',
    },
  });
}

const PROVIDER_SCHEMA_KEYWORDS = new Set([
  'type',
  'additionalProperties',
  'required',
  'properties',
  'enum',
  'items',
  'anyOf',
]);

function assertCodexProviderSchema(schema, path = '$') {
  assert.ok(schema && typeof schema === 'object' && !Array.isArray(schema), `${path} must be a schema object`);
  for (const key of Object.keys(schema)) {
    assert.ok(PROVIDER_SCHEMA_KEYWORDS.has(key), `${path} uses unsupported provider keyword ${key}`);
  }
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${path} must be closed`);
    assert.deepEqual(
      [...schema.required].sort(),
      Object.keys(schema.properties).sort(),
      `${path} must require every declared property`,
    );
    for (const [key, child] of Object.entries(schema.properties)) {
      assertCodexProviderSchema(child, `${path}.properties.${key}`);
    }
  }
  if (schema.items) assertCodexProviderSchema(schema.items, `${path}.items`);
  for (const [index, branch] of (schema.anyOf || []).entries()) {
    assertCodexProviderSchema(branch, `${path}.anyOf[${index}]`);
  }
}

function modelResponse(value, overrides = {}) {
  return {
    text: JSON.stringify(value),
    provider: 'codex',
    model: 'gpt-5.6-terra',
    latencyMs: 23,
    structuredOutput: true,
    modelAttestationBasis: 'explicit_cli_model_argument_accepted_bridge_echo',
    modelIndependentlyAttested: false,
    usage: { inputTokens: 101, outputTokens: 77, totalTokens: 178, cost: 0 },
    call_metadata: {
      attempt_count: 1,
      model_attestation_basis: 'fixture_bridge_echo',
      fixture_marker: 'preserve-verbatim',
    },
    ...overrides,
  };
}

describe('strict public learner analysis', () => {
  it('uses a separate recursively complete Codex-compatible provider schema', () => {
    const semantic = buildTutorStubPublicLearnerAnalysisOutputSchema();
    const provider = buildTutorStubPublicLearnerAnalysisProviderOutputSchema();
    const providerWithRegister = buildTutorStubPublicLearnerAnalysisProviderOutputSchema({
      includeRegisterSelection: true,
    });
    assert.notDeepEqual(provider, semantic);
    assertCodexProviderSchema(provider);
    assertCodexProviderSchema(providerWithRegister);
    assert.equal(Object.hasOwn(provider, '$schema'), false);
    assert.equal(Object.hasOwn(provider, 'title'), false);
  });

  it('uses complete-envelope instructions only for the strict provider prompt', () => {
    const world = buildTutorStubPublicLearnerAnalysisWorld(smokeWorld());
    const base = {
      learnerText: 'I am considering the public clue.',
      topic: 'inheritance reasoning',
      world,
      tutorTurn: 1,
      publicStagedEvidence: [],
    };
    const interactivePrompt = buildTutorStubPublicLearnerAnalysisPrompt(base);
    const strictPrompt = buildTutorStubPublicLearnerAnalysisPrompt({
      ...base,
      strictProviderEnvelope: true,
    });
    assert.match(interactivePrompt, /Return sparse JSON: omit empty arrays/u);
    assert.doesNotMatch(interactivePrompt, /Return every field required by the supplied provider schema/u);
    assert.match(strictPrompt, /Return every field required by the supplied provider schema/u);
    assert.match(strictPrompt, /empty arrays, null hypothesis\/assert_answer, an empty notes string/u);
    assert.doesNotMatch(strictPrompt, /Return sparse JSON: omit empty arrays/u);
  });

  it('rejects fences, aliases, extra keys, wrong types, and unknown predictive labels locally', () => {
    const valid = validAnalysis();
    assert.doesNotThrow(() => parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(valid)));
    assert.throws(
      () => parseTutorStubPublicLearnerAnalysisStrict(`\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``),
      (error) => error instanceof TutorStubPublicLearnerAnalysisError && error.code === 'invalid_analysis_json',
    );

    const alias = { ...valid };
    alias.learnerRecord = alias.learner_record;
    delete alias.learner_record;
    assert.throws(() => parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(alias)), /learner_record/u);

    assert.throws(
      () => parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(validAnalysis({ root: { surprise: true } }))),
      /unsupported key \$\.surprise/u,
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(validAnalysis({ turn: { request_type: 'invented_predictive_label' } })),
        ),
      (error) => error instanceof TutorStubPublicLearnerAnalysisError && error.code === 'invalid_analysis_enum',
    );
    assert.throws(() => {
      const wrong = validAnalysis();
      wrong.classification.turn.scores.conceptual_engagement.score = '3';
      parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(wrong));
    }, /requires a 1-5 score/u);
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(validAnalysis({ learnerRecord: { unexpected_record_key: true } })),
        ),
      /unsupported key \$\.learner_record\.unexpected_record_key/u,
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(validAnalysis({ learnerRecord: { human_discourse: { proof_status: 'almost_strict' } } })),
        ),
      /unknown \$\.learner_record\.human_discourse\.proof_status/u,
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(
            validAnalysis({
              learnerRecord: {
                human_discourse: { proof_status: 'unclear', hidden_guess: 'must not pass' },
              },
            }),
          ),
        ),
      /unsupported key \$\.learner_record\.human_discourse\.hidden_guess/u,
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(
            validAnalysis({
              learnerRecord: {
                human_discourse: {
                  proof_status: 'side_arc',
                  side_arc: {
                    detected: true,
                    type: 'invented_side_channel',
                    reason: 'test',
                    return_target: null,
                  },
                },
              },
            }),
          ),
        ),
      /unknown \$\.learner_record\.human_discourse\.side_arc\.type/u,
    );

    assert.doesNotThrow(() =>
      parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(providerCompleteAnalysis())),
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(validAnalysis({ turn: { summary: ' ' } })),
        ),
      /requires non-empty string \$\.classification\.turn\.summary/u,
    );
    assert.throws(() => {
      const outOfRange = validAnalysis();
      outOfRange.classification.turn.scores.epistemic_readiness.score = 6;
      parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(outOfRange));
    }, /requires a 1-5 score/u);
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(validAnalysis({ learnerRecord: { derive: [[]] } })),
        ),
      /requires fact arrays/u,
    );
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(
            validAnalysis({
              learnerRecord: {
                human_discourse: { proof_status: 'unclear', provisional_claims: [' '] },
              },
            }),
          ),
        ),
      /requires non-empty \$\.learner_record\.human_discourse\.provisional_claims\[0\]/u,
    );
  });

  it('adds an opt-in four-family benchmark transition with an exact current-turn evidence span', () => {
    const learnerTurns = {
      retract: 'I withdraw my earlier guess.',
      derive: 'So the supported answer is Marin.',
      adopt: 'I can use the public mark as evidence.',
      none: 'Could you restate the question?',
    };
    const providerSchema = buildTutorStubPublicLearnerAnalysisProviderOutputSchema({
      includeBenchmarkTransitionEvent: true,
    });
    assert.deepEqual(providerSchema.properties.benchmark_transition.properties.family.enum, [
      'retract',
      'derive',
      'adopt',
      'none',
    ]);
    for (const [family, learnerText] of Object.entries(learnerTurns)) {
      const analysis = validAnalysis({
        root: { benchmark_transition: { family, evidence_span: learnerText } },
      });
      assert.doesNotThrow(() =>
        parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(analysis), {
          includeBenchmarkTransitionEvent: true,
          benchmarkLearnerText: learnerText,
        }),
      );
    }
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(
          JSON.stringify(
            validAnalysis({
              root: { benchmark_transition: { family: 'derive', evidence_span: 'not in the turn' } },
            }),
          ),
          {
            includeBenchmarkTransitionEvent: true,
            benchmarkLearnerText: learnerTurns.derive,
          },
        ),
      /not an exact learner-turn substring/u,
    );
    const prompt = buildTutorStubPublicLearnerAnalysisPrompt({
      learnerText: learnerTurns.adopt,
      topic: 'inheritance reasoning',
      world: smokeWorld(),
      tutorTurn: 2,
      includeBenchmarkTransitionEvent: true,
      priorPublicLearnerState: {
        adopted_premise_ids: ['p3'],
        voiced_derived_facts: [],
        prior_hypotheses: ['Marin may be the heir.'],
        asserted_answers: [],
      },
    });
    assert.match(prompt, /Prior redacted public learner state/u);
    assert.match(prompt, /Reusing an already-held premise is none/u);
    assert.match(prompt, /pure epistemic-status statement.*not a derived world fact/iu);
    assert.match(prompt, /evidence is insufficient.*answer remains unknown.*cannot yet determine.*is none/iu);
    assert.match(prompt, /unless it also voices a substantive new object-level world conclusion or direct answer/iu);
    assert.match(prompt, /previously voiced hypothesis/u);
    assert.match(prompt, /retract, then derive, then adopt, then none/u);

    const duplicateUse = validAnalysis({
      learnerRecord: { adopt: ['p3'] },
      root: {
        benchmark_transition: {
          family: 'none',
          evidence_span: 'I can use the public mark as evidence.',
        },
      },
    });
    const duplicateSplit = splitTutorStubPublicLearnerAnalysis(duplicateUse, {
      strict: true,
      includeBenchmarkTransitionEvent: true,
    });
    assert.deepEqual(duplicateSplit.learnerRecordUpdate.adopt, ['p3']);
    assert.equal(duplicateSplit.benchmarkTransitionEvent.family, 'none');

    const multiEvent = validAnalysis({
      learnerRecord: { adopt: ['p4'], derive: [['heir', 'marin']] },
      root: {
        benchmark_transition: {
          family: 'derive',
          evidence_span: 'I use the seal, so Marin is the heir.',
        },
      },
    });
    const multiSplit = splitTutorStubPublicLearnerAnalysis(multiEvent, {
      strict: true,
      includeBenchmarkTransitionEvent: true,
    });
    assert.deepEqual(multiSplit.learnerRecordUpdate.adopt, ['p4']);
    assert.deepEqual(multiSplit.learnerRecordUpdate.derive, [['heir', 'marin']]);
    assert.equal(multiSplit.benchmarkTransitionEvent.family, 'derive');

    const unsupportedHypothesisRetraction = validAnalysis({
      learnerRecord: { retract: [] },
      root: {
        benchmark_transition: {
          family: 'retract',
          evidence_span: 'I withdraw my earlier guess.',
        },
      },
    });
    const retractionSplit = splitTutorStubPublicLearnerAnalysis(unsupportedHypothesisRetraction, {
      strict: true,
      includeBenchmarkTransitionEvent: true,
    });
    assert.deepEqual(retractionSplit.learnerRecordUpdate.retract, []);
    assert.equal(retractionSplit.benchmarkTransitionEvent.family, 'retract');
  });

  it('pins one structured call while preserving exact input, output, hashes, and bridge metadata', async () => {
    const world = smokeWorld();
    let request = null;
    const raw = await extractTutorStubPublicLearnerAnalysis({
      learnerText: 'I will use the mark as evidence.',
      topic: 'inheritance reasoning',
      world,
      tutorTurn: 1,
      publicStagedEvidence: [
        {
          premise: 'p3',
          turn: 1,
          via: 'kernel_public_projection',
          surface: 'The mark is public.',
          fact: ['bearsMark', 'marin'],
        },
      ],
      callModel: async (value) => {
        request = value;
        return modelResponse(validAnalysis({ learnerRecord: { adopt: ['p3'] } }));
      },
      role: 'caller_must_not_override_strict_role',
      modelCallOptions: {
        outputSchema: { forbidden: true },
        effort: 'high',
        timeoutMs: 1,
        requestedProvider: 'codex',
        requestedModel: 'gpt-5.6-terra',
        resolved: { provider: 'codex', model: 'gpt-5.6-terra' },
      },
    });

    assert.equal(request.role, 'tutor_stub_public_learner_analysis');
    assert.equal(request.effort, 'low');
    assert.equal(request.timeoutMs, 300000);
    assertCodexProviderSchema(request.outputSchema);
    assert.equal(request.outputSchema.title, undefined);
    assert.equal(request.outputSchema.forbidden, undefined);
    assert.match(request.prompt, /Return every field required by the supplied provider schema/u);
    assert.equal(raw.prompt, request.prompt);
    assert.equal(raw.systemPrompt, request.systemPrompt);
    assert.deepEqual(raw.outputSchema, request.outputSchema);
    assert.equal(raw.rawText, JSON.stringify(validAnalysis({ learnerRecord: { adopt: ['p3'] } })));
    assert.equal(raw.callMetadata.attemptCount, 1);
    assert.equal(raw.callMetadata.fallbackUsed, false);
    assert.equal(raw.callMetadata.effort, 'low');
    assert.equal(raw.callMetadata.timeoutMs, 300000);
    assert.equal(raw.callMetadata.returned.provider, 'codex');
    assert.equal(raw.callMetadata.returned.model, 'gpt-5.6-terra');
    assert.equal(raw.callMetadata.injectedCallMetadata.fixture_marker, 'preserve-verbatim');
    assert.match(raw.callMetadata.hashes.inputSha256, /^[a-f0-9]{64}$/u);
    assert.match(raw.callMetadata.hashes.rawOutputSha256, /^[a-f0-9]{64}$/u);
    assert.match(raw.callMetadata.hashes.parsedOutputSha256, /^[a-f0-9]{64}$/u);
    assert.equal(raw.call_metadata.status, 'success');
    assert.equal(raw.call_metadata.requested_model_ref, 'gpt-5.6-terra');
    assert.equal(raw.call_metadata.resolved_model_ref, 'codex/gpt-5.6-terra');
    assert.equal(raw.call_metadata.observed_model_ref, 'codex/gpt-5.6-terra');
    assert.equal(raw.call_metadata.model_attestation_basis, 'explicit_cli_model_argument_accepted_bridge_echo');
    assert.equal(raw.call_metadata.structured_output_reported, true);
    assert.equal(raw.call_metadata.dispatch_count, 1);
    assert.equal(raw.call_metadata.attempts, 1);
  });

  it('rejects retries, fallback, and multi-attempt call provenance explicitly', async () => {
    const base = {
      learnerText: 'One public turn.',
      topic: 'test',
      world: smokeWorld(),
      tutorTurn: 1,
      callModel: async () => modelResponse(validAnalysis()),
    };
    await assert.rejects(
      extractTutorStubPublicLearnerAnalysis({ ...base, modelCallOptions: { retries: 1 } }),
      (error) => {
        assert.equal(error.code, 'invalid_strict_call_contract');
        assert.equal(error.callMetadata.status, 'technical_failure');
        assert.equal(error.callMetadata.dispatch_count, 0);
        assert.match(error.callMetadata.system_prompt_sha256, /^[a-f0-9]{64}$/u);
        assert.match(error.callMetadata.prompt_sha256, /^[a-f0-9]{64}$/u);
        return true;
      },
    );
    await assert.rejects(
      extractTutorStubPublicLearnerAnalysis({
        ...base,
        callModel: async () =>
          modelResponse(validAnalysis(), { call_metadata: { attempt_count: 2, fallback_used: false } }),
      }),
      (error) => error.code === 'invalid_strict_call_provenance',
    );

    const malformed = '{"classification":';
    await assert.rejects(
      extractTutorStubPublicLearnerAnalysis({
        ...base,
        callModel: async () =>
          modelResponse(validAnalysis(), {
            text: malformed,
            structuredOutput: true,
          }),
      }),
      (error) => {
        assert.equal(error.code, 'invalid_analysis_json');
        assert.equal(error.callMetadata.status, 'technical_failure');
        assert.equal(error.callMetadata.dispatch_count, 1);
        assert.equal(error.callMetadata.raw_output_sha256.length, 64);
        assert.equal(error.callMetadata.parsed_output_sha256, null);
        assert.equal(error.raw_output, malformed);
        return true;
      },
    );
  });
});

describe('public evidence boundary and exact DAG postprocessor', () => {
  it('keeps authored task-key state out of extraction and admits it only to deterministic postprocessing', async () => {
    const world = smokeWorld();
    const p3 = world.premiseById.get('p3');
    const currentPublicEvidence = [
      {
        premise: 'p3',
        turn: 1,
        via: 'kernel_public_projection',
        surface: p3.surface,
        fact: p3.fact,
      },
    ];
    const publicWorld = buildTutorStubPublicLearnerAnalysisWorld(world);
    assert.deepEqual(Object.keys(publicWorld).sort(), ['discipline', 'id', 'question', 'rules', 'setting', 'title']);
    for (const privateField of [
      'secret',
      'proofPaths',
      'background',
      'premises',
      'premiseById',
      'releaseSchedule',
      'questionPattern',
    ]) {
      assert.equal(Object.hasOwn(publicWorld, privateField), false, `${privateField} crossed public-world boundary`);
    }
    assert.notEqual(publicWorld.rules, world.rules);

    let modelRequest = null;
    const rawAnalysis = await extractTutorStubPublicLearnerAnalysis({
      learnerText: 'I can use the public mark clue.',
      topic: 'inheritance reasoning',
      world,
      tutorTurn: 1,
      currentTutorText: 'Which public clue can you use?',
      publicStagedEvidence: currentPublicEvidence,
      callModel: async (request) => {
        modelRequest = request;
        return modelResponse(validAnalysis({ learnerRecord: { adopt: ['p3'] } }));
      },
    });

    for (const privateField of [
      'world',
      'learnerRecord',
      'dropout',
      'previousObservation',
      'previousTurnRecords',
      'publicReleaseLedger',
    ]) {
      assert.equal(Object.hasOwn(modelRequest, privateField), false, `${privateField} reached model caller`);
    }
    assert.match(modelRequest.prompt, /Marin bears the mark of the house/u);
    assert.doesNotMatch(modelRequest.prompt, /Marin is the rightful heir of House Aldra/u);
    assert.doesNotMatch(modelRequest.prompt, /Marin is Tessa's child/u);
    assert.doesNotMatch(modelRequest.prompt, /proof_paths|release_schedule|\["heir","marin"\]/u);
    assert.equal(rawAnalysis.provenance.public_world_projection, true);
    assert.equal(rawAnalysis.provenance.deterministic_task_key_postprocessor, false);

    const result = postprocessTutorStubPublicLearnerAnalysis({
      rawAnalysis,
      learnerText: 'I can use the public mark clue.',
      world,
      tutorTurn: 1,
      publicStagedEvidence: currentPublicEvidence,
      publicReleaseLedger: currentPublicEvidence,
    });
    assert.deepEqual(result.tutorLearnerDag.accepted.adopt, ['p3']);
    assert.equal(result.tutorLearnerDag.model.assessment.bestPathCoverage, 0.333);
    assert.equal(result.stateObservation.dag.best_path_coverage, 0.333);
    assert.equal(result.provenance.deterministic_task_key_postprocessor, true);
    assert.equal(result.rawAnalysis, rawAnalysis);

    let forbiddenDispatch = false;
    await assert.rejects(
      extractTutorStubPublicLearnerAnalysis({
        learnerText: 'I can use the public mark clue.',
        topic: 'inheritance reasoning',
        world,
        tutorTurn: 1,
        publicStagedEvidence: currentPublicEvidence,
        modelCallOptions: { previousObservation: result.stateObservation },
        callModel: async () => {
          forbiddenDispatch = true;
          return modelResponse(validAnalysis());
        },
      }),
      (error) => {
        assert.equal(error.code, 'postprocessor_input_crossed_public_boundary');
        assert.equal(error.callMetadata.dispatch_count, 0);
        return true;
      },
    );
    assert.equal(forbiddenDispatch, false);
  });

  it('uses only the explicit current public projection while retaining exact deterministic task-key assessment', async () => {
    const world = smokeWorld();
    const p3 = world.premiseById.get('p3');
    const currentPublicEvidence = [
      {
        premise: 'p3',
        turn: 1,
        via: 'kernel_public_projection',
        surface: p3.surface,
        fact: p3.fact,
      },
    ];
    let modelInput = null;
    const result = await analyzeTutorStubPublicLearnerTurn({
      learnerText: 'The public mark clue is relevant, but I still need the family link.',
      topic: 'inheritance reasoning',
      world,
      tutorTurn: 1,
      publicTranscript: [],
      currentTutorText: 'Which currently public mark can you use without naming an heir?',
      publicStagedEvidence: currentPublicEvidence,
      publicReleaseLedger: currentPublicEvidence,
      callModel: async (request) => {
        modelInput = `${request.systemPrompt}\n${request.prompt}`;
        return modelResponse(
          validAnalysis({
            learnerRecord: {
              adopt: ['p3', 'p1'],
              hypothesis: 'The marked person may be the heir after the lineage link is shown.',
            },
          }),
        );
      },
      modelCallOptions: {
        requestedProvider: 'codex',
        requestedModel: 'gpt-5.6-terra',
        resolved: { provider: 'codex', model: 'gpt-5.6-terra' },
      },
    });

    assert.match(modelInput, /p3 \(staged turn 1 via kernel_public_projection\)/u);
    assert.match(modelInput, /Marin bears the mark of the house/u);
    assert.match(modelInput, /Which currently public mark can you use without naming an heir\?/u);
    assert.doesNotMatch(modelInput, /Marin is the rightful heir of House Aldra/u);
    assert.doesNotMatch(modelInput, /proof_paths|path_1|\["heir","marin"\]/u);
    assert.doesNotMatch(modelInput, /p1 \(staged turn/u);
    assert.deepEqual(result.tutorLearnerDag.accepted.adopt, ['p3']);
    assert.deepEqual(result.tutorLearnerDag.rejected, [{ type: 'adopt', value: 'p1', reason: 'not staged' }]);
    assert.equal(result.tutorLearnerDag.model.assessment.bestPathCoverage, 0.333);
    assert.equal(result.stateObservation.dag.best_path_coverage, 0.333);
    assert.equal(result.turnRecord.tutorLearnerDagUpdate.accepted.adopt[0], 'p3');
    assert.equal(result.provenance.model_input_public_only, true);
    assert.equal(result.provenance.deterministic_task_key_postprocessor, true);
    assert.equal(result.rawAnalysis.provenance.deterministic_task_key_postprocessor, false);

    await assert.rejects(
      analyzeTutorStubPublicLearnerTurn({
        learnerText: 'The same public mark clue.',
        topic: 'inheritance reasoning',
        world,
        tutorTurn: 1,
        publicStagedEvidence: currentPublicEvidence,
        publicReleaseLedger: [{ premiseId: 'p3', turn: 1, via: 'legacy_reduced_row' }],
        callModel: async () => modelResponse(validAnalysis({ learnerRecord: { adopt: ['p3'] } })),
      }),
      (error) => {
        assert.equal(error.code, 'invalid_public_staged_evidence');
        assert.equal(error.callMetadata.status, 'technical_failure');
        assert.equal(error.callMetadata.dispatch_count, 1);
        assert.equal(typeof error.raw_output, 'string');
        return true;
      },
    );
  });
});

describe('interactive public learner analysis parser', () => {
  it('retains bounded fence extraction, delimiter repair, and fallback behavior', () => {
    const fenced = parseTutorStubPublicLearnerAnalysisInteractive(
      `\`\`\`json\n${JSON.stringify(validAnalysis())}\n\`\`\``,
    );
    assert.equal(fenced.parseError, null);
    assert.ok(fenced.parsed.classification);

    const repaired = parseTutorStubPublicLearnerAnalysisInteractive(
      '{"classification":{"turn":{"summary":"short"},"overall":{"summary":"overall"}},"learner_record":{}',
    );
    assert.equal(repaired.parseError, null);
    assert.ok(repaired.parsed.learner_record);

    const fallback = parseTutorStubPublicLearnerAnalysisInteractive('not JSON');
    assert.equal(fallback.parseError, 'Classifier output was not parseable JSON.');
    assert.equal(fallback.parsed.turn.request_type, 'off_task_or_mixed');
  });

  it('is selected only when explicitly requested', async () => {
    let request = null;
    const raw = await extractTutorStubPublicLearnerAnalysis({
      learnerText: 'A turn.',
      topic: 'test',
      world: smokeWorld(),
      tutorTurn: 1,
      parseMode: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.INTERACTIVE,
      callModel: async (value) => {
        request = value;
        return { text: 'not JSON', provider: 'fixture', model: 'fixture' };
      },
    });
    assert.equal(Object.hasOwn(request, 'outputSchema'), false);
    assert.match(request.prompt, /Return sparse JSON: omit empty arrays/u);
    assert.doesNotMatch(request.prompt, /Return every field required by the supplied provider schema/u);
    assert.equal(raw.parseError, 'Classifier output was not parseable JSON.');
    assert.equal(raw.parsed.turn.request_type, 'off_task_or_mixed');
  });

  it('retains the tolerant fallback through the composed extractor and deterministic postprocessor', async () => {
    const result = await analyzeTutorStubPublicLearnerTurn({
      learnerText: 'I am not sure yet.',
      topic: 'inheritance reasoning',
      world: smokeWorld(),
      tutorTurn: 1,
      parseMode: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES.INTERACTIVE,
      callModel: async () => ({ text: 'not JSON', provider: 'fixture', model: 'fixture' }),
    });
    assert.equal(result.rawAnalysis.parseError, 'Classifier output was not parseable JSON.');
    assert.equal(result.classification.turn.request_type, 'off_task_or_mixed');
    assert.ok(result.tutorLearnerDag.model);
    assert.equal(result.stateObservation.turn, 1);
  });
});
