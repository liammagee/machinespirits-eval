import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateRunRows,
  applyPromptEditOperations,
  parseJsonResponse,
  recoverPromptCandidate,
  validatePromptCandidate,
} from '../scripts/prompt-lab.js';

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

test('applyPromptEditOperations accepts insert_after find/replace aliases', () => {
  const base = `# Prompt
<section>
Alpha
</section>
`;

  const updated = applyPromptEditOperations(
    base,
    [
      {
        type: 'insert_after',
        find: '</section>\n',
        replace: '\n## Alias Note\nDelta\n',
      },
    ],
    'sample.md',
  );

  assert.match(updated, /## Alias Note\nDelta/);
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

test('parseJsonResponse prefers final recommender payload over echoed schema template', () => {
  const mixedOutput = `
[2026-03-04T21:00:49] User instructions:
{
  "summary": "short paragraph",
  "observations": ["observation 1", "observation 2"],
  "prompt_updates": [
    {
      "filename": "tutor-ego.md",
      "rationale": "why this file changes",
      "changes": ["specific edit 1", "specific edit 2"],
      "content": "FULL FILE CONTENT"
    }
  ],
  "expected_effects": ["expected effect 1", "expected effect 2"]
}

[2026-03-04T21:03:13] codex
{
  "summary": "Refine frustration handling and elicitation.",
  "observations": [
    "Current score is low.",
    "Response over-redirects without learner agency bridge."
  ],
  "prompt_updates": [
    {
      "filename": "tutor-ego.md",
      "rationale": "Add bridge and collaborative check-in rules.",
      "changes": ["Add agency bridge", "Add one short elicitation question"],
      "content": "# AI Tutor - Ego Agent\\n\\n<decision_heuristics>\\n..."
    }
  ],
  "expected_effects": ["Higher first-turn pedagogical craft"]
}
`;

  const parsed = parseJsonResponse(mixedOutput);
  assert.equal(parsed.summary, 'Refine frustration handling and elicitation.');
  assert.equal(parsed.prompt_updates?.[0]?.filename, 'tutor-ego.md');
  assert.match(parsed.prompt_updates?.[0]?.content || '', /AI Tutor - Ego Agent/);
});

test('parseJsonResponse extracts final JSON after noisy codex logs without fences', () => {
  const noisyOutput = `
[2026-03-04T21:00:49] User instructions:
... prompt examples ...
{"summary":"short paragraph","observations":["observation 1"],"prompt_updates":[{"filename":"tutor-ego.md","rationale":"why this file changes","changes":["specific edit 1"],"content":"FULL FILE CONTENT"}],"expected_effects":["expected effect 1"]}
[2026-03-04T21:03:05] tokens used: 4543
[2026-03-04T21:03:13] thinking
command: python -c "print({'bad':'quote starts here " and never closes in this log line)"
[2026-03-04T21:03:13] codex
{"summary":"Real recommendation","observations":["obs"],"prompt_updates":[{"filename":"tutor-ego.md","rationale":"targeted edit","changes":["edit"],"content":"# AI Tutor - Ego Agent\\n\\n<decision_heuristics>\\n..."}],"expected_effects":["lift first-turn score"]}
[2026-03-04T21:03:32] tokens used: 10127
`;

  const parsed = parseJsonResponse(noisyOutput);
  assert.equal(parsed.summary, 'Real recommendation');
  assert.equal(parsed.prompt_updates?.[0]?.filename, 'tutor-ego.md');
  assert.match(parsed.prompt_updates?.[0]?.content || '', /decision_heuristics/);
});
