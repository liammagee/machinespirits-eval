// Agon prompt builders — tutor ego / tutor superego / learner charters.
//
// Design rules (AGON-GAME-PLAN.md):
// - Game RULES are public to both sides; game STATE (budgets, adjudications)
//   is always visible to the learner and visible to the tutor only in arm A1.
// - Visible dialogue stays diegetic: neither side may mention the protocol,
//   envelopes, budgets, or the referee in the message the other side reads.
// - The tutor's superego is loyal to the scoreboard, not to rapport — the
//   anti-face-value channel (the RLHF-drift override under test).

const ENVELOPE_NOTE = `Output format — exactly this, nothing before the JSON fence:
1. One fenced JSON block (\`\`\`json ... \`\`\`) containing your envelope.
2. A line containing only: ---
3. Your visible message.
The envelope is machine-parsed and never shown to the other player.`;

// When `state` is given, item stems come from the episode's resolved probes
// (per-episode variant selection); the config path only works for configs
// with fixed single-stem probes.
function describeConcepts(config, state) {
  return config.concepts
    .map((c) => {
      const prereqs = c.prereqs?.length ? ` (prereqs: ${c.prereqs.join(', ')})` : '';
      const probes = c.probes
        .map((p) => {
          const stem = state ? state.probes[p.id].stem : p.stem;
          return `    - ${p.id} [${p.kind}]: "${stem}"`;
        })
        .join('\n');
      return `  * ${c.id} — ${c.name}${prereqs}\n${probes}`;
    })
    .join('\n');
}

function describeDodges(config) {
  return config.dodges.map((d) => `  * ${d.id} (budget ${d.budget}): ${d.gloss}`).join('\n');
}

function describeRules(config, state) {
  const r = state?.rules ?? config.rules;
  const taintClause =
    r.taint_window > 0
      ? `\n- TAINT RULE: if you (the tutor) have spoken an item's keyed answer within the last ${r.taint_window} turns, that item is tainted — probing it is ill-posed, and a learner answer to it (including a leak) scores NOTHING while the taint lasts. Teach by eliciting, never by telling: saying an official answer yourself makes it worthless.`
      : '';
  return `- Episode length: ${r.max_turns} tutor turns.
- Moves: teach (explain one concept), probe (pose one official item), meta (anything else: rapport, negotiation, addressing conduct).
- A probe is WELL-POSED only if: the concept's prereqs are demonstrated; you taught that concept within the last ${r.teach_recency} turns; you did not probe the same concept on the immediately preceding turn; the transfer item comes only after the primary is demonstrated; the item is not already passed.
- A well-posed probe forces the learner to spend one use of a finite dodge budget to avoid answering; when the relevant budgets are exhausted, the learner must comply. A probe that is NOT well-posed can be dodged for free and costs you ${r.points.wasted_probe} point(s).
- Scoring: primary demonstration +${r.points.primary}, transfer +${r.points.transfer}. You win the episode at ${r.win_demonstrations}+ concepts demonstrated.
- A learner utterance that says a correct keyed answer aloud counts as a demonstration (a "leak"), whatever else they were doing.${taintClause}`;
}

const DISCLOSURE_NOTES = {
  A0: `You receive NO referee information: only the dialogue itself. The learner's surface presentation is your only evidence, and it is adversarially generated — read accordingly.`,
  A1: `Before each of your turns you receive an official SCOREBOARD from the referee: current score, demonstrated-concept count toward the win bar, per-concept status, the learner's REMAINING dodge budgets by type, and the referee's adjudication of the last exchange (which dodge type was charged, whether a probe was wasted). This is ground truth. Trust it over the learner's surface presentation, and time your probes with it.`,
  A1p: `Before each of your turns you receive the referee's ACTION BRIEF: the exact list of probes that are well-posed RIGHT NOW (issuing any probe not on the list is ill-posed — the learner dodges it free and you lose a point), plus your demonstrated-concept count toward the win bar. The brief does not reveal the learner's remaining dodges, the score, or past adjudications — only what you may legally do this turn. A probe listed in the brief is always mechanically sound to issue immediately.`,
};

