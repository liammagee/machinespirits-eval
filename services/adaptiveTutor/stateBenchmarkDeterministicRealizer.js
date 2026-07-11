export const ADAPTIVE_STATE_DETERMINISTIC_REALIZER_SCHEMA =
  'machinespirits.adaptive-state-deterministic-realizer.v2';

const REALIZERS = new Set(['canonical_template', 'surface_paraphrase']);
const FORBIDDEN_INPUT_KEY = /(?:^|_)(?:future|target|oracle|answer_key|hidden|private)(?:_|$)/iu;

function eventRows(envelope = {}) {
  if (Array.isArray(envelope.events)) return envelope.events;
  if (envelope.event && typeof envelope.event === 'object') return [envelope.event];
  return [];
}

function eventIds(envelope, events) {
  const declared = envelope.realized_public_event_ids || envelope.public_event_ids || envelope.event_ids;
  if (Array.isArray(declared)) return declared.map(String);
  return events.map((event, index) =>
    String(event.event_id || event.id || `${event.kind || event.type || 'none'}:${index + 1}`),
  );
}

function assertNoFutureInput(value, path = 'realizer_input') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_INPUT_KEY.test(key)) {
      throw new Error(`stateBenchmarkRealizer: forbidden input ${path}.${key}`);
    }
    assertNoFutureInput(child, `${path}.${key}`);
  }
}

function eventKind(events, envelope) {
  const value = events[0]?.kind || events[0]?.type || envelope.event_family || envelope.move || 'none';
  return ['adopt', 'derive', 'retract'].includes(value) ? value : 'none';
}

function publicSurface(events, envelope) {
  const candidates = [
    ...events.flatMap((event) => [event.surface, event.public_surface, event.evidence_surface, event.summary]),
    envelope.public_summary,
    envelope.learner_summary,
  ];
  return String(candidates.find((value) => typeof value === 'string' && value.trim()) || '').trim();
}

function canonicalText(kind, surface, turn) {
  if (surface) {
    if (kind === 'retract') return `I withdraw that step: ${surface}`;
    if (kind === 'derive') return `From the public evidence, I can derive this: ${surface}`;
    if (kind === 'adopt') return `I will add this public evidence to my account: ${surface}`;
    return `My current public account is: ${surface}`;
  }
  if (kind === 'retract') return 'I withdraw the unsupported step from my account.';
  if (kind === 'derive') return 'I can now state the next inference from the public evidence.';
  if (kind === 'adopt') return 'I will adopt the available public evidence and keep working from it.';
  return turn <= 1
    ? 'I am ready to work from the public evidence, but I will not claim more than it supports.'
    : 'I cannot add a warranted proof step yet, so I will hold the current account steady.';
}

function paraphraseText(kind, surface, turn) {
  if (surface) {
    if (kind === 'retract') return `That part no longer belongs in my reasoning; I am taking it back. ${surface}`;
    if (kind === 'derive') return `The evidence now lets me make the following connection. ${surface}`;
    if (kind === 'adopt') return `This is public evidence I can responsibly bring into the proof. ${surface}`;
    return `For now, the public record leaves me here. ${surface}`;
  }
  if (kind === 'retract') return 'On reflection, I should remove that unsupported move.';
  if (kind === 'derive') return 'I can connect the public pieces into one further conclusion now.';
  if (kind === 'adopt') return 'I can take up that public evidence without jumping to the answer.';
  return turn <= 1
    ? 'I will begin with what the public record actually warrants and leave the answer open.'
    : 'Nothing new is warranted yet, so I am keeping the proof where it is.';
}

/**
 * Surface-only deterministic substitute for the paid one-turn learner call.
 * The envelope is already redacted by the transition harness; this function
 * cannot select or change a semantic event.
 */
export function realizeAdaptiveStateStage0LearnerTurn({
  realizerId,
  currentPublicActEnvelope,
  priorPublicTranscript = [],
  currentAction = null,
  publicWorldVocabulary = [],
} = {}) {
  if (!REALIZERS.has(realizerId)) {
    throw new Error(`stateBenchmarkRealizer: unsupported deterministic realizer ${JSON.stringify(realizerId)}`);
  }
  if (!currentPublicActEnvelope || typeof currentPublicActEnvelope !== 'object') {
    throw new Error('stateBenchmarkRealizer: current public act envelope is required');
  }
  assertNoFutureInput({
    current_public_act_envelope: currentPublicActEnvelope,
    prior_public_transcript: priorPublicTranscript,
    current_action: currentAction,
    public_world_vocabulary: publicWorldVocabulary,
  });
  const events = eventRows(currentPublicActEnvelope);
  const ids = eventIds(currentPublicActEnvelope, events);
  const kind = eventKind(events, currentPublicActEnvelope);
  const surface = publicSurface(events, currentPublicActEnvelope);
  const turn = Number(currentPublicActEnvelope.turn || 0);
  return {
    learner_text:
      realizerId === 'canonical_template'
        ? canonicalText(kind, surface, turn)
        : paraphraseText(kind, surface, turn),
    realized_public_event_ids: ids,
  };
}
