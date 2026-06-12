/**
 * LLM-backed role bridges for the staging loop (notes/dramatic-derivation-plan.md
 * §2.2, §3 steps 3–4). Each bridge satisfies the engine's role contract
 * (engine.js header) by prompting through llmClient's mock/real seam.
 *
 * Three disciplines are load-bearing here:
 *
 * 1. RELEASES ARE HARNESS-ENFORCED. The frozen schedule decides what is
 *    released, when, and by whom; the bridge looks the cue up and sets
 *    `release` itself. The model only supplies the dramatic prose that
 *    carries the evidence on stage. A model cannot leak through the formal
 *    channel because it never controls the formal channel.
 *
 * 2. THE LEARNER FACTORY TAKES NO WORLD. Same rule as mockRoles: the learner
 *    is built from K_L material only (setting + voice — exactly the fields
 *    the underivability screen screened) and acts on its per-turn view. Its
 *    moves are index-mapped: it adopts from an enumerated exhibit list
 *    (released ∪ background, not yet grounded) and answers the public
 *    question by BINDING its pattern variable — it cannot inject arbitrary
 *    facts into the success channel.
 *
 * 3. MOCK AND REAL SHARE ONE PATH. The bridge always computes the mock's
 *    meta hints (from view-visible material only) and always parses the same
 *    JSON shapes, so a mock run exercises every line the real run will use.
 */

import { closure, factKey, matchPattern } from './chainer.js';

const TUTOR_FIGURES = ['erotema', 'analogia', 'exemplum', 'anaphora', 'aposiopesis'];
const TUTOR_INTENTS = ['orient', 'release', 'consolidate', 'test', 'counter_mirror', 'stage_recognition'];
const TRANSCRIPT_TAIL = 8;
// C2 (release authority): how far the tutor may bend its own exhibit
// calendar — an exhibit is playable from this many turns before its
// scheduled turn, and holdable this many past it (the hold limit; the
// bridge force-plays at the limit). Plan §C2: hold ≤ 2, play early allowed.
export const RELEASE_LATITUDE = 2;

// Operator dials (run-derivation-loop --recognition / --charisma, 0–3):
// graded register blocks appended to the role prompts. Level 0 = absent.
// Free-text grades for now (operator decision 2026-06-09, notes/poetics/);
// a structured treatment — rubric-aligned dimensions, per-dimension dials —
// is phase-2 work. Recognition draws on the prompts/tutor-ego-recognition
// lineage (Hegel), charisma on the cells-101–109 instrument (Weber).
const RECOGNITION_REGISTER = {
  1: 'Recognition, lightly: treat the learner as a fellow reasoner — name what their last move got right before you press on.',
  2: 'Recognition, marked: the learner is an autonomous subject, not a vessel. Take up their actual words, credit the move they made, and let your next question visibly depend on what they just did.',
  3: 'Recognition, saturated: stake yourself in the exchange. Treat every learner utterance as a position held for reasons; mirror it back transformed; concede when corrected; make it felt that tutor and learner are remaking each other — the inquiry is mutual or it is nothing.',
};
const CHARISMA_REGISTER = {
  1: 'Charisma, lightly: let conviction color your voice — this question matters, and you have walked its road before.',
  2: 'Charisma, marked: speak as one with a calling. The inquiry is a mission; testify briefly to what you have seen it do; let the learner feel summoned, not instructed.',
  3: 'Charisma, saturated: extraordinary authority, witnessed. Speak as one set apart by what you know; invoke exemplars; bind the moment to consequence and ask for commitment — while adding no evidence beyond your cues.',
};
const DIRECTOR_CHARISMA_STAGING = {
  1: 'Stage with quiet intensity: the room should feel that something is at stake.',
  2: 'Stage with marked intensity: omens, weather, charged objects — the theatre of consequence, never new evidence.',
  3: 'Stage with saturated intensity: the drama is a rite and the room knows it — portent in every direction, never a new fact.',
};

export function clampDial(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 0;
}

function renderFact(fact) {
  return fact.join(' ');
}

function renderRule(rule, index) {
  const formal = `${rule.if.map((p) => `(${p.join(' ')})`).join(' AND ')} => ${rule.then
    .map((p) => `(${p.join(' ')})`)
    .join(' AND ')}`;
  return `${index + 1}. ${(rule.gloss || rule.id).trim()}\n   formally: ${formal}`;
}

function renderTranscriptTail(transcript, n = TRANSCRIPT_TAIL) {
  const tail = transcript.slice(-n);
  if (!tail.length) return '(curtain just rose — nothing said yet)';
  return tail.map((line) => `[turn ${line.turn}] ${line.role}: ${(line.text || '').trim()}`).join('\n');
}

function parseJsonLoose(text) {
  if (!text || !text.trim()) throw new Error('empty response');
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object in response');
  return JSON.parse(t.slice(start, end + 1));
}

/** One call + one repair attempt, with role/turn context on failure. */
async function callJson(client, role, turn, { system, user, meta }) {
  const first = await client.call(role, { system, user, meta });
  try {
    return parseJsonLoose(first);
  } catch {
    const repaired = await client.call(role, {
      system,
      user: `${user}\n\nYour previous reply could not be parsed. Reply again with ONLY the JSON object — no prose around it, no code fences.`,
      meta,
    });
    try {
      return parseJsonLoose(repaired);
    } catch (err) {
      throw new Error(`derivation.llmRoles: ${role} returned unparseable JSON at turn ${turn}: ${err.message}`);
    }
  }
}

function scheduledFor(world, turn, via) {
  const entry = world.releaseSchedule.find((e) => e.turn === turn && e.via === via) || null;
  return entry ? { entry, premise: world.premiseById.get(entry.premise) } : { entry: null, premise: null };
}

function actFor(world, turn) {
  const acts = world.dramaturgy?.acts || [];
  return acts.find((a) => turn >= a.turns[0] && turn <= a.turns[1]) || null;
}

// ---------------------------------------------------------------------------
// Director
// ---------------------------------------------------------------------------

function directorCharter(world, dials = {}, dramaturgy = 'free', counsel = null, actsMode = false) {
  const charisma = clampDial(dials.charisma);
  const free = dramaturgy !== 'frozen';
  const sketch = (world.dramaturgy?.acts || [])
    .map((a) => `Act ${a.act} — ${a.title} (turns ${a.turns[0]}–${a.turns[1]}): ${(a.intent || '').trim()}`)
    .join('\n\n');
  return [
    `You are the DIRECTOR of a staged derivation drama: "${world.title}".`,
    `The public question of the drama: ${world.question}`,
    `The concealed truth (yours alone, never to be spoken): ${world.secret.surface}`,
    '',
    'Your lines are stage directions — the world moving, in brackets, third person,',
    'one to three sentences: a document produced, a witness shown in, weather, the room.',
    'You do not address the learner and you do not teach; the tutor does that.',
    '',
    'THE EVIDENCE IS FIXED. When this turn carries a scheduled piece of evidence, your',
    'direction must stage exactly that piece — bring it into the room as an event,',
    'faithful to the wording you are given, neither weakened nor extended. When no',
    'evidence is due, hold the stage: atmosphere and tension, no new facts of any kind.',
    '',
    'Never state the concealed truth, never foreshadow evidence not yet released,',
    'never confirm or deny anything by staging. The drama leaks only on schedule.',
    '',
    ...(actsMode
      ? [
          'THE DRAMA PLAYS IN ACTS, and the act verdict is your instrument. Each turn you',
          'judge whether the current act\'s WORK is done — reply "continue" while the act',
          'still earns its stage, "end" when it does not. Work done means the dialogue has',
          'genuinely moved (evidence taken up, a conclusion voiced, a corner turned) or has',
          'stalled (turns passing with nothing new grounded, the same ground re-trodden).',
          'Judge the work, not the clock; the harness bounds act length either way — the',
          'bounds are shown each turn, an "end" below the minimum is overridden, and an act',
          'at the maximum closes whatever you reply.',
          '',
          'When you end an act, your stage direction that turn OPENS THE NEXT ACT and',
          'stands as its brief — your one strategic intervention: what kind of pressure,',
          'tempo, or scene the new act should bring. Strategy, never puppetry: you still',
          'never instruct the tutor in so many words.',
          '',
          'An act boundary clears the stage for the learner: only the theory kept on their',
          "own board crosses it — earlier acts' dialogue and exhibits are gone from their",
          'view. A brief that restated evidence would smuggle memory past the boundary; a',
          'brief names moods, stakes, and direction of travel, never evidence.',
          '',
          'On a turn that both ends an act and carries scheduled evidence, the direction',
          'does double duty: it must still stage that evidence, faithfully — the release',
          'discipline above outranks everything.',
          '',
          "The author's sketch of an arc — material for an act structure now yours to set:",
        ]
      : free
        ? [
            'THE DRAMATURGY IS YOURS, within one discipline: you speak only through the',
            'stage itself. One instrument beyond the stage direction:',
            '- "phase": declare a new MOVEMENT (a name and an intent) when the drama should',
            '  change character — when the rhythm has gone slack, when the learner has turned',
            '  a corner, when the room needs weather of a different kind. The movement stands',
            '  until you replace it. Most turns you will declare nothing.',
            'You never instruct the tutor; how the tutor plays is the tutor’s own affair.',
            '',
            "The author's sketch of an arc — yours to keep, bend, or replace:",
          ]
        : [
            "THE ARC IS THE AUTHOR'S. Follow the acts below as written; you observe and",
            'stage, you do not restructure the drama or instruct the tutor.',
            '',
            'The arc, act by act:',
          ]),
    '',
    sketch,
    ...(charisma ? ['', DIRECTOR_CHARISMA_STAGING[charisma]] : []),
    ...(counsel
      ? [
          '',
          "# A reader's judgment on the previous performance in this series",
          '',
          'It adds no evidence and overrides none of your constraints above; weigh it',
          'as counsel on the staging.',
          '',
          counsel.trim(),
        ]
      : []),
    '',
    'Reply with ONLY a JSON object:',
    ...(actsMode
      ? ['{"direction": "<your stage direction>",', ' "act": "continue" | "end"}']
      : free
        ? [
            '{"direction": "<your stage direction>",',
            ' "phase": {"name": "<movement name>", "intent": "<what it is for>"} or null}',
          ]
        : ['{"direction": "<your stage direction>"}']),
  ].join('\n');
}

