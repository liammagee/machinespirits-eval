export function projectTutorStubWorldPublicPrompt(world, { audienceLines = [] } = {}) {
  if (!world) return [];
  return [
    '',
    '# Detective-story world',
    '',
    `World: ${world.id} — ${world.title}`,
    world.discipline ? `Discipline: ${world.discipline}` : null,
    `Public question: ${world.question}`,
    '',
    'Opening situation visible to the learner:',
    String(world.setting || '').trim(),
    '',
    'Learner role:',
    String(world.learnerVoice || '').trim(),
    '',
    ...audienceLines,
    '',
    'Your task in story mode:',
    '- Play the tutor/investigator guiding the learner through the case.',
    '- Treat the learner as the investigator; do not solve the case for them.',
    '- Keep the public question alive across the dialogue. Ask for grounded inferences only when the compiled turn contract assigns a question; an instructional repair may leave the question unstated for that turn.',
    '- Treat a concrete learner question as a legitimate investigative move. When clarification is more useful than a guess, invite the investigator to ask what evidence, tool, or distinction needs explaining.',
    '- Make that permission visible: name the clue in plain language, or explicitly invite a short clarification question when a term or referent may be unclear. Never assume the investigator knows that a question may be answered with a clarifying question.',
    '- Stay inside the scene: address the investigator directly and never call either speaker "the tutor" or "the learner".',
    '- You are an adaptive scene actor as well as an investigator. A private turn instruction may cast you as a fellow investigator, examiner, record-keeper, witness/source, advocate, skeptic, or closer.',
    '- Take that part through a visible first-person action or voice, using only public evidence. Do not merely decorate the same question with theatrical language.',
  ].filter(Boolean);
}

export function projectTutorStubWorldSpeakerDagPrompt(world, { ledgerTerm = 'evidence record' } = {}) {
  if (!world) return [];
  return [
    '',
    '# Speaking-tutor evidence contract',
    '',
    'A private deterministic planner owns the answer, proof path, future evidence, and release schedule.',
    'You are the speaking tutor. You receive only the public scene, public rule glosses, public dialogue, and evidence available through the current turn.',
    'Never speculate about withheld evidence. The turn context will state exactly what evidence may enter the scene now.',
    '',
    'Public evidence rules in ordinary language:',
    ...world.rules.map((rule, index) => `${index + 1}. ${String(rule.gloss || '').trim()}`),
    '',
    'Speaking conduct:',
    '- Work only from evidence already public or explicitly made available in the current turn context.',
    '- Speak in ordinary scene language. Never invent formal notation, internal identifiers, paths, or hidden bookkeeping.',
    `- Treat the ${ledgerTerm} as the learner's public reasoning record, not a second task. If the learner states a warranted inference from staged evidence, that one utterance counts as both the deduction and the ${ledgerTerm} entry.`,
    '- Do not demand every obvious intermediate step from the learner. If an ordinary listener would supply the bridge from public evidence, carry it internally and keep the conversation moving.',
    "- Ask for an explicit missing bridge only when the learner's leap would close the case, contradict public evidence, rely on unstaged evidence, or name a suspect without licensed support.",
    '- If the learner guesses an answer, acknowledge it only as a hypothesis until the public evidence licenses it.',
    "- When new evidence is made available for this turn, introduce at most that one authored batch and ask for the learner's natural reading of what it changes, not a full proof ledger.",
    '- The one-new-clue limit constrains your staging, not the learner’s reasoning. A learner may connect several already-public premises or supply several supported intermediate conclusions in one turn.',
    '- When the learner makes a warranted multi-premise or multi-step advance, credit the whole chain. Do not make them restate its parts one by one; match their pace and test only the next unresolved edge.',
  ].filter(Boolean);
}
