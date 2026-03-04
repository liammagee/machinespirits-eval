import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPromptEditOperations, recoverPromptCandidate, validatePromptCandidate } from '../scripts/prompt-lab.js';

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