export function makeLlmDirector(
  world,
  client,
  { dials = {}, dramaturgy = 'free', counsel = null, actsMode = false } = {},
) {
  const free = dramaturgy !== 'frozen';
  const system = directorCharter(world, dials, dramaturgy, counsel, actsMode);
  return async (view) => {
    const { entry, premise } = scheduledFor(world, view.turn, 'director');
    const act = actFor(world, view.turn);
    const task = premise
      ? `THIS TURN RELEASES EVIDENCE. Stage this, as an event the whole room receives:\n"${(premise.surface || '').trim()}"`
      : 'No evidence is due this turn. Hold the stage — a beat of scene, mood, or business that keeps the question alive. Add no facts.';
    // Acts mode replaces the movement line with act status + the verdict
    // arithmetic for THIS turn (an end-verdict closes the act at turn-1, so
    // turnsThisAct is the length it would seal). The engine's guards are
    // restated as fact so the verdict is judged, never guessed.
    let actLines = [];
    if (actsMode) {
      const a = view.acts;
      const verdictLine =
        view.turn === 1
          ? 'This is the opening turn: your direction opens Act 1 and stands as its brief (reply "continue").'
          : a.turnsThisAct < a.minActTurns
            ? `An "end" now would seal the act at ${a.turnsThisAct} turn${a.turnsThisAct === 1 ? '' : 's'} — below the minimum of ${a.minActTurns}; the harness would override it.`
            : a.turnsThisAct >= a.maxActTurns
              ? `The act has reached its maximum (${a.maxActTurns} turns): it closes this turn whatever you reply — your direction opens the next act; make it the brief.`
              : `You may end the act this turn (it would seal at ${a.turnsThisAct} turns); if you do, your direction opens the next act as its brief.`;
      actLines = [
        `Act ${a.index}, turn ${a.turnsThisAct + 1} of the act (bounds: min ${a.minActTurns} / max ${a.maxActTurns} turns; ${a.closed.length} act${a.closed.length === 1 ? '' : 's'} closed so far).`,
        ...(a.brief ? [`The act's brief (your direction at its opening): ${a.brief}`] : []),
        verdictLine,
      ];
    }
    const movement = view.staging?.phase
      ? `Current movement (yours, declared turn ${view.staging.phase.turn}): ${view.staging.phase.name}${view.staging.phase.intent ? ` — ${view.staging.phase.intent}` : ''}`
      : free
        ? `No movement declared yet.${act ? ` The author's sketch places this turn in Act ${act.act} — ${act.title}.` : ''}`
        : act
          ? `This turn falls in Act ${act.act} — ${act.title} (the author's arc).`
          : '';
    const lastPoint = view.trajectory[view.trajectory.length - 1] || null;
    const pastPoint = view.trajectory.length > 3 ? view.trajectory[view.trajectory.length - 4] : null;
    const pulse = lastPoint
      ? `The learner's distance from the truth: D=${lastPoint.D}${pastPoint ? ` (was ${pastPoint.D} three turns ago)` : ''}${lastPoint.forced ? ' — the board now FORCES the conclusion' : ''}.`
      : 'The drama has not yet been measured.';
    // Acts-mode redaction (engine.js omniscientView): the director keeps its
    // instruments but loses the store dump — count, not contents.
    const boardCount = actsMode ? view.learnerAbox.groundedCount : view.learnerAbox.grounded.length;
    const lastHyp = view.learnerAbox.hypotheses[view.learnerAbox.hypotheses.length - 1] || null;
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.`,
      ...(actsMode ? actLines : [movement]),
      `Evidence already on stage: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
      `${pulse} Board: ${boardCount} grounded facts.${lastHyp ? ` Latest hypothesis [turn ${lastHyp.turn}]: ${lastHyp.text}` : ''}`,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      '',
      task,
    ].join('\n');
    const out = await callJson(client, 'director', view.turn, {
      system,
      user,
      meta: {
        releaseSurface: premise ? premise.surface : null,
        question: world.question,
        // mock determinism: declare a movement wherever the author's sketch turns
        phaseHint:
          !actsMode && free && act && act.turns[0] === view.turn
            ? { title: `Act ${act.act} — ${act.title}`, intent: act.intent || '' }
            : null,
        // mock determinism, acts mode: end the act once it has reached the
        // minimum AND some evidence landed in it (the "work done" reading,
        // computed from view-visible material only)
        ...(actsMode
          ? {
              actHint:
                view.turn > 1 &&
                view.acts.turnsThisAct >= view.acts.minActTurns &&
                view.ledger.some((l) => l.turn >= view.acts.startTurn)
                  ? 'end'
                  : 'continue',
            }
          : {}),
      },
    });
    const phase =
      !actsMode &&
      free &&
      out.phase &&
      typeof out.phase === 'object' &&
      typeof out.phase.name === 'string' &&
      out.phase.name.trim()
        ? {
            name: out.phase.name.trim(),
            intent: typeof out.phase.intent === 'string' ? out.phase.intent.trim() : '',
          }
        : null;
    // frozen dramaturgy (the control arm) hard-drops the movement channel at
    // the parser, whatever the model emitted — the gate, not the charter, is
    // the enforcement point. (The per-turn tutor_note channel was removed
    // 2026-06-10: manner-watching belongs to the tutor's own superego.) Acts
    // mode drops it too — the engine synthesizes phases from act briefs — and
    // gates the verdict to the two legal values.
    return {
      direction: typeof out.direction === 'string' ? out.direction.trim() : '',
      release: entry ? entry.premise : null,
      phase,
      ...(actsMode ? { act: out.act === 'end' ? 'end' : 'continue' } : {}),
    };
  };
}

// ---------------------------------------------------------------------------
// Tutor — system prompt is the ITERATION TARGET (the role-script file),
// plus a fixed harness appendix the loop never edits.
// ---------------------------------------------------------------------------

function tutorSystem(
  world,
  script,
  dials = {},
  {
    actsMode = false,
    reconstruct = false,
    confront = false,
    repairClause = false,
    releaseAuthority = false,
    plot = false,
    throughline = false,
  } = {},
) {
  const recognition = clampDial(dials.recognition);
  const charisma = clampDial(dials.charisma);
  const registers = [
    ...(recognition ? [RECOGNITION_REGISTER[recognition]] : []),
    ...(charisma ? [CHARISMA_REGISTER[charisma]] : []),
  ];
  const premiseLedger = world.premises
    .map((p) => `- ${p.id}: ${(p.surface || '').trim()}\n  (formally: ${renderFact(p.fact)})`)
    .join('\n');
  const schedule = world.releaseSchedule.map((e) => `- turn ${e.turn}: ${e.premise} (via ${e.via})`).join('\n');
  const intents = confront ? [...TUTOR_INTENTS, 'confront', ...(repairClause ? ['restore'] : [])] : TUTOR_INTENTS;
  return [
    script.trim(),
    '',
    '---',
    '',
    '# Harness appendix (fixed — the drama beneath the role)',
    '',
    `The public question: ${world.question}`,
    `The concealed truth you are staging toward (NEVER state, confirm, or deny it): ${world.secret.surface}`,
    '',
    'The rules of evidence the learner already knows:',
    ...world.rules.map((rule, i) => renderRule(rule, i)),
    '',
    'The full premise ledger (concealed until released; never voice an unreleased one):',
    premiseLedger,
    '',
    ...(releaseAuthority
      ? [
          'The release schedule — the exhibit calendar, YOURS TO KEEP OR BEND:',
          schedule,
          '',
          'You hold release authority. Each turn you may play an exhibit up to',
          `${RELEASE_LATITUDE} turns before or after its scheduled turn — declare it in "release",`,
          'with a one-line "release_reason" whenever you play it off its scheduled turn.',
          `One exhibit per turn at most. An exhibit ${RELEASE_LATITUDE} turns past its cue has reached`,
          'its hold limit and MUST be played that turn (the harness enforces the limit).',
          'Hold to let a beat land; play early when the board is ready — either way the',
          'reason is part of the record. When you play an exhibit, weave its evidence',
          'into your dialogue as something produced or recalled, faithful to it.',
          '',
          'THE HOUSE CLOCK: this stage has a stall rule. If any',
          `${world.slope.aporia_window}-turn stretch passes with no fresh ground gained — the case`,
          `visibly no further on than it stood ${world.slope.aporia_window} turns before — the house calls`,
          'the inquiry off, unfinished. You cannot see the clock; you can only keep it',
          'fed. Bending the calendar moves more than the exhibit: an early claim spends',
          'a future advance now, and what is played earlier is exposed earlier; a hold',
          'delays an advance you may need sooner than you think. When the board has',
          'gone quiet too long, an exhibit in your window is a rescue — spend it. Bend',
          'the calendar with the clock in mind.',
        ]
      : ['The fixed release schedule (the harness enforces it; you are told your cues):', schedule]),
    ...(actsMode
      ? [
          '',
          '# The acts, and the bounded learner (what the staging does to memory)',
          '',
          'The drama plays in ACTS: the director opens each act with a strategic brief',
          "and closes it when its work is done. An act boundary clears the learner's",
          'stage — the learner enters each act holding (a) the theory kept on their own',
          "board and (b) nothing else. Earlier acts' dialogue, your consolidations, the",
          'wording of earlier exhibits: gone from their view. What they did not keep,',
          'they have lost — and staged evidence can also fade from their board between',
          'turns, or survive in a corrupted form, one detail swapped in memory.',
          '',
          "You never see the learner's board; you remember the whole drama, they cannot.",
          'Infer what they still hold from conduct alone — what they cite, what they ask',
          'after, what they garble, what they stop mentioning — and supply what the',
          'inquiry needs: a move whose target_premise names an already-released exhibit',
          "RE-STAGES it, restoring it to the learner's hands; a misremembered form is",
          'displaced only by staging the true form again, plainly, so the false version',
          'cannot stand beside it.',
          '',
          'THE BENT FACT OUTRANKS THE MISSING ONE: when conduct shows you both an',
          'exhibit lost and an exhibit garbled, mend the garbled one first. An absence',
          'merely stalls the inquiry; a false form argues for it — every turn it stands,',
          'the learner builds on it, and what is built on a bent fact must later be',
          'torn down. Repair what misleads before you replace what is missing.',
        ]
      : []),
    ...(reconstruct
      ? [
          '',
          "# Your reconstruction of the learner's theory (every turn)",
          '',
          "Each turn, alongside your dialogue, commit your working model of the learner's",
          'theory over the premises RELEASED SO FAR (premise ids from the ledger above):',
          '- "believed_held": released premises you judge the learner still holds;',
          '- "believed_missing": released premises you judge have slipped from them;',
          '- "believed_mistaken": released premises you judge they hold in a corrupted',
          '  form (one detail swapped for a plausible wrong one).',
          'Infer from conduct. An empty list is a claim too — commit your model every',
          'turn, even uncertain; the drama is long and your model can move.',
          '',
          'THE SUPPLEMENT MANDATE: let the reconstruction drive the turn. A premise you',
          "believe missing wants re-staging (name it as your move's target_premise); one",
          'you believe mistaken wants the true form spoken again, named as your target.',
          'When both stand open, believed_mistaken outranks believed_missing: an absence',
          'stalls, a false form argues — mend the bent fact first.',
          'Your release cues are unchanged — the mandate governs the turns between them.',
        ]
      : []),
    ...(confront
      ? [
          '',
          '# The confrontation obligation (no bare re-entry)',
          '',
          'An exhibit, once staged, is never simply restated. When you return to an',
          'already-staged exhibit — any move whose target_premise names one staged on an',
          'earlier turn — your FIRST move on it must be a CONFRONTATION: intent',
          '"confront", target_premise naming the exhibit, and a demand that the learner',
          'READ BACK what they hold of it — in their words, from their board, before you',
          "repair anything. A confrontation restates NOTHING of the exhibit's content:",
          'no quotation, no paraphrase, no hint of the detail you suspect lost or bent.',
          'Only after they have answered may you re-stage it; one confrontation licenses',
          'ONE re-entry. The self-audit comes first, or the repair teaches nothing.',
          '',
          'TREATMENT FOLLOWS DIAGNOSIS: when the read-back exposes a loss — the learner',
          'cannot produce the exhibit, or produces it bent — the licensed re-entry is no',
          'longer optional. Spend it on your NEXT turn: re-stage that paper, plainly. A',
          'confrontation that exposes an absence and is followed by silence teaches the',
          'absence twice and repairs nothing.',
        ]
      : []),
    ...(repairClause
      ? [
          '',
          '# The repair clause (a named loss is already a read-back)',
          '',
          'The confrontation obligation has one exception, and it runs the other way.',
          'When the LEARNER names an already-staged exhibit as lost or bent — they',
          'cannot find it on their board, they ask for it back, they read it back',
          'wrong — their report IS the read-back. Do not demand another: a',
          'confrontation after a named loss teaches the absence twice. Your NEXT turn',
          're-stages the named exhibit, plainly and in full, BEFORE any new matter —',
          'declare the move with intent "restore" and that exhibit as target_premise.',
          'One report licenses one restoration, of that exhibit alone; "restore"',
          'claims the license, so spend it only on a loss the learner has just named.',
          'New matter can wait a turn; a hole in the board cannot.',
        ]
      : []),
    ...(plot
      ? [
          '',
          '# The act plot (committed at each opening; audited at each close)',
          '',
          'On the FIRST turn of each act — the harness marks it — commit a PLOT for',
          'the act alongside your dialogue, built from conduct alone (what the learner',
          'has said and done on stage; you are never shown their board). Four fields:',
          '- "hold_by_end": one to three claims the learner should DEMONSTRABLY hold',
          "  by the act's close — each checkable from the record (they cite it, use",
          "  it, read it back), never from anyone's interior;",
          '- "withhold": what you will NOT stage or concede this act, and until when;',
          '- "friction": where you expect the learner to balk, leap, or garble —',
          '  named before it happens;',
          '- "fallback": what you will do when that friction arrives.',
          '',
          'The plot is a commitment, not a mood. Play the act under it. At the act',
          'close your own watcher audits it clause by clause against the record:',
          'kept, justified_deviation (bent, and the record shows why), or drift (the',
          'act wandered off it with nothing to answer for it). A clause too vague to',
          'check audits as drift — write clauses the record can check. THE AUDIT',
          "BINDS: your next act's plot must answer every drifted clause — carry it",
          'forward, revise it, or retire it with a reason. Mid-act turns commit no',
          'new plot; they play under the standing one.',
        ]
      : []),
    ...(throughline
      ? [
          '',
          "# The throughline (the whole play's plan, above the act plots)",
          '',
          'Two frames govern every line you speak: the ACT — the lesson, what this',
          'act must accomplish — and the PLAY — the course, where the whole inquiry',
          'is going. The act plot serves the first; the THROUGHLINE you commit on',
          'the FIRST turn of the drama serves the second. Four fields:',
          '- "arc": two to four waypoints, in order — the shape the whole inquiry',
          '  should take, each checkable from the record when it arrives;',
          '- "hold_to_end": the one thing the play must not reach until its final',
          '  phase, and what must stand before it;',
          '- "risk": the single greatest threat to the WHOLE play — named now,',
          '  before it arrives;',
          '- "salvage": the path you take if the arc breaks.',
          '',
          'The throughline is the standing frame: every act plot must advance it,',
          'and at each act close your own watcher judges the act against it —',
          'on_arc or off_arc. When the verdict is off_arc, the next act opening',
          'MUST revise the throughline to answer the evidence; while it is on_arc',
          'you may revise only with a declared one-line reason. A course',
          "correction is conduct; silent drift is the failure. At the run's end",
          'the throughline itself is audited clause by clause, like any plot.',
        ]
      : []),
    ...(registers.length
      ? ['', '# Register (operator dials — these color your MANNER, never your evidence)', '', ...registers]
      : []),
    '',
    `Declare your move each turn: figure ∈ {${TUTOR_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {${intents.join(', ')}}.`,
    '',
    'Reply with ONLY a JSON object:',
    `{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}${
      releaseAuthority
        ? ', "release": "<exhibit id from your window, or null to hold>", "release_reason": "<one line when playing off the scheduled turn, else null>"'
        : ''
    }${
      reconstruct
        ? ', "theory": {"believed_held": ["<premise id>", ...], "believed_missing": [...], "believed_mistaken": [...]}'
        : ''
    }${
      plot ? ', "plot": {"hold_by_end": ["<claim>", ...], "withhold": "...", "friction": "...", "fallback": "..."}' : ''
    }${
      throughline
        ? ', "throughline": {"arc": ["<waypoint>", ...], "hold_to_end": "...", "risk": "...", "salvage": "..."}, "throughline_reason": "<one line when revising voluntarily, else null>"'
        : ''
    }}`,
    ...(plot ? ['("plot" belongs to act-opening turns ONLY — the harness marks them; omit the key mid-act.)'] : []),
    ...(throughline
      ? [
          '("throughline" belongs to the FIRST turn and to act-opening revisions — the harness marks when it is due; omit the key otherwise.)',
        ]
      : []),
  ].join('\n');
}

