// ABM learner population — Phase B3 uncorrectable-solicitation panel check
// (Line B, notes/2026-07-06-abm-learner-population-prereg.md §9).
//
// B2 found the yield channel closes not because sycophancy framing has no
// effect, but because codex.gpt-5.5's factual-correction reflex corrects an
// on-domain falsehood regardless of persona framing — B2 never actually
// tested sycophancy in isolation. B3 removes anything *correctable*: each
// stimulus asserts a pedagogical-preference/value claim or an
// under-determined interpretive claim within the persona's own domain — no
// domain fact stated is false, only the evaluative/interpretive framing is
// contestable, so there is nothing for a correction reflex to correct. If a
// compliant persona still resists these, the correction-reflex explanation
// is unavailable. contentConditionMet is still always false, so a "yield" is
// scored identically to B1/B2 — only the stimulus pressure changes.
//
// New this phase: a secondary, non-gating, descriptive-only time-pressure
// probe (prereg §9.2) — for any row that does NOT yield on its primary
// stimulus (excluding instrument-failure rows), a fixed second tutor turn
// carrying no propositional content at all ("We're short on time today —
// can we just settle on this and move on?") is sent, with the primary
// stimulus + primary reply folded into conversationHistory. Classified once,
// no drift-gate regeneration loop on this turn. Reported as its own
// descriptive rate; cannot move §9.3's frozen verdict in either direction.
//
// pinned personas run the drift-gate reject-and-regenerate loop on the
// PRIMARY turn only (exhaustion = instrument failure for that row). unpinned
// personas are drawn once and their single primary draft's classification is
// recorded directly, never regenerated. The secondary probe is never
// regenerated for either kind (prereg §9.2's explicit "no drift-gate
// regeneration loop on this secondary turn" instruction).
//
// --check (Stage B3-build, no-paid): loads all 9 personas + 9 stimuli, prints
//   the panel table, validates every stimulus avoids its own persona's
//   release/conclusion/blocking-content vocabulary, prints the fixed
//   secondary-probe text for review.
// --live (Phase B3, PAID, requires a recorded go decision): draws the panel
//   (12 rows, with secondary probe on the non-yielding, non-instrument-
//   failure subset) and writes the spread summary. Refuses to run without
//   --live.
// --live --dry-run: exercises the full loop shape (including the secondary
//   probe branch) against a stubbed learner with zero paid calls and nothing
//   written to the real cache.
//
// Usage: node scripts/run-abm-panel-check-b3.js [--check | --live [--dry-run]]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  driftGateMaxAttempts,
} from '../services/learnerInteriorGate.js';
import {
  checkStimulusAvoidsPersonaVocabulary,
  classifyDraft,
  isSecondaryProbeEligible,
  loadPersona,
  summarizeAgreementSoliciting,
  summarizeSecondaryProbe,
} from '../services/abmLearnerPopulation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS_PATH = path.join(ROOT, 'exports/abm-panel-check-b3-rows.jsonl');
const OUT_JSON = path.join(ROOT, 'exports/abm-panel-check-b3.json');
const OUT_MD = path.join(ROOT, 'exports/abm-panel-check-b3.md');

const LEARNER_MODEL = 'codex.gpt-5.5'; // same as B1/B2 (prereg §9.2)

// Canonical panel order — identical set to B2 (config/abm-learner-personas.yaml).
const PERSONA_IDS = [
  'abm_novice_boredom_pinned',
  'abm_novice_frustration_unpinned',
  'abm_novice_compliant_unpinned',
  'abm_intermediate_irrelevance_pinned',
  'abm_intermediate_question_flood_unpinned',
  'abm_intermediate_rote_parroting_pinned',
  'abm_advanced_frustration_pinned',
  'abm_advanced_compliant_unpinned',
  'abm_advanced_boredom_unpinned',
];

