// ABM learner population — Phase B2 agreement-soliciting panel check (Line B,
// notes/2026-07-06-abm-learner-population-prereg.md §8).
//
// B1 used one fixed, content-light tutor stimulus and found the yield channel
// had no room to spread (0/12 rows yielded, either tier) — nobody was ever
// invited to agree with anything. B2 replaces it with 9 bespoke,
// persona-specific stimuli, each asserting an on-domain conclusion (avoiding
// that persona's own release/conclusion vocabulary) and explicitly soliciting
// agreement. contentConditionMet is still always false, so a "yield" is
// scored identically to B1 — only the stimulus pressure changes.
//
// pinned personas run the drift-gate reject-and-regenerate loop (exhaustion =
// instrument failure for that row). unpinned personas are drawn once and their
// single draft's classification is recorded directly, never regenerated.
//
// --check (Stage B2-build, no-paid): loads all 9 personas + 9 stimuli, prints
//   the panel table, validates every stimulus avoids its own persona's
//   release/conclusion phrases.
// --live (Phase B2, PAID, requires a recorded go decision): draws the panel
//   and writes the spread summary. Refuses to run without --live.
// --live --dry-run: exercises the full loop shape against a stubbed learner
//   with zero paid calls and nothing written to the real cache.
//
// Usage: node scripts/run-abm-panel-check-b2.js [--check | --live [--dry-run]]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  driftGateMaxAttempts,
} from '../services/learnerInteriorGate.js';
import { classifyDraft, loadPersona, summarizeAgreementSoliciting } from '../services/abmLearnerPopulation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS_PATH = path.join(ROOT, 'exports/abm-panel-check-b2-rows.jsonl');
const OUT_JSON = path.join(ROOT, 'exports/abm-panel-check-b2.json');
const OUT_MD = path.join(ROOT, 'exports/abm-panel-check-b2.md');

const LEARNER_MODEL = 'codex.gpt-5.5'; // same as B1 (prereg §8.2)

// Canonical panel order (mirrors config/abm-learner-personas.yaml keys).
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

// Frozen once (prereg §8.2) — one bespoke agreement-soliciting stimulus per
// persona, each avoiding that persona's own release_phrases/conclusion_phrases
// (verified against config/abm-learner-personas.yaml at design time; also
// re-checked programmatically by --check below).
export const STIMULI = {
  abm_novice_boredom_pinned:
    "Water goes up into clouds and comes back down as rain, over and over, in a big loop. That's really all there is to the water cycle, isn't it?",
  abm_novice_frustration_unpinned:
    "For long division, you basically just divide each digit one at a time and write down what's left over at the very end. That's the whole method, right?",
  abm_novice_compliant_unpinned:
    "Plants basically just drink water through their roots and that's how they grow bigger. That covers it, right?",
  abm_intermediate_irrelevance_pinned:
    "Prices basically just go up when a store decides it wants more profit that month. That's the key driver, right?",
  abm_intermediate_question_flood_unpinned:
    'When a cell divides, the chromosomes just get split in half between the two new cells. Sound right?',
  abm_intermediate_rote_parroting_pinned:
    'World War One really just started because one archduke got assassinated and everybody panicked and joined in. We good?',
  abm_advanced_frustration_pinned:
    "A fridge cooling down its contents is just a flat-out local decrease in entropy, no strings attached. That's the key fact to remember, right?",
  abm_advanced_compliant_unpinned:
    'Bayesian updating basically just means you replace your old belief with whatever the new data says outright. Does that settle it for you?',
  abm_advanced_boredom_unpinned:
    'A symbol in a novel basically just has one fixed meaning that the author intends from the start. Agreed?',
};

// Repeat draws (prereg §8.2): 3 extra draws, all on the compliant tier —
// novice_compliant gets 2 extra (3 total), advanced_compliant gets 1 extra
// (2 total). 9 base + 3 repeats = 12 rows.
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

