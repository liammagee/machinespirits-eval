import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createTutorStubPromptBlockModel,
  delimitTutorStubPrompt,
  replaceDelimitedTutorStubPrompt,
} from '../services/tutorStubPromptBlocks.js';

test('prompt delimiters preserve order and omit empty fields', () => {
  assert.equal(delimitTutorStubPrompt('[Start]', 'body', '[End]'), '[Start]\nbody\n[End]');
  assert.equal(delimitTutorStubPrompt('[Start]', '', '[End]'), '[Start]\n[End]');
});

test('replacement swaps one existing block without disturbing surrounding bytes', () => {
  assert.equal(
    replaceDelimitedTutorStubPrompt('before\n[Start]\nold\n[End]\nafter', '[Start]', 'new', '[End]'),
    'before\n[Start]\nnew\n[End]\nafter',
  );
});

test('replacement appends a missing or unterminated block after one blank line', () => {
  assert.equal(replaceDelimitedTutorStubPrompt('before', '[Start]', 'new', '[End]'), 'before\n\n[Start]\nnew\n[End]');
  assert.equal(
    replaceDelimitedTutorStubPrompt('before [Start] old', '[Start]', 'new', '[End]'),
    'before [Start] old\n\n[Start]\nnew\n[End]',
  );
});

test('multiple-choice guidance injects only public world vocabulary', () => {
  const model = createTutorStubPromptBlockModel({
    worldLedgerTerm: () => 'trial-book',
    worldFlavourPhrase: () => 'the assay room',
  });
  const rules = model.responseChoiceModeRules({ multipleChoice: true, world: { id: 'fixture' } });
  assert.equal(rules.length, 4);
  assert.match(rules.join('\n'), /plain trial-book line shape/u);
  assert.match(rules.join('\n'), /Keep the assay room/u);
  assert.match(rules.join('\n'), /not answers/u);
});

test('open-response guidance retains bounded-choice and terminal-handoff rules', () => {
  const rules = createTutorStubPromptBlockModel().responseChoiceModeRules({ multipleChoice: false });
  assert.equal(rules.length, 4);
  assert.match(rules.join('\n'), /Do not default to multiple choice/u);
  assert.match(rules.join('\n'), /end declaratively/u);
});

test('the CLI binds rather than redeclares the prompt-block model', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /createTutorStubPromptBlockModel/u);
  assert.doesNotMatch(source, /function (?:responseChoiceModeRules|delimitedPrompt|replaceDelimitedPrompt)\(/u);
});
