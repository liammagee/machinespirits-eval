// The VISIBLE pacing guard (Step 1 of the generalization plan, the V arm of the
// hidden-vs-visible-signal contrast). It is the form-match to the hidden pacing
// guard (`pacing.js`): same flag-gating, same "shape the window, don't override,"
// same decision points and the same {played, blocked, forcedSafe} decision
// vocabulary the bridge consumes. The ONE difference is the information source.
//
// The hidden guard computes its release window from the proof-distance D and the
// decay-driven stall — neither printed in the transcript. This module computes
// its window from transcript-visible features ONLY: how many turns since the
// tutor last released, whether the learner has echoed the last exhibit's surface
// on the page, and whether the learner's lines are getting shorter / more hedged.
//
// AUDIT INVARIANT: this file must NOT import from ./slope.js (the proof-distance /
// stall-detector primitives) or from ./pacing.js (the solvency / release-tempo
// primitives). V's whole claim is that it sees only what is on the page; the
// no-hidden-state property is enforced by an import test
// (tests/dramaticDerivationVisiblePacing.test.js). Keep it that way.

// Surface hedging markers — the lay reader's "this learner is unsure" cues.
const HEDGE_TOKENS = [
  'maybe',
  'perhaps',
  'not sure',
  'i think',
  'i guess',
  'could be',
  'might',
  'possibly',
  'unsure',
  'dunno',
  "don't know",
  'do not know',
  'confused',
  '?',
];

// Default calibration knobs. Tuned on a free mock pass (derivation-visible-guard-calibrate.js)
// so V narrows about as often as the hidden guard — otherwise the contrast is
// "V intervened more/less," not "V used worse signal."
export const VISIBLE_GUARD_DEFAULTS = {
  echoThreshold: 0.34, // fraction of the prior exhibit's content tokens the learner must echo to count as "taken up"
  staleCap: 3, // turns since last release at/after which the page reads as stalling
  hedgeRise: 0.5, // mean hedge-token increase (recent vs prior window) that reads as stalling
  lenDrop: -3, // mean content-length change (recent vs prior window) at/below which the page reads as stalling
  windowSize: 2, // learner lines per trend window (recent vs the two before)
};

function learnerLines(transcript) {
  return (transcript || []).filter((l) => l.role === 'learner');
}

// The visible text of a learner line: its spoken dialogue plus its stated
// hypothesis — both surface-rendered in the transcript. Deliberately NOT the
// structured board moves (meta.adopt/derive/deriveOutcomes): those are the
// learner's internal ledger, not what a reader sees on the page.
function lineText(line) {
  const hyp = line?.meta?.hypothesis ?? line?.hypothesis ?? '';
  return `${line?.text || ''} ${hyp || ''}`.trim();
}

function contentTokens(text) {
  return (text || '').toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
}

// Fraction of the released exhibit's content words (>3 chars) that surface in the
// given learner text — a coarse "did they pick this up" read off the page.
function echoFraction(surface, text) {
  const want = [...new Set(contentTokens(surface))].filter((w) => w.length > 3);
  if (!want.length) return 0;
  const hay = new Set(contentTokens(text));
  return want.filter((w) => hay.has(w)).length / want.length;
}

function hedgeCount(text) {
  const t = (text || '').toLowerCase();
  return HEDGE_TOKENS.reduce((n, tok) => n + (t.includes(tok) ? 1 : 0), 0);
}

// Extract the surface features the visible guard decides on. Pure; reads only the
// release ledger (release timing) and the transcript (learner words). No world
// proof state, no D, no decay ledger.
export function visibleSurfaceFeatures(world, { turn, ledger = [], transcript = [], thresholds = {} } = {}) {
  const th = { ...VISIBLE_GUARD_DEFAULTS, ...thresholds };
  const lines = learnerLines(transcript);
  const recent = lines.slice(-th.windowSize);
  const prior = lines.slice(-2 * th.windowSize, -th.windowSize);

  const released = (ledger || []).filter((r) => r?.premiseId && typeof r.turn === 'number');
  const lastReleased = released.length ? released.reduce((a, b) => (b.turn >= a.turn ? b : a)) : null;
  const lastReleaseTurn = lastReleased ? lastReleased.turn : null;
  const turnsSinceLastRelease = lastReleaseTurn != null ? turn - lastReleaseTurn : turn;

  const priorPremiseId = lastReleased?.premiseId || null;
  const priorSurface = priorPremiseId ? world?.premiseById?.get(priorPremiseId)?.surface || '' : '';
  const echoCandidates = lines
    .filter((l) => l.turn > (lastReleaseTurn ?? -Infinity))
    .map((l) => echoFraction(priorSurface, lineText(l)));
  const priorEcho = priorSurface && echoCandidates.length ? Math.max(...echoCandidates) : 0;
  // No prior exhibit on the page → vacuously "taken up" (nothing to wait on).
  const priorEchoed = priorPremiseId ? priorEcho >= th.echoThreshold : true;

  const meanLen = (ls) => (ls.length ? ls.reduce((s, l) => s + contentTokens(lineText(l)).length, 0) / ls.length : 0);
  const meanHedge = (ls) => (ls.length ? ls.reduce((s, l) => s + hedgeCount(lineText(l)), 0) / ls.length : 0);
  const lenTrend = meanLen(recent) - meanLen(prior); // negative ⇒ shrinking (stuck)
  const hedgeTrend = meanHedge(recent) - meanHedge(prior); // positive ⇒ more hedged (stuck)
  // A recent-vs-prior trend is undefined until BOTH windows are populated; one
  // early hedge is not a slope. Only turnsSinceLastRelease keys stalling before then.
  const hasTrend = lines.length >= 2 * th.windowSize;

  return {
    turn,
    turnsSinceLastRelease,
    priorPremiseId,
    priorEcho,
    priorEchoed,
    lenTrend,
    hedgeTrend,
    hasTrend,
    learnerLineCount: lines.length,
  };
}

