export const TUTOR_STUB_RELEASE_PACING_SCHEMA = 'machinespirits.tutor-stub.release-pacing.v1';
export const DEFAULT_TUTOR_STUB_RELEASE_SPEED = 1;
export const MIN_TUTOR_STUB_RELEASE_SPEED = 0.5;
export const MAX_TUTOR_STUB_RELEASE_SPEED = 2;

const MIN_EFFECTIVE_RELEASE_SPEED = 0.35;
const MAX_EFFECTIVE_RELEASE_SPEED = 2.5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function round(value, digits = 3) {
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function oneLine(value) {
  return String(value || '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function normalizeTutorStubReleaseSpeed(value, { label = 'clue release speed' } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < MIN_TUTOR_STUB_RELEASE_SPEED || number > MAX_TUTOR_STUB_RELEASE_SPEED) {
    throw new Error(`${label} must be between ${MIN_TUTOR_STUB_RELEASE_SPEED} and ${MAX_TUTOR_STUB_RELEASE_SPEED}`);
  }
  return number;
}

function authoredTurn(entry) {
  const value = Number(entry?.authoredTurn ?? entry?.authored_turn ?? entry?.turn);
  return Number.isFinite(value) ? value : 0;
}

function releaseEntries(world) {
  return [...(world?.releaseSchedule || [])].sort(
    (left, right) =>
      authoredTurn(left) - authoredTurn(right) || String(left.premise).localeCompare(String(right.premise)),
  );
}

function annotateAuthoredSchedule(world) {
  for (const entry of world?.releaseSchedule || []) {
    if (!Number.isFinite(Number(entry.authoredTurn))) entry.authoredTurn = Number(entry.turn);
    entry.turn = Number(entry.turn);
  }
}

function classificationSignal(classification) {
  const turn = classification?.turn || {};
  const overall = classification?.overall || {};
  return oneLine(
    [
      turn.summary,
      turn.request_type,
      turn.discourse_move,
      turn.epistemic_stance,
      turn.affect,
      turn.agency,
      turn.pedagogical_need,
      overall.summary,
      overall.trajectory,
      overall.recurring_pattern,
      overall.current_state,
      overall.next_best_tutor_move,
    ].join(' '),
  );
}

const DIRECT_ACCELERATE =
  /\b(?:move (?:it|this|things) along|get (?:to|on with) it|pick up the pace|speed (?:it )?up|go faster|faster please|skip ahead|next clue|keep (?:it|things) moving|hurry|cut to the chase|boring)\b/iu;
const DIRECT_DECELERATE =
  /\b(?:slow down|not so fast|too fast|one (?:clue|step|thing) at a time|wait|hold on|give me (?:a moment|some time|time)|go back|pause|let me think)\b/iu;
const ANALYZED_ACCELERATE =
  /\b(?:impatient|bored|faster|rapid|accelerat|move .*along|pick up .*pace|wants? speed|patience (?:is )?(?:low|declining)|pushes? for (?:concise|faster)|next decisive clue|ready for decisive)\b/iu;
const ANALYZED_DECELERATE =
  /\b(?:overwhelm|slow(?:er| down)?|too fast|one .*at a time|needs? time|not ready|pause|careful pacing|stepwise support|plain language|confused)\b/iu;

export function detectTutorStubReleasePacingSignal({ learnerText = '', classification = null } = {}) {
  const learner = oneLine(learnerText);
  const analyzed = classificationSignal(classification);
  if (DIRECT_ACCELERATE.test(learner)) {
    return {
      direction: 'accelerate',
      strength: 1,
      source: 'explicit_learner_request',
      reason: 'The learner explicitly asked to move faster.',
    };
  }
  if (DIRECT_DECELERATE.test(learner)) {
    return {
      direction: 'decelerate',
      strength: 1,
      source: 'explicit_learner_request',
      reason: 'The learner explicitly asked for more time or fewer new clues.',
    };
  }
  if (ANALYZED_ACCELERATE.test(analyzed)) {
    return {
      direction: 'accelerate',
      strength: 0.65,
      source: 'learner_analysis',
      reason: 'The public learner analysis indicates impatience or readiness for faster progress.',
    };
  }
  if (ANALYZED_DECELERATE.test(analyzed)) {
    return {
      direction: 'decelerate',
      strength: 0.6,
      source: 'learner_analysis',
      reason: 'The public learner analysis indicates a need for slower, one-step pacing.',
    };
  }
  return {
    direction: 'steady',
    strength: 0,
    source: 'no_current_signal',
    reason: 'No clear request to change the clue pace was detected.',
  };
}

function effectiveSpeed(baseSpeed, tempo) {
  return round(
    clamp(Number(baseSpeed) * (1 + 0.75 * Number(tempo)), MIN_EFFECTIVE_RELEASE_SPEED, MAX_EFFECTIVE_RELEASE_SPEED),
  );
}

function releasedMap(pacing) {
  return pacing?.released && typeof pacing.released === 'object' ? pacing.released : {};
}

function pendingEntries(pacing, world) {
  const released = releasedMap(pacing);
  return releaseEntries(world).filter((entry) => !released[entry.premise]);
}

function replanPendingSchedule(pacing, world, { turn }) {
  const pending = pendingEntries(pacing, world);
  let previousPlannedTurn = Number(turn) - 1;
  let previousAuthoredTurn = null;
  for (const entry of pending) {
    const gap = authoredTurn(entry) - Number(pacing.virtualTurn);
    const rawPlannedTurn =
      gap <= 0 ? Number(turn) : Number(turn) + Math.max(0, Math.ceil(gap / pacing.effectiveSpeed) - 1);
    const sameAuthoredBatch = previousAuthoredTurn !== null && authoredTurn(entry) === previousAuthoredTurn;
    const plannedTurn = Math.max(
      Number(turn),
      sameAuthoredBatch ? previousPlannedTurn : rawPlannedTurn,
      sameAuthoredBatch ? previousPlannedTurn : previousPlannedTurn + 1,
    );
    entry.turn = plannedTurn;
    entry.effectiveTurn = plannedTurn;
    previousPlannedTurn = plannedTurn;
    previousAuthoredTurn = authoredTurn(entry);
  }
  for (const entry of releaseEntries(world)) {
    const released = pacing.released?.[entry.premise];
    if (!released) continue;
    entry.turn = Number(released.turn);
    entry.effectiveTurn = Number(released.turn);
  }
  return pending;
}

function scheduleSnapshot(pacing, world) {
  return releaseEntries(world).map((entry) => ({
    premise: entry.premise,
    via: entry.via || null,
    authoredTurn: authoredTurn(entry),
    effectiveTurn: Number(entry.turn),
    releasedTurn: pacing.released?.[entry.premise]?.turn ?? null,
  }));
}

export function createTutorStubReleasePacingState({ world = null, speed = DEFAULT_TUTOR_STUB_RELEASE_SPEED } = {}) {
  const baseSpeed = normalizeTutorStubReleaseSpeed(speed);
  annotateAuthoredSchedule(world);
  const pacing = {
    schema: TUTOR_STUB_RELEASE_PACING_SCHEMA,
    baseSpeed,
    adaptive: true,
    tempo: 0,
    direction: 'steady',
    effectiveSpeed: baseSpeed,
    virtualTurn: 0,
    lastAdvancedTurn: 0,
    signal: null,
    released: {},
    history: [],
  };
  replanPendingSchedule(pacing, world, { turn: 1 });
  return pacing;
}

export function setTutorStubReleaseSpeed({ pacing, world, speed, turn = 0 } = {}) {
  if (!pacing) return null;
  pacing.baseSpeed = normalizeTutorStubReleaseSpeed(speed);
  pacing.effectiveSpeed = effectiveSpeed(pacing.baseSpeed, pacing.tempo);
  replanPendingSchedule(pacing, world, { turn: Number(turn) });
  return tutorStubReleasePacingSnapshot(pacing, world);
}

export function acknowledgeTutorStubOpeningRelease({ pacing, world } = {}) {
  if (!pacing || !world) return null;
  const openingEntries = releaseEntries(world).filter(
    (entry) => Number(entry.turn) === 1 && !pacing.released?.[entry.premise],
  );
  for (const entry of openingEntries) {
    pacing.released[entry.premise] = {
      turn: 1,
      authoredTurn: authoredTurn(entry),
      via: entry.via || null,
      timing: 'on_authored_turn',
      displayedInOpening: true,
    };
  }
  if (openingEntries.length) pacing.suppressNextClockAdvance = true;
  replanPendingSchedule(pacing, world, { turn: 1 });
  return tutorStubReleasePacingSnapshot(pacing, world);
}

export function advanceTutorStubReleasePacing({
  pacing,
  world,
  turn,
  learnerText = '',
  classification = null,
  tutorLearnerDag = null,
} = {}) {
  if (!pacing || !world || !Number.isFinite(Number(turn))) return null;
  const tutorTurn = Number(turn);
  if (Number(pacing.lastAdvancedTurn) === tutorTurn) return tutorStubReleasePacingSnapshot(pacing, world);
  annotateAuthoredSchedule(world);
  const signal = detectTutorStubReleasePacingSignal({ learnerText, classification });
  if (signal.direction === 'accelerate') pacing.tempo = Math.max(Number(pacing.tempo || 0), signal.strength);
  else if (signal.direction === 'decelerate') pacing.tempo = Math.min(Number(pacing.tempo || 0), -signal.strength);
  else pacing.tempo = round(Number(pacing.tempo || 0) * 0.65);
  pacing.direction = pacing.tempo > 0.2 ? 'accelerate' : pacing.tempo < -0.2 ? 'decelerate' : 'steady';
  pacing.effectiveSpeed = effectiveSpeed(pacing.baseSpeed, pacing.tempo);
  if (pacing.suppressNextClockAdvance) pacing.suppressNextClockAdvance = false;
  else pacing.virtualTurn = round(Number(pacing.virtualTurn || 0) + pacing.effectiveSpeed);

  const pending = pendingEntries(pacing, world);
  const next = pending[0] || null;
  const assessment = tutorLearnerDag?.model?.assessment || tutorLearnerDag?.assessment || {};
  const releaseGap = /release_or_pacing_gap|inference_gap/iu.test(String(assessment.bottleneck || ''));
  const urgentAdvance = Boolean(
    next &&
    signal.direction === 'accelerate' &&
    signal.strength >= 0.65 &&
    (signal.source === 'explicit_learner_request' || releaseGap),
  );
  if (urgentAdvance) pacing.virtualTurn = Math.max(pacing.virtualTurn, authoredTurn(next));

  replanPendingSchedule(pacing, world, { turn: tutorTurn });
  const dueEntries = pendingEntries(pacing, world).filter((entry) => Number(entry.turn) === tutorTurn);
  const dueBatchTurn = dueEntries.length ? authoredTurn(dueEntries[0]) : null;
  const dueNow = dueEntries
    .filter((entry) => dueBatchTurn !== null && authoredTurn(entry) === dueBatchTurn)
    .map((entry) => entry.premise);
  pacing.lastAdvancedTurn = tutorTurn;
  pacing.signal = signal;
  const row = {
    turn: tutorTurn,
    baseSpeed: pacing.baseSpeed,
    effectiveSpeed: pacing.effectiveSpeed,
    virtualTurn: pacing.virtualTurn,
    tempo: pacing.tempo,
    direction: pacing.direction,
    signal,
    urgentAdvance,
    dueNow,
    nextRelease: scheduleSnapshot(pacing, world).find((entry) => entry.releasedTurn === null) || null,
  };
  pacing.history.push(row);
  return tutorStubReleasePacingSnapshot(pacing, world, row);
}

export function commitTutorStubReleasePacing({ pacing, world, turn, deliveredPremises = [] } = {}) {
  if (!pacing || !world || !Number.isFinite(Number(turn))) return null;
  const tutorTurn = Number(turn);
  const delivered = new Set(Array.isArray(deliveredPremises) ? deliveredPremises : []);
  const due = releaseEntries(world).filter(
    (entry) => Number(entry.turn) === tutorTurn && !pacing.released?.[entry.premise],
  );
  const dueBatchTurn = due.length ? authoredTurn(due[0]) : null;
  const dueBatch = due.filter((entry) => dueBatchTurn !== null && authoredTurn(entry) === dueBatchTurn);
  const releaseBatch = dueBatch.filter((entry) => delivered.has(entry.premise));
  const notDelivered = dueBatch.filter((entry) => !delivered.has(entry.premise));
  for (const entry of releaseBatch) {
    pacing.released[entry.premise] = {
      turn: tutorTurn,
      authoredTurn: authoredTurn(entry),
      via: entry.via || null,
      timing: tutorTurn < authoredTurn(entry) ? 'early' : tutorTurn > authoredTurn(entry) ? 'late' : 'on_authored_turn',
    };
  }
  const history = pacing.history.at(-1);
  if (history && Number(history.turn) === tutorTurn) {
    history.releasedNow = releaseBatch.map((entry) => entry.premise);
    history.notDeliveredNow = notDelivered.map((entry) => entry.premise);
  }
  pacing.virtualTurn = Math.max(Number(pacing.virtualTurn || 0), tutorTurn);
  replanPendingSchedule(pacing, world, { turn: tutorTurn + 1 });
  if (history && Number(history.turn) === tutorTurn) {
    history.nextRelease = scheduleSnapshot(pacing, world).find((entry) => entry.releasedTurn === null) || null;
  }
  return tutorStubReleasePacingSnapshot(pacing, world, history || null);
}

export function restoreTutorStubReleasePacingFromTurns({ pacing, world, turns = [] } = {}) {
  if (!pacing || !world) return null;
  const latest = [...turns].reverse().find((turn) => turn?.releasePacing) || null;
  if (latest?.releasePacing) {
    const snapshot = latest.releasePacing;
    pacing.baseSpeed = normalizeTutorStubReleaseSpeed(snapshot.baseSpeed ?? pacing.baseSpeed);
    pacing.tempo = Number(snapshot.tempo || 0);
    pacing.direction = snapshot.direction || 'steady';
    pacing.effectiveSpeed = Number(snapshot.effectiveSpeed || pacing.baseSpeed);
    pacing.virtualTurn = Number(snapshot.virtualTurn || latest.turn || 0);
    pacing.lastAdvancedTurn = Number(latest.turn || snapshot.turn || 0);
    pacing.signal = snapshot.signal || null;
    pacing.released = Object.fromEntries(
      (snapshot.schedule || [])
        .filter(
          (entry) =>
            entry.releasedTurn !== null &&
            entry.releasedTurn !== undefined &&
            Number.isFinite(Number(entry.releasedTurn)),
        )
        .map((entry) => [
          entry.premise,
          {
            turn: Number(entry.releasedTurn),
            authoredTurn: Number(entry.authoredTurn),
            via: entry.via || null,
            timing:
              Number(entry.releasedTurn) < Number(entry.authoredTurn)
                ? 'early'
                : Number(entry.releasedTurn) > Number(entry.authoredTurn)
                  ? 'late'
                  : 'on_authored_turn',
          },
        ]),
    );
    pacing.history = turns.map((turn) => turn.releasePacing).filter(Boolean);
  } else {
    const completedTurns = Number(turns.length || 0);
    pacing.virtualTurn = completedTurns;
    pacing.lastAdvancedTurn = completedTurns;
    pacing.released = Object.fromEntries(
      releaseEntries(world)
        .filter((entry) => authoredTurn(entry) <= completedTurns)
        .map((entry) => [
          entry.premise,
          {
            turn: authoredTurn(entry),
            authoredTurn: authoredTurn(entry),
            via: entry.via || null,
            timing: 'on_authored_turn',
          },
        ]),
    );
  }
  replanPendingSchedule(pacing, world, { turn: Number(turns.length || 0) + 1 });
  return tutorStubReleasePacingSnapshot(pacing, world);
}

export function tutorStubReleasePacingSnapshot(pacing, world, current = null) {
  if (!pacing) return null;
  const schedule = scheduleSnapshot(pacing, world);
  const released = Object.values(releasedMap(pacing));
  return {
    schema: TUTOR_STUB_RELEASE_PACING_SCHEMA,
    turn: current?.turn ?? pacing.lastAdvancedTurn,
    baseSpeed: pacing.baseSpeed,
    adaptive: pacing.adaptive !== false,
    effectiveSpeed: pacing.effectiveSpeed,
    tempo: pacing.tempo,
    direction: pacing.direction,
    virtualTurn: pacing.virtualTurn,
    signal: current?.signal || pacing.signal || null,
    urgentAdvance: Boolean(current?.urgentAdvance),
    dueNow: [...(current?.dueNow || [])],
    releasedNow: [...(current?.releasedNow || [])],
    notDeliveredNow: [...(current?.notDeliveredNow || [])],
    nextRelease: current?.nextRelease || schedule.find((entry) => entry.releasedTurn === null) || null,
    counts: {
      released: released.length,
      early: released.filter((entry) => entry.timing === 'early').length,
      late: released.filter((entry) => entry.timing === 'late').length,
      onAuthoredTurn: released.filter((entry) => entry.timing === 'on_authored_turn').length,
      accelerationSignals: (pacing.history || []).filter((entry) => entry.signal?.direction === 'accelerate').length,
      decelerationSignals: (pacing.history || []).filter((entry) => entry.signal?.direction === 'decelerate').length,
    },
    schedule,
  };
}
