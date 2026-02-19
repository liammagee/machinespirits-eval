import fs from 'fs';
import Database from 'better-sqlite3';
const db = new Database('data/evaluations.db');

const runId = process.argv[2] || 'eval-2026-02-17-25aaae85';
const rows = db.prepare(
  'SELECT dialogue_id, profile_name, overall_score FROM evaluation_results WHERE run_id = ? AND dialogue_id IS NOT NULL AND overall_score IS NOT NULL'
).all(runId);

let totalReviews = 0;
let parseFailures = 0;
let approved = 0;
let rejected = 0;
const byCell = {};

rows.forEach(r => {
  const cell = r.profile_name.includes('66') ? '66_desc' : r.profile_name.includes('67') ? '67_presc' : '68_adv';
  if (!byCell[cell]) byCell[cell] = { total: 0, parseFail: 0, approved: 0, rejected: 0, dialogues: 0 };
  byCell[cell].dialogues++;

  try {
    const j = JSON.parse(fs.readFileSync('logs/tutor-dialogues/' + r.dialogue_id + '.json', 'utf8'));
    const supTraces = (j.dialogueTrace || []).filter(t => t.agent === 'superego');
    supTraces.forEach(t => {
      totalReviews++;
      byCell[cell].total++;
      if ((t.feedback || '').includes('Unable to parse')) {
        parseFailures++;
        byCell[cell].parseFail++;
      } else if (t.approved) {
        approved++;
        byCell[cell].approved++;
      } else {
        rejected++;
        byCell[cell].rejected++;
      }
    });
  } catch (e) { /* missing dialogue file */ }
});

console.log('=== Superego Parse Failures: ' + runId + ' ===\n');
console.log('Total superego reviews:', totalReviews);
console.log('Parse failures (auto-approve):', parseFailures, '(' + (parseFailures / totalReviews * 100).toFixed(1) + '%)');
console.log('Genuine approvals:', approved, '(' + (approved / totalReviews * 100).toFixed(1) + '%)');
console.log('Rejections:', rejected, '(' + (rejected / totalReviews * 100).toFixed(1) + '%)');

console.log('\n--- By cell ---\n');
console.log('Cell'.padEnd(12) + '| Dialogues | Reviews | Parse Fail | Approved | Rejected | Fail Rate');
console.log('-'.repeat(80));
Object.entries(byCell).sort().forEach(([cell, d]) => {
  console.log(
    cell.padEnd(12) + '| ' +
    String(d.dialogues).padEnd(10) + '| ' +
    String(d.total).padEnd(8) + '| ' +
    String(d.parseFail).padEnd(11) + '| ' +
    String(d.approved).padEnd(9) + '| ' +
    String(d.rejected).padEnd(9) + '| ' +
    (d.parseFail / d.total * 100).toFixed(1) + '%'
  );
});

// Correlation: parse failure rate vs score
console.log('\n--- Parse failure rate vs mean score ---\n');
Object.entries(byCell).sort().forEach(([cell, d]) => {
  const cellRows = rows.filter(r => {
    const c = r.profile_name.includes('66') ? '66_desc' : r.profile_name.includes('67') ? '67_presc' : '68_adv';
    return c === cell;
  });
  const meanScore = cellRows.reduce((s, r) => s + r.overall_score, 0) / cellRows.length;
  console.log(cell + ': fail_rate=' + (d.parseFail / d.total * 100).toFixed(1) + '%, mean_score=' + meanScore.toFixed(1));
});

db.close();