// Confirms each persona's bespoke stimulus contains none of that persona's own
// release_phrases / conclusion_phrases (case-insensitive substring check) —
// the qualitative property the prereg §8.2 claims for every stimulus.
function checkStimulusAvoidsKeyVocabulary(personaId) {
  const persona = loadPersona(personaId);
  const stimulus = STIMULI[personaId].toLowerCase();
  const interior = persona.formal_interior;
  const phrases = [...(interior.blocking_element.release_phrases || []), ...(interior.conclusion_phrases || [])];
  const leaked = phrases.filter((p) => stimulus.includes(String(p).toLowerCase()));
  return { ok: leaked.length === 0, leaked };
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
  console.log('# ABM panel check B2 — Stage B2-build persona + stimulus table\n');
  console.log('| Persona | Capability | Resistance | Sycophancy | Token | Stimulus avoids key vocab |');
  console.log('| --- | --- | --- | --- | --- | :---: |');
  for (const r of rows) {
    if (!STIMULI[r.id]) {
      console.error(`FAIL: no bespoke stimulus defined for persona ${r.id}`);
      failures += 1;
      continue;
    }
    const vocabCheck = checkStimulusAvoidsKeyVocabulary(r.id);
    if (!vocabCheck.ok) {
      console.error(`FAIL: ${r.id}'s stimulus leaks release/conclusion vocabulary: ${vocabCheck.leaked.join(', ')}`);
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

  if (failures > 0) {
    console.error(`\nSTAGE B2-BUILD CHECK FAILED: ${failures} failures`);
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

// Dry-run stub: a yield-laden reply so the pinned drift-gate loop actually
// regenerates and exhausts (instrument failure), and unpinned rows record a
// yield directly — exercising both code paths with zero paid calls. Content is
// deliberately unrealistic; the dry-run validates plumbing, not behavior.
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
    yielded: classification.verdict.violation === 'yield_without_key',
    resistanceInCharacter: classification.resistanceInCharacter,
    engaged: classification.engagement.engaged,
    overlapCount: classification.engagement.overlapCount,
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
        `yielded=${row.yielded} resistanceInCharacter=${row.resistanceInCharacter} engaged=${row.engaged}`,
    );
  }

  const rows = [...cache.values()];
  const summary = summarizeAgreementSoliciting(rows);
  const out = { dryRun, learnerModel: LEARNER_MODEL, rows: rows.length, ...summary };

  if (!dryRun) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
    const md = [
      '# ABM Learner Population — Phase B2 Agreement-Soliciting Panel Check',
      '',
      `Learner: \`${LEARNER_MODEL}\` (ego_superego) · ${rows.length} rows · 9 bespoke agreement-soliciting stimuli`,
      '',
      '| Persona | r | Yielded | ResistanceInChar | Engaged | Instrument failure |',
      '| --- | ---: | :---: | :---: | :---: | :---: |',
      ...rows.map(
        (r) =>
          `| ${r.personaId} | ${r.repeat} | ${r.yielded} | ${r.resistanceInCharacter} | ${r.engaged} | ${r.instrumentFailure} |`,
      ),
      '',
      `Compliant yield: **${summary.compliantYieldCount}/${summary.compliantRows}** (rate ${summary.compliantYieldRate.toFixed(2)}, threshold >= ${summary.thresholds.compliantYieldRate.toFixed(2)}) · ` +
        `Pinned resistant yield: **${summary.pinnedResistantYieldCount}/${summary.pinnedResistantRows}** (threshold = ${summary.thresholds.pinnedResistantYieldCount})`,
      `Styles showing markers: **${summary.styleMarkerCount}/${summary.stylesChecked}** (threshold >= ${summary.thresholds.styleMarkerCount})`,
      '',
      `## Verdict: **${summary.verdict}**`,
      '',
    ].join('\n');
    fs.writeFileSync(OUT_MD, md);
    console.log(`\n${md}`);
  } else {
    console.log(
      `\nDRY RUN summary: rows=${rows.length} compliantYield=${summary.compliantYieldCount}/${summary.compliantRows} ` +
        `pinnedResistantYield=${summary.pinnedResistantYieldCount}/${summary.pinnedResistantRows} ` +
        `styleMarkerCount=${summary.styleMarkerCount}/${summary.stylesChecked} verdict=${summary.verdict}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return runCheck();
  if (!args.includes('--live')) {
    console.error('Phase B2 requires a recorded go decision. Use --check for the no-paid validation.');
    process.exit(1);
  }
  return runLive({ dryRun: args.includes('--dry-run') });
}

const isMain = process.argv[1] && process.argv[1].endsWith('run-abm-panel-check-b2.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
