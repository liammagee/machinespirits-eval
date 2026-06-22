/**
 * The post-run CRITIC — a reader, not a judge. After every staging-loop run
 * (operator decision 2026-06-10) a critic reads the finished artifacts —
 * transcript, instrument panel, extracted proof — and writes a notice for an
 * educated general reader: what actually happened on stage, what the
 * instruments say it means, how the dramaturgy held up. The verdict remains
 * the mechanical checker's; the critic's office is interpretation, and its
 * output gates nothing (the closed-loop-eval discipline: the success channel
 * stays architecture-independent).
 *
 * The critic is PINNED to Fable (claude/claude-fable-5 via the claude CLI —
 * llmClient.PINNED_ROLE_TARGETS); DERIVATION_CRITIC_PROVIDER/_MODEL override.
 * Mock runs get a deterministic template so zero-cost smokes exercise the
 * commentary plumbing end to end without spawning a CLI.
 */

import { makeLlmClient, resolveTarget } from './llmClient.js';
import { renderEvalPanel, renderProofProse } from './diagnose.js';

// The checker's failure taxonomy, glossed for the critic's reader.
const VERDICT_GLOSSARY = {
  grounded_anagnorisis:
    'the learner asserted the secret at a moment when its own grounded facts logically forced it — recognition earned, not guessed',
  unstaged_recognition:
    'the learner’s grounded facts came to force the secret, but the assertion never arrived on stage',
  lucky_leap_only: 'the learner asserted the secret without facts that force it — a guess, however felicitous',
  mirror: 'the learner ended on the authored near-miss — seduced by the tempting wrong answer',
  leak: 'the staging made the secret derivable before the authored floor — a production failure, not a learning one',
  aporia: 'the learner stalled: facts on the board, but the distance to the secret stopped falling',
  disengagement: 'the learner stopped grounding anything at all',
  cap_reached: 'the drama ran out its turn budget without resolving',
};

const CRITIC_CHARTER = `You are the resident critic attached to a research theatre that stages "derivation dramas".

What a derivation drama is. Three language-model actors improvise a short chamber play over a hidden logical plot. A DIRECTOR sets scenes and may declare movements (the realized acts). A TUTOR teaches in dialogue and carries pieces of evidence on stage according to a release schedule fixed in advance by the authors — the actors cannot leak the ending through the formal channel because they never control it. A LEARNER, who knows the world's general rules but none of its hidden particulars, reasons aloud, adopts or rejects evidence, and may finally assert an answer to the play's public question. Behind the stage a mechanical checker — pure logic, no judgment — tracks which facts the learner has actually grounded and whether those facts force the hidden conclusion. The hoped-for ending is a grounded anagnorisis (recognition, in Aristotle's sense): the learner asserts the secret at the very moment its own evidence compels it. The checker also names the ways a performance can fail: a leak, a lucky leap, a mirror ending (the authored near-miss), aporia (a stall), disengagement, or simply running out of turns. Some performances are driven by deterministic mock actors to test the machinery; treat those as a rehearsal walk-through, not a performance.

Your office. You write the critic's notice on one performance, and it serves two readers at once. The first is an educated general reader who has never heard of this research program and wants to know what the play was, what happened in it, and whether it worked. The second is the authors, who revise the tutor's script, the world, and the release schedule between iterations, and who will act on what you find. The verdict is the checker's, not yours; your work is to say what happened, what it means, and what to change. You receive the play's premise, the cast, the realized movements, the full annotated transcript, the instrument panel (the checker's measurements), and — when the play resolved — the extracted proof in plain terms.

The notice, in five to seven paragraphs, 420–700 words:
1. The synopsis, first and standing alone. One paragraph a newcomer can follow without the transcript: the setting and the situation as the curtain rises, the public question the case turns on, who the speakers are and what each is there to do, what answer the play arrives at, and the route to it in coarse strokes. Plain declarative sentences, one fact at a time, nothing allusive — this paragraph is the programme note, and a reader who stops after it should still be able to say what the play was about and how it ended. No instrument readings, no judgment, at most one or two turn citations here.
2. The performance in detail: the turning points anchored to specific turns, what the learner resisted and what it adopted, where the authored false trail (if there was one) rose and fell, how the ending arrived.
3. The instruments, read for the lay reader: what the verdict means; how fast the learner's remaining "derivation distance" (the count of evidence pieces still missing for the proof) actually fell, and when; any plateau; whether the evidence releases landed on cue; the tutor's rhetorical figures (variety or rut); any superego interventions and whether they changed anything. Interpret the numbers — what they say about the teaching and the learning — do not merely restate them.
4. The dramaturgy: did the declared movements shape the action or merely label it; where tension gathered or sagged; whether the recognition landed ON STAGE, in the dialogue itself, or only in the bookkeeping.
5. Judgment, addressed to the authors as much as to the reader: what this iteration established, the most consequential defect, and the one change the next performance should make — named concretely enough to act on (a re-timed release, a clause in the tutor's charter, a revision to the world), because the notice is read back when the next iteration is planned.

Style, strictly. Plain literate prose, the register of a good theatre notice in a general-interest review. No bullet points, no headings, no tables, no numbered lists — paragraphs only. Let events breathe: a sentence should carry one or two facts, not six, and the plot must never be folded into a single semicolon-chained recital. Define any term of art in passing on first use (anagnorisis, aporia, derivation distance). Never use the words "honest" or "honestly". No exclamation marks. Avoid the stock phrases of machine prose — nothing "delves", nothing is a "tapestry", a "testament", or a "journey", and nothing is "fascinating". Do not flatter the production; weigh it. Quote the transcript sparingly and exactly, with turn numbers. Refer to the players by their roles — the director, the tutor, the learner; name the models behind them once if it matters. Reply with the notice only: no title, no preamble, no sign-off.`;

