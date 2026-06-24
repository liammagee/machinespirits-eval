import { pacingGuardDecision } from './pacing.js';
import { tutorProofDebtView } from './proofDebt.js';

export const RUNTIME_MONITOR_SCHEMA = 'dramatic-derivation.runtime-monitor.v0';

const PROOF_DEBT_ALLOWED_FIELDS = new Set(['premiseId', 'surface', 'sinceTurn']);
const PROOF_DEBT_FORBIDDEN_FIELDS = new Set(['raw_board', 'corruption_ledger', 'proof_path', 'secret', 'D_arithmetic']);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`derivation.runtimeMonitor: ${label} must be an object`);
  }
  return value;
}

function sameWorld(world, guardSpec) {
  return world?.id && guardSpec?.world?.id && world.id === guardSpec.world.id;
}

function hiddenGuard(spec) {
  return requireObject(requireObject(spec.guards, 'guards').hidden_pacing, 'guards.hidden_pacing');
}

function proofDebtGuard(spec) {
  return requireObject(requireObject(spec.guards, 'guards').proof_debt, 'guards.proof_debt');
}

function validateProofDebtSpec(spec) {
  const guard = proofDebtGuard(spec);
  const exposed = guard.exposeToTutor || [];
  const forbidden = guard.forbid || [];
  if (!Array.isArray(exposed) || !exposed.length) {
    throw new Error('derivation.runtimeMonitor: proof_debt.exposeToTutor must be a non-empty array');
  }
  for (const field of exposed) {
    if (!PROOF_DEBT_ALLOWED_FIELDS.has(field)) {
      throw new Error(`derivation.runtimeMonitor: proof_debt exposes unsupported tutor field "${field}"`);
    }
  }
  for (const field of PROOF_DEBT_FORBIDDEN_FIELDS) {
    if (!forbidden.includes(field)) {
      throw new Error(`derivation.runtimeMonitor: proof_debt.forbid must include "${field}"`);
    }
  }
  return { exposed, forbidden };
}

function stripProofDebtView(report, exposeToTutor) {
  const base = tutorProofDebtView(report);
  if (!base.active) return base;
  return {
    active: true,
    debts: base.debts.map((debt) =>
      Object.fromEntries(exposeToTutor.filter((field) => field in debt).map((field) => [field, debt[field]])),
    ),
  };
}

function proofDebtLeaks(view, forbidden = []) {
  const forbiddenKeys = new Set([
    'fact',
    'dNow',
    'dIfRestored',
    'deltaD',
    'closesProof',
    'proofPath',
    'rawBoard',
    'corruptionLedger',
    'secret',
    ...forbidden,
  ]);
  const leaks = [];
  for (const [index, debt] of (view?.debts || []).entries()) {
    for (const key of Object.keys(debt || {})) {
      if (forbiddenKeys.has(key)) leaks.push({ debtIndex: index, key });
    }
  }
  return leaks;
}

export function createRuntimeMonitor(world, guardSpec) {
  requireObject(world, 'world');
  requireObject(guardSpec, 'guardSpec');
  if (!sameWorld(world, guardSpec)) {
    throw new Error(
      `derivation.runtimeMonitor: GuardSpec world ${JSON.stringify(guardSpec.world?.id)} does not match ${JSON.stringify(
        world.id,
      )}`,
    );
  }
  if (guardSpec.compiler?.onlineLlmGuardAuthoring !== false) {
    throw new Error('derivation.runtimeMonitor: GuardSpec must forbid online LLM guard authoring');
  }

  const hidden = hiddenGuard(guardSpec);
  const proofDebt = validateProofDebtSpec(guardSpec);
  const releaseLatitude = Number.isInteger(hidden.releaseLatitude) ? hidden.releaseLatitude : 2;
  const corridorPremises = new Set((hidden.releaseCorridors || []).map((row) => row.premise).filter(Boolean));

  return {
    schema: RUNTIME_MONITOR_SCHEMA,
    worldId: world.id,
    guardSpecSchema: guardSpec.schema,
    releaseLatitude,
    hiddenPacing: {
      objective: hidden.objective,
      corridorPremises: [...corridorPremises].sort(),
    },
    proofDebt: {
      exposeToTutor: [...proofDebt.exposed],
      forbid: [...proofDebt.forbidden],
    },

    hiddenPacingDecision({ ledger = [], turn, playable = [], validClaim = null, forcedPlay = null, lambda = 0 } = {}) {
      const scopedPlayable = playable.filter((entry) => corridorPremises.has(entry.premise));
      const scopedClaim = validClaim && corridorPremises.has(validClaim) ? validClaim : null;
      const scopedForced = forcedPlay && corridorPremises.has(forcedPlay.premise) ? forcedPlay : null;
      return {
        ...pacingGuardDecision(world, ledger, {
          turn,
          playable: scopedPlayable,
          validClaim: scopedClaim,
          forcedPlay: scopedForced,
          latitude: releaseLatitude,
          lambda,
        }),
        runtimeMonitor: {
          schema: RUNTIME_MONITOR_SCHEMA,
          guard: 'hidden_pacing',
          guardSpecSchema: guardSpec.schema,
          releaseLatitude,
        },
      };
    },

    proofDebtTutorView(report) {
      return stripProofDebtView(report, proofDebt.exposed);
    },

    auditProofDebtTutorView(view) {
      const leaks = proofDebtLeaks(view, proofDebt.forbidden);
      return {
        ok: leaks.length === 0,
        leaks,
        allowedFields: [...proofDebt.exposed],
      };
    },
  };
}
