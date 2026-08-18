import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNT_SCHEMA,
  countAdaptiveWarrantDefensiveActs,
  countAdaptiveWarrantDefensiveActsForTurn,
  summarizeAdaptiveWarrantDefensiveActs,
} from '../services/adaptiveWarrantDefensiveActCounts.js';
import { reportDefensiveActsForTargets } from '../scripts/report-adaptive-warrant-defensive-acts.js';
import { ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA } from '../services/adaptiveWarrantSemanticEvents.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Smoke C is a real guarded-pole run and is gitignored like every other run
// artifact, so the checks over it run only where it exists.
const SMOKE_C = path.join(ROOT, '.tutor-stub-auto-eval/guarded-learner-smoke-C-s550-2026-08-15');
const SMOKE_C_SKIP = fs.existsSync(SMOKE_C) ? false : `smoke C run absent (${SMOKE_C}); archived in the private repo`;

function event(speechAct, status = 'accepted') {
  return { event_id: `${speechAct}-${status}`, speech_act: speechAct, validation: { status } };
}

function turn({ turn: turnNumber = 1, status = 'accepted', events = [], schema, labels = [] } = {}) {
  return {
    turn: turnNumber,
    learner_signal: { labels },
    semantic_event_extraction: {
      schema: schema ?? ADAPTIVE_WARRANT_SEMANTIC_VALIDATION_SCHEMA,
      source_turn: turnNumber,
      extraction_status: status,
      events,
    },
  };
}

test('endpoint 5 counts only the three defensive acts', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn(
    turn({
      events: [
        event('learner_overclaim_assertion'),
        event('learner_evidence_dismissal'),
        event('learner_evidence_demand'),
        event('learner_proposed_test'),
        event('analytic_contribution'),
      ],
    }),
  );
  assert.equal(row.measured, true);
  assert.deepEqual(row.counts, {
    learner_overclaim_assertion: 1,
    learner_evidence_dismissal: 1,
    learner_evidence_demand: 1,
  });
  assert.equal(row.total, 3);
});

test('an uncertain envelope is still measured, because the gate acted on it', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn(
    turn({ status: 'uncertain', events: [event('learner_overclaim_assertion', 'uncertain')] }),
  );
  assert.equal(row.measured, true);
  assert.equal(row.extraction_status, 'uncertain');
  assert.equal(row.counts.learner_overclaim_assertion, 1);
});

test('an invalid envelope is named unmeasured rather than counted as a zero', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn(
    turn({ status: 'invalid', events: [event('learner_overclaim_assertion')] }),
  );
  assert.equal(row.measured, false);
  assert.equal(row.reason, 'extraction_status_invalid');
  assert.equal(row.counts.learner_overclaim_assertion, 0);
});

test('a pre-v3.3 extraction is refused, which is the reason for reading the live path', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn(
    turn({ schema: 'machinespirits.adaptation-refinement.semantic-event-validation.v3', events: [] }),
  );
  assert.equal(row.measured, false);
  assert.equal(row.reason, 'extraction_schema_predates_v3.3');
  assert.equal(row.observed_schema, 'machinespirits.adaptation-refinement.semantic-event-validation.v3');
});

test('a turn with no extraction is unmeasured', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn({ turn: 4 }, { turn: 4 });
  assert.equal(row.measured, false);
  assert.equal(row.reason, 'no_semantic_event_extraction');
  assert.equal(row.turn, 4);
});

test('a rejected defensive event is dropped and reported', () => {
  const row = countAdaptiveWarrantDefensiveActsForTurn(
    turn({
      events: [event('learner_evidence_demand', 'rejected'), event('learner_evidence_demand', 'accepted')],
    }),
  );
  assert.equal(row.counts.learner_evidence_demand, 1);
  assert.equal(row.rejected_defensive_events, 1);
});

test('a dialogue reports its unmeasured turns and never hides them in the totals', () => {
  const dialogue = countAdaptiveWarrantDefensiveActs({
    dialogueId: 'd1',
    decisions: [
      turn({ turn: 1, events: [event('learner_overclaim_assertion')], labels: ['defended_overclaim'] }),
      turn({ turn: 2, status: 'invalid', events: [event('learner_overclaim_assertion')] }),
      turn({ turn: 3, events: [event('learner_evidence_dismissal')] }),
    ],
  });
  assert.equal(dialogue.schema, ADAPTIVE_WARRANT_DEFENSIVE_ACT_COUNT_SCHEMA);
  assert.equal(dialogue.report_only, true);
  assert.equal(dialogue.measured_turn_count, 2);
  assert.deepEqual(dialogue.unmeasured_turns, [
    { turn: 2, reason: 'extraction_status_invalid', observed_schema: null },
  ]);
  assert.equal(dialogue.total, 2);
  assert.deepEqual(dialogue.defended_overclaim_signal_turns, [1]);

  const summary = summarizeAdaptiveWarrantDefensiveActs([dialogue]);
  assert.equal(summary.complete, false);
  assert.equal(summary.unmeasured_turn_count, 1);
});

test('a fully measured set reports complete', () => {
  const dialogue = countAdaptiveWarrantDefensiveActs({
    decisions: [turn({ turn: 1, events: [event('learner_evidence_demand')] })],
  });
  assert.equal(summarizeAdaptiveWarrantDefensiveActs([dialogue]).complete, true);
});

test('the smoke C run reads end to end from the live gate trace', { skip: SMOKE_C_SKIP }, () => {
  const summary = reportDefensiveActsForTargets([SMOKE_C]);
  assert.equal(summary.dialogue_count, 1);
  assert.equal(summary.turn_count, 8);
  assert.equal(summary.complete, true, 'every turn of a real guarded run must be measurable');
  assert.deepEqual(summary.totals, {
    learner_overclaim_assertion: 7,
    learner_evidence_dismissal: 1,
    learner_evidence_demand: 0,
  });
  // The gate's own engagement label and the counts come from one extraction, so
  // a defended-over-claim turn must carry at least one defensive act.
  const [dialogue] = summary.dialogues;
  for (const turnNumber of dialogue.defended_overclaim_signal_turns) {
    const row = dialogue.turns.find((entry) => entry.turn === turnNumber);
    assert.ok(row.total > 0, `turn ${turnNumber} is labelled defended_overclaim but counts no defensive act`);
  }
});