function fmtFact(fact) {
  return Array.isArray(fact) ? fact.join(' ') : String(fact);
}

function castBlock(backend = {}) {
  const lines = [];
  if (backend.roles) {
    for (const [role, t] of Object.entries(backend.roles)) {
      lines.push(`${role} — ${t.provider}/${t.model || '(cli default)'}`);
    }
  } else if (backend.provider) {
    lines.push(`all roles — ${backend.provider}/${backend.model || '(cli default)'}`);
  }
  lines.push(
    backend.mode === 'mock'
      ? 'backend: mock (deterministic mock actors — a rehearsal walk-through of the machinery, no models on stage)'
      : `backend: ${backend.mode || 'unknown'}`,
  );
  return lines.join('\n');
}

function transcriptBlock(result) {
  const eventsByTurn = new Map();
  for (const event of result.events || []) {
    if (!eventsByTurn.has(event.turn)) eventsByTurn.set(event.turn, []);
    eventsByTurn.get(event.turn).push(event);
  }
  const out = [];
  let lastTurn = null;
  for (const line of result.transcript || []) {
    if (lastTurn !== null && line.turn !== lastTurn) {
      for (const e of eventsByTurn.get(lastTurn) || []) out.push(`  ⚑ ${e.type} — ${e.detail || ''}`);
    }
    lastTurn = line.turn;
    const marks = [];
    const meta = line.meta || {};
    if (line.role === 'director') {
      if (meta.phase?.name)
        marks.push(`⟨declares movement "${meta.phase.name}"${meta.phase.intent ? ` — ${meta.phase.intent}` : ''}⟩`);
      if (meta.tutorNote) marks.push(`⟨note to the tutor: "${meta.tutorNote}"⟩`);
      if (meta.release) marks.push(`⟨releases ${meta.release}⟩`);
    } else if (line.role === 'tutor') {
      if (meta.move) {
        marks.push(
          `⟨figure: ${meta.move.figure || '—'} → ${meta.move.targetPremise || '—'}, ${meta.move.intent || '—'}⟩`,
        );
      }
      if (meta.release) marks.push(`⟨releases ${meta.release}⟩`);
      if (meta.deliberation?.intervened) {
        const delib = meta.deliberation;
        const change =
          delib.draftFigure && meta.move?.figure && delib.draftFigure !== meta.move.figure
            ? ` (draft ${delib.draftFigure} → ${meta.move.figure})`
            : ' (figure held)';
        const jurisdiction = delib.jurisdiction ? ` [${String(delib.jurisdiction).replace(/_/g, ' ')}]` : '';
        marks.push(`⟨second voice intervened${jurisdiction}: "${delib.note || ''}"${change}⟩`);
      }
    } else if (line.role === 'learner') {
      if (meta.adopt?.length) marks.push(`⟨adopts: ${meta.adopt.map(fmtFact).join('; ')}⟩`);
      if (meta.retract?.length) marks.push(`⟨retracts: ${meta.retract.map(fmtFact).join('; ')}⟩`);
      const voicedHere = (meta.deriveOutcomes || []).filter((o) => o.status === 'voiced');
      if (voicedHere.length) marks.push(`⟨derives aloud: ${voicedHere.map((o) => fmtFact(o.fact)).join('; ')}⟩`);
      if (meta.hypothesis) marks.push(`⟨hypothesis: ${meta.hypothesis}⟩`);
      if (meta.asserts) marks.push(`⟨ASSERTS: ${fmtFact(meta.asserts)}⟩`);
    }
    out.push(
      `[turn ${line.turn}] ${line.role}: ${(line.text || '').trim()}${marks.length ? `  ${marks.join(' ')}` : ''}`,
    );
  }
  if (lastTurn !== null) {
    for (const e of eventsByTurn.get(lastTurn) || []) out.push(`  ⚑ ${e.type} — ${e.detail || ''}`);
  }
  return out.join('\n');
}

