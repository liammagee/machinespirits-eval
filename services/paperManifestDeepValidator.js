const WORD_TO_NUM = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-one': 21,
  'twenty-two': 22,
  'twenty-three': 23,
  'twenty-four': 24,
  'twenty-five': 25,
  'twenty-six': 26,
  'twenty-seven': 27,
  'twenty-eight': 28,
  'twenty-nine': 29,
  thirty: 30,
  'thirty-one': 31,
  'thirty-two': 32,
  'thirty-three': 33,
  'thirty-four': 34,
  'thirty-five': 35,
  'thirty-six': 36,
  'thirty-seven': 37,
  'thirty-eight': 38,
  'thirty-nine': 39,
  forty: 40,
};

function numToWord(number) {
  return Object.entries(WORD_TO_NUM).find(([, value]) => value === number)?.[0];
}

export function splitPaper(paper) {
  const appendixEMatch = paper.match(/^## Appendix E/m);
  if (!appendixEMatch) return { body: paper, revisionHistory: '' };

  const index = paper.indexOf(appendixEMatch[0]);
  return { body: paper.slice(0, index), revisionHistory: paper.slice(index) };
}

function validateTable2(paper, manifest, report) {
  report.subheading('Pass A: Table 2 Structure');
  const lines = paper.split('\n');
  const headerIndex = lines.findIndex((line) => /^\*\*Table 2:/.test(line.trim()));
  if (headerIndex === -1) {
    report.fail('Table 2 header not found');
    return;
  }

  let tableStart = -1;
  for (let index = headerIndex; index < Math.min(headerIndex + 5, lines.length); index++) {
    if (/^\|\s*Evaluation\s*\|/.test(lines[index])) {
      tableStart = index;
      break;
    }
  }
  if (tableStart === -1) {
    report.fail('Table 2 column headers not found');
    return;
  }

  const dataRows = [];
  let totalsRow = null;
  for (let index = tableStart + 2; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line.startsWith('|')) break;

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length < 5) continue;

    if (/Paper totals/i.test(cells[0])) {
      totalsRow = {
        attempts: Number.parseInt(cells[3].replace(/[*,]/g, ''), 10),
        scored: Number.parseInt(cells[4].replace(/[*,]/g, ''), 10),
      };
      continue;
    }

    const attempts = Number.parseInt(cells[3].replace(/,/g, ''), 10);
    const scored = Number.parseInt(cells[4].replace(/,/g, ''), 10);
    if (Number.isNaN(attempts) || Number.isNaN(scored)) continue;
    dataRows.push({ attempts, scored });
  }

  if (dataRows.length === 0) {
    report.fail('No data rows parsed from Table 2');
    return;
  }

  const computedAttempts = dataRows.reduce((sum, row) => sum + row.attempts, 0);
  const computedScored = dataRows.reduce((sum, row) => sum + row.scored, 0);
  report.pass(
    `${dataRows.length} rows parsed, computed: ${computedAttempts.toLocaleString()} attempts / ${computedScored.toLocaleString()} scored`,
  );

  if (!totalsRow) {
    report.warn('No totals row found in Table 2');
  } else if (totalsRow.attempts !== computedAttempts) {
    report.fail(
      `Totals row attempts=${totalsRow.attempts.toLocaleString()}, computed=${computedAttempts.toLocaleString()}`,
    );
  } else if (totalsRow.scored !== computedScored) {
    report.fail(`Totals row scored=${totalsRow.scored.toLocaleString()}, computed=${computedScored.toLocaleString()}`);
  } else {
    report.pass('Totals row matches computed sums');
  }

  if (computedScored !== manifest.totals.expected_scored) {
    report.fail(`Table 2 scored (${computedScored}) ≠ manifest expected_scored (${manifest.totals.expected_scored})`);
  } else {
    report.pass(`Table 2 scored matches manifest (${computedScored})`);
  }
  if (dataRows.length !== manifest.totals.evaluations) {
    report.fail(`Table 2 rows (${dataRows.length}) ≠ manifest evaluations (${manifest.totals.evaluations})`);
  } else {
    report.pass(`Table 2 row count matches manifest (${dataRows.length})`);
  }
}