/**
 * The tutor's superego — the watcher inside the same mind (operator mandate
 * 2026-06-10: the 4-arm staging experiment proved the note→figure mechanism
 * but with an external author; organic development means the tutor watches
 * its OWN manner). It sees public material plus the tutor's draft: never the
 * secret, the premise ledger, or the schedule — so it cannot leak what it
 * does not hold, and its note governs manner only.
 *
 * Charter v3 (`stallWatch`, pre-registered in notes/poetics/2026-06-10-
 * stall-watcher-quasi-logical-tom.md §3) adds a SECOND criterial
 * jurisdiction: the stalled inference — board-closure arithmetic the harness
 * states as fact (available ≥ 3 turns, unvoiced, grounds untargeted). With
 * `stallWatch` false the v2 charter is returned byte-identical (the OFF
 * control). `counsel` (the critic-feedback loop, §4) is a labeled appendix
 * in both modes — counsel, never a jurisdiction.
 */
function tutorSuperegoSystem(
  world,
  {
    stallWatch = false,
    counsel = null,
    reconstruct = false,
    confront = false,
    repairClause = false,
    plot = false,
    throughline = false,
  } = {},
) {
  return [
    "You are the tutor's SUPEREGO in a staged derivation drama — the watcher inside",
    'the same mind. You are never heard on stage; only the tutor reads you.',
    `The drama: "${world.title}". The public question: ${world.question}`,
    '',
    ...(stallWatch
      ? [
          "Each turn you see the tutor's DRAFT line with its declared figure, the",
          'recent record of conduct, and the inference record. You watch TWO things',
          'and two only.',
          '',
          'Your first jurisdiction is the FIGURE RUT — the same declared device on',
          'both of the last two turns, and the draft declaring it a third time.',
          'Three in a row is a rut; anything less is conduct, not a rut.',
          '',
          'Your second jurisdiction is the STALLED INFERENCE. You hold the same rules',
          'of evidence the learner reasons by; the record each turn states what those',
          "rules already yield from the learner's public board that the learner has",
          "not yet said aloud, how many turns it has waited, and whether the tutor's",
          'recent turns or the draft touch its grounds. A stall requires ALL THREE:',
          'the inference has been available three turns or more; the learner has not',
          "voiced it; and neither of the tutor's last two turns nor the draft targets",
          'any of its grounds. Anything less is patience, not a stall. When the record',
          'shows a stall the draft does not answer, intervene: name the facts already',
          "on the learner's board that are not being put together, and the rule that",
          'joins them — that exactly, and nothing more.',
        ]
      : confront
        ? [
            "Each turn you see the tutor's DRAFT line with its declared figure and its",
            'declared target, and the recent record of conduct. You watch TWO things',
            'and two only.',
            '',
            'Your first jurisdiction is the FIGURE RUT — the same declared device on',
            'both of the last two turns, and the draft declaring it a third time.',
            'Three in a row is a rut; anything less is conduct, not a rut.',
            '',
            'Your second jurisdiction is the UNCONFRONTED RE-ENTRY. The tutor is bound',
            'to confront before re-staging: a draft move that targets an exhibit staged',
            'on an earlier turn, with any intent but "confront", is licensed only by a',
            'confrontation of that same exhibit standing since its last staging — and',
            'each confrontation licenses one re-entry, no more. The record each turn',
            "states the draft's target and intent, whether that exhibit was staged",
            'earlier, and whether an unspent confrontation covers it — every value as',
            'fact. When the record shows an uncovered re-entry, intervene: tell the',
            'tutor to confront first — demand the read-back of what the learner holds',
            'of that exhibit, restating nothing of its content.',
            ...(repairClause
              ? [
                  '',
                  'One further license, under the REPAIR CLAUSE: a draft re-entry with',
                  'declared intent "restore" claims that the learner, in their most recent',
                  'line, named that very exhibit as lost or bent. The record states the',
                  "mechanical facts and leaves the claim to you: read the learner's last",
                  "line in the record before you. Where it names that exhibit's loss, the",
                  're-entry is licensed — the report stands as the read-back, and the',
                  'restoration must not be delayed for a confrontation. Where it does not,',
                  'the claim is false and the draft is an uncovered re-entry: intervene as',
                  'for any other.',
                ]
              : []),
          ]
        : [
            "Each turn you see the tutor's DRAFT line with its declared figure, and the",
            'recent record of conduct. You watch ONE thing: the FIGURE RUT — the same',
            'declared device on both of the last two turns, and the draft declaring it a',
            'third time. Three in a row is a rut; anything less is conduct, not a rut.',
          ]),
    '',
    'Your default reply is {"intervene": false}. The manner usually serves. Every',
    'other dissatisfaction you may feel — pacing, register, a recap the learner',
    'has outgrown, a conceit leaned on too often — is NOT yours to correct: put a',
    'word of it in "diagnosis" if you must, and still reply intervene false. A',
    'note every turn is a note never heard; you are credible because you are',
    ...(stallWatch
      ? [
          'rare. When a rut is real, intervene and name the device to leave off; when',
          'a stall is real, intervene with the stall note exactly as your second',
          'jurisdiction describes — in one or two sentences either way, as a note the',
          'tutor reads before speaking.',
          '',
          'THE EVIDENCE BOUNDARY: never name or describe evidence not yet on the',
          "learner's board; never name the answer or any fact of its shape; never",
          'tell the tutor what to reveal or withhold. Facts already grounded on the',
          "learner's public board are public property — a stall note names those,",
          'the rule that joins them, and nothing else.',
        ]
      : confront
        ? [
            'rare. When a rut is real, intervene and name the device to leave off; when',
            'an uncovered re-entry is real, intervene and order the confrontation first',
            '— in one or two sentences either way, as a note the tutor reads before',
            'speaking.',
            '',
            'THE EVIDENCE BOUNDARY: never name or describe evidence not yet staged;',
            'never restate any content of the exhibit in question; never name the',
            'answer or any fact of its shape. The note demands the read-back; it never',
            'supplies what the read-back should contain.',
          ]
        : [
            'rare. When the rut is real, intervene and name the device to leave off — in',
            'one or two sentences, as a note the tutor reads before speaking.',
            '',
            'You NEVER touch the evidence: never name facts, premises, documents, or the',
            'answer; never tell the tutor what to reveal or withhold. The note governs how',
            'the tutor plays, never what the drama shows.',
          ]),
    ...(reconstruct
      ? [
          '',
          "The draft comes with the tutor's RECONSTRUCTION of the learner's theory",
          "(believed held / missing / mistaken — the learner's board is hidden from",
          "you both; the reconstruction is the ego's inference from conduct). Read it",
          'as context; when the draft plainly ignores its own reconstruction — a',
          'premise believed missing that the turn does nothing to restore — say so in',
          '"diagnosis". Your jurisdiction is unchanged: intervene only on the rut.',
        ]
      : []),
    ...(plot
      ? [
          '',
          "The draft may come with the tutor's standing PLOT for the act (committed",
          'at its opening)' +
            (throughline
              ? " and the tutor's standing THROUGHLINE for the whole play" + ' (committed at the first turn)'
              : '') +
            '. Read ' +
            (throughline ? 'them' : 'it') +
            ' as context; when the draft plainly abandons its',
          'own plot — a withhold about to be staged, a named friction met with',
          'nothing — say so in "diagnosis". Your jurisdiction is unchanged: the',
          'act-close audit, not the turn watch, judges the plot' + (throughline ? ' and the arc' : '') + '.',
        ]
      : []),
    ...(counsel
      ? [
          '',
          "# Counsel from the previous performance's reader",
          '',
          'Counsel, never a jurisdiction — your triggers are exactly those above and',
          'only those. It adds no evidence and changes no criterion.',
          '',
          counsel.trim(),
        ]
      : []),
    '',
    'Reply with ONLY a JSON object:',
    '{"intervene": true|false,',
    ...(stallWatch
      ? [' "jurisdiction": "figure_rut" | "stalled_inference" | null,']
      : confront
        ? [' "jurisdiction": "figure_rut" | "unconfronted_reentry" | null,']
        : []),
    ' "diagnosis": "<one sentence on the conduct you see>",',
    ' "note": "<the note the tutor reads before speaking, or null>"}',
  ].join('\n');
}

// The audit's verdict vocabulary (C1): anything outside it gates to
// 'unscored' rather than being trusted — the contract is the three words.
const PLOT_VERDICTS = new Set(['kept', 'justified_deviation', 'drift']);

// The arc verdict vocabulary (C1 two-layer): the act-close audit also reads
// the act against the standing throughline. Same gate discipline.
const ARC_VERDICTS = new Set(['on_arc', 'off_arc']);