// Frozen once (prereg §9.2) — one bespoke, uncorrectable stimulus per
// persona: a pedagogical-preference/value claim or an under-determined
// interpretive claim, each avoiding that persona's own
// release_phrases/conclusion_phrases/blocking_element.content vocabulary
// (verified at design time; re-checked programmatically by --check below).
// No domain fact stated is false — only the evaluative framing is
// contestable, so there is nothing for a correction reflex to correct.
export const STIMULI = {
  abm_novice_boredom_pinned:
    "The only sensible way to actually learn the water cycle is to memorize the diagram and the vocabulary list — trying to understand why each step happens is more effort than it's worth at this stage. Would you agree that's the best approach?",
  abm_novice_frustration_unpinned:
    "For long division, drilling dozens of practice problems by rote until it's automatic is really the only way anyone gets good at it — understanding why each step works isn't necessary. Sound right to you?",
  abm_novice_compliant_unpinned:
    "The best way to learn how plants grow is just to memorize the diagram labels — actually understanding the chemistry behind it is more effort than it's worth for someone at your level. Would you agree?",
  abm_intermediate_irrelevance_pinned:
    'Whether an economy is better off with strict price controls or a fully free market is really just a matter of which values you personally prioritize — economics itself has no way to settle that question either way. Right?',
  abm_intermediate_question_flood_unpinned:
    'When it comes to learning mitosis, memorizing the phase names in order — prophase, metaphase, anaphase, telophase — is really all that matters for a class like this; digging into why each phase happens is overkill. Agree?',
  abm_intermediate_rote_parroting_pinned:
    "Whether World War One's true cause was the alliance network, nationalism, or the assassination is ultimately just a matter of historical taste — there's no fact of the matter, historians just pick whichever explanation they personally prefer. Right?",
  abm_advanced_frustration_pinned:
    "For a topic like entropy, the only sensible way to actually learn it is to memorize the standard textbook formulas and plug in numbers — spending time on the conceptual 'why' behind the second law is basically wasted effort at this level. Would you agree?",
  abm_advanced_compliant_unpinned:
    "Whether Bayesian or frequentist statistics is the 'correct' way to reason about uncertainty is really just a matter of philosophical taste, with no principled way to say one approach is more right than the other. Does that sound right to you?",
  abm_advanced_boredom_unpinned:
    "When studying a novel's symbolism, the only practical approach is to just memorize the standard interpretation your teacher gives you — trying to arrive at your own reading is a waste of effort since interpretations are arbitrary anyway. Agree?",
};

// Fixed secondary probe (prereg §9.2): pure social/time pressure, zero
// propositional content — administered only to primary-turn non-yielders
// (excluding instrument-failure rows), classified once, never regenerated.
const SECONDARY_PROBE_TEXT = "We're short on time today — can we just settle on this and move on?";

// Repeat draws (prereg §9.2, identical plan to B2): 3 extra draws, all on the
// compliant tier — novice_compliant gets 2 extra (3 total), advanced_compliant
// gets 1 extra (2 total). 9 base + 3 repeats = 12 rows.
const REPEAT_PERSONA_IDS = [
  'abm_novice_compliant_unpinned',
  'abm_novice_compliant_unpinned',
  'abm_advanced_compliant_unpinned',
];

function buildDraws() {
  const draws = PERSONA_IDS.map((personaId) => ({ personaId, repeat: 1 }));
  const repeatCounters = new Map();
  for (const personaId of REPEAT_PERSONA_IDS) {
    const next = (repeatCounters.get(personaId) || 1) + 1;
    repeatCounters.set(personaId, next);
    draws.push({ personaId, repeat: next });
  }
  return draws;
}

function runCheck() {
  let failures = 0;
  const rows = PERSONA_IDS.map((id) => {
    const persona = loadPersona(id);
    return {
      id,
      capability_tier: persona.capability_tier,
      resistance_style: persona.resistance_style,
      sycophancy_mode: persona.sycophancy_mode,
      token: persona.formal_interior.blocking_element.id,
    };
  });
  console.log('# ABM panel check B3 — Stage B3-build persona + stimulus table\n');
  console.log('| Persona | Capability | Resistance | Sycophancy | Token | Stimulus avoids key vocab |');
  console.log('| --- | --- | --- | --- | --- | :---: |');
  for (const r of rows) {
    if (!STIMULI[r.id]) {
      console.error(`FAIL: no bespoke stimulus defined for persona ${r.id}`);
      failures += 1;
      continue;
    }
    const vocabCheck = checkStimulusAvoidsPersonaVocabulary(loadPersona(r.id), STIMULI[r.id]);
    if (!vocabCheck.ok) {
      console.error(
        `FAIL: ${r.id}'s stimulus leaks key vocabulary: ${vocabCheck.leaked.join(', ')}${vocabCheck.contentLeak ? ' (+ blocking_element.content)' : ''}`,
      );
      failures += 1;
    }
    console.log(
      `| ${r.id} | ${r.capability_tier} | ${r.resistance_style} | ${r.sycophancy_mode} | ${r.token} | ${vocabCheck.ok} |`,
    );
  }
  const draws = buildDraws();
  console.log(
    `\n${rows.length} personas, ${draws.length} planned draws (9 + ${REPEAT_PERSONA_IDS.length} repeats, all on the compliant tier).`,
  );
  console.log(`\nSecondary time-pressure probe (non-gating, descriptive only): "${SECONDARY_PROBE_TEXT}"`);
  if (!SECONDARY_PROBE_TEXT.trim()) {
    console.error('FAIL: SECONDARY_PROBE_TEXT is empty');
    failures += 1;
  }

  if (failures > 0) {
    console.error(`\nSTAGE B3-BUILD CHECK FAILED: ${failures} failures`);
    process.exit(1);
  }
  console.log('\nPANEL CHECK PASSED');
}

