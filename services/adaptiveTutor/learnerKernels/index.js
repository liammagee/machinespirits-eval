import { cloneKernelValue } from './contract.js';
import { dropoutReadoptionKernel } from './dropoutReadoptionKernel.js';
import { durableOwnershipKernel } from './durableStateKernel.js';

export * from './contract.js';
export * from './dropoutReadoptionKernel.js';
export * from './durableStateKernel.js';
export * from './worldAdapter.js';

const KERNELS = Object.freeze({
  durable_state: durableOwnershipKernel,
  dag_dropout: dropoutReadoptionKernel,
});

function sortedIds(values) {
  return [...values].map(String).sort((left, right) => left.localeCompare(right));
}

function validateRealizerResult(result, envelope) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('learnerKernel: realizer must return one JSON object');
  }
  const keys = Object.keys(result).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['learner_text', 'realized_public_event_ids'])) {
    throw new Error('learnerKernel: realizer output must contain only learner_text and realized_public_event_ids');
  }
  if (!String(result.learner_text || '').trim() || !Array.isArray(result.realized_public_event_ids)) {
    throw new Error('learnerKernel: realizer output contract is incomplete');
  }
  const expected = sortedIds(envelope.required_realizer_output.realized_public_event_ids || []);
  const observed = sortedIds(result.realized_public_event_ids);
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    throw new Error('learnerKernel: realizer changed the harness-owned public event ids');
  }
  return {
    learner_text: String(result.learner_text).trim(),
    realized_public_event_ids: observed,
  };
}

export function adaptiveStateLearnerKernel(id) {
  const kernel = KERNELS[String(id || '')];
  if (!kernel) throw new Error(`learnerKernel: unknown kernel ${JSON.stringify(id)}`);
  return kernel;
}

export function adaptiveStateKernelTaskMetadata(adapter) {
  return {
    task_id: `adaptive-state-${adapter.id}`,
    knowledge_component: `world-general public proof navigation (${adapter.geometry})`,
    prerequisite_path: ['identify public evidence', 'connect evidence to the live proof obligation'],
    item_difficulty: Number(
      (adapter.normalization_denominator / Math.max(2, adapter.critical_premise_count)).toFixed(3),
    ),
    item_discrimination: 1,
    proof_geometry: adapter.geometry,
    proof_critical_premise_count: adapter.critical_premise_count,
    benchmark_challenge_count: adapter.challenge_premise_count,
  };
}

export function createAdaptiveStateKernelSession({ adapter, kernel: kernelInput, seed }) {
  const kernel = typeof kernelInput === 'string' ? adaptiveStateLearnerKernel(kernelInput) : kernelInput;
  const state = kernel.initialize({ adapter, seed });
  const initialEvent = adapter.noneEvent({ semanticRole: 'initial_public_learner_state' });
  return {
    schema: 'machinespirits.adaptive-state-kernel-session.v2',
    adapter,
    kernel,
    seed: Number(seed),
    state,
    bootstrap: {
      turn: 0,
      event: cloneKernelValue(initialEvent),
      turn_record: kernel.turnRecord({
        adapter,
        turn: 0,
        learnerText: 'The learner enters with the currently public evidence and an unresolved proof obligation.',
        state,
        event: initialEvent,
      }),
    },
    initial_public_envelope: kernel.initialPublicEnvelope({ adapter, state, turn: 1 }),
    task: adaptiveStateKernelTaskMetadata(adapter),
    kernel_provenance: cloneKernelValue(kernel.metadata),
  };
}

export function materializeAdaptiveStateInitialTurn(session, realizerResult) {
  const realized = validateRealizerResult(realizerResult, session.initial_public_envelope);
  const event = session.adapter.noneEvent({ semanticRole: 'initial_public_learner_state' });
  return {
    turn: 1,
    public_envelope: cloneKernelValue(session.initial_public_envelope),
    realizer_output: realized,
    turn_record: session.kernel.turnRecord({
      adapter: session.adapter,
      turn: 1,
      learnerText: realized.learner_text,
      state: session.state,
      event,
    }),
  };
}

