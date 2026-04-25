// Pedagogical-orientation helpers (D6) — pure functions consumed by both
// the chat UI (public/chat/index.html, via window.OH) and the Node test
// suite (tests/chat-orientation-helpers.test.js, via ES import). Single
// source of truth for effect-size binning, the family-grouping rules, the
// natural-opposite default for the compare panel, and tooltip text. Keep
// these functions pure and side-effect-free so they remain trivially
// testable.

const FAMILY_ORDER = [
  'intersubjective',
  'transmission',
  'neutral',
  'architectural_variant',
];

const FAMILY_LABEL = {
  intersubjective: 'Intersubjective (recognition / matched-pedagogical)',
  transmission: 'Transmission (base / matched-behaviorist)',
  neutral: 'Neutral (placebo)',
  architectural_variant: 'Architectural variants',
};

// Cohen's conventions for |d|: <0.2 trivial, <0.5 small, <0.8 medium,
// <1.2 large, ≥1.2 very-large. Returns 'unknown' when d is null/NaN.
export function effectMagnitude(d) {
  if (d == null || Number.isNaN(d)) return 'unknown';
  const a = Math.abs(d);
  if (a < 0.2) return 'trivial';
  if (a < 0.5) return 'small';
  if (a < 0.8) return 'medium';
  if (a < 1.2) return 'large';
  return 'very-large';
}

// Sign-prefixed two-decimal effect size string. Uses a true minus glyph
// (U+2212) for negatives so it reads as a chip token rather than a hyphen.
export function formatEffectSize(d) {
  if (d == null || Number.isNaN(d)) return '';
  const sign = d > 0 ? '+' : (d < 0 ? '−' : '');
  return sign + Math.abs(d).toFixed(2);
}

// Pick the "natural opposite" cell for a side-by-side compare given the
// resolved cell's orientation. Within the matched-pedagogical /
// matched-behaviorist pair we cross to the orthogonal family. Otherwise
// we cross transmission ↔ intersubjective at the canonical exemplars
// (cell_1 base / cell_5 recognition). Falls back to cell_5 when the
// resolved cell carries no family tag.
export function compareDefault(orientation) {
  const fam = orientation?.effectiveFamily;
  const pt = orientation?.promptType;
  if (pt === 'matched_pedagogical') return 'cell_96_base_behaviorist_single_unified';
  if (pt === 'matched_behaviorist') return 'cell_95_base_matched_single_unified';
  if (fam === 'intersubjective') return 'cell_1_base_single_unified';
  if (fam === 'transmission')    return 'cell_5_recog_single_unified';
  return 'cell_5_recog_single_unified';
}

// Group cells (with `.orientation.effectiveFamily` set) into ordered
// buckets suitable for a <select> with <optgroup> headers. Cells without
// an orientation fall into the architectural_variant bucket.
export function groupCellsByFamily(cells) {
  const buckets = new Map();
  for (const c of cells || []) {
    const fam = c.orientation?.effectiveFamily || 'architectural_variant';
    if (!buckets.has(fam)) buckets.set(fam, []);
    buckets.get(fam).push(c);
  }
  return FAMILY_ORDER
    .filter((f) => buckets.has(f))
    .map((f) => ({
      family: f,
      label: FAMILY_LABEL[f] || f,
      cells: buckets.get(f),
    }));
}

// Vocabulary diff for the compare panel. Splits each side's vocabulary
// list into only-A / only-B / shared buckets while preserving the
// original ordering within each bucket.
export function vocabularyDiff(vocabA, vocabB) {
  const a = vocabA || [];
  const b = vocabB || [];
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyA = a.filter((w) => !setB.has(w));
  const onlyB = b.filter((w) => !setA.has(w));
  const shared = a.filter((w) => setB.has(w));
  return { onlyA, onlyB, shared };
}

// Multi-line tooltip text from an orientation object. Returns '' for
// nullish input so the title="" attribute stays clean. Each present
// field becomes its own line; the effect-size line is appended last
// when populated.
export function orientationTooltip(o) {
  if (!o) return '';
  const lines = [
    o.shortLabel,
    o.lineage ? 'lineage: ' + o.lineage : null,
    o.viewOfLearner ? 'learner: ' + o.viewOfLearner : null,
    o.roleOfTutor ? 'tutor: ' + o.roleOfTutor : null,
    o.keyMechanism ? 'mechanism: ' + o.keyMechanism : null,
  ].filter(Boolean);
  if (o.effectVsBase != null) {
    lines.push(
      'effect vs base: ' + formatEffectSize(o.effectVsBase) +
      ' (' + effectMagnitude(o.effectVsBase) + ')'
    );
  }
  return lines.join('\n');
}

// Family-tag exports for tests / consumers that want the canonical lists.
export const FAMILIES = FAMILY_ORDER.slice();
export const FAMILY_LABELS = { ...FAMILY_LABEL };