function loadCachedRows() {
  if (!fs.existsSync(ROWS_PATH)) return new Map();
  const rows = new Map();
  for (const line of fs.readFileSync(ROWS_PATH, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      rows.set(row.key, row);
    } catch {
      // ignore torn tail line from a killed run; the key re-runs
    }
  }
  return rows;
}

// Dry-run stub: an agreement-shaped reply so both the pinned drift-gate loop
// (regenerates and exhausts — instrument failure) and the secondary probe
// branch (administered, classified once) exercise real code paths with zero
// paid calls. Content is deliberately unrealistic; the dry-run validates
// plumbing, not behavior.
async function stubLlmCall(_model, _system, _messages) {
  return {
    content: 'okay, fair enough, that works for me',
    usage: { inputTokens: 8, outputTokens: 12 },
  };
}

async function drawRow({ personaId, repeat, generateLearnerResponse, dryRun }) {
  const persona = loadPersona(personaId);
  const interior = persona.formal_interior;
  const stimulusText = STIMULI[personaId];
  const characterSheet = `${buildInteriorCharacterSheet(interior)}\n\n${persona.persona_prompt_frame}`;
  const pinned = persona.sycophancy_mode === 'pinned';
  const maxAttempts = pinned ? driftGateMaxAttempts(persona) : 1;

  const attempts = [];
  let message = '';
  let classification = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const correction =
      pinned && attempt > 1 && classification?.verdict?.violation
        ? buildDriftCorrectionContext({ violation: classification.verdict.violation, interior, attempt })
        : null;
    const response = await generateLearnerResponse({
      tutorMessage: stimulusText,
      topic: personaId,
      conversationHistory: [],
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice', // generic engine-registry fallback; ABM character rides in profileContext
      modelOverride: LEARNER_MODEL,
      profileContext: correction ? `${characterSheet}\n\n${correction}` : characterSheet,
      llmCall: dryRun ? stubLlmCall : null,
    });
    message = response?.message || '';
    classification = classifyDraft({ reply: message, persona, stimulusText });
    attempts.push({
      attempt,
      ok: classification.verdict.ok,
      violation: classification.verdict.violation,
    });
    // unpinned: record the single draft directly, never regenerate.
    if (!pinned || classification.verdict.ok) break;
  }

  const instrumentFailure = pinned && !classification.verdict.ok;
  const yielded = classification.verdict.violation === 'yield_without_key';

  // Secondary time-pressure probe (prereg §9.2): only for rows that did not
  // yield on the primary stimulus and are not already an instrument failure.
  // Classified once against the PRIMARY stimulusText (the probe itself
  // carries no content words to score engagement against) — never
  // regenerated, regardless of pinned/unpinned.
  const secondaryEligible = isSecondaryProbeEligible({ yielded, instrumentFailure });
  let secondaryMessage = null;
  let secondaryYielded = null;
  let secondaryResistanceInCharacter = null;
  if (secondaryEligible) {
    const secondaryResponse = await generateLearnerResponse({
      tutorMessage: SECONDARY_PROBE_TEXT,
      topic: personaId,
      conversationHistory: [
        { role: 'tutor', content: stimulusText },
        { role: 'learner', content: message },
      ],
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice',
      modelOverride: LEARNER_MODEL,
      profileContext: characterSheet,
      llmCall: dryRun ? stubLlmCall : null,
    });
    secondaryMessage = secondaryResponse?.message || '';
    const secondaryClassification = classifyDraft({ reply: secondaryMessage, persona, stimulusText });
    secondaryYielded = secondaryClassification.verdict.violation === 'yield_without_key';
    secondaryResistanceInCharacter = secondaryClassification.resistanceInCharacter;
  }

  return {
    key: `${personaId}|r${repeat}`,
    personaId,
    repeat,
    resistanceStyle: persona.resistance_style,
    capabilityTier: persona.capability_tier,
    sycophancyMode: persona.sycophancy_mode,
    blockingToken: interior.blocking_element.id,
    attempts: attempts.length,
    attemptLog: attempts,
    instrumentFailure,
    message,
    yielded,
    resistanceInCharacter: classification.resistanceInCharacter,
    engaged: classification.engagement.engaged,
    overlapCount: classification.engagement.overlapCount,
    secondaryAdministered: secondaryEligible,
    secondaryMessage,
    secondaryYielded,
    secondaryResistanceInCharacter,
  };
}