export function stepAdaptiveStateKernelSession({ session, action, predictionTurn, transitionSeed = null }) {
  const seed = transitionSeed ?? session.seed * 100 + Number(predictionTurn);
  const forecast = session.kernel.oracleBeforeSample({
    adapter: session.adapter,
    state: session.state,
    action,
    turn: predictionTurn,
    seed,
  });
  const transition = session.kernel.transition({
    adapter: session.adapter,
    state: session.state,
    action,
    turn: predictionTurn,
    seed,
    forecast,
  });
  return {
    transition,
    next_session: {
      ...session,
      state: transition.next_state,
    },
  };
}

export function materializeAdaptiveStateTransitionTurn({ session, transition, realizerResult }) {
  const realized = validateRealizerResult(realizerResult, transition.public_envelope);
  return {
    turn: transition.realized_turn,
    public_envelope: cloneKernelValue(transition.public_envelope),
    realizer_output: realized,
    turn_record: session.kernel.turnRecord({
      adapter: session.adapter,
      turn: transition.realized_turn,
      learnerText: realized.learner_text,
      state: transition.next_state,
      event: transition.event,
    }),
  };
}

export function deterministicAdaptiveStateRealizer(envelope) {
  const act = envelope.current_public_act_envelope || {};
  const evidence = act.events?.[0]?.evidence_surface;
  const text =
    act.event_family === 'adopt' && evidence
      ? `I can take up that public evidence now: ${evidence}`
      : act.event_family === 'derive'
        ? 'I can now state the supported inference in my own words and connect it to the inquiry.'
        : act.event_family === 'retract'
          ? act.semantic_role === 'public_evidence_loss'
            ? 'I know that evidence was stated earlier, but I cannot use it in my current reasoning.'
            : 'I withdraw that earlier step; the public record no longer supports it.'
          : 'I can describe where I am, but I do not yet have a new public proof move.';
  return {
    learner_text: text,
    realized_public_event_ids: [...(envelope.required_realizer_output.realized_public_event_ids || [])],
  };
}

export async function runAdaptiveStateKernelDialogue({
  adapter,
  kernel,
  seed,
  actionSchedule,
  realize = deterministicAdaptiveStateRealizer,
}) {
  if (!Array.isArray(actionSchedule) || !actionSchedule.length) {
    throw new Error('learnerKernel: actionSchedule must contain at least one action');
  }
  let session = createAdaptiveStateKernelSession({ adapter, kernel, seed });
  const initialOutput = await realize(cloneKernelValue(session.initial_public_envelope), { turn: 1, initial: true });
  const initial = materializeAdaptiveStateInitialTurn(session, initialOutput);
  const turns = [initial];
  const transitions = [];
  for (const [index, action] of actionSchedule.entries()) {
    const predictionTurn = index + 1;
    const stepped = stepAdaptiveStateKernelSession({ session, action, predictionTurn });
    const output = await realize(cloneKernelValue(stepped.transition.public_envelope), {
      turn: predictionTurn + 1,
      initial: false,
      action,
    });
    const realized = materializeAdaptiveStateTransitionTurn({
      session,
      transition: stepped.transition,
      realizerResult: output,
    });
    transitions.push(stepped.transition);
    turns.push(realized);
    session = stepped.next_session;
  }
  return {
    schema: 'machinespirits.adaptive-state-kernel-dialogue.v2',
    world_id: adapter.id,
    generator_id: session.kernel.id,
    seed: Number(seed),
    task: session.task,
    kernel_provenance: cloneKernelValue(session.kernel_provenance),
    bootstrap: cloneKernelValue(session.bootstrap),
    turns,
    all_turn_records: [cloneKernelValue(session.bootstrap.turn_record), ...turns.map((row) => row.turn_record)],
    transitions,
    final_hidden_state: cloneKernelValue(session.state),
  };
}
