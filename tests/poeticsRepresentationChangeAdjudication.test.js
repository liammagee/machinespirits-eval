import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  adjudicatePoeticsLearnerActionalChange,
  adjudicatePoeticsMechanismChange,
} from '../services/poeticsRepresentationChangeAdjudication.js';
import {
  ANALYZER_VERSION,
  SEMANTIC_ADJUDICATION_PACKET_SCHEMA,
  SEMANTIC_ANALYZER_VERSION,
  analyzePeripeteia,
  analyzeTraceForTutorAdaptation,
  buildAnalysis,
  loadSemanticAdjudicationPacket,
  persistAnalysis,
  renderCsv as renderAdaptationCsv,
} from '../scripts/analyze-poetics-tutor-adaptation.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsRun,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'tests/fixtures/poetics/edra-m3-representation-change.json'), 'utf8'),
);
const byId = new Map(fixture.cases.map((row) => [row.id, row]));

function instrumentedTrace(turns) {
  return [
    ...turns,
    {
      phase: 'tutor',
      turnNumber: 2,
      learnerReversalEventUsed: {
        turnNumber: 1,
        triggerType: 'resistance',
        confidence: 0.8,
      },
      internalDeliberation: [
        { role: 'superego', content: 'MECHANISM_ROUTE: prior public device -> proposed public device' },
        {
          role: 'ego',
          content: 'PRIVATE_DECISION: revise. ADAPTIVE_MECHANISM: prior public device -> proposed public device',
        },
      ],
    },
  ];
}

function turnsFor(row) {
  return [
    { phase: 'learner', turnNumber: 0, text: 'I am still using the first way of reading this.' },
    { phase: 'tutor', turnNumber: 1, text: row.pre_tutor },
    { phase: 'learner', turnNumber: 1, text: row.pre_learner },
    { phase: 'tutor', turnNumber: 2, text: row.post_tutor },
    { phase: 'learner', turnNumber: 2, text: row.post_learner },
  ];
}

function adjudicateTutor(row, judgments = row.tutor_judgments) {
  return adjudicatePoeticsMechanismChange({
    beforeText: row.pre_tutor,
    afterText: row.post_tutor,
    judgments,
  });
}

