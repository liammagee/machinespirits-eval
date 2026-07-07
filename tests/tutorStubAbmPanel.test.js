import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PERSONA_IDS,
  autoTurnsArg,
  buildAbmAutoLearnerProfile,
  buildPanelDraws,
  selectedPersonaIds,
  summarizePanelRows,
  summarizeTutorStubTranscript,
} from '../scripts/run-tutor-stub-abm-panel.js';

describe('tutor-stub ABM panel helpers', () => {
  it('loads the canonical 9-persona panel and builds repeated draws', () => {
    const ids = selectedPersonaIds('all');
    assert.deepEqual(ids, [...DEFAULT_PERSONA_IDS]);
    const draws = buildPanelDraws({ personaIds: ids.slice(0, 2), runs: 2 });
    assert.deepEqual(draws, [
      { personaId: ids[0], repeat: 1 },
      { personaId: ids[0], repeat: 2 },
      { personaId: ids[1], repeat: 1 },
      { personaId: ids[1], repeat: 2 },
    ]);
  });

  it('defaults ABM panel runs to until-grounded rather than a fixed turn cap', () => {
    assert.equal(autoTurnsArg({ turns: 'until-grounded', 'until-grounded': false }), 'until-grounded');
    assert.equal(autoTurnsArg({ turns: '8', 'until-grounded': false }), '8');
    assert.equal(autoTurnsArg({ turns: '8', 'until-grounded': true }), 'until-grounded');
  });

  it('renders an ABM persona into an automated learner profile', () => {
    const profile = buildAbmAutoLearnerProfile('abm_novice_boredom_pinned');
    assert.match(profile, /Persona id: abm_novice_boredom_pinned/);
    assert.match(profile, /Resistance style: boredom/);
    assert.match(profile, /Sycophancy mode: pinned/);
    assert.match(profile, /Your Formal Interior/);
    assert.match(profile, /Do not mention ABM ids/);
  });

  it('summarizes tutor-stub transcripts with canonical register aliases', () => {
    const row = summarizeTutorStubTranscript({
      personaId: 'abm_novice_boredom_pinned',
      repeat: 1,
      transcript: {
        turns: [
          {
            learner: 'What evidence matters?',
            tutor: 'Name one distinction.',
            registerSelection: {
              selected_register: 'clarity',
              action_family: 'clarify_distinction',
              request_type: 'conceptual_clarity_request',
            },
            previousRegisterEfficacy: null,
            tutorLearnerDagModel: {
              assessment: { bestPathCoverage: 0.2, bottleneck: 'release_or_pacing_gap' },
              metrics: { missingPremiseCount: 5 },
            },
            tutorLeakAudit: { ok: true },
          },
          {
            learner: 'This is boring.',
            tutor: 'Then test one claim.',
            registerSelection: {
              selected_register: 'charismatic_challenge',
              action_family: 'challenge_resistance',
              request_type: 'resistance_or_low_agency',
            },
            previousRegisterEfficacy: {
              selected_register: 'clarity',
              label: 'positive_progress',
              progressScore: 3.5,
            },
            tutorLearnerDagModel: {
              assessment: {
                bestPathCoverage: 0.5,
                bottleneck: 'release_or_pacing_gap',
                finalSecretEntailed: false,
                assertedSecret: false,
              },
              metrics: { missingPremiseCount: 3 },
            },
            tutorLeakAudit: { ok: false },
          },
        ],
      },
    });

    assert.equal(row.registerCounts.precise, 1);
    assert.equal(row.registerCounts.charismatic, 1);
    assert.equal(row.actionFamilyCounts.clarify_distinction, 1);
    assert.equal(row.actionFamilyCounts.challenge_resistance, 1);
    assert.equal(row.efficacyCounts.positive_progress, 1);
    assert.equal(row.leakCount, 1);
    assert.equal(row.bestPathCoverage, 0.5);
    assert.equal(row.missingPremiseCount, 3);
  });

  it('aggregates success and register variety by ABM dimensions', () => {
    const rows = [
      {
        status: 'ok',
        personaId: 'abm_novice_boredom_pinned',
        capabilityTier: 'novice',
        resistanceStyle: 'boredom',
        groundedClosure: false,
        bestPathCoverage: 0.25,
        registers: ['precise', 'charismatic'],
      },
      {
        status: 'ok',
        personaId: 'abm_advanced_compliant_unpinned',
        capabilityTier: 'advanced',
        resistanceStyle: 'compliant',
        groundedClosure: true,
        bestPathCoverage: 1,
        registers: ['plain', 'precise'],
      },
    ];
    const summary = summarizePanelRows(rows);
    assert.equal(summary.rows, 2);
    assert.equal(summary.grounded, 1);
    assert.equal(summary.meanCoverage, 0.625);
    assert.equal(summary.byResistance.boredom.rows, 1);
    assert.equal(summary.byResistance.compliant.grounded, 1);
    assert.equal(summary.registerCounts.precise, 2);
  });
});
