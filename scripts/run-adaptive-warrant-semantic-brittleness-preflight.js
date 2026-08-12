#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  auditAdaptiveWarrantSemanticContractCatalog,
  auditAdaptiveWarrantLiveSemanticSchemaTotality,
  auditAdaptiveWarrantSemanticReaderSchemaTotality,
  adaptiveWarrantSemanticConsensusIdentity,
  buildAdaptiveWarrantSemanticBatchOutputSchema,
  buildAdaptiveWarrantSemanticConsensus,
  scoreAdaptiveWarrantSemanticExtraction,
  validateAdaptiveWarrantSemanticAnnotationResponse,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULES,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULE_PARAGRAPHS,
  TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES,
  buildTutorStubPublicLearnerAnalysisPrompt,
  buildTutorStubPublicLearnerAnalysisOutputSchema,
  buildTutorStubPublicLearnerAnalysisProviderOutputSchema,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import {
  TUTOR_STUB_CLI_REQUEST_PATH,
  buildTutorStubCliBridgeRequest,
} from '../services/tutorStubCliRequest.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA,
  adaptiveWarrantSemanticInstrumentBindings,
  adaptiveWarrantSemanticValueSha256,
  validateAdaptiveWarrantSemanticPreflightArtifact,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
  adaptiveWarrantSemanticSourceHash,
  validateAdaptiveWarrantSemanticExtraction,
} from '../services/adaptiveWarrantSemanticEvents.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from './prepare-adaptive-warrant-semantic-annotations.js';
import { buildAdaptiveWarrantV3SemanticDiagnostic } from './build-adaptive-warrant-v3-semantic-diagnostic.js';
import {
  ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_MINIMUM_TURNS,
  ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_RATE,
  evaluateAdaptiveWarrantAnalysisCoverageHalt,
} from './run-adaptive-warrant-baseline-study.js';
import { buildAdaptiveWarrantSemanticSmokeCorpus } from './run-adaptive-warrant-semantic-schema-smoke.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function atomicWriteJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, filePath);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function target(index, speechAct) {
  const identityIndex = ((index - 1) % 4) + 1;
  const resultRequest = speechAct === 'tutor_directed_public_result_request';
  return {
    state: 'catalog',
    target_id: `target-preflight-record-${identityIndex}`,
    requested_value_types: resultRequest ? ['name', 'time'] : [],
    component_ids: resultRequest ? ['visitor_name', 'clock_time'] : [],
  };
}

function actionContract(speechAct) {
  return {
    tutor_directed_public_result_request: ['requested', 'tutor', 'supply_public_result'],
    learner_proposed_test: ['proposed', 'learner', 'perform_public_test'],
    learner_record_entry_request: ['requested', 'tutor', 'record_public_claim'],
    tutor_selection_request: ['requested', 'tutor', 'select_next_step'],
  }[speechAct];
}

function action(speechAct, index) {
  const identityIndex = ((index - 1) % 4) + 1;
  const [, executor] = actionContract(speechAct);
  return {
    state: 'catalog',
    executor,
    action_object_id: `action-object-preflight-${speechAct.replaceAll('_', '-')}-${identityIndex}`,
  };
}

