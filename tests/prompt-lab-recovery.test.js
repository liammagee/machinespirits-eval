import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  aggregateRunRows,
  applyPromptEditOperations,
  main,
  parseJsonResponse,
  recoverPromptCandidate,
  validatePromptCandidate,
} from '../scripts/prompt-lab.js';

function makeSilentConsole() {
  const originalLog = console.log;
  console.log = () => {};
  return () => {
    console.log = originalLog;
  };
}

function writePromptLabSession(sessionRoot, sessionId = 'ownership-fixture') {
  const sessionDir = path.join(sessionRoot, sessionId);
  const baselineDir = path.join(sessionDir, 'baseline', 'prompts');
  const promptDir = path.join(sessionDir, 'prompts');
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(promptDir, { recursive: true });
  fs.writeFileSync(
    path.join(sessionDir, 'session.json'),
    `${JSON.stringify(
      {
        sessionId,
        createdAt: '2026-08-09T00:00:00.000Z',
        updatedAt: '2026-08-09T00:00:00.000Z',
        profileName: 'cell_prompt_lab_test',
        scenarioId: 'prompt_lab_scenario',
        modelRef: 'mock.prompt-lab',
        judgeRef: null,
        judgeCli: 'codex',
        judgeCliModel: null,
        judgeSource: 'default',
        parallelism: 1,
        runsPerIteration: 1,
        promptDir,
        baselineDir,
        resolvedTutorProfileName: 'budget',
        learnerProfileName: 'unified',
        promptFiles: [],
        iterations: [
          {
            iteration: 1,
            runId: 'eval-prompt-lab-fixture',
            scenarioId: 'prompt_lab_scenario',
            summary: null,
          },
        ],
        recommendations: [],
      },
      null,
      2,
    )}\n`,
  );
  return path.join(sessionDir, 'session.json');
}

test('prompt-lab help and invalid session admission stay store- and filesystem-free', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-lab-admission-'));
  const sessionRoot = path.join(tempDir, 'sessions');
  let storesCreated = 0;
  const restoreConsole = makeSilentConsole();

  try {
    const createStore = () => {
      storesCreated++;
      throw new Error('evaluation store should not open');
    };
    assert.equal(await main([], { createStore, sessionRoot }), 0);
    await assert.rejects(main(['status', '--session', 'missing'], { createStore, sessionRoot }), /Session not found/u);
    await assert.rejects(main(['import'], { createStore, sessionRoot }), /--run-id is required/u);
    assert.equal(storesCreated, 0);
    assert.equal(fs.existsSync(sessionRoot), false);
  } finally {
    restoreConsole();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('prompt-lab status shares one store and closes only script-owned stores', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-lab-store-'));
  const sessionRoot = path.join(tempDir, 'sessions');
  const manifestPath = writePromptLabSession(sessionRoot);
  let closes = 0;
  const store = {
    getResults: () => [
      {
        id: 1,
        dialogueId: 'dialogue-1',
        createdAt: '2026-08-09T00:01:00.000Z',
        success: true,
        tutorFirstTurnScore: 72,
        tutorOverallScore: null,
        latencyMs: 100,
        inputTokens: 10,
        outputTokens: 5,
        cost: 0,
        judgeModel: 'codex-cli/auto',
        scoringMethod: 'rubric',
      },
    ],
    getRunStats: () => [],
    getScenarioStats: () => [],
    close: () => {
      closes++;
    },
  };
  const restoreConsole = makeSilentConsole();

  try {
    const command = ['status', '--session', 'ownership-fixture'];
    assert.equal(await main(command, { evaluationStore: store, sessionRoot }), 0);
    assert.equal(closes, 0);
    assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).iterations[0].summary.primaryScore, 72);

    assert.equal(await main(command, { createStore: () => store, sessionRoot }), 0);
    assert.equal(closes, 1);

    let failureCloses = 0;
    const failingStore = {
      getResults: () => {
        throw new Error('expected prompt-lab read failure');
      },
      close: () => {
        failureCloses++;
      },
    };
    await assert.rejects(main(command, { createStore: () => failingStore, sessionRoot }), {
      message: 'expected prompt-lab read failure',
    });
    assert.equal(failureCloses, 1);
  } finally {
    restoreConsole();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('prompt-lab run preserves child arguments while forwarding the injected environment', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-lab-run-'));
  const sessionRoot = path.join(tempDir, 'sessions');
  const manifestPath = writePromptLabSession(sessionRoot);
  const childCalls = [];
  const store = {
    getResults: () => [
      {
        id: 1,
        dialogueId: 'dialogue-1',
        createdAt: '2026-08-09T00:01:00.000Z',
        success: true,
        tutorFirstTurnScore: 75,
        tutorOverallScore: null,
        latencyMs: 100,
        inputTokens: 10,
        outputTokens: 5,
        cost: 0,
        judgeModel: null,
        scoringMethod: 'mock',
      },
    ],
    getRunStats: () => [],
    getScenarioStats: () => [],
    close: () => {
      throw new Error('host-owned prompt-lab store must remain open');
    },
  };
  const restoreConsole = makeSilentConsole();

  try {
    const code = await main(['run', '--session', 'ownership-fixture', '--dry-run', '--skip-rubric'], {
      evaluationStore: store,
      sessionRoot,
      rootDir: '/injected/repository',
      env: { EVAL_DB_PATH: '/isolated/evaluations.db', CUSTOM_PROMPT_LAB_ENV: 'yes' },
      runChild: async (command, childArgs, options) => {
        childCalls.push({ command, childArgs, options });
        return { code: 0, stdout: 'Run ID: eval-2026-08-09-abc12345\n', stderr: '' };
      },
    });

    assert.equal(code, 0);
    assert.equal(childCalls.length, 1);
    assert.equal(childCalls[0].command, 'node');
    assert.equal(childCalls[0].childArgs[0], '/injected/repository/scripts/eval-cli.js');
    assert.equal(childCalls[0].childArgs.includes('--dry-run'), true);
    assert.equal(childCalls[0].childArgs.includes('--skip-rubric'), true);
    assert.equal(childCalls[0].options.cwd, '/injected/repository');
    assert.equal(childCalls[0].options.env.EVAL_DB_PATH, '/isolated/evaluations.db');
    assert.equal(childCalls[0].options.env.CUSTOM_PROMPT_LAB_ENV, 'yes');
    assert.match(childCalls[0].options.env.MACHINESPIRITS_PROMPTS_DIR, /ownership-fixture\/prompts$/u);

    const session = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(session.iterations.length, 2);
    assert.equal(session.iterations[1].runId, 'eval-2026-08-09-abc12345');
    assert.equal(session.iterations[1].summary.primaryScore, 75);
  } finally {
    restoreConsole();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

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
