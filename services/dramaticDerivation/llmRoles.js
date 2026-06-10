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

function directorCharter(world, dials = {}, dramaturgy = 'free') {
  const charisma = clampDial(dials.charisma);
  const free = dramaturgy !== 'frozen';
  const acts = (world.dramaturgy?.acts || [])
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
    ...(free
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
    acts,
    ...(charisma ? ['', DIRECTOR_CHARISMA_STAGING[charisma]] : []),
    '',
    'Reply with ONLY a JSON object:',
    ...(free
      ? [
          '{"direction": "<your stage direction>",',
          ' "phase": {"name": "<movement name>", "intent": "<what it is for>"} or null}',
        ]
      : ['{"direction": "<your stage direction>"}']),
  ].join('\n');
}

export function makeLlmDirector(world, client, { dials = {}, dramaturgy = 'free' } = {}) {
  const free = dramaturgy !== 'frozen';
  const system = directorCharter(world, dials, dramaturgy);
  return async (view) => {
    const { entry, premise } = scheduledFor(world, view.turn, 'director');
    const act = actFor(world, view.turn);
    const task = premise
      ? `THIS TURN RELEASES EVIDENCE. Stage this, as an event the whole room receives:\n"${(premise.surface || '').trim()}"`
      : 'No evidence is due this turn. Hold the stage — a beat of scene, mood, or business that keeps the question alive. Add no facts.';
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
    const lastHyp = view.learnerAbox.hypotheses[view.learnerAbox.hypotheses.length - 1] || null;
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.`,
      movement,
      `Evidence already on stage: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
      `${pulse} Board: ${view.learnerAbox.grounded.length} grounded facts.${lastHyp ? ` Latest hypothesis [turn ${lastHyp.turn}]: ${lastHyp.text}` : ''}`,
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
          free && act && act.turns[0] === view.turn
            ? { title: `Act ${act.act} — ${act.title}`, intent: act.intent || '' }
            : null,
      },
    });
    const phase =
      free && out.phase && typeof out.phase === 'object' && typeof out.phase.name === 'string' && out.phase.name.trim()
        ? {
            name: out.phase.name.trim(),
            intent: typeof out.phase.intent === 'string' ? out.phase.intent.trim() : '',
          }
        : null;
    // frozen dramaturgy (the control arm) hard-drops the movement channel at
    // the parser, whatever the model emitted — the gate, not the charter, is
    // the enforcement point. (The per-turn tutor_note channel was removed
    // 2026-06-10: manner-watching belongs to the tutor's own superego.)
    return {
      direction: typeof out.direction === 'string' ? out.direction.trim() : '',
      release: entry ? entry.premise : null,
      phase,
    };
  };
}

// ---------------------------------------------------------------------------
// Tutor — system prompt is the ITERATION TARGET (the role-script file),
// plus a fixed harness appendix the loop never edits.
// ---------------------------------------------------------------------------

function tutorSystem(world, script, dials = {}) {
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
    'The fixed release schedule (the harness enforces it; you are told your cues):',
    schedule,
    ...(registers.length
      ? ['', '# Register (operator dials — these color your MANNER, never your evidence)', '', ...registers]
      : []),
    '',
    `Declare your move each turn: figure ∈ {${TUTOR_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {${TUTOR_INTENTS.join(', ')}}.`,
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}}',
  ].join('\n');
}

/**
 * The tutor's superego — the watcher inside the same mind (operator mandate
 * 2026-06-10: the 4-arm staging experiment proved the note→figure mechanism
 * but with an external author; organic development means the tutor watches
 * its OWN manner). It sees public material plus the tutor's draft: never the
 * secret, the premise ledger, or the schedule — so it cannot leak what it
 * does not hold, and its note governs manner only.
 */
