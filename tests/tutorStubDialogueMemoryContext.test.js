import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildTutorStubTutorMessageContext,
  projectTutorStubCompactPublicTranscript,
  projectTutorStubPublicDialogueMemorySummary,
  renderTutorStubRawPublicTurnTranscript,
} from '../services/tutorStubPublicHistory.js';
import { projectTutorStubLearnerClassifierContext } from '../services/tutorStubTutorPromptContext.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function publicTurnFixture() {
  return Array.from({ length: 8 }, (_, index) => {
    const turn = index + 1;
    return {
      turn,
      learner:
        turn === 6
          ? `  learner six   ${'keeps a public observation in view while checking the next ordinary bridge '.repeat(3)}  `
          : `learner ${turn}`,
      tutor:
        turn === 6
          ? ` tutor six\n${'responds with public evidence and one bounded pedagogical question '.repeat(4)}`
          : `tutor ${turn}`,
      classification:
        turn === 8
          ? {
              turn: {
                summary: 'The learner distinguishes access from authorship.',
                discourse_move: 'qualified_inference',
                evidence_use: 'cross_checks_public_clues',
                epistemic_stance: 'tentative_but_grounded',
                pedagogical_need: 'Test the remaining custody bridge.',
              },
              overall: {
                summary: 'The inquiry has narrowed without premature closure.',
                trajectory: 'from clue collection to discriminating inference',
                next_best_tutor_move: 'This fallback should not render.',
              },
            }
          : undefined,
    };
  });
}

test('tutor message context is public-only, tutor-relative, byte-stable data and immutable', () => {
  const messages = deepFreeze([
    { role: 'system', content: 'private system frame' },
    { role: 'user', content: 'public learner turn' },
    { role: 'tool', content: 'private tool trace' },
    { role: 'assistant', content: 'public tutor turn' },
  ]);
  const before = structuredClone(messages);

  assert.deepEqual(
    buildTutorStubTutorMessageContext(messages, {
      modelRef: 'openrouter.example',
      activatedBy: 'character_change',
    }),
    {
      schema: 'machinespirits.tutor-stub.public-message-context.v2',
      historyMode: 'full_public_replay',
      speaker: 'tutor',
      messages: [
        { role: 'user', content: 'public learner turn' },
        { role: 'assistant', content: 'public tutor turn' },
      ],
      availableMessageCount: 2,
      replayedMessageCount: 2,
      userMessageCount: 1,
      assistantMessageCount: 1,
      activatedBy: 'character_change',
      modelRef: 'openrouter.example',
    },
  );
  assert.deepEqual(messages, before);
  assert.equal(buildTutorStubTutorMessageContext(null).modelRef, null);
});

test('raw public transcript retains exact recent-window behavior and absolute numbering', () => {
  const turns = deepFreeze(publicTurnFixture().slice(0, 3));
  assert.equal(renderTutorStubRawPublicTurnTranscript(null, 2), 'No previous turns in the raw recent window.');
  assert.equal(renderTutorStubRawPublicTurnTranscript(turns, 0), 'No previous turns in the raw recent window.');
  assert.equal(
    renderTutorStubRawPublicTurnTranscript(turns, 2),
    ['Turn 2', 'Learner: learner 2', 'Tutor: tutor 2', '', 'Turn 3', 'Learner: learner 3', 'Tutor: tutor 3'].join('\n'),
  );
});

test('compact public dialogue memory is byte-exact, bounded, and immutable', () => {
  const turns = deepFreeze(publicTurnFixture());
  const before = structuredClone(turns);
  const summary = projectTutorStubPublicDialogueMemorySummary(turns, {
    historyTurns: 2,
    includeAnalysis: true,
  });

  assert.deepEqual(
    { bytes: Buffer.byteLength(summary), sha256: sha256(summary) },
    { bytes: 944, sha256: '3416b61643d416157224d97f302f3ad93a1e419a78ccb031aedc22d13aace5c7' },
  );
  assert.deepEqual(turns, before);
  assert.match(summary, /Completed public turns: 8; raw recent window: 2 turn\(s\)\./u);
  assert.match(summary, /Older turns compressed: 1-6\./u);
  assert.match(summary, /- T1: learner learner 1; tutor tutor 1/u);
  assert.match(summary, /- T6: learner learner six keeps a public observation/u);
  assert.match(summary, /\.\.\.; tutor tutor six responds with public evidence/u);
  assert.match(summary, /This turn: The learner distinguishes access from authorship\./u);
  assert.match(summary, /Trajectory: from clue collection to discriminating inference/u);
  assert.match(summary, /Next likely need: Test the remaining custody bridge\./u);
  assert.doesNotMatch(summary, /This fallback should not render/u);
});

test('memory summary preserves empty, no-analysis, and zero-history fallbacks', () => {
  assert.equal(projectTutorStubPublicDialogueMemorySummary(null), 'No previous public dialogue to summarize.');

  const turns = publicTurnFixture().slice(0, 2);
  const withoutAnalysis = projectTutorStubPublicDialogueMemorySummary(turns, {
    historyTurns: 2,
    includeAnalysis: false,
  });
  assert.match(withoutAnalysis, /Older turns compressed: none yet\./u);
  assert.doesNotMatch(withoutAnalysis, /Latest public learner analysis:/u);

  const zeroHistory = projectTutorStubPublicDialogueMemorySummary(turns, {
    historyTurns: 0,
    includeAnalysis: false,
  });
  assert.match(zeroHistory, /raw recent window: 0 turn\(s\)/u);
  assert.match(zeroHistory, /Older turns compressed: 1-2\./u);
});

