// ABM learner population — Phase B1 panel manipulation check (Line B,
// notes/2026-07-06-abm-learner-population-prereg.md §3-§4).
//
// A single fixed, content-light tutor stimulus is sent to each of the 9
// curated personas (plus 3 repeat draws = 12 rows). No tutor generation, no
// ego/superego tutor loop, no adaptive policy — this measures learner-side
// behavior only. Every metric is deterministic (evaluateLearnerDraft +
// word-bounded / stemmed lexical checks); no judge in the decision path.
//
// pinned personas run the drift-gate reject-and-regenerate loop (exhaustion =
// instrument failure for that row). unpinned personas are drawn once and their
// single draft's classification is recorded directly, never regenerated.
//
// --check (Stage B0, no-paid): loads all 9 personas, prints the panel table.
// --live (Phase B1, PAID, requires a recorded go decision): draws the panel
//   and writes the spread summary. Refuses to run without --live.
// --live --dry-run: exercises the full loop shape against a stubbed learner
//   with zero paid calls and nothing written to the real cache.
//
// Usage: node scripts/run-abm-panel-check.js [--check | --live [--dry-run]]

import 'dotenv/config';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildDriftCorrectionContext,
  buildInteriorCharacterSheet,
  driftGateMaxAttempts,
} from '../services/learnerInteriorGate.js';
import { classifyDraft, loadPersona, summarizeSpread } from '../services/abmLearnerPopulation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROWS_PATH = path.join(ROOT, 'exports/abm-panel-check-rows.jsonl');
const OUT_JSON = path.join(ROOT, 'exports/abm-panel-check.json');
const OUT_MD = path.join(ROOT, 'exports/abm-panel-check.md');

// Frozen once (prereg §3.1) — the ONLY tutor input in B1, identical every row.
export const FROZEN_STIMULUS =
  "You're doing well so far — let's keep going. Take a look at this next problem and tell me what you notice; we can work through it together at whatever pace works for you.";

const LEARNER_MODEL = 'codex.gpt-5.5'; // frozen at the B1 go (prereg §3.2)

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

// Repeat draws (prereg §3.2): a baseline, a pinned resistant, an unpinned
// resistant — each drawn a second time for a minimal within-persona noise
// check (not a powered comparison). 9 + 3 = 12 rows.
const REPEAT_PERSONA_IDS = [
  'abm_novice_compliant_unpinned',
  'abm_novice_boredom_pinned',
  'abm_intermediate_question_flood_unpinned',
];

function buildDraws() {
  const draws = PERSONA_IDS.map((personaId) => ({ personaId, repeat: 1 }));
  for (const personaId of REPEAT_PERSONA_IDS) draws.push({ personaId, repeat: 2 });
  return draws;
}

function runCheck() {
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
  console.log('# ABM panel check — Stage B0 persona table\n');
  console.log('| Persona | Capability | Resistance | Sycophancy | Token |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const r of rows) {
    console.log(`| ${r.id} | ${r.capability_tier} | ${r.resistance_style} | ${r.sycophancy_mode} | ${r.token} |`);
  }
  const draws = buildDraws();
  console.log(`\n${rows.length} personas, ${draws.length} planned draws (9 + ${REPEAT_PERSONA_IDS.length} repeats).`);
  console.log('PANEL CHECK PASSED');
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
      tutorMessage: FROZEN_STIMULUS,
      topic: personaId,
      conversationHistory: [],
      learnerProfile: 'ego_superego',
      personaId: 'eager_novice', // generic engine-registry fallback; ABM character rides in profileContext
      modelOverride: LEARNER_MODEL,
      profileContext: correction ? `${characterSheet}\n\n${correction}` : characterSheet,
      llmCall: dryRun ? stubLlmCall : null,
    });
    message = response?.message || '';
    classification = classifyDraft({ reply: message, persona, stimulusText: FROZEN_STIMULUS });
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
  const summary = summarizeSpread(rows);
  const out = { dryRun, learnerModel: LEARNER_MODEL, rows: rows.length, ...summary };

  if (!dryRun) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
    const md = [
      '# ABM Learner Population — Phase B1 Panel Manipulation Check',
      '',
      `Learner: \`${LEARNER_MODEL}\` (ego_superego) · ${rows.length} rows · fixed neutral stimulus`,
      '',
      '| Persona | r | Yielded | ResistanceInChar | Engaged | Instrument failure |',
      '| --- | ---: | :---: | :---: | :---: | :---: |',
      ...rows.map(
        (r) =>
          `| ${r.personaId} | ${r.repeat} | ${r.yielded} | ${r.resistanceInCharacter} | ${r.engaged} | ${r.instrumentFailure} |`,
      ),
      '',
      `Compliant yield: **${summary.compliantYieldCount}/${summary.compliantRows}** · ` +
        `Non-compliant yield: **${summary.nonCompliantYieldCount}/${summary.nonCompliantRows}**`,
      `Gap: **${summary.gapRows.toFixed(2)} rows** (threshold ≥ ${summary.thresholds.gapRows}) · ` +
        `styles at zero yields: **${summary.styleZeroYieldCount}/${summary.stylesChecked}** (threshold ≥ ${summary.thresholds.styleZeroYieldCount})`,
      '',
      `## Verdict: **${summary.verdict}**`,
      '',
    ].join('\n');
    fs.writeFileSync(OUT_MD, md);
    console.log(`\n${md}`);
  } else {
    console.log(
      `\nDRY RUN summary: rows=${rows.length} compliantYield=${summary.compliantYieldCount}/${summary.compliantRows} ` +
        `nonCompliantYield=${summary.nonCompliantYieldCount}/${summary.nonCompliantRows} ` +
        `gapRows=${summary.gapRows.toFixed(2)} styleZeroYieldCount=${summary.styleZeroYieldCount}/${summary.stylesChecked} ` +
        `verdict=${summary.verdict}`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) return runCheck();
  if (!args.includes('--live')) {
    console.error('Phase B1 requires a recorded go decision. Use --check for the no-paid validation.');
    process.exit(1);
  }
  return runLive({ dryRun: args.includes('--dry-run') });
}

const isMain = process.argv[1] && process.argv[1].endsWith('run-abm-panel-check.js');
if (isMain) {
  main().catch((err) => {
    console.error(err.stack || String(err));
    process.exit(1);
  });
}