function syntheticInstrument(sourceCommit) {
  const acts = [
    ...Array(4).fill('tutor_directed_public_result_request'),
    ...Array(4).fill('learner_proposed_test'),
    ...Array(2).fill('learner_record_entry_request'),
    ...Array(2).fill('tutor_selection_request'),
  ];
  const expected = new Map();
  const cases = acts.map((speechAct, offset) => {
    const index = offset + 1;
    const phrase =
      speechAct === 'tutor_directed_public_result_request'
        ? `report record ${index} name and time`
        : speechAct === 'learner_proposed_test'
          ? `I will inspect record ${index}`
          : speechAct === 'learner_record_entry_request'
            ? `enter record ${index}`
            : `choose record ${index}`;
    const learner = `Please classify ${phrase} now.`;
    expected.set(`preflight-${index}`, [
      {
        speech_act: speechAct,
        target: target(index, speechAct),
        requested_or_proposed_action: action(speechAct, index),
        evidence_span: { text: phrase },
      },
    ]);
    return { sample_id: `preflight-${index}`, current_learner_turn: { turn: 2, learner } };
  });
  const compoundText = 'I will inspect record 13; then report record 13 name and time.';
  const compoundId = 'preflight-13';
  expected.set(compoundId, [
    {
      speech_act: 'learner_proposed_test',
      target: target(13, 'learner_proposed_test'),
      requested_or_proposed_action: action('learner_proposed_test', 13),
      evidence_span: { text: 'I will inspect record 13' },
    },
    {
      speech_act: 'tutor_directed_public_result_request',
      target: target(13, 'tutor_directed_public_result_request'),
      requested_or_proposed_action: action('tutor_directed_public_result_request', 13),
      evidence_span: { text: 'report record 13 name and time' },
    },
  ]);
  cases.push({ sample_id: compoundId, current_learner_turn: { turn: 2, learner: compoundText } });
  const indexes = Array.from({ length: 4 }, (_, index) => index + 1);
  const catalog = {
    schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3',
    targets: indexes.map((index) => ({
      target_id: `target-preflight-record-${index}`,
      kind: 'record_entry',
      public_identifier_ids: [`public-id-preflight-${index}`, `public-id-preflight-alias-${index}`],
      allowed_value_types: ['name', 'time', 'date'],
      component_ids: ['visitor_name', 'clock_time'],
      display_label: `Synthetic record ${index}`,
    })),
    public_identifiers: indexes.flatMap((index) => [
      { public_identifier_id: `public-id-preflight-${index}`, display_label: `record ${index}` },
      { public_identifier_id: `public-id-preflight-alias-${index}`, display_label: `ledger ${index}` },
    ]),
    components: [
      { component_id: 'visitor_name', display_label: 'visitor name' },
      { component_id: 'clock_time', display_label: 'clock time' },
    ],
    action_objects: [
      ...new Map(
        [...expected.values()]
          .flat()
          .filter((event) => event.requested_or_proposed_action)
          .map((event) => {
            const [mode, , actionName] = actionContract(event.speech_act);
            const id = event.requested_or_proposed_action.action_object_id;
            return [
              id,
              {
                action_object_id: id,
                mode,
                action: actionName,
                target_id: event.target?.target_id || null,
                display_label: `Synthetic ${event.speech_act}`,
              },
            ];
          }),
      ).values(),
      {
        action_object_id: 'action-object-preflight-explain-wording',
        mode: 'requested',
        action: 'explain_wording',
        target_id: null,
        display_label: 'Synthetic explain public wording',
      },
      {
        action_object_id: 'action-object-preflight-withdraw-request',
        mode: 'requested',
        action: 'withdraw_request',
        target_id: null,
        display_label: 'Synthetic withdraw request',
      },
    ],
  };
  return {
    corpus: {
      schema: 'machinespirits.adaptation-refinement.annotation-corpus.v1',
      study_id: `semantic-brittleness-preflight-${sourceCommit.slice(0, 12)}`,
      blinded: true,
      semantic_annotation_catalog: catalog,
      cases,
    },
    expected,
  };
}

function readerBatchResponse({ packet, expected, variant }) {
  const response = clone(packet.response_template);
  const ids = variant === 'b' ? [...packet.required_sample_ids].reverse() : packet.required_sample_ids;
  response.cases_by_sample_id = {};
  for (const sampleId of ids) {
    const events = clone(expected.get(sampleId));
    for (const event of events) {
      if (variant === 'b' && event.target) {
        event.target.requested_value_types.reverse();
        event.target.component_ids.reverse();
      }
      if (variant === 'a' && events.length === 1) {
        const learner = packet.cases_by_sample_id[sampleId].current_learner_turn.learner;
        event.evidence_span = learner;
      } else {
        event.evidence_span = event.evidence_span.text;
      }
    }
    if (variant === 'b' && events.length > 1) events.reverse();
    response.cases_by_sample_id[sampleId] = {
      note: variant === 'a' ? 'First reader public rationale.' : 'Different harmless explanatory wording.',
      events,
      genuinely_ambiguous: false,
      ambiguity_reason: 'none',
    };
  }
  return response;
}

function predictionsFrom(response) {
  return Object.fromEntries(
    response.cases.map((row) => [
      row.sample_id,
      {
        extraction_status: 'accepted',
        counts: { accepted: row.events.length, uncertain: 0, rejected: 0 },
        events: row.events.map((event, index) => ({
          ...event,
          event_id: `${row.sample_id}-event-${index + 1}`,
          validation: { status: 'accepted', issues: [] },
        })),
      },
    ]),
  );
}

function check(name, condition, evidence = null) {
  return { name, status: condition ? 'pass' : 'fail', evidence };
}