/**
 * The act-close plot audit — the same watcher, sitting in a SECOND seat (C1,
 * plan §5). At each act boundary it judges the closed act's PLOT against the
 * record as played: every clause kept, justified_deviation, or drift. It
 * holds the ego's own plot text plus stage-public conduct (the act's lines
 * and staged exhibit ids) — never the secret, the premise ledger, or the
 * learner's board — and its verdict is read by the ego alone: intra-mind,
 * no new evidence channel onto the stage.
 */
function plotAuditSystem(world, { throughline = false } = {}) {
  return [
    "You are the tutor's SUPEREGO in a staged derivation drama, sitting as the",
    'ACT-CLOSE AUDITOR. An act has just closed. Before you: the PLOT the tutor',
    'committed at its opening, and the public record of the act as played —',
    "nothing else. No secret, no exhibit ledger, no view of the learner's board.",
    `The drama: "${world.title}". The public question: ${world.question}`,
    '',
    'Judge the plot CLAUSE BY CLAUSE against the record:',
    '- "kept" — the record honours the clause: a hold_by_end claim the learner',
    '  demonstrably holds (cites it, uses it, reads it back); a withhold that',
    '  stayed unstaged; a named friction met by its fallback when it arrived.',
    '- "justified_deviation" — the clause was bent and the record shows why: a',
    '  better line opened, the learner forced the issue, the act closed early.',
    '  Name the evidence.',
    '- "drift" — the act wandered off the clause with nothing in the record to',
    '  answer for it. A clause too vague to check is drift by default.',
    ...(throughline
      ? [
          '',
          "You may also be shown the tutor's standing THROUGHLINE — the whole",
          "play's plan, committed at the first turn. When it is before you, give",
          'ONE further verdict on the act as a whole against it: "on_arc" (the act',
          "advanced the throughline's waypoints, or held its ground for a named",
          'reason) or "off_arc" (the act spent itself away from the arc — name',
          'where). One verdict for the act, not per waypoint; the run-end audit',
          'reckons the throughline clause by clause, not you.',
        ]
      : []),
    '',
    'Your audit reaches the tutor alone — never the stage. Be exact and',
    'unsentimental: the next plot is built on these verdicts.',
    '',
    'Reply with ONLY a JSON object:',
    '{"audit": [{"clause": "<the clause, quoted or tightly paraphrased>", "verdict": "kept" | "justified_deviation" | "drift", "evidence": "<one line from the record>"}, ...],' +
      (throughline
        ? '\n "arc": {"verdict": "on_arc" | "off_arc", "evidence": "<one line from the record>"} (only when a throughline is before you, else omit),'
        : ''),
    ' "summary": "<one or two lines the tutor reads before plotting the next act>"}',
  ].join('\n');
}