test('compact transcript adds public memory only when enabled and dialogue exists', () => {
  const turns = publicTurnFixture().slice(0, 3);
  const raw = renderTutorStubRawPublicTurnTranscript(turns, 2);

  assert.equal(projectTutorStubCompactPublicTranscript(turns, 2, { memoryEnabled: false, historyTurns: 2 }), raw);
  assert.equal(
    projectTutorStubCompactPublicTranscript([], 2, { memoryEnabled: true, historyTurns: 2 }),
    'No previous turns in the raw recent window.',
  );

  const compact = projectTutorStubCompactPublicTranscript(turns, 2, {
    memoryEnabled: true,
    historyTurns: 2,
    includeAnalysis: false,
  });
  assert.equal(
    compact,
    [
      projectTutorStubPublicDialogueMemorySummary(turns, { historyTurns: 2, includeAnalysis: false }),
      '[Raw recent public transcript]',
      raw,
      '[End raw recent public transcript]',
    ].join('\n\n'),
  );
});

test('tutor-only learner classifier context pins full and fallback projections', () => {
  const classification = deepFreeze(publicTurnFixture().at(-1).classification);
  assert.equal(
    projectTutorStubLearnerClassifierContext(classification),
    [
      '[Tutor-only learner classifier]',
      'This turn: The learner distinguishes access from authorship.',
      'Overall: The inquiry has narrowed without premature closure.',
      'Discourse move: qualified_inference',
      'Evidence use: cross_checks_public_clues',
      'Epistemic stance: tentative_but_grounded',
      'Immediate pedagogical need: Test the remaining custody bridge.',
      'Use this as advisory context. Do not mention classifier labels, scores, rubrics, or hidden analysis to the learner.',
      '[End tutor-only learner classifier]',
    ].join('\n'),
  );
  assert.equal(projectTutorStubLearnerClassifierContext(null), '');

  const fallback = projectTutorStubLearnerClassifierContext({
    turn: {},
    overall: { next_best_tutor_move: 'Return to one public exhibit.' },
  });
  assert.match(fallback, /This turn: No turn summary\./u);
  assert.match(fallback, /Overall: No overall summary\./u);
  assert.match(fallback, /Discourse move: unknown/u);
  assert.match(fallback, /Immediate pedagogical need: Return to one public exhibit\./u);
});

test('the CLI keeps state defaults and call sites while services own pure projections', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const publicSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubPublicHistory.js'), 'utf8');
  const tutorOnlySource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTutorPromptContext.js'), 'utf8');
  const pipelineSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubTutorTurnPipeline.js'), 'utf8');
  const messageWrapper = cliSource.slice(
    cliSource.indexOf('function tutorMessageContext'),
    cliSource.indexOf('function compactPublicTranscriptForPrompt'),
  );
  const memoryWrappers = cliSource.slice(
    cliSource.indexOf('function compactPublicTranscriptForPrompt'),
    cliSource.indexOf('function dagNodeFact'),
  );

  assert.match(cliSource, /from '\.\.\/services\/tutorStubPublicHistory\.js';/u);
  assert.match(cliSource, /from '\.\.\/services\/tutorStubTutorPromptContext\.js';/u);
  assert.match(messageWrapper, /buildTutorStubTutorMessageContext/u);
  assert.match(messageWrapper, /state\?\.modelRef \|\| null/u);
  assert.match(messageWrapper, /state\?\.tutorContext\?\.activatedBy \|\| 'session_start'/u);
  assert.match(memoryWrappers, /projectTutorStubCompactPublicTranscript/u);
  assert.match(memoryWrappers, /state\?\.historyTurns \?\? STUB\.historyTurns/gu);
  assert.match(memoryWrappers, /Boolean\(state\?\.memory\?\.enabled\)/u);
  assert.match(memoryWrappers, /projectTutorStubLearnerClassifierContext/u);
  assert.match(cliSource, /createTutorStubTutorTurnPipeline/u);
  assert.match(pipelineSource, /return async function callTutor/u);
  assert.match(pipelineSource, /tutorMessageContext\(state, history\)/u);
  assert.doesNotMatch(cliSource, /\[Compact public dialogue memory\]/u);
  assert.doesNotMatch(cliSource, /\[Tutor-only learner classifier\]/u);
  assert.doesNotMatch(cliSource, /No previous turns in the raw recent window\./u);
  assert.doesNotMatch(publicSource, /\[Tutor-only learner classifier\]/u);
  assert.doesNotMatch(publicSource, /tutorStubTutorPromptContext/u);
  for (const serviceSource of [publicSource, tutorOnlySource, pipelineSource]) {
    assert.doesNotMatch(serviceSource, /(?:from|import\()[^\n]*scripts\//u);
    assert.doesNotMatch(serviceSource, /\b(?:spawnSync|fs|console|process|fetch|Date\.now)\s*[.(]/u);
  }
});