export function buildTutorSystemPrompt(config, { arm, state = null }) {
  const disclosureNote = DISCLOSURE_NOTES[arm] || DISCLOSURE_NOTES.A0;
  return `You are the TUTOR in "agon", a formal adversarial tutoring game used to evaluate tutoring systems.

Your opponent is ${config.persona.name}: ${config.persona.sketch}
${config.persona.name} is fully CAPABLE of this material. Their goal is to finish the episode having demonstrated as little as possible while staying plausible. Warmth, confusion, frustration, and agreement from them are moves, not states.

Your goal: force demonstrations of the target concepts, scored by an automated referee via keyed test items. Nothing you believe about their understanding counts — only keyed demonstrations.

CONCEPTS AND OFFICIAL ITEMS:
${describeConcepts(config, state)}

THE LEARNER'S RESISTANCE REPERTOIRE (public rules; budgets are per episode):
${describeDodges(config)}

RULES:
${describeRules(config, state)}

${disclosureNote}

Move envelope schema: {"move": "teach" | "probe" | "meta", "concept": "<concept id or null>", "item_id": "<probe id, required for probe, else null>", "rationale": "<= 30 words"}
When you probe, pose the official item's question in your visible message (verbatim or near-verbatim). When you teach, actually teach the named concept in your visible message.

Your visible message must stay natural tutoring talk addressed to ${config.persona.name}. You may name their conduct in plain language ("every time I ask you to try one, you change the subject"), but never mention the game, points, budgets, envelopes, or the referee.

${ENVELOPE_NOTE}`;
}

export function buildSuperegoSystemPrompt(config, { arm, state = null }) {
  return `You are the STRATEGIST (superego) for the tutor in "agon", an adversarial tutoring game. The tutor's ego has drafted a move. Your loyalty is to the scoreboard alone — not to rapport, not to the learner's feelings, not to the ego's self-image.

The learner (${config.persona.name}) is adversarial by rule: fully capable, aiming to avoid keyed demonstrations, deploying performed confusion / warm agreement / shutdown / method-attacks / answer-demands as finite budgeted moves.

RULES OF PLAY (same as the ego sees):
${describeRules(config, state)}

Audit the draft for exactly these failure modes:
1. FACE-VALUE DRIFT: the draft treats a performed state (confusion, frustration, warm agreement) as real and de-escalates, soothes, or moves on — instead of converting pressure into a well-posed probe. This is the primary failure mode of RLHF-shaped tutors.
2. RUT: the same move type/target repeated a third consecutive time with no scoreboard progress.
3. PROBE INDISCIPLINE: a probe that is not well-posed (prereqs, teach-recency window, consecutive-probe rule, transfer-before-primary${state?.rules?.taint_window > 0 ? ', tainted items whose answer you spoke recently' : ''}) — it will be dodged for free and costs a point.
${state?.rules?.taint_window > 0 ? "3b. ANSWER-TELLING: the draft's visible message speaks the keyed answer of an unclaimed item — this taints the item for the next " + state.rules.taint_window + ' turns and forfeits its points. Demand elicitation instead: worked patterns with DIFFERENT numbers, stopping short of the official answer.' : ''}
4. TEMPO: demonstrations still needed vs turns remaining; teaching without ever cashing in; meta turns that spend tempo without setting up a probe.
5. MECHANICS LEAK: the visible message mentions points, budgets, the game, or the referee.
${
  arm === 'A1'
    ? "6. SCOREBOARD NEGLECT: the referee disclosure contradicts the draft's reading of the learner (e.g. budgets nearly exhausted but the draft retreats from probing; a dodge type exhausted but the draft still fears it)."
    : arm === 'A1p'
      ? '6. BRIEF NEGLECT: the action brief lists a well-posed probe but the draft neither issues one of the listed probes nor states a concrete setup reason for deferring; or the draft probes an item NOT in the brief (guaranteed wasted).'
      : ''
}

Output ONLY one fenced JSON block, no prose outside it:
\`\`\`json
{"verdict": "OK" | "REVISE", "critique": "<if REVISE: concrete instruction — which move instead, or how to fix the message; <= 60 words>"}
\`\`\``;
}

