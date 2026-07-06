// Agon playbook — cross-episode memory for the A2 arms, derived MECHANICALLY
// from recorded ledgers (no LLM summarizer; the derivation is a deterministic
// replay, so the state-vs-action contrast is format-only over identical
// information).
//
// 'state' format: what happened — per-turn history, outcomes, final statuses.
// 'action' format: what to do — imperatives keyed to legality (missed legal
// probes, wasted probes), nothing else.
//
// Neither format ever contains keyed answers (item ids only), so playbooks
// cannot leak solutions across episodes; item variants change the live
// numbers per episode anyway.

import {
  createEpisode,
  tutorTurnStart,
  classifyTutorMove,
  applyTutorMove,
  adjudicateLearnerTurn,
  wellPosedProbesNow,
} from './referee.js';

export const PLAYBOOK_FORMATS = Object.freeze(['state', 'action']);

function replayTurns(payload, config) {
  const state = createEpisode(config, {
    arm: payload.arm,
    episodeId: `playbook-${payload.episodeId}`,
    variantSeed: payload.episodeId,
  });
  const turns = [];
  for (const r of payload.turnRecords) {
    tutorTurnStart(state);
    const actionSet = wellPosedProbesNow(state).map((p) => p.itemId);
    const classified = classifyTutorMove(state, r.finalEnvelope || {});
    const scoreBefore = state.score;
    applyTutorMove(state, classified, { visibleText: r.tutorVisible || '' });
    adjudicateLearnerTurn(state, { envelope: r.learnerEnvelope, publicText: r.learnerVisible || '' });
    turns.push({
      turn: r.turn,
      move: classified.legal ? classified.move : 'meta',
      itemId: classified.itemId || null,
      conceptId: classified.conceptId || null,
      actionSet,
      wellPosed: classified.wellPosed,
      outcome: state.lastAdjudication?.outcome || 'none',
      scoreDelta: state.score - scoreBefore,
    });
  }
  return { turns, state };
}

export function derivePlaybookLessons(payload, config, format) {
  if (!PLAYBOOK_FORMATS.includes(format)) throw new Error(`playbook: unknown format ${format}`);
  const summary = payload.summary;
  const head = `Episode ${payload.episodeId}: score ${summary.score}, ${summary.demonstrated} concept(s) demonstrated, ${summary.transferred} transferred, ${summary.turns} turns, ${summary.tutorWin ? 'WIN' : 'LOSS'}.`;
  let turns;
  try {
    ({ turns } = replayTurns(payload, config));
  } catch {
    return head; // replay unavailable — minimal anchor either way
  }

  if (format === 'state') {
    const history = turns
      .map((t) => {
        const target = t.itemId || t.conceptId;
        return `t${t.turn} ${t.move}${target ? `(${target})` : ''}→${t.outcome}${t.scoreDelta ? ` (${t.scoreDelta > 0 ? '+' : ''}${t.scoreDelta})` : ''}`;
      })
      .join('; ');
    return [
      head,
      `Turn history: ${history}`,
      `Dodges charged: ${JSON.stringify(summary.dodgesCharged)}. Final concept statuses: ${JSON.stringify(summary.conceptStatuses)}. Budgets left: ${JSON.stringify(summary.budgetsRemaining)}.`,
    ].join('\n');
  }

  // action format
  const lessons = [];
  for (const t of turns) {
    if (t.actionSet.length > 0 && t.move !== 'probe') {
      lessons.push(
        `- Turn ${t.turn}: probing ${t.actionSet.join(' or ')} was LEGAL but you chose ${t.move} — when a legal probe exists, issue it.`,
      );
    }
    if (t.move === 'probe' && t.wellPosed === false) {
      lessons.push(
        `- Turn ${t.turn}: probe ${t.itemId} was ill-posed and cost a point — only probe items that are currently legal (taught within the window, prereqs met, not just probed, not tainted).`,
      );
    }
  }
  if (lessons.length === 0) {
    lessons.push('- No discipline errors: every legal probe was taken and none were wasted. Repeat this line of play.');
  }
  return [head, ...lessons].join('\n');
}