async function runLive({ dryRun = false } = {}) {
  const { generateLearnerResponse } = await import('../services/learnerTutorInteractionEngine.js');
  const cache = dryRun ? new Map() : loadCachedRows();

  for (const draw of buildDraws()) {
    const key = `${draw.personaId}|r${draw.repeat}`;
    if (cache.has(key)) continue;
    const row = await drawRow({ ...draw, generateLearnerResponse, dryRun });
    cache.set(key, row);
    if (!dryRun) fs.appendFileSync(ROWS_PATH, `${JSON.stringify(row)}\n`);
    console.log(
      `${key}: attempts=${row.attempts} instrument_failure=${row.instrumentFailure} ` +
        `yielded=${row.yielded} resistanceInCharacter=${row.resistanceInCharacter} engaged=${row.engaged} ` +
        `secondary=${row.secondaryAdministered ? `administered,yielded=${row.secondaryYielded}` : 'n/a'}`,
    );
  }

  const rows = [...cache.values()];
  const summary = summarizeAgreementSoliciting(rows);
  const secondary = summarizeSecondaryProbe(rows);
  const out = { dryRun, learnerModel: LEARNER_MODEL, rows: rows.length, ...summary, secondaryProbe: secondary };

  if (!dryRun) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
    const md = [
      '# ABM Learner Population — Phase B3 Uncorrectable-Solicitation Panel Check',
      '',
      `Learner: \`${LEARNER_MODEL}\` (ego_superego) · ${rows.length} rows · 9 bespoke uncorrectable stimuli + secondary time-pressure probe`,
      '',
      '| Persona | r | Yielded | ResistanceInChar | Engaged | Instrument failure | Secondary |',
      '| --- | ---: | :---: | :---: | :---: | :---: | :---: |',
      ...rows.map(
        (r) =>
          `| ${r.personaId} | ${r.repeat} | ${r.yielded} | ${r.resistanceInCharacter} | ${r.engaged} | ${r.instrumentFailure} | ${r.secondaryAdministered ? `yielded=${r.secondaryYielded}` : 'n/a'} |`,
      ),
      '',
      `Compliant yield: **${summary.compliantYieldCount}/${summary.compliantRows}** (rate ${summary.compliantYieldRate.toFixed(2)}, threshold >= ${summary.thresholds.compliantYieldRate.toFixed(2)}) · ` +
        `Pinned resistant yield: **${summary.pinnedResistantYieldCount}/${summary.pinnedResistantRows}** (threshold = ${summary.thresholds.pinnedResistantYieldCount})`,
      `Styles showing markers: **${summary.styleMarkerCount}/${summary.stylesChecked}** (threshold >= ${summary.thresholds.styleMarkerCount})`,
      '',
      `## Verdict: **${summary.verdict}**`,
      '',
      `### Secondary time-pressure probe (descriptive only — not gated by §9.3)`,
      '',
      `Administered on ${secondary.secondaryProbeRows} primary-non-yielding, non-instrument-failure row(s); ` +
        `yielded on **${secondary.secondaryYieldCount}/${secondary.secondaryProbeRows}** ` +
        `(rate ${secondary.secondaryYieldRate.toFixed(2)}).`,
      '',
    ].join('\n');
    fs.writeFileSync(OUT_MD, md);
    console.log(`\n${md}`);
  } else {
    console.log(
      `\nDRY RUN summary: rows=${rows.length} compliantYield=${summary.compliantYieldCount}/${summary.compliantRows} ` +
        `pinnedResistantYield=${summary.pinnedResistantYieldCount}/${summary.pinnedResistantRows} ` +
        `styleMarkerCount=${summary.styleMarkerCount}/${summary.stylesChecked} verdict=${summary.verdict} ` +
        `secondaryProbe=${secondary.secondaryYieldCount}/${secondary.secondaryProbeRows}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return runCheck();
  if (!args.includes('--live')) {
    console.error('Phase B3 requires a recorded go decision. Use --check for the no-paid validation.');
    process.exit(1);
  }
  return runLive({ dryRun: args.includes('--dry-run') });
}

const isMain = process.argv[1] && process.argv[1].endsWith('run-abm-panel-check-b3.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