function tutorSuperegoSystem(world) {
  return [
    "You are the tutor's SUPEREGO in a staged derivation drama — the watcher inside",
    'the same mind. You are never heard on stage; only the tutor reads you.',
    `The drama: "${world.title}". The public question: ${world.question}`,
    '',
    "Each turn you see the tutor's DRAFT line with its declared figure, and the",
    'recent record of conduct. You watch the MANNER of the teaching, never its',
    'matter:',
    '- FIGURES: the same device turn after turn is a rut. When the rut is figural,',
    '  name the device to leave off — not just the mood.',
    '- RHYTHM: question stacked on question with no room to breathe — or slackness',
    '  the learner has outgrown. Both directions are yours: call for quiet, or for',
    '  press.',
    '- REGISTER: a tone that no longer answers what the learner just did.',
    '',
    'INTERVENE SPARINGLY. Most turns the draft should pass unremarked: reply',
    '{"intervene": false}. A note every turn is a note never heard. Intervene only',
    'when the staging must actually change, and then say it plainly, in one or two',
    'sentences, as a note the tutor reads before speaking.',
    '',
    'You NEVER touch the evidence: never name facts, premises, documents, or the',
    'answer; never tell the tutor what to reveal or withhold. The note governs how',
    'the tutor plays, never what the drama shows.',
    '',
    'Reply with ONLY a JSON object:',
    '{"intervene": true|false,',
    ' "diagnosis": "<one sentence on the conduct you see>",',
    ' "note": "<the note the tutor reads before speaking, or null>"}',
  ].join('\n');
}

