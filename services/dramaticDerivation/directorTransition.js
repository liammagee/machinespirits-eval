import { classifyRelease as classifyLemmaRelease } from './lemmaLayer.js';

function applyActDirection({ turn, directorOut, actState, acts, staging, events, didacticFallbackForAct }) {
  const turnsThisAct = turn - actState.startTurn;
  if (turn === 1) {
    actState.brief = (directorOut.direction || '').trim();
    staging.phase = { name: 'Act 1', intent: actState.brief, turn };
    return;
  }

  const wantsEnd = directorOut.act === 'end';
  const mustEnd = turnsThisAct >= acts.maxActTurns;
  if (wantsEnd && turnsThisAct < acts.minActTurns) {
    events.push({
      turn,
      type: 'act_min_blocked',
      detail: `director end of act ${actState.index} overridden at ${turnsThisAct} turns (min ${acts.minActTurns})`,
    });
    return;
  }
  if (!wantsEnd && !mustEnd) return;

  const direction = (directorOut.direction || '').trim() || '[The act turns.]';
  const endedByAct = wantsEnd ? 'director' : 'harness_max';
  const didacticFallback = didacticFallbackForAct(actState.index, actState.startTurn, turn - 1);
  actState.history.push({
    act: actState.index,
    turns: [actState.startTurn, turn - 1],
    endedBy: endedByAct,
    brief: actState.brief,
    ...(didacticFallback ? { didacticFallback } : {}),
  });
  events.push({
    turn,
    type: 'act_end',
    detail: `act ${actState.index} closed (${endedByAct}) after ${turnsThisAct} turns`,
  });
  actState.index += 1;
  actState.startTurn = turn;
  actState.brief = direction;
  staging.phase = { name: `Act ${actState.index}`, intent: direction, turn };
}

function applyDirectorPhase({ turn, directorOut, actState, acts, staging, events, didacticFallbackForAct }) {
  if (actState) {
    applyActDirection({ turn, directorOut, actState, acts, staging, events, didacticFallbackForAct });
    return;
  }
  if (directorOut.phase && typeof directorOut.phase.name === 'string' && directorOut.phase.name.trim()) {
    staging.phase = {
      name: directorOut.phase.name.trim(),
      intent: typeof directorOut.phase.intent === 'string' ? directorOut.phase.intent.trim() : '',
      turn,
    };
  }
}

function recordDirectorRelease({
  turn,
  directorOut,
  applyRelease,
  releasedThisTurn,
  lemmaRun,
  lemmaConfig,
  lemmaDag,
  events,
}) {
  const directorRelease = applyRelease(turn, directorOut.release, 'director');
  if (directorRelease) releasedThisTurn.push(directorRelease);
  if (!directorRelease || !lemmaRun || !lemmaConfig.bind) return directorRelease;

  const classification = classifyLemmaRelease(lemmaDag, lemmaRun.active?.key || null, directorOut.release);
  if (classification === 'out_of_support') {
    lemmaRun.passthroughs.push({ turn, premise: directorOut.release, by: 'director' });
    events.push({ turn, type: 'lemma_passthrough', detail: `${directorOut.release} (director)` });
  }
  return directorRelease;
}

function appendDirectorTranscript({
  turn,
  callDirector,
  directorOut,
  directorView,
  transcript,
  staging,
  actState,
  sceneMeta,
  publicRegister,
}) {
  if (!callDirector && !directorOut.release && !(staging.phase && staging.phase.turn === turn)) return;
  transcript.push({
    turn,
    role: 'director',
    text: directorOut.direction || '',
    meta: {
      release: directorOut.release || null,
      phase: staging.phase && staging.phase.turn === turn ? { ...staging.phase } : null,
      ...(actState ? { act: directorOut.act || null } : {}),
      ...(sceneMeta ? { scene: sceneMeta } : {}),
      ...(directorView.proxyDagPacing ? { proxyDagPacing: directorView.proxyDagPacing } : {}),
      publicRegister,
    },
  });
}

/** Invoke the director and apply only director-owned effects for one turn. */
export async function runDirectorTransition({
  turn,
  openedScene,
  role,
  shouldCallDirector,
  buildView,
  proxyDagPacingRows,
  applyRelease,
  releasedThisTurn,
  lemmaRun,
  lemmaConfig,
  lemmaDag,
  events,
  actState,
  acts,
  staging,
  didacticFallbackForAct,
  sceneMeta,
  publicRegister,
  transcript,
}) {
  const callDirector = shouldCallDirector(turn, openedScene);
  const directorView = buildView(turn, 'director');
  if (directorView.proxyDagPacing) proxyDagPacingRows.push({ ...directorView.proxyDagPacing });
  const directorOut = callDirector ? (await role(directorView)) || {} : {};
  const directorRelease = recordDirectorRelease({
    turn,
    directorOut,
    applyRelease,
    releasedThisTurn,
    lemmaRun,
    lemmaConfig,
    lemmaDag,
    events,
  });
  applyDirectorPhase({ turn, directorOut, actState, acts, staging, events, didacticFallbackForAct });
  appendDirectorTranscript({
    turn,
    callDirector,
    directorOut,
    directorView,
    transcript,
    staging,
    actState,
    sceneMeta,
    publicRegister,
  });
  return { callDirector, directorView, directorOut, directorRelease };
}
