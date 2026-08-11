#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  auditAdaptiveWarrantSemanticContractCatalog,
  adaptiveWarrantSemanticConsensusIdentity,
  buildAdaptiveWarrantSemanticConsensus,
  scoreAdaptiveWarrantSemanticExtraction,
  validateAdaptiveWarrantSemanticAnnotationResponse,
} from '../services/adaptiveWarrantSemanticAnnotation.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_PREFLIGHT_SCHEMA,
  adaptiveWarrantSemanticInstrumentBindings,
  adaptiveWarrantSemanticValueSha256,
  validateAdaptiveWarrantSemanticPreflightArtifact,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  assembleAdaptiveWarrantSemanticAnnotationResponse,
  prepareAdaptiveWarrantSemanticAnnotationBatches,
} from './prepare-adaptive-warrant-semantic-annotations.js';
import { buildAdaptiveWarrantV3SemanticDiagnostic } from './build-adaptive-warrant-v3-semantic-diagnostic.js';
import { buildAdaptiveWarrantSemanticSmokeCorpus } from './run-adaptive-warrant-semantic-schema-smoke.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function target(index) {
  const identityIndex = ((index - 1) % 4) + 1;
  return {
    target_id: `target-preflight-record-${identityIndex}`,
    requested_value_types: ['name', 'time'],
    component_ids: ['visitor_name', 'clock_time'],
  };
}

function actionContract(speechAct) {
  return {
    tutor_directed_public_result_request: ['requested', 'tutor', 'supply_public_result'],
    learner_proposed_test: ['proposed', 'learner', 'perform_public_test'],
    learner_record_entry_request: ['requested', 'joint', 'record_public_claim'],
    tutor_selection_request: ['requested', 'tutor', 'select_next_step'],
  }[speechAct];
}

function action(speechAct, index) {
  const identityIndex = ((index - 1) % 4) + 1;
  const [, executor] = actionContract(speechAct);
  return {
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
    const phrase = `record ${index} public result`;
    const learner = `Please classify ${phrase} now.`;
    expected.set(`preflight-${index}`, [
      {
        speech_act: speechAct,
        target: target(index),
        requested_or_proposed_action: action(speechAct, index),
        evidence_span: { text: phrase },
      },
    ]);
    return { sample_id: `preflight-${index}`, current_learner_turn: { turn: 2, learner } };
  });
  const compoundText = 'I will inspect record 13; then report record 13 public result.';
  const compoundId = 'preflight-13';
  expected.set(compoundId, [
    {
      speech_act: 'learner_proposed_test',
      target: target(13),
      requested_or_proposed_action: action('learner_proposed_test', 13),
      evidence_span: { text: 'I will inspect record 13' },
    },
    {
      speech_act: 'tutor_directed_public_result_request',
      target: target(13),
      requested_or_proposed_action: action('tutor_directed_public_result_request', 13),
      evidence_span: { text: 'report record 13 public result' },
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
        event.evidence_span.text = learner;
      }
    }
    if (variant === 'b' && events.length > 1) events.reverse();
    response.cases_by_sample_id[sampleId] = {
      note: variant === 'a' ? 'First reader public rationale.' : 'Different harmless explanatory wording.',
      events,
      genuinely_ambiguous: false,
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
  const workDir = path.join(path.dirname(resolvedOutput), 'brittleness-preflight-work');
  if (fs.existsSync(workDir) && fs.readdirSync(workDir).length) {
    throw new Error(`preflight work directory is not empty: ${workDir}`);
  }
  fs.mkdirSync(workDir, { recursive: true });
  const { corpus, expected } = syntheticInstrument(sourceCommit);
  const syntheticContractCatalogAudit = captureContractCatalogAudit(corpus.semantic_annotation_catalog);
  const smokeContractCatalogAudit = captureContractCatalogAudit(
    buildAdaptiveWarrantSemanticSmokeCorpus(sourceCommit).semantic_annotation_catalog,
  );
  const diagnosticContractCatalogAudit = captureContractCatalogAudit(
    buildAdaptiveWarrantV3SemanticDiagnostic({
      studyId: `semantic-contract-catalog-preflight-${sourceCommit.slice(0, 12)}`,
    }).corpus.semantic_annotation_catalog,
  );
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
    batchSize: 3,
    maximumCalls: 10,
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
  const schemaText = JSON.stringify(schemas);
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
    check('reader_schema_contains_no_offset_arithmetic', !/"(?:start|end|token_count|hash)"\s*:/u.test(schemaText)),
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
    },
  };
  writeJson(resolvedOutput, artifact);
  if (passed) validateAdaptiveWarrantSemanticPreflightArtifact({ artifact, expectedSourceCommit: sourceCommit });
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
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[semantic-brittleness-preflight] error: ${error.message}`);
    process.exitCode = 1;
  }
}