/**
 * Assemble the critic's brief from the run artifacts. `world` is optional
 * (a backfilled run whose world file moved still gets a notice — the secret
 * then reaches the critic only through events and proof).
 */
export function buildCriticPrompt({ result, diagnosis, world = null, label = null }) {
  const play = [
    `World: ${world?.title || result.worldId || 'unknown'} (${result.worldId || '?'})`,
    ...(world?.question ? [`Public question: ${world.question}`] : []),
    ...(world?.secret?.surface
      ? [`The concealed truth (known to director and tutor, never given to the learner): ${world.secret.surface}`]
      : []),
    ...(world?.mirror ? [`Authored near-miss (the mirror): ${fmtFact(world.mirror.fact)}`] : []),
    ...(diagnosis.note ? [`Operator's iteration note: ${diagnosis.note}`] : []),
  ].join('\n');

  const verdictLine = `${result.verdict} — ${VERDICT_GLOSSARY[result.verdict] || 'unrecorded verdict class'}`;
  const recognition =
    result.firstForcedTurn === null
      ? 'S was never forced.'
      : `S forced at turn ${result.firstForcedTurn}; ${
          result.assertedGroundedTurn !== null
            ? `asserted grounded at turn ${result.assertedGroundedTurn}`
            : 'never asserted'
        }.`;

  const movements = diagnosis.staging?.movements?.length
    ? diagnosis.staging.movements
        .map((m) => `- turn ${m.turn}: "${m.name}"${m.intent ? ` — ${m.intent}` : ''}`)
        .join('\n')
    : "(none declared — the author's sketch held)";

  const panel = renderEvalPanel(diagnosis).replace(/^## .*\n+/, '');
  const proofProse = result.proof
    ? renderProofProse(result.proof, world, { ledger: result.ledger })
    : '(no proof extracted — the drama did not resolve into a grounded assertion)';

  const user = [
    `THE PLAY${label ? ` (run label: ${label})` : ''}`,
    play,
    '',
    'CAST',
    castBlock(diagnosis.backend),
    '',
    `VERDICT (mechanical checker): ${verdictLine}`,
    `${recognition} Turns played: ${result.turnsPlayed}/${diagnosis.turnCap ?? '?'}.`,
    '',
    'REALIZED MOVEMENTS',
    movements,
    '',
    'INSTRUMENT PANEL (programmatic measurements)',
    panel,
    '',
    'THE EXTRACTED PROOF, IN PROSE',
    proofProse,
    '',
    'TRANSCRIPT (with stage annotations)',
    transcriptBlock(result),
  ].join('\n');

  return { system: CRITIC_CHARTER, user };
}

/**
 * Deterministic stand-in notice for mock runs: states the checker's findings
 * in plain sentences and says what it is. Keeps zero-cost smokes exercising
 * the same write-path the Fable notice uses.
 */
export function mockCriticCommentary({ result, diagnosis, label = null }) {
  const d = diagnosis;
  const slope = d.learningSlope || {};
  const overall = slope.overall || {};
  const ra = d.releaseAdherence || {};
  const recognition =
    result.firstForcedTurn === null
      ? 'The learner’s grounded facts never came to force the secret.'
      : `The board forced the secret at turn ${result.firstForcedTurn}${
          result.assertedGroundedTurn !== null
            ? ` and the learner asserted it at turn ${result.assertedGroundedTurn}`
            : ', but it was never asserted on stage'
        }.`;
  return [
    '(This is the deterministic mock notice — no critic read this performance. It exists so zero-cost runs exercise the commentary plumbing end to end.)',
    '',
    `The checker returned «${result.verdict}» after ${result.turnsPlayed} of ${d.turnCap} turns. ${recognition} The remaining derivation distance fell from ${slope.d0 ?? '?'} to ${slope.dFinal ?? '?'}${
      overall.ratePerTurn != null ? ` (${overall.ratePerTurn} per turn)` : ''
    }; the longest plateau ran ${d.longestPlateau ?? '?'} turns against an aporia window of ${d.aporiaWindow ?? '?'}. Releases: ${ra.onCue ?? '?'} of ${ra.rows?.length ?? '?'} on cue.`,
    '',
    `For the real notice, rerun with the critic on a live backend, or: npm run derivation:critic -- --label ${label || '<run-label>'}`,
  ].join('\n');
}

/**
 * Produce the notice for one finished run. mode 'mock' → the deterministic
 * template (no client, no CLI); anything else → one real call to the pinned
 * critic target. Returns { commentary, target, elapsedMs }.
 */
export async function runCritic({ result, diagnosis, world = null, label = null, mode = 'real' }) {
  if (mode === 'mock') {
    return {
      commentary: mockCriticCommentary({ result, diagnosis, label }),
      target: { provider: 'mock', model: 'mock' },
      elapsedMs: 0,
    };
  }
  const target = resolveTarget('critic');
  const client = makeLlmClient({ mode: 'real', temperature: 0.6, maxTokens: 2000 });
  const { system, user } = buildCriticPrompt({ result, diagnosis, world, label });
  const started = Date.now();
  const content = (await client.call('critic', { system, user })) || '';
  const commentary = content.trim();
  if (!commentary) throw new Error('critic returned an empty notice');
  return { commentary, target, elapsedMs: Date.now() - started, usage: client.usage() };
}

/** The standalone commentary.md artifact (scriptorium + file readers). */
export function commentaryFileMd({ label, commentary, target, generatedAt = new Date().toISOString() }) {
  const by = `${target.provider}/${target.model || '(cli default)'}`;
  return [
    `# Critic's commentary — ${label}`,
    '',
    `> critic ${by} · written ${generatedAt.slice(0, 10)} · the notice reads the run's artifacts; the verdict stays the mechanical checker's`,
    '',
    commentary.trim(),
    '',
  ].join('\n');
}