describe('poetics semantic change adjudication', () => {
  it('applies stored tutor and learner hit, miss, ambiguity, and disagreement fixtures', () => {
    for (const row of fixture.cases) {
      const tutor = adjudicateTutor(row);
      assert.equal(tutor.status, row.expected_status, row.id);
      assert.equal(tutor.value, row.expected_mechanism_value, row.id);
      assert.equal(tutor.representation_change_measurement.value, row.expected_representation_value, row.id);
      assert.equal(tutor.lexical_or_regex_authority, 'none', row.id);
      assert.equal(tutor.outcome_selection_allowed, false, row.id);
      assert.equal(tutor.historical_recompute_allowed, false, row.id);

      if (row.learner_judgments.length) {
        const learner = adjudicatePoeticsLearnerActionalChange({
          beforeText: row.pre_learner,
          afterText: row.post_learner,
          judgments: row.learner_judgments,
        });
        assert.equal(learner.value, row.expected_learner_value, row.id);
        assert.equal(learner.subject_role, 'learner');
      }
    }
  });

  it('distinguishes ambiguity, disagreement, identity padding, and invalid change descriptions', () => {
    const ambiguity = byId.get('judge_ambiguity');
    const ambiguousResult = adjudicateTutor(ambiguity);
    assert.ok(ambiguousResult.reasons.includes('mock-sonnet:judge_indeterminate'));
    assert.ok(!ambiguousResult.reasons.includes('semantic_label_disagreement'));
    assert.deepEqual(ambiguousResult.eligible_judges, ['mock-sol']);

    const disagreement = byId.get('judge_disagreement');
    const disagreementResult = adjudicateTutor(disagreement);
    assert.ok(disagreementResult.reasons.includes('semantic_label_disagreement'));
    assert.equal(
      disagreementResult.validation.every((row) => row.issue === null),
      true,
    );
    assert.equal(disagreementResult.representation_change_measurement.status, 'measurement_indeterminate');

    const valid = byId.get('d42_semantic_change_regex_miss');
    const paddedDuplicate = structuredClone(valid.tutor_judgments);
    paddedDuplicate[1].judge_id = ` ${paddedDuplicate[0].judge_id} `;
    assert.ok(adjudicateTutor(valid, paddedDuplicate).reasons.includes('duplicate_judge_id'));

    const unchanged = structuredClone(valid.tutor_judgments);
    unchanged[0].to_state = unchanged[0].from_state;
    assert.equal(adjudicateTutor(valid, unchanged).validation[0].issue, 'unchanged_from_and_to_state');

    const caseOnly = structuredClone(valid.tutor_judgments);
    caseOnly[0].from_state = 'Diagram';
    caseOnly[0].to_state = 'diagram';
    assert.equal(adjudicateTutor(valid, caseOnly).validation[0].issue, 'unchanged_from_and_to_state');

    const counterexample = byId.get('nonrepresentational_counterexample_change');
    const vagueKind = structuredClone(counterexample.tutor_judgments);
    vagueKind[0].change_kind = 'other';
    assert.equal(adjudicateTutor(counterexample, vagueKind).validation[0].issue, 'invalid_change_kind');
  });

  it('credits a semantic representation swap and mirrored learner change despite a regex miss', () => {
    const row = byId.get('d42_semantic_change_regex_miss');
    const turns = turnsFor(row);
    const result = analyzePeripeteia(turns, instrumentedTrace(turns), {
      tutorAdaptationPolicy: 'peripeteia',
      tutorMechanismJudgments: row.tutor_judgments,
      learnerActionJudgments: row.learner_judgments,
    });

    assert.deepEqual(result.novel_mechanism_hits, []);
    assert.equal(result.tutor_adaptive_mechanism_measurement.status, 'determinate');
    assert.equal(result.tutor_representation_change_measurement.value, true);
    assert.equal(result.learner_actional_change_measurement.value, true);
    assert.equal(result.learner_representation_change_measurement.value, true);
    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.equal(result.auxiliary_mechanism_signals.lexical_or_regex_authority, 'none');
  });

  it('credits a non-representational semantic mechanism without forcing it false', () => {
    const row = byId.get('nonrepresentational_counterexample_change');
    const turns = turnsFor(row);
    const result = analyzePeripeteia(turns, instrumentedTrace(turns), {
      tutorAdaptationPolicy: 'peripeteia',
      tutorMechanismJudgments: row.tutor_judgments,
      learnerActionJudgments: row.learner_judgments,
    });

    assert.equal(result.tutor_adaptive_mechanism_measurement.value, true);
    assert.equal(result.tutor_adaptive_mechanism_measurement.change_kind, 'counterexample_case');
    assert.equal(result.tutor_representation_change_measurement.value, false);
    assert.equal(result.tutor_adaptive_mechanism, true);
    assert.equal(result.learner_actional_change_measurement.value, true);
  });

  it('does not mint tutor or learner change from auxiliary regex hits', () => {
    const row = byId.get('generic_redraw_regex_hit_semantic_no');
    const turns = turnsFor(row);
    const result = analyzePeripeteia(turns, instrumentedTrace(turns), {
      tutorAdaptationPolicy: 'peripeteia',
      tutorMechanismJudgments: row.tutor_judgments,
      learnerActionJudgments: row.learner_judgments,
    });

    assert.ok(result.novel_mechanism_hits.length > 0);
    assert.equal(result.tutor_adaptive_mechanism_measurement.value, false);
    assert.equal(result.tutor_representation_change_measurement.value, false);
    assert.equal(result.learner_actional_change_measurement.value, false);
    assert.equal(result.tutor_adaptive_mechanism, false);
    assert.ok(result.tutor_peripeteia_score < 50);
  });

  it('keeps missing tutor and learner semantic evidence tri-state', () => {
    const row = byId.get('d42_semantic_change_regex_miss');
    const turns = turnsFor(row);
    const result = analyzePeripeteia(turns, instrumentedTrace(turns), {
      tutorAdaptationPolicy: 'peripeteia',
      tutorMechanismJudgments: [],
      learnerActionJudgments: [],
    });
    assert.equal(result.tutor_adaptive_mechanism_measurement.status, 'measurement_indeterminate');
    assert.equal(result.learner_actional_change_measurement.status, 'measurement_indeterminate');
    assert.equal(result.tutor_adaptive_mechanism, null);
    assert.equal(result.tutor_peripeteia_score, null);

    const trace = {
      run: { tutor_adaptation_policy: 'peripeteia' },
      turns: instrumentedTrace(turns).map((turn) => ({ ...turn, externalMessage: turn.text })),
    };
    const analyzed = analyzeTraceForTutorAdaptation({
      itemId: 'missing-semantic-fixture',
      trace,
      tutorMechanismJudgments: [],
      learnerActionJudgments: [],
    });
    assert.equal(analyzed.analyzerVersion, SEMANTIC_ANALYZER_VERSION);
    assert.equal(analyzed.learnerSelfReframe, null);
    assert.equal(analyzed.metadata.peripeteia.tutor_adaptive_mechanism_measurement.status, 'measurement_indeterminate');
    assert.match(analyzed.metadata.analysis_provenance.source_trace_sha256, /^[a-f0-9]{64}$/);

    const [headerLine, valueLine] = renderAdaptationCsv([
      { runId: 'fixture', unitId: 'target-r01', arm: 'peripeteia-only', tid: 'T01', dramaId: 'D42', ...analyzed },
    ])
      .trimEnd()
      .split('\n');
    const header = headerLine.split(',');
    const values = valueLine.split(',');
    assert.equal(values[header.indexOf('learner_self_reframe')], '');
    assert.equal(values[header.indexOf('tutor_contingent_adaptation')], '');
    assert.equal(values[header.indexOf('tutor_adaptive_mechanism_measurement_status')], 'measurement_indeterminate');
    assert.equal(values[header.indexOf('learner_actional_change_measurement_status')], 'measurement_indeterminate');
  });

  it('loads a hashed semantic packet and preserves v4 beside create-once v5', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-semantic-persistence-'));
    const packetPath = path.join(root, 'packet.json');
    const row = byId.get('d42_semantic_change_regex_miss');
    fs.writeFileSync(
      packetPath,
      `${JSON.stringify({
        schema: SEMANTIC_ADJUDICATION_PACKET_SCHEMA,
        items: {
          semantic_item: {
            tutor_judgments: row.tutor_judgments,
            learner_judgments: row.learner_judgments,
          },
        },
      })}\n`,
      'utf8',
    );
    const packet = loadSemanticAdjudicationPacket(packetPath);
    assert.equal(packet.items.semantic_item.tutor_judgments.length, 2);
    assert.match(packet._localProvenance.sha256, /^[a-f0-9]{64}$/);

    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      upsertPoeticsRun(db, {
        id: 'semantic-run',
        sourceRoot: root,
        batchId: 'semantic-run',
        generator: 'mock',
        metadata: {},
      });
      upsertPoeticsItem(db, {
        id: 'semantic_item',
        runId: 'semantic-run',
        unitId: 'target-r01',
        repeat: 'r01',
        arm: 'peripeteia-only',
        tid: 'T01',
        dramaId: 'D42',
        discipline: 'physics',
        condition: 'peripeteia-only',
        intendedLean: 'recognition',
        samplePath: 'sample/T01.txt',
        fullTranscriptPath: 'transcripts/T01.full.md',
        keyPath: 'key.yaml',
        qualityStatus: 'ok',
        qualityWarnings: [],
        metadata: {},
      });
      upsertPoeticsTutorAdaptation(db, {
        itemId: 'semantic_item',
        analyzerVersion: ANALYZER_VERSION,
        sharedSalientTerms: [],
        metadata: { historical: true },
      });

      const turns = turnsFor(row);
      const trace = {
        run: { tutor_adaptation_policy: 'peripeteia' },
        turns: instrumentedTrace(turns).map((turn) => ({ ...turn, externalMessage: turn.text })),
      };
      const semantic = analyzeTraceForTutorAdaptation({
        itemId: 'semantic_item',
        trace,
        tutorMechanismJudgments: row.tutor_judgments,
        learnerActionJudgments: row.learner_judgments,
      });
      persistAnalysis(db, [semantic]);

      const versions = db
        .prepare('SELECT analyzer_version FROM poetics_tutor_adaptations WHERE item_id = ? ORDER BY analyzer_version')
        .all('semantic_item')
        .map((entry) => entry.analyzer_version);
      assert.deepEqual(versions, [ANALYZER_VERSION, SEMANTIC_ANALYZER_VERSION]);
      assert.throws(() => persistAnalysis(db, [semantic]), /create-once/);
    } finally {
      db.close();
    }
  });

  it('persists v5 indeterminacy in canonical metadata despite legacy boolean sentinels', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-semantic-indeterminate-store-'));
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      upsertPoeticsRun(db, {
        id: 'semantic-indeterminate-run',
        sourceRoot: root,
        batchId: 'semantic-indeterminate-run',
        generator: 'mock',
        metadata: {},
      });
      upsertPoeticsItem(db, {
        id: 'semantic_indeterminate_item',
        runId: 'semantic-indeterminate-run',
        unitId: 'target-r01',
        repeat: 'r01',
        arm: 'peripeteia-only',
        tid: 'T02',
        dramaId: 'D42',
        discipline: 'physics',
        condition: 'peripeteia-only',
        intendedLean: 'recognition',
        metadata: {},
      });
      const fixtureRow = byId.get('d42_semantic_change_regex_miss');
      const turns = turnsFor(fixtureRow);
      const trace = {
        run: { tutor_adaptation_policy: 'peripeteia' },
        turns: instrumentedTrace(turns).map((turn) => ({ ...turn, externalMessage: turn.text })),
      };
      const analysis = analyzeTraceForTutorAdaptation({
        itemId: 'semantic_indeterminate_item',
        trace,
        tutorMechanismJudgments: [],
        learnerActionJudgments: [],
      });
      persistAnalysis(db, [analysis]);

      const stored = db
        .prepare(
          `SELECT learner_self_reframe, tutor_contingent_adaptation, metadata
           FROM poetics_tutor_adaptations
           WHERE item_id = ? AND analyzer_version = ?`,
        )
        .get('semantic_indeterminate_item', SEMANTIC_ANALYZER_VERSION);
      const metadata = JSON.parse(stored.metadata);
      assert.equal(stored.learner_self_reframe, 0);
      assert.equal(stored.tutor_contingent_adaptation, 0);
      assert.equal(metadata.peripeteia.tutor_adaptive_mechanism_measurement.status, 'measurement_indeterminate');
      assert.equal(metadata.peripeteia.learner_actional_change_measurement.status, 'measurement_indeterminate');
      assert.equal(metadata.semantic_storage_compatibility.sentinel_is_not_a_negative_measurement, true);
    } finally {
      db.close();
    }
  });

  it('rejects an incomplete semantic packet before consuming any create-once slot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-semantic-incomplete-packet-'));
    const packetPath = path.join(root, 'incomplete-packet.json');
    fs.writeFileSync(
      packetPath,
      `${JSON.stringify({ schema: SEMANTIC_ADJUDICATION_PACKET_SCHEMA, items: {} })}\n`,
      'utf8',
    );
    const db = openPoeticsStore(path.join(root, 'poetics.db'));
    try {
      upsertPoeticsRun(db, {
        id: 'semantic-incomplete-run',
        sourceRoot: root,
        batchId: 'semantic-incomplete-run',
        generator: 'mock',
        metadata: {},
      });
      upsertPoeticsItem(db, {
        id: 'semantic_incomplete_item',
        runId: 'semantic-incomplete-run',
        unitId: 'target-r01',
        repeat: 'r01',
        arm: 'peripeteia-only',
        tid: 'T03',
        dramaId: 'D42',
        discipline: 'physics',
        condition: 'peripeteia-only',
        intendedLean: 'recognition',
        metadata: {},
      });
      assert.throws(
        () =>
          buildAnalysis(db, {
            runId: 'semantic-incomplete-run',
            targetOnly: true,
            semanticAdjudicationsPath: packetPath,
          }),
        /semantic adjudication packet coverage is incomplete.*semantic_incomplete_item/,
      );
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poetics_tutor_adaptations').get().n, 0);
    } finally {
      db.close();
    }
  });
});
