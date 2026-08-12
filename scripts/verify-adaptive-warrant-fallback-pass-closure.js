#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decideTutorStubGuardDelivery } from '../services/tutorStubGuardDisposition.js';
import { auditTutorStubRepetitionResponse } from '../services/tutorStubResponseGuard.js';
import {
  auditTutorStubLiveTurnProgressionV1,
  compileTutorStubTurnProgressionContract,
  deterministicTutorStubTurnProgressionUptake,
} from '../services/tutorStubTurnProgressionContract.js';
import { ensureTutorStubPublicObligationFallbackOwnership } from '../services/tutorStubTutorTerminalRuntime.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS,
  ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES,
} from '../services/adaptiveWarrantSemanticEvents.js';

export const ADAPTIVE_WARRANT_FALLBACK_PASS_CLOSURE_SCHEMA =
  'machinespirits.adaptation-refinement.fallback-pass-closure.v2';

const DEFAULTS = Object.freeze({
  seed511Root: '/private/tmp/adaptive-warrant-v3-matrix-live-3e758071-v32-s511',
  seed511FailedDrawsRoot: '/private/tmp/adaptive-warrant-v3-matrix-live-3e758071-v32-s511-failed-draws',
  seed512Root: '/private/tmp/adaptive-warrant-v3-matrix-live-1555a9bd-r34-s512',
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`${filePath}:${index + 1}: ${error.message}`);
      }
    });
}

function walkFiles(rootDir, predicate) {
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath, predicate));
    else if (predicate(fullPath)) files.push(fullPath);
  }
  return files.sort();
}

function traceSummary(tracePath, corpus) {
  const rows = readJsonl(tracePath);
  const contracts = rows
    .filter((row) => row.type === 'tutor_first_draft_contract')
    .map((row) => ({ turn: Number(row.turn), contract: row.contract }));
  const learnerTurns = new Map(
    rows
      .filter((row) => row.type === 'auto_learner_turn')
      .map((row) => [Number(row.turn), String(row.text || '')]),
  );
  const tutorTurns = new Map(
    rows
      .filter((row) => row.type === 'turn_complete')
      .map((row) => [Number(row.turn), String(row.turnRecord?.tutor || '')]),
  );
  const directives = [];
  const seenDirectives = new Set();
  function visit(value, turn) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && value.public_obligation_directive?.target) {
      const directive = structuredClone(value.public_obligation_directive);
      // Seed 511's exact failed input predates defect-7's kind-prefix repair.
      // Project that retained target through the already-committed repair so
      // this closure exercises what the current ledger can emit.
      if (
        directive.target.catalogue_target_named === false &&
        directive.target.signature === 'generic_evidence_request'
      ) {
        directive.target.signature = 'public_exhibit_result:generic_evidence_request';
      }
      const key = `${turn}\0${JSON.stringify(directive)}`;
      if (!seenDirectives.has(key)) {
        seenDirectives.add(key);
        directives.push({ turn, directive });
      }
    }
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child, turn);
  }
  for (const row of rows) visit(row, Number(row.turn));
  for (const { turn, contract } of contracts) {
    const obligation = contract?.progression?.public_obligation_contract;
    if (!obligation?.active) continue;
    const directive = directiveFromCompiled(obligation);
    const key = `${turn}\0${JSON.stringify(directive)}`;
    if (!seenDirectives.has(key)) {
      seenDirectives.add(key);
      directives.push({ turn, directive });
    }
  }
  return {
    corpus,
    tracePath,
    traceSha256: sha256(fs.readFileSync(tracePath)),
    rows,
    contracts,
    directives,
    learnerTurns,
    tutorTurns,
  };
}

function seed511SealedTraces(rootDir) {
  const resultDir = path.join(rootDir, 'job-results');
  const results = fs
    .readdirSync(resultDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJson(path.join(resultDir, name)))
    .filter((row) => row.childStatus === 'ok' && Number(row.turnCount) === 8);
  assert.equal(results.length, 22, `expected 22 sealed seed-511 dialogues, found ${results.length}`);
  return results.map((row) => traceSummary(row.tracePath, 'seed511_sealed'));
}

function seed511FailedDrawTraces(rootDir) {
  const traces = walkFiles(rootDir, (filePath) => filePath.endsWith('.jsonl') && path.basename(filePath) !== 'run-events.jsonl');
  assert.equal(traces.length, 2, `expected two preserved seed-511 failed draws, found ${traces.length}`);
  return traces.map((tracePath) => traceSummary(tracePath, 'seed511_failed_draw'));
}