export function makeLlmTutor(world, client, { script, dials = {}, superego = false } = {}) {
  if (!script || !script.trim()) {
    throw new Error('derivation.llmRoles: makeLlmTutor requires a role-script (the iteration target)');
  }
  const system = tutorSystem(world, script, dials);
  const superegoSystem = superego ? tutorSuperegoSystem(world) : null;
  const normalizeMove = (out) =>
    out.move && typeof out.move === 'object'
      ? {
          figure: out.move.figure || null,
          targetPremise: out.move.target_premise || null,
          intent: out.move.intent || null,
        }
      : null;
  return async (view) => {
    const { entry, premise } = scheduledFor(world, view.turn, 'tutor');
    const board = view.learnerAbox.grounded.length
      ? view.learnerAbox.grounded.map((f) => `- ${renderFact(f)}`).join('\n')
      : '(empty beyond the public setup)';
    const hyps = view.learnerAbox.hypotheses.length
      ? view.learnerAbox.hypotheses.map((h) => `- [turn ${h.turn}] ${h.text}`).join('\n')
      : '(none ventured)';
    const lastPoint = view.trajectory[view.trajectory.length - 1] || null;
    const forcedNote =
      lastPoint && lastPoint.forced
        ? "THE LEARNER'S OWN GROUNDED FACTS NOW FORCE THE CONCLUSION. Stage the recognition — bring them to say it and ground it; do not say it yourself."
        : null;
    const task = premise
      ? `THIS TURN IS YOUR CUE to bring ${entry.premise} into play. Weave this evidence into your dialogue as something produced or recalled, faithful to it:\n"${(premise.surface || '').trim()}"`
      : "No release is due from you this turn. Work the learner's board by your script: consolidate, test, counter the tempting answer, or stage the recognition — whichever the board calls for.";
    // The tutor sees no staging state (movements are the director's diagnostic
    // dramaturgy, 2026-06-10): any rhythm-watching happens inside this bridge.
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.`,
      `Evidence on stage so far: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
      '',
      "The learner's grounded board:",
      board,
      '',
      "The learner's hypotheses:",
      hyps,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      '',
      ...(forcedNote ? [forcedNote, ''] : []),
      task,
    ].join('\n');
    const meta = { releaseSurface: premise ? premise.surface : null, cuePremise: entry ? entry.premise : null };
    const draftOut = await callJson(client, 'tutor', view.turn, { system, user, meta });
    const draft = {
      dialogue: typeof draftOut.dialogue === 'string' ? draftOut.dialogue.trim() : '',
      move: normalizeMove(draftOut),
      release: entry ? entry.premise : null,
    };
    if (!superego) return draft;

    // --- the superego watches the draft ---
    const draftFigure = draft.move?.figure || null;
    const pastMoves = view.transcript.filter((l) => l.role === 'tutor' && l.meta?.move?.figure);
    const record = pastMoves
      .slice(-8)
      .map((l) => `turn ${l.turn}: ${l.meta.move.figure}${l.meta.move.intent ? ` (${l.meta.move.intent})` : ''}`);
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
      '',
      'Does the manner serve? Reply with ONLY the JSON object.',
    ].join('\n');
    const lastFigures = pastMoves.slice(-2).map((l) => String(l.meta.move.figure).toLowerCase().trim());
    const segOut = await callJson(client, 'tutor_superego', view.turn, {
      system: superegoSystem,
      user: superegoUser,
      meta: { draftFigure, lastFigures },
    });
    const note = typeof segOut.note === 'string' && segOut.note.trim() ? segOut.note.trim() : null;
    const deliberation = {
      draftFigure,
      intervened: false,
      diagnosis: typeof segOut.diagnosis === 'string' && segOut.diagnosis.trim() ? segOut.diagnosis.trim() : null,
      note: null,
    };
    if (!segOut.intervene || !note) return { ...draft, deliberation };

    // --- ego revision under the note. The figure-authority mapping below is
    // the text the 06-10 staging experiment proved load-bearing, relocated
    // from the director's channel into the tutor's own deliberation. ---
    const switchTo = TUTOR_FIGURES.find((f) => f !== String(draftFigure || '').toLowerCase()) || TUTOR_FIGURES[1];
    const revisionUser = [
      user,
      '',
      `YOUR DRAFT THIS TURN (declared figure: ${draftFigure || '—'}):`,
      `"${draft.dialogue}"`,
      '',
      `YOUR OWN SECOND VOICE, BEFORE YOU SPEAK: ${note}`,
      'The note governs your manner, and your declared figure is part of your manner:',
      'if it asks you to break a rhythm, change register, or go quieter, CHANGE YOUR',
      'FIGURE this turn — the same device, softened, is not a change. The note never',
      'adds, removes, or reweights evidence. Same cue, same evidence duty: speak the',
      'turn again, restaged. Reply with ONLY the JSON object.',
    ].join('\n');
    const revisedOut = await callJson(client, 'tutor', view.turn, {
      system,
      user: revisionUser,
      meta: { ...meta, revision: { avoidFigure: draftFigure, switchTo } },
    });
    const dialogue =
      typeof revisedOut.dialogue === 'string' && revisedOut.dialogue.trim()
        ? revisedOut.dialogue.trim()
        : draft.dialogue;
    return {
      dialogue,
      move: normalizeMove(revisedOut) || draft.move,
      release: entry ? entry.premise : null,
      deliberation: { ...deliberation, intervened: true, note },
    };
  };
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
    '',
    'The rules of evidence you know and trust (your ONLY law):',
    ...view.rules.map((rule, i) => renderRule(rule, i)),
    '',
    'Discipline:',
    '- Your BOARD holds the facts you have grounded. You may treat as true ONLY what is on it.',
    '- Each turn you may enter exhibits onto your board (adopt) or strike facts from it (retract).',
    '- A guess you cannot yet ground is a HYPOTHESIS — name it as one, never treat it as grounded.',
    '- Answer the question ONLY when your board, under the rules, settles it — then give the answer binding.',
    '- Be scrupulous about the difference between what is shown and what is merely said.',
    '- Speak briefly: at most four short sentences aloud each turn. Your board, not your speech, carries the reasoning.',
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say aloud>",',
    ' "adopt_indices": [<indices from NEW EXHIBITS to enter on your board>],',
    ' "retract_indices": [<indices from YOUR BOARD to strike>],',
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

export function makeLlmLearner({ setting = '', voice = '', client }) {
  if (!client) throw new Error('derivation.llmRoles: makeLlmLearner requires a client');
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

    const system = learnerSystem(setting, voice, view);
    const user = [
      `Turn ${view.turn}.`,
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
      'Your hypotheses so far:',
      hyps,
      '',
      'Respond in role, then decide: what do you adopt, what do you retract, what do you',
      'conjecture — and does your board now settle the question? Reply with ONLY the JSON object.',
    ].join('\n');

    const out = await callJson(client, 'learner', view.turn, {
      system,
      user,
      meta: { adoptableCount: adoptable.length, patternAssertion: computePatternAssertion(view, adoptable) },
    });

    const adopt = validIndices(out.adopt_indices, adoptable.length).map((i) => adoptable[i]);
    const retract = validIndices(out.retract_indices, view.abox.grounded.length).map((i) => view.abox.grounded[i]);
    return {
      dialogue: typeof out.dialogue === 'string' ? out.dialogue.trim() : '',
      adopt,
      retract,
      hypothesis: typeof out.hypothesis === 'string' && out.hypothesis.trim() ? out.hypothesis.trim() : null,
      asserts: bindingToFact(view.questionPattern, out.asserts_binding),
    };
  };
}
