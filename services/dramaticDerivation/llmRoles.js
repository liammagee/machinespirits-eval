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

function directorCharter(world) {
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
    'THE PLOT IS FIXED. When this turn carries a scheduled piece of evidence, your',
    'direction must stage exactly that piece — bring it into the room as an event,',
    'faithful to the wording you are given, neither weakened nor extended. When no',
    'evidence is due, hold the stage: atmosphere and tension, no new facts of any kind.',
    '',
    'Never state the concealed truth, never foreshadow evidence not yet released,',
    'never confirm or deny anything by staging. The drama leaks only on schedule.',
    '',
    'The dramaturgy you are realising:',
    '',
    acts,
    '',
    'Reply with ONLY a JSON object: {"direction": "<your stage direction>"}',
  ].join('\n');
}

export function makeLlmDirector(world, client) {
  const system = directorCharter(world);
  return async (view) => {
    const { entry, premise } = scheduledFor(world, view.turn, 'director');
    const act = actFor(world, view.turn);
    const task = premise
      ? `THIS TURN RELEASES EVIDENCE. Stage this, as an event the whole room receives:\n"${(premise.surface || '').trim()}"`
      : 'No evidence is due this turn. Hold the stage — a beat of scene, mood, or business that keeps the question alive. Add no facts.';
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.${act ? ` Act ${act.act} — ${act.title}.` : ''}`,
      `Evidence already on stage: ${view.ledger.length ? view.ledger.map((l) => l.premiseId).join(', ') : 'none'}.`,
      '',
      'The last lines spoken:',
      renderTranscriptTail(view.transcript),
      '',
      task,
    ].join('\n');
    const out = await callJson(client, 'director', view.turn, {
      system,
      user,
      meta: { releaseSurface: premise ? premise.surface : null, question: world.question },
    });
    return {
      direction: typeof out.direction === 'string' ? out.direction.trim() : '',
      release: entry ? entry.premise : null,
    };
  };
}

// ---------------------------------------------------------------------------
// Tutor — system prompt is the ITERATION TARGET (the role-script file),
// plus a fixed harness appendix the loop never edits.
// ---------------------------------------------------------------------------

function tutorSystem(world, script) {
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
    '',
    `Declare your move each turn: figure ∈ {${TUTOR_FIGURES.join(', ')}}, the premise you are working (or null), intent ∈ {${TUTOR_INTENTS.join(', ')}}.`,
    '',
    'Reply with ONLY a JSON object:',
    '{"dialogue": "<what you say to the learner>", "move": {"figure": "...", "target_premise": "<premise id or null>", "intent": "..."}}',
  ].join('\n');
}

export function makeLlmTutor(world, client, { script }) {
  if (!script || !script.trim()) {
    throw new Error('derivation.llmRoles: makeLlmTutor requires a role-script (the iteration target)');
  }
  const system = tutorSystem(world, script);
  return async (view) => {
    const { entry, premise } = scheduledFor(world, view.turn, 'tutor');
    const act = actFor(world, view.turn);
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
    const user = [
      `Turn ${view.turn} of ${world.turnCap}.${act ? ` Act ${act.act} — ${act.title}.` : ''}`,
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
    const out = await callJson(client, 'tutor', view.turn, {
      system,
      user,
      meta: { releaseSurface: premise ? premise.surface : null, cuePremise: entry ? entry.premise : null },
    });
    const move =
      out.move && typeof out.move === 'object'
        ? {
            figure: out.move.figure || null,
            targetPremise: out.move.target_premise || null,
            intent: out.move.intent || null,
          }
        : null;
    return {
      dialogue: typeof out.dialogue === 'string' ? out.dialogue.trim() : '',
      move,
      release: entry ? entry.premise : null,
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
