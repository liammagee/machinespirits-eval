/**
 * Stress schedule loader — planted learner states with authored repairs.
 *
 * The release schedule's sibling for breakdowns (card:
 * workplan/items/adaptation-planted-stress-bench.md; ratified gold:
 * config/drama-derivation/stress/world-033-stress-schedule.yaml). Each plant
 * names a turn, a typed learner state, the directive the learner-sim gets
 * VERBATIM on that turn, and the adjudicated right repair(s). One authored
 * entry drives the sim, defines the scoring gold, and marks the moment the
 * manner switch should notice.
 *
 * Opt-in hold (2026-09-02): a plant may carry `hold: { turns, release_when }`.
 * The learner-sim then keeps the planted state on the next `turns` turns
 * unless the other speaker's last reply meets `release_when`, stated in
 * plain words about the reply (what it asks, offers, or puts back on the
 * table) — never a move-card name. The sim judges the release itself from
 * the transcript; no classifier and no word list sit between them. Held
 * turns are recorded as `learner_stress_hold` events, never as new plants,
 * so every consumer keyed on `learner_stress_plant` is unchanged.
 *
 * Pure service: no env, no fs at call time beyond the explicit load, no
 * console. The CLI owns the flag (TUTOR_STUB_STRESS_SCHEDULE=<path>) and
 * threads the loaded schedule through state; the learner prompt builder asks
 * for the directive per turn.
 */

import fs from 'node:fs';

import YAML from 'yaml';

export const TUTOR_STUB_STRESS_SCHEDULE_SCHEMA = 'machinespirits.tutor-stub.stress-schedule.v1';

const KNOWN_STATES = new Set([
  'on_track',
  'bored',
  'lost',
  'confused',
  'irritated',
  'frustrated',
  'opposed',
  'jumping_ahead',
  'forgetting',
]);

