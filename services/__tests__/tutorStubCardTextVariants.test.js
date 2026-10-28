import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LAB_PRINCIPLE_CARDS,
  PARENT_MOVES_FOUR_FIELD,
  TUTOR_STUB_CARD_TEXT_VARIANTS,
  TUTOR_STUB_MOVE_PRESSURES,
  resolveTutorStubCardTextVariant,
  tutorStubCardTextVariantCard,
} from '../tutorStubCardTextVariants.js';
import {
  advanceTutorStubMannerSwitch,
  createTutorStubMannerSwitchState,
  tutorStubMannerCard,
} from '../tutorStubMannerSwitch.js';

test('unset flag means no variant; unknown names fail before any call', () => {
  assert.equal(resolveTutorStubCardTextVariant(''), null);
  assert.equal(resolveTutorStubCardTextVariant(undefined), null);
  assert.throws(() => resolveTutorStubCardTextVariant('no-such-variant'), /unknown variant 'no-such-variant'/);
});

test('each variant carries every card with its four fields, the permission and the closing line', () => {
  for (const [name, cards] of [
    ['lab-principles-v1', LAB_PRINCIPLE_CARDS],
    ['parent-moves-four-field-v1', PARENT_MOVES_FOUR_FIELD],
  ]) {
    const variant = resolveTutorStubCardTextVariant(name);
    assert.equal(variant.version, TUTOR_STUB_CARD_TEXT_VARIANTS[name].version);
    for (const card of cards) {
      for (const [label, field] of [
        ['Situation', 'situation'],
        ['Change', 'change'],
        ['Must stay true', 'mustStayTrue'],
        ['Why', 'why'],
      ]) {
        assert.ok(variant.text.includes(`${label}: ${card[field]}`), `${name}: ${card.name} ${label}`);
      }
    }
    assert.match(variant.text, /You are not told which situation this is\./);
    assert.match(variant.text, /single turn, not a costume/);
  }
  assert.equal(LAB_PRINCIPLE_CARDS.length, 3, 'release after refusal is not offered');
  assert.equal(PARENT_MOVES_FOUR_FIELD.length, 5);
});

test('the Lab cards carry no Printroom or detective nouns', () => {
  const text = TUTOR_STUB_CARD_TEXT_VARIANTS['lab-principles-v1'].text;
  assert.doesNotMatch(text, /printroom|willow|press|typeface|detective|suspect|investigator/i);
});

test('a variant keeps the v3 occasions and swaps the text; the v3 module itself is untouched', () => {
  const variant = resolveTutorStubCardTextVariant('lab-principles-v1');
  for (const pressure of TUTOR_STUB_MOVE_PRESSURES) {
    assert.equal(tutorStubCardTextVariantCard(variant, pressure), variant.text, pressure);
    assert.ok(
      tutorStubMannerCard({ lastAdvance: { pressure } }),
      `${pressure} carries a v3 move card, so the two pressure lists agree`,
    );
  }
  for (const pressure of ['neutral', 'concession', 'defiance', null]) {
    assert.equal(tutorStubCardTextVariantCard(variant, pressure), null, String(pressure));
    assert.equal(tutorStubMannerCard({ lastAdvance: { pressure } }), null, String(pressure));
  }
  assert.equal(tutorStubCardTextVariantCard(null, 'demand'), null, 'no variant, no variant text');
  const state = createTutorStubMannerSwitchState();
  advanceTutorStubMannerSwitch(state, { learnerText: 'Write it down now.', turn: 1 });
  assert.match(tutorStubMannerCard(state) || '', /harness the demand/i, 'v3 text unchanged');
  assert.doesNotMatch(variant.text, /harness the demand/i);
});