function spanDerivationPreflightAudit() {
  const validate = (learnerText, spans) =>
    validateAdaptiveWarrantSemanticExtraction(
      {
        schema: ADAPTIVE_WARRANT_SEMANTIC_EXTRACTION_SCHEMA,
        source_turn: 1,
        source_text_sha256: adaptiveWarrantSemanticSourceHash(learnerText),
        events: spans.map((evidenceSpan, index) => ({
          event_id: `span-preflight-${index + 1}`,
          speech_act: 'other',
          target: { state: 'none' },
          requested_or_proposed_action: { state: 'none' },
          evidence_span: evidenceSpan,
          confidence: 'high',
          uncertainty: [],
        })),
        extraction_status: 'accepted',
      },
      { learnerText, publicText: learnerText, turn: 1 },
    );
  const unique = validate('alpha beta gamma', ['beta']);
  const absent = validate('alpha beta gamma', ['delta']);
  const duplicate = validate('echo then echo', ['echo']);
  const overlap = validate('alpha beta gamma', ['alpha beta', 'beta gamma']);
  return {
    unique_quote_derived:
      unique.events[0]?.evidence_span?.start === 6 &&
      unique.events[0]?.evidence_span?.end === 10 &&
      unique.events[0]?.evidence_span_derivation?.status === 'derived_unique_literal',
    absent_quote_fails: absent.events[0]?.validation?.issues.includes('events[0].evidence_span:not_literal'),
    duplicate_quote_fails: duplicate.events[0]?.validation?.issues.includes(
      'events[0].evidence_span:non_unique_literal',
    ),
    overlap_detected_mechanically: overlap.events.every((event) =>
      event.validation?.issues.includes('overlapping_events:non_atomic_span'),
    ),
  };
}

function meaningMutationDetected({ base, corpus, corpusSha256, mutate }) {
  const changed = clone(base);
  changed.annotator_id = `${base.annotator_id}-contrast`;
  changed.annotation_run_id = `${base.annotation_run_id}-contrast`;
  mutate(changed.cases[0].events[0]);
  try {
    const consensus = buildAdaptiveWarrantSemanticConsensus({
      readerA: base,
      readerB: changed,
      corpus,
      corpusSha256,
    });
    return consensus.cases[0].hard_consensus === false;
  } catch {
    return true;
  }
}

function throwsValidation({ response, corpus, corpusSha256 }) {
  try {
    validateAdaptiveWarrantSemanticAnnotationResponse({ response, corpus, corpusSha256 });
    return false;
  } catch {
    return true;
  }
}

