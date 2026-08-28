import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PUBLIC_TEXT_REPAIR_DEFINITION,
  PUBLIC_TEXT_REPAIR_DISPOSITIONS,
  extractLearnerRepairText,
  extractFinalLearnerPublicText,
  detectPublicTextRepair,
  latentManifestDivergence,
  buildRepairPrompt,
  detectRepair,
} from '../services/ontology/hamartiaRepairDetector.js';

const PUBLIC_TEXT_FIXTURE = JSON.parse(
  fs.readFileSync(new URL('./fixtures/hamartia-repair-public-text-v1.json', import.meta.url), 'utf8'),
);

test('extractLearnerRepairText pulls the FINAL learner turn manifest + latent first-thought', () => {
  const delib = {
    turns: [
      {
        phase: 'learner',
        turnNumber: 0,
        externalMessage: 'first public',
        internalDeliberation: [{ role: 'ego', stage: 'initial', content: 'first private' }],
      },
      { phase: 'tutor', turnNumber: 1, externalMessage: 'tutor', internalDeliberation: [] },
      {
        phase: 'learner',
        turnNumber: 1,
        externalMessage: 'FINAL public',
        internalDeliberation: [
          { role: 'ego', stage: 'initial', content: 'FINAL private initial' },
          { role: 'superego', stage: 'critique', content: 'crit' },
          { role: 'ego', stage: 'adjudication', content: 'adj' },
        ],
      },
    ],
  };
  const r = extractLearnerRepairText(delib);
  assert.equal(r.publicText, 'FINAL public');
  assert.equal(r.latentInitial, 'FINAL private initial');
  assert.match(r.latentFull, /superego/);
  assert.equal(r.turnNumber, 1);
});

test('extractLearnerRepairText returns null when there are no learner turns', () => {
  assert.equal(extractLearnerRepairText({ turns: [{ phase: 'tutor' }] }), null);
});

test('extractFinalLearnerPublicText reads only the final ROLE-labelled public learner turn', () => {
  const result = extractFinalLearnerPublicText(
    [
      'LEARNER: "first public turn"',
      '',
      'TUTOR: "one public reply"',
      '',
      'STAGE: [the cards move]',
      '',
      'LEARNER: "final public rule and check"',
    ].join('\n'),
  );
  assert.deepEqual(result, { turnNumber: 2, publicText: '"final public rule and check"' });
  assert.equal(extractFinalLearnerPublicText('TUTOR: "no learner turn"'), null);
});

test('public-text-v1 matches the frozen positive, negative, and ambiguous cases exactly', () => {
  assert.equal(PUBLIC_TEXT_FIXTURE.frozen, true);
  assert.equal(PUBLIC_TEXT_FIXTURE.definition, PUBLIC_TEXT_REPAIR_DEFINITION);
  assert.deepEqual([...new Set(PUBLIC_TEXT_FIXTURE.cases.map((fixture) => fixture.category))].sort(), [
    'ambiguous',
    'negative',
    'positive',
  ]);

  for (const fixture of PUBLIC_TEXT_FIXTURE.cases) {
    const result = detectPublicTextRepair(fixture);
    assert.equal(result.definition, PUBLIC_TEXT_REPAIR_DEFINITION, fixture.id);
    assert.equal(result.disposition, fixture.expectedDisposition, fixture.id);
    assert.equal(
      result.durableRepair,
      fixture.expectedDisposition === PUBLIC_TEXT_REPAIR_DISPOSITIONS.REPAIRED
        ? true
        : fixture.expectedDisposition === PUBLIC_TEXT_REPAIR_DISPOSITIONS.NOT_REPAIRED
          ? false
          : null,
      fixture.id,
    );
  }
});

test('ambiguous public repair remains indeterminate rather than becoming a negative', () => {
  const ambiguous = PUBLIC_TEXT_FIXTURE.cases.filter((fixture) => fixture.category === 'ambiguous');
  assert.ok(ambiguous.length > 0);
  for (const fixture of ambiguous) {
    const result = detectPublicTextRepair(fixture);
    assert.equal(result.disposition, PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE, fixture.id);
    assert.equal(result.durableRepair, null, fixture.id);
  }
});

test('missing registered inputs remain indeterminate', () => {
  const positive = PUBLIC_TEXT_FIXTURE.cases.find((fixture) => fixture.category === 'positive');
  const incomplete = [
    { ...positive, hamartia: '' },
    { ...positive, correctedRule: '' },
    { ...positive, publicText: '' },
  ];
  for (const fixture of incomplete) {
    const result = detectPublicTextRepair(fixture);
    assert.equal(result.disposition, PUBLIC_TEXT_REPAIR_DISPOSITIONS.INDETERMINATE);
    assert.equal(result.durableRepair, null);
  }
});

test('public repair does not require recognition or insight vocabulary', () => {
  const fractions = PUBLIC_TEXT_FIXTURE.cases.find((fixture) => fixture.id === 'fractions_explicit_rule_and_check');
  assert.doesNotMatch(fractions.publicText, /\b(?:aha|insight|recognition|realize[ds]?)\b/i);
  assert.equal(detectPublicTextRepair(fractions).disposition, PUBLIC_TEXT_REPAIR_DISPOSITIONS.REPAIRED);
});

test('latentManifestDivergence flags low token overlap as diverged', () => {
  const same = latentManifestDivergence('the cat sat on the mat', 'the cat sat on the mat');
  assert.equal(same.diverged, false);
  assert.ok(same.overlap > 0.9);
  const diff = latentManifestDivergence('alpha beta gamma delta', 'one two three four five');
  assert.equal(diff.diverged, true);
});

test('latentManifestDivergence ignores bracketed stage directions', () => {
  const r = latentManifestDivergence('[lays the tile down] number to the head', 'number to the head');
  assert.ok(r.overlap > 0.9);
});

test('detectRepair mock mode reads the fixture map', async () => {
  assert.equal(await detectRepair('h', 'yes-text', { mode: 'mock', mockMap: { 'yes-text': true } }), true);
  assert.equal(await detectRepair('h', 'no-text', { mode: 'mock', mockMap: { default: false } }), false);
  assert.equal(await detectRepair('h', '', { mode: 'mock' }), false);
});

test('detectRepair llm mode uses the injected callLLM and parses YES/NO', async () => {
  assert.equal(await detectRepair('h', 't', { mode: 'llm', callLLM: async () => 'YES, clearly.' }), true);
  assert.equal(await detectRepair('h', 't', { mode: 'llm', callLLM: async () => 'No.' }), false);
});

test('detectRepair llm mode without an injected callLLM throws a clear error', async () => {
  await assert.rejects(() => detectRepair('h', 't', { mode: 'llm' }), /requires an injected opts\.callLLM/);
});

test('detectRepair llm mode refuses an empty/undefined hamartia (no paid judge on empty misconception)', async () => {
  let called = 0;
  const callLLM = async () => {
    called += 1;
    return 'YES';
  };
  for (const h of ['', '   ', undefined, null]) {
    await assert.rejects(() => detectRepair(h, 't', { mode: 'llm', callLLM }), /empty\/undefined hamartia/);
  }
  assert.equal(called, 0, 'the judge must never be called when the misconception is empty');
});

test('buildRepairPrompt embeds the hamartia and demands a YES/NO verdict', () => {
  const p = buildRepairPrompt('treats X as Y', 'learner said Z');
  assert.match(p, /treats X as Y/);
  assert.match(p, /YES or NO/);
});
