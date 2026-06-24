import { buildLearnerDagFromResult } from './learnerDag.js';

const PUBLIC_ROLES = new Set(['stage', 'director', 'tutor', 'learner']);

export const PUBLIC_FORMALISM_RE =
  /\b[a-z]+[A-Z][A-Za-z0-9]*\b|\?[a-zA-Z_][a-zA-Z0-9_]*|[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)|\bD\s*=\s*\d/u;

export function formatFact(fact) {
  if (!Array.isArray(fact)) return String(fact ?? '');
  const [predicate, ...args] = fact;
  return args.length ? `${predicate}(${args.join(', ')})` : String(predicate ?? '');
}

function text(value) {
  return String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
}

function premiseMap(world = {}) {
  if (world.premiseById instanceof Map) return world.premiseById;
  return new Map((world.premises || []).map((premise) => [premise.id, premise]));
}

function releaseMap(world = {}) {
  const map = new Map();
  for (const entry of world.releaseSchedule || []) {
    map.set(entry.premise, entry);
  }
  return map;
}

function ruleProfile(rule = {}) {
  return {
    id: rule.id || null,
    gloss: text(rule.gloss),
    if: (rule.if || []).map(formatFact),
    then: (rule.then || []).map(formatFact),
  };
}

function premiseProfile(id, world, releases) {
  const premise = premiseMap(world).get(id) || { id };
  const release = releases.get(id) || null;
  return {
    id,
    fact: Array.isArray(premise.fact) ? premise.fact : null,
    factText: formatFact(premise.fact),
    surface: text(premise.surface),
    releaseTurn: release?.turn ?? null,
    releaseVia: release?.via ?? null,
    scheduled: Boolean(release),
  };
}

function pathName(path, index) {
  return path.id || path.name || path.label || `path_${index + 1}`;
}

function pathProfile(path, index, world, releases) {
  const premiseIds = Array.isArray(path?.premises) ? path.premises : [];
  const premises = premiseIds.map((id) => premiseProfile(id, world, releases));
  const releaseTurns = premises.map((premise) => premise.releaseTurn).filter(Number.isFinite);
  const completeTurn =
    releaseTurns.length === premiseIds.length && releaseTurns.length ? Math.max(...releaseTurns) : null;
  return {
    id: pathName(path || {}, index),
    index,
    premiseIds,
    premises,
    premiseCount: premiseIds.length,
    scheduledPremiseCount: premises.filter((premise) => premise.scheduled).length,
    completeByTurn: completeTurn,
    scheduled: completeTurn !== null,
  };
}

export function profileProofDag(world) {
  if (!world) return null;
  const releases = releaseMap(world);
  const paths = (world.proofPaths || []).map((path, index) => pathProfile(path, index, world, releases));
  const proofPremiseIds = new Set(paths.flatMap((path) => path.premiseIds));
  const scheduledProofPremiseIds = [...proofPremiseIds].filter((id) => releases.has(id));
  const releasedRows = (world.releaseSchedule || []).map((entry) => {
    const premise = premiseProfile(entry.premise, world, releases);
    return {
      turn: entry.turn,
      via: entry.via,
      premiseId: entry.premise,
      factText: premise.factText,
      surface: premise.surface,
      proofPremise: proofPremiseIds.has(entry.premise),
    };
  });
  const completeTurns = paths.map((path) => path.completeByTurn).filter(Number.isFinite);
  const earliestCompleteTurn = completeTurns.length ? Math.min(...completeTurns) : null;
  const secret = {
    fact: Array.isArray(world.secret?.fact) ? world.secret.fact : null,
    factText: formatFact(world.secret?.fact),
    surface: text(world.secret?.surface),
  };
  const mirror = world.mirror
    ? {
        fact: Array.isArray(world.mirror.fact) ? world.mirror.fact : null,
        factText: formatFact(world.mirror.fact),
        surface: text(world.mirror.surface),
      }
    : null;
  const metrics = {
    pathCount: paths.length,
    uniqueProofPremiseCount: proofPremiseIds.size,
    scheduledProofPremiseCount: scheduledProofPremiseIds.length,
    ruleCount: (world.rules || []).length,
    releaseCount: (world.releaseSchedule || []).length,
    shortestPathPremises: paths.length ? Math.min(...paths.map((path) => path.premiseCount)) : 0,
    longestPathPremises: paths.length ? Math.max(...paths.map((path) => path.premiseCount)) : 0,
    earliestCompleteTurn,
    tMin: world.slope?.t_min ?? null,
    turnCap: world.turnCap ?? null,
  };
  const summary = `${world.title || world.id}: ${metrics.pathCount} authored proof path${
    metrics.pathCount === 1 ? '' : 's'
  } to ${secret.factText}; ${metrics.scheduledProofPremiseCount}/${metrics.uniqueProofPremiseCount} proof premises scheduled; ${
    metrics.ruleCount
  } public rule${metrics.ruleCount === 1 ? '' : 's'}.`;
  return {
    schema: 'machinespirits.derivation.human-readable-dag.v1',
    worldId: world.id || null,
    title: world.title || world.id || 'Untitled world',
    question: text(world.question),
    secret,
    mirror,
    metrics,
    paths,
    releases: releasedRows,
    rules: (world.rules || []).map(ruleProfile),
    summary,
  };
}