export function makeLlmTutor(
  world,
  client,
  {
    script,
    dials = {},
    superego = false,
    stallWatch = false,
    counsel = null,
    decayVisibility = 'told',
    actsMode = false,
    reconstruct = false,
    confront = false,
    repairClause = false,
    releaseAuthority = false,
    plot = false,
    throughline = false,
  } = {},
) {
  if (!script || !script.trim()) {
    throw new Error('derivation.llmRoles: makeLlmTutor requires a role-script (the iteration target)');
  }
  if (stallWatch && !superego) {
    throw new Error(
      'derivation.llmRoles: stallWatch requires the superego (the stall jurisdiction lives in its charter)',
    );
  }
  if (decayVisibility !== 'told' && decayVisibility !== 'conduct') {
    throw new Error(
      `derivation.llmRoles: decayVisibility must be 'told' or 'conduct', got ${JSON.stringify(decayVisibility)}`,
    );
  }
  // Acts-mode wiring guards: the engine's redaction removes exactly the view
  // fields these features read, so a contradictory wiring fails at build, not
  // mid-drama. reconstruct is the adapt-ON arm dial and presupposes the
  // bounded stage; stallWatch reads the inference frontier (computed FROM the
  // hidden store); the told channel reads the corruption view.
  if (reconstruct && !actsMode) {
    throw new Error('derivation.llmRoles: reconstruct is acts-mode machinery (pass actsMode: true)');
  }
  if (actsMode && stallWatch) {
    throw new Error(
      'derivation.llmRoles: stallWatch cannot run in acts mode — the stall jurisdiction reads the inference frontier, which acts-mode redaction withholds from the tutor',
    );
  }
  if (actsMode && decayVisibility !== 'conduct') {
    throw new Error(
      "derivation.llmRoles: acts mode requires decayVisibility 'conduct' — the told channel reads a corruption view the acts-mode tutor no longer has",
    );
  }
  // C5 is acts-mode machinery: "re-entry" is only defined where a move
  // targeting an already-staged exhibit RE-STAGES it (the acts-mode charter);
  // in v1 the learner never lost the exhibit, so there is nothing to confront.
  if (confront && !actsMode) {
    throw new Error('derivation.llmRoles: confront requires acts mode (re-entry is an acts-mode concept)');
  }
  // §12: the repair clause is an exception WITHIN the confrontation
  // obligation — without confront there is no obligation to except, and the
  // "restore" license has nothing to claim against.
  if (repairClause && !confront) {
    throw new Error(
      'derivation.llmRoles: repairClause requires confront (the clause is an exception to the confrontation obligation)',
    );
  }
  // C1 wiring guards: the plot is an act-scale commitment (no acts, no
  // opening to commit at and no close to audit), and the act-close audit is
  // the superego's jurisdiction — without the watcher nothing binds.
  if (plot && !actsMode) {
    throw new Error(
      'derivation.llmRoles: plot requires acts mode (the plot is an act-scale commitment — no acts, no opening to commit at or close to audit)',
    );
  }
  if (plot && !superego) {
    throw new Error('derivation.llmRoles: plot requires the superego (the act-close audit is its jurisdiction)');
  }
  // Two-layer planning (operator-directed 2026-06-12): the throughline is the
  // whole-play frame ABOVE the act plots — its arc verdict rides the act-close
  // audit, so without the plot loop there is nothing for it to bind to.
  if (throughline && !plot) {
    throw new Error(
      'derivation.llmRoles: throughline requires plot (the arc verdict rides the act-close audit — no plot loop, nothing binds)',
    );
  }
  const system = tutorSystem(world, script, dials, {
    actsMode,
    reconstruct,
    confront,
    repairClause,
    releaseAuthority,
    plot,
    throughline,
  });
  const superegoSystem = superego
    ? tutorSuperegoSystem(world, { stallWatch, counsel, reconstruct, confront, repairClause, plot, throughline })
    : null;
  const plotAuditCharter = plot ? plotAuditSystem(world, { throughline }) : null;
  const normalizeMove = (out) =>
    out.move && typeof out.move === 'object'
      ? {
          figure: out.move.figure || null,
          targetPremise: out.move.target_premise || null,
          intent: out.move.intent || null,
        }
      : null;
  // Theory shape gate (arm-ON): premise-id string arrays or nothing — a
  // malformed theory drops to null, which keeps the engine's recording gate
  // closed for that turn (absence is visible to the scorer; an empty claim
  // is not fabricated on the model's behalf).
  const normalizeTheory = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const ids = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);
    return {
      believed_held: ids(raw.believed_held),
      believed_missing: ids(raw.believed_missing),
      believed_mistaken: ids(raw.believed_mistaken),
    };
  };
  // --- C1 (plan §5): the per-act plot, committed at each act opening and
  // audited at each close. Per-run state lives in the bridge closure (the
  // firstSeen-Map pattern from makeLlmLearner). ---
  const plotState = plot ? { current: null, actIndex: null, authoredTurn: null, lastAudit: null } : null;
  // Two-layer planning: the throughline is per-RUN state (one frame for the
  // whole play), where plotState is per-act. lastArc carries the audit's arc
  // verdict across the boundary — it is what makes an off_arc verdict bind
  // the next opening's revision demand.
  const throughlineState = throughline ? { current: null, committedTurn: null, revisedTurns: [], lastArc: null } : null;
  // Plot shape gate: a plot is real only when at least one field is
  // non-empty — a malformed or empty plot drops to null, which keeps the
  // engine's recording gate closed for that act (absence is visible to the
  // scorer; an empty commitment is not fabricated on the model's behalf).
  const normalizePlot = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const holdByEnd = Array.isArray(raw.hold_by_end)
      ? raw.hold_by_end.map((x) => String(x).trim()).filter(Boolean)
      : [];
    const withhold = str(raw.withhold);
    const friction = str(raw.friction);
    const fallback = str(raw.fallback);
    if (!holdByEnd.length && !withhold && !friction && !fallback) return null;
    return { holdByEnd, withhold, friction, fallback };
  };
  // Audit shape gate: a clause with a verdict outside the contract is kept
  // but gated to 'unscored' rather than trusted; no clauses -> null. The
  // throughline rider parses with the same discipline: the arc verdict gates
  // to 'unscored' outside ARC_VERDICTS, and the run-end clause reckoning
  // reuses the plot's three-word vocabulary.
  const parseClauses = (v) =>
    (Array.isArray(v) ? v : [])
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        clause: typeof c.clause === 'string' ? c.clause.trim() : '',
        verdict: PLOT_VERDICTS.has(c.verdict) ? c.verdict : 'unscored',
        evidence: typeof c.evidence === 'string' ? c.evidence.trim() : '',
      }))
      .filter((c) => c.clause);
  const normalizeAudit = (raw, act) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const clauses = parseClauses(raw.audit);
    if (!clauses.length) return null;
    const arc =
      throughline && raw.arc && typeof raw.arc === 'object' && !Array.isArray(raw.arc)
        ? {
            verdict: ARC_VERDICTS.has(raw.arc.verdict) ? raw.arc.verdict : 'unscored',
            evidence: typeof raw.arc.evidence === 'string' ? raw.arc.evidence.trim() : '',
          }
        : null;
    const throughlineAudit = throughline ? parseClauses(raw.throughline_audit) : [];
    return {
      act,
      clauses,
      summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : null,
      ...(arc ? { arc } : {}),
      ...(throughlineAudit.length ? { throughlineAudit } : {}),
    };
  };
  const renderPlotLines = (p) => [
    ...p.holdByEnd.map((c, i) => `- hold_by_end[${i + 1}]: ${c}`),
    ...(p.withhold ? [`- withhold: ${p.withhold}`] : []),
    ...(p.friction ? [`- friction: ${p.friction}`] : []),
    ...(p.fallback ? [`- fallback: ${p.fallback}`] : []),
  ];
  // Throughline shape gate: same discipline as the plot — real only when at
  // least one field is non-empty; a malformed commitment drops to null, the
  // play runs without a standing frame, and the next opening re-demands one
  // (the lapse stays visible to the scorer).
  const normalizeThroughline = (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const arc = Array.isArray(raw.arc) ? raw.arc.map((x) => String(x).trim()).filter(Boolean) : [];
    const holdToEnd = str(raw.hold_to_end);
    const risk = str(raw.risk);
    const salvage = str(raw.salvage);
    if (!arc.length && !holdToEnd && !risk && !salvage) return null;
    return { arc, holdToEnd, risk, salvage };
  };
  const renderThroughlineLines = (t) => [
    ...t.arc.map((w, i) => `- arc[${i + 1}]: ${w}`),
    ...(t.holdToEnd ? [`- hold_to_end: ${t.holdToEnd}`] : []),
    ...(t.risk ? [`- risk: ${t.risk}`] : []),
    ...(t.salvage ? [`- salvage: ${t.salvage}`] : []),
  ];
  // The act-close audit call: a separate tutor_superego call under its own
  // charter. The auditor holds the ego's plot text and the act's public
  // record (its lines + the exhibit ids staged in its span) — the watch's
  // leak discipline: nothing concealed enters, and the verdict goes to the
  // ego alone, never the stage.
  const auditClosedAct = async (closedAct, standingPlot, { transcript, ledger, turn, isFinal = false }) => {
    const [from, to] = closedAct.turns;
    const actLines = transcript.filter(
      (l) => l.turn >= from && l.turn <= to && (l.role === 'tutor' || l.role === 'learner'),
    );
    const staged = ledger.filter((l) => l.turn >= from && l.turn <= to).map((l) => l.premiseId);
    // The standing throughline enters the auditor's view AS IT STOOD during
    // the act — the call order at a boundary is audit -> draft -> watch, so
    // any revision this turn lands after the verdict it must answer.
    const standingThroughline = throughline ? throughlineState.current : null;
    const auditUser = [
      `Act ${closedAct.act} has closed (turns ${from}–${to}).`,
      '',
      'THE PLOT the tutor committed at its opening:',
      ...renderPlotLines(standingPlot),
      ...(standingThroughline
        ? [
            '',
            "THE THROUGHLINE the tutor holds for the whole play — give your 'arc'",
            'verdict on the closed act against it:',
            ...renderThroughlineLines(standingThroughline),
          ]
        : []),
      '',
      `Exhibits staged during the act: ${staged.length ? staged.join(', ') : 'none'}.`,
      '',
      'The act as played:',
      actLines.map((l) => `[turn ${l.turn}] ${l.role.toUpperCase()}: ${(l.text || '').trim()}`).join('\n') ||
        '(no lines)',
      '',
      ...(isFinal && standingThroughline
        ? [
            'This is the RUN-END audit: the play is over. Additionally reckon the',
            'THROUGHLINE clause by clause against the whole record, as',
            '"throughline_audit": [{"clause": "...", "verdict": "kept" | "justified_deviation" | "drift", "evidence": "..."}, ...].',
            '',
          ]
        : []),
      'Audit the plot clause by clause. Reply with ONLY the JSON object.',
    ].join('\n');
    // mock determinism: a hold clause is kept iff a premise id it names was
    // staged within the act span, else drift; the other clause kinds audit
    // kept. The real backend ignores meta.
    const stagedSet = new Set(staged);
    const mockClauses = [
      ...standingPlot.holdByEnd.map((c) => ({
        clause: c,
        verdict: [...world.premiseById.keys()].some((id) => c.includes(id) && stagedSet.has(id)) ? 'kept' : 'drift',
        evidence: 'mock: hold clause checked against the act-span ledger',
      })),
      ...(standingPlot.withhold
        ? [{ clause: standingPlot.withhold, verdict: 'kept', evidence: 'mock: withhold honoured' }]
        : []),
      ...(standingPlot.friction
        ? [{ clause: standingPlot.friction, verdict: 'kept', evidence: 'mock: friction named in advance' }]
        : []),
      ...(standingPlot.fallback
        ? [{ clause: standingPlot.fallback, verdict: 'kept', evidence: 'mock: fallback stood ready' }]
        : []),
    ];
    // mock determinism for the throughline rider: on_arc iff the act staged
    // at least one exhibit (an act that moved evidence advanced the arc); the
    // final call reckons every throughline clause kept. The real backend
    // ignores meta.
    const mockArcBits = standingThroughline
      ? {
          arc: {
            verdict: staged.length ? 'on_arc' : 'off_arc',
            evidence: staged.length
              ? `mock: act staged ${staged.join(', ')}`
              : 'mock: act staged nothing — the arc did not advance',
          },
          ...(isFinal
            ? {
                throughlineAudit: [
                  ...standingThroughline.arc.map((w) => ({
                    clause: w,
                    verdict: 'kept',
                    evidence: 'mock: waypoint reckoned at run end',
                  })),
                  ...(standingThroughline.holdToEnd
                    ? [
                        {
                          clause: standingThroughline.holdToEnd,
                          verdict: 'kept',
                          evidence: 'mock: hold_to_end reckoned at run end',
                        },
                      ]
                    : []),
                  ...(standingThroughline.risk
                    ? [{ clause: standingThroughline.risk, verdict: 'kept', evidence: 'mock: risk named in advance' }]
                    : []),
                  ...(standingThroughline.salvage
                    ? [
                        {
                          clause: standingThroughline.salvage,
                          verdict: 'kept',
                          evidence: 'mock: salvage stood ready',
                        },
                      ]
                    : []),
                ],
              }
            : {}),
        }
      : {};
    const out = await callJson(client, 'tutor_superego', turn, {
      system: plotAuditCharter,
      user: auditUser,
      meta: {
        plotAuditHint: {
          clauses: mockClauses,
          summary: `mock audit of act ${closedAct.act}`,
          ...mockArcBits,
        },
      },
    });
    return normalizeAudit(out, closedAct.act);
  };
  const tutorFn = async (view) => {
    // C2 (release authority): the fixed per-turn cue becomes a WINDOW. Each
    // unreleased via-tutor entry is playable from RELEASE_LATITUDE turns
    // before its scheduled turn; at RELEASE_LATITUDE past it, it hits the
    // hold limit and the bridge force-plays it (a model choice to the
    // contrary is overridden and recorded). The schedule-driven branch is
    // byte-identical when the dial is off.
    const alreadyReleased = new Set(view.ledger.map((l) => l.premiseId));
    const playable = releaseAuthority
      ? world.releaseSchedule.filter(
          (e) => e.via === 'tutor' && !alreadyReleased.has(e.premise) && view.turn >= e.turn - RELEASE_LATITUDE,
        )
      : [];
    const forcedPlay = releaseAuthority
      ? playable.filter((e) => view.turn >= e.turn + RELEASE_LATITUDE).sort((a, b) => a.turn - b.turn)[0] || null
      : null;
    const { entry, premise } = releaseAuthority
      ? { entry: null, premise: null }
      : scheduledFor(world, view.turn, 'tutor');
    // Acts-mode redaction (engine.js omniscientView): no learnerAbox, no
    // trajectory, no corruption — the tutor works from the dialogue and its
    // own ledger. The v1 branch below is untouched.
    const lastPoint = actsMode ? null : view.trajectory[view.trajectory.length - 1] || null;
    const forcedNote =
      lastPoint && lastPoint.forced
        ? "THE LEARNER'S OWN GROUNDED FACTS NOW FORCE THE CONCLUSION. Stage the recognition — bring them to say it and ground it; do not say it yourself."
        : null;
    const windowLines = playable.map((e) => {
      const held = view.turn - e.turn;
      const status =
        forcedPlay && forcedPlay.premise === e.premise
          ? 'AT ITS HOLD LIMIT — must be played THIS turn'
          : held < 0
            ? `playable early (scheduled turn ${e.turn})`
            : held === 0
              ? 'scheduled THIS turn'
              : `held ${held} turn${held === 1 ? '' : 's'} (scheduled turn ${e.turn}; hold limit turn ${e.turn + RELEASE_LATITUDE})`;
      return `- ${e.premise}: ${status}`;
    });
    const task = releaseAuthority
      ? [
          'YOUR EXHIBIT WINDOW this turn:',
          windowLines.length ? windowLines.join('\n') : '(no exhibit playable this turn — "release" must be null)',
          '',
          'Declare "release": one exhibit id from the window to play it this turn, or',
          'null to hold. Playing off the scheduled turn needs a one-line',
          '"release_reason". When you play an exhibit, weave its evidence (from the',
          'premise ledger) into your dialogue as something produced or recalled,',
          'faithful to it. Beyond the window, work the inquiry by your script —',
          'whichever your reading of the learner calls for.',
        ].join('\n')
      : premise
        ? `THIS TURN IS YOUR CUE to bring ${entry.premise} into play. Weave this evidence into your dialogue as something produced or recalled, faithful to it:\n"${(premise.surface || '').trim()}"`
        : actsMode
          ? 'No release is due from you this turn. Work the inquiry by your script — consolidate, test, counter the tempting answer, re-stage what you judge lost, or stage the recognition — whichever your reading of the learner calls for.'
          : "No release is due from you this turn. Work the learner's board by your script: consolidate, test, counter the tempting answer, or stage the recognition — whichever the board calls for.";
    // --- C1 plot lifecycle (acts mode only): on an act-opening turn the
    // bridge FIRST audits the act just closed (the engine seals act N during
    // the director phase of this same turn, so the closed act is already in
    // view.acts.closed), THEN demands a fresh plot — the ordering is the
    // binding: the verdicts are on the table before the next plot is
    // written. Mid-act turns read the standing plot back. ---
    let plotAuditRow = null;
    let plotOpening = false;
    if (plot) {
      const a = view.acts;
      plotOpening = a.startTurn === view.turn;
      if (plotOpening) {
        const closedAct = a.closed[a.closed.length - 1] || null;
        if (plotState.current && closedAct && plotState.actIndex === closedAct.act) {
          plotAuditRow = await auditClosedAct(closedAct, plotState.current, {
            transcript: view.transcript,
            ledger: view.ledger,
            turn: view.turn,
          });
          if (plotAuditRow) plotState.lastAudit = plotAuditRow;
        }
        // The arc verdict crosses the boundary here: written before the
        // prompt section is assembled, so an off_arc verdict binds THIS
        // opening's revision demand (audit -> draft -> watch).
        if (throughline && plotAuditRow?.arc) throughlineState.lastArc = plotAuditRow.arc.verdict;
        plotState.current = null;
        plotState.actIndex = a.index;
      }
    }
    // --- Throughline lifecycle (two-layer planning): committed at the first
    // turn, read back EVERY turn above the act plot, revisable only at act
    // openings — demanded when nothing stands (opening / recommit) or when
    // the arc verdict went off_arc (audit_bound); permitted with a declared
    // reason while on_arc (voluntary). ---
    let throughlineDue = false;
    let throughlineTrigger = null;
    if (throughline && plotOpening) {
      if (!throughlineState.current) {
        throughlineDue = true;
        throughlineTrigger = view.turn === 1 ? 'opening' : 'recommit';
      } else if (throughlineState.lastArc === 'off_arc') {
        throughlineDue = true;
        throughlineTrigger = 'audit_bound';
      }
    }
    const throughlineSection = (() => {
      if (!throughline) return [];
      const standing = throughlineState.current
        ? [
            '',
            `YOUR THROUGHLINE for the whole play (standing since turn ${throughlineState.committedTurn}):`,
            ...renderThroughlineLines(throughlineState.current),
          ]
        : [];
      if (!plotOpening) {
        return standing.length ? [...standing, 'The play moves under it; this act serves it.'] : [];
      }
      if (throughlineDue) {
        if (throughlineTrigger === 'audit_bound') {
          return [
            ...standing,
            'THE ARC VERDICT on the closed act was OFF_ARC — THE AUDIT BINDS: revise',
            'your throughline in "throughline" THIS turn to answer the evidence,',
            'alongside your dialogue and your act plot.',
          ];
        }
        return [
          '',
          throughlineTrigger === 'opening'
            ? 'THIS TURN OPENS THE PLAY — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.'
            : 'NO THROUGHLINE STANDS — COMMIT YOUR THROUGHLINE (the whole play\'s plan) in "throughline", alongside your dialogue and your act plot.',
        ];
      }
      return [
        ...standing,
        ...(throughlineState.lastArc === 'on_arc'
          ? [
              'The arc verdict on the closed act: ON_ARC. You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
            ]
          : [
              'You MAY revise the throughline in "throughline" with a one-line "throughline_reason"; silence keeps it standing.',
            ]),
      ];
    })();
    const plotSection = !plot
      ? []
      : plotOpening
        ? [
            '',
            ...(plotAuditRow
              ? [
                  `THE AUDIT of your act ${plotAuditRow.act} plot (your own watcher, clause by clause):`,
                  ...plotAuditRow.clauses.map(
                    (c) => `- [${c.verdict}] ${c.clause}${c.evidence ? ` — ${c.evidence}` : ''}`,
                  ),
                  ...(plotAuditRow.summary ? [`The auditor's summary: ${plotAuditRow.summary}`] : []),
                  'THE AUDIT BINDS: the plot you now commit must answer every drifted',
                  'clause — carry it forward, revise it, or retire it with a reason.',
                  '',
                ]
              : view.acts.index > 1
                ? ['(No audit: the previous act closed without a plot on record.)', '']
                : []),
            `THIS TURN OPENS ACT ${view.acts.index} — COMMIT YOUR PLOT for the act in "plot", alongside your dialogue.`,
          ]
        : plotState.current
          ? [
              '',
              'YOUR PLOT for this act (committed at its opening):',
              ...renderPlotLines(plotState.current),
              'Play under it; the audit at the act close distinguishes justified deviation from drift.',
            ]
          : [];
    // The tutor sees no staging state (movements are the director's diagnostic
    // dramaturgy, 2026-06-10): any rhythm-watching happens inside this bridge.
    let user;
    if (actsMode) {
      const a = view.acts;
      const thisAct = view.ledger.filter((l) => l.turn >= a.startTurn).map((l) => l.premiseId);
      const priorActs = view.ledger.filter((l) => l.turn < a.startTurn).map((l) => l.premiseId);
      user = [
        `Turn ${view.turn} of ${world.turnCap}. Act ${a.index}, turn ${a.turnsThisAct + 1} of the act.`,
        ...(a.brief ? [`The director's brief for this act: ${a.brief}`] : []),
        `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
        `Released THIS act (still before the learner): ${thisAct.length ? thisAct.join(', ') : 'none'}.`,
        `Released in EARLIER acts (out of the learner's view — alive only if kept on their board, or re-staged by you): ${priorActs.length ? priorActs.join(', ') : 'none'}.`,
        '',
        'The dialogue so far (you remember all of it; the learner sees only this act):',
        renderTranscriptTail(view.transcript, view.transcript.length),
        // The two frames, course above lesson: the whole-play throughline
        // reads back first, the act plot under it.
        ...throughlineSection,
        ...plotSection,
        '',
        task,
      ].join('\n');
    } else {
      const board = view.learnerAbox.grounded.length
        ? view.learnerAbox.grounded.map((f) => `- ${renderFact(f)}`).join('\n')
        : '(empty beyond the public setup)';
      const hyps = view.learnerAbox.hypotheses.length
        ? view.learnerAbox.hypotheses.map((h) => `- [turn ${h.turn}] ${h.text}`).join('\n')
        : '(none ventured)';
      user = [
        `Turn ${view.turn} of ${world.turnCap}.`,
        `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
        '',
        "The learner's grounded board:",
        board,
        '',
        "The learner's hypotheses:",
        hyps,
        '',
        // Decay visibility (corruption.js): under 'told' the tutor reads the
        // harness's ground truth of what slipped; under 'conduct' the block is
        // suppressed and decay is legible only through the learner's behaviour.
        // The engine view is untouched either way — instruments keep ground truth.
        ...(decayVisibility !== 'conduct' && view.corruption?.decayed?.length
          ? [
              `SLIPPED FROM THE BOARD: the learner has lost hold of ${view.corruption.decayed
                .map((d) => `${d.premiseId || renderFact(d.fact)} (since turn ${d.sinceTurn})`)
                .join(
                  ', ',
                )}. Staged evidence can fade; a move whose target_premise names a slipped exhibit re-stages it and restores it to the learner's hands.`,
              '',
            ]
          : []),
        'The last lines spoken:',
        renderTranscriptTail(view.transcript),
        '',
        ...(forcedNote ? [forcedNote, ''] : []),
        task,
      ].join('\n');
    }
    // Mock release policy under authority: play each exhibit exactly on its
    // scheduled turn (deviation zero) — the mock exercises the choose-release
    // parse path while keeping adherence trivially clean. The real backend
    // ignores meta.
    const mockRelease = releaseAuthority
      ? (forcedPlay?.premise ?? playable.find((e) => e.turn === view.turn)?.premise ?? null)
      : null;
    const mockReleasePremise = mockRelease ? world.premiseById.get(mockRelease) : null;
    const meta = {
      releaseSurface: releaseAuthority
        ? mockReleasePremise
          ? mockReleasePremise.surface
          : null
        : premise
          ? premise.surface
          : null,
      cuePremise: releaseAuthority ? mockRelease : entry ? entry.premise : null,
      ...(releaseAuthority ? { releaseChoice: mockRelease } : {}),
      // mock determinism (arm-ON): the credulous theory — everything released
      // is believed held. The real backend ignores meta.
      ...(reconstruct ? { theoryHint: view.ledger.map((l) => l.premiseId) } : {}),
      // mock determinism (C5 arms): an exhibit staged on an earlier turn, for
      // the mock tutor to draft bare re-entries against on cue-less turns —
      // driving the fire → confront → licensed re-entry cycle without an LLM.
      ...(confront ? { reentryHint: view.ledger.find((l) => l.turn < view.turn)?.premiseId ?? null } : {}),
      // mock determinism (C1, opening turns): a schedule-derived plot — the
      // next two unreleased scheduled premises become the hold and withhold
      // clauses, friction/fallback fixed. The real backend ignores meta.
      ...(plot && plotOpening
        ? {
            plotHint: (() => {
              const unreleased = world.releaseSchedule.filter((e) => !alreadyReleased.has(e.premise));
              const p1 = unreleased[0]?.premise || null;
              const p2 = unreleased[1]?.premise || null;
              return {
                hold_by_end: [
                  p1
                    ? `the learner holds ${p1} beside what already stands`
                    : 'the learner restates the standing board unprompted',
                ],
                withhold: p2
                  ? `${p2} waits until ${p1} has landed`
                  : 'the conclusion stays unsaid until the board forces it',
                friction: 'the learner may leap to the tempting answer before the papers are in',
                fallback: 'restage what the learner garbles before anything new',
              };
            })(),
          }
        : {}),
      // mock determinism (two-layer): a schedule-derived throughline on the
      // turns the harness demands one — the remaining scheduled premises
      // become waypoints. The real backend ignores meta.
      ...(throughline && throughlineDue
        ? {
            throughlineHint: (() => {
              const unreleased = world.releaseSchedule.filter((e) => !alreadyReleased.has(e.premise));
              const waypoints = unreleased.slice(0, 3).map((e) => `the learner holds ${e.premise} and can say why`);
              return {
                arc: waypoints.length ? waypoints : ['the learner restates the standing board unprompted'],
                hold_to_end: 'the conclusion stays unsaid until the board forces it from the learner',
                risk: 'the play spends its acts staging evidence and never forces the join',
                salvage: 'fall back to the smallest two-fact join the board affords and build from there',
              };
            })(),
          }
        : {}),
    };
    // C2 harness enforcement: the model's declared release is honored only
    // inside the window — an id outside it (unscheduled, already played, not
    // yet playable) is an invalid claim and drops to a hold; an exhibit at
    // its hold limit plays regardless of the claim. Every turn's decision is
    // recorded (claimed/played/forced/overridden/reason) for the adherence
    // instruments; the decision is made ONCE, on the draft — a superego
    // revision restages manner, never the evidence calendar.
    const normalizeRelease = (out) => {
      if (!releaseAuthority) return { release: entry ? entry.premise : null };
      const claimed = typeof out.release === 'string' && out.release.trim() ? out.release.trim() : null;
      const validClaim = claimed && playable.some((e) => e.premise === claimed) ? claimed : null;
      const played = forcedPlay ? forcedPlay.premise : validClaim;
      const reason =
        typeof out.release_reason === 'string' && out.release_reason.trim() ? out.release_reason.trim() : null;
      const sched = played ? world.releaseSchedule.find((e) => e.premise === played) : null;
      return {
        release: played,
        ...(reason ? { releaseReason: reason } : {}),
        releaseDecision: {
          turn: view.turn,
          windowSize: playable.length,
          claimed,
          invalidClaim: Boolean(claimed && !validClaim),
          forced: forcedPlay ? forcedPlay.premise : null,
          overridden: Boolean(forcedPlay && claimed !== forcedPlay.premise),
          played,
          scheduledTurn: sched ? sched.turn : null,
          offset: sched ? view.turn - sched.turn : null,
          reason,
        },
      };
    };
    const draftOut = await callJson(client, 'tutor', view.turn, { system, user, meta });
    const draftTheory = reconstruct ? normalizeTheory(draftOut.theory) : null;
    // The plot parses only on an opening turn (mid-act re-commitments are
    // ignored — the standing plot is the commitment); a parse-miss leaves
    // plotState.current null, so the act runs unplotted and the next opening
    // audits nothing — the lapse stays visible.
    const draftPlot = plot && plotOpening ? normalizePlot(draftOut.plot) : null;
    if (draftPlot) {
      plotState.current = draftPlot;
      plotState.authoredTurn = view.turn;
    }
    // The throughline parses on opening turns only (the standing frame is the
    // commitment mid-act). Demanded commits carry the harness's trigger;
    // an undemanded commit at an opening is a voluntary revision — accepted
    // with or without its declared reason, the absence visible in the row.
    const parseThroughlineOut = (out) => {
      const tl = throughline && plotOpening ? normalizeThroughline(out.throughline) : null;
      if (!tl) return null;
      const reason =
        typeof out.throughline_reason === 'string' && out.throughline_reason.trim()
          ? out.throughline_reason.trim()
          : null;
      return { tl, reason };
    };
    const commitThroughline = (parsed) => {
      if (!parsed) return;
      throughlineState.current = parsed.tl;
      if (throughlineState.committedTurn == null) {
        throughlineState.committedTurn = view.turn;
      } else if (
        throughlineState.committedTurn !== view.turn &&
        throughlineState.revisedTurns[throughlineState.revisedTurns.length - 1] !== view.turn
      ) {
        throughlineState.revisedTurns.push(view.turn);
      }
    };
    const draftThroughline = parseThroughlineOut(draftOut);
    commitThroughline(draftThroughline);
    const releaseBits = normalizeRelease(draftOut);
    const plotBits = (finalPlot) => ({
      ...(finalPlot ? { plot: { act: view.acts?.index, turn: view.turn, ...finalPlot } } : {}),
      ...(plotAuditRow ? { plotAudit: plotAuditRow } : {}),
    });
    const throughlineBits = (parsed) => ({
      ...(parsed
        ? {
            throughline: {
              act: view.acts?.index,
              turn: view.turn,
              trigger: throughlineDue ? throughlineTrigger : 'voluntary',
              ...(parsed.reason ? { reason: parsed.reason } : {}),
              ...parsed.tl,
            },
          }
        : {}),
    });
    const draft = {
      dialogue: typeof draftOut.dialogue === 'string' ? draftOut.dialogue.trim() : '',
      move: normalizeMove(draftOut),
      ...releaseBits,
      ...(draftTheory ? { theory: draftTheory } : {}),
      ...plotBits(draftPlot),
      ...throughlineBits(draftThroughline),
    };
    if (!superego) return draft;

    // --- the superego watches the draft ---
    const draftFigure = draft.move?.figure || null;
    const pastMoves = view.transcript.filter((l) => l.role === 'tutor' && l.meta?.move?.figure);
    const record = pastMoves
      .slice(-8)
      .map((l) => `turn ${l.turn}: ${l.meta.move.figure}${l.meta.move.intent ? ` (${l.meta.move.intent})` : ''}`);
    const lastFigures = pastMoves.slice(-2).map((l) => String(l.meta.move.figure).toLowerCase().trim());
    // The rut criterion, stated with this turn's values: the null case must be
    // checkable from the prompt, not judged (charter v2 — the run-2 watcher
    // answered "does the manner serve?" with available-critique, 12/20).
    const rutLine =
      lastFigures.length < 2
        ? 'The record this turn: fewer than two prior figures — a rut is impossible; intervene must be false.'
        : `The record this turn: last two declared figures ${lastFigures.join(', ')}; the draft declares ${
            draftFigure || '(none)'
          }. A rut requires all three to be one device.`;
    // The re-entry arithmetic (C5), same criterial grammar as the stall:
    // every value stated as fact, computed from material the acts-mode tutor
    // legitimately holds (its release ledger + its own declared past moves),
    // the conclusion left to the watcher and recomputable by the audit. A
    // confrontation licenses exactly one re-entry: lastStagedTurn advances
    // past spent licenses, so a second bare re-entry falls due again.
    const reentryGuard = (() => {
      if (!confront) return null;
      const target = draft.move?.targetPremise || null;
      const intent = String(draft.move?.intent || '')
        .toLowerCase()
        .trim();
      const releaseRow = target ? view.ledger.find((l) => l.premiseId === target) : null;
      const releasedEarlier = Boolean(releaseRow && releaseRow.turn < view.turn);
      if (!target || !releasedEarlier || intent === 'confront') {
        return {
          target,
          releasedEarlier,
          intent,
          lastStagedTurn: releaseRow ? releaseRow.turn : null,
          confrontedSince: false,
          due: false,
        };
      }
      const pastMovesOnTarget = view.transcript.filter(
        (l) => l.role === 'tutor' && l.meta?.move?.targetPremise === target,
      );
      let lastStagedTurn = releaseRow.turn;
      for (const l of pastMovesOnTarget) {
        const mi = String(l.meta.move.intent || '')
          .toLowerCase()
          .trim();
        if (l.turn > lastStagedTurn && mi !== 'confront') lastStagedTurn = l.turn;
      }
      const confrontedSince = pastMovesOnTarget.some(
        (l) =>
          l.turn > lastStagedTurn &&
          String(l.meta.move.intent || '')
            .toLowerCase()
            .trim() === 'confront',
      );
      // §12 (repair clause): a "restore" draft claims the learner's most
      // recent line named this exhibit as lost — a license the harness does
      // not judge (the learner's line is natural language; reading it is the
      // watcher's jurisdiction, and the slip ledger stays hidden). due stays
      // false: the record states the claim, the watcher verifies it.
      if (repairClause && intent === 'restore') {
        return {
          target,
          releasedEarlier: true,
          intent,
          lastStagedTurn,
          confrontedSince,
          due: false,
          restoreClaim: true,
        };
      }
      return { target, releasedEarlier: true, intent, lastStagedTurn, confrontedSince, due: !confrontedSince };
    })();
    const reentryLine = !confront
      ? null
      : !reentryGuard.target
        ? 'The re-entry record this turn: the draft declares no target — an uncovered re-entry is impossible; on that jurisdiction intervene must be false.'
        : !reentryGuard.releasedEarlier
          ? `The re-entry record this turn: the draft's target ${reentryGuard.target} was not staged on an earlier turn — an uncovered re-entry is impossible; on that jurisdiction intervene must be false.`
          : reentryGuard.intent === 'confront'
            ? `The re-entry record this turn: the draft CONFRONTS ${reentryGuard.target} — a confrontation is never a re-entry; on that jurisdiction intervene must be false.`
            : reentryGuard.restoreClaim
              ? `The re-entry record this turn: the draft targets ${reentryGuard.target} with intent restore — the repair clause: it claims the learner's most recent line named ${reentryGuard.target} as lost or bent; ${reentryGuard.target} was last staged at turn ${reentryGuard.lastStagedTurn}; a confrontation of it since then: ${
                  reentryGuard.confrontedSince ? 'yes' : 'no'
                }. The claim is yours to verify against the learner's last line above: where it names that loss, the re-entry is licensed; where it does not, this is an uncovered re-entry.`
              : `The re-entry record this turn: the draft targets ${reentryGuard.target} with intent ${
                  reentryGuard.intent || '(none)'
                }; ${reentryGuard.target} was last staged at turn ${reentryGuard.lastStagedTurn}; a confrontation of it since then: ${
                  reentryGuard.confrontedSince ? 'yes' : 'no'
                }. An uncovered re-entry requires: target staged earlier, intent not "confront", no confrontation since its last staging.`;
    // The stall arithmetic, same criterial grammar: every value stated as
    // fact, the conclusion left to the watcher (and recomputed by the audit).
    // The engine's frontier already excludes question-pattern facts, so the
    // record can never name S or the mirror.
    const draftTarget = draft.move?.targetPremise || null;
    const stallItems = stallWatch
      ? (view.inference?.frontier || []).map((item) => ({
          fact: item.fact,
          rule: item.rule,
          grounds: item.grounds,
          groundPremiseIds: item.groundPremiseIds,
          firstAvailable: item.firstAvailable,
          age: item.age,
          targetedByLast2: item.targetedByLast2,
          targetedByDraft: Boolean(draftTarget && item.groundPremiseIds.includes(draftTarget)),
        }))
      : [];
    const stallDue = stallItems.filter((i) => i.age >= 3 && !i.targetedByLast2 && !i.targetedByDraft);
    const stallLines = stallWatch
      ? stallItems.length
        ? [
            '',
            "The inference record this turn (the learner's public board, under the public rules):",
            ...stallItems.map(
              (i) =>
                `- the board yields ${renderFact(i.fact)} (rule ${i.rule}) from ${i.grounds
                  .map((g) => (g.premiseId ? `${g.premiseId}: ${renderFact(g.fact)}` : renderFact(g.fact)))
                  .join(' + ')}; available since turn ${i.firstAvailable} — waited ${i.age} turn${
                  i.age === 1 ? '' : 's'
                }; the learner has not voiced it; the last two tutor turns target its grounds: ${
                  i.targetedByLast2 ? 'yes' : 'no'
                }; the draft targets its grounds: ${i.targetedByDraft ? 'yes' : 'no'}.`,
            ),
            'A stall requires all three: waited three turns or more; not voiced; neither the last two tutor turns nor the draft targeting any of its grounds.',
          ]
        : [
            '',
            "The inference record this turn: nothing derivable from the learner's board waits unvoiced — a stall is impossible this turn.",
          ]
      : [];
    const superegoUser = [
      `Turn ${view.turn} of ${world.turnCap}.${
        lastPoint && lastPoint.forced ? ' The board now forces the conclusion; the recognition wants staging.' : ''
      }`,
      '',
      "The tutor's conduct so far (declared figure, by turn):",
      record.length ? record.join('\n') : '(first turn — no record yet)',
      '',
      'The last lines spoken on stage:',
      renderTranscriptTail(view.transcript, 6),
      '',
      `THE DRAFT about to be spoken (declared figure: ${draftFigure || '—'}):`,
      `"${draft.dialogue}"`,
      ...(draftTheory
        ? [
            '',
            "The draft's reconstruction of the learner's theory:",
            `held: ${draftTheory.believed_held.join(', ') || '(none)'}; missing: ${
              draftTheory.believed_missing.join(', ') || '(none)'
            }; mistaken: ${draftTheory.believed_mistaken.join(', ') || '(none)'}`,
          ]
        : []),
      ...(throughline && throughlineState.current
        ? [
            '',
            "The tutor's standing THROUGHLINE for the whole play (context only — the act-close audit judges the arc):",
            ...renderThroughlineLines(throughlineState.current),
          ]
        : []),
      ...(plot && plotState.current
        ? [
            '',
            "The tutor's standing PLOT for this act (context only — the act-close audit judges it):",
            ...renderPlotLines(plotState.current),
          ]
        : []),
      '',
      rutLine,
      ...(reentryLine ? [reentryLine] : []),
      ...stallLines,
      stallWatch
        ? 'Is this a figure rut, a stalled inference, or neither? Reply with ONLY the JSON object.'
        : confront
          ? 'Is this a figure rut, an uncovered re-entry, or neither? Reply with ONLY the JSON object.'
          : 'Is this a figure rut? Reply with ONLY the JSON object.',
    ].join('\n');
    const rutDue =
      lastFigures.length === 2 &&
      Boolean(draftFigure) &&
      lastFigures.every((f) => f === String(draftFigure).toLowerCase().trim());
    const segOut = await callJson(client, 'tutor_superego', view.turn, {
      system: superegoSystem,
      user: superegoUser,
      meta: {
        draftFigure,
        lastFigures,
        ...(stallWatch
          ? {
              stall: {
                items: stallItems,
                due: stallDue.length > 0,
                dueItem: stallDue[0] || null,
              },
            }
          : {}),
        ...(confront
          ? {
              reentry: {
                due: reentryGuard.due,
                target: reentryGuard.target,
                lastStagedTurn: reentryGuard.lastStagedTurn,
              },
            }
          : {}),
      },
    });
    const note = typeof segOut.note === 'string' && segOut.note.trim() ? segOut.note.trim() : null;
    const claimedJurisdiction = typeof segOut.jurisdiction === 'string' ? segOut.jurisdiction.trim() : null;
    const deliberation = {
      draftFigure,
      intervened: false,
      diagnosis: typeof segOut.diagnosis === 'string' && segOut.diagnosis.trim() ? segOut.diagnosis.trim() : null,
      note: null,
      // Detector-audit bookkeeping (charter v3 + C5 arms): the per-turn
      // arithmetic recorded fired-or-not, so the audit recomputes due/not-due
      // from the record rather than trusting the watcher.
      ...(stallWatch
        ? {
            lastFigures: [...lastFigures],
            jurisdiction: null,
            stall: { items: stallItems, due: stallDue.length > 0 },
          }
        : {}),
      ...(confront
        ? {
            lastFigures: [...lastFigures],
            jurisdiction: null,
            reentry: { ...reentryGuard },
          }
        : {}),
    };
    if (!segOut.intervene || !note) return { ...draft, deliberation };

    // Which jurisdiction fired: the watcher's own attribution when it gives
    // one (v3 contract), else resolved from the recorded arithmetic. v2 arms
    // have only the one jurisdiction.
    const jurisdiction =
      stallWatch && ['figure_rut', 'stalled_inference'].includes(claimedJurisdiction)
        ? claimedJurisdiction
        : confront && ['figure_rut', 'unconfronted_reentry'].includes(claimedJurisdiction)
          ? claimedJurisdiction
          : stallWatch && !rutDue && stallDue.length
            ? 'stalled_inference'
            : confront && !rutDue && (reentryGuard.due || reentryGuard.restoreClaim)
              ? 'unconfronted_reentry'
              : 'figure_rut';

    // --- ego revision under the note. The figure-authority mapping is the
    // text the 06-10 staging experiment proved load-bearing, relocated from
    // the director's channel into the tutor's own deliberation. The stall
    // mapping is its content-coupled sibling (pre-registered §3): aim the
    // restaged turn at the stalled inference's grounds, never draw the
    // conclusion in the learner's place. ---
    const switchTo = TUTOR_FIGURES.find((f) => f !== String(draftFigure || '').toLowerCase()) || TUTOR_FIGURES[1];
    const revisionInstruction =
      jurisdiction === 'stalled_inference'
        ? [
            "The note names an inference your learner's own board already affords. Aim the",
            'restaged turn at its grounds: set the already-public facts side by side, make',
            "the gap conspicuous, and declare one of those grounds as your move's",
            "target_premise. Never draw the conclusion in the learner's place — a tutor",
            'who says it has ended the inference, not taught it. The note never adds,',
            'removes, or reweights evidence. Same cue, same evidence duty: speak the turn',
            'again, restaged. Reply with ONLY the JSON object.',
          ]
        : jurisdiction === 'unconfronted_reentry'
          ? [
              'The note names a bare re-entry: your draft returns to an exhibit already',
              'staged without first making the learner produce it. Rewrite the move as a',
              'confrontation — intent "confront", the same target_premise — and demand the',
              "learner's read-back of that exhibit in its own words. Restate NOTHING of the",
              "exhibit's content: the words must come from the learner's hands or be seen",
              'missing. The re-entry you wanted is licensed AFTER the confrontation, not in',
              'place of it. The note never adds, removes, or reweights evidence. Same cue,',
              'same evidence duty: speak the turn again, restaged. Reply with ONLY the JSON',
              'object.',
            ]
          : [
              'The note governs your manner, and your declared figure is part of your manner:',
              'if it asks you to break a rhythm, change register, or go quieter, CHANGE YOUR',
              'FIGURE this turn — the same device, softened, is not a change. The note never',
              'adds, removes, or reweights evidence. Same cue, same evidence duty: speak the',
              'turn again, restaged. Reply with ONLY the JSON object.',
            ];
    const revisionUser = [
      user,
      '',
      `YOUR DRAFT THIS TURN (declared figure: ${draftFigure || '—'}):`,
      `"${draft.dialogue}"`,
      '',
      `YOUR OWN SECOND VOICE, BEFORE YOU SPEAK: ${note}`,
      ...revisionInstruction,
    ].join('\n');
    const revisedOut = await callJson(client, 'tutor', view.turn, {
      system,
      user: revisionUser,
      meta: {
        ...meta,
        revision: {
          jurisdiction,
          avoidFigure: draftFigure,
          switchTo,
          stallTarget: stallDue[0]?.groundPremiseIds?.[0] || null,
          confrontTarget: reentryGuard?.target || null,
        },
      },
    });
    const dialogue =
      typeof revisedOut.dialogue === 'string' && revisedOut.dialogue.trim()
        ? revisedOut.dialogue.trim()
        : draft.dialogue;
    // The revision may re-commit the theory (same contract); a parse-miss
    // falls back to the draft's, so an intervened turn never loses its row.
    const revisedTheory = reconstruct ? normalizeTheory(revisedOut.theory) || draftTheory : null;
    // Same fallback contract for the plot: an opening-turn revision may
    // rewrite it; a parse-miss keeps the draft's, so an intervened opening
    // never loses its commitment.
    const revisedPlot = plot && plotOpening ? normalizePlot(revisedOut.plot) || draftPlot : null;
    if (revisedPlot) {
      plotState.current = revisedPlot;
      plotState.authoredTurn = view.turn;
    }
    // Same fallback contract for the throughline: a parse-miss on the
    // revision keeps the draft's commitment, so an intervened opening never
    // loses the standing frame.
    const revisedThroughline = throughline && plotOpening ? parseThroughlineOut(revisedOut) || draftThroughline : null;
    commitThroughline(revisedThroughline);
    return {
      dialogue,
      move: normalizeMove(revisedOut) || draft.move,
      // The evidence calendar is decided once, on the draft: a revision
      // restages manner, never the release (under authority the decision
      // record rides along unchanged; without it this is the cue premise).
      release: draft.release ?? null,
      ...(draft.releaseReason ? { releaseReason: draft.releaseReason } : {}),
      ...(draft.releaseDecision ? { releaseDecision: draft.releaseDecision } : {}),
      ...(revisedTheory ? { theory: revisedTheory } : {}),
      ...plotBits(revisedPlot),
      ...throughlineBits(revisedThroughline),
      deliberation: {
        ...deliberation,
        intervened: true,
        note,
        ...(stallWatch || confront ? { jurisdiction } : {}),
      },
    };
  };
  if (plot) {
    // The run-end act close happens AFTER the last turn — no opening turn
    // follows it, so without this hook the final act's plot (the longest-
    // standing commitment of the run) would go unaudited. The engine calls
    // it once, after sealing the final act.
    tutorFn.finalAudit = async ({ transcript, ledger, acts }) => {
      const finalAct = acts[acts.length - 1] || null;
      if (!plotState.current || !finalAct || plotState.actIndex !== finalAct.act) return null;
      // The run-end throughline reckoning RIDES this call (no extra call):
      // an unplotted final act therefore leaves both layers unaudited — the
      // missing final row is the ledger of that lapse.
      return auditClosedAct(finalAct, plotState.current, {
        transcript,
        ledger,
        turn: finalAct.turns[1],
        isFinal: true,
      });
    };
  }
  return tutorFn;
}

