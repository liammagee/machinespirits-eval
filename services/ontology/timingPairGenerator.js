// timingPairGenerator.js — the contrastive timing-pair design (zero-API).
//
// Builds the 2x2 {pivotal,neutral} move x {adjacent,decoupled} timing arms from ONE tagged
// base transcript, by PURE REORDER + a matched neutral-move substitution. The whole point is
// that within a move-type the two timing arms share the IDENTICAL public utterance multiset —
// only the SEQUENCE differs — so any downstream critic-attribution difference is caused by
// timing alone, content held literally constant. See
// notes/poetics/2026-06-05-contrastive-timing-pair-design.md (and the correlational seed,
// 2026-06-05-public-causal-bridge-criterion.md).
//
// Distinct question from §6.10 (closed): that asked if the HIDDEN interior is separable from
// the surface (null); this asks if PUBLIC timing moves critic ATTRIBUTION of the reframe to a
// tutor move. Public structure only — nothing latent is modelled. Frame per
// dramatic-form-not-mindreading: this is attribution of dramatic form, not real causation.

// Deterministic FNV-1a over the order-INDEPENDENT utterance multiset (sorted role|text). Two
// arms with the same hash contain exactly the same turns in some order — the identity
// invariant the design asserts rather than assumes. No Date/Math.random (resume-safe).
export function multisetHash(turns) {
  const norm = (t) =>
    `${String(t.role || '').trim()}|${String(t.text || '')
      .replace(/\s+/g, ' ')
      .trim()}`;
  const joined = turns.map(norm).sort().join('');
  let h = 2166136261;
  for (const c of joined) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// A canonical bridged base must have obstruction BEFORE the pivotal move BEFORE the reframe —
// the peripeteia chain in sequence (obstruction -> tutor mechanism-change -> learner use).
function validateTags(turns, tags) {
  const { obstruction, pivotalMove, reframe } = tags || {};
  for (const [k, v] of Object.entries({ obstruction, pivotalMove, reframe })) {
    if (!Number.isInteger(v) || v < 0 || v >= turns.length) {
      throw new Error(`timing-pair: tag "${k}" must be a valid turn index (got ${v}; ${turns.length} turns)`);
    }
  }
  if (!(obstruction < pivotalMove && pivotalMove < reframe)) {
    throw new Error(
      `timing-pair: base must be canonically bridged (obstruction < pivotalMove < reframe); ` +
        `got ${obstruction} < ${pivotalMove} < ${reframe}`,
    );
  }
  if (String(turns[pivotalMove].role || '').toLowerCase() !== 'tutor') {
    throw new Error(`timing-pair: the pivotalMove turn (${pivotalMove}) must be a tutor turn`);
  }
}

const withMoveText = (turns, idx, text) => turns.map((t, i) => (i === idx ? { ...t, text } : { ...t }));

// Post-emption: relocate the tutor move to immediately AFTER the reframe, so the learner's
// reframe is public BEFORE the move that supposedly caused it — no causal bridge is readable.
// Pure reorder: the multiset is preserved (one element moved), so the hash is unchanged.
function relocateAfter(turns, fromIdx, afterIdx) {
  const arr = turns.map((t) => ({ ...t }));
  const [moved] = arr.splice(fromIdx, 1);
  const target = fromIdx < afterIdx ? afterIdx - 1 : afterIdx; // afterIdx shifts left if we removed before it
  arr.splice(target + 1, 0, moved);
  return arr;
}

// Displacement: relocate the tutor move to immediately BEFORE the obstruction, so the device is
// introduced before any obstruction necessitates it — it reads as a generic scaffold the tutor
// could have offered at any time (breaks bridge component 5, device-specificity), NOT as forced
// by the obstruction. Coherence-preserving (the device still precedes its use), unlike
// post-emption (which puts the reframe before the move that defines it — effect before cause).
function relocateBefore(turns, fromIdx, beforeIdx) {
  const arr = turns.map((t) => ({ ...t }));
  const [moved] = arr.splice(fromIdx, 1);
  const target = fromIdx < beforeIdx ? beforeIdx - 1 : beforeIdx; // beforeIdx shifts left if we removed before it
  arr.splice(target, 0, moved); // insert AT target => immediately before the element now there
  return arr;
}

// Build the four arms from a tagged base + a matched neutral move.
//   input: { turns:[{role,text}], tags:{obstruction,pivotalMove,reframe} }, neutralMove (string)
// Each arm carries the SYMBOLIC chain prediction (adaptation-core R2: induced iff chainComplete)
// — the baseline the blind panel is read AGAINST: only the bridged arm should be induced; a
// panel that also calls decoyBridged induced is exhibiting post-hoc gullibility (the D6 read).
// opts.decoupling selects HOW the decoupled arms break the bridge, both holding the utterance
// multiset constant (pure reorder):
//   'displacement' (default) — move the device UPSTREAM of the obstruction: coherent (device
//      precedes its use) but no longer necessitated by the obstruction (breaks bridge component
//      5, device-specificity). Preferred: the decoupled transcript stays readable.
//   'postemption' — move the device to AFTER the reframe: raw cause-effect order broken (the
//      reframe precedes the move that defines its device), so the decoupled arm risks reading
//      INCOHERENT. Kept as a robustness contrast, NOT the default (the incoherence can confound
//      the critic's down-vote with a coherence judgment rather than a missing-bridge judgment).
export function generateTimingArms({ turns, tags, neutralMove, decoupling = 'displacement' } = {}) {
  if (!Array.isArray(turns) || turns.length < 3) {
    throw new Error('timing-pair: need a base transcript of >= 3 turns');
  }
  if (!neutralMove || !String(neutralMove).trim()) {
    throw new Error('timing-pair: a matched neutralMove (placebo tutor turn, no mechanism-work) is required');
  }
  if (!['displacement', 'postemption'].includes(decoupling)) {
    throw new Error(`timing-pair: decoupling must be 'displacement' or 'postemption' (got ${decoupling})`);
  }
  validateTags(turns, tags);
  const { obstruction: o, pivotalMove: j, reframe: k } = tags;
  const pivotalText = turns[j].text;
  const obstructionText = turns[o].text;
  const reframeText = turns[k].text; // re-find by text after copying (the arms hold {...t} copies)

  // Move-type factor: pivotal (real mechanism-change) vs neutral (matched placebo).
  const pivotalBase = withMoveText(turns, j, pivotalText); // identity copy
  const neutralBase = withMoveText(turns, j, neutralMove);

  // Timing factor: the chosen decoupling, applied to a base whose move sits at index j.
  const decouple = (arr) => (decoupling === 'postemption' ? relocateAfter(arr, j, k) : relocateBefore(arr, j, o));
  const coherenceRiskTag = decoupling === 'postemption' ? 'reverse-order' : 'upstream';
  const brokenReason =
    decoupling === 'postemption'
      ? 'order: the reframe precedes the move that defines its device (effect before cause)'
      : 'necessitation: the move precedes the obstruction, so the device is not forced by it (bridge component 5)';

  const arm = (label, moveType, timing, arr, chainComplete, why) => ({
    arm: label,
    moveType,
    timing,
    decoupling: timing === 'decoupled' ? decoupling : null,
    chainPrediction: chainComplete ? 'chainComplete' : 'chainBroken',
    predictedOrigin: chainComplete ? 'PeripeteiaInducedRecognition' : 'OrganicRecognition',
    chainBrokenBy: chainComplete ? null : why,
    coherenceRisk: timing === 'decoupled' ? coherenceRiskTag : 'none', // decoupled arms get the mandatory coherence check
    moveBeforeReframe: null, // cause→effect order (move before reframe?) — filled below
    moveAfterObstruction: null, // necessitation order (move responds to the obstruction?) — filled below
    utteranceMultisetHash: multisetHash(arr),
    turns: arr,
  });

  const arms = {
    // A — BRIDGED: pivotal move in canonical adjacency (after obstruction, before reframe). Induced.
    bridged: arm('bridged', 'pivotal', 'adjacent', pivotalBase, true, null),
    // B — DISPLACED-PIVOTAL: same utterances as A, the move relocated per `decoupling` (chain broken).
    displacedPivotal: arm('displacedPivotal', 'pivotal', 'decoupled', decouple(pivotalBase), false, brokenReason),
    // C — DECOY-BRIDGED: neutral move in canonical adjacency. Sequence LOOKS like a bridge but the
    // move does no mechanism-work -> chain broken at component 3. The gullibility discriminator.
    decoyBridged: arm(
      'decoyBridged',
      'neutral',
      'adjacent',
      neutralBase,
      false,
      'no tutor mechanism-change (neutral move)',
    ),
    // D — DISPLACED-NEUTRAL: neutral move, relocated per `decoupling`. Chain broken on both counts.
    displacedNeutral: arm(
      'displacedNeutral',
      'neutral',
      'decoupled',
      decouple(neutralBase),
      false,
      `no mechanism-change AND ${brokenReason}`,
    ),
  };

  // Fill the two public order facts per arm — what a blind critic actually sees.
  //   moveBeforeReframe   : cause→effect order intact (move precedes the reframe)
  //   moveAfterObstruction: necessitation order intact (move responds to the obstruction)
  // bridged: both true. postemption: moveBeforeReframe false. displacement: moveAfterObstruction false.
  for (const a of Object.values(arms)) {
    const oIdx = a.turns.findIndex((t) => t.text === obstructionText);
    const rIdx = a.turns.findIndex((t) => t.text === reframeText);
    const mIdx = a.turns.findIndex(
      (t) => String(t.role).toLowerCase() === 'tutor' && (t.text === pivotalText || t.text === neutralMove),
    );
    a.moveBeforeReframe = mIdx >= 0 && rIdx >= 0 ? mIdx < rIdx : null;
    a.moveAfterObstruction = mIdx >= 0 && oIdx >= 0 ? mIdx > oIdx : null;
  }

  const invariants = {
    // Within a move-type, adjacent and decoupled are pure reorders => identical multiset.
    pivotalTimingPreservesContent: arms.bridged.utteranceMultisetHash === arms.displacedPivotal.utteranceMultisetHash,
    neutralTimingPreservesContent:
      arms.decoyBridged.utteranceMultisetHash === arms.displacedNeutral.utteranceMultisetHash,
    // Across move-types, exactly one turn differs (the tutor move text).
    moveTypeDiffersByOneTurn: pivotalBase.filter((t, i) => t.text !== neutralBase[i].text).length === 1,
    onlyBridgedIsInduced:
      arms.bridged.predictedOrigin === 'PeripeteiaInducedRecognition' &&
      ['displacedPivotal', 'decoyBridged', 'displacedNeutral'].every(
        (key) => arms[key].predictedOrigin === 'OrganicRecognition',
      ),
  };

  return { arms, invariants };
}

export default { generateTimingArms, multisetHash };
