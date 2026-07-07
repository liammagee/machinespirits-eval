/**
 * writingPadNarrativeBuilder — Stage A3 (Line A,
 * notes/2026-07-06-longitudinal-drift-adaptation-prereg.md §8.3).
 *
 * A2 established that Writing Pad content never reaches the cell_40/93
 * tutor prompt through any of its three internal read-back channels
 * (unconscious.permanentTraces retrieved-then-discarded by runMemoryCycle;
 * preconscious.recentPatterns starved because conscious.workingThoughts is
 * never written on this path; unconscious.learnerArchetype computed over an
 * always-empty learner-event log) — all three trace back to one orphaned
 * module, tutor-core/services/recognitionOrchestrator.js, which is the sole
 * writer of the conscious layer and the learner-event log but is never
 * called from the real dialogue-engine request path.
 *
 * Rather than patch any of those internal channels (a tutor-core core-code
 * change with unknown blast radius, and one that still wouldn't reach the
 * model without an explicit injection point), this module builds an
 * external narrative directly from the ONE field §8.1 confirmed carries
 * real, content-bearing writes: unconscious.permanentTraces (settled by
 * tutor-core/services/writingPadService.js's settleToUnconscious, called
 * from dialecticalEngine.negotiateDialectically's own live superego-
 * disapproval path — the same path A2 confirmed produces 10 real moments
 * across 3 pad-ON sessions). That narrative is fed through the
 * ALREADY-PROVEN externalEgoExtension / systemPromptExtension channel
 * (services/evaluationRunner.js's --external-ego-extension-file plumbing,
 * prepended directly onto the ego's own prompt in
 * tutor-core/services/tutorDialogueEngine.js's egoGenerateSuggestions) —
 * reusing only that channel's plumbing, not its store or its (separate,
 * already-null) rich-memory finding.
 *
 * This is new eval-layer code only. Zero changes inside tutor-core/**.
 *
 * Stage A3-build correction (logged in full in this note's §8.8): the
 * `permanentTraces` entries `settleToUnconscious` persists carry a
 * correctly-copied `.id` (matching the source `recognition_moments.id`
 * primary key exactly) but an always-empty `.synthesis` field — a
 * fourth, distinct read-side breakage, inside tutor-core/services/
 * writingPadService.js's own `getRecognitionMoment`/`getRecognitionMoments`
 * accessors, which both drop the `synthesis_resolution` column when
 * reconstructing their return objects (confirmed against both a
 * hermetic synthetic pad and the real A2 production pad,
 * `a2-drift-padon-v1-2026-07-06`: every one of its 10 real
 * `permanentTraces` entries has no `synthesis` key at all). Since the
 * content those accessors drop is real and still sitting in the
 * `recognition_moments` table's own `synthesis_resolution` column
 * (confirmed directly via `sqlite3` against the real pad DB), and since
 * the trace's own `.id` is a reliable foreign key back to that row,
 * `renderTraceLine` below repairs this with a small, read-only,
 * additive raw-SQL lookup by id — still zero changes inside
 * tutor-core/**, and still reusing only plumbing (the DB file / schema),
 * not patching tutor-core's own accessor functions.
 *
 * STATUS UPDATE (§8.8): the four internal read-path bugs this module was
 * built to work around (recognitionOrchestrator.js orphaned; runMemoryCycle
 * discarding retrieved unconscious context; the pattern-promotion pipeline
 * starved of conscious.workingThoughts; getRecognitionMoment(s) dropping
 * synthesis_resolution) are now fixed directly inside tutor-core/services/
 * {dialecticalEngine,memoryDynamicsService,tutorDialogueEngine,
 * writingPadService}.js. The INTERNAL path (unconscious.permanentTraces ->
 * dialecticalEngine.generateSuperegoCritique's own prompt) is now the
 * canonical channel for A4 onward, proven end-to-end in tutor-core/services/
 * __tests__/writingPadInternalPathDelivery.test.js. This module is NOT
 * deleted and is NOT wired into A4 — it is retained as the A3 instrument,
 * for provenance: it is what made the read-side breakage legible in the
 * first place (the raw-SQL `synthesis_resolution` repair in
 * `renderTraceLine` below was the first working fix for what is now bug 4),
 * and its diagnostic narrative-building logic may still be useful if the
 * internal channel ever needs an external cross-check again.
 */
import { getWritingPad } from '../tutor-core/services/writingPadService.js';
import { getDb } from '../tutor-core/services/dbService.js';

export const WRITING_PAD_NARRATIVE_BUILDER_VERSION = '1.1';

/** Bounds how much pad content can be injected into a single ego prompt. */
const DEFAULT_MAX_TRACES = 10;
const DEFAULT_MAX_CHARS = 2000;

