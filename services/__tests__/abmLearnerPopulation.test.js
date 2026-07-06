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
  classifyDraft,
  loadAllPersonas,
  loadPersona,
  scoreOnTopicEngagement,
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
