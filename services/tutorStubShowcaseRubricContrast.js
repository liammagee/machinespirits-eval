/**
 * Rubric-versus-rubric statistics for the showcase page.
 *
 * The page already reports v2.2 and v3.0 side by side under a hard rule that
 * nothing averages one into the other. That rule answers "may I pool them?" but
 * leaves the question a reader actually asks next: which instrument is telling
 * me more? This module answers it from the artefacts themselves — spread,
 * resolution, how redundant a version's own dimensions are, and how far the two
 * versions agree on the same turns.
 *
 * Everything here is descriptive. A showcase run scores two turns per dialogue
 * across a handful of dialogues, so every statistic below rests on single-digit
 * n. `sampleWarning` carries that fact to the renderer, which is required to
 * print it beside the numbers: an inter-dimension correlation matrix over eight
 * dimensions and eight turns is rank-deficient by construction, and a factor
 * share computed from it describes this table rather than the instrument. These
 * are readings of one run, not properties of a rubric.
 *
 * Pure: no fs, no rendering, no config. Takes the overlay the page already
 * builds and returns plain data.
 */

/**
 * Below this many complete observations a statistic is not reported at all
 * rather than reported with a caveat. Two points always correlate perfectly and
 * a standard deviation over two turns is a rounding of the gap between them.
 */
const MIN_OBSERVATIONS = 3;

/**
 * At or below this many turns every derived statistic is small-sample. Kept as a
 * named threshold because the renderer needs to decide whether to print the
 * warning, and duplicating the number there is how the page and the data start
 * disagreeing about their own reliability.
 */
const SMALL_SAMPLE_MAX = 20;

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Population standard deviation, not the sample estimator. The scored turns are
 * not a sample drawn from a population of turns this run could have produced —
 * they are every turn the judge was asked about. Dividing by n - 1 would be
 * inflating a spread to generalise beyond a set that has no beyond.
 */
function standardDeviation(values) {
  if (values.length < 2) return null;
  const mu = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - mu) ** 2)));
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Pearson r over pairwise-complete observations. Returns `null` rather than 0
 * when either side has no variance: a dimension the judge scored 5 on every turn
 * is not uncorrelated with the others, it is unmeasured on this run, and 0 would
 * read as evidence of independence.
 */
