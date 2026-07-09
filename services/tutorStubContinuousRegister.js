const DEFAULT_VECTOR_LIMIT = 4;

function roundWeight(value) {
  return Number(Number(value || 0).toFixed(4));
}

function isSafeContinuousAnchor(definition = {}) {
  return definition.router_selectable === true && definition.simulated_only !== true && definition.valence !== 'negative';
}

function normalizeVectorRows(rows) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.rawWeight) || 0), 0);
  if (!total) return [];
  const normalized = rows.map((row) => ({
    ...row,
    weight: roundWeight(Math.max(0, Number(row.rawWeight) || 0) / total),
  }));
  const delta = roundWeight(1 - normalized.reduce((sum, row) => sum + row.weight, 0));
  if (normalized.length && delta) {
    normalized[normalized.length - 1] = {
      ...normalized[normalized.length - 1],
      weight: roundWeight(normalized[normalized.length - 1].weight + delta),
    };
  }
  return normalized.map((row) => ({
    register: row.register,
    weight: row.weight,
    probability: row.weight,
    sourceScore: roundWeight(row.rawWeight),
  }));
}

function entropyBits(rows) {
  const entropy = rows.reduce((sum, row) => {
    const p = Number(row.weight);
    return p > 0 ? sum - p * Math.log2(p) : sum;
  }, 0);
  return Number(entropy.toFixed(3));
}

function dominantBlend(rows) {
  return rows.map((row) => `${row.register} ${Math.round(Number(row.weight || 0) * 100)}%`).join(', ');
}

function fallbackRows({ palette = [], definitions = {}, allowUnsafe = false }) {
  const selected =
    palette.find((register) => allowUnsafe || isSafeContinuousAnchor(definitions[register] || {})) ||
    ['precise', 'plain', 'warm'].find((register) => definitions[register]) ||
    'precise';
  return [
    {
      register: selected,
      weight: 1,
      probability: 1,
      sourceScore: 1,
    },
  ];
}

export function buildContinuousRegisterVector({
  scores = {},
  palette = Object.keys(scores || {}),
  definitions = {},
  allowUnsafe = false,
  limit = DEFAULT_VECTOR_LIMIT,
} = {}) {
  const paletteSet = new Set((palette || []).map(String).filter(Boolean));
  const candidates = Object.entries(scores || {})
    .filter(([register]) => !paletteSet.size || paletteSet.has(register))
    .filter(([register]) => allowUnsafe || isSafeContinuousAnchor(definitions[register] || {}))
    .map(([register, score]) => ({
      register,
      rawWeight: Math.max(0, Number(score) || 0),
    }))
    .filter((row) => row.rawWeight > 0)
    .sort((a, b) => b.rawWeight - a.rawWeight || a.register.localeCompare(b.register))
    .slice(0, Math.max(1, Number(limit) || DEFAULT_VECTOR_LIMIT));

  const rows = normalizeVectorRows(candidates);
  const vectorRows = rows.length ? rows : fallbackRows({ palette: [...paletteSet], definitions, allowUnsafe });
  const vector = Object.fromEntries(vectorRows.map((row) => [row.register, row.weight]));
  return {
    schema: 'machinespirits.tutor-stub.continuous-register-vector.v1',
    vector,
    rows: vectorRows,
    selectedRegister: vectorRows[0]?.register || 'precise',
    selectedProbability: vectorRows[0]?.weight ?? 1,
    entropyBits: entropyBits(vectorRows),
    dominantBlend: dominantBlend(vectorRows),
    limit: Math.max(1, Number(limit) || DEFAULT_VECTOR_LIMIT),
    allowUnsafe,
  };
}

export function continuousRegisterStyleInstruction(blend, definitions = {}) {
  const rows = Array.isArray(blend?.rows) ? blend.rows : [];
  if (!rows.length) return '';
  const anchorLines = rows.slice(0, 3).map((row) => {
    const contract = String(definitions[row.register]?.stance_contract || '').trim().replace(/\s+/gu, ' ');
    return `- ${Math.round(Number(row.weight || 0) * 100)}% ${row.register}: ${contract || 'Use this anchor as subtle stance modulation.'}`;
  });
  return [
    'Continuous register blend:',
    dominantBlend(rows),
    'Use the highest-weight anchor as the main stance and the lower-weight anchors as subtle modulation.',
    'Do not name the blend, register weights, classifier, or learner-DAG machinery to the learner.',
    ...anchorLines,
  ].join('\n');
}

export function buildContinuousRegisterPolicyMetadata({
  blend,
  useCorpusPrior = false,
  empirical = null,
  corpusEmpirical = null,
  styleInstruction = '',
} = {}) {
  return {
    schema: 'machinespirits.tutor-stub.continuous-register-policy.v1',
    mapping: {
      type: useCorpusPrior
        ? 'continuous_softmax_affinity_matrix_with_local_and_corpus_empirical_correction'
        : 'continuous_softmax_affinity_matrix_with_empirical_correction',
      source_policy: useCorpusPrior ? 'empirical_dynamical_system' : 'dynamical_system',
      vector_limit: blend?.limit ?? DEFAULT_VECTOR_LIMIT,
      unsafe_registers_allowed: blend?.allowUnsafe === true,
      anchor_filter: blend?.allowUnsafe === true ? 'active_palette' : 'router_selectable_non_simulated_non_negative',
    },
    register_vector: blend?.vector || {},
    register_vector_rows: Array.isArray(blend?.rows) ? blend.rows : [],
    entropy_bits: blend?.entropyBits ?? 0,
    dominant_blend: blend?.dominantBlend || '',
    selected_anchor: blend?.selectedRegister || null,
    style_instruction: styleInstruction,
    empirical,
    corpus_empirical: corpusEmpirical,
  };
}
