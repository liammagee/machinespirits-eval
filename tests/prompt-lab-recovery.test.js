import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateRunRows, applyPromptEditOperations, recoverPromptCandidate, validatePromptCandidate } from '../scripts/prompt-lab.js';

test('validatePromptCandidate accepts indented closing section tags', () => {
  const reference = `# Tutor Prompt
<suggestion_principles>
Use warm, concrete suggestions.
</suggestion_principles>

<output_format>
Return JSON.
</output_format>
`;

  const candidate = `# Tutor Prompt
<suggestion_principles>
Use warm, concrete suggestions.
  </suggestion_principles>

<output_format>
Return JSON.
    </output_format>
`;

  const result = validatePromptCandidate({ filename: 'tutor-ego.md' }, candidate, reference);
  assert.equal(result.ok, true);
});

test('recoverPromptCandidate repairs missing closing tags and code fences', () => {
  const reference = `# Tutor Prompt
<output_format>
Return JSON.

\`\`\`json
{
  "title": "Hello"
}
\`\`\`
</output_format>
`;

  const candidate = `# Tutor Prompt
<output_format>
Return JSON.

\`\`\`json
{
  "title": "Hello"
}
`;

  const repaired = recoverPromptCandidate({ filename: 'tutor-ego.md' }, candidate, reference);
  assert.equal(repaired.applied, true);
  assert.match(repaired.notes.join(' '), /closing code fence/);
  assert.match(repaired.notes.join(' '), /<\/output_format>/);

  const validation = validatePromptCandidate({ filename: 'tutor-ego.md' }, repaired.content, reference);
  assert.equal(validation.ok, true);
});

test('applyPromptEditOperations supports replace and insert_after edits', () => {
  const base = `# Prompt
<section>
Alpha
</section>
`;

  const updated = applyPromptEditOperations(
    base,
    [
      { type: 'replace', find: 'Alpha', replace: 'Beta' },
      { type: 'insert_after', anchor: '</section>\n', text: '\n## Note\nGamma\n' },
    ],
    'sample.md',
  );

  assert.match(updated, /Beta/);
  assert.match(updated, /## Note\nGamma/);
});

test('aggregateRunRows averages real replications and ignores superseded rejudgments', () => {
  const aggregated = aggregateRunRows([
    {
      id: 1,
      dialogueId: 'd1',
      createdAt: '2026-03-04T10:00:00.000Z',
      success: true,
      tutorFirstTurnScore: 40,
      tutorOverallScore: null,
      latencyMs: 1000,
      inputTokens: 100,
      outputTokens: 10,
      cost: 0,
      judgeModel: null,
      evaluationReasoning: null,
      scoringMethod: 'rubric',
      errorMessage: null,
      promptContentHash: 'abc',
      tutorEgoPromptVersion: '1.0',
      tutorSuperegoPromptVersion: null,
      learnerPromptVersion: '1.0',
    },
    {
      id: 2,
      dialogueId: 'd1',
      createdAt: '2026-03-04T10:05:00.000Z',
      success: true,
      tutorFirstTurnScore: 55,
      tutorOverallScore: null,
      latencyMs: 900,
      inputTokens: 90,
      outputTokens: 9,
      cost: 0,
      judgeModel: 'codex-cli/auto',
      evaluationReasoning: 'rejudged',
      scoringMethod: 'rubric',
      errorMessage: null,
      promptContentHash: 'abc',
      tutorEgoPromptVersion: '1.0',
      tutorSuperegoPromptVersion: null,
      learnerPromptVersion: '1.0',
    },
    {
      id: 3,
      dialogueId: 'd2',
      createdAt: '2026-03-04T10:06:00.000Z',
      success: true,
      tutorFirstTurnScore: 65,
      tutorOverallScore: null,
      latencyMs: 1100,
      inputTokens: 110,
      outputTokens: 11,
      cost: 0,
      judgeModel: 'codex-cli/auto',
      evaluationReasoning: 'replication 2',
      scoringMethod: 'rubric',
      errorMessage: null,
      promptContentHash: 'abc',
      tutorEgoPromptVersion: '1.0',
      tutorSuperegoPromptVersion: null,
      learnerPromptVersion: '1.0',
    },
  ]);

  assert.equal(aggregated.totalRuns, 2);
  assert.equal(aggregated.scoredRuns, 2);
  assert.equal(aggregated.primaryScore, 60);
  assert.equal(aggregated.judgeModel, 'codex-cli/auto');
  assert.equal(aggregated.promptContentHash, 'abc');
});