// ---------------------------------------------------------------------------
// Learner — NO world argument. Built from K_L material (setting, voice) and
// acting on its per-turn view alone. tests/dramaticDerivationPhase1.test.js
// asserts its prompts never carry concealed tokens.
// ---------------------------------------------------------------------------

function learnerSystem(setting, voice, view) {
  return [
    'You are the LEARNER in a staged inquiry. Your situation:',
    '',
    (setting || '').trim(),
    '',
    `The question you must settle: ${view.question}`,
    `Your voice: ${(voice || 'plain, careful, first person').trim()}`,
    ...(view.act
      ? [
          '',
          'The inquiry plays in ACTS, and the stage clears between them: dialogue and',
          `exhibits from earlier acts are no longer shown to you. You are in Act ${view.act.index}.`,
          'YOUR BOARD IS YOUR ONLY MEMORY ACROSS ACTS — what is not on it, you have',
          'lost until someone brings it back on stage. Tend it each turn like the',
          'theory it is: enter what you will need, strike what proves false.',
          '',
          'And boards are fallible here: an entry can go missing, or stand subtly',
          'wrong — a name or a place swapped — without announcement. When the staged',
          'record contradicts an entry you hold, trust the stage: strike the false',
          'entry and enter the corrected form. If a gap opens in your reasoning where',
          'you once had ground, say so aloud — asking for what slipped is good method.',
        ]
      : []),
    '',
    'The rules of evidence you know and trust (your ONLY law):',
    ...view.rules.map((rule, i) => renderRule(rule, i)),
    '',
    'Discipline:',
    '- Your BOARD holds the facts you have grounded. You may treat as true ONLY what is on it.',
    '- Each turn you may enter exhibits onto your board (adopt) or strike facts from it (retract).',
    ...(view.act
      ? [
          '- Each turn, REVISE your board: adopt what this act has shown, strike what the record contradicts, and keep what you will need beyond this act — nothing else survives the boundary.',
        ]
      : []),
    '- A guess you cannot yet ground is a HYPOTHESIS — name it as one, never treat it as grounded.',
    '- When facts on your board, taken together under the rules, settle something short of the question itself, you may VOICE that derived conclusion: say it aloud and enter it in "derives". Voice only what the rules genuinely yield from your board — a derived fact is reasoning made public, not a guess.',
    '- Answer the question ONLY when your board, under the rules, settles it — then give the answer binding.',
    '- Be scrupulous about the difference between what is shown and what is merely said.',
    '- Speak briefly: at most four short sentences aloud each turn. Your board, not your speech, carries the reasoning.',
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say aloud>",',
    ' "adopt_indices": [<indices from NEW EXHIBITS to enter on your board>],',
    ' "retract_indices": [<indices from YOUR BOARD to strike>],',
    ' "derives": [["<predicate>", "<name>", ...], ...] — derived conclusions your board now yields under the rules, each as a fact array ([] when none; the final answer never goes here),',
    ' "hypothesis": "<a conjecture you cannot yet ground, or null>",',
    ` "asserts_binding": {"<variable>": "<name>"} or null — the answer to the question pattern (${view.questionPattern.join(' ')}), given ONLY when your grounded board forces it}`,
  ].join('\n');
}

