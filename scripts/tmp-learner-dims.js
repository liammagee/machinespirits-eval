import Database from 'better-sqlite3';
const db = new Database('/Users/lmagee/Dev/machinespirits-eval/data/evaluations.db', { readonly: true });

// A4: Authentic vs Standard superego
const rows = db.prepare(`
  SELECT
    CASE WHEN profile_name LIKE '%authentic%' THEN 'authentic' ELSE 'standard' END as superego_type,
    CASE WHEN profile_name LIKE '%recog%' THEN 'recog' ELSE 'base' END as recog,
    learner_scores,
    learner_overall_score
  FROM evaluation_results
  WHERE run_id IN (
    'eval-2026-02-20-0fbca69e', 'eval-2026-02-19-dbcd6543',
    'eval-2026-02-20-058c7a0e', 'eval-2026-02-20-90703a6a'
  )
  AND learner_overall_score IS NOT NULL
  AND profile_name LIKE '%selfreflect%'
`).all();

const dims = {};
for (const row of rows) {
  const key = `${row.superego_type}|${row.recog}`;
  const scores = JSON.parse(row.learner_scores);
  if (!dims[key]) dims[key] = { n: 0, authenticity: 0, question: 0, conceptual: 0, revision: 0, deliberation: 0, persona: 0, overall: 0, dialogues: 0 };
  dims[key].dialogues++;
  for (const turnKey of Object.keys(scores)) {
    const s = scores[turnKey].scores;
    if (s.learner_authenticity && s.learner_authenticity.score > 0) {
      dims[key].authenticity += s.learner_authenticity.score;
      dims[key].question += s.question_quality.score;
      dims[key].conceptual += s.conceptual_engagement.score;
      dims[key].revision += s.revision_signals.score;
      dims[key].deliberation += s.deliberation_depth.score;
      dims[key].persona += s.persona_consistency.score;
      dims[key].n++;
    }
  }
  dims[key].overall += row.learner_overall_score;
}

console.log('\n=== A4: Authentic vs Standard Learner Superego (self-reflect cells only) ===');
console.log('type        | recog | N_dial | N_turns | auth | quest | concept | revis | delib | persona | overall');
console.log('------------|-------|--------|---------|------|-------|---------|-------|-------|---------|--------');
for (const [key, d] of Object.entries(dims).sort()) {
  const [type, recog] = key.split('|');
  const n = d.n;
  console.log(
    `${type.padEnd(12)}| ${recog.padEnd(6)}| ${String(d.dialogues).padStart(6)} | ${String(n).padStart(7)} | ${(d.authenticity/n).toFixed(1).padStart(4)} | ${(d.question/n).toFixed(1).padStart(5)} | ${(d.conceptual/n).toFixed(1).padStart(7)} | ${(d.revision/n).toFixed(1).padStart(5)} | ${(d.deliberation/n).toFixed(1).padStart(5)} | ${(d.persona/n).toFixed(1).padStart(7)} | ${(d.overall/d.dialogues).toFixed(1).padStart(6)}`
  );
}

// Full mechanism matrix: learner dimension breakdown
console.log('\n\n=== Full Mechanism Matrix: Learner Dimension Scores (clean runs only) ===');
const mechRows = db.prepare(`
  SELECT
    CASE 
      WHEN profile_name LIKE '%selfreflect%' AND profile_name NOT LIKE '%authentic%' THEN 'self-reflect'
      WHEN profile_name LIKE '%bidirectional%' THEN 'bidirectional'
      WHEN profile_name LIKE '%intersubjective%' THEN 'intersubjective'
      WHEN profile_name LIKE '%combined%' THEN 'combined'
      WHEN profile_name LIKE '%quantitative%' THEN 'quantitative'
      WHEN profile_name LIKE '%erosion%' THEN 'erosion'
      WHEN profile_name LIKE '%profile_tutor%' THEN 'tutor-profiling'
      WHEN profile_name LIKE '%authentic%' THEN 'authentic'
      ELSE 'unknown'
    END as mechanism,
    CASE WHEN profile_name LIKE '%recog%' THEN 'recog' ELSE 'base' END as recog,
    learner_scores,
    learner_overall_score
  FROM evaluation_results
  WHERE run_id IN (
    'eval-2026-02-20-0fbca69e', 'eval-2026-02-20-117710c0',
    'eval-2026-02-19-03dd8434', 'eval-2026-02-19-dbcd6543',
    'eval-2026-02-20-058c7a0e', 'eval-2026-02-20-57ba525c',
    'eval-2026-02-20-90703a6a'
  )
  AND learner_overall_score IS NOT NULL
  AND profile_name != ''
`).all();

const mechDims = {};
for (const row of mechRows) {
  const key = `${row.mechanism}|${row.recog}`;
  const scores = JSON.parse(row.learner_scores);
  if (!mechDims[key]) mechDims[key] = { n: 0, authenticity: 0, question: 0, conceptual: 0, revision: 0, deliberation: 0, persona: 0, overall: 0, dialogues: 0 };
  mechDims[key].dialogues++;
  for (const turnKey of Object.keys(scores)) {
    const s = scores[turnKey].scores;
    if (s.learner_authenticity && s.learner_authenticity.score > 0) {
      mechDims[key].authenticity += s.learner_authenticity.score;
      mechDims[key].question += s.question_quality.score;
      mechDims[key].conceptual += s.conceptual_engagement.score;
      mechDims[key].revision += s.revision_signals.score;
      mechDims[key].deliberation += s.deliberation_depth.score;
      mechDims[key].persona += s.persona_consistency.score;
      mechDims[key].n++;
    }
  }
  mechDims[key].overall += row.learner_overall_score;
}

console.log('mechanism       | recog | N_dial | N_turns | auth | quest | concept | revis | delib | persona | overall');
console.log('----------------|-------|--------|---------|------|-------|---------|-------|-------|---------|--------');
for (const [key, d] of Object.entries(mechDims).sort()) {
  const [mech, recog] = key.split('|');
  if (mech === 'unknown') continue;
  const n = d.n;
  if (n === 0) continue;
  console.log(
    `${mech.padEnd(16)}| ${recog.padEnd(6)}| ${String(d.dialogues).padStart(6)} | ${String(n).padStart(7)} | ${(d.authenticity/n).toFixed(1).padStart(4)} | ${(d.question/n).toFixed(1).padStart(5)} | ${(d.conceptual/n).toFixed(1).padStart(7)} | ${(d.revision/n).toFixed(1).padStart(5)} | ${(d.deliberation/n).toFixed(1).padStart(5)} | ${(d.persona/n).toFixed(1).padStart(7)} | ${(d.overall/d.dialogues).toFixed(1).padStart(6)}`
  );
}

db.close();
