import { getEngagementRegisterDefinition } from '../engagementRegisterRegistry.js';
import { DIDACTIC_MODE_FAMILIES } from './didacticMode.js';

function auditLines(audit) {
  if (!audit) return [];
  return [
    '',
    `THE AUDIT of your scene ${audit.sceneIndex} commitment (deterministic, clause by clause):`,
    ...audit.clauses.map(
      (clause) => `- [${clause.verdict}] ${clause.clause}${clause.evidence ? ` — ${clause.evidence}` : ''}`,
    ),
    `Summary: ${audit.summary}.`,
    'THE AUDIT BINDS: the commitment you now make must answer every drifted clause — carry it forward, revise it, or change course with a stated reason.',
  ];
}

function strategyHistoryLine(history) {
  const strategy = [
    history.strategy.stance ? `stance ${history.strategy.stance}` : null,
    history.strategy.didacticDefault ? `didactic ${history.strategy.didacticDefault}` : null,
    history.strategy.releasePosture ? `releases ${history.strategy.releasePosture}` : null,
    history.strategy.releaseIntent ? `intended ${history.strategy.releaseIntent.join('+')}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const outcome = [
    history.fidelity ? `fidelity ${history.fidelity.label}` : null,
    history.outcome.exitConditionCleared === null
      ? null
      : `exit ${history.outcome.exitConditionCleared ? 'cleared' : 'NOT cleared'}`,
    history.outcome.pressingExchanges ? `${history.outcome.pressingExchanges} pressing exchange(s)` : null,
    history.outcome.intendedPlayed !== null
      ? `${history.outcome.intendedPlayed}/${history.strategy.releaseIntent?.length ?? 0} intended played`
      : null,
    history.audit ? history.audit.summary : null,
    history.review ? `you chose: ${history.review.decision}` : null,
  ]
    .filter(Boolean)
    .join('; ');
  return `- scene ${history.sceneIndex} [${strategy || 'no strategy'}] -> ${outcome || 'no outcome recorded'}`;
}

function mechanismHistoryLines({ trialling, sceneOpening, ledgerInfo }) {
  if (!trialling || !sceneOpening || !ledgerInfo?.history?.length) return [];
  return [
    '',
    'YOUR MECHANISM HISTORY (what you tried, whether it was really tried, how it landed):',
    ...ledgerInfo.history.map(strategyHistoryLine),
    'REVIEW THE RECORD and decide in "strategy_review": persist (same strategy), adjust (same mechanism, new settings), or switch (a different mechanism) — with a one-line reason.',
    'Outcomes only count for a mechanism that was actually deployed (fidelity: faithful); warm-in-costume trials teach you nothing.',
  ];
}

function planModeLines({ stocktakeNote, ledgerBridgeState }) {
  const lines = [];
  if (stocktakeNote) {
    lines.push(
      '',
      `STOCK-TAKE on scene ${stocktakeNote.sceneIndex} (your own second voice, between scenes — course, not conformance):`,
      ...(stocktakeNote.assessment ? [`- assessment: ${stocktakeNote.assessment}`] : []),
      stocktakeNote.correction
        ? `- CORRECTION DEMANDED: ${stocktakeNote.correction}`
        : '- no correction demanded — the course holds.',
      'Answer it in "reorientation": your revised WORKING ORIENTATION (2-4 sentences) when a correction is demanded or you yourself judge the course has failed; null keeps your current orientation.',
    );
  }
  if (ledgerBridgeState?.orientation) {
    lines.push(
      '',
      'YOUR WORKING ORIENTATION (yours alone; revised at your last stock-take — no one grades you against it):',
      ledgerBridgeState.orientation,
    );
  }
  return lines;
}

function stanceFidelityCues(name) {
  const definition = getEngagementRegisterDefinition(name) || {};
  return Array.isArray(definition.stance_fidelity_cues) ? definition.stance_fidelity_cues.slice(0, 4) : [];
}

function openingStanceLines(ledgerInfo) {
  if (!ledgerInfo?.config?.stancePalette?.length) return [];
  const stanceLines = ledgerInfo.config.stancePalette.map((name) => {
    const definition = getEngagementRegisterDefinition(name) || {};
    const cues = stanceFidelityCues(name);
    return `  · ${name} (${definition.valence || 'unknown'} valence)${
      cues.length ? ` — cues that MUST be visible in your lines: ${cues.map((cue) => `"${cue}"`).join(', ')}` : ''
    }`;
  });
  return [
    '- stance: choose your interpersonal stance for this scene from the palette (or null to stay plain):',
    ...stanceLines,
    '  A stance counts only when its cues are visible — an assigned stance without visible cues is treatment noncompliance, not style.',
  ];
}

function sceneOpeningLines({ view, ledgerInfo, activeRegisterName, trialling, releaseAuthority }) {
  const palette = ledgerInfo?.config?.registerPalette?.length
    ? ledgerInfo.config.registerPalette
    : [activeRegisterName];
  return [
    '',
    `THIS TURN OPENS SCENE ${view.scene.index} — COMMIT YOUR SCENE STRATEGY in "scene_commitment", alongside your dialogue:`,
    `- register: choose from [${palette.join(', ')}] — the harness holds your choice for the whole scene.`,
    `- didactic_default: your explanatory mode of first resort this scene (${DIDACTIC_MODE_FAMILIES.join(', ')}).`,
    '- release_posture: eager (play exhibits on their cue), hold (never ahead of schedule), consolidate (at most one release this scene).',
    '- recognition_budget: how many phatic/uptake exchanges this scene can afford (0-4).',
    '- exit_condition: what the learner will visibly do when this scene has worked.',
    'Conduct only: the release calendar and proof-control obligations outrank this everywhere they speak.',
    ...(trialling ? openingStanceLines(ledgerInfo) : []),
    ...(trialling && releaseAuthority && ledgerInfo?.config?.releaseIntent
      ? [
          '- release_intent: name the exhibit ids (up to 4, from your window) you INTEND to play this scene. Advisory to each turn; the pacing guard and hold limits rule as ever.',
        ]
      : []),
  ];
}

function standingCommitmentLines({ ledgerBridgeState, trialling }) {
  const commitment = ledgerBridgeState?.commitment;
  if (!commitment) return [];
  const lines = ['', `YOUR SCENE COMMITMENT (scene ${ledgerBridgeState.sceneIndex}, standing since its opening):`];
  if (commitment.register) lines.push(`- register: ${commitment.register} (held by the harness)`);
  if (commitment.stance) {
    const cues = stanceFidelityCues(commitment.stance);
    lines.push(
      `- stance: ${commitment.stance}${cues.length ? ` — keep its cues visible: ${cues.map((cue) => `"${cue}"`).join(', ')}` : ''}`,
    );
  }
  if (commitment.didacticDefault) lines.push(`- didactic default: ${commitment.didacticDefault}`);
  if (commitment.releasePosture) lines.push(`- release posture: ${commitment.releasePosture}`);
  if (commitment.releaseIntent) lines.push(`- release intent: ${commitment.releaseIntent.join(', ')} (guards rule)`);
  if (commitment.recognitionBudget !== null && commitment.recognitionBudget !== undefined) {
    lines.push(`- recognition budget: ${commitment.recognitionBudget}`);
  }
  if (commitment.exitCondition) lines.push(`- exit: ${commitment.exitCondition}`);
  lines.push(
    trialling
      ? 'It GUIDES rather than binds: depart when the learner warrants it and declare it in "departure" — declared departures adjudicate as justified deviation, undeclared drift as drift.'
      : 'Play under it; the audit at the scene close distinguishes kept from drift.',
  );
  return lines;
}

function strategyModeLines(context) {
  if (context.planMode) return planModeLines(context);
  if (context.sceneOpening && context.view.scene) return sceneOpeningLines(context);
  return standingCommitmentLines(context);
}

function lemmaLines(view) {
  if (!view.lemmaLayer?.tutorLines) return [];
  const lines = ['', ...view.lemmaLayer.tutorLines];
  const lemmaOpening = Boolean(view.lemmaLayer.config?.bind && view.scene && view.scene.startTurn === view.turn);
  if (lemmaOpening && view.lemmaLayer.frontier.length) {
    lines.push(
      '',
      'FRONTIER CHOICE (this turn opens a scene): pick the scene\'s ACTIVE lemma in "active_lemma" — the predicate name alone suffices (e.g. "blankFrom"). One of:',
      ...view.lemmaLayer.frontier.map(
        (frontier) =>
          `- "${frontier.label}" (unplayed support: ${frontier.supportRemaining.join(', ') || 'none — grounds from the played board'})`,
      ),
    );
  }
  return lines;
}

/**
 * Project the tutor-visible strategy-ledger prompt without mutating the
 * ledger, scene, lemma, or release state from which it is derived.
 */
export function tutorStrategyLedgerPromptLines(context = {}) {
  if (!context.strategyLedger) return [];
  const lines = [
    ...auditLines(context.sceneCommitmentAudit),
    ...mechanismHistoryLines(context),
    ...strategyModeLines(context),
    ...lemmaLines(context.view),
  ];
  if (context.heldDidacticNote) lines.push('', context.heldDidacticNote);
  if (context.ledgerInfo?.budget?.exhausted) {
    lines.push(
      '',
      'OPPORTUNITY BUDGET EXHAUSTED: proof-neutral turns have run past the block budget — return to the proof obligation this turn (advisory; hard obligations already outrank).',
    );
  }
  return lines;
}