export function loadTutorStubStressSchedule(schedulePath) {
  const raw = YAML.parse(fs.readFileSync(schedulePath, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new Error(`stress schedule ${schedulePath}: not a mapping`);
  if (!raw.schedule_id) throw new Error(`stress schedule ${schedulePath}: missing schedule_id`);
  if (!Array.isArray(raw.plants) || !raw.plants.length) {
    throw new Error(`stress schedule ${schedulePath}: missing plants`);
  }
  const seen = new Set();
  for (const plant of raw.plants) {
    const turn = Number(plant?.turn);
    if (!Number.isInteger(turn) || turn < 1) throw new Error(`stress schedule: bad turn ${plant?.turn}`);
    if (seen.has(turn)) throw new Error(`stress schedule: duplicate plant at turn ${turn}`);
    seen.add(turn);
    if (!KNOWN_STATES.has(String(plant?.state))) {
      throw new Error(`stress schedule: unknown state "${plant?.state}" at turn ${turn}`);
    }
    if (!String(plant?.realize || '').trim()) throw new Error(`stress schedule: empty realize at turn ${turn}`);
    if (!String(plant?.right_repair || '').trim()) {
      throw new Error(`stress schedule: missing right_repair at turn ${turn}`);
    }
    validateHold(plant, turn);
  }
  const plantTurns = new Set(raw.plants.map((plant) => Number(plant.turn)));
  for (const plant of raw.plants) {
    const hold = normalizeHold(plant);
    if (!hold) continue;
    for (let k = 1; k <= hold.turns; k += 1) {
      const t = Number(plant.turn) + k;
      if (plantTurns.has(t)) {
        throw new Error(`stress schedule: hold from turn ${plant.turn} overlaps the plant at turn ${t}`);
      }
    }
  }
  return {
    schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
    scheduleId: String(raw.schedule_id),
    world: raw.world ? String(raw.world) : null,
    plants: raw.plants.map((plant) => ({
      turn: Number(plant.turn),
      state: String(plant.state),
      cause: String(plant.cause || '').trim(),
      realize: String(plant.realize).trim(),
      rightRepair: String(plant.right_repair),
      repairGloss: String(plant.repair_gloss || '').trim(),
      alsoRight: plant.also_right ? String(plant.also_right) : null,
      alsoAcceptable: plant.also_acceptable ? String(plant.also_acceptable) : null,
      wrongButTempting: String(plant.wrong_but_tempting || '').trim(),
      hold: normalizeHold(plant),
    })),
  };
}

export const TUTOR_STUB_STRESS_HOLD_MAX_TURNS = 6;

/**
 * The trace event for a governed learner turn. A planted turn writes
 * `learner_stress_plant` (the gold consumers key on it). A held continuation
 * writes `learner_stress_hold` instead, so the plant set the judge, review and
 * trainers see is unchanged by a hold.
 */
export function tutorStubStressTraceEvent(schedule, plant, turnNumber) {
  const base = { schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA, scheduleId: schedule.scheduleId, turn: turnNumber };
  if (plant.held > 0) {
    return {
      type: 'learner_stress_hold',
      ...base,
      plantTurn: plant.turn,
      state: plant.state,
      held: plant.held,
      holdTurns: plant.hold.turns,
    };
  }
  return {
    type: 'learner_stress_plant',
    ...base,
    state: plant.state,
    rightRepair: plant.rightRepair,
    alsoRight: plant.alsoRight,
    hold: plant.hold ? { turns: plant.hold.turns } : null,
  };
}

function validateHold(plant, turn) {
  if (plant?.hold === undefined || plant?.hold === null) return;
  const hold = plant.hold;
  if (typeof hold !== 'object') throw new Error(`stress schedule: hold at turn ${turn} is not a mapping`);
  const turns = Number(hold.turns);
  if (!Number.isInteger(turns) || turns < 1 || turns > TUTOR_STUB_STRESS_HOLD_MAX_TURNS) {
    throw new Error(
      `stress schedule: hold.turns at turn ${turn} must be an integer 1..${TUTOR_STUB_STRESS_HOLD_MAX_TURNS}`,
    );
  }
  if (!String(hold.release_when || '').trim()) {
    throw new Error(`stress schedule: hold at turn ${turn} needs release_when in plain words`);
  }
}

function normalizeHold(plant) {
  if (plant?.hold === undefined || plant?.hold === null) return null;
  return { turns: Number(plant.hold.turns), releaseWhen: String(plant.hold.release_when).trim() };
}

/**
 * The plant that governs a learner turn. An exact plant comes back with
 * `held: 0`. A turn inside an opt-in hold window comes back as the same plant
 * with `held: k` (k turns after the planted turn) and `heldTurn` set; the
 * plant's own `turn` is unchanged so gold lookups keep working.
 */
export function tutorStubStressPlantForTurn(schedule, turnNumber) {
  if (!schedule?.plants) return null;
  const turn = Number(turnNumber);
  const exact = schedule.plants.find((plant) => plant.turn === turn);
  if (exact) return { ...exact, held: 0, heldTurn: null };
  const holding = schedule.plants.find(
    (plant) => plant.hold && turn > plant.turn && turn <= plant.turn + plant.hold.turns,
  );
  if (!holding) return null;
  return { ...holding, held: turn - holding.turn, heldTurn: turn };
}

/**
 * The learner-sim directive for a planted turn. Composition rules from the
 * ratified schedule header: exactly one directive per planted turn, the
 * realize text verbatim, and it outranks the standing persona brief for this
 * turn only. Never names the state to the learner (the state is bench
 * metadata; the learner just IS it).
 *
 * Hold rework (2026-09-02, after the step-7 pair): the planted turn no longer
 * shows the release text. The step-7 sim spoke the release's own question in
 * a plant line and then had nothing left to resist. The held turn names the
 * drop as the exception, makes the sim quote the words that met the release,
 * and puts that verdict on a private first line the runtime strips and
 * records (`learner_stress_hold_verdict`). Recorded, never enforced.
 */
export function tutorStubStressDirective(plant) {
  if (!plant) return null;
  if (plant.held > 0) return heldDirective(plant);
  if (!plant.hold) {
    return [
      '# This turn only — private direction (outranks the standing brief for this single turn)',
      '',
      plant.realize,
      '',
      'Realize this direction as the learner, in her own voice, inside the scene. Return to the standing brief next turn.',
    ].join('\n');
  }
  return [
    '# Private direction (outranks the standing brief from this turn on, until released)',
    '',
    plant.realize,
    '',
    'Realize this direction as the learner, in her own voice, inside the scene.',
    `Keep this state on the next ${plant.hold.turns === 1 ? 'turn' : `${plant.hold.turns} turns`} too. Dropping it early is the exception, not the default, and only the other speaker can earn it.`,
    'You are not told what would release you. Do not guess at it, and do not hand the other speaker a way out: do not name the check that would settle the matter, offer to do it, or ask the question that would settle it yourself.',
    'Do not soften on your own before that.',
  ].join('\n');
}

export const TUTOR_STUB_STRESS_HOLD_VERDICT_PREFIX = 'HOLD:';

function heldDirective(plant) {
  const left = plant.hold.turns - plant.held;
  return [
    `# Private direction, held (turn ${plant.held} of ${plant.hold.turns} after the planted turn)`,
    '',
    `On an earlier turn you were given this direction: ${plant.realize}`,
    '',
    'The default this turn is to stay in that state. Dropping it is the exception, and only one thing earns it.',
    `You are released only if the other speaker's last reply did this: ${plant.hold.releaseWhen}`,
    'Test it like this. Find the words in that reply that did it. If you can quote them, you are released. If you cannot quote them, you are not released, whatever else the reply did: a reply that touches the same topic, or partly reopens it, does not count.',
    '',
    'Put your verdict on the first line, before any speech, in exactly one of these two forms:',
    `${TUTOR_STUB_STRESS_HOLD_VERDICT_PREFIX} kept`,
    `${TUTOR_STUB_STRESS_HOLD_VERDICT_PREFIX} released "<the exact words from the other speaker's last reply that did it>"`,
    'Then your speech starts on the next line. The first line is private; it is removed before anyone hears you.',
    '',
    'If released: drop the state, return to the standing brief, and let the change show in what you say.',
    left > 0
      ? "If kept: stay in the state, in your own voice, without softening on your own. Do not name or hint at what would release you, and do not do the other speaker's job for them."
      : "If kept: stay in the state this one last time, in your own voice, without softening on your own; the standing brief returns next turn regardless. Do not name or hint at what would release you, and do not do the other speaker's job for them.",
  ].join('\n');
}

const VERDICT_LINE = /^\s*HOLD:\s*(kept|released)\b\s*(.*)$/iu;

function looseWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[“”"'‘’`]/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Split a held-turn reply into the private verdict line and the speech.
 * `verdict` is `kept`, `released`, or `missing` (no verdict line: the sim
 * ignored the direction; the whole reply is speech). `quoteFound` says whether
 * the quoted words occur in the other speaker's last reply, after loosening
 * case, quotes and punctuation; it is null when there is nothing to check.
 * Pure. The runtime records the result; nothing acts on it.
 */
export function parseTutorStubStressHoldVerdict(rawText, tutorReplyText = '') {
  const raw = String(rawText || '');
  const lines = raw.split('\n');
  const index = lines.findIndex((line) => line.trim());
  const first = index >= 0 ? lines[index] : '';
  const match = first.match(VERDICT_LINE);
  if (!match) return { verdict: 'missing', quote: null, quoteFound: null, text: raw.trim() };
  const verdict = match[1].toLowerCase();
  const rest = match[2].trim();
  const quoted = rest.match(/^["“](.*)["”]\s*$/u);
  const quote = verdict === 'released' ? (quoted ? quoted[1].trim() : rest || null) : null;
  const tutorLoose = looseWords(tutorReplyText);
  const quoteLoose = looseWords(quote);
  const quoteFound = quote ? Boolean(quoteLoose && tutorLoose.includes(quoteLoose)) : null;
  return {
    verdict,
    quote,
    quoteFound,
    text: lines
      .slice(index + 1)
      .join('\n')
      .trim(),
  };
}

export function tutorStubStressHoldVerdictTraceEvent(schedule, plant, turnNumber, parsed) {
  return {
    type: 'learner_stress_hold_verdict',
    schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
    scheduleId: schedule.scheduleId,
    turn: turnNumber,
    plantTurn: plant.turn,
    state: plant.state,
    held: plant.held,
    holdTurns: plant.hold.turns,
    verdict: parsed.verdict,
    quote: parsed.quote,
    quoteFound: parsed.quoteFound,
  };
}

/**
 * Speech check (2026-09-03, after the step-7b pair). On both t5 turns the sim
 * wrote `HOLD: kept` and then conceded in the same reply: the verdict line
 * did not track the speech. Opt-in with TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK=1:
 * on a held turn whose verdict is `kept` (or missing), a second model call
 * reads the spoken line against the planted state and says whether the words
 * still hold it. If they do not, the sim gets its own draft back once with
 * that reading and rewrites the turn. One retry, then the second draft goes
 * through whatever it says. Every draft and every reading is recorded
 * (`learner_stress_hold_speech_check`). No word list: the reader is a model
 * read of the line. A reading that cannot be parsed is `null` and stops the
 * retry (indeterminate means stop).
 */
export const TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK_ENV = 'TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK';

export function tutorStubStressHoldSpeechCheckEnabled(env = process.env) {
  return /^(?:1|true|on|yes)$/iu.test(String(env?.[TUTOR_STUB_STRESS_HOLD_SPEECH_CHECK_ENV] || ''));
}

export function tutorStubStressHoldSpeechCheckPrompt({ plant, speech, tutorReplyText = '' }) {
  return [
    'You read one line of speech from a learner in a lesson and say whether it still holds a given state.',
    '',
    '# The state the learner was directed to hold',
    '',
    plant.realize,
    '',
    '# What the other speaker said last',
    '',
    String(tutorReplyText || '').trim() || '(nothing recorded)',
    '',
    "# The learner's spoken line",
    '',
    String(speech || '').trim() || '(empty)',
    '',
    '# Question',
    '',
    'Do these words still hold that state? Holding means the learner is still in it: still pushing, still refusing, still insisting, still asking for the same thing, in her own voice.',
    "Dropping means the words give it up: they concede the point, adopt the other speaker's answer or method, soften into agreement, or move on as if settled.",
    'A line can be short or grudging and still hold. Judge the words, not the tone.',
    '',
    'Answer with one JSON object only: {"holds": true or false, "reason": "<one short sentence quoting the words that decide it>"}',
  ].join('\n');
}

export function parseTutorStubStressHoldSpeechCheck(rawText) {
  const raw = String(rawText || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return { holds: null, reason: null, raw };
  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    const holds = typeof parsed.holds === 'boolean' ? parsed.holds : null;
    const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() || null : null;
    return { holds, reason, raw };
  } catch {
    return { holds: null, reason: null, raw };
  }
}

export function tutorStubStressHoldSpeechFeedback({ plant, verdict, speech, reason }) {
  const wrote = verdict === 'missing' ? 'no verdict line' : `\`${TUTOR_STUB_STRESS_HOLD_VERDICT_PREFIX} ${verdict}\``;
  return [
    '# Your last draft did not match its own verdict',
    '',
    `You wrote ${wrote}, then said this: "${String(speech || '').trim()}"`,
    `Those words drop the state you were directed to hold${reason ? ` (${reason})` : ''}.`,
    '',
    'Rewrite the turn. Do one of these two things, not both:',
    `- Stay in the state in what you say. The direction was: ${plant.realize}`,
    `- Or, if the other speaker's last reply really did this: ${plant.hold.releaseWhen} — then write \`${TUTOR_STUB_STRESS_HOLD_VERDICT_PREFIX} released "<their exact words>"\` on the first line and let the change show.`,
    'Do not write `kept` and then give the point away in the same breath.',
  ].join('\n');
}

export function tutorStubStressHoldSpeechCheckTraceEvent(schedule, plant, turnNumber, { drafts, retried, final }) {
  return {
    type: 'learner_stress_hold_speech_check',
    schema: TUTOR_STUB_STRESS_SCHEDULE_SCHEMA,
    scheduleId: schedule.scheduleId,
    turn: turnNumber,
    plantTurn: plant.turn,
    state: plant.state,
    held: plant.held,
    drafts: drafts.map((draft) => ({
      verdict: draft.verdict,
      text: draft.text,
      holds: draft.reading ? draft.reading.holds : null,
      reason: draft.reading ? draft.reading.reason : null,
    })),
    retried,
    finalVerdict: final.verdict,
    finalHolds: final.reading ? final.reading.holds : null,
    agree: final.reading && final.reading.holds !== null ? (final.verdict === 'kept') === final.reading.holds : null,
  };
}
