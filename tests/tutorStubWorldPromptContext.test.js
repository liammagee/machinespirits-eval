import assert from 'node:assert/strict';
import test from 'node:test';

import { projectTutorStubWorldPublicPrompt } from '../services/tutorStubWorldPromptContext.js';

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
