import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE,
  auditTutorStubCharacterRestatement,
  buildTutorStubCharacterRestatementPrompt,
  cleanTutorStubCharacterRestatement,
} from '../tutorStubCharacterRestatement.js';

test('character-restatement prompt preserves intent and keeps the learning domain ahead of metaphor', () => {
  const prompt = buildTutorStubCharacterRestatementPrompt({
    previousText: 'Compare the residue marks. Which crucible do they support?',
    characterId: 'adversarial_teacher',
    characterLabel: 'adversarial teacher',
    characterContract: 'Challenge one learner idea with a counterexample native to the active subject.',
    publicWorld: 'Discipline: historical assay. Public question: Who struck the false shillings?',
  });

  assert.match(prompt, /Begin with exactly: Let me rephrase that\./u);
  assert.match(prompt, /same pedagogical intent/u);
  assert.match(prompt, /Keep the active subject and its objects, concepts, texts, problems, methods, and standards/u);
  assert.match(prompt, /Legal, dramatic, and philosophical metaphors.*subordinate aids/u);
  assert.match(prompt, /Compare the residue marks/u);
});

test('character-restatement cleaning supplies one canonical reset bridge', () => {
  assert.equal(
    cleanTutorStubCharacterRestatement('Tutor: Let me rephrase that: Test the same assay claim again?'),
    `${TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE} Test the same assay claim again?`,
  );
  assert.equal(
    cleanTutorStubCharacterRestatement('Test the same assay claim again?'),
    `${TUTOR_STUB_CHARACTER_RESTATEMENT_BRIDGE} Test the same assay claim again?`,
  );
});

test('character-restatement audit requires changed wording, the live question, and exact quoted sources', () => {
  const previousText = 'Read this public entry: “The cupel kept a dark ring.” Which assay claim follows?';
  const valid = auditTutorStubCharacterRestatement({
    previousText,
    text: 'Let me rephrase that. As an exacting assay teacher, use “The cupel kept a dark ring.” Which assay claim can you now defend?',
    characterId: 'exacting_schoolmaster',
    permittedText: previousText,
  });
  assert.equal(valid.ok, true);
  assert.equal(valid.changedWording, true);
  assert.equal(valid.liveQuestionPreserved, true);

  const repeated = auditTutorStubCharacterRestatement({
    previousText,
    text: `Let me rephrase that. ${previousText}`,
    characterId: 'exacting_schoolmaster',
    permittedText: previousText,
  });
  assert.equal(repeated.ok, false);
  assert.ok(repeated.issues.some((issue) => issue.type === 'verbatim_repetition'));

  const changedSource = auditTutorStubCharacterRestatement({
    previousText,
    text: 'Let me rephrase that. The cupel kept a bright ring. Which assay claim follows?',
    characterId: 'exacting_schoolmaster',
    permittedText: previousText,
  });
  assert.equal(changedSource.ok, false);
  assert.ok(changedSource.issues.some((issue) => issue.type === 'quoted_source_changed'));
});
