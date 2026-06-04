// adaptationAboxBridge.js -- the population bridge from the procedural adaptation
// gate (run-poetics-adaptation-loop.js summarizeItem) to the adaptation-core ABox.
//
// Lifts ONE per-cell gate summary {arm, adaptationGate, actionalVotes, consensus,
// origins, ...} into adaptation-core TTL, transcribing the gate's stage-level
// decisions as ms:gateFired booleans, so the ontology rules derive the HIGHER-ORDER
// distinctions the procedural gate does NOT make: recognition-origin (organic vs
// peripeteia_induced, structurally) and -- once a repair signal exists -- the
// correction axis.
//
// HONEST SCOPE (v1): the persisted gate-struct is ~5 booleans + vote counts. It has
//   - NO old-check / replacement-check naming signal (S5/S6) -> PROXIED from "recognition produced"
//   - NO trigger-consumption detail (R6's wrong-trigger path) -> not populated
//   - NO hamartia-repair signal at all -> the correction axis is left empty.
// So this bridge populates: the chain -> recognition-origin, control_leak, action_gap.
// What it cannot yet populate is the explicit unpopulatable() list below (a spec for
// what the loop must additionally emit to make the correction axis operational).

const ABOX_PREFIX = `@prefix ms: <https://machinespirits.dev/ontology/reasoning#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
`;

