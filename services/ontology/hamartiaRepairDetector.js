// hamartiaRepairDetector.js — the repair-signal side of the population bridge.
//
// Operationalises the CORRECTION axis (adaptation-core's manifest/latent repair classes).
// From a deliberation sidecar it pulls the learner's MANIFEST (public final turn) and
// LATENT (hidden ego/superego deliberation) text, and detects hamartia-repair in each:
//   - publicRepair: the corrected rule is in the public turn  (Option 1, the baseline)
//   - latentRepair: the corrected rule is in the hidden reasoning
// DurableRepair = both; CostumeRepair = public-only (the manifest!=latent gap); SilentRepair
// = latent-only. See ADAPTATION-PLAN-2.0.md (P1: is the latent separable from the surface?).
//
// Detection is dependency-injected so the module is testable offline: `mode: 'mock'` reads a
// fixture map; `mode: 'llm'` calls an injected `callLLM(prompt)` (the robust Stage-1 probe;
// needs an API key, so it lives at the script edge, not here).

const WORD = /[a-z0-9]+/g;

function tokens(text) {
  // strip bracketed stage directions, lowercase, keep word tokens
  return new Set(
    String(text || '')
      .replace(/\[[^\]]*\]/g, ' ')
      .toLowerCase()
      .match(WORD) || [],
  );
}

// Pull the learner's manifest (public final turn) + latent (hidden deliberation) from a
// deliberation sidecar. latentInitial = the ego's unguarded FIRST draft (the sharpest
// concealment probe); latentFull = the whole ego/superego trace at that turn.
export function extractLearnerRepairText(deliberation) {
  const turns = (deliberation && deliberation.turns) || [];
  const learnerTurns = turns.filter((t) => t && t.phase === 'learner');
  if (!learnerTurns.length) return null;
  const last = learnerTurns[learnerTurns.length - 1];
  const delib = Array.isArray(last.internalDeliberation) ? last.internalDeliberation : [];
  const egoInitial = delib.find((d) => d && d.role === 'ego' && /initial/i.test(d.stage || ''));
  const latentFull = delib
    .filter((d) => d && /ego|superego/i.test(d.role || ''))
    .map((d) => `[${d.role}/${d.stage}] ${d.content || ''}`)
    .join('\n\n');
  return {
    turnNumber: last.turnNumber ?? null,
    publicText: String(last.externalMessage || ''),
    latentInitial: String((egoInitial && egoInitial.content) || ''),
    latentFull,
  };
}

// Zero-API concealment-signal proxy: how much the learner's latent first-thought diverges
// from the public turn. Low overlap => the public turn is NOT just the surface of the latent
// (concealment signal present). High overlap => latent ~ surface-determined (P1 leans null).
export function latentManifestDivergence(publicText, latentText) {
  const a = tokens(publicText);
  const b = tokens(latentText);
  if (!a.size && !b.size) return { overlap: 1, diverged: false, publicTokens: 0, latentTokens: 0 };
  const inter = [...a].filter((t) => b.has(t)).length;
  const union = new Set([...a, ...b]).size;
  const overlap = union ? inter / union : 0;
  return { overlap, diverged: overlap < 0.5, publicTokens: a.size, latentTokens: b.size };
}

export function buildRepairPrompt(hamartia, text) {
  return (
    `A learner held this misconception:\n"${hamartia}"\n\n` +
    `Does the following learner text show the learner has CORRECTED that misconception — ` +
    `stating or applying the right rule in a way that CONTRADICTS the misconception — as ` +
    `opposed to still holding it, or merely restating the tutor's words without it? ` +
    `Answer strictly with one word: YES or NO.\n\nLearner text:\n"${text}"`
  );
}

// Detect repair in one text. mode 'mock' -> fixture map (tests / free pipeline). mode 'llm'
// -> the injected callLLM(prompt) judge (the robust probe; needs an API key at the edge).
export async function detectRepair(hamartia, text, opts = {}) {
  const mode = opts.mode || 'mock';
  if (!text || !text.trim()) return false;
  if (mode === 'mock') {
    const map = opts.mockMap || {};
    if (text in map) return Boolean(map[text]);
    return Boolean(map.default);
  }
  if (mode === 'llm') {
    if (typeof opts.callLLM !== 'function') {
      throw new Error(
        'repair detector mode "llm" requires an injected opts.callLLM (set an API key + wire the provider)',
      );
    }
    // Fail closed at the judge boundary: never spend a paid judge call on an empty/undefined
    // misconception — buildRepairPrompt would ask the judge to assess repair of "" (the bug
    // that invalidated the 4438d4b run). Guarding HERE means no caller can trigger it, not
    // just this probe; the misconception must be present before any LLM repair verdict.
    if (!hamartia || !String(hamartia).trim()) {
      throw new Error(
        'repair detector mode "llm": refusing to judge an empty/undefined hamartia (misconception); provide a non-empty misconception or skip the cell',
      );
    }
    const reply = await opts.callLLM(buildRepairPrompt(hamartia, text));
    return /^\s*yes\b/i.test(String(reply || ''));
  }
  throw new Error(`unknown repair-detector mode: ${mode}`);
}

export default { extractLearnerRepairText, latentManifestDivergence, buildRepairPrompt, detectRepair };
