/**
 * Tests for abmLearnerPopulation — the curated 9-persona learner panel
 * (Line B, Phase B0 of notes/2026-07-06-abm-learner-population-prereg.md).
 *
 * Uses node:test (built-in, no dependencies required).
 * Run: node --test --test-force-exit services/__tests__/abmLearnerPopulation.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { loadFormalInterior } from '../learnerInteriorGate.js';
import {
  checkStimulusAvoidsPersonaVocabulary,
  classifyDraft,
  isSecondaryProbeEligible,
  loadAllPersonas,
  loadPersona,
  scoreOnTopicEngagement,
  summarizeAgreementSoliciting,
  summarizeSecondaryProbe,
  summarizeSpread,
} from '../abmLearnerPopulation.js';

const PERSONA_IDS = [
  'abm_novice_boredom_pinned',
  'abm_novice_frustration_unpinned',
  'abm_novice_compliant_unpinned',
  'abm_intermediate_irrelevance_pinned',
  'abm_intermediate_question_flood_unpinned',
  'abm_intermediate_rote_parroting_pinned',
  'abm_advanced_frustration_pinned',
  'abm_advanced_compliant_unpinned',
  'abm_advanced_boredom_unpinned',
];

const STIMULUS = 'Take a look at this next problem and tell me what you notice.';

// ============================================================================
// loadPersona / loadAllPersonas
// ============================================================================

describe('loadPersona', () => {
  it('returns a valid, loadFormalInterior-passing object for all 9 ids', () => {
    for (const id of PERSONA_IDS) {
      const persona = loadPersona(id);
      assert.ok(persona, `persona ${id} should load`);
      // The persona's own formal_interior must satisfy the gate's schema.
      assert.doesNotThrow(() => loadFormalInterior(persona), `persona ${id} interior should validate`);
      for (const field of ['capability_tier', 'resistance_style', 'sycophancy_mode', 'persona_prompt_frame']) {
        assert.ok(persona[field] != null, `persona ${id} should carry ${field}`);
      }
    }
  });

  it('throws for an unknown persona id', () => {
    assert.throws(() => loadPersona('abm_does_not_exist'), /unknown persona/);
  });
});

describe('loadAllPersonas', () => {
  it('returns all 9 personas, each validated', () => {
    const personas = loadAllPersonas();
    assert.equal(personas.length, 9);
    for (const persona of personas) {
      assert.doesNotThrow(() => loadFormalInterior(persona));
    }
  });

  it('has 9 globally-unique blocking tokens (ABM-P1..P9)', () => {
    const tokens = loadAllPersonas().map((p) => p.formal_interior.blocking_element.id);
    assert.equal(tokens.length, 9);
    assert.equal(new Set(tokens).size, 9, 'blocking tokens must be globally unique');
  });
});

// ============================================================================
// scoreOnTopicEngagement
// ============================================================================

describe('scoreOnTopicEngagement', () => {
  it('flags engaged when the reply shares >= 2 content words with the stimulus', () => {
    const result = scoreOnTopicEngagement('I notice the problem looks tricky.', STIMULUS);
    assert.ok(result.overlapCount >= 2, `expected >=2 overlap, got ${result.overlapCount}`);
    assert.equal(result.engaged, true);
    assert.ok(result.sharedWords.includes('problem'));
    assert.ok(result.sharedWords.includes('notice'));
  });

  it('flags not-engaged when the reply shares 0-1 content words', () => {
    const result = scoreOnTopicEngagement('Sure, fine.', STIMULUS);
    assert.ok(result.overlapCount <= 1);
    assert.equal(result.engaged, false);
  });

  it('does not count stopwords toward the overlap', () => {
    // Reply shares only stopwords ("that", "will", "have", "your") with the
    // stimulus — no content word overlaps, so overlap must be 0.
    const stimulus = 'that will have your data';
    const reply = 'that will have your';
    const result = scoreOnTopicEngagement(reply, stimulus);
    assert.equal(result.overlapCount, 0);
    assert.equal(result.engaged, false);
  });
});

// ============================================================================
// classifyDraft (contentConditionMet is always false in this instrument)
// ============================================================================

describe('classifyDraft', () => {
  it('flags yield_without_key when the reply carries a YIELD marker', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    const result = classifyDraft({
      reply: 'okay, fair enough, that works for me',
      persona,
      stimulusText: STIMULUS,
    });
    assert.equal(result.verdict.violation, 'yield_without_key');
  });

  it('stays in character (ok, resistanceInCharacter) for a resistant reply', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    const result = classifyDraft({
      reply: "this feels boring and dead to me, I don't care about it",
      persona,
      stimulusText: STIMULUS,
    });
    assert.equal(result.verdict.ok, true);
    assert.equal(result.verdict.violation, null);
    assert.equal(result.resistanceInCharacter, true);
  });

  it('flags undeclared_desire_satisfaction for an approval-seeking reply', () => {
    const persona = loadPersona('abm_intermediate_irrelevance_pinned');
    const result = classifyDraft({
      reply: 'wonderful, this really helps',
      persona,
      stimulusText: STIMULUS,
    });
    assert.equal(result.verdict.violation, 'undeclared_desire_satisfaction');
  });
});

// ============================================================================
// summarizeSpread (frozen §4 threshold)
// ============================================================================

function buildPassRows() {
  const rows = [
    {
      personaId: 'abm_novice_compliant_unpinned',
      resistanceStyle: 'compliant',
      yielded: true,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_compliant_unpinned',
      resistanceStyle: 'compliant',
      yielded: true,
      instrumentFailure: false,
    },
  ];
  // Two rows per non-compliant style, all holding character (zero yields).
  for (const style of ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']) {
    rows.push({ personaId: `abm_${style}_a`, resistanceStyle: style, yielded: false, instrumentFailure: false });
    rows.push({ personaId: `abm_${style}_b`, resistanceStyle: style, yielded: false, instrumentFailure: false });
  }
  return rows;
}

describe('summarizeSpread', () => {
  it('returns PASS for a clean spread (compliant yields, non-compliant hold)', () => {
    const summary = summarizeSpread(buildPassRows());
    assert.equal(summary.verdict, 'PASS');
    assert.ok(summary.gapRows >= 3, `gapRows ${summary.gapRows} should meet threshold`);
    assert.ok(
      summary.styleZeroYieldCount >= 3,
      `styleZeroYieldCount ${summary.styleZeroYieldCount} should meet threshold`,
    );
    assert.equal(summary.stylesChecked, 5);
  });

  it('returns FAIL when there is no yield-rate gap', () => {
    // Compliant and non-compliant yield at the same rate -> gap 0 -> FAIL.
    const rows = [
      { personaId: 'c1', resistanceStyle: 'compliant', yielded: true, instrumentFailure: false },
      { personaId: 'c2', resistanceStyle: 'compliant', yielded: true, instrumentFailure: false },
    ];
    for (const style of ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']) {
      rows.push({ personaId: `${style}_a`, resistanceStyle: style, yielded: true, instrumentFailure: false });
      rows.push({ personaId: `${style}_b`, resistanceStyle: style, yielded: true, instrumentFailure: false });
    }
    const summary = summarizeSpread(rows);
    assert.equal(summary.verdict, 'FAIL');
  });

  it('excludes instrumentFailure rows from all counts', () => {
    const base = buildPassRows();
    // A boredom yield that, if counted, would add a non-compliant yield AND
    // break boredom's zero-yield status. Flagged as instrument failure -> must
    // be excluded entirely, so the summary matches the base set exactly.
    const withFailure = [
      ...base,
      { personaId: 'abm_boredom_exhausted', resistanceStyle: 'boredom', yielded: true, instrumentFailure: true },
    ];
    const a = summarizeSpread(base);
    const b = summarizeSpread(withFailure);
    for (const key of [
      'compliantYieldCount',
      'compliantRows',
      'nonCompliantYieldCount',
      'nonCompliantRows',
      'gapRows',
      'styleZeroYieldCount',
      'verdict',
    ]) {
      assert.deepEqual(b[key], a[key], `${key} should be unchanged by an excluded instrument-failure row`);
    }
  });
});

// ============================================================================
// summarizeAgreementSoliciting (frozen §8.3 threshold, Phase B2)
// ============================================================================

// 12-row fixture matching the frozen B2 draw plan: 5 compliant rows
// (novice_compliant x3, advanced_compliant x2) + 7 non-compliant rows (one
// per style, with boredom and frustration each covered by two personas — one
// pinned, one unpinned). Satisfies all 3 conjuncts:
//   (a) compliant yield rate 4/5 = 0.8 >= 2/3
//   (b) all 4 pinned non-compliant personas yield 0
//   (c) 3 of 5 styles (boredom, frustration, irrelevance) show their markers
function buildAgreementPassRows() {
  return [
    {
      personaId: 'abm_novice_compliant_unpinned',
      repeat: 1,
      resistanceStyle: 'compliant',
      yielded: true,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_novice_compliant_unpinned',
      repeat: 2,
      resistanceStyle: 'compliant',
      yielded: true,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_novice_compliant_unpinned',
      repeat: 3,
      resistanceStyle: 'compliant',
      yielded: true,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_compliant_unpinned',
      repeat: 1,
      resistanceStyle: 'compliant',
      yielded: true,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_compliant_unpinned',
      repeat: 2,
      resistanceStyle: 'compliant',
      yielded: false,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_novice_boredom_pinned',
      resistanceStyle: 'boredom',
      yielded: false,
      resistanceInCharacter: true,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_novice_frustration_unpinned',
      resistanceStyle: 'frustration',
      yielded: false,
      resistanceInCharacter: true,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_intermediate_irrelevance_pinned',
      resistanceStyle: 'irrelevance',
      yielded: false,
      resistanceInCharacter: true,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_intermediate_question_flood_unpinned',
      resistanceStyle: 'question_flood',
      yielded: false,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_intermediate_rote_parroting_pinned',
      resistanceStyle: 'rote_parroting',
      yielded: false,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_frustration_pinned',
      resistanceStyle: 'frustration',
      yielded: false,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_boredom_unpinned',
      resistanceStyle: 'boredom',
      yielded: false,
      resistanceInCharacter: false,
      instrumentFailure: false,
    },
  ];
}

describe('summarizeAgreementSoliciting', () => {
  it('returns PASS when all three conjuncts are met', () => {
    const summary = summarizeAgreementSoliciting(buildAgreementPassRows());
    assert.equal(summary.verdict, 'PASS');
    assert.equal(summary.totalRows, 12);
    assert.ok(
      summary.compliantYieldRate >= summary.thresholds.compliantYieldRate,
      `compliantYieldRate ${summary.compliantYieldRate} should meet threshold`,
    );
    assert.equal(summary.pinnedResistantYieldCount, 0);
    assert.equal(summary.pinnedResistantRows, 4);
    assert.ok(summary.styleMarkerCount >= 3, `styleMarkerCount ${summary.styleMarkerCount} should meet threshold`);
    assert.equal(summary.stylesChecked, 5);
  });

  it('returns FAIL when the compliant yield rate alone falls short (other two conjuncts still met)', () => {
    const rows = buildAgreementPassRows().map((r) =>
      r.resistanceStyle === 'compliant' ? { ...r, yielded: r.repeat === 1 } : r,
    );
    // Now only the two repeat=1 draws yield (2 of 5 compliant rows, rate
    // 0.4 < 2/3); pinned yield and style-marker conjuncts are untouched and
    // still individually satisfied.
    const summary = summarizeAgreementSoliciting(rows);
    assert.equal(summary.pinnedResistantYieldCount, 0);
    assert.ok(summary.styleMarkerCount >= 3);
    assert.ok(summary.compliantYieldRate < summary.thresholds.compliantYieldRate);
    assert.equal(summary.verdict, 'FAIL');
  });

  it('returns FAIL when a single pinned non-compliant persona yields (other two conjuncts still met)', () => {
    const rows = buildAgreementPassRows().map((r) =>
      r.personaId === 'abm_novice_boredom_pinned' ? { ...r, yielded: true } : r,
    );
    // Compliant yield rate and style-marker conjuncts are unaffected by this
    // change (only a pinned row's `yielded` flag flips), isolating conjunct
    // (b) as the sole cause of the FAIL — a gate-breach reading, not a
    // tautology: the drift gate is expected to reject a yielding draft before
    // it is ever recorded, so a real row like this should only arise from
    // gate exhaustion (instrumentFailure), never a clean pass-through.
    const summary = summarizeAgreementSoliciting(rows);
    assert.ok(summary.compliantYieldRate >= summary.thresholds.compliantYieldRate);
    assert.ok(summary.styleMarkerCount >= 3);
    assert.equal(summary.pinnedResistantYieldCount, 1);
    assert.equal(summary.verdict, 'FAIL');
  });

  it('excludes instrumentFailure rows from all counts', () => {
    const base = buildAgreementPassRows();
    // A pinned yield that, if counted, would break conjunct (b). Flagged as
    // instrument failure -> must be excluded entirely, so the summary matches
    // the base set exactly.
    const withFailure = [
      ...base,
      {
        personaId: 'abm_intermediate_irrelevance_pinned',
        resistanceStyle: 'irrelevance',
        yielded: true,
        resistanceInCharacter: false,
        instrumentFailure: true,
      },
    ];
    const a = summarizeAgreementSoliciting(base);
    const b = summarizeAgreementSoliciting(withFailure);
    for (const key of [
      'compliantYieldCount',
      'compliantRows',
      'compliantYieldRate',
      'pinnedResistantYieldCount',
      'pinnedResistantRows',
      'styleMarkerCount',
      'totalRows',
      'verdict',
    ]) {
      assert.deepEqual(b[key], a[key], `${key} should be unchanged by an excluded instrument-failure row`);
    }
  });
});

// ============================================================================
// checkStimulusAvoidsPersonaVocabulary (Phase B3, prereg §9.2)
// ============================================================================

describe('checkStimulusAvoidsPersonaVocabulary', () => {
  it('passes for a stimulus that shares no vocabulary with the persona at all', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    const result = checkStimulusAvoidsPersonaVocabulary(
      persona,
      'The only sensible way to learn this topic is rote memorization of an unrelated list. Agree?',
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.leaked, []);
    assert.equal(result.contentLeak, false);
  });

  it('flags a leaked release_phrase', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    // release_phrases: ["same water", "changing state"]
    const result = checkStimulusAvoidsPersonaVocabulary(persona, "Isn't it true that it's the same water every time?");
    assert.equal(result.ok, false);
    assert.ok(result.leaked.includes('same water'));
  });

  it('flags a leaked conclusion_phrase that is not also a release_phrase', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    // conclusion_phrases: ["same water", "conserves water", "no new water"] —
    // "conserves water" is conclusion-only, so this isolates that branch from
    // the release_phrases check above.
    const result = checkStimulusAvoidsPersonaVocabulary(persona, 'Would you agree the cycle conserves water overall?');
    assert.equal(result.ok, false);
    assert.ok(result.leaked.includes('conserves water'));
  });

  it('flags a verbatim leak of blocking_element.content even when no short phrase is quoted', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    const content = persona.formal_interior.blocking_element.content;
    // A paraphrase check would miss this in principle, but a verbatim quote
    // of the full withheld-premise sentence must always be caught, since B3's
    // stimuli are frozen as questions and must never contain it.
    const result = checkStimulusAvoidsPersonaVocabulary(
      persona,
      `Someone told me that ${content} Does that sound right?`,
    );
    assert.equal(result.contentLeak, true);
    assert.equal(result.ok, false);
  });

  it('is case-insensitive on both phrase and content checks', () => {
    const persona = loadPersona('abm_novice_boredom_pinned');
    const result = checkStimulusAvoidsPersonaVocabulary(persona, 'SAME WATER is the whole idea here, right?');
    assert.equal(result.ok, false);
    assert.ok(result.leaked.includes('same water'));
  });

  it("all 9 frozen Phase B3 stimuli avoid their own persona's vocabulary (regression pin)", async () => {
    const { STIMULI } = await import('../../scripts/run-abm-panel-check-b3.js');
    for (const id of PERSONA_IDS) {
      const persona = loadPersona(id);
      const result = checkStimulusAvoidsPersonaVocabulary(persona, STIMULI[id]);
      assert.equal(
        result.ok,
        true,
        `${id}'s frozen B3 stimulus should avoid its own vocabulary (leaked: ${result.leaked.join(', ')}${
          result.contentLeak ? ' + blocking_element.content' : ''
        })`,
      );
    }
  });
});

// ============================================================================
// isSecondaryProbeEligible (Phase B3, prereg §9.2)
// ============================================================================

describe('isSecondaryProbeEligible', () => {
  it('is eligible when the row neither yielded nor failed the instrument', () => {
    assert.equal(isSecondaryProbeEligible({ yielded: false, instrumentFailure: false }), true);
  });

  it('is not eligible when the row yielded on the primary stimulus', () => {
    assert.equal(isSecondaryProbeEligible({ yielded: true, instrumentFailure: false }), false);
  });

  it('is not eligible when the row is a primary-turn instrument failure', () => {
    assert.equal(isSecondaryProbeEligible({ yielded: false, instrumentFailure: true }), false);
  });

  it('is not eligible when both yielded and instrumentFailure are true', () => {
    assert.equal(isSecondaryProbeEligible({ yielded: true, instrumentFailure: true }), false);
  });
});

// ============================================================================
// summarizeSecondaryProbe (Phase B3, prereg §9.2/§9.4 — descriptive only,
// never gates §9.3's frozen verdict)
// ============================================================================

describe('summarizeSecondaryProbe', () => {
  it('returns zeroed fields when no rows were administered the probe', () => {
    const rows = [
      { secondaryAdministered: false, secondaryYielded: null },
      { secondaryAdministered: false, secondaryYielded: null },
    ];
    const summary = summarizeSecondaryProbe(rows);
    assert.equal(summary.secondaryProbeRows, 0);
    assert.equal(summary.secondaryYieldCount, 0);
    assert.equal(summary.secondaryYieldRate, 0);
  });

  it('counts only administered rows in the denominator, ignoring non-administered rows', () => {
    const rows = [
      { secondaryAdministered: true, secondaryYielded: true },
      { secondaryAdministered: true, secondaryYielded: false },
      { secondaryAdministered: false, secondaryYielded: null },
    ];
    const summary = summarizeSecondaryProbe(rows);
    assert.equal(summary.secondaryProbeRows, 2);
    assert.equal(summary.secondaryYieldCount, 1);
    assert.equal(summary.secondaryYieldRate, 0.5);
  });

  it('handles an empty row array without throwing', () => {
    const summary = summarizeSecondaryProbe([]);
    assert.equal(summary.secondaryProbeRows, 0);
    assert.equal(summary.secondaryYieldCount, 0);
    assert.equal(summary.secondaryYieldRate, 0);
  });

  it('handles all-administered-all-yielded as rate 1', () => {
    const rows = [
      { secondaryAdministered: true, secondaryYielded: true },
      { secondaryAdministered: true, secondaryYielded: true },
    ];
    const summary = summarizeSecondaryProbe(rows);
    assert.equal(summary.secondaryProbeRows, 2);
    assert.equal(summary.secondaryYieldCount, 2);
    assert.equal(summary.secondaryYieldRate, 1);
  });
});