function localId(value) {
  return (
    String(value || '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'x'
  );
}

// Fields the adaptation-core TBox models but the persisted gate-struct cannot supply.
export function unpopulatableFromGateStruct() {
  return [
    'OldCheckNamingStage / ReplacementCheckNamingStage gates (S5/S6) — proxied from "recognition produced"; the real signal lives in critic-poetics-structure.js (pressure + replacement frames), not summarizeItem.',
    'Trigger-consumption detail (ms:consumesTrigger / ms:leavesUnusedCandidate) — the D53 wrong-trigger path (R6). Not in the gate booleans, but NOW JOINED from the deliberation sidecar via extractTriggerConsumption() when the reconcile is given the run dir (closes the D53 keystone).',
    'HamartiaRepairStage gate — there is NO durable-repair signal in the gate; the entire correction axis (Scaffolded/SelfRepair, repairWithoutRecognitionCredit) needs a new signal before it is operational.',
  ];
}

// The critic-VOTED origin (max-count class), to reconcile against the structural derivation.
export function votedOrigin(origins = {}) {
  const entries = Object.entries(origins).filter(([, n]) => Number(n) > 0);
  if (!entries.length) return 'none';
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries[0][0];
}

// Extract the trigger-consumption pathology from a deliberation sidecar (the signal the
// gate-struct booleans drop). The D53 keystone: the tutor consumes an ORGANIC reversal
// event while a higher-confidence director-cued candidate sits unused -> mechanism_not_
// publicly_resolved. Returns { usedDirectorCued, unusedDirectorCuedExists, wrongTrigger }
// or null when the deliberation has no consumed event.
export function extractTriggerConsumption(deliberation) {
  const turns = deliberation?.turns;
  if (!Array.isArray(turns)) return null;
  let used = null;
  let candidates = [];
  for (const t of turns) {
    if (t && t.learnerReversalEventUsed) {
      used = t.learnerReversalEventUsed;
      candidates = Array.isArray(t.learnerReversalEventCandidatesUsed) ? t.learnerReversalEventCandidatesUsed : [];
      break;
    }
  }
  if (!used) return null;
  const isDirectorCued = (e) => e && e.source === 'director_reversal_pressure_cue';
  const usedDirectorCued = isDirectorCued(used);
  const unusedDirectorCued = candidates.find((c) => isDirectorCued(c) && c.turnNumber !== used.turnNumber);
  return {
    usedDirectorCued,
    unusedDirectorCuedExists: Boolean(unusedDirectorCued),
    wrongTrigger: !usedDirectorCued && Boolean(unusedDirectorCued),
  };
}

// Map one summarizeItem() output to adaptation-core ABox TTL.
export function summaryToAbox(summary, opts = {}) {
  const actionVoteCut = opts.actionVoteCut ?? 3;
  const controlMax = opts.controlMaxRecognitionVotes ?? 1;
  const g = summary.adaptationGate || {};
  const c = summary.consensus || {};
  const arm = summary.arm;
  const isControl = ['routine', 'none'].includes(arm);
  const id = localId(`${summary.dramaId}_${arm}`);
  const ev = `Ev_${id}`;

  // Stage gates transcribed from the gate's boolean decisions.
  const s1 = Boolean(g.branchValid && g.reversalEventUsed && g.instrumentedPressure); // PressureTrigger
  const s23 = Boolean(g.publicMechanism); // MechanismShift + DeviceOffer surfaced publicly
  const naming = c.claimStatus === 'claimable'; // PROXY for old/replacement-check naming
  // Mirror the gate's leak/recognition condition: recognition is "produced" when the
  // consensus is non-negative OR it clears the control ceiling (so a 1-vote negative
  // control does NOT read as a leak — matches summarizeItem control_leak logic).
  const reorientationFired = (c.claimStatus && c.claimStatus !== 'negative') || (c.recognitionVotes || 0) > controlMax;

  const lines = [`ms:${ev} ms:onArm ms:${isControl ? 'ArmNone' : 'ArmPeripeteia'} .`];
  const stage = (sid, cls, fired) =>
    lines.push(`ms:${sid} a ms:${cls} ; ms:partOfEvent ms:${ev} ; ms:gateFired ${fired} .`);
  stage(`S1_${id}`, 'PressureTriggerStage', s1);
  // S2 (MechanismShift): when the deliberation shows the wrong-trigger pathology (an
  // organic event consumed while a director-cued candidate sits unused), drive S2 via the
  // trigger facts so R6 derives gateFired=false + mechanism_not_publicly_resolved (the D53
  // keystone the booleans cannot see). Otherwise transcribe the publicMechanism boolean.
  const tc = opts.triggerConsumption;
  if (tc && tc.wrongTrigger) {
    lines.push(`ms:Trg_used_${id} a ms:Breakdown ; ms:isDirectorCued false .`);
    lines.push(`ms:Trg_unused_${id} a ms:Misfit ; ms:isDirectorCued true .`);
    lines.push(
      `ms:Route_${id} a ms:RouteChange ; ms:consumesTrigger ms:Trg_used_${id} ; ms:leavesUnusedCandidate ms:Trg_unused_${id} ; ms:surfacesAsDevice ${s23} .`,
    );
    lines.push(`ms:S2_${id} a ms:MechanismShiftStage ; ms:partOfEvent ms:${ev} ; ms:realizedBy ms:Route_${id} .`);
  } else {
    stage(`S2_${id}`, 'MechanismShiftStage', s23);
  }
  stage(`S3_${id}`, 'DeviceOfferStage', s23);
  // S4 (DevicePerformance): action_gap is a PERIPETEIA-arm check in the gate. So only on
  // peripeteia arms assert the raw count and let R7 / T-GATEFIRED-ACTIONAL derive
  // gateFired + action_gap; on control arms assert gateFired directly (no spurious gap).
  if (isControl) {
    stage(`S4_${id}`, 'DevicePerformanceStage', Number(summary.actionalVotes || 0) >= actionVoteCut);
  } else {
    lines.push(
      `ms:S4_${id} a ms:DevicePerformanceStage ; ms:partOfEvent ms:${ev} ; ms:actionalVotes ${Number(summary.actionalVotes || 0)} .`,
    );
  }
  stage(`S5_${id}`, 'OldCheckNamingStage', naming);
  stage(`S6_${id}`, 'ReplacementCheckNamingStage', naming);
  stage(`R_${id}`, 'ReorientationStage', reorientationFired);

  return {
    id,
    event: ev,
    ttl: lines.join('\n'),
    abox: `${ABOX_PREFIX}\n${lines.join('\n')}\n`,
    votedOrigin: votedOrigin(summary.origins),
    gateFailures: Array.isArray(summary.failures) ? summary.failures : [],
    gatePass: Boolean(summary.pass),
    meta: { dramaId: summary.dramaId, arm, isControl, actionVoteCut },
  };
}

export default { summaryToAbox, votedOrigin, extractTriggerConsumption, unpopulatableFromGateStruct };