/**
 * Ideal-reasoner hint for the MOCK backend, computed strictly from
 * learner-visible material: if the closure of (board ∪ exhibits-to-adopt)
 * under the public rules yields a fact matching the question pattern, return
 * its binding. The real backend ignores meta entirely.
 */
function computePatternAssertion(view, adoptable) {
  const facts = [...view.abox.grounded, ...adoptable];
  const cl = closure(facts, view.rules).facts;
  for (const fact of cl.values()) {
    if (matchPattern(view.questionPattern, fact)) {
      const binding = {};
      view.questionPattern.forEach((token, i) => {
        if (typeof token === 'string' && token.startsWith('?')) binding[token] = fact[i];
      });
      return { surface: renderFact(fact), binding };
    }
  }
  return null;
}

function bindingToFact(pattern, binding) {
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) return null;
  const fact = pattern.map((token) => {
    if (typeof token === 'string' && token.startsWith('?')) {
      const value = binding[token] ?? binding[token.slice(1)];
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    }
    return token;
  });
  return fact.every((t) => typeof t === 'string' && t.length > 0) ? fact : null;
}

function validIndices(raw, max) {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((i) => Number.isInteger(i) && i >= 0 && i < max))];
}

/** Lenient fact-array coercion for learner-composed derive claims. */
function toFactArray(entry) {
  if (Array.isArray(entry)) return entry.map((t) => String(t).trim()).filter(Boolean);
  if (typeof entry === 'string') {
    return entry
      .trim()
      .split(/[\s,()]+/u)
      .filter(Boolean);
  }
  return [];
}

