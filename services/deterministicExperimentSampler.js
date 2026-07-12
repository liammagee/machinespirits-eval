import { createHash } from 'node:crypto';

export const DETERMINISTIC_EXPERIMENT_DRAW_SCHEMA = 'machinespirits.deterministic-experiment-draw.v1';
export const DETERMINISTIC_EXPERIMENT_ALGORITHM = 'sha256-keyed-unit-v1';

function jsonClone(value) {
  if (value === undefined) return undefined;
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('deterministic sampler material must be JSON serializable');
  return JSON.parse(encoded);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

function canonicalMaterial(value) {
  return JSON.stringify(sortJson(jsonClone(value)));
}

function digestFor(masterSeed, material) {
  return createHash('sha256').update(canonicalMaterial({ masterSeed, material })).digest('hex');
}

export function deriveDeterministicSeed(masterSeed, material) {
  const digest = digestFor(masterSeed, material);
  return Number.parseInt(digest.slice(0, 8), 16) >>> 0;
}

export function deterministicUnit(masterSeed, material) {
  const digest = digestFor(masterSeed, material);
  return Number.parseInt(digest.slice(0, 13), 16) / 0x10000000000000;
}

function normalizeDistribution(distribution) {
  if (!Array.isArray(distribution) || distribution.length === 0) {
    throw new Error('deterministic choice requires a non-empty distribution');
  }
  const rows = distribution.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Object.hasOwn(entry, 'value')) {
      throw new Error(`distribution[${index}] must contain value and weight`);
    }
    const weight = Number(entry.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error(`distribution[${index}].weight must be a finite non-negative number`);
    }
    return { value: jsonClone(entry.value), weight };
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!(total > 0)) throw new Error('deterministic choice requires at least one positive weight');
  let allocated = 0;
  return rows.map((row, index) => {
    const probability = index === rows.length - 1 ? 1 - allocated : row.weight / total;
    allocated += probability;
    return { ...row, probability };
  });
}

export function deterministicChoice(distribution, { masterSeed, material } = {}) {
  if (masterSeed === undefined || masterSeed === null || String(masterSeed).trim() === '') {
    throw new Error('deterministic choice requires masterSeed');
  }
  if (!material || typeof material !== 'object' || Array.isArray(material)) {
    throw new Error('deterministic choice requires object material');
  }
  const normalized = normalizeDistribution(distribution);
  const draw = deterministicUnit(masterSeed, material);
  let cumulative = 0;
  let selectedIndex = normalized.length - 1;
  for (let index = 0; index < normalized.length; index += 1) {
    cumulative += normalized[index].probability;
    if (draw < cumulative) {
      selectedIndex = index;
      break;
    }
  }
  return {
    schema: DETERMINISTIC_EXPERIMENT_DRAW_SCHEMA,
    algorithm: DETERMINISTIC_EXPERIMENT_ALGORITHM,
    masterSeed: jsonClone(masterSeed),
    material: jsonClone(material),
    seedMaterial: canonicalMaterial({ masterSeed, material }),
    seed: deriveDeterministicSeed(masterSeed, material),
    draw,
    distribution: normalized,
    selectedIndex,
    selectedValue: jsonClone(normalized[selectedIndex].value),
  };
}

export function replayDeterministicChoice(record) {
  if (!record || typeof record !== 'object') throw new Error('deterministic draw record is required');
  const replayed = deterministicChoice(record.distribution, {
    masterSeed: record.masterSeed,
    material: record.material,
  });
  const matches =
    replayed.seed === record.seed &&
    replayed.draw === record.draw &&
    replayed.selectedIndex === record.selectedIndex &&
    canonicalMaterial(replayed.selectedValue) === canonicalMaterial(record.selectedValue);
  return { matches, recorded: jsonClone(record), replayed };
}
