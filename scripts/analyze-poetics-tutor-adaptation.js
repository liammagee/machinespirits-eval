#!/usr/bin/env node
/**
 * Analyze tutor adaptation in poetics sidecar artifacts.
 *
 * This is deliberately separate from the main evaluation harness. It asks
 * questions the 3-way poetics form score does not answer:
 *
 *   1. Primary adaptation / peripeteia: after learner resistance, breakdown,
 *      pseudo-catharsis, closure pressure, or misfit, does the tutor take stock and invent an
 *      adaptive learning mechanism?
 *   2. Secondary closure / recognition-contingent uptake: after a learner visibly
 *      re-frames an earlier utterance, does the next tutor take up that revised
 *      framing, or is the recognitive work only in the learner line?
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPoeticsStore, upsertPoeticsTutorAdaptation } from '../services/poeticsStore.js';
import { analyzePseudoCatharsis } from '../services/pseudoCatharsisDetector.js';
import { reframeMatchStats } from './generate-pedagogical-dramas.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');
const ANALYZER_VERSION = 'tutor-adaptation-v4';

const STOPWORDS = new Set(
  [
    'about',
    'after',
    'again',
    'also',
    'and',
    'are',
    'because',
    'been',
    'before',
    'being',
    'but',
    'can',
    'could',
    'does',
    'for',
    'from',
    'had',
    'has',
    'have',
    'here',
    'how',
    'into',
    'its',
    'just',
    'like',
    'more',
    'must',
    'not',
    'now',
    'one',
    'only',
    'out',
    'same',
    'should',
    'that',
    'the',
    'then',
    'there',
    'this',
    'too',
    'was',
    'what',
    'when',
    'where',
    'which',
    'while',
    'with',
    'would',
    'you',
    'your',
  ].map((term) => term.toLowerCase()),
);

const STRATEGY_PATTERNS = [
  {
    id: 'criterion_gate',
    patterns: [
      /\b(?:only|must)\b[\s\S]{0,80}\b(?:enters?|belongs?|counts?|can complete|may enter)\b/i,
      /\b(?:use one test|use this gate|entry-gate|sentence-gate|sorting gate|gate criterion|criterion)\b/i,
      /\b(?:sort|classify|place)\b[\s\S]{0,80}\b(?:zone|zones|inside|outside|margin|time signature|belongs?)\b/i,
    ],
  },
  {
    id: 'interaction_sentence_gate',
    patterns: [
      /\b(?:other object on cart|other object first|name it before|sentence passes|interaction sentence)\b/i,
      /\b(?:strip stays down|blank strip|cover(?:s|ed)? the arrowheads?|arrowheads? (?:covered|hidden|occluded))\b/i,
      /\b(?:say|write)\b[\s\S]{0,80}\b(?:on cart|acting on|interaction)\b/i,
    ],
  },
  {
    id: 'surface_orientation_key',
    patterns: [
      /\b(?:surface key|orientation key|arrow direction|tabletop strip|upright slot|runs along|stands? off)\b/i,
      /\b(?:along|across|parallel|perpendicular|upright|off it)\b[\s\S]{0,80}\b(?:surface|tabletop|strip|slot|square|contact)\b/i,
    ],
  },
  {
    id: 'contact_mark_mapping',
    patterns: [
      /\b(?:contact mark|corner onto|table contact|same contact|contact also)\b/i,
      /\b(?:names? which card|which card)\b[\s\S]{0,60}\b(?:contact|table|arrow)\b/i,
    ],
  },
  {
    id: 'object_mapping',
    patterns: [
      /\b(?:arrow to|points? to|map|match|label)\b[\s\S]{0,80}\b(?:slots?|tiles?|cards?|objects?|boxes?|bar|diagram|arrow)\b/i,
      /\b(?:put|place|move|set)\b[\s\S]{0,80}\b(?:card|tile|strip|object|label)\b/i,
    ],
  },
  {
    id: 'release_gate',
    patterns: [
      /\b(?:release gate|release instruction|permission leaking|operational gate|reopen condition|held item|trial is canceled|signature would go)\b/i,
    ],
  },
  {
    id: 'evidence_check',
    patterns: [/\b(?:check|test|measure|evidence|data|source|show|prove|compare|look at|find)\b/i],
  },
  {
    id: 'mechanism_explanation',
    patterns: [/\b(?:because|mechanism|means|works?|causes?|explains?|why|therefore|so the)\b/i],
  },
  {
    id: 'application_task',
    patterns: [/\b(?:write|choose|circle|mark|label|say|sentence|line|version|answer)\b/i],
  },
  {
    id: 'object_work',
    patterns: [/\b(?:draw|hold|place|move|card|graph|model|map|object|specimen|diagram|column|table)\b/i],
  },
  {
    id: 'role_or_interruption',
    patterns: [/\b(?:switch roles|you be|pretend|placard|sign|pause|interruption|outside|notice|rule says)\b/i],
  },
  {
    id: 'social_consequence',
    patterns: [/\b(?:client|family|committee|deadline|public|consequence|cost|approval|report|audience)\b/i],
  },
  {
    id: 'register_shift',
    patterns: [/\b(?:slow down|no praise|not yet|hold on|accountable|plainly|directly|quiet|formal|brisk|serious)\b/i],
  },
  {
    id: 'boundary_correction',
    patterns: [/\b(?:not|instead|rather|separate|distinguish|wrong|shortcut|category|frame)\b/i],
  },
  {
    id: 'validation_closure',
    patterns: [/\b(?:good|right|yes|exactly|that is it|correct)\b/i],
  },
];

function parseArgs(argv) {
  const args = {
    dbPath: null,
    runId: null,
    out: null,
    csv: null,
    dryRun: false,
    targetOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--db') args.dbPath = path.resolve(argv[++i]);
    else if (token === '--run-id') args.runId = argv[++i];
    else if (token === '--out') args.out = path.resolve(argv[++i]);
    else if (token === '--csv') args.csv = path.resolve(argv[++i]);
    else if (token === '--dry-run') args.dryRun = true;
    else if (token === '--target-only') args.targetOnly = true;
    else if (token === '--help' || token === '-h') {
      console.log(`Usage:
  node scripts/analyze-poetics-tutor-adaptation.js [--run-id ID] [--db FILE]
      [--out summary.json] [--csv rows.csv] [--target-only] [--dry-run]`);
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${token}`);
    }
  }
  return args;
}

function rel(p) {
  return path.relative(ROOT, path.resolve(p));
}

function absFromRoot(relPath) {
  return relPath ? path.resolve(ROOT, relPath) : null;
}

function decodeJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function round(value, digits = 3) {
  if (value == null || !Number.isFinite(value)) return null;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function tracePathForItem(item) {
  if (!item.full_transcript_path) return null;
  const traceRel = item.full_transcript_path.replace('/transcripts/', '/deliberation/').replace(/\.full\.md$/, '.json');
  const traceAbs = absFromRoot(traceRel);
  return traceAbs && fs.existsSync(traceAbs) ? traceAbs : null;
}

function loadItems(db, { runId = null, targetOnly = false } = {}) {
  const where = [];
  const params = {};
  if (runId) {
    where.push('i.run_id = @runId');
    params.runId = runId;
  }
  if (targetOnly) where.push("i.unit_id LIKE 'target-%'");
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db
    .prepare(
      `
      SELECT
        i.id,
        i.run_id,
        i.unit_id,
        i.repeat,
        i.arm,
        i.tid,
        i.drama_id,
        i.discipline,
        i.control_role,
        i.sample_path,
        i.full_transcript_path,
        i.metadata
      FROM poetics_items i
      ${whereSql}
      ORDER BY i.run_id, i.repeat, i.unit_id, i.arm, i.tid
    `,
    )
    .all(params)
    .map((item) => ({ ...item, metadata: decodeJson(item.metadata, {}) }));
}

function publicTurns(trace) {
  return (trace?.turns || [])
    .filter(
      (turn) => ['director', 'tutor', 'learner'].includes(turn.phase) && String(turn.externalMessage || '').trim(),
    )
    .map((turn, index) => ({ ...turn, ordinal: index + 1, text: String(turn.externalMessage || '').trim() }));
}

function extractAnchor(text) {
  return (
    String(text || '').match(
      /(?:A prior learner line is played back|An earlier learner line returns to the table):\s*"([\s\S]*?)"\s*(?:The learner must|The pause holds|The next response|The learner has to)/i,
    )?.[1] || ''
  );
}

function terms(text) {
  return [
    ...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .match(/[a-z]+(?:[0-9]+)?|[0-9]+(?:\.[0-9]+)?/g)
        ?.filter((term) => (term.length > 2 || /\d/.test(term)) && !STOPWORDS.has(term)) || [],
    ),
  ];
}

function termSet(text) {
  return new Set(terms(text));
}

function subtractSet(a, b) {
  return new Set([...a].filter((term) => !b.has(term)));
}

function sharedTerms(a, b) {
  const bs = b instanceof Set ? b : new Set(b);
  return [...a].filter((term) => bs.has(term));
}

function overlapRatio(sourceTerms, targetText) {
  const source = sourceTerms instanceof Set ? sourceTerms : new Set(sourceTerms);
  if (!source.size) return 0;
  const target = termSet(targetText);
  return sharedTerms(source, target).length / source.size;
}

function strategyFor(text) {
  const hits = STRATEGY_PATTERNS.map((strategy, index) => ({
    id: strategy.id,
    index,
    count: strategy.patterns.reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0),
  })).filter((strategy) => strategy.count > 0);
  if (!hits.length) return 'open_scaffolding';
  hits.sort((a, b) => b.count - a.count || a.index - b.index);
  return hits[0].id;
}

function markerReframeScore(learnerText) {
  const text = String(learnerText || '');
  const problem =
    /\b(?:framing problem|old frame|earlier mistake|mistake was|problem was|problem is|I was treating|I was letting|I assumed|I thought)\b/i.test(
      text,
    );
  const replacement =
    /\b(?:new frame|new line|new version|read it as|instead|rather|should say|should read|now the question|replacement|better)\b/i.test(
      text,
    );
  const earlier = /\b(?:earlier|old|first|I thought|I assumed|I was)\b/i.test(text);
  return (problem ? 0.4 : 0) + (replacement ? 0.4 : 0) + (earlier ? 0.2 : 0);
}

function softCueReframeStats(anchor, learnerText) {
  const learnerStats = anchor ? reframeMatchStats(anchor, learnerText) : null;
  const text = String(learnerText || '');
  const revoice = Boolean(learnerStats?.revoice_compliant);
  const softProblem =
    /\b(?:still stands|needs? narrowing|narrower|cannot carry|not the whole|nothing more|not proof|not the proof|not alone|only testing|not just)\b/i.test(
      text,
    ) && /\b(?:but|while|instead|rather|because|not)\b/i.test(text);
  const softReplacement =
    /\b(?:needs? narrowing|narrower|better|should|would say|want to say|question|test|read|line|label|claim|frame|evidence)\b/i.test(
      text,
    ) && /\b(?:but|while|instead|rather|so|then|now)\b/i.test(text);
  const problemNamed = Boolean(learnerStats?.problem_named || softProblem);
  const replacementNamed = Boolean(learnerStats?.replacement_named || softReplacement);
  const structuredScore = (revoice ? 0.34 : 0) + (problemNamed ? 0.33 : 0) + (replacementNamed ? 0.33 : 0);
  const score = round(Math.max(structuredScore, markerReframeScore(text)));
  return {
    learnerStats,
    learnerReframeScore: score,
    learnerSelfReframe: Boolean(
      learnerStats?.compliant || (revoice && problemNamed && replacementNamed) || score >= 0.8,
    ),
  };
}

function findCue(turns) {
  return turns.find(
    (turn) =>
      turn.phase === 'director' &&
      (turn.directorCue?.cueKind === 'learner_revisit_earlier_wording' ||
        /(?:A prior learner line is played back|An earlier learner line returns to the table):/i.test(turn.text)),
  );
}

function findOrganicPivot(turns) {
  const learnerTurns = turns.filter((turn) => turn.phase === 'learner');
  for (let i = 1; i < learnerTurns.length; i++) {
    const learner = learnerTurns[i];
    const earlier = learnerTurns.slice(0, i);
    if (markerReframeScore(learner.text) < 0.7) continue;
    const matchedAnchor = earlier.find((candidate) => reframeMatchStats(candidate.text, learner.text).compliant);
    return {
      pivot: learner,
      anchor: matchedAnchor?.text || earlier[0]?.text || '',
      learnerReframeScore: round(markerReframeScore(learner.text)),
      learnerSelfReframe: Boolean(matchedAnchor) || markerReframeScore(learner.text) >= 0.8,
    };
  }
  return null;
}

function findCuePivot(turns, cue, anchor) {
  const analyzed = turns
    .slice(turns.indexOf(cue) + 1)
    .filter((turn) => turn.phase === 'learner')
    .map((turn) => ({ turn, analysis: softCueReframeStats(anchor, turn.text) }));
  return analyzed.find((entry) => entry.analysis.learnerSelfReframe) || analyzed[0] || null;
}

function findTutorBefore(turns, pivot) {
  const pivotIndex = turns.indexOf(pivot);
  return [...turns.slice(0, pivotIndex)].reverse().find((turn) => turn.phase === 'tutor') || null;
}

function findTutorAfter(turns, pivot) {
  const pivotIndex = turns.indexOf(pivot);
  return turns.slice(pivotIndex + 1).find((turn) => turn.phase === 'tutor') || null;
}

const RESISTANCE_PATTERNS = [
  /\b(?:I don['’]?t|I can['’]?t|I won['’]?t|I still don['’]?t|doesn['’]?t make sense|not buying|stuck|confusing|lost)\b/i,
  /\b(?:but|no|wait|why|how is that|that seems wrong|that can['’]?t be|isn['’]?t it|I thought)\b/i,
  /\b(?:technicality|annoying|trying to defend|not fully sure|not sure how|still feels)\b/i,
  /\b(?:just tell me|give me the answer|so it is just)\b/i,
];

const TUTOR_REVERSAL_PATTERNS = [
  /\b(?:let['’]?s back up|pause|try another|different route|switch|instead|start over|new way|not working)\b/i,
  /\b(?:lower the load|simpler case|smaller case|change the question|change the task|new evidence standard|evidence standard)\b/i,
  /\b(?:switch roles|you be|take the role|role reversal|counterexample|new object|new model|new map|new diagram|placard|interruption|outside rule|social consequence|public consequence)\b/i,
  /\b(?:no praise|not yet|hold on|slow down|say it plainly|be precise|formal|quiet|brisk|accountable)\b/i,
  /\b(?:weak point has moved|live failure is permission|release instruction|release gate|permission leaking|make the hold operational)\b/i,
  /\b(?:I was asking|that route|my question|the task|we should not|rather than)\b[\s\S]{0,120}\b(?:instead|try|switch|start|test|use)\b/i,
];

const MECHANISM_SHIFT_PATTERNS = [
  {
    id: 'criterion_gate',
    patterns: [
      /\b(?:only|must)\b[\s\S]{0,80}\b(?:enters?|belongs?|counts?|can complete|may enter)\b/i,
      /\b(?:use one test|use this gate|entry-gate|sentence-gate|sorting gate|criterion)\b/i,
      /\b(?:sort|classify|place)\b[\s\S]{0,80}\b(?:zone|zones|inside|outside|margin|time signature|belongs?)\b/i,
    ],
  },
  {
    id: 'interaction_sentence_gate',
    patterns: [
      /\b(?:other object on cart|other object first|name it before|sentence passes|interaction sentence)\b/i,
      /\b(?:strip stays down|blank strip|cover(?:s|ed)? the arrowheads?|arrowheads? (?:covered|hidden|occluded))\b/i,
      /\b(?:say|write)\b[\s\S]{0,80}\b(?:on cart|acting on|interaction)\b/i,
    ],
  },
  {
    id: 'surface_orientation_key',
    patterns: [
      /\b(?:surface key|orientation key|arrow direction|tabletop strip|upright slot|runs along|stands? off)\b/i,
      /\b(?:along|across|parallel|perpendicular|upright|off it)\b[\s\S]{0,80}\b(?:surface|tabletop|strip|slot|square|contact)\b/i,
    ],
  },
  {
    id: 'contact_mark_mapping',
    patterns: [
      /\b(?:contact mark|corner onto|table contact|same contact|contact also)\b/i,
      /\b(?:names? which card|which card)\b[\s\S]{0,60}\b(?:contact|table|arrow)\b/i,
    ],
  },
  {
    id: 'route_reset',
    patterns: [
      /\b(?:let['’]?s back up|start over|different route|new route|switch route|not working|rather than)\b/i,
    ],
  },
  {
    id: 'changed_task_or_question',
    patterns: [/\b(?:change the question|change the task|new task|new question|instead,?\s+(?:write|draw|test|choose))\b/i],
  },
  {
    id: 'evidence_standard',
    patterns: [
      /\b(?:evidence standard|standard of evidence|measured|record|source|proof rule|release condition|benchmark)\b/i,
    ],
  },
  {
    id: 'representation_or_object',
    patterns: [
      /\b(?:draw|diagram|map|model|object|card|graph|table|line|sheet|cart|string|square|placard)\b/i,
    ],
  },
  {
    id: 'role_or_interruption',
    patterns: [/\b(?:switch roles|you be|take the role|interruption|outside rule|placard|caption|corridor|clock)\b/i],
  },
  {
    id: 'social_consequence',
    patterns: [/\b(?:client|family|committee|deadline|public|approval|release|report|audience|bystander|trial)\b/i],
  },
  {
    id: 'authorization_gate',
    patterns: [
      /\b(?:release gate|release instruction|permission leaking|operational gate|make the hold operational)\b/i,
      /\b(?:held item|not cleared|reopen condition|door lead|do not queue|cancel(?:ed)? trial|volunteer cannot wait)\b/i,
      /\b(?:where the signature would go|sheet face down|call time beside the unsigned box)\b/i,
    ],
  },
  {
    id: 'register_shift',
    patterns: [/\b(?:no praise|not yet|hold on|slow down|plainly|quiet|formal|brisk|accountable|apology can wait)\b/i],
  },
  {
    id: 'cognitive_load_shift',
    patterns: [/\b(?:smaller case|simpler case|lower the load|one step|first stop|before anything else)\b/i],
  },
];

function priorLearnerTextsBefore(turns, pivot) {
  const pivotIndex = turns.indexOf(pivot);
  return turns
    .slice(0, pivotIndex < 0 ? 0 : pivotIndex)
    .filter((turn) => turn.phase === 'learner' && String(turn.text || '').trim())
    .map((turn) => turn.text);
}

function learnerResistanceScore(text, context = {}) {
  const learnerText = String(text || '');
  const hits = RESISTANCE_PATTERNS.reduce((sum, pattern) => sum + (pattern.test(learnerText) ? 1 : 0), 0);
  const contradiction = /\b(?:but|no|wait|still|unless|except)\b/i.test(learnerText) ? 1 : 0;
  const question = /\?/.test(learnerText) ? 1 : 0;
  const pseudoCatharsis = analyzePseudoCatharsis({ learnerText, ...context });
  return round(Math.max(Math.min(1, hits * 0.35 + contradiction * 0.2 + question * 0.15), pseudoCatharsis.likely ? pseudoCatharsis.confidence : 0));
}

function mechanismHits(text) {
  return MECHANISM_SHIFT_PATTERNS.filter((mechanism) =>
    mechanism.patterns.some((pattern) => pattern.test(String(text || ''))),
  ).map((mechanism) => mechanism.id);
}

function novelMechanismHits(preTutor, postTutor) {
  const before = new Set(mechanismHits(preTutor?.text || ''));
  return mechanismHits(postTutor?.text || '').filter((id) => !before.has(id));
}

function classifyResistance(text, context = {}) {
  const learnerText = String(text || '');
  const pseudoCatharsis = analyzePseudoCatharsis({ learnerText, ...context });
  if (pseudoCatharsis.likely) return 'pseudo_catharsis';
  if (/\b(?:just tell me|give me the answer|so it is just)\b/i.test(learnerText)) return 'closure_pressure';
  if (/\b(?:I don['’]?t|I can['’]?t|stuck|lost|confusing|doesn.t make sense)\b/i.test(learnerText))
    return 'breakdown';
  if (/\b(?:no|not buying|that seems wrong|but|wait|why)\b/i.test(learnerText)) return 'resistance';
  return 'misfit';
}

function policyIncludes(policy, facet) {
  return String(policy || '')
    .split(/[,+]/)
    .map((part) => part.trim())
    .includes(facet);
}

function isAtOrAfterTurn(turn, minTurnNumber) {
  if (minTurnNumber == null) return true;
  const turnNumber = Number(turn?.turnNumber);
  return Number.isFinite(turnNumber) && turnNumber >= Number(minTurnNumber);
}

function findReversalPressure(turns, { minTurnNumber = null } = {}) {
  const learners = turns.filter((turn) => turn.phase === 'learner');
  let best = null;
  for (const learner of learners) {
    if (!isAtOrAfterTurn(learner, minTurnNumber)) continue;
    const previousTutor = findTutorBefore(turns, learner);
    const pressureContext = {
      previousTutorText: previousTutor?.text || '',
      priorLearnerTexts: priorLearnerTextsBefore(turns, learner),
    };
    const score = learnerResistanceScore(learner.text, pressureContext);
    if (score < 0.5) continue;
    if (!best || score > best.score) {
      best = {
        turn: learner,
        score,
        triggerType: classifyResistance(learner.text, pressureContext),
        pseudoCatharsis: analyzePseudoCatharsis({ learnerText: learner.text, ...pressureContext }),
      };
    }
  }
  return best;
}

function findInstrumentedReversalUse(turns, traceTurns = [], { minPressureTurnNumber = null } = {}) {
  const tutorTrace = (traceTurns || []).find(
    (turn) =>
      turn?.phase === 'tutor' &&
      turn.learnerReversalEventUsed &&
      isAtOrAfterTurn(turn, minPressureTurnNumber),
  );
  if (!tutorTrace) return null;
  const event = tutorTrace.learnerReversalEventUsed;
  const eventBranchLocal = isAtOrAfterTurn({ turnNumber: event.turnNumber }, minPressureTurnNumber);
  const eventCarriedFromPrefix = Boolean(
    minPressureTurnNumber != null &&
      !eventBranchLocal &&
      isAtOrAfterTurn(tutorTrace, minPressureTurnNumber),
  );
  const pressureTurn =
    turns.find(
      (turn) => turn.phase === 'learner' && Number(turn.turnNumber) === Number(event.turnNumber),
    ) || null;
  const tutorTurn =
    turns.find(
      (turn) => turn.phase === 'tutor' && Number(turn.turnNumber) === Number(tutorTrace.turnNumber),
    ) || null;
  const internalText = (tutorTrace.internalDeliberation || [])
    .map((entry) => String(entry.content || ''))
    .filter(Boolean)
    .join('\n');
  const privateMechanismRoute =
    internalText.match(/\bADAPTIVE_MECHANISM:\s*([^\n]+)/i)?.[1]?.trim() ||
    internalText.match(/\bMECHANISM_ROUTE:\s*([^\n]+)/i)?.[1]?.trim() ||
    null;
  const declaredRouteChange = Boolean(
    privateMechanismRoute &&
      /->/.test(privateMechanismRoute) &&
      !/\b(?:no real|same route|unchanged|none)\b/i.test(privateMechanismRoute),
  );
  return {
    tutorTrace,
    tutorTurn,
    pressureTurn,
    event,
    eventBranchLocal,
    eventCarriedFromPrefix,
    privateMechanismRoute,
    declaredRouteChange,
  };
}

function findInstrumentedReframeUse(traceTurns = [], { minTurnNumber = null } = {}) {
  const tutorTrace = (traceTurns || []).find(
    (turn) =>
      turn?.phase === 'tutor' &&
      turn.learnerReframeEventUsed &&
      isAtOrAfterTurn({ turnNumber: turn.learnerReframeEventUsed.turnNumber }, minTurnNumber),
  );
  if (!tutorTrace) return null;
  return {
    tutorTrace,
    event: tutorTrace.learnerReframeEventUsed,
  };
}

function branchValidityForTrace(trace, turns, { tutorAdaptationPolicy = null, minPressureTurnNumber = null } = {}) {
  const requiresLearnerReversalEvent = policyIncludes(tutorAdaptationPolicy, 'peripeteia');
  const requiresLearnerReframeEvent = policyIncludes(tutorAdaptationPolicy, 'uptake');
  const reversalUse = requiresLearnerReversalEvent
    ? findInstrumentedReversalUse(turns, trace?.turns || [], { minPressureTurnNumber })
    : null;
  const reframeUse = requiresLearnerReframeEvent
    ? findInstrumentedReframeUse(trace?.turns || [], { minTurnNumber: minPressureTurnNumber })
    : null;
  const valid =
    (!requiresLearnerReversalEvent || Boolean(reversalUse)) &&
    (!requiresLearnerReframeEvent || Boolean(reframeUse));
  return {
    tutor_adaptation_policy: tutorAdaptationPolicy || 'none',
    requires_learner_reversal_event: requiresLearnerReversalEvent,
    learner_reversal_event_used: Boolean(reversalUse),
    learner_reversal_event_turn: reversalUse?.event?.turnNumber ?? null,
    learner_reversal_tutor_turn: reversalUse?.tutorTrace?.turnNumber ?? null,
    learner_reversal_event_trigger_type: reversalUse?.event?.triggerType || null,
    learner_reversal_event_source: reversalUse
      ? reversalUse.eventBranchLocal
        ? 'branch_local'
        : reversalUse.eventCarriedFromPrefix
          ? 'carried_prefix'
          : 'unscoped'
      : null,
    learner_reversal_event_branch_local: reversalUse?.eventBranchLocal ?? null,
    learner_reversal_candidate_trigger_types: (
      reversalUse?.tutorTrace?.learnerReversalEventCandidatesUsed || []
    )
      .map((event) => event?.triggerType)
      .filter(Boolean)
      .join(', '),
    requires_learner_reframe_event: requiresLearnerReframeEvent,
    learner_reframe_event_used: Boolean(reframeUse),
    learner_reframe_event_turn: reframeUse?.event?.turnNumber ?? null,
    learner_reframe_tutor_turn: reframeUse?.tutorTrace?.turnNumber ?? null,
    valid,
  };
}

function nextLearnerAfter(turns, tutorTurn) {
  const tutorIndex = turns.indexOf(tutorTurn);
  return turns.slice(tutorIndex + 1).find((turn) => turn.phase === 'learner') || null;
}

function learnerOutcomeAfterReversal(learnerTurn) {
  if (!learnerTurn) return 'unknown';
  const text = learnerTurn.text || '';
  if (markerReframeScore(text) >= 0.7) return 'recognition';
  if (/\b(?:now I get it|that makes sense|aha|oh+|clear now|got it)\b/i.test(text)) return 'trap_or_declared_insight';
  if (learnerResistanceScore(text) >= 0.5) return 'maintained_resistance';
  return 'flat_or_partial';
}

function analyzePeripeteia(
  turns,
  traceTurns = [],
  { tutorAdaptationPolicy = null, minPressureTurnNumber = null, pairedPrefixThrough = null } = {},
) {
  const instrumented = policyIncludes(tutorAdaptationPolicy, 'peripeteia')
    ? findInstrumentedReversalUse(turns, traceTurns, { minPressureTurnNumber })
    : null;
  const pressure = findReversalPressure(turns, { minTurnNumber: minPressureTurnNumber });
  const pressureTurn = instrumented?.pressureTurn || pressure?.turn || null;
  const preTutor = pressureTurn ? findTutorBefore(turns, pressureTurn) : null;
  const postTutor = instrumented?.tutorTurn || (pressureTurn ? findTutorAfter(turns, pressureTurn) : null);
  const beforeStrategy = preTutor ? strategyFor(preTutor.text) : null;
  const afterStrategy = postTutor ? strategyFor(postTutor.text) : null;
  const strategyShift = Boolean(beforeStrategy && afterStrategy && beforeStrategy !== afterStrategy);
  const explicitReversal = postTutor
    ? TUTOR_REVERSAL_PATTERNS.some((pattern) => pattern.test(postTutor.text))
    : false;
  const pressureTerms = pressureTurn ? termSet(pressureTurn.text) : new Set();
  const postOverlap = postTutor ? overlapRatio(pressureTerms, postTutor.text) : 0;
  const mechanismNovelty = novelMechanismHits(preTutor, postTutor);
  const mechanismDepth = mechanismNovelty.length;
  const pressureScore = Math.max(pressure?.score || 0, instrumented?.event?.confidence || 0);
  const strongPressure = Boolean(instrumented || pressureScore >= 0.65);
  const tutorStrategyReversal = Boolean(
    strongPressure &&
      postTutor &&
      (explicitReversal ||
        mechanismDepth >= 2 ||
        (strategyShift && mechanismDepth >= 1 && postOverlap >= 0.15) ||
        (instrumented?.declaredRouteChange && mechanismDepth >= 1 && postOverlap >= 0.1)),
  );
  const tutorPeripeteiaScore = pressureTurn
    ? round(
        Math.min(
          tutorStrategyReversal ? 100 : 49,
          10 +
            Math.min(25, pressureScore * 25) +
            Math.min(15, postOverlap * 100) +
            Math.min(25, mechanismDepth * 12.5) +
            (strategyShift ? 10 : 0) +
            (explicitReversal ? 20 : 0) +
            (instrumented?.declaredRouteChange ? 10 : 0),
        ),
        1,
      )
    : 0;
  const outcomeLearner = postTutor ? nextLearnerAfter(turns, postTutor) : null;
  return {
    learner_reversal_pressure: Boolean(pressure || instrumented),
    instrumented_pressure: Boolean(instrumented),
    pressure_score: pressureScore,
    trigger_type: instrumented?.event?.triggerType || pressure?.triggerType || null,
    pressure_turn_number: pressureTurn?.turnNumber ?? null,
    tutor_pre_turn: preTutor?.turnNumber ?? null,
    tutor_post_turn: postTutor?.turnNumber ?? null,
    tutor_strategy_before: beforeStrategy,
    tutor_strategy_after: afterStrategy,
    tutor_strategy_shift: strategyShift,
    explicit_reversal: explicitReversal,
    novel_mechanism_hits: mechanismNovelty,
    tutor_strategy_reversal: tutorStrategyReversal,
    tutor_adaptive_mechanism: tutorStrategyReversal,
    private_mechanism_route: instrumented?.privateMechanismRoute || null,
    private_mechanism_declared: Boolean(instrumented?.declaredRouteChange),
    tutor_peripeteia_score: tutorPeripeteiaScore,
    learner_outcome_after_reversal: learnerOutcomeAfterReversal(outcomeLearner),
    min_pressure_turn_number: minPressureTurnNumber,
    paired_prefix_through: pairedPrefixThrough,
    evidence: [
      pressureTurn ? `pressure learner: ${pressureTurn.text.slice(0, 180)}` : null,
      postTutor ? `post tutor: ${postTutor.text.slice(0, 180)}` : null,
      outcomeLearner ? `next learner: ${outcomeLearner.text.slice(0, 180)}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

function pairedPrefixPressureMinTurn(trace) {
  const prefixThrough = trace?.run?.paired_continuation?.prefix_through || null;
  const match = String(prefixThrough || '').match(/^(?:tutor|learner)_turn_(\d+)$/i);
  if (!match) return { minPressureTurnNumber: null, pairedPrefixThrough: prefixThrough };
  return { minPressureTurnNumber: Number(match[1]), pairedPrefixThrough: prefixThrough };
}

function analyzeTraceForTutorAdaptation({ itemId, trace, sourceTracePath }) {
  const turns = publicTurns(trace);
  const { minPressureTurnNumber, pairedPrefixThrough } = pairedPrefixPressureMinTurn(trace);
  const tutorAdaptationPolicy = trace?.run?.tutor_adaptation_policy || trace?.directorPlan?.tutor_adaptation_policy || null;
  const peripeteia = analyzePeripeteia(turns, trace?.turns || [], {
    tutorAdaptationPolicy,
    minPressureTurnNumber,
    pairedPrefixThrough,
  });
  const branchValidity = branchValidityForTrace(trace, turns, {
    tutorAdaptationPolicy,
    minPressureTurnNumber,
  });
  const cue = findCue(turns);
  const anchor = cue ? extractAnchor(cue.text) : '';
  const cuePivot = cue ? findCuePivot(turns, cue, anchor) : null;
  const organic = cuePivot ? null : findOrganicPivot(turns);
  const pivotLearner = cuePivot?.turn || organic?.pivot || null;
  const resolvedAnchor = anchor || organic?.anchor || '';
  const cueAnalysis = cuePivot?.analysis || null;
  const learnerReframeScore = cueAnalysis?.learnerReframeScore ?? organic?.learnerReframeScore ?? 0;
  const learnerSelfReframe = Boolean(cueAnalysis?.learnerSelfReframe || organic?.learnerSelfReframe);

  const preTutor = pivotLearner ? findTutorBefore(turns, pivotLearner) : null;
  const postTutor = pivotLearner ? findTutorAfter(turns, pivotLearner) : null;
  const anchorTerms = termSet(resolvedAnchor);
  const pivotTerms = pivotLearner ? subtractSet(termSet(pivotLearner.text), anchorTerms) : new Set();
  const preOverlap = preTutor ? overlapRatio(pivotTerms, preTutor.text) : 0;
  const postOverlap = postTutor ? overlapRatio(pivotTerms, postTutor.text) : 0;
  const uptakeDelta = postOverlap - preOverlap;
  const sharedWithPost = postTutor ? sharedTerms(pivotTerms, termSet(postTutor.text)) : [];
  const sharedWithPre = preTutor ? new Set(sharedTerms(pivotTerms, termSet(preTutor.text))) : new Set();
  const novelShared = sharedWithPost.filter((term) => !sharedWithPre.has(term)).slice(0, 12);
  const beforeStrategy = preTutor ? strategyFor(preTutor.text) : null;
  const afterStrategy = postTutor ? strategyFor(postTutor.text) : null;
  const strategyShift = Boolean(beforeStrategy && afterStrategy && beforeStrategy !== afterStrategy);
  const explicitUptake = postTutor
    ? /\b(?:that line|your line|you just|you said|the frame|that wording|the question you are asking|the number has to earn)\b/i.test(
        postTutor.text,
      )
    : false;
  const tutorContingentAdaptation = Boolean(
    learnerSelfReframe &&
    postTutor &&
    ((postOverlap >= 0.16 && uptakeDelta >= 0.03 && novelShared.length >= 2) || explicitUptake),
  );
  const rawTutorAdaptationScore = Math.min(
    100,
    20 +
      Math.min(35, postOverlap * 100) +
      Math.min(25, Math.max(0, uptakeDelta) * 125) +
      Math.min(10, novelShared.length * 2) +
      (strategyShift ? 10 : 0),
  );
  const tutorAdaptationScore = learnerSelfReframe ? round(rawTutorAdaptationScore, 1) : 0;

  return {
    itemId,
    analyzerVersion: ANALYZER_VERSION,
    sourceTracePath: sourceTracePath ? rel(sourceTracePath) : null,
    cuePolicy: cue?.directorCue?.revisitPolicy || (cue ? 'anchor' : null),
    cueTurnNumber: cue?.turnNumber ?? null,
    pivotLearnerTurn: pivotLearner?.turnNumber ?? null,
    learnerSelfReframe,
    learnerReframeScore,
    tutorPreTurn: preTutor?.turnNumber ?? null,
    tutorPostTurn: postTutor?.turnNumber ?? null,
    tutorStrategyBefore: beforeStrategy,
    tutorStrategyAfter: afterStrategy,
    tutorStrategyShift: strategyShift,
    preTutorPivotOverlap: round(preOverlap),
    postTutorPivotOverlap: round(postOverlap),
    uptakeDelta: round(uptakeDelta),
    sharedSalientTerms: novelShared,
    tutorContingentAdaptation,
    tutorAdaptationScore,
    evidence: [
      pivotLearner ? `learner: ${pivotLearner.text.slice(0, 180)}` : null,
      postTutor ? `post tutor: ${postTutor.text.slice(0, 180)}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    metadata: {
      anchor: resolvedAnchor || null,
      pivotTerms: [...pivotTerms].slice(0, 40),
      sharedWithPost,
      explicitUptake,
      peripeteia,
      branch_validity: branchValidity,
    },
  };
}

function analyzeItem(item) {
  const tracePath = tracePathForItem(item);
  if (!tracePath) {
    return {
      itemId: item.id,
      analyzerVersion: ANALYZER_VERSION,
      sourceTracePath: null,
      learnerSelfReframe: false,
      tutorStrategyShift: false,
      tutorContingentAdaptation: false,
      tutorAdaptationScore: 0,
      uptakeDelta: 0,
      sharedSalientTerms: [],
      metadata: { error: 'missing_trace' },
    };
  }
  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  return analyzeTraceForTutorAdaptation({ itemId: item.id, trace, sourceTracePath: tracePath });
}

function summarizeRows(rows) {
  const groups = {};
  for (const row of rows) {
    const key = `${row.runId || 'unknown'}:${row.arm || 'default'}`;
    groups[key] ||= {
      runId: row.runId,
      arm: row.arm || 'default',
      total: 0,
      learnerSelfReframes: 0,
      tutorAdaptations: 0,
      branchValid: 0,
      reversalEventsUsed: 0,
      instrumentedPressure: 0,
      privateRoutes: 0,
      peripeteiaAdaptations: 0,
      peripeteiaScoreSum: 0,
      scoreSum: 0,
      uptakeDeltaSum: 0,
    };
    const peripeteia = row.metadata?.peripeteia || {};
    const branchValidity = row.metadata?.branch_validity || {};
    groups[key].total += 1;
    if (row.learnerSelfReframe) groups[key].learnerSelfReframes += 1;
    if (row.tutorContingentAdaptation) groups[key].tutorAdaptations += 1;
    if (branchValidity.valid) groups[key].branchValid += 1;
    if (branchValidity.learner_reversal_event_used) groups[key].reversalEventsUsed += 1;
    if (peripeteia.instrumented_pressure) groups[key].instrumentedPressure += 1;
    if (peripeteia.private_mechanism_declared) groups[key].privateRoutes += 1;
    if (peripeteia.tutor_adaptive_mechanism || peripeteia.tutor_strategy_reversal) {
      groups[key].peripeteiaAdaptations += 1;
    }
    groups[key].peripeteiaScoreSum += peripeteia.tutor_peripeteia_score || 0;
    groups[key].scoreSum += row.tutorAdaptationScore || 0;
    groups[key].uptakeDeltaSum += row.uptakeDelta || 0;
  }
  return Object.values(groups)
    .sort((a, b) => `${a.runId}:${a.arm}`.localeCompare(`${b.runId}:${b.arm}`))
    .map((group) => ({
      ...group,
      meanTutorAdaptationScore: round(group.scoreSum / group.total, 1),
      meanPeripeteiaScore: round(group.peripeteiaScoreSum / group.total, 1),
      meanUptakeDelta: round(group.uptakeDeltaSum / group.total),
    }));
}

function renderCsv(rows) {
  const header = [
    'run_id',
    'item_id',
    'unit_id',
    'arm',
    'tid',
    'drama_id',
    'learner_self_reframe',
    'tutor_contingent_adaptation',
    'tutor_adaptation_score',
    'uptake_delta',
    'tutor_strategy_before',
    'tutor_strategy_after',
    'shared_salient_terms',
    'branch_valid',
    'requires_learner_reversal_event',
    'learner_reversal_event_used',
    'learner_reversal_event_trigger_type',
    'learner_reversal_event_source',
    'learner_reversal_event_branch_local',
    'learner_reversal_candidate_trigger_types',
    'requires_learner_reframe_event',
    'learner_reframe_event_used',
    'source_trace_path',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      (() => {
        const branchValidity = row.metadata?.branch_validity || {};
        return [
          row.runId,
          row.itemId,
          row.unitId,
          row.arm,
          row.tid,
          row.dramaId,
          row.learnerSelfReframe ? 1 : 0,
          row.tutorContingentAdaptation ? 1 : 0,
          row.tutorAdaptationScore,
          row.uptakeDelta,
          row.tutorStrategyBefore,
          row.tutorStrategyAfter,
          row.sharedSalientTerms.join(' '),
          branchValidity.valid,
          branchValidity.requires_learner_reversal_event,
          branchValidity.learner_reversal_event_used,
          branchValidity.learner_reversal_event_trigger_type,
          branchValidity.learner_reversal_event_source,
          branchValidity.learner_reversal_event_branch_local,
          branchValidity.learner_reversal_candidate_trigger_types,
          branchValidity.requires_learner_reframe_event,
          branchValidity.learner_reframe_event_used,
          row.sourceTracePath,
        ];
      })()
        .map(csvCell)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function buildAnalysis(db, args) {
  const items = loadItems(db, { runId: args.runId, targetOnly: args.targetOnly });
  const rows = items.map((item) => ({
    runId: item.run_id,
    unitId: item.unit_id,
    arm: item.arm,
    tid: item.tid,
    dramaId: item.drama_id,
    ...analyzeItem(item),
  }));
  return {
    generatedAt: new Date().toISOString(),
    analyzerVersion: ANALYZER_VERSION,
    runFilter: args.runId || null,
    targetOnly: args.targetOnly,
    summary: summarizeRows(rows),
    rows,
  };
}

function persistAnalysis(db, rows) {
  const tx = db.transaction(() => {
    for (const row of rows) upsertPoeticsTutorAdaptation(db, row);
  });
  tx();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = openPoeticsStore(args.dbPath || undefined);
  try {
    const analysis = buildAnalysis(db, args);
    if (!args.dryRun) persistAnalysis(db, analysis.rows);
    if (args.out) writeFile(args.out, `${JSON.stringify(analysis, null, 2)}\n`);
    if (args.csv) writeFile(args.csv, renderCsv(analysis.rows));
    const total = analysis.rows.length;
    const adapted = analysis.rows.filter((row) => row.tutorContingentAdaptation).length;
    const learner = analysis.rows.filter((row) => row.learnerSelfReframe).length;
    console.log(
      `${args.dryRun ? 'would analyze' : 'analyzed'} tutor adaptation: ` +
        `${total} item(s), ${learner} learner self-reframe(s), ${adapted} tutor contingent adaptation(s)`,
    );
    for (const group of analysis.summary) {
      console.log(
        `  ${group.runId} ${group.arm}: learner ${group.learnerSelfReframes}/${group.total}, ` +
          `uptake ${group.tutorAdaptations}/${group.total}, mean uptake ${group.meanTutorAdaptationScore}, ` +
          `peripeteia ${group.peripeteiaAdaptations}/${group.total}, mean peripeteia ${group.meanPeripeteiaScore}`,
      );
    }
  } finally {
    db.close();
  }
}

if (path.resolve(process.argv[1] || '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error?.stack || String(error));
    process.exit(1);
  }
}

export {
  ANALYZER_VERSION,
  analyzePeripeteia,
  analyzeTraceForTutorAdaptation,
  branchValidityForTrace,
  buildAnalysis,
  learnerResistanceScore,
  markerReframeScore,
  renderCsv,
  strategyFor,
  terms,
};