function validateCounts(body, manifest, report) {
  report.subheading('Pass B: N-Count Consistency');
  const expectedScored = manifest.totals.expected_scored;
  const expectedAttempts = manifest.totals.expected_attempts;
  const evaluationCount = manifest.totals.evaluations;
  const totalPattern = new RegExp(`N[=≈]\\s*${expectedScored.toLocaleString()}`, 'g');
  const totalMatches = body.match(totalPattern) || [];
  if (totalMatches.length >= 4) {
    report.pass(`Paper total N=${expectedScored.toLocaleString()} appears ${totalMatches.length} times in body`);
  } else {
    report.warn(
      `Paper total N=${expectedScored.toLocaleString()} appears only ${totalMatches.length} times (expected ≥4)`,
    );
  }

  const countPattern = /N[=≈]\s*([\d,]+)/g;
  const staleCandidates = [];
  let match;
  while ((match = countPattern.exec(body)) !== null) {
    const value = Number.parseInt(match[1].replace(/,/g, ''), 10);
    if (
      value >= 2500 &&
      value <= 5000 &&
      value !== expectedScored &&
      value !== expectedAttempts &&
      Math.abs(value - expectedScored) <= 200
    ) {
      staleCandidates.push({ value, context: match[0] });
    }
  }
  if (staleCandidates.length === 0) {
    report.pass('No stale N values near paper total detected');
  } else {
    for (const { value, context } of staleCandidates) {
      report.fail(
        `Possible stale total: ${value.toLocaleString()} ("${context}") — close to but ≠ paper total ${expectedScored.toLocaleString()}`,
      );
    }
  }

  const evaluationWord = numToWord(evaluationCount);
  if (!evaluationWord) return;
  const wordPattern = new RegExp(`${evaluationWord}\\s+(key\\s+)?evaluations`, 'gi');
  const wordMatches = body.match(wordPattern) || [];
  if (wordMatches.length > 0) {
    report.pass(`Evaluation count "${evaluationWord}" appears ${wordMatches.length} times`);
  } else {
    report.warn(`Spelled-out evaluation count "${evaluationWord}" not found in body`);
  }

  const allEvaluationWords = /(twenty|thirty|forty)-(\w+)\s+(key\s+)?evaluations/gi;
  let evaluationWordMatch;
  while ((evaluationWordMatch = allEvaluationWords.exec(body)) !== null) {
    const foundWord = evaluationWordMatch[0].replace(/\s+(key\s+)?evaluations/i, '').toLowerCase();
    const foundNumber = WORD_TO_NUM[foundWord];
    if (foundNumber && foundNumber !== evaluationCount) {
      report.fail(
        `Stale evaluation count: "${foundWord}" (=${foundNumber}) in body, expected "${evaluationWord}" (=${evaluationCount})`,
      );
    }
  }
}

function validateTableReferences(body, fullPaper, report) {
  report.subheading('Pass C: Table References');
  const definedTables = new Set();
  const tableHeaderPattern = /\*\*Table (\d+[a-z]?)(?::|\.)/g;
  let match;
  while ((match = tableHeaderPattern.exec(fullPaper)) !== null) definedTables.add(match[1]);

  const references = new Map();
  const tableReferencePattern = /Table (\d+[a-z]?)\b/g;
  while ((match = tableReferencePattern.exec(body)) !== null) {
    const lineStart = body.lastIndexOf('\n', match.index);
    const line = body.slice(lineStart, body.indexOf('\n', match.index + match[0].length));
    if (/\*\*Table \d+[a-z]?[:.]/i.test(line)) continue;
    references.set(match[1], (references.get(match[1]) || 0) + 1);
  }

  const totalReferences = [...references.values()].reduce((sum, count) => sum + count, 0);
  report.pass(`${definedTables.size} tables defined, ${totalReferences} references in body`);
  let brokenReferences = 0;
  for (const [id, count] of references) {
    if (!definedTables.has(id)) {
      report.fail(`Table ${id} referenced ${count} time(s) but not defined`);
      brokenReferences++;
    }
  }
  if (brokenReferences === 0) report.pass('All table references resolve to defined tables');
}