function pearson(xs, ys) {
  const pairs = xs.map((x, index) => [x, ys[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (pairs.length < MIN_OBSERVATIONS) return null;
  const mx = mean(pairs.map(([x]) => x));
  const my = mean(pairs.map(([, y]) => y));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function scoredRows(side) {
  return Object.values(side?.byTurn || {})
    .filter((row) => row.success && Number.isFinite(row.overallScore))
    .sort((a, b) => `${a.dialogueId}#${a.turnIndex}`.localeCompare(`${b.dialogueId}#${b.turnIndex}`));
}

/**
 * Dimension keys in first-seen order across the rows. Read from the artefact
 * rather than from the rubric YAML on purpose: the page renders artefacts that
 * may have been produced under an earlier revision of a rubric file, and a
 * dimension list taken from today's config would silently relabel yesterday's
 * numbers.
 */
function dimensionKeys(rows) {
  const keys = [];
  for (const row of rows) {
    for (const key of Object.keys(row.scores || {})) if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/**
 * A dimension's raw scores across turns, with `not_applicable` verdicts removed.
 * The judge declaring a dimension inapplicable is a decision about the turn, not
 * a missing reading, but it is still absent from the numeric distribution — so
 * it is counted separately and excluded from the spread.
 */
function dimensionSeries(rows, key) {
  const values = [];
  let notApplicable = 0;
  for (const row of rows) {
    const entry = row.scores?.[key];
    if (entry?.not_applicable === true) {
      notApplicable += 1;
      values.push(null);
      continue;
    }
    values.push(Number.isFinite(entry?.score) ? entry.score : null);
  }
  return { values, notApplicable };
}

function describeSpread(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return { n: 0, mean: null, sd: null, min: null, max: null, range: null, distinct: 0 };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return {
    n: finite.length,
    mean: mean(finite),
    sd: standardDeviation(finite),
    min,
    max,
    range: max - min,
    // Rounded before counting: two composites that differ in the fourth decimal
    // are one verdict rendered twice, not two distinguishable readings, and an
    // unrounded count would credit a rubric with resolution it does not have.
    distinct: new Set(finite.map((value) => Number(value.toFixed(1)))).size,
  };
}

/**
 * How much a version's own dimensions move together. High mean |r| across pairs
 * is the empirical claim v3.0 was built on — that v2.2's eight dimensions are
 * largely one judgment scored eight times — so the page can show whether this
 * run reproduces it instead of citing the redesign's own rationale back at the
 * reader.
 */
function describeRedundancy(rows, keys) {
  const pairs = [];
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const r = pearson(dimensionSeries(rows, keys[i]).values, dimensionSeries(rows, keys[j]).values);
      if (r === null) continue;
      pairs.push({ a: keys[i], b: keys[j], r });
    }
  }
  if (!pairs.length) return null;
  const magnitudes = pairs.map((pair) => Math.abs(pair.r));
  const sorted = [...pairs].sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return {
    pairs: pairs.length,
    // Pairs that could not be correlated at all — a dimension with no variance
    // makes every pair it belongs to unreportable, and the count of what was
    // dropped belongs beside the mean of what survived.
    pairsUnavailable: (keys.length * (keys.length - 1)) / 2 - pairs.length,
    meanAbsR: mean(magnitudes),
    medianAbsR: median(magnitudes),
    strongPairs: pairs.filter((pair) => Math.abs(pair.r) >= 0.8).length,
    strongest: sorted[0],
    weakest: sorted[sorted.length - 1],
  };
}

function versionLabel(side, fallback) {
  return String(side?.rubricVersion || fallback);
}

function describeVersion(side, fallbackVersion) {
  if (!side) return null;
  const rows = scoredRows(side);
  if (!rows.length) return null;
  const keys = dimensionKeys(rows);
  return {
    version: versionLabel(side, fallbackVersion),
    judge: side.judge || null,
    turnsScored: rows.length,
    dimensionCount: keys.length,
    composite: describeSpread(rows.map((row) => row.overallScore)),
    dimensions: keys.map((key) => {
      const { values, notApplicable } = dimensionSeries(rows, key);
      return { key, notApplicable, ...describeSpread(values) };
    }),
    redundancy: describeRedundancy(rows, keys),
  };
}

/**
 * Where the two versions land on the same turn. Agreement is reported as a
 * correlation over composites, which is a claim about ordering only: the scales
 * differ, so the two numbers for one turn are never expected to match and their
 * difference is not an error on either side.
 *
 * `divergences` is the more useful half. A pair of instruments that order turns
 * the same way but split hard on particular turns is telling you what each one
 * counts, and those turns are worth reading rather than averaging.
 */
function describeAgreement(v22Side, v30Side) {
  if (!v22Side || !v30Side) return null;
  const left = new Map(scoredRows(v22Side).map((row) => [`${row.dialogueId}#${row.turnIndex}`, row]));
  const paired = [];
  for (const row of scoredRows(v30Side)) {
    const match = left.get(`${row.dialogueId}#${row.turnIndex}`);
    if (match) paired.push({ a: match, b: row });
  }
  if (paired.length < MIN_OBSERVATIONS) return null;
  const r = pearson(
    paired.map((pair) => pair.a.overallScore),
    paired.map((pair) => pair.b.overallScore),
  );
  const divergences = paired
    .map((pair) => ({
      dialogueId: pair.a.dialogueId,
      scenarioId: pair.a.scenarioId,
      armId: pair.a.armId,
      baseline: Boolean(pair.a.baseline),
      turnLabel: pair.a.turnLabel,
      turnIndex: pair.a.turnIndex,
      left: pair.a.overallScore,
      right: pair.b.overallScore,
      gap: pair.b.overallScore - pair.a.overallScore,
    }))
    .sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
  return { n: paired.length, r, divergences };
}

/**
 * Build the whole contrast, or `null` when there is nothing to contrast. One
 * scored version still produces a result — its own spread and redundancy are
 * worth showing — but a page with no tutor-rubric artefact at all gets nothing
 * rather than an empty frame.
 */
export function buildShowcaseRubricContrast(overlay) {
  if (!overlay) return null;
  const versions = [describeVersion(overlay.tutorV22, '2.2'), describeVersion(overlay.tutorV30, '3.0')].filter(Boolean);
  if (!versions.length) return null;
  const turnsScored = Math.max(...versions.map((version) => version.turnsScored));
  return {
    versions,
    agreement: describeAgreement(overlay.tutorV22, overlay.tutorV30),
    sampleWarning:
      turnsScored <= SMALL_SAMPLE_MAX
        ? `Every figure below rests on ${turnsScored} scored turns. At that n a correlation is a description of these ` +
          'turns, not a property of the instrument, and a matrix over more dimensions than turns cannot be factored ' +
          'at all. Read the direction, not the value.'
        : null,
  };
}

/**
 * The declared range of one dimension, for plotting.
 *
 * Artefacts written since `dimensionScales` was added carry the rubric's own
 * declaration and it is used verbatim. Older artefacts — including every run
 * already scored and paid for — carry only raw scores, so the range is inferred
 * from them: a dimension whose observed maximum exceeds 5 is on the 1-10 scale,
 * everything else on 1-5. That covers the two scales any tutor rubric in this
 * repo uses, and the axis label prints the range it settled on so a reader can
 * see the assumption rather than inherit it silently.
 *
 * The inference is only ever reached on a rubric with enough dimensions to plot,
 * and it fails safe in the direction that matters: reading a 1-10 dimension as
 * 1-5 would push it off the outer ring, which is visible, rather than quietly
 * flattering it.
 */
function axisScale(side, key, values) {
  const declared = side?.dimensionScales?.[key];
  if (Number.isFinite(declared?.min) && Number.isFinite(declared?.max)) {
    return { min: declared.min, max: declared.max, declared: true };
  }
  const finite = values.filter((value) => Number.isFinite(value));
  const observedMax = finite.length ? Math.max(...finite) : 5;
  return { min: 1, max: observedMax > 5 ? 10 : 5, declared: false };
}

/**
 * Per-arm mean profile across a version's dimensions, shaped for the radar.
 *
 * Means, not single turns: the page's other tables are per-arm means, and a
 * radar built from one turn beside a table of means would invite the reader to
 * treat the two as the same reading. `null` on an axis means that arm has no
 * numeric verdict there — every turn inapplicable, or none scored — and the plot
 * cuts the corner rather than drawing a floor.
 */
export function showcaseDimensionProfiles(overlay, { version = '2.2' } = {}) {
  const side = version === '3.0' ? overlay?.tutorV30 : overlay?.tutorV22;
  if (!side) return null;
  const rows = scoredRows(side);
  if (!rows.length) return null;
  const keys = dimensionKeys(rows);
  if (!keys.length) return null;

  const axes = keys.map((key) => ({ key, ...axisScale(side, key, dimensionSeries(rows, key).values) }));

  const byArm = new Map();
  for (const row of rows) {
    if (!byArm.has(row.armId)) byArm.set(row.armId, []);
    byArm.get(row.armId).push(row);
  }

  const series = [...byArm.entries()].map(([armId, armRows], index) => ({
    id: armId,
    label: armId,
    baseline: Boolean(armRows[0]?.baseline),
    turns: armRows.length,
    // The baseline keeps the neutral ink and the instrumented arm the ochre the
    // page already uses for the instrumented side, so the chart legend and the
    // arm legend above it do not disagree about which arm is which.
    tone: armRows[0]?.baseline ? 'ms-ink' : index === 0 ? 'ms-ink' : 'ms-ochre',
    values: keys.map((key) => {
      const values = [];
      for (const row of armRows) {
        const entry = row.scores?.[key];
        if (entry?.not_applicable === true) continue;
        if (Number.isFinite(entry?.score)) values.push(entry.score);
      }
      return values.length ? mean(values) : null;
    }),
  }));

  return {
    version: versionLabel(side, version),
    axes,
    series,
    scalesDeclared: axes.every((axis) => axis.declared),
    turnsScored: rows.length,
  };
}

export const __testing = { pearson, standardDeviation, describeSpread, axisScale, MIN_OBSERVATIONS };