/**
 * Recover a recognition moment's real synthesis text directly from the
 * `recognition_moments` table, bypassing `writingPadService.
 * getRecognitionMoment`/`getRecognitionMoments` — both silently omit the
 * `synthesis_resolution` column from their returned objects, which is
 * why `settleToUnconscious`'s own read of `.synthesis_resolution`
 * always sees `undefined` on the real write path. Read-only; matches
 * on the trace's own `id`, which IS carried through correctly. Safe to
 * call with a synthetic/unknown id (e.g. from a directly-constructed
 * test trace) — simply finds no row and returns null.
 *
 * @param {string} momentId
 * @returns {string|null}
 */
function lookupSynthesisResolution(momentId) {
  if (!momentId || typeof momentId !== 'string') return null;
  try {
    const row = getDb()
      .prepare('SELECT synthesis_resolution, synthesis_strategy FROM recognition_moments WHERE id = ?')
      .get(momentId);
    if (!row) return null;
    const text = row.synthesis_resolution || row.synthesis_strategy;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch {
    // Defensive only (e.g. table missing in some future schema) — the
    // fallback chain below still has transformations/recognitionType.
    return null;
  }
}

/**
 * Render one permanentTraces entry as a single bounded narrative line.
 * Prefers the real synthesis text recovered by id from the raw
 * `recognition_moments` table (see `lookupSynthesisResolution` above),
 * then the trace's own `.synthesis` field (kept for forward-compat and
 * for directly-constructed/synthetic traces used in tests), then falls
 * back to a constructed line from `transformations` (ego/superego/
 * learner) when both are empty, then to `recognitionType` alone if even
 * that is missing — never throws on a sparse trace, since a trace's
 * exact shape is inherited from tutor-core's own dialectical-negotiation
 * output, not this module's to enforce.
 *
 * @param {Object} trace - one entry of unconscious.permanentTraces
 * @returns {string|null} a single rendered line, or null if there is
 *   nothing at all usable on this trace (fully empty/malformed)
 */
function renderTraceLine(trace) {
  if (!trace || typeof trace !== 'object') return null;
  const recovered = lookupSynthesisResolution(trace.id);
  const synthesis = recovered || (typeof trace.synthesis === 'string' ? trace.synthesis.trim() : '');
  if (synthesis) return synthesis;

  const transformations = trace.transformations || {};
  const transformationParts = [transformations.ego, transformations.superego, transformations.learner]
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim());
  if (transformationParts.length) return transformationParts.join(' — ');

  if (typeof trace.recognitionType === 'string' && trace.recognitionType.trim()) {
    return `A prior recognition moment of type "${trace.recognitionType.trim()}".`;
  }
  return null;
}

/**
 * Build a bounded narrative summary of a learner's Writing Pad
 * unconscious.permanentTraces, suitable for injection via
 * --external-ego-extension-file (services/evaluationRunner.js's
 * externalEgoExtension → tutor-core's systemPromptExtension).
 *
 * Returns `null` when there is no writing pad, or zero permanentTraces —
 * the CLI's --external-ego-extension-file path already treats "no file
 * written" as "no extension," so callers should skip writing an extension
 * file entirely when this returns null (this is the expected, correct
 * behavior for the pad-OFF arm and for any never-consolidated pad, not an
 * error condition).
 *
 * @param {string} learnerId
 * @param {Object} [options]
 * @param {number} [options.maxTraces] - cap on how many of the most
 *   recent traces to include (default DEFAULT_MAX_TRACES)
 * @param {number} [options.maxChars] - hard cap on the rendered narrative's
 *   length in characters (default DEFAULT_MAX_CHARS); truncates on a
 *   trace boundary, never mid-sentence
 * @returns {string|null}
 */
export function buildWritingPadNarrative(learnerId, options = {}) {
  if (!learnerId) return null;
  const { maxTraces = DEFAULT_MAX_TRACES, maxChars = DEFAULT_MAX_CHARS } = options;

  const pad = getWritingPad(learnerId);
  const traces = pad?.unconscious?.permanentTraces;
  if (!Array.isArray(traces) || traces.length === 0) return null;

  const recent = traces.slice(-maxTraces);
  const lines = recent.map(renderTraceLine).filter(Boolean);
  if (lines.length === 0) return null;

  const header =
    'From prior sessions with this learner, you privately recall the following (do not quote this verbatim; let it inform your judgment):';
  const bulleted = lines.map((line) => `- ${line}`);

  let narrative = [header, ...bulleted].join('\n');
  if (narrative.length > maxChars) {
    // Truncate on a line boundary so we never cut a sentence mid-word.
    const kept = [header];
    let length = header.length;
    for (const line of bulleted) {
      if (length + line.length + 1 > maxChars) break;
      kept.push(line);
      length += line.length + 1;
    }
    narrative = kept.join('\n');
  }
  return narrative;
}