// Does the page read as stalling? Two visible cues at their proper evidentiary
// thresholds: a release-gap is one ledger fact and fires on its own; a hedging /
// shortening slope is a two-window comparison and is withheld until both windows
// are populated (hasTrend). Shared by the decision and the per-turn prompt note,
// so the model is told the same read the harness enforces.
export function isStalling(features, thresholds = {}) {
  const th = { ...VISIBLE_GUARD_DEFAULTS, ...thresholds };
  return (
    features.turnsSinceLastRelease >= th.staleCap ||
    (features.hasTrend && (features.hedgeTrend >= th.hedgeRise || features.lenTrend <= th.lenDrop))
  );
}

function stallWhy(features, th) {
  const why = [];
  if (features.turnsSinceLastRelease >= th.staleCap)
    why.push(`${features.turnsSinceLastRelease} turns since last release`);
  if (features.hasTrend && features.hedgeTrend >= th.hedgeRise)
    why.push(`hedging up ${features.hedgeTrend.toFixed(2)}`);
  if (features.hasTrend && features.lenTrend <= th.lenDrop)
    why.push(`lines shortening ${features.lenTrend.toFixed(1)}`);
  return why.join('; ') || 'no stall';
}

// The visible-guard decision. Returns the same {played, blocked, forcedSafe, ...}
// shape the bridge's normalizeRelease consumes, plus a visibleFeatures block for
// the recording/audit. Mirrors pacingGuardDecision's control flow exactly:
//   - a hard hold-limit force (the calendar) takes precedence, ungated;
//   - else BLOCK a declared release whose prior exhibit is not yet taken up on the
//     page and the page is not stalling (mirrors H's "insolvent ⇒ hold");
//   - else PUSH the earliest playable exhibit when the tutor would hold but the
//     page is stalling (mirrors H's "last-safe-turn ⇒ force");
//   - else pass the model's choice through.
export function visibleGuardDecision(
  world,
  view,
  { turn, playable = [], validClaim = null, forcedPlay = null, thresholds = {} } = {},
) {
  const th = { ...VISIBLE_GUARD_DEFAULTS, ...thresholds };
  const features = visibleSurfaceFeatures(world, {
    turn,
    ledger: view?.ledger,
    transcript: view?.transcript,
    thresholds: th,
  });
  const stalling = isStalling(features, th);
  const earliestPlayable = playable.slice().sort((a, b) => a.turn - b.turn)[0] || null;

  const common = { candidate: validClaim || null, visibleFeatures: { ...features, stalling } };

  // Hard hold-limit force: the calendar plays it regardless, exactly as in H. Not
  // a guard intervention (it would fire with the guard off too).
  if (forcedPlay) {
    return { played: forcedPlay.premise, blocked: false, forcedSafe: false, forcedBy: null, reason: null, ...common };
  }

  // V-block: hold a declared release until the prior exhibit is visibly taken up —
  // unless the page is already stalling, in which case holding would starve it.
  if (validClaim && !features.priorEchoed && !stalling) {
    return {
      played: null,
      blocked: true,
      forcedSafe: false,
      forcedBy: null,
      reason: `${validClaim} held: prior exhibit ${features.priorPremiseId || '—'} not taken up on the page (echo ${features.priorEcho.toFixed(2)} < ${th.echoThreshold})`,
      ...common,
    };
  }

  // V-push: the tutor would hold, but the page is stalling — force the earliest
  // playable exhibit to unstick it.
  if (!validClaim && stalling && earliestPlayable) {
    return {
      played: earliestPlayable.premise,
      blocked: false,
      forcedSafe: true,
      forcedBy: 'visible_stall',
      reason: `${earliestPlayable.premise} pushed: page stalling (${stallWhy(features, th)})`,
      ...common,
    };
  }

  // Pass-through: the model's declared choice stands.
  return { played: validClaim, blocked: false, forcedSafe: false, forcedBy: null, reason: null, ...common };
}
