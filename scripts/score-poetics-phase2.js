#!/usr/bin/env node
/**
 * Poetics Phase-2 scorer + transfer gate — tutoring-drama FORM on real transcripts.
 *
 * Phase 0/1 validated, on canonical literary drama, an instrument that classifies
 * dramatic FORM (does a later turn re-read / re-semanticize the earlier turns?).
 * Phase 2 points it at the real object: transcripts of LLM tutor↔learner dialogue,
 * and asks the one open question — does FORM-classification TRANSFER from literary
 * to tutoring drama? (config/poetics-calibration/PHASE2-DESIGN.md §3.)
 *
 * FRAMING LOCK (load-bearing): this makes NO claim about whether the learner
 * learned. The unit is the transcript-as-drama; every axis is a TEXTUAL act. The
 * primary relation is: does a LATER *learner* turn re-read the learner's OWN
 * earlier turns, so they now mean something they did not before?
 *
 * Two modes.
 *
 *   (default) SCORE — run the blind instrument over the neutral phase2-sample/
 *     T*.txt transcripts. Per transcript the critic proposes a pivot LEARNER turn
 *     and scores four axes; the per-axis EVIDENCE GATE clamps any 4-5 with no
 *     verbatim quote down to 3. The 3-way FORM category is then DERIVED
 *     mechanically from the gated scores (§4.3 hit rules) — never self-reported by
 *     the model, so the verdict stays a function of quotable evidence. Writes
 *     exports/poetics-phase2-<critic>.json.
 *
 *       recontextualization (PRIMARY, gating) — pivot re-reads earlier learner turns
 *       stated-insight salience (NEW, corroborating) — learner SAYS "I get it now"
 *       rupture (corroborating)                — pivot departs from the set-up trajectory
 *       global coherence (reported)            — fluency; expected high across classes
 *
 *     Derived FORM:  recognition  iff recon ≥ 75 (raw 4-5, with a valid pre-pivot quote)
 *                    trap         iff stated-insight ≥ 75 AND recon < 75
 *                    flat         otherwise
 *
 *   --gate TRANSFER GATE — pure computation, no API. Join the instrument's FORM
 *     (exports/poetics-phase2-<critic>.json) to the INDEPENDENT human FORM labels
 *     (config/poetics-calibration/phase2-labels-<id>.yaml, from
 *     label-poetics-phase2.js) and report instrument-vs-human agreement: weighted
 *     κ (the pinned gate statistic), nominal κ, raw agreement, the 3×3 confusion,
 *     and — with ≥2 labellers — inter-labeller κ. PASS = weighted κ ≥ 0.60 for
 *     EVERY labeller (conservative; §6 pinned bar). The labels must be HUMAN — an
 *     AI-labelled gate would be closed-loop self-validation (§3.2).
 *
 * Critic ≠ author: tutoring transcripts contain Claude-generated turns, so codex is
 * the clean primary critic; claude-code is a same-family cross-check (§4.2).
 *
 * Usage:
 *   node scripts/score-poetics-phase2.js [--model codex|claude-code|gpt|sonnet|haiku]
 *        [--concurrency 3] [--mock] [--sample-dir DIR] [--key FILE] [--out FILE]
 *        [--allow-quality-warnings] [--preserve-existing]
 *   node scripts/score-poetics-phase2.js --gate [--artifact FILE]
 *        [--labels FILE]... [--key FILE] [--threshold 0.60]
 *
 * --mock returns deterministic neutral stubs (no API) to smoke the plumbing.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';
import { callModel, parseJsonResponse, runWithConcurrency, MODEL_MAP } from './score-poetics-calibration.js';
import { evidencePresent, to100 } from './score-poetics-phase1.js';
import { createProgressReporter } from './progress.js';
import { quadraticWeightedKappa, cohenKappa } from './compare-poetics-critics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const CALIB_DIR = path.join(ROOT, 'config/poetics-calibration');
const SAMPLE_DIR_DEFAULT = path.join(CALIB_DIR, 'phase2-sample');
const KEY_PATH = path.join(CALIB_DIR, 'phase2-key.yaml');
const EXPORTS_DIR = path.join(ROOT, 'exports');

// Pre-registered cuts (§4.3). Score→0-100 map is {1:0,2:25,3:50,4:75,5:100}; the
// "hit" band is raw 4-5 ⇒ ≥ 75. recon ≥ 75 = a re-reading reached the recognition
// band; stated-insight ≥ 75 = the learner loudly declared understanding.
const RECON_HIT_CUT = 75;
const STATED_INSIGHT_HIGH_CUT = 75; // PINNED 2026-05-20 (pre-data sign-off); §6.1

// Ordinal order for the weighted-κ gate, on a "recognition-authenticity" axis:
// genuine → absent → counterfeit. flat (the honest null) sits BETWEEN recognition
// and trap, so the recognition↔trap confusion — the instrument being fooled by
// insight-costume, the anti-simulation core — is the maximally penalised
// disagreement (distance 2). PINNED 2026-05-20 (pre-data sign-off); §6.1.
const FORM_ORDER = ['recognition', 'flat', 'trap'];
const FORM_INDEX = Object.fromEntries(FORM_ORDER.map((c, i) => [c, i]));

const TRANSFER_THRESHOLD = 0.6; // §6 PINNED

// ── transcript parsing (mirrors label-poetics-phase2.js parseTurns) ─────────────

// Split a neutral T*.txt into ordered STAGE/TUTOR/LEARNER turns. Blank-line
// separated blocks, each starting "STAGE:" / "TUTOR:" / "LEARNER:". A stray block
// with no role prefix is appended to the previous turn (defensive — should not
// happen in clean samples).
function parseTurns(raw) {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const turns = [];
  for (const b of blocks) {
    const m = b.match(/^(STAGE|TUTOR|LEARNER):\s*([\s\S]*)$/);
    if (m) turns.push({ role: m[1], text: m[2].trim() });
    else if (turns.length) turns[turns.length - 1].text += '\n\n' + b;
  }
  return turns;
}

// Number turns per-role: tutor T1,T2,… and learner L1,L2,…. The learner index is
// what the critic returns as the pivot and what the human labeller pins, so the two
// channels reference turns the same way.
function numberTranscript(turns) {
  let sn = 0;
  let tn = 0;
  let ln = 0;
  return turns
    .map((t) => {
      const tag = t.role === 'STAGE' ? `S${++sn}` : t.role === 'TUTOR' ? `T${++tn}` : `L${++ln}`;
      return `[${tag}] ${t.role}: ${t.text}`;
    })
    .join('\n\n');
}

const BLIND_SCORING_PROTOCOL = {
  version: 'poetics-blind-scoring-v1',
  promptInput: 'transcript_text_only',
  hiddenFromCritic: ['generator', 'model_provider', 'run_id', 'condition_label', 'file_path', 'score_history'],
  cliIsolation: {
    codex: 'ephemeral read-only temp cwd',
    claude: 'non-persistent temp cwd with project/local settings and tools disabled',
  },
};

// ── critic prompt (Phase-2 axes; the §2 transposition + the new stated-insight) ──

function buildPhase2Prompt(turns) {
  const numbered = numberTranscript(turns);
  return `You are a structural critic of dramatic FORM in a tutoring dialogue. You are
given ONLY the transcript, turns numbered [S1],[T1],[L1],[T2],[L2],… — S = a
visible stage direction, T = a tutor turn, L = a learner turn. Use stage
directions as context only; the pivot must always be a LEARNER turn. Score ONLY
what is on the page.

The generator, model provider, run ID, condition label, file path, and score
history are intentionally unavailable. Do not infer, guess, mention, or use any
authorship/source information. Treat the dialogue as an anonymous transcript.

You are NOT judging whether the learner "really understood" anything — that is
unknowable and not what this measures. You judge a TEXT RELATION: does a LATER
learner turn re-read the learner's OWN EARLIER learner turns, so that those earlier
turns now mean something they did not appear to mean at the time?

You are NOT scoring warmth, encouragement, or the VOCABULARY of insight. A learner
turn that announces "now I get it", "that makes sense", "aha" is NOT, by saying so,
a re-reading. The words that NAME insight are scored separately (axis 2); the
STRUCTURE of re-reading is axis 1. Keep the two apart.

Do the following.

1. PIVOT LEARNER TURN. Identify the ONE learner turn [L k] that best re-reads the
   learner's own earlier turns. If no learner turn re-reads earlier ones (the
   exchange only proceeds, or only ASSERTS understanding without re-reading
   anything), set pivot_learner_turn to null.

2. RECONTEXTUALIZATION (score 1-5). THE CENTRAL TEST. In light of the pivot learner
   turn, does the SIGNIFICANCE of the learner's EARLIER turns change — are they
   re-read, re-semanticized (e.g. "I kept demanding a formula because I didn't trust
   the picture")?
     5 = an earlier learner turn is decisively re-semanticized; what it meant flips.
     1 = earlier learner turns mean exactly the same before and after; nothing re-read.
   You MUST quote the specific EARLIER learner material (from a learner turn BEFORE
   the pivot) whose meaning changes, VERBATIM, in recohered_earlier. If nothing
   earlier is re-read, score 1-2 and leave recohered_earlier empty.

3. STATED-INSIGHT SALIENCE (score 1-5). Does the learner SAY they have understood —
   "now I get it", "that makes sense", "ohh", "aha", "that clears it up"? Score how
   loudly the learner DECLARES insight, REGARDLESS of whether any re-reading (axis 1)
   actually occurs.
     5 = the learner emphatically declares a breakthrough.
     1 = the learner makes no claim to have understood.
   Quote the strongest insight-declaration VERBATIM from a learner turn in evidence
   (empty string if there is none).

4. RUPTURE (score 1-5). Look only at the turns BEFORE the pivot. They set up a naive
   forward trajectory — an expected next development. Does the pivot learner turn
   DEPART from that trajectory?
     5 = the pivot turns against where the prior turns were pointing.
     1 = it continues exactly where they were heading, or there is no pivot at all.
   State the naive_trajectory (one sentence), then quote the pivot learner turn
   VERBATIM as evidence.

5. GLOBAL COHERENCE (score 1-5). Independent of the above: is this a coherent,
   well-formed exchange (5) or disjointed noise (1)? Note: a flat exchange and a
   fluent insight-gush are BOTH coherent — coherence is not a mark of re-reading.

6. TUTOR ADAPTIVE MECHANISM / PERIPETEIA (score 1-5). Identify the learner turn
   that creates pressure for a reversal of fortune: resistance, breakdown, false
   closure, contradiction, or a mismatch showing the prior teaching move is no
   longer working. Set reversal_trigger_learner_turn to that learner-turn index,
   or null if there is no such pressure. Does a later tutor turn visibly take
   stock, break a failed tutoring habit, and invent an adaptive learning
   mechanism because of that pressure?
   Score dramatic structure, not archaic style imitation: the mechanism may use
   Aristotelian reversal-recognition, Shakespearean role/phrase turn, Brechtian
   interruption, Miller/social-realist consequence, object work, counterexample,
   representation shift, or affective register while remaining in modern
   standard English idiom. Warmth, cheer, and informality are not good by
   themselves; score whether the chosen register helps create learning aptitude.
     5 = the tutor clearly changes route, task, role, object, evidence standard,
         representation, cognitive load, interruption, social consequence, or
         affective register in response to the pressure.
     1 = the tutor repeats the prior move, simply reassures, or no pressure exists.
   Quote the strongest later tutor adaptive-mechanism move VERBATIM in evidence.

7. RECOGNITION-CONTINGENT TUTOR UPTAKE (score 1-5). If a pivot learner turn exists,
   does a later tutor turn adapt to the learner's revised framing, rather than merely
   continue the prior lesson plan? This is a useful closing/follow-through pattern,
   but it is not the main adaptation trigger.
     5 = the tutor visibly changes the task, question, evidence standard, or
         framing move in response to the learner's revised frame.
     1 = no later tutor uptake, or only generic praise/continuation.
   Quote the strongest later tutor uptake VERBATIM in evidence. If there is no
   later tutor turn after the pivot, score 1-2 and leave evidence empty.

EVIDENCE GATE (strict): any score of 4 or 5 REQUIRES a VERBATIM quote in the
matching evidence field — recontextualization from an EARLIER learner turn,
stated-insight from a learner turn, rupture from the pivot learner turn, coherence
from anywhere in the transcript, tutor adaptive mechanism from a TUTOR turn AFTER
the reversal trigger, and recognition-contingent tutor uptake from a TUTOR turn
AFTER the pivot learner turn. No exact quote → you may not score above 3.

TRANSCRIPT:
---
${numbered}
---

Return ONLY this JSON object (no prose before or after):
{
  "pivot_learner_turn": <integer learner-turn index (the k in L k), or null>,
  "recontextualization": { "score": <integer 1-5>, "recohered_earlier": "<verbatim from an EARLIER learner turn, or empty string>", "justification": "<one sentence>" },
  "stated_insight": { "score": <integer 1-5>, "evidence": "<verbatim insight-declaration from a learner turn, or empty string>" },
  "rupture": { "score": <integer 1-5>, "naive_trajectory": "<one sentence>", "evidence": "<verbatim from the pivot learner turn>" },
  "global_coherence": { "score": <integer 1-5>, "evidence": "<verbatim, or empty string>" },
  "reversal_trigger_learner_turn": <integer learner-turn index (the k in L k), or null>,
  "tutor_strategy_reversal": { "score": <integer 1-5>, "evidence": "<verbatim from a later tutor turn, or empty string>", "justification": "<one sentence>" },
  "tutor_contingent_adaptation": { "score": <integer 1-5>, "evidence": "<verbatim from a later tutor turn after the learner pivot, or empty string>", "justification": "<one sentence>" }
}`;
}

// ── scoring + per-axis evidence gates ───────────────────────────────────────────

const clampScore = (x) => Math.max(1, Math.min(5, Math.round(Number(x) || 1)));

// Apply the per-axis evidence gates against Phase-2 haystacks. The recon gate is
// load-bearing: its quote must come from a learner turn BEFORE the pivot — a fluent
// model cannot assert "this re-reads what I said" without showing which earlier
// learner turn recoheres.
function roleTexts(turns, role) {
  return (turns || []).filter((t) => t.role === role).map((t) => t.text);
}

function tutorTextAfterPivot(turns, pivotLearnerTurn) {
  if (!pivotLearnerTurn) return '';
  let learnerIndex = 0;
  let afterPivot = false;
  const laterTutor = [];
  for (const turn of turns || []) {
    if (turn.role === 'LEARNER') {
      learnerIndex += 1;
      if (learnerIndex === pivotLearnerTurn) afterPivot = true;
      continue;
    }
    if (afterPivot && turn.role === 'TUTOR') laterTutor.push(turn.text);
  }
  return laterTutor.join('\n');
}

function applyPhase2Gates(parsed, turns, wholeText) {
  const flags = [];
  const learnerTurns = roleTexts(turns, 'LEARNER');
  const nLearner = learnerTurns.length;
  let pivot = Number.isInteger(parsed.pivot_learner_turn) ? parsed.pivot_learner_turn : null;
  if (pivot != null && (pivot < 1 || pivot > nLearner)) {
    flags.push(`pivot_out_of_range:${pivot}`);
    pivot = null;
  }
  let reversalTrigger = Number.isInteger(parsed.reversal_trigger_learner_turn)
    ? parsed.reversal_trigger_learner_turn
    : null;
  if (reversalTrigger != null && (reversalTrigger < 1 || reversalTrigger > nLearner)) {
    flags.push(`reversal_trigger_out_of_range:${reversalTrigger}`);
    reversalTrigger = null;
  }

  const pivotText = pivot ? learnerTurns[pivot - 1] : '';
  const earlierLearnerText = pivot ? learnerTurns.slice(0, pivot - 1).join('\n') : '';
  const allLearnerText = learnerTurns.join('\n');
  const postPivotTutorText = tutorTextAfterPivot(turns, pivot);
  const postReversalTutorText = tutorTextAfterPivot(turns, reversalTrigger);

  // RECONTEXTUALIZATION — primary; evidence from a learner turn before the pivot.
  const rec = parsed.recontextualization || {};
  let recon = clampScore(rec.score);
  if (recon > 3) {
    if (!pivot || !earlierLearnerText) {
      flags.push(`recon_clamp_no_earlier:${recon}->3`);
      recon = 3;
    } else if (!evidencePresent(rec.recohered_earlier, earlierLearnerText)) {
      flags.push(`recon_evidence_clamp:${recon}->3`);
      recon = 3;
    }
  }

  // STATED-INSIGHT — the on-distribution affect-decoy; evidence from any learner turn.
  const si = parsed.stated_insight || {};
  let statedInsight = clampScore(si.score);
  if (statedInsight > 3 && !evidencePresent(si.evidence, allLearnerText)) {
    flags.push(`stated_insight_evidence_clamp:${statedInsight}->3`);
    statedInsight = 3;
  }

  // RUPTURE — relative to the pivot; evidence must be the pivot learner turn.
  const rup = parsed.rupture || {};
  let rupture = clampScore(rup.score);
  if (rupture > 3) {
    if (!pivot) {
      flags.push(`rupture_clamp_no_pivot:${rupture}->3`);
      rupture = 3;
    } else if (!evidencePresent(rup.evidence, pivotText)) {
      flags.push(`rupture_evidence_clamp:${rupture}->3`);
      rupture = 3;
    }
  }

  // GLOBAL COHERENCE — reported; evidence anywhere in the transcript.
  const coh = parsed.global_coherence || {};
  let coherence = clampScore(coh.score);
  if (coherence > 3 && !evidencePresent(coh.evidence, wholeText)) {
    flags.push(`coherence_evidence_clamp:${coherence}->3`);
    coherence = 3;
  }

  // TUTOR ADAPTIVE MECHANISM — the primary adaptation axis for peripeteia.
  const tsr = parsed.tutor_strategy_reversal || {};
  let tutorStrategicReversal = clampScore(tsr.score);
  if (tutorStrategicReversal > 3) {
    if (!reversalTrigger || !postReversalTutorText) {
      flags.push(`tutor_strategy_reversal_clamp_no_post_tutor:${tutorStrategicReversal}->3`);
      tutorStrategicReversal = 3;
    } else if (!evidencePresent(tsr.evidence, postReversalTutorText)) {
      flags.push(`tutor_strategy_reversal_evidence_clamp:${tutorStrategicReversal}->3`);
      tutorStrategicReversal = 3;
    }
  }

  // RECOGNITION-CONTINGENT TUTOR UPTAKE — useful closure, but not the main trigger.
  const tca = parsed.tutor_contingent_adaptation || {};
  let tutorContingentAdaptation = clampScore(tca.score);
  if (tutorContingentAdaptation > 3) {
    if (!pivot || !postPivotTutorText) {
      flags.push(`tutor_adaptation_clamp_no_post_tutor:${tutorContingentAdaptation}->3`);
      tutorContingentAdaptation = 3;
    } else if (!evidencePresent(tca.evidence, postPivotTutorText)) {
      flags.push(`tutor_adaptation_evidence_clamp:${tutorContingentAdaptation}->3`);
      tutorContingentAdaptation = 3;
    }
  }

  const tutorStrategicReversal100 = to100(tutorStrategicReversal);
  const tutorContingentAdaptation100 = to100(tutorContingentAdaptation);
  const recoheredEarlier = typeof rec.recohered_earlier === 'string' ? rec.recohered_earlier : '';
  const tutorReversalEvidence = typeof tsr.evidence === 'string' ? tsr.evidence : '';
  const tutorReversalJustification = typeof tsr.justification === 'string' ? tsr.justification : '';
  const tutorAdaptationEvidence = typeof tca.evidence === 'string' ? tca.evidence : '';
  const tutorAdaptationJustification = typeof tca.justification === 'string' ? tca.justification : '';

  return {
    pivot,
    reversalTrigger,
    raw: { recon, statedInsight, rupture, coherence, tutorStrategicReversal, tutorContingentAdaptation },
    recon100: to100(recon),
    statedInsight100: to100(statedInsight),
    rupture100: to100(rupture),
    coherence100: to100(coherence),
    tutorStrategicReversal100,
    tutorContingentAdaptation100,
    recoheredEarlier,
    statedInsightEvidence: typeof si.evidence === 'string' ? si.evidence : '',
    naiveTrajectory: typeof rup.naive_trajectory === 'string' ? rup.naive_trajectory : '',
    tutorReversalEvidence,
    tutorReversalJustification,
    tutorAdaptationEvidence,
    tutorAdaptationJustification,
    roleSymmetricScores: {
      learner_self_reframe: {
        score100: to100(recon),
        evidence: recoheredEarlier,
        source: 'recontextualization_axis',
      },
      tutor_contingent_adaptation: {
        score100: tutorContingentAdaptation100,
        evidence: tutorAdaptationEvidence,
        justification: tutorAdaptationJustification,
        source: 'recognition_contingent_tutor_uptake_axis',
      },
      tutor_strategy_reversal: {
        score100: tutorStrategicReversal100,
        evidence: tutorReversalEvidence,
        justification: tutorReversalJustification,
        triggerLearnerTurn: reversalTrigger,
        source: 'tutor_adaptive_mechanism_axis',
      },
      tutor_adaptive_mechanism: {
        score100: tutorStrategicReversal100,
        evidence: tutorReversalEvidence,
        justification: tutorReversalJustification,
        triggerLearnerTurn: reversalTrigger,
        source: 'tutor_adaptive_mechanism_axis',
      },
    },
    flags,
  };
}

// Derived 3-way FORM (§4.3) — a function of the GATED scores, not a model opinion.
function deriveForm(recon100, statedInsight100) {
  if (recon100 >= RECON_HIT_CUT) return 'recognition';
  if (statedInsight100 >= STATED_INSIGHT_HIGH_CUT) return 'trap';
  return 'flat';
}

// Deterministic neutral stub: mid pivot, all axes 3, no evidence → every gate
// clamps to 3, recon100=si100=50 → flat. Exercises plumbing, not the claim.
function mockResponse(nLearner) {
  return JSON.stringify({
    pivot_learner_turn: Math.max(1, Math.ceil(nLearner / 2)),
    recontextualization: { score: 3, recohered_earlier: '', justification: 'mock' },
    stated_insight: { score: 3, evidence: '' },
    rupture: { score: 3, naive_trajectory: 'mock', evidence: '' },
    global_coherence: { score: 3, evidence: '' },
    reversal_trigger_learner_turn: null,
    tutor_strategy_reversal: { score: 3, evidence: '', justification: 'mock' },
    tutor_contingent_adaptation: { score: 3, evidence: '', justification: 'mock' },
  });
}

async function scoreItem({ id, text }, modelKey, mock) {
  const turns = parseTurns(text);
  const learnerTurns = turns.filter((t) => t.role === 'LEARNER').map((t) => t.text);
  const tutorTurns = turns.filter((t) => t.role === 'TUTOR').length;
  const wholeText = turns.map((t) => t.text).join('\n');
  const prompt = buildPhase2Prompt(turns);
  let raw;
  try {
    raw = mock ? mockResponse(learnerTurns.length) : await callModel(prompt, modelKey);
  } catch (err) {
    return { id, error: err.message };
  }
  let parsed;
  try {
    parsed = parseJsonResponse(raw);
  } catch (err) {
    return { id, error: `parse: ${err.message}` };
  }
  const g = applyPhase2Gates(parsed, turns, wholeText);
  const formClass = deriveForm(g.recon100, g.statedInsight100);
  return {
    id,
    nLearnerTurns: learnerTurns.length,
    nTutorTurns: tutorTurns,
    pivotLearnerTurn: g.pivot,
    reversalTriggerLearnerTurn: g.reversalTrigger,
    formClass,
    recontextualization: g.recon100,
    statedInsight: g.statedInsight100,
    rupture: g.rupture100,
    globalCoherence: g.coherence100,
    rawScores: g.raw,
    recoheredEarlier: g.recoheredEarlier,
    statedInsightEvidence: g.statedInsightEvidence,
    naiveTrajectory: g.naiveTrajectory,
    tutorStrategicReversal: g.tutorStrategicReversal100,
    tutorAdaptiveMechanism: g.tutorStrategicReversal100,
    tutorReversalEvidence: g.tutorReversalEvidence,
    tutorReversalJustification: g.tutorReversalJustification,
    tutorContingentAdaptation: g.tutorContingentAdaptation100,
    tutorAdaptationEvidence: g.tutorAdaptationEvidence,
    tutorAdaptationJustification: g.tutorAdaptationJustification,
    roleSymmetricScores: g.roleSymmetricScores,
    flags: g.flags,
  };
}

// ── H2: does stated-insight predict recohering? (instrument-internal, no humans) ──
// §4.3 H2 is per-turn; this instrument scores per-transcript (one pivot per call,
// §4.4 scan-and-self-identify), so H2 is operationalised at the transcript level:
// the share of HIGH-stated-insight transcripts whose pivot also reaches recon ≥ 75.
// A per-turn H2 would need the deferred max-split scorer (not built — anti-creep).
function computeH2(scored) {
  const ok = scored.filter((s) => !s.error);
  const high = ok.filter((s) => s.statedInsight >= STATED_INSIGHT_HIGH_CUT);
  const alsoRecon = high.filter((s) => s.recontextualization >= RECON_HIT_CUT);
  const share = high.length ? alsoRecon.length / high.length : null;
  return {
    nHighStatedInsight: high.length,
    nAlsoRecon: alsoRecon.length,
    share,
    disconfirmed: share != null ? share > 0.5 : null,
    note: 'transcript-level proxy for the per-turn H2 (§4.3); needs a real (non-mock) full-N run to mean anything',
  };
}

function formCounts(scored) {
  const c = { recognition: 0, trap: 0, flat: 0 };
  for (const s of scored) if (!s.error && c[s.formClass] != null) c[s.formClass]++;
  return c;
}

// ── score-mode report + artifact ────────────────────────────────────────────────

const num = (x) => (x == null || Number.isNaN(x) ? 'n/a' : x.toFixed(1));

function printScoreReport(scored, h2, counts, critic) {
  console.log(`\n══ Poetics Phase-2 — critic=${critic} (recontextualization = primary; FORM derived) ══\n`);
  console.log('id   form         recon  s-ins  rupt  coher  pivot  flags');
  for (const s of [...scored].sort((a, b) => a.id.localeCompare(b.id))) {
    if (s.error) {
      console.log(`${s.id.padEnd(4)} ERROR  ${s.error}`);
      continue;
    }
    console.log(
      `${s.id.padEnd(4)} ${s.formClass.padEnd(12)} ${num(s.recontextualization).padStart(5)} ` +
        `${num(s.statedInsight).padStart(5)} ${num(s.rupture).padStart(5)} ${num(s.globalCoherence).padStart(5)}  ` +
        `${String(s.pivotLearnerTurn ?? '—').padStart(4)}  ${s.flags.join(',') || ''}`,
    );
  }
  console.log(
    `\nFORM counts:  recognition ${counts.recognition} · trap ${counts.trap} · flat ${counts.flat}` +
      `   (cuts: recon≥${RECON_HIT_CUT}, stated-insight≥${STATED_INSIGHT_HIGH_CUT})`,
  );
  console.log(
    `H2 (stated-insight ⇏ recohering): ${h2.nAlsoRecon}/${h2.nHighStatedInsight} high-stated-insight transcripts ` +
      `also recon≥${RECON_HIT_CUT}` +
      (h2.share == null ? '  (no high-stated-insight transcripts)' : ` = ${(h2.share * 100).toFixed(0)}%`) +
      (h2.disconfirmed == null ? '' : h2.disconfirmed ? '  → H2 DISCONFIRMED (>50%)' : '  → H2 holds (<50%)'),
  );
  console.log('  (transfer gate must pass first — H2 is conditional on §3; needs a real full-N run)');
}

// ── transfer gate (--gate): instrument FORM vs INDEPENDENT human FORM ────────────

function remapInstrumentIdForBlindKey(id, key) {
  if (!key?.items) return id;
  if (key.items[id]) return id;
  const matches = Object.entries(key.items).filter(([, v]) => v?.source_tid === id);
  if (matches.length === 1) return matches[0][0];
  return id;
}

function loadInstrumentArtifact(p, key = null) {
  const d = JSON.parse(fs.readFileSync(p, 'utf8'));
  const byId = {};
  const sourceById = {};
  for (const s of d.scored || []) {
    if (!s.error && s.formClass) {
      const id = remapInstrumentIdForBlindKey(s.id, key);
      byId[id] = s.formClass;
      sourceById[id] = s.id;
    }
  }
  return { critic: d.critic || path.basename(p), byId, sourceById, file: p };
}

function loadHumanLabels(p) {
  const d = yaml.parse(fs.readFileSync(p, 'utf8')) || {};
  const byId = {};
  for (const [id, v] of Object.entries(d.labels || {})) if (v && v.label) byId[id] = v.label;
  return { labeller: d.labeller || path.basename(p), byId, file: p };
}

function confusion(instArr, humArr) {
  const M = FORM_ORDER.map(() => FORM_ORDER.map(() => 0));
  for (let i = 0; i < instArr.length; i++) M[instArr[i]][humArr[i]]++;
  return M;
}

function agree(instrument, labeller) {
  const ids = Object.keys(instrument.byId)
    .filter((id) => labeller.byId[id] != null)
    .sort();
  const instArr = ids.map((id) => FORM_INDEX[instrument.byId[id]]);
  const humArr = ids.map((id) => FORM_INDEX[labeller.byId[id]]);
  const exact = ids.filter((id) => instrument.byId[id] === labeller.byId[id]).length;
  return {
    n: ids.length,
    ids,
    exact,
    rawAgreement: ids.length ? exact / ids.length : NaN,
    weightedKappa: quadraticWeightedKappa(instArr, humArr, 0, FORM_ORDER.length - 1),
    nominalKappa: cohenKappa(instArr, humArr, 0, FORM_ORDER.length - 1),
    confusion: confusion(instArr, humArr),
  };
}

function interLabeller(a, b) {
  const ids = Object.keys(a.byId)
    .filter((id) => b.byId[id] != null)
    .sort();
  const aArr = ids.map((id) => FORM_INDEX[a.byId[id]]);
  const bArr = ids.map((id) => FORM_INDEX[b.byId[id]]);
  return { n: ids.length, weightedKappa: quadraticWeightedKappa(aArr, bArr, 0, FORM_ORDER.length - 1) };
}

const fmtK = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');

function printConfusion(M) {
  console.log(`         human→   ${FORM_ORDER.map((c) => c.slice(0, 5).padStart(6)).join(' ')}`);
  for (let i = 0; i < FORM_ORDER.length; i++) {
    console.log(
      `    inst ${FORM_ORDER[i].slice(0, 5).padEnd(6)}   ${M[i].map((v) => String(v).padStart(6)).join(' ')}`,
    );
  }
}

function runTransferGate(instrument, labellers, key, threshold) {
  console.log(`\n══ Poetics Phase-2 TRANSFER GATE — instrument vs HUMAN FORM ══\n`);
  console.log(
    `instrument: ${instrument.critic} (${Object.keys(instrument.byId).length} scored) ← ${path.relative(ROOT, instrument.file)}`,
  );
  console.log(`ordinal order (weighted κ): [${FORM_ORDER.join(', ')}]  ·  pinned bar κ ≥ ${threshold}`);
  console.log(`labellers: ${labellers.map((l) => l.labeller).join(', ')}\n`);

  const perLabeller = [];
  for (const l of labellers) {
    const a = agree(instrument, l);
    perLabeller.push({ labeller: l.labeller, ...a });
    console.log(`── instrument × ${l.labeller}  (n=${a.n} common) ──`);
    if (!a.n) {
      console.log('  no overlapping labelled transcripts — collect labels first\n');
      continue;
    }
    console.log(
      `  weighted κ = ${fmtK(a.weightedKappa)}   nominal κ = ${fmtK(a.nominalKappa)}   ` +
        `raw agreement = ${a.exact}/${a.n} (${(a.rawAgreement * 100).toFixed(0)}%)`,
    );
    printConfusion(a.confusion);
    console.log(
      `  → ${a.weightedKappa >= threshold ? 'PASS' : 'FAIL'} (weighted κ ${a.weightedKappa >= threshold ? '≥' : '<'} ${threshold})\n`,
    );
  }

  if (labellers.length >= 2) {
    console.log('── inter-labeller (human-vs-human reliability, §7) ──');
    for (let i = 0; i < labellers.length; i++)
      for (let j = i + 1; j < labellers.length; j++) {
        const il = interLabeller(labellers[i], labellers[j]);
        console.log(
          `  ${labellers[i].labeller} × ${labellers[j].labeller}: weighted κ = ${fmtK(il.weightedKappa)} (n=${il.n})`,
        );
      }
    console.log('');
  }

  if (key) {
    console.log('── per-stratum raw agreement (with held-out key; reported, conditional on gate) ──');
    for (const stratum of ['base', 'recognition']) {
      const sids = Object.entries(key.items || {})
        .filter(([, v]) => (v.stratum ?? v.condition) === stratum)
        .map(([id]) => id);
      for (const l of labellers) {
        const common = sids.filter((id) => instrument.byId[id] != null && l.byId[id] != null);
        const ex = common.filter((id) => instrument.byId[id] === l.byId[id]).length;
        console.log(
          `  ${stratum.padEnd(11)} × ${l.labeller}: ${ex}/${common.length} exact${common.length ? ` (${((ex / common.length) * 100).toFixed(0)}%)` : ''}`,
        );
      }
    }
    console.log('');
  }

  const usable = perLabeller.filter((p) => p.n > 0);
  const gatePass = usable.length > 0 && usable.every((p) => p.weightedKappa >= threshold);
  console.log(
    `GATE: ${
      usable.length === 0
        ? 'NO DATA — no overlapping instrument+human labels yet (run label-poetics-phase2.js, then re-score)'
        : gatePass
          ? `PASS — FORM-classification transfers to tutoring drama (weighted κ ≥ ${threshold} for all ${usable.length} labeller(s))`
          : `FAIL — the canon-validated instrument does NOT transfer (some labeller weighted κ < ${threshold}). Per §3 this is the finding; no downstream prevalence claims.`
    }`,
  );
  return { perLabeller, gatePass };
}

// ── args + main ──────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const o = {
    gate: false,
    model: 'codex',
    concurrency: 3,
    mock: false,
    out: null,
    sampleDir: SAMPLE_DIR_DEFAULT,
    artifact: null,
    labels: [],
    key: null,
    allowQualityWarnings: false,
    preserveExisting: false,
    threshold: TRANSFER_THRESHOLD,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--gate':
        o.gate = true;
        break;
      case '--model':
        o.model = args[++i];
        break;
      case '--concurrency':
        o.concurrency = parseInt(args[++i], 10);
        break;
      case '--mock':
        o.mock = true;
        break;
      case '--out':
        o.out = args[++i];
        break;
      case '--sample-dir':
        o.sampleDir = path.resolve(args[++i]);
        break;
      case '--artifact':
        o.artifact = path.resolve(args[++i]);
        break;
      case '--labels':
        o.labels.push(path.resolve(args[++i]));
        break;
      case '--key':
        o.key = path.resolve(args[++i]);
        break;
      case '--allow-quality-warnings':
        o.allowQualityWarnings = true;
        break;
      case '--preserve-existing':
        o.preserveExisting = true;
        break;
      case '--threshold':
        o.threshold = parseFloat(args[++i]);
        break;
      default:
        console.warn(`Unknown arg: ${args[i]}`);
    }
  }
  return o;
}

function loadExistingSuccessfulScores(outPath, critic) {
  if (!outPath || !fs.existsSync(outPath)) return new Map();
  try {
    const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    if (critic && existing.critic && existing.critic !== critic) {
      console.warn(
        `WARN: ignoring existing scores from ${path.relative(ROOT, outPath)} because critic is ${existing.critic}, not ${critic}`,
      );
      return new Map();
    }
    return new Map((existing.scored || []).filter((row) => row?.id && !row.error).map((row) => [row.id, row]));
  } catch (err) {
    console.warn(`WARN: could not read existing score artifact ${outPath}: ${err.message}`);
    return new Map();
  }
}

function loadQualityKey(p) {
  if (!p) return null;
  if (!fs.existsSync(p)) throw new Error(`quality/key file not found: ${p}`);
  return yaml.parse(fs.readFileSync(p, 'utf8')) || {};
}

function loadSample(dir, { key = null, allowQualityWarnings = false } = {}) {
  if (!fs.existsSync(dir))
    throw new Error(`No sample dir: ${dir}\n  → run scripts/load-poetics-phase2-sample.js first`);
  const skipped = [];
  const sample = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort((a, b) => a.localeCompare(b))
    .flatMap((f) => {
      const id = path.basename(f, '.txt');
      const item = key?.items?.[id] || null;
      const qualityWarnings = Array.isArray(item?.quality_warnings) ? item.quality_warnings : [];
      const qualityStatus =
        item?.quality_status || (qualityWarnings.length ? 'review_before_scoring' : 'legacy_unmarked');
      const blockingWarnings = qualityWarnings.filter((warning) => warning.severity !== 'info');
      const legacyBlockingStatus = qualityStatus === 'review_before_scoring' && qualityWarnings.length === 0;
      if (!allowQualityWarnings && (legacyBlockingStatus || blockingWarnings.length > 0)) {
        skipped.push({ id, qualityStatus, qualityWarnings });
        return [];
      }
      return [
        {
          id,
          text: fs.readFileSync(path.join(dir, f), 'utf8').trim(),
          qualityStatus,
          qualityWarnings,
        },
      ];
    });
  return { sample, skipped };
}

function newestArtifact() {
  if (!fs.existsSync(EXPORTS_DIR)) return null;
  const files = fs
    .readdirSync(EXPORTS_DIR)
    .filter((f) => /^poetics-phase2-.*\.json$/.test(f))
    .map((f) => path.join(EXPORTS_DIR, f));
  if (!files.length) return null;
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function defaultLabelFiles() {
  if (!fs.existsSync(CALIB_DIR)) return [];
  return fs
    .readdirSync(CALIB_DIR)
    .filter((f) => /^phase2-labels-.*\.yaml$/.test(f))
    .map((f) => path.join(CALIB_DIR, f))
    .sort();
}

async function mainGate(o) {
  const artifactPath = o.artifact || newestArtifact();
  if (!artifactPath)
    throw new Error('no instrument artifact (exports/poetics-phase2-*.json); run the scorer first or pass --artifact');
  const labelFiles = o.labels.length ? o.labels : defaultLabelFiles();
  if (!labelFiles.length)
    throw new Error(
      'no human label files (config/poetics-calibration/phase2-labels-*.yaml); run label-poetics-phase2.js first or pass --labels',
    );
  const key = o.key ? yaml.parse(fs.readFileSync(o.key, 'utf8')) : null;
  const instrument = loadInstrumentArtifact(artifactPath, key);
  const labellers = labelFiles.map(loadHumanLabels);
  const { gatePass } = runTransferGate(instrument, labellers, key, o.threshold);
  if (!gatePass) process.exitCode = 1;
}

async function mainScore(o) {
  if (!o.mock && !MODEL_MAP[o.model] && !String(o.model).includes('/'))
    console.warn(`WARN: unknown --model "${o.model}"; known: ${Object.keys(MODEL_MAP).join(', ')}`);
  const qualityKey = loadQualityKey(o.key);
  const { sample, skipped } = loadSample(o.sampleDir, {
    key: qualityKey,
    allowQualityWarnings: o.allowQualityWarnings,
  });
  const critic = o.mock ? 'mock' : o.model;
  const outPath = o.out || path.join(EXPORTS_DIR, `poetics-phase2-${critic.replace(/[^\w-]/g, '_')}.json`);
  const existingSuccessful = o.preserveExisting ? loadExistingSuccessfulScores(outPath, critic) : new Map();
  const sampleToScore = existingSuccessful.size ? sample.filter((item) => !existingSuccessful.has(item.id)) : sample;
  if (skipped.length) {
    console.warn(
      `Skipping ${skipped.length} transcript(s) with quality warnings from ${path.relative(ROOT, o.key)} ` +
        '(pass --allow-quality-warnings to score anyway):',
    );
    for (const item of skipped) {
      console.warn(
        `  - ${item.id}: ${item.qualityStatus}` +
          (item.qualityWarnings.length ? ` (${item.qualityWarnings.map((w) => w.code).join(',')})` : ''),
      );
    }
  }
  if (!sample.length) throw new Error('no scoreable transcripts after quality filtering');
  if (!sampleToScore.length && existingSuccessful.size) {
    console.log(`All ${sample.length} scoreable transcripts already have successful rows in ${path.relative(ROOT, outPath)}`);
  }
  console.log(
    `Scoring ${sampleToScore.length} transcript${sampleToScore.length === 1 ? '' : 's'} with ${o.mock ? 'MOCK' : o.model} ` +
      `(concurrency ${o.concurrency})` +
      (existingSuccessful.size ? `; preserving ${existingSuccessful.size} existing successful row(s)` : '') +
      '...',
  );
  const progress = createProgressReporter({
    label: 'scoring',
    total: sampleToScore.length,
  });
  progress.start(`${o.mock ? 'MOCK' : o.model} · concurrency ${o.concurrency}`);
  const newlyScored = await runWithConcurrency(
    sampleToScore.map((item) => async () => {
      const result = await scoreItem(item, o.model, o.mock);
      progress.step(`${item.id} ${result.error ? 'error' : result.formClass}`);
      return result;
    }),
    o.concurrency,
  );
  progress.finish('scoring complete');
  const scoredById = new Map(existingSuccessful);
  for (const row of newlyScored) scoredById.set(row.id, row);
  const scored = sample.map((item) => scoredById.get(item.id)).filter(Boolean);
  const h2 = computeH2(scored);
  const counts = formCounts(scored);
  printScoreReport(scored, h2, counts, critic);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        phase: 2,
        critic,
        cuts: { recon_hit: RECON_HIT_CUT, stated_insight_high: STATED_INSIGHT_HIGH_CUT },
        ordinal_order: FORM_ORDER,
        formCounts: counts,
        h2,
        qualityPolicy: {
          key: o.key ? path.relative(ROOT, o.key) : null,
          allowQualityWarnings: o.allowQualityWarnings,
          skipped,
        },
        blindScoringProtocol: BLIND_SCORING_PROTOCOL,
        scored,
      },
      null,
      2,
    ),
  );
  console.log(`\nResults written to ${path.relative(ROOT, outPath)}`);
}

async function main() {
  const o = parseArgs();
  if (o.gate) return mainGate(o);
  return mainScore(o);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

export {
  parseTurns,
  numberTranscript,
  buildPhase2Prompt,
  BLIND_SCORING_PROTOCOL,
  applyPhase2Gates,
  deriveForm,
  agree,
  computeH2,
  roleTexts,
  tutorTextAfterPivot,
};
