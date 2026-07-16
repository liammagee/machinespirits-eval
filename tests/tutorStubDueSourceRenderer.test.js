import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditTutorStubDueSourceActionAlignment,
  compileTutorStubDueSourceActionReferents,
  renderTutorStubDueSource,
  tutorStubDueSourceActionInstruction,
} from '../services/tutorStubDueSourceRenderer.js';

test('colon-safe source rendering preserves complete authored sentences without a complementizer join', () => {
  const surfaces = [
    {
      role: 'leat-keeper reading the charcoal book',
      surface: "The leat-keeper's book is exact. One hand drew the weir crucible.",
      lead: 'I read from the record',
    },
    {
      role: "guild officer describing Verrell's bench",
      surface: 'And Verrell engraves: the broad graver on his bench is his alone.',
      lead: 'I report this',
    },
  ];

  for (const [index, fixture] of surfaces.entries()) {
    const rendered = renderTutorStubDueSource({ mode: 'enacted_role', ...fixture }, index);
    assert.equal(rendered.text, `“${fixture.lead}: ${fixture.surface}”`);
    assert.equal(rendered.text.split(fixture.surface).length - 1, 1);
    assert.equal(rendered.reporting.separator, 'colon');
    assert.equal(rendered.reporting.complementizer, null);
    assert.doesNotMatch(rendered.text, /\b(?:attest|record|report) that\b/iu);
  }
});

test('typed source referents prefer the authored role carrier and retain fact provenance', () => {
  const referents = compileTutorStubDueSourceActionReferents({
    mode: 'enacted_role',
    role: "guild officer describing Verrell's bench",
    fact: ['soleHolderOf', 'broadGraver', 'verrell'],
  });

  assert.equal(referents.required, true);
  assert.deepEqual(referents.primary, {
    kind: 'role_carrier',
    label: "Verrell's bench",
    source: 'authored_role',
    alignment_required: true,
  });
  assert.deepEqual(
    referents.referents.map((row) => [row.kind, row.label, row.alignment_required]),
    [
      ['role_carrier', "Verrell's bench", true],
      ['role_carrier_head', 'bench', false],
    ],
  );
  assert.deepEqual(
    referents.trace_only_fact_referents.map((row) => [row.kind, row.label, row.speaker_eligible]),
    [
      ['fact_argument', 'broad Graver', false],
      ['fact_argument', 'verrell', false],
    ],
  );
  assert.match(
    tutorStubDueSourceActionInstruction([
      {
        mode: 'enacted_role',
        role: "guild officer describing Verrell's bench",
        surface: 'The broad graver is on Verrell’s bench.',
      },
    ]),
    /Anchor the due source entrance in its own referent \(Verrell's bench\)/u,
  );
  assert.match(
    tutorStubDueSourceActionInstruction([
      {
        mode: 'enacted_role',
        role: "guild officer describing Verrell's bench",
        surface: 'The broad graver is on Verrell’s bench.',
      },
    ]),
    /declarative part may name that referent without handling it/u,
  );
});

test('source-action alignment accepts the carrier and rejects a mismatched prop', () => {
  const source = renderTutorStubDueSource({
    mode: 'enacted_role',
    role: 'front-desk clerk reading the visitor badge log',
    fact: ['issuedTo', 'visitorBadgeLog', 'outsideCrew'],
    surface: 'Visitor code WF-11 was issued to the outside crew.',
  });
  const aligned = auditTutorStubDueSourceActionAlignment({
    text: 'I open the visitor badge log beside us.',
    sources: [source],
  });
  const mismatched = auditTutorStubDueSourceActionAlignment({
    text: 'I turn the kitchen photograph beneath the lamp.',
    sources: [source],
  });
  const optionalFactOnly = auditTutorStubDueSourceActionAlignment({
    text: 'I point to the outside crew.',
    sources: [source],
  });

  assert.equal(aligned.ok, true);
  assert.equal(aligned.sources[0].matches[0].label, 'the visitor badge log');
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.issues[0].type, 'due_source_action_referent_missing');
  assert.equal(optionalFactOnly.ok, false);
  assert.deepEqual(optionalFactOnly.sources[0].matches, []);
});

test('formal fact arguments stay trace-only unless their public labels occur in the source surface', () => {
  const referents = compileTutorStubDueSourceActionReferents({
    mode: 'presented_exhibit',
    role: 'source of the clue',
    fact: ['watermarkOf', 'draftLeaf', 'internalStockKey'],
    surface: 'A heron watermark appears on every leaf.',
  });

  assert.deepEqual(referents.referents, []);
  assert.deepEqual(
    referents.trace_only_fact_referents.map((row) => [row.id, row.speaker_eligible]),
    [
      ['draftLeaf', false],
      ['internalStockKey', false],
    ],
  );
  assert.equal(
    tutorStubDueSourceActionInstruction([
      {
        mode: 'presented_exhibit',
        role: 'source of the clue',
        fact: ['watermarkOf', 'draftLeaf', 'internalStockKey'],
        surface: 'A heron watermark appears on every leaf.',
      },
    ]),
    '',
  );
});

test('an optional public fact argument does not become a pre-source action instruction', () => {
  const rendered = renderTutorStubDueSource({
    premise: 'p_registry',
    mode: 'presented_exhibit',
    surface: 'The private-seal register names Elian.',
    fact: ['usedBy', 'duskSeal', 'elian'],
  });
  assert.equal(rendered.action_referents.required, false);
  assert.equal(tutorStubDueSourceActionInstruction([rendered]), '');
});

test('role pronouns resolve to a stable carrier label', () => {
  const referents = compileTutorStubDueSourceActionReferents({
    role: 'watchman giving his account',
  });
  assert.equal(referents.primary.label, 'watchman’s account');
});