function captureContractCatalogAudit(semanticCatalog) {
  try {
    return auditAdaptiveWarrantSemanticContractCatalog({ semanticCatalog });
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export function runAdaptiveWarrantSemanticBrittlenessPreflight({ outputPath, sourceCommit } = {}) {
  if (!/^[0-9a-f]{40}$/u.test(sourceCommit || '')) throw new Error('preflight requires an exact source commit');
  const resolvedOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  const workDir = fs.mkdtempSync(
    path.join(path.dirname(resolvedOutput), `brittleness-preflight-${sourceCommit.slice(0, 12)}-`),
  );
  const { corpus, expected } = syntheticInstrument(sourceCommit);
  const smokeCorpus = buildAdaptiveWarrantSemanticSmokeCorpus(sourceCommit);
  const diagnosticBuilt = buildAdaptiveWarrantV3SemanticDiagnostic({
    studyId: `semantic-brittleness-preflight-diagnostic-${sourceCommit.slice(0, 12)}`,
  });
  const diagnosticCorpus = diagnosticBuilt.corpus;
  const frozenHandbookParagraphs = TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULE_PARAGRAPHS.filter((paragraph) =>
    diagnosticBuilt.handbook.includes(paragraph),
  );
  const frozenHandbookRules = frozenHandbookParagraphs.join('\n\n');
  const liveHandbookPrompt = buildTutorStubPublicLearnerAnalysisPrompt({
    learnerText: 'Please show me the public record result, then I will test the next listed check.',
    topic: 'synthetic prompt-handbook parity audit',
    world: {
      id: 'semantic-handbook-preflight',
      title: 'Synthetic handbook prompt audit',
      discipline: 'semantic extraction',
      question: 'What does the public record show?',
      setting: 'A synthetic public record and two public checks are available.',
      rules: [],
      premises: [],
    },
    tutorTurn: 1,
    publicTranscript: [],
    currentTutorText: 'Choose the first or second public check.',
    publicStagedEvidence: [],
    includeSemanticEvents: true,
    strictProviderEnvelope: true,
    promptProfile: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES.HANDBOOK_V1,
  });
  const handbookPromptParityAudit = {
    profile: TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_PROMPT_PROFILES.HANDBOOK_V1,
    frozen_handbook_block_found:
      frozenHandbookParagraphs.length === TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULE_PARAGRAPHS.length,
    frozen_handbook_block_sha256: adaptiveWarrantSemanticValueSha256(frozenHandbookRules),
    live_rule_block_sha256: adaptiveWarrantSemanticValueSha256(
      TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULES,
    ),
    exact_digest_match:
      frozenHandbookRules.length > 0 &&
      adaptiveWarrantSemanticValueSha256(frozenHandbookRules) ===
        adaptiveWarrantSemanticValueSha256(TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULES),
    live_prompt_contains_exact_block: liveHandbookPrompt.includes(TUTOR_STUB_PUBLIC_LEARNER_ANALYSIS_HANDBOOK_RULES),
    live_prompt_chars: liveHandbookPrompt.length,
    live_prompt_approximate_tokens: Math.ceil(liveHandbookPrompt.length / 4),
    maximum_prompt_chars: 42000,
    maximum_prompt_approximate_tokens: 10500,
  };
  const syntheticContractCatalogAudit = captureContractCatalogAudit(corpus.semantic_annotation_catalog);
  const smokeContractCatalogAudit = captureContractCatalogAudit(smokeCorpus.semantic_annotation_catalog);
  const diagnosticContractCatalogAudit = captureContractCatalogAudit(diagnosticCorpus.semantic_annotation_catalog);
  const corpusPath = path.join(workDir, 'synthetic-corpus.json');
  const handbookPath = path.join(workDir, 'synthetic-handbook.md');
  writeJson(corpusPath, corpus);
  fs.writeFileSync(
    handbookPath,
    '# Synthetic brittleness preflight\n\nUse only canonical IDs. Return literal span text; do not calculate offsets.\n',
  );
  const collectionDir = path.join(workDir, 'collection');
  const prepared = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath,
    handbookPath,
    outputDir: collectionDir,
    corpusRole: 'targeted_challenge',
    batchSize: 8,
    maximumCalls: 10,
    preflightMode: true,
  });
  const diagnosticCorpusPath = path.join(workDir, 'diagnostic-corpus.json');
  const diagnosticHandbookPath = path.join(workDir, 'diagnostic-handbook.md');
  writeJson(diagnosticCorpusPath, diagnosticCorpus);
  fs.writeFileSync(diagnosticHandbookPath, diagnosticBuilt.handbook);
  const preparedDiagnostic = prepareAdaptiveWarrantSemanticAnnotationBatches({
    corpusPath: diagnosticCorpusPath,
    handbookPath: diagnosticHandbookPath,
    outputDir: path.join(workDir, 'diagnostic-size-collection'),
    corpusRole: 'targeted_challenge',
    batchSize: 8,
    maximumCalls: 6,
    preflightMode: true,
  });
  const assembled = {};
  const responseSizes = [];
  for (const [readerIndex, reader] of prepared.manifest.readers.entries()) {
    const responseDir = path.join(workDir, 'responses', reader.reader_id);
    fs.mkdirSync(responseDir, { recursive: true });
    for (const batch of reader.batches) {
      const packet = JSON.parse(fs.readFileSync(batch.packet_path, 'utf8'));
      const response = readerBatchResponse({ packet, expected, variant: readerIndex === 0 ? 'a' : 'b' });
      const responsePath = path.join(responseDir, batch.expected_response_filename);
      writeJson(responsePath, response);
      responseSizes.push(fs.statSync(responsePath).size);
    }
    assembled[reader.reader_id] = assembleAdaptiveWarrantSemanticAnnotationResponse({
      manifestPath: prepared.manifestPath,
      readerId: reader.reader_id,
      annotationRunId: `synthetic-${reader.reader_id}`,
      responseDir,
      outputPath: path.join(workDir, `${reader.reader_id}.assembled.json`),
    }).response;
  }
  const [readerAId, readerBId] = prepared.manifest.readers.map((reader) => reader.reader_id);
  const readerA = assembled[readerAId];
  const readerB = assembled[readerBId];
  const corpusSha256 = prepared.manifest.corpus.sha256;
  const consensus = buildAdaptiveWarrantSemanticConsensus({ readerA, readerB, corpus, corpusSha256 });
  const score = scoreAdaptiveWarrantSemanticExtraction({
    consensus,
    predictionsBySampleId: predictionsFrom(readerA),
    corpusRole: 'targeted_challenge',
  });
  const relabelledCorpus = clone(corpus);
  for (const field of ['targets', 'public_identifiers', 'components', 'action_objects']) {
    relabelledCorpus.semantic_annotation_catalog[field].forEach((row, index) => {
      row.display_label = `Changed display label ${field} ${index}`;
    });
  }
  const relabelledConsensus = buildAdaptiveWarrantSemanticConsensus({
    readerA,
    readerB,
    corpus: relabelledCorpus,
    corpusSha256,
  });
  const firstTarget = corpus.semantic_annotation_catalog.targets[1].target_id;
  const firstAction = corpus.semantic_annotation_catalog.action_objects[1].action_object_id;
  const mutations = {
    speech_act: (event) => {
      event.speech_act = 'criterion_question';
    },
    executor: (event) => {
      event.requested_or_proposed_action.executor = 'joint';
    },
    target_id: (event) => {
      event.target.target_id = firstTarget;
    },
    action_object_id: (event) => {
      event.requested_or_proposed_action.action_object_id = firstAction;
    },
    value_type: (event) => {
      event.target.requested_value_types = ['date'];
    },
    component_id: (event) => {
      event.target.component_ids = ['clock_time'];
    },
  };
  const mutationChecks = Object.fromEntries(
    Object.entries(mutations).map(([name, mutate]) => [
      name,
      meaningMutationDetected({ base: readerA, corpus, corpusSha256, mutate }),
    ]),
  );
  const unknown = clone(readerA);
  unknown.cases[0].events[0].speech_act = 'unknown_speech_act';
  const outOfCatalog = clone(readerA);
  outOfCatalog.cases[0].events[0].target.target_id = 'target-not-in-catalog';
  const malformed = clone(readerA);
  delete malformed.cases[0].events[0].speech_act;
  const ambiguous = clone(readerB);
  ambiguous.cases[0].genuinely_ambiguous = true;
  ambiguous.cases[0].ambiguity_reason = 'speech_act';
  ambiguous.cases[0].events = [];
  const ambiguousConsensus = buildAdaptiveWarrantSemanticConsensus({
    readerA,
    readerB: ambiguous,
    corpus,
    corpusSha256,
  });
  const packetSizes = prepared.manifest.readers.flatMap((reader) =>
    reader.batches.map((batch) => fs.statSync(batch.packet_path).size),
  );
  const schemas = prepared.manifest.readers.flatMap((reader) =>
    reader.batches.map((batch) => JSON.parse(fs.readFileSync(batch.response_schema_path, 'utf8'))),
  );
  const diagnosticSchemas = preparedDiagnostic.manifest.readers.flatMap((reader) =>
    reader.batches.map((batch) => JSON.parse(fs.readFileSync(batch.response_schema_path, 'utf8'))),
  );
  const totalitySchemaFor = (candidateCorpus, label, count) =>
    buildAdaptiveWarrantSemanticBatchOutputSchema({
      readerId: `zero-call-${label}`,
      batchId: `zero-call-${label}-batch`,
      studyId: candidateCorpus.study_id,
      corpusSha256: `zero-call-${label}-corpus`,
      requiredSampleIds: candidateCorpus.cases.slice(0, count).map((row) => row.sample_id),
      semanticCatalog: candidateCorpus.semantic_annotation_catalog,
    });
  const readerSchemaTotalityAudits = {
    synthetic_shipped_batches: schemas.map((schema) =>
      auditAdaptiveWarrantSemanticReaderSchemaTotality({
        schema,
        semanticCatalog: corpus.semantic_annotation_catalog,
      }),
    ),
    smoke: auditAdaptiveWarrantSemanticReaderSchemaTotality({
      schema: totalitySchemaFor(smokeCorpus, 'smoke', 3),
      semanticCatalog: smokeCorpus.semantic_annotation_catalog,
    }),
    diagnostic_shipped_batches: diagnosticSchemas.map((schema) =>
      auditAdaptiveWarrantSemanticReaderSchemaTotality({
        schema,
        semanticCatalog: diagnosticCorpus.semantic_annotation_catalog,
      }),
    ),
  };
  const allReaderSchemaAudits = [
    ...readerSchemaTotalityAudits.synthetic_shipped_batches,
    readerSchemaTotalityAudits.smoke,
    ...readerSchemaTotalityAudits.diagnostic_shipped_batches,
  ];
  const liveSemanticSchemas = {
    local: buildTutorStubPublicLearnerAnalysisOutputSchema({ includeSemanticEvents: true }).properties.semantic_events,
    provider: buildTutorStubPublicLearnerAnalysisProviderOutputSchema({ includeSemanticEvents: true }).properties
      .semantic_events,
  };
  const liveSemanticSchemaAudits = Object.fromEntries(
    Object.entries(liveSemanticSchemas).map(([seat, schema]) => [
      seat,
      auditAdaptiveWarrantLiveSemanticSchemaTotality({ schema }),
    ]),
  );
  const liveSchemaLanguageEquivalent =
    adaptiveWarrantSemanticValueSha256(liveSemanticSchemas.local) ===
    adaptiveWarrantSemanticValueSha256(liveSemanticSchemas.provider);
  const sentinel = ['Classifier failed', ' before the tutor turn.'].join('');
  const promptAssemblySources = [
    'services/tutorStubLearnerClassification.js',
    'services/tutorStubTutorPromptContext.js',
    'services/tutorStubResponseComposition.js',
    'services/tutorStubTurnProgressionContract.js',
    'services/tutorStubLearnerAnalysisRuntime.js',
  ];
  const sentinelLeakPaths = promptAssemblySources.filter((relativePath) =>
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8').includes(sentinel),
  );
  const sharedSchemaSentinel = { type: 'object', properties: {}, additionalProperties: false };
  const sharedRequest = buildTutorStubCliBridgeRequest({
    resolved: { provider: 'codex', model: 'gpt-5.6-luna' },
    systemPrompt: 'synthetic system',
    userPrompt: 'synthetic prompt',
    role: 'synthetic-shared-path-audit',
    outputSchema: sharedSchemaSentinel,
    effort: 'low',
    timeoutMs: 300_000,
  });
  const promptTransportSource = fs.readFileSync(path.join(ROOT, 'services/tutorStubPromptTransport.js'), 'utf8');
  const acceptancePingSource = fs.readFileSync(
    path.join(ROOT, 'scripts/run-adaptive-warrant-semantic-schema-acceptance-ping.js'),
    'utf8',
  );
  const sharedRequestPathAudit = {
    request_schema: sharedRequest.schema,
    schema_forwarded: sharedRequest.options.outputSchema === sharedSchemaSentinel,
    strict_effort_forwarded: sharedRequest.options.effort === 'low',
    strict_timeout_forwarded: sharedRequest.options.timeoutMs === 300_000,
    live_dispatches_shared_path: promptTransportSource.includes(
      'dispatchTutorStubCliBridgeRequest(callAIWithCliBridge',
    ),
    ping_dispatches_shared_path: acceptancePingSource.includes('dispatchTutorStubCliBridgeRequest(callModel'),
  };
  const firstCallCoverageGuard = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: 1,
      learnerAnalysisUnanalyzedCount: 1,
      firstLearnerAnalysisStatus: 'unanalyzed',
    },
  ]);
  const rateCoverageGuard = evaluateAdaptiveWarrantAnalysisCoverageHalt([
    {
      learnerAnalysisCallCount: ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_MINIMUM_TURNS,
      learnerAnalysisUnanalyzedCount: 1,
      firstLearnerAnalysisStatus: 'analyzed',
    },
  ]);
  const representativeRunnerSource = fs.readFileSync(
    path.join(ROOT, 'scripts/run-adaptive-warrant-baseline-study.js'),
    'utf8',
  );
  const coverageGuardAudit = {
    threshold: ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_RATE,
    minimum_turns: ADAPTIVE_WARRANT_ANALYSIS_COVERAGE_HALT_MINIMUM_TURNS,
    first_call_result: firstCallCoverageGuard,
    rate_result: rateCoverageGuard,
    wired_before_new_job_admission:
      representativeRunnerSource.includes('() => coverageHalt === null') &&
      representativeRunnerSource.includes('evaluateAdaptiveWarrantAnalysisCoverageHalt(completedRows)'),
    typed_status_wired: representativeRunnerSource.includes("status: coverageHalt ? 'coverage_halt' : 'running'"),
  };
  const modelFacingSchemaText = JSON.stringify([
    ...schemas,
    ...diagnosticSchemas,
    ...Object.values(liveSemanticSchemas),
  ]);
  const modelFacingDerivedFieldAudit = {
    forbidden_mechanical_fields: [
      'speaker',
      'source_turn',
      'source_text_sha256',
      'event_id',
      'start',
      'end',
      'extraction_status',
    ],
    present_forbidden_mechanical_fields: [
      'speaker',
      'source_turn',
      'source_text_sha256',
      'event_id',
      'start',
      'end',
      'extraction_status',
    ].filter((field) => new RegExp(`"${field}"\\s*:`, 'u').test(modelFacingSchemaText)),
    all_reader_schemas_literal_quote_only: allReaderSchemaAudits.every(
      (audit) => audit.model_supplies_literal_quote_only === true,
    ),
    all_live_schemas_literal_quote_only: Object.values(liveSemanticSchemaAudits).every(
      (audit) => audit.model_supplies_literal_quote_only === true,
    ),
  };
  const spanDerivationAudit = spanDerivationPreflightAudit();
  const scoreStates = Object.values(score.checks);
  const checks = [
    check(
      'all_event_contracts_satisfiable_by_preflight_catalog',
      syntheticContractCatalogAudit.ok === true &&
        syntheticContractCatalogAudit.speech_act_count === 15 &&
        syntheticContractCatalogAudit.worked_example_count === 15,
      syntheticContractCatalogAudit,
    ),
    check(
      'smoke_catalog_worked_examples_pass_production_validator',
      smokeContractCatalogAudit.ok === true && smokeContractCatalogAudit.worked_example_count === 15,
      smokeContractCatalogAudit,
    ),
    check(
      'diagnostic_catalog_worked_examples_pass_production_validator',
      diagnosticContractCatalogAudit.ok === true && diagnosticContractCatalogAudit.worked_example_count === 15,
      diagnosticContractCatalogAudit,
    ),
    check(
      'all_reader_fields_total_non_nullable_and_catalogue_closed',
      allReaderSchemaAudits.every(
        (audit) =>
          audit.ok === true &&
          audit.reader_fields_total === true &&
          audit.explicit_none_tokens === true &&
          audit.catalogue_domains_closed === true,
      ),
      readerSchemaTotalityAudits,
    ),
    check(
      'live_local_and_provider_semantic_schemas_are_total_act_closed_and_equivalent',
      Object.values(liveSemanticSchemaAudits).every(
        (audit) =>
          audit.ok === true &&
          audit.reader_fields_total === true &&
          audit.explicit_none_tokens === true &&
          audit.provider_keywords_supported === true &&
          audit.union_branches_pairwise_disjoint === true &&
          audit.act_contract_language_equivalent === true &&
          audit.model_supplies_literal_quote_only === true &&
          audit.nesting_depth_within_limit === true,
      ) && liveSchemaLanguageEquivalent,
      { audits: liveSemanticSchemaAudits, local_provider_language_equivalent: liveSchemaLanguageEquivalent },
    ),
    check('fallback_sentinel_absent_from_prompt_assembly_sources', sentinelLeakPaths.length === 0, {
      scanned_paths: promptAssemblySources,
      leak_paths: sentinelLeakPaths,
    }),
    check(
      'acceptance_ping_and_live_analysis_share_cli_request_path',
      sharedRequestPathAudit.request_schema === TUTOR_STUB_CLI_REQUEST_PATH &&
        Object.entries(sharedRequestPathAudit)
          .filter(([key]) => key !== 'request_schema')
          .every(([, value]) => value === true),
      sharedRequestPathAudit,
    ),
    check(
      'representative_runner_first_call_and_coverage_halt_guards_wired',
      coverageGuardAudit.threshold === 0.1 &&
        coverageGuardAudit.minimum_turns === 10 &&
        firstCallCoverageGuard.status === 'coverage_halt' &&
        firstCallCoverageGuard.reason === 'first_call_unanalyzed' &&
        rateCoverageGuard.status === 'coverage_halt' &&
        rateCoverageGuard.reason === 'unanalyzed_rate_threshold' &&
        coverageGuardAudit.wired_before_new_job_admission &&
        coverageGuardAudit.typed_status_wired,
      coverageGuardAudit,
    ),
    check(
      'reader_schema_uses_only_supported_provider_keywords',
      allReaderSchemaAudits.every((audit) => audit.provider_keywords_supported === true),
      readerSchemaTotalityAudits,
    ),
    check(
      'reader_anyof_branches_are_pairwise_disjoint',
      allReaderSchemaAudits.every((audit) => audit.union_branches_pairwise_disjoint === true),
      readerSchemaTotalityAudits,
    ),
    check(
      'reader_schema_matches_shared_act_contract_language',
      allReaderSchemaAudits.every((audit) => audit.act_contract_language_equivalent === true),
      readerSchemaTotalityAudits,
    ),
    check(
      'reader_schema_nesting_depth_at_most_10',
      allReaderSchemaAudits.every((audit) => audit.nesting_depth_within_limit === true),
      readerSchemaTotalityAudits,
    ),
    check(
      'diagnostic_prompt_and_response_schema_size_limits',
      preparedDiagnostic.manifest.size_audit.largest_packet_bytes <=
        preparedDiagnostic.manifest.size_audit.maximum_packet_bytes &&
        preparedDiagnostic.manifest.readers.every((reader) =>
          reader.batches.every((batch) => batch.response_schema_bytes <= batch.maximum_response_bytes),
        ),
      preparedDiagnostic.manifest.size_audit,
    ),
    check('complete_prepare_assemble_consensus_score_path', consensus.hard_consensus_cases === corpus.cases.length),
    check('equivalent_descriptions_same_consensus', consensus.hard_consensus_cases === corpus.cases.length),
    check(
      'notes_and_display_labels_invariant',
      relabelledConsensus.hard_consensus_cases === consensus.hard_consensus_cases,
    ),
    check(
      'json_key_order_invariant',
      consensus.cases.every((row) => row.hard_consensus),
    ),
    check(
      'declared_set_order_invariant',
      consensus.cases.every((row) => row.event_fields_agreement),
    ),
    check(
      'event_order_derived_by_public_rule',
      readerB.cases.find((row) => row.sample_id === 'preflight-13').events[0].speech_act === 'learner_proposed_test',
    ),
    check(
      'equivalent_spans_do_not_destroy_consensus',
      consensus.cases.every((row) => row.hard_consensus) && consensus.cases.some((row) => !row.span_exact_agreement),
    ),
    ...Object.entries(mutationChecks).map(([name, passed]) => check(`meaning_change_${name}_detected`, passed)),
    check(
      'free_text_absent_from_consensus_and_gate',
      Object.keys(adaptiveWarrantSemanticConsensusIdentity(readerA.cases[0].events[0])).every(
        (field) => !['note', 'description', 'display_label', 'evidence_span'].includes(field),
      ),
    ),
    check(
      'model_facing_schemas_contain_no_mechanically_derivable_fields',
      modelFacingDerivedFieldAudit.present_forbidden_mechanical_fields.length === 0 &&
        modelFacingDerivedFieldAudit.all_reader_schemas_literal_quote_only &&
        modelFacingDerivedFieldAudit.all_live_schemas_literal_quote_only,
      modelFacingDerivedFieldAudit,
    ),
    check(
      'live_handbook_prompt_matches_frozen_reader_rules_and_size_budget',
      handbookPromptParityAudit.frozen_handbook_block_found &&
        handbookPromptParityAudit.exact_digest_match &&
        handbookPromptParityAudit.live_prompt_contains_exact_block &&
        handbookPromptParityAudit.live_prompt_chars <= handbookPromptParityAudit.maximum_prompt_chars &&
        handbookPromptParityAudit.live_prompt_approximate_tokens <=
          handbookPromptParityAudit.maximum_prompt_approximate_tokens,
      handbookPromptParityAudit,
    ),
    check(
      'unique_absent_duplicate_and_overlap_spans_use_mechanical_derivation',
      Object.values(spanDerivationAudit).every(Boolean),
      spanDerivationAudit,
    ),
    check(
      'all_scored_threshold_cells_evaluable',
      !scoreStates.includes('not_evaluable') && !scoreStates.includes('inconclusive_support'),
      score.checks,
    ),
    check('malformed_value_fails_closed', throwsValidation({ response: malformed, corpus, corpusSha256 })),
    check('unknown_value_fails_closed', throwsValidation({ response: unknown, corpus, corpusSha256 })),
    check('out_of_catalogue_value_fails_closed', throwsValidation({ response: outOfCatalog, corpus, corpusSha256 })),
    check('ambiguous_value_fails_closed', ambiguousConsensus.cases[0].hard_consensus === false),
    check('prompt_size_within_42000_bytes', Math.max(...packetSizes) <= 42000, { maximum: Math.max(...packetSizes) }),
    check('response_size_within_10500_bytes', Math.max(...responseSizes) <= 10500, {
      maximum: Math.max(...responseSizes),
    }),
  ];
  const bindings = adaptiveWarrantSemanticInstrumentBindings({ sourceCommit });
  const passed = checks.every((row) => row.status === 'pass');
  const artifact = {
    schema: ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA,
    status: passed ? 'passed' : 'failed',
    verdict: passed ? 'instrument_ready' : 'instrument_blocked',
    generated_at: new Date().toISOString(),
    zero_model_calls: true,
    synthetic_cases_permanently_excluded: true,
    bindings,
    checks,
    evidence: {
      cases: corpus.cases.length,
      hard_consensus_cases: consensus.hard_consensus_cases,
      score_verdict: score.verdict,
      score_checks: score.checks,
      reader_schema_instances_digest: adaptiveWarrantSemanticValueSha256(schemas),
      collection_manifest_sha256: adaptiveWarrantSemanticValueSha256(prepared.manifest),
      work_dir: workDir,
      contract_catalog_audits: {
        synthetic: syntheticContractCatalogAudit,
        smoke: smokeContractCatalogAudit,
        diagnostic: diagnosticContractCatalogAudit,
      },
      reader_schema_totality_audits: readerSchemaTotalityAudits,
      live_semantic_schema_totality_audits: liveSemanticSchemaAudits,
      live_semantic_local_provider_language_equivalent: liveSchemaLanguageEquivalent,
      model_facing_derived_field_audit: modelFacingDerivedFieldAudit,
      handbook_prompt_parity_audit: handbookPromptParityAudit,
      span_derivation_audit: spanDerivationAudit,
      fallback_sentinel_leak_paths: sentinelLeakPaths,
      shared_cli_request_path_audit: sharedRequestPathAudit,
      representative_runner_coverage_guard_audit: coverageGuardAudit,
    },
  };
  if (passed) validateAdaptiveWarrantSemanticPreflightArtifact({ artifact, expectedSourceCommit: sourceCommit });
  atomicWriteJson(resolvedOutput, artifact);
  return { artifact, outputPath: resolvedOutput };
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help || !values.out) {
    process.stdout.write(
      'Usage: node scripts/run-adaptive-warrant-semantic-brittleness-preflight.js --out <artifact.json>\n',
    );
    if (!values.help) process.exitCode = 1;
    return;
  }
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (status) throw new Error('semantic brittleness preflight requires a clean committed worktree');
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const result = runAdaptiveWarrantSemanticBrittlenessPreflight({ outputPath: values.out, sourceCommit });
  process.stdout.write(`${result.outputPath}\n`);
  if (result.artifact.status !== 'passed') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[semantic-brittleness-preflight] error: ${error.message}`);
    process.exitCode = 1;
  }
}