function validateSectionReferences(body, paperLines, report) {
  report.subheading('Pass D: Section References');
  const definedSections = new Set();
  for (const line of paperLines) {
    const sectionMatch = line.match(/^#{2,3}\s+(\d+(?:\.\d+)?)\b/);
    if (sectionMatch) definedSections.add(sectionMatch[1]);
    const appendixMatch = line.match(/^## Appendix ([A-Z])/);
    if (appendixMatch) definedSections.add(`Appendix ${appendixMatch[1]}`);
  }

  const references = new Map();
  const sectionReferencePattern = /Section (\d+(?:\.\d+)?)\b/g;
  let match;
  while ((match = sectionReferencePattern.exec(body)) !== null) {
    references.set(match[1], (references.get(match[1]) || 0) + 1);
  }

  const totalReferences = [...references.values()].reduce((sum, count) => sum + count, 0);
  report.pass(`${definedSections.size} sections defined, ${totalReferences} "Section X.Y" references`);
  let brokenReferences = 0;
  for (const [id, count] of references) {
    if (!definedSections.has(id)) {
      const parent = id.split('.')[0];
      if (id.includes('.') || !definedSections.has(parent)) {
        report.fail(`Section ${id} referenced ${count} time(s) but not defined`);
        brokenReferences++;
      }
    }
  }
  if (brokenReferences === 0) report.pass('All section references resolve to defined sections');
}

function validateRunIds(body, fullPaper, report) {
  report.subheading('Pass E: Run ID Audit');
  const lines = fullPaper.split('\n');
  const headerIndex = lines.findIndex((line) => /^\*\*Table 2:/.test(line.trim()));
  if (headerIndex === -1) {
    report.warn('Table 2 not found for run ID audit');
    return;
  }

  const tableRunIds = new Set();
  const tablePattern = /eval-2026-\d{2}-\d{2}-[a-f0-9]{8}/g;
  for (let index = headerIndex; index < lines.length; index++) {
    const line = lines[index];
    if (index > headerIndex + 2 && !line.trim().startsWith('|')) break;
    let match;
    while ((match = tablePattern.exec(line)) !== null) tableRunIds.add(match[0]);
  }

  const bodyRunIds = new Set(body.match(/eval-2026-\d{2}-\d{2}-[a-f0-9]{8}/g) || []);
  report.pass(`${bodyRunIds.size} run IDs in body, ${tableRunIds.size} in Table 2`);

  const appendixDIndex = fullPaper.indexOf('## Appendix D');
  const appendixEIndex = fullPaper.indexOf('## Appendix E');
  const appendixD =
    appendixDIndex === -1 ? '' : fullPaper.slice(appendixDIndex, appendixEIndex === -1 ? undefined : appendixEIndex);
  let orphaned = 0;
  for (const runId of bodyRunIds) {
    if (!tableRunIds.has(runId) && !appendixD.includes(runId)) {
      report.warn(`Run ID ${runId} in body but not in Table 2 or Appendix D`);
      orphaned++;
    }
  }
  if (orphaned === 0) report.pass('All body run IDs found in Table 2 or Appendix D');

  let unreferenced = 0;
  for (const runId of tableRunIds) {
    const escapedRunId = runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const count = (fullPaper.match(new RegExp(escapedRunId, 'g')) || []).length;
    if (count <= 1) {
      report.warn(`Run ID ${runId} appears only in Table 2, nowhere else`);
      unreferenced++;
    }
  }
  if (unreferenced === 0) report.pass('All Table 2 run IDs referenced elsewhere in paper');
}

export function runDeepPaperChecks({ manifest, paper, report }) {
  report.heading('Level 2: Deep Paper Checks');
  const { body } = splitPaper(paper);
  validateTable2(paper, manifest, report);
  validateCounts(body, manifest, report);
  validateTableReferences(body, paper, report);
  validateSectionReferences(body, paper.split('\n'), report);
  validateRunIds(body, paper, report);
}
