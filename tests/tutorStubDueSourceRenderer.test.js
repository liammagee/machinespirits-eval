import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTutorStubDramaticReleaseFrame,
  tutorStubFirstPersonRoleVoiceVisible,
} from '../services/tutorStubDramaticRelease.js';
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

test('an entry with no scene stamp keeps the period reporting lead', () => {
  // Recorded frozen-replay bundles and hand-built fixtures predate the stamp,
  // so the absent-stamp path is the one that keeps their published text stable.
  for (const [role, lead] of [
    ['leat-keeper reading the charcoal book', 'I read from the record'],
    ['watchman giving his account', 'I give this account'],
    ['assay-master identifying the alloy', 'I identify this'],
    ['guild officer describing the bench', 'I report this'],
    ['warden voicing the verdict', 'I state the verdict'],
    ['sworn hand', 'I attest'],
  ]) {
    const rendered = renderTutorStubDueSource({ mode: 'enacted_role', role, surface: 'A public fact stands.' }, 0);
    assert.equal(rendered.reporting.text, lead);
  }
});

test('a period world stamps the period reporting lead and a contemporary world the plainspoken one', () => {
  const build = (world) =>
    buildTutorStubDramaticReleaseFrame({
      dueEvidence: [
        {
          surface: 'The visitor badge log records one entry after six.',
          presentation: { mode: 'enacted_role', role: 'front-desk clerk reading the badge log' },
        },
      ],
      world,
    }).entries[0];

  const periodEntry = build({ presentation: { narrative_diction: 'medieval guild-hall' } });
  assert.equal(periodEntry.scene.diction, 'period');
  assert.equal(renderTutorStubDueSource(periodEntry, 0).reporting.text, 'I read from the record');

  const contemporaryEntry = build({ presentation: { narrative_diction: 'domestic plainspoken' } });
  assert.equal(contemporaryEntry.scene.diction, 'contemporary');
  const contemporary = renderTutorStubDueSource(contemporaryEntry, 0);
  assert.equal(contemporary.reporting.text, 'Here’s what I’m reading');
  assert.match(contemporary.text, /^“Here’s what I’m reading: The visitor badge log records one entry after six\.”$/u);
});

test('the reporting lead is the only part of a contemporary source that moves', () => {
  // The colon join carries the authored surface through byte-for-byte in both
  // registers; only the first-person act ahead of it is re-costumed.
  const surface = 'And the cure sheet gives a four-hour set.';
  const entry = buildTutorStubDramaticReleaseFrame({
    dueEvidence: [{ surface, presentation: { mode: 'enacted_role', role: 'materials tester reading the cure sheet' } }],
    world: { presentation: { narrative_diction: 'workshop plainspoken' } },
  }).entries[0];
  const rendered = renderTutorStubDueSource(entry, 0);
  assert.equal(rendered.surface, surface);
  assert.equal(rendered.text, `“${rendered.reporting.text}: ${surface}”`);
  assert.equal(rendered.reporting.kind, 'record_reading');
  assert.equal(rendered.reporting.separator, 'colon');
});

test('every reporting lead keeps a first-person pronoun in both registers', () => {
  // The lead is load-bearing, not decorative: the dramatic-release guard counts
  // a quotation as role speech only when it contains i/my/our/we, and the
  // authored surface it introduces usually carries none. A pronoun-free variant
  // makes the whole turn fail with missing_in_scene_enactment.
  const roles = [
    'front-desk clerk reading the badge log',
    'watchman giving his account',
    'assay-master identifying the alloy',
    'guild officer describing the bench',
    'warden voicing the verdict',
    'sworn hand',
  ];
  const kinds = new Set();
  for (const diction of ['medieval guild-hall', 'domestic plainspoken']) {
    for (const role of roles) {
      const entry = buildTutorStubDramaticReleaseFrame({
        dueEvidence: [{ surface: 'A public fact stands.', presentation: { mode: 'enacted_role', role } }],
        world: { presentation: { narrative_diction: diction } },
      }).entries[0];
      const { reporting, text } = renderTutorStubDueSource(entry, 0);
      kinds.add(reporting.kind);
      assert.match(reporting.text, /\b(?:I|I’m|my|our|we)\b/iu, `${diction} / ${role}: ${reporting.text}`);
      assert.ok(tutorStubFirstPersonRoleVoiceVisible(text), `${diction} / ${role}: ${text}`);
    }
  }
  assert.equal(kinds.size, 6);
});
