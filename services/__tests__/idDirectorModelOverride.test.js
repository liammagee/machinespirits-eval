/**
 * The id-director must call the model the run asked for.
 *
 * The id and ego seats read their provider and model out of the cell block in
 * config/tutor-agents.yaml. A run launched with --ego-model / --tutor-model
 * asks for something else, and until 2026-08-08 that ask never reached this
 * engine: every August 2026 register run stored codex.gpt-5.5 in ego_model and
 * called the YAML's openrouter nemotron. Nothing caught it, because the run's
 * own record of the models is written by the runner, not by the engine.
 *
 * These tests read the models off the calls themselves, so the record and the
 * call can no longer drift apart in silence.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { generateIdDirectedSuggestion, __setDeps, __resetDeps } = await import('../idDirectorEngine.js');
const { getTutorProfile } = await import('../evalConfigLoader.js');

// Cell 196 is one of the runs this bug hit: nemotron ego, kimi-k2.5 id.
const CELL = 'cell_196_id_director_ironic_challenge_breakthrough_dynamic_verified';

const CONTEXT = {
  learnerContext: 'LEARNER: Master and slave is just about work, dependence and fear.',
  curriculumContext: '',
  simulationsContext: '',
  messageHistory: [],
};

// Long enough to clear the parser's minimum, so the id output parses and the
// run reaches the ego seat without a fallback warning.
const ID_OUTPUT = JSON.stringify({
  generated_prompt:
    'You are a tutor with a definite voice. Read what the learner just said, answer it in ' +
    'their own terms, and end with one question that asks them to take a position.',
});

/** Record every model call instead of making one. */
function recordingDeps() {
  const calls = [];
  __setDeps({
    tutorConfig: { getProviderConfig: () => ({ isConfigured: true, apiKey: 'test', models: {} }) },
    callAI: async (agentConfig, _systemPrompt, _userPrompt, role) => {
      calls.push({ role, provider: agentConfig.provider, model: agentConfig.model });
      return { text: ID_OUTPUT, inputTokens: 0, outputTokens: 0 };
    },
  });
  return calls;
}

const seat = (calls, role) => calls.find((c) => c.role === role);

afterEach(() => __resetDeps());

test('an override replaces the model both seats call', async () => {
  const calls = recordingDeps();
  await generateIdDirectedSuggestion(
    CONTEXT,
    {
      profileName: CELL,
      tutorModelOverrides: {
        ego: { provider: 'codex', model: 'gpt-5.5' },
        superego: { provider: 'codex', model: 'gpt-5.5' },
      },
    },
    getTutorProfile(CELL),
  );

  assert.deepEqual(seat(calls, 'tutor_id'), { role: 'tutor_id', provider: 'codex', model: 'gpt-5.5' });
  assert.deepEqual(seat(calls, 'tutor_ego'), { role: 'tutor_ego', provider: 'codex', model: 'gpt-5.5' });
});

test('an override on one seat leaves the other on the cell YAML', async () => {
  const calls = recordingDeps();
  await generateIdDirectedSuggestion(
    CONTEXT,
    { profileName: CELL, tutorModelOverrides: { ego: { provider: 'codex', model: 'gpt-5.5' }, superego: null } },
    getTutorProfile(CELL),
  );

  assert.equal(seat(calls, 'tutor_ego').model, 'gpt-5.5');
  assert.equal(seat(calls, 'tutor_id').provider, 'openrouter');
  assert.match(seat(calls, 'tutor_id').model, /kimi/i);
});

test('with no override both seats call what the cell YAML names', async () => {
  const calls = recordingDeps();
  await generateIdDirectedSuggestion(CONTEXT, { profileName: CELL }, getTutorProfile(CELL));

  // This is what the August 2026 register runs actually did, whatever their
  // ego_model column said.
  assert.match(seat(calls, 'tutor_ego').model, /nemotron/i);
  assert.match(seat(calls, 'tutor_id').model, /kimi/i);
});
