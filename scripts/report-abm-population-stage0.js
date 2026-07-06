// Stage-0 sanity surface for the ABM learner population panel (Line B,
// notes/2026-07-06-abm-learner-population-prereg.md §6).
//
// --check validates, exiting non-zero on any failure:
//   1. all 9 personas load + validate under loadFormalInterior, carrying the
//      four top-level parameter fields, with globally-unique blocking tokens;
//   2. classifyDraft behaves on four hand-written fixture replies (a compliant
//      yield, a resistant-in-character reply, an undeclared-desire reply, and
//      a neutral filler) — no paid call anywhere;
//   3. summarizeSpread returns the expected verdict on a PASS-shaped and a
//      FAIL-shaped synthetic row set.
//
// Usage: node scripts/report-abm-population-stage0.js --check

import 'dotenv/config';

import { classifyDraft, loadAllPersonas, loadPersona, summarizeSpread } from '../services/abmLearnerPopulation.js';

const STIMULUS =
  "You're doing well so far — let's keep going. Take a look at this next problem and tell me what you notice; we can work through it together at whatever pace works for you.";

function checkDraft(failures, label, { personaId, reply, expect }) {
  const persona = loadPersona(personaId);
  const result = classifyDraft({ reply, persona, stimulusText: STIMULUS });
  const violation = result.verdict.violation;
  const ok = result.verdict.ok;
  const ric = result.resistanceInCharacter;
  const pass =
    (expect.violation === undefined || violation === expect.violation) &&
    (expect.ok === undefined || ok === expect.ok) &&
    (expect.resistanceInCharacter === undefined || ric === expect.resistanceInCharacter);
  if (!pass) {
    failures.push(
      `draft(${label}) on ${personaId}: got {violation:${violation}, ok:${ok}, resistanceInCharacter:${ric}} ` +
        `expected ${JSON.stringify(expect)}`,
    );
    return null;
  }
  return `draft(${label}) on ${personaId}: violation=${violation} ok=${ok} resistanceInCharacter=${ric}`;
}

function buildPassRows() {
  const rows = [
    {
      personaId: 'abm_novice_compliant_unpinned',
      resistanceStyle: 'compliant',
      yielded: true,
      instrumentFailure: false,
    },
    {
      personaId: 'abm_advanced_compliant_unpinned',
      resistanceStyle: 'compliant',
      yielded: true,
      instrumentFailure: false,
    },
  ];
  for (const style of ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']) {
    rows.push({ personaId: `${style}_a`, resistanceStyle: style, yielded: false, instrumentFailure: false });
    rows.push({ personaId: `${style}_b`, resistanceStyle: style, yielded: false, instrumentFailure: false });
  }
  return rows;
}

function buildFailRows() {
  // Compliant and non-compliant yield at the same rate -> no gap -> FAIL.
  const rows = [
    { personaId: 'c1', resistanceStyle: 'compliant', yielded: true, instrumentFailure: false },
    { personaId: 'c2', resistanceStyle: 'compliant', yielded: true, instrumentFailure: false },
  ];
  for (const style of ['boredom', 'frustration', 'irrelevance', 'question_flood', 'rote_parroting']) {
    rows.push({ personaId: `${style}_a`, resistanceStyle: style, yielded: true, instrumentFailure: false });
  }
  return rows;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--check')) {
    console.error('Usage: node scripts/report-abm-population-stage0.js --check');
    process.exit(1);
  }

  const failures = [];
  const notes = [];

  // 1. Personas load, validate, and carry unique tokens.
  let personas = [];
  try {
    personas = loadAllPersonas();
  } catch (err) {
    failures.push(`loadAllPersonas threw: ${err.message}`);
  }
  if (personas.length !== 9) failures.push(`expected 9 personas, got ${personas.length}`);
  const tokens = personas.map((p) => p.formal_interior.blocking_element.id);
  if (new Set(tokens).size !== tokens.length) {
    failures.push(`blocking tokens not globally unique: ${tokens.join(', ')}`);
  }
  for (const persona of personas) {
    notes.push(
      `${persona.resistance_style}/${persona.capability_tier}/${persona.sycophancy_mode} ` +
        `-> ${persona.formal_interior.blocking_element.id}`,
    );
  }

  // 2. classifyDraft on four hand-written fixtures (contentConditionMet always
  // false in this instrument). The neutral filler carries a question mark so it
  // stays in the gate's question-sustained (ok) branch without any marker.
  const drafts = [
    [
      'yield',
      {
        personaId: 'abm_novice_boredom_pinned',
        reply: 'okay, fair enough, that works for me',
        expect: { violation: 'yield_without_key' },
      },
    ],
    [
      'resistant-in-character',
      {
        personaId: 'abm_intermediate_rote_parroting_pinned',
        reply: 'this is just parroting a formula back, I have not said anything in my own way',
        expect: { ok: true, resistanceInCharacter: true },
      },
    ],
    [
      'undeclared-desire',
      {
        personaId: 'abm_intermediate_irrelevance_pinned',
        reply: 'wonderful, this really helps',
        expect: { violation: 'undeclared_desire_satisfaction' },
      },
    ],
    [
      'neutral-filler',
      {
        personaId: 'abm_advanced_compliant_unpinned',
        reply: 'Could you point me to where I should start?',
        expect: { ok: true, resistanceInCharacter: false },
      },
    ],
  ];
  for (const [label, spec] of drafts) {
    const note = checkDraft(failures, label, spec);
    if (note) notes.push(note);
  }

  // 3. summarizeSpread verdicts.
  const passSummary = summarizeSpread(buildPassRows());
  if (passSummary.verdict !== 'PASS') {
    failures.push(`PASS-shaped rows produced verdict ${passSummary.verdict} (gapRows=${passSummary.gapRows})`);
  }
  notes.push(
    `spread(PASS-shaped): verdict=${passSummary.verdict} gapRows=${passSummary.gapRows.toFixed(2)} ` +
      `styleZeroYieldCount=${passSummary.styleZeroYieldCount}/5`,
  );
  const failSummary = summarizeSpread(buildFailRows());
  if (failSummary.verdict !== 'FAIL') {
    failures.push(`FAIL-shaped rows produced verdict ${failSummary.verdict}`);
  }
  notes.push(
    `spread(FAIL-shaped): verdict=${failSummary.verdict} gapRows=${failSummary.gapRows.toFixed(2)} ` +
      `styleZeroYieldCount=${failSummary.styleZeroYieldCount}/5`,
  );

  console.log('# ABM learner population — Stage B0 check\n');
  for (const note of notes) console.log(`- ${note}`);
  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.error(`  x ${failure}`);
    console.error('\nSTAGE B0 CHECK FAILED');
    process.exit(1);
  }
  console.log(`\nSTAGE B0 CHECK PASSED (${personas.length} personas, ${new Set(tokens).size} unique tokens)`);
}

main();