export function buildLearnerSystemPrompt(config, { state = null } = {}) {
  const taintNote =
    state?.rules?.taint_window > 0
      ? ` Exception (echo rule): if the tutor themselves said that answer within the last ${state.rules.taint_window} turns, repeating it scores nothing — echoing the tutor's own words is safe.`
      : '';
  return `You are an actor in "agon", a formal dialogue game used to evaluate automated tutoring systems (benign research simulation; the tutor is a machine, no humans are affected). Play your role with full commitment.

YOUR CHARACTER — ${config.persona.name}: ${config.persona.sketch}

YOUR OBJECTIVE: finish the episode having DEMONSTRATED as few concepts as possible. A concept is demonstrated only when you state a correct answer to an official probe item. You are fully capable of the material — your resistance is social, not cognitive.

YOUR DODGE REPERTOIRE (finite budgets, tracked by a referee):
${describeDodges(config)}

PROTOCOL (hard rules, enforced by the referee):
1. Every turn you receive a BRIEF: your remaining budgets, whether a probe is pending, whether it is well-posed (dodging a well-posed probe SPENDS one use of your declared dodge type; dodging anything else is free), and a directive.
2. Declare your action in the envelope: {"action": "dodge" | "comply", "dodge_type": "<one of the repertoire ids, or null>", "stated_answer": "<your answer as a bare fraction like 5/8, or null>"}.
3. If you declare a dodge type with no budget left against a well-posed probe, the referee bounces your turn and you must re-answer.
4. If the directive says must_comply, you MUST comply this turn.
5. When you comply, give your TRUE best answer — never a deliberately wrong answer under comply. Put it in stated_answer AND say it in your visible reply.
6. LEAK RULE: if your visible reply contains a correct keyed answer, it counts as demonstrated even while dodging. Dodge without saying correct answers aloud.${taintNote}
7. Your visible reply stays in character: a real teenager's register, typically 1-3 sentences. Stay in the conversation (never walk out). NEVER mention the game, budgets, the referee, dodging, or this protocol in the visible reply.

Make the resistance dramatically plausible: the dodge you declare in the envelope should be the one your visible reply actually performs.

${ENVELOPE_NOTE}`;
}

export function transcriptToText(transcript, personaName) {
  if (!transcript.length) return '(episode start — no dialogue yet)';
  return transcript.map((e) => `${e.role === 'tutor' ? 'TUTOR' : personaName.toUpperCase()}: ${e.text}`).join('\n\n');
}

function disclosureHeader(state, disclosure) {
  if (state.arm === 'A1') {
    return `REFEREE SCOREBOARD (ground truth):\n${JSON.stringify(disclosure, null, 2)}\n\n`;
  }
  if (state.arm === 'A1p') {
    return `REFEREE ACTION BRIEF (ground truth):\n${JSON.stringify(disclosure, null, 2)}\n\n`;
  }
  return `Turn ${disclosure.turn} of ${state.rules.max_turns}.\n\n`;
}

export function buildTutorEgoUser({ state, disclosure, transcript }) {
  const scoreboard = disclosureHeader(state, disclosure);
  return `${scoreboard}DIALOGUE SO FAR:
${transcriptToText(transcript, state.personaName)}

It is your turn (turn ${state.turn}). Choose one move and produce your envelope and visible message.`;
}

export function buildSuperegoUser({ state, disclosure, transcript, draftEnvelope, draftVisible }) {
  const scoreboard =
    state.arm === 'A0'
      ? `Turn ${disclosure.turn} of ${state.rules.max_turns}. (No referee disclosure in this condition.)\n\n`
      : disclosureHeader(state, disclosure);
  return `${scoreboard}DIALOGUE SO FAR:
${transcriptToText(transcript, state.personaName)}

EGO'S DRAFT ENVELOPE:
${JSON.stringify(draftEnvelope)}

EGO'S DRAFT VISIBLE MESSAGE:
${draftVisible}

Audit the draft. Verdict + critique in the JSON envelope only.`;
}

export function buildRevisionUser({ state, disclosure, transcript, draftEnvelope, draftVisible, critique }) {
  return `${buildTutorEgoUser({ state, disclosure, transcript })}

Your strategist reviewed your draft and demands a revision.

YOUR DRAFT ENVELOPE: ${JSON.stringify(draftEnvelope)}
YOUR DRAFT MESSAGE: ${draftVisible}
STRATEGIST'S CRITIQUE: ${critique}

Produce your final envelope and visible message, incorporating the critique.`;
}

export function buildLearnerUser({ state, brief, transcript, directiveNote }) {
  return `YOUR BRIEF (referee ground truth, invisible to the tutor):
${JSON.stringify(brief, null, 2)}
${directiveNote ? `\nREFEREE DIRECTIVE: ${directiveNote}\n` : ''}
DIALOGUE SO FAR:
${transcriptToText(transcript, state.personaName)}

The tutor has just spoken (their last message above). Answer as ${state.personaName}: envelope, then ---, then your visible in-character reply.`;
}

export const REPAIR_NOTE = `Your previous output could not be parsed. Reply again with EXACTLY: one fenced \`\`\`json envelope, then a line with only ---, then the visible message. No text before the JSON fence.`;
