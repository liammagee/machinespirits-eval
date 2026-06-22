/**
 * Proof-debt hygiene for unreliable-learner derivation runs.
 *
 * A debt is not "anything decayed." It is an already-released, currently
 * decayed premise whose restoration would improve the authoritative
 * derivation distance. The tutor-facing view is intentionally narrower than
 * the audit report: it names only the released exhibit to restore, not the
 * hidden learner board, corruption ledger, proof path, or secret.
 */

import { entails, factKey } from './chainer.js';
import { derivationDistance } from './slope.js';

function renderFact(fact) {
  return fact.join(' ');
}

export function proofDebtReport(world, { grounded, releasedIdByKey, turn }) {
  const validFacts = [...grounded.values()].filter((entry) => entry.valid && !entry.decayed).map((entry) => entry.fact);
  const dNow = derivationDistance(world, validFacts);
  const debts = [];

  for (const [key, premiseId] of releasedIdByKey) {
    const entry = grounded.get(key);
    if (!entry?.valid || !entry.decayed) continue;
    const premise = world.premiseById.get(premiseId);
    if (!premise) continue;
    const restoredFacts = [...validFacts, entry.fact];
    const dIfRestored = derivationDistance(world, restoredFacts);
    const closesProof = entails(restoredFacts, world.rules, world.secret.fact);
    const deltaD = Number.isFinite(dNow) && Number.isFinite(dIfRestored) ? dNow - dIfRestored : 0;
    if (deltaD <= 0 && !closesProof) continue;
    debts.push({
      premiseId,
      fact: entry.fact,
      surface: premise.surface || renderFact(entry.fact),
      sinceTurn: entry.decayTurn ?? null,
      dNow,
      dIfRestored,
      deltaD,
      closesProof,
    });
  }

  debts.sort(
    (a, b) =>
      (b.closesProof ? 1 : 0) - (a.closesProof ? 1 : 0) ||
      b.deltaD - a.deltaD ||
      (a.sinceTurn ?? Infinity) - (b.sinceTurn ?? Infinity) ||
      a.premiseId.localeCompare(b.premiseId),
  );

  return { turn, active: debts.length > 0, dNow, debts };
}

export function tutorProofDebtView(report) {
  if (!report?.active) return { active: false, debts: [] };
  return {
    active: true,
    debts: report.debts.map(({ premiseId, surface, sinceTurn }) => ({ premiseId, surface, sinceTurn })),
  };
}
