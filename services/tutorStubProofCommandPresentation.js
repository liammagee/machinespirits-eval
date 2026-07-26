const PROOF_DAG_ARTIFACT_PATH_ROWS = Object.freeze([
  Object.freeze(['operator guide', 'docs/proof-dag-verification-and-inspection.md']),
  Object.freeze(['Lean certificate', 'tools/proof-dag-lean/ProofDag/Generated/World001Nocturne.lean']),
  Object.freeze(['authored graph', 'tools/proof-dag-semantic-web/Generated/World001Nocturne/authored.ttl']),
  Object.freeze(['learner graph', 'tools/proof-dag-semantic-web/Generated/World001Nocturne/learner-proxy.ttl']),
  Object.freeze(['tutor graph', 'tools/proof-dag-semantic-web/Generated/World001Nocturne/tutor-model.ttl']),
  Object.freeze(['combined graph', 'tools/proof-dag-semantic-web/Generated/World001Nocturne/proof-dags.trig']),
  Object.freeze(['SHACL report', 'tools/proof-dag-semantic-web/Generated/World001Nocturne/validation-report.json']),
]);

function presentationColors(colors = {}) {
  return {
    bold: colors.bold || '',
    brightBlue: colors.brightBlue || '',
    brightCyan: colors.brightCyan || '',
    brightMagenta: colors.brightMagenta || '',
    cyan: colors.cyan || '',
    dim: colors.dim || '',
    reset: colors.reset || '',
  };
}

export function projectTutorStubProofDagArtifactPaths({ colors = {} } = {}) {
  const C = presentationColors(colors);
  const rows = PROOF_DAG_ARTIFACT_PATH_ROWS.map((row) => [...row]);
  const lines = [
    `${C.brightCyan}${C.bold}proof-DAG artifacts >${C.reset} deterministic Nocturne fixture`,
    ...rows.map(([label, file]) => `${C.dim}  ${label}: ${file}${C.reset}`),
    `${C.dim}  authored files contain private world truth; learner and tutor files must remain public-only${C.reset}\n`,
  ];
  return Object.freeze({ rows, lines: Object.freeze(lines) });
}

export function projectTutorStubProofDagSemanticLayerLines({ result, layer, colors = {} } = {}) {
  const C = presentationColors(colors);
  const graph = result.validation.graphs[layer];
  if (layer === 'authored') {
    return Object.freeze([
      `${C.brightMagenta}${C.bold}authored >${C.reset} private authority graph`,
      `${C.dim}  ${graph.quadCount} quads · SHACL ${graph.conforms ? 'conforms' : 'fails'} · ${result.world.premises.length} premises · ${result.world.rules.length} rules · ${result.world.proofPaths.length} positive proof paths${C.reset}`,
      `${C.dim}  raw: tools/proof-dag-semantic-web/Generated/World001Nocturne/authored.ttl (contains the secret and authored identifiers)${C.reset}`,
    ]);
  }
  if (layer === 'learner') {
    const projection = result.projections.learnerProxyDag;
    const metrics = projection.metrics || {};
    return Object.freeze([
      `${C.cyan}${C.bold}learner >${C.reset} public-only proxy graph at fixture turn ${projection.turn}`,
      `${C.dim}  ${graph.quadCount} quads · SHACL ${graph.conforms ? 'conforms' : 'fails'} · ${metrics.groundedCount || 0} grounded · ${metrics.voicedDerivedCount || 0} voiced · ${metrics.hypothesisCount || 0} hypotheses · ${metrics.answerCandidateCount || 0} answers${C.reset}`,
      `${C.dim}  source redaction audit passed · raw: tools/proof-dag-semantic-web/Generated/World001Nocturne/learner-proxy.ttl${C.reset}`,
    ]);
  }
  const projection = result.projections.tutorLearnerDagModel;
  const assessment = projection.assessment || {};
  return Object.freeze([
    `${C.brightBlue}${C.bold}tutor >${C.reset} public-only advisory model at fixture turn ${projection.turn}`,
    `${C.dim}  ${graph.quadCount} quads · SHACL ${graph.conforms ? 'conforms' : 'fails'} · best-path coverage ${assessment.bestPathCoverage ?? 0} · bottleneck ${assessment.bottleneck || 'none'} · ${assessment.missingPremiseCount || 0} missing premises (counts only)${C.reset}`,
    `${C.dim}  source redaction audit passed · raw: tools/proof-dag-semantic-web/Generated/World001Nocturne/tutor-model.ttl${C.reset}`,
  ]);
}
