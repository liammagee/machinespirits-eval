import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubAutomatedLearnerGenerationRuntime } from '../services/tutorStubAutomatedLearnerGenerationRuntime.js';
import {
  learnerRevisionPrompt,
  learnerSuperegoSystemPrompt,
  normalizeTutorStubLearnerDeliberationConfig,
  progressiveResistanceSystemOverlay,
} from '../services/tutorStubLearnerDeliberation.js';

test('progressive resistance changes the move without weakening the resistant role', () => {
  const overlay = progressiveResistanceSystemOverlay();
  assert.match(overlay, /Treat an objection.*accepted or answered as settled/u);
  assert.match(overlay, /Resistance is not stasis/u);
  assert.match(overlay, /Never invent evidence, become generically agreeable/u);

  const system = learnerSuperegoSystemPrompt({
    profile: 'Contest the imposed frame and keep working locally.',
    style: 'authenticity_progress_v1',
  });
  assert.match(system, /authenticity-preserving critique, not correction/u);
  assert.match(system, /Do not draft, quote, or rewrite the public learner response/u);
  assert.match(system, /ROLE_FIDELITY:.*STASIS:.*NEXT_RESISTANCE_MOVE:.*NEW_LOCAL_WORK:/su);

  const revision = learnerRevisionPrompt({
    basePrompt: 'Write the next learner turn.',
    turnNumber: 3,
    initialDraft: 'Who says that standard is known good?',
    review: 'STASIS: repeats the accepted standard objection.',
  });
  assert.match(revision, /You retain final authority/u);
  assert.match(revision, /change the substantive target and add one new local action/u);
  assert.match(revision, /Output only the final public learner speech/u);
});

test('learner deliberation config defaults to direct and rejects incomplete superego setup', () => {
  assert.deepEqual(normalizeTutorStubLearnerDeliberationConfig({}), {
    systemStyle: 'standard',
    mode: 'direct',
    superegoModelRef: null,
    superegoStyle: null,
    superegoEffort: null,
  });
  assert.throws(
    () => normalizeTutorStubLearnerDeliberationConfig({ TUTOR_STUB_AUTO_LEARNER_DELIBERATION: 'ego_superego' }),
    /TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE must be one of/u,
  );
});

test('Luna may critique privately while the learner ego authors the final public turn', async () => {
  const calls = [];
  const events = [];
  const runtime = createTutorStubAutomatedLearnerGenerationRuntime({
    appendTraceEvent(_trace, event) {
      events.push(event);
    },
    async callPromptModel(request) {
      calls.push(request);
      if (request.role === 'tutor_stub_auto_learner') {
        return { text: 'Who says that standard is known good?', provider: 'mlx-local', model: 'qwen' };
      }
      if (request.role === 'tutor_stub_auto_learner_superego') {
        return {
          text: [
            'ROLE_FIDELITY: intact',
            'STASIS: repeats an answered objection',
            'NEXT_RESISTANCE_MOVE: perform the bounded comparison',
            'NEW_LOCAL_WORK: state what the weight result changes',
          ].join('\n'),
          provider: 'codex',
          model: 'gpt-5.6-luna',
        };
      }
      return {
        text: 'I will compare the ring against the trial weight; a match clears only that mark, not your whole verdict.',
        provider: 'mlx-local',
        model: 'qwen',
      };
    },
    classificationFromCombinedAnalysis() {},
    env: {
      TUTOR_STUB_AUTO_LEARNER_SYSTEM_STYLE: 'progressive_resistance_v1',
      TUTOR_STUB_AUTO_LEARNER_DELIBERATION: 'ego_superego',
      TUTOR_STUB_AUTO_LEARNER_SUPEREGO_MODEL: 'codex.gpt-5.6-luna',
      TUTOR_STUB_AUTO_LEARNER_SUPEREGO_STYLE: 'authenticity_progress_v1',
      TUTOR_STUB_AUTO_LEARNER_SUPEREGO_EFFORT: 'low',
    },
    extractCombinedLearnerAnalysis() {},
    learnerProfileContract() {
      return null;
    },
    learnerProfileIds: () => ['frame_defiant'],
    learnerProfilePrompt: () => 'Contest the imposed frame and keep working locally.',
    negativeFloorRegisters: [],
    resolveModel(modelRef) {
      assert.equal(modelRef, 'codex.gpt-5.6-luna');
      return { provider: 'codex', model: 'gpt-5.6-luna' };
    },
  });

  const generated = await runtime.generateAutomatedLearnerTurn({
    state: {
      history: [
        { role: 'user', content: 'Who says that standard is known good?' },
        { role: 'assistant', content: 'Fair. Let us use the trial weight already on the public table.' },
      ],
      turns: [],
      trace: [],
      world: null,
    },
    resolved: { provider: 'mlx-local', model: 'qwen' },
    profile: 'Contest the imposed frame and keep working locally.',
    turnNumber: 3,
  });

  assert.deepEqual(
    calls.map((call) => call.role),
    ['tutor_stub_auto_learner', 'tutor_stub_auto_learner_superego', 'tutor_stub_auto_learner_revision'],
  );
  assert.equal(generated.text, 'I will compare the ring against the trial weight; a match clears only that mark, not your whole verdict.');
  assert.equal(generated.provider, 'mlx-local');
  assert.equal(generated.learnerDeliberation.finalAuthority, 'learner_ego');
  assert.equal(generated.learnerDeliberation.callCount, 3);
  assert.equal(events.filter((event) => event.type === 'auto_learner_deliberation').length, 1);
  assert.doesNotMatch(generated.text, /ROLE_FIDELITY|STASIS|superego/u);
});
