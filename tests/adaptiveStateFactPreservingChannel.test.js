import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import yaml from 'yaml';

import { buildAdaptiveStateCliRealizerInput } from '../services/adaptiveTutor/stateBenchmarkCliRealizer.js';
import {
  assessAdaptiveStateSemanticFidelity,
  realizeAdaptiveStateStage0LearnerTurn,
} from '../services/adaptiveTutor/stateBenchmarkDeterministicRealizer.js';
import { loadAdaptiveStateWorldAdapters } from '../services/adaptiveTutor/learnerKernels/index.js';

const ROOT = path.resolve('.');

function benchmarkConfig() {
  return yaml.parse(fs.readFileSync(path.join(ROOT, 'config/adaptive-state-benchmark-v2.yaml'), 'utf8'));
}

function inputFor(envelope) {
  return {
    currentPublicActEnvelope: {
      ...structuredClone(envelope.current_public_act_envelope),
      turn: Number(envelope.turn),
    },
    priorPublicTranscript: [],
    currentAction: { action_type: 'request_evidence' },
    publicWorldVocabulary: structuredClone(envelope.public_world_vocabulary),
  };
}

test('v2.3 freezes a claim-bearing exact channel and a separate descriptive transfer lane', () => {
  const protocol = yaml.parse(
    fs.readFileSync(path.join(ROOT, 'config/adaptive-state-instrument-v2.3.yaml'), 'utf8'),
  );
  assert.equal(protocol.version, '2.3');
  assert.equal(protocol.lanes.claim_bearing.model_calls, 0);
  assert.equal(protocol.lanes.claim_bearing.can_authorize_sensor_analysis, true);
  assert.equal(protocol.lanes.descriptive_transfer.gate_eligible, false);
  assert.equal(protocol.phase_6_protocol.phase_6b_policy_comparison.status, 'blocked');
  assert.equal(protocol.immutability.rerun_v2_2, false);
});

test('Ravensmark derive exposes and renders the exact pressedSealFor fact', () => {
  const adapter = loadAdaptiveStateWorldAdapters(benchmarkConfig().critical_path.worlds).find(
    (candidate) => candidate.id === 'ravensmark',
  );
  let proof = adapter.initialHiddenProofState();
  proof = adapter.applyEvent(proof, adapter.adoptEvent('p_mark'));
  proof = adapter.applyEvent(proof, adapter.adoptEvent('p_registry'));
  const event = adapter.deriveEvent(adapter.nextDerivableFact(proof));
  const afterProof = adapter.applyEvent(proof, event);
  const envelope = adapter.publicEnvelope({
    kernelId: 'durable_state',
    actionType: 'request_evidence',
    turn: 4,
    afterState: { proof: afterProof, public_cues: {} },
    event,
  });
  const publicEvent = envelope.current_public_act_envelope.events[0];
  assert.deepEqual(publicEvent.semantic_payload.fact, ['pressedSealFor', 'gatePass', 'elian']);
  assert.equal(publicEvent.semantic_payload.canonical_atom, '["pressedSealFor","gatePass","elian"]');

  for (const realizerId of ['canonical_template', 'surface_paraphrase']) {
    const input = inputFor(envelope);
    assert.doesNotThrow(() => buildAdaptiveStateCliRealizerInput(input));
    const output = realizeAdaptiveStateStage0LearnerTurn({ realizerId, ...input });
    assert.match(output.learner_text, /FACT \["pressedSealFor","gatePass","elian"\]/u);
    assert.equal(
      assessAdaptiveStateSemanticFidelity({
        currentPublicActEnvelope: input.currentPublicActEnvelope,
        output,
      }).status,
      'pass',
    );
  }
});

test('family labels and event-id sidecars cannot substitute for exact fact fidelity', () => {
  const adapter = loadAdaptiveStateWorldAdapters(benchmarkConfig().critical_path.worlds).find(
    (candidate) => candidate.id === 'ravensmark',
  );
  let proof = adapter.initialHiddenProofState();
  proof = adapter.applyEvent(proof, adapter.adoptEvent('p_mark'));
  proof = adapter.applyEvent(proof, adapter.adoptEvent('p_registry'));
  const event = adapter.deriveEvent(adapter.nextDerivableFact(proof));
  const envelope = adapter.publicEnvelope({
    kernelId: 'durable_state',
    actionType: 'request_evidence',
    turn: 4,
    afterState: { proof: adapter.applyEvent(proof, event), public_cues: {} },
    event,
  });
  const currentPublicActEnvelope = inputFor(envelope).currentPublicActEnvelope;
  const expectedIds = envelope.required_realizer_output.realized_public_event_ids;
  const repeatedPremise = {
    learner_text: 'The dusk-seal on the pass was held by Elian.',
    realized_public_event_ids: expectedIds,
  };
  const falsePositiveParaphrase = {
    learner_text: "The older dusk-seal on the pass was Elian's seal.",
    realized_public_event_ids: expectedIds,
  };
  assert.equal(
    assessAdaptiveStateSemanticFidelity({ currentPublicActEnvelope, output: repeatedPremise }).status,
    'fail',
  );
  assert.equal(
    assessAdaptiveStateSemanticFidelity({ currentPublicActEnvelope, output: falsePositiveParaphrase }).status,
    'fail',
  );
});

test('adopt and retract public events carry the exact current premise fact without future targets', () => {
  const adapter = loadAdaptiveStateWorldAdapters(benchmarkConfig().critical_path.worlds)[0];
  for (const event of [adapter.adoptEvent('p_graver'), adapter.retractPremiseEvent('p_graver')]) {
    const proof = adapter.applyEvent(adapter.initialHiddenProofState(), event);
    const envelope = adapter.publicEnvelope({
      kernelId: 'dag_dropout',
      actionType: 'request_evidence',
      turn: 2,
      afterState: { proof, public_cues: {} },
      event,
    });
    const serialized = JSON.stringify(envelope);
    assert.deepEqual(envelope.current_public_act_envelope.events[0].semantic_payload.fact, [
      'flawCutBy',
      'notchedSerif',
      'wornBurin',
    ]);
    assert.doesNotMatch(serialized, /future|oracle|target|answer_key/iu);
  }
});
