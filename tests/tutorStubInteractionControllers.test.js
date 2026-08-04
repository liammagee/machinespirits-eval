import assert from 'node:assert/strict';
import test from 'node:test';

import { createTutorStubModelPickerController } from '../services/tutorStubModelPickerController.js';
import { createTutorStubVoiceController } from '../services/tutorStubVoiceController.js';

test('voice controller projects the disabled runtime without starting a bridge', () => {
  const controller = createTutorStubVoiceController({
    state: {
      voice: {
        schema: 'machinespirits.tutor-stub.voice-runtime.v1',
        enabled: false,
        model: 'gpt-realtime-mini',
        voice: 'alloy',
        transcriptionModel: 'gpt-realtime-whisper',
        bridge: null,
        lastStartedAt: null,
        lastStoppedAt: null,
        deliveries: [],
        interruptions: 0,
      },
    },
  });

  assert.deepEqual(controller.voiceRuntimeSnapshot(), {
    schema: 'machinespirits.tutor-stub.voice-runtime.v1',
    enabled: false,
    model: 'gpt-realtime-mini',
    voice: 'alloy',
    transcriptionModel: 'gpt-realtime-whisper',
    apiKeyConfigured: Boolean(process.env.OPENAI_API_KEY),
    bridge: null,
    lastStartedAt: null,
    lastStoppedAt: null,
    deliveryCount: 0,
    interruptions: 0,
    authority: 'existing_cli_analysis_dag_register_guard_pipeline',
    automaticRealtimeResponses: false,
  });
});

test('model picker controller owns the four role catalog and TTY availability check', () => {
  const controller = createTutorStubModelPickerController({
    STUB: {
      model: 'tutor-default',
      classifierModel: 'classifier-default',
      learnerRecordModel: 'reasoning-default',
      autoLearnerModel: 'learner-default',
    },
    input: { isTTY: true, setRawMode() {} },
    output: { isTTY: true },
    setModelBinding() {},
  });

  assert.deepEqual(Object.keys(controller.liveModelRoleDefinitions), ['tutor', 'classifier', 'reasoning', 'learner']);
  assert.equal(controller.liveSettingsPickerAvailable(), true);
});