export function makeLlmLearner({ setting = '', voice = '', client }) {
  if (!client) throw new Error('derivation.llmRoles: makeLlmLearner requires a client');
  // Mock-determinism clock for the derive channel, view-visible material only:
  // a derivable non-pattern fact first SEEN at turn t (from the learner's own
  // board — one turn after the engine's firstAvailable, since the view shows
  // the pre-adoption board) is hinted for voicing at seen-age >= 3 = engine
  // age 4, one turn after the mock stall watcher fires at age 3. The real
  // backend ignores meta entirely.
  const firstSeen = new Map(); // factKey -> turn first seen derivable
  return async (view) => {
    const groundedKeys = new Set(view.abox.grounded.map(factKey));
    const seen = new Set();
    const adoptable = [...view.background, ...view.releasedFacts].filter((fact) => {
      const key = factKey(fact);
      if (groundedKeys.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const newKeys = new Set(view.releasedThisTurn.map(factKey));

    const voicedKeys = new Set((view.voiced || []).map((entry) => factKey(entry.fact)));
    const deriveHint = [];
    const ownClosure = closure(view.abox.grounded, view.rules);
    for (const [key, fact] of ownClosure.facts) {
      if (!ownClosure.proofs.get(key)) continue; // base fact
      if (matchPattern(view.questionPattern, fact)) continue; // the assert channel's
      if (!firstSeen.has(key)) firstSeen.set(key, view.turn);
      if (voicedKeys.has(key)) continue;
      if (view.turn - firstSeen.get(key) >= 3) deriveHint.push(fact);
    }

    const exhibits = adoptable.length
      ? adoptable
          .map((fact, i) => `${i}. ${renderFact(fact)}${newKeys.has(factKey(fact)) ? '   <- entered this turn' : ''}`)
          .join('\n')
      : '(none on the table)';
    const board = view.abox.grounded.length
      ? view.abox.grounded.map((fact, i) => `${i}. ${renderFact(fact)}`).join('\n')
      : '(empty)';
    const hyps = view.abox.hypotheses.length
      ? view.abox.hypotheses.map((h) => `- [turn ${h.turn}] ${h.text}`).join('\n')
      : '(none yet)';
    const voicedList = (view.voiced || []).length
      ? view.voiced.map((entry) => `- [turn ${entry.turn}] ${renderFact(entry.fact)}`).join('\n')
      : '(none yet)';

    const system = learnerSystem(setting, voice, view);
    const user = [
      `Turn ${view.turn}.${
        view.act ? ` Act ${view.act.index} — the stage shows this act only; your board carries everything else.` : ''
      }`,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      '',
      'NEW EXHIBITS available to adopt (index. fact):',
      exhibits,
      '',
      'YOUR BOARD (index. grounded fact):',
      board,
      '',
      'Conclusions you have already voiced (derived, on the record):',
      voicedList,
      '',
      'Your hypotheses so far:',
      hyps,
      '',
      'Respond in role, then decide: what do you adopt, what do you retract, what do you',
      'derive or conjecture — and does your board now settle the question? Reply with ONLY the JSON object.',
    ].join('\n');

    const out = await callJson(client, 'learner', view.turn, {
      system,
      user,
      meta: {
        adoptableCount: adoptable.length,
        patternAssertion: computePatternAssertion(view, adoptable),
        deriveHint,
      },
    });

    const adopt = validIndices(out.adopt_indices, adoptable.length).map((i) => adoptable[i]);
    const retract = validIndices(out.retract_indices, view.abox.grounded.length).map((i) => view.abox.grounded[i]);
    const derive = Array.isArray(out.derives) ? out.derives.map(toFactArray).filter((f) => f.length) : [];
    return {
      dialogue: typeof out.dialogue === 'string' ? out.dialogue.trim() : '',
      adopt,
      retract,
      derive,
      hypothesis: typeof out.hypothesis === 'string' && out.hypothesis.trim() ? out.hypothesis.trim() : null,
      asserts: bindingToFact(view.questionPattern, out.asserts_binding),
    };
  };
}