export function publicLines(live = {}) {
  const out = [];
  for (const turn of Array.isArray(live?.turns) ? live.turns : []) {
    for (const line of Array.isArray(turn.lines) ? turn.lines : []) {
      if (!PUBLIC_ROLES.has(line.role)) continue;
      const lineText = text(line.text);
      if (!lineText) continue;
      out.push({
        turn: turn.turn,
        role: line.role === 'director' ? 'stage' : line.role,
        text: lineText,
        exchangeType: turn.exchange?.type || line.meta?.exchange?.type || null,
      });
    }
  }
  return out;
}

function countBy(values) {
  return values.reduce((acc, value) => {
    const key = value || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function releaseDeviationCount(releaseAdherence = {}) {
  return (
    (releaseAdherence.deviations?.length || 0) +
    (releaseAdherence.missed?.length || 0) +
    (releaseAdherence.unscheduled?.length || 0)
  );
}

function lastD({ live = {}, result = {}, diagnosis = {} }) {
  const finalTurn = Array.isArray(live.turns) ? live.turns.at(-1) : null;
  if (Number.isFinite(finalTurn?.D)) return finalTurn.D;
  const trajectory = Array.isArray(result.trajectory) ? result.trajectory : [];
  const lastPoint = trajectory.at(-1);
  if (Number.isFinite(lastPoint?.D)) return lastPoint.D;
  const dCurve = Array.isArray(diagnosis.dCurve) ? diagnosis.dCurve : [];
  const lastCurve = dCurve.at(-1);
  return Number.isFinite(lastCurve) ? lastCurve : null;
}

export function deriveProofGate({ live = {}, result = {}, diagnosis = {}, label = null } = {}) {
  const releaseAdherence = diagnosis.releaseAdherence || {};
  const finalD = lastD({ live, result, diagnosis });
  const verdict = result.verdict || live.verdict || diagnosis.verdict || null;
  const forcedTurn = result.firstForcedTurn ?? live.firstForcedTurn ?? diagnosis.firstForcedTurn ?? null;
  const assertedTurn =
    result.assertedGroundedTurn ?? live.assertedGroundedTurn ?? diagnosis.assertedGroundedTurn ?? null;
  const forcedAssertedGap =
    Number.isFinite(forcedTurn) && Number.isFinite(assertedTurn) ? assertedTurn - forcedTurn : null;
  const lines = publicLines(live);
  const formalismLeaks = lines.filter((line) => PUBLIC_FORMALISM_RE.test(line.text));
  const releaseDeviations = releaseDeviationCount(releaseAdherence);
  const grounded = verdict === 'grounded_anagnorisis';
  const gatePass = grounded && finalD === 0 && releaseDeviations === 0 && formalismLeaks.length === 0;
  return {
    schema: 'machinespirits.derivation.problem-solving-gate.v1',
    label,
    status: gatePass ? 'pass' : 'fail',
    verdict,
    turnsPlayed: result.turnsPlayed ?? live.turnsPlayed ?? diagnosis.turnsPlayed ?? live.turns?.length ?? null,
    finalD,
    firstForcedTurn: forcedTurn,
    assertedGroundedTurn: assertedTurn,
    forcedAssertedGap,
    releaseAdherence: {
      onCue: releaseAdherence.onCue ?? null,
      deviations: releaseAdherence.deviations || [],
      missed: releaseAdherence.missed || [],
      unscheduled: releaseAdherence.unscheduled || [],
      deviationCount: releaseDeviations,
    },
    publicFormalismLeakCount: formalismLeaks.length,
    publicFormalismLeaks: formalismLeaks.slice(0, 10),
    overreach: diagnosis.fabricatedFacts?.count ?? diagnosis.overreach ?? null,
    luckyLeap: diagnosis.luckyLeap ?? null,
    interpretation:
      'This gate measures problem-solving ability of the public derivation discourse: grounded assertion under proof/release constraints. Rubric scores are secondary quality measures.',
  };
}

export function summarizeDialogue(live = {}, diagnosis = {}) {
  const lines = publicLines(live);
  const tutor = lines.filter((line) => line.role === 'tutor');
  const learner = lines.filter((line) => line.role === 'learner');
  const words = (value) =>
    String(value || '')
      .split(/\s+/u)
      .filter(Boolean).length;
  const avg = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
  return {
    publicLineCount: lines.length,
    tutorLines: tutor.length,
    learnerLines: learner.length,
    avgTutorWords: Number(avg(tutor.map((line) => words(line.text))).toFixed(1)),
    avgLearnerWords: Number(avg(learner.map((line) => words(line.text))).toFixed(1)),
    exchangeTypes:
      diagnosis.scenes?.exchangeTypes || countBy((live.turns || []).map((turn) => turn.exchange?.type || 'unknown')),
    sceneCount: diagnosis.scenes?.count ?? null,
    avgSceneExchanges: diagnosis.scenes?.avgExchanges ?? null,
    recognitionNeed: diagnosis.scenes?.recognitionNeed || null,
    phaticRecognition: diagnosis.scenes?.phaticRecognition || null,
  };
}

export function renderHumanDagMarkdown(profile) {
  if (!profile) return 'No authored proof DAG profile is available.';
  const lines = [
    `# ${profile.title}`,
    '',
    profile.summary,
    '',
    `Question: ${profile.question || 'n/a'}`,
    `Secret: ${profile.secret.surface || profile.secret.factText || 'n/a'}`,
    profile.mirror ? `Mirror: ${profile.mirror.surface || profile.mirror.factText || 'n/a'}` : null,
    '',
    '## Metrics',
    '',
    `- Paths: ${profile.metrics.pathCount}`,
    `- Unique proof premises: ${profile.metrics.uniqueProofPremiseCount}`,
    `- Scheduled proof premises: ${profile.metrics.scheduledProofPremiseCount}`,
    `- Rules: ${profile.metrics.ruleCount}`,
    `- Earliest complete path turn: ${profile.metrics.earliestCompleteTurn ?? 'n/a'}`,
    '',
    '## Authored Proof Paths',
    '',
  ].filter((line) => line !== null);
  for (const path of profile.paths) {
    lines.push(`### ${path.id}`, '');
    lines.push(`Completes by turn: ${path.completeByTurn ?? 'unscheduled'}`, '');
    for (const premise of path.premises) {
      const release = premise.scheduled ? `turn ${premise.releaseTurn} via ${premise.releaseVia}` : 'unscheduled';
      lines.push(`- ${premise.id} (${release}): ${premise.surface || premise.factText}`);
    }
    lines.push('');
  }
  lines.push('## Public Rules', '');
  for (const rule of profile.rules) {
    lines.push(`- ${rule.id}: ${rule.gloss || `${rule.if.join(' + ')} -> ${rule.then.join(', ')}`}`);
  }
  lines.push('');
  return `${lines.join('\n')}`;
}

export function buildDerivationAssessment({ label = null, live = {}, result = {}, diagnosis = {}, world = null } = {}) {
  const learnerDag = result.learnerDag || buildLearnerDagFromResult(world, result);
  return {
    schema: 'machinespirits.derivation.assessment.v1',
    label,
    worldId: world?.id || result.worldId || live.worldId || diagnosis.worldId || null,
    proofGate: deriveProofGate({ live, result, diagnosis, label }),
    dagProfile: profileProofDag(world),
    learnerDag,
    learnerDagAssessment: learnerDag?.assessment || null,
    dialogueSummary: summarizeDialogue(live, diagnosis),
    authority: {
      proofGate: 'mechanical',
      dagProfile: 'authored_world_spec',
      learnerDag: learnerDag?.source || null,
      externalAssessment: 'advisory',
    },
    interpretation:
      'Assessment is external to the proof DAG: the gate checks derivability and release discipline; human or model rubrics can then judge the discourse quality around that proof-safe run.',
  };
}