function seed512DeadTraces(rootDir) {
  const traces = walkFiles(path.join(rootDir, 'jobs'), (filePath) => {
    if (!filePath.endsWith('.jsonl') || path.basename(filePath) === 'run-events.jsonl') return false;
    return fs.readFileSync(filePath, 'utf8').includes('tutor_response_guard_exhausted');
  });
  assert.equal(traces.length, 2, `expected two dead seed-512 children, found ${traces.length}`);
  return traces.map((tracePath) => traceSummary(tracePath, 'seed512_dead_child'));
}

function directiveFromCompiled(obligation) {
  return {
    obligation_id: obligation.obligation_id,
    target: {
      kind: obligation.target.kind,
      signature: obligation.target.signature,
      public_terms: obligation.target.public_terms,
      subject_terms: obligation.target.subject_terms,
      required_components: obligation.target.required_components,
      source_surface: obligation.target.source_surface,
    },
    acceptable_outcomes: obligation.acceptable_outcomes,
  };
}

const KIND_CASES = Object.freeze({
  material_or_assay_result: Object.freeze({ publicTerms: ['sample', 'assay'], subjectTerms: ['sample'] }),
  weight_or_ring_result: Object.freeze({ publicTerms: ['clip', 'balance'], subjectTerms: ['clip'] }),
  comparison_result: Object.freeze({ publicTerms: ['seal', 'comparison'], subjectTerms: ['seal'] }),
  mark_or_tool_result: Object.freeze({ publicTerms: ['coin', 'mark'], subjectTerms: ['coin'] }),
  record_entry: Object.freeze({ publicTerms: ['badge', 'log', 'entry'], subjectTerms: ['badge'] }),
  public_exhibit_result: Object.freeze({ publicTerms: ['exhibit', 'result'], subjectTerms: ['exhibit'] }),
  other: Object.freeze({ publicTerms: ['choice', 'result'], subjectTerms: ['choice'] }),
});

function syntheticTarget({ id, kind, publicTerms, subjectTerms, sourceSurface, requiredComponents = [], labelShapes }) {
  return {
    id,
    labelShapes,
    target: {
      kind,
      signature: `${kind}:synthetic-${id}`,
      public_terms: publicTerms,
      subject_terms: subjectTerms,
      required_components: requiredComponents,
      source_surface: sourceSurface,
    },
  };
}

export function syntheticFallbackClosureTargets() {
  const targets = ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS.map((kind) => {
    const shape = KIND_CASES[kind];
    assert.ok(shape, `synthetic closure has no target-kind generator for ${kind}`);
    return syntheticTarget({
      id: `kind-${kind}`,
      kind,
      publicTerms: shape.publicTerms,
      subjectTerms: shape.subjectTerms,
      sourceSurface: shape.publicTerms.join(' '),
      labelShapes: ['kind'],
    });
  });
  targets.push(
    syntheticTarget({
      id: 'composite-terms',
      kind: 'comparison_result',
      publicTerms: ['room-presence', 'fridge-access', 'comparison'],
      subjectTerms: ['room-presence', 'fridge-access'],
      sourceSurface: 'room-presence and fridge-access comparison',
      labelShapes: ['composite_terms', 'hyphenated_compound'],
    }),
    syntheticTarget({
      id: 'writable-entry',
      kind: 'record_entry',
      publicTerms: ['first-log-entry', 'log', 'entry'],
      subjectTerms: [],
      // The ledger's public target surface is the plain requested object;
      // `first-log-entry` is the composite catalogue/subject term that used
      // to corrupt the rendered label.
      sourceSurface: 'log entry',
      labelShapes: ['composite_terms', 'hyphenated_compound', 'writable_entry'],
    }),
    syntheticTarget({
      id: 'generic-sentinel',
      kind: 'public_exhibit_result',
      publicTerms: ['evidence'],
      subjectTerms: [],
      sourceSurface: 'generic evidence request',
      labelShapes: ['generic_sentinel'],
    }),
  );
  for (const valueType of ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES) {
    targets.push(
      syntheticTarget({
        id: `value-type-${valueType}`,
        kind: 'public_exhibit_result',
        publicTerms: ['evidence'],
        subjectTerms: [],
        sourceSurface: 'generic evidence request',
        requiredComponents: [
          { id: `requested_${valueType}`, terms: [valueType], value_type: valueType },
        ],
        labelShapes: [`requested_value_type:${valueType}`],
      }),
    );
  }
  return targets;
}

