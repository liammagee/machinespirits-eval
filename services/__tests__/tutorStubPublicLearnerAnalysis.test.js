import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { loadWorld } from '../dramaticDerivation/world.js';
import { tutorStubLearnerDagGrounded } from '../tutorStubDialogueClosure.js';
import {
  TUTOR_STUB_EVIDENCE_USE_RUBRICS,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT,
  TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PARSE_MODES,
  TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA,
  TutorStubPublicLearnerAnalysisError,
  analyzeTutorStubPublicLearnerTurn,
  applyTutorStubPublicLearnerRecordUpdate,
  buildTutorStubLearnerDagPreflight,
  buildTutorStubPublicLearnerAnalysisOutputSchema,
  buildTutorStubPublicLearnerAnalysisPrompt,
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
  buildTutorStubPublicLearnerAnalysisWorld,
  createTutorStubPublicLearnerRecord,
  extractTutorStubPublicLearnerAnalysis,
  normalizeTutorStubClassificationAgainstLearnerSurface,
  normalizeTutorStubEvidenceUseRubric,
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

describe('surface-consistent classification', () => {
  it('does not turn a declarative inference into a clarification request', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'conceptual_clarity_request',
        discourse_move: 'inference',
        epistemic_stance: 'grounded',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'It establishes that any blank proven from that crucible was cast by Verrell’s hand.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
    assert.equal(classification.turn.request_type, 'conceptual_clarity_request');
  });

  it('preserves an actual clarification question', () => {
    const classification = validAnalysis({
      turn: { request_type: 'conceptual_clarity_request', discourse_move: 'question' },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(classification, 'What does blank mean?');

    assert.equal(normalized.turn.request_type, 'conceptual_clarity_request');
  });

  it('does not retain off-task for a grounded public inference', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'inference',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'grounded',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'It must show the light shillings bear the same metal as Verrell’s crucible casting.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
  });

  it('does not mistake evidentiary restraint for a challenge to tutor authority', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'metacognitive_reflection',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'reflective',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'Then I should enter no verdict yet: the shilling’s alloy must first be matched to a crucible.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
  });

  it('preserves an explicit challenge to interactional pressure', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'authority_refusal_or_status_challenge',
        discourse_move: 'challenge',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'I am not sure why you are pressing that. Give me one smaller step.',
    );

    assert.equal(normalized.turn.request_type, 'authority_refusal_or_status_challenge');
  });

  it('does not retain off-task for evidence-aware reflection on a clue limit', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'off_task_or_mixed',
        discourse_move: 'metacognitive_reflection',
        evidence_use: 'cites_public_evidence',
        epistemic_stance: 'reflective',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'It points toward Verrell’s access to casting, but it does not yet prove he made these particular shillings.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
  });

  it('does not mistake a bounded supported conclusion for answer seeking or overreach', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'answer_seeking_or_overreach',
        discourse_move: 'evidence_adoption',
        evidence_use: 'links_evidence_to_rule',
        epistemic_stance: 'grounded',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'It rules out mere clipping: these are newly struck, copper-thinned coins, not sterling shillings shaved lighter.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
  });

  it('does not mistake waiting for named evidence for resistance or low agency', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'metacognitive_reflection',
        evidence_use: 'repeats_setup',
        epistemic_stance: 'reflective',
        agency: 'steering',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'Then I shall hold the verdict back and await what balance and touchstone show.',
    );

    assert.equal(normalized.turn.request_type, 'stepwise_support_request');
  });

  it('preserves visible resistance even when the learner asks to wait', () => {
    const classification = validAnalysis({
      turn: {
        request_type: 'resistance_or_low_agency',
        discourse_move: 'affective_signal',
        evidence_use: 'none',
        epistemic_stance: 'resistant',
      },
    }).classification;
    const normalized = normalizeTutorStubClassificationAgainstLearnerSurface(
      classification,
      'You are pressing me. I will wait for a smaller step.',
    );

    assert.equal(normalized.turn.request_type, 'resistance_or_low_agency');
  });
});

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

