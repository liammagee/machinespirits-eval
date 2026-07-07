/**
 * Register router — classify-then-route coupled to the proof DAG
 * (workplan/items/classifier-dag-register.md, Phase B; operator design:
 * "shift register in response to how the classifier interacts the DAG").
 *
 * The routed channel is the tutor's SPEAKING REGISTER for the turn — a
 * stance block appended to the tutor's turn prompt (the recognition/
 * charisma dial idiom). It is prompt-side only: no release gating, no
 * choice binding, no proof-control change. The blocks are content-free
 * with respect to specific facts (they instruct a stance, never name an
 * entity, a premise, or a conclusion), so concealment is trivially safe;
 * the classifier × DAG interaction decides WHEN, never WHAT.
 *
 * Rules (deterministic given sensor output + engine DAG state):
 *   (a) CONFRONT — label = mirror (residual) AND an incompatible partner
 *       of the mirror is derivable from the learner's own grounded record.
 *   (b) REPAIR — label = a lemma chain AND that chain holds a lemma that
 *       REGRESSED since it first grounded and is still ungrounded.
 *   (c) otherwise didactic (no block; off-rule turns are byte-identical
 *       to a run without the router).
 *
 * The sensor is the Phase-A-audited deterministic lexical classifier
 * (messageClassifier.js, 87.2% chain-level) — no LLM judge anywhere in
 * the loop; every decision is replayable from the transcript.
 */

export const REGISTER_BLOCKS = Object.freeze({
  didactic: null,
  repair:
    'REPAIR REGISTER (this turn): ground the learner has already established has slipped — slow down, return to what THEY once had on their own record, and rebuild it from their entries before adding anything new. Consolidate; do not advance.',
  confront:
    'CONFRONT REGISTER (this turn): the learner keeps reaching for the ready verdict while their own record now holds what cannot stand with it. Name that tension plainly — set what they themselves have established against the answer they keep reaching for, and ask them to hold both at once. Press the contradiction; add no new matter.',
});

/** Pure rule — unit-tested directly; the criterial core of the router. */
export function decideRegister({ label, partnerDerivable, regressedChains, chainOf }) {
  if (label === 'mirror' && partnerDerivable) return 'confront';
  if (label && label !== 'mirror' && label !== 'neither') {
    const chain = chainOf?.get ? chainOf.get(label) || label : label;
    if (regressedChains?.has && regressedChains.has(chain)) return 'repair';
  }
  return 'didactic';
}

export function normalizeRegisterRouterConfig(raw) {
  if (!raw) return null;
  const src = raw === true || raw === 'on' ? {} : typeof raw === 'string' ? JSON.parse(raw) : raw;
  const config = { mockLabel: null, mockDagState: false };
  // test-only knobs: force the sensor label and/or the DAG conjuncts so
  // zero-paid gates exercise both fire paths deterministically (mock
  // learner dialogue carries no chain vocabulary and mock pace gives the
  // mirror-partner window zero width). The real backend never sets these.
  if (typeof src.mockLabel === 'string') config.mockLabel = src.mockLabel;
  if (typeof src.mockDagState === 'boolean') config.mockDagState = src.mockDagState;
  return config;
}