export function verifyFallbackPassClosureContract({
  firstDraftContract,
  publicObligationDirective = null,
  learnerText,
  recentTutorTexts = [],
} = {}) {
  const sourceProgression = firstDraftContract?.progression;
  const sourceObligation = sourceProgression?.public_obligation_contract;
  const directive = publicObligationDirective || (sourceObligation?.active ? directiveFromCompiled(sourceObligation) : null);
  if (!directive) return null;
  const compiled = compileTutorStubTurnProgressionContract({
    learnerText: learnerText || sourceProgression?.learner_uptake?.learner_surface || '',
    responseCompositionFrame: {
      learner_move: {
        summary:
          sourceProgression?.learner_uptake?.accepted_meaning ||
          sourceProgression?.learner_uptake?.learner_surface ||
          learnerText ||
          '',
      },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    dramaticReleaseFrame: { active: false, entries: [] },
    actionFamily: 'answer_accountably',
    publicObligationDirective: directive,
  });
  const fallbackUptake = deterministicTutorStubTurnProgressionUptake({ contract: compiled });
  // Exercise the exact ownership boundary against the historical composer bug:
  // two copies enter, exactly one target-aware terminal sentence must leave.
  const fallbackText = ensureTutorStubPublicObligationFallbackOwnership({
    text: `${fallbackUptake} ${fallbackUptake}`,
    obligationUptake: fallbackUptake,
    turnProgressionContract: compiled,
  });
  const progression = auditTutorStubLiveTurnProgressionV1({
    contract: compiled,
    text: fallbackText,
    responseComposition: { segments: { uptake: fallbackText, development: '' } },
    authoredSourceTexts: [],
  });
  const repetition = auditTutorStubRepetitionResponse({ text: fallbackText, recentTutorTexts });
  const issueRows = [
    ...(progression.issues || []).map((issue) => ({ ...issue, guard: 'live_turn_progression_v1' })),
    ...(repetition.issues || []).map((issue) => ({ ...issue, guard: 'repetition' })),
    // These are the two style-only findings direction 035 explicitly makes
    // advisory on the terminal fallback, and hard/repairable on model drafts.
    { guard: 'response_composition', type: 'generic_learner_uptake' },
    { guard: 'adaptive_warrant_delivery', type: 'selected_action_family_not_visible' },
  ];
  const finalResponseCheck = decideTutorStubGuardDelivery(issueRows, {
    boundaryPolicy: 'shadow_advisory',
    terminalFallback: true,
  });
  const duplicateCount = fallbackText.split(fallbackUptake).length - 1;
  return {
    targetSignature: compiled.public_obligation_contract?.target?.signature || null,
    compiledComplete: compiled.complete === true && compiled.public_obligation_contract?.complete === true,
    compileIssues: compiled.public_obligation_contract?.compile_issues || [],
    fallbackText,
    noQuestion: !fallbackText.includes('?'),
    duplicateCount,
    progressionOk: progression.ok,
    resolutionOk: progression.public_obligation?.resolved === true,
    progressionIssues: progression.issues,
    deliveryStatus: progression.public_obligation?.delivery?.status || null,
    repetitionOk: repetition.ok,
    repetitionIssues: repetition.issues,
    finalResponseCheckOk: finalResponseCheck.ok,
    hardIssues: finalResponseCheck.hardIssues,
    advisoryIssues: finalResponseCheck.advisoryIssues,
  };
}

export function runFallbackPassClosure({
  seed511Root = DEFAULTS.seed511Root,
  seed511FailedDrawsRoot = DEFAULTS.seed511FailedDrawsRoot,
  seed512Root = DEFAULTS.seed512Root,
} = {}) {
  const traces = [
    ...seed511SealedTraces(seed511Root),
    ...seed511FailedDrawTraces(seed511FailedDrawsRoot),
    ...seed512DeadTraces(seed512Root),
  ];
  const corpusSummary = Object.fromEntries(
    ['seed511_sealed', 'seed511_failed_draw', 'seed512_dead_child'].map((corpus) => {
      const rows = traces.filter((trace) => trace.corpus === corpus);
      return [
        corpus,
        {
          dialogues: rows.length,
          learnerTurns: rows.reduce((sum, row) => sum + row.contracts.length, 0),
          traceDigest: sha256(rows.map((row) => `${row.tracePath}\0${row.traceSha256}`).join('\n')),
        },
      ];
    }),
  );
  assert.equal(corpusSummary.seed511_sealed.learnerTurns, 176, 'seed-511 sealed corpus must contain 22 x 8 turns');
  assert.equal(corpusSummary.seed511_failed_draw.learnerTurns, 3, 'both seed-511 failed draws must retain all reached turns');
  assert.equal(corpusSummary.seed512_dead_child.learnerTurns, 6, 'both seed-512 dead children must contribute three turns');

  const checks = [];
  for (const trace of traces) {
    for (const { turn, directive } of trace.directives) {
      const contract = trace.contracts.find((row) => row.turn === turn)?.contract || null;
      const check = verifyFallbackPassClosureContract({
        firstDraftContract: contract,
        publicObligationDirective: directive,
        learnerText: trace.learnerTurns.get(turn),
        recentTutorTexts: [...trace.tutorTurns]
          .filter(([priorTurn]) => priorTurn < turn)
          .map(([, tutorText]) => tutorText)
          .filter(Boolean),
      });
      if (!check) continue;
      checks.push({ corpus: trace.corpus, tracePath: trace.tracePath, turn, ...check });
    }
  }
  const retainedChecks = [...checks];
  assert.ok(retainedChecks.length > 0, 'retained corpora expose no reachable obligation targets');
  const syntheticTargets = syntheticFallbackClosureTargets();
  const syntheticChecks = syntheticTargets.map(({ id, labelShapes, target }) => ({
    corpus: 'synthetic',
    syntheticTargetId: id,
    labelShapes,
    ...verifyFallbackPassClosureContract({
      publicObligationDirective: {
        obligation_id: `synthetic-closure-${id}`,
        target,
        acceptable_outcomes: ['bounded_public_answer', 'named_unavailability_with_concrete_next_step'],
      },
      learnerText: target.source_surface,
    }),
  }));
  checks.push(...syntheticChecks);
  for (const check of checks) {
    const location = check.syntheticTargetId || `${check.tracePath}:${check.turn}`;
    assert.equal(check.compiledComplete, true, `${location}: compile failed`);
    assert.equal(check.noQuestion, true, `${location}: fallback asks a question`);
    assert.equal(check.duplicateCount, 1, `${location}: fallback template repeated`);
    assert.equal(check.resolutionOk, true, `${location}: obligation resolution failed`);
    assert.ok(['deferred', 'satisfied'].includes(check.deliveryStatus), `${location}: unresolved`);
    assert.equal(check.repetitionOk, true, `${location}: repetition failed`);
    assert.equal(check.finalResponseCheckOk, true, `${location}: final response check failed`);
    assert.deepEqual(check.hardIssues, [], `${location}: hard final-check issues`);
  }
  const emittedKinds = [...new Set(syntheticTargets.map((row) => row.target.kind))].sort();
  const emittedLabelShapes = [...new Set(syntheticTargets.flatMap((row) => row.labelShapes))].sort();
  const emittedValueTypes = emittedLabelShapes
    .filter((shape) => shape.startsWith('requested_value_type:'))
    .map((shape) => shape.slice('requested_value_type:'.length))
    .sort();
  assert.deepEqual(emittedKinds, [...ADAPTIVE_WARRANT_SEMANTIC_TARGET_KINDS].sort(), 'synthetic target-kind gap');
  assert.deepEqual(
    emittedValueTypes,
    [...ADAPTIVE_WARRANT_SEMANTIC_VALUE_TYPES].sort(),
    'synthetic requested-value-type gap',
  );
  for (const shape of ['composite_terms', 'hyphenated_compound', 'writable_entry', 'generic_sentinel']) {
    assert.ok(emittedLabelShapes.includes(shape), `synthetic label-shape gap: ${shape}`);
  }
  const artifact = {
    schema: ADAPTIVE_WARRANT_FALLBACK_PASS_CLOSURE_SCHEMA,
    status: 'fallback_pass_closure_green',
    providerCalls: 0,
    corpusSummary,
    retainedReachableObligationOccurrences: retainedChecks.length,
    syntheticTargetCount: syntheticChecks.length,
    reachableObligationOccurrences: checks.length,
    uniqueTargetSignatures: [...new Set(checks.map((row) => row.targetSignature))].sort(),
    syntheticCoverage: {
      targetKinds: emittedKinds,
      labelShapes: emittedLabelShapes,
      requestedValueTypes: emittedValueTypes,
      unsupportedShapes: [],
    },
    checks,
  };
  artifact.closureDigest = sha256(JSON.stringify(artifact));
  return artifact;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--seed-511-root') options.seed511Root = value;
    else if (flag === '--seed-511-failed-draws-root') options.seed511FailedDrawsRoot = value;
    else if (flag === '--seed-512-root') options.seed512Root = value;
    else if (flag === '--out') options.out = value;
    else throw new Error(`unknown argument: ${flag}`);
    index += 1;
  }
  return options;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const { out, ...options } = parseArgs(process.argv.slice(2));
  const artifact = runFallbackPassClosure(options);
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  if (out) fs.writeFileSync(out, serialized);
  process.stdout.write(serialized);
}
