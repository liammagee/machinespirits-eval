import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectTutorStubWorldPublicPrompt,
  projectTutorStubWorldSpeakerDagPrompt,
} from '../services/tutorStubWorldPromptContext.js';

test('world public prompt preserves the authored public scene and injected audience lines', () => {
  const world = Object.freeze({
    id: 'world_test',
    title: 'The Missing Premise',
    discipline: 'Logic',
    question: 'What follows from the public evidence?',
    setting: '  A chalkboard holds two clues.  ',
    learnerVoice: '  The learner is the investigating student.  ',
  });
  const audienceLines = Object.freeze(['Non-speaking audience context:', '- A quiet class observes.']);

  assert.deepEqual(projectTutorStubWorldPublicPrompt(world, { audienceLines }), [
    '# Detective-story world',
    'World: world_test — The Missing Premise',
    'Discipline: Logic',
    'Public question: What follows from the public evidence?',
    'Opening situation visible to the learner:',
    'A chalkboard holds two clues.',
    'Learner role:',
    'The learner is the investigating student.',
    'Non-speaking audience context:',
    '- A quiet class observes.',
    'Your task in story mode:',
    '- Play the tutor/investigator guiding the learner through the case.',
    '- Treat the learner as the investigator; do not solve the case for them.',
    '- Keep the public question alive across the dialogue. Ask for grounded inferences only when the compiled turn contract assigns a question; an instructional repair may leave the question unstated for that turn.',
    '- Treat a concrete learner question as a legitimate investigative move. When clarification is more useful than a guess, invite the investigator to ask what evidence, tool, or distinction needs explaining.',
    '- Make that permission visible: name the clue in plain language, or explicitly invite a short clarification question when a term or referent may be unclear. Never assume the investigator knows that a question may be answered with a clarifying question.',
    '- Stay inside the scene: address the investigator directly and never call either speaker "the tutor" or "the learner".',
    '- You are an adaptive scene actor as well as an investigator. A private turn instruction may cast you as a fellow investigator, examiner, record-keeper, witness/source, advocate, skeptic, or closer.',
    '- Take that part through a visible first-person action or voice, using only public evidence. Do not merely decorate the same question with theatrical language.',
  ]);
});

test('world public prompt retains optional-field fallbacks and null-world behavior', () => {
  assert.deepEqual(projectTutorStubWorldPublicPrompt(null), []);
  assert.deepEqual(
    projectTutorStubWorldPublicPrompt({
      id: 'world_minimal',
      title: 'Minimal',
      question: 'What happened?',
    }).slice(0, 7),
    [
      '# Detective-story world',
      'World: world_minimal — Minimal',
      'Public question: What happened?',
      'Opening situation visible to the learner:',
      'Learner role:',
      'Your task in story mode:',
      '- Play the tutor/investigator guiding the learner through the case.',
    ],
  );
});

test('world speaker prompt preserves rule glosses and injected world vocabulary', () => {
  const world = Object.freeze({
    rules: Object.freeze([
      Object.freeze({ gloss: '  A stamped mark identifies the workshop.  ' }),
      Object.freeze({ gloss: 'Only public records can license a conclusion.' }),
    ]),
  });

  assert.deepEqual(projectTutorStubWorldSpeakerDagPrompt(world, { ledgerTerm: 'case notebook' }), [
    '# Speaking-tutor evidence contract',
    'A private deterministic planner owns the answer, proof path, future evidence, and release schedule.',
    'You are the speaking tutor. You receive only the public scene, public rule glosses, public dialogue, and evidence available through the current turn.',
    'Never speculate about withheld evidence. The turn context will state exactly what evidence may enter the scene now.',
    'Public evidence rules in ordinary language:',
    '1. A stamped mark identifies the workshop.',
    '2. Only public records can license a conclusion.',
    'Speaking conduct:',
    '- Work only from evidence already public or explicitly made available in the current turn context.',
    '- Speak in ordinary scene language. Never invent formal notation, internal identifiers, paths, or hidden bookkeeping.',
    "- Treat the case notebook as the learner's public reasoning record, not a second task. If the learner states a warranted inference from staged evidence, that one utterance counts as both the deduction and the case notebook entry.",
    '- Do not demand every obvious intermediate step from the learner. If an ordinary listener would supply the bridge from public evidence, carry it internally and keep the conversation moving.',
    "- Ask for an explicit missing bridge only when the learner's leap would close the case, contradict public evidence, rely on unstaged evidence, or name a suspect without licensed support.",
    '- If the learner guesses an answer, acknowledge it only as a hypothesis until the public evidence licenses it.',
    "- When new evidence is made available for this turn, introduce at most that one authored batch and ask for the learner's natural reading of what it changes, not a full proof ledger.",
    '- The one-new-clue limit constrains your staging, not the learner’s reasoning. A learner may connect several already-public premises or supply several supported intermediate conclusions in one turn.',
    '- When the learner makes a warranted multi-premise or multi-step advance, credit the whole chain. Do not make them restate its parts one by one; match their pace and test only the next unresolved edge.',
  ]);
});

test('world speaker prompt retains null-world behavior and the legacy ledger fallback', () => {
  assert.deepEqual(projectTutorStubWorldSpeakerDagPrompt(null), []);
  assert.match(
    projectTutorStubWorldSpeakerDagPrompt({ rules: [] }).join('\n'),
    /Treat the evidence record as the learner's public reasoning record/u,
  );
});