describe('evidence_use rubric versioning', () => {
  const promptFor = (evidenceUseRubric) =>
    buildTutorStubPublicLearnerAnalysisPrompt({
      learnerText: 'I enter the verdict: Edony struck the false shillings.',
      topic: 'evidence reasoning',
      world: buildTutorStubPublicLearnerAnalysisWorld(smokeWorld()),
      tutorTurn: 1,
      publicStagedEvidence: [],
      ...(evidenceUseRubric === undefined ? {} : { evidenceUseRubric }),
    });

  // New runs measure the construct we can state, so the default is v2. An
  // omitted argument and an explicit v2 must agree.
  it('defaults to v2_bridge_voiced', () => {
    assert.equal(TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
    const omitted = promptFor(undefined);
    assert.equal(omitted, promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED));
    assert.match(omitted, /a bridge is voiced when/u);
  });

  // Flipping the default is only safe if the old instrument stays exactly
  // reproducible, since the published Phase 5/5b/5c figures were measured under
  // it. This pins v1's single precedence line byte-for-byte: the archive's 2,363
  // stored prompts each contain this exact string once, and the relabel tool
  // finds them by matching it.
  it('keeps v1 exactly reproducible by name', () => {
    const v1 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
    assert.equal(TUTOR_STUB_EVIDENCE_USE_RUBRIC_LEGACY, TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
    assert.ok(
      v1.includes(
        '- evidence precedence: distorted/misattributed public clue => distorts_public_evidence; correct clue plus conclusion but no bridge => omits_warrant; conclusion beyond available evidence => overleaps_evidence; explicit bridge => links_evidence_to_rule.',
      ),
      'v1 precedence line drifted; the archive relabel tool matches it verbatim',
    );
    assert.doesNotMatch(v1, /a bridge is voiced when/u);
  });

  it('v2 defines the bridge in both directions', () => {
    const v2 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
    // Direction 1: a bare conclusion is omits_warrant even when the record supports it.
    assert.match(v2, /conclusion whose bridge is not voiced in this turn => omits_warrant/u);
    assert.match(v2, /judge the bridge from this turn's words alone/u);
    // Direction 2: an acknowledged gap does not cancel a voiced bridge.
    assert.match(v2, /voicing a bridge and also naming what is still unproven is links_evidence_to_rule/u);
    assert.match(v2, /a bridge is voiced when this turn names the specific public evidence/u);
    assert.doesNotMatch(v2, /correct clue plus conclusion but no bridge => omits_warrant/u);
  });

  // The two neighbouring labels are byte-identical across versions, which bounds
  // the edit to the clause it claims to touch. Only `distorts_public_evidence` is
  // a clean control, though: `overleaps_evidence` is the second label that fires
  // `warrant_skip` (see tutorStubPointOfActionCoaching.js), and because the labels
  // are one mutually-exclusive choice, redefining the `omits_warrant` boundary can
  // move mass across it. Byte-identity says the wording did not change; it does
  // not say the label's rate cannot.
  it('leaves the neighbouring evidence labels byte-identical across versions', () => {
    for (const clause of [
      'distorted/misattributed public clue => distorts_public_evidence',
      'conclusion beyond available evidence => overleaps_evidence',
    ]) {
      assert.ok(promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1).includes(clause), `v1 missing: ${clause}`);
      assert.ok(promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED).includes(clause), `v2 missing: ${clause}`);
    }
  });

  it('rejects an unknown rubric version instead of silently falling back', () => {
    assert.equal(normalizeTutorStubEvidenceUseRubric(), TUTOR_STUB_EVIDENCE_USE_RUBRIC_DEFAULT);
    assert.equal(normalizeTutorStubEvidenceUseRubric(' V2_Bridge_Voiced '), 'v2_bridge_voiced');
    for (const bad of ['v3', 'bridge', 'v2-bridge-voiced']) {
      assert.throws(
        () => normalizeTutorStubEvidenceUseRubric(bad),
        (error) => error instanceof TutorStubPublicLearnerAnalysisError && error.code === 'invalid_evidence_use_rubric',
        `expected ${bad} to be rejected`,
      );
    }
    assert.throws(() => promptFor('v3'), TutorStubPublicLearnerAnalysisError);
  });
});

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

    assert.doesNotThrow(() => parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(providerCompleteAnalysis())));
    assert.throws(
      () => parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(validAnalysis({ turn: { summary: ' ' } }))),
      /requires non-empty string \$\.classification\.turn\.summary/u,
    );
    assert.throws(() => {
      const outOfRange = validAnalysis();
      outOfRange.classification.turn.scores.epistemic_readiness.score = 6;
      parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(outOfRange));
    }, /requires a 1-5 score/u);
    assert.throws(
      () =>
        parseTutorStubPublicLearnerAnalysisStrict(JSON.stringify(validAnalysis({ learnerRecord: { derive: [[]] } }))),
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
    assert.match(
      prompt,
      /Evaluate multi-clause turns clause by clause.*Retain every new supported object-level conclusion/iu,
    );
    assert.match(prompt, /record the later gap as a missing warrant or proof-debt candidate/iu);
    assert.match(prompt, /supported intermediate conclusion counts as derive.*does not identify the final answer/iu);
    assert.match(prompt, /Assess clauses independently.*do not downgrade the supported derive to none/iu);
    assert.match(prompt, /Merely announcing that an inference or conclusion exists.*is none, not derive/iu);
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
  it('maps a sentence-form answer onto the uniquely entailed public answer fact', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-024-emberwick-forum.yaml'));
    const record = createTutorStubPublicLearnerRecord(world);
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 9,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        derive: [world.secret.fact],
        assert_answer: 'The evidence establishes that bramblewasp ran the sock-puppet brigade.',
      },
      world,
      record,
      tutorTurn: 9,
      learnerText: 'The evidence establishes that bramblewasp ran the sock-puppet brigade.',
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.deepEqual(result.model.assessment.finalSecretEntailed, true);
    assert.deepEqual(result.model.assessment.assertedSecret, true);
    assert.equal(result.model.assessment.unsupportedAssertionCount, 0);
    assert.equal(result.model.assessment.bottleneck, 'grounded_asserted_secret');
  });

  it('treats an accepted voiced final derivation as the learner assertion when the analyzer omits assert_answer', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-022-foxtrot-jukebox.yaml'));
    const record = createTutorStubPublicLearnerRecord(world);
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 6,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const learnerText =
      'Moth’s signed wipe pulse, rail docking, and active override key settle it: Moth wiped the core.';
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        derive: [world.secret.fact],
        assert_answer: null,
      },
      world,
      record,
      tutorTurn: 6,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.equal(result.accepted.assertAnswer, learnerText);
    assert.equal(result.model.assessment.finalSecretEntailed, true);
    assert.equal(result.model.assessment.assertedSecret, true);
    assert.equal(result.model.assessment.bottleneck, 'grounded_asserted_secret');
  });

  it('recognises a possessive-form answer as the asserted secret', () => {
    // Regression: every dialogue in the phase-5e pilot ran to its 40-turn
    // safety cap on this world. Learners named the answer plainly and
    // repeatedly, but `pipersGullet` normalised to "pipers gullet" while
    // "Piper's Gullet" normalised to "piper s gullet", so no assertion ever
    // registered, assertedSecret stayed false, and the closure frame never
    // became mandatory. Both apostrophe glyphs below appear in the sealed
    // traces, as does the double genitive.
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 9,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));

    for (const phrase of [
      "Piper's Gullet",
      'Piper’s Gullet',
      "Piper's Gullet's bolted shutter causes the cold loaves.",
      'Piper’s Gullet’s shutter caused the loaves to arrive cold, not Tibbin.',
    ]) {
      const result = applyTutorStubPublicLearnerRecordUpdate({
        update: {
          adopt: world.proofPaths[0].premises,
          derive: [world.secret.fact],
          assert_answer: phrase,
        },
        world,
        record: createTutorStubPublicLearnerRecord(world),
        tutorTurn: 9,
        learnerText: phrase,
        publicStagedEvidence: publicEvidence,
        publicReleaseLedger: publicEvidence,
      });

      assert.equal(result.model.assessment.finalSecretEntailed, true, phrase);
      assert.equal(result.model.assessment.assertedSecret, true, phrase);
      assert.equal(result.model.assessment.unsupportedAssertionCount, 0, phrase);
      assert.equal(result.model.assessment.bottleneck, 'grounded_asserted_secret', phrase);
      assert.equal(tutorStubLearnerDagGrounded(result.model), true, phrase);
    }
  });

  it('uses an authored public clause to adopt the missed Skyway sole-lift premise', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const record = createTutorStubPublicLearnerRecord(world);
    const bolt = world.premiseById.get('p_bolt');
    record.board.set(JSON.stringify(bolt.fact), bolt.fact);
    const stagedIds = ['p_hired', 'p_bolt', 'p_soleLift'];
    const publicEvidence = stagedIds.map((premiseId) => {
      const premise = world.premiseById.get(premiseId);
      return { premise: premiseId, turn: 6, via: 'fixture', surface: premise.surface, fact: premise.fact };
    });
    const learnerText =
      'On windless mornings, every east-terrace glider depends on Piper’s Gullet, leaving the bolted shutter responsible for the cold loaves.';
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: { adopt: [], retract: [], derive: [], hypothesis: null, assert_answer: null },
      world,
      record,
      tutorTurn: 6,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.deepEqual(result.accepted.adopt, ['p_soleLift']);
    assert.deepEqual(result.accepted.authoredRecognition.adoptedPremises, ['p_soleLift']);
    assert.match(result.accepted.authoredRecognition.premiseSurfaces.p_soleLift, /every east-terrace glider/u);
    assert.equal(result.model.assessment.bestPathCoverage, 0.5);
  });

  it('recognises an authored causal answer after entailment even when the extractor omits its answer signal', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 11,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const learnerText =
      'Ledger: on windless mornings the bolted shutter forces a twice-long delivery, so warm loaves cool before reaching the east terrace.';
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        retract: [],
        derive: [world.secret.fact],
        hypothesis: null,
        assert_answer: 'The bolted shutter causes a long delay that cools the warm loaves.',
      },
      world,
      record: createTutorStubPublicLearnerRecord(world),
      tutorTurn: 11,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.equal(result.model.assessment.finalSecretEntailed, true);
    assert.equal(result.model.assessment.assertedSecret, true);
    assert.equal(result.model.assessment.bottleneck, 'grounded_asserted_secret');
    assert.match(result.accepted.authoredRecognition.assertedSurface, /twice-long delivery/u);

    const unSignalled = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        retract: [],
        derive: [],
        hypothesis: null,
        assert_answer: null,
      },
      world,
      record: createTutorStubPublicLearnerRecord(world),
      tutorTurn: 11,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });
    assert.equal(unSignalled.model.assessment.finalSecretEntailed, true);
    assert.equal(unSignalled.model.assessment.assertedSecret, true);
    assert.match(unSignalled.accepted.authoredRecognition.assertedSurface, /twice-long delivery/u);

    const prematureEvidence = publicEvidence
      .filter((row) => row.premise === 'p_bolt')
      .map((row) => ({ ...row, turn: 4 }));
    const premature = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: ['p_bolt'],
        retract: [],
        derive: [world.secret.fact],
        hypothesis: null,
        assert_answer: 'The bolted shutter causes a long delay that cools the warm loaves.',
      },
      world,
      record: createTutorStubPublicLearnerRecord(world),
      tutorTurn: 4,
      learnerText,
      publicStagedEvidence: prematureEvidence,
      publicReleaseLedger: prematureEvidence,
    });
    assert.equal(premature.model.assessment.finalSecretEntailed, false);
    assert.equal(premature.model.assessment.assertedSecret, false);
    assert.equal(premature.accepted.authoredRecognition.assertedSurface, null);
  });

  it('recognises the live A2 answer paraphrases through an authored, negation-aware pattern', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 18,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const apply = (learnerText) =>
      applyTutorStubPublicLearnerRecordUpdate({
        update: {
          adopt: world.proofPaths[0].premises,
          retract: [],
          derive: [],
          hypothesis: null,
          assert_answer: null,
        },
        world,
        record: createTutorStubPublicLearnerRecord(world),
        tutorTurn: 18,
        learnerText,
        publicStagedEvidence: publicEvidence,
        publicReleaseLedger: publicEvidence,
      });

    for (const learnerText of [
      'The bolted shutter blocks the only eastward lift in still air, forcing a long detour that cools loaves launched warm.',
      'The delivery ledger names the bolted shutter over Piper’s Gullet as responsible for the cold east-terrace loaves.',
      'The ledger records Tibbin cleared and the bolted shutter as the cause of the cold loaves.',
    ]) {
      const result = apply(learnerText);
      assert.equal(result.model.assessment.finalSecretEntailed, true, learnerText);
      assert.equal(result.model.assessment.assertedSecret, true, learnerText);
      assert.equal(result.model.assessment.bottleneck, 'grounded_asserted_secret', learnerText);
      assert.match(result.accepted.authoredRecognition.assertedPattern, /^shutter_/u, learnerText);
      assert.equal(result.accepted.authoredRecognition.assertedPatternAlternatives.length, 4, learnerText);
    }

    const denial = apply('The bolted shutter is not responsible for the cold loaves.');
    assert.equal(denial.model.assessment.finalSecretEntailed, true);
    assert.equal(denial.model.assessment.assertedSecret, false);
    assert.equal(denial.accepted.authoredRecognition.assertedPattern, null);
  });

  it('records a bare wrong name as a mirror assertion rather than a grounded close', () => {
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 9,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        derive: [world.secret.fact],
        assert_answer: 'Tibbin',
      },
      world,
      record: createTutorStubPublicLearnerRecord(world),
      tutorTurn: 9,
      learnerText: 'Tibbin',
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.equal(result.model.assessment.assertedSecret, false);
    assert.equal(result.model.assessment.assertedMirror, true);
    assert.equal(result.model.assessment.unsupportedAssertionCount, 1);
    assert.equal(tutorStubLearnerDagGrounded(result.model), false);
  });

  it('rejects an unresolvable answer claim instead of minting a phantom fact', () => {
    // Minting a constant from a whole sentence invented a fact no rule could
    // support, which was then counted as an unsupported assertion and could
    // push the dialogue to a false premature_assertion verdict.
    const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
    const publicEvidence = world.premises.map((premise) => ({
      premise: premise.id,
      turn: 9,
      via: 'fixture',
      surface: premise.surface,
      fact: premise.fact,
    }));
    const claim = 'The loaves cool after launch, not in Tibbin’s baking.';
    const result = applyTutorStubPublicLearnerRecordUpdate({
      update: {
        adopt: world.proofPaths[0].premises,
        derive: [world.secret.fact],
        assert_answer: claim,
      },
      world,
      record: createTutorStubPublicLearnerRecord(world),
      tutorTurn: 9,
      learnerText: claim,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });

    assert.equal(result.model.assessment.assertedSecret, false);
    assert.equal(result.model.assessment.unsupportedAssertionCount, 0);
    assert.equal(result.accepted.assertAnswer, null);
    assert.ok(
      (result.rejected || []).some((entry) => entry.type === 'assert' && /names no candidate/u.test(entry.reason)),
      'the unresolved claim should be visible in the rejected list',
    );
  });

  it('computes a public constraint preflight before analysis without committing progress', async () => {
    const world = smokeWorld();
    const record = createTutorStubPublicLearnerRecord(world);
    const p1 = world.premiseById.get('p1');
    const p2 = world.premiseById.get('p2');
    record.board.set(JSON.stringify(p1.fact), p1.fact);
    const publicEvidence = [
      { premise: 'p1', turn: 1, via: 'fixture', surface: p1.surface, fact: p1.fact },
      { premise: 'p2', turn: 2, via: 'fixture', surface: p2.surface, fact: p2.fact },
    ];
    const boardSizeBefore = record.board.size;
    const preflight = buildTutorStubLearnerDagPreflight({
      world,
      record,
      tutorTurn: 2,
      publicStagedEvidence: publicEvidence,
    });

    assert.equal(preflight.schema, TUTOR_STUB_LEARNER_DAG_PREFLIGHT_SCHEMA);
    assert.equal(preflight.computedBeforeModelCall, true);
    assert.equal(preflight.publicOnly, true);
    assert.deepEqual(preflight.eligiblePublicPremiseIds, ['p1', 'p2']);
    assert.deepEqual(preflight.alreadyAdoptedPremiseIds, ['p1']);
    assert.deepEqual(preflight.retractablePremiseIds, ['p1']);
    assert.deepEqual(preflight.possibleNextDerivations, [
      {
        fact: ['grandchild', 'marin', 'founder'],
        publicRuleId: 'R1_lineage',
        supportingPremiseIds: ['p1', 'p2'],
      },
    ]);
    assert.equal(preflight.authority.semanticMappingRequired, true);
    assert.equal(preflight.authority.commitsProgress, false);
    assert.equal(preflight.authority.commitStage, 'deterministic_postprocessor_after_model');
    assert.equal(record.board.size, boardSizeBefore);
    assert.equal(record.voiced.length, 0);
    assert.match(preflight.contentSha256, /^[a-f0-9]{64}$/u);
    const serialized = JSON.stringify(preflight);
    assert.doesNotMatch(serialized, /p3|proof_paths|release_schedule|rightful heir|\["heir","marin"\]/iu);

    let modelDispatched = false;
    const result = await analyzeTutorStubPublicLearnerTurn({
      learnerText: 'I am not claiming a conclusion yet.',
      topic: 'inheritance reasoning',
      world,
      tutorTurn: 2,
      learnerRecord: record,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
      callModel: async (request) => {
        modelDispatched = true;
        const preflightIndex = request.prompt.indexOf('# Deterministic learner-DAG preflight');
        const learnerTurnIndex = request.prompt.indexOf('# Current learner turn');
        assert.ok(preflightIndex >= 0 && preflightIndex < learnerTurnIndex);
        assert.match(request.prompt, /eligibility ceiling, not permission to invent a derivation/u);
        return modelResponse(validAnalysis());
      },
    });
    assert.equal(modelDispatched, true);
    assert.equal(result.rawAnalysis.provenance.dag_preflight_before_model, true);
    assert.equal(result.provenance.dag_preflight_before_model, true);
    assert.equal(result.turnRecord.tutorLearnerDagUpdate.preflight.contentSha256, preflight.contentSha256);
    assert.deepEqual(result.tutorLearnerDag.accepted.derive, []);
    assert.equal(result.tutorLearnerDag.model.metrics.voicedDerivedCount, 0);
  });

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
