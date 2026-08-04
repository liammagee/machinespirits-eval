import assert from 'node:assert/strict';
import test from 'node:test';

import { flattenProgram2BaseRequest, formatProgram2TrlRows } from '../scripts/program2-export-trl-v1.mjs';

function sft(dialogueId, turn, target, split = 'train') {
  return {
    dialogueId,
    turn,
    turnId: `run:${String(turn).padStart(3, '0')}`,
    request: {
      systemPrompt: ' Teach carefully. ',
      messages: [{ role: 'user', content: `question ${turn}` }],
      config: {},
    },
    target,
    split,
  };
}

test('Program-2 formatter preserves Task-A priority, explicit historical exclusions, and frozen shapes', () => {
  const task = sft('dialogue-a', 1, 'answer one');
  const ordinary = sft('dialogue-b', 2, 'answer two');
  const excluded = sft('dialogue-c', 3, 'answer three');
  const kto = {
    ...sft('dialogue-k', 4, 'unused'),
    text: 'candidate',
    label: false,
  };
  delete kto.target;
  const result = formatProgram2TrlRows({
    taskARows: [task],
    generalRows: [ordinary, task, excluded],
    ktoRows: [kto],
    exclusions: [{ dialogueId: 'dialogue-c', turnId: 'run:003' }],
  });

  assert.equal(result.sftInstruct.length, 2);
  assert.equal(result.sftInstruct[0].messages.at(-1).content, 'answer one');
  assert.equal(result.sftInstruct[1].messages.at(-1).content, 'answer two');
  assert.equal(result.sftBase[0].prompt, flattenProgram2BaseRequest(task.request));
  assert.equal(result.sftBase[0].completion, ' answer one');
  assert.deepEqual(result.kto[0], {
    prompt: [
      { role: 'system', content: ' Teach carefully. ' },
      { role: 'user', content: 'question 4' },
    ],
    completion: [{ role: 'assistant', content: 'candidate' }],
    label: false,
  });
  assert.equal(result.reconciliation.outputSftRows, 2);
});
